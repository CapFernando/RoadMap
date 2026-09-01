/* ─────────────────────────────────────────────────────────────────────────
   O DECK DE UM ASSUNTO — o relatório da aba, em .pptx

   POR QUE ELE NÃO É O DECK MENSAL. O deck mensal responde "como foi o mês da
   área": time, capacidade, prazo, projetos. Este responde uma pergunta menor e
   mais frequente — "como foi o mês DESTE assunto" —, e é a pergunta que a área
   cliente faz. Cobrança quer ver Cobrança, e num deck de trinta slides ela
   aparece em duas linhas de uma tabela.

   Nasceu de um deck feito à mão. Montei um para Cobrança em agosto, slide por
   slide, e ele levou dois dias de conversa para ficar de pé. A segunda área que
   pedir a mesma coisa não deve custar dois dias — e, mais importante, não deve
   sair com números diferentes por eu ter recontado à mão.

   ───────────────────────────────────────────────────────────────────────────
   DOIS ESCOPOS, E A DIFERENÇA ENTRE ELES É A PERGUNTA

     UM ASSUNTO   "como foi Cobrança em agosto" — panorama, forma do mês,
                  as maiores entregas, onde o esforço foi dentro dele, o que vem
     CONSOLIDADO  "quais assuntos puxaram o mês" — os cinco maiores, cada um
                  resumido num slide

   ───────────────────────────────────────────────────────────────────────────
   O QUE ESTE ARQUIVO NÃO FAZ, DE PROPÓSITO

   NÃO CALCULA NADA. Recebe o objeto pronto de quem chamou (`relPptDados` no
   admin), que por sua vez soma pelas mesmas funções de `capacidade.js` que a
   tela usa. Se este arquivo somasse, o slide e a tela discordariam — e foi
   exatamente isso que aconteceu com o prazo (quatro implementações), com a data
   de entrega (duas) e com o agrupamento por raiz (duas).

   NÃO DESENHA UM CARTÃO PRÓPRIO. A gramática visual vem de `apresentacaoKit`.
   Dois decks da mesma empresa na mesma reunião, cada um com o seu jeito de
   desenhar um número, é o segundo perdendo a credibilidade do primeiro.
   ───────────────────────────────────────────────────────────────────────────*/
