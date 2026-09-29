/* ═══ O QUE A TELA CONFERE ANTES DE PUBLICAR ════════════════════════════════
 *
 * "realizei muita mudanca e nao esta gravando, ocorre erro conforme imagem e nao
 *  posso perder nada."
 *
 * O erro era "Sem responsavel para concluir: AX-081". E a SEGUNDA vez que a
 * mesma coisa acontece — a primeira foi "Escolha o sistema antes de planejar:
 * mufxdq9ocnh7k27dbb" —, e as duas tem a mesma forma:
 *
 *   o servidor recusa a publicacao INTEIRA por causa de uma demanda,
 *   a tela deixou aquela demanda chegar naquele estado,
 *   e quem esta publicando descobre na hora de publicar.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUE A TELA DEIXOU PASSAR.
 *
 * O `exigeDev` do admin cobrava responsavel em `planejado`, `em_andamento` e
 * `validacao`. `concluido` NAO estava na lista — e e exatamente em `concluido`
 * que o servidor cobra, em `entrandoEmConcluidoSemDev`. Duas listas para a mesma
 * regra, escritas em lugares diferentes, discordando no caso que importa.
 *
 * O mesmo desenho ja tinha aparecido com o sistema obrigatorio. Por isso este
 * arquivo nao e "a regra do sistema" nem "a regra do responsavel": e o lugar
 * onde moram as regras que a tela confere ANTES de enviar, para que a proxima
 * nao nasca solta de novo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A TRAVA DO SERVIDOR CONTINUA SENDO A REGRA.
 *
 * Quem grava por fora da tela — endpoint, script, aba velha — tem de esbarrar
 * nela. O que mora aqui e a MESMA regra do lado do navegador, para a pessoa
 * saber o que falta antes de enviar e ser levada ao campo, em vez de traduzir
 * uma recusa. O Worker duplica porque e um isolate e nao importa nada; o que
 * impede as duas de divergirem e invariante, que executa as duas lado a lado.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * E A TRAVA E NA TRANSICAO, E NAO NO ESTADO.
 *
 * Demanda que JA estava concluida sem responsavel nao e barrada. Travar por
 * estado faria toda gravacao falhar por causa de um registro antigo, e quem so
 * queria salvar um texto ficaria preso a um problema que nao criou. E o mesmo
 * criterio do servidor, nas duas regras.
 *
 * Por isso cada regra recebe DOIS retratos: o que vai ser gravado e o que esta
 * no servidor. */
