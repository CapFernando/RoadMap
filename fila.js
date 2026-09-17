/* ─────────────────────────────────────────────────────────────────────────
   A FILA — quando uma demanda entrou, quando saiu, e o que sobrou.

   ═════════════════════════════════════════════════════════════════════════
   POR QUE ESTE ARQUIVO EXISTE.

   O relato foi um print do deck de Relatórios com a página 2 circulada: "não
   condiz com a apresentação que te mandei".

   Estava certo, e o cabeçalho unificado não resolvia — o problema não era a
   forma, era a PERGUNTA. Os dois decks respondiam coisas diferentes:

     modelo (deck Gerencial)   BACKLOG NO DIA 1 + ENTRARAM − SAÍRAM = EM ABERTO
                               "a fila cresceu ou encolheu?"
     deck de Relatórios        ENTREGAS · PONTOS · ENTRARAM · EM ABERTO HOJE
                               "quanto saiu?"

   A conta da fila existia só DENTRO do `apresGerar` do admin, amarrada a um
   mês e à base inteira. O deck de Relatórios, que recorta por assunto e por
   janela, não tinha como chegar nela — então respondia outra coisa.

   ═════════════════════════════════════════════════════════════════════════
   A CONTA PRECISA FECHAR, e é essa a regra que este arquivo guarda:

       backlogInicio + recebidas − saidas = backlogFim,   SEMPRE

   Slide de conta que não fecha é pior que slide nenhum: alguém soma na sala.
   Ela só fecha porque entrada e saída saem das MESMAS funções dos dois lados
   da igualdade — foi para isso que `abertaEm` existe, em vez de cada ponta
   filtrar com o seu próprio critério de data.

   TRÊS CASOS QUE A REGRA INGÊNUA ERRA, e que estão aqui por terem acontecido:

     SAÍDA ANTES DA ENTRADA. Há demandas com `concluido_em` anterior ao
     `criado_em` (import legado). Pela data crua elas saíam antes de entrar e o
     backlog ficava negativo. A saída nunca é anterior à entrada.

     FECHADA SEM DATA NENHUMA. Seis concluídas sem `concluido_em` e quinze
     recusadas sem `negada_em`: pela regra de data ficavam abertas para sempre,
     e o backlog crescia sozinho. Elas saem no dia em que entraram.

     RECUSADA TAMBÉM SAI DA FILA. Recusa não é entrega, mas desocupa a fila do
     mesmo jeito — contá-la só como "não entregue" fazia `saidas` menor que a
     realidade e a conta não fechava.
   ───────────────────────────────────────────────────────────────────────── */
