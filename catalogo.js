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
    // Rating e modulo do AXCred como qualquer outro. Que ele ainda esteja por
    // construir nao muda onde ele mora: a demanda que o cria ja nasce apontando
    // para o lugar definitivo, e no dia em que existir nao ha nada para migrar.
    'Rating',
  ];

  // Sistemas sem árvore declarada. Ficam listados para fixar a ORDEM e a grafia;
  // os módulos deles continuam vindo dos dados. Não declarar módulo aqui é
  // deliberado: eles nascem e morrem rápido, e uma lista fixa ficaria errada.
  //
  // Infraestrutura vem primeiro, logo depois do AXCred, porque é onde quem
  // procura vai olhar. Ela fica FORA da árvore do AXCred de propósito: é
  // plataforma, e não produto — monitoramento de travamento e de banco não é uma
  // parte do AXCred, é o chão em que ele roda. E ela atende mais coisa que o
  // AXCred, então pendurá-la ali faria o filtro do AXCred contar trabalho que não
  // é dele.
  var OUTROS = ['Infraestrutura',
                'BI', 'RPA', 'IA e vibecode', 'AX Leader', 'Ax Caixa', 'Ax Despesas',
                'WorksOS RH', 'Fidc News', 'RH FOLHA (monday)',
                'Databricks', 'N8N', 'Bitrix', 'Sistema PDD',
                // Existem nos dados e nao estavam declarados: caiam no 90000, no
                // fim da lista, junto com os erros de digitacao. Sao sistemas de
                // verdade, e agora tem lugar fixo.
                'Audax Stars', 'Site Audax', 'Smarts'];

  /* `Jurídico` SAIU DAQUI, e a saida e o conserto.
     Ele estava declarado nos dois lugares: como sistema aqui e como modulo do
     AXCred na arvore acima. Enquanto o catalogo abencoar as duas formas, o
     `Jurídico` solto na raiz parece certo — e ele existe na base, ao lado de
     `AXCred - Jurídico`. Fora daqui, ele cai para o fim da lista, que e onde o
     proprio cabecalho deste arquivo diz que o orfao tem de ficar: "tema orfao
     escondido e tema que ninguem corrige".

     `Novo Ambiente` tambem saiu: nao existe sistema com esse nome. Ele e
     `AXCred - Operações - Novo Ambiente`, e ja vem da arvore. */

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
  var _fim = null;      // ultima posicao ocupada dentro de cada caminho declarado

  function montaOrdem() {
    if (_ordem) return;
    _ordem = {};
    _fim = {};
    caminhos().forEach(function (c, i) { _ordem[norm(c)] = i; });
    OUTROS.forEach(function (s, i) { _ordem[norm(s)] = 10000 + i * 100; });
    // Para cada caminho declarado, ate onde vai a descendencia dele. E o que
    // permite encaixar um modulo nao declarado DEPOIS dos irmaos declarados, em
    // vez de na frente deles.
    Object.keys(_ordem).forEach(function (chave) {
      var pos = _ordem[chave];
      Object.keys(_ordem).forEach(function (outra) {
        if (outra.indexOf(chave + ' - ') === 0 && _ordem[outra] > pos) pos = _ordem[outra];
      });
      _fim[chave] = pos;
    });
  }

  function ordemDe(nome) {
    montaOrdem();
    if (_ordem[norm(nome)] !== undefined) return _ordem[norm(nome)];
    /* MODULO NAO DECLARADO FICA JUNTO DO PAI, e nao no topo do sistema.
       Antes a busca ia direto para a RAIZ: `AXCred - Operações - Gestão de
       Patrimônio` nao esta declarado, entao caia em `posicao(AXCred) + 1` — e
       aparecia no filtro ACIMA de `Painel`, tres niveis fora do lugar, longe do
       `Operações` a que pertence. Numa lista de 71, e o bastante para a pessoa
       concluir que o modulo nao existe.
       Agora sobe caminho por caminho ate achar um ancestral declarado e entra
       DEPOIS do que ja existe debaixo dele (`_fim`), que e onde um irmao novo
       naturalmente entraria. */
    var p = partes(nome);
    for (var i = p.length - 1; i >= 1; i--) {
      var pai = norm(p.slice(0, i).join(SEP));
      if (_ordem[pai] !== undefined) return _fim[pai] + 0.5;
    }
    // Sistema desconhecido vai para o fim, em ordem alfabética — visível, porque
    // tema órfão escondido é tema que ninguém corrige.
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
    /* ── "+ OUTRO" SAI QUANDO A LISTA NÃO CARREGOU ──────────────────────────
       `resolve` só evita tema duplicado comparando o nome digitado com esta
       lista. Com a lista VAZIA a comparação não acha nada, e o campo livre cria
       um tema novo — não por escolha de ninguém, mas porque a checagem estava
       cega.

       ACONTECEU: a leitura dos dados falhou, o select apareceu vazio, e quem
       precisava classificar em "AXCred - Cobrança" digitou "Cobrança". Nasceu um
       tema solto na raiz ao lado de um que já existia no servidor. A tela
       convidou a recriar o que ela não conseguia mostrar.

       O ANTÍDOTO NÃO É ESCONDER O CAMPO SEMPRE: lista vazia de verdade (base
       nova) é caso legítimo de escrever o primeiro nome. Só quando `LEITURA`
       diz que a última leitura FALHOU é que a ausência da lista não significa
       "não há temas", e sim "não sei quais são". Nesse caso a opção é trocada
       por uma explicação, desabilitada — o select continua contando o que houve
       em vez de ficar simplesmente curto. */
    var cego = lista.length === 0 && !!(window.LEITURA && window.LEITURA.incompleta());
    if (opts.outro && !cego) html += '<option value="__novo__">+ outro (escrever)…</option>';
    if (opts.outro && cego) {
      html += '<option value="" disabled>— a lista não carregou; recarregue antes de criar —</option>';
    }
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
    /* A TRANCA, e não só a porta. `opcoesHTML` deixa de OFERECER "+ outro"
       quando a leitura falhou, mas o select pode já estar montado de antes com
       `__novo__` selecionado — a faixa aparece depois de um poll que falhou, e o
       formulário aberto não se remonta. Criar um tema aqui, sem lista para
       comparar, é o que produziu o `Cobrança` duplicado. */
    if ((temas || []).length === 0 && window.LEITURA && window.LEITURA.incompleta()) {
      return fallbackId || '';
    }
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

  /** A RAIZ DO SISTEMA: os dois primeiros segmentos do nome.
   *
   *  "AXCred - Operações", "AXCred - Operações - Dashboard" e "AXCred - Operações -
   *  Nova Operação" sao o mesmo sistema para quem pergunta "quanto foi para
   *  Operações". Separados, o sistema aparece menor do que e e cinco vezes na mesma
   *  lista — e nenhuma das cinco responde a pergunta.
   *
   *  DOIS SEGMENTOS, E NAO UM. "AXCred" sozinho juntaria Cadastro, Cobranca,
   *  Operacoes e Antifraude num balde de 90%, que e o mesmo que nao agrupar: a
   *  pergunta "para onde a capacidade foi" deixaria de ter resposta.
   *
   *  Mora aqui porque a mesma regra vive nos Relatorios, no deck e no painel. Ela
   *  ja nasceu tres vezes; a quarta copia seria a que divergiria em silencio, e
   *  esta ferramenta ja produziu esse defeito com `STATUS_ATRASO` e com a data de
   *  entrega.
   */
  /* AS FAMILIAS QUE SE DESDOBRAM NUM SEGUNDO NIVEL.
   *
   * A raiz e UM segmento por padrao: "BI - Atualização", "BI - Reports" e "BI -
   * Conexão ao Monday" sao BI, e "WorksOS RH - Bônus", "- PDI" e "- Cultura
   * Organizacional" sao WorksOS RH. Quem pergunta "quanto foi para o BI" quer um
   * numero, e nao quatro linhas de uma demanda cada.
   *
   * AXCred e a excecao porque ela sozinha tem 200 das 287 demandas: um balde
   * "AXCred" seria 70% da lista e a pergunta "para onde a capacidade foi" ficaria
   * sem resposta — Cadastro, Cobranca, Operacoes e Antifraude precisam se ver.
   *
   * LISTA EXPLICITA, e nao um limite automatico por volume: um corte que se move
   * sozinho faria o filtro mudar de forma no meio do mes, e quem usa a tela todo
   * dia precisa que ela seja a mesma amanha. Familia nova que cresca demais entra
   * aqui a mao — e o dia de fazer isso e visivel, porque o balde aparece grande.
   */
  var DESDOBRA = ['AXCred'];

  /* ─── O QUE ESTA FORA DO PADRAO ──────────────────────────────────────────
     O pedido foi "unifique os temas... e valide o que mais esta fora do padrao".

     ISTO E UM RELATORIO, e nao uma correcao automatica. Juntar tema move demanda
     de lugar e nao tem desfazer; quem decide e quem conhece o produto. O que o
     codigo pode fazer e PARAR DE DEIXAR PASSAR DESPERCEBIDO — apontar, com o
     motivo, e deixar a juncao a um clique.

     Tres achados, em ordem de confianca:

     `duplicado`  modulo que existe TAMBEM solto na raiz. "Cobrança" ao lado de
                  "AXCred - Cobrança". E o caso mais claro que existe: os dois
                  nomes significam a mesma coisa, e filtrar por um perde o outro.
                  O proprio comentario do `opcoesHTML` conta como nascem — a
                  leitura falhou, o select veio vazio, e alguem digitou o nome
                  curto.

     `grafia`     sistemas com o mesmo nome escrito diferente. "Ax Despesa" e
                  "Ax Despesas" viram dois sistemas na lista, e o filtro de um
                  nao acha o outro.

     `raizUsada`  raiz de sistema usada como tema, tendo modulos abaixo. Este
                  NAO e erro por definicao — "AXCred" pode ser a escolha honesta
                  para o que nao cabe em modulo nenhum. Vem marcado para revisao,
                  e nao para juncao, justamente porque a resposta depende de
                  conhecer o produto.

     A REGRA DA GRAFIA E ESTREITA DE PROPOSITO. A primeira versao comparava
     prefixo — e acusou "BI" contra "Bitrix", que sao sistemas diferentes. Um
     detector que grita errado ensina a ignorar o detector. Agora so casa o que e
     a mesma palavra: plural/singular, ou uma letra trocada em nome ja longo. */
  function distancia(a, b) {
    var m = a.length, n = b.length;
    if (Math.abs(m - n) > 2) return 99;
    var linha = [];
    for (var j = 0; j <= n; j++) linha[j] = j;
    for (var i = 1; i <= m; i++) {
      var ant = linha[0];
      linha[0] = i;
      for (var k = 1; k <= n; k++) {
        var tmp = linha[k];
        linha[k] = Math.min(linha[k] + 1, linha[k - 1] + 1,
                            ant + (a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1));
        ant = tmp;
      }
    }
    return linha[n];
  }

  function mesmaPalavra(a, b) {
    var x = norm(a), y = norm(b);
    if (x === y) return false;
    // Plural e singular do mesmo nome.
    if (x.replace(/s$/, '') === y.replace(/s$/, '')) return true;
    // Uma ou duas letras de diferenca, em nome longo o bastante para nao ser
    // coincidencia. "bi" e "bitrix" nao passam: o curto tem 2 letras.
    return Math.min(x.length, y.length) >= 6 && distancia(x, y) <= 2;
  }

  function foraDoPadrao(temas) {
    var lista = (temas || []).filter(function (t) { return t && t.nome; });
    var achados = [];

    // Modulo que existe tambem solto na raiz.
    var porFolha = {};
    lista.forEach(function (t) {
      var p = partes(t.nome);
      if (p.length > 1) porFolha[norm(p[p.length - 1])] = t;
    });
    lista.forEach(function (t) {
      if (partes(t.nome).length !== 1) return;
      var alvo = porFolha[norm(t.nome)];
      if (!alvo) return;
      achados.push({ tipo: 'duplicado', de: t, para: alvo,
        motivo: 'Mesmo assunto com dois nomes: filtrar por um perde o outro.' });
    });

    // Sistemas com a mesma palavra escrita diferente.
    var sistemas = {};
    lista.forEach(function (t) {
      var s = sistema(t.nome);
      if (!sistemas[norm(s)]) sistemas[norm(s)] = { nome: s, temas: [] };
      sistemas[norm(s)].temas.push(t);
    });
    var chaves = Object.keys(sistemas);
    for (var i = 0; i < chaves.length; i++) {
      for (var j = i + 1; j < chaves.length; j++) {
        var a = sistemas[chaves[i]], b = sistemas[chaves[j]];
        if (!mesmaPalavra(a.nome, b.nome)) continue;
        // O que tem MENOS temas e o desviante: o padrao e onde a maioria esta.
        var menor = a.temas.length <= b.temas.length ? a : b;
        var maior = menor === a ? b : a;
        menor.temas.forEach(function (t) {
          achados.push({ tipo: 'grafia', de: t, para: null, sistemaCerto: maior.nome,
            motivo: 'Sistema "' + menor.nome + '" e "' + maior.nome +
                    '" são o mesmo nome escrito diferente \u2014 viram dois na lista.' });
        });
      }
    }

    // Raiz de sistema usada como tema, tendo modulos abaixo.
    lista.forEach(function (t) {
      if (partes(t.nome).length !== 1) return;
      var filhos = lista.filter(function (o) {
        return o !== t && norm(sistema(o.nome)) === norm(t.nome);
      });
      if (!filhos.length) return;
      if (achados.some(function (x) { return x.de === t; })) return;  // ja apontado
      achados.push({ tipo: 'raizUsada', de: t, para: null, filhos: filhos.length,
        motivo: 'Raiz de sistema com ' + filhos.length +
                (filhos.length === 1 ? ' m\u00f3dulo abaixo. ' : ' m\u00f3dulos abaixo. ') +
                'Pode ser proposital \u2014 vale conferir se n\u00e3o deveria ser um m\u00f3dulo.' });
    });

    return achados;
  }

  function raiz(nome) {
    var p = partes(nome);
    if (!p.length) return '';
    var abre = DESDOBRA.some(function (f) { return norm(f) === norm(p[0]); });
    return abre ? p.slice(0, 2).join(SEP) : p[0];
  }

  /** A demanda pertence a esta raiz? Recebe o nome do tema, nao o id — o filtro do
   *  painel guarda a raiz, que e texto e nao existe como registro. */
  function naRaiz(nomeDoTema, raizDoFiltro) {
    if (!raizDoFiltro) return true;
    return norm(raiz(nomeDoTema)) === norm(raizDoFiltro);
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
/** A ASSINATURA DE UM TITULO — como duas demandas se reconhecem iguais.
   *
   *  Existe porque nada, em camada nenhuma, impedia criar duas demandas identicas.
   *  Em 25/08 a AX-324 e a AX-325 nasceram com 91 segundos de diferenca, mesmo
   *  titulo, mesma dev e a MESMA descricao de 848 caracteres byte a byte. As duas
   *  gravaram, as duas deram "Salvo!", e a primeira ficou orfa ate ser apagada a
   *  mao — e apagar nao deixa rastro, entao o caso so foi reconstituivel pelos
   *  commits do repositorio de dados.
   *
   *  So o TITULO entra. Medido nas 324 demandas da base: comparar por titulo,
   *  ignorando dev e descricao, colide exatamente UMA vez — no par que se quer
   *  barrar. Zero falso positivo em toda a historia. Uma regra que exigisse
   *  tambem a descricao deixaria passar a duplicata que ninguem descreveu.
   *
   *  ESTE CORPO E COPIADO NO WORKER, e uma invariante exige que os dois sejam
   *  identicos. A tela avisa antes; o Worker recusa. Se as duas normalizacoes
   *  divergirem, a tela liberaria o que o servidor barra — e a pessoa levaria um
   *  erro que a tela dizia nao existir. */
  function tituloAssinatura(t) {
    return String(t == null ? '' : t)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
  window.tituloAssinatura = tituloAssinatura;

  window.catalogoForaDoPadrao = foraDoPadrao;
  window.catalogoRaiz = raiz;
  window.catalogoNaRaiz = naRaiz;
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
