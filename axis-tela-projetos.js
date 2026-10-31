/* ─────────────────────────────────────────────────────────────────────────
   AXIS — telas Projetos (lista + roadmap) e Projeto (detalhe EP-).

   O DADO E O DO ADMIN: `D.projetos` (codigo EP-, nome, status, responsavel,
   inicio, fim, aprovacao, descricao) e as demandas com `projeto_id`. A conta
   do projeto (concluidas, em validacao, atrasadas, pontos, sem pontuacao) sai
   de RESUMOPROJETO.montar — a mesma montagem do "Resumo executivo" do admin e
   do texto que se cola no grupo. Uma segunda conta aqui divergiria dela na
   primeira correcao.

   "EPICO" NAO EXISTE NO ROADMAP. O prototipo agrupa os itens do projeto em
   epicos EPI-; aqui o agrupamento real que existe e o SISTEMA (tema_id), e e
   ele que ocupa esse lugar — com o nome certo, para ninguem procurar um EPI-.

   GRAVAR CONTINUA NO ADMIN: "+ Novo projeto" e "Editar" abrem admin.html na
   aba Projetos; o dev propoe projeto pelo Meu painel (dev.html).
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var raiz = typeof window !== 'undefined' ? window : globalThis;
  if (!raiz.AXIS_APP) return;
  var AX = raiz.AXIS_APP;
  var H = AX.H;
  var esc = H.esc, ico = H.ico;

  // ── CSS da tela (uma vez, prefixado por .axa) ──────────────────────────
  var CSS = [
    '.axa .pj-leg{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:var(--tx3)}',
    '.axa .pj-leg span{display:flex;align-items:center;gap:6px}',
    '.axa .pj-leg i{width:10px;height:10px;border-radius:3px;display:inline-block}',
    '.axa .pj-grid{align-items:start}',
    '.axa .pj-card{padding:18px;border-radius:16px;background:rgba(var(--sf-rgb),.72);border:1px solid var(--bd);display:flex;flex-direction:column;gap:10px;min-width:0;text-decoration:none;color:var(--tx);cursor:pointer}',
    '.axa .pj-card:hover{border-color:var(--bd4)}',
    '.axa a.pj-nm{color:var(--tx);text-decoration:none} .axa a.pj-nm:hover{color:var(--ac-t)}',
    '.axa .pj-card.dest{grid-row:span 2;padding:20px;border-radius:18px;background:rgba(var(--sf-rgb),.8);border-color:rgba(var(--ac-rgb),.35);gap:14px}',
    '.axa .pj-card.dest:hover{border-color:rgba(var(--ac-rgb),.6)}',
    '.axa .pj-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}',
    '.axa .pj-top > span:first-child{display:flex;flex-direction:column;gap:3px;min-width:0}',
    '.axa .pj-nm{display:block;font-size:15px;line-height:20px;font-weight:800}',
    '.axa .pj-card.dest .pj-nm{font-family:var(--font-title);font-size:19px;line-height:24px}',
    '.axa .pj-st{font-size:10.5px;font-weight:800;letter-spacing:.02em}',
    '.axa .pj-meta{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--tx3);line-height:17px}',
    '.axa .pj-card.dest .pj-meta{font-size:13px}',
    '.axa .pj-bar{display:flex;height:8px;border-radius:4px;overflow:hidden;background:var(--track);flex-shrink:0}',
    '.axa .pj-card.dest .pj-bar{height:10px;border-radius:5px}',
    '.axa .pj-bar > i{display:block;height:100%}',
    '.axa .pj-bar > i.ok{background:var(--ok)} .axa .pj-bar > i.ac{background:var(--ac)}',
    '.axa .pj-flag{font-size:12px;font-weight:700}',
    '.axa .pj-sis{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:12px;background:var(--sf2)}',
    '.axa .pj-sis .pj-bar{height:6px;border-radius:3px}',
    '.axa .pj-mc{display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--tx2)}',
    '.axa .pj-mc a,.axa .pj-mc span.it{display:flex;gap:6px;align-items:baseline;text-decoration:none;color:inherit;min-width:0}',
    '.axa .pj-mc a:hover{color:var(--tx)}',
    '.axa .pj-mc .axi{font-size:12px;flex-shrink:0}',
    /* Linha do tempo (roadmap e detalhe): HTML posicionado em %, com a escala
       em dias corridos — o mes de 31 dias e mais largo que fevereiro. */
    '.axa .tl-wrap{overflow-x:auto;min-width:0}',
    '.axa .tl{min-width:720px}',
    // No detalhe a trilha mora na coluna de 1.5fr: 720px a faria rolar de lado no desktop.
    '.axa .tl.cmp{min-width:520px}',
    '.axa .tl-hd,.axa .tl-row{display:grid;grid-template-columns:var(--tl-lab,300px) minmax(0,1fr)}',
    '.axa .tl-hd{border-bottom:1px solid var(--bd)}',
    '.axa .tl-row{border-bottom:1px solid var(--bd3);min-height:var(--tl-h,62px);text-decoration:none;color:var(--tx)}',
    '.axa a.tl-row:hover{background:rgba(var(--sf-rgb),.55);color:var(--tx)}',
    '.axa .tl-row:last-child{border-bottom:0}',
    '.axa .tl-lb{padding:10px 16px;display:flex;flex-direction:column;justify-content:center;gap:3px;min-width:0}',
    '.axa .tl-lb .code{white-space:nowrap}',
    '.axa .tl-trk{position:relative;min-height:100%}',
    '.axa .tl-mes{position:absolute;top:0;bottom:0;padding:12px 8px;box-sizing:border-box;font-size:12px;font-weight:700;color:var(--tx3);border-left:1px solid var(--bd3);overflow:hidden;white-space:nowrap}',
    '.axa .tl-mes.atual{color:var(--ac-t);background:rgba(var(--ac-rgb),.06)}',
    '.axa .tl-div{position:absolute;top:0;bottom:0;width:0;border-left:1px solid var(--bd3)}',
    '.axa .tl-div.atual{border-left:0;width:auto;background:rgba(var(--ac-rgb),.04)}',
    '.axa .tl-hoje{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:var(--ac);opacity:.85;z-index:2}',
    '.axa .tl-hoje-l{position:absolute;bottom:4px;font-size:10px;font-weight:800;letter-spacing:.08em;color:var(--ac-t);z-index:2}',
    '.axa .tl-alvo{position:absolute;top:0;bottom:0;width:0;border-left:2px dashed rgba(var(--dg-rgb),.55);z-index:1}',
    '.axa .tl-bar{position:absolute;top:50%;transform:translateY(-50%);height:26px;border-radius:8px;background:var(--track);overflow:hidden;box-sizing:border-box;border:1px solid transparent}',
    '.axa .tl-bar.late{border:1px dashed var(--dg)}',
    '.axa .tl-bar.cl{border-top-left-radius:0;border-bottom-left-radius:0}',
    '.axa .tl-bar.cr{border-top-right-radius:0;border-bottom-right-radius:0}',
    '.axa .tl-bar > i{display:block;height:100%}',
    '.axa .tl-txt{position:absolute;top:50%;transform:translateY(-50%);font-size:11px;font-weight:800;color:var(--tx);white-space:nowrap;z-index:3;pointer-events:none}',
    '.axa .tl-dot{position:absolute;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:5px;border:2px solid var(--sf);box-sizing:content-box;z-index:3}',
    '.axa .tl-row.sm .tl-bar{height:20px;border-radius:6px}',
    '.axa .pj-etp{display:grid;grid-template-columns:10px minmax(0,1fr) auto 44px;gap:10px;align-items:center;font-size:13px;color:var(--tx2)}',
    '.axa .pj-etp b{font-variant-numeric:tabular-nums;color:var(--tx)}',
    '.axa .pj-etp span:last-child{text-align:right;color:var(--tx4);font-size:12px;font-variant-numeric:tabular-nums}',
    '.axa .pj-stk{display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--track)}',
    '.axa .pj-stk > i{display:block;height:100%}',
    '.axa .tbl tr.minha td:first-child{box-shadow:inset 3px 0 0 var(--ac)}',
    '.axa .pj-res{margin:0;padding:14px 16px;border-radius:12px;background:var(--sf2);border:1px solid var(--bd);font-family:var(--font-mono);font-size:12px;line-height:19px;color:var(--tx2);white-space:pre-wrap;overflow-wrap:anywhere;max-height:320px;overflow:auto}',
    '.axa .pj-pager{display:flex;align-items:center;justify-content:flex-end;gap:8px;font-size:12.5px;color:var(--tx3)}',
    '.axa .pj-ok{color:var(--ok-t)} .axa .pj-dg{color:var(--dg-t)} .axa .pj-wn{color:var(--wn-t)}',
    /* Celular: o nucleo empilha toda grade inline em uma coluna; os KPIs ficam
       em duas (como no prototipo celular), e a linha do tempo encolhe a coluna
       de rotulo para a trilha ter onde aparecer antes de rolar de lado. */
    '@container app (max-width: 760px){',
    '.axa .app .main .grid.pj-k{grid-template-columns:repeat(2,minmax(0,1fr)) !important}',
    '.axa .tl{min-width:560px;--tl-lab:150px !important}',
    '.axa .tl-lb{padding:8px 10px !important}',
    '}'
  ].join('\n');
  function garanteCss() {
    if (typeof document === 'undefined' || document.getElementById('css-tela-projetos')) return;
    var st = document.createElement('style');
    st.id = 'css-tela-projetos';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ── Leituras do projeto ─────────────────────────────────────────────────
  /* APROVACAO: projeto sem o campo conta como aprovado. Regra copiada do
     admin.html (pjAprovado/pjPendente/pjRecusado): os projetos antigos foram
     criados pelo PM/PO no proprio admin, e criar ali JA e a aprovacao. */
  function aprovacao(p) {
    var a = String((p && p.aprovacao) || 'aprovado');
    return a === 'pendente' || a === 'recusado' ? a : 'aprovado';
  }
  function grupoDe(p) {
    var a = aprovacao(p);
    if (a !== 'aprovado') return a;
    return p.status === 'concluido' ? 'concluido' : 'ativo';
  }
  // Status do admin (PJ_STATUS) com a cor do chip do prototipo.
  var ST = {
    planejado: { rot: 'PLANEJADO', cor: 'in', barra: 'var(--in)' },
    em_andamento: { rot: 'EM ANDAMENTO', cor: 'ac', barra: 'var(--ac)' },
    pausado: { rot: 'PAUSADO', cor: 'mg', barra: 'var(--tx4)' },
    concluido: { rot: 'CONCLUÍDO', cor: 'ok', barra: 'var(--ok)' }
  };
  function chipStatus(p) {
    var a = aprovacao(p);
    if (a === 'pendente') return H.chip('AGUARDANDO APROVAÇÃO', 'wn').replace('class="chip', 'class="chip pj-st');
    if (a === 'recusado') return H.chip('RECUSADO', 'dg').replace('class="chip', 'class="chip pj-st');
    var s = ST[p.status] || ST.planejado;
    return H.chip(s.rot, s.cor).replace('class="chip', 'class="chip pj-st');
  }
  function hrefProjeto(p) { return '#projeto/' + encodeURIComponent(p.codigo || p.id); }
  function acharProjeto(D, param) {
    var q = String(param || '').trim().toUpperCase();
    return (D.projetos || []).find(function (p) {
      return String(p.codigo || '').toUpperCase() === q || String(p.id || '').toUpperCase() === q;
    }) || null;
  }

  /* A CONTA E A DO RESUMOPROJETO. Ele procura a etapa em `ETAPADEMANDA`, que
     so existe no Node (a suite a injeta); no navegador o modulo de etapa se
     publica como `ETAPA`, e sem o apelido o resumo cai no campo cru e NUNCA ve
     atraso. O apelido vale so durante a chamada, para nao mudar o que outras
     telas leem — e a correcao de verdade e no modulo (ver entrega). */
  function resumo(D, pid) {
    var R = raiz.RESUMOPROJETO;
    if (!R) return null;
    var tinha = Object.prototype.hasOwnProperty.call(raiz, 'ETAPADEMANDA');
    if (!tinha && raiz.ETAPA) raiz.ETAPADEMANDA = raiz.ETAPA;
    try { return R.montar(D, pid, H.hoje()); }
    finally { if (!tinha) { try { delete raiz.ETAPADEMANDA; } catch (_) { raiz.ETAPADEMANDA = undefined; } } }
  }

  // "Em andamento" na barra: o que esta na mao do dev ou esperando validacao.
  var FAZENDO = { em_andamento: 1, validacao_area: 1, validacao: 1 };

  /** Tudo o que os cartoes e a linha do tempo leem de um projeto. */
  function leitura(D, p, cache) {
    if (cache[p.id]) return cache[p.id];
    var r = resumo(D, p.id) || { issues: [], total: 0, feitas: 0, validando: 0, atrasadas: 0, pct: 0, pontos: 0, pontosFeitos: 0, semPonto: 0 };
    var porId = {};
    (D.melhorias || []).forEach(function (m) { if (m && m.projeto_id === p.id) porId[m.id] = m; });
    var ms = r.issues.map(function (x) { return porId[x.id]; }).filter(Boolean);
    var fazendo = r.issues.filter(function (x) { return FAZENDO[x.gravada]; }).length;
    var hj = H.hoje();
    var alvoVencido = !!(p.fim && String(p.fim).slice(0, 10) < hj && p.status !== 'concluido' && aprovacao(p) === 'aprovado');
    var meus = ms.filter(H.minha).length;
    var out = {
      r: r, ms: ms, fazendo: fazendo, meus: meus, alvoVencido: alvoVencido,
      pctFeito: r.total ? r.feitas / r.total * 100 : 0,
      pctFazendo: r.total ? fazendo / r.total * 100 : 0
    };
    cache[p.id] = out;
    return out;
  }

  function periodo(p, curto) {
    var f = curto ? H.dm : H.dma;
    if (p.inicio && p.fim) return f(p.inicio) + ' → ' + H.dma(p.fim);
    if (p.fim) return 'alvo ' + H.dma(p.fim);
    if (p.inicio) return 'desde ' + H.dma(p.inicio);
    return 'sem período';
  }

  function barra(l) {
    return '<div class="pj-bar" role="img" aria-label="' + l.r.feitas + ' de ' + l.r.total + ' concluídos">' +
      '<i class="ok" style="width:' + l.pctFeito.toFixed(1) + '%"></i><i class="ac" style="width:' + l.pctFazendo.toFixed(1) + '%"></i></div>';
  }

  /** A linha de alerta do cartao. Mesma leitura do pjCardHTML do admin
      (atrasadas, p/ validar, "em dia"), mais a data alvo vencida. */
  function bandeira(p, l) {
    var a = aprovacao(p);
    if (a === 'pendente') return { txt: 'aguardando aprovação' + (p.solicitado_por ? ' · proposto por ' + p.solicitado_por : ''), cls: 'pj-wn' };
    if (a === 'recusado') return { txt: 'recusado' + (p.aprovado_por ? ' por ' + p.aprovado_por : ''), cls: 'pj-dg' };
    if (p.status === 'concluido') return { txt: 'concluído', cls: 'pj-ok' };
    var partes = [];
    if (l.r.atrasadas) partes.push(H.plural(l.r.atrasadas, 'atrasado', 'atrasados'));
    if (l.r.validando) partes.push(l.r.validando + ' para validar');
    if (l.alvoVencido) partes.push('data alvo vencida');
    if (partes.length) return { txt: partes.join(' · '), cls: (l.r.atrasadas || l.alvoVencido) ? 'pj-dg' : 'pj-wn' };
    if (!l.r.total) return { txt: 'nenhum item ligado ainda', cls: '' };
    return { txt: 'em dia', cls: 'pj-ok' };
  }

  function metaLinha(p, l) {
    var t = [];
    t.push(p.responsavel ? esc(p.responsavel) : 'sem responsável');
    t.push(esc(periodo(p, true)));
    t.push(l.r.feitas + ' de ' + H.plural(l.r.total, 'item', 'itens'));
    if (l.r.pontos) t.push(l.r.pontosFeitos + '/' + l.r.pontos + ' pts');
    return '<span class="pj-meta">' + (p.responsavel ? H.av(p.responsavel, 22) : '') + '<span>' + t.join(' · ') + '</span></span>';
  }

  /** Sistemas do projeto: o agrupamento real no lugar do "epico" do prototipo. */
  function sistemas(l) {
    var g = {};
    l.r.issues.forEach(function (x, i) {
      var m = l.ms[i]; var k = (m && m.tema_id) || '';
      if (!g[k]) g[k] = { id: k, nome: k ? (H.caminho(k) || 'Sistema removido') : 'Sem sistema', total: 0, feitas: 0, fazendo: 0, ms: [] };
      g[k].total++;
      if (x.gravada === 'concluido') g[k].feitas++;
      else if (FAZENDO[x.gravada]) g[k].fazendo++;
      if (m) g[k].ms.push(m);
    });
    return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'); });
  }

  /** "Marcos" do prototipo: aqui, as entregas reais — as ultimas concluidas e
      as proximas pelo prazo efetivo (PRAZO), e a data alvo do proprio projeto. */
  function marcos(p, l, max) {
    var hj = H.hoje();
    var feitos = l.ms.filter(function (m) { return H.colunaDe(m) === 'concluido'; })
      .map(function (m) { return { m: m, d: String(m.concluido_em || m.entregue_em || m.entrega || '').slice(0, 10) }; })
      .filter(function (x) { return H.ehISO(x.d); })
      .sort(function (a, b) { return b.d < a.d ? -1 : 1; }).slice(0, 2).reverse();
    var abertos = l.ms.filter(function (m) { var c = H.colunaDe(m); return c !== 'concluido' && c !== 'negada' && H.prazoDe(m); })
      .map(function (m) { return { m: m, d: String(H.prazoDe(m)).slice(0, 10) }; })
      .sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    var linhas = [];
    feitos.forEach(function (x) {
      linhas.push('<a class="pj-ok" href="' + H.hrefItem(x.m) + '">' + ico('check') + '<span class="ell">' + H.dm(x.d) + ' · ' + esc(x.m.codigo || '') + ' ' + esc(x.m.titulo || '') + '</span></a>');
    });
    var resta = Math.max(1, (max || 5) - linhas.length - (p.fim ? 1 : 0));
    abertos.slice(0, resta).forEach(function (x) {
      var a = H.atrasoDe(x.m), dd = H.dias(hj, x.d);
      var cls = a && a > 0 ? 'pj-dg' : (dd != null && dd <= 7 ? 'pj-wn' : '');
      linhas.push('<a class="' + cls + '" href="' + H.hrefItem(x.m) + '"' + (cls ? '' : ' style="color:var(--tx3)"') + '>' + ico('circle') +
        '<span class="ell">' + H.dm(x.d) + ' · ' + esc(x.m.codigo || '') + ' ' + esc(x.m.titulo || '') + '</span></a>');
    });
    if (p.fim) {
      var venc = l.alvoVencido;
      linhas.push('<span class="it ' + (venc ? 'pj-dg' : '') + '"' + (venc ? '' : ' style="color:var(--tx3)"') + '>' + ico(p.status === 'concluido' ? 'check' : 'flag') +
        '<span>' + H.dm(p.fim) + ' · data alvo do projeto' + (venc ? ' (vencida)' : '') + '</span></span>');
    }
    return linhas.length ? '<div class="pj-mc">' + linhas.join('') + '</div>' : '<span class="note">Nenhuma entrega com data ainda.</span>';
  }

  // ── Filtros (estado da tela, vive enquanto a pagina vive) ─────────────
  var F = { status: 'ativo', resp: '', meus: false, janela: 'sem', rmStatus: 'todos' };
  var FD = { pid: '', filtro: 'todos', pag: 0 };
  var POR_PAG = 20;

  function contagens(ps) {
    var c = { ativo: 0, pendente: 0, concluido: 0, recusado: 0, todos: 0 };
    ps.forEach(function (p) { c[grupoDe(p)]++; if (grupoDe(p) !== 'recusado') c.todos++; });
    return c;
  }
  function passaStatus(p, st) {
    if (st === 'todos') return grupoDe(p) !== 'recusado';
    return grupoDe(p) === st;
  }
  function filtroBtns(ps, atual, attr, incluirTodos) {
    var c = contagens(ps);
    var ops = [['ativo', 'Ativos'], ['pendente', 'Aguardando aprovação'], ['concluido', 'Concluídos']];
    if (c.recusado) ops.push(['recusado', 'Recusados']);
    if (incluirTodos) ops.push(['todos', 'Todos']);
    return ops.map(function (o) {
      return '<button type="button" class="btns' + (atual === o[0] ? ' on' : '') + '" ' + attr + '="' + o[0] + '" aria-pressed="' + (atual === o[0]) + '">' + o[1] + ' ' + c[o[0]] + '</button>';
    }).join('');
  }
  function filtroResp(ps) {
    var nomes = {};
    ps.forEach(function (p) { if (p.responsavel) nomes[p.responsavel] = 1; });
    var l = Object.keys(nomes).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    if (F.resp && !nomes[F.resp]) F.resp = '';
    return '<select class="in" data-pj-resp aria-label="Filtrar por responsável" style="height:32px;font-size:12.5px;border-radius:9px;min-width:190px">' +
      '<option value="">Todos os responsáveis</option>' +
      l.map(function (n) { return '<option' + (F.resp === n ? ' selected' : '') + ' value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('') + '</select>';
  }

  /* Ordem dos cartoes: em andamento antes de planejado, e dentro de cada um a
     regra do renderProjetos do admin — quem tem atrasada primeiro, mais
     atrasadas antes, depois o maior progresso. Proposta pendente vai ao topo
     no "Todos" pelo mesmo motivo do admin: e decisao esperando alguem. */
  var PESO_ST = { em_andamento: 0, pausado: 1, planejado: 2, concluido: 3 };
  function ordenar(ps, L) {
    return ps.slice().sort(function (a, b) {
      var ga = grupoDe(a), gb = grupoDe(b);
      if ((ga === 'pendente') !== (gb === 'pendente')) return ga === 'pendente' ? -1 : 1;
      if ((ga === 'recusado') !== (gb === 'recusado')) return ga === 'recusado' ? 1 : -1;
      var sa = PESO_ST[a.status] != null ? PESO_ST[a.status] : 2, sb = PESO_ST[b.status] != null ? PESO_ST[b.status] : 2;
      if (sa !== sb) return sa - sb;
      var ra = L(a).r, rb = L(b).r;
      if ((rb.atrasadas > 0) !== (ra.atrasadas > 0)) return rb.atrasadas > 0 ? 1 : -1;
      if (rb.atrasadas !== ra.atrasadas) return rb.atrasadas - ra.atrasadas;
      return rb.pct - ra.pct;
    });
  }

  // ── Aba Projetos ─────────────────────────────────────────────────────────
  function htmlLista(ctx) {
    var D = ctx.D, ps = D.projetos || [], cache = {};
    var L = function (p) { return leitura(D, p, cache); };
    var dev = ctx.papel === 'dev';

    // KPIs: a carteira ATIVA (aprovado e nao concluido), independente do filtro.
    var ativos = ps.filter(function (p) { return grupoDe(p) === 'ativo'; });
    var k = { itens: 0, feitas: 0, pts: 0, ptsF: 0, atr: 0, comAtr: 0, val: 0 };
    ativos.forEach(function (p) {
      var r = L(p).r;
      k.itens += r.total; k.feitas += r.feitas; k.pts += r.pontos; k.ptsF += r.pontosFeitos; k.atr += r.atrasadas; k.val += r.validando;
      if (r.atrasadas) k.comAtr++;
    });
    var emAnd = ativos.filter(function (p) { return p.status === 'em_andamento'; }).length;
    var pct = k.itens ? Math.round(k.feitas / k.itens * 100) : 0;
    var kpis = '<div class="grid pj-k" style="grid-template-columns:repeat(4,minmax(0,1fr))">' +
      H.kpi('Projetos ativos', String(ativos.length), emAnd + ' em andamento · ' + (ativos.length - emAnd) + ' planejados ou pausados') +
      H.kpi('Itens nos projetos ativos', String(k.itens), k.val ? k.val + ' aguardando validação' : 'nenhum aguardando validação') +
      H.kpi('Concluído', pct + '%', k.feitas + ' de ' + k.itens + ' itens' + (k.pts ? ' · ' + k.ptsF + ' de ' + k.pts + ' pts' : ''), pct >= 100 && k.itens ? 'ok' : '') +
      H.kpi('Itens atrasados', '<span style="color:' + (k.atr ? 'var(--dg-t)' : 'inherit') + '">' + k.atr + '</span>',
        k.atr ? 'em ' + H.plural(k.comAtr, 'projeto', 'projetos') : 'nenhum projeto com atraso', k.atr ? 'dg' : '') +
      '</div>';

    var acoes = '';
    if (ctx.papel === 'admin') acoes = H.linkAdmin('projetos', '+ Novo projeto', 'btnp');
    else if (dev) acoes = '<a class="btn" href="dev.html" title="Abre o Meu painel (dev.html): a proposta fica na seção Projetos">Propor projeto ' + ico('external', 'style="font-size:12px;opacity:.7"') + '</a>';

    var lista = ps.filter(function (p) {
      if (!passaStatus(p, F.status)) return false;
      if (F.resp && p.responsavel !== F.resp) return false;
      if (F.meus && !L(p).meus) return false;
      return true;
    });
    lista = ordenar(lista, L);

    var cab = '<header style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px">' +
      '<div style="display:flex;flex-direction:column;gap:6px"><h1 class="h1">Projetos</h1>' +
      '<span class="sub">Projeto é o resultado de negócio (EP-). Os itens vivem no quadro e no planejamento; dentro do projeto eles se agrupam por sistema.</span></div>' +
      (acoes ? '<div class="row">' + acoes + '</div>' : '') + '</header>';

    var filtros = '<div class="row" style="flex-wrap:wrap;gap:8px">' + filtroBtns(ps, F.status, 'data-pj-st', true) +
      (dev ? '<button type="button" class="btns' + (F.meus ? ' on' : '') + '" data-pj-meus aria-pressed="' + F.meus + '">Com itens meus</button>' : '') +
      filtroResp(ps) + '<span style="flex:1"></span>' +
      '<span class="pj-leg"><span><i style="background:var(--ok)"></i>concluído</span><span><i style="background:var(--ac)"></i>em andamento</span><span><i style="background:var(--track);box-shadow:inset 0 0 0 1px var(--bd4)"></i>a fazer</span></span></div>';

    if (!ps.length) {
      return '<div class="view" style="gap:18px">' + cab + H.vazio('package', 'Nenhum projeto cadastrado', 'Projetos são criados na área administrativa, aba Projetos.') + '</div>';
    }
    var corpo;
    if (!lista.length) {
      corpo = H.vazio('package', 'Nenhum projeto neste filtro', 'Troque o status ou o responsável acima.');
    } else {
      corpo = '<div class="grid pj-grid" style="grid-template-columns:minmax(0,1.25fr) minmax(0,1fr) minmax(0,1fr)">' +
        lista.map(function (p, i) { return cartao(p, L(p), i === 0 && lista.length > 1, dev); }).join('') + '</div>';
    }
    return cab + kpis + filtros + corpo;
  }

  function cartao(p, l, dest, dev) {
    var b = bandeira(p, l);
    /* O cartao e um <div> com data-href, e nao um <a>: o destacado carrega
       links das entregas, e <a> dentro de <a> o navegador quebra em dois. */
    var h = '<div class="pj-card' + (dest ? ' dest' : '') + '" data-href="' + esc(hrefProjeto(p)) + '">' +
      '<div class="pj-top"><span>' + (p.codigo ? '<span class="code" style="font-size:' + (dest ? 12 : 11.5) + 'px">' + esc(p.codigo) + '</span>' : '<span class="note" style="font-size:11.5px">sem código até a aprovação</span>') +
      '<a class="pj-nm" href="' + hrefProjeto(p) + '">' + esc(p.nome || '(sem nome)') + '</a></span>' + chipStatus(p) + '</div>' +
      metaLinha(p, l) + barra(l);
    if (!dest) {
      return h + '<span class="pj-flag ' + b.cls + '"' + (b.cls ? '' : ' style="color:var(--tx3)"') + '>' + esc(b.txt) +
        (dev && l.meus ? ' <span style="color:var(--ac-t)">· ' + H.plural(l.meus, 'item seu', 'itens seus') + '</span>' : '') + '</span></div>';
    }
    var chips = [];
    if (l.r.atrasadas) chips.push(H.chip(H.plural(l.r.atrasadas, 'atrasado', 'atrasados'), 'dg'));
    if (l.r.validando) chips.push(H.chip(l.r.validando + ' para validar', 'wn'));
    if (l.alvoVencido) chips.push(H.chip('data alvo vencida', 'dg'));
    if (l.r.semPonto) chips.push(H.chip(l.r.semPonto + ' sem pontuação', 'bk'));
    if (dev && l.meus) chips.push(H.chip(H.plural(l.meus, 'item seu', 'itens seus'), 'ac'));
    if (!chips.length) chips.push('<span class="pj-flag ' + b.cls + '">' + esc(b.txt) + '</span>');
    h += '<div class="row" style="gap:8px;flex-wrap:wrap">' + chips.join('') + '</div>';
    var sis = sistemas(l);
    if (sis.length) {
      h += '<span class="lab" style="margin-top:4px">SISTEMAS</span>' + sis.slice(0, 4).map(function (s) {
        var pf = s.total ? s.feitas / s.total * 100 : 0, pa = s.total ? s.fazendo / s.total * 100 : 0;
        return '<div class="pj-sis"><span style="display:flex;justify-content:space-between;gap:8px"><span class="ell" style="font-size:13px;font-weight:700" title="' + esc(s.nome) + '">' + esc(s.nome) + '</span>' +
          '<span class="mono" style="font-size:11.5px;color:var(--tx3);flex-shrink:0">' + s.feitas + ' / ' + s.total + '</span></span>' +
          '<div class="pj-bar"><i class="ok" style="width:' + pf.toFixed(1) + '%"></i><i class="ac" style="width:' + pa.toFixed(1) + '%"></i></div></div>';
      }).join('') + (sis.length > 4 ? '<span class="note">+ ' + H.plural(sis.length - 4, 'sistema', 'sistemas') + ' no projeto</span>' : '');
    }
    h += '<span class="lab" style="margin-top:4px">ENTREGAS</span>' + marcos(p, l, 4);
    return h + '</div>';
  }

  // ── Linha do tempo (roadmap e detalhe) ─────────────────────────────────
  function primeiroDoMes(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function janela(ini, fim) {
    var a = primeiroDoMes(ini), b = new Date(fim.getFullYear(), fim.getMonth() + 1, 1);
    var meses = [], cur = new Date(a), hj = H.data(H.hoje());
    while (cur < b) {
      var prox = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      meses.push({ ini: new Date(cur), fim: prox, atual: hj >= cur && hj < prox });
      cur = prox;
    }
    return { ini: a, fim: b, meses: meses, anos: a.getFullYear() !== new Date(b - 1).getFullYear() || meses.length > 6 };
  }
  function pos(J, d) {
    var x = (d - J.ini) / (J.fim - J.ini) * 100;
    return Math.max(0, Math.min(100, x));
  }
  function posIso(J, iso) { var d = H.data(iso); return d ? pos(J, d) : null; }
  /** Fim inclusivo: a barra cobre o dia da data alvo inteiro. */
  function posFim(J, iso) { var d = H.data(iso); return d ? pos(J, new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) : null; }

  function trilhaFundo(J, comHoje) {
    var h = J.meses.map(function (m) {
      var l = pos(J, m.ini), w = pos(J, m.fim) - l;
      return '<span class="tl-div' + (m.atual ? ' atual' : '') + '" style="left:' + l.toFixed(3) + '%' + (m.atual ? ';width:' + w.toFixed(3) + '%' : '') + '"></span>' +
        (m.atual ? '<span class="tl-div" style="left:' + l.toFixed(3) + '%"></span>' : '');
    }).join('');
    var hj = H.data(H.hoje());
    if (comHoje && hj >= J.ini && hj < J.fim) h += '<span class="tl-hoje" style="left:' + pos(J, new Date(hj.getFullYear(), hj.getMonth(), hj.getDate(), 12)).toFixed(3) + '%"></span>';
    return h;
  }
  function trilhaCab(J, rotLab) {
    var passo = J.meses.length > 18 ? 3 : 1;
    var meses = J.meses.map(function (m, i) {
      var l = pos(J, m.ini), w = pos(J, m.fim) - l;
      var rot = (i % passo === 0) ? H.MESES_C[m.ini.getMonth()] + (J.anos ? '/' + String(m.ini.getFullYear()).slice(2) : '') : '';
      return '<span class="tl-mes' + (m.atual ? ' atual' : '') + '" style="left:' + l.toFixed(3) + '%;width:' + w.toFixed(3) + '%">' + rot + '</span>';
    }).join('');
    var hj = H.data(H.hoje()), hoje = '';
    if (hj >= J.ini && hj < J.fim) {
      var x = pos(J, new Date(hj.getFullYear(), hj.getMonth(), hj.getDate(), 12));
      hoje = '<span class="tl-hoje" style="left:' + x.toFixed(3) + '%;top:auto;height:12px"></span>' +
        '<span class="tl-hoje-l" style="' + (x > 12 ? 'right:' + (100 - x).toFixed(3) + '%;margin-right:5px' : 'left:' + x.toFixed(3) + '%') + '">HOJE</span>';
    }
    return '<div class="tl-hd"><span class="lab" style="padding:12px 16px">' + rotLab + '</span><div class="tl-trk" style="height:40px">' + meses + hoje + '</div></div>';
  }
  /** Barra de periodo com preenchimento de progresso e rotulo que sai para fora quando nao cabe. */
  function trilhaBarra(J, iniIso, fimIso, o) {
    var dIni = H.data(iniIso), dFim = H.data(fimIso);
    var l = posIso(J, iniIso), r = posFim(J, fimIso);
    var w = Math.max(0.8, r - l);
    var cl = dIni < J.ini, cr = new Date(dFim.getFullYear(), dFim.getMonth(), dFim.getDate() + 1) > J.fim;
    var h = '<span class="tl-bar' + (o.late ? ' late' : '') + (cl ? ' cl' : '') + (cr ? ' cr' : '') + '" style="left:' + l.toFixed(3) + '%;width:' + w.toFixed(3) + '%"' +
      (o.titulo ? ' title="' + esc(o.titulo) + '"' : '') + '><i style="width:' + Math.max(0, Math.min(100, o.pct || 0)).toFixed(1) + '%;background:' + o.cor + '"></i></span>';
    if (o.lab) {
      // Cabe dentro quando a barra tem folga; senao vai ao lado (direita, ou esquerda no fim da janela).
      var dentro = w >= 24;
      var st = dentro ? 'left:calc(' + l.toFixed(3) + '% + 10px)'
        : (l + w > 70 ? 'right:calc(' + (100 - l).toFixed(3) + '% + 8px)' : 'left:calc(' + (l + w).toFixed(3) + '% + 8px)');
      h += '<span class="tl-txt" style="' + st + (dentro ? '' : ';color:var(--tx2)') + '">' + esc(o.lab) + '</span>';
    }
    return h;
  }

  // ── Aba Roadmap ──────────────────────────────────────────────────────────
  function htmlRoadmap(ctx) {
    var D = ctx.D, ps = D.projetos || [], cache = {};
    var L = function (p) { return leitura(D, p, cache); };
    var hj = H.data(H.hoje());
    var vis = ps.filter(function (p) { return passaStatus(p, F.rmStatus) && (!F.resp || p.responsavel === F.resp); });
    var comData = vis.filter(function (p) { return H.ehISO(p.inicio) && H.ehISO(p.fim) && p.fim >= p.inicio; });
    var semData = vis.filter(function (p) { return comData.indexOf(p) < 0; });

    var J;
    if (F.janela === 'tudo' && comData.length) {
      var mi = comData.reduce(function (a, p) { return p.inicio < a ? p.inicio : a; }, comData[0].inicio);
      var ma = comData.reduce(function (a, p) { return p.fim > a ? p.fim : a; }, comData[0].fim);
      J = janela(H.data(mi), H.data(ma));
    } else {
      var n = F.janela === 'tri' ? 3 : 6;
      J = janela(hj, new Date(hj.getFullYear(), hj.getMonth() + n - 1, 1));
    }
    var dentro = comData.filter(function (p) { return H.data(p.inicio) < J.fim && posFim(J, p.fim) > 0 && H.data(p.fim) >= J.ini; })
      .sort(function (a, b) { return a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : (a.fim < b.fim ? -1 : 1); });
    var fora = comData.length - dentro.length;

    var cab = '<header style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px">' +
      '<div style="display:flex;flex-direction:column;gap:6px"><h1 class="h1">Roadmap</h1>' +
      '<span class="sub" style="max-width:760px">Todos os projetos no tempo, do início à data alvo de cada um. A barra se enche com o que foi concluído. Barra tracejada = data alvo passou e o projeto não foi concluído.</span></div>' +
      '<div class="row">' + [['tri', 'Trimestre'], ['sem', 'Semestre'], ['tudo', 'Tudo']].map(function (o) {
        return '<button type="button" class="btns' + (F.janela === o[0] ? ' on' : '') + '" data-pj-jan="' + o[0] + '" aria-pressed="' + (F.janela === o[0]) + '">' + o[1] + '</button>';
      }).join('') + '</div></header>';
    var filtros = '<div class="row" style="flex-wrap:wrap;gap:8px">' + filtroBtns(ps, F.rmStatus, 'data-pj-rst', true) + filtroResp(ps) + '</div>';

    var linhas = dentro.map(function (p) {
      var l = L(p), a = aprovacao(p);
      var late = l.alvoVencido;
      var cor = late ? 'var(--dg)' : a !== 'aprovado' ? 'var(--wn)' : (ST[p.status] || ST.planejado).barra;
      var lab;
      if (a === 'pendente') lab = 'aguardando aprovação';
      else if (a === 'recusado') lab = 'recusado';
      else if (!l.r.total) lab = 'sem itens · alvo ' + H.dm(p.fim);
      else if (late) lab = l.r.pct + '% · vencido em ' + H.dm(p.fim);
      else if (p.status === 'concluido') lab = l.r.pct + '% · concluído';
      else lab = l.r.pct + '% · ' + l.r.feitas + ' de ' + l.r.total + ' · alvo ' + H.dm(p.fim);
      var tit = (p.codigo || '') + ' ' + (p.nome || '') + ' — ' + H.dma(p.inicio) + ' a ' + H.dma(p.fim);
      return '<a class="tl-row" href="' + hrefProjeto(p) + '" title="Abrir ' + esc(p.codigo || p.nome) + '">' +
        '<span class="tl-lb"><span class="row" style="gap:8px">' + (p.codigo ? '<span class="code" style="font-size:11px">' + esc(p.codigo) + '</span>' : '') +
        '<span class="note ell" style="font-size:11.5px">' + esc(p.responsavel || '—') + '</span></span><b class="ell" style="font-size:13px" title="' + esc(p.nome) + '">' + esc(p.nome || '(sem nome)') + '</b></span>' +
        '<span class="tl-trk">' + trilhaFundo(J, true) + trilhaBarra(J, p.inicio, p.fim, { pct: l.r.pct, cor: cor, lab: lab, late: late, titulo: tit }) + '</span></a>';
    }).join('');

    var notas = [];
    if (fora) notas.push(H.plural(fora, 'projeto fica', 'projetos ficam') + ' fora desta janela' + (F.janela !== 'tudo' ? ' — veja em <button type="button" class="link" data-pj-jan="tudo">Tudo</button>' : ''));
    if (semData.length) notas.push('Sem início ou data alvo, fora da linha do tempo: ' + semData.map(function (p) {
      return '<a href="' + hrefProjeto(p) + '">' + esc(p.codigo || p.nome) + '</a>';
    }).join(', '));

    var painel = dentro.length
      ? '<section class="pn" style="padding:0;gap:0"><div class="tl-wrap"><div class="tl">' + trilhaCab(J, 'PROJETO') + linhas + '</div></div></section>'
      : H.vazio('calendar', 'Nenhum projeto nesta janela', comData.length ? 'Troque para Tudo ou mude o filtro.' : 'Os projetos deste filtro ainda não têm início e data alvo.');
    return cab + filtros + painel + (notas.length ? '<span class="note">' + notas.join('<br>') + '</span>' : '');
  }

  // ── Projeto (detalhe) ───────────────────────────────────────────────────
  var ORDEM_ITEM = { validacao: 1, validacao_area: 2, em_andamento: 3, planejado: 4, planning: 5, levantar_req: 6, backlog: 7, concluido: 8, negada: 9 };
  function htmlProjeto(ctx) {
    var D = ctx.D, p = acharProjeto(D, ctx.param);
    var volta = '<span class="note"><a href="#projetos">Projetos</a> › ' + esc(ctx.param || '') + '</span>';
    if (!p) return volta + H.vazio('package', 'Projeto não encontrado', 'Nenhum projeto com o código ' + (ctx.param || '') + ' na base.', '<a class="btn" href="#projetos">Ver todos os projetos</a>');
    if (FD.pid !== p.id) { FD.pid = p.id; FD.filtro = 'todos'; FD.pag = 0; }
    var l = leitura(D, p, {}), r = l.r, hj = H.hoje();
    var dev = ctx.papel === 'dev';

    var sub = [];
    sub.push(p.responsavel ? 'responsável ' + esc(p.responsavel) : 'sem responsável');
    if (p.solicitado_por) sub.push('proposto por ' + esc(p.solicitado_por));
    if (p.aprovado_por && aprovacao(p) === 'aprovado') sub.push('aprovado por ' + esc(p.aprovado_por));
    sub.push(esc(periodo(p)));
    var acoes = '<button type="button" class="btn" data-pj-copiar title="Copia o resumo executivo em texto, pronto para colar no grupo">' + ico('clipboard') + ' Copiar resumo</button>';
    if (ctx.papel === 'admin') acoes = H.linkAdmin('projetos', 'Editar', 'btn') + acoes;
    var cab = '<header style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px">' +
      '<div style="display:flex;flex-direction:column;gap:6px;min-width:0">' +
      '<span class="note"><a href="#projetos">Projetos</a> › ' + esc(p.codigo || p.nome) + '</span>' +
      '<div class="row" style="flex-wrap:wrap">' + (p.codigo ? '<span class="code" style="font-size:13px">' + esc(p.codigo) + '</span>' : '') + chipStatus(p) +
      (p.responsavel ? H.av(p.responsavel, 22) : '') + '<span class="note">' + sub.join(' · ') + '</span></div>' +
      '<h1 class="h1">' + esc(p.nome || '(sem nome)') + '</h1></div><div class="row" style="flex-wrap:wrap">' + acoes + '</div></header>';

    // KPIs
    var dAlvo = p.fim ? H.dias(hj, p.fim) : null;
    var notaAlvo = !p.fim ? 'sem data alvo' : p.status === 'concluido' ? 'projeto concluído'
      : dAlvo < 0 ? 'vencida há ' + H.plural(-dAlvo, 'dia', 'dias') : dAlvo === 0 ? 'vence hoje' : 'faltam ' + H.plural(dAlvo, 'dia', 'dias');
    var kpis = '<div class="grid pj-k" style="grid-template-columns:repeat(5,minmax(0,1fr))">' +
      H.kpi('Itens concluídos', r.feitas + ' / ' + r.total, r.total ? r.pct + '% do projeto' : 'nenhum item ligado') +
      H.kpi('Pontos', r.pontosFeitos + ' / ' + r.pontos, r.semPonto ? H.plural(r.semPonto, 'item sem pontuação', 'itens sem pontuação') : 'todos pontuados no Poker') +
      H.kpi('Em validação', '<span style="color:' + (r.validando ? 'var(--in-t)' : 'inherit') + '">' + r.validando + '</span>', r.validando ? 'aguardando o PM/PO' : 'nada esperando validação') +
      H.kpi('Atrasados', '<span style="color:' + (r.atrasadas ? 'var(--dg-t)' : 'inherit') + '">' + r.atrasadas + '</span>', r.atrasadas ? 'prazo vencido' : 'nenhum com prazo vencido', r.atrasadas ? 'dg' : '') +
      H.kpi('Data alvo', '<span style="font-size:22px">' + (p.fim ? H.dma(p.fim) : '—') + '</span>', '<span style="color:' + (l.alvoVencido ? 'var(--dg-t)' : 'inherit') + '">' + notaAlvo + '</span>', l.alvoVencido ? 'dg' : '') +
      '</div>';

    // Linha do tempo das entregas, por sistema.
    var tl = htmlLinhaProjeto(p, l);

    // Coluna da direita: descricao, progresso por etapa, entregas.
    var desc = '<section class="pn"><span class="lab">DESCRIÇÃO</span>' + (p.descricao
      ? '<span style="font-size:13.5px;line-height:21px;color:var(--tx2);overflow-wrap:anywhere;white-space:pre-wrap">' + esc(String(p.descricao).trim()) + '</span>'
      : '<span class="note">Sem descrição registrada no RoadMap.</span>') + '</section>';
    var cont = {};
    l.ms.forEach(function (m) { var c = H.colunaDe(m); cont[c] = (cont[c] || 0) + 1; });
    var etapas = H.ETAPAS.filter(function (e) { return cont[e.id]; });
    var prog = '<section class="pn" style="gap:10px"><span class="lab">PROGRESSO POR ETAPA</span>' + (etapas.length
      ? '<div class="pj-stk" role="img" aria-label="Itens por etapa">' + etapas.map(function (e) {
          return '<i style="width:' + (cont[e.id] / l.ms.length * 100).toFixed(2) + '%;background:' + e.dot + '" title="' + esc(e.rotulo) + ': ' + cont[e.id] + '"></i>';
        }).join('') + '</div>' + etapas.map(function (e) {
          return '<div class="pj-etp"><span class="dotc" style="background:' + e.dot + '"></span><span>' + esc(e.rotulo) + '</span><b>' + cont[e.id] + '</b><span>' + Math.round(cont[e.id] / l.ms.length * 100) + '%</span></div>';
        }).join('') + (r.atrasadas ? '<span class="note pj-dg" style="color:var(--dg-t)">' + H.plural(r.atrasadas, 'item está atrasado', 'itens estão atrasados') + ' (contados na etapa em que estão).</span>' : '')
      : '<span class="note">Nenhum item ligado a este projeto.</span>') + '</section>';
    var ent = '<section class="pn" style="gap:8px"><span class="lab">ENTREGAS</span>' + marcos(p, l, 6) + '</section>';

    var meio = '<div class="grid" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);align-items:start">' +
      '<div style="display:flex;flex-direction:column;gap:16px;min-width:0">' + tl + ent + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:16px;min-width:0">' + desc + prog + '</div></div>' + htmlItens(l, dev);

    // Resumo pronto: o MESMO texto do botao "Copiar" do resumo executivo do admin.
    var txt = raiz.RESUMOPROJETO ? raiz.RESUMOPROJETO.texto(r) : '';
    var res = '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><div style="display:flex;flex-direction:column;gap:2px"><h2 class="h2">Resumo executivo</h2>' +
      '<span class="note">O texto que vai para o grupo do comitê. É o mesmo do resumo executivo do admin.</span></div>' +
      '<button type="button" class="btn" data-pj-copiar>' + ico('clipboard') + ' Copiar</button></div>' +
      '<pre class="pj-res" id="pj-res-txt">' + esc(txt) + '</pre></section>';

    return cab + kpis + meio + res;
  }

  function htmlLinhaProjeto(p, l) {
    var sis = sistemas(l);
    // Datas de cada item: inicio (ou o proprio prazo) ate o prazo efetivo do PRAZO.
    var datas = [];
    if (H.ehISO(p.inicio)) datas.push(p.inicio.slice(0, 10));
    if (H.ehISO(p.fim)) datas.push(p.fim.slice(0, 10));
    var semData = 0;
    sis.forEach(function (s) {
      s.pts = s.ms.map(function (m) {
        var pz = H.prazoDe(m), ini = H.ehISO(m.inicio) ? String(m.inicio).slice(0, 10) : '';
        pz = H.ehISO(pz) ? String(pz).slice(0, 10) : '';
        if (!pz && !ini) { semData++; return null; }
        if (pz) datas.push(pz); if (ini) datas.push(ini);
        return { m: m, ini: ini || pz, fim: pz || ini };
      }).filter(Boolean);
    });
    var cab = '<div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2">Linha do tempo das entregas</h2>';
    if (!datas.length) return '<section class="pn">' + cab + '</div>' + H.vazio('calendar', 'Sem datas para desenhar', 'Nem o projeto nem os itens têm início ou prazo.') + '</section>';
    datas.sort();
    var J = janela(H.data(datas[0]), H.data(datas[datas.length - 1]));
    var nomeMes = function (d) { return H.MESES_C[d.getMonth()] + '/' + String(d.getFullYear()).slice(2); };
    cab += '<span class="note">' + nomeMes(J.ini) + ' → ' + nomeMes(new Date(J.fim - 1)) + '</span></div>';
    var alvo = H.ehISO(p.fim) ? '<span class="tl-alvo" style="left:' + posFim(J, p.fim).toFixed(3) + '%" title="Data alvo do projeto: ' + H.dma(p.fim) + '"></span>' : '';
    var COR = function (m) {
      var c = H.colunaDe(m);
      if (c === 'concluido') return 'var(--ok)';
      if (H.etapaDe(m) === 'atrasado') return 'var(--dg)';
      if (c === 'negada') return 'var(--tx4)';
      return FAZENDO[c] ? 'var(--ac)' : 'var(--in)';
    };
    var linhas = sis.filter(function (s) { return s.pts.length; }).map(function (s) {
      var ini = s.pts.reduce(function (a, x) { return x.ini < a ? x.ini : a; }, s.pts[0].ini);
      var fim = s.pts.reduce(function (a, x) { return x.fim > a ? x.fim : a; }, s.pts[0].fim);
      var pf = s.total ? s.feitas / s.total * 100 : 0;
      var dots = s.pts.map(function (x) {
        return '<span class="tl-dot" style="left:' + posIso(J, x.fim).toFixed(3) + '%;background:' + COR(x.m) + '" title="' +
          esc((x.m.codigo || '') + ' · ' + (x.m.titulo || '') + ' · prazo ' + H.dm(x.fim)) + '"></span>';
      }).join('');
      return '<div class="tl-row sm"><span class="tl-lb" style="padding:8px 12px 8px 0"><span class="ell" style="font-size:12.5px;font-weight:700" title="' + esc(s.nome) + '">' + esc(s.nome) + '</span>' +
        '<span class="note" style="font-size:11.5px">' + s.feitas + ' de ' + H.plural(s.total, 'item', 'itens') + '</span></span>' +
        '<span class="tl-trk">' + trilhaFundo(J, true) + alvo + trilhaBarra(J, ini, fim, { pct: pf, cor: 'rgba(var(--ok-rgb),.55)', titulo: s.nome + ': ' + H.dma(ini) + ' a ' + H.dma(fim) }) + dots + '</span></div>';
    }).join('');
    var leg = '<span class="pj-leg"><span><i style="background:var(--ok)"></i>concluído</span><span><i style="background:var(--ac)"></i>em andamento</span>' +
      '<span><i style="background:var(--in)"></i>a fazer</span><span><i style="background:var(--dg)"></i>atrasado</span>' +
      (alvo ? '<span><i style="background:transparent;border-left:2px dashed rgba(var(--dg-rgb),.7);border-radius:0;width:0;height:12px"></i>data alvo</span>' : '') + '</span>';
    return '<section class="pn">' + cab +
      (linhas ? '<div class="tl-wrap"><div class="tl cmp" style="--tl-lab:200px;--tl-h:46px">' + trilhaCab(J, 'SISTEMA').replace('padding:12px 16px', 'padding:12px 0') + linhas + '</div></div>'
        : '<span class="note">Nenhum item com data.</span>') +
      '<div class="row" style="justify-content:space-between;flex-wrap:wrap">' + leg +
      (semData ? '<span class="note">' + H.plural(semData, 'item sem início nem prazo', 'itens sem início nem prazo') + ' fora do desenho.</span>' : '') + '</div></section>';
  }

  /* PRAZO DA LINHA. Para quem ainda corre, o H.prazoTxt de sempre. Depois que
     o dev entregou, o PRAZO.diasDeAtraso congela o atraso na data da entrega —
     e o prazoTxt mostraria "atrasada 1d" num item que o KPI (ETAPA.efetiva,
     que so olha etapas que correm) nao conta como atrasado. Na mesma tela, as
     duas leituras se contradiriam; aqui a linha diz o que aconteceu. */
  function prazoCelula(m) {
    var c = H.colunaDe(m);
    if (c !== 'concluido' && c !== 'validacao' && c !== 'validacao_area') return H.prazoTxt(m);
    var a = H.atrasoDe(m);
    var quando = c === 'concluido' ? (m.concluido_em || m.entregue_em) : m.entregue_em;
    var txt = (c === 'concluido' ? 'concluído' : 'entregue') + (H.ehISO(quando) ? ' ' + H.dm(quando) : '');
    if (a && a > 0) return { txt: txt + ' · ' + a + 'd após o prazo', cor: 'var(--wn-t)' };
    return { txt: txt, cor: c === 'concluido' ? 'var(--ok-t)' : 'var(--tx2)' };
  }

  function htmlItens(l, dev) {
    var ms = l.ms.slice();
    var abertos = function (m) { var c = H.colunaDe(m); return c !== 'concluido' && c !== 'negada'; };
    var atras = function (m) { return H.etapaDe(m) === 'atrasado' && H.colunaDe(m) !== 'concluido'; };
    var FILT = [
      ['todos', 'Todos', function () { return true; }],
      ['abertos', 'Em aberto', abertos],
      ['atrasados', 'Atrasados', atras],
      ['concluidos', 'Concluídos', function (m) { return H.colunaDe(m) === 'concluido'; }]
    ];
    if (dev) FILT.push(['meus', 'Meus', H.minha]);
    var f = FILT.find(function (x) { return x[0] === FD.filtro; }) || FILT[0];
    var lista = ms.filter(f[2]).sort(function (a, b) {
      var aa = atras(a) ? 0 : 1, ab = atras(b) ? 0 : 1;
      if (aa !== ab) return aa - ab;
      var oa = ORDEM_ITEM[H.colunaDe(a)] || 7, ob = ORDEM_ITEM[H.colunaDe(b)] || 7;
      if (oa !== ob) return oa - ob;
      var pa = H.prazoDe(a) || '9999', pb = H.prazoDe(b) || '9999';
      return pa < pb ? -1 : pa > pb ? 1 : String(a.codigo || '').localeCompare(String(b.codigo || ''), 'pt-BR', { numeric: true });
    });
    var pags = Math.max(1, Math.ceil(lista.length / POR_PAG));
    if (FD.pag >= pags) FD.pag = pags - 1;
    var pg = lista.slice(FD.pag * POR_PAG, FD.pag * POR_PAG + POR_PAG);
    var btns = FILT.map(function (x) {
      var n = ms.filter(x[2]).length;
      return '<button type="button" class="btns' + (x[0] === f[0] ? ' on' : '') + '" data-pj-if="' + x[0] + '" aria-pressed="' + (x[0] === f[0]) + '">' + x[1] + ' ' + n + '</button>';
    }).join('');
    var corpo = !ms.length ? H.vazio('inbox', 'Nenhum item ligado a este projeto', 'O vínculo é feito no editor da demanda ou na aba Projetos do admin.')
      : !lista.length ? '<span class="note">Nenhum item neste filtro.</span>'
      : '<table class="tbl"><thead><tr><th>ITEM</th><th>TÍTULO</th><th>ETAPA</th><th>DEV</th><th class="num">PTS</th><th>PRAZO</th></tr></thead><tbody>' +
        pg.map(function (m) {
          var pz = prazoCelula(m), devs = H.devsDe(m), pts = H.pontosDe(m);
          return '<tr class="click' + (dev && H.minha(m) ? ' minha' : '') + '" data-href="' + esc(H.hrefItem(m)) + '" tabindex="0">' +
            '<td style="white-space:nowrap">' + H.cod(m) + '</td>' +
            '<td style="max-width:460px"><a href="' + H.hrefItem(m) + '" class="ell" style="display:block;color:var(--tx);font-weight:700;text-decoration:none" title="' + esc(m.titulo) + '">' + esc(m.titulo || '(sem título)') + '</a>' +
            '<span class="ell" style="display:block;font-size:11.5px;color:var(--tx3)">' + esc(H.caminho(m.tema_id) || 'sem sistema') + '</span></td>' +
            '<td>' + H.chipEtapa(m) + '</td>' +
            '<td><span class="row" style="gap:6px">' + (devs.length ? devs.slice(0, 2).map(function (d) { return H.av(d, 22); }).join('') + '<span class="ell" style="max-width:120px;font-size:12.5px">' + esc(devs[0]) + (devs.length > 1 ? ' +' + (devs.length - 1) : '') + '</span>' : '<span style="color:var(--tx4)">—</span>') + '</span></td>' +
            '<td class="num">' + (pts ? pts : '<span style="color:var(--tx4)">—</span>') + '</td>' +
            '<td style="white-space:nowrap;color:' + pz.cor + '">' + esc(pz.txt) + '</td></tr>';
        }).join('') + '</tbody></table>';
    var pager = lista.length > POR_PAG
      ? '<div class="pj-pager"><span>' + (FD.pag * POR_PAG + 1) + '–' + Math.min(lista.length, (FD.pag + 1) * POR_PAG) + ' de ' + lista.length + '</span>' +
        '<button type="button" class="btns" data-pj-pag="-1"' + (FD.pag ? '' : ' disabled') + ' aria-label="Página anterior">‹</button>' +
        '<button type="button" class="btns" data-pj-pag="1"' + (FD.pag < pags - 1 ? '' : ' disabled') + ' aria-label="Próxima página">›</button></div>'
      : '';
    return '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2">Itens do projeto</h2>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap">' + btns + '</div></div>' + corpo + pager + '</section>';
  }

  // ── Eventos (delegados na vista: o render troca o miolo, o ouvinte fica) ─
  function copiar(texto) {
    var ok = function () { H.toast('Resumo copiado.'); };
    var falha = function () {
      var el = document.getElementById('pj-res-txt');
      if (el && window.getSelection) {
        var rg = document.createRange(); rg.selectNodeContents(el);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(rg);
        try { if (document.execCommand('copy')) { ok(); return; } } catch (_) {}
      }
      H.toast('Não consegui copiar. O texto ficou selecionado.', 'erro');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(ok, falha); else falha();
  }

  function ligar(el, ctx, desenha) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pj-st],[data-pj-rst],[data-pj-jan],[data-pj-meus],[data-pj-if],[data-pj-pag],[data-pj-copiar]');
      if (b) {
        if (b.hasAttribute('data-pj-st')) F.status = b.getAttribute('data-pj-st');
        else if (b.hasAttribute('data-pj-rst')) F.rmStatus = b.getAttribute('data-pj-rst');
        else if (b.hasAttribute('data-pj-jan')) F.janela = b.getAttribute('data-pj-jan');
        else if (b.hasAttribute('data-pj-meus')) F.meus = !F.meus;
        else if (b.hasAttribute('data-pj-if')) { FD.filtro = b.getAttribute('data-pj-if'); FD.pag = 0; }
        else if (b.hasAttribute('data-pj-pag')) FD.pag = Math.max(0, FD.pag + Number(b.getAttribute('data-pj-pag')));
        else if (b.hasAttribute('data-pj-copiar')) {
          var p = acharProjeto(ctx.D, ctx.param);
          var r = p && resumo(ctx.D, p.id);
          if (r && raiz.RESUMOPROJETO) copiar(raiz.RESUMOPROJETO.texto(r));
          return;
        }
        desenha();
        return;
      }
      var tr = e.target.closest('[data-href]');
      if (tr && !e.target.closest('a,button,select')) location.hash = tr.getAttribute('data-href');
    });
    el.addEventListener('keydown', function (e) {
      var tr = e.target.closest && e.target.closest('tr[data-href]');
      if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); location.hash = tr.getAttribute('data-href'); }
    });
    el.addEventListener('change', function (e) {
      if (e.target.matches('[data-pj-resp]')) { F.resp = e.target.value; desenha(); }
    });
  }

  garanteCss();

  AX.tela({
    id: 'projetos', rotulo: 'Projetos', ico: 'package', papeis: ['admin', 'dev', 'consulta'],
    abas: [{ id: 'lista', rotulo: 'Projetos' }, { id: 'roadmap', rotulo: 'Roadmap' }],
    titulo: function (r) { return r.aba === 'roadmap' ? 'Roadmap' : 'Projetos'; },
    render: function (el, ctx) {
      garanteCss();
      return '<div class="view">' + (ctx.aba === 'roadmap' ? htmlRoadmap(ctx) : htmlLista(ctx)) + '</div>';
    },
    depois: function (el, ctx) {
      ligar(el, ctx, function () {
        el.innerHTML = '<div class="view">' + (ctx.aba === 'roadmap' ? htmlRoadmap(ctx) : htmlLista(ctx)) + '</div>';
      });
    }
  });

  AX.tela({
    id: 'projeto', rotulo: 'Projeto', ico: 'package', papeis: ['admin', 'dev', 'consulta'], param: true, menu: false,
    titulo: function (r) { return (r.param || 'Projeto') + ' · Projeto'; },
    render: function (el, ctx) {
      garanteCss();
      return '<div class="view">' + htmlProjeto(ctx) + '</div>';
    },
    depois: function (el, ctx) {
      ligar(el, ctx, function () {
        var y = window.scrollY;
        el.innerHTML = '<div class="view">' + htmlProjeto(ctx) + '</div>';
        window.scrollTo(0, y);
      });
    }
  });
})();
