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
                     como responsavel, `origem: 'dev'` e no Backlog.

   IMPACTO E URGENCIA (`requisitos.js`) sao pedidos na abertura em todo
   perfil, como nas telas antigas; na edicao seguem editaveis.

   QUEM NAO E DONO DA SPRINT SO ABRE NO BACKLOG (`SPRINTPO.ehDonoDaSprint`):
   a etapa inicial e a sprint sao do dono, por conta, e nao do papel admin. O
   servidor faz o mesmo (`nascendoForaDoBacklog`).

   NA GRAVACAO, as regras que o admin aplica na publicacao: tema de dados liga
   a flag Dados/BI (`marcaDadosBiPorTema`) e Backlog sai sem data de inicio
   (`tiraInicioDoBacklog`).

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

   OS CAMPOS RAROS DO EDITOR DO ADMIN vieram para ca (PM/PO e analista):
   Validado em Comite (`comiteDoForm`; so quem `SELO.podeComite` marca), BIs
   impactados (`bisAdiciona`), links de referencia (`refAdiciona`), a
   referencia no GitHub (`ghLinkColeta`, links-github.js), versao e producao,
   mes de compromisso (`mesPreencheCampo`), grill (`GRILL.marca`), media do
   Poker (`sugereFibonacci`), destaque (`destaqueAlterna`) e o texto da
   entrega (resumo e implementacao). Na edicao cada grupo so entra no patch se
   foi mexido. Mesclar e acao do Item (axis-acoes.js). Do editor antigo nao
   sobrou campo; sobram la as assinaturas do spike e a aba de votos do Poker,
   que nao sao campos da demanda.

   SISTEMA NOVO ("+ outro"): a lista de temas vai inteira na gravacao, entao
   ela e montada sobre a base FRESCA lida logo antes (`H.api('dados')`), e
   nao sobre a da tela — a mesma ideia das ausencias no Planejamento.

   VALORES INICIAIS DA NOVA: `abrir(null, { dev, inicio, entrega })` abre a
   demanda nova ja com o responsavel e as datas — o clique no dia vazio da
   linha de um dev no Planejamento (o `openModal(null, dev, data)` do
   gantt.html). So preenche a tela: a regra de gravar e a de sempre.

   Publica `window.AXIS_FORM = { abrir(m|null, { foco, dev, inicio, entrega }) }` e, no Node,
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
  /* A partir de Planejado a data e do PM/PO: o servidor devolve a do dev
     (`travaDatasComprometidas`). O formulario mostra e nao deixa mexer. */
  var ETAPAS_DATA_TRAVADA = ['planejado', 'em_andamento', 'validacao_area', 'validacao', 'concluido'];
  var TIPOS = ['sustentacao', 'evolucao'];

  function ehPO(c) { return txt((c || {}).papel) === 'admin'; }
  /** O dono da sprint (o contexto traz `dono`; sem ele, vale o papel admin). */
  function dono(c) { return c && 'dono' in c ? !!c.dono : ehPO(c); }
  function ehDev(c) { return txt((c || {}).papel) === 'dev'; }
  function datasTravadas(m, c) { return !!m && !ehPO(c) && ETAPAS_DATA_TRAVADA.indexOf(txt(m.status_planejamento)) >= 0; }

  function acoes(c) { return mod(c, 'AXIS_ACOES'); }

  /* TEMA DE DADOS LEVA A FLAG DADOS/BI — a regra de `marcaDadosBiPorTema`
     (Worker) que o admin repete na publicacao: o nome do tema decide, e a flag
     so liga (desligando Sales Ops, que e exclusiva). Muta `obj`. */
  var TEMA_DADOS_RE = /^\s*(BI\b|Data\s?bricks|Extra[cç][aã]o de dados|Banco de dados)/i;
  function marcaDadosBiPorTema(obj, temas) {
    var t = (temas || []).find(function (x) { return x && x.id === obj.tema_id; });
    if (t && TEMA_DADOS_RE.test(String(t.nome || '')) && obj.dados_bi !== true) { obj.dados_bi = true; obj.sales_ops = false; }
    return obj;
  }
  /** Backlog sai sem data de inicio (`tiraInicioDoBacklog`). Muta `obj`. */
  function semInicioNoBacklog(obj) {
    if (obj.status_planejamento === 'backlog' && String(obj.inicio || '').trim()) obj.inicio = '';
    return obj;
  }
  /** Impacto e urgencia no valor gravado (`REQUISITOS.impacto`/`urgencia`). */
  function nivel(qual, v, c) {
    var R = mod(c, 'REQUISITOS');
    return R ? R[qual](v) : txt(v);
  }
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

  // ── Os campos raros do editor do admin ─────────────────────────────────
  /* As cartas do Poker e a sugestao pela media — COPIA de `FIBONACCI` e
     `fibonacciMaisProximo` (admin.html). Os pontos seguem a media digitada ate
     alguem escolher a carta na mao (`_pokerNaMao`). */
  var FIBONACCI = [1, 2, 3, 5, 8, 12, 22];
  function fibonacciMaisProximo(media) {
    var n = parseFloat(media);
    if (!isFinite(n) || n <= 0) return '';
    return String(FIBONACCI.reduce(function (a, b) { return Math.abs(b - n) < Math.abs(a - n) ? b : a; }));
  }

  /* VALIDADO EM COMITE — COPIA de `comiteDoForm` (admin.html). Sem nome nao ha
     marca (`null`); a data e a do PRIMEIRO registro: corrigir o nome nao
     reescreve quando o comite aconteceu. `cm` = { liga, quem, obs }. */
  function comiteDe(cm, antes, agora) {
    if (!cm || !cm.liga) return null;
    var quem = txt(cm.quem);
    if (!quem) return null;
    var a = (antes && antes.comite) || null;
    return { quem: quem.slice(0, 120), em: (a && a.em) || agora, obs: txt(cm.obs).slice(0, 300) };
  }

  /* OS BIs IMPACTADOS — COPIA de `bisAdiciona` (admin.html): nome limpo pelo
     `bis.js`, repetido nao entra (comparado pela normalizada) e ha um teto. */
  function biAdiciona(lista, nome, c) {
    var B = mod(c, 'BIS');
    var n = B ? B.limpa(nome) : txt(nome);
    if (!n) return falha('Escreva o nome do BI.', 'bi');
    var nr = function (x) { return B ? B.norm(x) : txt(x).toLowerCase(); };
    if ((lista || []).some(function (x) { return nr(x) === nr(n); })) return falha('Esse BI já está marcado nesta demanda.', 'bi');
    var max = B ? B.MAX_POR_DEMANDA : 20;
    if ((lista || []).length >= max) return falha('Limite de ' + max + ' BIs por demanda.', 'bi');
    return { ok: true, lista: (lista || []).concat([n]) };
  }

  /* OS LINKS DE REFERENCIA — COPIA de `refAdiciona` (admin.html). O endereco
     passa pela mesma limpeza do Worker (`referencia.js`: so http e https);
     sem descricao, entra o host. */
  function refAdiciona(lista, desc, url, c) {
    var R = mod(c, 'REFERENCIA');
    if (!R) return falha('referencia.js não carregado');
    var u = R.limpaUrl(url);
    if (!u) return falha(txt(url) ? 'Endereço inválido. Use um link http ou https.' : 'Informe o endereço do link.', 'ref-url');
    if ((lista || []).some(function (r) { return r.url === u; })) return falha('Esse link já está nesta demanda.', 'ref-url');
    if ((lista || []).length >= R.MAX_LINKS) return falha('Limite de ' + R.MAX_LINKS + ' links por demanda.', 'ref-url');
    return { ok: true, lista: (lista || []).concat([{ descricao: R.limpaDesc(desc) || R.host(u), url: u }]) };
  }

  /* A REFERENCIA NO GITHUB — a regra de `ghLinkColeta` (links-github.js): numero
     solo so com o repositorio escolhido, link completo sempre, e engano de
     campo (issue colada no PR) recusado. `g` = { repo, issue, pr, milestone }. */
  function githubDe(g, c) {
    var GH = mod(c, 'GH') || (raiz.ghLinkErro ? { erro: raiz.ghLinkErro, normaliza: raiz.ghLinkNormaliza } : null);
    if (!GH) return { ok: true, links: {} };
    var out = {};
    var tipos = ['issue', 'pr', 'milestone'];
    for (var i = 0; i < tipos.length; i++) {
      var t = tipos[i];
      if (!g || !(t in g)) continue;
      var msg = GH.erro(t, g[t], g.repo || '');
      if (msg) return falha(msg, /Escolha o repositório/.test(msg) ? 'gh-repo' : 'gh-' + t);
      out['link_' + t] = GH.normaliza(t, g[t], g.repo || '');
    }
    return { ok: true, links: out };
  }

  /* O MES DE COMPROMISSO — `mesPreencheCampo` (admin.html): doze meses em
     torno do corrente (seis para tras, cinco para a frente) e o ja gravado,
     mesmo fora da janela. A tela manda a INTENCAO (`mes_alvo`); quem escreve
     a trilha `meses` e o Worker (`carimbaMeses`). */
  function mesSoma(iso, n) {
    var a = parseInt(String(iso).slice(0, 4), 10), b = parseInt(String(iso).slice(5, 7), 10);
    var t = (a * 12 + (b - 1)) + n;
    return String(Math.floor(t / 12)) + '-' + String((t % 12) + 1).padStart(2, '0');
  }
  function trilhaDe(m) {
    return (m && Array.isArray(m.meses) ? m.meses : []).filter(function (x) { return x && /^\d{4}-(0[1-9]|1[0-2])$/.test(String(x.mes)); });
  }
  function mesesDoCampo(m, hoje) {
    var t = trilhaDe(m);
    var atual = t.length ? t[t.length - 1].mes : '';
    var base = String(hoje).slice(0, 7);
    var meses = [];
    for (var i = -6; i <= 5; i++) meses.push(mesSoma(base, i));
    if (atual && meses.indexOf(atual) < 0) meses.push(atual);
    meses.sort();
    return { atual: atual, meses: meses };
  }

  /* SISTEMA NOVO ("+ outro") — a regra de `catalogoResolve` (catalogo.js): o
     nome que ja existe (sem diferenca de caixa) e o tema que existe. A tranca
     do catalogo (lista vazia com a leitura falhada) nao se aplica: aqui a
     lista e a da base lida com sucesso, e a gravacao rele a base antes. */
  function temaNovo(nome, temas, id) {
    var n = txt(nome);
    if (!n) return falha('Escreva o caminho do sistema novo, com " - " entre os níveis (ex.: AXCred - Cobrança).', 'tema-novo');
    var achou = (temas || []).find(function (t) { return String((t && t.nome) || '').toLowerCase() === n.toLowerCase(); });
    if (achou) return { ok: true, id: achou.id, novo: null };
    return { ok: true, id: id, novo: { id: id, nome: n } };
  }

  /** Os campos raros do admin, sobre `obj` (a demanda nova ou a copia em
   *  edicao). So entra o que veio em `f` — e o formulario so manda o grupo que
   *  a pessoa mexeu. Booleano compara como booleano: `false` sobre `undefined`
   *  nao e mudanca. Muta `obj`; devolve a recusa ou null. */
  function extras(obj, antes, f, c) {
    var bool = function (k) { if (k in f && (!antes || !!f[k] !== !!antes[k])) obj[k] = !!f[k]; };
    if ('comite' in f) obj.comite = comiteDe(f.comite, antes, c.agora);
    var B = mod(c, 'BIS'), R = mod(c, 'REFERENCIA');
    if ('bis' in f) obj.bis_impactados = B ? B.daDemanda({ bis_impactados: f.bis }) : (f.bis || []).slice();
    if ('links' in f) obj.links = R ? R.daDemanda({ links: f.links }) : (f.links || []).slice();
    if ('gh' in f) { var g = githubDe(f.gh, c); if (!g.ok) return g; Object.assign(obj, g.links); }
    if ('versao' in f) obj.versao = txt(f.versao);
    bool('em_producao');
    if ('mes_alvo' in f) obj.mes_alvo = txt(f.mes_alvo);
    if ('poker_media' in f) { var pm = txt(f.poker_media); obj.poker_media = pm !== '' ? parseFloat(pm) : null; }
    if ('grill' in f) obj.grill = JSON.parse(JSON.stringify(f.grill || {}));
    if ('resumo_entrega' in f) obj.resumo_entrega = txt(f.resumo_entrega);
    if ('implementacao' in f) obj.implementacao = txt(f.implementacao);
    bool('destaque');
    return null;
  }

  /** O que vale para nova e edicao, na ordem do `saveMelhoria`/`saveNewDemand`. */
  function basicas(f, m, c) {
    if (!txt(f.titulo)) return falha('Informe o título.', 'titulo');
    var tipo = m && m.tipo && ehDev(c) ? m.tipo : f.tipo;
    if (TIPOS.indexOf(tipo) < 0) return falha(ehDev(c) ? 'Diga se é problema (Sustentação) ou melhoria (Evolução).' : 'Selecione o tipo: Sustentação ou Evolução.', 'tipo');
    /* IMPACTO E URGENCIA SAO DA ABERTURA, e so dela (`saveMelhoria`): as
       demandas antigas nao os tem, e cobrar em toda gravacao prenderia quem so
       corrige um texto. */
    if (!m && (!nivel('impacto', f.impacto, c) || !nivel('urgencia', f.urgencia, c))) {
      return falha('Informe o impacto e a urgência da demanda.', nivel('impacto', f.impacto, c) ? 'urgencia' : 'impacto');
    }
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
    var sp = txt(f.etapa) || 'backlog';
    var aviso = '';
    /* QUEM NAO E DONO DA SPRINT SO ABRE NO BACKLOG (02/11/2026): o dev sempre
       (`saveNewDemand`), e o admin que nao e o dono (`saveMelhoria`). */
    if (!dono(c) && sp !== 'backlog') {
      sp = 'backlog';
      if (!ehDev(c)) aviso = 'Demanda aberta no Backlog — só o PM/PO coloca em outra etapa e na sprint.';
    }
    var obj;
    if (ehDev(c)) {
      obj = {
        id: c.id, titulo: titulo, tema_id: txt(f.tema_id), descricao: txt(f.descricao),
        dev: txt(c.quem), tipo: f.tipo,
        solicitante: txt(f.solicitante), solicitante_email: emailDe(f.solicitante, null, c),
        origem: 'dev', projeto_id: txt(f.projeto_id), anexos: (f.anexos || []).slice(),
        inicio: txt(f.inicio), entrega: txt(f.entrega),
        status: STATUS_DEV[sp] || 'recebida', status_planejamento: sp,
        impacto: nivel('impacto', f.impacto, c), urgencia: nivel('urgencia', f.urgencia, c),
        estimativa: '', motivo_negacao: '', criado_em: c.agora
      };
      // Conta liberada (Sales Ops): a sprint escolhida entra ja na criacao.
      if (dono(c) && txt(f.sprint)) { var es = aplicaSprint(obj, f.sprint, c); if (es) return es; }
    } else {
      if (sp === 'negada') return falha('Demanda nova não nasce negada.', 'etapa');
      obj = {
        id: c.id, titulo: titulo, descricao: txt(f.descricao), tema_id: txt(f.tema_id), tipo: f.tipo,
        poker_media: null, poker_pontos: numOuNulo(f.poker_pontos, true),
        status: STATUS_ADMIN[sp] || 'recebida', status_planejamento: sp, estimativa: '',
        dev: txt(f.dev), prioridade: txt(f.prioridade),
        impacto: nivel('impacto', f.impacto, c), urgencia: nivel('urgencia', f.urgencia, c),
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
        pausa_pedido: null, pausa_recusas: [], pausa_aprovada_por: '', pausa_aprovada_em: '', pausa_terceiro: null,
        historico: [], anexos: (f.anexos || []).slice(), horas_realizadas: parseFloat(f.horas) || 0,
        criado_em: c.agora
      };
      var ex = extras(obj, null, f, c);
      if (ex) return ex;
      if (gestoSemDev(null, sp, obj.dev, f.sprint || '', c)) {
        return falha('Escolha o desenvolvedor: ' + (acoes(c) ? acoes(c).rotulo(sp) : sp) + ' exige responsável.', 'dev');
      }
      if (dono(c)) { var e = aplicaSprint(obj, f.sprint || '', c); if (e) return e; }
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
    semInicioNoBacklog(obj);
    marcaDadosBiPorTema(obj, (c.D || {}).temas);
    var AB = mod(c, 'ABERTURA');
    if (AB) {
      var ab = AB.checa(obj, ehDev(c) ? 'dev' : 'admin', c.hoje);
      if (!ab.ok) return falha(ab.erro, ab.campo);
    }
    return { ok: true, obj: obj, aviso: aviso };
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
    // Impacto e urgencia: em branco, o dev deixa o que estava (dev.html); o admin pode limpar.
    ['impacto', 'urgencia'].forEach(function (k) {
      if (!(k in f)) return;
      var v = nivel(k, f[k], c);
      if (v || !ehDev(c)) poe(k, v);
    });
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
      // Marca compara como booleano: `false` sobre campo ausente nao e mudanca (e ia no patch de toda demanda antiga).
      var marca = function (k, v) { if (!!v !== !!m[k]) poe(k, !!v); };
      ['debito_tecnico', 'spike'].forEach(function (k) { if (k in f) marca(k, f[k]); });
      if ('dados_bi' in f) { marca('dados_bi', f.dados_bi); marca('sales_ops', !f.dados_bi && !!f.sales_ops); }
      var ex = extras(depois, m, f, c);
      if (ex) return ex;
    }
    if (f.anexos) poe('anexos', f.anexos.slice());
    var sp = txt(m.status_planejamento);
    if (!ehDev(c) && gestoSemDev(m, sp, depois.dev, f.sprint != null ? f.sprint : m.sprint_po, c)) {
      return falha('Escolha o desenvolvedor: ' + (acoes(c) ? acoes(c).rotulo(sp) : sp) + ' exige responsável.', 'dev');
    }
    if (dono(c) && f.sprint != null) { var e = aplicaSprint(depois, f.sprint, c); if (e) return e; }
    semInicioNoBacklog(depois);
    marcaDadosBiPorTema(depois, (c.D || {}).temas);
    var patch = {};
    Object.keys(depois).forEach(function (k) { if (!igual(depois[k], m[k])) patch[k] = depois[k]; });
    if (!Object.keys(patch).length) return { ok: true, patch: null };
    return { ok: true, patch: patch };
  }

  /* ══ O RASCUNHO: O QUE FOI ESCRITO E AINDA NAO GRAVOU ══════════════════
     A regra do `rascunhoSalvar`/`mPersistir` do admin.html e da faixa de "nao
     publicadas" (`nao-publicada.js`): aviso que some nao protege trabalho,
     copia protege. O texto do formulario ficava so na memoria da aba — a
     gravacao falhava (rede, Worker fora do ar, sessao vencida), a pessoa fechava
     a aba, e acabou.

     Agora o formulario aberto guarda no navegador (localStorage) o que esta
     nele enquanto difere do que abriu, e GUARDA ANTES DE TENTAR gravar, como o
     `mPersistir`: se a gravacao falha, ou a aba morre no meio, o rascunho ja
     esta la. Gravou: sai. Fechou descartando: sai. Ao reabrir o mesmo
     formulario (a mesma demanda, ou a nova), ele e oferecido de volta; e a
     faixa do topo do app lista o que ficou para tras, com o caminho de volta.

     UM POR CONTA E POR ALVO (o id da demanda, ou "nova"): a conta que entra
     depois na mesma maquina nao ve o rascunho de outra. */
  function rascunhoDe(itens, login, alvo) {
    return (itens || []).filter(function (r) { return r && r.login === login && r.alvo === alvo; })[0] || null;
  }
  function rascunhoTira(itens, login, alvo) {
    return (itens || []).filter(function (r) { return r && !(r.login === login && r.alvo === alvo); });
  }
  function rascunhoPoe(itens, r) {
    return rascunhoTira(itens, r.login, r.alvo).concat([r]);
  }
  function rascunhosDe(itens, login) {
    return (itens || []).filter(function (r) { return r && r.login === login; });
  }
  /** O ciclo do `mPersistir`: guarda antes, grava, e so limpa se gravou. */
  async function comRascunho(guarda, gravar, limpa) {
    guarda();
    var out;
    try { out = await gravar(); }
    catch (e) { guarda(); throw e; }
    if (out && out.ok) limpa(); else guarda();
    return out;
  }

  var api = { nova: nova, edicao: edicao, ETAPAS_DATA_TRAVADA: ETAPAS_DATA_TRAVADA,
              rascunhoDe: rascunhoDe, rascunhoTira: rascunhoTira, rascunhoPoe: rascunhoPoe, rascunhosDe: rascunhosDe, comRascunho: comRascunho,
              marcaDadosBiPorTema: marcaDadosBiPorTema, TEMA_DADOS_RE: TEMA_DADOS_RE,
              fibonacciMaisProximo: fibonacciMaisProximo, comiteDe: comiteDe, biAdiciona: biAdiciona,
              refAdiciona: refAdiciona, githubDe: githubDe, mesesDoCampo: mesesDoCampo, temaNovo: temaNovo, extras: extras };
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
      // Os campos raros do admin: textos curtos, listas que crescem e a caixa do comite.
      '.axa .axf textarea.in.axf-curto{min-height:84px;font-family:inherit;font-size:13px}',
      '.axa .axf-lin{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr) auto;gap:8px;align-items:center}',
      '.axa .axf-gh{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}',
      '.axa .axf-it{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:var(--sf2);border:1px solid var(--bd2);font-size:12.5px;min-width:0}',
      '.axa .axf-it .ell{min-width:0}',
      '.axa .axf-it a{color:var(--tx3);font-size:11.5px;display:block}',
      '.axa .axf-sub{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:12px;background:var(--sf2);border:1px solid var(--bd2)}',
      '.axa .axf-in-erro{border-color:var(--dg) !important}',
      '.axa .axf .poker-aplicar{background:none;border:0;padding:0;color:var(--ac-t);font:inherit;font-weight:700;cursor:pointer;text-decoration:underline}',
      '.axa .axf .gh-refs{margin-top:2px}',
      // A oferta do rascunho: em cima de tudo, para ser vista antes de digitar por cima.
      '.axa .axf-rasc{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;padding:10px 14px;border-radius:12px;background:rgba(var(--wn-rgb),.1);border:1px solid rgba(var(--wn-rgb),.4);color:var(--wn-t);font-size:13px;line-height:20px}',
      '.axa .axf-rasc>span{flex:1 1 240px;min-width:0}',
      '.axa .axf-rasc .row{gap:8px;flex-wrap:wrap}',
      '@container app (max-width: 760px){.axa .axf-sec{grid-template-columns:minmax(0,1fr)}.axa .axf{padding:18px}}',
      '@media (max-width: 760px){.axa .axf-lin,.axa .axf-gh{grid-template-columns:minmax(0,1fr)}}',
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
  /* Sales Ops sem travas (Josias e Rikelme, 10/11/2026): escolhem etapa e sprint como o PM/PO. */
  function contaLivre() { var A = raiz.AXIS_ACOES; return !!(A && A.contaLivre && A.contaLivre({ papel: AX.APP.papel, quem: quem() })); }
  function contexto(id) { return { papel: AX.APP.papel, quem: quem(), hoje: H.hoje(), agora: new Date().toISOString(), id: id, D: D(), dono: H.donoDaSprint() || contaLivre() }; }
  /** O select de impacto ou urgencia (`REQUISITOS.opcoes`). */
  function opcoesNivel(qual, atual) {
    var R = raiz.REQUISITOS;
    if (R) return R.opcoes(qual, atual);
    return opt('', '— Selecione —', atual);
  }

  /* COM "+ outro", como no editor de sempre. Criar sistema troca a lista
     inteira de temas — e a lista da tela pode estar velha. Por isso a gravacao
     le a base FRESCA logo antes e acrescenta o tema a lista de la (`salvar`),
     como o Planejamento faz com ausencias e feriados. */
  function opcoesSistema(atual) {
    var temas = D().temas || [];
    return raiz.catalogoOpcoesHTML ? raiz.catalogoOpcoesHTML(temas, atual || '', { rotuloVazio: '— selecione o sistema —', outro: true })
      : '<option value="">— selecione o sistema —</option>' + temas.map(function (t) { return opt(t.id, t.nome, atual); }).join('') +
        '<option value="__novo__">+ outro (escrever)…</option>';
  }
  /** A previa da arvore que o nome vira (`temaPrevia`, admin.html). */
  function previaTema(v) {
    v = String(v || '').trim();
    if (!v) return 'Separe os níveis com " - " (espaço, hífen, espaço).';
    var p = v.split(' - ').map(function (x) { return x.trim(); }).filter(Boolean);
    return p.map(function (x, i) { return (i ? ' › ' : '') + (i === 0 ? '<b>' + H.esc(x) + '</b>' : H.esc(x)); }).join('') +
      (p.length === 1 ? ' <span style="color:var(--tx3)">(sistema, sem módulo)</span>' : '');
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

  /* AS DATAS DO TAMANHO DA SPRINT — COPIA de `mSprintDatas` (admin.html,
     585196d e 84bc1b8): "se eu estiver na S1-11 abrir as datas possiveis da
     semana da sprint e entrega ja preencher a proxima segunda".
     - Inicio e entrega do dev: o calendario abre so na semana da sprint, da
       SEGUNDA (mesmo feriado: a S1-11 vai de 02/11 a 06/11) ao fim de
       `SPRINTPO.faixaDaSprint`. E limite do seletor, nao trava: data antiga de
       quem rolou de sprint continua salvando, e o aviso diz que esta fora.
     - Entrega ao usuario: ESCOLHER a sprint preenche a segunda seguinte
       (`SPRINTPO.entregaDaSprint`). So no gesto — abrir o card nao preenche.
     Devolve null sem sprint (o seletor fica livre). */
  function semanaDaSprint(SPm, sp, feriados, inicio, entrega) {
    var fx = SPm && sp ? SPm.faixaDaSprint(sp, feriados || []) : null;
    if (!fx) return null;
    var faixa = { de: SPm.segundaDaSemana(fx.de), ate: fx.ate };
    var fora = [['início', inicio], ['entrega', entrega]]
      .filter(function (x) { return x[1] && (x[1] < faixa.de || x[1] > faixa.ate); }).map(function (x) { return x[0]; });
    return { de: faixa.de, ate: faixa.ate, segunda: SPm.entregaDaSprint(sp, feriados || []) || '', fora: fora };
  }

  /** A trilha de meses em texto (`mesPreencheCampo`): de onde veio e quantas vezes rolou. */
  function trilhaTxt(m, atual) {
    var t = trilhaDe(m);
    if (t.length <= 1) {
      var em = t.length && /^\d{4}-\d{2}-\d{2}$/.test(String(t[0].em || '')) ? t[0].em : (atual ? atual + '-01' : '');
      return atual ? 'Entrou neste mês em ' + H.dma(em) + '.' : 'O mês é carimbado quando a demanda entra em Planejado.';
    }
    return '<span style="color:var(--dg-t);font-weight:700">' + H.plural(t.length - 1, 'rolagem', 'rolagens') + '</span> · ' +
      t.map(function (x) { return H.esc(H.MESES_C[parseInt(x.mes.slice(5), 10) - 1] + '/' + x.mes.slice(2, 4)); }).join(' → ');
  }

  // ── O formulario ─────────────────────────────────────────────────────
  var EST = null;   // { m, anexos, enviando, inicial, ov, bis, refs, grill, pokerNaMao, grupos }

  function html(m) {
    var papel = AX.APP.papel, dev = papel === 'dev', livre = contaLivre(), po = H.donoDaSprint() || livre;
    var c = contexto('');
    var trava = datasTravadas(m, c);
    var tipoTravado = dev && m && m.tipo;
    var h = '<div class="dlg axf" role="dialog" aria-modal="true" aria-labelledby="axf-t">' +
      '<button type="button" class="dlg-x" data-axf="fechar" aria-label="Fechar">' + H.ico('x') + '</button>' +
      '<div style="display:flex;flex-direction:column;gap:6px"><span class="lab">' + (m ? H.esc(m.codigo || 'DEMANDA') + ' · EDITAR' : 'NOVA DEMANDA') + '</span>' +
      '<h2 class="axf-t" id="axf-t">' + (m ? H.esc(m.titulo || '(sem título)') : 'Nova demanda') + '</h2>' +
      (m ? '<span class="note">A etapa muda pelas ações do item (mover, entregar, validar), cada uma com a sua regra.</span>' : '') + '</div>' +
      '<div id="axf-rasc-oferta" hidden></div>';

    // O QUE E
    h += '<section class="axf-sec"><span class="lab">O QUE É</span>' +
      campo('axf-titulo', 'Título', entrada('axf-titulo', m ? m.titulo : '', { dica: 'O que precisa ser feito, em uma frase' }), { lg: true, obrig: true }) +
      campo('axf-tipo', dev ? 'É problema ou melhoria?' : 'Tipo', '<select class="in" id="axf-tipo"' + (tipoTravado ? ' disabled' : '') + '>' +
        opt('', '— Selecione —', m ? m.tipo : '') + opt('sustentacao', 'Sustentação (erro, bug, ajuste)', m ? m.tipo : '') + opt('evolucao', 'Evolução (melhoria, novo)', m ? m.tipo : '') + '</select>',
        { obrig: true, nota: tipoTravado ? 'A classificação de demanda existente é do PM/PO.' : '' }) +
      campo('axf-tema', 'Sistema / módulo', '<select class="in" id="axf-tema">' + opcoesSistema(m ? m.tema_id : '') + '</select>' +
        '<div id="axf-tema-novo-caixa" style="display:none;flex-direction:column;gap:6px">' +
        entrada('axf-tema-novo', '', { dica: 'Ex.: NovoSistema - Módulo', extra: ' maxlength="160" aria-describedby="axf-tema-previa"' }) +
        '<span class="note" id="axf-tema-previa"></span></div>', { obrig: !m || dev }) +
      campo('axf-impacto', 'Impacto', '<select class="in" id="axf-impacto">' + opcoesNivel('impacto', m ? m.impacto : '') + '</select>', { obrig: !m }) +
      campo('axf-urgencia', 'Urgência', '<select class="in" id="axf-urgencia">' + opcoesNivel('urgencia', m ? m.urgencia : '') + '</select>',
        { obrig: !m, nota: !m ? 'Seguem a demanda pela esteira; não calculam a prioridade.' : '' }) +
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
      var etapas = !po ? ['backlog'] : H.ETAPAS.map(function (e) { return e.id; }).filter(function (e) { return e !== 'negada'; });
      h += campo('axf-etapa', 'Etapa inicial', '<select class="in" id="axf-etapa"' + (!po ? ' disabled' : '') + '>' + etapas.map(function (e) { return opt(e, (H.ETAPA_POR_ID[e] || {}).rotulo || e, 'backlog'); }).join('') + '</select>',
        { nota: !po ? 'Demanda nova nasce no Backlog: só o PM/PO coloca em outra etapa e na sprint.' : '' });
    }
    if (!dev || livre) {
      var os = opcoesSprint(m && raiz.SPRINTPO ? raiz.SPRINTPO.doPO(m) : '');
      h += campo('axf-sprint', 'Sprint', '<select class="in" id="axf-sprint"' + (!po || os.fechada ? ' disabled' : '') + '>' + os.html + '</select>' +
        '<span class="note" id="axf-sprint-semana" aria-live="polite"></span>',
        { nota: !po ? 'Só a área de produto escolhe a sprint.' : os.fechada ? 'Sprint fechada — a demanda não sai mais dela.' : 'Obrigatória depois da Planning.' });
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
        campo('axf-poker-media', 'Média do Planning Poker', entrada('axf-poker-media', m && m.poker_media != null ? m.poker_media : '', { tipo: 'number', dica: 'ex.: 4,4', extra: ' min="0" step="0.1"' }),
          { nota: 'A votação sugere; o time decide os pontos.' }) +
        campo('axf-pontos', 'Pontos', '<select class="in" id="axf-pontos">' + opt('', '—', pk) + baralho.map(function (p) { return opt(p, p, pk); }).join('') + '</select>' +
          '<span class="note" id="axf-poker-nota"></span>') +
        campo('axf-horas', 'Horas realizadas', entrada('axf-horas', m && m.horas_realizadas ? m.horas_realizadas : '', { tipo: 'number', extra: ' min="0" step="0.25"' }),
          { nota: 'Obrigatórias para concluir.' }) +
        '<div class="axf-f axf-l"><span class="rt">Marcas</span><div class="axf-chk">' +
        [['debito_tecnico', 'Débito técnico'], ['dados_bi', 'Dados/BI'], ['sales_ops', 'Sales Ops'], ['spike', 'Spike']].map(function (k) {
          return '<label><input type="checkbox" id="axf-' + k[0] + '"' + (m && m[k[0]] && !(k[0] === 'sales_ops' && m.dados_bi) ? ' checked' : '') + '> ' + k[1] + '</label>';
        }).join('') + '</div></div>' +
        // OS BIs presos a marca Dados/BI (`bisMostraCaixa`): some sem a marca, mas o que ja foi marcado nao se perde.
        '<div class="axf-f axf-l" id="axf-bis-caixa" style="display:none"><span class="rt">BIs impactados <span class="note">— para rastrear o que foi feito em cada um</span></span>' +
        '<div class="axf-an" id="axf-bis"></div>' +
        '<div class="row" style="gap:8px">' + entrada('axf-bi-novo', '', { dica: 'Nome do BI — digite ou escolha', extra: ' list="axf-bi-lista" style="flex:1;min-width:0"' }) +
        '<datalist id="axf-bi-lista"></datalist><button type="button" class="btn" data-axf="bi">+ Incluir</button></div></div></section>';

      // ENTREGA E CODIGO: o texto da entrega (do dev, que o PM/PO pode corrigir), GitHub, versao e links.
      var prodQuando = m && m.em_producao && m.producao_em ? 'No ar desde ' + H.dma(String(m.producao_em).slice(0, 10)) + (m.producao_por ? ' · marcado por ' + H.esc(m.producao_por) : '') : '';
      h += '<section class="axf-sec"><span class="lab">ENTREGA E CÓDIGO</span>' +
        campo('axf-resumo', 'Resumo da entrega', '<textarea class="in axf-curto" id="axf-resumo" rows="3" maxlength="300" placeholder="Uma frase do que mudou, na linguagem de quem vai ler o slide.">' + H.esc(m ? m.resumo_entrega || '' : '') + '</textarea>',
          { lg: true, nota: '<span id="axf-resumo-conta"></span> · vai para o relatório e a apresentação' }) +
        campo('axf-impl', 'O que foi implementado', '<textarea class="in axf-curto" id="axf-impl" rows="4" placeholder="Preenchido pelo dev ao entregar. É por este texto que a entrega é validada.">' + H.esc(m ? m.implementacao || '' : '') + '</textarea>', { lg: true }) +
        '<div class="axf-f axf-l"><label for="axf-link-repo">Referência no GitHub <span class="note">— escolha o repositório e use só o número, ou cole o link completo</span></label>' +
        '<select class="in" id="axf-link-repo"></select><div class="axf-gh">' +
        entrada('axf-link-issue', '', { dica: 'Issue: 683', extra: ' aria-label="Issue no GitHub"' }) + entrada('axf-link-pr', '', { dica: 'PR: 712, 715', extra: ' aria-label="Pull request"' }) + entrada('axf-link-milestone', '', { dica: 'Milestone: 4', extra: ' aria-label="Milestone no GitHub"' }) +
        '</div><div id="axf-gh-chips">' + (m && raiz.ghLinkChips ? raiz.ghLinkChips(m) : '') + '</div></div>' +
        campo('axf-versao', 'Versão', entrada('axf-versao', m ? m.versao || '' : '', { dica: 'Versão: 1.4.2' }), { nota: 'Alimentada pela esteira (deploy-versao) ou escrita aqui.' }) +
        '<div class="axf-f"><span class="rt">Produção</span><div class="axf-chk"><label><input type="checkbox" id="axf-em-producao"' + (m && m.em_producao ? ' checked' : '') + '> Em produção</label></div>' +
        (prodQuando ? '<span class="note">' + prodQuando + '</span>' : '') + '</div>' +
        '<div class="axf-f axf-l"><span class="rt">Links de referência <span class="note">— planilha, Figma, chamado, thread</span></span>' +
        '<div class="axf-lin">' + entrada('axf-ref-desc', '', { dica: 'Descrição: Planilha do cliente', extra: ' maxlength="120" aria-label="Descrição do link"' }) +
        entrada('axf-ref-url', '', { dica: 'https://...', extra: ' aria-label="Endereço do link"' }) + '<button type="button" class="btn" data-axf="ref">+ Incluir</button></div>' +
        '<div id="axf-refs" style="display:grid;gap:6px"></div></div></section>';

      // VALIDACAO E PLANEJAMENTO: comite, grill, mes de compromisso e destaque.
      var podeCmt = !!(raiz.SELO && raiz.SELO.podeComite(AX.APP.eu));
      var cmt = (raiz.SELO && raiz.SELO.comite(m || {})) || null;
      var mc = mesesDoCampo(m, H.hoje());
      h += '<section class="axf-sec"><span class="lab">VALIDAÇÃO E PLANEJAMENTO</span>' +
        '<div class="axf-f axf-l"><div class="axf-chk"><label' + (podeCmt ? '' : ' title="Só PM/PO ou liderança marcam a validação em Comitê." style="opacity:.6"') + '>' +
        '<input type="checkbox" id="axf-comite"' + (cmt ? ' checked' : '') + (podeCmt ? '' : ' disabled') + '> ' + H.ico('shield') + ' Validado em Comitê</label></div>' +
        '<div class="axf-sub" id="axf-comite-caixa" style="display:' + (cmt ? 'flex' : 'none') + '">' +
        '<label for="axf-comite-quem" style="font-size:12.5px;font-weight:700;color:var(--tx2)">Quem validou no comitê <span class="note">— sem nome a marca não vale</span></label>' +
        entrada('axf-comite-quem', cmt ? cmt.quem : '', { dica: 'Nome de quem levou ou aprovou no comitê', desligado: !podeCmt, extra: ' maxlength="120"' }) +
        entrada('axf-comite-obs', cmt ? cmt.obs || '' : '', { dica: 'Observação do comitê (opcional)', desligado: !podeCmt, extra: ' maxlength="300" aria-label="Observação do comitê"' }) +
        (cmt && cmt.em ? '<span class="note">Registrado em ' + H.esc(H.dma(String(cmt.em).slice(0, 10))) + '</span>' : '') + '</div></div>' +
        '<div class="axf-f axf-l"><div class="axf-chk"><label><input type="checkbox" id="axf-grill"> ' + H.ico('flag') + ' Grill — o dev julga a demanda antes de ela entrar no planejamento</label></div>' +
        '<span class="note" id="axf-grill-estado"></span><div id="axf-grill-pontos" style="display:grid;gap:6px"></div></div>' +
        campo('axf-mes-alvo', 'Mês de compromisso', '<select class="in" id="axf-mes-alvo">' + opt('', '— sem mês —', mc.atual) +
          mc.meses.map(function (x) { return opt(x, H.MESES[parseInt(x.slice(5), 10) - 1] + ' de ' + x.slice(0, 4), mc.atual); }).join('') + '</select>',
          { nota: trilhaTxt(m, mc.atual) }) +
        (m ? '<div class="axf-f"><span class="rt">Apresentação</span><div class="axf-chk"><label title="Sai como destaque na apresentação do mês"><input type="checkbox" id="axf-destaque"' + (m.destaque ? ' checked' : '') + '> ' +
          H.ico('star') + ' Destaque da apresentação</label></div></div>' : '') +
        '</section>';
    }

    // ANEXOS
    h += '<section class="axf-sec"><span class="lab">ANEXOS</span><div class="axf-f axf-l">' +
      '<input type="file" id="axf-arquivo" multiple data-anexo-accept' + (raiz.ANEXOTIPO ? ' accept="' + H.esc(raiz.ANEXOTIPO.aceita()) + '"' : '') + '>' +
      '<div class="axf-an" id="axf-anexos"></div><span class="note">Até 1,5 MB por arquivo.' + (dev && m ? ' Os anexos que já estão na demanda ficam; os novos entram junto.' : '') + '</span></div></section>';

    h += '<div class="axf-pe"><span class="axf-erro" id="axf-erro" role="alert"></span>' +
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
          .then(function () { meu.enviando--; if (EST === meu) { pintaAnexos(); guardaLogo(); } });
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
    f.impacto = val('axf-impacto'); f.urgencia = val('axf-urgencia');
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
      /* OS CAMPOS RAROS SO VAO QUANDO MEXIDOS (na edicao): o patch leva o que
         mudou, e reescrever um link ou o comite que ninguem tocou so trocaria
         a forma do que ja estava gravado. Na demanda nova vai tudo. */
      var rx = rawExtras(), r0 = EST.extras0 || {};
      if (rx) {
        var mudou = function (k) { return !EST.m || rx[k] !== r0[k]; };
        if (mudou('comite') && raiz.SELO && raiz.SELO.podeComite(AX.APP.eu)) f.comite = { liga: marcado('axf-comite'), quem: val('axf-comite-quem'), obs: val('axf-comite-obs') };
        if (mudou('gh')) f.gh = { repo: val('axf-link-repo'), issue: val('axf-link-issue'), pr: val('axf-link-pr'), milestone: val('axf-link-milestone') };
        ['versao', 'mes_alvo', 'poker_media', 'resumo_entrega', 'implementacao', 'em_producao'].forEach(function (k) { if (mudou(k)) f[k] = rx[k]; });
        if (EST.m && rx.destaque !== null && mudou('destaque')) f.destaque = rx.destaque;
        if (!EST.m || EST.bisMexidos) f.bis = EST.bis.slice();
        if (!EST.m || EST.refsMexidos) f.links = EST.refs.slice();
        if (!EST.m || EST.grillMexido) f.grill = EST.grill;
      }
    }
    // Conta liberada (Sales Ops): o campo de sprint aparece para ela e e lido aqui.
    if (dev) { var sl = el('axf-sprint'); if (sl && !sl.disabled) f.sprint = sl.value; }
    if (f.tema_id === '__novo__') f.tema_novo = val('axf-tema-novo');
    if (EST.m && !EST.anexosMexidos) delete f.anexos;
    return f;
  }
  /** Os campos raros como estao na tela, para saber o que foi mexido. */
  function rawExtras() {
    if (!el('axf-resumo')) return null;
    return { comite: [marcado('axf-comite'), val('axf-comite-quem'), val('axf-comite-obs')].join('|'),
             gh: [val('axf-link-repo'), val('axf-link-issue'), val('axf-link-pr'), val('axf-link-milestone')].join('|'),
             versao: val('axf-versao'), em_producao: marcado('axf-em-producao'), mes_alvo: val('axf-mes-alvo'),
             poker_media: val('axf-poker-media'), resumo_entrega: val('axf-resumo'), implementacao: val('axf-impl'),
             destaque: el('axf-destaque') ? marcado('axf-destaque') : null };
  }

  // ── Os pedacos vivos dos campos raros ────────────────────────────────
  function pintaBis() {
    var box = el('axf-bis'), cx = el('axf-bis-caixa'), dl = el('axf-bi-lista');
    if (!box || !cx) return;
    box.innerHTML = EST.bis.length ? EST.bis.map(function (n, i) {
      return '<span class="chip c-in">' + H.ico('trend') + ' ' + H.esc(n) + '<button type="button" data-axf-bi-tira="' + i + '" aria-label="Tirar o BI ' + H.esc(n) + '">' + H.ico('x') + '</button></span>';
    }).join('') : '<span class="note">Nenhum BI marcado ainda.</span>';
    // O catalogo e o da base inteira, menos os que esta demanda ja tem (`bisRender`).
    var B = raiz.BIS;
    if (dl && B) {
      var ja = EST.bis.map(function (x) { return B.norm(x); });
      dl.innerHTML = B.catalogo(D().melhorias || []).filter(function (b) { return ja.indexOf(B.norm(b.nome)) < 0; })
        .map(function (b) { return '<option value="' + H.esc(b.nome) + '">' + b.qtd + ' demanda(s)</option>'; }).join('');
    }
    cx.style.display = marcado('axf-dados_bi') || EST.bis.length ? 'flex' : 'none';
  }
  function pintaRefs() {
    var box = el('axf-refs');
    if (!box) return;
    box.innerHTML = EST.refs.length ? EST.refs.map(function (r, i) {
      return '<div class="axf-it">' + H.ico('link', 'style="color:var(--tx3)"') + '<span class="ell" style="flex:1"><b class="ell" style="display:block">' + H.esc(r.descricao) + '</b>' +
        '<a href="' + H.esc(r.url) + '" target="_blank" rel="noopener noreferrer" class="ell">' + H.esc(r.url) + '</a></span>' +
        '<button type="button" class="btns" data-axf-ref-tira="' + i + '" aria-label="Tirar o link ' + H.esc(r.descricao) + '">' + H.ico('x') + '</button></div>';
    }).join('') : '<span class="note">Nenhum link ainda.</span>';
  }
  function pintaGrill() {
    var G = raiz.GRILL, est = el('axf-grill-estado'), pts = el('axf-grill-pontos'), cx = el('axf-grill');
    if (!G || !est || !pts || !cx) return;
    var g = G.dados({ grill: EST.grill });
    cx.checked = g.marcado;
    var e = G.estado({ grill: EST.grill });
    est.innerHTML = e === 'pendente' ? H.chip('aguardando o dev', 'wn') + ' Ele responde <b>entendi</b> (a demanda vai para Planning) ou <b>tenho dúvidas</b> (vai para Em aprovação de requisitos, com os pontos abaixo).'
      : e === 'ok' ? H.chip('entendido', 'ok') + ' O dev leu e não tem dúvida' + (g.respondido_por ? ' — ' + H.esc(g.respondido_por) : '') + '.'
      : e === 'duvida' ? H.chip('devolvida com dúvidas', 'in') + ' O dev levantou os pontos abaixo' + (g.respondido_por ? ', ' + H.esc(g.respondido_por) : '') + '. Resolva e mova para Planning.'
      : 'Marque quando a demanda precisar passar pelo crivo de quem vai executá-la antes de entrar no planejamento.';
    // As duvidas aparecem mesmo desmarcada: e depois de resolver que se rele o que foi perguntado.
    pts.innerHTML = g.pontos.map(function (p) {
      return '<div class="axf-it" style="flex-direction:column;align-items:flex-start;gap:3px"><span>' + H.esc(p.texto) + '</span>' +
        (p.por || p.em ? '<span class="note" style="font-size:11.5px">' + H.esc(p.por || '') + (p.em ? ' · ' + H.esc(H.dma(String(p.em).slice(0, 10))) : '') + '</span>' : '') + '</div>';
    }).join('');
  }
  /* A media manda nos pontos, a menos que alguem tenha escolhido a carta na
     mao (`sugereFibonacci`); a divergencia vira botao, e nao texto cinza. */
  function garanteCarta(sel, v) {
    if (!v || [].some.call(sel.options, function (o) { return o.value === v; })) return;
    var o = document.createElement('option'); o.value = v; o.textContent = v + ' (fora do baralho)'; sel.appendChild(o);
  }
  function pintaPoker() {
    var sel = el('axf-pontos'), nota = el('axf-poker-nota');
    if (!sel || !nota) return;
    var sug = fibonacciMaisProximo(val('axf-poker-media'));
    if (!sug) { nota.textContent = ''; return; }
    if (!EST.pokerNaMao) { garanteCarta(sel, sug); sel.value = sug; }
    nota.innerHTML = sel.value === sug ? 'sugerido pela média'
      : 'você escolheu <b>' + H.esc(sel.value || '—') + '</b>; a média sugere <b>' + H.esc(sug) + '</b> · <button type="button" class="poker-aplicar" data-axf="poker-aplicar">aplicar ' + H.esc(sug) + '</button>';
  }
  function contaResumo() {
    var t = el('axf-resumo'), n = el('axf-resumo-conta');
    if (!t || !n) return;
    var resta = 300 - t.value.length;
    n.textContent = resta === 0 ? 'limite de 300 caracteres atingido — cabe em 5 linhas' : 'restam ' + resta + ' de 300 caracteres';
    n.style.color = resta <= 30 ? 'var(--wn-t)' : '';
  }
  function incluiBi() {
    var c = el('axf-bi-novo');
    var r = biAdiciona(EST.bis, c ? c.value : '', { R: { BIS: raiz.BIS } });
    if (!r.ok) { if (r.erro && txt(c && c.value)) H.toast(r.erro, 'erro'); if (c) { if (/marcado/.test(r.erro)) c.value = ''; c.focus(); } return; }
    EST.bis = r.lista; EST.bisMexidos = true; c.value = ''; pintaBis(); c.focus();
  }
  function incluiRef() {
    var d = el('axf-ref-desc'), u = el('axf-ref-url');
    var r = refAdiciona(EST.refs, d.value, u.value, { R: { REFERENCIA: raiz.REFERENCIA } });
    if (!r.ok) { H.toast(r.erro, 'erro'); if (/já está/.test(r.erro)) u.value = ''; u.focus(); return; }
    EST.refs = r.lista; EST.refsMexidos = true; d.value = ''; u.value = ''; pintaRefs(); d.focus();
  }

  var FOCO = { titulo: 'axf-titulo', tipo: 'axf-tipo', tema: 'axf-tema', solicitante: 'axf-solicitante', dev: 'axf-dev',
               sprint: 'axf-sprint', inicio: 'axf-inicio', entrega: 'axf-entrega', horas: 'axf-horas', etapa: 'axf-etapa',
               impacto: 'axf-impacto', urgencia: 'axf-urgencia', 'tema-novo': 'axf-tema-novo', 'gh-repo': 'axf-link-repo',
               'gh-issue': 'axf-link-issue', 'gh-pr': 'axf-link-pr', 'gh-milestone': 'axf-link-milestone', bi: 'axf-bi-novo', 'ref-url': 'axf-ref-url' };
  function mostraErro(msg, campoLogico) {
    var e = el('axf-erro');
    if (e) e.textContent = msg || '';
    var alvo = el(FOCO[campoLogico] || '');
    [].forEach.call((EST && EST.ov ? EST.ov.querySelectorAll('.axf-in-erro') : []), function (x) { x.classList.remove('axf-in-erro'); });
    if (alvo && /^gh-/.test(campoLogico || '')) alvo.classList.add('axf-in-erro');
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
    // "+ outro": o nome que ja existe e o tema que existe; senao nasce um tema (gravado logo abaixo).
    var temaCriado = null;
    if (f.tema_id === '__novo__') {
      var tn = temaNovo(f.tema_novo, D().temas, EST.temaId || (EST.temaId = uid()));
      if (!tn.ok) { mostraErro(tn.erro, tn.campo); return; }
      f.tema_id = tn.id;
      temaCriado = tn.novo;
      if (temaCriado) c.D = Object.assign({}, c.D, { temas: (c.D.temas || []).concat([temaCriado]) });
    }
    delete f.tema_novo;
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
    var opts = { ok: m ? 'Demanda salva.' : 'Demanda criada.' };
    // Gravar e a decisao: um rascunho antigo ainda oferecido deixa de valer.
    if (EST.rascOferta) fechaOferta();
    try {
      /* O SISTEMA NOVO ENTRA NA LISTA FRESCA DO SERVIDOR, e nao na da tela: a
         lista de temas vai inteira, e uma tela aberta ha horas desfaria a
         renomeacao que outra pessoa fez nesse meio tempo. Se alguem criou o
         mesmo nome enquanto isso, vale o dele. */
      if (temaCriado) {
        var base;
        try { base = await H.api('dados'); }
        catch (e) { mostraErro(e.status === 401 ? 'Sessão expirada — saia e entre de novo.' : 'Sem conexão com o servidor: ' + (e.message || e)); return; }
        var tf = temaNovo(temaCriado.nome, base.temas || [], temaCriado.id);
        if (!tf.ok) { mostraErro(tf.erro, tf.campo); return; }
        if (tf.novo) { opts.raiz = { temas: (base.temas || []).concat([tf.novo]) }; opts.ok += ' Sistema "' + tf.novo.nome + '" criado.'; }
        else patch[id].tema_id = tf.id;
      }
      out = await comRascunho(function () { guardaRascunho(true); }, function () { return H.gravar(patch, opts); }, apagaRascunho);
    } finally {
      if (b.isConnected) { b.disabled = false; b.textContent = rot; }
    }
    if (!out || !out.ok) {
      // O texto fica na tela: a recusa do servidor veio no aviso, e a pessoa corrige e tenta de novo.
      mostraErro((out && (out.erro || (out.falta && out.falta.motivo))) || 'Não foi possível salvar.');
      return;
    }
    if (raiz.AXIS_ACOES) raiz.AXIS_ACOES.avisaRevertidos(out);
    if (r.aviso) H.toast(r.aviso);
    fecha(true);
    // O `publish` devolve o codigo novo; o `dev-publish` nao — ai vale a base relida.
    var nasceu = ((D().melhorias) || []).find(function (x) { return x && x.id === id; });
    var codigo = ((out.resp || {}).codigos || {})[id] || (nasceu && nasceu.codigo);
    if (!m && codigo) location.hash = '#item/' + encodeURIComponent(codigo);
  }

  /** O `mSprintDatas` na tela: limites do calendario, a segunda ao escolher e o aviso. */
  function pintaSemana(escolheu) {
    var sp = el('axf-sprint') ? val('axf-sprint') : '';
    var ini = el('axf-inicio'), ent = el('axf-entrega');
    var w = semanaDaSprint(raiz.SPRINTPO, sp, D().feriados || [], ini && ini.value, ent && ent.value);
    [ini, ent].forEach(function (x) {
      if (!x) return;
      if (w) { x.min = w.de; x.max = w.ate; } else { x.removeAttribute('min'); x.removeAttribute('max'); }
    });
    var usu = el('axf-entrega-usuario');
    if (escolheu && usu && w && w.segunda) usu.value = w.segunda;
    var nota = el('axf-sprint-semana');
    if (!nota) return;
    nota.style.color = w && w.fora.length ? 'var(--wn-t)' : '';
    nota.innerHTML = !w ? '' : H.ico('calendar') + ' Semana da sprint: ' + H.esc(H.dma(w.de) + ' a ' + H.dma(w.ate)) +
      (w.segunda ? ' · entrega ao usuário ' + H.esc(H.dma(w.segunda)) : '') +
      (w.fora.length ? ' · ' + H.ico('alert') + ' ' + H.esc(w.fora.join(' e ')) + ' fora da semana' : '');
  }

  function retrato() { try { return JSON.stringify(ler()); } catch (_) { return ''; } }
  function mexido() { return !!EST && (EST.anexosMexidos || retrato() !== EST.inicial); }

  // ── O rascunho no navegador (as regras puras estao la em cima) ───────
  var RASCUNHO_KEY = 'rm_axis_rascunho';
  function rascLer() {
    try { var d = JSON.parse(localStorage.getItem(RASCUNHO_KEY) || 'null'); return d && d.v === 1 && Array.isArray(d.itens) ? d.itens : []; }
    catch (_) { return []; }
  }
  function rascGravar(itens) {
    try {
      if (itens.length) localStorage.setItem(RASCUNHO_KEY, JSON.stringify({ v: 1, itens: itens }));
      else localStorage.removeItem(RASCUNHO_KEY);
    } catch (_) { /* sem localStorage, segue sem a rede de seguranca */ }
  }
  function login() { var e = AX.APP.eu || {}; return String(e.login || e.email || AX.APP.papel || ''); }
  function alvoDe(m) { return m ? String(m.id) : 'nova'; }
  /** Tudo o que esta no formulario, campo a campo, e as listas que vivem fora dos campos. */
  function foto() {
    var campos = {};
    [].forEach.call(EST.ov.querySelectorAll('input[id^="axf-"], select[id^="axf-"], textarea[id^="axf-"]'), function (x) {
      if (x.type === 'file' || x.disabled) return;
      campos[x.id] = x.type === 'checkbox' ? !!x.checked : x.value;
    });
    return { campos: campos, anexos: EST.anexos, bis: EST.bis, refs: EST.refs, grill: EST.grill,
             marcas: { anexosMexidos: !!EST.anexosMexidos, bisMexidos: !!EST.bisMexidos, refsMexidos: !!EST.refsMexidos,
                       grillMexido: !!EST.grillMexido, pokerNaMao: !!EST.pokerNaMao },
             id: EST.id || '', temaId: EST.temaId || '' };
  }
  /** Guarda o formulario aberto. `forca`: guarda mesmo sem mudanca (logo antes
      de gravar). Com um rascunho anterior ainda oferecido, nao escreve por cima
      dele: a pessoa ainda nao disse se quer o antigo de volta. */
  function guardaRascunho(forca) {
    if (!EST || !EST.ov || !EST.ov.isConnected) return;
    if (EST.rascOferta && !forca) return;
    var lg = EST.login, alvo = alvoDe(EST.m);
    if (!lg) return;
    if (!forca && !mexido()) { rascGravar(rascunhoTira(rascLer(), lg, alvo)); return; }
    rascGravar(rascunhoPoe(rascLer(), { login: lg, alvo: alvo, codigo: (EST.m && EST.m.codigo) || '',
      titulo: val('axf-titulo') || (EST.m && EST.m.titulo) || '', em: new Date().toISOString(), foto: foto() }));
  }
  function apagaRascunho() {
    if (!EST) return;
    rascGravar(rascunhoTira(rascLer(), EST.login, alvoDe(EST.m)));
  }
  var _rascTimer = null;
  function guardaLogo() {
    clearTimeout(_rascTimer);
    _rascTimer = setTimeout(function () { guardaRascunho(false); }, 400);
  }
  /** Devolve o rascunho para os campos, e os pedacos que dependem deles. */
  function aplicaFoto(f) {
    var c = (f && f.campos) || {};
    Object.keys(c).forEach(function (id) {
      var x = el(id);
      if (!x || x.disabled) return;
      if (x.type === 'checkbox') { x.checked = !!c[id]; return; }
      if (x.tagName === 'SELECT' && ![].some.call(x.options, function (o) { return o.value === String(c[id]); })) {
        if (id === 'axf-pontos') garanteCarta(x, String(c[id])); else return;
      }
      x.value = c[id];
    });
    ['anexos', 'bis', 'refs'].forEach(function (k) { if (Array.isArray(f[k])) EST[k] = JSON.parse(JSON.stringify(f[k])); });
    if (f.grill && typeof f.grill === 'object') EST.grill = JSON.parse(JSON.stringify(f.grill));
    Object.keys(f.marcas || {}).forEach(function (k) { EST[k] = !!f.marcas[k]; });
    if (f.id) EST.id = f.id;
    if (f.temaId) EST.temaId = f.temaId;
    var tsel = el('axf-tema');
    if (tsel) { el('axf-tema-novo-caixa').style.display = tsel.value === '__novo__' ? 'flex' : 'none'; el('axf-tema-previa').innerHTML = previaTema(val('axf-tema-novo')); }
    var dsel = el('axf-dev');
    if (dsel) el('axf-dev-manual').style.display = dsel.value === '__manual__' ? '' : 'none';
    var cmt = el('axf-comite');
    if (cmt) el('axf-comite-caixa').style.display = cmt.checked ? 'flex' : 'none';
    pintaBis(); pintaRefs(); pintaGrill(); pintaAnexos(); contaResumo(); pintaPoker(); pintaSemana(false);
  }
  function quandoTxt(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return H.dm(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')) +
      ' às ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function ofereceRascunho(r) {
    var box = el('axf-rasc-oferta');
    if (!box) return;
    EST.rascOferta = r;
    box.hidden = false;
    box.className = 'axf-rasc';
    box.setAttribute('role', 'status');
    box.innerHTML = H.ico('alert') + '<span>Há um rascunho deste formulário, de ' + H.esc(quandoTxt(r.em)) + ', que <b>não foi gravado</b>' +
      (r.titulo ? ' ("' + H.esc(r.titulo) + '")' : '') + '.</span>' +
      '<span class="row"><button type="button" class="btns" data-axf="rasc-volta">Recuperar</button>' +
      '<button type="button" class="btns" data-axf="rasc-descarta">Descartar</button></span>';
  }
  function fechaOferta() {
    var box = el('axf-rasc-oferta');
    if (box) { box.hidden = true; box.innerHTML = ''; box.className = ''; }
    if (EST) EST.rascOferta = null;
  }
  function recupera() {
    var r = EST && EST.rascOferta;
    if (!r) return;
    fechaOferta();
    aplicaFoto(r.foto || {});
    guardaRascunho(true);
    var t = el('axf-titulo');
    if (t && !t.disabled) t.focus();
  }
  /** Os rascunhos desta conta que nao estao abertos agora (a faixa do app). */
  function rascunhos() {
    var aberto = EST ? alvoDe(EST.m) : null;
    return rascunhosDe(rascLer(), login()).filter(function (r) { return r.alvo !== aberto; })
      .map(function (r) { return { alvo: r.alvo, codigo: r.codigo, titulo: r.titulo, em: r.em }; });
  }
  /** Abre o formulario com o rascunho ja devolvido (a faixa do app). */
  function abrirRascunho(alvo) {
    var r = rascunhoDe(rascLer(), login(), alvo);
    if (!r) { if (AX.pintaFaixas) AX.pintaFaixas(); return; }
    if (alvo === 'nova') { abrir(null, { rascunho: true }); return; }
    var m = ((D().melhorias) || []).find(function (x) { return x && String(x.id) === alvo && !x.oculto; });
    if (!m) {
      rascGravar(rascunhoTira(rascLer(), login(), alvo));
      H.toast('A demanda ' + (r.codigo || '') + ' não existe mais; o rascunho dela foi descartado.', 'erro');
      if (AX.pintaFaixas) AX.pintaFaixas();
      return;
    }
    abrir(m, { rascunho: true });
  }

  async function fecha(forcado) {
    if (!EST) return;
    if (!forcado && mexido() && raiz.AXIS_ACOES) {
      var ok = await raiz.AXIS_ACOES.caixa({ titulo: 'Descartar o que foi escrito?', texto: 'As alterações deste formulário não foram gravadas.', ok: 'Descartar', perigo: true });
      if (!ok) return;
    }
    // Fechar de fato (gravou, nada mudou, ou descartou) leva o rascunho junto.
    // Um rascunho anterior so oferecido, e nem recuperado nem descartado, fica.
    clearTimeout(_rascTimer);
    if (!EST.rascOferta) apagaRascunho();
    solta();
  }
  /** Tira o formulario da tela sem mexer no rascunho (outra conta entrou). */
  function solta() {
    if (!EST) return;
    clearTimeout(_rascTimer);
    var e = EST;
    EST = null;
    if (e.ov) e.ov.remove();
    document.removeEventListener('keydown', e.tecla, true);
    if (AX.pintaFaixas) AX.pintaFaixas();
  }

  /** Os valores iniciais da demanda nova (ver o cabecalho). Antes do
   *  `retrato`: fechar sem mexer nao pergunta se descarta o que veio pronto. */
  function preencheNova(o) {
    var dsel = el('axf-dev');
    if (dsel && o.dev) {
      var tem = [].some.call(dsel.options, function (x) { return x.value === o.dev; });
      dsel.value = tem ? o.dev : '__manual__';
      if (!tem) { el('axf-dev-manual').value = o.dev; el('axf-dev-manual').style.display = ''; }
    }
    ['inicio', 'entrega'].forEach(function (k) {
      var x = el('axf-' + k);
      if (x && !x.disabled && /^\d{4}-\d{2}-\d{2}$/.test(String(o[k] || ''))) x.value = o[k];
    });
  }

  function abrir(m, o) {
    o = o || {};
    if (!H.pode('gravar')) { H.toast('Seu perfil é só de leitura.', 'erro'); return; }
    if (m && raiz.AXIS_ACOES && !raiz.AXIS_ACOES.podeEditar(m)) { H.toast('Esta demanda não é sua: quem edita é o responsável ou o PM/PO.', 'erro'); return; }
    if (EST) solta();
    css();
    var ov = document.createElement('div');
    ov.className = 'ovl axf-ovl';
    ov.innerHTML = html(m || null);
    document.body.appendChild(ov);
    EST = { m: m || null, ov: ov, anexos: JSON.parse(JSON.stringify((m && m.anexos) || [])), enviando: 0, anexosMexidos: false,
            // Copias em edicao, como `_mBis`, `_mRefs` e `_mGrill` do admin: cancelar nao deixa nada aplicado.
            bis: raiz.BIS ? raiz.BIS.daDemanda(m || {}) : [], refs: raiz.REFERENCIA ? raiz.REFERENCIA.daDemanda(m || {}) : [],
            grill: JSON.parse(JSON.stringify((m && m.grill) || {})), pokerNaMao: false,
            // A conta dona do rascunho e a de quem abriu: com a sessao vencida no meio
            // da gravacao, a sessao ja esta vazia quando o rascunho e guardado de novo.
            login: login() };
    if (el('axf-link-repo') && raiz.ghLinkPreenche) raiz.ghLinkPreenche('axf', m || null, D().melhorias || []);
    pintaBis(); pintaRefs(); pintaGrill(); contaResumo();
    var tsel = el('axf-tema');
    if (tsel) tsel.addEventListener('change', function () {
      var novo = tsel.value === '__novo__';
      el('axf-tema-novo-caixa').style.display = novo ? 'flex' : 'none';
      el('axf-tema-previa').innerHTML = previaTema(val('axf-tema-novo'));
      if (novo) el('axf-tema-novo').focus();
    });
    var tnovo = el('axf-tema-novo');
    if (tnovo) tnovo.addEventListener('input', function () { el('axf-tema-previa').innerHTML = previaTema(tnovo.value); });
    var cmt = el('axf-comite');
    if (cmt) cmt.addEventListener('change', function () { el('axf-comite-caixa').style.display = cmt.checked ? 'flex' : 'none'; if (cmt.checked) el('axf-comite-quem').focus(); });
    var gr = el('axf-grill');
    if (gr) gr.addEventListener('change', function () {
      var alvo = { grill: EST.grill };
      if (raiz.GRILL) { if (gr.checked) raiz.GRILL.marca(alvo, quem()); else raiz.GRILL.desmarca(alvo); }
      EST.grill = alvo.grill; EST.grillMexido = true;
      pintaGrill();
    });
    var pm = el('axf-poker-media'), pts = el('axf-pontos');
    if (pm) pm.addEventListener('input', pintaPoker);
    if (pts) pts.addEventListener('change', function () { EST.pokerNaMao = true; pintaPoker(); });
    var rs = el('axf-resumo');
    if (rs) rs.addEventListener('input', contaResumo);
    var dbi = el('axf-dados_bi'), sop = el('axf-sales_ops');
    [dbi, sop].forEach(function (x) { if (x) x.addEventListener('change', pintaBis); });
    // Enter nos campos de lista inclui, como no admin (sem Enter a pessoa clicaria no "+ Incluir" toda vez).
    ov.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.ctrlKey || e.metaKey) return;
      if (e.target.id === 'axf-bi-novo') { e.preventDefault(); incluiBi(); }
      else if (e.target.id === 'axf-ref-desc' || e.target.id === 'axf-ref-url') { e.preventDefault(); incluiRef(); }
    });
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
    ov.addEventListener('click', function (e) {
      if (e.target === ov) { fecha(false); return; }
      var t = e.target.closest('[data-axf-tira]');
      if (t) { EST.anexos.splice(+t.getAttribute('data-axf-tira'), 1); EST.anexosMexidos = true; pintaAnexos(); return; }
      var tb = e.target.closest('[data-axf-bi-tira]');
      if (tb) { EST.bis.splice(+tb.getAttribute('data-axf-bi-tira'), 1); EST.bisMexidos = true; pintaBis(); return; }
      var tr = e.target.closest('[data-axf-ref-tira]');
      if (tr) { EST.refs.splice(+tr.getAttribute('data-axf-ref-tira'), 1); EST.refsMexidos = true; pintaRefs(); return; }
      var b = e.target.closest('[data-axf]');
      if (!b) return;
      var q = b.getAttribute('data-axf');
      if (q === 'salvar') salvar();
      else if (q === 'bi') incluiBi();
      else if (q === 'ref') incluiRef();
      else if (q === 'rasc-volta') recupera();
      else if (q === 'rasc-descarta') { fechaOferta(); guardaRascunho(false); }
      else if (q === 'poker-aplicar') {
        var sg = fibonacciMaisProximo(val('axf-poker-media')), sl = el('axf-pontos');
        if (sg && sl) { garanteCarta(sl, sg); sl.value = sg; EST.pokerNaMao = false; pintaPoker(); }
      } else fecha(false);
    });
    EST.tecla = function (e) {
      // Escondido atras da tela de entrar (sessao vencida): o teclado e do login.
      if (!EST || EST.ov.style.display === 'none' || document.querySelector('.ovl:not(.axf-ovl)')) return;
      if (e.key === 'Escape') { e.preventDefault(); fecha(false); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); salvar(); }
    };
    document.addEventListener('keydown', EST.tecla, true);
    // Datas no tamanho da sprint: escolher a sprint preenche a segunda; abrir nao preenche nada.
    var ssel = el('axf-sprint');
    if (ssel) ssel.addEventListener('change', function () { pintaSemana(true); });
    ['axf-inicio', 'axf-entrega'].forEach(function (id) { var x = el(id); if (x) x.addEventListener('input', function () { pintaSemana(false); }); });
    pintaSemana(false);
    if (!m) preencheNova(o);
    EST.extras0 = rawExtras();
    EST.inicial = retrato();
    // Cada mudanca guarda o rascunho (um pouco depois de parar de digitar).
    ov.addEventListener('input', guardaLogo);
    ov.addEventListener('change', guardaLogo);
    ov.addEventListener('click', function (e) { if (e.target.closest('[data-axf-tira], [data-axf-bi-tira], [data-axf-ref-tira], [data-axf="bi"], [data-axf="ref"], [data-axf="poker-aplicar"]')) guardaLogo(); });
    var antes = rascunhoDe(rascLer(), EST.login, alvoDe(m || null));
    if (antes) { if (o.rascunho) { EST.rascOferta = antes; recupera(); } else ofereceRascunho(antes); }
    if (AX.pintaFaixas) AX.pintaFaixas();
    setTimeout(function () {
      var alvo = el(FOCO[o.foco] || 'axf-titulo');
      if (alvo && !alvo.disabled) { alvo.focus(); if (o.foco) try { alvo.scrollIntoView({ block: 'center' }); } catch (_) {} }
      if (o.foco && el('axf-erro')) el('axf-erro').textContent = o.foco === 'horas' ? 'Informe as horas e salve; depois repita a ação.' : o.foco === 'sprint' ? 'Escolha a sprint e salve; depois repita a ação.' : o.foco === 'dev' ? 'Escolha o responsável e salve; depois repita a ação.' : '';
    }, 0);
  }

  raiz.AXIS_FORM = Object.assign(api, { abrir: abrir, rascunhos: rascunhos, abrirRascunho: abrirRascunho, soltar: solta,
                                         guardaRascunho: function () { clearTimeout(_rascTimer); guardaRascunho(false); } });
}(typeof window !== 'undefined' ? window : globalThis));
