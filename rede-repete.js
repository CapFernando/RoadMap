/* ═══ QUANDO A REDE CAI NO MEIO DA GRAVACAO ════════════════════════════════
 *
 * 28/10/2026, 14h30 BRT. "erro ao tentar mover o card" no Admin e, minutos
 * depois, "houve erro até no gantt ao levar uma task para um dev".
 *
 * O QUE O LOG AO VIVO DO WORKER MOSTROU: 143 requisicoes, 143 `Ok`, zero
 * excecao. O Worker nao falhou uma vez sequer. As gravacoes pararam de chegar
 * entre 17:33:51Z e 17:40:59Z — sete minutos — e voltaram sozinhas. No mesmo
 * periodo a Cloudflare tinha incidente aberto de performance de rede em
 * Ashburn (IAD), que e por onde o trafego do Brasil costuma passar.
 *
 * Ou seja: o pedido morria NO CAMINHO. `fetch` estoura sem status, a tela
 * mostra "Failed to fetch", e nada no servidor registra nada — porque nada
 * chegou nele.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * AS TRES TELAS INSISTIAM DE TRES JEITOS, e uma delas nao insistia.
 *
 *   admin.html   uma repeticao, 2s depois, mais a conferencia de "entrou?"
 *   dev.html     uma repeticao, 2s depois, mais a conferencia
 *   gantt.html   NENHUMA — a queda de rede ia direto para a mensagem de erro
 *
 * E e por isso que o Gantt foi o que doeu mais: levar uma task para um dev
 * falhava na primeira perda de pacote, sem nunca tentar de novo. A divergencia
 * de sempre nesta base — a copia corrigida e a esquecida.
 *
 * Uma repeticao 2s depois tambem nao resolvia o caso de hoje: a janela ruim
 * durou minutos, e a segunda tentativa caia dentro dela.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A ESPERA CRESCE, e os numeros tem razao de ser.
 *
 *   2s   cobre o soluco curto — um pacote perdido, uma rota trocada.
 *   6s   cobre a oscilacao de alguns segundos.
 *  15s   cobre a janela de rede ruim que nao e instantanea.
 *
 * Somadas, 23 segundos de insistencia, mais o tempo de cada gravacao (~7s
 * medidos). Uma falha definitiva passa a levar ate ~50s para ser anunciada —
 * e esse e o preco, assumido: a alternativa e anunciar erro em 9s para uma
 * gravacao que teria entrado na terceira tentativa.
 *
 * NAO E INFINITO de proposito. Rede fora de verdade tem de virar mensagem, e
 * nao tela girando para sempre: depois da terceira, a tela pergunta se a
 * gravacao entrou mesmo assim (`publicacaoEntrou`) e so entao fala em falha.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * REPETIR E SEGURO AQUI POR CONSTRUCAO, e nao por sorte: toda tentativa das
 * tres telas comeca relendo o servidor e remesclando o estado local por cima.
 * Se a primeira entrou, a segunda le o resultado dela, nao acha diferenca para
 * registrar e grava um no-op; se nao entrou, grava o que faltava. Nos dois
 * casos o que a pessoa fez sobrevive.                                        */
(function (raiz) {
  'use strict';

  /* Em milissegundos, uma por queda ja sofrida. O tamanho da lista E o numero
     de repeticoes: nao ha um segundo lugar dizendo "tente 3 vezes" para
     divergir deste. */
  var ESPERAS = [2000, 6000, 15000];

  /** ISTO FOI QUEDA DE REDE, e nao erro do servidor?
   *
   *  `fetch` rejeita com `TypeError` quando o pedido nao completa — DNS, TLS,
   *  conexao cortada, CORS. Erro HTTP (401, 409, 500) NAO passa por aqui: ele
   *  volta com `res.ok === false` e tem tratamento proprio, porque repetir um
   *  401 so gasta tempo.
   *
   *  A checagem da mensagem existe porque nem todo navegador rejeita com
   *  `TypeError`: alguns usam `Error` com "Failed to fetch" / "NetworkError"
   *  no texto. */
  function ehQueda(e) {
    if (!e) return false;
    if (typeof TypeError !== 'undefined' && e instanceof TypeError) return true;
    var msg = typeof e.message === 'string' ? e.message : '';
    return /fetch|network|conex|rede/i.test(msg);
  }

  /** Ainda vale tentar? `quedas` e quantas ja aconteceram (0 na primeira). */
  function deveRepetir(quedas) {
    return Number(quedas || 0) < ESPERAS.length;
  }

  /** Quanto esperar antes da proxima. Fora da lista devolve a ultima espera —
   *  nunca `undefined`, que viraria `setTimeout(fn, NaN)` e dispararia na hora,
   *  transformando a pausa em laco apertado contra um servidor ja em apuros. */
  function espera(quedas) {
    var i = Number(quedas || 0);
    return ESPERAS[i] != null ? ESPERAS[i] : ESPERAS[ESPERAS.length - 1];
  }

  /** O QUE A TELA DIZ ENQUANTO INSISTE.
   *
   *  Diz a tentativa e o total. "Falha de rede, tentando novamente…" repetido
   *  tres vezes parece a mesma mensagem travada — e a pessoa clica de novo,
   *  que era o caminho para duas gravacoes concorrentes. Com "2 de 3" ela ve
   *  que algo anda, e sabe quanto falta. */
  function aviso(quedas) {
    var n = Number(quedas || 0) + 1;
    return '⚠️ Falha de rede — tentando de novo (' + n + ' de ' +
           ESPERAS.length + ')…';
  }

  var api = { ESPERAS: ESPERAS, ehQueda: ehQueda, deveRepetir: deveRepetir,
              espera: espera, aviso: aviso };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.REDEREPETE = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
