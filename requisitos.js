/* ═══ EM APROVAÇÃO DE REQUISITOS, IMPACTO E URGÊNCIA ═══════════════════════
 *
 * "Altere a etapa em adm 'Levantar Requisitos' para 'Em aprovação de
 *  requisitos'. Toda demanda que cair nessa etapa, o sistema deverá gerar um
 *  fluxo de caso de uso para o usuário aprovar (por hora eu enviarei manual).
 *  Quero ajustes na abertura das tasks e seguirá toda esteira:
 *   - Impacto: baixo, médio ou alto
 *   - Urgência: baixa, média ou alta"                          (03/11/2026)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A CHAVE DA ETAPA CONTINUA `levantar_req`. Muda o NOME que se lê, não o valor
 * gravado: são centenas de demandas, históricos, relatórios e a regra do grill
 * ("tenho dúvidas" leva para cá) apontando para essa chave. Trocar o valor
 * seria uma migração inteira para mudar um rótulo.
 *
 * O CASO DE USO NASCE NO SERVIDOR E SE ESCREVE NA TELA.
 *   - O Worker carimba `caso_uso` quando a demanda ENTRA na etapa (qualquer
 *     porta: Admin, Gantt, painel dev, grill, API). É isso que garante o
 *     "toda demanda que cair".
 *   - O texto é montado aqui, a partir do que a demanda tem (`casoDeUso`), e
 *     sempre com os dados de agora — o PM/PO ajusta e envia.
 *   - Ao marcar ENVIADO, o texto que foi para o usuário é guardado no card: o
 *     que se aprova é o que se enviou, e não o que a demanda virou depois.
 *
 *   status   a_enviar → enviado → aprovado | ajustes
 *
 * IMPACTO E URGÊNCIA são dois campos próprios (`impacto`, `urgencia`), pedidos
 * na abertura em todas as telas e visíveis no card da esteira inteira. NÃO
 * calculam a prioridade: a matriz que sobrescrevia a prioridade já saiu de uso
 * uma vez por isso — a prioridade continua sendo escolhida.
 */
