/* ═══ A DATA EM QUE O USUÁRIO RECEBE ═══════════════════════════════════════
 *
 * "Tudo que passa pela planning eu aloco a task para o dev e preencho a data de
 *  início e fim. Essa estrutura deverá ser mantida, e também vou precisar de um
 *  novo campo de data de entrega para o usuário, que será pós-PR, e pretendo
 *  diminuir os dias da PR."
 *
 * ───────────────────────────────────────────────────────────────────────────
 * SÃO DUAS DATAS DIFERENTES, E ESTA É A SEGUNDA.
 *
 *   `entrega`          quando o DEV termina. É combinada na planning, junto com
 *                      o início, e é dela que saem prazo, atraso, mês de
 *                      compromisso e capacidade. Ela não muda de significado —
 *                      é lida em cerca de 190 lugares, e mexer nela
 *                      reescreveria todo relatório já apresentado.
 *
 *   `entrega_usuario`  quando a pessoa que PEDIU recebe. É depois do PR: code
 *                      review, merge, deploy. É a data que se promete para fora
 *                      do time, e a distância entre as duas é justamente o que
 *                      se quer encurtar.
 *
 * O campo novo é ADITIVO. Nenhuma conta existente passa a lê-lo.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A HERANÇA, E POR QUE ELA É DERIVADA E NÃO GRAVADA.
 *
 * "Via de regra para não se perder: tudo que já tem data de início e fim
 *  preenchida, considerar a data fim para essa nova data de entrega."
 *
 * Medido na base de 07/10/2026: 279 das 365 demandas vivas têm as duas datas, e
 * 220 delas já estão concluídas.
 *
 * A herança é CALCULADA na leitura, e não escrita em 279 registros. Três
 * razões, e a terceira é a que decide:
 *
 *   1. Vale no mesmo instante, para a base inteira, sem gravação nenhuma.
 *   2. Uma gravação em massa é irreversível, e 220 das 279 são demandas
 *      fechadas — reescrever o passado para preencher um campo novo é o tipo de
 *      operação que ninguém consegue desfazer depois.
 *   3. O campo gravado passa a ser a RESPOSTA DE VERDADE, e o vazio passa a
 *      significar "ninguém disse ainda". Gravando a herança, as duas coisas
 *      viram a mesma, e deixa de haver como listar o que ainda falta organizar
 *      — que é exatamente o trabalho a fazer daqui para a frente.
 *
 * Por isso `herdada()` existe: a tela mostra de onde veio o valor, e quem
 * planeja enxerga o que ainda está no padrão.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * SÓ HERDA QUEM TEM AS DUAS DATAS, e isso é literal ao pedido. Há 11 demandas
 * com `entrega` e sem `inicio`: elas não herdam. Ter as duas é o sinal de que a
 * demanda passou pelo planejamento; só a entrega pode ser data solta de uma
 * demanda que ninguém alocou.                                                */
(function (raiz) {
  'use strict';

  function ehData(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }

  /* Aceita `YYYY-MM-DD` e data-hora ISO, como `prazo.js`: um campo `_em` tem
     hora, e `slice(0,10)` cru num valor invalido devolveria lixo com cara de
     data. */
  function iso(v) {
    var t = String(v || '').trim();
    if (!t) return '';
    var d = t.slice(0, 10);
    return ehData(d) ? d : '';
  }

  /** O QUE FOI DIGITADO, só. Vazio quando ninguém preencheu. */
  function explicita(m) { return iso((m || {}).entrega_usuario); }

  /** PLANEJADA = tem as duas datas da planning. É a condição da herança. */
  function planejada(m) {
    var d = m || {};
    return !!(iso(d.inicio) && iso(d.entrega));
  }

  /** A DATA QUE VALE: a digitada, ou a herdada, ou nada. */
  function data(m) {
    return explicita(m) || (planejada(m) ? iso((m || {}).entrega) : '');
  }

  /** ESTÁ VALENDO POR HERANÇA? É o que distingue "ainda não organizei" de
   *  "organizei e é esta a data". Sem isto, as duas ficam iguais na tela. */
  function herdada(m) { return !explicita(m) && data(m) !== ''; }

  /** A DATA QUE SE MOSTRA A QUEM PEDIU — no painel público de consulta.
   *
   *  NÃO É `data()`, e a diferença tem conta por trás. `data()` é a regra do
   *  planejamento: ela exige início E entrega para herdar, porque lá a pergunta
   *  é "esta já foi organizada ou ainda está no padrão?". Aqui a pergunta é
   *  outra — "quando eu recebo?" — e perder uma data que já aparecia seria
   *  regressão, não rigor: medido, 11 demandas têm entrega sem início e
   *  sumiriam do painel se ele usasse a regra estrita.
   *
   *  Então: a data pós-PR quando alguém a informou, e a do dev enquanto
   *  ninguém informou. O painel mostra hoje exatamente o que já mostrava, e
   *  passa a dizer a verdade de quem pediu à medida que o campo é preenchido.
   *
   *  A ETIQUETA DA TELA MUDA JUNTO. Mostrar a data do dev sob o nome "entrega
   *  ao usuário" seria prometer uma coisa com o número de outra; `ehDoUsuario`
   *  diz qual das duas está na mão para a tela escolher a palavra.          */
  function aMostrar(m) {
    return explicita(m) || iso((m || {}).entrega);
  }

  function ehDoUsuario(m) { return explicita(m) !== ''; }

  /** OS DIAS ENTRE O FIM DO DEV E A ENTREGA AO USUÁRIO — o que se quer
   *  encurtar. Dias de CALENDÁRIO, a mesma unidade de `prazo.js`.
   *
   *  `null` quando não dá para responder: sem uma das duas datas não há
   *  distância, e devolver 0 diria "não há espera", que é outra afirmação. */
  function diasDePr(m) {
    var fim = iso((m || {}).entrega);
    var usu = data(m);
    if (!fim || !usu) return null;
    var n = function (t) {
      var q = t.split('-');
      return Date.UTC(+q[0], +q[1] - 1, +q[2]);
    };
    return Math.round((n(usu) - n(fim)) / 86400000);
  }

  /** A ENTREGA AO USUÁRIO ANTES DO FIM DO DEV é promessa impossível: a pessoa
   *  receberia antes de existir. Devolve a frase, para a tela AVISAR sem
   *  bloquear — há ajuste em que a data do dev é que vai mudar depois.
   *
   *  SÓ A DIGITADA PODE CAIR AQUI, e isso é consequência e não guarda: sem data
   *  digitada o valor É a entrega do dev, então a distância é exatamente zero.
   *  Havia um `!explicita(m)` nesta condição e ele era inalcançável — provado
   *  varrendo 801 datas contra três formas de início, nenhuma herdada dá
   *  negativo. Condição que nunca dispara faz quem lê procurar um caso que não
   *  existe, e uma sabotagem que a removesse passaria sem a suíte notar. */
  function alerta(m) {
    var d = diasDePr(m);
    if (d === null || d >= 0) return '';
    return 'A entrega ao usuário está ' + Math.abs(d) + ' dia(s) ANTES do fim do ' +
           'desenvolvimento. Depois do PR a data só pode ser igual ou posterior.';
  }

  var api = { ehData: ehData, iso: iso, explicita: explicita, planejada: planejada,
              data: data, herdada: herdada, aMostrar: aMostrar, ehDoUsuario: ehDoUsuario,
              diasDePr: diasDePr, alerta: alerta };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.ENTREGAUSU = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
