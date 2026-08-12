/* ─────────────────────────────────────────────────────────────────────────
   CATÁLOGO DE SISTEMAS E MÓDULOS — a lista suspensa padronizada

   Existe porque a lista de temas cresceu solta. Qualquer tela podia criar um
   tema novo digitando o nome, e o resultado foram 42 temas com quatro grafias
   do mesmo AxCred, módulo que era ambiente ("Qualificação"), projeto que era
   módulo ("Migração de Stack") e sub-assunto no mesmo nível do sistema
   ("Reanálise de Grupo"). Filtrar por AXCred exigia saber de cor quais dos 42
   eram AXCred.

   O NOME É O CAMINHO. Um tema se chama "AXCred - Cadastro - Análise de Crédito
   - Reanálise", e a hierarquia sai de partir por " - ". Foi a escolha de menor
   raio de explosão: sete telas já leem `tema.nome` e continuam funcionando sem
   tocar em nada, `parseTemaNome` continua valendo, e nenhuma demanda precisa
   ser reescrita para a árvore existir.

   ESTE ARQUIVO NÃO É A LISTA DE TEMAS. Ele é a ORDEM e o AGRUPAMENTO dela: os
   temas continuam vindo dos dados, e o catálogo diz quem vem antes de quem e o
   que é filho de quem. Sistema que aparecer nos dados e não estiver aqui não
   some — vai para o fim da lista, visível, porque tema órfão escondido é tema
   que ninguém corrige.

   ROLL-UP NO FILTRO: filtrar por "Cadastro" traz também "Cadastro - Análise de
   Crédito - Reanálise". Sem isso, uma árvore de quatro níveis obriga a filtrar
   folha por folha, e a pergunta "quanto o Cadastro consumiu no mês" não tem
   resposta.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var SEP = ' - ';

  // A árvore declarada do AXCred. A ordem aqui é a ordem da tela — é a ordem em
  // que o PM/PO enxerga o produto, e não alfabética, porque alfabética separaria
  // Negócio de Cadastro e de Operações, que é justamente o caminho da esteira.
  var AXCRED = [
    'Painel',
    'Consultas',
    'Terras',
    'Rastreamento',
    ['Negócio', ['LDR', 'SDR', 'Comercial']],
    ['Cadastro', [
      ['Análise de Crédito', ['Análise', 'Reanálise', 'Cadastro Rápido']],
      'Limites',
    ]],
    ['Operações', ['Nova Operação', 'Dashboard', 'Regras de Alçada', 'Simulador']],
    'Domínio',
    'Fachadas',
    'Liminar',
    'SCR',
    'Jurídico',
    'Antifraude',
    'Cobrança',
    'Ferramentas',
    // Fora da lista original, decididos caso a caso: Infraestrutura é plataforma
    // (monitoramento de travamento e de banco) e Rating é um ambiente novo que
    // ainda vai ser construído — a demanda que o cria já nasce apontando para ele.
    'Infraestrutura',
    'Rating',
  ];

  // Sistemas sem árvore declarada. Ficam listados para fixar a ORDEM e a grafia;
  // os módulos deles continuam vindo dos dados. Não declarar módulo aqui é
  // deliberado: eles nascem e morrem rápido, e uma lista fixa ficaria errada.
  var OUTROS = ['BI', 'RPA', 'IA e vibecode', 'AX Leader', 'Ax Caixa', 'Ax Despesas',
                'WorksOS RH', 'Fidc News', 'RH FOLHA (monday)', 'Jurídico',
                'Databricks', 'N8N', 'Bitrix', 'Sistema PDD', 'Novo Ambiente'];

  function norm(t) {
    return String(t == null ? '' : t)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // Todos os caminhos canônicos, em ordem de tela.
  function caminhos() {
    var fora = [];
    function anda(prefixo, no) {
      if (typeof no === 'string') { fora.push(prefixo + SEP + no); return; }
      var nome = no[0], filhos = no[1] || [];
      fora.push(prefixo + SEP + nome);
      filhos.forEach(function (f) { anda(prefixo + SEP + nome, f); });
    }
    fora.push('AXCred');
    AXCRED.forEach(function (n) { anda('AXCred', n); });
    return fora;
  }

  var _ordem = null;
  function ordemDe(nome) {
    if (!_ordem) {
      _ordem = {};
      caminhos().forEach(function (c, i) { _ordem[norm(c)] = i; });
      OUTROS.forEach(function (s, i) { _ordem[norm(s)] = 10000 + i * 100; });
    }
    if (_ordem[norm(nome)] !== undefined) return _ordem[norm(nome)];
    // Módulo de sistema não declarado herda a posição do sistema, e fica logo
    // depois dele. Sistema desconhecido vai para o fim, em ordem alfabética.
    var raiz = String(nome).split(SEP)[0];
    if (_ordem[norm(raiz)] !== undefined) return _ordem[norm(raiz)] + 1;
    return 90000;
  }

  function partes(nome) {
    return String(nome || '').split(SEP).map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function nivel(nome) { return Math.max(0, partes(nome).length - 1); }
  function folha(nome) { var p = partes(nome); return p.length ? p[p.length - 1] : ''; }
  function sistema(nome) { var p = partes(nome); return p.length ? p[0] : ''; }

  // O tema `filho` está dentro de `pai`? Vale para o próprio pai — filtrar por
  // Cadastro tem de trazer Cadastro também, e não só os filhos dele.
  function dentro(nomeFilho, nomePai) {
    var f = norm(nomeFilho), p = norm(nomePai);
    // O separador comparado tem de ser o LITERAL ' - '. `norm(SEP)` devolve '-',
    // porque norm apara as pontas — e com ele "AXCred - Cadastro" nunca casava
    // com o proprio filho. O teste pegou; a versao anterior dizia que Reanalise
    // nao estava dentro de Cadastro.
    return f === p || f.indexOf(p + ' - ') === 0;
  }

  function ordena(temas) {
    return (temas || []).slice().sort(function (a, b) {
      var oa = ordemDe(a.nome), ob = ordemDe(b.nome);
      if (oa !== ob) return oa - ob;
      return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
    });
  }

  // O <option> indentado. A indentação usa espaço fino ( ) porque espaço
  // normal some no HTML e o navegador não indenta <option> por conta própria —
  // sem isso a árvore vira uma lista plana com nomes compridos.
  function opcoesHTML(temas, valorAtual, opts) {
    opts = opts || {};
    var lista = ordena(temas);
    var esc = window.apresentacaoEsc || function (s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    };
    var html = opts.vazio === false ? '' :
      '<option value="">' + esc(opts.rotuloVazio || '— selecione —') + '</option>';
    var sisAtual = '';
    lista.forEach(function (t) {
      var s = sistema(t.nome);
      if (s !== sisAtual) {
        if (sisAtual) html += '</optgroup>';
        html += '<optgroup label="' + esc(s) + '">';
        sisAtual = s;
      }
      var n = nivel(t.nome);
      var recuo = new Array(n + 1).join('  ');
      var rot = n === 0 ? t.nome : recuo + '└ ' + folha(t.nome);
      html += '<option value="' + esc(t.id) + '"' +
        (String(t.id) === String(valorAtual) ? ' selected' : '') + '>' +
        esc(rot) + (opts.contagem && opts.contagem[t.id] ? '  (' + opts.contagem[t.id] + ')' : '') +
        '</option>';
    });
    if (sisAtual) html += '</optgroup>';
    if (opts.outro) html += '<option value="__novo__">+ outro (escrever)…</option>';
    return html;
  }

  // Rótulo curto para onde não cabe o caminho inteiro: card de Kanban, chip de
  // filtro, célula de tabela. "AXCred › Reanálise" diz o necessário; o caminho
  // completo vai no title.
  function curto(nome) {
    var p = partes(nome);
    if (p.length <= 2) return p.join(' › ');
    return p[0] + ' › ' + p[p.length - 1];
  }
  function completo(nome) { return partes(nome).join(' › '); }


  /* ── O CAMPO E O FILTRO ──────────────────────────────────────────────────
     Uma implementação, e não uma por tela. Admin, Planejamento, painel Dev e
     painel público tinham cada um a sua cópia de onSistemaChange /
     populateModulos / resolveTemaSelecao — quatro cópias da mesma regra, que é
     exatamente por que a lista divergiu entre as telas.

     E um select só, no lugar dos dois (Sistema + Módulo). Com quatro níveis, dois
     selects viram três, depois quatro, e a pessoa tem de acertar a sequência toda
     para chegar em "Reanálise". Um select agrupado mostra a árvore inteira de uma
     vez, e o navegador já sabe buscar dentro dela digitando.                  */

  // Preenche o <select id="{prefixo}-tema">. O campo de texto
  // "{prefixo}-tema-novo" aparece só quando a pessoa escolhe "+ outro".
  function ligaCampo(prefixo, temas, temaId, opts) {
    var sel = document.getElementById(prefixo + '-tema');
    if (!sel) return;
    sel.innerHTML = opcoesHTML(temas, temaId,
      Object.assign({ outro: true, rotuloVazio: '— selecione o sistema —' }, opts || {}));
    sel.value = temaId && [].some.call(sel.options, function (o) { return o.value === String(temaId); })
      ? String(temaId) : (temaId ? '' : sel.value);
    mostraNovo(prefixo);
  }

  function mostraNovo(prefixo) {
    var sel = document.getElementById(prefixo + '-tema');
    var txt = document.getElementById(prefixo + '-tema-novo');
    if (sel && txt) txt.style.display = sel.value === '__novo__' ? 'block' : 'none';
  }

  // Resolve a escolha em um tema_id. `criar` recebe o nome e devolve o id do tema
  // novo — cada tela tem o seu gerador de id, e por isso ele entra por fora.
  //
  // Vazio devolve o fallback, e não string vazia: salvar um card pela aba Dados
  // sem tocar no sistema não pode apagar o sistema que ele já tinha.
  function resolve(prefixo, temas, fallbackId, criar) {
    var sel = document.getElementById(prefixo + '-tema');
    if (!sel) return fallbackId || '';
    if (sel.value && sel.value !== '__novo__') return sel.value;
    if (sel.value !== '__novo__') return fallbackId || '';
    var txt = document.getElementById(prefixo + '-tema-novo');
    var nome = String((txt && txt.value) || '').trim();
    if (!nome) return fallbackId || '';
    var achou = (temas || []).find(function (t) {
      return String(t.nome || '').toLowerCase() === nome.toLowerCase();
    });
    if (achou) return achou.id;
    return criar ? criar(nome) : (fallbackId || '');
  }

  // O filtro. O valor é o id do tema, e quem filtra usa `catalogoDentro` para
  // pegar os filhos junto — escolher "Cadastro" tem de trazer Reanálise.
  function ligaFiltro(el, temas, valor, rotuloTodos) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return;
    el.innerHTML = opcoesHTML(temas, valor, { rotuloVazio: rotuloTodos || 'Todos os sistemas' });
    if (valor) el.value = String(valor);
  }

  // A demanda casa com o filtro? Trata o roll-up e o "sem filtro".
  function casa(temaIdDaDemanda, temaIdDoFiltro, temas) {
    if (!temaIdDoFiltro) return true;
    if (String(temaIdDaDemanda) === String(temaIdDoFiltro)) return true;
    var lista = temas || [];
    var f = lista.find(function (t) { return String(t.id) === String(temaIdDoFiltro); });
    var d = lista.find(function (t) { return String(t.id) === String(temaIdDaDemanda); });
    if (!f || !d) return false;
    return dentro(d.nome, f.nome);
  }

  window.catalogoLigaCampo = ligaCampo;
  window.catalogoMostraNovo = mostraNovo;
  window.catalogoResolve = resolve;
  window.catalogoLigaFiltro = ligaFiltro;
  window.catalogoCasa = casa;
  window.catalogoCaminhos = caminhos;
  window.catalogoOrdena = ordena;
  window.catalogoOpcoesHTML = opcoesHTML;
  window.catalogoDentro = dentro;
  window.catalogoCurto = curto;
  window.catalogoCompleto = completo;
  window.catalogoSistema = sistema;
  window.catalogoFolha = folha;
  window.catalogoNivel = nivel;
})();
