/* ═══ OS BIs QUE A DEMANDA IMPACTA ═════════════════════════════════════════
 *
 * "Atrelar a tarefa a BIs que serão impactados por ela. Dessa forma, seria
 *  possível metrificar o impacto daquela atividade, além de gerar rastreio do
 *  que foi feito em cada BI."
 *
 * O DADO É UMA LISTA DE NOMES, e não uma tabela de BIs com id próprio. A
 * escolha é a mesma que o `catalogo.js` fez para os temas, e pelo mesmo motivo:
 * ninguém vai cadastrar BI antes de precisar dele. O catálogo NASCE DO USO — a
 * lista oferecida é a dos nomes que já foram digitados na base —, e digitar um
 * nome novo cria o BI no ato.
 *
 * O CUSTO DISSO, DECLARADO: "Carteira" e "carteira " e "Cartéira" seriam três
 * BIs num relatório. Por isso `norm` existe e `catalogo` agrupa por ela: o que
 * se mostra é a primeira grafia vista, o que se compara é a normalizada. É
 * exatamente o defeito dos 42 temas que o `catalogo.js` registra, resolvido
 * antes de acontecer em vez de depois.
 *
 * NÃO DECIDE NADA SOBRE DADOS/BI. Uma demanda pode marcar BIs sem ser do time
 * de Dados — a marca `dados_bi` diz de quem é o trabalho, esta lista diz o que
 * ele atinge, e misturar as duas faria uma demanda de Desenvolvimento que mexe
 * num dataset ficar sem como declarar isso.
 */
(function (raiz) {
  'use strict';

  var MAX_NOME = 80;
  var MAX_POR_DEMANDA = 20;

  /* A FAIXA DOS ACENTOS VEM POR ESCAPE, e não como caractere literal — mesma
     correção que `pipelines.js` e `dev-nome.js` carregam. Escrita direto, ela é
     um par de caracteres COMBINANTES invisíveis, e um editor que normalize o
     arquivo a transforma em outra coisa sem ninguém ver. */
  var ACENTOS = new RegExp('[\\u0300-\\u036f]', 'g');

  function norm(s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(ACENTOS, '')
      .replace(/\s+/g, ' ').trim().toLowerCase();
  }

  /** O nome como ele vai ser GRAVADO: espaço colapsado, aparado, cortado no
   *  limite. Sem baixar a caixa — "Carteira PJ" é o nome, e exibir "carteira
   *  pj" num relatório de comitê é outro problema. */
  function limpa(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, MAX_NOME);
  }

  /** A LISTA DE UMA DEMANDA, normalizada e sem repetida.
   *
   *  Aceita o que vier na base — string solta, `null` no meio do array, campo
   *  ausente — e devolve sempre um array de strings. O `null` no meio já
   *  aconteceu com `subtarefas`, e o remédio é o mesmo. */
  function daDemanda(m) {
    var bruto = (m || {}).bis_impactados;
    if (typeof bruto === 'string') bruto = bruto.split(/[;,]/);
    if (!Array.isArray(bruto)) return [];
    var vistos = {};
    var fora = [];
    bruto.forEach(function (x) {
      var nome = limpa(x);
      if (!nome) return;
      var k = norm(nome);
      if (vistos[k]) return;
      vistos[k] = true;
      fora.push(nome);
    });
    return fora.slice(0, MAX_POR_DEMANDA);
  }

  /** TODOS OS BIs QUE A BASE CONHECE, com quantas demandas citam cada um.
   *
   *  É o catálogo oferecido no formulário E a régua do rastreio: "o que foi
   *  feito no BI X" é esta lista filtrada por nome.
   *
   *  AGRUPA PELA NORMALIZADA e mostra a PRIMEIRA grafia vista. Duas grafias do
   *  mesmo BI viram uma linha só com a soma — que é o contrário do que
   *  aconteceu com os temas, onde 42 nomes eram menos de 42 coisas. */
  function catalogo(melhorias) {
    var porChave = {};
    (melhorias || []).forEach(function (m) {
      if (!m || m.mesclado_em) return;
      daDemanda(m).forEach(function (nome) {
        var k = norm(nome);
        if (!porChave[k]) porChave[k] = { nome: nome, qtd: 0, ids: [] };
        porChave[k].qtd += 1;
        porChave[k].ids.push(m.id);
      });
    });
    return Object.keys(porChave)
      .map(function (k) { return porChave[k]; })
      .sort(function (a, b) {
        return b.qtd - a.qtd || a.nome.localeCompare(b.nome, 'pt-BR');
      });
  }

  /** Esta demanda cita este BI? Compara pela normalizada, nunca pela grafia —
   *  um filtro que exige a mesma caixa não acha nada e parece quebrado. */
  function cita(m, nome) {
    if (!nome) return true;
    var alvo = norm(nome);
    return daDemanda(m).some(function (x) { return norm(x) === alvo; });
  }

  var api = { MAX_NOME: MAX_NOME, MAX_POR_DEMANDA: MAX_POR_DEMANDA,
              norm: norm, limpa: limpa, daDemanda: daDemanda,
              catalogo: catalogo, cita: cita };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.BIS = api;
}(typeof window !== 'undefined' ? window : this));
