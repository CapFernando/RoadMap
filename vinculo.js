/* ─────────────────────────────────────────────────────────────────────────
   VÍNCULO — a tarefa principal e o que pendura nela.

   ═════════════════════════════════════════════════════════════════════════
   POR QUE ESTE ARQUIVO EXISTE.

   O relato foi: "a API não está atendendo a criação de issues como
   dependências de outras". Medido, e é literal:

     `parent_id` e `is_dependency` estão em `HIST_CAMPOS` do Worker — ou seja,
     o histórico sabe registrar a mudança do vínculo —, mas NENHUMA rota de
     escrita aceita os dois campos. `demanda-nova` monta o objeto novo campo a
     campo e não copia `parent_id`; `demanda-atualizar` tem lista fechada e ele
     não está nela.

   Então o vínculo só nascia por uma tela (`dev.html`, botão de dependência).
   Quem automatiza abre a principal pela API, abre as ligadas pela API, e as
   duas chegam soltas — sem nada dizendo que erraram.

   ═════════════════════════════════════════════════════════════════════════
   A SOMA DE PONTOS É DERIVADA, E NÃO GRAVADA. Esta é a decisão que muda o
   resto, e ela é DIFERENTE da soma de horas por subtarefa, embora o pedido
   tenha sido "semelhante ao que criamos com horas lançadas".

   O que é igual: o total sai de uma função só, e vale `null` enquanto ninguém
   pontuou — a mesma distinção entre "não estimei" e "estimei zero" que o
   `msSubHorasTotal` guarda e que o `semPontuacao` cobra.

   O que é DIFERENTE, e por quê: subtarefa não é demanda. As horas de um passo
   não aparecem em relatório nenhum por conta própria, então derivar o campo
   `horas_realizadas` do pai não duplica nada. Aqui, cada vínculo É UMA DEMANDA
   INTEIRA, e `poker_pontos` é somado demanda a demanda em três lugares que eu
   medi — o ranking por dev do Worker (`devVisao`), a `capacidade.js` e o deck.
   Gravar a soma no pai faria os pontos dos filhos contarem DUAS vezes em todos
   eles: uma no filho, outra dentro do pai. Uma tarefa principal com quatro
   vínculos de 8 pontos viraria 64 pontos no mês em vez de 32.

   Então `poker_pontos` continua sendo o tamanho DAQUELA demanda, e o total da
   árvore é uma LEITURA — calculada na hora, mostrada onde ajuda a decidir, e
   nunca escrita na base. Quem quiser o número soma pela mesma função, e não
   por uma segunda conta escrita na tela.

   ═════════════════════════════════════════════════════════════════════════
   O QUE ESTE ARQUIVO NÃO FAZ.

   NÃO decide etapa (`etapa-demanda.js`), NÃO decide de quem é a demanda
   (`dev-nome.js`), NÃO lê dados e NÃO desenha nada.
   ───────────────────────────────────────────────────────────────────────── */
