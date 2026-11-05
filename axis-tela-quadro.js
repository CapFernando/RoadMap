/* ─────────────────────────────────────────────────────────────────────────
   AXIS — Quadro (prototipo: EP-013-axis/prototipo/fonte/Quadro.dc.html).

   O MESMO QUADRO DO ADMIN, LIDO COM O DESENHO DO PROTOTIPO. As colunas sao as
   etapas do admin (KB_COLS), na mesma ordem; o card mora na etapa GRAVADA
   (`ETAPA.gravada`) e o atraso e marca vermelha, nunca coluna — a mesma
   decisao registrada em admin.html ("'Atrasado' saiu da esteira").

   A ORDEM DENTRO DA COLUNA vem de `ordem-kanban.js` (prioridade, depois a data
   prometida), igual ao admin e ao painel do dev. Nenhuma ordenacao propria.

   NAO HA ARRASTE. O card e um link para o Item, e e la que a etapa muda: os
   gestos de axis-acoes.js mostram a trava ANTES do clique, o que um arraste
   so descobriria ao soltar. "+ Novo item" abre o formulario do app
   (axis-form-demanda.js).

   O QUE O PROTOTIPO TEM E A BASE NAO: limite de WIP por coluna, colunas de
   Code review / Testes / Em producao, epico EPI-, PR no card. Nada disso e
   inventado aqui — o card mostra o equivalente real (pontos do Poker, projeto
   EP-, sprint, subtarefas, "no ar").
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var AX = window.AXIS_APP;
  if (!AX) return;
  var H = AX.H;

  /* As colunas do admin (KB_COLS), sem `negada`: ela fica recolhida no fim,
     porque e saida do fluxo e nao etapa de trabalho. */
  var COLUNAS = ['backlog', 'levantar_req', 'planning', 'planejado', 'em_andamento',
                 'validacao_area', 'validacao', 'concluido'];
  // A base real tem centenas de demandas no Backlog: a coluna pagina.
  var POR_PAGINA = 20;
  var SALES_OPS = 'Sales Ops';

  /* O ESTADO DOS FILTROS vive enquanto o app esta aberto: voltar do Item para o
     Quadro devolve o quadro como a pessoa o deixou. `meus` nasce `null` para
     o primeiro desenho decidir pelo perfil (dev = ligado). */
  var F = { frente: '', tipo: '', sistema: '', dev: '', meus: null, vencidas: false,
            todasConcluidas: false, negadaAberta: false, mais: {} };

  // ── CSS proprio, injetado uma vez ────────────────────────────────────
  function css() {
    if (document.getElementById('css-tela-quadro')) return;
    var s = document.createElement('style');
    s.id = 'css-tela-quadro';
    /* So tokens. O prototipo pinta coluna e card com cor literal escura; aqui
       o par vem de variaveis locais, redefinidas no tema claro para o card
       continuar destacado da coluna. */
    s.textContent = [
      '.axa .qd{--qd-col:var(--sf3);--qd-card:var(--sf2);--qd-cbd:var(--sf5)}',
      '.axa[data-tema="claro"] .qd{--qd-col:var(--sf2);--qd-card:var(--sf);--qd-cbd:var(--bd2)}',
      '.axa .qd-kick{font-size:12px;font-weight:700;letter-spacing:.16em;color:var(--ac-l)}',
      '.axa[data-tema="claro"] .qd-kick{color:var(--ac-t)}',
      '.axa .qd-seg{display:flex;max-width:100%;box-sizing:border-box;overflow-x:auto;scrollbar-width:none;padding:4px;border-radius:12px;background:var(--sf3);border:1px solid var(--bd)}',
      '.axa .qd-seg button{height:34px;padding:0 14px;border:0;border-radius:9px;background:transparent;color:var(--tx3);font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}',
      '.axa .qd-seg button[aria-selected="true"]{background:var(--sf4);color:var(--tx-hi);font-weight:700}',
      '.axa .qd-seg button .n{margin-left:6px;font-family:var(--font-mono);font-size:11px;color:var(--tx4)}',
      '.axa .qd-alerta{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 12px;border-radius:10px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap}',
      '.axa .qd-alerta.dg{background:rgba(var(--dg-rgb),.1);border:1px solid rgba(var(--dg-rgb),.35);color:var(--dg-t)}',
      '.axa .qd-alerta.wn{background:rgba(var(--wn-rgb),.08);border:1px solid rgba(var(--wn-rgb),.3);color:var(--wn-c)}',
      '.axa .qd-alerta.on{box-shadow:0 0 0 2px rgba(var(--dg-rgb),.45)}',
      '.axa .qd-fl{font-size:12px;color:var(--tx3)}',
      '.axa .qd-par{display:inline-flex;align-items:center;gap:8px}',
      '.axa .qd-sel{height:34px;padding:0 30px 0 12px;border-radius:10px;font-size:12.5px;background-color:var(--sf);max-width:220px}',
      '.axa .qd-meus{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 12px;border-radius:10px;border:1px solid var(--bd2);background:var(--sf);color:var(--tx2);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}',
      '.axa .qd-meus .sw{width:30px;height:18px;border-radius:9px;background:var(--bd2);position:relative;flex-shrink:0}',
      '.axa .qd-meus .sw i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:7px;background:var(--tx3);transition:left .15s}',
      '.axa .qd-meus[aria-pressed="true"]{border-color:rgba(var(--ac-rgb),.5);color:var(--tx)}',
      '.axa .qd-meus[aria-pressed="true"] .sw{background:rgba(var(--ac-rgb),.35)}',
      '.axa .qd-meus[aria-pressed="true"] .sw i{left:14px;background:var(--ac)}',
      '.axa .qd-board{display:flex;gap:12px;align-items:flex-start;width:max-content}',
      '.axa .qd-col{width:248px;flex-shrink:0;box-sizing:border-box;padding:12px;border-radius:16px;background:var(--qd-col);border:1px solid var(--sf4);display:flex;flex-direction:column;gap:10px}',
      '.axa .qd-col.foco{box-shadow:0 0 0 2px rgba(var(--wn-rgb),.55)}',
      '.axa .qd-ch{display:flex;align-items:center;gap:8px;padding:2px 4px}',
      '.axa .qd-ch h2{margin:0;font-family:var(--font-ui);font-size:11.5px;font-weight:800;letter-spacing:.12em;color:var(--tx)}',
      '.axa .qd-ch .n{margin-left:auto;font-family:var(--font-mono);font-size:11.5px;color:var(--tx3)}',
      '.axa .qd-card{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:13px;background:var(--qd-card);border:1px solid var(--qd-cbd);text-decoration:none;color:var(--tx)}',
      '.axa .qd-card:hover{border-color:var(--bd4);color:var(--tx)}',
      '.axa .qd-card.late{border-color:rgba(var(--dg-rgb),.45)}',
      '.axa .qd-card.meu{box-shadow:inset 3px 0 0 var(--ac)}',
      '.axa .qd-top{display:flex;justify-content:space-between;align-items:center;gap:6px}',
      '.axa .qd-cod{font-family:var(--font-mono);font-size:11.5px;color:var(--tx3)}',
      '.axa .qd-tit{font-size:13px;line-height:18px;font-weight:700;overflow-wrap:anywhere}',
      '.axa .qd-sys{font-size:11.5px;color:var(--tx3)}',
      '.axa .qd-flags{display:flex;flex-wrap:wrap;gap:5px}',
      '.axa .qd-card .chip{height:20px;padding:0 8px;font-size:10.5px;gap:4px}',
      '.axa .qd-pe{display:flex;align-items:center;gap:8px;min-width:0}',
      '.axa .qd-pts{font-family:var(--font-mono);font-size:11.5px;color:var(--tx2);white-space:nowrap}',
      '.axa .qd-pts.sem{color:var(--tx4)}',
      '.axa .qd-mini{font-size:11px;color:var(--tx3);white-space:nowrap}',
      '.axa .qd-avs{margin-left:auto;display:flex}',
      '.axa .qd-avs .av{width:24px;height:24px;border-radius:12px;font-size:10px;box-shadow:0 0 0 2px var(--qd-card)}',
      '.axa .qd-avs .av + .av{margin-left:-6px}',
      '.axa .qd-vz{padding:14px 8px;border-radius:12px;border:1px dashed var(--bd2);text-align:center;font-size:12px;color:var(--tx4)}',
      '.axa .qd-mais{height:32px;border-radius:10px;border:1px dashed var(--bd4);background:transparent;color:var(--tx3);font:inherit;font-size:12px;font-weight:600;cursor:pointer}',
      '.axa .qd-mais:hover{color:var(--tx);border-color:var(--tx4)}',
      '.axa .qd-neg{width:52px;flex-shrink:0;box-sizing:border-box;padding:12px 0;border-radius:16px;background:var(--qd-col);border:1px solid var(--sf4);display:flex;flex-direction:column;align-items:center;gap:10px;cursor:pointer;color:var(--tx3);font:inherit}',
      '.axa .qd-neg:hover{color:var(--tx);border-color:var(--bd4)}',
      '.axa .qd-neg .v{writing-mode:vertical-rl;transform:rotate(180deg);font-size:11.5px;font-weight:800;letter-spacing:.12em}',
      '.axa .qd-neg .n{font-family:var(--font-mono);font-size:11.5px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── Leituras (todas pelos modulos) ───────────────────────────────────
  /* A FRENTE DO CARD. Uma particao so, para o seletor nao contar a mesma
     demanda em duas abas: Sales Ops e a trilha da sprint (`SPRINTPO.trilhaDe`,
     marca na demanda); o resto e a frente de `PIPELINES.daDemanda` (marca
     Dados/BI ou a frente de quem faz). Quem nao tem frente cai na frente
     geral, que e a regra do proprio pipelines.js. */
  function frenteDe(m, D) {
    if (window.SPRINTPO && SPRINTPO.trilhaDe(m) === 'sales_ops') return SALES_OPS;
    return window.PIPELINES ? PIPELINES.daDemanda(m, D.devs_perfil || {}) : '';
  }
  function frentes() {
    var l = window.PIPELINES ? PIPELINES.nomes.slice() : [];
    l.push(SALES_OPS);
    return l;
  }

  /* "CONCLUIDAS: ESTE MES" — copia de `dataReferenciaKb` + `matchPeriodoConclusao`
     (admin.html). A data de referencia e a entrega, ou o inicio, ou a criacao;
     concluida/negada sem data nenhuma so aparece pedindo "todas". Candidata a
     modulo: hoje a regra existe no admin e aqui. */
  function dataReferencia(m) {
    var d = String(m.entrega || m.inicio || m.criado_em || '').slice(0, 10);
    return H.ehISO(d) ? d : '';
  }
  function doPeriodo(m) {
    var c = H.colunaDe(m);
    if (c !== 'concluido' && c !== 'negada') return true;
    var ref = dataReferencia(m);
    return !!ref && ref.slice(0, 7) === H.hoje().slice(0, 7);
  }

  /* `prazo.js` le os feriados como texto ISO; a base guarda `{ data, nome }`. */
  function feriadosISO() {
    return ((AX.APP.D || {}).feriados || []).map(function (f) { return f && typeof f === 'object' ? f.data : f; });
  }

  function raizTema(nome) { return String(nome || '').split(/\s+-\s+/)[0]; }

  function casaFiltros(m, D) {
    if (F.tipo === '__sem__' ? !!m.tipo : (F.tipo && m.tipo !== F.tipo)) return false;
    if (F.sistema) {
      if (F.sistema.indexOf('t:') === 0 && m.tema_id !== F.sistema.slice(2)) return false;
      if (F.sistema.indexOf('r:') === 0 && raizTema(H.tema(m.tema_id)) !== F.sistema.slice(2)) return false;
    }
    if (F.meus) { if (!H.minha(m)) return false; }
    else if (F.dev === '__sem__') { if (H.devsDe(m).length) return false; }
    else if (F.dev && !(window.DEVNOME ? DEVNOME.eDe(m, F.dev) : H.devsDe(m).indexOf(F.dev) >= 0)) return false;
    return true;
  }

  /* O QUE ESTE PERFIL VE NO QUADRO. Para o dev, a montagem da sprint que o PO
     ainda nao iniciou fica escondida — a mesma regra do painel do dev
     (`SPRINTPO.escondidaDoTime`, dev.html getFiltered). */
  function universo(ctx) {
    return H.visiveis().filter(function (m) {
      if (ctx.papel === 'dev' && window.SPRINTPO && SPRINTPO.escondidaDoTime(ctx.D, m)) return false;
      return true;
    });
  }

  // ── Pedacos de HTML ──────────────────────────────────────────────────
  function attr(s) { return H.esc(s); }

  function cabecalhoSprint(ctx) {
    var S = window.SPRINTPO;
    var rot = H.sprintAtual();
    if (!S || !rot) return { kick: '', sub: '' };
    var fer = ctx.D.feriados || [];
    var fx = S.faixaDaSprint(rot, fer);
    var kick = 'SPRINT ' + S.rotuloCurto(rot);
    if (fx) {
      var de = H.data(fx.de), ate = H.data(fx.ate);
      var mesmoMes = de.getMonth() === ate.getMonth();
      kick += ' · ' + String(de.getDate()).padStart(2, '0') + (mesmoMes ? '' : ' ' + H.MESES_C[de.getMonth()].toUpperCase()) +
        ' A ' + String(ate.getDate()).padStart(2, '0') + ' ' + H.MESES_C[ate.getMonth()].toUpperCase();
      // O dia da sprint conta dias uteis (a mesma conta que define a sprint).
      var uteis = [];
      [fx.de.slice(0, 7), fx.ate.slice(0, 7)].forEach(function (am, i, arr) {
        if (i && am === arr[0]) return;
        uteis = uteis.concat(S.diasUteisDoMes(+am.slice(0, 4), +am.slice(5, 7), fer));
      });
      uteis = uteis.filter(function (d) { return d >= fx.de && d <= fx.ate; });
      var hoje = H.hoje();
      if (hoje < fx.de) kick += ' · COMEÇA ' + H.dm(fx.de);
      else {
        var n = uteis.filter(function (d) { return d <= hoje; }).length;
        kick += ' · DIA ' + Math.min(n, uteis.length) + ' DE ' + uteis.length;
      }
    }
    /* A META SO APARECE SE O REGISTRO DA SPRINT TIVER UMA. Hoje o registro
       (`sprints`) guarda inicio e fechamento; no lugar da meta vai a situacao
       real da sprint, que e o que o registro sabe. */
    var reg = S.registroDe(ctx.D, rot) || {};
    var meta = String(reg.meta || reg.objetivo || '').trim();
    var sub;
    if (meta) sub = 'Meta: <b style="color:var(--tx2)">' + H.esc(meta) + '</b>';
    else {
      var sit = S.situacaoDaSprint(ctx.D, rot);
      sub = sit === 'fechada' ? 'Sprint fechada em ' + H.dm(reg.em) + (reg.por ? ' por ' + H.esc(reg.por) : '') + '.'
          : sit === 'em_curso' ? 'Sprint em curso desde ' + H.dm(reg.iniciada_em) + (reg.iniciada_por ? ', iniciada por ' + H.esc(reg.iniciada_por) : '') + '.'
          : 'Sprint em montagem: o PM/PO ainda não a iniciou.';
    }
    return { kick: kick, sub: sub };
  }

  function chipsDoCard(m, col) {
    var c = [];
    var hoje = H.hoje();
    var sit = window.PAUSA ? PAUSA.situacao(m) : (H.pausada(m) ? 'pausada' : 'correndo');
    if (H.etapaDe(m) === 'atrasado') {
      var a = H.atrasoDe(m);
      c.push(H.chip(H.ico('alert') + ' atrasada' + (a > 0 ? ' ' + a + 'd' : ''), 'dg'));
    } else if (sit !== 'pausada' && window.PRAZO && !PRAZO.relogioParou(col)) {
      var pz = H.prazoDe(m), d = pz ? H.dias(hoje, pz) : null;
      if (d === 0) c.push(H.chip('vence hoje', 'dg'));
      else if (d === 1) c.push(H.chip('vence amanhã', 'wn'));
    }
    if (sit === 'pausada') {
      var dp = window.PRAZO ? PRAZO.diasPausados(m, hoje) : 0;
      c.push(H.chip(H.ico('pause') + ' pausada' + (dp ? ' · ' + dp + 'd' : ''), 'mg', m.pausa_motivo || ''));
    } else if (sit === 'aguardando') {
      c.push(H.chip(H.ico('pause') + ' pausa pedida', 'wn', (PAUSA.pedido(m) || {}).motivo || ''));
    }
    if (col !== 'negada' && window.DEVOLUCAO && DEVOLUCAO.houve(m)) c.push(H.chip(H.ico('undo') + ' devolvida', 'dg', DEVOLUCAO.motivo(m)));
    if (col === 'validacao_area' && window.PRAZO) {
      var dA = PRAZO.diasNaArea(m, hoje);
      if (dA != null) c.push(H.chip(H.ico('eye') + ' área · ' + dA + 'd', PRAZO.areaVenceu(m, hoje, feriadosISO()) ? 'wn' : 'in',
        'Esperando a área homologar.'));
    }
    if (m.em_producao && (col === 'validacao' || col === 'validacao_area' || col === 'concluido')) c.push(H.chip('no ar', 'ok'));
    if (window.SPRINTPO && SPRINTPO.ehPrioritariaDaSprint(m)) c.push(H.chip(H.ico('zap') + ' prioritária', 'ac'));
    if (m.spike) c.push(H.chip(H.ico('search') + ' Spike', 'in'));
    if (m.debito_tecnico) c.push(H.chip('Débito técnico', 'pu'));
    if (window.SUBTAREFA) {
      var p = SUBTAREFA.progresso(SUBTAREFA.lista(m));
      if (p.total) c.push(H.chip(H.ico('check') + ' ' + p.feitas + '/' + p.total, p.feitas === p.total ? 'ok' : 'bk', p.feitas + ' de ' + p.total + ' subtarefas'));
    }
    return c;
  }

  function card(m, col) {
    var late = H.etapaDe(m) === 'atrasado';
    var meu = H.minha(m);
    var tipo = H.TIPOS[m.tipo];
    var pts = H.pontosDe(m);
    var proj = m.projeto_id ? H.projeto(m.projeto_id) : null;
    var sp = window.SPRINTPO ? SPRINTPO.doPO(m) : '';
    var devs = H.devsDe(m);
    var chips = chipsDoCard(m, col);
    var prio = window.ORDEMKB ? ORDEMKB.rotulo(m) : '';
    var votado = m.poker_media != null && m.poker_media !== '';
    return '<a class="qd-card' + (late ? ' late' : '') + (meu ? ' meu' : '') + '" href="' + H.hrefItem(m) + '" draggable="false"' +
      ' title="' + attr((m.codigo || '') + ' · prioridade ' + prio + (meu ? ' · é seu' : '')) + '">' +
      '<span class="qd-top"><span class="qd-cod">' + H.esc(m.codigo || '—') + '</span>' +
      (tipo ? H.chip(H.esc(tipo.rotulo), 'bk') : '') + '</span>' +
      '<span class="qd-tit">' + H.esc(m.titulo || '(sem título)') + '</span>' +
      (m.tema_id ? '<span class="qd-sys">' + H.esc(H.caminho(m.tema_id)) + '</span>' : '<span class="qd-sys" style="color:var(--tx4)">sem sistema</span>') +
      (chips.length ? '<span class="qd-flags">' + chips.join('') + '</span>' : '') +
      '<span class="qd-pe">' +
      (pts ? '<span class="qd-pts" title="' + (votado ? 'Planning Poker · média ' + attr(m.poker_media) : 'Pontos por estimativa, sem votação no Poker') + '">' + pts + ' pts</span>'
           : '<span class="qd-pts sem" title="Sem pontos do Poker">— pts</span>') +
      (proj ? '<span class="qd-mini" title="' + attr(proj.nome || '') + '">' + H.esc(proj.codigo || '') + '</span>' : '') +
      (sp ? '<span class="qd-mini mono" title="' + attr(sp) + '">' + H.esc(SPRINTPO.rotuloCurto(sp)) + '</span>' : '') +
      '<span class="qd-avs">' + (devs.length ? devs.slice(0, 3).map(function (n) { return H.av(n); }).join('') : H.av('')) + '</span>' +
      '</span></a>';
  }

  function coluna(k, itens, extra) {
    var e = H.ETAPA_POR_ID[k];
    var lim = F.mais[k] || POR_PAGINA;
    var vis = itens.slice(0, lim);
    var resto = itens.length - vis.length;
    return '<section class="qd-col" data-col="' + k + '" aria-label="' + attr(e.rotulo) + '">' +
      '<div class="qd-ch"><span class="dotc" style="background:' + e.dot + '"></span>' +
      '<h2>' + H.esc(e.rotulo.toUpperCase()) + '</h2><span class="n" title="' + itens.length + ' nesta coluna · ordem: prioridade, depois a data prometida">' + itens.length + '</span>' +
      (k === 'negada' ? '<button type="button" class="btns" data-acao-qd="negada" style="height:24px;padding:0 8px;margin-left:4px" title="Recolher">' + H.ico('x') + '</button>' : '') +
      '</div>' +
      (vis.length ? vis.map(function (m) { return card(m, k); }).join('') : '<div class="qd-vz">Nada aqui</div>') +
      (resto > 0 ? '<button type="button" class="qd-mais" data-mais="' + k + '">Mostrar mais ' + Math.min(resto, POR_PAGINA) + ' de ' + resto + '</button>' : '') +
      (extra || '') +
      '</section>';
  }

  function opcao(v, rot, sel) {
    return '<option value="' + attr(v) + '"' + (v === sel ? ' selected' : '') + '>' + H.esc(rot) + '</option>';
  }

  function opcoesSistema(lista) {
    var usados = {};
    lista.forEach(function (m) { if (m.tema_id) usados[m.tema_id] = true; });
    var temas = ((AX.APP.D || {}).temas || []).filter(function (t) { return usados[t.id]; })
      .sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
    var porRaiz = {};
    temas.forEach(function (t) { var r = raizTema(t.nome); (porRaiz[r] = porRaiz[r] || []).push(t); });
    var h = opcao('', 'Todos', F.sistema);
    Object.keys(porRaiz).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }).forEach(function (r) {
      var ts = porRaiz[r];
      if (ts.length > 1) h += opcao('r:' + r, r + ' › todos', F.sistema);
      ts.forEach(function (t) { h += opcao('t:' + t.id, H.caminho(t.id), F.sistema); });
    });
    return h;
  }

  /* QUEM APARECE NO FILTRO DE DEV: quem tem trabalho aberto, mais o cadastro
     sem quem saiu do time — a regra de `devsComTrabalhoAberto` (admin.html). */
  function opcoesDev(lista, D) {
    var nomes = {};
    var fora = {};
    (D.devs_removidos || []).forEach(function (n) { fora[n] = true; });
    (D.desenvolvedores || []).forEach(function (n) { if (n && !fora[n]) nomes[n] = true; });
    lista.forEach(function (m) {
      var c = H.colunaDe(m);
      if (c === 'concluido' || c === 'negada') return;
      H.devsDe(m).forEach(function (n) { nomes[n] = true; });
    });
    var h = opcao('', 'Todos', F.dev) + opcao('__sem__', 'Sem dev', F.dev);
    Object.keys(nomes).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); })
      .forEach(function (n) { h += opcao(n, n, F.dev); });
    return h;
  }

  function montar(ctx) {
    var D = ctx.D;
    if (F.meus === null) F.meus = ctx.papel === 'dev';
    var todos = universo(ctx);
    // A contagem de cada frente sai do quadro ja filtrado, sem o filtro da frente.
    var filtradas = todos.filter(function (m) { return casaFiltros(m, D); });
    var porFrente = {};
    filtradas.forEach(function (m) { var f = frenteDe(m, D); porFrente[f] = (porFrente[f] || 0) + 1; });
    if (F.frente && !porFrente[F.frente]) F.frente = '';
    var escopo = filtradas.filter(function (m) { return !F.frente || frenteDe(m, D) === F.frente; });

    // ── Alertas: sobre o escopo, antes do filtro de vencidas ──
    var vencidas = escopo.filter(function (m) { return H.etapaDe(m) === 'atrasado'; });
    /* "A mais antiga" e a de entrega mais antiga, medida pela mesma regra do
       card — copia de `renderRiscoBanner` (admin.html). */
    var antiga = vencidas.filter(function (m) { return m.entrega; })
      .sort(function (a, b) { return String(a.entrega).localeCompare(String(b.entrega)); })[0];
    var diasAntiga = antiga ? (H.atrasoDe(antiga) || 0) : 0;
    var naArea = escopo.filter(function (m) { return H.colunaDe(m) === 'validacao_area'; });
    var cobrar = window.HOMOLOGACAO ? naArea.filter(function (m) { return HOMOLOGACAO.cobraHomologacao(m, H.hoje()); }).length : 0;
    var naVal = escopo.filter(function (m) { return H.colunaDe(m) === 'validacao'; });
    if (!vencidas.length) F.vencidas = false;

    var noQuadro = escopo.filter(function (m) { return !F.vencidas || H.etapaDe(m) === 'atrasado'; });
    var porCol = {};
    COLUNAS.concat(['negada']).forEach(function (k) { porCol[k] = []; });
    var escondidas = 0;
    noQuadro.forEach(function (m) {
      var k = H.colunaDe(m);
      if (!porCol[k]) return;
      if (!F.todasConcluidas && !doPeriodo(m)) { escondidas++; return; }
      porCol[k].push(m);
    });
    var prometida = window.ENTREGAUSU && ENTREGAUSU.data;
    Object.keys(porCol).forEach(function (k) {
      porCol[k] = window.ORDEMKB ? ORDEMKB.ordena(porCol[k], prometida) : porCol[k];
    });

    var cab = cabecalhoSprint(ctx);
    var podeCriar = ctx.papel === 'admin' || ctx.papel === 'dev';
    var lsFrentes = frentes().filter(function (f) { return porFrente[f] || f === F.frente; });

    var h = '<div class="qd" style="display:flex;flex-direction:column;gap:18px;min-width:0">';
    // ── Cabecalho ──
    h += '<header style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px">' +
      '<div style="display:flex;flex-direction:column;gap:6px;min-width:0">' +
      (cab.kick ? '<span class="qd-kick">' + H.esc(cab.kick) + '</span>' : '') +
      '<h1 class="h1">Quadro</h1>' +
      (cab.sub ? '<span class="sub">' + cab.sub + '</span>' : '') +
      '</div><div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;min-width:0;max-width:100%">' +
      // Uma frente so (o dev com "Só os meus") nao e escolha: o seletor some.
      (lsFrentes.length < 2 && !F.frente ? '' : '<div class="qd-seg" role="tablist" aria-label="Frente">' +
      '<button type="button" role="tab" data-frente="" aria-selected="' + (!F.frente) + '">Todas<span class="n">' + filtradas.length + '</span></button>' +
      lsFrentes.map(function (f) {
        return '<button type="button" role="tab" data-frente="' + attr(f) + '" aria-selected="' + (F.frente === f) + '">' + H.esc(f) +
          '<span class="n">' + (porFrente[f] || 0) + '</span></button>';
      }).join('') + '</div>') +
      (podeCriar ? '<button type="button" class="btnp" data-axa-form="novo">+ Novo item</button>' : '') +
      '</div></header>';

    // ── Alertas e filtros ──
    var ativos = (F.tipo ? 1 : 0) + (F.sistema ? 1 : 0) + (!F.meus && F.dev ? 1 : 0) + (F.vencidas ? 1 : 0) + (F.frente ? 1 : 0);
    h += '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">';
    if (vencidas.length) {
      h += '<button type="button" class="qd-alerta dg' + (F.vencidas ? ' on' : '') + '" data-acao-qd="vencidas" aria-pressed="' + F.vencidas + '"' +
        ' title="' + (F.vencidas ? 'Mostrar o quadro inteiro' : 'Mostrar só as vencidas') + '">' +
        H.plural(vencidas.length, 'com prazo vencido', 'com prazo vencido') + (diasAntiga > 0 ? ' · mais antiga há ' + H.plural(diasAntiga, 'dia', 'dias') : '') + '</button>';
    }
    if (naArea.length) {
      h += '<button type="button" class="qd-alerta wn" data-ir-col="validacao_area" title="Ir à coluna Validação da área">' +
        naArea.length + ' aguardando homologação' + (cobrar ? ' · ' + cobrar + ' há 5+ dias' : '') + '</button>';
    }
    if (naVal.length) {
      h += '<button type="button" class="qd-alerta wn" data-ir-col="validacao" title="Ir à coluna Validação PM/PO">' +
        naVal.length + ' aguardando validação PM/PO</button>';
    }
    /* Os filtros sao um bloco so, empurrado para a direita: quando nao cabem
       ao lado dos alertas, descem juntos para a linha de baixo. */
    h += '<div style="margin-left:auto;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:flex-end">';
    if (ctx.papel === 'dev') {
      h += '<button type="button" class="qd-meus" data-acao-qd="meus" aria-pressed="' + !!F.meus + '"><span class="sw"><i></i></span>Só os meus</button>';
    }
    // Rotulo e seletor andam juntos: no celular a linha quebra entre pares, nunca no meio.
    h += '<span class="qd-par"><label class="qd-fl" for="qd-tipo">Tipo</label><select id="qd-tipo" class="in qd-sel" data-filtro="tipo">' +
      opcao('', 'Todos', F.tipo) + opcao('evolucao', 'Evolução', F.tipo) + opcao('sustentacao', 'Sustentação', F.tipo) + opcao('__sem__', 'Sem tipo', F.tipo) + '</select></span>' +
      '<span class="qd-par"><label class="qd-fl" for="qd-sis">Sistema</label><select id="qd-sis" class="in qd-sel" data-filtro="sistema">' + opcoesSistema(todos) + '</select></span>';
    if (!F.meus) h += '<span class="qd-par"><label class="qd-fl" for="qd-dev">Dev</label><select id="qd-dev" class="in qd-sel" data-filtro="dev">' + opcoesDev(todos, D) + '</select></span>';
    if (ativos) h += '<button type="button" class="btns" data-acao-qd="limpar">Limpar (' + ativos + ')</button>';
    h += '</div></div>';

    // ── O quadro ──
    var total = COLUNAS.reduce(function (t, k) { return t + porCol[k].length; }, 0) + porCol.negada.length;
    if (!total && !escondidas) {
      h += '<div class="pn">' + H.vazio('board', F.meus ? 'Nada seu no quadro com estes filtros' : 'Nada no quadro com estes filtros',
        F.meus ? 'Desligue "Só os meus" para ver o quadro do time.' : 'Troque a frente ou limpe os filtros.',
        ativos || F.meus ? '<button type="button" class="btn" data-acao-qd="' + (F.meus && !ativos ? 'meus' : 'limpar') + '">' + (F.meus && !ativos ? 'Ver o quadro do time' : 'Limpar filtros') + '</button>' : '') + '</div>';
    } else {
      h += '<div id="qd-rolo" style="overflow-x: auto;padding-bottom:8px"><div class="qd-board">';
      COLUNAS.forEach(function (k) {
        var extra = '';
        if (k === 'concluido' && (escondidas || F.todasConcluidas)) {
          extra = '<button type="button" class="qd-mais" data-acao-qd="periodo" title="Concluídas e negadas: por padrão só as deste mês, como no admin">' +
            (F.todasConcluidas ? 'Só as deste mês' : '+ ' + escondidas + ' de outros meses') + '</button>';
        }
        h += coluna(k, porCol[k], extra);
      });
      if (F.negadaAberta) h += coluna('negada', porCol.negada);
      else h += '<button type="button" class="qd-neg" data-acao-qd="negada" title="Mostrar as negadas"><span class="dotc" style="background:var(--dg)"></span>' +
        '<span class="v">NEGADA</span><span class="n">' + porCol.negada.length + '</span></button>';
      h += '</div></div>';
    }
    h += '</div>';
    return h;
  }

  // ── Eventos ──────────────────────────────────────────────────────────
  function redesenhar(el, ctx) {
    var rolo = el.querySelector('#qd-rolo');
    var x = rolo ? rolo.scrollLeft : 0;
    var y = window.scrollY;
    el.innerHTML = montar(ctx);
    var novo = el.querySelector('#qd-rolo');
    if (novo) novo.scrollLeft = x;
    window.scrollTo(0, y);
  }

  function ligar(el, ctx) {
    if (el.__qdLigado) return;
    el.__qdLigado = true;
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-frente],[data-acao-qd],[data-mais],[data-ir-col]');
      if (!b || !el.contains(b)) return;
      if (b.hasAttribute('data-frente')) { F.frente = b.getAttribute('data-frente'); F.mais = {}; }
      else if (b.hasAttribute('data-mais')) { var k = b.getAttribute('data-mais'); F.mais[k] = (F.mais[k] || POR_PAGINA) + POR_PAGINA; }
      else if (b.hasAttribute('data-ir-col')) {
        var col = el.querySelector('.qd-col[data-col="' + b.getAttribute('data-ir-col') + '"]');
        var rolo = el.querySelector('#qd-rolo');
        if (col && rolo) {
          rolo.scrollTo({ left: col.offsetLeft - rolo.offsetLeft - 8, behavior: 'smooth' });
          col.classList.add('foco');
          setTimeout(function () { col.classList.remove('foco'); }, 1600);
        }
        return;
      } else {
        var a = b.getAttribute('data-acao-qd');
        if (a === 'vencidas') F.vencidas = !F.vencidas;
        else if (a === 'meus') { F.meus = !F.meus; F.mais = {}; }
        else if (a === 'periodo') F.todasConcluidas = !F.todasConcluidas;
        else if (a === 'negada') F.negadaAberta = !F.negadaAberta;
        else if (a === 'limpar') { F.tipo = F.sistema = F.dev = F.frente = ''; F.vencidas = false; F.mais = {}; }
      }
      redesenhar(el, ctx);
    });
    el.addEventListener('change', function (e) {
      var s = e.target.closest('[data-filtro]');
      if (!s) return;
      F[s.getAttribute('data-filtro')] = s.value;
      F.mais = {};
      redesenhar(el, ctx);
      var de = el.querySelector('[data-filtro="' + s.getAttribute('data-filtro') + '"]');
      if (de) de.focus();
    });
  }

  AX.tela({
    id: 'quadro',
    rotulo: 'Quadro',
    papeis: ['admin', 'dev'],
    titulo: function () { return 'Quadro'; },
    render: function (el, ctx) { css(); return montar(ctx); },
    depois: function (el, ctx) { ligar(el, ctx); }
  });
})();
