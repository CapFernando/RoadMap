/* ─────────────────────────────────────────────────────────────────────────
   DIÁLOGOS DA PÁGINA — no lugar de prompt() e alert() do navegador
   ─────────────────────────────────────────────────────────────────────────
   Motivo da pausa, parecer da devolução, motivo da recusa, nome, e-mail, senha:
   tudo isso era pedido com o `prompt()` nativo. Três problemas, e o terceiro é
   o que quebra de verdade:

   1. Aparência: a caixa diz "capfernando.github.io diz", não se estiliza, não
      acompanha o tema e não parece parte da ferramenta.
   2. Um campo de uma linha para texto que é parágrafo. O parecer que o dev vai
      ler chega espremido numa caixinha sem quebra de linha.
   3. O NAVEGADOR PODE DESLIGAR. Depois do segundo diálogo seguido, o Chrome
      oferece "impedir que esta página crie caixas de diálogo adicionais"; quem
      marcar isso passa a receber `null` de TODO prompt() seguinte, em silêncio.
      O motivo da pausa voltaria vazio, a gravação seguiria adiante e ninguém
      entenderia por quê. Não há como detectar nem como reverter pela página.

   Aqui os diálogos são da página: aceitam texto longo, validam antes de fechar,
   respondem a Esc e Enter, e não somem por configuração do navegador.

   `pedirTexto` devolve Promise<string|null> — `null` é cancelamento, e é o
   mesmo contrato do prompt() que ele substitui, para a conversão dos chamadores
   não mudar a lógica de cada um.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var css = document.createElement('style');
  css.textContent = [
    '.dlg-ov { position:fixed; inset:0; background:rgba(0,0,0,.62); z-index:9500;',
    '  display:flex; align-items:center; justify-content:center; padding:18px; }',
    '.dlg-box { background:var(--bg2,#161614); border:1px solid var(--border,#2E2E2B);',
    '  border-radius:12px; padding:20px; width:100%; max-width:440px;',
    '  font-family:Inter,system-ui,sans-serif; color:var(--text,#ECEAE2);',
    '  box-shadow:0 18px 48px rgba(0,0,0,.45); }',
    '.dlg-box h3 { margin:0 0 6px; font-size:16px; font-weight:600; }',
    '.dlg-sub { font-size:12.5px; color:var(--text3,#8B8B85); line-height:1.55;',
    '  margin-bottom:13px; white-space:pre-wrap; }',
    '.dlg-box input, .dlg-box textarea { width:100%; padding:9px 11px; font-size:14px;',
    '  font-family:inherit; color:var(--text,#ECEAE2); background:var(--bg3,#1E1E1C);',
    '  border:1px solid var(--border,#2E2E2B); border-radius:7px; outline:none;',
    '  box-sizing:border-box; }',
    '.dlg-box textarea { min-height:96px; resize:vertical; line-height:1.5; }',
    '.dlg-box input:focus, .dlg-box textarea:focus { border-color:var(--blue,#3B8FE8); }',
    '.dlg-erro { font-size:12px; color:var(--red-tx,#F9A0A0); margin-top:6px; min-height:15px; }',
    '.dlg-acoes { display:flex; gap:8px; justify-content:flex-end; margin-top:10px; }',
    '.dlg-b { font-family:inherit; font-size:13px; padding:8px 16px; border-radius:7px;',
    '  cursor:pointer; }',
    '.dlg-b.sec { background:none; color:var(--text2,#A8A49A);',
    '  border:1px solid var(--border,#2E2E2B); }',
    '.dlg-b.pri { background:var(--blue,#3B8FE8); color:#fff; border:none; font-weight:600; }',
    '.dlg-b.perigo { background:var(--red,#E5484D); color:#fff; border:none; font-weight:600; }',
  ].join('\n');
  document.head.appendChild(css);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* o = {
       titulo, texto, valor, multilinha, senha, obrigatorio, minimo,
       ok (rótulo do botão), perigo (botão vermelho), placeholder,
       valida: (v) => 'mensagem de erro' | ''
     }
     Devolve Promise<string|null>. */
  window.pedirTexto = function (o) {
    o = o || {};
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.className = 'dlg-ov';
      var campo = o.multilinha
        ? '<textarea id="dlg-in" placeholder="' + esc(o.placeholder || '') + '"></textarea>'
        : '<input type="' + (o.senha ? 'password' : 'text') + '" id="dlg-in" ' +
          'placeholder="' + esc(o.placeholder || '') + '" ' +
          (o.senha ? 'autocomplete="new-password"' : '') + ' />';
      ov.innerHTML =
        '<div class="dlg-box" role="dialog" aria-modal="true">' +
          '<h3>' + esc(o.titulo || 'Informe') + '</h3>' +
          (o.texto ? '<div class="dlg-sub">' + esc(o.texto) + '</div>' : '') +
          campo +
          '<div class="dlg-erro" id="dlg-erro"></div>' +
          '<div class="dlg-acoes">' +
            '<button type="button" class="dlg-b sec" id="dlg-nao">Cancelar</button>' +
            '<button type="button" class="dlg-b ' + (o.perigo ? 'perigo' : 'pri') + '" id="dlg-sim">' +
              esc(o.ok || 'Confirmar') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(ov);

      var input = ov.querySelector('#dlg-in');
      var erro = ov.querySelector('#dlg-erro');
      input.value = o.valor == null ? '' : String(o.valor);

      function fecha(r) { ov.remove(); resolve(r); }

      function confirma() {
        var v = String(input.value || '').trim();
        if (o.obrigatorio && !v) {
          erro.textContent = 'Este campo é obrigatório.';
          input.focus();
          return;
        }
        if (o.minimo && v.length < o.minimo) {
          erro.textContent = 'Faltam ' + (o.minimo - v.length) + ' caractere(s).';
          input.focus();
          return;
        }
        if (typeof o.valida === 'function') {
          var m = o.valida(v);
          if (m) { erro.textContent = m; input.focus(); return; }
        }
        fecha(v);
      }

      ov.querySelector('#dlg-sim').onclick = confirma;
      ov.querySelector('#dlg-nao').onclick = function () { fecha(null); };
      ov.addEventListener('click', function (e) { if (e.target === ov) fecha(null); });
      ov.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); fecha(null); }
        // Enter confirma no campo de uma linha. No textarea NÃO: ali Enter é
        // quebra de parágrafo, e roubar isso estragaria justamente o texto longo
        // que este diálogo existe para permitir. Ctrl+Enter confirma.
        if (e.key === 'Enter' && (!o.multilinha || e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          confirma();
        }
      });
      input.addEventListener('input', function () { erro.textContent = ''; });
      setTimeout(function () { input.focus(); input.select && input.select(); }, 10);
    });
  };


  /* Substitui confirm(). o = { titulo, texto, ok, cancelar, perigo }.
     Devolve Promise<boolean> — mesmo contrato do confirm(), para a conversao dos
     chamadores nao mudar a logica de nenhum deles.

     O `perigo` pinta o botao de vermelho. Vale a pena: excluir demanda, apagar
     projeto e descartar alteracao nao publicada estavam com a mesma cara de
     "salvar", e o dedo aprende a clicar no botao da direita sem ler. */
  window.confirmar = function (o) {
    o = o || {};
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.className = 'dlg-ov';
      ov.innerHTML =
        '<div class="dlg-box" role="dialog" aria-modal="true">' +
          '<h3>' + esc(o.titulo || 'Confirmar') + '</h3>' +
          (o.texto ? '<div class="dlg-sub">' + esc(o.texto) + '</div>' : '') +
          '<div class="dlg-acoes">' +
            '<button type="button" class="dlg-b sec" id="dlg-nao">' +
              esc(o.cancelar || 'Cancelar') + '</button>' +
            '<button type="button" class="dlg-b ' + (o.perigo ? 'perigo' : 'pri') + '" id="dlg-sim">' +
              esc(o.ok || 'Confirmar') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(ov);
      var fecha = function (r) { ov.remove(); resolve(r); };
      ov.querySelector('#dlg-sim').onclick = function () { fecha(true); };
      ov.querySelector('#dlg-nao').onclick = function () { fecha(false); };
      // Clicar fora e Esc CANCELAM. Nunca confirmam: o gesto ambiguo tem de cair
      // no lado que nao apaga nada.
      ov.addEventListener('click', function (e) { if (e.target === ov) fecha(false); });
      ov.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); fecha(false); }
        if (e.key === 'Enter') { e.preventDefault(); fecha(true); }
      });
      // Foco no CANCELAR quando a acao e destrutiva: Enter apressado nao pode
      // apagar. Nas demais, foco no confirmar, que e o caminho esperado.
      setTimeout(function () {
        ov.querySelector(o.perigo ? '#dlg-nao' : '#dlg-sim').focus();
      }, 10);
    });
  };

  /* TRES RESPOSTAS, e nao duas.
     "Salvar antes de fechar?" com Sim/Nao empurra a perda para o Nao — e Nao e o
     botao que a pessoa aperta no automatico. Com tres, descartar tem de ser dito
     com o dedo, e o gesto ambiguo (Esc, clique fora) cai em "continuar editando",
     que e o unico que nao apaga nada.

     Devolve 'ok' (o principal), 'alt' (o do meio) ou '' (ficou onde estava).      */
  window.escolher3 = function (o) {
    o = o || {};
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.className = 'dlg-ov';
      ov.innerHTML =
        '<div class="dlg-box" role="dialog" aria-modal="true">' +
          '<h3>' + esc(o.titulo || 'Confirmar') + '</h3>' +
          (o.texto ? '<div class="dlg-sub">' + esc(o.texto) + '</div>' : '') +
          '<div class="dlg-acoes">' +
            '<button type="button" class="dlg-b sec" id="dlg-fica">' +
              esc(o.fica || 'Continuar editando') + '</button>' +
            '<button type="button" class="dlg-b perigo" id="dlg-alt">' +
              esc(o.alt || 'Descartar') + '</button>' +
            '<button type="button" class="dlg-b pri" id="dlg-ok">' +
              esc(o.ok || 'Salvar') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(ov);
      var fecha = function (r) { ov.remove(); resolve(r); };
      ov.querySelector('#dlg-ok').onclick = function () { fecha('ok'); };
      ov.querySelector('#dlg-alt').onclick = function () { fecha('alt'); };
      ov.querySelector('#dlg-fica').onclick = function () { fecha(''); };
      ov.addEventListener('click', function (e) { if (e.target === ov) fecha(''); });
      ov.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); fecha(''); }
        if (e.key === 'Enter') { e.preventDefault(); fecha('ok'); }
      });
      setTimeout(function () { ov.querySelector('#dlg-ok').focus(); }, 10);
    });
  };

  /* A GUARDA DO CARD ABERTO.
     Duas tasks foram perdidas pelo mesmo motivo: o card fecha calado. Clicou no X,
     apertou Esc ou clicou fora, e o que foi digitado morreu ali.

     O retrato sai dos PROPRIOS CAMPOS do formulario, e nao de uma lista de nomes:
     lista escrita a mao esquece o campo novo, e o campo esquecido e justamente o
     que fecha sem avisar.                                                        */
  var guardas = {};

  function retrato(modalId) {
    var el = document.getElementById(modalId);
    if (!el) return '';
    return [].map.call(el.querySelectorAll('input, select, textarea'), function (c) {
      if (c.type === 'file') return '';          // arquivo nao se compara por valor
      if (c.type === 'checkbox' || c.type === 'radio') return (c.name || c.id) + '=' + c.checked;
      return (c.name || c.id) + '=' + c.value;
    }).join('');
  }

  // Liga a guarda: chame ao ABRIR o card, depois de preencher os campos.
  window.guardaLiga = function (modalId, salvar) {
    guardas[modalId] = { base: retrato(modalId), salvar: salvar };
  };
  // Desliga: chame depois de gravar com sucesso, ou quando o card ja nao esta aberto.
  window.guardaDesliga = function (modalId) { delete guardas[modalId]; };
  // Reatualiza o retrato (gravou e continua no card).
  window.guardaSincroniza = function (modalId) {
    if (guardas[modalId]) guardas[modalId].base = retrato(modalId);
  };
  window.guardaMexeu = function (modalId) {
    var g = guardas[modalId];
    return !!g && retrato(modalId) !== g.base;
  };

  // Devolve true se pode fechar. Pergunta so quando ha o que perder.
  window.guardaPodeFechar = async function (modalId) {
    var g = guardas[modalId];
    if (!g || !window.guardaMexeu(modalId)) return true;
    var r = await window.escolher3({
      titulo: 'Você mexeu neste card e não gravou.',
      texto: 'Salvar agora, descartar o que você digitou, ou voltar para o card?',
      ok: 'Salvar', alt: 'Descartar', fica: 'Continuar editando',
    });
    if (r === 'ok') {
      var okSalvo = true;
      try { okSalvo = await g.salvar(); } catch (e) { okSalvo = false; }
      if (okSalvo === false) return false;
      // A GRAVACAO QUE DA CERTO FECHA O CARD SOZINHA — as tres telas fazem isso.
      // Se o card continua aberto, a gravacao parou numa validacao (falta titulo,
      // tipo, horas...) e a maioria dessas funcoes nao devolve nada. Fechar aqui
      // jogaria fora justamente o que se quer proteger, entao o card fica.
      var el = document.getElementById(modalId);
      var aberto = el && getComputedStyle(el).display !== 'none';
      if (aberto && okSalvo !== true) return false;
      window.guardaDesliga(modalId);
      return true;
    }
    if (r === 'alt') { window.guardaDesliga(modalId); return true; }
    return false;
  };

  // Substitui alert(). Promise<void>, para o chamador poder esperar.
  window.avisar = function (titulo, texto) {
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.className = 'dlg-ov';
      ov.innerHTML =
        '<div class="dlg-box" role="dialog" aria-modal="true">' +
          '<h3>' + esc(titulo || 'Aviso') + '</h3>' +
          (texto ? '<div class="dlg-sub">' + esc(texto) + '</div>' : '') +
          '<div class="dlg-acoes">' +
            '<button type="button" class="dlg-b pri" id="dlg-ok">Entendi</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(ov);
      var fecha = function () { ov.remove(); resolve(); };
      ov.querySelector('#dlg-ok').onclick = fecha;
      ov.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); fecha(); }
      });
      setTimeout(function () { ov.querySelector('#dlg-ok').focus(); }, 10);
    });
  };
})();
