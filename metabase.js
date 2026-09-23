#!/usr/bin/env node
/* ═══ O RELATÓRIO NO METABASE, PELA API ═════════════════════════════════════
 *
 * "Me foi orientado a fazer uso [do Metabase] para padronizar o relatório."
 * "Faça via api."
 *
 * O Metabase lê BANCO DE DADOS — a lista oficial de drivers é Postgres, MySQL,
 * SQL Server, Oracle, BigQuery e afins, e não existe driver de REST nem de
 * JSON. Os dados desta ferramenta são um JSON num repositório privado servido
 * pelo Worker, e o Metabase não alcança isso. O que ele alcança é CSV, e a API
 * dá os três verbos que o fechamento mensal precisa:
 *
 *   POST /api/upload/csv              cria a tabela e o model — roda UMA vez
 *   POST /api/table/{id}/replace-csv  troca os dados — roda todo mês
 *   POST /api/card + /api/dashboard   o painel, criado por código
 *
 * O TERCEIRO É O QUE "PADRONIZAR" QUER DIZER. Um painel montado a mão no
 * navegador é um painel que ninguém consegue repetir: quem sair da empresa leva
 * as escolhas dele junto. Aqui as perguntas estão escritas neste arquivo,
 * versionadas com o resto, e `painel` as recria iguais em qualquer instância.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A CHAVE NUNCA ENTRA NESTE ARQUIVO NEM NO REPOSITÓRIO.
 *
 *   export METABASE_URL="https://metabase.suaempresa.com"
 *   export METABASE_API_KEY="mb_..."        (Admin → Settings → Authentication)
 *
 * Ela é lida do ambiente e só viaja no cabeçalho `X-API-Key`. O arquivo de
 * estado que este script escreve guarda IDs, e nada mais — dá para commitar.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AS PERGUNTAS SÃO SQL, E NÃO O EDITOR GRÁFICO DO METABASE.
 *
 * O construtor de perguntas do Metabase (MBQL) referencia coluna por ID
 * numérico, que muda de instância para instância e às vezes entre versões: um
 * painel escrito assim não se recria em outro lugar sem reescrever tudo. SQL
 * referencia coluna por NOME, e o nome está no CSV que este mesmo repositório
 * gera. É o que torna o painel reproduzível.
 *
 * Uso:
 *   node metabase.js subir roadmap-2026-08.csv [--colecao 3]
 *   node metabase.js trocar roadmap-2026-09.csv
 *   node metabase.js painel
 *   node metabase.js ... --ensaio          (imprime o que faria, sem enviar)
 * ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');

const ESTADO = path.join(__dirname, 'metabase-estado.json');

/* ─── O ESTADO: só IDs ───────────────────────────────────────────────────────
   Sem ele, `trocar` não saberia qual tabela substituir e `painel` criaria um
   segundo painel a cada execução. Não guarda chave nem dado. */
function leEstado() {
  try { return JSON.parse(fs.readFileSync(ESTADO, 'utf8')); } catch (_) { return {}; }
}
function gravaEstado(e) {
  fs.writeFileSync(ESTADO, JSON.stringify(e, null, 2) + '\n', 'utf8');
}

function config() {
  const url = String(process.env.METABASE_URL || '').replace(/\/+$/, '');
  const chave = process.env.METABASE_API_KEY || '';
  if (!url || !chave) {
    console.error('Faltam as variáveis de ambiente:\n' +
      '  METABASE_URL      ex.: https://metabase.suaempresa.com\n' +
      '  METABASE_API_KEY  Admin → Settings → Authentication → API Keys\n\n' +
      'A chave não entra neste arquivo nem no repositório.');
    process.exit(2);
  }
  return { url, chave };
}

/* ─── UMA CHAMADA ────────────────────────────────────────────────────────────
   `ensaio` imprime e não envia. Existe porque a primeira execução de um script
   que ESCREVE num sistema de terceiro é onde se descobre que o corpo estava
   errado — e no Metabase "errado" pode significar um model duplicado que
   alguém vai ter de apagar a mão. */
