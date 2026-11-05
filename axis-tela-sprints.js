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

   GRAVAR CONTINUA NAS TELAS ANTIGAS. Fechar sprint e iniciar sprint moram no
   admin.html; estimar e no poker.html. Os botoes levam para la, so para o
   perfil que pode agir. Mover, alocar, ausencia e feriado sao a tela
   Planejamento do app (#planejamento, axis-tela-planejamento.js).
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
      '.axa .sp-pp{display:grid;grid-template-columns:140px minmax(0,1fr) 84px;gap:12px;align-items:center;font-size:13px}',
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
      '@container app (max-width: 760px){',
      '.axa .sp-k5{grid-template-columns:repeat(2,minmax(0,1fr))}',
      '.axa .sp-2,.axa .sp-2e,.axa .sp-pl,.axa .sp-pj,.axa .sp-k3{grid-template-columns:minmax(0,1fr)}',
      '.axa .sp-pp{grid-template-columns:110px minmax(0,1fr) 64px}',
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

  /** Link para uma tela antiga, com o icone discreto e o destino no title. */
  function linkAntigo(href, rot, titulo, cls, abaAdmin) {
    return '<a class="' + (cls || 'btn') + '" href="' + href + '" title="' + esc(titulo) + '"' +
      (abaAdmin ? ' data-sp-admin-aba="' + abaAdmin + '"' : '') + '>' + rot + ' ' +
      ico('external', 'style="font-size:12px;opacity:.7"') + '</a>';
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
      botao = linkAntigo('admin.html', 'Iniciar sprint', 'Abre o Admin, aba Gerencial › Sprint, onde a sprint é iniciada', 'btnp', 'gerencial');
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

    var pctPl = p.pctPontos != null ? p.pctPontos + '% dos pontos' : 'sem pontuação para medir';
    h += '<div class="sp-k5">' +
      kpi('Capacidade', H.num(cap), 'pts', cap
        ? plural(pessoas, 'pessoa', 'pessoas') + ' × 30 pts · alocado ' + H.num(aloc) + (cap ? ' (' + Math.round(aloc / cap * 100) + '%)' : '')
        : 'nenhuma pessoa cadastrada nesta trilha') +
      kpi('Planejado', H.num(pl.pts), 'pts', plural(pl.n, 'item', 'itens') + ' até o início' + (rep ? ' · ' + rep + ' repassad' + (rep === 1 ? 'o' : 'os') : '') +
        (p.saiu ? ' · ' + p.saiu + ' saí' + (p.saiu === 1 ? 'u' : 'ram') + ' sem entregar' : '')) +
      kpi('Adicionado depois', H.num(ad.pts), 'pts', ad.n ? plural(ad.n, 'item', 'itens') + ' depois de iniciada' : 'nada entrou depois do início', ad.n ? 'wn' : '', ad.n ? 'var(--wn-t)' : '') +
      kpi('Entregue e validado', H.num(p.pontosValidados), 'pts', pctPl + ' · ' + p.validados + ' de ' + p.total + ' itens (' + p.pct + '%)', 'ok', 'var(--ok-t)') +
      kpi('Aguardando validação', H.num(p.pontosAguardando), 'pts', p.aguardando ? plural(p.aguardando, 'item espera', 'itens esperam') + ' o PM/PO; contam aqui ao validar' : 'nada esperando o PM/PO', p.aguardando ? 'in' : '', p.aguardando ? 'var(--in-t)' : '') +
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
    var blocoPp = '<section class="sp-pn"><div class="hh"><h2 class="h2">Por pessoa</h2><span class="note" style="font-size:11.5px">pontos validados / pontos na sprint</span></div>' +
      (rk.length ? rk.map(function (d) {
        var base = d.pontosTotal || 0;
        var pct = base ? Math.min(100, Math.round(d.pontos / base * 100)) : (d.total ? Math.round(d.validados / d.total * 100) : 0);
        var eu = meus.indexOf(d.nome) >= 0;
        return '<div class="sp-pp" title="' + esc(d.nome + ': ' + d.validados + ' de ' + d.total + ' itens validados' +
          (d.aguardando ? ', ' + d.aguardando + ' aguardando' : '') + (d.emCurso ? ', ' + d.emCurso + ' em curso' : '') + (d.saiu ? ', ' + d.saiu + ' saíram' : '')) + '">' +
          '<span class="nm ell' + (eu ? ' eu' : '') + '">' + esc(d.nome) + '</span>' +
          '<span class="tr"><i class="' + (pct >= 100 ? 'ok' : '') + '" style="width:' + pct + '%"></i></span>' +
          '<span class="lv">' + (base ? d.pontos + ' / ' + base : d.validados + ' / ' + d.total + ' it') + '</span></div>';
      }).join('') + (temDupla ? '<span class="note" style="font-size:11.5px">Demanda de dupla divide os pontos entre os dois.</span>' : '')
      : H.vazio('users', 'Ninguém nesta sprint ainda', 'O PM/PO repassa as demandas pelo quadro do Admin.')) + '</section>';
    h += '<div class="sp-2">' + blocoBd + blocoPp + '</div>';

    // Escopo
    h += '<section class="sp-pn" id="sp-escopo"></section>';
    el.innerHTML = h;
    el._sp = { D: D, r: r, acomp: acomp, entrada: entrada };
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
    var ROT = { todos: 'Todos', risco: 'Em risco', adicionados: 'Adicionados', repassados: 'Repassados', saiu: 'Saíram', meus: 'Meus' };
    var ordem = ['todos', 'risco', 'adicionados', 'repassados', 'saiu'].concat(dev ? ['meus'] : []);
    if (!F[_esc.filtro] || (_esc.filtro === 'meus' && !dev)) _esc.filtro = 'todos';
    var lista = st.acomp.filter(F[_esc.filtro]);
    var vis = lista.slice(0, _esc.n);
    var SIT = { validado: ['ok', 'Validado'], aguardando: ['wn', 'Aguardando PM/PO'], saiu: ['bk', 'Saiu da sprint'], negada: ['dg', 'Negada'] };
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
        st.acomp.length ? 'Troque o filtro para ver o resto do escopo.' : 'O PM/PO repassa as demandas para a sprint pelo quadro do Admin.');
    } else {
      h += vis.map(function (x) {
        var m = x.m, e = st.entrada[m.id] || { tipo: 'planejado' };
        var en = ENTRADA[e.tipo] || ENTRADA.planejado;
        var chipEn = x.situacao === 'saiu' ? chip('Saiu', 'bk') : chip((e.tipo === 'prioritaria' ? ico('zap') + ' ' : '') + en.rot, en.cor);
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
      linkAntigo('poker.html', 'Abrir Planning Poker', 'Abre o Planning Poker para estimar a fila', 'btnp') +
      (H.donoDaSprint() ? linkAntigo('admin.html', 'Repassar no quadro', 'Abre o Admin, no Kanban: o PM/PO escolhe a sprint no card ou pelo Sprint em lote', 'btn', 'kanban') : '') +
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
      : H.vazio('inbox', 'Nada repassado ainda', 'O PM/PO escolhe a sprint no card ou pelo Sprint em lote do Admin.')) + '</section>';

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
    var fechaBtn = function (cls) {
      // So o dono da sprint fecha (`sprintFecharAbrir`, admin.html, 02/11/2026).
      if (!H.donoDaSprint()) return '<span class="note">Só o Fernando (PM/PO) fecha a sprint.</span>';
      return linkAntigo('admin.html', 'Fechar no Admin', 'Abre o Admin no Kanban; a faixa "terminou e não foi fechada" tem o botão Fechar agora, com destino e motivo de cada demanda', cls || 'btnp', 'kanban');
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
        fechaBtn() + '</header>';
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
      var colNao = '<section class="pn"><h2 class="h2">O que não saiu · escolha o destino</h2>' +
        (bal.pendentes.length ? bal.pendentes.map(function (m) {
          var pausada = H.pausada(m);
          var rs = SP().riscosDaDemanda(m, r, H.hoje(), raiz.PRAZO).filter(function (x) { return x.chave !== 'sem_pontos'; });
          return linha(m, '<span class="in" style="height:30px;font-size:12px;white-space:nowrap;' + (pausada ? '' : 'color:var(--tx3)') + '"' +
            (rs.length ? ' title="' + esc(rs.map(function (x) { return x.texto; }).join(' · ')) + '"' : '') + '>' +
            (pausada ? '→ ' + esc(curto(seg)) + ' (pausada)' : 'decidir no Admin') + '</span>');
        }).join('') + '<span class="note" style="font-size:11.5px">Pausada já vem com destino na ' + esc(curto(seg)) + ' e a pausa como motivo; o PM/PO pode trocar. As outras vão para uma sprint aberta ou voltam ao backlog, cada uma com o motivo.</span>'
        : H.vazio('check', 'Nada a decidir', 'Tudo entregou ou está em validação. Fechar só carimba a sprint.')) + '</section>';
      var colVai = '<section class="pn"><h2 class="h2">O que fica na sprint</h2>' +
        (bal.entregues.length || bal.aguardando.length
          ? bal.entregues.map(function (m) { return linha(m, chip(ico('check') + ' Validado', 'ok')); }).join('') +
            bal.aguardando.map(function (m) { return linha(m, chip(ico('hourglass') + ' Aguardando', 'wn')); }).join('')
          : H.vazio('inbox', 'Nada entregue nesta sprint', '')) +
        (p.saiu ? '<span class="note" style="font-size:11.5px">' + plural(p.saiu, 'demanda já saiu', 'demandas já saíram') + ' sem entregar e continua no total: foi aqui que falhou.</span>' : '') +
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

  // ── Registro ──────────────────────────────────────────────────────────
  var ABAS = [
    { id: 'atual',        rotulo: 'Sprint atual' },
    { id: 'planning',     rotulo: 'Planning' },
    { id: 'planejamento', rotulo: 'Planejamento' },
    { id: 'encerrar',     rotulo: 'Encerrar sprint', papeis: ['admin'] },
    { id: 'calendario',   rotulo: 'Calendário do time' }
  ];

  AX.tela({
    id: 'sprints',
    rotulo: 'Sprints',
    papeis: ['admin', 'dev'],
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
      else abaAtual(el, ctx);
    },
    depois: function (el, ctx) {
      var sel = el.querySelector('#sp-sel');
      if (sel) sel.addEventListener('change', function () { _esc.n = 25; H.ir('sprints/atual/' + sel.value); });
      var selPl = el.querySelector('#sp-sel-pl');
      if (selPl) selPl.addEventListener('change', function () { H.ir('sprints/planning/' + selPl.value); });
      var proj = el.querySelector('#sp-proj');
      if (proj) proj.addEventListener('change', function () { _projeto = proj.value; AX.desenhar(); });
      el.addEventListener('click', function (e) {
        var t = e.target.closest('[data-sp-trilha]');
        if (t) { _trilha = t.getAttribute('data-sp-trilha'); _esc.n = 25; AX.desenhar(); return; }
        var fl = e.target.closest('[data-sp-filtro]');
        if (fl) {
          _esc.filtro = fl.getAttribute('data-sp-filtro'); _esc.n = 25; desenharEscopo(el);
          if (!fl.closest('#sp-escopo')) { var b = el.querySelector('#sp-escopo'); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
          return;
        }
        if (e.target.closest('[data-sp-mais]')) { _esc.n += 25; desenharEscopo(el); return; }
        /* A aba certa do Admin: ele reabre na ultima aba guardada em
           `rm_admin_tab` (restoreLastTab). Sem rota por hash para o fechamento,
           e o jeito de cair onde o botao "Fechar agora" mora. */
        var ad = e.target.closest('[data-sp-admin-aba]');
        if (ad) { try { localStorage.setItem('rm_admin_tab', ad.getAttribute('data-sp-admin-aba')); } catch (_) {} }
      });
    }
  });
})();
