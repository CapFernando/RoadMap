/* ─────────────────────────────────────────────────────────────────────────
   AXIS — o formulario de demanda (nova e editar), no app novo (axis.html).

   OS CAMPOS SAO OS DO EDITOR DE CADA PERFIL, e nao a soma dos dois:
     PM/PO (admin)   o "Dados" do `openModalMelhoria`/`saveMelhoria`
                     (admin.html): titulo, tipo, sistema, descricao,
                     solicitante, responsavel, prioridade, projeto, sprint,
                     etapa inicial, datas, entrega ao usuario, pontos, horas,
                     as marcas (debito, Dados/BI, Sales Ops, spike) e anexos.
     analista        o mesmo, sem a sprint (`SPRINTPO.podeRepassar` e do papel
                     admin).
     dev             o `openNewModal`/`openEditDemand`/`saveNewDemand`
                     (dev.html): titulo, sistema, descricao, tipo, quem pediu,
                     projeto, datas e anexos. A demanda nasce com o nome dele
                     como responsavel e `origem: 'dev'`; a etapa inicial e
                     Backlog, Planejado ou Em andamento, e com projeto e Backlog.

   EDITAR NAO MUDA ETAPA. Mover, validar, devolver, pausar, negar e entregar
   sao as acoes do Item (axis-acoes.js), cada uma com a sua regra — o select de
   etapa no meio do formulario era o caminho em que as regras escapavam.

   GRAVA SO O QUE MUDOU. Na edicao o patch leva os campos diferentes do que a
   tela leu; `H.gravar` aplica sobre a base FRESCA do servidor. Por isso nao ha
   aqui a "lista fechada" do `saveMelhoria` (repassar cada campo sem campo no
   formulario para salvar nao o apagar): campo fora do patch e o do servidor.
   A demanda nova leva o objeto inteiro, com os padroes do `saveMelhoria`.

   AS VALIDACOES SAO AS DAS TELAS ANTIGAS, na mesma ordem, perguntadas aos
   mesmos modulos (`abertura.js`, `sprint.js`, `prevoo.js`, `catalogo.js`,
   `colaboradores.js`). O servidor confere tudo de novo; a tela so evita que a
   pessoa descubra a regra pela recusa.

   O QUE FICOU NO EDITOR DA AREA ADMINISTRATIVA: Validado em Comite, BIs
   impactados, links de referencia, links do GitHub, versao e producao, mes
   alvo, grill, mesclar, media do Poker, destaque e o texto da entrega (resumo
   e implementacao, que o dev escreve ao entregar). O link "Mais campos no
   editor" abre a demanda la.

   Publica `window.AXIS_FORM = { abrir(m|null, { foco }) }` e, no Node,
   `module.exports` com as regras puras (`nova`, `edicao`).
   ───────────────────────────────────────────────────────────────────────── */
