/* ─────────────────────────────────────────────────────────────────────────
   AXIS — tela Backlog (#backlog), prancha `Backlog.dc.html` do EP-013.

   QUATRO ABAS, a mesma base:
     lista      todos os itens, agrupados (projeto, sistema, sprint ou nada)
     validacao  entregas esperando o PM/PO (so admin, que e quem valida)
     vencido    o que esta com prazo vencido, da mais antiga para a mais nova
     importar   a porta para o importador de sempre (importar.html)

   NENHUMA CONTA MORA AQUI. Etapa e `ETAPA` (pelo H.colunaDe/H.etapaDe), prazo e
   atraso sao `PRAZO`, progresso de projeto e `RESUMOPROJETO`, roll-up do
   sistema e `catalogoCasa`, busca por codigo e `BUSCA_DEMANDA`, sprint e
   `SPRINTPO`, remarcacao de prazo e `CAPACIDADE.rolagemDeSprint`, area e
   `HOMOLOGACAO`. A tela so escolhe o que mostrar e em que ordem.

   GRAVAR CONTINUA NAS TELAS ANTIGAS: Validar, Devolver, Replanejar, Novo item
   e Importar levam ao editor de sempre, com a sessao compartilhada.

   "Ready 5/5", epico (EPI-) e o detalhe de criterios marcados da prancha nao
   existem no RoadMap; no lugar do Ready vai a coluna Sprint (a do PO).
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var AX = typeof window !== 'undefined' ? window.AXIS_APP : null;
  if (!AX) return;
  var H = AX.H;
  var W = window;

  // ── Estado de cada aba ────────────────────────────────────────────────
  // Fica no modulo, e nao na URL: trocar de aba e voltar mantem o recorte que
  // a pessoa montou. A URL guarda so o que se compartilha (a aba e o item).
  var F = { chip: 'todos', q: '', agrupar: 'projeto', tipo: '', tema: '', dev: '', mais: {} };
  var V = { ordem: 'antigas' };
  var A = { recorte: 'todas', dev: '', mais: 0 };
  var POR_GRUPO = 25;      // linhas por grupo antes do "mostrar mais"
  var POR_PAGINA = 50;     // linhas da tabela de vencidas antes do "mostrar mais"

  var FECHADAS = ['concluido', 'negada'];
  var SEM_DEV = '__sem_dev__';
  var MINHAS = '__minhas__';
  var SEM_TIPO = '__sem_tipo__';

  // ── CSS proprio da tela (uma vez) ─────────────────────────────────────
  function css() {
    if (document.getElementById('css-tela-backlog')) return;
    var s = document.createElement('style');
    s.id = 'css-tela-backlog';
    s.textContent = [
      '.axa .bk-chip{height:32px;padding:0 12px;border-radius:9px;cursor:pointer;font:inherit;font-size:12.5px;font-weight:600;background:transparent;color:var(--tx2);border:1px solid var(--bd2);display:inline-flex;align-items:center;gap:6px;white-space:nowrap}',
      '.axa .bk-chip .n{font-family:var(--font-mono);opacity:.8}',
      '.axa .bk-chip:hover{border-color:var(--bd4);color:var(--tx)}',
      '.axa .bk-chip.on{background:var(--sf4);color:var(--tx);border-color:rgba(var(--ac-rgb),.4)}',
      '.axa .bk-chip.dg{color:var(--dg-t)}',
      '.axa .bk-fil{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
      '.axa .bk-fil .in{height:38px;border-radius:10px;background:var(--sf);font-size:12.5px}',
      '.axa .bk-fil input.in{flex:1 1 280px;min-width:0;font-size:13px}',
      '.axa .bk-fil select.in{max-width:260px}',
      '.axa .bk-tab{min-width:980px;display:flex;flex-direction:column;gap:14px}',
      '.axa .bk-cols,.axa .bk-ln{display:grid;grid-template-columns:84px minmax(0,1fr) 104px 168px 62px 58px 60px 104px;gap:12px;align-items:center}',
      '.axa .bk-cols{padding:0 16px;font-size:11px;font-weight:700;letter-spacing:.1em;color:var(--tx3)}',
      '.axa .bk-grp{border-radius:16px;background:rgba(var(--sf-rgb),.6);border:1px solid var(--bd);overflow:hidden}',
      '.axa .bk-gh{display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--sf2);border-bottom:1px solid var(--bd);min-width:0}',
      '.axa .bk-gh .gc{font-family:var(--font-mono);font-size:12px;color:var(--ac-t);white-space:nowrap}',
      '.axa .bk-gh b{font-size:14px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.axa .bk-gh .gm{font-size:12px;color:var(--tx3);white-space:nowrap}',
      '.axa .bk-gb{margin-left:auto;width:140px;height:6px;border-radius:3px;background:var(--track);overflow:hidden;flex-shrink:0}',
      '.axa .bk-gb>i{display:block;height:6px;background:linear-gradient(90deg,var(--ac),var(--ac-t))}',
      '.axa .bk-gp{font-family:var(--font-mono);font-size:11.5px;color:var(--tx3);width:36px;text-align:right}',
      '.axa .bk-ln{padding:11px 16px;border-bottom:1px solid var(--bd3);text-decoration:none;color:var(--tx)}',
      '.axa .bk-ln:last-child{border-bottom:0}',
      '.axa .bk-ln:hover{background:rgba(var(--ac-rgb),.05);color:var(--tx)}',
      '.axa .bk-ln.minha{box-shadow:inset 3px 0 0 var(--ac)}',
      '.axa .bk-ln .ci{font-family:var(--font-mono);font-size:12px;color:var(--tx3)}',
      '.axa .bk-ln .tt{font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.axa .bk-ln .cm{font-size:11.5px;color:var(--tx3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.axa .bk-ln .mo{font-family:var(--font-mono);font-size:12px;color:var(--tx2)}',
      '.axa .bk-ln .et{display:flex;flex-wrap:wrap;gap:4px}',
      '.axa .bk-ln .pz{font-size:12px;text-align:right;font-weight:600}',
      '.axa .bk-ln .av{width:26px;height:26px;border-radius:13px;font-size:10px}',
      '.axa .bk-mais{display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 16px;font-size:12.5px;color:var(--tx3)}',
      '.axa .bk-vl{padding:11px 13px;border-radius:12px;display:flex;flex-direction:column;gap:4px;background:var(--sf2);border:1px solid var(--bd);text-decoration:none;color:var(--tx)}',
      '.axa .bk-vl:hover{border-color:var(--bd4);color:var(--tx)}',
      '.axa .bk-vl.on{background:rgba(var(--ac-rgb),.1);border-color:rgba(var(--ac-rgb),.5)}',
      '.axa .bk-vl .t{font-size:13px;font-weight:700;line-height:18px}',
      '.axa .bk-txt{padding:14px;border-radius:12px;background:var(--sf3);border:1px solid var(--bd2);font-size:13px;line-height:20px;color:var(--tx2);white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto}',
      '.axa .bk-txt.vz{color:var(--tx4);font-style:italic}',
      '.axa .bk-faixa{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px;border-radius:12px;background:rgba(var(--dg-rgb),.08);border:1px solid rgba(var(--dg-rgb),.35);font-size:13px;color:var(--dg-t)}',
      '.axa .bk-faixa b{color:var(--tx)}',
      '.axa .bk-passos{display:flex;border-radius:12px;overflow:hidden;border:1px solid var(--bd2)}',
      '.axa .bk-passos span{flex:1;padding:12px;font-size:12.5px;font-weight:700;text-align:center;background:var(--sf3);color:var(--tx2);border-right:1px solid var(--bd2)}',
      '.axa .bk-passos span:last-child{border-right:0}',
      '.axa .bk-passos small{display:block;font-weight:500;color:var(--tx3);font-size:11.5px;margin-top:2px}',
      '@container app (max-width: 760px){.axa .bk-passos{flex-direction:column}.axa .bk-passos span{border-right:0;border-bottom:1px solid var(--bd2)}.axa .bk-fil select.in{max-width:none;flex:1 1 150px}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── Leituras ──────────────────────────────────────────────────────────
  function hoje() { return H.hoje(); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function aberta(m) { return FECHADAS.indexOf(H.colunaDe(m)) < 0; }
  function atrasada(m) { return H.etapaDe(m) === 'atrasado'; }
  function pausadaAberta(m) { return H.pausada(m) && aberta(m); }
  function temas(D) { return (D && D.temas) || []; }
  function link(href, rotulo, titulo, cls) {
    return '<a class="' + (cls || 'btn') + '" href="' + href + '" title="' + H.esc(titulo) + '">' + rotulo + ' ' +
      H.ico('external', 'style="font-size:12px;opacity:.7"') + '</a>';
  }

  /* As etapas dos chips. "Validacao" junta a da area e a do PM/PO: as duas sao
     "o dev entregou e alguem confere". Atrasados e Pausados sao RECORTES, e
     nao etapas — a mesma decisao do admin ("atraso nao e etapa, e condicao"). */
  var CHIPS = [
    { id: 'todos',     rotulo: 'Todos',               casa: function () { return true; } },
    { id: 'backlog',   rotulo: 'Backlog',             casa: function (m) { return H.colunaDe(m) === 'backlog'; } },
    { id: 'levantar',  rotulo: 'Levantar Requisitos', casa: function (m) { return H.colunaDe(m) === 'levantar_req'; } },
    { id: 'planning',  rotulo: 'Planning',            casa: function (m) { return H.colunaDe(m) === 'planning'; } },
    { id: 'planejado', rotulo: 'Planejado',           casa: function (m) { return H.colunaDe(m) === 'planejado'; } },
    { id: 'andamento', rotulo: 'Em andamento',        casa: function (m) { return H.colunaDe(m) === 'em_andamento'; } },
    { id: 'validacao', rotulo: 'Validação',           casa: function (m) { var c = H.colunaDe(m); return c === 'validacao' || c === 'validacao_area'; } },
    { id: 'concluido', rotulo: 'Concluído',           casa: function (m) { return H.colunaDe(m) === 'concluido'; } },
    { id: 'negada',    rotulo: 'Negadas',             casa: function (m) { return H.colunaDe(m) === 'negada'; } },
    { id: 'atrasado',  rotulo: 'Atrasados',           casa: atrasada, cls: 'dg' },
    { id: 'pausado',   rotulo: 'Pausados',            casa: pausadaAberta }
  ];
  var CHIP_POR_ID = {};
  CHIPS.forEach(function (c) { CHIP_POR_ID[c.id] = c; });

  /** A busca: texto no titulo, dev, solicitante e codigo (com e sem hifen) —
   *  a mesma lista do `matchBusca` do admin — e, por cima, o codigo pela regra
   *  do `BUSCA_DEMANDA` ("179", "#179" e o numero da issue do GitHub). */
  function filtroBusca(vs, termo) {
    var t = norm(String(termo || '').trim());
    if (!t) return null;
    var achou = W.BUSCA_DEMANDA ? W.BUSCA_DEMANDA.acha(vs, String(termo).trim()) : null;
    var por = achou ? achou.demanda : null;
    return function (m) {
      if (m === por) return true;
      var cod = String(m.codigo || '');
      return norm([m.titulo, m.dev, m.solicitante, cod, cod.replace(/-/g, '')].join(' ')).indexOf(t) >= 0;
    };
  }

  function casaDev(m, f) {
    if (!f) return true;
    if (f === MINHAS) return H.minha(m);
    var ds = H.devsDe(m);
    if (f === SEM_DEV) return !ds.length;
    return W.DEVNOME ? W.DEVNOME.eDe(m, f) : ds.indexOf(f) >= 0;
  }
  function casaTipo(m, f) {
    if (!f) return true;
    if (f === SEM_TIPO) return !m.tipo;
    return m.tipo === f;
  }
  function casaTema(m, f, D) {
    if (!f) return true;
    return W.catalogoCasa ? W.catalogoCasa(m.tema_id, f, temas(D)) : String(m.tema_id) === String(f);
  }

  /** Tudo menos o chip: e sobre esta lista que os chips contam, para o numero
   *  do chip ser o numero que aparece ao clicar nele. */
  function baseFiltrada(D) {
    var vs = H.visiveis();
    var b = filtroBusca(vs, F.q);
    return vs.filter(function (m) {
      return (!b || b(m)) && casaDev(m, F.dev) && casaTipo(m, F.tipo) && casaTema(m, F.tema, D);
    });
  }

  /* CONCLUIDA E NEGADA FICAM OCULTAS POR PADRAO, salvo quando a pessoa pede:
     o chip delas, ou uma busca. E a regra do `renderMelhorias` do admin
     (HIDDEN_BY_DEFAULT) — buscar um codigo e nao achar porque ele ja foi
     entregue derrota o proposito da busca. */
  function listaDoChip(base) {
    var c = CHIP_POR_ID[F.chip] || CHIPS[0];
    var mostraFechadas = F.chip === 'concluido' || F.chip === 'negada' || !!String(F.q).trim();
    return base.filter(function (m) { return c.casa(m) && (mostraFechadas || aberta(m)); });
  }

  // ── Celulas da linha ──────────────────────────────────────────────────
  /** A etapa GRAVADA (a coluna em que o card mora), e nao a efetiva: atraso
   *  aparece no prazo, em vermelho, como na prancha. */
  function chipColuna(m) {
    var c = H.colunaDe(m);
    var e = H.ETAPA_POR_ID[c] || { rotulo: c || '—', cor: 'bk' };
    var h = H.chip(H.esc(e.rotulo), e.cor);
    if (pausadaAberta(m)) h += H.chip(H.ico('pause') + ' Pausada', 'mg');
    return h;
  }

  /** O prazo. Aberta: o `prazoTxt` do nucleo (vence hoje, atrasada Nd...).
   *  Entregue: o dia em que o dev entregou (`PRAZO.fimDoDev`) — repetir
   *  "atrasada" numa demanda que ja saiu da mesa do dev seria cobrar o que ja
   *  foi feito, o defeito que o `prazo.js` registra em `estaAtrasada`. */
  function prazoCel(m) {
    var c = H.colunaDe(m);
    if (c === 'negada') return { txt: '—', cor: 'var(--tx4)' };
    if (c === 'concluido' || c === 'validacao' || c === 'validacao_area') {
      var fim = W.PRAZO ? W.PRAZO.fimDoDev(m) : '';
      // Na area sem carimbo de entrega, o prazo do dev ainda e o que se le.
      if (!fim) return c === 'validacao_area' ? H.prazoTxt(m) : { txt: '—', cor: 'var(--tx4)' };
      var a = H.atrasoDe(m);
      return { txt: 'entregue ' + H.dm(fim), cor: a > 0 ? 'var(--wn-t)' : 'var(--tx3)',
               titulo: a > 0 ? 'Entregue ' + H.plural(a, 'dia', 'dias') + ' depois do prazo' : 'Entregue no prazo' };
    }
    return H.prazoTxt(m);
  }

  function sprintDe(m) { return W.SPRINTPO ? W.SPRINTPO.doPO(m) : String(m.sprint_po || ''); }
  function sprintCel(m) {
    var s = sprintDe(m);
    if (!s) return '<span class="mo" style="color:var(--tx4)">—</span>';
    var curto = W.SPRINTPO ? W.SPRINTPO.rotuloCurto(s) : s;
    var agora = s === H.sprintAtual();
    return '<span class="mo" title="Sprint ' + H.esc(s) + (agora ? ' (em curso)' : '') + '" style="color:' + (agora ? 'var(--ac-t)' : 'var(--tx2)') + '">' + H.esc(curto) + '</span>';
  }

  function pontosCel(m) {
    var p = m.poker_pontos;
    var n = Number(p);
    return (p === '' || p == null || !isFinite(n)) ? '<span class="mo" style="color:var(--tx4)">—</span>' : '<span class="mo">' + H.esc(String(n)) + '</span>';
  }

  function devCel(m) {
    var ds = H.devsDe(m);
    if (!ds.length) return H.av('', 26);
    return '<span class="row" style="gap:0" title="' + H.esc(ds.join(' / ')) + '">' + H.av(ds[0], 26) +
      (ds.length > 1 ? '<span style="font-size:11px;color:var(--tx3);margin-left:4px">+' + (ds.length - 1) + '</span>' : '') + '</span>';
  }

  function tipoCel(m) {
    var t = H.TIPOS[m.tipo];
    return t ? '<span style="font-size:12px;color:var(--tx2)">' + H.esc(t.rotulo) + '</span>' : '<span style="font-size:12px;color:var(--tx4)">—</span>';
  }

  function linha(m, eDev) {
    var pz = prazoCel(m);
    var cam = H.caminho(m.tema_id);
    return '<a class="bk-ln' + (eDev && H.minha(m) ? ' minha' : '') + '" href="' + H.hrefItem(m) + '">' +
      '<span class="ci">' + H.esc(m.codigo || '—') + '</span>' +
      '<span style="display:flex;flex-direction:column;min-width:0"><span class="tt">' + H.esc(m.titulo || '(sem título)') + '</span>' +
      '<span class="cm">' + (cam ? H.esc(cam) : 'Sem sistema') + '</span></span>' +
      tipoCel(m) +
      '<span class="et">' + chipColuna(m) + '</span>' +
      sprintCel(m) + pontosCel(m) + devCel(m) +
      '<span class="pz" style="color:' + pz.cor + '"' + (pz.titulo ? ' title="' + H.esc(pz.titulo) + '"' : '') + '>' + H.esc(pz.txt) + '</span></a>';
  }

  /* A ORDEM DENTRO DO GRUPO: aberta antes de fechada; entre as abertas, a de
     prazo mais proximo primeiro (vencidas no topo) e sem prazo por ultimo — a
     ordem do `renderMelhorias` do admin, que ordena por vencimento. */
  function ordena(lista) {
    return lista.slice().sort(function (a, b) {
      var fa = aberta(a) ? 0 : 1, fb = aberta(b) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      var pa = H.prazoDe(a) || '9999', pb = H.prazoDe(b) || '9999';
      if (fa === 1) { pa = W.PRAZO ? W.PRAZO.fimDoDev(a) || '' : ''; pb = W.PRAZO ? W.PRAZO.fimDoDev(b) || '' : ''; return pb.localeCompare(pa); }
      if (pa !== pb) return pa.localeCompare(pb);
      return String(b.codigo || '').localeCompare(String(a.codigo || ''), 'pt-BR', { numeric: true });
    });
  }

  // ── Agrupamento ───────────────────────────────────────────────────────
  /** Cada grupo: { chave, codigo, nome, itens, feitas, total }. `feitas/total`
   *  e sobre o grupo INTEIRO na base, e nao so sobre o que o filtro deixou: o
   *  progresso de um projeto nao muda porque a pessoa buscou uma palavra. */
  function grupos(lista, D) {
    var vs = H.visiveis();
    var mapa = {}, ordem = [];
    function poe(chave, m) {
      if (!mapa[chave]) { mapa[chave] = []; ordem.push(chave); }
      mapa[chave].push(m);
    }
    var conta = function (fn) {
      var tot = vs.filter(fn);
      return { total: tot.length, feitas: tot.filter(function (m) { return H.colunaDe(m) === 'concluido'; }).length };
    };

    if (F.agrupar === 'nada') {
      return [{ chave: 'tudo', codigo: '', nome: '', itens: lista, sem: true }];
    }

    if (F.agrupar === 'projeto') {
      lista.forEach(function (m) { poe(m.projeto_id && H.projeto(m.projeto_id) ? String(m.projeto_id) : '', m); });
      var gs = ordem.map(function (k) {
        if (!k) {
          var c = conta(function (m) { return !m.projeto_id || !H.projeto(m.projeto_id); });
          return { chave: '', codigo: 'SEM PROJETO', nome: 'Sustentação e itens soltos', itens: mapa[k], feitas: c.feitas, total: c.total };
        }
        var p = H.projeto(k);
        // O progresso do projeto e o do resumo executivo: a mesma conta que o
        // comite ve, e nao uma segunda.
        var r = W.RESUMOPROJETO ? W.RESUMOPROJETO.montar(D, k, hoje()) : null;
        var c2 = r ? { feitas: r.feitas, total: r.total } : conta(function (m) { return String(m.projeto_id) === k; });
        return { chave: k, codigo: p.codigo || 'EP', nome: p.nome || '(projeto sem nome)', itens: mapa[k], feitas: c2.feitas, total: c2.total,
                 fechado: p.status === 'concluido' };
      });
      // Projeto em curso primeiro, pelo codigo; concluido depois; solto no fim.
      return gs.sort(function (a, b) {
        if (!a.chave !== !b.chave) return a.chave ? -1 : 1;
        if (!!a.fechado !== !!b.fechado) return a.fechado ? 1 : -1;
        return String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true });
      });
    }

    if (F.agrupar === 'sistema') {
      // A raiz do sistema e a do catalogo (`catalogoRaiz`): "AXCred - Operações"
      // junta Operações e os modulos dela, "BI - Reports" vira "BI".
      var raizDe = function (m) { var n = H.tema(m.tema_id); return n ? (W.catalogoRaiz ? W.catalogoRaiz(n) : n.split(' - ')[0]) : ''; };
      lista.forEach(function (m) { poe(raizDe(m), m); });
      var ordemTema = {};
      (W.catalogoOrdena ? W.catalogoOrdena(temas(D)) : temas(D)).forEach(function (t, i) {
        var r = W.catalogoRaiz ? W.catalogoRaiz(t.nome) : t.nome;
        if (ordemTema[r] == null) ordemTema[r] = i;
      });
      return ordem.map(function (k) {
        var c = conta(function (m) { return raizDe(m) === k; });
        return { chave: k, codigo: k ? 'SISTEMA' : 'SEM SISTEMA', nome: k ? k.split(' - ').join(' › ') : 'Itens sem sistema', itens: mapa[k], feitas: c.feitas, total: c.total };
      }).sort(function (a, b) {
        if (!a.chave !== !b.chave) return a.chave ? -1 : 1;
        var oa = ordemTema[a.chave] != null ? ordemTema[a.chave] : 1e6, ob = ordemTema[b.chave] != null ? ordemTema[b.chave] : 1e6;
        return oa - ob || String(a.chave).localeCompare(String(b.chave), 'pt-BR');
      });
    }

    // Por sprint (a do PO): a mais nova primeiro, e o que nao tem sprint no fim.
    lista.forEach(function (m) { poe(sprintDe(m), m); });
    var chaveSprint = function (s) { return s ? s.slice(6, 10) + s.slice(3, 5) + s.slice(1, 2) : ''; };
    var atual = H.sprintAtual();
    return ordem.map(function (k) {
      var c = conta(function (m) { return sprintDe(m) === k; });
      var faixa = k && W.SPRINTPO && W.SPRINTPO.faixaDaSprint ? W.SPRINTPO.faixaDaSprint(k, (D || {}).feriados || []) : null;
      return { chave: k, codigo: k ? (W.SPRINTPO ? W.SPRINTPO.rotuloCurto(k) : k) : 'SEM SPRINT',
               nome: k ? (faixa ? H.dm(faixa.de) + ' a ' + H.dm(faixa.ate) : k) + (k === atual ? ' · em curso' : '') : 'Fora de sprint',
               itens: mapa[k], feitas: c.feitas, total: c.total };
    }).sort(function (a, b) {
      if (!a.chave !== !b.chave) return a.chave ? -1 : 1;
      return chaveSprint(b.chave).localeCompare(chaveSprint(a.chave));
    });
  }

  function htmlGrupo(g, eDev) {
    var lim = F.mais[g.chave] || POR_GRUPO;
    var itens = ordena(g.itens);
    var vis = itens.slice(0, lim);
    var pct = g.total ? Math.round(g.feitas / g.total * 100) : 0;
    var h = '<section class="bk-grp">';
    if (!g.sem) {
      h += '<div class="bk-gh"><span class="gc">' + H.esc(g.codigo) + '</span><b title="' + H.esc(g.nome) + '">' + H.esc(g.nome) + '</b>' +
        '<span class="gm">' + g.feitas + ' de ' + g.total + ' concluídos' + (itens.length !== g.total ? ' · ' + H.plural(itens.length, 'na lista', 'na lista') : '') + '</span>' +
        '<span class="bk-gb" title="' + pct + '% concluído"><i style="width:' + pct + '%"></i></span><span class="bk-gp">' + pct + '%</span></div>';
    }
    h += vis.map(function (m) { return linha(m, eDev); }).join('');
    if (itens.length > vis.length) {
      var falta = itens.length - vis.length;
      h += '<div class="bk-mais">Mostrando ' + vis.length + ' de ' + itens.length +
        '<button type="button" class="btns" data-bk-mais="' + H.esc(g.chave) + '">Mostrar mais ' + Math.min(falta, POR_GRUPO) + '</button>' +
        (falta > POR_GRUPO ? '<button type="button" class="btns" data-bk-todos="' + H.esc(g.chave) + '">Mostrar todos</button>' : '') + '</div>';
    }
    return h + '</section>';
  }

  // ── Aba Backlog ───────────────────────────────────────────────────────
  function htmlChips(base) {
    return CHIPS.map(function (c) {
      var n = base.filter(c.casa).length;
      return '<button type="button" class="bk-chip' + (F.chip === c.id ? ' on' : '') + (c.cls ? ' ' + c.cls : '') + '" data-bk-chip="' + c.id + '" aria-pressed="' + (F.chip === c.id) + '">' +
        H.esc(c.rotulo) + ' <span class="n">' + H.num(n) + '</span></button>';
    }).join('');
  }

  function htmlCorpo(D, eDev) {
    var base = baseFiltrada(D);
    var lista = listaDoChip(base);
    var oculto = !(F.chip === 'concluido' || F.chip === 'negada' || String(F.q).trim());
    var nota = '<span class="note">Mostrando <b style="color:var(--tx2)">' + H.num(lista.length) + '</b> de ' + H.num(H.visiveis().length) + ' itens' +
      (oculto ? ' · concluídos e negados ficam ocultos: use o chip ou busque pelo código.' : '.') + '</span>';
    if (!lista.length) {
      return { chips: htmlChips(base), corpo: nota + '<section class="pn">' + H.vazio('search', 'Nada com estes filtros', 'Troque o chip, limpe a busca ou os filtros.',
        '<button type="button" class="btn" data-bk-limpar="1">Limpar filtros</button>') + '</section>' };
    }
    var gs = grupos(lista, D);
    return {
      chips: htmlChips(base),
      corpo: nota + '<div style="overflow-x: auto;"><div class="bk-tab">' +
        '<div class="bk-cols"><span>ITEM</span><span>TÍTULO</span><span>TIPO</span><span>ETAPA</span><span>SPRINT</span><span>PONTOS</span><span>DEV</span><span style="text-align:right">PRAZO</span></div>' +
        gs.map(function (g) { return htmlGrupo(g, eDev); }).join('') + '</div></div>'
    };
  }

  function opcoesDev(D, eDev) {
    var nomes = {};
    ((D || {}).desenvolvedores || []).forEach(function (n) { if (n) nomes[n] = 1; });
    H.visiveis().forEach(function (m) { H.devsDe(m).forEach(function (n) { nomes[n] = 1; }); });
    var lista = Object.keys(nomes).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    var op = function (v, r) { return '<option value="' + H.esc(v) + '"' + (F.dev === v ? ' selected' : '') + '>' + H.esc(r) + '</option>'; };
    return op('', 'Todos os devs') + (eDev && H.meusNomes().length ? op(MINHAS, 'Só as minhas') : '') + op(SEM_DEV, 'Sem dev') +
      lista.map(function (n) { return op(n, n); }).join('');
  }

  function renderLista(ctx) {
    var D = ctx.D, eDev = ctx.papel === 'dev';
    var sel = function (v, r, atual) { return '<option value="' + v + '"' + (atual === v ? ' selected' : '') + '>' + r + '</option>'; };
    var temasOp = W.catalogoOpcoesHTML ? W.catalogoOpcoesHTML(temas(D), F.tema, { rotuloVazio: 'Todos os sistemas' })
      : '<option value="">Todos os sistemas</option>' + temas(D).map(function (t) { return sel(H.esc(t.id), H.esc(t.nome), F.tema); }).join('');
    var c = htmlCorpo(D, eDev);
    var botoes = H.pode('editar')
      ? '<div class="row">' + link('importar.html', 'Importar', 'Abre o importador (importar.html)', 'btn') +
        link('admin.html#novo', '+ Novo item', 'Abre o formulário de demanda nova no admin', 'btnp') + '</div>'
      : '';
    return '<header style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px">' +
      '<div style="display:flex;flex-direction:column;gap:6px"><h1 class="h1">Backlog</h1>' +
      '<span class="sub">Todos os itens de trabalho, agrupados por projeto' + (eDev ? '. Os seus têm a marca laranja à esquerda.' : '.') + '</span></div>' + botoes + '</header>' +
      '<div id="bk-chips" style="display:flex;flex-wrap:wrap;gap:8px">' + c.chips + '</div>' +
      '<div class="bk-fil">' +
      '<label for="bk-q" style="position:absolute;left:-9999px">Buscar no backlog</label>' +
      '<input class="in" id="bk-q" type="search" autocomplete="off" placeholder="AX-179, título, dev, solicitante" value="' + H.esc(F.q) + '">' +
      '<select class="in" id="bk-agr" aria-label="Agrupar">' +
      sel('projeto', 'Agrupar por projeto', F.agrupar) + sel('sistema', 'Agrupar por sistema', F.agrupar) +
      sel('sprint', 'Agrupar por sprint', F.agrupar) + sel('nada', 'Sem agrupar', F.agrupar) + '</select>' +
      '<select class="in" id="bk-tipo" aria-label="Tipo">' + sel('', 'Todos os tipos', F.tipo) + sel('evolucao', 'Evolução', F.tipo) +
      sel('sustentacao', 'Sustentação', F.tipo) + sel(SEM_TIPO, 'Sem tipo', F.tipo) + '</select>' +
      '<select class="in" id="bk-tema" aria-label="Sistema">' + temasOp + '</select>' +
      '<select class="in" id="bk-dev" aria-label="Dev">' + opcoesDev(D, eDev) + '</select>' +
      '</div><div id="bk-corpo" style="display:flex;flex-direction:column;gap:12px">' + c.corpo + '</div>';
  }

  function ligarLista(el, ctx) {
    var eDev = ctx.papel === 'dev';
    var repinta = function (zeraMais) {
      if (zeraMais) F.mais = {};
      var c = htmlCorpo(ctx.D, eDev);
      el.querySelector('#bk-chips').innerHTML = c.chips;
      el.querySelector('#bk-corpo').innerHTML = c.corpo;
    };
    var t = null;
    var q = el.querySelector('#bk-q');
    q.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () { F.q = q.value; repinta(true); }, 140);
    });
    [['#bk-agr', 'agrupar'], ['#bk-tipo', 'tipo'], ['#bk-tema', 'tema'], ['#bk-dev', 'dev']].forEach(function (p) {
      var s = el.querySelector(p[0]);
      if (s) s.addEventListener('change', function () { F[p[1]] = s.value; repinta(true); });
    });
    el.addEventListener('click', function (e) {
      var ch = e.target.closest('[data-bk-chip]');
      if (ch) { F.chip = ch.getAttribute('data-bk-chip'); repinta(true); return; }
      var mais = e.target.closest('[data-bk-mais]');
      if (mais) { var k = mais.getAttribute('data-bk-mais'); F.mais[k] = (F.mais[k] || POR_GRUPO) + POR_GRUPO; repinta(false); return; }
      var todos = e.target.closest('[data-bk-todos]');
      if (todos) { F.mais[todos.getAttribute('data-bk-todos')] = 1e9; repinta(false); return; }
      if (e.target.closest('[data-bk-limpar]')) {
        F.chip = 'todos'; F.q = ''; F.tipo = ''; F.tema = ''; F.dev = '';
        AX.desenhar();
      }
    });
  }

  // ── Aba Validacao do PO ───────────────────────────────────────────────
  /** A ultima entrada da demanda numa etapa, pelo historico: quem moveu e
   *  quando. E o "quem entregou" — o historico grava quem mexeu na etapa. */
  function entradaEm(m, etapa) {
    var achou = null;
    (Array.isArray(m.historico) ? m.historico : []).forEach(function (e) {
      (e && e.mudancas || []).forEach(function (c) {
        if (c && c.campo === 'status_planejamento' && c.para === etapa && (!achou || String(e.em || '') >= String(achou.em || ''))) achou = e;
      });
    });
    return achou;
  }

  /** As entregas a validar. PM/PO: `validacao`, desde `entregue_em` (o carimbo
   *  do servidor; o historico so na falta dele). Area: so as que a
   *  `HOMOLOGACAO.cobraHomologacao` diz que passaram dos cinco dias sem registro
   *  — antes disso a vez e da area, e nao do PO. */
  /* QUEM ENTREGOU: quem moveu a etapa pelo painel do dev (`origem: 'dev'`).
     Se quem moveu foi o admin, o nome no historico e o do PO — e dizer
     "entregue pelo PO" estaria errado; ai vale o dev da demanda. */
  function quemEntregou(m, e) {
    if (e && e.origem === 'dev' && e.quem) return e.quem;
    return m.dev || (e && e.quem) || '';
  }

  function entregas() {
    var h = hoje();
    var out = [];
    H.visiveis().forEach(function (m) {
      var c = H.colunaDe(m);
      if (c === 'validacao') {
        var e = entradaEm(m, 'validacao');
        var quando = String(m.entregue_em || (e && e.em) || '').slice(0, 10);
        out.push({ m: m, area: false, quem: quemEntregou(m, e), quando: quando, dias: H.ehISO(quando) ? H.dias(quando, h) : null });
      } else if (c === 'validacao_area' && W.HOMOLOGACAO && W.HOMOLOGACAO.cobraHomologacao(m, h)) {
        var ea = entradaEm(m, 'validacao_area');
        var qa = String(m.validacao_area_em || (ea && ea.em) || '').slice(0, 10);
        out.push({ m: m, area: true, quem: quemEntregou(m, ea), quando: qa, dias: W.HOMOLOGACAO.diasNaArea(m, h) });
      }
    });
    var sinal = V.ordem === 'recentes' ? -1 : 1;
    return out.sort(function (a, b) { return sinal * ((b.dias == null ? -1 : b.dias) - (a.dias == null ? -1 : a.dias)); });
  }

  function idade(d) { return d == null ? 'sem data' : d === 0 ? 'hoje' : d + ' d'; }

  function itemValidacao(v, sel) {
    var m = v.m;
    var velho = v.dias != null && v.dias >= 5;
    return '<a class="bk-vl' + (sel ? ' on' : '') + '" href="#backlog/validacao/' + encodeURIComponent(m.codigo || m.id) + '"' + (sel ? ' aria-current="true"' : '') + '>' +
      '<span class="row" style="justify-content:space-between"><span class="code" style="font-size:11px">' + H.esc(m.codigo || '—') + '</span>' +
      '<span class="mono" style="font-size:11px;color:' + (velho ? 'var(--dg-t)' : 'var(--tx3)') + '">' + idade(v.dias) + '</span></span>' +
      '<span class="t">' + H.esc(m.titulo || '(sem título)') + '</span>' +
      '<span class="note" style="font-size:11.5px;line-height:16px">' + H.esc((v.quem || 'sem dev').split(' ')[0]) + ' · ' + H.esc(H.caminho(m.tema_id) || 'sem sistema') + '</span></a>';
  }

  function texto(rotulo, valor, vazio) {
    var t = String(valor || '').trim();
    return '<div style="display:flex;flex-direction:column;gap:8px;min-width:0"><span class="lab">' + rotulo + '</span>' +
      '<div class="bk-txt' + (t ? '' : ' vz') + '">' + H.esc(t || vazio) + '</div></div>';
  }

  function detalheValidacao(v) {
    var m = v.m;
    var pts = Number(m.poker_pontos);
    var chips = [];
    chips.push(m.em_producao
      ? H.chip(H.ico('rocket') + ' Em produção' + (m.versao ? ' · versão ' + H.esc(m.versao) : '') + (m.producao_em ? ' · desde ' + H.dm(m.producao_em) : ''), 'ok')
      : H.chip('Ainda não subiu para produção' + (m.versao ? ' · prevista ' + H.esc(m.versao) : ''), 'bk'));
    if (m.horas_realizadas) chips.push(H.chip(H.esc(String(m.horas_realizadas)) + ' h registradas', 'bk'));
    var sp = sprintDe(m);
    if (sp) chips.push(H.chip('Sprint ' + H.esc(W.SPRINTPO ? W.SPRINTPO.rotuloCurto(sp) : sp), 'bk'));
    (m.anexos || []).slice(0, 3).forEach(function (a) { chips.push(H.chip(H.ico('clip') + ' ' + H.esc(a.nome || 'arquivo'), 'bk')); });
    if ((m.anexos || []).length > 3) chips.push(H.chip('+' + ((m.anexos || []).length - 3) + ' anexos', 'bk'));
    if (m.spike) chips.push(H.chip(H.ico('search') + ' Spike: pede as aprovações no editor', 'pu'));

    var devolvida = W.DEVOLUCAO ? W.DEVOLUCAO.motivo(m) : String(m.validacao_obs || '');

    // O rodape do prazo: a data prometida ao usuario quando existe
    // (`ENTREGAUSU`), senao o prazo do dev; e o atraso congelado na entrega,
    // que e o que `PRAZO.diasDeAtraso` devolve depois que o dev saiu de cena.
    var EU = W.ENTREGAUSU;
    var alvo = EU ? EU.aMostrar(m) : (m.entrega || '');
    var doUsu = EU ? EU.ehDoUsuario(m) : false;
    var fim = W.PRAZO ? W.PRAZO.fimDoDev(m) : '';
    var atr = H.atrasoDe(m);
    var rodape = [];
    if (alvo) rodape.push((doUsu ? 'Data alvo do usuário: ' : 'Prazo do dev: ') + H.dm(alvo));
    if (fim) rodape.push('entregue ' + H.dm(fim));
    if (atr != null && !v.area) rodape.push(atr > 0 ? '<span style="color:var(--dg-t)">' + H.plural(atr, 'dia', 'dias') + ' depois do prazo</span>' : '<span style="color:var(--ok-t)">no prazo</span>');

    var acoes = '';
    if (H.pode('validar')) {
      acoes = v.area
        ? link(H.hrefEditar(m), 'Registrar homologação', 'Abre ' + (m.codigo || '') + ' no editor (admin) para registrar quem homologou', 'btnp')
        : link(H.hrefEditar(m), 'Devolver com motivo', 'Abre ' + (m.codigo || '') + ' no editor (admin), onde a devolução pede o motivo', 'btn" style="color:var(--dg-t);border-color:rgba(var(--dg-rgb),.4)') +
          link(H.hrefEditar(m), 'Validar e fechar', 'Abre ' + (m.codigo || '') + ' no editor (admin), onde a aprovação grava o selo', 'btnp" style="background:linear-gradient(180deg,var(--ok-t),var(--ok));box-shadow:0 8px 22px rgba(var(--ok-rgb),.25)');
    }

    var quem = v.area
      ? 'na validação da área há ' + (v.dias == null ? '?' : H.plural(v.dias, 'dia', 'dias')) + (H.ehISO(v.quando) ? ' · desde ' + H.dm(v.quando) : '')
      : 'entregue por ' + H.esc(v.quem || 'dev não informado') + (H.ehISO(v.quando) ? ' · ' + H.dm(v.quando) : '') + (v.dias != null ? ' · ' + (v.dias === 0 ? 'hoje' : 'há ' + H.plural(v.dias, 'dia', 'dias')) : '');

    return '<section class="pnh" style="gap:14px">' +
      '<div class="row" style="justify-content:space-between;flex-wrap:wrap"><span class="row" style="flex-wrap:wrap;gap:8px"><a class="code" style="font-size:13px;text-decoration:none" href="' + H.hrefItem(m) + '">' + H.esc(m.codigo || '—') + '</a>' +
      (H.caminho(m.tema_id) ? H.chip(H.esc(H.caminho(m.tema_id)), 'bk') : '') +
      (isFinite(pts) && m.poker_pontos != null && m.poker_pontos !== '' ? H.chip(pts + ' pts', 'ac') : '') + H.chipTipo(m) + '</span>' +
      '<span class="note">' + quem + '</span></div>' +
      '<h2 class="h2" style="font-size:20px;line-height:26px">' + H.esc(m.titulo || '(sem título)') + '</h2>' +
      (v.area ? '<div class="lock">' + H.ico('hourglass') + '<span>Passaram ' + (v.dias == null ? 'os' : v.dias) + ' dias e a área ainda não registrou a homologação. Pergunte a ' +
        H.esc((W.HOMOLOGACAO && W.HOMOLOGACAO.solicitante(m)) || 'quem pediu') + ' se está ok e registre quem homologou: só então segue para o PM/PO.</span></div>' : '') +
      (devolvida ? '<div class="lock">' + H.ico('undo') + '<span><b>Já devolvida antes:</b> ' + H.esc(devolvida) + '</span></div>' : '') +
      '<div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px">' +
      texto('RESUMO DA ENTREGA', m.resumo_entrega, 'O dev não escreveu resumo.') +
      texto('O QUE FOI PEDIDO', m.descricao, 'Sem descrição.') + '</div>' +
      texto('O QUE FOI IMPLEMENTADO', m.implementacao, 'O dev não descreveu o que implementou.') +
      '<div class="row" style="gap:8px;flex-wrap:wrap">' + chips.join('') + '</div>' +
      '<div class="row" style="justify-content:space-between;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--bd)">' +
      '<span class="note">' + (rodape.length ? rodape.join(' · ') : 'Sem prazo registrado') + '</span>' +
      '<span class="row" style="flex-wrap:wrap"><a class="btn" href="' + H.hrefItem(m) + '">Abrir item</a>' + acoes + '</span></div>' +
      '</section>';
  }

  function renderValidacao(ctx) {
    var todas = entregas();
    var pmpo = todas.filter(function (v) { return !v.area; });
    var area = todas.filter(function (v) { return v.area; });
    var cab = '<header style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px">' +
      '<div style="display:flex;flex-direction:column;gap:6px"><h1 class="h1">Validação do PO</h1>' +
      '<span class="sub">Entregas esperando o seu aceite. Validar fecha com o selo; devolver pede motivo e volta para o dev.</span></div>' +
      '<div class="row"><button type="button" class="btns' + (V.ordem === 'antigas' ? ' on' : '') + '" data-bk-ordem="antigas">Mais antigas primeiro</button>' +
      '<button type="button" class="btns' + (V.ordem === 'recentes' ? ' on' : '') + '" data-bk-ordem="recentes">Mais recentes</button></div></header>';
    if (!todas.length) {
      return cab + '<section class="pn">' + H.vazio('check', 'Nada esperando validação', 'Quando o dev entregar, a demanda aparece aqui com o que foi implementado.') + '</section>';
    }
    var cod = String(ctx.param || '').split('/')[0];
    var sel = cod ? todas.find(function (v) { return String(v.m.codigo || v.m.id).toUpperCase() === cod.toUpperCase(); }) : null;
    sel = sel || pmpo[0] || area[0];
    var bloco = function (rot, l) {
      return l.length ? '<span class="lab" style="padding:2px 2px 0">' + rot + ' · ' + l.length + '</span>' +
        l.map(function (v) { return itemValidacao(v, v === sel); }).join('') : '';
    };
    return cab +
      '<div class="grid" style="grid-template-columns:380px minmax(0,1fr);align-items:start">' +
      '<section class="pn" style="gap:8px;max-height:calc(100vh - 220px);overflow:auto">' +
      bloco('AGUARDANDO O PM/PO', pmpo) +
      (area.length ? '<div style="height:6px"></div>' + bloco('ÁREA SEM RESPOSTA HÁ 5+ DIAS', area) : '') +
      '</section>' + detalheValidacao(sel) + '</div>';
  }

  function ligarValidacao(el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-bk-ordem]');
      if (b) { V.ordem = b.getAttribute('data-bk-ordem'); AX.desenhar(); }
    });
  }

  // ── Aba Prazo vencido ─────────────────────────────────────────────────
  function vencidas() {
    return H.visiveis().filter(atrasada);
  }

  /* A FAIXA DE RESUMO E A DO ADMIN (`renderRiscoBanner`): total, quantas em
     projeto, e a mais antiga pela `entrega` gravada, com os dias medidos pelo
     `PRAZO.diasDeAtraso`. Mesma conta, para o numero daqui bater com o banner
     de la. */
  function resumoRisco(lista) {
    var emProjeto = lista.filter(function (m) { return m.projeto_id; }).length;
    var maisAntiga = lista.filter(function (m) { return m.entrega; })
      .sort(function (a, b) { return String(a.entrega).localeCompare(String(b.entrega)); })[0];
    var dias = maisAntiga ? (H.atrasoDe(maisAntiga) || 0) : 0;
    return { total: lista.length, emProjeto: emProjeto, maisAntiga: maisAntiga, dias: dias };
  }

  function recorteVencidas(lista) {
    return lista.filter(function (m) {
      if (A.recorte === 'projeto' && !m.projeto_id) return false;
      if (A.recorte === 'minhas' && !H.minha(m)) return false;
      return casaDev(m, A.dev);
    }).sort(function (a, b) {
      var da = H.atrasoDe(a), db = H.atrasoDe(b);
      return (db == null ? -1 : db) - (da == null ? -1 : da) || String(a.codigo || '').localeCompare(String(b.codigo || ''), 'pt-BR', { numeric: true });
    });
  }

  function renderVencido(ctx) {
    var eDev = ctx.papel === 'dev';
    var todas = vencidas();
    var r = resumoRisco(todas);
    var cab = '<header style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px">' +
      '<div style="display:flex;flex-direction:column;gap:6px"><h1 class="h1">Prazo vencido</h1>' +
      '<span class="sub">Prazo no passado e ainda na mesa do dev: entregar, replanejar ou pausar.</span></div>';
    if (!todas.length) {
      return cab + '</header><section class="pn">' + H.vazio('check', 'Nenhum prazo vencido', 'Tudo o que está em andamento está dentro do prazo.') + '</section>';
    }
    var nMinhas = todas.filter(H.minha).length;
    var btn = function (id, rot, n) { return '<button type="button" class="btns' + (A.recorte === id ? ' on' : '') + '" data-bk-recorte="' + id + '">' + rot + ' ' + n + '</button>'; };
    var devs = {};
    todas.forEach(function (m) { H.devsDe(m).forEach(function (d) { devs[d] = (devs[d] || 0) + 1; }); });
    var semDev = todas.filter(function (m) { return !H.devsDe(m).length; }).length;
    var opDev = '<option value="">Por dev</option>' + Object.keys(devs).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }).map(function (d) {
      return '<option value="' + H.esc(d) + '"' + (A.dev === d ? ' selected' : '') + '>' + H.esc(d) + ' (' + devs[d] + ')</option>';
    }).join('') + (semDev ? '<option value="' + SEM_DEV + '"' + (A.dev === SEM_DEV ? ' selected' : '') + '>Sem dev (' + semDev + ')</option>' : '');
    cab += '<div class="row" style="flex-wrap:wrap;gap:8px">' + btn('todas', 'Todas', todas.length) + btn('projeto', 'Em projeto', r.emProjeto) +
      (nMinhas || eDev ? btn('minhas', 'Minhas', nMinhas) : '') +
      '<select class="in" id="bk-vdev" aria-label="Filtrar por dev" style="height:32px;border-radius:9px;font-size:12.5px;background:var(--sf)">' + opDev + '</select></div></header>';

    var faixa = '<div class="bk-faixa">' + H.ico('alert') + '<span><b>' + H.plural(r.total, 'demanda', 'demandas') + ' com prazo vencido</b>' +
      (r.emProjeto ? ' · ' + r.emProjeto + ' em projeto' : '') +
      (r.dias > 0 ? ' · a mais antiga há ' + H.plural(r.dias, 'dia', 'dias') : '') + '</span></div>';

    var lista = recorteVencidas(todas);
    var dd = lista.map(H.atrasoDe).filter(function (d) { return d > 0; });
    var media = dd.length ? Math.round(dd.reduce(function (t, d) { return t + d; }, 0) / dd.length) : 0;
    var velha = lista.slice().sort(function (a, b) { return (H.atrasoDe(b) || 0) - (H.atrasoDe(a) || 0); })[0];
    var rol = W.CAPACIDADE ? W.CAPACIDADE.rolagens(lista) : { total: 0, alerta: [] };
    var kpis = '<div class="grid" style="grid-template-columns:repeat(4,minmax(0,1fr))">' +
      H.kpi('Vencidas' + (A.recorte !== 'todas' || A.dev ? ' no recorte' : ''), '<span style="color:var(--dg-t)">' + lista.length + '</span>', '', 'dg') +
      H.kpi('Mais antiga', velha && H.atrasoDe(velha) ? H.atrasoDe(velha) + ' d' : '—', velha ? H.esc((velha.codigo || '') + ' · ' + (velha.titulo || '')) : '') +
      H.kpi('Atraso médio', dd.length ? media + ' d' : '—', '') +
      H.kpi('Prazo remarcado', '<span style="color:' + (rol.total ? 'var(--wn-t)' : 'inherit') + '">' + rol.total + '</span>',
        rol.alerta.length ? H.plural(rol.alerta.length, 'passou', 'passaram') + ' de ' + ((W.CAPACIDADE && W.CAPACIDADE.SPRINTS_PARA_ALERTA) || 2) + ' sprints' : 'pelo histórico da data de entrega') +
      '</div>';

    if (!lista.length) {
      return cab + faixa + kpis + '<section class="pn">' + H.vazio('search', 'Nada neste recorte', 'Troque o filtro acima.') + '</section>';
    }
    var lim = A.mais || POR_PAGINA;
    var vis = lista.slice(0, lim);
    var linhas = vis.map(function (m) {
      var a = H.atrasoDe(m);
      var ds = H.devsDe(m);
      var rg = W.CAPACIDADE ? W.CAPACIDADE.rolagemDeSprint(m) : null;
      var acao = '';
      if (H.pode('editar')) acao = link(H.hrefEditar(m), 'Replanejar ou pausar', 'Abre ' + (m.codigo || '') + ' no editor (admin): nova data ou pausa', 'btns" style="height:28px');
      else if (eDev && H.minha(m)) acao = link(H.hrefEditar(m), 'Abrir no painel', 'Abre ' + (m.codigo || '') + ' no Meu painel (dev.html)', 'btns" style="height:28px');
      return '<tr class="click" data-href="' + H.hrefItem(m) + '"' + (eDev && H.minha(m) ? ' style="box-shadow:inset 3px 0 0 var(--ac)"' : '') + '>' +
        '<td style="max-width:420px"><span class="row" style="gap:8px;min-width:0"><span class="code">' + H.esc(m.codigo || '—') + '</span>' +
        '<span style="display:flex;flex-direction:column;min-width:0"><span class="ell" style="color:var(--tx);font-weight:700">' + H.esc(m.titulo || '(sem título)') + '</span>' +
        '<span class="ell" style="font-size:11.5px;color:var(--tx3)">' + H.esc(H.caminho(m.tema_id) || 'Sem sistema') + (m.projeto_id && H.projeto(m.projeto_id) ? ' · ' + H.esc(H.projeto(m.projeto_id).codigo || '') : '') + '</span></span></span></td>' +
        '<td><span class="row" style="gap:8px">' + (ds.length ? H.av(ds[0], 26) + '<span class="ell" style="max-width:150px">' + H.esc(ds.join(' / ')) + '</span>' : H.av('', 26) + '<span style="color:var(--tx4)">sem dev</span>') + '</span></td>' +
        '<td class="mono" style="font-size:12px">' + H.esc(H.dm(H.prazoDe(m)) || '—') + '</td>' +
        '<td>' + (a > 0 ? H.chip('+' + a + ' d', 'dg') : '<span style="color:var(--tx4)">—</span>') + '</td>' +
        '<td>' + chipColuna(m) + '</td>' +
        '<td class="mono" title="' + (rg ? 'Prazo andou ' + rg.dias + ' dias desde ' + H.dm(rg.de) + ' (' + rg.mudancas + ' mudanças)' : 'Prazo nunca remarcado') + '">' + (rg ? '+' + rg.sprints + ' spr.' : '—') + '</td>' +
        '<td>' + acao + '</td></tr>';
    }).join('');
    var mais = lista.length > vis.length
      ? '<div class="bk-mais">Mostrando ' + vis.length + ' de ' + lista.length + '<button type="button" class="btns" data-bk-vmais="1">Mostrar mais ' + Math.min(POR_PAGINA, lista.length - vis.length) + '</button></div>' : '';
    return cab + faixa + kpis +
      '<section class="pn"><table class="tbl"><thead><tr><th>ITEM</th><th>DEV</th><th>PRAZO</th><th>ATRASO</th><th>ETAPA</th><th title="Sprints que o prazo andou desde a primeira data">REMARC.</th><th>AÇÃO</th></tr></thead><tbody>' +
      linhas + '</tbody></table>' + mais + '</section>' +
      '<div class="lock">' + H.ico('info') + '<span>Pausar suspende o prazo: os dias parados não contam como atraso. Replanejar muda a data, e a remarcação fica no histórico da demanda (coluna REMARC.).</span></div>';
  }

  function ligarVencido(el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-bk-recorte]');
      if (b) { A.recorte = b.getAttribute('data-bk-recorte'); A.mais = 0; AX.desenhar(); return; }
      if (e.target.closest('[data-bk-vmais]')) { A.mais = (A.mais || POR_PAGINA) + POR_PAGINA; var y = window.scrollY; AX.desenhar(); window.scrollTo(0, y); return; }
      if (e.target.closest('a, button, select')) return;
      var tr = e.target.closest('tr[data-href]');
      if (tr) location.hash = tr.getAttribute('data-href');
    });
    var s = el.querySelector('#bk-vdev');
    if (s) s.addEventListener('change', function () { A.dev = s.value; A.mais = 0; AX.desenhar(); });
  }

  // ── Aba Importar ──────────────────────────────────────────────────────
  function renderImportar() {
    // Os passos sao os do importar.html, com os nomes de la.
    var passos = [['1 · Preencher dados', 'tabela ou colar do Excel/CSV'], ['2 · Duplicatas', 'revisar possíveis duplicatas'],
                  ['3 · Revisar e validar', 'conferir erros antes de importar'], ['4 · Importar', 'grava na base']];
    var cols = ['titulo', 'descricao', 'tema', 'dev', 'status', 'tipo', 'inicio', 'entrega', 'horas_realizadas', 'solicitante', 'prioridade'];
    return '<header style="display:flex;flex-direction:column;gap:6px">' +
      '<span class="note"><a href="#backlog/lista">Backlog</a> › Importar</span>' +
      '<h1 class="h1">Importar demandas</h1>' +
      '<span class="sub">Cole do Excel. O importador confere os campos, procura duplicatas e só grava depois da sua revisão.</span></header>' +
      '<div class="bk-passos">' + passos.map(function (p) { return '<span>' + H.esc(p[0]) + '<small>' + H.esc(p[1]) + '</small></span>'; }).join('') + '</div>' +
      '<section class="pn" style="gap:14px">' +
      '<span class="lab">COMO FUNCIONA</span>' +
      '<span style="font-size:13.5px;line-height:21px;color:var(--tx2)">A importação continua no importador de sempre: ele lê a planilha, aponta as linhas parecidas com demandas que já existem e mostra os erros antes de gravar. Copie as linhas da planilha (Ctrl+C) com o cabeçalho na primeira linha; o separador pode ser TAB (o padrão do Excel) ou ponto e vírgula.</span>' +
      '<span class="lab">COLUNAS DA PLANILHA</span>' +
      '<div class="row" style="flex-wrap:wrap;gap:6px">' + cols.map(function (c) { return '<span class="chip c-bk mono">' + c + '</span>'; }).join('') + '</div>' +
      '<div class="row" style="justify-content:space-between;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--bd)">' +
      '<span class="note">O que for importado aparece aqui no Backlog na próxima leitura da base.</span>' +
      link('importar.html', 'Abrir o importador', 'Abre importar.html, onde a importação é feita', 'btnp') + '</div></section>';
  }

  // ── Registro ──────────────────────────────────────────────────────────
  var ABAS = [
    { id: 'lista', rotulo: 'Backlog' },
    { id: 'validacao', rotulo: 'Validação do PO', papeis: ['admin'] },
    { id: 'vencido', rotulo: 'Prazo vencido' },
    { id: 'importar', rotulo: 'Importar', papeis: ['admin'] }
  ];
  var TITULOS = { lista: 'Backlog', validacao: 'Validação do PO', vencido: 'Prazo vencido', importar: 'Importar demandas' };

  AX.tela({
    id: 'backlog',
    rotulo: 'Backlog',
    papeis: ['admin', 'dev'],
    abas: ABAS,
    // As abas com contador: o que espera o PO e o que venceu. Filtra o papel
    // aqui porque o nucleo usa esta lista no lugar da ja filtrada.
    abasDe: function () {
      var papel = (AX.APP || {}).papel;
      return ABAS.filter(function (a) { return !a.papeis || a.papeis.indexOf(papel) >= 0; }).map(function (a) {
        var n = null;
        if (a.id === 'validacao') n = entregas().length;
        if (a.id === 'vencido') n = vencidas().length;
        return { id: a.id, rotulo: a.rotulo, n: n || null };
      });
    },
    titulo: function (r) { return TITULOS[r.aba] || 'Backlog'; },
    render: function (el, ctx) {
      css();
      if (ctx.aba === 'validacao') return renderValidacao(ctx);
      if (ctx.aba === 'vencido') return renderVencido(ctx);
      if (ctx.aba === 'importar') return renderImportar(ctx);
      return renderLista(ctx);
    },
    depois: function (el, ctx) {
      if (ctx.aba === 'validacao') ligarValidacao(el);
      else if (ctx.aba === 'vencido') ligarVencido(el);
      else if (ctx.aba === 'lista' || !ctx.aba) ligarLista(el, ctx);
    }
  });
})();
