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
