/* ─────────────────────────────────────────────────────────────────────────
   AXIS — as acoes sobre a demanda (axis.html).

   O QUE ANTES ERA LINK PARA O EDITOR ANTIGO: mover de etapa, validar e fechar
   (o selo de quem validou), devolver com motivo, registrar a homologacao da
   area, replanejar o prazo, pausar e retomar (com o pedido do dev e a resposta
   do PM/PO), negar e entregar (dev).

   CADA ACAO E UM PATCH, e o patch e o MESMO que a tela antiga gravaria. As
   funcoes de `REGRAS` nao tocam DOM nem rede: recebem a demanda como esta, o
   que a pessoa escolheu e o contexto (papel, quem, hoje, agora) e devolvem
   `{ ok, patch, msg }` ou `{ ok: false, erro, campo }`. A origem de cada uma:

     mover          kbDrop + marcaConclusao (admin.html); saveStatus +
                    updateStatus (dev.html), com ETAPAS_DO_DEV
     validar        valDecidir(true)  (admin.html)
     devolver       valDecidir(false) + valRejeitar (admin.html)
     homologar      homologRegistra (admin.html) = msHomologRegistra (dev.html)
     replanejar     o campo Entrega do formulario do admin (so o PM/PO: o
                    servidor devolve a data do dev a partir de Planejado)
     pausar         pausaIniciar  -> PAUSA.pausarComoAdm
     pedirPausa     devPausaIniciar -> PAUSA.pedir
     desistirPausa  devPausaDesistir -> PAUSA.desistir
     aprovarPausa   pausaAprovar  -> PAUSA.aprovar
     recusarPausa   pausaRecusar  -> PAUSA.recusar
     retomar        aplicarRetomada (admin.html e dev.html, iguais)
     negar          saveMelhoria com etapa Negada (motivo obrigatorio)
     entregar       saveStatus/updateStatus para a area ou o PM/PO (dev.html)
     casoUso        cuMarcar (admin.html): enviado, aprovado ou ajustes do
                    caso de uso de "Em aprovacao de requisitos"

   As regras de verdade sao dos modulos (`pausa.js`, `homologacao.js`,
   `devolucao.js`, `sprint.js`, `prevoo.js`, `vinculo.js`): aqui so se escolhe
   qual perguntar e em que ordem, como as telas antigas fazem. Quem decide no
   fim continua sendo o servidor — a recusa dele chega como aviso, com a frase
   dele.

   Gravar e `H.gravar` (gravacao.js): base fresca, patch por cima, pre-voo,
   `publish` para o admin e `dev-publish` para o resto.

   Publica `window.AXIS_ACOES` e, no Node, `module.exports` com as REGRAS — a
   suite de invariantes executa cada uma.
   ───────────────────────────────────────────────────────────────────────── */
