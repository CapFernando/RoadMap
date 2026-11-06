/* ─────────────────────────────────────────────────────────────────────────
   AXIS — Importar demandas (#importar). Prancha Backlog · Importar do EP-013.

   Fora do menu: chega-se pela aba Importar do Backlog (o nucleo marca
   "Backlog" como ativo). So admin, como o importar.html, que gravava pela
   senha do admin.

   E O IMPORTAR.HTML NO APP NOVO, em quatro passos:
     1 · Arquivo      um .csv/.tsv ou as linhas coladas do Excel
     2 · Mapeamento   qual coluna da planilha vai em qual campo
     3 · Revisao      o que esta pronto, o que tem pendencia, o que parece
                      demanda que ja existe — e o que fazer com cada linha
     4 · Importar     grava e mostra os codigos AX- que nasceram

   GRAVA PELO `H.gravar`, e nao pelo `publish` com a base inteira montada na
   tela, como fazia o importar.html. O patch leva so as demandas novas e os
   campos das atualizadas; o gravacao.js le a base fresca, aplica por cima,
   confere o pre-voo e trata a corrida. Sistema novo vai em `raiz.temas`, lido
   do servidor na hora de gravar.

   AS REGRAS DA REVISAO SAO AS DO SERVIDOR, conferidas antes para a pessoa
   corrigir a linha em vez de traduzir uma recusa — o `publish` recusa a
   importacao INTEIRA por causa de uma linha:
     - titulo igual ao de demanda viva: `tituloAssinatura` (catalogo.js), a
       mesma do `criandoTituloRepetido` do worker;
     - quem pediu e obrigatorio na abertura (`nascendoSemSolicitante`);
     - data no passado nao abre demanda (`ABERTURA.checa`, abertura.js); como
       na prancha, a data retroativa vira a data de hoje, e a linha avisa;
     - sistema e responsavel por etapa: `PREVOO.presos`, o mesmo do gravar.
   A semelhanca de titulo (Jaccard, limiar 35%) e a do importar.html.

   O QUE MUDOU EM RELACAO AO IMPORTAR.HTML:
     - "Atualizar existente" completa/troca so os campos que a planilha traz
       preenchidos e NAO muda a etapa: mover etapa tem travas proprias
       (homologacao, sprint, horas) que uma importacao nao deve atravessar.
     - Etapa vazia ou nao reconhecida entra como Backlog (la era Planejado,
       que exige sistema e responsavel). "Atrasado" vira Em Andamento: atraso
       e derivado do prazo e nunca e gravado (etapa-demanda.js).
     - .xlsx nao e lido: salve como CSV ou copie e cole as linhas.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var A = window.AXIS_APP;
  if (!A) return;
  var H = A.H;
  var esc = H.esc;
  var W = window;

  // ── Campos do AXIS que a planilha pode preencher ────────────────────────
  // `apelidos` sao os do `parseCsv` do importar.html (mais "sistema", o nome
  // do tema no AXIS). Exatos primeiro, depois "contem".
  var CAMPOS = [
    { id: 'titulo', rot: 'Título', obrig: true, apelidos: ['titulo', 'title', 'demanda', 'nome', 'tarefa'] },
    { id: 'descricao', rot: 'Descrição', apelidos: ['descricao', 'descri', 'description', 'obs', 'observa'] },
    { id: 'tema', rot: 'Sistema', apelidos: ['sistema', 'tema', 'theme', 'projeto', 'area'] },
    { id: 'dev', rot: 'Dev(s)', apelidos: ['dev', 'desenvolvedor', 'responsavel'] },
    { id: 'status', rot: 'Etapa', apelidos: ['etapa', 'status', 'situacao', 'situa', 'estado'] },
    { id: 'tipo', rot: 'Tipo', apelidos: ['tipo', 'classificacao', 'tipo_issue', 'categoria'] },
    { id: 'inicio', rot: 'Início', apelidos: ['inicio', 'data_inicio', 'start', 'inicio_prev'] },
    { id: 'entrega', rot: 'Entrega', apelidos: ['entrega', 'data_entrega', 'fim', 'prazo', 'deadline', 'end'] },
    { id: 'horas_realizadas', rot: 'Horas realizadas', apelidos: ['horas_realizadas', 'horas', 'hrs', 'hours'] },
    { id: 'solicitante', rot: 'Quem pediu', apelidos: ['solicitante', 'requester', 'quem_pediu'] },
    { id: 'prioridade', rot: 'Prioridade', apelidos: ['prioridade', 'priority', 'prio'] }
  ];
  var MODELO = ['titulo', 'descricao', 'tema', 'dev', 'status', 'tipo', 'inicio', 'entrega', 'horas_realizadas', 'solicitante', 'prioridade'];
  var MAX_LINHAS = 1000;
  var SIM_LIMIAR = 0.35;   // importar.html: 35% de Jaccard pede revisao

  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // ── Etapa, tipo e prioridade como a planilha escreve ────────────────────
  var ETAPA_APELIDO = (function () {
    var m = {};
    H.ETAPAS.forEach(function (e) { m[norm(e.id)] = e.id; m[norm(e.rotulo)] = e.id; });
    var legado = {
      'levantar req': 'levantar_req', 'levantar req.': 'levantar_req', 'levantamento': 'levantar_req',
      // O nome antigo da etapa, que as planilhas de antes de 03/11/2026 ainda trazem.
      'levantar requisitos': 'levantar_req', 'aprov. requisitos': 'levantar_req', 'aprovacao de requisitos': 'levantar_req',
      'estimado': 'planejado', 'refinado': 'planejado', 'andamento': 'em_andamento', 'iniciado': 'em_andamento', 'wip': 'em_andamento',
      'plan': 'planning', 'planejamento': 'planning', 'deploy': 'concluido',
      'homologacao': 'validacao_area', 'homolog': 'validacao_area', 'validacao da area': 'validacao_area', 'validacao_area': 'validacao_area',
      'finalizado': 'concluido', 'entregue': 'concluido', 'done': 'concluido', 'ok': 'concluido',
      'validacao pm/po': 'validacao', 'em validacao': 'validacao',
      // Atraso e derivado do prazo, nunca gravado: o card mora em Em Andamento.
      'atrasado': 'em_andamento', 'atraso': 'em_andamento', 'delayed': 'em_andamento',
      'negado': 'negada', 'cancelado': 'negada', 'cancelada': 'negada'
    };
    Object.keys(legado).forEach(function (k) { m[k] = legado[k]; });
    return m;
  })();
  var TIPO_APELIDO = { 'sustentacao': 'sustentacao', 'sust': 'sustentacao', 'manutencao': 'sustentacao', 'correcao': 'sustentacao', 'bug': 'sustentacao', 'erro': 'sustentacao',
                       'evolucao': 'evolucao', 'evol': 'evolucao', 'melhoria': 'evolucao', 'nova': 'evolucao', 'funcionalidade': 'evolucao' };
  var PRIO_APELIDO = { 'alta': 'alta', 'high': 'alta', '1': 'alta', 'media': 'media', 'medium': 'media', '2': 'media', 'baixa': 'baixa', 'low': 'baixa', '3': 'baixa' };

  function data(s) {
    var t = String(s || '').trim();
    if (!t) return { v: '' };
    var m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return { v: m[1] + '-' + m[2] + '-' + m[3] };
    m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})/);
    if (m) return { v: (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') };
    return { v: '', ruim: t };
  }

  // ── Leitura do texto (CSV, TSV ou colado do Excel) ──────────────────────
  /* Separador pela primeira linha: TAB (o que o Excel copia), ponto e virgula
     (o CSV do Excel em portugues) ou virgula. Aspas sao respeitadas: uma
     descricao com ";" ou quebra de linha dentro nao desloca as colunas. */
  function lerTexto(texto) {
    var t = String(texto || '').replace(/^﻿/, '');
    var primeira = t.split(/\r?\n/)[0] || '';
    var sep = primeira.indexOf('\t') >= 0 ? '\t' : primeira.indexOf(';') >= 0 ? ';' : ',';
    var linhas = [], lin = [], cel = '', aspas = false;
    for (var i = 0; i < t.length; i++) {
      var c = t[i];
      if (aspas) {
        if (c === '"') { if (t[i + 1] === '"') { cel += '"'; i++; } else aspas = false; }
        else cel += c;
      } else if (c === '"' && cel.trim() === '') { aspas = true; cel = ''; }
      else if (c === sep) { lin.push(cel); cel = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && t[i + 1] === '\n') i++;
        lin.push(cel); linhas.push(lin); lin = []; cel = '';
      } else cel += c;
    }
    if (cel !== '' || lin.length) { lin.push(cel); linhas.push(lin); }
    linhas = linhas.map(function (l) { return l.map(function (x) { return x.trim(); }); })
      .filter(function (l) { return l.some(function (x) { return x; }); });
    return { sep: sep, cab: linhas[0] || [], linhas: linhas.slice(1) };
  }

  function mapaAutomatico(cab) {
    var n = cab.map(function (h) { return norm(h).replace(/[^a-z0-9_]/g, '_'); });
    var mapa = {}, usadas = {};
    [true, false].forEach(function (exato) {
      CAMPOS.forEach(function (c) {
        if (mapa[c.id] != null) return;
        for (var a = 0; a < c.apelidos.length; a++) {
          for (var i = 0; i < n.length; i++) {
            if (usadas[i]) continue;
            if (exato ? n[i] === c.apelidos[a] : n[i].indexOf(c.apelidos[a]) >= 0) { mapa[c.id] = i; usadas[i] = true; return; }
          }
        }
      });
    });
    return mapa;
  }

  // ── Semelhanca de titulo (importar.html) ────────────────────────────────
  var VAZIAS = { de: 1, da: 1, do: 1, das: 1, dos: 1, para: 1, por: 1, com: 1, em: 1, no: 1, na: 1, nos: 1, nas: 1, e: 1, a: 1, o: 1, as: 1, os: 1, um: 1, uma: 1, que: 1, se: 1, ao: 1, pelo: 1, pela: 1, pelos: 1, pelas: 1, este: 1, esta: 1, esse: 1, essa: 1, seu: 1, sua: 1 };
  function palavras(t) {
    var out = {};
    norm(t).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).forEach(function (w) { if (w.length > 2 && !VAZIAS[w]) out[w] = 1; });
    return out;
  }
  function jaccard(a, b) {
    var ka = Object.keys(a), kb = Object.keys(b);
    if (!ka.length || !kb.length) return 0;
    var comum = ka.filter(function (w) { return b[w]; }).length;
    return comum / (ka.length + kb.length - comum);
  }
  function assinatura(t) {
    return W.tituloAssinatura ? W.tituloAssinatura(t) : norm(t).replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // ── Estado dos quatro passos ────────────────────────────────────────────────
  var st = { passo: 1, texto: '', arquivo: '', cab: [], linhas: [], sep: '', mapa: {}, rev: [], erro: '', gravando: false, resultado: null };

  function reiniciar() { st = { passo: 1, texto: '', arquivo: '', cab: [], linhas: [], sep: '', mapa: {}, rev: [], erro: '', gravando: false, resultado: null }; }

  function temasDe(D) { return (D && D.temas) || []; }
  function temaPorNome(D, nome) {
    var n = norm(nome);
    if (!n) return null;
    // O catalogo escreve "AXCred - Operações"; a prancha, "AXCred › Operações".
    var n2 = n.replace(/\s*›\s*/g, ' - ');
    return temasDe(D).filter(function (t) { var x = norm(t.nome); return x === n || x === n2; })[0] || null;
  }

  /* As linhas da planilha viram linhas de revisao. A semelhanca e calculada
     uma vez aqui (so depende do titulo), e a verificacao a cada desenho. */
  function montarRevisao(D) {
    var vivas = H.visiveis();
    var vivasNaoNeg = vivas.filter(function (m) { return String(m.status_planejamento || '') !== 'negada'; });
    var porAss = {};
    vivasNaoNeg.forEach(function (m) { var k = assinatura(m.titulo); if (k && !porAss[k]) porAss[k] = m; });
    var tok = vivas.map(function (m) { return { m: m, p: palavras(m.titulo) }; });
    var col = function (l, campo) { var i = st.mapa[campo]; return i == null || i === '' ? '' : String(l[i] == null ? '' : l[i]).trim(); };
    st.rev = st.linhas.slice(0, MAX_LINHAS).map(function (l, i) {
      var temaTxt = col(l, 'tema');
      var tema = temaPorNome(D, temaTxt);
      var stTxt = col(l, 'status'), tpTxt = col(l, 'tipo'), prTxt = col(l, 'prioridade');
      var ini = data(col(l, 'inicio')), ent = data(col(l, 'entrega'));
      var hTxt = col(l, 'horas_realizadas').replace(',', '.');
      var r = {
        n: i + 1,
        titulo: col(l, 'titulo'),
        descricao: col(l, 'descricao'),
        tema: tema ? tema.id : (temaTxt ? 'novo:' + temaTxt : ''),
        dev: col(l, 'dev'),
        status: ETAPA_APELIDO[norm(stTxt)] || 'backlog',
        statusLido: stTxt,
        tipo: TIPO_APELIDO[norm(tpTxt)] || '',
        tipoLido: tpTxt,
        inicio: ini.v, entrega: ent.v, dataRuim: [ini.ruim, ent.ruim].filter(Boolean),
        horas: hTxt === '' || isNaN(Number(hTxt)) ? null : Number(hTxt),
        horasRuim: hTxt !== '' && isNaN(Number(hTxt)) ? hTxt : '',
        solicitante: col(l, 'solicitante'),
        prioridade: PRIO_APELIDO[norm(prTxt)] || '',
        igual: null, parecida: null, acao: 'importar'
      };
      var k = assinatura(r.titulo);
      if (k && porAss[k]) r.igual = porAss[k];
      else if (r.titulo) {
        var p = palavras(r.titulo), melhor = null, s = 0;
        tok.forEach(function (x) { var v = jaccard(p, x.p); if (v > s) { s = v; melhor = x.m; } });
        if (melhor && s >= SIM_LIMIAR) r.parecida = { m: melhor, sim: s };
      }
      if (r.igual) r.acao = 'ignorar';
      return r;
    });
  }

  /** A demanda que a linha vai criar, com as datas ja corrigidas. */
  function novaDe(r, hoje) {
    var d = { inicio: r.inicio, entrega: r.entrega };
    var retro = [];
    ['inicio', 'entrega'].forEach(function (k) { if (d[k] && d[k] < hoje) { retro.push(k); d[k] = hoje; } });
    return { d: d, retro: retro };
  }

  /** Erros (a linha fica de fora) e avisos (entra, com o aviso). */
  function verifica(r, D, hoje, vistas) {
    var erros = [], avisos = [];
    if (r.acao === 'ignorar') return { erros: erros, avisos: ['ignorada'], ign: true };
    if (!r.titulo) erros.push('falta título');
    if (r.acao === 'atualizar') {
      var alvo = r.igual || (r.parecida && r.parecida.m);
      if (!alvo) erros.push('sem demanda para atualizar');
      else avisos.push('atualiza ' + (alvo.codigo || 'a existente'));
      return { erros: erros, avisos: avisos };
    }
    if (r.igual) erros.push('título igual ao de ' + (r.igual.codigo || 'uma demanda viva'));
    var k = assinatura(r.titulo);
    if (k && vistas[k] != null && vistas[k] !== r.n) erros.push('repete a linha ' + vistas[k]);
    else if (k && vistas[k] == null) vistas[k] = r.n;
    if (!String(r.solicitante || '').trim()) erros.push('falta quem pediu');
    var nv = novaDe(r, hoje);
    if (nv.d.inicio && nv.d.entrega && nv.d.entrega < nv.d.inicio) erros.push('entrega antes do início');
    if (W.ABERTURA && W.ABERTURA.checa) {
      var ab = W.ABERTURA.checa(nv.d, 'admin', hoje);
      if (!ab.ok) erros.push(ab.erro);
    }
    // Sistema e responsavel por etapa: as mesmas regras do pre-voo do gravar.
    if (W.PREVOO && W.PREVOO.presos) {
      var temas = temasDe(D).slice();
      if (String(r.tema).indexOf('novo:') === 0) temas.push({ id: r.tema, nome: r.tema.slice(5) });
      var tid = r.tema || '';
      W.PREVOO.presos({ temas: temas, melhorias: [{ id: 'x', titulo: r.titulo, tema_id: tid, dev: r.dev, status_planejamento: r.status }] }, { melhorias: [] })
        .forEach(function (p) { erros.push(p.regra === 'sistema' ? 'falta sistema para ' + rotEtapa(r.status) : p.regra === 'responsavel' ? 'falta dev para concluir' : p.motivo); });
    }
    if (nv.retro.length) avisos.push('data no passado vira hoje');
    if (r.dataRuim.length) avisos.push('data não lida: ' + r.dataRuim.join(', '));
    if (r.horasRuim) avisos.push('horas não lidas: ' + r.horasRuim);
    if (r.statusLido && !ETAPA_APELIDO[norm(r.statusLido)]) avisos.push('etapa "' + r.statusLido + '" não reconhecida: Backlog');
    if (r.tipoLido && !r.tipo) avisos.push('tipo "' + r.tipoLido + '" não reconhecido');
    if (!r.tipo) avisos.push('sem tipo');
    if (String(r.tema).indexOf('novo:') === 0) avisos.push('sistema novo: ' + r.tema.slice(5));
    // `corrigeSemDev` no servidor: de Planejado a Validacao sem dev volta ao Backlog.
    if (!r.dev && ['planejado', 'em_andamento', 'validacao_area', 'validacao'].indexOf(r.status) >= 0) avisos.push('sem dev: volta para Backlog');
    if (r.parecida) avisos.push('parecida com ' + (r.parecida.m.codigo || 'uma demanda') + ' (' + Math.round(r.parecida.sim * 100) + '%)');
    return { erros: erros, avisos: avisos };
  }
  function rotEtapa(id) { return ((H.ETAPA_POR_ID[id] || {}).rotulo || id); }

  function verificarTudo(D) {
    var hoje = H.hoje(), vistas = {};
    return st.rev.map(function (r) { return verifica(r, D, hoje, vistas); });
  }

  // ── Desenho ─────────────────────────────────────────────────────────────
  function poeCss() {
    if (document.getElementById('css-tela-importar')) return;
    var s = document.createElement('style');
    s.id = 'css-tela-importar';
    s.textContent = [
      '.axa .im-passos{display:flex;border-radius:12px;overflow:hidden;border:1px solid var(--bd2)}',
      '.axa .im-passos>*{flex:1;padding:12px;font:inherit;font-size:12.5px;font-weight:700;text-align:center;background:var(--sf3);color:var(--tx4);border:0;border-right:1px solid var(--bd2)}',
      '.axa .im-passos>*:last-child{border-right:0}',
      '.axa .im-passos .feito{background:rgba(var(--ok-rgb),.12);color:var(--ok-t);cursor:pointer}',
      '.axa .im-passos .atual{background:rgba(var(--ac-rgb),.2);color:var(--tx-hi)}',
      '.axa .im-k{display:grid;gap:12px;grid-template-columns:repeat(4,minmax(0,1fr))}',
      '.axa .im-cola{width:100%;min-height:170px;height:auto;padding:12px 14px;resize:vertical;font-family:var(--font-mono);font-size:12px;line-height:1.55;white-space:pre;display:block}',
      '.axa .im-arq{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:16px;border-radius:12px;border:1px dashed var(--bd4);background:var(--sf2)}',
      '.axa .im-tw{overflow-x:auto}',
      '.axa .im-tw .tbl td{vertical-align:top}',
      '.axa .im-sel{height:30px;font-size:12px;padding:0 28px 0 9px;border-radius:9px;width:100%;min-width:110px;max-width:160px}',
      '.axa .im-rev .tbl td{padding:9px 6px}.axa .im-rev .tbl th{padding:0 6px 10px}',
      '.axa .im-ent{height:30px;font-size:12px;padding:0 10px;border-radius:9px;width:120px}',
      '.axa .im-ver{display:flex;flex-wrap:wrap;gap:4px;min-width:150px;max-width:220px}',
      '.axa .im-ver .chip{white-space:normal;height:auto;min-height:22px;padding:3px 8px;line-height:15px;max-width:100%;flex-shrink:1;box-sizing:border-box}',
      '.axa tr.im-ign td{opacity:.5}',
      '.axa .im-log{margin:0;padding:12px 14px;border-radius:12px;background:var(--side);border:1px solid var(--bd);font-size:12px;line-height:19px;color:var(--tx2);white-space:pre-wrap;max-height:260px;overflow:auto}',
      '@container app (max-width: 760px){.axa .im-k{grid-template-columns:repeat(2,minmax(0,1fr)) !important}.axa .im-passos>*{padding:10px 4px;font-size:11px}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function passos() {
    var P = ['1 · Arquivo', '2 · Mapeamento', '3 · Revisão', '4 · Importar'];
    return '<nav class="im-passos" aria-label="Passos da importação">' + P.map(function (p, i) {
      var n = i + 1;
      if (n < st.passo && st.passo < 4) return '<button type="button" class="feito" data-im="passo" data-n="' + n + '">' + H.ico('check') + ' ' + esc(p) + '</button>';
      return '<span class="' + (n === st.passo ? 'atual' : n < st.passo ? 'feito' : '') + '"' + (n === st.passo ? ' aria-current="step"' : '') + '>' + esc(p) + '</span>';
    }).join('') + '</nav>';
  }

  function cabecalho() {
    return '<header style="display:flex;flex-direction:column;gap:6px">' +
      '<span class="note"><a href="#backlog/lista">Backlog</a> › Importar</span>' +
      '<h1 class="h1">Importar demandas</h1>' +
      '<span class="sub">Cole do Excel ou envie um CSV. O AXIS confere campos, procura duplicatas e só grava depois da sua revisão.</span></header>';
  }

  function passo1() {
    return '<section class="pn" style="gap:14px">' +
      '<div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2">Arquivo</h2>' +
      '<button type="button" class="btns" data-im="modelo">' + H.ico('download') + ' Baixar modelo .csv</button></div>' +
      '<div class="im-arq">' + H.ico('upload') +
      '<span style="flex:1;min-width:200px;font-size:13px;color:var(--tx2)">Um arquivo <b>.csv</b> ou <b>.tsv</b> com o cabeçalho na primeira linha. Planilha .xlsx: salve como CSV ou copie as linhas e cole abaixo.</span>' +
      '<label class="btn" style="cursor:pointer">Escolher arquivo<input type="file" id="im-arquivo" accept=".csv,.tsv,.txt,text/csv,text/plain" style="display:none"></label></div>' +
      (st.arquivo ? '<span class="note">' + H.ico('file') + ' ' + esc(st.arquivo) + '</span>' : '') +
      '<label for="im-cola" class="lab">OU COLE AS LINHAS DO EXCEL (CTRL+C, CTRL+V)</label>' +
      '<textarea class="in im-cola" id="im-cola" spellcheck="false" placeholder="titulo&#9;descricao&#9;sistema&#9;dev&#9;status&#9;tipo&#9;inicio&#9;entrega&#9;horas_realizadas&#9;solicitante&#9;prioridade">' + esc(st.texto) + '</textarea>' +
      '<span class="note">Separador: TAB (o padrão do Excel), ponto e vírgula ou vírgula. Colunas que o AXIS reconhece: ' +
      MODELO.map(function (c) { return '<span class="mono">' + c + '</span>'; }).join(', ') + '.</span>' +
      (st.erro ? '<div class="lock" style="background:rgba(var(--dg-rgb),.08);border-color:rgba(var(--dg-rgb),.35);color:var(--dg-t)">' + H.ico('alert') + '<span>' + esc(st.erro) + '</span></div>' : '') +
      '<div class="row" style="justify-content:space-between;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--bd)">' +
      '<a class="btn" href="#backlog/lista">Cancelar</a>' +
      '<button type="button" class="btnp" data-im="ler">Ler as linhas →</button></div></section>';
  }

  function exemplo(i) {
    var vals = [];
    for (var k = 0; k < st.linhas.length && vals.length < 2; k++) { var v = st.linhas[k][i]; if (v) vals.push(v); }
    return vals.map(function (v) { return esc(v.length > 40 ? v.slice(0, 40) + '…' : v); }).join(' · ');
  }

  function passo2() {
    var ops = function (campo) {
      var atual = st.mapa[campo];
      return '<option value="">— não importar —</option>' + st.cab.map(function (h, i) {
        return '<option value="' + i + '"' + (atual === i ? ' selected' : '') + '>' + esc(h || ('coluna ' + (i + 1))) + '</option>';
      }).join('');
    };
    var semTitulo = st.mapa.titulo == null;
    return '<section class="pn" style="gap:14px">' +
      '<div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2">Qual coluna vai em qual campo</h2>' +
      '<span class="note">' + H.plural(st.linhas.length, 'linha lida', 'linhas lidas') + ' · ' + H.plural(st.cab.length, 'coluna', 'colunas') +
      ' · separador ' + (st.sep === '\t' ? 'TAB' : '"' + esc(st.sep) + '"') + '</span></div>' +
      '<span class="note">O AXIS ligou as colunas pelo nome do cabeçalho. Confira e troque o que não bater; coluna sem campo fica de fora.</span>' +
      '<div class="im-tw"><table class="tbl"><thead><tr><th>CAMPO DO AXIS</th><th>COLUNA DA PLANILHA</th><th>EXEMPLO</th></tr></thead><tbody>' +
      CAMPOS.map(function (c) {
        var i = st.mapa[c.id];
        return '<tr><td style="color:var(--tx);font-weight:700;white-space:nowrap">' + esc(c.rot) + (c.obrig ? ' <span style="color:var(--dg-t)">*</span>' : '') + '</td>' +
          '<td><select class="in im-sel" data-im-mapa="' + c.id + '" aria-label="Coluna para ' + esc(c.rot) + '">' + ops(c.id) + '</select></td>' +
          '<td class="note">' + (i == null ? '—' : exemplo(i) || '<span style="color:var(--tx4)">vazia</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (st.linhas.length > MAX_LINHAS ? '<div class="lock">' + H.ico('alert') + '<span>A planilha tem ' + st.linhas.length + ' linhas; a importação lê as primeiras ' + MAX_LINHAS + '.</span></div>' : '') +
      (semTitulo ? '<div class="lock">' + H.ico('alert') + '<span>Escolha a coluna do título: demanda sem título não existe.</span></div>' : '') +
      '<div class="row" style="justify-content:space-between;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--bd)">' +
      '<button type="button" class="btn" data-im="passo" data-n="1">← Voltar</button>' +
      '<button type="button" class="btnp" data-im="revisar"' + (semTitulo ? ' disabled' : '') + '>Revisar →</button></div></section>';
  }

  function nomeTema(D, id) {
    if (String(id).indexOf('novo:') === 0) return 'novo: ' + id.slice(5);
    var t = temasDe(D).filter(function (x) { return x.id === id; })[0];
    return t ? t.nome : '';
  }
  function temaOps(D, atual) {
    var lista = temasDe(D);
    var h = W.catalogoOpcoesHTML ? W.catalogoOpcoesHTML(lista, atual, { rotuloVazio: '— sem sistema —' })
      : '<option value="">— sem sistema —</option>' + lista.map(function (t) { return '<option value="' + esc(t.id) + '"' + (t.id === atual ? ' selected' : '') + '>' + esc(t.nome) + '</option>'; }).join('');
    if (String(atual).indexOf('novo:') === 0) h += '<option value="' + esc(atual) + '" selected>+ criar "' + esc(atual.slice(5)) + '"</option>';
    return h;
  }

  function passo3(D) {
    var ver = verificarTudo(D);
    var prontas = 0, pend = 0, dups = 0;
    st.rev.forEach(function (r, i) {
      if (r.igual || r.parecida) dups++;
      if (ver[i].ign) return;
      if (ver[i].erros.length) pend++; else prontas++;
    });
    var acoes = function (r) {
      var o = [];
      if (!r.igual) o.push(['importar', 'importar']);
      o.push(['ignorar', 'ignorar']);
      var alvo = r.igual || (r.parecida && r.parecida.m);
      if (alvo) o.push(['atualizar', 'atualizar ' + (alvo.codigo || 'existente')]);
      return o.map(function (x) { return '<option value="' + x[0] + '"' + (r.acao === x[0] ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('');
    };
    var etapaOps = function (v) { return H.ETAPAS.map(function (e) { return '<option value="' + e.id + '"' + (v === e.id ? ' selected' : '') + '>' + esc(e.rotulo) + '</option>'; }).join(''); };
    var tipoOps = function (v) { return [['', '—'], ['sustentacao', 'Sustentação'], ['evolucao', 'Evolução']].map(function (x) { return '<option value="' + x[0] + '"' + (v === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join(''); };

    var linhas = st.rev.map(function (r, i) {
      var v = ver[i];
      var chips = v.ign ? H.chip('ignorada', 'bk')
        : (v.erros.map(function (e) { return H.chip(esc(e), 'dg'); }).join('') +
           v.avisos.map(function (a) { return H.chip(esc(a), /^parecida|^atualiza/.test(a) ? 'in' : 'wn'); }).join('')) ||
          H.chip('pronta', 'ok');
      var travada = r.acao === 'atualizar' || v.ign;
      var dis = travada ? ' disabled' : '';
      return '<tr class="' + (v.ign ? 'im-ign' : '') + '"><td class="mono note">' + r.n + '</td>' +
        '<td style="color:var(--tx);min-width:170px"><span style="font-weight:600">' + esc(r.titulo || '—') + '</span>' +
        (r.dev ? '<span class="note" style="display:block">' + esc(r.dev) + '</span>' : '') + '</td>' +
        '<td><select class="in im-sel" data-im-r="' + i + '" data-campo="tema" aria-label="Sistema da linha ' + r.n + '" title="' + esc(nomeTema(D, r.tema)) + '"' + dis + '>' + temaOps(D, r.tema) + '</select></td>' +
        '<td><select class="in im-sel" data-im-r="' + i + '" data-campo="tipo" aria-label="Tipo da linha ' + r.n + '"' + dis + '>' + tipoOps(r.tipo) + '</select></td>' +
        '<td><input class="in im-ent" data-im-r="' + i + '" data-campo="solicitante" value="' + esc(r.solicitante) + '" placeholder="quem pediu" aria-label="Quem pediu, linha ' + r.n + '"' + dis + '></td>' +
        '<td><select class="in im-sel" data-im-r="' + i + '" data-campo="status" aria-label="Etapa da linha ' + r.n + '"' + dis + '>' + etapaOps(r.status) + '</select></td>' +
        '<td><div class="im-ver">' + chips + '</div></td>' +
        '<td><select class="in im-sel" data-im-r="' + i + '" data-campo="acao" aria-label="Ação da linha ' + r.n + '">' + acoes(r) + '</select></td></tr>';
    }).join('');

    var nImp = st.rev.filter(function (r, i) { return !ver[i].ign && !ver[i].erros.length; }).length;
    return '<div class="im-k">' +
      H.kpi('Linhas lidas', H.num(st.rev.length)) +
      H.kpi('Prontas', '<span style="color:var(--ok-t)">' + H.num(prontas) + '</span>') +
      H.kpi('Com pendência', '<span style="color:' + (pend ? 'var(--wn-t)' : 'inherit') + '">' + H.num(pend) + '</span>') +
      H.kpi('Possíveis duplicatas', '<span style="color:' + (dups ? 'var(--dg-t)' : 'inherit') + '">' + H.num(dups) + '</span>') + '</div>' +
      '<section class="pn im-rev"><div class="im-tw"><table class="tbl"><thead><tr><th>#</th><th>TÍTULO</th><th>SISTEMA</th><th>TIPO</th><th>QUEM PEDIU</th><th>ETAPA</th><th>VERIFICAÇÃO</th><th>AÇÃO</th></tr></thead>' +
      '<tbody>' + linhas + '</tbody></table></div></section>' +
      '<div class="row" style="justify-content:space-between;flex-wrap:wrap"><span class="note" style="max-width:640px">' +
      (pend ? 'As ' + pend + ' com pendência ficam de fora até você corrigir. ' : '') +
      'Datas no passado viram a data de hoje. Título igual ao de uma demanda viva não entra como novo: ignore ou atualize a que existe. Atualizar troca só os campos que a planilha traz preenchidos, sem mudar a etapa.</span>' +
      '<span class="row"><button type="button" class="btn" data-im="passo" data-n="2">← Voltar</button>' +
      '<button type="button" class="btnp" data-im="importar"' + (nImp ? '' : ' disabled') + '>Importar ' + nImp + ' para o Backlog</button></span></div>';
  }

  function passo4() {
    var R = st.resultado;
    if (st.gravando || !R) {
      return '<section class="pn">' + H.vazio('hourglass', 'Gravando na base…', 'Lendo a base do servidor, aplicando as linhas e conferindo as regras antes de enviar.') + '</section>';
    }
    if (!R.ok) {
      return '<section class="pn" style="gap:12px"><div class="lock" style="background:rgba(var(--dg-rgb),.08);border-color:rgba(var(--dg-rgb),.35);color:var(--dg-t)">' + H.ico('alert') +
        '<span><b>Nada foi gravado.</b> ' + esc(R.erro || 'O servidor recusou a importação.') + '</span></div>' +
        '<span class="note">O servidor recusa a importação inteira quando uma linha quebra uma regra. Volte à revisão, ajuste ou ignore a linha citada e importe de novo.</span>' +
        '<div class="row"><button type="button" class="btnp" data-im="passo" data-n="3">← Voltar à revisão</button></div></section>';
    }
    var cods = R.criadas.map(function (c) {
      return c.codigo ? '<a class="chip c-ac mono" style="text-decoration:none" href="#item/' + encodeURIComponent(c.codigo) + '">' + esc(c.codigo) + '</a>' : H.chip('sem código', 'bk');
    }).join(' ');
    return '<div class="im-k">' + H.kpi('Criadas', '<span style="color:var(--ok-t)">' + R.criadas.length + '</span>') +
      H.kpi('Atualizadas', R.atualizadas.length) + H.kpi('Ignoradas', R.ignoradas) + H.kpi('Sistemas novos', R.temasNovos.length) + '</div>' +
      '<section class="pn" style="gap:12px"><h2 class="h2">' + H.ico('check') + ' Importação gravada</h2>' +
      (R.criadas.length ? '<span class="lab">DEMANDAS CRIADAS</span><div class="row" style="flex-wrap:wrap;gap:6px">' + cods + '</div>' : '') +
      (R.atualizadas.length ? '<span class="lab">ATUALIZADAS</span><div class="row" style="flex-wrap:wrap;gap:6px">' + R.atualizadas.map(function (c) {
        return '<a class="chip c-in mono" style="text-decoration:none" href="#item/' + encodeURIComponent(c) + '">' + esc(c) + '</a>'; }).join(' ') + '</div>' : '') +
      (R.temasNovos.length ? '<span class="note">Sistemas criados: ' + R.temasNovos.map(esc).join(', ') + '.</span>' : '') +
      (R.avisos.length ? '<pre class="mono im-log">' + esc(R.avisos.join('\n')) + '</pre>' : '') +
      '<div class="row" style="justify-content:space-between;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--bd)">' +
      '<button type="button" class="btn" data-im="nova">Nova importação</button><a class="btnp" href="#backlog/lista">Ver no Backlog</a></div></section>';
  }

  function render(el, ctx) {
    poeCss();
    var corpo = st.passo === 1 ? passo1() : st.passo === 2 ? passo2() : st.passo === 3 ? passo3(ctx.D) : passo4();
    return cabecalho() + passos() + corpo;
  }

  // ── Acoes ───────────────────────────────────────────────────────────────
  function baixarModelo() {
    var D = A.APP.D, hoje = H.hoje();
    var ts = temasDe(D).slice(0, 2).map(function (t) { return t.nome; });
    var cel = function (v) { v = String(v == null ? '' : v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var ex = [
      ['Relatório de inadimplência por safra', 'Extração mensal por safra', ts[0] || '', '', 'backlog', 'evolucao', '', '', '', 'Controladoria', 'media'],
      ['Correção do extrato EDI zerado', 'Lote vem sem valores', ts[1] || ts[0] || '', '', 'backlog', 'sustentacao', hoje, '', '', 'Operações', 'alta']
    ];
    var csv = [MODELO.join(';')].concat(ex.map(function (l) { return l.map(cel).join(';'); })).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'modelo_importacao_axis.csv';
    document.body.appendChild(a); a.click(); a.remove();
  }

  function lerArquivo(arq) {
    /* UTF-8 primeiro; se vier caractere invalido, o arquivo e do Excel em
       Windows-1252 (o "Salvar como CSV" de sempre) e e relido assim. */
    var leitor = function (cod) {
      return new Promise(function (ok, falha) {
        var fr = new FileReader();
        fr.onload = function () { ok(String(fr.result || '')); };
        fr.onerror = function () { falha(fr.error); };
        fr.readAsText(arq, cod);
      });
    };
    return leitor('UTF-8').then(function (t) { return t.indexOf('�') >= 0 ? leitor('windows-1252') : t; });
  }

  function lerLinhas() {
    var p = lerTexto(st.texto);
    if (!p.cab.length) { st.erro = 'Nenhuma linha para ler. Escolha um arquivo ou cole as linhas com o cabeçalho.'; return false; }
    if (!p.linhas.length) { st.erro = 'Só veio o cabeçalho. Copie também as linhas das demandas.'; return false; }
    st.erro = '';
    st.cab = p.cab; st.linhas = p.linhas; st.sep = p.sep;
    st.mapa = mapaAutomatico(p.cab);
    return true;
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  async function importar() {
    var D = A.APP.D, hoje = H.hoje();
    var ver = verificarTudo(D);
    var vao = st.rev.filter(function (r, i) { return !ver[i].ign && !ver[i].erros.length; });
    if (!vao.length) return;
    st.passo = 4; st.gravando = true; st.resultado = null;
    A.desenhar();
    var agora = new Date().toISOString();
    var patch = {}, criadas = [], atualizadas = [], avisos = [], novosNomes = {};
    vao.forEach(function (r) {
      if (r.acao === 'atualizar') {
        var alvo = r.igual || r.parecida.m;
        // So o que a planilha traz preenchido; a etapa nao muda por aqui.
        var c = {};
        if (r.descricao) c.descricao = r.descricao;
        if (r.tema) c.tema_id = r.tema;
        if (r.dev) c.dev = r.dev;
        if (r.tipo) c.tipo = r.tipo;
        if (r.inicio) c.inicio = r.inicio;
        if (r.entrega) c.entrega = r.entrega;
        if (r.horas != null) c.horas_realizadas = r.horas;
        if (r.solicitante) c.solicitante = r.solicitante;
        if (r.prioridade) c.prioridade = r.prioridade;
        if (!Object.keys(c).length) { avisos.push('Linha ' + r.n + ': nada a atualizar em ' + (alvo.codigo || alvo.id) + '.'); return; }
        c.atualizado_em = agora;
        patch[alvo.id] = Object.assign(patch[alvo.id] || {}, c);
        atualizadas.push(alvo.codigo || alvo.id);
        return;
      }
      var nv = novaDe(r, hoje);
      var id = uid() + r.n;
      patch[id] = {
        id: id, titulo: r.titulo, descricao: r.descricao || '',
        tema_id: r.tema || null, dev: r.dev || '', status_planejamento: r.status || 'backlog',
        inicio: nv.d.inicio || '', entrega: nv.d.entrega || '',
        horas_realizadas: r.horas != null ? r.horas : 0,
        solicitante: r.solicitante || '', prioridade: r.prioridade || '', tipo: r.tipo || '',
        criado_em: agora, atualizado_em: agora
      };
      if (String(r.tema).indexOf('novo:') === 0) novosNomes[r.tema] = r.tema.slice(5);
      if (nv.retro.length) avisos.push('Linha ' + r.n + ': ' + nv.retro.join(' e ') + ' no passado entrou como ' + H.dma(hoje) + '.');
      criadas.push({ id: id, n: r.n });
    });

    // Sistema novo: ganha id e entra na lista de temas LIDA AGORA do servidor
    // (`raiz.temas` troca a lista inteira; a da tela pode estar velha).
    var opts = { ok: false };
    var chaves = Object.keys(novosNomes), temasNovos = [];
    try {
      if (chaves.length) {
        var fresca = await H.api('dados');
        var temas = (fresca.temas || []).slice();
        chaves.forEach(function (k) {
          var ja = temas.filter(function (t) { return norm(t.nome) === norm(novosNomes[k]); })[0];
          var tid = ja ? ja.id : uid();
          if (!ja) { temas.push({ id: tid, nome: novosNomes[k] }); temasNovos.push(novosNomes[k]); }
          Object.keys(patch).forEach(function (pid) { if (patch[pid].tema_id === k) patch[pid].tema_id = tid; });
        });
        if (temasNovos.length) opts.raiz = { temas: temas };
      }
    } catch (e) {
      st.gravando = false;
      st.resultado = { ok: false, erro: 'Não consegui ler os sistemas do servidor: ' + (e.message || e) };
      A.desenhar(true);
      return;
    }

    var r = await H.gravar(patch, opts);
    st.gravando = false;
    if (!r || !r.ok) {
      var msg = (r && (r.erro || (r.falta && r.falta.motivo))) || 'Não foi possível gravar.';
      if (r && r.itens && r.itens.length) msg += ' (' + r.itens.map(function (x) { return x.codigo || x.titulo || x.id; }).filter(Boolean).slice(0, 6).join(', ') + ')';
      st.resultado = { ok: false, erro: msg };
    } else {
      var cods = (r.resp && r.resp.codigos) || {};
      var sd = (r.resp && r.resp.sem_dev) || [];
      if (sd.length) avisos.push('Sem dev, voltaram para Backlog: ' + sd.join(', ') + '.');
      st.resultado = { ok: true, criadas: criadas.map(function (c) { return { codigo: cods[c.id] || '', n: c.n }; }),
                       atualizadas: atualizadas, ignoradas: st.rev.length - vao.length, temasNovos: temasNovos, avisos: avisos };
      H.toast(H.plural(criadas.length, 'demanda importada', 'demandas importadas') + (atualizadas.length ? ', ' + atualizadas.length + ' atualizada(s)' : '') + '.');
    }
    A.desenhar(true);
  }

  function depois(el) {
    var arq = el.querySelector('#im-arquivo');
    if (arq) arq.addEventListener('change', function () {
      var f = arq.files && arq.files[0];
      if (!f) return;
      lerArquivo(f).then(function (t) {
        st.texto = t; st.arquivo = f.name + ' · ' + Math.max(1, Math.round(f.size / 1024)) + ' KB';
        if (lerLinhas()) st.passo = 2;
        A.desenhar(true);
      }).catch(function (e) { st.erro = 'Não consegui ler o arquivo: ' + (e && e.message || e); A.desenhar(true); });
    });
    var cola = el.querySelector('#im-cola');
    if (cola) cola.addEventListener('input', function () { st.texto = cola.value; });

    el.onchange = function (e) {
      var m = e.target.closest('[data-im-mapa]');
      // O redesenho vai para o proximo ciclo: o `change` de um campo de texto
      // dispara no blur, e trocar o DOM no meio do blur quebra o navegador.
      if (m) { var v = m.value; st.mapa[m.getAttribute('data-im-mapa')] = v === '' ? null : Number(v); setTimeout(function () { A.desenhar(true); }, 0); return; }
      var c = e.target.closest('[data-im-r]');
      if (c) {
        var r = st.rev[Number(c.getAttribute('data-im-r'))], campo = c.getAttribute('data-campo');
        if (!r) return;
        r[campo] = c.value;
        if (campo === 'tipo') r.tipoLido = '';
        if (campo === 'status') r.statusLido = '';
        setTimeout(function () { A.desenhar(true); }, 0);
      }
    };
    el.onclick = function (e) {
      var b = e.target.closest('[data-im]');
      if (!b || b.disabled) return;
      var a = b.getAttribute('data-im');
      if (a === 'modelo') baixarModelo();
      else if (a === 'ler') { if (cola) st.texto = cola.value; if (lerLinhas()) st.passo = 2; A.desenhar(); }
      else if (a === 'passo') { st.passo = Number(b.getAttribute('data-n')); A.desenhar(); }
      else if (a === 'revisar') { montarRevisao(A.APP.D); st.passo = 3; A.desenhar(); }
      else if (a === 'importar') importar();
      else if (a === 'nova') { reiniciar(); A.desenhar(); }
    };
  }

  A.tela({
    id: 'importar',
    rotulo: 'Importar demandas',
    papeis: ['admin'],
    titulo: function () { return 'Importar demandas'; },
    render: render,
    depois: depois
  });
})();
