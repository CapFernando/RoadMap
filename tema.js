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
    // Desliga as transicoes durante a troca. Sem isto, qualquer elemento que
    // anime `color` ou `background` vindo de var() congela no valor do tema
    // anterior e nunca chega ao novo.
    var raiz = document.documentElement;
    raiz.classList.add('trocando-tema');
    // Dois quadros: um para o navegador aplicar a classe, outro para pintar com
    // as cores novas antes de as transicoes voltarem.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { raiz.classList.remove('trocando-tema'); });
    });
    // data-tema so aparece no claro; o escuro e a ausencia da marca, o que
    // mantem o CSS original de cada pagina valendo sem precisar de override.
    if (tema === 'claro') document.documentElement.setAttribute('data-tema', 'claro');
    else document.documentElement.removeAttribute('data-tema');
    // Telas que calculam cor em JS (a paleta de temas do gantt, por exemplo)
    // precisam redesenhar: o CSS troca sozinho, o que foi gerado em JS nao.
    if (typeof window.onTemaMudou === 'function') {
      try { window.onTemaMudou(tema); } catch (_) {}
    }
    var b = document.querySelector('.tema-btn');
    if (b) {
      var claro = tema === 'claro';
      // Icone de traco, e nao emoji (DOC-18 do AXIS): o emoji muda de desenho e
      // de linha de base conforme o sistema, e destoava dos outros icones.
      b.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"' +
        ' stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
        (claro ? 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'
               : 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z') + '"/></svg>';
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
