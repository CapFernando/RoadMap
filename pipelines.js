/* ─────────────────────────────────────────────────────────────────────────
   PIPELINES — a frente de trabalho de cada pessoa

   Existe porque a visão que a diretoria APROVOU organiza tudo por pipeline, e
   esta ferramenta não tinha esse eixo: ela sabe o tema da demanda e quem
   executou, e nada que diga "esta entrega é de RPA".

   SÃO QUATRO HOJE: IA & Vibe coding, Desenvolvimento, Dados & Power BI e
   Automação & RPA. Eram cinco — `Dados & Inteligência` e `Power BI` foram
   fundidas, ver o comentário na lista abaixo. Os dois nomes antigos continuam
   resolvendo para a frente nova (`APELIDOS`), senão a fusão apagaria em silêncio
   toda marcação já feita na tela de contas.

   A FRENTE É DA PESSOA, E NÃO DA DEMANDA. Foi a escolha de menor atrito: o
   dado que já existe em toda demanda desde o primeiro dia é `dev`, e nenhuma
   das 268 demandas precisa ser reescrita para o eixo passar a existir. Tema não
   serve — "AXCred" aparece em Desenvolvimento, em Dados e em RPA, porque o
   produto é o mesmo e a frente é que muda.

   O LIMITE DISSO, DECLARADO: quem atua em duas frentes conta inteiro na
   frente cadastrada. No próprio painel aprovado a mesma pessoa aparece em três
   pipelines, então nem lá o vínculo é 1:1 — dividir de verdade exige marcar a
   frente NA DEMANDA, e isso é a próxima volta, não esta.

   DUAS FONTES, NESTA ORDEM:
     1. `devs_perfil[nome].pipeline` — o cadastro, editável na tela de contas.
     2. A semente abaixo — o que foi conferido contra o painel aprovado.
   O cadastro VENCE sempre. A semente é ponto de partida para o primeiro deck
   não sair vazio, e não uma regra que sobrepõe o que uma pessoa marcou.
   ───────────────────────────────────────────────────────────────────────── */
