/* ─────────────────────────────────────────────────────────────────────────────
   A SPRINT É DO PM/PO — e ela passa a ser ESCOLHIDA, não deduzida.

   ═══════════════════════════════════════════════════════════════════════════
   O QUE MUDA, E POR QUE ISTO PRECISOU DE UM ARQUIVO.

   "Toda task aberta pelo dev deverá cair em backlog fora da sprint, dentro da
    sprint apenas demandas que o PM/PO repassar. Backlog da sprint ficará
    disponível para os devs, apenas o que o PO informar que faz parte da SPRINT."

   Hoje a sprint NÃO É ESCOLHIDA POR NINGUÉM. O `sprint` do card é um rótulo
   DERIVADO: `sprintDeData(inicio) || sprintDeData(entrega)` no gantt, recalculado
   a cada gravação. O `capacidade.js` registra o mesmo achado com todas as letras
   — "ele nunca é editado por tela nenhuma (zero eventos de mudança de `sprint` na
   base)".

   ISSO FAZ A PERGUNTA NOVA SER IMPOSSÍVEL DE RESPONDER. "Está na sprint porque o
   PO pôs" e "está na sprint porque alguém digitou uma data" são afirmações
   diferentes, e o campo derivado só sabe dizer a segunda. Um dev que abrisse uma
   task com `inicio` de hoje entraria na sprint corrente sozinho, sem nenhuma
   decisão de ninguém — que é exatamente o que a regra proíbe.

   Então nasce um campo CARIMBADO, `sprint_po`, pela mesma razão que
   `pontos_planejados` é carimbado e não lido de `poker_pontos` no fim do mês
   (ver o cabeçalho do `capacidade.js`): um valor derivado reescreve o passado
   toda vez que a origem dele muda. Mover o prazo de uma demanda não pode mudar
   a sprint em que o PO a colocou — senão "o que foi combinado para esta semana"
   vira "o que sobrou depois da última edição de data".

   `sprint` CONTINUA EXISTINDO e continua derivado. Ele é o rótulo de leitura do
   gantt e dos filtros, e 1089 demandas o carregam. Quem pergunta "esta demanda
   foi repassada para a sprint?" pergunta aqui; quem pergunta "em que semana cai
   a data dela?" continua perguntando ao gantt. São perguntas diferentes e
   passaram a precisar de respostas diferentes.

   ═══════════════════════════════════════════════════════════════════════════
   VAZIO É BACKLOG, e é por isso que não há campo "fora da sprint".

   Um booleano `na_sprint` ao lado de `sprint_po` seria um segundo lugar para a
   mesma verdade, e dois lugares divergem: `na_sprint: true` com `sprint_po: ''`
   não tem leitura possível. Sem sprint carimbada, a demanda está no backlog —
   e é o estado em que TODAS as 1089 demandas da base começam, sem migração
   nenhuma e sem nada aparecer na sprint por engano no dia 1º.

   ═══════════════════════════════════════════════════════════════════════════
   O HISTÓRICO EXISTE PORQUE "ENTROU ATRASADA" É UMA PERGUNTA SOBRE O PASSADO.

   "Caso a demanda pule para a próxima sprint, entrará atrasada."

   Saber isso exige saber em quantas sprints ela já esteve, e o campo corrente só
   sabe a última. `sprint_po_historico` guarda a sequência — primeira entrada
   mais os repasses seguintes. Quem está na segunda sprint em diante entrou
   atrasado, e `pulos(m)` diz quantas vezes.

   NÃO É O `rolagemDeSprint` DO `capacidade.js`. Aquele deduz pulos pela mudança
   da data de `entrega`, que era a única pista que existia quando ninguém
   escolhia sprint. Este é o registro do ato: o PO moveu a demanda de S1 para S2,
   e isso ficou escrito. Os dois vão conviver enquanto houver base anterior a
   novembro — o derivado responde pelo passado, este responde daqui para a frente.
   ───────────────────────────────────────────────────────────────────────────*/
