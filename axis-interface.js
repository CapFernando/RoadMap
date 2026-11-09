/* ─────────────────────────────────────────────────────────────────────────
   AXIS — QUAL INTERFACE CADA PESSOA USA.

   A interface nova (o app axis.html) e ligada POR CONTA, pelo admin: a coluna
   `interface_nova` da conta (Worker, banco D1) vem no login e no `quem-sou`,
   e fica no `rm_eu` da sessao, que todas as telas ja leem.

     - com a marca: as telas antigas mandam para a tela equivalente do app;
     - sem a marca: o app manda de volta para a tela antiga de sempre.

   Padrao desligado: no dia em que isto vai ao ar, ninguem muda de tela; o
   admin liga pessoa por pessoa (ou todos os admins de uma vez) em Usuarios,
   no admin, ou em Configuracoes › Pessoas e perfis, no app.

   SAIDA DE EMERGENCIA: `?antiga=1` no endereco de qualquer tela antiga deixa a
   pessoa na interface antiga ate fechar a aba (sessionStorage), mesmo marcada.

   A MARCA PODE MUDAR COM A PESSOA LOGADA: cada tela pergunta uma vez ao
   servidor (`quem-sou`) ao abrir, e um login feito na propria tela tambem e
   percebido. Assim, "clicou, virou" na proxima tela que a pessoa abrir.

   Publica em `window.AXIS_INTERFACE` e em `module.exports` (a suite executa).
   ───────────────────────────────────────────────────────────────────────── */
(function (raiz) {
  'use strict';

  var WORKER = 'https://roadmap-nova-melhoria.morais-tecnologico.workers.dev';

  /* Tela antiga -> rota equivalente no app. `index.html` (painel publico)
     fica de fora: e o painel aberto, sem conta. */
  var ROTA_NOVA = {
    'admin.html': 'inicio', 'dev.html': 'inicio/meu', 'gantt.html': 'planejamento',
    'poker.html': 'poker', 'follow.html': 'acompanhamentos',
    // projetos.html e a carteira de HORAS POR TEMA, e nao os projetos EP-: no
    // app, o mais proximo e a visao gerencial dos Paineis.
    'projetos.html': 'paineis/visao',
    'importar.html': 'importar', 'mensageria.html': 'api'
  };

  function nova(eu) { return !!(eu && eu.interface_nova); }

  /** Para onde vai, no app, quem esta na tela antiga `pagina` com o `hash`
   *  (e a `busca`, o `?…` do endereco). */
  function rotaNova(pagina, hash, busca) {
    var pg = String(pagina || '').toLowerCase();
    var base = ROTA_NOVA[pg];
    if (!base) return '';
    // mensageria.html?codigo=AX-123 e a conversa daquela demanda: no app, a aba
    // Conversa do Item. Sem codigo, e a API de demandas.
    var cod = (String(busca || '').match(/[?&]codigo=([^&#]+)/i) || [])[1];
    if (pg === 'mensageria.html' && cod) {
      cod = decodeURIComponent(cod).trim().toUpperCase();
      if (/^\d+$/.test(cod)) cod = 'AX-' + cod;
      if (/^AX-\d+$/.test(cod)) return 'item/' + cod + '/conversa';
    }
    // admin.html#AX-123 e dev.html#AX-123 abrem a demanda: no app e o Item.
    var h = decodeURIComponent(String(hash || '').replace(/^#/, ''));
    if (/^AX-\d+$/i.test(h)) return 'item/' + h.toUpperCase();
    return base;
  }

  /** A tela antiga de quem nao tem a marca: admin no admin, consulta no
   *  painel publico, o resto no painel do dev. */
  function destinoAntigo(papel) {
    return papel === 'admin' ? 'admin.html' : papel === 'consulta' ? 'index.html' : 'dev.html';
  }

  /* O ENDERECO SEM ".html" TAMBEM (09/11/2026): o GitHub Pages abre
     /RoadMap/admin igual a /RoadMap/admin.html, e quem entrava pelo primeiro
     nunca era levado ao app — "o link muda, nao deveria". */
  function nomeDaPagina(caminho) {
    var p = (String(caminho || '').split('/').pop() || 'index.html').toLowerCase();
    return /\.html?$/.test(p) ? p : p + '.html';
  }
  function pagina() { return nomeDaPagina(location.pathname); }
  function eu() { try { return JSON.parse(sessionStorage.getItem('rm_eu') || 'null'); } catch (_) { return null; } }
  function querAntiga() { try { return sessionStorage.getItem('rm_ui_antiga') === '1'; } catch (_) { return false; } }
  function token() {
    try { return sessionStorage.getItem('rm_admin_token') || sessionStorage.getItem('rm_dev_token') || ''; } catch (_) { return ''; }
  }

  /** Na tela antiga: quem tem a marca vai para o app. Devolve true se mandou. */
  function decidirNaTelaAntiga() {
    var r = rotaNova(pagina(), location.hash, location.search);
    if (!r || querAntiga() || !nova(eu())) return false;
    location.replace('axis.html#' + r);
    return true;
  }

  /** Pergunta ao servidor a marca atual e a guarda no `rm_eu`. */
  function atualizar() {
    var t = token();
    if (!t || typeof fetch !== 'function') return Promise.resolve(null);
    return fetch(WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                           body: JSON.stringify({ action: 'quem-sou', token: t }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.usuario) return null;
        var e = eu() || {};
        e.interface_nova = !!j.usuario.interface_nova;
        if (j.papel) e.papel = j.papel;
        ['login', 'nome', 'email', 'nome_demandas'].forEach(function (k) { if (j.usuario[k] != null && e[k] == null) e[k] = j.usuario[k]; });
        try { sessionStorage.setItem('rm_eu', JSON.stringify(e)); } catch (_) {}
        return e;
      })
      .catch(function () { return null; });
  }

  function ligarNaTelaAntiga() {
    if (!ROTA_NOVA[pagina()]) return;
    if (/[?&]antiga=1\b/.test(location.search)) { try { sessionStorage.setItem('rm_ui_antiga', '1'); } catch (_) {} }
    if (decidirNaTelaAntiga()) return;
    atualizar().then(function () { decidirNaTelaAntiga(); });
    // Login feito nesta tela: o `rm_eu` aparece ou muda, e a decisao e refeita.
    var ultimo = null;
    try { ultimo = sessionStorage.getItem('rm_eu'); } catch (_) {}
    setInterval(function () {
      var agora = null;
      try { agora = sessionStorage.getItem('rm_eu'); } catch (_) {}
      if (agora !== ultimo) { ultimo = agora; decidirNaTelaAntiga(); }
    }, 800);
  }

  var api = { nova: nova, nomeDaPagina: nomeDaPagina, rotaNova: rotaNova, destinoAntigo: destinoAntigo, atualizar: atualizar, ROTA_NOVA: ROTA_NOVA };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    raiz.AXIS_INTERFACE = api;
    ligarNaTelaAntiga();
  }
}(typeof window !== 'undefined' ? window : this));
