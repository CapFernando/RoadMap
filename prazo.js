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

  /* AS ETAPAS QUE ATRAVESSAM A VIRADA DO MES — e uma pergunta DIFERENTE da do
     atraso, e por isso uma lista propria.
       "o atraso corre?"        -> nao, em validacao o dev ja entregou
       "atravessou sem concluir?" -> sim, ela continua aberta
     E DERIVADA de `ETAPAS_QUE_CORREM`, e nao escrita a mao: a parte comum das
     duas tem de andar junta. So a validacao e acrescentada, e so aqui.

     ACRESCENTAR `validacao` A LISTA DO ATRASO SERIA O DEFEITO AX-165 DE VOLTA:
     prazo 07/08, dev entregou 03/08 — quatro dias ANTES —, validacao saiu 12/08,
     e o relatorio mostrava 5 dias de atraso para quem entregou adiantado. Eram 10
     demandas e 20 dias cobrados de quem cumpriu o combinado. `ETAPAS_QUE_CORREM`
     nao muda. */
  var ETAPAS_QUE_HERDAM = ETAPAS_QUE_CORREM.concat(['validacao']);

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

  /** DIAS JA PARADOS NA PAUSA CORRENTE, ate `ref`.
   *
   *  `pausa_dias` NAO entra aqui, e a razao e evitar contar duas vezes: quando
   *  alguem clica "Retomar", `aplicarRetomada` empurra a `entrega` E acumula os
   *  dias em `pausa_dias`. Os dias ja retomados, portanto, JA ESTAO dentro da
   *  data — somar `pausa_dias` de novo daria o dobro de folga.
   *
   *  O que falta e a pausa que ainda esta correndo, e e ela que esta aqui.
   *
   *  Dias de CALENDARIO, e nao uteis: e a mesma unidade que `aplicarRetomada` usa
   *  para empurrar a data, e duas unidades para a mesma coisa fariam o prazo
   *  derivado divergir do prazo gravado.                                       */
  function diasPausados(m, ref) {
    var p = iso((m || {}).pausado_em);
    var r = iso(ref);
    if (!ehData(p) || !ehData(r) || r <= p) return 0;
    var d = function (t) {
      var q = t.split('-');
      return Date.UTC(+q[0], +q[1] - 1, +q[2]);
    };
    return Math.round((d(r) - d(p)) / 86400000);
  }

  /** O PRAZO QUE VALE — o combinado, esticado pelos dias em que a demanda esteve
   *  parada por algo fora do alcance de quem faz.
   *
   *  ISTO EXISTE PORQUE A EXTENSAO DEPENDIA DE UM CLIQUE. `aplicarRetomada`
   *  empurrava a data ao retomar, e so ali: uma demanda pausada e concluida SEM
   *  alguem clicar "Retomar" nunca tinha a data empurrada, e o relatorio cobrava
   *  os dias parados como atraso. Medido na base, nas seis pausadas com prazo:
   *  AX-084 apareceria com 20 dias de atraso, dos quais 16 foram de pausa; AX-123
   *  com 21, dos quais 9; AX-199 com 9, sendo TODOS os 9 de pausa.
   *
   *  Derivado, o desconto acontece de qualquer forma — pelo clique ou sem ele.
   *
   *  E O DEV PASSA A VER A DATA ANDAR. Antes a entrega ficava escondida durante a
   *  pausa ("Entrega oculta"), e o card mostrava a data original: quem pausou em
   *  11/08 uma demanda com prazo 30/07 olhava o proprio card e via uma data que
   *  ja passou. Dizia "pausada" e mostrava um prazo estourado — e foi assim que a
   *  queixa chegou: "o prazo continua sendo contabilizado".
   *
   *  O QUE ISTO NAO FAZ, e e importante: nao apaga o atraso que houve ANTES da
   *  pausa. Das seis pausadas com prazo, CINCO ja estavam atrasadas no dia em que
   *  foram pausadas — AX-123 estava 12 dias. Esticar a data pelos dias parados
   *  devolve os dias parados, e nao os anteriores: pausar depois do prazo estourar
   *  nao desfaz o estouro. Para isso a pausa precisaria comecar no dia em que a
   *  dependencia travou, e nao no dia do clique.                               */
  function prazoEfetivo(m, ref) {
    var pz = iso((m || {}).entrega);
    if (!ehData(pz)) return '';
    var extra = diasPausados(m, ref);
    if (!extra) return pz;
    var q = pz.split('-');
    var d = new Date(Date.UTC(+q[0], +q[1] - 1, +q[2]));
    d.setUTCDate(d.getUTCDate() + extra);
    return d.toISOString().slice(0, 10);
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
    if (!ehData(iso(m.entrega))) return null;
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
    /* O PRAZO E O EFETIVO, esticado pelos dias parados ate `ref`.
       A demanda concluida sem alguem clicar "Retomar" tinha os dias de pausa
       cobrados como atraso: AX-199 apareceria com 9 dias, sendo os 9 de pausa. */
    var pz = prazoEfetivo(m, ref);
    if (!ehData(pz)) return null;
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

  /** ESTA ATRASADA AGORA? — o que o badge, o filtro e o alerta perguntam.
   *
   *  SO ENQUANTO A DEMANDA ESTA NA ESTEIRA DO DEV. Depois que ele entrega, o
   *  atraso vira historico: aconteceu, entra no relatorio do mes, e para de ser
   *  pendencia dele.
   *
   *  Sao DUAS PERGUNTAS DIFERENTES, e eu as tinha juntado numa funcao so — o
   *  efeito foi o painel do dev anunciando "4 demandas suas estao com o prazo
   *  vencido" com as quatro JA CONCLUIDAS. Quem entregou ontem com um dia de
   *  atraso abria o painel hoje e via cobranca de coisa que ja fez.
   *
   *  Quanto a demanda atrasou, mesmo depois de entregue, e `diasDeAtraso`. */
  function estaAtrasada(m, etapa, hoje) {
    if (!ETAPAS_QUE_CORREM.includes(etapa)) return false;
    var dias = diasDeAtraso(m, etapa, hoje);
    return dias != null && dias > 0;
  }

  /** ENTREGOU COM ATRASO? — a pergunta do relatorio, e nao a do painel.
   *
   *  Vale depois da entrega: e o que permite o deck dizer "26 entregas sairam
   *  com atraso" sem que o dev veja essas mesmas 26 como pendencia aberta. */
  function atrasouNaEntrega(m) {
    var fim = fimDoDev(m);
    if (!ehData(fim)) return false;
    // O MESMO PRAZO EFETIVO da conta de dias. Comparar contra a data crua aqui
    // faria o relatorio dizer "atrasou" para uma demanda que `diasDeAtraso`
    // devolve zero — duas respostas para a mesma pergunta, no mesmo relatorio.
    var pz = prazoEfetivo(m, fim);
    if (!ehData(pz)) return false;
    return fim > pz;
  }

  /** O MES DE COMPROMISSO da demanda: 'YYYY-MM' da `entrega` GRAVADA.
   *
   *  ─────────────────────────────────────────────────────────────────────────
   *  ISTO USAVA O PRAZO EFETIVO, E ESCONDIA DEMANDA PAUSADA NA VIRADA DO MES.
   *
   *  O raciocinio antigo era: a pausa estica o prazo, e se a esticada levou a
   *  demanda para agosto, entao o compromisso dela e de agosto. Parece certo, e
   *  quebra por um detalhe: numa demanda AINDA PAUSADA, `prazoEfetivo` e
   *  `entrega + (hoje - pausado_em)`. Ela anda um dia por dia. O mes dela e,
   *  portanto, SEMPRE o mes corrente — hoje, no mes que vem e em junho do ano
   *  que vem.
   *
   *  Com isso, `herdadaDeMesAnterior` respondia `false` para ela (o mes dela
   *  "e" o mes da tela), e o Gantt caia no calculo normal de faixa — que usa a
   *  `entrega` CRUA, de agosto, fora de setembro. As duas metades discordavam, e
   *  o card nao ia para lugar nenhum: DESAPARECIA do quadro.
   *
   *  Medido no dado de producao de 01/09/2026, no quadro de setembro: das 9
   *  pausadas com prazo, 6 apareciam marcadas e TRES SUMIAM — AX-019, AX-199 e
   *  AX-210, todas prometidas para agosto. E o AX-084 aparecia com o rotulo
   *  errado: entrega 31/07, e o card dizia "⇥ ago", porque o efetivo dele ja
   *  tinha passado para agosto.
   *
   *  Pior que sumir: a marcacao PISCAVA. O AX-084 (pausado 4 dias depois do
   *  prazo) e herdado nos primeiros dias do mes e deixa de ser no meio dele —
   *  01/09 sim, 15/09 nao, 01/10 sim, 15/01 nao. Mesma demanda, ninguem mexeu
   *  em nada.
   *
   *  A CORRECAO E SEPARAR DUAS PERGUNTAS QUE NAO SAO A MESMA:
   *
   *    "quem esta devendo tempo?"      -> prazo EFETIVO. A pausa suspende o
   *                                       relogio, e `diasDeAtraso` continua
   *                                       usando o efetivo. Isto nao mudou.
   *    "de que mes e este compromisso?" -> a `entrega` GRAVADA. A pausa para o
   *                                       relogio; ela nao reescreve o mes em
   *                                       que a coisa foi prometida.
   *
   *  E NAO HA PERDA NO CASO DA RETOMADA, que era a preocupacao original:
   *  `aplicarRetomada` SOMA os dias parados na propria `entrega` e limpa o
   *  `pausado_em`. Depois de retomada, a data gravada JA inclui a extensao — ler
   *  a data crua devolve o prazo esticado, que e o que se queria. A divergencia
   *  existia so na janela em que a demanda esta pausada AGORA.
   *
   *  Para demanda sem pausa nenhuma as duas contas dao o mesmo resultado
   *  (`diasPausados` e zero), entao esta mudanca so alcanca as pausadas.
   *  ───────────────────────────────────────────────────────────────────────── */
  function mesDoPrazo(m) {
    var pz = iso((m || {}).entrega);
    return ehData(pz) ? pz.slice(0, 7) : '';
  }

  /** VEIO DE UM MES ANTERIOR? — a pergunta do Gantt na virada do mes.
   *
   *  O QUE ISTO NAO FAZ: nao move a `entrega`. A demanda continua com o prazo
   *  que foi combinado, e continua atrasada pelo tempo que esta. Migrar o DADO
   *  faria a ferramenta empurrar o compromisso sozinha — o `historico` encheria
   *  de mudancas que ninguem fez, `rolagemDeSprint` passaria a contar pulo onde
   *  houve so passagem de mes, e uma demanda parada ha 43 dias apareceria "no
   *  prazo" no mes novo. Migra a VISTA, e o prazo fica onde esta.
   *
   *  AS ETAPAS SAO AS DE `ETAPAS_QUE_HERDAM`: as tres do atraso mais `validacao`.
   *  `backlog` e `levantar_req` ficam de fora porque nada foi prometido ali.
   *
   *  `validacao` ENTRA, e a leitura dela e outra: o dev ja entregou, entao a
   *  barra dele no mes novo NAO quer dizer que ele esta trabalhando naquilo —
   *  quer dizer que a demanda de julho continua aberta, esperando o PM/PO. E a
   *  pergunta que o quadro passa a responder e "o que atravessou a virada", e nao
   *  "com o que o dev esta ocupado".
   *
   *  A PAUSADA HERDA IGUAL, e isso e proposital. O prazo dela esta suspenso — e
   *  ela nao aparece atrasada, nem conta sprint estourada —, mas suspenso nao e
   *  concluido: a demanda prometida para agosto e que segue pausada em setembro
   *  ATRAVESSOU a virada, e o quadro tem de dizer isso. Enquanto esta funcao
   *  perguntava pelo prazo efetivo, tres pausadas de producao desapareciam do
   *  quadro do mes novo em vez de aparecerem marcadas — ver `mesDoPrazo`.
   *
   *  A pausa continua visivel por conta propria: o card pausado tem hachura.
   *  Uma barra hachurada com "⇥ ago" le-se "veio de agosto e esta parada", que e
   *  a frase certa.
   *
   *  `anoMes` e o mes SENDO OLHADO ('YYYY-MM'), e nao o mes corrente: quem abre
   *  agosto em setembro tem de ver o que agosto herdou de julho. */
  function herdadaDeMesAnterior(m, etapa, anoMes, hoje) {
    if (!m || m.mesclado_em || m.oculto) return false;
    if (!ETAPAS_QUE_HERDAM.includes(etapa)) return false;
    var mes = mesDoPrazo(m);
    if (!mes || !anoMes) return false;
    /* NAO SE HERDA PARA O FUTURO. Abrir janeiro de 2027 nao pode mostrar o que
       julho de 2026 deixou pendente: aquele mes nao herdou nada ainda: seria a
       tela afirmando que a demanda continuara aberta la, e isso ninguem sabe. */
    var mesDeHoje = ehData(iso(hoje)) ? iso(hoje).slice(0, 7) : '';
    if (mesDeHoje && anoMes > mesDeHoje) return false;
    return mes < anoMes;
  }

  /** QUANTAS SPRINTS O PRAZO JA ESTOUROU — semanas inteiras passadas do combinado.
   *
   *  E `diasDeAtraso` dividido por sete, e nao uma conta nova: assim o numero do
   *  cartao e o mesmo numero do badge de atraso, e os dois de pausa ja vem
   *  descontados. Duas contas separadas para a mesma pergunta e como a regra do
   *  atraso acabou em quatro versoes que discordavam.
   *
   *  NAO CONFUNDIR COM `CAPACIDADE.rolagemDeSprint`, que mede outra coisa: la e
   *  quantas sprints o prazo foi REMARCADO (alguem mexeu na data), aqui e
   *  quantas ja passaram sem entregar (ninguem mexeu em nada). Uma demanda pode
   *  ter as duas, e sao conversas diferentes — "foi replanejada" e "esta parada".
   *
   *  Semana de sete dias corridos. Meia semana nao e sprint: 6 dias de atraso
   *  devolve 0, e o badge de dias ao lado ja diz que ha atraso. */
  function sprintsEstouradas(m, etapa, hoje) {
    var dias = diasDeAtraso(m, etapa, hoje);
    if (dias == null || dias <= 0) return 0;
    return Math.floor(dias / 7);
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
    diasPausados: diasPausados,
    prazoEfetivo: prazoEfetivo,
    diasDeAtraso: diasDeAtraso,
    estaAtrasada: estaAtrasada,
    atrasouNaEntrega: atrasouNaEntrega,
    ETAPAS_QUE_HERDAM: ETAPAS_QUE_HERDAM,
    mesDoPrazo: mesDoPrazo,
    herdadaDeMesAnterior: herdadaDeMesAnterior,
    sprintsEstouradas: sprintsEstouradas,
    hojeISO: hojeISO,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.PRAZO;
})(typeof globalThis !== 'undefined' ? globalThis : this);
