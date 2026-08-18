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

    // O TAMANHO DO TÍTULO É CALCULADO, e não escolhido.
    //
    // Duas tentativas falharam antes desta. A primeira pediu Montserrat a 78pt: a
    // máquina que abriu não tem a fonte, o PowerPoint trocou por uma mais larga, e
    // "TECNOLOGIA" partiu em duas linhas por cima do "RELATÓRIO DE". A segunda
    // manteve o tamanho e confiou no `wrap: false` — que sai correto no arquivo
    // (conferi o `wrap="none"` no XML) e mesmo assim quebrou na tela.
    //
    // Então o tamanho passa a sair de conta: largura da caixa dividida pelo número
    // de letras, com a fonte declarada e a largura média que ELA tem. Arial Black
    // está em qualquer Windows, é pesada como a original, e sua maiúscula ocupa
    // ~0,88 do corpo. Com isso o título cabe em uma linha por construção, e não
    // por promessa de renderizador.
    var verde = cap.verde || '00FD54';
    var tipo = { fontFace: 'Arial Black', margin: 0, wrap: false, valign: 'top' };
    var titulo = (cfg.tituloCapa || 'TECNOLOGIA').toUpperCase();
    var LARG = 6.6;                       // da margem esquerda do texto até a borda
    var corpo = Math.min(62, Math.floor(LARG / (0.88 * Math.max(titulo.length, 1)) * 72));

    s.addText((cfg.rotuloCapa || 'RELATÓRIO DE').toUpperCase(), Object.assign({
      x: 3.35, y: 1.88, w: 6.4, h: 0.3, fontSize: 18, bold: true,
      color: verde, charSpacing: 1 }, tipo));
    s.addText(titulo, Object.assign({
      x: 3.3, y: 2.2, w: LARG, h: 1.0, fontSize: corpo, bold: true,
      color: 'FFFFFF' }, tipo));
    s.addText(String(cfg.periodo || '').toUpperCase(), Object.assign({
      x: 3.35, y: 3.3, w: 6.4, h: 0.35, fontSize: 18, bold: true,
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

  // PROJETOS EM ABERTO, e o que andou neles no período.
  //
  // Projeto aberto aparece SEMPRE — inclusive o que não teve tarefa nenhuma no
  // mês, dito com todas as letras. Omitir o parado seria esconder justamente o que
  // merece pergunta na reunião: um projeto aberto há três meses sem uma única
  // tarefa não é ausência de notícia, é a notícia.
  //
  // Duas colunas de número por projeto: o que foi concluído no mês e o que ficou
  // em andamento. As duas contas param no corte do período, como o resto do deck.
  function slideProjetos(pptx, lista, pagina, periodo) {
    var s = slideTitulo(pptx, 'Projetos', 'o que andou no período', pagina);
    if (!lista.length) {
      s.addText('Nenhum projeto em aberto no período.', {
        x: 0.7, y: 1.7, w: 8.6, h: 0.4, fontSize: 15, color: C.fraco });
      rodape(s, periodo, pagina);
      return s;
    }
    // Cinco linhas e a linha do "e mais": com ALT de 0,72 a ultima caia em cima do
    // rodape. O slide tem 5,63" e o rodape mora em 5,05".
    var TOPO = 1.55, ALT = 0.66;
    var vis = lista.slice(0, 5);
    vis.forEach(function (p, i) {
      var y = TOPO + i * ALT;
      var parado = !p.feitas && !p.andando;
      s.addShape(pptx.ShapeType.rect, { x: 0.7, y: y, w: 0.06, h: 0.5,
                                        fill: { color: parado ? C.ambar : C.verde } });
      s.addText(corta(p.nome, 52), { x: 0.95, y: y - 0.02, w: 5.6, h: 0.35,
                                     fontSize: 15, color: C.texto });
      if (p.resp) {
        s.addText(corta(p.resp, 40), { x: 0.95, y: y + 0.28, w: 5.6, h: 0.28,
                                       fontSize: 11.5, color: C.fraco });
      }
      if (parado) {
        // Dito com todas as letras, e não com um zero que se lê como "não sei".
        s.addText('sem task no mês', { x: 6.7, y: y + 0.08, w: 2.9, h: 0.35,
                                       fontSize: 13, color: C.ambar });
        return;
      }
      var cols = [
        { v: p.feitas, rot: 'concluídas', cor: C.verde, x: 6.7 },
        { v: p.andando, rot: 'em andamento', cor: C.azul, x: 8.1 },
      ];
      cols.forEach(function (c) {
        s.addText(String(c.v), { x: c.x, y: y - 0.04, w: 0.7, h: 0.4,
                                 fontSize: 20, bold: true, color: c.cor });
        s.addText(c.rot, { x: c.x, y: y + 0.32, w: 1.4, h: 0.25, fontSize: 10.5, color: C.fraco });
      });
    });
    var sobra = lista.length - vis.length;
    if (sobra > 0) {
      s.addText('… e mais ' + sobra + (sobra === 1 ? ' projeto em aberto' : ' projetos em aberto'), {
        x: 0.7, y: TOPO + vis.length * ALT + 0.02, w: 8.6, h: 0.3, fontSize: 11.5, color: C.fraco });
    }
    rodape(s, periodo, pagina);
    return s;
  }

  /* O TÍTULO NÃO DESENHA O RODAPÉ.
     Ele desenhava, e quase todo slide chamava `rodape()` de novo no fim para pôr
     o mês — resultado: o NÚMERO DA PÁGINA saía duas vezes, um exatamente em cima
     do outro. No PowerPoint isso não some, engorda: o dígito fica mais denso que
     o dos slides que não repetiam, e ninguém sabia dizer por quê.

     Agora quem monta o slide desenha o rodapé uma vez, com o mês que ele conhece.
     `rodapeVazio` serve aos poucos slides que não têm mês a exibir.             */
  function slideTitulo(pptx, titulo, sub, pagina) {
    var s = slideBase(pptx);
    s.addText(titulo, { x: 0.7, y: 0.55, w: 8.6, h: 0.5, fontSize: 24, bold: true, color: C.texto });
    if (sub) s.addText(sub, { x: 0.7, y: 1.05, w: 8.6, h: 0.35, fontSize: 13, color: C.fraco });
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
  function slideTime(pptx, t, pagina, periodo, ausencias, cap) {
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
        var y = 1.9 + i * 0.55;
        s.addText(String(it.valor), {
          x: c.x, y: y, w: 0.9, h: 0.45, fontSize: 22, bold: true, color: c.cor });
        s.addText(corta(it.nome, 18), {
          x: c.x + 0.85, y: y + 0.08, w: 1.9, h: 0.35, fontSize: 12, color: C.texto });
      });
    });
    // O TAMANHO DO TIME E OS DIAS QUE ELE TINHA. Vinha do slide de demanda x
    // capacidade, que saiu por repetir o slide do mês; aqui a informação fica onde
    // se fala de gente, que é o lugar dela.
    if (cap && cap.devs) {
      s.addText(cap.devs + (cap.devs === 1 ? ' pessoa atuou' : ' pessoas atuaram') +
                ' no período   ·   ' + cap.uteis + ' dias úteis' +
                (cap.fora ? '   ·   −' + cap.fora + ' dias de ausência' : ''),
        { x: 0.7, y: 4.15, w: 8.6, h: 0.3, fontSize: 13, color: C.azul });
    }

    // QUEM ESTEVE FORA. Sem esta linha o slide convida a leitura errada: quem
    // tirou uma semana de ferias entrega menos e aparece embaixo da lista como se
    // tivesse rendido menos. As ausencias ja estao cadastradas no Planejamento —
    // so faltava cruza-las aqui.
    //
    // Uma linha, e nao um numero ao lado de cada nome: sao tres colunas que ja tem
    // numero, e um quarto ali vira ruido.
    if ((ausencias || []).length) {
      s.addText('Fora no período', { x: 0.7, y: 4.5, w: 8.6, h: 0.3,
                                     fontSize: 13, color: C.fraco });
      s.addText(ausencias.slice(0, 6).map(function (a) {
        return a.nome + ' (' + a.dias + (a.dias === 1 ? ' dia' : ' dias') +
               (a.tipo ? ', ' + a.tipo : '') + ')';
      }).join('   ·   '), { x: 0.7, y: 4.78, w: 8.6, h: 0.32, fontSize: 13,
                            color: C.ambar });
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
        x: X_BARRA + LARG + 0.12, y: y, w: 0.45, h: alt,
        fontSize: 13, bold: true, color: cfg.cor || C.azul, valign: 'middle' });
      // O valor de apoio (os pontos, no slide por dev): entrega e volume, ponto e
      // peso, e um sem o outro deixa a leitura pela metade.
      if (it.extra != null && cfg.rotuloExtra) {
        // Ate 9,95": a barra termina em 8,63", o numero ocupa ate 9,2", e o resto
        // e o que sobra ate a margem. Com 1" de caixa, "97 pts" saia do slide.
        s.addText(it.extra + ' ' + cfg.rotuloExtra, {
          x: X_BARRA + LARG + 0.58, y: y, w: 0.77, h: alt,
          fontSize: 10.5, color: C.fraco, valign: 'middle' });
      }
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

  /* AS FRENTES DE TRABALHO — planejado × realizado, no formato do painel que a
     diretoria já aprovou: três números no topo e um cartão por frente.

     O FORMATO É DELIBERADAMENTE O DAQUELE PAINEL. Quem já leu aquele quadro não
     precisa reaprender a ler este slide, e a cor de cada frente é a mesma de lá.

     A COR DO PERCENTUAL SEGUE A DISTÂNCIA DO PLANEJADO, para os dois lados. 160%
     não é "melhor" que 100%: significa que a estimativa não valeu, e pintar isso
     de verde esconderia exatamente o que a sala precisa discutir.

     A COBERTURA DE HORAS VAI NO RODAPÉ, sempre. Um mês com 39% das entregas sem
     hora lançada mostra execução baixa por falta de lançamento, e não por falta
     de trabalho — sem a nota, o slide acusa o time de algo que não aconteceu.  */
  function corPercentual(pct) {
    if (pct == null) return C.fraco;
    if (pct >= 85 && pct <= 115) return C.verde;
    if (pct >= 60 && pct <= 140) return C.ambar;
    return C.vermelho;
  }

  function slidePipelines(pptx, pl, pagina, periodo) {
    var s = slideTitulo(pptx, 'Frentes de trabalho',
      'horas planejadas × realizadas no período', pagina);
    var itens = (pl.itens || []).filter(function (i) {
      // Frente sem nada no mês não vira cartão zerado: "0h / 0h / 0%" num slide
      // executivo só gera a pergunta "e por que isso está zerado?" no meio da
      // apresentação.
      return i.entregas > 0 || i.plan > 0 || i.real > 0;
    });
    if (!itens.length) {
      s.addText('Sem entregas com frente definida no período.',
        { x: 0.7, y: 1.7, w: 8.6, h: 0.4, fontSize: 15, color: C.fraco });
      rodape(s, periodo, pagina);
      return s;
    }

    // ── Os três números do mês, na mesma ordem do painel aprovado ──────────
    var t = pl.total || {};
    var kpis = [
      { rot: 'PLANEJADO', val: t.plan + 'h', cor: C.azul },
      { rot: 'REALIZADO', val: t.real + 'h', cor: C.verde },
      { rot: 'EXECUÇÃO', val: t.pct == null ? '—' : t.pct + '%', cor: corPercentual(t.pct) },
    ];
    kpis.forEach(function (k, i) {
      var x = 0.7 + i * 2.95;
      s.addShape(pptx.ShapeType.roundRect, {
        x: x, y: 1.40, w: 2.7, h: 0.76, rectRadius: 0.06,
        fill: { color: C.fundo2 }, line: { color: C.fundo2 } });
      s.addText(k.rot, { x: x + 0.16, y: 1.45, w: 2.4, h: 0.22,
                         fontSize: 9.5, color: C.fraco, charSpacing: 1 });
      s.addText(k.val, { x: x + 0.16, y: 1.65, w: 2.4, h: 0.46,
                         fontSize: 25, bold: true, color: k.cor });
    });

    /* ── Um cartão por frente ───────────────────────────────────────────────
       Três por linha: com quatro, "Dados & Inteligência" não cabe em uma linha e
       o cartão fica com o título quebrado no meio.

       AS MEDIDAS SÃO CONTADAS, e não escolhidas: o slide tem 5,63" e o rodapé
       ocupa a partir de 5,05". Com duas linhas de cartões de 1,12" e vão de
       0,17", a segunda linha terminava em 4,85" e passava POR CIMA da nota de
       cobertura em 4,72". Aqui a última linha fecha em 4,52" e as duas notas
       cabem antes do rodapé.                                                  */
    var COLS = 3, LARG = 2.7, ALT = 1.04, VAO_X = 0.25, VAO_Y = 0.12;
    var Y0 = 2.32;
    itens.slice(0, 6).forEach(function (it, i) {
      var col = i % COLS, lin = Math.floor(i / COLS);
      var x = 0.7 + col * (LARG + VAO_X);
      var y = Y0 + lin * (ALT + VAO_Y);

      s.addShape(pptx.ShapeType.roundRect, {
        x: x, y: y, w: LARG, h: ALT, rectRadius: 0.06,
        fill: { color: C.fundo2 }, line: { color: C.fundo2 } });
      // A faixa da cor da frente no topo do cartão — é ela que liga este slide ao
      // painel que a sala já conhece.
      s.addShape(pptx.ShapeType.rect, {
        x: x, y: y, w: LARG, h: 0.05, fill: { color: it.cor } });

      // A caixa do nome PARA antes de onde o percentual começa. Com `LARG - 0.85`
      // ela terminava em x+1,99" e o percentual abria em x+1,92": 0,07" de
      // sobreposição, o bastante para "Dados & Inteligência" encostar no número.
      s.addText(corta(it.nome, 21), {
        x: x + 0.14, y: y + 0.10, w: LARG - 0.98, h: 0.24,
        fontSize: 11, bold: true, color: C.texto });
      s.addText(it.pct == null ? '—' : it.pct + '%', {
        x: x + LARG - 0.78, y: y + 0.10, w: 0.66, h: 0.24,
        fontSize: 12, bold: true, color: corPercentual(it.pct), align: 'right' });

      s.addText(it.plan + 'h', { x: x + 0.14, y: y + 0.34, w: 1.1, h: 0.32,
                                 fontSize: 16, bold: true, color: C.azul });
      s.addText(it.real + 'h', { x: x + 1.30, y: y + 0.34, w: 1.1, h: 0.32,
                                 fontSize: 16, bold: true, color: C.verde });
      s.addText('planejado', { x: x + 0.14, y: y + 0.64, w: 1.1, h: 0.18,
                               fontSize: 8, color: C.fraco });
      s.addText('realizado', { x: x + 1.30, y: y + 0.64, w: 1.1, h: 0.18,
                               fontSize: 8, color: C.fraco });

      // A composição da frente: quantidade, e a quebra que distingue construir de
      // manter de pé. Sem ela, dez entregas de sustentação e dez de evolução
      // aparecem como o mesmo mês.
      var comp = [it.entregas + (it.entregas === 1 ? ' entrega' : ' entregas')];
      if (it.evolucao) comp.push(it.evolucao + ' evol.');
      if (it.sustentacao) comp.push(it.sustentacao + ' sust.');
      s.addText(comp.join('  ·  '), {
        x: x + 0.14, y: y + 0.82, w: LARG - 0.28, h: 0.18,
        fontSize: 8.5, color: C.fraco });
    });

    // ── O rodapé que impede a leitura errada ───────────────────────────────
    var cob = pl.cobertura || {};
    var notas = [];
    if (cob.total) {
      notas.push('Horas lançadas em ' + cob.comHoras + ' de ' + cob.total +
                 ' entregas (' + cob.pct + '%)' +
                 (cob.pct < 90 ? ' — o restante entra por aproximação' : ''));
    }
    // Planejado = dia útil da pessoa dividido entre o que ela tinha em mãos. A
    // frase existe porque a primeira pergunta da sala sobre este slide é sempre
    // "de onde saiu o planejado?".
    notas.push('Planejado: cada dia útil vale 8h, divididas entre as demandas do dia');
    s.addText(notas.join('   ·   '), {
      x: 0.7, y: 4.58, w: 8.6, h: 0.2, fontSize: 8.5, color: C.fraco });
    if ((pl.foraDoDeck || []).length) {
      s.addText('Fora do recorte: ' + pl.foraDoDeck.join(', '), {
        x: 0.7, y: 4.78, w: 8.6, h: 0.2, fontSize: 8.5, color: C.fraco });
    }
    rodape(s, periodo, pagina);
    return s;
  }

  /* A VARIAÇÃO CONTRA O MÊS ANTERIOR.

     A COR SEGUE A MELHORA, E NÃO O SINAL. Em metade dos números deste deck crescer
     é ruim: backlog que sobe não é boa notícia, fila que cresce também não. Pintar
     "+14 no backlog" de verde faria o slide mentir para a sala. Então cada número
     diz para que lado é a melhora, e o que muda é só a cor — o sinal continua ali.

     Sem base anterior nada é desenhado: um "—" naquele lugar é lido como zero.   */
  function variacao(atual, antes, bomSubir) {
    if (antes == null || atual == null) return null;
    var dif = atual - antes;
    var melhor = bomSubir ? dif > 0 : dif < 0;
    return { dif: dif, cor: dif === 0 ? C.fraco : (melhor ? C.verde : C.vermelho) };
  }

  function desenhaVariacao(s, v, x, y, w, refNome, sufixo) {
    if (!v) return;
    var txt = v.dif === 0
      ? '= igual a ' + refNome
      : (v.dif > 0 ? '▲ +' : '▼ ') + Math.abs(v.dif) + (sufixo || '') + ' vs ' + refNome;
    s.addText(txt, { x: x, y: y, w: w, h: 0.24, fontSize: 10, color: v.cor });
  }

  /* A HISTÓRIA DO MÊS: o backlog que já existia, o que entrou, o que saiu e o que
     sobrou — nessa ordem, com os sinais entre os números, para a sala acompanhar a
     conta em vez de receber quatro valores soltos.

     Cada número leva DUAS leituras a mais: a variação contra o mês anterior e a
     quebra entre evolução e sustentação. Quantidade sem essa quebra não distingue
     um mês de construir de um mês de manter de pé o que existe.

     O ÚLTIMO BLOCO É DATADO de propósito. "Em aberto ao virar o mês" era ambíguo —
     vinha do mês anterior, ou ia para o próximo? E com o mês em curso, virar o mês
     ainda não aconteceu.                                                         */
  function slideMes(pptx, d, pagina) {
    var s = slideTitulo(pptx, 'O mês', 'backlog, entradas e saídas', pagina);
    var f = d.fluxo || {};
    var k = d.kpi || {};
    var a = d.anterior;
    var q = d.quebra || {};

    // `bomSubir`: sair mais é bom, sobrar mais não é. Backlog é estoque, e estoque
    // que cresce não é ganho.
    var passos = [
      { rot: 'Backlog no dia 1', val: f.backlogInicio, cor: C.fraco, sinal: '',
        chave: 'backlogInicio', bomSubir: false },
      { rot: 'Entraram', val: f.recebidas, cor: C.azul, sinal: '+',
        chave: 'recebidas', bomSubir: true },
      { rot: 'Saíram da fila', val: f.saidas, cor: C.verde, sinal: '−',
        chave: 'saidas', bomSubir: true },
      { rot: f.emCurso ? 'Em aberto hoje' : 'Em aberto no fim do mês',
        val: f.backlogFim, cor: C.ambar, sinal: '=',
        chave: 'backlogFim', bomSubir: false },
    ].filter(function (x) { return x.val != null; });

    var larg = 2.0, vao = 0.35;
    var passo = larg + vao + 0.05;
    passos.forEach(function (e, i) {
      var x = 0.7 + i * passo;
      if (e.sinal) {
        s.addText(e.sinal, { x: x - vao - 0.05, y: 1.62, w: 0.4, h: 0.5,
                             fontSize: 26, color: C.fraco, align: 'center' });
      }
      s.addText(e.rot, { x: x, y: 1.4, w: larg, h: 0.28, fontSize: 12, color: C.fraco });
      s.addText(String(e.val), { x: x, y: 1.64, w: larg, h: 0.7,
                                 fontSize: 40, bold: true, color: e.cor });
      // A caixa nao pode passar da margem: na ultima coluna, `larg + 0.3` estourava
      // a borda direita do slide.
      var cx = Math.min(larg + 0.3, 9.9 - x);
      if (a) desenhaVariacao(s, variacao(e.val, a[e.chave], e.bomSubir), x, 2.34, cx, a.nome);
      // A quebra por tipo, uma linha por item e dentro da largura da coluna: numa
      // caixa mais larga, a segunda linha de uma coluna passa por cima da vizinha.
      var qq = q[e.chave];
      if (qq) {
        var partes = [];
        if (qq.evolucao) partes.push(qq.evolucao + ' evolução');
        if (qq.sustentacao) partes.push(qq.sustentacao + ' sustentação');
        if (qq.sem) partes.push(qq.sem + ' sem classificar');
        partes.forEach(function (txt, j) {
          s.addText(txt, { x: x, y: 2.64 + j * 0.23, w: cx, h: 0.23,
                           fontSize: 10.5, color: j === 2 ? C.fraco : C.texto });
        });
      }
    });

    // A frase que a sala leva. Sem ela, os quatro números ficam por conta de quem
    // estiver somando de cabeça.
    if (f.recebidas != null && f.saidas != null) {
      var saldo = f.recebidas - f.saidas;
      s.addText(saldo > 0
        ? 'Entrou mais do que saiu: a fila cresceu ' + saldo + (saldo === 1 ? ' demanda' : ' demandas') + '.'
        : (saldo < 0
            ? 'Saiu mais do que entrou: a fila diminuiu ' + Math.abs(saldo) +
              (saldo === -1 ? ' demanda' : ' demandas') + '.'
            : 'Entrou e saiu o mesmo tanto: a fila ficou do mesmo tamanho.'),
        { x: 0.7, y: 3.62, w: 8.6, h: 0.36, fontSize: 16, color: saldo > 0 ? C.ambar : C.verde });
    }
    var saiu = [];
    if (f.saiuEntregue) saiu.push(f.saiuEntregue + ' entregues');
    if (f.saiuNegada) saiu.push(f.saiuNegada + (f.saiuNegada === 1 ? ' recusada' : ' recusadas'));
    if (k.pontos) saiu.push(k.pontos + ' pontos');
    if (saiu.length) {
      s.addText('Das saídas: ' + saiu.join('  ·  '), {
        x: 0.7, y: 4.02, w: 8.6, h: 0.3, fontSize: 12, color: C.fraco });
    }
    if (f.corte) {
      s.addText((f.emCurso ? 'Posição de ' : 'Fechamento em ') + f.corte +
                (f.tocadas ? '   ·   ' + f.tocadas + ' demandas trabalhadas no período' : '') +
                (a && a.parcial ? '   ·   comparação parcial: ' + a.nome + ' está completo' : ''), {
        x: 0.7, y: 4.36, w: 8.6, h: 0.3, fontSize: 11, color: C.fraco });
    }
    rodape(s, d.periodo, pagina);
    return s;
  }

  /* ENTREGAS RÁPIDAS: entrou e saiu em até dois dias.

     É o melhor argumento de eficiência que estes dados têm, e estava invisível no
     deck. Cada linha leva o que a sala pergunta em seguida: quantos dias, se é
     sustentação ou evolução, em que módulo e de quem foi.                        */
  function slideRapidas(pptx, r, pagina, periodo, anterior) {
    var s = slideTitulo(pptx, 'Entregas rápidas', 'entraram e saíram em até dois dias', pagina);
    var itens = r.itens || [];
    if (!itens.length) {
      s.addText('Nenhuma entrega do período fechou em até dois dias.', {
        x: 0.7, y: 1.7, w: 8.6, h: 0.4, fontSize: 15, color: C.fraco });
      rodape(s, periodo, pagina);
      return s;
    }
    var pct = r.total ? Math.round(itens.length / r.total * 100) : 0;
    s.addText(String(itens.length), { x: 0.7, y: 1.35, w: 1.5, h: 0.9,
                                      fontSize: 46, bold: true, color: C.verde });
    s.addText('de ' + r.total + ' entregas do mês  ·  ' + pct + '%', {
      x: 2.2, y: 1.62, w: 3.4, h: 0.4, fontSize: 14, color: C.texto });
    if (anterior && anterior.rapidas != null) {
      desenhaVariacao(s, variacao(itens.length, anterior.rapidas, true),
                      2.2, 2.0, 3.4, anterior.nome);
    }

    var TOPO = 2.45, ALT = 0.4;
    var vis = itens.slice(0, 6);
    vis.forEach(function (it, i) {
      var y = TOPO + i * ALT;
      s.addText(it.dias === 0 ? 'no dia' : it.dias + (it.dias === 1 ? ' dia' : ' dias'), {
        x: 0.7, y: y, w: 0.85, h: 0.3, fontSize: 11.5, bold: true, color: C.verde });
      s.addText(corta(it.titulo, 46), { x: 1.6, y: y, w: 4.0, h: 0.3,
                                        fontSize: 12, color: C.texto });
      s.addText([it.tipo, it.tema].filter(Boolean).join(' · '), {
        x: 5.65, y: y, w: 2.6, h: 0.3, fontSize: 10.5, color: C.fraco });
      s.addText(corta(it.dev, 20), { x: 8.3, y: y, w: 1.4, h: 0.3,
                                     fontSize: 10.5, color: C.azul });
    });
    var sobra = itens.length - vis.length;
    if (sobra > 0) {
      s.addText('… e mais ' + sobra + (sobra === 1 ? ' entrega em até dois dias' : ' entregas em até dois dias'), {
        x: 0.7, y: TOPO + vis.length * ALT + 0.04, w: 8.6, h: 0.3,
        fontSize: 11, color: C.fraco });
    }
    rodape(s, periodo, pagina);
    return s;
  }

  /* EVOLUÇÃO DOS ÚLTIMOS SEIS MESES, em barras desenhadas no slide.

     Um mês sozinho não mostra tendência, e tendência é o que vem depois do número
     na conversa. Duas barras por mês — entrou e saiu — e o "no prazo" embaixo, como
     texto: uma terceira barra em escala diferente (percentual junto de contagem)
     seria comparar coisas que não se comparam.

     Mês em curso leva reticências no rótulo: sem isso a última coluna sempre parece
     uma queda.                                                                   */
  function slideEvolucao(pptx, serie, pagina, periodo) {
    var s = slideTitulo(pptx, 'Evolução', 'entradas, saídas e prazo mês a mês', pagina);
    var vis = (serie || []).filter(function (x) { return x; });
    if (!vis.length) { rodape(s, periodo, pagina); return s; }

    var X0 = 0.9, LARG = 8.4, BASE = 3.62, ALTO = 1.85;
    var col = LARG / vis.length;
    var max = vis.reduce(function (m, x) {
      return Math.max(m, x.entraram || 0, x.sairam || 0);
    }, 1);
    var barra = Math.min(0.5, col * 0.3);

    vis.forEach(function (x, i) {
      var cx = X0 + i * col + (col - barra * 2 - 0.08) / 2;
      [{ v: x.entraram, cor: C.azul, dx: 0 },
       { v: x.sairam, cor: C.verde, dx: barra + 0.08 }].forEach(function (b) {
        var h = Math.max(0.04, ALTO * (b.v / max));
        s.addShape(pptx.ShapeType.rect, { x: cx + b.dx, y: BASE - h, w: barra, h: h,
                                          fill: { color: b.cor } });
        s.addText(String(b.v), { x: cx + b.dx - 0.12, y: BASE - h - 0.28, w: barra + 0.24, h: 0.26,
                                 fontSize: 10, color: b.cor, align: 'center' });
      });
      s.addText(x.rot + (x.parcial ? '…' : ''), {
        x: X0 + i * col, y: BASE + 0.06, w: col, h: 0.28,
        fontSize: 12, color: x.parcial ? C.texto : C.fraco, align: 'center' });
      s.addText(x.pct == null ? '—' : x.pct + '%', {
        x: X0 + i * col, y: BASE + 0.36, w: col, h: 0.26,
        fontSize: 11, color: x.pct == null ? C.fraco : (x.pct >= 80 ? C.verde : x.pct >= 50 ? C.ambar : C.vermelho),
        align: 'center' });
      s.addText(String(x.backlog), {
        x: X0 + i * col, y: BASE + 0.64, w: col, h: 0.26,
        fontSize: 11, color: C.fraco, align: 'center' });
    });

    // A legenda diz o que e cada linha; sem ela, tres numeros embaixo da barra
    // viram adivinhacao.
    [{ t: 'entraram', cor: C.azul }, { t: 'saíram', cor: C.verde }].forEach(function (l, i) {
      s.addShape(pptx.ShapeType.rect, { x: 0.9 + i * 1.4, y: 1.5, w: 0.14, h: 0.14,
                                        fill: { color: l.cor } });
      s.addText(l.t, { x: 1.1 + i * 1.4, y: 1.42, w: 1.2, h: 0.28, fontSize: 11, color: C.fraco });
    });
    s.addText('abaixo de cada mês: % no prazo e backlog no fim do mês', {
      x: 4.0, y: 1.42, w: 5.3, h: 0.28, fontSize: 11, color: C.fraco, align: 'right' });
    rodape(s, periodo, pagina);
    return s;
  }

  /* O MÊS DE UM DEV, em linha do tempo — o mesmo desenho do quadro do Planejamento.

     Slide por pessoa, e só para os três primeiros: é a visão de o que ela pegou,
     quando, e por quanto tempo cada coisa ficou com ela. Com dez nomes viraria
     lista, e a conversa sairia de "o que o time entregou" para "por que o fulano
     aparece embaixo".                                                            */
  function slideGanttDev(pptx, dv, pagina, periodo) {
    var s = slideTitulo(pptx, dv.nome,
      dv.entregas + (dv.entregas === 1 ? ' entrega' : ' entregas') +
      (dv.pontos ? '  ·  ' + dv.pontos + ' pontos' : '') + '  ·  no período', pagina);
    var X0 = 3.5, LARG = 6.1, TOPO = 1.75, ALT = 0.42;
    var dias = dv.dias || 31;

    // A régua de dias: sem ela a barra não diz quando, só quanto.
    [1, 5, 10, 15, 20, 25, dias].forEach(function (d) {
      var x = X0 + LARG * (d - 1) / Math.max(1, dias - 1);
      s.addText(String(d), { x: x - 0.15, y: 1.44, w: 0.3, h: 0.24,
                             fontSize: 9, color: C.fraco, align: 'center' });
    });

    var vis = (dv.barras || []).slice(0, 7);
    vis.forEach(function (b, i) {
      var y = TOPO + i * ALT;
      s.addText(corta(b.titulo, 34), { x: 0.7, y: y, w: 2.7, h: 0.3,
                                       fontSize: 10.5, color: C.texto });
      s.addShape(pptx.ShapeType.rect, { x: X0, y: y + 0.1, w: LARG, h: 0.14,
                                        fill: { color: C.fundo2 } });
      var x1 = X0 + LARG * (b.de - 1) / Math.max(1, dias - 1);
      var x2 = X0 + LARG * (b.ate - 1) / Math.max(1, dias - 1);
      s.addShape(pptx.ShapeType.rect, {
        x: x1, y: y + 0.06, w: Math.max(0.09, x2 - x1), h: 0.22,
        fill: { color: b.tipo === 'Sustentação' ? C.ambar : C.verde } });
      var meta = [b.tema, b.pontos ? b.pontos + ' pt' : ''].filter(Boolean).join(' · ');
      if (meta) s.addText(corta(meta, 30), { x: 0.7, y: y + 0.2, w: 2.7, h: 0.22,
                                             fontSize: 8.5, color: C.fraco });
    });
    var sobra = (dv.barras || []).length - vis.length;
    if (sobra > 0) {
      s.addText('… e mais ' + sobra + (sobra === 1 ? ' entrega' : ' entregas') + ' no mês', {
        x: 0.7, y: TOPO + vis.length * ALT + 0.04, w: 8.6, h: 0.28,
        fontSize: 11, color: C.fraco });
    }
    [{ t: 'evolução', cor: C.verde }, { t: 'sustentação', cor: C.ambar }].forEach(function (l, i) {
      s.addShape(pptx.ShapeType.rect, { x: 3.5 + i * 1.5, y: 4.92, w: 0.14, h: 0.14,
                                        fill: { color: l.cor } });
      s.addText(l.t, { x: 3.7 + i * 1.5, y: 4.85, w: 1.3, h: 0.26, fontSize: 10, color: C.fraco });
    });
    rodape(s, periodo, pagina);
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
    // O percentual e o numero que mais pede comparacao: 55% sozinho nao diz se
    // melhorou.
    if (d.anterior && d.anterior.pct != null) {
      desenhaVariacao(s, variacao(z.pct, d.anterior.pct, true), 0.72, 2.85, 4.2,
                      d.anterior.nome + ' (' + d.anterior.pct + '%)', ' pontos');
    }

    // "Sem medição" era um balde só, e parecia falha do relatório — a demanda TEM
    // data. O que falta é o PRAZO COMBINADO: sem ele não há com o que comparar a
    // conclusão. E quando a conclusão foi lançada depois, "no prazo" seria verdade
    // por construção. Duas razões, dois nomes.
    var faixas = [
      { rot: 'No prazo', val: z.noPrazo, cor: C.verde },
      { rot: 'Com atraso', val: z.atrasadas ? z.atrasadas.length : 0, cor: C.vermelho },
      // O atraso herdado tem faixa e cor propria: ele aconteceu no mes passado, e
      // some da conta deste — mas a entrega e desta, e some do deck seria pior.
      { rot: 'Atrasadas desde ' + (z.mesAnterior || 'o mês anterior'),
        val: z.herdadas || 0, cor: C.ambar },
      { rot: 'Sem prazo combinado', val: z.semPrazoComb || 0, cor: C.fraco },
      { rot: 'Data lançada depois', val: z.lancadaDepois || 0, cor: C.fraco },
    ].filter(function (x) { return x.val > 0; });
    var total = faixas.reduce(function (t, x) { return t + x.val; }, 0) || 1;
    var x0 = 5.3, larg = 4.0;
    faixas.forEach(function (x, i) {
      var w = larg * x.val / total;
      s.addShape(pptx.ShapeType.rect, { x: x0, y: 1.15, w: w, h: 0.42, fill: { color: x.cor } });
      x0 += w;
    });
    // Cinco faixas em 0,42" cada: a ultima termina em 3,83" e a frase de baixo
    // comeca em 3,95". Com 0,48" elas se encostavam.
    faixas.forEach(function (x, i) {
      var y = 1.75 + i * 0.42;
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
      var razoes = [];
      if (z.semPrazoComb) razoes.push(z.semPrazoComb + ' saíram sem prazo combinado, e não há com o que comparar');
      if (z.lancadaDepois) razoes.push(z.lancadaDepois + ' tiveram a conclusão lançada depois, quando "no prazo" seria verdade por construção');
      if (z.herdadas) razoes.push(z.herdadas + ' já chegaram atrasadas de ' +
        (z.mesAnterior || 'meses anteriores') + ', e o atraso é de lá');
      s.addText((z.naoMedidas + (z.herdadas || 0)) + ' conclusões ficam fora da conta: ' +
                razoes.join('; ') + '.', {
        x: 0.7, y: 4.4, w: 8.6, h: 0.6, fontSize: 12, color: C.fraco, lineSpacingMultiple: 1.3 });
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

    // 1b. As frentes, logo depois do panorama: é o corte que a diretoria já lê no
    // painel aprovado, e ele responde "onde a capacidade foi parar" antes de o
    // deck entrar em prazo e em detalhe.
    if (d.secoes.pipelines && d.pipelines) slidePipelines(pptx, d.pipelines, ++p, d.periodo);

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
        rodape(s, d.periodo, p);
      }
    }

    // 2b. As entregas rápidas: o argumento de eficiência do time, logo depois da
    //     conversa de prazo, que é onde ele responde.
    if (d.secoes.rapidas && d.rapidas && (d.rapidas.itens || []).length) {
      slideRapidas(pptx, d.rapidas, ++p, d.periodo, d.anterior);
    }

    // 2c. A evolução: um mês sozinho não mostra tendência.
    if (d.secoes.evolucao && (d.evolucao || []).length) {
      slideEvolucao(pptx, d.evolucao, ++p, d.periodo);
    }

    // 3. Os projetos. Depois do mês porque o mês é o todo e o projeto é o recorte
    //    — e antes do time, porque projeto é o que a diretoria acompanha por nome.
    if (d.secoes.projetos && (d.projetos || []).length) {
      slideProjetos(pptx, d.projetos, ++p, d.periodo);
    }

    // 4. O time e as frentes: agregado, antes do detalhe.
    if (d.secoes.time && d.time) slideTime(pptx, d.time, ++p, d.periodo, d.ausencias, d.capacidade);
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
        itens: d.porDev, cor: C.verde, rotuloSobra: ' pessoas', rotuloExtra: 'pts',
      }, ++p, d.periodo);
    }

    // 5c. O mês de cada um dos três primeiros devs, em linha do tempo.
    if (d.secoes.ganttdev) {
      (d.ganttDev || []).forEach(function (dv) {
        if ((dv.barras || []).length) slideGanttDev(pptx, dv, ++p, d.periodo);
      });
    }

    // As imagens seguem suportadas para quem quiser mandar um grafico pronto,
    // mas nenhum slide do deck depende delas hoje.
    (d.imagens || []).forEach(function (img) {
      var si = slideTitulo(pptx, img.titulo, img.sub || '', ++p);
      si.addImage({ data: img.png, x: 0.7, y: 1.5, w: 8.6, h: 3.4 });
      rodape(si, d.periodo, p);
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
      rodape(sr, d.periodo, p);
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
      rodape(sp, d.periodo, p);
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
