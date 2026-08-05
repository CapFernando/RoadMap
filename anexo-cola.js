/* ─────────────────────────────────────────────────────────────────────────
   ZONA DE ANEXO: colar, arrastar, ou escolher no computador

   O <input type="file"> nativo abre o seletor de arquivos ao PRIMEIRO clique.
   Isso impede o gesto que a gente quer: clicar no campo e colar com Ctrl+V o
   print que acabou de tirar. Enquanto o seletor esta aberto, a pagina nao recebe
   o evento de colar.

   Entao o input nativo fica escondido e quem aparece e esta zona:
     - um clique  -> foca a zona, e o Ctrl+V cai aqui
     - dois cliques -> abre o seletor de arquivos do computador
     - arrastar e soltar -> tambem funciona, e o mesmo caminho

   O arquivo vive separado das paginas de proposito: sao sete campos de anexo em
   quatro telas, e sete copias divergiriam na primeira correcao.

   A validacao de tipo e tamanho NAO esta aqui: cada tela ja tem a sua
   (anexoPermitido / MAX). A zona so entrega os arquivos ao handler que a tela
   passou, exatamente como o input fazia.
   ───────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // Print de tela colado vem como blob sem nome. Sem nome, o handler grava
  // "undefined" e o anexo fica impossivel de identificar na lista depois.
  function nomeParaColado(tipo, i) {
    const ext = String(tipo || '').split('/')[1] || 'png';
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return 'colado-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
           '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) +
           (i ? '-' + (i + 1) : '') + '.' + ext;
  }

  function arquivosDoEvento(ev) {
    const dt = ev.clipboardData || ev.dataTransfer;
    if (!dt) return [];
    const achados = [];
    // dt.files cobre arquivo copiado do Explorer e arrastado da area de trabalho.
    if (dt.files && dt.files.length) achados.push(...dt.files);
    // dt.items cobre o print de tela, que nao aparece em dt.files em todo
    // navegador. Reembala com nome, senao chega sem identificacao.
    if (!achados.length && dt.items) {
      [...dt.items].forEach((it, i) => {
        if (it.kind !== 'file') return;
        const f = it.getAsFile();
        if (!f) return;
        achados.push(f.name && f.name !== 'image.png'
          ? f
          : new File([f], nomeParaColado(f.type, i), { type: f.type }));
      });
    }
    return achados;
  }

  /**
   * @param {string} idInput  id do <input type="file"> que ja existe na pagina
   * @param {function} onArquivos  o mesmo handler que o onchange chamava
   */
  window.ligaZonaAnexo = function (idInput, onArquivos) {
    const input = document.getElementById(idInput);
    if (!input || input.dataset.zonaLigada === '1') return;
    input.dataset.zonaLigada = '1';

    const zona = document.createElement('div');
    zona.className = 'anexo-zona';
    zona.tabIndex = 0;
    zona.setAttribute('role', 'button');
    zona.setAttribute('aria-label',
      'Anexar arquivo: clique e cole com Ctrl+V, ou clique duas vezes para escolher no computador');
    const PADRAO = '<b>Clique</b> e cole com <b>Ctrl+V</b> · <b>duplo clique</b> para escolher no computador';
    zona.innerHTML = '<span class="az-txt">' + PADRAO + '</span>';

    input.style.display = 'none';
    input.parentNode.insertBefore(zona, input);

    const txt = zona.querySelector('.az-txt');
    const diz = (html, ms) => {
      txt.innerHTML = html;
      if (ms) setTimeout(() => { if (zona.isConnected) txt.innerHTML = PADRAO; }, ms);
    };

    // Um unico clique so FOCA — e o que habilita o Ctrl+V. Abrir o seletor aqui
    // era justamente o comportamento que atrapalhava.
    zona.addEventListener('click', () => {
      zona.focus();
      diz('Pronto — cole agora com <b>Ctrl+V</b>');
    });

    zona.addEventListener('dblclick', () => {
      diz(PADRAO);
      input.click();
    });

    // Teclado: Enter ou Espaco abre o seletor. Sem isso a zona seria alcancavel
    // por Tab mas inutil sem mouse.
    zona.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); input.click(); }
    });

    zona.addEventListener('paste', (ev) => {
      const fs = arquivosDoEvento(ev);
      if (!fs.length) {
        diz('A área de transferência não tem arquivo — copie a imagem ou o PDF primeiro', 3200);
        return;
      }
      ev.preventDefault();
      diz(fs.length === 1 ? 'Colado — enviando…' : 'Colados ' + fs.length + ' — enviando…', 2600);
      onArquivos(fs);
    });

    ['dragenter', 'dragover'].forEach(e => zona.addEventListener(e, (ev) => {
      ev.preventDefault();
      zona.classList.add('sobre');
      diz('Solte para anexar');
    }));
    ['dragleave', 'dragend'].forEach(e => zona.addEventListener(e, () => {
      zona.classList.remove('sobre');
      diz(PADRAO);
    }));
    zona.addEventListener('drop', (ev) => {
      ev.preventDefault();
      zona.classList.remove('sobre');
      const fs = arquivosDoEvento(ev);
      if (!fs.length) { diz(PADRAO); return; }
      diz(fs.length === 1 ? 'Recebido — enviando…' : 'Recebidos ' + fs.length + ' — enviando…', 2600);
      onArquivos(fs);
    });
  };

  // Estilo junto do comportamento: a zona nao existe no HTML das paginas, entao
  // deixar o CSS nelas seria pedir para uma esquecer.
  const css = document.createElement('style');
  css.textContent = [
    '.anexo-zona{border:1px dashed var(--border2,#3A3A36);border-radius:9px;',
    'padding:11px 13px;font-size:12.5px;line-height:1.5;color:var(--text3,#6E6A62);',
    'background:var(--bg3,#1E1E1C);cursor:pointer;outline:none;transition:border-color .15s}',
    '.anexo-zona:hover{border-color:var(--blue,#3B8FE8)}',
    '.anexo-zona:focus{border-style:solid;border-color:var(--blue,#3B8FE8);',
    'box-shadow:0 0 0 3px rgba(59,143,232,.18)}',
    '.anexo-zona.sobre{border-style:solid;border-color:var(--green,#5FA832);',
    'background:var(--green-bg,#1E4208)}',
    '.anexo-zona b{color:var(--text2,#A8A49B);font-weight:600}',
    '.anexo-zona:focus b{color:var(--blue-tx,#9BC8F8)}',
  ].join('');
  document.head.appendChild(css);
})();
