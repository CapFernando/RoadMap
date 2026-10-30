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
  /* ═══ E O MÊS E O ÍNDICE SÃO CONFERIDOS, não só a forma ═══════════════════
   *
   * Era `/^S\d-\d{2}-\d{4}$/`, que aceita `S9-99-9999`. ACHADO SABOTANDO: a
   * sabotagem tirou a guarda de `sprintAnterior` e eu fui procurar um rótulo
   * que a exercitasse — e descobri que um rótulo MALFORMADO passava no
   * validador e DERRUBAVA a tela: mês 99 faz `Date.UTC(ano, 98, 0)` virar uma
   * data impossível, e `toISOString` lança `RangeError` dentro de
   * `sprintsDoMes`. Todo lugar que monta a lista de sprints morre junto.
   *
   * E ISSO ERA ALCANÇÁVEL: `sprint_po` é gravado depois de passar por este
   * mesmo regex (no módulo e no Worker), então um pedido forjado com
   * `S9-99-9999` entrava na base e quebrava o Admin, o Gantt e o painel do dev
   * de todo mundo — sem erro nenhum apontando a causa.
   *
   * O índice vai até 5 porque um mês cabe em cinco segundas-feiras, e não em
   * seis (está medido no comentário de `semanasDoMes`, no gantt). */
  var ROTULO = /^S[1-5]-(0[1-9]|1[0-2])-\d{4}$/;

  function txt(v) { return String(v == null ? '' : v).trim(); }
  function iso(v) {
    var s = txt(v).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  }

  function rotuloValido(s) { return ROTULO.test(txt(s)); }

  /* ═══ O RÓTULO CURTO — `S1-10`, e só para a TELA ══════════════════════════
   *
   * "Add uma marcação na task de qual sprint ela faz parte: S1-10, S2-10…"
   *
   * O ANO SAI DA TELA E NUNCA DO DADO. `sprint_po` continua gravando
   * `S1-10-2026` inteiro, e esta função só encurta na hora de desenhar.
   *
   * Guardar `S1-10` seria o defeito de verdade: a primeira sprint de outubro de
   * 2026 e a de 2027 passariam a ser a MESMA string. Qualquer relatório que
   * agrupe por sprint somaria os dois anos numa linha só, e "quanto o time
   * entregou na S1-10" deixaria de ter resposta. É o mesmo tipo de colisão que
   * o campo antigo já tinha com duas grafias ('S1-08-2026' e 'S1-08-26') —
   * duas linhas para a mesma sprint —, só que ao contrário: uma linha para
   * duas sprints, que é pior, porque não dá nem para separar depois.
   *
   * O ANO CONTINUA À MÃO no `title` do chip. Quem precisar dele passa o mouse;
   * quem está varrendo o quadro lê `S1-10` e segue.                          */
  function rotuloCurto(s) {
    var t = txt(s);
    return rotuloValido(t) ? t.slice(0, 5) : t;
  }

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
    /* CINTO ALÉM DO SUSPENSÓRIO. O regex acima já barra mês fora de 1–12, mas
       esta função é exportada e um chamador futuro pode passar qualquer coisa —
       e o preço de não conferir é `toISOString` lançando `RangeError` no meio
       de um render, que derruba a tela inteira em vez de devolver nada. */
    if (!isFinite(ano) || !isFinite(mes) || mes < 1 || mes > 12) return [];
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

  /** A FAIXA DE DATAS DE UMA SPRINT: `{ de, ate }`, ou `null`. */
  function faixaDaSprint(rotulo, feriados) {
    var r = txt(rotulo);
    if (!rotuloValido(r)) return null;
    var achou = null;
    sprintsDoMes(+r.slice(6, 10), +r.slice(3, 5), feriados).forEach(function (s) {
      if (s.rotulo === r) achou = { de: s.de, ate: s.ate };
    });
    return achou;
  }

  /** A SPRINT ANTERIOR A ESTA, atravessando a virada do mês e do ano.
   *
   *  NÃO É `S(n-1)`: a anterior à `S1-01-2027` é a última de dezembro de 2026, e
   *  decrementar o índice daria `S0-01-2027`, que não existe. A conta vai ao
   *  calendário do mês anterior e pega a última sprint dele — que é a única
   *  forma de a comparação "contra a sprint passada" não quebrar duas vezes por
   *  ano. */
  /*  SEM GUARDA DE `rotuloValido` AQUI, e isso é deliberado — leia antes de
   *  "corrigir". Ela existia, e a sabotagem provou que era decoração: removi o
   *  ramo e NENHUMA invariante mudou de resultado.
   *
   *  O motivo é que a proteção de verdade mora em `diasUteisDoMes`, que recusa
   *  mês fora de 1–12 e devolve lista vazia. Qualquer rótulo torto chega lá
   *  pelas duas pontas desta função e sai como `''` de qualquer jeito — com a
   *  vantagem de proteger TODOS os chamadores, e não só este.
   *
   *  Ramo que não altera saída ensina a regra errada a quem lê depois.       */
  function sprintAnterior(rotulo, feriados) {
    var r = txt(rotulo);
    var n = +r.slice(1, 2), mes = +r.slice(3, 5), ano = +r.slice(6, 10);
    if (n > 1) {
      var mesmas = sprintsDoMes(ano, mes, feriados);
      return mesmas[n - 2] ? mesmas[n - 2].rotulo : '';
    }
    var pm = mes === 1 ? 12 : mes - 1;
    var pa = mes === 1 ? ano - 1 : ano;
    var antes = sprintsDoMes(pa, pm, feriados);
    return antes.length ? antes[antes.length - 1].rotulo : '';
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

  /* ═══ A TRILHA: CADA TIME COM A SUA CONTA ═════════════════════════════════
   *
   * "Itens marcados com DADOS/BI deverão ter sua sprint contabilizada a parte.
   *  Da mesma forma criar uma nova marcação para SALES OPS e ao marcar a
   *  contabilização da sprint será a parte."
   *
   * A SPRINT É UMA SÓ — calendário, início e fechamento valem para todos. O que
   * se separa é a CONTA: o placar, o ranking e a lista de risco de cada trilha
   * só enxergam as demandas dela. Por isso a trilha é um RECORTE de quem
   * consulta (`demandasDaSprint(dados, r, trilha)`), e não uma mudança em quem
   * conta: o denominador continua vindo do histórico, como sempre.
   *
   * UMA TRILHA POR DEMANDA. As telas tratam as duas marcas como exclusivas;
   * se uma demanda antiga chegar com as duas, Dados/BI vence, porque é a marca
   * mais antiga e a que o time de Dados já acompanha.                        */
  var TRILHAS = [
    { k: 'tecnologia', nome: 'Tecnologia', icone: '💻' },
    { k: 'dados_bi', nome: 'Dados/BI', icone: '📊' },
    { k: 'sales_ops', nome: 'Sales Ops', icone: '📈' },
  ];

  function trilhaDe(m) {
    if (m && m.dados_bi) return 'dados_bi';
    if (m && m.sales_ops) return 'sales_ops';
    return 'tecnologia';
  }

  /** `trilha` vazia ou ausente = todas, o comportamento de sempre. */
  function daTrilha(m, trilha) {
    var t = txt(trilha);
    return !t || trilhaDe(m) === t;
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

  /** As entradas do histórico que são ENTRADA em sprint.
   *
   *  O histórico também guarda as SAÍDAS — a demanda que o fechamento devolveu
   *  ao backlog entra aqui com `sprint: ''` e o motivo, para a pergunta "por que
   *  ela saiu?" ter resposta no próprio card. Mas sair não é rolar, e contá-la
   *  como pulo faria a devolvida ao backlog aparecer "atrasada 1×" — que é
   *  dizer o contrário do que aconteceu. */
  function entradas(m) {
    return historico(m).filter(function (e) { return txt(e && e.sprint) !== ''; });
  }

  /** QUANTAS VEZES A DEMANDA FOI REPASSADA DEPOIS DA PRIMEIRA. Zero para quem
   *  está na sprint em que entrou. */
  function pulos(m) {
    var n = entradas(m).length;
    return n > 1 ? n - 1 : 0;
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
    var h = entradas(m);
    return h.length ? txt(h[0].sprint) : '';
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ═══ A COR DA SPRINT ══════════════════════════════════════════════════════
   *
   * "Em admin e gantt preciso ter uma diferenciação de itens por sprint."
   *
   * SEIS CORES EM RODÍZIO PELA ORDEM DO CALENDÁRIO, e não uma por S1…S5: com
   * cinco, a S5 de um mês e a S1 do seguinte podiam sair iguais lado a lado; com
   * seis e o índice corrido (ano, mês, semana), duas sprints vizinhas nunca
   * repetem — e o horizonte que o PO olha (a atual e as cinco seguintes) cabe
   * inteiro sem repetir.                                                     */
  var CORES_SPRINT = ['#22C55E', '#3B82F6', '#E8A33D', '#A855F7', '#EC4899', '#14B8A6'];

  function corDaSprint(rotulo) {
    var r = txt(rotulo);
    if (!rotuloValido(r)) return '';
    var i = ((+r.slice(6, 10)) * 12 + (+r.slice(3, 5))) * 5 + (+r.slice(1, 2));
    return CORES_SPRINT[i % CORES_SPRINT.length];
  }

  /** O `style` que pinta o card com a cor da sprint dele (`--sp-cor`). */
  function estiloSprint(m) {
    var c = corDaSprint(doPO(m));
    return c ? '--sp-cor:' + c + ';' : '';
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
      /* "FORA DA SPRINT", E NÃO "BACKLOG". A primeira versão escrevia Backlog,
         e isso só apareceu olhando o quadro montado: BACKLOG é o nome de uma
         COLUNA nas duas telas, e um card em "Em Andamento" com um chip escrito
         "Backlog" se lê como "este card está na coluna errada". O caso é comum
         e vai ficar mais: demanda de Sustentação começa sem sprint nenhuma
         (ver `travaDeAlocacao`), então ela vive em Em Andamento com este chip.
         O chip responde "em que sprint está?", e a resposta é "em nenhuma". */
      return '<span class="' + cls + ' sp-fora" title="Fora da sprint — o PM/PO ' +
             'ainda não a repassou para nenhuma semana.">📋 Fora da sprint</span>';
    }
    /* CURTO NO CHIP, INTEIRO NO `title`. O quadro se lê de relance e o ano é a
       parte que nunca muda entre dois cards; no `title` ele volta, porque é lá
       que alguém vai conferir de qual outubro se está falando. */
    var curto = rotuloCurto(s);
    var n = pulos(m);
    if (!n) {
      return '<span class="' + cls + ' sp-cor" style="' + estiloSprint(m) + '" title="Sprint ' + esc(s) +
             (txt((m || {}).sprint_po_por) ? ', repassada por ' + esc(m.sprint_po_por) : '') +
             '.">🏃 ' + esc(curto) + '</span>';
    }
    return '<span class="' + cls + ' sp-atrasada sp-cor" style="' + estiloSprint(m) + '" title="Sprint ' + esc(s) +
           ' — ENTROU ATRASADA: veio de ' + esc(sprintDeOrigem(m)) + ' e já rolou ' +
           n + (n === 1 ? ' sprint' : ' sprints') + '.">🏃 ' + esc(curto) +
           ' · atrasada ' + n + '×</span>';
  }

  /* ═══ A TRAVA DE ALOCAÇÃO — começar exige estar na sprint ═════════════════
   *
   * "Dentro da sprint apenas demandas que o PM/PO repassar."
   *
   * METADE DISSO JÁ ESTAVA FEITA, e vale separar porque muda o tamanho da
   * regra que falta:
   *
   *   pôr demanda numa sprint      → já travado (`travaSprintDoPO`, no Worker)
   *   mover para Planning/Planejado → já travado (`travaEtapaDoDev`)
   *   COMEÇAR o que o PO não liberou → é o que esta trava fecha
   *
   * É UMA TRANSIÇÃO SÓ: a entrada em `em_andamento`. Entregar nunca trava —
   * se o dev já está no trabalho, impedir a entrega deixa o trabalho preso sem
   * ninguém ganhar nada. E demanda que JÁ ESTÁ em andamento nunca é
   * reexaminada: a trava olha o movimento, e não o estado. Medido na base (158
   * vivas): 18 estão em andamento e NENHUMA tem sprint do PO — reexaminar o
   * estado congelaria as 18 no dia em que a regra subisse.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * SUSTENTAÇÃO PASSA, EVOLUÇÃO NÃO — decisão do Fernando.
   *
   * É a porta para o caso que toda trava de alocação encontra: bug em produção
   * às 2h, com o PM/PO dormindo. Sustentação começa sozinha; evolução espera.
   *
   * SEM TIPO CONTA COMO EVOLUÇÃO, e isso importa mais do que parece: 117 das
   * 158 demandas vivas não têm tipo nenhum (e 39 das 70 abertas). A porta só
   * abre para quem foi classificado — e é justamente por isso que ela não vira
   * um caminho de fuga largo. Quem precisa dela às 2h abre a demanda do
   * incidente escolhendo Sustentação, que é como um incidente nasce de verdade.
   *
   * E O TIPO PRECISOU DE TRAVA PRÓPRIA no Worker, senão esta aqui seria
   * decoração: o `dev-publish` recebe o estado inteiro montado no navegador, e
   * trocar `evolucao` por `sustentacao` no caminho abriria a porta de dentro.
   * É o mesmo buraco que as datas tinham antes de `travaDatasComprometidas`.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * DATADA, como as outras regras de novembro. Antes de 01/11 ela não existe —
   * e o PM/PO passa o backlog para as sprints antes disso (há repasse em lote
   * no Admin justamente para esse dia, e para os seguintes).               */
  var TRAVA_DESDE = '2026-11-01';

  /* ═══ REVISTO EM 29/10: "SPRINT DEVE SER OBRIGATÓRIA SEMPRE APÓS A PLANNING" ═
   *
   * Decisão do Fernando, e ela SUBSTITUI as duas acima:
   *
   *   - a porta da Sustentação FECHA. "Vale para todos": no incidente das 2h o
   *     PM/PO (ou um admin) põe a demanda na sprint atual com um clique antes de
   *     começar — o seletor oferece a atual em primeiro lugar.
   *   - a trava deixa de guardar só `em_andamento` e passa a guardar TODA etapa
   *     depois da Planning. Planejado é onde o PO aloca a semana; entrar ali sem
   *     sprint é exatamente o "planejado para quando?" que a regra existe para
   *     não deixar acontecer.
   *
   * CONTINUA SENDO MOVIMENTO, e não estado — também decisão dele. Quem já está
   * depois da Planning sem sprint segue andando: entregar, devolver à área,
   * concluir. O que trava é ATRAVESSAR a Planning sem sprint. Por isso o caso
   * "entregar nunca trava" continua valendo: entregar parte de `em_andamento`,
   * que já está do lado de cá.
   *
   * `TIPOS_LIVRES` fica, vazia, porque o Worker repete a lista e há invariante
   * conferindo as duas cópias: apagar daqui e esquecer lá abriria a porta só no
   * servidor. */
  var TIPOS_LIVRES = [];

  function tipoLivre(m) {
    return TIPOS_LIVRES.indexOf(txt((m || {}).tipo).toLowerCase()) >= 0;
  }

  /** AS ETAPAS DEPOIS DA PLANNING — o lado da fronteira que exige sprint.
   *  `atrasado` entra porque é uma etapa de trabalho em curso, e sair da
   *  Planning direto para ela seria o mesmo atalho por outro nome. */
  var ETAPAS_POS_PLANNING = ['planejado', 'em_andamento', 'validacao_area',
                             'validacao', 'concluido', 'atrasado'];

  function posPlanning(etapa) { return ETAPAS_POS_PLANNING.indexOf(txt(etapa)) >= 0; }

  /** Mantida pelo nome: era a única etapa guardada, e quem lê o código antigo
   *  procura por ela. A regra agora consulta `ETAPAS_POS_PLANNING`. */
  var ETAPA_TRAVADA = 'em_andamento';

  /** A TRAVA PEGOU ESTE MOVIMENTO?
   *
   *  Devolve `{ trava, motivo }`. `trava: false` é o caminho normal — a função
   *  é chamada em TODA gravação do painel do dev, e o caso comum é passar.     */
  function travaDeAlocacao(m, etapaAntes, etapaDepois, hoje) {
    var dia = iso(hoje) || new Date().toISOString().slice(0, 10);
    if (dia < TRAVA_DESDE) return { trava: false };
    if (!posPlanning(etapaDepois)) return { trava: false };
    /* DUAS FRONTEIRAS, e as duas são movimento:
         ATRAVESSAR a Planning sem sprint (a regra de 29/10), e
         COMEÇAR sem sprint (a regra original, que continua valendo).
       Só a primeira deixaria passar quem já estava em Planejado sem sprint
       antes da regra — e começar sem sprint é justamente o que a trava nasceu
       para impedir. Quem já está em andamento não é reexaminado. */
    var cruza = !posPlanning(etapaAntes);
    var comeca = txt(etapaDepois) === ETAPA_TRAVADA && txt(etapaAntes) !== ETAPA_TRAVADA;
    if (!cruza && !comeca) return { trava: false };
    if (tipoLivre(m)) return { trava: false };
    if (doPO(m)) return { trava: false };
    return {
      trava: true,
      motivo: 'Depois da Planning a demanda precisa estar numa sprint, e esta não ' +
              'está em nenhuma. Quem escolhe a sprint é o PM/PO — escolha (ou peça) ' +
              'a sprint antes de mover.',
    };
  }

  /** A SPRINT ATUAL E AS `n` SEGUINTES, atravessando mês e ano.
   *
   *  "Dando sempre a atual + 5 à frente." É a lista do seletor do PM/PO. As que
   *  já passaram neste mês não entram: repassar para uma semana encerrada é
   *  registrar um compromisso que não existiu. Fechadas saem — quem chama passa
   *  `fechadas` (rótulos), porque o módulo não lê a base sozinho. */
  function proximasSprints(hoje, n, feriados, fechadas) {
    var dia = iso(hoje) || new Date().toISOString().slice(0, 10);
    var fora = fechadas || [];
    var ano = +dia.slice(0, 4), mes = +dia.slice(5, 7);
    var agora = rotuloDeData(dia, feriados);
    var lista = [], viuAgora = false;
    for (var k = 0; k < 4 && lista.length < (n || 0) + 1; k++) {
      sprintsDoMes(ano, mes, feriados).forEach(function (s) {
        if (s.rotulo === agora) viuAgora = true;
        if (!viuAgora || lista.length >= (n || 0) + 1) return;
        if (fora.indexOf(s.rotulo) >= 0) return;
        lista.push({ rotulo: s.rotulo, de: s.de, ate: s.ate, dias: s.dias,
                     agora: s.rotulo === agora });
      });
      if (mes === 12) { mes = 1; ano += 1; } else { mes += 1; }
    }
    return lista;
  }

  /** Quem pode repassar uma demanda para a sprint.
   *
   *  PELO PAPEL, e nunca pelo nome. É a mesma trava do Validado em Comitê, e ela
   *  existe porque há dois Guilhermes no time: autorizar por nome dá o poder a
   *  quem só tem o nome parecido. */
  function podeRepassar(papel) { return txt(papel) === 'admin'; }

  /* ═══ O FECHAMENTO DA SPRINT ══════════════════════════════════════════════
   *
   * Abrir uma sprint não é um ato: `S2-11` existe porque a semana existe. Encher
   * é que é o ato, e ele já tem dois gestos (o chip e o lote). FECHAR é o ato
   * que faltava, e ele tem consequência — por isso tem registro.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * O QUE FICA GUARDADO, E O QUE NÃO FICA.
   *
   * Guarda-se o ATO: quem fechou, quando, e o destino e o motivo de cada
   * demanda que não entregou.
   *
   * NÃO SE GUARDA O PLACAR. A tentação é carimbar "6 entregues, 89 pontos" e
   * acabou — e isso estaria errado por construção: pela regra retroativa de
   * novembro, uma demanda entregue na quinta e aprovada pelo PM/PO na terça
   * seguinte entra nos pontos DESTA sprint depois de ela fechada. O número
   * continua assentando, e um carimbo o congelaria numa foto que já nasce
   * desatualizada. O placar é DERIVADO, sempre (ver `capacidade.js`).
   *
   * ───────────────────────────────────────────────────────────────────────────
   * FECHADA É FECHADA — decisão do Fernando: "não entra nem sai mais".
   *
   * `repassar` e `retirar` passam a recusar, e o Worker recusa junto. Não há
   * reabertura: o botão foi oferecido e recusado, e a ausência dele é o que faz
   * o número apresentado na sexta continuar o mesmo na segunda.
   *
   * O PREÇO ESTÁ DITO: fechar por engano não tem volta pela tela. Por isso o
   * fechamento é um diálogo com a lista inteira à vista, e não um botão solto.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * O MOTIVO É POR DEMANDA — também decisão dele.
   *
   * Um texto para a sprint inteira vira "semana curta" e não responde a
   * pergunta do comitê, que é sobre UMA demanda: "por que a AX-301 ficou para a
   * semana seguinte?". O motivo entra no `sprint_po_historico`, junto do pulo
   * que ele explica.                                                         */
  var MIN_MOTIVO_CARRY = 8;

  /* ═══ O CICLO DA SPRINT: MONTANDO → EM CURSO → FECHADA ════════════════════
   *
   * "Em adm a etapa Planejado servirá para eu alocar as demandas selecionando a
   *  sprint que ela fará parte. QUANDO EU INICIAR A SPRINT as demandas ficarão
   *  disponíveis para o time."
   *
   * EU TINHA DITO QUE ABRIR NÃO ERA ATO, e estava errado. A sprint existe no
   * calendário, sim — mas ENCHER e DISPONIBILIZAR são dois momentos, e separá-
   * los é o que permite montar a semana com calma sem o time ver a montagem
   * mudando de forma debaixo dele. O PO aloca em Planejado, confere, e só então
   * inicia.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * UM REGISTRO POR SPRINT, com os dois carimbos — e isto PRECISOU de cuidado.
   *
   * `dados.sprints` já existia e guardava só fechamentos; `estaFechada` era
   * "existe entrada para esta sprint". Acrescentar uma entrada no INÍCIO faria
   * toda sprint iniciada ser lida como FECHADA, e a trava do fechamento
   * barraria a semana inteira no dia em que ela começasse.
   *
   * Então a pergunta deixou de ser "existe entrada?" e passou a ser "a entrada
   * tem o carimbo de fechamento (`em`)?". O Worker foi corrigido junto, e há
   * invariante medindo os dois lados.
   *
   * MONTANDO é o estado SEM registro nenhum, e é onde está toda a base hoje —
   * nenhuma migração, e nada aparece para o time antes de alguém decidir.   */

  /** O registro da sprint: `{ rotulo, iniciada_em, iniciada_por, em, por, carry }`.
   *  `null` enquanto ninguém iniciou nem fechou. */
  function registros(dados) {
    var f = (dados || {}).sprints;
    return Array.isArray(f) ? f.filter(Boolean) : [];
  }

  function registroDe(dados, rotulo) {
    var s = txt(rotulo);
    var achou = null;
    registros(dados).forEach(function (f) { if (txt(f.rotulo) === s) achou = f; });
    return achou;
  }

  /* `fechamentos`/`fechamentoDe` continuam, com o sentido ESTRITO: só o que
     tem carimbo de fechamento. Quem perguntava por eles queria isso. */
  function fechamentos(dados) {
    return registros(dados).filter(function (f) { return !!iso(f.em); });
  }

  function fechamentoDe(dados, rotulo) {
    var r = registroDe(dados, rotulo);
    return (r && iso(r.em)) ? r : null;
  }

  function estaFechada(dados, rotulo) { return !!fechamentoDe(dados, rotulo); }

  /** A SPRINT JÁ FOI INICIADA? É isto que libera as demandas para o time.
   *  Fechada conta como iniciada: ela correu e acabou. */
  function estaIniciada(dados, rotulo) {
    var r = registroDe(dados, rotulo);
    return !!(r && (iso(r.iniciada_em) || iso(r.em)));
  }

  /** `montando` | `em_curso` | `fechada`. */
  function situacaoDaSprint(dados, rotulo) {
    if (estaFechada(dados, rotulo)) return 'fechada';
    if (estaIniciada(dados, rotulo)) return 'em_curso';
    return 'montando';
  }

  /* ═══ AS VENCIDAS ENTRAM COMO PRIORITÁRIAS ═════════════════════════════════
   *
   * "Ao dar início, itens já alocados vencidos entrarão no backlog da sprint
   *  como prioritários."
   *
   * QUEM ENTRA: tem dev, já passou da Planning, ainda não foi entregue (nem
   * validação, nem concluída) e o prazo venceu — a mesma regra de atraso das
   * telas (`PRAZO.estaAtrasada`), injetada para não existir uma segunda.
   * Demanda que já está numa sprint POSTERIOR a esta fica onde está: alguém a
   * empurrou para a frente de propósito.
   *
   * ENTRAR É `repassar`, nunca escrever o campo: é ele que grava a linha do
   * histórico (o denominador do placar), conta o pulo ("entrou atrasada") e
   * recusa sprint fechada — o mesmo motivo de `fechar` usá-lo no carry-over.
   *
   * PRIORITÁRIA É A PRIORIDADE ALTA, e não uma posição nova no quadro. A ordem
   * das três telas é por prioridade (`ordem-kanban.js`) e o atraso é destaque,
   * não posição; subir a prioridade no ato de iniciar respeita as duas regras.
   * A prioridade de antes fica guardada em `sprint_prioritaria`, com a sprint,
   * para o card dizer por que subiu.                                         */
  var ETAPAS_VENCIVEIS = ['planejado', 'em_andamento', 'atrasado'];

  function vencidasParaPriorizar(dados, rotulo, hoje, opts) {
    var r = txt(rotulo);
    var o = opts || {};
    // Só a regra que o chamador passou: puxar com uma regra adivinhada mexe
    // na prioridade de quem não devia.
    var P = o.prazo;
    var etapaDe = o.etapaDe;
    var dia = iso(hoje) || new Date().toISOString().slice(0, 10);
    if (!P || typeof P.estaAtrasada !== 'function') return [];
    return ((dados || {}).melhorias || []).filter(function (m) {
      if (!m || m.oculto || m.mesclado_em || !txt(m.dev)) return false;
      var e = etapaDe ? etapaDe(m) : txt(m.status_planejamento);
      if (ETAPAS_VENCIVEIS.indexOf(e) < 0) return false;
      if (!P.estaAtrasada(m, e, dia)) return false;
      var s = doPO(m);
      return !s || s === r || chaveOrdem(s) < chaveOrdem(r);
    });
  }

  /* ═══ AS PAUSADAS TRANSBORDAM ══════════════════════════════════════════════
   *
   * "Na virada tudo que estiver pausado deverá ser transbordado para nova
   *  sprint também (principalmente nessa primeira virada)."
   *
   * QUEM ENTRA: pausada (`pausado_em`) que ainda não foi entregue — nem
   * validação, nem concluída, nem negada —, em qualquer etapa, com ou sem dev.
   * Não muda a prioridade (isso é das vencidas) nem tira a pausa: ela entra na
   * sprint para não sumir do compromisso da semana enquanto espera o terceiro.
   * Mesma regra das vencidas para sprint POSTERIOR: fica onde está.         */
  var ETAPAS_ENTREGUES = ['concluido', 'negada', 'validacao', 'validacao_area'];

  function pausadasParaTransbordar(dados, rotulo, opts) {
    var r = txt(rotulo);
    var etapaDe = (opts || {}).etapaDe;
    return ((dados || {}).melhorias || []).filter(function (m) {
      if (!m || m.oculto || m.mesclado_em || !txt(m.pausado_em)) return false;
      var e = etapaDe ? etapaDe(m) : txt(m.status_planejamento);
      if (ETAPAS_ENTREGUES.indexOf(e) >= 0) return false;
      var s = doPO(m);
      return s !== r && (!s || chaveOrdem(s) < chaveOrdem(r));
    });
  }

  function ehPrioritariaDaSprint(m, rotulo) {
    var p = (m || {}).sprint_prioritaria;
    return !!(p && txt(p.sprint) && (!rotulo || txt(p.sprint) === txt(rotulo)));
  }

  /** O PM/PO INICIA a sprint: daqui em diante o time a enxerga.
   *
   *  `opts`: `{ prazo, etapaDe }` para puxar as vencidas (ver acima). Sem
   *  `prazo` disponível nada é puxado — melhor não puxar do que puxar errado.
   *  O retorno ganha `prioritarias` (códigos); `demandas` e `semDev` passam a
   *  contar a sprint JÁ com as puxadas, que é o que o time vai ver. */
  function iniciar(dados, rotulo, quem, hoje, opts) {
    var r = txt(rotulo);
    if (!rotuloValido(r)) return { ok: false, erro: 'Sprint inválida.' };
    if (estaFechada(dados, r)) {
      return { ok: false, erro: 'A sprint ' + rotuloCurto(r) + ' já foi fechada.' };
    }
    if (estaIniciada(dados, r)) {
      return { ok: false, erro: 'A sprint ' + rotuloCurto(r) + ' já está em curso.' };
    }
    var dia = iso(hoje);
    var puxadas = [];
    vencidasParaPriorizar(dados, r, hoje, opts).forEach(function (m) {
      if (doPO(m) !== r) {
        var rp = repassar(m, r, quem, hoje, { dados: dados });
        if (!rp.ok) return;              // em sprint fechada: fica onde está
      }
      m.sprint_prioritaria = { sprint: r, em: dia, por: txt(quem),
                               prioridade_antes: txt(m.prioridade) };
      m.prioridade = 'alta';
      puxadas.push(m.codigo || m.id);
    });
    // As pausadas depois das vencidas: uma que já entrou acima não repete.
    var transbordadas = [];
    pausadasParaTransbordar(dados, r, opts).forEach(function (m) {
      if (doPO(m) === r) return;
      var rp = repassar(m, r, quem, hoje, { dados: dados });
      if (rp.ok) transbordadas.push(m.codigo || m.id);
    });
    if (!Array.isArray(dados.sprints)) dados.sprints = [];
    var reg = registroDe(dados, r);
    if (!reg) { reg = { rotulo: r }; dados.sprints.push(reg); }
    reg.iniciada_em = dia;
    reg.iniciada_por = txt(quem);
    if (puxadas.length) reg.prioritarias = puxadas.slice();
    if (transbordadas.length) reg.pausadas = transbordadas.slice();
    var dem = demandasDaSprint(dados, r);
    return { ok: true, demandas: dem.length,
             semDev: dem.filter(function (m) { return !txt(m.dev); }).length,
             prioritarias: puxadas, pausadas: transbordadas };
  }

  /** Os rótulos fechados, para quem só precisa da lista. */
  function rotulosFechados(dados) {
    return fechamentos(dados).map(function (f) { return txt(f.rotulo); }).filter(Boolean);
  }

  /* ═══ O QUE O TIME VÊ ══════════════════════════════════════════════════════
   *
   * "Quando eu iniciar a sprint as demandas ficarão disponíveis para o time, o
   *  que não estiver com nome alocado ficará disponível no backlog dos devs."
   *
   * DUAS REGRAS, e elas respondem perguntas diferentes:
   *
   * `escondidaDoTime`  a demanda está numa sprint que o PO ainda MONTA. Ela
   *                    some do painel do dev até a sprint começar — é o ponto
   *                    inteiro de separar montar de iniciar.
   *
   * `naPoolDoTime`     a demanda está numa sprint EM CURSO e sem dono. Ela
   *                    aparece para TODO MUNDO, e não só para quem tem o nome
   *                    nela: é trabalho combinado que ainda não foi pego.
   *
   * FORA DE SPRINT NUNCA SE ESCONDE. Sustentação começa sem sprint (ver
   * `travaDeAlocacao`), e o backlog do dev é o lugar dela — esconder o que não
   * está em sprint nenhuma apagaria metade do painel.                       */
  function escondidaDoTime(dados, m) {
    var s = doPO(m);
    if (!s) return false;
    if (naVitrine(m)) return false;
    /* COM DEV, NUNCA SE ESCONDE (30/10/2026). "AX-1151 não está visível para
       Marina. Sprint eu preciso enxergar as atuais e as que vão entrar na
       S1-11, não mude o comportamento." A demanda dela estava em Planejado na
       S1-11, ainda montando, com prazo para hoje — e sumiu do painel de quem
       tinha de entregá-la. Esconder a MONTAGEM vale para o que não tem dono;
       o trabalho já alocado a alguém aparece para essa pessoa, com o chip da
       sprint dizendo para qual semana vai. Iniciar continua sendo o que leva
       o sem-dono ao backlog do time (`naPoolDoTime`).
       É TRANSIÇÃO, COM DATA DE FIM: "após o fechamento da S1-11 essa regra de
       visualização vem à tona". Fechada a S1-11, a montagem volta a esconder
       também o que tem dev — sem ninguém precisar lembrar de desligar nada. */
    if (txt((m || {}).dev) && !estaFechada(dados, VISAO_PLENA_ATE)) return false;
    return situacaoDaSprint(dados, s) === 'montando';
  }

  /* ═══ A VITRINE: O BACKLOG DA SPRINT À VISTA ═══════════════════════════════
   *
   * "Necessito visualizar backlog da sprint para eu poder direcionar. Poderá
   *  ser visível p/ time, quando em backlog, porém marcado a sprint."
   *
   * A demanda que tem sprint marcada e AINDA ESTÁ ANTES DE PLANEJADO (backlog,
   * levantar requisito, planning) aparece para o time inteiro, com o chip da
   * sprint — mesmo com a sprint em montagem. É vitrine, não compromisso: o que
   * o PO alocou em Planejado continua escondido até ele iniciar, que é o ponto
   * de separar montar de iniciar.                                           */
  var ETAPAS_VITRINE = ['backlog', 'levantar_req', 'planning'];
  /** Até esta sprint FECHAR, o que tem dev não se esconde na montagem. */
  var VISAO_PLENA_ATE = 'S1-11-2026';

  function naVitrine(m, etapa) {
    if (!doPO(m)) return false;
    var e = txt(etapa != null ? etapa : (m || {}).status_planejamento);
    return ETAPAS_VITRINE.indexOf(e) >= 0;
  }

  /** PLANEJADO NA SPRINT NÃO EXIGE DEV.
   *
   *  "Nesse último caso, o dev não pode ser obrigatório." A demanda em
   *  Planejado com sprint marcada é trabalho combinado para a semana que
   *  ainda não tem dono — vai para o backlog do time quando a sprint começar
   *  (`naPoolDoTime`). Exigir o dev aqui obrigaria o PO a inventar um dono.
   *  De Em andamento em diante o dev continua obrigatório: ali alguém já pegou. */
  function dispensaDev(etapa, sprint) {
    return txt(etapa) === 'planejado' && rotuloValido(sprint);
  }

  /* ═══ A CAPACIDADE DA SPRINT, POR FRENTE ═══════════════════════════════════
   *
   * "Faça um cálculo para cada divisão de times (cada dev recebe 30 pontos),
   *  multiplique pela quantidade de pessoas para ter noção da capacidade da
   *  sprint. Isso irá sugerir alocar demandas para a próxima sprint."
   *
   * A DIVISÃO É A FRENTE (`pipelines.js`): é o cadastro que diz de que time
   * cada pessoa é, e a demanda herda a frente de quem a faz — ou da marca
   * Dados/BI. Tudo entra injetado (`frenteDoDev`, `frenteDe`), para não
   * existir uma segunda definição de "de que time é".
   *
   * O ALOCADO é a soma dos pontos do poker das demandas que estão NESTA sprint
   * (`sprint_po`), com o ponto de dupla repartido entre as frentes das duas
   * pessoas — a mesma regra do ranking. Negada não ocupa capacidade.
   *
   * A SUGESTÃO só olha o que ainda não começou (backlog até planejado) e tira
   * do FIM da ordem do quadro (`compara`, de `ordem-kanban.js`): prioridade
   * mais baixa e prazo mais longe saem primeiro, até caber.                 */
  var PONTOS_POR_DEV = 30;
  var ETAPAS_MOVIVEIS = ['backlog', 'levantar_req', 'planning', 'planejado'];

  function capacidadeDaSprint(dados, rotulo, o) {
    var r = txt(rotulo);
    var opt = o || {};
    var porDev = Number(opt.pontosPorDev) > 0 ? Number(opt.pontosPorDev) : PONTOS_POR_DEV;
    var etapaDe = opt.etapaDe;
    var fDev = opt.frenteDoDev || function () { return ''; };
    var fDem = opt.frenteDe || function () { return ''; };
    var SEM = opt.semFrente || 'Desenvolvimento';
    var eq = {};
    var pega = function (f) {
      var k = f || SEM;
      if (!eq[k]) eq[k] = { frente: k, pessoas: [], capacidade: 0, alocado: 0, itens: [] };
      return eq[k];
    };
    (opt.devs || []).forEach(function (nome) {
      var e = pega(fDev(nome));
      if (e.pessoas.indexOf(nome) < 0) { e.pessoas.push(nome); e.capacidade += porDev; }
    });
    ((dados || {}).melhorias || []).forEach(function (m) {
      if (!m || m.oculto || m.mesclado_em || !naSprint(m, r)) return;
      var et = etapaDe ? etapaDe(m) : txt(m.status_planejamento);
      if (et === 'negada') return;
      var pts = pontosDe(m);
      var nomes = txt(m.dev).split('/').map(function (x) { return x.trim(); }).filter(Boolean);
      var partes = nomes.length
        ? nomes.map(function (n) { return fDev(n) || fDem(m); })
        : [fDem(m)];
      partes.forEach(function (f) {
        var e = pega(f);
        e.alocado += pts / partes.length;
        if (e.itens.indexOf(m) < 0) e.itens.push(m);
      });
    });
    var ordem = opt.compara || function (a, b) { return pontosDe(a) - pontosDe(b); };
    return Object.keys(eq).map(function (k) {
      var e = eq[k];
      e.alocado = Math.round(e.alocado * 10) / 10;
      e.saldo = Math.round((e.capacidade - e.alocado) * 10) / 10;
      e.pct = e.capacidade ? Math.round(e.alocado / e.capacidade * 100) : null;
      e.semPontos = e.itens.filter(function (m) { return !pontosDe(m); }).length;
      e.sugeridas = [];
      if (e.capacidade && e.alocado > e.capacidade) {
        var falta = e.alocado - e.capacidade;
        var moviveis = e.itens.filter(function (m) {
          var et = etapaDe ? etapaDe(m) : txt(m.status_planejamento);
          return ETAPAS_MOVIVEIS.indexOf(et) >= 0 && pontosDe(m) > 0 &&
                 !ehPrioritariaDaSprint(m, r);
        }).slice().sort(ordem).reverse();
        for (var i = 0; i < moviveis.length && falta > 0; i++) {
          e.sugeridas.push(moviveis[i]);
          falta -= pontosDe(moviveis[i]);
        }
      }
      return e;
    }).sort(function (a, b) {
      if ((a.frente === SEM) !== (b.frente === SEM)) return a.frente === SEM ? -1 : 1;   // a frente geral primeiro
      return a.frente.localeCompare(b.frente, 'pt-BR');
    });
  }

  /* ═══ A CAPACIDADE POR TRILHA, COM DESENVOLVIMENTO ABERTO POR FRENTE ════════
   *
   * "Preciso ter por Desenvolvimento (engloba geral), Dados/BI e Sales apenas.
   *  Em Desenvolvimento eu terei a quebra (Automação e RPA, IA...)."
   *
   * TRÊS GRUPOS, OS MESMOS DA CONTA DA SPRINT (`TRILHAS`): a demanda cai pelo
   * que ela É (`trilhaDe`: marca Dados/BI, marca Sales Ops, ou nenhuma =
   * Desenvolvimento); a pessoa cai pela frente do cadastro (`frenteDoDev`) —
   * a de Dados no grupo Dados/BI, a de Sales no Sales Ops, todas as outras no
   * Desenvolvimento. Dentro de Desenvolvimento, as linhas são as frentes de
   * quem faz (a demanda sem dev entra em "sem frente").
   *
   * A SUGESTÃO É DO GRUPO, e não da frente: é o grupo que tem capacidade
   * combinada, e mover entre frentes do mesmo grupo não libera nada.         */
  function capacidadePorTrilha(dados, rotulo, o) {
    var r = txt(rotulo);
    var opt = o || {};
    var porDev = Number(opt.pontosPorDev) > 0 ? Number(opt.pontosPorDev) : PONTOS_POR_DEV;
    var etapaDe = opt.etapaDe;
    var fDev = opt.frenteDoDev || function () { return ''; };
    var DADOS = txt(opt.frenteDados), SALES = txt(opt.frenteSales);
    var SEM = opt.semFrente || 'Desenvolvimento';
    var grupoDaPessoa = function (n) {
      var f = fDev(n);
      return f && f === DADOS ? 'dados_bi' : f && f === SALES ? 'sales_ops' : 'tecnologia';
    };
    var grupos = {};
    TRILHAS.forEach(function (t) {
      grupos[t.k] = { k: t.k, nome: t.k === 'tecnologia' ? 'Desenvolvimento' : t.nome, icone: t.icone,
                      pessoas: [], capacidade: 0, alocado: 0, itens: [], frentes: {} };
    });
    var frente = function (g, nome) {
      var k = nome || SEM;
      if (!g.frentes[k]) g.frentes[k] = { frente: k, pessoas: [], capacidade: 0, alocado: 0, itens: [] };
      return g.frentes[k];
    };
    (opt.devs || []).forEach(function (n) {
      var g = grupos[grupoDaPessoa(n)];
      if (g.pessoas.indexOf(n) >= 0) return;
      g.pessoas.push(n); g.capacidade += porDev;
      if (g.k === 'tecnologia') { var f = frente(g, fDev(n)); f.pessoas.push(n); f.capacidade += porDev; }
    });
    ((dados || {}).melhorias || []).forEach(function (m) {
      if (!m || m.oculto || m.mesclado_em || !naSprint(m, r)) return;
      var et = etapaDe ? etapaDe(m) : txt(m.status_planejamento);
      if (et === 'negada') return;
      var g = grupos[trilhaDe(m)];
      var pts = pontosDe(m);
      g.alocado += pts; g.itens.push(m);
      if (g.k !== 'tecnologia') return;
      var nomes = txt(m.dev).split('/').map(function (x) { return x.trim(); }).filter(Boolean);
      var fs = nomes.length ? nomes.map(function (n) { return fDev(n); }) : [''];
      fs.forEach(function (fn) {
        var f = frente(g, fn);
        f.alocado += pts / fs.length;
        if (f.itens.indexOf(m) < 0) f.itens.push(m);
      });
    });
    var ordem = opt.compara || function (a, b) { return pontosDe(a) - pontosDe(b); };
    var fecha = function (e) {
      e.alocado = Math.round(e.alocado * 10) / 10;
      e.saldo = Math.round((e.capacidade - e.alocado) * 10) / 10;
      e.pct = e.capacidade ? Math.round(e.alocado / e.capacidade * 100) : null;
      e.semPontos = e.itens.filter(function (m) { return !pontosDe(m); }).length;
      return e;
    };
    return TRILHAS.map(function (t) {
      var g = fecha(grupos[t.k]);
      g.sugeridas = [];
      if (g.capacidade && g.alocado > g.capacidade) {
        var falta = g.alocado - g.capacidade;
        var moviveis = g.itens.filter(function (m) {
          var et = etapaDe ? etapaDe(m) : txt(m.status_planejamento);
          return ETAPAS_MOVIVEIS.indexOf(et) >= 0 && pontosDe(m) > 0 && !ehPrioritariaDaSprint(m, r);
        }).slice().sort(ordem).reverse();
        for (var i = 0; i < moviveis.length && falta > 0; i++) {
          g.sugeridas.push(moviveis[i]);
          falta -= pontosDe(moviveis[i]);
        }
      }
      g.frentes = Object.keys(g.frentes).map(function (k) { return fecha(g.frentes[k]); })
        .sort(function (a, b) {
          if ((a.frente === SEM) !== (b.frente === SEM)) return a.frente === SEM ? -1 : 1;   // a frente geral primeiro
          return a.frente.localeCompare(b.frente, 'pt-BR');
        });
      return g;
    });
  }

  /* ═══ A SPRINT PELA DATA DO USUÁRIO ════════════════════════════════════════
   *
   * "Sempre vou pôr a data do usuário após o fechamento da sprint, ou seja,
   *  tudo que for datado na segunda, a demanda faz parte da sprint da semana
   *  anterior (seg a sexta — entrega próxima segunda)."
   *
   * A DATA DO USUÁRIO É O DIA SEGUINTE AO FIM DO TRABALHO. A sprint dela é a
   * do DIA ÚTIL ANTERIOR: segunda → sexta da semana passada; terça a sexta →
   * a própria semana. Feriado e fim de semana são pulados — a segunda depois de
   * uma sexta de feriado volta para a quinta.                               */
  function sprintDaEntrega(dataUsuario, feriados) {
    var s = iso(dataUsuario);
    if (!s) return '';
    var fer = {};
    (feriados || []).forEach(function (f) {
      fer[iso(f && typeof f === 'object' ? f.data : f)] = true;
    });
    var d = new Date(s + 'T12:00:00Z');
    for (var i = 0; i < 15; i++) {
      d.setUTCDate(d.getUTCDate() - 1);
      var dow = d.getUTCDay();
      var dia = d.toISOString().slice(0, 10);
      if (dow !== 0 && dow !== 6 && !fer[dia]) return rotuloDeData(dia, feriados);
    }
    return '';
  }

  /** A sprint seguinte a esta, pelo calendário — para onde vai a sugestão. */
  function sprintSeguinte(rotulo, feriados) {
    var r = txt(rotulo);
    if (!rotuloValido(r)) return '';
    var faixa = faixaDaSprint(r, feriados);
    if (!faixa) return '';
    var d = new Date(faixa.ate + 'T12:00:00');
    for (var i = 0; i < 10; i++) {
      d.setDate(d.getDate() + 1);
      var s = rotuloDeData(d.toISOString().slice(0, 10), feriados);
      if (s && s !== r) return s;
    }
    return '';
  }

  /** O BACKLOG DA SPRINT para o PO direcionar: o que está nela e ainda não
   *  começou, agrupado por dev ("" = sem dev). Prioritárias primeiro. */
  function backlogDaSprint(dados, rotulo, etapaDe, trilha) {
    var r = txt(rotulo);
    var grupos = {};
    ((dados || {}).melhorias || []).forEach(function (m) {
      if (!m || m.oculto || m.mesclado_em || !naSprint(m, r) || !daTrilha(m, trilha)) return;
      var e = etapaDe ? etapaDe(m) : txt(m.status_planejamento);
      if (ETAPAS_VITRINE.indexOf(e) < 0 && e !== 'planejado') return;
      var k = txt(m.dev);
      (grupos[k] = grupos[k] || []).push({ m: m, etapa: e,
                                           prioritaria: ehPrioritariaDaSprint(m, r) });
    });
    return Object.keys(grupos).sort(function (a, b) {
      if (!a !== !b) return a ? 1 : -1;          // sem dev primeiro: é o que direcionar
      return a.localeCompare(b, 'pt-BR');
    }).map(function (k) {
      return { dev: k, itens: grupos[k].sort(function (x, y) {
        if (x.prioritaria !== y.prioritaria) return x.prioritaria ? -1 : 1;
        return pontosDe(y.m) - pontosDe(x.m);
      }) };
    });
  }

  function naPoolDoTime(dados, m) {
    var s = doPO(m);
    if (!s) return false;
    if (txt((m || {}).dev)) return false;
    return situacaoDaSprint(dados, s) === 'em_curso';
  }

  /** A SPRINT JÁ TERMINOU? Pelo último dia útil dela.
   *
   *  É o que decide se o aviso de "falta fechar" aparece. Sexta-feira à tarde a
   *  sprint ainda está correndo; o aviso é de sábado em diante. */
  function sprintVencida(rotulo, hoje, feriados) {
    var r = txt(rotulo);
    if (!rotuloValido(r)) return false;
    var mes = +r.slice(3, 5), ano = +r.slice(6, 10);
    var lista = sprintsDoMes(ano, mes, feriados);
    var achou = null;
    lista.forEach(function (s) { if (s.rotulo === r) achou = s; });
    if (!achou) return false;
    return (iso(hoje) || new Date().toISOString().slice(0, 10)) > achou.ate;
  }

  /** AS SPRINTS QUE ESPERAM FECHAMENTO: já terminaram, têm demanda, e ninguém
   *  fechou. Ordenadas da mais antiga para a mais nova — a mais velha é a que
   *  pesa, e deixá-la por último seria enterrá-la na lista. */
  function pendentesDeFechamento(dados, hoje, feriados, etapaDe) {
    var vistos = {};
    ((dados || {}).melhorias || []).forEach(function (m) {
      if (!m || m.oculto || m.mesclado_em) return;
      var s = doPO(m);
      if (s) vistos[s] = true;
    });
    return Object.keys(vistos)
      .filter(function (s) {
        return sprintVencida(s, hoje, feriados) && !estaFechada(dados, s);
      })
      .map(function (s) {
        /* O AVISO CONTA O QUE FALTA DECIDIR, e não quantas demandas a sprint
           teve. "S2-11 não foi fechada · 12 demandas" assusta à toa quando
           nove delas entregaram; o número que importa é o das que precisam de
           destino e motivo, porque é esse o trabalho que o botão pede. */
        var b = balancoDaSprint(dados, s, etapaDe);
        return { rotulo: s, pendentes: b.pendentes.length,
                 entregues: b.entregues.length, aguardando: b.aguardando.length };
      })
      .sort(function (a, b) { return chaveOrdem(a.rotulo) < chaveOrdem(b.rotulo) ? -1 : 1; });
  }

  /** `S2-11-2026` → `2026-11-2`, que ordena como texto.
   *  Comparar os rótulos crus poria `S1-01-2027` antes de `S5-12-2026`. */
  function chaveOrdem(r) {
    var s = txt(r);
    return rotuloValido(s) ? s.slice(6, 10) + '-' + s.slice(3, 5) + '-' + s.slice(1, 2) : s;
  }

  /** O QUE SOBROU NA SPRINT — o que o fechamento precisa decidir.
   *
   *  `entregues` são as concluídas pelo PM/PO; `aguardando` o dev já entregou e
   *  falta a validação (os pontos delas ainda não contam — ver `capacidade.js`);
   *  `pendentes` é o que não saiu e precisa de destino e motivo.               */
  function balancoDaSprint(dados, rotulo, etapaDe) {
    var saida = { entregues: [], aguardando: [], pendentes: [] };
    ((dados || {}).melhorias || []).forEach(function (m) {
      if (!m || m.oculto || m.mesclado_em) return;
      if (!naSprint(m, rotulo)) return;
      var e = etapaDe ? etapaDe(m) : txt(m.status_planejamento);
      if (e === 'concluido') saida.entregues.push(m);
      else if (e === 'validacao' || e === 'validacao_area') saida.aguardando.push(m);
      else if (e !== 'negada') saida.pendentes.push(m);
    });
    return saida;
  }

  function problemaNoMotivoCarry(txtMotivo) {
    var t = txt(txtMotivo);
    if (!t) return 'Escreva por que ela não entregou.';
    if (t.length < MIN_MOTIVO_CARRY) {
      return 'Diga em poucas palavras o que aconteceu (ao menos ' +
             MIN_MOTIVO_CARRY + ' caracteres).';
    }
    return '';
  }

  /** FECHA A SPRINT.
   *
   *  `decisoes` é `{ [id]: { destino, motivo } }` — `destino` é o rótulo da
   *  próxima sprint ou `''` para devolver ao backlog.
   *
   *  CONFERE TUDO ANTES DE MEXER EM QUALQUER COISA. Uma decisão sem motivo no
   *  meio da lista deixaria metade das demandas movidas e a sprint aberta, e
   *  ninguém saberia onde parou. */
  function fechar(dados, rotulo, quem, hoje, decisoes, etapaDe) {
    var r = txt(rotulo);
    if (!rotuloValido(r)) return { ok: false, erro: 'Sprint inválida.' };
    if (estaFechada(dados, r)) {
      return { ok: false, erro: 'A sprint ' + rotuloCurto(r) + ' já foi fechada.' };
    }
    var bal = balancoDaSprint(dados, r, etapaDe);
    var dec = decisoes || {};
    var erros = [];
    bal.pendentes.forEach(function (m) {
      var d = dec[m.id] || {};
      var destino = txt(d.destino);
      if (destino && !rotuloValido(destino)) {
        erros.push((m.codigo || m.id) + ': destino inválido.');
        return;
      }
      if (destino === r) {
        erros.push((m.codigo || m.id) + ': não dá para empurrar para a própria sprint.');
        return;
      }
      if (destino && estaFechada(dados, destino)) {
        erros.push((m.codigo || m.id) + ': ' + rotuloCurto(destino) + ' já está fechada.');
        return;
      }
      var p = problemaNoMotivoCarry(d.motivo);
      if (p) erros.push((m.codigo || m.id) + ': ' + p);
    });
    if (erros.length) return { ok: false, erro: erros.join('\n'), erros: erros };

    var carry = [];
    bal.pendentes.forEach(function (m) {
      var d = dec[m.id] || {};
      var destino = txt(d.destino);
      var motivo = txt(d.motivo);
      /* MOVE PELO CAMINHO NORMAL, e não escrevendo os campos aqui: é
         `repassar` quem conta o pulo e monta o histórico, e é por ele que a
         demanda "entra atrasada". Uma segunda escrita destes campos seria a
         chance de o pulo deixar de ser contado justamente no fechamento, que é
         onde ele importa.
         `fechando: true` passa por cima da trava da sprint que está sendo
         fechada AGORA — ela só vira fechada ao fim desta função. */
      if (destino) {
        repassar(m, destino, quem, hoje, { fechadas: [] });
      } else {
        /* A VOLTA AO BACKLOG TAMBÉM É REGISTRADA, com `sprint: ''`. Sem esta
           linha o motivo existiria só no registro da sprint, e "por que a
           AX-330 saiu?" não teria resposta olhando o card — que é onde a
           pergunta é feita. `entradas()` ignora esta linha na conta de pulos:
           sair não é rolar. */
        m.sprint_po = '';
        m.sprint_po_em = iso(hoje);
        m.sprint_po_por = txt(quem);
        m.sprint_po_historico = historico(m).concat(
          [{ sprint: '', de: r, em: iso(hoje), por: txt(quem), motivo: motivo }]);
      }
      /* O MOTIVO ENTRA NO ÚLTIMO PASSO DO HISTÓRICO — junto do pulo que ele
         explica. Guardado só à parte, "por que rolou" e "quando rolou" seriam
         duas listas para casar na mão. */
      var h = historico(m);
      if (destino && h.length) h[h.length - 1].motivo = motivo;
      carry.push({ id: m.id, codigo: m.codigo || m.id,
                   destino: destino, motivo: motivo,
                   pulos: pulos(m) });
    });

    /* ESCREVE NO REGISTRO QUE JÁ EXISTE, se a sprint foi iniciada. Empurrar uma
       segunda entrada com o mesmo rótulo deixaria duas verdades sobre a mesma
       semana, e `registroDe` devolveria a última — perdendo quem a iniciou. */
    if (!Array.isArray(dados.sprints)) dados.sprints = [];
    var reg = registroDe(dados, r);
    if (!reg) { reg = { rotulo: r }; dados.sprints.push(reg); }
    reg.em = iso(hoje);
    reg.por = txt(quem);
    reg.carry = carry;
    return { ok: true, fechados: carry.length,
             entregues: bal.entregues.length, aguardando: bal.aguardando.length };
  }

  /* ═══ O PLACAR DA SPRINT ══════════════════════════════════════════════════
   *
   * "Mostre a pontuação, qt de itens validados PM/PO e o % de cumprimento de
   *  toda SPRINT. A contagem deve ser feita sobre todas as tasks que estão na
   *  sprint; caso entre, somar."
   *
   * ───────────────────────────────────────────────────────────────────────────
   * O DENOMINADOR VEM DO HISTÓRICO, E NÃO DO CAMPO `sprint_po`. É a decisão
   * que faz o número ser verdade.
   *
   * O FECHAMENTO TIRA DA SPRINT quem não entregou — é o carry-over. Contando
   * pelo campo atual, toda sprint fechada marcaria 100% por construção: o que
   * falhou já não está lá para ser contado. O placar diria que a semana foi
   * perfeita exatamente porque ela não foi.
   *
   * `sprint_po_historico` guarda cada entrada, então "esteve nesta sprint" é
   * uma pergunta respondível para sempre. E ela também atende o "caso entre,
   * somar": demanda que o PO empurra para dentro na quarta-feira entra no
   * denominador da mesma forma — não dá para melhorar o percentual escolhendo
   * a hora de alocar.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * O NUMERADOR É "CONCLUÍDA E AINDA AQUI".
   *
   * Demanda que rolou para a S3 e foi concluída lá não é entrega da S2 — ela é
   * justamente o que a S2 deixou de fazer. Então sair da sprint sem concluir
   * conta no denominador e nunca no numerador, que é o que transforma o pulo em
   * custo visível em vez de um card que some.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * DOIS PERCENTUAIS, E ISSO É DELIBERADO.
   *
   * O Fernando pediu a contagem por TASK, e é ela que manda — `pct`. Mas duas
   * entregas de 34 pontos com oito ajustes de 1 ponto pendentes dariam 20%
   * numa semana em que quase todo o trabalho saiu. `pctPontos` fica ao lado
   * como leitura, e a tela diz qual é qual. É a mesma razão pela qual
   * `capacidade.js` mostra o rótulo em pontos quando o percentual estouraria.
   *
   * SEM PONTUAÇÃO, `pctPontos` É `null` e não zero: zero afirmaria que nada
   * saiu, quando a verdade é que não dá para medir em pontos.               */

  /** Esta demanda esteve nesta sprint, alguma vez? */
  function esteveNaSprint(m, rotulo) {
    var s = txt(rotulo);
    if (!s) return false;
    if (doPO(m) === s) return true;
    return entradas(m).some(function (e) { return txt(e.sprint) === s; });
  }

  /** TODAS AS DEMANDAS QUE PASSARAM POR ESTA SPRINT — de uma trilha, se pedida. */
  function demandasDaSprint(dados, rotulo, trilha) {
    return ((dados || {}).melhorias || []).filter(function (m) {
      return m && !m.oculto && !m.mesclado_em && esteveNaSprint(m, rotulo) &&
             daTrilha(m, trilha);
    });
  }

  function pontosDe(m) {
    var n = Number((m || {}).poker_pontos);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /** O PLACAR. */
  function placarDaSprint(dados, rotulo, etapaDe, trilha) {
    var r = txt(rotulo);
    var lista = demandasDaSprint(dados, r, trilha);
    var p = { rotulo: r, trilha: txt(trilha), total: 0, validados: 0, aguardando: 0, emCurso: 0, saiu: 0,
              pontosTotal: 0, pontosValidados: 0, pontosAguardando: 0,
              semPontuacao: 0, pct: 0, pctPontos: null,
              itens: { validados: [], aguardando: [], emCurso: [], saiu: [] } };
    lista.forEach(function (m) {
      var e = etapaDe ? etapaDe(m) : txt(m.status_planejamento);
      if (e === 'negada') return;          // recusada nao e compromisso da sprint
      var pts = pontosDe(m);
      p.total += 1;
      p.pontosTotal += pts;
      if (!pts) p.semPontuacao += 1;
      var aqui = doPO(m) === r;
      if (aqui && e === 'concluido') {
        p.validados += 1; p.pontosValidados += pts; p.itens.validados.push(m);
      } else if (aqui && (e === 'validacao' || e === 'validacao_area')) {
        p.aguardando += 1; p.pontosAguardando += pts; p.itens.aguardando.push(m);
      } else if (aqui) {
        p.emCurso += 1; p.itens.emCurso.push(m);
      } else {
        /* SAIU SEM CONCLUIR AQUI. Inclui a concluida DEPOIS de rolar: a entrega
           foi da sprint seguinte, e contá-la aqui premiaria o atraso. */
        p.saiu += 1; p.itens.saiu.push(m);
      }
    });
    p.pct = p.total ? Math.round(p.validados / p.total * 100) : 0;
    p.pctPontos = p.pontosTotal
      ? Math.round(p.pontosValidados / p.pontosTotal * 100) : null;
    return p;
  }

  /** O MESMO PLACAR, POR PESSOA — o ranking da sprint.
   *
   *  ═════════════════════════════════════════════════════════════════════════
   *  PONTO DIVIDIDO, ITEM INTEIRO — e as duas metades têm razões diferentes.
   *
   *  O PONTO mede VOLUME DE TRABALHO, e volume se reparte: 34 pontos feitos a
   *  dois são 17 para cada, e contar 34 para os dois faria a soma da coluna
   *  estourar o total da sprint. É a mesma regra de `capacidade.porDev`.
   *
   *  O ITEM NÃO SE REPARTE. "Ana validou 2,5 itens" não quer dizer nada, e
   *  arredondar cada lado é pior do que parece: MEDIDO numa sprint de 6
   *  demandas com uma de dupla, as duas metades viravam 1 e 1 e a coluna somava
   *  SETE. A precisão era falsa e o número, errado.
   *
   *  Então a demanda de dupla conta INTEIRA para cada um, e a coluna deixa de
   *  ser uma partição — é "em quantas a pessoa atuou". A tela diz isso com
   *  todas as letras, porque uma coluna que não soma o total precisa avisar.
   *
   *  ORDENA POR VALIDADOS e depois por pontos: é um ranking de entrega, e
   *  entregue é o que o PM/PO concluiu. Empate vai para o nome, para a lista
   *  não dançar a cada redesenho. */
  function rankingDaSprint(dados, rotulo, etapaDe, trilha) {
    var r = txt(rotulo);
    var acc = {};
    var pega = function (nome) {
      if (!acc[nome]) {
        acc[nome] = { nome: nome, total: 0, validados: 0, aguardando: 0,
                      emCurso: 0, saiu: 0, pontos: 0, pontosTotal: 0 };
      }
      return acc[nome];
    };
    demandasDaSprint(dados, r, trilha).forEach(function (m) {
      var e = etapaDe ? etapaDe(m) : txt(m.status_planejamento);
      if (e === 'negada') return;
      var nomes = txt(m.dev).split('/').map(function (x) { return x.trim(); }).filter(Boolean);
      if (!nomes.length) nomes = ['(sem dev)'];
      var q = nomes.length;
      var pts = pontosDe(m);
      var aqui = doPO(m) === r;
      nomes.forEach(function (nome) {
        var a = pega(nome);
        a.total += 1;                      // item inteiro — ver o cabeçalho
        a.pontosTotal += pts / q;          // ponto repartido
        if (aqui && e === 'concluido') { a.validados += 1; a.pontos += pts / q; }
        else if (aqui && (e === 'validacao' || e === 'validacao_area')) a.aguardando += 1;
        else if (aqui) a.emCurso += 1;
        else a.saiu += 1;
        if (q > 1) a.dupla = true;         // a tela avisa por que a coluna não soma
      });
    });
    return Object.keys(acc).map(function (n) {
      var a = acc[n];
      return { nome: a.nome, total: a.total, validados: a.validados,
               aguardando: a.aguardando, emCurso: a.emCurso,
               saiu: a.saiu, pontos: Math.round(a.pontos),
               pontosTotal: Math.round(a.pontosTotal), dupla: !!a.dupla,
               pct: a.total ? Math.round(a.validados / a.total * 100) : 0 };
    }).sort(function (x, y) {
      return y.validados - x.validados || y.pontos - x.pontos ||
             x.nome.localeCompare(y.nome, 'pt-BR');
    });
  }

  /* ═══ O QUE ESTÁ EM RISCO DE NÃO ENTREGAR ══════════════════════════════════
   *
   * "Deixar um campo para visualizarem todas as demandas da sprint, assim
   *  poderão acompanhar as que têm risco de não serem entregues."
   *
   * Os sinais são FATOS DO CARD, e não um palpite ponderado. Uma nota de risco
   * de 0 a 100 parece mais sofisticada e é pior: ninguém sabe o que fazer com
   * "risco 62". Cada sinal aqui nomeia o que está errado, que é o que permite
   * agir — e um card pode acender por mais de um.
   *
   * ORDEM: o que já estourou vem antes do que vai estourar.                 */
  function riscosDaDemanda(m, rotulo, hoje, prazoApi) {
    var fora = [];
    var dia = iso(hoje) || new Date().toISOString().slice(0, 10);
    var P = prazoApi || raiz.PRAZO;

    if (txt((m || {}).pausado_em)) {
      fora.push({ chave: 'pausada', texto: 'Pausada' });
    }
    if (P && typeof P.estaAtrasada === 'function' &&
        P.estaAtrasada(m, txt((m || {}).status_planejamento), dia)) {
      var d = (typeof P.diasDeAtraso === 'function')
        ? P.diasDeAtraso(m, txt(m.status_planejamento), dia) : null;
      fora.push({ chave: 'vencida', texto: 'Prazo vencido' + (d ? ' há ' + d + 'd' : '') });
    }
    /* JÁ ROLOU ANTES. É o sinal mais forte que existe aqui: a demanda que
       atravessou uma sprint sem entregar costuma atravessar a seguinte, e esse
       é justamente o padrão que o fechamento com motivo existe para expor. */
    var n = pulos(m);
    if (n) {
      fora.push({ chave: 'rolou', texto: 'Já rolou ' + n + (n > 1 ? ' sprints' : ' sprint') });
    }
    /* A ÁREA ESTOUROU O PRAZO DELA. Não é risco do dev — é bola parada do
       outro lado, e quem olha a sprint precisa saber a quem cobrar. */
    if (P && typeof P.areaVenceu === 'function' && P.areaVenceu(m, dia)) {
      fora.push({ chave: 'area', texto: 'Parada na área além do prazo' });
    }
    /* NÃO COMEÇOU. Só conta depois que a sprint começou — antes disso "não
       começou" é o estado normal de tudo. */
    var e = txt((m || {}).status_planejamento);
    if (e === 'backlog' || e === 'planning' || e === 'levantar_req' || e === 'planejado') {
      fora.push({ chave: 'nao_comecou', texto: 'Ainda não começou' });
    }
    if (!pontosDe(m)) {
      fora.push({ chave: 'sem_pontos', texto: 'Sem pontuação' });
    }
    return fora;
  }

  /** As demandas da sprint com os riscos de cada uma, as de risco primeiro. */
  function acompanhamentoDaSprint(dados, rotulo, etapaDe, hoje, prazoApi, trilha) {
    var r = txt(rotulo);
    return demandasDaSprint(dados, r, trilha).map(function (m) {
      var e = etapaDe ? etapaDe(m) : txt(m.status_planejamento);
      var aqui = doPO(m) === r;
      var situacao = !aqui ? 'saiu'
        : e === 'concluido' ? 'validado'
        : (e === 'validacao' || e === 'validacao_area') ? 'aguardando'
        : e === 'negada' ? 'negada' : 'em_curso';
      /* QUEM JÁ ENTREGOU NÃO TEM RISCO DE NÃO ENTREGAR. Acender "prazo
         vencido" num card concluído é ruído sobre fato consumado — e ruído
         numa lista de risco ensina a ignorar a lista. */
      var riscos = (situacao === 'validado' || situacao === 'negada')
        ? [] : riscosDaDemanda(m, r, hoje, prazoApi);
      return { m: m, situacao: situacao, riscos: riscos, pontos: pontosDe(m),
               prioritaria: aqui && ehPrioritariaDaSprint(m, r) };
    }).sort(function (a, b) {
      // a vencida puxada no início vem primeiro: foi o que o PM/PO priorizou
      if (a.prioritaria !== b.prioritaria) return a.prioritaria ? -1 : 1;
      if (a.riscos.length !== b.riscos.length) return b.riscos.length - a.riscos.length;
      var ordem = { em_curso: 0, aguardando: 1, saiu: 2, validado: 3, negada: 4 };
      if (ordem[a.situacao] !== ordem[b.situacao]) return ordem[a.situacao] - ordem[b.situacao];
      return b.pontos - a.pontos;
    });
  }

  /* ═══ OS ATOS ══════════════════════════════════════════════════════════════
   *
   * Devolvem `{ ok, erro }` e MEXEM NA DEMANDA só quando `ok`. O formato é o
   * mesmo do `pausa.js` porque as duas telas que chamam os dois já sabem lê-lo.
   */

  /** AS SPRINTS FECHADAS que o chamador conhece.
   *
   *  `opts` aceita `{ fechadas: ['S1-11-2026', …] }` OU os dados inteiros em
   *  `{ dados }` — as duas telas têm uma coisa ou a outra à mão, e obrigar a
   *  converter antes de chamar seria convidar a conversão a ser esquecida
   *  justamente na chamada que precisa da trava.
   *
   *  AUSENTE SIGNIFICA "NÃO SEI", e não "nenhuma". A trava de verdade é do
   *  Worker; aqui ela é a cortesia de não deixar a pessoa tentar. */
  function fechadasDe(opts) {
    var o = opts || {};
    if (Array.isArray(o.fechadas)) return o.fechadas.map(txt);
    if (o.dados) return rotulosFechados(o.dados);
    return [];
  }

  /* ═══ A ENTREGA DA SPRINT ══════════════════════════════════════════════════
   *
   * "Quando repassar as tasks para sprint a data de entrega deverá ser
   *  preenchida para todos os itens, sempre para a próxima segunda — nesse caso
   *  da sprint S1-11 (09/11/2026)."
   *
   * A sprint vai de segunda a sexta e entrega ao usuário na SEGUNDA SEGUINTE —
   * o avesso exato de `sprintDaEntrega`. Segunda feriado empurra para o próximo
   * dia útil: entregar num feriado é data que ninguém cumpre.               */
  function entregaDaSprint(rotulo, feriados) {
    var faixa = faixaDaSprint(rotulo, feriados);
    if (!faixa) return '';
    var fer = {};
    (feriados || []).forEach(function (f) {
      fer[iso(f && typeof f === 'object' ? f.data : f)] = true;
    });
    var d = new Date(segundaDaSemana(faixa.de) + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + 7);
    for (var i = 0; i < 10; i++) {
      var dia = d.toISOString().slice(0, 10);
      var dow = d.getUTCDay();
      if (dow !== 0 && dow !== 6 && !fer[dia]) return dia;
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return '';
  }

  function feriadosDe(opts) {
    var o = opts || {};
    if (Array.isArray(o.feriados)) return o.feriados;
    return (o.dados && Array.isArray(o.dados.feriados)) ? o.dados.feriados : [];
  }

  /** O PM/PO REPASSA a demanda para uma sprint. */
  function repassar(m, sprint, quem, hoje, opts) {
    if (!m) return { ok: false, erro: 'Demanda não encontrada.' };
    var s = txt(sprint);
    if (!rotuloValido(s)) {
      return { ok: false, erro: 'Sprint inválida ("' + s + '"). O formato é S1-11-2026.' };
    }
    if (doPO(m) === s) {
      return { ok: false, erro: 'Esta demanda já está na sprint ' + s + '.' };
    }
    /* NEM ENTRA NEM SAI DE SPRINT FECHADA — os dois lados do movimento.
       Checar só o destino deixaria a demanda ESCAPAR de uma sprint fechada, e
       o número que foi apresentado mudaria por subtração em vez de soma. */
    var fech = fechadasDe(opts);
    if (fech.indexOf(s) >= 0) {
      return { ok: false, erro: 'A sprint ' + rotuloCurto(s) + ' está fechada. ' +
                                'Escolha uma sprint aberta.' };
    }
    if (fech.indexOf(doPO(m)) >= 0) {
      return { ok: false, erro: 'Esta demanda está em ' + rotuloCurto(doPO(m)) +
                                ', que já foi fechada — ela não sai mais de lá.' };
    }
    var h = historico(m).slice();
    h.push({ sprint: s, em: iso(hoje), por: txt(quem) });
    m.sprint_po = s;
    m.sprint_po_em = iso(hoje);
    m.sprint_po_por = txt(quem);
    m.sprint_po_historico = h;
    // A entrega ao usuário vai para a segunda depois da sprint — ver `entregaDaSprint`.
    var ent = entregaDaSprint(s, feriadosDe(opts));
    if (ent) m.entrega_usuario = ent;
    return { ok: true, entrouAtrasada: h.length > 1, pulos: h.length - 1, entrega: ent };
  }

  /** O PM/PO TIRA a demanda da sprint — ela volta para o backlog.
   *
   *  O HISTÓRICO NÃO É APAGADO. Tirar da sprint não desfaz as sprints em que ela
   *  esteve, e apagar faria uma demanda que rolou três semanas voltar a parecer
   *  nova na próxima vez que entrasse. É o mesmo cuidado do `pausa_historico`. */
  function retirar(m, quem, hoje, opts) {
    if (!m) return { ok: false, erro: 'Demanda não encontrada.' };
    if (foraDaSprint(m)) {
      return { ok: false, erro: 'Esta demanda já está fora da sprint.' };
    }
    if (fechadasDe(opts).indexOf(doPO(m)) >= 0) {
      return { ok: false, erro: 'Esta demanda está em ' + rotuloCurto(doPO(m)) +
                                ', que já foi fechada — ela não sai mais de lá.' };
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
    TRILHAS: TRILHAS,
    CORES_SPRINT: CORES_SPRINT,
    corDaSprint: corDaSprint,
    estiloSprint: estiloSprint,
    naVitrine: naVitrine,
    dispensaDev: dispensaDev,
    pontosDe: pontosDe,
    PONTOS_POR_DEV: PONTOS_POR_DEV,
    capacidadeDaSprint: capacidadeDaSprint,
    capacidadePorTrilha: capacidadePorTrilha,
    sprintSeguinte: sprintSeguinte,
    sprintDaEntrega: sprintDaEntrega,
    entregaDaSprint: entregaDaSprint,
    backlogDaSprint: backlogDaSprint,
    trilhaDe: trilhaDe,
    daTrilha: daTrilha,
    vencidasParaPriorizar: vencidasParaPriorizar,
    pausadasParaTransbordar: pausadasParaTransbordar,
    ehPrioritariaDaSprint: ehPrioritariaDaSprint,
    ROTULO: ROTULO,
    rotuloValido: rotuloValido,
    rotuloCurto: rotuloCurto,
    segundaDaSemana: segundaDaSemana,
    diasUteisDoMes: diasUteisDoMes,
    sprintsDoMes: sprintsDoMes,
    rotuloDeData: rotuloDeData,
    faixaDaSprint: faixaDaSprint,
    sprintAnterior: sprintAnterior,
    sprintCorrente: sprintCorrente,
    doPO: doPO,
    foraDaSprint: foraDaSprint,
    naSprint: naSprint,
    daSprint: daSprint,
    historico: historico,
    entradas: entradas,
    pulos: pulos,
    entrouAtrasada: entrouAtrasada,
    sprintDeOrigem: sprintDeOrigem,
    badge: badge,
    MIN_MOTIVO_CARRY: MIN_MOTIVO_CARRY,
    registros: registros,
    registroDe: registroDe,
    fechamentos: fechamentos,
    fechamentoDe: fechamentoDe,
    estaFechada: estaFechada,
    estaIniciada: estaIniciada,
    situacaoDaSprint: situacaoDaSprint,
    iniciar: iniciar,
    escondidaDoTime: escondidaDoTime,
    naPoolDoTime: naPoolDoTime,
    rotulosFechados: rotulosFechados,
    sprintVencida: sprintVencida,
    pendentesDeFechamento: pendentesDeFechamento,
    balancoDaSprint: balancoDaSprint,
    esteveNaSprint: esteveNaSprint,
    demandasDaSprint: demandasDaSprint,
    placarDaSprint: placarDaSprint,
    rankingDaSprint: rankingDaSprint,
    riscosDaDemanda: riscosDaDemanda,
    acompanhamentoDaSprint: acompanhamentoDaSprint,
    problemaNoMotivoCarry: problemaNoMotivoCarry,
    fechar: fechar,
    TRAVA_DESDE: TRAVA_DESDE,
    TIPOS_LIVRES: TIPOS_LIVRES,
    ETAPA_TRAVADA: ETAPA_TRAVADA,
    ETAPAS_POS_PLANNING: ETAPAS_POS_PLANNING,
    posPlanning: posPlanning,
    tipoLivre: tipoLivre,
    travaDeAlocacao: travaDeAlocacao,
    proximasSprints: proximasSprints,
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
