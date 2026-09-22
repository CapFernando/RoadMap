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
  function delta(atual, anterior, opts) {
    var o = opts || {};
    var bomSubir = o.bomSubir !== false;
    var a = Number(atual) || 0;
    var b = Number(anterior) || 0;
    var dif = a - b;
    var pct = b === 0 ? null : (dif / Math.abs(b)) * 100;
    var dir = dif > 0 ? 'sobe' : (dif < 0 ? 'desce' : 'igual');
    var bom = dir === 'igual' ? null : ((dir === 'sobe') === bomSubir);

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

    itens.forEach(function (it, i) {
      var sr = seriesDe(it);
      var largGrupo = sr.length * larg + (sr.length - 1) * vao;
      var cx0 = X0 + i * col + (col - largGrupo) / 2;
      sr.forEach(function (b, k) {
        var v = Number(b.valor) || 0;
        var alt = Math.max(0.04, ALTO * (Math.abs(v) / max));
        var cx = cx0 + k * (larg + vao);
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
              barras: barras, legenda: legenda };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.DECKG = api;
}(typeof window !== 'undefined' ? window : this));
