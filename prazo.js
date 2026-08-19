/* ─────────────────────────────────────────────────────────────────────────
   O PRAZO — quando o atraso comeca a contar, e quando ele PARA

   A REGRA: o atraso e do DEV ate ele entregar. Depois disso a demanda esta na
   mao do PM/PO, na etapa de validacao, e o tempo que ela passa ali nao e atraso
   de desenvolvimento — e tempo de validacao.

   O DEFEITO QUE ORIGINOU ISTO, com numero: AX-165 tinha prazo em 07/08, o dev
   entregou em 03/08 — QUATRO DIAS ANTES — e a validacao saiu em 12/08. O
   relatorio mostrava 5 dias de atraso para uma demanda entregue adiantada. Ao
   todo eram 10 demandas e 20 dias de atraso cobrados de quem entregou no prazo,
   inclusive tres que entregaram exatamente no dia combinado.

   O ATRASO NAO DESAPARECE, ELE CONGELA. Quem entregou depois do prazo continua
   atrasado, e o numero para de crescer no dia da entrega: AX-069 entregou 5 dias
   depois do combinado e vai continuar mostrando 5, hoje e no mes que vem. Zerar
   o atraso de quem entregou atrasado seria trocar um erro por outro.

   ISTO EXISTE PORQUE A REGRA ESTAVA EM QUATRO LUGARES E JA DISCORDAVA DE SI:
   `STATUS_ATRASO` era declarada em admin, gantt, dev e index, e SO o admin
   incluia 'validacao'. A mesma demanda aparecia atrasada no painel do PM e no
   prazo no quadro do dev. Nao ha como manter quatro copias de uma regra de
   negocio alinhadas — a saida e nao ter quatro.
   ───────────────────────────────────────────────────────────────────────── */
(function (raiz) {
  'use strict';

  /* AS ETAPAS EM QUE O ATRASO CORRE — aquelas em que a demanda esta com o time
     de desenvolvimento e ha compromisso assumido.

     `backlog` e `levantar_req` ficam fora: nada foi prometido ainda.
     `validacao` fica fora POR ESTA REGRA: o dev ja entregou.
     `concluido` e `negada` nao atrasam — o que houve ja esta registrado. */
  var ETAPAS_QUE_CORREM = ['planning', 'planejado', 'em_andamento'];

  // Etapas em que o dev JA SAIU DE CENA. O atraso delas e medido pela entrega,
  // e nao pelo dia de hoje nem pela data da validacao.
  var ETAPAS_APOS_O_DEV = ['validacao', 'concluido'];

  function iso(v) {
    return String(v == null ? '' : v).slice(0, 10);
  }
  function ehData(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
  }

  /** A DATA EM QUE A RESPONSABILIDADE DO DEV TERMINOU.
   *
   *  `entregue_em` e gravado no instante em que a demanda entra em validacao —
   *  e por isso ele responde "quando o dev terminou" sem depender de o PM ter
   *  validado. Quando ele nao existe, a demanda nunca passou por validacao (foi
   *  concluida direto), e ai a conclusao E o fim do trabalho do dev.
   *
   *  Nao ha adivinhacao no caminho do meio: das 80 concluidas sem `entregue_em`,
   *  NENHUMA tem transicao para validacao no historico — e 73 delas ja estao
   *  marcadas como retroativas, fora de qualquer conta de prazo. */
  function fimDoDev(m) {
    var e = iso((m || {}).entregue_em);
    if (ehData(e)) return e;
    var c = iso((m || {}).concluido_em);
    return ehData(c) ? c : '';
  }

  /** DIAS DE ATRASO, ou null quando nao ha o que medir.
   *
   *  `etapa` vem de quem chama: cada tela resolve a etapa do seu jeito
   *  (statusKey, getStatusKey, spEfetivo) e passar a etapa pronta evita esta
   *  regra depender de qual tela a esta usando.
   *
   *  `hoje` entra como argumento, e nao lido do relogio aqui: e o que deixa a
   *  regra testavel — teste que le o relogio do sistema falha sozinho na virada
   *  do dia. */
  function diasDeAtraso(m, etapa, hoje) {
    if (!m || m.mesclado_em || m.oculto) return null;
    var pz = iso(m.entrega);
    if (!ehData(pz)) return null;
    // Pausada nao atrasa: o prazo esta suspenso, nao estourado.
    if (m.pausado_em && !ETAPAS_APOS_O_DEV.includes(etapa)) return null;

    var ref;
    if (ETAPAS_APOS_O_DEV.includes(etapa)) {
      // O dev saiu de cena: o atraso e congelado na data da entrega dele.
      ref = fimDoDev(m);
      if (!ehData(ref)) return null;
    } else if (ETAPAS_QUE_CORREM.includes(etapa)) {
      ref = iso(hoje);
      if (!ehData(ref)) return null;
    } else {
      return null;   // backlog, levantar_req, negada: nada prometido ou nada a medir
    }
    if (ref <= pz) return 0;
    // Diferenca por UTC a partir das partes da data: `new Date('2026-08-01')` no
    // fuso local devolve o dia anterior em UTC-3, e um dia aqui e a diferenca
    // entre "no prazo" e "atrasada".
    var d = function (t) {
      var p = t.split('-');
      return Date.UTC(+p[0], +p[1] - 1, +p[2]);
    };
    return Math.round((d(ref) - d(pz)) / 86400000);
  }

  /** Atrasada, sim ou nao — o que o badge e o filtro perguntam. */
  function estaAtrasada(m, etapa, hoje) {
    var dias = diasDeAtraso(m, etapa, hoje);
    return dias != null && dias > 0;
  }

  /** O dia de hoje em ISO, no fuso de quem esta olhando. Uma funcao so para as
   *  quatro telas nao escreverem quatro versoes de "hoje". */
  function hojeISO() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  raiz.PRAZO = {
    ETAPAS_QUE_CORREM: ETAPAS_QUE_CORREM,
    ETAPAS_APOS_O_DEV: ETAPAS_APOS_O_DEV,
    fimDoDev: fimDoDev,
    diasDeAtraso: diasDeAtraso,
    estaAtrasada: estaAtrasada,
    hojeISO: hojeISO,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.PRAZO;
})(typeof globalThis !== 'undefined' ? globalThis : this);
