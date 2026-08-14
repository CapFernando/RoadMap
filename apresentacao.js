/* ─────────────────────────────────────────────────────────────────────────
   APRESENTAÇÃO EXECUTIVA — .pptx do fechamento do mês
   ─────────────────────────────────────────────────────────────────────────
   Para diretoria e CEO. Isso muda o que o arquivo precisa ser, e não é "os
   mesmos números com fundo escuro":

   1. NARRATIVA, não relatório. A ordem é a de uma conversa: o que prometemos,
      o que entregamos, o que valeu a pena, onde falhamos e por quê, o que vem.
      Um slide por ideia. Quem apresenta fala; o slide sustenta.

   2. UM NÚMERO POR SLIDE, gigante. Diretoria lê de longe, em projetor, com
      metade da atenção. Tabela de 20 linhas em slide é ruído — vira anexo.

   3. IMAGEM DE VERDADE. Os gráficos são redesenhados num canvas de 1600px
      antes de virar PNG. Usar o canvas da tela (que segue o zoom e a tela de
      quem exportou) produziria imagem borrada no telão — que é exatamente o
      que estraga a credibilidade de um número correto.

   4. O QUE ENTRA É ESCOLHIDO. As demandas de destaque são marcadas por quem
      apresenta: quem conhece a história sabe qual entrega merece o slide, e
      nenhuma métrica escolhe isso melhor.

   A biblioteca (PptxGenJS) é carregada SOB DEMANDA, no primeiro clique. São
   ~800 KB que não fazem sentido no carregamento de uma tela que a maioria usa
   para outra coisa. Vem do mesmo CDN que já serve o Chart.js desta página.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var CDN = 'https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js';

  // Paleta do slide. Fundo quase preto e texto quase branco: o pedido foi
  // "fundo escuro, dados muito claros". Os acentos são os mesmos da ferramenta,
  // para quem viu a tela reconhecer o gráfico no slide.
  var C = {
    fundo:   '0E0E0D',
    fundo2:  '161614',
    texto:   'F2F0E9',
    fraco:   '9A968C',
    azul:    '3B8FE8',
    verde:   '3EC98E',
    vermelho:'E5484D',
    ambar:   'FFC470',
    roxo:    'C9AEFF',
  };

  function carregaLib() {
    if (window.PptxGenJS) return Promise.resolve();
    return new Promise(function (ok, erro) {
      var s = document.createElement('script');
      s.src = CDN;
      s.onload = function () { window.PptxGenJS ? ok() : erro(new Error('biblioteca não carregou')); };
      s.onerror = function () {
        erro(new Error('não consegui baixar a biblioteca de apresentação — verifique a conexão'));
      };
      document.head.appendChild(s);
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  var MES_NOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
                  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  /* ── Gráfico em alta resolução ──────────────────────────────────────────
     Redesenha o gráfico existente num canvas de 1600 px, fora da tela. O canvas
     da página acompanha o zoom e a resolução de quem exportou: num telão isso
     vira imagem borrada, e número correto em imagem borrada perde a discussão
     antes de começar. */
  function graficoEmPng(idCanvas, larguraPx) {
    try {
      var orig = document.getElementById(idCanvas);
      if (!orig || !window.Chart) return null;
      var chart = window.Chart.getChart ? window.Chart.getChart(orig) : null;
      if (!chart) return null;
      var L = larguraPx || 1600;
      var H = Math.round(L * (orig.height / orig.width || 0.5));

      var alvo = document.createElement('canvas');
      alvo.width = L; alvo.height = H;
      var caixa = document.createElement('div');
      caixa.style.cssText = 'position:fixed;left:-99999px;top:0;width:' + L + 'px;height:' + H + 'px';
      caixa.appendChild(alvo);
      document.body.appendChild(caixa);

      // Mesma configuração, sem animação (senão o PNG sai no meio da animação)
      // e com as fontes ampliadas na proporção do canvas maior.
      var cfg = JSON.parse(JSON.stringify({ type: chart.config.type, data: chart.config.data }));
      var escala = L / (orig.clientWidth || 800);
      var novo = new window.Chart(alvo.getContext('2d'), {
        type: cfg.type,
        data: cfg.data,
        options: Object.assign({}, chart.config.options, {
          responsive: false, animation: false, devicePixelRatio: 1,
          plugins: Object.assign({}, (chart.config.options || {}).plugins, {
            legend: { labels: { color: '#' + C.texto, font: { size: Math.round(11 * escala) } } },
          }),
          scales: escalasAmpliadas((chart.config.options || {}).scales, escala),
        }),
      });
      var png = alvo.toDataURL('image/png', 1);
      novo.destroy();
      caixa.remove();
      return png;
    } catch (_) {
      return null;
    }
  }

  function escalasAmpliadas(scales, escala) {
    if (!scales) return undefined;
    var out = {};
    Object.keys(scales).forEach(function (k) {
      out[k] = Object.assign({}, scales[k], {
        ticks: Object.assign({}, (scales[k] || {}).ticks, {
          color: '#' + C.texto, font: { size: Math.round(11 * escala) },
        }),
        grid: Object.assign({}, (scales[k] || {}).grid, { color: 'rgba(255,255,255,.10)' }),
      });
    });
    return out;
  }

  /* ── Blocos de slide ───────────────────────────────────────────────────── */

  function slideBase(pptx) {
    var s = pptx.addSlide();
    s.background = { color: C.fundo };
    return s;
  }

  // Rodapé discreto: mês e página. Diretoria folheia o PDF depois, e slide sem
  // referência vira print solto sem contexto.
  function rodape(s, texto, n) {
    s.addText(texto, { x: 0.5, y: 5.05, w: 7, h: 0.3, fontSize: 10, color: C.fraco });
    if (n) s.addText(String(n), { x: 9.0, y: 5.05, w: 0.5, h: 0.3, fontSize: 10,
                                  color: C.fraco, align: 'right' });
  }

  // A CAPA DA CASA. O deck abria com uma faixa azul e texto — generico, e nada
  // parecido com a capa que a apresentacao mensal ja usa. Esta e a mesma: leao,
  // textura, "RELATORIO DE" em verde, o titulo em branco e o mes embaixo.
  //
  // As posicoes vem da capa original, convertidas de pontos para polegadas: a
  // pagina tem 960x540pt e o slide 10x5,63" — divisor 96. Nao chutei nenhuma.
  //
  // O tipo e Montserrat, o da apresentacao. Se a maquina que projeta nao tiver,
  // o PowerPoint troca sozinho por um parecido e a capa continua de pe.
  function slideCapa(pptx, cfg) {
    var s = slideBase(pptx);
    var cap = window.CAPA_TECNOLOGIA;
    // Sem as imagens, a capa antiga. Deck que nao abre na hora da reuniao e pior
    // que deck feio.
    if (!cap || !cap.fundo) return slideCapaSimples(pptx, cfg);

    var pSelos = cap.selosPos || { x: 8.58, y: 0.40, w: 0.94, h: 0.48 };
    var pLogo  = cap.logoPos  || { x: 8.13, y: 4.83, w: 1.41, h: 0.52 };
    s.addImage({ data: cap.fundo, x: 0, y: 0, w: 10, h: 5.63 });
    if (cap.selos) s.addImage(Object.assign({ data: cap.selos }, pSelos));
    if (cap.logo)  s.addImage(Object.assign({ data: cap.logo }, pLogo));

    // `wrap: false` e o que impede a capa de quebrar. A primeira versao pedia
    // Montserrat a 78pt; a maquina que abriu o arquivo nao tem a fonte, o
    // PowerPoint trocou por uma mais larga, e "TECNOLOGIA" partiu em duas linhas
    // por cima do "RELATÓRIO DE". Uma capa que depende de uma fonte instalada nao
    // e uma capa: agora o texto nunca quebra, e 62pt cabe com folga ate no tipo
    // mais largo. `margin: 0` tira o respiro que o PowerPoint poe dentro da caixa
    // e que deslocava o texto para baixo da posicao medida.
    var verde = cap.verde || '00FD54';
    var tipo = { fontFace: 'Montserrat', margin: 0, wrap: false, valign: 'top' };
    s.addText((cfg.rotuloCapa || 'RELATÓRIO DE').toUpperCase(), Object.assign({
      x: 3.35, y: 1.88, w: 6.4, h: 0.3, fontSize: 20, bold: true,
      color: verde, charSpacing: 1 }, tipo));
    s.addText((cfg.tituloCapa || 'TECNOLOGIA').toUpperCase(), Object.assign({
      x: 3.3, y: 2.22, w: 6.6, h: 1.0, fontSize: 62, bold: true,
      color: 'FFFFFF' }, tipo));
    s.addText(String(cfg.periodo || '').toUpperCase(), Object.assign({
      x: 3.35, y: 3.38, w: 6.4, h: 0.35, fontSize: 20, bold: true,
      color: verde, charSpacing: 1 }, tipo));
    return s;
  }

  // A capa antiga, guardada como plano B.
  function slideCapaSimples(pptx, cfg) {
    var s = slideBase(pptx);
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: 5.63, fill: { color: C.azul } });
    s.addText(cfg.titulo || 'Roadmap de Melhorias', {
      x: 0.7, y: 1.7, w: 8.8, h: 0.9, fontSize: 40, bold: true, color: C.texto });
    s.addText(cfg.periodo, {
      x: 0.7, y: 2.6, w: 8.8, h: 0.5, fontSize: 22, color: C.azul });
    if (cfg.subtitulo) {
      s.addText(cfg.subtitulo, {
        x: 0.7, y: 3.25, w: 8.8, h: 1.0, fontSize: 15, color: C.fraco, lineSpacingMultiple: 1.3 });
    }
    return s;
  }

  // O slide de um número só. É o formato que sobrevive ao projetor.
  function slideNumero(pptx, cfg, pagina) {
    var s = slideBase(pptx);
    s.addText(cfg.rotulo, { x: 0.7, y: 0.7, w: 8.6, h: 0.45, fontSize: 16, color: C.fraco });
    s.addText(String(cfg.valor), {
      x: 0.7, y: 1.25, w: 8.6, h: 1.7, fontSize: 96, bold: true, color: cfg.cor || C.texto });
    if (cfg.apoio) {
      s.addText(cfg.apoio, { x: 0.7, y: 3.0, w: 8.6, h: 0.5, fontSize: 18, color: C.texto });
    }
    if (cfg.nota) {
      s.addText(cfg.nota, { x: 0.7, y: 3.6, w: 8.6, h: 1.0, fontSize: 13,
                            color: C.fraco, lineSpacingMultiple: 1.3 });
    }
    rodape(s, cfg.rodape || '', pagina);
    return s;
  }

  // DEMANDA x CAPACIDADE. Dois numeros lado a lado e a diferenca entre eles —
  // que e a unica coisa que a sala precisa levar daqui: a fila cresceu ou nao.
  //
  // Nao vira grafico de propósito. Sao dois valores; barra, linha ou pizza para
  // dois valores e enfeite, e enfeite rouba o segundo em que a pessoa le a
  // diferenca.
  function slideFluxo(pptx, f, pagina, periodo) {
    var s = slideTitulo(pptx, 'Demanda × capacidade', 'o que chegou e o que saiu no período', pagina);
    var saldo = f.recebidas - f.entregues;
    var col = [
      { rot: 'Chegaram', val: f.recebidas, cor: C.azul },
      { rot: 'Entregamos', val: f.entregues, cor: C.verde },
      { rot: saldo > 0 ? 'A fila cresceu' : (saldo < 0 ? 'A fila diminuiu' : 'A fila ficou igual'),
        val: (saldo > 0 ? '+' : '') + saldo,
        cor: saldo > 0 ? C.vermelho : (saldo < 0 ? C.verde : C.fraco) },
    ];
    col.forEach(function (c, i) {
      var x = 0.7 + i * 3.0;
      s.addText(c.rot, { x: x, y: 1.75, w: 2.8, h: 0.35, fontSize: 14, color: C.fraco });
      s.addText(String(c.val), { x: x, y: 2.1, w: 2.8, h: 1.25, fontSize: 66, bold: true, color: c.cor });
    });
    if (f.abertas) {
      s.addText(f.abertas + ' demandas em aberto hoje, somando todos os meses.', {
        x: 0.7, y: 3.75, w: 8.6, h: 0.4, fontSize: 15, color: C.texto });
    }
    // A ressalva existe porque alguem soma: "chegaram" conta pela data de
    // cadastro, e demanda registrada semanas depois de ter sido pedida cai no mes
    // do registro. E o unico campo que vale para qualquer mes, mas nao e a data do
    // pedido.
    s.addText('“Chegaram” conta pela data de cadastro da demanda. ' +
              'As duas contas são do mesmo período, mas a fila em aberto é de hoje.', {
      x: 0.7, y: 4.25, w: 8.6, h: 0.6, fontSize: 12, color: C.fraco, lineSpacingMultiple: 1.3 });
    rodape(s, periodo, pagina);
    return s;
  }

  function slideTitulo(pptx, titulo, sub, pagina) {
    var s = slideBase(pptx);
    s.addText(titulo, { x: 0.7, y: 0.55, w: 8.6, h: 0.5, fontSize: 24, bold: true, color: C.texto });
    if (sub) s.addText(sub, { x: 0.7, y: 1.05, w: 8.6, h: 0.35, fontSize: 13, color: C.fraco });
    rodape(s, '', pagina);
    return s;
  }

  // Corta o texto no tamanho que cabe em DUAS linhas da coluna. Sem isso um
  // titulo longo quebra em tres e empurra a tabela para fora do slide — foi o que
  // aconteceu no primeiro deck de verdade, e o corte na borda e visto pela plateia
  // antes do numero.
  function corta(t, n) {
    var s = String(t == null ? '' : t).trim();
    return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
  }

  // Tabela enxuta. O teto de linhas nao e estetica: o slide tem 5,63" de altura,
  // a tabela comeca em 1,6" e cada linha come ~0,42" — passou de 6, corta na
  // borda. Quando sobra fila, uma linha diz quantas ficaram de fora, porque
  // tabela truncada em silencio faz a diretoria achar que aquilo e tudo.
  var TAB_MAX = 6;
  function tabela(pptx, s, cabec, linhas, opts) {
    opts = opts || {};
    var vis = linhas.slice(0, opts.max || TAB_MAX);
    var corpo = [cabec.map(function (t) {
      return { text: t, options: { bold: true, color: C.fraco, fontSize: 11 } };
    })];
    vis.forEach(function (l) {
      corpo.push(l.map(function (c) {
        var o = (c && typeof c === 'object') ? c : { text: String(c) };
        return { text: o.text, options: Object.assign(
          { color: C.texto, fontSize: 12 }, o.options || {}) };
      }));
    });
    s.addTable(corpo, {
      x: 0.7, y: opts.y || 1.6, w: 8.6, colW: opts.colW,
      rowH: 0.32, valign: 'middle',
      border: { type: 'solid', color: '2E2E2B', pt: 1 },
      fill: { color: C.fundo2 }, autoPage: false,
    });
    var sobra = linhas.length - vis.length;
    if (sobra > 0) {
      s.addText('… e mais ' + sobra + (opts.rotuloSobra || ' na planilha do mês'), {
        x: 0.7, y: (opts.y || 1.6) + 0.36 * (vis.length + 1) + 0.08, w: 8.6, h: 0.3,
        fontSize: 11, color: C.fraco });
    }
  }


  // O time em agregado. Tres perguntas, tres colunas — e NENHUM slide por pessoa:
  // em reuniao de diretoria, detalhe individual desloca a conversa de "o que a
  // area entregou" para "o que fulano fez", e nao e essa a pauta.
  function slideTime(pptx, t, pagina, periodo, ausencias) {
    var s = slideTitulo(pptx, 'O time', 'no período', pagina);
    var col = [
      { x: 0.7,  tit: 'Mais entregas',  cor: C.verde,    lista: t.entregas },
      { x: 3.65, tit: 'Mais pontos',    cor: C.azul,     lista: t.pontos },
      { x: 6.6,  tit: 'Mais atrasos',   cor: C.vermelho, lista: t.atrasos },
    ];
    col.forEach(function (c) {
      s.addText(c.tit, { x: c.x, y: 1.6, w: 2.7, h: 0.3, fontSize: 12, color: c.cor, bold: true });
      if (!c.lista.length) {
        s.addText('—', { x: c.x, y: 2.0, w: 2.7, h: 0.3, fontSize: 14, color: C.fraco });
        return;
      }
      c.lista.slice(0, 4).forEach(function (it, i) {
        var y = 2.0 + i * 0.62;
        s.addText(String(it.valor), {
          x: c.x, y: y, w: 0.9, h: 0.45, fontSize: 22, bold: true, color: c.cor });
        s.addText(corta(it.nome, 18), {
          x: c.x + 0.85, y: y + 0.08, w: 1.9, h: 0.35, fontSize: 12, color: C.texto });
      });
    });
    // QUEM ESTEVE FORA. Sem esta linha o slide convida a leitura errada: quem
    // tirou uma semana de ferias entrega menos e aparece embaixo da lista como se
    // tivesse rendido menos. As ausencias ja estao cadastradas no Planejamento —
    // so faltava cruza-las aqui.
    //
    // Uma linha, e nao um numero ao lado de cada nome: sao tres colunas que ja tem
    // numero, e um quarto ali vira ruido.
    if ((ausencias || []).length) {
      s.addText('Fora no período', { x: 0.7, y: 4.15, w: 8.6, h: 0.3,
                                     fontSize: 13, color: C.fraco });
      s.addText(ausencias.slice(0, 6).map(function (a) {
        return a.nome + ' (' + a.dias + (a.dias === 1 ? ' dia' : ' dias') +
               (a.tipo ? ', ' + a.tipo : '') + ')';
      }).join('   ·   '), { x: 0.7, y: 4.45, w: 8.6, h: 0.5, fontSize: 14,
                            color: C.ambar, lineSpacingMultiple: 1.25 });
    }
    rodape(s, periodo, pagina);
    return s;
  }

  // Onde o time atuou. Barra proporcional em vez de so numero: com tres linhas, a
  // barra diz em um olhar se foi concentrado ou distribuido — que e a pergunta que
  // a diretoria faz depois do numero.
  function slideAreas(pptx, areas, pagina, periodo) {
    var s = slideTitulo(pptx, 'Onde atuamos', 'principais frentes do período', pagina);
    var max = Math.max.apply(null, areas.map(function (a) { return a.entregas; }).concat([1]));
    areas.slice(0, 3).forEach(function (a, i) {
      var y = 1.7 + i * 1.05;
      s.addText(corta(a.nome, 46), { x: 0.7, y: y, w: 6.2, h: 0.35, fontSize: 17, color: C.texto });
      s.addText(a.entregas + (a.entregas === 1 ? ' entrega' : ' entregas') +
                (a.pontos ? '   ·   ' + a.pontos + ' pontos' : ''), {
        x: 0.7, y: y + 0.36, w: 6.2, h: 0.3, fontSize: 12, color: C.fraco });
      // A barra e a leitura de relance; o numero grande a direita ancora.
      s.addShape(pptx.ShapeType.rect, {
        x: 0.7, y: y + 0.72, w: 6.2 * (a.entregas / max), h: 0.12,
        fill: { color: i === 0 ? C.azul : i === 1 ? C.verde : C.roxo } });
      s.addText(String(a.entregas), {
        x: 7.4, y: y - 0.05, w: 1.9, h: 0.7, fontSize: 34, bold: true,
        color: i === 0 ? C.azul : i === 1 ? C.verde : C.roxo, align: 'right' });
    });
    rodape(s, periodo, pagina);
    return s;
  }


  // Ranking em barras DESENHADAS no slide — retangulos do PowerPoint, nao imagem.
  //
  // A primeira versao fotografava o grafico da tela. Ele empilha por tema: 28
  // cores, legenda ocupando tres linhas do slide e barras de poucos pixels. No
  // projetor virou uma faixa colorida que nao se le, e cor demais num slide
  // executivo nao decora — gera pergunta ("o que e o laranja?") no meio da
  // apresentacao.
  //
  // Vetor em vez de PNG: fica nitido em qualquer projetor e em qualquer zoom, nao
  // depende do tamanho do canvas na tela de quem exportou, e sobrevive ao PDF.
  // Uma cor so, ordenado do maior para o menor, numero na ponta. A comparacao e
  // o assunto; a cor nao carrega informacao nenhuma aqui.
  function slideBarras(pptx, cfg, pagina, periodo) {
    var s = slideTitulo(pptx, cfg.titulo, cfg.sub || '', pagina);
    var itens = (cfg.itens || []).slice(0, cfg.max || 12);
    if (!itens.length) {
      s.addText(cfg.vazio || 'Sem dados no período.',
        { x: 0.7, y: 1.7, w: 8.6, h: 0.4, fontSize: 15, color: C.fraco });
      rodape(s, periodo, pagina);
      return s;
    }
    // A altura da linha se ajusta a quantidade: 3,25" de area util. Fixa em 0,42"
    // com dez pessoas, a ultima barra cai fora do slide — foi assim que a tabela
    // do primeiro deck estourou.
    var TOPO = 1.62, AREA = 3.25;
    var alt = Math.min(0.42, AREA / itens.length);
    var max = itens.reduce(function (m, i) { return Math.max(m, i.valor); }, 0) || 1;
    // 5,88" e a largura que faz o numero terminar em 9,5" — a mesma margem
    // direita das tabelas e dos titulos. Bordas diferentes entre slides do mesmo
    // deck sao percebidas como desalinhamento mesmo por quem nao sabe dizer o que
    // mudou.
    var LARG = 5.88, X_NOME = 0.7, X_BARRA = 2.75;

    itens.forEach(function (it, i) {
      var y = TOPO + i * alt;
      var h = Math.min(0.2, alt * 0.5);
      s.addText(corta(it.nome, 26), {
        x: X_NOME, y: y, w: 1.95, h: alt, fontSize: 12, color: C.texto,
        align: 'right', valign: 'middle' });
      // Trilho: sem ele, uma barra curta ao lado de uma longa parece erro de
      // desenho em vez de diferenca de volume.
      s.addShape(pptx.ShapeType.rect, {
        x: X_BARRA, y: y + (alt - h) / 2, w: LARG, h: h,
        fill: { color: C.fundo2 } });
      s.addShape(pptx.ShapeType.rect, {
        x: X_BARRA, y: y + (alt - h) / 2, w: Math.max(0.06, LARG * (it.valor / max)), h: h,
        fill: { color: cfg.cor || C.azul } });
      s.addText(String(it.valor), {
        x: X_BARRA + LARG + 0.12, y: y, w: 0.75, h: alt,
        fontSize: 13, bold: true, color: cfg.cor || C.azul, valign: 'middle' });
    });

    var sobra = (cfg.itens || []).length - itens.length;
    var notas = [];
    if (sobra > 0) notas.push('… e mais ' + sobra + (cfg.rotuloSobra || ''));
    if (cfg.nota) notas.push(cfg.nota);
    if (notas.length) {
      s.addText(notas.join('   ·   '), {
        x: 0.7, y: TOPO + itens.length * alt + 0.12, w: 8.6, h: 0.3,
        fontSize: 11, color: C.fraco });
    }
    rodape(s, periodo, pagina);
    return s;
  }