(function () {
  'use strict';

  /* O kit é resolvido na HORA DA CHAMADA, e não aqui.
     Na carga, `apresentacao.js` pode ainda não ter rodado — a ordem das tags é
     do HTML, e amarrar este arquivo a ela deixaria o deck de pé ou não conforme
     alguém reordenasse as linhas. */
  function kit() {
    var K = window.apresentacaoKit;
    if (!K) throw new Error('o módulo de apresentação não carregou');
    return K;
  }

  var MARGEM = 0.7, LARG = 8.6;      // a coluna útil do slide, igual à do deck mensal
  var Y_TITULO = 0.5, Y_SUB = 1.02, Y_CORPO = 1.5, Y_FUNDO = 4.9;

  /* QUANTAS ENTREGAS CABEM NO SLIDE, e o número sai de conta.
     Eu tinha posto oito. A tabela começa em 1,62" e cada linha come 0,36", então
     com oito mais o cabeçalho ela termina em 4,86" — e a linha "… e mais N
     entregas no período", que o `tabela` desenha logo abaixo, caía em 4,94" com
     0,3" de altura. O rodapé mora em 5,05". As duas coisas se sobrepunham em 62%,
     e o resultado na parede é o mês escrito por cima da contagem.
     Com sete, a última linha fecha em 4,88" e sobra folga até o rodapé. */
  var MAX_ENTREGAS = 7;

  function n0(v) {
    var n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }

  /** Número com separador de milhar. "1602" projetado vira "mil e seiscentos e
   *  alguma coisa" na cabeça de quem lê; "1.602" se lê de uma vez. */
  function fmt(v) {
    return n0(v).toLocaleString('pt-BR');
  }

  /** Plural sem `if` espalhado pelo arquivo. */
  function plural(n, um, muitos) {
    return n0(n) === 1 ? um : muitos;
  }

  /* ── A FORMA DO MÊS ──────────────────────────────────────────────────────
     Colunas da esquerda para a direita, porque o eixo é o tempo. O total já
     está no cartão acima; o que este bloco responde é OUTRA coisa — se o mês
     saiu parelho ou se saiu tudo numa semana. São perguntas diferentes, e um
     número só não responde a segunda.

     A escala é a do MAIOR valor da série, e não uma escala fixa: com escala
     fixa, um assunto de 30 pontos aparece como cinco riscos rentes ao chão e a
     forma — que é o assunto do slide — desaparece.                           */
  function colunasNoTempo(pptx, s, cfg) {
    var K = kit(), C = K.cores;
    var itens = cfg.itens || [];
    if (!itens.length) return;
    var max = itens.reduce(function (mx, i) { return Math.max(mx, n0(i.valor)); }, 0);
    var x0 = cfg.x, w = cfg.w, base = cfg.base, alto = cfg.alto;
    var passo = w / itens.length;
    var larg = Math.min(1.05, passo * 0.62);

    s.addText(cfg.rot || '', {
      x: x0, y: base - alto - 0.42, w: w, h: 0.22, fontSize: 9, bold: true,
      color: C.fraco, charSpacing: 1.2 });

    itens.forEach(function (it, i) {
      var v = n0(it.valor);
      var cx = x0 + passo * i + (passo - larg) / 2;
      /* O TRILHO ATRÁS DA COLUNA. Sem ele, uma faixa de zero não desenha nada e
         a semana em que o assunto não teve entrega simplesmente não existe no
         slide — quem lê conta quatro semanas onde havia cinco. */
      s.addShape(pptx.ShapeType.rect, {
        x: cx, y: base - alto, w: larg, h: alto,
        fill: { color: C.fundo3 }, line: { type: 'none' } });
      if (v > 0 && max > 0) {
        var h = Math.max(0.06, alto * (v / max));
        s.addShape(pptx.ShapeType.rect, {
          x: cx, y: base - h, w: larg, h: h,
          fill: { color: cfg.cor || C.azul }, line: { type: 'none' } });
        s.addText(fmt(v), {
          x: x0 + passo * i, y: base - h - 0.24, w: passo, h: 0.22,
          fontSize: 10, bold: true, color: C.texto, align: 'center' });
      }
      s.addText(String(it.rot || ''), {
        x: x0 + passo * i, y: base + 0.06, w: passo, h: 0.2,
        fontSize: 8.5, color: v > 0 ? C.fraco : C.borda, align: 'center' });
    });
  }

  /* ── BARRAS DE UMA LISTA ORDENADA ────────────────────────────────────────
     Nome à direita, barra, valor. É a mesma peça do painel de sprints, e serve
     tanto para "onde o esforço foi dentro do assunto" quanto para "os cinco
     maiores" — a pergunta é a mesma em duas escalas, e desenhá-la de dois
     jeitos faria a sala reaprender a ler no meio do deck.                    */
  function barrasRanking(pptx, s, cfg) {
    var K = kit(), C = K.cores;
    var itens = cfg.itens || [];
    if (!itens.length) return;
    var max = itens.reduce(function (mx, i) { return Math.max(mx, n0(i.valor)); }, 1);
    var wNome = cfg.wNome || 2.35, vao = 0.12, wVal = 0.72, wLado = cfg.wLado || 0.95;
    var xBarra = cfg.x + wNome + vao;
    var wBarra = cfg.w - wNome - vao - wVal - wLado - 0.1;
    itens.forEach(function (it, i) {
      var y = cfg.y + i * cfg.alt;
      var meio = (cfg.alt - 0.26) / 2;
      s.addText(K.corta(it.nome, cfg.corteNome || 30), {
        x: cfg.x, y: y + meio, w: wNome, h: 0.26, fontSize: 10.5, color: C.texto,
        align: 'right', valign: 'middle', wrap: false });
      s.addShape(pptx.ShapeType.rect, {
        x: xBarra, y: y + meio + 0.04, w: wBarra, h: 0.18,
        fill: { color: C.fundo3 }, line: { type: 'none' } });
      var v = n0(it.valor);
      if (v > 0) {
        s.addShape(pptx.ShapeType.rect, {
          x: xBarra, y: y + meio + 0.04, w: Math.max(0.03, wBarra * (v / max)), h: 0.18,
          fill: { color: it.cor || cfg.cor || C.azul }, line: { type: 'none' } });
      }
      s.addText(fmt(v) + (cfg.unidade || ''), {
        x: xBarra + wBarra + 0.08, y: y + meio, w: wVal, h: 0.26,
        fontSize: 10.5, bold: true, color: C.texto, valign: 'middle', wrap: false });
      if (it.lado) {
        s.addText(String(it.lado), {
          x: xBarra + wBarra + 0.08 + wVal, y: y + meio, w: wLado, h: 0.26,
          fontSize: 9, color: C.fraco, valign: 'middle', wrap: false });
      }
    });
  }

  /** O cabeçalho de uma coluna: bolinha da cor, nome, e a contagem embaixo. */
  function cabecColuna(pptx, s, x, y, w, cor, nome, sub) {
    var K = kit(), C = K.cores;
    s.addShape(pptx.ShapeType.rect, {
      x: x, y: y + 0.07, w: 0.1, h: 0.1, fill: { color: cor }, line: { type: 'none' } });
    s.addText(nome, { x: x + 0.18, y: y, w: w - 0.18, h: 0.24, fontSize: 11.5,
                      bold: true, color: C.texto });
    if (sub) {
      s.addText(sub, { x: x, y: y + 0.24, w: w, h: 0.2, fontSize: 9, color: C.fraco });
    }
    s.addShape(pptx.ShapeType.rect, {
      x: x, y: y + 0.48, w: w, h: 0.01, fill: { color: C.borda }, line: { type: 'none' } });
  }

  /** Uma linha de fila: código à esquerda, título, e um valor opcional à direita. */
  function linhaFila(pptx, s, cfg) {
    var K = kit(), C = K.cores;
    s.addShape(pptx.ShapeType.rect, {
      x: cfg.x, y: cfg.y, w: 0.03, h: cfg.h,
      fill: { color: cfg.cor || C.borda }, line: { type: 'none' } });
    s.addText(String(cfg.cod || ''), {
      x: cfg.x + 0.11, y: cfg.y, w: 0.72, h: cfg.h, fontSize: 9,
      color: C.fraco, valign: 'middle', wrap: false });
    var wDir = cfg.dir ? 0.72 : 0;
    s.addText(K.corta(cfg.titulo, cfg.corte || 44), {
      x: cfg.x + 0.85, y: cfg.y, w: cfg.w - 0.85 - wDir, h: cfg.h,
      fontSize: 10, color: C.texto, valign: 'middle', wrap: false });
    if (cfg.dir) {
      s.addText(String(cfg.dir), {
        x: cfg.x + cfg.w - wDir, y: cfg.y, w: wDir, h: cfg.h, fontSize: 9.5,
        bold: true, color: cfg.corDir || C.fraco, align: 'right',
        valign: 'middle', wrap: false });
    }
  }

  /* ═══ OS SLIDES ══════════════════════════════════════════════════════════ */

  /* O PANORAMA. Quatro números e a forma do mês.
     A ORDEM DOS QUATRO É A DA PERGUNTA: quanto saiu, com que peso, quanto
     entrou, quanto sobrou. Trocar "entraram" e "em aberto" de lugar parece
     inócuo e não é — lidos em sequência, eles contam se a fila cresceu ou
     encurtou, e essa é a leitura que o slide existe para dar. */
  function slidePanorama(pptx, d, t, pagina) {
    var K = kit(), C = K.cores;
    var s = K.slideTitulo(pptx, t.nome, t.sub, pagina);
    var w = (LARG - 3 * 0.2) / 4;
    var cards = [
      { rot: 'ENTREGAS', val: fmt(t.entregas),
        nota: t.deltaEntregas || plural(t.entregas, 'demanda concluída', 'demandas concluídas'),
        cor: C.verde },
      { rot: 'PONTOS ENTREGUES', val: fmt(t.pontos),
        nota: t.notaPontos || '', cor: C.verde },
      { rot: 'ENTRARAM NO PERÍODO', val: fmt(t.entraram),
        nota: t.notaEntraram || 'pedidos novos registrados', cor: C.azul },
      { rot: 'EM ABERTO HOJE', val: fmt(t.aberto),
        nota: t.notaAberto || '', cor: t.aberto ? C.ambar : C.azul },
    ];
    cards.forEach(function (c, i) {
      K.cartaoKpi(pptx, s, {
        x: MARGEM + i * (w + 0.2), y: Y_CORPO, w: w, h: 1.06,
        rot: c.rot, val: c.val, nota: c.nota, cor: c.cor, corpo: 30 });
    });

    /* A FORMA DO MÊS. Só desenha com mais de uma faixa: uma coluna sozinha não
       é uma forma, é o mesmo total do cartão desenhado outra vez. */
    var faixas = t.faixas || [];
    if (faixas.length > 1) {
      colunasNoTempo(pptx, s, {
        x: MARGEM, w: LARG, base: 4.34, alto: 1.32, cor: C.verde,
        rot: (t.rotFaixas || 'PONTOS ENTREGUES POR SEMANA'),
        itens: faixas.map(function (f) { return { rot: f.rot, valor: f.entregue }; }) });
    }
    if (t.notaPe) {
      s.addText(t.notaPe, { x: MARGEM, y: Y_FUNDO - 0.24, w: LARG, h: 0.24,
                            fontSize: 10, color: C.fraco });
    }
    K.rodape(s, t.periodo, pagina);
    return s;
  }

  /* AS PRINCIPAIS ENTREGAS. Maiores em pontos primeiro.
     POR PONTOS, e não por data: a pergunta do slide é "o que valeu a pena", e
     em ordem de data a entrega de 55 pontos aparece entre duas de 2 só porque
     saiu no dia 5. A data fica na coluna, para quem quiser a sequência. */
  function slideEntregas(pptx, d, t, pagina) {
    var K = kit(), C = K.cores;
    var lista = t.maiores || [];
    var sub = lista.length
      ? 'Ordenadas por tamanho. ' + fmt(t.pontos) + ' ' + plural(t.pontos, 'ponto', 'pontos') +
        ' em ' + fmt(t.entregas) + ' ' + plural(t.entregas, 'entrega', 'entregas') + '.'
      : 'Nenhuma entrega com data no período.';
    var s = K.slideTitulo(pptx, 'As principais entregas', sub, pagina);
    if (lista.length) {
      K.tabela(pptx, s, ['Pt', 'Código', 'Entrega', 'Saiu em', 'Responsável'],
        lista.map(function (e) {
          return [
            { text: e.pts ? fmt(e.pts) : '—',
              options: { bold: true, color: e.pts ? C.verde : C.fraco } },
            { text: e.codigo || '—', options: { color: C.fraco } },
            K.corta(e.titulo, 52),
            { text: e.data || '—', options: { color: C.fraco } },
            { text: K.corta(e.dev || '—', 20), options: { color: C.fraco } },
          ];
        }), { y: 1.62, max: MAX_ENTREGAS, colW: [0.6, 0.9, 4.55, 0.9, 1.65],
              rotuloSobra: ' entregas no período' });
    }
    K.rodape(s, t.periodo, pagina);
    return s;
  }

  /* ONDE O ESFORÇO FOI DENTRO DO ASSUNTO.
     SÓ EXISTE COM DOIS OU MAIS MÓDULOS. Antifraude e Cobrança têm um só: o
     slide sairia com uma barra de 100% ao lado do nome do próprio assunto —
     um slide que repete o título e não informa nada. Quem monta o deck não
     deveria ter de apagar isso à mão depois. */
  function slideModulos(pptx, d, t, pagina) {
    var K = kit(), C = K.cores;
    var itens = t.modulos || [];
    var s = K.slideTitulo(pptx, 'Onde o esforço foi',
      itens.length + ' ' + plural(itens.length, 'módulo', 'módulos') + ' de ' + t.nome +
      ' com entrega no período, por pontos.', pagina);
    barrasRanking(pptx, s, {
      x: MARGEM, y: 1.72, w: LARG, alt: Math.min(0.46, 3.0 / itens.length),
      itens: itens.map(function (m) {
        return { nome: m.nome, valor: m.pts, cor: C.verde,
                 lado: fmt(m.qtd) + ' ' + plural(m.qtd, 'entrega', 'entregas') };
      }), unidade: ' pt', wNome: 2.6, corteNome: 34 });
    K.rodape(s, t.periodo, pagina);
    return s;
  }

  /* O QUE VEM. Duas colunas, e a diferença entre elas é a AÇÃO — a mesma
     distinção que a aba de relatórios faz, e pela mesma razão: em Planning o
     tamanho ainda não existe (estimar na reunião); pontuado sem prazo já tem
     tamanho e falta agendar (decisão de quem planeja).

     NÃO PROJETA DATA para nenhum dos dois. Em deck de diretoria, projeção é
     lida como compromisso — e o compromisso é do time, não de quem apresenta. */
  function slideOQueVem(pptx, d, t, pagina) {
    var K = kit(), C = K.cores;
    var pl = t.planning || [], sp = t.semPrazo || [];
    var s = K.slideTitulo(pptx, 'O que vem',
      fmt(pl.length + sp.length) + ' ' + plural(pl.length + sp.length, 'item', 'itens') +
      ' em aberto com dono definido' +
      (t.abertoSemEtapa ? ' · ' + fmt(t.abertoSemEtapa) + ' em outras etapas' : '') + '.',
      pagina);

    var wCol = (LARG - 0.3) / 2;
    [{ x: MARGEM, cor: C.fraco, nome: 'Em Planning', lista: pl,
       sub: fmt(pl.length) + ' ' + plural(pl.length, 'item', 'itens') +
            ' · o tamanho é definido na reunião' },
     { x: MARGEM + wCol + 0.3, cor: C.azul, nome: 'Pontuado, sem prazo', lista: sp,
       sub: fmt(sp.length) + ' ' + plural(sp.length, 'item', 'itens') + ' · ' +
            fmt(t.ptsSemPrazo) + ' pt à espera de agenda' }
    ].forEach(function (col) {
      cabecColuna(pptx, s, col.x, 1.62, wCol, col.cor, col.nome, col.sub);
      if (!col.lista.length) {
        s.addText('nada nesta fila', { x: col.x, y: 2.3, w: wCol, h: 0.26,
                                       fontSize: 10, color: C.borda });
        return;
      }
      var TETO = 7, vis = col.lista.slice(0, TETO);
      vis.forEach(function (it, i) {
        linhaFila(pptx, s, {
          x: col.x, y: 2.24 + i * 0.36, w: wCol, h: 0.32, cor: col.cor,
          cod: it.codigo, titulo: it.titulo, corte: 36,
          dir: it.pts ? fmt(it.pts) + ' pt' : '', corDir: C.azul });
      });
      var sobra = col.lista.length - vis.length;
      if (sobra > 0) {
        s.addText('… e mais ' + sobra + ' na aba de relatórios', {
          x: col.x, y: 2.24 + TETO * 0.36 + 0.04, w: wCol, h: 0.24,
          fontSize: 9.5, color: C.fraco });
      }
    });
    K.rodape(s, t.periodo, pagina);
    return s;
  }

  /* O RESUMO DE UM ASSUNTO, EM UM SLIDE — a peça do consolidado.
     Cabe o que a área precisa reconhecer: os números, as três maiores, e o
     tamanho da fila. Não cabe a forma do mês nem a quebra por módulo: com cinco
     assuntos, isso viraria vinte slides e a comparação — que é o ponto do
     consolidado — se perderia. */
  function slideResumoAssunto(pptx, d, t, pagina, posicao) {
    var K = kit(), C = K.cores;
    var s = K.slideBase(pptx);
    s.addText(String(posicao) + 'º', { x: MARGEM, y: Y_TITULO + 0.04, w: 0.6, h: 0.42,
                                       fontSize: 17, bold: true, color: C.fraco });
    s.addText(t.nome, { x: MARGEM + 0.52, y: Y_TITULO, w: LARG - 0.52, h: 0.5,
                        fontSize: 24, bold: true, color: C.texto, wrap: false });
    s.addText(t.sub, { x: MARGEM, y: Y_SUB, w: LARG, h: 0.3, fontSize: 12.5, color: C.fraco });

    var w = (LARG - 3 * 0.18) / 4;
    [{ rot: 'ENTREGAS', val: fmt(t.entregas), cor: C.verde },
     { rot: 'PONTOS', val: fmt(t.pontos), cor: C.verde },
     { rot: 'ENTRARAM', val: fmt(t.entraram), cor: C.azul },
     { rot: 'EM ABERTO', val: fmt(t.aberto), cor: t.aberto ? C.ambar : C.azul }
    ].forEach(function (c, i) {
      K.cartaoKpi(pptx, s, { x: MARGEM + i * (w + 0.18), y: 1.46, w: w, h: 0.9,
                             rot: c.rot, val: c.val, cor: c.cor, corpo: 25 });
    });

    var maiores = (t.maiores || []).slice(0, 3);
    s.addText('AS MAIORES ENTREGAS', { x: MARGEM, y: 2.56, w: LARG, h: 0.22,
                                       fontSize: 9, bold: true, color: C.fraco, charSpacing: 1.2 });
    if (maiores.length) {
      maiores.forEach(function (e, i) {
        linhaFila(pptx, s, {
          x: MARGEM, y: 2.84 + i * 0.42, w: LARG, h: 0.38, cor: C.verde,
          cod: e.codigo, titulo: e.titulo, corte: 62,
          dir: e.pts ? fmt(e.pts) + ' pt' : '', corDir: C.verde });
      });
    } else {
      s.addText('nenhuma entrega com data no período', {
        x: MARGEM, y: 2.84, w: LARG, h: 0.3, fontSize: 10.5, color: C.borda });
    }

    /* A FILA FECHA O SLIDE. Sem ela, o resumo conta só o que saiu — e o assunto
       que entregou muito e tem trinta em aberto lê igual ao que zerou a fila. */
    s.addText(t.remate, { x: MARGEM, y: 4.28, w: LARG, h: 0.46, fontSize: 11.5,
                          color: C.fraco, lineSpacingMultiple: 1.25 });
    K.rodape(s, t.periodo, pagina);
    return s;
  }

  /* ═══ OS DOIS DECKS ══════════════════════════════════════════════════════ */

  async function montaDeck(d) {
    var K = kit();
    await K.carregaLib();
    var pptx = new window.PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'Roadmap de Melhorias';
    pptx.title = d.tituloCapa + ' — ' + d.periodo;

    K.slideCapa(pptx, {
      rotuloCapa: d.rotuloCapa || 'RELATÓRIO DE',
      tituloCapa: d.tituloCapa,
      periodo: d.periodo,
      titulo: d.tituloCapa, subtitulo: d.subtitulo,
    });

    var p = 0;
    if (d.escopo === 'consolidado') {
      slidePanorama(pptx, d, d.geral, ++p);

      /* O RANKING VEM ANTES DOS RESUMOS. Ver os cinco lado a lado responde
         "quais assuntos puxaram o mês"; os slides seguintes respondem "o que
         aconteceu em cada um". Na ordem inversa, a sala chega ao quinto slide
         sem saber se o primeiro era o maior ou o menor. */
      var s = K.slideTitulo(pptx, 'Os assuntos que puxaram o período',
        d.ranking.length + ' com entrega registrada, por pontos entregues.' +
        (d.rankingSobra ? ' Os ' + d.rankingSobra + ' demais somam ' +
                          fmt(d.rankingSobraPts) + ' pt.' : ''), ++p);
      barrasRanking(pptx, s, {
        x: MARGEM, y: 1.74, w: LARG, alt: Math.min(0.42, 2.9 / Math.max(d.ranking.length, 1)),
        /* A COR DIZ QUAIS GANHAM SLIDE PRÓPRIO, E NENHUMA BARRA FICA INVISÍVEL.
           Os que não têm slide usavam `fundo3` — que é a cor do TRILHO da barra
           (está escrito assim na paleta: "trilho de barra / cartão inativo"). A
           barra era desenhada no comprimento certo e pintada por cima do trilho
           com o mesmo tom: metade do gráfico aparecia vazia na parede, e quem
           lia não tinha como comparar 132 pt com 47 pt.

           PRATA, e a paleta já dizia qual usar: "neutro SECUNDÁRIO — quando duas
           categorias precisam se distinguir na mesma barra e nenhuma das duas é
           melhor que a outra". É exatamente o caso: todas são entregas, e a
           diferença é só quais o deck detalha nos slides seguintes. Verde aqui
           significaria "estas entregaram e aquelas não", que é falso. */
        itens: d.ranking.map(function (r, i) {
          return { nome: r.nome, valor: r.pts,
                   cor: i < (d.assuntos || []).length
                     ? K.significado.cumprido
                     : K.significado.categoria2,
                   lado: fmt(r.qtd) + ' ' + plural(r.qtd, 'entrega', 'entregas') };
        }), unidade: ' pt', wNome: 2.6, corteNome: 34 });
      K.rodape(s, d.periodo, p);

      (d.assuntos || []).forEach(function (t, i) {
        slideResumoAssunto(pptx, d, t, ++p, i + 1);
      });
      slideOQueVem(pptx, d, d.geral, ++p);
    } else {
      var t = d.assunto;
      slidePanorama(pptx, d, t, ++p);
      slideEntregas(pptx, d, t, ++p);
      if ((t.modulos || []).length > 1) slideModulos(pptx, d, t, ++p);
      slideOQueVem(pptx, d, t, ++p);
    }
    return pptx;
  }

  window.relatorioPptMonta = montaDeck;
})();