async function chamada(cfg, metodo, rota, opts) {
  opts = opts || {};
  const alvo = cfg.url + rota;
  if (opts.ensaio) {
    console.log('[ensaio] ' + metodo + ' ' + alvo +
      (opts.json ? '\n         ' + JSON.stringify(opts.json).slice(0, 400) : '') +
      (opts.arquivo ? '\n         arquivo: ' + opts.arquivo : ''));
    return opts.respostaEnsaio || {};
  }
  const cab = { 'X-API-Key': cfg.chave };
  let corpo;
  if (opts.form) {
    corpo = opts.form;                       // o fetch põe o boundary sozinho
  } else if (opts.json) {
    cab['Content-Type'] = 'application/json';
    corpo = JSON.stringify(opts.json);
  }
  const r = await fetch(alvo, { method: metodo, headers: cab, body: corpo });
  const texto = await r.text();
  if (!r.ok) {
    throw new Error(metodo + ' ' + rota + ' → HTTP ' + r.status + '\n' + texto.slice(0, 800));
  }
  try { return texto ? JSON.parse(texto) : {}; } catch (_) { return texto; }
}

function formDoCsv(caminho, colecaoId) {
  const f = new FormData();
  /* `collection_id` É OBRIGATÓRIO e aceita nulo. Sem ele o Metabase recusa o
     upload com 400 e uma mensagem que não diz qual campo faltou. */
  f.append('collection_id', colecaoId == null ? '' : String(colecaoId));
  f.append('file', new Blob([fs.readFileSync(caminho)], { type: 'text/csv' }),
           path.basename(caminho));
  return f;
}

/* ═══ AS PERGUNTAS DO RELATÓRIO ═════════════════════════════════════════════
 *
 * São as mesmas do deck, e a ordem é a da conversa: o tamanho do mês, para onde
 * a capacidade foi, o que saiu com nome, e o prazo.
 *
 * `count(distinct demanda_id)` E NÃO `count(*)`: o CSV tem uma linha por
 * (demanda × pessoa), então contar linhas infla toda demanda que teve duas
 * pessoas. Pelo mesmo motivo as somas usam as colunas RATEADAS — elas fecham
 * com o total do mês, e as cheias não. É a decisão de modelagem do CSV, e cada
 * pergunta daqui a respeita. */
const PERGUNTAS = (t) => ([
  { nome: 'Entregas no período', display: 'scalar',
    sql: 'SELECT count(distinct demanda_id) AS entregas FROM ' + t },
  { nome: 'Pontos entregues', display: 'scalar',
    sql: 'SELECT round(sum(pontos_rateados)) AS pontos FROM ' + t },
  { nome: 'Horas realizadas', display: 'scalar',
    sql: 'SELECT round(sum(horas_realizadas_rateadas)) AS horas FROM ' + t },
  { nome: 'Pessoas que entregaram', display: 'scalar',
    sql: "SELECT count(distinct pessoa) AS pessoas FROM " + t + " WHERE pessoa <> ''" },

  { nome: 'Entregas por frente', display: 'bar',
    sql: 'SELECT frente, count(distinct demanda_id) AS entregas FROM ' + t +
         ' GROUP BY frente ORDER BY entregas DESC' },
  { nome: 'Horas planejadas × realizadas por frente', display: 'bar',
    sql: 'SELECT frente, round(sum(horas_planejadas_rateadas)) AS planejadas, ' +
         'round(sum(horas_realizadas_rateadas)) AS realizadas FROM ' + t +
         ' GROUP BY frente ORDER BY realizadas DESC' },
  { nome: 'Pontos por hora, por frente', display: 'bar',
    sql: 'SELECT frente, round(sum(pontos_rateados) / nullif(sum(horas_realizadas_rateadas), 0), 2) ' +
         'AS pontos_por_hora FROM ' + t + ' GROUP BY frente ORDER BY pontos_por_hora DESC' },

  { nome: 'Entregas por pessoa', display: 'row',
    sql: 'SELECT pessoa, count(distinct demanda_id) AS entregas, ' +
         'round(sum(pontos_rateados)) AS pontos FROM ' + t +
         " WHERE pessoa <> '' GROUP BY pessoa ORDER BY entregas DESC" },
  { nome: 'Entregas por sistema', display: 'row',
    sql: 'SELECT sistema, count(distinct demanda_id) AS entregas, ' +
         'round(sum(pontos_rateados)) AS pontos FROM ' + t +
         ' GROUP BY sistema ORDER BY entregas DESC' },
  { nome: 'Evolução × sustentação', display: 'pie',
    sql: 'SELECT tipo, count(distinct demanda_id) AS entregas FROM ' + t +
         " WHERE tipo <> '' GROUP BY tipo" },

  { nome: 'No prazo × com atraso', display: 'pie',
    sql: 'SELECT prazo, count(distinct demanda_id) AS entregas FROM ' + t +
         " WHERE prazo <> '' GROUP BY prazo" },
  { nome: 'Tempo médio, do início à entrega', display: 'scalar',
    sql: 'SELECT round(avg(dias_execucao), 1) AS dias FROM ' + t +
         " WHERE dias_execucao <> '' AND dias_execucao IS NOT NULL" },

  /* AS PRINCIPAIS ENTREGAS EM TABELA, e com `distinct`: sem ele a demanda de
     duas pessoas apareceria duas vezes na lista, uma embaixo da outra. */
  { nome: 'Principais entregas', display: 'table',
    sql: 'SELECT distinct codigo, titulo, sistema, pontos, dias_execucao FROM ' + t +
         ' ORDER BY pontos DESC LIMIT 20' },
  { nome: 'Projetos que andaram', display: 'row',
    sql: 'SELECT projeto_codigo, projeto, count(distinct demanda_id) AS tarefas, ' +
         'round(sum(horas_realizadas_rateadas)) AS horas FROM ' + t +
         " WHERE projeto <> '' GROUP BY projeto_codigo, projeto ORDER BY horas DESC" },
]);

