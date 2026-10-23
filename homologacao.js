/* ═══ A HOMOLOGAÇÃO DA ÁREA ════════════════════════════════════════════════
 *
 * "Etapa validação da área passa a ser obrigatória para todos (homologação)
 *  com esse solicitante. Até 5 dias nessa etapa; após 5 dias, automaticamente
 *  abrir campo perguntando quem homologou e se está ok. A partir daí, segue
 *  para Validação PM/PO. Não tendo resposta, fica em validação da área. Únicas
 *  movimentações possíveis: em andamento ou validação PM/PO (aqui só perante o
 *  aceite e registro)."
 *
 * E depois: "Isso deve ser obrigatório para EVOLUÇÃO. Sustentação pode passar
 * para validação da área ou ir direto para PM/PO, mas com registro de quem
 * validou a entrega."
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AS DUAS PORTAS PARA O PM/PO, E POR QUE NENHUMA DELAS É LIVRE.
 *
 *   evolução     em andamento → VALIDAÇÃO DA ÁREA → PM/PO
 *                A área homologa. Não há atalho: o que muda o produto é
 *                conferido por quem pediu antes de o PM/PO fechar.
 *
 *   sustentação  em andamento → área → PM/PO    (igual à evolução)
 *                em andamento → PM/PO           COM registro de quem validou
 *                Correção urgente não espera cinco dias de homologação. Mas
 *                "foi validado" sem nome é a mesma coisa que não validado:
 *                o atalho existe, e ele deixa rastro.
 *
 * O QUE AS DUAS TÊM EM COMUM é o registro. A diferença não é "com e sem
 * conferência", é QUEM confere e QUANDO — e em ambos os casos fica escrito.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * OS CINCO DIAS NÃO SÃO UM PRAZO QUE EXPIRA.
 *
 * Passados cinco dias, a tela PERGUNTA — não move, não devolve, não conclui.
 * "Não tendo resposta, fica em validação da área." Uma demanda que a área não
 * respondeu continua esperando, visível, e é por isso que o contador existe.
 *
 * Mover sozinho seria pior que não ter regra: produziria "homologado" sem
 * ninguém ter homologado, que é exatamente o carimbo que este fluxo existe
 * para impedir.
 */
