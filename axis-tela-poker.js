/* ─────────────────────────────────────────────────────────────────────────
   AXIS — tela Planning Poker (axis.html#poker; prototipo EP-013: Poker.dc.html
   e PokerEntrar.dc.html).

   TRES ABAS: Sessoes (abrir a sala, a sala aberta agora e as votacoes ja
   feitas), Sala ao vivo (pauta, mesa, revelar, gravar, fila) e Resumo (o que
   uma votacao gravou nas demandas). O "Resultado" do prototipo nao e aba: e o
   estado revelado da propria sala, como sempre foi no poker.html.

   O SERVIDOR E O DE SEMPRE. Todas as acoes sao as rotas `poker-*` do Worker,
   com a sessao do app (`H.api` leva o token). Quem conduz (abrir, por em
   pauta, revelar, votar de novo, zerar, gravar, complementar, negar) e
   `H.pode('facilitar')` — admin e analista, o mesmo `facilitadorOk` do
   Worker. A sprint ao gravar e so do admin, como no poker.html; o Worker
   ignora o pedido de quem nao e. Quem vota entra na mesa com o nome
   (`poker-entrar`), o mesmo participante que o celular usa pelo QR.

   O QUE VEIO DO poker.html, E FICOU IGUAL DE PROPOSITO: o polling de
   `poker-estado` a cada 1,5 s (que e o sinal de vida de quem esta na mesa), o
   contador `mutSeq` que descarta resposta de polling anterior a uma acao, a
   carta guardada por sala e pauta ate revelar (`cartaMarcada`), o aviso
   `poker-ausente` ao sair (e nao `poker-sair`, que apagaria o voto), a fila
   pela posicao e o "gravar antes de avancar?". As chaves de sessionStorage
   (`pk_codigo`, `pk_participante`, `pk_nome`, `pk_voto`) sao as mesmas, como
   o nucleo faz com as `rm_*`.

   As regras vem dos modulos que o axis.html ja carrega: frente da demanda
   (pipelines.js), sprints do mes e rotulos (sprint.js), QR (qr.js), dialogos
   (dialogo.js) e entrega de anexo (anexo-tipos.js).

   O QUE O PROTOTIPO TEM E O ROADMAP NAO: nome da sessao, escolher a duracao,
   escolher os itens (a fila e a etapa Planning inteira), cronometro, contagem
   de rodadas e "Encerrar sala" (a sala expira sozinha em 2 h; o Worker nao
   tem rota de encerrar). As "Sessoes anteriores" e o Resumo sao lidos das
   demandas — o Worker grava em cada uma quem votou o que (`poker_votos`) e
   quando (`poker_votado_em`) —, agrupados pelo dia da votacao.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var raiz = typeof window !== 'undefined' ? window : globalThis;
  var A = raiz.AXIS_APP;
  if (!A) return;
  var H = A.H;
  var esc = H.esc, ico = H.ico, chip = H.chip;

  var POLL_MS = 1500;
  /* Copia de POKER_CARTAS (worker.js) SO para pintar o baralho antes de o
     estado chegar — o mesmo papel da lista em `renderCartas` do poker.html.
     Quem manda e o `cartas` que vem no estado. */
  var CARTAS_PADRAO = ['1', '2', '3', '5', '8', '12', '22', '?'];
  /* As cartas numericas do baralho, para sugerir a mais proxima da media
     (`FIBONACCI` do poker.html). */
  var NUMERICAS = [1, 2, 3, 5, 8, 12, 22];
  /* A escala para medir divergencia no historico, que foi votado tambem com o
     baralho antigo: 13 virou 12 e 21 virou 22 (comentario de POKER_CARTAS). */
  var ESCALA = [1, 2, 3, 5, 8, 12, 22, 34, 55, 89, 100];
  var FILA_MARCADAS = '__marcadas__';
  var TTL_H = 2; // POKER_TTL_H do Worker

  // ── Estado da tela (sobrevive aos redesenhos do nucleo) ────────────────
  function lerSS(k) { try { return sessionStorage.getItem(k) || ''; } catch (_) { return ''; } }
  function poeSS(k, v) { try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); } catch (_) {} }

  var S = {
    codigo: lerSS('pk_codigo').toUpperCase(),
    participante: lerSS('pk_participante'),
    nome: lerSS('pk_nome'),
    estado: null,
    fila: null,          // corpo do poker-fila
    filaVer: 0,
    filaErro: '',
    carregandoFila: false,
    meuVoto: '',
    mutSeq: 0,
    timer: null,
    pedindo: false,
    gravadoDe: '',
    filaFrente: '',
    valores: { media: '', pontos: '', sprint: '', tocado: false },
    refAberta: false,
    assin: {},
    reqCache: {},
    reqUrl: '',
    reqPdf: false
  };

  function facil() { return H.pode('facilitar'); }
  function emSala() { return !!(S.codigo && (S.participante || facil())); }
  function meuNome() {
    var e = A.APP.eu || {};
    return H.meusNomes()[0] || e.nome || e.login || '';
  }

  /* As chamadas devolvem { ok, status, body, erro } e nunca estouram — o
     mesmo contrato do `api` do poker.html, em cima do `H.api` do app. */
  function chama(action, extra) {
    return H.api(action, extra).then(function (j) { return { ok: true, status: 200, body: j || {} }; }, function (e) {
      return { ok: false, status: e.status || 0, body: {},
               erro: e.status ? (e.message || 'Falha no servidor.') : 'Sem conexão com o servidor de votação. Verifique a internet e tente de novo.' };
    });
  }

  // ── A carta escolhida, guardada ate revelar (copiado do poker.html) ────
  /* O servidor sabe QUE eu votei, mas nao O QUE ate revelar. Guardada com a
     sala e a pauta juntas: sem o par, a carta reapareceria marcada na demanda
     seguinte. Mesmas funcoes de poker.html (`_chaveVoto`, `votoGuardado`,
     `guardaVoto`, `cartaMarcada`), sobre a mesma chave `pk_voto`. */
  function chaveVoto(codigo, melhoria) { return String(codigo || '') + '|' + String(melhoria || ''); }
  function votoGuardado(codigo, melhoria) {
    try {
      var g = JSON.parse(sessionStorage.getItem('pk_voto') || 'null');
      return (g && g.k === chaveVoto(codigo, melhoria)) ? String(g.v || '') : '';
    } catch (_) { return ''; }
  }
  function guardaVoto(codigo, melhoria, valor) {
    try {
      if (!valor) sessionStorage.removeItem('pk_voto');
      else sessionStorage.setItem('pk_voto', JSON.stringify({ k: chaveVoto(codigo, melhoria), v: valor }));
    } catch (_) {}
  }
  function cartaMarcada(local, votou, codigo, melhoria) {
    if (!votou) return '';
    return local || votoGuardado(codigo, melhoria);
  }

  /* A carta mais proxima da media (`fibonacciMaisProximo` do poker.html). */
  function cartaSugerida(media) {
    var n = parseFloat(media);
    if (!isFinite(n) || n <= 0) return '';
    return String(NUMERICAS.reduce(function (a, b) { return Math.abs(b - n) < Math.abs(a - n) ? b : a; }));
  }
  function virgula(n) { return n == null || n === '' ? '—' : String(n).replace('.', ','); }

  // ── Sala: entrar, abrir, sair ──────────────────────────────────────────
  function esqueceSala() {
    ['pk_participante', 'pk_nome', 'pk_codigo', 'pk_facil', 'pk_voto'].forEach(function (k) { poeSS(k, ''); });
    S.codigo = ''; S.participante = ''; S.nome = ''; S.estado = null; S.meuVoto = '';
    S.fila = null; S.filaVer++; S.gravadoDe = ''; S.assin = {};
  }
  function trocaDeSala(codigo) {
    if (codigo === S.codigo) return;
    esqueceSala();
    S.codigo = codigo;
    poeSS('pk_codigo', codigo);
  }

  async function abrirSala() {
    if (!facil()) return;
    var r = await chama('poker-abrir', {});
    if (!r.ok) { H.toast(r.status === 401 ? 'Sua conta não conduz a votação.' : r.erro, 'erro'); return; }
    trocaDeSala(String(r.body.codigo || '').toUpperCase());
    iniciar();
    if (location.hash !== '#poker/sala') location.hash = '#poker/sala'; else A.desenhar(true);
    abrirConvite();
  }

  async function entrarNaSala(codigo, nome) {
    codigo = String(codigo || '').toUpperCase().trim();
    nome = String(nome || '').trim();
    if (!/^[A-Z0-9]{6}$/.test(codigo)) { H.toast('O código da sala tem 6 letras e números.', 'erro'); return false; }
    if (!nome) { H.toast('Informe seu nome.', 'erro'); return false; }
    var r = await chama('poker-entrar', { codigo: codigo, nome: nome });
    if (!r.ok) {
      H.toast(r.status === 404 ? 'Sala não encontrada. Confira o código.' : r.status === 410 ? 'Esta sala já expirou.' : r.erro, 'erro');
      return false;
    }
    trocaDeSala(codigo);
    S.participante = r.body.participante; S.nome = r.body.nome || nome;
    poeSS('pk_participante', S.participante); poeSS('pk_nome', S.nome);
    iniciar();
    if (location.hash !== '#poker/sala') location.hash = '#poker/sala'; else A.desenhar(true);
    return true;
  }

  /* Sair DE PROPOSITO: `poker-sair` tira o voto desta rodada (quem sai nao
     entra na media). Quem conduz sem votar so esquece a sala: ela continua
     aberta para o time ate expirar. */
  async function sairDaSala() {
    var msg = S.participante
      ? 'Você sai da mesa e o seu voto desta rodada deixa de contar.'
      : 'A sala continua aberta para o time até expirar. Para limpar a mesa, use "Zerar valores".';
    if (!(await raiz.confirmar({ titulo: 'Sair da sala ' + S.codigo, texto: msg, ok: 'Sair' }))) return;
    paraPolling();
    if (S.participante) await chama('poker-sair', { codigo: S.codigo, participante: S.participante });
    esqueceSala();
    location.hash = '#poker/sessoes';
  }

  /* Fechar a aba e recarregar disparam o mesmo `pagehide`: o aviso e
     `poker-ausente`, que so empurra para fora da janela de presenca e nao
     apaga o voto (ver o comentario de `avisarAusencia` no poker.html). Vale
     tambem para sair da rota #poker para outra tela do app. */
  function avisarAusencia() {
    if (!S.participante || !S.codigo) return;
    try {
      fetch(A.WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ action: 'poker-ausente', codigo: S.codigo, participante: S.participante }) }).catch(function () {});
    } catch (_) {}
  }

  // ── Polling (igual ao poker.html) ──────────────────────────────────────
  function naRota() { return /^#\/?poker(\/|$)/.test(location.hash || ''); }
  function ligaPolling() {
    if (S.timer || !S.codigo || !naRota()) return;
    S.timer = setInterval(function () { atualizar(false); }, POLL_MS);
  }
  function paraPolling() { if (S.timer) clearInterval(S.timer); S.timer = null; }

  function iniciar() {
    S.assin = {};
    carregarFila();
    atualizar(true);
    ligaPolling();
  }

  async function atualizar(forcar) {
    if (!S.codigo) return;
    if (S.pedindo && !forcar) return;   // a batida anterior ainda nao voltou
    S.pedindo = true;
    var seq = S.mutSeq;
    var r = await chama('poker-estado', { codigo: S.codigo, participante: S.participante || undefined });
    S.pedindo = false;
    if (r.status === 404 || r.status === 410) { salaMorreu(r.status); return; }
    if (seq !== S.mutSeq) return;      // resposta anterior a uma acao: descarta
    if (r.ok && r.body.estado) aplicar(r.body.estado);
  }

  function salaMorreu(status) {
    paraPolling();
    H.toast(status === 410 ? 'A sala expirou.' : 'Sala não encontrada.', 'erro');
    // A sala guardada morreu: apaga o registro, senao o F5 tentaria retoma-la em laco.
    esqueceSala();
    if (naRota()) A.desenhar(true);
  }

  function aplicar(est) {
    if (!est) return;
    var antes = S.estado;
    S.estado = est;
    var eu = S.participante ? (est.participantes || []).filter(function (p) { return p.id === S.participante; })[0] : null;
    S.meuVoto = cartaMarcada(S.meuVoto, !!(eu && eu.votou), est.codigo, est.melhoria_id);
    guardaVoto(est.codigo, est.melhoria_id, S.meuVoto);
    if (!est.revelado || !antes || antes.melhoria_id !== est.melhoria_id) S.valores.tocado = false;
    if (est.revelado && !S.valores.tocado) {
      S.valores.media = est.media != null ? String(est.media) : '';
      S.valores.pontos = cartaSugerida(est.media);
    }
    // A pauta pode ter mudado para uma demanda que a fila ainda nao trouxe.
    if (est.melhoria_id && S.fila && !acha(est.melhoria_id) && !S.carregandoFila) carregarFila();
    pintar();
  }

  // ── Fila (poker-fila: as demandas em Planning, a referencia, o ranking) ─
  async function carregarFila() {
    if (!S.codigo) return;
    S.carregandoFila = true;
    var r = await chama('poker-fila', { codigo: S.codigo });
    S.carregandoFila = false;
    if (!r.ok) { S.filaErro = r.erro; S.filaVer++; pintar(); return; }
    S.fila = r.body; S.filaErro = ''; S.filaVer++;
    pintar();
  }

  /* A base do app tambem muda quando a sala grava: rele em silencio, sem
     redesenhar a sala (o resumo e as sessoes leem dela). */
  function releBase() {
    H.api('dados').then(H.hidrata).then(function (j) { A.APP.D = j; A.APP.carregadoEm = Date.now(); }).catch(function () {});
  }

  function filaMelhorias() { return (S.fila && S.fila.melhorias) || []; }
  function acha(id) { return filaMelhorias().filter(function (m) { return m.id === id; })[0] || null; }
  function demandaEmPauta() { return S.estado && S.estado.melhoria_id ? acha(S.estado.melhoria_id) : null; }
  function frenteDe(m) { return raiz.PIPELINES ? raiz.PIPELINES.daDemanda(m, (S.fila && S.fila.devs_perfil) || {}) : ''; }
  function nomeTema(id) {
    var t = ((S.fila && S.fila.temas) || []).filter(function (x) { return x.id === id; })[0];
    return t ? t.nome : H.tema(id);
  }

  /* O QUE JA FOI VOTADO SAI DA FILA (03/11/2026) — COPIA DE `pkNaFila`
     (poker.html). Votada = tem `poker_votado_em`; fica so se a data, no fuso
     de Sao Paulo, for a de hoje. Pontos sem data de votacao (postos a mao)
     tambem contam como ja estimados. A demanda EM PAUTA nunca sai. */
  function pkHoje() {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  }
  function pkDiaDaVotacao(m) {
    var s = String((m && m.poker_votado_em) || '');
    if (!s) return '';
    var d = new Date(s);
    return isNaN(d) ? s.slice(0, 10) : d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  }
  function pkJaVotadaAntes(m) {
    var dia = pkDiaDaVotacao(m);
    if (dia) return dia !== pkHoje();
    return !!m && m.poker_pontos != null;
  }
  function pkNaFila(m, atual) {
    return (m.status_planejamento || '') === 'planning' && (m.id === atual || !pkJaVotadaAntes(m));
  }

  /* A fila da Planning com a estrelada no topo e o indice original como
     desempate; a demanda em pauta nunca sai pelo filtro de frente. Mesma regra
     de `filaPlanning` do poker.html. */
  function filaPlanning() {
    var atual = S.estado ? S.estado.melhoria_id : '';
    return filaMelhorias()
      .filter(function (m) { return pkNaFila(m, atual); })
      .filter(function (m) {
        return !S.filaFrente || m.id === atual ||
          (S.filaFrente === FILA_MARCADAS ? !!m.dados_bi : frenteDe(m) === S.filaFrente);
      })
      .map(function (m, i) { return { m: m, i: i }; })
      .sort(function (a, b) { return (b.m.destaque ? 1 : 0) - (a.m.destaque ? 1 : 0) || a.i - b.i; })
      .map(function (x) { return x.m; });
  }
  function proximoDaFila() {
    var fila = filaPlanning(), atual = S.estado ? S.estado.melhoria_id : '';
    var idx = fila.findIndex(function (m) { return m.id === atual; });
    return idx >= 0 ? fila[idx + 1] : fila[0];
  }
  function restantes() {
    var fila = filaPlanning(), atual = S.estado ? S.estado.melhoria_id : '';
    var idx = fila.findIndex(function (m) { return m.id === atual; });
    return idx >= 0 ? fila.length - idx - 1 : fila.length;
  }

  // ── Acoes da mesa ──────────────────────────────────────────────────────
  async function votar(valor) {
    if (!S.participante) { H.toast('Entre na mesa com o seu nome para votar.', 'erro'); return; }
    S.mutSeq++;
    var r = await chama('poker-votar', { codigo: S.codigo, participante: S.participante, valor: valor });
    if (!r.ok) {
      if (r.status === 403) {
        // O participante saiu da sala (faxina de 2 h ou Sair em outra aba).
        S.participante = ''; poeSS('pk_participante', ''); S.assin = {};
        H.toast('Você não está mais na mesa. Entre de novo com o seu nome.', 'erro');
        A.desenhar(true);
      } else H.toast(r.erro || 'Não foi possível votar.', 'erro');
      return;
    }
    S.meuVoto = valor;
    // Guarda ANTES do proximo estado: entre o voto e o polling cabe um F5.
    guardaVoto(S.codigo, S.estado && S.estado.melhoria_id, valor);
    pintar();
    await atualizar(true);
  }

  async function acaoFacil(action, extra, msgErro) {
    if (!facil()) return null;
    S.mutSeq++;
    var r = await chama(action, Object.assign({ codigo: S.codigo }, extra || {}));
    if (!r.ok) { H.toast(r.status === 401 ? 'Ação de quem conduz: sua conta não pode.' : (r.erro || msgErro), 'erro'); return null; }
    return r;
  }
  async function revelar() {
    var r = await acaoFacil('poker-revelar', {}, 'Falha ao revelar.');
    if (r) aplicar(r.body.estado);
  }
  async function revotar() {
    var r = await acaoFacil('poker-revotar', {}, 'Falha ao reiniciar.');
    if (r) { S.meuVoto = ''; aplicar(r.body.estado); }
  }
  async function zerar() {
    if (!(await raiz.confirmar({ titulo: 'Zerar a sala', texto: 'Sai da pauta atual, esconde o resultado e apaga os votos desta sessão.', ok: 'Zerar', perigo: true }))) return;
    var r = await acaoFacil('poker-zerar', {}, 'Falha ao zerar.');
    if (r) { S.meuVoto = ''; S.valores.tocado = false; aplicar(r.body.estado); H.toast('Sala zerada.'); }
  }
  async function porEmPauta(id) {
    var r = await acaoFacil('poker-demanda', { melhoria_id: id }, 'Falha ao trocar a demanda.');
    if (r) { S.meuVoto = ''; aplicar(r.body.estado); }
    return !!r;
  }

  /* Avancar depois de revelar sem gravar levaria o resultado embora: os votos
     ficam na sala (que expira) e nada chega a demanda. Os dois caminhos ficam
     nomeados nos botoes (`proximaDemanda` do poker.html). */
  async function proximaDemanda() {
    var atual = S.estado && S.estado.melhoria_id;
    if (atual && S.estado.revelado && S.gravadoDe !== atual) {
      var m = acha(atual);
      var quer = await raiz.confirmar({
        titulo: 'Gravar o resultado antes de avançar?',
        texto: 'A votação de ' + ((m && (m.codigo || m.titulo)) || 'esta demanda') + ' foi revelada e ainda NÃO foi gravada no card ' +
               '(média ' + virgula(S.valores.media) + ' · ' + (S.valores.pontos || '—') + ' pontos). Se avançar sem gravar, o resultado desta rodada se perde.',
        ok: 'Gravar e avançar', cancelar: 'Avançar sem gravar' });
      if (quer && !(await gravarNoCard())) return;
    }
    var prox = proximoDaFila();
    if (prox) await porEmPauta(prox.id);
    else if (await porEmPauta('')) H.toast('Fila esgotada — pauta limpa.');
  }

  /* As sprints do mes corrente e do seguinte, menos as fechadas — a lista do
     Admin pelo sprint.js, com os feriados que vem do Worker junto da fila
     (`montaSprintDaMesa` do poker.html). So para admin. */
  function opcoesSprint() {
    var SP = raiz.SPRINTPO;
    // So o DONO da sprint escolhe a sprint na mesa (`pkDonoDaSprint`, poker.html).
    if (!SP || !H.donoDaSprint()) return null;
    var fer = (S.fila && S.fila.feriados) || [], fechadas = (S.fila && S.fila.sprints_fechadas) || [];
    var hoje = H.hoje(), ano = +hoje.slice(0, 4), mes = +hoje.slice(5, 7);
    var agora = SP.rotuloDeData(hoje, fer);
    var ops = [];
    [[ano, mes], mes === 12 ? [ano + 1, 1] : [ano, mes + 1]].forEach(function (am) {
      SP.sprintsDoMes(am[0], am[1], fer).forEach(function (s) {
        if (fechadas.indexOf(s.rotulo) < 0) ops.push({ v: s.rotulo, t: SP.rotuloCurto(s.rotulo) + (s.rotulo === agora ? ' · agora' : '') });
      });
    });
    return ops;
  }

  async function gravarNoCard() {
    if (!S.estado || !S.estado.melhoria_id) { H.toast('Nenhuma demanda em votação.', 'erro'); return false; }
    var b = document.getElementById('pk-gravar');
    if (b) { b.disabled = true; b.textContent = 'Gravando…'; }
    var sprint = H.donoDaSprint() ? S.valores.sprint : '';
    var id = S.estado.melhoria_id;
    var r = await chama('poker-gravar', { codigo: S.codigo, melhoria_id: id, poker_media: S.valores.media,
                                          poker_pontos: S.valores.pontos, sprint_po: sprint });
    if (b) { b.disabled = false; b.textContent = rotuloGravar(); }
    if (!r.ok) { H.toast(r.erro || 'Falha ao gravar.', 'erro'); return false; }
    S.gravadoDe = id;
    var c = r.body;
    H.toast('Gravado no card: média ' + virgula(c.poker_media) + ' · ' + c.poker_pontos + ' pontos' +
            (c.sprint_po && raiz.SPRINTPO ? ' · ' + raiz.SPRINTPO.rotuloCurto(c.sprint_po) : ''));
    // A recusa da sprint tem voz propria: a gravacao pode ter dado certo pela metade.
    if (c.sprint_recusa) setTimeout(function () { H.toast(c.sprint_recusa, 'erro'); }, 400);
    S.assin.grava = null;
    carregarFila();
    releBase();
    return true;
  }

  async function negar() {
    var m = demandaEmPauta();
    if (!m) { H.toast('Escolha uma demanda antes.', 'erro'); return; }
    var motivo = await raiz.pedirTexto({ titulo: 'Negar ' + (m.codigo || m.titulo),
      texto: 'Por que a demanda não vai ser feita? Quem pediu vai ler este texto.',
      multilinha: true, obrigatorio: true, ok: 'Negar', perigo: true });
    if (motivo === null) return;
    if (!String(motivo).trim()) { H.toast('O motivo é obrigatório: sem ele a mesma ideia volta igual em um mês.', 'erro'); return; }
    var r = await acaoFacil('poker-negar', { melhoria_id: m.id, motivo: String(motivo).trim() }, 'Falha ao negar.');
    if (!r) return;
    H.toast('Demanda negada e retirada da pauta.');
    if (r.body.estado) aplicar(r.body.estado);
    carregarFila();
    releBase();
  }

  /* Complementar na reuniao: o Worker ACRESCENTA o texto datado no fim da
     descricao e junta os anexos (`poker-editar`). Os arquivos sobem antes,
     um a um, pelo `anexo-subir`, como no poker.html. */
  function abrirComplemento() {
    var m = demandaEmPauta();
    if (!m) { H.toast('Escolha uma demanda antes.', 'erro'); return; }
    var anexos = [];
    var ov = document.createElement('div');
    ov.className = 'ovl';
    ov.innerHTML = '<section class="dlg" role="dialog" aria-modal="true" aria-label="Complementar a demanda" style="max-width:560px">' +
      '<button type="button" class="dlg-x" data-x aria-label="Fechar">✕</button>' +
      '<h2 class="h2" style="font-size:19px">Complementar a demanda</h2>' +
      '<span class="sub">' + esc((m.codigo ? m.codigo + ' · ' : '') + (m.titulo || '')) + '</span>' +
      '<span class="note">O texto entra datado no fim da descrição, com o seu nome. A descrição de quem pediu não é alterada.</span>' +
      '<textarea class="in pk-ta" id="pk-compl-txt" rows="5" placeholder="Onde exatamente, qual tela, qual regra… o que ficou claro na reunião"></textarea>' +
      '<label class="note" style="display:flex;flex-direction:column;gap:6px">Anexos (até 1,5 MB cada)' +
      '<input type="file" id="pk-compl-file" multiple data-anexo-accept></label>' +
      '<div id="pk-compl-lista" class="note"></div>' +
      '<div class="pk-erro" id="pk-compl-erro" role="alert"></div>' +
      '<div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-x>Cancelar</button>' +
      '<button type="button" class="btnp" id="pk-compl-ok">Salvar na demanda</button></div></section>';
    document.body.appendChild(ov);
    if (raiz.ANEXOTIPO && raiz.ANEXOTIPO.ligaSeletores) raiz.ANEXOTIPO.ligaSeletores(ov);
    var fecha = function () { ov.remove(); };
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-x]')) fecha(); });
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') fecha(); });
    var inp = ov.querySelector('#pk-compl-file'), lista = ov.querySelector('#pk-compl-lista'), err = ov.querySelector('#pk-compl-erro');
    inp.addEventListener('change', async function () {
      var arqs = Array.prototype.slice.call(inp.files);
      for (var i = 0; i < arqs.length; i++) {
        var arq = arqs[i];
        if (raiz.ANEXOTIPO && !raiz.ANEXOTIPO.permitido(arq.name)) { H.toast(raiz.ANEXOTIPO.recusa(arq.name), 'erro'); continue; }
        if (arq.size > 1.5 * 1024 * 1024) { H.toast('"' + arq.name + '" passa de 1,5 MB e não foi anexado.', 'erro'); continue; }
        var dados = await new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsDataURL(arq); });
        var r = await chama('anexo-subir', { nome: arq.name, dados: dados });
        if (!r.ok) { H.toast('Falha ao enviar "' + arq.name + '": ' + r.erro, 'erro'); continue; }
        anexos.push({ nome: arq.name, chave: r.body.chave, tipo: arq.type, tamanho: arq.size });
        lista.innerHTML = anexos.map(function (a) { return ico('clip') + ' ' + esc(a.nome); }).join('<br>');
      }
      inp.value = '';
    });
    var ok = ov.querySelector('#pk-compl-ok');
    ok.addEventListener('click', async function () {
      var txt = ov.querySelector('#pk-compl-txt').value.trim();
      if (!txt && !anexos.length) { err.textContent = 'Escreva o complemento ou anexe um arquivo.'; return; }
      ok.disabled = true; ok.textContent = 'Salvando…';
      var r = await chama('poker-editar', { codigo: S.codigo, melhoria_id: m.id, complemento: txt, anexos_add: anexos });
      ok.disabled = false; ok.textContent = 'Salvar na demanda';
      if (!r.ok) { err.textContent = r.erro || 'Falha ao salvar.'; return; }
      fecha();
      H.toast('Complemento salvo na demanda.');
      carregarFila();
      releBase();
    });
    setTimeout(function () { var t = ov.querySelector('#pk-compl-txt'); if (t) t.focus(); }, 30);
  }

  // ── Convite (QR gerado localmente, qr.js) ──────────────────────────────
  /* O link do convite e o do poker.html: quem esta no celular entra so com o
     nome, sem conta. Quem tem conta tambem entra por aqui, com o codigo. */
  function linkConvite() {
    return location.origin + location.pathname.replace(/[^\/]*$/, '') + 'poker.html?s=' + encodeURIComponent(S.codigo);
  }
  function copiar(txt, ok, titulo) {
    var fallback = function () { if (raiz.pedirTexto) raiz.pedirTexto({ titulo: titulo, valor: txt, ok: 'Fechar' }); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { H.toast(ok); }, fallback);
    else fallback();
  }
  function abrirConvite() {
    if (!S.codigo) return;
    var svg = raiz.QR && raiz.QR.qrSVG ? raiz.QR.qrSVG(linkConvite(), 200) : null;
    var est = S.estado || { participantes: [] };
    var on = (est.participantes || []).filter(function (p) { return p.online !== false; });
    var ov = document.createElement('div');
    ov.className = 'ovl';
    ov.innerHTML = '<section class="dlg" role="dialog" aria-modal="true" aria-label="Convidar o time" style="max-width:460px">' +
      '<button type="button" class="dlg-x" data-x aria-label="Fechar">✕</button>' +
      '<h2 class="h2" style="font-size:19px">Convidar o time</h2>' +
      '<span class="sub">Compartilhe o link ou o código da sala. Pelo link, entra só com o nome, sem senha.</span>' +
      (svg ? '<div class="pk-qr">' + svg + '</div><span class="note" style="text-align:center">Aponte a câmera do celular</span>'
           : '<span class="note" style="text-align:center">Sem QR para este link — use o código abaixo.</span>') +
      '<div class="in" style="justify-content:space-between"><span class="mono ell" style="font-size:12px;color:var(--tx2)">' + esc(linkConvite()) + '</span></div>' +
      '<div class="row"><button type="button" class="btn" style="flex:1" data-cp="link">Copiar link</button><button type="button" class="btn" style="flex:1" data-cp="cod">Copiar código</button></div>' +
      '<div class="pk-codbox"><span class="lab">CÓDIGO DA SALA</span><span class="mono">' + esc(S.codigo) + '</span></div>' +
      '<span class="note">Na sala agora: ' + H.plural(on.length, 'pessoa', 'pessoas') + '. Quem tem conta também entra em Planning Poker › Sala ao vivo, com o código.</span>' +
      '<button type="button" class="btnp" data-x>Fechar</button></section>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.closest('[data-x]')) { ov.remove(); return; }
      var c = e.target.closest('[data-cp]');
      if (c) { if (c.getAttribute('data-cp') === 'link') copiar(linkConvite(), 'Link copiado.', 'Copie o link'); else copiar(S.codigo, 'Código copiado.', 'Código da sala'); }
    });
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') ov.remove(); });
  }

  // ── Referencia da carta (vem pronta do Worker na fila) ─────────────────
  function linhaRef(c) { return (((S.fila && S.fila.referencia) || {}).linhas || []).filter(function (x) { return x.carta === String(c); })[0] || null; }
  function refFirme(l) { return (l.n || 0) >= 7; }
  function refDias(d) { return d == null ? '—' : d === 1 ? '1 dia' : String(d).replace('.', ',') + ' dias'; }
  function refCurta(c) {
    if (String(c) === '?') return 'dúvida';
    var l = linhaRef(c);
    if (!l || l.dias == null) return '—';
    return (refFirme(l) ? '' : '~') + String(l.dias).replace('.', ',') + ' d';
  }
  /* O texto do hover de uma carta (`refDaCarta` do poker.html). */
  function refDaCarta(c) {
    if (String(c) === '?') return 'Não sei estimar — não entra na média da rodada.';
    var l = linhaRef(c);
    if (!l) return 'Sem entrega concluída com esta carta ainda.';
    if (l.dias == null) return 'Esta carta ainda não tem entrega com data de início e de entrega — não há prazo típico para mostrar.';
    var uteis = l.dias === 1 ? '1 dia útil' : refDias(l.dias) + ' úteis';
    return 'Costuma levar ' + uteis + ', do início à entrega — ' + l.n + (l.n === 1 ? ' entrega' : ' entregas') + (refFirme(l) ? '' : ', ainda poucos casos') + '.';
  }

  // ── Requisito e anexos da pauta ────────────────────────────────────────
  /* MESMA REGRA do `ehRequisito` do poker.html (e do `pokerEhRequisito` do
     Worker, conferidas lado a lado pelas invariantes): AX-###.PNG/JPG/WEBP/
     GIF/PDF e o requisito da demanda, e a sala o mostra na pauta. */
  function ehRequisito(a, m) {
    if (!a || a.inline || !a.chave) return false;
    var nome = String(a.nome || '');
    if (!/\.(png|jpe?g|webp|gif|pdf)$/i.test(nome)) return false;
    var cod = String((m || {}).codigo || '').trim().toUpperCase();
    var doNome = (nome.match(/^\s*(AX-\d+)/i) || [])[1];
    if (!doNome) return false;
    return !cod || doNome.toUpperCase() === cod;
  }
  async function baixar(chave) {
    var res = await fetch(A.WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'anexo-baixar', chave: chave, token: A.APP.token }) });
    if (!res.ok) { var e = new Error('HTTP ' + res.status); e.status = res.status; throw e; }
    return res.blob();
  }
  async function carregaRequisito(a) {
    var q = document.getElementById('pk-req');
    if (!q || !a) return;
    var pdf = /\.pdf$/i.test(String(a.nome || ''));
    var mostra = function (url) {
      if (!q.isConnected) return;
      q.innerHTML = pdf
        ? '<iframe class="pk-req-pdf" title="Requisito ' + esc(a.nome) + '" src="' + url + '"></iframe>'
        : '<img class="pk-req-img" alt="Requisito ' + esc(a.nome) + '" title="Clique para ver maior" data-pk="ampliar" src="' + url + '">';
      S.reqUrl = url; S.reqPdf = pdf;
    };
    var recado = function (st) {
      if (q.isConnected) q.innerHTML = '<span class="note">' + (st === 401 || st === 403 ? 'Sua conta não tem permissão para ver o requisito.'
        : st === 404 ? 'O arquivo do requisito não está no armazenamento de anexos.' : 'Não foi possível carregar o requisito.') + '</span>';
    };
    var c = S.reqCache[a.chave];
    // A falha tambem fica guardada: a pauta se redesenha, e sem isto o mesmo
    // arquivo ausente seria pedido de novo a cada redesenho.
    if (c) { if (c.url) mostra(c.url); else recado(c.erro); return; }
    try {
      var url = URL.createObjectURL(await baixar(a.chave));
      S.reqCache[a.chave] = { url: url };
      mostra(url);
    } catch (e) {
      if (e.status) S.reqCache[a.chave] = { erro: e.status };
      recado(e.status);
    }
  }
  /* Ampliar sem sair da sala: a lupa fica por cima e sai com clique fora ou Esc. */
  function ampliar() {
    if (!S.reqUrl) { H.toast('O requisito ainda está carregando.'); return; }
    var ov = document.createElement('div');
    ov.className = 'ovl pk-lupa';
    ov.innerHTML = S.reqPdf ? '<iframe title="Requisito ampliado" src="' + S.reqUrl + '"></iframe>' : '<img alt="Requisito ampliado" src="' + S.reqUrl + '">';
    var fecha = function () { ov.remove(); document.removeEventListener('keydown', esc1); };
    var esc1 = function (e) { if (e.key === 'Escape') fecha(); };
    ov.addEventListener('click', function (e) { if (e.target.tagName === 'IMG') { ov.classList.toggle('real'); return; } fecha(); });
    document.addEventListener('keydown', esc1);
    document.body.appendChild(ov);
  }
  async function abrirAnexo(i) {
    var m = demandaEmPauta();
    var a = m && (m.anexos || [])[i];
    if (!a || !a.chave) { H.toast('Anexo sem referência para abrir.', 'erro'); return; }
    try {
      var blob = await baixar(a.chave);
      raiz.ANEXOTIPO.entrega(blob, a.nome || 'anexo', a.tipo || blob.type, raiz);
    } catch (e) {
      H.toast(e.status === 401 || e.status === 403 ? 'Sua conta não tem permissão para abrir o anexo.' : 'Não foi possível abrir o anexo.', 'erro');
    }
  }

  /* O discovery na mesa: as perguntas do dash sao o que se discute para
     estimar. Rotulos e ordem iguais aos do `discoveryHTML` do poker.html. */
  function discovery(m) {
    var d = m && m.discovery;
    if (!d || typeof d !== 'object') return '';
    var L = [];
    var por = function (rot, val) { if (val) L.push('<div><b>' + rot + ':</b> ' + esc(val) + '</div>'); };
    if (d.tipo) por('Tipo', d.tipo === 'ganho' ? 'Ganho de produtividade' : 'Correção/Ajuste');
    por('Área do solicitante', d.area_solicitante);
    por('Local da implementação', d.local_implementacao);
    if (Array.isArray(d.documentos_afetados) && d.documentos_afetados.length) por('Documentos afetados', d.documentos_afetados.join(', ') + (d.documentos_obs ? ' — ' + d.documentos_obs : ''));
    por('Impacto', d.impacto);
    por('Beneficiários', d.beneficiarios);
    if (d.ganho) {
      var det = [];
      if (d.ganho.horas_dia) det.push(d.ganho.horas_dia + 'h/dia por pessoa');
      if (d.ganho.pessoas) det.push(d.ganho.pessoas + ' pessoa(s)');
      por('Ganho', [d.ganho.resumo || '', det.length ? '(' + det.join(' × ') + ')' : ''].filter(Boolean).join(' '));
    }
    if (d.contexto) { por('Como funciona hoje', d.contexto.as_is); por('Dor real', d.contexto.dor); por('Se não fizer', d.contexto.nao_fazer); }
    (d.requisitos_funcionais || []).forEach(function (r, i) { if (r && r.desc) por('RF-' + String(i + 1).padStart(2, '0'), r.desc + (r.prio ? ' (' + r.prio + ')' : '')); });
    (d.regras_negocio || []).forEach(function (r, i) { if (r && r.regra) por('RN-' + String(i + 1).padStart(2, '0'), r.regra + (r.fonte ? ' — ' + r.fonte : '')); });
    if (d.escopo) { por('Dentro do escopo', d.escopo.dentro); por('Fora do escopo', d.escopo.fora); por('Premissas', d.escopo.premissas); }
    (d.criterios_aceite || []).forEach(function (c, i) {
      if (c && (c.dado || c.quando || c.entao)) por('CA-' + String(i + 1).padStart(2, '0'), 'Dado ' + (c.dado || '…') + ', quando ' + (c.quando || '…') + ', então ' + (c.entao || '…'));
    });
    return L.length ? '<details class="pk-disc"><summary>Discovery — preenchido por quem pediu</summary>' + L.join('') + '</details>' : '';
  }

  function chipFrente(m) {
    var f = frenteDe(m);
    if (!f || !raiz.PIPELINES) return '';
    var c = raiz.PIPELINES.cor(f);
    return '<span class="chip" style="background:#' + c + '22;color:#' + c + ';box-shadow:inset 0 0 0 1px #' + c + '55">' + esc(f) + '</span>';
  }
  function chipTipoFila(m) {
    var t = H.TIPOS[m.tipo];
    return t ? chip(ico(t.ico) + ' ' + t.rotulo, 'bk') : '';
  }

  // ── Pintura da sala (por partes, so o que mudou) ───────────────────────
  /* O polling chega a cada 1,5 s. Redesenhar tudo tirava a rolagem de quem le
     a descricao e o tooltip de quem esta com o mouse numa carta — por isso
     cada parte so se redesenha quando a sua assinatura muda (`_detAssin` e
     `_mesaAssin` do poker.html). */
  function parte(id, assin, html) {
    var el = document.getElementById(id);
    if (!el) return null;
    if (S.assin[id] === assin && el.innerHTML) return null;
    S.assin[id] = assin;
    el.innerHTML = html();
    return el;
  }

  function pintar() {
    pintarAberta();
    if (!document.getElementById('pk-sala')) return;
    var est = S.estado;
    var f = facil();
    parte('pk-cab', JSON.stringify([S.codigo, f, S.nome, S.participante]), function () {
      return '<span class="in pk-sala-cod">SALA <b class="mono">' + esc(S.codigo) + '</b></span>' +
        '<span class="note">' + (f ? 'você conduz' + (S.participante ? ' e vota como ' + esc(S.nome) : '') : 'você vota como ' + esc(S.nome)) +
        ' · a sala expira ' + TTL_H + ' h depois de aberta</span>';
    });
    parte('pk-rank', String(S.filaVer), htmlRanking);
    parte('pk-fila', JSON.stringify([S.filaVer, est && est.melhoria_id, S.filaFrente, f]), htmlFila);
    if (!est) return;
    var m = demandaEmPauta();
    var pauta = parte('pk-pauta', JSON.stringify([est.melhoria_id, f, S.filaVer, est.revelado]), function () { return htmlPauta(m); });
    if (pauta && m) {
      var a = (m.anexos || []).filter(function (x) { return ehRequisito(x, m); })[0];
      S.reqUrl = '';
      if (a) carregaRequisito(a);
    }
    var ps = (est.participantes || []).map(function (p) { return [p.id, p.nome, p.votou, p.online, p.valor]; });
    parte('pk-votos', JSON.stringify([est.revelado, est.melhoria_id, est.total_votos, est.media, ps, S.participante, f, restantes()]), htmlVotos);
    var g = document.getElementById('pk-grava');
    if (g) g.style.display = f && est.revelado && est.melhoria_id ? '' : 'none';
    parte('pk-grava', JSON.stringify([est.melhoria_id, est.revelado, est.media, S.gravadoDe === est.melhoria_id, restantes(), S.filaVer]), htmlGrava);
    var travado = !est.melhoria_id || est.revelado || !S.participante;
    parte('pk-deck', JSON.stringify([est.cartas, S.meuVoto, travado, S.participante, est.revelado, est.melhoria_id, S.refAberta, S.filaVer]), htmlDeck);
    parte('pk-gente', JSON.stringify([ps, S.participante, est.revelado]), htmlGente);
  }

  function htmlRanking() {
    var rk = S.fila && S.fila.ranking, devs = (rk && rk.devs) || [];
    if (!devs.length) return '';
    /* Primeiro nome, com a inicial do sobrenome quando dois compartilham o
       primeiro (`rkNomeCurto` do poker.html): ha dois "Joao" na base. */
    var curto = function (nome) {
      var p = String(nome || '').trim().split(/\s+/), pri = p[0] || nome;
      var rep = devs.filter(function (o) { return String(o.nome || '').trim().split(/\s+/)[0] === pri; }).length > 1;
      return rep && p[1] ? pri + ' ' + p[1][0] + '.' : pri;
    };
    var sem = rk.semanas && rk.semanas.atual;
    var parcial = sem && sem.uteisCorridos < sem.uteisTotal;
    return '<span class="lab" title="Pela data em que o dev entregou. A contagem não mede tamanho: os pontos estão no título de cada nome.">ENTREGAS DA SEMANA</span>' +
      devs.map(function (d) {
        var v = d.atual.entregas - d.anterior.entregas;
        var dl = v > 0 ? '<i style="color:var(--ok-t)">▲' + v + '</i>' : v < 0 ? '<i style="color:var(--dg-t)">▼' + (-v) + '</i>' : '<i style="color:var(--tx4)">=</i>';
        return '<span class="chip c-bk pk-rk' + (d.atual.entregas ? '' : ' zero') + '" title="' + esc(d.nome + ' — ' + d.atual.entregas + ' nesta semana (' + d.atual.pontos + ' pts), ' +
          d.anterior.entregas + ' na anterior (' + d.anterior.pontos + ' pts), ' + d.emMaos + ' em mãos') + '">' + esc(curto(d.nome)) +
          ' <b>' + d.atual.entregas + '</b>' + dl + '</span>';
      }).join('') +
      (parcial ? '<span class="note" style="font-size:11.5px">semana correndo: ' + sem.uteisCorridos + ' de ' + sem.uteisTotal + ' dias úteis</span>' : '');
  }

  function htmlPauta(m) {
    var est = S.estado, f = facil();
    if (!est.melhoria_id) {
      return '<span class="labo">SEM DEMANDA EM PAUTA</span><h2 class="h2" style="font-size:19px">' +
        (f ? 'Escolha um item na fila para abrir a votação' : 'Aguardando quem conduz escolher a demanda') + '</h2>' +
        '<span class="note">' + (f ? 'A fila ao lado é a etapa Planning, com as estreladas primeiro. "Próxima demanda" anda por ela na ordem.' : 'As cartas liberam assim que a pauta abrir.') + '</span>';
    }
    if (!m) return '<span class="labo">EM VOTAÇÃO</span><div class="sk" style="height:28px;width:60%"></div><div class="sk" style="height:60px"></div>';
    var noApp = m.codigo ? H.porCodigo(m.codigo) : null;
    var linha = function (rot, val) { return val ? '<span><span class="pk-rot">' + rot + '</span>' + esc(val) + '</span>' : ''; };
    var anexos = m.anexos || [];
    var iReq = anexos.findIndex(function (a) { return ehRequisito(a, m); });
    var outros = anexos.map(function (a, i) { return { a: a, i: i }; }).filter(function (x) { return x.i !== iReq; });
    return '<div class="row" style="justify-content:space-between"><span class="labo">' + (est.revelado ? 'VOTAÇÃO REVELADA' : 'EM VOTAÇÃO') + '</span>' +
        (m.destaque ? '<span class="chip c-wn" title="Prioridade para estimativa">' + ico('star') + ' prioridade</span>' : '') + '</div>' +
      '<div class="row" style="align-items:baseline;flex-wrap:wrap;gap:6px 10px">' + (m.codigo ? '<span class="code" style="font-size:13px">' + esc(m.codigo) + '</span>' : '') +
        '<h2 class="h2" style="font-size:21px;line-height:27px">' + esc(m.titulo || '(sem título)') + '</h2></div>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap">' + chipTipoFila(m) + chipFrente(m) +
        (m.dados_bi ? chip(ico('chart') + ' Dados/BI', 'in') : '') +
        (nomeTema(m.tema_id) ? chip(esc(H.caminho(m.tema_id) || nomeTema(m.tema_id)), 'bk') : '') +
        (m.poker_pontos != null ? chip(ico('cards') + ' ' + esc(m.poker_pontos) + ' pts gravados', 'ok') : '') +
        (noApp ? '<a href="' + H.hrefItem(noApp) + '" style="font-size:12px">abrir item</a>' : '') + '</div>' +
      '<div class="pk-meta">' + linha('Solicitante', m.solicitante) + linha('Responsável', m.dev) + linha('Prazo', m.entrega ? H.dma(m.entrega) : '') + '</div>' +
      (m.descricao ? '<div class="pk-desc">' + esc(m.descricao) + '</div>'
                   : '<span class="note" style="color:var(--wn-t)">Sem descrição — vale perguntar ao solicitante antes de estimar.</span>') +
      (iReq >= 0 ? '<div class="pk-reqbox"><div class="row" style="justify-content:space-between"><span class="pk-rot">Requisito</span>' +
          '<button type="button" class="btns" data-pk="ampliar" title="Ver maior, sem sair da sala">⤢ ' + esc(anexos[iReq].nome) + '</button></div>' +
          '<div id="pk-req" class="pk-req"><span class="note">carregando o requisito…</span></div></div>' : '') +
      discovery(m) +
      (outros.length ? '<div class="row" style="gap:6px;flex-wrap:wrap"><span class="pk-rot">Anexos</span>' + outros.map(function (x) {
          return x.a.inline ? '<span class="chip c-bk" title="Anexo antigo, guardado dentro do arquivo: abra pelo Admin">' + ico('clip') + ' ' + esc(x.a.nome) + '</span>'
            : '<button type="button" class="btns" data-pk="anexo" data-i="' + x.i + '">' + ico('clip') + ' ' + esc(x.a.nome) + (x.a.tamanho ? ' <small>(' + Math.round(x.a.tamanho / 1024) + ' KB)</small>' : '') + '</button>';
        }).join('') + '</div>' : '') +
      (f ? '<div class="row" style="gap:8px;flex-wrap:wrap;margin-top:2px"><button type="button" class="btns" data-pk="complementar">' + ico('edit') + ' Complementar</button>' +
           '<button type="button" class="btns pk-perigo" data-pk="negar">' + ico('ban') + ' Negar com motivo</button></div>' : '');
  }

  function face(p, est) {
    var eu = p.id === S.participante;
    if (est.revelado) {
      if (p.valor == null) return { cls: 'vazia', txt: '—' };
      return { cls: eu ? 'eu' : 'rev', txt: esc(p.valor) };
    }
    if (p.votou) return eu && S.meuVoto ? { cls: 'eu', txt: esc(S.meuVoto) } : { cls: 'ok', txt: '✓' };
    return { cls: 'esp', txt: '…' };
  }

  function htmlVotos() {
    var est = S.estado, f = facil();
    var ps = est.participantes || [];
    var head = '<div class="row" style="justify-content:space-between;flex-wrap:wrap"><span style="font-size:13px;font-weight:700">' + (est.revelado ? 'Votos revelados' : 'Votos') + '</span>' +
      '<span class="note">' + est.total_votos + ' de ' + ps.length + ' votaram' + (est.revelado ? '' : ' · os valores aparecem só na revelação') + '</span></div>';
    var mesa = ps.length ? '<div class="pk-mesa">' + ps.map(function (p) {
      var fc = face(p, est), off = p.online === false;
      return '<div class="pk-seat' + (off ? ' off' : '') + '" title="' + esc(p.nome + (off ? ' — desconectado' : '')) + '">' +
        '<span class="pk-carta ' + fc.cls + '">' + fc.txt + '</span><span class="pk-nome">' + (off ? ico('alert') + ' ' : '') + esc(p.nome) + (p.id === S.participante ? ' (você)' : '') + '</span></div>';
    }).join('') + '</div>'
      : H.vazio('users', 'Ninguém na mesa ainda', 'Convide o time pelo código ' + S.codigo + '.');
    var res = '';
    if (est.revelado) {
      var nums = ps.filter(function (p) { return p.valor != null && isFinite(parseFloat(p.valor)); }).map(function (p) { return { n: parseFloat(p.valor), nome: p.nome }; });
      var ord = nums.map(function (x) { return x.n; }).sort(function (a, b) { return a - b; });
      var mediana = ord.length ? (ord.length % 2 ? ord[(ord.length - 1) / 2] : (ord[ord.length / 2 - 1] + ord[ord.length / 2]) / 2) : null;
      var div = '—', dv = false;
      if (nums.length > 1) {
        var lo = nums.reduce(function (a, b) { return b.n < a.n ? b : a; }), hi = nums.reduce(function (a, b) { return b.n > a.n ? b : a; });
        dv = passos(lo.n, hi.n) >= 2;
        div = lo.n === hi.n ? 'todos iguais' : dv ? esc(lo.nome) + ' (' + lo.n + ') e ' + esc(hi.nome) + ' (' + hi.n + ') explicam' : 'cartas vizinhas';
      }
      var sug = cartaSugerida(est.media);
      res = '<div class="pk-k4">' +
        '<div class="pk-k"><span>Média</span><b>' + virgula(est.media) + '</b></div>' +
        '<div class="pk-k"><span>Carta sugerida</span><b style="color:var(--ac-t)">' + (sug || '—') + '</b></div>' +
        '<div class="pk-k"><span>Mediana</span><b>' + (mediana == null ? '—' : virgula(Math.round(mediana * 10) / 10)) + '</b></div>' +
        '<div class="pk-k' + (dv ? ' wn' : '') + '"><span>Divergência</span><em>' + div + '</em></div></div>' +
        (nums.length < ps.filter(function (p) { return p.valor != null; }).length ? '<span class="note">"?" não entra na média.</span>' : '');
    }
    var ctl = '';
    if (f && !est.revelado) {
      var rs = restantes();
      ctl = '<div class="row" style="justify-content:center;gap:10px;flex-wrap:wrap">' +
        '<button type="button" class="btnp" data-pk="revelar"' + (!est.melhoria_id || !est.total_votos ? ' disabled' : '') + '>' + ico('eye') + ' Revelar agora</button>' +
        '<button type="button" class="btn" data-pk="revotar"' + (!est.melhoria_id ? ' disabled' : '') + '>' + ico('refresh') + ' Votar de novo</button>' +
        '<button type="button" class="btn" data-pk="zerar" title="Sai da pauta, esconde o resultado e apaga os votos da sala">' + ico('trash') + ' Zerar valores</button>' +
        '<button type="button" class="btn" data-pk="proxima">' + (rs > 0 ? 'Próxima demanda (' + rs + ') →' : est.melhoria_id ? 'Encerrar rodada' : 'Começar pela fila →') + '</button></div>';
    }
    return head + mesa + res + ctl;
  }

  /* Distancia em degraus de baralho entre duas cartas (13 e 21 do baralho
     antigo leem como 12 e 22). */
  function degrau(n) {
    var v = n === 13 ? 12 : n === 21 ? 22 : n;
    var i = ESCALA.findIndex(function (x) { return x >= v; });
    return i < 0 ? ESCALA.length - 1 : i;
  }
  function passos(a, b) { return Math.abs(degrau(b) - degrau(a)); }

  function rotuloGravar() { return S.valores.pontos ? 'Gravar ' + S.valores.pontos + ' pontos' : 'Gravar no card'; }

  function htmlGrava() {
    var est = S.estado;
    if (!est || !est.revelado || !est.melhoria_id || !facil()) return '';
    var cartas = (est.cartas || CARTAS_PADRAO).filter(function (c) { return isFinite(parseFloat(c)); });
    if (S.valores.pontos && cartas.indexOf(S.valores.pontos) < 0) cartas.push(S.valores.pontos);
    var sp = opcoesSprint();
    if (sp && sp.every(function (o) { return o.v !== S.valores.sprint; })) S.valores.sprint = '';
    var gravado = S.gravadoDe === est.melhoria_id, rs = restantes();
    return '<div class="row" style="justify-content:space-between;flex-wrap:wrap"><span class="lab">GRAVAR NO CARD</span>' +
        (gravado ? chip(ico('check') + ' gravado nesta rodada', 'ok') : '<span class="note">a média e a carta vêm da revelação; dá para ajustar antes</span>') + '</div>' +
      '<div class="pk-campos">' +
        '<label><span class="note">Média</span><input class="in" type="number" step="0.1" min="0" data-pkv="media" value="' + esc(S.valores.media) + '"></label>' +
        '<label><span class="note">Pontos</span><select class="in" data-pkv="pontos"><option value="">—</option>' + cartas.map(function (c) {
          return '<option value="' + esc(c) + '"' + (c === S.valores.pontos ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
        (sp ? '<label><span class="note">Repassar para a sprint</span><select class="in" data-pkv="sprint"><option value="">— não repassar —</option>' + sp.map(function (o) {
          return '<option value="' + esc(o.v) + '"' + (o.v === S.valores.sprint ? ' selected' : '') + '>' + esc(o.t) + '</option>'; }).join('') + '</select></label>' : '') +
      '</div>' +
      '<div class="row" style="gap:10px;flex-wrap:wrap">' +
        '<button type="button" class="btnp" id="pk-gravar" data-pk="gravar">' + esc(rotuloGravar()) + '</button>' +
        '<button type="button" class="btn" data-pk="revotar">' + ico('refresh') + ' Votar de novo</button>' +
        '<button type="button" class="btn" data-pk="proxima">' + (rs > 0 ? 'Próxima demanda (' + rs + ') →' : 'Encerrar rodada') + '</button>' +
        '<button type="button" class="btn pk-perigo" data-pk="negar">' + ico('ban') + ' Negar com motivo</button>' +
        '<button type="button" class="btns" data-pk="zerar" style="margin-left:auto">' + ico('trash') + ' Zerar valores</button></div>';
  }

  function htmlDeck() {
    var est = S.estado;
    if (!S.participante) {
      return '<div class="row" style="justify-content:space-between;flex-wrap:wrap"><span class="lab">SEU VOTO</span>' +
        '<button type="button" class="btn" data-pk="votar-tambem">' + ico('cards') + ' Votar também como ' + esc(meuNome()) + '</button></div>' +
        '<span class="note">Você está conduzindo sem votar, como no Poker de sempre. Entrando na mesa, o seu voto conta na média.</span>';
    }
    var cartas = (est && est.cartas) || CARTAS_PADRAO;
    var travado = !est || est.revelado || !est.melhoria_id;
    var titulo = !est || !est.melhoria_id ? 'Aguardando a demanda entrar em pauta' : est.revelado ? 'Votação encerrada nesta rodada'
      : S.meuVoto ? 'Seu voto: ' + S.meuVoto + ' (pode trocar até revelar)' : 'Escolha sua carta';
    var ref = (S.fila && S.fila.referencia) || null;
    var tab = '';
    if (S.refAberta && ref && ref.linhas && ref.linhas.length) {
      tab = '<table class="tbl" style="max-width:520px"><thead><tr><th>CARTA</th><th>PRAZO TÍPICO</th><th class="num">ENTREGAS</th></tr></thead><tbody>' +
        ref.linhas.map(function (l) {
          return '<tr' + (refFirme(l) ? '' : ' style="opacity:.7"') + '><td><b>' + esc(l.carta) + '</b></td><td>' + esc(refDias(l.dias)) + '</td><td class="num">' + (l.n || 0) +
            (refFirme(l) ? '' : ' ' + chip('poucos casos', 'wn')) + '</td></tr>';
        }).join('') + '</tbody></table>' +
        '<span class="note">Dias úteis do início à entrega, pela mediana. Base de ' + (ref.total || 0) + ' entregas, refeita a cada rodada. As horas saíram desta referência: o campo é preenchido com critérios diferentes por pessoa.</span>';
    }
    return '<div class="row" style="justify-content:space-between;flex-wrap:wrap"><span class="lab">SEU VOTO</span><span class="note">' + esc(titulo) + '</span></div>' +
      '<div class="pk-deck">' + cartas.map(function (c) {
        return '<button type="button" class="pk-dc' + (S.meuVoto === c ? ' sel' : '') + '" data-pk="votar" data-v="' + esc(c) + '"' + (travado ? ' disabled' : '') +
          ' title="' + esc(refDaCarta(c)) + '"><b>' + esc(c) + '</b><span>' + esc(refCurta(c)) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="row" style="justify-content:space-between;flex-wrap:wrap"><span class="note" style="font-size:12px">A linha de baixo é o prazo que a carta costuma custar (dias úteis, mediana). "~" = poucos casos. Acima de 22: quebrar o item.</span>' +
      (ref && ref.linhas && ref.linhas.length ? '<button type="button" class="link" data-pk="ref" style="font-size:12.5px">' + (S.refAberta ? 'ocultar a tabela' : 'ver a tabela') + '</button>' : '') + '</div>' + tab;
  }

  function htmlGente() {
    var est = S.estado, ps = est.participantes || [];
    var on = ps.filter(function (p) { return p.online !== false; }).length;
    return '<div class="row" style="justify-content:space-between"><span class="lab">NA SALA</span><span class="note">' + on + ' online</span></div>' +
      (ps.length ? ps.map(function (p) {
        var off = p.online === false;
        var st = off ? 'desconectado' : est.revelado ? (p.valor != null ? 'votou ' + p.valor : 'não votou') : p.votou ? 'votou' : 'pensando';
        return '<div class="pk-pessoa"><span class="dotc" style="background:' + (off ? 'var(--tx4)' : 'var(--ok)') + '"></span><span class="ell" style="flex:1">' + esc(p.nome) +
          (p.id === S.participante ? ' <span class="note">(você)</span>' : '') + '</span><span class="note" style="font-size:11.5px">' + esc(st) + '</span></div>';
      }).join('') : '<span class="note">Ninguém ainda.</span>') +
      (facil() ? '<span class="note" style="font-size:12px">Quem fecha a aba fica esmaecido e o voto continua contando; quem clica em Sair tira o voto.</span>' : '');
  }

  function htmlFila() {
    if (S.filaErro && !S.fila) return '<span class="lab">FILA · PLANNING</span><span class="note" style="color:var(--dg-t)">Falha ao carregar a fila: ' + esc(S.filaErro) + '</span>';
    if (!S.fila) return '<span class="lab">FILA · PLANNING</span><div class="sk" style="height:54px"></div><div class="sk" style="height:54px"></div>';
    var emPauta = S.estado ? S.estado.melhoria_id : '';
    var naPlanning = filaMelhorias().filter(function (m) { return pkNaFila(m, emPauta); });
    // As ja votadas em outro dia nao aparecem; a contagem diz quantas sairam.
    var votadasAntes = filaMelhorias().filter(function (m) { return (m.status_planejamento || '') === 'planning' && !pkNaFila(m, emPauta); }).length;
    var conta = {};
    naPlanning.forEach(function (m) { var fr = frenteDe(m); conta[fr] = (conta[fr] || 0) + 1; });
    var marcadas = naPlanning.filter(function (m) { return m.dados_bi; }).length;
    // A frente escolhida pode ter esvaziado entre duas leituras: volta para todas.
    if (S.filaFrente && !(S.filaFrente === FILA_MARCADAS ? marcadas : conta[S.filaFrente])) S.filaFrente = '';
    var nomes = raiz.PIPELINES ? raiz.PIPELINES.nomes.filter(function (n) { return conta[n]; }) : [];
    var lista = filaPlanning(), atual = S.estado ? S.estado.melhoria_id : '', f = facil();
    var sel = '<select class="in" data-pkf style="height:32px;font-size:12.5px"><option value="">Todas as frentes (' + naPlanning.length + ')</option>' +
      (marcadas ? '<option value="' + FILA_MARCADAS + '"' + (S.filaFrente === FILA_MARCADAS ? ' selected' : '') + '>Dados/BI — marcadas (' + marcadas + ')</option>' : '') +
      nomes.map(function (n) { return '<option value="' + esc(n) + '"' + (S.filaFrente === n ? ' selected' : '') + '>' + esc(n) + ' (' + conta[n] + ')</option>'; }).join('') + '</select>';
    var itens = lista.length ? lista.map(function (m) {
      var on = m.id === atual;
      return '<' + (f ? 'button type="button" data-pk="pauta" data-id="' + esc(m.id) + '" title="Clique para votar esta demanda"' : 'div') + ' class="pk-fi' + (on ? ' on' : '') + (m.destaque ? ' star' : '') + '">' +
        '<span class="row" style="justify-content:space-between;gap:6px"><span class="code" style="font-size:11px">' + (m.destaque ? ico('star') + ' ' : '') + esc(m.codigo || '—') + '</span>' +
        '<span class="mono" style="font-size:11px;color:' + (m.poker_pontos != null ? 'var(--ok-t)' : 'var(--tx4)') + '">' + (m.poker_pontos != null ? esc(m.poker_pontos) + ' pts' : on ? 'votando' : '—') + '</span></span>' +
        '<span class="pk-ft">' + esc(m.titulo || '(sem título)') + '</span>' +
        '<span class="note ell" style="font-size:11.5px">' + esc([frenteDe(m), m.dev].filter(Boolean).join(' · ')) + '</span></' + (f ? 'button' : 'div') + '>';
    }).join('') : '<span class="note">' + (S.filaFrente ? 'Nenhuma demanda desta frente na fila.' : 'Nenhuma demanda na etapa Planning. Mova cards para Planning no Quadro.') + '</span>';
    return '<div class="row" style="justify-content:space-between"><span class="lab" style="color:var(--pu-t)">FILA · PLANNING</span><span class="note">' +
      (S.filaFrente ? lista.length + ' de ' + naPlanning.length : H.plural(lista.length, 'item', 'itens')) + '</span></div>' + sel +
      (votadasAntes ? '<span class="note" style="font-size:12px">' + H.plural(votadasAntes, 'já votada antes de hoje fica', 'já votadas antes de hoje ficam') + ' fora da lista.</span>' : '') +
      '<div class="pk-fl">' + itens + '</div>';
  }

  // ── "Sala aberta agora" (aba Sessoes) ──────────────────────────────────
  function pintarAberta() {
    var est = S.estado;
    var ps = est ? (est.participantes || []).filter(function (p) { return p.online !== false; }).length : null;
    var naPl = filaMelhorias().filter(function (m) { return m.status_planejamento === 'planning'; });
    var pont = naPl.filter(function (m) { return m.poker_pontos != null; }).length;
    parte('pk-aberta', JSON.stringify([S.codigo, ps, pont, naPl.length, est && est.melhoria_id]), function () {
      if (!S.codigo) return '';
      var m = demandaEmPauta();
      return '<div class="row" style="justify-content:space-between"><span class="row"><span class="dotc" style="background:var(--ok)"></span><b style="font-size:14px">Sala aberta agora</b></span>' +
        '<span class="mono" style="font-size:15px;color:var(--ok-t);letter-spacing:.1em">' + esc(S.codigo) + '</span></div>' +
        '<span class="note">' + (ps == null ? 'conectando…' : H.plural(ps, 'pessoa', 'pessoas') + ' online') + (S.fila ? ' · ' + pont + ' de ' + naPl.length + ' itens da Planning com pontos' : '') +
        (m ? ' · em pauta: ' + esc(m.codigo || m.titulo) : '') + ' · expira ' + TTL_H + ' h depois de aberta</span>' +
        '<div class="row">' + (emSala() ? '<a href="#poker/sala" class="btnp" style="flex:1;justify-content:center">Voltar para a sala</a>'
                                        : '<a href="#poker/sala" class="btnp" style="flex:1;justify-content:center">Entrar para votar</a>') +
        (facil() ? '<button type="button" class="btn" data-pk="convidar">Convidar</button>' : '') + '</div>';
    });
    var box = document.getElementById('pk-aberta');
    if (box) box.style.display = S.codigo ? '' : 'none';
  }

  // ── Historico lido das demandas ────────────────────────────────────────
  /* Uma "sessao anterior" e o dia em que demandas receberam votos na sala:
     `poker_votado_em` (ISO, quando gravou) e `poker_votos` (quem votou o que)
     sao gravados pelo `poker-gravar`. O dia e o local, nao o UTC. */
  function diaLocal(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function sessoesDaBase() {
    var por = {};
    ((A.APP.D || {}).melhorias || []).forEach(function (m) {
      if (!m || !m.poker_votado_em || !Array.isArray(m.poker_votos) || !m.poker_votos.length) return;
      var k = diaLocal(m.poker_votado_em);
      if (!k) return;
      (por[k] = por[k] || []).push(m);
    });
    return Object.keys(por).sort().reverse().map(function (k) {
      var its = por[k].sort(function (a, b) { return String(a.poker_votado_em).localeCompare(String(b.poker_votado_em)); });
      var quem = {}, fac = {}, pts = 0, unan = 0, div = 0;
      its.forEach(function (m) {
        pts += Number(m.poker_pontos) || 0;
        if (m.poker_validado_por) fac[m.poker_validado_por] = 1;
        var ns = m.poker_votos.map(function (v) { quem[v.nome] = 1; return parseFloat(v.voto); }).filter(isFinite);
        if (ns.length > 1) {
          var lo = Math.min.apply(null, ns), hi = Math.max.apply(null, ns);
          if (lo === hi) unan++; else if (passos(lo, hi) >= 2) div++;
        } else if (ns.length === 1) unan++;
      });
      var ini = new Date(its[0].poker_votado_em), fim = new Date(its[its.length - 1].poker_votado_em);
      return { dia: k, itens: its, pontos: pts, pessoas: Object.keys(quem), facil: Object.keys(fac), unanimes: unan, divergentes: div,
               duracao: Math.round((fim - ini) / 60000) };
    });
  }
  function duracaoTxt(min) { return min < 1 ? '' : min < 60 ? min + ' min' : Math.floor(min / 60) + ' h ' + String(min % 60).padStart(2, '0'); }

  // ── Abas ───────────────────────────────────────────────────────────────
  function cabecalho(sub, acoes) {
    return '<header class="pk-hd"><div style="display:flex;flex-direction:column;gap:6px;min-width:0"><h1 class="h1">Planning Poker</h1>' +
      '<span class="sub">' + sub + '</span></div><div class="row" style="flex-wrap:wrap">' + (acoes || '') + '</div></header>';
  }

  function painelEntrar(codigo) {
    var nomes = {};
    Object.keys((A.APP.D || {}).devs_perfil || {}).forEach(function (n) { nomes[n] = 1; });
    ((A.APP.D || {}).desenvolvedores || []).forEach(function (d) { var n = typeof d === 'string' ? d : d && d.nome; if (n) nomes[n] = 1; });
    var nome = S.nome || meuNome();
    return '<section class="pnh pk-entrar"><span class="labo">ENTRAR PARA VOTAR</span>' +
      '<span class="note">Quem vota entra com o nome. O código está no convite de quem conduz (6 letras e números).</span>' +
      '<form id="pk-form-entrar" class="pk-campos" autocomplete="off">' +
        '<label><span class="note">Código da sala</span><input class="in mono pk-cod" id="pk-in-cod" maxlength="6" placeholder="ABC234" value="' + esc(codigo || '') + '" required></label>' +
        '<label><span class="note">Seu nome</span><input class="in" id="pk-in-nome" maxlength="40" list="pk-nomes" value="' + esc(nome) + '" required></label>' +
        '<datalist id="pk-nomes">' + Object.keys(nomes).sort().map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>' +
        '<button class="btnp" type="submit" style="align-self:end">Entrar na sala</button></form>' +
      '<span class="note" style="font-size:12px">O nome aparece na mesa e fica gravado no card junto com o voto. Use o mesmo nome das demandas.</span></section>';
  }

  function renderSessoes() {
    var f = facil();
    var D = A.APP.D || {};
    var naPl = H.visiveis().filter(function (m) { return H.colunaDe(m) === 'planning'; })
      .map(function (m, i) { return { m: m, i: i }; })
      .sort(function (a, b) { return (b.m.destaque ? 1 : 0) - (a.m.destaque ? 1 : 0) || a.i - b.i; }).map(function (x) { return x.m; });
    var semPts = naPl.filter(function (m) { return !H.pontosDe(m); }).length;
    var esq;
    if (f) {
      var eu = A.APP.eu || {};
      esq = '<section class="pnh" style="gap:14px"><div class="row" style="justify-content:space-between"><span class="labo">' + (S.codigo ? 'SALA' : 'NOVA SALA') + '</span>' +
          '<span class="note">quem conduz: ' + esc(eu.nome || eu.login || '') + '</span></div>' +
        '<span class="note">Baralho</span><div class="row" style="gap:6px;flex-wrap:wrap">' + ((S.estado && S.estado.cartas) || CARTAS_PADRAO).map(function (c) {
          return '<span class="pk-mini" title="' + esc(refDaCarta(c)) + '"><b>' + esc(c) + '</b><span>' + esc(S.fila ? refCurta(c) : String(c) === '?' ? 'dúvida' : '') + '</span></span>';
        }).join('') + '</div>' +
        '<span class="note" style="font-size:12px">' + (S.fila ? 'A linha de baixo é o prazo que cada carta costuma custar, calculado das entregas do time.' : 'O prazo típico de cada carta aparece quando a sala abre: ele vem do servidor junto com a fila.') + '</span>' +
        '<div class="row" style="justify-content:space-between"><span class="note">Itens da sessão</span><span class="note">' + H.plural(naPl.length, 'demanda', 'demandas') + ' em Planning · ' + semPts + ' sem pontos</span></div>' +
        '<div class="pk-pick">' + (naPl.length ? naPl.slice(0, 12).map(function (m) {
          var p = H.pontosDe(m);
          return '<a class="pk-pk" href="' + H.hrefItem(m) + '">' + H.cod(m) + '<span class="ell" style="flex:1">' + (m.destaque ? ico('star', 'style="color:var(--wn-t)"') + ' ' : '') + esc(m.titulo) + '</span>' +
            (p ? chip(p + ' pts', 'ok') : chip('sem pontos', 'wn')) + '</a>';
        }).join('') + (naPl.length > 12 ? '<span class="note">+ ' + (naPl.length - 12) + ' na fila</span>' : '')
          : H.vazio('cards', 'Nada em Planning', 'A fila da sala é a etapa Planning. Mova cards para lá no Quadro.')) + '</div>' +
        '<span class="note" style="font-size:12px">A sala usa a etapa Planning inteira, com as estreladas primeiro. Para tirar ou pôr um item, mova o card no Quadro.</span>' +
        '<div class="row" style="justify-content:flex-end">' + (S.codigo ? '<a href="#poker/sala" class="btnp">Voltar para a sala</a>' : '<button type="button" class="btnp" data-pk="abrir">Abrir sala e gerar QR</button>') + '</div></section>';
    } else {
      esq = painelEntrar(S.codigo);
    }
    var ses = sessoesDaBase();
    var ult = ses.slice(0, 5);
    var hist = '<section class="pn"><div class="row" style="justify-content:space-between"><h2 class="h2">Sessões anteriores</h2><span class="note">dias com votos gravados</span></div>' +
      (ult.length ? ult.map(function (s) {
        return '<a class="pk-ses" href="#poker/resumo/' + s.dia + '"><span class="row" style="justify-content:space-between"><b>Votação de ' + H.dm(s.dia) + '</b>' +
          '<span class="note" style="font-size:11.5px">' + esc(H.dataLonga(s.dia).split(',')[0]) + (duracaoTxt(s.duracao) ? ' · ' + duracaoTxt(s.duracao) : '') + '</span></span>' +
          '<span class="note" style="font-size:12px">' + H.plural(s.itens.length, 'item', 'itens') + ' · ' + s.pontos + ' pontos · ' + H.plural(s.pessoas.length, 'pessoa', 'pessoas') +
          (s.facil.length ? ' · ' + esc(s.facil.join(', ')) : '') + '</span></a>';
      }).join('') : '<span class="note">Nenhuma votação gravada ainda.</span>') + '</section>';
    var base = ses.slice(0, 6), tot = 0, un = 0, dv = 0;
    base.forEach(function (s) { tot += s.itens.length; un += s.unanimes; dv += s.divergentes; });
    var pct = function (n) { return tot ? Math.round(n / tot * 100) + '%' : '—'; };
    var cons = '<section class="pn"><h2 class="h2">Consenso nas últimas sessões</h2>' +
      '<div class="pk-k3"><div class="k"><span class="kl">Unânimes</span><span class="kv" style="font-size:22px;color:var(--ok-t)">' + pct(un) + '</span></div>' +
      '<div class="k"><span class="kl">Cartas vizinhas</span><span class="kv" style="font-size:22px">' + pct(tot - un - dv) + '</span></div>' +
      '<div class="k"><span class="kl">Divergentes</span><span class="kv" style="font-size:22px;color:var(--wn-t)">' + pct(dv) + '</span></div></div>' +
      '<span class="note" style="font-size:12px">' + H.plural(tot, 'item', 'itens') + ' das últimas ' + base.length + ' sessões. Divergente = duas cartas ou mais de distância entre o menor e o maior voto. A contagem de rodadas não é guardada: só a última vai para o card.</span></section>';
    var ac = '<a href="#poker/sala" class="btn">' + (emSala() ? 'Voltar para a sala' : 'Entrar com código') + '</a>' + (f && !S.codigo ? '<button type="button" class="btnp" data-pk="abrir">+ Abrir sala</button>' : '');
    return cabecalho('Abra uma sala para a planning, escolha os itens da fila e convide o time. Quem só vota entra com o nome.', ac) +
      '<div class="pk-2">' + esq + '<div style="display:flex;flex-direction:column;gap:16px;min-width:0"><section class="pn" id="pk-aberta" style="border-color:rgba(var(--ok-rgb),.4)"></section>' + hist + cons + '</div></div>';
  }

  function renderSala(ctx) {
    var cod = String(ctx.param || '').toUpperCase();
    if (!emSala()) {
      var f = facil();
      return cabecalho('Quem vota entra com o nome e o código da sala.' + (f ? ' Quem conduz pode abrir a sala daqui.' : ''),
          f ? '<button type="button" class="btnp" data-pk="abrir">+ Abrir sala</button>' : '') +
        '<div class="pk-2">' + painelEntrar(/^[A-Z0-9]{6}$/.test(cod) ? cod : S.codigo) +
        '<section class="pn"><h2 class="h2">Como funciona</h2><span class="note">Quem conduz abre a sala e põe uma demanda da etapa Planning em pauta. Cada um escolhe a carta em segredo; ' +
        'na revelação aparecem a média, a carta sugerida e quem divergiu. Os pontos e os votos vão para o card.</span>' +
        '<span class="note">Pelo celular, sem conta: use o QR ou o link do convite.</span></section></div>';
    }
    return '<div id="pk-sala" class="view" style="gap:16px"><header class="pk-hd"><div class="row" style="gap:14px;flex-wrap:wrap;min-width:0"><h1 class="h1">Planning Poker</h1><span class="row" id="pk-cab" style="gap:12px;flex-wrap:wrap"></span></div>' +
      '<div class="row" style="flex-wrap:wrap">' + (facil() ? '<button type="button" class="btn" data-pk="convidar">' + ico('link') + ' Convidar com QR</button>' : '') +
      '<button type="button" class="btn" data-pk="sair">' + ico('logout') + ' Sair da sala</button></div></header>' +
      '<div class="pk-rank" id="pk-rank"></div>' +
      '<div class="pk-g"><div style="display:flex;flex-direction:column;gap:16px;min-width:0">' +
        '<section class="pnh" id="pk-pauta" style="gap:10px"></section>' +
        '<section class="pn" id="pk-votos" style="gap:16px"></section>' +
        '<section class="pn" id="pk-grava" style="gap:12px;display:none;border-color:rgba(var(--ac-rgb),.35)"></section>' +
        '<section class="pn" id="pk-deck" style="gap:12px"></section></div>' +
      '<aside style="display:flex;flex-direction:column;gap:16px;min-width:0"><section class="pn" id="pk-gente" style="gap:8px"></section>' +
        '<section class="pn" id="pk-fila" style="gap:8px"></section></aside></div></div>';
  }

  function renderResumo(ctx) {
    var ses = sessoesDaBase();
    if (!ses.length) return cabecalho('O resumo de cada votação, lido das demandas.') + H.vazio('cards', 'Nenhuma votação gravada ainda', 'Quando a sala gravar pontos num card, o dia aparece aqui.');
    var s = ses.filter(function (x) { return x.dia === ctx.param; })[0] || ses[0];
    var D = A.APP.D || {};
    var neg = H.visiveis().filter(function (m) { return m.negada_em && diaLocal(m.negada_em) === s.dia; });
    var SP = raiz.SPRINTPO;
    var linhas = s.itens.map(function (m) {
      var ns = m.poker_votos.map(function (v) { return parseFloat(v.voto); }).filter(isFinite);
      var lo = ns.length ? Math.min.apply(null, ns) : 0, hi = ns.length ? Math.max.apply(null, ns) : 0;
      var ps = ns.length > 1 ? passos(lo, hi) : 0;
      var cor = ps === 0 ? 'var(--ok)' : ps >= 2 ? 'var(--wn)' : 'var(--ac)';
      return '<tr class="click" data-href="' + H.hrefItem(m) + '"><td><span class="code" style="margin-right:6px">' + esc(m.codigo || '') + '</span><span style="color:var(--tx)">' + esc(m.titulo) + '</span></td>' +
        '<td class="mono" style="font-size:12px;color:var(--tx3)" title="' + esc(m.poker_votos.map(function (v) { return v.nome + ': ' + v.voto; }).join(' · ')) + '">' + esc(m.poker_votos.map(function (v) { return v.voto; }).join(' · ')) + '</td>' +
        '<td><div class="bar" style="width:90px;height:6px" title="' + (ps === 0 ? 'unânime' : ps + ' cartas de distância') + '"><span style="width:' + Math.max(8, Math.min(100, ps / 4 * 100)) + '%;background:' + cor + '"></span></div></td>' +
        '<td>' + (m.poker_pontos != null ? chip(esc(m.poker_pontos) + ' pts', 'ac') : chip('sem pontos', 'bk')) + '</td>' +
        '<td class="note" style="font-size:12px">' + (m.sprint_po && SP ? 'sprint ' + esc(SP.rotuloCurto(m.sprint_po)) : '') + (m.poker_validado_por ? (m.sprint_po ? ' · ' : '') + 'por ' + esc(m.poker_validado_por) : '') + '</td>' +
        '<td>' + H.chipEtapa(m) + '</td></tr>';
    }).join('');
    var dias = ses.slice(0, 8).map(function (x) { return '<a class="btns' + (x.dia === s.dia ? ' on' : '') + '" href="#poker/resumo/' + x.dia + '">' + H.dm(x.dia) + '</a>'; }).join('');
    var media = s.itens.length > 1 && s.duracao ? Math.round(s.duracao / (s.itens.length - 1)) : null;
    return '<header class="pk-hd"><div style="display:flex;flex-direction:column;gap:6px;min-width:0"><span class="note"><a href="#poker/sessoes">Planning Poker</a> › votação de ' + H.dm(s.dia) + '</span>' +
        '<h1 class="h1">Resumo de ' + esc(H.dataLonga(s.dia)) + '</h1>' +
        '<span class="sub">' + (s.facil.length ? 'quem fechou: ' + esc(s.facil.join(', ')) + ' · ' : '') + H.plural(s.pessoas.length, 'participante', 'participantes') + '. Os pontos já estão gravados nos itens.</span></div>' +
        '<div class="row"><button type="button" class="btn" data-pk="copiar-resumo" data-dia="' + s.dia + '">Copiar resumo</button>' + (H.pode('trabalho') ? '<a href="#sprints/planning" class="btnp">Levar para a planning</a>' : '') + '</div></header>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap">' + dias + '</div>' +
      '<div class="pk-k5">' + H.kpi('Itens pontuados', s.itens.length) + H.kpi('Pontos', '<span style="color:var(--ac-t)">' + s.pontos + '</span>') +
        H.kpi('Unânimes', '<span style="color:var(--ok-t)">' + s.unanimes + '</span>', s.divergentes ? s.divergentes + ' divergentes' : '') +
        H.kpi('Negadas no dia', '<span style="color:var(--wn-t)">' + neg.length + '</span>', neg.length ? esc(neg.map(function (m) { return m.codigo; }).join(', ')) + ' (sala ou Admin)' : 'na sala ou no Admin') +
        H.kpi('Tempo médio por item', media ? media + ' min' : '—', 'entre uma gravação e a outra') + '</div>' +
      '<section class="pn" style="overflow-x:auto"><table class="tbl"><thead><tr><th>ITEM</th><th>VOTOS</th><th>DIVERGÊNCIA</th><th>RESULTADO</th><th>DECISÃO</th><th>ETAPA HOJE</th></tr></thead><tbody>' + linhas + '</tbody></table></section>';
  }

  function textoResumo(dia) {
    var s = sessoesDaBase().filter(function (x) { return x.dia === dia; })[0];
    if (!s) return '';
    return 'Planning Poker — votação de ' + H.dma(s.dia) + '\n' + H.plural(s.itens.length, 'item', 'itens') + ' · ' + s.pontos + ' pontos · ' + H.plural(s.pessoas.length, 'participante', 'participantes') + '\n\n' +
      s.itens.map(function (m) { return (m.codigo || '') + ' — ' + m.titulo + ': ' + (m.poker_pontos != null ? m.poker_pontos + ' pts' : 'sem pontos') + ' (votos ' + m.poker_votos.map(function (v) { return v.voto; }).join(', ') + ')'; }).join('\n');
  }

  // ── CSS proprio (uma vez) ──────────────────────────────────────────────
  function poeCss() {
    if (document.getElementById('css-tela-poker')) return;
    var st = document.createElement('style');
    st.id = 'css-tela-poker';
    st.textContent = [
      '.axa .pk-hd{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px}',
      '.axa .pk-2{display:grid;gap:16px;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);align-items:start}',
      '.axa .pk-g{display:grid;gap:18px;grid-template-columns:minmax(0,1fr) 300px;align-items:start}',
      '.axa .pk-k3{display:grid;gap:10px;grid-template-columns:repeat(3,minmax(0,1fr))}',
      '.axa .pk-k3 .k{padding:12px}',
      '.axa .pk-k4{display:grid;gap:12px;grid-template-columns:repeat(4,minmax(0,1fr))}',
      '.axa .pk-k5{display:grid;gap:12px;grid-template-columns:repeat(5,minmax(0,1fr))}',
      '.axa .pk-k{padding:12px 14px;border-radius:12px;background:var(--sf2);display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.axa .pk-k>span{font-size:11.5px;color:var(--tx3)}',
      '.axa .pk-k b{font-family:var(--font-title);font-weight:800;font-size:22px;line-height:28px}',
      '.axa .pk-k em{font-style:normal;font-size:13px;font-weight:700;margin-top:4px;line-height:18px}',
      '.axa .pk-k.wn{background:rgba(var(--wn-rgb),.08);box-shadow:inset 0 0 0 1px rgba(var(--wn-rgb),.3)}',
      '.axa .pk-k.wn em{color:var(--wn-t)}',
      '.axa .pk-sala-cod{height:30px;gap:8px;font-size:12px;color:var(--tx3)}',
      '.axa .pk-sala-cod b{font-size:14px;color:var(--ok-t);letter-spacing:.1em}',
      '.axa .pk-rank{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;font-size:12px}',
      '.axa .pk-rank:empty{display:none}',
      '.axa .pk-rk b{margin-left:5px;color:var(--ac-t)} .axa .pk-rk i{font-style:normal;margin-left:4px;font-size:10.5px}',
      '.axa .pk-rk.zero{opacity:.6}',
      '.axa .pk-meta{display:flex;flex-wrap:wrap;gap:4px 18px;font-size:12.5px;color:var(--tx2)}',
      '.axa .pk-rot{font-size:10.5px;font-weight:800;letter-spacing:.12em;color:var(--tx4);margin-right:6px;text-transform:uppercase}',
      '.axa .pk-desc{font-size:13.5px;line-height:21px;color:var(--tx2);white-space:pre-wrap;max-height:260px;overflow:auto;padding-right:4px}',
      '.axa .pk-reqbox{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:12px;background:var(--sf2);border:1px solid var(--bd)}',
      '.axa .pk-req{display:flex;justify-content:center;min-height:40px}',
      '.axa .pk-req-img{max-width:100%;max-height:320px;border-radius:8px;cursor:zoom-in;background:#fff}',
      '.axa .pk-req-pdf{width:100%;height:320px;border:0;border-radius:8px;background:#fff}',
      '.axa .pk-lupa{align-items:center;padding:24px}',
      '.axa .pk-lupa img{max-width:100%;max-height:calc(100vh - 48px);border-radius:10px;background:#fff;cursor:zoom-in}',
      '.axa .pk-lupa.real{align-items:flex-start} .axa .pk-lupa.real img{max-width:none;max-height:none;cursor:zoom-out}',
      '.axa .pk-lupa iframe{width:min(1100px,100%);height:calc(100vh - 48px);border:0;border-radius:10px;background:#fff}',
      '.axa .pk-disc{font-size:12.5px;line-height:19px;color:var(--tx2);padding:10px 12px;border-radius:12px;background:var(--sf2);display:flex;flex-direction:column;gap:4px}',
      '.axa .pk-disc summary{cursor:pointer;font-weight:700;color:var(--tx)} .axa .pk-disc b{color:var(--tx)}',
      '.axa .pk-mesa{display:flex;flex-wrap:wrap;gap:14px}',
      '.axa .pk-seat{display:flex;flex-direction:column;align-items:center;gap:8px;width:86px}',
      '.axa .pk-seat.off{opacity:.45}',
      '.axa .pk-carta{width:64px;height:88px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-family:var(--font-title);font-weight:800;font-size:24px;box-sizing:border-box}',
      '.axa .pk-carta.esp{border:1px dashed var(--bd4);color:var(--tx4)}',
      '.axa .pk-carta.ok{background:linear-gradient(160deg,var(--sf5),var(--sf));border:1px solid rgba(var(--ac-rgb),.5);color:var(--ac-t)}',
      '.axa .pk-carta.eu{background:linear-gradient(160deg,var(--ac-t),var(--ac-d));color:var(--on-ac)}',
      '.axa .pk-carta.rev{background:var(--sf4);border:1px solid var(--bd2);color:var(--tx)}',
      '.axa .pk-carta.vazia{border:1px solid var(--bd);color:var(--tx4);font-size:18px}',
      '.axa .pk-nome{font-size:12px;color:var(--tx2);text-align:center;line-height:16px;overflow-wrap:anywhere}',
      '.axa .pk-deck{display:flex;flex-wrap:wrap;gap:8px}',
      '.axa .pk-dc{width:58px;height:80px;border-radius:11px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;font:inherit;background:var(--sf2);border:1px solid var(--bd2);color:var(--tx);transition:transform .12s}',
      '.axa .pk-dc b{font-family:var(--font-title);font-size:19px;font-weight:800}',
      '.axa .pk-dc span{font-size:9.5px;color:var(--tx4)}',
      '.axa .pk-dc:hover:not(:disabled){border-color:rgba(var(--ac-rgb),.6);transform:translateY(-3px)}',
      '.axa .pk-dc.sel{background:linear-gradient(160deg,var(--ac-t),var(--ac-d));border-color:transparent;color:var(--on-ac);transform:translateY(-6px);box-shadow:0 10px 24px rgba(var(--ac-rgb),.35)}',
      '.axa .pk-dc.sel span{color:var(--on-ac);opacity:.8}',
      '.axa .pk-dc:disabled{cursor:not-allowed;opacity:.5}',
      '.axa .pk-dc.sel:disabled{opacity:.85}',
      '.axa .pk-dc:focus-visible{outline:2px solid rgba(var(--ac-rgb),.7);outline-offset:2px}',
      '.axa .pk-mini{width:42px;height:56px;border-radius:9px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:var(--sf2);border:1px solid var(--bd2)}',
      '.axa .pk-mini b{font-family:var(--font-title);font-size:14px} .axa .pk-mini span{font-size:9.5px;color:var(--tx4)}',
      '.axa .pk-pick{display:flex;flex-direction:column;gap:6px}',
      '.axa .pk-pk{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:var(--sf2);font-size:13px;color:var(--tx);text-decoration:none;min-width:0}',
      '.axa .pk-pk:hover{color:var(--tx);box-shadow:inset 0 0 0 1px var(--bd4)}',
      '.axa .pk-ses{padding:12px;border-radius:12px;background:var(--sf2);text-decoration:none;display:flex;flex-direction:column;gap:4px;color:var(--tx)}',
      '.axa .pk-ses:hover{color:var(--tx);box-shadow:inset 0 0 0 1px var(--bd4)} .axa .pk-ses b{font-size:13px}',
      '.axa .pk-pessoa{display:flex;align-items:center;gap:10px;font-size:13px;min-width:0}',
      '.axa .pk-fl{display:flex;flex-direction:column;gap:6px;max-height:560px;overflow:auto;padding-right:2px}',
      '.axa .pk-fi{all:unset;box-sizing:border-box;padding:10px 12px;border-radius:10px;display:flex;flex-direction:column;gap:4px;background:var(--sf2);border:1px solid transparent;min-width:0}',
      '.axa button.pk-fi{cursor:pointer} .axa button.pk-fi:hover{border-color:var(--bd4)}',
      '.axa button.pk-fi:focus-visible{outline:2px solid rgba(var(--ac-rgb),.7)}',
      '.axa .pk-fi.star{border-color:rgba(var(--wn-rgb),.35)}',
      '.axa .pk-fi.on{border-color:rgba(var(--ac-rgb),.6);background:rgba(var(--ac-rgb),.08)}',
      '.axa .pk-ft{font-size:12.5px;font-weight:600;line-height:17px;color:var(--tx)}',
      '.axa .pk-campos{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}',
      '.axa .pk-campos label{display:flex;flex-direction:column;gap:6px;min-width:120px}',
      '.axa .pk-entrar .pk-campos label{flex:1 1 160px}',
      '.axa .pk-cod{text-transform:uppercase;letter-spacing:.16em;font-size:15px}',
      '.axa .pk-perigo{color:var(--dg-t) !important;border-color:rgba(var(--dg-rgb),.4) !important}',
      '.axa .pk-ta{height:auto;padding:10px 14px;resize:vertical;line-height:20px;font:inherit;font-size:13px}',
      '.axa .pk-erro{min-height:16px;font-size:12.5px;color:var(--dg-t)}',
      '.axa .pk-qr{align-self:center;background:#fff;padding:12px;border-radius:16px;line-height:0}',
      '.axa .pk-codbox{padding:16px;border-radius:14px;background:var(--sf2);border:1px solid var(--bd2);display:flex;flex-direction:column;align-items:center;gap:4px}',
      '.axa .pk-codbox .mono{font-size:32px;color:var(--ok-t);letter-spacing:.16em}',
      '.axa .bar>span{display:block;height:100%;border-radius:3px}',
      '@container app (max-width: 1100px){',
      '.axa .pk-g{grid-template-columns:minmax(0,1fr) !important}',
      '.axa .pk-k5{grid-template-columns:repeat(3,minmax(0,1fr)) !important}',
      '}',
      '@container app (max-width: 760px){',
      '.axa .pk-2{grid-template-columns:minmax(0,1fr) !important}',
      '.axa .pk-k4,.axa .pk-k5{grid-template-columns:repeat(2,minmax(0,1fr)) !important}',
      '.axa .pk-dc{width:52px;height:72px}',
      '.axa .pk-seat{width:72px} .axa .pk-carta{width:56px;height:78px}',
      '}'
    ].join('\n');
    document.head.appendChild(st);
  }

  // ── Registro ───────────────────────────────────────────────────────────
  function render(el, ctx) {
    poeCss();
    S.assin = {};
    if (ctx.aba === 'resumo') return renderResumo(ctx);
    if (ctx.aba === 'sala') return renderSala(ctx);
    return renderSessoes();
  }

  function depois(el) {
    el.onclick = async function (ev) {
      var tr = ev.target.closest('tr[data-href]');
      if (tr && !ev.target.closest('a,button')) { location.hash = tr.getAttribute('data-href'); return; }
      var b = ev.target.closest('[data-pk]');
      if (!b || b.disabled) return;
      var q = b.getAttribute('data-pk');
      if (q === 'abrir') { b.disabled = true; await abrirSala(); b.disabled = false; }
      else if (q === 'convidar') abrirConvite();
      else if (q === 'sair') sairDaSala();
      else if (q === 'votar') votar(b.getAttribute('data-v'));
      else if (q === 'revelar') revelar();
      else if (q === 'revotar') revotar();
      else if (q === 'zerar') zerar();
      else if (q === 'proxima') proximaDemanda();
      else if (q === 'pauta') porEmPauta(b.getAttribute('data-id'));
      else if (q === 'gravar') gravarNoCard();
      else if (q === 'negar') negar();
      else if (q === 'complementar') abrirComplemento();
      else if (q === 'ampliar') ampliar();
      else if (q === 'anexo') abrirAnexo(+b.getAttribute('data-i'));
      else if (q === 'ref') { S.refAberta = !S.refAberta; pintar(); }
      else if (q === 'votar-tambem') entrarNaSala(S.codigo, meuNome());
      else if (q === 'copiar-resumo') copiar(textoResumo(b.getAttribute('data-dia')), 'Resumo copiado.', 'Copie o resumo');
    };
    el.onchange = function (ev) {
      var t = ev.target;
      if (t.hasAttribute('data-pkf')) { S.filaFrente = t.value; S.assin['pk-fila'] = null; pintar(); return; }
      var k = t.getAttribute('data-pkv');
      if (!k) return;
      S.valores[k] = t.value;
      if (k !== 'sprint') S.valores.tocado = true;
      var g = document.getElementById('pk-gravar');
      if (g && !g.disabled) g.textContent = rotuloGravar();
    };
    el.oninput = el.onchange;
    var f = el.querySelector('#pk-form-entrar');
    if (f) f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = f.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Entrando…';
      var ok = await entrarNaSala(f.querySelector('#pk-in-cod').value, f.querySelector('#pk-in-nome').value);
      if (!ok && btn.isConnected) { btn.disabled = false; btn.textContent = 'Entrar na sala'; }
    });
    if (S.codigo) {
      // Voltou para #poker (F5, outra tela, outra aba): retoma sem passar por
      // `poker-abrir`, que e o que apagava a votacao em andamento.
      if (!S.fila && !S.carregandoFila) carregarFila();
      if (!S.timer) atualizar(true);
      ligaPolling();
    }
    pintar();
  }

  if (typeof window !== 'undefined') {
    // Saiu da rota #poker: para o polling e avisa a mesa (sem apagar o voto).
    window.addEventListener('hashchange', function () { if (!naRota() && S.timer) { paraPolling(); avisarAusencia(); } });
    window.addEventListener('pagehide', avisarAusencia);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && naRota() && S.codigo) atualizar(true); });
  }

  A.tela({
    id: 'poker',
    rotulo: 'Planning Poker',
    papeis: ['admin', 'analista', 'dev'],
    abas: [{ id: 'sessoes', rotulo: 'Sessões' }, { id: 'sala', rotulo: 'Sala ao vivo' }, { id: 'resumo', rotulo: 'Resumo' }],
    titulo: function (r) { return r.aba === 'sala' && S.codigo ? 'Sala ' + S.codigo + ' · Planning Poker' : 'Planning Poker'; },
    render: render,
    depois: depois
  });
})();