async function subir(cfg, csv, colecaoId, ensaio) {
  if (!fs.existsSync(csv)) throw new Error('não achei o arquivo: ' + csv);
  const r = await chamada(cfg, 'POST', '/api/upload/csv', {
    form: formDoCsv(csv, colecaoId), arquivo: csv, ensaio,
    respostaEnsaio: 0,
  });
  /* A RESPOSTA É O ID DO MODEL (um número cru, e não um objeto). O que o
     `trocar` precisa é o id da TABELA, que mora dentro do model. */
  const modelId = typeof r === 'number' ? r : (r && r.id) || r;
  const model = await chamada(cfg, 'GET', '/api/card/' + modelId, { ensaio });
  const tabelaId = ensaio ? 0 : (model.table_id ||
    ((model.dataset_query || {}).query || {})['source-table']);
  const tabela = ensaio ? { name: 'roadmap', db_id: 0 }
                        : await chamada(cfg, 'GET', '/api/table/' + tabelaId, {});
  const estado = leEstado();
  estado.model_id = modelId;
  estado.tabela_id = tabelaId;
  estado.tabela_nome = tabela.name;
  estado.database_id = tabela.db_id || tabela.database_id;
  estado.colecao_id = colecaoId == null ? null : colecaoId;
  if (!ensaio) gravaEstado(estado);
  console.log('model ' + modelId + ' · tabela ' + tabelaId + ' (' + tabela.name + ')' +
              ' · banco ' + estado.database_id);
  console.log(ensaio ? '(ensaio: nada foi enviado)'
                     : 'estado gravado em ' + path.basename(ESTADO));
  return estado;
}

async function trocar(cfg, csv, ensaio) {
  const estado = leEstado();
  if (!estado.tabela_id) {
    throw new Error('ainda não há tabela. Rode `subir` uma vez antes.');
  }
  if (!fs.existsSync(csv)) throw new Error('não achei o arquivo: ' + csv);
  await chamada(cfg, 'POST', '/api/table/' + estado.tabela_id + '/replace-csv', {
    form: formDoCsv(csv, null), arquivo: csv, ensaio,
  });
  console.log(ensaio ? '(ensaio: nada foi enviado)'
    : 'dados trocados na tabela ' + estado.tabela_id + ' — o painel já mostra o mês novo.');
}

