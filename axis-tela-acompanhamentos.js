/* ─────────────────────────────────────────────────────────────────────────
   AXIS — Acompanhamentos (#acompanhamentos). So admin, como no follow.html.

   E O FOLLOW.HTML NO APP NOVO. O que o PM/PO cobra de alguem — "retorno do
   juridico sobre a minuta", "Fulano volta com o orcamento" — com a pessoa e a
   data do retorno, numa linha do tempo do mes: uma faixa por pessoa, um chip no
   dia. Nao existe no prototipo; o desenho segue as outras telas do app.

   OUTRO ARQUIVO, OUTRA ROTA. Os acompanhamentos moram em `data/follow.json`, e
   nao no `melhorias.json`: as telas que publicam a base inteira montam o
   documento por uma lista fechada de chaves, e "o que a tela nao carrega, ela
   apaga" (o comentario de FOLLOW_PATH no worker conta o caso). Por isso esta
   tela NAO usa `H.gravar`: le por `follow-ler` e grava por `follow-gravar`, que
   recebem e devolvem so a lista de acompanhamentos.

   A TRAVA DE CORRIDA E A MESMA DO FOLLOW.HTML. A leitura devolve `base` (o
   `atualizado_em` do arquivo) e toda gravacao manda esse `base` de volta; se
   outra aba gravou no meio, o worker responde 409 `conflito` e nada e gravado.
   Aqui a tela rele a lista e pede para conferir e salvar de novo — nunca
   reenvia sozinha por cima do que a outra pessoa gravou.

   O SERVIDOR DEVOLVE O QUE GRAVOU, e e isso que a tela passa a mostrar: ele
   limpa texto e normaliza campos. Leitura que falha nao vira lista vazia — a
   tela diz que nao conseguiu ler, para ninguem recadastrar tudo por cima.

   As regras de estado (`situacao`, `naSemana`) e o empilhamento das faixas sao
   copiados do follow.html, com o nome de la.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var A = window.AXIS_APP;
  if (!A) return;
  var H = A.H;
  var esc = H.esc;

  var DIA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var NOME_W = 170;      // largura da coluna de nomes (px)
  var FAIXA_H = 26;      // altura de cada faixa de chips (px)

  // Estado da tela. Vive enquanto a pagina vive: trocar de tela e voltar nao
  // rele a lista nem perde o mes escolhido.
  var st = { itens: null, base: null, erro: '', lendo: false, ano: 0, mes: -1, filtro: '' };

  function poeCss() {
    if (document.getElementById('css-tela-acompanhamentos')) return;
    var s = document.createElement('style');
    s.id = 'css-tela-acompanhamentos';
    s.textContent = [
      '.axa .fw-hd{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px}',
      '.axa .fw-mes{display:flex;align-items:center;gap:6px}',
      '.axa .fw-mes b{min-width:150px;text-align:center;font-size:14px}',
      '.axa .fw-k{display:grid;gap:12px;grid-template-columns:repeat(4,minmax(0,1fr))}',
      '.axa .fw-k .k{cursor:pointer;text-align:left;font:inherit;color:inherit}',
      '.axa .fw-k .k.fixo{cursor:default}',
      '.axa .fw-k .k.on{border-color:rgba(var(--ac-rgb),.6);box-shadow:inset 0 0 0 1px rgba(var(--ac-rgb),.35)}',
      '.axa .fw-wrap{border:1px solid var(--bd);border-radius:14px;background:rgba(var(--sf-rgb),.72);overflow-x:auto}',
      '.axa .fw-grade{min-width:max-content}',
      /* As colunas vao por variavel, e nao por `grid-template-columns` no style:
         no celular o nucleo empilha todo grid com essa regra inline. */
      '.axa .fw-cab,.axa .fw-lin{display:grid;grid-template-columns:var(--fw-cols)}',
      '.axa .fw-cab{position:sticky;top:0;z-index:5;background:var(--sf3);border-bottom:1px solid var(--bd)}',
      '.axa .fw-canto{padding:8px 12px;font-size:10.5px;font-weight:800;letter-spacing:.12em;color:var(--tx4);border-right:1px solid var(--bd);position:sticky;left:0;background:var(--sf3);z-index:3}',
      '.axa .fw-dia{text-align:center;padding:6px 0;font-size:10.5px;color:var(--tx3);border-left:1px solid var(--bd3);line-height:1.25}',
      '.axa .fw-dia b{display:block;font-size:12.5px;color:var(--tx);font-weight:700}',
      /* Fim de semana SOMBREADO, e nao removido (follow.html): a data e um
         compromisso de retorno, e um retorno marcado para sabado existe. */
      '.axa .fw-dia.fds,.axa .fw-cel.fds{background:var(--sf2)}',
      '.axa .fw-dia.hoje{background:var(--ac);color:var(--on-ac)}',
      '.axa .fw-dia.hoje b{color:var(--on-ac)}',
      '.axa .fw-lin{border-top:1px solid var(--bd3);position:relative}',
      '.axa .fw-nome{padding:8px 12px;font-size:13px;font-weight:700;border-right:1px solid var(--bd);display:flex;flex-direction:column;gap:1px;position:sticky;left:0;background:var(--sf3);z-index:2;min-width:0}',
      '.axa .fw-nome small{font-weight:500;color:var(--tx3);font-size:11px}',
      '.axa .fw-cel{border-left:1px solid var(--bd3)}',
      '.axa .fw-faixas{position:absolute;top:0;right:0;bottom:0;pointer-events:none}',
      '.axa .fw{position:absolute;height:22px;display:inline-flex;align-items:center;gap:5px;padding:0 9px 0 7px;border-radius:11px;font:inherit;font-size:11.5px;font-weight:700;white-space:nowrap;cursor:pointer;pointer-events:auto;border:1px solid transparent;background:var(--sf4);color:var(--tx);overflow:hidden;text-overflow:ellipsis}',
      '.axa .fw:hover{border-color:var(--bd4)}',
      '.axa .fw:focus-visible{outline:2px solid rgba(var(--ac-rgb),.7);outline-offset:1px}',
      '.axa .fw .pt{width:7px;height:7px;border-radius:50%;flex-shrink:0;background:var(--in)}',
      '.axa .fw .tx{overflow:hidden;text-overflow:ellipsis}',
      /* Rotulo que cresceu para a esquerda: o ponto vai junto, para continuar
         marcando o DIA do retorno (follow.html). */
      '.axa .fw.vira{flex-direction:row-reverse;padding:0 7px 0 9px}',
      '.axa .fw.venc{background:rgba(var(--dg-rgb),.16);color:var(--dg-t)}.axa .fw.venc .pt{background:var(--dg)}',
      '.axa .fw.hoje{background:rgba(var(--wn-rgb),.16);color:var(--wn-t)}.axa .fw.hoje .pt{background:var(--wn)}',
      '.axa .fw.feito{background:var(--sf3);color:var(--tx3)}.axa .fw.feito .pt{background:var(--ok)}',
      '.axa .fw.feito .tx{text-decoration:line-through}',
      '.axa .fw-dlg{max-width:540px}',
      '.axa .fw-dlg label{font-size:12.5px;font-weight:700;color:var(--tx2)}',
      '.axa .fw-dlg .in{width:100%}',
      '.axa .fw-dlg textarea.in{height:auto;min-height:96px;padding:10px 14px;resize:vertical;line-height:1.5;display:block}',
      '.axa .fw-campo{display:flex;flex-direction:column;gap:6px}',
      '.axa .fw-dupla{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
      '.axa .fw-feito{display:flex;align-items:center;gap:8px;font-size:13px;padding:10px 12px;border-radius:11px;background:var(--sf2);border:1px solid var(--bd2);cursor:pointer}',
      '.axa .fw-erro{min-height:18px;font-size:13px;color:var(--dg-t)}',
      '.axa .fw-pe{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}',
      '.axa .fw-pe .esq{margin-right:auto;color:var(--dg-t);border-color:rgba(var(--dg-rgb),.45)}',
      '@container app (max-width: 760px){',
      '.axa .fw-k{grid-template-columns:repeat(2,minmax(0,1fr)) !important}',
      '.axa .fw-dupla{grid-template-columns:minmax(0,1fr) !important}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── Datas ───────────────────────────────────────────────────────────────
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function mesNaTela() {
    if (st.mes < 0) { var h = H.data(H.hoje()); st.ano = h.getFullYear(); st.mes = h.getMonth(); }
    return { ano: st.ano, mes: st.mes, chave: st.ano + '-' + String(st.mes + 1).padStart(2, '0') };
  }
  function diasDoMes(ano, mes) {
    var total = new Date(ano, mes + 1, 0).getDate(), out = [];
    for (var d = 1; d <= total; d++) {
      var dt = new Date(ano, mes, d);
      out.push({ iso: iso(dt), dia: d, semana: dt.getDay() });
    }
    return out;
  }
  function rotuloMes(ano, mes) {
    var n = H.MESES[mes];
    return n.charAt(0).toUpperCase() + n.slice(1) + ' ' + ano;
  }

  // ── Estado de um acompanhamento (follow.html) ───────────────────────────
  /* UMA REGRA SO para "como esta este acompanhamento": o resumo, a cor do chip
     e o filtro fazem a mesma pergunta. Concluido vence o vencimento. */
  function situacao(it, hoje) {
    var dia = hoje || H.hoje();
    if (it && it.concluido) return 'feito';
    var r = String((it || {}).retorno || '');
    if (!r) return 'aberto';
    if (r < dia) return 'venc';
    if (r === dia) return 'hoje';
    return 'aberto';
  }
  /* Dentro dos proximos 7 dias, contando hoje. */
  function naSemana(it, hoje) {
    var dia = hoje || H.hoje();
    if (!it || it.concluido) return false;
    var r = String(it.retorno || '');
    if (!r || r < dia) return false;
    var lim = H.data(dia); lim.setDate(lim.getDate() + 6);
    return r <= iso(lim);
  }
  var ROT_SIT = { venc: ['vencido', 'dg'], hoje: ['retorno hoje', 'wn'], aberto: ['em aberto', 'in'], feito: ['encerrado', 'ok'] };

  /* EMPILHAMENTO EM FAIXAS (follow.html, `empilha`). Dois retornos da mesma
     pessoa em dias proximos se sobreporiam — o chip tem texto, mais largo que
     a coluna do dia —, entao cada chip desce para a primeira faixa livre. E o
     rotulo VIRA para a esquerda quando nao cabe a direita, em vez de criar
     rolagem lateral num mes que cabe inteiro na tela. */
  function empilha(lista, dias, larguraDia) {
    var fim = dias.length * larguraDia, faixas = [], pos = [];
    lista.forEach(function (it) {
      var idx = -1;
      for (var i = 0; i < dias.length; i++) if (dias[i].iso === it.retorno) { idx = i; break; }
      if (idx < 0) return;
      var natural = Math.min(520, Math.max(48, String(it.atividade || '').length * 6.1 + 46));
      var ancora = idx * larguraDia, esq, larg, vira = false;
      if (ancora + 2 + natural <= fim) { esq = ancora + 2; larg = natural; }
      else { vira = true; larg = Math.min(natural, ancora + larguraDia - 2); esq = Math.max(0, ancora + larguraDia - 2 - larg); }
      var faixa = 0;
      while (faixas[faixa] !== undefined && esq < faixas[faixa]) faixa++;
      faixas[faixa] = esq + larg + 6;
      pos.push({ it: it, esq: esq, larg: larg, faixa: faixa, vira: vira });
    });
    return { pos: pos, total: Math.max(1, faixas.length) };
  }

  // ── Leitura e gravacao ──────────────────────────────────────────────────
  function naTela() { return A.APP.rota && A.APP.rota.tela === 'acompanhamentos'; }

  function ler() {
    if (st.lendo) return Promise.resolve();
    st.lendo = true;
    return H.api('follow-ler').then(function (j) {
      st.itens = Array.isArray(j.itens) ? j.itens : [];
      st.base = j.base || null;
      st.erro = '';
    }).catch(function (e) {
      /* Credencial recusada nao e falha de leitura: a resposta certa e "entre
         de novo", e nao um "tentar de novo" que vai falhar igual. */
      st.erro = e.status === 401 ? 'Sua sessão expirou. Saia e entre de novo.'
        : e.status === 403 ? 'Esta área é só do PM/PO (admin).'
        : (e.message || 'falha de conexão');
    }).then(function () {
      st.lendo = false;
      if (naTela()) A.desenhar(true);
    });
  }

  /** Grava a lista INTEIRA com o `base` lido. Devolve { ok } ou { erro, conflito }. */
  function gravar(lista) {
    return H.api('follow-gravar', { itens: lista, base: st.base }).then(function (j) {
      st.itens = Array.isArray(j.itens) ? j.itens : lista;
      st.base = j.base || null;
      return { ok: true };
    }).catch(function (e) {
      if (e.status === 409 && e.codigo === 'conflito') {
        // Nao reenvia por cima: rele, e a pessoa confere o que mudou.
        return ler().then(function () {
          return { conflito: true, erro: 'Outra pessoa gravou os acompanhamentos depois que esta tela leu. A lista foi lida de novo: confira e salve outra vez.' };
        });
      }
      return { erro: e.message || 'falha de conexão' };
    });
  }

  function novoId() {
    return 'fw-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  // ── Desenho ─────────────────────────────────────────────────────────────
  function kpis(hoje) {
    // O resumo conta a base INTEIRA, e nao o mes na tela: vencido de agosto
    // continua sendo cobranca em setembro (follow.html, `renderResumo`).
    var its = st.itens || [];
    var n = {
      venc: its.filter(function (it) { return situacao(it, hoje) === 'venc'; }).length,
      hoje: its.filter(function (it) { return situacao(it, hoje) === 'hoje'; }).length,
      sem: its.filter(function (it) { return naSemana(it, hoje); }).length,
      ab: its.filter(function (it) { return !it.concluido; }).length
    };
    var k = function (id, rot, v, cor) {
      return '<button type="button" class="k' + (st.filtro === id ? ' on' : '') + '" data-fw-f="' + id + '" aria-pressed="' + (st.filtro === id) + '" title="Clique para filtrar o mês">' +
        '<span class="kl">' + rot + '</span><span class="kv"' + (v && cor ? ' style="color:' + cor + '"' : '') + '>' + v + '</span></button>';
    };
    return '<div class="fw-k">' + k('venc', 'Vencidos', n.venc, 'var(--dg-t)') + k('hoje', 'Retorno hoje', n.hoje, 'var(--wn-t)') +
      k('sem', 'Próximos 7 dias', n.sem, 'var(--in-t)') +
      '<div class="k fixo"><span class="kl">Em aberto</span><span class="kv">' + n.ab + '</span></div></div>';
  }

  function doMes(hoje) {
    var m = mesNaTela();
    return (st.itens || []).filter(function (it) {
      if (String(it.retorno || '').slice(0, 7) !== m.chave) return false;
      if (st.filtro === 'venc') return situacao(it, hoje) === 'venc';
      if (st.filtro === 'hoje') return situacao(it, hoje) === 'hoje';
      if (st.filtro === 'sem') return naSemana(it, hoje);
      return true;
    });
  }

  function render(el, ctx) {
    poeCss();
    if (st.itens === null && !st.erro) ler();
    var m = mesNaTela();
    var hoje = H.hoje();
    var nav = '<div class="fw-mes" role="group" aria-label="Mês">' +
      '<button type="button" class="btns" data-fw="mes" data-d="-1" aria-label="Mês anterior" title="Mês anterior">‹</button>' +
      '<b>' + esc(rotuloMes(m.ano, m.mes)) + '</b>' +
      '<button type="button" class="btns" data-fw="mes" data-d="1" aria-label="Próximo mês" title="Próximo mês">›</button>' +
      '<button type="button" class="btns" data-fw="hoje" title="Voltar para o mês atual">hoje</button></div>';
    var h = '<header class="fw-hd"><div style="display:flex;flex-direction:column;gap:6px;max-width:640px">' +
      '<h1 class="h1">Acompanhamentos</h1>' +
      '<span class="sub">O que você está cobrando de alguém, com a data do retorno. Uma faixa por pessoa; vencido em vermelho, retorno de hoje em amarelo.</span></div>' +
      '<div class="row" style="flex-wrap:wrap;justify-content:flex-end">' + nav +
      '<button type="button" class="btnp" data-fw="novo">+ Novo acompanhamento</button></div></header>';

    if (st.erro) {
      return h + '<section class="pn">' + H.vazio('alert', 'Não consegui ler os acompanhamentos',
        st.erro + ' Esta tela está incompleta — não é uma lista vazia. Não cadastre de novo antes de ler outra vez.',
        '<button type="button" class="btnp" data-fw="reler">Tentar de novo</button>') + '</section>';
    }
    if (st.itens === null) {
      return h + '<div class="fw-k">' + '<div class="sk" style="height:84px"></div>'.repeat(4) + '</div><div class="sk" style="height:260px"></div>';
    }

    h += kpis(hoje);
    var lista = doMes(hoje).slice().sort(function (a, b) { return String(a.retorno).localeCompare(String(b.retorno)) || String(a.pessoa).localeCompare(String(b.pessoa), 'pt-BR'); });
    if (!lista.length) {
      h += '<section class="pn">' + H.vazio('flag',
        st.filtro ? 'Nenhum acompanhamento neste filtro em ' + H.MESES[m.mes] : 'Nenhum acompanhamento com retorno em ' + H.MESES[m.mes] + ' de ' + m.ano,
        st.filtro ? 'O contador olha todos os meses; a linha do tempo mostra só o mês escolhido.' : '',
        '<button type="button" class="btnp" data-fw="novo">+ Novo acompanhamento</button>') + '</section>';
      return h;
    }
    // A grade e desenhada em `depois`: a largura do dia depende da largura
    // real da caixa, que so existe depois que ela esta na pagina.
    h += '<div class="fw-wrap" id="fw-wrap"><div class="fw-grade" id="fw-grade"></div></div>';
    h += '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2">' +
      (st.filtro ? 'No filtro' : 'Em ' + esc(H.MESES[m.mes])) + '</h2><span class="note">' + H.plural(lista.length, 'acompanhamento', 'acompanhamentos') + '</span></div>' +
      '<table class="tbl"><thead><tr><th>RETORNO</th><th>PESSOA</th><th>ATIVIDADE</th><th>SITUAÇÃO</th></tr></thead><tbody>' +
      lista.map(function (it) {
        var s = ROT_SIT[situacao(it, hoje)];
        return '<tr class="click" data-fw-it="' + esc(it.id) + '" tabindex="0"><td class="mono" style="white-space:nowrap">' + esc(H.dm(it.retorno)) + '</td>' +
          '<td style="white-space:nowrap;color:var(--tx)">' + esc(it.pessoa) + '</td>' +
          '<td><span style="color:var(--tx);font-weight:600' + (it.concluido ? ';text-decoration:line-through;color:var(--tx3)' : '') + '">' + esc(it.atividade) + '</span>' +
          (it.observacao ? '<span class="note ell" style="display:block;max-width:520px">' + esc(it.observacao) + '</span>' : '') + '</td>' +
          '<td>' + H.chip(esc(s[0]), s[1]) + '</td></tr>';
      }).join('') + '</tbody></table></section>';
    return h;
  }

  function pintarGrade(el) {
    var wrap = el.querySelector('#fw-wrap'), grade = el.querySelector('#fw-grade');
    if (!wrap || !grade) return;
    var m = mesNaTela(), hoje = H.hoje();
    var dias = diasDoMes(m.ano, m.mes);
    // A coluna do dia preenche a caixa (mesma conta do follow.html e do gantt),
    // com piso para o numero do dia nao encostar na borda.
    var larguraDia = Math.max(34, Math.floor((wrap.clientWidth - NOME_W - 2) / dias.length));
    var colunas = NOME_W + 'px repeat(' + dias.length + ', ' + larguraDia + 'px)';
    var lista = doMes(hoje);
    // Uma faixa por pessoa, em ordem alfabetica: ordenar por quantidade faria
    // o nome pular de lugar de um mes para o outro.
    var pessoas = [];
    lista.forEach(function (it) { if (pessoas.indexOf(it.pessoa) < 0) pessoas.push(it.pessoa); });
    pessoas.sort(function (a, b) { return String(a).localeCompare(String(b), 'pt-BR'); });

    var h = '<div class="fw-cab" style="--fw-cols:' + colunas + '"><div class="fw-canto">PESSOA</div>' +
      dias.map(function (d) {
        var cls = d.iso === hoje ? ' hoje' : (d.semana === 0 || d.semana === 6 ? ' fds' : '');
        return '<div class="fw-dia' + cls + '"><b>' + d.dia + '</b>' + DIA_SEMANA[d.semana] + '</div>';
      }).join('') + '</div>';
    pessoas.forEach(function (p) {
      var meus = lista.filter(function (it) { return it.pessoa === p; })
        .sort(function (a, b) { return String(a.retorno).localeCompare(String(b.retorno)); });
      var e = empilha(meus, dias, larguraDia);
      var abertos = meus.filter(function (it) { return !it.concluido; }).length;
      h += '<div class="fw-lin" style="--fw-cols:' + colunas + ';min-height:' + Math.max(40, e.total * FAIXA_H + 12) + 'px">' +
        '<div class="fw-nome"><span class="ell">' + esc(p) + '</span><small>' + abertos + (abertos === 1 ? ' aberto' : ' abertos') + '</small></div>' +
        dias.map(function (d) { return '<div class="fw-cel' + (d.semana === 0 || d.semana === 6 ? ' fds' : '') + '"></div>'; }).join('') +
        '<div class="fw-faixas" style="left:' + NOME_W + 'px">' + e.pos.map(function (x) {
          var it = x.it, s = situacao(it, hoje);
          var titulo = it.atividade + ' — ' + it.pessoa + ' — retorno ' + H.dma(it.retorno) + (it.observacao ? '\n\n' + it.observacao : '');
          return '<button type="button" class="fw ' + s + (x.vira ? ' vira' : '') + '" data-fw-it="' + esc(it.id) + '" ' +
            'style="left:' + x.esq + 'px;max-width:' + Math.round(x.larg) + 'px;top:' + (6 + x.faixa * FAIXA_H) + 'px" title="' + esc(titulo) + '">' +
            '<span class="pt"></span><span class="tx">' + esc(it.atividade) + '</span></button>';
        }).join('') + '</div></div>';
    });
    grade.innerHTML = h;
  }

  // ── Formulario ──────────────────────────────────────────────────────────
  function abrirForm(id, isoSugerido) {
    var it = id ? (st.itens || []).filter(function (x) { return x.id === id; })[0] : null;
    if (id && !it) return;
    var pessoas = [];
    (st.itens || []).forEach(function (x) { if (x.pessoa && pessoas.indexOf(x.pessoa) < 0) pessoas.push(x.pessoa); });
    pessoas.sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    var v = it || { atividade: '', pessoa: '', retorno: isoSugerido || H.hoje(), observacao: '', concluido: false };
    var ov = document.createElement('div');
    ov.className = 'ovl';
    ov.innerHTML = '<section class="dlg fw-dlg" role="dialog" aria-modal="true" aria-labelledby="fw-tit">' +
      '<button type="button" class="dlg-x" data-fwf="fechar" aria-label="Fechar">✕</button>' +
      '<h2 class="h2" id="fw-tit" style="font-size:19px">' + (it ? 'Acompanhamento' : 'Novo acompanhamento') + '</h2>' +
      '<div class="fw-campo"><label for="fw-atividade">Atividade *</label>' +
      '<input class="in" id="fw-atividade" maxlength="200" placeholder="Ex.: Retorno do jurídico sobre a minuta do contrato" value="' + esc(v.atividade) + '"></div>' +
      '<div class="fw-dupla"><div class="fw-campo"><label for="fw-pessoa">Pessoa envolvida *</label>' +
      '<input class="in" id="fw-pessoa" maxlength="80" list="fw-pessoas" placeholder="Com quem você cobra" value="' + esc(v.pessoa) + '">' +
      // Lista de nomes ja usados: "Ana" e "ana " nao viram duas pessoas.
      '<datalist id="fw-pessoas">' + pessoas.map(function (n) { return '<option value="' + esc(n) + '"></option>'; }).join('') + '</datalist></div>' +
      '<div class="fw-campo"><label for="fw-retorno">Data do retorno *</label><input class="in" type="date" id="fw-retorno" value="' + esc(v.retorno) + '"></div></div>' +
      '<div class="fw-campo"><label for="fw-obs">Observação <span class="note" style="font-weight:500">— o contexto que você não vai lembrar em duas semanas</span></label>' +
      '<textarea class="in" id="fw-obs" rows="4" maxlength="2000" placeholder="O que foi combinado, o que falta, o que já foi tentado.">' + esc(v.observacao) + '</textarea></div>' +
      '<label class="fw-feito"><input type="checkbox" id="fw-feito"' + (v.concluido ? ' checked' : '') + '> <span>Já retornou — encerrado</span></label>' +
      '<div class="fw-erro" id="fw-erro" role="alert"></div>' +
      '<div class="fw-pe">' + (it ? '<button type="button" class="btn esq" data-fwf="excluir">' + H.ico('trash') + ' Excluir</button>' : '') +
      '<button type="button" class="btn" data-fwf="fechar">Cancelar</button>' +
      '<button type="button" class="btnp" data-fwf="salvar">Salvar</button></div></section>';
    document.body.appendChild(ov);
    var q = function (s) { return ov.querySelector(s); };
    var erro = q('#fw-erro');
    var fecha = function () { ov.remove(); document.removeEventListener('keydown', tecla); };
    var tecla = function (e) { if (e.key === 'Escape' && !document.querySelector('.dlg-ov')) fecha(); };
    document.addEventListener('keydown', tecla);
    ov.addEventListener('click', async function (e) {
      if (e.target === ov) { fecha(); return; }
      var b = e.target.closest('[data-fwf]');
      if (!b) return;
      var acao = b.getAttribute('data-fwf');
      if (acao === 'fechar') { fecha(); return; }
      if (acao === 'excluir') {
        var ok = window.confirmar
          ? await window.confirmar({ titulo: 'Excluir acompanhamento', texto: '"' + it.atividade + '" (' + it.pessoa + ') sai da lista. Não há como desfazer.', ok: 'Excluir', perigo: true })
          : window.confirm('Excluir "' + it.atividade + '"? Não há como desfazer.');
        if (!ok) return;
        b.disabled = true;
        var rx = await gravar((st.itens || []).filter(function (x) { return x.id !== it.id; }));
        b.disabled = false;
        if (rx.erro) { erro.textContent = rx.erro; return; }
        fecha(); H.toast('Acompanhamento excluído.'); A.desenhar(true);
        return;
      }
      if (acao === 'salvar') {
        var atividade = q('#fw-atividade').value.trim(), pessoa = q('#fw-pessoa').value.trim(), retorno = q('#fw-retorno').value;
        if (!atividade) { erro.textContent = 'Diga o que precisa ser acompanhado.'; q('#fw-atividade').focus(); return; }
        if (!pessoa) { erro.textContent = 'Com quem você cobra isso? Acompanhamento sem pessoa não se cobra.'; q('#fw-pessoa').focus(); return; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(retorno)) { erro.textContent = 'Informe a data do retorno.'; q('#fw-retorno').focus(); return; }
        erro.textContent = '';
        var campos = { atividade: atividade, pessoa: pessoa, retorno: retorno, observacao: q('#fw-obs').value.trim(), concluido: q('#fw-feito').checked };
        // Copia da lista, e nao mutacao: se a gravacao falhar, a tela segue
        // mostrando o que esta no servidor.
        var base = st.itens || [];
        var existe = it && base.some(function (x) { return x.id === it.id; });
        var lista = existe
          ? base.map(function (x) { return x.id === it.id ? Object.assign({}, x, campos) : x; })
          : base.concat([Object.assign(it ? { id: it.id, criado_em: it.criado_em } : { id: novoId(), criado_em: new Date().toISOString() }, campos)]);
        b.disabled = true; b.textContent = 'Salvando…';
        var r = await gravar(lista);
        b.disabled = false; b.textContent = 'Salvar';
        if (r.erro) {
          var msg = r.erro;
          if (r.conflito && it) {
            // Diz O QUE a outra pessoa mudou neste acompanhamento: salvar de
            // novo grava o que esta no formulario por cima disso.
            var agora = (st.itens || []).filter(function (x) { return x.id === it.id; })[0];
            if (!agora) msg += ' Este acompanhamento foi excluído pela outra pessoa; salvar o recria.';
            else {
              var ROT = { atividade: 'atividade', pessoa: 'pessoa', retorno: 'data do retorno', observacao: 'observação', concluido: 'encerrado' };
              var mud = Object.keys(ROT).filter(function (k) { return String(agora[k] == null ? '' : agora[k]) !== String(it[k] == null ? '' : it[k]); });
              if (mud.length) msg += ' Ela mudou ' + mud.map(function (k) { return ROT[k]; }).join(', ') + ' deste acompanhamento.';
              it = agora;
            }
          }
          erro.textContent = msg;
          return;
        }
        fecha();
        // Vai para o mes do retorno: gravar um retorno de outubro estando em
        // setembro fecharia o formulario numa tela onde o item nao aparece.
        var d = H.data(retorno); st.ano = d.getFullYear(); st.mes = d.getMonth();
        H.toast(it ? 'Acompanhamento salvo.' : 'Acompanhamento criado.');
        A.desenhar(true);
      }
    });
    setTimeout(function () { var a = q('#fw-atividade'); if (a) a.focus(); }, 0);
  }

  function depois(el) {
    pintarGrade(el);
    el.onclick = function (e) {
      var f = e.target.closest('[data-fw-f]');
      if (f) { var k = f.getAttribute('data-fw-f'); st.filtro = st.filtro === k ? '' : k; A.desenhar(true); return; }
      var it = e.target.closest('[data-fw-it]');
      if (it) { abrirForm(it.getAttribute('data-fw-it')); return; }
      var b = e.target.closest('[data-fw]');
      if (!b) return;
      var a = b.getAttribute('data-fw');
      if (a === 'novo') {
        // Sugere hoje quando o mes na tela e o atual; senao, o dia 1 do mes.
        var m = mesNaTela(), hj = H.hoje();
        abrirForm(null, hj.slice(0, 7) === m.chave ? hj : m.chave + '-01');
      } else if (a === 'mes') {
        st.mes += Number(b.getAttribute('data-d'));
        if (st.mes < 0) { st.mes = 11; st.ano--; }
        if (st.mes > 11) { st.mes = 0; st.ano++; }
        A.desenhar(true);
      } else if (a === 'hoje') {
        st.mes = -1; A.desenhar(true);
      } else if (a === 'reler') {
        st.erro = ''; st.itens = null; A.desenhar(true);
      }
    };
    el.onkeydown = function (e) {
      if (e.key !== 'Enter') return;
      var tr = e.target.closest && e.target.closest('tr[data-fw-it]');
      if (tr) abrirForm(tr.getAttribute('data-fw-it'));
    };
  }

  // A largura do dia e medida em pixel: sem redesenhar ao redimensionar, ela
  // ficaria com a largura da janela de quando a tela abriu.
  var _redim = null;
  window.addEventListener('resize', function () {
    clearTimeout(_redim);
    _redim = setTimeout(function () {
      var v = document.getElementById('vista');
      if (v && naTela()) pintarGrade(v);
    }, 150);
  });

  A.tela({
    id: 'acompanhamentos',
    rotulo: 'Acompanhamentos',
    papeis: ['admin'],
    titulo: function () { return 'Acompanhamentos'; },
    render: render,
    depois: depois
  });
})();
