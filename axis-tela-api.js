/* ─────────────────────────────────────────────────────────────────────────
   AXIS — API e integracoes (#api). Prancha Configuracoes · API e integracoes.

   Fora do menu: chega-se por Configuracoes (o item "API e integracoes" aponta
   para ca). Abre para admin, analista e dev; quem pode chamar cada acao e o
   worker que decide, e a tela diz qual e a regra.

   E A API DE DEMANDAS PARA OUTROS SISTEMAS: as acoes que o worker expoe para
   script, alerta de monitoramento e integracao — `demanda-nova`,
   `demanda-consultar`, `demanda-procurar`, `demanda-atualizar`,
   `demanda-entregar`, `demandas-minhas` e `mensagem-nova` (a mesma que a
   mensageria.html usa para escrever no registro da demanda). Cada uma com o
   que faz, quem pode, os campos e um exemplo de chamada copiavel.

   O ENDERECO E O DO APP (`AXIS_APP.WORKER`), e nao um literal desta tela: uma
   URL so, a mesma que o app chama. Os exemplos saem com o login de quem esta
   na tela, um `tema_id` e um codigo AX- que existem de verdade — doc com
   marcador generico obriga a montar a chamada na mao (o comentario do
   `epFuncoesHTML` do dev.html conta o caso). A senha nunca entra no exemplo.

   O BOTAO "CHAMAR" USA A SESSAO DESTA TELA (`H.api`, que poe o token). As
   acoes que gravam pedem confirmacao antes: gravam na base de verdade.

   O QUE A PRANCHA TEM E O ROADMAP NAO: chaves por sistema com escopo e
   expiracao, uso em 24 h, OpenAPI e as integracoes (Keycloak, Teams, e-mail).
   Nada disso e simulado; a tela diz o que existe hoje no lugar.

   Os campos e as recusas descritos aqui sao os do `cloudflare-worker/worker.js`
   (blocos `demanda-nova`, `demandas-minhas`... e `mensagem-nova`). Mudou la,
   muda aqui.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var A = window.AXIS_APP;
  if (!A) return;
  var H = A.H;
  var esc = H.esc;

  // Resposta da ultima chamada de cada acao. Vive enquanto a pagina vive.
  var st = { resp: {}, corpo: {}, chamando: '' };

  function poeCss() {
    if (document.getElementById('css-tela-api')) return;
    var s = document.createElement('style');
    s.id = 'css-tela-api';
    s.textContent = [
      '.axa .ap-grid{display:grid;gap:16px;grid-template-columns:minmax(0,1fr) minmax(0,1.35fr);align-items:start}',
      '.axa .ap-col{display:flex;flex-direction:column;gap:16px;min-width:0}',
      '.axa .ap-ac{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;background:var(--sf2);font-size:12.5px;text-decoration:none;color:var(--tx);border:1px solid transparent}',
      '.axa .ap-ac:hover{border-color:var(--bd4);color:var(--tx)}',
      '.axa .ap-ac.on{border-color:rgba(var(--ac-rgb),.55);box-shadow:inset 3px 0 0 var(--ac)}',
      '.axa .ap-ac .mono{flex:0 0 auto;color:var(--tx);font-weight:600}',
      '.axa .ap-ac .d{flex:1;min-width:0;color:var(--tx3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.axa .ap-pre{margin:0;padding:14px;border-radius:12px;background:var(--side);border:1px solid var(--bd);font-size:11.5px;line-height:18px;color:var(--tx2);white-space:pre-wrap;word-break:break-word;overflow:auto;max-height:420px}',
      '.axa .ap-cod{position:relative}',
      '.axa .ap-cod .btns{position:absolute;top:8px;right:8px;background:var(--sf3)}',
      '.axa .ap-cod .ap-pre{padding-right:96px}',
      '.axa .ap-url{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.axa .ap-url .in{flex:1;min-width:0;font-family:var(--font-mono);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.axa .ap-tab td:first-child{width:32%;word-break:break-word}',
      '.axa .ap-tab td:last-child{width:48%}',
      '.axa .ap-tab code,.axa .ap-txt code{font-family:var(--font-mono);font-size:11.5px;color:var(--ac-t)}',
      '.axa .ap-txt{font-size:13px;line-height:21px;color:var(--tx2)}',
      '.axa .ap-corpo{width:100%;min-height:150px;height:auto;padding:12px 14px;resize:vertical;font-family:var(--font-mono);font-size:12px;line-height:1.55;display:block}',
      '.axa .ap-temas{display:flex;flex-wrap:wrap;gap:6px;max-height:260px;overflow:auto}',
      '.axa .ap-temas span{font-size:12px;padding:4px 8px;border-radius:8px;background:var(--sf2);border:1px solid var(--bd)}',
      '.axa .ap-temas b{font-family:var(--font-mono);font-weight:600;color:var(--ac-t);margin-right:4px}',
      '@container app (max-width: 960px){.axa .ap-grid{grid-template-columns:minmax(0,1fr) !important}}',
      /* Celular: o detalhe da acao escolhida vem antes da lista de acoes (ao
         trocar de acao a tela volta ao topo, onde o detalhe esta); toque de
         44 px e letra de 12 px. */
      '@container app (max-width: 760px){',
      '.axa .ap-grid > .ap-col:last-child{order:-1}',
      '.axa .ap-ac{min-height:44px;box-sizing:border-box}',
      '.axa .ap-lk{padding:14px 10px;margin:-14px -10px}',
      '.axa .ap-pre,.axa .ap-tab code,.axa .ap-txt code{font-size:12px}',
      '.axa .ap-tab tr{gap:6px 12px}.axa .ap-tab td:first-child,.axa .ap-tab td:last-child{width:auto}',
      '.axa .ap-tab.tc td[data-tc="largo"]{display:block !important;line-height:20px}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── Dados reais para os exemplos ────────────────────────────────────────
  function exemplos(ctx) {
    var vs = H.visiveis();
    var minha = vs.filter(function (m) { return H.minha(m) && ['concluido', 'validacao', 'negada'].indexOf(H.colunaDe(m)) < 0; })[0];
    var qualquer = minha || vs.filter(function (m) { return m.codigo && H.colunaDe(m) === 'em_andamento'; })[0] || vs[0] || {};
    var temas = ((ctx.D || {}).temas || []).slice().sort(function (a, b) { return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'); });
    return {
      cod: qualquer.codigo || 'AX-042',
      id: qualquer.id || 'ID_DA_DEMANDA',
      tema: temas.length ? temas[0].id : 'TEMA_ID',
      login: (ctx.eu || {}).login || 'seu.usuario',
      titulo: qualquer.titulo || 'boleto'
    };
  }

  // ── Catalogo das acoes ──────────────────────────────────────────────────
  /* `campos`: [nome, regra, descricao]. `corpo`: o que vai alem de `action` e
     `token`. `grava`: muda a base (a tela confirma antes de chamar). */
  function acoes(x) {
    var DEV_ADMIN = 'dev e admin — analista e consulta recebem 403';
    return [
      {
        id: 'login', grupo: 'SESSÃO', d: 'pega o token da sua conta', quem: 'qualquer conta ativa', grava: false, testar: false,
        o_que: 'Troca usuário e senha por um <code>token</code> de sessão, que vale 12 horas. Todas as outras ações usam esse token, com a permissão da conta que entrou — a demanda aberta por um script entra no nome dessa conta. Use uma conta para cada sistema, e não deixe senha nem token em código versionado.',
        campos: [['login', 'obrigatório', 'usuário ou e-mail da conta'], ['senhaUsuario', 'obrigatório', 'a senha da conta']],
        corpo: { login: x.login, senhaUsuario: 'SUA_SENHA' },
        resposta: '{"ok":true,"token":"...","usuario":{"nome":"...","papel":"dev"}}'
      },
      {
        id: 'demanda-nova', grupo: 'ABRIR', d: 'abre uma demanda', quem: DEV_ADMIN, grava: true,
        o_que: 'Abre uma demanda no nome da conta. Nasce no <code>backlog</code>, com o código AX- que o servidor dá: só o dono da sprint (o PM/PO) abre em outra etapa, e para ele o padrão é <code>em_andamento</code> — pedida outra etapa por quem não é, a resposta traz <code>aviso</code>. Título igual ao de uma demanda viva é recusado — procure antes com <code>demanda-procurar</code>. Pela API a data nasce <b>hoje</b>: data no passado é recusada, e prazo à frente é combinado pelo PM/PO no planejamento. <code>poker_pontos</code>, <code>entrega_usuario</code> e <code>mes_alvo</code> não entram (400 <code>campo_bloqueado</code>).',
        campos: [
          ['titulo', 'obrigatório', 'mínimo 3 letras, até 200'],
          ['tipo', 'obrigatório*', '<code>sustentacao</code> (erro/bug) ou <code>evolucao</code> (melhoria). *herda da principal com <code>parent_id</code>'],
          ['tema_id', 'obrigatório*', 'o sistema, da lista no fim da página. *herda da principal com <code>parent_id</code>'],
          ['descricao', 'opcional', 'o que aconteceu, como reproduzir (até 4000)'],
          ['status_planejamento', 'opcional', '<code>em_andamento</code> (padrão), <code>planejado</code> ou <code>backlog</code>'],
          ['solicitante', 'opcional*', 'quem pediu; em branco fica a conta. *obrigatório sem dono'],
          ['dev', 'opcional', 'padrão: o nome da conta. <code>null</code> (ou <code>"sem_dono": true</code>) abre sem dono, em backlog'],
          ['inicio, entrega', 'opcional', '<code>AAAA-MM-DD</code>; pela API, só a data de hoje'],
          ['prioridade', 'opcional', '<code>alta</code>, <code>media</code> ou <code>baixa</code>'],
          ['impacto, urgencia', 'pedido', '<code>baixo</code>/<code>medio</code>/<code>alto</code> e <code>baixa</code>/<code>media</code>/<code>alta</code>; sem eles a resposta traz <code>aviso_classificacao</code>'],
          ['parent_id', 'opcional', 'pendura em outra demanda: o código (<code>AX-042</code>, <code>42</code>) ou o id'],
          ['vinculo', 'opcional', '<code>parte</code> (padrão, não trava a principal) ou <code>dependencia</code> (trava até concluir)'],
          ['projeto_id', 'opcional', 'projeto existente'],
          ['observacao, horas_realizadas, estimativa_horas, data_solicitacao', 'opcional', 'como no formulário'],
          ['spike, debito_tecnico, dados_bi, sales_ops', 'opcional', '<code>true</code> marca']
        ],
        corpo: { titulo: 'Erro ao gerar boleto de cliente sem CNPJ', tipo: 'sustentacao', tema_id: x.tema, descricao: 'Reproduz em homologação com cliente PF.', status_planejamento: 'em_andamento' },
        resposta: '{"ok":true,"codigo":"AX-1234","id":"ep-...","status_planejamento":"em_andamento","dev":"..."}'
      },
      {
        id: 'demanda-procurar', grupo: 'LER', d: 'já existe alguma sobre isto?', quem: DEV_ADMIN, grava: false,
        o_que: 'Procura antes de criar. <code>bloqueia_criacao: true</code> quer dizer que há uma demanda viva com o mesmo título — é o que <code>demanda-nova</code> vai recusar. <code>parecidas</code> compartilham palavras e não barram nada: são para quem decide. Cada uma vem com <code>validada</code>, <code>aguardando_validacao</code> ou <code>em_esteira</code>, e com os links do Git. <code>git</code> traz as issues do repositório (e diz quando não conseguiu olhar).',
        campos: [['titulo (ou termo)', 'obrigatório', 'ao menos 3 caracteres, até 500'], ['tema_id', 'opcional', 'procura só neste sistema']],
        corpo: { titulo: x.titulo },
        resposta: '{"ok":true,"bloqueia_criacao":false,"identica":null,"parecidas":[...],"total_parecidas":2,"git":{...}}'
      },
      {
        id: 'demanda-consultar', grupo: 'LER', d: 'como está uma demanda', quem: DEV_ADMIN + '; não exige ser a dona', grava: false,
        o_que: 'Lê uma demanda: título, etapa, sistema, prazo, pontos, <code>resumo_entrega</code> e <code>implementacao</code>, mais <code>aguardando_validacao</code>, <code>concluida</code>, <code>atrasada</code> e <code>dias_atraso</code> (pausada nunca vem atrasada). O vínculo vem nos dois sentidos (<code>depende_de</code> e <code>vinculadas</code>), e <code>travada</code> responde "posso avançar?". <code>sua</code> diz se a conta pode gravar nela; <code>achada_por</code> diz se casou pelo código, pela issue ou pelo id.',
        campos: [['codigo', 'um dos três', '<code>AX-042</code>, <code>#042</code> ou <code>42</code>'], ['issue', 'um dos três', 'o número da issue no GitHub (<code>#1087</code>)'], ['id', 'um dos três', 'o id interno']],
        corpo: { codigo: x.cod },
        resposta: '{"ok":true,"achada_por":"codigo","sua":true,"demanda":{"codigo":"' + x.cod + '","etapa":"em_andamento",...}}'
      },
      {
        id: 'demandas-minhas', grupo: 'LER', d: 'as demandas da conta', quem: DEV_ADMIN, grava: false,
        o_que: 'Lista as demandas em que a conta é dev, com os mesmos campos do <code>demanda-consultar</code>, ordenadas pela entrega. <code>nomes_procurados</code> e <code>criterio</code> dizem por qual nome a busca foi feita — <code>total: 0</code> com o nome errado não é o mesmo que não ter demanda.',
        campos: [['etapa', 'opcional', 'uma ou várias separadas por vírgula (<code>planejado,em_andamento</code>)'], ['pausadas', 'opcional', '<code>false</code> tira as pausadas'], ['atrasadas', 'opcional', '<code>true</code> traz só as de prazo vencido']],
        corpo: { atrasadas: true },
        resposta: '{"ok":true,"dev":"...","total":3,"nomes_procurados":["..."],"criterio":"nome da conta","demandas":[...]}'
      },
      {
        id: 'demanda-atualizar', grupo: 'GRAVAR', d: 'grava campos da demanda', quem: DEV_ADMIN + '; o dev só nas suas', grava: true,
        o_que: 'Grava o que é de quem executa. Dev, pontos e <code>concluido_em</code> ficam de fora: são do planejamento. A <code>etapa</code> vai até <code>em_andamento</code> (entregar é <code>demanda-entregar</code>; concluir é do PM/PO). A partir de <code>planejado</code> a data <b>já combinada</b> não muda pela API (409 <code>data_comprometida</code>); campo vazio se preenche em qualquer etapa. Em validação, só texto e horas (409 <code>em_validacao</code>). Na concluída, o que está vazio se preenche e o que tem valor não muda (409 <code>concluida_alterada</code>, sem gravar nada). Demanda de outra pessoa: 403 <code>nao_sua</code>.',
        campos: [
          ['codigo ou id', 'obrigatório', 'a demanda'],
          ['resumo_entrega', 'opcional', 'a frase do relatório e da apresentação (até 300)'],
          ['implementacao, descricao, observacao', 'opcional', 'texto'],
          ['horas_realizadas', 'opcional', 'número ≥ 0; tirar de <code>em_andamento</code> exige horas maiores que zero (400 <code>horas_realizadas</code>), e podem ir nesta mesma chamada'],
          ['impacto, urgencia', 'opcional', '<code>baixo</code>/<code>medio</code>/<code>alto</code> e <code>baixa</code>/<code>media</code>/<code>alta</code>; outro valor é recusado'],
          ['inicio, entrega', 'opcional', '<code>AAAA-MM-DD</code>, ou <code>""</code> para limpar'],
          ['etapa', 'opcional', 'até <code>em_andamento</code>; depois da Planning exige sprint'],
          ['link_issue, link_pr, link_milestone, link_repo', 'opcional', 'endereço completo, ou só o número com <code>link_repo</code> (<code>"audaxcapitalsa/axcaixa"</code>)'],
          ['links, anexos', 'opcional', 'substituem a lista; <code>[]</code> limpa'],
          ['projeto_id', 'opcional', 'só projeto aprovado'],
          ['parent_id, vinculo', 'opcional', 'pendura (<code>AX-042</code>), troca o tipo do elo ou solta (<code>""</code>)']
        ],
        corpo: { codigo: x.cod, horas_realizadas: 6 },
        resposta: '{"ok":true,"alterado":["horas_realizadas"],"demanda":{...}}'
      },
      {
        id: 'demanda-entregar', grupo: 'GRAVAR', d: 'manda para validação', quem: DEV_ADMIN + '; o dev só nas suas', grava: true,
        o_que: 'Entrega. Exige o texto do que foi implementado e as horas — é por esse texto que se valida, e as horas alimentam o relatório do comitê. Evolução cai na <b>Validação da área</b> (o solicitante homologa; sem solicitante é recusada); sustentação com <code>homologacao</code> registrada vai direto ao PM/PO. Mande também o <code>resumo_entrega</code>: sem ele o relatório usa o texto inteiro. Não entrega o que já está em validação nem o concluído (409).',
        campos: [
          ['codigo ou id', 'obrigatório', 'a demanda'],
          ['implementacao', 'obrigatório*', 'o que foi feito. *pode já estar gravado na demanda'],
          ['horas_realizadas', 'obrigatório*', 'maior que zero. *pode já estar gravado'],
          ['resumo_entrega', 'opcional', 'até 300'],
          ['homologacao', 'opcional', 'registro de quem validou (sustentação vai direto ao PM/PO)'],
          ['link_externo, link_pr...', 'opcional', 'como em <code>demanda-atualizar</code>']
        ],
        corpo: { codigo: x.cod, resumo_entrega: 'Parecer passa a destacar os trechos críticos.', implementacao: 'O que foi feito', horas_realizadas: 6 },
        resposta: '{"ok":true,"alterado":["entregue para a homologacao da area"],"demanda":{...}}'
      },
      {
        id: 'mensagem-nova', grupo: 'GRAVAR', d: 'escreve no registro da demanda', quem: 'dev, analista e admin', grava: true,
        o_que: 'Escreve uma mensagem no registro da demanda — a linha do tempo da Mensageria. Quem e quando saem do servidor, nunca do corpo, e a mensagem não se apaga. <code>@Nome</code> vira menção só quando casa com alguém da equipe (a lista volta em <code>mencoes</code>). Pede o <code>melhoria_id</code> (o id), e não o código: pegue o id em <code>demanda-consultar</code>.',
        campos: [['melhoria_id', 'obrigatório', 'o id da demanda'], ['texto', 'obrigatório', 'a mensagem']],
        corpo: { melhoria_id: x.id, texto: 'Validado em homologação com a área.' },
        resposta: '{"ok":true,"mensagem":{"em":"...","quem":"...","texto":"..."},"total":4}'
      }
    ];
  }

  function json(o) { return JSON.stringify(o, null, 2); }
  function curl(acao) {
    var corpo = Object.assign({ action: acao.id }, acao.id === 'login' ? {} : { token: 'TOKEN' }, acao.corpo);
    return 'curl -s ' + A.WORKER + ' \\\n  -H "Content-Type: application/json" \\\n  -d \'' + JSON.stringify(corpo) + '\'';
  }
  function copiavel(txt, rot) {
    return '<div class="ap-cod"><pre class="mono ap-pre">' + esc(txt) + '</pre>' +
      '<button type="button" class="btns" data-ap="copiar" aria-label="Copiar ' + esc(rot || '') + '">' + H.ico('clipboard') + ' Copiar</button></div>';
  }

  function linhaAcao(a, sel) {
    return '<a class="ap-ac' + (a.id === sel ? ' on' : '') + '" href="#api/' + a.id + '"' + (a.id === sel ? ' aria-current="true"' : '') + '>' +
      H.chip('POST', 'ok') + '<span class="mono">' + esc(a.id) + '</span><span class="d">' + esc(a.d) + '</span>' +
      (a.grava ? H.chip('grava', 'wn') : H.chip('lê', 'in')) + '</a>';
  }

  function detalhe(a) {
    var r = st.resp[a.id];
    var corpo = st.corpo[a.id] != null ? st.corpo[a.id] : json(a.corpo);
    var h = '<section class="pn" style="gap:14px">' +
      '<div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="h2 mono" style="font-size:18px">' + esc(a.id) + '</h2>' +
      '<span class="row" style="gap:6px">' + H.chip('POST', 'ok') + (a.grava ? H.chip('grava na base', 'wn') : H.chip('só lê', 'in')) + '</span></div>' +
      '<span class="ap-txt">' + a.o_que + '</span>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap"><span class="lab">QUEM PODE</span><span class="note">' + esc(a.quem) + '</span></div>' +
      '<span class="lab">CAMPOS</span>' +
      '<table class="tbl tc ap-tab"><thead><tr><th>CAMPO</th><th>REGRA</th><th>O QUE É</th></tr></thead><tbody>' +
      '<tr><td data-tc="topo"><code>action</code></td><td data-tc="topo-fim">obrigatório</td><td data-tc="largo"><code>"' + esc(a.id) + '"</code></td></tr>' +
      (a.id === 'login' ? '' : '<tr><td data-tc="topo"><code>token</code></td><td data-tc="topo-fim">obrigatório</td><td data-tc="largo">o da ação <code>login</code></td></tr>') +
      a.campos.map(function (c) {
        return '<tr><td data-tc="topo">' + c[0].split(', ').map(function (n) { return '<code>' + esc(n) + '</code>'; }).join(', ') + '</td>' +
          '<td data-tc="topo-fim" style="white-space:nowrap;color:' + (/^obrigat/.test(c[1]) ? 'var(--tx)' : 'var(--tx3)') + '">' + esc(c[1]) + '</td><td data-tc="largo">' + c[2] + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<span class="lab">EXEMPLO</span>' + copiavel(curl(a), 'exemplo de ' + a.id) +
      '<span class="note">Resposta: <span class="mono" style="word-break:break-all">' + esc(a.resposta) + '</span></span></section>';

    if (a.testar === false) {
      h += '<section class="pn"><span class="lab">TESTAR AQUI</span><span class="note">Esta tela já está com o token da sua sessão: as outras ações podem ser chamadas daqui sem fazer login.</span></section>';
      return h;
    }
    h += '<section class="pn" style="gap:12px"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><span class="lab">TESTAR AQUI</span>' +
      '<span class="note">vai com o token da sua sessão; não precisa de <span class="mono">action</span> nem <span class="mono">token</span></span></div>' +
      '<label class="sr" for="ap-corpo" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap">Corpo da chamada</label>' +
      '<textarea class="in ap-corpo" id="ap-corpo" spellcheck="false">' + esc(corpo) + '</textarea>' +
      (a.grava ? '<div class="lock">' + H.ico('alert') + '<span>Esta ação <b>grava na base</b>, como se o sistema tivesse chamado. A tela pede confirmação antes.</span></div>' : '') +
      '<div class="row" style="justify-content:flex-end;gap:8px"><button type="button" class="btn" data-ap="restaurar">Voltar ao exemplo</button>' +
      '<button type="button" class="btnp" data-ap="chamar"' + (st.chamando ? ' disabled' : '') + '>' + (st.chamando === a.id ? 'Chamando…' : H.ico('send') + ' Chamar ' + esc(a.id)) + '</button></div>';
    if (r) {
      h += '<div class="row" style="gap:8px;flex-wrap:wrap">' + H.chip('HTTP ' + r.status, r.status >= 200 && r.status < 300 ? 'ok' : 'dg') +
        '<span class="note">' + esc(r.quando) + (r.ms != null ? ' · ' + r.ms + ' ms' : '') + '</span></div>' + copiavel(json(r.corpo), 'resposta');
    }
    return h + '</section>';
  }

  function render(el, ctx) {
    poeCss();
    var x = exemplos(ctx);
    var lista = acoes(x);
    var sel = lista.filter(function (a) { return a.id === ctx.param; })[0] || lista[1];
    var grupos = [];
    lista.forEach(function (a) { if (grupos.indexOf(a.grupo) < 0) grupos.push(a.grupo); });
    var temas = ((ctx.D || {}).temas || []).slice().sort(function (a, b) { return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'); });

    var h = '<header style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px">' +
      '<div style="display:flex;flex-direction:column;gap:6px;max-width:720px">' +
      (H.pode('configurar') ? '<span class="note"><a href="#configuracoes">Configurações</a> › API e integrações</span>' : '') +
      '<h1 class="h1">API e integrações</h1>' +
      '<span class="sub">A API de demandas para outros sistemas: o mesmo endereço que o AXIS usa, uma ação por chamada, com o token de uma conta. Abrir, procurar, consultar, atualizar, entregar e escrever na demanda.</span></div></header>';

    h += '<div class="ap-grid"><div class="ap-col">' +
      '<section class="pn"><h2 class="h2">Endereço</h2>' +
      '<div class="ap-url"><span class="in" title="' + esc(A.WORKER) + '">' + esc(A.WORKER) + '</span>' +
      '<button type="button" class="btns" data-ap="copiar-url">' + H.ico('clipboard') + ' Copiar</button></div>' +
      '<span class="note">Toda chamada é um <span class="mono">POST</span> com corpo JSON e o campo <span class="mono">action</span>. Primeiro <a class="ap-lk" href="#api/login">login</a> com a conta do sistema; o <span class="mono">token</span> que volta vale 12 horas e vai em todas as outras.</span></section>' +
      '<section class="pn"><h2 class="h2">Ações</h2>' +
      grupos.map(function (g) {
        return '<span class="lab" style="margin-top:4px">' + esc(g) + '</span>' +
          lista.filter(function (a) { return a.grupo === g; }).map(function (a) { return linhaAcao(a, sel.id); }).join('');
      }).join('') + '</section>' +
      '<section class="pn"><h2 class="h2">Chaves e integrações</h2>' +
      '<span class="note">Chaves por sistema com escopo e expiração, uso nas últimas 24 h, documentação OpenAPI e as integrações (login único, Teams, e-mail) ainda não estão disponíveis. Hoje cada sistema entra com uma conta própria pela ação <span class="mono">login</span> e tem a permissão dessa conta. A esteira de deploy usa <span class="mono">deploy-versao</span>, documentada no <a href="dev.html">Meu painel</a>.</span></section>' +
      '</div><div class="ap-col">' + detalhe(sel) + '</div></div>';

    h += '<section class="pn"><details><summary class="row" style="cursor:pointer;justify-content:space-between"><h2 class="h2">Sistemas e <span class="mono">tema_id</span></h2>' +
      '<span class="note">' + H.plural(temas.length, 'sistema', 'sistemas') + ' · clique para abrir</span></summary>' +
      '<div class="ap-temas" style="margin-top:12px">' + temas.map(function (t) {
        return '<span><b>' + esc(JSON.stringify(t.id)) + '</b>' + esc(t.nome || '') + '</span>';
      }).join('') + '</div></details></section>';
    return h;
  }

  function copiar(txt, botao) {
    var ok = function () { var a = botao.innerHTML; botao.innerHTML = H.ico('check') + ' Copiado'; setTimeout(function () { botao.innerHTML = a; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(ok, function () { selecionar(botao); });
    } else selecionar(botao);
  }
  // Area de transferencia bloqueada (http, permissao): seleciona para o Ctrl+C.
  function selecionar(botao) {
    var pre = botao.parentNode.querySelector('pre');
    if (!pre) return;
    var r = document.createRange(); r.selectNodeContents(pre);
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    botao.textContent = 'Ctrl+C';
  }

  async function chamar(el, a) {
    var cx = el.querySelector('#ap-corpo');
    var txt = cx ? cx.value : '{}';
    st.corpo[a.id] = txt;
    var corpo;
    try { corpo = txt.trim() ? JSON.parse(txt) : {}; } catch (e) {
      H.toast('O corpo não é um JSON válido: ' + e.message, 'erro'); return;
    }
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) { H.toast('O corpo tem de ser um objeto JSON: { ... }', 'erro'); return; }
    delete corpo.action; delete corpo.token;
    if (a.grava) {
      var ok = window.confirmar
        ? await window.confirmar({ titulo: 'Chamar ' + a.id, texto: 'Esta chamada grava na base, com a sua conta. Continuar?', ok: 'Chamar' })
        : window.confirm('Esta chamada grava na base. Continuar?');
      if (!ok) return;
    }
    st.chamando = a.id;
    A.desenhar(true);
    var t0 = Date.now(), r;
    try {
      var j = await H.api(a.id, corpo);
      r = { status: 200, corpo: j };
    } catch (e) {
      r = { status: e.status || 0, corpo: e.corpo || { erro: e.message || String(e) } };
    }
    r.ms = Date.now() - t0;
    r.quando = new Date().toLocaleTimeString('pt-BR');
    st.resp[a.id] = r;
    st.chamando = '';
    // Gravou: a base da tela fica velha. Rele, para o resto do app ver a mudanca.
    if (a.grava && r.status >= 200 && r.status < 300) { try { await H.recarregar(); return; } catch (_) {} }
    A.desenhar(true);
  }

  function depois(el, ctx) {
    var lista = acoes(exemplos(ctx));
    var sel = lista.filter(function (a) { return a.id === ctx.param; })[0] || lista[1];
    el.onclick = function (e) {
      var b = e.target.closest('[data-ap]');
      if (!b || b.disabled) return;
      var q = b.getAttribute('data-ap');
      if (q === 'copiar') { var pre = b.parentNode.querySelector('pre'); if (pre) copiar(pre.textContent, b); }
      else if (q === 'copiar-url') copiar(A.WORKER, b);
      else if (q === 'restaurar') { delete st.corpo[sel.id]; A.desenhar(true); }
      else if (q === 'chamar') chamar(el, sel);
    };
    var cx = el.querySelector('#ap-corpo');
    if (cx) cx.addEventListener('input', function () { st.corpo[sel.id] = cx.value; });
  }

  A.tela({
    id: 'api',
    rotulo: 'API e integrações',
    papeis: ['admin', 'analista', 'dev'],
    param: true,
    titulo: function (r) { return 'API e integrações' + (r.param ? ' · ' + r.param : ''); },
    render: render,
    depois: depois
  });
})();
