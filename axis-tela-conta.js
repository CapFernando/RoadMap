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
            '<span class="in v">' + H.esc(nomesDem.join(' / ') || '—') + '</span>')
        : '') +
      pref('Tela inicial', 'onde o AXIS abre depois do login — hoje sempre o Início', nd) +
      pref('Notificações', 'Teams, e-mail e resumo diário', nd) +
      (papel === 'dev'
        ? '<span class="note">O nome nas demandas é ligado pelo administrador. Se as demandas mostradas não forem as suas, use “Não são as minhas demandas” no <a href="dev.html" title="Abre o Meu painel (dev.html)">Meu painel ' + H.ico('external', 'style="font-size:11px"') + '</a>.</span>'
        : '') +
      '</section>';

    var exemplo = 'curl -s ' + WORKER + ' \\\n' +
      '  -H "Content-Type: application/json" \\\n' +
      '  -d \'{"action":"login","login":"' + (e.login || 'seu.usuario') + '","senhaUsuario":"SUA_SENHA"}\'\n' +
      '# resposta: {"ok":true,"token":"...","usuario":{...}}';
    var api = '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2">Acesso pela API</h2>' +
      (papel !== 'consulta' ? '<a class="btns" href="dev.html" title="A documentação das rotas fica na aba Endpoint do Meu painel (dev.html)">Ver as rotas ' + H.ico('external', 'style="font-size:11px"') + '</a>' : '') + '</div>' +
      '<span class="note">Token pessoal da API ainda não disponível. Scripts entram com o seu usuário e senha pela rota <span class="mono">login</span> e usam o token que ela devolve, com a mesma permissão que você tem na tela.</span>' +
      '<pre class="mono ct-pre">' + H.esc(exemplo) + '</pre>' +
      '</section>';

    return '<header style="display:flex;flex-direction:column;gap:6px"><h1 class="h1">Minha conta</h1>' +
      '<span class="sub">Login e senha são os do RoadMap. Aqui ficam seus dados, a troca de senha e a preferência de tema.</span></header>' +
      '<div class="ct-grid">' + cartao + '<div style="display:flex;flex-direction:column;gap:16px;min-width:0">' + prefs + api + '</div></div>';
  }

  function depois(el) {
    el.onclick = function (ev) {
      var b = ev.target.closest('[data-ct]');
      if (!b) return;
      var q = b.getAttribute('data-ct');
      if (q === 'senha') {
        if (typeof window.abrirTrocaSenha === 'function') window.abrirTrocaSenha();
        else H.toast('A troca de senha não carregou. Use a tela Minha senha do Admin ou do Meu painel.', 'erro');
        return;
      }
      if (q === 'tema') {
        var quer = b.getAttribute('data-v');
        if (window.temaAtual && window.temaAlternar && window.temaAtual() !== quer) window.temaAlternar();
        A.desenhar();
      }
    };
  }

  A.tela({
    id: 'conta',
    rotulo: 'Minha conta',
    papeis: ['admin', 'dev', 'consulta'],
    titulo: function () { return 'Minha conta'; },
    render: render,
    depois: depois
  });
})();
