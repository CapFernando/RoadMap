/* ═══ A ORDEM DO QUADRO — prioridade primeiro, prazo depois ════════════════
 *
 * "A ordenação padrão deverá seguir esta sequência: Alta, Média, Baixa. Dentro
 *  de cada nível de prioridade, o sistema deverá ordenar as tarefas pela data
 *  prevista de entrega, apresentando primeiro as mais próximas do vencimento."
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ISTO E UM ARQUIVO, E NAO TRES ORDENACOES, pelo motivo de sempre nesta base:
 * a regra do prazo ja esteve escrita em quatro telas e as quatro discordavam.
 * Hoje o Admin ordena de um jeito (vencida sobe, depois prazo), o painel do dev
 * de outro (prazo, desempate por inicio) e o Gantt de um terceiro. A spec pede
 * a MESMA ordem nas tres visoes (§3.2) — tres copias voltariam a divergir no
 * primeiro ajuste.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A ATRASADA DEIXA DE SUBIR, E ISSO E UMA MUDANCA DE VERDADE.
 *
 * Hoje, no Admin, o que venceu vai para o topo da coluna acima de tudo. Pela
 * spec a ordem e da prioridade, e o atraso e DESTAQUE ("continuarão destacadas
 * em vermelho, independentemente do nível de prioridade") — destaque, e nao
 * posicao. Efeito concreto: uma demanda vencida de prioridade baixa cai para o
 * fim do quadro, onde hoje ela esta em primeiro.
 *
 * A cor nao muda: quem desenha o card continua marcando a vencida em vermelho.
 * Este arquivo nao sabe de cor nenhuma, so de ordem.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * SEM PRIORIDADE VAI PARA O FIM, e a spec nao fala desse caso.
 *
 * Nao e caso raro: na base de 28/10/2026 sao 67 das 158 demandas sem nenhuma
 * prioridade — mais do que as 33 de alta e as 52 de media. Pondo-as junto da
 * media (o "meio" aparente), elas passariam na frente das 6 de baixa que
 * alguem classificou de proposito; pondo-as na frente, a maioria do quadro
 * passaria a ser decidida por quem nao decidiu nada.
 *
 * Depois da baixa e o unico lugar honesto: ninguem disse que isto importa.
 * E e tambem o que torna o vazio VISIVEL — o PO ve no fim da coluna o que ainda
 * nao priorizou, em vez de ele se misturar ao que ja foi pensado.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A DATA DO DESEMPATE E A PROMETIDA AO SOLICITANTE.
 *
 * "Dentro de cada prioridade, as tarefas com vencimento mais próximo aparecem
 *  primeiro" — e, a partir de novembro, vencimento e a data prevista de entrega
 * ao usuario (`entrega_usuario`), a mesma que passa a mandar no atraso.
 *
 * Quem nao tem a digitada HERDA a entrega do dev, pela regra de
 * `entrega-usuario.js` — entao nenhuma demanda fica sem data de desempate so
 * porque o campo novo ainda nao foi preenchido. A regra vem de la, injetada,
 * para nao existir uma segunda definicao de "qual e a data prometida".        */
(function (raiz) {
  'use strict';

  /* A ESCADA. `alta` antes de `media` antes de `baixa`, e o resto depois de
     tudo. Numero, e nao lista indexada: o desempate abaixo soma os criterios em
     cascata, e um indice ausente (-1) poria o vazio no TOPO — exatamente o
     contrario do que esta escrito acima. */
  var PESO = { alta: 0, media: 1, baixa: 2 };
  var SEM_PRIORIDADE = 3;

  /* O FIM DA FILA PARA QUEM NAO TEM DATA. Texto, e nao `Infinity`, porque a
     comparacao e de string ISO: '9999-12-31' perde de qualquer data real em
     `localeCompare` e nao exige um ramo so para o nulo. */
  var SEM_DATA = '9999-12-31';

  function texto(v) { return String(v == null ? '' : v).trim().toLowerCase(); }

  /** O PESO DA PRIORIDADE desta demanda.
   *
   *  Aceita o que a base tem: 'alta', 'media', 'baixa', vazio e ausente. Valor
   *  desconhecido (grafia nova, importacao) cai como SEM prioridade em vez de
   *  quebrar a ordem — e aparece no fim, onde o PO o encontra para corrigir. */
  function peso(m) {
    var p = texto((m || {}).prioridade);
    return Object.prototype.hasOwnProperty.call(PESO, p) ? PESO[p] : SEM_PRIORIDADE;
  }

  /** A DATA QUE DESEMPATA — a prometida ao solicitante.
   *
   *  `prometida` entra por fora (e `ENTREGAUSU.data`) para nao haver uma
   *  segunda definicao dela aqui dentro. Sem a funcao, cai na entrega do dev:
   *  e o que `entrega-usuario.js` devolveria de qualquer forma na maioria dos
   *  casos, e deixa este arquivo utilizavel em tela que ainda nao carregou o
   *  modulo. */
  function dataDe(m, prometida) {
    var d = '';
    if (typeof prometida === 'function') d = prometida(m) || '';
    if (!d) d = String((m || {}).entrega || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : SEM_DATA;
  }

  /** O ULTIMO DESEMPATE, e ele existe para a ordem NAO TROCAR SOZINHA.
   *
   *  "Em caso de empate de prioridade e prazo, o sistema deverá manter uma
   *   ordenação consistente, preferencialmente pela data de criação."
   *
   *  Nao e detalhe: o Admin redesenha o quadro a cada 30s e o painel do dev a
   *  cada publicacao. Sem um criterio total, duas demandas empatadas trocam de
   *  lugar a cada desenho conforme a ordem em que vieram do arquivo, e o card
   *  que a pessoa ia clicar pula. O `id` fecha a conta: ele e unico, entao
   *  nunca ha empate de verdade.                                              */
  function criacao(m) {
    var c = String((m || {}).criado_em || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(c) ? c : SEM_DATA;
  }

  /** COMPARA DUAS DEMANDAS. Serve direto em `.sort()`.
   *
   *  `prometida` e opcional: passe `ENTREGAUSU.data` onde o modulo existir. */
  function compara(a, b, prometida) {
    var pa = peso(a), pb = peso(b);
    if (pa !== pb) return pa - pb;

    var da = dataDe(a, prometida), db = dataDe(b, prometida);
    if (da !== db) return da < db ? -1 : 1;

    var ca = criacao(a), cb = criacao(b);
    if (ca !== cb) return ca < cb ? -1 : 1;

    var ia = String((a || {}).id || ''), ib = String((b || {}).id || '');
    return ia < ib ? -1 : ia > ib ? 1 : 0;
  }

  /** A LISTA ORDENADA. Devolve copia: ordenar no lugar mexeria no array que a
   *  tela usa para outras contas, e ja houve defeito assim nesta base. */
  function ordena(lista, prometida) {
    return (lista || []).slice().sort(function (a, b) { return compara(a, b, prometida); });
  }

  /** O ROTULO DA FAIXA, para a tela agrupar ou explicar a ordem sem reescrever
   *  a escada. */
  function rotulo(m) {
    var p = texto((m || {}).prioridade);
    return p === 'alta' ? 'Alta' : p === 'media' ? 'Média' : p === 'baixa' ? 'Baixa'
         : 'Sem prioridade';
  }

  var api = { PESO: PESO, SEM_PRIORIDADE: SEM_PRIORIDADE, SEM_DATA: SEM_DATA,
              peso: peso, dataDe: dataDe, criacao: criacao,
              compara: compara, ordena: ordena, rotulo: rotulo };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.ORDEMKB = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