(function (raiz) {
  'use strict';

  /* AS ETAPAS DE CADA REGRA. Sao as mesmas listas do Worker — `ETAPAS_ALOCADA`
     para o sistema e a entrada em `concluido` para o responsavel —, e a
     invariante exige que batam: ler as duas dos arquivos e compara-las e o que
     impede um valor a mais de um lado so. */
  var ETAPAS_ALOCADA = ['planejado', 'em_andamento', 'validacao', 'concluido'];
  var ETAPAS_CONCLUIDO = ['concluido'];

  function etapa(m) { return String((m || {}).status_planejamento || ''); }

  /* O ROTULO E O QUE SE LE, e o id e o que a tela usa para ABRIR a demanda.
     `m.codigo || m.id` era o defeito que originou tudo isto: demanda nova nao
     tem codigo — ele nasce na gravacao, no servidor — e sobrava o id. */
  function rotuloDe(m) {
    var titulo = String((m || {}).titulo || '').trim();
    if ((m || {}).codigo) {
      return m.codigo + (titulo ? ' · ' + titulo.slice(0, 60) : '');
    }
    return titulo ? '"' + titulo.slice(0, 60) + '"' : '(demanda sem título)';
  }

  /* ─── AS REGRAS ────────────────────────────────────────────────────────────
     Cada uma diz em que etapas cobra, como saber se a demanda cumpre, qual
     CAMPO resolve e o que dizer. O `campo` e LOGICO (`tema`, `dev`): o id do
     elemento e de cada tela, e o HTML nao da para compartilhar — `m-tema` no
     Admin, `n-tema` no painel Dev. */
  var REGRAS = [
    {
      nome: 'sistema',
      etapas: ETAPAS_ALOCADA,
      campo: 'tema',
      cumpre: function (m, ctx) { return !!(m && m.tema_id && ctx.temas[m.tema_id]); },
      motivo: 'Escolha o sistema antes de planejar — sem ele a demanda fica ' +
              'de fora do filtro, do gráfico e de todo relatório por sistema.',
    },
    {
      /* SO `concluido`, E ISSO E DE PROPOSITO.
       *
       * A primeira versao cobrava de Planejado em diante — que e o que a frase
       * do servidor diz ("De Planejado em diante toda demanda tem dono"). Mas
       * `entrandoEmConcluidoSemDev` barra so a entrada em CONCLUIDO, e a prova
       * caso a caso flagrou: a tela barrava "nova em Planejado com sistema e sem
       * dev" e o servidor deixava passar.
       *
       * Tela mais rigida que o servidor e o pior dos dois erros — a pessoa fica
       * presa por uma regra que nao existe, e nao ha nada que ela possa ler para
       * descobrir isso. Entao esta lista e a do servidor, e nao a da frase.
       *
       * As etapas anteriores continuam cobradas, e mais cedo: o `exigeDev` do
       * modal e do arraste recusa na hora de mexer, com o cursor no campo. Este
       * pre-voo existe para o que escapa ate a publicacao, e o que escapa e
       * justamente a conclusao — que nenhum dos dois cobria. */
      nome: 'responsavel',
      etapas: ETAPAS_CONCLUIDO,
      campo: 'dev',
      cumpre: function (m) { return !!String((m || {}).dev || '').trim(); },
      motivo: 'Escolha o responsável — sem ele a entrega não entra em nenhum ' +
              'relatório por pessoa.',
    },
  ];

  /* O QUE O SERVIDOR VAI BARRAR. `depois` e `antes` sao retratos no formato do
     arquivo: `{ temas, melhorias }`. Devolve a lista, vazia quando nao ha nada.

     `antes` pode vir vazio — e ai toda demanda em falta conta como entrando
     agora, que e o lado seguro: cobra-se a mais, nunca a menos. */
  function presos(depois, antes) {
    if (!depois || !Array.isArray(depois.melhorias)) return [];
    var ctx = { temas: {} };
    ((depois.temas) || []).forEach(function (t) { if (t && t.id) ctx.temas[t.id] = true; });

    var velhas = {};
    (((antes || {}).melhorias) || []).forEach(function (m) {
      if (m && m.id) velhas[m.id] = m;
    });

    var fora = [];
    depois.melhorias.forEach(function (m) {
      if (!m || m.oculto || m.mesclado_em) return;
      var velha = velhas[m.id];
      REGRAS.forEach(function (r) {
        if (r.etapas.indexOf(etapa(m)) < 0) return;
        if (r.cumpre(m, ctx)) return;
        // Ja estava assim no servidor, na mesma situacao: nao foi esta gravacao
        // que criou o problema, e o servidor tambem nao vai barrar.
        if (velha && r.etapas.indexOf(etapa(velha)) >= 0 && !r.cumpre(velha, ctx)) return;
        fora.push({ id: m.id || '', codigo: m.codigo || '',
                    titulo: String(m.titulo || '').trim(), rotulo: rotuloDe(m),
                    regra: r.nome, campo: r.campo, motivo: r.motivo });
      });
    });
    return fora;
  }

  /* O QUE A TELA PRECISA PARA AGIR: qual demanda abrir, em que campo pôr o
     cursor e o que dizer. Devolve `null` quando nao ha nada a cobrar.

     `campos` mapeia o campo LOGICO para o id do elemento daquela tela. Campo
     que a tela nao tem vem sem id: ela abre a demanda e diz o motivo, que e o
     melhor que da para fazer sem inventar um campo. */
  function primeiro(depois, antes, campos) {
    var lista = presos(depois, antes);
    if (!lista.length) return null;
    var p = lista[0];
    return { id: p.id, campo: (campos || {})[p.campo] || '', motivo: p.motivo,
             rotulo: p.rotulo, regra: p.regra, quantos: lista.length };
  }

  var api = { REGRAS: REGRAS, ETAPAS: ETAPAS_ALOCADA, ETAPAS_CONCLUIDO: ETAPAS_CONCLUIDO,
              rotuloDe: rotuloDe, presos: presos, primeiro: primeiro };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.PREVOO = api;
}(typeof window !== 'undefined' ? window : this));