(function (raiz) {
  'use strict';

  var ETAPA = 'levantar_req';
  var ROTULO = 'Em aprovação de requisitos';
  var ROTULO_CURTO = 'Aprov. requisitos';

  var IMPACTOS  = [{ v: 'baixo', r: 'Baixo' }, { v: 'medio', r: 'Médio' }, { v: 'alto', r: 'Alto' }];
  var URGENCIAS = [{ v: 'baixa', r: 'Baixa' }, { v: 'media', r: 'Média' }, { v: 'alta', r: 'Alta' }];
  var CORES = { 0: 'var(--green-tx)', 1: 'var(--amber-tx)', 2: 'var(--red-tx)' };

  function txt(v) { return String(v == null ? '' : v).trim(); }
  function sem(s) { return txt(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  /* Aceita o valor gravado e também o rótulo ("Médio", "media"...), para a API
     e a importação não precisarem acertar a grafia exata. Fora da lista: ''. */
  function norm(lista, v) {
    var s = sem(v);
    if (!s) return '';
    for (var i = 0; i < lista.length; i++) {
      if (sem(lista[i].v) === s || sem(lista[i].r) === s) return lista[i].v;
      if (s.slice(0, 3) === sem(lista[i].v).slice(0, 3)) return lista[i].v;
    }
    return '';
  }
  function impacto(v)  { return norm(IMPACTOS, v); }
  function urgencia(v) { return norm(URGENCIAS, v); }
  function idx(lista, v) { for (var i = 0; i < lista.length; i++) if (lista[i].v === v) return i; return -1; }
  function rotuloImpacto(v)  { var i = idx(IMPACTOS, impacto(v));   return i < 0 ? '' : IMPACTOS[i].r; }
  function rotuloUrgencia(v) { var i = idx(URGENCIAS, urgencia(v)); return i < 0 ? '' : URGENCIAS[i].r; }

  function esc(s) {
    return txt(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** As <option> de um select, com a primeira vazia ("— Selecione —"). */
  function opcoes(qual, atual) {
    var lista = qual === 'urgencia' ? URGENCIAS : IMPACTOS;
    var a = qual === 'urgencia' ? urgencia(atual) : impacto(atual);
    return '<option value="">— Selecione —</option>' + lista.map(function (o) {
      return '<option value="' + o.v + '"' + (o.v === a ? ' selected' : '') + '>' + o.r + '</option>';
    }).join('');
  }

  /** Os dois chips do card. Vazio quando a demanda não tem nenhum dos dois. */
  function chips(m) {
    var out = '';
    [['Impacto', IMPACTOS, impacto((m || {}).impacto)], ['Urgência', URGENCIAS, urgencia((m || {}).urgencia)]]
      .forEach(function (c) {
        var i = idx(c[1], c[2]);
        if (i < 0) return;
        out += '<span class="req-chip" title="' + c[0] + ': ' + c[1][i].r + '" style="display:inline-block;' +
               'font-size:10px;font-weight:700;border-radius:5px;padding:1px 6px;margin-right:4px;' +
               'border:1px solid ' + CORES[i] + ';color:' + CORES[i] + '">' + c[0] + ' ' + c[1][i].r + '</span>';
      });
    return out;
  }

  /* ─── O CASO DE USO ─────────────────────────────────────────────────── */

  var ESTADOS = {
    a_enviar: 'A enviar ao usuário',
    enviado:  'Enviado — aguardando aprovação',
    aprovado: 'Aprovado pelo usuário',
    ajustes:  'Usuário pediu ajustes',
  };

  function estado(m) {
    var c = (m || {}).caso_uso;
    if (!c || typeof c !== 'object') return '';
    return ESTADOS[c.status] ? c.status : 'a_enviar';
  }

  /* As seções do modelo de descrição (`modelo-descricao.js`), lidas pelo
     número e pelo nome. Demanda sem o modelo cai inteira em "pedido". */
  var SECOES = [
    ['objetivo', /^\s*1\s*[.)-]\s*objetivo/],
    ['local',    /^\s*2\s*[.)-]\s*local/],
    ['regra',    /^\s*3\s*[.)-]\s*regra/],
    ['impactos', /^\s*4\s*[.)-]\s*impactos na/],
    ['docs',     /^\s*5\s*[.)-]\s*impactos em/],
    ['aceite',   /^\s*6\s*[.)-]\s*crit/],
  ];
  function secoes(descricao) {
    var out = {}, atual = 'pedido';
    String(descricao || '').split(/\r?\n/).forEach(function (linha) {
      var s = sem(linha);
      for (var i = 0; i < SECOES.length; i++) {
        if (SECOES[i][1].test(s)) { atual = SECOES[i][0]; return; }
      }
      (out[atual] = out[atual] || []).push(linha);
    });
    Object.keys(out).forEach(function (k) { out[k] = out[k].join('\n').trim(); });
    return out;
  }

  /* Linhas de lista ("- x", "1. x", "• x") viram passos; texto corrido vira um. */
  function passos(t) {
    var linhas = String(t || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var itens = linhas.filter(function (l) { return /^([-*•]|\d+[.)])\s+/.test(l); })
                      .map(function (l) { return l.replace(/^([-*•]|\d+[.)])\s+/, ''); });
    return itens.length ? itens : linhas;
  }

  function dataBR(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(txt(iso));
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  }

  /** O texto do caso de uso, pronto para revisar e enviar.
   *  `ctx`: { tema, hoje } — o nome do sistema e a data (AAAA-MM-DD). */
  function casoDeUso(m, ctx) {
    m = m || {}; ctx = ctx || {};
    var s = secoes(m.descricao);
    var num = function (lista) { return lista.map(function (p, i) { return '   ' + (i + 1) + '. ' + p; }).join('\n'); };
    var L = [];
    L.push('CASO DE USO — ' + (txt(m.codigo) ? m.codigo + ' · ' : '') + txt(m.titulo));
    L.push('');
    L.push('Solicitante: ' + (txt(m.solicitante) || 'a confirmar'));
    if (ctx.tema) L.push('Sistema: ' + ctx.tema);
    L.push('Impacto: ' + (rotuloImpacto(m.impacto) || 'a definir') +
           '   ·   Urgência: ' + (rotuloUrgencia(m.urgencia) || 'a definir'));
    L.push('Data: ' + (dataBR(ctx.hoje) || ''));
    L.push('');
    L.push('1. OBJETIVO');
    L.push('   ' + (s.objetivo || s.pedido || txt(m.titulo)).replace(/\n/g, '\n   '));
    L.push('');
    L.push('2. ATORES');
    L.push('   - Usuário solicitante: ' + (txt(m.solicitante) || 'a confirmar') + ' (aprova os requisitos e homologa a entrega)');
    L.push('   - Time de Tecnologia: ' + (txt(m.dev) ? m.dev : 'responsável a definir') + ' (desenvolve)');
    L.push('');
    L.push('3. ONDE ACONTECE');
    L.push('   ' + (s.local || (ctx.tema ? ctx.tema : 'a confirmar com o usuário')).replace(/\n/g, '\n   '));
    L.push('');
    L.push('4. FLUXO PRINCIPAL');
    var fluxo = passos(s.regra || (s.objetivo ? s.pedido : '') || '');
    L.push(fluxo.length ? num(fluxo) : '   1. [descrever o passo a passo do usuário]');
    L.push('');
    L.push('5. FLUXOS ALTERNATIVOS E EXCEÇÕES');
    var duv = (((m.grill || {}).pontos) || []).map(function (p) { return txt(typeof p === 'string' ? p : p && p.texto); }).filter(Boolean);
    L.push(duv.length ? '   Pontos levantados pelo time, a confirmar:\n' + num(duv) : '   [o que acontece quando algo sai do caminho principal]');
    L.push('');
    if (s.impactos || s.docs) {
      L.push('6. IMPACTOS');
      if (s.impactos) L.push('   ' + s.impactos.replace(/\n/g, '\n   '));
      if (s.docs) L.push('   ' + s.docs.replace(/\n/g, '\n   '));
      L.push('');
    }
    L.push((s.impactos || s.docs ? '7' : '6') + '. CRITÉRIOS DE ACEITE');
    var aceite = passos(s.aceite);
    L.push(aceite.length ? num(aceite) : '   1. [como o usuário confere que ficou certo]');
    L.push('');
    L.push('APROVAÇÃO DO USUÁRIO');
    L.push('   ( ) Aprovo os requisitos acima');
    L.push('   ( ) Preciso de ajustes: ______________________________');
    L.push('   Nome: ____________________   Data: ___/___/______');
    return L.join('\n');
  }

  /** Página para imprimir / salvar em PDF. */
  function paginaImpressao(texto, titulo) {
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>' + esc(titulo || 'Caso de uso') +
      '</title><style>body{font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1E2329;' +
      'max-width:820px;margin:32px auto;padding:0 24px;line-height:1.55}' +
      'h1{font-size:13px;letter-spacing:.08em;color:#2E8B57;margin:0 0 4px}' +
      'pre{white-space:pre-wrap;font-family:inherit;font-size:14px;margin:0}' +
      '@media print{body{margin:0}}</style></head><body><h1>AUDAX CAPITAL — APROVAÇÃO DE REQUISITOS</h1><pre>' +
      esc(texto) + '</pre></body></html>';
  }

  var api = {
    ETAPA: ETAPA, ROTULO: ROTULO, ROTULO_CURTO: ROTULO_CURTO,
    IMPACTOS: IMPACTOS, URGENCIAS: URGENCIAS, ESTADOS: ESTADOS,
    impacto: impacto, urgencia: urgencia,
    rotuloImpacto: rotuloImpacto, rotuloUrgencia: rotuloUrgencia,
    opcoes: opcoes, chips: chips,
    estado: estado, secoes: secoes, casoDeUso: casoDeUso, paginaImpressao: paginaImpressao,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.REQUISITOS = api;
}(typeof window !== 'undefined' ? window : this));
