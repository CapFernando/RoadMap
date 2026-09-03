/* ─────────────────────────────────────────────────────────────────────────────
   O SELO DE VALIDAÇÃO — "esta demanda passou pela planning, e quem fechou foi X"

   ───────────────────────────────────────────────────────────────────────────
   POR QUE `poker_pontos` NÃO SERVE PARA DECIDIR ISSO.

   Medido na base: 158 demandas têm pontos, e 130 delas NÃO têm nenhum sinal de
   reunião. Pontuação é gravada por duas portas — a planning e o formulário do
   card —, e as duas escrevem no mesmo campo. Usar `poker_pontos` daria selo a
   130 demandas que ninguém votou.

   É a mesma distinção que o card já fazia pelo avesso, no aviso "sem pontos do
   Planning Poker". O selo é a outra ponta dela.

   ───────────────────────────────────────────────────────────────────────────
   O SELO É DE ALGUÉM, e não de qualquer um que pontue.

   Ele diz "validado por fulano" — é uma assinatura. Quem pode assiná-lo está em
   `LOGINS` e `NOMES`, logo abaixo, e é o único lugar a editar quando outra
   pessoa passar a conduzir a planning.

   AS DUAS FONTES:

   1. `poker_validado_por` + `poker_validado_login` — gravado pelo Worker no
      `poker-gravar`, daqui para a frente.

   2. O HISTÓRICO com origem 'planning poker'. É o que dá o selo RETROATIVO: o
      `registraHistorico` marca a origem desde sempre, então as reuniões antigas
      já estão registradas com quem gravou e quando. São 26 na base, todas de
      Fernando Nascimento — e são elas que aparecem seladas hoje.

   O QUE NÃO GERA SELO, e vale dizer: votação sem autor registrado. Há três
   demandas assim na base — têm votos e média, e nenhum registro de quem
   conduziu. Uma versão anterior deste arquivo lhes dava selo sem nome; isso
   deixou de valer quando o selo virou assinatura. Um carimbo que não pode dizer
   por quem foi validado é justamente o que um selo não pode ser.

   ───────────────────────────────────────────────────────────────────────────
   POR QUE ISTO É UM ARQUIVO, e não uma função em cada tela.

   O selo aparece no Kanban do Admin, no Kanban do Dev e no Gantt. Três cópias da
   regra "passou pela planning?" divergem na primeira mexida, e o sintoma seria a
   mesma demanda selada numa tela e não na outra — que é exatamente o que
   aconteceu com a regra do atraso, e a razão de `prazo.js` existir.
   ───────────────────────────────────────────────────────────────────────────*/
