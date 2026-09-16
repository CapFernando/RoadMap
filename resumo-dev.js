/* ─────────────────────────────────────────────────────────────────────────
   O RESUMO DE UM DEV — "o que está na mão desta pessoa agora"

   Nasceu no Gantt do planejamento, clicando no nome na faixa. O painel do dev
   tem um cronograma também, e lá a mesma pergunta é feita pela própria pessoa
   antes de dar satisfação no grupo — então a regra virou arquivo, em vez de
   virar uma segunda cópia.

   Esta base já pagou caro por cópias: a etapa tinha quatro implementações e duas
   respondiam diferente; o prazo tinha quatro; o nome do dev era comparado de
   doze jeitos. O padrão aqui é o mesmo do `prazo.js`, do `etapa-demanda.js` e do
   `dev-nome.js` — uma regra, um arquivo, e as telas perguntam.

   ═════════════════════════════════════════════════════════════════════════
   OS TRÊS BALDES, E POR QUE ELES SÃO DISJUNTOS

     CONCLUÍDO HOJE  aprovado hoje pelo PM/PO
     ATRASADO      o prazo venceu e a demanda ainda é do dev
     EM ANDAMENTO  a bola está com o dev
     EM VALIDAÇÃO  ele entregou; a bola está com o PM/PO
     PLANEJADO     comprometido, com data, e ainda não começou
     PLANNING      vai ser dimensionado na reunião — ainda não tem tamanho

   O PLANEJADO EXISTE PARA A DAILY. Sem ele o resumo responde "o que está
   acontecendo" e cala sobre "o que vem" — e a pergunta da daily é a segunda
   tanto quanto a primeira. Ele fecha a conta do que a pessoa tem na mão: sem
   esse bloco, um dev com três coisas planejadas para a semana aparece com o
   mesmo resumo de um que não tem nada pela frente.

   PLANEJADO E PLANNING VENCIDOS NÃO APARECEM NOS BALDES DELES, e isso sai de
   graça: as duas etapas estão em `ETAPAS_QUE_CORREM` no `prazo.js`, então o
   prazo delas corre e a demanda vai para ATRASADO antes de chegar lá. Os cinco
   continuam disjuntos sem nenhuma regra nova.

   OS DOIS ÚLTIMOS ESTÃO NA ORDEM DO FUNIL, de trás para frente: planejado já tem
   data e compromisso; planning ainda vai ser medido. Quem lê a daily desce do
   mais concreto para o mais distante.

   E O CONCLUÍDO HOJE VEM PRIMEIRO. "Caso eu aprove, não é mostrado": ao aprovar
   a entrega, a demanda vira `concluido` e some do resumo inteiro — o trabalho
   desaparece no instante em que fica pronto, que é o pior momento possível para
   ele sumir. A daily abre por "o que saiu", e é essa a primeira pergunta.

   Ele só aparece quando existe (`soSeTiver`): num dia sem nada aprovado, um
   bloco "0 concluído" não responde nada — é ausência de assunto, e não resposta.
   Os quatro do meio continuam aparecendo vazios, porque ali o zero É resposta
   ("nada atrasado" é o que se quer ouvir).

   `validacao` NÃO APARECE EM ATRASADO, e isso não é escolha deste arquivo:
   quem decide é o `prazo.js`, e o cabeçalho dele registra por quê — "a demanda
   passa um tempo na mão do PM/PO, e o tempo que ela passa ali não é atraso de
   desenvolvimento". Perguntar a ele em vez de comparar datas aqui é o que
   impede o recado de cobrar a pessoa por uma espera que não é dela.

   PAUSADA cai em "em andamento" pela mesma regra (o prazo está suspenso, não
   estourado) — e por isso aparece com data de entrega já vencida. Daí o rótulo
   da seção ser "a bola está com o dev", e não "dentro do prazo": sob aquele
   rótulo, a seção contradizia o próprio item.

   ═════════════════════════════════════════════════════════════════════════
   O QUE ELE NÃO FAZ

   NÃO FILTRA POR MÊS nem por filtro de tela. O Gantt mostra um mês porque é um
   calendário; "o que o Dan está devendo" não é pergunta de mês, e um resumo de
   setembro esconderia a demanda de agosto ainda aberta — justamente a que
   precisa de recado.

   NÃO LÊ DADO. Recebe `state` de quem chama, pelo mesmo motivo que o
   `relatorio-ppt.js` não calcula: se ele lesse por conta própria, a tela e o
   resumo poderiam mostrar leituras de instantes diferentes.
   ───────────────────────────────────────────────────────────────────────── */
