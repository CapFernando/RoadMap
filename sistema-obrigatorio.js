/* ═══ O SISTEMA É OBRIGATÓRIO A PARTIR DE PLANEJADO ═════════════════════════
 *
 * "Melhore a jornada: em vez de dar erro, levar o usuário para o campo que é
 *  obrigatório o preenchimento."
 *
 * A regra em si é do Worker, e continua sendo: quem grava por fora da tela —
 * endpoint, script, aba velha — tem de esbarrar nela. O que mora aqui é a
 * MESMA regra do lado do navegador, para a tela saber o que falta ANTES de
 * enviar e levar a pessoa até o campo, em vez de traduzir uma recusa.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUE VIROU MÓDULO NA SEGUNDA TELA, E NÃO NA PRIMEIRA.
 *
 * O Admin ganhou a conferência escrita na própria página. Quando o painel Dev
 * pediu a mesma jornada, escrevê-la de novo lá dentro daria TRÊS cópias de uma
 * regra só — Worker, Admin, Dev — e duas delas para manter de acordo na mão.
 * Esta base já pagou essa conta: o comentário do `populateSistemaModulo` conta
 * que a regra de Sistema/Módulo morou em QUATRO cópias, "e é exatamente por
 * isso que a lista divergiu entre as telas".
 *
 * Sobram duas: esta e a do Worker. A do Worker existe porque ele não importa
 * nada — é um isolate, e a duplicação ali é deliberada. O que impede as duas de
 * divergirem é invariante, que executa as duas lado a lado caso a caso.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A TRAVA É NA TRANSIÇÃO, E NÃO NO ESTADO.
 *
 * Demanda que JÁ estava alocada sem sistema não é barrada. Travar por estado
 * faria toda gravação falhar por causa de um registro antigo, e quem só queria
 * salvar um texto ficaria preso a um problema que não criou. Mesmo critério das
 * horas e do responsável.
 *
 * Por isso a função recebe DOIS retratos: o que vai ser gravado e o que está no
 * servidor. Sem o segundo não há como distinguir "acabou de subir para
 * Planejado sem sistema" de "está assim desde sempre". */
(function (raiz) {
  'use strict';

  /* AS ETAPAS EM QUE O SISTEMA É COBRADO. É a mesma lista do `ETAPAS_ALOCADA` do
     Worker, e a invariante exige que sejam idênticas — ler as duas dos arquivos
     e compará-las é o que impede um `planning` a mais de um lado só. */
  var ETAPAS = ['planejado', 'em_andamento', 'validacao', 'concluido'];

  function etapa(m) { return String((m || {}).status_planejamento || ''); }
  function alocada(m) { return ETAPAS.indexOf(etapa(m)) >= 0; }

  /* O RÓTULO É O QUE SE LÊ, e o id é o que a tela usa para ABRIR a demanda.
     `m.codigo || m.id` era o defeito que originou tudo isto: demanda nova não
     tem código — ele nasce na gravação, no servidor — e sobrava o id. Foi assim
     que a recusa chegou como "Escolha o sistema antes de planejar:
     mufxdq9ocnh7k27dbb", que ninguém consegue resolver. */
  function rotuloDe(m) {
    var titulo = String((m || {}).titulo || '').trim();
    if ((m || {}).codigo) {
      return m.codigo + (titulo ? ' · ' + titulo.slice(0, 60) : '');
    }
    return titulo ? '"' + titulo.slice(0, 60) + '"' : '(demanda sem título)';
  }

  function item(m) {
    return { id: (m && m.id) || '', codigo: (m && m.codigo) || '',
             titulo: String((m && m.titulo) || '').trim(), rotulo: rotuloDe(m) };
  }

  /* A FRASE MORA AQUI, pelo mesmo motivo do `abertura.js`: duas telas dizendo a
     mesma recusa com palavras diferentes ensinam que a regra "depende da tela". */
  var MOTIVO = 'Escolha o sistema antes de planejar — sem ele a demanda fica ' +
               'de fora do filtro, do gráfico e de todo relatório por sistema.';

  /* QUEM ESTÁ PRESO. `depois` e `antes` são retratos no formato do arquivo:
     `{ temas, melhorias }`. Devolve a lista, vazia quando não há nada a cobrar.

     `antes` pode vir vazio — e aí toda demanda alocada sem sistema conta como
     entrando agora, que é o lado seguro: cobra-se a mais, nunca a menos. */
  function presos(depois, antes) {
    if (!depois || !Array.isArray(depois.melhorias)) return [];
    var temas = {};
    ((depois.temas) || []).forEach(function (t) { if (t && t.id) temas[t.id] = true; });
    var temSistema = function (m) { return !!(m && m.tema_id && temas[m.tema_id]); };

    var velhas = {};
    (((antes || {}).melhorias) || []).forEach(function (m) {
      if (m && m.id) velhas[m.id] = m;
    });

    var fora = [];
    depois.melhorias.forEach(function (m) {
      if (!m || m.oculto || m.mesclado_em) return;
      if (!alocada(m)) return;
      if (temSistema(m)) return;
      var velha = velhas[m.id];
      // Já estava assim no servidor: não foi esta gravação que criou o problema.
      if (velha && alocada(velha) && !temSistema(velha)) return;
      fora.push(item(m));
    });
    return fora;
  }

  /* O QUE A TELA PRECISA PARA AGIR: qual demanda abrir e em que campo pôr o
     cursor. Devolve `null` quando não há nada a cobrar.

     `campo` é o id do elemento, e ele DIFERE entre as telas — `m-tema` no Admin,
     `n-sistema` no painel Dev. Quem chama diz o seu; a regra não conhece o HTML
     de ninguém. */
  function primeiro(depois, antes, campo) {
    var lista = presos(depois, antes);
    if (!lista.length) return null;
    return { id: lista[0].id, campo: campo || '', motivo: MOTIVO,
             rotulo: lista[0].rotulo, quantos: lista.length };
  }

  var api = { ETAPAS: ETAPAS, MOTIVO: MOTIVO, alocada: alocada,
              rotuloDe: rotuloDe, presos: presos, primeiro: primeiro };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.SISTEMA = api;
}(typeof window !== 'undefined' ? window : this));
