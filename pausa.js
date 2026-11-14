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

  /* ═══ AGUARDANDO TERCEIRO (12/11/2026) ════════════════════════════════════
   *
   * "Quando uma task depende de um terceiro, por exemplo um fornecedor externo,
   *  precisa sinalizar uma flag/pausa com o descritivo."
   *
   * NAO E UMA ETAPA NOVA, E UMA PAUSA COM DONO DE FORA. A demanda fica na etapa
   * em que estava (em andamento, validacao...) e o relogio para do mesmo jeito:
   * prazo empurrado ao retomar, transbordo na virada, placar da sprint. O que a
   * pausa por terceiro acrescenta e QUEM segura e QUANDO prometeu voltar:
   *
   *   `pausa_terceiro` = { nome, contato, retorno }
   *     nome     o fornecedor/parceiro (obrigatorio: e o que faz ser "terceiro")
   *     contato  chamado, e-mail ou pessoa (opcional)
   *     retorno  a data que o terceiro prometeu (opcional)
   *
   * O descritivo do que se espera dele e o proprio `pausa_motivo`. Sem nome, a
   * pausa e interna, como sempre foi.                                        */
  var MIN_TERCEIRO = 2;

  /** O terceiro normalizado, ou null quando a pausa e interna. */
  function terceiroDe(t) {
    if (!t || typeof t !== 'object') return null;
    var nome = txt(t.nome).replace(/\s+/g, ' ');
    if (!nome) return null;
    return { nome: nome, contato: txt(t.contato), retorno: iso(t.retorno) };
  }

  /** O TERCEIRO SERVE? Frase do problema, ou '' — como `problemaNoMotivo`. */
  function problemaNoTerceiro(t, hoje) {
    if (!t || typeof t !== 'object') return '';
    var nome = txt(t.nome);
    var temAlgo = nome || txt(t.contato) || txt(t.retorno);
    if (!temAlgo) return '';
    if (nome.length < MIN_TERCEIRO) return 'Diga qual é o terceiro (o fornecedor ou parceiro que segura a demanda).';
    if (txt(t.retorno) && !iso(t.retorno)) return 'A data de retorno prometido está inválida.';
    var h = iso(hoje);
    if (h && iso(t.retorno) && iso(t.retorno) < h) return 'O retorno prometido não pode ser no passado — se já venceu, deixe vazio ou ponha a nova data combinada.';
    return '';
  }

  /** O terceiro da PAUSA EM CURSO, ou null (interna, ou nao pausada). */
  function terceiro(m) {
    return estaPausada(m) ? terceiroDe(m && m.pausa_terceiro) : null;
  }

  /** O retorno prometido ja passou? E o sinal de "hora de cobrar o fornecedor",
   *  e nao de atraso do dev — o prazo dele esta parado. */
  function retornoVencido(m, hoje) {
    var t = terceiro(m);
    var h = iso(hoje);
    return !!(t && t.retorno && h && t.retorno < h);
  }

  /** "Aguardando Fornecedor X · desde 05/11 · retorno 15/11". Uma frase so para
   *  todas as telas, como `situacao`. Vazio quando nao ha terceiro. */
  function rotuloTerceiro(m, hoje) {
    var t = terceiro(m);
    if (!t) return '';
    var dma = function (d) { return d.split('-').reverse().slice(0, 2).join('/'); };
    var r = 'Aguardando ' + t.nome + ' · desde ' + dma(iso(m.pausado_em));
    if (t.retorno) r += retornoVencido(m, hoje) ? ' · retorno venceu em ' + dma(t.retorno) : ' · retorno ' + dma(t.retorno);
    return r;
  }

  /** A LINHA DO TERCEIRO nos paineis de pausa das telas antigas, em texto puro
   *  (cada tela escapa). Vazio sem terceiro. */
  function linhaTerceiro(t, hoje) {
    var x = terceiroDe(t);
    if (!x) return '';
    var dmy = function (d) { return d.split('-').reverse().join('/'); };
    var h = iso(hoje);
    return 'Aguardando terceiro: ' + x.nome + (x.contato ? ' · contato: ' + x.contato : '') +
      (x.retorno ? (h && x.retorno < h ? ' · o retorno prometido para ' + dmy(x.retorno) + ' VENCEU — hora de cobrar'
                                       : ' · retorno prometido: ' + dmy(x.retorno)) : '');
  }

  /** O SELO DAS TELAS ANTIGAS (admin, dev, gantt): o texto curto, a dica do
   *  mouse e se o retorno venceu — as tres desenham o mesmo selo. */
  function selo(m, hoje) {
    var t = terceiro(m);
    var mot = txt(m && m.pausa_motivo);
    if (!t) return { texto: 'Pausada', titulo: mot, venceu: false };
    var venceu = retornoVencido(m, hoje);
    return { texto: 'Aguardando ' + t.nome + (venceu ? ' · retorno venceu' : ''), venceu: venceu,
             titulo: rotuloTerceiro(m, hoje) + (t.contato ? ' · contato: ' + t.contato : '') + (mot ? ' — ' + mot : '') };
  }

  /** O MOTIVO COM QUE A PAUSADA TRANSBORDA na virada da sprint — um texto so,
   *  no admin e no app (`sprintFecharAbrir`). Com terceiro, diz quem segura. */
  function motivoTransbordo(m) {
    var t = terceiro(m);
    var mot = txt(m && m.pausa_motivo);
    var r = t ? 'Pausada aguardando ' + t.nome + (mot ? ': ' + mot : '')
              : 'Pausada' + (mot ? ': ' + mot : ' aguardando terceiro');
    return r.slice(0, 300);
  }

  function chaveNome(v) {
    return txt(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
  }

  /** OS TERCEIROS JA USADOS NA BASE — a lista que o campo sugere.
   *
   *  SAI DAS PROPRIAS DEMANDAS, e nao de um cadastro a parte: as telas que
   *  publicam a base inteira a montam por lista FECHADA de chaves, e uma chave
   *  nova no topo seria apagada pela primeira tela que nao a conhecesse. Aqui
   *  cada nome nasce da primeira pausa que o usa ("+ novo" e so digitar) e a
   *  lista cresce sozinha. Grafias que so diferem em caixa/acento viram uma, a
   *  mais usada, para o relatorio por fornecedor nao partir o mesmo em dois. */
  function terceirosConhecidos(melhorias) {
    var conta = {};
    var add = function (t) {
      var x = terceiroDe(t);
      if (!x) return;
      var k = chaveNome(x.nome);
      var c = conta[k] || (conta[k] = { n: 0, grafias: {} });
      c.n++;
      if (!(x.nome in c.grafias)) c.ordem = (c.ordem || []).concat([x.nome]);
      c.grafias[x.nome] = (c.grafias[x.nome] || 0) + 1;
    };
    (melhorias || []).forEach(function (m) {
      if (!m) return;
      add(m.pausa_terceiro);
      if (m.pausa_pedido && typeof m.pausa_pedido === 'object') add(m.pausa_pedido.terceiro);
      (Array.isArray(m.pausa_historico) ? m.pausa_historico : []).forEach(function (h) { if (h) add(h.terceiro); });
    });
    return Object.keys(conta).map(function (k) {
      var g = conta[k].grafias;
      // A mais usada; no empate, a que apareceu primeiro (a pausa em curso vem antes).
      var ordem = conta[k].ordem;
      var nome = ordem.slice().sort(function (a, b) { return g[b] - g[a] || ordem.indexOf(a) - ordem.indexOf(b); })[0];
      return { nome: nome, usos: conta[k].n };
    }).sort(function (a, b) { return b.usos - a.usos || chaveNome(a.nome).localeCompare(chaveNome(b.nome)); });
  }

  /** Grafia ja conhecida para o nome digitado (caixa/acento), senao ele mesmo. */
  function grafiaDe(nome, melhorias) {
    var k = chaveNome(nome);
    var achado = terceirosConhecidos(melhorias).find(function (t) { return chaveNome(t.nome) === k; });
    return achado ? achado.nome : txt(nome).replace(/\s+/g, ' ');
  }

  /** O PEDIDO ABERTO, ou null. */
  function pedido(m) {
    var p = m && m.pausa_pedido;
    if (!p || typeof p !== 'object') return null;
    if (!ehData(iso(p.em))) return null;
    return { em: iso(p.em), por: txt(p.por), motivo: txt(p.motivo), terceiro: terceiroDe(p.terceiro) };
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
  function pedir(m, motivo, quem, hoje, terc) {
    var p = problemaNoMotivo(motivo) || problemaNoTerceiro(terc, hoje);
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
    var t = terceiroDe(terc);
    if (t) m.pausa_pedido.terceiro = t;
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
    m.pausa_terceiro = p.terceiro;
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
  function pausarComoAdm(m, motivo, quem, hoje, terc) {
    var p = problemaNoMotivo(motivo) || problemaNoTerceiro(terc, hoje);
    if (p) return { ok: false, erro: p };
    if (estaPausada(m)) return { ok: false, erro: 'Esta demanda já está pausada.' };
    var dia = iso(hoje);
    if (!dia) return { ok: false, erro: 'Data de hoje inválida.' };
    m.pausado_em = dia;
    m.pausa_motivo = txt(motivo);
    m.pausa_por = txt(quem);
    m.pausa_aprovada_por = txt(quem);
    m.pausa_aprovada_em = dia;
    m.pausa_terceiro = terceiroDe(terc);
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
    terceiroDe: terceiroDe, problemaNoTerceiro: problemaNoTerceiro, terceiro: terceiro,
    retornoVencido: retornoVencido, rotuloTerceiro: rotuloTerceiro, motivoTransbordo: motivoTransbordo, selo: selo, linhaTerceiro: linhaTerceiro,
    terceirosConhecidos: terceirosConhecidos, grafiaDe: grafiaDe,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.PAUSA = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
