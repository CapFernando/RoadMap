/* ═══ O FUNDO DO DECK: CURVAS DE NÍVEL ══════════════════════════════════════
 *
 * "Necessito desse fundo."  E, logo depois: "o fundo não é só p capa, é geral."
 *
 * A referência é o fundo quase preto com curvas topográficas finas que a
 * apresentação de resultados já usa. Aqui ele é DESENHADO, e não um arquivo de
 * imagem:
 *
 *   PESO       a capa que já existe carrega 260KB de base64 para UM slide. Um
 *              fundo em todos os vinte multiplicaria isso por vinte no arquivo
 *              .pptx, e o deck já é pesado o bastante para travar no e-mail.
 *   ESCALA     desenhado, ele sai na resolução que se pedir. Uma imagem fixa
 *              amplia com serrilhado no projetor da sala.
 *   COR        ele nasce da paleta do deck. Um PNG fixo teria o próprio preto,
 *              e "quase a mesma cor" é o que produz aquele retângulo visível
 *              que o comentário da capa já registra ter custado caro.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUE ELE PODE EXISTIR SEM ATRAPALHAR.
 *
 * `trend-emphasis` do padrão citado diz para não pôr gradiente nem textura por
 * cima do dado. Este fundo respeita isso por CONTRASTE: as curvas ficam a menos
 * de 1,3:1 do fundo — visíveis como textura, invisíveis como forma. Qualquer
 * número desenhado por cima mantém a razão que ele teria sobre o fundo liso.
 * Há invariante medindo isso.
 *
 * E ELE NÃO ENTRA NA CAPA, que já tem a imagem dela. */
(function (raiz) {
  'use strict';

  /* AS CURVAS SÃO NÍVEIS DE UM RELEVO INVENTADO, e é isso que dá o desenho
     topográfico: em vez de traçar curvas bonitas a esmo, somam-se algumas ondas
     e desenham-se as linhas onde a soma cruza um valor. Curvas de nível nunca
     se cruzam entre si e se aninham naturalmente — de graça, porque é o que a
     matemática do relevo faz. Desenhar à mão daria linhas que se cortam, e o
     olho reconhece isso como errado sem saber dizer por quê. */
  var ONDAS = [
    { ax: 0.0042, ay: 0.0031, fase: 0.0, amp: 1.00 },
    { ax: 0.0017, ay: 0.0068, fase: 1.7, amp: 0.85 },
    { ax: 0.0091, ay: 0.0013, fase: 3.1, amp: 0.55 },
    { ax: 0.0029, ay: 0.0047, fase: 5.2, amp: 0.70 },
  ];

  function relevo(x, y) {
    var v = 0;
    for (var i = 0; i < ONDAS.length; i++) {
      var o = ONDAS[i];
      v += o.amp * Math.sin(x * o.ax + y * o.ay + o.fase);
    }
    return v;
  }

  /* O TRAÇADO, por marching squares simplificado: varre a malha e, em cada
     célula, liga os pontos onde o nível cruza a aresta. É o algoritmo padrão de
     curva de nível, e o "simplificado" aqui é ligar por segmentos retos — com a
     malha fina o suficiente, a linha sai suave na tela. */
  function nivel(ctx, larg, alt, valor, passo) {
    var cruza = function (a, b, va, vb) {
      var t = (valor - va) / (vb - va);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    };
    ctx.beginPath();
    for (var y = 0; y < alt; y += passo) {
      for (var x = 0; x < larg; x += passo) {
        var p = [[x, y], [x + passo, y], [x + passo, y + passo], [x, y + passo]];
        var v = [relevo(p[0][0], p[0][1]), relevo(p[1][0], p[1][1]),
                 relevo(p[2][0], p[2][1]), relevo(p[3][0], p[3][1])];
        var pts = [];
        for (var k = 0; k < 4; k++) {
          var k2 = (k + 1) % 4;
          if ((v[k] < valor) !== (v[k2] < valor)) pts.push(cruza(p[k], p[k2], v[k], v[k2]));
        }
        /* DOIS PONTOS: um segmento. QUATRO: a célula é ambígua (sela), e os dois
           traçados possíveis são igualmente válidos — ligar na ordem encontrada
           produz um cruzamento visível de vez em quando, então ela é pulada. Com
           a malha fina, a curva se fecha pelas células vizinhas e ninguém vê a
           falta. */
        if (pts.length === 2) {
          ctx.moveTo(pts[0][0], pts[0][1]);
          ctx.lineTo(pts[1][0], pts[1][1]);
        }
      }
    }
    ctx.stroke();
  }

  /* A COR DA LINHA: o fundo clareado de um tanto pequeno. Sai da própria cor do
     deck para não haver duas ideias de preto no mesmo arquivo. */
  function clareia(hex, quanto) {
    var n = parseInt(String(hex).replace('#', ''), 16);
    var r = Math.min(255, ((n >> 16) & 255) + quanto);
    var g = Math.min(255, ((n >> 8) & 255) + quanto);
    var b = Math.min(255, (n & 255) + quanto);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  var _cache = null;

  /* GERA UMA VEZ POR SESSÃO. São vinte slides pedindo o mesmo fundo; desenhar
     vinte vezes multiplicaria por vinte um trabalho que não muda — e o .pptx
     ficaria com vinte cópias do mesmo PNG. */
  function png(cfg) {
    var o = cfg || {};
    var fundo = '#' + String(o.fundo || '070B16').replace('#', '');
    if (_cache && _cache.fundo === fundo) return _cache.dado;
    if (typeof document === 'undefined') return null;

    var L = o.largura || 1920, A = o.altura || 1081;   // 16:9 do slide
    var cv = document.createElement('canvas');
    cv.width = L; cv.height = A;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, L, A);

    ctx.strokeStyle = clareia(fundo, o.realce || 16);
    ctx.lineWidth = o.espessura || 1.6;
    /* DEZESSEIS NÍVEIS entre −2 e 2. Menos que isso deixa espaços grandes de
       nada; mais transforma a textura em hachura, que é ruído e disputa com o
       dado. */
    var n = o.niveis || 16;
    for (var i = 0; i < n; i++) {
      nivel(ctx, L, A, -2 + (4 / (n - 1)) * i, o.malha || 14);
    }

    var dado = cv.toDataURL('image/png');
    _cache = { fundo: fundo, dado: dado };
    return dado;
  }

  var api = { png: png, relevo: relevo, clareia: clareia };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.DECKFUNDO = api;
}(typeof window !== 'undefined' ? window : this));