async function painel(cfg, ensaio) {
  const estado = leEstado();
  if (!estado.tabela_nome || !estado.database_id) {
    throw new Error('falta o nome da tabela. Rode `subir` uma vez antes.');
  }
  const perguntas = PERGUNTAS(estado.tabela_nome);

  /* O PAINEL É RECRIADO, e não remendado: um `PUT` que tentasse casar cartão a
     cartão com o que existe lá precisaria adivinhar o que alguém mexeu a mão.
     Recriar deixa o antigo intacto (ele fica no histórico da coleção) e produz
     um painel que é exatamente o que este arquivo diz. */
  const cartoes = [];
  for (const p of perguntas) {
    const c = await chamada(cfg, 'POST', '/api/card', {
      ensaio, respostaEnsaio: { id: 0 },
      json: {
        name: p.nome,
        display: p.display,
        collection_id: estado.colecao_id == null ? null : estado.colecao_id,
        dataset_query: {
          type: 'native',
          database: estado.database_id,
          native: { query: p.sql },
        },
        visualization_settings: {},
      },
    });
    cartoes.push({ id: c.id, nome: p.nome, display: p.display });
  }

  /* A GRADE: 18 colunas de largura, que é a do Metabase. Os quatro números do
     mês ocupam 1/4 da linha cada; os gráficos, meia linha. Sem `size_x`/`size_y`
     o Metabase empilha tudo em coluna única, e um painel de catorze cartões
     empilhados não se lê. */
  const grade = [];
  let linha = 0;
  cartoes.forEach((c, i) => {
    const escalar = c.display === 'scalar';
    const largura = escalar ? 4 : 9;
    const altura = escalar ? 3 : 6;
    const porLinha = escalar ? 4 : 2;
    const col = (i % porLinha) * largura;
    grade.push({ id: -(i + 1), card_id: c.id, row: linha, col: col,
                 size_x: largura, size_y: altura });
    if ((i % porLinha) === porLinha - 1) linha += altura;
  });

  const d = await chamada(cfg, 'POST', '/api/dashboard', {
    ensaio, respostaEnsaio: { id: 0 },
    json: {
      name: 'Fechamento mensal — Tecnologia',
      description: 'Gerado por metabase.js a partir do CSV do Roadmap. ' +
        'Entregas contam `distinct demanda_id`; somas usam as colunas rateadas.',
      collection_id: estado.colecao_id == null ? null : estado.colecao_id,
    },
  });
  await chamada(cfg, 'PUT', '/api/dashboard/' + d.id, {
    ensaio, json: { dashcards: grade },
  });

  estado.dashboard_id = d.id;
  estado.cartoes = cartoes.map(c => ({ id: c.id, nome: c.nome }));
  if (!ensaio) gravaEstado(estado);
  console.log((ensaio ? '(ensaio) ' : '') + cartoes.length + ' perguntas e o painel ' +
              d.id + (ensaio ? '' : ' — abra em ' + cfg.url + '/dashboard/' + d.id));
}

async function principal() {
  const args = process.argv.slice(2);
  const ensaio = args.includes('--ensaio');
  const comando = args.find(a => !a.startsWith('--'));
  const arquivo = args.filter(a => !a.startsWith('--'))[1];
  const iCol = args.indexOf('--colecao');
  const colecao = iCol >= 0 ? Number(args[iCol + 1]) : null;

  if (!comando || comando === 'ajuda') {
    console.log(fs.readFileSync(__filename, 'utf8')
      .split('\n').slice(0, 46).filter(l => l.startsWith(' *') || l.startsWith('/*'))
      .map(l => l.replace(/^ \* ?| ?\*\/$|^\/\* ?/, '')).join('\n'));
    return;
  }
  const cfg = config();
  if (comando === 'subir') return subir(cfg, arquivo, colecao, ensaio);
  if (comando === 'trocar') return trocar(cfg, arquivo, ensaio);
  if (comando === 'painel') return painel(cfg, ensaio);
  throw new Error('comando desconhecido: ' + comando + ' (use subir, trocar ou painel)');
}

if (require.main === module) {
  principal().catch(e => { console.error(String(e.message || e)); process.exit(1); });
}

module.exports = { PERGUNTAS, formDoCsv, leEstado, gravaEstado, ESTADO };
