/* ═══ A GRAMÁTICA ÚNICA DOS GRÁFICOS DO DECK ════════════════════════════════
 *
 * "Necessito de um padrão único para toda apresentação na demonstração
 *  gráfica."  E, sobre o comparativo: "no gráfico mês atual x mês anterior,
 *  falta detalhes da evolução ou involução. Crescimento e comparativo."
 *
 * Veio de uma reunião de diretoria com muitas críticas, e a instrução foi
 * seguir o padrão de `ui-ux-pro-max`. As regras dele que mandam aqui:
 *
 *   `color-not-only`    não transmitir informação só pela cor
 *   `direct-labeling`   com poucos dados, rotular o valor no próprio gráfico
 *   `gridline-subtle`   grade de baixo contraste, que não compete com o dado
 *   `contrast-data`     dado ≥3:1 contra o fundo; rótulo ≥4.5:1
 *   `chart-type`        tendência → linha; comparação → barra
 *   `number-formatting` número no formato de quem lê (pt-BR)
 *   `trend-emphasis`    sem gradiente nem sombra por cima do dado
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * O DELTA TEM TRÊS CANAIS, E ISSO É A REGRA CENTRAL DESTE ARQUIVO.
 *
 *   SETA    ▲ ▼ ▬     a direção, visível sem cor
 *   SINAL   +12 / −8  o número, com o sinal escrito
 *   COR     verde / vermelho / cinza
 *
 * Três porque a cor sozinha não serve: parte da diretoria lê o slide impresso
 * em preto e branco, e daltonismo vermelho-verde atinge 8% dos homens. Um
 * "crescemos" que só existe em verde não foi dito para essas pessoas.
 *
 * E A DIREÇÃO NÃO É BOA OU MÁ POR SI: subir entregas é bom, subir atrasadas é
 * ruim. Quem chama diz qual é o caso em `bomSubir`, e o padrão é `true` porque
 * a maioria dos indicadores do deck é "quanto mais, melhor". */
