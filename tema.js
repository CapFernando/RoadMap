/* ─────────────────────────────────────────────────────────────────────────
   Escolha de tema (escuro / claro), compartilhada pelas 7 telas.

   Carregado no <head> de forma sincrona e de proposito: aplicar o tema depois
   do primeiro desenho faria a pagina piscar em escuro antes de virar clara.

   O padrao continua ESCURO, que e como o sistema sempre foi. Ninguem tem a
   aparencia trocada sem pedir; quem quiser claro clica no botao, e a escolha
   fica gravada naquele navegador.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var CHAVE = 'rm_tema';

  function lido() {
    try { return localStorage.getItem(CHAVE); } catch (_) { return null; }
  }

  function aplicar(tema) {
    // data-tema so aparece no claro; o escuro e a ausencia da marca, o que
    // mantem o CSS original de cada pagina valendo sem precisar de override.
    if (tema === 'claro') document.documentElement.setAttribute('data-tema', 'claro');
    else document.documentElement.removeAttribute('data-tema');
    var b = document.querySelector('.tema-btn');
    if (b) {
      var claro = tema === 'claro';
      b.textContent = claro ? '☀️' : '🌙';
      b.title = claro ? 'Tema claro — clique para escuro' : 'Tema escuro — clique para claro';
      b.setAttribute('aria-pressed', claro ? 'true' : 'false');
    }
  }

  window.temaAtual = function () { return lido() === 'claro' ? 'claro' : 'escuro'; };

  window.temaAlternar = function () {
    var novo = window.temaAtual() === 'claro' ? 'escuro' : 'claro';
    try { localStorage.setItem(CHAVE, novo); } catch (_) {}
    aplicar(novo);
  };

  // Antes do primeiro desenho.
  aplicar(window.temaAtual());

  // Outra aba mudou o tema: acompanha, para as telas nao divergirem.
  window.addEventListener('storage', function (e) {
    if (e.key === CHAVE) aplicar(window.temaAtual());
  });

  function botao() {
    if (document.querySelector('.tema-btn')) return;
    var b = document.createElement('button');
    b.className = 'tema-btn';
    b.type = 'button';
    b.setAttribute('aria-label', 'Alternar tema claro ou escuro');
    b.onclick = window.temaAlternar;
    // Encaixa no cabecalho quando existe um; senao flutua no canto.
    var alvo = document.querySelector('.header-right') || document.querySelector('header')
            || document.querySelector('.header');
    if (alvo) alvo.appendChild(b);
    else { b.classList.add('solta'); document.body.appendChild(b); }
    aplicar(window.temaAtual());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', botao);
  else botao();
})();
