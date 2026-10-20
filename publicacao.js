/* ═══ O QUE VAI NO FIO AO PUBLICAR ═════════════════════════════════════════
 *
 * "Erro ao publicar: Failed to fetch", de novo. No log do Worker:
 * `exceededCpu` — "Worker exceeded CPU time limit". O navegador diz "rede"
 * porque o Cloudflare devolve a pagina de erro SEM cabecalho CORS, e o fetch
 * so consegue traduzir isso como falha de rede.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MEDIDO, E NAO SUPOSTO.
 *
 * Sobre a base real de 2,9 MB, o custo de uma publicacao e:
 *
 *   JSON.parse do corpo que a tela manda ....... 13,7 ms
 *   JSON.parse da base gravada .................. 12,2 ms
 *   JSON.stringify para gravar .................. 15,1 ms
 *   as ~15 varreduras nas 904 demandas ..........  0,3 ms
 *
 * JSON e 99% do custo. As varreduras — que e onde o instinto manda mexer —
 * nao custam nada.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A TRILHA NAO PRECISA IR NO CORPO. NUNCA PRECISOU.
 *
 * `historico` pesa 1,15 MB dos 2,9 MB, e o Worker JA O IGNORA: `registraHistorico`
 * le a trilha do ARQUIVO GRAVADO (`velha.historico`) e a reata ao objeto,
 * tanto na demanda que mudou quanto na que nao mudou. O corpo era 1,15 MB
 * enviado, recebido e parseado para ser descartado.
 *
 * E a razao de ele ignorar e de seguranca, nao de economia: se a base fosse o
 * corpo, bastaria mandar `historico: []` para apagar o proprio rastro. Um
 * registro que o auditado pode apagar nao serve. Entao nao mandar e, alem de
 * mais barato, mais honesto com o que o servidor ja decidiu.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUE UM `replacer` E NAO UMA COPIA.
 *
 * O caminho obvio seria clonar o estado sem a trilha. Mas clonar 2,9 MB custa
 * um `stringify` + um `parse` NO NAVEGADOR de quem publica — trocar o custo de
 * lugar, nao tira-lo. O `replacer` do proprio `JSON.stringify` descarta a chave
 * durante a unica serializacao que ja ia acontecer.
 *
 * `pausa_historico` TEM OUTRO NOME e nao e afetado — a comparacao e exata, e
 * nao por prefixo. Isso e deliberado: a pausa e dado de regra, lido por
 * `prazo.js` para descontar dias, e some com ela quebraria o calculo de atraso.
 */
(function (raiz) {
  'use strict';

  /** Replacer de `JSON.stringify`: tira a trilha de auditoria do envio.
   *
   *  Usar em TODA publicacao de estado completo. A tela continua com a trilha
   *  em memoria — `capacidade.js`, `abertura.js` e `selo-validacao.js` a leem
   *  para calcular —; o que muda e so o que atravessa o fio. */
  function semTrilha(chave, valor) {
    return chave === 'historico' ? undefined : valor;
  }

  var api = { semTrilha: semTrilha };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { raiz.PUBLICACAO = api; raiz.semTrilha = semTrilha; }
}(typeof window !== 'undefined' ? window : this));
