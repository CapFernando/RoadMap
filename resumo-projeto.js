/* ─────────────────────────────────────────────────────────────────────────
   O RESUMO EXECUTIVO DE UM PROJETO — nome, issues, títulos e o que saiu.

   ═════════════════════════════════════════════════════════════════════════
   POR QUE ESTE ARQUIVO EXISTE.

   "Preciso gerar um resumo executivo do projeto, com o nome do projeto, issues
   que estão nele, títulos e um resumo."

   O projeto já existia como agrupador, e a aba "Demandas" dele já lista os
   cards. O que faltava era a LEITURA: a aba serve para mexer no vínculo (achar,
   ligar, desligar), e quem vai prestar conta no comitê precisa de outra coisa —
   uma página que se lê de cima para baixo e se cola num grupo.

   ═════════════════════════════════════════════════════════════════════════
   O TEXTO É O PRODUTO, e não a tela.

   A tela é onde se confere; o que de fato viaja é o texto copiado. Por isso o
   `texto()` não é uma versão empobrecida do `html()` — os dois saem da MESMA
   `montar()`, e o que muda é só a roupa. Duas montagens divergiriam no primeiro
   ajuste, e aí o que a pessoa leu na tela não seria o que ela colou no grupo.

   É o mesmo desenho de `resumo-dev.js`, e pelo mesmo motivo.

   ═════════════════════════════════════════════════════════════════════════
   O QUE ESTE ARQUIVO NÃO FAZ.

   NÃO decide etapa (`etapa-demanda.js`), NÃO decide atraso (`prazo.js`), NÃO
   soma ponto por conta própria e NÃO lê dados. Recebe o estado e monta.
   ───────────────────────────────────────────────────────────────────────── */