// O MÊS EM QUATRO NÚMEROS, e não em um.
  //
  // Este slide era só "69 entregas concluídas". Número sozinho mostra resultado
  // sem esforço: não diz quanta demanda chegou no mesmo período, quanta coisa o
  // time pegou, nem o que ficou de pé para o mês seguinte. Quem apresenta ficava
  // com a parte difícil da conversa na memória.
  //
  // O destaque continua sendo o que saiu — é a entrega que se apresenta. Os
  // outros três ficam ao lado, do tamanho de apoio, na ordem em que a demanda
  // anda: chegou, foi tocada, saiu, ficou.
  function slideMes(pptx, d, pagina) {
    var s = slideBase(pptx);
    var f = d.fluxo || {};
    var k = d.kpi || {};

    s.addText('Entregas concluídas', { x: 0.7, y: 0.62, w: 8.6, h: 0.4, fontSize: 16, color: C.fraco });
    s.addText(String(k.concluidas), {
      x: 0.7, y: 1.0, w: 4.2, h: 1.5, fontSize: 92, bold: true, color: C.verde });
    if (k.pontos) {
      s.addText(k.pontos + ' pontos de complexidade', {
        x: 0.72, y: 2.45, w: 4.2, h: 0.35, fontSize: 15, color: C.texto });
    }

    // A coluna da direita é o caminho da demanda, na ordem em que ela anda.
    var etapas = [
      { rot: 'Entraram no mês', val: f.recebidas, cor: C.azul },
      { rot: 'Trabalhadas no mês', val: f.tocadas, cor: C.texto },
      { rot: 'Em aberto ao virar o mês', val: f.backlog, cor: C.ambar },
    ].filter(function (e) { return e.val != null; });
    etapas.forEach(function (e, i) {
      var y = 1.05 + i * 0.95;
      s.addShape(pptx.ShapeType.rect, { x: 5.3, y: y, w: 0.06, h: 0.72, fill: { color: e.cor } });
      s.addText(String(e.val), { x: 5.55, y: y - 0.04, w: 1.4, h: 0.6, fontSize: 40, bold: true, color: e.cor });
      s.addText(e.rot, { x: 6.95, y: y + 0.14, w: 2.6, h: 0.4, fontSize: 13, color: C.fraco });
    });

    // A frase que a sala leva: a fila cresceu ou diminuiu. Sem ela, os quatro
    // números ficam por conta de quem estiver somando de cabeça.
    if (f.recebidas != null) {
      var saldo = f.recebidas - k.concluidas;
      var texto = saldo > 0
        ? 'Entrou mais do que saiu: a fila cresceu ' + saldo + (saldo === 1 ? ' demanda' : ' demandas') + ' no mês.'
        : (saldo < 0
            ? 'Saiu mais do que entrou: a fila diminuiu ' + Math.abs(saldo) +
              (saldo === -1 ? ' demanda' : ' demandas') + ' no mês.'
            : 'Entrou e saiu o mesmo tanto: a fila ficou do mesmo tamanho.');
      s.addText(texto, { x: 0.7, y: 3.95, w: 8.6, h: 0.4, fontSize: 16,
                         color: saldo > 0 ? C.ambar : C.verde });
    }
    if (k.notaEntregas) {
      s.addText(k.notaEntregas, { x: 0.7, y: 4.4, w: 8.6, h: 0.5, fontSize: 12,
                                  color: C.fraco, lineSpacingMultiple: 1.3 });
    }
    rodape(s, d.periodo, pagina);
    return s;
  }

  // O PRAZO COM A CONTA À VISTA. Era um percentual sozinho, e percentual sozinho
  // a sala tem de acreditar. A barra mostra de onde ele sai — inclusive a fatia
  // que não dá para medir, que some quando só o número aparece.
  function slidePrazo(pptx, d, pagina) {
    var z = d.prazo;
    var s = slideBase(pptx);
    var cor = z.pct >= 80 ? C.verde : z.pct >= 50 ? C.ambar : C.vermelho;
    s.addText('Entregues no prazo', { x: 0.7, y: 0.62, w: 8.6, h: 0.4, fontSize: 16, color: C.fraco });
    s.addText(z.pct + '%', { x: 0.7, y: 1.0, w: 4.2, h: 1.5, fontSize: 92, bold: true, color: cor });
    s.addText(z.noPrazo + ' de ' + z.medidas + ' entregas medidas', {
      x: 0.72, y: 2.45, w: 4.2, h: 0.35, fontSize: 15, color: C.texto });

    var faixas = [
      { rot: 'No prazo', val: z.noPrazo, cor: C.verde },
      { rot: 'Com atraso', val: z.atrasadas ? z.atrasadas.length : 0, cor: C.vermelho },
      { rot: 'Sem medição', val: z.naoMedidas || 0, cor: C.fraco },
    ].filter(function (x) { return x.val > 0; });
    var total = faixas.reduce(function (t, x) { return t + x.val; }, 0) || 1;
    var x0 = 5.3, larg = 4.0;
    faixas.forEach(function (x, i) {
      var w = larg * x.val / total;
      s.addShape(pptx.ShapeType.rect, { x: x0, y: 1.15, w: w, h: 0.42, fill: { color: x.cor } });
      x0 += w;
    });
    faixas.forEach(function (x, i) {
      var y = 1.85 + i * 0.62;
      s.addShape(pptx.ShapeType.rect, { x: 5.3, y: y + 0.06, w: 0.16, h: 0.16, fill: { color: x.cor } });
      s.addText(String(x.val), { x: 5.6, y: y - 0.03, w: 0.7, h: 0.4, fontSize: 20, bold: true, color: x.cor });
      s.addText(x.rot, { x: 6.35, y: y + 0.04, w: 3.0, h: 0.35, fontSize: 13, color: C.fraco });
    });

    if (z.diasMedio) {
      s.addText('Quando atrasa, atrasa ' + z.diasMedio + (z.diasMedio === 1 ? ' dia' : ' dias') +
                ' em média.', { x: 0.7, y: 3.95, w: 8.6, h: 0.4, fontSize: 16, color: C.texto });
    }
    // A ressalva fica: sem ela, "78% no prazo" parece valer para tudo que saiu.
    if (z.naoMedidas) {
      s.addText(z.naoMedidas + ' conclusões não entram na conta: a data foi registrada ' +
                'retroativamente, então "no prazo" seria verdade por construção.', {
        x: 0.7, y: 4.4, w: 8.6, h: 0.5, fontSize: 12, color: C.fraco, lineSpacingMultiple: 1.3 });
    }
    rodape(s, d.periodo, pagina);
    return s;
  }

  /* ── O deck ─────────────────────────────────────────────────────────────
     A ordem é a da conversa, não a da tela: o que entregamos, o que valeu a
     pena, onde falhamos e por quê, o que vem. */
  async function montaDeck(d) {
    await carregaLib();
    var pptx = new window.PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'Roadmap de Melhorias';
    pptx.title = d.titulo + ' — ' + d.periodo;

    var p = 0;
    slideCapa(pptx, d);

    // 1. O mês inteiro: o que entrou, o que foi tocado, o que saiu, o que ficou.
    if (d.secoes.entregas) slideMes(pptx, d, ++p);

    // 2. Prazo: a pergunta que a diretoria faz.
    if (d.secoes.prazo && d.prazo.medidas) {
      slidePrazo(pptx, d, ++p);

      if (d.prazo.atrasadas.length) {
        var s = slideTitulo(pptx, 'Onde escapou do prazo',
          d.prazo.atrasadas.length + ' entregas, atraso médio de ' + d.prazo.diasMedio +
          (d.prazo.diasMedio === 1 ? ' dia' : ' dias'), ++p);
        tabela(pptx, s, ['Demanda', 'Responsável', 'Prazo → conclusão', 'Atraso'],
          d.prazo.atrasadas.map(function (a) {
            return [corta(a.titulo, 44), a.dev, a.datas,
                    { text: '+' + a.dias + 'd', options: { color: C.vermelho, bold: true } }];
          }), { colW: [3.9, 1.6, 2.1, 1.0], rotuloSobra: ' entregas com atraso' });
      }
    }

    // 3. Chegou x saiu. Vem logo depois do volume porque e a pergunta seguinte:
    //    entregamos 69, mas a fila cresceu ou diminuiu?
    if (d.secoes.fluxo && d.fluxo && (d.fluxo.recebidas || d.fluxo.entregues)) {
      slideFluxo(pptx, d.fluxo, ++p, d.periodo);
    }

    // 4. O time e as frentes: agregado, antes do detalhe.
    if (d.secoes.time && d.time) slideTime(pptx, d.time, ++p, d.periodo, d.ausencias);
    if (d.secoes.areas && (d.areas || []).length) slideAreas(pptx, d.areas, ++p, d.periodo);

    // 5. Quem pediu. O time e uma leitura; a area cliente e outra, e e a que diz
    //    para onde a capacidade foi de fato.
    if (d.secoes.solicit && d.solicitantes) {
      slideBarras(pptx, {
        titulo: 'Quem mais pediu', sub: 'demandas concluídas no período, por solicitante',
        itens: d.solicitantes.itens, max: 5, cor: C.roxo,
        rotuloSobra: ' solicitantes',
        // A nota existe porque o ranking some com quem nao tem solicitante. Sem
        // dizer quantas ficaram de fora, a soma das barras nao bate com o total
        // do primeiro slide — e alguem soma.
        nota: d.solicitantes.sem
          ? d.solicitantes.sem + ' de ' + d.solicitantes.total + ' sem solicitante registrado'
          : '',
        vazio: 'Nenhuma entrega do período tem solicitante registrado.',
      }, ++p, d.periodo);
    }

    // 5b. Distribuição por pessoa.
    if (d.secoes.grafico && (d.porDev || []).length) {
      slideBarras(pptx, {
        titulo: 'Entregas por desenvolvedor', sub: 'demandas concluídas no período',
        itens: d.porDev, cor: C.verde, rotuloSobra: ' pessoas',
      }, ++p, d.periodo);
    }

    // As imagens seguem suportadas para quem quiser mandar um grafico pronto,
    // mas nenhum slide do deck depende delas hoje.
    (d.imagens || []).forEach(function (img) {
      var si = slideTitulo(pptx, img.titulo, img.sub || '', ++p);
      si.addImage({ data: img.png, x: 0.7, y: 1.5, w: 8.6, h: 3.4 });
    });

    // 6. O que trava: pausadas e sem estimativa. É a parte que a diretoria pode
    //    destravar — e a única razão de ela estar no deck.
    if (d.secoes.riscos && (d.riscos.pausadas.length || d.riscos.semPonto)) {
      var sr = slideTitulo(pptx, 'O que está travado', 'depende de decisão fora do time', ++p);
      if (d.riscos.pausadas.length) {
        tabela(pptx, sr, ['Demanda', 'Parada há', 'Motivo'],
          d.riscos.pausadas.map(function (x) {
            return [corta(x.titulo, 40),
                    { text: x.dias + 'd', options: { color: C.ambar } },
                    corta(x.motivo, 46)];
          }), { colW: [3.6, 1.0, 4.0], rotuloSobra: ' pausadas' });
      } else {
        sr.addText('Nenhuma demanda pausada.', { x: 0.7, y: 1.7, w: 8.6, h: 0.4,
                                                 fontSize: 15, color: C.fraco });
      }
    }

    // 7. OS DESTAQUES, no fim. Eles saiam no meio do deck, antes dos graficos —
    //    mas quem apresenta usa as ultimas paginas para as entregas que importam,
    //    e slide de encerramento no meio e slide que a sala nao leva embora.
    (d.destaques || []).forEach(function (m) {
      var s = slideBase(pptx);
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: 5.63, fill: { color: C.verde } });
      s.addText(m.codigo || '', { x: 0.7, y: 0.6, w: 8.6, h: 0.35, fontSize: 13, color: C.verde, bold: true });
      s.addText(m.titulo || '', { x: 0.7, y: 1.0, w: 8.6, h: 0.9, fontSize: 28, bold: true, color: C.texto });
      if (m.texto) {
        s.addText(m.texto, { x: 0.7, y: 2.1, w: 8.6, h: 2.2, fontSize: 15,
                             color: C.texto, lineSpacingMultiple: 1.35 });
      }
      // Sem emoji aqui: se a maquina que projeta nao tiver o glifo, ele vira
      // quadrado — e quadrado no slide da diretoria custa mais que o icone vale.
      var meta = [m.dev || '', m.tema || '',
                  m.pontos ? m.pontos + ' pontos' : ''].filter(Boolean).join('   ·   ');
      if (meta) s.addText(meta, { x: 0.7, y: 4.4, w: 8.6, h: 0.35, fontSize: 12, color: C.fraco });
      rodape(s, 'Destaque · ' + d.periodo, ++p);
    });

    // 8. O que vem. Terminar em compromisso, não em número.
    if (d.secoes.proximo) {
      var sp = slideTitulo(pptx, 'O que vem', d.proximo.sub || '', ++p);
      if (d.proximo.itens.length) {
        tabela(pptx, sp, ['Demanda', 'Responsável', 'Entrega'],
          d.proximo.itens.map(function (x) {
            return [corta(x.titulo, 48), x.dev, x.entrega];
          }), { colW: [5.0, 2.2, 1.4], rotuloSobra: ' no próximo mês' });
      } else {
        sp.addText('Nada planejado para o próximo período ainda.',
          { x: 0.7, y: 1.7, w: 8.6, h: 0.4, fontSize: 15, color: C.fraco });
      }
    }

    // 9. A mensagem de quem apresenta. Fica por último porque é a frase que a
    //    sala leva embora, e ela é escrita por uma pessoa — não calculada.
    if (d.mensagem || (d.frentesAtraso || []).length) {
      var sm = slideBase(pptx);
      sm.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: 5.63, fill: { color: C.azul } });
      if (d.mensagem) {
        sm.addText(d.mensagem, { x: 0.9, y: 1.3, w: 8.4, h: 1.7, fontSize: 24,
                                 color: C.texto, lineSpacingMultiple: 1.35 });
      }
      // AS FRENTES, com nome. "Concentrou-se em duas frentes" sem dizer quais e
      // uma frase que nao sustenta a pergunta seguinte — e a pergunta vem.
      if ((d.frentesAtraso || []).length) {
        sm.addText('O atraso concentrou-se em:', {
          x: 0.9, y: 3.15, w: 8.4, h: 0.3, fontSize: 13, color: C.fraco });
        d.frentesAtraso.slice(0, 3).forEach(function (f, i) {
          sm.addText(corta(f.nome, 40), {
            x: 0.9 + i * 2.85, y: 3.5, w: 2.7, h: 0.35, fontSize: 14, color: C.texto });
          sm.addText(f.qtd + (f.qtd === 1 ? ' entrega' : ' entregas') +
                     (f.dias ? '  ·  ' + f.dias + 'd em média' : ''), {
            x: 0.9 + i * 2.85, y: 3.85, w: 2.7, h: 0.3, fontSize: 12, color: C.vermelho });
        });
      }
      rodape(sm, d.periodo, ++p);
    }

    return pptx;
  }

  window.apresentacaoMontaDeck = montaDeck;
  window.apresentacaoGraficoPng = graficoEmPng;
  window.apresentacaoCores = C;
  window.apresentacaoMesNome = function (i) { return MES_NOME[i] || ''; };
  window.apresentacaoEsc = esc;
})();
