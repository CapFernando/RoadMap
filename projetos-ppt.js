/* ─────────────────────────────────────────────────────────────────────────
   IMPRIMIR — PROJETOS EM ANDAMENTO (03/11/2026)

   "Retire a coluna 'entrega dev' e me de opcao de imprimir semelhante ao que
    criamos no kanban."

   O MESMO ESTILO da folha de aprovacao de requisitos (`aprovacao-ppt.js`):
   capa azul-marinho, um resumo e tabelas nativas, editaveis no PowerPoint.
   Um projeto por vez: o titulo do slide e o projeto, e a tabela traz as tres
   faixas da tela — Feitas, Em andamento e Planejado — com a data de cada uma
   (conclusao nas feitas, entrega ao usuario nas outras) e a sprint na cor dela.

   NAO CALCULA NADA. Recebe os projetos ja montados por `pjAndamentoDados` no
   Admin, a mesma funcao que desenha a tela.
   ───────────────────────────────────────────────────────────────────────────*/
(function () {
  'use strict';

  /* A PALETA E A DO AXIS NO CLARO, como a da folha de aprovacao
     (`aprovacao-ppt.js`): papel branco para imprimir, marinho do AXIS no
     cabecalho e nos titulos, laranja so no traco sob o titulo, e a capa
     corporativa (CAPA) mantida. As faixas sao os estados ok, info e roxo do
     AXIS a 14%, o mesmo fundo dos chips da tela. Sem emoji: no slide ele vira
     quadrado quando a fonte de quem abre nao o tem. */
  var CAPA = '14213D', NAVY = '0D162A', TEXTO = '0B1220', MUTED = '5B6B85', LINHA = 'CFD7E3', ZEBRA = 'F2F5F9', VERM = 'C62828';
  var LARANJA = 'FF6B1A';
  var FAIXAS = [
    { k: 'feitas', nome: 'Feitas', tint: 'DEF2E6', data: 'Concluída em' },
    { k: 'andamento', nome: 'Em andamento', tint: 'E0E9FC', data: 'Entrega usuário' },
    { k: 'planejado', nome: 'Planejado', tint: 'EDE3FC', data: 'Entrega usuário' },
  ];

  function txt(v) { return String(v == null ? '' : v).trim(); }
  function br(iso) { var s = txt(iso); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : ''; }
  function celula(t, o) {
    var op = { fontFace: 'Calibri', fontSize: 11, color: TEXTO, valign: 'middle', margin: [3, 5, 3, 5] };
    for (var k in (o || {})) op[k] = o[k];
    return { text: t, options: op };
  }
  function junta(a, b) { var r = {}; var k; for (k in (a || {})) r[k] = a[k]; for (k in (b || {})) r[k] = b[k]; return r; }

  async function gera(projetos, opcoes) {
    var K = window.apresentacaoKit;
    if (!K || !K.carregaLib) throw new Error('apresentacao.js não carregou');
    await K.carregaLib();
    var o = opcoes || {};
    var hojeISO = txt(o.hoje) || new Date().toISOString().slice(0, 10);
    var hoje = br(hojeISO);
    var ps = projetos || [];

    var pptx = new window.PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.title = 'Projetos em andamento — ' + hoje;
    pptx.company = 'Audax Capital';
    var RODAPE = 'Audax Capital · Produto & Tecnologia · Projetos em andamento · ' + hoje;
    var pagina = 1;
    var rodape = function (sl) {
      sl.addText(RODAPE, { x: 0.5, y: 7.05, w: 10, h: 0.3, fontFace: 'Calibri', fontSize: 10, color: MUTED, margin: 0 });
      sl.addText(String(pagina), { x: 12.2, y: 7.05, w: 0.6, h: 0.3, fontFace: 'Calibri', fontSize: 10, color: MUTED,
                                   align: 'right', margin: 0 });
    };
    var titulo = function (sl, t) {
      sl.background = { color: 'FFFFFF' };
      sl.addText(t, { x: 0.5, y: 0.3, w: 12.3, h: 0.65, fontFace: 'Calibri', fontSize: 28, bold: true, color: NAVY, margin: 0 });
      // Termina em 0,98", onde comeca a linha do responsavel no slide do projeto.
      sl.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 0.94, w: 0.6, h: 0.04, fill: { color: LARANJA },
                                           line: { color: LARANJA } });
    };

    // ── Capa ──
    var s = pptx.addSlide();
    s.background = { color: CAPA };
    s.addText('Projetos em andamento', { x: 0.8, y: 2.2, w: 11.7, h: 1.2, fontFace: 'Calibri', fontSize: 44, bold: true,
                                         color: 'FFFFFF', margin: 0, valign: 'bottom' });
    s.addText(ps.length + (ps.length === 1 ? ' projeto' : ' projetos') + ' com demanda na sprint atual' +
              (o.sprint ? ' (' + o.sprint + ')' : '') + ' ou nas próximas · ' + hoje,
              { x: 0.8, y: 3.55, w: 11.7, h: 0.8, fontFace: 'Calibri', fontSize: 20, color: 'CADCFC', margin: 0 });
    s.addText('Audax Capital · Produto & Tecnologia', { x: 0.8, y: 6.6, w: 8, h: 0.4, fontFace: 'Calibri',
                                                       fontSize: 12, color: '9FB0CC', margin: 0 });

    if (ps.length) {
      // ── Resumo ──
      s = pptx.addSlide(); pagina++;
      titulo(s, 'Visão geral dos projetos');
      var cabR = ['Projeto', 'Responsável', 'Feitas', 'Em andamento', 'Planejado', 'Entrega'].map(function (t, i) {
        return celula(t, { bold: true, color: 'FFFFFF', fill: { color: NAVY }, align: i >= 2 ? 'center' : 'left' });
      });
      var linhasR = ps.map(function (p, i) {
        var base = (i % 2) ? { fill: { color: ZEBRA } } : {};
        var venc = p.entrega && p.entrega < hojeISO;
        return [
          celula((p.codigo ? p.codigo + ' · ' : '') + p.nome, junta(base, { bold: true })),
          celula(txt(p.responsavel) || '—', base),
          celula(String(p.feitas.length), junta(base, { align: 'center' })),
          celula(String(p.andamento.length), junta(base, { align: 'center' })),
          celula(String(p.planejado.length), junta(base, { align: 'center' })),
          celula(p.entrega ? br(p.entrega) : 'A definir',
                 junta(base, { align: 'center', bold: !!p.entrega, color: venc ? VERM : (p.entrega ? TEXTO : MUTED),
                               italic: !p.entrega })),
        ];
      });
      s.addTable([cabR].concat(linhasR), { x: 0.5, y: 1.2, w: 12.3, colW: [5.0, 1.8, 1.1, 1.4, 1.2, 1.8],
                                           border: { type: 'solid', pt: 0.5, color: LINHA }, autoPage: false });
      s.addText('Entrega = data de fim do projeto quando preenchida; senão, a última entrega ao usuário planejada.',
                { x: 0.5, y: 6.55, w: 12.3, h: 0.4, fontFace: 'Calibri', fontSize: 11, italic: true, color: MUTED, margin: 0 });
      rodape(s);

      // ── Um projeto por vez ──
      var COLS = [1.0, 2.2, 5.0, 1.6, 1.4, 1.1];   // = 12,3
      var Y0 = 1.55, YMAX = 6.85;
      ps.forEach(function (p) {
        var cab = ['Código', 'Sistema/Módulo', 'Título', 'Etapa', 'Data', 'Sprint'].map(function (t, i) {
          return celula(t, { bold: true, color: 'FFFFFF', fill: { color: NAVY }, align: i >= 3 ? 'center' : 'left' });
        });
        var altura = function (r) {
          return Math.max(1, Math.ceil(txt(r.titulo).length / 70), Math.ceil(txt(r.sistema).length / 28)) * 0.22 + 0.14;
        };
        var paginas = [], rows = null, y = 0;
        var nova = function () { rows = [cab]; y = Y0 + 0.34; paginas.push(rows); };
        nova();
        FAIXAS.forEach(function (f) {
          var itens = p[f.k] || [];
          var faixa = function (cont) {
            return [celula(f.nome + '  ·  ' + itens.length + (cont ? '  (continuação)' : '') + '   —   data: ' + f.data.toLowerCase(),
                           { colspan: 6, bold: true, fill: { color: f.tint } })];
          };
          if (y + 0.3 + (itens[0] ? altura(itens[0]) : 0.3) > YMAX) nova();
          rows.push(faixa(false)); y += 0.3;
          if (!itens.length) {
            rows.push([celula('Nenhuma com data.', { colspan: 6, italic: true, color: MUTED })]); y += 0.3;
            return;
          }
          itens.forEach(function (r, i) {
            var h = altura(r);
            if (y + h > YMAX) { nova(); rows.push(faixa(true)); y += 0.3; }
            var base = (i % 2) ? { fill: { color: ZEBRA } } : {};
            var venc = f.k !== 'feitas' && r.data && r.data < hojeISO;
            var cor = txt(r.cor).replace('#', '');
            rows.push([
              celula(r.codigo || '—', junta(base, { bold: true })),
              celula(r.sistema || 'Sem tema', junta(base, r.sistema ? {} : { italic: true, color: MUTED })),
              celula(r.titulo, base),
              celula(r.etapa, junta(base, { align: 'center' })),
              celula(r.data ? br(r.data) : '—', junta(base, { align: 'center', bold: !!venc, color: venc ? VERM : TEXTO })),
              celula(r.sprint || '—', junta(base, { align: 'center', bold: !!r.sprint,
                                                    color: r.sprint && /^[0-9A-Fa-f]{6}$/.test(cor) ? cor : MUTED })),
            ]);
            y += h;
          });
        });
        paginas.forEach(function (rs, i) {
          var sl = pptx.addSlide(); pagina++;
          titulo(sl, (p.codigo ? p.codigo + ' · ' : '') + p.nome + (paginas.length > 1 ? '  (' + (i + 1) + '/' + paginas.length + ')' : ''));
          var venc = p.entrega && p.entrega < hojeISO;
          sl.addText([
            { text: (txt(p.responsavel) ? 'Responsável: ' + p.responsavel + '   ·   ' : '') +
                    p.naSprint + ' na sprint atual/próximas   ·   Entrega: ', options: { color: MUTED } },
            { text: p.entrega ? br(p.entrega) : 'a definir', options: { bold: true, color: venc ? VERM : NAVY } },
            { text: p.entrega ? ' (' + p.fonte + ')' : '', options: { italic: true, color: MUTED } },
          ], { x: 0.5, y: 0.98, w: 12.3, h: 0.4, fontFace: 'Calibri', fontSize: 14, margin: 0 });
          sl.addTable(rs, { x: 0.5, y: Y0, w: 12.3, colW: COLS, border: { type: 'solid', pt: 0.5, color: LINHA }, autoPage: false });
          rodape(sl);
        });
      });
    } else {
      s.addText('Nenhum projeto com demanda na sprint atual ou nas próximas.', { x: 0.8, y: 4.6, w: 11.7, h: 0.6,
        fontFace: 'Calibri', fontSize: 18, color: 'F2A541', margin: 0 });
    }

    var nome = o.nome || ('Projetos_em_andamento_' + hojeISO + '.pptx');
    await pptx.writeFile({ fileName: nome });
    return { arquivo: nome, projetos: ps.length };
  }

  var api = { gera: gera };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.PROJETOSPPT = api;
})();
