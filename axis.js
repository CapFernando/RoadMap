/* ─────────────────────────────────────────────────────────────────────────
   AXIS — casca compartilhada: icones e menu lateral.

   AS TELAS NAO MUDARAM DE FUNCAO, so de casa. Cada tela continua sendo o
   arquivo que era, com o login e a sessao que tinha; o menu lateral apenas
   junta os caminhos que antes estavam espalhados em botoes de cabecalho e na
   regua de abas do admin, nos grupos do AXIS (DOC-17 §17.1).

   O MENU DEPENDE DO PAPEL. Um dev que clicasse em "Quadro" cairia no login do
   admin e leria "sua conta e de dev e nao abre a area administrativa" — o
   menu oferecendo uma porta que nao abre. O papel vem do `rm_eu` que as telas
   ja gravam no login; sem ele, vale o papel que a propria tela exige.

   OS ITENS DO ADMIN SAO ABAS. Dentro do admin o clique chama `switchTab`; de
   fora, grava `rm_admin_tab` (a mesma chave que o admin ja le ao abrir, em
   `restoreLastTab`) e navega. Nenhum endereco novo foi inventado.

   Publica em `window.AXIS` e em `module.exports`, como os outros modulos.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  // Tracos de 24x24, espessura 1,8 (design-system/icones do EP-013).
  var ICONES = {
    alert: 'M12 3 2 20h20L12 3zM12 10v4M12 17h.01',
    at: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-4 7.5',
    bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
    board: 'M4 4h16v16H4zM9 8v6M13 8v3M17 8v8',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5',
    camera: 'M4 7h4l2-2h4l2 2h4v12H4zM12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    cards: 'M8 4h10v16H8zM5 7v12M12 10h2M12 14h2',
    chart: 'M3 21h18M6 17v-6M11 17V6M16 17v-4M20 17V9',
    check: 'M5 12l5 5L20 7',
    clip: 'M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    code: 'M8 6 3 12l5 6M16 6l5 6-5 6',
    external: 'M7 17 17 7M9 7h8v8',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    flag: 'M5 21V4h11l-2 4 2 4H5',
    flame: 'M12 3c1 4 5 5.5 5 10.5a5 5 0 0 1-10 0c0-3 2-4.5 2-7.5 1.5 1 2.5 2.5 2.5 4.5',
    folder: 'M3 6h6l2 2h10v11H3z',
    globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
    grip: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
    help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01',
    home: 'M3 11 12 4l9 7v9H3zM9 20v-6h6v6',
    hourglass: 'M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
    key: 'M8 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM11 11h10M18 11v3M21 11v2',
    laptop: 'M5 5h14v10H5zM2 19h20',
    layers: 'M12 3 3 8l9 5 9-5zM3 13l9 5 9-5',
    link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1',
    lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
    logout: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10',
    menu: 'M4 6h16M4 12h16M4 18h16',
    moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
    package: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
    pause: 'M9 5v14M15 5v14',
    plug: 'M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4',
    pulse: 'M3 12h4l2-5 4 10 2-5h6',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
    refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
    rocket: 'M5 15c-1 2-1 4-1 4s2 0 4-1M14 4c3 0 6 3 6 6l-7 7-6-6zM9 11l-4 1 2 2M13 15l-1 4-2-2',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5',
    send: 'M4 12l16-8-6 16-3-7z',
    shield: 'M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z',
    sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z',
    star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z',
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    ticket: 'M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z',
    undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
    upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
    users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7M18 14a6 6 0 0 1 4 7'
  };

  /* O SVG sai como TEXTO, e nao como no do DOM: as telas montam HTML por
     template string, e e la que o icone precisa entrar. */
  function icone(nome, tam) {
    var d = ICONES[nome];
    if (!d) return '';
    var t = tam || '1.15em';
    return '<svg class="ax-ico" viewBox="0 0 24 24" width="' + t + '" height="' + t +
      '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"' +
      ' stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="' + d + '"/></svg>';
  }

  // ── O menu ────────────────────────────────────────────────────────────
  // `aba` = aba do admin.html. `papeis` = quem ve o item.
  var A = ['admin'], AD = ['admin', 'dev'];
  var MENU = [
    { grupo: 'Trabalho', itens: [
      { id: 'dev',        rotulo: 'Meu painel',     ico: 'home',     href: 'dev.html',     papeis: AD },
      { id: 'melhorias',  rotulo: 'Backlog',        ico: 'menu',     aba: 'melhorias',     papeis: A },
      { id: 'kanban',     rotulo: 'Quadro',         ico: 'board',    aba: 'kanban',        papeis: A },
      { id: 'gantt',      rotulo: 'Planejamento',   ico: 'calendar', href: 'gantt.html',   papeis: AD },
      { id: 'projetos',   rotulo: 'Projetos',       ico: 'package',  aba: 'projetos',      papeis: A },
      { id: 'poker',      rotulo: 'Planning Poker', ico: 'cards',    href: 'poker.html',   papeis: AD }
    ] },
    { grupo: 'Acompanhamento', itens: [
      { id: 'follow',     rotulo: 'Acompanhamentos', ico: 'flag',    href: 'follow.html',  papeis: A },
      { id: 'publico',    rotulo: 'Painel público',  ico: 'globe',   href: 'index.html',   papeis: A }
    ] },
    { grupo: 'Análises', itens: [
      { id: 'gerencial',  rotulo: 'Painéis',           ico: 'chart',   aba: 'gerencial',  papeis: A },
      { id: 'relatorios', rotulo: 'Relatórios',        ico: 'receipt', aba: 'relatorios', papeis: A },
      { id: 'mes',        rotulo: 'Fechamento do mês', ico: 'clock',   aba: 'mes',        papeis: A }
    ] },
    { grupo: 'Configurações', itens: [
      { id: 'temas',      rotulo: 'Catálogo de sistemas', ico: 'layers', aba: 'temas',      papeis: A },
      { id: 'usuarios',   rotulo: 'Pessoas e acessos',    ico: 'users',  aba: 'usuarios',   papeis: A },
      { id: 'importar',   rotulo: 'Importar demandas',    ico: 'upload', href: 'importar.html', papeis: A }
    ] }
  ];

  function pagina() {
    var p = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    return p || 'index.html';
  }

  function eu() {
    try { return JSON.parse(sessionStorage.getItem('rm_eu') || 'null') || null; } catch (_) { return null; }
  }

  /* O papel gravado no login manda. Sem ele (senha compartilhada, aba nova),
     a pagina diz: quem esta no painel do dev e dev; quem esta em qualquer outra
     tela interna passou pelo login de admin dela. */
  function papel() {
    var e = eu();
    if (e && e.papel) return e.papel;
    return pagina() === 'dev.html' ? 'dev' : 'admin';
  }

  function abaAdminAtiva() {
    var c = document.querySelector('.tab-content.active');
    return c && c.id ? c.id.replace(/^tab-/, '') : 'melhorias';
  }

  function itemAtivo() {
    var p = pagina();
    if (p === 'admin.html') return abaAdminAtiva();
    for (var g = 0; g < MENU.length; g++) {
      for (var i = 0; i < MENU[g].itens.length; i++) {
        if (MENU[g].itens[i].href === p) return MENU[g].itens[i].id;
      }
    }
    return '';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function iniciais(nome) {
    var p = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '';
    return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }

  function htmlMenu() {
    var meu = papel(), ativo = itemAtivo();
    var h = '<a class="axis-sb-logo" href="' + (meu === 'admin' ? 'admin.html' : 'dev.html') + '" aria-label="AXIS — início">' +
      '<span class="axis-sb-mark"><img src="axis/marca/axis-leao-branco.png" alt=""></span>' +
      '<span class="axis-sb-word">AX<i>IS</i></span></a>';
    MENU.forEach(function (g) {
      var itens = g.itens.filter(function (it) { return it.papeis.indexOf(meu) >= 0; });
      if (!itens.length) return;
      h += '<div class="axis-sb-grp"><span class="axis-sb-lab">' + esc(g.grupo) + '</span>';
      itens.forEach(function (it) {
        var href = it.href || ('admin.html#' + it.aba);
        h += '<a class="axis-sb-it' + (it.id === ativo ? ' on' : '') + '" href="' + href + '"' +
          ' data-axis-item="' + it.id + '"' + (it.aba ? ' data-axis-aba="' + it.aba + '"' : '') +
          (it.id === ativo ? ' aria-current="page"' : '') + '>' +
          icone(it.ico) + '<span class="axis-sb-t">' + esc(it.rotulo) + '</span></a>';
      });
      h += '</div>';
    });
    var e = eu() || {};
    var nome = e.nome || e.login || '';
    var rotPapel = { admin: 'PM/PO · Admin', dev: 'Dev', consulta: 'Consulta' }[meu] || meu;
    h += '<div class="axis-sb-user">' +
      '<span class="axis-sb-av">' + (esc(iniciais(nome)) || icone('user', '16px')) + '</span>' +
      '<span class="axis-sb-quem"><b>' + (esc(nome) || 'Minha conta') + '</b><small>' + esc(rotPapel) + '</small></span>' +
      (SAIR[pagina()] ? '<button type="button" class="axis-sb-sair" data-axis-acao="sair" title="Sair" aria-label="Sair">' + icone('logout', '16px') + '</button>' : '') +
      '</div>';
    return h;
  }

  /* O logout de cada tela, pelo nome. Nao da para procurar "qualquer funcao
     chamada sair": no poker, `sair()` e sair DA SALA — e apaga o voto da
     rodada. Tela fora desta lista nao ganha o botao. */
  var SAIR = { 'admin.html': 'doLogout', 'gantt.html': 'doLogout', 'dev.html': 'sairDev', 'follow.html': 'sair' };

  function rotuloDe(id) {
    for (var g = 0; g < MENU.length; g++) {
      for (var i = 0; i < MENU[g].itens.length; i++) {
        if (MENU[g].itens[i].id === id) return MENU[g].itens[i].rotulo;
      }
    }
    return '';
  }

  function marcar(id) {
    // No admin o titulo do cabecalho e o da secao aberta: "Administracao" nao
    // dizia em que aba a pessoa estava, agora que a regua de abas sumiu.
    if (pagina() === 'admin.html') {
      var h1 = document.querySelector('#admin-app .header-left h1');
      var r = rotuloDe(id);
      if (h1 && r) h1.textContent = r;
    }
    var nav = document.querySelector('.axis-sb');
    if (!nav) return;
    var its = nav.querySelectorAll('.axis-sb-it');
    for (var i = 0; i < its.length; i++) {
      var on = its[i].getAttribute('data-axis-item') === id;
      its[i].classList.toggle('on', on);
      if (on) its[i].setAttribute('aria-current', 'page'); else its[i].removeAttribute('aria-current');
    }
  }

  function aoClicar(ev) {
    var a = ev.target.closest && ev.target.closest('[data-axis-aba], [data-axis-acao]');
    if (!a) return;
    if (a.getAttribute('data-axis-acao') === 'sair') {
      // Cada tela tem o proprio logout, com a propria limpeza de sessao.
      var sair = window[SAIR[pagina()]];
      if (typeof sair === 'function') sair();
      return;
    }
    var aba = a.getAttribute('data-axis-aba');
    // Meio-clique e Ctrl+clique abrem em aba nova: o navegador cuida.
    if (ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey) {
      try { localStorage.setItem('rm_admin_tab', aba); } catch (_) {}
      return;
    }
    if (pagina() === 'admin.html' && typeof window.switchTab === 'function') {
      ev.preventDefault();
      // O elemento da regua vai junto: sem ele, `switchTab` marcaria como ativa
      // a aba que estivesse em `event.currentTarget` — que seria este link.
      var regua = Array.prototype.find.call(document.querySelectorAll('.tab'), function (t) {
        return (t.getAttribute('onclick') || '').indexOf("'" + aba + "'") >= 0;
      });
      window.switchTab(aba, regua || null);
      marcar(aba);
      return;
    }
    try { localStorage.setItem('rm_admin_tab', aba); } catch (_) {}
  }

  function montar() {
    if (document.querySelector('.axis-sb')) return;
    var nav = document.createElement('nav');
    nav.className = 'axis-sb';
    nav.setAttribute('aria-label', 'Menu principal');
    nav.innerHTML = htmlMenu();
    nav.addEventListener('click', aoClicar);
    document.body.insertBefore(nav, document.body.firstChild);
    document.body.classList.add('axis-com-menu');
    marcar(itemAtivo());

    // A troca de aba pode vir de dentro do admin (atalho, banner "ver
    // atrasadas", restoreLastTab): o menu acompanha embrulhando switchTab.
    if (pagina() === 'admin.html' && typeof window.switchTab === 'function' && !window.switchTab._axis) {
      var orig = window.switchTab;
      var embrulho = function (nome) {
        var r = orig.apply(this, arguments);
        marcar(nome);
        return r;
      };
      embrulho._axis = true;
      window.switchTab = embrulho;
    }
  }

  // Telas que nao recebem o menu: o painel publico (sem login de equipe) e a
  // mensageria, que abre por demanda e nao e destino de navegacao.
  var SEM_MENU = ['index.html', 'mensageria.html'];

  function iniciar() {
    if (SEM_MENU.indexOf(pagina()) >= 0) return;
    montar();
    // Quem entra pelo login so passa a ter `rm_eu` depois: o menu se refaz
    // quando a sessao muda, para nao ficar mostrando o papel de antes.
    window.addEventListener('rm-token-novo', atualizar);
    var login = document.getElementById('login-screen');
    if (login && typeof MutationObserver === 'function') {
      new MutationObserver(atualizar).observe(login, { attributes: true, attributeFilter: ['style'] });
    }
  }

  function atualizar() {
    var nav = document.querySelector('.axis-sb');
    if (nav) nav.innerHTML = htmlMenu();
  }

  var AXIS = { icone: icone, ICONES: ICONES, MENU: MENU, atualizarMenu: atualizar, marcar: marcar };
  if (typeof window !== 'undefined') {
    window.AXIS = AXIS;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = AXIS;
})();
