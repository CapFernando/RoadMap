/* PROVA LOCAL DO `deploy-versao`, executando o bloco de verdade.
 *
 * O bloco e RECORTADO do worker.js e rodado com `gh` e `env` dublados. Nao e
 * o roteamento (isso a invariante confere pela lista branca e pela profundidade
 * de chaves) — e a DECISAO: quem pode, o que muda, o que volta por item, e
 * quantas vezes o arquivo e gravado.
 */
const fs = require('fs');
const W = fs.readFileSync('cloudflare-worker/worker.js', 'utf8');

function corpo(t, ancora) {
  const i = t.indexOf(ancora);
  if (i < 0) throw new Error('ancora nao encontrada: ' + ancora);
  let d = 0;
  for (let k = t.indexOf('{', i); k < t.length; k++) {
    if (t[k] === '{') d++;
    else if (t[k] === '}') { d--; if (!d) return t.slice(i, k + 1); }
  }
  throw new Error('bloco nao fechou');
}

const BLOCO = corpo(W, "if (body.action === 'deploy-versao') {");

/* O ARQUIVO DE DADOS DE MENTIRA, com o formato real. Duas demandas, uma delas
   ja em producao numa versao antiga — e o caso que prova que reenviar o lote
   nao reescreve a data de quem subiu antes. */
const BASE = () => ({
  atualizado_em: '2026-09-01T00:00:00.000Z',
  melhorias: [
    { id: 'd1', codigo: 'AX-338', titulo: 'Consultas Grupo Cadastro' },
    { id: 'd2', codigo: 'AX-340', titulo: 'Outra' },
    { id: 'd3', codigo: 'AX-341', titulo: 'Ja em producao',
      versao: '1.3.0', em_producao: true,
      producao_em: '2026-08-01T10:00:00.000Z', producao_por: 'deploy' },
  ],
});

function roda(body, env, dados) {
  const arquivo = { conteudo: JSON.stringify(dados || BASE()), sha: 'sha-1' };
  const puts = [];
  const gh = async (rota, opcoes) => {
    if (opcoes && opcoes.method === 'PUT') {
      const b = JSON.parse(opcoes.body);
      puts.push(b);
      arquivo.conteudo = Buffer.from(b.content, 'base64').toString('utf8');
      return { ok: true, json: async () => ({}) };
    }
    if (rota.indexOf('raw=') >= 0) {
      return { ok: true, text: async () => arquivo.conteudo };
    }
    return { ok: true, json: async () => ({ sha: arquivo.sha }) };
  };
  let resposta = null;
  const json = (obj, status) => { resposta = { obj, status: status || 200 }; return resposta; };
  const limpaTexto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
  const toB64 = (str) => Buffer.from(str, 'utf8').toString('base64');
  const registraHistorico = (novo, antigo, quem, origem) => {
    // Dublê minimalista: guarda o que foi chamado, para o teste afirmar que o
    // rastro foi PEDIDO com os objetos certos.
    registraHistorico.chamadas.push({ quem, origem,
      diferente: JSON.stringify(novo) !== JSON.stringify(antigo) });
  };
  registraHistorico.chamadas = [];
  const exigePapel = async (env2, body2, papeis) => {
    if (body2.senha && body2.senha === env2.ADMIN_SENHA) {
      return { ident: { papel: 'admin', usuario: { nome: 'Fernando' } } };
    }
    if (body2.senha && body2.senha === env2.DEV_SENHA) {
      return { ident: { papel: 'dev', usuario: { nome: 'Ana' } } };
    }
    return { recusa: json({ error: 'sem_permissao' }, 403) };
  };

  const f = new Function('body', 'env', 'gh', 'json', 'headers', 'limpaTexto',
    'toB64', 'registraHistorico', 'exigePapel', 'FILE_PATH',
    'return (async () => { ' + BLOCO + ' return null; })();');
  return f(body, env, gh, json, {}, limpaTexto, toB64, registraHistorico,
           exigePapel, 'data/melhorias.json')
    .then(() => ({ resposta, puts, arquivo, hist: registraHistorico.chamadas }));
}