(function (raiz) {
  'use strict';

  /* TETO DE PROFUNDIDADE. A árvore real tem um nível — a tela só cria filho de
     card —, mas a API passa a aceitar `parent_id` livre, e um encadeamento de
     mil demandas travaria a página que chamou. 24 é fundo de poço, não regra
     de negócio: nenhuma árvore honesta chega perto. */
  var MAX_NIVEIS = 24;

  /* ═══ DOIS ELOS DIFERENTES, E ESSA É A DISTINÇÃO QUE FALTAVA ═════════════
   *
   * O pedido foi: "quero poder usar uma issue como base para incluir outras
   * vinculadas SEM ter dependências delas".
   *
   * Até aqui só existia um elo, e ele BLOQUEIA: `parent_id` + `is_dependency`
   * fazem o `dev.html` recusar o avanço do card principal enquanto houver filho
   * aberto ("🔒 Avanço bloqueado"). Isso está certo para "não posso subir o
   * módulo antes da migração" e está errado para "esta é a tarefa guarda-chuva
   * do projeto X" — e era esse segundo uso que não tinha como ser dito.
   *
   *   DEPENDENCIA   trava a principal enquanto estiver aberta. É o elo antigo.
   *   PARTE         só pertence: soma ponto, aparece na árvore, e NÃO trava
   *                 nada. É a "issue base" com outras penduradas nela.
   *
   * O CAMPO CONTINUA SENDO `is_dependency`, e não um terceiro campo. Ele já
   * existe, já está no histórico, e as demandas que estão na base hoje têm
   * `true` — ou seja, elas são dependências de verdade e continuam travando.
   * Um campo novo deixaria as antigas sem tipo e obrigaria a adivinhar qual
   * delas trava, que é exatamente a pergunta que não pode ficar em aberto.
   *
   * A SOMA DE PONTOS NÃO DISTINGUE OS DOIS. "Quanto custa tudo isto" é a mesma
   * pergunta com elo travando ou não — e separar as duas somas faria a tarefa
   * base mostrar um total que não é o total. */
  var DEPENDENCIA = 'dependencia';
  var PARTE = 'parte';

  /** Que tipo de elo é este filho? Só faz sentido em quem tem `parent_id`. */
  function tipoDe(m) {
    if (!m || !String(m.parent_id || '')) return '';
    return m.is_dependency ? DEPENDENCIA : PARTE;
  }

  function bloqueia(m) { return tipoDe(m) === DEPENDENCIA; }

  function viva(m) {
    return !!m && !m.oculto && !m.mesclado_em;
  }

  /** O ponto de uma demanda, ou `null` quando ela não foi pontuada.
   *
   *  `null` E NÃO `0`, pelo mesmo motivo do `msSubHorasTotal`: `Number('')` é
   *  zero, e zero em silêncio faria uma tarefa principal sem estimativa nenhuma
   *  aparecer como "0 pontos no total" — que se lê como "não custa nada", e não
   *  como "ninguém estimou". */
  function pontoDe(m) {
    if (!viva(m)) return null;
    var v = (m || {}).poker_pontos;
    if (v === null || v === undefined || String(v).trim() === '') return null;
    var n = Number(v);
    return (Number.isFinite(n) && n >= 0) ? n : null;
  }

  function idDe(m) { return String((m || {}).id || ''); }

  /** Os vínculos diretos de uma demanda. */
  function filhosDe(lista, id) {
    var alvo = String(id || '');
    if (!alvo) return [];
    return (lista || []).filter(function (m) {
      return viva(m) && String((m || {}).parent_id || '') === alvo;
    });
  }

  /** ESTA DEMANDA É UM AGRUPADOR? — a "D0" do pedido do Fernando.
   *
   *  "Quero ter a D0 que consumirá todo planejamento e lá dentro as quebras da
   *  D1 até D8. A D0 não coloco pontuação e nem tempo, aí será contabilizado
   *  nas outras e somado."
   *
   *  Agrupador é simplesmente quem TEM vínculo pendurado. Não há campo novo, e
   *  é deliberado: um `e_agrupador` gravado na demanda poderia dizer `true` numa
   *  que ficou sem filhos (o último foi excluído), e aí ela sumiria das contas
   *  sem nada dizendo por quê. Ter filho é observável e não tem como mentir.
   *
   *  O QUE ISSO MUDA NAS CONTAS: o agrupador não conta tempo nem ponto. A barra
   *  dele no gantt cobre o período inteiro por desenho — se ela também somasse
   *  ocupação, o dev apareceria com o mês cheio por causa de uma linha que não é
   *  trabalho, e os dias dos filhos entrariam duas vezes na leitura de quem olha.
   */
  function ehAgrupador(lista, m) {
    return filhosDe(lista, idDe(m)).length > 0;
  }

  /** A tarefa principal de um vínculo, ou `null`. */
  function paiDe(lista, m) {
    var pid = String((m || {}).parent_id || '');
    if (!pid) return null;
    return (lista || []).find(function (x) { return idDe(x) === pid; }) || null;
  }

  /** A corrente para cima, do pai até a raiz. Para no teto e em ciclo já
   *  existente na base — uma base suja não pode travar quem for LER ela. */
  function cadeiaAcima(lista, m) {
    var fora = [], visto = {}, atual = paiDe(lista, m), n = 0;
    while (atual && n < MAX_NIVEIS) {
      if (visto[idDe(atual)]) break;
      visto[idDe(atual)] = true;
      fora.push(atual);
      atual = paiDe(lista, atual);
      n += 1;
    }
    return fora;
  }

  /** Pendurar `id` em `novoPai` fecharia um ciclo?
   *
   *  É A GUARDA QUE A TELA NUNCA PRECISOU E A API PRECISA. A tela cria o filho
   *  do zero, e o que acabou de nascer não pode ser ancestral de ninguém. Pela
   *  API o vínculo também se MUDA numa demanda que já existe, e aí "A depende
   *  de B, B depende de A" é uma chamada de distância — e o par não apareceria
   *  em lugar nenhum: some das raízes (as duas têm pai) e some da árvore de
   *  qualquer outra. */
  function criaCiclo(lista, id, novoPai) {
    var alvo = String(id || ''), pai = String(novoPai || '');
    if (!alvo || !pai) return false;
    if (alvo === pai) return true;            // depender de si mesma
    var p = (lista || []).find(function (x) { return idDe(x) === pai; });
    var visto = {}, n = 0;
    while (p && n < MAX_NIVEIS) {
      if (idDe(p) === alvo) return true;
      if (visto[idDe(p)]) return false;       // ciclo que já estava lá, e não este
      visto[idDe(p)] = true;
      p = paiDe(lista, p);
      n += 1;
    }
    return false;
  }

  /** A ÁRVORE INTEIRA abaixo de uma demanda, sem ela. Netos entram: um vínculo
   *  que abriu o próprio vínculo continua sendo custo da mesma tarefa
   *  principal, e parar no primeiro nível esconderia isso.
   *
   *  `visto` não é zelo: com ciclo na base (ou com `MAX_NIVEIS` estourado) esta
   *  função é a que rodaria para sempre, dentro de um `render`. */
  function arvoreDe(lista, id) {
    var fora = [], visto = {}, fila = [String(id || '')], n = 0;
    visto[String(id || '')] = true;
    while (fila.length && n < 5000) {
      var atual = fila.shift();
      filhosDe(lista, atual).forEach(function (f) {
        if (visto[idDe(f)]) return;
        visto[idDe(f)] = true;
        fora.push(f);
        fila.push(idDe(f));
      });
      n += 1;
    }
    return fora;
  }

  /** O PESO DA TAREFA PRINCIPAL: o que ela custa sozinha e o que custa com tudo
   *  que pendura nela.
   *
   *  Devolve sempre o mesmo formato, e o chamador decide o que mostrar:
   *
   *    proprios  os pontos da própria demanda   — `null` se não foi pontuada
   *    vinculos  a soma dos pontos da árvore    — `null` se NENHUM foi pontuado
   *    total     `proprios + vinculos`          — `null` se os dois forem `null`
   *    n         quantos vínculos existem (pontuados ou não)
   *    sem_pontuacao  quantos deles estão sem pontuação — é o que explica um
   *              total menor do que a conversa da sala espera
   *
   *  O NOME `sem_pontuacao` É FEIO NO MEIO DE CÓDIGO camelCase, e é de
   *  propósito: este objeto sai inteiro na resposta da API (`pontos_arvore`),
   *  onde a convenção é snake_case. Um nome aqui e outro lá seriam duas
   *  grafias da mesma coisa, e a invariante que compara as duas cópias da
   *  regra deixaria de comparar o objeto inteiro para comparar campo a campo.
   *
   *  O `null` é o que impede a leitura errada: "0 pontos" numa árvore que
   *  ninguém estimou diz que não custa nada, e o certo é dizer que não se sabe.
   */
  function pontos(lista, m) {
    var meus = pontoDe(m);
    var filhos = arvoreDe(lista, idDe(m));
    var comPonto = filhos.map(pontoDe).filter(function (p) { return p !== null; });
    var soma = comPonto.length
      ? comPonto.reduce(function (t, p) { return t + p; }, 0)
      : null;
    var total = (meus === null && soma === null) ? null : (meus || 0) + (soma || 0);
    return {
      proprios: meus,
      vinculos: soma,
      total: total,
      n: filhos.length,
      sem_pontuacao: filhos.length - comPonto.length,
    };
  }

  /** A FRASE DO PESO DA ÁRVORE, uma só para as três telas.
   *
   *  Vazia quando não há vínculo: a esmagadora maioria das demandas não tem, e
   *  nenhuma delas pode ganhar uma linha nova no card por causa deste caso.
   *
   *  ELA DIZ A CONTA, e não só o resultado. "24 pts" numa demanda que o time
   *  estimou em 8 parece erro de digitação — quem lê procura de onde saiu o
   *  número e não acha. "8 dela + 16 de 3 vínculos" responde antes da pergunta.
   *
   *  E DIZ QUANDO NÃO SABE. Com a árvore inteira sem pontuação o total é `null`,
   *  e a frase fala "sem pontuação" em vez de "0 pts" — zero se lê como "não
   *  custa nada", que é uma afirmação, e aqui não há nenhuma. */
  function frase(lista, m) {
    var p = pontos(lista, m);
    if (!p.n) return '';
    var vin = p.n + (p.n === 1 ? ' vínculo' : ' vínculos');
    var out;
    if (p.total === null) {
      out = vin + ' · sem pontuação';
    } else {
      out = p.total + ' pts no total';
      if (p.proprios !== null && p.vinculos !== null) {
        out += ' · ' + p.proprios + ' dela + ' + p.vinculos + ' de ' + vin;
      } else {
        out += ' · ' + vin;
      }
      if (p.sem_pontuacao) out += ' · ' + p.sem_pontuacao + ' sem pontuação';
    }
    /* E DIZ QUANTOS TRAVAM. Com os dois elos convivendo, "3 vínculos" deixou de
       responder a pergunta que se faz olhando para a tarefa base: eu posso
       fechar isto? Um item pendurado não segura ninguém; uma dependência
       aberta segura. Sem esta parte, os dois casos ficam com a mesma frase. */
    var trava = abertos(lista, idDe(m)).length;
    if (trava) out += ' · ' + trava + (trava === 1 ? ' trava' : ' travam');
    return out;
  }

  function concluida(f) {
    // A etapa vem de `etapa-demanda.js`, dono único dessa resposta.
    var e = (raiz.ETAPADEMANDA && raiz.ETAPADEMANDA.gravada)
      ? raiz.ETAPADEMANDA.gravada(f)
      : String((f || {}).status_planejamento || '');
    return e === 'concluido';
  }

  /** OS VÍNCULOS QUE AINDA SEGURAM A PRINCIPAL — e só eles.
   *
   *  Aqui mora a diferença entre os dois elos. Um filho do tipo PARTE pode
   *  ficar aberto para sempre sem travar nada: ele pertence à tarefa base, não
   *  é pré-requisito dela. Se esta função não filtrasse por `bloqueia`, pendurar
   *  vinte itens numa issue guarda-chuva travaria a issue guarda-chuva — que é
   *  o oposto do que ela existe para fazer. */
  function abertos(lista, id) {
    return filhosDe(lista, id).filter(function (f) {
      return bloqueia(f) && !concluida(f);
    });
  }

  /** Os filhos em aberto de QUALQUER tipo — para contar, e não para travar. */
  function emAberto(lista, id) {
    return filhosDe(lista, id).filter(function (f) { return !concluida(f); });
  }

  raiz.VINCULO = {
    MAX_NIVEIS: MAX_NIVEIS,
    DEPENDENCIA: DEPENDENCIA,
    PARTE: PARTE,
    tipoDe: tipoDe,
    ehAgrupador: ehAgrupador,
    bloqueia: bloqueia,
    concluida: concluida,
    emAberto: emAberto,
    pontoDe: pontoDe,
    filhosDe: filhosDe,
    paiDe: paiDe,
    cadeiaAcima: cadeiaAcima,
    criaCiclo: criaCiclo,
    arvoreDe: arvoreDe,
    pontos: pontos,
    frase: frase,
    abertos: abertos,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.VINCULO;
})(typeof globalThis !== 'undefined' ? globalThis : this);
