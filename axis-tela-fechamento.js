/* ─────────────────────────────────────────────────────────────────────────
   AXIS — Fechamento do mes (#fechamento). Fechamento · Apresentacao.

   E A ABA "MES" DO ADMIN COM O DESENHO DO PROTOTIPO. O que o time prometeu no
   dia 1 (a trilha `meses` de cada demanda), o que entrou depois, o que saiu e o
   que transbordou. As contas vem de `AXIS_GER` (axis-tela-paineis.js), copiadas
   de `renderMes` e `renderGerCumprimento` com o nome da origem.

   FECHAR E CONGELAR CONTINUAM NO ADMIN. "Fechar o mes" rola o que ficou em
   aberto (`mes-fechar` no Worker) e "Congelar" grava a apuracao do deck
   (`fechamento-gravar`); as duas sao gravacoes, e gravar ainda nao e feito no
   app novo. Aqui so se LE o indice de meses congelados (`fechamento-ler`),
   para a tela dizer se o numero que mostra ja virou historico.

   A APRESENTACAO NAO E GERADA AQUI. O deck sai do apresentacao.js, no admin;
   esta aba mostra o que ele vai conter e leva ate la.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var raiz = typeof window !== 'undefined' ? window : globalThis;
  if (!raiz.AXIS_APP) return;
  var H = raiz.AXIS_APP.H;
  var esc = H.esc;
  var G = function () { return raiz.AXIS_GER; };

  /* O INDICE DE CONGELADOS e lido uma vez por sessao, como no admin
     (`fechaCarregar`). Falha de rede nao inventa estado: sem resposta, a tela
     diz que nao conseguiu ler, e nao que o mes esta aberto. */
  var _cong = null, _congLendo = false, _congErro = '';
  var _pagNao = 0, _alvoPag = '';

  function lerCongelados() {
    if (_cong || _congLendo) return;
    _congLendo = true;
    H.api('fechamento-ler').then(function (j) {
      _cong = Array.isArray(j.meses) ? j.meses : [];
    }).catch(function (e) {
      _congErro = e && e.message ? e.message : 'falha de rede';
    }).then(function () {
      _congLendo = false;
      Array.prototype.forEach.call(document.querySelectorAll('[data-cong]'), function (el) {
        el.innerHTML = estadoCongelado(el.getAttribute('data-cong'), el.getAttribute('data-modo'));
      });
    });
  }

  /** A marca do mes (`fechaRender`, admin.html): congelado, em curso, ou
   *  fechado e ainda recalculando da base de hoje. */
  function estadoCongelado(alvo, modo) {
    var g = G();
    var curto = modo === 'curto';
    if (!_cong) {
      if (_congErro) return '<span class="note">' + H.ico('alert') + ' Não consegui ler os meses congelados (' + esc(_congErro) + ').</span>';
      return '<span class="note">' + H.ico('hourglass') + ' Lendo os meses congelados…</span>';
    }
    var f = _cong.find(function (x) { return x.mes === alvo; });
    if (f) {
      return H.chip(H.ico('lock') + ' congelado', 'ok', f.nota || '') + (curto ? '' : ' <span class="note">em ' + H.dma(String(f.congelado_em).slice(0, 10)) +
        (f.por ? ' por ' + esc(f.por) : '') + '. O deck deste mês sai da apuração congelada e não muda mais.</span>');
    }
    if (alvo >= g.mesCorrente()) {
      return H.chip(H.ico('hourglass') + ' mês em curso', 'in') + (curto ? '' : ' <span class="note">os números ainda se mexem; só congela depois que o mês terminar.</span>');
    }
    return H.chip(H.ico('alert') + ' não congelado', 'wn') + (curto ? '' : ' <span class="note">o deck recalcula da base de hoje a cada geração.</span>');
  }

  // ═══ Fechamento ════════════════════════════════════════════════════════
  function fechamento(ctx) {
    var g = G(), D = ctx.D, alvo = g.alvoDe(ctx.param);
    if (alvo !== _alvoPag) { _alvoPag = alvo; _pagNao = 0; }
    var fc = g.fechamentoDoMes(D, alvo), pz = g.prazoDoMes(D, alvo);
    var ant = g.mesSoma(alvo, -1), fcA = g.fechamentoDoMes(D, ant);
    var pode = H.pode('fechar');
    var h = g.cabecalho('Fechamento de ' + esc(g.nomeMes(alvo)),
      'O que o time prometeu no começo do mês, o que entrou depois e o que foi entregue. Fechar rola o que ficou em aberto; congelar faz os números do deck virarem histórico.',
      g.seletorMes('fechamento/mes', alvo) +
      (pode ? H.linkAdmin('gerencial', 'Gerar apresentação') + H.linkAdmin('mes', 'Fechar o mês', 'btnp') : ''));
    h += '<div class="row" style="flex-wrap:wrap;gap:8px" data-cong="' + alvo + '">' + estadoCongelado(alvo) + '</div>';

    // KPIs: os quatro da aba Mes (`renderMes`) e o prazo (`renderGerPrazo`).
    var ptsIni = fc.inicio.reduce(function (t, m) { return t + H.pontosDe(m); }, 0);
    var sust = fc.meio.filter(function (m) { return m.tipo === 'sustentacao'; }).length, evo = fc.meio.filter(function (m) { return m.tipo === 'evolucao'; }).length;
    var entIni = fc.entrInicio, entMeio = fc.entregues.length - entIni;
    h += '<div class="gx-g gx-k5">' +
      g.k('Comprometidas no dia 1', H.num(fc.inicio.length), ptsIni ? H.num(ptsIni) + ' pontos' : 'desde o início do mês') +
      g.k('Entraram depois', H.num(fc.meio.length), fc.meio.length ? [sust ? sust + ' sustentação' : '', evo ? evo + ' evolução' : '', fc.meio.length - sust - evo ? (fc.meio.length - sust - evo) + ' sem tipo' : ''].filter(Boolean).join(' · ') : '—',
          fc.meio.length ? 'var(--wn-t)' : '') +
      g.k('Entregues', H.num(fc.entregues.length), entIni + ' das comprometidas · ' + entMeio + ' das que entraram', fc.entregues.length ? 'var(--ok-t)' : '') +
      g.k('Cumprimento do compromisso', fc.pct === null ? '—' : fc.pct + '%',
          fc.inicio.length ? 'meta 80% · ' + esc(g.nomeMes(ant)) + ' ' + (fcA.pct === null ? '—' : fcA.pct + '%') : 'nada comprometido no início', g.corPct(fc.pct)) +
      g.k('Entregues no prazo', pz.pct === null ? '—' : pz.pct + '%', pz.medidas ? pz.noPrazo.length + ' de ' + pz.medidas + ' com prazo' : 'nada medível no mês', g.corPct(pz.pct)) + '</div>';

    if (!fc.itens.length) {
      return h + '<section class="pn">' + H.vazio('calendar', 'Nenhuma demanda alocada em ' + g.rotuloMes(alvo),
        'A demanda ganha o mês ao entrar em Planejado, e o mês pode ser trocado no card.') + '</section>';
    }

    // Por sprint (`renderMes`): agrupado pelo rotulo `sprint` do card; sem
    // sprint e um grupo proprio, e nao escondido.
    var porS = {};
    fc.itens.forEach(function (m) { var s = String(m.sprint || '').trim() || '(sem sprint)'; (porS[s] = porS[s] || []).push(m); });
    var ordem = Object.keys(porS).sort(function (a, b) {
      if (a === '(sem sprint)') return 1;
      if (b === '(sem sprint)') return -1;
      var k = function (r) { return r.slice(6, 10) + r.slice(3, 5) + r.slice(1, 2); };
      return raiz.SPRINTPO && raiz.SPRINTPO.rotuloValido(a) && raiz.SPRINTPO.rotuloValido(b) ? k(a).localeCompare(k(b)) : a.localeCompare(b, 'pt-BR');
    });
    var COR = { entregue: 'var(--ok-t)', transbordou: 'var(--dg-t)', em_curso: 'var(--in-t)', negada: 'var(--tx3)' };
    var ROT = { entregue: 'entregue', transbordou: 'transbordou', em_curso: 'em curso', negada: 'negada' };
    var S = raiz.SPRINTPO, fer = g.feriadosDe(D);
    var cards = ordem.map(function (s) {
      var lista = porS[s].slice().sort(function (a, b) { return String(a.codigo || '').localeCompare(String(b.codigo || ''), 'pt-BR'); });
      var ent = lista.filter(function (m) { return fc.cls.get(m.id) === 'entregue'; });
      var pT = lista.reduce(function (t, m) { return t + H.pontosDe(m); }, 0), pE = ent.reduce(function (t, m) { return t + H.pontosDe(m); }, 0);
      var tr = lista.filter(function (m) { return fc.cls.get(m.id) === 'transbordou'; }).length;
      var cu = lista.filter(function (m) { return fc.cls.get(m.id) === 'em_curso'; }).length;
      var faixa = S && S.rotuloValido(s) ? S.faixaDaSprint(s, fer) : null;
      var pct = lista.length ? Math.round(ent.length / lista.length * 100) : 0;
      return '<details class="gx-card"><summary><span class="row" style="justify-content:space-between;gap:10px"><span style="font-size:13.5px;font-weight:700" class="ell">' +
        '<span class="code" style="margin-right:8px">' + esc(S && S.rotuloValido(s) ? S.rotuloCurto(s) : s) + '</span>' +
        (faixa ? H.dm(faixa.de) + ' a ' + H.dm(faixa.ate) : '') + '</span><span class="mono" style="font-size:12px;color:var(--tx2)">' + ent.length + ' / ' + lista.length +
        (pT ? ' · ' + pE + ' / ' + pT + ' pt' : '') + '</span></span>' +
        '<span class="bar"><span style="width:' + pct + '%;background:var(--ok)"></span></span>' +
        '<span class="note">' + ent.length + ' de ' + lista.length + ' entregues' + (tr ? ' · ' + tr + ' transbordaram' : '') + (cu ? ' · ' + cu + ' em curso' : '') + ' · clique para ver as demandas</span></summary>' +
        '<div class="gx-tw"><table class="tbl"><tbody>' + lista.map(function (m) {
          var c = fc.cls.get(m.id), rol = g.mesRolos(m);
          return '<tr><td style="color:var(--tx)"><span class="row" style="gap:8px">' + g.codLink(m) + '<span class="ell" style="max-width:280px">' + esc(m.titulo || '') + '</span>' +
            (rol ? '<span class="mono" title="já rolou de mês ' + rol + 'x" style="color:var(--dg-t);font-size:11px;font-weight:700">⟳' + rol + '</span>' : '') + '</span></td>' +
            '<td style="white-space:nowrap">' + esc(m.dev || '—') + '</td><td>' + H.chipEtapa(m) + '</td>' +
            '<td class="mono" style="color:' + COR[c] + ';white-space:nowrap">' + ROT[c] + '</td></tr>';
        }).join('') + '</tbody></table></div></details>';
    }).join('');

    // As que nao sairam, nominalmente, com o contador de rolos
    // (`renderGerCumprimento`): a do terceiro rolo esta sendo adiada.
    var nao = fc.transb.slice().sort(function (a, b) { return g.mesRolos(b) - g.mesRolos(a); });
    var pg = g.paginar(nao, _pagNao, 12);
    var tabNao = nao.length ? '<div class="gx-tw"><table class="tbl"><thead><tr><th>ITEM</th><th>DEV</th><th>ETAPA</th><th>DESTINO</th></tr></thead><tbody>' +
      pg.itens.map(function (m) {
        var dest = g.mesDe(m), c = fc.cls.get(m.id), rol = g.mesRolos(m);
        var chipD = dest && dest !== alvo ? H.chip(esc(g.rotuloMes(dest)), 'in') : c === 'em_curso' ? H.chip('em curso', 'bk') : H.chip('não rolou', 'wn', 'O mês não foi fechado no admin: a demanda ainda não ganhou mês novo.');
        return '<tr><td style="color:var(--tx)"><span class="row" style="gap:8px">' + g.codLink(m) + '<span class="ell" style="max-width:220px" title="' + esc(m.titulo || '') + '">' + esc(m.titulo || '') + '</span>' +
          (rol ? '<span class="mono" title="já rolou de mês ' + rol + 'x" style="color:' + (rol >= 2 ? 'var(--dg-t)' : 'var(--tx3)') + ';font-size:11px;font-weight:700">⟳' + rol + '</span>' : '') + '</span></td>' +
          '<td>' + esc(m.dev || '—') + '</td><td>' + H.chipEtapa(m) + '</td><td>' + chipD + '</td></tr>';
      }).join('') + '</tbody></table></div>' + g.navPag(pg, nao.length, 'pag-nao')
      : H.vazio('check', 'Tudo o que estava no mês saiu');

    // Entregas por semana: as entregues do mes pela data de conclusao, em
    // blocos de 7 dias a partir do dia 1 (`pmSemanas`), separando o que era
    // compromisso do dia 1 do que entrou depois.
    var sem = g.pmSemanas(alvo), antes = 0;
    var cols = sem.map(function (s) { return { rot: s.rot, partes: [{ v: 0, cor: 'var(--ac)', nome: 'comprometidas' }, { v: 0, cor: 'var(--tl)', nome: 'entraram depois' }] }; });
    fc.entregues.forEach(function (m) {
      var d = String(m.concluido_em || '').slice(0, 10), i = -1;
      sem.forEach(function (s, x) { if (d >= s.de && d <= s.ate) i = x; });
      if (i < 0) { antes++; return; }
      cols[i].partes[g.mesDesdeOInicio(m, alvo) ? 0 : 1].v++;
    });

    h += '<div class="gx-g gx-2c">' +
      '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2">Sprints do mês</h2><span class="note">entregues / no mês · pontos</span></div>' + cards +
        '<h2 class="h2" style="margin-top:6px">Comprometidas que não saíram</h2>' +
        '<div id="fc-nao">' + tabNao + '</div>' +
        '<span class="note">Destino = o mês em que a demanda está agora; ⟳ = quantas vezes já rolou de mês. O motivo de cada uma não é registrado no RoadMap.</span></section>' +
      '<div class="gx-col-f">' +
        '<section class="pn"><h2 class="h2">Entregas por semana</h2>' + g.colunas(cols, 130) +
          '<div class="gx-leg">' + g.leg('var(--ac)', 'comprometidas') + g.leg('var(--tl)', 'entraram depois') + '</div>' +
          (antes ? '<span class="note">' + antes + (antes === 1 ? ' entregue foi concluída' : ' entregues foram concluídas') + ' antes do mês.</span>' : '') + '</section>' +
        '<section class="pn"><h2 class="h2">Por desenvolvedor</h2>' +
          fc.devs.map(function (d) {
            return '<div class="row">' + H.av(d.nome) + '<span class="ell" style="flex:1;font-size:13px">' + esc(d.nome) + '</span>' +
              '<span class="mono" style="font-size:12px;color:var(--tx3)" title="entregues / comprometidas + entraram depois">' + d.entregue + ' / ' + (d.comp + d.meio) + '</span>' + g.chipPct(d.pct) + '</div>';
          }).join('') + '<span class="note">Sem comprometida no dia 1 não há percentual. Demanda de dupla conta para os dois.</span></section>' +
        g.cobertura(g.gerencialDoMes(D, alvo).concluidos) +
        '<div class="lock">' + H.ico('lock') + '<span><b>Fechar o mês</b> rola para o mês seguinte o que ficou em aberto — o mês de origem continua registrado em cada demanda. ' +
          '<b>Congelar</b> grava a apuração do deck, que para de mudar. As duas ações ficam no admin' + (pode ? ': ' + '<a href="admin.html" data-admin-aba="mes">aba Mês</a> e <a href="admin.html" data-admin-aba="gerencial">aba Gerencial</a>' : '') + '.</span></div>' +
      '</div></div>';
    return h;
  }

  // ═══ Apresentacao ══════════════════════════════════════════════════════
  function apresentacao(ctx) {
    var g = G(), D = ctx.D, alvo = g.alvoDe(ctx.param), L = g.limites(alvo), hj = H.hoje();
    var pode = H.pode('fechar');
    var h = g.cabecalho('Apresentação executiva',
      'O admin monta os slides com os números do mês — da apuração congelada, quando o mês está congelado. Você escolhe o que entra e marca os destaques.',
      g.seletorMes('fechamento/apresentacao', alvo) + (pode ? H.linkAdmin('gerencial', 'Gerar deck no admin', 'btnp') : ''),
      '<span class="note"><a href="#fechamento/mes/' + alvo + '">Fechamento do mês</a> › Apresentação</span>');

    var pad = g.AP_SECOES.filter(function (s) { return s.pad; });
    var nPad = pad.reduce(function (t, s) { return t + s.n; }, 0);
    var destaques = H.visiveis().filter(function (m) { return !!m.destaque; });
    var esq = '<div class="gx-col-f">' +
      '<section class="pn"><span class="lab">FORMATO</span><div class="gx-g" style="grid-template-columns:1fr 1fr;gap:8px">' +
        '<div style="padding:12px;border-radius:12px;background:rgba(var(--ac-rgb),.1);border:1px solid rgba(var(--ac-rgb),.4);display:flex;flex-direction:column;gap:3px"><b style="font-size:13px">Fechamento do mês</b><span class="note" style="font-size:11.5px">o mês inteiro, em atos</span></div>' +
        '<div style="padding:12px;border-radius:12px;background:var(--sf2);border:1px solid var(--bd2);display:flex;flex-direction:column;gap:3px"><b style="font-size:13px">Um assunto</b><span class="note" style="font-size:11.5px">um sistema, ou o consolidado</span></div></div>' +
        '<span class="note">Mês</span><span class="in" style="justify-content:space-between;gap:8px"><span>' + esc(g.rotuloMes(alvo)) + '</span></span>' +
        '<div class="row" style="flex-wrap:wrap;gap:8px" data-cong="' + alvo + '" data-modo="curto">' + estadoCongelado(alvo, 'curto') + '</div></section>' +
      '<section class="pn" style="gap:8px"><div class="row" style="justify-content:space-between"><span class="lab">SLIDES</span><span class="note">padrão: ' + nPad + ' slides</span></div>' +
        g.AP_SECOES.map(function (s) {
          return '<div class="gx-sl"' + (s.pad ? '' : ' style="color:var(--tx3)"') + '><span class="gx-ck" style="' + (s.pad ? 'background:var(--ac);color:var(--on-ac)' : 'border:1px solid var(--bd4)') + '">' +
            (s.pad ? H.ico('check') : '') + '</span><span style="flex:1">' + esc(s.rot) + '</span><span class="mono" style="font-size:11px;color:var(--tx4)">' + s.n + '</span></div>';
        }).join('') +
        '<span class="note">Marcado = o "Padrão do fechamento" do admin; as outras caixas se marcam lá. Além da grade, sempre entram: a capa, um slide por destaque e o slide final com a sua mensagem.</span></section></div>';

    // A previa e o primeiro ato do deck ("O mes: backlog, o que entrou e o que
    // saiu"), com a conta da fila de `fila.js` — a mesma que o slide usa. O
    // corte e hoje enquanto o mes corre.
    var futuro = L.de > hj, corte = L.ate > hj ? hj : L.ate;
    var fl = futuro ? null : raiz.FILA.fluxo(G().todas(D), L.de, corte, L.ate);
    var num = function (v, cor, rot) {
      return '<span style="display:flex;flex-direction:column"><b style="font-family:var(--font-title);font-size:34px;line-height:40px' + (cor ? ';color:' + cor : '') + '">' + v + '</b><span class="note">' + rot + '</span></span>';
    };
    var slide = fl
      ? '<div class="fc-slide"><div class="row" style="justify-content:space-between"><span class="labo">' + esc(g.rotuloMes(alvo).toUpperCase()) + ' · TECNOLOGIA</span>' +
          '<span class="sb-mark" style="width:34px;height:34px;border-radius:10px"><img src="axis/marca/axis-leao-branco.png" alt="" style="width:22px;height:auto"></span></div>' +
          '<b style="font-family:var(--font-title);font-size:28px;line-height:34px;letter-spacing:-.02em">Entraram ' + fl.recebidas + '. Saíram ' + fl.saidas + '.</b>' +
          '<div class="gx-g gx-k4" style="gap:14px">' + num(fl.backlogInicio, '', 'na fila no dia 1') + num(fl.recebidas, 'var(--wn-t)', 'entraram') +
            num(fl.saidas, 'var(--ok-t)', 'saíram · ' + fl.saiuEntregue + ' entregues') + num(fl.backlogFim, 'var(--ac-t)', 'em aberto ' + (corte < L.ate ? 'hoje' : 'no fim')) + '</div>' +
          '<div class="bar" style="height:12px;margin-top:auto"><span style="width:' + (fl.backlogInicio + fl.recebidas ? Math.round(fl.saidas / (fl.backlogInicio + fl.recebidas) * 100) : 0) +
            '%;background:linear-gradient(90deg,var(--ac),var(--ac-t))"></span></div></div>'
      : H.vazio('calendar', 'O mês ainda não começou');
    var thumbs = [];
    thumbs.push('var(--ac)');
    pad.forEach(function (s) { for (var i = 0; i < s.n; i++) thumbs.push('var(--bd2)'); });

    var dir = '<div class="gx-col-f">' +
      '<section class="pn"><div class="row" style="justify-content:space-between"><span class="lab">DESTAQUES</span><span class="note">' + destaques.length + (destaques.length === 1 ? ' marcado' : ' marcados') + '</span></div>' +
        (destaques.length ? destaques.map(function (m) {
          return '<div class="row" style="gap:10px;padding:10px 12px;border-radius:11px;background:var(--sf2)">' + H.ico('star', 'style="color:var(--wn-t)"') + g.codLink(m) +
            '<span class="ell" style="flex:1;font-size:13px;font-weight:600">' + esc(m.titulo || '') + '</span>' + H.chipEtapa(m) + '</div>';
        }).join('') : H.vazio('star', 'Nenhuma demanda marcada como destaque', 'A estrela se marca no card, no admin.')) +
        '<span class="note">Cada destaque vira um slide próprio. A frase que fecha o deck é escrita no admin na hora de gerar, e não fica guardada.</span></section>' +
      '<section class="pn"><div class="row" style="justify-content:space-between"><span class="lab">PRÉVIA</span><span class="note">o primeiro ato do padrão · números de hoje</span></div>' + slide +
        '<div class="row" style="gap:6px">' + thumbs.map(function (c, i) { return '<span title="' + (i ? 'slide ' + (i + 1) : 'capa') + '" style="flex:1;aspect-ratio:16/9;border-radius:5px;background:var(--sf2);border:1px solid ' + c + '"></span>'; }).join('') + '</div>' +
        '<span class="note">Capa e ' + nPad + ' slides do padrão, sem contar os destaques. A prévia é desenhada aqui; o arquivo .pptx sai só no admin.</span></section></div>';
    return h + '<div class="gx-g gx-as3">' + esq + dir + '</div>';
  }

  function css() {
    if (typeof document === 'undefined' || document.getElementById('css-tela-fechamento')) return;
    var s = document.createElement('style');
    s.id = 'css-tela-fechamento';
    s.textContent = '.axa .fc-slide{aspect-ratio:16/9;border-radius:14px;overflow:hidden;box-sizing:border-box;padding:28px 34px;display:flex;flex-direction:column;gap:18px;' +
      'border:1px solid var(--bd2);background:radial-gradient(600px 300px at 85% 0%,rgba(var(--ac-rgb),.18),rgba(var(--ac-rgb),0) 70%),linear-gradient(160deg,var(--bg-top) 0%,var(--bg0) 100%)}' +
      '@container app (max-width: 760px){.axa .fc-slide{aspect-ratio:auto;padding:18px}}';
    document.head.appendChild(s);
  }

  function abasDe(r) {
    var p = String(r.param || '').split('/')[0];
    var m = /^\d{4}-\d{2}$/.test(p) ? '/' + p : '';
    return [{ id: 'mes', rotulo: 'Fechamento', href: '#fechamento/mes' + m }, { id: 'apresentacao', rotulo: 'Apresentação', href: '#fechamento/apresentacao' + m }];
  }
  raiz.AXIS_APP.tela({
    id: 'fechamento', rotulo: 'Fechamento do mês', papeis: ['admin'],
    abas: [{ id: 'mes', rotulo: 'Fechamento' }, { id: 'apresentacao', rotulo: 'Apresentação' }],
    abasDe: abasDe,
    titulo: function (r) { return r.aba === 'apresentacao' ? 'Apresentação executiva' : 'Fechamento do mês'; },
    render: function (el, ctx) {
      if (!G()) return H.vazio('alert', 'As contas do gerencial não carregaram', 'axis-tela-paineis.js precisa vir antes deste arquivo.');
      G().css(); css();
      return ctx.aba === 'apresentacao' ? apresentacao(ctx) : fechamento(ctx);
    },
    depois: function (el, ctx) {
      if (!G()) return;
      G().ligaSeletorMes(el);
      lerCongelados();
      el.addEventListener('click', function (e) {
        var p = e.target.closest('[data-pag-nao]');
        if (p && !p.disabled) {
          _pagNao = +p.getAttribute('data-pag-nao');
          var tmp = document.createElement('div');
          tmp.innerHTML = fechamento(ctx);
          var novo = tmp.querySelector('#fc-nao'), box = el.querySelector('#fc-nao');
          if (novo && box) box.innerHTML = novo.innerHTML;
        }
      });
    }
  });
})();
