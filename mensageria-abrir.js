/* ─────────────────────────────────────────────────────────────────────────────
   ABRIR A MENSAGERIA — a mesma porta nas três telas.

   POR QUE ESTE ARQUIVO EXISTE, e não um `window.open` escrito em cada tela: o
   Admin, o portal do dev e o Gantt abrem a MESMA tela, e três cópias da chamada
   divergem na primeira mexida — uma passa o id, outra o código, a terceira
   esquece de conferir se há demanda. O sintoma seria um botão que não faz nada
   numa das telas, e ninguém liga o defeito à tela certa.

   Foi a mesma razão de `prazo.js`, `capacidade.js`, `catalogo.js` e
   `busca-demanda.js` existirem: regra em N lugares diverge.

   ───────────────────────────────────────────────────────────────────────────
   A JANELA É NOVA, E NÃO UMA ABA QUALQUER.

   `window.open` de mesma origem entrega à tela nova uma CÓPIA do
   `sessionStorage` de quem abriu — é assim que o token da sessão chega lá sem a
   Mensageria ter login próprio. Um quarto formulário de senha seria a quarta
   chance de a regra de acesso divergir.

   Isso vale para janela aberta por script; um link colado numa aba em branco
   NÃO carrega a sessão, e por isso a Mensageria mostra o registro em leitura e
   só esconde o campo de escrever. Ela não quebra, ela informa.
   ───────────────────────────────────────────────────────────────────────────*/
(function (raiz) {
  'use strict';

  /** O que identifica a demanda na URL.
   *
   *  O CÓDIGO VEM PRIMEIRO, e o id é a reserva. Duas razões: o código é o que a
   *  pessoa reconhece se olhar a barra de endereço, e é o que ela consegue
   *  digitar à mão para abrir a Mensageria de outra demanda. O id é um uuid que
   *  não diz nada a ninguém — mas ele é exato, e serve para a demanda que ainda
   *  não recebeu código. */
  function referencia(m) {
    if (!m) return '';
    var cod = String(m.codigo == null ? '' : m.codigo).trim();
    return cod || String(m.id == null ? '' : m.id).trim();
  }

  /** Abre a Mensageria da demanda. Devolve `false` quando não havia o que abrir. */
  function abre(m) {
    var ref = typeof m === 'string' ? m.trim() : referencia(m);
    if (!ref) return false;
    /* NOME DE JANELA FIXO POR DEMANDA. Sem ele, cada clique abre uma janela nova
       e quem consulta três vezes fica com três janelas da mesma coisa. Com o
       nome, o segundo clique reaproveita a janela e a traz para frente. */
    var nome = 'mensageria-' + ref.replace(/[^A-Za-z0-9_-]/g, '');
    var j = window.open(
      'mensageria.html?codigo=' + encodeURIComponent(ref),
      nome,
      'width=900,height=760,noopener=no'
    );
    /* SE O NAVEGADOR BLOQUEOU, DIZ. Uma janela bloqueada é indistinguível de um
       botão quebrado — e quem não sabe que o bloqueador agiu vai reclamar do
       sistema. `window.open` devolve `null` nesse caso. */
    if (!j) {
      var aviso = 'O navegador bloqueou a janela da Mensageria. ' +
                  'Libere as janelas para este site e clique de novo.';
      if (raiz.dialogoAlerta) raiz.dialogoAlerta(aviso);
      else if (raiz.toast) raiz.toast(aviso, 'erro');
      else raiz.alert(aviso);
      return false;
    }
    try { j.focus(); } catch (_) { /* alguns navegadores recusam focus; a janela abriu */ }
    return true;
  }

  /** O botão, para a tela só colar onde ele cabe.
   *
   *  O RÓTULO INCLUI O CÓDIGO no `title`, e não no texto: "Mensageria AX-233"
   *  esticaria o botão a cada demanda e mexeria no layout da linha de ações. */
  function botaoHTML(m, classe) {
    var ref = referencia(m);
    if (!ref) return '';
    var esc = function (t) {
      return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    };
    return '<button type="button" class="' + (classe || 'btn btn-secondary btn-sm') + '"' +
      ' title="Histórico e mensagens de ' + esc(ref) + '"' +
      ' onclick="MENSAGERIA.abre(\'' + esc(ref) + '\')">💬 Mensageria</button>';
  }

  raiz.MENSAGERIA = { abre: abre, botaoHTML: botaoHTML, referencia: referencia };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.MENSAGERIA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
