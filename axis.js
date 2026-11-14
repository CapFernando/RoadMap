/* ─────────────────────────────────────────────────────────────────────────
   AXIS — os icones de traco (`.axi`), para o app e para as telas antigas.

   As telas antigas voltaram a ser as de sempre (a interface nova e o app
   axis.html, ligado por conta: axis-interface.js). Ficou aqui so o que elas
   ainda usam: os modulos compartilhados (sprint.js, resumo-dev.js,
   resumo-projeto.js, selo-validacao.js...) desenham icones `.axi`, e sem este
   CSS eles sairiam em branco.

   Publica em `window.AXIS` e em `module.exports`, como os outros modulos.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  // Tracos de 24x24, espessura 1,8 (design-system/icones do EP-013).
  var ICONES = {
    alert: 'M12 3 2 20h20L12 3zM12 10v4M12 17h.01',
    at: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-4 7.5',
    bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
    board: 'M4 4h16v16H4zM9 8v6M13 8v3M17 8v8',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5',
    camera: 'M4 7h4l2-2h4l2 2h4v12H4zM12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    cards: 'M8 4h10v16H8zM5 7v12M12 10h2M12 14h2',
    chart: 'M3 21h18M6 17v-6M11 17V6M16 17v-4M20 17V9',
    check: 'M5 12l5 5L20 7',
    clip: 'M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    code: 'M8 6 3 12l5 6M16 6l5 6-5 6',
    external: 'M7 17 17 7M9 7h8v8',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    flag: 'M5 21V4h11l-2 4 2 4H5',
    flame: 'M12 3c1 4 5 5.5 5 10.5a5 5 0 0 1-10 0c0-3 2-4.5 2-7.5 1.5 1 2.5 2.5 2.5 4.5',
    folder: 'M3 6h6l2 2h10v11H3z',
    globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
    grip: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
    help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01',
    home: 'M3 11 12 4l9 7v9H3zM9 20v-6h6v6',
    hourglass: 'M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
    key: 'M8 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM11 11h10M18 11v3M21 11v2',
    laptop: 'M5 5h14v10H5zM2 19h20',
    layers: 'M12 3 3 8l9 5 9-5zM3 13l9 5 9-5',
    link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1',
    lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
    logout: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10',
    menu: 'M4 6h16M4 12h16M4 18h16',
    moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
    package: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
    pause: 'M9 5v14M15 5v14',
    plug: 'M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4',
    pulse: 'M3 12h4l2-5 4 10 2-5h6',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
    refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
    rocket: 'M5 15c-1 2-1 4-1 4s2 0 4-1M14 4c3 0 6 3 6 6l-7 7-6-6zM9 11l-4 1 2 2M13 15l-1 4-2-2',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5',
    send: 'M4 12l16-8-6 16-3-7z',
    shield: 'M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z',
    sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z',
    star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z',
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    ticket: 'M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z',
    undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
    upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
    users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7M18 14a6 6 0 0 1 4 7',
    ban: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8',
    calc: 'M6 3h12v18H6zM9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01',
    circle: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
    clipboard: 'M9 3h6v3H9zM8 4.5H6V21h12V4.5h-2',
    download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
    edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
    file: 'M6 3h8l4 4v14H6zM14 3v4h4',
    image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
    inbox: 'M3 13h5l1 3h6l1-3h5M5 5h14l2 8v6H3v-6z',
    medal: 'M12 13a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM8 3l3 7M16 3l-3 7M8 3h8',
    message: 'M4 5h16v11H9l-5 4z',
    pin: 'M12 17v5M8 3h8l-1 6 3 4H6l3-4z',
    plus: 'M12 5v14M5 12h14',
    present: 'M3 4h18M5 4v11h14V4M12 15v5M8 21l4-1 4 1',
    printer: 'M7 9V3h10v6M7 17H4V9h16v8h-3M7 14h10v7H7z',
    save: 'M5 3h11l3 3v15H5zM8 3v5h7V3M8 14h8v7H8z',
    tag: 'M3 12V3h9l9 9-9 9zM7.5 7.5h.01',
    target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    trend: 'M3 17l6-6 4 4 8-8M14 7h7v7',
    trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4',
    unlock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 7.5-2',
    wrench: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
    x: 'M6 6l12 12M18 6 6 18',
    zap: 'M13 2 4 14h7l-1 8 9-12h-7z'
  };

  /* O SVG sai como TEXTO, e nao como no do DOM: as telas montam HTML por
     template string, e e la que o icone precisa entrar. */
  function icone(nome, tam) {
    var d = ICONES[nome];
    if (!d) return '';
    var t = tam || '1.15em';
    return '<svg class="ax-ico" viewBox="0 0 24 24" width="' + t + '" height="' + t +
      '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"' +
      ' stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="' + d + '"/></svg>';
  }

  /* ICONE POR CLASSE: <i class="axi axi-trash"></i>.
     O traco vira mascara CSS e a cor vem do texto (currentColor). E o que
     substitui o emoji: cabe no HTML estatico E nas template strings, sem
     depender de JS no ponto de uso. As regras saem desta mesma lista de
     ICONES — uma fonte so; e sao injetadas aqui, no <head>, antes do primeiro
     desenho, porque este arquivo carrega sincrono logo apos o tema.js.
     A mascara e data: URI, e nao arquivo, para funcionar tambem em file://.
     NAO use .axi em conteudo que vira imagem (html2canvas) ou PPT: mascara
     nao e desenhada la — ali o emoji sai sem substituto. */
  function cssIcones() {
    var r = ['.axi{display:inline-block;width:1.15em;height:1.15em;flex-shrink:0;' +
      'vertical-align:-0.2em;background-color:currentColor;' +
      '-webkit-mask:var(--axi) center/contain no-repeat;mask:var(--axi) center/contain no-repeat}',
      /* Ponto de status (substitui as bolinhas coloridas): cor por --c. */
      '.axi-dot{display:inline-block;width:.62em;height:.62em;border-radius:50%;' +
      'background:var(--c,currentColor);vertical-align:.05em;flex-shrink:0}'];
    Object.keys(ICONES).forEach(function (n) {
      var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' " +
        "stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'><path d='" + ICONES[n] + "'/></svg>";
      r.push('.axi-' + n + '{--axi:url("data:image/svg+xml,' + encodeURIComponent(svg) + '")}');
    });
    return r.join('\n');
  }

  /* ═══ EMOJI VIRA ICONE NA HORA DE DESENHAR (13/11/2026) ════════════════════
   *
   * "O sistema completo na nova identidade." As telas antigas (admin, dev,
   * gantt, poker, painel publico...) escrevem emoji em titulo, botao e selo —
   * milhares de pontos, que a main continua acrescentando. Reescreve-los um a
   * um seria uma edicao de dezenas de milhares de linhas, desfeita a cada
   * merge. Aqui a troca e feita no que a tela MOSTRA: cada pictograma vira o
   * icone de traco equivalente; onde o texto nao aceita HTML (opcao de lista,
   * dica do mouse, placeholder) o emoji so sai.
   *
   * O DADO NAO MUDA: exportacoes, PPT, CSV e copias de texto saem do estado da
   * tela, e nao do DOM. As setas e marcas tipograficas (→ ✓ ✕ ▲ ★ ●) ficam,
   * como no app. O app (axis.html, `html.axa`) nao passa por aqui. */
  var EMOJI_ICONE = {
    '⚠': 'alert', '✅': 'check', '✔': 'check', '☑': 'check', '🔗': 'link', '🔒': 'lock', '🔐': 'lock', '🔓': 'unlock',
    '📋': 'clipboard', '⏳': 'hourglass', '⌛': 'hourglass', '📊': 'chart', '📈': 'trend', '📉': 'trend', '⏸': 'pause',
    '🏃': 'refresh', '🔄': 'refresh', '🔁': 'refresh', '👤': 'user', '🙋': 'user', '👥': 'users', '🙌': 'users',
    '📎': 'clip', '📅': 'calendar', '📆': 'calendar', '🗓': 'calendar', '🌴': 'calendar', '🔧': 'wrench', '🛠': 'wrench',
    '⚙': 'wrench', '🚀': 'rocket', '👁': 'eye', '🔭': 'eye', '👀': 'eye', '🗂': 'folder', '📁': 'folder', '📂': 'folder',
    '🧮': 'calc', '⚡': 'zap', '📥': 'inbox', '📤': 'upload', '🖨': 'printer', '⏰': 'clock', '⏱': 'clock', '🕐': 'clock',
    '☕': 'clock', '🏁': 'flag', '🚩': 'flag', '⚑': 'flag', '⬇': 'download', '⬆': 'upload', '🧱': 'package', '📦': 'package',
    '🔬': 'search', '🔍': 'search', '🔎': 'search', '🧪': 'search', '🔥': 'flame', '💾': 'save', '🚧': 'pulse', '🩺': 'pulse',
    '📄': 'file', '📃': 'file', '📝': 'edit', '✏': 'edit', '✍': 'edit', '✎': 'edit', '🖊': 'edit', '💻': 'laptop', '🖥': 'laptop',
    '🗑': 'trash', '🥇': 'medal', '🥈': 'medal', '🥉': 'medal', '🏅': 'medal', '🏆': 'trophy', '📽': 'present', '🎞': 'present',
    '📌': 'pin', '📍': 'pin', '💬': 'message', '🗨': 'message', '📨': 'send', '✉': 'send', '📧': 'send', '🏛': 'shield',
    '🛡': 'shield', '❌': 'x', '❎': 'x', '🚫': 'ban', '⛔': 'ban', '🔑': 'key', '🗝': 'key', '🚪': 'logout', '🗺': 'globe',
    '🧭': 'globe', '🌐': 'globe', '🎯': 'target', '⭐': 'star', '🌟': 'star', '🏷': 'tag', '🖼': 'image', '📷': 'camera',
    '💡': 'sparkles', '✨': 'sparkles', '🃏': 'cards', '🎴': 'cards', '🔔': 'bell', '📣': 'bell', '📢': 'bell', '🏠': 'home',
    '❓': 'help', '❔': 'help', 'ℹ': 'info', '🔌': 'plug', '🧾': 'receipt', '🎫': 'ticket', '🎟': 'ticket', '↩': 'undo',
    '➕': 'plus', '✚': 'plus', '📐': 'layers', '🧩': 'layers', '📚': 'layers', '💼': 'package', '🗄': 'folder',
    '🌙': 'moon', '☀': 'sun', '🔆': 'sun', '📱': 'laptop', '🤖': 'laptop', '🧑': 'user', '👨': 'user', '👩': 'user'
  };
  // Bolinhas de cor: viram o ponto do AXIS, com a cor de cada uma.
  var EMOJI_PONTO = { '🔴': 'var(--red)', '🟠': 'var(--ac)', '🟡': 'var(--amber)', '🟢': 'var(--green)', '🔵': 'var(--blue)',
    '🟣': 'var(--purple)', '⚪': 'var(--text3)', '⚫': 'var(--text)', '🟤': 'var(--amber)' };
  // Pictogramas que FICAM: setas e marcas que o app tambem usa como texto.
  var EMOJI_FICA = '▶◀↗↘↙↖↔↕↪▪▫◻◼◽◾©®™‼⁉〰';
  var RE_PICTO = null;
  try { RE_PICTO = new RegExp('(\\p{Extended_Pictographic})(\\uFE0F|\\u20E3)?(\\p{Emoji_Modifier})?', 'gu'); } catch (_) {}

  /** O que entra no lugar de um pictograma: { ico } | { ponto } | null (fica) | '' (sai). */
  function substitutoDe(ch) {
    if (EMOJI_ICONE[ch] && ICONES[EMOJI_ICONE[ch]]) return { ico: EMOJI_ICONE[ch] };
    if (EMOJI_PONTO[ch]) return { ponto: EMOJI_PONTO[ch] };
    if (EMOJI_FICA.indexOf(ch) >= 0) return null;
    return '';
  }

  /** Texto sem emoji (para atributo e <option>, que nao aceitam icone). */
  function semEmoji(t) {
    if (!RE_PICTO || !t) return t;
    return String(t).replace(RE_PICTO, function (todo, ch) {
      return substitutoDe(ch) === null ? todo : '\u0000';
    }).replace(/\u0000\s?/g, '').replace(/^\s+/, function (m) { return m; });
  }

  var PULA = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, NOSCRIPT: 1, svg: 1, SVG: 1, CODE: 0 };
  var ATRS = ['title', 'placeholder', 'aria-label', 'alt'];

  function trocaNoTexto(no) {
    var t = no.nodeValue;
    if (!t || !RE_PICTO.test(t)) return;
    RE_PICTO.lastIndex = 0;
    var frag = document.createDocumentFragment(), ult = 0, m, mexeu = false;
    while ((m = RE_PICTO.exec(t))) {
      var sub = substitutoDe(m[1]);
      if (sub === null) continue;
      mexeu = true;
      if (m.index > ult) frag.appendChild(document.createTextNode(t.slice(ult, m.index)));
      if (sub && sub.ico) {
        var i = document.createElement('i');
        i.className = 'axi axi-' + sub.ico + ' axi-emoji';
        i.setAttribute('aria-hidden', 'true');
        frag.appendChild(i);
      } else if (sub && sub.ponto) {
        var d = document.createElement('i');
        d.className = 'axi-dot axi-emoji';
        d.style.setProperty('--c', sub.ponto);
        d.setAttribute('aria-hidden', 'true');
        frag.appendChild(d);
      }
      ult = m.index + m[0].length;
      // Emoji que so saiu: leva junto o espaco que o separava do texto.
      if (sub === '' && t.charAt(ult) === ' ') ult++;
    }
    RE_PICTO.lastIndex = 0;
    if (!mexeu) return;
    if (ult < t.length) frag.appendChild(document.createTextNode(t.slice(ult)));
    if (no.parentNode) no.parentNode.replaceChild(frag, no);
  }

  function trocaAtributos(el) {
    for (var k = 0; k < ATRS.length; k++) {
      var v = el.getAttribute && el.getAttribute(ATRS[k]);
      if (v && RE_PICTO.test(v)) { RE_PICTO.lastIndex = 0; var nv = semEmoji(v); if (nv !== v) el.setAttribute(ATRS[k], nv); }
      RE_PICTO.lastIndex = 0;
    }
  }

  /** Troca os emojis de um pedaco da tela (o no e tudo abaixo dele). */
  function trocaEmojis(raizNo) {
    if (!RE_PICTO || !raizNo) return;
    if (raizNo.nodeType === 3) {
      var pai = raizNo.parentNode;
      if (pai && !pula(pai)) trocaNoTexto(raizNo);
      return;
    }
    if (raizNo.nodeType !== 1 || pula(raizNo)) {
      if (raizNo.nodeType === 1 && (raizNo.tagName === 'OPTION' || raizNo.tagName === 'SELECT')) limpaOpcoes(raizNo);
      return;
    }
    trocaAtributos(raizNo);
    var w = document.createTreeWalker(raizNo, 1 | 4, null), textos = [], n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 1) {
        trocaAtributos(n);
        if (n.tagName === 'OPTION') limpaOpcoes(n);
      } else if (n.parentNode && !pula(n.parentNode)) textos.push(n);
    }
    textos.forEach(trocaNoTexto);
  }
  function pula(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentNode) {
      if (PULA[e.tagName] || e.isContentEditable) return true;
      if (e.hasAttribute && e.hasAttribute('data-axis-emoji')) return true;   // "nao troque aqui"
    }
    return false;
  }
  function limpaOpcoes(el) {
    var ops = el.tagName === 'OPTION' ? [el] : el.querySelectorAll('option');
    for (var i = 0; i < ops.length; i++) {
      var t = ops[i].textContent;
      if (t && RE_PICTO.test(t)) { RE_PICTO.lastIndex = 0; var nt = semEmoji(t); if (nt !== t) ops[i].textContent = nt; }
      RE_PICTO.lastIndex = 0;
    }
  }

  function ligaTrocaDeEmojis() {
    if (!RE_PICTO || typeof MutationObserver === 'undefined') return;
    var html = document.documentElement;
    if (html.classList.contains('axa')) return;            // o app ja desenha icones
    var obs = new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (m.type === 'childList') { for (var j = 0; j < m.addedNodes.length; j++) trocaEmojis(m.addedNodes[j]); }
        else if (m.type === 'characterData') trocaEmojis(m.target);
        else if (m.type === 'attributes') trocaAtributos(m.target);
      }
    });
    var vai = function () {
      trocaEmojis(document.body);
      obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRS });
    };
    if (document.body) vai(); else document.addEventListener('DOMContentLoaded', vai);
    // O titulo da aba tambem.
    if (document.title) document.title = semEmoji(document.title).trim();
  }

  var AXIS = { icone: icone, ICONES: ICONES, cssIcones: cssIcones,
               EMOJI_ICONE: EMOJI_ICONE, substitutoDe: substitutoDe, semEmoji: semEmoji, trocaEmojis: trocaEmojis };
  if (typeof window !== 'undefined') {
    window.AXIS = AXIS;
    if (!document.getElementById('axis-icones')) {
      var st = document.createElement('style');
      st.id = 'axis-icones';
      st.textContent = cssIcones();
      (document.head || document.documentElement).appendChild(st);
    }
    ligaTrocaDeEmojis();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = AXIS;
})();
