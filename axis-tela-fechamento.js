/* ─────────────────────────────────────────────────────────────────────────
   AXIS — Fechamento do mes (#fechamento). Fechamento · Apresentacao.

   E A ABA "MES" DO ADMIN COM O DESENHO DO PROTOTIPO. O que o time prometeu no
   dia 1 (a trilha `meses` de cada demanda), o que entrou depois, o que saiu e o
   que transbordou. As contas da tela vem de `AXIS_GER` (axis-tela-paineis.js),
   copiadas de `renderMes` e `renderGerCumprimento` com o nome da origem.

   FECHAR, CONGELAR E O DECK SAEM DAQUI. "Fechar o mes" mostra o que vai rolar
   e chama `mes-fechar` no Worker, como `mesFecharAbrir`; "Congelar" grava a
   apuracao do deck (`fechamento-gravar`) e "Descongelar" a apaga
   (`fechamento-apagar`), como `fechaCongelar` e `fechaDescongelar`. A aba
   Apresentacao monta o deck do mes pelo apresentacao.js, o mesmo gerador do
   admin, com o objeto que o `apresGerar` monta — da apuracao congelada,
   quando o mes esta congelado.

   AS REGRAS DO DECK ESTAO NO TOPO, PURAS (`REGRAS_FECHA`): copias do admin,
   com o nome da origem, que a suite de invariantes executa ao lado das
   originais. A ata, o deck de assunto e o CSV (axis-tela-relatorios.js) usam
   as contas de hora e prazo daqui.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var raiz = typeof window !== 'undefined' ? window : globalThis;

  // ══ REGRAS (puras) ═══════════════════════════════════════════════════════
  /* COPIAS DO ADMIN, UMA A UMA, com o nome da funcao de origem: o deck do mes
     (`apresGerar` e as que ele chama), o congelamento (`fechaCongelar`, que
     pede a MESMA apuracao do deck) e o "Fechar o mes" (`mesFecharAbrir`). Nao
     sao reescritas — a suite roda as do admin ao lado destas, na mesma amostra,
     e compara o objeto que cada uma entrega ao apresentacao.js.

     `S` e a base (o `state` do admin). Os modulos de regra (FILA, PRAZO,
     CAPACIDADE, PIPELINES, SELO, o catalogo e o nome do mes do
     apresentacao.js) sao lidos da janela na hora da conta; a suite troca a
     janela por `usar`. */
  var W = raiz;
  function usar(w) { W = w || raiz; }

  /** `formatDate` (admin.html): data pura nao passa por Date; data-hora passa
   *  pelo fuso de Sao Paulo. */
  function formatDate(s) {
    if (!s) return '';
    var txt = String(s);
    var soData = /^\d{4}-\d{2}-\d{2}$/.test(txt);
    var dia = txt.slice(0, 10);
    if (!soData) {
      var dt = new Date(txt);
      if (isNaN(dt)) return '';
      dia = dt.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    }
    var p = dia.split('-');
    if (!p[0] || !p[1] || !p[2]) return '';
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  /** `resumoDaEntrega` (admin.html): o resumo; sem ele, o texto completo. */
  function resumoDaEntrega(m, soResumo) {
    var r = String((m || {}).resumo_entrega || '').trim();
    if (r) return r;
    if (soResumo) return '';
    return String((m || {}).implementacao || '').trim();
  }
  /** `mesSomaLocal` (admin.html). */
  function mesSomaLocal(iso, n) {
    var a = parseInt(String(iso).slice(0, 4), 10);
    var b = parseInt(String(iso).slice(5, 7), 10);
    var t = (a * 12 + (b - 1)) + n;
    return String(Math.floor(t / 12)) + '-' + String((t % 12) + 1).padStart(2, '0');
  }
  function mesNome(i) { return W.apresentacaoMesNome ? W.apresentacaoMesNome(i) : ''; }
  function catCurto(nome) { return W.catalogoCurto ? W.catalogoCurto(nome) : nome; }
  function feriadosSet(S) { return new Set(((S || {}).feriados || []).map(function (f) { return f.data || f; }).filter(Boolean)); }

  /* ── Mes de compromisso: `mesTrilhaDe`, `mesDe`, `mesDoPeriodo` (admin.html). */
  function mesTrilhaDe(m) {
    var t = (m && Array.isArray(m.meses)) ? m.meses : [];
    return t.filter(function (x) { return x && /^\d{4}-(0[1-9]|1[0-2])$/.test(String(x.mes)); });
  }
  function mesDe(m) { var t = mesTrilhaDe(m); return t.length ? t[t.length - 1].mes : ''; }
  function mesDoPeriodo(S, alvo) {
    return ((S || {}).melhorias || []).filter(function (m) {
      return !m.mesclado_em && !m.oculto && mesTrilhaDe(m).some(function (x) { return x.mes === alvo; });
    });
  }
  /** FECHAR O MES (`mesFecharAbrir`, admin.html): o que rola — as demandas que
   *  estao no mes AGORA e seguem abertas. O Worker (`mes-fechar`) refaz a mesma
   *  conta sobre a base dele; esta lista e a conferencia antes do clique. */
  function aRolar(S, alvo) {
    return mesDoPeriodo(S, alvo).filter(function (m) {
      return mesDe(m) === alvo && ['concluido', 'negada'].indexOf(m.status_planejamento || '') < 0;
    });
  }
  /** O corpo do `mes-fechar` (`mesFecharAbrir`): o mes, o destino e a versao
   *  da base que a tela leu, que o `conflito` do Worker confere. O admin manda
   *  `state.atualizado_em`, que ele nao preenche ao carregar: o pedido dele sai
   *  sem `base`, e o Worker responderia "recarregue". Aqui vai a versao lida. */
  function pedidoFechar(S, alvo) {
    return { action: 'mes-fechar', mes: alvo, para: mesSomaLocal(alvo, 1), base: (S || {}).atualizado_em };
  }

  /* ── Horas: `rateiaHoras`, `horasReaisDe`, `horasDoMes` (admin.html). O dia
     util do dev vale 8h e e dividido entre as demandas que ele tinha em maos. */
  var HORAS_DIA = 8;
  function rateiaHoras(S, lista, janela, de, ate) {
    var ferSet = feriadosSet(S);
    var agenda = new Map();
    var trechos = [];
    lista.forEach(function (m) {
      var j = janela(m) || {};
      if (!j.de || !j.ate) return;
      var ini = j.de > de ? j.de : de;
      var fim = j.ate < ate ? j.ate : ate;
      if (fim < ini) return;
      var devs = String(m.dev || '').split(/[\/,]/).map(function (x) { return x.trim(); }).filter(Boolean);
      if (!devs.length) return;
      var d = new Date(ini + 'T00:00:00');
      var end = new Date(fim + 'T00:00:00');
      var guarda = 0;
      while (d <= end && guarda++ < 400) {
        var dow = d.getDay();
        var iso = d.toISOString().slice(0, 10);
        if (dow !== 0 && dow !== 6 && !ferSet.has(iso)) {
          devs.forEach(function (dv) {
            var chave = iso + '|' + dv;
            if (!agenda.has(chave)) agenda.set(chave, []);
            agenda.get(chave).push(m.id);
            trechos.push({ id: m.id, chave: chave });
          });
        }
        d.setDate(d.getDate() + 1);
      }
    });
    var horas = new Map();
    trechos.forEach(function (t) {
      var quantas = agenda.get(t.chave).length;
      horas.set(t.id, (horas.get(t.id) || 0) + HORAS_DIA / quantas);
    });
    return horas;
  }
  function horasReaisDe(m, rateado) {
    var h = (m || {}).horas_realizadas;
    var digitada = Number(String(h == null ? '' : h).replace(',', '.'));
    if (isFinite(digitada) && digitada > 0) return { h: digitada, medida: true };
    return { h: (rateado && rateado.get(m.id)) || 0, medida: false };
  }
  function horasDoMes(S, m, deISO, ateISO, rateado) {
    var r = horasReaisDe(m, rateado);
    if (!r.h) return 0;
    var ini = String((m || {}).inicio || '').slice(0, 10);
    var fim = String((m || {}).concluido_em || (m || {}).entrega || '').slice(0, 10);
    var ehData = function (t) { return /^\d{4}-\d{2}-\d{2}$/.test(t); };
    if (!ehData(ini) || !ehData(fim) || fim < ini) return r.h;
    var fer = feriadosSet(S);
    var uteis = function (a, b) {
      if (b < a) return 0;
      var n = 0, g = 0;
      var dt = new Date(a + 'T00:00:00Z'), e = new Date(b + 'T00:00:00Z');
      while (dt <= e && g++ < 800) {
        var w = dt.getUTCDay();
        if (w !== 0 && w !== 6 && !fer.has(dt.toISOString().slice(0, 10))) n++;
        dt.setUTCDate(dt.getUTCDate() + 1);
      }
      return n;
    };
    var total = uteis(ini, fim);
    if (!total) return r.h;
    var dentro = uteis(ini > deISO ? ini : deISO, fim < ateISO ? fim : ateISO);
    return r.h * dentro / total;
  }

  /** `prazoClassifica` (admin.html): o mes e o da conclusao; o fim da conta e a
   *  entrega do dev. */
  function prazoClassifica(m) {
    if (!m || m.mesclado_em || m.oculto) return null;
    if ((m.status_planejamento || '') !== 'concluido') return null;
    var P = W.PRAZO;
    var fim = P ? P.fimDoDev(m) : String(m.concluido_em || '').slice(0, 10);
    var pz = String(m.entrega || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fim)) return { tipo: 'sem_conclusao' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pz)) return { tipo: 'sem_prazo' };
    var dias = P ? P.diasDeAtraso(m, 'concluido', null) : null;
    if (!dias) return { tipo: 'no_prazo', dias: 0 };
    return { tipo: 'atraso', dias: dias };
  }

  /* ── Pontos: `gerSemanasDoMes`, `gerSemanaIndex`, `gerDataRefPontos`,
     `gerItensPontuados`, `cortePontosPorDev`, `relRaizNome`, `gerCortesDePontos`
     (admin.html) — o formato que o deck recebe. */
  function gerSemanasDoMes(S, ano, mes1) {
    var ferSet = feriadosSet(S);
    var uteis = [];
    var totalDias = new Date(ano, mes1, 0).getDate();
    for (var dia = 1; dia <= totalDias; dia++) {
      var dow = new Date(ano, mes1 - 1, dia).getDay();
      if (dow === 0 || dow === 6) continue;
      var s = ano + '-' + String(mes1).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
      if (ferSet.has(s)) continue;
      uteis.push(s);
    }
    var semanas = [];
    for (var i = 0; i < uteis.length; i += 5) semanas.push(uteis.slice(i, i + 5));
    return semanas;
  }
  function gerSemanaIndex(dataStr, semanas) {
    if (!dataStr) return -1;
    for (var i = 0; i < semanas.length; i++) if (semanas[i].indexOf(dataStr) >= 0) return i;
    for (var k = 0; k < semanas.length; k++) {
      var w = semanas[k];
      if (w.length && dataStr >= w[0] && dataStr <= w[w.length - 1]) return k;
    }
    return -1;
  }
  function gerDataRefPontos(m) {
    return (W.CAPACIDADE ? W.CAPACIDADE.diaDaEntrega(m) : '') ||
      (['validacao', 'concluido'].indexOf((m || {}).status_planejamento || '') >= 0
        ? String((m || {}).concluido_em || '').slice(0, 10) : '');
  }
  function gerItensPontuados(S, ano, mes1) {
    var iso = String(ano) + '-' + String(mes1).padStart(2, '0');
    var ult = new Date(ano, mes1, 0).getDate();
    var de = iso + '-01', ate = iso + '-' + String(ult).padStart(2, '0');
    return ((S || {}).melhorias || []).filter(function (m) { return Number(m.poker_pontos) > 0 && W.FILA.ehEntregaDe(m, de, ate); });
  }
  function cortePontosPorDev(itens, splitDevs) {
    var porDev = {};
    var semDono = 0;
    (itens || []).forEach(function (m) {
      var devs = splitDevs(m.dev);
      var pts = Number(m.poker_pontos);
      if (!isFinite(pts) || pts <= 0) return;
      if (!devs.length) { semDono += pts; return; }
      var val = pts / devs.length;
      devs.forEach(function (d) { porDev[d] = (porDev[d] || 0) + val; });
    });
    if (semDono > 0) porDev['Sem responsável'] = semDono;
    Object.keys(porDev).forEach(function (k) { porDev[k] = Math.round(porDev[k]); });
    return porDev;
  }
  function relRaizNome(nome) {
    return (W.catalogoRaiz ? W.catalogoRaiz(nome) : String(nome || '')) || '—';
  }
  function ordenaObj(o) {
    var out = {};
    Object.keys(o).map(function (k) { return [k, o[k]]; }).sort(function (a, b) { return b[1] - a[1]; })
      .forEach(function (e) { out[e[0]] = e[1]; });
    return out;
  }
  function gerCortesDePontos(S, ano, mes, temaMap, splitDevs) {
    var semanas = gerSemanasDoMes(S, ano, mes);
    var itens = gerItensPontuados(S, ano, mes);
    var porSemana = {};
    semanas.forEach(function (_, i) { porSemana['S' + (i + 1)] = 0; });
    var foraDaSemana = 0;
    itens.forEach(function (m) {
      var idx = gerSemanaIndex(gerDataRefPontos(m), semanas);
      if (idx >= 0) porSemana['S' + (idx + 1)] += Number(m.poker_pontos);
      else foraDaSemana += Number(m.poker_pontos);
    });
    if (foraDaSemana > 0) porSemana['Fora do mês'] = foraDaSemana;
    var porDev = cortePontosPorDev(itens, splitDevs);
    var porAssunto = {};
    itens.forEach(function (m) {
      var k = m.tema_id ? relRaizNome(temaMap[m.tema_id]) : 'Sem tema';
      porAssunto[k] = (porAssunto[k] || 0) + Number(m.poker_pontos);
    });
    var porSprint = {};
    itens.forEach(function (m) {
      var k = (m.sprint || '').trim() || 'Sem sprint';
      porSprint[k] = (porSprint[k] || 0) + Number(m.poker_pontos);
    });
    return {
      itens: itens, semanas: semanas,
      total: itens.reduce(function (t, m) { return t + Number(m.poker_pontos); }, 0),
      temSprint: itens.some(function (m) { return (m.sprint || '').trim(); }),
      porSemana: porSemana,
      porDev: ordenaObj(porDev),
      porAssunto: ordenaObj(porAssunto),
      porSprint: ordenaObj(porSprint)
    };
  }

  /* ── Os slides do deck do mes: `AP_SECOES` e `AP_SEMPRE` (admin.html). `pad`
     e o "Padrao do fechamento"; `n`, quantos slides a caixa gera. */
  var AP_SECOES = [
    { k: 'entregas', rot: 'O mês: backlog, o que entrou e o que saiu', n: 1, pad: true },
    { k: 'evolucao', rot: 'Evolução: este mês e o anterior', n: 1, pad: true },
    { k: 'comparativo', rot: 'Este mês contra o anterior: entregas, pontos, horas e prazo', n: 1, pad: true },
    { k: 'pipelines', rot: 'Frentes de trabalho: horas planejadas × realizadas', n: 2, pad: true, nota: 'o segundo cruza horas e pontos por frente — o que cada hora rendeu' },
    { k: 'frentes_detalhe', rot: 'Cada frente por dentro: entregas, projetos e quem fez', n: 3, pad: true, nota: 'um slide para cada uma das 3 frentes mais trabalhadas' },
    { k: 'pontos_dev', rot: 'Pontos entregues por desenvolvedor', n: 1, pad: true },
    { k: 'entregas_top', rot: 'Principais entregas: pontos e tempo de cada uma', n: 1, pad: true, nota: 'com a variação de pontos, média e tempo contra o mês anterior' },
    { k: 'pontos_semana', rot: 'Pontos entregues por semana', n: 1 },
    { k: 'pontos_tema', rot: 'Pontos entregues por sistema', n: 1 },
    { k: 'projetos', rot: 'Principais projetos em aberto', n: 1, pad: true },
    { k: 'capacidade', rot: 'Planejado × entregue em pontos, por dev', n: 1, pad: true },
    { k: 'prazo', rot: 'No prazo × com atraso', n: 2, nota: 'o segundo slide lista as atrasadas, e só sai se houver' },
    { k: 'rapidas', rot: 'Entregas rápidas (até 2 dias)', n: 1 },
    { k: 'areas', rot: 'Onde atuamos (as 3 maiores frentes)', n: 1 },
    { k: 'solicit', rot: 'Quem mais pediu (top 5)', n: 1 },
    { k: 'time', rot: 'O time (agregado) e quem esteve fora', n: 1 },
    { k: 'grafico', rot: 'Entregas por desenvolvedor (com os pontos ao lado)', n: 1 },
    { k: 'ganttdev', rot: 'A linha do tempo dos 3 primeiros devs', n: 3, nota: 'um slide por pessoa' },
    { k: 'riscos', rot: 'O que está travado (demandas pausadas)', n: 1 },
    { k: 'proximo', rot: 'O que vem no próximo mês', n: 1 }
  ];
  var AP_SEMPRE = 'Além da grade, sempre entram: a capa, um slide por destaque ' +
    'marcado com ★ e o slide final com a sua mensagem.';
  /** `apSecoesPreset` (admin.html): 'padrao' ou 'tudo'. */
  function secoesPreset(qual) {
    var s = {};
    AP_SECOES.forEach(function (x) { s[x.k] = qual === 'tudo' ? true : !!x.pad; });
    return s;
  }

  /** `apresTimeEAreas` (admin.html): time, areas, frentes do atraso, ranking de
   *  devs e quem pediu — tudo agregado. */
  function apresTimeEAreas(S, conc, cl) {
    var devsDe = function (m) {
      var n = String(m.dev || '').split('/').map(function (x) { return x.trim(); }).filter(Boolean);
      return n.length ? n : [];
    };
    var acc = {};
    var soma = function (nome, campo, v) {
      acc[nome] = acc[nome] || { nome: nome, entregas: 0, pontos: 0, atrasos: 0 };
      acc[nome][campo] += (v == null ? 1 : v);
    };
    conc.forEach(function (m) {
      var tipo = (cl.get(m.id) || {}).tipo;
      devsDe(m).forEach(function (n) {
        soma(n, 'entregas');
        soma(n, 'pontos', (Number(m.poker_pontos) || 0) / devsDe(m).length);
        if (tipo === 'atraso') soma(n, 'atrasos');
      });
    });
    var lista = Object.keys(acc).map(function (k) { return acc[k]; });
    var topo = function (campo) {
      return lista.filter(function (d) { return d[campo] > 0; })
        .sort(function (a, b) { return b[campo] - a[campo] || String(a.nome).localeCompare(String(b.nome), 'pt-BR'); })
        .slice(0, 4)
        .map(function (d) { return { nome: d.nome, valor: campo === 'pontos' ? Math.round(d[campo]) : d[campo] }; });
    };
    var temaDe = function (m) { return ((S || {}).temas || []).find(function (x) { return String(x.id) === String(m.tema_id); }); };
    var porTema = {};
    conc.forEach(function (m) {
      var t = temaDe(m);
      var nome = t ? catCurto(t.nome) : '(sem sistema)';
      porTema[nome] = porTema[nome] || { nome: nome, entregas: 0, pontos: 0 };
      porTema[nome].entregas++;
      porTema[nome].pontos += Number(m.poker_pontos) || 0;
    });
    var areas = Object.keys(porTema).map(function (k) { return porTema[k]; })
      .sort(function (a, b) { return b.entregas - a.entregas || b.pontos - a.pontos; });
    var atrasoTema = {};
    conc.forEach(function (m) {
      var c = cl.get(m.id) || {};
      if (c.tipo !== 'atraso') return;
      var t = temaDe(m);
      var nome = t ? catCurto(t.nome) : '(sem sistema)';
      atrasoTema[nome] = atrasoTema[nome] || { nome: nome, qtd: 0, soma: 0, devs: {} };
      atrasoTema[nome].qtd++;
      atrasoTema[nome].soma += c.dias || 0;
      devsDe(m).forEach(function (dv) { atrasoTema[nome].devs[dv] = (atrasoTema[nome].devs[dv] || 0) + 1; });
    });
    var frentes = Object.keys(atrasoTema).map(function (k) { return atrasoTema[k]; })
      .sort(function (a, b) { return b.qtd - a.qtd || b.soma - a.soma; })
      .map(function (f) {
        return {
          nome: f.nome, qtd: f.qtd, dias: Math.round(f.soma / f.qtd),
          devs: Object.keys(f.devs).map(function (k) { return [k, f.devs[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 3)
            .map(function (e) { return e[0] + ' (' + e[1] + ')'; })
        };
      });
    var porDev = lista.filter(function (d) { return d.entregas > 0; })
      .map(function (d) { return { nome: d.nome, valor: d.entregas, extra: Math.round(d.pontos) }; })
      .sort(function (a, b) { return b.valor - a.valor || String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
    var porSolic = {};
    var semSolic = 0;
    conc.forEach(function (m) {
      var q = String(m.solicitante || '').trim();
      if (!q) { semSolic++; return; }
      porSolic[q] = (porSolic[q] || 0) + 1;
    });
    var solicitantes = Object.keys(porSolic).map(function (k) { return { nome: k, valor: porSolic[k] }; })
      .sort(function (a, b) { return b.valor - a.valor || String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
    return {
      time: { entregas: topo('entregas'), pontos: topo('pontos'), atrasos: topo('atrasos') },
      areas: areas, frentes: frentes, porDev: porDev, solicitantes: solicitantes, semSolic: semSolic
    };
  }

  /** `apresPipelines` (admin.html): as frentes de trabalho, planejado x
   *  realizado x %exec, na ordem fixa do painel aprovado. */
  function apresPipelines(S, conc, de, ate) {
    var api = W.PIPELINES;
    if (!api) return null;
    var perfis = (S || {}).devs_perfil || {};
    var planejado = rateiaHoras(S, conc, function (m) {
      return { de: String(m.inicio || '').slice(0, 10), ate: String(m.entrega || '').slice(0, 10) };
    }, de, ate);
    var rateadoReal = rateiaHoras(S, conc, function (m) {
      return { de: String(m.inicio || '').slice(0, 10), ate: String(m.concluido_em || m.entrega || '').slice(0, 10) };
    }, de, ate);
    var acc = {};
    var poe = function (nome, campo, v) {
      acc[nome] = acc[nome] || { nome: nome, cor: api.cor(nome), entregas: 0, pontos: 0,
                                 plan: 0, real: 0, evolucao: 0, sustentacao: 0, devs: new Set() };
      if (campo) acc[nome][campo] += v;
    };
    var semHoras = 0, semJanela = 0;
    conc.forEach(function (m) {
      var devs = api.devsDaDemanda(m);
      var real = horasReaisDe(m, rateadoReal);
      var hReal = horasDoMes(S, m, de, ate, rateadoReal);
      var hPlan = planejado.get(m.id) || 0;
      if (!real.medida) semHoras++;
      if (!hPlan) semJanela++;
      var alvos = devs.length ? devs : [null];
      alvos.forEach(function (n) {
        var q = alvos.length;
        var nome = n ? (api.doDev(n, perfis) || api.NAO_CLASSIFICADO) : api.NAO_CLASSIFICADO;
        poe(nome, 'entregas', 1 / q);
        poe(nome, 'pontos', (Number(m.poker_pontos) || 0) / q);
        poe(nome, 'plan', hPlan / q);
        poe(nome, 'real', hReal / q);
        if (m.tipo === 'evolucao') poe(nome, 'evolucao', 1 / q);
        else if (m.tipo === 'sustentacao') poe(nome, 'sustentacao', 1 / q);
        if (n) acc[nome].devs.add(n);
      });
    });
    var itens = api.nomes.filter(function (n) { return acc[n]; }).map(function (n) {
      var a = acc[n];
      return {
        nome: a.nome, cor: a.cor,
        entregas: Math.round(a.entregas), pontos: Math.round(a.pontos),
        plan: Math.round(a.plan), real: Math.round(a.real),
        pct: a.plan > 0 ? Math.round(a.real / a.plan * 100) : null,
        evolucao: Math.round(a.evolucao), sustentacao: Math.round(a.sustentacao),
        devs: a.devs.size
      };
    });
    var soma = function (c) { return itens.reduce(function (s, i) { return s + i[c]; }, 0); };
    var totPlan = soma('plan'), totReal = soma('real');
    var pessoas = new Set();
    conc.forEach(function (m) { api.devsDaDemanda(m).forEach(function (n) { pessoas.add(n); }); });
    return {
      itens: itens,
      devs: pessoas.size,
      total: { entregas: soma('entregas'), pontos: soma('pontos'), plan: totPlan, real: totReal,
               pct: totPlan > 0 ? Math.round(totReal / totPlan * 100) : null },
      cobertura: { comHoras: conc.length - semHoras, total: conc.length,
                   pct: conc.length ? Math.round((conc.length - semHoras) / conc.length * 100) : 0, semJanela: semJanela },
      foraDoDeck: api.foraDoDeck
    };
  }

  /** `apresConcluidasDoMes` (admin.html): a regra de entrega do mes e a da fila. */
  function concluidasDoMes(S, iso) {
    var ult = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0).getDate();
    var de = iso + '-01', ate = iso + '-' + String(ult).padStart(2, '0');
    return ((S || {}).melhorias || []).filter(function (m) { return W.FILA.ehEntregaDe(m, de, ate); });
  }
  /** As candidatas a destaque (`apresAbrir`): estreladas primeiro, depois por pontos. */
  function candidatasDestaque(S, iso) {
    return concluidasDoMes(S, iso).sort(function (a, b) {
      return (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0) || (Number(b.poker_pontos) || 0) - (Number(a.poker_pontos) || 0);
    });
  }
  /** `apresPeriodoNome` (admin.html): "Outubro de 2026". */
  function periodoNome(iso) {
    var a = Number(String(iso).split('-')[0]), m = Number(String(iso).split('-')[1]);
    return mesNome(m - 1).replace(/^./, function (c) { return c.toUpperCase(); }) + ' de ' + a;
  }
  function nomeArquivoDeck(ano, mes) { return 'roadmap-' + String(ano) + '-' + String(mes).padStart(2, '0') + '.pptx'; }

  /* ═══ A APURACAO DO MES — o miolo de `apresGerar` (admin.html) ═══════════
     `o` = { ano, mes, soApuracao, secoes, idsDestaque, mensagem }. Com
     `soApuracao` (o congelamento) o destaque vem da estrela e a funcao devolve
     a apuracao sem as escolhas da geracao (secoes, imagens, mensagem) — as
     mesmas tres linhas da origem. As caixas do modal viram `secoes`,
     `idsDestaque` e `mensagem`. */
  function apuracao(S, o) {
    var soApuracao = !!o.soApuracao;
    var mes = o.mes, ano = o.ano;
    var iso = String(ano) + '-' + String(mes).padStart(2, '0');
    var FILA = W.FILA, PRAZO = W.PRAZO;
    var MS = (S || {}).melhorias || [];
    var secoes = {};
    AP_SECOES.forEach(function (s) { secoes[s.k] = !!(o.secoes || {})[s.k]; });

    var conc = concluidasDoMes(S, iso);
    var pontos = conc.reduce(function (t, m) { return t + (Number(m.poker_pontos) || 0); }, 0);
    var cl = new Map(conc.map(function (m) { return [m.id, prazoClassifica(m)]; }));

    var prometidas = MS.filter(function (m) { return !m.mesclado_em && !m.oculto && String(m.entrega || '').slice(0, 7) === iso; });
    var prometidasConcluidas = prometidas.filter(function (m) { return (m.status_planejamento || '') === 'concluido'; });
    var clPz = new Map(prometidasConcluidas.map(function (m) { return [m.id, prazoClassifica(m)]; }));
    var noPrazoPz = prometidasConcluidas.filter(function (m) { return (clPz.get(m.id) || {}).tipo === 'no_prazo'; });
    var atrasPz = prometidasConcluidas.filter(function (m) { return (clPz.get(m.id) || {}).tipo === 'atraso'; });
    var prometidasEmAberto = prometidas.filter(function (m) { return ['concluido', 'negada'].indexOf(m.status_planejamento || '') < 0; });
    var semMedirPz = prometidasConcluidas.filter(function (m) { return ['sem_prazo', 'sem_conclusao'].indexOf((clPz.get(m.id) || {}).tipo) >= 0; });
    var medidas = noPrazoPz.length + atrasPz.length;
    var diasMedio = atrasPz.length
      ? Math.round(atrasPz.reduce(function (t, m) { return t + clPz.get(m.id).dias; }, 0) / atrasPz.length) : 0;

    var fimMes = ano + '-' + String(mes).padStart(2, '0') + '-' + String(new Date(ano, mes, 0).getDate()).padStart(2, '0');
    var vivasFluxo = MS.filter(function (m) { return !m.oculto && !m.mesclado_em; });
    var hojeISO = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    var mesEmCurso = hojeISO >= iso + '-01' && hojeISO <= fimMes;
    var corte = mesEmCurso ? hojeISO : fimMes;

    var fluxoFila = FILA.fluxo(vivasFluxo, iso + '-01', corte, fimMes);
    var backlogInicio = fluxoFila.backlogInicio;
    var entradas = vivasFluxo.filter(function (m) { var c = FILA.entrada(m); return c >= iso + '-01' && c <= corte; });
    var saidas = vivasFluxo.filter(function (m) { var sd = FILA.saida(m); return sd && sd >= iso + '-01' && sd <= corte; });
    var saiuEntregue = fluxoFila.saiuEntregue;
    var saiuNegada = fluxoFila.saiuNegada;
    var porTipo = fluxoFila.quebra.recebidas;
    var tocadas = fluxoFila.tocadas;
    var backlogFim = fluxoFila.backlogFim;

    var devsAtuaram = new Set();
    vivasFluxo.forEach(function (m) {
      var tocou = FILA.noPeriodo(String(m.inicio || '').slice(0, 10), iso + '-01', fimMes) ||
                  FILA.noPeriodo(String(m.concluido_em || '').slice(0, 10), iso + '-01', fimMes);
      if (!tocou) return;
      String(m.dev || '').split(/[\/,]/).map(function (x) { return x.trim(); }).filter(Boolean)
        .forEach(function (dv) { devsAtuaram.add(dv); });
    });
    var ferCap = feriadosSet(S);
    var uteisNoMes = 0;
    (function () {
      var dt = new Date(iso + '-01T00:00:00'), fim = new Date(corte + 'T00:00:00');
      var g = 0;
      while (dt <= fim && g++ < 400) {
        var w = dt.getDay();
        if (w !== 0 && w !== 6 && !ferCap.has(dt.toISOString().slice(0, 10))) uteisNoMes++;
        dt.setDate(dt.getDate() + 1);
      }
    })();

    var ferAus = feriadosSet(S);
    var AUS_ROTULO = { ferias: 'férias', folga: 'folga', licenca: 'licença', atestado: 'atestado', outro: '' };
    var ausencias = ((S || {}).ausencias || []).map(function (a) {
      var de = String(a.inicio || '') > iso + '-01' ? String(a.inicio || '') : iso + '-01';
      var ate = String(a.fim || a.inicio || '') < fimMes ? String(a.fim || a.inicio || '') : fimMes;
      if (!de || !ate || ate < de) return null;
      var dias = 0;
      var dt = new Date(de + 'T00:00:00'), fim = new Date(ate + 'T00:00:00');
      var guarda = 0;
      while (dt <= fim && guarda++ < 400) {
        var dow = dt.getDay();
        var isoDia = dt.toISOString().slice(0, 10);
        if (dow !== 0 && dow !== 6 && !ferAus.has(isoDia)) dias++;
        dt.setDate(dt.getDate() + 1);
      }
      return dias ? { nome: a.dev || '—', dias: dias, tipo: AUS_ROTULO[a.tipo] || '' } : null;
    }).filter(Boolean).sort(function (x, y) { return y.dias - x.dias; });

    var PRJ_ABERTO = ['planejado', 'em_andamento', 'pausado', ''];
    var prjPlan = rateiaHoras(S, conc, function (m) {
      return { de: String(m.inicio || '').slice(0, 10), ate: String(m.entrega || '').slice(0, 10) };
    }, iso + '-01', fimMes);
    var prjRatReal = rateiaHoras(S, conc, function (m) {
      return { de: String(m.inicio || '').slice(0, 10), ate: String(m.concluido_em || m.entrega || '').slice(0, 10) };
    }, iso + '-01', fimMes);
    var projetos = ((S || {}).projetos || [])
      .filter(function (p) { return p && !p.oculto && PRJ_ABERTO.indexOf(String(p.status || '')) >= 0; })
      .map(function (p) {
        var itens = MS.filter(function (m) { return !m.oculto && !m.mesclado_em && String(m.projeto_id || '') === String(p.id); });
        var feitas = itens.filter(function (m) { return FILA.ehEntregaDe(m, iso + '-01', fimMes); }).length;
        var andando = itens.filter(function (m) {
          var ini = String(m.inicio || '').slice(0, 10);
          var fim = String(m.concluido_em || '').slice(0, 10);
          return ini && ini <= corte && (!fim || fim > corte) && ['negada'].indexOf(m.status_planejamento || '') < 0;
        }).length;
        var doMes = itens.filter(function (m) { return FILA.ehEntregaDe(m, iso + '-01', fimMes); });
        var hPlan = 0, hReal = 0;
        doMes.forEach(function (m) {
          hPlan += prjPlan.get(m.id) || 0;
          hReal += horasDoMes(S, m, iso + '-01', fimMes, prjRatReal);
        });
        var titulosDoMes = doMes.map(function (m) { return String(m.titulo || '').trim(); }).filter(Boolean).slice(0, 3);
        var situacao = { planejado: 'planejado', em_andamento: 'em andamento', pausado: 'pausado' }[String(p.status || '')] || '';
        return {
          nome: (p.codigo ? p.codigo + ' · ' : '') + (p.nome || '(sem nome)'),
          resp: p.responsavel || '', feitas: feitas, andando: andando, total: itens.length,
          plan: Math.round(hPlan), real: Math.round(hReal),
          pct: hPlan > 0 ? Math.round(hReal / hPlan * 100) : null,
          descricao: String(p.descricao || '').trim(),
          entregou: titulosDoMes,
          situacao: situacao,
          inicio: String(p.inicio || '').slice(0, 10),
          fim: String(p.fim || '').slice(0, 10)
        };
      })
      .sort(function (a, b) {
        return (b.plan + b.real) - (a.plan + a.real) || (b.feitas + b.andando) - (a.feitas + a.andando) || a.nome.localeCompare(b.nome, 'pt-BR');
      });

    var quebra = fluxoFila.quebra;

    var diasCorridos = function (de, ate) {
      var a = Date.parse(String(de).slice(0, 10) + 'T00:00:00Z');
      var b = Date.parse(String(ate).slice(0, 10) + 'T00:00:00Z');
      if (!isFinite(a) || !isFinite(b) || b < a) return null;
      return Math.round((b - a) / 86400000);
    };
    var TIPO_ROT = { evolucao: 'Evolução', sustentacao: 'Sustentação' };
    var temaDe = function (m) { return ((S || {}).temas || []).find(function (x) { return String(x.id) === String(m.tema_id); }); };
    var rapidasDe = function (lista) {
      return lista.map(function (m) {
        var dias = diasCorridos(m.criado_em, m.concluido_em);
        return dias === null || dias > 2 ? null : { m: m, dias: dias };
      }).filter(Boolean);
    };
    var rapidasLista = rapidasDe(conc)
      .sort(function (a, b) { return a.dias - b.dias || String(a.m.codigo || '').localeCompare(String(b.m.codigo || '')); })
      .map(function (x) {
        var m = x.m, t = temaDe(m);
        return { codigo: m.codigo || '', titulo: m.titulo || '', dias: x.dias,
                 tipo: TIPO_ROT[String(m.tipo || '')] || '', tema: t ? catCurto(t.nome) : '', dev: m.dev || '' };
      });

    var pmMes = mes - 1, pmAno = ano;
    if (pmMes === 0) { pmMes = 12; pmAno--; }
    var isoAnt = pmAno + '-' + String(pmMes).padStart(2, '0');
    var fimAnt = isoAnt + '-' + String(new Date(pmAno, pmMes, 0).getDate()).padStart(2, '0');
    var concAnt = MS.filter(function (m) { return FILA.ehEntregaDe(m, isoAnt + '-01', fimAnt); });
    var clAnt = new Map(concAnt.map(function (m) { return [m.id, prazoClassifica(m)]; }));
    var noPrazoAnt = concAnt.filter(function (m) { return (clAnt.get(m.id) || {}).tipo === 'no_prazo'; }).length;
    var atrasAntMes = concAnt.filter(function (m) { return (clAnt.get(m.id) || {}).tipo === 'atraso' && String(m.entrega || '').slice(0, 7) >= isoAnt; }).length;
    var medidasAnt = noPrazoAnt + atrasAntMes;
    var fa = FILA.fluxo(vivasFluxo, isoAnt + '-01', fimAnt, fimAnt);
    var anterior = {
      nome: mesNome(pmMes - 1),
      backlogInicio: fa.backlogInicio, recebidas: fa.recebidas, saidas: fa.saidas, backlogFim: fa.backlogFim,
      concluidas: concAnt.length,
      pontos: concAnt.reduce(function (t, m) { return t + (Number(m.poker_pontos) || 0); }, 0),
      horas: (function () { var p = apresPipelines(S, concAnt, isoAnt + '-01', fimAnt); return p ? p.total.real : null; })(),
      rapidas: rapidasDe(concAnt).length,
      pct: medidasAnt ? Math.round(noPrazoAnt / medidasAnt * 100) : null,
      parcial: mesEmCurso
    };

    var evolucao = [];
    for (var k = 1; k >= 0; k--) {
      var dtE = new Date(ano, mes - 1 - k, 1);
      var iM = dtE.getFullYear() + '-' + String(dtE.getMonth() + 1).padStart(2, '0');
      var fimM = iM + '-' + String(new Date(dtE.getFullYear(), dtE.getMonth() + 1, 0).getDate()).padStart(2, '0');
      var corteM = (hojeISO >= iM + '-01' && hojeISO <= fimM) ? hojeISO : fimM;
      var fM = FILA.fluxo(vivasFluxo, iM + '-01', corteM, fimM);
      var cM = MS.filter(function (m) {
        return !m.oculto && !m.mesclado_em && (m.status_planejamento || '') === 'concluido' && String(m.concluido_em || '').slice(0, 7) === iM;
      });
      var clM = new Map(cM.map(function (m) { return [m.id, prazoClassifica(m)]; }));
      var okM = cM.filter(function (m) { return (clM.get(m.id) || {}).tipo === 'no_prazo'; }).length;
      var atrM = cM.filter(function (m) { return (clM.get(m.id) || {}).tipo === 'atraso' && String(m.entrega || '').slice(0, 7) >= iM; }).length;
      evolucao.push({
        rot: mesNome(dtE.getMonth()).slice(0, 3),
        entraram: fM.recebidas, sairam: fM.saidas, backlog: fM.backlogFim,
        pct: (okM + atrM) ? Math.round(okM / (okM + atrM) * 100) : null,
        parcial: corteM !== fimM
      });
    }

    var ta = apresTimeEAreas(S, conc, cl);
    var pipelines = apresPipelines(S, conc, iso + '-01', fimMes);

    var frentesDetalhe = (function () {
      var api = W.PIPELINES;
      if (!api || !pipelines) return [];
      var perfis = (S || {}).devs_perfil || {};
      var acc = {};
      var poe = function (nome) {
        acc[nome] = acc[nome] || { entregas: [], devs: new Map(), projetos: new Map() };
        return acc[nome];
      };
      conc.forEach(function (m) {
        var devs = api.devsDaDemanda(m);
        var frentes = new Set((devs.length ? devs : [null]).map(function (n) {
          return n ? (api.doDev(n, perfis) || api.NAO_CLASSIFICADO) : api.NAO_CLASSIFICADO;
        }));
        var pts = Number(m.poker_pontos) || 0;
        frentes.forEach(function (f) {
          var a = poe(f);
          a.entregas.push({ codigo: m.codigo || '', titulo: m.titulo || '', pontos: pts, dev: (devs[0] || '') });
          devs.forEach(function (n) {
            if ((api.doDev(n, perfis) || api.NAO_CLASSIFICADO) !== f) return;
            var d = a.devs.get(n) || { entregas: 0, pontos: 0 };
            d.entregas += 1; d.pontos += pts / devs.length;
            a.devs.set(n, d);
          });
          if (m.projeto_id) {
            var p = ((S || {}).projetos || []).find(function (x) { return String(x.id) === String(m.projeto_id); });
            if (p) {
              var kp = String(p.id);
              var j = a.projetos.get(kp) || { nome: (p.codigo ? p.codigo + ' · ' : '') + (p.nome || ''), qtd: 0, pontos: 0 };
              j.qtd += 1; j.pontos += pts;
              a.projetos.set(kp, j);
            }
          }
        });
      });
      return pipelines.itens
        .filter(function (f) { return acc[f.nome] && acc[f.nome].entregas.length; })
        .map(function (f) {
          var a = acc[f.nome];
          return {
            nome: f.nome, cor: f.cor, plan: f.plan, real: f.real,
            pontos: f.pontos, entregas: f.entregas, pessoas: f.devs,
            pct: f.pct, evolucao: f.evolucao, sustentacao: f.sustentacao,
            topEntregas: a.entregas
              .sort(function (x, y) { return y.pontos - x.pontos || String(x.codigo).localeCompare(String(y.codigo)); })
              .slice(0, 5),
            topProjetos: Array.from(a.projetos.values()).sort(function (x, y) { return y.qtd - x.qtd || y.pontos - x.pontos; }),
            topDevs: Array.from(a.devs.entries())
              .map(function (e) { return { nome: e[0], entregas: e[1].entregas, pontos: Math.round(e[1].pontos) }; })
              .sort(function (x, y) { return y.pontos - x.pontos || y.entregas - x.entregas; })
          };
        })
        .sort(function (a, b) { return (b.plan + b.real) - (a.plan + a.real); })
        .slice(0, 3);
    })();

    var diasDoMes = new Date(ano, mes, 0).getDate();
    var ganttDev = (ta.porDev || []).slice(0, 3).map(function (dv) {
      var minhas = conc.filter(function (m) {
        return String(m.dev || '').split(/[\/,]/).map(function (x) { return x.trim(); }).indexOf(dv.nome) >= 0;
      });
      var barras = minhas.map(function (m) {
        var ini = String(m.inicio || '').slice(0, 10);
        var fim = String(m.concluido_em || m.entrega || '').slice(0, 10);
        var d1 = (ini && ini >= iso + '-01' && ini <= fimMes) ? Number(ini.slice(8, 10)) : 1;
        var d2 = (fim && fim >= iso + '-01' && fim <= fimMes) ? Number(fim.slice(8, 10)) : diasDoMes;
        var t = temaDe(m);
        return {
          titulo: (m.codigo ? m.codigo + ' · ' : '') + (m.titulo || ''),
          de: Math.max(1, Math.min(d1, d2)), ate: Math.min(diasDoMes, Math.max(d1, d2)),
          tipo: TIPO_ROT[String(m.tipo || '')] || '',
          tema: t ? catCurto(t.nome) : '',
          pontos: Number(m.poker_pontos) || 0
        };
      }).sort(function (a, b) { return a.de - b.de || a.ate - b.ate; });
      return { nome: dv.nome, entregas: minhas.length, pontos: dv.extra || 0, dias: diasDoMes, barras: barras };
    });

    var idsDestaque = soApuracao
      ? conc.filter(function (m) { return m.destaque; }).map(function (m) { return m.id; })
      : (o.idsDestaque || []).slice();
    var destaques = idsDestaque.map(function (idDest) {
      var m = MS.find(function (x) { return x.id === idDest; }) || {};
      var tema = ((S || {}).temas || []).find(function (t) { return String(t.id) === String(m.tema_id); });
      return {
        codigo: m.codigo || '', titulo: m.titulo || '',
        texto: (resumoDaEntrega(m) || String(m.descricao || '')).slice(0, 600),
        dev: m.dev || '', tema: tema ? tema.nome : '',
        pontos: m.poker_pontos || null
      };
    });

    var diaMs = function (t) { return Date.parse(String(t).slice(0, 10) + 'T00:00:00Z'); };
    var pausadas = MS.filter(function (m) { return !m.mesclado_em && !m.oculto; })
      .filter(function (m) { var p = String(m.pausado_em || '').slice(0, 10); return p && p <= corte; })
      .map(function (m) {
        return {
          titulo: (m.codigo ? m.codigo + ' · ' : '') + (m.titulo || ''),
          dias: Math.max(0, Math.round((diaMs(corte) - diaMs(m.pausado_em)) / 86400000)),
          motivo: String(m.pausa_motivo || '—').slice(0, 90)
        };
      })
      .sort(function (a, b) { return b.dias - a.dias; });

    var prox = new Date(ano, mes, 1);
    var isoProx = prox.getFullYear() + '-' + String(prox.getMonth() + 1).padStart(2, '0');
    var proximos = MS.filter(function (m) {
      return !m.mesclado_em && !m.oculto && ['planejado', 'em_andamento'].indexOf(m.status_planejamento || '') >= 0 &&
        !String(m.concluido_em || '').trim() && String(m.entrega || '').slice(0, 7) === isoProx;
    })
      .sort(function (a, b) { return String(a.entrega).localeCompare(String(b.entrega)); })
      .map(function (m) { return { titulo: (m.codigo ? m.codigo + ' · ' : '') + (m.titulo || ''), dev: m.dev || '—', entrega: formatDate(m.entrega) }; });

    var imagens = [];
    var periodo = mesNome(mes - 1).replace(/^./, function (c) { return c.toUpperCase(); }) + ' de ' + ano;
    var temaMapDoDeck = {};
    ((S || {}).temas || []).forEach(function (t) { temaMapDoDeck[t.id] = t.nome; });

    var entregasTop = (function () {
      var tempoDe = function (m) { return diasCorridos(m.inicio, (PRAZO ? PRAZO.fimDoDev(m) : null) || m.concluido_em); };
      var medida = function (lista) {
        var ts = lista.map(tempoDe).filter(function (v) { return v !== null; });
        return {
          pontos: lista.reduce(function (t, m) { return t + (Number(m.poker_pontos) || 0); }, 0),
          entregas: lista.length,
          tempo: ts.length ? Math.round(ts.reduce(function (a, b) { return a + b; }, 0) / ts.length * 10) / 10 : null,
          comTempo: ts.length
        };
      };
      var agora = medida(conc), antes = medida(concAnt);
      return Object.assign({}, agora, {
        anterior: antes,
        media: agora.entregas ? Math.round(agora.pontos / agora.entregas * 10) / 10 : null,
        mediaAnt: antes.entregas ? Math.round(antes.pontos / antes.entregas * 10) / 10 : null,
        itens: conc.filter(function (m) { return (Number(m.poker_pontos) || 0) > 0; })
          .sort(function (a, b) {
            return (Number(b.poker_pontos) || 0) - (Number(a.poker_pontos) || 0) ||
              ((tempoDe(a) == null ? 1e9 : tempoDe(a)) - (tempoDe(b) == null ? 1e9 : tempoDe(b)));
          })
          .slice(0, 8)
          .map(function (m) {
            var t = temaDe(m);
            return { codigo: m.codigo || '', titulo: m.titulo || '', dev: m.dev || '', tema: t ? catCurto(t.nome) : '',
                     pontos: Number(m.poker_pontos) || 0, dias: tempoDe(m) };
          }),
        semPontos: conc.filter(function (m) { return !(Number(m.poker_pontos) || 0); }).length
      });
    })();

    /* A ORIGEM ESCREVE `capacidade` DUAS VEZES no mesmo objeto: a primeira
       (planejado x entregue em pontos, de capacidade.js) e calculada e a
       segunda (devs, dias uteis, ausencias) a substitui. Vale a segunda — e o
       que o apresentacao.js recebe de la. A primeira conta e repetida aqui so
       para errar do mesmo jeito se ela quebrar. */
    (function () {
      var CAPI = W.CAPACIDADE;
      var vivasCap = MS.filter(function (m) { return m && !m.oculto && !m.mesclado_em; });
      var faixas = gerSemanasDoMes(S, ano, mes).filter(function (w) { return w.length; }).map(function (w) { return { de: w[0], ate: w[w.length - 1] }; });
      CAPI.porDev(vivasCap, iso + '-01', fimMes);
      CAPI.porFaixa(vivasCap, faixas);
    })();

    var apu = {
      titulo: 'AXIS',
      periodo: periodo,
      subtitulo: 'Audax Capital · Tecnologia',
      secoes: secoes,
      kpi: {
        concluidas: conc.length, pontos: pontos,
        notaEntregas: medidas ? medidas + ' delas com data de conclusão registrada no fluxo.' : ''
      },
      prazo: {
        pct: medidas ? Math.round(noPrazoPz.length / medidas * 100) : 0,
        noPrazo: noPrazoPz.length, medidas: medidas, diasMedio: diasMedio,
        naoMedidas: semMedirPz.length,
        semPrazoComb: semMedirPz.filter(function (m) { return ['sem_prazo', 'sem_conclusao'].indexOf((clPz.get(m.id) || {}).tipo) >= 0; }).length,
        emAberto: prometidasEmAberto.length,
        prometidas: prometidas.length,
        mesAnterior: mesNome((mes + 10) % 12),
        atrasadas: atrasPz
          .sort(function (a, b) { return clPz.get(b.id).dias - clPz.get(a.id).dias; })
          .map(function (m) {
            return {
              titulo: (m.codigo ? m.codigo + ' · ' : '') + String(m.titulo || '').slice(0, 60),
              dev: m.dev || '—',
              datas: formatDate(m.entrega) + ' → ' + formatDate((PRAZO ? PRAZO.fimDoDev(m) : m.concluido_em)),
              dias: clPz.get(m.id).dias
            };
          })
      },
      anterior: anterior,
      evolucao: evolucao.slice(Math.max(0, evolucao.findIndex(function (x) { return x.entraram || x.sairam || x.backlog; }))),
      ganttDev: ganttDev,
      pipelines: pipelines,
      frentesDetalhe: frentesDetalhe,
      pontos: gerCortesDePontos(S, ano, mes, temaMapDoDeck, function (txt) { return W.PIPELINES.devsDaDemanda({ dev: txt }); }),
      /* a posicao e a da primeira `capacidade` da origem; o valor, o da segunda */
      capacidade: { devs: devsAtuaram.size, uteis: uteisNoMes, fora: ausencias.reduce(function (s, a) { return s + a.dias; }, 0) },
      rapidas: { itens: rapidasLista, total: conc.length },
      entregasTop: entregasTop,
      quebra: quebra,
      cobertura: (W.SELO ? W.SELO.cobertura(conc) : null),
      fluxo: { recebidas: entradas.length, entregues: conc.length, tocadas: tocadas, backlogInicio: backlogInicio, backlogFim: backlogFim, porTipo: porTipo,
               saidas: saidas.length, saiuEntregue: saiuEntregue, saiuNegada: saiuNegada, emCurso: mesEmCurso, corte: formatDate(corte) },
      time: ta.time,
      projetos: projetos,
      ausencias: ausencias,
      areas: ta.areas,
      frentesAtraso: ta.frentes,
      porDev: ta.porDev,
      solicitantes: { itens: ta.solicitantes, sem: ta.semSolic, total: conc.length },
      destaques: destaques,
      imagens: imagens,
      riscos: { pausadas: pausadas, semPonto: 0 },
      proximo: { itens: proximos, sub: 'com data no mês seguinte e ainda em aberto em ' + new Date().toLocaleDateString('pt-BR') },
      mensagem: soApuracao ? '' : String(o.mensagem || '').trim()
    };
    if (soApuracao) {
      var so = Object.assign({}, apu);
      delete so.secoes; delete so.imagens; delete so.mensagem;
      /* `pontos.itens` sao as demandas INTEIRAS do mes, e o deck so le os cortes
         (total, porSemana, porDev, porAssunto, porSprint). Em outubro/2026 eram
         975 KB de 1076 KB, e o Worker recusa acima de 1 MB: o mes nao congelava
         (admin.html, `apresGerar`, na resolucao do merge de 05/11/2026). */
      if (so.pontos) { so.pontos = Object.assign({}, so.pontos); delete so.pontos.itens; }
      return so;
    }
    return apu;
  }

  /** O MES CONGELADO VENCE A BASE VIVA (`apresGerar`): as escolhas de agora
   *  (slides, imagens, frase) entram por cima da apuracao congelada, e o slide
   *  diz que esta congelado. `cong` = { apuracao, congelado_em }, ou null. */
  function comCongelada(apu, cong) {
    if (!cong) return apu;
    return Object.assign({}, cong.apuracao, {
      secoes: apu.secoes, imagens: apu.imagens, mensagem: apu.mensagem,
      fluxo: Object.assign({}, cong.apuracao.fluxo || {}, {
        corte: formatDate(String(cong.congelado_em).slice(0, 10)), congelado: true, emCurso: false
      })
    });
  }

  var REGRAS_FECHA = {
    usar: usar, formatDate: formatDate, resumoDaEntrega: resumoDaEntrega, mesSomaLocal: mesSomaLocal,
    mesTrilhaDe: mesTrilhaDe, mesDe: mesDe, mesDoPeriodo: mesDoPeriodo, aRolar: aRolar, pedidoFechar: pedidoFechar,
    rateiaHoras: rateiaHoras, horasReaisDe: horasReaisDe, horasDoMes: horasDoMes, prazoClassifica: prazoClassifica,
    gerSemanasDoMes: gerSemanasDoMes, cortePontosPorDev: cortePontosPorDev, relRaizNome: relRaizNome, gerCortesDePontos: gerCortesDePontos,
    AP_SECOES: AP_SECOES, AP_SEMPRE: AP_SEMPRE, secoesPreset: secoesPreset, apresTimeEAreas: apresTimeEAreas, apresPipelines: apresPipelines,
    concluidasDoMes: concluidasDoMes, candidatasDestaque: candidatasDestaque, periodoNome: periodoNome, nomeArquivoDeck: nomeArquivoDeck,
    apuracao: apuracao, comCongelada: comCongelada
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = REGRAS_FECHA; return; }
  raiz.AXIS_FECHA = REGRAS_FECHA;

  // ══ A TELA ══════════════════════════════════════════════════════════════
  if (!raiz.AXIS_APP) return;
  var H = raiz.AXIS_APP.H;
  var esc = H.esc;
  var G = function () { return raiz.AXIS_GER; };

  /* O INDICE DE CONGELADOS e lido uma vez por sessao, como no admin
     (`fechaCarregar`), e de novo depois de congelar ou descongelar. Falha de
     rede nao inventa estado: sem resposta, a tela diz que nao conseguiu ler,
     e nao que o mes esta aberto — e o botao de congelar nao aparece. */
  var _cong = null, _congLendo = false, _congErro = '';
  var _pagNao = 0, _alvoPag = '';
  var _ocupado = false;

  function lerCongelados(forcar) {
    if (forcar) { _cong = null; _congErro = ''; }
    if (_cong || _congLendo) return;
    _congLendo = true;
    H.api('fechamento-ler').then(function (j) {
      _cong = Array.isArray(j.meses) ? j.meses : [];
    }).catch(function (e) {
      _congErro = e && e.message ? e.message : 'falha de rede';
    }).then(function () {
      _congLendo = false;
      Array.prototype.forEach.call(document.querySelectorAll('[data-cong]'), function (el) {
        el.innerHTML = estadoCongelado(el.getAttribute('data-cong'), el.getAttribute('data-modo'));
      });
    });
  }
  function congeladoDe(alvo) { return (_cong || []).find(function (x) { return x.mes === alvo; }) || null; }

  /** A marca do mes (`fechaRender`, admin.html): congelado, em curso, ou
   *  fechado e ainda recalculando da base de hoje — e, para o admin, o botao
   *  que congela ou descongela. */
  function estadoCongelado(alvo, modo) {
    var g = G();
    var curto = modo === 'curto';
    if (!_cong) {
      if (_congErro) return '<span class="note">' + H.ico('alert') + ' Não consegui ler os meses congelados (' + esc(_congErro) + ').</span>';
      return '<span class="note">' + H.ico('hourglass') + ' Lendo os meses congelados…</span>';
    }
    var pode = H.pode('fechar') && !curto;
    var f = congeladoDe(alvo);
    if (f) {
      return H.chip(H.ico('lock') + ' congelado', 'ok', f.nota || '') + (curto ? '' : ' <span class="note">em ' + H.dma(String(f.congelado_em).slice(0, 10)) +
        (f.por ? ' por ' + esc(f.por) : '') + '. O deck deste mês sai da apuração congelada e não muda mais.</span>') +
        (pode ? '<button type="button" class="btns" data-fc-congelar="' + alvo + '" title="Volta a calcular da base viva — os números podem mudar.">' + H.ico('unlock') + ' Descongelar</button>' : '');
    }
    if (alvo >= g.mesCorrente()) {
      return H.chip(H.ico('hourglass') + ' mês em curso', 'in') + (curto ? '' : ' <span class="note">os números ainda se mexem; só congela depois que o mês terminar.</span>') +
        (pode ? '<button type="button" class="btns" disabled title="Só depois que o mês terminar — congelar um mês em curso gravaria meio mês como se fosse o fechamento.">' + H.ico('lock') + ' Congelar mês</button>' : '');
    }
    return H.chip(H.ico('alert') + ' não congelado', 'wn') + (curto ? '' : ' <span class="note">o deck recalcula da base de hoje a cada geração.</span>') +
      (pode ? '<button type="button" class="btns" data-fc-congelar="' + alvo + '" title="Grava a apuração deste mês. O deck passa a sair dela, e para de mudar.">' + H.ico('lock') + ' Congelar mês</button>' : '');
  }

  /* A BASE FRESCA, antes de apurar: o admin rele antes de montar o deck e
     antes de congelar (`apresGerar`), porque "o que vem" e o que ficou em
     aberto sao do momento de agora. Le pela mesma rota e com a mesma trilha
     (`hidrata`) do nucleo, sem redesenhar a tela no meio do clique. */
  function baseFresca() {
    return H.api('dados').then(function (j) { return H.hidrata(j); });
  }
  /** `fechaApuracaoDe` (admin.html): a apuracao congelada de um mes, ou null. */
  function apuracaoCongelada(alvo) {
    return H.api('fechamento-ler', { mes: alvo }).then(function (j) {
      if (!j.ok || !j.apuracao) return null;
      return { apuracao: j.apuracao, congelado_em: j.congelado_em, por: j.por };
    }).catch(function () { return null; });
  }

  // ═══ Fechar o mes (`mesFecharAbrir`) ═══════════════════════════════════
  async function fecharMes(alvo, botao) {
    if (_ocupado) return;
    var D = raiz.AXIS_APP.APP.D;
    var itens = REGRAS_FECHA.aRolar(D, alvo);
    var prox = mesSomaLocal(alvo, 1);
    if (!itens.length) { H.toast('Nada a rolar: nenhuma demanda de ' + alvo + ' ficou em aberto.'); return; }
    var nomes = itens.slice(0, 8).map(function (m) { return (m.codigo || '') + ' · ' + (m.titulo || ''); }).join('\n');
    if (!raiz.confirmar) { H.toast('O diálogo de confirmação não carregou. Recarregue a página.', 'erro'); return; }
    var ok = await raiz.confirmar({
      titulo: 'Fechar ' + alvo + ' e rolar o que ficou?',
      texto: itens.length + ' demanda(s) em aberto passam para ' + prox + ':\n\n' + nomes +
             (itens.length > 8 ? '\n… e mais ' + (itens.length - 8) : '') +
             '\n\nO mês de origem continua registrado em cada uma — é assim que ' + alvo + ' segue mostrando o que prometeu e não entregou.',
      ok: 'Fechar e rolar' });
    if (!ok) return;
    _ocupado = true;
    var rot = botao ? botao.innerHTML : '';
    if (botao) { botao.disabled = true; botao.textContent = 'Fechando…'; }
    try {
      var p = REGRAS_FECHA.pedidoFechar(D, alvo);
      var j = await H.api('mes-fechar', { mes: p.mes, para: p.para, base: p.base });
      H.toast((j.roladas || []).length + ' demanda(s) roladas para ' + prox + '.');
      await H.recarregar();
    } catch (e) {
      H.toast((e && e.status ? 'Não consegui fechar: ' : 'Falha ao fechar o mês: ') + ((e && e.message) || e), 'erro');
    } finally {
      _ocupado = false;
      if (botao && botao.isConnected) { botao.disabled = false; botao.innerHTML = rot; }
    }
  }

  // ═══ Congelar e descongelar (`fechaCongelar`, `fechaDescongelar`) ════════
  async function alternarCongelado(alvo, botao) {
    if (_ocupado || !raiz.confirmar) return;
    var nome = periodoNome(alvo);
    var ja = congeladoDe(alvo);
    var ok = ja
      ? await raiz.confirmar({ titulo: 'Descongelar ' + nome,
          texto: 'O deck volta a ser calculado da base viva. Os números podem ficar diferentes do que já foi apresentado — foi exatamente isso que o congelamento passou a impedir.',
          ok: 'Descongelar', perigo: true })
      : await raiz.confirmar({ titulo: 'Congelar ' + nome,
          texto: 'Grava os números deste mês como estão agora. A partir daí o deck sai desta apuração e para de mudar — mesmo que alguém valide uma entrega com data deste mês depois.',
          ok: 'Congelar' });
    if (!ok) return;
    _ocupado = true;
    if (botao) { botao.disabled = true; botao.textContent = ja ? 'Descongelando…' : 'Congelando…'; }
    try {
      if (ja) {
        var jd = await H.api('fechamento-apagar', { mes: alvo });
        if (!jd.ok) throw new Error(jd.detail || jd.error || 'resposta sem ok');
        H.toast(nome + ' descongelado.');
      } else {
        /* A MESMA APURACAO DO DECK, ESPERADA. O admin monta a apuracao pelo
           `apresGerar({ soApuracao: true })` e a manda sem `await` — o corpo
           do pedido leva a Promise, que vira `{}` no JSON, e o Worker aceita:
           o mes fica congelado vazio. Aqui ela e calculada antes de enviar. */
        var S = await baseFresca();
        var apu = REGRAS_FECHA.apuracao(S, { ano: +alvo.slice(0, 4), mes: +alvo.slice(5, 7), soApuracao: true });
        var jg = await H.api('fechamento-gravar', { mes: alvo, apuracao: apu, refazer: false });
        if (!jg.ok) throw new Error(jg.detail || jg.error || 'resposta sem ok');
        H.toast(nome + ' congelado (' + (jg.tamanho_kb || '?') + ' KB).');
      }
    } catch (e) {
      H.toast('Não consegui ' + (ja ? 'descongelar' : 'congelar') + ': ' + ((e && e.message) || e), 'erro');
    } finally {
      _ocupado = false;
      lerCongelados(true);
    }
  }

  // ═══ Fechamento ════════════════════════════════════════════════════════
  function fechamento(ctx) {
    var g = G(), D = ctx.D, alvo = g.alvoDe(ctx.param);
    if (alvo !== _alvoPag) { _alvoPag = alvo; _pagNao = 0; }
    var fc = g.fechamentoDoMes(D, alvo), pz = g.prazoDoMes(D, alvo);
    var ant = g.mesSoma(alvo, -1), fcA = g.fechamentoDoMes(D, ant);
    var pode = H.pode('fechar');
    var rolam = REGRAS_FECHA.aRolar(D, alvo), prox = g.mesSoma(alvo, 1);
    var h = g.cabecalho('Fechamento de ' + esc(g.nomeMes(alvo)),
      'O que o time prometeu no começo do mês, o que entrou depois e o que foi entregue. Fechar rola o que ficou em aberto; congelar faz os números do deck virarem histórico.',
      g.seletorMes('fechamento/mes', alvo) +
      (pode ? '<a class="btn" href="#fechamento/apresentacao/' + alvo + '" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none">' + H.ico('present') + ' Gerar apresentação</a>' +
              '<button type="button" class="btnp" data-fc-fechar="' + alvo + '"' + (rolam.length ? '' : ' title="Nenhuma demanda deste mês ficou em aberto."') + '>Fechar o mês</button>' : ''));
    h += '<div class="row" style="flex-wrap:wrap;gap:8px" data-cong="' + alvo + '">' + estadoCongelado(alvo) + '</div>';

    // KPIs: os quatro da aba Mes (`renderMes`) e o prazo (`renderGerPrazo`).
    var ptsIni = fc.inicio.reduce(function (t, m) { return t + H.pontosDe(m); }, 0);
    var sust = fc.meio.filter(function (m) { return m.tipo === 'sustentacao'; }).length, evo = fc.meio.filter(function (m) { return m.tipo === 'evolucao'; }).length;
    var entIni = fc.entrInicio, entMeio = fc.entregues.length - entIni;
    h += '<div class="gx-g gx-k5">' +
      g.k('Comprometidas no dia 1', H.num(fc.inicio.length), ptsIni ? H.num(ptsIni) + ' pontos' : 'desde o início do mês') +
      g.k('Entraram depois', H.num(fc.meio.length), fc.meio.length ? [sust ? sust + ' sustentação' : '', evo ? evo + ' evolução' : '', fc.meio.length - sust - evo ? (fc.meio.length - sust - evo) + ' sem tipo' : ''].filter(Boolean).join(' · ') : '—',
          fc.meio.length ? 'var(--wn-t)' : '') +
      g.k('Entregues', H.num(fc.entregues.length), entIni + ' das comprometidas · ' + entMeio + ' das que entraram', fc.entregues.length ? 'var(--ok-t)' : '') +
      g.k('Cumprimento do compromisso', fc.pct === null ? '—' : fc.pct + '%',
          fc.inicio.length ? 'meta 80% · ' + esc(g.nomeMes(ant)) + ' ' + (fcA.pct === null ? '—' : fcA.pct + '%') : 'nada comprometido no início', g.corPct(fc.pct)) +
      g.k('Entregues no prazo', pz.pct === null ? '—' : pz.pct + '%', pz.medidas ? pz.noPrazo.length + ' de ' + pz.medidas + ' com prazo' : 'nada medível no mês', g.corPct(pz.pct)) + '</div>';

    if (!fc.itens.length) {
      return h + '<section class="pn">' + H.vazio('calendar', 'Nenhuma demanda alocada em ' + g.rotuloMes(alvo),
        'A demanda ganha o mês ao entrar em Planejado, e o mês pode ser trocado no card.') + '</section>';
    }

    // Por sprint (`renderMes`): agrupado pelo rotulo `sprint` do card; sem
    // sprint e um grupo proprio, e nao escondido.
    var porS = {};
    fc.itens.forEach(function (m) { var s = String(m.sprint || '').trim() || '(sem sprint)'; (porS[s] = porS[s] || []).push(m); });
    var ordem = Object.keys(porS).sort(function (a, b) {
      if (a === '(sem sprint)') return 1;
      if (b === '(sem sprint)') return -1;
      var k = function (r) { return r.slice(6, 10) + r.slice(3, 5) + r.slice(1, 2); };
      return raiz.SPRINTPO && raiz.SPRINTPO.rotuloValido(a) && raiz.SPRINTPO.rotuloValido(b) ? k(a).localeCompare(k(b)) : a.localeCompare(b, 'pt-BR');
    });
    var COR = { entregue: 'var(--ok-t)', transbordou: 'var(--dg-t)', em_curso: 'var(--in-t)', negada: 'var(--tx3)' };
    var ROT = { entregue: 'entregue', transbordou: 'transbordou', em_curso: 'em curso', negada: 'negada' };
    var S = raiz.SPRINTPO, fer = g.feriadosDe(D);
    var cards = ordem.map(function (s) {
      var lista = porS[s].slice().sort(function (a, b) { return String(a.codigo || '').localeCompare(String(b.codigo || ''), 'pt-BR'); });
      var ent = lista.filter(function (m) { return fc.cls.get(m.id) === 'entregue'; });
      var pT = lista.reduce(function (t, m) { return t + H.pontosDe(m); }, 0), pE = ent.reduce(function (t, m) { return t + H.pontosDe(m); }, 0);
      var tr = lista.filter(function (m) { return fc.cls.get(m.id) === 'transbordou'; }).length;
      var cu = lista.filter(function (m) { return fc.cls.get(m.id) === 'em_curso'; }).length;
      var faixa = S && S.rotuloValido(s) ? S.faixaDaSprint(s, fer) : null;
      var pct = lista.length ? Math.round(ent.length / lista.length * 100) : 0;
      return '<details class="gx-card"><summary><span class="row" style="justify-content:space-between;gap:10px"><span style="font-size:13.5px;font-weight:700" class="ell">' +
        '<span class="code" style="margin-right:8px">' + esc(S && S.rotuloValido(s) ? S.rotuloCurto(s) : s) + '</span>' +
        (faixa ? H.dm(faixa.de) + ' a ' + H.dm(faixa.ate) : '') + '</span><span class="mono" style="font-size:12px;color:var(--tx2)">' + ent.length + ' / ' + lista.length +
        (pT ? ' · ' + pE + ' / ' + pT + ' pt' : '') + '</span></span>' +
        '<span class="bar"><span style="width:' + pct + '%;background:var(--ok)"></span></span>' +
        '<span class="note">' + ent.length + ' de ' + lista.length + ' entregues' + (tr ? ' · ' + tr + ' transbordaram' : '') + (cu ? ' · ' + cu + ' em curso' : '') + ' · clique para ver as demandas</span></summary>' +
        '<div class="gx-tw"><table class="tbl"><tbody>' + lista.map(function (m) {
          var c = fc.cls.get(m.id), rol = g.mesRolos(m);
          return '<tr><td style="color:var(--tx)"><span class="row" style="gap:8px">' + g.codLink(m) + '<span class="ell" style="max-width:280px">' + esc(m.titulo || '') + '</span>' +
            (rol ? '<span class="mono" title="já rolou de mês ' + rol + 'x" style="color:var(--dg-t);font-size:11px;font-weight:700">⟳' + rol + '</span>' : '') + '</span></td>' +
            '<td style="white-space:nowrap">' + esc(m.dev || '—') + '</td><td>' + H.chipEtapa(m) + '</td>' +
            '<td class="mono" style="color:' + COR[c] + ';white-space:nowrap">' + ROT[c] + '</td></tr>';
        }).join('') + '</tbody></table></div></details>';
    }).join('');

    // As que nao sairam, nominalmente, com o contador de rolos
    // (`renderGerCumprimento`): a do terceiro rolo esta sendo adiada.
    var nao = fc.transb.slice().sort(function (a, b) { return g.mesRolos(b) - g.mesRolos(a); });
    var pg = g.paginar(nao, _pagNao, 12);
    var tabNao = nao.length ? '<div class="gx-tw"><table class="tbl"><thead><tr><th>ITEM</th><th>DEV</th><th>ETAPA</th><th>DESTINO</th></tr></thead><tbody>' +
      pg.itens.map(function (m) {
        var dest = g.mesDe(m), c = fc.cls.get(m.id), rol = g.mesRolos(m);
        var chipD = dest && dest !== alvo ? H.chip(esc(g.rotuloMes(dest)), 'in') : c === 'em_curso' ? H.chip('em curso', 'bk') : H.chip('não rolou', 'wn', 'O mês ainda não foi fechado: a demanda não ganhou mês novo.');
        return '<tr><td style="color:var(--tx)"><span class="row" style="gap:8px">' + g.codLink(m) + '<span class="ell" style="max-width:220px" title="' + esc(m.titulo || '') + '">' + esc(m.titulo || '') + '</span>' +
          (rol ? '<span class="mono" title="já rolou de mês ' + rol + 'x" style="color:' + (rol >= 2 ? 'var(--dg-t)' : 'var(--tx3)') + ';font-size:11px;font-weight:700">⟳' + rol + '</span>' : '') + '</span></td>' +
          '<td>' + esc(m.dev || '—') + '</td><td>' + H.chipEtapa(m) + '</td><td>' + chipD + '</td></tr>';
      }).join('') + '</tbody></table></div>' + g.navPag(pg, nao.length, 'pag-nao')
      : H.vazio('check', 'Tudo o que estava no mês saiu');

    // Entregas por semana: as entregues do mes pela data de conclusao, em
    // blocos de 7 dias a partir do dia 1 (`pmSemanas`), separando o que era
    // compromisso do dia 1 do que entrou depois.
    var sem = g.pmSemanas(alvo), antes = 0;
    var cols = sem.map(function (s) { return { rot: s.rot, partes: [{ v: 0, cor: 'var(--ac)', nome: 'comprometidas' }, { v: 0, cor: 'var(--tl)', nome: 'entraram depois' }] }; });
    fc.entregues.forEach(function (m) {
      var d = String(m.concluido_em || '').slice(0, 10), i = -1;
      sem.forEach(function (s, x) { if (d >= s.de && d <= s.ate) i = x; });
      if (i < 0) { antes++; return; }
      cols[i].partes[g.mesDesdeOInicio(m, alvo) ? 0 : 1].v++;
    });

    // A CONFERENCIA DO FECHAR: as demandas que o clique rola, antes do clique.
    // E a mesma lista que o Worker vai rolar (`mes-fechar`): estao no mes
    // agora e seguem abertas.
    var conf = rolam.length
      ? '<div class="gx-tw"><table class="tbl"><tbody>' + rolam.slice(0, 10).map(function (m) {
          var rol = g.mesRolos(m);
          return '<tr><td style="color:var(--tx)"><span class="row" style="gap:8px">' + g.codLink(m) + '<span class="ell" style="max-width:240px" title="' + esc(m.titulo || '') + '">' + esc(m.titulo || '') + '</span>' +
            (rol ? '<span class="mono" title="já rolou de mês ' + rol + 'x" style="color:var(--dg-t);font-size:11px;font-weight:700">⟳' + rol + '</span>' : '') + '</span></td>' +
            '<td style="white-space:nowrap">' + esc(m.dev || '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>' + (rolam.length > 10 ? '<span class="note">… e mais ' + (rolam.length - 10) + '.</span>' : '')
      : H.vazio('check', 'Nada a rolar', 'Nenhuma demanda deste mês ficou em aberto.');

    h += '<div class="gx-g gx-2c">' +
      '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2">Sprints do mês</h2><span class="note">entregues / no mês · pontos</span></div>' + cards +
        '<h2 class="h2" style="margin-top:6px">Comprometidas que não saíram</h2>' +
        '<div id="fc-nao">' + tabNao + '</div>' +
        '<span class="note">Destino = o mês em que a demanda está agora; ⟳ = quantas vezes já rolou de mês. O motivo de cada uma não é registrado no RoadMap.</span></section>' +
      '<div class="gx-col-f">' +
        (pode ? '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2">Ao fechar, rolam para ' + esc(g.rotuloMes(prox)) + '</h2>' +
          (rolam.length ? H.chip(String(rolam.length), 'wn') : '') + '</div>' + conf + '</section>' : '') +
        '<section class="pn"><h2 class="h2">Entregas por semana</h2>' + g.colunas(cols, 130) +
          '<div class="gx-leg">' + g.leg('var(--ac)', 'comprometidas') + g.leg('var(--tl)', 'entraram depois') + '</div>' +
          (antes ? '<span class="note">' + antes + (antes === 1 ? ' entregue foi concluída' : ' entregues foram concluídas') + ' antes do mês.</span>' : '') + '</section>' +
        '<section class="pn"><h2 class="h2">Por desenvolvedor</h2>' +
          fc.devs.map(function (d) {
            return '<div class="row">' + H.av(d.nome) + '<span class="ell" style="flex:1;font-size:13px">' + esc(d.nome) + '</span>' +
              '<span class="mono" style="font-size:12px;color:var(--tx3)" title="entregues / comprometidas + entraram depois">' + d.entregue + ' / ' + (d.comp + d.meio) + '</span>' + g.chipPct(d.pct) + '</div>';
          }).join('') + '<span class="note">Sem comprometida no dia 1 não há percentual. Demanda de dupla conta para os dois.</span></section>' +
        g.cobertura(g.gerencialDoMes(D, alvo).concluidos) +
        '<div class="lock">' + H.ico('lock') + '<span><b>Fechar o mês</b> rola para o mês seguinte o que ficou em aberto — o mês de origem continua registrado em cada demanda. ' +
          '<b>Congelar</b> grava a apuração do deck, que para de mudar; só vale para mês que já terminou.</span></div>' +
      '</div></div>';
    return h;
  }

  // ═══ Apresentacao (`apresAbrir` + `apresGerar`) ═════════════════════════
  /* AS ESCOLHAS DE QUEM GERA vivem aqui, e nao na apuracao: quais slides
     entram, quais entregas ganham slide proprio e a frase de fecho. Trocar de
     mes refaz os destaques (a lista e do mes); os slides ficam. */
  var _ap = { alvo: '', secoes: null, dest: null, msg: '' };
  function escolhas(D, alvo) {
    if (!_ap.secoes) _ap.secoes = secoesPreset('padrao');
    if (_ap.alvo !== alvo || !_ap.dest) {
      _ap.alvo = alvo;
      _ap.dest = {};
      candidatasDestaque(D, alvo).forEach(function (m) { if (m.destaque) _ap.dest[m.id] = true; });
    }
    return _ap;
  }

  function apresentacao(ctx) {
    var g = G(), D = ctx.D, alvo = g.alvoDe(ctx.param), L = g.limites(alvo), hj = H.hoje();
    var pode = H.pode('fechar');
    var ap = escolhas(D, alvo);
    var h = g.cabecalho('Apresentação executiva',
      'Os slides com os números do mês — da apuração congelada, quando o mês está congelado. Você escolhe o que entra e quais entregas ganham slide próprio.',
      g.seletorMes('fechamento/apresentacao', alvo) + (pode ? '<button type="button" class="btnp" data-fc-gerar="' + alvo + '">' + H.ico('present') + ' Gerar apresentação</button>' : ''),
      '<span class="note"><a href="#fechamento/mes/' + alvo + '">Fechamento do mês</a> › Apresentação</span>');

    var nSel = AP_SECOES.reduce(function (t, s) { return t + (ap.secoes[s.k] ? s.n : 0); }, 0);
    var cand = candidatasDestaque(D, alvo);
    var nDest = cand.filter(function (m) { return ap.dest[m.id]; }).length;
    var esq = '<div class="gx-col-f">' +
      '<section class="pn"><span class="lab">FORMATO</span><div class="gx-g" style="grid-template-columns:1fr 1fr;gap:8px">' +
        '<div style="padding:12px;border-radius:12px;background:rgba(var(--ac-rgb),.1);border:1px solid rgba(var(--ac-rgb),.4);display:flex;flex-direction:column;gap:3px"><b style="font-size:13px">Fechamento do mês</b><span class="note" style="font-size:11.5px">o mês inteiro, em atos</span></div>' +
        '<a href="#relatorios/salvos/deck-assunto" style="padding:12px;border-radius:12px;background:var(--sf2);border:1px solid var(--bd2);display:flex;flex-direction:column;gap:3px;text-decoration:none;color:inherit"><b style="font-size:13px">Um assunto</b><span class="note" style="font-size:11.5px">um sistema, ou o consolidado — em Relatórios</span></a></div>' +
        '<span class="note">Mês</span><span class="in" style="justify-content:space-between;gap:8px"><span>' + esc(g.rotuloMes(alvo)) + '</span></span>' +
        '<div class="row" style="flex-wrap:wrap;gap:8px" data-cong="' + alvo + '" data-modo="curto">' + estadoCongelado(alvo, 'curto') + '</div></section>' +
      '<section class="pn" style="gap:8px"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:6px"><span class="lab">SLIDES</span><span class="row" style="gap:6px">' +
        '<span class="note" id="fc-nsel">' + nSel + ' slides</span>' +
        '<button type="button" class="btns" data-ap-preset="padrao" title="O deck da reunião de resultados">Padrão</button><button type="button" class="btns" data-ap-preset="tudo">Tudo</button></span></div>' +
        AP_SECOES.map(function (s) {
          return '<label class="gx-sl fc-ck"' + (s.nota ? ' title="' + esc(s.nota) + '"' : '') + '><input type="checkbox" data-ap-sec="' + s.k + '"' + (ap.secoes[s.k] ? ' checked' : '') + (pode ? '' : ' disabled') + '>' +
            '<span style="flex:1">' + esc(s.rot) + '</span><span class="mono" style="font-size:11px;color:var(--tx4)">' + s.n + '</span></label>';
        }).join('') +
        '<span class="note">Além da grade, sempre entram: a capa, um slide por destaque marcado ao lado e o slide final com a sua frase.</span></section></div>';

    // A previa e o primeiro ato do deck ("O mes: backlog, o que entrou e o que
    // saiu"), com a conta da fila de `fila.js` — a mesma que o slide usa. O
    // corte e hoje enquanto o mes corre.
    var futuro = L.de > hj, corte = L.ate > hj ? hj : L.ate;
    var fl = futuro ? null : raiz.FILA.fluxo(G().todas(D), L.de, corte, L.ate);
    var num = function (v, cor, rot) {
      return '<span style="display:flex;flex-direction:column"><b style="font-family:var(--font-title);font-size:34px;line-height:40px' + (cor ? ';color:' + cor : '') + '">' + v + '</b><span class="note">' + rot + '</span></span>';
    };
    var slide = fl
      ? '<div class="fc-slide"><div class="row" style="justify-content:space-between"><span class="labo">' + esc(g.rotuloMes(alvo).toUpperCase()) + ' · TECNOLOGIA</span>' +
          '<span class="sb-mark" style="width:34px;height:34px;border-radius:10px"><img src="axis/marca/axis-leao-branco.png" alt="" style="width:22px;height:auto"></span></div>' +
          '<b style="font-family:var(--font-title);font-size:28px;line-height:34px;letter-spacing:-.02em">Entraram ' + fl.recebidas + '. Saíram ' + fl.saidas + '.</b>' +
          '<div class="gx-g gx-k4" style="gap:14px">' + num(fl.backlogInicio, '', 'na fila no dia 1') + num(fl.recebidas, 'var(--wn-t)', 'entraram') +
            num(fl.saidas, 'var(--ok-t)', 'saíram · ' + fl.saiuEntregue + ' entregues') + num(fl.backlogFim, 'var(--ac-t)', 'em aberto ' + (corte < L.ate ? 'hoje' : 'no fim')) + '</div>' +
          '<div class="bar" style="height:12px;margin-top:auto"><span style="width:' + (fl.backlogInicio + fl.recebidas ? Math.round(fl.saidas / (fl.backlogInicio + fl.recebidas) * 100) : 0) +
            '%;background:linear-gradient(90deg,var(--ac),var(--ac-t))"></span></div></div>'
      : H.vazio('calendar', 'O mês ainda não começou');

    var dir = '<div class="gx-col-f">' +
      '<section class="pn"><div class="row" style="justify-content:space-between"><span class="lab">DESTAQUES</span><span class="note" id="fc-ndest">' + nDest + (nDest === 1 ? ' marcado' : ' marcados') + '</span></div>' +
        '<span class="note">As entregas do mês, as marcadas com estrela primeiro. Cada uma marcada vira um slide próprio: a que destravou a operação vale mais slide que a maior em pontos.</span>' +
        (cand.length ? '<div class="fc-dest">' + cand.map(function (m) {
          return '<label class="row fc-ck" style="gap:10px;padding:8px 10px;border-radius:10px;background:var(--sf2)"><input type="checkbox" data-ap-dest="' + esc(m.id) + '"' + (ap.dest[m.id] ? ' checked' : '') + (pode ? '' : ' disabled') + '>' +
            (m.destaque ? H.ico('star', 'style="color:var(--wn-t)" title="marcada no card"') : '') + '<span class="code">' + esc(m.codigo || '') + '</span>' +
            '<span class="ell" style="flex:1;font-size:13px">' + esc(m.titulo || '') + '</span>' +
            '<span class="note mono" style="white-space:nowrap">' + (m.poker_pontos ? esc(String(m.poker_pontos)) + ' pt · ' : '') + 'encerrada ' + esc(formatDate(m.concluido_em) || '—') + '</span></label>';
        }).join('') + '</div>' : H.vazio('star', 'Nenhuma demanda concluída neste mês')) + '</section>' +
      '<section class="pn"><span class="lab">A FRASE QUE FECHA</span>' +
        '<textarea class="in" data-ap-msg="1" rows="2" style="height:auto;padding:10px 12px;resize:vertical"' + (pode ? '' : ' disabled') +
          ' placeholder="Ex.: entregamos o dobro do mês passado e reduzimos o retrabalho de cadastro pela metade.">' + esc(ap.msg) + '</textarea>' +
        '<span class="note">Opcional, vai no último slide. Não fica guardada: é desta geração.</span></section>' +
      '<section class="pn"><div class="row" style="justify-content:space-between"><span class="lab">PRÉVIA</span><span class="note">o primeiro ato do padrão · números de hoje</span></div>' + slide +
        '<span class="note">O arquivo sai como roadmap-' + alvo + '.pptx, com o mesmo gerador do admin (apresentacao.js).</span></section></div>';
    return h + '<div class="gx-g gx-as3">' + esq + dir + '</div>';
  }

  var _gerando = false;
  async function gerarDeck(alvo, botao) {
    if (_gerando) return;
    if (!raiz.apresentacaoMontaDeck) { H.toast('O gerador do deck não carregou. Recarregue a página (Ctrl+F5).', 'erro'); return; }
    _gerando = true;
    var rot = botao ? botao.innerHTML : '';
    if (botao) { botao.disabled = true; botao.textContent = 'Atualizando…'; }
    try {
      var D0 = raiz.AXIS_APP.APP.D;
      var ap = escolhas(D0, alvo);
      // A ordem dos destaques e a da lista, como as caixas marcadas no admin.
      var ids = candidatasDestaque(D0, alvo).filter(function (m) { return ap.dest[m.id]; }).map(function (m) { return m.id; });
      var S = await baseFresca();
      if (botao) botao.textContent = 'Montando…';
      var ano = +alvo.slice(0, 4), mes = +alvo.slice(5, 7);
      var apu = apuracao(S, { ano: ano, mes: mes, secoes: ap.secoes, idsDestaque: ids, mensagem: ap.msg });
      var cong = await apuracaoCongelada(alvo);
      var dados = comCongelada(apu, cong);
      if (cong) H.toast('Deck gerado da apuração congelada em ' + formatDate(String(cong.congelado_em).slice(0, 10)) + '.');
      var pptx = await raiz.apresentacaoMontaDeck(dados);
      var nome = nomeArquivoDeck(ano, mes);
      await pptx.writeFile({ fileName: nome });
      H.toast(nome + ' gerado.');
    } catch (e) {
      H.toast('Não consegui gerar: ' + ((e && e.message) || e), 'erro');
    } finally {
      _gerando = false;
      if (botao && botao.isConnected) { botao.disabled = false; botao.innerHTML = rot; }
    }
  }

  function css() {
    if (typeof document === 'undefined' || document.getElementById('css-tela-fechamento')) return;
    var s = document.createElement('style');
    s.id = 'css-tela-fechamento';
    s.textContent = '.axa .fc-slide{aspect-ratio:16/9;border-radius:14px;overflow:hidden;box-sizing:border-box;padding:28px 34px;display:flex;flex-direction:column;gap:18px;' +
      'border:1px solid var(--bd2);background:radial-gradient(600px 300px at 85% 0%,rgba(var(--ac-rgb),.18),rgba(var(--ac-rgb),0) 70%),linear-gradient(160deg,var(--bg-top) 0%,var(--bg0) 100%)}' +
      '.axa .fc-ck{cursor:pointer}.axa .fc-ck input{accent-color:var(--ac);width:16px;height:16px;flex-shrink:0;margin:0}' +
      '.axa .fc-dest{display:flex;flex-direction:column;gap:6px;max-height:420px;overflow:auto}' +
      '@container app (max-width: 760px){.axa .fc-slide{aspect-ratio:auto;padding:18px}}';
    document.head.appendChild(s);
  }

  function abasDe(r) {
    var p = String(r.param || '').split('/')[0];
    var m = /^\d{4}-\d{2}$/.test(p) ? '/' + p : '';
    return [{ id: 'mes', rotulo: 'Fechamento', href: '#fechamento/mes' + m }, { id: 'apresentacao', rotulo: 'Apresentação', href: '#fechamento/apresentacao' + m }];
  }
  raiz.AXIS_APP.tela({
    id: 'fechamento', rotulo: 'Fechamento do mês', papeis: ['admin'],
    abas: [{ id: 'mes', rotulo: 'Fechamento' }, { id: 'apresentacao', rotulo: 'Apresentação' }],
    abasDe: abasDe,
    titulo: function (r) { return r.aba === 'apresentacao' ? 'Apresentação executiva' : 'Fechamento do mês'; },
    render: function (el, ctx) {
      if (!G()) return H.vazio('alert', 'As contas do gerencial não carregaram', 'axis-tela-paineis.js precisa vir antes deste arquivo.');
      G().css(); css();
      return ctx.aba === 'apresentacao' ? apresentacao(ctx) : fechamento(ctx);
    },
    depois: function (el, ctx) {
      if (!G()) return;
      G().ligaSeletorMes(el);
      lerCongelados();
      var conta = function () {
        var n = AP_SECOES.reduce(function (t, s) { return t + (_ap.secoes[s.k] ? s.n : 0); }, 0);
        var a = el.querySelector('#fc-nsel'); if (a) a.textContent = n + ' slides';
        var nd = Object.keys(_ap.dest || {}).filter(function (k) { return _ap.dest[k]; }).length;
        var b = el.querySelector('#fc-ndest'); if (b) b.textContent = nd + (nd === 1 ? ' marcado' : ' marcados');
      };
      el.addEventListener('change', function (e) {
        var s = e.target.closest('[data-ap-sec]');
        if (s) { _ap.secoes[s.getAttribute('data-ap-sec')] = s.checked; conta(); return; }
        var d = e.target.closest('[data-ap-dest]');
        if (d) { _ap.dest[d.getAttribute('data-ap-dest')] = d.checked; conta(); }
      });
      el.addEventListener('input', function (e) {
        var t = e.target.closest('[data-ap-msg]');
        if (t) _ap.msg = t.value;
      });
      el.addEventListener('click', function (e) {
        var pr = e.target.closest('[data-ap-preset]');
        if (pr) {
          _ap.secoes = secoesPreset(pr.getAttribute('data-ap-preset'));
          Array.prototype.forEach.call(el.querySelectorAll('[data-ap-sec]'), function (c) { c.checked = !!_ap.secoes[c.getAttribute('data-ap-sec')]; });
          conta();
          return;
        }
        var gb = e.target.closest('[data-fc-gerar]');
        if (gb) { gerarDeck(gb.getAttribute('data-fc-gerar'), gb); return; }
        var fb = e.target.closest('[data-fc-fechar]');
        if (fb) { fecharMes(fb.getAttribute('data-fc-fechar'), fb); return; }
        var cb = e.target.closest('[data-fc-congelar]');
        if (cb) { alternarCongelado(cb.getAttribute('data-fc-congelar'), cb); return; }
        var p = e.target.closest('[data-pag-nao]');
        if (p && !p.disabled) {
          _pagNao = +p.getAttribute('data-pag-nao');
          var tmp = document.createElement('div');
          tmp.innerHTML = fechamento(ctx);
          var novo = tmp.querySelector('#fc-nao'), box = el.querySelector('#fc-nao');
          if (novo && box) box.innerHTML = novo.innerHTML;
        }
      });
    }
  });
})();
