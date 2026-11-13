/* ─────────────────────────────────────────────────────────────────────────
   AXIS — tela Sprints (axis.html#sprints).

   CINCO ABAS DO PROTOTIPO (Sprints.dc.html): Sprint atual, Planning,
   Planejamento, Encerrar sprint e Calendario do time. Todas leem a base pelas
   regras do `sprint.js` (SPRINTPO): placar, ranking, capacidade, balanco e
   pendentes de fechamento. A tela nao conta nada que o modulo ja conte.

   O QUE O PROTOTIPO TEM E O ROADMAP NAO: meta da sprint, reserva do plantao,
   velocidade com desconto de ausencia, retrospectiva e "Ready". Esses blocos
   ficam de fora em vez de virarem numero inventado. O burndown fica, porque
   da para reconstruir com honestidade: a data em que cada demanda entrou na
   sprint esta em `sprint_po_historico` e a data em que o dev entregou esta em
   `entregue_em` (CAPACIDADE.diaDaEntrega).

   O CICLO DA SPRINT GRAVA DAQUI (ver "O CICLO DA SPRINT", mais abaixo):
   iniciar (Sprint atual e Planning), repassar em lote (Planning) e fechar,
   com destino e motivo de cada demanda que nao entregou (Encerrar sprint).
   As tres sao do dono da sprint, como no admin.html. Estimar e a tela Poker
   do app (#poker, axis-tela-poker.js). Mover, alocar, ausencia e feriado sao
   a tela Planejamento do app (#planejamento, axis-tela-planejamento.js).

   O QUE FALTA DIRECIONAR (Sprint atual), como na bandeja Sprint do
   Gerencial do admin: a faixa das demandas depois da Planning sem sprint
   (`renderSprLinha`) e o backlog da sprint por dev, com o seletor que grava
   o dev na hora (`renderGerSprint` + `sprDirecionar`).
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var raiz = typeof window !== 'undefined' ? window : globalThis;
  var AX = raiz.AXIS_APP;
  if (!AX) return;
  var H = AX.H;
  var esc = H.esc, ico = H.ico, chip = H.chip;

  // ── CSS proprio da tela (uma vez) ─────────────────────────────────────
  /* Classes em vez de `grid-template-columns` inline: o container query do
     nucleo derruba todo grid inline para UMA coluna abaixo de 760 px, e o
     prototipo celular mostra os indicadores em DUAS. */
  function injetarCss() {
    if (typeof document === 'undefined' || document.getElementById('css-tela-sprints')) return;
    var s = document.createElement('style');
    s.id = 'css-tela-sprints';
    s.textContent = [
      '.axa .sp-hd{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px}',
      '.axa .sp-hd .tt{display:flex;flex-direction:column;gap:6px;min-width:0}',
      '.axa .sp-hd .tt .row{flex-wrap:wrap}',
      '.axa .sp-hd .ac{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
      '.axa .sp-sel{height:40px;padding:0 34px 0 12px;border-radius:11px;border:1px solid var(--bd2);background:var(--sf);color:var(--tx);font:inherit;font-size:13px}',
      '.axa .sp-est{height:24px;padding:0 10px;border-radius:7px;display:inline-flex;align-items:center;font-size:11.5px;font-weight:800;letter-spacing:.02em}',
      '.axa .sp-est.x-ac{background:rgba(var(--ac-rgb),.16);color:var(--ac-t)}',
      '.axa .sp-est.x-in{background:rgba(var(--in-rgb),.16);color:var(--in-t)}',
      '.axa .sp-est.x-ok{background:rgba(var(--ok-rgb),.14);color:var(--ok-t)}',
      '.axa .sp-est.x-wn{background:rgba(var(--wn-rgb),.16);color:var(--wn-t)}',
      '.axa .sp-faixa{padding:14px 20px;border-radius:16px;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;font-size:13.5px}',
      '.axa .sp-faixa.x-wn{background:rgba(var(--wn-rgb),.07);border:1px solid rgba(var(--wn-rgb),.32)}',
      '.axa .sp-faixa.x-ac{background:rgba(var(--ac-rgb),.06);border:1px solid rgba(var(--ac-rgb),.3)}',
      '.axa .sp-faixa .lb{font-size:12px;font-weight:800;letter-spacing:.14em}',
      '.axa .sp-faixa .dir{margin-left:auto;display:flex;gap:10px;align-items:center}',
      '.axa .sp-trl{display:flex;flex-wrap:wrap;gap:6px}',
      '.axa .sp-trl .btns .n{margin-left:6px;font-size:11px;color:var(--tx4);font-weight:800}',
      '.axa .sp-k5{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}',
      '.axa .sp-k{padding:16px;border-radius:14px;background:rgba(var(--sf-rgb),.75);border:1px solid var(--bd);display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.axa .sp-k.x-wn{border-color:rgba(var(--wn-rgb),.32)}',
      '.axa .sp-k.x-ok{border-color:rgba(var(--ok-rgb),.32)}',
      '.axa .sp-k.x-in{border-color:rgba(var(--in-rgb),.32)}',
      '.axa .sp-k .l{font-size:12px;color:var(--tx3)}',
      '.axa .sp-k .v{font-family:var(--font-title);font-weight:800;font-size:24px;line-height:30px}',
      '.axa .sp-k .v small{font-size:13px;color:var(--tx3);font-weight:800;margin-left:2px}',
      '.axa .sp-k .s{font-size:11.5px;line-height:16px;color:var(--tx3)}',
      '.axa .sp-2{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:20px;align-items:start}',
      '.axa .sp-2e{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;align-items:start}',
      '.axa .sp-pn{padding:20px;border-radius:16px;background:rgba(var(--sf-rgb),.72);border:1px solid var(--bd);display:flex;flex-direction:column;gap:10px;min-width:0}',
      '.axa .sp-pn .h2{font-size:17px}',
      '.axa .sp-pn .hh{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center}',
      '.axa .sp-pp{display:grid;grid-template-columns:140px minmax(0,1fr) 64px 84px;gap:12px;align-items:center;font-size:13px}',
      '.axa .sp-pp-hd{font-size:11px;color:var(--tx4);font-weight:700;letter-spacing:.04em;text-transform:uppercase}',
      '.axa .sp-pp .pt{font-family:var(--font-mono);font-size:12px;color:var(--tx3);text-align:right}',
      '.axa .sp-pp .tr{height:8px;border-radius:4px;background:var(--sf5);overflow:hidden}',
      '.axa .sp-pp .tr i{display:block;height:8px;border-radius:4px;background:var(--ac)}',
      '.axa .sp-pp .tr i.ok{background:var(--ok)}',
      '.axa .sp-pp .nm.eu{color:var(--ac-t);font-weight:800}',
      '.axa .sp-pp .lv{font-family:var(--font-mono);font-size:12px;color:var(--tx3);text-align:right}',
      '.axa .sp-esc{display:grid;grid-template-columns:78px minmax(0,1fr) 120px 150px 150px 44px;gap:12px;align-items:center;padding:10px 14px;border-radius:11px;background:var(--sf2);border:1px solid transparent;font-size:13px;text-decoration:none;color:var(--tx)}',
      '.axa a.sp-esc:hover{border-color:var(--bd4);color:var(--tx)}',
      '.axa .sp-esc.eu{border-color:rgba(var(--ac-rgb),.42)}',
      '.axa .sp-esc .cd{font-family:var(--font-mono);font-size:12px;color:var(--tx3)}',
      '.axa .sp-esc .ti{display:flex;flex-direction:column;gap:3px;min-width:0}',
      '.axa .sp-esc .ti b{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.axa .sp-esc .ti span{font-size:11.5px;color:var(--tx3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.axa .sp-esc .x{display:contents}',
      '.axa .sp-esc .wy{font-size:12px;color:var(--tx3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.axa .sp-esc .pt{font-family:var(--font-mono);font-size:12px;text-align:right}',
      '.axa .sp-rs{display:inline-flex;gap:4px;flex-wrap:wrap}',
      '.axa .sp-rs .chip{height:18px;font-size:10px;padding:0 6px}',
      '.axa .sp-fl{display:flex;flex-wrap:wrap;gap:6px}',
      '.axa .sp-li{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:var(--sf2);border:1px solid var(--bd);font-size:13px;text-decoration:none;color:var(--tx);min-width:0}',
      '.axa a.sp-li:hover{border-color:var(--bd4);color:var(--tx)}',
      '.axa .sp-li .t{flex:1;min-width:0;line-height:17px}',
      '.axa .sp-li .t small{display:block;font-size:11.5px;color:var(--tx3);margin-top:2px}',
      '.axa .sp-li .p{font-family:var(--font-mono);font-size:12px;color:var(--ac-t);white-space:nowrap}',
      '.axa .sp-pl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 300px;gap:16px;align-items:start}',
      '.axa .sp-cap{display:flex;flex-direction:column;gap:4px}',
      '.axa .sp-cap .r{display:flex;justify-content:space-between;gap:8px;font-size:12.5px}',
      '.axa .sp-cap .r.sub{font-size:12px;color:var(--tx3);padding-left:12px}',
      '.axa .sp-bar{height:5px;border-radius:3px;background:var(--track);overflow:hidden}',
      '.axa .sp-bar i{display:block;height:100%;border-radius:3px}',
      '.axa .sp-pj{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:16px;align-items:start}',
      '.axa .sp-gt{overflow-x:auto;border-radius:16px;background:rgba(var(--sf-rgb),.72);border:1px solid var(--bd)}',
      '.axa .sp-gt .in2{min-width:900px}',
      '.axa .sp-gt .gr{display:grid}',
      '.axa .sp-gt .hs{padding:10px 12px;display:flex;flex-direction:column;gap:2px;border-left:1px solid var(--sf5);min-width:0}',
      '.axa .sp-gt .hs b{font-size:12px;font-weight:800}',
      '.axa .sp-gt .hs span{font-size:11.5px;color:var(--tx3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.axa .sp-gt .dd{padding:8px 0;text-align:center;border-left:1px solid var(--sf4);font-size:11px;color:var(--tx3)}',
      '.axa .sp-gt .dd.hj{background:rgba(var(--ac-rgb),.12);color:var(--ac-t);font-weight:800}',
      '.axa .sp-gt .dv{grid-auto-rows:34px;row-gap:6px;padding:10px 0;border-bottom:1px solid var(--sf4);position:relative}',
      '.axa .sp-gt .lb{grid-column:1;padding:0 14px;display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.axa .sp-gt .lb b{font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.axa .sp-gt .lb .m{font-size:11.5px;font-family:var(--font-mono)}',
      '.axa .sp-gt .lb .n{font-size:11px;color:var(--tx3)}',
      '.axa .sp-gt .au{border-left:1px solid var(--sf4);background:repeating-linear-gradient(135deg,rgba(var(--tl-rgb),.10) 0 6px,transparent 6px 12px)}',
      '.axa .sp-gt .cl{border-left:1px solid var(--sf4)}',
      '.axa .sp-gt .br{margin:0 3px;padding:0 10px;border-radius:9px;display:flex;align-items:center;gap:8px;min-width:0;text-decoration:none;font-size:12px;font-weight:700;color:var(--tx);border:1px solid var(--bd2);background:var(--sf2);z-index:1}',
      '.axa .sp-gt .br:hover{color:var(--tx);filter:brightness(1.1)}',
      '.axa .sp-gt .br .c{font-family:var(--font-mono);font-size:10.5px;color:var(--tx3);flex-shrink:0}',
      '.axa .sp-gt .br .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.axa .sp-cal{display:grid;grid-template-columns:150px repeat(5,minmax(0,1fr));font-size:12px}',
      '.axa .sp-cal .ch{padding:10px 8px;border-bottom:1px solid var(--bd);font-size:11px;font-weight:800;letter-spacing:.12em;color:var(--tx4);text-align:center}',
      '.axa .sp-cal .sw{padding:10px 12px;border-bottom:1px solid var(--bd3);display:flex;flex-direction:column;gap:3px}',
      '.axa .sp-cal .sw b{font-size:13px}',
      '.axa .sp-cal .sw span{font-size:11px;color:var(--tx3);line-height:15px}',
      '.axa .sp-cal .dc{min-height:86px;padding:8px;border-bottom:1px solid var(--bd3);border-left:1px solid var(--bd3);display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.axa .sp-cal .dc .d{font-family:var(--font-mono);font-size:12px;color:var(--tx2)}',
      '.axa .sp-cal .dc.fo{background:rgba(var(--sf-rgb),.35)}',
      '.axa .sp-cal .dc.fo .d{color:var(--tx5)}',
      '.axa .sp-cal .dc.fe{background:rgba(var(--tl-rgb),.07)}',
      '.axa .sp-cal .dc.hj .d{color:var(--ac-t);font-weight:800}',
      '.axa .sp-cal .ev{border-radius:6px;padding:3px 6px;font-size:10.5px;line-height:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.axa .sp-k3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:start}',
      '.axa .sp-tb{width:100%;border-collapse:collapse;font-size:12.5px}',
      '.axa .sp-tb th{text-align:left;font-size:10.5px;font-weight:800;letter-spacing:.1em;color:var(--tx4);padding:0 6px 8px;border-bottom:1px solid var(--bd)}',
      '.axa .sp-tb td{padding:8px 6px;border-bottom:1px solid var(--bd3);color:var(--tx2)}',
      '.axa .sp-tb td.n,.axa .sp-tb th.n{text-align:right;font-variant-numeric:tabular-nums}',
      '.axa .sp-mais{align-self:center}',
      // Entregas por sprint: os cartoes do resumo filtram a lista (como no admin).
      '.axa .sp-k4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}',
      '.axa .es-k{cursor:pointer;text-align:left;font:inherit;color:var(--tx)}',
      '.axa .es-k:hover{border-color:var(--bd4)}',
      '.axa .es-k.on{border-color:rgba(var(--ac-rgb),.6);box-shadow:inset 0 0 0 1px rgba(var(--ac-rgb),.6)}',
      '.axa .es-k .sp-bar{margin-top:6px}',
      '.axa .es-pes{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
      '.axa .es-pes .lab{margin-right:4px}',
      '.axa .es-pes .chip{height:24px;font-size:11.5px;gap:5px}',
      // O nome em "Faltando por pessoa" e botao (8f236cf); a faixa da pessoa escolhida vem embaixo.
      '.axa .es-pes .es-pn{border:0;font-family:inherit;cursor:pointer}',
      '.axa .es-pes .es-pn:hover{box-shadow:inset 0 0 0 1px var(--bd4)}',
      '.axa .es-pes .es-pn.on{box-shadow:inset 0 0 0 1px rgba(var(--ac-rgb),.7);color:var(--tx)}',
      '.axa .es-pr{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;padding:10px 14px;border-radius:12px;background:var(--sf2);' +
        'border:1px solid rgba(var(--ac-rgb),.45);font-size:13px;color:var(--tx2)}',
      '.axa .es-pr b{font-size:15px;color:inherit}',
      '.axa .es-pr > span:first-child b{color:var(--tx)}',
      '.axa .es-gh{display:flex;align-items:baseline;gap:8px;padding:8px 2px 6px;border-bottom:1px solid var(--bd);margin-top:6px}',
      '.axa .es-gh .n{font-family:var(--font-mono);font-size:11.5px;color:var(--tx4)}',
      '.axa .es-ln{display:grid;grid-template-columns:78px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 14px;border-radius:11px;background:var(--sf2);border:1px solid transparent;font-size:13px;text-decoration:none;color:var(--tx)}',
      '.axa a.es-ln:hover{border-color:var(--bd4);color:var(--tx)}',
      '.axa .es-ln .cd{font-family:var(--font-mono);font-size:12px;color:var(--tx3)}',
      '.axa .es-ln .ti{display:flex;flex-direction:column;gap:3px;min-width:0}',
      '.axa .es-ln .ti b{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.axa .es-ln .ti > span{font-size:12px;color:var(--tx3);line-height:17px}',
      '.axa .es-ln .ti > span b{font-weight:700;color:var(--tx2)}',
      '.axa .es-ln .x{display:flex;flex-wrap:wrap;gap:5px;justify-content:flex-end;align-items:center;max-width:340px}',
      '.axa .es-ln .x .chip{height:20px;font-size:10.5px;gap:4px;max-width:220px;overflow:hidden;text-overflow:ellipsis}',
      // Backlog da sprint por dev, com o seletor que direciona (`renderGerSprint` do admin).
      '.axa .sp-bk-g{display:flex;flex-direction:column;gap:6px}',
      '.axa .sp-bk-dev{display:flex;align-items:center;gap:6px;padding:8px 2px 2px;font-size:12.5px;font-weight:800;color:var(--tx2)}',
      '.axa .sp-bk-dev.sem{color:var(--wn-t)}',
      '.axa .sp-bk-dev .n{font-family:var(--font-mono);font-weight:600;color:var(--tx4)}',
      '.axa .sp-bk-it{display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:12px;align-items:center;padding:8px 10px 8px 14px;border-radius:11px;background:var(--sf2);border:1px solid transparent}',
      '.axa .sp-bk-it.so{grid-template-columns:minmax(0,1fr)}',
      '.axa .sp-bk-it:hover{border-color:var(--bd4)}',
      '.axa .sp-bk-ln{display:grid;grid-template-columns:78px minmax(0,1fr);gap:12px;align-items:center;min-width:0;font-size:13px;text-decoration:none;color:var(--tx)}',
      '.axa .sp-bk-ln:hover{color:var(--tx)}',
      '.axa .sp-bk-ln .cd{font-family:var(--font-mono);font-size:12px;color:var(--tx3)}',
      '.axa .sp-bk-ln .ti{display:flex;flex-direction:column;gap:3px;min-width:0}',
      '.axa .sp-bk-ln .ti b{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.axa .sp-bk-ln .ti span{font-size:12px;color:var(--tx3)}',
      '.axa .sp-bk-ln .pr{font-style:normal;font-weight:700;color:var(--ac-t)}',
      '.axa .sp-bk-sel{width:100%;min-width:0;height:38px;font-size:13px}',
      '.axa .sp-ss-t{flex:1 1 320px;min-width:0;line-height:20px}',
      '.axa .sp-ss-t a{white-space:nowrap}',
      // Fechamento: cada pendente com o destino e o motivo embaixo.
      '.axa .sp-fd{display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:12px;background:var(--sf2);border:1px solid var(--bd)}',
      '.axa .sp-fd .sp-fd-cab{padding:0;background:transparent;border:0}',
      '.axa .sp-fd-ed{display:grid;grid-template-columns:minmax(0,200px) minmax(0,1fr);gap:8px}',
      '.axa .sp-fd-ed .in{height:36px;font-size:12.5px;width:100%;min-width:0;background:var(--sf)}',
      '.axa .btnp.perigo{background:var(--dg);box-shadow:0 8px 22px rgba(var(--dg-rgb),.25);color:#fff}',
      '.axa .btnp:disabled{opacity:.55;cursor:not-allowed;box-shadow:none}',
      // Repassar em lote (o dialogo do `sprintLoteAbrir`).
      '.axa .sp-lt{max-width:720px;width:100%}',
      '.axa .sp-lt-t{margin:0;font-family:var(--font-title);font-size:19px;font-weight:800;padding-right:40px}',
      '.axa .sp-lt-topo{display:grid;grid-template-columns:minmax(0,240px) minmax(0,1fr);gap:10px}',
      '.axa .sp-lt-topo .in{height:40px}',
      '.axa .sp-lt-g{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
      '.axa .sp-lt-g .lab{margin-right:4px}',
      '.axa .sp-lt-g .btns .n{margin-left:4px;font-family:var(--font-mono);font-size:11px;color:var(--tx4)}',
      '.axa .sp-lt-ck{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--tx2);cursor:pointer}',
      '.axa .sp-lt-ck input{accent-color:var(--ac)}',
      '.axa .sp-lt-l{display:flex;flex-direction:column;gap:4px;max-height:44vh;overflow-y:auto;padding:2px}',
      '.axa .sp-lt-it{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:var(--sf2);border:1px solid transparent;font-size:13px;cursor:pointer;min-width:0}',
      '.axa .sp-lt-it:hover{border-color:var(--bd4)}',
      '.axa .sp-lt-it.on{border-color:rgba(var(--ac-rgb),.55);background:rgba(var(--ac-rgb),.08)}',
      '.axa .sp-lt-it input{accent-color:var(--ac);margin:0;flex-shrink:0}',
      '.axa .sp-lt-it .t{flex:1;min-width:0;line-height:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.axa .sp-lt-it .t small{margin-left:8px;font-size:11.5px;color:var(--tx3)}',
      '.axa .sp-lt-it .gi{color:var(--tx3);font-size:13px}',
      '.axa .sp-lt-it .chip{height:20px;font-size:10.5px;flex-shrink:0}',
      '.axa .sp-lt-pe{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}',
      // O dialogo mora no <body>, fora do container `app`: a regra do celular e por media.
      '@media (max-width: 760px){.axa .sp-lt-topo{grid-template-columns:minmax(0,1fr)}}',
      '@container app (max-width: 760px){',
      // No celular a linha do backlog vira cartao: o titulo em cima, o seletor embaixo, com toque de 44 px.
      '.axa .sp-bk-it{grid-template-columns:minmax(0,1fr);gap:8px;padding:10px 12px}',
      '.axa .sp-bk-ln{grid-template-columns:62px minmax(0,1fr);min-height:44px}',
      '.axa .sp-bk-sel{height:44px}',
      '.axa #sp-sem-sprint .btns{min-height:44px;width:100%}',
      '.axa #sp-sem-sprint .dir{width:100%}',
      '.axa .sp-fd-ed{grid-template-columns:minmax(0,1fr)}',
      '.axa .sp-k4{grid-template-columns:repeat(2,minmax(0,1fr))}',
      '.axa .es-ln{grid-template-columns:62px minmax(0,1fr)}',
      '.axa .es-ln .x{grid-column:2;justify-content:flex-start;max-width:none}',
      '.axa .sp-k5{grid-template-columns:repeat(2,minmax(0,1fr))}',
      '.axa .sp-2,.axa .sp-2e,.axa .sp-pl,.axa .sp-pj,.axa .sp-k3{grid-template-columns:minmax(0,1fr)}',
      '.axa .sp-pp{grid-template-columns:110px minmax(0,1fr) 52px 72px}',
      '.axa .sp-esc{grid-template-columns:62px minmax(0,1fr) 34px;row-gap:6px}',
      '.axa .sp-esc .x{display:flex;flex-wrap:wrap;gap:6px;align-items:center;grid-column:2/4;grid-row:2}',
      '.axa .sp-hd .ac{width:100%}',
      '.axa .sp-hd .ac .sp-sel{flex:1;min-width:0}',
      '.axa .sp-faixa .dir{margin-left:0}',
      '.axa .sp-cal{grid-template-columns:repeat(5,minmax(0,1fr))}',
      '.axa .sp-cal .sw{grid-column:1/-1;flex-direction:row;flex-wrap:wrap;gap:4px 10px;background:rgba(var(--sf-rgb),.5)}',
      '.axa .sp-cal .ch.sw0{display:none}',
      '.axa .sp-cal .dc{min-height:64px;padding:5px}',
      '.axa .sp-cal .ev{font-size:9.5px;padding:2px 4px}',
      // Letra de 12 px no minimo no que a tela desenha menor.
      '.axa .sp-esc .ti span,.axa .sp-esc .ti em,.axa .sp-trl .btns .n,.axa .sp-k .s,.axa .sp-est,.axa .es-gh .n,.axa .sp-li .t small{font-size:12px}',
      /* Entregas: esteiras e pessoas viram uma faixa que rola de lado (quinze
         nomes empilhados empurravam a lista para baixo), com botoes de 44 px. */
      '.axa .es-pes{flex-wrap:nowrap;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;margin:0 -14px;padding:0 14px;gap:8px}',
      '.axa .es-pes::-webkit-scrollbar{display:none}',
      '.axa .es-pes .lab{flex-shrink:0}',
      '.axa .es-pes .es-pn{flex-shrink:0;height:44px;padding:0 14px;border-radius:12px;font-size:12.5px;white-space:nowrap}',
      '.axa .es-ln .x{min-width:0}.axa .es-ln .x .chip{max-width:100%;flex-shrink:1;height:auto;min-height:22px;padding-top:2px;padding-bottom:2px;white-space:normal;line-height:16px}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── Leituras comuns ───────────────────────────────────────────────────
  var SP = function () { return raiz.SPRINTPO; };
  function fer(D) { return (D && D.feriados) || []; }
  function iso(v) { var s = String(v == null ? '' : v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
  function curto(r) { return SP().rotuloCurto(r); }
  /** `S2-11-2026` -> `2026112`, que ordena como texto (a mesma chave do admin). */
  function chave(r) { return String(r).slice(6, 10) + String(r).slice(3, 5) + String(r).slice(1, 2); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }

  /** "26 a 30 de outubro", ou "28/09 a 02/10" quando atravessa o mes. */
  function txtFaixa(f) {
    if (!f) return '';
    var a = H.data(f.de), b = H.data(f.ate);
    if (!a || !b) return '';
    if (a.getMonth() === b.getMonth()) return pad(a.getDate()) + ' a ' + pad(b.getDate()) + ' de ' + H.MESES[b.getMonth()];
    return H.dm(f.de) + ' a ' + H.dm(f.ate);
  }

  /** Quem conta na capacidade: o time cadastrado, sem quem saiu.
   *  COPIA de `capDevsAtivos` (gantt.html): a lista de pessoas da capacidade so
   *  existe la. Candidata a modulo. */
  function devsAtivos(D) {
    var fora = {};
    ((D.devs_removidos || []).concat(D.devs_inativos || [])).forEach(function (n) { fora[String(n).trim().toLowerCase()] = true; });
    return (D.desenvolvedores || []).filter(function (n) { return !fora[String(n).trim().toLowerCase()]; });
  }

  /** As opcoes de capacidade que o gantt passa ao `capacidadePorTrilha`
   *  (renderCapSprint): frente de cada pessoa pelo cadastro, Dados/BI e Sales
   *  Ops como grupos proprios, etapa pela leitura efetiva. */
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

  /** As sprints que EXISTEM nos dados, mais a atual e as cinco seguintes.
   *  COPIA de `sprintsComDados` (admin.html, aba Gerencial): oferecer as do
   *  calendario inteiro daria dezenas de opcoes vazias. Candidata a modulo. */
  function sprintsComDados(D) {
    var vistas = {};
    H.visiveis().forEach(function (m) {
      SP().entradas(m).forEach(function (e) { if (e.sprint) vistas[e.sprint] = true; });
      var s = SP().doPO(m);
      if (s) vistas[s] = true;
    });
    var agora = H.sprintAtual();
    if (agora) vistas[agora] = true;
    SP().proximasSprints(H.hoje(), 5, fer(D)).forEach(function (s) { vistas[s.rotulo] = true; });
    return Object.keys(vistas).filter(function (r) { return SP().rotuloValido(r); })
      .sort(function (a, b) { return chave(b).localeCompare(chave(a)); });
  }

  /** O ESTADO DA SPRINT no chip do titulo. "Ativa" e o `em_curso` do modulo;
   *  quando ela ja terminou e ninguem fechou, o chip diz isso tambem. */
  function chipsSituacao(D, r) {
    var sit = SP().situacaoDaSprint(D, r);
    var h = sit === 'fechada' ? '<span class="sp-est x-ok">FECHADA</span>'
          : sit === 'em_curso' ? '<span class="sp-est x-ac">ATIVA</span>'
          : '<span class="sp-est x-in">MONTANDO</span>';
    if (sit !== 'fechada' && SP().sprintVencida(r, H.hoje(), fer(D)) && SP().demandasDaSprint(D, r).length) {
      h += ' <span class="sp-est x-wn">' + (sit === 'em_curso' ? 'TERMINOU · POR FECHAR' : 'TERMINOU SEM INICIAR') + '</span>';
    }
    return h;
  }

  function situacaoTxt(D, r) {
    var reg = SP().registroDe(D, r) || {};
    var sit = SP().situacaoDaSprint(D, r);
    if (sit === 'fechada') return 'fechada em ' + H.dm(reg.em) + (reg.por ? ' por ' + reg.por : '');
    if (sit === 'em_curso') return 'iniciada em ' + H.dm(reg.iniciada_em) + (reg.iniciada_por ? ' por ' + reg.iniciada_por : '');
    return 'montando: o time ainda não vê o que não tem dev';
  }

  // ── A TRILHA ──────────────────────────────────────────────────────────
  /* Cada time com a sua conta (cabecalho de TRILHAS no sprint.js). O admin e o
     painel do dev abrem em Tecnologia; aqui tambem, exceto para quem e de
     Dados/BI ou Sales Ops pelo cadastro — esse abre na conta do proprio time. */
  var _trilha = null;
  function trilhaInicial(D) {
    var P = raiz.PIPELINES, nomes = H.meusNomes();
    if (AX.APP.papel === 'dev' && P && nomes.length) {
      var f = P.doDev(nomes[0], D.devs_perfil);
      if (f && f === P.FRENTE_DADOS) return 'dados_bi';
      if (f === 'Sales Ops') return 'sales_ops';
    }
    return 'tecnologia';
  }
  function trilha(D) { if (_trilha == null) _trilha = trilhaInicial(D); return _trilha; }
  function nomeTrilha(k) {
    if (!k) return 'todos os times';
    if (k === 'tecnologia') return 'Desenvolvimento';   // o nome que `capacidadePorTrilha` da ao grupo
    var t = SP().TRILHAS.filter(function (x) { return x.k === k; })[0];
    return t ? t.nome : k;
  }
  function htmlTrilhas(D, r) {
    var atual = trilha(D);
    var ops = [{ k: '', nome: 'Todos' }].concat(SP().TRILHAS.map(function (t) { return { k: t.k, nome: nomeTrilha(t.k) }; }));
    return '<div class="sp-trl" role="group" aria-label="Trilha">' + ops.map(function (t) {
      var n = SP().demandasDaSprint(D, r, t.k).length;
      return '<button type="button" class="btns' + (t.k === atual ? ' on' : '') + '" data-sp-trilha="' + t.k + '"' +
        (t.k === atual ? ' aria-pressed="true"' : ' aria-pressed="false"') + '>' + esc(t.nome) + '<span class="n">' + n + '</span></button>';
    }).join('') + '</div>';
  }

  // ── COMO A DEMANDA ENTROU NA SPRINT ───────────────────────────────────
  /* Le o `sprint_po_historico` (registro do ato, ver cabecalho do sprint.js).
     Planejado: entrou antes ou no dia em que a sprint foi iniciada.
     Adicionado: entrou depois de iniciada. Repassada: veio de outra sprint
     (e o "entrou atrasada" do modulo, olhado NESTA sprint: numa sprint antiga
     o `entrouAtrasada(m)` responderia pelo pulo seguinte, nao por este).
     O dia e a unica precisao gravada (`em` e data), entao quem entrou no
     proprio dia do inicio conta como planejado. */
  function entradaNa(D, m, r) {
    var ent = SP().entradas(m);
    var idx = -1;
    for (var i = 0; i < ent.length; i++) if (String(ent[i].sprint) === r) { idx = i; break; }
    var e = idx >= 0 ? ent[idx] : null;
    var em = e ? iso(e.em) : (SP().doPO(m) === r ? iso(m.sprint_po_em) : '');
    var reg = SP().registroDe(D, r) || {};
    var ini = iso(reg.iniciada_em);
    var veio = idx > 0 ? String(ent[idx - 1].sprint || '') : '';
    var aqui = SP().doPO(m) === r;
    // Para onde foi, quando saiu: o passo seguinte do historico (inclusive a
    // volta ao backlog que o fechamento registra com `sprint: ''`).
    var hist = SP().historico(m), saiuPara = null, saiuEm = '';
    if (!aqui) {
      var k = -1;
      for (var j = 0; j < hist.length; j++) if (String(hist[j].sprint) === r) { k = j; break; }
      if (k >= 0 && hist[k + 1]) { saiuPara = String(hist[k + 1].sprint || ''); saiuEm = iso(hist[k + 1].em); }
      else { saiuPara = SP().doPO(m); saiuEm = iso(m.sprint_po_em); }
    }
    var tipo = SP().ehPrioritariaDaSprint(m, r) ? 'prioritaria'
             : veio ? 'repassada'
             : (ini && em && em > ini) ? 'adicionado' : 'planejado';
    return { em: em, por: e ? e.por : (m.sprint_po_por || ''), motivo: e ? e.motivo : '', veio: veio, tipo: tipo,
             aqui: aqui, saiuPara: saiuPara, saiuEm: saiuEm, ini: ini };
  }

  var ENTRADA = {
    planejado:   { rot: 'Planejado',   cor: 'bk' },
    adicionado:  { rot: 'Adicionado',  cor: 'wn' },
    repassada:   { rot: 'Repassada',   cor: 'dg' },
    prioritaria: { rot: 'Prioritária', cor: 'ac' }
  };

  function porQueEntrou(x) {
    if (x.tipo === 'repassada') return 'de ' + curto(x.veio) + (x.em ? ' · ' + H.dm(x.em) : '');
    if (x.tipo === 'prioritaria') return 'vencida no início' + (x.em ? ' · ' + H.dm(x.em) : '');
    if (x.tipo === 'adicionado') return (x.em ? H.dm(x.em) : '') + (x.por ? ' · ' + String(x.por).split(' ')[0] : '');
    return x.em ? 'Repasse ' + H.dm(x.em) : 'sem data de repasse';
  }

  // ── O BURNDOWN ────────────────────────────────────────────────────────
  /* RECONSTRUIDO PELO HISTORICO, dia util a dia util:
       escopo(d)   = pontos do que ja tinha entrado na sprint em d e ainda nao
                     tinha saido (`sprint_po_historico`);
       entregue(d) = pontos do que esta nela, continua entregue hoje e foi
                     entregue pelo dev ate d (CAPACIDADE.diaDaEntrega).
     A demanda devolvida da validacao conta como nao entregue em todos os
     dias: o historico de devolucao nao guarda o pontos-dia, e mostrar uma
     entrega que nao se sustentou seria pior. */
  function burndown(D, r, itens) {
    var f = SP().faixaDaSprint(r, fer(D));
    if (!f) return null;
    var dias = SP().diasUteisDoMes(+r.slice(6, 10), +r.slice(3, 5), fer(D)).filter(function (d) { return d >= f.de && d <= f.ate; });
    var hoje = H.hoje();
    var C = raiz.CAPACIDADE;
    var lin = itens.map(function (m) {
      var x = entradaNa(D, m, r);
      var etapa = H.colunaDe(m);
      var entregue = x.aqui && (etapa === 'concluido' || etapa === 'validacao' || etapa === 'validacao_area');
      return { pts: H.pontosDe(m), de: x.em || f.de, sai: x.aqui ? '' : (x.saiuEm || ''),
               ent: entregue ? (C ? C.diaDaEntrega(m) : iso(m.entregue_em || m.concluido_em)) : '' };
    });
    var pts = dias.filter(function (d) { return d <= hoje; }).map(function (d) {
      var esc0 = 0, feito = 0;
      lin.forEach(function (l) {
        /* Saida no ultimo dia ou depois e o carry-over do fechamento: e o que
           nao entregou, e continua no restante. So a saida NO MEIO da semana
           tira pontos do escopo. */
        var dentro = (l.de <= d || l.de < f.de) && !(l.sai && l.sai <= d && l.sai >= f.de && l.sai < f.ate);
        if (!dentro) return;
        esc0 += l.pts;
        if (l.ent && l.ent <= d) feito += l.pts;
      });
      return { d: d, escopo: esc0, resta: esc0 - feito };
    });
    return { dias: dias, pts: pts, faixa: f };
  }

  function svgBurndown(b) {
    var W = 560, Hh = 220, x0 = 46, x1 = 545, y0 = 20, y1 = 170;
    var max = 0;
    b.pts.forEach(function (p) { max = Math.max(max, p.escopo, p.resta); });
    // Passo redondo com no maximo quatro faixas: 0, 10, 20, 30 le melhor que 0, 17, 33, 50.
    var passo = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].filter(function (q) { return Math.ceil(max / q) <= 4; })[0] || 1000;
    var topo = Math.max(passo, Math.ceil(max / passo) * passo);
    var nLin = Math.round(topo / passo);
    var n = b.dias.length;
    var X = function (i) { return n <= 1 ? (x0 + x1) / 2 : x0 + 14 + (x1 - x0 - 14) * i / (n - 1); };
    var Y = function (v) { return y1 - (y1 - y0) * v / topo; };
    var grade = '', rot = '';
    for (var k = 0; k <= nLin; k++) {
      var v = passo * k, y = Y(v);
      grade += 'M' + x0 + ' ' + y + 'H' + 550;
      rot += '<text x="' + (x0 - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + v + '</text>';
    }
    var dsem = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    var eixo = b.dias.map(function (d, i) {
      return '<text x="' + X(i) + '" y="200" text-anchor="middle">' + dsem[H.data(d).getDay()] + ' ' + d.slice(8, 10) + '</text>';
    }).join('');
    var ini = b.pts.length ? b.pts[0].escopo : 0;
    var ideal = 'M' + X(0) + ' ' + Y(ini) + ' L' + X(n - 1) + ' ' + Y(0);
    var linha = b.pts.map(function (p, i) { return (i ? 'L' : 'M') + X(i) + ' ' + Y(p.resta); }).join(' ');
    var pontos = b.pts.map(function (p, i) {
      return '<circle cx="' + X(i) + '" cy="' + Y(p.resta) + '" r="' + (i === b.pts.length - 1 ? 5 : 4) + '"><title>' +
        H.dm(p.d) + ': ' + p.resta + ' de ' + p.escopo + ' pts restantes</title></circle>';
    }).join('');
    var desc = b.pts.map(function (p) { return p.resta + ' em ' + H.dm(p.d); }).join(', ');
    return '<svg viewBox="0 0 ' + W + ' ' + Hh + '" width="100%" height="220" role="img" aria-label="Pontos restantes por dia: ' + esc(desc) + '">' +
      '<path d="' + grade + '" style="stroke:var(--bd);stroke-width:1;fill:none"></path>' +
      '<g style="fill:var(--tx4);font-family:var(--font-mono);font-size:11px">' + rot + '</g>' +
      '<path d="' + ideal + '" style="stroke:var(--tx4);stroke-width:2;stroke-dasharray:6 6;fill:none"></path>' +
      '<path d="' + linha + '" style="stroke:var(--ac);stroke-width:3;fill:none;stroke-linejoin:round"></path>' +
      '<g style="fill:var(--ac-t)">' + pontos + '</g>' +
      '<g style="fill:var(--tx3);font-family:var(--font-ui);font-size:11px">' + eixo + '</g></svg>';
  }

  // ── ABA: SPRINT ATUAL ─────────────────────────────────────────────────
  var _esc = { filtro: 'todos', n: 25 };

  function sprintDaRota(D, ctx, lista) {
    var p = String(ctx.param || '').toUpperCase();
    if (p && SP().rotuloValido(p)) return p;
    var agora = H.sprintAtual();
    return lista.indexOf(agora) >= 0 ? agora : (lista[0] || agora);
  }

  function kpi(rot, valor, unid, nota, cls, corValor) {
    return '<div class="sp-k' + (cls ? ' x-' + cls : '') + '"><span class="l">' + rot + '</span>' +
      '<span class="v"' + (corValor ? ' style="color:' + corValor + '"' : '') + '>' + valor + (unid ? '<small>' + unid + '</small>' : '') + '</span>' +
      (nota ? '<span class="s">' + nota + '</span>' : '') + '</div>';
  }

  // ── O QUE FALTA DIRECIONAR (renderSprLinha + renderGerSprint, admin.html) ──
  /* SEM SPRINT DEPOIS DA PLANNING. A regra de 29/10 trava o MOVIMENTO, e nao
     o estado: as que ja estavam depois da Planning seguem sem sprint ate o PO
     escolher, e conta-las e o que faz isso acabar. So o que ainda nao foi
     entregue (planejado e em andamento; `atrasado` e etapa legada): com as
     de validacao o aviso nascia com mais de 150 nomes. COPIA do filtro do
     admin; a faixa nao depende da sprint nem da trilha escolhidas. */
  function semSprintDepoisDaPlanning(SPm, lista, gravada) {
    return (lista || []).filter(function (m) {
      return m && !m.oculto && !m.mesclado_em && !SPm.doPO(m) && ['planejado', 'em_andamento', 'atrasado'].indexOf(gravada(m)) >= 0;
    });
  }
  function faixaSemSprint(sem, r, dono) {
    if (!sem.length) return '';
    return '<div class="sp-faixa x-wn" id="sp-sem-sprint" role="status"><span class="lb" style="color:var(--wn-t)">SEM SPRINT</span>' +
      '<span class="sp-ss-t"><b>' + plural(sem.length, 'demanda está', 'demandas estão') + ' depois da Planning sem sprint</b> — ' +
      sem.slice(0, 6).map(function (m) { return '<a class="mono" href="' + H.hrefItem(m) + '">' + esc(m.codigo || m.id) + '</a>'; }).join(', ') +
      (sem.length > 6 ? '…' : '') + '. Escolha a sprint no item' + (dono ? ', ou repasse em lote' : '') + '.</span>' +
      (dono ? '<span class="dir"><button type="button" class="btns" data-sp-ciclo="lote" data-r="' + esc(r) + '">' + ico('send') + ' Repassar em lote</button></span>' : '') + '</div>';
  }

  /* QUEM PODE RECEBER (`devsDisponiveis` + `devsComTrabalhoAberto`): o time
     cadastrado e quem ja aparece nas demandas, sem quem saiu (`devs_removidos`)
     nem conta desativada — a menos que tenha voltado a ter trabalho aberto.
     COPIA do admin; `inativos` e a rota `devs-inativos` (null = ainda nao
     chegou, e entao ninguem sai por isso). */
  function devsParaDirecionar(D, inativos) {
    var parte = function (s) { return s ? String(s).split(/[\/,]/).map(function (x) { return x.trim(); }).filter(Boolean) : []; };
    var norm = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
    var todos = [];
    (D.desenvolvedores || []).forEach(function (d) { todos = todos.concat(parte(d)); });
    (D.melhorias || []).forEach(function (m) { todos = todos.concat(parte(m && m.dev)); });
    todos = todos.filter(function (x, i) { return todos.indexOf(x) === i; });
    var fora = Object.create(null), abertas = Object.create(null);
    (D.devs_removidos || []).concat(inativos || D.devs_inativos || []).forEach(function (n) { fora[norm(n)] = true; });
    (D.melhorias || []).forEach(function (m) {
      if (!m || m.oculto || m.mesclado_em) return;
      if (['concluido', 'negada'].indexOf(String(m.status_planejamento || '')) >= 0) return;
      parte(m.dev).forEach(function (d) { abertas[norm(d)] = true; });
    });
    return todos.filter(function (d) { var k = norm(d); return !fora[k] || abertas[k]; })
      .sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
  }

  /* O BACKLOG DA SPRINT: o que esta na sprint e ainda nao comecou, por dev,
     "Sem dev — para direcionar" primeiro (`SPRINTPO.backlogDaSprint`). Para
     quem pode, cada linha tem o seletor que grava o dev na hora; o dev atual
     nao aparece nele. `grupos` e o que o modulo devolve. */
  var ETQ_BK = { backlog: 'Backlog', levantar_req: 'Aprov. requisitos', planning: 'Planning', planejado: 'Planejado' };
  function htmlBacklogSprint(grupos, devs, pode) {
    var n = grupos.reduce(function (t, g) { return t + g.itens.length; }, 0);
    if (!n) return '';
    return '<section class="sp-pn" id="sp-backlog"><div class="hh"><h2 class="h2">Backlog da sprint <span class="note" style="font-family:var(--font-ui);font-weight:600">· ' + n + '</span></h2></div>' +
      '<span class="note">' + (n === 1 ? '1 demanda ainda não começou' : n + ' demandas ainda não começaram') +
      '. O que está antes de Planejado já aparece para o time, com a sprint marcada.</span>' +
      grupos.map(function (g) {
        return '<div class="sp-bk-g"><div class="sp-bk-dev' + (g.dev ? '' : ' sem') + '" data-sp-bk-dev="' + esc(g.dev) + '">' +
          (g.dev ? ico('user') + ' ' + esc(g.dev) : ico('alert') + ' Sem dev — para direcionar') + ' <span class="n">· ' + g.itens.length + '</span></div>' +
          g.itens.map(function (x) {
            var m = x.m, pts = SP().pontosDe(m);
            var sel = !pode ? '' : '<select class="in sp-bk-sel" data-sp-dir="' + esc(m.id) + '" aria-label="' + esc((g.dev ? 'Trocar o dev de ' : 'Direcionar ') + (m.codigo || 'a demanda')) + '">' +
              '<option value="">' + (g.dev ? 'Trocar dev…' : 'Direcionar para…') + '</option>' +
              devs.filter(function (d) { return d !== g.dev; }).map(function (d) { return '<option value="' + esc(d) + '">' + esc(d) + '</option>'; }).join('') + '</select>';
            return '<div class="sp-bk-it' + (pode ? '' : ' so') + '"><a class="sp-bk-ln" href="' + H.hrefItem(m) + '"><span class="cd">' + esc(m.codigo || '—') + '</span>' +
              '<span class="ti"><b>' + esc(m.titulo || '') + '</b><span>' + esc(ETQ_BK[x.etapa] || x.etapa) +
              (x.prioritaria ? ' · <em class="pr">' + ico('zap') + ' Prioritária</em>' : '') + (pts ? ' · ' + pts + ' pts' : '') + '</span></span></a>' + sel + '</div>';
          }).join('') + '</div>';
      }).join('') + '</section>';
  }

  /* DIRECIONAR (`sprDirecionar`): grava o dev escolhido, e so ele, na hora.
     Sem demanda ou sem nome nao ha o que gravar — as mesmas guardas do admin.
     Quem decide no fim e o servidor; a recusa volta o seletor. */
  function direcionarPatch(m, nome) {
    if (!m || !nome) return null;
    var p = {};
    p[m.id] = { dev: nome };
    return p;
  }
  async function direcionar(sel) {
    var id = sel.getAttribute('data-sp-dir'), nome = sel.value;
    var m = ((AX.APP.D || {}).melhorias || []).filter(function (x) { return x && x.id === id; })[0];
    var p = direcionarPatch(m, nome);
    if (!p) return;
    if (AX.APP.papel !== 'admin') { sel.value = ''; H.toast('Só o PM/PO direciona as demandas da sprint.', 'erro'); return; }
    sel.disabled = true;
    var out = await H.gravar(p, { ok: (m.codigo || 'Demanda') + ' direcionada para ' + nome + '.' });
    avisa(out);
    if ((!out || !out.ok) && sel.isConnected) { sel.disabled = false; sel.value = ''; }
  }
  /* As contas desativadas vem a parte (rota `devs-inativos`), como no admin:
     a consulta ao banco de contas nao entra no caminho que desenha a tela. */
  var _inativos = { lista: null, pedido: false };
  function inativosDevs() {
    if (!_inativos.pedido && AX.APP.papel === 'admin') {
      _inativos.pedido = true;
      H.api('devs-inativos').then(function (j) {
        _inativos.lista = Array.isArray(j && j.nomes) ? j.nomes : [];
        if (_inativos.lista.length && (AX.APP.rota || {}).tela === 'sprints') AX.desenhar(true);
      }).catch(function () { _inativos.pedido = false; });
    }
    return _inativos.lista;
  }

  function abaAtual(el, ctx) {
    var D = ctx.D;
    var lista = sprintsComDados(D);
    var r = sprintDaRota(D, ctx, lista);
    if (lista.indexOf(r) < 0) lista.unshift(r);
    var tr = trilha(D);
    var etapa = H.colunaDe;   // o admin e o painel do dev passam a etapa gravada (statusKey)
    var p = SP().placarDaSprint(D, r, etapa, tr);
    var rk = SP().rankingDaSprint(D, r, etapa, tr);
    var acomp = SP().acompanhamentoDaSprint(D, r, etapa, H.hoje(), raiz.PRAZO, tr);
    var f = SP().faixaDaSprint(r, fer(D));
    var sit = SP().situacaoDaSprint(D, r);
    /* "Ainda nao comecou" so conta depois que a sprint comecou (comentario de
       `riscosDaDemanda`); na montagem e o estado normal de tudo e viraria
       ruido na lista inteira. A funcao nao recebe a situacao, entao o recorte
       e aqui. */
    if (sit === 'montando') acomp.forEach(function (x) { x.riscos = x.riscos.filter(function (k) { return k.chave !== 'nao_comecou'; }); });
    var agora = H.sprintAtual();
    var admin = H.pode('editar');

    // Capacidade: o grupo da trilha, ou a soma dos tres em "Todos".
    var grupos = SP().capacidadePorTrilha(D, r, optsCapacidade(D));
    var gSel = tr ? grupos.filter(function (g) { return g.k === tr; }) : grupos;
    var cap = 0, pessoas = 0, aloc = 0;
    gSel.forEach(function (g) { cap += g.capacidade; pessoas += g.pessoas.length; aloc += g.alocado; });
    aloc = Math.round(aloc * 10) / 10;

    // Planejado x adicionado: a mesma lista do placar (o denominador dele),
    // separada pela data de entrada.
    var todos = [].concat(p.itens.validados, p.itens.aguardando, p.itens.emCurso, p.itens.saiu);
    var ad = { n: 0, pts: 0 }, pl = { n: 0, pts: 0 }, rep = 0;
    var entrada = {};
    todos.forEach(function (m) {
      var x = entradaNa(D, m, r);
      entrada[m.id] = x;
      if (x.tipo === 'adicionado') { ad.n++; ad.pts += H.pontosDe(m); }
      else { pl.n++; pl.pts += H.pontosDe(m); }
      if (x.tipo === 'repassada') rep++;
    });

    var opcoes = lista.map(function (s) {
      var rot = curto(s) + (s === agora ? ' (atual)' : SP().estaFechada(D, s) ? ' (fechada)' : chave(s) > chave(agora) ? ' (próxima)' : '');
      return '<option value="' + esc(s) + '"' + (s === r ? ' selected' : '') + '>' + esc(rot) + '</option>';
    }).join('');

    var botao = '';
    if (admin && sit === 'em_curso' && SP().sprintVencida(r, H.hoje(), fer(D))) {
      botao = '<a class="btnp" href="#sprints/encerrar">Encerrar sprint</a>';
    } else if (H.donoDaSprint() && sit === 'montando' && SP().demandasDaSprint(D, r).length) {
      // So o dono da sprint inicia (`sprintIniciar`, admin.html, 02/11/2026).
      botao = botaoIniciar(r);
    }

    var h = '<header class="sp-hd"><div class="tt"><div class="row" style="gap:10px">' +
      '<h1 class="h1">Sprint ' + esc(curto(r)) + '</h1>' + chipsSituacao(D, r) + '</div>' +
      '<span class="sub">' + esc(txtFaixa(f)) + ' · time ' + esc(nomeTrilha(tr)) + ' · ' + esc(situacaoTxt(D, r)) + '</span></div>' +
      '<div class="ac"><select class="sp-sel" id="sp-sel" aria-label="Sprint">' + opcoes + '</select>' + botao + '</div></header>';

    h += htmlTrilhas(D, r);

    // Faixa de aviso no lugar da META do prototipo (o RoadMap nao registra meta
    // de sprint): o que pede acao nesta sprint, quando ha.
    var emRisco = acomp.filter(function (x) { return x.riscos.length && x.situacao !== 'saiu'; });
    if (sit === 'em_curso' && SP().sprintVencida(r, H.hoje(), fer(D))) {
      var b = SP().balancoDaSprint(D, r, etapa);
      h += '<div class="sp-faixa x-wn"><span class="lb" style="color:var(--wn-t)">FECHAMENTO</span>' +
        '<span style="font-weight:700">A sprint terminou em ' + esc(H.dm(f && f.ate)) + ' e não foi fechada.</span>' +
        '<span class="dir"><span style="font-size:12.5px;color:var(--wn-t);font-weight:700">' +
        plural(b.pendentes.length, 'demanda sem destino', 'demandas sem destino') + ' · ' + b.aguardando.length + ' aguardando validação</span>' +
        (admin ? '<a class="btns" href="#sprints/encerrar">Ver o balanço</a>' : '') + '</span></div>';
    } else if (emRisco.length && sit !== 'fechada') {
      h += '<div class="sp-faixa x-ac"><span class="lb" style="color:var(--ac-t)">RISCO</span>' +
        '<span style="font-weight:700">' + plural(emRisco.length, 'demanda', 'demandas') + ' de ' + acomp.length + ' com sinal de risco de não entregar.</span>' +
        '<span class="dir"><button type="button" class="btns" data-sp-filtro="risco">Ver no escopo</button></span></div>';
    }
    // O que ficou sem sprint depois da Planning (`#spr-alerta-linha` do admin): para o PM/PO.
    if (AX.APP.papel === 'admin') h += faixaSemSprint(semSprintDepoisDaPlanning(SP(), (D || {}).melhorias, H.colunaDe), r, H.donoDaSprint());

    var pctPl = p.pctPontos != null ? p.pctPontos + '% dos pontos' : 'sem pontuação para medir';
    /* EM VALIDACAO CONTA COMO ENTREGA (renderGerSprint, admin.html, fdf14e2): no
       regime de entrega o placar traz `entregues` (fechadas + em validacao) e o
       cumprimento e sobre ele; o cartao da validacao diz que elas ja contam. */
    var novaRegra = p.entregues != null;
    var noKanbanVal = ((D || {}).melhorias || []).filter(function (m) {
      return m && !m.mesclado_em && !m.oculto && ['validacao_area', 'validacao'].indexOf(H.colunaDe(m)) >= 0;
    }).length;
    h += '<div class="sp-k5">' +
      kpi('Capacidade', H.num(cap), 'pts', cap
        ? plural(pessoas, 'pessoa', 'pessoas') + ' × 30 pts · alocado ' + H.num(aloc) + (cap ? ' (' + Math.round(aloc / cap * 100) + '%)' : '')
        : 'nenhuma pessoa cadastrada nesta trilha') +
      kpi('Planejado', H.num(pl.pts), 'pts', plural(pl.n, 'item', 'itens') + ' até o início' + (rep ? ' · ' + rep + ' repassad' + (rep === 1 ? 'o' : 'os') : '') +
        (p.replanejadas ? ' · ' + p.replanejadas + ' replanejad' + (p.replanejadas === 1 ? 'a' : 'as') + ' (fora da conta)' : '') +
        (p.saiu ? ' · ' + p.saiu + ' transbord' + (p.saiu === 1 ? 'ou' : 'aram') + ' sem entregar' : '')) +
      kpi('Adicionado depois', H.num(ad.pts), 'pts', ad.n ? plural(ad.n, 'item', 'itens') + ' depois de iniciada' : 'nada entrou depois do início', ad.n ? 'wn' : '', ad.n ? 'var(--wn-t)' : '') +
      (novaRegra
        /* 13/11/2026: "o calculo da sprint esta sobre os pontos. Deve ser em
           quantidade. 10 tasks equivalem a 100%, entregando 9 ficaria 90%."
           O numero grande e o % de TASKS entregues; os pontos viram detalhe. */
        /* A SOMA FECHA NO TEXTO (13/11/2026): "64 de 126 (29 fechadas + 30 em
           validacao)" nao fechava — pausada conta como entregue (08/11) e nao
           aparecia. */
        ? kpi('Entregue', H.num(p.pct), '%', p.entregues + ' de ' + p.total + ' tasks (' +
            plural(p.validados, 'fechada', 'fechadas') + ' + ' + p.aguardando + ' em validação' +
            (p.pausadas ? ' + ' + plural(p.pausadas, 'pausada', 'pausadas') : '') + ') · ' + H.num(p.pontosEntregues) + ' pts', 'ok', 'var(--ok-t)')
        : kpi('Entregue e validado', H.num(p.pct), '%', p.validados + ' de ' + p.total + ' tasks · ' + H.num(p.pontosValidados) + ' pts', 'ok', 'var(--ok-t)')) +
      // Regra de 05/11 (3ca7514): aguardando = foi para validacao (area ou PM/PO) nesta sprint e o PM/PO ainda nao aprovou.
      kpi(novaRegra ? 'Em validação' : p.regraEntrega ? 'Aguardando aprovação' : 'Aguardando validação', H.num(p.pontosAguardando), 'pts', p.aguardando
        ? (novaRegra ? plural(p.aguardando, 'item', 'itens') + ' desta sprint e deste time na área ou com o PM/PO · já contam como entrega' +
           (noKanbanVal > p.aguardando ? ' · o Kanban mostra ' + noKanbanVal + ' porque soma os outros times e sprints' : '')
           : plural(p.aguardando, 'item espera', 'itens esperam') + (p.regraEntrega ? ' a aprovação (área ou PM/PO); contam nesta sprint ao aprovar' : ' o PM/PO; contam aqui ao validar'))
        : 'nada esperando o PM/PO', p.aguardando ? 'in' : '', p.aguardando ? 'var(--in-t)' : '') +
      '</div>';

    // Burndown + Por pessoa
    var bd = sit !== 'montando' && p.pontosTotal ? burndown(D, r, todos) : null;
    var blocoBd;
    if (bd && bd.pts.length) {
      var ult = bd.pts[bd.pts.length - 1];
      blocoBd = '<section class="sp-pn" style="gap:12px"><div class="hh"><h2 class="h2">Burndown <span style="font-family:var(--font-ui);font-size:13px;font-weight:600;color:var(--ac-t)">· ' +
        ult.resta + ' pts restantes</span></h2>' +
        '<span style="display:flex;gap:14px;font-size:12px;color:var(--tx3)"><span class="row" style="gap:6px"><span style="width:14px;height:3px;background:var(--ac)"></span>restante</span>' +
        '<span class="row" style="gap:6px"><span style="width:14px;border-top:2px dashed var(--tx4)"></span>ideal</span></span></div>' +
        svgBurndown(bd) +
        '<span class="note" style="font-size:11.5px">Reconstruído pelo histórico: entrada na sprint pelo repasse, saída pelo dia em que o dev entregou. ' +
        'Devolvida da validação conta como não entregue.' + (p.semPontuacao ? ' ' + plural(p.semPontuacao, 'item sem pontos não pesa', 'itens sem pontos não pesam') + '.' : '') + '</span></section>';
    } else {
      blocoBd = '<section class="sp-pn"><h2 class="h2">Burndown</h2>' +
        H.vazio('chart', sit === 'montando' ? 'A sprint ainda não começou' : 'Sem pontos para queimar',
          sit === 'montando' ? 'O gráfico começa no primeiro dia útil depois de iniciada.' : 'Nenhuma demanda desta sprint tem pontuação do Planning Poker.') + '</section>';
    }
    var meus = H.meusNomes();
    var temDupla = rk.some(function (d) { return d.dupla; });
    var blocoPp = '<section class="sp-pn"><div class="hh"><h2 class="h2">Por pessoa</h2><span class="note" style="font-size:11.5px">entregues / na sprint</span></div>' +
      /* 13/11/2026: "crie uma coluna e add os pontos no modelo (20/30)". Tasks e
         pontos com a mesma regra (fechadas + em validacao). Quem ficou sem nada
         na sprint (tudo replanejado) nao aparece como 0 / 0. */
      (rk.length ? '<div class="sp-pp sp-pp-hd"><span></span><span></span><span style="text-align:right">tasks</span><span style="text-align:right">pontos</span></div>' : '') +
      (rk.length ? rk.filter(function (d) { return d.total > 0; }).map(function (d) {
        // 13/11/2026: por QUANTIDADE de tasks, como o placar (entregues = fechadas + em validacao).
        var feitas = d.entregues != null ? d.entregues : d.validados;
        var pct = d.total ? Math.min(100, Math.round(feitas / d.total * 100)) : 0;
        var eu = meus.indexOf(d.nome) >= 0;
        // Na regra nova o ranking ordena por fechadas + em validacao (rankingDaSprint, c11b681).
        return '<div class="sp-pp" title="' + esc(d.nome + ': ' + (d.entregues != null ? d.entregues + ' de ' + d.total + ' entregues (fechados + em validação), ' : '') +
          d.validados + ' de ' + d.total + ' itens validados' +
          (d.aguardando ? ', ' + d.aguardando + ' aguardando' : '') + (d.emCurso ? ', ' + d.emCurso + ' em curso' : '') + (d.saiu ? ', ' + d.saiu + ' replanejadas' : '')) + '">' +
          '<span class="nm ell' + (eu ? ' eu' : '') + '">' + esc(d.nome) + '</span>' +
          '<span class="tr"><i class="' + (pct >= 100 ? 'ok' : '') + '" style="width:' + pct + '%"></i></span>' +
          '<span class="lv">' + feitas + ' / ' + d.total + '</span>' +
          '<span class="pt">' + (d.pontosTotal ? (d.pontosEntregues != null ? d.pontosEntregues : d.pontos) + ' / ' + d.pontosTotal : '—') + '</span></div>';
      }).join('') + (temDupla ? '<span class="note" style="font-size:11.5px">Demanda de dupla conta para os dois.</span>' : '')
      : H.vazio('users', 'Ninguém nesta sprint ainda', 'O PM/PO repassa as demandas pela aba Planning ou pelo campo Sprint do card.')) + '</section>';
    h += '<div class="sp-2">' + blocoBd + blocoPp + '</div>';

    // Backlog da sprint, por dev, com o direcionar (o etapa e a gravada, como no admin).
    var admDir = AX.APP.papel === 'admin';
    h += htmlBacklogSprint(SP().backlogDaSprint(D, r, etapa, tr), admDir ? devsParaDirecionar(D, inativosDevs()) : [], admDir);

    // Escopo
    h += '<section class="sp-pn" id="sp-escopo"></section>';
    el.innerHTML = h;
    el._sp = { D: D, r: r, acomp: acomp, entrada: entrada, regra: !!p.regraEntrega };
    desenharEscopo(el);
  }

  function desenharEscopo(el) {
    var st = el._sp, box = el.querySelector('#sp-escopo');
    if (!st || !box) return;
    var dev = AX.APP.papel === 'dev';
    var F = {
      todos:       function () { return true; },
      risco:       function (x) { return x.riscos.length && x.situacao !== 'saiu'; },
      adicionados: function (x) { var e = st.entrada[x.m.id]; return e && e.tipo === 'adicionado'; },
      repassados:  function (x) { var e = st.entrada[x.m.id]; return e && (e.tipo === 'repassada' || e.tipo === 'prioritaria'); },
      saiu:        function (x) { return x.situacao === 'saiu'; },
      meus:        function (x) { return H.minha(x.m); }
    };
    var ROT = { todos: 'Todos', risco: 'Em risco', adicionados: 'Adicionados', repassados: 'Repassados', saiu: 'Replanejadas', meus: 'Meus' };
    var ordem = ['todos', 'risco', 'adicionados', 'repassados', 'saiu'].concat(dev ? ['meus'] : []);
    if (!F[_esc.filtro] || (_esc.filtro === 'meus' && !dev)) _esc.filtro = 'todos';
    var lista = st.acomp.filter(F[_esc.filtro]);
    var vis = lista.slice(0, _esc.n);
    /* Na Validacao da area (`SPRINTPO.naArea`, fd4e5e8): o admin marca "Na area ·
       fora do placar". Da regra de 05/11 em diante ela volta ao placar como
       aguardando aprovacao (3ca7514), e o chip diz isso. */
    var SIT = { validado: ['ok', 'Validado'], aguardando: ['wn', 'Aguardando PM/PO'], saiu: ['bk', 'Replanejada'], negada: ['dg', 'Negada'],
                na_area: ['pu', st.regra ? 'Na área · aguardando aprovação' : 'Na área · fora do placar'] };
    var h = '<div class="hh"><h2 class="h2">Escopo <span class="note" style="font-family:var(--font-ui);font-weight:600">· ' + st.acomp.length + '</span></h2>' +
      '<span class="note" style="font-size:12.5px">Item que entra depois de iniciada fica marcado como Adicionado; o que veio de outra sprint, como Repassada.</span></div>' +
      '<div class="sp-fl" role="group" aria-label="Filtro do escopo">' + ordem.map(function (k) {
        var n = st.acomp.filter(F[k]).length;
        if (!n && k !== 'todos' && k !== _esc.filtro) return '';
        return '<button type="button" class="btns' + (k === _esc.filtro ? ' on' : '') + '" data-sp-filtro="' + k + '" aria-pressed="' + (k === _esc.filtro) + '">' +
          ROT[k] + ' <span style="color:var(--tx4);font-weight:800;margin-left:4px">' + n + '</span></button>';
      }).join('') + '</div>';
    if (!lista.length) {
      h += H.vazio('inbox', st.acomp.length ? 'Nada neste filtro' : 'Nenhuma demanda nesta sprint',
        st.acomp.length ? 'Troque o filtro para ver o resto do escopo.' : 'O PM/PO repassa as demandas para a sprint pela aba Planning ou pelo campo Sprint do card.');
    } else {
      h += vis.map(function (x) {
        var m = x.m, e = st.entrada[m.id] || { tipo: 'planejado' };
        var en = ENTRADA[e.tipo] || ENTRADA.planejado;
        var chipEn = x.situacao === 'saiu' ? chip('Replanejada', 'bk') : chip((e.tipo === 'prioritaria' ? ico('zap') + ' ' : '') + en.rot, en.cor);
        var why = x.situacao === 'saiu'
          ? (e.saiuPara ? 'foi para ' + curto(e.saiuPara) : 'voltou ao backlog') + (e.saiuEm ? ' · ' + H.dm(e.saiuEm) : '')
          : porQueEntrou(e);
        var sitChip = SIT[x.situacao] && x.situacao !== 'saiu' ? chip(SIT[x.situacao][1], SIT[x.situacao][0]) : H.chipEtapa(m);
        var sub = (m.dev ? esc(m.dev) : 'sem dev') +
          (x.riscos.length && x.situacao !== 'saiu' ? ' · <em style="font-style:normal;color:var(--wn-t)">' + x.riscos.map(function (k) { return esc(k.texto); }).join(' · ') + '</em>' : '');
        return '<a class="sp-esc' + (dev && H.minha(m) ? ' eu' : '') + '" href="' + H.hrefItem(m) + '"' +
          (e.motivo ? ' title="' + esc('Motivo do repasse: ' + e.motivo) + '"' : '') + '>' +
          '<span class="cd">' + esc(m.codigo || '—') + '</span>' +
          '<span class="ti"><b>' + esc(m.titulo || '') + '</b><span>' + sub + '</span></span>' +
          '<span class="x"><span>' + chipEn + '</span><span class="wy">' + esc(why) + '</span><span>' + sitChip + '</span></span>' +
          '<span class="pt">' + (x.pontos || '—') + '</span></a>';
      }).join('');
      if (lista.length > vis.length) {
        h += '<button type="button" class="btn sp-mais" data-sp-mais="1">Mostrar mais ' + Math.min(25, lista.length - vis.length) +
          ' <span style="color:var(--tx4)">· ' + vis.length + ' de ' + lista.length + '</span></button>';
      }
    }
    box.innerHTML = h;
  }

  // ── ABA: PLANNING ─────────────────────────────────────────────────────
  function abaPlanning(el, ctx) {
    var D = ctx.D;
    var fechadas = SP().rotulosFechados(D);
    var ops = SP().proximasSprints(H.hoje(), 5, fer(D), fechadas);
    var r = String(ctx.param || '').toUpperCase();
    if (!ops.some(function (s) { return s.rotulo === r; })) {
      // A sprint que esta sendo montada e a que a Planning enche.
      var mont = ops.filter(function (s) { return SP().situacaoDaSprint(D, s.rotulo) === 'montando'; })[0];
      r = (mont || ops[0] || {}).rotulo || H.sprintAtual();
    }
    var f = SP().faixaDaSprint(r, fer(D));
    var dias = ops.filter(function (s) { return s.rotulo === r; })[0];
    var admin = H.pode('editar');

    var fila = H.visiveis().filter(function (m) { return H.colunaDe(m) === 'planning'; });
    var cmp = raiz.ORDEMKB ? function (a, b) { return raiz.ORDEMKB.compara(a, b, raiz.ENTREGAUSU ? raiz.ENTREGAUSU.data : null); }
                           : function (a, b) { return H.pontosDe(b) - H.pontosDe(a); };
    fila.sort(cmp);
    var semPts = fila.filter(function (m) { return !H.pontosDe(m); });
    var ptsFila = fila.reduce(function (t, m) { return t + H.pontosDe(m); }, 0);

    var grupos = SP().capacidadePorTrilha(D, r, optsCapacidade(D));
    var cap = 0, aloc = 0;
    grupos.forEach(function (g) { cap += g.capacidade; aloc += g.alocado; });
    aloc = Math.round(aloc * 10) / 10;
    var pct = cap ? Math.round(aloc / cap * 100) : 0;
    var naSprint = H.visiveis().filter(function (m) { return SP().naSprint(m, r) && H.colunaDe(m) !== 'negada'; })
      .sort(function (a, b) { return H.pontosDe(b) - H.pontosDe(a); });
    var prox = SP().sprintSeguinte(r, fer(D));

    var opcoes = ops.map(function (s) {
      return '<option value="' + esc(s.rotulo) + '"' + (s.rotulo === r ? ' selected' : '') + '>' + esc(curto(s.rotulo)) +
        (s.agora ? ' (atual)' : '') + ' · ' + esc(SP().situacaoDaSprint(D, s.rotulo) === 'montando' ? 'montando' : 'em curso') + '</option>';
    }).join('');

    var h = '<header class="sp-hd"><div class="tt"><span class="note"><a href="#sprints/atual/' + esc(r) + '">Sprint</a> › Planning da ' + esc(curto(r)) + '</span>' +
      '<div class="row" style="gap:10px"><h1 class="h1">Planning · ' + esc(curto(r)) + '</h1>' + chipsSituacao(D, r) + '</div>' +
      '<span class="sub">' + esc(txtFaixa(f)) + (dias ? ' · ' + plural(dias.dias, 'dia útil', 'dias úteis') : '') +
      '. A fila é o que está em Planning; os pontos vêm do Planning Poker.</span></div>' +
      '<div class="ac"><select class="sp-sel" id="sp-sel-pl" aria-label="Sprint a planejar">' + opcoes + '</select>' +
      '<a class="' + (H.donoDaSprint() ? 'btn' : 'btnp') + '" href="#poker" title="Abre o Planning Poker para estimar a fila">Abrir Planning Poker</a>' +
      (H.donoDaSprint() ? '<button type="button" class="btn" data-sp-ciclo="lote" data-r="' + esc(r) + '" title="Escolha a sprint e marque as demandas: uma gravação só para o lote inteiro">' +
        ico('refresh') + ' Repassar para a sprint</button>' : '') +
      (H.donoDaSprint() && SP().situacaoDaSprint(D, r) === 'montando' && SP().demandasDaSprint(D, r).length ? botaoIniciar(r) : '') +
      '</div></header>';

    // Fila
    var colFila = '<section class="pn" style="gap:8px"><div class="row" style="justify-content:space-between"><span class="lab">FILA · PLANNING</span>' +
      '<span class="note">' + plural(fila.length, 'item', 'itens') + ' · ' + ptsFila + ' pts</span></div>' +
      (fila.length ? fila.slice(0, 40).map(function (m) {
        var pts = H.pontosDe(m), med = Number(m.poker_media);
        var s = SP().doPO(m);
        return '<a class="sp-li" href="' + H.hrefItem(m) + '"><span class="code" style="font-size:11px">' + esc(m.codigo || '—') + '</span>' +
          '<span class="t">' + esc(m.titulo || '') + '<small>' + esc(H.caminho(m.tema_id) || '—') + (m.dev ? ' · ' + esc(m.dev) : '') + '</small></span>' +
          (s ? chip(esc(curto(s)), s === r ? 'ac' : 'bk', 'Já repassada para ' + s) : '') +
          (pts ? '<span class="p" title="' + (isFinite(med) && med && med !== pts ? esc('média do poker ' + String(med).replace('.', ',')) : 'pontos do poker') + '">' + pts + ' pts</span>'
               : chip('sem pontos', 'wn')) + '</a>';
      }).join('') + (fila.length > 40 ? '<span class="note">e mais ' + (fila.length - 40) + ' na fila. A lista inteira está no Backlog.</span>' : '')
      : H.vazio('cards', 'Fila vazia', 'Nada em Planning agora.')) + '</section>';

    // A sprint
    var colSprint = '<section class="pnh" style="gap:8px"><div class="row" style="justify-content:space-between"><span class="labo">SPRINT ' + esc(curto(r)) + '</span>' +
      '<span class="mono" style="font-size:13px">' + H.num(aloc) + ' / ' + H.num(cap) + ' pts</span></div>' +
      '<div class="bar" style="height:10px"><span style="width:' + Math.min(100, pct) + '%;background:' + (pct > 100 ? 'var(--dg)' : 'linear-gradient(90deg,var(--ac),var(--ac-t))') + '"></span></div>' +
      '<span class="note">' + (cap ? pct + '% da capacidade' + (pct > 100 ? ', acima do que o time comporta' : '') : 'sem pessoas cadastradas') +
      ' · ' + plural(naSprint.length, 'demanda repassada', 'demandas repassadas') + '</span>' +
      (naSprint.length ? naSprint.slice(0, 40).map(function (m) {
        var d = H.devsDe(m)[0];
        return '<a class="sp-li" href="' + H.hrefItem(m) + '" style="border-color:var(--bd2)"><span class="code" style="font-size:11px">' + esc(m.codigo || '—') + '</span>' +
          '<span class="t">' + esc(m.titulo || '') + '<small>' + H.chipEtapa(m) + '</small></span>' +
          H.av(d || '', 24) + '<span class="p">' + (H.pontosDe(m) || '—') + '</span></a>';
      }).join('') + (naSprint.length > 40 ? '<span class="note">e mais ' + (naSprint.length - 40) + '.</span>' : '')
      : H.vazio('inbox', 'Nada repassado ainda', 'O PM/PO escolhe a sprint no card ou pelo Repassar para a sprint, aqui em cima.')) + '</section>';

    // Capacidade
    var linhaCap = function (e, nome, sub) {
      var p0 = e.pct == null ? 0 : e.pct;
      var cor = e.pct == null ? 'var(--tx4)' : p0 > 100 ? 'var(--dg)' : p0 >= 85 ? 'var(--wn)' : 'var(--ok)';
      return '<div class="sp-cap"><span class="r' + (sub ? ' sub' : '') + '"><span>' + nome + '</span><span class="mono" style="color:' + cor + '">' +
        e.alocado + ' / ' + e.capacidade + '</span></span>' +
        '<div class="sp-bar"><i style="width:' + Math.min(100, p0) + '%;background:' + cor + '"></i></div></div>';
    };
    var sugestoes = [];
    grupos.forEach(function (g) { g.sugeridas.forEach(function (m) { sugestoes.push(m); }); });
    var colCap = '<aside style="display:flex;flex-direction:column;gap:16px;min-width:0"><section class="pn"><span class="lab">CAPACIDADE</span>' +
      '<span class="kv">' + H.num(cap) + ' pts</span>' +
      '<span class="note" style="font-size:12px">30 pontos por pessoa ativa no cadastro (sprint.js). Ausência e feriado não descontam desta conta; veja o Calendário do time.</span>' +
      grupos.map(function (g) {
        return linhaCap(g, '<b>' + esc(g.nome) + '</b> <span class="note" style="font-size:11px">' + plural(g.pessoas.length, 'pessoa', 'pessoas') + '</span>') +
          (g.k === 'tecnologia' && g.frentes.length > 1 ? g.frentes.map(function (fr) { return linhaCap(fr, '↳ ' + esc(fr.frente), true); }).join('') : '');
      }).join('') + '</section>' +
      (sugestoes.length ? '<div class="lock">' + ico('alert') + '<span>Acima da capacidade. A regra sugere mover para ' + esc(curto(prox)) + ': ' +
        sugestoes.map(function (m) { return '<a href="' + H.hrefItem(m) + '">' + esc(m.codigo || m.id) + '</a> (' + H.pontosDe(m) + ' pts)'; }).join(', ') +
        '. Quem move é o PM/PO, pelo campo Sprint do card.</span></div>' : '') +
      (semPts.length ? '<div class="lock" style="background:rgba(var(--in-rgb),.08);border-color:rgba(var(--in-rgb),.3);color:var(--in-t)">' + ico('cards') +
        '<span>' + plural(semPts.length, 'item da fila está', 'itens da fila estão') + ' sem pontos: ' +
        semPts.slice(0, 5).map(function (m) { return esc(m.codigo || m.id); }).join(', ') + (semPts.length > 5 ? '…' : '') +
        '. Sem estimativa, não pesam na capacidade.</span></div>' : '') +
      '</aside>';

    h += '<div class="sp-pl">' + colFila + colSprint + colCap + '</div>';
    el.innerHTML = h;
  }

  // ── ABA: PLANEJAMENTO (Gantt resumido) ────────────────────────────────
  var _projeto = '';

  function corBarra(m) {
    var e = H.etapaDe(m);
    var c = e === 'concluido' ? 'ok' : (e === 'validacao' || e === 'validacao_area') ? 'wn' : e === 'atrasado' ? 'dg'
          : e === 'em_andamento' ? 'ac' : e === 'planejado' ? 'in' : 'pu';
    return 'background:rgba(var(--' + c + '-rgb),.16);border-color:rgba(var(--' + c + '-rgb),.45)';
  }

  function abaPlanejamento(el, ctx) {
    var D = ctx.D, F = fer(D);
    var r1 = String(ctx.param || '').toUpperCase();
    if (!SP().rotuloValido(r1)) r1 = H.sprintAtual();
    var r2 = SP().sprintSeguinte(r1, F);
    var antes = SP().sprintAnterior(r1, F);
    var diasDe = function (r) {
      var f = SP().faixaDaSprint(r, F);
      if (!f) return [];
      return SP().diasUteisDoMes(+r.slice(6, 10), +r.slice(3, 5), F).filter(function (d) { return d >= f.de && d <= f.ate; });
    };
    var d1 = diasDe(r1), d2 = r2 ? diasDe(r2) : [];
    var dias = d1.concat(d2);
    if (!dias.length) { el.innerHTML = H.vazio('calendar', 'Período sem dias úteis', 'Escolha outra sprint.'); return; }
    var ini = dias[0], fim = dias[dias.length - 1], hoje = H.hoje();
    var nCol = dias.length;
    var cols = '190px repeat(' + nCol + ', minmax(0, 1fr))';

    var itens = H.visiveis().filter(function (m) {
      if (H.colunaDe(m) === 'negada' || !String(m.dev || '').trim()) return false;
      if (_projeto && m.projeto_id !== _projeto) return false;
      var a = iso(m.inicio) || H.prazoDe(m), b = H.prazoDe(m) || iso(m.entrega) || a;
      if (!a || !b) return false;
      if (b < a) b = a;
      return !(b < ini || a > fim);
    });
    var pessoas = devsAtivos(D).slice();
    itens.forEach(function (m) { H.devsDe(m).forEach(function (n) { if (pessoas.indexOf(n) < 0) pessoas.push(n); }); });
    pessoas.sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    // O dev logado primeiro: e a linha que ele veio procurar.
    var meus = H.meusNomes();
    pessoas.sort(function (a, b) { return (meus.indexOf(b) >= 0) - (meus.indexOf(a) >= 0); });

    /* PONTOS POR PESSOA NA SPRINT, pela conta do modulo: `capacidadeDaSprint`
       agrupa por frente, e cada pessoa vira a propria "frente" aqui — 30 de
       capacidade e o alocado dividido como na dupla (pts / pessoas). */
    var porPessoa = {};
    SP().capacidadeDaSprint(D, r1, { devs: pessoas, frenteDoDev: function (n) { return n; }, frenteDe: function () { return ''; },
      semFrente: '(sem dev)', etapaDe: H.etapaDe }).forEach(function (e) { porPessoa[e.frente] = e; });

    var aus = (D.ausencias || []);
    var ausDe = function (n, d) { return aus.filter(function (a) { return a.dev === n && d >= iso(a.inicio) && d <= iso(a.fim || a.inicio); })[0] || null; };
    var TIPO_AUS = { ferias: 'férias', atestado: 'atestado', folga: 'folga', licenca: 'licença', outro: 'ausência' };

    var cabSprint = function (r, ds) {
      if (!ds.length) return '';
      var sit = SP().situacaoDaSprint(D, r);
      var cor = sit === 'em_curso' ? 'var(--ac-t)' : sit === 'fechada' ? 'var(--ok-t)' : 'var(--in-t)';
      var n = H.visiveis().filter(function (m) { return SP().naSprint(m, r) && H.colunaDe(m) !== 'negada'; });
      var pts = n.reduce(function (t, m) { return t + H.pontosDe(m); }, 0);
      return '<div class="hs" style="grid-column:span ' + ds.length + (r === H.sprintAtual() ? ';background:rgba(var(--ac-rgb),.07)' : '') + '">' +
        '<b style="color:' + cor + '">' + esc(curto(r)) + ' · ' + (sit === 'em_curso' ? 'ativa' : sit === 'fechada' ? 'fechada' : 'montando') + '</b>' +
        '<span>' + plural(n.length, 'demanda', 'demandas') + ' · ' + pts + ' pts</span></div>';
    };
    var DS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

    var corpo = '<div class="gr" style="grid-template-columns:' + cols + ';border-bottom:1px solid var(--sf5)"><span></span>' + cabSprint(r1, d1) + cabSprint(r2, d2) + '</div>' +
      '<div class="gr" style="grid-template-columns:' + cols + ';border-bottom:1px solid var(--sf5)"><span class="lab" style="padding:8px 14px;font-size:10.5px">DEV · PONTOS NA ' + esc(curto(r1)) + '</span>' +
      dias.map(function (d) { return '<span class="dd' + (d === hoje ? ' hj' : '') + '">' + DS[H.data(d).getDay()] + ' ' + d.slice(8, 10) + '</span>'; }).join('') + '</div>';

    var MAXF = 3;
    pessoas.forEach(function (n) {
      var meusItens = itens.filter(function (m) { return H.devsDe(m).indexOf(n) >= 0; }).map(function (m) {
        var a = iso(m.inicio) || H.prazoDe(m), b = H.prazoDe(m) || iso(m.entrega) || a;
        if (b < a) b = a;
        var s = 0; while (s < nCol && dias[s] < a) s++;
        var e = nCol - 1; while (e >= 0 && dias[e] > b) e--;
        return { m: m, s: Math.min(s, nCol - 1), e: Math.max(e, 0) };
      }).filter(function (x) { return x.e >= x.s; }).sort(function (x, y) { return x.s - y.s || y.e - x.e; });
      // Empacota em faixas: cada barra na primeira faixa onde nao sobrepoe.
      var faixas = [], fora = 0;
      meusItens.forEach(function (x) {
        for (var i = 0; i < faixas.length; i++) {
          if (faixas[i].every(function (o) { return x.s > o.e || x.e < o.s; })) { faixas[i].push(x); x.f = i; return; }
        }
        if (faixas.length < MAXF) { faixas.push([x]); x.f = faixas.length - 1; } else { fora++; x.f = -1; }
      });
      var cp = porPessoa[n] || { alocado: 0, capacidade: 30 };
      var pc = cp.capacidade ? Math.round(cp.alocado / cp.capacidade * 100) : 0;
      var cor = pc > 100 ? 'var(--dg-t)' : pc >= 85 ? 'var(--wn-t)' : 'var(--ok-t)';
      var ausNaJanela = aus.filter(function (a) { return a.dev === n && iso(a.fim || a.inicio) >= ini && iso(a.inicio) <= fim; });
      var nota = ausNaJanela.length ? ausNaJanela.map(function (a) { return (TIPO_AUS[a.tipo] || 'ausência') + ' ' + H.dm(a.inicio) + (a.fim && a.fim !== a.inicio ? '–' + H.dm(a.fim) : ''); }).join(' · ')
                : (raiz.PIPELINES ? raiz.PIPELINES.doDev(n, D.devs_perfil) || '' : '');
      if (fora) nota = '+' + fora + ' sem espaço · ' + nota;
      var linhas = Math.max(1, faixas.length);
      corpo += '<div class="gr dv" style="grid-template-columns:' + cols + '">' +
        '<div class="lb" style="grid-row:1 / span ' + Math.max(linhas, 2) + '"><b' + (meus.indexOf(n) >= 0 ? ' style="color:var(--ac-t)"' : '') + '>' + esc(n) + '</b>' +
        '<span class="m" style="color:' + cor + '">' + cp.alocado + ' / ' + cp.capacidade + ' pts</span>' +
        '<span class="sp-bar"><i style="width:' + Math.min(100, pc) + '%;background:' + cor + '"></i></span>' +
        (nota ? '<span class="n ell">' + esc(nota) + '</span>' : '') + '</div>';
      // Fundo das celulas: ausencia hachurada, o resto so com a linha do dia.
      dias.forEach(function (d, i) {
        var au = ausDe(n, d);
        corpo += '<span class="' + (au ? 'au' : 'cl') + '" style="grid-column:' + (i + 2) + ';grid-row:1 / span ' + Math.max(linhas, 2) + '"' +
          (au ? ' title="' + esc(n + ': ' + (TIPO_AUS[au.tipo] || 'ausência') + ' em ' + H.dm(d)) + '"' : '') + '></span>';
      });
      meusItens.forEach(function (x) {
        if (x.f < 0) return;
        var m = x.m;
        corpo += '<a class="br" href="' + H.hrefItem(m) + '" style="grid-column:' + (x.s + 2) + ' / ' + (x.e + 3) + ';grid-row:' + (x.f + 1) + ';' + corBarra(m) + '"' +
          ' title="' + esc((m.codigo || '') + ' · ' + (m.titulo || '') + ' · ' + H.dm(iso(m.inicio) || H.prazoDe(m)) + ' a ' + H.dm(H.prazoDe(m) || m.entrega)) + '">' +
          '<span class="c">' + esc(m.codigo || '') + '</span><span class="t">' + esc(m.titulo || '') + '</span></a>';
      });
      corpo += '</div>';
    });

    var fila = H.visiveis().filter(function (m) { return H.colunaDe(m) === 'planning' && (!_projeto || m.projeto_id === _projeto); });
    var comPts = fila.filter(function (m) { return H.pontosDe(m); });
    var projs = (D.projetos || []).slice().sort(function (a, b) { return String(a.codigo || '').localeCompare(String(b.codigo || '')); });

    var h = '<header class="sp-hd"><div class="tt"><h1 class="h1">Planejamento</h1>' +
      '<span class="sub">Quem está com o quê em cada dia útil, pelas datas de início e prazo das demandas. Mover e alocar é no planejamento completo.</span></div>' +
      '<div class="ac"><div class="row" style="gap:6px;height:40px;padding:0 6px;border-radius:11px;background:var(--sf);border:1px solid var(--bd2)">' +
      (antes ? '<a class="btns" style="width:30px;padding:0;border:0" href="#sprints/planejamento/' + esc(antes) + '" aria-label="Sprint anterior">‹</a>' : '') +
      '<span style="font-size:13px;font-weight:700;padding:0 6px;white-space:nowrap">' + esc(H.dm(ini) + ' – ' + H.dm(fim)) + '</span>' +
      (r2 ? '<a class="btns" style="width:30px;padding:0;border:0" href="#sprints/planejamento/' + esc(r2) + '" aria-label="Próxima sprint">›</a>' : '') + '</div>' +
      (r1 !== H.sprintAtual() ? '<a class="btn" href="#sprints/planejamento">Hoje</a>' : '') +
      '<select class="sp-sel" id="sp-proj" aria-label="Projeto"><option value="">Todos os projetos</option>' +
      projs.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === _projeto ? ' selected' : '') + '>' + esc((p.codigo ? p.codigo + ' · ' : '') + (p.nome || '')) + '</option>'; }).join('') + '</select>' +
      '<a class="btnp" href="#planejamento/' + esc(r1) + '" title="' + (H.pode('editar') ? 'Abre o Planejamento, onde se move, aloca e registra ausência' : 'Abre o Planejamento com filtros e zoom') + '">Abrir planejamento completo</a>' +
      '</div></header>';

    h += '<div class="sp-pj"><div class="sp-gt" style="overflow-x: auto"><div class="in2">' + corpo + '</div></div>' +
      '<aside class="pn" style="gap:10px;border-color:rgba(var(--pu-rgb),.3)"><div class="row" style="justify-content:space-between">' +
      '<span class="lab" style="color:var(--pu-t)">FILA DA PLANNING</span><span class="mono note">' + fila.length + '</span></div>' +
      (comPts.length ? comPts.slice(0, 8).map(function (m) {
        return '<a class="sp-li" href="' + H.hrefItem(m) + '" style="flex-direction:column;align-items:stretch;gap:6px">' +
          '<span class="row" style="justify-content:space-between"><span class="mono" style="font-size:11.5px;color:var(--tx3)">' + esc(m.codigo || '') + '</span>' +
          '<span class="mono" style="font-size:11.5px;color:var(--tx2)">' + H.pontosDe(m) + ' pts</span></span>' +
          '<span style="font-size:12.5px;font-weight:700;line-height:17px">' + esc(m.titulo || '') + '</span>' +
          '<span style="font-size:11px;color:var(--tx3)">' + esc(H.caminho(m.tema_id) || '—') + '</span></a>';
      }).join('') : '<span class="note">Nada pontuado na fila.</span>') +
      (comPts.length > 8 ? '<a class="note" href="#sprints/planning">e mais ' + (comPts.length - 8) + ' na Planning</a>' : '') +
      '<span class="note" style="font-size:11.5px">' + (fila.length - comPts.length ? plural(fila.length - comPts.length, 'item sem pontos fica', 'itens sem pontos ficam') + ' de fora até o Poker. ' : '') +
      'Barras pela etapa: azul planejado, laranja em andamento, amarelo em validação, verde concluído, vermelho atrasado. Hachura é ausência.</span></aside></div>';
    el.innerHTML = h;
  }

  // ── ABA: ENCERRAR SPRINT (admin) ──────────────────────────────────────
  function abaEncerrar(el, ctx) {
    var D = ctx.D, F = fer(D);
    var etapa = H.colunaDe;
    var pend = SP().pendentesDeFechamento(D, H.hoje(), F, etapa);
    var h = '';
    var dono = H.donoDaSprint();
    var fechaBtn = function (r) {
      // So o dono da sprint fecha (`sprintFecharAbrir`, admin.html, 02/11/2026).
      if (!dono) return '<span class="note">Só a área de produto fecha a sprint.</span>';
      var falta = fechFaltam(D, r);
      return '<button type="button" class="btnp perigo" data-sp-ciclo="fechar" data-r="' + esc(r) + '"' + (falta ? ' disabled' : '') + '>' +
        ico('lock') + ' <span data-fech-rot="' + esc(r) + '">' + esc(rotuloFechar(falta)) + '</span></button>';
    };
    if (!pend.length) {
      var agora = H.sprintAtual(), fa = SP().faixaDaSprint(agora, F);
      h += '<header class="sp-hd"><div class="tt"><h1 class="h1">Encerrar sprint</h1>' +
        '<span class="sub">Fechar é decidir o destino e o motivo de cada demanda que não entregou. Fechada, a sprint não aceita entrada nem saída.</span></div></header>' +
        '<section class="pn">' + H.vazio('check', 'Nenhuma sprint esperando fechamento',
          'A ' + curto(agora) + (fa ? ' termina em ' + H.dm(fa.ate) : '') + '. O aviso aparece aqui no primeiro dia útil depois.') + '</section>';
    }
    pend.forEach(function (pd) {
      var r = pd.rotulo, f = SP().faixaDaSprint(r, F);
      var bal = SP().balancoDaSprint(D, r, etapa);
      var p = SP().placarDaSprint(D, r, etapa, '');
      var seg = SP().sprintSeguinte(r, F);
      var todos = [].concat(p.itens.validados, p.itens.aguardando, p.itens.emCurso, p.itens.saiu);
      var adic = todos.filter(function (m) { return entradaNa(D, m, r).tipo === 'adicionado'; });
      var adicPts = adic.reduce(function (t, m) { return t + H.pontosDe(m); }, 0);
      h += '<header class="sp-hd"><div class="tt"><span class="note"><a href="#sprints/atual/' + esc(r) + '">Sprint</a> › Fechamento da ' + esc(curto(r)) + '</span>' +
        '<div class="row" style="gap:10px"><h1 class="h1">Encerrar ' + esc(curto(r)) + '</h1>' + chipsSituacao(D, r) + '</div>' +
        '<span class="sub">' + esc(txtFaixa(f)) + ' · ' + esc(situacaoTxt(D, r)) + '. Decida o destino e o motivo de cada demanda que não saiu; o fechamento não tem volta.</span></div>' +
        fechaBtn(r) + '</header>';
      h += '<div class="sp-k5">' +
        kpi('Pontos validados', p.pontosValidados + ' / ' + p.pontosTotal, '', p.pctPontos != null ? p.pctPontos + '% por ponto' : 'sem pontuação') +
        kpi('Itens validados', bal.entregues.length, '', p.pct + '% de ' + p.total + ' por item', 'ok', 'var(--ok-t)') +
        kpi('Aguardando validação', bal.aguardando.length, '', 'ficam nesta sprint e contam ao validar', bal.aguardando.length ? 'in' : '', bal.aguardando.length ? 'var(--in-t)' : '') +
        kpi('Sem destino', bal.pendentes.length, '', 'precisam de destino e motivo', bal.pendentes.length ? 'wn' : '', bal.pendentes.length ? 'var(--wn-t)' : '') +
        kpi('Entraram no meio', adic.length, '', adic.length ? adicPts + ' pts depois de iniciada' : 'nada depois do início') +
        '</div>';
      var linha = function (m, dir) {
        return '<a class="sp-li" href="' + H.hrefItem(m) + '"><span class="code" style="font-size:11px">' + esc(m.codigo || '—') + '</span>' +
          '<span class="t">' + esc(m.titulo || '') + '<small>' + (m.dev ? esc(m.dev) : 'sem dev') + ' · ' + esc((H.ETAPA_POR_ID[H.colunaDe(m)] || {}).rotulo || '') +
          (H.pontosDe(m) ? ' · ' + H.pontosDe(m) + ' pts' : '') + '</small></span>' + dir + '</a>';
      };
      /* O DESTINO E O MOTIVO DE CADA UMA, aqui mesmo (o dialogo do
         `sprintFecharRender`). O destino oferece as sprints abertas menos a que
         esta fechando: o modulo recusa "empurrar para a propria sprint". */
      var dec = fechDecisoes(D, r);
      var destinos = SP().proximasSprints(H.hoje(), 5, F, SP().rotulosFechados(D)).filter(function (o) { return o.rotulo !== r; });
      var colNao = '<section class="pn"><h2 class="h2">O que não saiu · escolha o destino</h2>' +
        (bal.pendentes.length ? bal.pendentes.map(function (m) {
          var d = dec[m.id] || { destino: '', motivo: '' };
          var rs = SP().riscosDaDemanda(m, r, H.hoje(), raiz.PRAZO).filter(function (x) { return x.chave !== 'sem_pontos'; });
          var n = SP().pulos(m);
          var cab = '<a class="sp-li sp-fd-cab" href="' + H.hrefItem(m) + '"' + (rs.length ? ' title="' + esc(rs.map(function (x) { return x.texto; }).join(' · ')) + '"' : '') + '>' +
            '<span class="code" style="font-size:11px">' + esc(m.codigo || '—') + '</span>' +
            '<span class="t">' + esc(m.titulo || '') + '<small>' + (m.dev ? esc(m.dev) : 'sem dev') + ' · ' + esc((H.ETAPA_POR_ID[H.colunaDe(m)] || {}).rotulo || '') +
            (H.pontosDe(m) ? ' · ' + H.pontosDe(m) + ' pts' : '') + '</small></span>' +
            // A REINCIDENCIA GRITA: empurrar pela terceira vez e decisao diferente da primeira.
            (n ? chip((n + 1) + 'ª vez', 'dg', 'Já rolou ' + plural(n, 'vez', 'vezes')) : '') +
            (H.pausada(m) ? chip(ico('pause') + ' Pausada', 'mg') : '') + '</a>';
          if (!dono) return cab;
          var idDest = 'fd-' + r + '-' + m.id;
          return '<div class="sp-fd">' + cab + '<div class="sp-fd-ed">' +
            '<select class="in" id="' + esc(idDest) + '" data-fech-r="' + esc(r) + '" data-fech-id="' + esc(m.id) + '" data-fech-campo="destino" aria-label="Destino de ' + esc(m.codigo || m.titulo || '') + '">' +
            '<option value="">Voltar ao backlog</option>' + destinos.map(function (o) {
              return '<option value="' + esc(o.rotulo) + '"' + (d.destino === o.rotulo ? ' selected' : '') + '>' + esc(curto(o.rotulo) + ' · ' + H.dm(o.de) + '–' + H.dm(o.ate) + (o.agora ? ' · agora' : '')) + '</option>';
            }).join('') + '</select>' +
            '<input class="in" type="text" maxlength="300" autocomplete="off" placeholder="Por que não entregou?" value="' + esc(d.motivo) + '"' +
            ' data-fech-r="' + esc(r) + '" data-fech-id="' + esc(m.id) + '" data-fech-campo="motivo" aria-label="Motivo de ' + esc(m.codigo || m.titulo || '') + '"></div></div>';
        }).join('') + '<span class="note" style="font-size:11.5px">Pausada já vem com destino na ' + esc(curto(seg)) + ' e a pausa como motivo; o PM/PO pode trocar. As outras vão para uma sprint aberta ou voltam ao backlog, cada uma com o motivo (ao menos ' + SP().MIN_MOTIVO_CARRY + ' caracteres).</span>'
        : H.vazio('check', 'Nada a decidir', 'Tudo entregou ou está em validação. Fechar só carimba a sprint.')) + '</section>';
      var colVai = '<section class="pn"><h2 class="h2">O que fica na sprint</h2>' +
        (bal.entregues.length || bal.aguardando.length
          ? bal.entregues.map(function (m) { return linha(m, chip(ico('check') + ' Validado', 'ok')); }).join('') +
            bal.aguardando.map(function (m) { return linha(m, chip(ico('hourglass') + ' Aguardando', 'wn')); }).join('')
          : H.vazio('inbox', 'Nada entregue nesta sprint', '')) +
        (p.saiu ? '<span class="note" style="font-size:11.5px">' + plural(p.saiu, 'demanda foi replanejada', 'demandas foram replanejadas') + ' para outra sprint e não conta no total desta.</span>' : '') +
        '</section>';
      h += '<div class="sp-2e">' + colNao + colVai + '</div>';
    });

    // Fechamentos anteriores, com o carry de cada um (o que rolou e por que).
    var fech = SP().fechamentos(D).slice().sort(function (a, b) { return chave(b.rotulo).localeCompare(chave(a.rotulo)); }).slice(0, 4);
    if (fech.length) {
      h += '<section class="pn"><div class="row" style="justify-content:space-between"><h2 class="h2">Fechamentos anteriores</h2>' +
        '<span class="note">validado / total de cada sprint, pelo placar</span></div>' +
        '<div style="overflow-x:auto"><table class="sp-tb"><thead><tr><th>SPRINT</th><th>FECHADA</th><th class="n">PONTOS</th><th class="n">ITENS</th><th>O QUE ROLOU</th></tr></thead><tbody>' +
        fech.map(function (fc) {
          var p = SP().placarDaSprint(D, fc.rotulo, etapa, '');
          var carry = Array.isArray(fc.carry) ? fc.carry : [];
          return '<tr><td><a href="#sprints/atual/' + esc(fc.rotulo) + '"><b>' + esc(curto(fc.rotulo)) + '</b></a></td>' +
            '<td>' + esc(H.dm(fc.em)) + (fc.por ? ' · ' + esc(String(fc.por).split(' ')[0]) : '') + '</td>' +
            '<td class="n">' + p.pontosValidados + ' / ' + p.pontosTotal + '</td><td class="n">' + p.validados + ' / ' + p.total + '</td>' +
            '<td>' + (carry.length ? carry.map(function (c) {
              return '<span title="' + esc(c.motivo || '') + '">' + esc(c.codigo || '') + ' → ' + esc(c.destino ? curto(c.destino) : 'backlog') + '</span>';
            }).join(' · ') : '<span style="color:var(--tx4)">nada</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div></section>';
    }
    el.innerHTML = h;
  }

  // ── ABA: CALENDARIO DO TIME ───────────────────────────────────────────
  var TIPO_AUS = {
    ferias:   { rot: 'férias',   cor: 'tl' },
    atestado: { rot: 'atestado', cor: 'dg' },
    folga:    { rot: 'folga',    cor: 'in' },
    licenca:  { rot: 'licença',  cor: 'pu' },
    outro:    { rot: 'ausência', cor: 'pu' }
  };

  function abaCalendario(el, ctx) {
    var D = ctx.D, F = fer(D);
    var p = String(ctx.param || '');
    var hoje = H.hoje();
    var ano = +hoje.slice(0, 4), mes = +hoje.slice(5, 7);
    if (/^\d{4}-\d{2}$/.test(p) && +p.slice(5, 7) >= 1 && +p.slice(5, 7) <= 12) { ano = +p.slice(0, 4); mes = +p.slice(5, 7); }
    var chaveMes = ano + '-' + pad(mes);
    var ant = mes === 1 ? (ano - 1) + '-12' : ano + '-' + pad(mes - 1);
    var prx = mes === 12 ? (ano + 1) + '-01' : ano + '-' + pad(mes + 1);
    var sprints = SP().sprintsDoMes(ano, mes, F);
    var uteis = SP().diasUteisDoMes(ano, mes, F);
    var pessoas = devsAtivos(D);
    var ferMes = F.map(function (x) { return typeof x === 'object' ? x : { data: x }; })
      .filter(function (x) { return iso(x.data).slice(0, 7) === chaveMes; })
      .sort(function (a, b) { return iso(a.data).localeCompare(iso(b.data)); });
    var ferPorDia = {};
    ferMes.forEach(function (x) { ferPorDia[iso(x.data)] = x; });
    var primeiro = chaveMes + '-01';
    var ultimo = chaveMes + '-' + pad(new Date(Date.UTC(ano, mes, 0)).getUTCDate());
    var aus = (D.ausencias || []).filter(function (a) { return iso(a.inicio) <= ultimo && iso(a.fim || a.inicio) >= primeiro; });

    /* DIAS DE AUSENCIA: dias uteis (sem fim de semana nem feriado) dentro da
       faixa, sem contar duas vezes o mesmo dia da mesma pessoa. E a regra do
       `diasAusentes` do gantt.html (e do deck do admin): candidata a modulo. */
    var ausentes = function (n, dias) {
      var set = {};
      aus.forEach(function (a) {
        if (a.dev !== n) return;
        dias.forEach(function (d) { if (d >= iso(a.inicio) && d <= iso(a.fim || a.inicio)) set[d] = true; });
      });
      return Object.keys(set).length;
    };

    var linhasCap = sprints.map(function (s) {
      var ds = uteis.filter(function (d) { return d >= s.de && d <= s.ate; });
      var fora = 0, quem = [];
      pessoas.forEach(function (n) { var k = ausentes(n, ds); if (k) { fora += k; quem.push(n.split(' ')[0] + ' ' + k + 'd'); } });
      var total = pessoas.length * ds.length;
      var pts = SP().capacidadePorTrilha(D, s.rotulo, optsCapacidade(D)).reduce(function (t, g) { return t + g.capacidade; }, 0);
      return { s: s, dias: ds.length, total: total, fora: fora, disp: total - fora, quem: quem, pts: pts };
    });
    var capDe = {};
    linhasCap.forEach(function (l) { capDe[l.s.rotulo] = l; });

    // A grade: uma linha por semana (segunda a sexta), com a sprint a esquerda.
    var semanas = [], vistas = {};
    for (var dd = 1; dd <= +ultimo.slice(8, 10); dd++) {
      var d = chaveMes + '-' + pad(dd);
      var seg = SP().segundaDaSemana(d);
      if (!vistas[seg]) { vistas[seg] = true; semanas.push(seg); }
    }
    var addDias = function (s, n) { var x = new Date(s + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
    var grade = '<div class="sp-cal"><span class="ch sw0" style="text-align:left;padding-left:12px">SPRINT</span>' +
      ['SEG', 'TER', 'QUA', 'QUI', 'SEX'].map(function (x) { return '<span class="ch">' + x + '</span>'; }).join('');
    semanas.forEach(function (seg) {
      var ds = [0, 1, 2, 3, 4].map(function (i) { return addDias(seg, i); });
      var noMes = ds.filter(function (x) { return x.slice(0, 7) === chaveMes; });
      if (!noMes.length) return;   // semana so de fim de semana do mes
      var rot = SP().rotuloDeData(noMes.filter(function (x) { return uteis.indexOf(x) >= 0; })[0] || noMes[0], F);
      var cp = capDe[rot];
      grade += '<div class="sw">' + (cp ? '<b>' + esc(curto(rot)) + '</b><span>' + plural(cp.dias, 'dia útil', 'dias úteis') + '</span>' +
        '<span>' + cp.disp + ' de ' + cp.total + ' dias-pessoa</span>' : '<b style="color:var(--tx4)">sem dias úteis</b>') + '</div>';
      ds.forEach(function (x) {
        var fora = x.slice(0, 7) !== chaveMes, fe = ferPorDia[x];
        var cls = 'dc' + (fora ? ' fo' : '') + (fe ? ' fe' : '') + (x === hoje ? ' hj' : '');
        var ev = '';
        if (!fora) {
          if (fe) ev += '<span class="ev" style="background:rgba(var(--tl-rgb),.16);color:var(--tl-t)" title="' + esc(fe.nome || 'Feriado') + '">Feriado' + (fe.nome ? ' · ' + esc(fe.nome) : '') + '</span>';
          aus.forEach(function (a) {
            if (x < iso(a.inicio) || x > iso(a.fim || a.inicio) || fe) return;
            var t = TIPO_AUS[a.tipo] || TIPO_AUS.outro;
            ev += '<span class="ev" style="background:rgba(var(--' + t.cor + '-rgb),.16);color:var(--' + t.cor + '-t)" title="' + esc(a.dev + ' · ' + t.rot + (a.obs ? ' · ' + a.obs : '')) + '">' +
              esc(String(a.dev || '').split(' ')[0]) + ' · ' + t.rot + '</span>';
          });
        }
        grade += '<div class="' + cls + '"><span class="d">' + x.slice(8, 10) + (fora ? '/' + x.slice(5, 7) : '') + '</span>' + ev + '</div>';
      });
    });
    grade += '</div>';

    var totDisp = 0, totTot = 0;
    linhasCap.forEach(function (l) { totDisp += l.disp; totTot += l.total; });
    var h = '<header class="sp-hd"><div class="tt"><h1 class="h1">Calendário do time</h1>' +
      '<span class="sub">Feriados e ausências de ' + esc(H.MESES[mes - 1]) + ' de ' + ano + ', e quanto cada sprint perde por eles. Fins de semana ficam de fora.</span></div>' +
      '<div class="ac"><a class="btns" href="#sprints/calendario/' + ant + '" aria-label="Mês anterior">‹</a>' +
      '<span class="in" style="height:32px">' + esc(H.MESES[mes - 1]) + ' de ' + ano + '</span>' +
      '<a class="btns" href="#sprints/calendario/' + prx + '" aria-label="Próximo mês">›</a>' +
      (chaveMes !== hoje.slice(0, 7) ? '<a class="btns" href="#sprints/calendario">Este mês</a>' : '') +
      (H.pode('editar') ? '<a class="btn" href="#planejamento/ausencias" title="Abre o cadastro de ausências do Planejamento">Registrar ausência</a>' : '') +
      (AX.APP.papel === 'admin' ? '<a class="btns" href="#planejamento/feriados" title="Abre o cadastro de feriados do Planejamento">Feriados</a>' : '') +
      '</div></header>';
    h += '<section class="pn" style="padding:0;gap:0;overflow:hidden">' + grade + '</section>';

    h += '<div class="sp-k3">' +
      '<section class="pn"><span class="lab">FERIADOS</span>' + (ferMes.length ? ferMes.map(function (x) {
        return '<div class="row" style="font-size:13px"><span class="mono" style="color:var(--tl-t)">' + H.dm(x.data) + '</span><span>' + esc(x.nome || 'Feriado') + '</span>' +
          '<span class="note" style="margin-left:auto">' + esc(H.dataLonga(x.data).split(',')[0]) + '</span></div>';
      }).join('') : '<span class="note">Nenhum feriado cadastrado neste mês.</span>') + '</section>' +
      '<section class="pn"><span class="lab">AUSÊNCIAS</span>' + (aus.length ? aus.slice().sort(function (a, b) { return iso(a.inicio).localeCompare(iso(b.inicio)); }).map(function (a) {
        var t = TIPO_AUS[a.tipo] || TIPO_AUS.outro;
        var k = ausentes(a.dev, uteis.filter(function (d) { return d >= iso(a.inicio) && d <= iso(a.fim || a.inicio); }));
        return '<div class="row" style="font-size:13px;align-items:flex-start">' + H.av(a.dev, 24) +
          '<span style="flex:1;min-width:0;line-height:17px"><b>' + esc(a.dev || '—') + '</b> ' + chip(t.rot, t.cor) +
          '<span class="note" style="display:block;font-size:11.5px">' + H.dm(a.inicio) + (a.fim && a.fim !== a.inicio ? ' a ' + H.dm(a.fim) : '') +
          (a.obs ? ' · ' + esc(a.obs) : '') + '</span></span><span class="mono" style="font-size:12px;color:var(--wn-t)" title="dias úteis neste mês">−' + k + 'd</span></div>';
      }).join('') : '<span class="note">Ninguém ausente neste mês.</span>') + '</section>' +
      '<section class="pn"><span class="lab">CAPACIDADE</span><span class="kv">' + totDisp + ' <span style="font-size:14px;color:var(--tx3)">de ' + totTot + ' dias-pessoa</span></span>' +
      '<span class="note" style="font-size:12px">' + plural(pessoas.length, 'pessoa ativa', 'pessoas ativas') + ' × dias úteis, menos ausências. Feriado já sai dos dias úteis.</span>' +
      '<table class="sp-tb"><thead><tr><th>SPRINT</th><th class="n">DIAS</th><th class="n">DISPONÍVEL</th><th class="n">PONTOS</th></tr></thead><tbody>' +
      linhasCap.map(function (l) {
        return '<tr><td><a href="#sprints/atual/' + esc(l.s.rotulo) + '">' + esc(curto(l.s.rotulo)) + '</a></td><td class="n">' + l.dias + '</td>' +
          '<td class="n"' + (l.quem.length ? ' title="' + esc('ausentes: ' + l.quem.join(', ')) + '" style="color:var(--wn-t)"' : '') + '>' + l.disp + ' / ' + l.total + '</td>' +
          '<td class="n">' + l.pts + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<span class="note" style="font-size:11.5px">Pontos = 30 por pessoa por sprint (sprint.js), sem desconto de ausência nem de feriado: o efeito delas aparece em dias.</span></section>' +
      '</div>';
    el.innerHTML = h;
  }

  // ═══ FILTRO DE SPRINT COM VARIAS ESCOLHAS (admin.html, 4d7c38f) ═════════
  /* "Preciso selecionar qual sprint quero e ter opcao de selecionar todas."
     O Quadro e o Backlog filtram por ele, e a aba Entregas le as mesmas
     opcoes para escolher a sprint. As tres funcoes sao COPIA de `listaOuNulo`,
     `matchSprintKb` e `opcoesSprintKb` (admin.html), com o modulo de sprint e
     a base por parametro; a suite executa cada uma ao lado da do admin
     (secao "App AXIS: Entregas por sprint, projetos em andamento e os PPTs").
     O valor e null (todas) ou uma lista de chaves: '__fora__' (sem sprint do
     PO) e/ou rotulos. Lista vazia volta a ser null: desmarcar tudo e nao
     querer filtro, e um quadro vazio faria a pessoa achar que sumiu dado. */
  function spListaOuNulo(v) {
    var l = (Array.isArray(v) ? v : (v ? [v] : [])).filter(Boolean);
    return l.length ? l : null;
  }
  function spCasaSprint(SPm, m, f) {
    if (!f || (Array.isArray(f) && !f.length)) return true;
    // VARIAS SPRINTS: basta estar em uma delas.
    if (Array.isArray(f)) return f.some(function (k) { return spCasaSprint(SPm, m, k); });
    if (f === '__fora__') return SPm.foraDaSprint(m);
    return SPm.naSprint(m, f);
  }
  /** As sprints que tem demanda, mais a atual e as proximas, em ordem. O
   *  rotulo sai sem o "● " do admin: aqui a cor da sprint vai num ponto. */
  function spOpcoesSprint(SPm, vivas, hoje, feriados) {
    var chave = function (r) { return r.slice(6, 10) + r.slice(3, 5) + r.slice(1, 2); };
    var set = {};
    vivas.forEach(function (m) { var s = SPm.doPO(m); if (s) set[s] = true; });
    SPm.proximasSprints(hoje, 5, feriados || []).forEach(function (x) { set[x.rotulo] = true; });
    return [{ key: '', label: 'Todas', n: vivas.length },
            { key: '__fora__', label: 'Sem sprint', n: vivas.filter(function (m) { return SPm.foraDaSprint(m); }).length }]
      .concat(Object.keys(set).sort(function (a, b) { return chave(a).localeCompare(chave(b)); }).map(function (r) {
        return { key: r, label: SPm.rotuloCurto(r), n: vivas.filter(function (m) { return SPm.naSprint(m, r); }).length };
      }));
  }

  /* O CONTROLE: um botao com cara de select e uma lista de caixas. As telas
     redesenham a cada escolha, entao o aberto/fechado mora aqui (`_fspAberto`)
     para a lista nao fechar no meio da escolha. Quem usa passa `aoMudar`, que
     recebe o valor novo (null ou lista) e redesenha a propria tela. */
  var _fspAberto = '';
  var _fsp = {};
  function cssFiltro() {
    if (typeof document === 'undefined' || document.getElementById('css-filtro-sprint')) return;
    var s = document.createElement('style');
    s.id = 'css-filtro-sprint';
    s.textContent = [
      '.axa .fsp{position:relative;display:inline-flex;min-width:0}',
      // .fsp .fsp-btn.in: vence o `background` das barras de filtro das telas (.bk-fil .in), que apagaria a seta.
      '.axa .fsp .fsp-btn.in{appearance:none;cursor:pointer;min-width:150px;max-width:240px;padding-right:34px;text-align:left;' +
        'background-image:linear-gradient(45deg,transparent 50%,var(--tx3) 50%),linear-gradient(135deg,var(--tx3) 50%,transparent 50%);' +
        'background-position:calc(100% - 18px) 50%,calc(100% - 13px) 50%;background-size:5px 5px;background-repeat:no-repeat}',
      '.axa .fsp-btn > span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
      '.axa .fsp.on .fsp-btn{border-color:rgba(var(--ac-rgb),.5)}',
      '.axa .fsp-pop{display:none;position:absolute;top:calc(100% + 6px);left:0;z-index:40;min-width:240px;max-height:340px;overflow-y:auto;' +
        'padding:6px;border-radius:12px;background:var(--sf3);border:1px solid var(--bd2);box-shadow:0 24px 60px var(--shadow);flex-direction:column;gap:2px}',
      '.axa .fsp.aberto .fsp-pop{display:flex}',
      '.axa .fsp-op{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:8px;font-size:13px;color:var(--tx);cursor:pointer;white-space:nowrap}',
      '.axa .fsp-op:hover{background:var(--sf4)}',
      '.axa .fsp-op input{accent-color:var(--ac);margin:0}',
      '.axa .fsp-op .n{margin-left:auto;padding-left:12px;font-family:var(--font-mono);font-size:11.5px;color:var(--tx3)}',
      '.axa .fsp-op.tod{font-weight:700;border-bottom:1px solid var(--bd);border-radius:8px 8px 0 0;margin-bottom:4px}'
    ].join('\n');
    document.head.appendChild(s);
  }
  /** O resumo no botao: "Todas (n)", ate tres rotulos, ou "N selecionadas". */
  function fspResumo(sel, opcoes) {
    var todas = opcoes.filter(function (o) { return o.key === ''; })[0];
    if (!sel.length) return todas ? todas.label + ' (' + todas.n + ')' : 'Todas';
    if (sel.length > 3) return sel.length + ' selecionadas';
    return sel.map(function (k) { var o = opcoes.filter(function (x) { return x.key === k; })[0]; return o ? o.label : curto(k); }).join(' + ');
  }
  function controleSprint(id, valor, opcoes, aoMudar, cls) {
    cssFiltro();
    var sel = spListaOuNulo(valor) || [];
    _fsp[id] = { sel: sel, aoMudar: aoMudar };
    var caixa = function (o, on, extra) {
      var cor = o.key && o.key !== '__fora__' && SP().corDaSprint ? SP().corDaSprint(o.key) : '';
      return '<label class="fsp-op' + (extra || '') + '"><input type="checkbox" data-fsp-k="' + esc(o.key) + '"' + (on ? ' checked' : '') + '>' +
        (cor ? '<span class="dotc" style="background:' + cor + '"></span>' : '') + esc(o.label) +
        (o.n == null ? '' : '<span class="n">' + o.n + '</span>') + '</label>';
    };
    var aberto = _fspAberto === id;
    return '<span class="fsp' + (aberto ? ' aberto' : '') + (sel.length ? ' on' : '') + '" data-fsp="' + esc(id) + '">' +
      '<button type="button" class="in fsp-btn' + (cls ? ' ' + cls : '') + '" data-fsp-abre="' + esc(id) + '" aria-haspopup="true" aria-expanded="' + aberto + '"' +
      ' aria-label="Sprint: ' + esc(fspResumo(sel, opcoes)) + '"><span>' + esc(fspResumo(sel, opcoes)) + '</span></button>' +
      '<span class="fsp-pop" role="group" aria-label="Sprints">' +
      caixa(opcoes.filter(function (o) { return o.key === ''; })[0] || { key: '', label: 'Todas' }, !sel.length, ' tod') +
      opcoes.filter(function (o) { return o.key !== ''; }).map(function (o) { return caixa(o, sel.indexOf(o.key) >= 0); }).join('') +
      '</span></span>';
  }
  function fspMarca(id) {
    _fspAberto = id || '';
    if (typeof document === 'undefined') return;
    Array.prototype.forEach.call(document.querySelectorAll('.fsp'), function (el) {
      var on = el.getAttribute('data-fsp') === _fspAberto;
      el.classList.toggle('aberto', on);
      var b = el.querySelector('.fsp-btn');
      if (b) b.setAttribute('aria-expanded', String(on));
    });
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function (e) {
      var ab = e.target.closest && e.target.closest('[data-fsp-abre]');
      if (ab) { e.preventDefault(); var id = ab.getAttribute('data-fsp-abre'); fspMarca(_fspAberto === id ? '' : id); return; }
      if (_fspAberto && !(e.target.closest && e.target.closest('.fsp'))) fspMarca('');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && _fspAberto) {
        var id = _fspAberto; fspMarca('');
        var b = document.querySelector('[data-fsp-abre="' + id + '"]');
        if (b) b.focus();
      }
    });
    document.addEventListener('change', function (e) {
      var cx = e.target.closest && e.target.closest('[data-fsp-k]');
      var box = cx && cx.closest('[data-fsp]');
      if (!box) return;
      var st = _fsp[box.getAttribute('data-fsp')];
      if (!st) return;
      var k = cx.getAttribute('data-fsp-k');
      var novo = !k ? null : (st.sel.indexOf(k) >= 0 ? st.sel.filter(function (x) { return x !== k; }) : st.sel.concat([k]));
      st.aoMudar(spListaOuNulo(novo));
    });
  }

  // ═══ ABA: ENTREGAS POR SPRINT (admin.html, 953e68c a 43706a7, 8f236cf, 3ca7514)
  /* "Crie uma nova aba, entregas por sprint. Ali quero a mesma logica [...],
      com temas e suas respectivas datas e com quem esta. Preciso que seja
      possivel escolher a sprint para ter o resultado."
     MORA EM SPRINTS, e nao em Paineis: a prancha de Sprints ja e a da sprint
     escolhida (entregue, por pessoa, escopo) e o seletor de sprint e dela;
     Paineis le periodo (30/90 dias, ano) e e da consulta. Aqui ficam os
     quatro cartoes do resumo (por QUANTIDADE de tasks, 04/11/2026), o que
     falta por pessoa e a lista por tema, com quem esta cada uma, a entrega ao
     usuario e o projeto.
     As contas sao recortes de `renderEntregasSprint` (admin.html) com a base
     por parametro; a suite roda as duas lado a lado. A base e a do app
     (`H.visiveis`, sem `oculto`); o admin conta tambem a demanda oculta. */
  /* ENTREGUE SO APOS O PM/PO, NA SPRINT DA PRIMEIRA IDA PARA VALIDACAO
     (admin.html, 3ca7514). "So conta entregue apos aprovacao PM/PO; para sprint
     deve considerar a partir do momento que o dev coloca em validacao da area
     ou validacao PM/PO." A regra e `SPRINTPO.situacaoNaSprint`, a mesma do
     placar: entregue = concluida com a 1a ida para validacao nesta sprint;
     aguardando = foi para validacao nesta sprint e o PM/PO ainda nao aprovou.
     A que foi para validacao numa sprint ANTERIOR e entrega de la e sai daqui.
     Sprint anterior a regra (`sprintNoRegimeDeEntrega`): a conta antiga, pela
     sprint marcada. Devolve 'entregue', 'aguardando', 'aberta', 'negada' ou
     null (fora desta sprint) — o `sitEs` do admin. */
  /* EM VALIDACAO CONTA COMO ENTREGA DA SPRINT (admin.html, fdf14e2, 06/11/2026):
     "a sprint conta por itens em aberto x entregues. A partir do momento que a
     demanda esta em validacao da area ou validacao PM/PO, deve contar como uma
     entrega da sprint." 10 itens, 5 fechados, 3 em validacao -> 8 entregues,
     80%. O cartao Entregues soma as fechadas e as em validacao, e o quinto
     cartao (Aguardando aprovacao) saiu. A devolvida para ajuste ja nao esta em
     validacao: volta a ser item em aberto (`situacaoNaSprint`, sprint.js). */
  function esSituacao(SPm, etapa, r, feriados) {
    var regra = !!(SPm.sprintNoRegimeDeEntrega && SPm.sprintNoRegimeDeEntrega(r, feriados));
    var sit = function (m) {
      var sk = etapa(m);
      if (sk === 'negada') return 'negada';
      if (!regra) return sk === 'concluido' ? 'entregue' : 'aberta';
      var s = SPm.situacaoNaSprint(m, r, sk, feriados);
      if (s === 'entregue' || s === 'aguardando') return s;
      if (s === 'em_curso') return 'aberta';
      return s === 'saiu' && SPm.naSprint(m, r) ? 'aberta' : null;
    };
    return { regra: regra, sit: sit };
  }
  /* A ESTEIRA (admin.html, fdf14e2): "Crie um filtro com Dados/BI, Sales OPs e
     desenvolvimento para sabermos o andamento por esteira." O `esteiraDe` do
     admin, com o PIPELINES e os perfis por parametro — a mesma separacao do
     filtro Times do painel do dev (`doMeuTime`): marcada Sales Ops (e nao
     Dados) e Sales Ops; marcada Dados/BI, ou de dev da frente de Dados, e
     Dados/BI; o resto — inclusive sem frente — e Desenvolvimento. */
  var ES_ESTEIRAS = [['dev', 'Desenvolvimento', 'laptop'], ['dados', 'Dados/BI', 'chart'], ['sales', 'Sales Ops', 'trend']];
  function esEsteiraDe(PI, perfis, m) {
    if (m && m.sales_ops && !m.dados_bi) return 'sales';
    if (m && m.dados_bi) return 'dados';
    if (PI && PI.FRENTE_DADOS && PI.daDemanda(m, perfis) === PI.FRENTE_DADOS) return 'dados';
    return 'dev';
  }
  /** O resumo da aba. `esteira` ('' = todas) recorta a sprint; `esteiraDe(m)`
   *  diz a esteira de cada demanda. O andamento por esteira e sempre sobre a
   *  sprint inteira, como no admin. */
  function esResumo(SPm, etapa, vivas, r, hoje, projetos, feriados, esteira, esteiraDe) {
    var S = esSituacao(SPm, etapa, r, feriados || []), sit = S.sit;
    var todas = vivas.filter(function (m) {
      if (!S.regra) return SPm.naSprint(m, r);
      var st = sit(m);
      return st === 'negada' ? SPm.naSprint(m, r) : !!st;
    });
    var deE = esteiraDe || function () { return 'dev'; };
    var esteiras = ES_ESTEIRAS.map(function (e) {
      var daqui = todas.filter(function (m) { return deE(m) === e[0]; });
      var l = daqui.filter(function (m) { return sit(m) !== 'negada'; });
      var agu = l.filter(function (m) { return sit(m) === 'aguardando'; }).length;
      var ent = l.filter(function (m) { return sit(m) === 'entregue'; }).length + agu;
      return { k: e[0], rot: e[1], ico: e[2], n: daqui.length, total: l.length, entregues: ent, aguardando: agu,
               pct: l.length ? Math.round(ent / l.length * 100) : 0 };
    });
    var ms = todas.filter(function (m) { return !esteira || deE(m) === esteira; });
    var aberta = function (m) { return sit(m) === 'aberta'; };
    var temDono = function (m) { return !!String(m.dev || '').trim(); };
    /* VENCIDA (admin.html, c11b681): em aberto com a Entrega dev (`entrega`, o
       prazo do dev, o mesmo do filtro "Vencidas" do Kanban) ou a entrega ao
       usuario antes de hoje. Na S1-11 a entrega ao usuario foi toda remarcada
       para novembro; o atraso real estava no prazo do dev. `diaVenc` = a data
       vencida mais antiga. */
    var ehDia = function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')); };
    var diaVenc = function (m) { return [m.entrega, m.entrega_usuario].filter(function (d) { return ehDia(d) && d < hoje; }).sort()[0] || ''; };
    var vencida = function (m) { return aberta(m) && !!diaVenc(m); };
    var negadas = ms.filter(function (m) { return etapa(m) === 'negada'; }).length;
    var fechadas = ms.filter(function (m) { return sit(m) === 'entregue'; });
    var aguardando = ms.filter(function (m) { return sit(m) === 'aguardando'; });
    var entregues = fechadas.concat(aguardando);
    var faltaCom = ms.filter(function (m) { return aberta(m) && temDono(m); });
    var faltaSem = ms.filter(function (m) { return aberta(m) && !temDono(m); });
    var validas = ms.length - negadas;
    // Resumo por QUANTIDADE de tasks, nao por pontos (pedido de 04/11/2026).
    var pctDe = function (n) { return validas ? Math.round(n / validas * 100) : 0; };
    var ps = projetos || [];
    var comProj = ms.filter(function (m) { return m.projeto_id && ps.some(function (p) { return p.id === m.projeto_id; }); }).length;
    // O que falta por pessoa — da que tem mais para a que tem menos.
    var porPessoa = {};
    faltaCom.forEach(function (m) { var k = String(m.dev).trim(); (porPessoa[k] = porPessoa[k] || []).push(m); });
    var pessoas = Object.keys(porPessoa).sort(function (a, b) { return porPessoa[b].length - porPessoa[a].length || a.localeCompare(b, 'pt-BR'); })
      .map(function (n) { return { nome: n, n: porPessoa[n].length, vencidas: porPessoa[n].filter(vencida).length }; });
    return { ms: ms, todas: todas, esteira: esteira || '', esteiras: esteiras, regra: S.regra, sit: sit, aberta: aberta, vencida: vencida,
             entregues: entregues, fechadas: fechadas, aguardando: aguardando, faltaCom: faltaCom, faltaSem: faltaSem, negadas: negadas, validas: validas,
             pctEntregues: pctDe(entregues.length),
             pctFaltaCom: pctDe(faltaCom.length), pctFaltaSem: pctDe(faltaSem.length),
             comProj: comProj, vencidas: ms.filter(vencida).length, vencCom: faltaCom.filter(vencida).length, pessoas: pessoas,
             diaVenc: diaVenc, ehDia: ehDia };
  }
  /* A PESSOA CLICADA (admin.html, 8f236cf): "ao clicar quero ver a quantidade
     por dev". O nome em "Faltando por pessoa" recorta a lista para as tasks
     dela na sprint (o `dev` inteiro, como o admin compara) e traz os numeros
     dela; clicar de novo volta a todos. Quem nao tem task nenhuma na sprint
     deixa de valer (''), mesmo sem nada faltando os numeros ainda dizem algo. */
  function esDaPessoa(x, nome) {
    var daPessoa = function (m) { return String(m.dev || '').trim() === nome; };
    if (!nome || !x.ms.some(daPessoa)) return null;
    var lp = x.ms.filter(daPessoa);
    // Em validacao conta como entregue (fdf14e2); o numero dela vem ao lado.
    var agu = lp.filter(function (m) { return x.sit(m) === 'aguardando'; }).length;
    var ent = lp.filter(function (m) { return x.sit(m) === 'entregue'; }).length + agu;
    var neg = lp.filter(function (m) { return x.sit(m) === 'negada'; }).length;
    var falta = lp.filter(x.aberta);
    var val = lp.length - neg;
    return { nome: nome, casa: daPessoa, total: lp.length, entregues: ent, aguardando: agu, negadas: neg,
             faltando: falta.length, vencidas: falta.filter(x.vencida).length,
             pontos: lp.reduce(function (t, m) { return t + (Number(m.poker_pontos) || 0); }, 0),
             pct: val ? Math.round(ent / val * 100) : null };
  }
  /** Grupos por tema em ordem alfabetica, "Sem tema" no fim; dentro do tema,
   *  pela entrega ao usuario (sem data no fim) e pelo titulo. */
  function esGrupos(lista, temas) {
    var grupos = {};
    lista.forEach(function (m) { var k = m.tema_id || '__sem_tema__'; (grupos[k] = grupos[k] || []).push(m); });
    var nomeTema = function (k) {
      if (k === '__sem_tema__') return 'Sem tema';
      var t = (temas || []).filter(function (x) { return x.id === k; })[0];
      return (t && t.nome) || '—';
    };
    var dataDe = function (m) { return m.entrega_usuario || '9999'; };
    return Object.keys(grupos).sort(function (a, b) {
      if (a === '__sem_tema__') return 1;
      if (b === '__sem_tema__') return -1;
      return nomeTema(a).localeCompare(nomeTema(b), 'pt-BR', { sensitivity: 'base' });
    }).map(function (k) {
      return { chave: k, nome: nomeTema(k), itens: grupos[k].slice().sort(function (a, b) {
        return dataDe(a).localeCompare(dataDe(b)) || (a.titulo || '').localeCompare(b.titulo || '');
      }) };
    });
  }
  /* O QUE FALTA, AGRUPADO PELO VENCIMENTO (admin.html, c11b681 e 93b6d4c): "ao
     clicar em faltando, eu quero que me traga os vencidos por dev [...] e logo
     abaixo ter a lista das demandas atrasadas por sprint" e, no ajuste, "Preciso
     ver o que falta da sprint e com quem esta". Com o cartao Faltando ativo a
     lista e TUDO o que falta (ou so as vencidas, pelo botao), agrupada assim: as
     vencidas pela sprint em que a data venceu (da mais antiga para a mais
     recente), depois "No prazo" e "Sem data de entrega". Dentro do grupo, pela
     data vencida (ou a Entrega dev, ou a entrega ao usuario) e pelo titulo. */
  function esGruposFalta(SPm, lista, x, feriados) {
    var grupos = {};
    var sprintVenc = function (m) { return SPm.sprintCorrente(x.diaVenc(m), feriados || []) || ''; };
    var chave = function (m) {
      return x.vencida(m) ? 'venc:' + sprintVenc(m) : (x.ehDia(m.entrega) || x.ehDia(m.entrega_usuario)) ? 'zprazo' : 'zsemdata';
    };
    lista.forEach(function (m) { var k = chave(m); (grupos[k] = grupos[k] || []).push(m); });
    var dm = function (d) { return d.slice(8, 10) + '/' + d.slice(5, 7); };
    var nome = function (k) {
      if (k === 'zprazo') return 'No prazo';
      if (k === 'zsemdata') return 'Sem data de entrega';
      var r = k.slice(5);
      var fx = r && SPm.faixaDaSprint ? SPm.faixaDaSprint(r, feriados || []) : null;
      return 'Venceu na ' + (SPm.rotuloCurto(r) || 'sprint ?') + (fx ? ' · ' + dm(fx.de) + ' a ' + dm(fx.ate) : '');
    };
    var primeiroDia = function (k) { return grupos[k].reduce(function (d, m) { return x.diaVenc(m) < d ? x.diaVenc(m) : d; }, '9999'); };
    var ordem = function (k) { return k.indexOf('venc:') === 0 ? primeiroDia(k) : k; };
    var dataDe = function (m) { return (x.diaVenc(m) || m.entrega || m.entrega_usuario) || '9999'; };
    return Object.keys(grupos).sort(function (a, b) { return ordem(a).localeCompare(ordem(b)); }).map(function (k) {
      return { chave: k, nome: nome(k), vencidas: k.indexOf('venc:') === 0, itens: grupos[k].slice().sort(function (a, b) {
        return dataDe(a).localeCompare(dataDe(b)) || (a.titulo || '').localeCompare(b.titulo || '');
      }) };
    });
  }
  /** A Entrega dev na lista do Faltando (o `devHTML` do admin, c11b681): a data
   *  e, se ja passou, ha quantos dias venceu. */
  function esEntregaDev(m, hoje) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(m.entrega || ''))) return null;
    var dias = Math.round((new Date(hoje + 'T00:00:00') - new Date(m.entrega + 'T00:00:00')) / 86400000);
    return { data: m.entrega, tag: dias > 0 ? ' (vencida há ' + dias + 'd)' : '', nivel: dias > 0 ? 'dg' : '' };
  }
  /** A entrega ao usuario e o aviso dela (o `dataHTML` do admin): vencida em
   *  vermelho, hoje e nos proximos sete dias em amarelo — so enquanto aberta. */
  function esEntregaUsuario(m, hoje, aberta) {
    if (!m.entrega_usuario) return { data: '', tag: '', nivel: '' };
    var tag = '', nivel = '';
    if (aberta) {
      var dias = Math.round((new Date(m.entrega_usuario + 'T00:00:00') - new Date(hoje + 'T00:00:00')) / 86400000);
      if (dias < 0) { nivel = 'dg'; tag = ' (vencida há ' + (-dias) + 'd)'; }
      else if (dias === 0) { nivel = 'wn'; tag = ' (vence hoje)'; }
      else if (dias <= 7) { nivel = 'wn'; tag = ' (em ' + dias + 'd)'; }
    }
    return { data: m.entrega_usuario, tag: tag, nivel: nivel };
  }

  /** "Com: Fulano · Entrega usuario: 10/11/2026 (em 5d)" — a linha do
   *  "com quem esta" da lista de Melhorias do admin (372b92f). O Backlog
   *  usa a mesma. `abertaJa` (opcional) vem da aba Entregas: la a que esta
   *  aguardando o PM/PO ja saiu da mao do dev e nao acende vencida. */
  function comQuemHtml(m, abertaJa, comEntregaDev) {
    var k = H.colunaDe(m);
    var aberta = typeof abertaJa === 'boolean' ? abertaJa : k !== 'concluido' && k !== 'negada';
    var eu = esEntregaUsuario(m, H.hoje(), aberta);
    var cor = eu.nivel === 'dg' ? 'var(--dg-t)' : eu.nivel === 'wn' ? 'var(--wn-t)' : '';
    // No Faltando das Entregas a Entrega dev vem antes (c11b681): e nela que o atraso aparece.
    var ed = comEntregaDev ? esEntregaDev(m, H.hoje()) : null;
    return (m.dev ? 'Com: <b>' + esc(m.dev) + '</b>' : '<span style="color:var(--tx4)">Sem responsável</span>') + ' · ' +
      (ed ? '<span' + (ed.nivel ? ' style="color:var(--dg-t);font-weight:600"' : '') + '>Entrega dev: ' + esc(H.dma(ed.data) + ed.tag) + '</span> · ' : '') +
      (eu.data ? '<span' + (cor ? ' style="color:' + cor + ';font-weight:600"' : '') + '>Entrega usuário: ' + esc(H.dma(eu.data) + eu.tag) + '</span>'
               : '<span style="color:var(--tx4)">Entrega usuário: a definir</span>');
  }

  // `soVenc`: o botao "So vencidas" dentro do Faltando (93b6d4c); fora dele, desliga.
  var _ent = { filtro: 'todas', pessoa: '', esteira: '', soVenc: false };

  function abaEntregas(el, ctx) {
    var D = ctx.D;
    var vivas = H.visiveis();
    var ops = spOpcoesSprint(SP(), vivas, H.hoje(), fer(D)).filter(function (o) { return o.key && o.key !== '__fora__'; });
    var agora = H.sprintAtual();
    var p = String(ctx.param || '').toUpperCase();
    var r = ops.some(function (o) { return o.key === p; }) ? p : (ops.some(function (o) { return o.key === agora; }) ? agora : (ops[0] ? ops[0].key : ''));
    var opcoes = ops.map(function (o) {
      return '<option value="' + esc(o.key) + '"' + (o.key === r ? ' selected' : '') + '>' + esc(o.label + (o.key === agora ? ' (atual)' : '') + ' · ' + o.n) + '</option>';
    }).join('');
    var PI = raiz.PIPELINES;
    var x = esResumo(SP(), H.colunaDe, vivas, r, H.hoje(), D.projetos || [], fer(D), _ent.esteira,
      function (m) { return esEsteiraDe(PI, D.devs_perfil, m); });
    var pes = esDaPessoa(x, _ent.pessoa);
    if (!pes) _ent.pessoa = '';
    // O cartao "Aguardando aprovacao" saiu: em validacao ja esta em Entregues (fdf14e2).
    if (_ent.filtro === 'aguardando') _ent.filtro = 'todas';
    var f = r ? SP().faixaDaSprint(r, fer(D)) : null;

    var h = '<header class="sp-hd"><div class="tt"><div class="row" style="gap:10px">' +
      '<h1 class="h1">Entregas da sprint ' + esc(r ? curto(r) : '') + '</h1>' + (r ? chipsSituacao(D, r) : '') + '</div>' +
      '<span class="sub">' + (f ? esc(txtFaixa(f)) + ' · ' : '') + 'As demandas da sprint por tema, com quem está cada uma, a entrega ao usuário e o projeto de que fazem parte.' +
      (x.vencidas ? ' <b style="color:var(--dg-t)">' + plural(x.vencidas, 'com entrega vencida', 'com entrega vencida') + '.</b>' : '') + '</span></div>' +
      '<div class="ac"><select class="sp-sel" id="sp-sel-est" aria-label="Esteira"><option value="">Todas as esteiras (' + x.todas.length + ')</option>' +
      x.esteiras.map(function (e) {
        return '<option value="' + e.k + '"' + (_ent.esteira === e.k ? ' selected' : '') + '>' + esc(e.rot) + ' (' + e.n + ')</option>';
      }).join('') + '</select>' +
      '<select class="sp-sel" id="sp-sel-es" aria-label="Sprint">' + opcoes + '</select></div></header>';

    if (!x.todas.length) {
      el.innerHTML = h + '<section class="sp-pn">' + H.vazio('inbox', 'Nenhuma demanda nesta sprint', 'O PM/PO repassa as demandas para a sprint pelo Quadro ou pelo Planejamento.') + '</section>';
      return;
    }
    // O andamento por esteira (fdf14e2): sempre sobre a sprint inteira; clicar filtra, como o seletor.
    h += '<div class="es-pes"><span class="lab">ANDAMENTO POR ESTEIRA</span>' + x.esteiras.map(function (e) {
      var on = _ent.esteira === e.k;
      return '<button type="button" class="chip c-' + (e.total && e.entregues === e.total ? 'ok' : 'bk') + ' es-pn' + (on ? ' on' : '') + '" data-es-esteira="' + e.k + '" aria-pressed="' + on + '"' +
        ' title="' + (on ? 'Clique de novo para ver todas as esteiras' : 'Clique para ver só esta esteira') + '">' + ico(e.ico) + ' ' + esc(e.rot) +
        ' <b>' + e.entregues + '/' + e.total + '</b> entregues · ' + e.pct + '%' + (e.aguardando ? ' (' + e.aguardando + ' em validação)' : '') + '</button>';
    }).join('') + '</div>';
    if (!x.ms.length) {
      el.innerHTML = h + '<section class="sp-pn">' + H.vazio('inbox', 'Nenhuma demanda desta esteira na sprint', 'Clique na esteira de novo para ver a sprint inteira.') + '</section>';
      return;
    }
    var cartao = function (k, v, rot, sub, cor, borda, extra) {
      var on = _ent.filtro === k;
      return '<button type="button" class="sp-k es-k' + (borda ? ' x-' + borda : '') + (on ? ' on' : '') + '" data-es-filtro="' + k + '" aria-pressed="' + on + '"' +
        ' title="' + (on ? 'Clique de novo para ver tudo' : 'Clique para filtrar a lista') + '">' +
        '<span class="l">' + rot + '</span><span class="v"' + (cor ? ' style="color:' + cor + '"' : '') + '>' + v + '</span>' +
        '<span class="s">' + sub + '</span>' + (extra || '') + '</button>';
    };
    // Entregues = fechadas + em validacao (fdf14e2); o quinto cartao saiu.
    h += '<div class="sp-k4">' +
      cartao('todas', x.ms.length, 'Na sprint', plural(x.ms.length, 'task', 'tasks') + (x.negadas ? ' · ' + plural(x.negadas, 'negada', 'negadas') : '') + ' · ' + x.comProj + ' em projeto') +
      cartao('entregues', x.entregues.length, 'Entregues', plural(x.fechadas.length, 'fechada', 'fechadas') + ' + ' + x.aguardando.length + ' em validação · ' + x.pctEntregues + '% da sprint', 'var(--ok-t)', 'ok',
        '<span class="sp-bar"><i style="width:' + x.pctEntregues + '%;background:var(--ok)"></i></span>') +
      cartao('falta_com', x.faltaCom.length, 'Faltando · com responsável', x.pctFaltaCom + '% das tasks' +
        (x.vencCom ? ' · <b style="color:var(--dg-t)">' + plural(x.vencCom, 'com entrega vencida', 'com entrega vencida') + '</b>' : ''),
        x.faltaCom.length ? 'var(--wn-t)' : '', x.faltaCom.length ? 'wn' : '') +
      cartao('falta_sem', x.faltaSem.length, 'Faltando · sem responsável', x.faltaSem.length ? x.pctFaltaSem + '% das tasks · precisam de dono' : 'todas têm dono',
        x.faltaSem.length ? 'var(--dg-t)' : 'var(--ok-t)', x.faltaSem.length ? 'dg' : '') +
      '</div>';
    /* Com o Faltando ativo (c11b681 e 93b6d4c) a linha diz com quem esta o que
       falta, as vencidas de cada um em vermelho, e traz o botao "So vencidas". */
    var modoFalta = _ent.filtro === 'falta_com';
    if (!modoFalta) _ent.soVenc = false;
    if (modoFalta) {
      h += '<div class="es-pes"><span class="lab">FALTANDO COM</span>' + x.pessoas.map(function (pp) {
        var on = _ent.pessoa === pp.nome;
        return '<button type="button" class="chip c-' + (pp.vencidas ? 'dg' : 'bk') + ' es-pn' + (on ? ' on' : '') + '" data-es-pessoa="' + esc(pp.nome) + '" aria-pressed="' + on + '"' +
          ' title="' + esc(on ? 'Clique de novo para ver todos' : 'Clique para ver o que falta com ' + pp.nome) + '">' +
          esc(pp.nome) + ' <b>' + pp.n + '</b>' + (pp.vencidas ? ' · <span style="color:var(--dg-t)">' + plural(pp.vencidas, 'vencida', 'vencidas') + '</span>' : '') + '</button>';
      }).join('') +
        (x.vencCom ? '<button type="button" class="chip c-dg es-pn' + (_ent.soVenc ? ' on' : '') + '" data-es-sovenc="1" aria-pressed="' + _ent.soVenc + '"' +
          ' style="margin-left:auto" title="Mostrar só as que têm entrega vencida">' + ico('clock') + ' Só vencidas (' + x.vencCom + ')</button>' : '') + '</div>';
    } else if (x.pessoas.length) {
      // O nome e um botao: mostra as tasks e os numeros da pessoa (8f236cf).
      h += '<div class="es-pes"><span class="lab">FALTANDO POR PESSOA</span>' + x.pessoas.map(function (pp) {
        var on = _ent.pessoa === pp.nome;
        return '<button type="button" class="chip c-' + (pp.vencidas ? 'dg' : 'bk') + ' es-pn' + (on ? ' on' : '') + '" data-es-pessoa="' + esc(pp.nome) + '" aria-pressed="' + on + '"' +
          ' title="' + esc((on ? 'Clique de novo para ver todos' : 'Clique para ver as tasks de ' + pp.nome) + (pp.vencidas ? ' · ' + pp.vencidas + ' com entrega vencida' : '')) + '">' +
          esc(pp.nome) + ' <b>' + pp.n + '</b>' + (pp.vencidas ? ' · ' + plural(pp.vencidas, 'vencida', 'vencidas') : '') + '</button>';
      }).join('') + '</div>';
    }
    if (pes) {
      h += '<div class="es-pr" role="status"><span class="row" style="gap:6px">' + ico('user') + ' <b>' + esc(pes.nome) + '</b></span>' +
        '<span><b>' + pes.total + '</b> na sprint</span>' +
        '<span style="color:var(--ok-t)"><b>' + pes.entregues + '</b> ' + (pes.entregues === 1 ? 'entregue' : 'entregues') + (pes.pct != null ? ' · ' + pes.pct + '%' : '') + '</span>' +
        (pes.aguardando ? '<span style="color:var(--in-t)">(' + pes.aguardando + ' em validação)</span>' : '') +
        '<span style="color:var(--wn-t)"><b>' + pes.faltando + '</b> faltando</span>' +
        (pes.vencidas ? '<span style="color:var(--dg-t)"><b>' + pes.vencidas + '</b> com entrega vencida</span>' : '') +
        (pes.negadas ? '<span>' + plural(pes.negadas, 'negada', 'negadas') + '</span>' : '') +
        '<span>' + pes.pontos + ' pts</span>' +
        '<button type="button" class="btns" data-es-pessoa="" style="margin-left:auto;height:28px">Ver todos</button></div>';
    }

    var lista = (_ent.filtro === 'entregues' ? x.entregues
      : _ent.filtro === 'falta_com' ? x.faltaCom.filter(function (m) { return !_ent.soVenc || x.vencida(m); })
      : _ent.filtro === 'falta_sem' ? x.faltaSem : x.ms).filter(function (m) { return !pes || pes.casa(m); });
    // Com "So vencidas": quantas ainda estao no prazo (ou sem data) e ficaram fora.
    var noPrazo = modoFalta && _ent.soVenc ? x.faltaCom.filter(function (m) { return !x.vencida(m) && (!pes || pes.casa(m)); }).length : 0;
    var notaPrazo = noPrazo ? '<span class="note" style="font-size:12.5px">+ ' + noPrazo + ' faltando ainda no prazo ou sem data de entrega — ' +
      '<button type="button" class="btns" data-es-sovenc="1" style="height:26px">ver tudo o que falta</button></span>' : '';
    var ROT = { todas: 'tudo', entregues: 'só as entregues (fechadas e em validação)',
                falta_com: _ent.soVenc ? 'só o que falta com responsável e venceu' : 'só o que falta com responsável', falta_sem: 'só o que falta sem responsável' };
    var recorte = (_ent.filtro === 'todas' ? '' : ROT[_ent.filtro]) + (pes ? (_ent.filtro === 'todas' ? 'as tasks' : ',') + ' de ' + pes.nome : '');
    h += '<section class="sp-pn" style="gap:6px"><div class="hh"><h2 class="h2">' + (modoFalta ? 'Pelo vencimento' : 'Por tema') +
      ' <span class="note" style="font-family:var(--font-ui);font-weight:600">· ' + lista.length + '</span></h2>' +
      '<span class="note" style="font-size:12.5px">' + (!recorte ? 'Clique num cartão ou num nome para filtrar a lista.' :
        'Mostrando ' + esc(recorte) + '. <button type="button" class="btns" data-es-filtro="todas" data-es-pessoa="" style="height:26px;margin-left:6px">Ver tudo</button>') + '</span></div>';
    if (!lista.length) {
      h += modoFalta ? H.vazio('check', 'Nenhuma demanda com entrega vencida', 'O que ainda falta está no prazo ou sem data.')
                     : H.vazio('inbox', 'Nada nesta situação', 'Clique no cartão de novo para ver a sprint inteira.');
    } else {
      h += (modoFalta ? esGruposFalta(SP(), lista, x, fer(D)) : esGrupos(lista, D.temas || [])).map(function (g) {
        return '<div class="es-gh"><span class="lab"' + (g.vencidas ? ' style="color:var(--dg-t)"' : '') + '>' + esc(String(g.nome).toUpperCase()) + '</span><span class="n">' + g.itens.length + '</span></div>' +
          g.itens.map(function (m) {
            var k = H.colunaDe(m);
            var pj = m.projeto_id ? H.projeto(m.projeto_id) : null;
            var chips = [H.chipEtapa(m)];
            if (m.poker_pontos != null) chips.push(H.chip(ico('cards') + ' ' + esc(m.poker_pontos), 'in', 'Pontos do Planning Poker'));
            if (pj) chips.push(H.chip(ico('folder') + ' ' + esc((pj.codigo ? pj.codigo + ' · ' : '') + (pj.nome || '')), 'pu', 'Faz parte do projeto ' + (pj.nome || '')));
            var fim = k === 'concluido' && m.concluido_em ? ' · Concluída em ' + esc(H.dma(String(m.concluido_em).slice(0, 10))) : '';
            return '<a class="es-ln" href="' + H.hrefItem(m) + '"><span class="cd">' + esc(m.codigo || '—') + '</span>' +
              '<span class="ti"><b>' + esc(m.titulo || '') + '</b><span>' + comQuemHtml(m, x.aberta(m), modoFalta) + fim + '</span></span>' +
              '<span class="x">' + chips.join('') + '</span></a>';
          }).join('');
      }).join('');
    }
    h += notaPrazo + '</section>';
    el.innerHTML = h;
  }

  /* O que as outras telas leem daqui: o filtro de sprint (Quadro, Backlog) e
     a linha "com quem esta" (Backlog). */
  raiz.AXIS_SPRINTS = {
    opcoes: function (lista) { return spOpcoesSprint(SP(), lista || H.visiveis(), H.hoje(), fer(AX.APP.D)); },
    casa: function (m, f) { return spCasaSprint(SP(), m, f); },
    listaOuNulo: spListaOuNulo,
    controle: controleSprint,
    comQuem: comQuemHtml,
    entregaUsuario: esEntregaUsuario
  };

  // ═══ O CICLO DA SPRINT: INICIAR, REPASSAR EM LOTE E FECHAR ═════════════
  /* Os tres gestos que levavam ao admin.html. A REGRA E A DO sprint.js
     (`iniciar`, `repassar`, `fechar`), a mesma que o admin chama; o que muda
     e como o resultado chega ao servidor.

     O ADMIN MUTA O `state` E PUBLICA TUDO. Aqui o ato roda numa COPIA da base
     FRESCA do servidor (lida logo antes, como as ausencias do Planejamento) e
     vira patch: os campos que mudaram em cada demanda e, na raiz, a lista
     `sprints` inteira (o registro de inicio e de fechamento). `H.gravar` rele
     a base e aplica os dois por cima; a janela que sobra e a de uma leitura.

     SO O DONO DA SPRINT (`SPRINTPO.ehDonoDaSprint`, por conta). O Worker
     devolve a lista `sprints` do servidor e reverte `sprint_po` e
     `sprint_prioritaria` de quem nao e (`travaSprintDoPO`), e recusa mexer em
     sprint fechada (`mexeuEmSprintFechada`, `fechamentoApagado`).

     As funcoes `ciclo*` e `lote*` sao puras, com o modulo e a base por
     parametro: a suite as executa ao lado de `sprintIniciar`,
     `sprintLoteCandidatas`, `sprintLoteAplicar`, `sprintFecharAbrir` e
     `sprintFecharAplicar` (admin.html). */

  /** O que o ato le e escreve: as demandas, o registro das sprints e os feriados. */
  function cicloCopia(base) {
    var b = base || {};
    return { melhorias: JSON.parse(JSON.stringify(b.melhorias || [])),
             sprints: Array.isArray(b.sprints) ? JSON.parse(JSON.stringify(b.sprints)) : [],
             feriados: b.feriados || [] };
  }
  /** O patch do ato: em cada demanda, so os campos que ficaram diferentes. */
  function cicloPatch(antes, depois) {
    var porId = {};
    (antes || []).forEach(function (m) { if (m && m.id) porId[m.id] = m; });
    var patch = {};
    (depois || []).forEach(function (m) {
      var a = m && porId[m.id];
      if (!a) return;
      var p = {}, mudou = false;
      Object.keys(Object.assign({}, a, m)).forEach(function (k) {
        if (JSON.stringify(a[k]) !== JSON.stringify(m[k])) { p[k] = m[k]; mudou = true; }
      });
      if (mudou) patch[m.id] = p;
    });
    return patch;
  }
  /** A pergunta antes de iniciar (`sprintIniciar`): quantas vao, quantas
   *  estao sem dono, e as vencidas e pausadas que o inicio puxa. */
  function cicloTextoIniciar(SPm, D, r, hoje, opts) {
    var dem = SPm.demandasDaSprint(D, r);
    var semDev = dem.filter(function (m) { return !String(m.dev || '').trim(); });
    var venc = SPm.vencidasParaPriorizar(D, r, hoje, opts);
    var vencIds = {};
    venc.forEach(function (m) { vencIds[m.id] = true; });
    var paus = SPm.pausadasParaTransbordar(D, r, opts).filter(function (m) { return !vencIds[m.id]; });
    var cods = function (l) { return l.map(function (m) { return m.codigo || m.id; }).join(', '); };
    return {
      titulo: 'Iniciar ' + SPm.rotuloCurto(r) + '?',
      texto: dem.length + (dem.length === 1 ? ' demanda passa' : ' demandas passam') + ' a aparecer no painel do time.' +
        (semDev.length
          ? '\n\n' + semDev.length + (semDev.length === 1 ? ' está' : ' estão') + ' sem dono (' + cods(semDev) + ') e ' +
            (semDev.length === 1 ? 'vai aparecer' : 'vão aparecer') + ' no backlog de todos os devs, para quem pegar primeiro.'
          : '\n\nTodas já têm dev alocado.') +
        (venc.length
          ? '\n\n' + venc.length + (venc.length === 1 ? ' demanda alocada está vencida e entra' : ' demandas alocadas estão vencidas e entram') +
            ' nesta sprint como prioritária (prioridade Alta): ' + cods(venc) + '.'
          : '') +
        (paus.length
          ? '\n\n' + paus.length + (paus.length === 1 ? ' demanda pausada transborda' : ' demandas pausadas transbordam') +
            ' para esta sprint (continuam pausadas): ' + cods(paus) + '.'
          : '')
    };
  }
  /** INICIAR (`SPRINTPO.iniciar`): o registro ganha `iniciada_em`, e as
   *  vencidas e pausadas entram na sprint. */
  function cicloIniciar(SPm, base, r, quem, hoje, opts) {
    var D = cicloCopia(base);
    var res = SPm.iniciar(D, r, quem, hoje, opts);
    if (!res.ok) return res;
    var n = res.prioritarias.length, np = res.pausadas.length;
    return { ok: true, res: res, patch: cicloPatch((base || {}).melhorias, D.melhorias), raiz: { sprints: D.sprints },
             msg: SPm.rotuloCurto(r) + ' em curso · ' + res.demandas + (res.demandas === 1 ? ' demanda liberada' : ' demandas liberadas') +
               (res.semDev ? ', ' + res.semDev + ' sem dono no backlog do time' : '') +
               (n ? ', ' + n + ' vencida' + (n === 1 ? ' entrou' : 's entraram') + ' como prioritária' + (n === 1 ? '' : 's') : '') +
               (np ? ', ' + np + ' pausada' + (np === 1 ? ' transbordou' : 's transbordaram') : '') + '.' };
  }
  /** REPASSAR EM LOTE (`sprintLoteAplicar`): `repassar` em cada uma. A que
   *  ja estava na sprint (ou o modulo recusa) sai da conta e o lote segue. */
  function cicloRepassar(SPm, base, ids, alvo, quem, hoje) {
    var s = String(alvo || '');
    if (!SPm.rotuloValido(s)) return { ok: false, erro: 'Escolha uma sprint.' };
    var D = cicloCopia(base);
    var mexidas = [], recusadas = [];
    (ids || []).forEach(function (id) {
      var m = D.melhorias.filter(function (x) { return String(x.id) === String(id); })[0];
      if (!m) return;
      var r = SPm.repassar(m, s, quem, hoje, { dados: D });
      if (!r.ok) { recusadas.push(m.codigo || m.id); return; }
      mexidas.push({ id: m.id, atrasada: r.entrouAtrasada });
    });
    if (!mexidas.length) return { ok: false, erro: recusadas.length ? 'Nada a repassar: já estavam nesta sprint.' : 'Nada a repassar.' };
    var n = mexidas.length, nAtr = mexidas.filter(function (x) { return x.atrasada; }).length;
    return { ok: true, n: n, atrasadas: nAtr, recusadas: recusadas, patch: cicloPatch((base || {}).melhorias, D.melhorias),
             msg: n + (n > 1 ? ' repassadas' : ' repassada') + ' para ' + SPm.rotuloCurto(s) +
               (nAtr ? ' — ' + nAtr + (nAtr > 1 ? ' entraram atrasadas' : ' entrou atrasada') : '') +
               (recusadas.length ? ' · ' + recusadas.length + (recusadas.length > 1 ? ' já estavam nela' : ' já estava nela') : '') + '.' };
  }
  /** As decisoes com que o fechamento abre (`sprintFecharAbrir`): a PAUSADA
   *  ja vem com destino na sprint seguinte e a pausa como motivo. */
  function cicloDecisoesIniciais(SPm, D, r, etapaDe, pausada) {
    var seg = SPm.sprintSeguinte(r, (D || {}).feriados || []);
    var dec = {};
    SPm.balancoDaSprint(D, r, etapaDe).pendentes.filter(pausada).forEach(function (m) {
      dec[m.id] = { destino: seg, motivo: ('Pausada' + (m.pausa_motivo ? ': ' + m.pausa_motivo : ' aguardando terceiro')).slice(0, 300) };
    });
    return dec;
  }
  /** Quantas pendentes ainda estao sem motivo valido (`sprintFecharAtualizaBotao`). */
  function cicloFaltam(SPm, D, r, etapaDe, dec) {
    return SPm.balancoDaSprint(D, r, etapaDe).pendentes.filter(function (m) {
      return SPm.problemaNoMotivoCarry(((dec || {})[m.id] || {}).motivo);
    }).length;
  }
  /** FECHAR (`SPRINTPO.fechar`): destino e motivo de cada pendente, e o
   *  registro ganha `em`, `por` e `carry`. Sem volta. */
  function cicloFechar(SPm, base, r, quem, hoje, decisoes, etapaDe) {
    var D = cicloCopia(base);
    var res = SPm.fechar(D, r, quem, hoje, decisoes, etapaDe);
    if (!res.ok) return res;
    return { ok: true, res: res, patch: cicloPatch((base || {}).melhorias, D.melhorias), raiz: { sprints: D.sprints },
             msg: SPm.rotuloCurto(r) + ' fechada · ' + res.entregues + ' entregue' + (res.entregues === 1 ? '' : 's') +
               (res.aguardando ? ', ' + res.aguardando + ' aguardando você' : '') +
               (res.fechados ? ', ' + res.fechados + ' com destino novo' : '') + '.' };
  }

  /* OS GRUPOS DO LOTE (`LOTE_GRUPOS`, admin.html, 30/10/2026). "Atrasadas da
     sprint atual" pergunta a etapa EFETIVA, que e o que o comentario de la
     descreve: o admin pergunta a `statusKey`, que virou `ETAPA.gravada` e
     nunca responde `atrasado` — o grupo dele fica sempre vazio. */
  function loteGrupos(SPm, gravada, efetiva, pausada, hoje, feriados) {
    return [
      { k: 'planning', rot: 'Pontuadas em Planning', ico: 'cards',
        casa: function (m) { return gravada(m) === 'planning' && SPm.pontosDe(m) > 0; } },
      { k: 'atrasadas', rot: 'Atrasadas da sprint atual', ico: 'clock',
        casa: function (m) { return SPm.naSprint(m, SPm.rotuloDeData(hoje, feriados || [])) && efetiva(m) === 'atrasado'; } },
      { k: 'pausadas', rot: 'Pausadas', ico: 'pause', casa: function (m) { return pausada(m); } }
    ];
  }
  /** As candidatas do lote (`sprintLoteCandidatas`): tudo em aberto. Com
   *  grupo marcado, o grupo manda; sem, vale o "so fora de sprint". `f` =
   *  { q, soFora, grupos: { k: true } }; `o` = { SPm, ETAPAm, ORDEMKBm,
   *  dataUsu, hoje, grupos }. */
  function loteCandidatas(lista, f, o) {
    var q = String(f.q || '').trim().toLowerCase();
    var marcados = Object.keys(f.grupos || {}).filter(function (k) { return f.grupos[k]; });
    var abertas = (lista || []).filter(function (m) {
      if (!m || m.oculto || m.mesclado_em) return false;
      if (!o.ETAPAm.aberta(m, o.hoje)) return false;
      if (marcados.length) {
        if (!o.grupos.some(function (g) { return marcados.indexOf(g.k) >= 0 && g.casa(m); })) return false;
      } else if (f.soFora && o.SPm.doPO(m)) return false;
      if (!q) return true;
      return (String(m.codigo || '') + ' ' + String(m.titulo || '') + ' ' + String(m.dev || '')).toLowerCase().indexOf(q) >= 0;
    });
    return o.ORDEMKBm ? o.ORDEMKBm.ordena(abertas, o.dataUsu) : abertas;
  }

  // ── O ciclo na tela ──────────────────────────────────────────────────
  function quemGrava() { var e = AX.APP.eu; return (e && (e.nome || e.login)) || 'PM/PO'; }
  function optsIniciar() { return { prazo: raiz.PRAZO, etapaDe: H.colunaDe }; }
  function botaoIniciar(r) {
    return '<button type="button" class="btnp" data-sp-ciclo="iniciar" data-r="' + esc(r) + '" title="O time passa a ver as demandas desta sprint">' +
      ico('rocket') + ' Iniciar sprint</button>';
  }
  /** A base FRESCA do servidor, para o ato rodar sobre ela. */
  async function baseFresca() {
    try { return await H.api('dados'); }
    catch (e) { H.toast(e.status === 401 ? 'Sessão expirada — saia e entre de novo.' : 'Sem conexão com o servidor: ' + (e.message || e), 'erro'); return null; }
  }
  function caixa(o) {
    if (raiz.AXIS_ACOES && raiz.AXIS_ACOES.caixa) return raiz.AXIS_ACOES.caixa(o);
    return Promise.resolve(raiz.confirm && raiz.confirm(o.titulo + '\n\n' + (o.texto || '')) ? {} : null);
  }
  function avisa(r) { if (r && r.ok && raiz.AXIS_ACOES && raiz.AXIS_ACOES.avisaRevertidos) raiz.AXIS_ACOES.avisaRevertidos(r); }

  /* INICIAR (`sprintIniciar`): CONFIRMA ANTES, dizendo quantas vao e quantas
     estao sem dono — e o momento em que o PO descobre que esqueceu de alocar. */
  async function iniciarSprint(r) {
    if (!H.donoDaSprint()) { H.toast('Só a área de produto inicia a sprint.', 'erro'); return; }
    var t = cicloTextoIniciar(SP(), AX.APP.D, r, H.hoje(), optsIniciar());
    if (!(await caixa({ titulo: t.titulo, texto: t.texto, ok: 'Iniciar' }))) return;
    var base = await baseFresca();
    if (!base) return;
    var c = cicloIniciar(SP(), base, r, quemGrava(), H.hoje(), optsIniciar());
    if (!c.ok) { H.toast(c.erro, 'erro'); return; }
    avisa(await H.gravar(c.patch, { raiz: c.raiz, ok: c.msg }));
  }

  /* FECHAR. As decisoes vivem aqui enquanto a aba Encerrar esta aberta (o
     `_fechDecisoes` do admin): digitar o motivo nao redesenha a lista, so o
     botao, para o foco nao sair do campo na primeira letra. */
  var _fech = {};
  function fechDecisoes(D, r) {
    if (!_fech[r]) _fech[r] = cicloDecisoesIniciais(SP(), D, r, H.colunaDe, H.pausada);
    return _fech[r];
  }
  function fechFaltam(D, r) { return cicloFaltam(SP(), D, r, H.colunaDe, fechDecisoes(D, r)); }
  function rotuloFechar(falta) { return falta ? 'Faltam ' + falta + ' motivo' + (falta > 1 ? 's' : '') : 'Fechar sprint'; }
  function fechAtualizaBotao(el, r) {
    var falta = fechFaltam(AX.APP.D, r);
    var b = el.querySelector('[data-sp-ciclo="fechar"][data-r="' + r + '"]');
    if (!b) return;
    b.disabled = falta > 0;
    var t = b.querySelector('[data-fech-rot]');
    if (t) t.textContent = rotuloFechar(falta);
  }
  async function fecharSprint(r) {
    if (!H.donoDaSprint()) { H.toast('Só a área de produto fecha a sprint.', 'erro'); return; }
    var D = AX.APP.D, dec = fechDecisoes(D, r);
    var bal = SP().balancoDaSprint(D, r, H.colunaDe);
    var pts = function (l) { return l.reduce(function (t, m) { return t + (Number(m.poker_pontos) || 0); }, 0); };
    var nVolta = bal.pendentes.filter(function (m) { return !(dec[m.id] || {}).destino; }).length;
    var ok = await caixa({
      titulo: 'Fechar ' + curto(r) + '?', ok: 'Fechar sprint', perigo: true,
      texto: 'Fechada, a sprint não aceita mais entrada nem saída — e não há como reabrir.\n\n' +
        plural(bal.entregues.length, 'entregue', 'entregues') + ' · ' + pts(bal.entregues) + ' pts' +
        (bal.aguardando.length ? '\n' + bal.aguardando.length + ' aguardando você · ' + pts(bal.aguardando) + ' pts (contam nesta sprint ao validar)' : '') +
        (bal.pendentes.length ? '\n' + plural(bal.pendentes.length, 'não entregue', 'não entregues') + ' · ' + pts(bal.pendentes) + ' pts: ' +
          (bal.pendentes.length - nVolta) + ' para outra sprint, ' + nVolta + ' de volta ao backlog' : '')
    });
    if (!ok) return;
    var base = await baseFresca();
    if (!base) return;
    var c = cicloFechar(SP(), base, r, quemGrava(), H.hoje(), dec, H.colunaDe);
    if (!c.ok) { H.toast(c.erro, 'erro'); return; }
    var out = await H.gravar(c.patch, { raiz: c.raiz, ok: c.msg });
    if (out && out.ok) delete _fech[r];
    avisa(out);
  }

  /* REPASSAR EM LOTE (`sprintLoteAbrir`). A SELECAO SOBREVIVE AO FILTRO:
     marcar dez, digitar na busca e perder as dez seria o jeito mais rapido de
     desistir do lote. O contador diz o total marcado, inclusive o escondido. */
  function abrirLote(rPadrao) {
    if (!H.donoDaSprint()) { H.toast('Só a área de produto repassa demandas para a sprint.', 'erro'); return; }
    var D = AX.APP.D, F = fer(D);
    var ops = SP().proximasSprints(H.hoje(), 5, F, SP().rotulosFechados(D));
    var agora = H.sprintAtual();
    var tem = function (x) { return ops.some(function (o) { return o.rotulo === x; }); };
    var st = { sel: {}, q: '', soFora: true, grupos: {} };
    var ov = document.createElement('div');
    ov.className = 'ovl';
    ov.innerHTML = '<div class="dlg sp-lt" role="dialog" aria-modal="true" aria-labelledby="sp-lt-t">' +
      '<button type="button" class="dlg-x" data-lt="fechar" aria-label="Fechar">' + ico('x') + '</button>' +
      '<h2 class="sp-lt-t" id="sp-lt-t">Repassar para a sprint</h2>' +
      '<span class="sub">Escolha a sprint e marque as demandas. Uma gravação só para o lote inteiro. A entrega ao usuário de todas vai para a segunda seguinte à sprint.</span>' +
      '<div class="sp-lt-topo"><select class="sp-sel" id="sp-lt-sprint" aria-label="Sprint de destino">' + ops.map(function (o) {
        var x = tem(rPadrao) ? rPadrao : tem(agora) ? agora : '';
        return '<option value="' + esc(o.rotulo) + '"' + (o.rotulo === x ? ' selected' : '') + '>' +
          esc(curto(o.rotulo) + '  ·  ' + H.dm(o.de) + '–' + H.dm(o.ate) + (o.agora ? ' · agora' : '')) + '</option>';
      }).join('') + '</select>' +
      '<input class="in" type="search" id="sp-lt-q" autocomplete="off" placeholder="Filtrar por código, título ou dev" aria-label="Filtrar a lista"></div>' +
      '<div class="sp-lt-g" id="sp-lt-g" role="group" aria-label="Mostrar"></div>' +
      '<label class="sp-lt-ck" id="sp-lt-fora-r"><input type="checkbox" id="sp-lt-fora" checked> Só as que estão fora de sprint</label>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap"><button type="button" class="btns" data-lt="todas">Marcar todas</button>' +
      '<button type="button" class="btns" data-lt="nenhuma">Desmarcar</button><span class="note" id="sp-lt-n" aria-live="polite"></span></div>' +
      '<div class="sp-lt-l" id="sp-lt-l"></div>' +
      '<div class="sp-lt-pe"><button type="button" class="btn" data-lt="fechar">Cancelar</button>' +
      '<button type="button" class="btnp" id="sp-lt-ok" data-lt="ok" disabled>Repassar</button></div></div>';
    document.body.appendChild(ov);
    var q = function (s) { return ov.querySelector(s); };
    var antes = document.activeElement;
    var fecha = function () {
      document.removeEventListener('keydown', tecla, true);
      ov.remove();
      try { if (antes && antes.focus && antes.isConnected) antes.focus(); } catch (_) {}
    };
    var tecla = function (e) { if (e.key === 'Escape') { e.preventDefault(); fecha(); } };
    document.addEventListener('keydown', tecla, true);
    var grupos = loteGrupos(SP(), H.colunaDe, H.etapaDe, H.pausada, H.hoje(), F);
    var cand = function () {
      return loteCandidatas(H.visiveis(), st, { SPm: SP(), ETAPAm: raiz.ETAPA, ORDEMKBm: raiz.ORDEMKB,
        dataUsu: raiz.ENTREGAUSU && raiz.ENTREGAUSU.data, hoje: H.hoje(), grupos: grupos });
    };
    var pinta = function () {
      var abertas = H.visiveis().filter(function (m) { return raiz.ETAPA.aberta(m, H.hoje()); });
      q('#sp-lt-g').innerHTML = '<span class="lab">MOSTRAR</span>' + grupos.map(function (g) {
        var on = !!st.grupos[g.k];
        return '<button type="button" class="btns' + (on ? ' on' : '') + '" data-lt-g="' + g.k + '" aria-pressed="' + on + '">' + ico(g.ico) + ' ' + esc(g.rot) +
          ' <span class="n">' + abertas.filter(g.casa).length + '</span></button>';
      }).join('');
      var algum = Object.keys(st.grupos).some(function (k) { return st.grupos[k]; });
      q('#sp-lt-fora-r').style.opacity = algum ? '.45' : '';
      q('#sp-lt-fora-r').title = algum ? 'Com um grupo marcado, o grupo manda: a atrasada da sprint atual já tem sprint.' : '';
      var lista = cand();
      q('#sp-lt-l').innerHTML = lista.length ? lista.slice(0, 200).map(function (m) {
        var on = !!st.sel[m.id];
        var prio = String(m.prioridade || '').toLowerCase();
        var s = SP().doPO(m);
        return '<label class="sp-lt-it' + (on ? ' on' : '') + '"><input type="checkbox" data-lt-id="' + esc(m.id) + '"' + (on ? ' checked' : '') + '>' +
          '<span class="code" style="font-size:11px">' + esc(m.codigo || '—') + '</span>' +
          '<span class="t">' + esc(m.titulo || '') + (m.dev ? '<small>' + esc(m.dev) + '</small>' : '') + '</span>' +
          grupos.filter(function (g) { return g.casa(m); }).map(function (g) { return '<span class="gi" title="' + esc(g.rot) + '">' + ico(g.ico) + '</span>'; }).join('') +
          (prio ? chip(esc(prio === 'media' ? 'média' : prio), prio === 'alta' ? 'dg' : prio === 'media' ? 'wn' : 'bk') : '') +
          (s ? chip(esc(curto(s)), 'bk', 'Hoje na ' + s) : '') + '</label>';
      }).join('') + (lista.length > 200 ? '<span class="note">e mais ' + (lista.length - 200) + '. Refine pela busca.</span>' : '')
        : '<span class="note" style="padding:12px">Nada aqui com esse filtro.</span>';
      var n = Object.keys(st.sel).length;
      q('#sp-lt-n').textContent = n ? n + (n === 1 ? ' marcada' : ' marcadas') : 'nenhuma marcada';
      var ok = q('#sp-lt-ok');
      ok.disabled = !n;
      ok.textContent = n ? 'Repassar ' + n : 'Repassar';
    };
    q('#sp-lt-q').addEventListener('input', function (e) { st.q = e.target.value; pinta(); });
    q('#sp-lt-fora').addEventListener('change', function (e) { st.soFora = e.target.checked; pinta(); });
    ov.addEventListener('change', function (e) {
      var id = e.target.getAttribute && e.target.getAttribute('data-lt-id');
      if (!id) return;
      if (e.target.checked) st.sel[id] = true; else delete st.sel[id];
      pinta();
    });
    ov.addEventListener('click', async function (e) {
      if (e.target === ov) { fecha(); return; }
      var g = e.target.closest('[data-lt-g]');
      if (g) { var k = g.getAttribute('data-lt-g'); if (st.grupos[k]) delete st.grupos[k]; else st.grupos[k] = true; pinta(); return; }
      var b = e.target.closest('[data-lt]');
      if (!b) return;
      var a = b.getAttribute('data-lt');
      if (a === 'fechar') fecha();
      else if (a === 'todas') { cand().forEach(function (m) { st.sel[m.id] = true; }); pinta(); }
      else if (a === 'nenhuma') { st.sel = {}; pinta(); }
      else if (a === 'ok') {
        var alvo = q('#sp-lt-sprint').value, ids = Object.keys(st.sel);
        b.disabled = true;
        var base = await baseFresca();
        if (!base) { b.disabled = false; return; }
        var c = cicloRepassar(SP(), base, ids, alvo, quemGrava(), H.hoje());
        if (!c.ok) { H.toast(c.erro, 'erro'); b.disabled = false; return; }
        fecha();
        avisa(await H.gravar(c.patch, { ok: c.msg }));
      }
    });
    pinta();
    setTimeout(function () { q('#sp-lt-sprint').focus(); }, 0);
  }

  var _ocupado = false;
  function ciclo(acao, r, b) {
    if (_ocupado) return;
    _ocupado = true;
    if (b) b.disabled = true;
    var f = acao === 'iniciar' ? iniciarSprint : acao === 'fechar' ? fecharSprint : null;
    Promise.resolve().then(function () { return f ? f(r) : abrirLote(r); })
      .catch(function (ex) { console.error(ex); H.toast('Não foi possível: ' + (ex.message || ex), 'erro'); })
      .then(function () { _ocupado = false; if (b && b.isConnected && acao !== 'fechar') b.disabled = false; if (acao === 'fechar' && b && b.isConnected) fechAtualizaBotao(document, r); });
  }

  // ── Registro ──────────────────────────────────────────────────────────
  var ABAS = [
    { id: 'atual',        rotulo: 'Sprint atual' },
    { id: 'entregas',     rotulo: 'Entregas por sprint' },
    { id: 'planning',     rotulo: 'Planning' },
    { id: 'planejamento', rotulo: 'Planejamento' },
    { id: 'encerrar',     rotulo: 'Encerrar sprint', papeis: ['admin'] },
    { id: 'calendario',   rotulo: 'Calendário do time' }
  ];

  AX.tela({
    id: 'sprints',
    rotulo: 'Sprints',
    papeis: ['admin', 'analista', 'dev'],
    abas: ABAS,
    /* O contador da aba Encerrar: quantas sprints terminaram sem fechar. */
    abasDe: function () {
      var papel = AX.APP.papel, D = AX.APP.D;
      var n = 0;
      if (papel === 'admin' && D && raiz.SPRINTPO) n = SP().pendentesDeFechamento(D, H.hoje(), fer(D), H.colunaDe).length;
      return ABAS.filter(function (a) { return !a.papeis || a.papeis.indexOf(papel) >= 0; }).map(function (a) {
        return a.id === 'encerrar' && n ? { id: a.id, rotulo: a.rotulo, n: n } : a;
      });
    },
    titulo: function (r) {
      var a = ABAS.filter(function (x) { return x.id === r.aba; })[0];
      return a && a.id !== 'atual' ? 'Sprints · ' + a.rotulo : 'Sprints';
    },
    render: function (el, ctx) {
      injetarCss();
      if (!raiz.SPRINTPO) { el.innerHTML = H.vazio('alert', 'Regra de sprint não carregada', 'O sprint.js não foi lido pela página.'); return; }
      if (ctx.aba === 'planning') abaPlanning(el, ctx);
      else if (ctx.aba === 'planejamento') abaPlanejamento(el, ctx);
      else if (ctx.aba === 'encerrar') abaEncerrar(el, ctx);
      else if (ctx.aba === 'calendario') abaCalendario(el, ctx);
      else if (ctx.aba === 'entregas') abaEntregas(el, ctx);
      else abaAtual(el, ctx);
    },
    depois: function (el, ctx) {
      var sel = el.querySelector('#sp-sel');
      if (sel) sel.addEventListener('change', function () { _esc.n = 25; H.ir('sprints/atual/' + sel.value); });
      var selEs = el.querySelector('#sp-sel-es');
      if (selEs) selEs.addEventListener('change', function () { H.ir('sprints/entregas/' + selEs.value); });
      var selEst = el.querySelector('#sp-sel-est');
      if (selEst) selEst.addEventListener('change', function () { _ent.esteira = selEst.value; AX.desenhar(true); });
      var selPl = el.querySelector('#sp-sel-pl');
      if (selPl) selPl.addEventListener('change', function () { H.ir('sprints/planning/' + selPl.value); });
      var proj = el.querySelector('#sp-proj');
      if (proj) proj.addEventListener('change', function () { _projeto = proj.value; AX.desenhar(); });
      el.addEventListener('click', function (e) {
        var t = e.target.closest('[data-sp-trilha]');
        if (t) { _trilha = t.getAttribute('data-sp-trilha'); _esc.n = 25; AX.desenhar(); return; }
        // O cartao do resumo das Entregas filtra a lista; clicar de novo volta a tudo.
        var ef = e.target.closest('[data-es-filtro]');
        if (ef) {
          var fv = ef.getAttribute('data-es-filtro'); _ent.filtro = _ent.filtro === fv ? 'todas' : fv;
          if (ef.hasAttribute('data-es-pessoa')) _ent.pessoa = '';
          AX.desenhar(true); return;
        }
        // "So vencidas" no Faltando (93b6d4c): liga e desliga.
        if (e.target.closest('[data-es-sovenc]')) { _ent.soVenc = !_ent.soVenc; AX.desenhar(true); return; }
        // A esteira no "Andamento por esteira": so ela; de novo, todas (fdf14e2).
        var ee = e.target.closest('[data-es-esteira]');
        if (ee) { var evv = ee.getAttribute('data-es-esteira'); _ent.esteira = _ent.esteira === evv ? '' : evv; AX.desenhar(true); return; }
        // O nome em "Faltando por pessoa": as tasks dela; de novo, todos.
        var ep = e.target.closest('[data-es-pessoa]');
        if (ep) { var pv = ep.getAttribute('data-es-pessoa'); _ent.pessoa = _ent.pessoa === pv ? '' : pv; AX.desenhar(true); return; }
        var fl = e.target.closest('[data-sp-filtro]');
        if (fl) {
          _esc.filtro = fl.getAttribute('data-sp-filtro'); _esc.n = 25; desenharEscopo(el);
          if (!fl.closest('#sp-escopo')) { var b = el.querySelector('#sp-escopo'); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
          return;
        }
        if (e.target.closest('[data-sp-mais]')) { _esc.n += 25; desenharEscopo(el); return; }
        var cb = e.target.closest('[data-sp-ciclo]');
        if (cb) { e.preventDefault(); ciclo(cb.getAttribute('data-sp-ciclo'), cb.getAttribute('data-r'), cb); }
      });
      // O destino e o motivo do fechamento: guarda e reavalia so o botao.
      var decide = function (e) {
        var t = e.target, r = t.getAttribute && t.getAttribute('data-fech-r');
        if (!r) return;
        var dec = fechDecisoes(AX.APP.D, r), id = t.getAttribute('data-fech-id');
        if (!dec[id]) dec[id] = { destino: '', motivo: '' };
        dec[id][t.getAttribute('data-fech-campo')] = t.value;
        fechAtualizaBotao(el, r);
      };
      el.addEventListener('input', decide);
      el.addEventListener('change', decide);
      // "Direcionar para… / Trocar dev…" no backlog da sprint: grava na hora.
      el.addEventListener('change', function (e) {
        var s = e.target.closest && e.target.closest('select[data-sp-dir]');
        if (s) direcionar(s).catch(function (ex) { console.error(ex); H.toast('Não foi possível: ' + (ex.message || ex), 'erro'); });
      });
    }
  });
})();
