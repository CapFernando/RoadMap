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
    rota: { tela: '', aba: '', param: '' }
  };

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
    ['rm_eu', 'rm_admin_token', 'rm_admin_pw', 'rm_dev_token', 'rm_dev_pw', 'rm_dev_authed'].forEach(function (k) {
      try { sessionStorage.removeItem(k); } catch (_) {}
    });
    lerSessao();
  }

  async function api(action, extra) {
    var corpo = Object.assign({ action: action }, APP.token ? { token: APP.token } : {}, extra || {});
    var r = await fetch(WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
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
    APP.D = j;
    APP.carregadoEm = Date.now();
    return j;
  }

  // ── Gravar (gravacao.js) ──────────────────────────────────────────────
  /* `gravar(patch, opts)`: patch = { id: { campo: valor } } (undefined apaga o
     campo); opts.raiz troca chaves do topo (temas, projetos, ausencias...);
     opts.ok = frase do aviso de sucesso. Le a base fresca, aplica, confere o
     pre-voo, envia por publish (admin) ou dev-publish (dev) e, gravando, rele
     a base e redesenha. Devolve o resultado do GRAVACAO.gravar. */
  var _gravando = Promise.resolve();
  function gravar(patch, opts) {
    var o = opts || {};
    // Uma gravacao por vez: duas acoes rapidas leriam a mesma base e a segunda
    // desfaria a primeira no servidor. A fila e a mesma ideia do saveViaProxy.
    var vez = _gravando.then(function () { return gravarAgora(patch, o); });
    _gravando = vez.catch(function () {});
    return vez;
  }
  async function gravarAgora(patch, o) {
    if (!raiz.GRAVACAO) throw new Error('gravacao.js nao carregado');
    if (['admin', 'analista', 'dev'].indexOf(APP.papel) < 0) { toast('Seu perfil é só de leitura.', 'erro'); return { ok: false }; }
    var r;
    try {
      r = await raiz.GRAVACAO.gravar({
        papel: APP.papel, patch: patch, raiz: o.raiz, semPrevoo: !!o.semPrevoo,
        credenciais: APP.token ? { token: APP.token } : {},
        ler: function () { return api('dados'); },
        enviar: async function (corpo, replacer) {
          var res = await fetch(WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify(corpo, replacer) });
          var j = await res.json().catch(function () { return {}; });
          return { status: res.status, corpo: j };
        }
      });
    } catch (e) {
      r = { ok: false, erro: 'Sem conexão com o servidor: ' + (e.message || e) };
    }
    if (r.ok) {
      APP.D = r.base;
      try { await carregar(); } catch (_) {}
      desenhar(true);
      if (o.ok !== false) toast(o.ok || 'Salvo.');
      var rs = r.resp || {};
      if ((rs.sem_dev || []).length) toast('Sem desenvolvedor, voltou para Backlog: ' + rs.sem_dev.join(', '), 'erro');
      if ((rs.comite_revertidas || []).length) toast('Validado em Comitê é de PM/PO ou liderança — revertido em: ' + rs.comite_revertidas.join(', '), 'erro');
    } else {
      var msg = r.status === 401 ? 'Sessão expirada — saia e entre de novo.' : (r.erro || 'Não foi possível salvar.');
      if (r.itens && r.itens.length > 1) msg += ' (e mais ' + (r.itens.length - 1) + ': ' + r.itens.slice(1).map(function (x) { return x.codigo; }).join(', ') + ')';
      toast(msg, 'erro');
    }
    return r;
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
  function chipEtapa(m) {
    var e = ETAPA_POR_ID[etapaDe(m)] || ETAPA_POR_ID[colunaDe(m)] || { rotulo: m.status_planejamento || '—', cor: 'bk' };
    var h = chip(esc(e.rotulo), e.cor);
    if (pausada(m)) h += ' ' + chip(ico('pause') + ' Pausada', 'mg');
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
  /** O editor de sempre, ja logado: admin.html e dev.html abrem o card pelo hash. */
  function hrefEditar(m) { return (APP.papel === 'admin' ? 'admin.html#' : 'dev.html#') + encodeURIComponent(m.codigo || ''); }
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
  /** Link para uma aba do admin (melhorias, kanban, temas, projetos, mes,
      gerencial, relatorios, usuarios), com o icone de "sai do app". */
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
      var href = it.href || ('#' + it.id);
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
    if (APP.papel === 'dev') {
      var minhas = vs.filter(minha);
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
      '<span class="kbd">Esc</span></div><div class="pal-res" id="pal-res"></div></div>';
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
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('.pal-it')) fecha(); });
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

  function desenharLogin(msg) {
    raizEl.innerHTML =
      '<div class="lg"><div class="lg-esq"><span class="axis-logo" role="img" aria-label="AXIS"></span>' +
      '<h1 class="lg-tit">Todas as demandas da tecnologia em um só eixo.</h1>' +
      '<p class="lg-sub">Backlog, sprints e projetos do time em um só lugar.</p>' + curvaLogin() + '</div>' +
      '<div class="lg-dir"><form class="lg-box" id="lg-form" autocomplete="on">' +
      '<span class="sb-mark" style="width:56px;height:56px;border-radius:16px"><img src="axis/marca/axis-leao-branco.png" alt="" style="width:36px"></span>' +
      '<h2 style="margin:6px 0 0;font-family:var(--font-title);font-size:26px;font-weight:800">Bem-vindo de volta</h2>' +
      '<span class="sub" style="margin-bottom:8px">Entre com a sua conta da Tecnologia.</span>' +
      '<label for="lg-usuario">Usuário ou e-mail</label><input class="in" id="lg-usuario" autocomplete="username" required>' +
      '<label for="lg-senha">Senha</label><input class="in" id="lg-senha" type="password" autocomplete="current-password" required>' +
      '<div class="lg-err" id="lg-err" role="alert">' + esc(msg || '') + '</div>' +
      '<button class="btnp" id="lg-btn" type="submit">Entrar</button>' +
      '<span class="note" style="text-align:center">Esqueceu a senha? Peça a troca em <a href="admin.html">Área administrativa</a> ou no <a href="dev.html">Meu painel</a>.</span>' +
      '</form></div></div>';
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
    setTimeout(function () { var u = raizEl.querySelector('#lg-usuario'); if (u) u.focus(); }, 0);
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
    if (!APP.token) { desenharLogin(); return; }
    if (!APP.D) {
      raizEl.innerHTML = '<div class="app"><nav class="sb" aria-label="Menu principal">' + htmlMenu('') + '</nav><main class="main">' +
        '<div class="sk" style="height:40px;width:420px;max-width:100%"></div><div class="sk" style="height:34px;width:260px"></div>' +
        '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">' + '<div class="sk" style="height:96px"></div>'.repeat(4) + '</div>' +
        '<div class="sk" style="height:320px"></div></main></div>';
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
    var ativoMenu = FORA_DO_MENU[r.tela] != null ? FORA_DO_MENU[r.tela] : r.tela;
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
    var novo = pode('gravar') ? '<button type="button" class="btnp" data-acao="novo">+ Nova demanda</button>' : '';
    raizEl.innerHTML =
      '<div class="app"><nav class="sb" aria-label="Menu principal">' + htmlMenu(ativoMenu) + '</nav>' +
      '<main class="main"><div class="topbar">' +
      '<button type="button" class="tb-search" data-acao="busca">' + ico('search') + '<span class="lbl">Buscar AX-, título, dev ou sistema</span><span class="kbd">Ctrl K</span></button>' +
      '<span style="flex:1"></span>' + novo +
      '<button type="button" class="tb-ico" data-acao="tema" aria-label="Alternar tema claro ou escuro" title="Tema claro ou escuro">' + ico(raiz.temaAtual && raiz.temaAtual() === 'claro' ? 'sun' : 'moon') + '</button>' +
      '<span style="position:relative"><button type="button" class="tb-ico" data-acao="ntf" aria-label="Notificações" aria-expanded="false">' + ico('bell') +
      (nN.length ? '<span class="dot">' + nN.length + '</span>' : '') + '</button></span>' +
      '<a href="#conta" class="tb-av" aria-label="Minha conta" style="background:var(--ac);color:var(--on-ac)">' + esc(iniciais((APP.eu || {}).nome || (APP.eu || {}).login || '')) + '</a>' +
      '</div>' + abasHtml + '<div class="view" id="vista"></div></main></div>';
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

  async function iniciarApp() {
    desenhar();
    try {
      await carregar();
      desenhar();
    } catch (e) {
      if (e.status === 401) { limparSessao(); desenharLogin('Sua sessão expirou. Entre de novo.'); return; }
      raizEl.querySelector('#vista, .main') && (raizEl.querySelector('.main').innerHTML =
        vazio('alert', 'Não foi possível ler os dados', String(e.message || e), '<button class="btnp" type="button" onclick="location.reload()">Tentar de novo</button>'));
    }
  }

  function ligar() {
    raizEl = document.getElementById('axa');
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-acao]');
      if (a) {
        var acao = a.getAttribute('data-acao');
        if (acao === 'sair') { e.preventDefault(); sair(); return; }
        if (acao === 'busca') { abrirBusca(); return; }
        if (acao === 'tema') { if (raiz.temaAlternar) raiz.temaAlternar(); desenhar(); return; }
        if (acao === 'ntf') { abrirNotificacoes(a); return; }
        // "+ Novo": o formulario do app (axis-form-demanda.js); sem ele, o de sempre.
        if (acao === 'novo') {
          if (raiz.AXIS_FORM && raiz.AXIS_FORM.abrir) raiz.AXIS_FORM.abrir(null);
          else location.href = APP.papel === 'admin' ? 'admin.html#novo' : 'dev.html#novo';
          return;
        }
      }
      if (!e.target.closest('.ntf, [data-acao="ntf"]')) { var n = document.querySelector('.ntf'); if (n) n.remove(); }
      // <a href="admin.html" data-admin-aba="mes">: o admin abre na aba pedida.
      // Usa a mesma chave que o admin ja le ao carregar (`restoreLastTab`).
      var aa = e.target.closest('[data-admin-aba]');
      if (aa) { try { localStorage.setItem('rm_admin_tab', aa.getAttribute('data-admin-aba')); } catch (_) {} }
    });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K') && APP.D) { e.preventDefault(); abrirBusca(); }
    });
    window.addEventListener('hashchange', function () { desenhar(); });
    // Volta a ler a base quando a aba volta ao foco depois de um minuto: quem
    // editou no admin e voltou ve a mudanca sem recarregar.
    window.addEventListener('focus', function () {
      if (APP.token && APP.D && Date.now() - APP.carregadoEm > 60000) carregar().then(desenhar).catch(function () {});
    });
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
    ico: ico, chip: chip, chipEtapa: chipEtapa, chipTipo: chipTipo, chipsReq: chipsReq, chipCasoUso: chipCasoUso, CASO_USO_COR: CASO_USO_COR, av: av, cod: cod, hrefItem: hrefItem, hrefEditar: hrefEditar,
    prazoTxt: prazoTxt, vazio: vazio, linkAdmin: linkAdmin, gravar: gravar, kpi: kpi, toast: toast, ir: ir, api: api, recarregar: function () { return carregar().then(desenhar); }
  };

  var AXIS_APP = { tela: tela, H: H, APP: APP, desenhar: desenhar, notificacoes: notificacoes, MENU: MENU, abrirBusca: abrirBusca, WORKER: WORKER };
  raiz.AXIS_APP = AXIS_APP;
  if (typeof document !== 'undefined' && document.getElementById) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar); else ligar();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = AXIS_APP;
})();
