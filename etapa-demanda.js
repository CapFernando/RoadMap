/* ─────────────────────────────────────────────────────────────────────────
   EM QUE ETAPA ESTÁ ESTA DEMANDA — uma resposta, e não quatro.

   ═════════════════════════════════════════════════════════════════════════
   POR QUE ESTE ARQUIVO EXISTE.

   O relato foi "está sendo apresentada no dash, porém na esteira está
   concluído". Naquele caso as duas telas estavam certas — eram demandas
   diferentes, a AX-328 e a AX-338. Mas a investigação encontrou QUATRO
   implementações da mesma pergunta, e duas delas respondiam diferente.

   MEDIDO no arquivo de dados, 158 demandas visíveis:

     admin vs gantt        divergem em 4
       2 que o admin chama de `negada`      e o gantt chama de `backlog`
       2 que o admin chama de `em_andamento` e o gantt chama de `backlog`
     admin vs capacidade.js divergem em 5

   As duas negadas são o pior caso: a régua de chips do Planejamento contava
   demanda RECUSADA como Backlog. Ninguém veria — o número está certo somando
   errado, que é como esta base já errou antes (ver o cabeçalho do `catalogo.js`
   sobre os 42 temas).

   ═════════════════════════════════════════════════════════════════════════
   AS DUAS CAMADAS, e por que elas são separadas.

   `gravada(m)`  A etapa em que a demanda ESTÁ. É o valor de formulário: é este
                 que se grava, e é contra este que se compara para decidir
                 movimento.

   `efetiva(m)`  A etapa para MOSTRAR e FILTRAR, com `atrasado` derivado do
                 prazo. NUNCA gravar: o aviso já estava escrito no `index.html`
                 — "gravar o efetivo apagaria o estágio real da demanda".

   Elas se separam porque `atrasado` NÃO É ETAPA DE TRABALHO, e o próprio
   `admin.html` registra isso: "'Atrasado' saiu da esteira: atraso não é etapa,
   é uma condição". Uma função só, devolvendo às vezes uma etapa e às vezes uma
   condição, é o que fazia o card sair da coluna real — e foi por isso que o
   Kanban voltou a usar a etapa gravada para escolher a coluna.

   ═════════════════════════════════════════════════════════════════════════
   O QUE A CAMADA GRAVADA FAZ, item por item.

   1. `deploy` VIRA `concluido`. A etapa foi removida; sobrou dado com ela.

   2. `status_planejamento` MANDA, quando existe e não é `backlog`. É o campo
      novo, e ele é a verdade para tudo o que passou por ele.

   3. SENÃO, O MAPA DO `status` LEGADO. Demanda anterior ao campo novo só tem
      `status` (`estimada`, `iniciada`, `concluida`…). É ESTE PASSO que o gantt
      e o `capacidade.js` não tinham — daí as quatro e as cinco divergências.

   4. E, AINDA EM BACKLOG COM DATA DE INÍCIO, a data decide: início no passado é
      trabalho começado. Sem isto, demanda importada com data e sem etapa ficava
      no Backlog enquanto o dev já estava nela.

   ═════════════════════════════════════════════════════════════════════════
   O QUE ESTE ARQUIVO NÃO DECIDE.

   Não decide se a demanda está atrasada — isso é `prazo.js`, e continua lá.
   Aqui só se pergunta a ele. Nem lê dados, nem desenha nada.
   ───────────────────────────────────────────────────────────────────────── */