(function (raiz) {
  'use strict';

  var STATUS_ROT = {
    planejado: 'Planejado', em_andamento: 'Em andamento',
    pausado: 'Pausado', concluido: 'Concluído',
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function dataBR(v) {
    var d = String(v || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
    return d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4);
  }

  /** O texto da entrega: o RESUMO primeiro, o detalhe como reserva.
   *  É a mesma ordem do `resumoDaEntrega` do admin, e ela existe porque o campo
   *  longo é o livro do dev — ele não cabe num resumo executivo. */
  function resumoDe(m) {
    var r = String((m || {}).resumo_entrega || '').trim();
    if (r) return r;
    return String((m || {}).implementacao || '').trim();
  }

  /** A janela combinada, quando houver. `''` quando não há nenhuma das duas —
   *  e aí quem lê não fica procurando o traço solto. */
  function janela(m) {
    var i = dataBR((m || {}).inicio), f = dataBR((m || {}).entrega);
    if (i && f) return i + ' a ' + f;
    if (f) return 'entrega ' + f;
    if (i) return 'início ' + i;
    return '';
  }

  function etapaDe(m) {
    return (raiz.ETAPADEMANDA && raiz.ETAPADEMANDA.efetiva)
      ? raiz.ETAPADEMANDA.efetiva(m, raiz.PRAZO ? raiz.PRAZO.hojeISO() : '')
      : String((m || {}).status_planejamento || '');
  }

  function gravadaDe(m) {
    return (raiz.ETAPADEMANDA && raiz.ETAPADEMANDA.gravada)
      ? raiz.ETAPADEMANDA.gravada(m)
      : String((m || {}).status_planejamento || '');
  }

  /* A SITUAÇÃO DE UMA ISSUE, em uma linha.
     Rótulo e detalhe separados porque a tela pinta o rótulo e o texto não —
     juntá-los numa string só obrigaria a tela a recortar de volta. */
  function situacaoDe(m, hoje) {
    var gr = gravadaDe(m), ef = etapaDe(m);
    if (gr === 'concluido') {
      return { rot: 'Concluído',
               det: (m.concluido_em ? 'em ' + dataBR(m.concluido_em) : 'sem data de conclusão') };
    }
    if (gr === 'validacao') {
      return { rot: 'Em validação',
               det: m.entregue_em ? 'entregue ' + dataBR(m.entregue_em) : 'aguardando o PM/PO' };
    }
    if (ef === 'atrasado') {
      /* A ETAPA GRAVADA, E NUNCA A EFETIVA. Com `'atrasado'` — que e o que a
         efetiva vale aqui — `diasDeAtraso` devolve `null`, e o numero saia
         "0 dias" em toda linha atrasada. Erro meu, visto no primeiro render:
         a demanda vencida ha oito dias dizia zero. O `gantt.html` ja carrega
         este mesmo aviso no comentario de `etapaReal`. */
      var dias = (raiz.PRAZO && raiz.PRAZO.diasDeAtraso)
        ? (raiz.PRAZO.diasDeAtraso(m, gr, hoje) || 0) : 0;
      return { rot: 'Atrasado',
               det: dias + (dias === 1 ? ' dia' : ' dias') +
                    (m.entrega ? ', venceu ' + dataBR(m.entrega) : '') };
    }
    return { rot: STATUS_ROT[gr] || gr || 'Sem etapa',
             det: m.entrega ? 'entrega ' + dataBR(m.entrega) : 'sem data combinada' };
  }

  /** TUDO O QUE O RESUMO PRECISA, para um projeto.
   *
   *  `estado` é `{ temas, melhorias, projetos }` — o mesmo objeto das telas.
   */
  function montar(estado, projetoId, hoje) {
    var st = estado || {};
    var proj = (st.projetos || []).find(function (p) {
      return p && String(p.id) === String(projetoId);
    }) || {};
    var temas = st.temas || [];
    var hj = hoje || (raiz.PRAZO ? raiz.PRAZO.hojeISO() : '');

    var issues = (st.melhorias || [])
      .filter(function (m) {
        return m && !m.oculto && !m.mesclado_em &&
               String(m.projeto_id || '') === String(projetoId);
      })
      .map(function (m) {
        var t = temas.find(function (x) { return String(x.id) === String(m.tema_id); });
        return {
          id: m.id,
          codigo: m.codigo || '',
          titulo: m.titulo || '(sem título)',
          tema: t ? t.nome : '',
          dev: m.dev || '',
          pontos: (m.poker_pontos === 0 || m.poker_pontos) ? Number(m.poker_pontos) : null,
          resumo: resumoDe(m),
          situacao: situacaoDe(m, hj),
          gravada: gravadaDe(m),
          efetiva: etapaDe(m),
          inicio: m.inicio || '',
          entrega: m.entrega || '',
          /* AS DATAS APARECEM SEMPRE QUE EXISTIREM — pedido do Fernando.
             A situação já carrega UMA data (a que importa para ela: a conclusão,
             a entrega do dev, o dia em que venceu). Esta linha é outra coisa: é
             a JANELA combinada, início → entrega, que é o que se cobra num
             comitê. Uma issue concluída em 20/08 que estava combinada para 05/08
             só conta a história inteira com as duas. */
          periodo: janela(m),
        };
      });

    /* A ORDEM É A DA CONVERSA: o que já saiu primeiro (é o que se apresenta),
       depois o que trava, depois o que anda. Ordenar por código faria a pessoa
       procurar no meio da lista o que ela vai dizer primeiro. */
    var peso = { concluido: 0, validacao: 1, atrasado: 2 };
    issues.sort(function (a, b) {
      var pa = peso[a.gravada] != null ? peso[a.gravada] : (a.efetiva === 'atrasado' ? 2 : 3);
      var pb = peso[b.gravada] != null ? peso[b.gravada] : (b.efetiva === 'atrasado' ? 2 : 3);
      if (pa !== pb) return pa - pb;
      return String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true });
    });

    var feitas = issues.filter(function (x) { return x.gravada === 'concluido'; });
    var validando = issues.filter(function (x) { return x.gravada === 'validacao'; });
    var atrasadas = issues.filter(function (x) {
      return x.gravada !== 'concluido' && x.efetiva === 'atrasado';
    });
    var soma = function (l) {
      return l.reduce(function (t, x) { return t + (x.pontos || 0); }, 0);
    };
    /* SEM PONTUAÇÃO CONTA À PARTE, e não como zero. "40 de 96 pontos" com dez
       issues sem estimar é um percentual que não significa nada, e quem lê não
       tem como saber disso sem o número ao lado. */
    var semPonto = issues.filter(function (x) { return x.pontos == null; }).length;

    return {
      projeto: {
        id: proj.id || '',
        codigo: proj.codigo || '',
        nome: proj.nome || '(projeto sem nome)',
        descricao: String(proj.descricao || '').trim(),
        status: STATUS_ROT[proj.status] || proj.status || '',
        responsavel: proj.responsavel || '',
        inicio: proj.inicio || '',
        fim: proj.fim || '',
      },
      hoje: hj,
      issues: issues,
      total: issues.length,
      feitas: feitas.length,
      validando: validando.length,
      atrasadas: atrasadas.length,
      pct: issues.length ? Math.round(feitas.length / issues.length * 100) : 0,
      pontos: soma(issues),
      pontosFeitos: soma(feitas),
      semPonto: semPonto,
    };
  }

  /* ── O TEXTO PARA COLAR ─────────────────────────────────────────────────
     SEM MARCAÇÃO DE MARKDOWN. O destino é um grupo de mensagem, onde `**` vira
     asterisco na tela de quem lê. */
  function texto(r) {
    var p = r.projeto;
    var out = [];
    out.push((p.codigo ? p.codigo + ' — ' : '') + p.nome);
    var cab = [];
    if (p.status) cab.push(p.status);
    if (p.responsavel) cab.push('responsável: ' + p.responsavel);
    if (p.inicio || p.fim) {
      cab.push((p.inicio ? dataBR(p.inicio) : '?') + ' a ' + (p.fim ? dataBR(p.fim) : '?'));
    }
    if (cab.length) out.push(cab.join('  ·  '));
    out.push('');

    if (p.descricao) { out.push(p.descricao); out.push(''); }

    if (!r.total) {
      out.push('Nenhuma issue vinculada a este projeto ainda.');
      return out.join('\n');
    }

    var linha = r.feitas + ' de ' + r.total + ' concluídas (' + r.pct + '%)';
    if (r.validando) linha += '  ·  ' + r.validando + ' em validação';
    if (r.atrasadas) linha += '  ·  ' + r.atrasadas + ' atrasada' + (r.atrasadas > 1 ? 's' : '');
    out.push(linha);
    if (r.pontos) {
      out.push(r.pontosFeitos + ' de ' + r.pontos + ' pontos entregues' +
               (r.semPonto ? '  ·  ' + r.semPonto + ' sem pontuação' : ''));
    } else if (r.semPonto) {
      out.push(r.semPonto + (r.semPonto === 1 ? ' issue sem pontuação' : ' issues sem pontuação'));
    }
    out.push('');

    r.issues.forEach(function (x) {
      out.push('- ' + (x.codigo ? x.codigo + ' ' : '') +
               (x.tema ? '[' + x.tema + '] ' : '') + x.titulo +
               ' — ' + x.situacao.rot + ', ' + x.situacao.det +
               (x.periodo ? '  ·  ' + x.periodo : '') +
               (x.dev ? '  ·  ' + x.dev : ''));
      /* O RESUMO ENTRA RECUADO, na linha de baixo. Na mesma linha do título ele
         faz cada item virar um parágrafo, e a lista deixa de ser lista. */
      if (x.resumo) out.push('  ' + x.resumo);
    });
    return out.join('\n');
  }

  function html(r) {
    var p = r.projeto;
    var cab = [];
    if (p.status) cab.push(esc(p.status));
    if (p.responsavel) cab.push('responsável: ' + esc(p.responsavel));
    if (p.inicio || p.fim) {
      cab.push((p.inicio ? dataBR(p.inicio) : '?') + ' a ' + (p.fim ? dataBR(p.fim) : '?'));
    }

    var kpis = '';
    if (r.total) {
      kpis = '<div class="rxp-kpis">' +
        '<div class="rxp-kpi fim"><b>' + r.feitas + '</b><span>concluídas</span></div>' +
        '<div class="rxp-kpi val"><b>' + r.validando + '</b><span>em validação</span></div>' +
        '<div class="rxp-kpi atr"><b>' + r.atrasadas + '</b><span>atrasadas</span></div>' +
        '<div class="rxp-kpi tot"><b>' + r.total + '</b><span>no projeto</span></div>' +
        '</div>' +
        '<div class="rxp-barra"><div class="rxp-barra-fill" style="width:' + r.pct + '%"></div></div>' +
        '<div class="rxp-barra-txt">' + r.pct + '% concluído' +
        (r.pontos ? '  ·  ' + r.pontosFeitos + ' de ' + r.pontos + ' pontos' : '') +
        (r.semPonto ? '  ·  ' + r.semPonto + ' sem pontuação' : '') + '</div>';
    }

    var lista = !r.total
      ? '<p class="rxp-vazio">Nenhuma issue vinculada a este projeto ainda. ' +
        'Use a aba <strong>Demandas</strong> do projeto para ligar os cards.</p>'
      : '<div class="rxp-lista">' + r.issues.map(function (x) {
          var cls = x.gravada === 'concluido' ? 'fim'
            : x.gravada === 'validacao' ? 'val'
            : x.efetiva === 'atrasado' ? 'atr' : 'and';
          /* `title` EM TUDO QUE CORTA. A grade exige altura igual por cartão,
             então título, subtítulo e resumo cortam — e texto cortado sem o
             recurso de ler o resto é informação perdida, não resumida. */
          var sit = x.situacao.rot + ', ' + x.situacao.det;
          var sub = [x.tema, sit, x.periodo, x.dev].filter(Boolean).join('  ·  ');
          return '<div class="rxp-item ' + cls + '">' +
            '<div class="rxp-item-topo">' +
            (x.codigo ? '<span class="rxp-cod">' + esc(x.codigo) + '</span>' : '') +
            '<span class="rxp-tit" title="' + esc(x.titulo) + '">' + esc(x.titulo) + '</span>' +
            (x.pontos != null ? '<span class="rxp-pts">' + x.pontos + ' pt</span>' : '') +
            '</div>' +
            '<div class="rxp-item-sub" title="' + esc(sub) + '">' +
            (x.tema ? '<span class="rxp-tema">' + esc(x.tema) + '</span>' : '') +
            '<span class="rxp-sit">' + esc(sit) + '</span>' +
            (x.periodo ? '<span class="rxp-prazo">📅 ' + esc(x.periodo) + '</span>' : '') +
            (x.dev ? '<span class="rxp-dev">' + esc(x.dev) + '</span>' : '') +
            '</div>' +
            (x.resumo ? '<div class="rxp-resumo" title="' + esc(x.resumo) + '">' +
                        esc(x.resumo) + '</div>' : '') +
            '</div>';
        }).join('') + '</div>';

    return '<div class="rxp-cab">' +
      '<div class="rxp-nome">' + (p.codigo ? '<span class="rxp-cod-proj">' + esc(p.codigo) +
        '</span> ' : '') + esc(p.nome) + '</div>' +
      (cab.length ? '<div class="rxp-meta">' + cab.join('  ·  ') + '</div>' : '') +
      (p.descricao ? '<div class="rxp-desc" title="' + esc(p.descricao) + '">' +
                     esc(p.descricao) + '</div>' : '') +
      '</div>' + kpis + lista;
  }

  /* O PREFIXO É `rxp-`, E NÃO `rp-`, E ISSO CUSTOU UMA TELA QUEBRADA.
   *
   * A primeira versão usava `rp-`, e o `admin.html` JÁ TEM esse prefixo: é o do
   * modal de Relatório PPT (`rp-escopo`, `rp-btn`, `rp-previa`...). Uma das
   * classes batia exatamente — `.rp-caixa`, que lá vale `display:flex` — e o
   * resumo inteiro virou colunas empilhadas de lado, ilegível.
   *
   * MÓDULO QUE INJETA CSS NUMA PÁGINA QUE NÃO É DELE PRECISA DE UM PREFIXO QUE
   * NINGUÉM MAIS USE. O `resumo-dev.js` usa `dr-`; este usa `rxp-`. A invariante
   * cobra que nenhuma classe daqui exista nas páginas que carregam o módulo —
   * uma colisão nova entra pelo mesmo caminho e não aparece em teste nenhum,
   * porque o JavaScript funciona e só o desenho quebra. */
  /* ═══ CABER NA TELA, SEM BARRA DE ROLAGEM ═══════════════════════════════
   *
   * "Quero um visual que me permita ver tudo no quadro sem ter a necessidade
   *  de usar barra de rolagem. Também preciso do ajuste do texto para caber."
   *
   * O DESENHO ANTERIOR GASTAVA ALTURA EM TRÊS LUGARES: uma coluna só (cada
   * issue ocupando a largura inteira para mostrar meia linha de texto), cartões
   * de 50px com folga de 8px entre eles, e KPIs de número 22px. Quinze issues
   * davam cerca de 1200px — sempre além da tela, em qualquer projeto real.
   *
   * O QUE MUDOU: a lista virou GRADE. `auto-fill` com mínimo de 360px decide
   * sozinho quantas colunas cabem — duas na largura nova, uma quando a janela
   * é estreita —, e ninguém precisa escolher um número de colunas que estaria
   * errado na outra tela. Com duas colunas e o cartão mais apertado, trinta
   * issues cabem onde quinze não cabiam.
   *
   * E O TEXTO PASSOU A SER CONTIDO. A descrição do projeto trazia uma URL do
   * SharePoint de duzentos caracteres: sem ponto de quebra nenhum, ela
   * atravessava a borda direita da caixa. `overflow-wrap:anywhere` quebra
   * dentro da palavra quando não há alternativa — é a única regra que resolve
   * URL, porque `break-word` respeita a palavra até o fim.
   *
   * A CAIXA TEM TETO DE ALTURA e a lista é que rola, não a página inteira.
   * Projeto com oitenta issues vai rolar de qualquer jeito; o que não pode é o
   * cabeçalho e os números saírem de vista junto — eles são a leitura de cinco
   * segundos, e quem rola perde justamente eles. */
  var CSS = [
    /* `box-sizing` DECLARADO AQUI, e não herdado da página.
       Medido: sem ele o teto de altura vale para a CAIXA DE CONTEÚDO, e a caixa
       fica 38px mais alta que o teto (o padding de 18+18 e a borda de 1+1) — o
       bastante para a página inteira voltar a rolar. O `admin.html` tem o reset
       global e disfarçaria isso; um módulo que injeta CSS em página que não é
       dele não pode depender do reset dela. Foi assim que o prefixo `rp-`
       quebrou esta mesma tela. */
    '.rxp-overlay,.rxp-overlay *{box-sizing:border-box;}',
    '.rxp-overlay{position:fixed;inset:0;background:#000A;z-index:800;display:flex;',
    '  align-items:flex-start;justify-content:center;padding:28px 16px;overflow:auto;}',
    '.rxp-caixa{background:var(--bg2,#14141A);border:1px solid var(--border,#2A2A32);',
    '  border-radius:12px;max-width:1120px;width:100%;padding:18px 20px;',
    '  max-height:calc(100vh - 56px);display:flex;flex-direction:column;min-height:0;}',
    '.rxp-topo{display:flex;align-items:flex-start;gap:12px;margin-bottom:10px;flex-shrink:0;}',
    '.rxp-topo-acoes{margin-left:auto;display:flex;gap:8px;flex-shrink:0;}',
    '.rxp-cab{margin-bottom:10px;flex-shrink:0;min-width:0;}',
    '.rxp-nome{font-size:17px;font-weight:800;color:var(--text,#EDEDF0);line-height:1.3;',
    '  overflow-wrap:anywhere;}',
    '.rxp-cod-proj{font-family:ui-monospace,monospace;font-size:12px;color:#C9AEFF;',
    '  background:#341A6E;border-radius:5px;padding:2px 7px;margin-right:6px;}',
    '.rxp-meta{font-size:12px;color:var(--text3,#8A8A96);margin-top:3px;}',
    /* DUAS LINHAS, E O RESTO NO `title`. Uma descrição de projeto com URL colada
       ocupava sete linhas do alto da caixa — altura que as issues precisam. */
    '.rxp-desc{font-size:12.5px;color:var(--text2,#B8B8C4);margin-top:6px;line-height:1.45;',
    '  overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;',
    '  -webkit-box-orient:vertical;overflow:hidden;}',
    '.rxp-kpis{display:flex;gap:8px;margin:0 0 8px;flex-wrap:wrap;flex-shrink:0;}',
    '.rxp-kpi{flex:1;min-width:88px;background:var(--bg3,#1C1C24);border-radius:8px;',
    '  padding:6px 10px;}',
    '.rxp-kpi b{display:block;font-size:18px;line-height:1.15;}',
    '.rxp-kpi span{font-size:10.5px;color:var(--text3,#8A8A96);}',
    '.rxp-kpi.fim b{color:#3EC98E;} .rxp-kpi.val b{color:#7ED8D8;}',
    '.rxp-kpi.atr b{color:#F9A0A0;} .rxp-kpi.tot b{color:var(--text,#EDEDF0);}',
    '.rxp-barra{height:5px;background:var(--bg4,#24242E);border-radius:3px;overflow:hidden;',
    '  flex-shrink:0;}',
    '.rxp-barra-fill{height:100%;background:#3EC98E;}',
    '.rxp-barra-txt{font-size:11px;color:var(--text3,#8A8A96);margin:4px 0 8px;flex-shrink:0;}',
    /* `auto-fill` E NÃO UM NÚMERO DE COLUNAS: o mínimo de 360px é a largura em
       que o título ainda se lê; quantas cabem é conta do navegador, e ela sai
       certa no monitor largo e no notebook. */
    '.rxp-lista{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));',
    '  gap:6px;overflow:auto;min-height:0;align-content:start;}',
    '.rxp-item{background:var(--bg3,#1C1C24);border-left:3px solid var(--border2,#3A3A46);',
    '  border-radius:6px;padding:6px 10px;min-width:0;}',
    '.rxp-item.fim{border-left-color:#3EC98E;} .rxp-item.val{border-left-color:#7ED8D8;}',
    '.rxp-item.atr{border-left-color:#F9A0A0;} .rxp-item.and{border-left-color:#FFC861;}',
    '.rxp-item-topo{display:flex;align-items:baseline;gap:7px;min-width:0;}',
    '.rxp-cod{font-family:ui-monospace,monospace;font-size:11px;font-weight:700;',
    '  color:var(--text3,#8A8A96);flex-shrink:0;}',
    /* UMA LINHA, COM RETICÊNCIAS. Título que quebra em duas linhas faz cada
       cartão ter altura diferente, e a grade vira um paredão irregular. */
    '.rxp-tit{font-weight:600;font-size:13px;color:var(--text,#EDEDF0);flex:1;min-width:0;',
    '  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.rxp-pts{font-size:10.5px;color:var(--text3,#8A8A96);flex-shrink:0;}',
    '.rxp-item-sub{display:flex;gap:8px;font-size:11px;color:var(--text3,#8A8A96);',
    '  margin-top:1px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.rxp-item-sub span{overflow:hidden;text-overflow:ellipsis;}',
    '.rxp-item-sub .rxp-prazo{flex-shrink:0;}',
    '.rxp-resumo{font-size:11.5px;color:var(--text2,#B8B8C4);margin-top:3px;line-height:1.4;',
    '  overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;',
    '  -webkit-box-orient:vertical;overflow:hidden;}',
    '.rxp-vazio{font-size:13px;color:var(--text3,#8A8A96);}',
  ].join('\n');

  function garanteCss() {
    if (document.getElementById('rxp-css')) return;
    var st = document.createElement('style');
    st.id = 'rxp-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  var _ultimo = null;

  function abrir(estado, projetoId) {
    garanteCss();
    _ultimo = montar(estado, projetoId, raiz.PRAZO ? raiz.PRAZO.hojeISO() : '');
    var el = document.getElementById('rxp-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'rxp-overlay';
      el.className = 'rxp-overlay';
      /* FECHA CLICANDO FORA, e só fora: o `target === el` evita que um clique
         que começou dentro e terminou na borda feche a tela por acidente. */
      el.addEventListener('click', function (ev) { if (ev.target === el) fechar(); });
      document.body.appendChild(el);
    }
    el.innerHTML =
      '<div class="rxp-caixa">' +
      '<div class="rxp-topo">' +
      '<div style="font-size:12px;color:var(--text3,#8A8A96)">RESUMO EXECUTIVO DO PROJETO</div>' +
      '<div class="rxp-topo-acoes">' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="RESUMOPROJETO.copiar()">📋 Copiar</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="RESUMOPROJETO.fechar()">Fechar</button>' +
      '</div></div>' +
      html(_ultimo) +
      '</div>';
    el.style.display = 'flex';
  }

  function fechar() {
    var el = document.getElementById('rxp-overlay');
    if (el) el.style.display = 'none';
  }

  function copiar() {
    if (!_ultimo) return;
    var t = texto(_ultimo);
    navigator.clipboard.writeText(t)
      .then(function () { if (raiz.toast) raiz.toast('📋 Resumo copiado.', 'ok'); })
      .catch(function () { if (raiz.toast) raiz.toast('Não consegui copiar.', 'err'); });
  }

  raiz.RESUMOPROJETO = {
    montar: montar,
    texto: texto,
    html: html,
    abrir: abrir,
    fechar: fechar,
    copiar: copiar,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.RESUMOPROJETO;
})(typeof globalThis !== 'undefined' ? globalThis : this);
