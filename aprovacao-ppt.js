/* ─────────────────────────────────────────────────────────────────────────
   IMPRIMIR — EM APROVAÇÃO DE REQUISITOS (03/11/2026)

   "Preciso que seja criado um botão 'Imprimir - Em aprovação de requisitos'
    em ppt no estilo que foi criado com as demandas, com o código, título,
    tipo, prioridade, impacto e urgência. Dessa forma eu irei imprimir para
    validar se sigo ou seguro a demanda para sprint." E depois: "add uma
    coluna de quem solicitou".

   UMA FOLHA DE DECISÃO, E NÃO UM RELATÓRIO. A capa diz quantas são, o resumo
   conta por impacto e urgência, e a tabela traz uma coluna "Decisão" com as
   duas caixas para marcar a caneta. Tabelas nativas: o arquivo abre e edita no
   PowerPoint como qualquer outro.

   NÃO DECIDE NADA. Recebe as demandas já escolhidas por quem chamou (a etapa
   `levantar_req` do Admin) e só desenha. A biblioteca vem do mesmo carregador
   sob demanda dos outros decks (`apresentacaoKit.carregaLib`).
   ───────────────────────────────────────────────────────────────────────────*/
(function () {
  'use strict';

  var NAVY = '14213D', TEXTO = '1B2333', MUTED = '6B7686', LINHA = 'D5DAE1', ZEBRA = 'F7F8FA';
  var NIVEL = { // baixo/medio/alto — mesma escala de impacto e urgencia
    alto: { cor: 'C0392B', fundo: 'FBE3E0' }, alta: { cor: 'C0392B', fundo: 'FBE3E0' },
    medio: { cor: 'B7791F', fundo: 'FDF1DE' }, media: { cor: 'B7791F', fundo: 'FDF1DE' },
    baixo: { cor: '2E7D4F', fundo: 'E2F1E5' }, baixa: { cor: '2E7D4F', fundo: 'E2F1E5' },
  };
  var PRIO = { alta: 'Alta', media: 'Média', baixa: 'Baixa', critica: 'Crítica' };
  var TIPO = { sustentacao: 'Sustentação', evolucao: 'Evolução' };
  var PESO = { alto: 3, alta: 3, medio: 2, media: 2, baixo: 1, baixa: 1 };

  function txt(v) { return String(v == null ? '' : v).trim(); }
  function dataBR(d) {
    var p = (d || new Date()).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    return p;
  }
  function rotuloNivel(v, qual) {
    var R = window.REQUISITOS;
    var r = R ? (qual === 'impacto' ? R.rotuloImpacto(v) : R.rotuloUrgencia(v)) : txt(v);
    return r || 'A definir';
  }
  function celula(t, o) {
    var op = { fontFace: 'Calibri', fontSize: 11, color: TEXTO, valign: 'middle', margin: [3, 5, 3, 5] };
    for (var k in (o || {})) op[k] = o[k];
    return { text: t, options: op };
  }
  function nivelCel(v, qual, fundo) {
    var n = NIVEL[txt(v).toLowerCase()];
    return n ? celula(rotuloNivel(v, qual), { bold: true, color: n.cor, fill: { color: n.fundo }, align: 'center' })
             : celula('A definir', { italic: true, color: MUTED, align: 'center', fill: fundo });
  }

  /* A ORDEM DA FOLHA: o mais impactante e urgente primeiro — e o que se decide
     antes. Depois prioridade, depois codigo. */
  function ordena(ms) {
    return ms.slice().sort(function (a, b) {
      var pa = (PESO[txt(a.impacto).toLowerCase()] || 0) + (PESO[txt(a.urgencia).toLowerCase()] || 0);
      var pb = (PESO[txt(b.impacto).toLowerCase()] || 0) + (PESO[txt(b.urgencia).toLowerCase()] || 0);
      if (pb !== pa) return pb - pa;
      var qa = PESO[txt(a.prioridade).toLowerCase()] || 0, qb = PESO[txt(b.prioridade).toLowerCase()] || 0;
      if (qb !== qa) return qb - qa;
      return txt(a.codigo).localeCompare(txt(b.codigo), 'pt-BR', { numeric: true });
    });
  }

  async function gera(demandas, opcoes) {
    var K = window.apresentacaoKit;
    if (!K || !K.carregaLib) throw new Error('apresentacao.js não carregou');
    await K.carregaLib();
    var o = opcoes || {};
    var ms = ordena(demandas || []);
    var hoje = dataBR();
    var rotuloEtapa = (window.REQUISITOS && window.REQUISITOS.ROTULO) || 'Em aprovação de requisitos';

    var pptx = new window.PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';                 // 13,33 x 7,5 pol.
    pptx.title = rotuloEtapa + ' — ' + hoje;
    pptx.company = 'Audax Capital';
    var RODAPE = 'Audax Capital · Produto & Tecnologia · ' + rotuloEtapa + ' · ' + hoje;

    // ── Capa ──
    var s = pptx.addSlide();
    s.background = { color: NAVY };
    s.addText(rotuloEtapa, { x: 0.8, y: 2.2, w: 11.7, h: 1.2, fontFace: 'Calibri', fontSize: 44, bold: true,
                             color: 'FFFFFF', margin: 0, valign: 'bottom' });
    s.addText(ms.length + (ms.length === 1 ? ' demanda' : ' demandas') +
              ' para decidir: segue para a sprint ou fica segura · ' + hoje,
              { x: 0.8, y: 3.55, w: 11.7, h: 0.8, fontFace: 'Calibri', fontSize: 20, color: 'CADCFC', margin: 0 });
    s.addText('Audax Capital · Produto & Tecnologia', { x: 0.8, y: 6.6, w: 8, h: 0.4, fontFace: 'Calibri',
                                                       fontSize: 12, color: '9FB0CC', margin: 0 });

    if (!ms.length) {
      s.addText('Nenhuma demanda nesta etapa hoje.', { x: 0.8, y: 4.6, w: 11.7, h: 0.6, fontFace: 'Calibri',
                                                      fontSize: 18, color: 'F2A541', margin: 0 });
    } else {
      // ── Resumo: impacto x urgencia ──
      s = pptx.addSlide();
      s.background = { color: 'FFFFFF' };
      s.addText('Resumo por impacto e urgência', { x: 0.5, y: 0.3, w: 12.3, h: 0.65, fontFace: 'Calibri',
                                                  fontSize: 28, bold: true, color: NAVY, margin: 0 });
      var niveis = [['alto', 'alta', 'Alto / Alta'], ['medio', 'media', 'Médio / Média'], ['baixo', 'baixa', 'Baixo / Baixa']];
      var conta = function (campo, v) {
        return ms.filter(function (m) { return txt(m[campo]).toLowerCase() === v; }).length;
      };
      var cab = [celula('Nível', { bold: true, color: 'FFFFFF', fill: { color: NAVY } }),
                 celula('Impacto', { bold: true, color: 'FFFFFF', fill: { color: NAVY }, align: 'center' }),
                 celula('Urgência', { bold: true, color: 'FFFFFF', fill: { color: NAVY }, align: 'center' })];
      var linhas = niveis.map(function (n) {
        var cor = NIVEL[n[0]];
        return [celula(n[2], { bold: true, color: cor.cor }),
                celula(String(conta('impacto', n[0])), { align: 'center', fontSize: 16, bold: true }),
                celula(String(conta('urgencia', n[1])), { align: 'center', fontSize: 16, bold: true })];
      });
      var semImp = ms.filter(function (m) { return !NIVEL[txt(m.impacto).toLowerCase()]; }).length;
      var semUrg = ms.filter(function (m) { return !NIVEL[txt(m.urgencia).toLowerCase()]; }).length;
      linhas.push([celula('A definir', { italic: true, color: MUTED }),
                   celula(String(semImp), { align: 'center', fontSize: 16, color: MUTED }),
                   celula(String(semUrg), { align: 'center', fontSize: 16, color: MUTED })]);
      s.addTable([cab].concat(linhas), { x: 0.5, y: 1.3, w: 7.2, colW: [2.8, 2.2, 2.2], rowH: 0.55,
                                         border: { type: 'solid', pt: 0.5, color: LINHA } });
      s.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 8.2, y: 1.3, w: 4.6, h: 2.2, fill: { color: 'F3F5F8' },
                                                  line: { color: 'F3F5F8' }, rectRadius: 0.08 });
      s.addText(String(ms.length), { x: 8.5, y: 1.4, w: 4, h: 1.1, fontFace: 'Calibri', fontSize: 60, bold: true,
                                     color: NAVY, margin: 0 });
      s.addText('demandas em aprovação de requisitos', { x: 8.5, y: 2.55, w: 4, h: 0.7, fontFace: 'Calibri',
                                                         fontSize: 14, color: TEXTO, margin: 0 });
      s.addText('A folha segue a ordem de impacto + urgência: o que mais pesa vem primeiro.',
                { x: 0.5, y: 4.2, w: 12.3, h: 0.5, fontFace: 'Calibri', fontSize: 12, italic: true, color: MUTED, margin: 0 });
      s.addText(RODAPE, { x: 0.5, y: 7.05, w: 12, h: 0.3, fontFace: 'Calibri', fontSize: 10, color: MUTED, margin: 0 });

      // ── A folha de decisao ──
      var COLS = [1.0, 2.0, 2.8, 1.3, 0.95, 0.95, 0.85, 0.85, 1.6];   // = 12,3
      var CAB = ['Código', 'Sistema/Módulo', 'Título', 'Solicitante', 'Tipo', 'Prioridade', 'Impacto', 'Urgência', 'Decisão'];
      var cabecalho = CAB.map(function (t, i) {
        return celula(t, { bold: true, color: 'FFFFFF', fill: { color: NAVY }, align: i >= 4 ? 'center' : 'left' });
      });
      /* O SISTEMA/MODULO SAI DO TEMA: "AXCred - Operacoes" vira "AXCred › Operacoes".
         Quem chama manda os temas em `opcoes.temas`. */
      var temas = {};
      (o.temas || []).forEach(function (t) { if (t && t.id) temas[t.id] = txt(t.nome); });
      var sistemaModulo = function (m) {
        var n = temas[m.tema_id];
        return n ? n.split(' - ').map(txt).filter(Boolean).join(' › ') : '';
      };
      var Y0 = 1.15, YMAX = 6.8;
      var altura = function (m) {
        var l = Math.max(1, Math.ceil(txt(m.titulo).length / 38), Math.ceil(txt(m.solicitante).length / 17),
                         Math.ceil(sistemaModulo(m).length / 26));
        return l * 0.22 + 0.16;
      };
      var paginas = [], rows = null, y = 0, idx = 0;
      var nova = function () { rows = [cabecalho]; y = Y0 + 0.36; paginas.push(rows); };
      nova();
      ms.forEach(function (m) {
        var h = altura(m);
        if (y + h > YMAX) nova();
        var fundo = (idx++ % 2) ? { color: ZEBRA } : undefined;
        var base = fundo ? { fill: fundo } : {};
        var com = function (o2) { var r = {}; for (var k in base) r[k] = base[k]; for (var k2 in o2) r[k2] = o2[k2]; return r; };
        rows.push([
          celula(txt(m.codigo) || '—', com({ bold: true })),
          celula(sistemaModulo(m) || 'Sem tema', com(sistemaModulo(m) ? {} : { italic: true, color: MUTED })),
          celula(txt(m.titulo), base),
          celula(txt(m.solicitante) || 'A definir', com(txt(m.solicitante) ? {} : { italic: true, color: MUTED })),
          celula(TIPO[txt(m.tipo)] || 'A definir',
                 com(TIPO[txt(m.tipo)] ? { align: 'center' } : { align: 'center', italic: true, color: MUTED })),
          celula(PRIO[txt(m.prioridade).toLowerCase()] || 'A definir',
                 com(PRIO[txt(m.prioridade).toLowerCase()] ? { align: 'center' } : { align: 'center', italic: true, color: MUTED })),
          nivelCel(m.impacto, 'impacto', fundo),
          nivelCel(m.urgencia, 'urgencia', fundo),
          celula('☐ Segue   ☐ Segura', com({ align: 'center' })),
        ]);
        y += h;
      });
      paginas.forEach(function (r, i) {
        var sl = pptx.addSlide();
        sl.background = { color: 'FFFFFF' };
        sl.addText('Decisão · ' + rotuloEtapa + (paginas.length > 1 ? '  (' + (i + 1) + '/' + paginas.length + ')' : ''),
                   { x: 0.5, y: 0.3, w: 12.3, h: 0.65, fontFace: 'Calibri', fontSize: 28, bold: true, color: NAVY, margin: 0 });
        sl.addTable(r, { x: 0.5, y: Y0, w: 12.3, colW: COLS, border: { type: 'solid', pt: 0.5, color: LINHA }, autoPage: false });
        sl.addText(RODAPE, { x: 0.5, y: 7.05, w: 10, h: 0.3, fontFace: 'Calibri', fontSize: 10, color: MUTED, margin: 0 });
        sl.addText(String(i + 3), { x: 12.2, y: 7.05, w: 0.6, h: 0.3, fontFace: 'Calibri', fontSize: 10, color: MUTED,
                                    align: 'right', margin: 0 });
      });
    }

    var nome = o.nome || ('Aprovacao_de_requisitos_' + hoje.split('/').reverse().join('-') + '.pptx');
    await pptx.writeFile({ fileName: nome });
    return { arquivo: nome, demandas: ms.length };
  }

  var api = { gera: gera, ordena: ordena };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.APROVACAOPPT = api;
})();
