/* ─────────────────────────────────────────────────────────────────────────
   AXIS — tela Planejamento (axis.html#planejamento; prototipo EP-013:
   Sprints.dc.html, visao "Planejamento").

   E O GANTT (gantt.html) DENTRO DO APP. A linha do tempo por dev, com uma
   barra por demanda do inicio ao prazo do dev (`inicio` e `entrega`, os
   campos que o gantt sempre gravou), e a fila do que esta pronto para entrar
   nela: Planning com pontos do Poker. O que muda e a regua: o gantt mostrava
   o mes; aqui a janela e de sprints (1, 2, 4 ou 8), como no prototipo, e as
   setas andam de sprint em sprint.

   O QUE SE FAZ AQUI, E O PATCH DE CADA GESTO (o mesmo do gantt.html):
     arrastar da fila para a linha   onLayerDrop/onDayDrop (backlog):
                                     { dev, inicio: dia, entrega: dia } e, se
                                     a etapa e anterior a Planejado,
                                     `promoveAoAgendar` (status_planejamento
                                     'planejado', status 'estimada') — so com
                                     sprint, pela trava do sprint.js;
     arrastar a barra                onLayerDrop (card): { inicio, entrega }
                                     andando os dias uteis do arraste, e
                                     `dev` quando cai na linha de outra pessoa;
     puxar as pontas da barra        { inicio } ou { entrega } — o gantt nao
                                     tinha; e o mesmo campo do formulario;
     voltar ao backlog               returnToBacklog: { inicio: '', entrega:
                                     '', dev: '', status_planejamento:
                                     'backlog' };
     ausencias                       addAusencia/removeAusencia: a lista
                                     `ausencias` inteira, { id, dev, tipo,
                                     inicio, fim, obs } — aqui tambem editar;
     feriados                        a lista `feriados` ({ data, nome }). Nao
                                     havia tela para ela (o gantt so lia).

   QUEM PODE O QUE. O gantt gravava so por `publish` (admin). Aqui grava
   `H.gravar`: admin por `publish`, analista por `dev-publish`. Por isso:
     - mover, alocar e ausencia: `H.pode('editar')` (admin e analista);
     - data de demanda comprometida (Planejado em diante) so o PM/PO muda — o
       `dev-publish` devolve a data do servidor (`travaDatasComprometidas`), e
       a tela trava antes, em vez de "salvar" algo que volta;
     - sprint do PM/PO: so o dono da sprint (`SPRINTPO.ehDonoDaSprint`, o
       mesmo corte do gantt.html); feriado: so admin (`configurar`);
     - o dev e a consulta... o dev ve o quadro e abre o item; a consulta nao
       entra, como no gantt ("o planejamento altera datas de todo mundo").

   AS CONTAS SAO DOS MODULOS: sprints, faixas, capacidade (30 por pessoa) e
   sugestao de corte sao do sprint.js; pontos planejados e "sem pontuacao" do
   capacidade.js; herdada, etapas que herdam e prazo do prazo.js; etapa do
   etapa-demanda.js; frente do pipelines.js; ordem da fila do ordem-kanban.js;
   selo do selo-validacao.js. A tela so recorta pela janela e desenha.

   O QUE FICOU NO gantt.html, e por que: juntar demandas (mesclar e do editor,
   como no formulario do app), gerenciar devs e juntar dois nomes da mesma
   pessoa (cadastro, nao planejamento), o resumo e o ranking do mes (estao em
   Paineis e Fechamento), o link de visualizacao sem login e criar demanda
   clicando no dia vazio (o formulario do app nao recebe dev e data prontos;
   "+ Nova demanda" continua no topo).
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var raiz = typeof window !== 'undefined' ? window : globalThis;
  var AX = raiz.AXIS_APP;
  if (!AX) return;
  var H = AX.H;
  var esc = H.esc, ico = H.ico, chip = H.chip;

  // ── Regras copiadas (com a origem) ─────────────────────────────────────
  /* COPIA de ETAPAS_DATA_TRAVADA (worker.js, `travaDatasComprometidas`): a
     partir de Planejado a data e do PM/PO e o `dev-publish` a devolve. */
  var ETAPAS_DATA_TRAVADA = ['planejado', 'em_andamento', 'validacao_area', 'validacao', 'concluido'];
  /* COPIA de ETAPAS_ANTES_DE_PLANEJADO (gantt.html, `promoveAoAgendar`). */
  var ETAPAS_ANTES_DE_PLANEJADO = ['backlog', 'levantar_req', 'planning'];
  /* COPIA de AUSENCIA_TIPOS (gantt.html), com as cores do AXIS — a mesma
     copia da tela Configuracoes. */
  var AUS = {
    ferias:   { rot: 'Férias',   cor: 'tl' },
    atestado: { rot: 'Atestado', cor: 'dg' },
    folga:    { rot: 'Folga',    cor: 'in' },
    outro:    { rot: 'Outro',    cor: 'pu' }
  };
  var AUS_ORDEM = ['ferias', 'atestado', 'folga', 'outro'];
  // A largura minima do dia por zoom: abaixo disso o titulo da barra some.
  var ZOOMS = [
    { n: 1, rot: '1 sprint',  min: 64 },
    { n: 2, rot: '2 sprints', min: 52 },
    { n: 4, rot: '4 sprints', min: 34 },
    { n: 8, rot: '8 sprints', min: 22 }
  ];
  var DS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  var SP = function () { return raiz.SPRINTPO; };
  function fer(D) { return (D && D.feriados) || []; }
  function iso(v) { var s = String(v == null ? '' : v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
  var feriadoISO = function (f) { return iso(f && typeof f === 'object' ? f.data : f); };
  function norm(n) { return raiz.DEVNOME ? raiz.DEVNOME.norm(n) : String(n || '').trim().toLowerCase(); }
  function nomesDe(m) { return raiz.DEVNOME ? raiz.DEVNOME.daDemanda(m) : H.devsDe(m); }
  function lerLS(k) { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } }
  function poeLS(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

  // ── Datas (UTC a partir das partes: o fuso nao muda o dia) ─────────────
  function dUTC(s) { var p = s.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function maisDias(s, n) { var d = dUTC(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function dow(s) { return dUTC(s).getUTCDay(); }
  function fds(s) { var w = dow(s); return w === 0 || w === 6; }
  /** Anda `n` dias de semana (seg a sex) — a regua do quadro tem uma coluna
   *  por dia de semana, feriado incluido, entao o arraste anda nessa unidade. */
  function maisUteis(s, n) {
    var d = s, passo = n < 0 ? -1 : 1, k = Math.abs(n), guarda = 0;
    while (k > 0 && guarda++ < 4000) { d = maisDias(d, passo); if (!fds(d)) k--; }
    return d;
  }
  function uteisEntre(a, b) {
    var n = 0, d = a, guarda = 0;
    while (d < b && guarda++ < 4000) { d = maisDias(d, 1); if (!fds(d)) n++; }
    return n;
  }

  // ── Estado da tela (sobrevive aos redesenhos do nucleo) ────────────────
  var F = { tipo: '', tema: '', dev: '', frente: '', prio: '', sprintPo: '', projeto: '', etapa: '', q: '' };
  var EST = {
    zoom: +lerLS('axis_plan_zoom') || 2,
    apresentar: false,
    pend: {},          // id -> patch em gravacao: a barra fica onde caiu ate o servidor responder
    capSel: '',
    limbo: lerLS('axis_plan_limbo') === '1',
    rolagem: 0,
    el: null,
    M: null            // o que o ultimo desenho calculou (janela, linhas, barras)
  };
  if (!ZOOMS.some(function (z) { return z.n === EST.zoom; })) EST.zoom = 2;
  var _arr = null, _suprime = false;

  // ── CSS proprio da tela (uma vez) ─────────────────────────────────────
  /* As colunas vem de variavel (`--nc`) e nao de `grid-template-columns`
     inline: o container query do nucleo derruba todo grid inline para uma
     coluna abaixo de 760 px, e a regua precisa continuar regua no celular. */
  function injetarCss() {
    if (typeof document === 'undefined' || document.getElementById('css-tela-planejamento')) return;
    var s = document.createElement('style');
    s.id = 'css-tela-planejamento';
    s.textContent = [
      '.axa .pl-hd{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px}',
      '.axa .pl-hd .tt{display:flex;flex-direction:column;gap:6px;min-width:0;max-width:640px}',
      '.axa .pl-hd .ac{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
      '.axa .pl-nav{display:flex;align-items:center;gap:6px;height:40px;padding:0 6px;border-radius:11px;background:var(--sf);border:1px solid var(--bd2)}',
      '.axa .pl-nav a{width:30px;height:30px;padding:0;border:0;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;color:var(--tx2);text-decoration:none;font-size:16px}',
      '.axa .pl-nav a:hover{background:var(--sf4);color:var(--tx)}',
      '.axa .pl-nav span{font-size:13px;font-weight:700;padding:0 6px;white-space:nowrap}',
      '.axa .pl-sel{height:40px;padding:0 34px 0 12px;border-radius:11px;border:1px solid var(--bd2);background:var(--sf);color:var(--tx);font:inherit;font-size:13px}',
      '.axa .pl-fil{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
      '.axa .pl-fil select{height:34px;padding:0 30px 0 10px;border-radius:9px;border:1px solid var(--bd2);background:var(--sf);color:var(--tx);font:inherit;font-size:12.5px;max-width:220px}',
      '.axa .pl-fil select.on{border-color:rgba(var(--ac-rgb),.55);color:var(--ac-t);font-weight:700}',
      '.axa .pl-fil .ct{font-size:12px;color:var(--tx3);margin-left:4px}',
      '.axa .pl-lay{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:16px;align-items:start}',
      '.axa .pl-lay.so{grid-template-columns:minmax(0,1fr)}',
      '.axa .pl-gt{overflow-x:auto;border-radius:16px;background:rgba(var(--sf-rgb),.72);border:1px solid var(--bd);--lw:190px}',
      '.axa .pl-in{min-width:calc(var(--lw) + var(--nc) * var(--dmin));position:relative}',
      '.axa .pl-gr{display:grid;grid-template-columns:var(--lw) repeat(var(--nc),minmax(0,1fr))}',
      '.axa .pl-gr.cab{border-bottom:1px solid var(--sf5)}',
      '.axa .pl-hs{padding:9px 10px;display:flex;flex-direction:column;gap:2px;border:0;border-left:1px solid var(--sf5);background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;min-width:0}',
      '.axa .pl-hs:hover{background:var(--sf4)}',
      '.axa .pl-hs.ag{background:rgba(var(--ac-rgb),.07)}',
      '.axa .pl-hs.on{box-shadow:inset 0 -2px 0 var(--ac)}',
      '.axa .pl-hs b{font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.axa .pl-hs span{font-size:11px;color:var(--tx3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.axa .pl-cn{padding:8px 14px;font-size:10.5px;font-weight:800;letter-spacing:.1em;color:var(--tx3);position:sticky;left:0;z-index:3;background:var(--sf);display:flex;align-items:center}',
      '.axa .pl-dd{padding:6px 0;text-align:center;border-left:1px solid var(--sf4);font-size:11px;color:var(--tx3);display:flex;flex-direction:column;line-height:14px;min-width:0;overflow:hidden}',
      '.axa .pl-dd.hj{background:rgba(var(--ac-rgb),.12);color:var(--ac-t);font-weight:800}',
      '.axa .pl-dd.fe{color:var(--tl-t)}',
      '.axa .pl-dd small{font-size:9.5px;font-weight:700}',
      '.axa .pl-ln{display:grid;grid-template-columns:var(--lw) repeat(var(--nc),minmax(0,1fr));grid-template-rows:repeat(var(--nr),34px);row-gap:6px;padding:10px 0;border-bottom:1px solid var(--sf4);position:relative}',
      '.axa .pl-ln.alvo{background:rgba(var(--ac-rgb),.05);box-shadow:inset 3px 0 0 var(--ac)}',
      '.axa .pl-lb{grid-column:1;grid-row:1 / -1;padding:0 14px;display:flex;flex-direction:column;gap:3px;min-width:0;position:sticky;left:0;z-index:3;background:var(--sf)}',
      '.axa .pl-ln.alvo .pl-lb{background:var(--sf2)}',
      '.axa .pl-lb .nm{font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;min-width:0}',
      '.axa .pl-lb .nm b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.axa .pl-lb .nm .chip{height:16px;font-size:9.5px;padding:0 5px}',
      '.axa .pl-lb .cp{font-size:11.5px;font-family:var(--font-mono)}',
      '.axa .pl-lb .nt{font-size:11px;color:var(--tx3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.axa .pl-lb .nt.wn{color:var(--wn-t)}',
      '.axa .pl-tr{height:5px;border-radius:3px;background:var(--track);overflow:hidden;display:block}',
      '.axa .pl-tr i{display:block;height:100%;border-radius:3px}',
      '.axa .pl-c{grid-row:1 / -1;border-left:1px solid var(--sf4)}',
      '.axa .pl-c.hj{background:rgba(var(--ac-rgb),.06)}',
      '.axa .pl-c.fe{background:repeating-linear-gradient(135deg,rgba(var(--tl-rgb),.10) 0 6px,transparent 6px 12px)}',
      '.axa .pl-c.au{background:repeating-linear-gradient(135deg,rgba(var(--au-rgb),.16) 0 6px,transparent 6px 12px)}',
      '.axa .pl-c.alvo{background:rgba(var(--ac-rgb),.22);box-shadow:inset 0 0 0 1px rgba(var(--ac-rgb),.6)}',
      /* A barra: texto no tom de texto (var(--tx)) sobre a cor da etapa a 16%.
         O gantt antigo escrevia a cor clara da etapa sobre um fundo escuro fixo,
         e no tema claro o titulo sumia. Aqui fundo e texto vem dos tokens. */
      '.axa .pl-br{--k-rgb:var(--pu-rgb);--k-t:var(--pu-t);margin:0 3px;padding:0 10px;border-radius:9px;display:flex;align-items:center;gap:6px;min-width:0;text-decoration:none;font-size:12px;font-weight:700;color:var(--tx);background:rgba(var(--k-rgb),.16);border:1px solid rgba(var(--k-rgb),.45);z-index:1;position:relative;overflow:hidden;user-select:none;-webkit-user-drag:none}',
      '.axa .pl-br:hover{color:var(--tx);border-color:rgba(var(--k-rgb),.8)}',
      '.axa .pl-br:focus-visible{outline:2px solid rgba(var(--ac-rgb),.7);outline-offset:1px}',
      '.axa .pl-br.ed{cursor:grab}',
      '.axa .pl-br.k-ac{--k-rgb:var(--ac-rgb);--k-t:var(--ac-t)}',
      '.axa .pl-br.k-in{--k-rgb:var(--in-rgb);--k-t:var(--in-t)}',
      '.axa .pl-br.k-wn{--k-rgb:var(--wn-rgb);--k-t:var(--wn-t)}',
      '.axa .pl-br.k-ok{--k-rgb:var(--ok-rgb);--k-t:var(--ok-t)}',
      '.axa .pl-br.k-dg{--k-rgb:var(--dg-rgb);--k-t:var(--dg-t)}',
      '.axa .pl-br.k-tl{--k-rgb:var(--tl-rgb);--k-t:var(--tl-t)}',
      '.axa .pl-br.pa{background-image:repeating-linear-gradient(135deg,transparent 0 6px,rgba(var(--k-rgb),.16) 6px 12px)}',
      '.axa .pl-br.he{border-style:dashed}',
      '.axa .pl-br.gr{border-width:2px}',
      '.axa .pl-br.sv{opacity:.65}',
      '.axa .pl-br .c{font-family:var(--font-mono);font-size:10.5px;color:var(--k-t);flex-shrink:0}',
      '.axa .pl-br .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}',
      '.axa .pl-br .x{font-size:10.5px;color:var(--k-t);flex-shrink:0;display:inline-flex;align-items:center;gap:2px}',
      '.axa .pl-h{position:absolute;top:0;bottom:0;width:9px;cursor:ew-resize;z-index:2}',
      '.axa .pl-hi{left:-2px;border-radius:9px 0 0 9px}',
      '.axa .pl-hf{right:-2px;border-radius:0 9px 9px 0}',
      '.axa .pl-br.ed:hover .pl-h{background:rgba(var(--k-rgb),.35)}',
      '.axa .pl-br.arr,.axa .pl-fc.arr{opacity:.85;cursor:grabbing;pointer-events:none;z-index:20;box-shadow:0 12px 30px var(--shadow)}',
      '.axa .pl-tip{position:fixed;z-index:70;pointer-events:none;padding:6px 10px;border-radius:9px;background:var(--sf3);border:1px solid var(--bd2);box-shadow:0 10px 30px var(--shadow);font-size:12px;font-weight:700;color:var(--tx);white-space:nowrap}',
      '.axa .pl-fila{padding:16px;border-radius:16px;background:rgba(var(--sf-rgb),.72);border:1px solid rgba(var(--pu-rgb),.3);display:flex;flex-direction:column;gap:10px;min-width:0}',
      '.axa .pl-fila .in{height:36px;font-size:12.5px;background:var(--sf)}',
      '.axa .pl-fc{display:flex;flex-direction:column;gap:5px;padding:10px 12px;border-radius:12px;background:var(--sf2);border:1px solid var(--bd2);text-decoration:none;color:var(--tx);user-select:none;-webkit-user-drag:none}',
      '.axa .pl-fc:hover{border-color:var(--bd4);color:var(--tx)}',
      '.axa .pl-fc[data-arr]{cursor:grab}',
      '.axa .pl-fc.np{opacity:.7}',
      '.axa .pl-fc .r{display:flex;justify-content:space-between;gap:8px;font-family:var(--font-mono);font-size:11.5px;color:var(--tx3)}',
      '.axa .pl-fc .r .p{color:var(--tx2)}',
      '.axa .pl-fc b{font-size:12.5px;line-height:17px}',
      '.axa .pl-fc small{font-size:11px;color:var(--tx3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.axa .pl-fant{position:fixed;z-index:70;pointer-events:none;width:220px;opacity:.92;box-shadow:0 16px 40px var(--shadow)}',
      '.axa .pl-lim{border-radius:14px;border:1px solid rgba(var(--wn-rgb),.35);background:rgba(var(--wn-rgb),.06)}',
      '.axa .pl-lim > button{width:100%;display:flex;align-items:center;gap:10px;padding:12px 16px;border:0;background:transparent;color:var(--wn-t);font:inherit;font-size:13px;font-weight:700;cursor:pointer;text-align:left}',
      '.axa .pl-lim > button small{margin-left:auto;font-weight:600;color:var(--tx3)}',
      '.axa .pl-lim .ls{display:flex;flex-direction:column;gap:6px;padding:0 16px 14px}',
      '.axa .pl-lim .it{display:grid;grid-template-columns:78px minmax(0,1fr) minmax(0,1.2fr);gap:10px;align-items:center;padding:8px 10px;border-radius:9px;background:var(--sf2);font-size:12.5px;text-decoration:none;color:var(--tx)}',
      '.axa .pl-lim .it:hover{color:var(--tx);box-shadow:inset 0 0 0 1px var(--bd4)}',
      '.axa .pl-lim .it .por{color:var(--tx3);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.axa .pl-cap{border-radius:16px;background:rgba(var(--sf-rgb),.72);border:1px solid var(--bd)}',
      '.axa .pl-cap > summary{padding:14px 18px;cursor:pointer;font-size:14px;font-weight:700;display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center}',
      '.axa .pl-cap > summary .note{font-weight:600}',
      '.axa .pl-cap .cb{padding:0 18px 18px;display:flex;flex-direction:column;gap:12px}',
      '.axa .pl-cap .tw{overflow-x:auto}',
      '.axa .pl-cap table{width:100%;border-collapse:collapse;font-size:12.5px;min-width:640px}',
      '.axa .pl-cap th{text-align:left;font-size:10.5px;font-weight:800;letter-spacing:.1em;color:var(--tx4);padding:0 8px 8px;border-bottom:1px solid var(--bd)}',
      '.axa .pl-cap td{padding:8px;border-bottom:1px solid var(--bd3);color:var(--tx2);vertical-align:middle}',
      '.axa .pl-cap td.sub{padding-left:24px}',
      '.axa .pl-cap .br2{display:inline-block;width:90px;height:6px;border-radius:3px;background:var(--track);overflow:hidden;vertical-align:middle;margin-right:8px}',
      '.axa .pl-cap .br2 i{display:block;height:100%}',
      '.axa .pl-leg{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11.5px;color:var(--tx3)}',
      '.axa .pl-leg span{display:inline-flex;align-items:center;gap:6px}',
      '.axa .pl-leg i{width:14px;height:10px;border-radius:3px;display:inline-block}',
      '.axa .pl-dlg{max-width:600px}',
      '.axa .pl-dlg h2{margin:0;font-family:var(--font-title);font-size:19px;font-weight:800;padding-right:40px}',
      '.axa .pl-fm{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
      '.axa .pl-fm .pl-lg{grid-column:1 / -1}',
      '.axa .pl-fm label{display:flex;flex-direction:column;gap:6px;font-size:12.5px;font-weight:700;color:var(--tx2);min-width:0}',
      '.axa .pl-fm .in{width:100%}',
      '.axa .pl-fm .in:disabled{opacity:.6}',
      '.axa .pl-er{min-height:18px;font-size:12.5px;color:var(--dg-t)}',
      '.axa .pl-pe{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;align-items:center}',
      '.axa .pl-pe .esq{margin-right:auto;display:flex;flex-wrap:wrap;gap:8px}',
      '.axa .pl-li{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;background:var(--sf2);font-size:13px}',
      '.axa .pl-li .t{flex:1;min-width:0;line-height:17px}',
      '.axa .pl-li .t small{display:block;font-size:11.5px;color:var(--tx3)}',
      '.axa .pl-li .btns{height:28px}',
      '.axa .pl-li.ed{box-shadow:inset 0 0 0 1px rgba(var(--ac-rgb),.55)}',
      '.axa .pl-lst{display:flex;flex-direction:column;gap:6px;max-height:340px;overflow-y:auto}',
      '@container app (max-width: 760px){',
      '.axa .pl-lay{grid-template-columns:minmax(0,1fr)}',
      '.axa .pl-gt{--lw:128px}',
      '.axa .pl-hd .ac{width:100%}',
      '.axa .pl-fil select{flex:1 1 140px;max-width:100%;min-width:0;width:0}',
      '.axa .pl-lb{padding:0 8px}',
      '.axa .pl-lim .it{grid-template-columns:70px minmax(0,1fr)}',
      '.axa .pl-lim .it .por{grid-column:1 / -1}',
      '.axa .pl-fm{grid-template-columns:minmax(0,1fr)}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── Leituras ─────────────────────────────────────────────────────────
  /** Quem conta na capacidade: o time cadastrado, sem quem saiu.
   *  COPIA de `capDevsAtivos` (gantt.html), a mesma da tela Sprints. */
  function devsAtivos(D) {
    var fora = {};
    ((D.devs_removidos || []).concat(D.devs_inativos || [])).forEach(function (n) { fora[norm(n)] = true; });
    return (D.desenvolvedores || []).filter(function (n) { return n && !fora[norm(n)]; });
  }
  /** As opcoes que o gantt passa ao `capacidadePorTrilha` (renderCapSprint). */
  function optsCapacidade(D) {
    var P = raiz.PIPELINES;
    return {
      devs: devsAtivos(D),
      frenteDoDev: function (n) { return P ? P.doDev(n, D.devs_perfil) : ''; },
      frenteDados: P ? P.FRENTE_DADOS : '',
      frenteSales: 'Sales Ops',
      semFrente: P ? P.NAO_CLASSIFICADO : 'Desenvolvimento',
      etapaDe: H.etapaDe,
      compara: raiz.ORDEMKB ? function (a, b) { return raiz.ORDEMKB.compara(a, b, raiz.ENTREGAUSU ? raiz.ENTREGAUSU.data : null); } : undefined
    };
  }
  function porId(id) { return ((AX.APP.D || {}).melhorias || []).find(function (x) { return x && x.id === id; }) || null; }
  /** A demanda como a tela deve desenha-la: com o patch que esta gravando. */
  function comPend(m) { var p = m && EST.pend[m.id]; return p ? Object.assign({}, m, p) : m; }
  function etapaGravada(m) { return raiz.ETAPA ? raiz.ETAPA.gravada(m) : String(m.status_planejamento || 'backlog'); }
  function pontuado(m) { return Number(m.poker_pontos) > 0; }
  function papel() { return AX.APP.papel; }
  function podeEditar() { return H.pode('editar'); }
  function ehAdmin() { return papel() === 'admin'; }
  /** Quem escolhe a sprint: o dono (`SPRINTPO.ehDonoDaSprint`, espelho do
   *  Worker) — o mesmo corte do campo Sprint do gantt.html. */
  function donoDaSprint() { return ehAdmin() && (!SP().ehDonoDaSprint || SP().ehDonoDaSprint(AX.APP.eu || null)); }
  /** A data desta demanda e do PM/PO? (ver ETAPAS_DATA_TRAVADA) */
  function travada(m) { return !ehAdmin() && ETAPAS_DATA_TRAVADA.indexOf(String(m.status_planejamento || '')) >= 0; }
  function quem() {
    if (raiz.AXIS_ACOES && raiz.AXIS_ACOES.contexto) return raiz.AXIS_ACOES.contexto().quem;
    var e = AX.APP.eu || {};
    return e.nome || e.login || '';
  }
  /** A cor da barra pela etapa efetiva — a mesma escala da visao resumida
   *  (Sprints › Planejamento) e da legenda. */
  function corDe(m) {
    var e = H.etapaDe(m);
    return e === 'concluido' ? 'ok' : (e === 'validacao' || e === 'validacao_area') ? 'wn' : e === 'atrasado' ? 'dg'
         : e === 'em_andamento' ? 'ac' : e === 'planejado' ? 'in' : e === 'planning' ? 'tl' : 'pu';
  }
  function sprintCurto(r) { return r ? SP().rotuloCurto(r) : ''; }

  // ── A janela: sprints seguidas, uma coluna por dia de semana ───────────
  /* A coluna do feriado continua na regua (riscada), como no prototipo: sumir
     com o dia faria a segunda-feira de feriado parecer que nao existe. Por
     isso a janela comeca na segunda da semana da primeira sprint quando os
     dias antes dela sao feriado do mesmo mes, e termina na sexta pelo mesmo
     motivo. */
  function janela(D, r1, n) {
    var Fr = fer(D);
    var ferSet = {};
    Fr.forEach(function (f) { var d = feriadoISO(f); if (d) ferSet[d] = (f && f.nome) || 'Feriado'; });
    var sprints = [r1], k;
    for (k = 1; k < n; k++) { var prox = SP().sprintSeguinte(sprints[k - 1], Fr); if (!prox) break; sprints.push(prox); }
    var faixas = sprints.map(function (r) { return { r: r, f: SP().faixaDaSprint(r, Fr) }; }).filter(function (x) { return x.f; });
    if (!faixas.length) return null;
    var ini = faixas[0].f.de, fim = faixas[faixas.length - 1].f.ate;
    var seg = SP().segundaDaSemana(ini);
    while (seg < ini && !(ferSet[seg] && seg.slice(0, 7) === ini.slice(0, 7))) seg = maisDias(seg, 1);
    ini = seg < ini ? seg : ini;
    var sex = maisDias(SP().segundaDaSemana(fim), 4), d2 = maisDias(fim, 1);
    while (d2 <= sex && ferSet[d2] && d2.slice(0, 7) === fim.slice(0, 7)) { fim = d2; d2 = maisDias(d2, 1); }
    var dias = [], idx = {};
    for (var d = ini, g = 0; d <= fim && g < 400; d = maisDias(d, 1), g++) {
      if (fds(d)) continue;
      var sk = 0;
      for (k = 0; k < faixas.length; k++) {
        if (SP().segundaDaSemana(faixas[k].f.de) === SP().segundaDaSemana(d) && faixas[k].f.de.slice(0, 7) === d.slice(0, 7)) { sk = k; break; }
        if (d <= faixas[k].f.ate) { sk = k; break; }
      }
      idx[d] = dias.length;
      dias.push({ d: d, fe: ferSet[d] || '', sk: sk });
    }
    return { sprints: faixas.map(function (x) { return x.r; }), faixas: faixas, dias: dias, idx: idx, ini: ini, fim: fim, ferSet: ferSet, n: dias.length };
  }
  /** O primeiro dia da regua em ou depois de `d` (ou n). */
  function colProx(J, d) { for (var i = 0; i < J.n; i++) if (J.dias[i].d >= d) return i; return J.n; }
  /** O ultimo dia da regua em ou antes de `d` (ou -1). */
  function colAnt(J, d) { for (var i = J.n - 1; i >= 0; i--) if (J.dias[i].d <= d) return i; return -1; }

  // ── Filtros (matchesFilters do gantt.html) ─────────────────────────────
  function passa(D, m) {
    if (F.tipo === '__sem__') { if (m.tipo) return false; }
    else if (F.tipo && m.tipo !== F.tipo) return false;
    // Roll-up: filtrar por "AXCred - Cadastro" traz os submodulos dele.
    if (F.tema && !(raiz.catalogoCasa ? raiz.catalogoCasa(m.tema_id, F.tema, D.temas || []) : String(m.tema_id) === F.tema)) return false;
    if (F.frente && !(raiz.PIPELINES && raiz.PIPELINES.daDemanda(m, D.devs_perfil) === F.frente)) return false;
    if (F.prio && (m.prioridade || '') !== F.prio) return false;
    if (F.sprintPo) {
      if (F.sprintPo === '__fora__' ? !SP().foraDaSprint(m) : !SP().naSprint(m, F.sprintPo)) return false;
    }
    if (F.projeto && m.projeto_id !== F.projeto) return false;
    // Pausada e estado paralelo a etapa, nao um valor dela.
    if (F.etapa === '__pausada__') { if (!H.pausada(m)) return false; }
    else if (F.etapa && H.etapaDe(m) !== F.etapa) return false;
    return true;
  }
  function nFiltros() {
    return ['tipo', 'tema', 'frente', 'prio', 'sprintPo', 'projeto', 'etapa'].filter(function (k) { return F[k]; }).length + (F.dev ? 1 : 0);
  }

  // ── O calculo do quadro ───────────────────────────────────────────────
  function montar(D, r1) {
    var J = janela(D, r1, EST.zoom);
    if (!J) return null;
    var hoje = H.hoje();
    var vivas = H.visiveis();
    var HERDAM = (raiz.PRAZO && raiz.PRAZO.ETAPAS_QUE_HERDAM) || ['planning', 'planejado', 'em_andamento', 'validacao_area', 'validacao'];
    var herdaAqui = J.ini <= hoje;   // nao se herda para o futuro (PRAZO.herdadaDeMesAnterior)
    var eHoje = colAnt(J, hoje < J.fim ? hoje : J.fim);

    // Quem tem filho e agrupador (a D0): a barra dele nao ocupa dia.
    var filhos = {};
    vivas.forEach(function (m) { var p = String(m.parent_id || ''); if (p) (filhos[p] = filhos[p] || []).push(m.id); });

    // Linhas: o time cadastrado mais quem tem barra na janela.
    var canon = {}, ordem = [];
    var poe = function (n) { var k = norm(n); if (k && !canon[k]) { canon[k] = n; ordem.push(k); } };
    devsAtivos(D).forEach(poe);

    var barras = [], semGrupo = [];
    vivas.forEach(function (m0) {
      var m = comPend(m0);
      var gr = etapaGravada(m);
      if (gr === 'negada' || m.status === 'negada') return;
      var nomes = nomesDe(m);
      if (!nomes.length) return;
      var a = iso(m.inicio) || iso(m.entrega), b = iso(m.entrega) || iso(m.inicio);
      if (!a) { if (filhos[m.id]) semGrupo.push(m); return; }
      if (b < a) b = a;
      var her = false;
      if (b < J.ini) {
        // A HERDADA: prazo antes da janela e ainda na esteira. O prazo NAO
        // muda; a barra ocupa do inicio da janela ate hoje (faixaDoCard).
        if (herdaAqui && HERDAM.indexOf(gr) >= 0) her = true; else return;
      } else if (a > J.fim) return;
      if (!passa(D, m)) return;
      var s, e;
      if (her) { s = 0; e = eHoje; } else { s = colProx(J, a); e = colAnt(J, b); }
      if (s >= J.n || e < 0 || e < s) return;
      nomes.forEach(function (n) { poe(n); });
      barras.push({ m: m, a: a, b: b, s: s, e: e, her: her, cs: !her && a < J.ini, ce: b > J.fim, grupo: !!filhos[m.id], nomes: nomes });
    });

    // Ausencias na janela, por linha.
    var aus = (D.ausencias || []).filter(function (x) { return x && x.dev && iso(x.fim || x.inicio) >= J.ini && iso(x.inicio) <= J.fim; });
    aus.forEach(function (x) { poe(x.dev); });

    var linhas = ordem.map(function (k) { return { k: k, nome: canon[k], barras: [], aus: [] }; });
    var porK = {};
    linhas.forEach(function (l) { porK[l.k] = l; });
    barras.forEach(function (x) { x.nomes.forEach(function (n) { var l = porK[norm(n)]; if (l && l.barras.indexOf(x) < 0) l.barras.push(x); }); });
    aus.forEach(function (x) { var l = porK[norm(x.dev)]; if (l) l.aus.push(x); });

    // A D0 sem data propria: a barra cobre as quebras daquela linha (gantt.html).
    semGrupo.forEach(function (m) {
      if (!passa(D, m)) return;
      nomesDe(m).forEach(function (n) {
        var l = porK[norm(n)];
        if (!l) return;
        var fs = l.barras.filter(function (x) { return filhos[m.id].indexOf(x.m.id) >= 0; });
        if (!fs.length) return;
        var s = Math.min.apply(null, fs.map(function (x) { return x.s; }));
        var e = Math.max.apply(null, fs.map(function (x) { return x.e; }));
        l.barras.push({ m: m, a: '', b: '', s: s, e: e, her: false, cs: true, ce: true, grupo: true, derivada: true, nomes: [n] });
      });
    });

    // Filtro de dev: por padrao so quem tem barra ou ausencia na janela.
    var meus = H.meusNomes().map(norm);
    var mostra = linhas.filter(function (l) {
      if (F.dev && F.dev !== '__todos__') return l.k === norm(F.dev);
      if (F.dev === '__todos__') return true;
      return l.barras.length || l.aus.length;
    });
    var perfil = D.devs_perfil || {};
    mostra.sort(function (x, y) {
      var ex = meus.indexOf(x.k) >= 0 ? 0 : 1, ey = meus.indexOf(y.k) >= 0 ? 0 : 1;
      if (ex !== ey) return ex - ey;
      // DEV-AXCred no topo, o resto em ordem alfabetica (gOrdenaDevs).
      var ax = (perfil[x.nome] || {}).axcred ? 0 : 1, ay = (perfil[y.nome] || {}).axcred ? 0 : 1;
      if (ax !== ay) return ax - ay;
      return String(x.nome).localeCompare(String(y.nome), 'pt-BR');
    });

    // Capacidade por pessoa: a conta do modulo, sprint a sprint da janela,
    // cada pessoa como a propria "frente" (30 de capacidade, dupla divide).
    var cap = {};
    var nomesCap = mostra.map(function (l) { return l.nome; });
    J.sprints.forEach(function (r) {
      SP().capacidadeDaSprint(D, r, {
        devs: nomesCap, frenteDoDev: function (n) { return canon[norm(n)] || n; },
        frenteDe: function () { return '(sem dev)'; }, semFrente: '(sem dev)', etapaDe: H.etapaDe
      }).forEach(function (e) {
        var c = cap[norm(e.frente)] || (cap[norm(e.frente)] = { alocado: 0, capacidade: 0 });
        c.alocado += e.alocado; c.capacidade += e.capacidade;
      });
    });

    mostra.forEach(function (l) {
      // Faixas: o que tem selo sobe; dentro do grupo, quem comeca antes vem antes.
      var temSelo = function (m) { return raiz.SELO ? !!raiz.SELO.de(m) : false; };
      l.barras.sort(function (x, y) {
        var sx = temSelo(x.m) ? 0 : 1, sy = temSelo(y.m) ? 0 : 1;
        return sx - sy || x.s - y.s || (y.e - y.s) - (x.e - x.s);
      });
      var faixas = [];
      l.barras.forEach(function (x) {
        for (var i = 0; i < faixas.length; i++) {
          if (faixas[i].every(function (o) { return x.s > o.e || x.e < o.s; })) { faixas[i].push(x); x.f = i; return; }
        }
        faixas.push([x]); x.f = faixas.length - 1;
      });
      l.nf = faixas.length;
      // Dias: ocupados pelas barras (sem a D0), ausentes, livres e em conflito.
      var ocup = {}, ausD = {}, uteis = 0;
      J.dias.forEach(function (dd, i) {
        if (dd.fe) return;
        uteis++;
        l.aus.forEach(function (x) { if (dd.d >= iso(x.inicio) && dd.d <= iso(x.fim || x.inicio)) ausD[i] = x; });
      });
      l.barras.forEach(function (x) {
        if (x.grupo) return;
        for (var i = x.s; i <= x.e; i++) if (!J.dias[i].fe) ocup[i] = true;
      });
      var nAus = Object.keys(ausD).length;
      var disp = Math.max(0, uteis - nAus);
      var occ = Object.keys(ocup).filter(function (i) { return !ausD[i]; }).length;
      l.ausD = ausD;
      l.livres = Math.max(0, disp - occ);
      l.disp = disp;
      l.nAus = nAus;
      l.conflito = Object.keys(ocup).filter(function (i) { return ausD[i]; }).length;
      var c = cap[l.k] || { alocado: 0, capacidade: SP().PONTOS_POR_DEV * J.sprints.length };
      l.cap = { alocado: Math.round(c.alocado * 10) / 10, capacidade: c.capacidade };
    });

    return { J: J, linhas: mostra, todas: linhas, barras: barras, canon: canon, filhos: filhos, hoje: hoje };
  }

  // ── A fila (renderBacklog do gantt.html) ──────────────────────────────
  /* Planning pontuado, sem dev e data. Com uma etapa no filtro a fila responde
     por ela — e o que estiver sem pontos aparece para ser aberto, mas nao
     arrasta: agendar sem estimativa e o que se quer evitar. */
  function fila(D) {
    var et = F.etapa && F.etapa !== '__pausada__' ? F.etapa : '';
    var lista = H.visiveis().map(comPend).filter(function (m) {
      if (etapaGravada(m) === 'negada' || m.status === 'negada') return false;
      if (et) { if (H.etapaDe(m) !== et) return false; }
      else {
        if ((m.status_planejamento || 'backlog') !== 'planning') return false;
        if (!pontuado(m)) return false;
      }
      if (m.dev && (m.inicio || m.entrega)) return false;
      return passa(D, m);
    });
    lista = raiz.ORDEMKB ? raiz.ORDEMKB.ordena(lista, raiz.ENTREGAUSU && raiz.ENTREGAUSU.data) : lista;
    var q = String(F.q || '').toLowerCase().trim();
    var achadas = q ? lista.filter(function (m) {
      var cod = String(m.codigo || '').toLowerCase();
      return String(m.titulo || '').toLowerCase().indexOf(q) >= 0 || H.tema(m.tema_id).toLowerCase().indexOf(q) >= 0 ||
        String(m.dev || '').toLowerCase().indexOf(q) >= 0 || cod.indexOf(q) >= 0 || cod.replace(/-/g, '').indexOf(q.replace(/-/g, '')) >= 0;
    }) : lista;
    return { total: lista.length, lista: achadas, etapa: et };
  }

  function htmlFilaLista(D) {
    var f = fila(D), ed = podeEditar();
    var h = '';
    if (!f.lista.length) {
      h = '<span class="note">' + (F.q ? 'Nada na fila para "' + esc(F.q) + '".'
        : f.etapa ? 'Nada em ' + esc((H.ETAPA_POR_ID[f.etapa] || {}).rotulo || f.etapa) + ' fora do quadro: o que está nesta etapa já tem dev e data.'
        : 'Nada em Planning com pontos. Pontue no Planning Poker e grave no card.') + '</span>';
    } else {
      h = f.lista.slice(0, 60).map(function (m) {
        var pts = pontuado(m);
        var arrasta = ed && pts && !EST.apresentar;
        return '<a class="pl-fc' + (pts ? '' : ' np') + '" href="' + H.hrefItem(m) + '" data-id="' + esc(m.id) + '" draggable="false"' +
          (arrasta ? ' data-arr="1" title="Arraste para a linha do dev, no dia de início — ou clique para escolher dev e datas"' : '') +
          (!pts ? ' title="Sem pontuação do Planning Poker: pode ser aberta, mas não entra no quadro."' : '') + '>' +
          '<span class="r"><span>' + esc(m.codigo || '—') + '</span><span class="p">' + (pts ? m.poker_pontos + ' pts' : 'sem pontos') + '</span></span>' +
          '<b>' + esc(m.titulo || '') + '</b>' +
          // Impacto e urgencia, como na fila do gantt.html (requisitos.js).
          (raiz.REQUISITOS && raiz.REQUISITOS.chips ? '<span>' + raiz.REQUISITOS.chips(m) + '</span>' : '') +
          '<small>' + esc(H.caminho(m.tema_id) || '—') + (SP().doPO(m) ? ' · ' + esc(sprintCurto(SP().doPO(m))) : ' · fora da sprint') + '</small></a>';
      }).join('') + (f.lista.length > 60 ? '<span class="note">e mais ' + (f.lista.length - 60) + '. Refine pela busca.</span>' : '');
    }
    return { html: h, total: f.total, etapa: f.etapa };
  }

  // ── Fora do quadro (renderLimbo do gantt.html) ─────────────────────────
  /* Demanda viva, nao concluida, com data marcada, que nao aparece em linha
     nenhuma nem na fila: ninguem olha para ela. Vale para a janela que contem
     hoje ou ja passou — o que esta planejado para o futuro aparece quando a
     janela chegar. Independe dos filtros: e a rede, nao o recorte. */
  function foraDoQuadro(D, M) {
    if (M.J.ini > M.hoje) return [];
    var HERDAM = (raiz.PRAZO && raiz.PRAZO.ETAPAS_QUE_HERDAM) || [];
    var out = [];
    H.visiveis().forEach(function (m) {
      var gr = etapaGravada(m);
      if (gr === 'concluido' || gr === 'negada' || m.status === 'negada') return;
      var a = iso(m.inicio) || iso(m.entrega), b = iso(m.entrega) || iso(m.inicio);
      if (!a) return;
      if (M.filhos[m.id]) return;
      var porQue = '';
      if (!nomesDe(m).length) {
        if (gr === 'planning' && pontuado(m)) return;   // esta na fila
        porQue = 'sem responsável';
      } else if (b < M.J.ini && HERDAM.indexOf(gr) < 0) {
        porQue = 'prazo ' + H.dm(b) + ' e "' + ((H.ETAPA_POR_ID[gr] || {}).rotulo || gr) + '" não reaparece depois do prazo';
      }
      if (porQue) out.push({ m: m, porQue: porQue, quando: b });
    });
    return out.sort(function (x, y) { return x.quando.localeCompare(y.quando); });
  }

  // ── Desenho ─────────────────────────────────────────────────────────
  function rotaSprint(ctx) {
    var segs = String(ctx.param || '').split('/');
    var r = String(segs[0] || '').toUpperCase();
    return SP().rotuloValido(r) ? r : H.sprintAtual();
  }
  function andar(r, n) {
    var Fr = fer(AX.APP.D);
    for (var i = 0; i < Math.abs(n); i++) {
      var x = n < 0 ? SP().sprintAnterior(r, Fr) : SP().sprintSeguinte(r, Fr);
      if (!x) break;
      r = x;
    }
    return r;
  }

  function opt(v, r, atual) { return '<option value="' + esc(v) + '"' + (String(atual) === String(v) ? ' selected' : '') + '>' + esc(r) + '</option>'; }

  function htmlFiltros(D, M) {
    var P = raiz.PIPELINES;
    var temas = raiz.catalogoOpcoesHTML ? raiz.catalogoOpcoesHTML(D.temas || [], F.tema, { rotuloVazio: 'Todos os sistemas' })
      : opt('', 'Todos os sistemas', F.tema) + (D.temas || []).map(function (t) { return opt(t.id, t.nome, F.tema); }).join('');
    var pessoas = M.todas.map(function (l) { return l.nome; }).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    var vivas = H.visiveis();
    var chave = function (r) { return r.slice(6, 10) + r.slice(3, 5) + r.slice(1, 2); };
    var sps = {};
    vivas.forEach(function (m) { var s = SP().doPO(m); if (s) sps[s] = true; });
    M.J.sprints.forEach(function (r) { sps[r] = true; });
    var ETS = ['backlog', 'levantar_req', 'planning', 'planejado', 'em_andamento', 'validacao_area', 'validacao', 'concluido', 'atrasado'];
    var projs = (D.projetos || []).slice().sort(function (a, b) { return String(a.codigo || '').localeCompare(String(b.codigo || '')); });
    var s = function (k, rot, ops) { return '<select data-plf="' + k + '" aria-label="' + rot + '"' + (F[k] ? ' class="on"' : '') + '>' + ops + '</select>'; };
    var n = nFiltros();
    return '<div class="pl-fil" role="group" aria-label="Filtros">' +
      s('dev', 'Dev', opt('', 'Com demanda no período', F.dev) + opt('__todos__', 'Todos os devs', F.dev) + pessoas.map(function (p) { return opt(p, p, F.dev); }).join('')) +
      s('tipo', 'Tipo', opt('', 'Todos os tipos', F.tipo) + opt('evolucao', 'Evolução', F.tipo) + opt('sustentacao', 'Sustentação', F.tipo) + opt('__sem__', 'Sem tipo', F.tipo)) +
      s('tema', 'Sistema', temas) +
      (P ? s('frente', 'Frente', opt('', 'Todas as frentes', F.frente) + P.nomes.map(function (x) { return opt(x, x, F.frente); }).join('')) : '') +
      s('prio', 'Prioridade', opt('', 'Toda prioridade', F.prio) + opt('alta', 'Alta', F.prio) + opt('media', 'Média', F.prio) + opt('baixa', 'Baixa', F.prio)) +
      s('sprintPo', 'Sprint do PM/PO', opt('', 'Toda sprint', F.sprintPo) + opt('__fora__', 'Fora da sprint', F.sprintPo) +
        Object.keys(sps).filter(function (r) { return SP().rotuloValido(r); }).sort(function (a, b) { return chave(a).localeCompare(chave(b)); })
          .map(function (r) { return opt(r, 'Sprint ' + sprintCurto(r), F.sprintPo); }).join('')) +
      s('etapa', 'Etapa', opt('', 'Toda etapa', F.etapa) + ETS.map(function (e) { return opt(e, (H.ETAPA_POR_ID[e] || {}).rotulo || e, F.etapa); }).join('') + opt('__pausada__', 'Pausada', F.etapa)) +
      s('projeto', 'Projeto', opt('', 'Todos os projetos', F.projeto) + projs.map(function (p) { return opt(p.id, (p.codigo ? p.codigo + ' · ' : '') + (p.nome || ''), F.projeto); }).join('')) +
      (n ? '<button type="button" class="btns" data-pl="limpar">Limpar (' + n + ')</button>' : '') +
      '<span class="ct">' + H.plural(M.barras.length, 'demanda no período', 'demandas no período') + ' · ' + H.plural(M.linhas.length, 'pessoa', 'pessoas') + '</span>' +
      '</div>';
  }

  function htmlBarra(M, l, x) {
    var m = x.m, J = M.J;
    var ed = podeEditar() && !x.derivada && !EST.apresentar && !EST.pend[m.id];
    var arr = ed && !travada(m);
    var paus = H.pausada(m);
    var semPts = raiz.CAPACIDADE ? raiz.CAPACIDADE.semPontuacao(m) : false;
    var sp = SP().doPO(m);
    var et = (H.ETAPA_POR_ID[H.etapaDe(m)] || {}).rotulo || '';
    var tit = (m.codigo || '') + ' · ' + (m.titulo || '') + '\n' +
      (x.derivada ? 'D0 sem data própria: a barra cobre as quebras' : H.dm(x.a) + ' → ' + H.dm(x.b)) + ' · ' + et +
      (m.dev ? ' · ' + m.dev : '') + (sp ? ' · sprint ' + sprintCurto(sp) : ' · fora da sprint') +
      (pontuado(m) ? ' · ' + m.poker_pontos + ' pts' : '') +
      (x.her ? '\nVeio de antes da janela: o prazo (' + H.dm(x.b) + ') não foi movido.' : '') +
      (paus ? '\nPausada' + (m.pausa_motivo ? ': ' + m.pausa_motivo : '') : '') +
      (semPts ? '\nSem pontos do Planning Poker.' : '') +
      (ed && !arr ? '\nData comprometida: quem muda é o PM/PO.' : '') +
      (arr ? '\nArraste para mover; puxe as pontas para mudar início e prazo.' : '');
    var cls = 'pl-br k-' + corDe(m) + (paus ? ' pa' : '') + (x.her ? ' he' : '') + (x.grupo ? ' gr' : '') + (arr ? ' ed' : '') + (EST.pend[m.id] ? ' sv' : '');
    var sprintsFora = x.her && raiz.PRAZO ? raiz.PRAZO.sprintsEstouradas(m, etapaGravada(m), M.hoje) : 0;
    return '<a class="' + cls + '" href="' + H.hrefItem(m) + '" draggable="false" data-id="' + esc(m.id) + '" data-ln="' + esc(l.nome) + '"' +
      ' data-s="' + x.s + '" data-e="' + x.e + '"' + (arr ? ' data-arr="1"' : '') + (ed ? ' data-ed="1"' : '') +
      ' style="grid-column:' + (x.s + 2) + ' / ' + (x.e + 3) + ';grid-row:' + (x.f + 1) + '" title="' + esc(tit) + '">' +
      (arr && !x.cs && !x.her ? '<i class="pl-h pl-hi" aria-hidden="true"></i>' : '') +
      '<span class="c">' + esc(m.codigo || '') + '</span>' +
      (paus ? '<span class="x">' + ico('pause') + '</span>' : '') +
      (x.her ? '<span class="x">⇥ ' + esc(H.dm(x.b)) + (sprintsFora ? ' +' + sprintsFora + 's' : '') + '</span>' : '') +
      (x.derivada ? '<span class="x">↔</span>' : '') +
      (semPts ? '<span class="x" style="opacity:.75">' + ico('cards') + '</span>' : '') +
      '<span class="t">' + esc(m.titulo || '') + '</span>' +
      (arr && !x.ce ? '<i class="pl-h pl-hf" aria-hidden="true"></i>' : '') + '</a>';
  }

  function htmlQuadro(D, M) {
    var J = M.J, hoje = M.hoje;
    var zoom = ZOOMS.filter(function (z) { return z.n === EST.zoom; })[0] || ZOOMS[1];
    var vars = '--nc:' + J.n + ';--dmin:' + zoom.min + 'px';
    // Cabecalho das sprints (clicar filtra pela sprint do PM/PO).
    var grupos = [];
    J.dias.forEach(function (dd) { var g = grupos[grupos.length - 1]; if (g && g.k === dd.sk) g.n++; else grupos.push({ k: dd.sk, n: 1 }); });
    var vivas = H.visiveis();
    var atual = H.sprintAtual();
    var cab = '<div class="pl-gr cab" style="' + vars + '"><span class="pl-cn">SPRINT</span>' + grupos.map(function (g) {
      var r = J.sprints[g.k];
      var sit = SP().situacaoDaSprint(D, r);
      var cor = sit === 'em_curso' ? 'var(--ac-t)' : sit === 'fechada' ? 'var(--ok-t)' : 'var(--in-t)';
      var nela = vivas.filter(function (m) { return SP().naSprint(m, r) && H.colunaDe(m) !== 'negada'; });
      var pts = nela.reduce(function (t, m) { return t + H.pontosDe(m); }, 0);
      return '<button type="button" class="pl-hs' + (r === atual ? ' ag' : '') + (F.sprintPo === r ? ' on' : '') + '" data-pl-sprint="' + esc(r) + '"' +
        ' style="grid-column:span ' + g.n + '" title="' + esc('Sprint ' + sprintCurto(r) + ': clique para ver só o que o PM/PO pôs nela') + '">' +
        '<b style="color:' + cor + '">' + esc(sprintCurto(r)) + ' · ' + (sit === 'em_curso' ? 'ativa' : sit === 'fechada' ? 'fechada' : 'montando') + '</b>' +
        '<span>' + H.plural(nela.length, 'demanda', 'demandas') + ' · ' + pts + ' pts</span></button>';
    }).join('') + '</div>';
    cab += '<div class="pl-gr cab" style="' + vars + '"><span class="pl-cn">DEV · CAPACIDADE</span>' + J.dias.map(function (dd, i) {
      return '<span class="pl-dd' + (dd.d === hoje ? ' hj' : '') + (dd.fe ? ' fe' : '') + '" data-i="' + i + '"' + (dd.fe ? ' title="' + esc(dd.fe) + '"' : '') + '>' +
        // Regua estreita (4 e 8 sprints): dia da semana em cima, numero embaixo.
        (zoom.n > 2 ? '<small>' + DS[dow(dd.d)].charAt(0).toUpperCase() + '</small><span>' + dd.d.slice(8, 10) + '</span>'
          : '<span>' + DS[dow(dd.d)] + ' ' + dd.d.slice(8, 10) + '</span>' + (dd.fe ? '<small>feriado</small>' : '')) + '</span>';
    }).join('') + '</div>';

    if (!M.linhas.length) {
      return '<div class="pl-in" style="' + vars + '">' + cab + H.vazio('calendar', nFiltros() ? 'Nada neste recorte' : 'Ninguém com demanda neste período',
        nFiltros() ? 'Troque ou limpe os filtros.' : 'Arraste um item da fila para a linha de alguém, ou mostre todos os devs.',
        F.dev !== '__todos__' ? '<button type="button" class="btn" data-pl="todos">Mostrar todos os devs</button>' : '') + '</div>';
    }

    var meus = H.meusNomes().map(norm);
    var perfil = D.devs_perfil || {};
    var P = raiz.PIPELINES;
    var corpo = M.linhas.map(function (l) {
      var nr = Math.max(2, l.nf + (l.conflito ? 1 : 0) > 2 ? Math.max(l.nf, 3) : Math.max(l.nf, 2));
      var pc = l.cap.capacidade ? Math.round(l.cap.alocado / l.cap.capacidade * 100) : 0;
      var cor = pc > 100 ? 'var(--dg-t)' : pc >= 85 ? 'var(--wn-t)' : 'var(--ok-t)';
      var corBar = pc > 100 ? 'var(--dg)' : pc >= 85 ? 'var(--wn)' : 'var(--ok)';
      var ausTxt = l.aus.map(function (x) {
        return (AUS[x.tipo] || AUS.outro).rot.toLowerCase() + ' ' + H.dm(x.inicio) + (x.fim && x.fim !== x.inicio ? '–' + H.dm(x.fim) : '');
      }).join(' · ');
      var nota = l.livres + ' de ' + l.disp + ' dias livres' + (ausTxt ? ' · ' + ausTxt : (P ? ' · ' + (P.doDev(l.nome, D.devs_perfil) || '') : ''));
      var h = '<div class="pl-ln" data-pl-dev="' + esc(l.nome) + '" style="' + vars + ';--nr:' + nr + '">' +
        '<div class="pl-lb"><span class="nm"><b' + (meus.indexOf(l.k) >= 0 ? ' style="color:var(--ac-t)"' : '') + ' title="' + esc(l.nome) + '">' + esc(l.nome) + '</b>' +
        ((perfil[l.nome] || {}).axcred ? chip('AXCred', 'wn', 'DEV-AXCred: aparece primeiro') : '') + '</span>' +
        '<span class="cp" style="color:' + cor + '" title="Pontos das demandas que o PM/PO pôs nas sprints da janela, contra 30 por sprint">' +
        H.num(l.cap.alocado) + ' / ' + l.cap.capacidade + ' pts</span>' +
        '<span class="pl-tr"><i style="width:' + Math.min(100, pc) + '%;background:' + corBar + '"></i></span>' +
        '<span class="nt" title="' + esc(nota) + '">' + esc(nota) + '</span>' +
        (l.conflito ? '<span class="nt wn" title="Há demanda planejada em dia de ausência: considere realocar">' + ico('alert') + ' ' + H.plural(l.conflito, 'dia', 'dias') + ' em conflito</span>' : '') +
        '</div>';
      J.dias.forEach(function (dd, i) {
        var au = l.ausD[i];
        var cls = 'pl-c' + (dd.fe ? ' fe' : au ? ' au' : '') + (dd.d === hoje ? ' hj' : '');
        var tit = dd.fe ? dd.fe : au ? l.nome + ' · ' + (AUS[au.tipo] || AUS.outro).rot + (au.obs ? ': ' + au.obs : '') + ' (' + H.dm(au.inicio) + ' a ' + H.dm(au.fim || au.inicio) + ')' : '';
        h += '<span class="' + cls + '" data-i="' + i + '" style="grid-column:' + (i + 2) + (au && !dd.fe ? ';--au-rgb:var(--' + (AUS[au.tipo] || AUS.outro).cor + '-rgb)' : '') + '"' +
          (tit ? ' title="' + esc(tit) + '"' : '') + '></span>';
      });
      l.barras.forEach(function (x) { h += htmlBarra(M, l, x); });
      return h + '</div>';
    }).join('');
    return '<div class="pl-in" style="' + vars + '">' + cab + corpo + '</div>';
  }

  function htmlCapacidade(D, M) {
    var hoje = H.hoje(), Fr = fer(D);
    var ops = M.J.sprints.slice();
    SP().proximasSprints(hoje, 5, Fr).forEach(function (x) { if (ops.indexOf(x.rotulo) < 0) ops.push(x.rotulo); });
    if (ops.indexOf(EST.capSel) < 0) EST.capSel = M.J.sprints[0];
    var r = EST.capSel;
    var grupos = SP().capacidadePorTrilha(D, r, optsCapacidade(D));
    var prox = SP().sprintSeguinte(r, Fr);
    var cap = grupos.reduce(function (t, g) { return t + g.capacidade; }, 0);
    var aloc = Math.round(grupos.reduce(function (t, g) { return t + g.alocado; }, 0));
    var nOver = grupos.filter(function (g) { return g.capacidade && g.alocado > g.capacidade; }).length;
    var barra = function (e) {
      var p = e.pct == null ? 0 : e.pct;
      var c = e.pct == null ? 'var(--tx4)' : p > 100 ? 'var(--dg)' : p >= 85 ? 'var(--wn)' : 'var(--ok)';
      return '<span class="br2"><i style="width:' + Math.min(100, p) + '%;background:' + c + '"></i></span><b style="color:var(--tx)">' + e.alocado + '</b> pt' +
        (e.pct != null ? ' (' + p + '%)' : '') + (e.semPontos ? ' <span class="note">· ' + e.semPontos + ' sem pontos</span>' : '');
    };
    var linha = function (e, nome, sub, sug) {
      return '<tr><td' + (sub ? ' class="sub"' : '') + '>' + nome + '</td><td class="mono" title="' + esc(e.pessoas.join(', ')) + '">' + e.pessoas.length + '</td>' +
        '<td class="mono">' + e.pessoas.length + ' × ' + SP().PONTOS_POR_DEV + ' = <b style="color:var(--tx)">' + e.capacidade + '</b></td>' +
        '<td>' + barra(e) + '</td><td class="mono"' + (e.saldo < 0 ? ' style="color:var(--dg-t)"' : '') + '>' + (e.capacidade ? e.saldo + ' pt' : '—') + '</td><td>' + sug + '</td></tr>';
    };
    var corpo = grupos.map(function (g) {
      var sug = g.sugeridas.length
        ? 'Mover para <b>' + esc(sprintCurto(prox)) + '</b>: ' + g.sugeridas.map(function (m) {
            return '<a href="' + H.hrefItem(m) + '" title="' + esc(m.titulo || '') + '">' + esc(m.codigo || m.id) + '</a> (' + H.pontosDe(m) + ' pt)';
          }).join(', ')
        : !g.capacidade && g.alocado ? '<span class="note">Sem pessoas cadastradas neste grupo</span>'
        : g.saldo > 0 && g.capacidade ? '<span class="note">Cabe mais ' + g.saldo + ' pt</span>' : '—';
      return linha(g, '<b style="color:var(--tx)">' + esc(g.nome) + '</b>', false, sug) +
        (g.k === 'tecnologia' && g.frentes.length > 1 ? g.frentes.map(function (fr) {
          return linha(fr, '↳ ' + esc(fr.frente), true, fr.saldo > 0 && fr.capacidade ? '<span class="note">cabe ' + fr.saldo + ' pt</span>' : '');
        }).join('') : '');
    }).join('');
    return '<details class="pl-cap" id="pl-cap"' + (lerLS('axis_plan_cap') === '1' ? ' open' : '') + '><summary>' + ico('calc') + ' Capacidade da sprint ' +
      '<span class="note">' + esc(sprintCurto(r)) + ' · ' + aloc + ' de ' + cap + ' pts' + (nOver ? ' · <span style="color:var(--dg-t)">' + H.plural(nOver, 'grupo acima', 'grupos acima') + ' da capacidade</span>' : '') + '</span></summary>' +
      '<div class="cb"><div class="row" style="flex-wrap:wrap"><select class="pl-sel" id="pl-cap-sel" aria-label="Sprint da capacidade">' +
      ops.map(function (x) { return opt(x, 'Sprint ' + sprintCurto(x) + (x === H.sprintAtual() ? ' (atual)' : ''), r); }).join('') + '</select>' +
      '<span class="note">cada pessoa ativa = ' + SP().PONTOS_POR_DEV + ' pontos por sprint</span></div>' +
      '<div class="tw"><table><thead><tr><th>GRUPO / FRENTE</th><th>PESSOAS</th><th>CAPACIDADE</th><th>ALOCADO NA SPRINT</th><th>SALDO</th><th>SUGESTÃO</th></tr></thead><tbody>' + corpo + '</tbody></table></div>' +
      '<span class="note" style="font-size:12px">Grupo pela marca da demanda (Dados/BI, Sales Ops ou nenhuma = Desenvolvimento) e pessoas pela frente do cadastro. ' +
      'Alocado = pontos do Planning Poker das demandas que o PM/PO repassou para a sprint. A sugestão só considera o que ainda não começou e tira primeiro a de prioridade mais baixa e prazo mais distante; quem move é o PM/PO, pelo campo Sprint do card.</span>' +
      '</div></details>';
  }

  function htmlLimbo(D, M) {
    var lim = foraDoQuadro(D, M);
    if (!lim.length) return '';
    return '<section class="pl-lim"><button type="button" data-pl="limbo" aria-expanded="' + EST.limbo + '">' + ico('flag') + ' ' +
      H.plural(lim.length, 'demanda com data fora do quadro', 'demandas com data fora do quadro') + '<small>' + (EST.limbo ? 'recolher' : 'ver a lista') + '</small></button>' +
      (EST.limbo ? '<div class="ls"><span class="note">Têm data marcada e não aparecem em nenhuma linha nem na fila. Abra para corrigir a data, a etapa ou o responsável.</span>' +
        lim.map(function (x) {
          return '<a class="it" href="' + H.hrefItem(x.m) + '" data-id="' + esc(x.m.id) + '" data-lim="1"><span class="code">' + esc(x.m.codigo || '—') + '</span>' +
            '<span class="ell">' + esc(x.m.titulo || '') + '</span><span class="por" title="' + esc(x.porQue) + '">' + esc(x.porQue) + '</span></a>';
        }).join('') + '</div>' : '') + '</section>';
  }

  function htmlTela(D, ctx) {
    var r1 = rotaSprint(ctx);
    var M = montar(D, r1);
    EST.M = M;
    if (!M) return H.vazio('calendar', 'Sprint sem dias úteis', 'Escolha outra sprint.', '<a class="btn" href="#planejamento">Voltar para hoje</a>');
    var J = M.J, ed = podeEditar();
    var antes = andar(r1, -EST.zoom), depois = andar(r1, EST.zoom);
    var atual = H.sprintAtual();
    var noHoje = J.ini <= M.hoje && M.hoje <= J.fim;
    var h = '<header class="pl-hd"><div class="tt"><span class="note"><a href="#sprints/planejamento/' + esc(r1) + '">Sprints</a> › Planejamento</span>' +
      '<h1 class="h1">Planejamento</h1>' +
      '<span class="sub">' + (ed ? 'Arraste um item pontuado da fila para a linha do dev, no dia de início. Arraste a barra para mover e puxe as pontas para mudar início e prazo.'
        : 'Quem está com o quê em cada dia útil, pelas datas de início e prazo. Mover e alocar é do PM/PO e do analista.') + '</span></div>' +
      '<div class="ac"><div class="pl-nav"><a href="#planejamento/' + esc(antes) + '" aria-label="Período anterior" title="Período anterior">‹</a>' +
      '<span>' + esc(H.dm(J.ini) + ' – ' + H.dm(J.fim)) + '</span>' +
      '<a href="#planejamento/' + esc(depois) + '" aria-label="Próximo período" title="Próximo período">›</a></div>' +
      (r1 !== atual ? '<a class="btn" href="#planejamento">Hoje</a>' : '') +
      '<select class="pl-sel" id="pl-zoom" aria-label="Zoom da régua">' + ZOOMS.map(function (z) { return opt(z.n, z.rot, EST.zoom); }).join('') + '</select>' +
      '<button type="button" class="btn" data-pl="aus">' + ico('calendar') + ' Ausências</button>' +
      (ehAdmin() ? '<button type="button" class="btn" data-pl="fer">' + ico('flag') + ' Feriados</button>' : '') +
      '<button type="button" class="btn' + (EST.apresentar ? ' on" style="border-color:rgba(var(--ac-rgb),.55)' : '') + '" data-pl="apres" aria-pressed="' + EST.apresentar + '" title="Esconde filtros, fila e capacidade para projetar na reunião">' + ico('present') + ' ' + (EST.apresentar ? 'Sair da apresentação' : 'Apresentar') + '</button>' +
      '</div></header>';
    if (!EST.apresentar) h += htmlFiltros(D, M);
    if (!EST.apresentar && noHoje) h += htmlLimbo(D, M);
    var fl = EST.apresentar ? null : htmlFilaLista(D);
    h += '<div class="pl-lay' + (EST.apresentar ? ' so' : '') + '"><div class="pl-gt" id="pl-gt" style="overflow-x: auto">' + htmlQuadro(D, M) + '</div>' +
      (fl ? '<aside class="pl-fila" aria-label="Fila da Planning"><div class="row" style="justify-content:space-between"><span class="lab" style="color:var(--pu-t)">' +
        (fl.etapa ? esc(((H.ETAPA_POR_ID[fl.etapa] || {}).rotulo || fl.etapa).toUpperCase()) + ' FORA DO QUADRO' : 'PRONTO PARA PLANNING') + '</span>' +
        '<span class="mono note" id="pl-fila-n">' + fl.total + '</span></div>' +
        '<input class="in" id="pl-q" type="search" autocomplete="off" placeholder="Código, título, sistema ou dev" aria-label="Buscar na fila" value="' + esc(F.q) + '">' +
        '<div id="pl-fila" style="display:flex;flex-direction:column;gap:8px">' + fl.html + '</div>' +
        '<span class="note" style="font-size:11.5px">' + (fl.etapa ? 'Sem pontos do Planning Poker, a demanda pode ser aberta mas não entra no quadro.'
          : 'Só entra o que está em Planning com pontos do Poker e ainda não tem dev e data.') + '</span>' +
        '<div class="pl-leg">' + [['in', 'planejado'], ['ac', 'em andamento'], ['wn', 'em validação'], ['ok', 'concluído'], ['dg', 'atrasado'], ['tl', 'planning']].map(function (c) {
          return '<span><i style="background:rgba(var(--' + c[0] + '-rgb),.16);border:1px solid rgba(var(--' + c[0] + '-rgb),.45)"></i>' + c[1] + '</span>';
        }).join('') + '<span><i style="background:repeating-linear-gradient(135deg,rgba(var(--tl-rgb),.2) 0 3px,transparent 3px 6px)"></i>ausência / feriado</span>' +
        '<span>⇥ veio de antes, prazo mantido</span></div></aside>' : '') + '</div>';
    if (!EST.apresentar) h += htmlCapacidade(D, M);
    return h;
  }

  function repinta() {
    var el = EST.el;
    if (!el || !el.isConnected || !AX.APP.D) return;
    var gt = el.querySelector('#pl-gt');
    if (gt) EST.rolagem = gt.scrollLeft;
    el.innerHTML = htmlTela(AX.APP.D, { param: AX.APP.rota.param });
    var g2 = el.querySelector('#pl-gt');
    if (g2) g2.scrollLeft = EST.rolagem;
  }

  // ── Gravar ───────────────────────────────────────────────────────────
  /** Grava um patch de demandas. A barra fica no lugar novo enquanto o
   *  servidor responde (`EST.pend`); recusado, volta. */
  async function grava(patch, ok, aviso) {
    var ids = Object.keys(patch);
    ids.forEach(function (id) { EST.pend[id] = patch[id]; });
    repinta();
    var r;
    try { r = await H.gravar(patch, { ok: ok || 'Planejamento salvo.' }); }
    finally { ids.forEach(function (id) { delete EST.pend[id]; }); }
    // O nucleo redesenha ao gravar ANTES de o patch sair de `pend`: sem este
    // redesenho a barra ficaria no estado "salvando", sem as pontas.
    repinta();
    if (r && r.ok) {
      if (raiz.AXIS_ACOES && raiz.AXIS_ACOES.avisaRevertidos) raiz.AXIS_ACOES.avisaRevertidos(r);
      if (aviso) setTimeout(function () { H.toast(aviso, 'erro'); }, 400);
    } else {
      repinta();
    }
    return r;
  }

  /** `promoveAoAgendar` (gantt.html): agendar e planejar, entao a etapa nao
   *  fica em Planning — mas so com sprint (trava do sprint.js). Devolve o
   *  aviso quando a trava segurou. */
  function promove(m, p) {
    var atual = String(m.status_planejamento || 'backlog');
    if (ETAPAS_ANTES_DE_PLANEJADO.indexOf(atual) < 0) return '';
    var depois = Object.assign({}, m, p);
    if (SP().travaDeAlocacao(depois, atual, 'planejado', H.hoje()).trava) {
      return 'Agendada. Para ir a Planejado, escolha a sprint no card — depois da Planning ela é obrigatória.';
    }
    p.status_planejamento = 'planejado';
    p.status = 'estimada';   // spToStatus('planejado') do gantt.html
    return '';
  }

  /** Troca so o nome da linha de origem pelo da linha de destino: numa dupla,
   *  o outro continua. (O gantt gravava `dev = destino` e desfazia a dupla.) */
  function trocaDev(m, de, para) {
    var out = [];
    nomesDe(m).forEach(function (n) {
      var v = norm(n) === norm(de) ? para : n;
      if (!out.some(function (x) { return norm(x) === norm(v); })) out.push(v);
    });
    if (!out.length) out.push(para);
    return out.join(' / ');
  }

  function ausenteEm(D, dev, a, b) {
    return (D.ausencias || []).filter(function (x) {
      return x && norm(x.dev) === norm(dev) && iso(x.inicio) <= b && iso(x.fim || x.inicio) >= a;
    })[0] || null;
  }

  /** Grava uma chave do topo (`ausencias`, `feriados`) montada sobre a base
   *  FRESCA do servidor, e nao sobre a da tela: quem cadastrou outra ausencia
   *  enquanto esta tela estava aberta nao e apagado. `H.gravar` rele a base de
   *  novo antes de enviar; a janela que sobra e a de uma leitura. */
  async function gravaRaiz(o) {
    var base;
    try { base = await H.api('dados'); }
    catch (e) { H.toast(e.status === 401 ? 'Sessão expirada — saia e entre de novo.' : 'Sem conexão com o servidor: ' + (e.message || e), 'erro'); return { ok: false }; }
    return H.gravar({}, { ok: o.ok, raiz: o.raizDe(base) });
  }

  function avisoAusencia(D, dev, a, b) {
    var au = dev && a ? ausenteEm(D, dev, a, b || a) : null;
    return au ? 'Atenção: o período cai na ausência de ' + dev + ' (' + (AUS[au.tipo] || AUS.outro).rot.toLowerCase() + ' ' + H.dm(au.inicio) + ' a ' + H.dm(au.fim || au.inicio) + ').' : '';
  }

  // ── Arrastar (ponteiro: mouse e caneta; no toque, o clique abre o dialogo) ──
  function celulaZero(el) { return el.querySelector('.pl-gr.cab .pl-dd[data-i="0"]'); }
  function diaSob(x, c0, J) {
    var r = c0.getBoundingClientRect();
    if (!r.width) return -1;
    var i = Math.floor((x - r.left) / r.width);
    return i < 0 ? 0 : i >= J.n ? J.n - 1 : i;
  }
  function linhaSob(x, y) {
    var t = document.elementFromPoint(x, y);
    return t && t.closest ? t.closest('.pl-ln') : null;
  }
  function tip(txt, x, y) {
    var t = document.querySelector('.pl-tip');
    if (!txt) { if (t) t.remove(); return; }
    if (!t) { t = document.createElement('div'); t.className = 'pl-tip'; document.body.appendChild(t); }
    t.textContent = txt;
    t.style.left = Math.min(window.innerWidth - 260, x + 14) + 'px';
    t.style.top = Math.max(8, y - 42) + 'px';
  }
  function limpaAlvos(el) {
    el.querySelectorAll('.pl-ln.alvo, .pl-c.alvo').forEach(function (n) { n.classList.remove('alvo'); });
  }

  function inicioArraste(el, e) {
    if (e.button !== 0 || e.pointerType === 'touch' || !EST.M) return;
    var br = e.target.closest('.pl-br[data-arr]');
    var fc = !br && e.target.closest('.pl-fc[data-arr]');
    if (!br && !fc) return;
    var c0 = celulaZero(el);
    if (!c0) return;
    var J = EST.M.J;
    var modo = fc ? 'alocar' : e.target.closest('.pl-hi') ? 'ini' : e.target.closest('.pl-hf') ? 'fim' : 'mover';
    var alvo = br || fc;
    var m = comPend(porId(alvo.getAttribute('data-id')));
    if (!m) return;
    _arr = {
      modo: modo, el: alvo, m: m, x0: e.clientX, y0: e.clientY, ativo: false, c0: c0, J: J,
      i0: diaSob(e.clientX, c0, J), s: +(alvo.getAttribute('data-s') || 0), e: +(alvo.getAttribute('data-e') || 0),
      ln: alvo.getAttribute('data-ln') || '', delta: 0, destLn: null, dia: -1, fant: null
    };
    e.preventDefault();
    document.addEventListener('pointermove', moveArraste);
    document.addEventListener('pointerup', fimArraste);
    document.addEventListener('keydown', teclaArraste, true);
  }

  function moveArraste(e) {
    var A = _arr;
    if (!A) return;
    var dx = e.clientX - A.x0, dy = e.clientY - A.y0;
    if (!A.ativo) {
      if (Math.abs(dx) + Math.abs(dy) < 5) return;
      A.ativo = true;
      A.el.classList.add('arr');
      if (A.modo === 'alocar') {
        A.fant = A.el.cloneNode(true);
        A.fant.classList.add('pl-fant');
        A.fant.classList.remove('arr');
        document.body.appendChild(A.fant);
      }
    }
    var J = A.J, el = EST.el;
    var i = diaSob(e.clientX, A.c0, J);
    var ln = linhaSob(e.clientX, e.clientY);
    limpaAlvos(el);
    var dd, txt = '';
    if (A.modo === 'alocar') {
      A.fant.style.left = (e.clientX + 10) + 'px';
      A.fant.style.top = (e.clientY + 10) + 'px';
      A.destLn = ln; A.dia = ln ? i : -1;
      if (ln) {
        ln.classList.add('alvo');
        var cel = ln.querySelector('.pl-c[data-i="' + i + '"]');
        if (cel) cel.classList.add('alvo');
        dd = J.dias[i];
        txt = ln.getAttribute('data-pl-dev') + ' · ' + DS[dow(dd.d)] + ' ' + H.dm(dd.d) + (dd.fe ? ' · feriado' : '');
      } else txt = 'Solte na linha de um dev';
    } else if (A.modo === 'mover') {
      A.delta = i - A.i0;
      A.destLn = ln || null;
      if (ln) ln.classList.add('alvo');
      A.el.style.transform = 'translate(' + (A.delta * A.c0.getBoundingClientRect().width) + 'px,' + dy + 'px)';
      var nd = novasDatas(A);
      txt = (nd ? H.dm(nd.ini) + ' → ' + H.dm(nd.fim) : '') + (ln && ln.getAttribute('data-pl-dev') !== A.ln ? ' · ' + ln.getAttribute('data-pl-dev') : '');
    } else {
      A.delta = i - A.i0;
      var s = A.s, f = A.e;
      if (A.modo === 'ini') s = Math.max(0, Math.min(A.e, A.s + A.delta)); else f = Math.min(J.n - 1, Math.max(A.s, A.e + A.delta));
      A.el.style.gridColumn = (s + 2) + ' / ' + (f + 3);
      var nd2 = novasDatas(A);
      txt = nd2 ? (A.modo === 'ini' ? 'início ' + H.dm(nd2.ini) : 'prazo ' + H.dm(nd2.fim)) : '';
    }
    tip(txt, e.clientX, e.clientY);
  }

  /** As datas que o arraste daria, pela unidade da regua (dia de semana). */
  function novasDatas(A) {
    var m = A.m, J = A.J;
    var a = iso(m.inicio) || iso(m.entrega), b = iso(m.entrega) || iso(m.inicio);
    if (!a) return null;
    if (b < a) b = a;
    if (A.modo === 'mover') {
      if (!A.delta) return { ini: a, fim: b };
      if (b < J.ini) {
        // Herdada: a barra comeca no inicio da janela; o arraste a recoloca de
        // la, com a mesma duracao em dias uteis.
        var ni = J.dias[Math.max(0, Math.min(J.n - 1, A.s + A.delta))].d;
        return { ini: ni, fim: maisUteis(ni, uteisEntre(a, b)) };
      }
      return { ini: maisUteis(a, A.delta), fim: maisUteis(b, A.delta) };
    }
    if (A.modo === 'ini') return { ini: J.dias[Math.max(0, Math.min(A.e, A.s + A.delta))].d, fim: b };
    if (A.modo === 'fim') return { ini: a, fim: J.dias[Math.min(J.n - 1, Math.max(A.s, A.e + A.delta))].d };
    return null;
  }

  function encerraArraste() {
    document.removeEventListener('pointermove', moveArraste);
    document.removeEventListener('pointerup', fimArraste);
    document.removeEventListener('keydown', teclaArraste, true);
    var A = _arr;
    _arr = null;
    tip('');
    if (A) {
      A.el.classList.remove('arr');
      A.el.style.transform = '';
      if (A.fant) A.fant.remove();
    }
    if (EST.el) limpaAlvos(EST.el);
    return A;
  }
  function teclaArraste(e) {
    if (e.key !== 'Escape' || !_arr) return;
    e.preventDefault();
    var A = encerraArraste();
    if (A && A.ativo) { _suprime = true; setTimeout(function () { _suprime = false; }, 0); repinta(); }
  }

  function fimArraste(e) {
    var A = encerraArraste();
    if (!A || !A.ativo) return;   // sem arraste: o clique segue
    _suprime = true;
    setTimeout(function () { _suprime = false; }, 0);
    var D = AX.APP.D, m = A.m, J = A.J;
    if (A.modo === 'alocar') {
      if (!A.destLn || A.dia < 0) return;
      var dd = J.dias[A.dia];
      if (dd.fe) { H.toast('Não é possível alocar em feriados.', 'erro'); return; }
      var dev = A.destLn.getAttribute('data-pl-dev');
      var p = { dev: dev, inicio: dd.d, entrega: dd.d };
      var aviso = promove(m, p);
      var p2 = {}; p2[m.id] = p;
      grava(p2, 'Alocada para ' + dev + ' em ' + H.dm(dd.d) + '.', aviso || avisoAusencia(D, dev, dd.d, dd.d));
      return;
    }
    var nd = novasDatas(A);
    var destino = A.modo === 'mover' && A.destLn ? A.destLn.getAttribute('data-pl-dev') : A.ln;
    if (!nd) { repinta(); return; }
    var pt = {};
    if (nd.ini !== iso(m.inicio)) pt.inicio = nd.ini;
    if (nd.fim !== iso(m.entrega)) pt.entrega = nd.fim;
    if (destino && norm(destino) !== norm(A.ln)) pt.dev = trocaDev(m, A.ln, destino);
    if (!Object.keys(pt).length) { repinta(); return; }
    if ((pt.inicio && J.ferSet[pt.inicio]) || (A.modo === 'fim' && pt.entrega && J.ferSet[pt.entrega])) {
      H.toast('Não é possível alocar em feriados.', 'erro'); repinta(); return;
    }
    var p3 = {}; p3[m.id] = pt;
    grava(p3, A.modo === 'mover' ? (pt.dev ? 'Movida para ' + destino + '.' : 'Datas atualizadas.') : A.modo === 'ini' ? 'Início atualizado.' : 'Prazo atualizado.',
      avisoAusencia(D, destino, nd.ini, nd.fim));
  }

  // ── Dialogos ─────────────────────────────────────────────────────────
  function dialogo(html, aoMontar) {
    var ov = document.createElement('div');
    ov.className = 'ovl';
    ov.innerHTML = '<div class="dlg pl-dlg" role="dialog" aria-modal="true">' +
      '<button type="button" class="dlg-x" data-plx="1" aria-label="Fechar">' + ico('x') + '</button>' + html + '</div>';
    var antes = document.activeElement;
    var fecha = function () {
      document.removeEventListener('keydown', tecla, true);
      ov.remove();
      try { if (antes && antes.focus && antes.isConnected) antes.focus(); } catch (_) {}
    };
    var tecla = function (e) { if (e.key === 'Escape') { e.preventDefault(); fecha(); } };
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-plx]')) fecha(); });
    document.addEventListener('keydown', tecla, true);
    document.body.appendChild(ov);
    var d = { ov: ov, fecha: fecha, q: function (s) { return ov.querySelector(s); } };
    if (aoMontar) aoMontar(d);
    setTimeout(function () { var p = ov.querySelector('.in:not([disabled]), .btnp'); if (p) p.focus(); }, 0);
    return d;
  }
  async function confirma(titulo, texto, ok) {
    if (raiz.AXIS_ACOES && raiz.AXIS_ACOES.caixa) return !!(await raiz.AXIS_ACOES.caixa({ titulo: titulo, texto: texto, ok: ok, perigo: true }));
    return raiz.confirm ? raiz.confirm(titulo + '\n\n' + texto) : false;
  }

  /** Dev, inicio, prazo (e a sprint, para o PM/PO) de uma demanda: o
   *  caminho de teclado e de toque para tudo o que o arraste faz. */
  function abrirPlanejar(m0, pre) {
    var D = AX.APP.D, m = comPend(m0);
    var trava = travada(m);
    var pessoas = EST.M ? EST.M.todas.map(function (l) { return l.nome; }) : devsAtivos(D);
    pessoas = pessoas.slice().sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    var devAtual = (pre && pre.dev) || m.dev || '';
    var opsDev = opt('', 'Sem responsável', devAtual) + (devAtual && pessoas.indexOf(devAtual) < 0 ? opt(devAtual, devAtual, devAtual) : '') +
      pessoas.map(function (n) { return opt(n, n, devAtual); }).join('');
    var ini = (pre && pre.dia) || iso(m.inicio), fim = (pre && pre.dia) || iso(m.entrega);
    var sAtual = SP().doPO(m);
    var fechada = !!sAtual && SP().estaFechada(D, sAtual);
    var opsSp = '';
    var dono = donoDaSprint();
    if (dono) {
      var ops = SP().proximasSprints(H.hoje(), 5, fer(D), SP().rotulosFechados(D));
      opsSp = opt('', 'Fora da sprint', sAtual) + (sAtual && !ops.some(function (o) { return o.rotulo === sAtual; }) ? opt(sAtual, sprintCurto(sAtual) + (fechada ? ' · fechada' : ' · anterior'), sAtual) : '') +
        ops.map(function (o) { return opt(o.rotulo, sprintCurto(o.rotulo) + ' · ' + H.dm(o.de) + '–' + H.dm(o.ate) + (o.agora ? ' · agora' : ''), sAtual); }).join('');
    }
    var col = String(m.status_planejamento || 'backlog');
    var podeVoltar = (iso(m.inicio) || iso(m.entrega) || m.dev) && !trava && ['validacao_area', 'validacao', 'concluido', 'negada'].indexOf(col) < 0;
    var html = '<h2>' + esc(m.codigo || '') + ' · ' + esc(m.titulo || '') + '</h2>' +
      '<div class="row" style="flex-wrap:wrap;gap:8px">' + H.chipEtapa(m) + (pontuado(m) ? chip(m.poker_pontos + ' pts', 'bk') : chip('sem pontos', 'wn')) +
      (sAtual ? chip('Sprint ' + esc(sprintCurto(sAtual)), 'ac') : chip('fora da sprint', 'bk')) +
      '<span class="note">' + esc(H.caminho(m.tema_id) || '') + '</span></div>' +
      '<div class="pl-fm"><label class="pl-lg">Responsável<select class="in" id="plp-dev">' + opsDev + '</select></label>' +
      '<label>Início<input class="in" type="date" id="plp-ini" value="' + esc(ini) + '"' + (trava ? ' disabled' : '') + '></label>' +
      '<label>Prazo do dev<input class="in" type="date" id="plp-fim" value="' + esc(fim) + '"' + (trava ? ' disabled' : '') + '></label>' +
      (dono ? '<label class="pl-lg">Sprint (PM/PO)<select class="in" id="plp-sp"' + (fechada ? ' disabled title="Sprint fechada: a demanda não sai mais dela."' : '') + '>' + opsSp + '</select></label>' : '') +
      '</div>' +
      (trava ? '<div class="lock">' + ico('lock') + '<span>A partir de Planejado a data é compromisso: quem muda é o PM/PO. Você ainda pode trocar o responsável.</span></div>' : '') +
      (!dono && !sAtual && ETAPAS_ANTES_DE_PLANEJADO.indexOf(col) >= 0 ? '<div class="lock">' + ico('info') + '<span>Sem sprint, a demanda é agendada mas fica em ' + esc((H.ETAPA_POR_ID[col] || {}).rotulo || col) + ': quem escolhe a sprint é o PM/PO.</span></div>' : '') +
      '<div class="pl-er" id="plp-er" role="alert"></div>' +
      '<div class="pl-pe"><span class="esq"><a class="btns" href="' + H.hrefItem(m) + '" data-plx="1">Abrir item</a>' +
      (raiz.AXIS_FORM && raiz.AXIS_FORM.abrir ? '<button type="button" class="btns" id="plp-form">Mais campos</button>' : '') +
      (podeVoltar ? '<button type="button" class="btns" id="plp-volta">' + ico('undo') + ' Voltar ao backlog</button>' : '') + '</span>' +
      '<button type="button" class="btn" data-plx="1">Cancelar</button><button type="button" class="btnp" id="plp-ok">Salvar</button></div>';
    dialogo(html, function (d) {
      var erro = d.q('#plp-er');
      var form = d.q('#plp-form');
      if (form) form.addEventListener('click', function () { d.fecha(); raiz.AXIS_FORM.abrir(m0); });
      var volta = d.q('#plp-volta');
      if (volta) volta.addEventListener('click', async function () {
        d.fecha();
        if (!(await confirma('Voltar ao backlog', (m.codigo || '') + ' perde o dev e as datas e volta para Backlog.', 'Voltar ao backlog'))) return;
        // returnToBacklog (gantt.html)
        var p = {}; p[m.id] = { inicio: '', entrega: '', dev: '', status_planejamento: 'backlog' };
        grava(p, 'Voltou ao backlog.');
      });
      d.q('#plp-ok').addEventListener('click', function () {
        var dev = d.q('#plp-dev').value;
        var a = d.q('#plp-ini').value, b = d.q('#plp-fim').value;
        if (a && !b) b = a;
        if (a && b && b < a) { erro.textContent = 'O prazo não pode ser antes do início.'; return; }
        var Fs = (EST.M && EST.M.J.ferSet) || {};
        var ferOk = {};
        fer(D).forEach(function (f) { ferOk[feriadoISO(f)] = true; });
        if (!trava && a && a !== iso(m.inicio) && (ferOk[a] || Fs[a])) { erro.textContent = 'Não é possível alocar em feriados.'; return; }
        if (!trava && a && fds(a) && a !== iso(m.inicio)) { erro.textContent = 'O início cai num fim de semana.'; return; }
        var p = {};
        if (dev !== (m.dev || '')) p.dev = dev;
        if (!trava) {
          if (a !== iso(m.inicio)) p.inicio = a;
          if (b !== iso(m.entrega)) p.entrega = b;
        }
        var sel = d.q('#plp-sp');
        if (sel && !sel.disabled && sel.value !== sAtual) {
          // O gesto do chip de sprint: `repassar`/`retirar` do sprint.js, como no
          // formulario do app, e nao `sprint_po` gravado direto.
          var copia = JSON.parse(JSON.stringify(m));
          var rr = sel.value ? SP().repassar(copia, sel.value, quem(), H.hoje(), { dados: D }) : SP().retirar(copia, quem(), H.hoje(), { dados: D });
          if (!rr.ok) { erro.textContent = rr.erro; return; }
          ['sprint_po', 'sprint_po_em', 'sprint_po_por', 'sprint_po_historico', 'entrega_usuario'].forEach(function (k) {
            if (JSON.stringify(copia[k]) !== JSON.stringify(m[k])) p[k] = copia[k];
          });
        }
        var aviso = '';
        var vaiDev = p.dev != null ? p.dev : m.dev;
        var vaiData = (p.inicio != null ? p.inicio : iso(m.inicio)) || (p.entrega != null ? p.entrega : iso(m.entrega));
        if (vaiDev && vaiData && Object.keys(p).length) aviso = promove(m, p);
        if (!Object.keys(p).length) { d.fecha(); return; }
        d.fecha();
        var pp = {}; pp[m.id] = p;
        var aa = p.inicio != null ? p.inicio : iso(m.inicio), bb = p.entrega != null ? p.entrega : iso(m.entrega);
        grava(pp, 'Planejamento salvo.', aviso || avisoAusencia(D, (vaiDev || '').split('/')[0].trim(), aa, bb));
      });
    });
  }

  // ── Ausencias ────────────────────────────────────────────────────────
  function abrirAusencias(editarId) {
    var D = AX.APP.D, ed = podeEditar();
    var hoje = H.hoje();
    var st = { edita: editarId || '', todas: false };
    var pessoas = devsAtivos(D).slice();
    (D.ausencias || []).forEach(function (x) { if (x && x.dev && !pessoas.some(function (n) { return norm(n) === norm(x.dev); })) pessoas.push(x.dev); });
    pessoas.sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    var html = '<h2>' + ico('calendar') + ' Ausências</h2>' +
      '<span class="sub">Férias, atestados e folgas. O dia ausente sai dos dias livres da pessoa e aparece riscado na linha dela, para realocar ou não planejar naquele período.</span>' +
      (ed ? '<div class="pl-fm" id="pla-fm">' +
        '<label>Pessoa *<select class="in" id="pla-dev">' + pessoas.map(function (n) { return opt(n, n, ''); }).join('') + '</select></label>' +
        '<label>Tipo *<select class="in" id="pla-tipo">' + AUS_ORDEM.map(function (k) { return opt(k, AUS[k].rot, 'ferias'); }).join('') + '</select></label>' +
        '<label>Início *<input class="in" type="date" id="pla-ini"></label>' +
        '<label>Fim *<input class="in" type="date" id="pla-fim"></label>' +
        '<label class="pl-lg">Observação<input class="in" id="pla-obs" placeholder="opcional — ex.: férias programadas" autocomplete="off"></label></div>' +
        '<div class="lock" id="pla-imp" style="display:none"></div>' +
        '<div class="pl-er" id="pla-er" role="alert"></div>' +
        '<div class="pl-pe"><button type="button" class="btn" id="pla-cancela" style="display:none">Cancelar edição</button>' +
        '<button type="button" class="btnp" id="pla-ok">+ Adicionar ausência</button></div>' : '') +
      '<div class="row" style="justify-content:space-between"><span class="lab" id="pla-n"></span>' +
      '<button type="button" class="btns" id="pla-todas">Mostrar as que já passaram</button></div>' +
      '<div class="pl-lst" id="pla-lista"></div>' +
      '<div class="pl-pe"><button type="button" class="btn" data-plx="1">Fechar</button></div>';
    dialogo(html, function (d) {
      var q = d.q;
      function lista() { return ((AX.APP.D || {}).ausencias || []).filter(Boolean); }
      function pintaLista() {
        var todas = lista().slice().sort(function (a, b) { return String(b.inicio || '').localeCompare(String(a.inicio || '')); });
        var vis = st.todas ? todas : todas.filter(function (x) { return iso(x.fim || x.inicio) >= hoje; });
        q('#pla-n').textContent = (st.todas ? 'CADASTRADAS · ' : 'DE HOJE EM DIANTE · ') + vis.length;
        q('#pla-todas').textContent = st.todas ? 'Só de hoje em diante' : 'Mostrar as que já passaram';
        q('#pla-lista').innerHTML = vis.length ? vis.map(function (x) {
          var t = AUS[x.tipo] || AUS.outro;
          return '<div class="pl-li' + (st.edita === x.id ? ' ed' : '') + '"><span class="dotc" style="background:var(--' + t.cor + ')"></span>' +
            '<span class="t"><b>' + esc(x.dev) + '</b> · ' + esc(t.rot) + '<small>' + H.dma(x.inicio) + ' a ' + H.dma(x.fim || x.inicio) + (x.obs ? ' · ' + esc(x.obs) : '') + '</small></span>' +
            (ed && x.id ? '<button type="button" class="btns" data-pla-ed="' + esc(x.id) + '">Editar</button><button type="button" class="btns" data-pla-rm="' + esc(x.id) + '">Remover</button>' : '') + '</div>';
        }).join('') : '<span class="note">' + (st.todas ? 'Nenhuma ausência cadastrada.' : 'Ninguém com ausência marcada daqui para a frente.') + '</span>';
      }
      function impacto() {
        var box = q('#pla-imp');
        if (!box) return;
        var dev = q('#pla-dev').value, a = q('#pla-ini').value, b = q('#pla-fim').value || a;
        if (!dev || !a || b < a) { box.style.display = 'none'; return; }
        var itens = H.visiveis().filter(function (m) {
          if (!(raiz.DEVNOME ? raiz.DEVNOME.eDe(m, dev) : H.devsDe(m).indexOf(dev) >= 0)) return false;
          var gr = etapaGravada(m);
          if (gr === 'concluido' || gr === 'negada') return false;
          var x = iso(m.inicio) || iso(m.entrega), y = iso(m.entrega) || iso(m.inicio);
          return x && x <= b && y >= a;
        });
        if (!itens.length) { box.style.display = 'none'; return; }
        box.style.display = '';
        box.innerHTML = ico('alert') + '<span>' + esc(dev) + ' tem ' + H.plural(itens.length, 'item', 'itens') + ' com data dentro do período (' +
          itens.slice(0, 6).map(function (m) { return esc(m.codigo || m.id); }).join(', ') + (itens.length > 6 ? '…' : '') + '): vão aparecer como conflito no planejamento.</span>';
      }
      function preenche(x) {
        q('#pla-dev').value = x ? x.dev : (pessoas[0] || '');
        if (x && q('#pla-dev').value !== x.dev) { q('#pla-dev').insertAdjacentHTML('beforeend', opt(x.dev, x.dev, x.dev)); q('#pla-dev').value = x.dev; }
        q('#pla-tipo').value = x && AUS[x.tipo] ? x.tipo : 'ferias';
        q('#pla-ini').value = x ? iso(x.inicio) : '';
        q('#pla-fim').value = x ? iso(x.fim || x.inicio) : '';
        q('#pla-obs').value = x ? (x.obs || '') : '';
        q('#pla-ok').textContent = x ? 'Salvar alteração' : '+ Adicionar ausência';
        q('#pla-cancela').style.display = x ? '' : 'none';
        q('#pla-er').textContent = '';
        impacto();
      }
      pintaLista();
      if (ed) {
        ['#pla-dev', '#pla-ini', '#pla-fim'].forEach(function (s) { q(s).addEventListener('change', impacto); });
        if (st.edita) preenche(lista().filter(function (x) { return x.id === st.edita; })[0] || null);
        q('#pla-cancela').addEventListener('click', function () { st.edita = ''; preenche(null); pintaLista(); });
        q('#pla-ok').addEventListener('click', async function () {
          var er = q('#pla-er');
          var nova = { dev: q('#pla-dev').value, tipo: q('#pla-tipo').value, inicio: q('#pla-ini').value, fim: q('#pla-fim').value, obs: q('#pla-obs').value.trim() };
          if (!nova.dev) { er.textContent = 'Selecione a pessoa.'; return; }
          if (!nova.inicio || !nova.fim) { er.textContent = 'Informe início e fim.'; return; }
          if (nova.fim < nova.inicio) { er.textContent = 'O fim não pode ser antes do início.'; return; }
          // Sobreposicao com outra ausencia da mesma pessoa (addAusencia).
          var conf = lista().filter(function (x) { return x.id !== st.edita && norm(x.dev) === norm(nova.dev) && nova.inicio <= iso(x.fim || x.inicio) && nova.fim >= iso(x.inicio); })[0];
          if (conf) { er.textContent = 'Já existe ausência de ' + nova.dev + ' de ' + H.dma(conf.inicio) + ' a ' + H.dma(conf.fim || conf.inicio) + '.'; return; }
          var id = st.edita;
          var btn = q('#pla-ok');
          btn.disabled = true;
          var r = await gravaRaiz({
            ok: id ? 'Ausência atualizada.' : 'Ausência adicionada.',
            // Sobre a lista FRESCA do servidor: duas pessoas cadastrando ao
            // mesmo tempo nao apagam uma a outra.
            raizDe: function (base) {
              var l = ((base || {}).ausencias || []).slice();
              if (id) return { ausencias: l.map(function (x) { return x && x.id === id ? Object.assign({}, x, nova) : x; }) };
              l.push(Object.assign({ id: 'au' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }, nova));
              return { ausencias: l };
            }
          });
          if (!d.ov.isConnected) return;
          btn.disabled = false;
          if (r && r.ok) { st.edita = ''; preenche(null); pintaLista(); }
        });
      }
      q('#pla-todas').addEventListener('click', function () { st.todas = !st.todas; pintaLista(); });
      q('#pla-lista').addEventListener('click', async function (e) {
        var b = e.target.closest('[data-pla-ed]');
        if (b) { st.edita = b.getAttribute('data-pla-ed'); preenche(lista().filter(function (x) { return x.id === st.edita; })[0] || null); pintaLista(); q('#pla-dev').focus(); return; }
        var rm = e.target.closest('[data-pla-rm]');
        if (!rm) return;
        var id = rm.getAttribute('data-pla-rm');
        var x = lista().filter(function (y) { return y.id === id; })[0];
        if (!x) return;
        rm.disabled = true;
        if (!window.confirm('Remover a ausência de ' + x.dev + ' (' + H.dma(x.inicio) + ' a ' + H.dma(x.fim || x.inicio) + ')?')) { rm.disabled = false; return; }
        var r = await gravaRaiz({ ok: 'Ausência removida.', raizDe: function (base) {
          return { ausencias: ((base || {}).ausencias || []).filter(function (y) { return !y || y.id !== id; }) };
        } });
        if (!d.ov.isConnected) return;
        if (r && r.ok) { if (st.edita === id) { st.edita = ''; preenche(null); } pintaLista(); } else rm.disabled = false;
      });
    });
  }

  // ── Feriados (admin) ─────────────────────────────────────────────────
  function abrirFeriados() {
    if (!ehAdmin()) return;
    var hoje = H.hoje();
    var st = { ano: +hoje.slice(0, 4), edita: '' };
    var html = '<h2>' + ico('flag') + ' Feriados</h2>' +
      '<span class="sub">O cadastro único que o Worker e todas as telas leem. Feriado sai dos dias úteis: muda a capacidade, o prazo da área e, se apagar uma semana inteira, o rótulo das sprints.</span>' +
      '<div class="pl-fm"><label>Data *<input class="in" type="date" id="plf-data"></label>' +
      '<label>Nome<input class="in" id="plf-nome" placeholder="ex.: Proclamação da República" autocomplete="off"></label></div>' +
      '<div class="pl-er" id="plf-er" role="alert"></div>' +
      '<div class="pl-pe"><button type="button" class="btn" id="plf-cancela" style="display:none">Cancelar edição</button><button type="button" class="btnp" id="plf-ok">+ Adicionar feriado</button></div>' +
      '<div class="row" style="justify-content:space-between"><span class="lab" id="plf-n"></span><span class="row" style="gap:6px">' +
      '<button type="button" class="btns" id="plf-ant" aria-label="Ano anterior">‹</button><span class="mono" id="plf-ano"></span>' +
      '<button type="button" class="btns" id="plf-prx" aria-label="Próximo ano">›</button></span></div>' +
      '<div class="pl-lst" id="plf-lista"></div>' +
      '<div class="pl-pe"><button type="button" class="btn" data-plx="1">Fechar</button></div>';
    dialogo(html, function (d) {
      var q = d.q;
      function lista() { return ((AX.APP.D || {}).feriados || []).map(function (f) { return { data: feriadoISO(f), nome: (f && f.nome) || '' }; }).filter(function (f) { return f.data; }); }
      function pinta() {
        var vis = lista().filter(function (f) { return f.data.slice(0, 4) === String(st.ano); }).sort(function (a, b) { return a.data.localeCompare(b.data); });
        q('#plf-ano').textContent = st.ano;
        q('#plf-n').textContent = 'FERIADOS DE ' + st.ano + ' · ' + vis.length;
        q('#plf-lista').innerHTML = vis.length ? vis.map(function (f) {
          var dw = DS[dow(f.data)];
          return '<div class="pl-li' + (st.edita === f.data ? ' ed' : '') + '"' + (f.data < hoje ? ' style="opacity:.6"' : '') + '><span class="mono" style="color:var(--tl-t);width:44px">' + H.dm(f.data) + '</span>' +
            '<span class="t"><b>' + (f.nome ? esc(f.nome) : '<span class="note">sem nome</span>') + '</b><small>' + dw + (fds(f.data) ? ' · fim de semana, não muda nada' : '') + '</small></span>' +
            '<button type="button" class="btns" data-plf-ed="' + f.data + '">Editar</button><button type="button" class="btns" data-plf-rm="' + f.data + '">Remover</button></div>';
        }).join('') : '<span class="note">Nenhum feriado cadastrado em ' + st.ano + '.</span>';
      }
      function preenche(f) {
        st.edita = f ? f.data : '';
        q('#plf-data').value = f ? f.data : '';
        q('#plf-nome').value = f ? f.nome : '';
        q('#plf-ok').textContent = f ? 'Salvar alteração' : '+ Adicionar feriado';
        q('#plf-cancela').style.display = f ? '' : 'none';
        q('#plf-er').textContent = '';
      }
      /* Toda a lista volta como { data, nome } — a forma que o Worker ja
         normaliza e republica (feriadosISO). */
      var normaliza = function (l) { return (l || []).map(function (f) { return typeof f === 'object' && f ? f : { data: f }; }).filter(function (f) { return feriadoISO(f); }); };
      pinta();
      q('#plf-ant').addEventListener('click', function () { st.ano--; pinta(); });
      q('#plf-prx').addEventListener('click', function () { st.ano++; pinta(); });
      q('#plf-cancela').addEventListener('click', function () { preenche(null); pinta(); });
      q('#plf-ok').addEventListener('click', async function () {
        var data = q('#plf-data').value, nome = q('#plf-nome').value.trim(), velha = st.edita;
        var er = q('#plf-er');
        if (!data) { er.textContent = 'Informe a data.'; return; }
        if (data !== velha && lista().some(function (f) { return f.data === data; })) { er.textContent = 'Já há feriado em ' + H.dma(data) + '.'; return; }
        var btn = q('#plf-ok');
        btn.disabled = true;
        var r = await gravaRaiz({ ok: velha ? 'Feriado atualizado.' : 'Feriado adicionado.', raizDe: function (base) {
          var l = normaliza((base || {}).feriados).filter(function (f) { return feriadoISO(f) !== velha && feriadoISO(f) !== data; });
          l.push(nome ? { data: data, nome: nome } : { data: data });
          l.sort(function (a, b) { return feriadoISO(a).localeCompare(feriadoISO(b)); });
          return { feriados: l };
        } });
        if (!d.ov.isConnected) return;
        btn.disabled = false;
        if (r && r.ok) { st.ano = +data.slice(0, 4); preenche(null); pinta(); }
      });
      q('#plf-lista').addEventListener('click', async function (e) {
        var b = e.target.closest('[data-plf-ed]');
        if (b) { preenche(lista().filter(function (f) { return f.data === b.getAttribute('data-plf-ed'); })[0] || null); pinta(); q('#plf-data').focus(); return; }
        var rm = e.target.closest('[data-plf-rm]');
        if (!rm) return;
        var data = rm.getAttribute('data-plf-rm');
        if (!window.confirm('Remover o feriado de ' + H.dma(data) + '? O dia volta a ser útil para sprint, capacidade e prazo.')) return;
        rm.disabled = true;
        var r = await gravaRaiz({ ok: 'Feriado removido.', raizDe: function (base) {
          return { feriados: normaliza((base || {}).feriados).filter(function (f) { return feriadoISO(f) !== data; }) };
        } });
        if (!d.ov.isConnected) return;
        if (r && r.ok) { if (st.edita === data) preenche(null); pinta(); } else rm.disabled = false;
      });
    });
  }

  // ── Eventos (delegados no <div> da vista) ─────────────────────────────
  function ligar(el, ctx) {
    EST.el = el;
    var gt = el.querySelector('#pl-gt');
    if (gt) { gt.scrollLeft = EST.rolagem; }
    el.addEventListener('scroll', function (e) { if (e.target && e.target.id === 'pl-gt') EST.rolagem = e.target.scrollLeft; }, true);
    el.addEventListener('pointerdown', function (e) { inicioArraste(el, e); });
    el.addEventListener('dragstart', function (e) { if (e.target.closest && e.target.closest('.pl-br, .pl-fc')) e.preventDefault(); });
    el.addEventListener('click', function (e) {
      if (_suprime) { e.preventDefault(); e.stopPropagation(); return; }
      var br = e.target.closest('.pl-br[data-ed], .pl-fc[data-arr], .pl-lim .it');
      if (br && podeEditar() && !e.ctrlKey && !e.metaKey) {
        var m = porId(br.getAttribute('data-id'));
        if (m) { e.preventDefault(); abrirPlanejar(m); }
        return;
      }
      var b = e.target.closest('[data-pl]');
      if (b) {
        var a = b.getAttribute('data-pl');
        if (a === 'aus') abrirAusencias();
        else if (a === 'fer') abrirFeriados();
        else if (a === 'apres') { EST.apresentar = !EST.apresentar; repinta(); }
        else if (a === 'limpar') { Object.keys(F).forEach(function (k) { if (k !== 'q') F[k] = ''; }); repinta(); }
        else if (a === 'todos') { F.dev = '__todos__'; repinta(); }
        else if (a === 'limbo') { EST.limbo = !EST.limbo; poeLS('axis_plan_limbo', EST.limbo ? '1' : ''); repinta(); }
        return;
      }
      var hs = e.target.closest('[data-pl-sprint]');
      if (hs) { var r = hs.getAttribute('data-pl-sprint'); F.sprintPo = F.sprintPo === r ? '' : r; repinta(); }
    });
    el.addEventListener('change', function (e) {
      var t = e.target;
      var k = t.getAttribute && t.getAttribute('data-plf');
      if (k) { F[k] = t.value; repinta(); return; }
      if (t.id === 'pl-zoom') { EST.zoom = +t.value || 2; poeLS('axis_plan_zoom', String(EST.zoom)); EST.rolagem = 0; repinta(); return; }
      if (t.id === 'pl-cap-sel') { EST.capSel = t.value; poeLS('axis_plan_cap', '1'); repinta(); }
    });
    el.addEventListener('toggle', function (e) { if (e.target && e.target.id === 'pl-cap') poeLS('axis_plan_cap', e.target.open ? '1' : ''); }, true);
    var tq = null;
    el.addEventListener('input', function (e) {
      if (e.target.id !== 'pl-q') return;
      F.q = e.target.value;
      clearTimeout(tq);
      tq = setTimeout(function () {
        var box = el.querySelector('#pl-fila');
        if (box) box.innerHTML = htmlFilaLista(AX.APP.D).html;
      }, 120);
    });
    // #planejamento/ausencias e #planejamento/feriados abrem o cadastro (os
    // links do Calendario e das Configuracoes). O pedaço sai do endereco para
    // o redesenho seguinte nao abrir de novo.
    var segs = String(ctx.param || '').split('/');
    var quer = segs.indexOf('ausencias') >= 0 ? 'aus' : segs.indexOf('feriados') >= 0 ? 'fer' : '';
    if (quer) {
      var resto = segs.filter(function (s) { return s && s !== 'ausencias' && s !== 'feriados'; }).join('/');
      try { history.replaceState(null, '', '#planejamento' + (resto ? '/' + resto : '')); } catch (_) {}
      AX.APP.rota.param = resto;
      setTimeout(function () { if (quer === 'aus') abrirAusencias(); else abrirFeriados(); }, 0);
    }
  }

  // ── Registro ─────────────────────────────────────────────────────────
  AX.tela({
    id: 'planejamento',
    rotulo: 'Planejamento',
    papeis: ['admin', 'analista', 'dev'],
    menu: false,
    param: true,
    titulo: function () { return 'Planejamento'; },
    render: function (el, ctx) {
      injetarCss();
      if (!raiz.SPRINTPO) { el.innerHTML = H.vazio('alert', 'Regra de sprint não carregada', 'O sprint.js não foi lido pela página.'); return; }
      EST.el = el;
      el.innerHTML = htmlTela(ctx.D, ctx);
    },
    depois: function (el, ctx) { ligar(el, ctx); }
  });
})();
