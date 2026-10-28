/* ═══ PAUSAR PASSA A SER UM PEDIDO ════════════════════════════════════════
 *
 * "Toda demanda pausada deverá exigir justificativa e só pausa após aprovação
 *  de um dos ADM."
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O QUE MUDA, E O QUE JA ERA ASSIM.
 *
 * A JUSTIFICATIVA ja era obrigatoria — nas TELAS. As tres pedem o motivo e
 * recusam o vazio. O Worker, porem, nunca checou nada sobre pausa: uma aba
 * antiga, um script, ou um ajuste futuro numa das telas pausava sem motivo e
 * ninguem notava. Regra que so existe na tela e regra que ainda vai falhar.
 *
 * A APROVACAO nao existia. O dev pausava e valia na hora. Agora ele PEDE, e a
 * pausa comeca quando um ADM aprova.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A PAUSA APROVADA VALE DESDE O PEDIDO, E NAO DESDE O "SIM".
 *
 * O dev pede na segunda, o ADM responde na quarta: os dois dias de espera
 * entram na pausa. Cobrar esses dias do dev seria cobrar dele a agenda de outra
 * pessoa — ele fez a parte dele no instante em que avisou que travou.
 *
 * O PRECO E ASSUMIDO, e e visivel: o atraso exibido naquele card MUDA no
 * momento da aprovacao. O numero de terca nao bate com o de quarta. Por isso a
 * aprovacao fica registrada com as duas datas — a do pedido e a do sim —, para
 * a diferenca ter explicacao em vez de parecer numero instavel.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O ADM PAUSA DIRETO, e isso nao e exececao de favor: quem aprova nao pede a si
 * mesmo. A justificativa continua obrigatoria para ele, e o registro diz que a
 * pausa nasceu ja aprovada. E tambem a saida quando o dev esta fora e alguem
 * precisa parar o relogio.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ONDE A REGRA E COBRADA DE VERDADE: no Worker. `dev-publish` recusa qualquer
 * envio que crie ou mexa em `pausado_em` — o painel do dev so pode mandar
 * `pausa_pedido`. `publish` (Admin e Planejamento) ja e restrito a ADM, entao
 * ali a pausa e legitima por construcao; o que falta cobrar ali e a
 * justificativa.                                                             */
