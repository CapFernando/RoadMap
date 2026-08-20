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

  /* Paleta do slide — a MESMA do painel de sprints que a diretoria aprovou.
     Era um preto neutro; virou o azul-quase-preto daquele quadro, com os mesmos
     acentos. Quem leu o painel reconhece o deck sem reaprender a ler nada, e é
     essa continuidade que o deck estava perdendo.

     Trocar os VALORES e manter os nomes muda o deck inteiro de uma vez: nenhum
     slide fica com a paleta antiga por esquecimento, porque nenhum slide escreve
     cor na mão. */
  var C = {
    fundo:   '070B16',   // o azul-quase-preto do painel
    fundo2:  '0E1428',   // superfície dos cartões
    fundo3:  '141C36',   // trilho de barra / cartão inativo
    borda:   '223052',   // a borda fina que separa cartão de fundo
    texto:   'FFFFFF',
    fraco:   '8792AD',
    azul:    '60A5FA',
    verde:   '4ADE80',
    vermelho:'F87171',
    ambar:   'FBBF24',
    roxo:    'A78BFA',
    ouro:    'FCD34D',   // 1º lugar do ranking
    prata:   'CBD5E1',
    bronze:  'D8A07A',
  };

  /* ─── O QUE CADA COR QUER DIZER ────────────────────────────────────────

     A paleta acima diz de que TOM e cada cor. Esta tabela diz o que cada uma
     SIGNIFICA, e existe porque o deck nao tinha essa resposta: o mesmo ambar era
     o percentual do prazo num canto e "ainda em aberto" no outro, e quem lia o
     amarelo do grafico procurava o amarelo do texto e ligava duas coisas sem
     relacao. O relato foi literal — "o amarelo me leva a entender que esta no
     prazo, porem la no grafico mostra ainda em aberto".

     A REGRA E DO FERNANDO, e sao cinco cores:

       VERDE      o resultado desejado aconteceu — entregue, saiu da fila, no
                  prazo. NAO e "numero alto": um ranking de pessoas em verde diz
                  que todo mundo esta bom, o que nao informa nada
       VERMELHO   esta ruim — atraso, falha, prazo estourado
       AMBAR      ATENCAO — risco corrente: parada, fila crescendo, sem tarefa.
                  Algo que pode dar errado e ainda da tempo de agir
       AZUL       NEUTRO — categoria, contagem, previsto. Nao julga nada
       BRANCO     NEUTRO — numero de leitura, sem meta contra a qual comparar

     Prata entra como neutro SECUNDARIO: quando duas categorias precisam se
     distinguir na mesma barra e nenhuma das duas e melhor que a outra.

     A REGRA PRATICA QUE MAIS SE VIOLAVA: nenhuma cor com juizo pode aparecer num
     numero que nao tem meta. "62%" pintado de ambar vira nota baixa aos olhos de
     quem ve, e nao ha meta de prazo acordada nesta empresa — o numero informa, e
     nao reprova. O mesmo valia para a execucao (planejado x realizado): ela
     mudava de verde para ambar para vermelho conforme o valor, como se 100%
     fosse o alvo.

     O QUE SAIU: o roxo, que fazia papel de "outra categoria" em quatro slides
     diferentes sem significar a mesma coisa em nenhum deles. Ouro, prata e
     bronze ficam SO no podio do ranking — ali eles nao sao juizo, sao a
     convencao de primeiro, segundo e terceiro, que todo mundo le sem legenda. */
  var SIGNIFICADO = {
    cumprido:  C.verde,
    falhou:    C.vermelho,
    atencao:   C.ambar,
    neutro:    C.azul,
    previsto:  C.azul,
    categoria2: C.prata,
    sustenta:  C.prata,
    foraConta: C.prata,
    leitura:   C.texto,
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
      color: C.texto }, tipo));
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
  /* PRINCIPAIS PROJETOS — o ranking do painel aprovado.

     Cada linha traz o que a sala pergunta em seguida: quem conduz, quantas tarefas
     andaram, em que pe esta, e planejado x realizado x execucao. Sem os tres
     numeros a linha diz "o projeto andou" e nao diz se andou o que fora combinado.

     A MEDALHA E POSICAO, E NAO NOTA. Ouro no primeiro nao significa "melhor
     projeto" — significa o que consumiu mais capacidade, que e o que o painel
     ordena. O subtitulo diz isso com todas as letras, porque um podio sem criterio
     escrito e lido como julgamento.

     PROJETO SEM TAREFA NO MES APARECE, dito com todas as letras em vez de com um
     zero — omitir o parado esconderia justamente o que merece pergunta.        */
  function slideProjetos(pptx, lista, pagina, periodo) {
    var s = slideBase(pptx);
    s.addText('PRINCIPAIS PROJETOS', {
      x: 0.5, y: 0.28, w: 5.9, h: 0.42, fontSize: 21, bold: true, color: C.texto,
      charSpacing: 0.5 });
    s.addText('ranqueados por horas planejadas + executadas no período', {
      x: 0.5, y: 0.70, w: 5.9, h: 0.24, fontSize: 10, color: C.fraco });
    s.addText(periodo, {
      x: 6.6, y: 0.30, w: 2.9, h: 0.26, fontSize: 11, bold: true, color: C.texto,
      align: 'right' });
    s.addText(lista.length + (lista.length === 1 ? ' projeto em aberto' : ' projetos em aberto'), {
      x: 6.6, y: 0.56, w: 2.9, h: 0.22, fontSize: 8, color: C.fraco, align: 'right' });
    s.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.02, w: 9.0, h: 0.012, fill: { color: C.borda }, line: { type: 'none' } });

    if (!lista.length) {
      s.addText('Nenhum projeto em aberto no período.', {
        x: 0.5, y: 1.7, w: 9.0, h: 0.4, fontSize: 15, color: C.fraco });
      rodape(s, periodo, pagina);
      return s;
    }

    /* Cinco linhas de 0,70" a partir de 1,20" fecham em 4,70", e a linha do "e
       mais" cabe em 4,74" — antes do rodape em 5,05". Com seis linhas a ultima
       caia sobre ele. */
    var TOPO = 1.20, ALT = 0.70;
    var MEDALHA = [C.ouro, C.prata, C.bronze];
    var vis = lista.slice(0, 5);
    vis.forEach(function (p, i) {
      var y = TOPO + i * ALT;
      cartao(pptx, s, 0.5, y, 9.0, 0.62);

      // A posicao: circulo de medalha nos tres primeiros, quadrado nos demais.
      /* `rectRadius` SO VAI NO roundRect. Passado junto com `ellipse`, o
         PptxGenJS escrevia <a:gd name="adj"> dentro de um <a:prstGeom
         prst="ellipse">, que nao tem parametro de ajuste — XML invalido, e o
         PowerPoint descartava a forma E o resto do cartao junto: o slide saia
         com o cabecalho certo e os cartoes vazios. */
      var cor = MEDALHA[i] || C.fraco;
      var medalha = { x: 0.63, y: y + 0.17, w: 0.28, h: 0.28,
                      fill: { color: i < 3 ? cor : C.fundo3 },
                      line: { color: i < 3 ? cor : C.borda, width: 0.75 } };
      if (i >= 3) medalha.rectRadius = 0.04;
      s.addShape(i < 3 ? pptx.ShapeType.ellipse : pptx.ShapeType.roundRect, medalha);
      s.addText(String(i + 1), {
        x: 0.63, y: y + 0.19, w: 0.28, h: 0.24, fontSize: 9, bold: true,
        color: i < 3 ? C.fundo : C.fraco, align: 'center' });

      s.addText(corta(p.nome, 52), {
        x: 1.00, y: y + 0.08, w: 5.5, h: 0.24, fontSize: 11, bold: true, color: C.texto });

      // A linha de contexto: quem conduz, quantas tarefas, em que pe.
      var meta = [];
      if (p.resp) meta.push(corta(p.resp, 34));
      var tarefas = (p.feitas || 0) + (p.andando || 0);
      if (tarefas) meta.push(tarefas + (tarefas === 1 ? ' tarefa' : ' tarefas'));
      if (p.feitas) meta.push(p.feitas + ' concluída' + (p.feitas === 1 ? '' : 's'));
      if (p.andando) meta.push(p.andando + ' em andamento');
      s.addText(meta.join('   ·   '), {
        x: 1.00, y: y + 0.33, w: 5.5, h: 0.2, fontSize: 8, color: C.fraco });

      var parado = !p.feitas && !p.andando;
      if (parado) {
        // Dito com todas as letras, e nao com um zero que se le como "nao sei".
        s.addText('sem tarefa no mês', {
          x: 6.55, y: y + 0.19, w: 2.8, h: 0.24, fontSize: 10, bold: true,
          color: SIGNIFICADO.atencao, align: 'right' });
        return;
      }
      var cols = [
        { v: (p.plan || 0) + 'h', rot: 'PLAN', cor: C.azul,  x: 6.55 },
        { v: (p.real || 0) + 'h', rot: 'REAL', cor: C.verde, x: 7.50 },
        { v: p.pct == null ? '—' : p.pct + '%', rot: 'EXEC',
          cor: corPercentual(p.pct), x: 8.45 },
      ];
      cols.forEach(function (c) {
        s.addText(String(c.v), { x: c.x, y: y + 0.09, w: 0.9, h: 0.26,
                                 fontSize: 13, bold: true, color: c.cor, align: 'right' });
        s.addText(c.rot, { x: c.x, y: y + 0.36, w: 0.9, h: 0.18,
                           fontSize: 7, color: C.fraco, align: 'right', charSpacing: 0.8 });
      });
    });

    var sobra = lista.length - vis.length;
    var nota = [];
    if (sobra > 0) {
      nota.push('e mais ' + sobra + (sobra === 1 ? ' projeto em aberto' : ' projetos em aberto'));
    }
    nota.push('Planejado: cada dia útil vale 8h, divididas entre as demandas do dia');
    s.addText(nota.join('   ·   '), {
      x: 0.5, y: TOPO + vis.length * ALT + 0.04, w: 9.0, h: 0.2,
      fontSize: 7.5, color: C.fraco });
    rodape(s, periodo, pagina);
    return s;
  }

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

  /* TEXTO DE CARD PARA TEXTO DE SLIDE.

     O que o dev escreve na entrega e markdown: titulos com `#`, negrito com
     `**`, listas com `-`. Isso ia CRU para o slide do destaque, e a diretoria via
     "## Por que a mudanca" projetado na parede.

     Tira a marcacao e junta as linhas: o slide tem uma caixa, e nao um documento
     — paragrafo em branco no meio vira buraco que empurra o resto para fora. */
  function textoLimpo(t, max) {
    var s = String(t == null ? '' : t)
      .replace(/^#{1,6}\s*/gm, '')          // titulos de markdown
      .replace(/\*\*([^*]+)\*\*/g, '$1')     // negrito
      .replace(/[*_`>]/g, '')                // enfase, codigo, citacao
      .replace(/^\s*[-+]\s+/gm, '· ')       // marcadores de lista
      .replace(/\r/g, '')
      .split('\n').map(function (l) { return l.trim(); }).filter(Boolean)
      .join('  ');
    return corta(s, max || 520);
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
      // A borda vem da paleta, e nao escrita a mao: era um cinza-esverdeado da
      // paleta antiga e ficava fora de tom no fundo azul do painel.
      border: { type: 'solid', color: C.borda, pt: 1 },
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
  function slideTime(pptx, t, pagina, periodo, ausencias, cap, quebra) {
    /* Titulo proprio, e nao `slideTitulo`: a caixa dele tem 8,6" de largura e
       cobriria a quebra de sustentacao x evolucao, que vive no canto direito. */
    var s = slideBase(pptx);
    s.addText('O time', { x: 0.7, y: 0.55, w: 4.6, h: 0.5,
                          fontSize: 24, bold: true, color: C.texto });
    s.addText('no período', { x: 0.7, y: 1.05, w: 4.6, h: 0.35,
                              fontSize: 13, color: C.fraco });

    /* CONSTRUIR OU MANTER DE PE — a quebra do que o time entregou.

       Vinte entregas de evolucao e vinte de sustentacao sao o mesmo numero e
       dois meses completamente diferentes: um construiu, o outro segurou o que
       ja existia. O slide falava de gente e nao dizia em que o esforco foi.

       Fica no espaco vazio a direita do subtitulo, e nao numa faixa nova: as
       tres colunas abaixo ja ocupam a altura util, e empurra-las para baixo
       jogaria a ultima linha em cima da nota de capacidade. */
    if (quebra && (quebra.evolucao || quebra.sustentacao)) {
      var totQ = (quebra.evolucao || 0) + (quebra.sustentacao || 0) + (quebra.sem || 0);
      s.addText('O QUE FOI ENTREGUE', { x: 5.5, y: 0.62, w: 3.8, h: 0.2,
        fontSize: 8, bold: true, color: C.fraco, charSpacing: 1.2 });
      var xq = 5.5, LQ = 3.8;
      [{ v: quebra.evolucao || 0, cor: C.verde },
       { v: quebra.sustentacao || 0, cor: SIGNIFICADO.categoria2 },
       { v: quebra.sem || 0, cor: C.fundo3 }].forEach(function (q) {
        if (!q.v) return;
        var w = LQ * q.v / (totQ || 1);
        s.addShape(pptx.ShapeType.rect, { x: xq, y: 0.86, w: w, h: 0.16,
                                          fill: { color: q.cor }, line: { type: 'none' } });
        xq += w;
      });
      var legQ = [];
      if (quebra.evolucao) legQ.push(quebra.evolucao + ' evolução');
      if (quebra.sustentacao) legQ.push(quebra.sustentacao + ' sustentação');
      if (quebra.sem) legQ.push(quebra.sem + ' sem classificar');
      s.addText(legQ.join('   ·   '), { x: 5.5, y: 1.06, w: 3.8, h: 0.22,
                                        fontSize: 9, color: C.fraco });
    }
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
        // A caixa do numero termina em +0,88" e o nome abre em +0,95": com o nome
        // em +0,85" os dois se encostavam, e "210" em corpo 22 tocava a inicial.
        s.addText(String(it.valor), {
          x: c.x, y: y, w: 0.88, h: 0.45, fontSize: 22, bold: true, color: c.cor });
        s.addText(corta(it.nome, 17), {
          x: c.x + 0.95, y: y + 0.08, w: 1.8, h: 0.35, fontSize: 12, color: C.texto });
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
      /* NAO EM AMBAR. O ambar e a cor de SUSTENTACAO na barra logo acima, no
         mesmo slide: o olho encontra o amarelo do grafico, procura o amarelo do
         texto e liga "sustentacao" a "Gabriel Fernandes, ferias" — duas coisas
         sem relacao nenhuma. Cor repetida no mesmo slide e leitura errada, e nao
         economia de paleta. */
      /* AMBAR: ausencia e atencao de verdade — e capacidade que o mes nao teve, e
         a pergunta "por que entregou menos" tem resposta aqui. */
      }).join('   ·   '), { x: 0.7, y: 4.78, w: 8.6, h: 0.32, fontSize: 13,
                            color: SIGNIFICADO.atencao });
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
        /* UMA COR SO. Azul, verde e roxo por POSICAO na lista nao significavam
           nada: a segunda area nao e "boa" nem a terceira "outra coisa" — a ordem
           ja diz quem e maior, e a cor ficava livre para inventar sentido. */
        fill: { color: SIGNIFICADO.neutro } });
      s.addText(String(a.entregas), {
        x: 7.4, y: y - 0.05, w: 1.9, h: 0.7, fontSize: 34, bold: true,
        color: SIGNIFICADO.neutro, align: 'right' });
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
  /* ─── OS CORTES DE PONTOS ────────────────────────────────────────────────
     Os mesmos quatro recortes do painel gerencial — por semana, por dev, por
     assunto e por sprint —, que o Fernando sentiu falta no deck.

     BARRA HORIZONTAL, E NAO A ROSCA DO PAINEL. Essa e a unica coisa que muda de
     forma, e o motivo e a distancia de leitura: na tela a rosca funciona porque a
     legenda esta ao lado e a pessoa esta a cinquenta centimetros. Projetada, uma
     rosca de seis fatias com rotulo "AXCred - Cadastro - Analise de Credito -
     Reanalise" nao se le do fundo da sala — o nome nao cabe na fatia, e comparar
     dois arcos parecidos e mais dificil que comparar dois comprimentos. A barra
     responde a MESMA pergunta ("qual a fatia de cada um") com o rotulo na
     horizontal e o percentual ao lado do valor.

     UMA COR SO, e nao seis. Numa barra a identidade vem do ROTULO, e nao da cor —
     cada barra tem o nome do lado. Pintar seis barras de seis cores inventa um
     significado que nao existe (por que Emilly e roxa?) e ainda quebra a leitura
     de quem nao distingue as duas mais parecidas. Azul, que e a cor neutra do
     padrao.

     O TOTAL VAI NO CABECALHO DE CADA PAINEL, porque o percentual sem o
     denominador convida a soma de cabeca no meio da apresentacao.               */
  function painelPontos(s, pptx, cfg) {
    var x0 = cfg.x, y0 = cfg.y, LARG = cfg.w;
    s.addText(cfg.titulo, { x: x0, y: y0, w: LARG, h: 0.24, fontSize: 12,
                            bold: true, color: C.texto, wrap: false });
    s.addText(cfg.total + ' pontos', {
      x: x0, y: y0 + 0.23, w: LARG, h: 0.2, fontSize: 9, color: C.fraco, wrap: false });

    var itens = cfg.itens || [];
    if (!itens.length) {
      s.addText('sem dados no mês', { x: x0, y: y0 + 0.6, w: LARG, h: 0.24,
                                      fontSize: 10, color: C.fraco });
      return;
    }
    var max = itens.reduce(function (m, i) { return Math.max(m, i.valor); }, 0) || 1;
    /* AS LARGURAS SOMAM A LARGURA DO PAINEL, e a conta e FEITA, nao estimada: o
       nome e o trilho dividem o que sobra depois do valor, do percentual e dos dois
       vaos. Assim o painel estreito (4,25") e o de largura inteira (8,76") usam a
       mesma funcao sem que nenhum transborde — e o teste soma isso e falha se a
       conta parar de fechar. */
    var W_VAL = 0.52, W_PCT = 0.45, VAO = 0.08 + 0.10;
    var W_NOME = cfg.larguraNome || 1.52;
    var W_TRILHO = LARG - W_NOME - W_VAL - W_PCT - VAO;
    var xTrilho = x0 + W_NOME + 0.08;
    var xVal = xTrilho + W_TRILHO + 0.10;
    var xPct = xVal + W_VAL;

    var TOPO = y0 + 0.52, ALT = 0.335;
    itens.forEach(function (it, i) {
      var y = TOPO + i * ALT;
      var pct = Math.round(it.valor / cfg.total * 100);
      /* O CORTE ACOMPANHA A LARGURA: ~14,5 caracteres por polegada a 9,5pt. Fixar
         em 22 cortava "AXCred - Cadastro - Analise de Credito - Reanalise" ao meio
         mesmo num painel de 3,9", onde ele caberia quase inteiro. Cortar com
         reticencia continua sendo melhor que deixar o PowerPoint quebrar em duas
         linhas e empurrar a barra de baixo. */
      s.addText(corta(it.nome, Math.floor(W_NOME * 14.5)), {
        x: x0, y: y, w: W_NOME, h: ALT, fontSize: 9.5, color: C.texto,
        align: 'right', valign: 'middle', wrap: false });
      s.addShape(pptx.ShapeType.rect, {
        x: xTrilho, y: y + 0.115, w: W_TRILHO, h: 0.11, fill: { color: C.fundo3 } });
      s.addShape(pptx.ShapeType.rect, {
        x: xTrilho, y: y + 0.115, w: Math.max(0.04, W_TRILHO * (it.valor / max)),
        h: 0.11, fill: { color: SIGNIFICADO.neutro } });
      s.addText(String(Math.round(it.valor)), {
        x: xVal, y: y, w: W_VAL, h: ALT, fontSize: 10.5, bold: true,
        color: SIGNIFICADO.neutro, valign: 'middle', align: 'right', wrap: false });
      s.addText(pct + '%', {
        x: xPct, y: y, w: W_PCT, h: ALT, fontSize: 9, color: C.fraco,
        valign: 'middle', align: 'right', wrap: false });
    });
  }

  /** Um objeto {nome: valor} vira lista, com a cauda dobrada em "Outros".
   *  O teto e cinco mais a cauda: seis linhas cabem no painel, e a sexta linha
   *  chamada "Outros (8)" diz que ha mais — some com ela e a soma dos percentuais
   *  da 79% na frente da diretoria. */
  function topoComOutros(obj, teto) {
    var pares = Object.keys(obj || {}).map(function (k) { return { nome: k, valor: obj[k] }; })
      .filter(function (x) { return x.valor > 0; });
    if (pares.length <= teto) return pares;
    var topo = pares.slice(0, teto);
    var resto = pares.slice(teto);
    var soma = resto.reduce(function (t, x) { return t + x.valor; }, 0);
    topo.push({ nome: 'Outros (' + resto.length + ')', valor: soma });
    return topo;
  }

  function slidePontos(pptx, pt, pagina, periodo) {
    var s = slideTitulo(pptx, 'Pontos entregues',
                        'a mesma distribuição do painel gerencial', pagina);
    /* DOIS PAINEIS POR SLIDE, e nao quatro. Com quatro, cada um fica com 2,1" de
       altura para caber titulo, total e seis linhas — e o nome do assunto cai a
       cinco caracteres. Dois por slide dao 4,25" de largura cada, que e onde o
       nome do tema ainda se le. */
    painelPontos(s, pptx, { x: 0.62, y: 1.55, w: 4.25, titulo: 'Por semana',
                            total: pt.total, itens: topoComOutros(pt.porSemana, 5) });
    painelPontos(s, pptx, { x: 5.13, y: 1.55, w: 4.25, titulo: 'Por desenvolvedor',
                            total: pt.total, itens: topoComOutros(pt.porDev, 5) });
    rodape(s, periodo, pagina);
    return s;
  }

  /* POR ASSUNTO, NA LARGURA TODA — e sem o painel de sprint.

     O CORTE POR SPRINT SAIU, decisão do Fernando, e o motivo está no dado: 248 das
     278 demandas não têm sprint preenchida, então "Sem sprint" ocupava 78% do
     gráfico. Uma barra que diz "78% não classificado" é verdade e não informa
     nada — e num slide de diretoria ela puxa uma conversa sobre o processo de
     cadastro no meio da conversa sobre entrega.

     PARA TRAZER DE VOLTA quando o campo virar hábito: `pt.porSprint` continua
     chegando aqui pronto (a conta é a mesma de `gerCortesDePontos`), então basta
     voltar a este arquivo um painel em `x: 5.13` com `pt.porSprint` — e reduzir o
     teto do assunto de 8 para 5, que é o que caberia ao lado.

     A LARGURA INTEIRA NÃO É SOBRA APROVEITADA: é o corte que mais precisava dela.
     "AXCred - Cadastro - Análise de Crédito - Reanálise" tem 48 caracteres e vinha
     cortado em 22 no painel estreito — o nome do tema é o que diz PARA QUÊ o mês
     foi gasto, e cortado ao meio ele deixa de dizer. */
  function slidePontos2(pptx, pt, pagina, periodo) {
    var s = slideTitulo(pptx, 'Pontos entregues',
                        'por assunto — para que o mês foi gasto', pagina);
    painelPontos(s, pptx, {
      x: 0.62, y: 1.55, w: 8.76, larguraNome: 3.9, titulo: 'Por assunto',
      // Oito linhas em vez de cinco: com a largura toda cabem, e a cauda em
      // "Outros" some com nomes que a sala reconhece.
      total: pt.total, itens: topoComOutros(pt.porAssunto, 8) });
    rodape(s, periodo, pagina);
    return s;
  }

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
  /* BRANCO, SEMPRE. Ele mudava de verde para ambar para vermelho conforme o
     valor, e isso e a linguagem de uma META — mas 100% de execucao nao e alvo
     acordado de ninguem: uma frente que planejou 40h e realizou 60h nao "falhou",
     ela recebeu trabalho que nao estava no plano. Pintado de vermelho, o numero
     acusa o time de algo que nao aconteceu. */
  function corPercentual(pct) {
    return pct == null ? C.fraco : SIGNIFICADO.leitura;
  }

  /* -- Pecas do painel de sprints -------------------------------------------
     O painel aprovado tem uma gramatica propria, e ela se repete em toda secao:
     cartao com borda fina, rotulo miudo em maiusculas na cor do assunto, numero
     em corpo grande, e uma legenda pequena embaixo. Estas funcoes sao essa
     gramatica — sem elas, cada slide reinventava o cartao e o deck saia
     desalinhado de um slide para o outro.                                     */
  function cartao(pptx, s, x, y, w, h, opts) {
    opts = opts || {};
    s.addShape(pptx.ShapeType.roundRect, {
      x: x, y: y, w: w, h: h, rectRadius: 0.05,
      fill: { color: opts.fundo || C.fundo2 },
      line: { color: opts.borda || C.borda, width: 0.75 },
    });
    // A faixa de cor no topo — e ela que liga o cartao a frente que ele mostra.
    if (opts.faixa) {
      s.addShape(pptx.ShapeType.rect, {
        x: x, y: y, w: w, h: 0.045, fill: { color: opts.faixa }, line: { type: 'none' } });
    }
  }

  /* O CARTAO DE NUMERO do painel: rotulo miudo colorido, numero grande, nota.
     O numero e o que a sala le de longe; o rotulo diz do que ele e; a nota
     responde a pergunta seguinte antes de ela ser feita ("2286h — 96% do
     planejado"). */
  function cartaoKpi(pptx, s, cfg) {
    cartao(pptx, s, cfg.x, cfg.y, cfg.w, cfg.h);
    s.addText(cfg.rot, { x: cfg.x + 0.14, y: cfg.y + 0.11, w: cfg.w - 0.28, h: 0.21,
                         fontSize: 9, bold: true, color: cfg.cor || C.azul, charSpacing: 1.2 });
    s.addText(String(cfg.val), { x: cfg.x + 0.13, y: cfg.y + 0.31, w: cfg.w - 0.26, h: 0.52,
                                 fontSize: cfg.corpo || 30, bold: true, color: C.texto,
                                 wrap: false });
    if (cfg.nota) {
      s.addText(cfg.nota, { x: cfg.x + 0.14, y: cfg.y + 0.83, w: cfg.w - 0.28, h: 0.19,
                            fontSize: 8, color: C.fraco });
    }
  }

  /* O ANEL DE EXECUCAO — o "96%" que o painel poe no canto.
     Grafico de rosca de verdade (nao desenho): fica nitido em qualquer projetor e
     continua editavel no PowerPoint. Acima de 100% o anel fecha inteiro em vez de
     virar fatia negativa, que e o que uma rosca faria com o resto abaixo de zero. */
  function anelExecucao(pptx, s, x, y, lado, pct) {
    var cor = corPercentual(pct);
    var feito = pct == null ? 0 : Math.max(0, Math.min(100, pct));
    s.addChart(pptx.ChartType.doughnut,
      [{ name: 'exec', labels: ['feito', 'resto'], values: [feito, 100 - feito] }], {
        x: x, y: y, w: lado, h: lado,
        holeSize: 62, showLegend: false, showValue: false, showTitle: false,
        chartColors: [cor, C.fundo3],
        dataBorder: { pt: 0, color: C.fundo2 },
        plotArea: { fill: { color: C.fundo2 } },
      });
  }

  /* A BARRA PAREADA de planejado x realizado.

     O painel usa uma rosca para "horas por pipeline", e a rosca responde outra
     pergunta: que fatia cada frente representa. A pergunta DESTE slide e planejado
     contra realizado por frente — comparacao pareada, que em rosca nao se le. Duas
     barras finas na mesma escala mostram as duas de uma vez, e o transbordo de
     quem passou do planejado aparece como barra mais longa em vez de estourar o
     desenho.

     A cor da frente fica na barra do realizado e o planejado vai em cinza-azulado:
     com as duas coloridas, a comparacao virava adivinhacao de tom. */
  function barrasFrente(pptx, s, cfg) {
    var itens = cfg.itens, x = cfg.x, w = cfg.w;
    var max = itens.reduce(function (mx, i) { return Math.max(mx, i.plan, i.real); }, 1);
    // 1,55" comporta "Dados & Inteligência" (o maior nome) em corpo 9 sem corte;
    // com 1,32" ele saia como "Dados & Inteligên…" e a barra ficava sem dono.
    var LARG_NOME = 1.55, VAO = 0.1;
    var xBarra = x + LARG_NOME + VAO;
    var wBarra = w - LARG_NOME - VAO - 0.62;
    itens.forEach(function (it, i) {
      var y = cfg.y + i * cfg.alt;
      s.addText(it.nome, {
        x: x, y: y, w: LARG_NOME, h: 0.32, fontSize: 9, color: C.texto,
        align: 'right', valign: 'middle', wrap: false });
      [{ v: it.plan, cor: C.fundo3, dy: 0.045 },
       { v: it.real, cor: it.cor, dy: 0.155 }].forEach(function (b) {
        s.addShape(pptx.ShapeType.rect, {
          x: xBarra, y: y + b.dy, w: Math.max(0.02, wBarra * (b.v / max)), h: 0.09,
          fill: { color: b.cor }, line: { type: 'none' } });
      });
      s.addText(it.plan + 'h / ' + it.real + 'h', {
        x: xBarra + wBarra + 0.06, y: y, w: 0.62, h: 0.32,
        fontSize: 8, color: C.fraco, valign: 'middle', wrap: false });
    });
    // A legenda explica as duas barras UMA vez, e nao em cada linha.
    s.addText('planejado (claro)   ·   realizado (na cor da frente)', {
      x: xBarra, y: cfg.y + itens.length * cfg.alt + 0.02, w: wBarra + 0.6, h: 0.2,
      fontSize: 7.5, color: C.fraco });
  }

  /* AS FRENTES DE TRABALHO — o slide no formato do painel aprovado.

     A COR DO PERCENTUAL SEGUE A DISTANCIA DO PLANEJADO, para os dois lados. 160%
     nao e "melhor" que 100%: significa que a estimativa nao valeu, e pintar isso
     de verde esconderia exatamente o que a sala precisa discutir.

     A COBERTURA DE HORAS VAI NO RODAPE, sempre. Um mes com 39% das entregas sem
     hora lancada mostra execucao baixa por falta de lancamento, e nao por falta
     de trabalho — sem a nota, o slide acusa o time de algo que nao aconteceu.  */
  function slidePipelines(pptx, pl, pagina, periodo) {
    var s = slideBase(pptx);
    var itens = (pl.itens || []).filter(function (i) {
      // Frente sem nada no mes nao vira cartao zerado: "0h / 0h / 0%" num slide
      // executivo so gera a pergunta "e por que isso esta zerado?" no meio da
      // apresentacao.
      return i.entregas > 0 || i.plan > 0 || i.real > 0;
    });

    // -- Cabecalho, como o do painel: titulo, subtitulo e o periodo a direita --
    s.addText('FRENTES DE TRABALHO', {
      x: 0.5, y: 0.28, w: 5.9, h: 0.42, fontSize: 21, bold: true, color: C.texto,
      charSpacing: 0.5 });
    s.addText('visão geral da execução', {
      x: 0.5, y: 0.70, w: 5.9, h: 0.24, fontSize: 10, color: C.fraco });
    s.addText(periodo, {
      x: 6.6, y: 0.30, w: 2.9, h: 0.26, fontSize: 11, bold: true, color: C.texto,
      align: 'right' });
    if (pl.recorte) {
      s.addText(pl.recorte, {
        x: 6.6, y: 0.56, w: 2.9, h: 0.22, fontSize: 8, color: C.fraco, align: 'right' });
    }
    s.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.02, w: 9.0, h: 0.012, fill: { color: C.borda }, line: { type: 'none' } });

    if (!itens.length) {
      s.addText('Sem entregas com frente definida no período.',
        { x: 0.5, y: 1.7, w: 9.0, h: 0.4, fontSize: 15, color: C.fraco });
      rodape(s, periodo, pagina);
      return s;
    }

    // -- A faixa de numeros do mes, com o anel de execucao no canto ------------
    var t = pl.total || {};
    var kpis = [
      { rot: 'FRENTES',   val: itens.length, cor: SIGNIFICADO.neutro,
        nota: (pl.devs || 0) + (pl.devs === 1 ? ' pessoa' : ' pessoas') },
      { rot: 'ENTREGAS',  val: t.entregas, cor: C.azul,
        nota: t.pontos ? t.pontos + ' pontos' : '' },
      { rot: 'PLANEJADO', val: t.plan + 'h', cor: C.azul, nota: 'no período' },
      { rot: 'REALIZADO', val: t.real + 'h', cor: C.verde,
        nota: t.pct == null ? '' : t.pct + '% do planejado' },
    ];
    /* Quatro cartoes de 1,72" + o de execucao de 1,60", com vao de 0,12":
       4 x 1,72 + 1,60 + 4 x 0,12 = 8,96", de 0,5" a 9,46" — dentro da margem.
       Com 1,80/1,66/0,14 a conta dava 9,92" e o cartao de execucao saia do slide. */
    var LK = 1.72, VK = 0.12;
    kpis.forEach(function (k, i) {
      cartaoKpi(pptx, s, { x: 0.5 + i * (LK + VK), y: 1.14, w: LK, h: 1.06,
                           rot: k.rot, val: k.val, cor: k.cor, nota: k.nota });
    });

    /* O CARTAO DE EXECUCAO: anel a esquerda, numero e legenda a direita.
       O anel era desenhado sozinho num cartao estreito e o percentual saia POR
       CIMA do proprio circulo — ilegivel, e sem dizer o que media. Agora o numero
       tem lugar proprio, e embaixo dele a frase que responde "percentual de que?". */
    var XE = 0.5 + 4 * (LK + VK);
    cartao(pptx, s, XE, 1.14, 1.60, 1.06);
    anelExecucao(pptx, s, XE + 0.06, 1.26, 0.82, t.pct);
    s.addText(t.pct == null ? '—' : t.pct + '%', {
      x: XE + 0.86, y: 1.32, w: 0.68, h: 0.36,
      fontSize: 18, bold: true, color: corPercentual(t.pct), wrap: false });
    s.addText('EXECUÇÃO', { x: XE + 0.86, y: 1.68, w: 0.68, h: 0.17,
                            fontSize: 6.5, bold: true, color: C.fraco, charSpacing: 0.6 });
    s.addText('realizado ÷ planejado', { x: XE + 0.05, y: 1.93, w: 1.50, h: 0.17,
                                         fontSize: 6.5, color: C.fraco, align: 'center' });

    // -- Esquerda: planejado x realizado por frente ----------------------------
    s.addText('HORAS POR FRENTE', {
      x: 0.5, y: 2.22, w: 4.3, h: 0.2, fontSize: 8.5, bold: true,
      color: C.fraco, charSpacing: 1.2 });
    barrasFrente(pptx, s, { itens: itens, x: 0.5, y: 2.48, w: 4.35, alt: 0.34 });

    // -- Direita: um cartao por frente, como o "pipelines detalhados" ----------
    s.addText('FRENTES DETALHADAS', {
      x: 5.05, y: 2.22, w: 2.45, h: 0.2, fontSize: 8.5, bold: true,
      color: C.fraco, charSpacing: 1.2 });
    s.addText(itens.length + (itens.length === 1 ? ' frente' : ' frentes'), {
      x: 7.6, y: 2.22, w: 1.9, h: 0.2, fontSize: 8.5, color: C.fraco, align: 'right' });

    /* Duas colunas de cartoes, com as medidas CONTADAS e nao escolhidas.

       O slide tem 5,63", o rodape mora em 5,05" e as notas em 4,62". Com 6 frentes
       sao TRES linhas: 3 x CH + 2 x CVY a partir de 2,56". Com CH 0,66 e CVY 0,09
       isso fechava em 4,72" e a ultima linha passava POR CIMA da nota de cobertura
       — errei a conta na primeira versao, e foi a prova do PPTX que mostrou.
       Com 0,62 e 0,08 fecha em 4,58", antes das notas. */
    var CW = 2.16, CH = 0.66, CVX = 0.13, CVY = 0.07;
    itens.slice(0, 6).forEach(function (it, i) {
      var col = i % 2, lin = Math.floor(i / 2);
      var x = 5.05 + col * (CW + CVX);
      var y = 2.48 + lin * (CH + CVY);
      cartao(pptx, s, x, y, CW, CH, { faixa: it.cor });
      /* O PERCENTUAL EM UMA LINHA. A caixa tinha 0,47" e "154%" em corpo 9 nao
         cabia: o PowerPoint quebrava em "154" e "%" em linhas separadas. Com 0,72"
         e `wrap:false` ele nao quebra mais, e o nome encolhe na mesma medida. */
      /* O NOME INTEIRO, e nao "IA & Vibe co…". O maior deles tem 20 caracteres
         ("Dados & Inteligência") e cabe na largura toda do cartao — o que nao
         cabia era nome E percentual na mesma linha. O percentual desceu para a
         linha dos numeros, onde sobrava espaco. */
      s.addText(it.nome, {
        x: x + 0.11, y: y + 0.07, w: CW - 0.22, h: 0.2, fontSize: 9, bold: true,
        color: C.texto, wrap: false });
      s.addText(it.plan + 'h', { x: x + 0.11, y: y + 0.27, w: 0.62, h: 0.23,
                                 fontSize: 12, bold: true, color: C.azul, wrap: false });
      s.addText(it.real + 'h', { x: x + 0.76, y: y + 0.27, w: 0.62, h: 0.23,
                                 fontSize: 12, bold: true, color: C.verde, wrap: false });
      s.addText(it.pct == null ? '—' : it.pct + '%', {
        x: x + CW - 0.72, y: y + 0.27, w: 0.61, h: 0.23, fontSize: 11.5, bold: true,
        color: corPercentual(it.pct), align: 'right', wrap: false });
      s.addText(it.entregas + (it.entregas === 1 ? ' entrega' : ' entregas'), {
        x: x + 0.11, y: y + 0.49, w: CW - 0.22, h: 0.16, fontSize: 7.5, color: C.fraco });
    });

    // -- O rodape que impede a leitura errada ----------------------------------
    var cob = pl.cobertura || {};
    var notas = [];
    if (cob.total) {
      notas.push('Horas lançadas em ' + cob.comHoras + ' de ' + cob.total +
                 ' entregas (' + cob.pct + '%)' +
                 (cob.pct < 90 ? ' — o restante entra por aproximação' : ''));
    }
    // Planejado = dia util da pessoa dividido entre o que ela tinha em maos. A
    // frase existe porque a primeira pergunta da sala sobre este slide e sempre
    // "de onde saiu o planejado?".
    notas.push('Planejado: cada dia útil vale 8h, divididas entre as demandas do dia');
    s.addText(notas.join('   ·   '), {
      x: 0.5, y: 4.62, w: 9.0, h: 0.2, fontSize: 8, color: C.fraco });
    if ((pl.foraDoDeck || []).length) {
      s.addText('Fora do recorte: ' + pl.foraDoDeck.join(', '), {
        x: 0.5, y: 4.80, w: 9.0, h: 0.2, fontSize: 8, color: C.fraco });
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
    var s = slideBase(pptx);
    var f = d.fluxo || {};
    var k = d.kpi || {};
    var a = d.anterior;
    var q = d.quebra || {};

    // -- Cabecalho, no mesmo padrao das outras secoes do painel --------------
    s.addText('O MÊS', {
      x: 0.5, y: 0.28, w: 5.9, h: 0.42, fontSize: 21, bold: true, color: C.texto,
      charSpacing: 0.5 });
    s.addText('backlog, o que entrou e o que saiu', {
      x: 0.5, y: 0.70, w: 5.9, h: 0.24, fontSize: 10, color: C.fraco });
    s.addText(d.periodo, {
      x: 6.6, y: 0.30, w: 2.9, h: 0.26, fontSize: 11, bold: true, color: C.texto,
      align: 'right' });
    if (f.corte) {
      s.addText((f.emCurso ? 'posição de ' : 'fechamento em ') + f.corte, {
        x: 6.6, y: 0.56, w: 2.9, h: 0.22, fontSize: 8, color: C.fraco, align: 'right' });
    }
    s.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.02, w: 9.0, h: 0.012, fill: { color: C.borda }, line: { type: 'none' } });

    /* A CONTA DO MES, em quatro cartoes com os sinais entre eles.

       `bomSubir`: sair mais e bom, sobrar mais nao e. Backlog e estoque, e estoque
       que cresce nao e ganho — por isso a cor segue a MELHORA, e nao o sinal.  */
    var passos = [
      { rot: 'BACKLOG NO DIA 1', val: f.backlogInicio, cor: C.fraco, sinal: '',
        chave: 'backlogInicio', bomSubir: false },
      { rot: 'ENTRARAM', val: f.recebidas, cor: C.azul, sinal: '+',
        chave: 'recebidas', bomSubir: true },
      { rot: 'SAÍRAM DA FILA', val: f.saidas, cor: C.verde, sinal: '−',
        chave: 'saidas', bomSubir: true },
      /* AZUL, E NAO AMBAR. Este numero e um SALDO — quantas demandas ficaram na
         fila —, e saldo e fato, nao alerta. Em ambar ele chegava a sala como
         problema antes de alguem ler se cresceu ou diminuiu. Quem julga isso e a
         frase abaixo do grafico, que fica em ambar quando a fila cresceu. */
      { rot: f.emCurso ? 'EM ABERTO HOJE' : 'EM ABERTO NO FIM',
        val: f.backlogFim, cor: SIGNIFICADO.neutro, sinal: '=',
        chave: 'backlogFim', bomSubir: false },
    ].filter(function (x) { return x.val != null; });

    /* Quatro cartoes de 2,04" com 0,32" de vao: 4 x 2,04 + 3 x 0,32 = 9,12",
       de 0,5" a 9,62"... nao cabe. Com 1,98" e 0,3": 7,92 + 0,9 = 8,82", de 0,5"
       a 9,32". O vao maior existe para o sinal (+, −, =) morar nele. */
    var LC = 1.98, VC = 0.30;
    passos.forEach(function (e, i) {
      var x = 0.5 + i * (LC + VC);
      if (e.sinal) {
        s.addText(e.sinal, { x: x - VC - 0.02, y: 1.58, w: VC + 0.04, h: 0.4,
                             fontSize: 22, color: C.fraco, align: 'center' });
      }
      cartao(pptx, s, x, 1.16, LC, 2.30);
      s.addText(e.rot, { x: x + 0.13, y: 1.26, w: LC - 0.26, h: 0.2,
                         fontSize: 8, bold: true, color: e.cor, charSpacing: 1 });
      s.addText(String(e.val), { x: x + 0.12, y: 1.46, w: LC - 0.24, h: 0.62,
                                 fontSize: 36, bold: true, color: e.cor, wrap: false });
      // A variacao contra o mes anterior: 114 sozinho nao diz se cresceu.
      if (a) {
        var v = variacao(e.val, a[e.chave], e.bomSubir);
        if (v) {
          s.addText((v.dif === 0 ? '= igual a ' : (v.dif > 0 ? '▲ +' : '▼ ') +
                     (v.dif === 0 ? '' : Math.abs(v.dif) + ' vs ')) + a.nome, {
            x: x + 0.13, y: 2.10, w: LC - 0.26, h: 0.2, fontSize: 8, color: v.cor });
        }
      }
      /* A QUEBRA POR TIPO, dentro do cartao. Quantidade sem ela nao distingue um
         mes de construir de um mes de manter de pe o que ja existe. */
      var qq = q[e.chave];
      if (qq) {
        var partes = [];
        if (qq.evolucao) partes.push({ t: qq.evolucao + ' evolução', c: C.verde });
        if (qq.sustentacao) partes.push({ t: qq.sustentacao + ' sustentação', c: SIGNIFICADO.categoria2 });
        if (qq.sem) partes.push({ t: qq.sem + ' sem classificar', c: C.fraco });
        partes.slice(0, 3).forEach(function (p, j) {
          s.addShape(pptx.ShapeType.rect, { x: x + 0.13, y: 2.42 + j * 0.24, w: 0.1, h: 0.1,
                                            fill: { color: p.c }, line: { type: 'none' } });
          s.addText(p.t, { x: x + 0.28, y: 2.36 + j * 0.24, w: LC - 0.4, h: 0.22,
                           fontSize: 8.5, color: C.fraco });
        });
      }
    });

    // -- A frase que a sala leva ---------------------------------------------
    // Sem ela, os quatro numeros ficam por conta de quem estiver somando de cabeca.
    if (f.recebidas != null && f.saidas != null) {
      var saldo = f.recebidas - f.saidas;
      s.addText(saldo > 0
        ? 'Entrou mais do que saiu: a fila cresceu ' + saldo + (saldo === 1 ? ' demanda' : ' demandas') + '.'
        : (saldo < 0
            ? 'Saiu mais do que entrou: a fila diminuiu ' + Math.abs(saldo) +
              (saldo === -1 ? ' demanda' : ' demandas') + '.'
            : 'Entrou e saiu o mesmo tanto: a fila ficou do mesmo tamanho.'),
        { x: 0.5, y: 3.66, w: 9.0, h: 0.4, fontSize: 17, bold: true,
          color: saldo > 0 ? SIGNIFICADO.atencao : SIGNIFICADO.cumprido });
    }
    var saiu = [];
    if (f.saiuEntregue) saiu.push(f.saiuEntregue + ' entregues');
    if (f.saiuNegada) saiu.push(f.saiuNegada + (f.saiuNegada === 1 ? ' recusada' : ' recusadas'));
    if (k.pontos) saiu.push(k.pontos + ' pontos');
    if (saiu.length) {
      s.addText('Das saídas: ' + saiu.join('   ·   '), {
        x: 0.5, y: 4.12, w: 9.0, h: 0.28, fontSize: 11.5, color: C.fraco });
    }
    var rodapeNotas = [];
    if (f.tocadas) rodapeNotas.push(f.tocadas + ' demandas trabalhadas no período');
    if (a && a.parcial) rodapeNotas.push('comparação parcial: ' + a.nome + ' está completo');
    if (rodapeNotas.length) {
      s.addText(rodapeNotas.join('   ·   '), {
        x: 0.5, y: 4.42, w: 9.0, h: 0.24, fontSize: 9.5, color: C.fraco });
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

    /* Seis linhas de 0,38" a partir de 2,42" terminam em 4,62", e a linha do
       "e mais" ocupa 4,66"-4,94" — antes do rodape em 5,05". Com 0,40" a partir
       de 2,45" ela ia a 5,19" e escrevia por cima dele. */
    var TOPO = 2.42, ALT = 0.38;
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

    /* ALTO 1,55 e nao 1,85: o valor impresso no topo da barra fica em
       BASE - ALTO - 0,28, e com 1,85 isso dava 1,49" — dentro da legenda do
       cabecalho, que ocupa de 1,42" a 1,70". A barra mais alta do mes escrevia
       o proprio numero por cima de "entraram / sairam". */
    var X0 = 0.9, LARG = 8.4, BASE = 3.62, ALTO = 1.55;
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
      /* "ago…" LIA-SE COMO TEXTO CORTADO. As reticencias marcavam mes em curso,
         mas ninguem ve isso — ve um rotulo que nao coube e desconfia do slide
         inteiro. A palavra resolve, e ainda diz o que a reticencia nunca disse:
         que aquele mes ainda nao acabou e por isso e menor que os outros. */
      s.addText(x.rot, {
        x: X0 + i * col, y: BASE + 0.06, w: col, h: 0.26,
        fontSize: 12, color: x.parcial ? C.texto : C.fraco, align: 'center', wrap: false });
      if (x.parcial) {
        s.addText('mês em curso', {
          x: X0 + i * col, y: BASE + 0.30, w: col, h: 0.2,
          fontSize: 8, color: C.fraco, align: 'center', wrap: false });
      }
      // O percentual em BRANCO, pela mesma razao do slide do prazo: nao ha meta
      // de prazo acordada, e a faixa de cor faz o numero chegar ja julgado.
      s.addText(x.pct == null ? '—' : x.pct + '%', {
        x: X0 + i * col, y: BASE + (x.parcial ? 0.50 : 0.36), w: col, h: 0.26,
        fontSize: 11, color: x.pct == null ? C.fraco : SIGNIFICADO.leitura,
        align: 'center', wrap: false });
      s.addText(String(x.backlog), {
        x: X0 + i * col, y: BASE + (x.parcial ? 0.78 : 0.64), w: col, h: 0.26,
        fontSize: 11, color: C.fraco, align: 'center', wrap: false });
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

    /* A REGUA DE DIAS: sem ela a barra nao diz quando, so quanto.

       `wrap:false` e caixa de 0,4": com 0,3" o "10" nao cabia e o PowerPoint
       quebrava em "1" e "0" em duas linhas — a regua inteira saia ilegivel a
       partir do dia 10. E o rotulo diz o que os numeros sao: sem ele, sete
       numeros soltos no topo do slide pedem explicacao no meio da reuniao. */
    // Termina em X0-0,30" e o primeiro dia abre em X0-0,20": com 0,9" a partir de
    // X0-0,95" o rotulo encostava no "1".
    s.addText('dia do mês', { x: X0 - 1.10, y: 1.44, w: 0.80, h: 0.24,
                              fontSize: 8, color: C.fraco, align: 'right' });
    [1, 5, 10, 15, 20, 25, dias].forEach(function (d) {
      var x = X0 + LARG * (d - 1) / Math.max(1, dias - 1);
      s.addText(String(d), { x: x - 0.2, y: 1.44, w: 0.4, h: 0.24,
                             fontSize: 9, color: C.fraco, align: 'center', wrap: false });
    });

    /* SEIS barras, e nao sete: a linha do "e mais" fica em TOPO + n x ALT, e com
       sete ela caia em 4,73"-5,01" — por cima da legenda de evolucao/sustentacao,
       que mora em 4,85". Com seis ela fecha em 4,59". */
    var vis = (dv.barras || []).slice(0, 6);
    vis.forEach(function (b, i) {
      var y = TOPO + i * ALT;
      // h 0,19 e nao 0,30: a linha de tema/pontos abre em y+0,19, e com 0,30 o
      // titulo escrevia por cima dela em todas as barras.
      s.addText(corta(b.titulo, 34), { x: 0.7, y: y, w: 2.7, h: 0.19,
                                       fontSize: 10.5, color: C.texto });
      s.addShape(pptx.ShapeType.rect, { x: X0, y: y + 0.1, w: LARG, h: 0.14,
                                        fill: { color: C.fundo2 } });
      var x1 = X0 + LARG * (b.de - 1) / Math.max(1, dias - 1);
      var x2 = X0 + LARG * (b.ate - 1) / Math.max(1, dias - 1);
      s.addShape(pptx.ShapeType.rect, {
        x: x1, y: y + 0.06, w: Math.max(0.09, x2 - x1), h: 0.22,
        /* DUAS CATEGORIAS NEUTRAS. Evolucao nao e "bom" e sustentacao nao e
           "atencao": manter de pe o que existe e trabalho normal. Azul e prata
           distinguem sem julgar — em verde e ambar, o slide dizia que metade do
           mes foi problema. */
        fill: { color: b.tipo === 'Sustentação' ? SIGNIFICADO.categoria2 : SIGNIFICADO.neutro } });
      var meta = [b.tema, b.pontos ? b.pontos + ' pt' : ''].filter(Boolean).join(' · ');
      if (meta) s.addText(corta(meta, 30), { x: 0.7, y: y + 0.19, w: 2.7, h: 0.19,
                                             fontSize: 8.5, color: C.fraco });
    });
    var sobra = (dv.barras || []).length - vis.length;
    if (sobra > 0) {
      s.addText('… e mais ' + sobra + (sobra === 1 ? ' entrega' : ' entregas') + ' no mês', {
        x: 0.7, y: TOPO + vis.length * ALT + 0.04, w: 8.6, h: 0.28,
        fontSize: 11, color: C.fraco });
    }
    [{ t: 'evolução', cor: SIGNIFICADO.neutro },
     { t: 'sustentação', cor: SIGNIFICADO.categoria2 }].forEach(function (l, i) {
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
    /* BRANCO, E NAO A FAIXA DE COR. O percentual mudava de verde para ambar para
       vermelho conforme o valor, e isso e a linguagem de uma META — mas nao ha
       meta de prazo acordada aqui. Pintado de ambar, "62%" ja chega a sala como
       nota baixa, e a discussao comeca na defesa em vez de comecar no numero. A
       barra ao lado continua colorida: la a cor separa no prazo de atraso, que e
       um fato, e nao um julgamento do total. */
    s.addText('Entregues no prazo', { x: 0.7, y: 0.62, w: 8.6, h: 0.4, fontSize: 16, color: C.fraco });
    s.addText(z.pct + '%', { x: 0.7, y: 1.0, w: 4.2, h: 1.5, fontSize: 92, bold: true,
                             color: SIGNIFICADO.leitura });
    /* A frase diz DE QUE e o percentual: sao as demandas prometidas PARA o mes,
       e nao as que sairam nele. Sem isso, "63%" convida a leitura errada — a de
       que o time entregou 63% do que fez, quando o numero fala do combinado. */
    s.addText(z.noPrazo + ' de ' + z.medidas + ' entregas prometidas para o mês', {
      x: 0.72, y: 2.45, w: 4.4, h: 0.35, fontSize: 14, color: C.texto });
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
      { rot: 'No prazo', val: z.noPrazo, cor: SIGNIFICADO.cumprido },
      { rot: 'Com atraso', val: z.atrasadas ? z.atrasadas.length : 0, cor: SIGNIFICADO.falhou },
      /* PROMETIDA E AINDA NAO ENTREGUE. Nao entra no percentual (nao ha entrega
         para medir), mas e parte do compromisso do mes: some daqui e o slide
         mostraria so o que saiu, como se o resto nao tivesse sido prometido.

         AZUL, E NAO AMBAR. Em ambar ela dividia a cor com o percentual do lado, e
         a leitura saia trocada: o amarelo do grafico levava a "no prazo", e o
         amarelo do texto dizia "ainda em aberto". Azul e a cor do previsto no
         resto do deck, e "em aberto" e exatamente isso — ainda nao ha veredito. */
      { rot: 'Ainda em aberto', val: z.emAberto || 0, cor: SIGNIFICADO.previsto },
      { rot: 'Sem prazo combinado', val: z.semPrazoComb || 0, cor: SIGNIFICADO.foraConta },
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
    /* O RECORTE, dito no slide. A demanda conta no mes do PRAZO dela, e nao no da
       entrega: prometida para julho e entregue em agosto e atraso DE JULHO. Sem
       esta linha, quem soma as entregas do mes nao fecha com este slide e conclui
       que um dos dois esta errado. */
    s.addText('Conta o que foi prometido para o mês — quem tinha prazo em outro mês ' +
              'aparece no relatório daquele mês.', {
      x: 0.7, y: 4.36, w: 8.6, h: 0.22, fontSize: 10, color: C.fraco });
    // A ressalva fica: sem ela, "78% no prazo" parece valer para tudo que saiu.
    /* SO UMA RAZAO SOBRA PARA FICAR DE FORA: nao havia prazo combinado, entao nao
       ha com o que comparar. A conclusao lancada depois deixou de ser um balde
       proprio — ela tem prazo e tem entrega, e a pergunta que se faz dela e a
       mesma que se faz das outras: cumpriu ou nao cumpriu. Um balde chamado
       "Data lancada depois" no slide levantava uma questao de processo no meio
       de uma conversa de entrega. */
    if (z.semPrazoComb) {
      s.addText(z.semPrazoComb + (z.semPrazoComb === 1
                  ? ' conclusão fica fora da conta: saiu sem prazo combinado, e não há com o que comparar.'
                  : ' conclusões ficam fora da conta: saíram sem prazo combinado, e não há com o que comparar.'), {
        x: 0.7, y: 4.60, w: 8.6, h: 0.44, fontSize: 11, color: C.fraco, lineSpacingMultiple: 1.2 });
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

    /* ─── ATO 1 · ONDE ESTAMOS ────────────────────────────────────────────
       O panorama do mês e, logo em seguida, o mesmo mês dentro da série. Um
       número sozinho não diz se é bom: "114 entraram" só ganha sentido ao lado
       dos 110 de julho e dos 50 de junho. A evolução vinha DEPOIS de prazo e de
       entregas rápidas, e a sala passava três slides sem saber se o mês foi
       típico ou fora da curva.                                                */
    if (d.secoes.entregas) slideMes(pptx, d, ++p);

    if (d.secoes.evolucao && (d.evolucao || []).length) {
      slideEvolucao(pptx, d.evolucao, ++p, d.periodo);
    }

    /* ─── ATO 2 · ONDE A CAPACIDADE FOI ───────────────────────────────────
       O corte que a diretoria já lê no painel aprovado. Responde "em que o mês
       foi gasto" antes de o deck cobrar prazo — porque cobrar prazo sem mostrar
       no que o time esteve é cobrar no escuro.                               */
    if (d.secoes.pipelines && d.pipelines) slidePipelines(pptx, d.pipelines, ++p, d.periodo);

    /* OS PROJETOS VÊM LOGO DEPOIS DAS FRENTES — pedido do Fernando, e a ordem tem
       lógica: a frente diz EM QUE o mês foi gasto, o projeto diz PARA QUÊ. Uma
       pergunta puxa a outra, e separá-las por cinco slides obrigava a sala a
       lembrar do número anterior. */
    if (d.secoes.projetos && (d.projetos || []).length) {
      slideProjetos(pptx, d.projetos, ++p, d.periodo);
    }

    /* OS PONTOS FECHAM O ATO DA CAPACIDADE. Frente, projeto e ponto respondem a
       mesma pergunta em escalas diferentes: em que frente, para que projeto, e com
       quanto peso. O ponto vem por ultimo porque e a medida mais fina — e a que
       so faz sentido depois de a sala saber onde o mes foi gasto. */
    if (d.secoes.pontos && d.pontos && d.pontos.total > 0) {
      slidePontos(pptx, d.pontos, ++p, d.periodo);
      slidePontos2(pptx, d.pontos, ++p, d.periodo);
    }

    /* ─── ATO 3 · CUMPRIMOS O COMBINADO? ─────────────────────────────────
       A pergunta que a diretoria faz. Vem depois de "onde a capacidade foi", e
       fecha com as entregas rápidas — que é onde o time responde.            */
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

    // As entregas rápidas fecham o ato: e o contraponto ao slide de atraso — o
    // mesmo time que escapou do prazo em algumas entregou outras em dois dias.
    if (d.secoes.rapidas && d.rapidas && (d.rapidas.itens || []).length) {
      slideRapidas(pptx, d.rapidas, ++p, d.periodo, d.anterior);
    }

    /* ─── ATO 4 · EM QUE TRABALHAMOS ──────────────────────────────────────
       Área e quem pediu são a mesma pergunta em dois recortes: onde o esforço foi
       aplicado. O PROJETO SAIU DAQUI e subiu para junto das frentes — a frente diz
       em que o mês foi gasto e o projeto diz para quê, e as duas perguntas se
       puxam.                                                                   */
    if (d.secoes.areas && (d.areas || []).length) slideAreas(pptx, d.areas, ++p, d.periodo);

    // Quem pediu fecha o ato: o time e uma leitura; a area cliente e outra, e e a que diz
    //    para onde a capacidade foi de fato.
    if (d.secoes.solicit && d.solicitantes) {
      slideBarras(pptx, {
        titulo: 'Quem mais pediu', sub: 'demandas concluídas no período, por solicitante',
        itens: d.solicitantes.itens, max: 5, cor: SIGNIFICADO.neutro,
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

    /* ─── ATO 5 · QUEM FEZ ────────────────────────────────────────────────
       O agregado primeiro, o detalhe depois: o time inteiro, a distribuição por
       pessoa e, no fim, a linha do tempo dos três primeiros. Este bloco estava
       partido ao meio por "onde atuamos" e "quem pediu".                      */
    if (d.secoes.time && d.time) {
      // A quebra das SAIDAS, e nao das entradas: o slide fala do que o time
      // entregou, e o que entrou na fila e assunto do slide do mes.
      slideTime(pptx, d.time, ++p, d.periodo, d.ausencias, d.capacidade,
                (d.quebra || {}).saidas);
    }

    if (d.secoes.grafico && (d.porDev || []).length) {
      slideBarras(pptx, {
        titulo: 'Entregas por desenvolvedor', sub: 'demandas concluídas no período',
        itens: d.porDev, cor: SIGNIFICADO.neutro, rotuloSobra: ' pessoas', rotuloExtra: 'pts',
      }, ++p, d.periodo);
    }

    // O mês de cada um dos três primeiros devs, em linha do tempo.
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

    /* ─── ATO 6 · O QUE DEPENDE DE DECISÃO ───────────────────────────────
       A única parte do deck que pede ação de quem está na sala. Vem depois de
       tudo que explica o mês, e antes do fecho.                              */
    if (d.secoes.riscos && (d.riscos.pausadas.length || d.riscos.semPonto)) {
      var sr = slideTitulo(pptx, 'O que está travado', 'depende de decisão fora do time', ++p);
      if (d.riscos.pausadas.length) {
        tabela(pptx, sr, ['Demanda', 'Parada há', 'Motivo'],
          d.riscos.pausadas.map(function (x) {
            return [corta(x.titulo, 40),
                    { text: x.dias + 'd', options: { color: SIGNIFICADO.atencao } },
                    corta(x.motivo, 46)];
          }), { colW: [3.6, 1.0, 4.0], rotuloSobra: ' pausadas' });
      } else {
        sr.addText('Nenhuma demanda pausada.', { x: 0.7, y: 1.7, w: 8.6, h: 0.4,
                                                 fontSize: 15, color: C.fraco });
      }
      rodape(sr, d.periodo, p);
    }

    /* ─── ATO 7 · O FECHO ─────────────────────────────────────────────────
       Os destaques, o que vem e a frase de quem apresenta. Eles saiam no meio do
       deck, antes dos graficos — mas quem apresenta usa as ultimas paginas para
       as entregas que importam, e slide de encerramento no meio e slide que a
       sala nao leva embora.                                                   */
    (d.destaques || []).forEach(function (m) {
      var s = slideBase(pptx);
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: 5.63, fill: { color: C.verde } });
      s.addText(m.codigo || '', { x: 0.7, y: 0.52, w: 8.6, h: 0.3, fontSize: 13, color: C.verde, bold: true });
      s.addText(corta(m.titulo || '', 52), {
        x: 0.7, y: 0.84, w: 8.6, h: 0.6, fontSize: 26, bold: true, color: C.texto, wrap: false });
      if (m.texto) {
        /* O TEXTO VEM DO CARD, EM MARKDOWN, e ia cru para o slide: "# Saida de
           Risco", "## Por que a mudanca", "**Operacoes**". Fora o markdown a
           vista, o texto inteiro nao cabia e escrevia por cima do titulo, dos
           metadados e do rodape — o slide virava tres camadas de letra.

           `textoLimpo` tira a marcacao e corta no que a caixa comporta. O corte
           e explicito: melhor uma reticencia do que meia frase escondida atras
           de outra. */
        s.addText(textoLimpo(m.texto, 520), {
          x: 0.7, y: 1.52, w: 8.6, h: 2.6, fontSize: 14,
          color: C.texto, lineSpacingMultiple: 1.3, valign: 'top' });
      }
      // Sem emoji aqui: se a maquina que projeta nao tiver o glifo, ele vira
      // quadrado — e quadrado no slide da diretoria custa mais que o icone vale.
      var meta = [m.dev || '', m.tema || '',
                  m.pontos ? m.pontos + ' pontos' : ''].filter(Boolean).join('   ·   ');
      if (meta) s.addText(meta, { x: 0.7, y: 4.32, w: 8.6, h: 0.3, fontSize: 12,
                                  color: C.fraco, wrap: false });
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
            x: 0.9 + i * 2.85, y: 3.48, w: 2.7, h: 0.28, fontSize: 14, color: C.texto });
          sm.addText(f.qtd + (f.qtd === 1 ? ' entrega' : ' entregas') +
                     (f.dias ? '  ·  ' + f.dias + 'd em média' : ''), {
            x: 0.9 + i * 2.85, y: 3.78, w: 2.7, h: 0.26, fontSize: 12, color: C.vermelho });
          /* QUEM entregou com atraso. Sem o nome, "Antifraude, 9 entregas" deixa
             a pergunta seguinte na mao de quem apresenta, no meio da reuniao —
             e a resposta esta no dado, so nao estava no slide. */
          if ((f.devs || []).length) {
            sm.addText(corta(f.devs.join(', '), 44), {
              x: 0.9 + i * 2.85, y: 4.06, w: 2.7, h: 0.24, fontSize: 9.5, color: C.fraco });
          }
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
