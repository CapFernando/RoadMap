/* ─────────────────────────────────────────────────────────────────────────
   AXIS — Quadro (prototipo: EP-013-axis/prototipo/fonte/Quadro.dc.html).

   O MESMO QUADRO DO ADMIN, LIDO COM O DESENHO DO PROTOTIPO. As colunas sao as
   etapas do admin (KB_COLS), na mesma ordem; o card mora na etapa GRAVADA
   (`ETAPA.gravada`) e o atraso e marca vermelha, nunca coluna — a mesma
   decisao registrada em admin.html ("'Atrasado' saiu da esteira").

   A ORDEM DENTRO DA COLUNA vem de `ordem-kanban.js` (prioridade, depois a data
   prometida), igual ao admin e ao painel do dev. Nenhuma ordenacao propria.

   O CARD ARRASTA ENTRE COLUNAS, como no Kanban do admin (`kbDrop`) e no
   painel do dev (`onDragOver` + `onDrop`). O que o gesto faz e
   `AXIS_ACOES.soltarEm`, por perfil: o PM/PO solta em qualquer coluna e as
   travas sao as do `mover` (responsavel, sprint, spike, homologacao, horas,
   nessa ordem); o dev so nas etapas dele, e a coluna fechada fica apagada
   ja durante o arraste, com o motivo. As validacoes do dev pedem a entrega
   (horas e o que foi implementado), Negada pede o motivo. No celular, onde
   arrastar nao serve, o card tem "Mover para…": o seletor unico de
   axis-acoes.js (`etapasDoSeletor`), o mesmo do Item.

   O CLIQUE NO CARD ABRE A DEMANDA POR CIMA DO QUADRO (o modal do admin, o
   `openStatusModal` do dev): uma gaveta com o Item inteiro, desenhado pela
   propria tela Item (`abrirItem`), sem trocar de pagina nem perder filtro e
   rolagem. A demanda em validacao abre ja na entrega. Ctrl ou Cmd + clique
   abre a pagina do Item, que continua sendo o link.

   NO CARD, alem do que o prototipo desenha: a faixa do motivo da devolucao
   (`DEVOLUCAO.faixa`, o mesmo texto do admin e do dev), o solicitante e a
   data de entrega do dev (o "🙋" e o "🏁" do admin), os anexos, o selo de
   validacao (`SELO.badges`), a estrela do destaque e, na Validacao PM/PO,
   Aprovar e Devolver (`valDecidirNoCard`), pelos gestos de axis-acoes.js.
   E ainda: os vinculos (a principal, as filhas que abrem na gaveta, "N dep.
   abertas", a soma da arvore, "Avanco bloqueado" e "+ Vincular", do
   `renderDepSection` do dev.html), a faixa e a borda do Grill pendente, as
   marcas Dados/BI e Sales Ops, o spike com as assinaturas ("2/3"), "sem
   pontuacao", inicio e estimativa, o projeto que abre o projeto, a cor da
   sprint do PO e, para o dono da sprint, o chip que repassa, move ou tira da
   sprint (`sprintEscolher`, o gesto `sprint` de axis-acoes.js).

   NA BARRA, alem do que ja havia: Producao e Dados/BI (`matchProducao` e
   `matchDados` do admin), o contador de cada coluna que abre o menu Tudo / No
   ar / Fora do ar / Em pausa (`kbProdMenu`) e o "Sprint em lote" do dono da
   sprint.

   A BUSCA (`matchBusca` do admin) procura no codigo (com e sem hifen), no
   titulo, na descricao, no dev e no solicitante, sem acento; como la, ela
   vence o filtro de periodo das concluidas e avisa da mesclada que achou.

   NO CELULAR o quadro mostra UMA ETAPA POR VEZ: abas das etapas com a
   contagem e deslize para o lado entre elas (scroll-snap). Os filtros
   recolhem em "Filtros (n)" (H.filtros), a busca fica a mao e os alertas
   viram uma linha so, que rola de lado.

   O QUE O PROTOTIPO TEM E A BASE NAO: limite de WIP por coluna, colunas de
   Code review / Testes / Em producao, epico EPI-, PR no card. Nada disso e
   inventado aqui — o card mostra o equivalente real (pontos do Poker, projeto
   EP-, sprint, subtarefas, "no ar").

   PARA O DEV, O QUE E DELE E O QUE E FILA (dev.html, 82bff39 e e5cace1): o
   card diz de quem e ("No seu nome", "Do time · com Fulano", "Fila do time ·
   sem dono"), o filtro "Mostrar" recorta como o painel dele, e o card da fila
   tem "Pegar" — o gesto de axis-acoes.js, que poe o nome de quem pegou.
   Como o painel dele (368342d e 5c849fb), o dev abre o Quadro na sprint atual
   (outra sprint pelo filtro; o Limpar volta para ela) e tem o filtro "Times",
   que soma a fila de Dados/BI ou Sales Ops a do seu time.

   O Meu trabalho (axis-tela-inicio.js) usa o mesmo card, a mesma coluna, o
   mesmo arraste, a mesma gaveta e as mesmas abas de etapa: `AXIS_QUADRO`.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var AX = window.AXIS_APP;
  if (!AX) return;
  var H = AX.H;

  /* As colunas do admin (KB_COLS), sem `negada`: ela fica recolhida no fim,
     porque e saida do fluxo e nao etapa de trabalho. */
  var COLUNAS = ['backlog', 'levantar_req', 'planning', 'planejado', 'em_andamento',
                 'validacao_area', 'validacao', 'concluido'];
  /* AS COLUNAS DO PAINEL DO DEV (`COLUMNS`, dev.html): com o Backlog, e com a
     Validacao da area separada da Validacao PM/PO. Planejado reune Em
     aprovacao de requisitos, como la. */
  var COLUNAS_DEV = [
    { k: 'backlog', junto: ['backlog'] },
    { k: 'planning', junto: ['planning'] },
    { k: 'planejado', junto: ['levantar_req', 'planejado'] },
    { k: 'em_andamento', junto: ['em_andamento'] },
    { k: 'validacao_area', junto: ['validacao_area'] },
    { k: 'validacao', junto: ['validacao'] },
    { k: 'concluido', junto: ['concluido'] }
  ];
  // A base real tem centenas de demandas no Backlog: a coluna pagina.
  var POR_PAGINA = 20;
  var SALES_OPS = 'Sales Ops';

  /* O ESTADO DOS FILTROS vive enquanto o app esta aberto: voltar do Item para o
     Quadro devolve o quadro como a pessoa o deixou. `meus` nasce `null` para
     o primeiro desenho decidir pelo perfil (dev = ligado). */
  /* `sprint`: null (todas) ou lista de sprints e/ou '__fora__' — o filtro de
     varias escolhas do admin (4d7c38f), em AXIS_SPRINTS (axis-tela-sprints.js). */
  /* `sprintPadrao`: o dev abre na sprint atual so na PRIMEIRA montagem; depois
     a escolha dele sobrevive ao redesenho (`_sprintPadraoAplicado`, dev.html). */
  /* `etapa`: a coluna a vista no celular (uma por vez). */
  /* `prod` e `dados`: os filtros Producao e Dados/BI da barra do admin;
     `prodCol`: { coluna: 'no_ar' | 'fora_ar' | 'pausado' }, o menu do contador. */
  var F = { frente: '', tipo: '', sistema: '', dev: '', prazo: '', busca: '', meus: null, vencidas: false, sprint: null, sprintPadrao: false,
            todasConcluidas: false, negadaAberta: false, mais: {}, etapa: '', prod: '', dados: '', prodCol: {} };

  /* A sprint atual e o padrao do dev: so conta como filtro quando ele escolhe outra. */
  function sprintPadraoDev(ctx) { var a = H.sprintAtual(); return ctx.papel === 'dev' && a ? [a] : null; }
  function sprintEhPadrao(ctx) {
    var p = sprintPadraoDev(ctx);
    return !!p && !!F.sprint && F.sprint.length === 1 && F.sprint[0] === p[0];
  }

  // ── CSS proprio, injetado uma vez ────────────────────────────────────
  function css() {
    if (document.getElementById('css-tela-quadro')) return;
    var s = document.createElement('style');
    s.id = 'css-tela-quadro';
    /* So tokens. O prototipo pinta coluna e card com cor literal escura; aqui
       o par vem de variaveis locais, redefinidas no tema claro para o card
       continuar destacado da coluna. */
    s.textContent = [
      '.axa .qd{--qd-col:var(--sf3);--qd-card:var(--sf2);--qd-cbd:var(--sf5)}',
      '.axa[data-tema="claro"] .qd{--qd-col:var(--sf2);--qd-card:var(--sf);--qd-cbd:var(--bd2)}',
      '.axa .qd-kick{font-size:12px;font-weight:700;letter-spacing:.16em;color:var(--ac-l)}',
      '.axa[data-tema="claro"] .qd-kick{color:var(--ac-t)}',
      '.axa .qd-seg{display:flex;max-width:100%;box-sizing:border-box;overflow-x:auto;scrollbar-width:none;padding:4px;border-radius:12px;background:var(--sf3);border:1px solid var(--bd)}',
      '.axa .qd-seg button{height:34px;padding:0 14px;border:0;border-radius:9px;background:transparent;color:var(--tx3);font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}',
      '.axa .qd-seg button[aria-selected="true"]{background:var(--sf4);color:var(--tx-hi);font-weight:700}',
      '.axa .qd-seg button .n{margin-left:6px;font-family:var(--font-mono);font-size:11px;color:var(--tx4)}',
      '.axa .qd-alerta{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 12px;border-radius:10px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap;text-decoration:none}',
      '.axa .qd-alerta.dg{background:rgba(var(--dg-rgb),.1);border:1px solid rgba(var(--dg-rgb),.35);color:var(--dg-t)}',
      '.axa .qd-alerta.wn{background:rgba(var(--wn-rgb),.08);border:1px solid rgba(var(--wn-rgb),.3);color:var(--wn-c)}',
      '.axa .qd-alerta.on{box-shadow:0 0 0 2px rgba(var(--dg-rgb),.45)}',
      '.axa .qd-fl{font-size:12px;color:var(--tx3)}',
      '.axa .qd-par{display:inline-flex;align-items:center;gap:8px}',
      '.axa .qd-sel{height:34px;padding:0 30px 0 12px;border-radius:10px;font-size:12.5px;background-color:var(--sf);max-width:180px}',
      '.axa .qd-busca{height:34px;width:250px;margin-left:auto;padding:0 12px;border-radius:10px;font-size:12.5px;background-color:var(--sf)}',
      /* No computador alertas, busca e filtros correm numa linha so, que quebra onde precisar:
         a busca encosta a direita dos alertas e os filtros seguem. */
      '.axa .qd-barra{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
      '.axa .qd-alertas,.axa .qd-ferr{display:contents}',
      '.axa .qd-nota{font-size:12.5px;line-height:19px;color:var(--tx3)}',
      '.axa .qd-nota b{color:var(--tx2)}',
      '.axa .qd-meus{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 12px;border-radius:10px;border:1px solid var(--bd2);background:var(--sf);color:var(--tx2);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}',
      '.axa .qd-meus .sw{width:30px;height:18px;border-radius:9px;background:var(--bd2);position:relative;flex-shrink:0}',
      '.axa .qd-meus .sw i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:7px;background:var(--tx3);transition:left .15s}',
      '.axa .qd-meus[aria-pressed="true"]{border-color:rgba(var(--ac-rgb),.5);color:var(--tx)}',
      '.axa .qd-meus[aria-pressed="true"] .sw{background:rgba(var(--ac-rgb),.35)}',
      '.axa .qd-meus[aria-pressed="true"] .sw i{left:14px;background:var(--ac)}',
      '.axa .qd-rolo{position:relative;overflow-x:auto;padding-bottom:8px}',
      '.axa .qd-board{display:flex;gap:12px;align-items:flex-start;width:max-content}',
      '.axa .qd-col{width:248px;flex-shrink:0;box-sizing:border-box;padding:12px;border-radius:16px;background:var(--qd-col);border:1px solid var(--sf4);display:flex;flex-direction:column;gap:10px;transition:box-shadow .12s,opacity .12s}',
      '.axa .qd-col.foco{box-shadow:0 0 0 2px rgba(var(--wn-rgb),.55)}',
      // O arraste: a coluna que recebe acende; a fechada apaga e diz por que (dev.html, `drag-block`).
      '.axa .qd-col.solta,.axa .qd-neg.solta{box-shadow:0 0 0 2px rgba(var(--ac-rgb),.65);background:rgba(var(--ac-rgb),.07)}',
      '.axa .qd-col.trava,.axa .qd-neg.trava{opacity:.55;box-shadow:0 0 0 2px rgba(var(--dg-rgb),.4)}',
      '.axa .qd-trava{display:none;align-items:flex-start;gap:6px;padding:8px 10px;border-radius:10px;background:rgba(var(--dg-rgb),.1);color:var(--dg-t);font-size:12px;line-height:17px}',
      '.axa .qd-col.trava .qd-trava{display:flex}',
      '.axa .qd-ch{display:flex;align-items:center;gap:8px;padding:2px 4px}',
      '.axa .qd-ch h2{margin:0;font-family:var(--font-ui);font-size:11.5px;font-weight:800;letter-spacing:.12em;color:var(--tx)}',
      '.axa .qd-ch .n{margin-left:auto;font-family:var(--font-mono);font-size:11.5px;color:var(--tx3)}',
      '.axa .qd-card{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:13px;background:var(--qd-card);border:1px solid var(--qd-cbd);text-decoration:none;color:var(--tx);cursor:pointer}',
      '.axa .qd-card[draggable="true"]{cursor:grab}',
      '.axa .qd-card.arrasta{opacity:.4}',
      '.axa .qd-card.realce{box-shadow:0 0 0 3px rgba(var(--ac-rgb),.7)}',
      '.axa .qd-card:hover{border-color:var(--bd4);color:var(--tx)}',
      '.axa .qd-card.late{border-color:rgba(var(--dg-rgb),.45)}',
      '.axa .qd-card.meu{box-shadow:inset 3px 0 0 var(--ac)}',
      // Nao e do dev (fila ou do time): borda tracejada e fundo apagado (`kcard-fila`, dev.html).
      '.axa .qd-card.fila{border-style:dashed;border-color:rgba(var(--in-rgb),.45);background:rgba(var(--in-rgb),.05)}',
      '.axa .qd-dono{display:flex;flex-wrap:wrap;gap:5px}',
      '.axa .qd-acao{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}',
      '.axa .qd-card .qd-pega{height:28px;padding:0 10px;font-size:12px}',
      '.axa .qd-top{display:flex;justify-content:space-between;align-items:center;gap:6px}',
      '.axa .qd-top .qd-cod{margin-right:auto}',
      '.axa .qd-cod{font-family:var(--font-mono);font-size:11.5px;color:var(--tx3)}',
      '.axa .qd-tit{font-size:13px;line-height:18px;font-weight:700;overflow-wrap:anywhere}',
      '.axa .qd-sys{font-size:11.5px;color:var(--tx3)}',
      '.axa .qd-flags{display:flex;flex-wrap:wrap;gap:5px}',
      '.axa .qd-card .chip{height:20px;padding:0 8px;font-size:10.5px;gap:4px}',
      // O motivo da devolucao, VISIVEL (`kcard-devolucao` / `kb-devolucao`): ate 3 linhas, o resto no title.
      '.axa .qd-devol{font-size:12px;line-height:17px;padding:6px 8px;border-radius:8px;border-left:3px solid var(--dg);background:rgba(var(--dg-rgb),.1);color:var(--dg-t);' +
        'display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}',
      '.axa .qd-devol strong{font-weight:800}',
      '.axa .qd-meta{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11.5px;color:var(--tx3)}',
      '.axa .qd-meta > span{display:inline-flex;align-items:center;gap:4px;min-width:0}',
      '.axa .qd-meta .sem{color:var(--wn-t)}',
      '.axa .qd-meta .dg{color:var(--dg-t);font-weight:700}',
      '.axa .qd-pe{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}',
      '.axa .qd-pts{font-family:var(--font-mono);font-size:11.5px;color:var(--tx2);white-space:nowrap}',
      '.axa .qd-pts.sem{color:var(--tx4)}',
      '.axa .qd-mini{font-size:11px;color:var(--tx3);white-space:nowrap}',
      '.axa .qd-avs{margin-left:auto;display:flex}',
      '.axa .qd-avs .av{width:24px;height:24px;border-radius:12px;font-size:10px;box-shadow:0 0 0 2px var(--qd-card)}',
      '.axa .qd-avs .av + .av{margin-left:-6px}',
      '.axa .qd-val{display:flex;gap:6px;width:100%}',
      '.axa .qd-val .btns{flex:1;height:30px;padding:0 8px;font-size:12px;display:inline-flex;align-items:center;justify-content:center;gap:5px}',
      '.axa .qd-val .qd-ok{color:var(--ok-t);border-color:rgba(var(--ok-rgb),.45)}',
      '.axa .qd-val .qd-no{color:var(--dg-t);border-color:rgba(var(--dg-rgb),.4)}',
      '.axa .qd-estrela{border:0;background:transparent;color:var(--tx4);cursor:pointer;font:inherit;font-size:15px;line-height:1;padding:2px 4px}',
      '.axa .qd-estrela.on{color:var(--wn)}',
      '.axa .qd-mover{display:none}',
      '.axa .qd-vz{padding:14px 8px;border-radius:12px;border:1px dashed var(--bd2);text-align:center;font-size:12px;color:var(--tx4)}',
      '.axa .qd-mais{height:32px;border-radius:10px;border:1px dashed var(--bd4);background:transparent;color:var(--tx3);font:inherit;font-size:12px;font-weight:600;cursor:pointer}',
      '.axa .qd-mais:hover{color:var(--tx);border-color:var(--tx4)}',
      '.axa .qd-neg{width:52px;flex-shrink:0;box-sizing:border-box;padding:12px 0;border-radius:16px;background:var(--qd-col);border:1px solid var(--sf4);display:flex;flex-direction:column;align-items:center;gap:10px;cursor:pointer;color:var(--tx3);font:inherit}',
      '.axa .qd-neg:hover{color:var(--tx);border-color:var(--bd4)}',
      '.axa .qd-neg .v{writing-mode:vertical-rl;transform:rotate(180deg);font-size:11.5px;font-weight:800;letter-spacing:.12em}',
      '.axa .qd-neg .n{font-family:var(--font-mono);font-size:11.5px}',
      '.axa .qd-so-cel,.axa .qd-etapas{display:none}',
      // O Grill pendente (`kcard-grill-on`, dev.html): borda ambar e a faixa no topo do card.
      '.axa .qd-card.grill{border:2px solid rgba(var(--wn-rgb),.85);padding:11px}',
      '.axa .qd-grill{font-size:11.5px;font-weight:800;letter-spacing:.02em;padding:5px 8px;border-radius:8px;background:rgba(var(--wn-rgb),.14);color:var(--wn-t)}',
      // A cor da sprint do PO (`kb-comsprint`, admin.html): a faixa na borda esquerda.
      '.axa .qd-card.comsp{box-shadow:inset 4px 0 0 var(--sp-cor)}',
      '.axa .qd-card.meu.comsp{box-shadow:inset 3px 0 0 var(--ac),inset 7px 0 0 var(--sp-cor)}',
      '.axa .qd-spb{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 5px;border-radius:7px;border:1px dashed var(--sp-cor,var(--bd4));background:transparent;color:var(--tx2);font:inherit;font-family:var(--font-mono);font-size:10.5px;cursor:pointer;white-space:nowrap}',
      '.axa .qd-spb:hover{border-style:solid;color:var(--tx)}',
      '.axa .qd-proj{cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px}',
      '.axa .qd-proj:hover{color:var(--tx)}',
      // Os vinculos (`renderDepSection`, dev.html): a principal, as filhas, a soma, a trava e o "+ Vincular".
      '.axa .qd-vin{display:flex;flex-direction:column;gap:3px;padding-top:6px;border-top:1px dashed var(--bd2);min-width:0}',
      '.axa .qd-vl{display:flex;align-items:center;gap:6px;min-width:0;padding:3px 4px;border-radius:6px;font-size:11.5px;line-height:16px;color:var(--tx2);cursor:pointer}',
      '.axa .qd-vl:hover,.axa .qd-vl:focus-visible{background:var(--sf3);color:var(--tx)}',
      '.axa .qd-vl .cd{font-family:var(--font-mono);color:var(--tx3);flex-shrink:0}',
      '.axa .qd-vl .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.axa .qd-vl .et{flex-shrink:0;color:var(--tx4)}',
      '.axa .qd-vl.trava .axi{color:var(--wn-c)}',
      '.axa .qd-vl.feita{opacity:.6}',
      '.axa .qd-peso{font-size:11.5px;color:var(--tx3);padding:0 4px}',
      '.axa .qd-bloq{font-size:11.5px;font-weight:700;padding:5px 8px;border-radius:8px;background:rgba(var(--dg-rgb),.1);color:var(--dg-t)}',
      '.axa .qd-card .qd-vinc{height:28px;padding:0 10px;font-size:12px;align-self:flex-start}',
      // O contador da coluna e o menu de producao (`kbContadorHTML`, admin.html).
      '.axa .qd-cnt{margin-left:auto;height:24px;padding:0 8px;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--tx3);font-family:var(--font-mono);font-size:11.5px;cursor:pointer}',
      '.axa .qd-cnt:hover{border-color:var(--bd2);color:var(--tx)}',
      '.axa .qd-cnt.on{border-color:rgba(var(--ac-rgb),.55);color:var(--ac-t)}',
      '.axa .qd-cnt .cr{display:none;font-family:var(--font-ui)}',
      // A demanda por cima do quadro: no computador, painel do lado direito; no celular, a tela inteira.
      '.axa .gv-fundo.qd-gvf{justify-content:flex-end;align-items:stretch}',
      '.axa .gv.qd-gvi{max-width:min(1040px,94vw);max-height:none;height:100%;height:100dvh;border-radius:20px 0 0 20px;border:1px solid var(--bd2);border-right:0;animation:qd-gv-entra .2s ease-out}',
      '@keyframes qd-gv-entra{from{transform:translateX(48px);opacity:.3}to{transform:none;opacity:1}}',
      '.axa .qd-gvi .gv-t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.axa .qd-gvi .gv-corpo{container:app / inline-size;position:relative;padding:8px 24px 28px}',
      '.axa .qd-gvi .gv-pe .btn{display:inline-flex;align-items:center;gap:8px;text-decoration:none}',
      '.axa .qd-gvf ~ .ovl,.axa .qd-gvf ~ .toast{z-index:80}',
      '@media (min-width: 761px){.axa .qd-gvi .gv-alca{display:none}}',
      '@media (max-width: 760px){.axa .gv.qd-gvi{max-width:none;width:100%;border-radius:0;border:0;animation:gv-sobe .22s ease-out}.axa .qd-gvi .gv-corpo{padding:6px 14px 20px}}',
      '@container app (max-width: 760px){.axa .qd-gvi [style*="grid-template-columns"]{grid-template-columns:minmax(0,1fr) !important}.axa .qd-gvi .h1{font-size:22px !important;line-height:28px !important}}',
      /* ── CELULAR: uma etapa por vez, filtros na gaveta, alertas numa linha ── */
      '@container app (max-width: 760px){',
      '.axa .qd-sub,.axa .qd-seg,.axa .qd-novo,.axa .qd-neg,.axa .qd-lg{display:none !important}',
      '.axa .qd-cab{gap:2px !important}',
      '.axa .qd-barra{flex-direction:column;flex-wrap:nowrap;align-items:stretch;gap:8px}',
      '.axa .qd-ferr{display:flex;order:-1;gap:8px;align-items:center}',
      '.axa .qd-busca{flex:1 1 auto;width:auto;min-width:0;height:44px;margin-left:0}',
      '.axa .qd-alertas{display:flex;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;gap:8px}',
      '.axa .qd-alertas::-webkit-scrollbar{display:none}',
      '.axa .qd-alertas:empty{display:none}',
      '.axa .qd-alerta{height:44px;font-size:12px;flex-shrink:0;padding:0 12px}',
      '.axa .qd-etapas{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;position:relative}',
      '.axa .qd-etapas::-webkit-scrollbar{display:none}',
      '.axa .qd-etapas button{flex-shrink:0;min-height:44px;padding:0 14px;border-radius:12px;border:1px solid var(--bd2);background:var(--sf2);color:var(--tx3);font:inherit;font-size:12.5px;font-weight:700;white-space:nowrap;cursor:pointer;display:inline-flex;align-items:center;gap:8px}',
      '.axa .qd-etapas button[aria-selected="true"]{background:var(--sf4);color:var(--tx-hi);border-color:rgba(var(--ac-rgb),.55)}',
      '.axa .qd-etapas .n{font-family:var(--font-mono);font-size:12px;color:var(--tx4)}',
      '.axa .qd-etapas .dotc{width:8px;height:8px}',
      '.axa .qd-rolo{scroll-snap-type:x mandatory;overflow-y:hidden;padding-bottom:0;scrollbar-width:none;overscroll-behavior-x:contain}',
      '.axa .qd-rolo::-webkit-scrollbar{display:none}',
      '.axa .qd-board{width:100%;gap:12px}',
      '.axa .qd-col{flex:0 0 100%;width:100%;scroll-snap-align:start;scroll-snap-stop:always;padding:10px}',
      '.axa .qd-cod,.axa .qd-sys,.axa .qd-pts,.axa .qd-mini,.axa .qd-ch h2,.axa .qd-ch .n,.axa .qd-meta,.axa .qd-mais,.axa .qd-neg .v,.axa .qd-neg .n{font-size:12px !important}',
      '.axa .qd-mais,.axa .qd-card .qd-pega,.axa .qd-val .btns,.axa .qd-ch .btns{min-height:44px;height:auto}',
      '.axa .qd-mover{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:0 12px;flex-shrink:0}',
      '.axa .qd-pe{flex-wrap:wrap;row-gap:6px}',
      // A coluna ja tem nome e numero na aba: o cabecalho so fica quando tem botao (a impressora).
      '.axa .qd-ch:not(:has(button)){display:none}',
      '.axa .qd-ch h2,.axa .qd-ch .n,.axa .qd-ch .dotc{display:none}',
      '.axa .qd-acao > *{flex:1 1 auto}',
      '.axa .qd-estrela{min-width:44px;min-height:44px;margin:-12px -10px -12px 0}',
      '.axa .qd-grill,.axa .qd-bloq,.axa .qd-peso,.axa .qd-vl,.axa .qd-spb,.axa .qd-cnt{font-size:12px !important}',
      '.axa .qd-vl{min-height:44px;padding:0 6px}',
      '.axa .qd-card .qd-vinc,.axa .qd-spb,.axa .qd-cnt{min-height:44px;height:auto}',
      '.axa .qd-cnt{min-width:44px;border-color:var(--bd2)}',
      '.axa .qd-cnt .cr{display:inline}',
      '.axa .qd-proj{display:inline-flex;align-items:center;min-height:44px}',
      // O contador vira o filtro da etapa: o cabecalho da coluna aparece so com ele.
      '.axa .qd-ch:has(.qd-cnt){display:flex}',
      '.axa .qd-ch .qd-cnt{display:inline-flex !important;align-items:center;margin-left:0}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── Leituras (todas pelos modulos) ───────────────────────────────────
  /* A FRENTE DO CARD. Uma particao so, para o seletor nao contar a mesma
     demanda em duas abas: Sales Ops e a trilha da sprint (`SPRINTPO.trilhaDe`,
     marca na demanda); o resto e a frente de `PIPELINES.daDemanda` (marca
     Dados/BI ou a frente de quem faz). Quem nao tem frente cai na frente
     geral, que e a regra do proprio pipelines.js. */
  function frenteDe(m, D) {
    if (window.SPRINTPO && SPRINTPO.trilhaDe(m) === 'sales_ops') return SALES_OPS;
    return window.PIPELINES ? PIPELINES.daDemanda(m, D.devs_perfil || {}) : '';
  }
  function frentes() {
    var l = window.PIPELINES ? PIPELINES.nomes.slice() : [];
    l.push(SALES_OPS);
    return l;
  }

  /* "CONCLUIDAS: ESTE MES" — copia de `dataReferenciaKb` + `matchPeriodoConclusao`
     (admin.html). A data de referencia e a entrega, ou o inicio, ou a criacao;
     concluida/negada sem data nenhuma so aparece pedindo "todas". Candidata a
     modulo: hoje a regra existe no admin e aqui. */
  function dataReferencia(m) {
    var d = String(m.entrega || m.inicio || m.criado_em || '').slice(0, 10);
    return H.ehISO(d) ? d : '';
  }
  function doPeriodo(m) {
    var c = H.colunaDe(m);
    if (c !== 'concluido' && c !== 'negada') return true;
    var ref = dataReferencia(m);
    return !!ref && ref.slice(0, 7) === H.hoje().slice(0, 7);
  }

  /* A BUSCA — COPIA DE `normTexto` + `matchBusca` (admin.html): minusculas e
     sem acento, e o codigo nas duas formas, com e sem hifen ("AX-179",
     "AX179", "179"). */
  function normTexto(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }
  function casaBusca(m, termo) {
    if (!termo) return true;
    var cod = String(m.codigo || '');
    var alvo = normTexto([m.titulo, m.descricao, m.dev, m.solicitante, cod, cod.replace(/-/g, '')].filter(Boolean).join(' '));
    return alvo.indexOf(normTexto(termo)) >= 0;
  }

  /* O FILTRO PRAZO — COPIA DE `matchPrazo` (admin.html), com a data de hoje
     por parametro: vencidas, vencem na semana (7 dias), vencem no mes e sem
     data. So a demanda aberta vence (`isDemandaAberta`). */
  var PRAZOS = [['', 'Todos'], ['vencidas', 'Vencidas'], ['semana', 'Na semana'], ['mes', 'No mês'], ['sem_data', 'Sem data']];
  function casaPrazo(m, filtro, hojeISO, col) {
    if (!filtro) return true;
    if (filtro === 'sem_data') return !m.entrega;
    if (!m.entrega || col === 'concluido' || col === 'negada') return false;
    var p = String(hojeISO).slice(0, 10).split('-');
    var hoje = new Date(+p[0], +p[1] - 1, +p[2]);
    var e = new Date(m.entrega + 'T00:00:00');
    if (filtro === 'vencidas') return e < hoje;
    if (e < hoje) return false;
    if (filtro === 'semana') { var lim = new Date(hoje); lim.setDate(lim.getDate() + 7); return e <= lim; }
    if (filtro === 'mes') return e <= new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    return true;
  }

  /* A DATA DE ENTREGA NO CARD — o "🏁 dd/mm" do admin (`m.entrega`, a data do
     dev), com o icone do app. Vazia sem data. */
  function dataNoCard(m) {
    var e = String((m || {}).entrega || '').slice(0, 10);
    return H.ehISO(e) ? { iso: e, txt: H.dm(e) } : null;
  }

  /* O MOTIVO DA DEVOLUCAO, VISIVEL NO CARD — a faixa de `devolucao.js`, a mesma
     do admin (`kb-devolucao`) e do dev (`kcard-devolucao`). */
  function faixaDevolucao(m) {
    return window.DEVOLUCAO ? DEVOLUCAO.faixa(m, 'qd-devol') : '';
  }

  /* O FILTRO PRODUCAO — COPIA de `matchProducao` (admin.html), com a etapa
     GRAVADA por parametro. `falta_subir` (concluida fora do ar) e `no_ar` sao
     da barra; `fora_ar` e `pausado` so do menu do contador da coluna, onde a
     etapa ja esta fixada. `em_producao` ausente conta como fora do ar. */
  var PRODUCAO = [['', 'Geral'], ['falta_subir', 'Concluídas fora do ar'], ['no_ar', 'No ar']];
  var PROD_COL = [['', 'Tudo', ''], ['no_ar', 'No ar', '▲'], ['fora_ar', 'Fora do ar', '△'], ['pausado', 'Em pausa', '⏸']];
  function casaProducao(m, filtro, gravada, pausada) {
    if (!filtro) return true;
    var noAr = !!(m && m.em_producao);
    if (filtro === 'no_ar') return noAr;
    if (filtro === 'falta_subir') return !noAr && gravada === 'concluido';
    if (filtro === 'fora_ar') return !noAr;
    if (filtro === 'pausado') return !!pausada;
    return true;
  }

  /* O FILTRO DADOS/BI PELA MARCA — COPIA de `matchDados` (admin.html): a marca
     da demanda (`dados_bi`, `sales_ops`), e nao a frente de quem faz. "Fora de
     Dados" e o avesso da marca. */
  var DADOS = [['', 'Todos'], ['dados', 'Dados/BI'], ['sales', 'Sales Ops'], ['fora', 'Fora de Dados']];
  function casaDados(m, filtro) {
    if (!filtro) return true;
    if (filtro === 'sales') return !!(m && m.sales_ops && !m.dados_bi);
    return filtro === 'dados' ? !!(m && m.dados_bi) : !(m && m.dados_bi);
  }

  /* O GRILL PENDENTE PINTA O CARD (`grillFaixa` e `kcard-grill-on`, dev.html):
     so o pendente, e — como a regra `grill` de axis-acoes.js, mais estrita que
     o dev.html — nao em concluida ou negada, que o parecer nao reabre. */
  function grillPendente(m) {
    return !!(window.GRILL && GRILL.pendente(m)) && ['concluido', 'negada'].indexOf(H.colunaDe(m)) < 0;
  }

  /* OS VINCULOS DO CARD — o `renderDepSection` do dev.html (a principal, as
     filhas, a soma da arvore e "Avanco bloqueado") com o "N dep. abertas" do
     admin. Tudo do vinculo.js: `paiDe`, `filhosDe`, `abertos` (so dependencia
     aberta trava) e `frase`. Devolve os dados; `htmlVinculos` desenha. */
  function vinculosDe(m, lista, VI) {
    if (!VI || !m) return null;
    var abertas = VI.abertos(lista, m.id).length;
    return { pai: m.parent_id ? VI.paiDe(lista, m) : null, filhas: VI.filhosDe(lista, m.id), abertas: abertas,
             frase: VI.frase(lista, m), bloqueado: abertas > 0 };
  }
  /* Cada linha abre a demanda na gaveta (`data-qd-ver`, como a `dep-click` do
     dev.html abre em leitura); "+ Vincular" e o gesto `vincular` (so o dev,
     fora de Concluido: a regra decide). */
  function htmlVinculos(m, v, vincular) {
    var VI = window.VINCULO;
    var L = [];
    var linha = function (x, ico, rot, cls, titulo) {
      return '<span class="qd-vl' + (cls ? ' ' + cls : '') + '" role="button" tabindex="0" data-qd-ver="' + attr(x.id) + '" title="' + attr(titulo) + '">' +
        H.ico(ico) + '<span class="et">' + rot + '</span><span class="cd">' + H.esc(x.codigo || '') + '</span><span class="t">' + H.esc(x.titulo || '') + '</span></span>';
    };
    if (v && v.pai) {
      var dep = VI && VI.bloqueia(m);
      L.push(linha(v.pai, 'link', dep ? 'dep. de' : 'parte de', '',
        (dep ? 'Esta demanda é dependência de ' : 'Esta demanda faz parte de ') + (v.pai.codigo ? v.pai.codigo + ' · ' : '') + (v.pai.titulo || '') + '. Clique para abrir.'));
    }
    (v ? v.filhas : []).forEach(function (f) {
      var trava = !!(VI && VI.bloqueia(f)), feita = !!(VI && VI.concluida(f));
      L.push(linha(f, feita ? 'check' : trava ? 'hourglass' : 'link', H.esc(((H.ETAPA_POR_ID[H.colunaDe(f)] || {}).rotulo || '').toLowerCase()),
        (trava && !feita ? 'trava' : '') + (feita ? ' feita' : ''),
        (trava ? 'Dependência — trava o avanço deste card até ser concluída' : 'Vinculada — pertence a este card, não trava nada') +
        ' · ' + (f.dev || 'sem dev') + ' · ' + (f.entrega ? H.dm(f.entrega) : 'sem data') + '. Clique para abrir.'));
    });
    if (v && v.frase) L.push('<span class="qd-peso" title="Soma dos pontos desta demanda e de tudo que depende dela. É leitura: cada vínculo segue contando o próprio ponto nos relatórios.">' +
      H.ico('calc') + ' ' + H.esc(v.frase) + '</span>');
    if (v && v.bloqueado) L.push('<span class="qd-bloq">' + H.ico('lock') + ' Avanço bloqueado — aguardando dependência</span>');
    if (vincular) L.push(vincular);
    return L.length ? '<span class="qd-vin">' + L.join('') + '</span>' : '';
  }

  /* APROVAR E DEVOLVER NO CARD (`valDecidirNoCard`, admin.html): so na
     Validacao PM/PO e so para o PM/PO, como o Item. */
  function decideNoCard(m, col, papel) {
    return col === 'validacao' && papel === 'admin';
  }

  /* `prazo.js` le os feriados como texto ISO; a base guarda `{ data, nome }`. */
  function feriadosISO() {
    return ((AX.APP.D || {}).feriados || []).map(function (f) { return f && typeof f === 'object' ? f.data : f; });
  }

  function raizTema(nome) { return String(nome || '').split(/\s+-\s+/)[0]; }

  function casaFiltros(m, D) {
    if (F.tipo === '__sem__' ? !!m.tipo : (F.tipo && m.tipo !== F.tipo)) return false;
    if (F.sistema) {
      if (F.sistema.indexOf('t:') === 0 && m.tema_id !== F.sistema.slice(2)) return false;
      if (F.sistema.indexOf('r:') === 0 && raizTema(H.tema(m.tema_id)) !== F.sistema.slice(2)) return false;
    }
    if (F.sprint && window.AXIS_SPRINTS && !AXIS_SPRINTS.casa(m, F.sprint)) return false;
    if (F.prazo && !casaPrazo(m, F.prazo, H.hoje(), H.colunaDe(m))) return false;
    if (F.dados && !casaDados(m, F.dados)) return false;
    if (F.prod && !casaProducao(m, F.prod, H.colunaDe(m), H.pausada(m))) return false;
    if (F.meus) { if (!mostraDoDev(m)) return false; }
    else if (F.dev === '__sem__') { if (H.devsDe(m).length) return false; }
    else if (F.dev && !(window.DEVNOME ? DEVNOME.eDe(m, F.dev) : H.devsDe(m).indexOf(F.dev) >= 0)) return false;
    return true;
  }

  /* O QUE ESTE PERFIL VE NO QUADRO. Para o dev, a montagem da sprint que o PO
     ainda nao iniciou fica escondida — a mesma regra do painel do dev
     (`SPRINTPO.escondidaDoTime`, dev.html getFiltered). */
  function universo(ctx) {
    return H.visiveis().filter(function (m) {
      if (ctx.papel === 'dev' && window.SPRINTPO && SPRINTPO.escondidaDoTime(ctx.D, m)) return false;
      return true;
    });
  }

  function porId(id) {
    var s = String(id);
    return ((AX.APP.D || {}).melhorias || []).find(function (x) { return x && String(x.id) === s; }) || null;
  }

  // ── Pedacos de HTML ──────────────────────────────────────────────────
  function attr(s) { return H.esc(s); }

  function cabecalhoSprint(ctx) {
    var S = window.SPRINTPO;
    var rot = H.sprintAtual();
    if (!S || !rot) return { kick: '', sub: '' };
    var fer = ctx.D.feriados || [];
    var fx = S.faixaDaSprint(rot, fer);
    var kick = 'SPRINT ' + S.rotuloCurto(rot);
    if (fx) {
      var de = H.data(fx.de), ate = H.data(fx.ate);
      var mesmoMes = de.getMonth() === ate.getMonth();
      kick += ' · ' + String(de.getDate()).padStart(2, '0') + (mesmoMes ? '' : ' ' + H.MESES_C[de.getMonth()].toUpperCase()) +
        ' A ' + String(ate.getDate()).padStart(2, '0') + ' ' + H.MESES_C[ate.getMonth()].toUpperCase();
      // O dia da sprint conta dias uteis (a mesma conta que define a sprint).
      var uteis = [];
      [fx.de.slice(0, 7), fx.ate.slice(0, 7)].forEach(function (am, i, arr) {
        if (i && am === arr[0]) return;
        uteis = uteis.concat(S.diasUteisDoMes(+am.slice(0, 4), +am.slice(5, 7), fer));
      });
      uteis = uteis.filter(function (d) { return d >= fx.de && d <= fx.ate; });
      var hoje = H.hoje();
      if (hoje < fx.de) kick += ' · COMEÇA ' + H.dm(fx.de);
      else {
        var n = uteis.filter(function (d) { return d <= hoje; }).length;
        kick += ' · DIA ' + Math.min(n, uteis.length) + ' DE ' + uteis.length;
      }
    }
    /* A META SO APARECE SE O REGISTRO DA SPRINT TIVER UMA. Hoje o registro
       (`sprints`) guarda inicio e fechamento; no lugar da meta vai a situacao
       real da sprint, que e o que o registro sabe. */
    var reg = S.registroDe(ctx.D, rot) || {};
    var meta = String(reg.meta || reg.objetivo || '').trim();
    var sub;
    if (meta) sub = 'Meta: <b style="color:var(--tx2)">' + H.esc(meta) + '</b>';
    else {
      var sit = S.situacaoDaSprint(ctx.D, rot);
      sub = sit === 'fechada' ? 'Sprint fechada em ' + H.dm(reg.em) + (reg.por ? ' por ' + H.esc(reg.por) : '') + '.'
          : sit === 'em_curso' ? 'Sprint em curso desde ' + H.dm(reg.iniciada_em) + (reg.iniciada_por ? ', iniciada por ' + H.esc(reg.iniciada_por) : '') + '.'
          : 'Sprint em montagem: o PM/PO ainda não a iniciou.';
    }
    return { kick: kick, sub: sub };
  }

  function chipsDoCard(m, col) {
    var c = [];
    var hoje = H.hoje();
    var sit = window.PAUSA ? PAUSA.situacao(m) : (H.pausada(m) ? 'pausada' : 'correndo');
    if (H.etapaDe(m) === 'atrasado') {
      var a = H.atrasoDe(m);
      c.push(H.chip(H.ico('alert') + ' atrasada' + (a > 0 ? ' ' + a + 'd' : ''), 'dg'));
    } else if (sit !== 'pausada' && window.PRAZO && !PRAZO.relogioParou(col)) {
      var pz = H.prazoDe(m), d = pz ? H.dias(hoje, pz) : null;
      if (d === 0) c.push(H.chip('vence hoje', 'dg'));
      else if (d === 1) c.push(H.chip('vence amanhã', 'wn'));
    }
    if (sit === 'pausada') {
      var dp = window.PRAZO ? PRAZO.diasPausados(m, hoje) : 0;
      c.push(H.chip(H.ico('pause') + ' pausada' + (dp ? ' · ' + dp + 'd' : ''), 'mg', m.pausa_motivo || ''));
    } else if (sit === 'aguardando') {
      c.push(H.chip(H.ico('pause') + ' pausa pedida', 'wn', (PAUSA.pedido(m) || {}).motivo || ''));
    }
    // A devolucao e a faixa com o motivo (`faixaDevolucao`), e nao mais um chip.
    if (col === 'validacao_area' && window.PRAZO) {
      var dA = PRAZO.diasNaArea(m, hoje);
      if (dA != null) c.push(H.chip(H.ico('eye') + ' área · ' + dA + 'd', PRAZO.areaVenceu(m, hoje, feriadosISO()) ? 'wn' : 'in',
        'Esperando a área homologar.'));
    }
    if (m.em_producao && (col === 'validacao' || col === 'validacao_area' || col === 'concluido')) c.push(H.chip('no ar', 'ok'));
    if (window.SPRINTPO && SPRINTPO.ehPrioritariaDaSprint(m)) c.push(H.chip(H.ico('zap') + ' prioritária', 'ac'));
    /* O SPIKE DIZ QUANTAS ASSINATURAS TEM (`renderKanban`, admin.html): sem a
       lista de quem aprova, nao inventa numero. */
    if (m.spike) {
      var PV = window.PREVOO, quemAssina = (AX.APP.D || {}).spike_aprovadores;
      var minSp = (PV && PV.ASSINATURAS_SPIKE) || 3;
      if (!PV || !Array.isArray(quemAssina)) c.push(H.chip(H.ico('search') + ' Spike …', 'in', 'Spike — conferindo as aprovações…'));
      else {
        var nSp = PV.assinaturasValidas(m, quemAssina).length;
        c.push(H.chip(H.ico('search') + ' Spike ' + nSp + '/' + minSp, nSp >= minSp ? 'ok' : 'in', 'Spike: ' + nSp + ' de ' + minSp + ' aprovações'));
      }
    }
    if (m.debito_tecnico) c.push(H.chip('Débito técnico', 'pu'));
    // A marca do time (`renderKanban`, admin.html), a mesma do Item.
    if (m.dados_bi) c.push(H.chip(H.ico('chart') + ' Dados/BI', 'in', 'Demanda do time de Dados/BI'));
    else if (m.sales_ops) c.push(H.chip(H.ico('trend') + ' Sales Ops', 'in', 'Demanda de Sales Ops — sprint contabilizada à parte'));
    // Comprometida sem pontos do Poker (`semPontuacao`, dev.html; a regra e a do capacidade.js).
    if (window.CAPACIDADE && CAPACIDADE.semPontuacao(m)) c.push(H.chip(H.ico('cards') + ' sem pontuação', 'wn', 'Sem pontos do Planning Poker: a data foi combinada sem estimativa de tamanho.'));
    // "N dep. abertas" (`renderMelhorias`, admin.html): so dependencia aberta conta.
    var nDep = window.VINCULO ? VINCULO.abertos((AX.APP.D || {}).melhorias || [], m.id).length : 0;
    if (nDep) c.push(H.chip(H.ico('hourglass') + ' ' + nDep + ' dep. aberta' + (nDep > 1 ? 's' : ''), 'dg', 'Dependências abertas: este card não avança enquanto elas não forem concluídas.'));
    // Impacto, urgencia e o caso de uso da etapa seguem a demanda (`requisitos.js`, como no Kanban do admin).
    var rq = H.chipsReq(m) + H.chipCasoUso(m);
    if (rq) c.push(rq);
    if (window.SUBTAREFA) {
      var p = SUBTAREFA.progresso(SUBTAREFA.lista(m));
      if (p.total) c.push(H.chip(H.ico('check') + ' ' + p.feitas + '/' + p.total, p.feitas === p.total ? 'ok' : 'bk', p.feitas + ' de ' + p.total + ' subtarefas'));
    }
    // O selo de validacao (planning e comite), o mesmo `selo-validacao.js` das tres telas antigas.
    var selo = window.SELO ? SELO.badges(m, 'chip c-ok') : '';
    if (selo) c.push(selo);
    return c;
  }

  /* O QUE O DEV VE (`F.meus`), copia do painel dele (`AXIS_ACOES.mostraNoPainel`,
     82bff39): 'meu_fila' = no meu nome + a fila do time, 'meu', 'fila'; vazio =
     o quadro inteiro, como o do PM/PO. */
  function mostraDoDev(m) {
    var AC = window.AXIS_ACOES;
    if (!AC || !AC.mostraNoPainel) return H.minha(m);
    return AC.mostraNoPainel(m, AC.contexto(), F.meus === 'meu_fila' ? '' : F.meus);
  }

  /* O CARD. E um link para o Item (Ctrl+clique abre a pagina); o clique simples
     abre a gaveta (`ligarQuadro`). `cx` e o contexto das acoes, um so por
     desenho. */
  function card(m, col, cx) {
    var late = H.etapaDe(m) === 'atrasado';
    var meu = H.minha(m);
    var AC = window.AXIS_ACOES;
    var papel = AX.APP.papel;
    if (!cx && AC && AC.contexto) cx = AC.contexto();
    // De quem e o card, para o dev: a marca e o "Pegar" da fila (dev.html, `kcard-dono`).
    var marca = AC && AC.marcaDono ? AC.marcaDono(m) : '';
    var pega = AC && AC.botaoPegar ? AC.botaoPegar(m, 'btns qd-pega', 'Pegar') : '';
    var naFila = papel === 'dev' && !meu && !!marca;
    var arrasta = !!(AC && AC.arrastavel && cx && AC.arrastavel(m, cx));
    var tipo = H.TIPOS[m.tipo];
    var pts = H.pontosDe(m);
    var proj = m.projeto_id ? H.projeto(m.projeto_id) : null;
    var sp = window.SPRINTPO ? SPRINTPO.doPO(m) : '';
    var devs = H.devsDe(m);
    var chips = chipsDoCard(m, col);
    var prio = window.ORDEMKB ? ORDEMKB.rotulo(m) : '';
    var votado = m.poker_media != null && m.poker_media !== '';
    var dt = dataNoCard(m);
    var sol = String(m.solicitante || '').trim();
    var nAnx = (Array.isArray(m.anexos) ? m.anexos : []).filter(Boolean).length;
    var estrela = papel === 'admin' && AC && AC.GESTOS && AC.GESTOS.destaque
      ? AC.botao('destaque', m, m.destaque ? '★' : '☆', 'qd-estrela' + (m.destaque ? ' on' : ''),
        { titulo: m.destaque ? 'É destaque — sai na apresentação. Clique para desmarcar.' : 'Marcar como destaque da apresentação' }) : '';
    var decide = decideNoCard(m, col, papel) && AC
      ? '<span class="qd-val">' + AC.botao('validar', m, 'Aprovar', 'btns qd-ok', { ico: 'check', titulo: 'Aprovar a entrega e concluir' }) +
        AC.botao('devolver', m, 'Devolver', 'btns qd-no', { ico: 'undo', titulo: 'Devolver ao dev com o motivo' }) + '</span>' : '';
    // "Mover para…" e o seletor unico de axis-acoes.js (o mesmo do Item), so com as etapas que o perfil move.
    var mover = arrasta && AC.GESTOS && AC.GESTOS.moverPara && AC.etapasDoSeletor && AC.etapasDoSeletor(m, cx).length
      ? AC.botao('moverPara', m, 'Mover', 'btns qd-mover', { ico: 'board', titulo: 'Mover ' + (m.codigo || '') + ' para outra etapa' }) : '';
    var acao = pega + decide;
    var grill = grillPendente(m);
    // A cor da sprint do PO no card (`estiloSprint`, admin.html: `kb-comsprint`).
    var spEst = window.SPRINTPO && SPRINTPO.estiloSprint ? SPRINTPO.estiloSprint(m) : '';
    /* A SPRINT PELO CHIP (`sprintEscolher`, admin.html): para o dono da sprint o
       chip e o botao "Sprint…" (repassar, mover ou tirar); para os outros, so
       o rotulo. */
    var dono = !!(AC && AC.GESTOS && AC.GESTOS.sprint && H.donoDaSprint && H.donoDaSprint());
    var spCel = dono
      ? AC.botao('sprint', m, sp ? SPRINTPO.rotuloCurto(sp) : 'Sprint…', 'qd-spb', { titulo: sp ? 'Sprint ' + sp + ' — clique para mover para outra sprint ou tirar da sprint' : 'Fora da sprint — clique para repassar para uma sprint' })
      : sp ? '<span class="qd-mini mono" title="' + attr(sp) + '">' + H.esc(SPRINTPO.rotuloCurto(sp)) + '</span>' : '';
    var lista = (AX.APP.D || {}).melhorias || [];
    var vincular = AC && AC.permite && AC.GESTOS && AC.GESTOS.vincular && AC.permite('vincular', m, {})
      ? AC.botao('vincular', m, 'Vincular demanda', 'btns qd-vinc', { ico: 'plus', titulo: 'Pendura neste card uma parte (vinculada) ou uma dependência' }) : '';
    return '<a class="qd-card' + (late ? ' late' : '') + (meu ? ' meu' : '') + (naFila ? ' fila' : '') + (grill ? ' grill' : '') + (spEst ? ' comsp' : '') + '" href="' + H.hrefItem(m) + '"' +
      ' data-qd-id="' + attr(m.id) + '" draggable="' + arrasta + '"' + (spEst ? ' style="' + attr(spEst) + '"' : '') +
      ' title="' + attr((m.codigo || '') + ' · prioridade ' + prio + (meu ? ' · é seu' : '') + (arrasta ? ' · arraste para mover' : '')) + '">' +
      (grill ? '<span class="qd-grill" title="O PM/PO pediu seu parecer antes de esta demanda entrar no planejamento. Abra e responda.">' + H.ico('flame') + ' Grill — dê seu parecer</span>' : '') +
      (marca ? '<span class="qd-dono">' + marca + '</span>' : '') +
      '<span class="qd-top"><span class="qd-cod">' + H.esc(m.codigo || '—') + '</span>' + estrela +
      (tipo ? H.chip(H.esc(tipo.rotulo), 'bk') : '') + '</span>' +
      '<span class="qd-tit">' + H.esc(m.titulo || '(sem título)') + '</span>' +
      (m.tema_id ? '<span class="qd-sys">' + H.esc(H.caminho(m.tema_id)) + '</span>' : '<span class="qd-sys" style="color:var(--tx4)">sem sistema</span>') +
      faixaDevolucao(m) +
      (chips.length ? '<span class="qd-flags">' + chips.join('') + '</span>' : '') +
      '<span class="qd-meta">' +
      (sol ? '<span title="Solicitante: quem pediu e homologa">' + H.ico('user') + ' ' + H.esc(sol) + '</span>'
           : '<span class="sem" title="Sem solicitante: a demanda não passa da Validação da área sem ele">' + H.ico('user') + ' sem solicitante</span>') +
      // Inicio e estimativa (o "📅" e o "⏱" do card do dev.html), em volta da entrega.
      (H.ehISO(String(m.inicio || '').slice(0, 10)) ? '<span title="Início: ' + attr(H.dma(String(m.inicio).slice(0, 10))) + '">' + H.ico('calendar') + ' ' + H.dm(String(m.inicio).slice(0, 10)) + '</span>' : '') +
      (dt ? '<span' + (late ? ' class="dg"' : '') + ' title="Entrega do dev: ' + attr(H.dma(dt.iso)) + '">' + H.ico('flag') + ' ' + dt.txt + '</span>' : '') +
      (String(m.estimativa || '').trim() ? '<span title="Estimativa">' + H.ico('clock') + ' ' + H.esc(String(m.estimativa).trim()) + '</span>' : '') +
      '</span>' +
      htmlVinculos(m, vinculosDe(m, lista, window.VINCULO), vincular) +
      '<span class="qd-pe">' +
      (pts ? '<span class="qd-pts" title="' + (votado ? 'Planning Poker · média ' + attr(m.poker_media) : 'Pontos por estimativa, sem votação no Poker') + '">' + pts + ' pts</span>'
           : '<span class="qd-pts sem" title="Sem pontos do Poker">— pts</span>') +
      (nAnx ? '<span class="qd-mini" title="' + H.plural(nAnx, 'anexo', 'anexos') + '">' + H.ico('clip') + ' ' + nAnx + '</span>' : '') +
      // O chip do projeto abre o projeto (`pjAbrirDoCard`, admin.html e dev.html).
      (proj ? '<span class="qd-mini qd-proj" role="link" tabindex="0" data-qd-proj="' + attr(proj.codigo || proj.id) + '" title="' + attr((proj.nome || '') + ' — clique para abrir o projeto') + '">' + H.ico('folder') + ' ' + H.esc(proj.codigo || '') + '</span>' : '') +
      spCel +
      '<span class="qd-avs">' + (devs.length ? devs.slice(0, 3).map(function (n) { return H.av(n); }).join('') : H.av('')) + '</span>' + mover +
      '</span>' + (acao ? '<span class="qd-acao">' + acao + '</span>' : '') + '</a>';
  }

  /* A COLUNA. `o` = { rotulo, junto (as etapas que ela reune), lim, todos
     (o "e mais N" mostra o resto, como pede o painel do dev), extra }. Ela e o
     alvo do arraste (`data-solta`), com o motivo da trava ja no lugar. */
  function coluna(k, itens, o) {
    o = o || {};
    var e = H.ETAPA_POR_ID[k];
    var rot = o.rotulo || e.rotulo;
    var lim = o.lim || POR_PAGINA;
    var vis = itens.slice(0, lim);
    var resto = itens.length - vis.length;
    var cx = window.AXIS_ACOES && AXIS_ACOES.contexto ? AXIS_ACOES.contexto() : null;
    return '<section class="qd-col' + (itens.length ? '' : ' vazia') + '" data-col="' + k + '" data-solta="' + k + '" data-rot="' + attr(rot) + '"' +
      (o.junto ? ' data-junto="' + attr(o.junto.join(',')) + '"' : '') + ' aria-label="' + attr(rot) + '">' +
      '<div class="qd-ch"><span class="dotc" style="background:' + e.dot + '"></span>' +
      '<h2>' + H.esc(rot.toUpperCase()) + '</h2>' + (o.prod != null ? contador(k, rot, itens.length, o.total == null ? itens.length : o.total, o.prod)
        : '<span class="n" title="' + itens.length + ' nesta coluna · ordem: prioridade, depois a data prometida">' + itens.length + '</span>') +
      // A folha de decisao da etapa (aprovacao-ppt.js): o clique e de axis-tela-relatorios.js.
      (k === 'levantar_req' && window.AXIS_PPT ? '<button type="button" class="btns" data-axis-ppt="aprovacao" style="height:24px;padding:0 8px;margin-left:4px"' +
        ' title="Imprimir - Em aprovação de requisitos (PPT de todas as demandas da etapa)" aria-label="Imprimir - Em aprovação de requisitos">' + H.ico('printer') + '</button>' : '') +
      (k === 'negada' && !o.semRecolher ? '<button type="button" class="btns" data-acao-qd="negada" style="height:24px;padding:0 8px;margin-left:4px" title="Recolher" aria-label="Recolher Negada">' + H.ico('x') + '</button>' : '') +
      '</div><div class="qd-trava" role="status">' + H.ico('lock') + '<span></span></div>' +
      (vis.length ? vis.map(function (m) { return card(m, k, cx); }).join('') : '<div class="qd-vz">Nada aqui</div>') +
      (resto > 0 ? '<button type="button" class="qd-mais" data-mais="' + k + '">' +
        (o.todos ? 'e mais ' + resto : 'Mostrar mais ' + Math.min(resto, POR_PAGINA) + ' de ' + resto) + '</button>' : '') +
      (o.extra || '') +
      '</section>';
  }

  /* O CONTADOR DA COLUNA E UM BOTAO (`kbContadorHTML`, admin.html): abre o
     menu Tudo / No ar / Fora do ar / Em pausa (`menuProducao`). Filtrado, diz
     "5/18" com a marca; o title diz o filtro e quantas de quantas. */
  function contador(k, rot, exibidas, total, f) {
    var op = PROD_COL.filter(function (x) { return x[0] === (f || ''); })[0] || PROD_COL[0];
    var tit = f ? (op[2] ? op[2] + ' ' : '') + op[1] + ' · mostrando ' + exibidas + ' de ' + total + ' em ' + rot + '. Clique para trocar o filtro.'
      : 'Filtrar ' + rot + ': ' + PROD_COL.map(function (x) { return x[1]; }).join(', ') + '.';
    return '<button type="button" class="qd-cnt' + (f ? ' on' : '') + '" data-qd-prod="' + k + '" aria-haspopup="dialog" aria-label="' + attr(tit) + '" title="' + attr(tit) + '">' +
      // No celular a coluna ja tem nome e numero na aba: o botao diz o que filtra.
      '<span class="cr">' + H.esc(f ? op[1] : 'Produção: tudo') + ' · </span>' +
      H.esc((op[2] ? op[2] + ' ' : '') + (f ? exibidas + '/' + total : String(total))) + '</button>';
  }

  /* AS ABAS DAS ETAPAS NO CELULAR: uma por coluna, com a contagem. `cols` =
     [{ k, rotulo, n }]. No computador elas nao aparecem. */
  function abasEtapas(cols, ativa) {
    return '<div class="qd-etapas" role="tablist" aria-label="Etapas">' + cols.map(function (c, i) {
      var e = H.ETAPA_POR_ID[c.k];
      var on = ativa ? c.k === ativa : i === 0;
      return '<button type="button" role="tab" data-qd-etapa="' + c.k + '" aria-selected="' + on + '">' +
        '<span class="dotc" style="background:' + e.dot + '"></span>' + H.esc(c.rotulo || e.rotulo) + '<span class="n">' + c.n + '</span></button>';
    }).join('') + '</div>';
  }

  function opcao(v, rot, sel) {
    return '<option value="' + attr(v) + '"' + (v === sel ? ' selected' : '') + '>' + H.esc(rot) + '</option>';
  }

  function opcoesSistema(lista) {
    var usados = {};
    lista.forEach(function (m) { if (m.tema_id) usados[m.tema_id] = true; });
    var temas = ((AX.APP.D || {}).temas || []).filter(function (t) { return usados[t.id]; })
      .sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
    var porRaiz = {};
    temas.forEach(function (t) { var r = raizTema(t.nome); (porRaiz[r] = porRaiz[r] || []).push(t); });
    var h = opcao('', 'Todos', F.sistema);
    Object.keys(porRaiz).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }).forEach(function (r) {
      var ts = porRaiz[r];
      if (ts.length > 1) h += opcao('r:' + r, r + ' › todos', F.sistema);
      ts.forEach(function (t) { h += opcao('t:' + t.id, H.caminho(t.id), F.sistema); });
    });
    return h;
  }

  /* QUEM APARECE NO FILTRO DE DEV: quem tem trabalho aberto, mais o cadastro
     sem quem saiu do time — a regra de `devsComTrabalhoAberto` (admin.html). */
  function opcoesDev(lista, D) {
    var nomes = {};
    var fora = {};
    (D.devs_removidos || []).forEach(function (n) { fora[n] = true; });
    (D.desenvolvedores || []).forEach(function (n) { if (n && !fora[n]) nomes[n] = true; });
    lista.forEach(function (m) {
      var c = H.colunaDe(m);
      if (c === 'concluido' || c === 'negada') return;
      H.devsDe(m).forEach(function (n) { nomes[n] = true; });
    });
    var h = opcao('', 'Todos', F.dev) + opcao('__sem__', 'Sem dev', F.dev);
    Object.keys(nomes).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); })
      .forEach(function (n) { h += opcao(n, n, F.dev); });
    return h;
  }

  /* "SPRINT X TERMINOU E NAO FOI FECHADA" (`avisoSprintPendente`, admin.html),
     so para o PM/PO, com o atalho para fechar. */
  function avisoSprintPendente(ctx) {
    var S = window.SPRINTPO;
    if (ctx.papel !== 'admin' || !S || !S.pendentesDeFechamento) return '';
    var pend = S.pendentesDeFechamento(ctx.D, H.hoje(), ctx.D.feriados || [], H.colunaDe);
    if (!pend.length) return '';
    return '<a class="qd-alerta wn" href="#sprints/encerrar" title="Abre Sprints › Encerrar sprint">' + H.ico('refresh') + ' ' +
      (pend.length === 1 ? 'Sprint ' + H.esc(S.rotuloCurto(pend[0].rotulo)) + ' terminou e não foi fechada' : H.plural(pend.length, 'sprint', 'sprints') + ' terminaram sem fechar') +
      '<span class="qd-lg"> · Fechar agora</span></a>';
  }

  function montar(ctx) {
    var D = ctx.D;
    if (F.meus === null) F.meus = ctx.papel === 'dev' ? 'meu_fila' : '';
    if (!F.sprintPadrao && ctx.papel === 'dev') { F.sprintPadrao = true; if (sprintPadraoDev(ctx)) F.sprint = sprintPadraoDev(ctx); }
    var AC = window.AXIS_ACOES;
    var times = ctx.papel === 'dev' && AC && AC.times ? AC.times() : '';
    // A busca vem antes de tudo e vence o periodo das concluidas (`renderKanban`, admin.html).
    var todos = universo(ctx);
    var achadas = F.busca ? todos.filter(function (m) { return casaBusca(m, F.busca); }) : todos;
    // A contagem de cada frente sai do quadro ja filtrado, sem o filtro da frente.
    var filtradas = achadas.filter(function (m) { return casaFiltros(m, D); });
    var porFrente = {};
    filtradas.forEach(function (m) { var f = frenteDe(m, D); porFrente[f] = (porFrente[f] || 0) + 1; });
    if (F.frente && !porFrente[F.frente]) F.frente = '';
    var escopo = filtradas.filter(function (m) { return !F.frente || frenteDe(m, D) === F.frente; });
    /* A MESCLADA FICA FORA DAS COLUNAS, mas a busca avisa onde ela foi parar
       (`renderKbToolbar`, admin.html): calar daria "nao achei" sobre um card
       que existe. */
    var mescladas = F.busca ? ((D.melhorias || []).filter(function (m) { return m && m.mesclado_em && casaBusca(m, F.busca); })) : [];

    // ── Alertas: sobre o escopo, antes do filtro de vencidas ──
    var vencidas = escopo.filter(function (m) { return H.etapaDe(m) === 'atrasado'; });
    /* "A mais antiga" e a de entrega mais antiga, medida pela mesma regra do
       card — copia de `renderRiscoBanner` (admin.html). */
    var antiga = vencidas.filter(function (m) { return m.entrega; })
      .sort(function (a, b) { return String(a.entrega).localeCompare(String(b.entrega)); })[0];
    var diasAntiga = antiga ? (H.atrasoDe(antiga) || 0) : 0;
    var naArea = escopo.filter(function (m) { return H.colunaDe(m) === 'validacao_area'; });
    var cobrar = window.HOMOLOGACAO ? naArea.filter(function (m) { return HOMOLOGACAO.cobraHomologacao(m, H.hoje()); }).length : 0;
    var naVal = escopo.filter(function (m) { return H.colunaDe(m) === 'validacao'; });
    if (!vencidas.length) F.vencidas = false;

    var noQuadro = escopo.filter(function (m) { return !F.vencidas || H.etapaDe(m) === 'atrasado'; });
    var porCol = {};
    COLUNAS.concat(['negada']).forEach(function (k) { porCol[k] = []; });
    var escondidas = 0;
    noQuadro.forEach(function (m) {
      var k = H.colunaDe(m);
      if (!porCol[k]) return;
      // A busca e o filtro Producao vencem o periodo das concluidas (`renderKanban`, admin.html).
      if (!F.todasConcluidas && !F.busca && !doPeriodo(m) && !F.prod) { escondidas++; return; }
      porCol[k].push(m);
    });
    /* O MENU DO CONTADOR RECORTA A COLUNA DEPOIS DO RESTO: o total antes do
       recorte vai junto, para o contador dizer "5/18". */
    var totalCol = {};
    Object.keys(porCol).forEach(function (k) {
      totalCol[k] = porCol[k].length;
      if (F.prodCol[k]) porCol[k] = porCol[k].filter(function (m) { return casaProducao(m, F.prodCol[k], H.colunaDe(m), H.pausada(m)); });
    });
    var prometida = window.ENTREGAUSU && ENTREGAUSU.data;
    Object.keys(porCol).forEach(function (k) {
      porCol[k] = window.ORDEMKB ? ORDEMKB.ordena(porCol[k], prometida) : porCol[k];
    });

    var cab = cabecalhoSprint(ctx);
    var podeCriar = ctx.papel === 'admin' || ctx.papel === 'dev';
    var lsFrentes = frentes().filter(function (f) { return porFrente[f] || f === F.frente; });

    var h = '<div class="qd" style="display:flex;flex-direction:column;gap:18px;min-width:0">';
    // ── Cabecalho ──
    h += '<header style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px">' +
      '<div class="qd-cab" style="display:flex;flex-direction:column;gap:6px;min-width:0">' +
      (cab.kick ? '<span class="qd-kick">' + H.esc(cab.kick) + '</span>' : '') +
      '<h1 class="h1">Quadro</h1>' +
      (cab.sub ? '<span class="sub qd-sub">' + cab.sub + '</span>' : '') +
      '</div><div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;min-width:0;max-width:100%">' +
      // Uma frente so (o dev com "Só os meus") nao e escolha: o seletor some.
      (lsFrentes.length < 2 && !F.frente ? '' : '<div class="qd-seg" role="tablist" aria-label="Frente">' +
      '<button type="button" role="tab" data-frente="" aria-selected="' + (!F.frente) + '">Todas<span class="n">' + filtradas.length + '</span></button>' +
      lsFrentes.map(function (f) {
        return '<button type="button" role="tab" data-frente="' + attr(f) + '" aria-selected="' + (F.frente === f) + '">' + H.esc(f) +
          '<span class="n">' + (porFrente[f] || 0) + '</span></button>';
      }).join('') + '</div>') +
      (podeCriar ? '<button type="button" class="btnp qd-novo" data-axa-form="novo">+ Novo item</button>' : '') +
      '</div></header>';

    // ── Alertas e filtros ──
    // Para o dev o padrao e a sprint atual: "Todas" ou outra sprint contam como filtro.
    var sprintAtivo = sprintPadraoDev(ctx) ? !sprintEhPadrao(ctx) : !!F.sprint;
    // Cada coluna filtrada pelo contador conta um (o "Limpar (n)" do admin conta `_kbProdCol`).
    var ativos = (sprintAtivo ? 1 : 0) + (F.meus && times ? 1 : 0) + (F.tipo ? 1 : 0) + (F.sistema ? 1 : 0) + (!F.meus && F.dev ? 1 : 0) + (F.prazo ? 1 : 0) +
      (F.vencidas ? 1 : 0) + (F.frente ? 1 : 0) + (F.busca ? 1 : 0) + (F.prod ? 1 : 0) + (F.dados ? 1 : 0) + Object.keys(F.prodCol).length;
    h += '<div class="qd-barra"><div class="qd-alertas">';
    if (vencidas.length) {
      h += '<button type="button" class="qd-alerta dg' + (F.vencidas ? ' on' : '') + '" data-acao-qd="vencidas" aria-pressed="' + F.vencidas + '"' +
        ' title="' + (F.vencidas ? 'Mostrar o quadro inteiro' : 'Mostrar só as vencidas') + '">' +
        H.plural(vencidas.length, 'com prazo vencido', 'com prazo vencido') + (diasAntiga > 0 ? '<span class="qd-lg"> · mais antiga há ' + H.plural(diasAntiga, 'dia', 'dias') + '</span>' : '') + '</button>';
    }
    if (naArea.length) {
      h += '<button type="button" class="qd-alerta wn" data-ir-col="validacao_area" title="Ir à coluna Validação da área">' +
        naArea.length + ' aguardando homologação' + (cobrar ? '<span class="qd-lg"> · ' + cobrar + ' há 5+ dias</span>' : '') + '</button>';
    }
    if (naVal.length) {
      h += '<button type="button" class="qd-alerta wn" data-ir-col="validacao" title="Ir à coluna Validação PM/PO">' +
        naVal.length + ' aguardando validação PM/PO</button>';
    }
    h += avisoSprintPendente(ctx);
    /* Os filtros sao um bloco so, empurrado para a direita: quando nao cabem
       ao lado dos alertas, descem juntos para a linha de baixo. A busca fica
       fora do H.filtros: no celular ela continua a mao, ao lado do botao. */
    h += '</div><div class="qd-ferr">' +
      '<input type="search" id="qd-busca" class="in qd-busca" value="' + attr(F.busca) + '" placeholder="AX-179, título, dev, solicitante…"' +
      ' aria-label="Buscar no quadro por código, título, descrição, dev ou solicitante" autocomplete="off" enterkeyhint="search">';
    // No celular os filtros recolhem no botao "Filtros (n)" (H.filtros); `h` volta depois.
    var antesFl = h; h = '';
    // A frente, que no computador e o seletor do cabecalho, no celular vai para a gaveta.
    if (lsFrentes.length > 1 || F.frente) {
      h += '<span class="qd-par qd-so-cel"><label class="qd-fl" for="qd-frente">Frente</label><select id="qd-frente" class="in qd-sel" data-filtro="frente">' +
        opcao('', 'Todas (' + filtradas.length + ')', F.frente) +
        lsFrentes.map(function (f) { return opcao(f, f + ' (' + (porFrente[f] || 0) + ')', F.frente); }).join('') + '</select></span>';
    }
    if (ctx.papel === 'dev') {
      // "Mostrar" do painel do dev (82bff39): o que e seu e o que e fila, bem separados.
      h += '<span class="qd-par"><label class="qd-fl" for="qd-mostrar">Mostrar</label><select id="qd-mostrar" class="in qd-sel" data-filtro="meus"' +
        ' title="Separa as demandas no seu nome das que estão na fila do time.">' +
        opcao('meu_fila', 'No meu nome + fila do time', F.meus) + opcao('meu', 'Só no meu nome', F.meus) +
        opcao('fila', 'Só a fila do time', F.meus) + opcao('', 'Todo o quadro', F.meus) + '</select></span>';
      // "Times" (5c849fb): por padrao so o seu time; a escolha soma a fila e a vitrine do outro.
      if (F.meus && AC && AC.times) {
        h += '<span class="qd-par"><label class="qd-fl" for="qd-times">Times</label><select id="qd-times" class="in qd-sel" data-filtro="times"' +
          ' title="Por padrão aparece só o seu time. Escolha outro para ver a fila dele e poder ajudar.">' +
          opcao('', 'Só o meu time', times) + opcao('dados', '+ Dados/BI', times) + opcao('sales', '+ Sales Ops', times) +
          opcao('todos', 'Todos os times', times) + '</select></span>';
      }
    }
    // Rotulo e seletor andam juntos: no celular a linha quebra entre pares, nunca no meio.
    if (window.AXIS_SPRINTS) {
      h += '<span class="qd-par"><span class="qd-fl">Sprint</span>' + AXIS_SPRINTS.controle('qd-sprint', F.sprint, AXIS_SPRINTS.opcoes(todos), function (v) {
        F.sprint = v; F.mais = {};
        var vz = document.getElementById('vista');
        if (vz) redesenhar(vz, ctx);
      }, 'qd-sel') + '</span>';
    }
    h += '<span class="qd-par"><label class="qd-fl" for="qd-tipo">Tipo</label><select id="qd-tipo" class="in qd-sel" data-filtro="tipo">' +
      opcao('', 'Todos', F.tipo) + opcao('evolucao', 'Evolução', F.tipo) + opcao('sustentacao', 'Sustentação', F.tipo) + opcao('__sem__', 'Sem tipo', F.tipo) + '</select></span>' +
      '<span class="qd-par"><label class="qd-fl" for="qd-sis">Sistema</label><select id="qd-sis" class="in qd-sel" data-filtro="sistema">' + opcoesSistema(todos) + '</select></span>';
    if (!F.meus) h += '<span class="qd-par"><label class="qd-fl" for="qd-dev">Dev</label><select id="qd-dev" class="in qd-sel" data-filtro="dev">' + opcoesDev(todos, D) + '</select></span>';
    h += '<span class="qd-par"><label class="qd-fl" for="qd-prazo">Prazo</label><select id="qd-prazo" class="in qd-sel" data-filtro="prazo">' +
      PRAZOS.map(function (p) { return opcao(p[0], p[1], F.prazo); }).join('') + '</select></span>';
    /* PRODUCAO E DADOS/BI (`renderKbToolbar`, admin.html), com a contagem de
       cada opcao sobre a base inteira, como `opcoesProducao` e `opcoesDados`. */
    var base = (D.melhorias || []).filter(function (m) { return m && !m.mesclado_em; });
    var nDe = function (fn) { return base.filter(fn).length; };
    h += '<span class="qd-par"><label class="qd-fl" for="qd-prod">Produção</label><select id="qd-prod" class="in qd-sel" data-filtro="prod">' +
      PRODUCAO.map(function (p) {
        return opcao(p[0], p[1] + ' (' + (p[0] ? nDe(function (m) { return casaProducao(m, p[0], H.colunaDe(m), H.pausada(m)); }) : (D.melhorias || []).length) + ')', F.prod);
      }).join('') + '</select></span>' +
      '<span class="qd-par"><label class="qd-fl" for="qd-dados">Dados/BI</label><select id="qd-dados" class="in qd-sel" data-filtro="dados" title="Pela marca da demanda: do time de Dados/BI, de Sales Ops ou fora de Dados">' +
      DADOS.map(function (p) {
        return opcao(p[0], p[1] + ' (' + (p[0] ? nDe(function (m) { return casaDados(m, p[0]); }) : (D.melhorias || []).length) + ')', F.dados);
      }).join('') + '</select></span>';
    if (ativos) h += '<button type="button" class="btns" data-acao-qd="limpar">Limpar (' + ativos + ')</button>';
    /* O REPASSE EM LOTE (`sprintLoteAbrir`, admin.html: o botao fica na barra do
       Kanban, de onde se ve o que falta alocar). So o dono da sprint. O lote
       e o de Sprints (axis-tela-sprints.js), aberto no Planning da sprint atual. */
    if (H.donoDaSprint && H.donoDaSprint()) h += '<button type="button" class="btns" data-acao-qd="lote" title="Repassar várias demandas para uma sprint de uma vez">' + H.ico('refresh') + ' Sprint em lote</button>';
    // O numero do botao conta so o que esta dentro da gaveta: o alerta e a busca ficam a vista.
    h = antesFl + H.filtros(h, ativos - (F.vencidas ? 1 : 0) - (F.busca ? 1 : 0), { id: 'quadro' });
    h += '</div></div>';
    if (F.busca) {
      var achou = COLUNAS.reduce(function (t, k) { return t + porCol[k].length; }, 0) + porCol.negada.length;
      h += '<div class="qd-nota" role="status">Busca em todos os períodos: <b>' + H.plural(achou, 'demanda', 'demandas') + '</b> com “' + H.esc(F.busca) + '”.' +
        mescladas.map(function (x) {
          var pai = porId(x.mesclado_em);
          return '<br>' + H.esc((x.codigo ? x.codigo + ' · ' : '') + (x.titulo || '')) + ' → mesclada em ' +
            (pai ? '<a href="' + H.hrefItem(pai) + '">' + H.esc((pai.codigo ? pai.codigo + ' · ' : '') + (pai.titulo || '')) + '</a>' : 'outra demanda');
        }).join('') + '</div>';
    }

    // ── O quadro ──
    var total = COLUNAS.reduce(function (t, k) { return t + porCol[k].length; }, 0) + porCol.negada.length;
    if (!total && !escondidas) {
      h += '<div class="pn">' + H.vazio('board', F.busca ? 'Nenhuma demanda com “' + H.esc(F.busca) + '”' : F.meus ? 'Nada seu no quadro com estes filtros' : 'Nada no quadro com estes filtros',
        F.meus ? 'Em "Mostrar", escolha "Todo o quadro" para ver o quadro do time.' : 'Troque a frente ou limpe os filtros.',
        ativos || F.meus ? '<button type="button" class="btn" data-acao-qd="' + (F.meus && !ativos ? 'meus' : 'limpar') + '">' + (F.meus && !ativos ? 'Ver o quadro do time' : 'Limpar filtros') + '</button>' : '') + '</div>';
    } else {
      var abas = COLUNAS.map(function (k) { return { k: k, n: porCol[k].length }; }).concat([{ k: 'negada', n: porCol.negada.length }]);
      h += abasEtapas(abas, F.etapa);
      h += '<div id="qd-rolo" class="qd-rolo"><div class="qd-board">';
      COLUNAS.forEach(function (k) {
        var extra = '';
        if (k === 'concluido' && (escondidas || F.todasConcluidas)) {
          extra = '<button type="button" class="qd-mais" data-acao-qd="periodo" title="Concluídas e negadas: por padrão só as deste mês, como no admin">' +
            (F.todasConcluidas ? 'Só as deste mês' : '+ ' + escondidas + ' de outros meses') + '</button>';
        }
        h += coluna(k, porCol[k], { lim: F.mais[k] || POR_PAGINA, extra: extra, prod: F.prodCol[k] || '', total: totalCol[k] });
      });
      if (F.negadaAberta) h += coluna('negada', porCol.negada, { lim: F.mais.negada || POR_PAGINA, prod: F.prodCol.negada || '', total: totalCol.negada });
      else h += '<button type="button" class="qd-neg" data-acao-qd="negada" data-solta="negada" data-rot="Negada" title="Mostrar as negadas"><span class="dotc" style="background:var(--dg)"></span>' +
        '<span class="v">NEGADA</span><span class="n">' + porCol.negada.length + '</span></button>';
      h += '</div></div>';
    }
    h += '</div>';
    return h;
  }

  // ══ A DEMANDA POR CIMA DO QUADRO ══════════════════════════════════════
  /* A GAVETA COM O ITEM. Quem desenha e a propria tela Item (o `render` e o
     `depois` dela, registrados no nucleo), com uma rota de mentira: o mesmo
     Detalhe, os mesmos botoes, a mesma gravacao. Depois de gravar o nucleo
     redesenha a tela de baixo, e ela chama `pintaItem` para a gaveta mostrar
     a demanda como ficou. Em validacao, a gaveta abre na entrega. */
  var GV = null;
  function abrirItem(m, o) {
    o = o || {};
    if (!m) return;
    var t = AX.APP.telas && AX.APP.telas.item;
    if (!t || !H.gaveta) { location.hash = H.hrefItem(m); return; }
    if (GV) GV.g.fechar();
    css();
    var t0 = Date.now();
    var g = H.gaveta({ titulo: (m.codigo || 'Demanda') + ' · ' + (m.titulo || ''), html: '',
      pe: '<a class="btn" href="' + H.hrefItem(m) + '">' + H.ico('external') + ' Abrir a página do item</a>',
      aoFechar: function () { GV = null; if (o.aoFechar) o.aoFechar(); } });
    var fundo = g.el.parentNode;
    g.el.classList.add('qd-gvi');
    fundo.classList.add('qd-gvf');
    // O segundo clique do duplo clique cai no fundo: ele nao fecha a gaveta que acabou de abrir.
    fundo.addEventListener('click', function (e) { if (e.target === fundo && Date.now() - t0 < 500) e.stopImmediatePropagation(); }, true);
    GV = { g: g, id: m.id };
    pintaItem(true);
  }
  /* A CAIXA ABERTA POR CIMA DA GAVETA (validar, devolver, o formulario) fica
     com o teclado: o Esc fecha a caixa, e nao a gaveta de baixo, e o Tab nao
     e puxado de volta para a gaveta. Na captura da janela, antes do nucleo. */
  window.addEventListener('keydown', function (e) {
    if (!GV || (e.key !== 'Escape' && e.key !== 'Tab')) return;
    var cima = [].slice.call(document.querySelectorAll('.qd-gvf ~ .ovl')).pop();
    if (!cima) return;
    e.stopPropagation();
    if (e.key !== 'Escape') return;
    e.preventDefault();
    var x = cima.querySelector('[data-axc="nao"], [data-axf="fechar"], .dlg-x');
    if (x) x.click();
  }, true);

  function pintaItem(naEntrega) {
    if (!GV) return;
    if (!GV.g.el.isConnected) { GV = null; return; }
    var m = porId(GV.id);
    var t = AX.APP.telas && AX.APP.telas.item;
    if (!m || !t) { GV.g.fechar(); return; }
    var r = { tela: 'item', aba: '', param: String(m.codigo || m.id) };
    var cx = { D: AX.APP.D, eu: AX.APP.eu || {}, papel: AX.APP.papel, aba: '', param: r.param, rota: r, H: H };
    var corpo = GV.g.corpo;
    var rol = corpo.scrollTop;
    var novo = document.createElement('div');
    novo.className = 'qd-it';
    try {
      var out = t.render(novo, cx);
      if (typeof out === 'string') novo.innerHTML = out;
      corpo.innerHTML = '';
      corpo.appendChild(novo);
      if (t.depois) t.depois(novo, cx);
    } catch (e) {
      console.error(e);
      corpo.innerHTML = H.vazio('alert', 'Não deu para abrir a demanda aqui', String(e && e.message || e), '<a class="btn" href="' + H.hrefItem(m) + '">Abrir a página do item</a>');
    }
    var tt = GV.g.el.querySelector('.gv-t');
    if (tt) tt.textContent = (m.codigo || 'Demanda') + ' · ' + (m.titulo || '');
    var ent = naEntrega && ['validacao', 'validacao_area'].indexOf(H.colunaDe(m)) >= 0 ? novo.querySelector('#it-entrega') : null;
    if (ent) corpo.scrollTop += ent.getBoundingClientRect().top - corpo.getBoundingClientRect().top - 8;
    else if (!naEntrega) corpo.scrollTop = rol;
  }

  // ══ OS GESTOS DO QUADRO: clique, arraste, "Mover para…" e as etapas ═══
  var OCUPADO = false;
  function juntoDe(alvo) {
    var j = alvo && alvo.getAttribute('data-junto');
    return j ? j.split(',') : null;
  }

  /** Solta a demanda na coluna `k`: a regra diz o gesto, o gesto grava. */
  async function soltar(m, k, junto) {
    var AC = window.AXIS_ACOES;
    if (!AC || !AC.soltarEm || !m) return;
    var r = AC.soltarEm(m, k, AC.contexto(), junto);
    if (r.via === 'nada') return;
    if (r.via === 'recusa') {
      H.toast(r.erro, 'erro');
      /* O card abre onde se conserta (dev.html abre o card nos dois casos):
         o solicitante no formulario, a homologacao no Item. */
      if (r.campo === 'solicitante' && window.AXIS_FORM && AC.podeEditar(m)) AXIS_FORM.abrir(m, { foco: 'solicitante' });
      else if (r.campo === 'homologacao' || r.campo === 'solicitante') abrirItem(m);
      return;
    }
    if (OCUPADO) return;
    OCUPADO = true;
    try {
      if (r.via === 'mover') {
        var out = await AC.aplicar('mover', m, { destino: r.destino });
        /* A RECUSA ABRE ONDE SE CONSERTA (`kbDrop`, admin.html): o campo do
           formulario o `recusa` de axis-acoes.js ja abre (responsavel, sprint,
           horas, solicitante); a homologacao e as assinaturas do spike sao da
           entrega, no Item. */
        if (out && out.ok === false && (out.campo === 'homologacao' || (m.spike && r.destino === 'concluido' && !out.campo))) abrirItem(m);
      }
      else if (r.via === 'entregar') await AC.GESTOS.entregar(m, { getAttribute: function () { return r.destino; } });
      else if (r.via === 'negar') await AC.GESTOS.negar(m);
    } catch (e) {
      console.error(e);
      H.toast('Não foi possível mover: ' + (e.message || e), 'erro');
    } finally { OCUPADO = false; }
  }

  /* AS ETAPAS NO CELULAR: a coluna mais perto do inicio da rolagem e a ativa;
     a aba dela acende, e a altura do quadro e a dela (as outras colunas nao
     esticam a pagina). `rolar` leva a rolagem a etapa guardada. */
  function celular(rolo) { return !!rolo && /x/.test(getComputedStyle(rolo).scrollSnapType || ''); }
  function sincEtapa(el, est, rolar) {
    var rolo = el.querySelector('.qd-rolo');
    if (!rolo) return;
    if (!celular(rolo)) { rolo.style.maxHeight = ''; return; }
    var cs = [].slice.call(rolo.querySelectorAll('.qd-col[data-col]'));
    if (!cs.length) return;
    if (rolar && est.etapa) {
      var alvo = cs.find(function (c) { return c.getAttribute('data-col') === est.etapa; });
      if (alvo) rolo.scrollLeft = alvo.offsetLeft;
    }
    var at = cs[0], dist = Infinity;
    cs.forEach(function (c) { var d = Math.abs(c.offsetLeft - rolo.scrollLeft); if (d < dist) { dist = d; at = c; } });
    var k = at.getAttribute('data-col');
    est.etapa = k;
    var tabs = el.querySelector('.qd-etapas');
    if (tabs) [].forEach.call(tabs.querySelectorAll('[data-qd-etapa]'), function (b) {
      var on = b.getAttribute('data-qd-etapa') === k;
      if ((b.getAttribute('aria-selected') === 'true') !== on) b.setAttribute('aria-selected', String(on));
      if (on && (b.offsetLeft < tabs.scrollLeft || b.offsetLeft + b.offsetWidth > tabs.scrollLeft + tabs.clientWidth)) tabs.scrollLeft = b.offsetLeft - 16;
    });
    rolo.style.maxHeight = (at.offsetHeight + 2) + 'px';
  }
  function irEtapa(el, est, k, abre) {
    var rolo = el.querySelector('.qd-rolo');
    var col = rolo && rolo.querySelector('.qd-col[data-col="' + k + '"]');
    est.etapa = k;
    if (!col) { if (abre) abre(k); return; }
    rolo.style.maxHeight = (col.offsetHeight + 2) + 'px';
    rolo.scrollTo({ left: col.offsetLeft, behavior: 'smooth' });
  }

  // Girar o celular ou mudar a janela entre os dois desenhos refaz a altura da etapa.
  var _resizeT = 0;
  window.addEventListener('resize', function () {
    clearTimeout(_resizeT);
    _resizeT = setTimeout(function () {
      var v = document.getElementById('vista');
      if (v && v.__qdGestos) sincEtapa(v, v.__qdGestos.est, true);
    }, 150);
  });

  /* O QUE SE ABRE DE DENTRO DO CARD: a linha de vinculo (`ligaCliqueVinculo`,
     dev.html) abre a outra demanda na gaveta; o chip do projeto
     (`pjAbrirDoCard`) leva ao projeto. Devolve true quando tratou. */
  function abreDoCard(alvo, el) {
    var v = alvo && alvo.closest && alvo.closest('[data-qd-ver]');
    if (v && el.contains(v)) { var m = porId(v.getAttribute('data-qd-ver')); if (m) abrirItem(m); return true; }
    var p = alvo && alvo.closest && alvo.closest('[data-qd-proj]');
    if (p && el.contains(p)) { location.hash = '#projeto/' + p.getAttribute('data-qd-proj'); return true; }
    return false;
  }

  var ARR = null;
  /** Liga os gestos comuns do Quadro e do Meu trabalho, uma vez por vista.
   *  `o` = { estado (guarda a etapa do celular), abre(k) (coluna que ainda
   *  nao esta desenhada, como a Negada recolhida) }. */
  function ligarQuadro(el, o) {
    o = o || {};
    var est = o.estado || {};
    if (el.__qdGestos) { el.__qdGestos.est = est; el.__qdGestos.abre = o.abre; return; }
    var G = el.__qdGestos = { est: est, abre: o.abre };
    el.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-qd-etapa]');
      if (tab && el.contains(tab)) { irEtapa(el, G.est, tab.getAttribute('data-qd-etapa'), G.abre); return; }
      // A linha de vinculo abre a outra demanda; o chip do projeto abre o projeto. O card nao abre junto.
      if (abreDoCard(e.target, el)) { e.preventDefault(); return; }
      var cd = e.target.closest('a.qd-card[data-qd-id]');
      if (!cd || !el.contains(cd) || e.target.closest('button, input, select, [data-axa-acao]')) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      abrirItem(porId(cd.getAttribute('data-qd-id')));
    });
    // ── Arraste (HTML5 drag and drop, como os dois quadros antigos) ──
    function limpa() {
      [].forEach.call(el.querySelectorAll('.qd-card.arrasta'), function (c) { c.classList.remove('arrasta'); });
      [].forEach.call(el.querySelectorAll('.solta, .trava'), function (c) { c.classList.remove('solta', 'trava'); });
    }
    el.addEventListener('dragstart', function (e) {
      var c = e.target.closest && e.target.closest('.qd-card[draggable="true"]');
      if (!c || !el.contains(c)) return;
      ARR = { id: c.getAttribute('data-qd-id'), cache: {} };
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.querySelector('.qd-cod') ? c.querySelector('.qd-cod').textContent : ''); } catch (_) {}
      setTimeout(function () { c.classList.add('arrasta'); }, 0);
    });
    el.addEventListener('dragover', function (e) {
      if (!ARR) return;
      var alvo = e.target.closest('[data-solta]');
      if (!alvo || !el.contains(alvo)) return;
      var k = alvo.getAttribute('data-solta');
      var AC = window.AXIS_ACOES;
      var m = porId(ARR.id);
      if (!(k in ARR.cache)) {
        var cx = AC.contexto();
        var pode = !!(m && AC.podeSoltar(m, k, cx));
        ARR.cache[k] = { pode: pode, motivo: pode ? '' : (AC.soltarEm(m, k, cx, juntoDe(alvo)).erro || '') };
      }
      var r = ARR.cache[k];
      /* A COLUNA FECHADA DIZ QUE E FECHADA ANTES DO SOLTA (`onDragOver`,
         dev.html): apagada, com o motivo, e o cursor de "nao pode". */
      if (!alvo.classList.contains(r.pode ? 'solta' : 'trava')) {
        [].forEach.call(el.querySelectorAll('.solta, .trava'), function (c) { c.classList.remove('solta', 'trava'); });
        alvo.classList.add(r.pode ? 'solta' : 'trava');
        var tv = alvo.querySelector('.qd-trava span');
        if (tv) tv.textContent = r.motivo;
      }
      if (!r.pode) { e.dataTransfer.dropEffect = 'none'; return; }
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    el.addEventListener('dragleave', function (e) {
      var alvo = e.target.closest && e.target.closest('[data-solta]');
      if (alvo && !alvo.contains(e.relatedTarget)) alvo.classList.remove('solta', 'trava');
    });
    el.addEventListener('drop', function (e) {
      if (!ARR) return;
      var alvo = e.target.closest('[data-solta]');
      if (!alvo || !el.contains(alvo)) return;
      e.preventDefault();
      var id = ARR.id;
      ARR = null;
      limpa();
      soltar(porId(id), alvo.getAttribute('data-solta'), juntoDe(alvo));
    });
    el.addEventListener('dragend', function () { ARR = null; limpa(); });
    el.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && abreDoCard(e.target, el)) e.preventDefault();
    });
    // ── As etapas do celular acompanham o deslize ──
    var quadro = 0;
    el.addEventListener('scroll', function (e) {
      if (!e.target.classList || !e.target.classList.contains('qd-rolo')) return;
      if (quadro) return;
      quadro = requestAnimationFrame(function () { quadro = 0; sincEtapa(el, G.est, false); });
    }, true);
  }

  // ── Eventos ──────────────────────────────────────────────────────────
  function redesenhar(el, ctx) {
    var rolo = el.querySelector('#qd-rolo');
    var x = rolo ? rolo.scrollLeft : 0;
    var y = window.scrollY;
    el.innerHTML = montar(ctx);
    var novo = el.querySelector('#qd-rolo');
    if (novo) novo.scrollLeft = x;
    sincEtapa(el, F, true);
    window.scrollTo(0, y);
  }

  /* O MENU DO CONTADOR (`kbProdMenu` + `kbProdEscolhe`, admin.html): a
     escolha recorta so aquela coluna; "Tudo" apaga a chave. Numa caixa do app,
     que no celular ocupa a tela. O foco volta ao contador. */
  async function menuProducao(el, ctx, k, rot) {
    var AC = window.AXIS_ACOES;
    if (!AC || !AC.caixa) return;
    var e = H.ETAPA_POR_ID[k] || { rotulo: k };
    var v = await AC.caixa({ titulo: 'Filtrar ' + e.rotulo, texto: rot,
      campos: [{ nome: 'f', tipo: 'opcoes', valor: F.prodCol[k] || '', opcoes: PROD_COL.map(function (x) { return { v: x[0], r: (x[2] ? x[2] + ' ' : '') + x[1] }; }) }],
      ok: 'Aplicar' });
    if (!v) return;
    if (v.f) F.prodCol[k] = v.f; else delete F.prodCol[k];
    redesenhar(el, ctx);
    var b = el.querySelector('[data-qd-prod="' + k + '"]');
    if (b) b.focus();
  }

  /* SPRINT EM LOTE: o lote mora em Sprints (`abrirLote`, axis-tela-sprints.js),
     no Planning da sprint atual; a tela vai para la e abre o lote. */
  function abrirLote() {
    var r = H.sprintAtual();
    H.ir('sprints/planning' + (r ? '/' + r : ''));
    var t0 = Date.now();
    (function espera() {
      var b = document.querySelector('#vista [data-sp-ciclo="lote"]');
      if (b) { b.click(); return; }
      if (Date.now() - t0 < 4000) setTimeout(espera, 120);
    })();
  }

  var _buscaT = 0;
  function ligar(el, ctx) {
    ligarQuadro(el, { estado: F, abre: function (k) {
      if (k === 'negada') { F.negadaAberta = true; F.etapa = 'negada'; redesenhar(el, ctx); }
    } });
    if (el.__qdLigado) return;
    el.__qdLigado = true;
    el.addEventListener('click', function (e) {
      var pc = e.target.closest('[data-qd-prod]');
      if (pc && el.contains(pc)) { e.preventDefault(); menuProducao(el, ctx, pc.getAttribute('data-qd-prod'), pc.getAttribute('aria-label') || ''); return; }
      var b = e.target.closest('[data-frente],[data-acao-qd],[data-mais],[data-ir-col]');
      if (!b || !el.contains(b)) return;
      if (b.getAttribute('data-acao-qd') === 'lote') { abrirLote(); return; }
      if (b.hasAttribute('data-frente')) { F.frente = b.getAttribute('data-frente'); F.mais = {}; }
      else if (b.hasAttribute('data-mais')) { var k = b.getAttribute('data-mais'); F.mais[k] = (F.mais[k] || POR_PAGINA) + POR_PAGINA; }
      else if (b.hasAttribute('data-ir-col')) {
        var alvo = b.getAttribute('data-ir-col');
        var col = el.querySelector('.qd-col[data-col="' + alvo + '"]');
        var rolo = el.querySelector('#qd-rolo');
        if (col && rolo) {
          if (celular(rolo)) { irEtapa(el, F, alvo); return; }
          rolo.scrollTo({ left: col.offsetLeft - 8, behavior: 'smooth' });
          col.classList.add('foco');
          setTimeout(function () { col.classList.remove('foco'); }, 1600);
        }
        return;
      } else {
        var a = b.getAttribute('data-acao-qd');
        if (a === 'vencidas') F.vencidas = !F.vencidas;
        else if (a === 'meus') { F.meus = F.meus ? '' : 'meu_fila'; F.mais = {}; }
        else if (a === 'periodo') F.todasConcluidas = !F.todasConcluidas;
        else if (a === 'negada') { F.negadaAberta = !F.negadaAberta; if (F.negadaAberta) F.etapa = 'negada'; else if (F.etapa === 'negada') F.etapa = ''; }
        else if (a === 'limpar') {
          // O Limpar do dev volta a sprint atual e ao seu time, que sao o padrao.
          F.tipo = F.sistema = F.dev = F.frente = F.prazo = F.busca = F.prod = F.dados = ''; F.prodCol = {}; F.sprint = sprintPadraoDev(ctx); F.vencidas = false; F.mais = {};
          if (window.AXIS_ACOES && AXIS_ACOES.times) AXIS_ACOES.times('');
        }
      }
      redesenhar(el, ctx);
    });
    el.addEventListener('change', function (e) {
      var s = e.target.closest('[data-filtro]');
      if (!s) return;
      if (s.getAttribute('data-filtro') === 'times') { if (window.AXIS_ACOES) AXIS_ACOES.times(s.value); }
      else F[s.getAttribute('data-filtro')] = s.value;
      F.mais = {};
      redesenhar(el, ctx);
      var de = el.querySelector('[data-filtro="' + s.getAttribute('data-filtro') + '"]');
      if (de) de.focus();
    });
    /* A busca redesenha a cada pausa da digitacao e devolve o foco e o cursor
       ao campo, que nasce de novo no redesenho. */
    el.addEventListener('input', function (e) {
      if (e.target.id !== 'qd-busca') return;
      var v = e.target.value, pos = e.target.selectionStart;
      clearTimeout(_buscaT);
      _buscaT = setTimeout(function () {
        if (F.busca === v.trim()) return;
        F.busca = v.trim(); F.mais = {};
        redesenhar(el, ctx);
        var b = el.querySelector('#qd-busca');
        if (b) { b.focus(); try { b.setSelectionRange(pos, pos); } catch (_) {} }
      }, 220);
    });
    el.addEventListener('keydown', function (e) {
      if (e.target.id === 'qd-busca' && e.key === 'Escape' && e.target.value) { e.preventDefault(); e.target.value = ''; F.busca = ''; redesenhar(el, ctx); var b = el.querySelector('#qd-busca'); if (b) b.focus(); }
    });
  }

  /* Para o Meu trabalho (axis-tela-inicio.js) e para a suite: o mesmo card, a
     mesma coluna, as abas das etapas, os gestos e a gaveta do Item. */
  window.AXIS_QUADRO = {
    css: css, card: card, coluna: coluna, abasEtapas: abasEtapas, COLUNAS_DEV: COLUNAS_DEV,
    ligarQuadro: ligarQuadro, sincEtapa: sincEtapa, abrirItem: abrirItem, pintaItem: pintaItem,
    casaBusca: casaBusca, casaPrazo: casaPrazo, dataNoCard: dataNoCard, faixaDevolucao: faixaDevolucao,
    casaProducao: casaProducao, casaDados: casaDados, vinculosDe: vinculosDe, htmlVinculos: htmlVinculos, grillPendente: grillPendente
  };

  AX.tela({
    id: 'quadro',
    rotulo: 'Quadro',
    papeis: ['admin', 'analista', 'dev'],
    titulo: function () { return 'Quadro'; },
    render: function (el, ctx) { css(); return montar(ctx); },
    depois: function (el, ctx) { ligar(el, ctx); sincEtapa(el, F, true); pintaItem(false); }
  });
})();
