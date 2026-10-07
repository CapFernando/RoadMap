/* ─────────────────────────────────────────────────────────────────────────────
   A DEVOLUÇÃO DO PM/PO — "esta demanda voltou, e foi por isto"

   ───────────────────────────────────────────────────────────────────────────
   O TEXTO EXISTIA E NINGUÉM O VIA.

   "Ao devolver uma demanda p/ dev, é preenchido um texto e o mesmo não é
    mostrado."

   O texto nunca se perdeu: `valRejeitar` o exige (não dá para devolver sem
   escrever), `valDecidir` o grava em `validacao_obs`, o normalizador da gravação
   o repassa e o Worker devolve o campo. Ele estava guardado o tempo todo.

   O que faltava era onde ele aparece. Havia exatamente dois lugares, e os dois
   exigem ABRIR o card: a aba Entrega no Admin e o modal de status no painel do
   dev. Nos QUADROS — o Kanban do Admin e a lista do dev — a demanda voltava para
   "Em andamento" idêntica a todas as outras. Quem escreveu o motivo não via
   rastro dele, e o dev só o encontrava se abrisse o card por conta própria.

   E é justamente o dev quem precisa lê-lo: o aviso que ele já tinha no modal
   dizia a razão com todas as letras — "sem mostrar aqui, o dev reentrega a
   mesma coisa".

   ───────────────────────────────────────────────────────────────────────────
   POR QUE ISTO É UM ARQUIVO.

   A mesma faixa aparece em duas telas. Escrita duas vezes, elas divergem no dia
   em que uma ganhar o código da demanda ou mudar o corte do texto — e aí o dev e
   o PM/PO passam a ler coisas diferentes sobre a mesma devolução.

   ───────────────────────────────────────────────────────────────────────────
   QUANDO ELA SOME, e por que isso basta.

   Não há campo "foi devolvida". Não precisa: `validacao_obs` só é LIMPO na
   aprovação (`valDecidir`, ramo do aprovar). Então texto presente significa
   exatamente "a última decisão do PM/PO foi devolver, e desde então ninguém
   aprovou" — que é a pergunta que a faixa responde.

   Ela continua à mostra depois que o dev reentrega, e isso é deliberado: a
   demanda volta para Validação e o PM/PO precisa saber o que ele mesmo pediu da
   vez anterior, para conferir se veio. Some sozinha na aprovação.          */
(function (raiz) {
  'use strict';

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /** O MOTIVO ESCRITO, já aparado. String vazia quando não houve devolução. */
  function motivo(m) {
    return String((m || {}).validacao_obs || '').trim();
  }

  function houve(m) { return motivo(m) !== ''; }

  /** A FAIXA DO CARD.
   *
   *  VISÍVEL, e não em `title`. O motivo de uma devolução é a instrução de
   *  trabalho do dev — escondê-lo atrás do mouse já é o defeito que esta faixa
   *  conserta, e em telefone não existe hover.
   *
   *  O CORTE É POR CSS (`-webkit-line-clamp`), e não por `slice`: cortar a
   *  string no JavaScript decide por conta própria quantos caracteres cabem num
   *  card cuja largura muda com a tela, e ainda arrisca partir uma palavra no
   *  meio. O texto inteiro vai no HTML e o navegador decide onde parar — e o
   *  `title` leva a íntegra para quem quiser passar o mouse, como EXTRA e nunca
   *  como único caminho (o card abre e mostra tudo).                        */
  function faixa(m, classe) {
    var txt = motivo(m);
    if (!txt) return '';
    return '<div class="' + (classe || 'devolucao-faixa') + '" title="' + esc(txt) + '">' +
           '<strong><span aria-hidden="true">↩</span> Devolvida pelo PM/PO:</strong> ' +
           esc(txt) + '</div>';
  }

  var api = { motivo: motivo, houve: houve, faixa: faixa };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.DEVOLUCAO = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