(function (raiz) {
  'use strict';

  /* O MAPA DO `status` LEGADO. Exposto porque a aba Dados do Admin ainda mostra
     o campo cru e precisa dos mesmos nomes — duas listas divergiriam no dia em
     que um valor legado aparecesse novo na base. */
  var LEGADO = {
    recebida: 'backlog',
    refinamento: 'planejado',
    regra: 'planejado',
    estimada: 'planejado',
    iniciada: 'em_andamento',
    concluida: 'concluido',
    concluido: 'concluido',
    negada: 'negada',
  };

  function hojeISO() {
    /* PERGUNTA AO `prazo.js` PRIMEIRO. Ele é quem define "hoje" para o resto do
       sistema, e um segundo relógio aqui faria a etapa virar num instante e o
       atraso noutro — na virada do dia, com fuso, isso é uma hora de desacordo. */
    if (raiz.PRAZO && typeof raiz.PRAZO.hojeISO === 'function') return raiz.PRAZO.hojeISO();
    return new Date().toISOString().slice(0, 10);
  }

  /** ESTÁ PAUSADA? O `pausado_em` é a única fonte desse estado.
   *
   *  Era uma linha copiada em `admin.html`, `dev.html` e `gantt.html` — e
   *  AUSENTE do `index.html`, que é justamente por isso que o dash não checava
   *  pausa antes de chamar uma demanda de atrasada: a função não existia lá. */
  function pausada(m) {
    return !!(m && String(m.pausado_em || '').trim());
  }

  /** A ETAPA EM QUE A DEMANDA ESTÁ. É o valor de formulário — este se grava. */
  function gravada(m, hoje) {
    var d = m || {};
    var sp = d.status_planejamento === 'deploy' ? 'concluido' : d.status_planejamento;
    if (sp && sp !== 'backlog') return sp;
    var base = LEGADO[d.status] || sp || 'backlog';
    if (base === 'backlog' && d.inicio) {
      return d.inicio <= (hoje || hojeISO()) ? 'em_andamento' : 'planejado';
    }
    return base;
  }

  /** A ETAPA PARA MOSTRAR E FILTRAR, com `atrasado` derivado. NUNCA GRAVAR.
   *
   *  1. `atrasado` GRAVADO passa direto. Ainda há dado com essa etapa, de quando
   *     ela existia na esteira.
   *  2. E o prazo, via `prazo.js` — que já sabe que o atraso do dev para no dia
   *     da entrega, e que o tempo de validação do PM/PO não é dele.
   *
   *  ═══════════════════════════════════════════════════════════════════════════
   *  NÃO HÁ CHECAGEM DE PAUSA AQUI, e isso é deliberado. Leia antes de "corrigir".
   *
   *  `admin.html`, `dev.html` e `gantt.html` tinham, cada um, um
   *  `if (estaPausado(m)) return sk;` antes de perguntar o atraso. O
   *  `index.html` não tinha, e eu tratei essa diferença como defeito — afirmei
   *  que uma demanda pausada e vencida apareceria Atrasada no dash.
   *
   *  ERA FALSO, e a sabotagem provou: removi o ramo e NENHUMA invariante de
   *  comportamento mudou de resultado. Medido direto no `prazo.js`:
   *
   *    vencida sem pausa   estaAtrasada: true   dias: 40
   *    vencida com pausa   estaAtrasada: false  dias: null
   *    pausada só ontem    estaAtrasada: false  dias: null
   *
   *  `diasDeAtraso` devolve `null` para demanda pausada, qualquer que seja o
   *  tempo parado. A REGRA DA PAUSA JÁ MORA NO `prazo.js`, que é onde ela deve
   *  morar: é ele que tem `diasPausados` e `prazoEfetivo`. As três telas
   *  carregavam um ramo que nunca podia mudar a resposta, e a ausência dele na
   *  quarta era inofensiva.
   *
   *  O ramo saiu porque ramo que não altera saída é decoração — e decoração num
   *  lugar como este ensina a regra errada a quem lê depois. Em troca há uma
   *  invariante que fixa o comportamento NO DONO: "pausada nunca atrasa", contra
   *  o `prazo.js`. Se alguém mudar isso lá, ela acusa; hoje, o ramo daqui
   *  esconderia a mudança em três telas e a deixaria aparecer só na quarta. */
  function efetiva(m, hoje) {
    var sk = gravada(m, hoje);
    if (sk === 'atrasado') return 'atrasado';
    var dia = hoje || hojeISO();
    if (raiz.PRAZO && raiz.PRAZO.estaAtrasada(m, sk, dia)) return 'atrasado';
    return sk;
  }

  /** Em aberto: nem concluída nem negada. A pergunta de prazo do dia a dia. */
  function aberta(m, hoje) {
    var e = gravada(m, hoje);
    return e !== 'concluido' && e !== 'negada';
  }

  raiz.ETAPA = {
    gravada: gravada,
    efetiva: efetiva,
    pausada: pausada,
    aberta: aberta,
    LEGADO: LEGADO,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.ETAPA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
