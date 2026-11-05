/* ─────────────────────────────────────────────────────────────────────────
   AXIS — Paineis (#paineis). Visao geral · Fluxo e pessoas · Pontos.

   O GERENCIAL DO ADMIN, COM O DESENHO DO PROTOTIPO. As contas desta tela
   moravam so dentro do admin.html (aba Gerencial e aba Mes), amarradas aos
   seletores e ao `state` daquela pagina. Aqui elas foram COPIADAS, uma a uma,
   com o nome da funcao de origem ao lado — e nao reescritas: duas contas com o
   mesmo nome ja deram "eficiencia 100% todo mes" e o atraso em quatro versoes
   nesta base. Cada copia e candidata a virar modulo (ver a entrega).

   AS REGRAS FICAM NUM OBJETO SO, `AXIS_GER`, definido aqui e lido tambem por
   axis-tela-relatorios.js e axis-tela-fechamento.js. Tres telas com tres copias
   do fechamento do mes seria o defeito de sempre com endereco novo; o axis.html
   carrega este arquivo antes dos outros dois.

   O "Atendimento" do prototipo (Painel ITIL: SLA, chamados, problemas,
   mudancas) fica fora: e ITIL novo, e o RoadMap nao tem nenhum desses dados.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var raiz = typeof window !== 'undefined' ? window : globalThis;
  if (!raiz.AXIS_APP) return;
  var H = raiz.AXIS_APP.H;
  var esc = H.esc;

  // ═══ TEMPO ════════════════════════════════════════════════════════════
  /** `AAAA-MM` somado de n meses, sem objeto Date: o fuso muda o dia.
      Copia de `mesSomaLocal` (admin.html). */
  function mesSoma(iso, n) {
    var a = parseInt(String(iso).slice(0, 4), 10);
    var b = parseInt(String(iso).slice(5, 7), 10);
    var t = (a * 12 + (b - 1)) + n;
    return String(Math.floor(t / 12)) + '-' + String((t % 12) + 1).padStart(2, '0');
  }
  function mesCorrente() { return H.hoje().slice(0, 7); }
  function ultimoDia(alvo) {
    var a = +alvo.slice(0, 4), m = +alvo.slice(5, 7);
    return new Date(a, m, 0).getDate();
  }
  function limites(alvo) {
    return { de: alvo + '-01', ate: alvo + '-' + String(ultimoDia(alvo)).padStart(2, '0') };
  }
  function nomeMes(alvo) { return H.MESES[+String(alvo).slice(5, 7) - 1] || ''; }
  function rotuloMes(alvo) { return nomeMes(alvo) + ' de ' + String(alvo).slice(0, 4); }
  function ehAlvo(s) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s || '')); }
  function dia10(v) { return String(v == null ? '' : v).slice(0, 10); }
  function ehDia(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
  function feriadosDe(D) { return ((D || {}).feriados || []).map(function (f) { return f && f.data ? f.data : f; }).filter(Boolean); }

  /* O MES ESCOLHIDO ANDA COM QUEM TROCA DE ABA. Ele vive no hash
     (#paineis/visao/2026-09), para o voltar do navegador funcionar e o link
     poder ser mandado a alguem; sem o mes no hash, vale o ultimo escolhido. */
  var _alvo = '';
  function alvoDe(param) {
    var p = String(param || '').split('/')[0];
    if (ehAlvo(p)) _alvo = p;
    return _alvo || mesCorrente();
  }

  // ═══ REGRAS COPIADAS DO ADMIN (candidatas a modulo) ═══════════════════
  function todas(D) { return ((D || {}).melhorias || []); }
  function vivas(D) { return todas(D).filter(function (m) { return m && !m.oculto && !m.mesclado_em; }); }
  function temaNome(D, id) {
    var t = ((D || {}).temas || []).find(function (x) { return x.id === id; });
    return t ? t.nome : '';
  }

  /* ── Mes de compromisso: `mesTrilhaDe`, `mesDe`, `mesEntrouEm`, `mesRolos`,
     `mesDesdeOInicio`, `mesDoPeriodo`, `mesClassifica` (admin.html, aba Mes).
     A verdade e a trilha `meses` ([{mes, em}]), append-only, gravada so no
     Worker. O dia 1 e o corte do "comprometida desde o inicio". */
  function mesTrilhaDe(m) {
    var t = (m && Array.isArray(m.meses)) ? m.meses : [];
    return t.filter(function (x) { return x && /^\d{4}-(0[1-9]|1[0-2])$/.test(String(x.mes)); });
  }
  function mesDe(m) { var t = mesTrilhaDe(m); return t.length ? t[t.length - 1].mes : ''; }
  function mesEntrouEm(m) {
    var t = mesTrilhaDe(m);
    if (!t.length) return '';
    var u = t[t.length - 1];
    return ehDia(u.em) ? String(u.em) : String(u.mes) + '-01';
  }
  function mesRolos(m) { return Math.max(0, mesTrilhaDe(m).length - 1); }
  function mesDesdeOInicio(m, alvo) { return mesEntrouEm(m) <= alvo + '-01'; }
  function mesDoPeriodo(D, alvo) {
    return todas(D).filter(function (m) {
      return !m.mesclado_em && !m.oculto && mesTrilhaDe(m).some(function (x) { return x.mes === alvo; });
    });
  }
  function mesClassifica(m, alvo, corrente) {
    var conc = (m.status_planejamento || '') === 'concluido';
    var cm = String(m.concluido_em || '').slice(0, 7);
    if (conc && cm && cm <= alvo) return 'entregue';
    if ((m.status_planejamento || '') === 'negada') return 'negada';
    if (alvo < corrente) return 'transbordou';
    return 'em_curso';
  }
  /** Divide "A / B" so na barra (`splitDevsLocalPrazo`, admin.html): no
   *  cumprimento e no prazo a demanda de dupla conta inteira para os dois. */
  function splitDevsPrazo(m) {
    var n = String(m.dev || '').split('/').map(function (x) { return x.trim(); }).filter(Boolean);
    return n.length ? n : ['(sem responsável)'];
  }
  /** O fechamento de um mes: `renderMes` + `renderGerCumprimento` (admin.html). */
  function fechamentoDoMes(D, alvo) {
    var corrente = mesCorrente();
    var itens = mesDoPeriodo(D, alvo);
    var cls = new Map(itens.map(function (m) { return [m.id, mesClassifica(m, alvo, corrente)]; }));
    var inicio = itens.filter(function (m) { return mesDesdeOInicio(m, alvo); });
    var meio = itens.filter(function (m) { return !mesDesdeOInicio(m, alvo); });
    var entregues = itens.filter(function (m) { return cls.get(m.id) === 'entregue'; });
    var transb = itens.filter(function (m) { return ['transbordou', 'em_curso'].indexOf(cls.get(m.id)) >= 0; });
    var entrInicio = inicio.filter(function (m) { return cls.get(m.id) === 'entregue'; }).length;
    var pct = inicio.length ? Math.round(entrInicio / inicio.length * 100) : null;
    // Por dev, como `renderGerCumprimento`: o % e entregue sobre tudo que a
    // pessoa teve no mes (comprometidas + as que entraram depois).
    var porDev = {};
    var soma = function (nome, chave) {
      porDev[nome] = porDev[nome] || { nome: nome, comp: 0, entregue: 0, transb: 0, meio: 0 };
      porDev[nome][chave]++;
    };
    itens.forEach(function (m) {
      var c = cls.get(m.id);
      splitDevsPrazo(m).forEach(function (n) {
        if (mesDesdeOInicio(m, alvo)) soma(n, 'comp'); else soma(n, 'meio');
        if (c === 'entregue') soma(n, 'entregue');
        if (c === 'transbordou' || c === 'em_curso') soma(n, 'transb');
      });
    });
    var devs = Object.keys(porDev).map(function (k) {
      var d = porDev[k];
      d.pct = d.comp ? Math.round(d.entregue / (d.comp + d.meio) * 100) : null;
      return d;
    }).sort(function (a, b) {
      return (b.comp + b.meio) - (a.comp + a.meio) || String(a.nome).localeCompare(String(b.nome), 'pt-BR');
    });
    return { alvo: alvo, itens: itens, cls: cls, inicio: inicio, meio: meio, entregues: entregues,
             transb: transb, entrInicio: entrInicio, pct: pct, devs: devs, corrente: corrente };
  }

  /* ── Prazo do mes: `prazoClassifica` + `renderGerPrazo` (admin.html). O mes
     e o da CONCLUSAO; o fim da conta e a entrega do dev (`PRAZO.fimDoDev`). */
  function prazoClassifica(m) {
    if (!m || m.mesclado_em || m.oculto) return null;
    if ((m.status_planejamento || '') !== 'concluido') return null;
    var P = raiz.PRAZO;
    var fim = P ? P.fimDoDev(m) : String(m.concluido_em || '').slice(0, 10);
    var pz = String(m.entrega || '').slice(0, 10);
    if (!ehDia(fim)) return { tipo: 'sem_conclusao' };
    if (!ehDia(pz)) return { tipo: 'sem_prazo' };
    var dias = P ? P.diasDeAtraso(m, 'concluido', null) : null;
    if (!dias) return { tipo: 'no_prazo', dias: 0 };
    return { tipo: 'atraso', dias: dias };
  }
  function prazoDoMes(D, alvo) {
    var doMes = todas(D).filter(function (m) {
      return prazoClassifica(m) && String(m.concluido_em || '').slice(0, 7) === alvo;
    });
    var cls = new Map(doMes.map(function (m) { return [m.id, prazoClassifica(m)]; }));
    var noPrazo = doMes.filter(function (m) { return cls.get(m.id).tipo === 'no_prazo'; });
    var atraso = doMes.filter(function (m) { return cls.get(m.id).tipo === 'atraso'; });
    var naoMedido = doMes.filter(function (m) { return ['sem_prazo', 'sem_conclusao'].indexOf(cls.get(m.id).tipo) >= 0; });
    var medidas = noPrazo.length + atraso.length;
    var porDev = {};
    var somaDev = function (nome, chave, dias) {
      porDev[nome] = porDev[nome] || { nome: nome, prazo: 0, atraso: 0, dias: 0 };
      porDev[nome][chave]++;
      if (dias) porDev[nome].dias += dias;
    };
    noPrazo.forEach(function (m) { splitDevsPrazo(m).forEach(function (n) { somaDev(n, 'prazo'); }); });
    atraso.forEach(function (m) { splitDevsPrazo(m).forEach(function (n) { somaDev(n, 'atraso', cls.get(m.id).dias); }); });
    return {
      doMes: doMes, cls: cls, noPrazo: noPrazo, atraso: atraso, naoMedido: naoMedido, medidas: medidas,
      pct: medidas ? Math.round(noPrazo.length / medidas * 100) : null,
      diasMedio: atraso.length ? Math.round(atraso.reduce(function (t, m) { return t + cls.get(m.id).dias; }, 0) / atraso.length) : 0,
      porDev: porDev
    };
  }

  /* ── Rateio de horas: `rateiaHoras`, `horasReaisDe` (admin.html). O dia util
     do dev vale 8h e e dividido entre as demandas que ele tinha em maos. As
     datas sao recortadas em 10 caracteres antes da conta; a origem passa o
     campo cru, e um `concluido_em` com hora sairia como data invalida la. */
  var HORAS_DIA = 8;
  function rateiaHoras(lista, janela, de, ate, feriados) {
    var fer = {}; (feriados || []).forEach(function (f) { fer[f] = true; });
    var agenda = new Map(), trechos = [];
    lista.forEach(function (m) {
      var j = janela(m) || {};
      var jd = dia10(j.de), ja = dia10(j.ate);
      if (!jd || !ja) return;
      var ini = jd > de ? jd : de, fim = ja < ate ? ja : ate;
      if (fim < ini || !ehDia(ini) || !ehDia(fim)) return;
      var devs = String(m.dev || '').split(/[\/,]/).map(function (x) { return x.trim(); }).filter(Boolean);
      if (!devs.length) return;
      var d = new Date(Date.UTC(+ini.slice(0, 4), +ini.slice(5, 7) - 1, +ini.slice(8, 10)));
      var g = 0;
      while (d.toISOString().slice(0, 10) <= fim && g++ < 400) {
        var w = d.getUTCDay(), iso = d.toISOString().slice(0, 10);
        if (w !== 0 && w !== 6 && !fer[iso]) {
          devs.forEach(function (dv) {
            var k = iso + '|' + dv;
            if (!agenda.has(k)) agenda.set(k, []);
            agenda.get(k).push(m.id);
            trechos.push({ id: m.id, k: k });
          });
        }
        d.setUTCDate(d.getUTCDate() + 1);
      }
    });
    var horas = new Map();
    trechos.forEach(function (t) { horas.set(t.id, (horas.get(t.id) || 0) + HORAS_DIA / agenda.get(t.k).length); });
    return horas;
  }
  function horasReaisDe(m, rateado) {
    var dig = Number(String((m || {}).horas_realizadas == null ? '' : m.horas_realizadas).replace(',', '.'));
    if (isFinite(dig) && dig > 0) return { h: dig, medida: true };
    return { h: (rateado && rateado.get(m.id)) || 0, medida: false };
  }

  /** O gerencial do mes: o miolo de `renderGerencial` (admin.html). O mes e o
   *  do INICIO da demanda — e a origem nao tira as ocultas aqui; mantido. */
  function gerencialDoMes(D, alvo) {
    var fer = feriadosDe(D);
    var doMes = function (a) { return todas(D).filter(function (m) { return m.inicio && String(m.inicio).slice(0, 7) === a; }); };
    var ehConc = function (m) { return m.status_planejamento === 'concluido' || m.status === 'concluida'; };
    var items = doMes(alvo), concluidos = items.filter(ehConc);
    var ant = mesSoma(alvo, -1), prevItems = doMes(ant), prevConc = prevItems.filter(ehConc);
    var janPlan = function (m) { return { de: m.inicio, ate: m.entrega }; };
    var janReal = function (m) { return { de: m.inicio, ate: m.concluido_em || m.entrega }; };
    var lim = limites(alvo), limA = limites(ant);
    var hPlan = rateiaHoras(items, janPlan, lim.de, lim.ate, fer);
    var hReal = rateiaHoras(concluidos, janReal, lim.de, lim.ate, fer);
    var somaH = function (mapa) { var s = 0; mapa.forEach(function (v) { s += v; }); return Math.round(s); };
    var somaReal = function (l, rat) { return Math.round(l.reduce(function (s, m) { return s + horasReaisDe(m, rat).h; }, 0)); };
    var totalPlan = somaH(hPlan), totalReal = somaReal(concluidos, hReal);
    var prevPlan = somaH(rateiaHoras(prevItems, janPlan, limA.de, limA.ate, fer));
    var prevReal = somaReal(prevConc, rateiaHoras(prevConc, janReal, limA.de, limA.ate, fer));
    var horasDigitadas = Math.round(concluidos.reduce(function (s, m) { return s + (Number(m.horas_realizadas) || 0); }, 0));
    var quantasDigitaram = concluidos.filter(function (m) { return Number(m.horas_realizadas) > 0; }).length;
    var efic = totalPlan > 0 ? Math.round(totalReal / totalPlan * 100) : 0;
    // Perto do planejado e verde; MUITO acima tambem e alerta (`eficClass`).
    var eficCor = (efic >= 85 && efic <= 115) ? 'ok' : (efic >= 60 && efic <= 140) ? 'wn' : 'dg';
    // `groupBy` / `groupByDevs`: sem tema vira "Sem tema"; dupla divide a hora.
    var groupBy = function (arr, keyFn, valFn) {
      var map = {};
      arr.forEach(function (m) { var k = keyFn(m) || 'Sem tema'; map[k] = (map[k] || 0) + (valFn(m) || 0); });
      return map;
    };
    var groupByDevs = function (arr, valFn) {
      var map = {};
      arr.forEach(function (m) {
        var devs = String(m.dev || '').split(/[\/,]/).map(function (d) { return d.trim(); }).filter(Boolean);
        var v = (valFn(m) || 0) / devs.length;
        devs.forEach(function (d) { map[d] = (map[d] || 0) + v; });
      });
      return map;
    };
    var realDe = function (m) { return horasReaisDe(m, hReal).h; };
    var nomeT = function (m) { return temaNome(D, m.tema_id); };
    return {
      alvo: alvo, items: items, concluidos: concluidos, prevItems: prevItems, prevConc: prevConc,
      hPlan: hPlan, hReal: hReal, totalPlan: totalPlan, totalReal: totalReal, prevPlan: prevPlan, prevReal: prevReal,
      horasDigitadas: horasDigitadas, quantasDigitaram: quantasDigitaram, efic: efic, eficCor: eficCor,
      planPorTema: groupBy(items, nomeT, function (m) { return hPlan.get(m.id) || 0; }),
      realPorTema: groupBy(concluidos, nomeT, realDe),
      planPorDev: groupByDevs(items, function (m) { return hPlan.get(m.id) || 0; }),
      realPorDev: groupByDevs(concluidos, realDe)
    };
  }

  /** Entradas do mes: `renderGerEntradas` (admin.html). Pela data de criacao. */
  function entradasDoMes(D, alvo) {
    var de = function (a) { return todas(D).filter(function (m) { return !m.mesclado_em && String(m.criado_em || '').slice(0, 7) === a; }); };
    var doMes = de(alvo);
    var tipo = function (m) { return m.tipo === 'sustentacao' ? 'sust' : (m.tipo === 'evolucao' ? 'evo' : 'sem'); };
    return {
      doMes: doMes,
      sust: doMes.filter(function (m) { return tipo(m) === 'sust'; }).length,
      evo: doMes.filter(function (m) { return tipo(m) === 'evo'; }).length,
      sem: doMes.filter(function (m) { return tipo(m) === 'sem'; }).length,
      ant: de(mesSoma(alvo, -1)).length
    };
  }

  /* ── Trabalho do PM/PO: `PM_FUNIS`, `pmTransicoes`, `pmEntradaEm`, `pmHoras`,
     `pmDur`, `pmSemanas`, `pmFluxo` (admin.html, aba Gerencial). A fonte e o
     historico, gravado so a partir de 05/08/2026; a recepcao vem de criado_em. */
  var PM_FUNIS = [
    { k: 'backlog', rot: 'Backlog (recepção)', curto: 'Backlog', cor: 'var(--tx4)' },
    { k: 'levantar_req', rot: 'Em aprovação de requisitos', curto: 'Aprov. req.', cor: 'var(--in)' },
    { k: 'planning', rot: 'Planning', curto: 'Planning', cor: 'var(--pu)' },
    { k: 'validacao', rot: 'Validação PM/PO', curto: 'Validação', cor: 'var(--wn)' }
  ];
  function pmTransicoes(D) {
    var fora = [];
    todas(D).forEach(function (m) {
      if (m.oculto || m.mesclado_em) return;
      (m.historico || []).forEach(function (e) {
        (e.mudancas || []).forEach(function (mu) {
          if (mu.campo !== 'status_planejamento') return;
          var d = String(e.em || '').slice(0, 10);
          if (!ehDia(d)) return;
          fora.push({ id: m.id, codigo: m.codigo || '', tema_id: m.tema_id, dia: d, em: String(e.em || ''),
                      de: String(mu.de || ''), para: String(mu.para || ''), quem: e.quem || '' });
        });
      });
    });
    return fora.sort(function (a, b) { return a.dia.localeCompare(b.dia); });
  }
  function pmEntradaEm(trans, id, funil, antes) {
    var achou = '';
    trans.forEach(function (t) { if (t.id === id && t.para === funil && t.dia <= antes) achou = t.em || t.dia; });
    return achou;
  }
  function pmHoras(a, b) {
    if (!a || !b) return null;
    var t1 = Date.parse(a), t2 = Date.parse(b);
    if (isNaN(t1) || isNaN(t2)) return null;
    return Math.max(0, (t2 - t1) / 3600000);
  }
  function pmDur(h) {
    if (h === null || h === undefined) return '—';
    if (h < 24) return (h < 1 ? Math.round(h * 60) + 'min' : Math.round(h) + 'h');
    return Math.round(h / 24) + 'd';
  }
  /** Blocos de 7 dias a partir do dia 1, e nao semanas do calendario. */
  function pmSemanas(alvo) {
    var ult = ultimoDia(alvo), fora = [];
    for (var d = 1; d <= ult; d += 7) {
      var fim = Math.min(d + 6, ult);
      fora.push({ ini: d, fim: fim, rot: String(d).padStart(2, '0') + '–' + String(fim).padStart(2, '0'),
                  de: alvo + '-' + String(d).padStart(2, '0'), ate: alvo + '-' + String(fim).padStart(2, '0') });
    }
    return fora;
  }
  function pmFluxo(D, alvo) {
    var L = limites(alvo), A = L.de, B = L.ate;
    var trans = pmTransicoes(D);
    var noMes = trans.filter(function (t) { return t.dia >= A && t.dia <= B; });
    var vs = todas(D).filter(function (m) { return !m.oculto && !m.mesclado_em; });
    var recebidas = vs.filter(function (m) { var c = String(m.criado_em || '').slice(0, 10); return c >= A && c <= B; });
    var funis = PM_FUNIS.map(function (f) {
      var entrou = noMes.filter(function (t) { return t.para === f.k; });
      var saiu = noMes.filter(function (t) { return t.de === f.k; });
      var parado = vs.filter(function (m) { return (m.status_planejamento || '') === f.k; });
      var ids = {}; entrou.forEach(function (t) { ids[t.id] = true; });
      var entradas = f.k === 'backlog' ? entrou.length + recebidas.filter(function (m) { return !ids[m.id]; }).length : entrou.length;
      var tempos = [], semEntrada = 0;
      saiu.forEach(function (t) {
        var ini = f.k === 'backlog'
          ? (pmEntradaEm(trans, t.id, f.k, t.dia) || String((vs.find(function (m) { return m.id === t.id; }) || {}).criado_em || ''))
          : pmEntradaEm(trans, t.id, f.k, t.dia);
        var dd = pmHoras(ini, t.em || t.dia);
        if (dd === null) semEntrada++; else tempos.push(dd);
      });
      return Object.assign({}, f, { entradas: entradas, saiu: saiu.length, parado: parado.length,
        media: tempos.length ? tempos.reduce(function (a, b) { return a + b; }, 0) / tempos.length : null,
        medidos: tempos.length, semEntrada: semEntrada });
    });
    var desp = noMes.filter(function (t) { return t.para === 'planejado'; });
    var jornada = [];
    desp.forEach(function (t) {
      var m = vs.find(function (x) { return x.id === t.id; });
      var dd = pmHoras(String((m || {}).criado_em || ''), t.em || t.dia);
      if (dd !== null) jornada.push(dd);
    });
    jornada.sort(function (a, b) { return a - b; });
    var porQuem = {};
    noMes.filter(function (t) { return PM_FUNIS.some(function (f) { return f.k === t.de || f.k === t.para; }); })
      .forEach(function (t) { var q = t.quem || '(sem registro)'; porQuem[q] = (porQuem[q] || 0) + 1; });
    return { alvo: alvo, noMes: noMes, recebidas: recebidas, funis: funis, despachadas: desp.length,
             mediana: jornada.length ? jornada[Math.floor(jornada.length / 2)] : null, jornadaN: jornada.length,
             quem: Object.keys(porQuem).map(function (k) { return { nome: k, n: porQuem[k] }; }).sort(function (a, b) { return b.n - a.n; }),
             semRegistro: B < '2026-08-05' };
  }

  /* ── Pontos do Planning Poker: `gerSemanasDoMes`, `gerSemanaIndex`,
     `gerDataRefPontos`, `gerTemDataDePlano`, `gerPontuadasSemData`,
     `gerItensPontuados`, `cortePontosPorDev`, `gerCortesDePontos` (admin.html).
     Semana = bloco de 5 dias uteis; entrega pela regra de `fila.js`. */
  function gerSemanasDoMes(alvo, fer) {
    var f = {}; (fer || []).forEach(function (x) { f[x] = true; });
    var uteis = [], ult = ultimoDia(alvo), a = +alvo.slice(0, 4), mm = +alvo.slice(5, 7);
    for (var d = 1; d <= ult; d++) {
      var w = new Date(a, mm - 1, d).getDay();
      var s = alvo + '-' + String(d).padStart(2, '0');
      if (w === 0 || w === 6 || f[s]) continue;
      uteis.push(s);
    }
    var sem = [];
    for (var i = 0; i < uteis.length; i += 5) sem.push(uteis.slice(i, i + 5));
    return sem;
  }
  function gerSemanaIndex(d, semanas) {
    if (!d) return -1;
    for (var i = 0; i < semanas.length; i++) if (semanas[i].indexOf(d) >= 0) return i;
    for (var j = 0; j < semanas.length; j++) {
      var w = semanas[j];
      if (w.length && d >= w[0] && d <= w[w.length - 1]) return j;
    }
    return -1;
  }
  function gerDataRefPontos(m) {
    return (raiz.CAPACIDADE ? raiz.CAPACIDADE.diaDaEntrega(m) : '') ||
      (['validacao', 'concluido'].indexOf((m || {}).status_planejamento || '') >= 0 ? String((m || {}).concluido_em || '').slice(0, 10) : '');
  }
  function gerTemDataDePlano(m) { return !!(String((m || {}).entrega || '').trim() || String((m || {}).inicio || '').trim()); }
  function gerPontuadasSemData(D) {
    return todas(D).filter(function (m) { return Number(m.poker_pontos) > 0 && !gerTemDataDePlano(m) && !gerDataRefPontos(m); });
  }
  function gerItensPontuados(D, alvo) {
    var L = limites(alvo);
    return todas(D).filter(function (m) { return Number(m.poker_pontos) > 0 && raiz.FILA.ehEntregaDe(m, L.de, L.ate); });
  }
  function splitDevsLocal(s) { return s ? String(s).split(/[\/,]/).map(function (d) { return d.trim(); }).filter(Boolean) : []; }
  function cortePontosPorDev(itens) {
    var porDev = {}, semDono = 0;
    (itens || []).forEach(function (m) {
      var devs = splitDevsLocal(m.dev), pts = Number(m.poker_pontos);
      if (!isFinite(pts) || pts <= 0) return;
      if (!devs.length) { semDono += pts; return; }
      devs.forEach(function (d) { porDev[d] = (porDev[d] || 0) + pts / devs.length; });
    });
    if (semDono > 0) porDev['Sem responsável'] = semDono;
    Object.keys(porDev).forEach(function (k) { porDev[k] = Math.round(porDev[k]); });
    return porDev;
  }
  function relRaizNome(nome) { return (raiz.catalogoRaiz ? raiz.catalogoRaiz(nome) : String(nome || '')) || '—'; }
  function ordena(o) { return Object.keys(o).map(function (k) { return [k, o[k]]; }).sort(function (a, b) { return b[1] - a[1]; }); }
  function gerCortesDePontos(D, alvo) {
    var semanas = gerSemanasDoMes(alvo, feriadosDe(D));
    var itens = gerItensPontuados(D, alvo);
    var porSemana = {}, fora = 0;
    semanas.forEach(function (_, i) { porSemana['S' + (i + 1)] = 0; });
    itens.forEach(function (m) {
      var i = gerSemanaIndex(gerDataRefPontos(m), semanas);
      if (i >= 0) porSemana['S' + (i + 1)] += Number(m.poker_pontos); else fora += Number(m.poker_pontos);
    });
    if (fora > 0) porSemana['Fora do mês'] = fora;
    var porAssunto = {}, porSprint = {};
    itens.forEach(function (m) {
      var k = m.tema_id ? relRaizNome(temaNome(D, m.tema_id)) : 'Sem tema';
      porAssunto[k] = (porAssunto[k] || 0) + Number(m.poker_pontos);
      var s = String(m.sprint || '').trim() || 'Sem sprint';
      porSprint[s] = (porSprint[s] || 0) + Number(m.poker_pontos);
    });
    // Matriz dev x semana (`renderGerPontos`): o ponto da dupla se divide.
    var matriz = {};
    itens.forEach(function (m) {
      var devs = splitDevsLocal(m.dev), v = Number(m.poker_pontos) / devs.length;
      var i = gerSemanaIndex(gerDataRefPontos(m), semanas);
      devs.forEach(function (d) {
        if (!matriz[d]) matriz[d] = { total: 0, sem: semanas.map(function () { return 0; }) };
        matriz[d].total += v;
        if (i >= 0) matriz[d].sem[i] += v;
      });
    });
    return {
      itens: itens, semanas: semanas, porSemana: porSemana,
      total: itens.reduce(function (t, m) { return t + Number(m.poker_pontos); }, 0),
      porDev: ordena(cortePontosPorDev(itens)), porAssunto: ordena(porAssunto), porSprint: ordena(porSprint),
      matriz: Object.keys(matriz).map(function (k) { return { nome: k, total: matriz[k].total, sem: matriz[k].sem }; })
        .sort(function (a, b) { return b.total - a.total; })
    };
  }

  /* ── Relatorios: `relRaizDe`, `relVivasDe`, `relComoAndou`, `relTemasDe`,
     `janelaDe` (escala mes) e `relDados` (admin.html, aba Relatorios). */
  function relRaizDe(D, m) {
    var t = ((D || {}).temas || []).find(function (x) { return x.id === (m || {}).tema_id; });
    return t ? relRaizNome(t.nome) : 'Sem sistema';
  }
  function relVivasDe(D, raizF) {
    return todas(D).filter(function (m) {
      return m && !m.oculto && !m.mesclado_em && (m.status_planejamento || '') !== 'negada' && m.status !== 'negada' &&
        (!raizF || relRaizDe(D, m) === raizF);
    });
  }
  function janelaMes(alvo) {
    var L = limites(alvo), LA = limites(mesSoma(alvo, -1));
    return { escala: 'mes', de: L.de, ate: L.ate, deAnt: LA.de, ateAnt: LA.ate, rot: rotuloMes(alvo), rotAnt: rotuloMes(mesSoma(alvo, -1)) };
  }
  function relComoAndou(D, j, raizF) {
    var C = raiz.CAPACIDADE, vs = relVivasDe(D, raizF);
    var soma = function (de, ate) {
      var linhas = C.porDev(vs, de, ate), semPlano = 0;
      vs.forEach(function (m) {
        var d = C.diaDaEntrega(m);
        if (!d || d < de || d > ate) return;
        var e = C.entregues(m);
        if (e && !C.planejados(m)) semPlano += e;
      });
      var entregue = linhas.reduce(function (t, x) { return t + x.entregue; }, 0);
      return { plan: linhas.reduce(function (t, x) { return t + x.plan; }, 0), entregue: entregue, semPlano: semPlano,
               comparavel: entregue > 0 ? (semPlano / entregue) < 0.5 : false,
               semPontuar: linhas.reduce(function (t, x) { return t + x.semPontuar; }, 0),
               devs: linhas.filter(function (x) { return x.plan || x.entregue; }).length };
    };
    var saiu = function (de, ate) {
      return vs.filter(function (m) {
        var d = C.diaDaEntrega(m);
        return d && d >= de && d <= ate && ['validacao', 'concluido'].indexOf(m.status_planejamento || '') >= 0;
      }).length;
    };
    return { agora: soma(j.de, j.ate), antes: soma(j.deAnt, j.ateAnt), entregas: saiu(j.de, j.ate), entregasAnt: saiu(j.deAnt, j.ateAnt) };
  }
  function relTemasDe(D, raizF, j) {
    var C = raiz.CAPACIDADE, por = new Map();
    relVivasDe(D, raizF).forEach(function (m) {
      var d = C.diaDaEntrega(m);
      if (!d || d < j.de || d > j.ate) return;
      var k = m.tema_id ? relRaizDe(D, m) : 'Sem sistema';
      var a = por.get(k) || { pts: 0, qtd: 0 };
      a.pts += C.entregues(m); a.qtd += 1;
      por.set(k, a);
    });
    var itens = []; por.forEach(function (v, nome) { itens.push({ nome: nome, pts: v.pts, qtd: v.qtd }); });
    itens.sort(function (a, b) { return b.pts - a.pts || b.qtd - a.qtd; });
    return { itens: itens, total: itens.reduce(function (t, x) { return t + x.pts; }, 0) };
  }
  /** As entregues de um periodo (`relDados`): validacao ou concluido, pela
   *  data em que o DEV entregou; o prazo combinado so como reserva antiga. */
  function relEntregues(D, de, ate, raizF) {
    var C = raiz.CAPACIDADE, vs = relVivasDe(D, raizF);
    var saida = function (m) { return C.diaDaEntrega(m) || m.entrega || ''; };
    var lista = vs.filter(function (m) {
      var ok = ['validacao', 'concluido'].indexOf(m.status_planejamento || '') >= 0 || m.status === 'concluida';
      var d = saida(m);
      return ok && !!d && d >= de && d <= ate;
    });
    var semData = vs.filter(function (m) { return (m.status_planejamento === 'concluido' || m.status === 'concluida') && !saida(m); }).length;
    return { lista: lista, semData: semData, saida: saida };
  }

  /** O selo de planning/comite (`coberturaRender`, admin.html) mora em
   *  selo-validacao.js, que o axis.html ainda nao carrega. Ate entrar no
   *  nucleo, a tela busca o arquivo uma vez e se redesenha quando ele chega. */
  var _seloPedido = false;
  function selo() {
    if (raiz.SELO) return raiz.SELO;
    if (!_seloPedido && typeof document !== 'undefined') {
      _seloPedido = true;
      var s = document.createElement('script');
      s.src = 'selo-validacao.js';
      s.onload = function () { if (raiz.AXIS_APP) raiz.AXIS_APP.desenhar(); };
      document.head.appendChild(s);
    }
    return null;
  }

  /** OS SLIDES DO DECK DO MES — copia de `AP_SECOES` (admin.html). `pad` e o
   *  "Padrao do fechamento"; `n`, quantos slides a secao gera. O deck sai do
   *  Fechamento do mes (axis-tela-fechamento.js, que tem a lista com as notas);
   *  aqui ela serve para o resumo dos Relatorios. */
  var AP_SECOES = [
    { k: 'entregas', rot: 'O mês: backlog, o que entrou e o que saiu', n: 1, pad: true },
    { k: 'evolucao', rot: 'Evolução: este mês e o anterior', n: 1, pad: true },
    { k: 'comparativo', rot: 'Este mês contra o anterior: entregas, pontos, horas e prazo', n: 1, pad: true },
    { k: 'pipelines', rot: 'Frentes de trabalho: horas planejadas × realizadas', n: 2, pad: true },
    { k: 'frentes_detalhe', rot: 'Cada frente por dentro: entregas, projetos e quem fez', n: 3, pad: true },
    { k: 'pontos_dev', rot: 'Pontos entregues por desenvolvedor', n: 1, pad: true },
    { k: 'entregas_top', rot: 'Principais entregas: pontos e tempo de cada uma', n: 1, pad: true },
    { k: 'pontos_semana', rot: 'Pontos entregues por semana', n: 1 },
    { k: 'pontos_tema', rot: 'Pontos entregues por sistema', n: 1 },
    { k: 'projetos', rot: 'Principais projetos em aberto', n: 1, pad: true },
    { k: 'capacidade', rot: 'Planejado × entregue em pontos, por dev', n: 1, pad: true },
    { k: 'prazo', rot: 'No prazo × com atraso', n: 2 },
    { k: 'rapidas', rot: 'Entregas rápidas (até 2 dias)', n: 1 },
    { k: 'areas', rot: 'Onde atuamos (as 3 maiores frentes)', n: 1 },
    { k: 'solicit', rot: 'Quem mais pediu (top 5)', n: 1 },
    { k: 'time', rot: 'O time (agregado) e quem esteve fora', n: 1 },
    { k: 'grafico', rot: 'Entregas por desenvolvedor (com os pontos ao lado)', n: 1 },
    { k: 'ganttdev', rot: 'A linha do tempo dos 3 primeiros devs', n: 3 },
    { k: 'riscos', rot: 'O que está travado (demandas pausadas)', n: 1 },
    { k: 'proximo', rot: 'O que vem no próximo mês', n: 1 }
  ];

  // ═══ DESENHO: graficos em SVG/HTML, so com tokens ═════════════════════
  var PALETA = ['var(--ac)', 'var(--in)', 'var(--ok)', 'var(--wn)', 'var(--pu)', 'var(--tl)', 'var(--dg)', 'var(--tx4)'];
  function corPct(p, bom, medio) {
    if (p === null || p === undefined) return '';
    return p >= (bom || 80) ? 'var(--ok-t)' : p >= (medio || 50) ? 'var(--wn-t)' : 'var(--dg-t)';
  }
  function chipPct(p) {
    if (p === null || p === undefined) return '<span class="mono" style="color:var(--tx4)">—</span>';
    return H.chip(p + '%', p >= 80 ? 'ok' : p >= 50 ? 'wn' : 'dg');
  }
  /** "▲ 12% vs mes ant." — `deltaBadge` do `renderGerencial`. */
  function delta(curr, prev) {
    if (!prev && !curr) return '';
    if (!prev) return '<span class="gx-d">— sem ref. anterior</span>';
    var p = Math.round((curr - prev) / prev * 100);
    var cls = p > 0 ? 'up' : p < 0 ? 'down' : '';
    return '<span class="gx-d ' + cls + '">' + (p > 0 ? '▲' : p < 0 ? '▼' : '→') + ' ' + Math.abs(p) + '% vs. mês ant.</span>';
  }
  function k(rot, valor, nota, cor) {
    return '<div class="k"><span class="kl">' + rot + '</span><span class="kv"' + (cor ? ' style="color:' + cor + '"' : '') + '>' + valor + '</span>' +
      (nota ? '<span class="note">' + nota + '</span>' : '') + '</div>';
  }
  function leg(cor, txt) { return '<span class="gx-li"><i style="background:' + cor + '"></i>' + txt + '</span>'; }

  /** Rosca. `segs` = [{v, cor, rot}]; a circunferencia mede 100, entao o
   *  traco de cada fatia e o proprio percentual. */
  function rosca(segs, centro, sub, tam) {
    tam = tam || 130;
    var total = segs.reduce(function (t, s) { return t + (s.v || 0); }, 0);
    var acc = 0, arcos = '';
    if (total > 0) {
      segs.forEach(function (s) {
        if (!s.v) return;
        var p = s.v / total * 100;
        arcos += '<circle cx="21" cy="21" r="15.9155" fill="none" stroke="' + s.cor + '" stroke-width="5.2" stroke-dasharray="' +
          p.toFixed(3) + ' ' + (100 - p).toFixed(3) + '" stroke-dashoffset="' + (-acc).toFixed(3) + '"><title>' + esc(s.rot) + ': ' + s.v + '</title></circle>';
        acc += p;
      });
    }
    return '<div class="gx-rosca" style="width:' + tam + 'px;height:' + tam + 'px">' +
      '<svg viewBox="0 0 42 42" width="' + tam + '" height="' + tam + '" role="img" aria-label="' + esc(sub || '') + '" style="transform:rotate(-90deg)">' +
      '<circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--track)" stroke-width="5.2"></circle>' + arcos + '</svg>' +
      '<span class="gx-rc"><b>' + centro + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</span></div>';
  }
  function legendaRosca(segs, comPct) {
    var total = segs.reduce(function (t, s) { return t + (s.v || 0); }, 0);
    return '<div class="gx-lr">' + segs.filter(function (s) { return s.v; }).map(function (s) {
      return '<span class="gx-li"><i style="background:' + s.cor + '"></i><span class="ell">' + esc(s.rot) + '</span><b class="mono">' +
        (comPct && total ? Math.round(s.v / total * 100) + '%' : H.num(Math.round(s.v))) + '</b></span>';
    }).join('') + '</div>';
  }
  /** Barras horizontais na MESMA escala para todas as linhas: escala por linha
   *  faria quem fez 20 parecer igual a quem fez 200 (`renderGerCapacidade`). */
  function barrasH(linhas, o) {
    o = o || {};
    var max = Math.max.apply(null, [1].concat(linhas.map(function (l) { return Math.max(l.v || 0, l.v2 || 0); })));
    return '<div class="gx-bh">' + linhas.map(function (l) {
      var b = '<span class="gx-bt"><i style="width:' + ((l.v || 0) / max * 100).toFixed(2) + '%;background:' + (l.cor || o.cor || 'var(--ac)') + '"></i></span>';
      if (o.duas) b += '<span class="gx-bt"><i style="width:' + ((l.v2 || 0) / max * 100).toFixed(2) + '%;background:' + (o.cor2 || 'var(--ok)') + '"></i></span>';
      return '<div class="gx-bl"' + (l.titulo ? ' title="' + esc(l.titulo) + '"' : '') + '><span class="gx-bn ell">' + esc(l.rot) + '</span>' +
        '<span class="gx-bb">' + b + '</span><span class="gx-bv mono">' + (l.txt != null ? l.txt : H.num(Math.round(l.v || 0))) + '</span>' +
        (l.extra != null ? '<span class="gx-bx mono">' + l.extra + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  }
  /** Colunas empilhadas. `cols` = [{rot, partes:[{v, cor}], txt}]. */
  function colunas(cols, alt) {
    alt = alt || 150;
    var max = Math.max.apply(null, [1].concat(cols.map(function (c) { return c.partes.reduce(function (t, p) { return t + (p.v || 0); }, 0); })));
    return '<div class="gx-cols" style="height:' + (alt + 40) + 'px">' + cols.map(function (c) {
      var tot = c.partes.reduce(function (t, p) { return t + (p.v || 0); }, 0);
      return '<div class="gx-col"><span class="mono gx-cv">' + (c.txt != null ? c.txt : H.num(Math.round(tot))) + '</span>' +
        '<div class="gx-cb" style="height:' + (tot / max * alt).toFixed(1) + 'px">' +
        c.partes.slice().reverse().map(function (p) { return p.v ? '<span style="flex:' + p.v + ';background:' + p.cor + '" title="' + esc((p.nome || '') + ': ' + p.v) + '"></span>' : ''; }).join('') +
        '</div><span class="note gx-cl">' + esc(c.rot) + '</span></div>';
    }).join('') + '</div>';
  }
  /** Linhas em SVG. `series` = [{nome, cor, v:[n|null]}]; null quebra a linha
   *  (mes sem medida nao vira zero). Escala fixa 0..max, com meta tracejada. */
  function linhas(series, rotulos, o) {
    o = o || {};
    var W = 600, Hh = 210, L = 40, R = 14, T = 14, B = 26;
    var max = o.max != null ? o.max : Math.max.apply(null, [1].concat(series.map(function (s) { return Math.max.apply(null, [0].concat(s.v.filter(function (x) { return x != null; }))); })));
    var n = rotulos.length;
    var x = function (i) { return L + (n <= 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1)); };
    var y = function (v) { return T + (Hh - T - B) * (1 - v / max); };
    var suf = o.sufixo || '';
    var g = '';
    [0, 0.5, 1].forEach(function (f) {
      var v = Math.round(max * f);
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--bd)" stroke-width="1"/>' +
        '<text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="var(--tx4)">' + v + suf + '</text>';
    });
    if (o.meta != null) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(o.meta) + '" y2="' + y(o.meta) + '" stroke="var(--wn)" stroke-width="1.4" stroke-dasharray="5 5"/>';
    rotulos.forEach(function (r, i) { g += '<text x="' + x(i) + '" y="' + (Hh - 6) + '" text-anchor="middle" font-size="11" fill="var(--tx3)">' + esc(r) + '</text>'; });
    series.forEach(function (s) {
      var seg = [], segs = [];
      s.v.forEach(function (v, i) { if (v == null) { if (seg.length) segs.push(seg); seg = []; } else seg.push(x(i).toFixed(1) + ',' + y(v).toFixed(1)); });
      if (seg.length) segs.push(seg);
      segs.forEach(function (p) { g += '<polyline fill="none" stroke="' + s.cor + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" points="' + p.join(' ') + '"/>'; });
      s.v.forEach(function (v, i) {
        if (v == null) return;
        g += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3.4" fill="' + s.cor + '"><title>' + esc(s.nome + ' · ' + rotulos[i] + ': ' + v + suf) + '</title></circle>';
      });
    });
    return '<svg class="gx-svg" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="' + esc(o.rotulo || '') + '">' + g + '</svg>';
  }

  /** O seletor do mes: anterior, lista e proximo, tudo pelo hash. */
  function seletorMes(prefixo, alvo) {
    var opcoes = [], base = mesSoma(mesCorrente(), 1);
    for (var i = 0; i < 25; i++) opcoes.push(mesSoma(base, -i));
    if (opcoes.indexOf(alvo) < 0) opcoes.push(alvo);
    return '<div class="row" style="gap:8px;flex-wrap:wrap">' +
      '<a class="btns" href="#' + prefixo + '/' + mesSoma(alvo, -1) + '" title="Mês anterior">‹ ' + esc(H.MESES_C[+mesSoma(alvo, -1).slice(5) - 1]) + '</a>' +
      '<select class="in gx-mes" data-prefixo="' + esc(prefixo) + '" aria-label="Mês" style="height:32px">' +
      opcoes.map(function (o) { return '<option value="' + o + '"' + (o === alvo ? ' selected' : '') + '>' + esc(rotuloMes(o)) + '</option>'; }).join('') +
      '</select><a class="btns" href="#' + prefixo + '/' + mesSoma(alvo, 1) + '" title="Próximo mês">' + esc(H.MESES_C[+mesSoma(alvo, 1).slice(5) - 1]) + ' ›</a></div>';
  }
  function ligaSeletorMes(el) {
    Array.prototype.forEach.call(el.querySelectorAll('.gx-mes'), function (s) {
      s.addEventListener('change', function () { location.hash = s.getAttribute('data-prefixo') + '/' + s.value; });
    });
  }
  function cabecalho(titulo, sub, direita, antes) {
    return '<header class="gx-hd"><div style="display:flex;flex-direction:column;gap:6px;min-width:0;flex:1 1 380px">' + (antes || '') +
      '<h1 class="h1">' + titulo + '</h1>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</div>' +
      (direita ? '<div class="row" style="flex-wrap:wrap;gap:8px">' + direita + '</div>' : '') + '</header>';
  }
  /** Pode abrir o item no app? O Item e de outra tela; ela diz quem a ve. */
  function podeItem() {
    var t = raiz.AXIS_APP.APP.telas.item;
    return !!t && (!t.papeis || t.papeis.indexOf(raiz.AXIS_APP.APP.papel) >= 0);
  }
  function codLink(m) {
    return podeItem() ? '<a class="code" href="' + H.hrefItem(m) + '" style="text-decoration:none">' + esc(m.codigo || '—') + '</a>' : H.cod(m);
  }
  /** Paginacao simples: a base real tem centenas de linhas. */
  function paginar(lista, pag, por) {
    var tot = Math.max(1, Math.ceil(lista.length / por));
    var p = Math.min(Math.max(0, pag || 0), tot - 1);
    return { itens: lista.slice(p * por, p * por + por), pag: p, tot: tot };
  }
  function navPag(pg, n, acao) {
    if (pg.tot <= 1) return '';
    return '<div class="row" style="justify-content:space-between;font-size:12.5px;color:var(--tx3)"><span>' + H.num(n) + ' linhas · página ' + (pg.pag + 1) + ' de ' + pg.tot + '</span>' +
      '<span class="row" style="gap:6px"><button type="button" class="btns" data-' + acao + '="' + (pg.pag - 1) + '"' + (pg.pag <= 0 ? ' disabled' : '') + '>‹ Anterior</button>' +
      '<button type="button" class="btns" data-' + acao + '="' + (pg.pag + 1) + '"' + (pg.pag >= pg.tot - 1 ? ' disabled' : '') + '>Próxima ›</button></span></div>';
  }

  /* CSS desta familia de telas (paineis, relatorios, fechamento): uma vez so.
     Grades por classe, e nao por `style` inline, para o celular poder ter duas
     colunas de KPI em vez de uma — a regra generica do nucleo empilha tudo. */
  function css() {
    if (typeof document === 'undefined' || document.getElementById('css-tela-paineis')) return;
    var s = document.createElement('style');
    s.id = 'css-tela-paineis';
    s.textContent = [
      '.axa .gx-hd{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px}',
      '.axa .gx-g{display:grid;gap:16px;align-items:start}',
      '.axa .gx-k4{grid-template-columns:repeat(4,minmax(0,1fr))}.axa .gx-k5{grid-template-columns:repeat(5,minmax(0,1fr))}.axa .gx-k6{grid-template-columns:repeat(6,minmax(0,1fr))}',
      '.axa .gx-k4,.axa .gx-k5,.axa .gx-k6{align-items:stretch}',
      '.axa .gx-3{grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr);align-items:stretch}',
      '.axa .gx-2{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.axa .gx-2a{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)}',
      '.axa .gx-2b{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)}.axa .gx-2c{grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)}',
      '.axa .gx-as{grid-template-columns:280px minmax(0,1fr)}.axa .gx-as3{grid-template-columns:340px minmax(0,1fr)}',
      '.axa .gx-col-f{display:flex;flex-direction:column;gap:16px;min-width:0}',
      '.axa .gx-d{display:block;font-size:12px;color:var(--tx3)}.axa .gx-d.up{color:var(--ok-t)}.axa .gx-d.down{color:var(--dg-t)}',
      '.axa .k .note{font-size:12px}',
      '.axa .gx-rosca{position:relative;flex-shrink:0}.axa .gx-rc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}',
      '.axa .gx-rc b{font-family:var(--font-title);font-size:22px;line-height:26px}.axa .gx-rc span{font-size:11px;color:var(--tx3)}',
      '.axa .gx-lr{display:flex;flex-direction:column;gap:7px;font-size:12.5px;color:var(--tx2);min-width:0;flex:1}',
      '.axa .gx-li{display:flex;align-items:center;gap:8px;min-width:0}.axa .gx-li i{width:9px;height:9px;border-radius:3px;flex-shrink:0}.axa .gx-li b{margin-left:auto;font-weight:500;color:var(--tx3);font-size:12px}',
      '.axa .gx-leg{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:var(--tx3)}.axa .gx-leg .gx-li i{width:10px;height:10px}',
      '.axa .gx-bh{display:flex;flex-direction:column;gap:10px}',
      '.axa .gx-bl{display:grid;grid-template-columns:minmax(80px,150px) minmax(0,1fr) auto auto;gap:12px;align-items:center;font-size:12.5px}',
      '.axa .gx-bb{display:flex;flex-direction:column;gap:3px}.axa .gx-bt{display:block;height:8px;border-radius:4px;background:var(--track);overflow:hidden}.axa .gx-bt i{display:block;height:100%;border-radius:4px}',
      '.axa .gx-bv{min-width:48px;text-align:right;font-size:11.5px;color:var(--tx2)}.axa .gx-bx{min-width:40px;text-align:right;font-size:11.5px;color:var(--tx3)}',
      '.axa .gx-cols{display:flex;align-items:flex-end;gap:12px;padding-top:6px}',
      '.axa .gx-col{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;height:100%}',
      '.axa .gx-cb{width:100%;max-width:72px;display:flex;flex-direction:column;border-radius:6px 6px 0 0;overflow:hidden;min-height:2px;background:var(--track)}',
      '.axa .gx-cb span{display:block;min-height:2px}.axa .gx-cv{font-size:11.5px;color:var(--tx2)}.axa .gx-cl{font-size:11px;white-space:nowrap}',
      '.axa .gx-svg{width:100%;height:auto;display:block}',
      '.axa .gx-al{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px;border-radius:11px;background:var(--sf2);text-decoration:none;color:var(--tx)}',
      '.axa a.gx-al:hover{background:var(--sf4)}',
      '.axa .gx-seg{display:inline-flex;gap:6px}.axa .gx-seg .btns{height:28px}',
      '.axa .gx-card{display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:12px;background:var(--sf2);border:1px solid transparent}',
      '.axa .gx-card.on{border-color:rgba(var(--ac-rgb),.45)}',
      '.axa details.gx-card>summary{list-style:none;cursor:pointer;display:flex;flex-direction:column;gap:8px}.axa details.gx-card>summary::-webkit-details-marker{display:none}',
      '.axa .gx-mod{font:inherit;font-size:13px;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 11px;border-radius:9px;color:var(--tx2);text-decoration:none;cursor:pointer;background:transparent;border:0;text-align:left;width:100%}',
      '.axa .gx-mod.on{background:var(--sf4);color:var(--tx);font-weight:700}.axa .gx-mod:hover{background:var(--sf4)}',
      '.axa .gx-filtros{display:flex;flex-direction:column;gap:6px}.axa .gx-filtros .in{width:100%}',
      '.axa .gx-tw{overflow-x:auto}.axa .gx-tw .tbl{min-width:480px}.axa .tbl .code{white-space:nowrap}',
      '.axa .gx-sl{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;background:var(--sf2);font-size:13px}',
      '.axa .gx-ck{width:18px;height:18px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0}',
      '@container app (max-width: 760px){',
      '.axa .gx-k4,.axa .gx-k5,.axa .gx-k6{grid-template-columns:repeat(2,minmax(0,1fr))}',
      '.axa .gx-3,.axa .gx-2,.axa .gx-2a,.axa .gx-2b,.axa .gx-2c,.axa .gx-as,.axa .gx-as3{grid-template-columns:minmax(0,1fr)}',
      '.axa .gx-bl{grid-template-columns:minmax(70px,110px) minmax(0,1fr) auto}.axa .gx-bx{display:none}',
      '.axa .gx-cols{gap:6px}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  var G = raiz.AXIS_GER = {
    mesSoma: mesSoma, mesCorrente: mesCorrente, limites: limites, nomeMes: nomeMes, rotuloMes: rotuloMes, alvoDe: alvoDe,
    feriadosDe: feriadosDe, vivas: vivas, todas: todas, temaNome: temaNome,
    mesTrilhaDe: mesTrilhaDe, mesDe: mesDe, mesRolos: mesRolos, mesDesdeOInicio: mesDesdeOInicio,
    mesDoPeriodo: mesDoPeriodo, mesClassifica: mesClassifica, fechamentoDoMes: fechamentoDoMes,
    splitDevsPrazo: splitDevsPrazo, prazoClassifica: prazoClassifica, prazoDoMes: prazoDoMes,
    rateiaHoras: rateiaHoras, horasReaisDe: horasReaisDe, gerencialDoMes: gerencialDoMes, entradasDoMes: entradasDoMes,
    PM_FUNIS: PM_FUNIS, pmFluxo: pmFluxo, pmDur: pmDur, pmSemanas: pmSemanas,
    gerSemanasDoMes: gerSemanasDoMes, gerPontuadasSemData: gerPontuadasSemData, gerItensPontuados: gerItensPontuados,
    gerCortesDePontos: gerCortesDePontos, relRaizNome: relRaizNome, relRaizDe: relRaizDe, relVivasDe: relVivasDe,
    AP_SECOES: AP_SECOES, janelaMes: janelaMes, relComoAndou: relComoAndou, relTemasDe: relTemasDe, relEntregues: relEntregues, selo: selo,
    PALETA: PALETA, corPct: corPct, chipPct: chipPct, delta: delta, k: k, leg: leg, rosca: rosca, legendaRosca: legendaRosca,
    barrasH: barrasH, colunas: colunas, linhas: linhas, seletorMes: seletorMes, ligaSeletorMes: ligaSeletorMes,
    cobertura: cobertura, cabecalho: cabecalho, codLink: codLink, podeItem: podeItem, paginar: paginar, navPag: navPag, css: css
  };

  // ═══ A TELA ═══════════════════════════════════════════════════════════
  var _pmAba = 'funil';     // Fluxo e pessoas: por funil, por semana, por sistema
  var _pagDem = 0;          // Visao geral: pagina da tabela de demandas do mes
  var _sprSel = '';         // Pontos: sprint aberta no ranking
  var _alvoPag = '';        // trocar de mes volta a tabela para a pagina 1

  function abasDe(r) {
    var m = r.param && ehAlvo(r.param.split('/')[0]) ? '/' + r.param.split('/')[0] : (_alvo ? '/' + _alvo : '');
    return [
      { id: 'visao', rotulo: 'Visão geral', href: '#paineis/visao' + m },
      { id: 'fluxo', rotulo: 'Fluxo e pessoas', href: '#paineis/fluxo' + m },
      { id: 'pontos', rotulo: 'Pontos', href: '#paineis/pontos' + m }
    ];
  }

  // ── Visao geral ─────────────────────────────────────────────────────
  function visao(ctx, alvo) {
    var D = ctx.D, g = gerencialDoMes(D, alvo), en = entradasDoMes(D, alvo);
    var hj = H.hoje();
    var botoes = acoesDoMes(alvo);
    var h = cabecalho('Visão gerencial', 'Saúde do fluxo em ' + esc(rotuloMes(alvo)) + '. As horas e as demandas são as do início no mês, como no Gerencial do admin.',
      seletorMes('paineis/visao', alvo) + botoes);

    // KPIs: os seis do topo do Gerencial (`renderGerencial`).
    var pctDig = g.concluidos.length ? ' · ' + Math.round(g.quantasDigitaram / g.concluidos.length * 100) + '%' : '';
    h += '<div class="gx-g gx-k6">' +
      k('Demandas no mês', H.num(g.items.length), delta(g.items.length, g.prevItems.length), 'var(--in-t)') +
      k('Horas planejadas', H.num(g.totalPlan) + 'h', delta(g.totalPlan, g.prevPlan), 'var(--in-t)') +
      k('Horas realizadas', H.num(g.totalReal) + 'h', delta(g.totalReal, g.prevReal) + '<span class="gx-d" title="A hora lançada na conclusão. Onde ela não foi lançada, entra a aproximação: o dia útil do dev vale 8h e é dividido entre as demandas que ele tinha em mãos.">medida, com aproximação</span>', 'var(--ok-t)') +
      k('Horas lançadas', H.num(g.horasDigitadas) + 'h', g.quantasDigitaram + ' de ' + g.concluidos.length + ' concluídas' + pctDig) +
      k('Concluídas', H.num(g.concluidos.length), delta(g.concluidos.length, g.prevConc.length), 'var(--ok-t)') +
      k('Eficiência', g.totalPlan ? g.efic + '%' : '—', g.totalPlan ? 'realizado ÷ planejado' : 'sem horas planejadas', g.totalPlan ? 'var(--' + g.eficCor + '-t)' : '') +
      '</div>';

    // Rosca por etapa (as demandas do mes), rosca por tipo (as que entraram) e horas por tema.
    var porEtapa = {};
    g.items.forEach(function (m) { var e = H.etapaDe(m); porEtapa[e] = (porEtapa[e] || 0) + 1; });
    var segE = H.ETAPAS.concat([H.ETAPA_POR_ID.atrasado]).filter(function (e) { return porEtapa[e.id]; })
      .map(function (e) { return { v: porEtapa[e.id], cor: e.dot, rot: e.rotulo }; });
    var segT = [{ v: en.evo, cor: 'var(--ac)', rot: 'Evolução (melhoria)' }, { v: en.sust, cor: 'var(--in)', rot: 'Sustentação (erro/bug)' },
                { v: en.sem, cor: 'var(--tx4)', rot: 'Sem classificação' }];
    var temas = ordena(g.planPorTema).slice(0, 7).map(function (t) {
      return { rot: t[0], v: t[1], v2: g.realPorTema[t[0]] || 0, txt: Math.round(t[1]) + 'h', extra: Math.round(g.realPorTema[t[0]] || 0) + 'h', titulo: t[0] };
    });
    var sobraT = Object.keys(g.planPorTema).length - temas.length;
    var dE = en.doMes.length - en.ant;
    h += '<div class="gx-g gx-3">' +
      '<section class="pn"><div class="row" style="justify-content:space-between"><h2 class="h2">Itens por etapa</h2><span class="note">demandas do mês</span></div>' +
        (segE.length ? '<div class="row" style="gap:20px;align-items:center">' + rosca(segE, H.num(g.items.length), 'itens') + legendaRosca(segE) + '</div>'
                     : H.vazio('chart', 'Nenhuma demanda com início neste mês')) + '</section>' +
      '<section class="pn"><div class="row" style="justify-content:space-between"><h2 class="h2">Entraram por tipo</h2><span class="note">' +
        (en.ant || en.doMes.length ? (dE === 0 ? 'igual ao mês anterior' : (dE > 0 ? '+' : '') + dE + ' vs. ' + en.ant) : '') + '</span></div>' +
        (en.doMes.length ? '<div class="row" style="gap:20px;align-items:center">' + rosca(segT, H.num(en.doMes.length), 'entraram') + legendaRosca(segT, true) + '</div>'
                         : H.vazio('inbox', 'Nenhuma demanda aberta neste mês')) + '</section>' +
      '<section class="pn"><div class="row" style="justify-content:space-between"><h2 class="h2">Horas por tema</h2>' +
        '<span class="gx-leg">' + leg('var(--in)', 'planejado') + leg('var(--ok)', 'realizado') + '</span></div>' +
        (temas.length ? barrasH(temas, { duas: true, cor: 'var(--in)', cor2: 'var(--ok)' }) +
          (sobraT > 0 ? '<span class="note">e mais ' + sobraT + (sobraT === 1 ? ' tema' : ' temas') + ' com menos horas.</span>' : '')
          : H.vazio('clock', 'Sem horas planejadas no mês')) + '</section></div>';

    // Cumprimento e prazo nos ultimos seis meses, com a meta de 80% que as
    // duas abas do admin usam como corte do verde.
    var meses = [], cumpre = [], prazo = [];
    for (var i = 5; i >= 0; i--) {
      var a = mesSoma(alvo, -i);
      meses.push(H.MESES_C[+a.slice(5) - 1]);
      cumpre.push(fechamentoDoMes(D, a).pct);
      prazo.push(prazoDoMes(D, a).pct);
    }
    var temLinha = cumpre.concat(prazo).some(function (v) { return v != null; });
    var al = atencao(ctx);
    h += '<div class="gx-g gx-2a">' +
      '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2">Cumprimento e entregas no prazo por mês</h2><span class="note">tracejado = meta 80%</span></div>' +
        (temLinha ? linhas([{ nome: 'Cumprimento do compromisso', cor: 'var(--ac)', v: cumpre }, { nome: 'Entregues no prazo', cor: 'var(--in)', v: prazo }], meses,
                           { max: 100, meta: 80, sufixo: '%', rotulo: 'Cumprimento e prazo por mês' })
                  : H.vazio('trend', 'Ainda não há meses medidos', 'O cumprimento nasce da trilha de meses; o prazo, das conclusões com prazo combinado.')) +
        '<div class="gx-leg">' + leg('var(--ac)', 'cumprimento do compromisso') + leg('var(--in)', 'entregues no prazo') + '</div>' +
        '<span class="note">Mês sem medida fica sem ponto, e não em zero: antes da trilha de meses não há compromisso registrado.</span></section>' +
      '<section class="pn"><div class="row" style="justify-content:space-between"><h2 class="h2">Pedem atenção</h2>' +
        (al.total ? H.chip(String(al.total), 'dg') : '') + '</div>' + al.html + '</section></div>';

    // Horas por dev e a validacao das entregas do mes.
    var devs = ordena(g.planPorDev).map(function (d) {
      return { rot: d[0], v: d[1], v2: g.realPorDev[d[0]] || 0, txt: Math.round(d[1]) + 'h', extra: Math.round(g.realPorDev[d[0]] || 0) + 'h' };
    });
    Object.keys(g.realPorDev).forEach(function (n) { if (!g.planPorDev[n]) devs.push({ rot: n, v: 0, v2: g.realPorDev[n], txt: '0h', extra: Math.round(g.realPorDev[n]) + 'h' }); });
    h += '<div class="gx-g gx-2">' +
      '<section class="pn"><div class="row" style="justify-content:space-between"><h2 class="h2">Horas por desenvolvedor</h2>' +
        '<span class="gx-leg">' + leg('var(--in)', 'planejado') + leg('var(--ok)', 'realizado') + '</span></div>' +
        (devs.length ? barrasH(devs, { duas: true, cor: 'var(--in)', cor2: 'var(--ok)' }) : H.vazio('users', 'Sem demandas com dev no mês')) + '</section>' +
      cobertura(g.concluidos) + '</div>';

    // O que o Gerencial do admin tinha e esta tela nao: as demandas por dev
    // empilhadas por tema, as comprometidas sem pontuacao e as entradas do mes
    // por tema.
    h += '<div class="gx-g gx-2">' + devsPorTemaHtml(D, g.items) + semPontosHtml(D) + '</div>' + entradasPorTemaHtml(D, alvo, en);

    // A lista que compoe os numeros: "todo numero abre a lista de itens".
    var linhasT = g.items.slice().sort(function (a, b) { return String(a.inicio || '').localeCompare(String(b.inicio || '')); });
    var pg = paginar(linhasT, _pagDem, 20);
    h += '<section class="pn" id="gx-dem"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2">Demandas do mês</h2>' +
      '<span class="note">* hora aproximada pelo rateio: ninguém lançou hora na conclusão</span></div>' +
      (linhasT.length ? '<div class="gx-tw"><table class="tbl"><thead><tr><th>ITEM</th><th>TEMA</th><th>DEV</th><th>INÍCIO</th><th>PRAZO</th>' +
        '<th class="num">H. PLAN.</th><th class="num">H. REAL.</th><th class="num">DESVIO</th><th>ETAPA</th></tr></thead><tbody>' +
        pg.itens.map(function (m) {
          var hp = Math.round(g.hPlan.get(m.id) || 0);
          var real = horasReaisDe(m, g.hReal);
          var conc = m.status_planejamento === 'concluido' || m.status === 'concluida';
          var desvio = conc ? Math.round(real.h - hp) : null;
          var hr = conc ? (real.medida ? H.num(real.h) + 'h' : Math.round(real.h) + 'h*') : '—';
          return '<tr><td style="color:var(--tx)"><span class="row" style="gap:8px">' + codLink(m) + '<span class="ell" style="max-width:300px" title="' + esc(m.titulo) + '">' + esc(m.titulo) + '</span></span></td>' +
            '<td class="ell" style="max-width:180px">' + esc(H.caminho(m.tema_id) || '—') + '</td><td>' + esc(m.dev || '—') + '</td>' +
            '<td class="mono">' + (H.dm(m.inicio) || '—') + '</td><td class="mono">' + (H.dm(m.entrega) || '—') + '</td>' +
            '<td class="num mono">' + (hp ? hp + 'h' : '—') + '</td><td class="num mono">' + hr + '</td>' +
            '<td class="num mono" style="color:' + (desvio > 0 ? 'var(--dg-t)' : desvio < 0 ? 'var(--ok-t)' : 'var(--tx3)') + '">' +
              (desvio === null ? '—' : (desvio > 0 ? '+' : '') + desvio + 'h') + '</td><td>' + H.chipEtapa(m) + '</td></tr>';
        }).join('') + '</tbody></table></div>' + navPag(pg, linhasT.length, 'pag-dem')
        : H.vazio('calendar', 'Nenhuma demanda com início em ' + rotuloMes(alvo))) + '</section>';
    return h;
  }

  /** O QUE SAIA DO GERENCIAL DO ADMIN, AGORA DAQUI: o deck do mes (montado no
   *  Fechamento, que e do PM/PO) e a base do mes em CSV (`data-axis-csv`, em
   *  axis-tela-relatorios.js), do mes que esta na tela. */
  function acoesDoMes(alvo) {
    return (H.pode('fechar') ? '<a class="btn" href="#fechamento/apresentacao/' + alvo + '" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none">' + H.ico('present') + ' Gerar apresentação</a>' : '') +
      (H.pode('gerencial') ? '<button type="button" class="btn" data-axis-csv="' + alvo + '" title="Uma linha por demanda × pessoa, com pontos, horas, prazo, frente e projeto">' + H.ico('download') + ' Base do mês (CSV)</button>' : '');
  }

  /* ── Comprometidas sem pontuacao: `ETAPAS_COMPROMETIDAS`, `semPontuacao` e
     `renderGerSemPontos` (admin.html). Nao filtra por mes: e o que esta na
     esteira agora, com data combinada e sem estimativa. */
  var ETAPAS_COMPROMETIDAS = ['planejado', 'em_andamento', 'validacao_area', 'validacao', 'concluido'];
  function semPontosDe(D) {
    var comprometidas = todas(D).filter(function (m) { return !m.oculto && !m.mesclado_em && ETAPAS_COMPROMETIDAS.indexOf(m.status_planejamento || '') >= 0; });
    var sem = comprometidas.filter(function (m) { return !(Number(m.poker_pontos) > 0); });
    var porDev = {};
    sem.forEach(function (m) { var k = String(m.dev || '').trim() || '(sem responsável)'; (porDev[k] = porDev[k] || []).push(m); });
    return { comprometidas: comprometidas, sem: sem, pct: comprometidas.length ? Math.round(sem.length / comprometidas.length * 100) : 0,
             porDev: Object.keys(porDev).map(function (k) { return [k, porDev[k]]; }).sort(function (a, b) { return b[1].length - a[1].length; }) };
  }
  function semPontosHtml(D) {
    var r = semPontosDe(D);
    var h = '<section class="pn"><div class="row" style="justify-content:space-between"><h2 class="h2">Comprometidas sem pontuação</h2><span class="note">de Planejado em diante · hoje</span></div>' +
      '<div class="gx-g gx-k4" style="grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">' +
        k('Sem pontuação', H.num(r.sem.length), r.pct + '% das comprometidas', r.sem.length ? 'var(--wn-t)' : '') +
        k('Comprometidas', H.num(r.comprometidas.length), 'de Planejado em diante') +
        k('Com pontuação', H.num(r.comprometidas.length - r.sem.length), 'base para a data') + '</div>';
    if (!r.sem.length) return h + H.vazio('check', 'Todas as demandas comprometidas estão pontuadas') + '</section>';
    return h + '<div class="gx-tw"><table class="tbl"><thead><tr><th>RESPONSÁVEL</th><th class="num">SEM PONTOS</th><th>DEMANDAS</th></tr></thead><tbody>' +
      r.porDev.slice(0, 12).map(function (x) {
        return '<tr><td style="color:var(--tx);white-space:nowrap">' + esc(x[0]) + '</td><td class="num mono">' + x[1].length + '</td><td><span class="row" style="gap:6px;flex-wrap:wrap">' +
          x[1].map(function (m) { return codLink(m); }).join('') + '</span></td></tr>';
      }).join('') + '</tbody></table></div>' + (r.porDev.length > 12 ? '<span class="note">e mais ' + (r.porDev.length - 12) + ' responsáveis.</span>' : '') +
      '<span class="note">Sem pontos, o planejado de quem recebeu a demanda aparece menor do que é.</span></section>';
  }

  /** Entradas do mes por tema (`renderGerEntradas`): pela data de criacao,
   *  com o tipo de cada uma. */
  function entradasPorTemaHtml(D, alvo, en) {
    var tipoDe = function (m) { return m.tipo === 'sustentacao' ? 'sust' : (m.tipo === 'evolucao' ? 'evo' : 'sem'); };
    var por = {};
    en.doMes.forEach(function (m) {
      var kk = m.tema_id == null ? '__sem__' : m.tema_id;
      por[kk] = por[kk] || { total: 0, sust: 0, evo: 0, sem: 0 };
      por[kk].total++; por[kk][tipoDe(m)]++;
    });
    var nomeT = function (kk) { return kk === '__sem__' ? '(sem tema)' : (((D || {}).temas || []).find(function (t) { return String(t.id) === String(kk); }) || {}).nome || '(tema removido)'; };
    var linhasE = Object.keys(por).map(function (kk) { return [kk, por[kk]]; }).sort(function (a, b) { return b[1].total - a[1].total; });
    var h = '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2">Entradas do mês por tema</h2><span class="note">abertas em ' + esc(rotuloMes(alvo)) + ', pela data de criação</span></div>';
    if (!linhasE.length) return h + H.vazio('inbox', 'Nenhuma demanda foi aberta neste mês') + '</section>';
    var cel = function (v, cor) { return '<td class="num mono"' + (v ? ' style="color:' + cor + '"' : '') + '>' + (v || '—') + '</td>'; };
    return h + '<div class="gx-tw"><table class="tbl"><thead><tr><th>TEMA</th><th class="num">TOTAL</th><th class="num">SUSTENTAÇÃO</th><th class="num">EVOLUÇÃO</th><th class="num">SEM TIPO</th><th style="width:22%">PROPORÇÃO</th></tr></thead><tbody>' +
      linhasE.map(function (x) {
        var v = x[1], pS = Math.round(v.sust / v.total * 100), pE = Math.round(v.evo / v.total * 100);
        return '<tr><td class="ell" style="color:var(--tx);max-width:320px">' + esc(nomeT(x[0])) + '</td><td class="num mono" style="color:var(--tx);font-weight:700">' + v.total + '</td>' +
          cel(v.sust, 'var(--in-t)') + cel(v.evo, 'var(--ac-t)') + cel(v.sem, 'var(--tx3)') +
          '<td><div class="bar" title="' + pS + '% sustentação · ' + pE + '% evolução"><span style="width:' + pS + '%;background:var(--in)"></span><span style="width:' + pE + '%;background:var(--ac)"></span></div></td></tr>';
      }).join('') +
      '<tr><td style="color:var(--tx);font-weight:700">Total do mês</td><td class="num mono" style="font-weight:700">' + en.doMes.length + '</td>' +
        '<td class="num mono">' + (en.sust || '—') + '</td><td class="num mono">' + (en.evo || '—') + '</td><td class="num mono">' + (en.sem || '—') + '</td><td></td></tr>' +
      '</tbody></table></div><div class="gx-leg">' + leg('var(--in)', 'sustentação (erro/bug)') + leg('var(--ac)', 'evolução (melhoria)') + '</div></section>';
  }

  /** Demandas por desenvolvedor, empilhadas por tema (`renderGerDevChart`):
   *  as demandas do mes (pelo inicio), contadas para cada dev da dupla. */
  function devsPorTemaHtml(D, items) {
    var temas = (D || {}).temas || [];
    var devs = [];
    items.forEach(function (m) { splitDevsLocal(m.dev).forEach(function (d) { if (d && d !== 'Sem dev' && devs.indexOf(d) < 0) devs.push(d); }); });
    devs.sort();
    var h = '<section class="pn"><div class="row" style="justify-content:space-between"><h2 class="h2">Demandas por desenvolvedor</h2><span class="note">empilhado por tema · demandas do mês</span></div>';
    if (!devs.length) return h + H.vazio('users', 'Sem demandas com dev no período') + '</section>';
    var eDe = function (m, d) { return raiz.DEVNOME ? raiz.DEVNOME.eDe(m, d) : splitDevsLocal(m.dev).indexOf(d) >= 0; };
    var cont = function (d, temaId) {
      return items.filter(function (m) { return eDe(m, d) && (temaId === null ? !temas.find(function (t) { return t.id === m.tema_id; }) : m.tema_id === temaId); }).length;
    };
    var series = temas.map(function (t) { return { nome: t.nome, v: devs.map(function (d) { return cont(d, t.id); }) }; })
      .filter(function (x) { return x.v.some(function (n) { return n > 0; }); });
    var semT = devs.map(function (d) { return cont(d, null); });
    if (semT.some(function (n) { return n > 0; })) series.push({ nome: 'Sem tema', v: semT, sem: true });
    // Cor por tema: os sete de maior volume tem a sua; o resto divide o cinza.
    var tot = function (x) { return x.v.reduce(function (a, b) { return a + b; }, 0); };
    var ordem = series.slice().sort(function (a, b) { return tot(b) - tot(a); });
    var cor = new Map();
    ordem.forEach(function (x, i) { cor.set(x, x.sem || i >= 7 ? 'var(--tx4)' : PALETA[i]); });
    var totDev = devs.map(function (d, i) { return series.reduce(function (t, x) { return t + x.v[i]; }, 0); });
    var max = Math.max.apply(null, [1].concat(totDev));
    var linhasD = devs.map(function (d, i) { return { d: d, i: i, t: totDev[i] }; }).sort(function (a, b) { return b.t - a.t || a.d.localeCompare(b.d, 'pt-BR'); });
    return h + '<div class="gx-bh">' + linhasD.map(function (l) {
      return '<div class="gx-bl"><span class="gx-bn ell">' + esc(l.d) + '</span><span class="gx-bb"><span class="gx-bt" style="display:flex">' +
        ordem.map(function (x) {
          var v = x.v[l.i];
          return v ? '<i style="display:block;height:100%;border-radius:0;width:' + (v / max * 100).toFixed(2) + '%;background:' + cor.get(x) + '" title="' + esc(x.nome + ': ' + v) + '"></i>' : '';
        }).join('') + '</span></span><span class="gx-bv mono">' + l.t + '</span></div>';
    }).join('') + '</div><div class="gx-leg">' + ordem.slice(0, 7).filter(function (x) { return !x.sem; }).map(function (x) { return leg(cor.get(x), esc(x.nome) + ' · ' + tot(x)); }).join('') +
      (ordem.length > 7 || ordem.some(function (x) { return x.sem; }) ? leg('var(--tx4)', 'outros temas e sem tema') : '') + '</div>' +
      '<span class="note">Demanda de dupla conta para os dois. Passe o mouse sobre a barra para ver o tema.</span></section>';
  }

  /** "Pedem atencao": o que a propria base diz que espera alguem. As mesmas
   *  leituras do sino do nucleo e das faixas do admin, contadas aqui. */
  function atencao(ctx) {
    var vs = H.visiveis(), D = ctx.D, C = raiz.CAPACIDADE;
    var permite = function (id) { var t = raiz.AXIS_APP.APP.telas[id]; return !!t && (!t.papeis || t.papeis.indexOf(ctx.papel) >= 0); };
    var abertas = vs.filter(function (m) { return ['concluido', 'negada'].indexOf(H.colunaDe(m)) < 0; });
    var itens = [];
    var venc = abertas.filter(function (m) { var a = H.atrasoDe(m); return a && a > 0; });
    if (venc.length) itens.push({ t: 'Prazo vencido', d: 'em aberto e passadas do prazo combinado', n: venc.length, cor: 'dg', href: permite('backlog') ? '#backlog/vencido' : '' });
    var val = vs.filter(function (m) { return H.colunaDe(m) === 'validacao'; });
    if (val.length) itens.push({ t: 'Validação do PM/PO pendente', d: 'entregues pelo dev, esperando aprovação', n: val.length, cor: 'wn', href: permite('backlog') ? '#backlog/validacao' : '' });
    var semPt = vs.filter(function (m) { return C && C.semPontuacao(m); });
    if (semPt.length) itens.push({ t: 'Alocadas sem pontuação', d: 'o planejado de quem as recebeu aparece menor', n: semPt.length, cor: 'wn', href: '#paineis/pontos' });
    var semData = gerPontuadasSemData(D);
    if (semData.length) itens.push({ t: 'Pontuadas sem data', d: 'têm tamanho e não têm início nem prazo', n: semData.length, cor: 'wn', href: '#paineis/pontos' });
    var paus = abertas.filter(function (m) { return H.pausada(m); });
    if (paus.length) itens.push({ t: 'Pausadas', d: 'prazo suspenso até a retomada', n: paus.length, cor: 'mg', href: '' });
    var spr = raiz.SPRINTPO && raiz.SPRINTPO.pendentesDeFechamento ? (raiz.SPRINTPO.pendentesDeFechamento(D, H.hoje(), feriadosDe(D)) || []) : [];
    if (spr.length) itens.push({ t: 'Sprint terminada e não fechada', d: spr.map(function (s) { return raiz.SPRINTPO.rotuloCurto(s.rotulo); }).join(', '), n: spr.length, cor: 'wn', href: permite('sprints') ? '#sprints/encerrar' : '' });
    var semConc = relEntregues(D, '0000-00-00', '9999-99-99', '').semData;
    if (semConc) itens.push({ t: 'Concluídas sem data de entrega', d: 'ficam fora de todo fechamento por período', n: semConc, cor: 'bk', href: '' });
    var total = itens.reduce(function (t, x) { return t + x.n; }, 0);
    var html = itens.length ? itens.map(function (x) {
      var tag = x.href ? 'a href="' + x.href + '"' : 'div';
      return '<' + tag + ' class="gx-al"><span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:13px;font-weight:700">' + esc(x.t) + '</span>' +
        '<span class="note ell" style="font-size:12px">' + esc(x.d) + '</span></span>' + H.chip(String(x.n), x.cor) + '</' + (x.href ? 'a' : 'div') + '>';
    }).join('') : H.vazio('check', 'Nada pedindo atenção agora');
    return { total: total, html: html };
  }

  /** A validacao das entregas do mes (`coberturaRender`): planning e comite. */
  function cobertura(concluidos) {
    var S = selo();
    var h = '<section class="pn"><div class="row" style="justify-content:space-between"><h2 class="h2">Validação das entregas</h2><span class="note">concluídas do mês</span></div>';
    if (!S) return h + '<div class="sk" style="height:120px"></div></section>';
    var c = S.cobertura(concluidos || []);
    if (!c.total) return h + H.vazio('shield', 'Nenhuma concluída no mês') + '</section>';
    var linha = function (rot, n, cor) { return { rot: rot, v: n, cor: cor, txt: n + ' · ' + S.pct(n, c.total) + '%' }; };
    return h + barrasH([linha('Planning', c.planning, 'var(--tl)'), linha('Comitê', c.comite, 'var(--pu)'), linha('Sem validação', c.nenhuma, 'var(--tx4)')]) +
      '<span class="note">' + c.total + (c.total === 1 ? ' entrega' : ' entregas') + '. ' +
      (c.ambas ? c.ambas + (c.ambas === 1 ? ' passou' : ' passaram') + ' pelos dois fóruns — por isso as barras não somam o total.' : 'Uma demanda pode ter as duas marcas.') + '</span></section>';
  }

  // ── Fluxo e pessoas ─────────────────────────────────────────────────
  function fluxo(ctx, alvo) {
    var D = ctx.D, f = pmFluxo(D, alvo), pz = prazoDoMes(D, alvo), fc = fechamentoDoMes(D, alvo);
    var L = limites(alvo), hj = H.hoje();
    var h = cabecalho('Fluxo do PM/PO e cumprimento por pessoa',
      'O que passou por Backlog, Em aprovação de requisitos, Planning e Validação, e o que cada dev prometeu e entregou.',
      seletorMes('paineis/fluxo', alvo) + acoesDoMes(alvo),
      '<span class="note">' + esc(rotuloMes(alvo)) + '</span>');
    var val = f.funis.find(function (x) { return x.k === 'validacao'; });
    h += '<div class="gx-g gx-k4">' +
      k('Recebidas pelo PM/PO', H.num(f.recebidas.length), 'demandas que chegaram no mês') +
      k('Despachadas para Planejado', H.num(f.despachadas), 'saíram do Planning', f.despachadas ? 'var(--ok-t)' : '') +
      k('Validações feitas', H.num(val ? val.saiu : 0), 'entregas julgadas no mês', val && val.saiu ? 'var(--wn-t)' : '') +
      k('Jornada (mediana)', pmDur(f.mediana), f.jornadaN ? 'da chegada ao despacho (' + f.jornadaN + ')' : 'nada despachado no mês') + '</div>';

    // A fila: backlog no dia 1 + entraram - sairam = em aberto (`fila.js`).
    // O corte e hoje enquanto o mes corre: o resto do mes ainda nao aconteceu.
    var corte = L.ate > hj ? hj : L.ate;
    var futuro = L.de > hj;
    var F = raiz.FILA, fl = futuro ? null : F.fluxo(todas(D), L.de, corte, L.ate);
    var sem = pmSemanas(alvo).map(function (s) {
      var ent = 0, sai = 0;
      todas(D).forEach(function (m) {
        if (!m || m.oculto || m.mesclado_em) return;
        if (F.noPeriodo(F.entrada(m), s.de, s.ate)) ent++;
        if (F.noPeriodo(F.saida(m), s.de, s.ate)) sai++;
      });
      return { rot: s.rot, partes: [{ v: ent, cor: 'var(--in)', nome: 'entraram' }], txt: String(ent), sai: sai };
    });
    var maxS = Math.max.apply(null, [1].concat(sem.map(function (s) { return Math.max(s.partes[0].v, s.sai); })));
    var barrasSem = '<div class="gx-cols" style="height:170px">' + sem.map(function (s) {
      var a = s.partes[0].v;
      return '<div class="gx-col"><span class="mono gx-cv">' + a + ' · ' + s.sai + '</span><div class="row" style="gap:3px;align-items:flex-end;width:100%;justify-content:center">' +
        '<span style="width:40%;max-width:30px;height:' + (a / maxS * 120).toFixed(1) + 'px;min-height:2px;background:var(--in);border-radius:4px 4px 0 0" title="entraram: ' + a + '"></span>' +
        '<span style="width:40%;max-width:30px;height:' + (s.sai / maxS * 120).toFixed(1) + 'px;min-height:2px;background:var(--ok);border-radius:4px 4px 0 0" title="saíram: ' + s.sai + '"></span>' +
        '</div><span class="note gx-cl">' + esc(s.rot) + '</span></div>';
    }).join('') + '</div>';

    // WIP: onde as demandas estao paradas HOJE, pela coluna do card.
    var wip = {};
    H.visiveis().forEach(function (m) { var c = H.colunaDe(m); wip[c] = (wip[c] || 0) + 1; });
    var atrasadas = H.visiveis().filter(function (m) { return H.etapaDe(m) === 'atrasado'; }).length;
    var linhasW = H.ETAPAS.filter(function (e) { return ['concluido', 'negada'].indexOf(e.id) < 0; })
      .map(function (e) { return { rot: e.rotulo, v: wip[e.id] || 0, cor: e.dot }; });

    h += '<div class="gx-g gx-2">' +
      '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2">Entradas × saídas da fila</h2>' +
        '<span class="gx-leg">' + leg('var(--in)', 'entraram') + leg('var(--ok)', 'saíram') + '</span></div>' +
        (fl ? '<div class="row" style="gap:10px;flex-wrap:wrap;font-size:13px">' +
          '<span><b class="mono">' + fl.backlogInicio + '</b> <span class="note">no dia 1</span></span><span class="note">+</span>' +
          '<span><b class="mono" style="color:var(--in-t)">' + fl.recebidas + '</b> <span class="note">entraram</span></span><span class="note">−</span>' +
          '<span><b class="mono" style="color:var(--ok-t)">' + fl.saidas + '</b> <span class="note">saíram (' + fl.saiuEntregue + ' entregues · ' + fl.saiuNegada + ' recusadas)</span></span><span class="note">=</span>' +
          '<span><b class="mono">' + fl.backlogFim + '</b> <span class="note">em aberto ' + (corte < L.ate ? 'hoje' : 'no fim do mês') + '</span></span></div>' +
          (F.fecha(fl) ? '' : '<div class="lock">' + H.ico('alert') + '<span>A conta da fila não fechou para este mês.</span></div>')
          : '<span class="note">O mês ainda não começou.</span>') +
        barrasSem + '<span class="note">Blocos de 7 dias a partir do dia 1. Entrada pela criação; saída pela conclusão ou recusa.</span></section>' +
      '<section class="pn"><div class="row" style="justify-content:space-between"><h2 class="h2">WIP por etapa</h2><span class="note">hoje · ' + H.num(atrasadas) + ' atrasadas</span></div>' +
        barrasH(linhasW) + '<span class="note">Retrato de agora, e não do mês escolhido: a coluna em que cada card está.</span></section></div>';

    // Funil do PM/PO (`renderGerPM`) e entregas no prazo (`renderGerPrazo`).
    var tab = _pmAba === 'semana' ? tabSemana(f, alvo) : _pmAba === 'sistema' ? tabSistema(f, D) : tabFunil(f);
    var nota = f.semRegistro ? '<div class="lock">' + H.ico('info') + '<span>O histórico de etapas só passou a ser gravado em 05/08/2026: este mês aparece sem movimento por falta de registro, não de trabalho. As recebidas continuam valendo.</span></div>' : '';
    var seg = '<span class="gx-seg">' + [['funil', 'Por funil'], ['semana', 'Por semana'], ['sistema', 'Por sistema']].map(function (x) {
      return '<button type="button" class="btns' + (_pmAba === x[0] ? ' on' : '') + '" data-pm="' + x[0] + '">' + x[1] + '</button>';
    }).join('') + '</span>';

    // Por dev: o cumprimento do mes, o prazo e o retrato de hoje, numa linha.
    var nomes = {};
    fc.devs.forEach(function (d) { nomes[d.nome] = { c: d }; });
    Object.keys(pz.porDev).forEach(function (n) { nomes[n] = nomes[n] || {}; nomes[n].p = pz.porDev[n]; });
    var abertas = H.visiveis().filter(function (m) { return ['concluido', 'negada'].indexOf(H.colunaDe(m)) < 0; });
    abertas.forEach(function (m) {
      H.devsDe(m).forEach(function (n) {
        nomes[n] = nomes[n] || {};
        nomes[n].and = (nomes[n].and || 0) + (H.colunaDe(m) === 'em_andamento' ? 1 : 0);
        var a = H.atrasoDe(m);
        nomes[n].atr = (nomes[n].atr || 0) + (a && a > 0 ? 1 : 0);
      });
    });
    var devs = Object.keys(nomes).map(function (n) { return Object.assign({ nome: n }, nomes[n]); })
      .filter(function (d) { return d.c || d.p || d.and || d.atr; })
      .sort(function (a, b) {
        var ta = a.c ? a.c.comp + a.c.meio : 0, tb = b.c ? b.c.comp + b.c.meio : 0;
        return tb - ta || (b.and || 0) - (a.and || 0) || a.nome.localeCompare(b.nome, 'pt-BR');
      });
    var dash = '<span style="color:var(--tx4)">—</span>';
    // As com atraso, nominalmente (`renderGerPrazo`): o percentual diz o tamanho,
    // a lista diz se foi uma demanda ou um padrao.
    var atrL = pz.atraso.slice().sort(function (a, b) { return pz.cls.get(b.id).dias - pz.cls.get(a.id).dias; });
    h += '<div class="gx-g gx-2b">' +
      '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><h2 class="h2">Funil</h2>' + seg + '</div>' + nota +
        '<div id="gx-pm">' + tab + '</div></section>' +
      '<section class="pn"><h2 class="h2">Entregas no prazo</h2>' +
        '<div class="gx-g gx-k4" style="gap:10px">' +
          '<div class="k" style="padding:12px"><span class="kl">No prazo</span><b style="font-size:22px;color:' + (corPct(pz.pct) || 'var(--tx)') + '">' + (pz.pct === null ? '—' : pz.pct + '%') + '</b></div>' +
          '<div class="k" style="padding:12px"><span class="kl">Com atraso</span><b style="font-size:22px;color:' + (pz.atraso.length ? 'var(--dg-t)' : 'var(--tx)') + '">' + pz.atraso.length + '</b>' +
            (pz.atraso.length ? '<span class="note">média ' + pz.diasMedio + 'd</span>' : '') + '</div>' +
          '<div class="k" style="padding:12px"><span class="kl">Medidas</span><b style="font-size:22px">' + pz.medidas + '</b></div>' +
          '<div class="k" style="padding:12px"><span class="kl">Sem prazo</span><b style="font-size:22px">' + pz.naoMedido.length + '</b></div></div>' +
        (atrL.length ? atrL.slice(0, 6).map(function (m) {
          return '<div class="row" style="gap:8px;font-size:12.5px">' + codLink(m) + '<span class="ell" style="flex:1">' + esc(m.titulo || '') + '</span>' +
            '<span class="mono note">' + H.dm(m.entrega) + ' → ' + H.dm(m.concluido_em) + '</span><b class="mono" style="color:var(--dg-t)">+' + pz.cls.get(m.id).dias + 'd</b></div>';
        }).join('') + (atrL.length > 6 ? '<span class="note">e mais ' + (atrL.length - 6) + '.</span>' : '') : '') +
        '<span class="note">Pela data de conclusão; o prazo é medido até a entrega do dev, e não até a validação do PM/PO.</span></section></div>';
    h += '<section class="pn"><h2 class="h2">Cumprimento do mês por dev</h2>' +
        (devs.length ? '<div class="gx-tw"><table class="tbl"><thead><tr><th>DEV</th><th class="num">COMPROM.</th><th class="num">ENTRARAM</th><th class="num">ENTREGUES</th>' +
          '<th class="num">NÃO SAÍRAM</th><th class="num">NO PRAZO</th><th class="num">%</th><th class="num">EM ANDAMENTO</th><th class="num">ATRASADAS</th></tr></thead><tbody>' +
          devs.map(function (d) {
            var c = d.c, p = d.p;
            var pp = p ? (p.prazo + p.atraso ? p.prazo + ' de ' + (p.prazo + p.atraso) : '—') : dash;
            return '<tr><td style="color:var(--tx)"><span class="row" style="gap:8px">' + H.av(d.nome, 24) + '<span class="ell">' + esc(d.nome) + '</span></span></td>' +
              '<td class="num mono">' + (c ? c.comp : dash) + '</td><td class="num mono">' + (c && c.meio ? c.meio : dash) + '</td>' +
              '<td class="num mono">' + (c ? c.entregue : dash) + '</td><td class="num mono">' + (c && c.transb ? c.transb : dash) + '</td>' +
              '<td class="num mono">' + pp + '</td><td class="num">' + (c ? chipPct(c.pct) : dash) + '</td>' +
              '<td class="num mono">' + (d.and || dash) + '</td><td class="num mono" style="color:' + (d.atr ? 'var(--dg-t)' : '') + '">' + (d.atr || dash) + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<span class="note">Comprometidas, entraram, entregues e não saíram vêm da trilha de meses (a aba Mês do admin); % = entregues sobre o que a pessoa teve no mês. No prazo é das concluídas no mês. Em andamento e atrasadas são de hoje. Demanda de dupla conta para os dois.</span>'
          : H.vazio('users', 'Ninguém com compromisso, entrega ou trabalho em aberto neste mês')) + '</section>';
    return h;
  }
  function tabFunil(f) {
    var quem = f.quem.length ? '<span class="note" style="font-size:12px">Quem moveu: ' + f.quem.slice(0, 5).map(function (q) { return esc(q.nome) + ' ' + q.n; }).join(' · ') +
      (f.quem.length > 5 ? ' · mais ' + (f.quem.length - 5) : '') + '.</span>' : '';
    return '<div class="gx-tw"><table class="tbl"><thead><tr><th>ETAPA</th><th class="num">ENTRARAM</th><th class="num">SAÍRAM</th><th class="num">PARADO HOJE</th><th class="num">TEMPO MÉDIO</th><th>MEDIDO EM</th></tr></thead><tbody>' +
      f.funis.map(function (x) {
        return '<tr><td style="color:var(--tx)"><span class="row" style="gap:8px"><span class="dotc" style="background:' + x.cor + '"></span>' + esc(x.rot) + '</span></td>' +
          '<td class="num mono">' + (x.entradas || '—') + '</td><td class="num mono">' + (x.saiu || '—') + '</td>' +
          '<td class="num mono" style="color:' + (x.parado ? 'var(--wn-t)' : '') + '">' + (x.parado || '—') + '</td><td class="num mono">' + pmDur(x.media) + '</td>' +
          '<td class="note">' + (x.medidos ? x.medidos + ' de ' + (x.medidos + x.semEntrada) : (x.saiu ? '0 de ' + x.saiu : '—')) + '</td></tr>';
      }).join('') + '</tbody></table></div>' + quem;
  }
  function tabSemana(f, alvo) {
    var dia = function (s) { return parseInt(String(s).slice(8, 10), 10); };
    return '<div class="gx-tw"><table class="tbl"><thead><tr><th>SEMANA</th><th class="num">RECEBIDAS</th>' +
      f.funis.map(function (x) { return '<th class="num">SAIU DE ' + esc(x.curto.toUpperCase()) + '</th>'; }).join('') + '<th class="num">DESPACHADAS</th></tr></thead><tbody>' +
      pmSemanas(alvo).map(function (s) {
        var dentro = function (t) { var d = dia(t.dia); return d >= s.ini && d <= s.fim; };
        var rec = f.recebidas.filter(function (m) { var d = dia(String(m.criado_em || '').slice(0, 10)); return d >= s.ini && d <= s.fim; }).length;
        var desp = f.noMes.filter(function (t) { return t.para === 'planejado' && dentro(t); }).length;
        return '<tr><td class="mono">' + s.rot + '</td><td class="num mono">' + (rec || '—') + '</td>' +
          f.funis.map(function (x) { var n = f.noMes.filter(function (t) { return t.de === x.k && dentro(t); }).length; return '<td class="num mono">' + (n || '—') + '</td>'; }).join('') +
          '<td class="num mono" style="color:var(--tx);font-weight:700">' + (desp || '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function tabSistema(f, D) {
    var nome = function (id) { var t = temaNome(D, id); return t ? (raiz.catalogoCurto ? raiz.catalogoCurto(t) : t) : '(sem sistema)'; };
    var acc = {};
    var soma = function (id, ch) { var n = nome(id); acc[n] = acc[n] || { nome: n, rec: 0, mov: 0, desp: 0 }; acc[n][ch]++; };
    f.recebidas.forEach(function (m) { soma(m.tema_id, 'rec'); });
    f.noMes.forEach(function (t) {
      if (PM_FUNIS.some(function (x) { return x.k === t.de || x.k === t.para; })) soma(t.tema_id, 'mov');
      if (t.para === 'planejado') soma(t.tema_id, 'desp');
    });
    var lista = Object.keys(acc).map(function (k2) { return acc[k2]; })
      .sort(function (a, b) { return (b.rec + b.mov) - (a.rec + a.mov) || a.nome.localeCompare(b.nome, 'pt-BR'); });
    if (!lista.length) return H.vazio('package', 'Nada passou pelos funis do PM/PO neste mês');
    var vis = lista.slice(0, 10);
    return '<div class="gx-tw"><table class="tbl"><thead><tr><th>SISTEMA / MÓDULO</th><th class="num">RECEBIDAS</th><th class="num">MOVIMENTOS</th><th class="num">DESPACHADAS</th></tr></thead><tbody>' +
      vis.map(function (x) {
        return '<tr><td style="color:var(--tx)">' + esc(x.nome) + '</td><td class="num mono">' + (x.rec || '—') + '</td><td class="num mono">' + (x.mov || '—') + '</td>' +
          '<td class="num mono" style="color:var(--tx);font-weight:700">' + (x.desp || '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>' + (lista.length > 10 ? '<span class="note">e mais ' + (lista.length - 10) + ' sistema(s) com menos volume.</span>' : '');
  }

  // ── Pontos ──────────────────────────────────────────────────────────
  function pontos(ctx, alvo) {
    var D = ctx.D, ct = gerCortesDePontos(D, alvo), L = limites(alvo), C = raiz.CAPACIDADE;
    var h = cabecalho('Pontos do Planning Poker',
      'Planejado conta na data do prazo combinado; entregue, na data em que o dev entregou. Pontuação feita depois da conclusão não entra como planejado.',
      seletorMes('paineis/pontos', alvo) + acoesDoMes(alvo),
      '<span class="note">' + esc(rotuloMes(alvo)) + '</span>');
    // KPIs de `renderGerPontos`.
    var semanasAt = Object.keys(ct.porSemana).filter(function (x) { return ct.porSemana[x] > 0 && x !== 'Fora do mês'; }).length;
    var top = ct.porDev[0], topA = ct.porAssunto[0];
    h += '<div class="gx-g gx-k5">' +
      k('Pontos no mês', H.num(ct.total), 'entregas aprovadas no mês', 'var(--ac-t)') +
      k('Demandas pontuadas', H.num(ct.itens.length), ct.itens.length ? 'média ' + (ct.total / ct.itens.length).toFixed(1).replace('.', ',') + ' pt' : '') +
      k('Média por semana', H.num(semanasAt ? Math.round(ct.total / semanasAt) : 0), semanasAt + (semanasAt === 1 ? ' semana' : ' semanas') + ' com entrega') +
      k('Top dev', top ? H.num(top[1]) : '0', top ? esc(top[0]) : '—') +
      k('Top assunto', topA ? H.num(topA[1]) : '0', topA ? esc(topA[0]) : '—') + '</div>';

    // Planejado x entregue por dev (`renderGerCapacidade` -> CAPACIDADE.porDev).
    var cap = C.porDev(vivas(D), L.de, L.ate).filter(function (r) { return r.plan || r.entregue || r.semPontuar; });
    var tPlan = cap.reduce(function (t, r) { return t + r.plan; }, 0), tFeito = cap.reduce(function (t, r) { return t + r.entregue; }, 0);
    var tSem = cap.reduce(function (t, r) { return t + r.semPontuar; }, 0);
    var capH = cap.length ? barrasH(cap.map(function (r) {
      return { rot: r.nome, v: r.plan, v2: r.entregue, txt: r.plan + ' / ' + r.entregue,
               extra: '<span style="color:' + (r.pct == null ? 'var(--tx3)' : corPct(r.pct)) + '">' + esc(r.rotulo) + '</span>' +
                 (r.semPontuar ? ' <span title="Demandas alocadas sem pontuação: o planejado desta pessoa está menor do que é." style="color:var(--wn-t)">◐' + r.semPontuar + '</span>' : '') };
    }), { duas: true, cor: 'var(--in)', cor2: 'var(--ok)' }) : H.vazio('cards', 'Nenhuma demanda pontuada com prazo ou entrega neste mês');

    var segA = ct.porAssunto.slice(0, 5).map(function (a, i) { return { v: a[1], cor: PALETA[i], rot: a[0] }; });
    var resto = ct.porAssunto.slice(5).reduce(function (t, a) { return t + a[1]; }, 0);
    if (resto) segA.push({ v: resto, cor: 'var(--tx4)', rot: 'Outros (' + (ct.porAssunto.length - 5) + ')' });
    var semData = gerPontuadasSemData(D), semDataPts = semData.reduce(function (t, m) { return t + Number(m.poker_pontos); }, 0);
    var semDono = ct.itens.filter(function (m) { return !String(m.dev || '').trim(); });

    h += '<div class="gx-g gx-2b">' +
      '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2">Planejado × entregue por dev</h2>' +
        '<span class="note">' + tPlan + ' planejados · ' + tFeito + ' entregues' + (tPlan ? ' · ' + esc(C.rotulo(tPlan, tFeito)) : '') + '</span></div>' + capH +
        '<div class="gx-leg">' + leg('var(--in)', 'planejado') + leg('var(--ok)', 'entregue') + '</div>' +
        (tSem ? '<span class="note" style="color:var(--wn-t)">◐ ' + tSem + (tSem === 1 ? ' demanda alocada' : ' demandas alocadas') + ' sem pontuação: o planejado de quem as recebeu aparece menor do que é.</span>' : '') + '</section>' +
      '<div class="gx-col-f">' +
        '<section class="pn"><h2 class="h2">Por assunto</h2>' +
          (segA.length ? '<div class="row" style="gap:18px;align-items:center">' + rosca(segA, H.num(ct.total), 'pontos', 120) + legendaRosca(segA) + '</div>' : H.vazio('chart', 'Sem pontos entregues no mês')) + '</section>' +
        (semData.length ? '<section class="pn" style="border-color:rgba(var(--wn-rgb),.4)"><div class="row" style="justify-content:space-between"><h2 class="h2">Pontuadas sem data</h2>' +
          H.chip(semData.length + ' · ' + semDataPts + ' pts', 'wn') + '</div><span class="note" style="font-size:12px">Sem início nem entrega, não entram na distribuição por semana. Preencha no card para passarem a contar.</span>' +
          semData.slice(0, 8).map(function (m) { return '<span class="row" style="gap:8px;font-size:12.5px;color:var(--tx2)">' + codLink(m) + '<span class="ell">' + esc(m.titulo || '(sem título)') + '</span><b class="mono" style="margin-left:auto">' + m.poker_pontos + ' pt</b></span>'; }).join('') +
          (semData.length > 8 ? '<span class="note">e mais ' + (semData.length - 8) + '.</span>' : '') + '</section>' : '') +
        (semDono.length ? '<section class="pn" style="border-color:rgba(var(--wn-rgb),.4)"><h2 class="h2">Pontuadas sem responsável</h2><span class="note" style="font-size:12px">Contam no total do mês, mas não aparecem por dev: não há a quem atribuir.</span>' +
          semDono.map(function (m) { return '<span class="row" style="gap:8px;font-size:12.5px;color:var(--tx2)">' + codLink(m) + '<span class="ell">' + esc(m.titulo || '') + '</span><b class="mono" style="margin-left:auto">' + m.poker_pontos + ' pt</b></span>'; }).join('') + '</section>' : '') +
      '</div></div>';

    // Pontos por semana (colunas) e as sprints do mes (placar + ranking).
    var colsS = Object.keys(ct.porSemana).map(function (x, i) {
      var faixa = ct.semanas[i] ? H.dm(ct.semanas[i][0]) + '–' + H.dm(ct.semanas[i][ct.semanas[i].length - 1]) : '';
      return { rot: x + (faixa ? ' · ' + faixa : ''), partes: [{ v: ct.porSemana[x], cor: x === 'Fora do mês' ? 'var(--tx4)' : 'var(--ac)', nome: 'pontos' }] };
    });
    h += '<div class="gx-g gx-2">' +
      '<section class="pn"><div class="row" style="justify-content:space-between"><h2 class="h2">Pontos por semana</h2><span class="note">blocos de 5 dias úteis</span></div>' +
        (ct.total ? colunas(colsS, 140) : H.vazio('chart', 'Sem pontos entregues no mês')) + '</section>' +
      '<section class="pn" id="gx-spr">' + sprints(D, alvo) + '</section></div>';

    // O ranking do mes: dev x semana (a matriz do `renderGerPontos`).
    var fmt = function (v) { return v ? String(Math.round(v * 10) / 10).replace('.', ',') : '—'; };
    h += '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2">Ranking do mês · pontos por dev e semana</h2>' +
      '<span class="note">' + ct.itens.length + (ct.itens.length === 1 ? ' demanda' : ' demandas') + ' · ' + ct.total + ' pt · dupla divide o ponto</span></div>' +
      (ct.matriz.length ? '<div class="gx-tw"><table class="tbl"><thead><tr><th>#</th><th>DEV</th>' + ct.semanas.map(function (_, i) { return '<th class="num">S' + (i + 1) + '</th>'; }).join('') +
        '<th class="num">TOTAL</th></tr></thead><tbody>' +
        ct.matriz.map(function (d, i) {
          return '<tr><td class="mono" style="color:var(--tx4)">' + (i + 1) + '</td><td style="color:var(--tx)"><span class="row" style="gap:8px">' + H.av(d.nome, 24) + esc(d.nome) + '</span></td>' +
            d.sem.map(function (v) { return '<td class="num mono">' + fmt(v) + '</td>'; }).join('') + '<td class="num mono" style="color:var(--tx);font-weight:700">' + fmt(d.total) + '</td></tr>';
        }).join('') +
        '<tr><td></td><td style="color:var(--tx);font-weight:700">Total</td>' + ct.semanas.map(function (_, i) {
          return '<td class="num mono" style="font-weight:700">' + fmt(ct.matriz.reduce(function (t, d) { return t + d.sem[i]; }, 0)) + '</td>';
        }).join('') + '<td class="num mono" style="color:var(--tx);font-weight:700">' + fmt(ct.matriz.reduce(function (t, d) { return t + d.total; }, 0)) + '</td></tr>' +
        '</tbody></table></div>' : H.vazio('trophy', 'Nenhuma demanda pontuada entregue neste mês', 'Os pontos aparecem depois de votar no Planning Poker e gravar no card.')) + '</section>';
    return h;
  }

  /** As sprints do mes (`relRenderSprint`/`renderGerSprint`): o placar vem de
   *  `SPRINTPO.placarDaSprint` e o ranking de `rankingDaSprint`, na trilha
   *  Tecnologia — a mesma que o Gerencial abre por padrao (`_sprTrilha`). */
  function sprints(D, alvo) {
    var S = raiz.SPRINTPO, E = raiz.ETAPA;
    if (!S) return H.vazio('refresh', 'Sprints indisponíveis');
    var etapa = function (m) { return E ? E.gravada(m) : m.status_planejamento; };
    var lista = S.sprintsDoMes(+alvo.slice(0, 4), +alvo.slice(5, 7), feriadosDe(D));
    var placares = lista.map(function (s) { return { s: s, p: S.placarDaSprint(D, s.rotulo, etapa, 'tecnologia') }; });
    var agora = H.sprintAtual();
    if (!placares.some(function (x) { return x.s.rotulo === _sprSel; })) {
      // Abre a sprint de hoje se ela tem repasse; senao, a ultima que teve.
      var cand = placares.filter(function (x) { return x.p.total; });
      var hojeS = cand.find(function (x) { return x.s.rotulo === agora; });
      var esc2 = hojeS || cand[cand.length - 1];
      _sprSel = esc2 ? esc2.s.rotulo : '';
    }
    var SIT = { montando: 'montando', em_curso: 'em curso', fechada: 'fechada' };
    var h = '<div class="row" style="justify-content:space-between"><h2 class="h2">Sprints do mês</h2><span class="note">pontos validados / repassados · trilha Tecnologia</span></div>';
    h += placares.map(function (x) {
      var p = x.p, on = x.s.rotulo === _sprSel;
      var pctP = p.pontosTotal ? Math.round(p.pontosValidados / p.pontosTotal * 100) : 0;
      return '<button type="button" class="gx-card' + (on ? ' on' : '') + '" data-spr="' + esc(x.s.rotulo) + '" style="cursor:pointer;text-align:left;font:inherit;color:inherit"' + (p.total ? '' : ' disabled') + '>' +
        '<span class="row" style="justify-content:space-between"><span style="font-size:13.5px;font-weight:700"><span class="code" style="margin-right:8px">' + esc(S.rotuloCurto(x.s.rotulo)) + '</span>' +
        H.dm(x.s.de) + ' a ' + H.dm(x.s.ate) + '</span><span class="mono" style="font-size:12px;color:var(--tx2)">' + (p.total ? p.pontosValidados + ' / ' + p.pontosTotal : '—') + '</span></span>' +
        '<span class="bar"><span style="width:' + pctP + '%;background:var(--ok)"></span></span>' +
        '<span class="note">' + (p.total ? p.validados + ' de ' + p.total + ' validados · ' + p.pct + '% por item' + (p.aguardando ? ' · ' + p.aguardando + ' esperando validação' : '') + (p.saiu ? ' · ' + p.saiu + ' saíram sem entregar' : '') : 'nada repassado') +
        ' · ' + SIT[S.situacaoDaSprint(D, x.s.rotulo)] + '</span></button>';
    }).join('');
    if (_sprSel) {
      var rk = S.rankingDaSprint(D, _sprSel, etapa, 'tecnologia');
      h += '<h2 class="h2" style="margin-top:6px">Ranking da ' + esc(S.rotuloCurto(_sprSel)) + '</h2>' +
        '<div class="gx-tw"><table class="tbl"><thead><tr><th>DEV</th><th class="num">VALIDADOS</th><th class="num">PONTOS</th><th class="num">%</th></tr></thead><tbody>' +
        rk.map(function (d) {
          return '<tr><td style="color:var(--tx)"><span class="row" style="gap:8px">' + H.av(d.nome, 24) + esc(d.nome) + '</span></td>' +
            '<td class="num mono">' + d.validados + ' de ' + d.total + '</td><td class="num mono">' + d.pontos + ' de ' + d.pontosTotal + '</td><td class="num">' + chipPct(d.pct) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        (rk.some(function (d) { return d.dupla; }) ? '<span class="note">Demanda de dupla conta inteira para cada um na coluna de itens; o ponto se divide.</span>' : '');
    }
    return h;
  }

  css();
  raiz.AXIS_APP.tela({
    id: 'paineis', rotulo: 'Painéis', papeis: ['admin', 'consulta'],
    abas: [{ id: 'visao', rotulo: 'Visão geral' }, { id: 'fluxo', rotulo: 'Fluxo e pessoas' }, { id: 'pontos', rotulo: 'Pontos' }],
    abasDe: abasDe,
    titulo: function (r) { return 'Painéis · ' + ({ visao: 'Visão geral', fluxo: 'Fluxo e pessoas', pontos: 'Pontos' }[r.aba] || ''); },
    render: function (el, ctx) {
      css();
      var alvo = alvoDe(ctx.param);
      if (alvo !== _alvoPag) { _alvoPag = alvo; _pagDem = 0; }
      if (ctx.aba === 'fluxo') return fluxo(ctx, alvo);
      if (ctx.aba === 'pontos') return pontos(ctx, alvo);
      return visao(ctx, alvo);
    },
    depois: function (el, ctx) {
      var alvo = alvoDe(ctx.param);
      ligaSeletorMes(el);
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-pm]');
        if (b) {
          _pmAba = b.getAttribute('data-pm');
          var f = pmFluxo(ctx.D, alvo), box = el.querySelector('#gx-pm');
          if (box) box.innerHTML = _pmAba === 'semana' ? tabSemana(f, alvo) : _pmAba === 'sistema' ? tabSistema(f, ctx.D) : tabFunil(f);
          Array.prototype.forEach.call(el.querySelectorAll('[data-pm]'), function (x) { x.classList.toggle('on', x === b); });
          return;
        }
        var s = e.target.closest('[data-spr]');
        if (s) {
          _sprSel = s.getAttribute('data-spr');
          var box2 = el.querySelector('#gx-spr');
          if (box2) box2.innerHTML = sprints(ctx.D, alvo);
          return;
        }
        var p = e.target.closest('[data-pag-dem]');
        if (p && !p.disabled) {
          _pagDem = +p.getAttribute('data-pag-dem');
          var sec = el.querySelector('#gx-dem');
          var tmp = document.createElement('div');
          tmp.innerHTML = visao(ctx, alvo);
          var nova = tmp.querySelector('#gx-dem');
          if (sec && nova) sec.replaceWith(nova);
        }
      });
    }
  });
})();
