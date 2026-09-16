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
  /* `Y_TITULO` e `Y_SUB` SAIRAM: quem posiciona titulo e subtitulo agora e o
     cabecalho unico (`slideTitulo`), e deixar as duas constantes aqui seria
     deixar de pe a medida da gramatica antiga — a proxima pessoa que precisasse
     de um "y do titulo" as acharia e reconstruiria o cabecalho divergente. */
  var Y_CORPO = 1.5, Y_FUNDO = 4.9;

  /* TETO DE ENTREGAS — hoje um limite de GOSTO, e não de espaço.
   *
   * Este número já foi a defesa contra a tabela passar do rodapé, e a conta que
   * o justificava usava 0,36" por linha. O número estava errado: `<a:tr h>` é um
   * MÍNIMO no OOXML, e o PowerPoint estica a linha para o texto caber — a altura
   * real, medida no deck que o Fernando recebeu, é 0,42". Com sete entregas mais
   * o cabeçalho a tabela chegava a 4,98" e escrevia por cima do rodapé (5,05"),
   * que é o que o print mostrava.
   *
   * QUEM DEFENDE O ESPAÇO AGORA É O `tabela`, que recebe até onde pode ir e
   * calcula quantas linhas cabem. Este teto continua valendo como limite
   * editorial — sete entregas já é mais lista do que se lê num slide —, mas o
   * espaço vence quando for menor. Com a área atual, cabem seis. */
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
  /* AS FRENTES DE TRABALHO — o slide que ABRE a seção no modelo.
   *
   * O deck de Relatórios começava na conta da fila, que é o meio da história: a
   * sala pergunta "quantos somos e quanto coube no mês" antes de "a fila cresceu
   * ou encolheu". É o mesmo `slidePipelines` do deck mensal, com a lista deste
   * recorte — uma segunda conta de horas por frente daria dois "realizado" para
   * o mesmo mês.
   *
   * Devolve `null` quando não há frente a mostrar, e aí o deck simplesmente não
   * ganha a página: um slide de frentes vazio não é "nenhuma frente", é um slide
   * que parece quebrado. */
  function slideFrentes(pptx, d, t, pagina) {
    var K = kit();
    var pl = t.frentes;
    if (!pl || !(pl.itens || []).length) return null;
    return K.slidePipelines(pptx, pl, pagina, t.periodo);
  }

  /* PONTOS ENTREGUES POR DESENVOLVEDOR — a página 14 do modelo.
   *
   * O deck dizia quais ASSUNTOS puxaram o mês e calava sobre QUEM. É o mesmo
   * `slidePontosDev` do deck mensal, com o corte deste recorte — uma segunda
   * soma por dev daria dois "pontos do João" no mesmo mês, um por deck.
   *
   * SEM PONTUAÇÃO NENHUMA, NÃO DESENHA. Um slide de distribuição com a lista
   * vazia não diz "ninguém entregou", diz que o slide quebrou. */
  function slidePontosPorDev(pptx, d, t, pagina) {
    var K = kit();
    var pt = t.pontosDev;
    if (!pt || !pt.total || !Object.keys(pt.porDev || {}).length) return null;
    return K.slidePontosDev(pptx, pt, pagina, t.periodo);
  }

  function slidePanorama(pptx, d, t, pagina) {
    var K = kit();
    /* ESTE SLIDE É O `slideMes` DO DECK MENSAL, e não mais um parecido.
     *
     * Ele desenhava quatro cartões próprios — ENTREGAS · PONTOS · ENTRARAM · EM
     * ABERTO HOJE — e respondia "quanto saiu". O modelo responde outra coisa,
     * e é a que a diretoria cobra: BACKLOG NO DIA 1 + ENTRARAM − SAÍRAM = EM
     * ABERTO NO FIM, ou seja "a fila cresceu ou encolheu". Foi exatamente esta
     * página que o Fernando circulou no print dizendo que não condizia.
     *
     * DUAS PERGUNTAS DIFERENTES NA MESMA REUNIÃO era o defeito de fundo, e
     * desenhar a conta aqui de novo só o trocaria por outro: dois decks com
     * dois backlogs para o mesmo mês, e nada dizendo qual vale. Então este
     * chama o slide do outro deck, com os números da MESMA `fila.js`.
     *
     * O QUE SE PERDEU, dito com todas as letras: os pontos entregues saíam num
     * cartão de 30pt e agora saem na linha "Das saídas: … · 2174 pontos" do
     * modelo; a distribuição por semana virou slide próprio (`slideForma`),
     * que é onde o modelo a põe. Nenhum número sumiu. */
    return K.slideMes(pptx, {
      periodo: t.periodo,
      sub: t.raiz ? t.raiz + '  ·  backlog, o que entrou e o que saiu'
                  : 'backlog, o que entrou e o que saiu',
      fluxo: t.fluxo || {},
      kpi: { pontos: t.pontos },
      quebra: (t.fluxo || {}).quebra,
      anterior: t.anterior,
    }, pagina);
  }

  /* A FORMA DO MÊS — onde o esforço caiu dentro do período.
     Era um gráfico no pé do panorama; virou slide porque o panorama passou a ser
     a conta da fila, que ocupa a página inteira no modelo. Só existe com mais de
     uma faixa: uma coluna sozinha não é uma forma, é o total desenhado de novo. */
  function slideForma(pptx, d, t, pagina) {
    var K = kit(), C = K.cores;
    var faixas = (t.faixas || []).filter(Boolean);
    if (faixas.length < 2) return null;
    /* O ROTULO DO GRAFICO SAI, porque o subtitulo ja o diz. Como pe de pagina do
       panorama ele era a unica legenda que havia; virando slide, o cabecalho
       passou a responder a mesma coisa, e a frase aparecia duas vezes. */
    var s = K.slideTitulo(pptx, 'A forma do período',
      (t.rotFaixas || 'PONTOS ENTREGUES POR SEMANA').toLowerCase() +
      (t.raiz ? '  ·  ' + t.raiz : ''), pagina, t.periodo);
    colunasNoTempo(pptx, s, {
      x: MARGEM, w: LARG, base: 4.10, alto: 2.20, cor: C.verde, rot: '',
      itens: faixas.map(function (f) { return { rot: f.rot, valor: f.entregue }; }) });
    /* E `notaPe` NAO SE REPETE AQUI. "Entraram 202 e sairam 175: a fila cresceu
       em 27" e exatamente a frase que o slide anterior ja da em ambar, do
       tamanho de quem le de longe. Repeti-la em 10pt nao acrescenta e ensina
       que o deck se repete. */
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
    var s = K.slideTitulo(pptx, 'As principais entregas', sub, pagina, t.periodo);
    if (lista.length) {
      /* AS LARGURAS CABEM O QUE VAI DENTRO — era aqui que a tabela engordava.
         "Saiu em" tinha 0,9" e "09/09/2026" precisa de ~1,12" com a margem da
         célula: TODA linha quebrava em duas, e uma tabela de linhas duplas
         ocupa o dobro do espaço e passava do rodapé. O sintoma era a altura; a
         causa era a coluna estreita.

         E OS CORTES SAEM DAS LARGURAS, e não de números escritos à mão: `52`
         para o título numa coluna de 4,45" também quebrava. `cabemChars` desconta
         a margem da célula (0,2" no total) e devolve quantos caracteres entram. */
      /* A DATA GANHA A MAIOR FOLGA das cinco, e de propósito: ela é a única que
         tem o mesmo tamanho em toda linha, então se ela não couber, quebram
         TODAS — foi assim que a tabela dobrou de altura. "09/09/2026" pede ~1,07"
         com a margem; 1,25" dá 17% de folga para a imprecisão da estimativa de
         largura. Os 0,10" saem do título, que tem de sobra. */
      var COL = { pt: 0.55, cod: 0.95, tit: 4.35, data: 1.25, dev: 1.50 };
      var MARG = 0.2;   // margem da célula, somando os dois lados
      K.tabela(pptx, s, ['Pt', 'Código', 'Entrega', 'Saiu em', 'Responsável'],
        lista.map(function (e) {
          return [
            { text: e.pts ? fmt(e.pts) : '—',
              options: { bold: true, color: e.pts ? C.verde : C.fraco } },
            { text: e.codigo || '—', options: { color: C.fraco } },
            K.corta(e.titulo, K.cabemChars(COL.tit - MARG, 12)),
            { text: e.data || '—', options: { color: C.fraco } },
            { text: K.corta(e.dev || '—', K.cabemChars(COL.dev - MARG, 12)),
              options: { color: C.fraco } },
          ];
        }), { y: 1.62, max: MAX_ENTREGAS,
              colW: [COL.pt, COL.cod, COL.tit, COL.data, COL.dev],
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
      ' com entrega no período, por pontos.', pagina, t.periodo);
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
      pagina, t.periodo);

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
        /* O CORTE VEM DA LARGURA DA COLUNA, e não de um 36 escrito à mão.
           `linhaFila` dá ao título `w − 0.85` (o recuo do código) menos 0,72
           quando há valor à direita; o 36 fixo ignorava os dois e cortava
           "…garantias - Vis…" com meia polegada de coluna sobrando. */
        var wDir = it.pts ? 0.72 : 0;
        linhaFila(pptx, s, {
          x: col.x, y: 2.24 + i * 0.36, w: wCol, h: 0.32, cor: col.cor,
          cod: it.codigo, titulo: it.titulo,
          corte: K.cabemChars(wCol - 0.85 - wDir, 10),
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

  /* ═══ O BACKLOG ═════════════════════════════════════════════════════════
     Entra so quando a caixa do modal esta marcada — o pedido foi "podemos
     incluir o backlog, mas traga uma caixa para confirmacao... dependendo pode
     ser relevante".

     O SLIDE RESPONDE TRES PERGUNTAS, nesta ordem, porque e a ordem em que a sala
     as faz:

       QUANTO E  ..... o numero grande, e quanto dele ja tem tamanho
       ONDE ESTA ..... a quebra por sistema, que e onde a decisao mora
       HA QUANTO TEMPO  a lista das mais antigas

     A IDADE E A COLUNA DA DIREITA, e nao a pontuacao. Num backlog, o argumento
     nao e "isto e grande" — e "isto espera desde marco". Pontuacao entra junto
     do titulo, quando existe, porque metade da pilha nao tem.

     E NADA DE BARRA DE PROGRESSO nem de meta: backlog nao tem meta. Um grafico
     sugeriria que existe um numero certo para o tamanho da pilha, e a conversa
     viraria sobre o grafico em vez de sobre o que priorizar. */
  function slideBacklog(pptx, d, b, t, pagina) {
    var K = kit(), C = K.cores;
    var s = K.slideTitulo(pptx, 'Backlog',
      fmt(b.total) + ' ' + plural(b.total, 'demanda', 'demandas') +
      ' sem data combinada \u2014 Backlog e Levantar Requisitos.' +
      (b.maisVelha != null ? '  A mais antiga espera h\u00e1 ' + fmt(b.maisVelha) + ' dias.' : ''),
      pagina, t.periodo);

    /* OS TRES NUMEROS DE CIMA. "Ja estimadas" e "sem tamanho" somam o total: e a
       leitura que diz se a pilha esta pronta para ser priorizada ou se falta
       passar metade dela por Planning antes de qualquer promessa. */
    var wC = (LARG - 0.6) / 3;
    [{ n: fmt(b.total), r: 'na pilha', c: C.texto },
     { n: fmt(b.pontuadas) + (b.pontos ? '  ·  ' + fmt(b.pontos) + ' pt' : ''),
       r: 'j\u00e1 estimadas', c: C.azul },
     { n: fmt(b.semPonto), r: 'sem tamanho definido', c: C.fraco }
    ].forEach(function (k, i) {
      var x = MARGEM + i * (wC + 0.3);
      s.addShape(pptx.ShapeType.rect, { x: x, y: 1.6, w: wC, h: 0.82,
        fill: { color: C.fundo2 }, line: { color: C.borda, width: 0.5 } });
      s.addText(String(k.n), { x: x + 0.16, y: 1.68, w: wC - 0.32, h: 0.42,
        fontSize: 22, bold: true, color: k.c, valign: 'middle', wrap: false });
      s.addText(k.r, { x: x + 0.16, y: 2.08, w: wC - 0.32, h: 0.26,
        fontSize: 10, color: C.fraco, wrap: false });
    });

    /* ─── "ONDE ESTA" SO EXISTE COM DOIS OU MAIS SISTEMAS ──────────────────
       Num deck filtrado por um assunto, a coluna tinha uma linha so — o nome do
       proprio assunto, com o total que ja esta no cartao acima. Ela repetia o
       titulo do slide e ocupava metade da largura para nao dizer nada.

       E a mesma regra que o `slideModulos` ja aplica, pelo mesmo motivo: "o slide
       sairia com uma barra de 100% ao lado do nome do proprio assunto — um slide
       que repete o titulo e nao informa nada".

       SEM ELA, "As que mais esperam" OCUPA A LARGURA TODA e mostra o dobro de
       demandas. Quem filtrou por um assunto ja sabe onde a pilha esta; o que ele
       nao sabe e ha quanto tempo cada coisa espera. */
    var varios = (b.sistemas || []).length > 1;
    var wCol = varios ? (LARG - 0.3) / 2 : LARG;
    var xEspera = varios ? MARGEM + wCol + 0.3 : MARGEM;
    var yL = 2.66;
    /* Quantas cabem: de 2,66" + 0,62" de cabecalho ate a area util (4,90"), a
       0,34" por linha. Numa coluna so, o mesmo espaco vertical — o que dobra e a
       largura, e nao a altura; o ganho vem de nao gastar metade do slide com uma
       linha. Com as duas colunas o teto e 6 para as duas ficarem da mesma altura. */
    var CABEM = Math.max(1, Math.floor((4.90 - yL - 0.62) / 0.34));

    // Esquerda: onde a pilha esta.
    var sis = varios ? (b.sistemas || []).slice(0, CABEM) : [];
    /* AS CORES VEM DA TABELA DE SIGNIFICADO, e nao da paleta crua \u2014 `C` nem tem
       `categoria2` nem `alerta`, entao os nomes que eu havia escrito caiam no
       fallback e a escolha virava acidente.
       PRATA em "Onde esta": a paleta define prata como "categoria neutra, nenhuma
       melhor que a outra", que e exatamente sistemas lado a lado. AMBAR em "As
       que mais esperam": e "atencao", que e o que uma demanda parada ha meses
       pede. Verde e vermelho estariam errados nos dois \u2014 num backlog nao ha nada
       cumprido nem falhado. */
    if (varios) {
      cabecColuna(pptx, s, MARGEM, yL, wCol, K.significado.categoria2, 'Onde est\u00e1',
        'por sistema, do maior para o menor');
    }
    sis.forEach(function (x, i) {
      linhaFila(pptx, s, {
        x: MARGEM, y: yL + 0.62 + i * 0.34, w: wCol, h: 0.3, cor: C.borda,
        cod: '', titulo: x.nome, corte: K.cabemChars(wCol - 0.85 - 0.72, 10),
        dir: fmt(x.qtd) + (x.pts ? ' · ' + fmt(x.pts) + ' pt' : ''), corDir: C.texto });
    });
    var sobraSis = (b.sistemas || []).length - sis.length;
    if (sobraSis > 0) {
      s.addText('… e mais ' + sobraSis + ' ' + plural(sobraSis, 'sistema', 'sistemas'), {
        x: MARGEM, y: yL + 0.62 + sis.length * 0.34 + 0.04, w: wCol, h: 0.24,
        fontSize: 9.5, color: C.fraco });
    }

    // As que mais esperam. Com um sistema so, ela toma a largura inteira e mostra
    // o dobro de demandas — que e a informacao que sobrou de pe.
    var velhas = (b.itens || []).slice(0, varios ? CABEM : CABEM * 2);
    cabecColuna(pptx, s, xEspera, yL, wCol, K.significado.atencao,
      'As que mais esperam', 'em dias parados');
    velhas.forEach(function (x, i) {
      // Numa coluna so, as linhas continuam de cima para baixo; em duas, a
      // segunda metade nao existe.
      linhaFila(pptx, s, {
        x: xEspera, y: yL + 0.62 + i * 0.34, w: wCol, h: 0.3,
        cor: C.borda, cod: x.codigo, titulo: x.titulo,
        corte: K.cabemChars(wCol - 0.85 - 0.72, 10),
        dir: x.dias == null ? '—' : fmt(x.dias) + 'd', corDir: C.texto });
    });
    var sobraVelhas = (b.itens || []).length - velhas.length;
    if (sobraVelhas > 0) {
      s.addText('… e mais ' + sobraVelhas + ' ' +
                plural(sobraVelhas, 'demanda', 'demandas') + ' na pilha', {
        x: xEspera, y: yL + 0.62 + velhas.length * 0.34 + 0.04, w: wCol, h: 0.24,
        fontSize: 9.5, color: C.fraco });
    }

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
    /* A POSICAO ENTRA NO TITULO, e o cabecalho e o mesmo de todo slide.
       Ela era desenhada a parte, com o titulo em 24pt numa caixa propria — mais
       uma gramatica de cabecalho no mesmo deck. Como prefixo ela continua
       dizendo a mesma coisa ("este e o 2o maior assunto do periodo") e para de
       custar um layout so dele. O `wrap: false` some junto: o tamanho do titulo
       agora e calculado para caber, que e o que o `wrap` estava mascarando. */
    var s = K.slideTitulo(pptx, posicao + 'º  ' + t.nome, t.sub, pagina, t.periodo);

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
      if (slideFrentes(pptx, d, d.geral, p + 1)) p += 1;
      slidePanorama(pptx, d, d.geral, ++p);
      if (slideForma(pptx, d, d.geral, p + 1)) p += 1;

      /* O RANKING VEM ANTES DOS RESUMOS. Ver os cinco lado a lado responde
         "quais assuntos puxaram o mês"; os slides seguintes respondem "o que
         aconteceu em cada um". Na ordem inversa, a sala chega ao quinto slide
         sem saber se o primeiro era o maior ou o menor. */
      var s = K.slideTitulo(pptx, 'Os assuntos que puxaram o período',
        d.ranking.length + ' com entrega registrada, por pontos entregues.' +
        (d.rankingSobra ? ' Os ' + d.rankingSobra + ' demais somam ' +
                          fmt(d.rankingSobraPts) + ' pt.' : ''), ++p, d.periodo);
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
      /* O CORTE POR PESSOA VEM DEPOIS DOS ASSUNTOS, e nao entre o ranking e
         eles. No modelo os dois slides de distribuicao ficam colados
         (assuntos, depois pessoas), mas aqui o ranking e seguido pelos cinco
         resumos que o detalham — e esse par ja tem razao escrita: "na ordem
         inversa, a sala chega ao quinto slide sem saber se o primeiro era o
         maior ou o menor". Entao a pessoa entra depois, ainda antes do "o que
         vem", que e onde o modelo tambem a poe. */
      if (slidePontosPorDev(pptx, d, d.geral, p + 1)) p += 1;
      slideOQueVem(pptx, d, d.geral, ++p);
      /* O BACKLOG FECHA O DECK, depois do "O que vem". A ordem e a mesma da aba
         de relatorios, e pelo mesmo motivo: "o que entra agora" e a pergunta da
         reuniao; "quanto ainda nao foi prometido" e a do trimestre.
         So entra se houver o que mostrar \u2014 um slide dizendo "0 na pilha" gasta
         um minuto da sala para nao dizer nada. */
      if (d.backlog && d.backlog.total) slideBacklog(pptx, d, d.backlog, d.geral, ++p);
    } else {
      var t = d.assunto;
      if (slideFrentes(pptx, d, t, p + 1)) p += 1;
      slidePanorama(pptx, d, t, ++p);
      if (slideForma(pptx, d, t, p + 1)) p += 1;
      slideEntregas(pptx, d, t, ++p);
      if ((t.modulos || []).length > 1) slideModulos(pptx, d, t, ++p);
      if (slidePontosPorDev(pptx, d, t, p + 1)) p += 1;
      slideOQueVem(pptx, d, t, ++p);
      if (d.backlog && d.backlog.total) slideBacklog(pptx, d, d.backlog, t, ++p);
    }
    return pptx;
  }

  window.relatorioPptMonta = montaDeck;
})();
