/* ─────────────────────────────────────────────────────────────────────────
   AXIS — tela Minha conta (prototipo EP-013: Conta.dc.html / 04-Conta.png).

   Fora do menu: chega-se pelo avatar (#conta). Vale para todos os perfis.

   O QUE O PROTOTIPO TEM E O ROADMAP NAO: login pelo Keycloak (aqui e o login
   proprio do RoadMap), token pessoal da API, densidade do quadro, tela
   inicial e notificacoes por Teams/e-mail. Nada disso e simulado: o que nao
   existe aparece como "ainda não disponível".

   A TROCA DE SENHA E A DE SEMPRE (senha.js, `abrirTrocaSenha`), a mesma que
   Admin, painel do dev, Gantt e Poker chamam. O tema e o de tema.js
   (`temaAtual` / `temaAlternar`), o mesmo botao da barra do topo.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var A = window.AXIS_APP;
  if (!A) return;
  var H = A.H;

  // A mesma URL do Worker que axis-app.js e senha.js usam; o nucleo nao a
  // exporta, e o exemplo de chamada precisa dela inteira para ser copiavel.
  var WORKER = 'https://roadmap-nova-melhoria.morais-tecnologico.workers.dev';
  var PAPEL = { admin: 'PM/PO · Admin', dev: 'Dev', consulta: 'Consulta' };

  function poeCss() {
    if (document.getElementById('css-tela-conta')) return;
    var st = document.createElement('style');
    st.id = 'css-tela-conta';
    st.textContent = [
      '.axa .ct-grid{display:grid;gap:16px;grid-template-columns:340px minmax(0,1fr);align-items:start}',
      '.axa .ct-perfil{align-items:center;text-align:center;gap:10px}',
      '.axa .ct-perfil .av{width:84px;height:84px;border-radius:42px;font-size:26px}',
      '.axa .ct-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px}',
      '.axa .ct-num{width:100%;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px}',
      '.axa .ct-num .k{padding:10px;align-items:center}',
      '.axa .ct-num b{font-size:18px}',
      '.axa .ct-pref{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:13px;padding:4px 0}',
      '.axa .ct-pref>span:first-child{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.axa .ct-pref .v{height:32px;white-space:nowrap}',
      '.axa .ct-pref .nd{font-size:12px;color:var(--tx4);white-space:nowrap}',
      '.axa .ct-pre{margin:0;padding:14px;border-radius:12px;background:var(--side);border:1px solid var(--bd);font-size:11.5px;line-height:18px;color:var(--tx2);white-space:pre-wrap;word-break:break-all}',
      '@container app (max-width: 760px){',
      '.axa .ct-grid{grid-template-columns:minmax(0,1fr) !important}',
      '.axa .ct-pref{flex-wrap:wrap}',
      '}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* Os numeros do cartao: o mes corrente das demandas com o nome da pessoa.
     Entregas = concluidas cuja entrega (`capacidade.diaDaEntrega`) cai no mes;
     pontos = `capacidade.porDev`, a mesma conta da faixa de produtividade do
     dev.html; no prazo = das entregues no mes, as que `prazo.atrasouNaEntrega`
     nao acusa. */
  function numerosDoMes(ctx) {
    var CAP = window.CAPACIDADE, PZ = window.PRAZO;
    if (!CAP) return null;
    var vs = H.visiveis();
    var minhas = vs.filter(H.minha);
    if (!minhas.length) return null;
    var mes = H.hoje().slice(0, 7);
    var noMes = minhas.filter(function (m) { return CAP.diaDaEntrega(m).slice(0, 7) === mes; });
    var concl = noMes.filter(function (m) { return H.colunaDe(m) === 'concluido'; });
    var entregues = noMes.filter(function (m) { return ['validacao_area', 'validacao', 'concluido'].indexOf(H.colunaDe(m)) >= 0; });
    var noPrazo = entregues.filter(function (m) { return !(PZ && PZ.atrasouNaEntrega(m)); }).length;
    var pts = 0, nomes = H.meusNomes();
    CAP.porDev(vs, mes + '-01', mes + '-31').forEach(function (r) { if (nomes.indexOf(r.nome) >= 0) pts += r.entregue; });
    return { mes: H.MESES[+mes.slice(5, 7) - 1], entregas: concl.length, pontos: pts,
             noPrazo: entregues.length ? Math.round(noPrazo / entregues.length * 100) : null, base: entregues.length };
  }

  function pref(rot, dica, valor) {
    return '<div class="ct-pref"><span><span>' + rot + '</span><span class="note" style="font-size:12px">' + dica + '</span></span>' + valor + '</div>';
  }

  function render(el, ctx) {
    poeCss();
    var e = ctx.eu || {};
    var nome = e.nome || e.login || 'Minha conta';
    var papel = ctx.papel;
    var perfil = ((ctx.D || {}).devs_perfil || {})[e.nome_demandas || e.nome] || {};
    var tema = window.temaAtual ? window.temaAtual() : 'escuro';
    var n = numerosDoMes(ctx);

    var chips = H.chip(H.esc(PAPEL[papel] || papel || '—'), 'ac');
    if (perfil.pipeline) chips += H.chip(H.esc(perfil.pipeline), 'bk', 'Pipeline do dev (cadastro de devs)');
    if (papel === 'dev' && window.SPRINTPO && window.SPRINTPO.PONTOS_POR_DEV) {
      chips += H.chip(window.SPRINTPO.PONTOS_POR_DEV + ' pts / sprint', 'bk', 'Capacidade de referência por dev na sprint (sprint.js)');
    }

    var num = n
      ? '<div class="ct-num">' +
          '<div class="k" title="Concluídas com entrega em ' + n.mes + '"><span class="kl">Entregas</span><b>' + n.entregas + '</b></div>' +
          '<div class="k" title="Pontos entregues em ' + n.mes + ' (dupla divide)"><span class="kl">Pontos</span><b>' + n.pontos + '</b></div>' +
          '<div class="k" title="Das ' + n.base + ' entregues em ' + n.mes + ', as que saíram dentro do prazo"><span class="kl">No prazo</span><b style="color:' + (n.noPrazo == null ? 'var(--tx3)' : n.noPrazo >= 80 ? 'var(--ok-t)' : 'var(--wn-t)') + '">' + (n.noPrazo == null ? '—' : n.noPrazo + '%') + '</b></div>' +
        '</div><span class="note" style="margin-top:-4px">em ' + H.esc(n.mes) + '</span>'
      : '';

    var cartao = '<section class="pnh ct-perfil">' +
      '<span class="av" style="background:var(--ac);color:var(--on-ac)">' + H.esc(H.iniciais(nome)) + '</span>' +
      '<b style="font-size:18px">' + H.esc(nome) + '</b>' +
      '<span class="note">' + H.esc(e.email || e.login || '') + (e.email && e.login ? ' · ' + H.esc(e.login) : '') + '</span>' +
      '<div class="ct-chips">' + chips + '</div>' + num +
      '<button type="button" class="btn" data-ct="senha" style="width:100%">' + H.ico('key') + ' Trocar minha senha</button>' +
      '<button type="button" class="btns" data-acao="sair" style="width:100%">' + H.ico('logout') + ' Sair</button>' +
      '</section>';

    var nd = '<span class="nd">ainda não disponível</span>';
    var temaBtn = '<span class="row" style="gap:6px" role="group" aria-label="Tema">' +
      '<button type="button" class="btns' + (tema === 'escuro' ? ' on' : '') + '" data-ct="tema" data-v="escuro" aria-pressed="' + (tema === 'escuro') + '">' + H.ico('moon') + ' Escuro</button>' +
      '<button type="button" class="btns' + (tema === 'claro' ? ' on' : '') + '" data-ct="tema" data-v="claro" aria-pressed="' + (tema === 'claro') + '">' + H.ico('sun') + ' Claro</button></span>';
    var nomesDem = H.meusNomes();
    var prefs = '<section class="pn"><h2 class="h2">Preferências</h2>' +
      pref('Tema', 'escuro é o padrão da marca; vale para todas as telas deste navegador', temaBtn) +
      (papel !== 'consulta'
        ? pref('Nome nas demandas', 'como você aparece no campo dev dos cards e relatórios',
            seletorNome(ctx, nomesDem))
        : '') +
      pref('Tela inicial', 'onde o AXIS abre depois do login — hoje sempre o Início', nd) +
      pref('Notificações', 'Teams, e-mail e resumo diário', nd) +
      (papel !== 'consulta'
        ? '<span class="note">Se as demandas do Meu trabalho não forem as suas, escolha aqui o nome com que você aparece nelas. É o mesmo ajuste do “Não são as minhas demandas” do painel antigo.</span>'
        : '') +
      '</section>';

    var exemplo = 'curl -s ' + WORKER + ' \\\n' +
      '  -H "Content-Type: application/json" \\\n' +
      '  -d \'{"action":"login","login":"' + (e.login || 'seu.usuario') + '","senhaUsuario":"SUA_SENHA"}\'\n' +
      '# resposta: {"ok":true,"token":"...","usuario":{...}}';
    var api = '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2">Acesso pela API</h2>' +
      (papel !== 'consulta' ? '<a class="btns" href="#api" title="A documentação das rotas, com exemplo de chamada">Ver as rotas</a>' : '') + '</div>' +
      '<span class="note">Token pessoal da API ainda não disponível. Scripts entram com o seu usuário e senha pela rota <span class="mono">login</span> e usam o token que ela devolve, com a mesma permissão que você tem na tela.</span>' +
      '<pre class="mono ct-pre">' + H.esc(exemplo) + '</pre>' +
      '</section>';

    return '<header style="display:flex;flex-direction:column;gap:6px"><h1 class="h1">Minha conta</h1>' +
      '<span class="sub">Login e senha são os do RoadMap. Aqui ficam seus dados, a troca de senha e a preferência de tema.</span></header>' +
      '<div class="ct-grid">' + cartao + '<div style="display:flex;flex-direction:column;gap:16px;min-width:0">' + prefs + api + '</div></div>';
  }

  /* "NAO SAO AS MINHAS DEMANDAS" (dev.html, `vincularNome`): a pessoa escolhe o
     nome com que aparece no campo dev. Os nomes sao os que a base conhece (lista
     de devs e o que esta grafado nas demandas); grava pela rota
     `meu-nome-demandas`, que so mexe na propria conta. */
  function nomesDaBase(D) {
    var vistos = {};
    (D.desenvolvedores || []).forEach(function (n) { if (n) vistos[String(n).trim()] = 1; });
    (D.melhorias || []).forEach(function (m) { H.devsDe(m).forEach(function (n) { if (n) vistos[n] = 1; }); });
    return Object.keys(vistos).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
  }
  /** As opcoes do seletor de nome — o da Minha conta e o do vinculo no 1o acesso. */
  function opcoesNome(lista, atual) {
    return '<option value="">— escolha —</option>' + lista.map(function (n) {
      return '<option value="' + H.esc(n) + '"' + (n === atual ? ' selected' : '') + '>' + H.esc(n) + '</option>';
    }).join('');
  }
  function seletorNome(ctx, nomesDem) {
    var atual = nomesDem[0] || '';
    var lista = nomesDaBase(ctx.D || {});
    if (atual && lista.indexOf(atual) < 0) lista.unshift(atual);
    return '<span class="row" style="gap:6px;flex-wrap:wrap">' +
      '<select class="in" id="ct-nome" style="height:32px" aria-label="Nome nas demandas">' + opcoesNome(lista, atual) + '</select>' +
      '<button type="button" class="btns" data-ct="nome">Salvar</button></span>';
  }
  /** Guarda o nome no `rm_eu` da sessao, que `H.meusNomes` le. */
  function nomeNaSessao(nome) {
    var eu = {};
    try { eu = JSON.parse(sessionStorage.getItem('rm_eu') || '{}') || {}; } catch (_) {}
    eu.nome_demandas = nome;
    try { sessionStorage.setItem('rm_eu', JSON.stringify(eu)); } catch (_) {}
  }
  /** Grava pela rota `meu-nome-demandas` (so a propria conta) e poe na sessao. */
  async function gravaNome(nome) {
    var j = await H.api('meu-nome-demandas', { nome_demandas: nome });
    nomeNaSessao(j.nome_demandas || nome);
    return j;
  }

  // ═══ O VINCULO NO 1o ACESSO (dev.html: `entrarComoEu`, `pedirVinculo`) ════
  /* Quem desenvolve e entra com uma conta cujo nome nao casa com nenhum nome
     das demandas e perguntado UMA vez "como o seu nome aparece nas demandas?",
     com a lista e o palpite; a escolha vai para o perfil (`meu-nome-demandas`)
     e a pergunta nao volta. Antes o Meu trabalho abria vazio e mandava
     procurar o ajuste em outro lugar.

     AS REGRAS SAO COPIAS do dev.html, e a suite roda cada uma ao lado da
     original:
       contaSplitDevs   `splitDevs`
       contaListaDevs   `getDevList` (a lista do cadastro de devs e o que esta
                        grafado nas demandas, sem repetir, em ordem)
       contaNorm        `normNome` (sem acento e sem caixa)
       contaMeuDev      `resolveMeuDev`: o nome declarado (ou o da conta) que
                        bate por IGUALDADE com um da lista — nada de semelhanca,
                        que ja abriu o painel na fila de outra pessoa
       contaPalpite     o palpite do `pedirVinculo`: palavras em comum, e so
                        com um vencedor unico (empate nao pre-seleciona)
     Como no dev.html, so o perfil dev e perguntado: PM/PO e analista
     coordenam e nao precisam ter demanda no proprio nome. */
  function contaSplitDevs(s) { return s ? String(s).split(/[\/,]/).map(function (x) { return x.trim(); }).filter(Boolean) : []; }
  function contaListaDevs(D) {
    var todos = [];
    ((D || {}).desenvolvedores || []).forEach(function (d) { todos = todos.concat(contaSplitDevs(d)); });
    ((D || {}).melhorias || []).forEach(function (m) { todos = todos.concat(contaSplitDevs(m && m.dev)); });
    var vistos = {};
    return todos.filter(function (n) { if (vistos['$' + n]) return false; vistos['$' + n] = 1; return true; }).sort();
  }
  function contaNorm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function contaMeuDev(eu, devs) {
    if (!eu) return '';
    var dec = String(eu.nome_demandas || '').split(/[\/,;]/).map(function (x) { return x.trim(); }).filter(Boolean);
    var meus = dec.length ? dec : (eu.nome ? [eu.nome] : []);
    if (!meus.length) return '';
    var alvo = meus.map(contaNorm);
    return (devs || []).find(function (d) { return alvo.indexOf(contaNorm(d)) >= 0; }) || '';
  }
  function contaPalpite(nome, devs) {
    var meus = {};
    contaNorm(nome).split(' ').filter(Boolean).forEach(function (p) { meus[p] = 1; });
    var melhor = '', placar = 0, empate = false;
    (devs || []).forEach(function (d) {
      var n = contaNorm(d).split(' ').filter(Boolean).reduce(function (c, p) { return c + (meus[p] ? 1 : 0); }, 0);
      if (n > placar) { placar = n; melhor = d; empate = false; }
      else if (n === placar && n > 0) empate = true;
    });
    return melhor && placar > 0 && !empate ? melhor : '';
  }
  function precisaVinculo(eu, papel, D) {
    return papel === 'dev' && !!eu && !contaMeuDev(eu, contaListaDevs(D));
  }
  /** O nome com que a pessoa aparece nas demandas, na grafia da base (o
      `currentDev` do dev.html), ou o declarado quando a base nao o tem. */
  function meuDev(eu, D) {
    return contaMeuDev(eu, contaListaDevs(D)) || H.meusNomes()[0] || ((eu || {}).nome || '');
  }

  /* O PASSO NA CAIXA DE ENTRAR (o `step-vinculo` do dev.html): o mesmo
     seletor e a mesma gravacao da Minha conta. "Entrar assim mesmo" segue sem
     gravar — a conta nova ainda sem demanda resolve sozinha quando a primeira
     nascer no nome dela. Se a gravacao falhar, o nome vale nesta sessao. */
  function vinculo(dir, o) {
    o = o || {};
    var eu = o.eu || {};
    var devs = contaListaDevs(o.D || {});
    var palpite = contaPalpite(eu.nome || '', devs);
    dir.innerHTML = '<form class="lg-box" id="lg-vin" novalidate>' +
      '<span class="sb-mark" style="width:56px;height:56px;border-radius:16px"><img src="axis/marca/axis-leao-branco.png" alt="" style="width:36px"></span>' +
      '<h2 style="margin:6px 0 0;font-family:var(--font-title);font-size:26px;font-weight:800">Falta ligar sua conta às suas demandas</h2>' +
      '<span class="sub" id="vin-explica" style="margin-bottom:8px">Você entrou como <b>' + H.esc(eu.nome || eu.login || '') + '</b>. ' +
      'Não consegui dizer com certeza quais demandas são suas — ou não há nenhuma nesse nome, ou o nome coincide com o de outra pessoa. ' +
      'Escolha como seu nome aparece nas demandas: guardamos no seu perfil e esta tela não volta.</span>' +
      '<label for="vin-nome">Seu nome nas demandas</label>' +
      '<select class="in" id="vin-nome">' + opcoesNome(devs, palpite) + '</select>' +
      '<div class="lg-err" id="lg-err" role="alert"></div>' +
      '<button class="btnp" id="vin-ok" type="submit">Continuar</button>' +
      // Links de texto com area de toque de 44 px (o desenho continua o de link).
      '<button type="button" class="link" data-vin="depois" style="align-self:center;min-height:44px;padding:0 12px;font-size:13px;font-weight:700">Ainda não tenho demandas — entrar assim mesmo</button>' +
      '<button type="button" class="link" data-vin="sair" style="align-self:center;min-height:44px;min-width:44px;padding:0 12px;margin-top:-8px;font-size:13px;font-weight:700">' + H.ico('logout') + ' Sair</button>' +
      '</form>';
    var f = dir.querySelector('#lg-vin');
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var nome = String(f.querySelector('#vin-nome').value || '').trim();
      var err = f.querySelector('#lg-err');
      if (!nome) { err.textContent = 'Escolha um nome da lista.'; f.querySelector('#vin-nome').focus(); return; }
      err.textContent = '';
      var b = f.querySelector('#vin-ok');
      b.disabled = true; b.textContent = 'Gravando…';
      try { await gravaNome(nome); }
      catch (ex) {
        nomeNaSessao(nome);
        if (ex.status !== 401) H.toast('Não consegui guardar no seu perfil — vale só nesta sessão. Ajuste depois em Minha conta.', 'erro');
        if (ex.status === 401) return;
      }
      if (o.pronto) o.pronto(nome);
    });
    dir.addEventListener('click', function (e) {
      var b = e.target.closest('[data-vin]');
      if (!b) return;
      if (b.getAttribute('data-vin') === 'sair') { if (o.sair) o.sair(); }
      else if (o.depois) o.depois();
    });
    setTimeout(function () { var s = f.querySelector('#vin-nome'); if (s) s.focus(); }, 0);
  }

  function depois(el) {
    el.onclick = async function (ev) {
      var b = ev.target.closest('[data-ct]');
      if (!b) return;
      var q = b.getAttribute('data-ct');
      if (q === 'senha') {
        if (typeof window.abrirTrocaSenha === 'function') window.abrirTrocaSenha();
        else H.toast('A troca de senha não carregou. Use a tela Minha senha do Admin ou do Meu painel.', 'erro');
        return;
      }
      if (q === 'nome') {
        var sel = el.querySelector('#ct-nome');
        var nome = sel ? String(sel.value || '').trim() : '';
        if (!nome) { H.toast('Escolha um nome da lista.', 'erro'); return; }
        b.disabled = true;
        try {
          await gravaNome(nome);
          H.toast('Pronto: suas demandas agora são as de ' + nome + '.', 'ok');
          A.desenhar();
        } catch (e) {
          H.toast(e.message || 'Não consegui gravar o nome.', 'erro');
          b.disabled = false;
        }
        return;
      }
      if (q === 'tema') {
        var quer = b.getAttribute('data-v');
        if (window.temaAtual && window.temaAlternar && window.temaAtual() !== quer) window.temaAlternar();
        A.desenhar();
      }
    };
  }

  // ═══ NA TELA DE ENTRAR: RECUPERAR A SENHA E CRIAR A CONTA ═══════════════
  /* AS REGRAS SAO COPIAS, e a suite roda cada uma ao lado da original:
       contaRegraEmail    o pedido do `abrirRecuperarSenha` (senha.js)
       contaRegraNova     o "Definir senha" do mesmo modal
       contaJanela        a janela do cronometro (senha.js: `minutos` contado
                          do relogio DESTE navegador, nunca `expira_em` menos a
                          hora local — foi o que prendeu o Dan)
       contaForca         a dica de forca (senha.js, `forca`)
       contaRegraCadastro o `fazerCadastro` do dev.html
     As rotas sao as mesmas (`senha-recuperar`, `senha-redefinir`, `recuperar`
     para conta de admin e `cadastro`), e nenhuma pede Turnstile: o Worker so o
     cobra na sugestao publica e no anexo sem sessao. A conta criada nasce
     pendente; quem libera e o admin, em Configuracoes › Pessoas e perfis. */
  var DOMINIO = '@audaxcapitalsa.com.br';
  var SENHA_MIN = 8;
  function contaRegraEmail(email) {
    var e = String(email || '').trim().toLowerCase();
    if (!e) return { ok: false, erro: 'Informe seu e-mail corporativo.', campo: 'email' };
    if (e.indexOf(DOMINIO) < 0) return { ok: false, erro: 'Use o e-mail corporativo, terminando em ' + DOMINIO + '.', campo: 'email' };
    return { ok: true, email: e };
  }
  function contaRegraNova(nova, conf) {
    if (String(nova || '').length < SENHA_MIN) return { ok: false, erro: 'A senha precisa de ao menos ' + SENHA_MIN + ' caracteres.', campo: 'nova' };
    if (nova !== conf) return { ok: false, erro: 'A confirmação não confere.', campo: 'conf' };
    return { ok: true };
  }
  function contaJanela(j, agora) {
    var jan = Number(j && j.minutos) > 0 ? Number(j.minutos) : 5;
    return agora + jan * 60 * 1000;
  }
  function contaForca(s) {
    var v = String(s || '');
    if (v.length < SENHA_MIN) return { txt: 'faltam ' + (SENHA_MIN - v.length) + ' caractere(s)', cor: 'var(--dg-t)' };
    var variedade = (/[a-z]/.test(v) ? 1 : 0) + (/[A-Z]/.test(v) ? 1 : 0) + (/\d/.test(v) ? 1 : 0) + (/[^A-Za-z0-9]/.test(v) ? 1 : 0);
    if (v.length >= 14 || variedade >= 3) return { txt: 'boa', cor: 'var(--ok-t)' };
    if (v.length >= 10) return { txt: 'razoável — uma frase longa é mais forte', cor: 'var(--wn-t)' };
    return { txt: 'fraca — prefira uma frase de 14+ caracteres', cor: 'var(--wn-t)' };
  }
  function contaRegraCadastro(nome, email, senha) {
    var n = String(nome || '').trim(), e = String(email || '').trim().toLowerCase(), s = String(senha || '');
    if (n.length < 3) return { ok: false, erro: 'Escreva seu nome completo aqui.', campo: 'nome' };
    if (!e.endsWith(DOMINIO) || e.indexOf('@') < 1) return { ok: false, erro: 'Precisa ser seu e-mail da Audax, o que termina com ' + DOMINIO, campo: 'email' };
    if (s.length < SENHA_MIN) {
      var f = SENHA_MIN - s.length;
      return { ok: false, erro: 'Sua senha está curta: faltam ' + f + ' caractere' + (f > 1 ? 's' : '') + ' para chegar a ' + SENHA_MIN + '.', campo: 'senha' };
    }
    return { ok: true, corpo: { nome: n, email: e, senhaUsuario: s } };
  }

  /* O PASSO NA CAIXA DE ENTRAR: troca o formulario de login pelo do passo,
     no mesmo lugar e no mesmo desenho; `voltar(msg, o)` redesenha o login. */
  function passo(dir, modo, voltar) {
    var esc = H.esc;
    var topo = function (tit, sub) {
      return '<span class="sb-mark" style="width:56px;height:56px;border-radius:16px"><img src="axis/marca/axis-leao-branco.png" alt="" style="width:36px"></span>' +
        '<h2 style="margin:6px 0 0;font-family:var(--font-title);font-size:26px;font-weight:800">' + tit + '</h2>' +
        '<span class="sub" style="margin-bottom:8px">' + sub + '</span>';
    };
    var pe = '<button type="button" class="link" data-lg-volta style="align-self:center;font-size:13px;font-weight:700">' + H.ico('undo') + ' Voltar para entrar</button>';
    var timer = null;
    var limpa = function () { if (timer) { clearInterval(timer); timer = null; } };
    var $ = function (id) { return dir.querySelector('#' + id); };
    var aviso = function (t, ok) { var e = $('lg-err'); e.innerHTML = t; e.style.color = ok ? 'var(--ok-t)' : ''; };
    var falha = function (r) { aviso(esc(r.erro)); var c = r.campo && $('lg-' + r.campo); if (c) c.focus(); };

    if (modo === 'cadastro') {
      dir.innerHTML = '<form class="lg-box" id="lg-cad" autocomplete="on" novalidate>' + topo('Criar acesso', 'A conta nasce pendente: um administrador libera o seu acesso.') +
        '<label for="lg-nome">Nome completo</label><input class="in" id="lg-nome" autocomplete="name" maxlength="80">' +
        '<span class="note" style="margin-top:-8px">Use o mesmo nome que aparece nas suas demandas.</span>' +
        '<label for="lg-email">E-mail corporativo</label><input class="in" id="lg-email" type="email" autocomplete="email" placeholder="nome.sobrenome' + DOMINIO + '">' +
        '<label for="lg-senha">Crie uma senha</label><input class="in" id="lg-senha" type="password" autocomplete="new-password">' +
        '<span class="note" id="lg-forca" style="margin-top:-8px;min-height:16px"></span>' +
        '<div class="lg-err" id="lg-err" role="alert"></div>' +
        '<button class="btnp" id="lg-btn" type="submit">Criar conta</button>' + pe + '</form>';
      $('lg-senha').addEventListener('input', function (e) { var f = contaForca(e.target.value); var el = $('lg-forca'); el.textContent = e.target.value ? f.txt : ''; el.style.color = f.cor; });
      $('lg-cad').addEventListener('submit', async function (e) {
        e.preventDefault();
        var r = contaRegraCadastro($('lg-nome').value, $('lg-email').value, $('lg-senha').value);
        if (!r.ok) { falha(r); return; }
        var b = $('lg-btn');
        b.disabled = true; b.textContent = 'Enviando…'; aviso('');
        try {
          await H.api('cadastro', r.corpo);
          dir.querySelector('form').innerHTML = topo('Cadastro enviado', 'Avise um administrador para liberar o seu acesso.') +
            '<div class="lg-err" id="lg-err" role="status" style="color:var(--ok-t)">' + H.ico('check') + ' Depois entre com <b>' + esc(r.corpo.email) + '</b> e a senha que você acabou de escolher.</div>' + pe;
        } catch (ex) {
          var c = ex.codigo === 'email' || ex.codigo === 'existe' ? 'email' : ex.codigo === 'nome' ? 'nome' : 'senha';
          falha({ erro: (ex.corpo && ex.corpo.detail) || (ex.status === 429 ? 'Muitas tentativas em pouco tempo. Espere um minuto e tente de novo.' : 'Não foi possível cadastrar agora. Tente novamente.'), campo: c });
          b.disabled = false; b.textContent = 'Criar conta';
        }
      });
      setTimeout(function () { $('lg-nome').focus(); }, 0);
    } else {
      var tk = '', email = '', fim = 0;
      dir.innerHTML = '<form class="lg-box" id="lg-rec" autocomplete="on" novalidate>' + topo('Recuperar senha', 'Informe seu e-mail corporativo. Se houver conta, você define a nova senha aqui mesmo, na hora.') +
        '<div id="lg-et1" style="display:flex;flex-direction:column;gap:14px">' +
          '<label for="lg-email">E-mail corporativo</label><input class="in" id="lg-email" type="email" autocomplete="username" placeholder="nome.sobrenome' + DOMINIO + '">' +
        '</div>' +
        '<div id="lg-et2" style="display:none;flex-direction:column;gap:14px">' +
          '<span class="chip c-bk" id="lg-relogio" style="align-self:flex-start"></span>' +
          '<label for="lg-nova">Nova senha</label><input class="in" id="lg-nova" type="password" autocomplete="new-password">' +
          '<span class="note" id="lg-forca" style="margin-top:-8px;min-height:16px"></span>' +
          '<label for="lg-conf">Repita a nova senha</label><input class="in" id="lg-conf" type="password" autocomplete="new-password">' +
        '</div>' +
        '<div class="lg-err" id="lg-err" role="alert"></div>' +
        '<button class="btnp" id="lg-btn" type="submit">Continuar</button>' + pe + '</form>';
      /* O cronometro AVISA e nao tranca: quem decide se o pedido vale e o
         servidor, que responde 410 com texto proprio. */
      var tique = function () {
        var resta = Math.max(0, Math.round((fim - Date.now()) / 1000));
        var el = $('lg-relogio');
        if (!el) { limpa(); return; }
        el.innerHTML = H.ico('clock') + ' ' + (resta > 0
          ? Math.floor(resta / 60) + ':' + String(resta % 60).padStart(2, '0') + ' para definir a nova senha'
          : 'Tempo esgotado — tente salvar; se não valer mais, o servidor avisa e você pede de novo');
        el.className = 'chip ' + (resta <= 60 ? 'c-dg' : 'c-bk');
        if (resta <= 0) limpa();
      };
      $('lg-nova').addEventListener('input', function (e) { var f = contaForca(e.target.value); var el = $('lg-forca'); el.textContent = e.target.value ? f.txt : ''; el.style.color = f.cor; });
      $('lg-rec').addEventListener('submit', async function (e) {
        e.preventDefault();
        var b = $('lg-btn');
        if (!tk) {
          var r = contaRegraEmail($('lg-email').value);
          if (!r.ok) { falha(r); return; }
          email = r.email;
          b.disabled = true; b.textContent = 'Verificando…'; aviso('');
          try {
            var j = await H.api('senha-recuperar', { email: email });
            tk = j.token;
            fim = contaJanela(j, Date.now());
            aviso('Conta encontrada' + (j.nome ? ': <b>' + esc(j.nome) + '</b>' : '') + '. Defina a nova senha antes de o tempo acabar.', true);
            $('lg-et1').style.display = 'none';
            $('lg-et2').style.display = 'flex';
            b.textContent = 'Definir senha';
            tique(); timer = setInterval(tique, 1000);
            $('lg-nova').focus();
          } catch (ex) {
            if (ex.codigo === 'admin') {
              // Conta de admin nao se redefine so com o e-mail: a fila antiga
              // (`recuperar`) avisa os outros administradores.
              aviso(esc((ex.corpo && ex.corpo.detail) || '') + '<br><button type="button" class="btn" data-lg-avisar style="margin-top:10px">Avisar os administradores</button>');
            } else {
              falha({ erro: (ex.corpo && ex.corpo.detail) || (ex.status === 429 ? 'Muitas tentativas em pouco tempo. Espere um minuto.' : 'Não foi possível continuar: ' + (ex.message || ex)), campo: 'email' });
            }
            b.textContent = 'Continuar';
          }
          b.disabled = false;
          return;
        }
        var n = contaRegraNova($('lg-nova').value, $('lg-conf').value);
        if (!n.ok) { falha(n); return; }
        b.disabled = true; b.textContent = 'Salvando…';
        try {
          await H.api('senha-redefinir', { token: tk, senhaNova: $('lg-nova').value });
          limpa();
          voltar('Senha definida. Entre com a nova senha.', { ok: true, usuario: email });
        } catch (ex) {
          falha({ erro: (ex.corpo && ex.corpo.detail) || 'Falha de rede. A senha NÃO foi alterada.', campo: 'nova' });
          b.disabled = false; b.textContent = 'Definir senha';
        }
      });
      setTimeout(function () { $('lg-email').focus(); }, 0);
    }
    dir.addEventListener('click', async function (e) {
      if (e.target.closest('[data-lg-volta]')) { limpa(); voltar(''); return; }
      var av = e.target.closest('[data-lg-avisar]');
      if (av) {
        av.disabled = true; av.textContent = 'Enviando…';
        try { await H.api('recuperar', { email: email }); aviso('Pedido registrado. Um administrador vai gerar sua nova senha.', true); }
        catch (_) { aviso('Falha de rede ao registrar o pedido.'); }
      }
    });
  }
  window.AXIS_CONTA = { passo: passo, vinculo: vinculo, precisaVinculo: precisaVinculo, meuDev: meuDev,
                        contaListaDevs: contaListaDevs, contaMeuDev: contaMeuDev, contaPalpite: contaPalpite };

  A.tela({
    id: 'conta',
    rotulo: 'Minha conta',
    papeis: ['admin', 'analista', 'dev', 'consulta'],
    titulo: function () { return 'Minha conta'; },
    render: render,
    depois: depois
  });
})();
