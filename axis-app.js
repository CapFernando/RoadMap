/* ─────────────────────────────────────────────────────────────────────────
   AXIS — nucleo do app novo (axis.html).

   UM APP SO PARA DEV, PO/ADMIN E CONSULTA. O que cada um ve sai do perfil
   (DOC-04 do EP-013): o dev ve tudo de trabalho, o admin ve tudo, a consulta
   ve o gerencial. Antes cada perfil tinha a sua tela (admin.html, dev.html)
   e o dev enxergava tres itens de menu.

   O DADO E O MESMO DAS TELAS ANTIGAS. Le pela rota `dados` do Worker, com o
   mesmo token, e as regras (etapa, prazo, sprint, capacidade, vinculo...) vem
   dos modulos compartilhados — os mesmos que a suite de invariantes executa.
   Nenhuma conta de negocio e reescrita aqui: duas copias divergem.

   GRAVAR E POR PATCH (`gravar`, logo abaixo, sobre gravacao.js): cada acao
   manda so os campos que mudou, sobre a base fresca do servidor. O formulario
   de demanda (nova e editar) e axis-form-demanda.js; mover, validar, devolver,
   homologar, replanejar, pausar, negar e entregar sao axis-acoes.js. O que
   ainda nao foi portado abre o editor de sempre (admin.html, dev.html), com a
   sessao compartilhada: nao pede login.

   As telas se registram com AXIS_APP.tela({...}) em arquivos axis-tela-*.js.

   SESSAO E BASE FRESCA, como nas telas antigas: qualquer 401 de sessao, em
   qualquer chamada, traz a tela de entrar sem perder o que estava aberto, e a
   entrada volta para a mesma rota (`sessaoExpirou`); a base e relida a cada
   30 s e ao voltar para a aba, sem redesenhar por cima de formulario ou
   gaveta aberta — ai aparece a faixa "Ha alteracoes mais novas no servidor"
   (`conferirServidor`). Quem desenvolve e entra sem nome nas demandas escolhe
   o nome antes de abrir o app (`pedirVinculo`, axis-tela-conta.js).

   NO CELULAR (largura do app ate 760 px, a mesma container query `app` do
   axis-app.css) o app e outro desenho, nao o do computador encolhido:
   - MENU: a barra lateral some e entra a BARRA INFERIOR fixa (`.bn`): Inicio,
     Meu trabalho, Quadro (o que o perfil ve, completado ate tres pelo MENU),
     Buscar e Mais. "Mais" abre uma gaveta com o resto do MENU do perfil, a
     conta e o Sair. A regra de quem vai para a barra e `barraInferior(papel)`,
     pura e exportada (a suite cobre por perfil).
   - TOPO compacto: busca e "+ Nova demanda" viram botoes de icone.
   - ALVO DE TOQUE de 44 px e TEXTO de 12 px no minimo nos componentes base
     (.btn, .btns, .btnp, .tab, .in, chip clicavel, itens de menu, linhas).
     Quando o desenho e menor (chip, link de texto), a area de toque cresce
     por borda transparente ou padding com margem negativa: o desenho fica.
   - JANELAS (.ovl/.dlg, o formulario de demanda e as caixas das acoes)
     ocupam a tela inteira, so por CSS.

   O QUE AS TELAS USAM PARA FICAR BOAS NO CELULAR (helpers em H):
   - H.filtros(html, nAtivos, { id, titulo }) — FILTROS RECOLHIDOS. Recebe o
     HTML dos controles de filtro (selects, inputs, Limpar) e devolve um bloco
     que no computador e transparente (display: contents: os controles ficam
     onde estavam, no flex/grid da tela) e no celular vira o botao
     "Filtros (n)", que abre uma gaveta de baixo para cima COM OS MESMOS
     ELEMENTOS dentro. Como os controles nao mudam de lugar no DOM, os
     ouvintes da tela (inclusive os delegados na vista) continuam valendo, e
     a gaveta continua aberta quando a tela se redesenha (o aberto mora aqui,
     por `id`). `nAtivos` e quantos filtros estao fora do padrao; quem so
     repinta parte da tela atualiza o numero com H.filtrosN(id, n). A busca
     de texto, que se quer sempre a mao, fica FORA do helper.
   - H.gaveta({ titulo, html, pe, aoFechar }) — GAVETA (bottom sheet)
     generica, presa ao <body>: fecha no X, no fundo, no Esc e arrastando a
     alca para baixo; prende o foco dentro e devolve o foco a quem abriu.
     Devolve { el, corpo, fechar }. `html` pode ser string ou um Node.
   - TABELA QUE VIRA LISTA DE CARTOES: por CSS, com `data-label`. Ponha a
     classe `tc` na <table class="tbl tc"> (ou num container de linhas em
     grid, com `tc-ln` em cada linha e `tc-cab` no cabecalho) e
     `data-label="Prazo"` em cada celula. No celular cada linha vira um cartao
     de duas colunas, com o rotulo em cima do valor. `data-tc` arruma o
     cartao: "topo" e "topo-fim" (primeira linha, esquerda e direita),
     "titulo" (largura toda, logo abaixo), "largo" (largura toda), "acao"
     (largura toda, no fim) e "fora" (some no celular). H.celula(html,
     rotulo, tc) marca a primeira tag de um pedaco de HTML ja pronto, sem
     embrulhar (o grid do computador nao muda).
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var raiz = typeof window !== 'undefined' ? window : globalThis;
  var WORKER = 'https://roadmap-nova-melhoria.morais-tecnologico.workers.dev';

  // ── Utilidades puras (testaveis sem DOM) ──────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function hojeISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var MESES_C = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  function ehISO(s) { return /^\d{4}-\d{2}-\d{2}/.test(String(s || '')); }
  function data(iso) { if (!ehISO(iso)) return null; var p = String(iso).slice(0, 10).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  /** 31/10 — o formato curto das listas do prototipo. */
  function dm(iso) { var d = data(iso); return d ? String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') : ''; }
  /** 31/10/2026 */
  function dma(iso) { var d = data(iso); return d ? dm(iso) + '/' + d.getFullYear() : ''; }
  /** Sabado, 31 de outubro */
  function dataLonga(iso) { var d = data(iso); return d ? DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()] : ''; }
  function mesAno(iso) { var d = data(iso); return d ? MESES[d.getMonth()] + ' de ' + d.getFullYear() : ''; }
  /** Dias corridos de a ate b (b - a). */
  function dias(a, b) { var x = data(a), y = data(b); return x && y ? Math.round((y - x) / 864e5) : null; }
  function iniciais(nome) {
    var p = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '';
    return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }
  function saudacao(h) { return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }
  function num(n) { return Number(n || 0).toLocaleString('pt-BR'); }

  // ── Etapas: rotulo e cor do chip ──────────────────────────────────────
  // Rotulos IGUAIS aos das telas antigas (STATUS_LABELS do admin): a mesma
  // etapa com dois nomes conforme a tela seria pior que qualquer nome.
  var ETAPAS = [
    { id: 'backlog',        rotulo: 'Backlog',             cor: 'bk', dot: 'var(--tx4)' },
    { id: 'levantar_req',   rotulo: 'Em aprovação de requisitos', cor: 'pu', dot: 'var(--pu)' },
    { id: 'planning',       rotulo: 'Planning',            cor: 'tl', dot: 'var(--tl)' },
    { id: 'planejado',      rotulo: 'Planejado',           cor: 'in', dot: 'var(--in)' },
    { id: 'em_andamento',   rotulo: 'Em Andamento',        cor: 'ac', dot: 'var(--ac)' },
    { id: 'validacao_area', rotulo: 'Validação da área',   cor: 'wn', dot: 'var(--wn)' },
    { id: 'validacao',      rotulo: 'Validação PM/PO',     cor: 'wn', dot: 'var(--wn)' },
    { id: 'concluido',      rotulo: 'Concluído',           cor: 'ok', dot: 'var(--ok)' },
    { id: 'negada',         rotulo: 'Negada',              cor: 'dg', dot: 'var(--dg)' }
  ];
  var ETAPA_POR_ID = {};
  ETAPAS.forEach(function (e) { ETAPA_POR_ID[e.id] = e; });
  ETAPA_POR_ID.atrasado = { id: 'atrasado', rotulo: 'Atrasado', cor: 'dg', dot: 'var(--dg)' };
  var TIPOS = { sustentacao: { rotulo: 'Sustentação', ico: 'wrench' }, evolucao: { rotulo: 'Evolução', ico: 'rocket' } };

  // ── Estado do app ─────────────────────────────────────────────────────
  var APP = {
    D: null,            // a base, como veio da rota `dados`
    eu: null,           // usuario do login (rm_eu)
    papel: '',
    token: '',
    carregadoEm: 0,
    telas: {},
    ordem: [],
    rota: { tela: '', aba: '', param: '' },
    sessaoCaiu: false   // a sessao venceu com a tela aberta (ver `sessaoExpirou`)
  };
  // "Ainda nao tenho demandas — entrar assim mesmo": nao pergunta de novo nesta entrada.
  var VINCULO_DEPOIS = 'rm_vinculo_depois';

  function lerSessao() {
    try { APP.eu = JSON.parse(sessionStorage.getItem('rm_eu') || 'null'); } catch (_) { APP.eu = null; }
    APP.token = sessionStorage.getItem('rm_admin_token') || sessionStorage.getItem('rm_dev_token') || '';
    APP.papel = (APP.eu && APP.eu.papel) || (sessionStorage.getItem('rm_admin_token') ? 'admin' : sessionStorage.getItem('rm_dev_token') ? 'dev' : '');
  }

  /* A SESSAO E A MESMA DAS TELAS ANTIGAS: as chaves sao as que admin.html e
     dev.html ja leem. Quem entra aqui e clica em "Editar" cai no editor de
     sempre ja logado — e vice-versa. */
  function gravarSessao(token, usuario) {
    try {
      // Cada entrada pergunta o vinculo de novo, como a do dev.html.
      sessionStorage.removeItem(VINCULO_DEPOIS);
      sessionStorage.setItem('rm_eu', JSON.stringify(usuario || {}));
      if ((usuario || {}).papel !== 'admin') {
        sessionStorage.setItem('rm_dev_token', token);
        sessionStorage.setItem('rm_dev_authed', '1');
      } else {
        sessionStorage.setItem('rm_admin_token', token);
      }
    } catch (_) {}
    lerSessao();
  }

  function limparSessao() {
    ['rm_eu', 'rm_admin_token', 'rm_admin_pw', 'rm_dev_token', 'rm_dev_pw', 'rm_dev_authed', VINCULO_DEPOIS].forEach(function (k) {
      try { sessionStorage.removeItem(k); } catch (_) {}
    });
    lerSessao();
  }

  /* ── A SESSAO CAI SOZINHA, E O APP TEM DE PERCEBER ─────────────────────
     A regra do `sessaoExpirou` do admin.html e do dev.html. A sessao vale 12 h
     e, vencida com a aba aberta, o app seguia mostrando a base velha sem dizer
     nada — so a primeira gravacao avisava "Sessao expirada", e o que a pessoa
     mexeu entre o vencimento e a gravacao parecia valer.

     Qualquer 401 de sessao, em QUALQUER chamada (a releitura de 30 s, a volta
     do foco, uma acao), derruba a sessao na hora e traz a tela de entrar.

     A INTERCEPTACAO E NO `fetch`, como nas telas antigas, e nao chamada a
     chamada: axis-acoes.js, o Poker, a hidratacao do historico e a escolha da
     interface tem fetch proprio, e o proximo a ser escrito esqueceria.

     O QUE ESTAVA NA TELA NAO SE PERDE (o "o que está na tela não se perdeu"
     das antigas): o formulario, as gavetas e as caixas abertas ficam no DOM,
     so escondidos, e voltam depois da entrada; a rota tambem, porque o hash
     nao muda. O formulario de demanda guarda ainda o rascunho no navegador
     (axis-form-demanda.js), para o caso de a aba fechar antes de entrar de
     novo. Se quem entra e OUTRA conta, o que era da anterior sai da tela.

     UMA DIFERENCA DE PROPOSITO: `senha-alterar` responde 401 `credencial`
     quando a SENHA ATUAL digitada na troca esta errada. Nas telas antigas isso
     derrubava a sessao de quem so errou a senha; aqui fica de fora, com o
     login. A sessao vencida, nessa rota, volta 403 `sem_conta`. */
  var ACOES_SEM_SESSAO = ['login', 'auth', 'cadastrar', 'esqueci', 'redefinir', 'reset', 'senha-alterar'];
  var ERROS_DE_SESSAO = ['senha', 'credencial', 'token', 'sessao'];
  function caiuASessao(status, acao, erro) {
    return status === 401 && ACOES_SEM_SESSAO.indexOf(acao) < 0 && ERROS_DE_SESSAO.indexOf(erro) >= 0;
  }
  /** Embrulha o fetch: a resposta 401 do Worker com erro de sessao chama
      `aoCair`. Quem chamou recebe a resposta igual (o corpo so pode ser lido
      uma vez, entao volta uma copia). */
  function vigiaSessao(nativo, url, aoCair) {
    return async function (recurso, opcoes) {
      var res = await nativo.apply(raiz, arguments);
      try {
        if (res.status !== 401) return res;
        var u = typeof recurso === 'string' ? recurso : (recurso && recurso.url) || '';
        if (u.indexOf(url) !== 0) return res;
        var acao = '';
        try { acao = (JSON.parse((opcoes && opcoes.body) || '{}') || {}).action || ''; } catch (_) {}
        var texto = await res.text();
        var erro = '';
        try { erro = (JSON.parse(texto) || {}).error || ''; } catch (_) {}
        if (caiuASessao(res.status, acao, erro)) aoCair();
        return new Response(texto, { status: res.status, statusText: res.statusText, headers: res.headers });
      } catch (_) { return res; }
    };
  }

  var _sessaoCaiu = false;   // venceu, e a tela espera a entrada de novo
  var _caiuDe = '';          // o login de quem estava na tela
  var _escondidos = [];      // o que estava aberto por cima, so escondido
  var _travas = [];
  // Derruba a sessao e pede a entrada. NAO avisa o servidor: o token ja nao
  // vale, e o logout voltaria 401 — reentrando aqui.
  function sessaoExpirou() {
    if (_sessaoCaiu || !APP.token) return;   // varias chamadas em paralelo, um aviso so
    _sessaoCaiu = true;
    APP.sessaoCaiu = true;
    _caiuDe = (APP.eu || {}).login || '';
    var comTela = !!APP.D;
    if (raiz.AXIS_FORM && raiz.AXIS_FORM.guardaRascunho) raiz.AXIS_FORM.guardaRascunho();
    _escondidos = [];
    if (comTela) {
      document.querySelectorAll('body > .ovl, body > .gv-fundo, body > .modal-overlay').forEach(function (o) {
        _escondidos.push({ el: o, display: o.style.display });
        o.style.display = 'none';
      });
    }
    var raizHtml = document.documentElement;
    _travas = ['gv-trava', 'fl-trava'].filter(function (c) { return raizHtml.classList.contains(c); });
    _travas.forEach(function (c) { raizHtml.classList.remove(c); });
    limparSessao();
    _novoNoServidor = false;
    _noVinculo = false;
    desenharLogin(comTela ? 'Sua sessão expirou (ela vale 12 horas). Entre de novo — o que está na tela não se perdeu.'
                          : 'Sua sessão expirou. Entre de novo.', { usuario: _caiuDe });
  }

  /** Depois da entrada: devolve o que estava aberto, ou tira da tela o que
      era de outra conta. Devolve quantos itens voltaram. */
  function voltaDaSessao() {
    if (!_sessaoCaiu) return 0;
    var mesma = !_caiuDe || ((APP.eu || {}).login || '') === _caiuDe;
    var voltaram = 0;
    _escondidos.forEach(function (x) {
      if (!x.el.isConnected) return;
      if (mesma) { x.el.style.display = x.display; voltaram++; }
    });
    if (mesma) _travas.forEach(function (c) { document.documentElement.classList.add(c); });
    else {
      // O rascunho fica guardado para a conta dona dele; so a tela e limpa.
      if (raiz.AXIS_FORM && raiz.AXIS_FORM.soltar) raiz.AXIS_FORM.soltar();
      fecharGavetas();
      _escondidos.forEach(function (x) { if (x.el.isConnected) x.el.remove(); });
    }
    _escondidos = []; _travas = [];
    _sessaoCaiu = false;
    APP.sessaoCaiu = false;
    if (mesma && voltaram) toast('Bem-vindo de volta. O que estava na tela continua aqui — salve de novo o que ficou pela metade.');
    else if (mesma) toast('Bem-vindo de volta.');
    return voltaram;
  }

  /* A QUEDA DE REDE SE REPETE AQUI TAMBEM (09/11/2026): "nao esta tendo mais
     redundancias para forcar a solucao desse erro". As telas antigas insistem
     (`rede-repete.js`: 2s, 6s e 15s, com "tentando de novo (1 de 3)"); o app
     mostrava "Failed to fetch" na primeira perda de pacote. Toda chamada ao
     Worker passa por aqui. So a queda de rede se repete — erro HTTP (401, 409,
     500) volta na hora, porque repetir nao o resolve. */
  /* `lim` (opcional): { max, calado }. A gravacao passa `max` curto e, se a
     rede/servidor nao responder, a alteracao vai para a FILA (abaixo) em vez de
     prender a pessoa esperando. `calado`: sem aviso nenhum (reenvio da fila). */
  async function postar(corpo, replacer, extraFetch, lim) {
    var R = raiz.REDEREPETE, quedas = 0;
    var max = lim && lim.max != null ? lim.max : null;
    for (;;) {
      try {
        return await fetch(WORKER, Object.assign({ method: 'POST', headers: { 'Content-Type': 'application/json' },
                                                   body: JSON.stringify(corpo, replacer) }, extraFetch || {}));
      } catch (e) {
        if (!R || !R.ehQueda(e) || !R.deveRepetir(quedas) || (max != null && quedas >= max)) throw e;
        if (!(lim && lim.calado)) { try { toast(R.aviso(quedas)); } catch (_) {} }
        await new Promise(function (ok) { setTimeout(ok, R.espera(quedas)); });
        quedas += 1;
      }
    }
  }

  /* ═══ A FILA DE GRAVACOES PENDENTES (10/11/2026) ══════════════════════════
     "trate de forma preventiva para evitar que o usuario perceba o erro e
     force a gravacao". O Worker esta no plano Free (10 ms de CPU) e a base tem
     3,4 MB: em 10/11 a maioria das gravacoes voltava "Error 1102 — Worker
     exceeded resource limits", sem CORS, que a tela le como queda de rede.
     Cada tentativa e independente (umas passam, outras nao), entao insistir
     resolve — mas nao com a pessoa olhando.

     Quando a gravacao nao entra nas tentativas rapidas, a ALTERACAO (o patch,
     nunca a base inteira) vai para uma fila no navegador, por conta. A tela ja
     mostra a mudanca (aplicada por cima da base lida), um selo discreto diz
     "Salvando…", e a fila reenvia sozinha a cada 20 s e ao reabrir o app.
     Reenviar e seguro: cada envio rele a base do servidor e reaplica so o
     patch (`GRAVACAO.gravar`); se a anterior tinha entrado, vira no-op.
     Recusa de REGRA (409, 400) nao e repetida: sai da fila e e avisada. */
  var FILA_PREF = 'axis_fila_v1:';
  var APAGA = '__axis_apaga__';
  var FILA_INTERVALO = 20000;
  var _filaRodando = false;
  function filaChave() { return FILA_PREF + (((APP.eu || {}).login) || '_'); }
  function filaLer() {
    try { var v = JSON.parse(localStorage.getItem(filaChave()) || '[]'); return Array.isArray(v) ? v : []; }
    catch (_) { return []; }
  }
  function filaSalvar(l) {
    try { if (l.length) localStorage.setItem(filaChave(), JSON.stringify(l)); else localStorage.removeItem(filaChave()); }
    catch (_) {}
  }
  // `undefined` no patch APAGA o campo; o JSON o perderia, entao vira marcador.
  function filaCodifica(patch) {
    return JSON.parse(JSON.stringify(patch || {}, function (k, v) { return v === undefined ? APAGA : v; }));
  }
  function filaDecodifica(patch) {
    var p = {};
    Object.keys(patch || {}).forEach(function (id) {
      var n = patch[id];
      if (n && typeof n === 'object' && !Array.isArray(n)) {
        var o = {};
        Object.keys(n).forEach(function (k) { o[k] = n[k] === APAGA ? undefined : n[k]; });
        p[id] = o;
      } else p[id] = n;
    });
    return p;
  }
  /** A base com as alteracoes ainda na fila por cima: a tela nao "desfaz". */
  function comFila(D) {
    var l = filaLer();
    if (!l.length || !D || !raiz.GRAVACAO || !raiz.GRAVACAO.aplicar) return D;
    l.forEach(function (it) {
      try { D = raiz.GRAVACAO.aplicar(D, filaDecodifica(it.patch), it.raiz); } catch (_) {}
    });
    return D;
  }
  function filaEntra(patch, raizTopo, okMsg) {
    var l = filaLer();
    l.push({ uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), patch: filaCodifica(patch),
             raiz: raizTopo || null, ok: okMsg || '', em: new Date().toISOString(), tent: 0 });
    filaSalvar(l);
    filaPinta();
    setTimeout(filaProcessa, 0);
  }
  function filaPinta() {
    if (typeof document === 'undefined') return;
    var n = APP.token ? filaLer().length : 0;
    var el = document.getElementById('axfila');
    if (!n) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'axfila';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:60;padding:6px 12px;border-radius:999px;' +
        'font-size:12.5px;background:var(--sf2,#1e2633);color:var(--tx2,#c9d1dc);border:1px solid var(--bd,rgba(255,255,255,.12));' +
        'box-shadow:0 2px 8px rgba(0,0,0,.2)';
      document.body.appendChild(el);
    }
    el.textContent = '⟳ Salvando ' + n + (n === 1 ? ' alteração…' : ' alterações…');
  }
  async function filaProcessa() {
    if (_filaRodando || !APP.token || _sessaoCaiu) return;
    var l = filaLer();
    if (!l.length) { filaPinta(); return; }
    _filaRodando = true;
    try {
      while (l.length) {
        var it = l[0];
        var r = await gravar(filaDecodifica(it.patch), { raiz: it.raiz || undefined, daFila: true });
        l = filaLer();
        var i = l.findIndex(function (x) { return x.uid === it.uid; });
        if (r && r.ok) {
          if (i >= 0) { l.splice(i, 1); filaSalvar(l); }
          try { if (raiz.AXIS_ACOES && raiz.AXIS_ACOES.avisaRevertidos) raiz.AXIS_ACOES.avisaRevertidos(r); } catch (_) {}
          if (!l.length) {
            try { await carregar(); desenhar(true); } catch (_) {}
            // So avisa quando demorou: no caminho normal o "Salvo." ja saiu na hora.
            if (it.tent) toast('Alterações salvas no servidor.');
          }
          continue;
        }
        if (r && (r.queda || r.status === 401)) {
          var tent = 1;
          if (i >= 0) { tent = l[i].tent = (l[i].tent || 0) + 1; filaSalvar(l); }
          // Reenvio rapido e crescente (2 s, 4 s ... ate 15 s); o intervalo de 20 s fica de reserva.
          if (r.queda) setTimeout(filaProcessa, Math.min(2000 * tent, 15000));
          break;
        }
        // Recusa de regra: repetir nao resolve. Sai da fila, a tela volta ao servidor e a pessoa e avisada.
        if (i >= 0) { l.splice(i, 1); filaSalvar(l); }
        toast('Uma alteração não pôde ser salva: ' + ((r && r.erro) || 'recusada pelo servidor') + '.', 'erro');
        try { await carregar(); desenhar(true); } catch (_) {}
      }
    } finally {
      _filaRodando = false;
      filaPinta();
    }
  }

  async function api(action, extra) {
    var corpo = Object.assign({ action: action }, APP.token ? { token: APP.token } : {}, extra || {});
    var r = await postar(corpo);
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      var e = new Error(j.detail || j.error || ('HTTP ' + r.status));
      e.status = r.status;
      // O codigo do erro (`conflito`, `titulo_repetido`...) e o corpo inteiro:
      // dois 409 com motivos diferentes pedem respostas diferentes da tela.
      e.codigo = j.error || '';
      e.corpo = j;
      throw e;
    }
    return j;
  }

  async function entrar(login, senha) {
    var j = await api('login', { login: login, senhaUsuario: senha });
    if (!j.token) throw new Error('O servidor nao devolveu sessao.');
    gravarSessao(j.token, j.usuario || {});
    return j.usuario;
  }

  function sair() {
    if (APP.token) api('logout').catch(function () {});
    limparSessao();
    APP.D = null;
    location.hash = '';
    desenhar();
  }

  /* A TRILHA DAS DEMANDAS VEM DO D1 quando a base nao a traz (historico-cliente.js):
     Item > Historico, a Validacao do PO, o funil dos Paineis e o Inicio leem
     `m.historico`, e a base deixou de leva-lo. O mesmo `lerDados` do admin. */
  function hidrata(j) {
    return raiz.HISTCLIENTE ? raiz.HISTCLIENTE.hidrata(j, WORKER, APP.token ? { token: APP.token } : {}) : Promise.resolve(j);
  }

  async function carregar() {
    var j = await hidrata(await api('dados'));
    APP.D = comFila(j);
    APP.carregadoEm = Date.now();
    return APP.D;
  }

  // ── Gravar (gravacao.js) ──────────────────────────────────────────────
  /* `gravar(patch, opts)`: patch = { id: { campo: valor } } (undefined apaga o
     campo); opts.raiz troca chaves do topo (temas, projetos, ausencias...);
     opts.ok = frase do aviso de sucesso. Le a base fresca, aplica, confere o
     pre-voo, envia por publish (admin) ou dev-publish (dev) e, gravando, rele
     a base e redesenha. Devolve o resultado do GRAVACAO.gravar. */
  var _gravando = Promise.resolve();
  var _naFila = 0;   // gravacoes em curso: a releitura de 30 s espera por elas
  function gravar(patch, opts) {
    var o = opts || {};
    // Uma gravacao por vez: duas acoes rapidas leriam a mesma base e a segunda
    // desfaria a primeira no servidor. A fila e a mesma ideia do saveViaProxy.
    _naFila++;
    var vez = _gravando.then(function () { return gravarAgora(patch, o); });
    var fim = function () { _naFila = Math.max(0, _naFila - 1); };
    vez.then(fim, fim);
    _gravando = vez.catch(function () {});
    return vez;
  }
  var MSG_SESSAO = 'Sua sessão expirou. Entre de novo e salve outra vez — o que estava na tela não se perdeu.';
  async function gravarAgora(patch, o) {
    if (!raiz.GRAVACAO) throw new Error('gravacao.js nao carregado');
    if (['admin', 'analista', 'dev'].indexOf(APP.papel) < 0) { toast('Seu perfil é só de leitura.', 'erro'); return { ok: false }; }
    var calado = !!o.daFila;
    /* JA HA ALTERACAO NA FILA: a nova entra atras dela. Gravar a nova direto e
       a antiga depois deixaria a antiga por cima da nova no mesmo campo. */
    /* RESPOSTA NA HORA (10/11/2026, "as movimentacoes front p back estao com muito
       delay"): a alteracao de demanda aparece na tela no clique e grava em
       segundo plano pela fila. Gravar direto levava ler 3,4 MB + enviar 3,4 MB
       (5 a 8 s) e, com o servidor no limite, ate 4 tentativas antes de mostrar.
       Troca de chave do topo (`o.raiz`: temas, projetos, ausencias) segue
       direta, salvo se ja houver fila — ai entra atras, para manter a ordem. */
    if (!calado && (filaLer().length || !o.raiz)) return enfileira(patch, o);
    var R = raiz.REDEREPETE;
    var r;
    try {
      r = await raiz.GRAVACAO.gravar({
        papel: APP.papel, patch: patch, raiz: o.raiz, semPrevoo: !!o.semPrevoo,
        credenciais: APP.token ? { token: APP.token } : {},
        ler: function () { return api('dados'); },
        enviar: async function (corpo, replacer) {
          // Tentativas rapidas e caladas; o que nao entrar vai para a fila.
          var res = await postar(corpo, replacer, null, { max: calado ? 2 : 4, calado: true });
          var j = await res.json().catch(function () { return {}; });
          return { status: res.status, corpo: j };
        }
      });
      if (r && !r.ok && [502, 503, 504].indexOf(Number(r.status)) >= 0) r.queda = true;
    } catch (e) {
      r = e.status === 401 ? { ok: false, status: 401, erro: MSG_SESSAO }
        : { ok: false, queda: !R || R.ehQueda(e), erro: 'Sem conexão com o servidor: ' + (e.message || e) };
    }
    if (!r.ok && r.queda && !calado) return enfileira(patch, o);
    if (calado) return r;
    if (r.ok) {
      APP.D = r.base;
      try { await carregar(); } catch (_) {}
      desenhar(true);
      if (o.ok !== false) toast(o.ok || 'Salvo.');
      var rs = r.resp || {};
      if ((rs.sem_dev || []).length) toast('Sem desenvolvedor, voltou para Backlog: ' + rs.sem_dev.join(', '), 'erro');
      if ((rs.comite_revertidas || []).length) toast('Validado em Comitê é de PM/PO ou liderança — revertido em: ' + rs.comite_revertidas.join(', '), 'erro');
    } else {
      if (r.status === 401) r.erro = MSG_SESSAO;
      var msg = r.erro || 'Não foi possível salvar.';
      if (r.itens && r.itens.length > 1) msg += ' (e mais ' + (r.itens.length - 1) + ': ' + r.itens.slice(1).map(function (x) { return x.codigo; }).join(', ') + ')';
      toast(msg, 'erro');
    }
    return r;
  }

  /** Guarda a alteracao na fila e ja a mostra na tela, como se tivesse gravado. */
  function enfileira(patch, o) {
    filaEntra(patch, o.raiz, typeof o.ok === 'string' ? o.ok : '');
    try {
      if (APP.D && raiz.GRAVACAO && raiz.GRAVACAO.aplicar) APP.D = raiz.GRAVACAO.aplicar(APP.D, patch, o.raiz);
    } catch (_) {}
    desenhar(true);
    if (o.ok !== false) toast(o.ok || 'Salvo.');
    return { ok: true, enfileirado: true, base: APP.D, resp: {} };
  }

  // ── Leituras sobre a base (todas pelos modulos de regra) ──────────────
  function hoje() { return hojeISO(); }
  function visiveis() {
    return ((APP.D || {}).melhorias || []).filter(function (m) { return m && !m.oculto && !m.mesclado_em; });
  }
  function etapaDe(m) {
    return raiz.ETAPA ? raiz.ETAPA.efetiva(m, hoje()) : String(m.status_planejamento || 'backlog');
  }
  /** A etapa sem a leitura de atraso: em que coluna o card mora. */
  function colunaDe(m) {
    return raiz.ETAPA ? raiz.ETAPA.gravada(m, hoje()) : String(m.status_planejamento || 'backlog');
  }
  function pausada(m) { return raiz.ETAPA ? raiz.ETAPA.pausada(m) : !!m.pausado_em; }
  function prazoDe(m) { return raiz.PRAZO ? raiz.PRAZO.prazoEfetivo(m, hoje()) : (m.entrega || ''); }
  function atrasoDe(m) { return raiz.PRAZO ? raiz.PRAZO.diasDeAtraso(m, colunaDe(m), hoje()) : null; }
  function pontosDe(m) { return raiz.SPRINTPO ? raiz.SPRINTPO.pontosDe(m) : (Number(m.poker_pontos) || 0); }
  function devsDe(m) {
    if (raiz.DEVNOME) return raiz.DEVNOME.daDemanda(m);
    return String(m.dev || '').split(/[\/,;]/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function tema(id) {
    var t = ((APP.D || {}).temas || []).find(function (x) { return x.id === id; });
    return t ? t.nome : '';
  }
  /** "AXCred - Operações" vira "AXCred › Operações", como no prototipo. */
  function caminho(id) { return tema(id).split(/\s+-\s+/).join(' › '); }
  function projeto(id) {
    return ((APP.D || {}).projetos || []).find(function (p) { return p.id === id; }) || null;
  }
  function sprintAtual() {
    return raiz.SPRINTPO ? raiz.SPRINTPO.sprintCorrente(hoje(), (APP.D || {}).feriados || []) : '';
  }
  function porCodigo(cod) {
    var n = String(cod || '').toUpperCase().replace(/-/g, '');
    return visiveis().find(function (m) { return String(m.codigo || '').toUpperCase().replace(/-/g, '') === n; }) || null;
  }
  /** Os nomes pelos quais o dev logado aparece nas demandas. */
  function meusNomes() {
    var e = APP.eu || {};
    var dec = String(e.nome_demandas || '').split(/[\/,;]/).map(function (x) { return x.trim(); }).filter(Boolean);
    return dec.length ? dec : (e.nome ? [e.nome] : []);
  }
  function minha(m) {
    var nomes = meusNomes();
    if (!nomes.length) return false;
    return nomes.some(function (n) { return raiz.DEVNOME ? raiz.DEVNOME.eDe(m, n) : devsDe(m).indexOf(n) >= 0; });
  }
  /* O DONO DA SPRINT (`SPRINTPO.ehDonoDaSprint`): por CONTA, e nao pelo papel
     admin, que e de varias pessoas. So ele marca a sprint, inicia e fecha; quem
     nao e abre demanda nova no Backlog. Sem `eu` com login e a senha
     administrativa, que o Worker trata como dono. */
  function donoDaSprint() {
    if (APP.papel !== 'admin') return false;
    var e = APP.eu && APP.eu.login ? APP.eu : null;
    return raiz.SPRINTPO && raiz.SPRINTPO.ehDonoDaSprint ? raiz.SPRINTPO.ehDonoDaSprint(e) : true;
  }
  function pode(acao) {
    var p = APP.papel;
    var M = {
      editar: ['admin', 'analista'], validar: ['admin'], configurar: ['admin'], gerencial: ['admin', 'consulta'],
      fechar: ['admin'], trabalho: ['admin', 'analista', 'dev'], acompanhar: ['admin'],
      // Analista de requisitos (worker: NIVEL 3): conduz o Poker, edita, nega e anexa.
      facilitar: ['admin', 'analista'], negar: ['admin', 'analista'], gravar: ['admin', 'analista', 'dev']
    };
    return (M[acao] || []).indexOf(p) >= 0;
  }

  // ── Pedacos de interface reaproveitados pelas telas ───────────────────
  function ico(nome, extra) { return '<i class="axi axi-' + nome + '"' + (extra ? ' ' + extra : '') + '></i>'; }
  function chip(txt, cor, titulo) {
    return '<span class="chip c-' + (cor || 'bk') + '"' + (titulo ? ' title="' + esc(titulo) + '"' : '') + '>' + txt + '</span>';
  }
  /** O CHIP DA PAUSA, um so para as telas. Com terceiro (pausa.js), diz quem
   *  segura — "Aguardando Fornecedor X" — e fica VERMELHO quando o retorno
   *  prometido passou: e a hora de cobrar o fornecedor, nao atraso do dev.
   *  `rot` troca o "Pausada" da pausa interna (o Quadro escreve em minusculo,
   *  com os dias); vazio quando a demanda nao esta pausada. */
  function chipPausa(m, rot) {
    if (!pausada(m)) return '';
    var P = raiz.PAUSA, t = P && P.terceiro ? P.terceiro(m) : null;
    var motivo = m.pausa_motivo || '';
    if (!t) return chip(ico('pause') + ' ' + (rot || 'Pausada'), 'mg', motivo);
    var venceu = P.retornoVencido(m, hoje());
    return chip(ico('pause') + ' Aguardando ' + esc(t.nome) + (venceu ? ' · retorno venceu' : ''), venceu ? 'dg' : 'mg',
      P.rotuloTerceiro(m, hoje()) + (t.contato ? ' · contato: ' + t.contato : '') + (motivo ? '\n' + motivo : ''));
  }
  function chipEtapa(m) {
    var e = ETAPA_POR_ID[etapaDe(m)] || ETAPA_POR_ID[colunaDe(m)] || { rotulo: m.status_planejamento || '—', cor: 'bk' };
    var h = chip(esc(e.rotulo), e.cor);
    if (pausada(m)) h += ' ' + chipPausa(m);
    return h;
  }
  function chipTipo(m) {
    var t = TIPOS[m.tipo];
    return t ? chip(ico(t.ico) + ' ' + t.rotulo, 'bk') : '';
  }
  /* IMPACTO E URGENCIA seguem a demanda pela esteira (`REQUISITOS.chips` no
     card do admin e do gantt), aqui no desenho dos chips do app: baixo verde,
     medio amarelo, alto vermelho. Vazio quando a demanda nao tem nenhum. */
  var COR_REQ = ['ok', 'wn', 'dg'];
  function chipsReq(m) {
    var R = raiz.REQUISITOS;
    if (!R || !m) return '';
    var out = '';
    [['Impacto', R.IMPACTOS, R.impacto(m.impacto)], ['Urgência', R.URGENCIAS, R.urgencia(m.urgencia)]].forEach(function (c) {
      for (var i = 0; i < c[1].length; i++) {
        if (c[1][i].v === c[2]) { out += chip(c[0] + ' ' + esc(c[1][i].r), COR_REQ[i], c[0] + ': ' + c[1][i].r); return; }
      }
    });
    return out;
  }
  /* O CASO DE USO de "Em aprovacao de requisitos", no card da etapa (o selo
     do Kanban do admin). Na etapa e ainda sem o carimbo do Worker: a enviar. */
  var CASO_USO_CURTO = { a_enviar: 'Caso de uso a enviar', enviado: 'Aguardando aprovação',
                         aprovado: 'Requisitos aprovados', ajustes: 'Usuário pediu ajustes' };
  var CASO_USO_COR = { a_enviar: 'wn', enviado: 'in', aprovado: 'ok', ajustes: 'dg' };
  function chipCasoUso(m) {
    var R = raiz.REQUISITOS;
    if (!R || !m || String(m.status_planejamento || '') !== R.ETAPA) return '';
    var st = R.estado(m) || 'a_enviar';
    return chip(ico('file') + ' ' + esc(CASO_USO_CURTO[st]), CASO_USO_COR[st], 'Caso de uso: ' + R.ESTADOS[st]);
  }
  /** Avatar com cor estavel por nome (a do acento para quem esta logado). */
  function av(nome, tam) {
    if (!nome) return '<span class="av" style="background:var(--sf4);color:var(--tx3)' + (tam ? ';width:' + tam + 'px;height:' + tam + 'px;border-radius:' + (tam / 2) + 'px' : '') + '">—</span>';
    var CORES = ['#8CB4FF', '#C4B5FD', '#4ADE80', '#F5D58A', '#99F6E4', '#FFB891', '#FF9A9A', '#C7D8FF'];
    var h = 0; for (var i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
    var eu = meusNomes().indexOf(nome) >= 0;
    var bg = eu ? 'var(--ac)' : CORES[h % CORES.length];
    return '<span class="av" title="' + esc(nome) + '" style="background:' + bg + (eu ? ';color:var(--on-ac)' : '') +
      (tam ? ';width:' + tam + 'px;height:' + tam + 'px;border-radius:' + (tam / 2) + 'px' : '') + '">' + esc(iniciais(nome)) + '</span>';
  }
  function cod(m) { return '<span class="code">' + esc(m.codigo || '—') + '</span>'; }
  function hrefItem(m) { return '#item/' + encodeURIComponent(m.codigo || m.id); }
  /** Prazo em texto curto, com a cor que o prototipo usa (vermelho = atrasado ou hoje). */
  function prazoTxt(m) {
    if (pausada(m)) return { txt: 'prazo suspenso', cor: 'var(--tx3)' };
    var col = colunaDe(m);
    // Ja entregue pelo dev: o que importa e QUANDO entregou, e nao um atraso
    // congelado. "Atrasada" so vale quando a etapa efetiva diz atrasado — a
    // mesma leitura do banner do admin e do chip de etapa.
    if (col === 'validacao_area' || col === 'validacao' || col === 'concluido') {
      var fim = raiz.PRAZO && raiz.PRAZO.fimDoDev ? raiz.PRAZO.fimDoDev(m) : '';
      return fim ? { txt: (col === 'concluido' ? 'concluído ' : 'entregue ') + dm(fim), cor: 'var(--tx2)' } : { txt: '—', cor: 'var(--tx4)' };
    }
    var pz = prazoDe(m);
    if (!pz) return { txt: '—', cor: 'var(--tx4)' };
    var a = atrasoDe(m);
    if (etapaDe(m) === 'atrasado') return { txt: a > 0 ? 'atrasada ' + a + 'd' : 'atrasada', cor: 'var(--dg-t)' };
    var d = dias(hoje(), pz);
    if (d === 0) return { txt: 'vence hoje', cor: 'var(--dg-t)' };
    if (d === 1) return { txt: 'amanhã', cor: 'var(--wn-t)' };
    return { txt: dm(pz), cor: 'var(--tx2)' };
  }
  /** Link para uma aba do admin (mes, gerencial, relatorios), com o icone de
      "sai do app". So o que ainda nao foi portado (Fechamento, Paineis e
      Relatorios) o usa. */
  function linkAdmin(aba, rotulo, cls) {
    return '<a class="' + (cls || 'btn') + '" href="admin.html" data-admin-aba="' + esc(aba) + '" title="Abre no editor (admin)">' +
      esc(rotulo) + ' ' + ico('external', 'style="font-size:12px;opacity:.7"') + '</a>';
  }
  function vazio(icone, titulo, texto, acao) {
    return '<div class="est">' + ico(icone || 'info') + '<b>' + esc(titulo) + '</b>' + (texto ? '<span>' + esc(texto) + '</span>' : '') + (acao || '') + '</div>';
  }
  function kpi(rot, valor, nota, cls, href) {
    // Estados com prefixo k-: `.in` sozinho e a classe do campo de formulario.
    var est = String(cls || '').split(/\s+/).filter(Boolean).map(function (c) { return 'k-' + c.replace(/^k-/, ''); }).join(' ');
    return '<' + (href ? 'a href="' + href + '"' : 'div') + ' class="k' + (est ? ' ' + est : '') + (href ? ' click' : '') + '" style="text-decoration:none;color:inherit">' +
      '<span class="kl">' + rot + '</span><span class="kv">' + valor + '</span>' +
      (nota ? '<span style="font-size:12.5px;color:var(--tx3)">' + nota + '</span>' : '') + '</' + (href ? 'a' : 'div') + '>';
  }
  function toast(msg, tipo) {
    var t = document.createElement('div');
    t.className = 'toast';
    if (tipo === 'erro') t.style.borderColor = 'rgba(var(--dg-rgb),.5)';
    t.innerHTML = ico(tipo === 'erro' ? 'alert' : 'check') + '<span>' + esc(msg) + '</span>';
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3600);
  }

  // ── Gaveta (bottom sheet) e filtros recolhidos ────────────────────────
  /* As duas usam o mesmo desenho (.gv-cab com a alca, .gv-pe) e o mesmo
     teclado e gesto, ligados uma vez so em `ligar` por delegacao: a gaveta
     dos filtros mora DENTRO da vista e e redesenhada com ela. */
  var FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  var _gavetas = [];
  function gaveta(o) {
    o = o || {};
    var anterior = document.activeElement;
    var fundo = document.createElement('div');
    fundo.className = 'gv-fundo';
    fundo.innerHTML = '<div class="gv" role="dialog" aria-modal="true" aria-label="' + esc(o.titulo || 'Gaveta') + '" tabindex="-1">' +
      '<div class="gv-cab" data-gv-alca><span class="gv-alca" aria-hidden="true"></span><b class="gv-t">' + esc(o.titulo || '') + '</b>' +
      '<button type="button" class="gv-x" data-gv-fechar aria-label="Fechar">' + ico('x') + '</button></div>' +
      '<div class="gv-corpo"></div>' + (o.pe ? '<div class="gv-pe">' + o.pe + '</div>' : '') + '</div>';
    var painel = fundo.firstChild;
    var corpo = painel.querySelector('.gv-corpo');
    if (typeof o.html === 'string') corpo.innerHTML = o.html; else if (o.html) corpo.appendChild(o.html);
    var g = {
      el: painel, corpo: corpo,
      fechar: function () {
        var i = _gavetas.indexOf(g);
        if (i < 0) return;
        _gavetas.splice(i, 1);
        fundo.remove();
        if (!_gavetas.length) document.documentElement.classList.remove('gv-trava');
        if (anterior && anterior.isConnected && anterior.focus) anterior.focus();
        if (o.aoFechar) o.aoFechar();
      }
    };
    fundo.addEventListener('click', function (e) {
      if (e.target === fundo || e.target.closest('[data-gv-fechar]')) g.fechar();
    });
    painel.__fechar = g.fechar;
    _gavetas.push(g);
    document.body.appendChild(fundo);
    document.documentElement.classList.add('gv-trava');
    var prim = corpo.querySelector(FOCAVEIS);
    (prim || painel).focus();
    return g;
  }
  function fecharGavetas() { _gavetas.slice().forEach(function (g) { g.fechar(); }); }

  /* FILTROS RECOLHIDOS. O aberto mora aqui, pelo id, porque as telas
     redesenham a vista inteira a cada escolha: o HTML novo ja nasce aberto. */
  var _flAberto = '';
  var _flRota = '';
  var ICO_FILTRO = '<svg class="fl-ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 5h16l-6 8v5l-4 2v-7z"/></svg>';
  function filtros(html, nAtivos, o) {
    o = o || {};
    var id = String(o.id || (APP.rota.tela + (APP.rota.aba ? '-' + APP.rota.aba : '')) || 'filtros').replace(/[^\w-]/g, '');
    var ab = _flAberto === id;
    var n = Number(nAtivos) || 0;
    var tit = o.titulo || 'Filtros';
    return '<div class="fl' + (ab ? ' aberto' : '') + '" data-fl="' + id + '">' +
      '<button type="button" class="btn fl-btn' + (n ? ' on' : '') + '" data-fl-abrir aria-expanded="' + ab + '" aria-controls="fl-gv-' + id + '">' +
      ICO_FILTRO + '<span>' + esc(tit) + '</span><span class="fl-n"' + (n ? '' : ' hidden') + '>' + n + '</span></button>' +
      '<div class="fl-fundo" data-fl-fechar></div>' +
      '<div class="fl-gv" id="fl-gv-' + id + '" aria-label="' + esc(tit) + '"' + (ab ? ' role="dialog" aria-modal="true"' : '') + '>' +
      '<div class="gv-cab" data-gv-alca><span class="gv-alca" aria-hidden="true"></span><b class="gv-t">' + esc(tit) + '</b>' +
      '<button type="button" class="gv-x" data-fl-fechar aria-label="Fechar">' + ico('x') + '</button></div>' +
      '<div class="fl-corpo">' + html + '</div>' +
      '<div class="gv-pe"><button type="button" class="btnp" data-fl-fechar>Ver resultado</button></div></div></div>';
  }
  /** Atualiza o "(n)" do botao, para a tela que so repinta parte da vista. */
  function filtrosN(id, n) {
    var b = document.querySelector('.fl[data-fl="' + id + '"] .fl-btn');
    if (!b) return;
    n = Number(n) || 0;
    var s = b.querySelector('.fl-n');
    s.textContent = n; s.hidden = !n;
    b.classList.toggle('on', !!n);
  }
  function abrirFiltros(fl) {
    _flAberto = fl.getAttribute('data-fl');
    fl.classList.add('aberto');
    var gv = fl.querySelector('.fl-gv');
    gv.setAttribute('role', 'dialog'); gv.setAttribute('aria-modal', 'true');
    fl.querySelector('.fl-btn').setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('fl-trava');
    var prim = fl.querySelector('.fl-corpo').querySelector(FOCAVEIS);
    if (prim) prim.focus();
  }
  function fecharFiltros() {
    var fl = _flAberto && document.querySelector('.fl[data-fl="' + _flAberto + '"]');
    _flAberto = '';
    document.documentElement.classList.remove('fl-trava');
    if (!fl) return;
    fl.classList.remove('aberto');
    var gv = fl.querySelector('.fl-gv');
    gv.removeAttribute('role'); gv.removeAttribute('aria-modal');
    var b = fl.querySelector('.fl-btn');
    b.setAttribute('aria-expanded', 'false');
    b.focus();
  }
  /** A gaveta de cima: a generica mais recente, ou a dos filtros aberta. */
  function gavetaDoTopo() {
    if (_gavetas.length) { var g = _gavetas[_gavetas.length - 1]; return { painel: g.el, fechar: g.fechar }; }
    var fl = _flAberto && document.querySelector('.fl.aberto[data-fl="' + _flAberto + '"]');
    if (fl && getComputedStyle(fl.querySelector('.fl-gv')).position === 'fixed') return { painel: fl.querySelector('.fl-gv'), fechar: fecharFiltros };
    return null;
  }
  /* Arrastar a alca para baixo fecha; pouco arraste volta ao lugar. */
  function ligarGestoGaveta() {
    var arr = null;
    document.addEventListener('pointerdown', function (e) {
      var cab = e.target.closest && e.target.closest('[data-gv-alca]');
      if (!cab || e.target.closest('button')) return;
      var painel = cab.closest('.gv, .fl-gv');
      var topo = gavetaDoTopo();
      if (!painel || !topo || topo.painel !== painel) return;
      arr = { painel: painel, y0: e.clientY, dy: 0, t0: Date.now(), fechar: topo.fechar };
      painel.style.transition = 'none';
      try { cab.setPointerCapture(e.pointerId); } catch (_) {}
    });
    document.addEventListener('pointermove', function (e) {
      if (!arr) return;
      arr.dy = Math.max(0, e.clientY - arr.y0);
      arr.painel.style.transform = 'translateY(' + arr.dy + 'px)';
    });
    var solta = function () {
      if (!arr) return;
      var a = arr; arr = null;
      a.painel.style.transition = '';
      var rapido = a.dy > 30 && a.dy / Math.max(1, Date.now() - a.t0) > 0.6;
      if (a.dy > Math.min(120, a.painel.offsetHeight / 3) || rapido) { a.painel.style.transform = ''; a.fechar(); }
      else a.painel.style.transform = '';
    };
    document.addEventListener('pointerup', solta);
    document.addEventListener('pointercancel', solta);
  }
  /* Esc fecha e Tab nao sai da gaveta. Em captura, antes dos ouvintes das
     telas: a lista de sprints (`.fsp`) aberta dentro da gaveta fecha primeiro. */
  function tecladoGaveta(e) {
    if (_sessaoCaiu) return;   // a gaveta esta escondida atras da tela de entrar
    var topo = gavetaDoTopo();
    if (!topo) return;
    if (e.key === 'Escape') {
      if (topo.painel.querySelector('.fsp.aberto')) return;
      e.preventDefault(); e.stopPropagation();
      topo.fechar();
      return;
    }
    if (e.key !== 'Tab') return;
    var fs = Array.prototype.filter.call(topo.painel.querySelectorAll(FOCAVEIS), function (x) { return x.offsetParent !== null || x === document.activeElement; });
    if (!fs.length) { e.preventDefault(); return; }
    var prim = fs[0], ult = fs[fs.length - 1], at = document.activeElement;
    if (!topo.painel.contains(at)) { e.preventDefault(); prim.focus(); }
    else if (e.shiftKey && at === prim) { e.preventDefault(); ult.focus(); }
    else if (!e.shiftKey && at === ult) { e.preventDefault(); prim.focus(); }
  }

  /** Marca a primeira tag de um pedaco de HTML como celula da tabela-cartao
      (`data-label` e `data-tc`), sem embrulhar. */
  function celula(html, rotulo, tc) {
    return String(html).replace(/^(\s*<[a-zA-Z][\w-]*)/, '$1 data-label="' + esc(rotulo || '') + '"' + (tc ? ' data-tc="' + esc(tc) + '"' : ''));
  }

  // ── Registro de telas e rotas ─────────────────────────────────────────
  /* tela({ id, rotulo, ico, grupo, papeis, abas: [{id, rotulo}], menu: false,
            render(el, ctx) })  — `render` recebe o <div> da vista e um contexto
     com a aba e o parametro da rota (#item/AX-123 -> param 'AX-123'). */
  function tela(def) {
    APP.telas[def.id] = def;
    if (APP.ordem.indexOf(def.id) < 0) APP.ordem.push(def.id);
    if (APP.D && APP.rota.tela === def.id) desenhar();
  }

  function lerRota() {
    var h = decodeURIComponent(String(location.hash || '').replace(/^#\/?/, ''));
    var p = h.split('/');
    return { tela: p[0] || 'inicio', aba: '', param: p.slice(1).join('/') };
  }

  function ir(rota) { location.hash = rota; }

  // ── O menu (DOC-17 §17.1), filtrado pelo perfil (DOC-04) ──────────────
  var A = ['admin'], AD = ['admin', 'analista', 'dev'], ADC = ['admin', 'analista', 'dev', 'consulta'], AC = ['admin', 'consulta'];
  var MENU = [
    { grupo: 'Trabalho', itens: [
      { id: 'inicio',   rotulo: 'Início',         ico: 'home',     papeis: ADC },
      // O painel do dev (dev.html) virou esta aba do Inicio; o item no menu e a porta dela.
      // `curto`: o rotulo na barra inferior do celular, onde "Meu trabalho" nao cabe.
      { id: 'meu',      rotulo: 'Meu trabalho',   ico: 'user',     papeis: AD, rota: 'inicio/meu', curto: 'Minhas' },
      { id: 'quadro',   rotulo: 'Quadro',         ico: 'board',    papeis: AD },
      { id: 'backlog',  rotulo: 'Backlog',        ico: 'menu',     papeis: AD, badge: 'backlog' },
      { id: 'sprints',  rotulo: 'Sprints',        ico: 'refresh',  papeis: AD },
      { id: 'projetos', rotulo: 'Projetos',       ico: 'package',  papeis: ADC },
      { id: 'poker',    rotulo: 'Planning Poker', ico: 'cards',    papeis: AD }
    ] },
    { grupo: 'Acompanhamento', itens: [
      { id: 'acompanhamentos', rotulo: 'Acompanhamentos', ico: 'flag', papeis: A },
      { id: 'publico',  rotulo: 'Painel público',  ico: 'globe',   papeis: ADC, href: 'index.html' }
    ] },
    { grupo: 'Análises', itens: [
      { id: 'paineis',    rotulo: 'Painéis',           ico: 'chart',   papeis: AC },
      { id: 'relatorios', rotulo: 'Relatórios',        ico: 'receipt', papeis: AC },
      { id: 'fechamento', rotulo: 'Fechamento do mês', ico: 'clock',   papeis: A }
    ] }
  ];
  var RODAPE = [{ id: 'configuracoes', rotulo: 'Configurações', ico: 'key', papeis: A }];
  // Telas que existem mas nao estao no menu: chega-se a elas por link.
  var FORA_DO_MENU = { item: 'quadro', projeto: 'projetos', conta: '', planejamento: 'sprints', importar: 'backlog', api: '' };

  function itemVisivel(it) { return it.papeis.indexOf(APP.papel) >= 0; }

  /* A BARRA INFERIOR DO CELULAR, por perfil. Fixos: Inicio, Meu trabalho e
     Quadro, os que o perfil ve; quem ve menos de tres (a consulta) completa
     com os proximos do MENU, sem link que sai do app. Buscar e Mais sao da
     propria barra. O que nao foi para a barra vai para a gaveta do "Mais",
     nos grupos do MENU, e o RODAPE (Configuracoes) no fim. */
  var BARRA_FIXOS = ['inicio', 'meu', 'quadro'];
  var BARRA_MAX = 3;
  function barraInferior(papel) {
    var ve = function (it) { return it.papeis.indexOf(papel) >= 0; };
    var todos = [];
    MENU.forEach(function (g) { g.itens.forEach(function (it) { todos.push(it); }); });
    var barra = [];
    BARRA_FIXOS.forEach(function (id) {
      var it = todos.filter(function (x) { return x.id === id; })[0];
      if (it && ve(it)) barra.push(it);
    });
    todos.forEach(function (it) {
      if (barra.length < BARRA_MAX && ve(it) && !it.href && barra.indexOf(it) < 0) barra.push(it);
    });
    var mais = MENU.map(function (g) {
      return { grupo: g.grupo, itens: g.itens.filter(function (it) { return ve(it) && barra.indexOf(it) < 0; }) };
    }).filter(function (g) { return g.itens.length; });
    return { barra: barra, mais: mais, rodape: RODAPE.filter(ve) };
  }

  function contagemBadge(qual) {
    if (qual === 'backlog' && APP.papel === 'admin') {
      return visiveis().filter(function (m) { return colunaDe(m) === 'validacao'; }).length;
    }
    return 0;
  }

  function htmlMenu(ativo) {
    var e = APP.eu || {};
    var nome = e.nome || e.login || 'Minha conta';
    var rotPapel = { admin: 'PM/PO · Admin', analista: 'Analista de requisitos', dev: 'Dev', consulta: 'Consulta' }[APP.papel] || '';
    var item = function (it) {
      var href = it.href || ('#' + (it.rota || it.id));
      var b = it.badge ? contagemBadge(it.badge) : 0;
      return '<a href="' + href + '" class="sb-it' + (it.id === ativo ? ' on' : '') + '"' + (it.id === ativo ? ' aria-current="page"' : '') + '>' +
        ico(it.ico) + '<span class="sb-t">' + esc(it.rotulo) + '</span>' +
        (b ? '<span class="sb-badge" title="aguardando validação">' + b + '</span>' : '') +
        (it.href ? ico('external', 'style="font-size:12px;color:var(--tx4)"') : '') + '</a>';
    };
    var h = '<a href="#inicio" class="sb-logo"><span class="sb-mark"><img src="axis/marca/axis-leao-branco.png" alt="" style="width:25px;height:auto;display:block"></span>' +
      '<span class="sb-word">AX<i>IS</i></span></a>';
    MENU.forEach(function (g) {
      var its = g.itens.filter(itemVisivel);
      if (!its.length) return;
      h += '<div class="sb-grp"><span class="sb-lab">' + esc(g.grupo.toUpperCase()) + '</span>' + its.map(item).join('') + '</div>';
    });
    var rod = RODAPE.filter(itemVisivel);
    h += '<div class="sb-grp" style="margin-top:auto">' + rod.map(item).join('') + '</div>';
    h += '<a href="#conta" class="sb-user">' + av(nome, 34) +
      '<span style="display:flex;flex-direction:column;min-width:0"><span style="font-size:13px;font-weight:700" class="ell">' + esc(nome) + '</span>' +
      '<span style="font-size:11.5px;color:var(--tx3)">' + esc(rotPapel) + '</span></span>' +
      '<button type="button" class="sb-sair" data-acao="sair" title="Sair" aria-label="Sair">' + ico('logout') + '</button></a>';
    return h;
  }

  /* A barra inferior do celular (`.bn`): so aparece pela container query do
     axis-app.css; no computador fica escondida e a lateral segue igual. */
  function htmlBarra(ativo) {
    var B = barraInferior(APP.papel);
    var noMais = B.mais.some(function (g) { return g.itens.some(function (it) { return it.id === ativo; }); }) ||
      B.rodape.some(function (it) { return it.id === ativo; });
    var badge = B.mais.reduce(function (t, g) { return t + g.itens.reduce(function (s, it) { return s + (it.badge ? contagemBadge(it.badge) : 0); }, 0); }, 0);
    var h = '<nav class="bn" aria-label="Navegação">' + B.barra.map(function (it) {
      var on = it.id === ativo;
      return '<a href="#' + (it.rota || it.id) + '" class="bn-it' + (on ? ' on' : '') + '"' + (on ? ' aria-current="page"' : '') +
        (it.curto ? ' aria-label="' + esc(it.rotulo) + '" title="' + esc(it.rotulo) + '"' : '') + '>' +
        ico(it.ico) + '<span class="bn-t">' + esc(it.curto || it.rotulo) + '</span></a>';
    }).join('');
    h += '<button type="button" class="bn-it" data-acao="busca">' + ico('search') + '<span class="bn-t">Buscar</span></button>';
    h += '<button type="button" class="bn-it' + (noMais ? ' on' : '') + '" data-acao="mais" aria-haspopup="dialog">' + ico('menu') +
      '<span class="bn-t">Mais</span>' + (badge ? '<span class="bn-badge" title="aguardando validação">' + badge + '</span>' : '') + '</button>';
    return h + '</nav>';
  }

  /** A gaveta do "Mais": o resto do MENU do perfil, a conta e o Sair. */
  function abrirMais() {
    var B = barraInferior(APP.papel);
    var e = APP.eu || {};
    var nome = e.nome || e.login || 'Minha conta';
    var rotPapel = { admin: 'PM/PO · Admin', analista: 'Analista de requisitos', dev: 'Dev', consulta: 'Consulta' }[APP.papel] || '';
    var r = lerRota();
    var ativo = FORA_DO_MENU[r.tela] != null ? FORA_DO_MENU[r.tela] : r.tela;
    var item = function (it) {
      var b = it.badge ? contagemBadge(it.badge) : 0;
      return '<a href="' + (it.href || ('#' + (it.rota || it.id))) + '" class="gv-it' + (it.id === ativo ? ' on' : '') + '"' + (it.id === ativo ? ' aria-current="page"' : '') + '>' +
        ico(it.ico) + '<span class="sb-t">' + esc(it.rotulo) + '</span>' +
        (b ? '<span class="sb-badge" title="aguardando validação">' + b + '</span>' : '') +
        (it.href ? ico('external', 'style="color:var(--tx4)"') : '') + '</a>';
    };
    var h = '<a href="#conta" class="gv-eu">' + av(nome, 40) + '<span style="display:flex;flex-direction:column;min-width:0">' +
      '<b class="ell" style="font-size:14px">' + esc(nome) + '</b><span style="font-size:12.5px;color:var(--tx3)">' + esc(rotPapel) + '</span></span></a>';
    B.mais.forEach(function (g) {
      h += '<div class="gv-grp"><span class="sb-lab">' + esc(g.grupo.toUpperCase()) + '</span>' + g.itens.map(item).join('') + '</div>';
    });
    h += '<div class="gv-grp"><span class="sb-lab">CONTA</span>' + B.rodape.map(item).join('') +
      item({ id: 'conta', rotulo: 'Minha conta', ico: 'user' }) +
      '<button type="button" class="gv-it" data-acao="sair">' + ico('logout') + '<span class="sb-t">Sair</span></button></div>';
    var g = gaveta({ titulo: 'Menu', html: h });
    // Fecha depois do clique: tirar o link do DOM no meio do clique poderia
    // cancelar a navegacao.
    g.corpo.addEventListener('click', function (ev) { if (ev.target.closest('a[href]')) setTimeout(g.fechar, 0); });
    return g;
  }

  // ── Notificacoes: o que pede acao, derivado da base ───────────────────
  /* Nao ha servico de notificacao (e item novo do de-para). O sino mostra o
     que a propria base ja diz que espera alguem — a mesma leitura que as
     faixas do admin e do painel do dev fazem hoje. */
  function notificacoes() {
    var lista = [];
    var vs = visiveis();
    if (APP.papel === 'admin') {
      var val = vs.filter(function (m) { return colunaDe(m) === 'validacao'; });
      if (val.length) lista.push({ ico: 'check', cor: 'var(--wn-t)', txt: '<b>' + plural(val.length, 'entrega', 'entregas') + '</b> aguardando sua validação', href: '#backlog/validacao' });
      // Mesma leitura do banner do admin: etapa efetiva 'atrasado'. `diasDeAtraso`
      // segue positivo (congelado) para o que ja foi entregue, e contaria a mais.
      var atr = vs.filter(function (m) { return etapaDe(m) === 'atrasado'; });
      if (atr.length) lista.push({ ico: 'alert', cor: 'var(--dg-t)', txt: '<b>' + plural(atr.length, 'demanda', 'demandas') + '</b> com prazo vencido', href: '#backlog/vencido' });
      var pend = raiz.SPRINTPO && raiz.SPRINTPO.pendentesDeFechamento ? (raiz.SPRINTPO.pendentesDeFechamento(APP.D, hoje(), (APP.D || {}).feriados || [], colunaDe) || []) : [];
      if (pend.length) lista.push({ ico: 'refresh', cor: 'var(--wn-t)', txt: '<b>' + plural(pend.length, 'sprint terminou', 'sprints terminaram') + '</b> e não ' + (pend.length === 1 ? 'foi fechada' : 'foram fechadas'), href: '#sprints/encerrar' });
    }
    // O pessoal vale para quem tem demanda no nome, o PM/PO que tambem
    // desenvolve inclusive — e nao so para o perfil dev.
    var minhas = vs.filter(minha);
    if (APP.papel === 'dev' || (APP.papel !== 'consulta' && minhas.length)) {
      var meuAtr = minhas.filter(function (m) { return etapaDe(m) === 'atrasado'; });
      if (meuAtr.length) lista.push({ ico: 'alert', cor: 'var(--dg-t)', txt: '<b>' + plural(meuAtr.length, 'demanda sua', 'demandas suas') + '</b> com prazo vencido', href: '#inicio/meu' });
      // Mesma regra do Inicio: relogio parado (validacao, concluida) nao vence.
      var hojeV = minhas.filter(function (m) {
        return prazoDe(m) === hoje() && !pausada(m) && !(raiz.PRAZO && raiz.PRAZO.relogioParou && raiz.PRAZO.relogioParou(colunaDe(m)));
      });
      if (hojeV.length) lista.push({ ico: 'clock', cor: 'var(--wn-t)', txt: '<b>' + plural(hojeV.length, 'demanda vence', 'demandas vencem') + '</b> hoje', href: '#inicio/meu' });
      var dev = minhas.filter(function (m) { return raiz.DEVOLUCAO && raiz.DEVOLUCAO.houve && raiz.DEVOLUCAO.houve(m) && colunaDe(m) === 'em_andamento'; });
      if (dev.length) lista.push({ ico: 'undo', cor: 'var(--wn-t)', txt: '<b>' + plural(dev.length, 'demanda devolvida', 'demandas devolvidas') + '</b> para ajuste', href: '#inicio/meu' });
    }
    var poker = vs.filter(function (m) { return colunaDe(m) === 'planning' && !pontosDe(m); });
    if (poker.length && APP.papel !== 'consulta') lista.push({ ico: 'cards', cor: 'var(--in-t)', txt: '<b>' + plural(poker.length, 'item', 'itens') + '</b> para estimar no Poker', href: '#poker' });
    return lista;
  }

  // ── Busca (Ctrl K) ────────────────────────────────────────────────────
  function abrirBusca() {
    if (document.querySelector('.ovl.busca')) return;
    var ov = document.createElement('div');
    ov.className = 'ovl busca';
    ov.innerHTML = '<div class="dlg pal" role="dialog" aria-label="Buscar"><div class="pal-in">' + ico('search') +
      '<input id="pal-q" placeholder="Buscar AX-, título, dev, solicitante ou sistema" autocomplete="off">' +
      '<span class="kbd">Esc</span><button type="button" class="pal-x" aria-label="Fechar a busca">' + ico('x') + '</button></div><div class="pal-res" id="pal-res"></div></div>';
    document.body.appendChild(ov);
    var q = ov.querySelector('#pal-q'), res = ov.querySelector('#pal-res'), sel = 0, achados = [];
    var fecha = function () { ov.remove(); };
    var pinta = function () {
      var t = q.value.trim().toLowerCase();
      var vs = visiveis();
      if (!t) {
        achados = vs.filter(function (m) { return APP.papel === 'dev' ? minha(m) : colunaDe(m) === 'em_andamento'; }).slice(0, 8);
      } else {
        var porCod = raiz.BUSCA_DEMANDA ? raiz.BUSCA_DEMANDA.acha(vs, q.value.trim()) : null;
        achados = vs.filter(function (m) {
          return [m.codigo, m.titulo, m.dev, m.solicitante, tema(m.tema_id)].join(' ').toLowerCase().indexOf(t) >= 0;
        });
        if (porCod && achados.indexOf(porCod) < 0) achados.unshift(porCod);
        achados = achados.slice(0, 30);
      }
      sel = Math.min(sel, Math.max(0, achados.length - 1));
      res.innerHTML = achados.length ? achados.map(function (m, i) {
        return '<a class="pal-it' + (i === sel ? ' on' : '') + '" href="' + hrefItem(m) + '">' + cod(m) +
          '<span style="min-width:0"><span class="ell" style="display:block;font-weight:700;font-size:13.5px">' + esc(m.titulo) + '</span>' +
          '<span class="ell" style="display:block;font-size:12px;color:var(--tx3)">' + esc(caminho(m.tema_id)) + (m.dev ? ' · ' + esc(m.dev) : '') + '</span></span>' +
          chipEtapa(m) + '</a>';
      }).join('') : '<div class="pal-vazio">Nada encontrado para "' + esc(q.value) + '".</div>';
    };
    q.addEventListener('input', function () { sel = 0; pinta(); });
    q.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') fecha();
      else if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, achados.length - 1); pinta(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); pinta(); e.preventDefault(); }
      else if (e.key === 'Enter' && achados[sel]) { location.hash = hrefItem(achados[sel]); fecha(); }
    });
    // No celular a busca ocupa a tela: sem fundo para tocar, o X fecha.
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('.pal-it, .pal-x')) fecha(); });
    pinta();
    q.focus();
  }

  // ── Desenho ───────────────────────────────────────────────────────────
  var raizEl = null;

  function curvaLogin() {
    return '<svg class="lg-curva" viewBox="0 0 600 140" preserveAspectRatio="none" aria-hidden="true">' +
      '<polyline fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" points="0,130 70,118 120,124 190,104 240,110 310,84 360,92 430,62 480,70 560,30"/>' +
      '<circle cx="560" cy="30" r="6" fill="var(--tx-hi)"/></svg>';
  }

  /* `o.ok`: a frase e de sucesso (senha redefinida), e nao erro; `o.usuario`
     ja vem no campo. Recuperar a senha e criar a conta sao passos desta mesma
     caixa (AXIS_CONTA.passo, axis-tela-conta.js). */
  /** A moldura da tela de entrar (marca a esquerda); `dir` e a caixa da direita. */
  function moldura(dir) {
    return '<div class="lg"><div class="lg-esq"><span class="axis-logo" role="img" aria-label="AXIS"></span>' +
      '<h1 class="lg-tit">Todas as demandas da tecnologia em um só eixo.</h1>' +
      '<p class="lg-sub">Backlog, sprints e projetos do time em um só lugar.</p>' + curvaLogin() + '</div>' +
      '<div class="lg-dir">' + dir + '</div></div>';
  }

  function desenharLogin(msg, o) {
    o = o || {};
    raizEl.innerHTML = moldura(
      '<form class="lg-box" id="lg-form" autocomplete="on">' +
      '<span class="sb-mark" style="width:56px;height:56px;border-radius:16px"><img src="axis/marca/axis-leao-branco.png" alt="" style="width:36px"></span>' +
      '<h2 style="margin:6px 0 0;font-family:var(--font-title);font-size:26px;font-weight:800">Bem-vindo de volta</h2>' +
      '<span class="sub" style="margin-bottom:8px">Entre com a sua conta da Tecnologia.</span>' +
      '<label for="lg-usuario">Usuário ou e-mail</label><input class="in" id="lg-usuario" autocomplete="username" required value="' + esc(o.usuario || '') + '">' +
      '<span style="display:flex;justify-content:space-between;align-items:baseline;gap:12px"><label for="lg-senha">Senha</label>' +
      '<button type="button" class="link" data-lg="recuperar" style="font-size:12.5px;font-weight:700;min-height:44px;margin:-13px 0">Esqueci a senha</button></span>' +
      '<input class="in" id="lg-senha" type="password" autocomplete="current-password" required>' +
      '<div class="lg-err" id="lg-err" role="alert"' + (o.ok ? ' style="color:var(--ok-t)"' : '') + '>' + esc(msg || '') + '</div>' +
      '<button class="btnp" id="lg-btn" type="submit">Entrar</button>' +
      '<span class="note" style="text-align:center">Primeiro acesso? <button type="button" class="link" data-lg="cadastro" style="min-height:44px;margin:-12px 0">Criar minha conta</button></span>' +
      '</form>');
    raizEl.querySelectorAll('[data-lg]').forEach(function (b) {
      b.addEventListener('click', function () {
        var modo = b.getAttribute('data-lg');
        if (raiz.AXIS_CONTA && raiz.AXIS_CONTA.passo) raiz.AXIS_CONTA.passo(raizEl.querySelector('.lg-dir'), modo, desenharLogin);
        else if (modo === 'recuperar' && raiz.abrirRecuperarSenha) raiz.abrirRecuperarSenha();
      });
    });
    var f = raizEl.querySelector('#lg-form');
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var b = f.querySelector('#lg-btn'), err = f.querySelector('#lg-err');
      b.disabled = true; b.textContent = 'Entrando…'; err.textContent = '';
      try {
        await entrar(f.querySelector('#lg-usuario').value.trim(), f.querySelector('#lg-senha').value);
        await iniciarApp();
      } catch (ex) {
        err.textContent = ex.status === 401 ? 'Usuário ou senha inválidos.' : (ex.message || 'Não foi possível entrar.');
        b.disabled = false; b.textContent = 'Entrar';
      }
    });
    setTimeout(function () { var u = raizEl.querySelector(o.usuario ? '#lg-senha' : '#lg-usuario'); if (u) u.focus(); }, 0);
  }

  function telaPermitida(id) {
    var t = APP.telas[id];
    if (!t) return false;
    return !t.papeis || t.papeis.indexOf(APP.papel) >= 0;
  }

  /* `manterRolagem`: redesenho pedido por filtro da propria tela nao volta a
     pagina para o topo; so a troca de rota volta. */
  function desenhar(manterRolagem) {
    if (!raizEl) return;
    lerSessao();
    if (!APP.token) { _noVinculo = false; desenharLogin(); return; }
    // O passo do vinculo esta na tela: a releitura e a troca de rota nao passam por cima dele.
    if (_noVinculo) return;
    if (!APP.D) {
      raizEl.innerHTML = '<div class="app"><nav class="sb" aria-label="Menu principal">' + htmlMenu('') + '</nav><main class="main">' +
        '<div class="sk" style="height:40px;width:420px;max-width:100%"></div><div class="sk" style="height:34px;width:260px"></div>' +
        '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">' + '<div class="sk" style="height:96px"></div>'.repeat(4) + '</div>' +
        '<div class="sk" style="height:320px"></div></main>' + htmlBarra('') + '</div>';
      return;
    }
    var r = lerRota();
    if (!APP.telas[r.tela] || !telaPermitida(r.tela)) {
      // Rota de tela que este perfil nao ve: cai no Inicio em vez de mostrar porta fechada.
      if (r.tela !== 'inicio' && APP.telas.inicio) { location.replace('#inicio'); return; }
    }
    var t = APP.telas[r.tela];
    var abas = t && t.abas ? t.abas.filter(function (a) { return !a.papeis || a.papeis.indexOf(APP.papel) >= 0; }) : [];
    // Com abas, o 1o segmento depois da tela e a aba (#backlog/validacao);
    // telas com parametro (#item/AX-1) declaram `param: true`.
    if (t && t.param) { r.param = r.param; r.aba = ''; }
    else if (abas.length) { var s = r.param.split('/'); r.aba = s[0] || abas[0].id; r.param = s.slice(1).join('/'); if (!abas.some(function (a) { return a.id === r.aba; })) r.aba = abas[0].id; }
    APP.rota = r;
    // Filtros abertos so sobrevivem ao redesenho da MESMA rota.
    var rotaTxt = r.tela + '/' + r.aba + '/' + r.param;
    if (rotaTxt !== _flRota) { _flRota = rotaTxt; _flAberto = ''; document.documentElement.classList.remove('fl-trava'); }
    var ativoMenu = FORA_DO_MENU[r.tela] != null ? FORA_DO_MENU[r.tela] : r.tela;
    if (r.tela === 'inicio' && r.aba === 'meu') ativoMenu = 'meu';
    var nN = notificacoes();
    var abasHtml = '';
    if (t && t.abasDe) abas = (t.abasDe(r) || abas).filter(function (a) { return !a.papeis || a.papeis.indexOf(APP.papel) >= 0; });
    if (abas.length) {
      abasHtml = '<nav class="tabs" aria-label="Seções">' + abas.map(function (a) {
        var on = a.id === r.aba;
        var href = a.href || ('#' + r.tela + '/' + a.id + (t.param && r.param ? '' : ''));
        return '<a href="' + href + '" class="tab' + (on ? ' on' : '') + '" style="display:inline-flex;align-items:center;text-decoration:none"' + (on ? ' aria-current="page"' : '') + '>' +
          esc(a.rotulo) + (a.n != null ? '<span class="n">' + a.n + '</span>' : '') + '</a>';
      }).join('') + '</nav>';
    }
    // No celular o rotulo some e fica o "+" (botao de icone, 44 px).
    var novo = pode('gravar') ? '<button type="button" class="btnp tb-novo" data-acao="novo" title="Nova demanda" aria-label="Nova demanda"><span>+ <span class="lbl">Nova demanda</span></span></button>' : '';
    raizEl.innerHTML =
      '<div class="app"><nav class="sb" aria-label="Menu principal">' + htmlMenu(ativoMenu) + '</nav>' +
      '<main class="main"><div class="topbar">' +
      '<a href="#inicio" class="tb-logo" aria-label="AXIS, início"><span class="sb-mark"><img src="axis/marca/axis-leao-branco.png" alt="" style="width:22px;height:auto;display:block"></span></a>' +
      '<button type="button" class="tb-search" data-acao="busca" aria-label="Buscar">' + ico('search') + '<span class="lbl">Buscar AX-, título, dev ou sistema</span><span class="kbd">Ctrl K</span></button>' +
      '<span style="flex:1"></span>' + novo +
      '<button type="button" class="tb-ico" data-acao="tema" aria-label="Alternar tema claro ou escuro" title="Tema claro ou escuro">' + ico(raiz.temaAtual && raiz.temaAtual() === 'claro' ? 'sun' : 'moon') + '</button>' +
      '<span style="position:relative"><button type="button" class="tb-ico" data-acao="ntf" aria-label="Notificações" aria-expanded="false">' + ico('bell') +
      (nN.length ? '<span class="dot">' + nN.length + '</span>' : '') + '</button></span>' +
      '<a href="#conta" class="tb-av" aria-label="Minha conta" style="background:var(--ac);color:var(--on-ac)">' + esc(iniciais((APP.eu || {}).nome || (APP.eu || {}).login || '')) + '</a>' +
      '</div><div id="axa-faixas"></div>' + abasHtml + '<div class="view" id="vista"></div></main>' + htmlBarra(ativoMenu) + '</div>';
    pintaFaixas();
    var vista = raizEl.querySelector('#vista');
    if (!t) {
      vista.innerHTML = vazio('package', 'Esta tela ainda está sendo montada', 'Use o menu para ir a outra tela.');
      return;
    }
    document.title = (t.titulo ? t.titulo(r) : t.rotulo) + ' — AXIS';
    try {
      var out = t.render(vista, ctx(r));
      if (typeof out === 'string') vista.innerHTML = out;
      if (t.depois) t.depois(vista, ctx(r));
    } catch (e) {
      console.error(e);
      vista.innerHTML = vazio('alert', 'Esta tela não conseguiu ser desenhada', String(e && e.message || e),
        '<button class="btn" type="button" onclick="location.reload()">Recarregar</button>');
    }
    if (manterRolagem !== true) window.scrollTo(0, 0);
    // A tela pode ter deixado de desenhar o bloco de filtros que estava aberto.
    if (_flAberto && !document.querySelector('.fl.aberto[data-fl="' + _flAberto + '"]')) { _flAberto = ''; document.documentElement.classList.remove('fl-trava'); }
  }

  function ctx(r) {
    return { D: APP.D, eu: APP.eu || {}, papel: APP.papel, aba: r.aba, param: r.param, rota: r, H: H };
  }

  function abrirNotificacoes(btn) {
    var aberto = document.querySelector('.ntf');
    if (aberto) { aberto.remove(); btn.setAttribute('aria-expanded', 'false'); return; }
    var lista = notificacoes();
    var d = document.createElement('div');
    d.className = 'ntf';
    d.innerHTML = '<span class="lab" style="padding:6px 10px">O QUE PEDE AÇÃO</span>' + (lista.length ? lista.map(function (n) {
      return '<a class="ntf-it" href="' + n.href + '"><span style="color:' + n.cor + '">' + ico(n.ico) + '</span><span>' + n.txt + '</span></a>';
    }).join('') : '<div class="pal-vazio">Nada pendente com você agora.</div>');
    btn.parentNode.appendChild(d);
    btn.setAttribute('aria-expanded', 'true');
  }

  // ── Releitura a cada 30 s e as faixas do topo ─────────────────────────
  /* O `adminCheckUpdates` do admin.html: a cada 30 s (e ao voltar para a aba)
     le a base e compara o `atualizado_em` com o da tela. Mudou e nada esta
     aberto: rele e redesenha, mantendo a rolagem. Mudou com um formulario,
     gaveta, caixa ou campo de texto em uso: NAO redesenha por cima — mostra a
     faixa "Ha alteracoes mais novas no servidor" e a decisao fica com quem
     esta na tela. Nao mudou: a faixa sai.

     Antes o app so relia ao voltar o foco depois de um minuto: quem ficava na
     tela via a base de quando abriu, e a mudanca de outra pessoa so aparecia
     depois de gravar por cima dela.

     ABA ESCONDIDA NAO LE: a releitura acontece quando ela volta a ficar
     visivel. E nao le no meio de uma gravacao — o `atualizado_em` novo seria o
     da propria gravacao, e o aviso diria "outra pessoa" sobre o que voce fez. */
  var RELEITURA_MS = 30000;
  function decisaoDaReleitura(tsTela, tsServidor, bloqueado) {
    var novo = tsTela !== undefined && tsServidor !== tsTela;
    return novo && bloqueado ? 'aviso' : novo ? 'rele' : 'nada';
  }
  /** Algo aberto que um redesenho apagaria ou tiraria do lugar. */
  function telaOcupada() {
    if (_arrastando) return true;   // um card no meio do arraste (Quadro, Planejamento)
    if (document.querySelector('.ovl, .gv-fundo, .fl.aberto, .ntf')) return true;
    var a = document.activeElement;
    if (!a || !raizEl || !raizEl.contains(a)) return false;
    if (a.isContentEditable || a.tagName === 'TEXTAREA') return true;
    return a.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|range|color|file)$/i.test(a.type || '');
  }
  var _relendo = false;
  var _novoNoServidor = false;
  var _arrastando = false;
  async function conferirServidor() {
    if (_relendo || _naFila || !APP.token || !APP.D || _sessaoCaiu || _noVinculo) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    _relendo = true;
    try {
      var j = await api('dados');
      var d = decisaoDaReleitura((APP.D || {}).atualizado_em, j.atualizado_em, telaOcupada());
      if (d === 'rele' && !_naFila && APP.token) {
        APP.D = comFila(await hidrata(j));
        APP.carregadoEm = Date.now();
        _novoNoServidor = false;
        desenhar(true);
      } else avisaNovo(d === 'aviso');
    } catch (_) { /* rede: tenta de novo na proxima volta; 401 ja derrubou a sessao */ }
    _relendo = false;
  }
  function avisaNovo(sim) {
    if (_novoNoServidor === !!sim) return;
    _novoNoServidor = !!sim;
    pintaFaixas();
  }
  function atualizarAgora() {
    _novoNoServidor = false;
    pintaFaixas();
    return carregar().then(function () { desenhar(true); toast('Atualizado com a versão do servidor.'); })
      .catch(function (e) { if (e.status !== 401) toast('Não foi possível ler os dados: ' + (e.message || e), 'erro'); });
  }

  /* AS FAIXAS DO TOPO, que duram enquanto o motivo dura (um toast some em
     segundos): a de "mais novo no servidor" e a das demandas NAO gravadas que
     ficaram guardadas neste navegador (a `pend-banner` do admin.html; o
     rascunho e do axis-form-demanda.js). */
  function poeCssFaixas() {
    if (document.getElementById('css-axa-faixas')) return;
    var st = document.createElement('style');
    st.id = 'css-axa-faixas';
    st.textContent = [
      '.axa #axa-faixas{display:flex;flex-direction:column;gap:8px}',
      '.axa #axa-faixas:empty{display:none}',
      '.axa .fx-aviso{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;padding:10px 14px;border-radius:12px;font-size:13px;line-height:20px}',
      '.axa .fx-aviso>.axi{flex-shrink:0}',
      '.axa .fx-wn{background:rgba(var(--wn-rgb),.1);border:1px solid rgba(var(--wn-rgb),.4);color:var(--wn-t)}',
      '.axa .fx-dg{background:rgba(var(--dg-rgb),.1);border:1px solid rgba(var(--dg-rgb),.35);color:var(--dg-t)}',
      '.axa .fx-t{flex:1 1 240px;min-width:0}',
      '.axa .fx-b{display:flex;gap:8px;flex-wrap:wrap}'
    ].join('\n');
    document.head.appendChild(st);
  }
  function pintaFaixas() {
    var z = raizEl && raizEl.querySelector('#axa-faixas');
    if (!z) return;
    poeCssFaixas();
    var h = '';
    if (_novoNoServidor) {
      h += '<div class="fx-aviso fx-wn" role="status">' + ico('refresh') +
        '<span class="fx-t">Há alterações mais novas no servidor (feitas no Planejamento, no Painel Dev ou por outra pessoa). Esta tela está mostrando uma versão anterior.</span>' +
        '<span class="fx-b"><button type="button" class="btns" data-acao="atualizar">Atualizar agora</button>' +
        '<button type="button" class="btns" data-acao="depois">Depois</button></span></div>';
    }
    var rs = raiz.AXIS_FORM && raiz.AXIS_FORM.rascunhos ? raiz.AXIS_FORM.rascunhos() : [];
    if (rs.length) {
      h += '<div class="fx-aviso fx-dg" role="status">' + ico('alert') +
        '<span class="fx-t"><b>' + plural(rs.length, 'demanda', 'demandas') + ' ainda NÃO ' + (rs.length === 1 ? 'gravada' : 'gravadas') + ' no servidor</b> (' +
        rs.map(function (r) { return esc(r.codigo || r.titulo || 'demanda nova'); }).join(', ') + '). ' +
        (rs.length === 1 ? 'Está guardada' : 'Estão guardadas') + ' neste navegador — abra, confira e salve.</span>' +
        '<span class="fx-b">' + rs.slice(0, 3).map(function (r) {
          return '<button type="button" class="btns" data-acao="rascunho" data-alvo="' + esc(r.alvo) + '">Abrir ' + esc(r.codigo || (r.alvo === 'nova' ? 'a demanda nova' : 'a demanda')) + '</button>';
        }).join('') + '</span></div>';
    }
    z.innerHTML = h;
  }

  // ── O vinculo do nome no 1o acesso (dev.html: `pedirVinculo`) ─────────
  /* Quem desenvolve e entra sem que a conta case com um nome das demandas
     responde UMA vez "como o seu nome aparece nas demandas?" — no lugar da
     tela de entrar, como o passo do dev.html. A regra (quem precisa, a lista,
     o palpite) e a gravacao sao as da Minha conta (axis-tela-conta.js). */
  function precisaVinculo() {
    var C = raiz.AXIS_CONTA;
    if (!C || !C.precisaVinculo || !APP.D) return false;
    try { if (sessionStorage.getItem(VINCULO_DEPOIS) === '1') return false; } catch (_) {}
    return C.precisaVinculo(APP.eu, APP.papel, APP.D);
  }
  var _noVinculo = false;
  function pedirVinculo() {
    var C = raiz.AXIS_CONTA;
    if (!C || !C.vinculo || !raizEl || !APP.D) { ir('#conta'); return; }
    fecharGavetas();
    _noVinculo = true;
    raizEl.innerHTML = moldura('');
    C.vinculo(raizEl.querySelector('.lg-dir'), {
      eu: APP.eu, D: APP.D,
      pronto: function () { _noVinculo = false; lerSessao(); desenhar(); },
      depois: function () { _noVinculo = false; try { sessionStorage.setItem(VINCULO_DEPOIS, '1'); } catch (_) {} desenhar(); },
      sair: function () { _noVinculo = false; sair(); }
    });
  }

  /* QUEM NAO TEM A INTERFACE NOVA LIGADA VOLTA PARA A TELA DE SEMPRE
     (axis-interface.js). Decide primeiro pelo `rm_eu` da sessao, para nem
     desenhar o app, e depois confirma com o servidor: o admin pode ter ligado
     ou desligado a marca desde o login. */
  function interfaceCerta() {
    lerSessao();
    var I = raiz.AXIS_INTERFACE;
    if (!I || !APP.token || I.nova(APP.eu)) return true;
    location.replace(I.destinoAntigo(APP.papel));
    return false;
  }

  async function iniciarApp() {
    if (!interfaceCerta()) return;
    // Voltando de sessao vencida com OUTRA conta: a base da anterior nao e desenhada.
    if (_sessaoCaiu && _caiuDe && ((APP.eu || {}).login || '') !== _caiuDe) APP.D = null;
    if (raiz.AXIS_INTERFACE) {
      var produtoAntes = !!(APP.eu && APP.eu.area_produto);
      raiz.AXIS_INTERFACE.atualizar().then(function (e) {
        if (!e || !interfaceCerta()) return;
        // A area de produto mudou desde o login: os gestos de sprint aparecem
        // (ou somem) sem pedir novo login.
        if (!!(APP.eu && APP.eu.area_produto) !== produtoAntes) desenhar();
      });
    }
    desenhar();
    try {
      await carregar();
      _novoNoServidor = false;
      if (!_sessaoCaiu && precisaVinculo()) { pedirVinculo(); return; }
      desenhar();
    } catch (e) {
      if (e.status === 401) { limparSessao(); desenharLogin('Sua sessão expirou. Entre de novo.'); return; }
      raizEl.querySelector('#vista, .main') && (raizEl.querySelector('.main').innerHTML =
        vazio('alert', 'Não foi possível ler os dados', String(e.message || e), '<button class="btnp" type="button" onclick="location.reload()">Tentar de novo</button>'));
    }
    if (APP.token) voltaDaSessao();
    filaPinta();
    if (APP.token) setTimeout(filaProcessa, 3000);
  }

  function ligar() {
    if (raiz.fetch && !raiz.fetch.__vigiaSessao) {
      raiz.fetch = vigiaSessao(raiz.fetch, WORKER, sessaoExpirou);
      raiz.fetch.__vigiaSessao = true;
    }
    raizEl = document.getElementById('axa');
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-acao]');
      if (a) {
        var acao = a.getAttribute('data-acao');
        if (acao === 'sair') { e.preventDefault(); fecharGavetas(); sair(); return; }
        if (acao === 'busca') { abrirBusca(); return; }
        if (acao === 'mais') { abrirMais(); return; }
        if (acao === 'tema') { if (raiz.temaAlternar) raiz.temaAlternar(); desenhar(); return; }
        if (acao === 'ntf') { abrirNotificacoes(a); return; }
        if (acao === 'atualizar') { atualizarAgora(); return; }
        if (acao === 'depois') { avisaNovo(false); return; }
        if (acao === 'rascunho') {
          if (raiz.AXIS_FORM && raiz.AXIS_FORM.abrirRascunho) raiz.AXIS_FORM.abrirRascunho(a.getAttribute('data-alvo'));
          return;
        }
        // "+ Nova demanda": o formulario do app (axis-form-demanda.js).
        if (acao === 'novo') {
          if (raiz.AXIS_FORM && raiz.AXIS_FORM.abrir) raiz.AXIS_FORM.abrir(null);
          else toast('O formulário de demanda não carregou. Recarregue a página.', 'erro');
          return;
        }
      }
      if (!e.target.closest('.ntf, [data-acao="ntf"]')) { var n = document.querySelector('.ntf'); if (n) n.remove(); }
      var fa = e.target.closest('[data-fl-abrir]');
      if (fa) { var fl = fa.closest('.fl'); if (fl.classList.contains('aberto')) fecharFiltros(); else abrirFiltros(fl); return; }
      if (e.target.closest('[data-fl-fechar]')) { fecharFiltros(); return; }
      // <a href="admin.html" data-admin-aba="mes">: o admin abre na aba pedida.
      // Usa a mesma chave que o admin ja le ao carregar (`restoreLastTab`).
      var aa = e.target.closest('[data-admin-aba]');
      if (aa) { try { localStorage.setItem('rm_admin_tab', aa.getAttribute('data-admin-aba')); } catch (_) {} }
    });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K') && APP.D) { e.preventDefault(); abrirBusca(); }
    });
    document.addEventListener('keydown', tecladoGaveta, true);
    ligarGestoGaveta();
    window.addEventListener('hashchange', function () { fecharGavetas(); desenhar(); });
    // A releitura de 30 s e a da volta para a aba (`adminCheckUpdates`).
    setInterval(conferirServidor, RELEITURA_MS);
    setInterval(filaProcessa, FILA_INTERVALO);
    window.addEventListener('online', function () { filaProcessa(); });
    document.addEventListener('pointerdown', function () { _arrastando = true; }, true);
    ['pointerup', 'pointercancel'].forEach(function (t) { document.addEventListener(t, function () { _arrastando = false; }, true); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') conferirServidor(); });
    window.addEventListener('focus', conferirServidor);
    lerSessao();
    if (APP.token) iniciarApp(); else desenhar();
  }

  var H = {
    esc: esc, hoje: hoje, dm: dm, dma: dma, dataLonga: dataLonga, mesAno: mesAno, dias: dias, data: data, ehISO: ehISO,
    iniciais: iniciais, saudacao: saudacao, plural: plural, num: num, MESES: MESES, MESES_C: MESES_C,
    ETAPAS: ETAPAS, ETAPA_POR_ID: ETAPA_POR_ID, TIPOS: TIPOS,
    visiveis: visiveis, etapaDe: etapaDe, colunaDe: colunaDe, pausada: pausada, prazoDe: prazoDe, atrasoDe: atrasoDe,
    pontosDe: pontosDe, devsDe: devsDe, tema: tema, caminho: caminho, projeto: projeto, sprintAtual: sprintAtual,
    porCodigo: porCodigo, meusNomes: meusNomes, minha: minha, pode: pode, donoDaSprint: donoDaSprint, hidrata: hidrata,
    ico: ico, chip: chip, chipPausa: chipPausa, chipEtapa: chipEtapa, chipTipo: chipTipo, chipsReq: chipsReq, chipCasoUso: chipCasoUso, CASO_USO_COR: CASO_USO_COR, av: av, cod: cod, hrefItem: hrefItem,
    prazoTxt: prazoTxt, vazio: vazio, linkAdmin: linkAdmin, gravar: gravar, kpi: kpi, toast: toast, ir: ir, api: api, postar: postar, fila: { ler: filaLer, codifica: filaCodifica, decodifica: filaDecodifica, comFila: comFila, processa: filaProcessa }, recarregar: function () { return carregar().then(desenhar); },
    filtros: filtros, filtrosN: filtrosN, gaveta: gaveta, celula: celula, pintaFaixas: pintaFaixas, vincular: pedirVinculo
  };

  var AXIS_APP = { tela: tela, H: H, APP: APP, desenhar: desenhar, notificacoes: notificacoes, MENU: MENU, RODAPE: RODAPE, barraInferior: barraInferior, abrirBusca: abrirBusca, WORKER: WORKER,
                   pintaFaixas: pintaFaixas, vincular: pedirVinculo, sessaoExpirou: sessaoExpirou,
                   caiuASessao: caiuASessao, vigiaSessao: vigiaSessao, decisaoDaReleitura: decisaoDaReleitura, RELEITURA_MS: RELEITURA_MS };
  raiz.AXIS_APP = AXIS_APP;
  if (typeof document !== 'undefined' && document.getElementById) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar); else ligar();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = AXIS_APP;
})();
