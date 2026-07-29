// ═══════════════════════════════════════════════════════════════════════
// Gerador de QR Code — mínimo e autocontido.
//
// Por que escrever em vez de usar um serviço (ex.: api.qrserver.com): a URL da
// sala de votação sairia da nossa infraestrutura para um terceiro em cada
// exibição. Isso contradiz o noindex/no-cache aplicado no resto do sistema.
//
// Escopo deliberadamente estreito, para ser verificável:
//   • versão 4 fixa (33x33 módulos), nível de correção L, 1 bloco
//   • modo byte (8 bits), capacidade de 78 bytes — a URL da sala usa ~55
//   • acima de 78 bytes retorna null, e a interface esconde o QR em vez de
//     desenhar algo que não escaneia
//
// Verificado por round-trip: o teste decodifica a própria matriz (desfaz a
// máscara, relê os módulos na ordem em ziguezague e reconstrói a string).
// ═══════════════════════════════════════════════════════════════════════
(function (raiz) {
  'use strict';

  const VERSAO       = 4;
  const TAM          = 17 + 4 * VERSAO;   // 33
  const TOTAL_CW     = 100;               // codewords totais da versão 4
  const EC_CW        = 20;                // nível L: 20 de correção
  const DADOS_CW     = TOTAL_CW - EC_CW;  // 80
  const CAP_BYTES    = 78;                // 80 codewords - 12 bits de cabeçalho
  const ALINHAMENTO  = [6, 26];           // centros dos padrões de alinhamento

  // ── Galois Field 256 (polinômio 0x11d) ────────────────────────────
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function tabelas() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  const mul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

  // Polinômio gerador para `n` codewords de correção.
  // Coeficientes do MAIOR para o menor grau — mesma convenção que correcao()
  // usa na divisão. Invertido, os bytes de correção saem errados: a matriz fica
  // estruturalmente perfeita e nenhum leitor aceita, porque a síndrome não zera.
  // Conferido contra os geradores conhecidos: n=7 e n=10 da especificação.
  function gerador(n) {
    let g = [1];
    for (let i = 0; i < n; i++) {
      const novo = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) {
        novo[j]     ^= g[j];                  // desloca (multiplica por x)
        novo[j + 1] ^= mul(g[j], EXP[i]);     // termo α^i
      }
      g = novo;
    }
    return g;
  }

  // Divisão polinomial: resto = codewords de correção
  function correcao(dados, n) {
    const g = gerador(n);
    const buf = dados.concat(new Array(n).fill(0));
    for (let i = 0; i < dados.length; i++) {
      const coef = buf[i];
      if (coef === 0) continue;
      for (let j = 0; j < g.length; j++) buf[i + j] ^= mul(g[j], coef);
    }
    return buf.slice(dados.length);
  }

  // ── Bitstream ─────────────────────────────────────────────────────
  function montarCodewords(bytes) {
    const bits = [];
    const põe = (valor, qtd) => { for (let i = qtd - 1; i >= 0; i--) bits.push((valor >> i) & 1); };

    põe(0b0100, 4);          // modo byte
    põe(bytes.length, 8);    // contagem: 8 bits nas versões 1–9
    bytes.forEach(b => põe(b, 8));

    // terminador + alinhamento no byte
    const limite = DADOS_CW * 8;
    for (let i = 0; i < 4 && bits.length < limite; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    const cw = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      cw.push(b);
    }
    // preenchimento padrão da especificação
    const PAD = [0xEC, 0x11];
    let k = 0;
    while (cw.length < DADOS_CW) cw.push(PAD[k++ % 2]);
    return cw;
  }

  // ── Matriz ────────────────────────────────────────────────────────
  const novaMatriz = () => Array.from({ length: TAM }, () => new Array(TAM).fill(null));

  function padroesFixos(m) {
    const finder = (lin, col) => {
      for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) {
        const L = lin + y, C = col + x;
        if (L < 0 || L >= TAM || C < 0 || C >= TAM) continue;
        const borda = (y === 0 || y === 6) && x >= 0 && x <= 6;
        const lado  = (x === 0 || x === 6) && y >= 0 && y <= 6;
        const meio  = y >= 2 && y <= 4 && x >= 2 && x <= 4;
        m[L][C] = (borda || lado || meio) ? 1 : 0;
      }
    };
    finder(0, 0); finder(0, TAM - 7); finder(TAM - 7, 0);

    // timing
    for (let i = 8; i < TAM - 8; i++) {
      const v = i % 2 === 0 ? 1 : 0;
      if (m[6][i] === null) m[6][i] = v;
      if (m[i][6] === null) m[i][6] = v;
    }

    // alinhamento
    for (const lin of ALINHAMENTO) for (const col of ALINHAMENTO) {
      if ((lin === 6 && col === 6) || (lin === 6 && col === TAM - 7) || (lin === TAM - 7 && col === 6)) continue;
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
        const borda = Math.max(Math.abs(y), Math.abs(x));
        m[lin + y][col + x] = (borda === 1) ? 0 : 1;
      }
    }

    m[TAM - 8][8] = 1;   // módulo escuro
  }

  // Posições reservadas para o formato (preenchidas depois da máscara)
  function reservarFormato(m) {
    for (let i = 0; i <= 8; i++) {
      if (m[8][i] === null) m[8][i] = 2;
      if (m[i][8] === null) m[i][8] = 2;
    }
    for (let i = 0; i < 8; i++) {
      if (m[8][TAM - 1 - i] === null) m[8][TAM - 1 - i] = 2;
      if (m[TAM - 1 - i][8] === null) m[TAM - 1 - i][8] = 2;
    }
  }

  const livre = (m, l, c) => m[l][c] === null;

  // Coloca os bits em ziguezague, de baixo para cima, colunas aos pares
  function colocarDados(m, cw) {
    const bits = [];
    cw.forEach(b => { for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1); });
    let idx = 0, subindo = true;
    for (let col = TAM - 1; col > 0; col -= 2) {
      if (col === 6) col--;                        // pula a coluna de timing
      for (let n = 0; n < TAM; n++) {
        const lin = subindo ? TAM - 1 - n : n;
        for (const c of [col, col - 1]) {
          if (!livre(m, lin, c)) continue;
          m[lin][c] = idx < bits.length ? bits[idx] : 0;
          idx++;
        }
      }
      subindo = !subindo;
    }
    return idx;
  }

  const MASCARAS = [
    (l, c) => (l + c) % 2 === 0,
    (l, c) => l % 2 === 0,
    (l, c) => c % 3 === 0,
    (l, c) => (l + c) % 3 === 0,
    (l, c) => (Math.floor(l / 2) + Math.floor(c / 3)) % 2 === 0,
    (l, c) => ((l * c) % 2) + ((l * c) % 3) === 0,
    (l, c) => (((l * c) % 2) + ((l * c) % 3)) % 2 === 0,
    (l, c) => (((l + c) % 2) + ((l * c) % 3)) % 2 === 0,
  ];

  // Penalidade simplificada: sequências longas e desequilíbrio de preto/branco.
  // Não precisa ser a métrica completa da norma — serve para escolher uma
  // máscara razoável entre as 8, e qualquer uma delas é decodificável.
  function penalidade(m) {
    let p = 0, escuros = 0;
    for (let l = 0; l < TAM; l++) {
      let seqL = 1, seqC = 1;
      for (let c = 0; c < TAM; c++) {
        if (m[l][c]) escuros++;
        if (c > 0) { if (m[l][c] === m[l][c - 1]) { seqL++; if (seqL === 5) p += 3; else if (seqL > 5) p++; } else seqL = 1; }
        if (c > 0) { if (m[c][l] === m[c - 1][l]) { seqC++; if (seqC === 5) p += 3; else if (seqC > 5) p++; } else seqC = 1; }
      }
    }
    const pct = (escuros * 100) / (TAM * TAM);
    p += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return p;
  }

  // BCH(15,5) do formato + XOR fixo da especificação
  function bitsFormato(mascara) {
    const NIVEL_L = 0b01;
    let v = (NIVEL_L << 3) | mascara;
    let bch = v << 10;
    for (let i = 4; i >= 0; i--) if ((bch >> (10 + i)) & 1) bch ^= 0b10100110111 << i;
    return ((v << 10) | bch) ^ 0b101010000010010;
  }

  function gravarFormato(m, mascara) {
    const f = bitsFormato(mascara);
    const bit = i => (f >> i) & 1;
    // cópia 1: em volta do finder superior esquerdo
    for (let i = 0; i <= 5; i++) m[8][i] = bit(i);
    m[8][7] = bit(6); m[8][8] = bit(7); m[7][8] = bit(8);
    for (let i = 9; i <= 14; i++) m[14 - i][8] = bit(i);
    // cópia 2: 8 bits na horizontal (topo à direita) e 7 na vertical (base à
    // esquerda). Invertido, sobrava um módulo sem valor e o QR não escaneava.
    for (let i = 0; i <= 7; i++)  m[8][TAM - 1 - i] = bit(i);
    for (let i = 8; i <= 14; i++) m[TAM - 15 + i][8] = bit(i);
  }

  /**
   * Gera a matriz do QR. Retorna array [linha][coluna] de 0/1, ou null se o
   * texto não couber na versão 4 (a interface deve esconder o QR nesse caso,
   * em vez de exibir um código que não escaneia).
   */
  function qrMatriz(texto) {
    const bytes = [];
    for (const ch of unescape(encodeURIComponent(String(texto)))) bytes.push(ch.charCodeAt(0));
    if (bytes.length === 0 || bytes.length > CAP_BYTES) return null;

    const dados = montarCodewords(bytes);
    const cw = dados.concat(correcao(dados, EC_CW));

    const base = novaMatriz();
    padroesFixos(base);
    reservarFormato(base);

    // Marca o que NÃO é dado antes de preencher: a máscara só pode incidir nos
    // módulos de dados. Aplicá-la sobre finders, timing e alinhamento destrói
    // os padrões que o leitor usa para se orientar.
    const fixo = base.map(l => l.map(v => v !== null));
    colocarDados(base, cw);

    let melhor = null, melhorP = Infinity;
    for (let mk = 0; mk < 8; mk++) {
      const m = base.map(l => l.slice());
      for (let l = 0; l < TAM; l++) for (let c = 0; c < TAM; c++) {
        if (fixo[l][c]) continue;                           // padrão fixo ou formato
        if (MASCARAS[mk](l, c)) m[l][c] = m[l][c] ^ 1;
      }
      gravarFormato(m, mk);
      const p = penalidade(m);
      if (p < melhorP) { melhorP = p; melhor = m; }
    }
    return melhor;
  }

  /** SVG autocontido a partir da matriz (sem imagem externa). */
  function qrSVG(texto, lado) {
    const m = qrMatriz(texto);
    if (!m) return null;
    const quiet = 4, total = TAM + quiet * 2, px = (lado || 200) / total;
    let d = '';
    for (let l = 0; l < TAM; l++) for (let c = 0; c < TAM; c++) {
      if (m[l][c]) d += `M${((c + quiet) * px).toFixed(2)} ${((l + quiet) * px).toFixed(2)}h${px.toFixed(2)}v${px.toFixed(2)}h-${px.toFixed(2)}z`;
    }
    const s = (lado || 200);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" shape-rendering="crispEdges">`
         + `<rect width="${s}" height="${s}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }

  const api = { qrMatriz, qrSVG, TAM, CAP_BYTES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { raiz.QR = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