(function (raiz) {
  'use strict';

  function txt(v) { return String(v == null ? '' : v).trim(); }
  function ehData(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }
  function iso(v) {
    var d = String(v == null ? '' : v).slice(0, 10);
    return ehData(d) ? d : '';
  }

  /* Tamanho minimo da justificativa. Nao e burocracia: "ok", "x" e "." passam
     por "obrigatorio" e nao explicam nada dias depois, que e exatamente quando
     alguem pergunta por que o prazo foi empurrado. Dez caracteres cabem em
     "sem o banco" e barram o ponto solto. */
  var MIN_MOTIVO = 10;

  /** A JUSTIFICATIVA SERVE? Devolve a frase do problema, ou '' quando serve.
   *  Frase, e nao booleano: quem chama precisa DIZER o que falta, e um booleano
   *  obriga cada tela a reinventar o texto — tres textos diferentes para a
   *  mesma recusa. */
  function problemaNoMotivo(motivo) {
    var m = txt(motivo);
    if (!m) return 'Escreva por que a demanda precisa parar.';
    if (m.length < MIN_MOTIVO) {
      return 'A justificativa está curta demais (' + m.length + ' de ' +
             MIN_MOTIVO + ' caracteres). Diga o que trava a demanda.';
    }
    return '';
  }

  /** Quem pode aprovar. PM/PO (`papel` admin) — a mesma conta que ja decide
   *  etapa, prazo e pontuacao. */
  function podeAprovar(papel) {
    return String(papel || '').toLowerCase() === 'admin';
  }

  /** O PEDIDO ABERTO, ou null. */
  function pedido(m) {
    var p = m && m.pausa_pedido;
    if (!p || typeof p !== 'object') return null;
    if (!ehData(iso(p.em))) return null;
    return { em: iso(p.em), por: txt(p.por), motivo: txt(p.motivo) };
  }

  function temPedido(m) { return !!pedido(m); }
  function estaPausada(m) { return !!iso(m && m.pausado_em); }

  /** EM QUE PE ESTA A PAUSA desta demanda. Um nome so para as tres telas
   *  desenharem o mesmo estado — sem isto, cada uma decide por conta e a
   *  mesma demanda aparece "aguardando" numa e "parada" na outra. */
  function situacao(m) {
    if (estaPausada(m)) return 'pausada';
    if (temPedido(m)) return 'aguardando';
    return 'correndo';
  }

  /* ── AS TRANSICOES ──────────────────────────────────────────────────────
     Todas MUTAM a demanda e devolvem o que a tela precisa dizer. Mutar e o que
     as telas ja fazem (`aplicarPausa`, `aplicarRetomada`); o que muda e o
     numero de copias da regra, que passa a ser uma. */

  /** O DEV PEDE. Nao pausa nada — so registra o pedido e a data dele, que e a
   *  data que valera se o ADM aprovar. */
  function pedir(m, motivo, quem, hoje) {
    var p = problemaNoMotivo(motivo);
    if (p) return { ok: false, erro: p };
    if (estaPausada(m)) return { ok: false, erro: 'Esta demanda já está pausada.' };
    /* PEDIR DE NOVO POR CIMA DE UM PEDIDO ABERTO REINICIAVA A DATA, e isso
       custava ao dev os dias que ele ja tinha esperado — em silencio, e no
       campo que a regra inteira existe para proteger. Descoberto pela
       invariante que executa o ciclo: ela aprovou um pedido de 02/11 e recebeu
       uma pausa comecando em 03/11.
       Recusa em vez de atualizar: querendo refazer, ha "Cancelar o pedido", e
       ai a data recomeca porque a pessoa DECIDIU que recomeca. */
    var aberto = pedido(m);
    if (aberto) {
      return { ok: false, erro: 'Já existe um pedido de pausa de ' +
               aberto.em.split('-').reverse().join('/') +
               ' esperando resposta. Cancele-o antes de pedir de novo.' };
    }
    var dia = iso(hoje);
    if (!dia) return { ok: false, erro: 'Data de hoje inválida.' };
    m.pausa_pedido = { em: dia, por: txt(quem), motivo: txt(motivo) };
    return { ok: true, em: dia };
  }

  /** O ADM APROVA. `pausado_em` recebe a data DO PEDIDO, e nao a de hoje. */
  function aprovar(m, quem, hoje) {
    var p = pedido(m);
    if (!p) return { ok: false, erro: 'Não há pedido de pausa nesta demanda.' };
    m.pausado_em = p.em;
    m.pausa_motivo = p.motivo;
    m.pausa_por = p.por;
    m.pausa_aprovada_por = txt(quem);
    m.pausa_aprovada_em = iso(hoje);
    m.pausa_pedido = null;
    /* OS DIAS QUE A APROVACAO DEVOLVE, para a tela poder dizer o numero em vez
       de um "pronto" mudo. Quem aprova precisa ver o tamanho do que aprovou. */
    return { ok: true, desde: p.em, dias: diasEntre(p.em, iso(hoje)) };
  }

  /** O ADM RECUSA, com motivo. Fica registrado: e o que permite dizer depois
   *  "esta ja foi pedida duas vezes e negada". */
  function recusar(m, quem, motivo, hoje) {
    var p = pedido(m);
    if (!p) return { ok: false, erro: 'Não há pedido de pausa nesta demanda.' };
    var prob = problemaNoMotivo(motivo);
    if (prob) return { ok: false, erro: prob };
    m.pausa_recusas = (Array.isArray(m.pausa_recusas) ? m.pausa_recusas : []).concat([{
      em: iso(hoje), por: txt(quem), motivo: txt(motivo),
      pedido_em: p.em, pedido_por: p.por, pedido_motivo: p.motivo,
    }]);
    m.pausa_pedido = null;
    return { ok: true, quantas: m.pausa_recusas.length };
  }

  /** O ADM PAUSA DIRETO, sem passar por pedido. Nasce aprovada. */
  function pausarComoAdm(m, motivo, quem, hoje) {
    var p = problemaNoMotivo(motivo);
    if (p) return { ok: false, erro: p };
    if (estaPausada(m)) return { ok: false, erro: 'Esta demanda já está pausada.' };
    var dia = iso(hoje);
    if (!dia) return { ok: false, erro: 'Data de hoje inválida.' };
    m.pausado_em = dia;
    m.pausa_motivo = txt(motivo);
    m.pausa_por = txt(quem);
    m.pausa_aprovada_por = txt(quem);
    m.pausa_aprovada_em = dia;
    m.pausa_pedido = null;
    return { ok: true, em: dia };
  }

  /** O DEV DESISTE do proprio pedido, antes de alguem responder. Sem isto, um
   *  pedido feito por engano so sairia pedindo a um ADM que o negue. */
  function desistir(m) {
    if (!temPedido(m)) return { ok: false, erro: 'Não há pedido para cancelar.' };
    m.pausa_pedido = null;
    return { ok: true };
  }

  function diasEntre(de, ate) {
    var a = iso(de), b = iso(ate);
    if (!a || !b || b < a) return 0;
    var n = function (t) { var q = t.split('-'); return Date.UTC(+q[0], +q[1] - 1, +q[2]); };
    return Math.round((n(b) - n(a)) / 86400000);
  }

  /* ═══ A TRAVA DO SERVIDOR ═════════════════════════════════════════════════
   *
   * O QUE O PAINEL DO DEV NAO PODE MANDAR. Ele pede; quem pausa e o ADM.
   *
   * Compara o que chegou com o que esta gravado: se `pausado_em` passou a
   * existir, ou mudou de dia, o envio esta pausando — e o painel do dev nao
   * tem essa caneta. Devolve a lista do que foi tentado, para a recusa poder
   * NOMEAR a demanda em vez de dizer "algo deu errado".
   *
   * `limpar` a pausa (retomar) NAO entra aqui: retomar nao e pausar, e travar
   * a retomada deixaria a demanda presa esperando um ADM para voltar a andar —
   * o contrario do que a regra quer.                                        */
  function pausasIndevidas(recebidas, servidor) {
    var antes = {};
    (servidor || []).forEach(function (m) { if (m && m.id) antes[m.id] = m; });
    var fora = [];
    (recebidas || []).forEach(function (m) {
      if (!m || !m.id) return;
      var novo = iso(m.pausado_em);
      if (!novo) return;                       // sem pausa, ou retomando
      var velho = iso((antes[m.id] || {}).pausado_em);
      if (novo === velho) return;              // ja estava assim, nao e tentativa
      fora.push({ id: m.id, codigo: m.codigo || '', titulo: m.titulo || '',
                  rotulo: m.codigo || m.titulo || m.id, de: velho, para: novo });
    });
    return fora;
  }

  /** PAUSA SEM JUSTIFICATIVA, venha de onde vier. Vale tambem para o ADM: a
   *  trava de cima cuida de QUEM pausa, e esta cuida de COM QUE MOTIVO. */
  function pausasSemMotivo(recebidas, servidor) {
    var antes = {};
    (servidor || []).forEach(function (m) { if (m && m.id) antes[m.id] = m; });
    var fora = [];
    (recebidas || []).forEach(function (m) {
      if (!m || !m.id) return;
      var novo = iso(m.pausado_em);
      if (!novo) return;
      var velho = iso((antes[m.id] || {}).pausado_em);
      if (novo === velho) return;              // pausa antiga nao e recobrada
      if (!problemaNoMotivo(m.pausa_motivo)) return;
      fora.push({ id: m.id, codigo: m.codigo || '', titulo: m.titulo || '',
                  rotulo: m.codigo || m.titulo || m.id,
                  motivo: problemaNoMotivo(m.pausa_motivo) });
    });
    return fora;
  }

  /** A APROVACAO NAO PODE PERDER A RETROATIVIDADE NO CAMINHO.
   *
   *  Se o servidor tinha um pedido e o envio chega com a demanda pausada, a
   *  data tem de ser a DO PEDIDO. Um ajuste futuro numa tela que gravasse
   *  `hoje` ali devolveria ao dev os dias de espera — calado, e sem ninguem
   *  conseguir apontar quando comecou. */
  function aprovacoesComDataErrada(recebidas, servidor) {
    var antes = {};
    (servidor || []).forEach(function (m) { if (m && m.id) antes[m.id] = m; });
    var fora = [];
    (recebidas || []).forEach(function (m) {
      if (!m || !m.id) return;
      var novo = iso(m.pausado_em);
      if (!novo) return;
      var ped = pedido(antes[m.id]);
      if (!ped) return;                        // nao veio de pedido: ADM pausou direto
      if (novo === ped.em) return;
      fora.push({ id: m.id, rotulo: m.codigo || m.titulo || m.id,
                  pedido_em: ped.em, gravado: novo });
    });
    return fora;
  }

  var api = {
    MIN_MOTIVO: MIN_MOTIVO,
    problemaNoMotivo: problemaNoMotivo, podeAprovar: podeAprovar,
    pedido: pedido, temPedido: temPedido, estaPausada: estaPausada, situacao: situacao,
    pedir: pedir, aprovar: aprovar, recusar: recusar,
    pausarComoAdm: pausarComoAdm, desistir: desistir, diasEntre: diasEntre,
    pausasIndevidas: pausasIndevidas, pausasSemMotivo: pausasSemMotivo,
    aprovacoesComDataErrada: aprovacoesComDataErrada,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.PAUSA = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