(function (raiz) {
  'use strict';

  // As frentes QUE ENTRAM NO DECK, na ordem em que aparecem.
  //
  // As cores são as do painel aprovado: quem viu aquele quadro reconhece o
  // slide sem precisar reler a legenda.
  var PIPELINES = [
    { k: 'ia',     nome: 'IA & Vibe coding',    cor: 'F97316' },
    { k: 'dev',    nome: 'Desenvolvimento',     cor: '22D3EE' },
    /* `Dados & Inteligência` E `Power BI` VIRARAM UMA. Eram duas frentes com uma
       pessoa e duas pessoas; na prática o time trata as duas como o mesmo
       trabalho, e dois slides de um e de dois provocam no comitê a pergunta
       "por que isso está separado?" — que é justamente o que o deck não deve
       provocar (a mesma razão de `FORA_DO_DECK` existir logo abaixo).

       A COR É A DO POWER BI, e a escolha foi medida. Fundir libera uma das duas,
       e a que ficasse precisaria continuar distinguível das outras três. Em
       distância perceptual (CIE76) até a cor mais próxima que sobra:

         roxo de Dados   #A855F7   a 10 de `Automação & RPA` (#8B5CF6)
         azul de Power BI #3B82F6  a 36 de `Automação & RPA`

       Abaixo de ~25 duas cores se confundem num slide projetado. O roxo daria
       duas fatias que a plateia leria como a mesma. */
    { k: 'dados',  nome: 'Dados & Power BI',    cor: '3B82F6' },
    { k: 'rpa',    nome: 'Automação & RPA',     cor: '8B5CF6' },
  ];

  /* ── OS NOMES ANTIGOS CONTINUAM RESOLVENDO ────────────────────────────────
     `canonica` devolve '' para frente que não está na lista, e `doDev` trata ''
     como "não cadastrado" e cai na semente. Sem este mapa, toda pessoa MARCADA
     NA TELA como `Dados & Inteligência` ou `Power BI` perderia a marcação no
     instante da fusão — silenciosamente, porque o seletor voltaria a "— definir —"
     e ninguém saberia que alguém já tinha decidido aquilo.

     É o mesmo cuidado do mapa de `status` legado em `etapa-demanda.js`: o dado
     gravado ontem não muda de forma porque a lista de hoje mudou. Fica para
     sempre — um `devs_perfil` gravado em agosto continua válido em qualquer
     leitura futura, e remover isto reintroduz a perda. */
  var APELIDOS = {
    'dados & inteligencia': 'Dados & Power BI',
    'power bi': 'Dados & Power BI',
  };

  /* FORA DO DECK POR DECISÃO, e não por esquecimento.
     Ficam listadas para ninguém "corrigir" a ausência delas mais tarde: no mês
     que serviu de referência as três estavam zeradas (0 tasks, 0h), e pipeline
     vazia num slide executivo gera a pergunta "e por que isso é zero?" no meio
     da apresentação, que é justamente o que o deck não deve provocar. */
  // Com acento: o nome no painel de origem vem sem, mas aqui ele vai para um slide
  // de diretoria — "Analise" sem acento num slide é erro que a plateia lê antes do
  // número.
  var FORA_DO_DECK = ['Suporte', 'Bitrix 24', 'Análise de requisitos'];

  /* A SEMENTE: o nome como ele aparece nas demandas DESTA ferramenta.

     Os nomes daqui não são os mesmos do painel aprovado — lá a pessoa é
     "Guilherme Leite" e aqui as demandas dizem "Leite". O vínculo foi conferido
     cruzando os TEMAS de cada pessoa com os projetos que o painel mostra:
     "Jhonatan Soares" tem Jurídico e Databricks, exatamente os dois projetos que
     o painel lista em Dados & Inteligência para "Jhonatan Padua".

     Onde não deu para conferir, o nome NÃO entra aqui — fica em branco para ser
     marcado na tela. Chutar a frente de alguém é pior que deixar em branco: em
     branco aparece como "não classificado" e alguém corrige; chutado vira número
     errado num slide de diretoria e ninguém percebe.                            */
  var SEMENTE = {
    // Desenvolvimento — AXCred e os produtos internos
    'João Siqueira': 'Desenvolvimento',
    'João Vitor Batista de Siqueira': 'Desenvolvimento',
    'Emilly Souza': 'Desenvolvimento',
    'Gabriel Fernandes': 'Desenvolvimento',
    'Murillo Jesus': 'Desenvolvimento',
    'Maury Teixeira': 'Desenvolvimento',
    'Cairo': 'Desenvolvimento',
    'Lucas Santos': 'Desenvolvimento',
    // IA & Vibe coding
    'Crisley Almeida': 'IA & Vibe coding',
    'Eloi': 'IA & Vibe coding',
    'Flávio': 'IA & Vibe coding',
    /* 'João Carvalho': as duas demandas dele são AX Leader (compressor de áudio,
       editor de documento), e o AX Leader é frente de Vibe Code — decisão do
       Fernando. A conta vai ser desativada, mas as entregas ficam: "Não
       classificado" num slide de diretoria é pior que a frente certa, porque
       convida a pergunta "e o que é isso?" sem ter resposta. */
    'João Carvalho': 'IA & Vibe coding',
    /* Dados & Power BI — os quatro nomes conferidos com o Fernando.
       `Jhonantan` E NAO `Jhonatan Soares`: a chave da semente e o nome COMO ELE
       APARECE NAS DEMANDAS, e a entrada anterior nunca casou com ninguem. Ver a
       nota sobre as chaves orfas no fim deste bloco. */
    'Jhonantan': 'Dados & Power BI',
    'Dan Weine': 'Dados & Power BI',
    'Marina': 'Dados & Power BI',
    /* `Jose Amaro` NAO ESTAVA na lista de devs do arquivo de dados conferido.
       Entra porque foi pedido, e a semente so age quando o nome casa — se a
       grafia na base for outra (com acento, ou com sobrenome), esta linha fica
       inerte e a frente dele sai "— definir —" na tela, sem estragar nada. */
    'Jose Amaro': 'Dados & Power BI',
    // Automação & RPA
    'Leite': 'Automação & RPA',
    // Sem frente de propósito:
    //   'Josias' — a única demanda dele é Bitrix, que fica fora do deck.
  };

  // Acento e caixa não podem separar a mesma pessoa: as demandas trazem
  // "Flávio" e a conta pode ter sido cadastrada como "Flavio".
  function norm(s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .trim().toLowerCase();
  }

  /* ── MEDIDO: 10 DAS 16 CHAVES DESTA SEMENTE NUNCA CASAM COM NINGUÉM ───────
     A semente é indexada pelo nome COMO ELE APARECE NAS DEMANDAS — é o que o
     comentário acima promete, e é o que faz ela funcionar. Cruzando as chaves
     com os nomes reais (cadastro de devs + campo `dev` de todas as demandas),
     dez delas não encontram ninguém:

       João Siqueira · João Vitor Batista de Siqueira · Emilly Souza ·
       Gabriel Fernandes · Murillo Jesus · Maury Teixeira · Lucas Santos ·
       Crisley Almeida · João Carvalho · Jhonatan Soares

     São nomes COMPLETOS, e as demandas usam o curto: "Crisley Almeida" aqui
     contra "Crisley" lá, "Jhonatan Soares" contra "Jhonantan". O próprio
     comentário acima já avisava desse risco ("lá a pessoa é 'Guilherme Leite' e
     aqui as demandas dizem 'Leite'") — e ainda assim dez entraram no formato
     errado. Elas são INERTES: não quebram nada, e não classificam ninguém.

     Não as corrigi em lote nesta fatia. Casar "Emilly Souza" com "Emilly Viana"
     é um palpite sobre quem é quem, e o próprio arquivo já diz que chutar a
     frente de alguém é pior que deixar em branco. Fica medido e escrito para
     quem for arrumar com a lista de gente na mão. */
  var PORNOME = {};
  Object.keys(SEMENTE).forEach(function (n) { PORNOME[norm(n)] = SEMENTE[n]; });

  var VALIDOS = {};
  PIPELINES.forEach(function (p) { VALIDOS[norm(p.nome)] = p.nome; });

  /** O nome canônico de uma frente, ou '' se ela não entra no deck.
   *  Devolver '' para "Suporte" é o que impede uma frente descontinuada de
   *  voltar ao slide só porque alguém a digitou no cadastro. */
  function canonica(nome) {
    var n = norm(nome);
    // A LISTA ATUAL PRIMEIRO, o apelido como reserva. A ordem só importa no dia
    // em que uma frente nova reusar um nome antigo: ali o nome vivo tem de
    // vencer o apelido, e não o contrário.
    return VALIDOS[n] || APELIDOS[n] || '';
  }

  /** A frente de uma pessoa. `perfis` é o `devs_perfil` do arquivo de dados.
   *
   *  Cadastro primeiro, semente depois — e nunca o contrário: marcar alguém na
   *  tela e ver a marcação ignorada pelo deck é o mesmo defeito que fez as
   *  marcações de DEV-AXCred "sumirem", só que silencioso. */
  function doDev(nome, perfis) {
    var p = (perfis || {})[nome];
    var doCadastro = p && typeof p === 'object' ? canonica(p.pipeline) : '';
    if (doCadastro) return doCadastro;
    return PORNOME[norm(nome)] || '';
  }

  /** Os nomes que a demanda carrega. O campo aceita "Fulano / Beltrano" desde
   *  sempre, e as duas pessoas contam. */
  function devsDaDemanda(m) {
    return String((m || {}).dev || '').split('/')
      .map(function (x) { return x.trim(); })
      .filter(Boolean);
  }

  raiz.PIPELINES = {
    lista: PIPELINES,
    foraDoDeck: FORA_DO_DECK,
    nomes: PIPELINES.map(function (p) { return p.nome; }),
    canonica: canonica,
    doDev: doDev,
    devsDaDemanda: devsDaDemanda,
    cor: function (nome) {
      var achou = PIPELINES.filter(function (p) { return p.nome === canonica(nome); })[0];
      return achou ? achou.cor : '9A968C';
    },
    NAO_CLASSIFICADO: 'Não classificado',
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.PIPELINES;
})(typeof globalThis !== 'undefined' ? globalThis : this);
