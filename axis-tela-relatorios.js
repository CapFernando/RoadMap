/* ─────────────────────────────────────────────────────────────────────────
   AXIS — Relatorios (#relatorios). Relatorios salvos · Entregues · Como o
   time andou.

   "RELATORIOS SALVOS" NAO EXISTE NO ROADMAP. Nao ha modelo gravado, nem envio
   agendado por e-mail ou Teams. O que existe sao os relatorios que o admin
   gerava — a ata da aba Relatorios, o placar da sprint, os decks em PPT e a
   base do mes em CSV — e e isso que a aba mostra, cada um com os numeros de
   agora e o botao que o gera AQUI, com o mesmo texto e o mesmo arquivo.

   O QUE SAI DAQUI: a ata (`relTexto`), o placar da sprint (`relPptSprint`), o
   deck de um assunto (`relPptDados`, desenhado pelo relatorio-ppt.js), a base
   do mes em CSV (`csvBaseDoMes`) e os PPTs de Projetos em andamento
   (`projetos-ppt.js`) e de Em aprovacao de requisitos (`aprovacao-ppt.js`).
   O deck do mes e montado no Fechamento do mes, onde se escolhem os slides.
   Os geradores nao calculam nada; recebem os dados prontos, e por isso o app
   gera o mesmo arquivo. Qualquer botao com `data-axis-ppt` (Projetos, Quadro
   ou esta tela) cai em `gerarPPT`; com `data-axis-csv`, em `baixarCsvDoMes`.

   AS REGRAS DA ATA, DO DECK DE ASSUNTO E DO CSV ESTAO NO TOPO, PURAS
   (`REGRAS_REL`): copias do admin com o nome da origem, que a suite executa ao
   lado das originais. As da tela vem de `AXIS_GER` (axis-tela-paineis.js).
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var raiz = typeof window !== 'undefined' ? window : globalThis;

  // ══ REGRAS (puras) ═══════════════════════════════════════════════════════
  /* A ATA, O DECK DE UM ASSUNTO E A BASE DO MES EM CSV — copias do admin, com
     o nome da origem: `relTexto` e o que ela le (`relDados`, `relComoAndou`,
     `relTemasDe`, `relOQueVemDe`, `relBacklogDe`, `relPptSprint`), o deck de
     assunto (`relPptDados` e as que ele chama) e `csvBaseDoMes`/`csvTexto`.
     As contas de hora, prazo e frente vem de AXIS_FECHA (axis-tela-fechamento.js),
     as mesmas do deck do mes: um CSV com regra propria seria a quinta
     implementacao do prazo.

     `S` e a base (o `state` do admin). Onde a origem lia um seletor da tela, a
     funcao recebe o valor. Os modulos (FILA, PRAZO, CAPACIDADE, SPRINTPO, ETAPA,
     PIPELINES, o catalogo e o nome do mes) vem da janela, que a suite troca por
     `usar`. */
  var W = raiz;
  function usar(w) { W = w || raiz; }
  function F() { return W.AXIS_FECHA; }
  function fmt(s) { return F().formatDate(s); }

  // ── Datas (`segundaDa`, `iso`, `maisDias`, admin.html) ─────────────────
  function segundaDa(d) {
    var dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var dow = dt.getDay();
    dt.setDate(dt.getDate() - (dow === 0 ? 6 : dow - 1));
    return dt;
  }
  function isoD(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function maisDias(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }

  /** `relRaizDe` (admin.html): a raiz do tema da demanda. */
  function relRaizDe(S, m) {
    var t = ((S || {}).temas || []).find(function (x) { return x.id === (m || {}).tema_id; });
    return t ? F().relRaizNome(t.nome) : 'Sem sistema';
  }
  /** `janelaDe` (admin.html): a janela e a anterior, na escala pedida. Na de
   *  sprint a origem le `window.state.feriados` — e o `state` do admin e `let`,
   *  que nao vira propriedade da janela: os feriados ficam de fora. Mantido,
   *  para a ata do app dizer o mesmo periodo que a do admin. */
  function janelaDe(S, escala, valor) {
    var SP = W.SPRINTPO, PRAZO = W.PRAZO;
    if (escala === 'sprint') {
      var fer = [];
      var r = String(valor || '') || (SP ? SP.sprintCorrente(PRAZO.hojeISO(), fer) : '');
      var f = SP ? SP.faixaDaSprint(r, fer) : null;
      if (!f) return janelaDe(S, 'semana', '');
      var ant = SP.sprintAnterior(r, fer);
      var fa = ant ? SP.faixaDaSprint(ant, fer) : null;
      var curto = SP.rotuloCurto(r);
      return { escala: 'sprint', sprint: r, de: f.de, ate: f.ate,
               deAnt: fa ? fa.de : f.de, ateAnt: fa ? fa.ate : f.de,
               rot: curto + ' (' + fmt(f.de) + ' a ' + fmt(f.ate) + ')',
               rotAnt: ant ? SP.rotuloCurto(ant) + ' (' + fmt(fa.de) + ' a ' + fmt(fa.ate) + ')' : 'sprint anterior',
               curto: 'sprint' };
    }
    if (escala === 'semana') {
      var ini = valor ? new Date(valor + 'T00:00:00') : segundaDa(new Date());
      var de = isoD(ini), ate = isoD(maisDias(ini, 6));
      var deAnt = isoD(maisDias(ini, -7)), ateAnt = isoD(maisDias(ini, -1));
      return { escala: 'semana', de: de, ate: ate, deAnt: deAnt, ateAnt: ateAnt,
               rot: fmt(de) + ' a ' + fmt(ate),
               rotAnt: 'semana anterior (' + fmt(deAnt) + ' a ' + fmt(ateAnt) + ')',
               curto: 'semana' };
    }
    var ym = valor || new Date().toISOString().slice(0, 7);
    var an = Number(ym.split('-')[0]), mn = Number(ym.split('-')[1]);
    var ult = function (a, m) { return new Date(a, m, 0).getDate(); };
    var pa = an, pm = mn - 1;
    if (pm === 0) { pm = 12; pa--; }
    var ymAnt = pa + '-' + String(pm).padStart(2, '0');
    var nome = function (i) { return W.apresentacaoMesNome ? W.apresentacaoMesNome(i) : ''; };
    return { escala: 'mes', de: ym + '-01', ate: ym + '-' + String(ult(an, mn)).padStart(2, '0'),
             deAnt: ymAnt + '-01', ateAnt: ymAnt + '-' + String(ult(pa, pm)).padStart(2, '0'),
             rot: nome(mn - 1) + ' de ' + an, rotAnt: nome(pm - 1) + ' de ' + pa, curto: 'mês' };
  }
  /** As opcoes do seletor de semana (`relInitSemanas`): as ultimas doze. */
  function semanasDoSeletor() {
    var base = segundaDa(new Date()), out = [];
    for (var i = 0; i < 12; i++) {
      var ini = maisDias(base, -7 * i), fim = maisDias(ini, 6);
      out.push({ valor: isoD(ini), rot: fmt(isoD(ini)) + ' a ' + fmt(isoD(fim)) + (i === 0 ? ' (esta semana)' : i === 1 ? ' (semana passada)' : '') });
    }
    return out;
  }
  /** `sprintsComDados` (admin.html): as sprints usadas, a corrente e as cinco seguintes. */
  function sprintsComDados(S) {
    var SP = W.SPRINTPO, PRAZO = W.PRAZO, vistas = {};
    ((S || {}).melhorias || []).forEach(function (m) {
      if (!m || m.oculto || m.mesclado_em) return;
      SP.entradas(m).forEach(function (e) { if (e.sprint) vistas[e.sprint] = true; });
      var s = SP.doPO(m);
      if (s) vistas[s] = true;
    });
    var agora = SP.rotuloDeData(PRAZO.hojeISO(), (S || {}).feriados || []);
    if (agora) vistas[agora] = true;
    SP.proximasSprints(PRAZO.hojeISO(), 5, (S || {}).feriados || []).forEach(function (s) { vistas[s.rotulo] = true; });
    var chave = function (r) { return r.slice(6, 10) + r.slice(3, 5) + r.slice(1, 2); };
    return Object.keys(vistas).sort(function (a, b) { return chave(b).localeCompare(chave(a)); });
  }

  /** `relVivasDe` (admin.html): vivas e nao negadas; raiz vazia = todas. */
  function relVivasDe(S, raizF) {
    return ((S || {}).melhorias || []).filter(function (m) {
      return m && !m.oculto && !m.mesclado_em && (m.status_planejamento || '') !== 'negada' && m.status !== 'negada' &&
        (!raizF || relRaizDe(S, m) === raizF);
    });
  }
  /** `relComoAndou` (admin.html), com o filtro de sistema como argumento. */
  function relComoAndou(S, j, raizF) {
    var CAPI = W.CAPACIDADE;
    var vivas = relVivasDe(S, raizF);
    var soma = function (de, ate) {
      var linhas = CAPI.porDev(vivas, de, ate);
      var semPlano = 0;
      vivas.forEach(function (m) {
        var d = CAPI.diaDaEntrega(m);
        if (!d || d < de || d > ate) return;
        var e = CAPI.entregues(m);
        if (e && !CAPI.planejados(m)) semPlano += e;
      });
      var entregue = linhas.reduce(function (t, x) { return t + x.entregue; }, 0);
      return {
        plan: linhas.reduce(function (t, x) { return t + x.plan; }, 0),
        entregue: entregue, semPlano: semPlano,
        comparavel: entregue > 0 ? (semPlano / entregue) < 0.5 : false,
        semPontuar: linhas.reduce(function (t, x) { return t + x.semPontuar; }, 0),
        devs: linhas.filter(function (x) { return x.plan || x.entregue; }).length
      };
    };
    var agora = soma(j.de, j.ate), antes = soma(j.deAnt, j.ateAnt);
    var entregas = vivas.filter(function (m) {
      var d = CAPI.diaDaEntrega(m);
      return d && d >= j.de && d <= j.ate && CAPI.entregues(m) >= 0 && ['validacao', 'concluido'].indexOf(m.status_planejamento || '') >= 0;
    }).length;
    var entregasAnt = vivas.filter(function (m) {
      var d = CAPI.diaDaEntrega(m);
      return d && d >= j.deAnt && d <= j.ateAnt && ['validacao', 'concluido'].indexOf(m.status_planejamento || '') >= 0;
    }).length;
    return { agora: agora, antes: antes, entregas: entregas, entregasAnt: entregasAnt };
  }
  /** `relTemasDe` (admin.html): pontos entregues por raiz, na janela. */
  function relTemasDe(S, raizF, j) {
    var CAPI = W.CAPACIDADE;
    var porTema = new Map();
    relVivasDe(S, raizF).forEach(function (m) {
      var d = CAPI.diaDaEntrega(m);
      if (!d || d < j.de || d > j.ate) return;
      var pts = CAPI.entregues(m);
      var k = m.tema_id ? relRaizDe(S, m) : 'Sem sistema';
      var a = porTema.get(k) || { pts: 0, qtd: 0 };
      a.pts += pts; a.qtd += 1;
      porTema.set(k, a);
    });
    var itens = Array.from(porTema.entries()).map(function (e) { return { nome: e[0], pts: e[1].pts, qtd: e[1].qtd }; })
      .sort(function (a, b) { return b.pts - a.pts || b.qtd - a.qtd; });
    return { itens: itens, total: itens.reduce(function (t, x) { return t + x.pts; }, 0), qtd: itens.reduce(function (t, x) { return t + x.qtd; }, 0) };
  }
  /** `relBacklogDe` (admin.html): Backlog e Em aprovacao de requisitos, pela idade. */
  function relBacklogDe(S, raizF) {
    var vivas = relVivasDe(S, raizF);
    var hoje = new Date();
    var idade = function (m) {
      var c = String(m.criado_em || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(c)) return null;
      var p = c.split('-').map(Number);
      return Math.max(0, Math.round((hoje - new Date(p[0], p[1] - 1, p[2])) / 86400000));
    };
    var itens = vivas.filter(function (m) { return ['backlog', 'levantar_req'].indexOf(String(m.status_planejamento || '')) >= 0; })
      .map(function (m) {
        return { codigo: m.codigo || '', titulo: m.titulo || '(sem título)', tema: m.tema_id ? relRaizDe(S, m) : '—',
                 pts: Number(m.poker_pontos) || 0, dev: m.dev || '', dias: idade(m), criado: String(m.criado_em || '').slice(0, 10) };
      })
      .sort(function (a, b) {
        if ((a.dias == null) !== (b.dias == null)) return a.dias == null ? 1 : -1;
        return (b.dias || 0) - (a.dias || 0) || String(a.codigo).localeCompare(String(b.codigo));
      });
    var pontuadas = itens.filter(function (x) { return x.pts > 0; });
    var porSis = new Map();
    itens.forEach(function (x) {
      var a = porSis.get(x.tema) || { qtd: 0, pts: 0 };
      a.qtd += 1; a.pts += x.pts;
      porSis.set(x.tema, a);
    });
    return {
      itens: itens, total: itens.length, pontuadas: pontuadas.length,
      pontos: pontuadas.reduce(function (t, x) { return t + x.pts; }, 0),
      semPonto: itens.length - pontuadas.length,
      maisVelha: itens.length && itens[0].dias != null ? itens[0].dias : null,
      sistemas: Array.from(porSis.entries()).map(function (e) { return { nome: e[0], qtd: e[1].qtd, pts: e[1].pts }; })
        .sort(function (a, b) { return b.qtd - a.qtd || b.pts - a.pts; })
    };
  }
  /** `relOQueVemDe` (admin.html): em Planning e pontuadas sem prazo. */
  function relOQueVemDe(S, raizF) {
    var CAPI = W.CAPACIDADE;
    var vivas = relVivasDe(S, raizF);
    var monta = function (m) {
      return { codigo: m.codigo || '', titulo: m.titulo || '(sem título)', tema: m.tema_id ? relRaizDe(S, m) : '—',
               pts: Number(m.poker_pontos) || 0, dev: m.dev || '', prazo: m.entrega || '' };
    };
    var ord = function (a, b) { return (b.pts - a.pts) || String(a.codigo).localeCompare(String(b.codigo)); };
    var planning = vivas.filter(function (m) { return (m.status_planejamento || '') === 'planning'; }).map(monta).sort(ord);
    var semPrazo = vivas.filter(function (m) {
      return ['backlog', 'levantar_req', 'planejado'].indexOf(m.status_planejamento || '') >= 0 && Number(m.poker_pontos) > 0 && !CAPI.diaDoPlano(m);
    }).map(monta).sort(ord);
    return { planning: planning, semPrazo: semPrazo,
             ptsPlanning: planning.reduce(function (t, x) { return t + x.pts; }, 0),
             ptsSemPrazo: semPrazo.reduce(function (t, x) { return t + x.pts; }, 0) };
  }

  /* ── O deck de um assunto: `relPptFaixas`, `relPptAssunto`, `relPptEscopos`,
     `relPptSprint`, `relPptDados`, `relPptNomeArquivo` (admin.html). */
  function relPptFaixas(j) {
    if (j.escala === 'semana') {
      var DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
      var ini = new Date(j.de + 'T00:00:00');
      return [0, 1, 2, 3, 4, 5, 6].map(function (k) {
        var d = isoD(maisDias(ini, k));
        return { de: d, ate: d, rot: DIA[new Date(d + 'T00:00:00').getDay()] };
      });
    }
    var dias = function (a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000) + 1; };
    var faixas = [];
    var cursor = j.de;
    while (cursor <= j.ate) {
      var d = new Date(cursor + 'T00:00:00');
      var dow = d.getDay();
      var fim = isoD(maisDias(d, dow === 0 ? 0 : 7 - dow));
      var ate = fim > j.ate ? j.ate : fim;
      faixas.push({ de: cursor, ate: ate });
      cursor = isoD(maisDias(new Date(ate + 'T00:00:00'), 1));
    }
    var MIN = 3;
    if (faixas.length > 1 && dias(faixas[0].de, faixas[0].ate) < MIN) { faixas[1].de = faixas[0].de; faixas.shift(); }
    var u = faixas.length - 1;
    if (faixas.length > 1 && dias(faixas[u].de, faixas[u].ate) < MIN) { faixas[u - 1].ate = faixas[u].ate; faixas.pop(); }
    return faixas.map(function (f) { return Object.assign({}, f, { rot: String(Number(f.de.slice(8))) + '–' + String(Number(f.ate.slice(8))) }); });
  }
  function relPptAssunto(S, raizF, j) {
    var CAPI = W.CAPACIDADE, FILA = W.FILA;
    var vivas = relVivasDe(S, raizF);
    var saiuEntre = function (m, de, ate) { return FILA.ehEntregaDe(m, de, ate); };
    var nasceuEntre = function (m, de, ate) { var c = String(m.criado_em || '').slice(0, 10); return !!c && c >= de && c <= ate; };
    var entregues = vivas.filter(function (m) { return saiuEntre(m, j.de, j.ate); });
    var pontos = entregues.reduce(function (t, m) { return t + CAPI.entregues(m); }, 0);
    var semPonto = entregues.filter(function (m) { return !CAPI.entregues(m); }).length;
    var entregasAnt = vivas.filter(function (m) { return saiuEntre(m, j.deAnt, j.ateAnt); }).length;
    var entraram = vivas.filter(function (m) { return nasceuEntre(m, j.de, j.ate); }).length;
    var entraramAnt = vivas.filter(function (m) { return nasceuEntre(m, j.deAnt, j.ateAnt); }).length;
    var emAberto = vivas.filter(function (m) { return !FILA.saida(m); });
    var abertoComPrazo = emAberto.filter(function (m) { return CAPI.diaDoPlano(m); }).length;
    var faixas = relPptFaixas(j).map(function (f) {
      var linha = CAPI.porFaixa(vivas, [f])[0] || { plan: 0, entregue: 0 };
      return { rot: f.rot, de: f.de, ate: f.ate, plan: linha.plan, entregue: linha.entregue };
    });
    var plan = faixas.reduce(function (t, f) { return t + f.plan; }, 0);
    var maiores = entregues.map(function (m) {
      return { pts: CAPI.entregues(m), codigo: m.codigo || '', titulo: m.titulo || '(sem título)', data: fmt(CAPI.diaDaEntrega(m)), dev: m.dev || '' };
    }).sort(function (a, b) { return b.pts - a.pts || String(a.data).localeCompare(String(b.data)) || String(a.codigo).localeCompare(String(b.codigo)); });
    var modMap = new Map();
    entregues.forEach(function (m) {
      var t = ((S || {}).temas || []).find(function (x) { return x.id === m.tema_id; });
      var nomeTema = t ? String(t.nome) : '';
      var rz = raizF || relRaizDe(S, m);
      var rot = nomeTema;
      if (rz && nomeTema.indexOf(rz) === 0) rot = nomeTema.slice(rz.length).replace(/^\s*-\s*/, '');
      if (!rot) rot = String(rz).split(' - ').pop() || '—';
      var a = modMap.get(rot) || { pts: 0, qtd: 0 };
      a.pts += CAPI.entregues(m); a.qtd += 1;
      modMap.set(rot, a);
    });
    var modulos = Array.from(modMap.entries()).map(function (e) { return { nome: e[0], pts: e[1].pts, qtd: e[1].qtd }; })
      .sort(function (a, b) { return b.pts - a.pts || b.qtd - a.qtd; });
    var vem = relOQueVemDe(S, raizF);
    var naFila = vem.planning.length + vem.semPrazo.length;
    var curtoAnt = j.escala === 'semana' ? 'a semana anterior' : 'o mês anterior';
    var delta = function (agora, ant) {
      if (!ant && !agora) return '';
      var d = agora - ant;
      if (d === 0) return 'igual a ' + curtoAnt + ' (' + ant + ')';
      return (d > 0 ? '+' : '−') + Math.abs(d) + ' vs. ' + curtoAnt + ' (' + ant + ')';
    };
    var dif = entraram - entregues.length;
    var notaPe = 'Entraram ' + entraram + ' e saíram ' + entregues.length + ': ' +
      (dif > 0 ? 'a fila cresceu em ' + dif + '.' : dif < 0 ? 'a fila encurtou em ' + Math.abs(dif) + '.' : 'a fila ficou do mesmo tamanho.');
    if (semPonto) {
      notaPe += '  ' + semPonto + (semPonto === 1 ? ' entrega saiu sem pontuação e não soma' : ' entregas saíram sem pontuação e não somam') + ' na coluna de pontos.';
    }
    var hojeFila = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    var emCurso = hojeFila >= j.de && hojeFila < j.ate;
    var corteFila = emCurso ? hojeFila : j.ate;
    var fluxo = FILA.fluxo(vivas, j.de, corteFila, j.ate);
    fluxo.corte = fmt(corteFila);
    fluxo.emCurso = emCurso;
    var fAnt = FILA.fluxo(vivas, j.deAnt, j.ateAnt, j.ateAnt);
    var anterior = {
      nome: j.escala === 'semana' ? 'a semana anterior' : String(j.rotAnt || '').split(' de ')[0],
      parcial: emCurso, backlogInicio: fAnt.backlogInicio, recebidas: fAnt.recebidas, saidas: fAnt.saidas, backlogFim: fAnt.backlogFim
    };
    var frentes = F().apresPipelines(S, entregues, j.de, j.ate);
    var porDevPts = F().cortePontosPorDev(entregues, function (dv) { return String(dv || '').split(/[\/,]/).map(function (x) { return x.trim(); }).filter(Boolean); });
    var pontosDev = { total: Object.keys(porDevPts).reduce(function (t, k) { return t + porDevPts[k]; }, 0), porDev: porDevPts };
    var nome = raizF || 'Todos os sistemas';
    return {
      raiz: raizF, nome: nome, periodo: j.rot, fluxo: fluxo, anterior: anterior, frentes: frentes, pontosDev: pontosDev,
      sub: entregues.length + (entregues.length === 1 ? ' entrega' : ' entregas') + ' · ' + pontos + (pontos === 1 ? ' ponto' : ' pontos') + ' · ' + j.rot,
      entregas: entregues.length, pontos: pontos, entraram: entraram, aberto: emAberto.length,
      deltaEntregas: delta(entregues.length, entregasAnt) || (entregues.length === 1 ? 'demanda concluída' : 'demandas concluídas'),
      notaPontos: plan ? 'plano de ' + plan + ' pt · ' + CAPI.rotulo(plan, pontos) : 'sem plano registrado no período',
      notaEntraram: delta(entraram, entraramAnt) || 'pedidos novos registrados',
      notaAberto: abertoComPrazo + ' com prazo definido',
      notaPe: notaPe,
      faixas: faixas,
      rotFaixas: (j.escala === 'semana' ? 'PONTOS ENTREGUES POR DIA' : 'PONTOS ENTREGUES POR SEMANA'),
      maiores: maiores, modulos: modulos,
      planning: vem.planning, semPrazo: vem.semPrazo, ptsSemPrazo: vem.ptsSemPrazo,
      abertoSemEtapa: Math.max(0, emAberto.length - naFila),
      remate: emAberto.length + ' em aberto hoje — ' + vem.planning.length + ' em Planning e ' + vem.semPrazo.length + ' pontuadas sem prazo.  ' + notaPe
    };
  }
  var REL_PPT_TOP = 5;
  function relPptEscopos(S, j) {
    var CAPI = W.CAPACIDADE;
    var cont = new Map();
    relVivasDe(S, '').forEach(function (m) {
      var k = relRaizDe(S, m);
      var a = cont.get(k) || { pts: 0, ent: 0, entrou: 0, aberto: 0 };
      var d = CAPI.diaDaEntrega(m);
      var sp = String(m.status_planejamento || '');
      if (d && d >= j.de && d <= j.ate && CAPI.ETAPAS_ENTREGUE.indexOf(sp) >= 0) { a.ent += 1; a.pts += CAPI.entregues(m); }
      var c = String(m.criado_em || '').slice(0, 10);
      if (c && c >= j.de && c <= j.ate) a.entrou += 1;
      if (CAPI.ETAPAS_ENTREGUE.indexOf(sp) < 0) a.aberto += 1;
      cont.set(k, a);
    });
    return Array.from(cont.entries()).map(function (e) { return Object.assign({ nome: e[0] }, e[1]); })
      .filter(function (v) { return v.ent || v.entrou || v.aberto; })
      .sort(function (a, b) { return b.pts - a.pts || b.ent - a.ent || String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
  }
  /** `relPptSprint` (admin.html). `trilha` e o `_sprTrilha` da origem, que
   *  nasce 'tecnologia'. */
  function relPptSprint(S, j, trilha) {
    var SP = W.SPRINTPO, PRAZO = W.PRAZO;
    if (!j || j.escala !== 'sprint' || !SP) return null;
    trilha = trilha || 'tecnologia';
    var etapa = function (m) { return W.ETAPA.gravada(m); };
    var p = SP.placarDaSprint(S, j.sprint, etapa, trilha);
    if (!p.total) return null;
    var rk = SP.rankingDaSprint(S, j.sprint, etapa, trilha);
    var ac = SP.acompanhamentoDaSprint(S, j.sprint, etapa, PRAZO.hojeISO(), PRAZO, trilha);
    var sit = SP.situacaoDaSprint(S, j.sprint);
    var ROT = { montando: 'ainda em montagem', em_curso: 'em curso', fechada: 'fechada' };
    return {
      rotulo: SP.rotuloCurto(j.sprint) + (trilha === 'tecnologia' ? '' : ' · ' + (SP.TRILHAS.find(function (t) { return t.k === trilha; }) || {}).nome),
      sub: j.rot.replace(/^\S+\s*/, '').replace(/^\(|\)$/g, '') + '  ·  ' + ROT[sit],
      total: p.total, validados: p.validados, aguardando: p.aguardando, saiu: p.saiu,
      pontosTotal: p.pontosTotal, pontosValidados: p.pontosValidados, pct: p.pct, pctPontos: p.pctPontos,
      temDupla: rk.some(function (d) { return d.dupla; }),
      ranking: rk.map(function (d) { return { nome: d.nome, validados: d.validados, total: d.total, pontos: d.pontos, pct: d.pct }; }),
      risco: ac.filter(function (x) { return x.riscos.length; }).map(function (x) {
        return { codigo: x.m.codigo || x.m.id, titulo: x.m.titulo || '', motivos: x.riscos.map(function (r) { return r.texto; }).join(' · ') };
      })
    };
  }
  function relPptDados(S, escopo, j, comBacklog, trilha) {
    var base = {
      periodo: j.rot, subtitulo: 'Audax Capital · Tecnologia',
      escopo: escopo ? 'assunto' : 'consolidado',
      backlog: comBacklog ? relBacklogDe(S, escopo) : null,
      sprint: relPptSprint(S, j, trilha)
    };
    if (escopo) return Object.assign(base, { rotuloCapa: 'RELATÓRIO DE', tituloCapa: escopo, assunto: relPptAssunto(S, escopo, j) });
    var geral = relPptAssunto(S, '', j);
    geral.nome = 'O período em números';
    var rank = relTemasDe(S, '', j).itens;
    var topo = rank.slice(0, REL_PPT_TOP), sobra = rank.slice(REL_PPT_TOP);
    return Object.assign(base, {
      rotuloCapa: 'CONSOLIDADO DE', tituloCapa: 'TECNOLOGIA', geral: geral,
      ranking: rank.slice(0, 10), rankingSobra: Math.max(0, rank.length - 10),
      rankingSobraPts: rank.slice(10).reduce(function (t, x) { return t + x.pts; }, 0),
      assuntos: topo.map(function (r) { return relPptAssunto(S, r.nome, j); }),
      semSobra: sobra.length
    });
  }
  function relPptNomeArquivo(escopo, j) {
    var limpa = function (t) {
      return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
    };
    var quando = j.escala === 'sprint' ? limpa(W.SPRINTPO.rotuloCurto(j.sprint)) : j.escala === 'semana' ? j.de : j.de.slice(0, 7);
    return 'relatorio-' + (escopo ? limpa(escopo) : 'consolidado') + '-' + quando + '.pptx';
  }
  /** As linhas da previa (`relPptPrevia`, admin.html). */
  function relPptPrevia(d, escopo) {
    var linhas;
    if (escopo) {
      var t = d.assunto, comModulos = (t.modulos || []).length > 1;
      linhas = [['Slides', (comModulos ? 5 : 4) + ' + capa'], ['Entregas no período', t.entregas + ' · ' + t.pontos + ' pt'],
        ['Entraram / em aberto', t.entraram + ' / ' + t.aberto], ['O que vem', t.planning.length + ' em Planning · ' + t.semPrazo.length + ' pontuadas sem prazo']];
      if (!comModulos) linhas.push(['Sem quebra por módulo', 'o assunto tem um módulo só — a barra de 100% não entra']);
    } else {
      linhas = [['Slides', (3 + d.assuntos.length) + ' + capa'], ['Assuntos resumidos', d.assuntos.map(function (a) { return a.nome; }).join(', ') || '—'],
        ['No período', d.geral.entregas + ' entregas · ' + d.geral.pontos + ' pt · ' + d.geral.entraram + ' entraram']];
    }
    if (d.backlog) {
      var b = d.backlog;
      linhas.splice(1, 0, ['Backlog (1 slide a mais)', b.total
        ? b.total + (b.total === 1 ? ' demanda' : ' demandas') + (b.pontos ? ' · ' + b.pontos + ' pt' : ' · sem pontuação') +
          (b.maisVelha != null ? ' · a mais antiga há ' + b.maisVelha + ' dias' : '')
        : 'nada parado — o slide não entra']);
      if (b.total && linhas[0] && linhas[0][0] === 'Slides') linhas[0][1] = String(linhas[0][1]).replace(/^(\d+)/, function (n) { return String(Number(n) + 1); });
    }
    return linhas;
  }

  /* ── A ata: `relDados`, `relSistemaModulo`, `relAgrupaPorTema`, `relTexto`
     (admin.html). `o` = { j, raiz, soResumo, secao, trilha }. */
  function relDados(S, j, raizF) {
    var A = j.de, B = j.ate, C = j.de, D = j.ate;
    var visiveis = relVivasDe(S, raizF);
    var dataSaida = function (m) { return W.CAPACIDADE.diaDaEntrega(m) || m.entrega || ''; };
    var entregues = visiveis.filter(function (m) {
      return ['validacao', 'concluido'].indexOf(m.status_planejamento || '') >= 0 || m.status === 'concluida'
        ? (dataSaida(m) >= C && dataSaida(m) <= D && !!dataSaida(m)) : false;
    });
    var semDataConcluidos = visiveis.filter(function (m) { return (m.status_planejamento === 'concluido' || m.status === 'concluida') && !dataSaida(m); }).length;
    var andamento = visiveis.filter(function (m) {
      var sp = m.status_planejamento || '';
      if (sp !== 'em_andamento' && W.ETAPA.efetiva(m) !== 'atrasado') return false;
      var ini = m.inicio || m.entrega, fim = m.entrega || m.inicio;
      if (!ini || !fim) return sp === 'em_andamento';
      return ini <= B && fim >= A;
    });
    var ordEnt = entregues.slice().sort(function (a, b) { return (a.entrega || '').localeCompare(b.entrega || ''); });
    var ordAnd = andamento.slice().sort(function (a, b) { return (a.entrega || '9999').localeCompare(b.entrega || '9999'); });
    return { A: A, B: B, C: C, D: D, janela: j, entregues: ordEnt, andamento: ordAnd, semDataConcluidos: semDataConcluidos };
  }
  function parseTemaNome(nome) {
    var i = (nome || '').indexOf(' - ');
    return i < 0 ? { sistema: (nome || '').trim(), modulo: '' } : { sistema: nome.slice(0, i).trim(), modulo: nome.slice(i + 3).trim() };
  }
  function relSistemaModulo(S, m) {
    var t = ((S || {}).temas || []).find(function (x) { return x.id === m.tema_id; });
    if (!t) return { sistema: '—', modulo: '', completo: '—' };
    var p = parseTemaNome(t.nome);
    return { sistema: p.sistema || t.nome, modulo: p.modulo, completo: p.modulo ? p.sistema + ' - ' + p.modulo : (p.sistema || t.nome) };
  }
  function relAgrupaPorTema(S, lista) {
    var grupos = new Map();
    lista.forEach(function (m) {
      var k = m.tema_id ? relRaizDe(S, m) : 'Sem tema';
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(m);
    });
    var pts = function (m) { return Number(m.poker_pontos) || 0; };
    var saida = function (m) { return (W.CAPACIDADE ? W.CAPACIDADE.diaDaEntrega(m) : '') || m.entrega || ''; };
    return Array.from(grupos.entries()).map(function (e) {
      return { nome: e[0], itens: e[1].slice().sort(function (a, b) {
        return pts(b) - pts(a) || String(saida(a)).localeCompare(String(saida(b))) || String(a.codigo || '').localeCompare(String(b.codigo || ''));
      }) };
    }).sort(function (a, b) { return b.itens.length - a.itens.length || String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
  }
  function padE(s, n) { return String(s).padEnd(n); }
  function relTexto(S, o) {
    var secao = o.secao || '', janela = o.j, raizF = o.raiz || '';
    var r0 = relDados(S, janela, raizF);
    var A = r0.A, B = r0.B, entregues = r0.entregues, andamento = r0.andamento;
    var bloco = function (m, modo) {
      var sm = relSistemaModulo(S, m);
      var linhas = ['• ' + (m.titulo || '(sem título)'), '  Sistema/Módulo: ' + sm.completo];
      if (m.dev) linhas.push('  Dev: ' + m.dev);
      linhas.push(modo === 'entregues'
        ? '  Entrega: ' + (m.entrega ? fmt(m.entrega) : '—')
        : '  Prazo: ' + (m.entrega ? fmt(m.entrega) : '—') + (W.ETAPA.efetiva(m) === 'atrasado' ? ' (atrasado)' : ''));
      var impl = F().resumoDaEntrega(m, !!o.soResumo);
      linhas.push('  Entrega: ' + (impl || '(sem resumo da entrega)'));
      return linhas.join('\n');
    };
    var porTema = function (lista, modo) {
      return relAgrupaPorTema(S, lista).map(function (g) {
        return '[' + g.nome + '] — ' + g.itens.length + '\n' + g.itens.map(function (m) { return bloco(m, modo); }).join('\n\n');
      }).join('\n\n');
    };
    var partes = [];
    if (!secao) {
      partes.push(janela.escala === 'mes' ? 'FECHAMENTO DE ' + String(janela.rot).toUpperCase()
        : janela.escala === 'sprint' ? 'SPRINT ' + String(janela.rot).toUpperCase()
        : 'REUNIÃO DE ' + fmt(A) + ' A ' + fmt(B));
      if (raizF) partes.push('Sistema: ' + raizF);
      var spAta = relPptSprint(S, janela, o.trilha);
      if (spAta) {
        partes.push('');
        partes.push('PLACAR DA SPRINT — ' + spAta.rotulo + ' (' + spAta.sub + ')');
        partes.push('  Validados pelo PM/PO: ' + spAta.validados + ' de ' + spAta.total + '   (' + spAta.pct + '% por item' +
          (spAta.pctPontos === null ? '' : ', ' + spAta.pctPontos + '% por ponto') + ')');
        partes.push('  Pontos:               ' + spAta.pontosValidados + ' de ' + spAta.pontosTotal);
        if (spAta.aguardando) partes.push('  Esperando validacao:  ' + spAta.aguardando);
        if (spAta.saiu) partes.push('  Sairam sem entregar:  ' + spAta.saiu);
        spAta.ranking.forEach(function (d) { partes.push('    - ' + d.nome + ': ' + d.validados + ' de ' + d.total + ' (' + d.pct + '%), ' + d.pontos + ' pt'); });
        if (spAta.risco.length) {
          partes.push('  EM RISCO DE NAO ENTREGAR (' + spAta.risco.length + '):');
          spAta.risco.forEach(function (x) { partes.push('    - ' + x.codigo + ' ' + x.titulo + ' — ' + x.motivos); });
        }
      }
      var r = relComoAndou(S, janela, raizF);
      var CAPI = W.CAPACIDADE;
      partes.push('');
      partes.push('COMO O TIME ANDOU — ' + janela.rot + ' (vs. ' + janela.rotAnt + ')');
      partes.push('  Planejado: ' + r.agora.plan + ' pt   (anterior: ' + r.antes.plan + ')');
      partes.push('  Entregue:  ' + r.agora.entregue + ' pt   (anterior: ' + r.antes.entregue + ')');
      partes.push('  Leitura:   ' + CAPI.rotulo(r.agora.plan, r.agora.entregue) + '   (anterior: ' + CAPI.rotulo(r.antes.plan, r.antes.entregue) + ')');
      partes.push('  Entregas:  ' + r.entregas + '   (anterior: ' + r.entregasAnt + ')');
      if (r.agora.semPontuar) {
        partes.push('  ! ' + r.agora.semPontuar + ' demanda(s) alocada(s) sem pontuacao: o planejado de quem as recebeu esta menor do que e.');
      }
      if (!r.antes.comparavel && r.antes.entregue) {
        partes.push('  ! Comparacao de pontos com o periodo anterior suprimida: ' + r.antes.semPlano + ' dos ' + r.antes.entregue +
          ' pontos de la vieram de demandas sem plano registrado.');
      }
      var t = relTemasDe(S, raizF, janela);
      if (t.itens.length) {
        partes.push('');
        partes.push('ONDE A CAPACIDADE FOI — ' + t.total + ' pt');
        t.itens.slice(0, 8).forEach(function (x) {
          partes.push('  ' + String(x.pts).padStart(4) + ' pt  ' + (t.total ? String(Math.round(x.pts / t.total * 100)).padStart(3) + '%' : '   ') + '  ' + x.nome);
        });
      }
      partes.push('');
    }
    var rotEnt = janela.escala === 'mes' ? janela.rot : fmt(A) + ' a ' + fmt(B);
    if (secao !== 'andamento' && secao !== 'vem' && secao !== 'backlog') {
      partes.push('ENTREGUES — ' + rotEnt + ' — ' + entregues.length);
      partes.push(entregues.length ? porTema(entregues, 'entregues') : '(nenhuma)');
    }
    if (secao !== 'entregues' && secao !== 'vem' && secao !== 'backlog') {
      if (partes.length) partes.push('');
      partes.push('EM DESENVOLVIMENTO — ' + rotEnt + ' — ' + andamento.length);
      partes.push(andamento.length ? porTema(andamento, 'andamento') : '(nenhuma)');
    }
    if (!secao || secao === 'vem') {
      var v = relOQueVemDe(S, raizF);
      if (v.planning.length || v.semPrazo.length) {
        if (partes.length) partes.push('');
        partes.push('O QUE VEM (na data desta ata)');
        if (v.planning.length) {
          partes.push('  Em Planning — ' + v.planning.length + (v.ptsPlanning ? ' (' + v.ptsPlanning + ' pt ja estimados)' : ''));
          v.planning.forEach(function (x) { partes.push('    ' + padE(x.codigo || '—', 9) + (x.pts ? String(x.pts).padStart(3) + ' pt  ' : '  —    ') + x.titulo); });
        }
        if (v.semPrazo.length) {
          partes.push('  Pontuadas, falta planejar — ' + v.semPrazo.length + ' (' + v.ptsSemPrazo + ' pt)');
          v.semPrazo.forEach(function (x) { partes.push('    ' + padE(x.codigo || '—', 9) + String(x.pts).padStart(3) + ' pt  ' + x.titulo); });
        }
      }
    }
    if (!secao || secao === 'backlog') {
      var b = relBacklogDe(S, raizF);
      if (b.total) {
        if (partes.length) partes.push('');
        partes.push('BACKLOG (na data desta ata) — ' + b.total + (b.pontos ? ' · ' + b.pontos + ' pt ja estimados' : ''));
        partes.push('  Etapas Backlog e Em aprovação de requisitos: sem data combinada.' + (b.maisVelha != null ? ' A mais antiga espera ha ' + b.maisVelha + ' dias.' : ''));
        b.itens.forEach(function (x) {
          partes.push('    ' + padE(x.codigo || '—', 9) + (x.dias == null ? '   —  ' : String(x.dias).padStart(4) + 'd ') +
            (x.pts ? String(x.pts).padStart(3) + ' pt  ' : '   ·   ') + x.titulo);
        });
      }
    }
    return partes.join('\n');
  }

  /* ── A base do mes em CSV: `csvBaseDoMes` e `csvTexto` (admin.html). Uma
     linha por demanda x pessoa, virgula, ponto decimal e BOM. */
  function csvBaseDoMes(S, de, ate) {
    var api = W.PIPELINES, FE = F();
    var perfis = (S || {}).devs_perfil || {};
    var vivas = ((S || {}).melhorias || []).filter(function (m) { return m && !m.oculto && !m.mesclado_em; });
    var conc = vivas.filter(function (m) { return W.FILA.ehEntregaDe(m, de, ate); });
    var ratReal = FE.rateiaHoras(S, conc, function (m) { return { de: String(m.inicio || '').slice(0, 10), ate: String(m.concluido_em || m.entrega || '').slice(0, 10) }; }, de, ate);
    var plan = FE.rateiaHoras(S, conc, function (m) { return { de: String(m.inicio || '').slice(0, 10), ate: String(m.entrega || '').slice(0, 10) }; }, de, ate);
    var dias = function (a, b) {
      var x = Date.parse(String(a || '').slice(0, 10) + 'T00:00:00Z');
      var y = Date.parse(String(b || '').slice(0, 10) + 'T00:00:00Z');
      return (isFinite(x) && isFinite(y) && y >= x) ? Math.round((y - x) / 86400000) : '';
    };
    var TIPO = { evolucao: 'Evolução', sustentacao: 'Sustentação' };
    var PZ = { no_prazo: 'No prazo', atraso: 'Com atraso', sem_prazo: 'Sem prazo combinado', sem_conclusao: 'Sem data de conclusão' };
    var linhas = [];
    conc.forEach(function (m) {
      var devs = api ? api.devsDaDemanda(m) : [];
      var alvos = devs.length ? devs : [''];
      var q = alvos.length;
      var pontos = Number(m.poker_pontos) || 0;
      var hReal = FE.horasDoMes(S, m, de, ate, ratReal);
      var hPlan = plan.get(m.id) || 0;
      var cl = FE.prazoClassifica(m) || {};
      var pj = m.projeto_id ? ((S || {}).projetos || []).find(function (x) { return String(x.id) === String(m.projeto_id); }) : null;
      var tema = ((S || {}).temas || []).find(function (x) { return String(x.id) === String(m.tema_id); });
      alvos.forEach(function (nome) {
        linhas.push({
          demanda_id: m.id || '', codigo: m.codigo || '', titulo: m.titulo || '', sistema: relRaizDe(S, m), tema: tema ? tema.nome : '',
          frente: (nome && api) ? (api.doDev(nome, perfis) || api.NAO_CLASSIFICADO) : (api ? api.NAO_CLASSIFICADO : ''),
          pessoa: nome, pessoas_na_demanda: q, peso: Math.round(1 / q * 10000) / 10000,
          projeto_codigo: pj ? (pj.codigo || '') : '', projeto: pj ? (pj.nome || '') : '',
          tipo: TIPO[String(m.tipo || '')] || '', etapa: m.status_planejamento || '', solicitante: m.solicitante || '', area: m.area || '',
          pontos: pontos, pontos_rateados: Math.round(pontos / q * 100) / 100,
          horas_realizadas: Math.round(hReal * 100) / 100, horas_realizadas_rateadas: Math.round(hReal / q * 100) / 100,
          horas_planejadas: Math.round(hPlan * 100) / 100, horas_planejadas_rateadas: Math.round(hPlan / q * 100) / 100,
          criado_em: String(m.criado_em || '').slice(0, 10), inicio: String(m.inicio || '').slice(0, 10),
          prazo_combinado: String(m.entrega || '').slice(0, 10), concluido_em: String(m.concluido_em || '').slice(0, 10),
          prazo: PZ[String(cl.tipo || '')] || '', dias_atraso: cl.tipo === 'atraso' ? (cl.dias || 0) : 0,
          dias_execucao: dias(m.inicio, m.concluido_em), dias_ate_entregar: dias(m.criado_em, m.concluido_em),
          mes_referencia: String(de).slice(0, 7)
        });
      });
    });
    return linhas;
  }
  function csvTexto(linhas) {
    if (!linhas.length) return '';
    var cols = Object.keys(linhas[0]);
    var cel = function (v) {
      if (v == null) return '';
      var s = String(v);
      return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '\uFEFF' + [cols.join(',')].concat(linhas.map(function (l) { return cols.map(function (c) { return cel(l[c]); }).join(','); })).join('\n');
  }

  var REGRAS_REL = {
    usar: usar, janelaDe: janelaDe, semanasDoSeletor: semanasDoSeletor, sprintsComDados: sprintsComDados,
    relRaizDe: relRaizDe, relVivasDe: relVivasDe, relComoAndou: relComoAndou, relTemasDe: relTemasDe,
    relBacklogDe: relBacklogDe, relOQueVemDe: relOQueVemDe, relPptFaixas: relPptFaixas, relPptAssunto: relPptAssunto,
    relPptEscopos: relPptEscopos, relPptSprint: relPptSprint, relPptDados: relPptDados, relPptNomeArquivo: relPptNomeArquivo,
    relPptPrevia: relPptPrevia, REL_PPT_TOP: REL_PPT_TOP, relDados: relDados, relAgrupaPorTema: relAgrupaPorTema,
    relTexto: relTexto, csvBaseDoMes: csvBaseDoMes, csvTexto: csvTexto
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = REGRAS_REL; return; }
  raiz.AXIS_REL = REGRAS_REL;

  // ══ A TELA ══════════════════════════════════════════════════════════════
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
    { id: 'comite', rot: 'Relatório do comitê', onde: 'AXIS › Relatórios', acao: 'Copiar a ata',
      desc: 'A ata da reunião: escala mês, sprint ou semana, filtro por sistema e o texto de entrega (resumo ou completo). "Copiar a ata" leva o texto pronto para a ata.',
      secoes: ['Como o time andou', 'Onde a capacidade foi', 'Entregues', 'Em desenvolvimento', 'O que vem', 'Backlog'] },
    { id: 'sprint', rot: 'Placar da sprint', onde: 'AXIS › Relatórios (escala sprint)', acao: 'Copiar a ata da sprint',
      desc: 'O compromisso da sprint repassada pelo PM/PO: pontos e itens validados, cumprimento, ranking por dev e o que está em risco.',
      secoes: ['Placar', 'Ranking por dev', 'Em risco de não entregar'] },
    { id: 'deck-mes', rot: 'Apresentação do mês (PPT)', onde: 'AXIS › Fechamento do mês › Apresentação', href: '#fechamento/apresentacao', acao: 'Escolher os slides e gerar',
      desc: 'O deck da reunião de resultados, em atos: o mês, a evolução, as frentes, os pontos e o prazo. Sai da apuração congelada quando o mês está congelado.',
      secoes: null },
    { id: 'deck-assunto', rot: 'Deck de um assunto (PPT)', onde: 'AXIS › Relatórios', acao: 'Gerar PPT',
      desc: 'O deck de um sistema (ou o consolidado dos cinco maiores): o panorama, a forma do período e o que vem. Escala mês, sprint ou semana.',
      secoes: ['Capa', 'O período em números', 'Ranking dos sistemas', 'Um resumo por assunto (até 5)', 'Placar da sprint (na escala sprint)', 'Backlog (opcional)'] },
    { id: 'csv', rot: 'Base do mês (CSV)', onde: 'AXIS › Relatórios e Painéis', acao: 'Baixar CSV',
      desc: 'Uma linha por demanda × pessoa, com sistema, frente, projeto, pontos (cheios e rateados), horas, datas e prazo. Para o Excel ou para quem não tem acesso.',
      secoes: ['Demanda e pessoa', 'Sistema, frente e projeto', 'Pontos cheios e rateados', 'Horas do mês', 'Datas e prazo'] },
    { id: 'ppt-projetos', rot: 'Projetos em andamento (PPT)', onde: 'AXIS › Projetos › Em andamento', ppt: 'projetos', acao: 'Gerar PPT',
      desc: 'Os projetos com demanda aberta na sprint atual ou nas próximas: capa, visão geral e um slide por projeto com o que foi feito, o que está em andamento e o planejado, cada um com a data e a sprint.',
      secoes: ['Capa', 'Visão geral dos projetos', 'Um slide por projeto: Feitas, Em andamento e Planejado'] },
    { id: 'ppt-aprovacao', rot: 'Em aprovação de requisitos (PPT)', onde: 'AXIS › Quadro › coluna Em aprovação de requisitos', ppt: 'aprovacao', acao: 'Gerar PPT',
      desc: 'A folha de decisão da etapa: todas as demandas em aprovação de requisitos, com código, título, sistema/módulo, tipo, prioridade, impacto, urgência e quem solicitou, e a coluna Decisão para marcar à caneta se segue ou segura para a sprint.',
      secoes: ['Capa', 'Resumo por impacto e urgência', 'Decisão: as demandas, das que mais pesam para as que menos pesam'] },
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
    // #relatorios/salvos/deck-assunto abre no modelo pedido (o Fechamento leva ate aqui).
    var pedido = String(ctx.param || '').split('/')[0];
    if (MODELOS.some(function (m) { return m.id === pedido; })) _modelo = pedido;
    var r = g.relComoAndou(D, j, ''), t = g.relTemasDe(D, '', j);
    var h = g.cabecalho('Relatórios',
      'Os relatórios que o RoadMap já gera, com os números de ' + esc(g.rotuloMes(alvo)) + '. Todos saem daqui: a ata, o placar, os PPTs e a base do mês em CSV.');
    h += '<div class="gx-g gx-as"><aside class="gx-col-f"><section class="pn" style="gap:4px"><span class="lab" style="padding:0 0 6px">MODELOS</span>' +
      MODELOS.map(function (m) {
        return '<button type="button" class="gx-mod' + (m.id === _modelo ? ' on' : '') + '" data-modelo="' + m.id + '"><span>' + esc(m.rot) + '</span>' +
          '<span class="note" style="font-size:11px">' + (m.ppt || m.id === 'deck-assunto' ? 'PPT' : m.id === 'csv' ? 'CSV' : m.id === 'comite' || m.id === 'sprint' ? 'texto' : m.id === 'deck-mes' ? 'PPT' : 'tela') + '</span></button>';
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
    if (M.id === 'comite') {
      // A ata conta o periodo e o sistema escolhidos abaixo (`relDados`).
      var jr = janelaEscolhida(D), rd = relDados(D, jr, _rf.raiz);
      prev = linhaPrev([['Entregues · ' + jr.rot, H.num(rd.entregues.length)], ['Em desenvolvimento', H.num(rd.andamento.length)],
        ['Concluídas sem data (ficam fora)', H.num(rd.semDataConcluidos)]]);
    } else if (M.id === 'entregues') {
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
    } else if (M.id === 'ppt-projetos') {
      var pa = raiz.AXIS_PROJETOS ? raiz.AXIS_PROJETOS.andamentoPPT() : [];
      var nIt = 0;
      pa.forEach(function (x) { nIt += x.feitas.length + x.andamento.length + x.planejado.length; });
      prev = linhaPrev([['Projetos em andamento', String(pa.length)], ['Atividades com data nos slides', H.num(nIt)]]);
    } else if (M.id === 'ppt-aprovacao') {
      prev = linhaPrev([['Demandas em aprovação de requisitos', H.num(demandasAprovacao().length)]]);
    } else if (M.id === 'time') {
      var r = g.relComoAndou(D, j, '');
      prev = linhaPrev([['Planejado', r.agora.plan + ' pt'], ['Entregue', r.agora.entregue + ' pt'], ['Leitura', raiz.CAPACIDADE.rotulo(r.agora.plan, r.agora.entregue)]]);
    }
    /* O QUE CADA MODELO GERA AQUI. A ata, o placar, o deck de assunto e o CSV
       so leem: saem para quem ve esta tela, como os PPTs de projetos e de
       aprovacao. O deck do mes e escolhido no Fechamento, que e do PM/PO. */
    var painel = '';
    if (M.id === 'comite') painel = painelAta(D);
    else if (M.id === 'sprint') painel = painelPlacar(D);
    else if (M.id === 'deck-assunto') painel = painelAssunto(D);
    else if (M.id === 'csv') {
      painel = '<div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end">' + sel('Mês', 'csv', mesesDoSeletor(), _rf.csv || alvo, 200) + '</div>';
    }
    var botao = M.ppt ? '<button type="button" class="btnp" data-axis-ppt="' + M.ppt + '">' + H.ico('printer') + ' ' + esc(M.acao) + '</button>'
      : M.id === 'comite' || M.id === 'sprint' ? '<button type="button" class="btnp" data-rel-copiar="' + M.id + '">' + H.ico('clipboard') + ' ' + esc(M.acao) + '</button>'
      : M.id === 'deck-assunto' ? '<button type="button" class="btnp" data-rel-assunto="1">' + H.ico('printer') + ' ' + esc(M.acao) + '</button>'
      : M.id === 'csv' ? '<button type="button" class="btnp" data-axis-csv="' + esc(_rf.csv || alvo) + '">' + H.ico('download') + ' ' + esc(M.acao) + '</button>'
      : M.id === 'deck-mes' ? (H.pode('fechar') ? '<a class="btnp" href="' + M.href + '">' + H.ico('present') + ' ' + esc(M.acao) + '</a>' : '<span class="note">Gerado pelo PM/PO no Fechamento do mês.</span>')
      : '<a class="btnp" href="' + M.href + '">' + esc(M.acao) + '</a>';
    return '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:10px">' +
      '<span style="display:flex;flex-direction:column;gap:3px"><h2 class="h2">' + esc(M.rot) + '</h2><span class="note">' + esc(M.onde) + '</span></span>' + botao + '</div>' +
      '<span style="font-size:13.5px;line-height:21px;color:var(--tx2)">' + esc(M.desc) + '</span>' +
      '<div class="gx-g gx-2"><div style="display:flex;flex-direction:column;gap:6px"><span class="lab">O QUE TRAZ</span>' +
        (secoes || []).map(function (s) { return '<span class="gx-sl">' + H.ico('check', 'style="color:var(--ok-t)"') + '<span>' + esc(s) + '</span></span>'; }).join('') +
        (M.id === 'deck-mes' ? '<span class="note">O padrão do fechamento. Além disso: capa, um slide por destaque marcado e o slide final.</span>' : '') + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px"><span class="lab">AGORA</span>' + (prev || '<span class="note">—</span>') + '</div></div>' +
      (painel ? '<div style="display:flex;flex-direction:column;gap:12px;border-top:1px solid var(--bd);padding-top:14px">' + painel + '</div>' : '') + '</section>';
  }
  function linhaPrev(pares) {
    return '<div style="border:1px solid var(--bd);border-radius:12px;overflow:hidden">' + pares.map(function (p, i) {
      return '<div class="row" style="justify-content:space-between;gap:12px;padding:9px 12px;font-size:12.5px' + (i ? ';border-top:1px solid var(--bd)' : '') + '">' +
        '<span class="note ell">' + esc(p[0]) + '</span><b class="mono" style="font-weight:600">' + esc(p[1]) + '</b></div>';
    }).join('') + '</div>';
  }

  // ═══ Os PPTs que saem no app ═══════════════════════════════════════════
  /* IMPRIMIR — EM APROVACAO DE REQUISITOS (`imprimirAprovacaoReq`, admin.html):
     todas as demandas da etapa, e nao so as do recorte do quadro — a folha e
     para decidir a etapa inteira. */
  function demandasAprovacao() {
    return H.visiveis().filter(function (m) { return H.colunaDe(m) === 'levantar_req'; });
  }
  var _gerando = false;
  async function gerarPPT(qual, botao) {
    if (_gerando) return;
    var G2 = qual === 'aprovacao' ? raiz.APROVACAOPPT : raiz.PROJETOSPPT;
    if (!G2) { H.toast('O gerador do PPT não carregou. Recarregue a página (Ctrl+F5).', 'erro'); return; }
    var rot = botao ? botao.innerHTML : '';
    _gerando = true;
    if (botao) { botao.disabled = true; botao.textContent = 'Gerando…'; }
    try {
      if (qual === 'aprovacao') {
        var r1 = await G2.gera(demandasAprovacao(), { temas: (raiz.AXIS_APP.APP.D || {}).temas || [] });
        H.toast('PPT gerado: ' + H.plural(r1.demandas, 'demanda', 'demandas') + ' em aprovação de requisitos.');
      } else {
        var ps = raiz.AXIS_PROJETOS ? raiz.AXIS_PROJETOS.andamentoPPT() : [];
        var r2 = await G2.gera(ps, { hoje: H.hoje(), sprint: raiz.SPRINTPO ? raiz.SPRINTPO.rotuloCurto(H.sprintAtual()) : '' });
        H.toast('PPT gerado: ' + H.plural(r2.projetos, 'projeto', 'projetos') + ' em andamento.');
      }
    } catch (e) {
      H.toast('Não foi possível gerar o PPT: ' + ((e && e.message) || e), 'erro');
    } finally {
      _gerando = false;
      if (botao) { botao.disabled = false; botao.innerHTML = rot; }
    }
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-axis-ppt]');
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      gerarPPT(b.getAttribute('data-axis-ppt'), b);
    });
  }
  raiz.AXIS_PPT = { gerar: gerarPPT, aprovacao: demandasAprovacao };

  // ═══ A ata, o placar, o deck de assunto e o CSV, no app ═════════════════
  /* OS SELETORES DA ABA RELATORIOS DO ADMIN (`relInitControles`, `relEscala`,
     `relMontaSprints`, o filtro de sistema e o de texto) viram este estado. O
     deck de assunto le os mesmos — no admin os dele nascem espelhando os da
     aba, e aqui sao os mesmos de uma vez. */
  var _rf = { escala: 'mes', mes: '', semana: '', sprint: '', raiz: '', texto: 'completo', escopo: '', trilha: 'tecnologia', csv: '', backlog: null };
  function base() { return raiz.AXIS_APP.APP.D || {}; }
  function mesesDoSeletor() {
    var hoje = new Date(), out = [];
    for (var k = -1; k <= 12; k++) {
      var d = new Date(hoje.getFullYear(), hoje.getMonth() - k, 1);
      out.push({ valor: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
                 rot: (raiz.apresentacaoMesNome ? raiz.apresentacaoMesNome(d.getMonth()) : H.MESES[d.getMonth()]) + ' de ' + d.getFullYear() });
    }
    return out;
  }
  /** A sprint escolhida, ou a de agora (`relMontaSprints`): a corrente se tem
   *  dado, senao a mais recente da lista. */
  function sprintEscolhida(S) {
    var lista = sprintsComDados(S);
    var agora = raiz.SPRINTPO.rotuloDeData(raiz.PRAZO.hojeISO(), S.feriados || []);
    return lista.indexOf(_rf.sprint) >= 0 ? _rf.sprint : (lista.indexOf(agora) >= 0 ? agora : lista[0] || '');
  }
  function janelaEscolhida(S, escala) {
    var e = escala || _rf.escala;
    var v = e === 'semana' ? _rf.semana : e === 'sprint' ? sprintEscolhida(S) : (_rf.mes || G().mesCorrente());
    return janelaDe(S, e, v);
  }
  /** O filtro de sistema (`relInitControles`): raizes com demanda, a maior primeiro. */
  function sistemasDoFiltro(S) {
    var cont = new Map();
    (S.melhorias || []).forEach(function (m) {
      if (!m || m.oculto || m.mesclado_em || !m.tema_id) return;
      var k = relRaizDe(S, m);
      cont.set(k, (cont.get(k) || 0) + 1);
    });
    return Array.from(cont.entries()).map(function (e) { return { nome: e[0], n: e[1] }; })
      .sort(function (a, b) { return b.n - a.n || String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
  }
  function sel(rot, chave, opcoes, valor, larg) {
    return campo(rot, '<select class="in" data-rf="' + chave + '" style="height:36px;max-width:' + (larg || 240) + 'px">' + opcoes.map(function (o) {
      return '<option value="' + esc(o.valor) + '"' + (o.valor === valor ? ' selected' : '') + '>' + esc(o.rot) + '</option>';
    }).join('') + '</select>');
  }
  /** Escala e periodo, com o seletor de cada escala (`relTrocaEscala`: um
   *  grupo visivel por vez). `fixa` prende a escala (o placar e de sprint). */
  function controlesPeriodo(S, fixa) {
    var e = fixa || _rf.escala;
    var h = fixa ? '' : sel('Escala', 'escala', [{ valor: 'mes', rot: 'Mês (fechamento)' }, { valor: 'sprint', rot: 'Sprint (do PM/PO)' }, { valor: 'semana', rot: 'Semana (calendário)' }], e, 190);
    if (e === 'sprint') {
      var agora = raiz.SPRINTPO.rotuloDeData(raiz.PRAZO.hojeISO(), S.feriados || []);
      h += sel('Sprint', 'sprint', sprintsComDados(S).map(function (r) {
        return { valor: r, rot: raiz.SPRINTPO.rotuloCurto(r) + (r === agora ? '  · agora' : '') + (raiz.SPRINTPO.estaFechada(S, r) ? '  · fechada' : '') };
      }), sprintEscolhida(S), 180);
    } else if (e === 'semana') {
      h += sel('Reunião da semana de', 'semana', semanasDoSeletor(), _rf.semana || semanasDoSeletor()[0].valor, 260);
    } else {
      h += sel('Mês', 'mes', mesesDoSeletor(), _rf.mes || G().mesCorrente(), 200);
    }
    return h;
  }
  function textoAta(S, escala) {
    return relTexto(S, { j: janelaEscolhida(S, escala), raiz: _rf.raiz, soResumo: _rf.texto === 'resumo', secao: '', trilha: _rf.trilha });
  }
  /** `copiarRelatorio` (admin.html): area de transferencia; sem ela, o texto
   *  selecionado num campo; sem isso, uma janela com o texto para copiar a mao. */
  async function copiar(txt) {
    try {
      await navigator.clipboard.writeText(txt);
      H.toast('Relatório copiado — cole na ata do comitê.');
    } catch (_) {
      var ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.cssText = 'position:fixed;top:10%;left:50%;transform:translateX(-50%);width:min(700px,90vw);height:60vh;z-index:999;font-family:monospace;font-size:12px';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (_2) {}
      ta.remove();
      H.toast(ok ? 'Relatório copiado.' : 'Não foi possível copiar automaticamente — copie do texto exibido.', ok ? '' : 'erro');
      if (!ok) { var w = window.open('', '_blank'); if (w) { w.document.body.style.cssText = 'white-space:pre-wrap;font-family:monospace;padding:20px'; w.document.body.textContent = txt; } }
    }
  }
  function painelAta(S) {
    var sis = sistemasDoFiltro(S);
    var txt = textoAta(S);
    return '<div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end">' + controlesPeriodo(S) +
      sel('Sistema', 'raiz', [{ valor: '', rot: 'Todos os sistemas' }].concat(sis.map(function (t) { return { valor: t.nome, rot: t.nome + '  (' + t.n + ')' }; })), _rf.raiz, 240) +
      sel('Texto da entrega', 'texto', [{ valor: 'completo', rot: 'Resumo, ou o completo' }, { valor: 'resumo', rot: 'Só o resumo' }], _rf.texto, 200) + '</div>' +
      '<pre class="rl-pre" id="rl-ata">' + esc(txt) + '</pre>' +
      '<span class="note">' + H.num(txt.split('\n').length) + ' linhas. O mesmo texto do "Copiar tudo" da aba Relatórios do admin: o placar entra na escala de sprint; o que vem e o backlog, na data de hoje.</span>';
  }
  function painelPlacar(S) {
    var j = janelaEscolhida(S, 'sprint');
    var p = relPptSprint(S, j, _rf.trilha);
    var trilhas = (raiz.SPRINTPO.TRILHAS || []).map(function (t) { return { valor: t.k, rot: t.nome }; });
    var h = '<div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end">' + controlesPeriodo(S, 'sprint') + sel('Trilha', 'trilha', trilhas, _rf.trilha, 180) + '</div>';
    if (!p) return h + H.vazio('refresh', 'Nenhuma demanda nesta sprint', 'O placar nasce quando o PM/PO repassa demandas para a sprint.');
    var g = G();
    h += '<div class="gx-g gx-k4">' +
      g.k('Validados pelo PM/PO', p.validados + ' de ' + p.total, p.pct + '% por item', g.corPct(p.pct)) +
      g.k('Pontos validados', p.pontosValidados + ' de ' + p.pontosTotal, p.pctPontos === null ? 'sem pontos na sprint' : p.pctPontos + '% por ponto', g.corPct(p.pctPontos)) +
      g.k('Esperando validação', H.num(p.aguardando), 'entregues pelo dev', p.aguardando ? 'var(--wn-t)' : '') +
      g.k('Saíram sem entregar', H.num(p.saiu), 'contam no total', p.saiu ? 'var(--dg-t)' : '') + '</div>' +
      '<span class="note">' + esc(p.rotulo + ' · ' + p.sub) + (p.temDupla ? ' · demanda de dupla conta para os dois' : '') + '</span>';
    h += p.ranking.length ? '<div class="gx-tw"><table class="tbl"><thead><tr><th>DEV</th><th class="num">VALIDADOS</th><th class="num">PONTOS</th><th class="num">%</th></tr></thead><tbody>' +
      p.ranking.map(function (d) {
        return '<tr><td style="color:var(--tx)">' + esc(d.nome) + '</td><td class="num mono">' + d.validados + ' / ' + d.total + '</td><td class="num mono">' + d.pontos + '</td><td class="num">' + g.chipPct(d.pct) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '';
    h += '<span class="lab">EM RISCO DE NÃO ENTREGAR · ' + p.risco.length + '</span>' + (p.risco.length ? p.risco.slice(0, 12).map(function (x) {
      return '<div class="gx-al"><span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:13px;font-weight:700"><span class="code" style="margin-right:6px">' + esc(x.codigo) + '</span>' + esc(x.titulo) + '</span>' +
        '<span class="note" style="font-size:12px">' + esc(x.motivos) + '</span></span></div>';
    }).join('') + (p.risco.length > 12 ? '<span class="note">e mais ' + (p.risco.length - 12) + ' — a lista inteira vai na ata da sprint.</span>' : '') : '<span class="note">Nada em risco agora.</span>');
    return h;
  }
  function backlogLembrado() {
    if (_rf.backlog === null) { try { _rf.backlog = localStorage.getItem('rm_ppt_backlog') === '1'; } catch (_) { _rf.backlog = false; } }
    return _rf.backlog;
  }
  function painelAssunto(S) {
    var j = janelaEscolhida(S);
    var escopos = relPptEscopos(S, j);
    if (_rf.escopo && !escopos.some(function (e) { return e.nome === _rf.escopo; })) _rf.escopo = '';
    var linhas;
    try { linhas = relPptPrevia(relPptDados(S, _rf.escopo, j, backlogLembrado(), _rf.trilha), _rf.escopo); }
    catch (e) { linhas = [['Não consegui montar a prévia', (e && e.message) || String(e)]]; }
    return '<div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end">' + controlesPeriodo(S) +
      sel('Escopo', 'escopo', [{ valor: '', rot: 'Consolidado — os ' + REL_PPT_TOP + ' maiores assuntos' }].concat(escopos.map(function (e) {
        return { valor: e.nome, rot: e.nome + '  (' + e.ent + ' entregas · ' + e.pts + ' pt)' };
      })), _rf.escopo, 320) + '</div>' +
      '<label class="row fc-ck" style="gap:10px;cursor:pointer"><input type="checkbox" data-rf-backlog="1"' + (backlogLembrado() ? ' checked' : '') + ' style="accent-color:var(--ac);width:16px;height:16px;margin:0">' +
        '<span style="display:flex;flex-direction:column"><b style="font-size:13px">Incluir o backlog</b><span class="note">Um slide a mais, com o que está parado em Backlog e Em aprovação de requisitos. A escolha fica lembrada.</span></span></label>' +
      '<span class="lab">O QUE VAI SAIR</span>' + linhaPrev(linhas);
  }
  var _gerandoRel = false;
  async function gerarAssunto(botao) {
    if (_gerandoRel) return;
    if (!raiz.relatorioPptMonta) { H.toast('O gerador do PPT não carregou. Recarregue a página (Ctrl+F5).', 'erro'); return; }
    _gerandoRel = true;
    var rot = botao ? botao.innerHTML : '';
    if (botao) { botao.disabled = true; botao.textContent = 'Gerando…'; }
    try {
      var S = base(), j = janelaEscolhida(S);
      var pptx = await raiz.relatorioPptMonta(relPptDados(S, _rf.escopo, j, backlogLembrado(), _rf.trilha));
      var nome = relPptNomeArquivo(_rf.escopo, j);
      await pptx.writeFile({ fileName: nome });
      H.toast(nome + ' gerado.');
    } catch (e) {
      H.toast('Não consegui gerar: ' + ((e && e.message) || e), 'erro');
    } finally {
      _gerandoRel = false;
      if (botao && botao.isConnected) { botao.disabled = false; botao.innerHTML = rot; }
    }
  }
  /** `baixarCsvDoMes` (admin.html): a base de um mes, `roadmap-AAAA-MM.csv`. */
  function baixarCsvDoMes(alvo, botao) {
    var rot = botao ? botao.innerHTML : '';
    if (botao) { botao.disabled = true; botao.textContent = 'Montando…'; }
    try {
      var g = G(), L = g.limites(alvo);
      var linhas = csvBaseDoMes(base(), L.de, L.ate);
      if (!linhas.length) { H.toast('Nenhuma entrega no período — o arquivo sairia vazio.', 'erro'); return; }
      var nome = 'roadmap-' + alvo + '.csv';
      var url = URL.createObjectURL(new Blob([csvTexto(linhas)], { type: 'text/csv;charset=utf-8' }));
      var a = document.createElement('a');
      a.href = url; a.download = nome;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      var dem = new Set(linhas.map(function (l) { return l.demanda_id; })).size;
      H.toast(nome + ': ' + dem + ' demandas em ' + linhas.length + ' linhas.');
    } catch (e) {
      H.toast('Não consegui gerar o CSV: ' + ((e && e.message) || e), 'erro');
    } finally {
      if (botao) { botao.disabled = false; botao.innerHTML = rot; }
    }
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-axis-csv]');
      if (!b) return;
      e.preventDefault();
      baixarCsvDoMes(b.getAttribute('data-axis-csv') || G().mesCorrente(), b);
    });
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
      '<button type="button" class="btn" data-rel-copiar="mes" data-alvo="' + alvo + '">' + H.ico('clipboard') + ' Copiar a ata</button>',
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

  function cssRel() {
    if (typeof document === 'undefined' || document.getElementById('css-tela-relatorios')) return;
    var st = document.createElement('style');
    st.id = 'css-tela-relatorios';
    st.textContent = '.axa .rl-pre{margin:0;padding:14px;border-radius:12px;background:var(--side);border:1px solid var(--bd);font-family:var(--font-mono,monospace);font-size:11.5px;line-height:18px;color:var(--tx2);white-space:pre-wrap;word-break:break-word;overflow:auto;max-height:380px}' +
      '.axa .fc-ck input{accent-color:var(--ac)}';
    document.head.appendChild(st);
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
      G().css(); cssRel();
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
        if (e.target.closest('[data-raiz-time]')) { _raizTime = e.target.value; raiz.AXIS_APP.desenhar(); return; }
        // Os seletores da ata, do placar, do deck de assunto e do CSV: o
        // painel do modelo se redesenha com o periodo novo.
        var rf = e.target.closest('[data-rf]');
        var bk = e.target.closest('[data-rf-backlog]');
        if (rf || bk) {
          if (rf) _rf[rf.getAttribute('data-rf')] = rf.value;
          if (bk) { _rf.backlog = bk.checked; try { localStorage.setItem('rm_ppt_backlog', bk.checked ? '1' : '0'); } catch (_) {} }
          var box = el.querySelector('#rl-modelo');
          if (box) box.innerHTML = modelo(ctx);
        }
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
        if (e.target.closest('[data-csv]')) { baixarCsv(ctx); return; }
        var cp = e.target.closest('[data-rel-copiar]');
        if (cp) {
          var qual = cp.getAttribute('data-rel-copiar');
          if (qual === 'mes') {
            // "Como o time andou": a ata do mes da tela, com o sistema da tela.
            copiar(relTexto(base(), { j: janelaDe(base(), 'mes', cp.getAttribute('data-alvo')), raiz: _raizTime, soResumo: false, secao: '', trilha: 'tecnologia' }));
          } else copiar(textoAta(base(), qual === 'sprint' ? 'sprint' : ''));
          return;
        }
        var as = e.target.closest('[data-rel-assunto]');
        if (as) gerarAssunto(as);
      });
    }
  });
})();