(function (raiz) {
  'use strict';

  // ══ REGRAS (puras) ════════════════════════════════════════════════════
  function mod(c, nome) { return (c && c.R && c.R[nome]) || raiz[nome] || null; }
  function txt(v) { return String(v == null ? '' : v).trim(); }
  function falha(erro, campo) { return { ok: false, erro: erro, campo: campo || '' }; }
  function igual(a, b) { return JSON.stringify(a == null ? '' : a) === JSON.stringify(b == null ? '' : b); }

  var STATUS_ADMIN = { backlog: 'recebida', levantar_req: 'recebida', planning: 'estimada', planejado: 'estimada',
                       em_andamento: 'iniciada', concluido: 'iniciada', atrasado: 'iniciada', negada: 'negada' };
  var STATUS_DEV = { backlog: 'recebida', levantar_req: 'recebida', planning: 'estimada', planejado: 'estimada',
                     em_andamento: 'iniciada', validacao_area: 'iniciada', validacao: 'iniciada', concluido: 'iniciada' };
  var ETAPAS_NOVA_DEV = ['backlog', 'planejado', 'em_andamento'];
  /* A partir de Planejado a data e do PM/PO: o servidor devolve a do dev
     (`travaDatasComprometidas`). O formulario mostra e nao deixa mexer. */
  var ETAPAS_DATA_TRAVADA = ['planejado', 'em_andamento', 'validacao_area', 'validacao', 'concluido'];
  var TIPOS = ['sustentacao', 'evolucao'];

  function ehPO(c) { return txt((c || {}).papel) === 'admin'; }
  function ehDev(c) { return txt((c || {}).papel) === 'dev'; }
  function datasTravadas(m, c) { return !!m && !ehPO(c) && ETAPAS_DATA_TRAVADA.indexOf(txt(m.status_planejamento)) >= 0; }

  function acoes(c) { return mod(c, 'AXIS_ACOES'); }
  function gestoSemDev(velha, destino, dev, sprint, c) {
    var A = acoes(c);
    return A ? A.gestoSemDev(velha, destino, dev, sprint, c) : false;
  }

  /* A SPRINT ESCOLHIDA ENTRA PELO GESTO DO CHIP — `repassar`/`retirar` de
     sprint.js, como no `saveMelhoria` —, e nao gravando `sprint_po` direto: e
     ali que o historico ganha a linha de "entrou atrasada" e que a sprint
     fechada e recusada. Muta `obj`. */
  function aplicaSprint(obj, escolhida, c) {
    var SP = mod(c, 'SPRINTPO');
    if (!SP || escolhida == null || escolhida === SP.doPO(obj)) return null;
    var r = escolhida ? SP.repassar(obj, escolhida, c.quem, c.hoje, { dados: c.D || {} })
                      : SP.retirar(obj, c.quem, c.hoje, { dados: c.D || {} });
    return r.ok ? null : falha(r.erro, 'sprint');
  }

  /** O que vale para nova e edicao, na ordem do `saveMelhoria`/`saveNewDemand`. */
  function basicas(f, m, c) {
    if (!txt(f.titulo)) return falha('Informe o título.', 'titulo');
    var tipo = m && m.tipo && ehDev(c) ? m.tipo : f.tipo;
    if (TIPOS.indexOf(tipo) < 0) return falha(ehDev(c) ? 'Diga se é problema (Sustentação) ou melhoria (Evolução).' : 'Selecione o tipo: Sustentação ou Evolução.', 'tipo');
    // Sistema: obrigatorio na abertura; no admin, demanda antiga sem sistema segue como esta.
    if (!txt(f.tema_id) && (!m || ehDev(c))) return falha('Selecione o sistema.', 'tema');
    if (!m && !txt(f.solicitante)) {
      return falha(ehDev(c) ? 'Informe quem pediu: é o solicitante quem confere a entrega.'
                            : 'Informe quem pediu: é o solicitante quem homologa a entrega.', 'solicitante');
    }
    return null;
  }

  function emailDe(nome, antes, c) {
    var CO = mod(c, 'COLABORADORES');
    return CO ? CO.emailPara(nome, antes || {}) : txt((antes || {}).solicitante_email);
  }
  function numOuNulo(v, inteiro) {
    if (v === '' || v == null) return null;
    var n = inteiro ? parseInt(v, 10) : parseFloat(v);
    return isFinite(n) ? n : null;
  }

  /** A DEMANDA NOVA. `f` = os campos lidos; `c` = { papel, quem, hoje, agora,
   *  id, D, R }. Devolve { ok, obj } ou a recusa com o campo. */
  function nova(f, c) {
    f = f || {};
    var b = basicas(f, null, c);
    if (b) return b;
    var titulo = txt(f.titulo);
    var sp = txt(f.etapa) || (ehDev(c) ? 'planejado' : 'backlog');
    var obj;
    if (ehDev(c)) {
      if (ETAPAS_NOVA_DEV.indexOf(sp) < 0) return falha('Pelo seu painel a demanda nasce em Backlog, Planejado ou Em andamento.', 'etapa');
      // Demanda de projeto e dimensionada no planning junto das outras (`nProjetoMudou`).
      if (txt(f.projeto_id)) sp = 'backlog';
      obj = {
        id: c.id, titulo: titulo, tema_id: txt(f.tema_id), descricao: txt(f.descricao),
        dev: txt(c.quem), tipo: f.tipo,
        solicitante: txt(f.solicitante), solicitante_email: emailDe(f.solicitante, null, c),
        origem: 'dev', projeto_id: txt(f.projeto_id), anexos: (f.anexos || []).slice(),
        inicio: txt(f.inicio), entrega: txt(f.entrega),
        status: STATUS_DEV[sp] || 'recebida', status_planejamento: sp,
        estimativa: '', motivo_negacao: '', criado_em: c.agora
      };
    } else {
      if (sp === 'negada') return falha('Demanda nova não nasce negada.', 'etapa');
      obj = {
        id: c.id, titulo: titulo, descricao: txt(f.descricao), tema_id: txt(f.tema_id), tipo: f.tipo,
        poker_media: null, poker_pontos: numOuNulo(f.poker_pontos, true),
        status: STATUS_ADMIN[sp] || 'recebida', status_planejamento: sp, estimativa: '',
        dev: txt(f.dev), prioridade: txt(f.prioridade),
        solicitante: txt(f.solicitante), solicitante_email: emailDe(f.solicitante, null, c),
        data_solicitacao: txt(f.data_solicitacao), inicio: txt(f.inicio), entrega: txt(f.entrega),
        entrega_usuario: txt(f.entrega_usuario), mes_alvo: '', meses: [], motivo_negacao: '',
        resumo_entrega: '', implementacao: '', versao: '', em_producao: false, producao_em: '', producao_por: '',
        debito_tecnico: !!f.debito_tecnico, comite: null, dados_bi: !!f.dados_bi, sales_ops: !f.dados_bi && !!f.sales_ops,
        sprint_prioritaria: null, bis_impactados: [], links: [], spike: !!f.spike, spike_aprovacoes: [],
        projeto_id: txt(f.projeto_id), validacao_area_em: '', homologacao: null,
        validado_em: '', validado_por: '', validacao_obs: '', entregue_em: '', concluido_em: '',
        grill: {}, sprint_po: '', sprint_po_em: '', sprint_po_por: '', sprint_po_historico: [],
        pausado_em: '', pausa_motivo: '', pausa_por: '', pausa_dias: 0, pausa_historico: [],
        pausa_pedido: null, pausa_recusas: [], pausa_aprovada_por: '', pausa_aprovada_em: '',
        historico: [], anexos: (f.anexos || []).slice(), horas_realizadas: parseFloat(f.horas) || 0,
        criado_em: c.agora
      };
      if (gestoSemDev(null, sp, obj.dev, f.sprint || '', c)) {
        return falha('Escolha o desenvolvedor: ' + (acoes(c) ? acoes(c).rotulo(sp) : sp) + ' exige responsável.', 'dev');
      }
      if (ehPO(c)) { var e = aplicaSprint(obj, f.sprint || '', c); if (e) return e; }
      var SP = mod(c, 'SPRINTPO');
      if (SP && SP.travaDeAlocacao(obj, 'backlog', sp, c.hoje).trava) {
        return falha('Escolha a sprint: depois da Planning ela é obrigatória.', 'sprint');
      }
      if (sp === 'concluido' && !(Number(obj.horas_realizadas) > 0)) {
        return falha('Informe as horas de desenvolvimento para concluir — é a única medida de custo da base.', 'horas');
      }
      var A = acoes(c);
      if (A) Object.assign(obj, A.marcaConclusao(obj, sp, c.hoje));
    }
    /* NENHUMA DEMANDA NASCE COM DATA NO PASSADO — e, pelo painel, nem no futuro
       (`abertura.js`). So na criacao. */
    var AB = mod(c, 'ABERTURA');
    if (AB) {
      var ab = AB.checa(obj, ehDev(c) ? 'dev' : 'admin', c.hoje);
      if (!ab.ok) return falha(ab.erro, ab.campo);
    }
    return { ok: true, obj: obj };
  }

  /** A EDICAO: o patch com o que mudou. `f` traz so os campos que o
   *  formulario daquele perfil mostra. */
  function edicao(m, f, c) {
    f = f || {};
    if (!m || !m.id) return falha('Demanda não encontrada.');
    var b = basicas(f, m, c);
    if (b) return b;
    var depois = JSON.parse(JSON.stringify(m));
    var poe = function (k, v) { if (v !== undefined) depois[k] = v; };
    poe('titulo', txt(f.titulo));
    if ('descricao' in f) poe('descricao', txt(f.descricao));
    if (txt(f.tema_id)) poe('tema_id', txt(f.tema_id));
    if (!(ehDev(c) && m.tipo)) poe('tipo', f.tipo);
    if ('solicitante' in f) {
      // Em branco na edicao fica o que estava (dev.html); o admin pode apagar.
      var sol = txt(f.solicitante) || (ehPO(c) ? '' : txt(m.solicitante));
      if (sol !== txt(m.solicitante)) { poe('solicitante', sol); poe('solicitante_email', emailDe(sol, m, c)); }
    }
    if ('projeto_id' in f) poe('projeto_id', txt(f.projeto_id));
    if (!datasTravadas(m, c)) {
      if ('inicio' in f) poe('inicio', txt(f.inicio));
      if ('entrega' in f) poe('entrega', txt(f.entrega));
    }
    if (!ehDev(c)) {
      if ('dev' in f) poe('dev', txt(f.dev));
      if ('prioridade' in f) poe('prioridade', txt(f.prioridade));
      if ('entrega_usuario' in f) poe('entrega_usuario', txt(f.entrega_usuario));
      if ('data_solicitacao' in f) poe('data_solicitacao', txt(f.data_solicitacao));
      if ('poker_pontos' in f) poe('poker_pontos', numOuNulo(f.poker_pontos, true));
      if ('horas' in f) poe('horas_realizadas', parseFloat(f.horas) || Number(m.horas_realizadas) || 0);
      ['debito_tecnico', 'spike'].forEach(function (k) { if (k in f) poe(k, !!f[k]); });
      if ('dados_bi' in f) { poe('dados_bi', !!f.dados_bi); poe('sales_ops', !f.dados_bi && !!f.sales_ops); }
    }
    if (f.anexos) poe('anexos', f.anexos.slice());
    var sp = txt(m.status_planejamento);
    if (!ehDev(c) && gestoSemDev(m, sp, depois.dev, f.sprint != null ? f.sprint : m.sprint_po, c)) {
      return falha('Escolha o desenvolvedor: ' + (acoes(c) ? acoes(c).rotulo(sp) : sp) + ' exige responsável.', 'dev');
    }
    if (ehPO(c) && f.sprint != null) { var e = aplicaSprint(depois, f.sprint, c); if (e) return e; }
    var patch = {};
    Object.keys(depois).forEach(function (k) { if (!igual(depois[k], m[k])) patch[k] = depois[k]; });
    if (!Object.keys(patch).length) return { ok: true, patch: null };
    return { ok: true, patch: patch };
  }

  var api = { nova: nova, edicao: edicao, ETAPAS_NOVA_DEV: ETAPAS_NOVA_DEV, ETAPAS_DATA_TRAVADA: ETAPAS_DATA_TRAVADA };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // ══ INTERFACE ═════════════════════════════════════════════════════════
  var AX = raiz.AXIS_APP;
  if (!AX || typeof document === 'undefined') { raiz.AXIS_FORM = api; return; }
  var H = AX.H;
  var MAX_ANEXO = 1.5 * 1024 * 1024;   // o mesmo `MS_MAX` do dev.html

  function css() {
    if (document.getElementById('css-axis-form')) return;
    var s = document.createElement('style');
    s.id = 'css-axis-form';
    s.textContent = [
      '.axa .ovl.axf-ovl{justify-content:flex-end;padding:0;align-items:stretch}',
      '.axa .axf{max-width:760px;min-height:100%;border-radius:0;border-top:0;border-bottom:0;border-right:0;padding:26px 28px;gap:18px}',
      '.axa .axf-t{margin:0;font-family:var(--font-title);font-size:22px;font-weight:800;padding-right:40px}',
      '.axa .axf-sec{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px 16px;padding:18px;border-radius:16px;background:rgba(var(--sf-rgb),.72);border:1px solid var(--bd)}',
      '.axa .axf-sec > .lab{grid-column:1 / -1}',
      '.axa .axf-f{display:flex;flex-direction:column;gap:6px;min-width:0}',
      '.axa .axf-f.axf-l{grid-column:1 / -1}',
      '.axa .axf-f > label,.axa .axf-f > .rt{font-size:12.5px;font-weight:700;color:var(--tx2)}',
      '.axa .axf-f .ob{color:var(--ac-t)}',
      '.axa .axf-f .in{width:100%}',
      '.axa .axf-f .in:disabled{opacity:.6;cursor:not-allowed}',
      '.axa .axf textarea.in{height:auto;min-height:220px;padding:12px 14px;line-height:21px;resize:vertical;display:block;font-family:var(--font-mono);font-size:12.5px}',
      '.axa .axf-chk{display:flex;flex-wrap:wrap;gap:8px}',
      '.axa .axf-chk label{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 12px;border-radius:9px;border:1px solid var(--bd2);font-size:12.5px;font-weight:600;color:var(--tx2);cursor:pointer}',
      '.axa .axf-chk input{accent-color:var(--ac)}',
      '.axa .axf-chk label:has(input:checked){border-color:rgba(var(--ac-rgb),.5);color:var(--tx);background:rgba(var(--ac-rgb),.08)}',
      '.axa .axf-an{display:flex;flex-wrap:wrap;gap:6px}',
      '.axa .axf-an .chip button{background:none;border:0;color:var(--tx3);cursor:pointer;font:inherit;padding:0 0 0 4px}',
      '.axa .axf-pe{position:sticky;bottom:0;margin:0 -28px -26px;padding:14px 28px;display:flex;gap:10px;justify-content:flex-end;align-items:center;flex-wrap:wrap;background:var(--sf3);border-top:1px solid var(--bd2)}',
      '.axa .axf-erro{flex:1 0 100%;font-size:12.5px;line-height:18px;color:var(--dg-t)}',
      '.axa .axf-erro:empty{display:none}',
      // O modelo de descricao e a zona de anexo trazem CSS das telas antigas; aqui vestem os tokens do app.
      '.axa .axf .md-barra{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:2px}',
      '.axa .axf .md-btn{height:28px;padding:0 10px;border-radius:8px;cursor:pointer;font:inherit;font-size:12px;font-weight:600;color:var(--tx2);background:transparent;border:1px solid var(--bd2)}',
      '.axa .axf .md-btn:hover{color:var(--tx);border-color:var(--bd4)}',
      '.axa .axf .md-aviso{font-size:12px;color:var(--tx3)}',
      '.axa .axf .md-aviso.ok{color:var(--ok-t)}',
      '.axa .axf .md-aviso.falta{color:var(--wn-t)}',
      '.axa .axf .anexo-zona{border:1px dashed var(--bd4);border-radius:11px;padding:12px 14px;font-size:12.5px;line-height:1.5;color:var(--tx3);background:var(--sf2);cursor:pointer;outline:none}',
      '.axa .axf .anexo-zona:hover,.axa .axf .anexo-zona:focus{border-color:rgba(var(--ac-rgb),.6)}',
      '.axa .axf .anexo-zona.sobre{border-style:solid;border-color:var(--ok);background:rgba(var(--ok-rgb),.08)}',
      '.axa .axf .anexo-zona b{color:var(--tx2)}',
      '@container app (max-width: 760px){.axa .axf-sec{grid-template-columns:minmax(0,1fr)}.axa .axf{padding:18px}}',
      '@media (max-width: 760px){.axa .axf-sec{grid-template-columns:minmax(0,1fr)}.axa .axf{padding:18px 16px}.axa .axf-pe{margin:0 -16px -18px;padding:12px 16px}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function D() { return AX.APP.D || {}; }
  function opt(v, r, sel) { return '<option value="' + H.esc(v) + '"' + (String(sel) === String(v) ? ' selected' : '') + '>' + H.esc(r) + '</option>'; }
  function campo(id, rotulo, ctl, o) {
    o = o || {};
    return '<div class="axf-f' + (o.lg ? ' axf-l' : '') + '">' + (rotulo ? '<label for="' + id + '">' + H.esc(rotulo) + (o.obrig ? ' <span class="ob">*</span>' : '') + '</label>' : '') +
      ctl + (o.nota ? '<span class="note" id="' + id + '-nota">' + o.nota + '</span>' : '') + '</div>';
  }
  function entrada(id, valor, o) {
    o = o || {};
    return '<input class="in" id="' + id + '" type="' + (o.tipo || 'text') + '" value="' + H.esc(valor == null ? '' : valor) + '"' +
      (o.dica ? ' placeholder="' + H.esc(o.dica) + '"' : '') + (o.desligado ? ' disabled' : '') + (o.extra || '') + ' autocomplete="off">';
  }

  function quem() { return AX.APP.papel === 'dev' ? (H.meusNomes()[0] || (AX.APP.eu || {}).nome || '') : ((AX.APP.eu || {}).nome || (AX.APP.eu || {}).login || 'admin'); }
  function contexto(id) { return { papel: AX.APP.papel, quem: quem(), hoje: H.hoje(), agora: new Date().toISOString(), id: id, D: D() }; }

  function opcoesSistema(atual) {
    var temas = D().temas || [];
    // Sem "+ outro": criar sistema e trocar a lista inteira de temas, e isso fica em Configuracoes.
    return raiz.catalogoOpcoesHTML ? raiz.catalogoOpcoesHTML(temas, atual || '', { rotuloVazio: '— selecione o sistema —' })
      : '<option value="">— selecione o sistema —</option>' + temas.map(function (t) { return opt(t.id, t.nome, atual); }).join('');
  }
  function opcoesProjeto(atual) {
    var ps = (D().projetos || []).filter(function (p) { return String((p && p.aprovacao) || 'aprovado') === 'aprovado' || p.id === atual; });
    return opt('', ps.length ? '— sem projeto —' : 'nenhum projeto aprovado ainda', atual) +
      ps.map(function (p) { return opt(p.id, (p.codigo ? p.codigo + ' · ' : '') + (p.nome || '(sem nome)'), atual); }).join('');
  }
  function opcoesDev(atual) {
    var devs = (D().desenvolvedores || []).slice();
    var manual = !!atual && devs.indexOf(atual) < 0;
    return { manual: manual, html: opt('', '— Nenhum —', atual) + devs.map(function (d) { return opt(d, d, atual); }).join('') +
      '<option value="__manual__"' + (manual ? ' selected' : '') + '>Múltiplos / outro…</option>' };
  }
  /* A atual e as cinco seguintes (`sprintOpcoes`, admin.html); a gravada que ja
     saiu da janela continua como opcao, senao salvar a tiraria da sprint. */
  function opcoesSprint(atual) {
    var SP = raiz.SPRINTPO;
    if (!SP) return { html: opt('', 'Fora da sprint', ''), fechada: false };
    var fechadas = SP.rotulosFechados(D());
    var ops = SP.proximasSprints(H.hoje(), 5, D().feriados || [], fechadas);
    var fechada = !!atual && SP.estaFechada(D(), atual);
    var h = opt('', 'Fora da sprint', atual);
    if (atual && !ops.some(function (o) { return o.rotulo === atual; })) h += opt(atual, SP.rotuloCurto(atual) + (fechada ? ' · fechada' : ' · anterior'), atual);
    h += ops.map(function (o) { return opt(o.rotulo, SP.rotuloCurto(o.rotulo) + ' · ' + H.dm(o.de) + '–' + H.dm(o.ate) + (o.agora ? ' · agora' : ''), atual); }).join('');
    return { html: h, fechada: fechada };
  }

  // ── O formulario ─────────────────────────────────────────────────────
  var EST = null;   // { m, anexos, enviando, inicial, ov }

  function html(m) {
    var papel = AX.APP.papel, dev = papel === 'dev', po = papel === 'admin';
    var c = contexto('');
    var trava = datasTravadas(m, c);
    var tipoTravado = dev && m && m.tipo;
    var h = '<div class="dlg axf" role="dialog" aria-modal="true" aria-labelledby="axf-t">' +
      '<button type="button" class="dlg-x" data-axf="fechar" aria-label="Fechar">' + H.ico('x') + '</button>' +
      '<div style="display:flex;flex-direction:column;gap:6px"><span class="lab">' + (m ? H.esc(m.codigo || 'DEMANDA') + ' · EDITAR' : 'NOVA DEMANDA') + '</span>' +
      '<h2 class="axf-t" id="axf-t">' + (m ? H.esc(m.titulo || '(sem título)') : 'Nova demanda') + '</h2>' +
      (m ? '<span class="note">A etapa muda pelas ações do item (mover, entregar, validar), cada uma com a sua regra.</span>' : '') + '</div>';

    // O QUE E
    h += '<section class="axf-sec"><span class="lab">O QUE É</span>' +
      campo('axf-titulo', 'Título', entrada('axf-titulo', m ? m.titulo : '', { dica: 'O que precisa ser feito, em uma frase' }), { lg: true, obrig: true }) +
      campo('axf-tipo', dev ? 'É problema ou melhoria?' : 'Tipo', '<select class="in" id="axf-tipo"' + (tipoTravado ? ' disabled' : '') + '>' +
        opt('', '— Selecione —', m ? m.tipo : '') + opt('sustentacao', 'Sustentação (erro, bug, ajuste)', m ? m.tipo : '') + opt('evolucao', 'Evolução (melhoria, novo)', m ? m.tipo : '') + '</select>',
        { obrig: true, nota: tipoTravado ? 'A classificação de demanda existente é do PM/PO.' : '' }) +
      campo('axf-tema', 'Sistema / módulo', '<select class="in" id="axf-tema">' + opcoesSistema(m ? m.tema_id : '') + '</select>', { obrig: !m || dev }) +
      campo('axf-descricao', 'Descrição', '<textarea class="in" id="axf-descricao" rows="10">' + H.esc(m ? m.descricao || '' : '') + '</textarea>', { lg: true }) +
      '</section>';

    // QUEM
    h += '<section class="axf-sec"><span class="lab">QUEM</span>' +
      campo('axf-solicitante', dev ? 'Quem pediu' : 'Solicitante', entrada('axf-solicitante', m ? m.solicitante : '', { dica: 'Nome de quem pediu — é quem homologa' }), { obrig: !m });
    if (!dev) {
      var od = opcoesDev(m ? m.dev : '');
      h += campo('axf-dev', 'Responsável', '<select class="in" id="axf-dev">' + od.html + '</select>' +
        entrada('axf-dev-manual', od.manual ? m.dev : '', { dica: 'Ana / Bruno', extra: od.manual ? '' : ' style="display:none"' }));
    } else {
      h += campo('axf-dev-ro', 'Responsável', entrada('axf-dev-ro', m ? (m.dev || '') : quem(), { desligado: true }), { nota: m ? '' : 'A demanda nasce com o seu nome.' });
    }
    h += campo('axf-projeto', 'Projeto', '<select class="in" id="axf-projeto">' + opcoesProjeto(m ? m.projeto_id : '') + '</select>',
      { nota: dev && !m ? 'Demanda de projeto entra no Backlog e é dimensionada no planning junto das outras.' : '' });
    if (!dev) h += campo('axf-prioridade', 'Prioridade', '<select class="in" id="axf-prioridade">' + opt('', '— Sem prioridade —', m ? m.prioridade : '') +
      opt('alta', 'Alta', m ? m.prioridade : '') + opt('media', 'Média', m ? m.prioridade : '') + opt('baixa', 'Baixa', m ? m.prioridade : '') + '</select>');
    h += '</section>';

    // QUANDO
    h += '<section class="axf-sec"><span class="lab">QUANDO</span>';
    if (!m) {
      var etapas = dev ? ETAPAS_NOVA_DEV : H.ETAPAS.map(function (e) { return e.id; }).filter(function (e) { return e !== 'negada'; });
      var padrao = dev ? 'planejado' : 'backlog';
      h += campo('axf-etapa', 'Etapa inicial', '<select class="in" id="axf-etapa">' + etapas.map(function (e) { return opt(e, (H.ETAPA_POR_ID[e] || {}).rotulo || e, padrao); }).join('') + '</select>');
    }
    if (!dev) {
      var os = opcoesSprint(m && raiz.SPRINTPO ? raiz.SPRINTPO.doPO(m) : '');
      h += campo('axf-sprint', 'Sprint', '<select class="in" id="axf-sprint"' + (!po || os.fechada ? ' disabled' : '') + '>' + os.html + '</select>',
        { nota: !po ? 'Só o PM/PO escolhe a sprint.' : os.fechada ? 'Sprint fechada — a demanda não sai mais dela.' : 'Obrigatória depois da Planning.' });
    }
    h += campo('axf-inicio', 'Início previsto', entrada('axf-inicio', m ? m.inicio : '', { tipo: 'date', desligado: trava })) +
      campo('axf-entrega', 'Entrega prevista', entrada('axf-entrega', m ? m.entrega : '', { tipo: 'date', desligado: trava }),
        { nota: trava ? 'A partir de Planejado a data é do Planejamento. Precisa mudar? Fale com o PM/PO.' : dev && !m ? 'Pelo seu painel a demanda nasce com a data de hoje; o prazo é combinado no planejamento.' : '' });
    if (!dev) {
      h += campo('axf-entrega-usuario', 'Entrega ao usuário', entrada('axf-entrega-usuario', m ? m.entrega_usuario : '', { tipo: 'date' }), { nota: 'Quando o usuário recebe, depois do PR. Vazio herda a do dev.' }) +
        campo('axf-data-solicitacao', 'Data da solicitação', entrada('axf-data-solicitacao', m ? m.data_solicitacao : '', { tipo: 'date' }));
    }
    h += '</section>';

    if (!dev) {
      var pk = m && m.poker_pontos != null ? String(m.poker_pontos) : '';
      var baralho = ['1', '2', '3', '5', '8', '12', '22'];
      if (pk && baralho.indexOf(pk) < 0) baralho.push(pk);
      h += '<section class="axf-sec"><span class="lab">ESFORÇO E MARCAS</span>' +
        campo('axf-pontos', 'Pontos', '<select class="in" id="axf-pontos">' + opt('', '—', pk) + baralho.map(function (p) { return opt(p, p, pk); }).join('') + '</select>',
          { nota: m && m.poker_media != null && m.poker_media !== '' ? 'Média do Poker: ' + H.esc(m.poker_media) : '' }) +
        campo('axf-horas', 'Horas realizadas', entrada('axf-horas', m && m.horas_realizadas ? m.horas_realizadas : '', { tipo: 'number', extra: ' min="0" step="0.5"' }),
          { nota: 'Obrigatórias para concluir.' }) +
        '<div class="axf-f axf-l"><span class="rt">Marcas</span><div class="axf-chk">' +
        [['debito_tecnico', 'Débito técnico'], ['dados_bi', 'Dados/BI'], ['sales_ops', 'Sales Ops'], ['spike', 'Spike']].map(function (k) {
          return '<label><input type="checkbox" id="axf-' + k[0] + '"' + (m && m[k[0]] && !(k[0] === 'sales_ops' && m.dados_bi) ? ' checked' : '') + '> ' + k[1] + '</label>';
        }).join('') + '</div></div></section>';
    }

    // ANEXOS
    h += '<section class="axf-sec"><span class="lab">ANEXOS</span><div class="axf-f axf-l">' +
      '<input type="file" id="axf-arquivo" multiple data-anexo-accept' + (raiz.ANEXOTIPO ? ' accept="' + H.esc(raiz.ANEXOTIPO.aceita()) + '"' : '') + '>' +
      '<div class="axf-an" id="axf-anexos"></div><span class="note">Até 1,5 MB por arquivo.' + (dev && m ? ' Os anexos que já estão na demanda ficam; os novos entram junto.' : '') + '</span></div></section>';

    h += '<div class="axf-pe"><span class="axf-erro" id="axf-erro" role="alert"></span>' +
      (m && m.codigo && po ? '<a class="btns" href="admin.html#' + encodeURIComponent(m.codigo) + '" title="Comitê, BIs, links, versão e os outros campos ficam no editor da Área administrativa">Mais campos no editor ' + H.ico('external', 'style="font-size:11px;opacity:.7"') + '</a>' : '') +
      '<button type="button" class="btn" data-axf="fechar">Cancelar</button>' +
      '<button type="button" class="btnp" id="axf-salvar" data-axf="salvar">' + (m ? 'Salvar alterações' : 'Criar demanda') + '</button></div></div>';
    return h;
  }

  function el(id) { return id && EST && EST.ov ? EST.ov.querySelector('#' + id) : null; }
  function val(id) { var e = el(id); return e ? String(e.value || '').trim() : undefined; }
  function marcado(id) { var e = el(id); return !!(e && e.checked); }

  function pintaAnexos() {
    var box = el('axf-anexos');
    if (!box) return;
    var podeTirar = AX.APP.papel !== 'dev';
    var fixos = EST.m && !podeTirar ? (EST.m.anexos || []).length : 0;
    box.innerHTML = EST.anexos.map(function (a, i) {
      return '<span class="chip c-bk">' + H.ico('clip') + ' ' + H.esc(a.nome || 'arquivo') +
        (i >= fixos ? '<button type="button" data-axf-tira="' + i + '" aria-label="Tirar ' + H.esc(a.nome || 'arquivo') + '">' + H.ico('x') + '</button>' : '') + '</span>';
    }).join('') + (EST.enviando ? '<span class="note">Enviando ' + H.plural(EST.enviando, 'arquivo', 'arquivos') + '…</span>' : '');
  }

  function sobe(arquivos) {
    [].slice.call(arquivos || []).forEach(function (f) {
      var T = raiz.ANEXOTIPO;
      if (T && !T.permitido(f.name)) { H.toast(T.recusa(f.name), 'erro'); return; }
      if (f.size > MAX_ANEXO) { H.toast('"' + f.name + '" excede 1,5 MB e não foi anexado.', 'erro'); return; }
      var rd = new FileReader();
      EST.enviando++;
      pintaAnexos();
      var meu = EST;
      rd.onload = function () {
        H.api('anexo-subir', { nome: f.name, dados: rd.result }).then(function (j) {
          meu.anexos.push({ nome: j.nome, tipo: j.tipo, tamanho: j.tamanho, chave: j.chave });
        }).catch(function (e) { H.toast('Falha ao anexar "' + f.name + '": ' + (e.message || e), 'erro'); })
          .then(function () { meu.enviando--; if (EST === meu) pintaAnexos(); });
      };
      rd.onerror = function () { meu.enviando--; H.toast('Não foi possível ler "' + f.name + '".', 'erro'); if (EST === meu) pintaAnexos(); };
      rd.readAsDataURL(f);
    });
  }

  /** O que o formulario daquele perfil mostra, lido da tela. */
  function ler() {
    var dev = AX.APP.papel === 'dev';
    var f = { titulo: val('axf-titulo'), tipo: val('axf-tipo'), tema_id: val('axf-tema'), descricao: val('axf-descricao'),
              solicitante: val('axf-solicitante'), projeto_id: val('axf-projeto'), anexos: EST.anexos.slice() };
    if (!el('axf-inicio').disabled) { f.inicio = val('axf-inicio'); f.entrega = val('axf-entrega'); }
    if (el('axf-etapa')) f.etapa = val('axf-etapa');
    if (!dev) {
      f.dev = val('axf-dev') === '__manual__' ? val('axf-dev-manual') : val('axf-dev');
      f.prioridade = val('axf-prioridade');
      f.entrega_usuario = val('axf-entrega-usuario');
      f.data_solicitacao = val('axf-data-solicitacao');
      f.poker_pontos = val('axf-pontos');
      f.horas = val('axf-horas');
      f.debito_tecnico = marcado('axf-debito_tecnico'); f.dados_bi = marcado('axf-dados_bi');
      f.sales_ops = marcado('axf-sales_ops'); f.spike = marcado('axf-spike');
      var s = el('axf-sprint');
      if (s && !s.disabled) f.sprint = s.value;
    }
    if (EST.m && !EST.anexosMexidos) delete f.anexos;
    return f;
  }

  var FOCO = { titulo: 'axf-titulo', tipo: 'axf-tipo', tema: 'axf-tema', solicitante: 'axf-solicitante', dev: 'axf-dev',
               sprint: 'axf-sprint', inicio: 'axf-inicio', entrega: 'axf-entrega', horas: 'axf-horas', etapa: 'axf-etapa' };
  function mostraErro(msg, campoLogico) {
    var e = el('axf-erro');
    if (e) e.textContent = msg || '';
    var alvo = el(FOCO[campoLogico] || '');
    if (alvo && !alvo.disabled) { alvo.focus(); try { alvo.scrollIntoView({ block: 'center' }); } catch (_) {} }
  }

  /** Ja existe uma demanda viva com este titulo? (`tituloJaUsado`). */
  function gemea(titulo, idAtual) {
    var k = raiz.tituloAssinatura ? raiz.tituloAssinatura(titulo) : '';
    if (!k) return null;
    return ((D().melhorias) || []).find(function (x) {
      return x && x.id !== idAtual && !x.oculto && !x.mesclado_em && String(x.status_planejamento || '') !== 'negada' && raiz.tituloAssinatura(x.titulo) === k;
    }) || null;
  }

  async function salvar() {
    var b = el('axf-salvar');
    if (!b || b.disabled) return;
    if (EST.enviando) { mostraErro('Espere o anexo terminar de subir — gravar agora deixaria o arquivo de fora.'); return; }
    mostraErro('');
    var m = EST.m;
    var f = ler();
    var id = m ? m.id : (EST.id || (EST.id = uid()));
    var c = contexto(id);
    var r = m ? edicao(m, f, c) : nova(f, c);
    if (!r.ok) { mostraErro(r.erro, r.campo); return; }
    if (m && !r.patch) { fecha(true); H.toast('Nada mudou.'); return; }
    var g = gemea(f.titulo, m ? m.id : null);
    // Na edicao so pergunta se o titulo mudou: editar nao colide com a propria demanda.
    if (g && (!m || String(f.titulo) !== String(m.titulo)) && raiz.AXIS_ACOES) {
      var ok = await raiz.AXIS_ACOES.caixa({ titulo: 'Já existe uma demanda com este título',
        texto: (g.codigo ? g.codigo + ' — ' : '') + g.titulo + ' (' + (g.dev || 'sem responsável') + '). Se for a mesma coisa, volte e edite a que existe em vez de abrir outra.',
        ok: m ? 'Salvar assim mesmo' : 'Criar assim mesmo', perigo: true });
      if (!ok) return;
    }
    b.disabled = true;
    var rot = b.textContent;
    b.textContent = 'Gravando…';
    var patch = {};
    patch[id] = m ? r.patch : r.obj;
    var out;
    try {
      out = await H.gravar(patch, { ok: m ? 'Demanda salva.' : 'Demanda criada.' });
    } finally {
      if (b.isConnected) { b.disabled = false; b.textContent = rot; }
    }
    if (!out || !out.ok) {
      // O texto fica na tela: a recusa do servidor veio no aviso, e a pessoa corrige e tenta de novo.
      mostraErro((out && (out.erro || (out.falta && out.falta.motivo))) || 'Não foi possível salvar.');
      return;
    }
    if (raiz.AXIS_ACOES) raiz.AXIS_ACOES.avisaRevertidos(out);
    fecha(true);
    // O `publish` devolve o codigo novo; o `dev-publish` nao — ai vale a base relida.
    var nasceu = ((D().melhorias) || []).find(function (x) { return x && x.id === id; });
    var codigo = ((out.resp || {}).codigos || {})[id] || (nasceu && nasceu.codigo);
    if (!m && codigo) location.hash = '#item/' + encodeURIComponent(codigo);
  }

  function retrato() { try { return JSON.stringify(ler()); } catch (_) { return ''; } }

  async function fecha(forcado) {
    if (!EST) return;
    if (!forcado && (EST.anexosMexidos || retrato() !== EST.inicial) && raiz.AXIS_ACOES) {
      var ok = await raiz.AXIS_ACOES.caixa({ titulo: 'Descartar o que foi escrito?', texto: 'As alterações deste formulário não foram gravadas.', ok: 'Descartar', perigo: true });
      if (!ok) return;
    }
    var e = EST;
    EST = null;
    if (e.ov) e.ov.remove();
    document.removeEventListener('keydown', e.tecla, true);
  }

  function abrir(m, o) {
    o = o || {};
    if (!H.pode('gravar')) { H.toast('Seu perfil é só de leitura.', 'erro'); return; }
    if (m && raiz.AXIS_ACOES && !raiz.AXIS_ACOES.podeEditar(m)) { H.toast('Esta demanda não é sua: quem edita é o responsável ou o PM/PO.', 'erro'); return; }
    if (EST) { document.removeEventListener('keydown', EST.tecla, true); EST.ov.remove(); EST = null; }
    css();
    var ov = document.createElement('div');
    ov.className = 'ovl axf-ovl';
    ov.innerHTML = html(m || null);
    document.body.appendChild(ov);
    EST = { m: m || null, ov: ov, anexos: JSON.parse(JSON.stringify((m && m.anexos) || [])), enviando: 0, anexosMexidos: false };
    if (raiz.ligaModeloDescricao) raiz.ligaModeloDescricao('axf-descricao', { auto: !m });
    if (raiz.COLABORADORES) raiz.COLABORADORES.ligar(el('axf-solicitante'), AX.WORKER, function () { return { token: AX.APP.token }; });
    if (raiz.ligaZonaAnexo) raiz.ligaZonaAnexo('axf-arquivo', function (fs) { EST.anexosMexidos = true; sobe(fs); });
    var arq = el('axf-arquivo');
    if (arq) arq.addEventListener('change', function () { EST.anexosMexidos = true; sobe(arq.files); arq.value = ''; });
    pintaAnexos();
    var dsel = el('axf-dev');
    if (dsel) dsel.addEventListener('change', function () {
      var man = el('axf-dev-manual');
      man.style.display = dsel.value === '__manual__' ? '' : 'none';
      if (dsel.value === '__manual__') man.focus();
    });
    // Dados/BI e Sales Ops sao exclusivos, como no admin.
    ['axf-dados_bi', 'axf-sales_ops'].forEach(function (id, i) {
      var x = el(id);
      if (x) x.addEventListener('change', function () { var y = el(i ? 'axf-dados_bi' : 'axf-sales_ops'); if (x.checked && y) y.checked = false; });
    });
    var pj = el('axf-projeto'), et = el('axf-etapa');
    if (pj && et && AX.APP.papel === 'dev') pj.addEventListener('change', function () {
      if (pj.value) { et.value = 'backlog'; et.disabled = true; } else et.disabled = false;
    });
    ov.addEventListener('click', function (e) {
      if (e.target === ov) { fecha(false); return; }
      var t = e.target.closest('[data-axf-tira]');
      if (t) { EST.anexos.splice(+t.getAttribute('data-axf-tira'), 1); EST.anexosMexidos = true; pintaAnexos(); return; }
      var b = e.target.closest('[data-axf]');
      if (!b) return;
      if (b.getAttribute('data-axf') === 'salvar') salvar(); else fecha(false);
    });
    EST.tecla = function (e) {
      if (!EST || document.querySelector('.ovl:not(.axf-ovl)')) return;
      if (e.key === 'Escape') { e.preventDefault(); fecha(false); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); salvar(); }
    };
    document.addEventListener('keydown', EST.tecla, true);
    EST.inicial = retrato();
    setTimeout(function () {
      var alvo = el(FOCO[o.foco] || 'axf-titulo');
      if (alvo && !alvo.disabled) { alvo.focus(); if (o.foco) try { alvo.scrollIntoView({ block: 'center' }); } catch (_) {} }
      if (o.foco && el('axf-erro')) el('axf-erro').textContent = o.foco === 'horas' ? 'Informe as horas e salve; depois repita a ação.' : o.foco === 'sprint' ? 'Escolha a sprint e salve; depois repita a ação.' : o.foco === 'dev' ? 'Escolha o responsável e salve; depois repita a ação.' : '';
    }, 0);
  }

  raiz.AXIS_FORM = Object.assign(api, { abrir: abrir });
}(typeof window !== 'undefined' ? window : globalThis));