(function (raiz) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function dataBR(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return '—';
    var p = String(iso).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  /** A situação de uma demanda, em duas partes: o rótulo e o detalhe.
   *
   *  MONTADA UMA VEZ SÓ, aqui, e usada pela tela E pelo texto do grupo. Duas
   *  montagens da mesma frase divergiriam na primeira mudança — e o recado
   *  passaria a dizer algo diferente do que a tela mostrou para quem o mandou. */
  /* O DIA EM QUE FOI CONCLUÍDA — em horário DAQUI, e não de Greenwich.
   *
   *  O `admin.html` grava `concluido_em` como `new Date().toISOString().slice(0,10)`,
   *  que é a data UTC: aprovar às 21h30 de uma terça carimba QUARTA. Comparando
   *  esse campo com "hoje", a entrega aprovada no fim da tarde não apareceria no
   *  resumo do próprio dia — justamente a que o PM/PO acabou de aprovar e quer
   *  ver na daily.
   *
   *  `validado_em` guarda o instante completo, então dele sai o dia local. O
   *  `concluido_em` fica como reserva para registro antigo que não tenha o
   *  carimbo de validação.
   *
   *  O FUSO É O DO NAVEGADOR, e não "America/Sao_Paulo" fixo — porque o outro
   *  lado da comparação é o `PRAZO.hojeISO()`, que usa o do navegador. As duas
   *  datas TÊM de sair da mesma régua: com uma em São Paulo e a outra na máquina,
   *  um computador configurado noutro fuso diria que a entrega aprovada agora foi
   *  concluída ontem, e ela sumiria do resumo do dia. Comparar é comparar duas
   *  medidas do mesmo instrumento. */
  function diaConclusao(m) {
    var v = String((m && m.validado_em) || '');
    if (v) {
      var d = new Date(v);
      if (!isNaN(d)) {
        return d.getFullYear() + '-' +
          String(d.getMonth() + 1).padStart(2, '0') + '-' +
          String(d.getDate()).padStart(2, '0');
      }
    }
    return String((m && m.concluido_em) || '').slice(0, 10);
  }

  function situacaoDe(x, balde) {
    if (balde === 'atr') {
      return { rot: 'Atrasado',
               det: x.dias + (x.dias === 1 ? ' dia' : ' dias') +
                    (x.entrega ? ', venceu ' + dataBR(x.entrega) : '') };
    }
    if (balde === 'and') {
      return { rot: 'Em andamento',
               det: (x.entrega ? 'entrega ' + dataBR(x.entrega) : 'sem data combinada') +
                    (x.pausada ? ' · pausada, aguardando terceiro' : '') };
    }
    if (balde === 'pla') {
      /* O INÍCIO VEM PRIMEIRO, e é o dado da daily: "começa quinta" responde a
         pergunta que se faz na reunião; "entrega 30/09" responde a que se faz no
         planejamento. Quando não há início marcado, a entrega assume — e a
         frase diz qual das duas datas está sendo mostrada, para ninguém ler uma
         pela outra. */
      var quando = x.inicio ? 'começa ' + dataBR(x.inicio) : '';
      var ate = x.entrega ? 'entrega ' + dataBR(x.entrega) : '';
      return { rot: 'Planejado',
               det: [quando, ate].filter(Boolean).join(' · ') || 'sem datas' };
    }
    if (balde === 'fim') {
      /* QUEM APROVOU entra na linha quando se sabe: numa daily, "o Fernando
         aprovou" fecha a conversa que "foi concluída" deixa aberta. */
      return { rot: 'Concluído hoje',
               det: (x.validadoPor ? 'aprovado por ' + x.validadoPor : 'aprovado hoje') +
                    (x.pts ? ' · ' + x.pts + ' pt' : '') };
    }
    if (balde === 'pln') {
      /* O QUE FALTA AQUI É O TAMANHO, e é isso que a linha diz. Planning é a
         etapa em que a demanda vai ser medida — mostrar só a data de entrega
         faria parecer que já há compromisso de prazo sobre algo que ninguém
         dimensionou ainda. Quando já tem pontos, ela diz: é a que está pronta
         para sair da reunião. */
      var tam = x.pts ? x.pts + ' pt já estimados' : 'tamanho a definir';
      return { rot: 'Planning',
               det: tam + (x.entrega ? ' · entrega ' + dataBR(x.entrega) : '') };
    }
    return { rot: 'Em validação',
             det: (x.entregueEm ? 'entregue ' + dataBR(x.entregueEm) : 'aguardando o PM/PO') +
                  (x.atrasouNaEntrega ? ' · entregou após o prazo' : '') };
  }

  function montar(state, dev, hoje) {
    var PRAZO = raiz.PRAZO, ETAPA = raiz.ETAPA, DEVNOME = raiz.DEVNOME;
    var dia = hoje || PRAZO.hojeISO();
    var temas = (state && state.temas) || [];
    var minhas = ((state && state.melhorias) || []).filter(function (m) {
      return m && !m.oculto && !m.mesclado_em && DEVNOME.eDe(m, dev);
    });

    /* A ETAPA VAI JUNTO, e não é detalhe: `diasDeAtraso(m, etapa, hoje)` recebe
       TRÊS argumentos. Chamado com dois, `hoje` cai na posição de `etapa` — e
       uma data não está em `ETAPAS_QUE_CORREM` nem em `ETAPAS_APOS_O_DEV`,
       então a função devolve `null` e vira ZERO. "venceu 09/09, 0 dias" ia para
       a tela e para o grupo: um número errado com cara de número certo, no
       texto que alguém cola para cobrar uma pessoa. */
    function monta(m, etapa) {
      var t = temas.find(function (x) { return String(x.id) === String(m.tema_id); });
      return {
        codigo: m.codigo || '', titulo: m.titulo || '(sem título)',
        tema: t ? (raiz.catalogoCurto ? raiz.catalogoCurto(t.nome) : t.nome) : '',
        // O nome INTEIRO fica para o `title` da célula: o curto corta o meio da
        // árvore ("AXCred › Reanálise" esconde que ela mora em Cadastro >
        // Análise de Crédito), e numa lista de oito isso faz duas áreas
        // parecerem a mesma.
        temaCheio: t ? t.nome : '',
        entrega: m.entrega || '', inicio: m.inicio || '',
        pts: Number(m.poker_pontos) || 0,
        dias: PRAZO.diasDeAtraso(m, etapa, dia) || 0,
        entregueEm: String(m.entregue_em || '').slice(0, 10),
        atrasouNaEntrega: !!(PRAZO.atrasouNaEntrega && PRAZO.atrasouNaEntrega(m)),
        pausada: ETAPA.pausada(m),
        concluidoEm: diaConclusao(m),
        validadoPor: String(m.validado_por || ''),
      };
    }

    var atrasado = [], andamento = [], validacao = [], planejado = [], planning = [],
        concluidoHoje = [];
    function poe(lista, m, gr, balde) {
      var x = monta(m, gr);
      x.balde = balde;
      x.situacao = situacaoDe(x, balde);
      lista.push(x);
    }
    minhas.forEach(function (m) {
      var ef = ETAPA.efetiva(m, dia);
      var gr = ETAPA.gravada(m, dia);
      /* O CONCLUÍDO VEM PRIMEIRO na escolha do balde, e é preciso dizer o que
         isso NÃO faz.
         Eu havia escrito que a ordem impede uma demanda entregue com atraso e
         aprovada hoje de cair em ATRASADO. É FALSO, e a sabotagem provou:
         inverter as duas linhas não mudou nada. `PRAZO.estaAtrasada` devolve
         `false` para `concluido` — medido: uma concluída com prazo de 45 dias
         atrás lê como `concluido`, e não como `atrasado` —, porque `concluido`
         está em `ETAPAS_APOS_O_DEV` e ali o atraso é congelado na entrega.
         A regra mora no `prazo.js`, e é lá que a invariante a prende.
         A ordem fica por clareza: o balde mais específico primeiro, para quem
         ler a cadeia não precisar saber de cor o que o `prazo.js` devolve.

         E SÓ O DE HOJE ENTRA: `concluido` de ontem continua fora do resumo, que
         é sobre o que está na mão agora. Este é o ramo que carrega peso. */
      if (gr === 'concluido') {
        if (diaConclusao(m) === dia) poe(concluidoHoje, m, gr, 'fim');
        return;
      }
      if (ef === 'atrasado') { poe(atrasado, m, gr, 'atr'); return; }
      if (gr === 'em_andamento') { poe(andamento, m, gr, 'and'); return; }
      if (gr === 'validacao') { poe(validacao, m, gr, 'val'); return; }
      if (gr === 'planejado') { poe(planejado, m, gr, 'pla'); return; }
      if (gr === 'planning') { poe(planning, m, gr, 'pln'); return; }
    });

    // Atrasado: o mais vencido primeiro — é a ordem da conversa.
    atrasado.sort(function (a, b) {
      return b.dias - a.dias || String(a.entrega).localeCompare(String(b.entrega));
    });
    // Em andamento: o prazo mais próximo primeiro; sem data vai para o fim.
    andamento.sort(function (a, b) {
      return String(a.entrega || '9999-99-99').localeCompare(String(b.entrega || '9999-99-99')) ||
             String(a.codigo).localeCompare(String(b.codigo));
    });
    // Em validação: quem entregou primeiro espera há mais tempo.
    validacao.sort(function (a, b) {
      return String(a.entregueEm || '9999-99-99')
        .localeCompare(String(b.entregueEm || '9999-99-99'));
    });
    /* Planejado: o que COMEÇA antes vem antes — e não o que entrega antes. Na
       daily a ordem util e a de quando a pessoa põe a mão, e ordenar pela
       entrega poria em primeiro uma demanda que so começa daqui a duas semanas
       so porque o prazo dela e curto. */
    planejado.sort(function (a, b) {
      return String(a.inicio || a.entrega || '9999-99-99')
        .localeCompare(String(b.inicio || b.entrega || '9999-99-99')) ||
             String(a.codigo).localeCompare(String(b.codigo));
    });
    /* Planning: a JÁ PONTUADA primeiro. Ela é a que pode sair da reunião — o
       resto ainda vai ser medido, e entre duas por medir a ordem não muda nada.
       Por data seria pior: planning é justamente a etapa em que a data ainda
       não significa compromisso. */
    planning.sort(function (a, b) {
      return (b.pts || 0) - (a.pts || 0) ||
             String(a.codigo).localeCompare(String(b.codigo));
    });
    // Concluído hoje: a maior primeiro — é a que a daily quer ouvir.
    concluidoHoje.sort(function (a, b) {
      return (b.pts || 0) - (a.pts || 0) ||
             String(a.codigo).localeCompare(String(b.codigo));
    });

    return { dev: dev, hoje: dia, concluidoHoje: concluidoHoje,
             atrasado: atrasado, andamento: andamento,
             validacao: validacao, planejado: planejado, planning: planning,
             total: concluidoHoje.length + atrasado.length + andamento.length +
                    validacao.length + planejado.length + planning.length };
  }

  var SECOES = [
    /* PRIMEIRO, e só quando existe. A daily abre por "o que saiu", e esta é a
       única seção que fala do passado — as outras são estado de agora. */
    { k: 'fim', lista: 'concluidoHoje', rot: '✅ Concluído hoje', soSeTiver: true,
      dica: 'aprovado hoje pelo PM/PO', txt: 'CONCLUÍDO HOJE' },
    { k: 'atr', lista: 'atrasado',  rot: '⚠ Atrasado',
      dica: 'o prazo venceu e ainda é dele', txt: 'ATRASADO' },
    { k: 'and', lista: 'andamento', rot: '▶ Em andamento',
      dica: 'a bola está com o dev', txt: 'EM ANDAMENTO' },
    { k: 'val', lista: 'validacao', rot: '⏳ Em validação',
      dica: 'o dev entregou; está com o PM/PO', txt: 'EM VALIDAÇÃO' },
    /* POR ÚLTIMO, e não por ser menos importante: os três de cima são o que
       está acontecendo, e este é o que vem. Numa daily a leitura corre nessa
       ordem — primeiro o que trava, depois o que anda, depois o que espera
       terceiro, e por fim o que entra em seguida. */
    { k: 'pla', lista: 'planejado', rot: '📅 Planejado',
      dica: 'combinado, e ainda não começou', txt: 'PLANEJADO' },
    /* POR ÚLTIMO, seguindo o funil: planning vem ANTES de planejado no fluxo,
       mas DEPOIS na leitura — é o mais distante do que a pessoa faz hoje.

       E SÓ APARECE SE A PESSOA TIVER ALGO LÁ (`soSeTiver`).

       Planning é a etapa em que a demanda vai ser DIMENSIONADA, e nessa altura
       ela muitas vezes ainda não tem dono — o `dev` fica em branco até alguém
       pegar. Duas consequências, e as duas importam:

         1. Demanda de Planning SEM dev não é de ninguém, e já não entra: o
            `DEVNOME.eDe` recusa nome vazio dos dois lados ("perder o próprio
            card é ruim; ver o card alheio é pior").
         2. Por isso o balde fica vazio na maioria dos devs — e um bloco
            "Planning · nada aqui" em todo resumo é moldura: some da vista de
            quem lê e, no dia em que tiver algo, não é notado.

       OS OUTROS QUATRO CONTINUAM APARECENDO VAZIOS, e isso é deliberado:
       "0 atrasado" é resposta, e some junto com a pergunta se o bloco sumir.
       "0 em planning" não é resposta — é ausência de assunto. */
    { k: 'pln', lista: 'planning', rot: '🃏 Planning', soSeTiver: true,
      dica: 'o tamanho é definido na reunião', txt: 'PLANNING' },
  ];

  /** O TEXTO PARA O GRUPO.
   *
   *  SEM MARCAÇÃO: WhatsApp e Teams não leem markdown igual, e um `**` que não
   *  vira negrito aparece cru no meio da frase.
   *
   *  BLOCO VAZIO NÃO ENTRA: num grupo, cada linha a mais é uma a menos de
   *  chance de a mensagem ser lida até o fim.
   *
   *  O SISTEMA ENTRE COLCHETES separa "onde" de "o que" sem precisar de tabela,
   *  que nenhum aplicativo de conversa respeita. */
  function texto(r) {
    var L = [r.dev + ' — situação em ' + dataBR(r.hoje)];
    SECOES.forEach(function (s) {
      var lista = r[s.lista];
      if (!lista.length) return;
      L.push('');
      L.push(s.txt + ' (' + lista.length + ')');
      lista.forEach(function (x) {
        L.push('- ' + (x.codigo ? x.codigo + ' ' : '') +
               (x.tema ? '[' + x.tema + '] ' : '') + x.titulo +
               ' — ' + x.situacao.rot + ', ' + x.situacao.det);
      });
    });
    if (!r.total) L.push('Nada em aberto.');
    return L.join('\n');
  }

  /** O corpo da tela. QUATRO CAMPOS POR LINHA, na ordem em que a pergunta é
   *  feita: QUEM é (o código, por onde se responde no grupo), ONDE mora
   *  (sistema e módulo), O QUE é (o título) e COMO ESTÁ (a situação).
   *
   *  O sistema vem antes do título porque é o que agrupa: correndo o olho pela
   *  coluna, vê-se que três das quatro atrasadas são da mesma área — leitura que
   *  o título, sendo único em cada linha, nunca dá. */
  function html(r) {
    if (!r.total) {
      return '<div class="dr-nada">Nenhuma demanda em aberto para ' + esc(r.dev) +
        '.<br><span style="font-size:12.5px;color:var(--text3)">' +
        'Sem atraso, sem trabalho em andamento e nada esperando validação.</span></div>';
    }
    var linha = function (x) {
      return '<div class="dr-item">' +
        '<span class="dr-cod">' + esc(x.codigo || '—') + '</span>' +
        '<span class="dr-sis" title="' + esc(x.temaCheio || x.tema) + '">' +
          esc(x.tema || '—') + (x.pts ? '<small>' + x.pts + ' pt</small>' : '') + '</span>' +
        '<span class="dr-tt">' + esc(x.titulo) + '</span>' +
        '<span class="dr-sit' + (x.balde === 'atr' ? ' venc' : '') + '">' +
          esc(x.situacao.rot) + '<small>' + esc(x.situacao.det) + '</small></span></div>';
    };
    /* O CONTADOR E A SEÇÃO SAEM DA MESMA LISTA. Escritos à mão, o contador do
       planning ficaria na tela depois de a seção sumir — e o resumo mostraria
       "0 planning" apontando para um bloco que não existe. */
    var mostrar = SECOES.filter(function (sc) {
      return !sc.soSeTiver || r[sc.lista].length;
    });
    return '<div class="dr-topo">' +
      mostrar.map(function (sc) {
        return '<div class="dr-kpi ' + sc.k + '"><b>' + r[sc.lista].length +
               '</b><span>' + sc.txt.toLowerCase() + '</span></div>';
      }).join('') +
      '</div>' +
      mostrar.map(function (sc) {
        var lista = r[sc.lista];
        return '<div class="dr-sec ' + sc.k + '"><div class="dr-sec-tit">' + sc.rot +
          '<small>' + lista.length + (lista.length === 1 ? ' demanda' : ' demandas') +
          ' · ' + sc.dica + '</small></div>' +
          (lista.length ? lista.map(linha).join('')
                        : '<div class="dr-vazio">nada aqui</div>') + '</div>';
      }).join('');
  }

  /* O CSS VIAJA COM O MÓDULO, e não é copiado nas telas. Duas folhas de estilo
     para o mesmo componente divergem na primeira vez que alguém ajusta uma —
     e o resumo passaria a ter aparências diferentes conforme a aba. */
  var CSS = [
    '.dr-topo{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}',
    /* 92px: sao CINCO contadores, e o modal tem 760px menos o padding — com 108
       o quinto quebrava para a linha de baixo. O `flex:1` divide o que sobra, e
       o rotulo mais longo ("em validação") cabe em 92 a 11,5px. */
    '.dr-kpi{flex:1;min-width:92px;background:var(--bg3);border:1px solid var(--border);',
      'border-radius:var(--radius,12px);padding:10px 13px}',
    '.dr-kpi b{display:block;font-size:22px;font-weight:700;line-height:1.15}',
    '.dr-kpi span{font-size:11.5px;color:var(--text2);text-transform:uppercase;letter-spacing:.05em}',
    // VERDE no concluído: a paleta define verde como "cumprido", e é o único
    // balde em que algo de fato foi cumprido.
    '.dr-kpi.fim b{color:var(--green,#5EA832)}',
    '.dr-kpi.atr b{color:var(--red,#E84444)}',
    '.dr-kpi.and b{color:var(--green,#5EA832)}',
    '.dr-kpi.val b{color:var(--amber-tx,#FFC470)}',
    /* AZUL no planejado: a paleta usa azul para "previsto", que e exatamente o
       que ele e. Verde diria "cumprido" e ambar diria "atencao" — as duas
       mentiriam sobre algo que so esta agendado. */
    '.dr-kpi.pla b{color:var(--blue,#3B8FE8)}',
    /* TEAL no planning, e nao uma cor nova: o `tema.css` ja pinta
       `.badge-planning` e `.s-planning` de teal. Escolher outra aqui faria a
       mesma etapa ter duas cores dependendo da tela. */
    '.dr-kpi.pln b{color:var(--teal-tx,#2BBFA0)}',
    '.dr-sec{margin-bottom:16px}',
    '.dr-sec-tit{display:flex;align-items:baseline;gap:8px;font-size:13px;font-weight:700;',
      'padding-bottom:5px;border-bottom:1px solid var(--border);margin-bottom:7px}',
    '.dr-sec-tit small{font-weight:400;color:var(--text2);font-size:11.5px}',
    '.dr-sec.fim .dr-sec-tit{color:var(--green,#5EA832)}',
    '.dr-sec.atr .dr-sec-tit{color:var(--red,#E84444)}',
    '.dr-sec.and .dr-sec-tit{color:var(--green,#5EA832)}',
    '.dr-sec.val .dr-sec-tit{color:var(--amber-tx,#FFC470)}',
    '.dr-sec.pla .dr-sec-tit{color:var(--blue,#3B8FE8)}',
    '.dr-sec.pln .dr-sec-tit{color:var(--teal-tx,#2BBFA0)}',
    /* O código e a situação têm largura FIXA: são os dois que se procura
       correndo o olho na vertical, e coluna que muda de largura a cada linha
       obriga o olho a reencontrar o começo. O título fica com o `1fr` porque é
       o único sem tamanho previsível. */
    '.dr-item{display:grid;grid-template-columns:58px 132px 1fr 148px;gap:10px;',
      'align-items:baseline;padding:6px 0;font-size:13px;border-bottom:1px solid var(--border)}',
    '.dr-item:last-child{border-bottom:none}',
    '.dr-cod{color:var(--text3);font-family:ui-monospace,monospace;font-size:11.5px}',
    '.dr-sis{color:var(--text2);font-size:11.5px;line-height:1.35;overflow-wrap:anywhere}',
    '.dr-sis small{display:block;color:var(--text3);font-size:10.5px}',
    '.dr-tt{line-height:1.4}',
    '.dr-sit{font-size:11.5px;line-height:1.35}',
    '.dr-sit small{display:block;color:var(--text3);font-size:10.5px}',
    '.dr-sit.venc{color:var(--red,#E84444);font-weight:600}',
    '.dr-vazio{color:var(--text3);font-size:12.5px;padding:5px 0}',
    '.dr-nada{text-align:center;color:var(--text2);padding:26px 10px;font-size:14px}',
    /* Abaixo de 560px a grade de quatro colunas espreme o título a uma palavra
       por linha. Vira duas colunas, e continua legível. */
    '@media(max-width:560px){.dr-item{grid-template-columns:58px 1fr}',
      '.dr-sis,.dr-sit{grid-column:2}}',
  ].join('');

  var _posto = false;
  function poeCss() {
    if (_posto || !raiz.document) return;
    _posto = true;
    var st = raiz.document.createElement('style');
    st.id = 'resumo-dev-css';
    st.textContent = CSS;
    raiz.document.head.appendChild(st);
  }

  var _atual = null;

  /* O MODAL É CRIADO PELO MÓDULO, e não escrito no HTML das telas. Duas marcações
     divergem; e uma tela nova que esquecesse o `<div>` chamaria a função e não
     veria nada acontecer — falha silenciosa, que é a que esta base mais repete. */
  function caixa() {
    var d = raiz.document;
    var el = d.getElementById('modal-dev-resumo');
    if (el) return el;
    el = d.createElement('div');
    el.id = 'modal-dev-resumo';
    el.className = 'modal-overlay';
    el.style.display = 'none';
    el.innerHTML =
      '<div class="modal" style="max-width:760px">' +
        '<button type="button" class="modal-close-btn" data-dr-fechar aria-label="Fechar">✕</button>' +
        '<h2 id="dr-titulo">Resumo</h2>' +
        '<p class="ap-dica" id="dr-sub" style="margin:-6px 0 14px"></p>' +
        '<div id="dr-corpo"></div>' +
        '<div class="form-actions" style="margin-top:16px">' +
          '<button class="btn btn-secondary" data-dr-fechar>Fechar</button>' +
          '<button class="btn btn-primary" id="dr-copiar">📋 Copiar para o grupo</button>' +
        '</div>' +
      '</div>';
    d.body.appendChild(el);
    el.addEventListener('click', function (ev) {
      if (ev.target === el || ev.target.hasAttribute('data-dr-fechar')) fechar();
    });
    el.querySelector('#dr-copiar').addEventListener('click', copiar);
    return el;
  }

  function fechar() {
    var el = raiz.document.getElementById('modal-dev-resumo');
    if (el) el.style.display = 'none';
  }

  function abrir(state, dev, opts) {
    opts = opts || {};
    poeCss();
    var el = caixa();
    _atual = montar(state, dev);
    el.querySelector('#dr-titulo').textContent = dev;
    el.querySelector('#dr-sub').textContent = opts.proprio
      ? 'Tudo que está na sua mão hoje — todas as suas demandas em aberto, e não ' +
        'só as do mês no cronograma.'
      : 'Tudo que está na mão dele hoje — todas as demandas em aberto, e não só ' +
        'as do mês na tela.';
    el.querySelector('#dr-corpo').innerHTML = html(_atual);
    el.style.display = 'flex';
    return _atual;
  }

  function copiar() {
    var d = raiz.document;
    var btn = d.getElementById('dr-copiar');
    var rotulo = btn ? btn.textContent : '';
    var txt = _atual ? texto(_atual) : '';
    var avisa = function (ok) {
      if (!btn) return;
      btn.textContent = ok ? '✓ Copiado' : 'copie o texto na tela';
      setTimeout(function () { btn.textContent = rotulo; }, ok ? 1800 : 3000);
    };
    if (raiz.navigator && raiz.navigator.clipboard) {
      raiz.navigator.clipboard.writeText(txt).then(function () { avisa(true); },
                                                   function () { reserva(txt, avisa); });
      return;
    }
    reserva(txt, avisa);
  }

  /* CLIPBOARD BLOQUEADO NÃO PODE VIRAR "não copiei e não disse nada": sem HTTPS
     ou sem permissão, a API recusa em silêncio. O textarea selecionado deixa dar
     Ctrl+C — e se nem isso funcionar, o texto FICA na tela para copiar à mão, em
     vez de sumir. */
  function reserva(txt, avisa) {
    var d = raiz.document;
    var ta = d.createElement('textarea');
    ta.value = txt;
    ta.style.cssText = 'position:fixed;top:8%;left:50%;transform:translateX(-50%);' +
      'width:min(620px,92vw);height:56vh;z-index:9999;font-family:ui-monospace,monospace;' +
      'font-size:12.5px;padding:12px';
    d.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = d.execCommand('copy'); } catch (_) {}
    if (ok) { ta.remove(); avisa(true); }
    else { ta.onblur = function () { ta.remove(); }; avisa(false); }
  }

  raiz.RESUMODEV = {
    montar: montar,
    texto: texto,
    html: html,
    abrir: abrir,
    fechar: fechar,
    copiar: copiar,
    SECOES: SECOES,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.RESUMODEV;
})(typeof globalThis !== 'undefined' ? globalThis : this);
