/* ─────────────────────────────────────────────────────────────────────────
   CAPACIDADE EM PONTOS — planejado × entregue, por dev

   Existe porque a pergunta "quanto eu joguei para essa pessoa e quanto ela fez"
   não tinha resposta na ferramenta. Havia hora planejada × realizada, e havia
   contagem de demandas prometidas × entregues, mas nenhuma das duas mede
   TAMANHO: três ajustes de meia hora somam 3 demandas, e uma entrega de 13
   pontos soma 1. Um dev fecha 50 pontos por semana, outro fecha 100 — e sem os
   pontos nos dois lados não dá para dizer se o mês foi bem planejado.

   ───────────────────────────────────────────────────────────────────────────
   POR QUE O PLANEJADO É UM CAMPO PRÓPRIO, E NÃO `poker_pontos` LIDO NO FIM

   A REPONTUAÇÃO ACONTECE. Na base de produção, três demandas mudaram de tamanho
   depois de pontuadas: AX-088 (34 → 55), AX-180 (55 → 34) e AX-200 (2 → 8),
   todas pelo painel. Ler `poker_pontos` no fechamento do mês faria a repontuação
   REESCREVER O PASSADO: você prometeu 34 pontos ao dev, corrigiu para 55 depois
   de ver o tamanho real, e o relatório passaria a dizer que você havia prometido
   55 desde o início. O cruzamento planejado × entregue deixa de medir
   compromisso e passa a medir a última edição.

   Então `pontos_planejados` é CARIMBADO na alocação e não muda mais.

   O ENTREGUE, AO CONTRÁRIO, USA O TAMANHO CORRENTE. Ele responde "quanto de
   trabalho saiu", e se a demanda era maior do que parecia, o trabalho foi maior:
   a repontuação para 55 é uma correção de tamanho, e o dev entregou 55. A
   diferença entre os dois números não é erro — é a demanda que cresceu, e é
   informação que a tela mostra em vez de esconder.

   ───────────────────────────────────────────────────────────────────────────
   O QUE FICA DE FORA, E POR QUÊ

   PONTUAÇÃO RETROATIVA NÃO É PLANEJAMENTO. 77 das 165 demandas pontuadas
   receberam pontos DEPOIS de concluídas, quando a base foi organizada. Para
   essas, "planejado" nunca existiu — contá-las faria o planejado do mês passado
   aparecer perfeito por construção, que é o mesmo defeito que a conclusão
   retroativa causava no prazo.

   ALOCADA SEM PONTUAR NÃO SOMA ZERO EM SILÊNCIO. 27 demandas estão em
   Planejado/Em andamento sem pontuação alguma — nove delas sem prazo nenhum.
   Somar zero faria o planejado do dev parecer menor do que é, e a conclusão
   errada seria "sobra capacidade". Essas demandas são CONTADAS À PARTE e a tela
   diz quantas são: o número que falta é o próprio recado.
   ───────────────────────────────────────────────────────────────────────────*/
