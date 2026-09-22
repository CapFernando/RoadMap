/* ═══ A NARRATIVA DO DECK ═══════════════════════════════════════════════════
 *
 * "Volto a dizer que necessito que a apresentação traga um storytelling."
 *
 * O deck JÁ TINHA a história — em comentário. `apresentacao.js` divide a
 * montagem em "ATO 1 · ONDE ESTAMOS", "ATO 2 · ONDE A CAPACIDADE FOI", "ATO 3 ·
 * CUMPRIMOS O COMBINADO", e a ordem dos slides obedece a isso desde sempre. Só
 * que nada disso chegava à sala: quem assiste vê dezoito slides de mesmo peso,
 * um atrás do outro, e não tem como saber que os dois primeiros respondem a uma
 * pergunta e os quatro seguintes a outra.
 *
 * História que o autor conhece e a plateia não é sequência, não é narrativa.
 * Este arquivo tira a estrutura do comentário e põe no slide:
 *
 *   O TRILHO      uma barra de capítulos no alto de TODO slide. Diz onde a
 *                 conversa está e quanto falta — o "progress indicator" que o
 *                 padrão de narrativa pede, e a coisa mais barata que existe
 *                 para a sala não se perder.
 *   O DIVISOR     um slide de abertura por ato, com a PERGUNTA que aquele
 *                 bloco responde. É o que transforma "mais um gráfico" em
 *                 "agora vamos falar de prazo".
 *   O RODAPÉ      o nome do ato, sempre visível. Print solto de um slide leva
 *                 junto a parte da conversa de onde saiu.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUE O CROMO É MONOCROMÁTICO.
 *
 * A tentação era dar uma cor a cada ato — é o que o padrão de narrativa sugere
 * ("cada capítulo com sua cor"). Aqui isso seria um erro caro: este deck já tem
 * cinco cores com SIGNIFICADO fixo (verde = deu certo, vermelho = ruim, âmbar =
 * atenção, azul = neutro, branco = leitura), e a lição de pintar um âmbar que
 * não quer dizer atenção já foi paga — "o amarelo me leva a entender que está
 * no prazo, porém lá no gráfico mostra ainda em aberto".
 *
 * Então a navegação inteira é branco, cinza e a borda. O ato corrente é o
 * segmento BRANCO do trilho; nenhuma cor de dado aparece na moldura. O verde da
 * marca (o mesmo da capa) só entra nos DIVISORES, que não têm dado nenhum — e
 * amarra o miolo do deck à capa, que é de onde ele vem.
 *
 * Moderno aqui é isto: moldura contida, dado com voz alta. O contrário — a
 * moldura chamativa competindo com o número — é o que faz um deck parecer
 * apresentação de agência em vez de reunião de resultado.
 * ═══════════════════════════════════════════════════════════════════════════ */
