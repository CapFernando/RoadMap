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

  function slideCapa(pptx, cfg) {
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

  function slideTitulo(pptx, titulo, sub, pagina) {
    var s = slideBase(pptx);
    s.addText(titulo, { x: 0.7, y: 0.55, w: 8.6, h: 0.5, fontSize: 24, bold: true, color: C.texto });
    if (sub) s.addText(sub, { x: 0.7, y: 1.05, w: 8.6, h: 0.35, fontSize: 13, color: C.fraco });
    rodape(s, '', pagina);
    return s;
  }

  // Tabela enxuta. Máximo de linhas de propósito: passou disso, o slide virou
  // anexo e ninguém lê no projetor.
  function tabela(pptx, s, cabec, linhas, y) {
    var corpo = [cabec.map(function (t) {
      return { text: t, options: { bold: true, color: C.fraco, fontSize: 12 } };
    })];
    linhas.forEach(function (l) {
      corpo.push(l.map(function (c) {
        var o = (c && typeof c === 'object') ? c : { text: String(c) };
        return { text: o.text, options: Object.assign(
          { color: C.texto, fontSize: 13 }, o.options || {}) };
      }));
    });
    s.addTable(corpo, {
      x: 0.7, y: y || 1.6, w: 8.6, border: { type: 'solid', color: '2E2E2B', pt: 1 },
      fill: { color: C.fundo2 }, autoPage: false,
    });
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

    // 1. O mês em um número: quanto saiu.
    if (d.secoes.entregas) {
      slideNumero(pptx, {
        rotulo: 'Entregas concluídas', valor: d.kpi.concluidas,
        apoio: d.kpi.pontos ? d.kpi.pontos + ' pontos de complexidade entregues' : '',
        nota: d.kpi.notaEntregas || '', cor: C.verde, rodape: d.periodo }, ++p);
    }

    // 2. Prazo: a pergunta que a diretoria faz.
    if (d.secoes.prazo && d.prazo.medidas) {
      slideNumero(pptx, {
        rotulo: 'Entregues no prazo', valor: d.prazo.pct + '%',
        apoio: d.prazo.noPrazo + ' de ' + d.prazo.medidas + ' entregas medidas',
        nota: d.prazo.naoMedidas
          ? d.prazo.naoMedidas + ' conclusões não entram na conta: a data foi ' +
            'registrada retroativamente, então "no prazo" seria verdade por construção.'
          : '',
        cor: d.prazo.pct >= 80 ? C.verde : d.prazo.pct >= 50 ? C.ambar : C.vermelho,
        rodape: d.periodo }, ++p);

      if (d.prazo.atrasadas.length) {
        var s = slideTitulo(pptx, 'Onde escapou do prazo',
          d.prazo.atrasadas.length + ' entregas, atraso médio de ' + d.prazo.diasMedio +
          (d.prazo.diasMedio === 1 ? ' dia' : ' dias'), ++p);
        tabela(pptx, s, ['Demanda', 'Responsável', 'Prazo → conclusão', 'Atraso'],
          d.prazo.atrasadas.slice(0, 8).map(function (a) {
            return [a.titulo, a.dev, a.datas,
                    { text: '+' + a.dias + 'd', options: { color: C.vermelho, bold: true } }];
          }));
      }
    }

    // 3. Os destaques — escolhidos por quem apresenta.
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

    // 4. Distribuição por pessoa — aqui o gráfico vale mais que a tabela.
    if (d.secoes.grafico && d.imagens.length) {
      d.imagens.forEach(function (img) {
        var s = slideTitulo(pptx, img.titulo, img.sub || '', ++p);
        s.addImage({ data: img.png, x: 0.7, y: 1.5, w: 8.6, h: 3.4 });
      });
    }

    // 5. O que trava: pausadas e sem estimativa. É a parte que a diretoria pode
    //    destravar — e a única razão de ela estar no deck.
    if (d.secoes.riscos && (d.riscos.pausadas.length || d.riscos.semPonto)) {
      var sr = slideTitulo(pptx, 'O que está travado', 'depende de decisão fora do time', ++p);
      if (d.riscos.pausadas.length) {
        tabela(pptx, sr, ['Demanda', 'Parada há', 'Motivo'],
          d.riscos.pausadas.slice(0, 7).map(function (x) {
            return [x.titulo, { text: x.dias + 'd', options: { color: C.ambar } }, x.motivo];
          }));
      } else {
        sr.addText('Nenhuma demanda pausada.', { x: 0.7, y: 1.7, w: 8.6, h: 0.4,
                                                 fontSize: 15, color: C.fraco });
      }
    }

    // 6. O que vem. Terminar em compromisso, não em número.
    if (d.secoes.proximo) {
      var sp = slideTitulo(pptx, 'O que vem', d.proximo.sub || '', ++p);
      if (d.proximo.itens.length) {
        tabela(pptx, sp, ['Demanda', 'Responsável', 'Entrega'],
          d.proximo.itens.slice(0, 8).map(function (x) {
            return [x.titulo, x.dev, x.entrega];
          }));
      } else {
        sp.addText('Nada planejado para o próximo período ainda.',
          { x: 0.7, y: 1.7, w: 8.6, h: 0.4, fontSize: 15, color: C.fraco });
      }
    }

    // 7. A mensagem de quem apresenta. Fica por último porque é a frase que a
    //    sala leva embora, e ela é escrita por uma pessoa — não calculada.
    if (d.mensagem) {
      var sm = slideBase(pptx);
      sm.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: 5.63, fill: { color: C.azul } });
      sm.addText(d.mensagem, { x: 0.9, y: 1.6, w: 8.4, h: 2.4, fontSize: 24,
                               color: C.texto, lineSpacingMultiple: 1.35 });
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
