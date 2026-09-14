/* ─────────────────────────────────────────────────────────────────────────
   DE QUEM É ESTA DEMANDA — uma resposta, e não doze.

   ═════════════════════════════════════════════════════════════════════════
   POR QUE ESTE ARQUIVO EXISTE.

   O relato foi "um dev está criando demanda, porém não está aparecendo para
   ele". A demanda existe, está gravada, e tem o nome dele no campo `dev`.

   MEDIDO, executando a cadeia de filtros real do `dev.html`:

     m.dev="Dan"        painel aberto em "Dan"         VÊ
     m.dev="Dan"        painel aberto em "DAN"         SOME
     m.dev="dan"        painel aberto em "Dan"         SOME

   A comparação era `splitDevs(m.dev).includes(currentDev)` — igualdade de
   string, sensível a maiúsculas e a acento. Doze lugares, em três telas.

   E O SERVIDOR JÁ PENSAVA DIFERENTE. O `limpaDevs` do Worker compara nomes
   assim desde sempre:

     norm = NFD → tira acento → minúsculas → junta espaços → trim

   Ou seja: para o Worker, "DAN" e "Dan" são a mesma pessoa; para a tela, não
   eram. As duas metades do sistema discordavam sobre quem é quem, e quem
   pagava era o dev que abria a própria demanda e não a via.

   ═════════════════════════════════════════════════════════════════════════
   O QUE ESTA REGRA NÃO FAZ, e por que não deve fazer.

   NÃO casa nome PARCIAL. "Dan" não encontra "Dan Weine", e isso é deliberado:
   se casasse por prefixo, "Ana" acharia "Ana Paula" e "Ana Beatriz", e uma
   pessoa passaria a ver as demandas da outra. Perder o próprio card é ruim;
   ver o card alheio e mexer nele é pior.

   Dois nomes REALMENTE diferentes para a mesma pessoa já têm resposta nesta
   base, e é a junção de devs no Planejamento (a mesma que uniu `Murillo` a
   `Murillo Jesus`). Esta regra cobre a mesma grafia escrita de outro jeito;
   a junção cobre grafias diferentes. Não são o mesmo problema.

   NÃO decide em que etapa a demanda está — isso é `etapa-demanda.js`.
   Nem lê dados, nem desenha nada.
   ───────────────────────────────────────────────────────────────────────── */
(function (raiz) {
  'use strict';

  /* A MESMA NORMALIZAÇÃO DO WORKER (`limpaDevs`), caractere por caractere.
     Se as duas divergirem, volta o desacordo que este arquivo existe para
     acabar: o servidor mantendo no time quem a tela não encontra. */
  /* A FAIXA DOS ACENTOS VEM POR ESCAPE, e não como caractere literal.

     Escrita direto no código, ela é `[<U+0300>-<U+036F>]`: dois caracteres
     COMBINANTES, invisíveis, que se penduram no colchete ao lado. O `worker.js`
     tem essa forma, e no terminal ela aparece como `[̀-ͯ]` — um editor que
     normalize o arquivo, um copiar-e-colar, ou um `git` com conversão de fim de
     linha, e a faixa vira outra coisa sem ninguém ver. Aqui está por escape,
     que se lê e sobrevive. */
  var ACENTOS = new RegExp('[\\u0300-\\u036f]', 'g');

  function norm(nome) {
    return String(nome == null ? '' : nome)
      .normalize('NFD').replace(ACENTOS, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /** Os nomes de uma demanda. O campo aceita "Fulano / Beltrano" desde sempre,
   *  e as duas pessoas contam — separador `/` ou `,`. */
  function daDemanda(m) {
    var bruto = (m && typeof m === 'object') ? m.dev : m;
    return String(bruto == null ? '' : bruto)
      .split(/[\/,]/).map(function (x) { return x.trim(); })
      .filter(Boolean);
  }

  /** Duas grafias da MESMA pessoa? Vazio nunca é ninguém: sem esta guarda,
   *  demanda sem responsável casaria com dev sem nome escolhido, e o painel
   *  recém-aberto mostraria todas as órfãs como se fossem da pessoa. */
  function mesmo(a, b) {
    var x = norm(a), y = norm(b);
    return !!x && !!y && x === y;
  }

  /** Esta demanda é desta pessoa? É a pergunta que as telas fazem.
   *
   *  A GUARDA DO VAZIO É ESTREITA, e vale dizer exatamente o que ela cobre — a
   *  sabotagem mostrou que eu tinha escrito demais sobre ela.
   *
   *  O caso comum — painel sem dev escolhido, demanda sem responsável — já está
   *  resolvido antes, no `daDemanda`: o `filter(Boolean)` não deixa nome vazio
   *  entrar na lista, então não há com o que casar. Removi a guarda e NENHUM
   *  daqueles casos mudou de resposta.
   *
   *  O que ela cobre de verdade é o nome que SOBRA VAZIO depois de normalizado —
   *  um acento solto, sem letra nenhuma. Esse passa pelo `filter(Boolean)` (é
   *  caractere, é truthy) e vira `''` no `norm`, casando com o alvo vazio. Raro,
   *  mas é o único jeito de duas coisas vazias se encontrarem aqui, e é por esse
   *  caso que a invariante cobra a guarda. */
  function eDe(m, nome) {
    var alvo = norm(nome);
    if (!alvo) return false;
    return daDemanda(m).some(function (n) { return norm(n) === alvo; });
  }

  raiz.DEVNOME = {
    norm: norm,
    daDemanda: daDemanda,
    mesmo: mesmo,
    eDe: eDe,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.DEVNOME;
})(typeof globalThis !== 'undefined' ? globalThis : this);
