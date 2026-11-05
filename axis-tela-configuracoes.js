/* ─────────────────────────────────────────────────────────────────────────
   AXIS — Configuracoes (so admin). Prototipo: Configuracoes.dc.html.

   A NAVEGACAO E VERTICAL, como no prototipo (.cfg + .tabs.vert com grupos).
   As secoes estao registradas em `abas` para o nucleo resolver a rota
   (#configuracoes/pessoas) e cair na primeira quando ela vier vazia ou torta;
   `abasDe` devolve [] para o nucleo NAO desenhar a regua horizontal — quem
   desenha a navegacao e esta tela, com os grupos do prototipo.

   QUATRO SECOES TEM DADO REAL NO ROADMAP: Catalogo de sistemas (a arvore de
   temas), Pessoas e perfis (contas + lista de devs), Sprint e calendario e
   Aparencia. As outras do prototipo (Empresa e marca, Modulos, Fluxos, SLA,
   API, Widget, Auditoria) continuam VISIVEIS no menu, marcadas, e abrem um
   estado honesto: o que o AXIS completo traz e o que o RoadMap faz hoje no
   lugar. Esconder daria a impressao de que a tela esta pronta; inventar
   numero daria a impressao de que o dado existe.

   NADA E GRAVADO AQUI. Cada secao leva ao lugar que edita hoje (aba Temas e
   aba Usuarios do admin, Ausencias no Gantt), ja logado.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var raiz = typeof window !== 'undefined' ? window : globalThis;
  if (!raiz.AXIS_APP) return;
  var H = raiz.AXIS_APP.H;
  var esc = H.esc, ico = H.ico;

  // ── Secoes ──────────────────────────────────────────────────────────────
  // `real: false` = existe no prototipo e ainda nao tem dado no RoadMap.
  // "Temas" do prototipo (cadastro) e a mesma lista que o Catalogo mostra —
  // no RoadMap tema E o sistema/modulo — por isso virou uma secao so. O
  // claro/escuro, que no prototipo mora dentro de Empresa e marca, ganhou
  // secao propria (Aparencia): e a parte da marca que ja funciona.
  var GRUPOS = [
    { grp: 'EMPRESA', itens: [
      { id: 'marca', rotulo: 'Empresa e marca', real: false },
      { id: 'aparencia', rotulo: 'Aparência', real: true },
      { id: 'modulos', rotulo: 'Módulos', real: false }
    ] },
    { grp: 'REGRAS', itens: [
      { id: 'fluxos', rotulo: 'Fluxos e etapas', real: false },
      { id: 'sla', rotulo: 'Prioridade e SLA', real: false },
      { id: 'sprint', rotulo: 'Sprint e calendário', real: true }
    ] },
    { grp: 'CADASTROS', itens: [
      { id: 'pessoas', rotulo: 'Pessoas e perfis', real: true },
      { id: 'catalogo', rotulo: 'Catálogo de sistemas', real: true }
    ] },
    { grp: 'INTEGRAÇÕES', itens: [
      // A secao e uma tela propria (axis-tela-api.js): o item leva ate ela.
      { id: 'api', rotulo: 'API e integrações', real: true, href: '#api' },
      { id: 'widget', rotulo: 'Widget', real: false }
    ] },
    { grp: 'SEGURANÇA', itens: [
      { id: 'auditoria', rotulo: 'Auditoria', real: false }
    ] }
  ];
  var TODAS = [];
  GRUPOS.forEach(function (g) { g.itens.forEach(function (i) { TODAS.push(i); }); });
  // A primeira de `abas` e a que abre em #configuracoes: tem de ser uma com dado.
  var ABAS = [{ id: 'catalogo', rotulo: 'Catálogo de sistemas' }].concat(
    TODAS.filter(function (i) { return i.id !== 'catalogo'; }).map(function (i) { return { id: i.id, rotulo: i.rotulo }; }));

  // Estado da tela (filtros, selecao). Vive enquanto a pagina vive.
  var est = { catBusca: '', catSis: '', pesFiltro: 'todos', pesBusca: '', pesSel: '' };
  // Contas: uma leitura por minuto basta — elas mudam pelo admin, nao aqui.
  var contas = { lista: null, erro: '', em: 0, carregando: false };

  function css() {
    if (document.getElementById('css-tela-configuracoes')) return;
    var s = document.createElement('style');
    s.id = 'css-tela-configuracoes';
    s.textContent =
      '.axa .cfg .tabs.vert .tab{display:flex;align-items:center;gap:8px;text-decoration:none}' +
      '.axa .cfg .tabs.vert .tab .pend{margin-left:auto;font-size:11px;color:var(--tx4)}' +
      '.axa .cfg .tabs.vert .tab.fut{color:var(--tx4)}' +
      '.axa .cfg .tabs.vert .tab.fut.on{color:var(--tx2)}' +
      '.axa .cfg-hd{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px}' +
      '.axa .cfg-tt{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1 1 380px;max-width:640px}' +
      '.axa .cfg-lin{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px}' +
      '.axa .cfg-val{height:32px;display:inline-flex;align-items:center;padding:0 12px;border-radius:9px;background:var(--sf3);border:1px solid var(--bd2);color:var(--tx);font-size:12.5px;white-space:nowrap}' +
      '.axa .cfg-sis{cursor:pointer;text-align:left;font:inherit;color:inherit;padding:14px 16px;gap:10px}' +
      '.axa .cfg-sis:hover{border-color:var(--bd4)}' +
      '.axa .cfg-sis.on{border-color:rgba(var(--ac-rgb),.55);box-shadow:inset 0 0 0 1px rgba(var(--ac-rgb),.35)}' +
      '.axa .cfg-ab{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:Montserrat,sans-serif;font-weight:800;font-size:12px;flex-shrink:0}' +
      '.axa .cfg-dot{width:9px;height:9px;border-radius:3px;flex-shrink:0;display:inline-block}' +
      '.axa .cfg-tr td{cursor:pointer}' +
      '.axa .cfg-tr.on{background:rgba(var(--ac-rgb),.08)}' +
      '.axa .cfg-tr:hover{background:var(--sf2)}' +
      '.axa .cfg-sw{width:36px;height:20px;border-radius:10px;position:relative;flex-shrink:0;background:var(--sf4)}' +
      '.axa .cfg-sw.on{background:var(--ac)}' +
      '.axa .cfg-sw::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:8px;background:var(--tx3)}' +
      '.axa .cfg-sw.on::after{left:18px;background:var(--on-ac)}' +
      '.axa .cfg-it{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;background:var(--sf2);font-size:13px}' +
      '.axa .cfg-it.hj{box-shadow:inset 3px 0 0 var(--ac)}' +
      '.axa .cfg-it.pass{opacity:.6}' +
      '.axa .cfg-ton{height:44px;border-radius:10px;border:1px solid var(--bd2)}' +
      '.axa .cfg-q{width:240px;max-width:100%}' +
      '.axa .cfg-rec{display:inline-block;width:0}';
    document.head.appendChild(s);
  }

  // ── Pedacos ────────────────────────────────────────────────────────────
  var CORES = ['ac', 'in', 'ok', 'pu', 'tl', 'wn', 'dg'];
  function cab(titulo, sub, acoes) {
    return '<header class="cfg-hd"><div class="cfg-tt"><h1 class="h1">' + esc(titulo) + '</h1>' +
      (sub ? '<span class="sub">' + sub + '</span>' : '') + '</div>' +
      (acoes ? '<div class="row" style="flex-wrap:wrap;justify-content:flex-end">' + acoes + '</div>' : '') + '</header>';
  }
  function linha(rot, val) {
    return '<div class="cfg-lin"><span>' + rot + '</span><span class="cfg-val">' + val + '</span></div>';
  }
  function info(txt) {
    return '<div class="lock" style="background:rgba(var(--in-rgb),.08);border-color:rgba(var(--in-rgb),.3);color:var(--in-t)">' +
      '<span>' + ico('info') + '</span><span>' + txt + '</span></div>';
  }
  function linkExt(href, rot, cls, titulo) {
    return '<a class="' + (cls || 'btn') + '" href="' + href + '" title="' + esc(titulo || '') + '">' + esc(rot) + ' ' +
      ico('external', 'style="font-size:12px;opacity:.7"') + '</a>';
  }
  function norm(s) {
    return raiz.DEVNOME ? raiz.DEVNOME.norm(s) : String(s || '').toLowerCase().trim();
  }
  function aberta(m) {
    var c = H.colunaDe(m);
    return c !== 'concluido' && c !== 'negada';
  }

  // ── Navegacao vertical ─────────────────────────────────────────────────
  function nav(aba) {
    var h = '<nav class="tabs vert" aria-label="Seções das configurações">';
    GRUPOS.forEach(function (g) {
      h += '<span class="grp">' + esc(g.grp) + '</span>';
      g.itens.forEach(function (i) {
        var on = i.id === aba;
        h += '<a href="' + (i.href || '#configuracoes/' + i.id) + '" class="tab' + (on ? ' on' : '') + (i.real ? '' : ' fut') + '"' +
          (on ? ' aria-current="page"' : '') + (i.real ? '' : ' title="Chega com o AXIS completo"') + '>' +
          esc(i.rotulo) + (i.real ? '' : '<span class="pend">' + ico('lock') + '</span>') + '</a>';
      });
    });
    return h + '</nav>';
  }

  // ════════════════════════════════════════════════════════════════════════
  // CATALOGO DE SISTEMAS — a arvore de temas
  // ════════════════════════════════════════════════════════════════════════
  /* O NOME E O CAMINHO (catalogo.js): "AXCred - Cadastro - Reanalise". A
     ordem e o agrupamento vem do catalogo (`catalogoOrdena`, `catalogoSistema`,
     `catalogoForaDoPadrao`), e nao de uma segunda regra aqui. As contagens sao as do
     admin (aba Temas): demandas com `tema_id` igual ao do tema — so que sobre
     as visiveis (sem oculta e sem mesclada), como o resto do app novo. */
  function dadosCatalogo(D) {
    var ordena = raiz.catalogoOrdena || function (l) { return l.slice(); };
    var sisDe = raiz.catalogoSistema || function (n) { return String(n || '').split(' - ')[0]; };
    var temas = ordena((D.temas || []).filter(function (t) { return t && t.nome; }));
    var porTema = {};
    H.visiveis().forEach(function (m) {
      var k = String(m.tema_id || '');
      var c = porTema[k] || (porTema[k] = { total: 0, abertas: 0, andamento: 0 });
      c.total++;
      if (aberta(m)) c.abertas++;
      if (H.colunaDe(m) === 'em_andamento') c.andamento++;
    });
    var sistemas = [], porSis = {};
    temas.forEach(function (t) {
      var s = sisDe(t.nome);
      var k = norm(s);
      if (!porSis[k]) { porSis[k] = { nome: s, temas: [], total: 0, abertas: 0, andamento: 0 }; sistemas.push(porSis[k]); }
      var c = porTema[String(t.id)] || { total: 0, abertas: 0, andamento: 0 };
      porSis[k].temas.push(t);
      porSis[k].total += c.total; porSis[k].abertas += c.abertas; porSis[k].andamento += c.andamento;
    });
    sistemas.forEach(function (s, i) { s.cor = CORES[i % CORES.length]; s.k = norm(s.nome); });
    var semTema = H.visiveis().filter(function (m) {
      return !m.tema_id || !temas.some(function (t) { return String(t.id) === String(m.tema_id); });
    });
    var torto = {};
    (raiz.catalogoForaDoPadrao ? raiz.catalogoForaDoPadrao(temas) : []).forEach(function (a) {
      if (a && a.de) torto[String(a.de.id)] = a.motivo;
    });
    return { temas: temas, porTema: porTema, sistemas: sistemas, porSis: porSis, semTema: semTema, torto: torto };
  }

  function sigla(nome) {
    var p = String(nome || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[1][0]).toUpperCase();
  }

  function cartaoSistema(s) {
    var on = est.catSis === s.k;
    return '<button type="button" class="pn cfg-sis' + (on ? ' on' : '') + '" data-cfg-sis="' + esc(s.k) + '" aria-pressed="' + on + '">' +
      '<span class="row" style="justify-content:space-between;width:100%"><span class="row" style="min-width:0">' +
      '<span class="cfg-ab" style="background:rgba(var(--' + s.cor + '-rgb),.18);color:var(--' + s.cor + '-t)">' + esc(sigla(s.nome)) + '</span>' +
      '<b class="ell" style="font-size:14.5px" title="' + esc(s.nome) + '">' + esc(s.nome) + '</b></span></span>' +
      '<span style="display:flex;flex-direction:column;gap:5px;font-size:12.5px;color:var(--tx2);width:100%">' +
      '<span class="row" style="justify-content:space-between"><span class="note">Demandas abertas</span><span class="mono">' + s.abertas + '</span></span>' +
      '<span class="row" style="justify-content:space-between"><span class="note">Em andamento</span><span class="mono">' + s.andamento + '</span></span>' +
      '<span class="row" style="justify-content:space-between"><span class="note">Total de demandas</span><span class="mono">' + s.total + '</span></span>' +
      '<span class="row" style="justify-content:space-between"><span class="note">Temas</span><span class="mono">' + s.temas.length + '</span></span>' +
      '</span></button>';
  }

  /* A ARVORE NA TABELA. Cada sistema abre com uma linha propria (a soma dos
     modulos), mesmo quando o tema-raiz nao existe na base — e o caso comum:
     ninguem cadastra "AXCred" sozinho, so "AXCred - Operacoes". Modulo cujo pai
     tambem nao existe ("AXCred - Cadastro - Analise de Credito" sem "AXCred -
     Cadastro") mostra o caminho desde o ancestral que existe, para a folha nao
     aparecer solta num nivel que a tabela nao desenhou. */
  function linhasTemas(c) {
    var q = norm(est.catBusca);
    var partes = function (n) { return String(n || '').split(' - ').map(function (x) { return x.trim(); }).filter(Boolean); };
    var completo = raiz.catalogoCompleto || function (n) { return partes(n).join(' › '); };
    var celulas = function (cont, nivelTxt) {
      return '<td class="mono"' + (cont.total ? '' : ' style="color:var(--tx4)"') + '>' + cont.total + '</td>' +
        '<td class="mono"' + (cont.abertas ? ' style="color:var(--tx)"' : ' style="color:var(--tx4)"') + '>' + cont.abertas + '</td>' +
        '<td class="note" style="white-space:nowrap">' + nivelTxt + '</td>';
    };
    var tortoChip = function (t) {
      var m = c.torto[String(t.id)];
      return m ? ' ' + H.chip(ico('alert') + ' fora do padrão', 'wn', m) : '';
    };
    var sistemas = c.sistemas.filter(function (s) { return !est.catSis || s.k === est.catSis; });
    var out = [];
    if (q) {
      sistemas.forEach(function (s) {
        s.temas.forEach(function (t) {
          if (norm(t.nome).indexOf(q) < 0) return;
          var cont = c.porTema[String(t.id)] || { total: 0, abertas: 0 };
          out.push('<tr><td style="color:var(--tx);font-weight:600"><span class="row" style="gap:8px"><span class="cfg-dot" style="background:var(--' + s.cor + ')"></span>' +
            '<span style="min-width:0">' + esc(completo(t.nome)) + '</span>' + tortoChip(t) + '</span></td>' +
            celulas(cont, partes(t.nome).length > 1 ? 'módulo' : 'sistema') + '</tr>');
        });
      });
    } else {
      sistemas.forEach(function (s) {
        var so = s.temas.length === 1 && partes(s.temas[0].nome).length === 1;
        out.push('<tr><td style="color:var(--tx);font-weight:800"><span class="row" style="gap:8px"><span class="cfg-dot" style="background:var(--' + s.cor + ')"></span>' +
          esc(s.nome) + (so ? tortoChip(s.temas[0]) : '') + '</span></td>' +
          celulas({ total: s.total, abertas: s.abertas }, so ? 'sistema' : 'sistema · ' + H.plural(s.temas.length, 'tema', 'temas')) + '</tr>');
        if (so) return;
        var nomes = {};
        s.temas.forEach(function (t) { nomes[norm(t.nome)] = true; });
        s.temas.forEach(function (t) {
          var p = partes(t.nome);
          var cont = c.porTema[String(t.id)] || { total: 0, abertas: 0 };
          var rot, recuo;
          if (p.length === 1) { rot = '<i style="color:var(--tx3)">sem módulo</i>'; recuo = 1; }
          else {
            var anc = 0;
            for (var i = p.length - 1; i >= 2; i--) { if (nomes[norm(p.slice(0, i).join(' - '))]) { anc = i - 1; break; } }
            rot = esc(p.slice(anc + 1).join(' › '));
            recuo = anc + 1;
          }
          out.push('<tr title="' + esc(completo(t.nome)) + '"><td><span class="row" style="gap:6px;padding-left:' + (recuo * 18 - 4) + 'px">' +
            '<span style="color:var(--tx4)">└</span><span style="min-width:0;color:var(--tx2)">' + rot + '</span>' + tortoChip(t) + '</span></td>' +
            celulas(cont, 'módulo · nível ' + (p.length - 1)) + '</tr>');
        });
      });
    }
    if (!out.length) {
      return '<tr><td colspan="4">' + H.vazio('search', 'Nenhum tema encontrado', est.catBusca ? 'Nada casa com "' + est.catBusca + '".' : 'Este sistema ainda não tem tema.') + '</td></tr>';
    }
    return out.join('');
  }

  function secCatalogo(ctx) {
    var c = dadosCatalogo(ctx.D);
    var abertasTot = c.sistemas.reduce(function (t, s) { return t + s.abertas; }, 0);
    var nTorto = Object.keys(c.torto).length;
    var acoes = H.pode('editar') ? H.linkAdmin('temas', 'Editar temas', 'btnp') : '';
    var h = cab('Catálogo de sistemas',
      'Sistemas e módulos usados para classificar as demandas. O nome do tema é o caminho (“AXCred - Cadastro - Reanálise”): a árvore sai dele, sem campo à parte. ' +
      esc(H.plural(c.sistemas.length, 'sistema', 'sistemas')) + ' · ' + esc(H.plural(c.temas.length, 'tema', 'temas')) + ' · ' + esc(H.plural(abertasTot, 'demanda aberta', 'demandas abertas')) + '.',
      acoes);
    if (!c.temas.length) return h + H.vazio('folder', 'Nenhum tema cadastrado', 'Os temas são criados na aba Temas do admin.');
    h += '<div class="grid" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">' + c.sistemas.map(cartaoSistema).join('') + '</div>';
    var avisos = '';
    if (nTorto) avisos += '<div class="lock"><span>' + ico('alert') + '</span><span><b>' + H.plural(nTorto, 'tema fora do padrão', 'temas fora do padrão') +
      '.</b> Nome fora do padrão quebra o filtro por sistema: quem filtra por um não vê o outro. A junção é feita na aba Temas do admin.</span></div>';
    if (c.semTema.length) avisos += info(H.plural(c.semTema.length, 'demanda visível está', 'demandas visíveis estão') + ' sem tema (ou com tema apagado) e não entram na contagem acima.');
    h += avisos;
    var sisSel = est.catSis && c.sistemas.filter(function (s) { return s.k === est.catSis; })[0];
    h += '<section class="pn" style="padding:16px 14px 8px">' +
      '<div class="row" style="justify-content:space-between;flex-wrap:wrap;padding:0 6px"><h2 class="h2">' +
      (sisSel ? 'Temas de ' + esc(sisSel.nome) : 'Todos os temas') + '</h2>' +
      '<span class="row" style="gap:8px">' + (sisSel ? '<button type="button" class="btns" data-cfg-sis="">Todos os sistemas</button>' : '') +
      '<input class="in cfg-q" id="cfg-cat-q" type="search" placeholder="Buscar tema ou sistema" value="' + esc(est.catBusca) + '" aria-label="Buscar tema ou sistema"></span></div>' +
      '<table class="tbl"><thead><tr><th>TEMA</th><th>DEMANDAS</th><th>ABERTAS</th><th>NÍVEL</th></tr></thead>' +
      '<tbody id="cfg-cat-linhas">' + linhasTemas(c) + '</tbody></table>' +
      '<span class="note" style="padding:4px 6px 8px">As contagens são do próprio tema; a linha e o cartão do sistema somam todos os módulos dele. Aberta = fora de Concluído e de Negada.</span></section>';
    return h;
  }

  // ════════════════════════════════════════════════════════════════════════
  // PESSOAS E PERFIS — contas (rota `usuarios`) + lista de devs da base
  // ════════════════════════════════════════════════════════════════════════
  var PAPEL = {
    admin: { rot: 'Admin', cor: 'ac' }, analista: { rot: 'Analista de Requisitos', cor: 'pu' },
    dev: { rot: 'Dev', cor: 'in' }, consulta: { rot: 'Consulta', cor: 'tl' }, semconta: { rot: 'Sem conta', cor: 'bk' }
  };

  /* Os nomes de dev que aparecem nas demandas. COPIA de `uDevsDosCards`
     (admin.html, aba Usuarios): o campo aceita "Ana / Bruno", "Ana e Bruno". */
  function devsDosCards(D) {
    var vistos = {};
    (D.melhorias || []).forEach(function (m) {
      String(m.dev || '').split(/\s*(?:,|\/|;|\se\s|&)\s*/i).forEach(function (t) {
        t = t.trim(); if (t) vistos[t] = true;
      });
    });
    return Object.keys(vistos).sort();
  }
  /* O nome pelo qual a conta aparece nas demandas. COPIA de `uNomeDeDev`
     (admin.html): o declarado primeiro, depois o sugerido, depois o nome — o
     primeiro que existir nos cards; se nenhum existir, o primeiro candidato. */
  function nomeDeDev(u, nomesCards) {
    var decl = String(u.nome_demandas || '').split(/[\/,;]/).map(function (x) { return x.trim(); }).filter(Boolean);
    var cand = decl.concat([String(u.nome_sugerido || '').trim(), String(u.nome || '').trim()]).filter(Boolean);
    var achado = cand.filter(function (c) { return nomesCards.some(function (n) { return norm(n) === norm(c); }); })[0];
    return achado || cand[0] || '';
  }
  /* Quem conta na capacidade: a lista de devs sem quem saiu. COPIA de
     `capDevsAtivos` (gantt.html). */
  function devsAtivos(D) {
    var fora = {};
    (D.devs_removidos || []).concat(D.devs_inativos || []).forEach(function (n) { fora[String(n).trim().toLowerCase()] = true; });
    return (D.desenvolvedores || []).filter(function (n) { return !fora[String(n).trim().toLowerCase()]; });
  }
  /* A frente como o admin mostra: o cadastro vence; sem cadastro, a semente de
     `pipelines.js` aparece como "(por padrao)", para nao confundir o que alguem
     marcou com o que o sistema deduziu (ver `uCelulaPipeline` no admin). */
  function frenteDe(nome, D) {
    var P = raiz.PIPELINES;
    if (!P || !nome) return { txt: '', padrao: false };
    var perf = (D.devs_perfil || {})[nome];
    var cad = P.canonica(perf && typeof perf === 'object' ? perf.pipeline : '');
    if (cad) return { txt: cad, padrao: false };
    var sem = P.doDev(nome, {});
    return sem ? { txt: sem, padrao: true } : { txt: '', padrao: false };
  }

  function pessoas(D) {
    var cards = devsDosCards(D);
    var ativos = devsAtivos(D);
    var ehAtivo = function (n) { return ativos.some(function (a) { return norm(a) === norm(n); }); };
    var vs = H.visiveis();
    var contaDemandas = function (nomes) {
      var t = 0, a = 0;
      vs.forEach(function (m) {
        var dele = nomes.some(function (n) { return raiz.DEVNOME ? raiz.DEVNOME.eDe(m, n) : H.devsDe(m).indexOf(n) >= 0; });
        if (dele) { t++; if (aberta(m)) a++; }
      });
      return { total: t, abertas: a };
    };
    var out = (contas.lista || []).map(function (u) {
      var nd = nomeDeDev(u, cards);
      var decl = String(u.nome_demandas || '').split(/[\/,;]/).map(function (x) { return x.trim(); }).filter(Boolean);
      var desenvolve = ['dev', 'analista'].indexOf(String(u.papel || '')) >= 0;
      var perf = (D.devs_perfil || {})[nd] || {};
      return {
        chave: 'u:' + u.login, login: u.login, nome: u.nome || u.login, email: u.email || '', papel: u.papel || 'consulta',
        status: u.pendente ? 'pendente' : (u.ativo ? 'ativo' : 'off'), nomeDev: nd, declarado: decl.join(' / '),
        frente: (desenvolve || ehAtivo(nd)) ? frenteDe(nd, D) : { txt: '', padrao: false },
        axcred: !!(perf && perf.axcred), spike: !!u.aprova_spike,
        capacidade: nd && ehAtivo(nd), acesso: u.ultimo_acesso || '', criado: u.criado_em || '',
        dem: contaDemandas(decl.length ? decl : (nd ? [nd] : []))
      };
    });
    // Quem esta na lista de devs (e portanto na capacidade) mas nao tem conta.
    ativos.forEach(function (n) {
      if (out.some(function (p) { return p.nomeDev && norm(p.nomeDev) === norm(n); })) return;
      var perf = (D.devs_perfil || {})[n] || {};
      out.push({ chave: 'd:' + n, login: '', nome: n, email: '', papel: 'semconta', status: 'semconta', nomeDev: n, declarado: n,
        frente: frenteDe(n, D), axcred: !!perf.axcred, spike: false, capacidade: true, acesso: '', criado: '', dem: contaDemandas([n]) });
    });
    var ordemPapel = { admin: 0, analista: 1, dev: 2, consulta: 3, semconta: 4 };
    return out.sort(function (a, b) {
      var oa = (a.status === 'pendente' ? -1 : 0) + (a.status === 'off' ? 10 : 0) + ordemPapel[a.papel];
      var ob = (b.status === 'pendente' ? -1 : 0) + (b.status === 'off' ? 10 : 0) + ordemPapel[b.papel];
      return oa - ob || String(a.nome).localeCompare(String(b.nome), 'pt-BR');
    });
  }

  var FILTROS = [
    { id: 'todos', rot: 'Todos', f: function () { return true; } },
    { id: 'admin', rot: 'Admin', f: function (p) { return p.papel === 'admin' && p.status !== 'off'; } },
    { id: 'analista', rot: 'Analista', f: function (p) { return p.papel === 'analista' && p.status !== 'off'; } },
    { id: 'dev', rot: 'Dev', f: function (p) { return p.papel === 'dev' && p.status !== 'off'; } },
    { id: 'consulta', rot: 'Consulta', f: function (p) { return p.papel === 'consulta' && p.status !== 'off'; } },
    { id: 'semconta', rot: 'Sem conta', f: function (p) { return p.status === 'semconta'; } },
    { id: 'pendente', rot: 'Pendentes', f: function (p) { return p.status === 'pendente'; } },
    { id: 'off', rot: 'Desativados', f: function (p) { return p.status === 'off'; } }
  ];

  function quando(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var dia = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    return H.dma(dia) + ' ' + d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  }

  function chipStatus(p) {
    if (p.status === 'pendente') return H.chip('pendente', 'wn', 'Pediu acesso e aguarda liberação no admin');
    if (p.status === 'off') return H.chip('desativado', 'dg');
    if (p.status === 'semconta') return H.chip('sem conta', 'bk', 'Está na lista de devs da base, mas não tem conta própria');
    return '';
  }

  function chipsPessoas(D) {
    if (!contas.lista) return '';
    var todas = pessoas(D);
    return FILTROS.map(function (f) {
      var n = todas.filter(f.f).length;
      if (!n && f.id !== 'todos' && f.id !== est.pesFiltro) return '';
      return '<button type="button" class="btns' + (f.id === est.pesFiltro ? ' on' : '') + '" data-cfg-pes-f="' + f.id + '">' + esc(f.rot) + ' ' + n + '</button>';
    }).join('');
  }
  // Redesenha so a lista e os filtros: o campo de busca fica com o foco.
  function pintarPessoas(D) {
    var box = document.getElementById('cfg-pes');
    if (box) box.innerHTML = corpoPessoas(D);
    var f = document.getElementById('cfg-pes-f');
    if (f) f.innerHTML = chipsPessoas(D);
  }

  function corpoPessoas(D) {
    if (contas.erro) {
      return H.vazio('alert', 'Não foi possível ler as contas', contas.erro,
        '<button type="button" class="btn" data-cfg-acao="recarregar-contas">Tentar de novo</button>');
    }
    if (!contas.lista) {
      return '<div class="grid" style="grid-template-columns:minmax(0,1fr) 320px;align-items:start">' +
        '<div class="sk" style="height:420px"></div><div class="sk" style="height:420px"></div></div>';
    }
    var todas = pessoas(D);
    var q = norm(est.pesBusca);
    var filtro = FILTROS.filter(function (f) { return f.id === est.pesFiltro; })[0] || FILTROS[0];
    var lista = todas.filter(filtro.f).filter(function (p) {
      return !q || norm([p.nome, p.login, p.email, p.nomeDev].join(' ')).indexOf(q) >= 0;
    });
    var sel = lista.filter(function (p) { return p.chave === est.pesSel; })[0] || lista[0] || null;
    var linhas = lista.length ? lista.map(function (p) {
      var pp = PAPEL[p.papel] || { rot: p.papel, cor: 'bk' };
      return '<tr class="cfg-tr' + (sel && p.chave === sel.chave ? ' on' : '') + '" data-cfg-pes="' + esc(p.chave) + '" tabindex="0">' +
        '<td><span class="row">' + H.av(p.nome) + '<span style="display:flex;flex-direction:column;min-width:0"><b style="font-size:13px;color:var(--tx)">' + esc(p.nome) + '</b>' +
        '<span class="note ell" style="font-size:11.5px">' + esc(p.email || (p.login ? p.login : 'só na lista de devs')) + '</span></span></span></td>' +
        '<td><span class="row" style="gap:6px;flex-wrap:wrap">' + (p.papel === 'semconta' ? '' : H.chip(esc(p.papel === 'analista' ? 'Analista' : pp.rot), pp.cor, pp.rot)) + chipStatus(p) + '</span></td>' +
        '<td>' + (p.frente.txt ? esc(p.frente.txt) + (p.frente.padrao ? ' <span class="note">(por padrão)</span>' : '') : '<span style="color:var(--tx4)">—</span>') +
        (p.axcred ? ' ' + H.chip('DEV-AXCred', 'ac') : '') + '</td>' +
        '<td class="mono" style="white-space:nowrap">' + (p.capacidade ? raiz.SPRINTPO.PONTOS_POR_DEV + ' pts' : '<span style="color:var(--tx4)">—</span>') + '</td>' +
        '<td class="mono" style="white-space:nowrap" title="abertas / total">' + (p.dem.total ? p.dem.abertas + '/' + p.dem.total : '<span style="color:var(--tx4)">0</span>') + '</td></tr>';
    }).join('') : '<tr><td colspan="5">' + H.vazio('users', 'Ninguém neste filtro', q ? 'Nada casa com "' + est.pesBusca + '".' : '') + '</td></tr>';

    return '<div class="grid" style="grid-template-columns:minmax(0,1fr) 290px;align-items:start">' +
      '<section class="pn" style="padding:14px 12px 6px"><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>PESSOA</th><th>PAPEL</th><th>FRENTE</th><th>CAP.</th><th title="Demandas abertas / total">DEM.</th></tr></thead><tbody>' +
      linhas + '</tbody></table></div></section>' + painelPessoa(sel) + '</div>' +
      '<span class="note">Capacidade = ' + raiz.SPRINTPO.PONTOS_POR_DEV + ' pontos por sprint para quem está na lista de devs ativos (a mesma conta do Gantt). Demandas casam pelo “nome nas demandas”.</span>';
  }

  function painelPessoa(p) {
    if (!p) return '<section class="pnh">' + H.vazio('user', 'Escolha uma pessoa', 'Clique numa linha para ver o perfil.') + '</section>';
    var pp = PAPEL[p.papel] || { rot: p.papel };
    var papeis = ['consulta', 'dev', 'analista', 'admin'].map(function (k) {
      var on = k === p.papel;
      return '<span class="chip" style="justify-content:center;height:30px;' + (on
        ? 'background:rgba(var(--ac-rgb),.16);color:var(--ac-t);box-shadow:inset 0 0 0 1px rgba(var(--ac-rgb),.4)'
        : 'background:var(--sf2);color:var(--tx3)') + '">' + esc(k === 'analista' ? 'Analista' : PAPEL[k].rot) + '</span>';
    }).join('');
    var sw = function (rot, on, titulo) {
      return '<div class="cfg-lin" title="' + esc(titulo) + '"><span>' + rot + '</span><span class="cfg-sw' + (on ? ' on' : '') + '" role="img" aria-label="' + (on ? 'sim' : 'não') + '"></span></div>';
    };
    return '<section class="pnh">' +
      '<div class="row">' + H.av(p.nome, 44) + '<span style="display:flex;flex-direction:column;min-width:0"><b style="font-size:15px" class="ell">' + esc(p.nome) + '</b>' +
      '<span class="note ell">' + esc(p.email || p.login || 'sem conta própria') + '</span></span></div>' +
      (p.status !== 'ativo' ? '<div>' + chipStatus(p) + '</div>' : '') +
      (p.papel === 'semconta'
        ? info('Está na lista de devs da base (entra na capacidade e no Gantt), mas não tem login. A conta é criada na aba Usuários do admin.')
        : '<span class="note">Papel</span><div class="grid" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:6px">' + papeis + '</div>') +
      '<span class="note">Frente</span><span class="in">' + (p.frente.txt ? esc(p.frente.txt) + (p.frente.padrao ? '&nbsp;<span class="note">(por padrão)</span>' : '') : '<span style="color:var(--tx4)">— sem frente —</span>') + '</span>' +
      '<span class="note">Pontos por sprint</span><span class="in">' + (p.capacidade ? raiz.SPRINTPO.PONTOS_POR_DEV + ' pts · 1 semana' : '<span style="color:var(--tx4)">não entra na capacidade</span>') + '</span>' +
      '<span class="note">Nome que aparece nas demandas</span><span class="in">' + (p.declarado || p.nomeDev ? esc(p.declarado || p.nomeDev) : '<span style="color:var(--tx4)">— não declarado —</span>') + '</span>' +
      '<span class="note">' + H.plural(p.dem.abertas, 'demanda aberta', 'demandas abertas') + ' · ' + H.plural(p.dem.total, 'no total', 'no total') + '</span>' +
      '<span class="lab" style="margin-top:6px">PERMISSÕES EXTRAS</span>' +
      sw('Aprova spike', p.spike, 'Pode assinar a aprovação de um spike') +
      sw('DEV-AXCred', p.axcred, 'Aparece primeiro no Planejamento') +
      (p.status !== 'semconta' ? '<span class="note" style="font-size:12px">' + (p.acesso ? 'Último acesso em ' + esc(quando(p.acesso)) : '<span style="color:var(--wn-t)">Nunca entrou com a conta</span> (pode estar usando a senha geral)') +
        (p.criado ? ' · conta criada em ' + esc(H.dma(String(p.criado).slice(0, 10))) : '') + '</span>' : '') +
      (H.pode('editar') ? '<div class="row" style="margin-top:6px">' + H.linkAdmin('usuarios', 'Editar no admin', 'btnp').replace('class="btnp"', 'class="btnp" style="flex:1"') + '</div>' : '') +
      '</section>';
  }

  function secPessoas(ctx) {
    var acoes = H.pode('editar') ? H.linkAdmin('usuarios', '+ Criar conta', 'btnp') : '';
    return cab('Pessoas e perfis', 'Contas do RoadMap (login próprio) e a lista de devs da base. Aqui fica a leitura: papel, frente, capacidade e o nome que liga a pessoa às demandas. Mudar é na aba Usuários do admin.', acoes) +
      '<div class="row" style="flex-wrap:wrap;gap:8px"><span id="cfg-pes-f" class="row" style="flex-wrap:wrap;gap:8px;flex:1 1 320px;min-width:0">' + chipsPessoas(ctx.D) + '</span>' +
      '<input class="in cfg-q" id="cfg-pes-q" type="search" placeholder="Buscar pessoa" value="' + esc(est.pesBusca) + '" aria-label="Buscar pessoa"></div>' +
      '<div id="cfg-pes" style="display:flex;flex-direction:column;gap:16px">' + corpoPessoas(ctx.D) + '</div>';
  }

  function carregarContas(forcar) {
    if (contas.carregando) return;
    if (!forcar && contas.lista && Date.now() - contas.em < 60000) return;
    contas.carregando = true; contas.erro = '';
    H.api('usuarios', { op: 'listar' }).then(function (j) {
      contas.lista = j.usuarios || [];
      contas.em = Date.now();
    }).catch(function (e) {
      contas.erro = e.status === 401 || e.status === 403 ? 'Esta sessão não tem permissão para listar contas.' : String(e.message || e);
    }).then(function () {
      contas.carregando = false;
      if (raiz.AXIS_APP.APP.rota.aba === 'pessoas') pintarPessoas(raiz.AXIS_APP.APP.D);
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // SPRINT E CALENDARIO
  // ════════════════════════════════════════════════════════════════════════
  // Tipos de ausencia: COPIA de AUSENCIA_TIPOS (gantt.html), com as cores do AXIS.
  var AUS = {
    ferias: { rot: 'Férias', ico: 'calendar', cor: 'tl' }, atestado: { rot: 'Atestado', ico: 'pulse', cor: 'dg' },
    folga: { rot: 'Folga', ico: 'pause', cor: 'in' }, outro: { rot: 'Outro', ico: 'pin', cor: 'pu' }
  };
  var feriadoISO = function (f) { return (f && typeof f === 'object' ? f.data : f) || ''; };

  function secSprint(ctx) {
    var D = ctx.D, S = raiz.SPRINTPO, P = raiz.PIPELINES;
    var fer = D.feriados || [];
    var hoje = H.hoje();
    var atual = H.sprintAtual();
    var faixa = atual ? S.faixaDaSprint(atual, fer) : null;
    var ano = +hoje.slice(0, 4), mes = +hoje.slice(5, 7);
    var doMes = S.sprintsDoMes(ano, mes, fer);
    var prox = S.proximasSprints ? (S.proximasSprints(hoje, 3, fer) || []).filter(function (x) { return !x.agora; }).slice(0, 3) : [];
    // Duracao e pontos sao codigo (sprint.js): nao ha onde editar. O que se
    // edita hoje e a ausencia, no Gantt; o andamento da sprint mora em Sprints.
    var acoes = '<a class="btn" href="#sprints">' + ico('refresh') + ' Ver sprints</a>' +
      (H.pode('editar') ? linkExt('gantt.html', 'Ausências no Gantt', 'btnp', 'Abre o Gantt; as ausências ficam no botão Ausências') : '');

    // Capacidade nominal por grupo: a MESMA chamada do Gantt (`renderCapSprint`).
    var grupos = S.capacidadePorTrilha(D, atual, {
      devs: devsAtivos(D),
      frenteDoDev: function (n) { return P ? P.doDev(n, D.devs_perfil) : ''; },
      frenteDados: P ? P.FRENTE_DADOS : '', frenteSales: 'Sales Ops',
      semFrente: P ? P.NAO_CLASSIFICADO : 'Desenvolvimento', etapaDe: H.etapaDe
    });
    var capTot = grupos.reduce(function (t, g) { return t + g.capacidade; }, 0);
    var capLinhas = grupos.map(function (g) {
      var h = '<tr><td style="color:var(--tx);font-weight:700">' + esc(g.nome) + '</td><td class="mono" title="' + esc(g.pessoas.join(', ')) + '">' + g.pessoas.length + '</td>' +
        '<td class="mono">' + g.pessoas.length + ' × ' + S.PONTOS_POR_DEV + ' = <b style="color:var(--tx)">' + g.capacidade + '</b> pts</td></tr>';
      if (g.frentes && g.frentes.length > 1) {
        h += g.frentes.map(function (f) {
          return '<tr><td style="padding-left:24px"><span style="color:var(--tx4)">└ </span>' + esc(f.frente) + '</td><td class="mono" title="' + esc(f.pessoas.join(', ')) + '">' + f.pessoas.length + '</td>' +
            '<td class="mono note">' + f.capacidade + ' pts</td></tr>';
        }).join('');
      }
      return h;
    }).join('');

    var anoFer = fer.map(function (f) { return { data: feriadoISO(f), nome: (f && f.nome) || '' }; })
      .filter(function (f) { return f.data.slice(0, 4) === String(ano) || f.data.slice(0, 4) === String(ano + 1) && f.data.slice(5, 7) === '01'; })
      .sort(function (a, b) { return a.data.localeCompare(b.data); });
    var ferPass = anoFer.filter(function (f) { return f.data < hoje; }).length;
    var ferVem = anoFer.filter(function (f) { return f.data >= hoje; });

    var aus = (D.ausencias || []).slice().sort(function (a, b) { return String(a.inicio || '').localeCompare(String(b.inicio || '')); });
    var ausVem = aus.filter(function (a) { return String(a.fim || a.inicio || '') >= hoje; });
    var ausPass = aus.length - ausVem.length;

    var h = cab('Sprint e calendário', 'O ritmo do time: como a sprint é contada, quanto cabe nela e quem está fora. As regras moram em <span class="mono">sprint.js</span> e valem igual no Gantt, no admin, no painel do dev e no Worker.', acoes);
    h += '<div class="grid" style="grid-template-columns:1fr 1fr;align-items:start">';
    // Sprint
    h += '<section class="pn"><h2 class="h2">Sprint</h2><span class="note">Duração</span>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap"><span class="btns on" style="cursor:default">1 semana útil</span>' +
      '<span class="note" style="font-size:12px">segunda a sexta, sem feriado; fixa no código</span></div>' +
      linha('Sprint atual', atual ? '<b class="mono" title="' + esc(atual) + '">' + esc(S.rotuloCurto(atual)) + '</b>' + (faixa ? '&nbsp;· ' + H.dm(faixa.de) + '–' + H.dm(faixa.ate) : '') : '—') +
      linha('Rótulo', '<span class="mono">S&lt;n&gt;-MM-AAAA</span>') +
      linha('Pontos por dev', '<span class="mono">' + S.PONTOS_POR_DEV + '</span>&nbsp;por sprint') +
      linha('Quem põe na sprint', 'PM/PO (o dev abre no backlog)') +
      linha('Contas à parte', S.TRILHAS.map(function (t) { return esc(t.nome); }).join(' · ')) +
      (prox.length ? '<span class="lab" style="margin-top:6px">PRÓXIMAS SPRINTS</span>' + prox.map(function (x) {
        return '<div class="cfg-lin"><span class="mono" title="' + esc(x.rotulo) + '">' + esc(S.rotuloCurto(x.rotulo)) + '</span><span class="note mono">' +
          H.dm(x.de) + ' a ' + H.dm(x.ate) + ' · ' + H.plural(x.dias, 'dia útil', 'dias úteis') + '</span></div>';
      }).join('') : '') +
      '</section>';
    // Capacidade
    h += '<section class="pn"><div class="row" style="justify-content:space-between"><h2 class="h2">Capacidade nominal</h2><span class="note mono">' + capTot + ' pts</span></div>' +
      '<span class="note">Pessoas ativas da lista de devs × ' + S.PONTOS_POR_DEV + ' pontos, por conta (Desenvolvimento aberto por frente). O alocado de cada sprint está em Sprints.</span>' +
      '<table class="tbl"><thead><tr><th>GRUPO</th><th>PESSOAS</th><th>CAPACIDADE</th></tr></thead><tbody>' + capLinhas + '</tbody></table></section>';
    // Calendario
    h += '<section class="pn"><h2 class="h2">Calendário</h2>' +
      linha('Horário útil', 'seg–sex') + linha('Fuso', '<span class="mono">America/Sao_Paulo</span>') +
      '<span class="lab" style="margin-top:6px">SPRINTS DE ' + esc(H.MESES[mes - 1].toUpperCase()) + '</span>' +
      doMes.map(function (s) {
        var hj = s.rotulo === atual, pass = s.ate < hoje;
        return '<div class="cfg-it' + (hj ? ' hj' : '') + (pass && !hj ? ' pass' : '') + '"><span class="mono" style="width:56px;color:var(--tx)">' + esc(S.rotuloCurto(s.rotulo)) + '</span>' +
          '<span style="flex:1" class="note mono">' + H.dm(s.de) + ' a ' + H.dm(s.ate) + '</span><span class="note">' + H.plural(s.dias, 'dia útil', 'dias úteis') + '</span>' +
          (hj ? H.chip('atual', 'ac') : '') + '</div>';
      }).join('') +
      '<span class="lab" style="margin-top:6px">FERIADOS · ' + ano + '</span>' +
      (ferVem.length ? ferVem.map(function (f) {
        return '<div class="cfg-lin"><span>' + (f.nome ? esc(f.nome) : '<span class="note">sem nome</span>') + '</span><span class="mono note">' + H.dma(f.data) + '</span></div>';
      }).join('') : '<span class="note">Nenhum feriado cadastrado daqui para a frente.</span>') +
      (ferPass ? '<span class="note" style="font-size:12px">' + H.plural(ferPass, 'feriado já passou', 'feriados já passaram') + ' em ' + ano + '.</span>' : '') +
      '<span class="note" style="font-size:12px">Os feriados vêm do cadastro da base e são lidos pelo Gantt, pelo admin e pelo Worker. Ainda não há tela para editá-los.</span></section>';
    // Ausencias (no lugar do Plantao do prototipo)
    h += '<section class="pn"><div class="row" style="justify-content:space-between"><h2 class="h2">Ausências</h2>' +
      (H.pode('editar') ? linkExt('gantt.html', 'Gantt', 'btns', 'Abre o Gantt; as ausências ficam no botão Ausências') : '') + '</div>' +
      '<span class="note">Férias, atestados e folgas. Dia ausente sai da capacidade do mês no Gantt.</span>' +
      (ausVem.length ? ausVem.map(function (a) {
        var t = AUS[a.tipo] || AUS.outro;
        var agora = String(a.inicio || '') <= hoje;
        return '<div class="cfg-it' + (agora ? ' hj' : '') + '">' + H.av(a.dev, 26) +
          '<span style="flex:1;min-width:0;display:flex;flex-direction:column"><b class="ell" style="font-size:13px">' + esc(a.dev) + '</b>' +
          '<span class="note ell" style="font-size:11.5px">' + H.dm(a.inicio) + (a.fim && a.fim !== a.inicio ? ' a ' + H.dm(a.fim) : '') + (a.obs ? ' · ' + esc(a.obs) : '') + '</span></span>' +
          (agora ? H.chip('agora', 'ac') + ' ' : '') + H.chip(ico(t.ico) + ' ' + t.rot, t.cor) + '</div>';
      }).join('') : '<span class="note">Ninguém fora daqui para a frente.</span>') +
      (ausPass ? '<span class="note" style="font-size:12px">' + H.plural(ausPass, 'ausência passada', 'ausências passadas') + ' no histórico do Gantt.</span>' : '') +
      '</section>';
    h += '</div>';
    return h;
  }

  // ════════════════════════════════════════════════════════════════════════
  // APARENCIA — claro/escuro e a cor de acento em uso
  // ════════════════════════════════════════════════════════════════════════
  var TONS = [
    { v: '--ac', n: 'Principal' }, { v: '--ac-l', n: 'Claro' }, { v: '--ac-t', n: 'Texto' },
    { v: '--ac-h', n: 'Hover' }, { v: '--ac-d', n: 'Escuro' }, { v: '--on-ac', n: 'Sobre a cor' }
  ];

  function secAparencia(ctx) {
    var tema = raiz.temaAtual ? raiz.temaAtual() : 'escuro';
    var eu = ctx.eu || {};
    var primeiro = String(eu.nome || eu.login || '').split(/\s+/)[0];
    // Previa com dado real: a sprint atual e um item dela, quando houver.
    var S = raiz.SPRINTPO, atual = H.sprintAtual();
    var naSprint = atual && S ? H.visiveis().filter(function (m) { return S.naSprint(m, atual); }) : [];
    var feitas = naSprint.filter(function (m) { return H.colunaDe(m) === 'concluido'; }).length;
    var pct = naSprint.length ? Math.round(feitas / naSprint.length * 100) : 0;
    var ex = naSprint.filter(function (m) { return H.colunaDe(m) === 'em_andamento'; })[0] || naSprint[0] || H.visiveis()[0];
    var pz = ex ? H.prazoTxt(ex) : null;

    var h = cab('Aparência', 'Tema claro ou escuro e a cor da marca em uso. O AXIS completo será whitelabel (cor, logo e nome por empresa); hoje a marca é uma só e a cor é fixa nos tokens.');
    h += '<div class="grid" style="grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);align-items:start">';
    h += '<div style="display:flex;flex-direction:column;gap:16px;min-width:0">';
    // Tema
    h += '<section class="pn"><h2 class="h2">Tema</h2><div class="row" style="gap:8px">' +
      ['escuro', 'claro'].map(function (t) {
        return '<button type="button" class="btns' + (t === tema ? ' on' : '') + '" data-cfg-tema="' + t + '" aria-pressed="' + (t === tema) + '">' +
          ico(t === 'claro' ? 'sun' : 'moon') + ' ' + (t === 'claro' ? 'Claro' : 'Escuro') + '</button>';
      }).join('') + '</div>' +
      '<span class="note" style="font-size:12px">Vale para este navegador e para todas as telas do RoadMap (o mesmo botão da barra do topo). Escuro é o padrão da marca; padrão por empresa chega com o AXIS completo.</span></section>';
    // Cor
    h += '<section class="pn"><h2 class="h2">Cor principal</h2>' +
      '<div class="row" style="gap:12px"><span style="width:40px;height:40px;border-radius:12px;background:var(--ac);box-shadow:0 0 0 2px var(--bg0,var(--sf)),0 0 0 4px var(--ac)"></span>' +
      '<span class="note">Cor em uso</span><span class="in mono" style="height:34px" data-cfg-cor="--ac">—</span></div>' +
      '<span class="lab" style="margin-top:4px">TONS DERIVADOS · TEMA ' + (tema === 'claro' ? 'CLARO' : 'ESCURO') + '</span>' +
      '<div class="grid" style="grid-template-columns:repeat(6,minmax(0,1fr));gap:8px">' + TONS.map(function (t) {
        return '<div style="display:flex;flex-direction:column;gap:6px;min-width:0"><span class="cfg-ton" style="background:var(' + t.v + ')"></span>' +
          '<b style="font-size:12px">' + esc(t.n) + '</b><span class="mono note" style="font-size:11px" data-cfg-cor="' + t.v + '">—</span></div>';
      }).join('') + '</div>' +
      '<span class="note" style="font-size:12px">As telas usam só os tokens (<span class="mono">--ac</span>, <span class="mono">--ac-t</span>…); trocar a cor da empresa vai ser trocar estes valores. A escolha de cor por empresa chega com o AXIS completo.</span></section>';
    // Identidade em uso
    h += '<section class="pn"><h2 class="h2">Identidade</h2><div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">' +
      '<div style="padding:14px;border-radius:12px;border:1px dashed var(--bd4);display:flex;flex-direction:column;gap:8px;align-items:center;text-align:center">' +
      '<span class="axis-logo" role="img" aria-label="AXIS" style="height:26px"></span><span class="note" style="font-size:11.5px">logo do tema atual</span></div>' +
      '<div style="padding:14px;border-radius:12px;border:1px dashed var(--bd4);display:flex;flex-direction:column;gap:8px;align-items:center;text-align:center">' +
      '<span class="sb-mark" style="width:34px;height:34px;border-radius:10px"><img src="axis/marca/axis-leao-branco.png" alt="" style="width:22px;height:auto;display:block"></span>' +
      '<span class="note" style="font-size:11.5px">ícone do menu</span></div></div>' +
      '<span class="note" style="font-size:12px">Nome do produto, empresa, endereço e logos por empresa ficam em Empresa e marca, que chega com o AXIS completo.</span></section>';
    h += '</div>';
    // Previa
    h += '<section class="pnh" style="gap:14px"><span class="labo">PRÉVIA AO VIVO</span>' +
      '<div style="display:grid;grid-template-columns:150px minmax(0,1fr);border-radius:14px;overflow:hidden;border:1px solid var(--bd2)">' +
      '<div style="background:var(--side);padding:14px 10px;display:flex;flex-direction:column;gap:4px;font-size:12px">' +
      '<span style="font-family:Montserrat,sans-serif;font-weight:800;font-size:15px;padding:0 6px 10px">AX<span style="color:var(--ac)">IS</span></span>' +
      '<span style="padding:7px 8px;border-radius:8px;background:rgba(var(--ac-rgb),.18);color:var(--tx-hi,var(--tx));font-weight:700">Início</span>' +
      '<span style="padding:7px 8px;color:var(--tx3)">Quadro</span><span style="padding:7px 8px;color:var(--tx3)">Backlog</span></div>' +
      '<div style="padding:16px;display:flex;flex-direction:column;gap:12px;background:var(--bg-top);min-width:0">' +
      '<b style="font-family:Montserrat,sans-serif;font-size:17px">' + esc(H.saudacao(new Date().getHours())) + (primeiro ? ', ' + esc(primeiro) : '') + '</b>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap">' + (ex ? H.chip(esc(ex.codigo || ''), 'ac') + ' ' + H.chipEtapa(ex) : '') +
      (pz && pz.txt !== '—' ? ' <span class="note" style="color:' + pz.cor + '">' + esc(pz.txt) + '</span>' : '') + '</div>' +
      '<div class="bar" title="' + feitas + ' de ' + naSprint.length + ' concluídas na sprint atual"><span style="width:' + pct + '%;background:linear-gradient(90deg,var(--ac),var(--ac-t))"></span></div>' +
      '<span class="note" style="font-size:11.5px">' + (atual ? esc(S.rotuloCurto(atual)) + ' · ' : '') + feitas + ' de ' + naSprint.length + ' concluídas</span>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap"><span class="btnp" style="height:34px">Ação principal</span><span class="btn" style="height:34px">Secundária</span></div>' +
      '<a href="#configuracoes/aparencia" style="font-size:13px">Um link</a></div></div>' +
      info('A prévia usa os mesmos tokens das telas: trocar o tema aqui muda o app inteiro na hora. Nada de cor fica escrito no código das telas.') +
      '</section>';
    h += '</div>';
    return h;
  }

  function pintarTons(el) {
    var cs = getComputedStyle(document.documentElement);
    [].forEach.call(el.querySelectorAll('[data-cfg-cor]'), function (s) {
      var v = cs.getPropertyValue(s.getAttribute('data-cfg-cor')).trim();
      s.textContent = v ? v.toUpperCase() : '—';
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // SECOES QUE CHEGAM COM O AXIS COMPLETO
  // ════════════════════════════════════════════════════════════════════════
  /* Cada uma diz o que o prototipo promete e o que o RoadMap faz HOJE no
     lugar — em vez de uma tela vazia ou de numero inventado. */
  function secFutura(id, ctx) {
    var F = {
      marca: { t: 'Empresa e marca', sub: 'O AXIS será whitelabel: cada empresa com a sua cor, o seu logo, o seu nome e o seu endereço.',
        hoje: 'O RoadMap tem uma marca só (AXIS, laranja). Tema claro/escuro e a cor em uso estão em <a href="#configuracoes/aparencia">Aparência</a>.' },
      modulos: { t: 'Módulos', sub: 'Cada empresa liga só o que usa; desligar um módulo esconde o menu, as telas e os avisos dele.',
        hoje: 'Todas as telas estão ligadas para todos. O que muda o menu é o perfil (admin, dev, consulta).' },
      fluxos: { t: 'Fluxos e etapas', sub: 'Etapas, colunas do quadro, quem move e o que cada passagem exige, por empresa.',
        hoje: 'As etapas são fixas no código (<span class="mono">etapa-demanda.js</span>), as mesmas em todas as telas:', etapas: true },
      sla: { t: 'Prioridade e SLA', sub: 'Matriz impacto × urgência e prazos de resposta e solução por prioridade.',
        hoje: 'O RoadMap não tem SLA nem chamado. A prioridade é um campo da demanda e entra na ordem do quadro; o prazo é a data de entrega.' },
      api: { t: 'API e integrações', sub: 'Chaves por sistema, com escopo e expiração.',
        hoje: 'Há um endpoint único (o Worker), com sessão por login. Chaves por sistema e documentação OpenAPI chegam com o AXIS completo.' },
      widget: { t: 'Widget', sub: 'Abrir demanda de dentro de outro sistema.',
        hoje: 'Não existe no RoadMap. Hoje a demanda nasce no admin, no painel do dev ou pelo formulário de abertura.' },
      auditoria: { t: 'Auditoria', sub: 'Quem mudou o quê nas configurações, com o valor anterior.',
        hoje: 'Cada demanda guarda o próprio histórico (aba Histórico do item) e a base guarda os commits. Auditoria de configurações chega com o AXIS completo.' }
    }[id];
    if (!F) return H.vazio('info', 'Seção não encontrada', '');
    var h = cab(F.t, esc(F.sub), H.chip(ico('lock') + ' chega com o AXIS completo', 'bk'));
    h += '<section class="pn"><span class="lab">HOJE NO ROADMAP</span><span style="font-size:13.5px;line-height:21px;color:var(--tx2)">' + F.hoje + '</span>';
    if (F.etapas) {
      h += '<div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">' + H.ETAPAS.map(function (e, i) {
        var n = H.visiveis().filter(function (m) { return H.colunaDe(m) === e.id; }).length;
        return '<div class="cfg-it"><span class="mono note" style="width:22px">' + (i + 1) + '</span><span class="cfg-dot" style="background:' + e.dot + ';border-radius:5px;width:10px;height:10px"></span>' +
          '<b style="flex:1;font-size:13.5px">' + esc(e.rotulo) + '</b><span class="note mono">' + H.plural(n, 'demanda', 'demandas') + '</span></div>';
      }).join('') + '</div>';
    }
    h += '</section>';
    return h;
  }

  // ── Registro ────────────────────────────────────────────────────────────
  raiz.AXIS_APP.tela({
    id: 'configuracoes',
    rotulo: 'Configurações',
    papeis: ['admin'],
    abas: ABAS,
    // A regua horizontal do nucleo some: a navegacao desta tela e a vertical.
    abasDe: function () { return []; },
    titulo: function (r) {
      var i = TODAS.filter(function (x) { return x.id === r.aba; })[0];
      return 'Configurações' + (i ? ' · ' + i.rotulo : '');
    },
    render: function (el, ctx) {
      css();
      var aba = ctx.aba || 'catalogo';
      var corpo = aba === 'catalogo' ? secCatalogo(ctx)
        : aba === 'pessoas' ? secPessoas(ctx)
        : aba === 'sprint' ? secSprint(ctx)
        : aba === 'aparencia' ? secAparencia(ctx)
        : secFutura(aba, ctx);
      return '<div class="cfg">' + nav(aba) + '<div class="view" style="min-width:0">' + corpo + '</div></div>';
    },
    depois: function (el, ctx) {
      var aba = ctx.aba || 'catalogo';
      if (aba === 'pessoas') carregarContas(false);
      if (aba === 'aparencia') pintarTons(el);

      // Buscas: so a lista redesenha, o campo fica com o foco. Por delegacao,
      // porque a secao do catalogo e redesenhada inteira ao escolher sistema.
      el.addEventListener('input', function (e) {
        if (e.target.id === 'cfg-cat-q') {
          est.catBusca = e.target.value;
          var tb = el.querySelector('#cfg-cat-linhas');
          if (tb) tb.innerHTML = linhasTemas(dadosCatalogo(ctx.D));
        } else if (e.target.id === 'cfg-pes-q') {
          est.pesBusca = e.target.value;
          pintarPessoas(ctx.D);
        }
      });

      el.addEventListener('click', function (e) {
        var s = e.target.closest('[data-cfg-sis]');
        if (s) {
          var k = s.getAttribute('data-cfg-sis');
          est.catSis = est.catSis === k ? '' : k;
          // Sem `desenhar()`: ele volta a pagina ao topo, e quem clicou no
          // cartao quer ver a tabela logo abaixo.
          var vw = el.querySelector('.cfg > .view');
          if (vw) vw.innerHTML = secCatalogo(ctx);
          return;
        }
        var f = e.target.closest('[data-cfg-pes-f]');
        if (f) {
          est.pesFiltro = f.getAttribute('data-cfg-pes-f');
          pintarPessoas(ctx.D);
          return;
        }
        var p = e.target.closest('[data-cfg-pes]');
        if (p) {
          est.pesSel = p.getAttribute('data-cfg-pes');
          pintarPessoas(ctx.D);
          return;
        }
        var t = e.target.closest('[data-cfg-tema]');
        if (t) {
          var quer = t.getAttribute('data-cfg-tema');
          if (raiz.temaAtual && raiz.temaAlternar && raiz.temaAtual() !== quer) raiz.temaAlternar();
          raiz.AXIS_APP.desenhar();
          return;
        }
        if (e.target.closest('[data-cfg-acao="recarregar-contas"]')) {
          contas.erro = '';
          pintarPessoas(ctx.D);
          carregarContas(true);
        }
      });
      el.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var p = e.target.closest && e.target.closest('[data-cfg-pes]');
        if (!p) return;
        e.preventDefault();
        est.pesSel = p.getAttribute('data-cfg-pes');
        pintarPessoas(ctx.D);
        var box = el.querySelector('#cfg-pes');
        var de = box && box.querySelector('[data-cfg-pes="' + (raiz.CSS && CSS.escape ? CSS.escape(est.pesSel) : est.pesSel) + '"]');
        if (de) de.focus();
      });
    }
  });
})();