(function (raiz) {
  'use strict';

  /* O FORMATO DO RÓTULO é o que `sprintDeData` (gantt.html) produz: `S2-11-2026`.
     Conferir aqui não é paranoia — o campo `sprint` antigo era texto livre e com
     ONZE preenchimentos à mão já tinha duas grafias na base ('S1-08-2026' e
     'S1-08-26'), que são duas linhas para a mesma sprint em qualquer relatório.
     O campo novo nasce fechado para esse defeito não nascer junto. */
  var ROTULO = /^S\d-\d{2}-\d{4}$/;

  function txt(v) { return String(v == null ? '' : v).trim(); }
  function iso(v) {
    var s = txt(v).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  }

  function rotuloValido(s) { return ROTULO.test(txt(s)); }

  /* ═══ QUAIS SPRINTS EXISTEM NUM MÊS ═══════════════════════════════════════
   *
   * O PO precisa ESCOLHER uma sprint, e para escolher precisa da lista. Ela só
   * existia dentro do `gantt.html`, montada por `semanasDoMes` +
   * `getWorkingDaysOfMonth` + `sprintDeData` — três funções que dependem do
   * `state` daquela tela.
   *
   * REESCREVER A CONTA AQUI SERIA O ERRO CONHECIDO. O comentário do
   * `sprintDeData` registra o que acontece quando duas contas de semana convivem:
   * "SETE dos 21 dias úteis de setembro de 2026 davam um rótulo no card que
   * discordava da coluna logo acima dele (...) Dois números para a mesma sprint,
   * na mesma tela, e nada dizendo qual acreditar."
   *
   * Então a conta vem para cá inteira, e há invariante que roda ESTA e a do
   * gantt lado a lado, DIA A DIA, por dois anos de calendário. Divergiram em um
   * dia, o teste acusa.
   *
   * SEMANA DE SEGUNDA A DOMINGO, e não índice de semana do calendário: é como o
   * time fala de semana. Feriado sai dos dias, como no gantt — a sprint que o
   * contém tem um dia útil a menos, e a capacidade desloca junto.
   *
   * A LISTA DE FERIADOS É OPCIONAL, pela mesma razão de `diasUteisNaArea` em
   * `prazo.js`: quem a tem passa, quem não a tem conta segunda a sexta. Aqui a
   * diferença é ainda menor — um feriado só muda o RÓTULO se apagar uma semana
   * inteira do mês, o que exigiria cinco feriados seguidos.                   */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /** A SEGUNDA-FEIRA DA SEMANA DE UMA DATA. É a chave que agrupa os dias.
   *  Em UTC a partir das partes: `new Date('2026-09-08')` volta 07/09 no fuso do
   *  Brasil, e um dia aqui muda a semana inteira de uma demanda. */
  function segundaDaSemana(s) {
    var p = iso(s).split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    // getUTCDay(): 0 = domingo, e o domingo pertence à semana que COMEÇOU na
    // segunda anterior — por isso ele volta seis dias, e não zero.
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }

  /** Os dias ÚTEIS de um mês (`mes` de 1 a 12), em ISO. */
  function diasUteisDoMes(ano, mes, feriados) {
    var fer = {};
    (feriados || []).forEach(function (f) {
      fer[iso(f && typeof f === 'object' ? f.data : f)] = true;
    });
    var ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    var out = [];
    for (var d = 1; d <= ultimo; d++) {
      var dt = new Date(Date.UTC(ano, mes - 1, d));
      var dow = dt.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      var s = dt.toISOString().slice(0, 10);
      if (fer[s]) continue;
      out.push(s);
    }
    return out;
  }

  /** AS SPRINTS DE UM MÊS: `{ rotulo, de, ate, dias }`, em ordem. */
  function sprintsDoMes(ano, mes, feriados) {
    var dias = diasUteisDoMes(ano, mes, feriados);
    var grupos = [], atual = null, chave = '';
    dias.forEach(function (s) {
      var k = segundaDaSemana(s);
      if (k !== chave) { atual = []; grupos.push(atual); chave = k; }
      atual.push(s);
    });
    return grupos.map(function (g, i) {
      return { rotulo: 'S' + (i + 1) + '-' + pad2(mes) + '-' + ano,
               de: g[0], ate: g[g.length - 1], dias: g.length };
    });
  }

  /** O RÓTULO DA SPRINT EM QUE UMA DATA CAI.
   *
   *  O desempate de fim de semana / feriado é o MESMO do gantt: cai na sprint
   *  que COMEÇA depois dela; se não houver, na última. Uma entrega marcada num
   *  sábado não pode receber rótulo diferente conforme a tela que a desenha. */
  function rotuloDeData(s, feriados) {
    var dia = iso(s);
    if (!dia) return '';
    var sp = sprintsDoMes(+dia.slice(0, 4), +dia.slice(5, 7), feriados);
    if (!sp.length) return '';
    for (var i = 0; i < sp.length; i++) {
      if (dia >= sp[i].de && dia <= sp[i].ate) return sp[i].rotulo;
    }
    for (var j = 0; j < sp.length; j++) if (sp[j].de > dia) return sp[j].rotulo;
    return sp[sp.length - 1].rotulo;
  }

  /** A SPRINT DE HOJE — a que o painel do dev abre por padrão. */
  function sprintCorrente(hoje, feriados) {
    return rotuloDeData(iso(hoje) || new Date().toISOString().slice(0, 10), feriados);
  }

  /** A SPRINT EM QUE O PM/PO PÔS ESTA DEMANDA. String vazia = backlog. */
  function doPO(m) {
    var s = txt((m || {}).sprint_po);
    return rotuloValido(s) ? s : '';
  }

  /** Está fora de qualquer sprint — é o estado em que toda demanda começa, e o
   *  estado em que toda task aberta pelo dev tem de nascer. */
  function foraDaSprint(m) { return doPO(m) === ''; }

  /** Esta demanda faz parte DESTA sprint? É a pergunta que o painel do dev faz
   *  para montar o backlog da sprint — e ela nunca olha data, só o carimbo. */
  function naSprint(m, sprint) {
    var s = txt(sprint);
    return !!s && doPO(m) === s;
  }

  /** As demandas que o PO liberou para uma sprint. É a lista que o dev vê. */
  function daSprint(lista, sprint) {
    return (lista || []).filter(function (m) { return naSprint(m, sprint); });
  }

  function historico(m) {
    var h = (m || {}).sprint_po_historico;
    return Array.isArray(h) ? h.filter(Boolean) : [];
  }

  /** QUANTAS VEZES A DEMANDA FOI REPASSADA DEPOIS DA PRIMEIRA. Zero para quem
   *  está na sprint em que entrou. */
  function pulos(m) {
    var h = historico(m);
    return h.length > 1 ? h.length - 1 : 0;
  }

  /** ENTROU ATRASADA: já esteve em outra sprint antes desta.
   *
   *  Lê o HISTÓRICO e não compara rótulos de sprint entre si. Comparar 'S4-11'
   *  com 'S1-12' exigiria saber que dezembro vem depois de novembro a partir de
   *  duas strings — e a virada de ano ('S4-12-2026' → 'S1-01-2027') é onde essa
   *  conta erra de um ano inteiro. O registro do ato não tem esse problema. */
  function entrouAtrasada(m) { return pulos(m) > 0; }

  /** A SPRINT EM QUE ELA ENTROU DA PRIMEIRA VEZ — o compromisso original. */
  function sprintDeOrigem(m) {
    var h = historico(m);
    return h.length ? txt(h[0].sprint) : '';
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /** O CHIP DA SPRINT, para o card do quadro.
   *
   *  MORA AQUI porque as duas telas o desenham — o quadro do PM/PO e o painel do
   *  dev. Escrito duas vezes, elas divergiriam no dia em que uma ganhasse o
   *  "entrou atrasada" e a outra não, e aí o dev e o PO leriam coisas diferentes
   *  sobre o mesmo card. É o mesmo motivo de `DEVOLUCAO.faixa`.
   *
   *  BACKLOG TAMBÉM DESENHA, e isso é deliberado. Um card sem chip se lê como
   *  "esqueceram de pôr o chip", não como "está fora da sprint" — e "fora da
   *  sprint" é justamente o estado que a regra nova criou e que precisa ser
   *  visível. Silêncio aqui seria o mesmo defeito do `semPontuar`.             */
  function badge(m, classe) {
    var s = doPO(m);
    var cls = classe || 'sp-chip';
    if (!s) {
      return '<span class="' + cls + ' sp-fora" title="Fora da sprint — está no ' +
             'backlog até o PM/PO repassar.">📋 Backlog</span>';
    }
    var n = pulos(m);
    if (!n) {
      return '<span class="' + cls + '" title="Repassada para a sprint ' + esc(s) +
             (txt((m || {}).sprint_po_por) ? ' por ' + esc(m.sprint_po_por) : '') +
             '.">🏃 ' + esc(s) + '</span>';
    }
    return '<span class="' + cls + ' sp-atrasada" title="Entrou atrasada: veio de ' +
           esc(sprintDeOrigem(m)) + ' e já rolou ' + n +
           (n === 1 ? ' sprint' : ' sprints') + '.">🏃 ' + esc(s) +
           ' · atrasada ' + n + '×</span>';
  }

  /** Quem pode repassar uma demanda para a sprint.
   *
   *  PELO PAPEL, e nunca pelo nome. É a mesma trava do Validado em Comitê, e ela
   *  existe porque há dois Guilhermes no time: autorizar por nome dá o poder a
   *  quem só tem o nome parecido. */
  function podeRepassar(papel) { return txt(papel) === 'admin'; }

  /* ═══ OS ATOS ══════════════════════════════════════════════════════════════
   *
   * Devolvem `{ ok, erro }` e MEXEM NA DEMANDA só quando `ok`. O formato é o
   * mesmo do `pausa.js` porque as duas telas que chamam os dois já sabem lê-lo.
   */

  /** O PM/PO REPASSA a demanda para uma sprint. */
  function repassar(m, sprint, quem, hoje) {
    if (!m) return { ok: false, erro: 'Demanda não encontrada.' };
    var s = txt(sprint);
    if (!rotuloValido(s)) {
      return { ok: false, erro: 'Sprint inválida ("' + s + '"). O formato é S1-11-2026.' };
    }
    if (doPO(m) === s) {
      return { ok: false, erro: 'Esta demanda já está na sprint ' + s + '.' };
    }
    var h = historico(m).slice();
    h.push({ sprint: s, em: iso(hoje), por: txt(quem) });
    m.sprint_po = s;
    m.sprint_po_em = iso(hoje);
    m.sprint_po_por = txt(quem);
    m.sprint_po_historico = h;
    return { ok: true, entrouAtrasada: h.length > 1, pulos: h.length - 1 };
  }

  /** O PM/PO TIRA a demanda da sprint — ela volta para o backlog.
   *
   *  O HISTÓRICO NÃO É APAGADO. Tirar da sprint não desfaz as sprints em que ela
   *  esteve, e apagar faria uma demanda que rolou três semanas voltar a parecer
   *  nova na próxima vez que entrasse. É o mesmo cuidado do `pausa_historico`. */
  function retirar(m, quem, hoje) {
    if (!m) return { ok: false, erro: 'Demanda não encontrada.' };
    if (foraDaSprint(m)) {
      return { ok: false, erro: 'Esta demanda já está fora da sprint.' };
    }
    m.sprint_po = '';
    m.sprint_po_em = iso(hoje);
    m.sprint_po_por = txt(quem);
    return { ok: true };
  }

  /* ═══ O QUE O DEV ABRE ═════════════════════════════════════════════════════
   *
   * "Toda task aberta pelo dev deverá cair em backlog fora da sprint."
   *
   * `backlog` E SEM `inicio` — e a segunda metade é a que não é óbvia.
   *
   * `etapa-demanda.js` tem esta regra: "ainda em backlog COM DATA DE INÍCIO, a
   * data decide: início no passado é trabalho começado". Uma task nascida em
   * `backlog` com `inicio` de hoje sai de `gravada()` como `em_andamento` — ela
   * pularia o backlog no mesmo instante em que fosse criada, sem ninguém mexer,
   * e a regra inteira viraria letra morta. MEDIDO contra `ETAPA.gravada` antes
   * de escrever isto, e há invariante fixando o comportamento.
   *
   * É UMA FUNÇÃO e não um objeto literal copiado na tela: nasce em dois lugares
   * (o formulário do painel do dev e o endpoint), e dois literais divergem no dia
   * em que um ganhar campo que o outro não tem.
   */
  function nasceForaDaSprint(d) {
    var o = d || {};
    o.status = 'recebida';
    o.status_planejamento = 'backlog';
    o.sprint_po = '';
    o.sprint_po_historico = [];
    /* SEM DATA DE INÍCIO — ver acima. E sem `sprint` derivada: o gantt a calcula
       de `inicio`/`entrega`, e com os dois vazios ela sai vazia de qualquer
       forma; zerar aqui é dizer isso em voz alta para quem ler o registro. */
    o.inicio = '';
    o.sprint = '';
    return o;
  }

  /* ═══ OS ESPELHOS DAS TRAVAS DO SERVIDOR ═══════════════════════════════════
   *
   * O Worker não carrega este arquivo (ele não importa nada — ver o cabeçalho
   * dele), então a regra está escrita duas vezes de propósito. Estas funções são
   * a cópia desta ponta, e há invariante rodando as duas lado a lado, caso a
   * caso, para a divergência aparecer no teste e não em produção.
   */

  /** O dev tentando pôr a própria demanda numa sprint. */
  function repassandoSemSerPO(papel, antes, depois) {
    if (podeRepassar(papel)) return false;
    return txt(antes) !== txt(depois);
  }

  /** Task nascendo dentro da sprint pela mão de quem não é PM/PO. */
  function nascendoNaSprint(papel, d) {
    if (podeRepassar(papel)) return false;
    return doPO(d) !== '';
  }

  var api = {
    ROTULO: ROTULO,
    rotuloValido: rotuloValido,
    segundaDaSemana: segundaDaSemana,
    diasUteisDoMes: diasUteisDoMes,
    sprintsDoMes: sprintsDoMes,
    rotuloDeData: rotuloDeData,
    sprintCorrente: sprintCorrente,
    doPO: doPO,
    foraDaSprint: foraDaSprint,
    naSprint: naSprint,
    daSprint: daSprint,
    historico: historico,
    pulos: pulos,
    entrouAtrasada: entrouAtrasada,
    sprintDeOrigem: sprintDeOrigem,
    badge: badge,
    podeRepassar: podeRepassar,
    repassar: repassar,
    retirar: retirar,
    nasceForaDaSprint: nasceForaDaSprint,
    repassandoSemSerPO: repassandoSemSerPO,
    nascendoNaSprint: nascendoNaSprint,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.SPRINTPO = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