(function (raiz) {
  'use strict';

  // ══ REGRAS (puras) ════════════════════════════════════════════════════
  /* `c` = { papel, quem, hoje, agora, lista, aprovadores, R }. `R` traz os
     modulos (no Node, os `require`); sem ele, vale o global da pagina. */
  function mod(c, nome) { return (c && c.R && c.R[nome]) || raiz[nome] || null; }
  function txt(v) { return String(v == null ? '' : v).trim(); }
  function ehData(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }
  function copia(m) { return JSON.parse(JSON.stringify(m || {})); }
  function falha(erro, campo) { return { ok: false, erro: erro, campo: campo || '' }; }

  /* O `status` legado que acompanha a etapa. DOIS MAPAS, como nas telas: o do
     admin (`SP_TO_STATUS`) nao tem as validacoes — ali o arraste mantem o que
     estava —, e o do painel do dev (`STATUS_POR_ETAPA`) tem. */
  var STATUS_ADMIN = { backlog: 'recebida', levantar_req: 'recebida', planning: 'estimada', planejado: 'estimada',
                       em_andamento: 'iniciada', concluido: 'iniciada', atrasado: 'iniciada', negada: 'negada' };
  var STATUS_DEV = { backlog: 'recebida', levantar_req: 'recebida', planning: 'estimada', planejado: 'estimada',
                     em_andamento: 'iniciada', validacao_area: 'iniciada', validacao: 'iniciada',
                     concluido: 'iniciada', atrasado: 'iniciada' };
  /* O que o painel do dev move (`ETAPAS_DO_DEV`, dev.html). O servidor devolve
     qualquer outra (`ETAPAS_QUE_O_DEV_MOVE`, worker.js). */
  var ETAPAS_DO_DEV = ['em_andamento', 'validacao_area', 'validacao'];
  var ETAPAS_COM_DEV = ['planejado', 'em_andamento', 'validacao_area', 'validacao'];
  var ETAPAS_VALIDAS = ['backlog', 'levantar_req', 'planning', 'planejado', 'em_andamento',
                        'validacao_area', 'validacao', 'concluido', 'negada'];

  function etapa(m) { return txt((m || {}).status_planejamento); }
  /** admin e analista tem a caneta do PM/PO para etapa; o dev, so a dele. */
  function ehDev(c) { return txt((c || {}).papel) === 'dev'; }

  /* COPIA DE `gestoSemDev` (admin.html): planejado, em andamento e validacoes
     por ESTADO; concluido por TRANSICAO, como o servidor. Planejado com sprint
     marcada fica sem dono de proposito (`SPRINTPO.dispensaDev`). */
  function gestoSemDev(velha, destino, dev, sprint, c) {
    if (txt(dev)) return false;
    var SP = mod(c, 'SPRINTPO');
    if (SP && SP.dispensaDev(destino, sprint)) return false;
    if (ETAPAS_COM_DEV.indexOf(destino) >= 0) return true;
    if (destino !== 'concluido') return false;
    return etapa(velha) !== 'concluido';
  }

  /* COPIA DE `marcaConclusao` (admin.html), devolvendo os campos em vez de
     mutar: chegar a Concluido estampa a data (e a entrega do dev, se faltar);
     sair dela limpa, e a marca de retroativo sai junto (`undefined` apaga). */
  function marcaConclusao(m, destino, hoje) {
    var p = {};
    if (destino === 'concluido') {
      var ce = txt(m.concluido_em) || hoje;
      if (!txt(m.concluido_em)) p.concluido_em = ce;
      if (!txt(m.entregue_em)) p.entregue_em = ce;
    } else if (txt(m.concluido_em)) {
      p.concluido_em = '';
      p.concluido_retroativo = undefined;
    }
    return p;
  }

  /** Concluir sem hora registrada (`faltaHorasPara`, admin.html). */
  function faltaHoras(m, destino) {
    if (destino !== 'concluido' || etapa(m) === 'concluido') return false;
    var h = Number((m || {}).horas_realizadas);
    return !isFinite(h) || h <= 0;
  }

  /* SPIKE SEM AS TRES ASSINATURAS. So barra quando se SABE quem assina — a
     mesma prudencia de `spikeQuemAssina` no admin: sem a lista, deixa ir e o
     servidor recusa se precisar. */
  function faltaAssinatura(m, c) {
    var PV = mod(c, 'PREVOO');
    if (!m || !m.spike || !PV || !c || !Array.isArray(c.aprovadores)) return '';
    var valem = PV.assinaturasValidas(m, c.aprovadores);
    if (valem.length >= PV.ASSINATURAS_SPIKE) return '';
    return 'Este spike tem ' + valem.length + ' de ' + PV.ASSINATURAS_SPIKE + ' aprovações — ' +
           'as assinaturas ficam no editor da Área administrativa.';
  }

  /** As travas de qualquer movimento, na ordem do `kbDrop`. */
  function travaDoMovimento(m, destino, c) {
    if (gestoSemDev(m, destino, m.dev, m.sprint_po, c)) {
      return falha('"' + (m.codigo || m.titulo) + '" precisa de desenvolvedor para ir a ' + rotulo(destino) + '.', 'dev');
    }
    var SP = mod(c, 'SPRINTPO');
    if (SP) {
      var ta = SP.travaDeAlocacao(m, etapa(m), destino, c.hoje);
      if (ta && ta.trava) return falha(ta.motivo, 'sprint');
    }
    if (destino === 'concluido') {
      var sp = faltaAssinatura(m, c);
      if (sp) return falha(sp, '');
    }
    var HO = mod(c, 'HOMOLOGACAO');
    if (HO) {
      var hb = HO.barra(m, destino, c.hoje);
      if (hb) return falha(hb.motivo, hb.campo === 'etapa' ? '' : hb.campo);
    }
    if (faltaHoras(m, destino)) {
      return falha('"' + (m.codigo || m.titulo) + '" precisa das horas de desenvolvimento para concluir — é a única medida de custo da base.', 'horas');
    }
    return null;
  }

  var ROTULOS = { backlog: 'Backlog', levantar_req: 'Em aprovação de requisitos', planning: 'Planning', planejado: 'Planejado',
                  em_andamento: 'Em Andamento', validacao_area: 'Validação da área', validacao: 'Validação PM/PO',
                  concluido: 'Concluído', negada: 'Negada' };
  function rotulo(e) { return ROTULOS[e] || e; }

  /* A DATA DA ENTREGA DO DEV (`updateStatus`, dev.html): ir para a area
     carimba; ir ao PM/PO carimba, salvo vindo da area (e a mesma entrega
     seguindo); concluir direto carimba se faltar. */
  function carimboDeEntrega(m, destino, agora) {
    var vindoDaArea = etapa(m) === 'validacao_area';
    if (destino === 'validacao_area') return agora;
    if (destino === 'validacao' && (!vindoDaArea || !m.entregue_em)) return agora;
    if (destino === 'concluido' && !m.entregue_em) return agora;
    return m.entregue_em || '';
  }

  /* VOLTOU AO BACKLOG, SAI SEM DATA DE INICIO — `tiraInicioDoBacklog` do
     Worker, que o admin repete na publicacao: Backlog com inicio no passado e
     lido como Em andamento (`ETAPA.gravada`), e o card nao mudaria de coluna. */
  function tiraInicioDoBacklog(m) {
    return m && m.status_planejamento === 'backlog' && String(m.inicio || '').trim() ? { inicio: '' } : {};
  }

  /* AS PORTAS DO `dev-publish` QUE O PAINEL DO PM/PO NAO TEM. Quem nao e admin
     (analista e dev) grava por ali, e o servidor recusa: tirar de Em andamento
     sem horas (`saindoDeAndamentoSemHoras`, 04/11/2026) e entrar numa validacao
     sem as horas e o texto do que foi feito (`entrandoEmValidacaoSemEntrega`,
     o texto tambem na area desde 02/11/2026). O publish do admin nao muda. */
  function travaDoDevPublish(m, destino, c) {
    if (txt((c || {}).papel) === 'admin') return null;
    var h = Number((m || {}).horas_realizadas);
    var semHoras = !isFinite(h) || h <= 0;
    if (etapa(m) === 'em_andamento' && destino !== 'em_andamento' && semHoras) {
      return falha('Para tirar "' + (m.codigo || m.titulo) + '" de Em andamento, lance as horas trabalhadas.', 'horas');
    }
    if ((destino === 'validacao' || destino === 'validacao_area') && etapa(m) !== destino) {
      if (semHoras) return falha('Informe as horas trabalhadas para mandar a ' + rotulo(destino) + '.', 'horas');
      if (!txt(m.implementacao)) return falha('Para ir a ' + rotulo(destino) + ' falta o texto do que foi implementado — a área e o PM/PO validam por ele, e quem o escreve é o dev ao entregar.');
    }
    return null;
  }

  /** MOVER DE ETAPA. `a` = { destino }. */
  function mover(m, a, c) {
    var destino = txt((a || {}).destino);
    if (ETAPAS_VALIDAS.indexOf(destino) < 0) return falha('Etapa desconhecida: ' + destino + '.');
    if (destino === etapa(m)) return falha('A demanda já está em ' + rotulo(destino) + '.');
    if (destino === 'negada') return falha('Negar pede o motivo: use "Negar".');
    if (ehDev(c)) {
      // As barreiras do `saveStatus`, na ordem de la.
      if (['validacao', 'concluido'].indexOf(etapa(m)) >= 0) return falha('Esta demanda está com o PM/PO e não pode ser alterada aqui.');
      if (ETAPAS_DO_DEV.indexOf(destino) < 0) return falha('Esta etapa não é movida pelo seu painel: quem move é o PM/PO.');
      if (destino !== 'em_andamento') return falha('Entregar pede as horas e o que foi implementado: use "Registrar entrega".');
      var HOd = mod(c, 'HOMOLOGACAO');
      var hbd = HOd ? HOd.barra(m, destino, c.hoje) : null;
      if (hbd) return falha(hbd.motivo, hbd.campo === 'etapa' ? '' : hbd.campo);
      var SPd = mod(c, 'SPRINTPO');
      var tad = SPd ? SPd.travaDeAlocacao(m, etapa(m), destino, c.hoje) : null;
      if (tad && tad.trava) return falha(tad.motivo, '');
      var pd = { status_planejamento: destino, status: STATUS_DEV[destino], horas_realizadas: m.horas_realizadas || 0 };
      /* QUEM TIRA DA FILA VIRA O DONO (`updateStatus`, dev.html, 03/11/2026):
         em andamento sem responsavel nao esta na fila nem no nome de ninguem,
         e o `dev-publish` recusa (`comecar_sem_dono`). */
      var assumiu = assumeAoComecar(m, destino, c);
      if (assumiu) pd.dev = assumiu;
      var ent = carimboDeEntrega(m, destino, c.agora);
      if (ent) pd.entregue_em = ent;
      return { ok: true, patch: pd, msg: assumiu ? (m.codigo || 'Demanda') + ' agora está no seu nome.' : 'Movida para ' + rotulo(destino) + '.' };
    }
    var t = travaDoMovimento(m, destino, c) || travaDoDevPublish(m, destino, c);
    if (t) return t;
    var p = { status_planejamento: destino, status: STATUS_ADMIN[destino] || m.status };
    Object.assign(p, marcaConclusao(m, destino, c.hoje));
    Object.assign(p, tiraInicioDoBacklog(Object.assign({}, m, p)));
    return { ok: true, patch: p, msg: 'Movida para ' + rotulo(destino) + '.' };
  }

  /** O nome que entra como dono ao comecar sem responsavel (`assumiu`, dev.html). */
  function assumeAoComecar(m, destino, c) {
    return ETAPAS_DO_DEV.indexOf(destino) >= 0 && !txt((m || {}).dev) && txt((c || {}).quem) ? txt(c.quem) : '';
  }

  /** VALIDAR E FECHAR — o selo de quem validou (`valDecidir(true)`). */
  function validar(m, a, c) {
    if (etapa(m) !== 'validacao') return falha('Só se valida o que está em Validação PM/PO.');
    if (!(Number(m.horas_realizadas) > 0)) {
      return falha('Esta entrega está sem horas de desenvolvimento. Preencha as horas antes de aprovar.', 'horas');
    }
    var sp = faltaAssinatura(m, c);
    if (sp) return falha(sp, '');
    /* APROVAR E CONCLUIR, e concluir exige sprint (`valDecidir`, 02/11/2026) —
       a mesma `SPRINTPO.travaDeAlocacao` do arraste; o servidor recusa igual. */
    var SP = mod(c, 'SPRINTPO');
    var ta = SP ? SP.travaDeAlocacao(m, etapa(m), 'concluido', c.hoje) : null;
    if (ta && ta.trava) return falha(ta.motivo, 'sprint');
    if (gestoSemDev(m, 'concluido', m.dev, m.sprint_po, c)) {
      return falha('Esta entrega está sem responsável. Escolha o desenvolvedor antes de aprovar — sem ele a entrega não entra em nenhum relatório por pessoa.', 'dev');
    }
    return { ok: true, msg: 'Entrega aprovada — demanda concluída.', patch: {
      status_planejamento: 'concluido', status: 'concluida', concluido_em: String(c.agora).slice(0, 10),
      validado_em: c.agora, validado_por: txt(c.quem) || 'admin', validacao_obs: '' } };
  }

  /** DEVOLVER COM MOTIVO (`valDecidir(false)`): volta para Planejado. */
  function devolver(m, a, c) {
    if (etapa(m) !== 'validacao') return falha('Só se devolve o que está em Validação PM/PO.');
    var obs = txt((a || {}).obs);
    if (!obs) return falha('Explique o motivo da devolução.', 'obs');
    var DV = mod(c, 'DEVOLUCAO');
    var volta = (DV && DV.ETAPA_AO_DEVOLVER) || 'planejado';
    return { ok: true, msg: 'Devolvida ao dev — voltou para ' + rotulo(volta) + '.', patch: {
      status_planejamento: volta, status: STATUS_ADMIN[volta] || 'estimada', concluido_em: '',
      validacao_obs: obs, validado_em: '', validado_por: '' } };
  }

  /** REGISTRAR A HOMOLOGACAO — grava o registro, SEM mover a demanda. */
  function homologar(m, a, c) {
    if (etapa(m) !== 'validacao_area') return falha('A homologação se registra na Validação da área.');
    var HO = mod(c, 'HOMOLOGACAO');
    if (HO && HO.registro(m)) return falha('A homologação desta demanda já foi registrada.');
    var quem = txt((a || {}).quem);
    if (!quem) return falha('Informe quem homologou na área.', 'quem');
    return { ok: true, msg: 'Homologação registrada — já pode seguir para o PM/PO.', patch: {
      homologacao: { quem: quem.slice(0, 120), em: c.agora, ok: true, obs: txt((a || {}).obs).slice(0, 300) } } };
  }

  /** REPLANEJAR O PRAZO — a entrega nova. So o PM/PO (ver o cabecalho). */
  function replanejar(m, a, c) {
    if (ehDev(c) || txt((c || {}).papel) !== 'admin') return falha('Replanejar o prazo é do PM/PO.');
    if (['concluido', 'negada'].indexOf(etapa(m)) >= 0) return falha('Demanda encerrada não tem prazo a replanejar.');
    var nova = txt((a || {}).entrega);
    if (!ehData(nova)) return falha('Informe a nova data de entrega.', 'entrega');
    if (nova === txt(m.entrega)) return falha('A entrega já é ' + nova.split('-').reverse().join('/') + '.', 'entrega');
    if (ehData(m.inicio) && nova < m.inicio) return falha('A entrega não pode ser antes do início (' + String(m.inicio).split('-').reverse().join('/') + ').', 'entrega');
    return { ok: true, patch: { entrega: nova }, msg: 'Prazo replanejado para ' + nova.split('-').reverse().join('/') + '.' };
  }

  var CAMPOS_PAUSA = ['pausado_em', 'pausa_motivo', 'pausa_por', 'pausa_aprovada_por', 'pausa_aprovada_em', 'pausa_pedido'];
  function camposDe(obj, lista) {
    var p = {};
    lista.forEach(function (k) { p[k] = obj[k] === undefined ? null : obj[k]; });
    return p;
  }
  function viaPausa(m, fn, campos, msg) {
    var x = copia(m);
    var r = fn(x);
    if (!r.ok) return falha(r.erro, 'motivo');
    return { ok: true, patch: camposDe(x, campos), msg: typeof msg === 'function' ? msg(r) : msg };
  }
  function semPausa() { return falha('pausa.js não carregado'); }
  function encerrada(m) { return ['concluido', 'negada'].indexOf(etapa(m)) >= 0; }

  /** O PM/PO PAUSA DIRETO (`pausaIniciar`). */
  function pausar(m, a, c) {
    var P = mod(c, 'PAUSA');
    if (!P) return semPausa();
    if (!P.podeAprovar(c.papel)) return falha('Pausar depende de um PM/PO: use "Pedir pausa".');
    if (encerrada(m)) return falha('Concluída ou negada não se pausa: não há prazo correndo.');
    return viaPausa(m, function (x) { return P.pausarComoAdm(x, (a || {}).motivo, c.quem, c.hoje); }, CAMPOS_PAUSA, 'Demanda pausada.');
  }
  /** O DEV PEDE (`devPausaIniciar`). */
  function pedirPausa(m, a, c) {
    var P = mod(c, 'PAUSA');
    if (!P) return semPausa();
    if (encerrada(m)) return falha('Concluída ou negada não se pausa: não há prazo correndo.');
    return viaPausa(m, function (x) { return P.pedir(x, (a || {}).motivo, c.quem, c.hoje); }, ['pausa_pedido'], 'Pedido enviado ao PM/PO.');
  }
  /** O DEV DESISTE do proprio pedido (`devPausaDesistir`). */
  function desistirPausa(m, a, c) {
    var P = mod(c, 'PAUSA');
    if (!P) return semPausa();
    return viaPausa(m, function (x) { return P.desistir(x); }, ['pausa_pedido'], 'Pedido cancelado.');
  }
  /** O PM/PO APROVA, valendo desde a data DO PEDIDO (`pausaAprovar`). */
  function aprovarPausa(m, a, c) {
    var P = mod(c, 'PAUSA');
    if (!P) return semPausa();
    if (!P.podeAprovar(c.papel)) return falha('Só o PM/PO aprova a pausa.');
    return viaPausa(m, function (x) { return P.aprovar(x, c.quem, c.hoje); }, CAMPOS_PAUSA, function (r) {
      return 'Pausa aprovada, desde ' + String(r.desde).split('-').reverse().join('/') + '.';
    });
  }
  /** O PM/PO RECUSA, com motivo (`pausaRecusar`). */
  function recusarPausa(m, a, c) {
    var P = mod(c, 'PAUSA');
    if (!P) return semPausa();
    if (!P.podeAprovar(c.papel)) return falha('Só o PM/PO responde o pedido de pausa.');
    return viaPausa(m, function (x) { return P.recusar(x, c.quem, (a || {}).motivo, c.hoje); }, ['pausa_recusas', 'pausa_pedido'], 'Pedido de pausa recusado.');
  }

  /* RETOMAR — COPIA DE `aplicarRetomada` (admin.html, igual no dev.html): os
     dias parados empurram a entrega e vao para o historico da pausa. */
  function retomar(m, a, c) {
    var P = mod(c, 'PAUSA');
    if (!P) return semPausa();
    if (!P.estaPausada(m)) return falha('A demanda não está pausada.');
    var dias = P.diasEntre(m.pausado_em, c.hoje);
    var entrega = m.entrega || '';
    if (ehData(entrega) && dias > 0) {
      var q = entrega.split('-');
      var d = new Date(Date.UTC(+q[0], +q[1] - 1, +q[2] + dias));
      entrega = d.toISOString().slice(0, 10);
    }
    var hist = (Array.isArray(m.pausa_historico) ? m.pausa_historico : []).concat([{
      de: m.pausado_em, ate: c.hoje, dias: dias, motivo: m.pausa_motivo || '' }]);
    return { ok: true, dias: dias, msg: 'Retomada. Entrega empurrada em ' + dias + (dias === 1 ? ' dia' : ' dias') + '.', patch: {
      pausado_em: '', pausa_motivo: '', pausa_por: '', entrega: entrega,
      pausa_dias: (Number(m.pausa_dias) || 0) + dias, pausa_historico: hist } };
  }

  /** NEGAR, com o motivo (o campo `motivo_negacao` do formulario do admin). */
  function negar(m, a, c) {
    if (ehDev(c)) return falha('Negar é do PM/PO ou do analista de requisitos.');
    if (etapa(m) === 'negada') return falha('A demanda já está negada.');
    var motivo = txt((a || {}).motivo);
    if (!motivo) return falha('Informe o motivo da negativa.', 'motivo');
    var p = { status_planejamento: 'negada', status: 'negada', motivo_negacao: motivo };
    Object.assign(p, marcaConclusao(m, 'negada', c.hoje));
    return { ok: true, patch: p, msg: 'Demanda negada.' };
  }

  /** Para onde o dev pode entregar daqui, pela regra da homologacao. */
  function destinosDeEntrega(m, c) {
    var HO = mod(c, 'HOMOLOGACAO');
    var col = etapa(m);
    var opcoes = col === 'em_andamento' ? ['validacao_area', 'validacao'] : col === 'validacao_area' ? ['validacao'] : [];
    return opcoes.filter(function (d) {
      var x = Object.assign({}, m, { solicitante: m.solicitante || 'x' });
      return !(HO && HO.barra(x, d, c.hoje));
    });
  }

  /** ENTREGAR (dev): `a` = { destino, horas, implementacao, resumo }.
   *  As exigencias do `saveStatus`: horas sempre; o texto do que foi
   *  implementado na ida ao PM/PO. */
  function entregar(m, a, c) {
    a = a || {};
    var col = etapa(m);
    var destino = txt(a.destino);
    if (['em_andamento', 'validacao_area'].indexOf(col) < 0) return falha('Só se entrega o que está Em Andamento ou na Validação da área.');
    if (['validacao_area', 'validacao'].indexOf(destino) < 0 || destino === col) return falha('Escolha para onde entregar.', 'destino');
    var horas = parseFloat(a.horas);
    if (!horas || horas <= 0) {
      return falha(destino === 'validacao_area' ? 'Informe as horas trabalhadas para mandar à Validação da área.' : 'Informe as horas de desenvolvimento.', 'horas');
    }
    var impl = txt(a.implementacao);
    if (destino === 'validacao' && !impl) return falha('Descreva o que foi implementado — o PM/PO valida por este texto.', 'implementacao');
    /* E O TEXTO TAMBEM NA AREA (`saveStatus`, 02/11/2026): vencidos os 5 dias
       uteis, a demanda vai sozinha para o PM/PO — o que ele le entra aqui. */
    if (destino === 'validacao_area' && !impl) return falha('Descreva o que foi implementado — a área e o PM/PO validam por este texto.', 'implementacao');
    var VI = mod(c, 'VINCULO');
    if (destino === 'validacao_area' && VI && VI.abertos(c.lista || [], m.id).length) {
      return falha('Conclua a dependência antes de avançar: "' + (VI.abertos(c.lista || [], m.id)[0].titulo || '') + '".');
    }
    var HO = mod(c, 'HOMOLOGACAO');
    var hb = HO ? HO.barra(m, destino, c.hoje) : null;
    if (hb) return falha(hb.motivo, hb.campo === 'etapa' ? 'destino' : hb.campo);
    var SP = mod(c, 'SPRINTPO');
    var ta = SP ? SP.travaDeAlocacao(m, col, destino, c.hoje) : null;
    if (ta && ta.trava) return falha(ta.motivo, '');
    var st = ehDev(c) ? STATUS_DEV[destino] : (STATUS_ADMIN[destino] || m.status);
    var p = { status_planejamento: destino, status: st, horas_realizadas: horas };
    var ent = carimboDeEntrega(m, destino, c.agora);
    if (ent) p.entregue_em = ent;
    if (impl) p.implementacao = impl;
    if (txt(a.resumo)) p.resumo_entrega = txt(a.resumo);
    return { ok: true, patch: p, msg: destino === 'validacao' ? 'Entregue para validação do PM/PO.' : 'Entregue para a Validação da área.' };
  }

  /* O CASO DE USO DE "EM APROVACAO DE REQUISITOS" — COPIA DE `cuMarcar`
     (admin.html), devolvendo o `caso_uso` em vez de guardar no card. `a` =
     { status: enviado|aprovado|ajustes, texto, resposta }. Ao marcar ENVIADO,
     o texto que foi para o usuario fica guardado: o que se aprova e o que se
     enviou. O caso de uso e do PM/PO — o `dev-publish` devolve o do servidor. */
  function casoUso(m, a, c) {
    a = a || {};
    if (txt((c || {}).papel) !== 'admin') return falha('O caso de uso é do PM/PO: é ele quem envia ao usuário e registra a resposta.');
    var st = txt(a.status);
    if (['enviado', 'aprovado', 'ajustes'].indexOf(st) < 0) return falha('Situação do caso de uso desconhecida: ' + st + '.');
    var base = Object.assign({ status: 'a_enviar', gerado_em: '' }, copia(m.caso_uso && typeof m.caso_uso === 'object' ? m.caso_uso : {}));
    var quem = txt(c.quem) || 'PM/PO';
    if (st === 'enviado') {
      if (!txt(a.texto)) return falha('O texto do caso de uso está vazio: gere de novo antes de enviar.', 'texto');
      Object.assign(base, { status: 'enviado', texto: String(a.texto), enviado_em: c.agora, enviado_por: quem });
    } else {
      var resp = txt(a.resposta);
      if (!resp) return falha(st === 'ajustes' ? 'Diga o que o usuário pediu para ajustar.' : 'Diga quem aprovou (o nome do usuário).', 'resposta');
      if (!base.texto) base.texto = String(a.texto || '');
      Object.assign(base, { status: st, respondido_em: c.agora,
                            respondido_por: st === 'aprovado' ? resp : (m.solicitante || ''),
                            resposta: st === 'ajustes' ? resp : '' });
    }
    var MSG = { enviado: 'Caso de uso marcado como enviado.', aprovado: 'Requisitos aprovados pelo usuário.', ajustes: 'Pedido de ajustes registrado.' };
    return { ok: true, patch: { caso_uso: base }, msg: MSG[st] };
  }

  var REGRAS = {
    casoUso: casoUso,
    mover: mover, validar: validar, devolver: devolver, homologar: homologar, replanejar: replanejar,
    pausar: pausar, pedirPausa: pedirPausa, desistirPausa: desistirPausa, aprovarPausa: aprovarPausa,
    recusarPausa: recusarPausa, retomar: retomar, negar: negar, entregar: entregar
  };
  var api = {
    REGRAS: REGRAS, gestoSemDev: gestoSemDev, marcaConclusao: marcaConclusao, destinosDeEntrega: destinosDeEntrega,
    tiraInicioDoBacklog: tiraInicioDoBacklog, assumeAoComecar: assumeAoComecar,
    STATUS_ADMIN: STATUS_ADMIN, STATUS_DEV: STATUS_DEV, ETAPAS_DO_DEV: ETAPAS_DO_DEV, rotulo: rotulo
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // ══ INTERFACE ═════════════════════════════════════════════════════════
  var AX = raiz.AXIS_APP;
  if (!AX || typeof document === 'undefined') { raiz.AXIS_ACOES = api; return; }
  var H = AX.H;

  function css() {
    if (document.getElementById('css-axis-acoes')) return;
    var s = document.createElement('style');
    s.id = 'css-axis-acoes';
    s.textContent = [
      '.axa .axc{max-width:540px}',
      '.axa .axc-t{margin:0;font-family:var(--font-title);font-size:19px;font-weight:800;padding-right:36px;line-height:25px}',
      '.axa .axc-sub{font-size:13px;line-height:20px;color:var(--tx2);white-space:pre-wrap}',
      '.axa .axc-f{display:flex;flex-direction:column;gap:6px;min-width:0}',
      '.axa .axc-f > label{font-size:12.5px;font-weight:700;color:var(--tx2)}',
      '.axa .axc-f .in{width:100%}',
      '.axa textarea.in{height:auto;min-height:92px;padding:10px 14px;line-height:20px;resize:vertical;display:block}',
      '.axa .axc-erro{font-size:12.5px;line-height:18px;color:var(--dg-t);min-height:0}',
      '.axa .axc-erro:empty{display:none}',
      '.axa .axc-pe{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;padding-top:4px}',
      '.axa .btnp.perigo{background:var(--dg);box-shadow:0 8px 22px rgba(var(--dg-rgb),.25);color:#fff}',
      '.axa .btnp.ok{background:linear-gradient(180deg,var(--ok-t),var(--ok));box-shadow:0 8px 22px rgba(var(--ok-rgb),.25)}',
      '.axa .btn.perigo{color:var(--dg-t);border-color:rgba(var(--dg-rgb),.4)}',
      '.axa .axc-op{display:flex;gap:10px;align-items:flex-start;padding:11px 13px;border-radius:12px;border:1px solid var(--bd2);background:var(--sf2);cursor:pointer;font-size:13px;line-height:19px}',
      '.axa .axc-op input{accent-color:var(--ac);margin-top:3px}',
      '.axa .axc-op:has(input:checked){border-color:rgba(var(--ac-rgb),.55);background:rgba(var(--ac-rgb),.08)}',
      '.axa .axc-op .d{display:block;font-size:12px;color:var(--tx3)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* A CAIXA DE PERGUNTA, no desenho do app (`.ovl` + `.dlg`). `o` = { titulo,
     texto, campos: [{ nome, rotulo, tipo: texto|area|data|numero|opcoes,
     valor, dica, opcoes: [{ v, r, d }] }], ok, perigo, valida(v) -> frase }.
     Devolve Promise<valores|null>. A recusa da regra aparece DENTRO da caixa,
     ao lado do que a pessoa escreveu, e nao num aviso depois que ela fechou. */
  function caixa(o) {
    css();
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.className = 'ovl';
      var campos = (o.campos || []).map(function (f, i) {
        var id = 'axc-' + f.nome;
        var v = f.valor == null ? '' : String(f.valor);
        var ctl;
        if (f.tipo === 'area') ctl = '<textarea class="in" id="' + id + '" rows="' + (f.linhas || 4) + '" placeholder="' + H.esc(f.dica || '') + '">' + H.esc(v) + '</textarea>';
        else if (f.tipo === 'opcoes') {
          ctl = '<div style="display:flex;flex-direction:column;gap:8px" role="radiogroup">' + (f.opcoes || []).map(function (op, j) {
            return '<label class="axc-op"><input type="radio" name="' + id + '" value="' + H.esc(op.v) + '"' + ((v ? v === op.v : j === 0) ? ' checked' : '') + '>' +
              '<span><b>' + H.esc(op.r) + '</b>' + (op.d ? '<span class="d">' + H.esc(op.d) + '</span>' : '') + '</span></label>';
          }).join('') + '</div>';
        } else {
          var tp = f.tipo === 'data' ? 'date' : f.tipo === 'numero' ? 'number' : 'text';
          ctl = '<input class="in" id="' + id + '" type="' + tp + '"' + (tp === 'number' ? ' min="0" step="0.5" inputmode="decimal"' : '') +
            ' value="' + H.esc(v) + '" placeholder="' + H.esc(f.dica || '') + '" autocomplete="off">';
        }
        return '<div class="axc-f">' + (f.rotulo ? (f.tipo === 'opcoes' ? '<span style="font-size:12.5px;font-weight:700;color:var(--tx2)">' + H.esc(f.rotulo) + '</span>' : '<label for="' + id + '">' + H.esc(f.rotulo) + '</label>') : '') +
          ctl + (f.nota ? '<span class="note">' + H.esc(f.nota) + '</span>' : '') + '</div>';
      }).join('');
      ov.innerHTML = '<div class="dlg axc" role="dialog" aria-modal="true" aria-labelledby="axc-t">' +
        '<button type="button" class="dlg-x" data-axc="nao" aria-label="Fechar">' + H.ico('x') + '</button>' +
        '<h2 class="axc-t" id="axc-t">' + H.esc(o.titulo || '') + '</h2>' +
        (o.texto ? '<div class="axc-sub">' + H.esc(o.texto) + '</div>' : '') + campos +
        '<div class="axc-erro" id="axc-erro" role="alert"></div>' +
        '<div class="axc-pe"><button type="button" class="btn" data-axc="nao">Cancelar</button>' +
        '<button type="button" class="btnp' + (o.perigo ? ' perigo' : o.verde ? ' ok' : '') + '" data-axc="sim">' + H.esc(o.ok || 'Confirmar') + '</button></div></div>';
      document.body.appendChild(ov);
      var erro = ov.querySelector('#axc-erro');
      var antes = document.activeElement;
      function ler() {
        var v = {};
        (o.campos || []).forEach(function (f) {
          if (f.tipo === 'opcoes') { var r = ov.querySelector('input[name="axc-' + f.nome + '"]:checked'); v[f.nome] = r ? r.value : ''; }
          else v[f.nome] = String((ov.querySelector('#axc-' + f.nome) || {}).value || '').trim();
        });
        return v;
      }
      function fecha(r) { ov.remove(); try { if (antes && antes.focus) antes.focus(); } catch (_) {} resolve(r); }
      function confirma() {
        var v = ler();
        var falta = (o.campos || []).find(function (f) { return f.obrig && !v[f.nome]; });
        if (falta) { erro.textContent = 'Preencha: ' + (falta.rotulo || falta.nome) + '.'; var el = ov.querySelector('#axc-' + falta.nome); if (el) el.focus(); return; }
        var msg = typeof o.valida === 'function' ? o.valida(v) : '';
        if (msg) {
          erro.textContent = msg.erro || msg;
          var alvo = msg.campo && ov.querySelector('#axc-' + msg.campo);
          if (alvo) alvo.focus();
          return;
        }
        fecha(v);
      }
      ov.addEventListener('click', function (e) {
        if (e.target === ov) { fecha(null); return; }
        var b = e.target.closest('[data-axc]');
        if (!b) return;
        if (b.getAttribute('data-axc') === 'sim') confirma(); else fecha(null);
      });
      ov.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); fecha(null); }
        else if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'radio') { e.preventDefault(); confirma(); }
      });
      var prim = ov.querySelector('.in, input[type="radio"]:checked') || ov.querySelector('[data-axc="sim"]');
      setTimeout(function () { if (prim) prim.focus(); }, 0);
    });
  }

  // ── Contexto e gravacao ──────────────────────────────────────────────
  function quem() {
    var e = AX.APP.eu || {};
    if (AX.APP.papel === 'dev') return H.meusNomes()[0] || e.nome || e.login || 'dev';
    return e.nome || e.login || 'admin';
  }
  function contexto() {
    var D = AX.APP.D || {};
    return { papel: AX.APP.papel, quem: quem(), hoje: H.hoje(), agora: new Date().toISOString(), dono: H.donoDaSprint(),
             lista: D.melhorias || [], aprovadores: Array.isArray(D.spike_aprovadores) ? D.spike_aprovadores : null };
  }
  function porId(id) { return ((AX.APP.D || {}).melhorias || []).find(function (x) { return x && x.id === id; }) || null; }

  /* O QUE O SERVIDOR DEVOLVEU DIFERENTE do que a tela mandou. O `dev-publish`
     reverte campo em vez de recusar (etapa, datas, sprint, tipo) e diz qual na
     resposta; calar isso faria a pessoa achar que gravou. */
  function avisaRevertidos(r) {
    var rs = (r && r.resp) || {};
    var partes = [];
    if ((rs.etapas_revertidas || []).length) partes.push('a etapa voltou (' + rs.etapas_revertidas.join(', ') + ')');
    if ((rs.datas_revertidas || []).length) partes.push('a data voltou ao valor do PM/PO (' + rs.datas_revertidas.join(', ') + ')');
    if ((rs.sprints_revertidas || []).length) partes.push('a sprint é do PM/PO (' + rs.sprints_revertidas.join(', ') + ')');
    if ((rs.tipos_revertidos || []).length) partes.push('a classificação ficou a de antes (' + rs.tipos_revertidos.join(', ') + ')');
    if ((rs.solicitantes_revertidos || []).length) partes.push('o solicitante ficou o de antes (' + rs.solicitantes_revertidos.join(', ') + ')');
    // Quem nao e dono da sprint so abre no Backlog (`nascendoForaDoBacklog`).
    if ((rs.nascidas_no_backlog || []).length) partes.push('abriu no Backlog — só o PM/PO coloca em outra etapa e na sprint (' + rs.nascidas_no_backlog.join(', ') + ')');
    if (partes.length) H.toast('O servidor gravou com ajustes: ' + partes.join('; ') + '.', 'erro');
  }

  /** Recusa da regra: aviso, e — quando o que falta e um campo do formulario
   *  — a demanda aberta no formulario com o campo em foco (a jornada do
   *  `levaAoCampo` do admin). */
  function recusa(m, r) {
    H.toast(r.erro || 'Não foi possível.', 'erro');
    if (NO_FORM[r.campo] && raiz.AXIS_FORM && podeEditar(m) && !(AX.APP.papel === 'dev' && r.campo !== 'solicitante')) raiz.AXIS_FORM.abrir(m, { foco: r.campo });
  }

  async function grava(m, r) {
    var out = await H.gravar((function () { var p = {}; p[m.id] = r.patch; return p; })(), { ok: r.msg });
    if (out && out.ok) avisaRevertidos(out);
    return out;
  }

  /** Roda a regra e grava. `a` ja traz o que a pessoa escolheu. */
  async function aplicar(acao, m, a) {
    var regra = REGRAS[acao];
    if (!regra || !m) return { ok: false };
    var r = regra(m, a || {}, contexto());
    if (!r.ok) { recusa(m, r); return r; }
    return grava(m, r);
  }

  // ── Permissoes por demanda ───────────────────────────────────────────
  function minha(m) { return H.minha(m); }
  function podeEditar(m) { return H.pode('editar') || (AX.APP.papel === 'dev' && minha(m)); }

  /* O QUE CADA PERFIL VE PARA ESTA DEMANDA, na ordem dos botoes. A lista e a
     das telas antigas: o que o editor do admin e o card do painel do dev
     oferecem para a etapa e a situacao da pausa. */
  function disponiveis(m) {
    var papel = AX.APP.papel;
    var col = H.colunaDe(m);
    var P = raiz.PAUSA, HO = raiz.HOMOLOGACAO;
    var sit = P ? P.situacao(m) : 'correndo';
    var out = [];
    var poe = function (acao, rotulo, ico, cls, titulo) { out.push({ acao: acao, rotulo: rotulo, ico: ico, cls: cls || 'btn', titulo: titulo || '' }); };
    var aberta = ['concluido', 'negada'].indexOf(col) < 0;
    if (papel === 'admin') {
      poe('editar', 'Editar', 'edit');
      if (col === 'validacao_area' && !(HO && HO.registro(m))) poe('homologar', 'Registrar homologação', 'check');
      if (sit === 'aguardando') { poe('aprovarPausa', 'Aprovar pausa', 'check'); poe('recusarPausa', 'Recusar pausa', 'x'); }
      else if (sit === 'pausada') poe('retomar', 'Retomar', 'refresh');
      else if (aberta) poe('pausar', 'Pausar', 'pause');
      if (aberta && col !== 'validacao' && col !== 'validacao_area') poe('replanejar', 'Replanejar prazo', 'calendar');
      poe('moverPara', 'Mover para…', 'board');
      if (col !== 'negada') poe('negar', 'Negar', 'ban', 'btn perigo');
    } else if (papel === 'analista') {
      poe('editar', 'Editar', 'edit');
      poe('moverPara', 'Mover para…', 'board');
      if (col !== 'negada') poe('negar', 'Negar', 'ban', 'btn perigo');
    } else if (papel === 'dev' && minha(m)) {
      if (col !== 'concluido') poe('editar', 'Editar', 'edit');
      if (col === 'validacao_area' && !(HO && HO.registro(m))) poe('homologar', 'Registrar homologação', 'check');
      if (sit === 'aguardando') { var ped = P.pedido(m); if (ped && H.meusNomes().concat([quem()]).indexOf(ped.por) >= 0) poe('desistirPausa', 'Cancelar pedido de pausa', 'x'); }
      else if (sit === 'pausada') poe('retomar', 'Retomar', 'refresh');
      else if (col === 'em_andamento') poe('pedirPausa', 'Pedir pausa', 'pause');
    }
    return out;
  }

  /** O botao de uma acao. `extra` vira data-axa-<chave>. */
  function botao(acao, m, rotulo, cls, o) {
    o = o || {};
    var ex = '';
    Object.keys(o.dados || {}).forEach(function (k) { ex += ' data-axa-' + k + '="' + H.esc(o.dados[k]) + '"'; });
    return '<button type="button" class="' + (cls || 'btn') + '" data-axa-acao="' + H.esc(acao) + '" data-axa-id="' + H.esc(m.id) + '"' + ex +
      (o.titulo ? ' title="' + H.esc(o.titulo) + '"' : '') + (o.desligado ? ' disabled' : '') + (o.descrito ? ' aria-describedby="' + H.esc(o.descrito) + '"' : '') + '>' +
      (o.ico ? H.ico(o.ico) + ' ' : '') + H.esc(rotulo) + '</button>';
  }

  // ── Os gestos: cada um pergunta o que falta e grava ──────────────────
  /** O texto do caso de uso, com os dados de agora (`cuTextoNovo`, admin.html). */
  function textoCasoUso(m) {
    var R = raiz.REQUISITOS;
    return R ? R.casoDeUso(m, { tema: H.tema(m.tema_id), hoje: H.hoje() }) : '';
  }
  function rotEtapa(k) { return (H.ETAPA_POR_ID[k] || {}).rotulo || rotulo(k); }
  function cod(m) { return m.codigo || m.titulo || ''; }
  /** Valida a regra DENTRO da caixa: a recusa aparece ao lado do campo. */
  /* O que falta num campo do FORMULARIO (responsavel, sprint, horas...) nao
     se resolve na caixa: ela deixa passar, e a recusa abre o formulario la. */
  var NO_FORM = { dev: 1, sprint: 1, solicitante: 1, horas: 1, tema: 1 };
  function validaCom(acao, m, fixo) {
    return function (v) {
      var r = REGRAS[acao](m, Object.assign({}, fixo || {}, v), contexto());
      if (r.ok || (NO_FORM[r.campo] && !(fixo && fixo.naCaixa && fixo.naCaixa[r.campo]))) return '';
      return { erro: r.erro, campo: r.campo };
    };
  }

  var GESTOS = {
    editar: function (m) { if (raiz.AXIS_FORM) raiz.AXIS_FORM.abrir(m); },

    mover: function (m, el) {
      var destino = el && el.getAttribute('data-axa-destino');
      return aplicar('mover', m, { destino: destino });
    },

    moverPara: async function (m) {
      var col = H.colunaDe(m);
      var lista = AX.APP.papel === 'dev' ? ['em_andamento'] : ETAPAS_VALIDAS.filter(function (e) { return e !== 'negada'; });
      var ops = lista.filter(function (e) { return e !== col; }).map(function (e) { return { v: e, r: rotEtapa(e) }; });
      var v = await caixa({ titulo: 'Mover ' + cod(m), texto: 'Hoje em ' + rotEtapa(col) + '. A regra de cada etapa é conferida antes de gravar.',
        campos: [{ nome: 'destino', tipo: 'opcoes', opcoes: ops }], ok: 'Mover', valida: validaCom('mover', m) });
      if (v) return aplicar('mover', m, v);
    },

    validar: async function (m) {
      var aviso = String(m.implementacao || '').trim() ? '' : '\n\nO dev não descreveu o que foi implementado: sem esse texto o relatório do comitê fica vazio para esta demanda.';
      var v = await caixa({ titulo: 'Validar e fechar ' + cod(m), texto: '"' + (m.titulo || '') + '" passa para Concluído, com o seu nome como quem validou.' + aviso,
        ok: 'Validar e fechar', verde: true, valida: validaCom('validar', m) });
      if (v) return aplicar('validar', m, {});
    },

    devolver: async function (m) {
      var v = await caixa({ titulo: 'Devolver ' + cod(m) + ' ao dev',
        texto: 'A demanda volta para ' + rotEtapa((raiz.DEVOLUCAO && raiz.DEVOLUCAO.ETAPA_AO_DEVOLVER) || 'planejado') + ', na fila do dev. Este texto é o que ele vai ler — sem ele, a próxima entrega vem igual.',
        campos: [{ nome: 'obs', rotulo: 'Motivo da devolução', tipo: 'area', dica: 'Ex.: o cálculo do saldo não considera estorno; refazer com o caso do print', obrig: true }],
        ok: 'Devolver', perigo: true, valida: validaCom('devolver', m) });
      if (v) return aplicar('devolver', m, v);
    },

    homologar: async function (m) {
      var HO = raiz.HOMOLOGACAO;
      var sol = HO ? HO.solicitante(m) : (m.solicitante || '');
      var v = await caixa({ titulo: 'Registrar homologação de ' + cod(m),
        texto: (sol ? 'Solicitante: ' + sol + ' — é quem homologa.' : 'Esta demanda está sem solicitante: é ele quem homologa.') + ' Registrar não move a demanda: enviar ao PM/PO é o passo seguinte.',
        campos: [{ nome: 'quem', rotulo: 'Quem homologou', valor: sol, dica: 'Nome de quem conferiu na área', obrig: true },
                 { nome: 'obs', rotulo: 'Observação (opcional)', dica: 'O que foi conferido' }],
        ok: 'Registrar homologação', valida: validaCom('homologar', m) });
      if (v) return aplicar('homologar', m, v);
    },

    replanejar: async function (m) {
      var pz = H.prazoDe(m);
      var v = await caixa({ titulo: 'Replanejar o prazo de ' + cod(m),
        texto: (m.entrega ? 'Entrega combinada: ' + H.dma(m.entrega) + (pz && pz !== m.entrega ? ' (hoje vale ' + H.dma(pz) + ', com a pausa).' : '.') : 'Sem entrega combinada.') +
          ' A remarcação fica no histórico da demanda. Para parar o relógio por algo de fora do time, use Pausar.',
        campos: [{ nome: 'entrega', rotulo: 'Nova entrega', tipo: 'data', valor: m.entrega || '', obrig: true }],
        ok: 'Replanejar', valida: validaCom('replanejar', m) });
      if (v) return aplicar('replanejar', m, v);
    },

    pausar: async function (m) {
      var v = await caixa({ titulo: 'Pausar ' + cod(m),
        texto: 'O prazo para de correr enquanto ela estiver pausada, e os dias parados são somados à entrega ao retomar. O motivo justifica isso depois.',
        campos: [{ nome: 'motivo', rotulo: 'Motivo', tipo: 'area', dica: 'Ex.: aguardando retorno do banco sobre o layout do arquivo', obrig: true }],
        ok: 'Pausar', valida: validaCom('pausar', m) });
      if (v) return aplicar('pausar', m, v);
    },

    pedirPausa: async function (m) {
      var v = await caixa({ titulo: 'Pedir pausa de ' + cod(m),
        texto: 'O pedido vai para o PM/PO. Enquanto ele não responde o prazo segue correndo, mas, aprovado, a pausa vale DESDE HOJE — a espera pela resposta não é cobrada de você.',
        campos: [{ nome: 'motivo', rotulo: 'Justificativa', tipo: 'area', dica: 'Ex.: aguardando retorno do banco sobre o layout do arquivo', obrig: true }],
        ok: 'Pedir pausa', valida: validaCom('pedirPausa', m) });
      if (v) return aplicar('pedirPausa', m, v);
    },

    desistirPausa: async function (m) {
      var v = await caixa({ titulo: 'Cancelar o pedido de pausa', texto: 'O pedido some e a demanda segue como estava. Você pode pedir de novo depois.', ok: 'Cancelar o pedido' });
      if (v) return aplicar('desistirPausa', m, {});
    },

    aprovarPausa: async function (m) {
      var ped = raiz.PAUSA ? raiz.PAUSA.pedido(m) : null;
      if (!ped) { H.toast('Não há pedido de pausa nesta demanda.', 'erro'); return; }
      var dias = raiz.PAUSA.diasEntre(ped.em, H.hoje());
      var v = await caixa({ titulo: 'Aprovar a pausa de ' + cod(m),
        texto: (ped.por || 'O dev') + ' pediu em ' + H.dma(ped.em) + '. A pausa passa a valer desde ' + H.dma(ped.em) + '.' +
          (dias ? '\nOs ' + H.plural(dias, 'dia', 'dias') + ' de espera pela sua resposta entram na pausa, e não como atraso do dev.' : '') + '\nMotivo: ' + ped.motivo,
        ok: 'Aprovar', verde: true });
      if (v) return aplicar('aprovarPausa', m, {});
    },

    recusarPausa: async function (m) {
      var ped = raiz.PAUSA ? raiz.PAUSA.pedido(m) : null;
      if (!ped) { H.toast('Não há pedido de pausa nesta demanda.', 'erro'); return; }
      var v = await caixa({ titulo: 'Recusar a pausa de ' + cod(m),
        texto: 'O dev pediu: "' + ped.motivo + '". Diga por que a demanda deve seguir correndo — é isso que ele vai ler no card.',
        campos: [{ nome: 'motivo', rotulo: 'Motivo da recusa', tipo: 'area', dica: 'Ex.: o fornecedor respondeu ontem, dá para seguir pelo caminho B', obrig: true }],
        ok: 'Recusar', perigo: true, valida: validaCom('recusarPausa', m) });
      if (v) return aplicar('recusarPausa', m, v);
    },

    retomar: async function (m) {
      var r = REGRAS.retomar(m, {}, contexto());
      if (!r.ok) { recusa(m, r); return; }
      var v = await caixa({ titulo: 'Retomar ' + cod(m),
        texto: 'Ficou ' + H.plural(r.dias, 'dia', 'dias') + ' pausada.' + (m.entrega && r.patch.entrega !== m.entrega ? '\nA entrega passa de ' + H.dma(m.entrega) + ' para ' + H.dma(r.patch.entrega) + '.' : ''),
        ok: 'Retomar' });
      if (v) return grava(m, r);
    },

    negar: async function (m) {
      var v = await caixa({ titulo: 'Negar ' + cod(m), texto: 'A demanda sai do fluxo. O motivo fica registrado e é o que o solicitante vai ler.',
        campos: [{ nome: 'motivo', rotulo: 'Motivo da negativa', tipo: 'area', valor: m.motivo_negacao || '', obrig: true }],
        ok: 'Negar', perigo: true, valida: validaCom('negar', m) });
      if (v) return aplicar('negar', m, v);
    },

    /* O CASO DE USO (o painel `m-caso-uso` do editor do admin): o texto e
       montado da demanda (`REQUISITOS.casoDeUso`), ajustado na caixa do Item
       (#it-cu-texto) e, marcado como enviado, guardado no card. */
    casoUsoGerar: function (m) {
      var t = document.getElementById('it-cu-texto');
      if (t) { t.value = textoCasoUso(m); H.toast('Caso de uso montado de novo a partir da demanda.'); }
    },
    casoUsoCopiar: async function (m) {
      var t = document.getElementById('it-cu-texto');
      var v = t ? t.value : textoCasoUso(m);
      try { await navigator.clipboard.writeText(v); H.toast('Caso de uso copiado.'); }
      catch (_) { if (t) t.select(); H.toast('Selecionei o texto: copie com Ctrl+C.'); }
    },
    casoUsoImprimir: function (m) {
      var R = raiz.REQUISITOS;
      if (!R) return;
      var t = document.getElementById('it-cu-texto');
      var w = window.open('', '_blank');
      if (!w) { H.toast('O navegador bloqueou a janela: libere pop-ups para imprimir.', 'erro'); return; }
      w.document.write(R.paginaImpressao(t ? t.value : textoCasoUso(m), 'Caso de uso ' + (m.codigo || '')));
      w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 300);
    },
    casoUsoEnviado: async function (m) {
      var t = document.getElementById('it-cu-texto');
      var texto = t ? t.value : textoCasoUso(m);
      var v = await caixa({ titulo: 'Marcar o caso de uso de ' + cod(m) + ' como enviado',
        texto: 'O texto como está agora fica guardado no card: é ele que o usuário aprova, e não o que a demanda virar depois.',
        ok: 'Marquei como enviado', valida: validaCom('casoUso', m, { status: 'enviado', texto: texto }) });
      if (v) return aplicar('casoUso', m, { status: 'enviado', texto: texto });
    },
    casoUsoAprovado: async function (m) {
      var t = document.getElementById('it-cu-texto');
      var fixo = { status: 'aprovado', texto: t ? t.value : '' };
      var v = await caixa({ titulo: 'Usuário aprovou os requisitos de ' + cod(m),
        campos: [{ nome: 'resposta', rotulo: 'Quem aprovou (nome do usuário)', valor: m.solicitante || '', obrig: true }],
        ok: 'Registrar', verde: true, valida: validaCom('casoUso', m, fixo) });
      if (v) return aplicar('casoUso', m, Object.assign({}, fixo, v));
    },
    casoUsoAjustes: async function (m) {
      var t = document.getElementById('it-cu-texto');
      var fixo = { status: 'ajustes', texto: t ? t.value : '' };
      var v = await caixa({ titulo: 'Usuário pediu ajustes em ' + cod(m),
        campos: [{ nome: 'resposta', rotulo: 'O que o usuário pediu para ajustar?', tipo: 'area', obrig: true }],
        ok: 'Registrar', valida: validaCom('casoUso', m, fixo) });
      if (v) return aplicar('casoUso', m, Object.assign({}, fixo, v));
    },

    entregar: async function (m, el) {
      var c = contexto();
      var pedido = el && el.getAttribute('data-axa-destino');
      var ds = destinosDeEntrega(m, c);
      if (pedido && ds.indexOf(pedido) >= 0) ds = [pedido].concat(ds.filter(function (d) { return d !== pedido; }));
      if (!ds.length) {
        var hb = raiz.HOMOLOGACAO ? raiz.HOMOLOGACAO.barra(m, H.colunaDe(m) === 'validacao_area' ? 'validacao' : 'validacao_area', c.hoje) : null;
        recusa(m, { erro: hb ? hb.motivo : 'Daqui não há para onde entregar.', campo: hb && hb.campo });
        return;
      }
      var NOTA = { validacao_area: 'A área (quem pediu) confere primeiro. Pede as horas e o que foi implementado.',
                   validacao: 'Vai direto ao PM/PO. Pede as horas e o que foi implementado.' };
      var campos = [];
      if (ds.length > 1 || H.colunaDe(m) === 'em_andamento') {
        campos.push({ nome: 'destino', rotulo: 'Entregar para', tipo: 'opcoes', valor: ds[0],
          opcoes: ds.map(function (d) { return { v: d, r: rotEtapa(d), d: NOTA[d] }; }) });
      }
      campos.push({ nome: 'horas', rotulo: 'Horas de desenvolvimento', tipo: 'numero', valor: m.horas_realizadas || '', obrig: true });
      campos.push({ nome: 'implementacao', rotulo: 'O que foi implementado', tipo: 'area', valor: m.implementacao || '', dica: 'É o texto que a área e o PM/PO leem para validar.', obrig: true });
      campos.push({ nome: 'resumo', rotulo: 'Resumo da entrega', tipo: 'area', linhas: 2, valor: m.resumo_entrega || '', dica: 'Vai para o relatório e a apresentação.' });
      var fixo = campos[0].nome === 'destino' ? {} : { destino: ds[0] };
      fixo.naCaixa = { horas: 1 };
      var v = await caixa({ titulo: 'Registrar entrega de ' + cod(m), campos: campos, ok: 'Registrar entrega', valida: validaCom('entregar', m, fixo) });
      if (v) return aplicar('entregar', m, Object.assign({ destino: fixo.destino }, v));
    }
  };

  /* O ANEXO ABRE DAQUI (`abrirAnexo`, dev.html e admin.html): baixa pelo
     Worker com a sessao e entrega pelo `ANEXOTIPO`, que decide entre abrir e
     baixar pelo tipo gravado. */
  async function abrirAnexo(m, i) {
    var a = (m.anexos || [])[i];
    if (!a) return;
    var T = raiz.ANEXOTIPO;
    try {
      if (a.chave) {
        var res = await fetch(AX.WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'anexo-baixar', chave: a.chave, token: AX.APP.token }) });
        if (!res.ok) { H.toast('Não foi possível abrir o anexo: o servidor respondeu HTTP ' + res.status + '.', 'erro'); return; }
        var blob = await res.blob();
        if (T) T.entrega(blob, a.nome, a.tipo || blob.type, window);
      } else if (a.dados) {
        var partes = String(a.dados).split(',');
        var mime = (/:(.*?);/.exec(partes[0]) || [])[1] || 'application/octet-stream';
        var bin = atob(partes[1] || ''), arr = new Uint8Array(bin.length);
        for (var k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
        if (T) T.entrega(new Blob([arr], { type: mime }), a.nome, mime, window);
      }
    } catch (e) { H.toast('Não foi possível abrir o anexo: ' + (e.message || e), 'erro'); }
  }

  var _ocupado = false;
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-axa-acao], [data-axa-form], [data-axa-anexo]');
    if (!b) return;
    // Dentro de um card que e link, o botao age e o card nao navega.
    e.preventDefault();
    e.stopPropagation();
    if (b.hasAttribute('data-axa-form')) {
      if (!raiz.AXIS_FORM) return;
      var alvo = b.getAttribute('data-axa-form') === 'novo' ? null : porId(b.getAttribute('data-axa-id'));
      raiz.AXIS_FORM.abrir(alvo);
      return;
    }
    var m = porId(b.getAttribute('data-axa-id'));
    if (!m) { H.toast('Demanda não encontrada na base carregada. Recarregue a tela.', 'erro'); return; }
    if (b.hasAttribute('data-axa-anexo')) { abrirAnexo(m, +b.getAttribute('data-axa-anexo')); return; }
    var g = GESTOS[b.getAttribute('data-axa-acao')];
    if (!g || _ocupado) return;
    _ocupado = true;
    b.disabled = true;
    Promise.resolve().then(function () { return g(m, b); })
      .catch(function (ex) { console.error(ex); H.toast('Não foi possível: ' + (ex.message || ex), 'erro'); })
      .then(function () { _ocupado = false; if (b.isConnected) b.disabled = false; });
  }, true);

  raiz.AXIS_ACOES = Object.assign(api, {
    caixa: caixa, aplicar: aplicar, disponiveis: disponiveis, botao: botao, podeEditar: podeEditar,
    contexto: contexto, avisaRevertidos: avisaRevertidos, abrirAnexo: abrirAnexo, GESTOS: GESTOS, textoCasoUso: textoCasoUso
  });
}(typeof window !== 'undefined' ? window : globalThis));