(function (raiz) {
  'use strict';

  var FECHADO = ['concluido', 'negada'];

  function dia(v) { return String(v == null ? '' : v).slice(0, 10); }

  function viva(m) { return !!m && !m.oculto && !m.mesclado_em; }

  /** O dia em que a demanda ENTROU na fila. */
  function entrada(m) { return dia((m || {}).criado_em); }

  /** O dia em que ela SAIU, ou `''` se ainda está na fila. */
  function saida(m) {
    var e = entrada(m);
    var c = dia((m || {}).concluido_em);
    if (c) return c < e ? e : c;          // saída nunca antes da entrada
    var n = dia((m || {}).negada_em);
    if (n) return n < e ? e : n;
    // Fechada sem data: sai no dia em que entrou, senão fica aberta para sempre.
    return FECHADO.indexOf(String((m || {}).status_planejamento || '')) >= 0 ? e : '';
  }

  /** Estava na fila no fim deste dia? */
  function abertaEm(m, d) {
    var e = entrada(m);
    if (!e || e > d) return false;
    var s = saida(m);
    return !s || s > d;
  }

  /** A véspera de um dia `AAAA-MM-DD`, para medir o backlog "no dia 1". */
  function vespera(d) {
    var x = new Date(String(d) + 'T00:00:00');
    x.setDate(x.getDate() - 1);
    return x.getFullYear() + '-' +
           String(x.getMonth() + 1).padStart(2, '0') + '-' +
           String(x.getDate()).padStart(2, '0');
  }

  /** Esta data caiu dentro do período? Vazia nunca cai — e é essa a metade que
   *  se esquece: `'' <= '2026-08-31'` é verdadeiro em JavaScript, então sem a
   *  guarda toda demanda sem data entraria em toda contagem. */
  function noPeriodo(v, de, ate) {
    return !!v && v >= de && v <= ate;
  }

  /* ═══ O DIA DA ENTREGA — UMA DEFINIÇÃO, E NÃO QUATRO ══════════════════════
   *
   * "Inclusive os dados de um não estão batendo com o outro."
   *
   * Estavam mesmo. Havia QUATRO definições de "entrega do mês" em produção, e
   * as quatro alimentavam o mesmo deck. Medido, sobre os mesmos seis casos:
   *
   *                                          entregas   pontos
   *   Gerencial (kpi, frentes, prazo)            2         8
   *   Gerencial, slide "O MÊS"                   3        16
   *   Relatórios                                 4        24
   *   cortes de pontos (por dev/semana/tema)     3        24
   *
   * E isso aparecia no deck que foi apresentado: a página de FRENTES dizia
   * "170 entregas · 2174 pontos" e a de PONTOS ENTREGUES dizia "2243 pontos" —
   * 69 pontos de diferença, no mesmo arquivo.
   *
   * A ESCOLHA É DO FERNANDO, e ele escolheu: entrega é a APROVADA PELO PM/PO.
   * Etapa `concluido`, ancorada em `concluido_em`. Demanda em validação não
   * conta — ela entra no mês em que for aprovada.
   *
   * O QUE ISSO COMPRA: o número nunca volta atrás. Nada é contado antes de
   * estar fechado, então uma entrega recusada depois não faz um mês já
   * apresentado ficar errado. O que custa: o trabalho que o dev terminou em
   * 29/08 e o PM/PO aprovou em 02/09 aparece em setembro, e não em agosto.
   *
   * OS DOIS CASOS TORCIDOS SÃO OS MESMOS DA FILA, e é por isso que esta função
   * mora aqui: `concluido_em` anterior ao `criado_em` (import legado) e
   * concluída SEM `concluido_em` nenhuma. Tratá-los diferente aqui faria
   * "ENTREGAS 170" e "Das saídas: 171 entregues" continuarem discordando por
   * uma demanda — que foi exatamente o que aconteceu no deck de agosto.        */
  function entregaEm(m) {
    if (String((m || {}).status_planejamento || '') !== 'concluido') return '';
    return saida(m);
  }

  /** Esta demanda é entrega deste período? */
  function ehEntregaDe(m, de, ate) {
    if (!viva(m)) return false;
    return noPeriodo(entregaEm(m), de, ate);
  }

  function quebraTipo(lista) {
    var q = { evolucao: 0, sustentacao: 0, sem: 0 };
    (lista || []).forEach(function (m) {
      var t = String((m || {}).tipo || '');
      if (t === 'evolucao') q.evolucao += 1;
      else if (t === 'sustentacao') q.sustentacao += 1;
      else q.sem += 1;
    });
    return q;
  }

  /** A CONTA DO PERÍODO.
   *
   *  `de` e `ate` são o recorte da fila (o `ate` já é o CORTE: hoje enquanto o
   *  mês corre, o último dia quando ele fechou — quem decide isso é quem chama,
   *  porque só ele sabe se está apresentando mês fechado ou em curso).
   *
   *  `fim` é o fim do período no calendário, e é DIFERENTE de `ate` de
   *  propósito: "trabalhadas" conta o que o time pegou no mês inteiro, e não só
   *  até o corte. Passar `ate` aqui faria o número encolher no meio do mês por
   *  um motivo que não é trabalho.
   */
  function fluxo(lista, de, ate, fim) {
    var vivas = (lista || []).filter(viva);
    var fimCal = fim || ate;

    var backlogInicio = vivas.filter(function (m) { return abertaEm(m, vespera(de)); });
    var entradas = vivas.filter(function (m) {
      var c = entrada(m);
      return c >= de && c <= ate;
    });
    var saidas = vivas.filter(function (m) {
      var s = saida(m);
      return !!s && s >= de && s <= ate;
    });
    var backlogFim = vivas.filter(function (m) { return abertaEm(m, ate); });

    var tocadas = vivas.filter(function (m) {
      return noPeriodo(dia((m || {}).inicio), de, fimCal) ||
             noPeriodo(dia((m || {}).concluido_em), de, fimCal);
    }).length;

    var ehStatus = function (m, s) { return String((m || {}).status_planejamento || '') === s; };

    return {
      backlogInicio: backlogInicio.length,
      recebidas: entradas.length,
      saidas: saidas.length,
      backlogFim: backlogFim.length,
      saiuEntregue: saidas.filter(function (m) { return ehStatus(m, 'concluido'); }).length,
      saiuNegada: saidas.filter(function (m) { return ehStatus(m, 'negada'); }).length,
      tocadas: tocadas,
      /* A QUEBRA POR TIPO DE CADA CAIXA da conta. Quantidade sem ela não
         distingue um mês de construir de um mês de manter de pé o que já
         existe — e as chaves são as mesmas da conta, porque é assim que o
         slide sabe qual quebra vai em qual cartão. */
      quebra: {
        backlogInicio: quebraTipo(backlogInicio),
        recebidas: quebraTipo(entradas),
        saidas: quebraTipo(saidas),
        backlogFim: quebraTipo(backlogFim),
      },
    };
  }

  /** A conta fechou? É a invariante do arquivo, exposta para quem quiser
   *  conferir em tempo de execução (o deck confere antes de desenhar). */
  function fecha(f) {
    return !!f && (f.backlogInicio + f.recebidas - f.saidas) === f.backlogFim;
  }

  raiz.FILA = {
    entrada: entrada,
    saida: saida,
    abertaEm: abertaEm,
    vespera: vespera,
    quebraTipo: quebraTipo,
    noPeriodo: noPeriodo,
    entregaEm: entregaEm,
    ehEntregaDe: ehEntregaDe,
    fluxo: fluxo,
    fecha: fecha,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.FILA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