(function (raiz) {
  'use strict';

  /** Etapas em que a demanda já foi ALOCADA a alguém — é daqui em diante que o
   *  ponto conta como planejado. Backlog e Planning não: ali ainda se discute se
   *  a demanda entra, e contar como plano infla o compromisso com o que pode nem
   *  ser feito. */
  var ETAPAS_ALOCADA = ['planejado', 'em_andamento', 'validacao', 'concluido'];

  /** E aqui o dev já tirou a demanda da mão dele. `validacao` entra porque o
   *  trabalho terminou — a espera do PM/PO não é do dev, a mesma regra do prazo
   *  (ver prazo.js). */
  var ETAPAS_ENTREGUE = ['validacao', 'concluido'];

  function num(v) {
    var n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function etapaDe(m) {
    return String((m || {}).status_planejamento || '').trim();
  }

  function viva(m) {
    return !!m && !m.oculto && !m.mesclado_em;
  }

  /** OS PONTOS QUE FORAM PROMETIDOS. Zero quando a demanda foi alocada sem
   *  pontuar — e o chamador precisa saber a diferença entre "prometi zero" e
   *  "não pontuei", que é o que `semPontuacao` responde. */
  function planejados(m) {
    if (!viva(m) || !ETAPAS_ALOCADA.includes(etapaDe(m))) return 0;
    // Pontuada só depois de concluir: nunca foi plano.
    if (m.poker_retroativo) return 0;
    // O carimbo primeiro. Sem ele (base antiga, antes deste campo existir), o
    // tamanho corrente é a melhor informação que existe — e o servidor carimba
    // na próxima gravação, então a lacuna se fecha sozinha.
    var c = num(m.pontos_planejados);
    return c || num(m.poker_pontos);
  }

  /** Alocada e sem pontuação nenhuma: não soma zero em silêncio. */
  function semPontuacao(m) {
    return viva(m) && ETAPAS_ALOCADA.includes(etapaDe(m)) &&
           !num(m.poker_pontos) && !num(m.pontos_planejados);
  }

  /** OS PONTOS QUE SAÍRAM — tamanho corrente, porque ele responde "quanto de
   *  trabalho foi feito". Conta desde a entrega do dev, e não desde a aprovação:
   *  a demanda que está com o PM/PO já saiu da mão de quem fez. */
  function entregues(m) {
    if (!viva(m) || !ETAPAS_ENTREGUE.includes(etapaDe(m))) return 0;
    return num(m.poker_pontos);
  }

  /** O dia que ancora o PLANEJADO: o prazo combinado.
   *  É a data em que você prometeu, e é por ela que o compromisso conta no mês —
   *  a mesma âncora do bloco de prazo do admin. Sem prazo, a demanda não tem mês
   *  de compromisso e fica fora da distribuição (o chamador vê pelo total). */
  function diaDoPlano(m) {
    var d = String((m || {}).entrega || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
  }

  /** O dia que ancora o ENTREGUE: quando o DEV entregou.
   *  `entregue_em` primeiro, `concluido_em` de reserva — a mesma regra do atraso
   *  e do ranking da semana. Contar pela aprovação jogaria para a semana
   *  seguinte tudo que ficou parado em validação. */
  function diaDaEntrega(m) {
    var e = String((m || {}).entregue_em || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(e)) return e;
    var c = String((m || {}).concluido_em || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(c) ? c : '';
  }

  /** Os nomes que a demanda carrega. O campo aceita "Fulano / Beltrano" desde
   *  sempre, e as duas pessoas contam — comparar a string inteira deixaria as
   *  duas de fora da própria conta. */
  function devsDe(m) {
    return String((m || {}).dev || '').split('/')
      .map(function (x) { return x.trim(); })
      .filter(Boolean);
  }

  /** QUANTAS SPRINTS A DEMANDA ROLOU — ou null, quando ela nunca foi remarcada.
   *
   *  O DADO VEM DO `historico`, e não do campo `sprint`: ele nunca é editado por
   *  tela nenhuma (zero eventos de mudança de `sprint` na base), então ler dali
   *  daria zero sempre. O que muda de verdade é a `entrega` — 69 mudanças em 39
   *  demandas —, e como as sprints são as semanas do mês, uma entrega que anda de
   *  semana É a demanda mudando de sprint.
   *
   *  MEDE O AVANÇO LÍQUIDO, do primeiro prazo que existiu até o atual, e não a
   *  soma dos pulos. AX-001 foi de 21/08 para 15/01/2027 e voltou para 21/08 no
   *  minuto seguinte — foi correção de digitação, e somar os pulos a contaria como
   *  a demanda mais rolada da base. O que interessa é onde ela terminou.
   *
   *  E DESCONTA OS DIAS DE PAUSA. Retomar empurra a `entrega` pelos dias parados,
   *  e essa é uma extensão acordada com motivo registrado — não é a demanda sendo
   *  jogada para a frente. Sem o desconto, toda pausa longa apareceria como pulo
   *  de sprint, e o alerta viraria ruído justamente onde já há explicação.
   *
   *  Semana de sete dias, e não índice de semana do mês: S4-08 → S1-09 é UMA
   *  sprint, e contar por índice daria "menos três".                            */
  function rolagemDeSprint(m) {
    if (!viva(m)) return null;
    var atual = String((m || {}).entrega || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(atual)) return null;

    var evs = [];
    (Array.isArray(m.historico) ? m.historico : []).forEach(function (e) {
      (e && e.mudancas ? e.mudancas : []).forEach(function (c) {
        if (c && c.campo === 'entrega') {
          evs.push({ de: String(c.de || '').slice(0, 10), em: String(e.em || '') });
        }
      });
    });
    if (!evs.length) return null;
    evs.sort(function (a, b) { return a.em.localeCompare(b.em); });

    // O primeiro prazo QUE EXISTIU. Mudança de "" para uma data é o primeiro
    // planejamento, e não um pulo: a demanda não tinha de onde sair.
    var origem = null;
    for (var i = 0; i < evs.length; i++) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(evs[i].de)) { origem = evs[i].de; break; }
    }
    if (!origem) return null;

    var d = function (t) {
      var p = t.split('-');
      return Date.UTC(+p[0], +p[1] - 1, +p[2]);
    };
    var bruto = Math.round((d(atual) - d(origem)) / 86400000);
    var pausados = (Array.isArray(m.pausa_historico) ? m.pausa_historico : [])
      .reduce(function (t, p) { return t + (Number(p && p.dias) || 0); }, 0);
    var liquido = bruto - pausados;
    var sprints = Math.floor(liquido / 7);
    if (sprints < 1) return null;
    return { codigo: m.codigo || m.id, sprints: sprints, de: origem, para: atual,
             dias: liquido, pausados: pausados, mudancas: evs.length };
  }

  /** SPRINT FORTE EM VALOR ABSOLUTO.
   *
   *  Cem pontos numa sprint é uma semana boa por si, e não em relação a nada: o
   *  Fernando descreveu a régua do time com essas palavras — "tem dev que faz 50
   *  pontos por semana e outros fazem 100". Entregar 104 contra um plano de 119 não
   *  é uma semana ruim; é uma semana forte contra um plano ambicioso.
   *
   *  SEM ISSO, O PLANO PUNIA QUEM ENTREGOU MAIS. Duas pessoas fecham 104 pontos na
   *  mesma semana; a que tinha plano de 90 aparecia verde e a de plano 119
   *  aparecia vermelha — a cor dizia mais sobre quem planejou do que sobre quem
   *  fez. O percentual continua na leitura ao lado, e é lá que a diferença contra
   *  o plano aparece.
   *
   *  Vale mesmo na sprint em curso, pela mesma assimetria do resto: cem pontos
   *  entregues é fato consumado, e mais tempo só pode somar.                    */
  var PONTOS_SPRINT_FORTE = 100;

  /** A sprint foi bem? Verde por UM dos dois caminhos — bateu o plano, ou fez
   *  cem pontos. Devolve false quando não há nem plano nem volume que sustente. */
  function sprintForte(plan, entregue) {
    var p = num(plan), e = num(entregue);
    if (e >= PONTOS_SPRINT_FORTE) return true;
    return !!p && e >= p;
  }

  /** Acima DE QUANTAS sprints o pulo pede atenção nominal.
   *  Duas é tolerância de replanejamento; da terceira em diante a demanda está
   *  sendo empurrada, e empurrar sem dizer o nome dela é como ela some de vista. */
  var SPRINTS_PARA_ALERTA = 2;

  /** As rolagens de uma lista, já separadas entre "houve" e "pede atenção". */
  function rolagens(lista) {
    var todas = (lista || []).map(rolagemDeSprint).filter(Boolean);
    return {
      total: todas.length,
      todas: todas.sort(function (a, b) { return b.sprints - a.sprints; }),
      alerta: todas.filter(function (r) { return r.sprints > SPRINTS_PARA_ALERTA; }),
    };
  }

  /** CAPACIDADE POR DEV numa janela [de, ate] (datas ISO, inclusive).
   *
   *  Devolve, por pessoa: pontos planejados, pontos entregues, quantas demandas
   *  de cada lado, e quantas foram alocadas sem pontuação.
   *
   *  O PONTO É DIVIDIDO NA DUPLA (`/ devs.length`): contar inteiro para cada um
   *  faz a soma por dev estourar o total, e a primeira coisa que se faz olhando
   *  uma tabela é somar a coluna.
   */
  function porDev(lista, de, ate) {
    var acc = {};
    var pega = function (nome) {
      if (!acc[nome]) {
        acc[nome] = { nome: nome, plan: 0, entregue: 0,
                      qtdPlan: 0, qtdEntregue: 0, semPontuar: 0 };
      }
      return acc[nome];
    };
    var dentro = function (d) { return !!d && d >= de && d <= ate; };

    (lista || []).forEach(function (m) {
      if (!viva(m)) return;
      var nomes = devsDe(m);
      if (!nomes.length) return;
      var q = nomes.length;

      var p = planejados(m);
      var e = entregues(m);
      var noPlano = dentro(diaDoPlano(m));
      var naEntrega = dentro(diaDaEntrega(m));

      nomes.forEach(function (nome) {
        var a = pega(nome);
        if (noPlano) {
          if (p) { a.plan += p / q; a.qtdPlan += 1 / q; }
          if (semPontuacao(m)) a.semPontuar += 1 / q;
        }
        if (naEntrega && e) { a.entregue += e / q; a.qtdEntregue += 1 / q; }
      });
    });

    return Object.keys(acc).map(function (n) {
      var a = acc[n];
      return {
        nome: a.nome,
        plan: Math.round(a.plan),
        entregue: Math.round(a.entregue),
        qtdPlan: Math.round(a.qtdPlan),
        qtdEntregue: Math.round(a.qtdEntregue),
        semPontuar: Math.round(a.semPontuar),
        /* O PERCENTUAL SÓ EXISTE COM PLANO. Sem planejado, "entregou 40 pontos"
           não tem denominador — e devolver 0% ou 100% ali seria inventar uma
           referência. `null` obriga a tela a dizer "—", que é a verdade.

           E ELE PARA EM 100. Acima disso a leitura é `rotulo`, que diz a diferença
           em pontos: um pct de 178 exposto aqui reapareceria como "178%" na
           primeira tela que o imprimisse direto — e foi o que aconteceu no Gantt. */
        pct: a.plan > 0 ? Math.min(100, Math.round(a.entregue / a.plan * 100)) : null,
        rotulo: rotulo(Math.round(a.plan), Math.round(a.entregue)),
      };
    }).sort(function (x, y) {
      return y.plan - x.plan || y.entregue - x.entregue ||
             x.nome.localeCompare(y.nome, 'pt-BR');
    });
  }

  /** A mesma conta, distribuída em faixas de data (as semanas do mês).
   *  `faixas` é uma lista de { de, ate } — o chamador já as tem, porque é ele que
   *  desenha a régua. */
  function porFaixa(lista, faixas) {
    return (faixas || []).map(function (f) {
      var plan = 0, entregue = 0, semPontuar = 0;
      (lista || []).forEach(function (m) {
        if (!viva(m)) return;
        var d1 = diaDoPlano(m), d2 = diaDaEntrega(m);
        if (d1 >= f.de && d1 <= f.ate) {
          plan += planejados(m);
          if (semPontuacao(m)) semPontuar += 1;
        }
        if (d2 >= f.de && d2 <= f.ate) entregue += entregues(m);
      });
      return { de: f.de, ate: f.ate, plan: Math.round(plan),
               entregue: Math.round(entregue), semPontuar: semPontuar };
    });
  }

  /** COMO O CRUZAMENTO E ESCRITO — e nunca como percentual acima de 100.
   *
   *  "178%" numa linha de capacidade nao se le como informacao, se le como erro: a
   *  primeira reacao e "a conta esta errada". E travar em 100% seria mentir por
   *  arredondamento — os pontos existiram. Acima do plano sai a DIFERENCA EM
   *  PONTOS, que e a informacao de verdade: "+84 pt" responde "quanto saiu alem do
   *  que foi combinado", e essa e a pergunta que o 178% estava tentando fazer.
   *
   *  Isso acontece de forma legitima e frequente: o dev fecha em agosto o que foi
   *  planejado para julho. A mesma regra do deck (ver `rotuloExecucao` em
   *  apresentacao.js), aqui compartilhada pelas tres telas.                     */
  function rotulo(plan, entregue) {
    if (!plan) return entregue ? '+' + entregue + ' pt' : '—';
    if (entregue <= plan) return Math.round(entregue / plan * 100) + '%';
    return '+' + (entregue - plan) + ' pt';
  }

  raiz.CAPACIDADE = {
    rotulo: rotulo,
    PONTOS_SPRINT_FORTE: PONTOS_SPRINT_FORTE,
    sprintForte: sprintForte,
    SPRINTS_PARA_ALERTA: SPRINTS_PARA_ALERTA,
    rolagemDeSprint: rolagemDeSprint,
    rolagens: rolagens,
    ETAPAS_ALOCADA: ETAPAS_ALOCADA,
    ETAPAS_ENTREGUE: ETAPAS_ENTREGUE,
    planejados: planejados,
    entregues: entregues,
    semPontuacao: semPontuacao,
    diaDoPlano: diaDoPlano,
    diaDaEntrega: diaDaEntrega,
    devsDe: devsDe,
    porDev: porDev,
    porFaixa: porFaixa,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.CAPACIDADE;
})(typeof globalThis !== 'undefined' ? globalThis : this);