// ─────────────────────────────────────────────────────────────────────────────
let falhas = 0;
function ok(cond, o_que, extra) {
  if (cond) console.log('  OK  ' + o_que + (extra ? '  ' + extra : ''));
  else { falhas++; console.log('  FALHOU ' + o_que + (extra ? '  ' + extra : '')); }
}

(async () => {
  const ENV = { DEPLOY_CHAVE: 'chave-do-pipeline', ADMIN_SENHA: 'adm', DEV_SENHA: 'dev' };

  console.log('== quem pode chamar ==');
  let r = await roda({ action: 'deploy-versao', itens: [{ codigo: 'AX-338', producao: true }] }, ENV);
  ok(r.resposta.status === 403, 'sem credencial nenhuma e recusado', 'http ' + r.resposta.status);
  ok(r.puts.length === 0, 'e nada e gravado');

  r = await roda({ action: 'deploy-versao', chave: 'errada',
                   itens: [{ codigo: 'AX-338', producao: true }] }, ENV);
  ok(r.resposta.status === 403, 'chave errada e recusada');

  r = await roda({ action: 'deploy-versao', chave: 'chave-do-pipeline',
                   itens: [{ codigo: 'AX-338', versao: '1.4.2', producao: true }] }, ENV);
  ok(r.resposta.status === 200 && r.resposta.obj.ok, 'a chave do pipeline entra');
  ok(r.hist.length === 1 && r.hist[0].quem === 'deploy',
     'e o rastro registra "deploy" como autor', JSON.stringify(r.hist[0]));

  r = await roda({ action: 'deploy-versao', senha: 'adm',
                   itens: [{ codigo: 'AX-338', versao: '1.4.2', producao: true }] }, ENV);
  ok(r.resposta.obj.ok, 'a senha de admin tambem entra');
  ok(r.hist[0].quem === 'Fernando', 'e o rastro guarda o nome da pessoa', r.hist[0].quem);

  r = await roda({ action: 'deploy-versao', senha: 'dev',
                   itens: [{ codigo: 'AX-338', producao: true }] }, ENV);
  ok(r.resposta.obj.ok, 'e a de dev');

  /* SEM O SECRET, A PORTA NAO EXISTE. Se `DEPLOY_CHAVE` estiver vazio, mandar
     `chave: ''` nao pode virar uma entrada — seria uma porta aberta por
     configuracao ausente, que e o pior tipo. */
  r = await roda({ action: 'deploy-versao', chave: '',
                   itens: [{ codigo: 'AX-338', producao: true }] },
                 { ADMIN_SENHA: 'adm' });
  ok(r.resposta.status === 403, 'sem o secret configurado, chave vazia NAO abre');

  console.log('');
  console.log('== o que muda na demanda ==');
  r = await roda({ action: 'deploy-versao', chave: 'chave-do-pipeline',
                   itens: [{ codigo: 'AX-338', versao: '1.4.2', producao: true }] }, ENV);
  let d = JSON.parse(r.arquivo.conteudo).melhorias.find(m => m.codigo === 'AX-338');
  ok(d.versao === '1.4.2', 'a versao e gravada', d.versao);
  ok(d.em_producao === true, 'e a marca de producao');
  ok(!!d.producao_em, 'com a data da subida', d.producao_em);
  ok(d.producao_por === 'deploy', 'e quem marcou', d.producao_por);

  /* A ETAPA NAO SE MEXE. Subir e um fato sobre o codigo; concluir e decisao do
     PM/PO. Uma demanda pode estar em producao e ainda em validacao. */
  ok(d.status_planejamento === undefined, 'e a etapa NAO e tocada');

  console.log('');
  console.log('== reenviar o mesmo lote ==');
  r = await roda({ action: 'deploy-versao', chave: 'chave-do-pipeline',
                   itens: [{ codigo: 'AX-341', versao: '1.3.0', producao: true }] }, ENV);
  d = JSON.parse(r.arquivo.conteudo).melhorias.find(m => m.codigo === 'AX-341');
  ok(d.producao_em === '2026-08-01T10:00:00.000Z',
     'nao reescreve a data de quem JA estava em producao', d.producao_em);

  r = await roda({ action: 'deploy-versao', chave: 'chave-do-pipeline',
                   itens: [{ codigo: 'AX-341', producao: false }] }, ENV);
  d = JSON.parse(r.arquivo.conteudo).melhorias.find(m => m.codigo === 'AX-341');
  ok(d.em_producao === false, 'e o rollback desmarca', String(d.em_producao));
  ok(d.producao_em === '', 'limpando a data', JSON.stringify(d.producao_em));

  console.log('');
  console.log('== o lote ==');
  r = await roda({ action: 'deploy-versao', chave: 'chave-do-pipeline', itens: [
    { codigo: 'AX-338', versao: '1.4.2', producao: true },
    { codigo: 'AX-340', versao: '1.4.2', producao: true },
    { codigo: 'AX-999', versao: '1.4.2', producao: true },
  ] }, ENV);
  ok(r.puts.length === 1, 'tres itens, UM commit', r.puts.length + ' put(s)');
  ok(r.resposta.obj.alteradas === 2, 'duas alteradas', String(r.resposta.obj.alteradas));
  const porCod = Object.fromEntries(r.resposta.obj.resultados.map(x => [x.codigo, x]));
  ok(porCod['AX-338'].ok && porCod['AX-340'].ok, 'as que existem voltam ok');
  ok(porCod['AX-999'].ok === false && porCod['AX-999'].erro === 'nao_encontrada',
     'e a que nao existe volta o motivo, sem reprovar o lote', porCod['AX-999'].erro);
  ok(r.resposta.obj.ok === true, 'o lote com um erro ainda e sucesso parcial');
  ok(/1\.4\.2/.test(r.puts[0].message), 'a mensagem do commit diz a versao',
     r.puts[0].message);

  console.log('');
  console.log('== o que e recusado por item ==');
  r = await roda({ action: 'deploy-versao', chave: 'chave-do-pipeline', itens: [
    { codigo: 'AX-338', producao: 'true' },
  ] }, ENV);
  ok(r.resposta.obj.resultados[0].erro === 'producao_nao_booleana',
     'producao em TEXTO e recusada, e nao virada true', r.resposta.obj.resultados[0].erro);
  ok(r.puts.length === 0, 'e nada e gravado quando nada casou');

  r = await roda({ action: 'deploy-versao', chave: 'chave-do-pipeline', itens: [
    { codigo: 'AX-338' },
  ] }, ENV);
  ok(r.resposta.obj.resultados[0].erro === 'nada_a_mudar',
     'item sem versao e sem producao e recusado');

  r = await roda({ action: 'deploy-versao', chave: 'chave-do-pipeline', itens: [] }, ENV);
  ok(r.resposta.status === 400, 'lote vazio e 400');

  r = await roda({ action: 'deploy-versao', chave: 'chave-do-pipeline',
                   itens: Array.from({ length: 501 }, () => ({ codigo: 'AX-338', producao: true })) },
                 ENV);
  ok(r.resposta.status === 400 && /Maximo/.test(r.resposta.obj.detail || ''),
     'lote acima do teto e recusado antes de ler o arquivo');

  console.log('');
  console.log('== um item so, pela tela ==');
  r = await roda({ action: 'deploy-versao', senha: 'adm',
                   codigo: 'ax-338', versao: '1.5.0', producao: true }, ENV);
  d = JSON.parse(r.arquivo.conteudo).melhorias.find(m => m.codigo === 'AX-338');
  ok(r.resposta.obj.ok && d.versao === '1.5.0',
     'aceita `codigo` no topo, sem `itens` — e o caminho da tela');
  ok(d.em_producao === true, 'o codigo em minuscula casa igual');

  console.log('');
  console.log(falhas ? falhas + ' FALHA(S)' : 'a prova do deploy-versao passou inteira');
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('EXPLODIU:', e.message); process.exit(1); });
