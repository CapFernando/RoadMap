/* ─────────────────────────────────────────────────────────────────────────
   AXIS — Relatorios (#relatorios). Relatorios salvos · Entregues · Como o
   time andou.

   "RELATORIOS SALVOS" NAO EXISTE NO ROADMAP. Nao ha modelo gravado, nem envio
   agendado por e-mail ou Teams. O que existe sao os relatorios que o admin ja
   gera — a ata da aba Relatorios, os dois decks em PPT e a base do mes em CSV
   — e e isso que a aba mostra, cada um com os numeros de agora e o botao que
   leva ao admin, onde ele de fato sai.

   As contas vem de `AXIS_GER` (axis-tela-paineis.js), que copiou as do admin
   com o nome da funcao de origem; aqui so se le e se desenha.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var raiz = typeof window !== 'undefined' ? window : globalThis;
  if (!raiz.AXIS_APP) return;
  var H = raiz.AXIS_APP.H;
  var esc = H.esc;
  var G = function () { return raiz.AXIS_GER; };

  // ── Estado da tela (sobrevive a troca de aba, nao ao recarregar) ─────
  var _modelo = 'comite';
  var _f = { de: '', ate: '', raiz: '', dev: '', q: '', pag: 0 };
  var _raizTime = '';

  /** Em desenvolvimento no periodo (`relDados`, admin.html): em andamento ou
   *  atrasada, com a janela inicio–prazo cruzando o periodo. */
  function emDesenvolvimento(D, de, ate) {
    return G().relVivasDe(D, '').filter(function (m) {
      var sp = m.status_planejamento || '';
      if (sp !== 'em_andamento' && H.etapaDe(m) !== 'atrasado') return false;
      var ini = m.inicio || m.entrega, fim = m.entrega || m.inicio;
      if (!ini || !fim) return sp === 'em_andamento';
      return ini <= ate && fim >= de;
    });
  }

  /** O julgamento do prazo de uma entrega (`relSaidaHTML`, admin.html): a
   *  conta e toda de prazo.js — prazo efetivo e atraso congelado na entrega. */
  function julgamento(m) {
    var C = raiz.CAPACIDADE, P = raiz.PRAZO;
    var saiu = C.diaDaEntrega(m);
    if (!saiu) return { k: 'sem_data', txt: 'sem data', cor: 'var(--tx4)' };
    if (!m.entrega) return { k: 'sem_prazo', txt: 'sem prazo', cor: 'var(--tx3)' };
    var atraso = P ? P.diasDeAtraso(m, H.colunaDe(m), H.hoje()) : null;
    var pz = P ? P.prazoEfetivo(m, saiu) : m.entrega;
    if (atraso === null) return { k: 'sem_prazo', txt: 'prazo ' + H.dm(pz), cor: 'var(--tx3)' };
    if (atraso <= 0) return { k: 'no_prazo', txt: 'no prazo', cor: 'var(--ok-t)', pz: pz };
    return { k: 'atraso', txt: '+' + atraso + 'd', cor: 'var(--dg-t)', dias: atraso, pz: pz };
  }

  // ═══ Relatorios salvos ═════════════════════════════════════════════════
  /* Os relatorios que o admin gera hoje. `aba` e a aba do admin onde ele sai;
     `secoes` e o que ele traz, com os nomes da propria tela de origem. */
  var MODELOS = [
    { id: 'comite', rot: 'Relatório do comitê', onde: 'Admin › Relatórios', aba: 'relatorios', acao: 'Abrir e copiar a ata',
      desc: 'A ata da reunião: escala mês, sprint ou semana, filtro por sistema e o texto de entrega (resumo ou completo). "Copiar tudo" leva o texto pronto para a ata.',
      secoes: ['Como o time andou', 'Onde a capacidade foi', 'Entregues', 'Em desenvolvimento', 'O que vem', 'Backlog'] },
    { id: 'sprint', rot: 'Placar da sprint', onde: 'Admin › Relatórios (escala sprint)', aba: 'relatorios', acao: 'Abrir o placar',
      desc: 'O compromisso da sprint repassada pelo PM/PO: pontos e itens validados, cumprimento, ranking por dev e o que está em risco.',
      secoes: ['Placar', 'Ranking por dev', 'Em risco de não entregar'] },
    { id: 'deck-mes', rot: 'Apresentação do mês (PPT)', onde: 'Admin › Gerencial › Gerar apresentação', aba: 'gerencial', acao: 'Gerar no admin',
      desc: 'O deck da reunião de resultados, em atos: o mês, a evolução, as frentes, os pontos e o prazo. Sai da apuração congelada quando o mês está congelado.',
      secoes: null },
    { id: 'deck-assunto', rot: 'Deck de um assunto (PPT)', onde: 'Admin › Gerencial › Gerar apresentação › Um assunto', aba: 'gerencial', acao: 'Gerar no admin',
      desc: 'O deck de um sistema (ou o consolidado dos cinco maiores): o panorama, a forma do período e o que vem. Escala mês, sprint ou semana.',
      secoes: ['Capa', 'O período em números', 'Ranking dos sistemas', 'Um resumo por assunto (até 5)', 'Placar da sprint (na escala sprint)', 'Backlog (opcional)'] },
    { id: 'csv', rot: 'Base do mês (CSV)', onde: 'Admin › Gerencial › Base do mês', aba: 'gerencial', acao: 'Baixar no admin',
      desc: 'Uma linha por demanda × pessoa, com sistema, frente, projeto, pontos (cheios e rateados), horas, datas e prazo. Para o Excel ou para quem não tem acesso.',
      secoes: ['Demanda e pessoa', 'Sistema, frente e projeto', 'Pontos cheios e rateados', 'Horas do mês', 'Datas e prazo'] },
    { id: 'fechamento', rot: 'Fechamento do mês', onde: 'AXIS › Fechamento do mês', href: '#fechamento', acao: 'Abrir',
      desc: 'Comprometidas no dia 1, o que entrou depois, o que foi entregue, o cumprimento e o que transbordou para o mês seguinte.',
      secoes: ['Comprometidas e entraram depois', 'Entregues e cumprimento', 'Por sprint e por dev', 'O que não saiu'] },
    { id: 'entregues', rot: 'Entregues no período', onde: 'AXIS › Relatórios › Entregues', href: '#relatorios/entregues', acao: 'Abrir',
      desc: 'A lista das entregas de qualquer período, com filtro de sistema e dev, o prazo de cada uma e exportação em CSV.',
      secoes: ['Por sistema', 'Lista com prazo e pontos', 'CSV'] },
    { id: 'time', rot: 'Como o time andou', onde: 'AXIS › Relatórios › Como o time andou', href: '#relatorios/time', acao: 'Abrir',
      desc: 'Planejado × entregue em pontos, comparado com o mês anterior, e a evolução dos últimos doze meses.',
      secoes: ['Planejado × entregue', 'Onde a capacidade foi', 'Mês a mês'] }
  ];

  function salvos(ctx) {
    var g = G(), D = ctx.D, alvo = g.mesCorrente(), j = g.janelaMes(alvo);
    var r = g.relComoAndou(D, j, ''), t = g.relTemasDe(D, '', j);
    var h = g.cabecalho('Relatórios',
      'Os relatórios que o RoadMap já gera, com os números de ' + esc(g.rotuloMes(alvo)) + '. Os que saem em PPT, CSV ou ata são gerados no admin.');
    h += '<div class="gx-g gx-as"><aside class="gx-col-f"><section class="pn" style="gap:4px"><span class="lab" style="padding:0 0 6px">MODELOS</span>' +
      MODELOS.map(function (m) {
        return '<button type="button" class="gx-mod' + (m.id === _modelo ? ' on' : '') + '" data-modelo="' + m.id + '"><span>' + esc(m.rot) + '</span>' +
          '<span class="note" style="font-size:11px">' + (m.href ? 'no AXIS' : 'admin') + '</span></button>';
      }).join('') + '</section>' +
      '<section class="pn" style="gap:8px"><span class="lab">AINDA NÃO EXISTE</span><span class="note">Modelo salvo com filtros próprios e envio agendado por e-mail ou Teams não estão no RoadMap. Hoje cada relatório é gerado na hora, na tela de origem.</span></section></aside>' +
      '<div class="gx-col-f">' +
        '<div class="gx-g gx-k4">' +
          g.k('Entregas no mês', H.num(r.entregas), 'saíram da mão do dev') +
          g.k('Pontos entregues', H.num(r.agora.entregue) + ' pt', 'pela entrega do dev', 'var(--ok-t)') +
          g.k('Planejado', H.num(r.agora.plan) + ' pt', 'pelo prazo combinado', 'var(--in-t)') +
          g.k('Sistemas com entrega', H.num(t.itens.length), t.itens[0] ? 'maior: ' + esc(t.itens[0].nome) : '—') + '</div>' +
        '<div id="rl-modelo">' + modelo(ctx) + '</div></div></div>';
    return h;
  }

  function modelo(ctx) {
    var g = G(), D = ctx.D, M = MODELOS.find(function (x) { return x.id === _modelo; }) || MODELOS[0];
    var alvo = g.mesCorrente(), j = g.janelaMes(alvo), L = g.limites(alvo);
    var secoes = M.secoes;
    if (M.id === 'deck-mes') {
      secoes = g.AP_SECOES.filter(function (s) { return s.pad; }).map(function (s) { return s.rot + (s.n > 1 ? ' (' + s.n + ' slides)' : ''); });
    }
    // O que o relatorio mostraria agora, com as mesmas contas da origem.
    var prev = '';
    if (M.id === 'comite' || M.id === 'entregues') {
      var en = g.relEntregues(D, L.de, L.ate, ''), and = emDesenvolvimento(D, L.de, L.ate);
      prev = linhaPrev([['Entregues em ' + g.rotuloMes(alvo), H.num(en.lista.length)], ['Em desenvolvimento', H.num(and.length)],
        ['Concluídas sem data (ficam fora)', H.num(en.semData)]]);
    } else if (M.id === 'sprint') {
      var S = raiz.SPRINTPO, rot = H.sprintAtual();
      var p = S ? S.placarDaSprint(D, rot, function (m) { return raiz.ETAPA.gravada(m); }, 'tecnologia') : null;
      prev = p ? linhaPrev([['Sprint', S.rotuloCurto(rot)], ['Itens validados', p.validados + ' de ' + p.total], ['Pontos validados', p.pontosValidados + ' de ' + p.pontosTotal],
        ['Esperando o PM/PO', String(p.aguardando)]]) : '';
    } else if (M.id === 'deck-mes' || M.id === 'fechamento') {
      var fc = g.fechamentoDoMes(D, alvo);
      prev = linhaPrev([['Comprometidas no dia 1', String(fc.inicio.length)], ['Entraram depois', String(fc.meio.length)], ['Entregues', String(fc.entregues.length)],
        ['Cumprimento', fc.pct === null ? '—' : fc.pct + '%']]);
    } else if (M.id === 'deck-assunto') {
      var t = g.relTemasDe(D, '', j);
      prev = linhaPrev(t.itens.slice(0, 5).map(function (x) { return [x.nome, x.pts + ' pt · ' + x.qtd + (x.qtd === 1 ? ' entrega' : ' entregas')]; }));
    } else if (M.id === 'csv') {
      var n = 0;
      raiz.AXIS_GER.vivas(D).forEach(function (m) { if (raiz.FILA.ehEntregaDe(m, L.de, L.ate)) n += Math.max(1, String(m.dev || '').split('/').filter(function (x) { return x.trim(); }).length); });
      prev = linhaPrev([['Linhas (demanda × pessoa) em ' + g.rotuloMes(alvo), H.num(n)]]);
    } else if (M.id === 'time') {
      var r = g.relComoAndou(D, j, '');
      prev = linhaPrev([['Planejado', r.agora.plan + ' pt'], ['Entregue', r.agora.entregue + ' pt'], ['Leitura', raiz.CAPACIDADE.rotulo(r.agora.plan, r.agora.entregue)]]);
    }
    var botao = M.href ? '<a class="btnp" href="' + M.href + '">' + esc(M.acao) + '</a>'
      : (H.pode('editar') ? H.linkAdmin(M.aba, M.acao, 'btnp') : '<span class="note">Gerado pelo PM/PO no admin.</span>');
    return '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:10px">' +
      '<span style="display:flex;flex-direction:column;gap:3px"><h2 class="h2">' + esc(M.rot) + '</h2><span class="note">' + esc(M.onde) + '</span></span>' + botao + '</div>' +
      '<span style="font-size:13.5px;line-height:21px;color:var(--tx2)">' + esc(M.desc) + '</span>' +
      '<div class="gx-g gx-2"><div style="display:flex;flex-direction:column;gap:6px"><span class="lab">O QUE TRAZ</span>' +
        (secoes || []).map(function (s) { return '<span class="gx-sl">' + H.ico('check', 'style="color:var(--ok-t)"') + '<span>' + esc(s) + '</span></span>'; }).join('') +
        (M.id === 'deck-mes' ? '<span class="note">O padrão do fechamento. Além disso: capa, um slide por destaque marcado e o slide final.</span>' : '') + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px"><span class="lab">AGORA</span>' + (prev || '<span class="note">—</span>') + '</div></div></section>';
  }
  function linhaPrev(pares) {
    return '<div style="border:1px solid var(--bd);border-radius:12px;overflow:hidden">' + pares.map(function (p, i) {
      return '<div class="row" style="justify-content:space-between;gap:12px;padding:9px 12px;font-size:12.5px' + (i ? ';border-top:1px solid var(--bd)' : '') + '">' +
        '<span class="note ell">' + esc(p[0]) + '</span><b class="mono" style="font-weight:600">' + esc(p[1]) + '</b></div>';
    }).join('') + '</div>';
  }

  // ═══ Entregues ═════════════════════════════════════════════════════════
  function periodo() {
    var g = G();
    if (!_f.de || !_f.ate) { var L = g.limites(g.mesCorrente()); _f.de = _f.de || L.de; _f.ate = _f.ate || L.ate; }
    return { de: _f.de <= _f.ate ? _f.de : _f.ate, ate: _f.de <= _f.ate ? _f.ate : _f.de };
  }
  /** A lista com os filtros da tela: periodo e sistema pela regra do admin,
   *  dev e texto por cima. */
  function entreguesFiltradas(D) {
    var g = G(), p = periodo(), base = g.relEntregues(D, p.de, p.ate, _f.raiz);
    var q = _f.q.trim().toLowerCase();
    var lista = base.lista.filter(function (m) {
      if (_f.dev && H.devsDe(m).indexOf(_f.dev) < 0) return false;
      if (q && [m.codigo, m.titulo, m.dev, H.tema(m.tema_id), m.resumo_entrega].join(' ').toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return String(base.saida(b)).localeCompare(String(base.saida(a))) || String(b.codigo || '').localeCompare(String(a.codigo || '')); });
    return { lista: lista, semData: base.semData, saida: base.saida, p: p, todas: base.lista };
  }
  function entregues(ctx) {
    var g = G(), D = ctx.D, p = periodo();
    // As opcoes saem da base do periodo: sistema pela RAIZ (`relInitControles`),
    // e so os que tem demanda, com a contagem ao lado.
    var cont = {};
    g.relVivasDe(D, '').forEach(function (m) { if (m.tema_id) { var k = g.relRaizDe(D, m); cont[k] = (cont[k] || 0) + 1; } });
    var sist = Object.keys(cont).sort(function (a, b) { return cont[b] - cont[a] || a.localeCompare(b, 'pt-BR'); });
    var devs = {};
    g.relEntregues(D, p.de, p.ate, '').lista.forEach(function (m) { H.devsDe(m).forEach(function (n) { devs[n] = true; }); });
    if (_f.dev) devs[_f.dev] = true;
    var h = g.cabecalho('<span id="rl-tit">Entregues · ' + H.dm(p.de) + ' a ' + H.dm(p.ate) + '</span>',
      '<span id="rl-sub"></span>',
      '<button type="button" class="btnp" data-csv="1">' + H.ico('download') + ' Exportar CSV</button>',
      '<span class="note"><a href="#relatorios/salvos">Relatórios</a> › Entregues</span>');
    h += '<section class="pn" style="padding:14px 16px"><div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end">' +
      campo('De', '<input class="in" type="date" data-f="de" value="' + esc(p.de) + '" style="height:36px">') +
      campo('Até', '<input class="in" type="date" data-f="ate" value="' + esc(p.ate) + '" style="height:36px">') +
      campo('Sistema', '<select class="in" data-f="raiz" style="height:36px;max-width:240px"><option value="">Todos os sistemas</option>' +
        sist.map(function (s) { return '<option value="' + esc(s) + '"' + (s === _f.raiz ? ' selected' : '') + '>' + esc(s) + ' (' + cont[s] + ')</option>'; }).join('') + '</select>') +
      campo('Dev', '<select class="in" data-f="dev" style="height:36px;max-width:200px"><option value="">Todos</option>' +
        Object.keys(devs).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }).map(function (n) { return '<option' + (n === _f.dev ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>') +
      campo('Buscar', '<input class="in" data-f="q" placeholder="AX-, título ou texto" value="' + esc(_f.q) + '" style="height:36px;width:220px">') +
      '<span class="row" style="gap:6px">' + [['mes', 'Este mês'], ['ant', 'Mês passado'], ['90', '90 dias']].map(function (x) {
        return '<button type="button" class="btns" data-atalho="' + x[0] + '">' + x[1] + '</button>';
      }).join('') + '</span></div></section>';
    h += '<div id="rl-res" style="display:flex;flex-direction:column;gap:16px">' + entreguesRes(ctx) + '</div>';
    return h;
  }
  function campo(rot, ctl) { return '<label style="display:flex;flex-direction:column;gap:4px"><span class="note" style="font-size:11.5px">' + rot + '</span>' + ctl + '</label>'; }

  function entreguesRes(ctx) {
    var g = G(), D = ctx.D, r = entreguesFiltradas(D);
    var l = r.lista, jul = new Map(l.map(function (m) { return [m.id, julgamento(m)]; }));
    var pts = l.reduce(function (t, m) { return t + H.pontosDe(m); }, 0);
    var aguard = l.filter(function (m) { return (m.status_planejamento || '') === 'validacao'; }).length;
    var med = l.filter(function (m) { var k = jul.get(m.id).k; return k === 'no_prazo' || k === 'atraso'; });
    var noPz = med.filter(function (m) { return jul.get(m.id).k === 'no_prazo'; }).length;
    var pct = med.length ? Math.round(noPz / med.length * 100) : null;
    var h = '<div class="gx-g gx-k4">' +
      g.k('Entregues', H.num(l.length), r.todas.length !== l.length ? 'de ' + r.todas.length + ' no período' : 'no período') +
      g.k('Pontos', H.num(pts), 'do Planning Poker', 'var(--ac-t)') +
      g.k('Esperando validação', H.num(aguard), 'entregues pelo dev, sem aprovação do PM/PO', aguard ? 'var(--wn-t)' : '') +
      g.k('No prazo', pct === null ? '—' : pct + '%', med.length ? noPz + ' de ' + med.length + ' com prazo' : 'nada com prazo combinado', g.corPct(pct)) + '</div>';

    // Por sistema, como o prototipo agrupa por projeto: contagem, pontos, a
    // composicao por tipo e o prazo. Clicar filtra.
    var por = {};
    l.forEach(function (m) {
      var k = m.tema_id ? g.relRaizDe(D, m) : 'Sem sistema';
      var a = por[k] = por[k] || { nome: k, n: 0, pts: 0, evo: 0, sust: 0, sem: 0, med: 0, ok: 0 };
      a.n++; a.pts += H.pontosDe(m);
      a[m.tipo === 'evolucao' ? 'evo' : m.tipo === 'sustentacao' ? 'sust' : 'sem']++;
      var j = jul.get(m.id).k;
      if (j === 'no_prazo' || j === 'atraso') { a.med++; if (j === 'no_prazo') a.ok++; }
    });
    var grupos = Object.keys(por).map(function (x) { return por[x]; }).sort(function (a, b) { return b.n - a.n || b.pts - a.pts; });
    if (grupos.length > 1 || _f.raiz) {
      h += '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2">Por sistema</h2><span class="note">' +
        (_f.raiz ? '<button type="button" class="link" data-raiz="">mostrar todos os sistemas</button>' : 'clique na linha para filtrar') + '</span></div>' +
        '<div class="gx-tw"><table class="tbl"><thead><tr><th>SISTEMA</th><th class="num">ENTREGUES</th><th class="num">PONTOS</th><th style="width:30%">COMPOSIÇÃO</th><th class="num">NO PRAZO</th></tr></thead><tbody>' +
        grupos.map(function (a) {
          var w = function (v) { return (v / a.n * 100).toFixed(1) + '%'; };
          return '<tr class="click" data-raiz="' + esc(a.nome) + '"><td style="color:var(--tx)">' + esc(a.nome) + '</td><td class="num mono">' + a.n + '</td><td class="num mono">' + a.pts + '</td>' +
            '<td><div class="bar" title="' + a.evo + ' evolução · ' + a.sust + ' sustentação · ' + a.sem + ' sem tipo"><span style="width:' + w(a.evo) + ';background:var(--ac)"></span>' +
            '<span style="width:' + w(a.sust) + ';background:var(--in)"></span><span style="width:' + w(a.sem) + ';background:var(--tx4)"></span></div></td>' +
            '<td class="num">' + (a.med ? g.chipPct(Math.round(a.ok / a.med * 100)) : '<span class="note">—</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="gx-leg">' + g.leg('var(--ac)', 'evolução') + g.leg('var(--in)', 'sustentação') + g.leg('var(--tx4)', 'sem tipo') + '</div></section>';
    }

    var pg = g.paginar(l, _f.pag, 25);
    _f.pag = pg.pag;
    h += '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2">Demandas</h2>' +
      '<span class="note">pela data em que o dev entregou; em validação ainda espera o PM/PO</span></div>' +
      (l.length ? '<div class="gx-tw"><table class="tbl"><thead><tr><th>ITEM</th><th>SISTEMA</th><th>DEV</th><th>ENTREGUE</th><th>PRAZO</th><th class="num">PONTOS</th><th>ETAPA</th></tr></thead><tbody>' +
        pg.itens.map(function (m) {
          var j = jul.get(m.id), res = String(m.resumo_entrega || '').trim();
          return '<tr><td style="color:var(--tx);max-width:420px"><span class="row" style="gap:8px">' + g.codLink(m) + '<span class="ell" title="' + esc(m.titulo) + '">' + esc(m.titulo) + '</span></span>' +
            (res ? '<span class="note ell" style="display:block;font-size:12px;margin-top:2px" title="' + esc(res) + '">' + esc(res) + '</span>' : '') + '</td>' +
            '<td class="ell" style="max-width:180px">' + esc(H.caminho(m.tema_id) || '—') + '</td><td>' + esc(m.dev || '—') + '</td>' +
            '<td class="mono">' + (H.dm(r.saida(m)) || '—') + '</td>' +
            '<td class="mono" style="color:' + j.cor + '"' + (j.pz ? ' title="prazo ' + H.dma(j.pz) + '"' : '') + '>' + esc(j.txt) + '</td>' +
            '<td class="num mono">' + (H.pontosDe(m) || '—') + '</td><td>' + H.chipEtapa(m) + '</td></tr>';
        }).join('') + '</tbody></table></div>' + g.navPag(pg, l.length, 'pag-ent')
        : H.vazio('check', 'Nenhuma entrega com esses filtros', 'Troque o período, o sistema ou o dev.')) + '</section>';
    return h;
  }

  /** CSV no navegador, com BOM e ponto e virgula: e o que o Excel em pt-BR abre
   *  sem perguntar nada. As colunas sao as da tabela, mais o resumo inteiro. */
  function baixarCsv(ctx) {
    var g = G(), r = entreguesFiltradas(ctx.D);
    var cel = function (v) { var s = String(v == null ? '' : v); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var linhas = [['Código', 'Título', 'Sistema', 'Tema', 'Dev', 'Etapa', 'Entregue em', 'Prazo', 'Situação do prazo', 'Pontos', 'Tipo', 'Resumo da entrega']];
    r.lista.forEach(function (m) {
      var j = julgamento(m), e = H.ETAPA_POR_ID[H.colunaDe(m)];
      linhas.push([m.codigo || '', m.titulo || '', m.tema_id ? g.relRaizDe(ctx.D, m) : '', H.tema(m.tema_id), m.dev || '', e ? e.rotulo : (m.status_planejamento || ''),
        H.dma(r.saida(m)), H.dma(m.entrega), j.txt, H.pontosDe(m) || '', (H.TIPOS[m.tipo] || {}).rotulo || '', String(m.resumo_entrega || '').trim()]);
    });
    var txt = '﻿' + linhas.map(function (l) { return l.map(cel).join(';'); }).join('\r\n');
    var url = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
    var a = document.createElement('a');
    a.href = url; a.download = 'entregues-' + r.p.de + '-a-' + r.p.ate + (_f.raiz ? '-' + _f.raiz.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').toLowerCase() : '') + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    H.toast(r.lista.length + (r.lista.length === 1 ? ' entrega exportada.' : ' entregas exportadas.'));
  }

  // ═══ Como o time andou ═════════════════════════════════════════════════
  /** A variacao escrita (`relDeltaHTML`): `bom` diz de que lado esta o verde;
   *  planejar mais nao e nem bom nem ruim. */
  function deltaRel(atual, ant, bom) {
    var d = atual - ant;
    if (!ant && !atual) return '';
    if (d === 0) return '<span class="gx-d">= igual ao período anterior</span>';
    var cls = bom == null ? '' : ((d > 0) === bom ? 'up' : 'down');
    return '<span class="gx-d ' + cls + '">' + (d > 0 ? '▲ +' : '▼ ') + Math.abs(d) + ' vs. anterior (' + ant + ')</span>';
  }
  function time(ctx) {
    var g = G(), D = ctx.D, C = raiz.CAPACIDADE, alvo = g.alvoDe(ctx.param), j = g.janelaMes(alvo);
    var r = g.relComoAndou(D, j, _raizTime);
    var cont = {};
    g.relVivasDe(D, '').forEach(function (m) { if (m.tema_id) { var k2 = g.relRaizDe(D, m); cont[k2] = (cont[k2] || 0) + 1; } });
    var sist = Object.keys(cont).sort(function (a, b) { return cont[b] - cont[a] || a.localeCompare(b, 'pt-BR'); });
    var h = g.cabecalho('Como o time andou · ' + esc(g.nomeMes(alvo)),
      'Comparado com ' + esc(j.rotAnt) + '. Planejado conta a data do prazo combinado; entregue, a data em que o dev entregou — sem esperar a validação do PO.',
      g.seletorMes('relatorios/time', alvo) +
      '<select class="in" data-raiz-time="1" style="height:32px;max-width:220px" aria-label="Sistema"><option value="">Todos os sistemas</option>' +
        sist.map(function (s) { return '<option value="' + esc(s) + '"' + (s === _raizTime ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>' +
      (H.pode('editar') ? H.linkAdmin('relatorios', 'Copiar a ata no admin') : ''),
      '<span class="note"><a href="#relatorios/salvos">Relatórios</a> › Como o time andou</span>');

    // Os cinco cartoes de `relRenderAndou`, com a supressao do "sem base".
    var semBase = !r.antes.comparavel;
    var semBaseTxt = '<span class="gx-d" title="No período anterior, ' + r.antes.semPlano + ' dos ' + r.antes.entregue + ' pontos entregues vieram de demandas sem plano registrado.">sem base para comparar</span>';
    var leitura = C.rotulo(r.agora.plan, r.agora.entregue);
    h += '<div class="gx-g gx-k5">' +
      g.k('Planejado', H.num(r.agora.plan) + ' pt', (semBase ? semBaseTxt : deltaRel(r.agora.plan, r.antes.plan, null)) + '<span class="gx-d">pelo prazo combinado</span>', 'var(--in-t)') +
      g.k('Entregue', H.num(r.agora.entregue) + ' pt', deltaRel(r.agora.entregue, r.antes.entregue, true) + '<span class="gx-d">pela entrega do dev</span>', 'var(--ok-t)') +
      g.k('Leitura', esc(leitura), (semBase ? semBaseTxt : (r.antes.plan || r.antes.entregue) ? '<span class="gx-d">era ' + esc(C.rotulo(r.antes.plan, r.antes.entregue)) + ' no período anterior</span>' : '') + '<span class="gx-d">do que foi combinado</span>') +
      g.k('Entregas', H.num(r.entregas), deltaRel(r.entregas, r.entregasAnt, true) + '<span class="gx-d">demandas que saíram da mão do dev</span>') +
      g.k('Pessoas', H.num(r.agora.devs), 'com plano ou entrega no período') + '</div>';
    var partes = [];
    if (r.agora.semPontuar) partes.push(r.agora.semPontuar + (r.agora.semPontuar === 1 ? ' demanda alocada' : ' demandas alocadas') + ' sem pontuação neste período: o planejado de quem as recebeu está menor do que é.');
    if (!r.antes.comparavel && r.antes.entregue) partes.push('A comparação de pontos com ' + j.rotAnt + ' está suprimida: ' + r.antes.semPlano + ' dos ' + r.antes.entregue + ' pontos de lá vieram de demandas sem plano registrado. A contagem de entregas continua comparável.');
    if (partes.length) h += '<div class="lock">' + H.ico('info') + '<span>' + esc(partes.join(' ')) + '</span></div>';

    // Doze meses: entregas e pontos (`relComoAndou` mes a mes) e o prazo das
    // concluidas (`renderGerPrazo`), o mesmo corte por mes da conclusao.
    var serie = [];
    for (var i = 11; i >= 0; i--) {
      var a = g.mesSoma(alvo, -i), ja = g.janelaMes(a);
      var ra = g.relComoAndou(D, ja, _raizTime), pz = prazoFiltrado(D, a);
      serie.push({ alvo: a, rot: H.MESES_C[+a.slice(5) - 1] + (a.slice(5) === '01' || i === 11 ? '/' + a.slice(2, 4) : ''), ent: ra.entregas, plan: ra.agora.plan, feito: ra.agora.entregue,
                   pct: pz.pct, atraso: pz.atrasoMedio, medidas: pz.medidas, nAtraso: pz.nAtraso });
    }
    var rots = serie.map(function (s) { return s.rot; });
    h += '<div class="gx-g gx-2">' +
      '<section class="pn"><div class="row" style="justify-content:space-between"><h2 class="h2">Entregas por mês</h2><span class="note">demandas que saíram da mão do dev</span></div>' +
        g.colunas(serie.map(function (s) { return { rot: s.rot, partes: [{ v: s.ent, cor: s.alvo === alvo ? 'var(--ac)' : 'var(--in)', nome: 'entregas' }] }; }), 140) + '</section>' +
      '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2">Pontos: planejado × entregue</h2>' +
        '<span class="gx-leg">' + g.leg('var(--in)', 'planejado') + g.leg('var(--ok)', 'entregue') + '</span></div>' +
        g.linhas([{ nome: 'Planejado', cor: 'var(--in)', v: serie.map(function (s) { return s.plan; }) }, { nome: 'Entregue', cor: 'var(--ok)', v: serie.map(function (s) { return s.feito; }) }], rots,
                 { sufixo: '', rotulo: 'Pontos planejados e entregues por mês' }) + '</section></div>';
    var temAtraso = serie.some(function (s) { return s.atraso != null; });
    h += '<div class="gx-g gx-2a">' +
      '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2">Atraso médio e entregas no prazo</h2><span class="note">concluídas no mês com prazo combinado</span></div>' +
        (temAtraso || serie.some(function (s) { return s.pct != null; })
          ? g.linhas([{ nome: 'No prazo', cor: 'var(--in)', v: serie.map(function (s) { return s.pct; }) }], rots, { max: 100, meta: 80, sufixo: '%', rotulo: 'Entregas no prazo por mês' }) +
            '<div class="gx-leg">' + g.leg('var(--in)', '% no prazo') + g.leg('var(--wn)', 'meta 80%') + '</div>' +
            '<span class="lab" style="margin-top:4px">ATRASO MÉDIO DAS ATRASADAS (DIAS)</span>' +
            (temAtraso ? g.colunas(serie.map(function (s) { return { rot: s.rot, txt: s.atraso == null ? '—' : s.atraso + 'd', partes: [{ v: s.atraso || 0, cor: 'var(--dg)', nome: 'dias' }] }; }), 70)
                       : '<span class="note">Nenhuma entrega com atraso nos últimos doze meses' + (_raizTime ? ' neste sistema' : '') + '.</span>')
          : H.vazio('clock', 'Nenhuma conclusão com prazo nos últimos doze meses')) + '</section>' +
      onde(D, j) + '</div>';

    h += '<section class="pn"><h2 class="h2">Mês a mês</h2><div class="gx-tw"><table class="tbl"><thead><tr><th>MÊS</th><th class="num">ENTREGAS</th><th class="num">PLANEJADO</th>' +
      '<th class="num">ENTREGUE</th><th class="num">LEITURA</th><th class="num">NO PRAZO</th><th class="num">ATRASO MÉDIO</th></tr></thead><tbody>' +
      serie.slice().reverse().map(function (s) {
        return '<tr' + (s.alvo === alvo ? ' style="background:rgba(var(--ac-rgb),.06)"' : '') + '><td style="color:var(--tx)"><a href="#relatorios/time/' + s.alvo + '" style="color:inherit;text-decoration:none">' + esc(g.rotuloMes(s.alvo)) + '</a></td>' +
          '<td class="num mono">' + s.ent + '</td><td class="num mono">' + s.plan + ' pt</td><td class="num mono">' + s.feito + ' pt</td>' +
          '<td class="num mono">' + esc(C.rotulo(s.plan, s.feito)) + '</td><td class="num">' + (s.medidas ? g.chipPct(s.pct) + ' <span class="note">' + s.medidas + '</span>' : '<span class="note">—</span>') + '</td>' +
          '<td class="num mono">' + (s.atraso == null ? '—' : s.atraso + 'd · ' + s.nAtraso) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<span class="note">Entregas e pontos pela data em que o dev entregou (capacidade.js). Prazo pela data de conclusão, medido até a entrega do dev; atraso médio só entre as atrasadas, como no Gerencial.</span></section>';
    return h;
  }
  /** O prazo de um mes (`renderGerPrazo`), com o filtro de sistema da aba. */
  function prazoFiltrado(D, a) {
    var g = G(), pz = g.prazoDoMes(D, a);
    if (!_raizTime) return { pct: pz.pct, atrasoMedio: pz.atraso.length ? pz.diasMedio : null, medidas: pz.medidas, nAtraso: pz.atraso.length };
    var f = function (m) { return g.relRaizDe(D, m) === _raizTime; };
    var ok = pz.noPrazo.filter(f).length, at = pz.atraso.filter(f);
    var med = ok + at.length;
    return { pct: med ? Math.round(ok / med * 100) : null, medidas: med, nAtraso: at.length,
             atrasoMedio: at.length ? Math.round(at.reduce(function (t, m) { return t + pz.cls.get(m.id).dias; }, 0) / at.length) : null };
  }
  /** Onde a capacidade foi (`relRenderTemas`): pontos entregues por sistema. */
  function onde(D, j) {
    var g = G(), t = g.relTemasDe(D, _raizTime, j);
    var h = '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2">Onde a capacidade foi</h2><span class="note">' +
      (t.itens.length ? t.total + ' pontos em ' + t.itens.length + (t.itens.length === 1 ? ' sistema' : ' sistemas') : '') + '</span></div>';
    if (!t.itens.length) return h + H.vazio('target', 'Nenhuma entrega pontuada em ' + j.rot) + '</section>';
    return h + g.barrasH(t.itens.map(function (x) {
      return { rot: x.nome, v: x.pts, cor: x.pts ? 'var(--in)' : 'var(--tx4)', txt: x.pts ? x.pts + ' pt' : '—',
               extra: (x.pts && t.total ? Math.round(x.pts / t.total * 100) + '% · ' : '') + x.qtd + ' dem.', titulo: x.pts ? '' : x.qtd + ' entrega(s) sem pontuação' };
    })) + '<span class="note">Todo sistema aparece com nome. Zero ponto é entrega que ninguém estimou, e não pouco trabalho.</span></section>';
  }

  // ═══ Registro ══════════════════════════════════════════════════════════
  function abasDe(r) {
    var m = r.aba === 'time' && r.param ? '/' + r.param.split('/')[0] : '';
    return [{ id: 'salvos', rotulo: 'Relatórios salvos' }, { id: 'entregues', rotulo: 'Entregues' },
            { id: 'time', rotulo: 'Como o time andou', href: '#relatorios/time' + m }];
  }
  raiz.AXIS_APP.tela({
    id: 'relatorios', rotulo: 'Relatórios', papeis: ['admin', 'consulta'],
    abas: [{ id: 'salvos', rotulo: 'Relatórios salvos' }, { id: 'entregues', rotulo: 'Entregues' }, { id: 'time', rotulo: 'Como o time andou' }],
    abasDe: abasDe,
    titulo: function (r) { return 'Relatórios · ' + ({ salvos: 'Relatórios salvos', entregues: 'Entregues', time: 'Como o time andou' }[r.aba] || ''); },
    render: function (el, ctx) {
      if (!G()) return H.vazio('alert', 'As contas do gerencial não carregaram', 'axis-tela-paineis.js precisa vir antes deste arquivo.');
      G().css();
      if (ctx.aba === 'entregues') return entregues(ctx);
      if (ctx.aba === 'time') return time(ctx);
      return salvos(ctx);
    },
    depois: function (el, ctx) {
      if (!G()) return;
      G().ligaSeletorMes(el);
      var refaz = function () {
        var box = el.querySelector('#rl-res');
        if (box) box.innerHTML = entreguesRes(ctx);
        var p = periodo(), t = el.querySelector('#rl-tit');
        if (t) t.textContent = 'Entregues · ' + H.dm(p.de) + ' a ' + H.dm(p.ate);
        var sub = el.querySelector('#rl-sub');
        var r = entreguesFiltradas(ctx.D);
        if (sub) sub.textContent = r.lista.length + (r.lista.length === 1 ? ' demanda' : ' demandas') + ' que saíram da mão do dev no período.' +
          (r.semData ? ' ' + r.semData + (r.semData === 1 ? ' concluída sem data fica' : ' concluídas sem data ficam') + ' fora.' : '');
      };
      if (ctx.aba === 'entregues') refaz();
      var tq = null;
      el.addEventListener('input', function (e) {
        var c = e.target.closest('[data-f="q"]');
        if (!c) return;
        clearTimeout(tq);
        tq = setTimeout(function () { _f.q = c.value; _f.pag = 0; refaz(); }, 200);
      });
      el.addEventListener('change', function (e) {
        var c = e.target.closest('[data-f]');
        if (c && c.getAttribute('data-f') !== 'q') {
          _f[c.getAttribute('data-f')] = c.value; _f.pag = 0;
          // Trocar periodo ou sistema muda a lista de devs: redesenha tudo.
          if (c.getAttribute('data-f') === 'dev') refaz(); else raiz.AXIS_APP.desenhar();
          return;
        }
        if (e.target.closest('[data-raiz-time]')) { _raizTime = e.target.value; raiz.AXIS_APP.desenhar(); }
      });
      el.addEventListener('click', function (e) {
        var m = e.target.closest('[data-modelo]');
        if (m) {
          _modelo = m.getAttribute('data-modelo');
          Array.prototype.forEach.call(el.querySelectorAll('[data-modelo]'), function (x) { x.classList.toggle('on', x === m); });
          var box = el.querySelector('#rl-modelo');
          if (box) box.innerHTML = modelo(ctx);
          return;
        }
        var rz = e.target.closest('[data-raiz]');
        if (rz) { _f.raiz = rz.getAttribute('data-raiz'); _f.pag = 0; raiz.AXIS_APP.desenhar(); return; }
        var pg = e.target.closest('[data-pag-ent]');
        if (pg && !pg.disabled) { _f.pag = +pg.getAttribute('data-pag-ent'); refaz(); return; }
        var at = e.target.closest('[data-atalho]');
        if (at) {
          var g = G(), q = at.getAttribute('data-atalho'), hj = H.hoje();
          if (q === 'mes') { var L = g.limites(g.mesCorrente()); _f.de = L.de; _f.ate = L.ate; }
          else if (q === 'ant') { var LA = g.limites(g.mesSoma(g.mesCorrente(), -1)); _f.de = LA.de; _f.ate = LA.ate; }
          else { var d = H.data(hj); d.setDate(d.getDate() - 89); _f.de = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); _f.ate = hj; }
          _f.pag = 0; raiz.AXIS_APP.desenhar();
          return;
        }
        if (e.target.closest('[data-csv]')) baixarCsv(ctx);
      });
    }
  });
})();
