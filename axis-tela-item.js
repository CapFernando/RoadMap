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
   o principal. Estimar leva a tela de Poker do app (#poker).

   OS GESTOS DO PAINEL DO DEV TAMBEM GRAVAM DAQUI (axis-acoes.js): pegar da
   fila do time, as subtarefas (TASKS), corrigir a entrega com o PM/PO, o
   parecer do Grill, vincular demanda, as referencias do GitHub e anexar —
   cada um com o patch do dev.html. A CONVERSA ESCREVE: a mensagem vai pela
   rota `mensagem-nova`, com @ para marcar alguem e anexo pelo `anexo-subir`,
   como na mensageria.html.

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
      '.axa .it-cu{box-sizing:border-box;width:100%;min-height:260px;padding:12px 14px;border-radius:12px;border:1px solid var(--bd2);background:var(--sf2);color:var(--tx);font-family:var(--font-mono);font-size:12.5px;line-height:20px;resize:vertical}',
      '.axa .it-cu[readonly]{color:var(--tx2)}',
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
      '.axa .it textarea.in{height:auto;min-height:84px;padding:10px 14px;line-height:20px;resize:vertical;display:block;width:100%;box-sizing:border-box}',
      '.axa .it-sub{display:flex;flex-wrap:wrap;gap:7px;align-items:center}',
      '.axa .it-sub input[type=checkbox]{accent-color:var(--ac);width:16px;height:16px;flex:0 0 auto;margin:0}',
      '.axa .it-sub .in{height:34px;font-size:13px}',
      '.axa .it-sub .it-sub-t{flex:1 1 160px;min-width:0}',
      '.axa .it-sub.feita .it-sub-t{text-decoration:line-through;color:var(--tx3)}',
      '.axa .it-sub .it-sub-d{flex:0 0 150px;min-width:0}',
      '.axa .it-sub .it-sub-h{flex:0 0 76px;min-width:0}',
      '.axa .it-grill{border-color:rgba(var(--wn-rgb),.45)}',
      '.axa .it-grill-ja{display:flex;flex-direction:column;gap:4px;padding:10px 12px;border-radius:10px;background:var(--sf2);font-size:13px;color:var(--tx2)}',
      '.axa .it-grill-ja b{font-size:12px;color:var(--tx3)}',
      '.axa .it-escrever{display:flex;flex-direction:column;gap:8px;padding-top:12px;border-top:1px solid var(--bd)}',
      '.axa .it-sug{position:absolute;left:0;bottom:100%;margin:0 0 6px;padding:4px;list-style:none;min-width:220px;max-height:240px;overflow:auto;border-radius:12px;background:var(--sf3);border:1px solid var(--bd2);box-shadow:0 12px 28px rgba(0,0,0,.25);z-index:5}',
      '.axa .it-sug li{padding:7px 10px;border-radius:8px;font-size:13px;cursor:pointer}',
      '.axa .it-sug li[aria-selected="true"]{background:var(--sf5);color:var(--tx-hi)}',
      '.axa .it-tira{border:0;background:transparent;color:var(--tx3);cursor:pointer;padding:0;display:inline-flex}',
      '.axa .it-tira:hover{color:var(--dg-t)}',
      '.axa .it-erro{font-size:12.5px;color:var(--dg-t)}',
      '.axa .it-erro:empty{display:none}',
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

  function podeAgir(m, papel) {
    if (papel === 'admin' || papel === 'analista' || (papel === 'dev' && H.minha(m))) return true;
    // A fila do time: o dev nao e dono, mas pode pegar (`AXIS_ACOES.botaoPegar`).
    var AC = window.AXIS_ACOES;
    return papel === 'dev' && !!AC && !!AC.botaoPegar(m);
  }
  function permite(acao, m, a) { var AC = window.AXIS_ACOES; return !!(AC && AC.permite && AC.permite(acao, m, a)); }

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
    var AC = window.AXIS_ACOES;
    if (AC && AC.marcaDono) c.push(AC.marcaDono(m));
    var t = H.TIPOS[m.tipo];
    if (t) c.push(H.chip(H.ico(t.ico) + ' ' + t.rotulo, 'bk'));
    if (window.GRILL && GRILL.pendente(m) && ['concluido', 'negada'].indexOf(H.colunaDe(m)) < 0) c.push(H.chip(H.ico('flame') + ' Grill — parecer pendente', 'wn', 'O PM/PO pediu o parecer do time antes do planejamento.'));
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
    c.push(H.chipsReq(m));
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
      b.push('<a class="btn" href="#poker" title="Abre o Planning Poker do app">' + H.ico('cards') + ' Estimar no Poker</a>');
    }
    var pega = ctx.papel === 'dev' && !H.minha(m) ? AC.botaoPegar(m) : '';
    // Mesclar (`mescAbrirBusca` do editor do admin): a outra entra nesta e sai do fluxo.
    if (H.pode('editar') && AC.REGRAS.mesclar) b.push(AC.botao('mesclar', m, 'Mesclar outra nesta', 'btn', { ico: 'link', titulo: 'Duas pessoas pediram a mesma coisa: a outra entra nesta e sai do fluxo, sem ser apagada' }));
    var trava = { desligado: tv.travada, descrito: tv.travada ? 'it-trava' : '', titulo: tv.travada ? 'Veja abaixo o que falta' : '' };
    /* O BOTAO PRINCIPAL. Na validacao do PM/PO e a decisao (devolver ou
       validar e fechar); para o dev, entregar E o avanco de Em andamento e da
       area — um botao so para o mesmo gesto; no resto, o proximo passo do
       fluxo, desligado quando algo trava (o motivo vem logo abaixo). */
    if (pega) {
      // A FILA DO TIME: pegar e o avanco, e o nome de quem pegou vai junto.
      b.push(pega);
    } else if (ctx.papel === 'admin' && col === 'validacao') {
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
    if (window.REQUISITOS) {
      row('Impacto', REQUISITOS.rotuloImpacto(m.impacto) ? H.esc(REQUISITOS.rotuloImpacto(m.impacto)) : '<span class="dim">não informado</span>');
      row('Urgência', REQUISITOS.rotuloUrgencia(m.urgencia) ? H.esc(REQUISITOS.rotuloUrgencia(m.urgencia)) : '<span class="dim">não informada</span>');
    }
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
    var AC = window.AXIS_ACOES;
    var podeRef = !!AC && permite('referencias', m, {});
    if (gh.length || m.em_producao || m.versao || podeRef) {
      h += sec('CÓDIGO', (gh.length || m.em_producao || m.versao ? '' : '<span class="note">Sem issue, PR ou milestone.</span>') + gh.map(function (r) {
        return '<a class="it-linha" href="' + H.esc(r.url) + '" target="_blank" rel="noopener noreferrer" title="' + H.esc(r.url) + '">' +
          '<span class="ell"><span class="mono">' + H.esc(r.rot) + '</span>' + (r.repo ? ' · ' + H.esc(r.repo) : '') + '</span>' + H.ico('external', 'style="color:var(--tx4)"') + '</a>';
      }).join('') + (m.em_producao || m.versao ? '<div class="it-linha"><span>Produção</span><span>' +
        (m.em_producao ? H.chip('no ar' + (m.producao_em ? ' desde ' + H.dm(m.producao_em) : ''), 'ok') : H.chip('fora do ar', 'bk')) +
        (m.versao ? ' <span class="mono" style="font-size:12px;color:var(--tx3)">' + H.esc(m.versao) + '</span>' : '') + '</span></div>' : ''),
        podeRef ? AC.botao('referencias', m, 'Editar', 'btns', { ico: 'edit', titulo: 'Issue, PR e milestone no GitHub' }) : '');
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
      h += sec('VÍNCULOS', L.length ? L.join('') : '<span class="note">Sem vínculos com outras demandas.</span>',
        AC && permite('vincular', m, {}) ? AC.botao('vincular', m, 'Vincular', 'btns', { ico: 'plus', titulo: 'Pendura nesta uma parte (vinculada) ou uma dependência' }) : '');
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
    var podeAnexar = !!AC && permite('anexar', m, { novos: [{ nome: '-' }] });
    if (anexos.length || podeAnexar) {
      // O anexo abre daqui (`AXIS_ACOES.abrirAnexo`): baixa com a sessao e entrega pelo ANEXOTIPO.
      h += sec('ANEXOS', (anexos.length ? '' : '<span class="note">Nenhum anexo. Até 1,5 MB por arquivo.</span>') + anexos.map(function (x, i) {
        return '<button type="button" class="it-linha" style="border:0;font:inherit;cursor:pointer;text-align:left;width:100%" data-axa-anexo="' + m.anexos.indexOf(x) + '" data-axa-id="' + H.esc(m.id) + '" title="Abrir ' + H.esc(x.nome || 'anexo') + '"><span class="ell">' + H.ico('clip', 'style="color:var(--tx3)"') + ' ' + H.esc(x.nome || x.chave || 'anexo') + '</span>' +
          (x.tamanho ? '<span class="note" style="font-size:11.5px">' + Math.max(1, Math.round(x.tamanho / 1024)) + ' KB</span>' : '') + '</button>';
      }).join(''), podeAnexar ? botaoArquivo('data-axa-anexar="' + H.esc(m.id) + '"', 'Anexar', 'btns') : '');
    }

    /* AS MESCLADAS NESTA (`mescRenderBloco` do admin): saem do fluxo e vivem
       aqui dentro, com quem pediu; "Separar" devolve ao fluxo. */
    var AC = window.AXIS_ACOES;
    var mescs = AC && AC.mescladasDe ? AC.mescladasDe(lista(), m.id) : [];
    if (mescs.length) {
      h += sec('MESCLADAS NESTA', mescs.map(function (f) {
        return '<div class="it-linha"><span class="ell" title="' + H.esc(f.titulo || '') + '"><span class="code" style="font-size:12.5px">' + H.esc(f.codigo || '—') + '</span> ' +
          H.esc(f.titulo || '') + '<span class="note" style="display:block;font-size:11.5px">' + (f.solicitante ? 'Pedido por ' + H.esc(f.solicitante) : 'Sem solicitante') +
          (f.criado_em ? ' · ' + H.esc(H.dma(String(f.criado_em).slice(0, 10))) : '') + '</span></span>' +
          (H.pode('editar') ? AC.botao('separar', f, 'Separar', 'btns', { titulo: 'Volta para o fluxo no estágio em que estava' }) : '') + '</div>';
      }).join(''));
    }

    var bis = window.BIS ? BIS.daDemanda(m) : [];
    if (bis.length) h += sec('BIs IMPACTADOS', '<div style="display:flex;flex-wrap:wrap;gap:6px">' + bis.map(function (b) { return H.chip(H.ico('chart') + ' ' + H.esc(b), 'in'); }).join('') + '</div>');

    return '<aside class="it-aside" style="display:flex;flex-direction:column;gap:16px;min-width:0">' + h + '</aside>';
  }

  /* O BOTAO DE ARQUIVO: um <label> com o <input type="file"> dentro, para o
     clique abrir o seletor do navegador sem JS. */
  function botaoArquivo(attrs, rotulo, cls) {
    var T = window.ANEXOTIPO;
    return '<label class="' + (cls || 'btns') + '" style="cursor:pointer" title="PDF, imagem e os formatos do ANEXOTIPO, até 1,5 MB">' + H.ico('clip') + ' ' + H.esc(rotulo) +
      '<input type="file" multiple hidden ' + attrs + (T ? ' accept="' + H.esc(T.aceita()) + '"' : '') + '></label>';
  }

  /* O CASO DE USO de "Em aprovacao de requisitos" — o painel `m-caso-uso` do
     editor do admin (`cuRender`): aparece na etapa, ou quando a demanda ja
     teve um. O Worker abre o caso de uso na entrada da etapa; aqui o PM/PO
     monta o texto, copia, imprime e registra envio, aprovacao ou ajustes
     (axis-acoes.js). Para os outros perfis, so a leitura. */
  function casoUso(m, ctx) {
    var R = window.REQUISITOS, AC = window.AXIS_ACOES;
    if (!R) return '';
    var naEtapa = String(m.status_planejamento || '') === R.ETAPA;
    var c = m.caso_uso && typeof m.caso_uso === 'object' ? m.caso_uso : null;
    if (!naEtapa && !c) return '';
    var st = R.ESTADOS[(c || {}).status] ? c.status : 'a_enviar';
    var pm = ctx.papel === 'admin' && !!AC;
    var texto = (c && c.texto) || (AC ? AC.textoCasoUso(m) : R.casoDeUso(m, { tema: H.tema(m.tema_id), hoje: H.hoje() }));
    var q = function (iso) { return iso ? H.dma(iso) : ''; };
    var info = c ? [
      c.gerado_em ? 'Entrou na etapa em ' + q(c.gerado_em) : '',
      c.enviado_em ? 'enviado em ' + q(c.enviado_em) + (c.enviado_por ? ' por ' + c.enviado_por : '') : '',
      c.respondido_em ? 'resposta em ' + q(c.respondido_em) + (c.respondido_por ? ' (' + c.respondido_por + ')' : '') : '',
      c.saiu_em ? 'saiu da etapa em ' + q(c.saiu_em) : ''
    ].filter(Boolean).join(' · ') : '';
    var bt = function (acao, rot, ico, cls) { return AC.botao(acao, m, rot, cls || 'btn', { ico: ico }); };
    return sec('CASO DE USO PARA APROVAÇÃO DO USUÁRIO',
      (info ? '<span class="note">' + H.esc(info) + '</span>' : '') +
      (c && c.resposta ? '<div class="lock">' + H.ico('edit') + '<span><b>Ajustes pedidos:</b> ' + H.esc(c.resposta) + '</span></div>' : '') +
      '<textarea class="it-cu" id="it-cu-texto" aria-label="Texto do caso de uso"' + (pm ? '' : ' readonly') + '>' + H.esc(texto) + '</textarea>' +
      (pm ? '<div class="row" style="flex-wrap:wrap;gap:8px">' +
        bt('casoUsoGerar', 'Gerar de novo', 'refresh') + bt('casoUsoCopiar', 'Copiar', 'clipboard') + bt('casoUsoImprimir', 'Imprimir / PDF', 'printer') +
        bt('casoUsoEnviado', 'Marquei como enviado', 'send') + bt('casoUsoAprovado', 'Usuário aprovou', 'check', 'btn') +
        bt('casoUsoAjustes', 'Usuário pediu ajustes', 'edit') + '</div>'
         : '<span class="note">Quem envia ao usuário e registra a resposta é o PM/PO.</span>'),
      H.chip(H.esc(R.ESTADOS[st]), H.CASO_USO_COR[st]));
  }

  // ── Grill: o parecer do dev (`msGrillRender`, dev.html) ──────────────
  function grillSec(m) {
    var G = window.GRILL, AC = window.AXIS_ACOES;
    if (!G || !AC) return '';
    var est = G.estado(m);
    if (est === 'nao') return '';
    var g = G.dados(m);
    var ja = g.pontos.length ? '<div class="it-grill-ja"><b>Já levantado</b>' + g.pontos.map(function (p) {
      return '<span>' + H.esc(p.texto) + (p.por ? ' <span class="note" style="font-size:11.5px">· ' + H.esc(p.por) + '</span>' : '') + '</span>';
    }).join('') + '</div>' : '';
    if (est !== 'pendente') {
      return sec('GRILL', '<span class="note">' + (est === 'ok' ? 'Respondido: entendido' : 'Respondido: devolvido com dúvidas') +
        (g.respondido_por ? ' por ' + H.esc(g.respondido_por) : '') + (g.respondido_em ? ' em ' + H.esc(H.dma(g.respondido_em.slice(0, 10))) : '') + '.</span>' + ja,
        H.chip(H.esc(G.rotulo(m)), est === 'ok' ? 'ok' : 'wn'));
    }
    if (['concluido', 'negada'].indexOf(H.colunaDe(m)) >= 0) {
      return sec('GRILL', '<span class="note">Marcado e sem parecer; a demanda já saiu do fluxo.</span>' + ja, H.chip('sem parecer', 'bk'));
    }
    if (!permite('grill', m, { veredito: 'duvida' })) {
      return sec('GRILL', '<span class="note">O PM/PO pediu o parecer do time antes de esta demanda entrar no planejamento. Quem responde é o dev, no Item.</span>' + ja,
        H.chip('aguardando parecer', 'wn'));
    }
    return '<section class="it-sec it-grill">' +
      '<div class="row" style="justify-content:space-between"><h2 class="it-h2">' + H.ico('flame') + ' GRILL — DÊ SEU PARECER</h2>' + H.chip('antes do planejamento', 'wn') + '</div>' +
      '<span class="note">Leia a demanda. Se faltar algo para estimar e executar, escreva os pontos — <b>uma dúvida por linha</b>. ' +
      'Ela volta para Em aprovação de requisitos com o que você perguntou. Se estiver claro, segue para o Planning.</span>' + ja +
      '<textarea class="in" id="it-grill-pontos" rows="3" aria-label="Suas dúvidas, uma por linha" placeholder="Ex.: De onde vem o valor do limite?&#10;O que acontece quando o cedente tem dois contratos?"></textarea>' +
      '<div class="row" style="flex-wrap:wrap;gap:8px;justify-content:flex-end">' +
      AC.botao('grillDuvida', m, 'Tenho dúvidas → Aprov. requisitos', 'btn', { ico: 'help' }) +
      AC.botao('grillOk', m, 'Entendi → Planning', 'btnp', { ico: 'check' }) + '</div></section>';
  }

  // ── TASKS: as subtarefas, editaveis por quem faz a demanda ──────────
  /* O MODAL DO dev.html, no Item: marcar, escrever, a data, as horas do
     passo, tirar e acrescentar. A lista em edicao fica em RASCUNHO ate
     "Salvar subtarefas" (o patch so leva `subtarefas`, como o modal so manda
     o campo quando mexeu). A data de INICIO do passo nao aparece: o
     `msSubParaGravar` do dev.html grava so `data` (o fim), e oferecer o
     inicio seria prometer o que nao se grava. */
  var RASCUNHO = {};
  function subsDe(m) {
    var r = RASCUNHO[m.id];
    return r ? r.lista : (window.SUBTAREFA ? SUBTAREFA.lista(m) : []);
  }
  function hojeLocal() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function tasksProgresso(subs) {
    var pg = window.SUBTAREFA ? SUBTAREFA.progresso(subs) : { total: 0 };
    return pg.total ? '<span class="mono" style="font-size:12px;color:' + (pg.feitas === pg.total ? 'var(--ok-t)' : 'var(--tx3)') + '">' +
      pg.feitas + ' de ' + pg.total + (pg.pct != null ? ' · ' + pg.pct + '%' : '') + '</span>' : '';
  }
  function tasksPe(m) {
    var subs = subsDe(m);
    var r = RASCUNHO[m.id];
    var tot = window.SUBTAREFA ? SUBTAREFA.horasTotal(subs) : null;
    return (tot != null ? '<span class="note">Somado dos passos: <b class="mono">' + tot + 'h</b>. Entra nas horas da demanda quando você registra a entrega.</span>' : '') +
      '<div class="row" style="flex-wrap:wrap;gap:8px"><button type="button" class="btns" data-it-sub="adiciona">' + H.ico('plus') + ' subtarefa</button>' +
      (r && r.mexido ? '<span style="flex:1"></span><button type="button" class="btn" data-it-sub="descarta">Descartar</button>' +
        '<button type="button" class="btnp" data-it-sub="salva"' + (r.salvando ? ' disabled' : '') + '>' + H.ico('save') + ' Salvar subtarefas</button>' : '') + '</div>';
  }
  function tasksInterno(m) {
    var subs = subsDe(m);
    var S = window.SUBTAREFA;
    var edita = permite('subtarefas', m, { lista: [] });
    var cab = '<div class="row" style="justify-content:space-between"><h2 class="it-h2">TASKS</h2><span id="it-tasks-pg">' + tasksProgresso(subs) + '</span></div>';
    if (!edita) {
      return cab + (subs.length ? subs.map(function (x) {
        var per = S.periodo(x);
        return '<label class="it-task' + (x.feita ? ' feita' : '') + '"><input type="checkbox" disabled' + (x.feita ? ' checked' : '') + '>' +
          '<span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span class="t">' + H.esc(x.titulo) + '</span>' +
          (per || x.horas ? '<span class="note" style="font-size:11.5px">' + H.esc(per) + (per && x.horas ? ' · ' : '') + (x.horas ? H.esc(x.horas) + 'h' : '') + '</span>' : '') + '</span></label>';
      }).join('') : '<span class="note">Sem subtarefas. Quem faz a demanda a quebra em passos.</span>');
    }
    var linhas = subs.map(function (x, i) {
      return '<div class="it-sub' + (x.feita ? ' feita' : '') + '" data-linha="' + i + '">' +
        '<input type="checkbox" data-it-sub="marca" data-i="' + i + '"' + (x.feita ? ' checked' : '') + ' aria-label="Passo ' + (i + 1) + ' feito">' +
        '<input class="in it-sub-t" data-it-sub="texto" data-i="' + i + '" maxlength="140" value="' + H.esc(x.titulo) + '" placeholder="O que é este passo" aria-label="Passo ' + (i + 1) + '">' +
        '<input class="in it-sub-d" type="date" data-it-sub="data" data-i="' + i + '" value="' + H.esc(x.fim || x.data || '') + '" title="Data de fim do passo" aria-label="Data do passo ' + (i + 1) + '">' +
        '<input class="in it-sub-h" type="number" min="0" step="0.25" data-it-sub="horas" data-i="' + i + '" value="' + H.esc(x.horas) + '" placeholder="h" title="Horas neste passo (de 15 em 15 min)" aria-label="Horas do passo ' + (i + 1) + '">' +
        '<button type="button" class="btns" data-it-sub="remove" data-i="' + i + '" title="Remover esta subtarefa" aria-label="Remover o passo ' + (i + 1) + '">' + H.ico('x') + '</button></div>';
    }).join('');
    return cab + (linhas || '<span class="note">Nenhuma subtarefa. Quebre a demanda em passos para acompanhar o quanto já andou.</span>') +
      '<div id="it-tasks-pe" style="display:flex;flex-direction:column;gap:8px">' + tasksPe(m) + '</div>';
  }

  /* Os editores dos passos (`msSubMarca`, `msSubTexto`, `msSubData`,
     `msSubHoras`, `msSubRemove`, `msSubAdiciona`) sao `AXIS_ACOES.SUB`. Digitar,
     marcar e trocar a data NAO redesenham a lista — o campo seguinte, que
     acabou de receber o foco, seria trocado por outro; so o rodape (o total e
     "Salvar") e o progresso se atualizam. Acrescentar e tirar redesenham. */
  function ligarTasks(el, m) {
    var AC = window.AXIS_ACOES;
    var box = el.querySelector('#it-tasks');
    if (!box || !AC || !AC.SUB) return;
    var atual = function () { return porId(m.id) || m; };
    var pinta = function (foco) {
      var b = document.getElementById('it-tasks');
      if (!b) return;
      b.innerHTML = tasksInterno(atual());
      if (foco) { var f = b.querySelector(foco); if (f) f.focus(); }
    };
    var rodape = function () {
      var pe = document.getElementById('it-tasks-pe'), pg = document.getElementById('it-tasks-pg');
      if (pe) pe.innerHTML = tasksPe(atual());
      if (pg) pg.innerHTML = tasksProgresso(subsDe(m));
    };
    var muda = function (lista) {
      var r = RASCUNHO[m.id] || (RASCUNHO[m.id] = { lista: subsDe(m) });
      r.lista = lista; r.mexido = true;
      rodape();
    };
    box.addEventListener('input', function (e) {
      var t = e.target.closest('[data-it-sub]');
      if (!t) return;
      var q = t.getAttribute('data-it-sub'), i = +t.getAttribute('data-i');
      if (q === 'texto') muda(AC.SUB.texto(subsDe(m), i, t.value));
      else if (q === 'horas') muda(AC.SUB.horas(subsDe(m), i, t.value));
    });
    box.addEventListener('change', function (e) {
      var t = e.target.closest('[data-it-sub]');
      if (!t) return;
      var q = t.getAttribute('data-it-sub'), i = +t.getAttribute('data-i');
      if (q === 'marca') {
        muda(AC.SUB.marca(subsDe(m), i, t.checked, hojeLocal()));
        var ln = t.closest('.it-sub');
        if (ln) ln.classList.toggle('feita', t.checked);
        var d = box.querySelector('[data-it-sub="data"][data-i="' + i + '"]');
        var x = subsDe(m)[i];
        if (d && x && !d.value) d.value = x.fim || x.data || '';
      } else if (q === 'data') {
        muda(AC.SUB.data(subsDe(m), i, t.value, 'fim'));
        if (window.SUBTAREFA && SUBTAREFA.periodoInvertido(subsDe(m)[i])) H.toast('Nesse passo o fim está antes do início — confira as datas.', 'erro');
      }
    });
    box.addEventListener('click', async function (e) {
      var t = e.target.closest('button[data-it-sub]');
      if (!t) return;
      var q = t.getAttribute('data-it-sub'), i = +t.getAttribute('data-i');
      if (q === 'adiciona') {
        muda(AC.SUB.adiciona(subsDe(m)));
        pinta('[data-it-sub="texto"][data-i="' + (subsDe(m).length - 1) + '"]');
      } else if (q === 'remove') { muda(AC.SUB.remove(subsDe(m), i)); pinta(); }
      else if (q === 'descarta') { delete RASCUNHO[m.id]; pinta(); }
      else if (q === 'salva') {
        var r = RASCUNHO[m.id];
        if (!r || r.salvando) return;
        r.salvando = true; t.disabled = true;
        var out = await AC.aplicar('subtarefas', atual(), { lista: r.lista });
        if (out && out.ok) delete RASCUNHO[m.id]; else r.salvando = false;
        pinta();
      }
    });
  }

  function principal(m, ctx) {
    var sp = separa(m.descricao);
    var h = sec('DESCRIÇÃO', sp.desc ? '<p class="it-desc">' + descHTML(sp.desc) + '</p>' : '<span class="note">Sem descrição registrada.</span>');
    h += casoUso(m, ctx);
    if (sp.crit.length) h += sec('CRITÉRIOS DE ACEITE', sp.crit.map(function (l) { return '<div class="it-crit">' + critHTML(l) + '</div>'; }).join(''));

    h += grillSec(m);
    h += '<section class="it-sec" id="it-tasks">' + tasksInterno(m) + '</section>';

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

  // ── Aba Conversa: escrever (mensageria.html) ─────────────────────────
  /* O RASCUNHO SOBREVIVE AO REDESENHO: a tela rele a base sozinha (foco depois
     de um minuto, gravacao de outra acao) e o texto digitado nao pode sumir. */
  var RASC_MSG = {};
  function rascMsg(m) { return RASC_MSG[m.id] || (RASC_MSG[m.id] = { texto: '', anexos: [], subindo: 0, enviando: false }); }
  function anexosRasc(r) {
    return r.anexos.map(function (a, i) {
      return '<span class="chip c-bk" style="gap:6px">' + H.ico('clip') + ' ' + H.esc(a.nome) +
        '<button type="button" class="it-tira" data-it-msg-tira="' + i + '" aria-label="Tirar ' + H.esc(a.nome) + '">' + H.ico('x') + '</button></span>';
    }).join('') + (r.subindo ? '<span class="note">Enviando ' + H.plural(r.subindo, 'arquivo', 'arquivos') + '…</span>' : '');
  }
  function compositor(m) {
    var AC = window.AXIS_ACOES;
    if (!AC || !AC.enviarMensagem) return '';
    var r = rascMsg(m);
    var podeAnexar = permite('anexar', m, { novos: [{ nome: '-' }] });
    return '<div class="it-escrever">' +
      '<label class="lab" for="it-msg">ESCREVER</label>' +
      '<div style="position:relative"><ul class="it-sug" id="it-sug" role="listbox" aria-label="Pessoas" hidden></ul>' +
      '<textarea class="in" id="it-msg" rows="3" placeholder="Escreva uma mensagem — use @ para marcar alguém" aria-autocomplete="list" aria-controls="it-sug" aria-describedby="it-msg-dica">' + H.esc(r.texto) + '</textarea></div>' +
      '<div class="row" id="it-msg-anx" style="flex-wrap:wrap;gap:6px">' + anexosRasc(r) + '</div>' +
      '<div class="row" style="flex-wrap:wrap;gap:10px">' +
      (podeAnexar ? botaoArquivo('id="it-msg-arq"', 'Anexar', 'btn') : '') +
      '<span class="note" id="it-msg-dica" style="flex:1;min-width:200px">A mensagem entra no registro da demanda e não pode ser apagada.' +
      (podeAnexar ? ' O anexo vai para os anexos da demanda.' : '') + ' Ctrl+Enter envia.</span>' +
      '<button type="button" class="btnp" id="it-msg-enviar"' + (r.enviando ? ' disabled' : '') + '>' + H.ico('send') + ' ' + (r.enviando ? 'Enviando…' : 'Enviar') + '</button></div>' +
      '<div class="it-erro" id="it-msg-erro" role="alert"></div></div>';
  }

  /* O `@` E O ENVIO (mensageria.html): seta anda, Enter ou Tab escolhe, Esc
     fecha. As pessoas e a regra da caixa sao `AXIS_ACOES.pessoasDaConversa` e
     `sugestoesArroba`, copias da mensageria. */
  function ligarCompositor(el, m) {
    var AC = window.AXIS_ACOES;
    var cx = el.querySelector('#it-msg');
    if (!cx || !AC) return;
    var sug = el.querySelector('#it-sug');
    var erro = el.querySelector('#it-msg-erro');
    var r = rascMsg(m);
    var PESSOAS = AC.pessoasDaConversa(AX.APP.D || {});
    var filtradas = [], ativo = 0, inicio = -1;
    function fecha() { sug.hidden = true; filtradas = []; inicio = -1; cx.removeAttribute('aria-activedescendant'); }
    function abre() {
      var s = AC.sugestoesArroba(cx.value, cx.selectionStart, PESSOAS);
      if (s.inicio < 0 || !s.nomes.length) { fecha(); return; }
      filtradas = s.nomes; inicio = s.inicio; ativo = 0;
      sug.innerHTML = filtradas.map(function (p, i) { return '<li id="it-sug-' + i + '" role="option" aria-selected="' + (i === 0) + '">' + H.esc(p) + '</li>'; }).join('');
      sug.hidden = false;
      cx.setAttribute('aria-activedescendant', 'it-sug-0');
    }
    function marca() {
      [].forEach.call(sug.children, function (li, i) { li.setAttribute('aria-selected', String(i === ativo)); });
      cx.setAttribute('aria-activedescendant', 'it-sug-' + ativo);
    }
    function escolhe(i) {
      if (!filtradas[i] || inicio < 0) return;
      var e = AC.escolheArroba(cx.value, inicio, cx.selectionStart, filtradas[i]);
      cx.value = e.texto; r.texto = e.texto;
      fecha(); cx.focus(); cx.setSelectionRange(e.cursor, e.cursor);
    }
    async function envia() {
      erro.textContent = '';
      if (r.subindo) { erro.textContent = 'Espere o anexo terminar de subir — enviar agora deixaria o arquivo de fora.'; return; }
      if (r.enviando) return;
      r.texto = cx.value;
      r.enviando = true;
      var b = el.querySelector('#it-msg-enviar');
      if (b) { b.disabled = true; b.textContent = 'Enviando…'; }
      var out;
      try { out = await AC.enviarMensagem(m, r.texto, r.anexos); }
      catch (e) { out = { ok: false, erro: e.message || String(e) }; }
      r.enviando = false;
      if (out && out.ok) {
        delete RASC_MSG[m.id];
        AX.desenhar(true);
        H.toast('Mensagem enviada.');
        var novo = document.getElementById('it-msg');
        if (novo) novo.focus();
        return;
      }
      // O redesenho da gravacao do anexo refez o compositor: a frase vai no de agora.
      var e2 = document.getElementById('it-msg-erro');
      var b2 = document.getElementById('it-msg-enviar');
      if (b2) { b2.disabled = false; b2.innerHTML = H.ico('send') + ' Enviar'; }
      if (e2) e2.textContent = (out && out.erro) || 'Não foi possível enviar.';
    }
    cx.addEventListener('input', function () { r.texto = cx.value; abre(); });
    cx.addEventListener('keydown', function (e) {
      if (!sug.hidden && filtradas.length) {
        if (e.key === 'ArrowDown') { e.preventDefault(); ativo = (ativo + 1) % filtradas.length; marca(); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); ativo = (ativo - 1 + filtradas.length) % filtradas.length; marca(); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); escolhe(ativo); return; }
        if (e.key === 'Escape') { e.preventDefault(); fecha(); return; }
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); envia(); }
    });
    cx.addEventListener('blur', function () { setTimeout(fecha, 120); });
    sug.addEventListener('mousedown', function (e) {
      var li = e.target.closest('li');
      if (!li) return;
      e.preventDefault();
      escolhe([].indexOf.call(sug.children, li));
    });
    var bt = el.querySelector('#it-msg-enviar');
    if (bt) bt.addEventListener('click', envia);
    var anx = el.querySelector('#it-msg-anx');
    function pintaAnexos() { var a = document.getElementById('it-msg-anx'); if (a) a.innerHTML = anexosRasc(r); }
    if (anx) anx.addEventListener('click', function (e) {
      var t = e.target.closest('[data-it-msg-tira]');
      if (!t) return;
      r.anexos.splice(+t.getAttribute('data-it-msg-tira'), 1);
      pintaAnexos();
    });
    var arq = el.querySelector('#it-msg-arq');
    if (arq) arq.addEventListener('change', function () {
      var fs = [].slice.call(arq.files || []);
      arq.value = '';
      fs.forEach(function (f) {
        r.subindo++;
        pintaAnexos();
        AC.subirAnexo(f).then(function (a) { r.anexos.push(a); }, function (e) {
          H.toast('Anexo "' + f.name + '" não subiu: ' + (e.message || e) + '. O texto segue; tente o anexo de novo.', 'erro');
        }).then(function () { r.subindo--; pintaAnexos(); });
      });
    });
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
      (msgs.length ? msgs.map(function (g) { return bolha(g, ps); }).join('') : H.vazio('message', 'Nenhuma mensagem ainda', 'Escreva abaixo para começar a conversa desta demanda.')) +
      compositor(m) + '</section>' +
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
    papeis: ['admin', 'analista', 'dev', 'consulta'],
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
          '<div class="row" style="flex-wrap:wrap;justify-content:center">' + (a.principal ? '<a class="btnp" href="' + H.hrefItem(a.principal) + '">Abrir ' + H.esc(a.principal.codigo || 'a principal') + '</a>' : '') +
          (H.pode('editar') && window.AXIS_ACOES && AXIS_ACOES.REGRAS.separar ? AXIS_ACOES.botao('separar', a.mesclada, 'Desfazer mesclagem', 'btn', { ico: 'undo' }) : '') + volta + '</div>') + '</div>';
      }
      if (!a.m) {
        return '<div class="pn">' + H.vazio('search', 'Item não encontrado',
          ctx.rota.param ? 'Nenhuma demanda com o código ' + ctx.rota.param + ' na base.' : 'O endereço não diz qual demanda abrir.', volta) + '</div>';
      }
      return '<div class="it">' + (ctx.rota.aba === 'conversa' ? conversa(a.m, ctx) : detalhe(a.m, ctx)) + '</div>';
    },
    depois: function (el, ctx) {
      var alvo = acha(((ctx || {}).rota || {}).param).m;
      if (alvo && ctx.rota.aba === 'conversa') ligarCompositor(el, alvo);
      if (alvo) ligarTasks(el, alvo);
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
