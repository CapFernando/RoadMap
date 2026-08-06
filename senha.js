/* ─────────────────────────────────────────────────────────────────────────
   TROCA DE SENHA PELA PRÓPRIA PESSOA
   ─────────────────────────────────────────────────────────────────────────
   Até agora só o admin trocava senha, pela aba Usuários. Duas consequências
   ruins: toda troca passava por uma pessoa (e a senha nova trafegava por Teams
   ou pessoalmente até chegar em quem ia usar), e senha inicial definida por
   terceiro tende a nunca ser trocada — fica aquela padrão que todo mundo sabe.

   Módulo compartilhado, e não uma cópia por tela: Admin, Planejamento, painel
   Dev e Poker usam a MESMA sessão (o token vive em sessionStorage sob duas
   chaves só). Quatro cópias divergiriam, e o que divergisse aqui seria a regra
   de senha.

   EXIGE CONTA PRÓPRIA, de propósito. Quem entrou pela senha compartilhada não
   tem senha individual para trocar: deixar passar mostraria um formulário que o
   servidor recusaria depois de a pessoa digitar tudo.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var URL_API = 'https://roadmap-nova-melhoria.morais-tecnologico.workers.dev';
  var MIN = 8;

  // As duas chaves que as telas usam. O dev tem a sua; Admin, Planejamento e
  // Poker compartilham a outra.
  function token() {
    try {
      return sessionStorage.getItem('rm_dev_token') ||
             sessionStorage.getItem('rm_admin_token') || '';
    } catch (_) { return ''; }
  }

  function guardaToken(novo) {
    if (!novo) return;
    try {
      // Grava na MESMA chave de onde veio, senão a tela continuaria usando a
      // antiga — que o servidor acabou de invalidar.
      if (sessionStorage.getItem('rm_dev_token')) sessionStorage.setItem('rm_dev_token', novo);
      if (sessionStorage.getItem('rm_admin_token')) sessionStorage.setItem('rm_admin_token', novo);
    } catch (_) {}
    // As telas guardam o token em variável de módulo além do sessionStorage; sem
    // avisar, elas seguiriam mandando o antigo até o próximo F5.
    try { window.dispatchEvent(new CustomEvent('rm-token-novo', { detail: novo })); } catch (_) {}
  }

  var css = document.createElement('style');
  css.textContent = [
    '.sn-ov { position:fixed; inset:0; background:rgba(0,0,0,.62); z-index:9000;',
    '  display:flex; align-items:center; justify-content:center; padding:18px; }',
    '.sn-box { background:var(--bg2,#161614); border:1px solid var(--border,#2E2E2B);',
    '  border-radius:12px; padding:20px; width:100%; max-width:400px;',
    '  font-family:Inter,system-ui,sans-serif; color:var(--text,#ECEAE2); }',
    '.sn-box h3 { margin:0 0 4px; font-size:16px; }',
    '.sn-sub { font-size:12px; color:var(--text3,#8B8B85); margin-bottom:14px; line-height:1.5; }',
    '.sn-f { display:block; margin-bottom:11px; font-size:12px; color:var(--text2,#A8A49A); }',
    '.sn-f input { width:100%; margin-top:4px; padding:9px 11px; font-size:14px;',
    '  font-family:inherit; color:var(--text,#ECEAE2); background:var(--bg3,#1E1E1C);',
    '  border:1px solid var(--border,#2E2E2B); border-radius:7px; outline:none; box-sizing:border-box; }',
    '.sn-f input:focus { border-color:var(--blue,#3B8FE8); }',
    '.sn-forca { font-size:11px; margin-top:4px; min-height:14px; }',
    '.sn-msg { font-size:12.5px; line-height:1.5; border-radius:7px; padding:9px 11px;',
    '  margin-bottom:11px; display:none; }',
    '.sn-msg.erro { display:block; background:var(--red-bg,#3A1414); color:var(--red-tx,#F9A0A0); }',
    '.sn-msg.ok { display:block; background:var(--green-bg,#0F2E1E); color:var(--green,#3EC98E); }',
    '.sn-acoes { display:flex; gap:8px; justify-content:flex-end; margin-top:4px; }',
    '.sn-b { font-family:inherit; font-size:13px; padding:8px 15px; border-radius:7px; cursor:pointer; }',
    '.sn-b.sec { background:none; color:var(--text2,#A8A49A); border:1px solid var(--border,#2E2E2B); }',
    '.sn-b.pri { background:var(--blue,#3B8FE8); color:#fff; border:none; font-weight:600; }',
    '.sn-b[disabled] { opacity:.55; cursor:default; }',
    /* O "Esqueci minha senha" das telas de login. Fica aqui, e nao em cada tela,
       porque sao quatro telas e o texto e o mesmo. */
    '.login-esqueci { display:block; width:100%; margin-top:10px; background:none;',
    '  border:none; color:var(--blue,#3B8FE8); font-family:inherit; font-size:13px;',
    '  cursor:pointer; text-align:center; padding:4px; }',
    '.login-esqueci:hover { text-decoration:underline; }',
    '.sn-relogio { font-size:12.5px; font-variant-numeric:tabular-nums;',
    '  margin-bottom:11px; padding:7px 10px; border-radius:7px;',
    '  background:var(--bg3,#1E1E1C); border:1px solid var(--border,#2E2E2B);',
    '  text-align:center; }',
  ].join('\n');
  document.head.appendChild(css);

  // Força da senha: dica, não trava. A única regra é o tamanho mínimo — regras de
  // composição ("um símbolo, uma maiúscula") empurram para Senha@2026, que é
  // pior que uma frase longa.
  function forca(s) {
    var v = String(s || '');
    if (v.length < MIN) return { txt: 'faltam ' + (MIN - v.length) + ' caractere(s)', cor: 'var(--red-tx,#F9A0A0)' };
    var variedade = (/[a-z]/.test(v) ? 1 : 0) + (/[A-Z]/.test(v) ? 1 : 0) +
                    (/\d/.test(v) ? 1 : 0) + (/[^A-Za-z0-9]/.test(v) ? 1 : 0);
    if (v.length >= 14 || variedade >= 3) return { txt: 'boa', cor: 'var(--green,#3EC98E)' };
    if (v.length >= 10) return { txt: 'razoável — uma frase longa é mais forte', cor: 'var(--amber-tx,#FFC470)' };
    return { txt: 'fraca — prefira uma frase de 14+ caracteres', cor: 'var(--amber-tx,#FFC470)' };
  }


  // ─── RECUPERAR SENHA (esqueceu) ───────────────────────────────────────
  // Liberação AUTOMÁTICA pelo e-mail: informa o e-mail corporativo, o servidor
  // confirma que existe conta e abre uma janela curta para definir a senha nova
  // ali mesmo. Sem e-mail transacional, sem serviço de terceiro, sem custo.
  //
  // O e-mail é obrigatório e é a única prova, então o retorno VALIDA o endereço:
  // "não há conta com esse e-mail" é resposta deliberada. Esconder isso num time
  // de dez pessoas com endereços públicos não protegeria nada e geraria o chamado
  // "cliquei e não aconteceu nada".
  //
  // Conta de ADMIN é recusada pelo servidor de propósito — redefinir a senha de um
  // admin só com o e-mail entregaria a ferramenta inteira. Quando isso acontece, o
  // modal oferece avisar os administradores, que é a fila antiga e continua válida
  // justamente para este caso.
  window.abrirRecuperarSenha = function () {
    if (document.getElementById('sn-rec-ov')) return;
    var ov = document.createElement('div');
    ov.id = 'sn-rec-ov';
    ov.className = 'sn-ov';
    ov.innerHTML =
      '<div class="sn-box" role="dialog" aria-label="Recuperar senha">' +
        '<h3>Recuperar senha</h3>' +
        '<div class="sn-sub">Informe seu e-mail corporativo. Se houver conta, voce define ' +
          'a nova senha aqui mesmo, na hora.</div>' +
        '<div class="sn-msg" id="rc-msg"></div>' +
        '<div id="rc-etapa1">' +
          '<label class="sn-f">E-mail corporativo *' +
            '<input type="email" id="rc-email" autocomplete="username" ' +
            'placeholder="nome.sobrenome@audaxcapitalsa.com.br" /></label>' +
          '<div class="sn-acoes">' +
            '<button type="button" class="sn-b sec" id="rc-cancel">Cancelar</button>' +
            '<button type="button" class="sn-b pri" id="rc-pedir">Continuar</button>' +
          '</div>' +
        '</div>' +
        '<div id="rc-etapa2" style="display:none">' +
          '<div class="sn-relogio" id="rc-relogio"></div>' +
          '<label class="sn-f">Nova senha' +
            '<input type="password" id="rc-nova" autocomplete="new-password" />' +
            '<div class="sn-forca" id="rc-forca"></div></label>' +
          '<label class="sn-f">Repita a nova senha' +
            '<input type="password" id="rc-conf" autocomplete="new-password" /></label>' +
          '<div class="sn-acoes">' +
            '<button type="button" class="sn-b sec" id="rc-cancel2">Cancelar</button>' +
            '<button type="button" class="sn-b pri" id="rc-salvar">Definir senha</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);

    var msg = ov.querySelector('#rc-msg');
    var e1 = ov.querySelector('#rc-etapa1');
    var e2 = ov.querySelector('#rc-etapa2');
    var relogio = ov.querySelector('#rc-relogio');
    var tk = '';
    var fim = 0;
    var timer = null;
    var fecha = function () { if (timer) clearInterval(timer); ov.remove(); };

    function aviso(t, tipo) { msg.innerHTML = t; msg.className = 'sn-msg ' + (tipo || 'erro'); }

    ov.querySelector('#rc-cancel').onclick = fecha;
    ov.querySelector('#rc-cancel2').onclick = fecha;
    ov.addEventListener('click', function (e) { if (e.target === ov) fecha(); });
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') fecha(); });

    ov.querySelector('#rc-nova').addEventListener('input', function (e) {
      var fo = forca(e.target.value);
      var el = ov.querySelector('#rc-forca');
      el.textContent = e.target.value ? fo.txt : '';
      el.style.color = fo.cor;
    });

    // O cronometro e a unica barreira de tempo entre o pedido e a senha nova, e
    // precisa ser VISIVEL: janela que expira sem avisar vira "o site quebrou".
    function tique() {
      var resta = Math.max(0, Math.round((fim - Date.now()) / 1000));
      var mm = Math.floor(resta / 60), ss = resta % 60;
      relogio.textContent = '⏱ ' + mm + ':' + (ss < 10 ? '0' : '') + ss +
                            ' para definir a nova senha';
      relogio.style.color = resta <= 60 ? 'var(--red-tx,#F9A0A0)' : 'var(--text3,#8B8B85)';
      if (resta <= 0) {
        clearInterval(timer);
        relogio.textContent = '⏱ tempo esgotado';
        ov.querySelector('#rc-salvar').disabled = true;
        aviso('O tempo terminou. Feche e peca de novo.', 'erro');
      }
    }

    ov.querySelector('#rc-pedir').onclick = async function () {
      var email = (ov.querySelector('#rc-email').value || '').trim().toLowerCase();
      if (!email) {
        aviso('Informe seu e-mail corporativo.');
        ov.querySelector('#rc-email').focus();
        return;
      }
      // Cobra o dominio aqui tambem: erro de digitacao nao precisa de ida ao
      // servidor, e a resposta imediata e mais clara.
      if (email.indexOf('@audaxcapitalsa.com.br') < 0) {
        aviso('Use o e-mail corporativo, terminando em @audaxcapitalsa.com.br.');
        ov.querySelector('#rc-email').focus();
        return;
      }
      var b = ov.querySelector('#rc-pedir');
      b.disabled = true; b.textContent = 'Verificando...';
      try {
        var r = await fetch(URL_API, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'senha-recuperar', email: email }),
        });
        var j = await r.json().catch(function () { return {}; });
        if (!r.ok) {
          if (j.error === 'admin') {
            // Fila antiga, que existe exatamente para este caso.
            aviso((j.detail || '') + '<br><br><button type="button" class="sn-b sec" ' +
                  'id="rc-avisar">Avisar os administradores</button>');
            var ba = ov.querySelector('#rc-avisar');
            if (ba) {
              ba.onclick = async function () {
                ba.disabled = true; ba.textContent = 'Enviando...';
                try {
                  await fetch(URL_API, { method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'recuperar', email: email }) });
                  aviso('Pedido registrado. Um administrador vai gerar sua nova senha.', 'ok');
                } catch (_) { aviso('Falha de rede ao registrar o pedido.'); }
              };
            }
          } else {
            aviso(j.detail || j.error || 'Nao foi possivel continuar.');
          }
          b.disabled = false; b.textContent = 'Continuar';
          return;
        }
        tk = j.token;
        fim = new Date(j.expira_em).getTime();
        aviso('Conta encontrada' + (j.nome ? ': <b>' + j.nome + '</b>' : '') +
              '. Defina a nova senha antes de o tempo acabar.', 'ok');
        e1.style.display = 'none';
        e2.style.display = 'block';
        ov.querySelector('#rc-nova').focus();
        tique();
        timer = setInterval(tique, 1000);
      } catch (e) {
        aviso('Falha de rede. Tente de novo.');
        b.disabled = false; b.textContent = 'Continuar';
      }
    };

    ov.querySelector('#rc-salvar').onclick = async function () {
      var nova = ov.querySelector('#rc-nova').value;
      var conf = ov.querySelector('#rc-conf').value;
      if (nova.length < MIN) {
        aviso('A senha precisa de ao menos ' + MIN + ' caracteres.');
        ov.querySelector('#rc-nova').focus();
        return;
      }
      if (nova !== conf) {
        aviso('A confirmacao nao confere.');
        ov.querySelector('#rc-conf').focus();
        return;
      }
      var b = ov.querySelector('#rc-salvar');
      b.disabled = true; b.textContent = 'Salvando...';
      try {
        var r = await fetch(URL_API, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'senha-redefinir', token: tk, senhaNova: nova }),
        });
        var j = await r.json().catch(function () { return {}; });
        if (!r.ok) {
          aviso(j.detail || j.error || 'Nao foi possivel salvar.');
          b.disabled = false; b.textContent = 'Definir senha';
          return;
        }
        if (timer) clearInterval(timer);
        relogio.textContent = '';
        aviso('Senha definida. Entre com a nova senha.', 'ok');
        e2.style.display = 'none';
        setTimeout(fecha, 2200);
      } catch (e) {
        aviso('Falha de rede. A senha NAO foi alterada.');
        b.disabled = false; b.textContent = 'Definir senha';
      }
    };

    ov.querySelector('#rc-email').focus();
  };

  window.abrirTrocaSenha = function () {
    if (document.getElementById('sn-ov')) return;
    if (!token()) {
      alert('Troca de senha só para quem entrou com conta própria.\n\n' +
            'Você está usando a senha compartilhada do time, que não é individual — ' +
            'peça sua conta ao administrador.');
      return;
    }
    var ov = document.createElement('div');
    ov.id = 'sn-ov';
    ov.className = 'sn-ov';
    ov.innerHTML =
      '<div class="sn-box" role="dialog" aria-label="Alterar minha senha">' +
        '<h3>Alterar minha senha</h3>' +
        '<div class="sn-sub">Mínimo de ' + MIN + ' caracteres. Ao trocar, as sessões abertas ' +
          'em outros navegadores são encerradas — aqui você continua conectado.</div>' +
        '<div class="sn-msg" id="sn-msg"></div>' +
        '<label class="sn-f">Senha atual' +
          '<input type="password" id="sn-atual" autocomplete="current-password" /></label>' +
        '<label class="sn-f">Nova senha' +
          '<input type="password" id="sn-nova" autocomplete="new-password" />' +
          '<div class="sn-forca" id="sn-forca"></div></label>' +
        '<label class="sn-f">Repita a nova senha' +
          '<input type="password" id="sn-conf" autocomplete="new-password" /></label>' +
        '<div class="sn-acoes">' +
          '<button type="button" class="sn-b sec" id="sn-cancel">Cancelar</button>' +
          '<button type="button" class="sn-b pri" id="sn-ok">Alterar senha</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);

    var msg = ov.querySelector('#sn-msg');
    var atual = ov.querySelector('#sn-atual');
    var nova = ov.querySelector('#sn-nova');
    var conf = ov.querySelector('#sn-conf');
    var btn = ov.querySelector('#sn-ok');
    var fecha = function () { ov.remove(); };

    function aviso(t, tipo) { msg.textContent = t; msg.className = 'sn-msg ' + (tipo || 'erro'); }

    nova.addEventListener('input', function () {
      var f = forca(nova.value);
      var el = ov.querySelector('#sn-forca');
      el.textContent = nova.value ? f.txt : '';
      el.style.color = f.cor;
    });

    ov.querySelector('#sn-cancel').onclick = fecha;
    ov.addEventListener('click', function (e) { if (e.target === ov) fecha(); });
    ov.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') fecha();
      if (e.key === 'Enter') btn.click();
    });

    btn.onclick = async function () {
      // Checagens locais primeiro: erro de digitação não precisa de ida ao
      // servidor, e a resposta imediata evita a dúvida "foi ou não foi".
      if (!atual.value) { aviso('Informe sua senha atual.'); atual.focus(); return; }
      if (nova.value.length < MIN) {
        aviso('A nova senha precisa de ao menos ' + MIN + ' caracteres.'); nova.focus(); return;
      }
      if (nova.value !== conf.value) {
        aviso('A confirmação não confere com a nova senha.'); conf.focus(); return;
      }
      if (nova.value === atual.value) {
        aviso('A nova senha é igual à atual.'); nova.focus(); return;
      }
      btn.disabled = true;
      btn.textContent = 'Alterando…';
      try {
        var r = await fetch(URL_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'senha-alterar', token: token(),
                                 senhaAtual: atual.value, senhaNova: nova.value }),
        });
        var j = await r.json().catch(function () { return {}; });
        if (!r.ok) {
          aviso(j.detail || j.error || 'Não foi possível alterar a senha.');
          btn.disabled = false; btn.textContent = 'Alterar senha';
          if (j.error === 'credencial') { atual.value = ''; atual.focus(); }
          return;
        }
        guardaToken(j.token);
        aviso('Senha alterada. As outras sessões foram encerradas.', 'ok');
        btn.textContent = 'Pronto';
        setTimeout(fecha, 1600);
      } catch (e) {
        aviso('Falha de rede. Sua senha NÃO foi alterada.');
        btn.disabled = false; btn.textContent = 'Alterar senha';
      }
    };
    atual.focus();
  };
})();