(function (raiz) {
  'use strict';

  /* A PALETA DO DADO. São as mesmas do `apresentacao.js` — há invariante
     cobrando que não divirjam, porque duas paletas é como o deck já errou
     antes (o mesmo âmbar significando duas coisas em slides vizinhos).
     Medido: todas passam 4.5:1 sobre os três fundos do deck. */
  var COR = {
    fundo: '070B16', fundo2: '0E1428', fundo3: '141C36', borda: '223052',
    texto: 'FFFFFF', fraco: '8792AD',
    azul: '60A5FA', verde: '4ADE80', vermelho: 'F87171', ambar: 'FBBF24', roxo: 'A78BFA',
  };

  /* ─── NÚMERO NO FORMATO DE QUEM LÊ ─────────────────────────────────────
     `1.234` e não `1234`. O separador de milhar é o que permite ler a ordem de
     grandeza de relance — e é ela que a diretoria compara, não o dígito. */
  function num(v) {
    var n = Number(v);
    if (!isFinite(n)) return '—';
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  }

  /* ─── O DELTA ──────────────────────────────────────────────────────────
   *
   * Devolve tudo o que o desenho precisa, já decidido — para nenhuma tela
   * decidir de novo e diferente.
   *
   * O PERCENTUAL NÃO EXISTE QUANDO A BASE É ZERO, e `Infinity%` é pior do que
   * não dizer: de 0 para 5 não é "crescimento de infinito por cento", é "não
   * havia e agora há 5". O campo vem `null` e o texto diz a frase. */
  /* `neutro` EXISTE PORQUE NEM TODA GRANDEZA TEM LADO BOM, e a regra desta base
   * é explícita: "nenhuma cor com juízo pode aparecer num número que não tem
   * meta". Horas realizadas é o caso — subir não é mérito nem falha, é o
   * tamanho do mês. Pintar "+115h" de verde faz o slide dar uma nota que
   * ninguém combinou, e foi assim que o âmbar já significou duas coisas em
   * slides vizinhos.
   *
   * SETA E SINAL FICAM. O que sai é só o juízo: a direção continua dita, e em
   * dois canais — quem lê impresso em preto e branco não perde nada. */
  function delta(atual, anterior, opts) {
    var o = opts || {};
    var bomSubir = o.bomSubir !== false;
    var a = Number(atual) || 0;
    var b = Number(anterior) || 0;
    var dif = a - b;
    var pct = b === 0 ? null : (dif / Math.abs(b)) * 100;
    var dir = dif > 0 ? 'sobe' : (dif < 0 ? 'desce' : 'igual');
    var bom = (o.neutro || dir === 'igual') ? null : ((dir === 'sobe') === bomSubir);

    return {
      atual: a, anterior: b, dif: dif, pct: pct, dir: dir, bom: bom,
      /* A SETA É GLIFO DE TEXTO, e não um triângulo desenhado: ela precisa
         acompanhar o tamanho da fonte e sobreviver ao PDF e à impressão. */
      seta: dir === 'sobe' ? '▲' : (dir === 'desce' ? '▼' : '▬'),
      /* O SINAL SEMPRE ESCRITO no diferente de zero — inclusive o `+`. Aqui ele
         informa: sem o sinal, "12" ao lado de uma seta é ambíguo entre "subiu
         para 12" e "subiu 12". */
      sinal: dif > 0 ? '+' + num(dif) : (dif < 0 ? '−' + num(Math.abs(dif)) : '0'),
      cor: bom === null ? COR.fraco : (bom ? COR.verde : COR.vermelho),
      /* O TEXTO COMPLETO, para quem vai narrar o slide e para o rodapé. */
      texto: (function () {
        if (dir === 'igual') return 'igual ao período anterior';
        var vb = dir === 'sobe' ? 'subiu' : 'caiu';
        if (pct === null) return vb + ' ' + num(Math.abs(dif)) + ' (não havia base)';
        return vb + ' ' + num(Math.abs(dif)) + ' (' + num(Math.abs(pct)) + '%)';
      }()),
      pctTexto: pct === null ? '—' : (pct > 0 ? '+' : (pct < 0 ? '−' : '')) +
                num(Math.abs(pct)) + '%',
    };
  }

  /* ─── O CHIP DO DELTA ──────────────────────────────────────────────────
   *
   * Um retângulo com a seta, o número e o percentual. É o mesmo objeto em todo
   * slide: quem aprendeu a lê-lo no primeiro já sabe ler nos outros.
   *
   * `pptx` entra como argumento porque `ShapeType` vive nele — este arquivo não
   * importa a biblioteca, e assim ele roda em teste sem navegador. */
  function chipDelta(s, pptx, cfg) {
    var d = cfg.delta;
    var x = cfg.x, y = cfg.y, w = cfg.w || 1.5, h = cfg.h || 0.3;
    var fs = cfg.fontSize || 11;
    if (cfg.caixa !== false) {
      s.addShape(pptx.ShapeType.roundRect, {
        x: x, y: y, w: w, h: h, rectRadius: 0.06,
        fill: { color: COR.fundo3 }, line: { color: COR.borda, width: 0.5 },
      });
    }
    /* SETA + SINAL + PERCENTUAL, na mesma linha e na mesma cor. O rótulo do
       que está sendo comparado fica FORA do chip, com quem o chamou: dentro,
       ele empurraria o número para um tamanho que não se lê do fundo da sala. */
    s.addText([
      { text: d.seta + ' ', options: { color: d.cor, bold: true } },
      { text: d.sinal, options: { color: d.cor, bold: true } },
      { text: d.pct === null ? '' : '  ' + d.pctTexto,
        options: { color: COR.fraco } },
    ], { x: x, y: y, w: w, h: h, fontSize: fs, align: 'center', valign: 'middle', wrap: false });
  }

  /* ─── BARRAS COMPARADAS ────────────────────────────────────────────────
   *
   * Uma série por categoria, com o VALOR ESCRITO em cima de cada barra
   * (`direct-labeling`: com poucos dados, rotular no gráfico poupa a ida ao
   * eixo) e uma linha de base fina.
   *
   * SEM EIXO Y E SEM GRADE: com o valor escrito na barra, a grade vira ruído —
   * `gridline-subtle` diz que ela não pode competir com o dado, e a forma mais
   * segura de não competir é não existir quando não é necessária. A linha de
   * base fica, porque é ela que ancora a comparação de alturas. */
  function barras(s, pptx, cfg) {
    var itens = (cfg.itens || []).filter(Boolean);
    if (!itens.length) return;
    var X0 = cfg.x, LARG = cfg.w, BASE = cfg.base, ALTO = cfg.h;
    var col = LARG / itens.length;

    /* UMA OU VÁRIAS SÉRIES POR COLUNA, pela MESMA função. Antes cada slide
       desenhava a sua barra, e por isso o deck tinha três larguras de barra,
       dois lugares para o valor e duas alturas de rótulo — que é a crítica de
       "padrão único" traduzida em pixels. */
    var seriesDe = function (it) {
      return it.series && it.series.length ? it.series : [{ valor: it.valor, cor: it.cor }];
    };
    var max = itens.reduce(function (m, it) {
      return seriesDe(it).reduce(function (mm, sr) {
        return Math.max(mm, Math.abs(Number(sr.valor) || 0));
      }, m);
    }, 1);
    var nSer = seriesDe(itens[0]).length;
    var vao = 0.07;
    var larg = Math.min(cfg.largura || 0.62,
                        (col * 0.62 - vao * (nSer - 1)) / nSer);

    // A linha de base: fina, cor de borda. Ancora sem disputar com o dado.
    s.addShape(pptx.ShapeType.rect, {
      x: X0, y: BASE, w: LARG, h: 0.012, fill: { color: COR.borda } });

    /* DEVOLVE A GEOMETRIA DE CADA BARRA. Quem chama precisa dela para ligar o
       topo de uma ao topo da outra (ver `conector`) — e recalcular a posição do
       lado de fora seria a segunda implementação da mesma conta, com a garantia
       de divergir no dia em que a largura da barra mudar aqui. */
    var pontos = [];
    itens.forEach(function (it, i) {
      var sr = seriesDe(it);
      var largGrupo = sr.length * larg + (sr.length - 1) * vao;
      var cx0 = X0 + i * col + (col - largGrupo) / 2;
      pontos.push([]);
      sr.forEach(function (b, k) {
        var v = Number(b.valor) || 0;
        var alt = Math.max(0.04, ALTO * (Math.abs(v) / max));
        var cx = cx0 + k * (larg + vao);
        pontos[i].push({ x: cx + larg / 2, y: BASE - alt, valor: v, cor: b.cor });
        s.addShape(pptx.ShapeType.rect, {
          x: cx, y: BASE - alt, w: larg, h: alt,
          fill: { color: b.cor || COR.azul } });
        // O VALOR EM CIMA DA BARRA (`direct-labeling`): com poucos dados, ler o
        // numero no proprio grafico poupa a ida ao eixo — e por isso nao ha eixo.
        s.addText(num(v), {
          x: cx - 0.25, y: BASE - alt - 0.27, w: larg + 0.5, h: 0.25,
          fontSize: cfg.fsValor || 11, bold: true, color: b.cor || COR.azul,
          align: 'center', wrap: false });
      });
      // O rótulo da categoria, embaixo.
      s.addText(String(it.rot || ''), {
        x: X0 + i * col, y: BASE + 0.07, w: col, h: 0.24,
        fontSize: cfg.fsRot || 11, color: it.corRot || COR.fraco,
        align: 'center', wrap: false });
      if (it.sub) {
        s.addText(String(it.sub), {
          x: X0 + i * col, y: BASE + 0.30, w: col, h: 0.2,
          fontSize: 8.5, color: COR.fraco, align: 'center', wrap: false });
      }
      // E o delta daquela coluna, quando houver — é o "crescimento" pedido.
      if (it.delta) {
        chipDelta(s, pptx, { delta: it.delta, x: X0 + i * col + (col - 1.3) / 2,
                             y: BASE + (it.sub ? 0.52 : 0.34), w: 1.3, h: 0.27,
                             fontSize: 9.5 });
      }
    });
    return { pontos: pontos, col: col, max: max };
  }

  /* ─── BARRAS DEITADAS, PAREADAS ────────────────────────────────────────
   *
   * A mesma comparação de `barras`, virada de lado. Ela existe porque a
   * categoria aqui tem NOME ("Dados & Inteligência"), e nome de categoria não
   * cabe embaixo de uma coluna: ou ele encolhe até não se ler, ou gira na
   * diagonal, que é a pior leitura de um slide projetado. Deitada, o nome fica
   * numa coluna à esquerda, no corpo do resto do deck.
   *
   * ERA DESENHADA À MÃO no `apresentacao.js`, e era a última exceção à "gramática
   * única" — a razão de existir este arquivo. Duas barras que se comparam não
   * podem ter uma altura no slide das frentes e outra em qualquer slide que venha
   * depois.
   *
   * A PRIMEIRA SÉRIE VAI EM CINZA e as seguintes na cor da categoria: com as duas
   * coloridas, a comparação vira adivinhação de tom. E `fraco`, nunca `fundo3` —
   * `fundo3` é a cor do TRILHO, e barra pintada de trilho existe no arquivo e não
   * existe na parede (1,09:1 sobre o cartão). Há invariante cobrando isso, e ela
   * nasceu deste defeito exato. */
  function barrasH(s, pptx, cfg) {
    var itens = (cfg.itens || []).filter(Boolean);
    if (!itens.length) return;
    var serDe = function (it) {
      return it.series && it.series.length ? it.series : [{ valor: it.valor, cor: it.cor }];
    };
    var max = itens.reduce(function (m, it) {
      return serDe(it).reduce(function (mm, b) {
        return Math.max(mm, Math.abs(Number(b.valor) || 0));
      }, m);
    }, 1);

    var LN = cfg.largNome || 1.55, VAO = 0.1, LV = cfg.largValor || 0.62;
    var xBarra = cfg.x + LN + VAO;
    var wBarra = cfg.w - LN - VAO - LV;
    var suf = cfg.sufixo || '';

    itens.forEach(function (it, i) {
      var y = cfg.y + i * cfg.alt;
      s.addText(String(it.nome || ''), {
        x: cfg.x, y: y, w: LN, h: 0.32, fontSize: cfg.fsNome || 9, color: COR.texto,
        align: 'right', valign: 'middle', wrap: false });
      var sr = serDe(it);
      sr.forEach(function (b, k) {
        var v = Math.abs(Number(b.valor) || 0);
        s.addShape(pptx.ShapeType.rect, {
          x: xBarra, y: y + 0.045 + k * 0.11,
          w: Math.max(0.02, wBarra * (v / max)), h: 0.09,
          fill: { color: b.cor || (k === 0 ? COR.fraco : COR.azul) },
          line: { type: 'none' } });
      });
      s.addText(sr.map(function (b) { return num(b.valor) + suf; }).join(' / '), {
        x: xBarra + wBarra + 0.06, y: y, w: LV, h: 0.32,
        fontSize: cfg.fsValor || 8, color: COR.fraco, valign: 'middle', wrap: false });
    });

    // A legenda explica as séries UMA vez, e não em cada linha.
    if (cfg.rodape) {
      s.addText(cfg.rodape, {
        x: xBarra, y: cfg.y + itens.length * cfg.alt + 0.02, w: wBarra + LV, h: 0.2,
        fontSize: 7.5, color: COR.fraco });
    }
  }

  /* ─── O COMPARATIVO DE DOIS PERÍODOS ───────────────────────────────────
   *
   * "Comparativos conforme imagem anexada." A primeira referência é este: duas
   * barras grandes, o valor escrito em cada uma, e a variação numa CAIXA entre
   * elas.
   *
   * POR QUE ELE EXISTE SEPARADO DE `barras`. `barras` compara N categorias e o
   * olho mede alturas; aqui há só DUAS colunas, e comparar duas alturas parecidas
   * a olho é justamente o que ninguém consegue fazer de longe — "1.307 e 1.192
   * são quase iguais no desenho e são 115 horas de diferença". Com dois valores a
   * resposta é a VARIAÇÃO, e por isso ela é o elemento tipograficamente mais
   * pesado do bloco, e não uma nota ao lado do gráfico.
   *
   * O PASSADO EM CINZA E O PRESENTE EM COR. É a mesma convenção da barra deitada
   * do slide das frentes: com as duas coloridas, a comparação vira adivinhação de
   * qual tom é qual. */
  function comparativo(s, pptx, cfg) {
    var x = cfg.x, w = cfg.w, base = cfg.base, alto = cfg.alto;
    var suf = cfg.sufixo || '';
    var va = Number(cfg.antes.valor) || 0, vb = Number(cfg.agora.valor) || 0;
    var max = Math.max(va, vb, 1);

    if (cfg.rot) {
      s.addText(String(cfg.rot), {
        x: x, y: cfg.y, w: w, h: 0.22, fontSize: cfg.fsRot || 10, bold: true,
        color: COR.fraco, charSpacing: 1.2, align: 'center', wrap: false });
    }

    /* AS DUAS COLUNAS OCUPAM 30% DA LARGURA CADA, com 10% de vão. O resto é
       margem: barra encostando na vizinha faz dois blocos parecerem um. */
    var lb = w * 0.30, vao = w * 0.10;
    var x0 = x + (w - (2 * lb + vao)) / 2;
    [{ v: va, cor: cfg.corAntes || COR.fraco, rot: cfg.antes.rot, i: 0 },
     { v: vb, cor: cfg.cor || COR.azul, rot: cfg.agora.rot, i: 1 }].forEach(function (b) {
      var h = Math.max(0.05, alto * (b.v / max));
      var bx = x0 + b.i * (lb + vao);
      s.addShape(pptx.ShapeType.rect, {
        x: bx, y: base - h, w: lb, h: h, fill: { color: b.cor }, line: { type: 'none' } });
      s.addText(num(b.v) + suf, {
        x: bx - 0.3, y: base - h - 0.30, w: lb + 0.6, h: 0.28,
        fontSize: cfg.fsValor || 15, bold: true, color: b.cor, align: 'center', wrap: false });
      s.addText(String(b.rot || ''), {
        x: bx - 0.2, y: base + 0.06, w: lb + 0.4, h: 0.2,
        fontSize: 9, color: COR.fraco, align: 'center', wrap: false });
    });

    /* A CAIXA DA VARIAÇÃO, embaixo e larga. É o mesmo chip do resto do deck —
       quem aprendeu a lê-lo no slide de evolução já sabe ler aqui — em corpo
       maior, porque neste bloco ele é a resposta e não o acessório. */
    var d = cfg.delta || delta(vb, va, { bomSubir: cfg.bomSubir !== false });
    chipDelta(s, pptx, { delta: d, x: x + w * 0.08, y: base + 0.32,
                         w: w * 0.84, h: 0.34, fontSize: cfg.fsDelta || 12 });
    return d;
  }

  /* ─── BARRA E LINHA, COM DOIS EIXOS ────────────────────────────────────
   *
   * A segunda referência: colunas para uma grandeza, linha para outra, cada uma
   * na sua escala.
   *
   * QUANDO ELE SE JUSTIFICA — e o padrão é claro sobre isso: dois eixos é a
   * forma mais fácil de mentir com um gráfico, porque quem desenha escolhe as
   * escalas e com elas escolhe onde as curvas se cruzam. Vale quando as duas
   * grandezas são de NATUREZAS diferentes e a pergunta é sobre a RELAÇÃO entre
   * elas ("a frente que consome mais hora é a que entrega mais peso?"). Não vale
   * para duas grandezas comparáveis — essas vão em barras pareadas, na mesma
   * régua, e é o que `barras` e `barrasH` fazem.
   *
   * POR ISSO O MÁXIMO DE CADA EIXO VAI ESCRITO. Sem ele, o cruzamento das duas
   * séries parece significar alguma coisa e não significa nada — é onde as duas
   * escalas que eu escolhi se encontram. Com ele, quem lê sabe que são réguas
   * diferentes antes de tirar conclusão.
   *
   * A LINHA É DESENHADA EM SEGMENTOS porque o pptxgenjs não tem polilinha. Cada
   * trecho é uma forma `line` da esquerda para a direita; quando o valor CAI, o
   * segmento nasce invertido no eixo vertical (`flipV`) — é assim que se desenha
   * uma diagonal descendente com uma forma que só conhece a própria caixa. */
  function barraLinha(s, pptx, cfg) {
    var itens = (cfg.itens || []).filter(Boolean);
    if (!itens.length) return;
    var X0 = cfg.x, LARG = cfg.w, BASE = cfg.base, ALTO = cfg.alto;
    var col = LARG / itens.length;
    var maxB = itens.reduce(function (m, i) { return Math.max(m, Number(i.barra) || 0); }, 1);
    var maxL = itens.reduce(function (m, i) { return Math.max(m, Number(i.linha) || 0); }, 1);
    var corB = cfg.corBarra || COR.azul, corL = cfg.corLinha || COR.ambar;

    s.addShape(pptx.ShapeType.rect, {
      x: X0, y: BASE, w: LARG, h: 0.012, fill: { color: COR.borda } });

    var larg = Math.min(cfg.largura || 0.55, col * 0.5);
    var pontos = [];
    itens.forEach(function (it, i) {
      var vb = Number(it.barra) || 0, vl = Number(it.linha) || 0;
      var cx = X0 + i * col + col / 2;
      var h = Math.max(0.04, ALTO * (vb / maxB));
      s.addShape(pptx.ShapeType.rect, {
        x: cx - larg / 2, y: BASE - h, w: larg, h: h, fill: { color: corB } });
      /* O VALOR DA BARRA VAI DENTRO DELA, e não em cima.
         Em cima ele disputa o mesmo pedaço de slide com o rótulo do PONTO DA
         LINHA, que nasce logo acima do ponto — e a linha passa justamente por
         perto do topo das barras, que é o que este gráfico existe para mostrar.
         Medido na prévia: os quatro pares se sobrepunham, nos quatro. Dentro da
         barra o número tem fundo garantido, e a colisão deixa de ser possível.
         Barra curta demais não comporta o número: aí ele sobe, e ali não há
         topo de barra por perto para disputar. */
      var dentro = h >= 0.32;
      var yb = dentro ? BASE - h + 0.05 : BASE - h - 0.25;
      s.addText(num(vb) + (cfg.sufixoBarra || ''), {
        x: cx - 0.45, y: yb, w: 0.9, h: 0.23,
        fontSize: 9.5, bold: true, color: dentro ? COR.fundo : corB,
        align: 'center', wrap: false });
      s.addText(String(it.rot || ''), {
        x: X0 + i * col, y: BASE + 0.07, w: col, h: 0.22,
        fontSize: cfg.fsRot || 9, color: COR.fraco, align: 'center', wrap: false });
      // A caixa do rótulo da barra viaja com o ponto: é contra ela que o rótulo
      // da linha se desvia, logo abaixo.
      pontos.push({ x: cx, y: BASE - ALTO * (vl / maxL), v: vl, caixa: [yb, yb + 0.23] });
    });

    for (var k = 0; k < pontos.length - 1; k++) {
      var a = pontos[k], b = pontos[k + 1];
      var sobe = b.y < a.y;             // no slide, subir é y MENOR
      s.addShape(pptx.ShapeType.line, {
        x: a.x, y: Math.min(a.y, b.y), w: b.x - a.x, h: Math.abs(b.y - a.y),
        line: { color: corL, width: 2 }, flipV: sobe });
    }
    pontos.forEach(function (p) {
      s.addShape(pptx.ShapeType.ellipse, {
        x: p.x - 0.055, y: p.y - 0.055, w: 0.11, h: 0.11,
        fill: { color: corL }, line: { color: COR.fundo, width: 1 } });
      /* O RÓTULO DA LINHA SE DESVIA DO DA BARRA.
       *
       * Pôr o valor da barra dentro dela resolveu a colisão do caso comum, e não
       * do geral: quando a linha PASSA POR DENTRO da barra — série baixa em
       * relação ao próprio máximo, barra alta em relação ao dela —, o rótulo do
       * ponto cai justamente onde está o da barra. A invariante pegou em
       * `250h × 300`, que é exatamente esse caso.
       *
       * A regra é: acima do ponto, que é o lugar natural; se ali houver o rótulo
       * da barra, abaixo; e se abaixo também houver, logo depois dele. Três
       * posições em ordem de preferência resolvem qualquer combinação, e nenhuma
       * delas depende de eu ter previsto os números. */
      var alturas = [p.y - 0.30, p.y + 0.08, p.caixa[1] + 0.03];
      var yr = alturas.find(function (y) {
        return !(y + 0.22 > p.caixa[0] && y < p.caixa[1]);
      });
      s.addText(num(p.v) + (cfg.sufixoLinha || ''), {
        x: p.x - 0.45, y: yr == null ? alturas[2] : yr, w: 0.9, h: 0.22,
        fontSize: 9, bold: true, color: corL, align: 'center', wrap: false });
    });

    /* OS DOIS MÁXIMOS, ESCRITOS. Ver a nota acima: sem eles o cruzamento das
       séries parece informação e é artefato da escala que eu escolhi. */
    /* A ALTURA DELES SE DIZ, e não sai de `BASE − ALTO`. Ficando colados no topo
       do desenho, eles batem no valor escrito em cima da barra mais alta — que
       nasce exatamente ali. Quem chama sabe onde acaba a régua do cabeçalho. */
    var yE = cfg.yEixos == null ? BASE - ALTO - 0.34 : cfg.yEixos;
    if (cfg.rotBarra) {
      s.addText(cfg.rotBarra + '  (máx. ' + num(maxB) + (cfg.sufixoBarra || '') + ')', {
        x: X0, y: yE, w: LARG / 2, h: 0.22,
        fontSize: 8.5, bold: true, color: corB, charSpacing: 0.6, wrap: false });
    }
    if (cfg.rotLinha) {
      s.addText(cfg.rotLinha + '  (máx. ' + num(maxL) + (cfg.sufixoLinha || '') + ')', {
        x: X0 + LARG / 2, y: yE, w: LARG / 2, h: 0.22,
        fontSize: 8.5, bold: true, color: corL, charSpacing: 0.6,
        align: 'right', wrap: false });
    }
  }

  /* ─── O CONECTOR ───────────────────────────────────────────────────────
   *
   * "Ao ver a imagem, qualquer um consiga ler e comparar SEM A NECESSIDADE DE
   *  LEITURA. Pode riscar os gráficos trazendo comparativo ou valores."
   *
   * É a peça que faltava. O gráfico mostrava duas colunas em cada mês e deixava
   * a comparação por conta de quem lê: a plateia via 108 e 197 e tinha de fazer
   * a subtração de cabeça — ou procurar o número num rodapé de 10pt. O conector
   * DESENHA a comparação: um traço do topo de uma barra ao topo da outra, com o
   * delta escrito em cima dele, no meio do caminho.
   *
   * A INCLINAÇÃO É A INFORMAÇÃO. Subiu muito, o traço é íngreme; ficou igual,
   * ele é horizontal. Isso se lê de longe e sem saber português — que é
   * exatamente o pedido.
   *
   * TRACEJADO, e não sólido: ele liga dois dados e não É um dado. Sólido, ele
   * competiria com a linha de série do gráfico de dois eixos, que é outra coisa.
   *
   * O CHIP FICA ACIMA DO TRAÇO, nunca em cima. Sobre a linha ele a corta ao
   * meio, e o traço perde justamente a inclinação que ele veio mostrar — foi o
   * que aconteceu no primeiro desenho deste deck ("o risco sobrepôs muita
   * coisa, não ficou bonito"). */
  function conector(s, pptx, cfg) {
    var x1 = cfg.x1, y1 = cfg.y1, x2 = cfg.x2, y2 = cfg.y2;
    var cor = cfg.cor || COR.fraco;
    s.addShape(pptx.ShapeType.line, {
      x: Math.min(x1, x2), y: Math.min(y1, y2),
      w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
      /* A forma `line` nasce descendo da esquerda para a direita; `flipV` a vira
         quando o segundo ponto está MAIS ALTO (y menor no slide). */
      flipV: y2 < y1,
      line: { color: cor, width: cfg.espessura || 1.5, dashType: cfg.traco || 'dash' },
    });
    if (cfg.delta) {
      var w = cfg.larguraChip || 1.35;
      chipDelta(s, pptx, {
        delta: cfg.delta, x: (x1 + x2) / 2 - w / 2,
        y: Math.min(y1, y2) - (cfg.alturaChip || 0.34) - 0.06,
        w: w, h: cfg.alturaChip || 0.34, fontSize: cfg.fontSize || 11,
      });
    }
  }

  /* ─── LEGENDA ──────────────────────────────────────────────────────────
     `legend-visible`: sempre visível e perto do gráfico. Uma função só, para a
     legenda não nascer em três alturas diferentes em três slides. */
  function legenda(s, pptx, cfg) {
    (cfg.itens || []).forEach(function (l, i) {
      var x = cfg.x + i * (cfg.passo || 1.5);
      s.addShape(pptx.ShapeType.rect, {
        x: x, y: cfg.y + 0.05, w: 0.14, h: 0.14, fill: { color: l.cor } });
      s.addText(l.rot, { x: x + 0.2, y: cfg.y, w: (cfg.passo || 1.5) - 0.24, h: 0.26,
                         fontSize: cfg.fontSize || 11, color: COR.fraco, wrap: false });
    });
  }

  var api = { COR: COR, num: num, delta: delta, chipDelta: chipDelta,
              barras: barras, barrasH: barrasH, comparativo: comparativo,
              barraLinha: barraLinha, conector: conector, legenda: legenda };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.DECKG = api;
}(typeof window !== 'undefined' ? window : this));
