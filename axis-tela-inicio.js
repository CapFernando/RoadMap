/* ─────────────────────────────────────────────────────────────────────────
   AXIS — tela Inicio (prototipo EP-013: Inicio.dc.html / 03-Inicio.png).

   QUATRO ABAS, UMA PERGUNTA CADA:
     Visao geral     "como esta o dia" — saudacao, sprint, indicadores, a lista
                     do que esta em curso e o que espera por quem esta logado.
     Meu trabalho    "o que esta comigo" — o quadro pessoal do dev; para o
                     PM/PO, o que pede a acao dele (validar, cobrar, estimar).
     Meu cronograma  as entregas nas proximas semanas, como o Cronograma do
                     painel do dev (dev.html), que e de leitura — com o "Meu
                     resumo" ao lado da navegacao, o mesmo `RESUMODEV.abrir`.
     Notificacoes    o que pede acao (o mesmo sino do nucleo), as mencoes nas
                     mensagens e o historico recente das demandas.

   A consulta ve so a Visao geral, e sem "meus": ela nao tem demandas proprias
   e nao age sobre nenhuma (DOC-04).

   O QUE GRAVA NAO MORA AQUI. "+ Novo item" abre o formulario do app
   (axis-form-demanda.js) e "Registrar" a homologacao e o gesto de
   axis-acoes.js; "Validar" leva a aba Validacao do PO, onde estao o que o dev
   entregou e as duas decisoes. Estimar leva a tela de Poker do app (#poker).

   O DEV VE O QUE E DELE E A FILA DO TIME (dev.html, 82bff39): em Meu
   trabalho, o filtro "Mostrar" (no meu nome + fila, so no meu nome, so a
   fila), a marca de quem e cada cartao e o "Pegar" da fila (axis-acoes.js,
   que poe o nome de quem pegou). Os indicadores seguem sendo so os dele.
   Como o painel (368342d e 5c849fb): o quadro abre na sprint atual — outra
   sprint, "Todas" ou "Fora da sprint" pelo filtro, e o Limpar volta para ela
   — e o filtro "Times" soma a fila de Dados/BI ou Sales Ops a do seu time.

   AS CONTAS SAO DOS MODULOS (sprint.js, prazo.js, capacidade.js,
   homologacao.js, devolucao.js). O que nao existe em modulo e foi copiado de
   tela antiga esta marcado com "COPIA DE" e a origem.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var A = window.AXIS_APP;
  if (!A) return;
  var H = A.H;

  // ── Estado local da tela (nao vai para a rota: e preferencia de leitura) ─
  var EST = {
    listaTudo: false,      // "Mostrar mais" da lista da visao geral
    cronDesloc: 0,         // quantas quinzenas o cronograma andou
    cronDev: '',           // filtro de dev do cronograma do time (admin)
    cronLimite: 40,
    ntfFiltro: 'acao',
    ntfLimite: 30,
    mostrar: '',           // Meu trabalho do dev: '' (no meu nome + fila), 'meu', 'fila'
    sprint: '',            // Meu trabalho do dev: '' (todas), '__fora__' ou o rotulo
    sprintPadrao: false,   // a sprint atual so e escolhida na primeira montagem
    mais: {},              // Meu trabalho: colunas abertas por inteiro ("e mais N")
    etapa: ''              // Meu trabalho no celular: a etapa a vista (uma por vez)
  };
  // Cards por coluna antes do "e mais N" (o painel do dev mostra todos; o corte e so de leitura).
  var POR_COLUNA = 10;

  // ── CSS proprio, injetado uma vez ─────────────────────────────────────
  function poeCss() {
    if (document.getElementById('css-tela-inicio')) return;
    var st = document.createElement('style');
    st.id = 'css-tela-inicio';
    st.textContent = [
      '.axa .ini-hd{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:16px}',
      '.axa .ini-hd.fim{align-items:flex-end}',
      '.axa .ini-hd .h1{font-size:30px;line-height:36px}',
      '.axa .ini-data{font-size:13px;color:var(--tx3)}',
      '.axa .ini-busca{width:260px;cursor:pointer;color:var(--tx4);background:var(--sf);text-align:left}',
      '.axa .ini-kg{display:grid;gap:14px;grid-template-columns:repeat(5,minmax(0,1fr))}',
      '.axa .ini-kg.seis{grid-template-columns:repeat(5,minmax(0,1fr)) minmax(0,1.6fr)}',
      '.axa .ini-kg .k{border-radius:16px;gap:6px;text-decoration:none;color:inherit}',
      '.axa .ini-kg .kn{font-size:12px;color:var(--tx3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.axa .ini-kg .kv small{font-size:15px;color:var(--tx3);font-weight:700}',
      '.axa .ini-dois{display:grid;gap:20px;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);align-items:start}',
      '.axa .ini-sec{padding:20px;border-radius:18px;background:rgba(var(--sf-rgb),.72);border:1px solid var(--bd);display:flex;flex-direction:column;gap:10px;min-width:0}',
      '.axa .ini-sec>.cab{display:flex;justify-content:space-between;align-items:center;gap:10px}',
      '.axa .ini-sec h2{margin:0;font-family:var(--font-title);font-size:18px;font-weight:700}',
      '.axa .ini-sec .cab a{font-size:13px;text-decoration:none}',
      '.axa .ini-it{display:grid;grid-template-columns:78px minmax(0,1fr) 170px 110px;gap:12px;align-items:center;padding:12px 14px;border-radius:12px;background:var(--sf2);border:1px solid var(--bd);text-decoration:none;color:var(--tx)}',
      '.axa a.ini-it:hover{border-color:var(--bd4)}',
      '.axa .ini-it.dg{border-color:rgba(var(--dg-rgb),.45)}',
      '.axa .ini-it .cd{font-family:var(--font-mono);font-size:12px;color:var(--tx3)}',
      '.axa .ini-it .tt{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.axa .ini-it .tt b{font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.axa .ini-it .tt span{font-size:12px;color:var(--tx3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.axa .ini-it .st{display:flex;flex-wrap:wrap;gap:4px;justify-self:start}',
      '.axa .ini-it .pz{font-size:12px;text-align:right;font-weight:600}',
      '.axa .ini-ag{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;border-radius:12px;background:var(--sf2);text-decoration:none;color:var(--tx);font-size:13px}',
      '.axa a.ini-ag:hover{background:var(--sf4)}',
      '.axa .ini-ag .mt{font-family:var(--font-mono);font-size:12px;color:var(--tx3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:50%}',
      '.axa .ini-ag .axi{margin-right:6px}',
      '.axa .ini-leg{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:var(--tx3)}',
      '.axa .ini-leg span{display:inline-flex;align-items:center;gap:6px}',
      '.axa .ini-leg i.q{width:10px;height:10px;border-radius:3px;display:inline-block}',
      '.axa .ini-bar{display:flex;height:8px;border-radius:4px;overflow:hidden;background:var(--track)}',
      '.axa .ini-bar span{display:block;height:100%}',
      /* Quadro pessoal (Meu trabalho) */
      '.axa .ini-cols{display:grid;gap:12px;align-items:start;grid-template-columns:repeat(5,minmax(0,1fr))}',
      '.axa .ini-cols.q4{grid-template-columns:repeat(4,minmax(0,1fr))}',
      '.axa .ini-col{display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:16px;background:rgba(var(--sf-rgb),.5);border:1px solid var(--bd);min-height:220px;min-width:0}',
      '.axa .ini-col .ch{display:flex;justify-content:space-between;align-items:center;padding:2px 4px;gap:8px}',
      '.axa .ini-col .ch b{font-size:12px;font-weight:800;letter-spacing:.08em}',
      '.axa .ini-card{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:12px;background:var(--sf2);border:1px solid var(--bd);cursor:pointer;color:var(--tx);text-decoration:none}',
      '.axa .ini-card:hover{border-color:var(--bd4)}',
      '.axa .ini-card.ro{cursor:default}',
      '.axa .ini-card .t{font-size:13px;font-weight:700;line-height:18px}',
      '.axa .ini-card .fl{display:flex;flex-wrap:wrap;gap:4px}',
      '.axa .ini-card .rd{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11.5px;color:var(--tx3)}',
      '.axa .ini-mais{font-size:12px;color:var(--tx3);text-align:center;padding:4px}',
      /* O quadro do Meu trabalho e o do Quadro (AXIS_QUADRO), com as colunas do painel do dev. */
      '.axa .ini-qd .qd-col{width:224px}',
      /* A coluna vazia vira tira, como a Negada do Quadro: as sete do painel cabem na tela e o
         trabalho fica a vista. Continua recebendo o card arrastado. */
      '@container app (min-width: 761px){.axa .ini-qd .qd-col.vazia{width:56px;padding:12px 0;align-items:center}' +
        '.axa .ini-qd .qd-col.vazia .qd-ch{flex-direction:column;gap:10px;padding:0}' +
        '.axa .ini-qd .qd-col.vazia .qd-ch h2{writing-mode:vertical-rl;transform:rotate(180deg)}' +
        '.axa .ini-qd .qd-col.vazia .qd-ch .n{margin:0}.axa .ini-qd .qd-col.vazia .qd-vz{display:none}' +
        '.axa .ini-qd .qd-col.vazia.trava .qd-trava{display:none}}',
      '.axa button.k{font:inherit;text-align:left;color:inherit;cursor:pointer;width:100%}',
      '.axa .ini-fil{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
      // A faixa do prazo vencido (`risco-dev`, dev.html): quantas, quais (cada uma abre), e as escondidas pelo filtro.
      '.axa .ini-risco{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;padding:10px 14px;border-radius:12px;background:rgba(var(--dg-rgb),.1);border:1px solid rgba(var(--dg-rgb),.35);color:var(--dg-t);font-size:13px;line-height:20px}',
      '.axa .ini-risco:focus{outline:2px solid rgba(var(--dg-rgb),.6);outline-offset:2px}',
      '.axa .ini-risco b{font-weight:800}',
      '.axa .ini-rl{border:0;background:transparent;color:inherit;font:inherit;text-decoration:underline;text-underline-offset:3px;cursor:pointer;padding:2px 0}',
      '.axa .ini-rl:hover{color:var(--tx)}',
      '.axa .ini-risco-esc{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}',
      /* Cronograma */
      '.axa .ini-cr{padding:0;gap:0;overflow-x:auto}',
      '.axa .ini-cr .ln{display:grid;border-bottom:1px solid var(--bd3);min-height:54px}',
      '.axa .ini-cr .ln.cab{border-bottom:1px solid var(--bd);min-height:0}',
      '.axa .ini-cr .dia{padding:8px 0;text-align:center;font-size:10.5px;line-height:13px;color:var(--tx3);border-left:1px solid var(--bd3)}',
      '.axa .ini-cr .dia b{display:block;font-size:12px}',
      '.axa .ini-cr .dia.fds{color:var(--tx5);background:var(--sf2)}',
      '.axa .ini-cr .dia.hj{color:var(--ac-t);background:rgba(var(--ac-rgb),.12)}',
      '.axa .ini-cr .rot{padding:9px 14px;display:flex;flex-direction:column;gap:2px;min-width:0;grid-row:1}',
      '.axa .ini-cr .rot .t{font-size:12.5px;font-weight:600;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.axa .ini-cr .hjc{grid-row:1;background:rgba(var(--ac-rgb),.07)}',
      '.axa .ini-cr .fdc{grid-row:1;background:var(--sf2);opacity:.6}',
      '.axa .ini-cr .br{grid-row:1;align-self:center;height:24px;margin:0 2px;border-radius:7px;color:var(--bg0);font-size:11px;font-weight:800;display:flex;align-items:center;padding:0 8px;overflow:hidden;white-space:nowrap;cursor:pointer;z-index:1;text-decoration:none}',
      '.axa .ini-cr .br.ro{cursor:default}',
      /* Notificacoes */
      '.axa .ini-nt{display:flex;align-items:flex-start;gap:14px;padding:13px 14px;border-radius:12px;text-decoration:none;color:var(--tx)}',
      '.axa a.ini-nt:hover{background:var(--sf4)}',
      '.axa .ini-nt.nv{background:rgba(var(--ac-rgb),.05)}',
      '.axa .ini-nt .ic{width:34px;height:34px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:15px;background:var(--sf4)}',
      '.axa .ini-nt .cx{flex:1;display:flex;flex-direction:column;gap:3px;min-width:0}',
      '.axa .ini-nt .cx>span:first-child{font-size:13.5px;line-height:19px}',
      '.axa .ini-nt .qd{display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-size:11.5px;color:var(--tx3);white-space:nowrap}',
      '.axa .ini-nt .pt{width:8px;height:8px;border-radius:4px;background:var(--ac)}',
      /* O "MEU RESUMO" (resumo-dev.js) cria o proprio modal, com as classes das
         telas antigas (.modal-overlay, .modal), que o app nao desenha: aqui ele
         vira a caixa do app — tela inteira no celular, toque de 44 px e texto
         de 12 px no minimo (o modulo usa 10,5 e 11,5 nos detalhes). */
      'html.axa #modal-dev-resumo.modal-overlay{position:fixed;inset:0;z-index:1200;align-items:center;justify-content:center;padding:24px}',
      'html.axa #modal-dev-resumo .modal{position:relative;box-sizing:border-box;width:100%;max-height:calc(100dvh - 48px);overflow:auto;padding:24px;display:flex;flex-direction:column;gap:4px;color:var(--tx);font-family:var(--font-ui)}',
      'html.axa #modal-dev-resumo h2{margin:0 48px 4px 0;font-size:20px;font-weight:800}',
      'html.axa #modal-dev-resumo .ap-dica{font-size:13px;line-height:19px;color:var(--tx3)}',
      'html.axa #modal-dev-resumo .modal-close-btn{position:absolute;top:10px;right:10px;width:44px;height:44px;border:0;border-radius:12px;background:transparent;color:var(--tx2);font-size:18px;cursor:pointer}',
      'html.axa #modal-dev-resumo .modal-close-btn:hover{background:var(--sf4);color:var(--tx)}',
      'html.axa #modal-dev-resumo .form-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}',
      'html.axa #modal-dev-resumo .form-actions .btn{min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:6px}',
      'html.axa #modal-dev-resumo .dr-cod,html.axa #modal-dev-resumo .dr-sis,html.axa #modal-dev-resumo .dr-sit,html.axa #modal-dev-resumo .dr-sis small,' +
        'html.axa #modal-dev-resumo .dr-sit small,html.axa #modal-dev-resumo .dr-kpi span,html.axa #modal-dev-resumo .dr-sec-tit small{font-size:12px}',
      '@media (max-width: 760px){',
      'html.axa #modal-dev-resumo.modal-overlay{padding:0;align-items:stretch}',
      'html.axa #modal-dev-resumo .modal{max-width:none !important;max-height:100dvh;min-height:100dvh;border-radius:0;padding:16px 16px calc(16px + env(safe-area-inset-bottom))}',
      'html.axa #modal-dev-resumo .form-actions{position:sticky;bottom:calc(-16px - env(safe-area-inset-bottom));margin:8px -16px calc(-16px - env(safe-area-inset-bottom));padding:10px 16px calc(16px + env(safe-area-inset-bottom));background:var(--sf3);border-top:1px solid var(--bd2)}',
      'html.axa #modal-dev-resumo .form-actions .btn{flex:1 1 140px;min-height:44px}',
      'html.axa #modal-dev-resumo .dr-kpi{box-sizing:border-box;min-width:0;flex:1 1 calc(50% - 10px)}',
      // Abaixo de 560 px o modulo poe o titulo na coluna de 58 px do codigo: aqui ele e a situacao ganham a linha.
      'html.axa #modal-dev-resumo .dr-item{grid-template-columns:72px minmax(0,1fr);row-gap:4px}',
      'html.axa #modal-dev-resumo .dr-tt,html.axa #modal-dev-resumo .dr-sit{grid-column:1 / -1}',
      '}',
      '@container app (max-width: 760px){',
      '.axa .ini-kg,.axa .ini-kg.seis{grid-template-columns:repeat(2,minmax(0,1fr)) !important}',
      '.axa .ini-kg.seis>.k:last-child{grid-column:1 / -1}',
      '.axa .ini-dois{grid-template-columns:minmax(0,1fr) !important}',
      '.axa .ini-it{grid-template-columns:62px minmax(0,1fr) !important;row-gap:6px}',
      '.axa .ini-it .st{grid-column:2}',
      '.axa .ini-it .pz{grid-column:2;text-align:left}',
      '.axa .ini-cols,.axa .ini-cols.q4{grid-template-columns:minmax(0,1fr) !important}',
      '.axa .ini-col{min-height:0}',
      '.axa .ini-busca{width:100%}',
      '.axa .ini-hd>div{width:100%}',
      /* Meu trabalho no celular: filtros na gaveta, numeros numa faixa que rola de lado, a faixa
         do prazo numa linha so — os cards ficam acima da dobra. */
      '.axa .ini-novo,.axa .ini-sub{display:none !important}',
      '.axa .ini-kg.seis{display:flex !important;overflow-x:auto;scrollbar-width:none;gap:8px;align-items:flex-start}',
      '.axa .ini-kg.seis::-webkit-scrollbar{display:none}',
      '.axa .ini-kg.seis>.k{flex:0 0 120px;padding:10px 12px;gap:2px}',
      '.axa .ini-kg.seis>.k:last-child{flex-basis:210px}',
      '.axa .ini-kg.seis>.k:last-child .note{display:none}',
      '.axa .ini-hd.ini-hd-meu{flex-wrap:nowrap;align-items:center}',
      '.axa .ini-hd.ini-hd-meu>div{width:auto !important}',
      '.axa .ini-risco{flex-wrap:nowrap;overflow-x:auto;white-space:nowrap;scrollbar-width:none;padding:0 12px}',
      '.axa .ini-risco::-webkit-scrollbar{display:none}',
      '.axa .ini-rl{min-height:44px}',
      '.axa .ini-risco-esc{flex-wrap:nowrap}',
      // O que pede voce (`.ini-cols.q4`, so nesta aba): a linha de datas e pontos do cartao com 12 px.
      '.axa .ini-cols.q4 .ini-card .rd{font-size:12px}',
      // e os cinco numeros numa faixa que rola de lado, como no Meu trabalho: os cartoes sobem.
      '.axa .ini-kg.ini-kg-pede{display:flex !important;overflow-x:auto;scrollbar-width:none;gap:8px;align-items:stretch}',
      '.axa .ini-kg.ini-kg-pede::-webkit-scrollbar{display:none}',
      '.axa .ini-kg.ini-kg-pede>.k{flex:0 0 150px;padding:10px 12px;gap:2px;box-sizing:border-box}',
      '}'
    ].join('\n');
    document.head.appendChild(st);
  }

  // ── Leituras comuns ───────────────────────────────────────────────────
  var ABERTAS_DO_DEV = ['planejado', 'em_andamento'];
  var EM_VALIDACAO = ['validacao_area', 'validacao'];

  function feriados(ctx) { return (ctx.D || {}).feriados || []; }
  function primeiroNome(ctx) {
    var n = String(ctx.eu.nome || ctx.eu.login || '').trim();
    return n.split(/\s+/)[0] || '';
  }
  function mesAtual() { return H.hoje().slice(0, 7); }

  /** Vence hoje: prazo efetivo e hoje, o relogio corre e nao esta pausada.
      `relogioParou` (prazo.js) tira validacao, concluida e backlog: nelas a
      data nao e cobranca do dev. */
  function venceHoje(m) {
    var c = H.colunaDe(m);
    if (H.pausada(m)) return false;
    if (window.PRAZO && window.PRAZO.relogioParou(c)) return false;
    return H.prazoDe(m) === H.hoje();
  }
  /* ATRASADA E A QUE AINDA CORRE E PASSOU DO PRAZO. `PRAZO.diasDeAtraso` tambem
     devolve o atraso CONGELADO de quem ja saiu da mao do dev (validacao,
     concluida: "entregou atrasado"); contar esse aqui pos 71 concluidas no
     "Atrasadas" de um dev e 333 no do PM/PO. Relogio parado nao atrasa — a
     mesma leitura do `prazoTxt` do nucleo. */
  function atrasada(m) {
    var a = H.atrasoDe(m);
    return !!(a && a > 0) && !(window.PRAZO && window.PRAZO.relogioParou && window.PRAZO.relogioParou(H.colunaDe(m)));
  }
  function devolvida(m) {
    return !!(window.DEVOLUCAO && window.DEVOLUCAO.houve(m)) && ABERTAS_DO_DEV.indexOf(H.colunaDe(m)) >= 0;
  }
  function paraEstimar(m) { return H.colunaDe(m) === 'planning' && !H.pontosDe(m); }
  function cobraHom(m) { return !!(window.HOMOLOGACAO && window.HOMOLOGACAO.cobraHomologacao(m, H.hoje())); }
  function semPontos(m) { return !!(window.CAPACIDADE && window.CAPACIDADE.semPontuacao(m)); }

  /** "AX-288, AX-725 e mais 3" — a nota do prototipo. */
  function codigos(lista, n) {
    n = n || 2;
    var c = lista.slice(0, n).map(function (m) { return H.esc(m.codigo || '—'); }).join(', ');
    return lista.length > n ? c + ' e mais ' + (lista.length - n) : c;
  }

  /** Dia da sprint: posicao de hoje nos dias uteis da faixa (sprint.js). */
  function diaDaSprint(rot, ctx) {
    var S = window.SPRINTPO;
    if (!S || !rot) return null;
    var fer = feriados(ctx);
    var f = S.faixaDaSprint(rot, fer);
    if (!f) return null;
    var uteis = S.diasUteisDoMes(+rot.slice(6, 10), +rot.slice(3, 5), fer)
      .filter(function (d) { return d >= f.de && d <= f.ate; });
    var hoje = H.hoje();
    var feitos = uteis.filter(function (d) { return d <= hoje; }).length;
    return { de: f.de, ate: f.ate, total: uteis.length, feitos: feitos,
             faltam: uteis.length - feitos, acabou: hoje > f.ate };
  }
  function textoDia(rot, ctx) {
    var d = diaDaSprint(rot, ctx);
    if (!d) return '';
    if (!d.feitos) return 'começa ' + H.dm(d.de);
    return 'dia ' + d.feitos + ' de ' + d.total + (d.acabou ? ' · terminou ' + H.dm(d.ate) : '');
  }

  function ordemDeAtencao(a, b) {
    // Atrasada primeiro (a mais atrasada antes), depois vence hoje, depois prazo.
    var xa = H.atrasoDe(a) || 0, xb = H.atrasoDe(b) || 0;
    if (xa !== xb) return xb - xa;
    var ha = venceHoje(a) ? 0 : 1, hb = venceHoje(b) ? 0 : 1;
    if (ha !== hb) return ha - hb;
    return String(H.prazoDe(a) || '9999').localeCompare(String(H.prazoDe(b) || '9999'));
  }

  function link(m, ctx) { return ctx.papel === 'consulta' ? '' : H.hrefItem(m); }
  function kpi(rot, valor, nota, o) {
    o = o || {};
    // `o.ini`: o numero e um botao da tela (data-ini), e nao um link.
    var tag = o.href ? 'a' : o.ini ? 'button' : 'div';
    return '<' + tag + (o.href ? ' href="' + o.href + '"' : '') + (o.ini ? ' type="button" data-ini="' + o.ini + '"' + (o.titulo ? ' title="' + H.esc(o.titulo) + '"' : '') : '') +
      ' class="k' + (o.cls ? ' ' + o.cls : '') + (o.href || o.ini ? ' click' : '') + '">' +
      '<span class="kl">' + rot + '</span>' +
      '<span class="kv"' + (o.cor ? ' style="color:' + o.cor + '"' : '') + '>' + valor + '</span>' +
      (nota != null ? '<span class="kn"' + (o.notaCor ? ' style="color:' + o.notaCor + '"' : '') + '>' + nota + '</span>' : '') +
      (o.extra || '') + '</' + tag + '>';
  }

  // ═════════════════════════════════════════════════════════════════════
  //  VISAO GERAL
  // ═════════════════════════════════════════════════════════════════════
  function visaoGeral(ctx) {
    var S = window.SPRINTPO;
    var vs = H.visiveis();
    var hoje = H.hoje();
    var papel = ctx.papel;
    var dev = papel === 'dev';
    var sprint = H.sprintAtual();
    var base = dev ? vs.filter(H.minha) : vs;

    // ── Cabecalho ──
    var linhaData = H.dataLonga(hoje) + (sprint ? ' · Sprint ' + H.esc(S.rotuloCurto(sprint)) + ' · ' + textoDia(sprint, ctx) : '');
    var acoes = '<button type="button" class="in ini-busca" data-ini="busca">' + H.ico('search', 'style="margin-right:8px"') + 'Buscar AX-, título, dev…</button>';
    if (papel !== 'consulta') {
      acoes += '<a class="btn" href="#poker" title="Abre o Planning Poker do app">' + H.ico('cards') + ' Planning Poker</a>';
      acoes += '<button type="button" class="btnp" data-axa-form="novo">+ Novo item</button>';
    }
    var h = '<header class="ini-hd"><div style="display:flex;flex-direction:column;gap:4px">' +
      '<span class="ini-data">' + linhaData + '</span>' +
      '<h1 class="h1">' + H.saudacao(new Date().getHours()) + (primeiroNome(ctx) ? ', ' + H.esc(primeiroNome(ctx)) : '') + '</h1></div>' +
      '<div class="row" style="flex-wrap:wrap">' + acoes + '</div></header>';

    // ── Indicadores ──
    var emDev = base.filter(function (m) { return H.colunaDe(m) === 'em_andamento'; });
    var vHoje = base.filter(venceHoje).sort(ordemDeAtencao);
    var emVal = base.filter(function (m) { return EM_VALIDACAO.indexOf(H.colunaDe(m)) >= 0; });
    var comPO = emVal.filter(function (m) { return H.colunaDe(m) === 'validacao'; }).length;
    var atr = base.filter(atrasada).sort(ordemDeAtencao);
    var emDevAtr = emDev.filter(atrasada).length;

    var k1nota = dev
      ? (emDevAtr ? '<span style="color:var(--dg-t)">' + H.plural(emDevAtr, 'atrasada', 'atrasadas') + '</span>' : 'nenhuma atrasada')
      : (function () {
          var nomes = {};
          emDev.forEach(function (m) { H.devsDe(m).forEach(function (n) { nomes[n] = 1; }); });
          return 'com ' + H.plural(Object.keys(nomes).length, 'pessoa', 'pessoas') +
            (emDevAtr ? ' · <span style="color:var(--dg-t)">' + emDevAtr + ' atrasada' + (emDevAtr > 1 ? 's' : '') + '</span>' : '');
        })();

    // Pontos da sprint: o placar (time) ou o ranking (a minha linha), ambos de
    // sprint.js, com a etapa GRAVADA — a mesma que admin.html e dev.html passam.
    var pts = { total: 0, feitos: 0, pct: null, itens: 0 };
    if (sprint && S) {
      if (dev) {
        var nomes = H.meusNomes();
        S.rankingDaSprint(ctx.D, sprint, H.colunaDe).forEach(function (r) {
          if (nomes.indexOf(r.nome) >= 0) { pts.total += r.pontosTotal; pts.feitos += r.pontos; pts.itens += r.total; }
        });
        pts.pct = pts.total ? Math.round(pts.feitos / pts.total * 100) : null;
      } else {
        var pl = S.placarDaSprint(ctx.D, sprint, H.colunaDe);
        // Em validacao conta como entrega (fdf14e2): o percentual do placar ja soma as duas.
        pts = { total: pl.pontosTotal, feitos: pl.pontosEntregues != null ? pl.pontosEntregues : pl.pontosValidados, pct: pl.pctPontos, itens: pl.total,
                entregues: pl.pontosEntregues != null };
      }
    }
    var podeVer = papel !== 'consulta';
    var kpis = '<div class="ini-kg">' +
      kpi('Em desenvolvimento', emDev.length, k1nota, { href: podeVer ? '#quadro' : '' }) +
      kpi('Vencem hoje', vHoje.length, vHoje.length ? codigos(vHoje) : 'nada vence hoje',
        { cls: vHoje.length ? 'dg' : '', cor: vHoje.length ? 'var(--dg-t)' : '' }) +
      kpi('Em validação', emVal.length, emVal.length ? comPO + ' com o PO · ' + (emVal.length - comPO) + ' na área' : 'nada esperando validação',
        { href: papel === 'admin' ? '#backlog/validacao' : '' }) +
      kpi('Na sprint', pts.total + ' <small>pts</small>',
        pts.total ? pts.feitos + (pts.entregues ? ' entregues' : ' validados') + (pts.pct != null ? ' · ' + pts.pct + '%' : '')
                  : (pts.itens ? H.plural(pts.itens, 'item', 'itens') + ' sem pontos do Poker' : (dev ? 'nada seu na sprint' : 'sprint sem itens')),
        { notaCor: pts.feitos ? 'var(--ok-t)' : '', href: podeVer ? '#sprints' : '' }) +
      kpi('Atrasadas', atr.length, atr.length ? codigos(atr) : 'tudo no prazo',
        { cls: atr.length ? 'dg' : 'ok', cor: atr.length ? 'var(--dg-t)' : 'var(--ok-t)',
          href: papel === 'admin' ? '#backlog/vencido' : (dev ? '#inicio/meu' : '') }) +
      '</div>';

    // ── Lista principal ──
    var lista, tituloLista;
    if (dev) {
      tituloLista = 'Meus itens na sprint';
      lista = base.filter(function (m) {
        var c = H.colunaDe(m);
        if (c === 'negada') return false;
        // Na sprint pelo carimbo do PO; e o que esta com a bola fora dela,
        // para nada em curso sumir da tela inicial por falta de carimbo.
        return (S && S.naSprint(m, sprint)) || c === 'em_andamento' || EM_VALIDACAO.indexOf(c) >= 0;
      });
    } else {
      tituloLista = papel === 'admin' ? 'Em andamento e para validar' : 'Em andamento no time';
      lista = vs.filter(function (m) {
        var c = H.colunaDe(m);
        return c === 'em_andamento' || (papel === 'admin' && c === 'validacao');
      });
    }
    var PESO = { em_andamento: 0, planejado: 1, validacao_area: 2, validacao: 3, planning: 4, levantar_req: 5, backlog: 6, concluido: 9 };
    lista.sort(function (a, b) {
      var pa = PESO[H.colunaDe(a)], pb = PESO[H.colunaDe(b)];
      var aa = atrasada(a) || venceHoje(a), ab = atrasada(b) || venceHoje(b);
      if (aa !== ab) return aa ? -1 : 1;
      if (pa !== pb) return (pa == null ? 7 : pa) - (pb == null ? 7 : pb);
      return ordemDeAtencao(a, b);
    });
    var LIM = 8;
    var mostra = EST.listaTudo ? lista.slice(0, 60) : lista.slice(0, LIM);
    var linhas = mostra.map(function (m) { return linhaItem(m, ctx, { comDev: !dev, foraDaSprint: dev && S && !S.naSprint(m, sprint) }); }).join('');
    if (!lista.length) {
      linhas = H.vazio(dev ? 'board' : 'check',
        dev ? 'Nada seu na sprint ' + (sprint ? S.rotuloCurto(sprint) : '') : 'Nada em andamento agora',
        dev ? 'Quando o PM/PO repassar demandas suas para a sprint, elas aparecem aqui.' : 'Nenhuma demanda está na etapa Em Andamento.');
    }
    var rodapeLista = '';
    if (lista.length > LIM) {
      rodapeLista = '<button type="button" class="btns" data-ini="lista-mais" style="align-self:center">' +
        (EST.listaTudo ? 'Mostrar menos' : 'Mostrar mais ' + (Math.min(lista.length, 60) - LIM)) + '</button>' +
        (EST.listaTudo && lista.length > 60 ? '<span class="ini-mais">e mais ' + (lista.length - 60) + ' no quadro</span>' : '');
    }
    var secLista = '<section class="ini-sec"><div class="cab"><h2>' + tituloLista +
      ' <span class="mono" style="font-size:13px;color:var(--tx4);font-weight:600">' + lista.length + '</span></h2>' +
      (podeVer ? '<a href="#quadro">Abrir quadro</a>' : '') + '</div>' + linhas + rodapeLista + '</section>';

    // ── Coluna da direita ──
    var dir = '<div style="display:flex;flex-direction:column;gap:20px;min-width:0">' +
      aguardando(ctx, vs, base) + painelSprint(ctx, sprint) + '</div>';

    return h + kpis + '<div class="ini-dois">' + secLista + dir + '</div>';
  }

  function linhaItem(m, ctx, o) {
    o = o || {};
    var pz = H.prazoTxt(m);
    var alerta = atrasada(m) || venceHoje(m);
    var sub = H.esc(H.caminho(m.tema_id) || '—');
    if (o.comDev) sub += m.dev ? ' · ' + H.esc(m.dev) : ' · <span style="color:var(--wn-t)">sem dev</span>';
    var chips = H.chipEtapa(m);
    if (devolvida(m)) chips += ' ' + H.chip(H.ico('undo') + ' devolvida', 'wn', 'Motivo: ' + window.DEVOLUCAO.motivo(m));
    if (o.foraDaSprint && H.colunaDe(m) !== 'concluido') chips += ' ' + H.chip('fora da sprint', 'bk', 'Sem carimbo de sprint do PO, mas com você');
    var href = link(m, ctx);
    var tag = href ? 'a href="' + href + '"' : 'div';
    return '<' + tag + ' class="ini-it' + (alerta ? ' dg' : '') + '">' +
      '<span class="cd">' + H.esc(m.codigo || '—') + '</span>' +
      '<span class="tt"><b title="' + H.esc(m.titulo) + '">' + H.esc(m.titulo || '(sem título)') + '</b><span>' + sub + '</span></span>' +
      '<span class="st">' + chips + '</span>' +
      '<span class="pz" style="color:' + pz.cor + '">' + H.esc(pz.txt) + '</span>' +
      '</' + (href ? 'a' : 'div') + '>';
  }

  /** "Aguardando voce": o que a base diz que espera por quem esta logado. */
  function aguardando(ctx, vs, minhas) {
    var papel = ctx.papel;
    var hoje = H.hoje();
    var S = window.SPRINTPO;
    var L = [];
    var linha = function (ico, cor, txt, lista, href, titulo) {
      L.push({ ico: ico, cor: cor, txt: txt, meta: lista ? lista.slice(0, 2).map(function (m) { return H.esc(m.codigo || ''); }).join(' · ') + (lista.length > 2 ? ' …' : '') : '', href: href, titulo: titulo });
    };
    var poker = vs.filter(paraEstimar);
    if (papel === 'admin') {
      var val = vs.filter(function (m) { return H.colunaDe(m) === 'validacao'; });
      if (val.length) linha('check', 'var(--wn-t)', '<b>' + H.plural(val.length, 'entrega', 'entregas') + '</b> para validar', val, '#backlog/validacao');
      var hom = vs.filter(cobraHom);
      if (hom.length) linha('users', 'var(--pu-t)', '<b>' + H.plural(hom.length, 'homologação', 'homologações') + '</b> a cobrar da área', hom,
        hom.length === 1 ? H.hrefItem(hom[0]) : '#inicio/pede', 'Na Validação da área há ' + window.HOMOLOGACAO.DIAS_ATE_COBRAR + ' dias ou mais, sem registro de quem homologou');
      if (poker.length) linha('cards', 'var(--in-t)', '<b>' + H.plural(poker.length, 'item', 'itens') + '</b> para estimar no Poker', poker, '#poker', 'Abre o Planning Poker');
      var pend = S && S.pendentesDeFechamento ? S.pendentesDeFechamento(ctx.D, hoje, feriados(ctx), H.colunaDe) : [];
      if (pend.length) L.push({ ico: 'refresh', cor: 'var(--wn-t)', txt: '<b>' + H.plural(pend.length, 'sprint', 'sprints') + '</b> para fechar',
        meta: pend.slice(0, 2).map(function (p) { return H.esc(S.rotuloCurto(p.rotulo)); }).join(' · '), href: '#sprints/encerrar' });
    }
    // O PESSOAL vale para quem tem demanda no nome, admin e analista inclusive:
    // quem coordena e tambem desenvolve ve as duas listas (antes era uma ou outra).
    if (papel === 'dev' || (papel !== 'consulta' && minhas.length)) {
      var dv = minhas.filter(devolvida);
      if (dv.length) linha('undo', 'var(--wn-t)', '<b>' + H.plural(dv.length, 'devolvida', 'devolvidas') + '</b> para ajuste', dv,
        dv.length === 1 ? H.hrefItem(dv[0]) : '#inicio/meu', 'O PM/PO devolveu com motivo: abra a demanda para ler');
      if (poker.length && papel !== 'admin') linha('cards', 'var(--in-t)', '<b>' + H.plural(poker.length, 'item', 'itens') + '</b> para estimar no Poker', poker, '#poker', 'Abre o Planning Poker');
      var AC = window.AXIS_ACOES;
      var fila = AC && AC.mostraNoPainel ? vs.filter(function (m) {
        var c = H.colunaDe(m);
        return !String(m.dev || '').trim() && ['em_andamento', 'validacao_area', 'validacao', 'concluido', 'negada'].indexOf(c) < 0 &&
          AC.mostraNoPainel(m, AC.contexto(), 'fila');
      }) : [];
      if (fila.length) linha('inbox', 'var(--in-t)', '<b>' + H.plural(fila.length, 'demanda', 'demandas') + '</b> na fila do time, sem dono', fila, '#inicio/meu',
        'Na sprint e sem dono: qualquer um do time pode pegar — combine antes de começar');
      var sp = minhas.filter(semPontos);
      if (sp.length) linha('alert', 'var(--wn-t)', '<b>' + H.plural(sp.length, 'demanda sua', 'demandas suas') + '</b> sem pontos', sp, '#inicio/meu', 'Comprometidas (de Planejado em diante) sem pontuação do Poker');
      var hm = minhas.filter(cobraHom);
      if (hm.length) linha('users', 'var(--pu-t)', '<b>' + H.plural(hm.length, 'sua', 'suas') + '</b> parada' + (hm.length > 1 ? 's' : '') + ' na área', hm, '#inicio/meu', 'Na Validação da área há 5 dias ou mais: a homologação é de quem pediu');
    }
    if (papel === 'consulta') {
      // Consulta: le o time, sem acao — o mesmo dado, sem link para agir.
      var at = vs.filter(atrasada), pa = vs.filter(function (m) { return H.pausada(m) && H.colunaDe(m) !== 'concluido'; }), ho = vs.filter(cobraHom);
      if (at.length) linha('alert', 'var(--dg-t)', '<b>' + H.plural(at.length, 'demanda', 'demandas') + '</b> com prazo vencido', at, '');
      if (pa.length) linha('pause', 'var(--tx3)', '<b>' + H.plural(pa.length, 'pausada', 'pausadas') + '</b> por dependência externa', pa, '');
      if (ho.length) linha('users', 'var(--pu-t)', '<b>' + H.plural(ho.length, 'homologação parada', 'homologações paradas') + '</b> na área', ho, '');
    }
    var corpo = L.length ? L.map(function (x) {
      var tag = x.href ? 'a href="' + x.href + '"' : 'div';
      return '<' + tag + ' class="ini-ag"' + (x.titulo ? ' title="' + H.esc(x.titulo) + '"' : '') + '><span><span style="color:' + x.cor + '">' + H.ico(x.ico) + '</span>' + x.txt + '</span>' +
        '<span class="mt">' + x.meta + '</span></' + (x.href ? 'a' : 'div') + '>';
    }).join('') : '<div class="ini-ag" style="color:var(--tx3)"><span>' + H.ico('check', 'style="color:var(--ok-t)"') + ' Nada esperando ' + (papel === 'consulta' ? 'atenção' : 'você') + ' agora.</span></div>';
    return '<section class="ini-sec"><h2>' + (papel === 'consulta' ? 'Pede atenção' : 'Aguardando você') + '</h2>' + corpo + '</section>';
  }

  /** O placar da sprint corrente (sprint.js), no lugar do "Chamados comigo"
      do prototipo — chamado nao existe no RoadMap. */
  function painelSprint(ctx, sprint) {
    var S = window.SPRINTPO;
    if (!S || !sprint) return '';
    var p = S.placarDaSprint(ctx.D, sprint, H.colunaDe);
    var d = diaDaSprint(sprint, ctx);
    var tot = p.total || 1;
    var seg = function (n, cor) { return n ? '<span style="width:' + (n / tot * 100) + '%;background:' + cor + '"></span>' : ''; };
    var f = S.faixaDaSprint(sprint, feriados(ctx));
    return '<section class="ini-sec" style="border-color:rgba(var(--in-rgb),.25)"><div class="cab"><h2>Sprint ' + H.esc(S.rotuloCurto(sprint)) + '</h2>' +
      (ctx.papel !== 'consulta' ? '<a href="#sprints">Ver sprint</a>' : '') + '</div>' +
      '<span class="note">' + (f ? H.dm(f.de) + ' a ' + H.dm(f.ate) : '') + (d ? ' · ' + (d.acabou ? 'terminou' : d.faltam + ' dia' + (d.faltam === 1 ? '' : 's') + ' úte' + (d.faltam === 1 ? 'il' : 'is') + ' pela frente') : '') +
      ' · ' + H.plural(p.total, 'demanda', 'demandas') + '</span>' +
      (p.total ? '<div class="ini-bar">' + seg(p.validados, 'var(--ok)') + seg(p.aguardando, 'var(--wn)') + seg(p.emCurso, 'var(--ac)') + seg(p.saiu, 'var(--tx4)') + '</div>' +
        '<div class="ini-leg"><span><i class="q" style="background:var(--ok)"></i>' + p.validados + ' validadas</span>' +
        '<span><i class="q" style="background:var(--wn)"></i>' + p.aguardando + ' em validação</span>' +
        '<span><i class="q" style="background:var(--ac)"></i>' + p.emCurso + ' em curso</span>' +
        (p.saiu ? '<span><i class="q" style="background:var(--tx4)"></i>' + p.saiu + ' saíram</span>' : '') + '</div>' +
        (p.semPontuacao ? '<span class="note">' + H.plural(p.semPontuacao, 'demanda', 'demandas') + ' sem pontos do Poker</span>' : '')
        : '<span class="note">Nenhuma demanda repassada pelo PO para esta sprint.</span>') +
      '</section>';
  }

  // ═════════════════════════════════════════════════════════════════════
  //  MEU TRABALHO
  // ═════════════════════════════════════════════════════════════════════
  function cartao(m, ctx, o) {
    o = o || {};
    var fl = [];
    var c = H.colunaDe(m);
    var AC = window.AXIS_ACOES;
    if (o.dono && AC && AC.marcaDono) { var mk = AC.marcaDono(m); if (mk) fl.push(mk); }
    if (o.dono && !o.acao && AC && AC.botaoPegar) o.acao = AC.botaoPegar(m, 'btns', 'Pegar da fila');
    if (H.pausada(m)) fl.push(H.chip(H.ico('pause') + ' pausada', 'mg'));
    else if (atrasada(m)) fl.push(H.chip('atrasada ' + H.atrasoDe(m) + 'd', 'dg'));
    else if (venceHoje(m)) fl.push(H.chip('vence hoje', 'dg'));
    if (devolvida(m)) fl.push(H.chip(H.ico('undo') + ' devolvida', 'wn', 'Motivo: ' + window.DEVOLUCAO.motivo(m)));
    if (c === 'validacao_area') fl.push(H.chip('com a área', 'wn', 'Homologação de ' + (m.solicitante || 'quem pediu')));
    if (c === 'validacao') fl.push(H.chip('com o PO', 'wn'));
    if (semPontos(m)) fl.push(H.chip('sem pontos', 'bk', 'Comprometida sem pontuação do Poker'));
    var datas = o.meta != null ? o.meta
      : (m.inicio && m.entrega && c !== 'concluido' ? H.dm(m.inicio) + ' → ' + H.dm(m.entrega)
        : c === 'concluido' ? 'entregue ' + H.dm(window.CAPACIDADE ? window.CAPACIDADE.diaDaEntrega(m) : m.concluido_em)
        : H.prazoTxt(m).txt);
    var p = H.pontosDe(m);
    var href = link(m, ctx);
    return '<div class="ini-card' + (href ? '' : ' ro') + '"' + (href ? ' data-href="' + href + '"' : '') + '>' +
      (fl.length ? '<span class="fl">' + fl.join('') + '</span>' : '') +
      '<span class="code" style="font-size:11px">' + H.esc(m.codigo || '—') + '</span>' +
      '<span class="t">' + H.esc(m.titulo || '(sem título)') + '</span>' +
      '<span class="note" style="font-size:11.5px">' + H.esc(H.caminho(m.tema_id) || '—') + (o.comDev ? ' · ' + H.esc(m.dev || 'sem dev') : '') + '</span>' +
      '<span class="rd"><span>' + H.esc(datas || '') + '</span><span class="mono" style="color:var(--ac-t)">' + (p ? p + ' pts' : '—') + '</span></span>' +
      (o.acao ? '<span>' + o.acao + '</span>' : '') +
      '</div>';
  }
  function coluna(nome, cor, lista, render, lim) {
    lim = lim || 10;
    return '<section class="ini-col"><div class="ch"><span class="row" style="gap:8px"><span class="dotc" style="background:' + cor + '"></span><b>' + nome + '</b></span>' +
      '<span class="mono note" style="font-size:11.5px">' + lista.length + '</span></div>' +
      (lista.length ? lista.slice(0, lim).map(render).join('') : '<span class="ini-mais">nada aqui</span>') +
      (lista.length > lim ? '<span class="ini-mais">e mais ' + (lista.length - lim) + '</span>' : '') + '</section>';
  }

  function meuTrabalho(ctx) {
    return ctx.aba === 'pede' ? meuTrabalhoPO(ctx) : meuTrabalhoDev(ctx);
  }

  /* A FAIXA DO PRAZO VENCIDO — COPIA DE `renderRiscoDev` (dev.html): as
     demandas no nome de quem olha com a etapa efetiva Atrasado (`statusEfetivo`),
     e quais delas o filtro esta escondendo. `visiveis` = { id: true } do que o
     quadro mostra. Cada uma abre (`devIrPara`). */
  function riscoDoPainel(lista, eMinha, visiveis) {
    var minhas = (lista || []).filter(function (m) { return m && !m.mesclado_em && eMinha(m) && H.etapaDe(m) === 'atrasado'; });
    return { minhas: minhas, escondidas: minhas.filter(function (m) { return !visiveis[m.id]; }) };
  }
  function faixaRisco(r) {
    var n = r.minhas.length, k = r.escondidas.length;
    if (!n) return '';
    var link = function (m) {
      return '<button type="button" class="ini-rl" data-ini="risco-abre" data-id="' + H.esc(m.id) + '">' + H.esc((m.codigo ? m.codigo + ' ' : '') + (m.titulo || '')) + '</button>';
    };
    return '<div class="ini-risco" id="ini-risco" role="alert" tabindex="-1">' + H.ico('alert') + ' <b>' + n +
      (n === 1 ? ' demanda sua está com o prazo vencido' : ' demandas suas estão com o prazo vencido') + ':</b> ' +
      r.minhas.slice(0, 3).map(link).join(' · ') + (n > 3 ? ' <span style="opacity:.8">e mais ' + (n - 3) + '</span>' : '') +
      (k ? '<span class="ini-risco-esc">' + H.ico('search') + ' <b>' + k + (k === 1 ? ' está' : ' estão') + ' escondida' + (k > 1 ? 's' : '') +
        ' pelos filtros ativos.</b> <button type="button" class="ini-rl" data-ini="risco-limpa">limpar os filtros</button></span>' : '') + '</div>';
  }

  /* AS COLUNAS DO PAINEL DO DEV (`COLUMNS`, dev.html), com a ordem do quadro
     (`ORDEMKB`, a mesma das tres telas): Backlog, Planning, Planejado (com Em
     aprovacao de requisitos), Em andamento, Validacao da area, Validacao PM/PO
     e Concluido (o do mes). */
  function colunasDoPainel(noQuadro, noMes) {
    var Q = window.AXIS_QUADRO;
    var ord = function (l) { return window.ORDEMKB ? ORDEMKB.ordena(l, window.ENTREGAUSU && ENTREGAUSU.data) : l.sort(ordemDeAtencao); };
    return (Q ? Q.COLUNAS_DEV : []).map(function (c) {
      var itens = noQuadro.filter(function (m) { var k = H.colunaDe(m); return c.junto.indexOf(k) >= 0 && (k !== 'concluido' || noMes(m)); });
      return { k: c.k, junto: c.junto, rotulo: c.k === 'concluido' ? 'Concluído no mês' : '', itens: ord(itens) };
    });
  }

  // ═══ OS FILTROS E A PRODUTIVIDADE DO MEU TRABALHO (dev.html) ═══════════
  /* `tipo`, `tema`, `ano` e `mes`: os filtros Tipo, Tema e Periodo da barra
     do painel do dev; `prod`: o periodo da produtividade. Ficam enquanto o
     app esta aberto, como o resto do estado da tela. */
  var MEU = { tipo: '', tema: '', ano: '', mes: '', prod: 'semana', pdAberto: false };
  var TIPOS_MEU = [['', 'Todos'], ['sustentacao', 'Sustentação'], ['evolucao', 'Evolução'], ['__sem__', 'Sem tipo']];

  /** As demandas do dev (`doDev` do dev.html): sem a mesclada, no nome dele. */
  function doDev(D) {
    return ((D || {}).melhorias || []).filter(function (m) { return m && !m.mesclado_em && H.minha(m); });
  }
  /* O TEMA COM A CONTAGEM POR SUBARVORE — COPIA de `buildTemaSelect`
     (dev.html): so os temas com demanda do dev (ou o escolhido), e o numero
     conta os filhos (`catalogoCasa`). O filtro tambem e por subarvore: o
     dev.html contava assim e filtrava so o proprio no, e "Cadastro (36)"
     devolvia menos de 36. */
  function contaTemas(dev, temas, atual) {
    var conta = {};
    var visiveis = (temas || []).filter(function (t) {
      var n = window.catalogoCasa ? dev.filter(function (m) { return window.catalogoCasa(m.tema_id, t.id, temas); }).length : dev.filter(function (m) { return m.tema_id === t.id; }).length;
      conta[t.id] = n;
      return n > 0 || atual === t.id;
    });
    return { conta: conta, visiveis: visiveis };
  }
  /* O PERIODO — COPIA de `getFiltered` (dev.html): a referencia e o inicio, ou
     a criacao; `ano` e texto e `mes` e 0 a 11. Com periodo escolhido, as
     concluidas de outros meses voltam (a regra do "Concluido no mes" sai). */
  function casaPeriodo(m, ano, mes) {
    if (!ano && (mes === '' || mes == null)) return true;
    var ref = m.inicio ? new Date(m.inicio + 'T00:00:00') : new Date(m.criado_em);
    if (ano && ref.getFullYear().toString() !== String(ano)) return false;
    if (mes !== '' && mes != null && ref.getMonth() !== +mes) return false;
    return true;
  }
  /** Os anos do filtro (`buildAnoFilter`): os de inicio da base, do mais novo. */
  function anosDaBase(D) {
    var a = {};
    ((D || {}).melhorias || []).forEach(function (m) { if (m && m.inicio) a[String(m.inicio).slice(0, 4)] = 1; });
    return Object.keys(a).sort(function (x, y) { return y - x; });
  }
  function casaMeu(m, D) {
    if (MEU.tipo === '__sem__' ? !!m.tipo : (MEU.tipo && m.tipo !== MEU.tipo)) return false;
    if (MEU.tema && !(window.catalogoCasa ? window.catalogoCasa(m.tema_id, MEU.tema, (D || {}).temas || []) : m.tema_id === MEU.tema)) return false;
    return casaPeriodo(m, MEU.ano, MEU.mes);
  }

  /* O PERIODO DA PRODUTIVIDADE — COPIA de `prodIntervalo` (dev.html), com hoje
     por parametro: a semana de segunda a domingo, o mes atual, o anterior. */
  var PROD_PER = [['semana', 'Esta semana'], ['mes', 'Mês atual'], ['mes_ant', 'Mês anterior']];
  function prodIntervalo(qual, hojeISO) {
    var p = String(hojeISO).slice(0, 10).split('-');
    var hoje = new Date(+p[0], +p[1] - 1, +p[2]);
    var iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    if (qual === 'mes') return { de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)), rot: 'no mês' };
    if (qual === 'mes_ant') return { de: iso(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)), ate: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 0)), rot: 'no mês anterior' };
    var d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    var dw = d.getDay();
    d.setDate(d.getDate() - (dw === 0 ? 6 : dw - 1));
    var fim = new Date(d);
    fim.setDate(fim.getDate() + 6);
    return { de: iso(d), ate: iso(fim), rot: 'na semana' };
  }
  /* O PODIO E A MINHA LINHA — COPIA de `prodAgrega` (dev.html): a conta e a
     do `CAPACIDADE.porDev`, ordenada por pontos entregues, depois issues,
     depois nome; e quantas entregas minhas concluidas nao tem data. */
  function prodAgrega(lista, de, ate, eDeMim) {
    var CAP = window.CAPACIDADE;
    var vivas = (lista || []).filter(function (m) { return m && !m.mesclado_em; });
    var semDataMinhas = 0;
    vivas.forEach(function (m) { if (H.colunaDe(m) === 'concluido' && !CAP.diaDaEntrega(m) && eDeMim(m)) semDataMinhas++; });
    var rank = CAP.porDev(vivas, de, ate).map(function (x) {
      return { nome: x.nome, issues: x.qtdEntregue, pontos: x.entregue, plan: x.plan, semPontuar: x.semPontuar, pct: x.pct };
    }).sort(function (a, b) { return b.pontos - a.pontos || b.issues - a.issues || String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
    return { rank: rank, semDataMinhas: semDataMinhas, totalPts: rank.reduce(function (t, r) { return t + r.pontos; }, 0) };
  }
  function prodNum(n) { return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10).replace('.', ','); }
  /* A FAIXA DA PRODUTIVIDADE (`renderProdutividade`, dev.html): o periodo, a
     minha linha (issues, planejado, entregue, % e "sem pontuar"), o aviso do
     que falta e o podio dos tres primeiros; fora do podio, so a minha
     posicao. */
  function htmlProdutividade(ctx) {
    if (!window.CAPACIDADE) return '';
    var nomes = H.meusNomes();
    var I = prodIntervalo(MEU.prod, H.hoje());
    var A = prodAgrega((ctx.D || {}).melhorias, I.de, I.ate, H.minha);
    var rank = A.rank, temPontos = A.totalPts > 0;
    var eu = rank.find(function (r) { return nomes.indexOf(r.nome) >= 0; });
    var pos = eu ? rank.indexOf(eu) + 1 : 0;
    var meus = eu
      ? '<span>' + H.ico('check') + ' <b>' + prodNum(eu.issues) + '</b> issue' + (eu.issues !== 1 ? 's' : '') + '</span>' +
        (temPontos || eu.plan ? '<span title="Planejado: pontos das demandas com prazo neste período. Entregue: pontos que você tirou da mão, contados na data em que entregou — não na da aprovação.">' +
          H.ico('cards') + ' <b>' + prodNum(eu.plan) + '</b> pt planejados · <b style="color:var(--ok-t)">' + prodNum(eu.pontos) + '</b> entregues' + (eu.pct != null ? ' (' + eu.pct + '%)' : '') + '</span>' : '') +
        (eu.semPontuar ? '<span class="ini-pd-sem" title="Demandas alocadas a você sem pontuação no Planning Poker: enquanto elas não forem pontuadas, o seu planejado aparece menor do que é.">◐ ' + prodNum(eu.semPontuar) + ' sem pontuar</span>' : '') +
        '<span class="note">' + I.rot + '</span>'
      : '<span class="note">Nenhuma entrega ' + I.rot + '.</span>';
    var partes = [], dicas = [];
    if (A.semDataMinhas) {
      partes.push(A.semDataMinhas === 1 ? '1 entrega sua está fora desta conta' : A.semDataMinhas + ' entregas suas estão fora desta conta');
      dicas.push((A.semDataMinhas === 1 ? 'Uma demanda sua foi concluída' : A.semDataMinhas + ' demandas suas foram concluídas') +
        ' sem data registrada, então não pertence' + (A.semDataMinhas === 1 ? '' : 'm') + ' a nenhuma semana nem mês. Peça ao PM/PO para informar a data de entrega.');
    }
    if (!temPontos && rank.length) {
      partes.push('nenhuma entrega pontuada');
      dicas.push('Nenhuma entrega deste período recebeu pontos no Planning Poker, então a ordem do pódio segue a quantidade de issues.');
    }
    var podio = !rank.length ? '<span class="note">Sem entregas aprovadas neste período — o pódio aparece quando houver.</span>'
      : rank.slice(0, 3).map(function (r, i) {
          return '<span class="ini-pd-md' + (eu === r ? ' eu' : '') + '" title="' + (i + 1) + 'º lugar · ' + prodNum(r.issues) + ' issue' + (r.issues !== 1 ? 's' : '') +
            (temPontos ? ' · ' + prodNum(r.pontos) + ' pontos' : '') + '"><b class="ps">' + (i + 1) + 'º</b> <b>' + H.esc(r.nome) + '</b> <span class="mono">' + prodNum(r.issues) +
            (temPontos ? ' · ' + prodNum(r.pontos) + ' pt' + (r.plan ? ' / ' + prodNum(r.plan) : '') : '') + '</span></span>';
        }).join('') + (pos > 3 ? '<span class="note">· você em <b>' + pos + 'º</b> de ' + rank.length + '</span>'
          : !eu ? '<span class="note">· você ainda não tem entrega aprovada neste período</span>' : '');
    // No celular o periodo e o podio recolhem num botao: a faixa nao empurra o quadro para baixo.
    return '<section class="ini-pd' + (MEU.pdAberto ? ' aberto' : '') + '" aria-label="Produtividade"><span class="ini-pd-t">' + H.ico('trophy') + ' Produtividade</span>' +
      '<button type="button" class="btns ini-pd-tg" data-meu-pd="1" aria-expanded="' + MEU.pdAberto + '">' + (MEU.pdAberto ? 'Recolher' : 'Período e pódio' + (pos ? ' · ' + pos + 'º' : '')) + '</button>' +
      '<select class="in" data-meu="prod" aria-label="Período da produtividade" title="Período do consolidado">' +
      PROD_PER.map(function (o) { return '<option value="' + o[0] + '"' + (MEU.prod === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      '<span class="ini-pd-meus">' + meus + '</span>' +
      (partes.length ? '<span class="ini-pd-av" title="' + H.esc(dicas.join('\n\n')) + '">' + H.ico('alert') + ' ' + H.esc(partes.join(' · ')) + '</span>' : '') +
      '<span class="ini-pd-podio">' + podio + '</span></section>';
  }
  /* O CSS DESTES BLOCOS, a parte: a folha da tela e dividida com a aba "O que
     pede voce". */
  function cssMeu() {
    if (document.getElementById('css-ini-meu')) return;
    var st = document.createElement('style');
    st.id = 'css-ini-meu';
    st.textContent = [
      '.axa .ini-pd{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:12px 16px;border-radius:16px;background:rgba(var(--sf-rgb),.6);border:1px solid var(--bd);font-size:12.5px;color:var(--tx2)}',
      '.axa .ini-pd-t{font-weight:800;color:var(--tx);display:inline-flex;align-items:center;gap:6px}',
      '.axa .ini-pd select.in{height:32px;font-size:12.5px;width:auto}',
      '.axa .ini-pd-meus,.axa .ini-pd-podio{display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px 12px}',
      '.axa .ini-pd-sem{color:var(--wn-t)}',
      '.axa .ini-pd-av{color:var(--wn-t);font-weight:600;cursor:help}',
      '.axa .ini-pd-md{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;background:var(--sf3);border:1px solid var(--bd2)}',
      '.axa .ini-pd-md .ps{font-family:var(--font-mono);color:var(--ac-t)}',
      '.axa .ini-pd-md.eu{border-color:rgba(var(--ac-rgb),.6);background:rgba(var(--ac-rgb),.1)}',
      '.axa .ini-pd-podio{margin-left:auto}',
      '.axa .ini-pd-tg{display:none}',
      '@container app (max-width: 760px){.axa .ini-pd{font-size:12px;padding:10px 12px}.axa .ini-pd select.in{min-height:44px;flex:1 1 100%}' +
        '.axa .ini-pd-podio{margin-left:0}.axa .ini-pd .note{font-size:12px}' +
        '.axa .ini-pd-tg{display:inline-flex;align-items:center;min-height:44px;margin-left:auto}' +
        '.axa .ini-pd:not(.aberto) select.in,.axa .ini-pd:not(.aberto) .ini-pd-podio,.axa .ini-pd:not(.aberto) .ini-pd-av{display:none}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function meuTrabalhoDev(ctx) {
    var S = window.SPRINTPO, CAP = window.CAPACIDADE, Q = window.AXIS_QUADRO;
    var vs = H.visiveis();
    var minhas = vs.filter(H.minha);
    var sprint = H.sprintAtual();
    var d = diaDaSprint(sprint, ctx);
    var mes = mesAtual();
    // Com Periodo escolhido, as concluidas dele aparecem todas (`getFiltered`, dev.html).
    var comPeriodo = !!(MEU.ano || MEU.mes !== '');
    var noMes = function (m) { return comPeriodo || (CAP && CAP.diaDaEntrega(m).slice(0, 7) === mes); };
    if (Q) Q.css();
    cssMeu();

    /* O QUADRO PESSOAL MOSTRA O QUE O PAINEL DO DEV MOSTRA (`getFiltered`):
       no nome dele e a fila do time, com o filtro "Mostrar". */
    var AC = window.AXIS_ACOES;
    var cx = AC && AC.contexto ? AC.contexto() : null;
    // A sprint atual e o padrao (368342d): escolhida so na primeira montagem.
    if (!EST.sprintPadrao && sprint) { EST.sprintPadrao = true; EST.sprint = sprint; }
    var opsSprint = AC && AC.sprintsDoPainel ? AC.sprintsDoPainel(vs, cx, sprint) : [];
    // A escolha sobrevive ao redesenho, a nao ser que a sprint tenha saido da lista.
    if (EST.sprint && !opsSprint.some(function (o) { return o.v === EST.sprint; })) EST.sprint = '';
    var doPainel = AC && AC.mostraNoPainel
      ? vs.filter(function (m) { return AC.mostraNoPainel(m, cx, EST.mostrar); })
      : minhas;
    var noQuadro = (AC && AC.casaSprintDoPainel
      ? doPainel.filter(function (m) { return AC.casaSprintDoPainel(m, cx, EST.sprint); })
      : doPainel).filter(function (m) { return casaMeu(m, ctx.D); });
    var times = AC && AC.times ? AC.times() : '';
    var filtrosAtivos = (EST.sprint !== (sprint || '') ? 1 : 0) + (times ? 1 : 0);
    filtrosAtivos += (MEU.tipo ? 1 : 0) + (MEU.tema ? 1 : 0) + (MEU.ano ? 1 : 0) + (MEU.mes !== '' ? 1 : 0);
    /* TIPO E TEMA COM A CONTAGEM (`f-tipo` e `buildTemaSelect`, dev.html): os
       numeros sao das demandas do dev; o tema so lista os que ele tem. */
    var dDev = doDev(ctx.D);
    var ct = contaTemas(dDev, (ctx.D || {}).temas || [], MEU.tema);
    var nTipo = function (v) { return v === '__sem__' ? dDev.filter(function (m) { return !m.tipo; }).length : v ? dDev.filter(function (m) { return m.tipo === v; }).length : dDev.length; };
    var cols = colunasDoPainel(noQuadro, noMes);
    var porCol = {};
    cols.forEach(function (c) { porCol[c.k] = c.itens; });
    // No celular (uma etapa por vez) o Meu trabalho abre onde ha trabalho: Em andamento, ou a primeira com card.
    if (!EST.etapa) {
      var comCard = cols.filter(function (c) { return c.itens.length; });
      EST.etapa = (porCol.em_andamento || []).length ? 'em_andamento' : comCard.length ? comCard[0].k : '';
    }
    var andamento = porCol.em_andamento || [];
    var validacao = (porCol.validacao_area || []).concat(porCol.validacao || []);

    // Pontos entregues no mes: capacidade.porDev, a mesma conta da faixa de
    // produtividade do dev.html (`prodAgrega`).
    var ent = { entregue: 0, plan: 0, pct: null };
    if (CAP) {
      var ini = mes + '-01', fim = mes + '-31';
      var nomes = H.meusNomes();
      CAP.porDev(vs, ini, fim).forEach(function (r) {
        if (nomes.indexOf(r.nome) >= 0) { ent.entregue += r.entregue; ent.plan += r.plan; }
      });
    }
    var sp = { total: 0, feitos: 0 };
    if (S && sprint) {
      var nm = H.meusNomes();
      S.rankingDaSprint(ctx.D, sprint, H.colunaDe).forEach(function (r) {
        if (nm.indexOf(r.nome) >= 0) { sp.total += r.pontosTotal; sp.feitos += r.pontos; }
      });
    }
    var pct = sp.total ? Math.round(sp.feitos / sp.total * 100) : 0;
    var vHoje = minhas.filter(venceHoje);
    var visiveis = {};
    cols.forEach(function (c) { c.itens.forEach(function (m) { visiveis[m.id] = true; }); });
    var risco = riscoDoPainel((ctx.D || {}).melhorias, H.minha, visiveis);

    var sub = (EST.mostrar === 'meu' ? 'Só o que está no seu nome.' : EST.mostrar === 'fila' ? 'A fila do time: na sprint, sem dono ou com outra pessoa.' : 'O que está com você e a fila do time.') + (sprint ? ' Sprint ' + H.esc(S.rotuloCurto(sprint)) + ' · ' +
      (d ? (d.acabou ? 'terminou ' + H.dm(d.ate) : 'faltam ' + H.plural(d.faltam, 'dia útil', 'dias úteis')) : '') + '.' : '');
    var opt = function (v, rot, sel) { return '<option value="' + H.esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + H.esc(rot) + '</option>'; };
    // No celular os filtros recolhem em "Filtros (n)" (H.filtros); cada rotulo anda com o seu seletor.
    var fl = '<span class="qd-par"><label class="note" for="ini-mostrar">Mostrar</label>' +
      '<select id="ini-mostrar" class="in" data-ini="mostrar" style="height:36px" title="Separa as demandas no seu nome das que estão na fila do time.">' +
      [['', 'No meu nome + fila do time'], ['meu', 'Só no meu nome'], ['fila', 'Só a fila do time']].map(function (o) {
        return '<option value="' + o[0] + '"' + (EST.mostrar === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></span>' +
      // Sprint (368342d): abre na atual; a contagem e a das demandas no seu nome, como no painel.
      (opsSprint.length ? '<span class="qd-par"><label class="note" for="ini-sprint">Sprint</label>' +
        '<select id="ini-sprint" class="in" data-ini="sprint" style="height:36px" title="Abre na sprint atual. Escolha outra, Todas ou Fora da sprint.">' +
        opsSprint.map(function (o) {
          var rot = o.v === '' ? 'Todas' : o.v === '__fora__' ? 'Fora da sprint' : S.rotuloCurto(o.v) + (o.agora ? ' · agora' : '');
          return opt(o.v, rot + ' (' + o.n + ')', EST.sprint);
        }).join('') + '</select></span>' : '') +
      // Times (5c849fb): por padrao so o seu time; a escolha soma a fila e a vitrine do outro.
      (AC && AC.times ? '<span class="qd-par"><label class="note" for="ini-times">Times</label>' +
        '<select id="ini-times" class="in" data-ini="times" style="height:36px" title="Por padrão aparece só o seu time. Escolha outro para ver a fila dele e poder ajudar.">' +
        opt('', 'Só o meu time', times) + opt('dados', '+ Dados/BI', times) + opt('sales', '+ Sales Ops', times) + opt('todos', 'Todos os times', times) + '</select></span>' : '') +
      '<span class="qd-par"><label class="note" for="ini-tipo">Tipo</label><select id="ini-tipo" class="in" data-meu="tipo" style="height:36px">' +
        TIPOS_MEU.map(function (o) { return opt(o[0], o[1] + ' (' + nTipo(o[0]) + ')', MEU.tipo); }).join('') + '</select></span>' +
      '<span class="qd-par"><label class="note" for="ini-tema">Tema</label><select id="ini-tema" class="in" data-meu="tema" style="height:36px;max-width:240px">' +
        opt('', 'Todos (' + dDev.length + ')', MEU.tema) + (window.catalogoOpcoesHTML ? window.catalogoOpcoesHTML(ct.visiveis, MEU.tema || '', { vazio: false, contagem: ct.conta }) : '') + '</select></span>' +
      // Periodo (`f-ano` e `f-mes`): pelo inicio, ou pela criacao.
      '<span class="qd-par"><label class="note" for="ini-ano">Período</label><select id="ini-ano" class="in" data-meu="ano" style="height:36px" aria-label="Ano">' +
        opt('', 'Todos os anos', MEU.ano) + anosDaBase(ctx.D).map(function (a) { return opt(a, a, MEU.ano); }).join('') + '</select>' +
        '<select id="ini-mes" class="in" data-meu="mes" style="height:36px" aria-label="Mês">' + opt('', 'Todos os meses', MEU.mes) +
        H.MESES.map(function (n, i) { return opt(String(i), n.charAt(0).toUpperCase() + n.slice(1), MEU.mes); }).join('') + '</select></span>' +
      (filtrosAtivos ? '<button type="button" class="btns" data-ini="limpar" style="height:36px" title="Volta para a sprint atual e só o seu time">Limpar (' + filtrosAtivos + ')</button>' : '');
    var h = '<header class="ini-hd fim ini-hd-meu"><div style="display:flex;flex-direction:column;gap:6px;min-width:0"><h1 class="h1">Meu trabalho</h1><span class="sub ini-sub">' + sub + '</span></div>' +
      '<div class="ini-fil">' + H.filtros(fl, filtrosAtivos + (EST.mostrar ? 1 : 0), { id: 'meu' }) +
      '<button type="button" class="btnp ini-novo" data-axa-form="novo">+ Nova demanda</button></div></header>';

    var kp = '<div class="ini-kg seis">' +
      kpi('Em andamento', andamento.length, null, { cor: 'var(--ac-t)' }) +
      kpi('Vencem hoje', vHoje.length, null, { cls: vHoje.length ? 'dg' : '', cor: vHoje.length ? 'var(--dg-t)' : '' }) +
      kpi('Em validação', validacao.length, null) +
      // O numero do prazo vencido leva as demandas (a faixa do dev.html): uma abre direto; mais, a faixa com cada uma.
      kpi('Atrasadas', risco.minhas.length, null, { cls: risco.minhas.length ? 'dg' : '', cor: risco.minhas.length ? 'var(--dg-t)' : '',
        ini: risco.minhas.length ? 'risco' : '', titulo: risco.minhas.length === 1 ? 'Abre ' + (risco.minhas[0].codigo || 'a demanda') : 'Mostra quais são' }) +
      // "No mes" nao depende da sprint escolhida: conta o que o painel mostra no mes inteiro.
      kpi('Entregues no mês', doPainel.filter(function (m) { return H.colunaDe(m) === 'concluido' && noMes(m); }).length, null, { cor: 'var(--ok-t)' }) +
      kpi('Meus pontos na sprint', sp.feitos + ' / ' + sp.total, null, {
        extra: '<span class="note" style="margin-top:-2px">' + ent.entregue + ' pts entregues em ' + H.esc(H.MESES[+mes.slice(5, 7) - 1]) +
          (ent.plan ? ' de ' + ent.plan + ' planejados' : '') + '</span>' +
          '<div class="bar"><span style="width:' + pct + '%;background:linear-gradient(90deg,var(--ac),var(--ac-t))"></span></div>' }) +
      '</div>';

    var quadro = !Q ? '' : '<div class="qd ini-qd" style="display:flex;flex-direction:column;gap:12px;min-width:0">' +
      Q.abasEtapas(cols.map(function (c) { return { k: c.k, rotulo: c.rotulo, n: c.itens.length }; }), EST.etapa) +
      '<div class="qd-rolo" id="ini-rolo"><div class="qd-board">' + cols.map(function (c) {
        return Q.coluna(c.k, c.itens, { junto: c.junto, rotulo: c.rotulo || '', lim: EST.mais[c.k] ? Math.max(c.itens.length, 1) : POR_COLUNA, todos: true });
      }).join('') + '</div></div></div>';
    // O Backlog sem sprint fica fora da sprint escolhida: o rodape diz quantas e mostra todas num clique.
    var bkFora = minhas.filter(function (m) { return H.colunaDe(m) === 'backlog' && !visiveis[m.id]; }).length;
    var rod = bkFora && EST.sprint ? '<span class="note">Mais ' + H.plural(bkFora, 'demanda sua', 'demandas suas') + ' no Backlog fora desta sprint. ' +
      '<button type="button" class="ini-rl" data-ini="sprint-todas" style="color:var(--ac-t)">Ver todas as sprints</button></span>' : '';
    if (!noQuadro.length && EST.mostrar === 'fila') {
      return h + kp + faixaRisco(risco) + H.vazio('inbox', 'A fila do time está vazia', 'Nada na sprint em curso está sem dono agora.');
    }
    if (!noQuadro.length && doPainel.length) {
      return h + kp + faixaRisco(risco) + H.vazio('inbox', 'Nada nesta sprint com estes filtros', 'Troque a sprint no filtro ou escolha Todas.') + rod;
    }
    if (!minhas.length && !noQuadro.length) {
      // O vinculo do 1o acesso (dev.html, `corrigirVinculo`): escolher como o nome aparece nas demandas.
      return h + H.vazio('user', 'Nenhuma demanda com o seu nome',
        'O RoadMap procura por ' + (H.meusNomes().join(', ') || 'seu nome') + ' no campo dev. Se o nome nas demandas estiver diferente, escolha como ele aparece.',
        '<button type="button" class="btnp" data-ini="vinculo">Escolher meu nome nas demandas</button>');
    }
    return h + kp + htmlProdutividade(ctx) + faixaRisco(risco) + quadro + rod;
  }

  function meuTrabalhoPO(ctx) {
    var S = window.SPRINTPO, HO = window.HOMOLOGACAO;
    var vs = H.visiveis();
    var hoje = H.hoje();
    var val = vs.filter(function (m) { return H.colunaDe(m) === 'validacao'; })
      // Quem entregou primeiro espera ha mais tempo (a ordem da rota validacao-pendentes).
      .sort(function (a, b) { return String(a.entregue_em || '9999').localeCompare(String(b.entregue_em || '9999')); });
    var hom = vs.filter(cobraHom).sort(function (a, b) { return (HO.diasNaArea(b, hoje) || 0) - (HO.diasNaArea(a, hoje) || 0); });
    var atr = vs.filter(atrasada).sort(ordemDeAtencao);
    var pok = vs.filter(paraEstimar);
    var pend = S && S.pendentesDeFechamento ? S.pendentesDeFechamento(ctx.D, hoje, feriados(ctx), H.colunaDe) : [];

    var h = '<header class="ini-hd fim"><div style="display:flex;flex-direction:column;gap:6px"><h1 class="h1">O que pede você</h1>' +
      '<span class="sub">Entregas para validar, homologações paradas na área, prazos vencidos e itens para estimar.</span></div>' +
      '<div class="row" style="flex-wrap:wrap"><a class="btn" href="#poker" title="Abre o Planning Poker do app">' + H.ico('cards') + ' Planning Poker</a>' +
      '<a class="btnp" href="#backlog/validacao" title="As entregas esperando o seu aceite, com o que o dev implementou">Ir à validação</a></div></header>';
    var kp = '<div class="ini-kg ini-kg-pede">' +
      kpi('Para validar', val.length, val.length ? 'mais antiga entregue ' + (H.dm(val[0].entregue_em) || '—') : 'fila vazia', { cls: val.length ? 'ac' : '', href: '#backlog/validacao' }) +
      kpi('Homologações a cobrar', hom.length, HO.DIAS_ATE_COBRAR + '+ dias na área sem registro', { cor: hom.length ? 'var(--pu-t)' : '' }) +
      kpi('Atrasadas', atr.length, atr.length ? codigos(atr) : 'tudo no prazo', { cls: atr.length ? 'dg' : '', cor: atr.length ? 'var(--dg-t)' : '', href: '#backlog/vencido' }) +
      kpi('Para estimar', pok.length, 'em Planning sem pontos', { href: '#poker' }) +
      kpi('Sprints a fechar', pend.length, pend.length ? pend.map(function (p) { return H.esc(S.rotuloCurto(p.rotulo)); }).join(', ') : 'nenhuma pendente', { cls: pend.length ? 'ac' : '', href: '#sprints/encerrar' }) +
      '</div>';
    var AC = window.AXIS_ACOES;
    var cols = '<div class="ini-cols q4">' +
      coluna('VALIDAÇÃO PM/PO', 'var(--wn)', val, function (m) {
        return cartao(m, ctx, { comDev: true, meta: m.entregue_em ? 'entregue ' + H.dm(m.entregue_em) : 'aguardando o PO',
          acao: '<a class="btns" href="#backlog/validacao/' + encodeURIComponent(m.codigo || m.id) + '" title="Abre ' + H.esc(m.codigo || '') + ' na Validação do PO: o que foi entregue, validar ou devolver">Validar</a>' });
      }) +
      coluna('HOMOLOGAÇÃO A COBRAR', 'var(--pu)', hom, function (m) {
        return cartao(m, ctx, { comDev: true, meta: (HO.diasNaArea(m, hoje) || 0) + ' dias na área · ' + (m.solicitante || 'sem solicitante'),
          acao: AC ? AC.botao('homologar', m, 'Registrar', 'btns', { titulo: 'Registra quem homologou ' + (m.codigo || '') + ' na área' }) : '' });
      }) +
      coluna('PRAZO VENCIDO', 'var(--dg)', atr, function (m) { return cartao(m, ctx, { comDev: true }); }) +
      coluna('PARA ESTIMAR', 'var(--in)', pok, function (m) { return cartao(m, ctx, { comDev: true, meta: 'sem pontos do Poker' }); }) +
      '</div>';
    return h + kp + cols;
  }

  // ═════════════════════════════════════════════════════════════════════
  //  CRONOGRAMA
  // ═════════════════════════════════════════════════════════════════════
  function maisDias(iso, n) {
    var d = H.data(iso); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* COPIA DE `prazoNivel` (dev.html, "ALERTA POR PRAZO"): amarelo um dia antes,
     vermelho no dia, comparando a `entrega` GRAVADA como texto. Candidata a
     modulo — hoje o cronograma do dev e esta tela tem cada um a sua.
     Um ajuste, e so um: no dev.html o relogio parado vira "em validação" para
     QUALQUER etapa fora de `ETAPAS_QUE_CORREM`, o que inclui backlog e
     levantar_req com data. Aqui so as duas validacoes dizem "em validação";
     backlog com data fica "no prazo", que e o que o dev.html mostraria para
     uma demanda sem relogio correndo. */
  function prazoNivel(m, hoje) {
    var sk = H.colunaDe(m);
    if (H.pausada(m)) return 'pausada';
    if (sk === 'concluido') return 'feito';
    if (EM_VALIDACAO.indexOf(sk) >= 0) return 'entregue';
    if (window.PRAZO && window.PRAZO.relogioParou(sk)) return 'ok';
    if (sk === 'negada' || !m.entrega) return 'ok';
    if (m.entrega < hoje) return 'vencida';
    if (m.entrega === hoje) return 'hoje';
    if (m.entrega === maisDias(hoje, 1)) return 'amanha';
    return 'ok';
  }
  var NIVEL = {
    ok:       { rot: 'no prazo',     cor: 'var(--in)' },
    amanha:   { rot: 'vence amanhã', cor: 'var(--wn)' },
    hoje:     { rot: 'vence hoje',   cor: 'var(--dg)' },
    vencida:  { rot: 'vencida',      cor: 'var(--dg)' },
    entregue: { rot: 'em validação', cor: 'var(--pu)' },
    feito:    { rot: 'concluída',    cor: 'var(--ok)' },
    pausada:  { rot: 'pausada',      cor: 'var(--tx4)' }
  };

  function cronograma(ctx) {
    var vs = H.visiveis();
    var hoje = H.hoje();
    var dev = ctx.papel === 'dev';
    var DIAS = 28;
    // Janela: da segunda da semana passada, quatro semanas. As setas andam
    // duas semanas — o mesmo passo de quem olha "esta e a proxima".
    var hj = H.data(hoje);
    var seg = maisDias(hoje, -((hj.getDay() + 6) % 7) - 7 + EST.cronDesloc * 14);
    var dias = [];
    var fer = {};
    feriados(ctx).forEach(function (f) { fer[String(f && f.data || f).slice(0, 10)] = (f && f.nome) || 'feriado'; });
    var SIG = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    for (var i = 0; i < DIAS; i++) {
      var s = maisDias(seg, i), d = H.data(s);
      dias.push({ s: s, n: d.getDate(), w: SIG[d.getDay()], fds: d.getDay() === 0 || d.getDay() === 6 || !!fer[s], fer: fer[s] || '' });
    }
    var A0 = dias[0].s, B0 = dias[DIAS - 1].s;

    // Mesmo recorte do dev.html: so o que tem inicio ou entrega e toca a janela.
    var base = dev ? vs.filter(H.minha) : vs.filter(function (m) {
      if (!EST.cronDev) return true;
      return window.DEVNOME ? window.DEVNOME.eDe(m, EST.cronDev) : H.devsDe(m).indexOf(EST.cronDev) >= 0;
    });
    var linhas = base.filter(function (m) {
      if (H.colunaDe(m) === 'negada') return false;
      var ini = m.inicio || m.entrega, fim = m.entrega || m.inicio;
      if (!ini || !fim) return false;
      return ini <= B0 && fim >= A0;
    }).sort(function (a, b) { return String(a.inicio || a.entrega).localeCompare(String(b.inicio || b.entrega)); });

    var colunas = '240px repeat(' + DIAS + ', minmax(0, 1fr))';
    var titulo = dev ? 'Meu cronograma' : 'Cronograma do time';
    var nav = '<div class="row" style="flex-wrap:wrap">' +
      (!dev ? '<select class="in" data-ini="cron-dev" style="height:32px" aria-label="Filtrar por dev"><option value="">Todo o time</option>' +
        ((ctx.D || {}).desenvolvedores || []).map(function (n) { return '<option' + (n === EST.cronDev ? ' selected' : '') + '>' + H.esc(n) + '</option>'; }).join('') + '</select>' : '') +
      '<button type="button" class="btns" data-ini="cron" data-d="-1" aria-label="Duas semanas antes">‹</button>' +
      '<span class="in" style="height:32px">' + H.dm(A0) + ' a ' + H.dm(B0) + '</span>' +
      '<button type="button" class="btns" data-ini="cron" data-d="1" aria-label="Duas semanas depois">›</button>' +
      (EST.cronDesloc ? '<button type="button" class="btns" data-ini="cron" data-d="0">Hoje</button>' : '') +
      /* O "MEU RESUMO" DO CRONOGRAMA DO dev.html, ao lado da navegacao e nao
         dentro do cronograma: o resumo nao e da janela, e de tudo que esta na
         mao da pessoa. Para o PM/PO, o do dev escolhido no filtro. */
      (window.RESUMODEV && (dev || EST.cronDev)
        ? '<button type="button" class="btns" data-ini="resumo" title="Resumo do que está na ' + (dev ? 'sua mão' : 'mão de ' + H.esc(EST.cronDev)) +
          ' — atrasado, em andamento e em validação, com texto pronto para o grupo">' + H.ico('clipboard') + ' ' + (dev ? 'Meu resumo' : 'Resumo de ' + H.esc(EST.cronDev)) + '</button>'
        : '') + '</div>';
    var h = '<header class="ini-hd fim"><div style="display:flex;flex-direction:column;gap:6px"><h1 class="h1">' + titulo + '</h1>' +
      '<span class="sub">' + (dev ? 'Suas demandas' : 'As demandas do time') + ' nas próximas semanas. Somente leitura: datas mudam no planejamento.</span></div>' + nav + '</header>';
    var leg = '<div class="ini-leg">' + ['ok', 'amanha', 'hoje', 'entregue', 'feito', 'pausada'].map(function (k) {
      return '<span><i class="q" style="background:' + NIVEL[k].cor + '"></i>' + (k === 'hoje' ? 'vence hoje ou vencida' : NIVEL[k].rot) + '</span>';
    }).join('') + '</div>';

    if (!linhas.length) {
      return h + leg + '<section class="pn">' + H.vazio('calendar', dev ? 'Nenhuma demanda sua com datas nestas semanas' : 'Nenhuma demanda com datas nestas semanas',
        'Demandas sem data de início e entrega não aparecem no cronograma — quem define as datas é o PM/PO no planejamento.') + '</section>';
    }
    var mostra = linhas.slice(0, EST.cronLimite);
    var iHoje = -1;
    dias.forEach(function (d, i) { if (d.s === hoje) iHoje = i; });
    var cab = '<div class="ln cab" style="grid-template-columns:' + colunas + '"><span class="lab" style="padding:12px 14px">DEMANDA</span>' +
      dias.map(function (d) {
        return '<span class="dia' + (d.s === hoje ? ' hj' : d.fds ? ' fds' : '') + '"' + (d.fer ? ' title="' + H.esc(d.fer) + '"' : '') + '><b>' + d.n + '</b>' + d.w + '</span>';
      }).join('') + '</div>';
    var corpo = mostra.map(function (m) {
      var ini = m.inicio || m.entrega, fim = m.entrega || m.inicio;
      var i0 = -1, i1 = -1;
      dias.forEach(function (d, i) { if (i0 < 0 && d.s >= ini) i0 = i; if (d.s <= fim) i1 = i; });
      if (i0 < 0) i0 = 0;
      if (i1 < i0) i1 = i0;
      var nv = prazoNivel(m, hoje);
      var N = NIVEL[nv];
      var href = link(m, ctx);
      var tit = (m.codigo ? m.codigo + ' · ' : '') + (m.titulo || '') + ' — ' + N.rot + (m.entrega ? ' (' + H.dma(m.entrega) + ')' : '');
      return '<div class="ln" style="grid-template-columns:' + colunas + '">' +
        '<span class="rot"><span class="code" style="font-size:11px">' + H.esc(m.codigo || '—') + (!dev && m.dev ? ' <span style="color:var(--tx3);font-family:var(--font-ui)">· ' + H.esc(m.dev) + '</span>' : '') + '</span>' +
        '<span class="t" title="' + H.esc(m.titulo) + '">' + H.esc(m.titulo || '(sem título)') + '</span></span>' +
        (iHoje >= 0 ? '<span class="hjc" style="grid-column:' + (iHoje + 2) + '"></span>' : '') +
        '<' + (href ? 'a href="' + href + '"' : 'span') + ' class="br' + (href ? '' : ' ro') + '" title="' + H.esc(tit) + '" style="grid-column:' + (i0 + 2) + ' / ' + (i1 + 3) + ';background:' + N.cor +
        (nv === 'vencida' ? ';opacity:.62' : '') + (nv === 'pausada' ? ';color:var(--tx)' : '') + '">' + H.esc(N.rot) + '</' + (href ? 'a' : 'span') + '>' +
        '</div>';
    }).join('');
    var mais = linhas.length > mostra.length
      ? '<button type="button" class="btns" data-ini="cron-mais" style="align-self:center">Mostrar mais ' + Math.min(40, linhas.length - mostra.length) + ' de ' + (linhas.length - mostra.length) + '</button>' : '';
    return h + leg + '<section class="pn ini-cr" style="overflow-x: auto"><div style="min-width:900px">' + cab + corpo + '</div></section>' + mais;
  }

  /* `RESUMODEV.abrir(state, currentDev, { proprio: true })`, como no dev.html.
     O nome e o da grafia da base (o `currentDev`): o resumo compara pelo
     DEVNOME, e o nome declarado com duas grafias nao e um nome de demanda. */
  function abrirResumo(ctx) {
    var R = window.RESUMODEV;
    if (!R) return;
    var dev = ctx.papel === 'dev';
    var C = window.AXIS_CONTA;
    var nome = dev ? (C && C.meuDev ? C.meuDev(ctx.eu, ctx.D) : (H.meusNomes()[0] || '')) : EST.cronDev;
    if (!nome) { H.toast('Escolha antes o seu nome nas demandas, em Minha conta.', 'erro'); return; }
    R.abrir(ctx.D, nome, { proprio: dev });
    var cx = document.getElementById('modal-dev-resumo');
    if (!cx) return;
    var fechar = cx.querySelector('.modal-close-btn');
    if (fechar) fechar.focus();
    // Esc fecha, como as caixas do app (o modulo so fecha no clique).
    if (!cx.__esc) {
      cx.__esc = true;
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && cx.style.display !== 'none') { e.preventDefault(); R.fechar(); }
      });
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  //  NOTIFICACOES
  // ═════════════════════════════════════════════════════════════════════
  var CAMPO = { status_planejamento: 'etapa', entrega: 'entrega', inicio: 'início', dev: 'dev', poker_pontos: 'pontos',
                sprint_po: 'sprint', titulo: 'título', descricao: 'descrição', prioridade: 'prioridade',
                validacao_obs: 'motivo da devolução', implementacao: 'implementação', resumo_entrega: 'resumo da entrega' };
  function quando(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var dia = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    var hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    var dd = H.dias(dia, H.hoje());
    if (dd === 0) return hm;
    if (dd === 1) return 'ontem';
    return H.dm(dia);
  }
  function eu(nome) {
    var n = String(nome || '').trim().toLowerCase();
    if (!n) return false;
    return H.meusNomes().concat([A.APP.eu && A.APP.eu.nome || '']).some(function (x) { return String(x).trim().toLowerCase() === n; });
  }

  function itensNotificacao(ctx) {
    var vs = H.visiveis();
    var hoje = H.hoje();
    var limite = maisDias(hoje, -14);
    var dev = ctx.papel === 'dev';
    var acao = A.notificacoes().map(function (n) {
      return { tipo: 'acao', ico: n.ico, cor: n.cor, t: n.txt, d: 'Pede ação', href: n.href, em: '', nv: true };
    });
    // As demandas "do usuario": as dele para o dev; o time para o PM/PO, que
    // e quem responde por todas.
    var dele = dev ? vs.filter(H.minha) : vs;
    var hist = [];
    dele.forEach(function (m) {
      (Array.isArray(m.historico) ? m.historico : []).forEach(function (e) {
        if (!e || !e.em || String(e.em).slice(0, 10) < limite) return;
        if (eu(e.quem)) return;  // o que a propria pessoa fez nao e novidade para ela
        var mus = e.mudancas || [];
        var et = mus.filter(function (c) { return c.campo === 'status_planejamento'; })[0];
        var txt, ico = 'edit', cor = 'var(--tx3)';
        if (et) {
          var para = (H.ETAPA_POR_ID[et.para] || {}).rotulo || et.para;
          txt = '<b>' + H.esc(e.quem || 'Alguém') + '</b> moveu ' + H.esc(m.codigo || '') + ' para ' + H.esc(para);
          ico = et.para === 'concluido' ? 'check' : 'refresh';
          cor = et.para === 'concluido' ? 'var(--ok-t)' : 'var(--in-t)';
        } else {
          var cs = mus.map(function (c) { return c.rotulo || CAMPO[c.campo] || c.campo; }).filter(Boolean);
          txt = '<b>' + H.esc(e.quem || 'Alguém') + '</b> alterou ' + H.esc(cs.slice(0, 3).join(', ') || 'a demanda') + (cs.length > 3 ? ' e mais ' + (cs.length - 3) : '') + ' em ' + H.esc(m.codigo || '');
        }
        hist.push({ tipo: 'hist', ico: ico, cor: cor, t: txt, d: H.esc(m.titulo || '') + (e.origem ? ' · pelo ' + H.esc(e.origem) : ''), href: link(m, ctx), em: e.em });
      });
    });
    // Mencoes: @nome nas mensagens da demanda (campo `mensagens`).
    var men = [];
    var nomes = H.meusNomes().concat([(ctx.eu || {}).nome || '']).filter(Boolean);
    vs.forEach(function (m) {
      (Array.isArray(m.mensagens) ? m.mensagens : []).forEach(function (x) {
        if (!x || !x.texto || eu(x.quem)) return;
        var t = String(x.texto);
        if (!nomes.some(function (n) { return t.indexOf('@' + n) >= 0; })) return;
        men.push({ tipo: 'men', ico: 'at', cor: 'var(--in-t)', t: '<b>' + H.esc(x.quem || 'Alguém') + '</b> mencionou você em ' + H.esc(m.codigo || ''),
          d: '"' + H.esc(t.length > 140 ? t.slice(0, 140) + '…' : t) + '"', href: link(m, ctx), em: x.em || '' });
      });
    });
    var porData = function (a, b) { return String(b.em).localeCompare(String(a.em)); };
    hist.sort(porData); men.sort(porData);
    return { acao: acao, hist: hist, men: men };
  }

  function notificacoesAba(ctx) {
    var it = itensNotificacao(ctx);
    var f = EST.ntfFiltro;
    var lista = f === 'acao' ? it.acao : f === 'men' ? it.men : f === 'hist' ? it.hist : it.acao.concat(it.men.concat(it.hist).sort(function (a, b) { return String(b.em).localeCompare(String(a.em)); }));
    var mostra = lista.slice(0, EST.ntfLimite);
    var bt = function (k, txt, n) { return '<button type="button" class="btns' + (f === k ? ' on' : '') + '" data-ini="ntf" data-f="' + k + '">' + txt + (n != null ? ' ' + n : '') + '</button>'; };
    var h = '<header class="ini-hd fim"><div style="display:flex;flex-direction:column;gap:6px"><h1 class="h1">Notificações</h1>' +
      '<span class="sub">O que pede sua ação primeiro, depois as menções e o que mudou ' + (ctx.papel === 'dev' ? 'nas suas demandas' : 'nas demandas do time') + ' nos últimos 14 dias.</span></div>' +
      '<div class="row" style="flex-wrap:wrap">' + bt('acao', 'Pedem ação', it.acao.length) + bt('men', 'Menções', it.men.length) + bt('hist', 'Mudanças', it.hist.length) + bt('todas', 'Todas') + '</div></header>';
    var vazioTxt = { acao: 'Nada pendente com você agora.', men: 'Ninguém mencionou você nas mensagens das demandas.', hist: 'Nenhuma mudança feita por outra pessoa nos últimos 14 dias.', todas: 'Nada por aqui.' }[f];
    var corpo = mostra.length ? mostra.map(function (n) {
      var tag = n.href ? 'a href="' + n.href + '"' : 'div';
      return '<' + tag + ' class="ini-nt' + (n.nv ? ' nv' : '') + '"><span class="ic" style="color:' + n.cor + '">' + H.ico(n.ico) + '</span>' +
        '<span class="cx"><span>' + n.t + '</span><span class="note" style="font-size:12.5px">' + n.d + '</span></span>' +
        '<span class="qd">' + (n.em ? H.esc(quando(n.em)) : '') + (n.nv ? '<span class="pt"></span>' : '') + '</span></' + (n.href ? 'a' : 'div') + '>';
    }).join('') : H.vazio('bell', vazioTxt, '');
    var mais = lista.length > mostra.length ? '<button type="button" class="btns" data-ini="ntf-mais" style="align-self:center">Mostrar mais ' + Math.min(30, lista.length - mostra.length) + '</button>' : '';
    var lado = '<section class="pn"><h2 class="h2">Onde receber</h2>' +
      '<span class="note">Ainda não disponível no RoadMap: não há envio por Teams, e-mail nem resumo diário. As notificações são lidas da própria base quando você abre o AXIS.</span>' +
      '<span class="lab" style="margin-top:6px">O QUE ENTRA AQUI</span>' +
      '<span class="note">' + H.ico('bell') + ' <b>Pedem ação</b> — o mesmo do sino: validações, prazos vencidos, devoluções, Poker.</span>' +
      '<span class="note">' + H.ico('at') + ' <b>Menções</b> — @' + H.esc((H.meusNomes()[0] || (ctx.eu || {}).nome || 'seu nome')) + ' nas mensagens das demandas.</span>' +
      '<span class="note">' + H.ico('refresh') + ' <b>Mudanças</b> — o histórico das demandas, feito por outra pessoa. A base guarda as 25 últimas alterações de cada demanda.</span>' +
      '</section>';
    return h + '<div class="ini-dois" style="grid-template-columns:minmax(0,1fr) 320px"><section class="pn" style="gap:6px">' + corpo + mais + '</section>' + lado + '</div>';
  }

  // ═════════════════════════════════════════════════════════════════════
  //  REGISTRO
  // ═════════════════════════════════════════════════════════════════════
  function render(el, ctx) {
    poeCss();
    if (ctx.aba === 'meu' || ctx.aba === 'pede') return meuTrabalho(ctx);
    if (ctx.aba === 'cronograma') return cronograma(ctx);
    if (ctx.aba === 'notificacoes') return notificacoesAba(ctx);
    return visaoGeral(ctx);
  }

  function redesenha(el, ctx) {
    var rolo = el.querySelector('#ini-rolo');
    var x = rolo ? rolo.scrollLeft : 0;
    el.innerHTML = render(el, ctx);
    var novo = el.querySelector('#ini-rolo');
    if (novo) novo.scrollLeft = x;
    depois(el, ctx);
  }

  /* LEVA ATE A DEMANDA DO PRAZO VENCIDO (`devIrPara`, dev.html): se o filtro a
     esconde, mostra todas as sprints e tudo o que e seu; rola ate o card,
     realca e abre a demanda por cima do quadro. */
  function irParaDemanda(el, ctx, id) {
    var m = ((ctx.D || {}).melhorias || []).find(function (x) { return x && String(x.id) === String(id); });
    var Q = window.AXIS_QUADRO;
    if (!m || !Q) return;
    var achar = function () { return el.querySelector('.qd-card[data-qd-id="' + String(m.id).replace(/"/g, '') + '"]'); };
    if (!achar()) { EST.sprint = ''; EST.mostrar = ''; MEU.tipo = MEU.tema = MEU.ano = MEU.mes = ''; if (window.AXIS_ACOES && AXIS_ACOES.times) AXIS_ACOES.times(''); }
    var col = Q.COLUNAS_DEV.find(function (c) { return c.junto.indexOf(H.colunaDe(m)) >= 0; });
    if (col) { EST.etapa = col.k; EST.mais[col.k] = true; }
    redesenha(el, ctx);
    var card = achar();
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      card.classList.add('realce');
      setTimeout(function () { card.classList.remove('realce'); }, 2200);
    }
    Q.abrirItem(m);
  }

  function depois(el, ctx) {
    el.onclick = function (e) {
      var b = e.target.closest('[data-ini]');
      if (b) {
        var q = b.getAttribute('data-ini');
        if (q === 'busca') { var t = document.querySelector('[data-acao="busca"]'); if (t) t.click(); return; }
        if (q === 'lista-mais') { EST.listaTudo = !EST.listaTudo; redesenha(el, ctx); return; }
        if (q === 'cron') { var d = +b.getAttribute('data-d'); EST.cronDesloc = d ? EST.cronDesloc + d : 0; EST.cronLimite = 40; redesenha(el, ctx); return; }
        if (q === 'cron-mais') { EST.cronLimite += 40; redesenha(el, ctx); return; }
        if (q === 'resumo') { abrirResumo(ctx); return; }
        if (q === 'vinculo') { if (A.vincular) A.vincular(); return; }
        if (q === 'ntf') { EST.ntfFiltro = b.getAttribute('data-f'); EST.ntfLimite = 30; redesenha(el, ctx); return; }
        if (q === 'ntf-mais') { EST.ntfLimite += 30; redesenha(el, ctx); return; }
        // O Limpar do Meu trabalho volta para a sprint atual e so o seu time (o padrao).
        if (q === 'limpar') { EST.sprint = H.sprintAtual() || ''; MEU.tipo = MEU.tema = MEU.ano = MEU.mes = ''; if (window.AXIS_ACOES && AXIS_ACOES.times) AXIS_ACOES.times(''); redesenha(el, ctx); return; }
        if (q === 'sprint-todas') { EST.sprint = ''; redesenha(el, ctx); return; }
        // A faixa e o numero do prazo vencido levam ate a demanda (dev.html: `devIrPara`, `limparFiltrosDev`).
        if (q === 'risco-abre') { irParaDemanda(el, ctx, b.getAttribute('data-id')); return; }
        if (q === 'risco-limpa') { EST.sprint = ''; EST.mostrar = ''; MEU.tipo = MEU.tema = MEU.ano = MEU.mes = ''; if (window.AXIS_ACOES && AXIS_ACOES.times) AXIS_ACOES.times(''); redesenha(el, ctx); return; }
        if (q === 'risco') {
          var um = el.querySelectorAll('[data-ini="risco-abre"]');
          var fx = el.querySelector('#ini-risco');
          if (um.length === 1) { irParaDemanda(el, ctx, um[0].getAttribute('data-id')); return; }
          if (fx) { fx.scrollIntoView({ behavior: 'smooth', block: 'center' }); fx.focus({ preventScroll: true }); }
          return;
        }
      }
      if (e.target.closest('[data-meu-pd]')) { MEU.pdAberto = !MEU.pdAberto; redesenha(el, ctx); return; }
      // "e mais N" da coluna do Meu trabalho: mostra o resto (o painel do dev nao corta).
      var mb = e.target.closest('[data-mais]');
      if (mb && el.contains(mb)) { EST.mais[mb.getAttribute('data-mais')] = true; redesenha(el, ctx); return; }
      // Cartao do quadro pessoal: o cartao inteiro abre o item, menos o botao
      // de acao dentro dele.
      if (e.target.closest('a, button')) return;
      var c = e.target.closest('.ini-card[data-href]');
      if (c) location.hash = c.getAttribute('data-href');
    };
    var mo = el.querySelector('[data-ini="mostrar"]');
    if (mo) mo.onchange = function () { EST.mostrar = mo.value; redesenha(el, ctx); var n = el.querySelector('[data-ini="mostrar"]'); if (n) n.focus(); };
    var spr = el.querySelector('[data-ini="sprint"]');
    if (spr) spr.onchange = function () { EST.sprint = spr.value; redesenha(el, ctx); var n = el.querySelector('[data-ini="sprint"]'); if (n) n.focus(); };
    // Tipo, Tema, Periodo e o periodo da produtividade (dev.html): redesenha e devolve o foco.
    [].forEach.call(el.querySelectorAll('[data-meu]'), function (s) {
      s.onchange = function () {
        var k = s.getAttribute('data-meu');
        MEU[k] = s.value;
        if (k !== 'prod') EST.mais = {};
        redesenha(el, ctx);
        var n = el.querySelector('[data-meu="' + k + '"]');
        if (n) n.focus();
      };
    });
    var tm = el.querySelector('[data-ini="times"]');
    if (tm) tm.onchange = function () { if (window.AXIS_ACOES) AXIS_ACOES.times(tm.value); redesenha(el, ctx); var n = el.querySelector('[data-ini="times"]'); if (n) n.focus(); };
    var sel = el.querySelector('[data-ini="cron-dev"]');
    if (sel) sel.onchange = function () { EST.cronDev = sel.value; EST.cronLimite = 40; redesenha(el, ctx); };
    /* O quadro do Meu trabalho e o do Quadro: clique abre a demanda por cima,
       o card arrasta (e "Mover para…" no celular) e as etapas deslizam. */
    var Q = window.AXIS_QUADRO;
    if (Q && el.querySelector('#ini-rolo')) {
      Q.ligarQuadro(el, { estado: EST });
      Q.sincEtapa(el, EST, true);
    }
    if (Q) Q.pintaItem(false);
  }

  var AD = ['admin', 'analista', 'dev'];
  /* "O QUE PEDE VOCE" E "MEU TRABALHO" SAO DUAS ABAS, e nao uma que muda com o
     perfil: o PM/PO que tambem desenvolve precisa da fila de coordenacao E das
     demandas no nome dele (o painel do dev). */
  var ABAS = [
    { id: 'geral', rotulo: 'Visão geral' },
    { id: 'pede', rotulo: 'O que pede você', papeis: ['admin'] },
    { id: 'meu', rotulo: 'Meu trabalho', papeis: AD },
    { id: 'cronograma', rotulo: 'Meu cronograma', papeis: AD },
    { id: 'notificacoes', rotulo: 'Notificações', papeis: AD }
  ];

  A.tela({
    id: 'inicio',
    rotulo: 'Início',
    papeis: ['admin', 'analista', 'dev', 'consulta'],
    abas: ABAS,
    // O rotulo das abas muda com o perfil (o PM/PO nao tem "meu cronograma",
    // tem o do time) e a de notificacoes leva o numero do sino.
    abasDe: function () {
      var p = A.APP.papel;
      var n = p === 'consulta' ? 0 : A.notificacoes().length;
      return ABAS.filter(function (a) { return !a.papeis || a.papeis.indexOf(p) >= 0; }).map(function (a) {
        var c = { id: a.id, rotulo: a.rotulo };
        if (p === 'admin' && a.id === 'cronograma') c.rotulo = 'Cronograma do time';
        if (a.id === 'notificacoes' && n) c.n = n;
        return c;
      });
    },
    titulo: function (r) {
      return { pede: 'O que pede você', meu: 'Meu trabalho', cronograma: 'Cronograma', notificacoes: 'Notificações' }[r.aba] || 'Início';
    },
    render: render,
    depois: depois
  });
})();
