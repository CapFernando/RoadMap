/* ─────────────────────────────────────────────────────────────────────────
   AXIS — Item (prototipo: EP-013-axis/prototipo/fonte/Item.dc.html).

   ROTA: #item/AX-123 (Detalhe) e #item/AX-123/conversa (Conversa).
   A tela tem `param: true`, e o nucleo nao monta abas automaticas para tela
   com parametro (o 1o segmento e o codigo, e nao a aba). Quem separa e o
   `abasDe` daqui: ele le o ultimo segmento, acerta `r.aba` e `r.param` NO
   PROPRIO objeto da rota — o nucleo chama `abasDe` antes de montar o `ctx`, e
   e por isso que o `render` ja recebe a aba certa.

   AS ACOES GRAVAM DAQUI. Editar abre o formulario do app (axis-form-
   demanda.js); mover, validar, devolver, homologar, replanejar, pausar e
   retomar, negar e entregar sao os gestos de axis-acoes.js, cada um com o
   patch que o editor do admin ou o painel do dev gravaria. O que este arquivo
   decide e so QUAIS botoes cada perfil ve (`AXIS_ACOES.disponiveis`) e qual e
   o principal. Continuam fora: escrever na conversa (Mensageria) e estimar
   (Planning Poker).

   O MOTIVO DA TRAVA nao e inventado nem recalculado: e o que os modulos de
   regra responderiam se a demanda fosse movida para a proxima etapa agora —
   `PREVOO.presos` (o que o servidor barraria), `HOMOLOGACAO.barra`,
   `SPRINTPO.travaDeAlocacao`, `VINCULO.abertos` e `PAUSA.situacao`.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var AX = window.AXIS_APP;
  if (!AX) return;
  var H = AX.H;

  var FLUXO = ['backlog', 'levantar_req', 'planning', 'planejado', 'em_andamento',
               'validacao_area', 'validacao', 'concluido'];
  var ABAS = ['conversa'];

  // ── CSS proprio, injetado uma vez ────────────────────────────────────
  function css() {
    if (document.getElementById('css-tela-item')) return;
    var s = document.createElement('style');
    s.id = 'css-tela-item';
    s.textContent = [
      '.axa .it-sec{padding:20px;border-radius:16px;background:rgba(var(--sf-rgb),.72);border:1px solid var(--bd);display:flex;flex-direction:column;gap:10px;min-width:0}',
      '.axa .it-aside .it-sec{padding:18px}',
      '.axa .it-h2{margin:0;font-family:var(--font-ui);font-size:13px;font-weight:800;letter-spacing:.12em;color:var(--tx3)}',
      '.axa .it-aside .it-h2{font-size:12px}',
      '.axa .it-trilha{display:flex;flex-wrap:wrap;gap:8px;font-size:12.5px;color:var(--tx3);align-items:center}',
      '.axa .it-trilha a{text-decoration:none}',
      '.axa .it-passos{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12px;font-weight:700}',
      '.axa .it-passo{height:28px;padding:0 12px;border-radius:8px;display:inline-flex;align-items:center;gap:5px;background:var(--sf2);color:var(--tx3);white-space:nowrap}',
      '.axa .it-passo.feito{background:rgba(var(--ok-rgb),.12);color:var(--ok-t)}',
      '.axa .it-passo.atual{background:rgba(var(--ac-rgb),.18);color:var(--tx-hi);box-shadow:inset 0 0 0 1px rgba(var(--ac-rgb),.5)}',
      '.axa .it-passo.neg{background:rgba(var(--dg-rgb),.14);color:var(--dg-t);box-shadow:inset 0 0 0 1px rgba(var(--dg-rgb),.45)}',
      '.axa .it-seta{color:var(--tx5)}',
      '.axa .it-trava{font-size:13px;line-height:19px;color:var(--wn-c)}',
      '.axa .it-trava.dg{color:var(--dg-t)}',
      '.axa .it-trava.ok{color:var(--tx3)}',
      '.axa .it-desc{margin:0;font-size:14px;line-height:22px;color:var(--tx2);white-space:pre-wrap;overflow-wrap:anywhere}',
      '.axa .it-desc b{color:var(--tx);font-weight:800}',
      '.axa .it-crit{padding:12px 14px;border-radius:12px;background:var(--sf2);font-size:13.5px;line-height:21px;color:var(--tx2);overflow-wrap:anywhere}',
      '.axa .it-crit b{color:var(--ac-t)}',
      '.axa .it-task{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;line-height:20px;color:var(--tx2)}',
      '.axa .it-task input{accent-color:var(--ac);margin-top:3px;flex-shrink:0}',
      '.axa .it-task.feita .t{color:var(--tx3);text-decoration:line-through}',
      '.axa .it-props{display:grid;grid-template-columns:110px minmax(0,1fr);gap:10px 12px;font-size:13px;align-items:baseline}',
      '.axa .it-props > .pk{color:var(--tx3)}',
      '.axa .it-props .dim{color:var(--tx3);font-size:11.5px}',
      '.axa .it-linha{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:var(--sf2);font-size:13px;text-decoration:none;color:var(--tx);min-width:0}',
      '.axa a.it-linha:hover{color:var(--tx);box-shadow:inset 0 0 0 1px var(--bd4)}',
      '.axa .it-dod{display:flex;gap:8px;align-items:baseline;font-size:13px;color:var(--tx3)}',
      '.axa .it-dod.ok{color:var(--ok-t)}',
      '.axa .it-msg{display:flex;gap:10px}',
      '.axa .it-msg.eu{justify-content:flex-end}',
      '.axa .it-bolha{max-width:72%;display:flex;flex-direction:column;gap:4px;padding:11px 14px;border-radius:14px;background:var(--sf2);border:1px solid var(--bd)}',
      '.axa .it-msg.eu .it-bolha{background:rgba(var(--ac-rgb),.1);border-color:rgba(var(--ac-rgb),.3)}',
      '.axa .it-bolha .t{font-size:13.5px;line-height:20px;color:var(--tx2b);white-space:pre-wrap;overflow-wrap:anywhere}',
      '.axa .it-mencao{color:var(--ac-t);font-weight:700}',
      '.axa .it-hist{display:flex;flex-direction:column;gap:6px;padding:12px 14px;border-radius:12px;background:var(--sf2);font-size:13px}',
      '.axa .it-mud{display:flex;flex-wrap:wrap;gap:6px;align-items:baseline;color:var(--tx2);line-height:19px}',
      '.axa .it-mud .c{font-weight:700;color:var(--tx)}',
      '.axa .it-mud .de{color:var(--tx3);text-decoration:line-through;overflow-wrap:anywhere}',
      '.axa .it-mud .para{color:var(--tx);overflow-wrap:anywhere}',
      '.axa .it{display:flex;flex-direction:column;gap:18px;min-width:0}',
      '.axa .it .chip{gap:4px}',
      // Desligado como no prototipo: cinza, e nao o laranja apagado.
      '.axa .it .btnp:disabled{background:var(--sf5);color:var(--tx3);box-shadow:none;opacity:1}',
      '@container app (max-width: 760px){.axa .it-bolha{max-width:88%}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── Leituras ─────────────────────────────────────────────────────────
  /** A demanda da rota: pelo codigo (como o link do Quadro) ou pelo id
   *  (o `hrefItem` usa o id quando a demanda ainda nao tem codigo). */
  function acha(param) {
    var p = String(param || '').trim();
    if (!p) return { m: null };
    var m = H.porCodigo(p) || H.visiveis().find(function (x) { return String(x.id) === p; }) || null;
    if (m) return { m: m };
    /* MESCLADA NAO E "NAO ENCONTRADA": ela existe e vive dentro de outra.
       Dizer onde ela foi parar poupa a pessoa de achar que o link quebrou. */
    var n = p.toUpperCase().replace(/-/g, '');
    var todas = ((AX.APP.D || {}).melhorias || []);
    var mesc = todas.find(function (x) {
      return x && (String(x.codigo || '').toUpperCase().replace(/-/g, '') === n || String(x.id) === p);
    });
    if (mesc && mesc.mesclado_em) {
      return { m: null, mesclada: mesc, principal: todas.find(function (x) { return x && x.id === mesc.mesclado_em; }) || null };
    }
    return { m: null };
  }

  function lista() { return ((AX.APP.D || {}).melhorias || []); }
  function porId(id) { return lista().find(function (x) { return x && x.id === id; }) || null; }
  function rotEtapa(k) { return (H.ETAPA_POR_ID[k] || {}).rotulo || k || '—'; }
  function feriadosISO() {
    return ((AX.APP.D || {}).feriados || []).map(function (f) { return f && typeof f === 'object' ? f.data : f; });
  }

  function podeAgir(m, papel) { return papel === 'admin' || papel === 'analista' || (papel === 'dev' && H.minha(m)); }

  /* A PROXIMA ETAPA no caminho do fluxo. Sustentacao pode pular a area com
     registro (homologacao.js), mas o caminho padrao — e o que a barra mostra —
     passa por ela. */
  function proxima(col) {
    var i = FLUXO.indexOf(col);
    return i >= 0 && i < FLUXO.length - 1 ? FLUXO[i + 1] : '';
  }

  /** O QUE IMPEDE A DEMANDA DE SEGUIR, cada linha com a regra de onde veio. */
  function travas(m, D) {
    var hoje = H.hoje();
    var col = H.colunaDe(m);
    var prox = proxima(col);
    var out = [];      // { cls, html, trava }
    var faltas = [];

    if (window.PAUSA) {
      var sit = PAUSA.situacao(m);
      if (sit === 'pausada') {
        var dp = window.PRAZO ? PRAZO.diasPausados(m, hoje) : 0;
        out.push({ cls: '', trava: true, html: 'Pausada desde ' + H.dma(m.pausado_em) + (dp ? ' (' + H.plural(dp, 'dia', 'dias') + ')' : '') +
          '; o prazo fica suspenso enquanto isso.' + (m.pausa_motivo ? ' Motivo: <b>' + H.esc(m.pausa_motivo) + '</b>' : '') });
      } else if (sit === 'aguardando') {
        var p = PAUSA.pedido(m);
        out.push({ cls: '', trava: false, html: 'Pedido de pausa de ' + H.dma(p.em) + (p.por ? ' (' + H.esc(p.por) + ')' : '') +
          ' aguardando o PM/PO.' + (p.motivo ? ' Motivo: <b>' + H.esc(p.motivo) + '</b>' : '') });
      }
    }

    if (window.VINCULO) {
      var abertos = VINCULO.abertos(lista(), m.id);
      if (abertos.length) {
        out.push({ cls: '', trava: true, html: 'Não avança enquanto ' + (abertos.length === 1 ? 'esta dependência estiver aberta' : 'estas dependências estiverem abertas') + ': ' +
          abertos.map(function (f) {
            return '<a href="' + H.hrefItem(f) + '" class="mono">' + H.esc(f.codigo || f.titulo) + '</a> (' + H.esc(rotEtapa(H.colunaDe(f))) + ')';
          }).join(', ') + '.' });
      }
    }

    if (prox) {
      if (window.SPRINTPO) {
        var ta = SPRINTPO.travaDeAlocacao(m, col, prox, hoje);
        if (ta && ta.trava) faltas.push(ta.motivo);
      }
      if (window.HOMOLOGACAO) {
        var hb = HOMOLOGACAO.barra(m, prox, hoje);
        if (hb) faltas.push(hb.motivo);
      }
      if (window.PREVOO) {
        // O retrato "depois" e a demanda ja na proxima etapa; o "antes" e ela
        // como esta. E a mesma pergunta que o admin faz antes de publicar.
        var depois = Object.assign({}, m, { status_planejamento: prox });
        PREVOO.presos({ temas: D.temas || [], melhorias: [depois], spike_aprovadores: D.spike_aprovadores || null },
                      { melhorias: [m] }).forEach(function (x) { faltas.push(x.motivo); });
      }
      if (faltas.length) {
        out.push({ cls: '', trava: true, html: 'Para ir a ' + H.esc(rotEtapa(prox)) + ' falta: ' +
          faltas.map(function (f) { return '<b>' + H.esc(f) + '</b>'; }).join(' ') });
      }
    }

    if (window.HOMOLOGACAO && HOMOLOGACAO.cobraHomologacao(m, hoje)) {
      var dA = HOMOLOGACAO.diasNaArea(m, hoje);
      out.push({ cls: '', trava: false, html: 'Há ' + H.plural(dA, 'dia', 'dias') + ' na Validação da área sem registro: falta dizer <b>quem homologou</b>' +
        (m.solicitante ? ' (o solicitante é ' + H.esc(m.solicitante) + ')' : '') + '.' });
    }

    if (col !== 'negada' && window.DEVOLUCAO && DEVOLUCAO.houve(m) && (col === 'planejado' || col === 'em_andamento')) {
      out.push({ cls: 'dg', trava: false, html: 'Devolvida pelo PM/PO: <b>' + H.esc(DEVOLUCAO.motivo(m)) + '</b>' });
    }

    if (!out.length && prox) out.push({ cls: 'ok', trava: false, html: 'Nada trava a ida para ' + H.esc(rotEtapa(prox)) + '.' });
    return { linhas: out, prox: prox, travada: out.some(function (x) { return x.trava; }) };
  }

  // ── Texto da demanda ─────────────────────────────────────────────────
  /* A SECAO DE CRITERIOS. Os titulos sao os do modelo (`modelo-descricao.js`,
     "6. CRITÉRIOS DE ACEITE"), e tambem vale a forma solta "Critérios de
     aceite:". Copia da leitura de `conteudoDaSecao`: linha "> " e orientacao
     do modelo, e nao conteudo. Candidata a modulo — o modelo-descricao.js
     injeta CSS e mexe em formulario, e por isso nao e carregado aqui. */
  function norm(t) {
    return String(t == null ? '' : t).normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toUpperCase().trim();
  }
  var TITULO_SECAO = /^\s*\d\.\s+[A-ZÀ-Ú][A-ZÀ-Ú\s]+$/;
  function separa(texto) {
    var linhas = String(texto || '').replace(/\r\n?/g, '\n').split('\n');
    var ini = -1;
    for (var i = 0; i < linhas.length; i++) {
      if (/^(\d\.\s*)?CRITERIOS DE ACEITE\s*:?\s*$/.test(norm(linhas[i]))) { ini = i; break; }
    }
    if (ini < 0) return { desc: String(texto || '').trim(), crit: [] };
    var fim = linhas.length;
    for (var j = ini + 1; j < linhas.length; j++) { if (TITULO_SECAO.test(linhas[j])) { fim = j; break; } }
    var crit = linhas.slice(ini + 1, fim)
      .filter(function (l) { return l.trim() && !/^\s*>/.test(l); })
      .map(function (l) { return l.replace(/^\s*([-*•]|\[\s*[xX]?\s*\])\s*/, '').trim(); })
      .filter(Boolean);
    var desc = linhas.slice(0, ini).concat(linhas.slice(fim)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return { desc: desc, crit: crit };
  }
  function descHTML(t) {
    return t.split('\n').map(function (l) {
      if (/^\s*>/.test(l)) return '<span style="color:var(--tx4)">' + H.esc(l) + '</span>';
      return TITULO_SECAO.test(l) ? '<b>' + H.esc(l) + '</b>' : H.esc(l);
    }).join('\n');
  }
  function critHTML(l) {
    return H.esc(l).replace(/(^|[\s,;(])(dado|quando|então|entao)(?=[\s,])/gi, '$1<b>$2</b>');
  }

  // ── Conversa e historico ─────────────────────────────────────────────
  function quando(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso || '—');
    var p = function (n) { return String(n).padStart(2, '0'); };
    var dia = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    var hora = p(d.getHours()) + ':' + p(d.getMinutes());
    var dd = H.dias(dia, H.hoje());
    return (dd === 0 ? 'hoje' : dd === 1 ? 'ontem' : H.dma(dia)) + ', ' + hora;
  }

  /* AS MENCOES, como a Mensageria faz (`comMencoes`, mensageria.html): o nome
     depois do @ so vira etiqueta se casar com uma pessoa conhecida. */
  function pessoas(m, D) {
    var set = {};
    (D.desenvolvedores || []).forEach(function (n) { if (n) set[n] = true; });
    (m.mensagens || []).forEach(function (g) { if (g && g.quem) set[g.quem] = true; });
    if (m.solicitante) set[m.solicitante] = true;
    return Object.keys(set).sort(function (a, b) { return b.length - a.length; });
  }
  function comMencoes(texto, ps) {
    return H.esc(texto).replace(/@([^\s@][^@\n]{0,40})/g, function (todo, depois) {
      var achou = ps.find(function (p) { return depois.toLowerCase().indexOf(p.toLowerCase()) === 0; });
      if (!achou) return todo;
      return '<span class="it-mencao">@' + depois.slice(0, achou.length) + '</span>' + depois.slice(achou.length);
    });
  }
  function ehEu(nome) {
    var e = AX.APP.eu || {};
    return !!nome && (nome === e.nome || H.meusNomes().indexOf(nome) >= 0);
  }
  function mensagens(m) {
    return (Array.isArray(m.mensagens) ? m.mensagens : []).filter(Boolean)
      .slice().sort(function (a, b) { return String(a.em || '').localeCompare(String(b.em || '')); });
  }
  function bolha(g, ps) {
    var eu = ehEu(g.quem);
    return '<div class="it-msg' + (eu ? ' eu' : '') + '">' + (eu ? '' : H.av(g.quem || '?', 30)) +
      '<div class="it-bolha"><span class="row" style="justify-content:space-between;gap:16px"><b style="font-size:12.5px">' + H.esc(g.quem || '(sem conta)') + '</b>' +
      '<span class="note" style="font-size:11px">' + H.esc(quando(g.em)) + '</span></span>' +
      '<span class="t">' + comMencoes(g.texto, ps) + '</span></div></div>';
  }

  /* OS ROTULOS DO HISTORICO. O servidor grava `rotulo` sem acento
     (`HIST_CAMPOS`, cloudflare-worker/worker.js); aqui ele ganha a grafia da
     tela, e o valor sai legivel (etapa pelo nome, data em dia/mes/ano, id
     de vinculo pelo codigo). Campo que nao esta aqui cai no rotulo do
     servidor. Candidato a modulo junto com o mapa do Worker. */
  var ROT_HIST = {
    status_planejamento: 'Etapa', resumo_entrega: 'Resumo da entrega', implementacao: 'O que foi implementado',
    horas_realizadas: 'Horas', entrega: 'Entrega (dev)', inicio: 'Início', dev: 'Responsável', poker_pontos: 'Pontos',
    mes_alvo: 'Mês', projeto_id: 'Projeto', titulo: 'Título', pausado_em: 'Pausa', concluido_em: 'Data de conclusão',
    link_issue: 'Issue', link_pr: 'PR', link_milestone: 'Milestone', versao: 'Versão', em_producao: 'Produção',
    parent_id: 'Vínculo', is_dependency: 'É dependência', prioridade: 'Prioridade', sprint: 'Sprint',
    sprint_po: 'Sprint do PM/PO', solicitante: 'Solicitante', tipo: 'Classificação', entrega_usuario: 'Entrega ao usuário',
    pausa_pedido: 'Pedido de pausa', pausa_motivo: 'Motivo da pausa', pausa_aprovada_por: 'Pausa aprovada por',
    tema_id: 'Sistema', descricao: 'Descrição'
  };
  function valorHist(campo, v) {
    if (v === undefined || v === null || v === '') return '(vazio)';
    if (typeof v === 'boolean') return v ? 'sim' : 'não';
    if (typeof v === 'object') return v.motivo ? String(v.motivo) : JSON.stringify(v);
    var t = String(v);
    if (campo === 'status_planejamento') return rotEtapa(t === 'deploy' ? 'concluido' : t);
    if (campo === 'parent_id') { var p = porId(t); return p ? (p.codigo || p.titulo) : t; }
    if (campo === 'projeto_id') { var pj = H.projeto(t); return pj ? (pj.codigo || pj.nome) : t; }
    if (campo === 'tema_id') return H.caminho(t) || t;
    if (campo === 'tipo') return (H.TIPOS[t] || {}).rotulo || t;
    if (campo === 'prioridade' && window.ORDEMKB) return ORDEMKB.rotulo({ prioridade: t });
    if (campo === 'sprint_po' && window.SPRINTPO) return SPRINTPO.rotuloCurto(t);
    if (t === 'true') return 'sim';
    if (t === 'false') return 'não';
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return H.dma(t);
    if (/^\d{4}-\d{2}-\d{2}T/.test(t)) return quando(t);
    return t;
  }
  function entradaHist(e) {
    var muds = (e.mudancas || []).map(function (c) {
      var cort = c.para_tam && String(c.para || '').length < c.para_tam ? ' <span class="note">(' + c.para_tam + ' caracteres)</span>' : '';
      return '<span class="it-mud"><span class="c">' + H.esc(ROT_HIST[c.campo] || c.rotulo || c.campo) + '</span>' +
        '<span class="de">' + H.esc(valorHist(c.campo, c.de)) + '</span>' + '<span style="color:var(--tx4)" aria-hidden="true">→</span>' +
        '<span class="para">' + H.esc(valorHist(c.campo, c.para)) + '</span>' + cort + '</span>';
    }).join('');
    if (e.anexos) muds += '<span class="it-mud"><span class="c">Anexos</span><span class="para">' + H.esc(e.anexos) + '</span></span>';
    return '<div class="it-hist"><span class="row" style="gap:8px;flex-wrap:wrap">' + H.av(e.quem || '?', 22) +
      '<b style="font-size:12.5px">' + H.esc(e.quem || '(sem conta)') + '</b>' +
      (e.origem ? '<span class="note" style="font-size:11.5px">· ' + H.esc(e.origem) + '</span>' : '') +
      '<span class="note" style="font-size:11.5px;margin-left:auto">' + H.esc(quando(e.em)) + '</span></span>' + muds + '</div>';
  }

  // ── Pedacos do Detalhe ───────────────────────────────────────────────
  function sec(titulo, corpo, direita) {
    return '<section class="it-sec">' +
      (direita ? '<div class="row" style="justify-content:space-between"><h2 class="it-h2">' + titulo + '</h2>' + direita + '</div>'
               : '<h2 class="it-h2">' + titulo + '</h2>') + corpo + '</section>';
  }

  function trilha(m) {
    var partes = [];
    var pj = m.projeto_id ? H.projeto(m.projeto_id) : null;
    if (pj) partes.push('<a href="#projeto/' + encodeURIComponent(pj.codigo || pj.id) + '">' + H.esc((pj.codigo ? pj.codigo + ' ' : '') + (pj.nome || '')) + '</a>');
    else partes.push('<a href="#quadro">Quadro</a>');
    if (window.VINCULO) {
      VINCULO.cadeiaAcima(lista(), m).reverse().forEach(function (p) {
        partes.push('<a href="' + H.hrefItem(p) + '">' + H.esc((p.codigo ? p.codigo + ' ' : '') + (p.titulo || '')) + '</a>');
      });
    }
    partes.push('<span class="mono" style="color:var(--tx2)">' + H.esc(m.codigo || '—') + '</span>');
    return '<nav aria-label="Caminho" class="it-trilha">' + partes.join('<span aria-hidden="true">›</span>') + '</nav>';
  }

  function chipsTopo(m) {
    var c = [];
    var t = H.TIPOS[m.tipo];
    if (t) c.push(H.chip(H.ico(t.ico) + ' ' + t.rotulo, 'bk'));
    if (H.etapaDe(m) === 'atrasado') {
      var a = H.atrasoDe(m);
      c.push(H.chip('atrasada' + (a > 0 ? ' ' + H.plural(a, 'dia', 'dias') : ''), 'dg'));
    } else if (!H.pausada(m) && window.PRAZO && !PRAZO.relogioParou(H.colunaDe(m))) {
      var pz = H.prazoDe(m), d = pz ? H.dias(H.hoje(), pz) : null;
      if (d === 0) c.push(H.chip('vence hoje', 'dg'));
      else if (d === 1) c.push(H.chip('vence amanhã', 'wn'));
    }
    if (H.pausada(m)) c.push(H.chip(H.ico('pause') + ' Pausada', 'mg'));
    var pr = String(m.prioridade || '').toLowerCase();
    if (pr && window.ORDEMKB) c.push(H.chip('Prioridade ' + ORDEMKB.rotulo(m).toLowerCase(), pr === 'alta' ? 'wn' : 'bk'));
    if (window.SPRINTPO && SPRINTPO.ehPrioritariaDaSprint(m)) c.push(H.chip(H.ico('zap') + ' Prioritária da sprint', 'ac'));
    if (m.dados_bi) c.push(H.chip(H.ico('chart') + ' Dados/BI', 'in'));
    else if (m.sales_ops) c.push(H.chip(H.ico('trend') + ' Sales Ops', 'in'));
    if (m.spike) c.push(H.chip(H.ico('search') + ' Spike', 'in'));
    if (m.debito_tecnico) c.push(H.chip('Débito técnico', 'pu'));
    if (m.destaque) c.push(H.chip(H.ico('star') + ' Destaque', 'ac'));
    return c.join('');
  }

  function acoes(m, ctx, tv) {
    if (!podeAgir(m, ctx.papel)) return '';
    var AC = window.AXIS_ACOES;
    if (!AC) return '';
    var col = H.colunaDe(m);
    var b = AC.disponiveis(m).map(function (d) {
      return AC.botao(d.acao, m, d.rotulo, d.cls, { ico: d.ico, titulo: d.titulo });
    });
    if (ctx.papel === 'admin' && col === 'planning' && !H.pontosDe(m)) {
      b.push('<a class="btn" href="poker.html" title="Abre o Planning Poker">' + H.ico('cards') + ' Estimar no Poker ' + H.ico('external', 'style="font-size:12px;color:var(--tx4)"') + '</a>');
    }
    var trava = { desligado: tv.travada, descrito: tv.travada ? 'it-trava' : '', titulo: tv.travada ? 'Veja abaixo o que falta' : '' };
    /* O BOTAO PRINCIPAL. Na validacao do PM/PO e a decisao (devolver ou
       validar e fechar); para o dev, entregar E o avanco de Em andamento e da
       area — um botao so para o mesmo gesto; no resto, o proximo passo do
       fluxo, desligado quando algo trava (o motivo vem logo abaixo). */
    if (ctx.papel === 'admin' && col === 'validacao') {
      b.push(AC.botao('devolver', m, 'Devolver com motivo', 'btn perigo', { ico: 'undo' }));
      b.push(AC.botao('validar', m, 'Validar e fechar', 'btnp ok', { ico: 'check' }));
    } else if (ctx.papel === 'dev' && (col === 'em_andamento' || col === 'validacao_area')) {
      b.push(AC.botao('entregar', m, col === 'em_andamento' ? 'Registrar entrega' : 'Enviar ao PM/PO', 'btnp',
        Object.assign({ ico: 'send', dados: { destino: tv.prox } }, trava)));
    } else if (ctx.papel === 'dev' && col === 'planejado') {
      b.push(AC.botao('mover', m, 'Começar', 'btnp', Object.assign({ dados: { destino: 'em_andamento' } }, trava)));
    } else if (tv.prox && ctx.papel !== 'dev') {
      b.push(AC.botao('mover', m, 'Mover para ' + rotEtapa(tv.prox), 'btnp', Object.assign({ dados: { destino: tv.prox } }, trava)));
    }
    return '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">' + b.join('') + '</div>';
  }

  function barraEtapas(m, tv) {
    var col = H.colunaDe(m);
    var i = FLUXO.indexOf(col);
    var seta = '<span class="it-seta" aria-hidden="true">›</span>';
    var passos = FLUXO.map(function (k, j) {
      var cls = col === 'negada' ? '' : j < i ? ' feito' : j === i ? ' atual' : '';
      return '<span class="it-passo' + cls + '"' + (j === i ? ' aria-current="step"' : '') + '>' + (j < i && col !== 'negada' ? H.ico('check') + ' ' : '') + H.esc(rotEtapa(k)) + '</span>';
    }).join(seta);
    if (col === 'negada') passos += seta + '<span class="it-passo neg" aria-current="step">' + H.ico('ban') + ' Negada</span>';
    var linhas = tv.linhas.map(function (l, n) {
      return '<span' + (n === 0 ? ' id="it-trava"' : '') + ' class="it-trava' + (l.cls ? ' ' + l.cls : '') + '">' + l.html + '</span>';
    }).join('');
    if (col === 'negada') {
      linhas = '<span id="it-trava" class="it-trava dg">Negada' + (window.DEVOLUCAO && DEVOLUCAO.houve(m) ? ': <b>' + H.esc(DEVOLUCAO.motivo(m)) + '</b>' : '.') + '</span>';
    }
    return '<div class="it-sec" style="padding:16px 18px;gap:10px"><div class="it-passos">' + passos + '</div>' + linhas + '</div>';
  }

  function props(m) {
    var hoje = H.hoje();
    var L = [];
    var row = function (k, v) { L.push('<span class="pk">' + k + '</span><span style="min-width:0">' + v + '</span>'); };
    row('Etapa', H.chipEtapa(m));
    row('Sistema', m.tema_id ? H.esc(H.caminho(m.tema_id)) : '<span class="dim">sem sistema</span>');
    var pts = H.pontosDe(m);
    var votado = m.poker_media != null && m.poker_media !== '';
    var fr = window.VINCULO ? VINCULO.frase(lista(), m) : '';
    row('Pontos', pts
      ? '<span class="mono">' + pts + '</span> <span class="dim mono">· ' + (votado ? 'Poker média ' + H.esc(m.poker_media) : 'estimativa, sem Poker') + '</span>'
      : '<span class="dim">sem pontos</span>' + (fr ? '' : ''));
    if (fr) row('Árvore', '<span class="dim" style="font-size:12.5px">' + H.esc(fr) + '</span>');
    var devs = H.devsDe(m);
    row('Responsável', devs.length ? devs.map(H.esc).join(' / ') : '<span class="dim">sem responsável</span>');
    row('Solicitante', m.solicitante ? H.esc(m.solicitante) : '<span class="dim">sem solicitante</span>');
    if (window.ORDEMKB) row('Prioridade', H.esc(ORDEMKB.rotulo(m)));
    var sp = window.SPRINTPO ? SPRINTPO.doPO(m) : '';
    row('Sprint', sp ? '<span title="' + H.esc(sp) + '">' + H.esc(SPRINTPO.rotuloCurto(sp)) + '</span>' +
      (SPRINTPO.entrouAtrasada(m) ? ' <span class="dim">· veio de ' + H.esc(SPRINTPO.rotuloCurto(SPRINTPO.sprintDeOrigem(m) || '')) + '</span>' : '')
      : '<span class="dim">fora de sprint</span>');
    if (m.inicio) row('Início', H.esc(H.dma(m.inicio)));
    var pz = H.prazoDe(m);
    var dp = window.PRAZO ? PRAZO.diasPausados(m, hoje) : 0;
    var a = H.etapaDe(m) === 'atrasado' ? H.atrasoDe(m) : 0;
    row('Prazo', pz ? H.esc(H.dma(pz)) + (H.pausada(m) ? ' <span class="dim">· suspenso pela pausa</span>' : dp ? ' <span class="dim">· +' + dp + 'd de pausa</span>' : '') +
      (a > 0 ? ' <span style="color:var(--dg-t);font-size:11.5px">· ' + a + 'd de atraso</span>' : '')
      : '<span class="dim">sem prazo</span>');
    if (window.ENTREGAUSU) {
      var eu = ENTREGAUSU.data(m);
      var al = ENTREGAUSU.alerta(m);
      row('Entrega ao usuário', eu ? H.esc(H.dma(eu)) + (ENTREGAUSU.herdada(m) ? ' <span class="dim">· herdada da entrega do dev</span>' : '') +
        (al ? '<br><span style="color:var(--wn-t);font-size:11.5px">' + H.esc(al) + '</span>' : '')
        : '<span class="dim">não definida</span>');
    }
    var horas = Number(m.horas_realizadas);
    var hSub = window.SUBTAREFA ? SUBTAREFA.horasTotal(SUBTAREFA.lista(m)) : null;
    if (horas > 0 || hSub != null) row('Horas', '<span class="mono">' + (horas > 0 ? horas : hSub) + 'h</span>');
    if (m.criado_em) row('Criada em', H.esc(H.dma(m.criado_em)));
    if (m.concluido_em) row('Concluída em', H.esc(H.dma(m.concluido_em)));
    return '<section class="it-sec it-props">' + L.join('') + '</section>';
  }

  /* As referencias ao GitHub, como `refs` de links-github.js (que nao e
     carregado no AXIS: ele injeta CSS das telas antigas). So leitura. */
  function refsGithub(m) {
    var out = [];
    var TIPO = { issue: ['issues', '#'], pr: ['pull', 'PR #'], milestone: ['milestone', 'Milestone '] };
    ['issue', 'pr', 'milestone'].forEach(function (t) {
      var bruto = String(m['link_' + t] || '').trim();
      if (!bruto) return;
      (t === 'pr' ? bruto.split(/\s+/).filter(Boolean) : [bruto]).forEach(function (u) {
        var n = new RegExp('/' + TIPO[t][0] + '/(\\d+)').exec(u) || /\/(\d+)\/?$/.exec(u);
        var repo = /^https?:\/\/(?:www\.)?github\.com\/[^/]+\/([^/]+)\//i.exec(u);
        out.push({ url: u, rot: n ? TIPO[t][1] + n[1] : t.toUpperCase(), repo: repo ? repo[1] : '' });
      });
    });
    return out;
  }

  function lateral(m, ctx) {
    var h = props(m);
    var col = H.colunaDe(m);

    // CODIGO: o equivalente real do "PR #1912" do prototipo.
    var gh = refsGithub(m);
    if (gh.length || m.em_producao || m.versao) {
      h += sec('CÓDIGO', gh.map(function (r) {
        return '<a class="it-linha" href="' + H.esc(r.url) + '" target="_blank" rel="noopener noreferrer" title="' + H.esc(r.url) + '">' +
          '<span class="ell"><span class="mono">' + H.esc(r.rot) + '</span>' + (r.repo ? ' · ' + H.esc(r.repo) : '') + '</span>' + H.ico('external', 'style="color:var(--tx4)"') + '</a>';
      }).join('') + (m.em_producao || m.versao ? '<div class="it-linha"><span>Produção</span><span>' +
        (m.em_producao ? H.chip('no ar' + (m.producao_em ? ' desde ' + H.dm(m.producao_em) : ''), 'ok') : H.chip('fora do ar', 'bk')) +
        (m.versao ? ' <span class="mono" style="font-size:12px;color:var(--tx3)">' + H.esc(m.versao) + '</span>' : '') + '</span></div>' : ''));
    }

    // VINCULOS: a principal, e o que pendura nesta.
    if (window.VINCULO) {
      var L = [];
      var pai = VINCULO.paiDe(lista(), m);
      if (pai) L.push('<a class="it-linha" href="' + H.hrefItem(pai) + '" title="' + H.esc(pai.titulo || '') + '"><span>' +
        (VINCULO.bloqueia(m) ? 'É dependência de' : 'Parte de') + '</span><span class="code" style="font-size:13px">' + H.esc(pai.codigo || '—') + '</span></a>');
      VINCULO.filhosDe(lista(), m.id).forEach(function (f) {
        var trava = VINCULO.bloqueia(f) && !VINCULO.concluida(f);
        L.push('<a class="it-linha" href="' + H.hrefItem(f) + '" title="' + H.esc(f.titulo || '') + '"><span class="ell">' +
          (VINCULO.bloqueia(f) ? 'Depende de' : 'Inclui') + ' <span class="note">· ' + H.esc(rotEtapa(H.colunaDe(f))) + '</span></span>' +
          '<span class="code" style="font-size:13px;' + (trava ? 'color:var(--wn-c)' : '') + '">' + H.esc(f.codigo || '—') + '</span></a>');
      });
      h += sec('VÍNCULOS', L.length ? L.join('') : '<span class="note">Sem vínculos com outras demandas.</span>');
    }

    // ENTREGA: os carimbos reais do fluxo, no lugar da "Definition of done".
    var hom = window.HOMOLOGACAO ? HOMOLOGACAO.registro(m) : null;
    var dod = function (ok, txt) { return '<span class="it-dod' + (ok ? ' ok' : '') + '">' + H.ico(ok ? 'check' : 'circle', 'style="font-size:12px"') + '<span>' + txt + '</span></span>'; };
    var exigeArea = !window.HOMOLOGACAO || HOMOLOGACAO.ehEvolucao(m);
    h += sec('ENTREGA',
      dod(!!m.entregue_em, m.entregue_em ? 'Entregue pelo dev em ' + H.esc(H.dma(m.entregue_em)) : 'Entregue pelo dev') +
      dod(!!hom, hom ? 'Homologado por ' + H.esc(hom.quem) + (hom.em ? ' em ' + H.esc(H.dma(hom.em)) : '') : 'Homologado pela área' + (exigeArea ? '' : ' (opcional em sustentação, com registro)')) +
      dod(!!m.validado_por || col === 'concluido', m.validado_por ? 'Validado por ' + H.esc(m.validado_por) + (m.validado_em ? ' em ' + H.esc(H.dma(m.validado_em)) : '') : 'Validado pelo PM/PO') +
      dod(!!m.em_producao, m.em_producao ? 'Em produção' + (m.producao_por ? ' (' + H.esc(m.producao_por) + ')' : '') : 'Em produção'));

    var refs = window.REFERENCIA ? REFERENCIA.daDemanda(m) : [];
    if (refs.length) {
      h += sec('REFERÊNCIAS', refs.map(function (r) {
        return '<a class="it-linha" href="' + H.esc(r.url) + '" target="_blank" rel="noopener noreferrer" title="' + H.esc(r.url) + '"><span class="ell">' +
          H.esc(r.descricao) + '</span>' + H.ico('external', 'style="color:var(--tx4)"') + '</a>';
      }).join(''));
    }

    var anexos = (Array.isArray(m.anexos) ? m.anexos : []).filter(Boolean);
    if (anexos.length) {
      // O anexo abre daqui (`AXIS_ACOES.abrirAnexo`): baixa com a sessao e entrega pelo ANEXOTIPO.
      h += sec('ANEXOS', anexos.map(function (x, i) {
        return '<button type="button" class="it-linha" style="border:0;font:inherit;cursor:pointer;text-align:left;width:100%" data-axa-anexo="' + m.anexos.indexOf(x) + '" data-axa-id="' + H.esc(m.id) + '" title="Abrir ' + H.esc(x.nome || 'anexo') + '"><span class="ell">' + H.ico('clip', 'style="color:var(--tx3)"') + ' ' + H.esc(x.nome || x.chave || 'anexo') + '</span>' +
          (x.tamanho ? '<span class="note" style="font-size:11.5px">' + Math.max(1, Math.round(x.tamanho / 1024)) + ' KB</span>' : '') + '</button>';
      }).join(''));
    }

    var bis = window.BIS ? BIS.daDemanda(m) : [];
    if (bis.length) h += sec('BIs IMPACTADOS', '<div style="display:flex;flex-wrap:wrap;gap:6px">' + bis.map(function (b) { return H.chip(H.ico('chart') + ' ' + H.esc(b), 'in'); }).join('') + '</div>');

    return '<aside class="it-aside" style="display:flex;flex-direction:column;gap:16px;min-width:0">' + h + '</aside>';
  }

  function principal(m, ctx) {
    var sp = separa(m.descricao);
    var h = sec('DESCRIÇÃO', sp.desc ? '<p class="it-desc">' + descHTML(sp.desc) + '</p>' : '<span class="note">Sem descrição registrada.</span>');
    if (sp.crit.length) h += sec('CRITÉRIOS DE ACEITE', sp.crit.map(function (l) { return '<div class="it-crit">' + critHTML(l) + '</div>'; }).join(''));

    var subs = window.SUBTAREFA ? SUBTAREFA.lista(m) : [];
    var pg = window.SUBTAREFA ? SUBTAREFA.progresso(subs) : { total: 0 };
    h += sec('TASKS', subs.length ? subs.map(function (x) {
      var per = SUBTAREFA.periodo(x);
      return '<label class="it-task' + (x.feita ? ' feita' : '') + '"><input type="checkbox" disabled' + (x.feita ? ' checked' : '') + '>' +
        '<span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span class="t">' + H.esc(x.titulo) + '</span>' +
        (per || x.horas ? '<span class="note" style="font-size:11.5px">' + H.esc(per) + (per && x.horas ? ' · ' : '') + (x.horas ? H.esc(x.horas) + 'h' : '') + '</span>' : '') + '</span></label>';
    }).join('') : '<span class="note">Sem subtarefas. O dev quebra a demanda em passos no painel dele.</span>',
      pg.total ? '<span class="mono" style="font-size:12px;color:' + (pg.feitas === pg.total ? 'var(--ok-t)' : 'var(--tx3)') + '">' + pg.feitas + ' de ' + pg.total + '</span>' : '');

    // Um resumo da conversa, como no prototipo; a conversa inteira e a aba.
    var msgs = mensagens(m);
    var ps = pessoas(m, ctx.D);
    var hist = (Array.isArray(m.historico) ? m.historico : []).length;
    h += sec('CONVERSA',
      (msgs.length ? msgs.slice(-2).map(function (g) { return bolha(g, ps); }).join('') : '<span class="note">Nenhuma mensagem nesta demanda ainda.</span>') +
      '<a href="' + H.hrefItem(m) + '/conversa" class="note">Ver a conversa' + (msgs.length ? ' (' + msgs.length + ')' : '') + ' e o histórico' + (hist ? ' (' + hist + ')' : '') + '</a>');
    return '<div style="display:flex;flex-direction:column;gap:16px;min-width:0">' + h + '</div>';
  }

  function detalhe(m, ctx) {
    var tv = travas(m, ctx.D);
    return trilha(m) +
      '<header style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:16px">' +
      '<div style="display:flex;flex-direction:column;gap:8px;max-width:760px;min-width:0">' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">' + chipsTopo(m) + '</div>' +
      '<h1 class="h1" style="font-size:26px;line-height:32px;overflow-wrap:anywhere">' + H.esc(m.titulo || '(sem título)') + '</h1></div>' +
      acoes(m, ctx, tv) + '</header>' +
      barraEtapas(m, tv) +
      '<div class="grid" style="grid-template-columns:minmax(0,1fr) 340px;gap:20px;align-items:start">' +
      principal(m, ctx) + lateral(m, ctx) + '</div>';
  }

  // ── Aba Conversa ─────────────────────────────────────────────────────
  function conversa(m, ctx) {
    var msgs = mensagens(m);
    var ps = pessoas(m, ctx.D);
    var quem = [];
    msgs.forEach(function (g) { if (g.quem && quem.indexOf(g.quem) < 0) quem.push(g.quem); });
    var ref = m.codigo || m.id;
    var hrefMsg = 'mensageria.html?codigo=' + encodeURIComponent(ref);
    var hist = (Array.isArray(m.historico) ? m.historico : []).filter(Boolean).slice()
      .sort(function (a, b) { return String(b.em || '').localeCompare(String(a.em || '')); });
    var anexos = (Array.isArray(m.anexos) ? m.anexos : []).filter(Boolean);
    var eu = window.ENTREGAUSU ? ENTREGAUSU.data(m) : '';

    var h = '<header style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px">' +
      '<div style="display:flex;flex-direction:column;gap:6px;min-width:0"><span class="note"><a href="' + H.hrefItem(m) + '">' + H.esc(m.codigo || '—') + '</a> › Conversa</span>' +
      '<h1 class="h1" style="font-size:24px;overflow-wrap:anywhere">' + H.esc(m.titulo || '(sem título)') + '</h1>' +
      '<span class="sub">Conversa do item com o PM/PO, o solicitante e o time, e tudo o que mudou nele.</span></div>' +
      '<div class="row" style="flex-wrap:wrap">' + (quem.length ? '<span class="row" style="gap:4px">' + quem.slice(0, 6).map(function (n) { return H.av(n); }).join('') + '</span>' : '') +
      '<a class="btn" href="' + hrefMsg + '" data-mensageria="' + H.esc(ref) + '" title="Abre a Mensageria desta demanda, onde se escreve e responde">' + H.ico('message') + ' Abrir na mensageria ' +
      H.ico('external', 'style="font-size:12px;color:var(--tx4)"') + '</a></div></header>';

    h += '<div class="grid" style="grid-template-columns:minmax(0,1fr) 300px;align-items:start">' +
      '<div style="display:flex;flex-direction:column;gap:16px;min-width:0">' +
      '<section class="pn" style="gap:14px"><span class="lab">MENSAGENS' + (msgs.length ? ' · ' + msgs.length : '') + '</span>' +
      (msgs.length ? msgs.map(function (g) { return bolha(g, ps); }).join('') : H.vazio('message', 'Nenhuma mensagem ainda', 'A conversa desta demanda começa na Mensageria.')) +
      '<div class="note" style="padding:10px 12px;border-radius:11px;border:1px dashed var(--bd4)">Para escrever ou responder, use a ' +
      '<a href="' + hrefMsg + '" data-mensageria="' + H.esc(ref) + '">Mensageria</a>: a conversa ainda se escreve lá. Use @ para mencionar alguém.</div></section>' +
      '<section class="pn" style="gap:10px"><span class="lab">HISTÓRICO' + (hist.length ? ' · ' + hist.length : '') + '</span>' +
      (hist.length ? '<span class="note">Mais recente primeiro. O servidor guarda as 25 últimas alterações de cada demanda.</span>' + hist.map(entradaHist).join('')
        : '<span class="note">Nenhuma alteração registrada nesta demanda.</span>') +
      (m.criado_em ? '<div class="it-hist"><span class="row" style="gap:8px"><b style="font-size:12.5px">Demanda criada</b><span class="note" style="font-size:11.5px;margin-left:auto">' + H.esc(H.dma(m.criado_em)) + '</span></span>' +
        '<span class="it-mud">' + (m.solicitante ? 'Pedida por <b>' + H.esc(m.solicitante) + '</b>' : 'Sem solicitante registrado') + '</span></div>' : '') +
      '</section></div>';

    h += '<section class="pn" style="gap:10px"><span class="lab">NESTE ITEM</span>' +
      '<span class="row" style="justify-content:space-between;font-size:13px;flex-wrap:wrap"><span class="note">Etapa</span><span>' + H.chipEtapa(m) + '</span></span>' +
      '<span class="row" style="justify-content:space-between;font-size:13px"><span class="note">Entrega ao usuário</span><span>' + (eu ? H.esc(H.dma(eu)) : '—') + '</span></span>' +
      '<span class="row" style="justify-content:space-between;font-size:13px"><span class="note">Responsável</span><span class="ell">' + (H.devsDe(m).map(H.esc).join(' / ') || '—') + '</span></span>' +
      '<span class="row" style="justify-content:space-between;font-size:13px"><span class="note">Solicitante</span><span class="ell">' + H.esc(m.solicitante || '—') + '</span></span>' +
      '<span class="lab" style="margin-top:8px">ANEXOS DA DEMANDA</span>' +
      (anexos.length ? '<div style="display:flex;flex-wrap:wrap;gap:6px">' + anexos.map(function (x) { return H.chip(H.ico('clip') + ' ' + H.esc(x.nome || 'anexo'), 'bk'); }).join('') + '</div>'
        : '<span class="note">Nenhum anexo.</span>') +
      '</section></div>';
    return h;
  }

  // ── Registro ─────────────────────────────────────────────────────────
  /* Le o ultimo segmento como aba (#item/AX-1/conversa) e devolve as abas com
     o link de cada uma. Acerta `r` no lugar: o nucleo monta o `ctx` depois. */
  function lerAba(r) {
    if (r.__itemLida) return;
    var seg = String(r.param || '').split('/');
    var ult = seg[seg.length - 1];
    if (seg.length > 1 && ABAS.indexOf(ult) >= 0) { r.aba = ult; r.param = seg.slice(0, -1).join('/'); }
    else { r.aba = 'detalhe'; r.param = seg.join('/'); }
    r.__itemLida = true;
  }

  AX.tela({
    id: 'item',
    rotulo: 'Item',
    papeis: ['admin', 'dev'],
    param: true,
    abasDe: function (r) {
      lerAba(r);
      var a = acha(r.param);
      if (!a.m) return [];
      var base = '#item/' + encodeURIComponent(a.m.codigo || a.m.id);
      var n = mensagens(a.m).length;
      return [{ id: 'detalhe', rotulo: 'Detalhe', href: base },
              { id: 'conversa', rotulo: 'Conversa', href: base + '/conversa', n: n || null }];
    },
    titulo: function (r) {
      lerAba(r);
      var a = acha(r.param);
      return a.m ? (a.m.codigo || 'Item') + (r.aba === 'conversa' ? ' · Conversa' : '') : 'Item';
    },
    render: function (el, ctx) {
      css();
      lerAba(ctx.rota);
      var a = acha(ctx.rota.param);
      var volta = '<a class="btn" href="#quadro">Voltar ao Quadro</a>';
      if (!a.m && a.mesclada) {
        return '<div class="pn">' + H.vazio('link', (a.mesclada.codigo || 'Esta demanda') + ' foi mesclada',
          a.principal ? 'Ela agora vive dentro de ' + (a.principal.codigo || '') + ' · ' + (a.principal.titulo || '') + '.' : 'Ela saiu do fluxo e vive dentro de outra demanda.',
          '<div class="row" style="flex-wrap:wrap;justify-content:center">' + (a.principal ? '<a class="btnp" href="' + H.hrefItem(a.principal) + '">Abrir ' + H.esc(a.principal.codigo || 'a principal') + '</a>' : '') + volta + '</div>') + '</div>';
      }
      if (!a.m) {
        return '<div class="pn">' + H.vazio('search', 'Item não encontrado',
          ctx.rota.param ? 'Nenhuma demanda com o código ' + ctx.rota.param + ' na base.' : 'O endereço não diz qual demanda abrir.', volta) + '</div>';
      }
      return '<div class="it">' + (ctx.rota.aba === 'conversa' ? conversa(a.m, ctx) : detalhe(a.m, ctx)) + '</div>';
    },
    depois: function (el) {
      /* A Mensageria abre em JANELA, como mensageria-abrir.js faz: so assim a
         janela nova herda a sessao (copia do sessionStorage). O href fica como
         reserva para quem abre em aba nova pelo menu do navegador. */
      el.addEventListener('click', function (e) {
        var a = e.target.closest('[data-mensageria]');
        if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
        e.preventDefault();
        var ref = a.getAttribute('data-mensageria');
        var j = window.open('mensageria.html?codigo=' + encodeURIComponent(ref), 'mensageria-' + ref.replace(/[^A-Za-z0-9_-]/g, ''), 'width=900,height=760');
        if (!j) H.toast('O navegador bloqueou a janela da Mensageria. Libere as janelas para este site.', 'erro');
        else try { j.focus(); } catch (_) { /* a janela abriu */ }
      });
    }
  });
})();
