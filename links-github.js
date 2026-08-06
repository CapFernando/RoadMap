/* ─────────────────────────────────────────────────────────────────────────
   REFERÊNCIA AO GITHUB — Issue, PR e Milestone
   ─────────────────────────────────────────────────────────────────────────
   Antes havia UM campo `link_externo` para "o link da demanda". Estava
   preenchido em ZERO das 201 demandas, e o motivo tem duas partes: um slot
   para três coisas diferentes não serve para nenhuma, e — a parte que faltava
   ninguém notar — ele nunca existiu em tela alguma. Só a API o aceitava.

   Agora são três campos, e cada um sabe o que é. Isso não é cosmético: é o que
   permite ir do card para o código e voltar. Sem isso, "o que exatamente foi
   entregue nesta demanda" é uma pergunta que se responde no Teams.

   ACEITA O NÚMERO SOLO, de propósito. Quem está com a issue aberta na frente
   tem "683" na cabeça, não a URL. Digitar 683 no campo Issue vale
   github.com/<repo>/issues/683. URL completa também vale sempre, inclusive de
   outro repositório — o repo padrão é atalho, não cerca.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // Repositório do código. Fica aqui, e não em config.js, porque config.js é
  // gitignored (guarda a senha) e portanto NÃO existe no site publicado: uma
  // constante lá funcionaria na sua máquina e sairia vazia para o time.
  var REPO = 'audaxcapitalsa/AXCRED-DJANGO';

  var TIPOS = {
    issue:     { caminho: 'issues',    rotulo: 'Issue',     prefixo: '#' },
    pr:        { caminho: 'pull',      rotulo: 'PR',        prefixo: 'PR #' },
    milestone: { caminho: 'milestone', rotulo: 'Milestone', prefixo: 'Milestone ' },
  };

  function base() { return 'https://github.com/' + REPO + '/'; }

  // "683", "#683", "683 " → URL. URL → ela mesma, intacta.
  function normalizaUm(tipo, valor) {
    var t = TIPOS[tipo];
    if (!t) return '';
    var v = String(valor == null ? '' : valor).trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    var n = v.replace(/^#/, '').trim();
    if (/^\d+$/.test(n)) return base() + t.caminho + '/' + n;
    // Não é número nem URL: devolve como está para a validação recusar com o
    // texto que a pessoa digitou visível. Corrigir por adivinhação aqui faria o
    // campo gravar uma coisa diferente do que foi escrito.
    return v;
  }

  // PR aceita mais de um: uma demanda quebrada em dois PRs é rotina, e sem isto
  // a pessoa escreveria "712, 715" num campo de URL única e a validação
  // recusaria — empurrando o segundo PR para o campo de observação.
  function normaliza(tipo, valor) {
    var v = String(valor == null ? '' : valor).trim();
    if (!v) return '';
    if (tipo !== 'pr') return normalizaUm(tipo, v);
    return v.split(/[\s,;]+/).filter(Boolean)
            .map(function (x) { return normalizaUm('pr', x); })
            .join(' ');
  }

  // Erro em texto, ou '' se está válido. A mensagem diz o que fazer, não a regra.
  //
  // Valida o valor NORMALIZADO, não o que foi digitado: validar o cru recusava
  // "683", que é exatamente a forma que o campo existe para aceitar. A regra e a
  // conversão têm de olhar a mesma coisa, senão uma desmente a outra.
  function erro(tipo, valor) {
    var v = normaliza(tipo, valor);
    if (!v) return '';
    var t = TIPOS[tipo];
    var partes = tipo === 'pr' ? v.split(/\s+/).filter(Boolean) : [v];
    for (var i = 0; i < partes.length; i++) {
      var u = partes[i];
      if (!/^https?:\/\//i.test(u)) {
        return 'Em ' + t.rotulo + ', use o número (ex.: 683) ou o endereço completo.';
      }
      // Só cobra a forma quando é github.com: link de Jira, Confluence ou
      // qualquer outra ferramenta continua aceito sem palpite nosso.
      var m = /^https?:\/\/(?:www\.)?github\.com\/[^/]+\/[^/]+\/([^/]+)\//i.exec(u);
      if (m) {
        var achado = m[1].toLowerCase();
        // issues/pull/milestone são o que interessa; qualquer outro é engano de
        // campo, e o engano mais comum é colar a issue no campo do PR.
        if (['issues', 'pull', 'milestone'].indexOf(achado) >= 0 && achado !== t.caminho) {
          var certo = { issues: 'Issue', pull: 'PR', milestone: 'Milestone' }[achado];
          return 'Este endereço é de ' + certo + ', mas está no campo ' + t.rotulo + '.';
        }
      }
    }
    return '';
  }

  // Rótulo curto para o card: "#683", "PR #712", "Milestone 4". A URL inteira
  // ocupa a largura do card e não diz nada além do número.
  function rotuloUm(tipo, url) {
    var t = TIPOS[tipo];
    var m = new RegExp('/' + t.caminho + '/(\\d+)').exec(String(url || ''));
    if (m) return t.prefixo + m[1];
    var n = /\/(\d+)\/?$/.exec(String(url || ''));
    if (n) return t.prefixo + n[1];
    return t.rotulo;
  }

  // Lista {tipo, url, rotulo} do que a demanda tem. Vazio = não tem referência.
  function refs(m) {
    var out = [];
    ['issue', 'pr', 'milestone'].forEach(function (tipo) {
      var bruto = String((m && m['link_' + tipo]) || '').trim();
      if (!bruto) return;
      var urls = tipo === 'pr' ? bruto.split(/\s+/).filter(Boolean) : [bruto];
      urls.forEach(function (u) { out.push({ tipo: tipo, url: u, rotulo: rotuloUm(tipo, u) }); });
    });
    return out;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // Chips clicáveis. `target=_blank` com `rel=noopener`: sem noopener a página
  // aberta ganha referência a esta pela window.opener.
  function chipsHTML(m) {
    var r = refs(m);
    if (!r.length) return '';
    return '<span class="gh-refs">' + r.map(function (x) {
      return '<a class="gh-ref gh-' + x.tipo + '" href="' + esc(x.url) + '"' +
        ' target="_blank" rel="noopener noreferrer" title="' + esc(x.url) + '"' +
        ' onclick="event.stopPropagation()">' + esc(x.rotulo) + '</a>';
    }).join('') + '</span>';
  }

  var css = document.createElement('style');
  css.textContent = [
    '.gh-refs { display:inline-flex; gap:5px; flex-wrap:wrap; align-items:center; }',
    '.gh-ref { font-size:10.5px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;',
    '  text-decoration:none; padding:1px 7px; border-radius:20px; white-space:nowrap;',
    '  border:1px solid var(--border,#2E2E2B); color:var(--text2,#A8A49A);',
    '  background:var(--bg3,#1E1E1C); }',
    '.gh-ref:hover { color:var(--text,#ECEAE2); border-color:var(--border2,#3A3A36); }',
    /* Cores por tipo, para os tres se distinguirem de relance: verde = PR
       (entregue), azul = issue (pedido), roxo = milestone (agrupamento). */
    '.gh-ref.gh-issue { color:var(--blue-tx,#9BC8F8); border-color:#1a5080; }',
    '.gh-ref.gh-pr { color:var(--green,#3EC98E); border-color:#306010; }',
    '.gh-ref.gh-milestone { color:#C9AEFF; border-color:#5A3A9E; }',
    /* Campo com erro: a borda vermelha aparece antes de tentar salvar. */
    '.gh-input-erro { border-color:var(--red,#E5484D) !important; }',
    '.gh-erro-msg { font-size:11px; color:var(--red-tx,#F9A0A0); margin-top:3px; }',
  ].join('\n');
  document.head.appendChild(css);

  window.GH_REPO = REPO;
  window.ghLinkNormaliza = normaliza;
  window.ghLinkErro = erro;
  window.ghLinkRotulo = rotuloUm;
  window.ghLinkRefs = refs;
  window.ghLinkChips = chipsHTML;

  // Lê os três campos de um formulário cujo prefixo de id é `pre` (ex.: 'm' →
  // m-link-issue). Normaliza e valida; devolve null se algo está errado, e nesse
  // caso já marcou o campo e mostrou a mensagem — a tela só precisa parar.
  window.ghLinkColeta = function (pre, toast) {
    var out = {};
    var tipos = ['issue', 'pr', 'milestone'];
    for (var i = 0; i < tipos.length; i++) {
      var tipo = tipos[i];
      var el = document.getElementById(pre + '-link-' + tipo);
      if (!el) continue;
      el.classList.remove('gh-input-erro');
      var msg = erro(tipo, el.value);
      if (msg) {
        el.classList.add('gh-input-erro');
        if (typeof toast === 'function') toast(msg, 'err');
        el.focus();
        return null;
      }
      var v = normaliza(tipo, el.value);
      // Devolve normalizado para a tela reexibir o que foi gravado, e nao o "683"
      // que deixaria duvida se pegou.
      el.value = v;
      out['link_' + tipo] = v;
    }
    return out;
  };

  // Preenche os três campos a partir da demanda.
  window.ghLinkPreenche = function (pre, m) {
    ['issue', 'pr', 'milestone'].forEach(function (tipo) {
      var el = document.getElementById(pre + '-link-' + tipo);
      if (!el) return;
      el.classList.remove('gh-input-erro');
      el.value = String((m && m['link_' + tipo]) || '');
    });
  };
})();