(function (raiz) {
  'use strict';

  var DIAS_ATE_COBRAR = 5;
  var AREA = 'validacao_area';
  var PMPO = 'validacao';
  var ANDAMENTO = 'em_andamento';

  function txt(v) { return String(v == null ? '' : v).trim(); }
  function tipoDe(m) { return txt((m || {}).tipo).toLowerCase(); }

  /** A demanda é de EVOLUÇÃO para efeito desta regra?
   *
   *  SEM TIPO CONTA COMO EVOLUÇÃO, e isso é deliberado: a classificação é um
   *  campo que alguém preenche, e deixá-lo vazio não pode virar o caminho mais
   *  curto para pular a homologação. Hoje as 987 demandas vivas têm tipo — a
   *  regra existe para a que nascer sem ele. */
  function ehEvolucao(m) { return tipoDe(m) !== 'sustentacao'; }

  /** Quem homologa é o SOLICITANTE: quem pediu é quem confere se resolveu. */
  function solicitante(m) { return txt((m || {}).solicitante); }

  /** O registro da homologação, normalizado. `null` quando não houve. */
  function registro(m) {
    var h = (m || {}).homologacao;
    if (!h || typeof h !== 'object') return null;
    var quem = txt(h.quem);
    if (!quem) return null;
    return { quem: quem.slice(0, 120), em: txt(h.em).slice(0, 30),
             ok: h.ok !== false, obs: txt(h.obs).slice(0, 300) };
  }
  function homologada(m) {
    var r = registro(m);
    return !!(r && r.ok);
  }

  /* ── O CONTADOR ─────────────────────────────────────────────────────────
     Delega para `prazo.js`, que já contava os dias na área para o cartão. Duas
     contagens do mesmo número divergiriam no primeiro ajuste.

     E ELE É PROCURADO NOS DOIS MUNDOS. Só `raiz.PRAZO` funciona no navegador
     (onde `raiz` é o `window`) e devolve `null` sob Node — onde `raiz` é o
     `module.exports` deste arquivo. O efeito era silencioso e grave: a regra
     respondia "não precisa cobrar" para QUALQUER demanda, e a invariante que
     deveria provar os cinco dias passaria verde testando nada. */
  function moduloPrazo() {
    if (raiz.PRAZO && typeof raiz.PRAZO.diasNaArea === 'function') return raiz.PRAZO;
    if (typeof require === 'function') {
      try {
        var p = require('./prazo.js');
        if (p && typeof p.diasNaArea === 'function') return p;
      } catch (_) { /* no navegador não há require, e `raiz.PRAZO` já respondeu */ }
    }
    return null;
  }
  function diasNaArea(m, hoje) {
    var p = moduloPrazo();
    return p ? p.diasNaArea(m, hoje) : null;
  }

  /** Passou dos cinco dias na área, e ainda não há registro? É a hora de
   *  perguntar quem homologou. */
  function cobraHomologacao(m, hoje) {
    if (txt((m || {}).status_planejamento) !== AREA) return false;
    if (registro(m)) return false;
    var d = diasNaArea(m, hoje);
    return d != null && d >= DIAS_ATE_COBRAR;
  }

  /** O veredito de uma transição: `null` quando pode, ou `{ motivo, campo }`.
   *
   *  `campo` diz para ONDE levar a pessoa — é o que transforma "não pode" em
   *  "não pode, e o que falta está aqui". */
  function barra(m, destino, hoje) {
    var de = txt((m || {}).status_planejamento);
    var para = txt(destino);
    if (!para || de === para) return null;

    /* ── ENTRAR NA ÁREA EXIGE SOLICITANTE ──
       É ele quem homologa; sem nome, a etapa não tem dono e o contador de
       cinco dias corre para ninguém.

       E É SÓ AQUI que o campo é cobrado nas demandas antigas: 119 das abertas
       hoje não têm solicitante, e exigi-lo em toda gravação travaria quem só
       queria corrigir um texto. Quem cria uma demanda nova informa sempre —
       essa exigência vive na abertura, não aqui. */
    if (para === AREA && !solicitante(m)) {
      return { motivo: 'Informe o solicitante: é ele quem homologa nesta etapa.',
               campo: 'solicitante' };
    }

    /* ── A PORTA DO PM/PO ── */
    if (para === PMPO) {
      if (de === AREA) {
        /* "Aqui só perante o aceite e registro." Sair da área para o PM/PO sem
           o registro produziria um "homologado" que ninguém assinou. */
        if (!homologada(m)) {
          return { motivo: 'Registre quem homologou na área antes de enviar ao PM/PO.',
                   campo: 'homologacao' };
        }
        return null;
      }
      /* Vindo de qualquer outro lugar: evolução PRECISA ter passado pela área;
         sustentação pode cortar caminho, desde que diga quem validou. */
      if (ehEvolucao(m)) {
        return { motivo: 'Evolução passa pela Validação da área antes do PM/PO — ' +
                         'é a homologação de quem pediu.',
                 campo: 'etapa', sugereEtapa: AREA };
      }
      if (!homologada(m)) {
        return { motivo: 'Sustentação pode ir direto ao PM/PO, mas registre quem ' +
                         'validou a entrega.',
                 campo: 'homologacao' };
      }
      return null;
    }

    /* ── SAIR DA ÁREA ──
       "Únicas movimentações possíveis: em andamento ou validação PM/PO."
       Voltar para Em andamento é legítimo e não pede nada: a área apontou algo
       e o trabalho recomeça. Qualquer outro destino sai do fluxo. */
    if (de === AREA && para !== ANDAMENTO) {
      return { motivo: 'Da Validação da área só se vai para Em andamento ou ' +
                       'para a Validação PM/PO.',
               campo: 'etapa' };
    }
    return null;
  }

  function podeIr(m, destino, hoje) { return !barra(m, destino, hoje); }

  var api = {
    DIAS_ATE_COBRAR: DIAS_ATE_COBRAR, AREA: AREA, PMPO: PMPO, ANDAMENTO: ANDAMENTO,
    ehEvolucao: ehEvolucao, solicitante: solicitante, registro: registro,
    homologada: homologada, diasNaArea: diasNaArea,
    cobraHomologacao: cobraHomologacao, barra: barra, podeIr: podeIr,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.HOMOLOGACAO = api;
}(typeof window !== 'undefined' ? window : this));
