/* ═══ SUBTAREFAS: A LEITURA, NUM LUGAR SÓ ═══════════════════════════════════
 *
 * O passo a passo de uma demanda, marcado por quem a está fazendo.
 *
 * O DADO É UMA LISTA SIMPLES: `{ titulo, data, feita, horas }`. Não virou
 * demanda-filha de propósito — subtarefa não tem dono, não tem prazo cobrado,
 * não entra em relatório de entrega e não pode aparecer no Kanban como se fosse
 * trabalho separado. Ela existe para responder "quanto já andou", e só.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUE ESTE ARQUIVO EXISTE.
 *
 * A lista passou a ter TRÊS leitores, cada um com a sua conta escrita à mão:
 *
 *   `dev.html`    o editor, onde o passo nasce e é marcado
 *   `admin.html`  a barrinha no card do Kanban
 *   `admin.html`  o bloco de leitura no modal da demanda (o mais novo)
 *
 * Três cópias de "o que é uma subtarefa válida" e de "quanto por cento andou" é
 * o formato exato do defeito que este repositório já teve várias vezes: uma
 * cópia corrigida e as outras não. O caso concreto que espera para acontecer é
 * o `horas`: o painel do dev distingue `''` (não lancei) de `0` (lancei zero) —
 * quem reescrever a leitura na mão vai usar `Number(x.horas) || 0` e a
 * distinção morre sem erro nenhum aparecer.
 *
 * Quem GRAVA continua sendo só o painel do dev. Este módulo lê. */
(function (raiz) {
  'use strict';

  var MAX_TITULO = 140;

  /* A LISTA NORMALIZADA. Aceita o que vier na base — inclusive `null` no meio
     do array, que já aconteceu — e devolve sempre a mesma forma. */
  /* `AAAA-MM-DD` ou vazio. Texto que não é data não vira data pela metade:
     "15/09" gravado num campo de data quebra toda comparação depois, e é mais
     fácil de achar quando ele some do que quando ele fica. */
  function dia(v) {
    var s = String(v == null ? '' : v).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  }

  function lista(m) {
    var l = (m && Array.isArray(m.subtarefas)) ? m.subtarefas : [];
    return l.filter(Boolean).map(function (x) {
      /* DUAS DATAS, E A ANTIGA CONTINUA VALENDO.
         O passo nasceu com UMA data — `data`, "prevista ou de conclusão" — e a
         base está cheia dela. Agora ele tem início e fim, pedidos para a API.
         `data` NÃO foi renomeada nem removida: é o que as subtarefas gravadas
         até hoje carregam, e trocar o nome do campo apagaria a data de todas
         elas em silêncio. Ela passa a valer como FIM quando o fim não veio —
         era disso que ela sempre falou ("prevista ou de conclusão"). */
      var fim = dia(x.fim) || dia(x.data);
      return {
        titulo: String(x.titulo || '').slice(0, MAX_TITULO),
        data: String(x.data || '').slice(0, 10),
        inicio: dia(x.inicio),
        fim: fim,
        feita: !!x.feita,
        /* `''` E NÃO `0`: a diferença entre "não lancei" e "lancei zero" é a
           mesma que `semPontuacao` guarda em `capacidade.js`. Zero em silêncio
           some da soma sem ninguém notar que faltou lançar. */
        horas: (x.horas === 0 || x.horas) ? String(x.horas) : '',
      };
    });
  }

  function progresso(subs) {
    var l = Array.isArray(subs) ? subs : lista(subs);
    var total = l.length;
    var feitas = l.filter(function (x) { return x.feita; }).length;
    return { total: total, feitas: feitas,
             pct: total ? Math.round(feitas / total * 100) : null };
  }

  /* A SOMA DAS HORAS DOS PASSOS, ou `null` quando NENHUM passo tem hora.
   *
   * `null` é a resposta que liga e desliga o modo derivado no painel do dev:
   * com ele, o campo de horas da demanda continua sendo digitado à mão, como a
   * maioria das demandas usa.
   *
   * O CAMPO VAZIO SAI ANTES DO `Number`, e não depois. `Number('')` é ZERO, e
   * zero passa em `Number.isFinite(h) && h >= 0` — a primeira versão disto
   * somava 0 para todo passo sem hora e devolvia 0 em vez de `null`. Efeito: o
   * campo de horas virava somente-leitura com "0" em TODA demanda que tivesse
   * subtarefa, sem ninguém ter lançado hora nenhuma. */
  function horasTotal(subs) {
    var l = Array.isArray(subs) ? subs : lista(subs);
    var nums = l
      .filter(function (x) { return String(x.horas == null ? '' : x.horas).trim() !== ''; })
      .map(function (x) { return Number(x.horas); })
      .filter(function (h) { return isFinite(h) && h >= 0; });
    if (!nums.length) return null;
    var total = nums.reduce(function (t, h) { return t + h; }, 0);
    /* ARREDONDA NA CENTÉSIMA. Meia hora em cada um de três passos dá 1.5, mas
       0.1 + 0.2 em ponto flutuante dá 0.30000000000000004 — e esse número iria
       para o relatório do comitê do jeito que está. */
    return Math.round(total * 100) / 100;
  }

  /* A DATA EM DIA/MÊS/ANO, para quem só mostra. Aceita `AAAA-MM-DD` e devolve
     vazio para qualquer outra coisa, em vez de montar "undefined/undefined". */
  function dataBR(v) {
    var s = String(v || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    return s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4);
  }

  /* O PERÍODO DO PASSO, em texto. Devolve '' quando não há data nenhuma —
     quem mostra decide se omite a linha, em vez de receber um travessão solto
     para interpretar. */
  function periodo(x) {
    var i = dataBR(x && x.inicio), f = dataBR(x && (x.fim || x.data));
    if (i && f) return i === f ? i : i + ' a ' + f;
    return f || i || '';
  }

  /* O passo começou depois de terminar? Não é erro de digitação que se conserta
     sozinho: as duas datas vieram de alguém, e inverter por conta própria
     esconderia o engano em vez de mostrá-lo. */
  function periodoInvertido(x) {
    var i = dia(x && x.inicio), f = dia(x && (x.fim || x.data));
    return !!(i && f && i > f);
  }

  var api = { MAX_TITULO: MAX_TITULO, lista: lista, progresso: progresso,
              horasTotal: horasTotal, dataBR: dataBR, dia: dia,
              periodo: periodo, periodoInvertido: periodoInvertido };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.SUBTAREFA = api;
}(typeof window !== 'undefined' ? window : this));