(function (raiz) {
  'use strict';

  /* O VERDE DA CAPA. Vem de `capa-tecnologia.js` e é a única cor de marca do
     arquivo; repeti-lo aqui é o preço de o divisor não depender da capa ter
     carregado. Há invariante cobrando que os dois sejam o mesmo valor. */
  var MARCA = '00FD54';

  /* O TOM DO TRECHO JÁ PERCORRIDO. Mora aqui, e não na paleta do deck, porque é
     cor de MOLDURA: acrescentá-la ao `C` seria pô-la ao alcance de quem desenha
     dado, e a regra desta base é que toda cor de dado significa alguma coisa.

     O VALOR SAIU DE MEDIÇÃO, e não de gosto. Os três estados do trilho precisam
     ser distinguíveis sobre o fundo 070B16, e a primeira tentativa usava a
     superfície inativa (141C36) para o que ainda vem: 1,16:1 — o mesmo contraste
     das curvas do fundo, ou seja, invisível. O trilho virava uma barra branca
     sozinha, que diz onde a sala está e cala sobre quanto falta. Hoje são
     1,51:1 (o que vem), 2,31:1 (o que passou) e 19,7:1 (aqui). */
  var PERCORRIDO = '3A4B7A';

  /* ─── OS ATOS ─────────────────────────────────────────────────────────────
   *
   * A pergunta é o que importa em cada um, e não o título. Um divisor que diz
   * só "CAPACIDADE" avisa que mudou de assunto; um que diz "em que a capacidade
   * do time foi gasta?" já deixa a sala com a pergunta na cabeça quando o
   * gráfico aparece — e aí o gráfico responde alguém, em vez de se explicar
   * sozinho.
   *
   * A ORDEM É A DA MONTAGEM, e não uma nova. Ela já foi discutida slide a slide
   * no `montaDeck` ("o cruzamento vem antes da distribuição", "o projeto subiu
   * para junto das frentes") e não é este arquivo que a revisa: aqui ela só
   * ganha nome e cara. */
  var ATOS = [
    { chave: 'situacao', n: 1,
      titulo: 'O MÊS',
      pergunta: 'Foi um mês típico, ou fora da curva?',
      promessa: 'O panorama do período e o mesmo período dentro da série. ' +
                'Número sozinho não diz se é bom.' },
    { chave: 'capacidade', n: 2,
      titulo: 'PARA ONDE FOI',
      pergunta: 'Em que a capacidade do time foi gasta?',
      promessa: 'Frente, projeto e peso: em que trabalhamos, para quê, e com ' +
                'quanto esforço.' },
    { chave: 'combinado', n: 3,
      titulo: 'O COMBINADO',
      pergunta: 'O que foi prometido saiu no prazo?',
      promessa: 'O cruzamento entre o que estava combinado e o que aconteceu — ' +
                'inclusive onde escapou.' },
    { chave: 'esforco', n: 4,
      titulo: 'QUEM PEDIU, QUEM FEZ',
      pergunta: 'De onde veio a demanda, e quem a atendeu?',
      promessa: 'A mesma capacidade vista por área cliente, por solicitante e ' +
                'por pessoa do time.' },
    { chave: 'rumo', n: 5,
      titulo: 'O QUE VEM',
      pergunta: 'O que depende de decisão, e o que entra no próximo mês?',
      promessa: 'A única parte do deck que pede ação de quem está na sala.' },
  ];

  function ato(chave) {
    for (var i = 0; i < ATOS.length; i++) if (ATOS[i].chave === chave) return ATOS[i];
    return null;
  }

  /* ─── O PLANO ─────────────────────────────────────────────────────────────
   *
   * Recebe o roteiro (a lista de cenas que o deck vai desenhar, cada uma com o
   * ato a que pertence) e devolve só os atos que TÊM cena, na ordem canônica,
   * já com o número de páginas de cada um.
   *
   * ATO VAZIO NÃO EXISTE, e isso não é detalhe: o deck é configurável seção a
   * seção, e o padrão do fechamento liga quatro seções de dezoito. Um trilho de
   * cinco capítulos com três apagados mentiria sobre o tamanho da conversa, e um
   * divisor anunciando um ato sem slide nenhum seria pior — a sala espera o
   * assunto e vem o próximo capítulo.
   *
   * A CONTA DE PÁGINAS INCLUI O DIVISOR quando ele vai existir: o trilho mostra
   * peso, e um ato de uma cena ocupa duas páginas de verdade. */
  function plano(roteiro, comDivisor) {
    var conta = {};
    (roteiro || []).forEach(function (c) {
      conta[c.ato] = (conta[c.ato] || 0) + 1;
    });
    var vivos = ATOS.filter(function (a) { return conta[a.chave] > 0; });
    /* UM ATO SÓ NÃO É HISTÓRIA. Dividir em capítulos um deck que tem um assunto
       só é cerimônia sem conteúdo: o divisor anunciaria o deck inteiro, e o
       trilho teria um segmento. Nesse caso a moldura narrativa some e o deck
       sai como sempre foi — que é o certo, porque não há o que navegar. */
    var divide = !!comDivisor && vivos.length > 1;
    return {
      atos: vivos,
      divide: divide,
      paginas: vivos.map(function (a) { return conta[a.chave] + (divide ? 1 : 0); }),
      total: vivos.reduce(function (t, a) { return t + conta[a.chave]; }, 0) +
             (divide ? vivos.length : 0),
    };
  }

  /* ─── O TRILHO ────────────────────────────────────────────────────────────
   *
   * Uma faixa de 0,055" colada no topo, dividida em um segmento por ato, cada
   * um com a largura proporcional ao número de páginas daquele ato.
   *
   * PROPORCIONAL, E NÃO IGUAL: o trilho responde "quanto falta", e segmentos
   * iguais responderiam errado num deck onde um ato tem oito páginas e outro
   * tem uma. Com a largura proporcional, o olho mede a conversa.
   *
   * COLADO NA BORDA porque ali ele não disputa espaço com nada: o cabeçalho
   * começa em 0,28" e o trilho acaba em 0,055". Foi a alternativa a pôr o ato no
   * cabeçalho, que empurraria título, subtítulo e régua para baixo em TODOS os
   * slides — e há conta de caber texto dependendo de cada um desses valores. */
  function trilho(s, pptx, cfg) {
    var atos = (cfg && cfg.atos) || [];
    if (atos.length < 2) return;
    var cores = (cfg && cfg.cores) || {};
    var pesos = (cfg && cfg.paginas) || atos.map(function () { return 1; });
    var soma = pesos.reduce(function (t, v) { return t + (v || 1); }, 0) || 1;

    var VAO = 0.05, ALT = 0.055, LARG = 10 - VAO * (atos.length - 1);
    var x = 0;
    for (var i = 0; i < atos.length; i++) {
      var w = LARG * ((pesos[i] || 1) / soma);
      /* TRÊS ESTADOS, e o passado é diferente do futuro. Dois estados só — aceso
         e apagado — deixariam a sala sem saber se o vazio à direita já passou ou
         ainda vem, que é metade do que um indicador de progresso serve para
         dizer. Os três contrastes estão medidos na nota do `PERCORRIDO`. */
      var cor = i === cfg.indice ? (cores.texto || 'FFFFFF')
              : (i < cfg.indice ? PERCORRIDO : (cores.borda || '223052'));
      s.addShape(pptx.ShapeType.rect, {
        x: x, y: 0, w: w, h: ALT, fill: { color: cor }, line: { type: 'none' } });
      x += w + VAO;
    }
  }

  /* ─── O RÓTULO DO ATO, para o rodapé ─────────────────────────────────────
     Devolve as duas partes separadas porque elas têm pesos diferentes na linha:
     o número em branco e forte, o nome em cinza. Uma string só obrigaria o
     rodapé a recortá-la de novo. */
  function rotulo(a) {
    if (!a) return null;
    return { n: 'ATO ' + (a.n < 10 ? '0' : '') + a.n, titulo: a.titulo };
  }

  /* QUANTOS CARACTERES CABEM — a mesma conta do `apresentacao.js` (0,52 em por
     caractere, medido no deck renderizado). Repetida aqui, e não importada,
     porque este módulo desenha sozinho e não conhece o outro; são cinco linhas
     e há invariante comparando as duas contas no mesmo caso. */
  function cabem(polegadas, corpo) {
    return Math.max(8, Math.floor(polegadas / (corpo * 0.52 / 72)));
  }

  /* ─── O DIVISOR ───────────────────────────────────────────────────────────
   *
   * O slide que abre o ato. Um número gigante em tom de fundo, o título, a
   * PERGUNTA em verde e a promessa do que vem — e nada mais. Não há dado aqui
   * de propósito: o divisor existe para a sala tirar os olhos do número por três
   * segundos e ouvir qual é a próxima pergunta.
   *
   * O NÚMERO GIGANTE É FANTASMA (cor de superfície, não de texto). Ele dá escala
   * e ritmo à página sem disputar leitura com o título — é a peça que faz o
   * slide parecer desenhado em vez de composto. Em tom de texto ele seria a
   * primeira coisa lida, e "02" não é o que a sala precisa levar.
   *
   * O TAMANHO DO TÍTULO É CALCULADO, como na capa e no cabeçalho: por esta
   * caixa passam nomes de ato que eu escrevo aqui, mas a conta fica porque o dia
   * em que alguém acrescentar um ato de nome longo, ele encolhe em vez de
   * quebrar por cima da pergunta. */
  function divisor(s, pptx, cfg) {
    var a = cfg.ato, C = cfg.cores || {};
    var num = (a.n < 10 ? '0' : '') + a.n;

    s.addText(num, {
      x: 5.7, y: 0.75, w: 3.9, h: 3.4, fontSize: 200, bold: true,
      color: C.fundo2 || '0E1428', align: 'right', valign: 'middle',
      margin: 0, wrap: false });

    s.addText('ATO ' + num, {
      x: 0.7, y: 1.50, w: 5.2, h: 0.26, fontSize: 11, bold: true,
      color: MARCA, charSpacing: 2.2 });

    var L_TIT = 6.0, corpo = 40;
    while (corpo > 22 && a.titulo.length > cabem(L_TIT, corpo)) corpo -= 2;
    s.addText(a.titulo, {
      x: 0.7, y: 1.84, w: L_TIT, h: 0.80, fontSize: corpo, bold: true,
      color: C.texto || 'FFFFFF', valign: 'middle' });

    // A régua curta sob o título: a mesma ideia da régua do cabeçalho, no
    // comprimento de um traço — aqui ela separa o nome da pergunta.
    s.addShape(pptx.ShapeType.rect, {
      x: 0.7, y: 2.78, w: 1.1, h: 0.03, fill: { color: MARCA }, line: { type: 'none' } });

    s.addText(a.pergunta, {
      x: 0.7, y: 3.00, w: 5.6, h: 0.60, fontSize: 17, color: C.texto || 'FFFFFF',
      lineSpacingMultiple: 1.25 });

    if (a.promessa) {
      s.addText(a.promessa, {
        x: 0.7, y: 3.70, w: 5.4, h: 0.70, fontSize: 11, color: C.fraco || '8792AD',
        lineSpacingMultiple: 1.3 });
    }

    /* QUANTAS PÁGINAS TEM ESTE ATO. É a informação que quem assiste calcula
       sozinho e errado ("isso vai durar quanto?"). Dita, ela custa uma linha de
       9pt e devolve a atenção da sala. */
    if (cfg.paginas) {
      s.addText(cfg.paginas + (cfg.paginas === 1 ? ' página' : ' páginas'), {
        x: 5.9, y: 4.36, w: 3.6, h: 0.24, fontSize: 9, color: C.fraco || '8792AD',
        align: 'right', charSpacing: 0.8 });
    }
    return s;
  }

  var api = {
    MARCA: MARCA,
    atos: ATOS,
    ato: ato,
    plano: plano,
    trilho: trilho,
    rotulo: rotulo,
    divisor: divisor,
    cabem: cabem,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.DECKNARR = api;
}(typeof window !== 'undefined' ? window : this));