(function (raiz) {
  'use strict';

  /* ───────────────────────────────────────────────────────────────────────────
     QUEM PODE SELAR — e este é o único lugar a editar.

     O selo é NOMINAL: ele diz "validado por fulano", e por isso não é qualquer
     pessoa que o gera. Hoje é só o Fernando; o dia em que outra pessoa passar a
     conduzir a planning, o nome dela entra aqui e nada mais muda.

     SÃO DUAS LISTAS PORQUE AS DUAS FONTES GUARDAM COISAS DIFERENTES:

       `LOGINS` — o registro novo (`poker_validado_login`), gravado pelo Worker.
                  É o que sobrevive a alguém trocar o nome de exibição.
       `NOMES`  — o histórico antigo, que guarda só `quem` em texto. É por ele
                  que as 26 reuniões já registradas ganham selo retroativo.

     COMPARADO SEM ACENTO E SEM CAIXA. "Fernando Nascimento" e "fernando
     nascimento" são a mesma pessoa, e o nome de exibição já apareceu das duas
     formas na base. Exigir a grafia exata faria o selo sumir por causa de um
     acento digitado diferente — e sumir em silêncio, que é o pior jeito. */
  var LOGINS = ['fernando'];
  var NOMES = ['fernando nascimento', 'fernando morais'];

  function texto(v) {
    return String(v == null ? '' : v).trim();
  }

  /** Minúsculo e sem acento, para comparar nome de gente. */
  function chave(v) {
    return texto(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  /** ESTA PESSOA PODE SELAR?
   *
   *  `login` tem prioridade porque é identidade; o nome é o que resta quando o
   *  registro é antigo. Vazio nos dois é NÃO — uma reunião sem autor registrado
   *  não pode virar selo de alguém. */
  function podeSelar(login, nome) {
    var l = chave(login);
    if (l) return LOGINS.indexOf(l) >= 0;
    var n = chave(nome);
    return !!n && NOMES.indexOf(n) >= 0;
  }

  /** A última passagem pela planning registrada no histórico da demanda.
   *
   *  A ÚLTIMA, e não a primeira: uma demanda repontuada numa segunda reunião foi
   *  validada de novo, e o selo deve dizer a data mais recente. */
  function daPlanning(m) {
    var h = (m && m.historico) || [];
    for (var i = h.length - 1; i >= 0; i--) {
      var o = texto(h[i] && h[i].origem).toLowerCase();
      if (o.indexOf('poker') >= 0 || o.indexOf('planning') >= 0) return h[i];
    }
    return null;
  }

  /** O SELO DESTA DEMANDA, ou `null` quando ela não passou pela planning.
   *
   *  Devolve `{ quem, em }` — `quem` pode ser vazio, e a tela trata isso. */
  function de(m) {
    if (!m) return null;
    /* MESCLADA E OCULTA NÃO TÊM SELO. Elas saíram do quadro; um selo sobre algo
       que não se enxerga é enfeite, e sobre uma mesclada seria pior — o mérito é
       da demanda que a absorveu. */
    if (m.mesclado_em || m.oculto) return null;

    var quem = texto(m.poker_validado_por);
    if (quem) {
      return podeSelar(m.poker_validado_login, quem)
        ? { quem: quem, em: texto(m.poker_validado_em) }
        : null;
    }

    var h = daPlanning(m);
    if (h && podeSelar('', h.quem)) return { quem: texto(h.quem), em: texto(h.em) };

    /* ─────────────────────────────────────────────────────────────────────
       VOTAÇÃO SEM AUTOR REGISTRADO NÃO GERA SELO.

       Há demandas com votos e média mas sem nenhum registro de quem conduziu —
       três na base. A versão anterior deste arquivo dava selo a elas, sem nome.

       Isso deixou de valer quando o selo passou a ser DE ALGUÉM: um carimbo que
       diz "validado" sem poder dizer por quem é justamente o que um selo não
       pode ser. Elas continuam com os pontos e com a média; o que não têm é a
       assinatura. */
    return null;
  }

  /** `2026-08-13T14:22:00Z` → `13/08/2026`. Vazio quando não há data. */
  function dia(iso) {
    var d = texto(iso).slice(0, 10);
    return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d) ? d.split('-').reverse().join('/') : '';
  }

  /** O que o selo diz quando o mouse para em cima dele.
   *
   *  SEMPRE TEM NOME. Havia aqui um ramo para selo sem autor, e ele deixou de
   *  ter caminho quando o selo passou a exigir uma pessoa autorizada: sem nome
   *  não há selo. Manter o ramo seria carregar código que nenhum teste alcança. */
  function titulo(selo) {
    if (!selo) return '';
    var d = dia(selo.em);
    return 'Validado por ' + selo.quem + ' no Planning Poker' + (d ? ' em ' + d : '') + '.';
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /** A MARCA PEQUENA — a que cabe num card de Kanban e numa barra de Gantt.
   *
   *  ───────────────────────────────────────────────────────────────────────
   *  O SELO INTEIRO NÃO CABE AQUI, e insistir nele seria pior que não tê-lo.
   *
   *  O card do Kanban tem ~230px de largura e a barra do Gantt tem 30px de
   *  altura. Um selo circular com rosto, texto curvo e a palavra APROVADO fica
   *  ilegível em 20px — vira uma bolha azul, e uma bolha que ninguém entende não
   *  informa nada. O selo grande existe, e mora no lugar onde há espaço: o painel
   *  de detalhe da demanda (`grande`, abaixo).
   *
   *  Aqui vai o essencial: o carimbo, e o nome de quem validou no `title`. */
  function badge(m, classe) {
    var selo = de(m);
    if (!selo) return '';
    return '<span class="' + (classe || 'selo-validado') + '" title="' + esc(titulo(selo)) + '">' +
           '<span aria-hidden="true">✔</span> Validado</span>';
  }

  /** O SELO INTEIRO, para onde há espaço — o painel de detalhe da demanda.
   *
   *  ───────────────────────────────────────────────────────────────────────
   *  SVG, E NÃO IMAGEM. Três razões, e a terceira é a que decide:
   *
   *  1. Escala sem borrar, de 64px a 240px.
   *  2. Não é uma requisição a mais em cada card.
   *  3. O NOME É DINÂMICO. O selo diz quem validou, e quem valida pode ser outra
   *     pessoa — uma imagem com o nome pintado obrigaria um arquivo por pessoa, e
   *     o dia em que alguém mais conduzir a planning o selo mentiria.
   *
   *  O texto curvo é `textPath` sobre um arco, que é o recurso do SVG para
   *  exatamente isso. */
  function grande(m, tamanho) {
    var selo = de(m);
    if (!selo) return '';
    var px = tamanho || 150;
    var curva = 'VALIDADO POR ' + selo.quem.toUpperCase();
    var d = dia(selo.em);
    /* O `id` DO ARCO É ÚNICO POR CHAMADA. Dois selos na mesma página com o mesmo
       id fariam o segundo `textPath` apontar para o arco do primeiro — e no
       Firefox o texto some. */
    var id = 'selo-arco-' + Math.random().toString(36).slice(2, 9);
    return [
      '<svg class="selo-grande" viewBox="0 0 200 200" width="' + px + '" height="' + px + '"',
      '     role="img" aria-label="' + esc(titulo(selo)) + '">',
      '  <title>' + esc(titulo(selo)) + '</title>',
      /* O ESTILO VIAJA DENTRO DO SVG, e nao num arquivo .css ao lado.
         Sao quatro telas usando este selo; um .css separado seria mais um
         `<link>` para cada uma lembrar de incluir — e a que esquecesse mostraria
         dois circulos pretos sem texto, sem erro nenhum no console.

         A COR E FIXA, e nao um token de tema. Carimbo tem cor propria: o azul e
         o mesmo em papel branco e em papel escuro, e e assim que um carimbo e
         reconhecido. O anel branco em volta (`paint-order`) garante o contraste
         contra o fundo escuro sem mudar a cor da tinta. */
      '  <style>',
      '    .selo-borda-fora, .selo-borda-dentro { fill: none; stroke: #2B5797; }',
      '    .selo-borda-fora { stroke-width: 5; }',
      '    .selo-borda-dentro { stroke-width: 2; }',
      '    .selo-curva { fill: #2B5797; font: 700 15px system-ui, sans-serif; letter-spacing: 1.2px; }',
      '    .selo-check { stroke: #2B5797; stroke-width: 11; stroke-linecap: round; stroke-linejoin: round; }',
      '    .selo-aprovado { fill: #2B5797; font: 700 26px system-ui, sans-serif; letter-spacing: 1px; }',
      '    .selo-data { fill: #2B5797; font: 600 13px system-ui, sans-serif; }',
      '    .selo-grande { background: #FFFFFF; border-radius: 50%; }',
      '  </style>',
      '  <defs><path id="' + id + '" d="M 100,100 m -78,0 a 78,78 0 1,1 156,0" fill="none"/></defs>',
      '  <circle cx="100" cy="100" r="94" class="selo-borda-fora"/>',
      '  <circle cx="100" cy="100" r="86" class="selo-borda-dentro"/>',
      /* `textLength` COMPRIME O TEXTO PARA CABER NO ARCO.
         Sem ele o nome transborda: o arco tem ~245px de comprimento, e
         "VALIDADO POR FERNANDO NASCIMENTO" pede ~300px na fonte de 15px — as
         duas pontas saem do circulo e as primeiras letras somem atras da borda.
         Foi o que aconteceu na primeira versao, e o selo dizia "ADO POR
         FERNANDO NASCIM".

         `spacingAndGlyphs` aperta o espacamento E as letras, em vez de so o
         espacamento: com nome longo, apertar apenas os vaos gruda as palavras
         umas nas outras e o texto vira uma linha continua. */
      '  <text class="selo-curva">',
      '    <textPath href="#' + id + '" startOffset="50%" text-anchor="middle"',
      '              textLength="228" lengthAdjust="spacingAndGlyphs">' + esc(curva) + '</textPath>',
      '  </text>',
      /* O CHECK E A PALAVRA no miolo, que é o que se lê de longe. */
      '  <path class="selo-check" d="M 62,104 L 80,122 L 122,74" fill="none"/>',
      '  <text class="selo-aprovado" x="100" y="150" text-anchor="middle">APROVADO</text>',
      d ? '  <text class="selo-data" x="100" y="168" text-anchor="middle">' + esc(d) + '</text>' : '',
      '</svg>',
    ].filter(Boolean).join('\n');
  }

  raiz.SELO = { de: de, titulo: titulo, badge: badge, grande: grande, dia: dia };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.SELO;
})(typeof globalThis !== 'undefined' ? globalThis : this);
