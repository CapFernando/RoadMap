/* ═══ A DEMANDA QUE NÃO CHEGOU AO SERVIDOR ══════════════════════════════════
 *
 * "Por que essa task não está sendo demonstrada no meu kanban?"
 *
 * A demanda não existia na base. Nem naquele momento, nem em nenhuma das 25
 * versões anteriores do arquivo: ela nunca foi gravada. A gravação falhou — o
 * "Erro ao publicar: Failed to fetch", que é o Worker estourando o teto de CPU
 * e o navegador traduzindo a página de erro sem CORS como falha de rede.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * O DEFEITO NÃO É A FALHA. É O QUE A TELA FAZ DEPOIS DELA.
 *
 * Quando a gravação falha, o card CONTINUA NA TELA, idêntico a um card
 * gravado. O aviso é um toast vermelho que some em segundos. Quem não estava
 * olhando naquele instante fica com uma demanda fantasma: ela aparece, abre,
 * edita, e some no primeiro F5 — ou nunca aparece para mais ninguém, que foi
 * como o caso chegou ("por que não está no kanban?").
 *
 * Pior: a tela do dev recarrega sozinha a cada 60s. O fantasma some sozinho,
 * sem nada dizendo que existiu.
 *
 * O SINAL TEM DE DURAR ENQUANTO A PERDA DURA. Um toast dura 4 segundos; a
 * demanda não gravada dura até alguém reparar.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUE UM CONJUNTO DE IDs, E NÃO UM CAMPO NA DEMANDA.
 *
 * O caminho óbvio seria `m._naoPublicada = true`. Ele contamina a base: a
 * limpeza de espelhos do Worker (`limpaEspelhos`) varre as chaves `_` do
 * TOPO do arquivo, não as de cada demanda — então o campo atravessaria e
 * ficaria gravado em disco, numa demanda que por definição acabou de ser
 * gravada com sucesso. Uma marca de "não gravado" persistida é uma contradição
 * que alguém ia passar meia hora investigando.
 *
 * Aqui a marca vive só na memória da aba, que é exatamente o tempo de vida do
 * problema que ela descreve.
 */
(function (raiz) {
  'use strict';

  var pendentes = Object.create(null);

  function lista(ids) {
    if (!ids) return [];
    if (typeof ids === 'string') return [ids];
    if (Array.isArray(ids)) return ids.filter(Boolean).map(String);
    return Object.keys(ids);            // o `patch`, que é indexado por id
  }

  /** A gravação falhou: estas demandas estão na tela e não no servidor.
   *
   *  GUARDA O CONTEÚDO, e não só o id. Uma gravação BEM-SUCEDIDA depois desta
   *  troca o estado da tela pelo do servidor (`applyData`) — e a demanda que
   *  falhou, que no servidor não existe, SOME DA TELA. Sem o conteúdo aqui, o
   *  aviso viraria "1 demanda não gravada" apontando para um card que já não
   *  existe em lugar nenhum: o texto que a pessoa escreveu estaria perdido de
   *  verdade.
   *
   *  Com ele, o aviso diz o título e dá o caminho de volta. */
  function marca(ids, conteudo) {
    var corpo = (conteudo && typeof conteudo === 'object') ? conteudo :
                (ids && typeof ids === 'object' && !Array.isArray(ids) ? ids : null);
    lista(ids).forEach(function (id) {
      var m = corpo && corpo[id];
      pendentes[id] = {
        id: id,
        titulo: (m && (m.titulo || m.title)) || (pendentes[id] && pendentes[id].titulo) || '',
        patch: m || (pendentes[id] && pendentes[id].patch) || null,
        em: new Date().toISOString(),
      };
    });
    return quantas();
  }

  /** O que ficou pendente, para a tela poder nomear e tentar de novo. */
  function itens() {
    return Object.keys(pendentes).map(function (k) { return pendentes[k]; });
  }

  /** A gravação deu certo: estas já estão no servidor.
   *
   *  LIMPA SÓ AS QUE FORAM, e não tudo. Gravar a demanda A não prova nada
   *  sobre a B que falhou antes — zerar o conjunto inteiro aqui apagaria o
   *  aviso de uma perda que continua de pé. */
  function limpa(ids) {
    lista(ids).forEach(function (id) { delete pendentes[id]; });
    return quantas();
  }

  function tem(id) { return !!pendentes[String(id)]; }
  function quantas() { return Object.keys(pendentes).length; }
  function ids() { return Object.keys(pendentes); }
  function zera() { pendentes = Object.create(null); }

  var api = { marca: marca, limpa: limpa, tem: tem, quantas: quantas,
              ids: ids, itens: itens, zera: zera };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.NAOPUBLICADA = api;
}(typeof window !== 'undefined' ? window : this));
