/* ─────────────────────────────────────────────────────────────────────────
   REFERÊNCIA AO GITHUB — Issue, PR e Milestone
   ─────────────────────────────────────────────────────────────────────────
   Antes havia UM campo `link_externo` para "o link da demanda". Estava
   preenchido em ZERO das 201 demandas: um slot para três coisas diferentes não
   serve para nenhuma, e — a parte que faltava notar — ele nunca existiu em tela
   alguma. Só a API o aceitava.

   ─── POR QUE O REPOSITÓRIO É EXPLÍCITO ──────────────────────────────────
   A primeira versão disto tinha UM repositório padrão embutido, e o número solo
   expandia para ele. O João Vitor apontou o problema no mesmo dia: existem
   axcaixa, PDF_CADASTRO, Workos_ia e outros — "senão sempre vai subir como se
   fosse axcred". Ele está certo, e o defeito era do tipo pior: silencioso. O
   link ficava gravado, clicável e apontando para o repositório errado.

   Agora nada é adivinhado. Número solo só é aceito com o repositório escolhido;
   sem ele, a validação pede o link completo. URL completa vale sempre, de
   qualquer repositório ou de qualquer outra ferramenta.

   ─── POR QUE O CAMPO MOSTRA O NÚMERO, E NÃO A URL ───────────────────────
   No primeiro print os três campos apareciam como "https://github.co…"
   truncado: depois de normalizar, o input ficava ilegível e não se distinguia
   issue de PR. Agora o campo exibe a forma CURTA (683) quando a URL é de um
   repositório reconhecido, e a URL inteira só quando é de fora — aí ela é a
   informação. O link clicável fica nos chips abaixo.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var OWNER = 'audaxcapitalsa';

  // Semente da lista. Não é a lista definitiva de propósito: `reposConhecidos()`
  // junta a estes os repositórios que já aparecem nos links da base, então a
  // lista se completa com o uso. Uma lista fixa aqui apodreceria no primeiro
  // repositório novo, e o sintoma seria exatamente o que o João reportou.
  var REPOS_SEED = ['AXCRED-DJANGO', 'axcaixa', 'PDF_CADASTRO', 'Workos_ia'];

  var TIPOS = {
    issue:     { caminho: 'issues',    rotulo: 'Issue',     prefixo: '#' },
    pr:        { caminho: 'pull',      rotulo: 'PR',        prefixo: 'PR #' },
    milestone: { caminho: 'milestone', rotulo: 'Milestone', prefixo: 'Milestone ' },
  };

  // owner/repo de uma URL do GitHub, ou ''.
  function repoDaUrl(url) {
    var m = /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\//i.exec(String(url || ''));
    return m ? m[1] + '/' + m[2] : '';
  }

  function kindDaUrl(url) {
    var m = /^https?:\/\/(?:www\.)?github\.com\/[^/]+\/[^/]+\/([^/]+)\/\d+/i.exec(String(url || ''));
    return m ? m[1].toLowerCase() : '';
  }

  // Repositórios oferecidos no seletor: a semente mais tudo que a base já usa.
  function reposConhecidos(melhorias) {
    var vistos = {};
    REPOS_SEED.forEach(function (r) { vistos[OWNER + '/' + r] = true; });
    (melhorias || []).forEach(function (m) {
      ['link_issue', 'link_pr', 'link_milestone'].forEach(function (c) {
        String((m && m[c]) || '').split(/\s+/).forEach(function (u) {
          var r = repoDaUrl(u);
          if (r) vistos[r] = true;
        });
      });
    });
    return Object.keys(vistos).sort();
  }

  // Número solo → URL, se houver repositório. URL → ela mesma, intacta.
  function normalizaUm(tipo, valor, repo) {
    var t = TIPOS[tipo];
    if (!t) return '';
    var v = String(valor == null ? '' : valor).trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    var n = v.replace(/^#/, '').trim();
    // Sem repositório, o número fica como está e a validação recusa. Expandir
    // com um padrão é justamente o que apontava para o repositório errado.
    if (/^\d+$/.test(n) && repo) {
      return 'https://github.com/' + repo + '/' + t.caminho + '/' + n;
    }
    return v;
  }

  // PR aceita mais de um: demanda quebrada em dois PRs é rotina, e sem isto o
  // segundo iria para o campo de observação.
  function normaliza(tipo, valor, repo) {
    var v = String(valor == null ? '' : valor).trim();
    if (!v) return '';
    if (tipo !== 'pr') return normalizaUm(tipo, v, repo);
    return v.split(/[\s,;]+/).filter(Boolean)
            .map(function (x) { return normalizaUm('pr', x, repo); })
            .join(' ');
  }

  // Texto do erro, ou '' se está válido. Diz o que fazer, não a regra.
  function erro(tipo, valor, repo) {
    var bruto = String(valor == null ? '' : valor).trim();
    if (!bruto) return '';
    var t = TIPOS[tipo];
    var v = normaliza(tipo, bruto, repo);
    var partes = tipo === 'pr' ? v.split(/\s+/).filter(Boolean) : [v];
    for (var i = 0; i < partes.length; i++) {
      var u = partes[i];
      if (!/^https?:\/\//i.test(u)) {
        if (/^#?\d+$/.test(u)) {
          return 'Escolha o repositório para usar só o número, ou cole o link completo ' +
                 'em ' + t.rotulo + '.';
        }
        return 'Em ' + t.rotulo + ', use o número (com o repositório escolhido) ou o ' +
               'endereço completo.';
      }
      // Só cobra a forma quando é github.com: link de Jira, Confluence ou outra
      // ferramenta continua aceito sem palpite nosso.
      var k = kindDaUrl(u);
      if (k && ['issues', 'pull', 'milestone'].indexOf(k) >= 0 && k !== t.caminho) {
        var certo = { issues: 'Issue', pull: 'PR', milestone: 'Milestone' }[k];
        return 'Este endereço é de ' + certo + ', mas está no campo ' + t.rotulo + '.';
      }
    }
    return '';
  }

  // Forma curta para o INPUT: o número, quando a URL é reconhecível. Assim o
  // campo continua legível e dá para distinguir issue de PR de relance.
  function curto(tipo, url) {
    var u = String(url || '').trim();
    if (!u) return '';
    var t = TIPOS[tipo];
    var m = new RegExp('^https?://(?:www\\.)?github\\.com/[^/]+/[^/]+/' + t.caminho +
                       '/(\\d+)/?$', 'i').exec(u);
    return m ? m[1] : u;
  }

  // Rótulo do chip: "#683", "PR #712", "Milestone 4".
  function rotuloUm(tipo, url) {
    var t = TIPOS[tipo];
    var m = new RegExp('/' + t.caminho + '/(\\d+)').exec(String(url || ''));
    if (m) return t.prefixo + m[1];
    var n = /\/(\d+)\/?$/.exec(String(url || ''));
    if (n) return t.prefixo + n[1];
    return t.rotulo;
  }

  function refs(m) {
    var out = [];
    ['issue', 'pr', 'milestone'].forEach(function (tipo) {
      var bruto = String((m && m['link_' + tipo]) || '').trim();
      if (!bruto) return;
      var urls = tipo === 'pr' ? bruto.split(/\s+/).filter(Boolean) : [bruto];
      urls.forEach(function (u) {
        out.push({ tipo: tipo, url: u, rotulo: rotuloUm(tipo, u), repo: repoDaUrl(u) });
      });
    });
    return out;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // Chips clicáveis. O repositório entra no title: com vários repositórios em
  // jogo, "#683" sozinho não diz de onde é — e era esse o ponto do João.
  function chipsHTML(m) {
    var r = refs(m);
    if (!r.length) return '';
    return '<span class="gh-refs">' + r.map(function (x) {
      var t = x.repo ? x.repo + ' — ' + x.url : x.url;
      return '<a class="gh-ref gh-' + x.tipo + '" href="' + esc(x.url) + '"' +
        ' target="_blank" rel="noopener noreferrer" title="' + esc(t) + '"' +
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
    /* Cor por tipo: azul = issue (pedido), verde = PR (entrega), roxo =
       milestone (agrupamento). Distingue de relance sem depender do texto. */
    '.gh-ref.gh-issue { color:var(--blue-tx,#9BC8F8); border-color:#1a5080; }',
    '.gh-ref.gh-pr { color:var(--green,#3EC98E); border-color:#306010; }',
    '.gh-ref.gh-milestone { color:#C9AEFF; border-color:#5A3A9E; }',
    '.gh-input-erro { border-color:var(--red,#E5484D) !important; }',
    '.gh-repo-sel { font-size:12px; max-width:100%; }',
  ].join('\n');
  document.head.appendChild(css);

  window.GH_OWNER = OWNER;
  window.ghLinkNormaliza = normaliza;
  window.ghLinkErro = erro;
  window.ghLinkCurto = curto;
  window.ghLinkRotulo = rotuloUm;
  window.ghLinkRefs = refs;
  window.ghLinkChips = chipsHTML;
  window.ghLinkRepoDaUrl = repoDaUrl;
  window.ghLinkRepos = reposConhecidos;

  // Popula o seletor de repositório. `melhorias` alimenta a lista com o que a
  // base já usa, para ela não depender de manutenção manual.
  window.ghLinkMontaRepos = function (pre, melhorias, repoAtual) {
    var sel = document.getElementById(pre + '-link-repo');
    if (!sel) return;
    var lista = reposConhecidos(melhorias);
    if (repoAtual && lista.indexOf(repoAtual) < 0) lista.push(repoAtual);
    sel.innerHTML = '<option value="">— escolha o repositório —</option>' +
      lista.map(function (r) {
        return '<option value="' + esc(r) + '"' + (r === repoAtual ? ' selected' : '') +
               '>' + esc(r) + '</option>';
      }).join('');
  };

  // Preenche os três campos na forma curta e ajusta o seletor de repositório
  // conforme os links já gravados.
  window.ghLinkPreenche = function (pre, m, melhorias) {
    var r = refs(m);
    var repo = (r.find(function (x) { return x.repo; }) || {}).repo || '';
    window.ghLinkMontaRepos(pre, melhorias, repo);
    ['issue', 'pr', 'milestone'].forEach(function (tipo) {
      var el = document.getElementById(pre + '-link-' + tipo);
      if (!el) return;
      el.classList.remove('gh-input-erro');
      var bruto = String((m && m['link_' + tipo]) || '').trim();
      el.value = tipo === 'pr'
        ? bruto.split(/\s+/).filter(Boolean).map(function (u) { return curto('pr', u); }).join(', ')
        : curto(tipo, bruto);
    });
  };

  // Lê, valida e devolve {link_issue, link_pr, link_milestone} já em URL. null
  // quando algo está errado — nesse caso já avisou e focou o campo.
  window.ghLinkColeta = function (pre, toast) {
    var selRepo = document.getElementById(pre + '-link-repo');
    var repo = selRepo ? selRepo.value : '';
    var out = {};
    var tipos = ['issue', 'pr', 'milestone'];
    for (var i = 0; i < tipos.length; i++) {
      var tipo = tipos[i];
      var el = document.getElementById(pre + '-link-' + tipo);
      if (!el) continue;
      el.classList.remove('gh-input-erro');
      var msg = erro(tipo, el.value, repo);
      if (msg) {
        el.classList.add('gh-input-erro');
        if (typeof toast === 'function') toast(msg, 'err');
        // Foca o SELETOR quando o que falta é o repositório: focar o campo do
        // número mandaria a pessoa para onde ela já digitou certo.
        if (/Escolha o repositório/.test(msg) && selRepo) selRepo.focus(); else el.focus();
        return null;
      }
      out['link_' + tipo] = normaliza(tipo, el.value, repo);
    }
    return out;
  };
})();
