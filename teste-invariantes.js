/* ─────────────────────────────────────────────────────────────────────────
   INVARIANTES DO PROJETO

   Rode antes de publicar:   node teste-invariantes.js

   Cada regra aqui nasceu de um defeito que chegou em producao nesta ferramenta.
   Nao e teste de comportamento — e uma trava contra a MESMA falha estrutural
   voltar: regra escrita em varios lugares, uma copia corrigida e a outra nao.
   Foi assim com o acesso ao anexo, ao planejamento, ao planning poker, com os
   acentos corrompidos e com o "salva" que nao salvava.

   Quando uma regra passa a existir em dois lugares e nao da para consolidar,
   a saida e travar aqui. Falhar este arquivo e mais barato que descobrir na
   reuniao.
   ───────────────────────────────────────────────────────────────────────── */
const fs = require('fs');

let falhas = 0;
const ok = (cond, titulo, detalhe) => {
  if (!cond) falhas++;
  console.log('  ' + (cond ? 'OK  ' : 'FALHOU ') + titulo + (detalhe ? '  ' + detalhe : ''));
};
const sec = (t) => console.log('\n== ' + t + ' ==');

const W = fs.readFileSync('cloudflare-worker/worker.js', 'utf8');
// Sem comentarios: as regras abaixo procuram CODIGO. Comentario explicando um
// defeito antigo ("nao usar atob") nao pode contar como o defeito.
const semComentario = (t) => t.replace(/^\s*\/\/.*$/gm, '');
const WC = semComentario(W);
const lerTela = (f) => fs.readFileSync(f, 'utf8');
const ADMIN = lerTela('admin.html');
const GANTT = lerTela('gantt.html');
const DEV = lerTela('dev.html');
const INDEX = lerTela('index.html');
const POKER = lerTela('poker.html');
const APRES = fs.readFileSync('apresentacao.js', 'utf8');
const CAPA = fs.readFileSync('capa-tecnologia.js', 'utf8');
const PIPE = fs.readFileSync('pipelines.js', 'utf8');
const PRZ = fs.readFileSync('prazo.js', 'utf8');
const CAPJS = fs.readFileSync('capacidade.js', 'utf8');
const TEMA = lerTela('tema.css');

// Corpo de uma funcao, por contagem de chaves.
function corpo(src, assinatura) {
  const i = src.indexOf(assinatura);
  if (i < 0) return null;
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  return null;
}
const semEspaco = (t) => String(t || '').replace(/\s+/g, ' ').trim();

// ═══════════════════════════════════════════════════════════════════════
sec('Acentuacao dos dados (1864 acentos corrompidos em 04/08/2026)');

// atob devolve os bytes como Latin-1. Uma rota leu o arquivo assim e a gravacao
// seguinte assou a mojibake no repositorio.
ok(!/atob\(file\.content/.test(WC),
   'nenhuma rota le o conteudo com atob(file.content)');

// Toda leitura de conteudo tem de pedir o media type raw, que ja vem decodificado.
const leituras = W.match(/gh\('contents\/' \+ FILE_PATH \+ '\?raw='[^;]*;/g) || [];
ok(leituras.length > 0 && leituras.every(l => /vnd\.github\.raw/.test(l)),
   'toda leitura de conteudo pede o media type raw',
   leituras.length + ' leitura(s)');

// ═══════════════════════════════════════════════════════════════════════
sec('Acesso: uma regra, um lugar');

// A porteira do planning poker checava so a senha compartilhada e ficou fora do
// meu replace por ter indentacao diferente. Quem entrava pela conta abria a sala
// e era recusado em tudo depois.
const blocoPoker = W.slice(W.indexOf("startsWith('poker-')"),
                            W.indexOf("if (body.action === 'dados')"));
const senhaSozinha = (blocoPoker.match(/if \(!senhaOk\(body\.senha\)\)/g) || []).length;
ok(senhaSozinha === 0,
   'no bloco do poker, nenhuma acao confere APENAS a senha compartilhada',
   senhaSozinha ? senhaSozinha + ' ocorrencia(s)' : '');
ok(/const facilitadorOk = async/.test(blocoPoker),
   'o poker tem um unico ponto de decisao (facilitadorOk)');

// Exigir papel passa por exigePapel. identifica direto so e aceito onde a
// semantica e OUTRA, e sao tres casos:
//   1. dentro do proprio helper exigePapel;
//   2. quem-sou, que REPORTA o papel em vez de exigir um;
//   3. senha-alterar, que precisa de "tem conta propria" e nao de papel — trocar
//      a senha e de qualquer papel, e quem entrou pela senha compartilhada nao tem
//      senha individual para trocar. exigePapel responderia a pergunta errada.
//   4. meu-nome-demandas, pela mesma razao da 3: a pergunta e "tem conta e qual e
//      o id dela", porque a escrita e na PROPRIA conta. Papel nao decide nada aqui
//      — o que decide e de quem e a sessao.
const diretos = (W.match(/const ident\w* = await identifica\(env, body\);/g) || []).length;
ok(diretos <= 4, 'identifica chamado direto apenas onde a semantica difere',
   diretos + ' ocorrencia(s) (helper + quem-sou)');
ok((W.match(/exigePapel\(env, body/g) || []).length >= 4,
   'as rotas que exigem papel usam exigePapel');

// O anexo tem de aceitar conta propria, nao so a senha compartilhada: foi o que
// deixou o dev sem anexar imagem.
const anexo = W.slice(W.indexOf("body.action === 'anexo-subir'"),
                      W.indexOf("body.action === 'anexo-subir'") + 900);
ok(/await ehDev\(\)/.test(anexo), 'anexo-subir aceita conta propria (ehDev)');

// Mensagem de deboche: nunca mais em resposta ao cliente.
ok(!/Parabens pela tentativa/.test(WC) && !/mensagem: troll/.test(WC),
   'nenhuma resposta acusa o usuario de invasao');

// ═══════════════════════════════════════════════════════════════════════
sec('Etapa de validacao PM/PO nao se pula');

const atualizar = W.slice(W.indexOf("body.action === 'demanda-atualizar'") - 2000,
                          W.indexOf("if (body.action === 'projeto-novo')"));
ok(!/body\.status_planejamento/.test(atualizar),
   'a API nao aceita status_planejamento no corpo');
ok(/ETAPAS_DEV = \['backlog', 'levantar_req', 'planning', 'planejado', 'em_andamento'\]/.test(W),
   'a etapa pela API vai no maximo a em_andamento');
ok(/NAO grava concluido_em/.test(W),
   'demanda-entregar nao grava a data de conclusao (ela nasce na aprovacao)');

const modalDev = corpo(DEV, 'function openStatusModal(');
ok(modalDev && /ms-status-group/.test(modalDev) && /ms-trava/.test(modalDev),
   'o card do dev esconde o seletor de etapa em validacao');
const saveDev = corpo(DEV, 'async function saveStatus()');
ok(saveDev && /\['validacao', 'concluido'\]\.includes\(getStatusKey\(atual\)\)/.test(saveDev),
   'saveStatus recusa gravar o que esta com o PM/PO');
ok(/async function salvarEntrega\(\)/.test(DEV) && !/status_planejamento/.test(
     corpo(DEV, 'async function salvarEntrega()') || 'status_planejamento'),
   'salvarEntrega grava a entrega sem tocar na etapa');

// ═══════════════════════════════════════════════════════════════════════
sec('Gravacao: nada fica so na tela');

// Quatro acoes do Admin diziam "salva" sem gravar. Uma demanda criada dentro de um
// projeto ficou no navegador e nunca chegou ao funil do dev.
ok(!/Clique em "Publicar alterações" para ir ao ar/.test(ADMIN),
   'nenhuma acao promete estar salva esperando um segundo clique');
for (const fn of ['saveMelhoria', 'deleteMelhoria', 'saveTema', 'deleteTema']) {
  const c = corpo(ADMIN, 'async function ' + fn + '(');
  ok(!!c && /mPersistir\(/.test(c), fn + ' grava no servidor');
}

// Chave de topo criada por outra tela nao pode ser apagada ao publicar: foi assim
// que `projetos` desapareceu a cada gravacao do planejamento.
for (const [nome, src] of [['admin', ADMIN], ['gantt', GANTT]]) {
  ok(/MEUS_CAMPOS/.test(src) && /!MEUS_CAMPOS\.includes\(k\)/.test(src),
     nome + ' preserva as chaves de topo que nao sao dele');
}

// Campo por demanda: o spread de `existing` e o que protege o que o formulario
// nao conhece (pausa, grill, historico...).
ok(/const obj = \{\s*\n\s*\.\.\.existing,/.test(ADMIN), 'admin parte de ...existing ao montar a demanda');
ok(/\.\.\.existing,\s*\/\/ preserva campos/.test(GANTT), 'gantt parte de ...existing ao montar a demanda');

// ═══════════════════════════════════════════════════════════════════════
sec('Historico: do servidor, e nao se apaga pelo corpo');

const hist = corpo(W, 'function registraHistorico(');
ok(!!hist && /Array\.isArray\(velha\.historico\) \? velha\.historico : \[\]/.test(hist),
   'a base do historico e o que esta gravado, nao o que veio no corpo');
ok(!!hist && /slice\(-HIST_MAX\)/.test(hist), 'ha teto por demanda');
ok(/registraHistorico\(/.test(W) &&
   (W.match(/registraHistorico\(/g) || []).length >= 4,
   'as tres portas registram (publish, dev-publish, api)',
   (W.match(/registraHistorico\(/g) || []).length + ' chamada(s) + a definicao');

// ═══════════════════════════════════════════════════════════════════════
sec('Copias que nao consolidei: travadas contra divergencia');

// Estas funcoes existem em mais de uma tela porque as paginas nao compartilham
// modulo. Consolidar exigiria carregar um script novo em cada uma; enquanto isso
// nao acontece, o risco real e uma copia mudar sozinha.
const pares = [
  ['marcaConclusao', [['admin', ADMIN], ['gantt', GANTT]]],
  ['estaPausado', [['admin', ADMIN], ['gantt', GANTT], ['dev', DEV]]],
];
for (const [nome, telas] of pares) {
  const corpos = telas.map(([t, src]) => {
    const c = corpo(src, 'function ' + nome + '(') ||
              (src.match(new RegExp('const ' + nome + ' = [^\\n]+')) || [])[0];
    return [t, semEspaco(c)];
  });
  const primeiro = corpos[0][1];
  const iguais = corpos.every(([, c]) => c === primeiro);
  ok(iguais && !!primeiro, nome + ' identico em ' + telas.map(t => t[0]).join(', '),
     iguais ? '' : 'divergiu: ' + corpos.filter(([, c]) => c !== primeiro).map(x => x[0]).join(', '));
}

// subirAnexo vive em tres telas. A credencial ja errou uma vez (montada a mao com
// so a senha), entao aqui se garante que as tres usam o montador da propria tela.
for (const [nome, src, cred] of [['admin', ADMIN, 'credAdmin()'],
                                 ['gantt', GANTT, 'credGantt()'],
                                 ['dev', DEV, 'credDev()']]) {
  const chamadas = (src.match(/subirAnexo\(f, reader\.result, [^)]*\)/g) || []);
  ok(chamadas.length > 0 && chamadas.every(c => c.includes(cred)),
     nome + ': anexo usa ' + cred + ' (token E senha), nao credencial montada a mao',
     chamadas.length + ' chamada(s)');
}

// A zona de anexo e compartilhada de verdade: um arquivo, quatro telas.
for (const [nome, src] of [['admin', ADMIN], ['gantt', GANTT], ['dev', DEV], ['index', INDEX]]) {
  ok(/<script src="anexo-cola\.js\?v=[a-f0-9]+"><\/script>/.test(src),
     nome + ' carrega anexo-cola.js com hash de versao');
}

// ═══════════════════════════════════════════════════════════════════════
sec('Papel: nunca concedido por omissao');

// Liberar um cadastro pendente caia em 'dev' quando o corpo nao mandava o papel —
// e 'dev' GRAVA. A rota de criar conta usava 'consulta' no mesmo lugar: dois
// padroes para a mesma decisao, com o inseguro no caminho mais usado.
ok(!/PAPEIS\.includes\(body\.papel\) \? body\.papel : 'dev'/.test(W),
   'nenhuma rota concede dev por omissao');
ok(/PAPEIS\.includes\(body\.papel\) \? body\.papel : 'consulta'/.test(W),
   'criar conta segue no menor privilegio');
ok(/error: 'papel_obrigatorio'/.test(W), 'aprovar exige papel explicito');
// A tela tambem inventava 'dev' quando nao achava o select.
ok(!/papel: sel \? sel\.value : 'dev'/.test(ADMIN), 'a tela nao inventa papel');
ok(/— escolha o papel —/.test(ADMIN), 'o seletor de papel nasce sem escolha feita');

// ═══════════════════════════════════════════════════════════════════════
sec('Estado: uma fonte de verdade');

// A base tinha DUAS maquinas de estado. Divergiam em 91 dos 201 registros, e duas
// demandas negadas apenas no campo legado apareciam como fila de entrada — a API
// derivava backlog de um status_planejamento vazio. Contagem por etapa errava.
ok(/const SP_PARA_STATUS = \{/.test(W), 'existe UM mapa etapa -> status legado');
const norm = corpo(W, 'function normalizaEstados(');
ok(!!norm, 'existe normalizaEstados');
ok(!!norm && /if \(!esperado\) continue;/.test(norm),
   'etapa vazia ou desconhecida NAO e adivinhada (foi assim que as negadas sumiram)');
// Toda porta de gravacao alinha o legado antes de gravar.
ok((W.match(/normalizaEstados\(/g) || []).length >= 4,
   'as tres portas de gravacao alinham o status (publish, dev-publish, api)',
   (W.match(/normalizaEstados\(/g) || []).length + ' chamada(s) + a definicao');
// Ninguem mais escreve 'negada' no campo legado a mao.
const negar = W.slice(W.indexOf("body.action === 'poker-negar'"),
                      W.indexOf("body.action === 'poker-negar'") + 2200);
ok(/SP_PARA_STATUS\.negada/.test(negar), 'poker-negar tira o status do mapa, nao a mao');

// ═══════════════════════════════════════════════════════════════════════
sec('Prazo: atraso derivado no servidor, e no fuso do Brasil');

// Nada na API falava de prazo. 15 demandas ativas estavam vencidas e invisiveis
// para quem consome pela API — prazo vencido que ninguem ve e como a demanda morre
// sem ninguem cobrar.
const atraso = corpo(W, 'function diasDeAtraso(');
ok(!!atraso, 'existe diasDeAtraso, um lugar so');
// O FUSO: o Worker roda em UTC e o Brasil e UTC-3. Com a data do servidor, das 21h
// a meia-noite "hoje" ja seria amanha e uma demanda que vence HOJE apareceria
// vencida tres horas antes de o dia acabar para quem olha a tela.
ok(/timeZone: 'America\/Sao_Paulo'/.test(W), 'a data de hoje sai no fuso de Sao Paulo');
ok(!/atrasada:[^,]*new Date\(\)\.toISOString/.test(W),
   'o derivado nao usa a data crua do servidor');
// Comparacao por string ISO. `new Date('2026-08-06')` e meia-noite UTC, e converter
// para local muda o dia: ja custou off-by-one aqui.
ok(!!atraso && !/new Date\(entrega/.test(atraso),
   'a comparacao de datas e por string ISO, nunca por objeto Date');
// Pausada tem o prazo suspenso por dependencia externa. Contar como atraso faria o
// vermelho perder sentido para as que dependem do time — e a regra que as telas ja
// aplicam, e o derivado nao pode discordar delas.
ok(!!atraso && /pausado_em/.test(atraso), 'demanda pausada nao conta como atrasada');
ok(!!atraso && /'concluido'/.test(atraso) && /'negada'/.test(atraso),
   'concluida e negada nao contam como atrasadas');
ok(!!atraso && /\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$/.test(atraso),
   'sem data de entrega valida nao ha atraso (e nao quebra)');
// O derivado tem de chegar em quem consome, senao a regra fica escrita e sem uso.
ok(/atrasada: diasDeAtraso\(/.test(W) && /dias_atraso: diasDeAtraso\(/.test(W),
   'a visao da API entrega atrasada e dias_atraso');
ok(/body\.atrasadas === true/.test(W),
   'demandas-minhas filtra por atrasadas sem o cliente recalcular a regra');

// ═══════════════════════════════════════════════════════════════════════
sec('Custo: nada chega a Concluido sem hora registrada');

// A hora realizada e a unica medida de custo da base. A entrega do dev ja exigia
// horas; quem CONCLUI e o PM/PO, e nenhum caminho dele cobrava nada — 54 das 95
// concluidas ficaram com zero (so 2 tinham entregue_em: nao passaram pela entrega).
const semH = corpo(W, 'function entrandoEmConcluidoSemHoras(');
ok(!!semH, 'existe a trava de horas, um lugar so');
// Trava na TRANSICAO, nao no estado: travar por estado engessaria a base historica
// e faria qualquer save do admin falhar por causa de um registro de junho.
ok(!!semH && /if \(!velha\) continue;/.test(semH),
   'demanda que o servidor nao conhece passa (e o import de historico)');
ok(!!semH && /=== 'concluido'\) continue;/.test(semH),
   'quem JA estava concluido sem hora segue gravavel');
// As duas portas de gravacao completa.
ok((W.match(/entrandoEmConcluidoSemHoras\(/g) || []).length >= 3,
   'publish e dev-publish aplicam a trava',
   (W.match(/entrandoEmConcluidoSemHoras\(/g) || []).length + ' ocorrencia(s)');
// A recusa vem ANTES do historico: gravar trilha de uma publicacao recusada
// deixaria no card um evento que nao aconteceu.
for (const [rot, ancora] of [['publish', 'antesPub'], ['dev-publish', 'antesDev']]) {
  const i = W.indexOf('const semHoras' + (ancora === 'antesPub' ? 'Pub' : 'Dev'));
  const j = W.indexOf('registraHistorico(data, ' + ancora);
  ok(i > 0 && j > 0 && i < j, rot + ': a recusa por horas vem antes de registrar historico');
}
// As telas barram antes, para a recusa do servidor nao chegar como erro seco.
ok(/function pedeHoras\(/.test(ADMIN) && /pedeHoras\(m, colKey\)/.test(ADMIN),
   'admin: arrastar para Concluido cobra as horas antes de gravar');
ok((ADMIN.match(/Informe as horas de desenvolvimento/g) || []).length >= 1 &&
   /aprovar && !\(Number\(m\.horas_realizadas\) > 0\)/.test(ADMIN),
   'admin: aprovar a entrega tambem cobra as horas');
ok(/e-horas-real'\)\.value \|\|\s*\n?\s*existing\.horas_realizadas/.test(GANTT) ||
   /existing\.horas_realizadas \|\| 0/.test(GANTT),
   'gantt: campo de horas vazio NAO zera a hora que o dev registrou');

// ═══════════════════════════════════════════════════════════════════════
sec('Podio: um chip, duas telas');

// O chip de colocacao aparece no painel Dev e no ranking do Planejamento. Duas
// copias de CSS divergiriam na primeira mexida, e as duas telas sao comparadas
// lado a lado na reuniao.
ok(/\.prod-medalha \{/.test(TEMA), 'o chip do podio esta em tema.css');
for (const [nome, src] of [['dev', DEV], ['gantt', GANTT]]) {
  ok(!/\.prod-medalha \{/.test(src), nome + ' nao redeclara o chip do podio');
  ok(/--ouro-bg:/.test(src) && /--prata-bg:/.test(src) && /--bronze-bg:/.test(src),
     nome + ' declara os tokens do podio no seu :root escuro');
}
// O tema claro tem de ter o par, senao o chip fica ilegivel sobre branco.
ok(/:root\[data-tema="claro"\][\s\S]*--ouro-bg:/.test(TEMA),
   'o tema claro tem o par de cores do podio');
// O ranking soma PONTOS e divide demanda de dois devs: sem dividir, a soma do
// ranking passaria do total do mes e o numero perderia credibilidade.
const rk = corpo(GANTT, 'function rankDoMes(');
ok(!!rk && /\/ devs\.length/.test(rk),
   'demanda de dois devs divide os pontos, para o ranking fechar com o card ao lado');
ok(!!rk && /b\.pontos - a\.pontos/.test(rk),
   'o ranking ordena por pontos, nao por contagem de issues');

// ═══════════════════════════════════════════════════════════════════════
sec('Posse da demanda: declarada, nao adivinhada');

// A heuristica de prefixo resolveu o caso do nome completo ("Joao Vitor Batista de
// Siqueira" contra "Joao Vitor") mas exige dois nomes: "Gabriel" sozinho nunca
// casaria com "Gabriel Rodrigues", e afrouxar para um nome faria "Joao" casar com
// qualquer Joao da equipe. Medido: 7 das 9 contas nao reconheciam NENHUMA demanda.
ok(/'usuario', 'nome_demandas'/.test(W), 'a conta tem o campo do nome usado nas demandas');
ok(/u\.nome_demandas/.test(W), 'identifica traz o campo junto da sessao');
ok(/nome_demandas[\s\S]{0,600}?normNome\(n\) === normNome\(a\)/.test(W),
   'com o campo preenchido a comparacao e EXATA, nao por prefixo');
// A HEURISTICA MORREU, e esta invariante inverteu junto. Ela existia para quem
// nao tinha o campo declarado, e o argumento era "ninguem fica pior do que
// estava" — o que valia enquanto so havia contas antigas. Na primeira conta nova
// ela mostrou a fila de outra pessoa: "lucas.santos" caiu em "Joao Lucas".
// Hoje o nome sai do e-mail no cadastro, entao ha sempre algo exato para comparar.
const dono = corpo(W, 'const meuDono = m => {');
ok(!!dono && !/mesmaPessoa\(n, eu\)/.test(dono),
   'sem o campo, NAO ha heuristica: vale o nome derivado do e-mail, por igualdade');
// Quem escolhe a carteira e o admin. Se o dev pudesse declarar, escolheria de quem
// sao as demandas — e a posse deixaria de significar algo.
const opND = W.slice(W.indexOf("op === 'nome-demandas'"), W.indexOf("op === 'nome-demandas'") + 1400);
ok(W.indexOf("op === 'nome-demandas'") > W.indexOf("exigePapel(env, body, ['admin'], headers)"),
   'declarar o nome e acao de admin');
ok(/muitos_nomes/.test(opND), 'ha limite de nomes por conta');
// "total: 0" sem diagnostico foi a duvida que gerou o chamado do dev.
ok(/nomes_procurados:/.test(W) && /criterio:/.test(W),
   'a resposta diz por qual nome procurou, para 0 ter diagnostico');
// A tela: escolher da lista que existe, nao digitar.
ok(/function uCelulaNomeDemandas\(/.test(ADMIN), 'admin tem a celula do nome nas demandas');
ok(/uDevsDosCards\(\)/.test(corpo(ADMIN, 'function uCelulaNomeDemandas(') || ''),
   'o seletor oferece os nomes que EXISTEM na base, sem digitacao livre');
ok(/us-alerta/.test(ADMIN), 'conta de dev que nao alcanca nada aparece marcada');
// escAttr existe no painel dev e NAO no admin: chamar la quebraria na renderizacao,
// e nenhuma checagem de sintaxe pega isso.
ok(!/escAttr\(/.test(ADMIN), 'admin nao chama escAttr, que so existe no painel dev');
// O papel analista tinha de estar em TODA lista de papel da tela de contas.
ok(/analista: 'Analista de Requisitos'/.test(ADMIN), 'a tela tem rotulo para analista');
ok(!/\['consulta', 'dev', 'admin'\]/.test(ADMIN),
   'nenhuma lista de papel na tela esquece o analista');

// ═══════════════════════════════════════════════════════════════════════
sec('Modelo de descricao: um arquivo, tres telas, e aviso que nao trava');

const MODELO = lerTela('modelo-descricao.js');
// Um arquivo so. Tres copias do modelo divergiriam na primeira mexida, e o padrao
// que ele existe para criar deixaria de existir.
for (const [nome, src] of [['admin', ADMIN], ['gantt', GANTT], ['dev', DEV]]) {
  ok(/modelo-descricao\.js\?v=/.test(src), nome + ' carrega o modelo compartilhado');
  ok(!/OBJETIVO DA ALTERA/.test(src), nome + ' nao tem copia do texto do modelo');
  // O modelo NAO bloqueia mais: bloqueava e atrapalhou (seis secoes antes de
  // gravar qualquer coisa). Esta invariante inverteu de proposito — se o bloqueio
  // voltar, ela falha.
  ok(!/!validaModeloDescricao\(/.test(src),
     nome + ' NAO bloqueia o salvamento pelo texto (so campo obrigatorio bloqueia)');
  ok(/ligaModeloDescricao\(/.test(src), nome + ' liga o botao no campo de descricao');
}
// A cobranca: linha de orientacao nao conta como conteudo. Sem isto, inserir o
// modelo e salvar passaria — e o pedido foi exatamente nao aceitar isso.
// Aqui a invariante EXECUTA o modulo em vez de procurar o regex no fonte: as duas
// primeiras versoes desta checagem passaram por engano porque o meu proprio regex
// estava escapado errado. Comportamento nao tem como passar por engano.
let MD = null;
try {
  const salvoW = global.window, salvoD = global.document;
  global.window = {};
  global.document = {
    createElement: () => ({ textContent: '', style: {}, set onclick(v) {},
                            appendChild() {}, insertBefore() {},
                            classList: { add() {}, remove() {} } }),
    head: { appendChild() {} },
    getElementById: () => null,
  };
  require('./modelo-descricao.js');
  MD = global.window;
  global.window = salvoW; global.document = salvoD;
} catch (e) { MD = null; }
ok(!!MD && typeof MD.modeloDescricaoPendencias === 'function',
   'o modulo do modelo carrega e expoe a validacao');
if (MD) {
  const M = MD.MODELO_DESCRICAO;
  // O caso central: inserir o modelo e salvar sem escrever nada e RECUSADO.
  ok(MD.modeloDescricaoPendencias(M).length === 6,
     'modelo intacto: as 6 secoes contam como em branco',
     MD.modeloDescricaoPendencias(M).length + ' pendencia(s)');
  // Apagar as orientacoes tambem nao vale por preenchimento.
  const semGuia = M.split('\n').filter(l => !/^\s*>/.test(l)).join('\n');
  ok(MD.modeloDescricaoPendencias(semGuia).length === 6,
     'apagar as orientacoes sem escrever nada segue contando como em branco');
  // Caixa em branco e modelo intacto; caixa marcada e resposta.
  ok(MD.modeloDescricaoPendencias(M.replace('[ ] PDF', '[x] PDF'))
       .indexOf('Impactos em documentos e relatórios') < 0,
     'marcar [x] preenche a secao de documentos');
  ok(MD.modeloDescricaoPendencias(M).indexOf('Impactos em documentos e relatórios') >= 0,
     'caixa em branco NAO preenche a secao');
  // Contornar com um caractere nao passa.
  ok(MD.modeloDescricaoPendencias(M.replace('1. OBJETIVO DA ALTERAÇÃO',
       '1. OBJETIVO DA ALTERAÇÃO' + String.fromCharCode(10) + 'x'))
       .indexOf('Objetivo da alteração') >= 0,
     'um caractere solto nao conta como especificacao');
  // Nenhum bloqueio retroativo: 200+ demandas em texto livre seguem salvando.
  ok(MD.modeloDescricaoPendencias(
       'Ambientes de Cadastro e Reanalise - trazer a somatoria em tela.').length === 0,
     'texto livre de demanda antiga nao recebe aviso nenhum');
  ok(!MD.modeloDescricaoUsa('Preciso mudar a regra de negocio do rating'),
     'mencionar uma secao de passagem nao vira cobranca');
}
// Minimo de caracteres: "x" nao e especificacao, e aceitar viraria ritual.
ok(/length < 3/.test(MODELO), 'um caractere solto nao passa por especificacao');
// Cobra apenas quem usou o modelo: 200+ demandas antigas em texto livre nao podem
// parar de salvar por causa de uma padronizacao nova.
const usa = corpo(MODELO, 'function usaModelo(');
ok(!!usa && /achou >= 2/.test(usa),
   'texto livre sem os titulos NAO e cobrado (nada de bloqueio retroativo)');
// Nunca sobrescrever texto digitado sem confirmar: e o pior defeito que esta
// ferramenta ja teve, e ja aconteceu.
const ins = corpo(MODELO, 'function inserir(');
ok(!!ins && /window\.confirm/.test(ins), 'inserir o modelo nunca apaga texto sem confirmar');
// A mensagem tem de dizer O QUE falta, nao so que falta.
ok(/falta\.join\(', '\)/.test(MODELO), 'o aviso nomeia as secoes que faltam');
// O aviso ao vivo continua: ele informa. O que saiu foi o bloqueio.
ok(/de 6 seções em branco/.test(MODELO), 'o aviso ao vivo continua contando as secoes');

// ═══════════════════════════════════════════════════════════════════════
sec('Sessao: quem perde a credencial tem caminho de volta');

// O painel do dev decidia "esta logado" pelo sessionStorage, que nao expira junto
// com a sessao do Worker (12h). Resultado: tela abria, a pessoa trabalhava, toda
// gravacao falhava — e nao havia botao de sair, so "trocar de dev", que mantem a
// credencial. Ficava presa ate limpar o navegador na mao.
ok(/onclick="sairDev\(\)"/.test(DEV), 'o painel do dev tem botao de sair');
const bootDev = corpo(DEV, 'async function initApp()');
ok(!!bootDev && /await sessaoDevValida\(\)/.test(bootDev),
   'o boot pergunta ao servidor se a credencial ainda vale');
ok(!!bootDev && /limpaCredenciaisDev\(\)/.test(bootDev),
   'e limpa a credencial vencida em vez de abrir o painel');
const subir = corpo(DEV, 'async function subirAnexo(');
ok(!!subir && !/recarregue a página \(F5\)/.test(subir),
   'nenhuma mensagem manda recarregar para resolver sessao (o token fica no storage)');

// ═══════════════════════════════════════════════════════════════════════
sec('Discovery: os campos sao os que o dash grava, nao os que alguem supoe');

// Eu escrevi o painel do poker recortando tres campos que INVENTEI (objetivo,
// impacto, beneficiados) — e dois nao existem: o dash grava `beneficiarios`, e
// contexto/escopo/regras_negocio sao objetos, nao texto. Aqui se garante que as
// duas telas leem os MESMOS campos do dado real.
const CAMPOS_DISCOVERY = ['tipo', 'area_solicitante', 'impacto', 'beneficiarios',
  'ganho', 'contexto', 'requisitos_funcionais', 'regras_negocio', 'escopo',
  'criterios_aceite'];
const rendAdmin = corpo(ADMIN, 'function renderMDiscovery(');
const rendPoker = corpo(POKER, 'function discoveryHTML(');
for (const campo of CAMPOS_DISCOVERY) {
  ok(!!rendAdmin && rendAdmin.includes('d.' + campo),
     'admin le discovery.' + campo);
  ok(!!rendPoker && rendPoker.includes('d.' + campo),
     'poker le discovery.' + campo);
}
// Campo inventado nao pode voltar.
for (const falso of ['d.beneficiados', 'd.objetivo']) {
  ok(!rendPoker.includes(falso), 'poker nao le ' + falso + ' (campo que nao existe)');
}
// O inverso tambem: campo que o dash passou a gravar e ninguem exibe e dado morto.
// Foi assim que os inventados sobreviveram — escritos de um lado, lidos de nenhum.
for (const novo of ['local_implementacao', 'documentos_afetados']) {
  ok(INDEX.includes(novo), 'o dash grava discovery.' + novo);
  ok(ADMIN.includes('d.' + novo), 'admin exibe discovery.' + novo);
  ok(POKER.includes('d.' + novo), 'poker exibe discovery.' + novo);
}
// A fila nao pode recortar o discovery: recortar foi o que escondeu os campos.
const enxuta = W.slice(W.indexOf('const enxuta = (m) =>'), W.indexOf('const todas = data.melhorias'));
ok(/discovery: \(m\.discovery && typeof m\.discovery === 'object'/.test(enxuta) &&
   !/discovery: \{/.test(enxuta),
   'a fila do poker manda o discovery inteiro, sem recortar campo');
ok(!/dados:/.test(enxuta) && /anexos: \(m\.anexos \|\| \[\]\)\.map/.test(enxuta),
   'a fila manda a referencia do anexo, nunca o base64');

// ═══════════════════════════════════════════════════════════════════════
sec('Cache: arquivo compartilhado sempre versionado por hash');

for (const [nome, src] of [['admin', ADMIN], ['gantt', GANTT], ['dev', DEV],
                           ['index', INDEX], ['poker', POKER]]) {
  const semHash = (src.match(/src="(tema\.js|anexo-cola\.js|modelo-descricao\.js|links-github\.js|senha\.js|dialogo\.js|apresentacao\.js)"/g) || [])
    .concat(src.match(/href="tema\.css"/g) || []);
  ok(semHash.length === 0, nome + ' nao referencia arquivo compartilhado sem ?v=',
     semHash.join(' '));
}

// ═══════════════════════════════════════════════════════════════════════
sec('Sintaxe de cada tela');

for (const [nome, src] of [['admin', ADMIN], ['gantt', GANTT], ['dev', DEV],
                           ['index', INDEX], ['poker', POKER]]) {
  const blocos = src.match(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g) || [];
  const js = blocos.map(b => b.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')).join('\n');
  let erro = null;
  try { new Function(js); } catch (e) { erro = e.message; }
  ok(!erro, nome + '.html: script sem erro de sintaxe', erro || '');
  // Funcao declarada duas vezes: a segunda substitui a primeira em silencio. Foi o
  // que quase aconteceu com valDecidir, que teria quebrado toda a aprovacao.
  const nomes = [...js.matchAll(/^(?:async )?function ([A-Za-z_$][\w$]*)\s*\(/gm)].map(m => m[1]);
  const dup = [...new Set(nomes.filter((n, i) => nomes.indexOf(n) !== i))];
  ok(dup.length === 0, nome + '.html: nenhuma funcao declarada duas vezes',
     dup.length ? dup.join(', ') : nomes.length + ' funcoes');
}

// =====================================================================
// Escape que o JavaScript nao tem. \U (maiusculo) nao existe: o backslash e
// descartado em silencio e o literal "U0001F947" vai para a tela. Veio de patch
// escrito em Python, onde \U0001F947 E um escape valido — a mesma sequencia
// significa coisas diferentes nas duas linguagens, e nada acusa: sem erro de
// sintaxe, sem aviso, o texto so sai errado.
for (const [nome, src] of [['admin', ADMIN], ['gantt', GANTT], ['dev', DEV],
                           ['index', INDEX], ['poker', POKER], ['modelo', MODELO]]) {
  const achados = src.match(/\\\\U[0-9A-Fa-f]{4,8}/g) || [];
  ok(achados.length === 0, nome + ' nao usa escape \\U, que o JS nao entende',
     achados.slice(0, 3).join(' '));
}

// A regra de "nao passou pelo Planning Poker" existe em TRES telas. Se divergir, a
// mesma demanda aparece marcada numa e limpa na outra, e ninguem sabe qual vale.
// Nao consolidei em arquivo compartilhado por serem 4 linhas; a invariante paga o
// preco de manter as copias honestas.
{
  const nrm = t => String(t || '').replace(/\s+/g, ' ').trim();
  const g = nrm(corpo(GANTT, 'function semPontuacao('));
  const a = nrm(corpo(ADMIN, 'function semPontuacao('));
  const d = nrm(corpo(DEV, 'function semPontuacao('));
  ok(!!g && !!a && !!d, 'as tres telas tem a regra do sem pontuacao');
  ok(g === a && a === d, 'a regra e identica nas tres telas (admin, gantt, dev)');
  ok(/card-sempt/.test(GANTT), 'a linha do tempo marca a demanda sem pontuacao');
}

// ═══════════════════════════════════════════════════════════════════════
sec('Referencia ao GitHub: issue, PR e milestone');

// Antes era UM campo `link_externo`, preenchido em ZERO das 201 demandas. Duas
// razoes: um slot para tres coisas nao serve para nenhuma, e ele nunca existiu em
// tela alguma — so a API o aceitava. Um campo que nao tem onde ser digitado nao e
// campo, e nenhum teste pegava isso porque a API respondia certo.
const LINKS = lerTela('links-github.js');
for (const [nome, src] of [['admin', ADMIN], ['gantt', GANTT], ['dev', DEV]]) {
  ok(/links-github\.js\?v=/.test(src), nome + ' carrega o modulo compartilhado');
  ok(/id="[a-z]+-link-issue"/.test(src), nome + ' TEM o campo de issue em tela');
  ok(/id="[a-z]+-link-pr"/.test(src), nome + ' TEM o campo de PR em tela');
  ok(/id="[a-z]+-link-milestone"/.test(src), nome + ' TEM o campo de milestone em tela');
  ok(/ghLinkPreenche\(/.test(src), nome + ' preenche os campos ao abrir');
}
// Gravar: admin, gantt e as DUAS portas do dev (salvarEntrega e updateStatus).
// O patch do dev leva so os campos listados, entao esquecer uma porta faria o
// numero digitado desaparecer ao arrastar o card.
ok((ADMIN.match(/ghLinkColeta\(/g) || []).length >= 1, 'admin grava os links');
ok((GANTT.match(/ghLinkColeta\(/g) || []).length >= 1, 'gantt grava os links');
ok((DEV.match(/ghLinkColeta\(/g) || []).length >= 2,
   'dev grava os links nas DUAS portas de saida do card',
   (DEV.match(/ghLinkColeta\(/g) || []).length + ' chamada(s)');
// O servidor tambem, senao a automacao do dev nao consegue gravar.
for (const campo of ['link_issue', 'link_pr', 'link_milestone']) {
  ok(W.includes(campo), 'o worker conhece ' + campo);
  ok(new RegExp(campo + ":\\s*m\\." + campo).test(W), 'a API devolve ' + campo);
  ok(new RegExp("  " + campo + ":").test(W) || W.includes(campo + ":          "),
     campo + ' entra no historico do card');
}
// Comportamento, executando o modulo de verdade.
let GH = null;
try {
  const sw = global.window, sd = global.document;
  global.window = {};
  global.document = { createElement: () => ({ textContent: '', appendChild() {} }),
                      head: { appendChild() {} }, getElementById: () => null };
  require('./links-github.js');
  GH = global.window;
  global.window = sw; global.document = sd;
} catch (e) { GH = null; }
ok(!!GH && typeof GH.ghLinkNormaliza === 'function', 'o modulo carrega');
if (GH) {
  const R1 = 'audaxcapitalsa/AXCRED-DJANGO';
  const R2 = 'audaxcapitalsa/axcaixa';
  const B1 = 'https://github.com/' + R1 + '/';
  const B2 = 'https://github.com/' + R2 + '/';

  // ── O DEFEITO QUE ISTO IMPEDE DE VOLTAR ──────────────────────────────
  // A primeira versao tinha UM repositorio embutido, e o numero solo expandia
  // para ele. Existem axcaixa, PDF_CADASTRO, Workos_ia e outros: um "683" de
  // axcaixa virava link de axcred, gravado, clicavel e apontando para o lugar
  // errado. Reportado pelo Joao Vitor no mesmo dia. Erro silencioso e o pior
  // tipo, e a unica cura e nao adivinhar.
  ok(GH.ghLinkNormaliza('issue', '683') === '683',
     'numero solo SEM repositorio nao e expandido (nao inventa repo)',
     GH.ghLinkNormaliza('issue', '683'));
  ok(GH.ghLinkErro('issue', '683') !== '',
     'e a validacao recusa, pedindo o repositorio ou o link');
  ok(/repositório/i.test(GH.ghLinkErro('issue', '683')),
     'a mensagem diz que falta o repositorio', GH.ghLinkErro('issue', '683'));
  // Com o repositorio escolhido, o numero solo funciona — e a ergonomia que o
  // campo existe para ter: quem esta com a issue aberta tem "683" na cabeca.
  ok(GH.ghLinkNormaliza('issue', '683', R1) === B1 + 'issues/683',
     'numero solo COM repositorio vira URL');
  ok(GH.ghLinkNormaliza('issue', '683', R2) === B2 + 'issues/683',
     'o MESMO numero em outro repositorio da outro link');
  ok(GH.ghLinkErro('issue', '683', R1) === '', 'com repositorio, o numero e valido');
  ok(GH.ghLinkNormaliza('issue', '#683', R1) === B1 + 'issues/683', 'com # tambem');
  // Dois PRs numa demanda e rotina; sem isto o segundo iria para a observacao.
  ok(GH.ghLinkNormaliza('pr', '712, 715', R1) === B1 + 'pull/712 ' + B1 + 'pull/715',
     'PR aceita mais de um numero');
  // URL completa vale sempre, de qualquer repositorio, sem escolher nada.
  const fora = 'https://github.com/outra/org/issues/9';
  ok(GH.ghLinkNormaliza('issue', fora) === fora, 'URL completa passa intacta, sem repositorio');
  ok(GH.ghLinkErro('issue', fora) === '', 'e e valida');
  ok(GH.ghLinkErro('issue', 'https://jira.audax/AX-1') === '',
     'link de outra ferramenta nao e cobrado de forma');
  // O engano mais comum: colar a issue no campo do PR.
  ok(GH.ghLinkErro('pr', B1 + 'issues/683') !== '', 'issue colada no campo do PR e apontada');
  ok(GH.ghLinkErro('issue', 'abc') !== '', 'texto solto e recusado');
  // O campo tem de continuar LEGIVEL: no primeiro print os tres apareciam como
  // "https://github.co..." truncado, sem distinguir issue de PR.
  ok(GH.ghLinkCurto('issue', B1 + 'issues/683') === '683',
     'o campo exibe o numero, nao a URL');
  ok(GH.ghLinkCurto('issue', 'https://jira.audax/AX-1') === 'https://jira.audax/AX-1',
     'link de fora aparece inteiro, porque ai a URL e a informacao');
  ok(GH.ghLinkRotulo('issue', B1 + 'issues/683') === '#683', 'rotulo curto do chip');
  // A lista de repositorios se completa com o uso: lista fixa apodrece no
  // primeiro repositorio novo, que foi como o defeito apareceu.
  const repos = GH.ghLinkRepos([{ link_issue: 'https://github.com/audaxcapitalsa/NOVO_REPO/issues/1' }]);
  ok(repos.indexOf('audaxcapitalsa/NOVO_REPO') >= 0,
     'repositorio visto na base entra na lista automaticamente');
  ok(repos.indexOf(R2) >= 0, 'a semente inclui axcaixa');
  // Com varios repositorios em jogo, "#683" sozinho nao diz de onde e.
  const chips = GH.ghLinkChips({ link_issue: B2 + 'issues/683', link_pr: B1 + 'pull/712 ' + B1 + 'pull/715' });
  ok(chips.includes('#683') && chips.includes('PR #712') && chips.includes('PR #715'),
     'os chips mostram os tres, inclusive dois PRs');
  ok(chips.includes(R2), 'o chip diz de qual repositorio e (no title)');
  ok(/rel="noopener noreferrer"/.test(chips),
     'link externo abre sem dar window.opener para a pagina de destino');
  ok(!GH.ghLinkChips({ link_issue: 'https://x/">   <img onerror=1>' }).includes('<img'),
     'URL com HTML e escapada');
  ok(GH.ghLinkChips({}) === '', 'demanda sem referencia nao renderiza nada');
}
// O seletor de repositorio tem de EXISTIR nas tres telas, senao o numero solo
// nunca e aceito e a ergonomia se perde.
for (const [nome, src] of [['admin', ADMIN], ['gantt', GANTT], ['dev', DEV]]) {
  ok(/id="[a-z]+-link-repo"/.test(src), nome + ' tem o seletor de repositorio');
  ok(/ghLinkPreenche\('[a-z]+', m, state\.melhorias\)/.test(src),
     nome + ' alimenta a lista de repositorios com a base');
}

// ═══════════════════════════════════════════════════════════════════════
sec('Troca da propria senha');

const rotaSenha = W.slice(W.indexOf("body.action === 'senha-alterar'"),
                          W.indexOf("body.action === 'logout'"));
ok(!!rotaSenha && rotaSenha.length > 100, 'existe a rota senha-alterar');
// Sem conta propria nao ha senha individual para trocar. Aceitar a senha
// compartilhada aqui trocaria a senha de QUAL pessoa?
ok(/!ident \|\| !ident\.usuario/.test(rotaSenha),
   'exige conta propria: senha compartilhada nao troca senha');
// Sem conferir a senha atual, um token vazado trancaria a pessoa fora da conta.
ok(/igualSeguro\(hAtual, u\.senha_hash\)/.test(rotaSenha),
   'confere a senha ATUAL antes de trocar');
// Sem limite, o campo "senha atual" e um oraculo para adivinhar a senha de quem
// deixou a sessao aberta.
ok(/contaTentativa\(env, ip, 'senha-alterar'\)/.test(rotaSenha),
   'tentativa errada conta para o limite por IP');
ok(/'senha-alterar':\s*\{ max:/.test(W), 'a rota tem limite declarado');
// Trocar senha e o gesto de quem suspeita de acesso indevido: manter as outras
// sessoes de pe esvaziaria o sentido. E devolver token novo evita expulsar quem
// acabou de trocar.
ok(/DELETE FROM sessao WHERE usuario_id = \?/.test(rotaSenha),
   'encerra as outras sessoes da pessoa');
ok(/INSERT INTO sessao/.test(rotaSenha) && /token: tk/.test(rotaSenha),
   'devolve token novo, para nao expulsar quem trocou');
// A tela precisa ADOTAR o token novo, senao a proxima gravacao falha com "sessao
// expirada" logo depois de trocar a senha — o pior momento para parecer quebrado.
for (const [nome, src] of [['admin', ADMIN], ['gantt', GANTT], ['dev', DEV], ['poker', POKER]]) {
  ok(/senha\.js\?v=/.test(src), nome + ' carrega o modulo de senha');
  ok(/abrirTrocaSenha\(\)/.test(src), nome + ' oferece a troca de senha');
  ok(/rm-token-novo/.test(src), nome + ' adota o token novo depois da troca');
}
const SN = lerTela('senha.js');
ok(/senhaAtual/.test(SN) && /senhaNova/.test(SN), 'a tela manda senha atual e nova');
ok(!/localStorage/.test(SN),
   'a senha nunca toca localStorage (que sobrevive ao fechar o navegador)');

// ═══════════════════════════════════════════════════════════════════════
sec('Recuperacao de senha: automatica, e visivel');

const rotaRec = W.slice(W.indexOf("body.action === 'senha-recuperar'"),
                        W.indexOf("body.action === 'senha-redefinir'"));
const rotaRed = W.slice(W.indexOf("body.action === 'senha-redefinir'"),
                        W.indexOf("// ── Trocar a PROPRIA senha"));
ok(!!rotaRec && !!rotaRed, 'existem as duas rotas (pedir e redefinir)');
// O e-mail e a UNICA prova, e por isso as tres guardas abaixo nao sao opcionais.
ok(/EMAIL_DOMINIO/.test(rotaRec), 'so aceita e-mail do dominio da casa');
// Redefinir a senha de um admin so com o e-mail entregaria a ferramenta inteira.
ok(/u\.papel === 'admin'/.test(rotaRec), 'conta de ADMIN nao se redefine por aqui');
// Sem limite por conta, trocar de rede vira caminho para insistir na mesma pessoa.
ok(/COUNT\(\*\) AS n FROM senha_reset WHERE usuario_id/.test(rotaRec),
   'ha limite POR CONTA, alem do limite por IP');
ok(/'senha-recuperar':\s*\{ max:/.test(W), 'a rota tem limite por IP declarado');
// Uso unico e prazo: sem isso a janela vira chave permanente.
ok(/r\.usado_em/.test(rotaRed), 'o token e de uso unico');
ok(/new Date\(r\.expira_em\) <= new Date\(\)/.test(rotaRed), 'o token expira');
ok(/const RESET_MIN = \d+;/.test(W), 'a janela tem tempo declarado em um lugar so');
// A trilha e a unica forma de um abuso aparecer, ja que a liberacao e automatica.
ok(/CREATE TABLE IF NOT EXISTS senha_reset/.test(W), 'a redefinicao fica gravada');
ok(/FROM senha_reset s JOIN usuario u/.test(W), 'o admin ve as redefinicoes na tela');
ok(/senha_redefinida_em/.test(W), 'o proximo login avisa a pessoa');
ok(/DELETE FROM sessao WHERE usuario_id = \?/.test(rotaRed),
   'redefinir encerra as sessoes abertas');
// A tela: e-mail obrigatorio e cronometro visivel, que foi o pedido.
const SNR = lerTela('senha.js');
ok(/action: 'senha-recuperar'/.test(SNR) && /action: 'senha-redefinir'/.test(SNR),
   'a tela usa as duas rotas');
ok(/audaxcapitalsa\.com\.br/.test(SNR), 'a tela cobra o dominio antes de ir ao servidor');
ok(/setInterval\(tique, 1000\)/.test(SNR), 'o cronometro corre na tela');
ok(/tempo esgotado/.test(SNR), 'o fim do tempo e explicito, e nao um erro seco');
for (const [nome, src] of [['admin', ADMIN], ['gantt', GANTT], ['dev', DEV], ['poker', POKER]]) {
  ok(/abrirRecuperarSenha\(\)/.test(src), nome + ' oferece recuperar senha no login');
}
// Navegacao por LINK: com <button onclick=window.open> o meio-clique e o
// Ctrl+clique nao abrem em nova aba, e este time trabalha com varias telas.
for (const [nome, src] of [['admin', ADMIN], ['dev', DEV], ['gantt', GANTT], ['poker', POKER]]) {
  const botoes = (src.match(/onclick="window\.open\('(?:poker|dev|index|gantt|admin|projetos)\.html/g) || []);
  ok(botoes.length === 0, nome + ' navega por <a href>, nao por window.open', botoes.join(' '));
}

// O card do Kanban do Admin mostra os pontos: e o numero que decide o que entra na
// sprint review, e sem ele a escolha exige abrir demanda por demanda.
ok(/class="kb-pts/.test(ADMIN), 'o card do Kanban mostra os pontos do poker');
ok(/\.kb-pts \{/.test(ADMIN), 'e tem estilo proprio');
// Ponto votado e ponto estimado por duracao NAO podem parecer iguais: duracao
// premia demora. Na base de hoje sao 9 votados contra 120 estimados.
ok(/kb-pts.*estimado/.test(ADMIN) || /' estimado'/.test(ADMIN),
   'ponto estimado por duracao e marcado de forma diferente do votado');
ok(/poker_media != null/.test(ADMIN),
   'a distincao usa poker_media, que so existe onde houve votacao');
ok(/class="kb-sempt/.test(ADMIN), 'e a marcacao de quem nao passou pelo poker segue no card');

// ═══════════════════════════════════════════════════════════════════════
sec('Prazo comprometido e do PM/PO');

// A partir de Planejado a data virou compromisso: esta no gantt, na conta de
// atrasadas e na conversa com a area. A API ja recusava prazo, mas o painel do dev
// monta o estado inteiro no navegador e o `dev-publish` gravava o que recebia —
// esconder o campo na tela nao fecharia nada.
const travaD = corpo(W, 'function travaDatasComprometidas(');
ok(!!travaD, 'existe a trava de datas, um lugar so');
ok(/const ETAPAS_DATA_TRAVADA = \[/.test(W), 'as etapas travadas ficam declaradas');
ok(!!travaD && /if \(!velha\) continue;/.test(travaD),
   'demanda nova nao e travada (ali nada foi prometido)');
ok(!!travaD && /'entrega', 'inicio'/.test(travaD), 'trava as duas datas');
ok(!!travaD && /m\[campo\] = velha\[campo\]/.test(travaD),
   'a versao do SERVIDOR vence, como ja acontece com projeto');
ok(/travaDatasComprometidas\(data, antesDev\)/.test(W), 'dev-publish aplica a trava');
// Nao derruba a gravacao inteira: o dev costuma estar salvando outra coisa (horas,
// texto, anexo), e perder tudo por um campo que ele talvez nem tocou seria punir
// pelo erro errado.
ok(/datas_revertidas/.test(W), 'a resposta diz o que foi revertido, em vez de recusar em silencio');
// A tela avisa antes, para a pessoa nao digitar algo que sera desfeito.
ok(/travaDatasNoCard\(/.test(DEV), 'o painel dev trava os campos no card');
ok(/n-datas-nota/.test(DEV), 'e explica o motivo do cadeado');
// O caminho do admin continua aberto: a trava e sobre QUEM muda, nao sobre mudar.
ok(!/travaDatasComprometidas\(data, antesPub\)/.test(W),
   'o publish do admin NAO e travado (o prazo e dele)');

// ═══════════════════════════════════════════════════════════════════════
sec('Dialogos: da pagina, nao do navegador');

const DLG = lerTela('dialogo.js');
// prompt() nativo tem um modo de falha SILENCIOSO: depois do segundo dialogo
// seguido, o Chrome oferece "impedir que esta pagina crie caixas de dialogo
// adicionais", e a partir dai TODO prompt() devolve null sem avisar. O motivo da
// pausa voltaria vazio e a gravacao seguiria adiante. Nao ha como detectar.
const TELAS_DLG = [['admin', ADMIN], ['gantt', GANTT], ['dev', DEV], ['poker', POKER],
                  ['projetos', lerTela('projetos.html')], ['index', INDEX],
                  ['importar', lerTela('importar.html')]];
for (const [nome, src] of TELAS_DLG) {
  ok(/dialogo\.js\?v=/.test(src), nome + ' carrega o modulo de dialogo');
  // Comentario nao e codigo: o proprio comentario que EXPLICA por que o confirm()
  // saiu cita "confirm()" e reprovava a checagem. Tira os comentarios primeiro.
  const semComent = src.replace(/^\s*\/\/.*$/gm, '');
  // confirm() e alert() ZERO: nenhum tem excecao legitima.
  const conf = (semComent.match(/(?<![A-Za-z_.])confirm\s*\(/g) || []).length;
  ok(conf === 0, nome + ' nao usa confirm() do navegador', conf + ' restante(s)');
  const al = (semComent.match(/(?<![A-Za-z_.])alert\s*\(/g) || []).length;
  ok(al === 0, nome + ' nao usa alert() do navegador', al + ' restante(s)');
  // prompt() so sobrevive como FALLBACK explicito (window.pedirTexto ? ... : prompt),
  // para o dia em que o modulo compartilhado nao carregar. Qualquer outro uso volta
  // a ser uma caixa que o navegador pode desligar.
  const prompts = (semComent.match(/(?<![A-Za-z_.])prompt\s*\(/g) || []).length;
  const fallbacks = (semComent.match(/:\s*prompt\s*\(/g) || []).length;
  ok(prompts === fallbacks,
     nome + ' so usa prompt() como fallback de carga do modulo',
     prompts + ' uso(s), ' + fallbacks + ' fallback(s)');
}
// Clicar fora e Esc CANCELAM. O gesto ambiguo tem de cair no lado que nao apaga.
ok(/if \(e\.target === ov\) fecha\(false\)/.test(DLG),
   'clicar fora do confirmar CANCELA, nunca confirma');
// Acao destrutiva com foco no Cancelar: Enter apressado nao pode apagar.
ok(/o\.perigo \? '#dlg-nao' : '#dlg-sim'/.test(DLG),
   'em acao destrutiva o foco nasce no Cancelar');
ok(/dlg-b\.perigo/.test(DLG), 'acao destrutiva tem botao vermelho');
// Texto que a outra pessoa vai ler (motivo, parecer) precisa de paragrafo: numa
// linha so o autor escreve menos, e era esse o texto que decidia a devolucao.
ok(/multilinha: true/.test(ADMIN) && /multilinha: true/.test(POKER),
   'motivo e parecer usam campo de varias linhas');
// Enter no textarea e quebra de linha, nao envio: roubar isso estragaria
// justamente o texto longo que o dialogo existe para permitir.
ok(/!o\.multilinha \|\| e\.ctrlKey/.test(DLG),
   'Enter nao envia no campo de paragrafo (Ctrl+Enter envia)');
// Senha de terceiro em campo de senha: o prompt() mostrava em texto limpo.
ok(/senha: true/.test(ADMIN), 'a senha definida pelo admin nao aparece na tela');
// O contrato e o mesmo do prompt (string ou null), para a conversao nao mudar a
// logica de cada chamador.
ok(/fecha\(null\)/.test(DLG), 'cancelar devolve null, como o prompt fazia');

// A senha de LEITURA so e pedida em link de consulta. Nas telas com formulario de
// login, um dialogo do navegador por cima dele pedia uma senha DIFERENTE da que o
// formulario pede — a pessoa ficava sem saber qual das duas era a sua.
for (const [nome, src] of [['admin', ADMIN], ['gantt', GANTT], ['dev', DEV],
                           ['poker', POKER]]) {
  ok(/const veioDeLink = !!new URLSearchParams\(location\.search\)\.get\('k'\)/.test(src),
     nome + ' so pede senha de leitura em link de consulta (?k=)');
}

// ═══════════════════════════════════════════════════════════════════════
sec('Planning poker: rolagem, ordem e votos');

// A rolagem subia sozinha porque `renderDetalhe` reescrevia o innerHTML a cada
// batida do polling (1,5 s), e refazer o DOM zera a posicao de rolagem. Quem
// tentava ler a pre-analise abaixo da dobra era empurrado para cima sem parar.
ok(/function assinaturaDetalhe\(/.test(POKER), 'o detalhe tem assinatura de conteudo');
ok(/if \(assin === _detAssin && box\.innerHTML\) return;/.test(POKER),
   'o detalhe so redesenha quando o conteudo muda (senao a rolagem volta ao topo)');
ok(/_mesaAssin/.test(POKER), 'a mesa tambem so redesenha quando muda');
// As cartas trocavam de lugar porque a ordem vinha por `visto_em`, que muda a
// cada batida do polling de cada pessoa.
ok(!/ORDER BY visto_em/.test(W), 'a mesa NAO e ordenada por visto_em (embaralhava sozinha)');
ok(/ORDER BY nome COLLATE NOCASE, id/.test(W), 'a mesa tem ordem estavel, por nome');
// Os votos individuais sobrevivem a reuniao: a media esconde o que decide o dono
// da demanda (3 contra 34 sao leituras diferentes da mesma coisa).
ok(/alvo\.poker_votos = vs\.map/.test(W), 'gravar a nota registra quem votou o que');
ok(/p\.nome AS nome/.test(W), 'guarda o NOME, nao o id do participante (que morre com a sala)');
ok(/function votosRender\(/.test(ADMIN), 'o admin tem a aba de votos');
ok(/poker_votos/.test(ADMIN), 'a aba le poker_votos');
ok(/vt-min/.test(ADMIN) && /vt-max/.test(ADMIN), 'os extremos sao marcados');

// Anexo que falha NAO pode derrubar a entrega: o texto e as horas sao o que o
// PM/PO valida, e perder tudo por causa de um print seria punir pelo erro errado.
ok(/_msEnviando/.test(DEV), 'o painel dev conta os envios de anexo em curso');
ok((DEV.match(/await msAguardaAnexos\(\)/g) || []).length >= 2,
   'salvar e mover esperam o envio do anexo terminar',
   (DEV.match(/await msAguardaAnexos\(\)/g) || []).length + ' ponto(s)');
ok(DEV.includes('O texto e as horas seguem'),
   'a falha do anexo diz que o resto segue gravavel');

// ═══════════════════════════════════════════════════════════════════════
sec('Entregar exige horas e texto — por todos os caminhos');

// A AX-179 chegou em Validacao com zero hora e sem texto. O historico dela mostra
// que o painel dev gravou APENAS a etapa: o drop do Kanban testava por 'concluido'
// e, quando o fluxo mudou para o dev ENTREGAR em vez de concluir, 'validacao' caiu
// no caminho que nao pede nada. O dev via na tela as horas que digitou — e que
// nunca foram enviadas — e o PM/PO abria o card vazio.
ok(/const ETAPAS_EXIGEM_ENTREGA = \['validacao', 'concluido'\]/.test(DEV),
   'as etapas que exigem entrega estao numa lista, nao espalhadas');
ok(/ETAPAS_EXIGEM_ENTREGA\.includes\(colKey\)/.test(DEV),
   'o ARRASTE tambem pede horas e texto (era o furo)');
ok(!DEV.includes("if (colKey === 'concluido') {"),
   'o teste por "concluido" sozinho nao voltou');
// A tela nao pode ser a unica trava: foi um caminho de tela que criou o problema.
const semEnt = corpo(W, 'function entrandoEmValidacaoSemEntrega(');
ok(!!semEnt, 'o servidor tem a trava de entrega incompleta');
ok(!!semEnt && /if \(!velha\) continue;/.test(semEnt), 'demanda nova nao e travada');
ok(!!semEnt && /=== 'validacao'\) continue;/.test(semEnt), 'quem JA estava em validacao passa');
ok(!!semEnt && /String\(m\.implementacao \|\| ''\)\.trim\(\)/.test(semEnt),
   'cobra o texto, e nao so as horas');
ok(/entrandoEmValidacaoSemEntrega\(data, antesDev\)/.test(W), 'dev-publish aplica a trava');
ok(/entrega_incompleta/.test(W), 'e a recusa tem nome proprio, para a tela explicar');
// O publish do admin NAO e travado: o PM/PO mover um card para Validacao e
// decisao dele, e e ele quem cobra o resto.
ok(!/entrandoEmValidacaoSemEntrega\(data, antesPub\)/.test(W),
   'o publish do admin nao e travado (a decisao e do PM/PO)');

// ═══════════════════════════════════════════════════════════════════════
sec('Gravacao: variavel declarada antes de usada');

// O Salvar do Planejamento parou de funcionar e NADA acusou: `...ghLinks` estava
// dentro do objeto e `const ghLinks` era declarado depois. Isso nao e erro de
// sintaxe — o arquivo carrega, a tela abre — mas lanca ReferenceError no clique
// (zona morta temporal), e o handler morre em silencio. Do lado de fora: "clico
// em Salvar e nao acontece nada".
//
// A checagem de sintaxe nao pega. Esta pega.
function corpoDeFuncao(src, assinatura) {
  const i = src.indexOf(assinatura);
  if (i < 0) return '';
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  return '';
}

for (const [nome, src, ass] of [
  ['admin.saveMelhoria', ADMIN, 'async function saveMelhoria('],
  ['gantt.saveTask', GANTT, 'function saveTask('],
  ['dev.saveNewDemand', DEV, 'async function saveNewDemand('],
  ['dev.salvarEntrega', DEV, 'async function salvarEntrega('],
  ['dev.updateStatus', DEV, 'async function updateStatus('],
]) {
  // Some comentarios E literais de texto. O comentario que explica o conserto cita
  // a propria variavel, e `getElementById('m-id')` contem "id" dentro de uma
  // string — as duas coisas acusavam variavel que nao existe. O que sobra e codigo.
  const corpoF = corpoDeFuncao(src, ass)
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
    // `...` vira espaco: spread e USO da variavel, e o lookbehind abaixo ignora
    // ponto para nao confundir `obj.campo` com variavel. Sem isto, `...ghLinks`
    // — a forma exata do defeito que motivou esta checagem — passava batido.
    .replace(/\.\.\./g, ' ');
  ok(!!corpoF, nome + ' existe');
  if (!corpoF) continue;
  const decls = [...corpoF.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=/g)];
  let problemas = [];
  for (const d of decls) {
    const varN = d[1];
    // Primeira aparicao da variavel no corpo, seja como for.
    const uso = new RegExp('(?<![\\w$.])' + varN + '(?![\\w$])').exec(corpoF);
    if (uso && uso.index < d.index) problemas.push(varN);
  }
  ok(problemas.length === 0, nome + ': toda const e declarada antes de usada',
     problemas.join(', '));
}

// ═══════════════════════════════════════════════════════════════════════
sec('Rota: o codigo da demanda no endereco');

// Card aberto vira .../admin.html#AX-127: da para mandar o link no Teams, voltar
// no card depois de um F5 e deixar uma aba fixa numa demanda durante a reuniao.
// As duas telas com card: Admin e painel Dev. Uma copia por tela, e a invariante
// existe para elas nao divergirem — a regra que divergisse aqui seria a de qual
// hash conta como codigo.
for (const [nome, src] of [['admin', ADMIN], ['dev', DEV]]) {
  ok(/function rotaEscreve\(/.test(src), nome + ': existe rotaEscreve');
  ok(/function rotaDemanda\(/.test(src), nome + ': existe rotaDemanda');
  ok(/rotaAbrirDaURL\(\)/.test(src), nome + ': abre o card do endereco ao carregar');
  ok(/history\.replaceState/.test(src) && !/history\.pushState/.test(src),
     nome + ': usa replaceState (o Voltar continua saindo da pagina)');
  ok(/const base = location\.pathname \+ location\.search;/.test(src),
     nome + ': preserva o ?k= do link de consulta');
  ok(src.includes('[A-Z]{2,4}-?'),
     nome + ': so codigo no formato AX-123 conta como rota');
  ok(/rotaEscreve\(''\)/.test(src), nome + ': fechar o card limpa o endereco');
}
ok(/function rotaEscreve\(/.test(ADMIN), 'existe rotaEscreve');
ok(/function rotaDemanda\(/.test(ADMIN), 'existe rotaDemanda');
ok(/rotaAbrirDaURL\(\)/.test(ADMIN), 'o card do endereco e aberto ao carregar');
// `replaceState` e nao `pushState`: o card nao pode virar entrada de historico,
// senao o Voltar do navegador passaria a fechar o modal em vez de sair da pagina.
ok(/history\.replaceState\(null, '', codigo \? base \+ '#' \+ codigo : base\)/.test(ADMIN),
   'usa replaceState, para o Voltar continuar saindo da pagina');
ok(!/history\.pushState/.test(ADMIN), 'nao usa pushState');
// `location.search` preservado: sem isso o `?k=` do link de consulta cairia e
// quem abriu por ele perderia o acesso ao recarregar.
ok(/const base = location\.pathname \+ location\.search;/.test(ADMIN),
   'preserva o ?k= do link de consulta');
// Fechou o card, endereco limpo: senao um F5 reabriria o que a pessoa fechou.
ok(/if \(id === 'modal-melhoria'\) rotaEscreve\(''\)/.test(ADMIN),
   'fechar o card limpa o endereco');
// O hash tem de ser validado: `#token=...` ja circula nesta tela e nao pode virar
// busca de demanda.
const rotaD = corpo(ADMIN, 'function rotaDemanda(');
ok(!!rotaD && /\[A-Z\]\{2,4\}-\?\\d\{1,6\}/.test(rotaD),
   'so codigo no formato AX-123 e aceito no hash');
ok(!!rotaD && /replace\(\/-\/g, ''\)/.test(rotaD),
   'aceita com e sem hifen, porque o codigo circula das duas formas');
// Shift+clique copia o LINK; clique simples copia o codigo. Sao usos diferentes:
// "AX-127" vai no commit, o link vai no Teams.
ok(/shiftKey \|\| ev\.altKey/.test(ADMIN), 'Shift+clique no codigo copia o link do card');
ok(/copiarCodigo\(event\)/.test(ADMIN), 'o handler recebe o evento (sem ele nao ha Shift)');

// ═══════════════════════════════════════════════════════════════════════
sec('Aprovacao: a tela nao afirma o que nao gravou');

// A AX-206 mostrava "Entrega aprovada por Fernando Nascimento em 10/08, 10:43" e
// no servidor seguia em validacao, com validado_por e validado_em VAZIOS. Nao
// houve gravacao naquele minuto. `valDecidir` escrevia os campos no objeto local
// antes de salvar e nao desfazia quando o salvamento falhava — e o carimbo verde
// vence o aviso de erro, porque parece dado e nao parece recado.
const vd = corpo(ADMIN, 'async function valDecidir(');
ok(!!vd, 'existe valDecidir');
ok(!!vd && /const antes = \{/.test(vd), 'guarda um retrato antes de decidir');
ok(!!vd && /Object\.assign\(m, antes\)/.test(vd),
   'desfaz a decisao quando a gravacao falha');
ok(!!vd && /A aprovação NÃO foi gravada/.test(vd),
   'a mensagem diz que NAO gravou, em vez de "continua pendente"');
// O que a mensagem NAO pode dizer: que ficou pendente. Pendente e o
// comportamento certo para campo editado — ali o texto na tela e o que a pessoa
// digitou. Aqui a tela inventava nome e hora de uma aprovacao inexistente.
ok(!!vd && !/A decisão continua pendente/.test(vd),
   'a mensagem antiga, que sugeria que estava so pendente, saiu');

// ═══════════════════════════════════════════════════════════════════════
sec('Bandeja das pausadas: recolhe sem esconder a contagem');

// A faixa listava TODAS as pausadas, uma por linha: sete linhas fixas no topo,
// que nao mudam de um dia para o outro, antes de qualquer coisa util.
ok(/g-pausadas\.aberta|g-pausadas:not\(\.aberta\)/.test(GANTT),
   'a bandeja tem estado aberto/fechado no CSS');
ok(/function gPausadasAlterna\(/.test(GANTT), 'existe o alternador');
// A CONTAGEM nao pode ser escondida junto: "6 demandas pausadas" e a informacao
// que precisa estar na tela todo dia; a lista e que nao.
const rp = corpo(GANTT, 'function renderPausadas(');
ok(!!rp && /demandas pausadas/.test(rp) && /g-pausadas-topo/.test(rp),
   'o titulo com a contagem fica fora da parte que recolhe');
// Lembra a escolha: sem memoria, ou quem usa clica todo dia, ou quem nao usa ve
// sempre. Um dos dois perde.
ok(/rm_pausadas_aberta/.test(GANTT), 'lembra se ficou aberta ou fechada');
// O atalho da mensagem de vazio manda a pessoa para a faixa: se ela chegar
// fechada, a viagem foi inutil.
const ir = corpo(GANTT, 'function gIrParaFaixaPausadas(');
ok(!!ir && /gPausadasAlterna\(\)/.test(ir),
   'o atalho abre a bandeja antes de rolar ate ela');
// O alvo de clique e a faixa inteira, nao um triangulo de 10px.
  ok(GANTT.includes('width:100%; background:none; border:none; padding:0; cursor:pointer;'),
     'o gatilho ocupa a largura toda (o alvo de clique e a faixa, nao um triangulo)');
// As faixas de PRAZO VENCIDO ficam abertas de proposito: elas pedem acao hoje, ao
// contrario da lista de pausadas, que so nao pode ser esquecida. Recolher alerta
// e o caminho para ninguem mais ver alerta.
ok(!/risco-banner[\s\S]{0,200}aberta/.test(ADMIN),
   'o aviso de prazo vencido do admin NAO virou bandeja');

// ═══════════════════════════════════════════════════════════════════════
sec('Fechamento: entregue no prazo x com atraso');

/* A CONCLUSAO LANCADA DEPOIS E JULGADA COMO QUALQUER OUTRA — decisao do
   Fernando, tomada com o numero na mao. Ela tem prazo combinado e tem data de
   entrega; a pergunta que se faz dela e a mesma: cumpriu ou nao cumpriu.

   O QUE ISSO CUSTA, PARA NAO SE PERDER: 75 conclusoes foram lancadas quando a
   base foi organizada, e a data de conclusao recebeu a data de entrega. Julgadas,
   julho da 99% e junho da 100% — verdade por construcao, e nao por pontualidade.
   O campo `concluido_retroativo` continua gravado em cada demanda; o que mudou e
   que ele nao tira mais ninguem da conta. Se um mes antigo parecer bom demais, e
   por aqui. */
const pc = corpo(ADMIN, 'function prazoClassifica(');
ok(!!pc, 'existe a classificacao de prazo, um lugar so');
ok(!!pc && !/m\.concluido_retroativo/.test(pc),
   'a conclusao lancada depois e julgada, e nao posta num balde a parte');
ok(!/lancadaDepois/.test(ADMIN) && !/lancadaDepois/.test(APRES),
   'o balde "Data lancada depois" nao existe mais em tela nenhuma');
// O marcador e o campo, nao a coincidencia das datas: entregar no dia do prazo e
// comum e legitimo (14 das 44 medidas sao assim), e usar a coincidencia como
// filtro puniria justamente quem entregou no dia.
ok(!!pc && !/concluido_em.*===.*entrega/.test(pc),
   'nao usa "data igual" como sinal de retroativa');
ok(!!pc && !/new Date\(ce\)/.test(pc),
   'compara datas por string ISO, nunca por objeto Date');
ok(/function renderGerPrazo\(/.test(ADMIN), 'existe o bloco do fechamento');
ok(/renderGerPrazo\(ano, mes\)/.test(ADMIN), 'o bloco segue o filtro de mes da aba');
ok(/id="pz-resumo"/.test(ADMIN) && /id="pz-lista"/.test(ADMIN),
   'a secao existe no HTML, no padrao das outras');
ok(/Nao medidas|Não medidas/.test(ADMIN),
   'o KPI de nao medidas aparece, em vez de sumir com o que nao da para julgar');

// ═══════════════════════════════════════════════════════════════════════
sec('Sprint: S1-08-2026, derivada e nao digitada');

const sp = corpo(GANTT, 'function sprintDeData(');
ok(!!sp, 'existe a derivacao da sprint');
// A regra e a que a tela JA usa para somar pontos por semana. Uma segunda
// definicao faria o rotulo do card discordar do grafico logo acima dele.
ok(!!sp && /getWorkingDaysOfMonth/.test(sp), 'usa os DIAS UTEIS do mes, como o resto da tela');
ok(!!sp && /!d\.holiday/.test(sp), 'feriado nao conta como dia util');
ok(!!sp && /Math\.floor\(idx \/ 5\)/.test(sp), 'bloco de 5 dias uteis: S1 = uteis 1-5');
ok(/sprint:\s*sprintDeData\(inicio\)/.test(GANTT),
   'ao salvar, a sprint sai da DATA e nao do campo digitado');
ok(/id="e-sprint" readonly/.test(GANTT), 'o campo e somente leitura');
ok(/function atualizaSprintCampo\(/.test(GANTT),
   'o campo se atualiza enquanto a data muda, antes de salvar');

// ═══════════════════════════════════════════════════════════════════════
sec('Bandejas na aba Gerencial');

ok(/function gerBandejaAlterna\(/.test(ADMIN), 'existe o motor das bandejas');
ok((ADMIN.match(/data-bandeja="/g) || []).length >= 2,
   'ha ao menos duas secoes em bandeja',
   (ADMIN.match(/data-bandeja="/g) || []).length + ' ocorrencia(s)');
// A regra que separa bandeja de esconder: o RESUMO fica fora do que recolhe.
ok(/ger-bandeja:not\(\.aberta\) \.ger-bandeja-corpo \{ display:none/.test(ADMIN),
   'so o CORPO recolhe');
ok(/<div id="pz-resumo" class="ger-summary"><\/div>\s*<div class="ger-bandeja-corpo">/.test(ADMIN),
   'o resumo fica FORA do corpo que recolhe (e a resposta da secao)');
ok(/rm_ger_/.test(ADMIN), 'cada secao lembra o proprio estado');
ok(/gerBandejasAplicaTodas\(\)/.test(ADMIN),
   'o estado e reaplicado depois de renderizar (o conteudo e reescrito a cada Atualizar)');

// ═══════════════════════════════════════════════════════════════════════
sec('Apresentacao executiva: narrativa, e nao despejo de numeros');

const AP = lerTela('apresentacao.js');
ok(/apresentacao\.js\?v=/.test(ADMIN), 'o admin carrega o modulo versionado');
ok(/function apresGerar\(/.test(ADMIN), 'existe a montagem no admin');
ok(/function montaDeck\(/.test(AP), 'existe o gerador do deck');
// Fundo escuro e texto claro foi o pedido, e vale para TODO slide: um slide claro
// no meio cega a sala no telao.
/* Fundo ESCURO e texto CLARO — a regra continua; o tom mudou.
   Era um preto neutro; virou o azul-quase-preto do painel de sprints que a
   diretoria aprovou, para o deck e o painel se lerem como a mesma coisa. O que a
   regra protege e o contraste: um slide claro no meio cega a sala no telao. */
(() => {
  const f = AP.match(/fundo:\s*'([0-9A-Fa-f]{6})'/);
  const t = AP.match(/texto:\s*'([0-9A-Fa-f]{6})'/);
  ok(!!f && !!t, 'paleta declarada com fundo e texto');
  if (f && t) {
    const lum = (h) => {
      const v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    };
    const contraste = (lum(t[1]) + 0.05) / (lum(f[1]) + 0.05);
    ok(lum(f[1]) < 0.05, 'o fundo do deck e escuro', '#' + f[1]);
    ok(contraste >= 7, 'e o texto tem contraste de sobra sobre ele',
       contraste.toFixed(1) + ':1');
  }
})();
ok(/s\.background = \{ color: C\.fundo \}/.test(AP), 'todo slide nasce com o fundo escuro');
// "As imagens estejam perfeitas": o canvas da tela segue o zoom e a resolucao de
// quem exportou; num telao isso vira imagem borrada, e numero certo em imagem
// borrada perde a discussao antes de comecar.
const gp = corpo(AP, 'function graficoEmPng(');
ok(!!gp && /larguraPx \|\| 1600/.test(gp), 'o grafico e redesenhado em 1600px, nao copiado da tela');
ok(!!gp && /animation: false/.test(gp), 'sem animacao (senao o PNG sai no meio dela)');
ok(!!gp && /catch \(_\) \{[\s\S]{0,60}return null/.test(gp),
   'grafico que falha nao derruba o deck inteiro');
// A biblioteca so entra quando alguem vai usar.
ok(/function carregaLib\(/.test(AP), 'a biblioteca e carregada sob demanda');
ok(!/<script[^>]*pptxgen/.test(ADMIN), 'a biblioteca NAO entra no carregamento da pagina');
// Narrativa: a ordem e a da conversa, e a frase final e escrita por gente.
ok(/d\.mensagem/.test(AP), 'ha um slide para a frase de quem apresenta');
ok(/destaques/.test(AP) && /ap-dest/.test(ADMIN),
   'os destaques sao ESCOLHIDOS, nao deduzidos por metrica');
// O deck nao pode contradizer a tela: usa a MESMA classificacao de prazo.
ok(/prazoClassifica\(m\)/.test(corpo(ADMIN, 'async function apresGerar(') || ''),
   'o deck reusa a classificacao de prazo da tela, sem recalcular por fora');
// Emoji em slide de diretoria vira quadrado se a fonte do projetor nao tiver.
ok(!/addText\('👤/.test(AP), 'sem emoji nos campos do slide');


sec('Apresentacao: caixinha ao lado do nome, barra nitida, promessa que confere');

// A regra generica de formulario esticava o checkbox na largura da coluna e
// jogava o rotulo para a linha de baixo, com a marca centralizada sobre ele.
// Ninguem conseguia dizer a qual item a marca pertencia.
ok(/\.form-group input\[type="checkbox"\][\s\S]{0,220}?width:auto/.test(ADMIN),
   'checkbox de formulario nao herda width:100% (fica ao lado do rotulo)');
ok(/\.form-group input\[type="checkbox"\][\s\S]{0,220}?padding:0/.test(ADMIN),
   'checkbox de formulario nao herda o padding de campo de texto');

// A lista de destaques ja era so do mes; sem a data na linha, isso nao se prova.
ok(/class="ap-dest"[\s\S]{0,1500}?encerrada ' \+ esc\(formatDate\(m\.concluido_em\)\)/.test(ADMIN),
   'cada linha da lista de destaques mostra a data de conclusao');
ok(/function apresConcluidasDoMes[\s\S]{0,400}?String\(m\.concluido_em \|\| ''\)\.slice\(0, 7\) === iso/.test(ADMIN),
   'a lista de destaques e recortada pelo mes de conclusao');

// Prometer no slide algo que ja foi entregue queima o slide inteiro. O corte e do
// momento da geracao, e a base e relida para que "agora" seja agora.
ok(/const proximos[\s\S]{0,500}?!String\(m\.concluido_em \|\| ''\)\.trim\(\)/.test(ADMIN),
   'o que vem exclui o que ja tem data de conclusao');
ok(/const proximos[\s\S]{0,500}?\['planejado', 'em_andamento'\]/.test(ADMIN),
   'o que vem exclui validacao (ja entregue, so falta o aceite)');
ok(/apresGerar[\s\S]{0,1200}?await loadFromGitHub\(true\)/.test(ADMIN),
   'a base e relida antes de montar o deck');
ok(/apresGerar[\s\S]{0,1200}?_pendingEdits \|\| _kbDirty[\s\S]{0,200}?if \(!pendente\)/.test(ADMIN),
   'a releitura NAO descarta edicao local pendente');
ok(/ainda em aberto em ' \+[\s\S]{0,80}?toLocaleDateString\('pt-BR'\)/.test(ADMIN),
   'o slide diz a data do corte');

// O grafico da tela empilha por tema: 28 cores e barras de poucos pixels viram
// uma faixa ilegivel no projetor. O deck desenha a barra, em vetor e numa cor so.
ok(/function slideBarras/.test(AP), 'existe o slide de barras desenhadas');
ok(!/d\.secoes\.grafico && d\.imagens\.length/.test(AP),
   'entregas por dev nao e mais foto do grafico da tela');
ok(/d\.secoes\.grafico && \(d\.porDev \|\| \[\]\)\.length/.test(AP),
   'entregas por dev vem dos dados, nao de um PNG');
ok(!/apresentacaoGraficoPng\('ger-chart-dev'/.test(ADMIN),
   'o admin nao fotografa mais o grafico empilhado da tela');
ok(/slideBarras[\s\S]{0,2500}?cfg\.cor \|\| C\.azul/.test(AP),
   'a barra tem UMA cor (a cor nao carrega informacao aqui)');
ok(/var alt = Math\.min\(0\.42, AREA \/ itens\.length\)/.test(AP),
   'a altura da linha se ajusta a quantidade (nao estoura o slide)');

// Solicitante em branco viraria a maior barra do ranking em varios meses, e diria
// so que o campo nao e preenchido.
ok(/d\.secoes\.solicit && d\.solicitantes/.test(AP), 'existe o slide de quem pediu');
ok(/if \(!q\) \{ semSolic\+\+; return; \}/.test(ADMIN),
   'sem solicitante nao vira fatia do ranking');
ok(/sem solicitante registrado/.test(AP),
   'o slide diz quantas ficaram fora do ranking (senao a soma nao bate)');
ok(/k: 'solicit'/.test(ADMIN), 'a secao de solicitantes pode ser desmarcada');


sec('Jornada do dev: entrar ja diz quem eu sou');

// Estas rodam a FUNCAO, nao um regex sobre o fonte: o vinculo errado nao aparece
// no texto do arquivo, aparece no resultado da comparacao.
const _devJs = [...DEV.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
const _corpoDe = (nome) => {
  const i = _devJs.indexOf('function ' + nome);
  if (i < 0) return '';
  let n = 0;
  for (let k = _devJs.indexOf('{', i); k < _devJs.length; k++) {
    if (_devJs[k] === '{') n++;
    else if (_devJs[k] === '}') { n--; if (!n) return _devJs.slice(i, k + 1); }
  }
  return '';
};
let _ident = null;
try {
  _ident = new Function(
    ['normNome', 'meusNomesDeclarados', 'resolveMeuDev'].map(_corpoDe).join('\n') +
    '\nreturn { normNome, meusNomesDeclarados, resolveMeuDev };')();
} catch (e) { _ident = null; }
ok(!!_ident, 'as funcoes da identidade carregam');

if (_ident) {
  const DEVS = ['Cairo', 'Crisley', 'Dan Weine', 'Eloi', 'Emilly Viana', 'Flávio',
                'Gabriel', 'Jhonantan', 'João David', 'João Lucas', 'João Vitor',
                'João Vitor Batista de Siqueira', 'Leite', 'Marina', 'Maury', 'Murillo'];
  global.getDevList = () => DEVS;
  let _euAtual = null;
  Object.defineProperty(global, '_eu', { get: () => _euAtual, configurable: true });
  const comoEu = (u) => { _euAtual = u; return _ident.resolveMeuDev(); };

  ok(comoEu({ nome: 'Emilly Viana', papel: 'dev' }) === 'Emilly Viana',
     'conta cujo nome bate com a demanda entra direto (sem grade)');
  ok(comoEu({ nome: 'Gabriel Souza', papel: 'dev', nome_demandas: 'Gabriel' }) === 'Gabriel',
     'o nome declarado no perfil manda sobre o nome da conta');
  ok(comoEu({ nome: 'FLAVIO', papel: 'dev' }) === 'Flávio',
     'acento e caixa nao quebram o vinculo');
  ok(comoEu({ nome: 'Jhonatan', papel: 'dev', nome_demandas: 'Jhonantan / Jhonatan' }) === 'Jhonantan',
     'duas grafias declaradas casam com a que esta na base');
  ok(comoEu({ nome: 'Fernanda Ribeiro', papel: 'dev' }) === '',
     'sem demanda no nome, NAO vincula no chute (mostraria a fila de outro)');

  // O PALPITE POR SEMELHANCA MORREU, e as invariantes inverteram junto.
  //
  // Ele casava por palavras em comum quando a igualdade falhava, e serviu enquanto
  // as contas antigas nao tinham `nome_demandas` declarado. Cobrou o preco na
  // primeira conta nova: um dev recem-cadastrado casou com "Joao Lucas" e abriu o
  // painel na fila de outra pessoa.
  //
  // Hoje o cadastro deriva o nome do e-mail, entao conta nova ja chega declarada
  // e o palpite so teria a oferecer a chance de errar a pessoa. Se ele voltar,
  // estas caem.
  ok(comoEu({ nome: 'João Lucas Pereira', papel: 'dev' }) === '',
     'nome PARECIDO com o de outro dev NAO vincula (era como se abria a fila alheia)');
  ok(comoEu({ nome: 'Gabriel Rodrigues', papel: 'dev' }) === '',
     'sobrenome diferente nao casa por semelhanca');
  ok(comoEu({ nome: 'Emilly Souza', papel: 'dev' }) === '',
     'primeiro nome em comum nao basta');
  ok(comoEu({ nome: 'Gabriel Rodrigues', papel: 'dev', nome_demandas: 'Gabriel' }) === 'Gabriel',
     'com o nome declarado, o vinculo continua imediato');
  ok(comoEu(null) === '',
     'senha compartilhada nao deduz ninguem — ali a grade e a unica saida');
}

// A grade so existe para a senha compartilhada. Com conta, perguntar de novo e
// pedir duas vezes a mesma informacao — e expor a lista de quem trabalha aqui na
// tela de login.
ok(/if \(!_eu\) \{[\s\S]{0,200}?mostrarPasso\('step-dev'\)/.test(DEV),
   'a grade de nomes so aparece sem conta');
// Sem conta, o localStorage e a unica memoria que existe. Perdi este trecho ao
// reescrever a entrada, e quem nao tem conta passou a escolher o nome toda vez —
// exatamente o oposto do que a mudanca queria.
ok(/if \(!_eu\) \{[\s\S]{0,700}?if \(currentDev && getDevList\(\)\.includes\(currentDev\)\) selectDev\(currentDev\)/.test(DEV),
   'sem conta, a escolha do nome e lembrada na entrada seguinte');
ok(/const meu = resolveMeuDev\(\);[\s\S]{0,400}?selectDev\(meu\);/.test(DEV),
   'com conta e nome resolvido, entra direto');
ok(/function pedirVinculo/.test(DEV), 'existe a tela de vincular uma vez');
// Automatismo sem saida e pior que a pergunta que ele substituiu: se o vinculo
// deduzido errar, a pessoa precisa de um caminho de volta que nao passe pelo admin.
ok(/function corrigirVinculo/.test(DEV), 'da para dizer "nao sao as minhas demandas"');
// Quem coordena costuma nao ter demanda no proprio nome. Mandar essa pessoa para a
// tela de vinculo seria pedir que ela se declare dona de uma fila que nao e dela.
ok(/_eu\.papel === 'admin' \|\| _eu\.papel === 'analista'/.test(DEV),
   'admin e analista sem demanda escolhem a fila, nao vinculam');
ok(/Abrir o painel de/.test(DEV),
   'para quem coordena a tela diz "abrir o painel de", nao "selecione seu nome"');
ok(/Não são as minhas demandas/.test(DEV), 'a correcao aparece no cabecalho');
ok(/if \(_vinculoInferido\) gravaMeuVinculo\(meu\)/.test(DEV),
   'o vinculo deduzido e gravado no perfil (na proxima entrada e igualdade)');
ok(/Painel aberto no nome/.test(DEV),
   'o vinculo deduzido e dito em voz alta, nao em silencio');
ok(/action: 'meu-nome-demandas'/.test(DEV), 'o vinculo e gravado no perfil');
ok(/step-vinculo/.test(DEV) && /'step-dev', 'step-vinculo'/.test(DEV),
   'o passo do vinculo entra no rodizio de telas');

// O palpite pre-selecionado nao pode ser aplicado sozinho, e empate nao palpita:
// vincular a pessoa errada mostra a ela a fila de outro.
ok(/if \(melhor && placar > 0 && !empate\) sel\.value = melhor;/.test(DEV),
   'empate no palpite nao pre-seleciona ninguem');
ok(!/vincularNome\(\)[\s\S]{0,300}?setTimeout/.test(DEV),
   'o palpite nunca e aplicado sozinho');

// O servidor: o vinculo proprio escreve so na propria conta.
ok(/body\.action === 'meu-nome-demandas'/.test(WC), 'o Worker aceita o vinculo proprio');
ok(/meu-nome-demandas'\)[\s\S]{0,900}?UPDATE usuario SET nome_demandas = \? WHERE id = \?'\)[\s\S]{0,120}?ident\.usuario\.id/.test(WC),
   'o vinculo proprio escreve pelo id DA SESSAO, nunca pelo login do corpo');
ok(/usuario: \{ login: u\.login, nome: u\.nome, papel: u\.papel,[\s\S]{0,120}?nome_demandas/.test(WC),
   'o login devolve nome_demandas (sem ele o painel nao se vincula)');

// A fila de um dev nao e passeio publico no cabecalho.
ok(/const soEu = !!_eu && \(_eu\.papel === 'dev'\)/.test(DEV),
   'dev com conta nao lista os outros no seletor do cabecalho');
ok(/soEu \? \[\] : \(state\.desenvolvedores \|\| \[\]\)/.test(DEV),
   'a lista de outros devs some para quem e dev');


sec('A tabela de contas nao viaja dentro do arquivo de demandas');

// A aba Usuarios guardava a lista em `state._usuarios` para nao reler o servidor a
// cada clique. Mas `state` E o corpo do publish, e o publish grava o objeto que
// recebe: login, e-mail, papel, ultimo acesso e data de redefinicao de TODAS as
// contas foram parar em data/melhorias.json — arquivo que o painel dev, o
// Planejamento e o painel de consulta baixam inteiro.
ok(!/state\._usuarios\s*=/.test(ADMIN),
   'a aba Usuarios NAO guarda a lista dentro do state (state e publicado)');
ok(/let _usuariosCache = \[\]/.test(ADMIN), 'a lista de contas vive fora do state');
// Sem comentario: o comentario que EXPLICA o defeito nao pode contar como o defeito.
ok(!/state\._usuarios/.test(semComentario(ADMIN)),
   'ninguem mais le a lista de dentro do state');

// A guarda de verdade e no servidor: aba aberta desde ontem continua mandando o
// espelho antigo, e uma unica publicacao dessas devolve tudo para o arquivo.
ok(/function limpaEspelhos/.test(WC), 'o Worker descarta chaves de espelho');
ok(/const fora = Object\.keys\(data\)\.filter\(k => k\.charAt\(0\) === '_'\)/.test(WC),
   'a regra e o prefixo _, e nao uma lista de nomes que alguem tem de manter');
ok((WC.match(/const espelhos = limpaEspelhos\(data\);/g) || []).length === 2,
   'as DUAS rotas de gravacao limpam (publish e dev-publish)');
ok((WC.match(/espelhos_descartados/g) || []).length >= 2,
   'o descarte aparece na resposta, para nao ser silencioso');

// Comportamento: a funcao roda de verdade, com um espelho de conta dentro.
let _limpaOk = false, _sobrou = [];
try {
  const i = W.indexOf('function limpaEspelhos');
  let c = 0, fim = 0;
  for (let k = W.indexOf('{', i); k < W.length; k++) {
    if (W[k] === '{') c++;
    else if (W[k] === '}') { c--; if (!c) { fim = k + 1; break; } }
  }
  const limpa = new Function(W.slice(i, fim) + '\nreturn limpaEspelhos;')();
  const d = { temas: [1], melhorias: [{ id: 'a' }], desenvolvedores: ['Eloi'],
              atualizado_em: 'x', _usuarios: [{ login: 'x', email: 'x@y' }] };
  const fora = limpa(d);
  _sobrou = Object.keys(d);
  _limpaOk = fora.includes('_usuarios') && !('_usuarios' in d) &&
             d.temas.length === 1 && d.melhorias.length === 1 &&
             d.desenvolvedores[0] === 'Eloi' && d.atualizado_em === 'x' &&
             JSON.stringify(limpa(null)) === '[]';
} catch (_) { _limpaOk = false; }
ok(_limpaOk, 'a lista de contas sai e o resto do arquivo fica intacto', _sobrou.join(','));


sec('Mes de compromisso: carimbo que a demanda carrega, e nao coluna');

// O mes NAO pode virar etapa: a demanda sairia dele ao virar trabalho, que e
// exatamente o que a tela do mes existe para mostrar.
ok(!/KB_COLS[\s\S]{0,600}?key:\s*'mes'/.test(ADMIN),
   'mes NAO virou coluna do Kanban');
ok(!/ETAPAS[\s\S]{0,300}?'mes'/.test(WC), 'mes NAO virou etapa no Worker');

// A trilha e append-only e vive no servidor. Se a tela pudesse escrever, uma aba
// desatualizada apagaria o passado — e o passado e o unico lugar onde o
// transbordo mora.
ok(/function carimbaMeses/.test(WC), 'o Worker mantem a trilha');
ok(/m\.meses = guardada\.concat\(/.test(WC), 'a trilha ACRESCENTA, nunca substitui');
ok(/const guardada = mesTrilha\(antes\.get\(m\.id\) \|\| \{\}\)/.test(WC),
   'a trilha vem do SERVIDOR, nao do corpo do pedido (tela nao forja passado)');
ok((WC.match(/carimbaMeses\(data, antes\w+/g) || []).length === 2,
   'as duas rotas de gravacao carimbam');
ok(/carimbaMeses\(data, antesDev, false\)/.test(WC),
   'o painel dev NAO reescreve o mes (o que ele manda e eco do que carregou)');
ok(/carimbaMeses\(data, antesPub, true\)/.test(WC), 'o admin troca o mes');

// `em` e o que separa compromisso de soma no dia 20. Sem ele a taxa de
// cumprimento sobe sozinha quando entra trabalho no fim do mes.
ok(/pedido > hoje\.slice\(0, 7\) \? pedido \+ '-01' : hoje/.test(WC),
   'mes futuro entra como compromisso do dia 1, e nao do dia do clique');
ok(/function mesDesdeOInicio/.test(ADMIN), 'a tela separa comprometido de somado depois');
// Carimbar demanda ja concluida encheria julho e junho de compromisso que ninguem
// assumiu (84 demandas, na conta feita antes de decidir isso), e o fechamento
// desses meses viraria ficcao retroativa.
ok(/MES_ETAPAS = \['planejado', 'em_andamento', 'validacao'\]/.test(WC),
   'concluida e negada NAO ganham mes automatico (nao se inventa compromisso passado)');
ok(/mesEntrouEm\(m\) <= alvo \+ '-01'/.test(ADMIN), 'o corte e o dia 1 do mes');

// A rolagem do fechamento tem de gravar dia 1 do destino, senao fechar agosto no
// dia 3 de setembro transforma as roladas em "entrou no meio de setembro".
ok(/body\.action === 'mes-fechar'/.test(WC), 'existe a acao de fechar o mes');
ok(/mes: mesPara, em: mesPara \+ '-01'/.test(WC),
   'o que rola entra como compromisso do mes inteiro seguinte');
ok(/\['concluido', 'negada'\]\.includes\(String\(m\.status_planejamento[\s\S]{0,400}?mesAtual\(m\) !== mesDe/.test(WC) ||
   /mesAtual\(m\) !== mesDe[\s\S]{0,200}?ABERTAS\(m\)/.test(WC),
   'concluida e negada NAO rolam (o mes precisa continuar dizendo o que entregou)');
ok(/exigePapel\(env, body, 'admin', headers\)[\s\S]{0,400}?mes-fechar/.test(WC) ||
   /mes-fechar'\)[\s\S]{0,200}?exigePapel\(env, body, 'admin'/.test(WC),
   'fechar o mes exige admin');

// Sem objeto Date, pela mesma razao de todas as datas daqui.
ok(/function mesSoma\(iso, n\)/.test(WC) && !/new Date\([\s\S]{0,120}?mesSoma/.test(WC),
   'a soma de meses nao usa objeto Date');

// A tela do mes e uma VISAO, e mostra a etapa real do card.
ok(/function renderMes/.test(ADMIN), 'existe a tela do mes');
ok(/switchTab\('mes'\)/.test(ADMIN), 'existe a aba');
ok(/function etapaRotulo/.test(ADMIN), 'o card do mes mostra a etapa real');
ok(/porSprint/.test(ADMIN), 'o mes e quebrado por sprint');
ok(/\(sem sprint\)/.test(ADMIN), 'demanda sem sprint tem grupo proprio, e nao some');
ok(/function renderGerCumprimento/.test(ADMIN), 'o fechamento por dev existe no Gerencial');
ok(/mesRolos\(b\) - mesRolos\(a\)/.test(ADMIN),
   'as que mais rolaram aparecem primeiro (adiada e diferente de atrasada)');

// Comportamento: roda carimbaMeses de verdade.
let _mesOk = false, _mesPorque = '';
try {
  const corpo = (n) => {
    const i = W.indexOf('function ' + n);
    let c = 0;
    for (let k = W.indexOf('{', i); k < W.length; k++) {
      if (W[k] === '{') c++;
      else if (W[k] === '}') { c--; if (!c) return W.slice(i, k + 1); }
    }
    return '';
  };
  const M = new Function("const hojeBR=()=>'2026-08-12';" +
    "const MES_ETAPAS=['planejado','em_andamento','validacao','concluido'];" +
    ['mesValido', 'mesTrilha', 'mesAtual', 'mesSoma', 'carimbaMeses'].map(corpo).join('\n') +
    '\nreturn { mesAtual, mesTrilha, carimbaMeses, mesSoma };')();
  const guard = { melhorias: [{ id: 'x', meses: [{ mes: '2026-07', em: '2026-07-01' }] }] };
  const a = { melhorias: [{ id: 'x', status_planejamento: 'em_andamento', mes_alvo: '2026-08' }] };
  M.carimbaMeses(a, guard, true);
  const rolou = M.mesTrilha(a.melhorias[0]).length === 2 &&
                M.mesTrilha(a.melhorias[0])[0].mes === '2026-07';
  const b = { melhorias: [{ id: 'x', status_planejamento: 'em_andamento', mes_alvo: '1999-01',
                            meses: [{ mes: '1999-01', em: '1999-01-01' }] }] };
  M.carimbaMeses(b, guard, false);
  const semEco = M.mesAtual(b.melhorias[0]) === '2026-07';
  const c = { melhorias: [{ id: 'novo', status_planejamento: 'backlog' }] };
  M.carimbaMeses(c, { melhorias: [] }, true);
  const backlogLimpo = M.mesAtual(c.melhorias[0]) === '';
  const viraAno = M.mesSoma('2026-12', 1) === '2027-01';
  _mesOk = rolou && semEco && backlogLimpo && viraAno;
  _mesPorque = 'rolou=' + rolou + ' semEco=' + semEco + ' backlog=' + backlogLimpo + ' ano=' + viraAno;
} catch (e) { _mesPorque = e.message; }
ok(_mesOk, 'a trilha se comporta: rola, ignora eco, poupa backlog, vira o ano', _mesPorque);


sec('Catalogo de sistemas: uma lista, e nao uma por tela');

const CAT = lerTela('catalogo.js');
['admin.html', 'dev.html', 'gantt.html', 'index.html', 'poker.html',
 'projetos.html', 'importar.html'].forEach(f => {
  ok(/src="catalogo\.js\?v=/.test(lerTela(f)), f + ' carrega o catalogo versionado');
});

// A regra morava em QUATRO copias, uma por tela, e foi por isso que a lista
// divergiu entre elas. Se voltar a existir copia, esta invariante cai.
['admin.html', 'dev.html', 'gantt.html'].forEach(f => {
  const src = semComentario(lerTela(f));
  ok(!/function populateModulos/.test(src), f + ' nao tem copia de populateModulos');
  ok(!/function onSistemaChange/.test(src), f + ' nao tem copia de onSistemaChange');
  ok(!/function temaSistemas/.test(src), f + ' nao tem copia de temaSistemas');
});
ok(!/function nmPopulateModulos/.test(semComentario(INDEX)),
   'o painel publico tambem usa o catalogo');

// Um select, e nao dois. Com quatro niveis, dois selects viram quatro campos.
['admin.html', 'dev.html', 'gantt.html', 'index.html'].forEach(f => {
  const src = lerTela(f);
  ok(!/id="[a-z]{1,2}-sistema"/.test(src), f + ' nao tem mais o select de sistema separado');
  ok(!/id="[a-z]{1,2}-modulo"/.test(src), f + ' nao tem mais o select de modulo separado');
  ok(/-tema" onchange="catalogoMostraNovo/.test(src), f + ' usa o select unico do catalogo');
});

// Roll-up: com quatro niveis, filtrar por id exato obriga a filtrar folha por
// folha, e "quanto o Cadastro consumiu no mes" fica sem resposta.
ok(/catalogoCasa\(m\.tema_id, filters\.tema/.test(GANTT), 'o gantt filtra com roll-up');
ok(/catalogoCasa\(m\.tema_id, _filtroTema/.test(ADMIN), 'o admin filtra com roll-up');
ok(/catalogoCasa\(m\.tema_id, _temaFilter/.test(INDEX), 'o painel publico filtra com roll-up');
ok(/catalogoCasa\(m\.tema_id, t\.id/.test(DEV), 'a contagem do dev conta a subarvore');

// No slide, o caminho inteiro nao cabe: "AXCred - Cadastro - Análise de Crédito -
// Reanálise" tem 49 caracteres e o corte e em 46. A plateia via "…Rean…" e ninguem
// sabia de que modulo se tratava.
ok((ADMIN.match(/catalogoCurto\(t\.nome\)/g) || []).length >= 2,
   'o deck usa o nome curto nas areas e nas frentes do atraso');

// Comportamento do catalogo, rodando de verdade.
let _catOk = false, _catPorque = '';
try {
  const g = {};
  new Function('window', CAT)(g);
  const temas = [{ id: 'a', nome: 'AXCred' }, { id: 'b', nome: 'AXCred - Cadastro' },
                 { id: 'd', nome: 'AXCred - Cadastro - Análise de Crédito - Reanálise' },
                 { id: 'e', nome: 'AXCred - Cobrança' }, { id: 'f', nome: 'BI - Reports' }];
  const rollUp = g.catalogoCasa('d', 'b', temas) && g.catalogoCasa('d', 'a', temas);
  const naoVaza = !g.catalogoCasa('e', 'b', temas) && !g.catalogoCasa('f', 'a', temas);
  const semFiltro = g.catalogoCasa('e', '', temas);
  const cam = g.catalogoCaminhos();
  const temTudo = ['AXCred - Painel', 'AXCred - Negócio - LDR', 'AXCred - Operações - Simulador',
                   'AXCred - Cadastro - Análise de Crédito - Cadastro Rápido',
                   'AXCred - SCR', 'AXCred - Rating'].every(x => cam.indexOf(x) >= 0);
  // Infraestrutura e plataforma, e nao produto: pendurada no AXCred, fazia o
  // filtro do AXCred contar trabalho que nao e dele. Rating fica DENTRO — estar
  // por construir nao muda onde ele mora.
  const foraDoAx = cam.indexOf('AXCred - Infraestrutura') < 0;
  const html = g.catalogoOpcoesHTML(temas, 'd', {});
  const agrupa = (html.match(/optgroup/g) || []).length === 4 && html.indexOf('selected') > 0;
  _catOk = rollUp && naoVaza && semFiltro && temTudo && agrupa && foraDoAx;
  _catPorque = 'rollUp=' + rollUp + ' naoVaza=' + naoVaza + ' arvore=' + temTudo +
               ' agrupa=' + agrupa + ' infraFora=' + foraDoAx;
} catch (e) { _catPorque = e.message; }
ok(_catOk, 'o catalogo se comporta: agrupa, indenta e faz roll-up sem vazar', _catPorque);


sec('Ranking do mes: conta o que foi ENTREGUE no mes');

// Ele pegava as demandas do mes pela DATA DE ENTREGA PREVISTA. Com isso, quem
// entregava com atraso contava no mes do PRAZO (que ja fechou) e quem nao tinha
// data de entrega nao contava em mes nenhum. Medido na base real: Murillo
// entregou 12 em agosto e o ranking via 4 — 3 com prazo de julho e 5 sem data.
ok(/const entregues = \(state\.melhorias \|\| \[\]\)/.test(GANTT),
   'existe o recorte por data de conclusao');
ok(/entregues[\s\S]{0,400}?String\(m\.concluido_em \|\| ''\)\.slice\(0, 10\) >= A/.test(GANTT),
   'o recorte usa concluido_em, e nao entrega');
ok(/renderRankingMes\(entregues\)/.test(GANTT), 'o ranking recebe as entregues');
ok(!/renderRankingMes\(concluidas\)/.test(GANTT),
   'o ranking NAO usa mais o recorte por data de entrega');
// Comparacao por STRING ISO, como todo o resto das datas daqui.
ok(!/new Date\([^)]*concluido_em/.test(GANTT), 'sem objeto Date na comparacao');

// A faixa mostra os dois numeros lado a lado ("concluídas 43/92" e um podio
// somando 56): sem dizer que sao perguntas diferentes, o maior parece erro.
ok(/const RK_TITULO/.test(GANTT), 'o titulo do ranking e um so lugar');
ok(/entregue no mês/.test(GANTT), 'o titulo diz o criterio na tela');
ok(/pela data de conclusão/.test(GANTT), 'o title explica por que os numeros diferem');


sec('Trabalho do PM/PO: os quatro funis, e o que o historico alcanca');

ok(/data-bandeja="pm"/.test(ADMIN), 'existe a bandeja do PM/PO');
ok(/function pmFluxo/.test(ADMIN), 'existe o calculo');
ok(/renderGerPM\(ano, mes\)/.test(ADMIN), 'o Gerencial chama o bloco');
ok(/k: 'backlog'[\s\S]{0,400}?k: 'levantar_req'[\s\S]{0,200}?k: 'planning'[\s\S]{0,200}?k: 'validacao'/.test(ADMIN),
   'os quatro funis do PM/PO estao declarados na ordem da esteira');

// As tres leituras que foram pedidas: por funil, por semana e por sistema.
ok(/function pmTabelaFunil/.test(ADMIN), 'leitura por funil');
ok(/function pmTabelaSemana/.test(ADMIN), 'leitura por semana');
ok(/function pmTabelaSistema/.test(ADMIN), 'leitura por sistema/modulo');
ok(/function pmSemanas/.test(ADMIN), 'a quebra semanal e derivada, nao digitada');

// A jornada completa: da chegada ate sair das maos do PM/PO.
ok(/t\.para === 'planejado'/.test(ADMIN), 'a jornada termina ao despachar para Planejado');
ok(/criado_em/.test(ADMIN) && /jornada\.push/.test(ADMIN),
   'a jornada comeca na criacao (a unica ponta que sempre existiu)');

// HONESTIDADE DO DADO. O historico so existe a partir de 05/08/2026: mes anterior
// mostra zero movimento por falta de REGISTRO, e um zero calado se le como "o
// PM/PO nao fez nada".
ok(/semRegistro: B < '2026-08-05'/.test(ADMIN), 'o bloco sabe ate onde o historico alcanca');
ok(/falta de registro, não falta de trabalho/.test(ADMIN), 'e diz isso na tela');
ok(/medidos: tempos\.length, semEntrada/.test(ADMIN),
   'separa o que deu para medir do que nao deu');
ok(/Medido em/.test(ADMIN), 'a tela mostra o tamanho da amostra do tempo medio');

// Duracao em horas: a validacao vira no mesmo dia e "0d" se le como defeito.
ok(/function pmHoras/.test(ADMIN), 'a duracao e medida em horas');
ok(/function pmDur/.test(ADMIN), 'e formatada em min/h/d conforme o tamanho');
ok(!/pmDias\(/.test(ADMIN), 'a versao em dias inteiros saiu (perdia a hora do registro)');

// Comportamento: roda o calculo com um historico de mentira.
let _pmOk = false, _pmPorque = '';
try {
  const corpo = (n) => {
    const i = ADMIN.indexOf('function ' + n + '(');
    if (i < 0) return '';
    let c = 0;
    for (let k = ADMIN.indexOf('{', ADMIN.indexOf(')', i)); k < ADMIN.length; k++) {
      if (ADMIN[k] === '{') c++;
      else if (ADMIN[k] === '}') { c--; if (!c) return ADMIN.slice(i, k + 1); }
    }
    return '';
  };
  const P = new Function('state',
    ['pmTransicoes', 'pmEntradaEm', 'pmHoras', 'pmDur', 'pmSemanas', 'pmFluxo'].map(corpo).join('\n') +
    "\nconst PM_FUNIS = [{k:'backlog'},{k:'levantar_req'},{k:'planning'},{k:'validacao'}];" +
    '\nreturn { pmFluxo, pmDur, pmSemanas };');
  const st = { temas: [], melhorias: [
    { id: 'a', codigo: 'AX-1', criado_em: '2026-08-03T10:00:00.000Z', status_planejamento: 'planejado',
      historico: [{ em: '2026-08-06T14:00:00.000Z', quem: 'PM',
                    mudancas: [{ campo: 'status_planejamento', de: 'backlog', para: 'planning' }] },
                  { em: '2026-08-07T10:00:00.000Z', quem: 'PM',
                    mudancas: [{ campo: 'status_planejamento', de: 'planning', para: 'planejado' }] }] },
    { id: 'b', codigo: 'AX-2', criado_em: '2026-07-20T10:00:00.000Z', status_planejamento: 'validacao',
      historico: [{ em: '2026-08-10T09:00:00.000Z', quem: 'PM',
                    mudancas: [{ campo: 'status_planejamento', de: 'em_andamento', para: 'validacao' }] }] },
  ] };
  const M = P(st);
  const f = M.pmFluxo(2026, 8);
  const rec = f.recebidas.length === 1;                       // so a criada em agosto
  const planning = f.funis.find(x => x.k === 'planning');
  const saiuPlanning = planning.saiu === 1 && planning.medidos === 1;
  const jornada = f.jornadaN === 1 && f.mediana > 24 * 3 && f.mediana < 24 * 5;  // 03 -> 07 de agosto
  const val = f.funis.find(x => x.k === 'validacao');
  const wip = val.parado === 1;                               // AX-2 esta parada la
  const semanas = M.pmSemanas(2026, 8).length === 5;
  const horas = M.pmDur(4) === '4h' && M.pmDur(48) === '2d' && M.pmDur(0.5) === '30min';
  _pmOk = rec && saiuPlanning && jornada && wip && semanas && horas;
  _pmPorque = 'rec=' + rec + ' planning=' + saiuPlanning + ' jornada=' + jornada +
              ' wip=' + wip + ' semanas=' + semanas + ' dur=' + horas;
} catch (e) { _pmPorque = e.message; }
ok(_pmOk, 'o calculo do PM/PO se comporta com historico de verdade', _pmPorque);


sec('Rosca: fatia fina nao pode virar so borda');

// `borderWidth: 3` na cor do fundo desenha o separador entre as fatias. Numa
// fatia mais fina que a borda dos dois lados sobra SO borda: o arco inteiro fica
// preto, e a cor de verdade so aparece no hover, quando o hoverOffset destaca a
// fatia. Foi exatamente o defeito relatado.
ok(/function gerFatias/.test(ADMIN), 'legenda e rosca saem do mesmo calculo');
ok(/const bordas = vals\.map/.test(ADMIN) === false, 'a borda nao e mais calculada em dois lugares');
ok(/bordas: itens\.map\(x => \(total > 0 && x\.valor \/ total < 0\.03\) \? 0 : 3\)/.test(ADMIN),
   'fatia fina recebe borda ZERO');
ok(/borderWidth: bordas/.test(ADMIN), 'a rosca usa a borda por fatia');
ok(/\.filter\(p => p\.v > 0\)/.test(ADMIN),
   'fatia de valor zero sai fora (nao desenha arco, mas ganhava borda)');

// O titulo diz "(TOP)" e nao cortava nada: entrava fatia de 1 ponto em 1.100.
// A regra virou TOP 5 (ver a secao "Rosca: redonda, TOP 5 e total no miolo"), e o
// corte por percentual saiu junto — duas regras de corte no mesmo lugar seria uma
// para alguem descobrir do jeito ruim.
ok(!/const LIMIAR = 0\.02/.test(ADMIN), 'o corte por percentual saiu (virou TOP 5)');
ok(/afterBody/.test(ADMIN), 'o tooltip de "Outros" lista o que entrou nele');
ok(/'#6E6A62'/.test(ADMIN), '"Outros" tem cor propria, fora da paleta');

// Comportamento: roda gerFatias de verdade.
let _fOk = false, _fPorque = '';
try {
  const corpo = (n) => {
    const i = ADMIN.indexOf('function ' + n + '(');
    let c = 0;
    for (let k = ADMIN.indexOf('{', ADMIN.indexOf(')', i)); k < ADMIN.length; k++) {
      if (ADMIN[k] === '{') c++;
      else if (ADMIN[k] === '}') { c--; if (!c) return ADMIN.slice(i, k + 1); }
    }
    return '';
  };
  const G = new Function('GER_COLORS', corpo('gerFatias') + '\nreturn gerFatias;')(
    ['#3B8FE8', '#5EA832', '#E89C2F', '#9B6FE8', '#2BBFA0', '#E84444']);
  // caso real: oito fatias, uma delas minuscula, e uma semana zerada
  const r = G({ A: 500, B: 300, C: 200, D: 100, E: 50, F: 8, G: 5, H: 3, S5: 0 }, ' pt', true, false);
  const semZero = !r.itens.some(x => x.valor === 0);
  const agrupou = r.itens.some(x => /^Outros \(3\)/.test(x.label));
  const semPreta = r.itens.every((x, i) => x.valor / r.total >= 0.03 || r.bordas[i] === 0);
  const detalhe = r.detalhe.length === 3 && /F: 8 pt/.test(r.detalhe[0]);
  const cinza = r.itens[r.itens.length - 1].cor === '#6E6A62';
  // com poucas fatias nao ha o que agrupar, e a miuda so perde a borda
  const r2 = G({ A: 500, B: 5 }, ' pt', true, false);
  const soUma = !r2.agrupa && r2.itens.length === 2 && r2.bordas[1] === 0;
  _fOk = semZero && agrupou && semPreta && detalhe && cinza && soUma;
  _fPorque = 'semZero=' + semZero + ' agrupou=' + agrupou + ' semPreta=' + semPreta +
             ' detalhe=' + detalhe + ' cinza=' + cinza + ' soUma=' + soUma;
} catch (e) { _fPorque = e.message; }
ok(_fOk, 'gerFatias se comporta: sem zero, sem fatia so-borda, cauda agrupada', _fPorque);

// ── De Planejado em diante, toda demanda tem dono ──
// `corrigeSemDev` rebaixa para backlog quem esta em planejado/em_andamento/
// validacao sem dev. Concluido nao pode ser rebaixado — a demanda foi entregue,
// e devolver ao backlog seria apagar a entrega para consertar um campo.
ok(/function entrandoEmConcluidoSemDev/.test(WC), 'concluir sem responsavel e recusado');
ok((WC.match(/entrandoEmConcluidoSemDev\(data, antes/g) || []).length === 2,
   'a guarda vale nas duas rotas de gravacao');
ok(/sem_responsavel/.test(WC), 'a recusa tem motivo proprio');
ok(/if \(String\(velha\.status_planejamento \|\| ''\) === 'concluido'\) continue;[\s\S]{0,200}?String\(m\.dev \|\| ''\)\.trim\(\)/.test(WC),
   'demanda que JA estava concluida sem dev nao trava a gravacao de hoje');


sec('Sem responsavel: aviso nomeado, e nao linha anonima');

// Uma linha chamada "Sem dev" numa tabela POR DEV se le como defeito do
// relatorio — e foi lida assim. Ela e uma demanda pontuada que ainda nao tem
// dono, quase sempre por estar no Backlog, onde nao deve ter mesmo.
ok(/function splitDevsLocal\(s\) \{[\s\S]{0,120}?if \(!s\) return \[\];/.test(ADMIN),
   'sem responsavel nao vira linha na tabela por dev');
ok(!/return \['Sem dev'\]/.test(ADMIN), 'o rotulo "Sem dev" saiu do agrupamento');
ok(/avisoSemDono/.test(ADMIN), 'existe o aviso das pontuadas sem responsavel');
ok(/pontuada\$\{semDono\.length!==1\?'s':''\} sem responsável/.test(ADMIN),
   'o aviso diz quantas e quantos pontos');
ok(/semDono\.map\([\s\S]{0,300}?m\.codigo/.test(ADMIN),
   'o aviso NOMEIA cada uma pelo codigo (nomeada da para agir)');
ok((ADMIN.match(/avisoSemDono/g) || []).length >= 3,
   'o aviso aparece com dados e tambem no periodo vazio');

// ── Etapa vazia deixa de ser invisivel ──
// Duas demandas estavam com `status_planejamento` em branco: nao entram em coluna
// nenhuma do Kanban e escapam de toda regra ancorada na etapa — inclusive a que
// exige responsavel e a que carimba o mes.
ok(/const STATUS_PARA_SP/.test(WC), 'existe a volta de status para etapa');
ok(/recebida: 'backlog'/.test(WC) && /estimada: 'planning'/.test(WC) &&
   /iniciada: 'em_andamento'/.test(WC),
   'quando duas etapas compartilham o status, vale a MENOS avancada');
ok(/if \(!sp\) \{[\s\S]{0,220}?STATUS_PARA_SP\[String\(m\.status/.test(WC),
   'etapa vazia e preenchida a partir do status');

// Comportamento: nunca inventa progresso, e nao ressuscita terminal.
let _nOk = false, _nPorque = '';
try {
  /* Recorta UMA declaracao, do `const` ate o `;` que a fecha.
     A versao anterior casava do inicio ate a chave `}` correspondente a primeira
     `{` encontrada depois — o que funcionava por acidente para um objeto literal e
     capturava codigo alheio para qualquer outra coisa. `const ETAPAS_ALOCADA = [...]`
     nao tem chave, e vinha arrastando a funcao seguinte junto; quando `PONTOS_PADRAO`
     nasceu logo acima dela, as duas se sobrepuseram e o teste morreu com
     "ETAPAS_ALOCADA has already been declared" — falha de recorte, nao de codigo.
     Agora a profundidade de {[( e contada, e o `;` no nivel zero encerra. */
  const bl = (p) => {
    const i = WC.indexOf(p);
    if (i < 0) return '';
    let d = 0;
    for (let k = WC.indexOf('=', i); k < WC.length; k++) {
      const ch = WC[k];
      if (ch === '{' || ch === '[' || ch === '(') d++;
      else if (ch === '}' || ch === ']' || ch === ')') d--;
      else if (ch === ';' && d === 0) return WC.slice(i, k + 1) + '\n';
    }
    return '';
  };
  const fnBody = (n) => {
    const i = WC.indexOf('function ' + n + '(');
    let c = 0;
    for (let k = WC.indexOf('{', WC.indexOf(')', i)); k < WC.length; k++) {
      if (WC[k] === '{') c++;
      else if (WC[k] === '}') { c--; if (!c) return WC.slice(i, k + 1); }
    }
    return '';
  };
  // `ETAPAS_ALOCADA` e `PONTOS_PADRAO` entram junto: `normalizaEstados` carimba os
  // pontos planejados e aplica o piso de pontuacao, e sem as constantes a funcao
  // lanca em vez de falhar por um motivo.
  const N = new Function(bl('const SP_PARA_STATUS =') + bl('const STATUS_PARA_SP =') +
                         bl('const ETAPAS_ALOCADA =') + bl('const PONTOS_PADRAO =') +
                         fnBody('normalizaEstados') + '; return normalizaEstados;')();
  const d = { melhorias: [
    { codigo: 'a', status: 'recebida',  status_planejamento: '' },
    { codigo: 'b', status: 'negada',    status_planejamento: '' },
    { codigo: 'c', status: 'concluida', status_planejamento: '' },
    { codigo: 'd', status: 'iniciada',  status_planejamento: '' },
    { codigo: 'e', status: '',          status_planejamento: '' },
    { codigo: 'f', status: 'recebida',  status_planejamento: 'levantar_req' },
  ] };
  N(d);
  const p = c => d.melhorias.find(m => m.codigo === c).status_planejamento;
  _nOk = p('a') === 'backlog' && p('b') === 'negada' && p('c') === 'concluido' &&
         p('d') === 'em_andamento' && p('e') === '' && p('f') === 'levantar_req';
  _nPorque = d.melhorias.map(m => m.codigo + '=' + (m.status_planejamento || '(vazia)')).join(' ');
} catch (e) { _nPorque = e.message; }
ok(_nOk, 'a etapa deduzida nunca inventa progresso e nao mexe em quem ja tinha', _nPorque);


sec('Rosca: redonda, TOP 5 e total no miolo');

// O QUE DEIXAVA OVAL: `canvas { width:220px !important; height:220px !important }`.
// O Chart.js dimensiona o BITMAP pelo container e pelo devicePixelRatio; forcar o
// tamanho de EXIBICAO por CSS estica esse bitmap, e o circulo sai achatado.
ok(!/ger-chart-canvas-wrap canvas \{[^}]*width:220px !important/.test(ADMIN),
   'o canvas NAO leva tamanho por CSS (quem dimensiona e o Chart.js)');
ok(/\.ger-chart-canvas-wrap \{ width:200px; height:200px/.test(ADMIN),
   'o container e quadrado');
ok(/maintainAspectRatio: false/.test(ADMIN.slice(ADMIN.indexOf('gerRenderPies'))),
   'a rosca preenche o container quadrado');

// O visual pedido: anel fino com o total no meio.
ok(/cutout: '72%'/.test(ADMIN), 'anel fino');
ok(/ger-rosca-centro/.test(ADMIN), 'o total vai no miolo');
ok(/>Total<\/span>/.test(ADMIN) || /<span>Total<\/span>/.test(ADMIN), 'o miolo diz o que e o numero');

// TOP 5, com o resto a um clique.
ok(/const TOP = 5/.test(ADMIN), 'o corte e o TOP 5');
ok(/function gerPieTodos/.test(ADMIN), 'da para abrir a lista inteira');
ok(/_gerPieTodos\[id\] = !_gerPieTodos\[id\]/.test(ADMIN), 'o estado e por grafico');
ok(/ger-mostrar-todos/.test(ADMIN), 'o botao existe na tela');
ok(/mostrar só o top 5/.test(ADMIN), 'e volta a fechar');

// Ordem cronologica nao entra no TOP: cortar a semana 4 porque rendeu menos
// destruiria a leitura da sequencia, que e o proprio ponto daquele grafico.
ok(/const cortaTop = ordenar !== false && !todos/.test(ADMIN),
   'a rosca cronologica (semanas) nao e cortada por tamanho');

// Rede para a rosca criada com o painel escondido: sem caixa ela nasce 0x0, e o
// ResizeObserver do Chart.js nao acorda quando o display:none sai. O CSS antigo
// mascarava isso — e era ele que achatava o circulo.
ok(/gerCharts\[id\]\.resize\(\)/.test(ADMIN),
   'ao voltar para a aba, rosca sem area e redimensionada');

// Comportamento do TOP 5.
let _tOk = false, _tPorque = '';
try {
  const corpo = (n) => {
    const i = ADMIN.indexOf('function ' + n + '(');
    let c = 0;
    for (let k = ADMIN.indexOf('{', ADMIN.indexOf(')', i)); k < ADMIN.length; k++) {
      if (ADMIN[k] === '{') c++;
      else if (ADMIN[k] === '}') { c--; if (!c) return ADMIN.slice(i, k + 1); }
    }
    return '';
  };
  const G = new Function('GER_COLORS', corpo('gerFatias') + '\nreturn gerFatias;')(
    ['#1', '#2', '#3', '#4', '#5', '#6']);
  const dados = { a: 100, b: 90, c: 80, d: 70, e: 60, f: 50, g: 40, h: 30 };
  const top = G(dados, ' pt', true, false);
  const cortou = top.itens.length === 6 && /^Outros \(3\)/.test(top.itens[5].label);
  const somaBate = top.total === 520;
  const todos = G(dados, ' pt', true, true);
  const abriu = todos.itens.length === 8 && !todos.agrupa;
  // cronologico nao corta
  const crono = G({ S1: 100, S2: 5, S3: 90, S4: 80, S5: 70, S6: 60, S7: 50 }, ' pt', false, false);
  const naoCortou = crono.itens.length === 7 && !crono.agrupa;
  // seis itens exatos nao viram "5 + Outros(1)"
  const seis = G({ a: 6, b: 5, c: 4, d: 3, e: 2, f: 1 }, ' pt', true, false);
  const semOutros1 = seis.itens.length === 6 && !seis.agrupa;
  _tOk = cortou && somaBate && abriu && naoCortou && semOutros1;
  _tPorque = 'top=' + cortou + ' soma=' + somaBate + ' abriu=' + abriu +
             ' crono=' + naoCortou + ' seis=' + semOutros1;
} catch (e) { _tPorque = e.message; }
ok(_tOk, 'o TOP 5 se comporta: corta, soma certo, abre, e poupa o cronologico', _tPorque);


sec('Cadastro: o nome nas demandas nasce do e-mail');

// Um dev novo se cadastrou, `nome_demandas` ficou vazio, e o palpite do painel
// casou com "Joao Lucas" — outra pessoa. Ele abriu o painel na fila de outro.
ok(/function nomeDemandasDoEmail/.test(WC), 'existe a derivacao pelo e-mail');
ok(/INSERT INTO usuario[\s\S]{0,400}?nome_demandas/.test(WC),
   'o cadastro ja grava o nome das demandas');
ok(/nomeDemandasDoEmail\(email, nome\)/.test(WC), 'derivado do e-mail no cadastro');
ok(/slice\(0, 2\)/.test(WC), 'so nome e sobrenome (o terceiro pedaco so alonga o rotulo)');

// Conta cadastrada antes da derivacao nao tem o campo: a aprovacao e o ultimo
// momento de preencher sem incomodar ninguem, porque a pessoa ainda nao entrou.
ok(/if \(!nomeDem\) \{[\s\S]{0,300}?nomeDemandasDoEmail\(uu\.email, uu\.nome\)/.test(WC),
   'a aprovacao preenche o que faltar');
ok(/return json\(\{ ok: true, nome_demandas: nomeDem/.test(WC),
   'a aprovacao devolve o nome para a tela');

// Sem estar na lista de devs, ninguem consegue atribuir demanda a pessoa — e o
// vinculo apontaria para um nome que nao existe em demanda nenhuma.
ok(/state\.desenvolvedores = \[\.\.\.\(state\.desenvolvedores \|\| \[\]\), nomeDem\]/.test(ADMIN),
   'aprovar um dev o coloca na lista de devs');
ok(/não consegui incluir/.test(ADMIN),
   'se a inclusao falhar, o admin e avisado (nao fica um dev fantasma)');

// Comportamento da derivacao.
let _dOk = false, _dPorque = '';
try {
  const i = WC.indexOf('function nomeDemandasDoEmail(');
  let c = 0, corpo = '';
  for (let k = WC.indexOf('{', WC.indexOf(')', i)); k < WC.length; k++) {
    if (WC[k] === '{') c++;
    else if (WC[k] === '}') { c--; if (!c) { corpo = WC.slice(i, k + 1); break; } }
  }
  const F = new Function(corpo + '\nreturn nomeDemandasDoEmail;')();
  const simples = F('joao.lucas@audaxcapitalsa.com.br', '') === 'Joao Lucas';
  const comAcento = F('joao.lucas@x.com', 'João Lucas Pereira') === 'João Lucas';
  const duasPartes = F('maria.silva.santos@x.com', '') === 'Maria Silva';
  const umaParte = F('murillo@x.com', '') === 'Murillo';
  const vazio = F('', 'Fulano') === '';
  _dOk = simples && comAcento && duasPartes && umaParte && vazio;
  _dPorque = 'simples=' + simples + ' acento=' + comAcento + ' duas=' + duasPartes +
             ' uma=' + umaParte + ' vazio=' + vazio;
} catch (e) { _dPorque = e.message; }
ok(_dOk, 'a derivacao se comporta: duas partes, acento do cadastro, sem chute', _dPorque);


sec('Quando nao tem, cria — nao adivinha');

// "lucas.santos" se cadastrou e ficou com "Joao Lucas" no perfil. Nao foi o
// cadastro: foi o palpite antigo do painel, que casava por semelhanca e GRAVAVA o
// resultado. Sobravam mais dois adivinhadores depois dele.

// 1. A API. Sem o campo declarado, ela casava por PREFIXO entre o nome da conta e
//    o nome na demanda — um caminho por onde a fila de uma pessoa chega na mao de
//    outra.
ok(!/const mesmaPessoa = \(a, b\) =>/.test(WC),
   'a heuristica de prefixo saiu da API');
// Os tres nomes aceitos SOMAM em vez de competir: derivado do e-mail, declarado
// no perfil e nome da conta. Somar elimina a janela da virada — entre trocar o
// nome nas demandas e trocar o cadastro, ninguem fica sem ver a propria fila.
ok(/const aceitos = \[\.\.\.declarados, doEmail, eu\]\.filter\(Boolean\)/.test(WC),
   'o derivado do e-mail e o declarado convivem, sem janela na virada');
ok(/const doEmail = nomeDemandasDoEmail\(/.test(WC),
   'o nome do e-mail e sempre um dos aceitos');
ok(/naDemanda\.some\(n => aceitos\.some\(a => normNome\(n\) === normNome\(a\)\)\)/.test(WC),
   'a comparacao e sempre por IGUALDADE');

// 2. O seletor do Admin so listava nomes que ja existiam em alguma demanda. Para
//    um dev novo — que por definicao nao tem nenhuma — nao havia nada certo para
//    escolher, so o que escolher errado.
ok(/nome_sugerido: nomeDemandasDoEmail\(u\.email, u\.nome\)/.test(WC),
   'a lista de contas devolve o nome sugerido pelo e-mail');
ok(/criar — do e-mail/.test(ADMIN), 'o seletor oferece CRIAR o nome que falta');
ok(/state\.desenvolvedores = \[\.\.\.\(state\.desenvolvedores \|\| \[\]\), valor\]/.test(ADMIN),
   'escolher o nome novo o cria na lista de devs');

// Comportamento: o caso exato que aconteceu.
let _cOk = false, _cPorque = '';
try {
  const i = WC.indexOf('function nomeDemandasDoEmail(');
  let c = 0, corpo = '';
  for (let k = WC.indexOf('{', WC.indexOf(')', i)); k < WC.length; k++) {
    if (WC[k] === '{') c++;
    else if (WC[k] === '}') { c--; if (!c) { corpo = WC.slice(i, k + 1); break; } }
  }
  const der = new Function(corpo + '\nreturn nomeDemandasDoEmail;')();
  const norm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
  const dono = (u) => {
    const decl = String(u.nome_demandas || '').split(/[\/,;]/).map(x => x.trim()).filter(Boolean);
    const deriv = decl.length ? [] : [der(u.email || '', u.nome), u.nome].filter(Boolean);
    const aceitos = decl.length ? decl : deriv;
    return m => String(m.dev || '').split('/').map(x => x.trim()).filter(Boolean)
      .some(n => aceitos.some(a => norm(n) === norm(a)));
  };
  const lucas = dono({ nome: 'lucas de oliveira santos',
                       email: 'lucas.santos@audaxcapitalsa.com.br', nome_demandas: '' });
  const naoVaza = !lucas({ dev: 'João Lucas' }) && !lucas({ dev: 'João Vitor' });
  const pegaAsSuas = lucas({ dev: 'Lucas Santos' });
  const antigo = dono({ nome: 'Gabriel Rodrigues', email: 'gabriel.fernandes@x.com',
                        nome_demandas: 'Gabriel' });
  const declaradoVale = antigo({ dev: 'Gabriel' }) && !antigo({ dev: 'Gabriel Leite' });
  const semCampo = dono({ nome: 'Murillo', email: 'murillo.jesus@x.com', nome_demandas: '' });
  const contaAntiga = semCampo({ dev: 'Murillo' });
  _cOk = naoVaza && pegaAsSuas && declaradoVale && contaAntiga;
  _cPorque = 'naoVaza=' + naoVaza + ' proprias=' + pegaAsSuas +
             ' declarado=' + declaradoVale + ' antiga=' + contaAntiga;
} catch (e) { _cPorque = e.message; }
ok(_cOk, 'a fila de um dev NAO chega na mao de outro pela API', _cPorque);


sec('Ordem do quadro: quem esta marcado vem primeiro');

// A lista de stacks saiu por ora (o pedido era um marcador so), e as invariantes
// que a defendiam sairam junto. O que fica e a ordem, que e o que o marcador
// existe para produzir.
ok(/function gOrdenaDevs/.test(GANTT), 'existe a ordem do quadro');
ok(/let devs = state\.desenvolvedores\.length[\s\S]{0,120}?gOrdenaDevs/.test(GANTT),
   'o gantt desenha nessa ordem');
ok(/localeCompare\(String\(b\), 'pt-BR'\)/.test(GANTT.slice(GANTT.indexOf('function gOrdenaDevs'))),
   'dentro do grupo, ordem alfabetica (tirar a marca nao embaralha o quadro)');
ok(/function gSetPerfil/.test(GANTT), 'da para marcar pela tela');

// Sem isto, um conflito de gravacao traria a versao do servidor por cima e a
// marcacao recem-feita sumiria logo depois de um "salvo". No Admin a protecao e
// outra — fusao por chave —, porque as DUAS telas editam o mesmo mapa.
ok(/'desenvolvedores', 'devs_perfil'/.test(GANTT),
   'devs_perfil e campo do gantt (nao e sobrescrito no conflito)');
ok((ADMIN.match(/devs_perfil = Object\.assign\(\{\}/g) || []).length === 2,
   'e funde por CHAVE nas mesclagens do Admin');


sec('DEV-AXCred: uma flag so, com retorno imediato');

// A lista de 19 frentes FORCAVA escolher uma, e dev atua em varias ao mesmo tempo.
// A de stacks saiu junto, por ora: o pedido era um marcador so.
ok(!/function uFrentes/.test(ADMIN) && !/function gFrentes/.test(GANTT),
   'a lista de frentes saiu das duas telas');
ok(!/const U_PERFIS/.test(ADMIN) && !/const G_PERFIS/.test(GANTT),
   'a lista de stacks saiu das duas telas');
ok(/DEV-AXCred/.test(ADMIN) && /DEV-AXCred/.test(GANTT), 'sobrou a flag, com NOME');
// A coluna tem NOME, e nao um rotulo generico: "Perfil" nao dizia o que era.
// A de Frente entrou ao lado dela, e nao no lugar dela.
ok(/'AXCred', 'Frente', 'Último acesso'/.test(ADMIN),
   'a coluna se chama AXCred, e a Frente entrou ao lado');

// Clicar tem de mostrar que pegou. Antes isto chamava `renderUsuarios()`, que RELÊ
// a lista de contas do servidor: o retorno visual dependia de uma ida e volta de
// rede, e ate ela voltar o botao continuava igual.
ok(/function uPintaAxcred/.test(ADMIN), 'o botao e repintado na hora');
ok(/uPintaAxcred\(nome\);\s*\n\s*const okSalvo = await saveViaProxy/.test(ADMIN),
   'e ANTES de esperar a gravacao');
ok(!/renderUsuarios\(\);\s*\n\s*const okSalvo/.test(ADMIN),
   'sem depender do re-render que rele o servidor');
ok(/data-dev="/.test(ADMIN), 'repinta so aquele botao (nao redesenha a tabela)');

// O estado e lido NO CLIQUE, e nao congelado na renderizacao — senao o segundo
// clique repetiria o primeiro e nunca desmarcaria.
ok(/!uPerfilDe\(/.test(ADMIN), 'o Admin le o estado no clique');
ok(/!gPerfilDe\(/.test(GANTT), 'o Planejamento tambem');

// Marcado na tela e nao gravado no servidor e pior que nao ter marcado: na
// proxima abertura some, e ninguem entende por que.
ok(/Nada foi alterado/.test(ADMIN) && /Nada foi alterado/.test(GANTT),
   'falha na gravacao VOLTA o botao, nas duas telas');

// A ordem do quadro continua saindo da flag.
ok(/gPerfilDe\(a\)\.axcred \? 0 : 1/.test(GANTT), 'a ordem do quadro usa a flag');
ok(/function gPerfilDe/.test(GANTT), 'e a leitura do mapa existe');

// "Ultimo acesso" era gravado SO no login. A sessao vale 12h e a aba fica aberta o
// dia inteiro: quem trabalhou o dia todo aparecia com o horario da manha, e quem
// entrou pela senha geral aparecia como "nunca entrou" — lido como "nao usa".
ok(/const agoraMs = Date\.now\(\);/.test(WC), 'o acesso e carimbado em qualquer chamada autenticada');
ok(/agoraMs - antesMs > 10 \* 60 \* 1000/.test(WC),
   'no maximo a cada 10 min (senao seria uma gravacao por requisicao)');
ok(/nunca entrou com a conta/.test(ADMIN), 'e a tela diz que a coluna fala da CONTA');
ok(/usa a senha geral/.test(ADMIN), 'e aponta a causa provavel');


sec('A marcacao nao pode ser apagada antes de sair da tela');

// A flag DEV-AXCred "nao ficava salva": marcava varias, e ao desativar alguem
// todas voltavam desmarcadas. O motivo nao era a gravacao — era que ela NUNCA
// chegava a ser enviada. A fusao de `devs_perfil` acontecia algumas linhas acima,
// e logo depois o laco generico dos "campos de outras telas" sobrescrevia o mapa
// com a versao do servidor, que ainda nao tinha a marca.
ok(/'desenvolvedores', 'devs_perfil',\s*\n?\s*'devs_removidos'/.test(ADMIN),
   'devs_perfil e devs_removidos estao em MEUS_CAMPOS do Admin');
ok(/if \(!MEUS_CAMPOS\.includes\(k\)\) state\[k\] = server\[k\]/.test(ADMIN),
   'o laco generico continua existindo (ele protege chave de outra tela)');
// A fusao por chave tem de continuar: as DUAS telas editam o mesmo mapa.
ok((ADMIN.match(/devs_perfil = Object\.assign\(\{\}/g) || []).length === 2,
   'e a fusao por chave nao foi substituida pela lista');

// Quem coordena precisa do vinculo, mas nao de uma linha no quadro de alocacao.
ok(/const desenvolve = \['dev', 'analista'\]\.includes/.test(ADMIN),
   'so quem desenvolve entra na lista de devs ao escolher o nome');

sec('A tela tem de CARREGAR o que ela grava');

// A marcacao estava no arquivo e a tela desenhava tudo apagado. `state` e montado
// a partir de uma lista fixa de chaves, e `devs_perfil` nao estava nela: a cada
// carga o mapa nascia vazio, todos os botoes desenhavam "nao marcado", e quem
// marcava recarregava e via o proprio trabalho sumido.
//
// Pior: o que a tela nao carrega, ela apaga ao publicar. `devs_removidos` saia
// ausente do envio e o servidor gravava lista vazia — seis nomes de quem saiu do
// time viraram zero numa unica publicacao.
// O bloco da CARGA e o que le `decoded` — as outras atribuicoes a `state` no
// arquivo sao a declaracao inicial e nao dizem nada sobre o que vem do servidor.
const blocoCarga = src =>
  (src.match(/state = \{[\s\S]*?\n\s*\};/g) || []).find(b => b.includes('decoded.')) || '';

[['Admin', ADMIN], ['Gantt', GANTT]].forEach(([tela, src]) => {
  const carga = blocoCarga(src);
  ok(/devs_perfil:\s*decoded\.devs_perfil/.test(carga),
     tela + ' carrega devs_perfil no state (sem isso a marcacao nao aparece)');
  ok(/devs_removidos:\s*decoded\.devs_removidos/.test(carga),
     tela + ' carrega devs_removidos (sem isso publicar zera a lista)');
});

// Toda chave que a tela declara como sua PRECISA ser carregada por ela: "minha" no
// envio + ausente na carga = apaga o que estava no servidor, que foi exatamente o
// que aconteceu com devs_removidos.
[['Admin', ADMIN], ['Gantt', GANTT]].forEach(([tela, src]) => {
  const meus = (src.match(/const MEUS_CAMPOS = \[([\s\S]*?)\];/) || [, ''])[1]
    .match(/'([^']+)'/g).map(s => s.replace(/'/g, ''))
    .filter(k => k !== 'atualizado_em');
  const carga = blocoCarga(src);
  const fora = meus.filter(k => !new RegExp('\\b' + k + ':').test(carga));
  ok(!fora.length, tela + ': tudo que ele declara como seu tambem e carregado',
     fora.length ? 'fora da carga: ' + fora.join(', ') : '');
});

sec('O servidor nao apaga chave que ninguem mandou apagar');

// Cada tela monta o envio a partir de uma lista fixa; quem nao esta nela chega
// ausente, e o arquivo e gravado com o objeto recebido — entao "ausente" virava
// "apagado". A regra e ausencia, e nao lista de nomes: vazio ENVIADO continua
// valendo, e chave criada amanha por outra tela ja fica protegida.
ok(/function preservaChaves\(data, antes\)/.test(W),
   'o Worker preserva chave que nao veio no envio');
ok(/if \(data\[k\] === undefined\) \{ data\[k\] = antes\[k\]/.test(W),
   'e o criterio e AUSENCIA — esvaziar de proposito continua funcionando');
ok(/if \(k\.charAt\(0\) === '_'\) continue;/.test(W),
   'espelho `_` nao volta pela porta dos fundos');
['Pub', 'Dev'].forEach(v => {
  const i = W.indexOf('const voltaram' + v + ' = preservaChaves');
  const j = W.indexOf('const devsFora' + v + ' = await limpaDevs');
  ok(i > 0 && j > 0 && i < j,
     'no ' + (v === 'Pub' ? 'publish' : 'dev-publish') +
     ', preservaChaves roda ANTES de limpaDevs (que le devs_removidos)');
});

sec('Sessao vencida derruba a tela, e nao o usuario');

// A sessao vale 12h. Vencendo com a aba aberta, a pagina continuava mostrando tudo
// como se nada tivesse acontecido, e so na hora de gravar mandava "sair e entrar
// de novo" — o usuario fazendo na mao o que a tela ja sabia. Entre o vencimento e
// a gravacao, tudo que ele mexeu parecia valer.
[['Admin', ADMIN], ['Gantt', GANTT], ['Dev', DEV]].forEach(([tela, src]) => {
  ok(/function sessaoExpirou\(\)/.test(src), tela + ' derruba a sessao ao receber 401');
  ok(/const nativo = window\.fetch;/.test(src),
     tela + ': a interceptacao e no fetch, e nao chamada a chamada');
  ok(/_ACOES_SEM_SESSAO\.includes\(acao\)\) return res;/.test(src),
     tela + ': 401 de login e senha errada, e nao sessao vencida');
  // O corpo so pode ser lido uma vez — quem chamou ainda precisa dele.
  ok(/return new Response\(texto, \{ status: res\.status/.test(src),
     tela + ': devolve o corpo que consumiu');
  // Recarregar ao voltar traria a versao do servidor por cima do que ficou na
  // tela. Mas o atalho so pode valer com a tela JA MONTADA: sem essa condicao,
  // uma sessao que vence ANTES da montagem fazia a entrada pular o mes corrente,
  // os listeners e a carga dos dados — e o Planejamento abriu vazio, com
  // "undefined undefined" no lugar do mes.
  ok(/if \(_sessaoCaiu && _telaMontada\) \{/.test(src),
     tela + ': o atalho da expiracao exige a tela montada');
  ok(/let _telaMontada = false;/.test(src) && /_telaMontada = true;/.test(src),
     tela + ': e a montagem se marca no fim dela');
});

sec('A carta 12+1 e um rotulo, e nao um valor');

// Trocar o VALOR seria o caminho curto e errado: parseFloat('12+1') devolve 12, e a
// media da rodada sairia menor sem ninguem perceber.
ok(/POKER_CARTAS = \['1','2','3','5','8','13'/.test(W),
   'o baralho do servidor continua com o valor 13');
ok(/FIBONACCI\s*=\s*\[1, 2, 3, 5, 8, 13/.test(POKER),
   'e a sugestao continua calculando em cima de 13');
ok(/rotuloCartaHTML\(c\)\}<\/button>/.test(POKER) && /votar\('\$\{esc\(c\)\}'\)/.test(POKER),
   'a carta mostra o rotulo e envia o valor');
ok(/document\.getElementById\('in-pontos'\)[\s\S]{0,200}?iP\.value = fib \|\| '';/.test(POKER) ||
   /if \(!iP\.dataset\.tocado\) iP\.value = fib \|\| '';/.test(POKER),
   'o campo de pontos recebe o numero, e nao o rotulo');

sec('A referencia da carta se refaz sozinha');

// Ela existe porque o levantamento mostrou que a carta preve PRAZO, e nao horas:
// pontos x dias uteis deu 0,89 em 109 entregas, contra 0,48 de pontos x horas.
ok(/function pokerReferencia\(data\)/.test(W), 'o servidor calcula a referencia');
ok(/referencia: pokerReferencia\(data\)/.test(W),
   'e ela sai junto com a fila — sem chamada nova, e refeita a cada rodada');
// Media deixaria uma demanda parada por dependencia externa arrastar a carta.
ok(/const mediana = v => \{/.test(W) && /linhas\.push\(\{ carta, n: v\.dias\.length, dias: mediana/.test(W),
   'pela mediana, e nao pela media');
ok(/fim - t > 400 \* 86400000\) return null;/.test(W),
   'data digitada errada nao vira laco infinito na leitura da fila');
ok(/Date\.parse\(de \+ 'T00:00:00Z'\)/.test(W),
   'a conta de dias e em UTC (no fuso local, entrega no mesmo dia daria zero)');
// O corte de "poucos casos" e conferido na secao "Referencia da carta", onde ele
// passou a contar entregas com data em vez de quem preencheu hora.
// A hora tem menos base que o dia (64 registros contra 110 entregas com data).
// Uma contagem so faria a carta parecer mais firme do que e no numero exibido.
ok(/nHoras: v\.horas\.length/.test(W),
   'a contagem de horas e separada da contagem de dias');
ok(/id="referencia"><\/div>/.test(POKER) && POKER.indexOf('id="cartas"') < POKER.indexOf('id="referencia"'),
   'a referencia fica logo abaixo do baralho, onde se vota');

sec('A hora nao pode ser inventada, e o deck termina no fim');

// A tela contava, por demanda, dias uteis x 8h e somava: duas demandas do mesmo
// dev no mesmo dia viravam 16h naquele dia. Em julho deu 1554h onde o time tinha
// digitado 377h, com gente aparecendo com 192h num dia so.
ok(!/function getHorasEfetivas/.test(ADMIN),
   'a conta que multiplicava a janela por 8h saiu de cena');
ok(/function rateiaHoras\(lista, janela, de, ate\)/.test(ADMIN),
   'o dia do dev e rateado entre as demandas dele');
ok(/horas\.set\(t\.id, \(horas\.get\(t\.id\) \|\| 0\) \+ HORAS_DIA \/ quantas\)/.test(ADMIN),
   'e a divisao e pelo numero de demandas daquele dev naquele dia');
// Sem as duas passagens nao da para dividir: a primeira descobre quantas sao.
ok(/const agenda = new Map\(\);/.test(ADMIN) && /const trechos = \[\];/.test(ADMIN),
   'monta a agenda antes de dividir');
/* A HORA MEDIDA CONTINUA VISIVEL SOZINHA — regra reescrita, e nao afrouxada.

   Ela exigia que a hora digitada NUNCA entrasse na mesma soma da aproximacao. O
   efeito colateral disso era a "Eficiencia" comparar rateio contra rateio da
   mesma janela e dar ~100% todo mes: um numero que ocupava espaco e nao dizia
   nada. Hoje o total prefere a hora MEDIDA e completa com a aproximacao, que e o
   que a tabela ja fazia linha a linha desde sempre.

   O que a regra original protegia continua protegido, e agora de forma mais
   forte: alem do total medido aparecer sozinho num KPI proprio, a COBERTURA tem
   de aparecer junto dele. Sem a cobertura, um mes com 39% de lancamento parece
   um time que trabalhou de menos — e e ai que o numero passa a mentir.        */
ok(/const horasDigitadas = Math\.round/.test(ADMIN),
   'a hora medida continua somada sozinha, num numero proprio');
ok(/Horas lançadas/.test(ADMIN),
   'e aparece na tela com nome que diz o que ela e');
(() => {
  const i = ADMIN.indexOf('Horas lançadas');
  ok(i > 0 && /de \$\{concluidos\.length\} concluídas/.test(ADMIN.slice(i, i + 420)) &&
     /Math\.round\(quantasDigitaram \/ concluidos\.length \* 100\)/.test(ADMIN.slice(i, i + 420)),
     'com a COBERTURA ao lado — quantas de quantas, e em %');
})();
ok(/hrLog > 0 \? hrLog \+ 'h' : hrEf \+ 'h\*'/.test(ADMIN),
   'e a linha aproximada continua marcada com asterisco na tabela');

/* A ORDEM DO DECK CONTA UMA HISTORIA, e ela esta travada aqui.

   O deck e lido de cima a baixo numa reuniao, e a ordem e o argumento: onde
   estamos, onde a capacidade foi, se cumprimos o combinado, em que trabalhamos,
   quem fez, o que depende de decisao, e o fecho.

   A evolucao vinha DEPOIS de prazo e de entregas rapidas: a sala passava tres
   slides sem saber se 114 entradas era muito ou pouco. E o bloco de pessoas
   estava partido ao meio por "onde atuamos" e "quem pediu", que sao produto —
   dois trocas de assunto que ninguem pediu.                                   */
(() => {
  const atos = ['ATO 1 · ONDE ESTAMOS', 'ATO 2 · ONDE A CAPACIDADE FOI',
                'ATO 3 · CUMPRIMOS O COMBINADO?', 'ATO 4 · EM QUE TRABALHAMOS',
                'ATO 5 · QUEM FEZ', 'ATO 6 · O QUE DEPENDE DE DECISÃO',
                'ATO 7 · O FECHO'];
  const pos = atos.map((a) => APRES.indexOf(a));
  ok(pos.every((p) => p > 0), 'os sete atos do deck estao marcados no gerador',
     atos.filter((a, i) => pos[i] < 0).join(', '));
  ok(pos.every((p, i) => i === 0 || p > pos[i - 1]),
     'e vem na ordem em que a historia e contada');
  // Cada slide dentro do ato certo: o indice dele tem de cair entre dois atos.
  const dentroDe = (marca, ato) => {
    const i = APRES.indexOf(marca);
    const ini = pos[ato - 1], fim = ato < 7 ? pos[ato] : APRES.length;
    return i > ini && i < fim;
  };
  ok(dentroDe('slideEvolucao(pptx, d.evolucao', 1),
     'a evolucao fica no ato 1: o mes so tem sentido dentro da serie');
  ok(dentroDe('slidePipelines(pptx, d.pipelines', 2),
     'as frentes ficam no ato 2, antes de o deck cobrar prazo');
  /* O PROJETO SUBIU PARA JUNTO DAS FRENTES — pedido do Fernando. A frente diz EM QUE
   o mes foi gasto e o projeto diz PARA QUE: uma pergunta puxa a outra, e separa-las
   por cinco slides obrigava a sala a lembrar do numero anterior. */
ok(/slidePipelines\(pptx[\s\S]{0,600}slideProjetos\(pptx/.test(APRES),
   'os projetos vem logo depois das frentes de trabalho');
ok((APRES.match(/slideProjetos\(pptx, d\.projetos/g) || []).length === 1,
   'e o slide de projetos e gerado uma vez so — mover nao pode virar duplicar');
  // A marca do gantt precisa ser a CHAMADA, e nao a definicao: `slideGanttDev(pptx, dv`
  // casa com as duas, e a definicao mora la em cima, antes de qualquer ato.
  ok(dentroDe('slideTime(pptx, d.time', 5) && dentroDe('slideGanttDev(pptx, dv, ++p', 5),
     'e o bloco de pessoas fica inteiro no ato 5, sem corte no meio');
})();

// O fecho: destaques e "o que vem" sao as ultimas paginas de quem apresenta.
const iDest = APRES.indexOf('ATO 7 · O FECHO');
const iVem  = APRES.indexOf("var sp = slideTitulo(pptx, 'O que vem'");
const iBarr = APRES.indexOf("titulo: 'Entregas por desenvolvedor'");
ok(iDest > iBarr && iVem > iDest,
   'os destaques vem depois dos graficos, e "o que vem" depois deles');
ok(/fluxo: \{ recebidas: entradas\.length, entregues: conc\.length/.test(ADMIN),
   'e ele recebe entradas e entregues do mesmo periodo');
// Sem o tamanho do time e os dias que ele tinha, "entrou mais do que saiu" vira
// cobranca sem regua.
ok(/pessoa atuou' : ' pessoas atuaram'/.test(APRES) && /dias de ausência/.test(APRES),
   'com quantas pessoas atuaram, os dias uteis e os dias de ausencia');

sec('A capa e a da casa, e o mes conta a historia inteira');

// O deck abria com faixa azul e texto — generico, nada parecido com a capa que a
// apresentacao mensal ja usa. As posicoes vem da capa original, convertidas de
// ponto para polegada (pagina 960x540pt, slide 10x5,63").
ok(/window\.CAPA_TECNOLOGIA = \{/.test(CAPA), 'os elementos da capa existem');
ok(/fundo: 'data:image\/jpeg;base64/.test(CAPA) && /selos: 'data:image\/png;base64/.test(CAPA) &&
   /logo: 'data:image\/png;base64/.test(CAPA), 'e vao embutidos, sem depender de rede');
ok(/if \(!cap \|\| !cap\.fundo\) return slideCapaSimples/.test(APRES),
   'sem as imagens, a capa antiga entra — deck que nao abre e pior que deck feio');
ok(/function slideCapaSimples/.test(APRES), 'e o plano B continua existindo');
ok(ADMIN.indexOf('capa-tecnologia.js') < ADMIN.indexOf('apresentacao.js'),
   'a capa carrega antes de quem a usa');

// Numero sozinho mostra resultado sem esforco: nao diz quanta demanda chegou, o
// que o time pegou, nem o que ficou de pe para o mes seguinte.
ok(/function slideMes\(pptx, d, pagina\)/.test(APRES), 'o slide do mes e um funil, e nao um numero');
ok(/BACKLOG NO DIA 1/.test(APRES) && /'ENTRARAM'/.test(APRES) &&
   /SAÍRAM DA FILA/.test(APRES) && /EM ABERTO/.test(APRES),
   'na ordem em que a demanda anda: backlog, entradas, saidas, o que ficou');
// "Quantas" e a primeira pergunta; "do que" e a segunda, e separa construir de
// manter de pe o que ja existe.
ok(/Sem prazo combinado/.test(APRES) && !/Data lançada depois/.test(APRES),
   'o slide do prazo tem uma unica razao para ficar fora da conta: sem prazo combinado');
ok(/function slidePrazo\(pptx, d, pagina\)/.test(APRES) && /Sem medição/.test(APRES),
   'e o prazo mostra a conta, inclusive a fatia que nao da para medir');
// O backlog da virada e do FIM DO MES, e nao de hoje: numero de hoje contaria o
// que entrou depois da reuniao.
ok(/const vespera = vesp\.toISOString\(\)\.slice\(0, 10\);/.test(ADMIN),
   'o backlog do inicio e o da vespera do dia 1');

sec('A capa nao pode depender de uma fonte instalada');

// "TECNOLOGIA" quebrou em duas linhas por cima do "RELATÓRIO DE": pedi Montserrat,
// a maquina que abriu nao tem, e o PowerPoint trocou por um tipo mais largo.
ok(/wrap: false/.test(APRES), 'o titulo da capa nunca quebra linha');
// `wrap: false` sai correto no arquivo (o `wrap="none"` esta no XML) e MESMO ASSIM
// o PowerPoint quebrou. Entao o tamanho passa a sair de conta, e nao de escolha:
// largura da caixa dividida pelo numero de letras, com a largura media da fonte
// declarada. Cabe por construcao, e nao por promessa de renderizador.
ok(/var corpo = Math\.min\(62, Math\.floor\(LARG \/ \(0\.88 \* Math\.max\(titulo\.length, 1\)\) \* 72\)\);/.test(APRES),
   'o corpo do titulo e calculado pela largura disponivel');
ok(/fontFace: 'Arial Black'/.test(APRES),
   'com uma fonte que existe em qualquer maquina — a conta so vale se a fonte for a declarada');
ok(/margin: 0/.test(APRES),
   'sem o respiro interno, que empurrava o texto para baixo da posicao medida');
// Os selos vinham com retangulo preto: a transparencia mora num SMask separado.
// Recortar da pagina resolvia o retangulo preto, mas o fundo do recorte so QUASE
// combina com o do slide — e o "quase" vira um retangulo visivel.
ok(/COM A TRANSPARÊNCIA APLICADA/.test(CAPA),
   'os selos saem com o alfa do SMask aplicado, e nao com fundo junto');
ok(/selosPos: \{ x: 8\.58/.test(CAPA) && /logoPos:  \{ x: 8\.13/.test(CAPA),
   'com a proporcao medida na pagina — o quadrado esticava os selos');

sec('O slide do time diz quem esteve fora');

// Sem isso o slide convida a leitura errada: quem tirou ferias entrega menos e
// aparece embaixo da lista como se tivesse rendido menos.
ok(/function slideTime\(pptx, t, pagina, periodo, ausencias, cap, quebra\)/.test(APRES),
   'o slide do time recebe as ausencias e a capacidade de quem trabalhou');
// CONSTRUIR OU MANTER DE PE: vinte entregas de evolucao e vinte de sustentacao
// sao o mesmo numero e dois meses completamente diferentes.
ok(/O QUE FOI ENTREGUE/.test(APRES) && /quebra\.sustentacao/.test(APRES),
   'e mostra a quebra entre evolucao e sustentacao');
ok(/\(d\.quebra \|\| \{\}\)\.saidas/.test(APRES),
   'com a quebra das SAIDAS — o que o time entregou, e nao o que entrou na fila');
ok(/Fora no período/.test(APRES), 'e mostra quem esteve fora');
// Ferias que atravessam o mes pesam so os dias que caem no periodo apresentado.
ok(/const de = String\(a\.inicio \|\| ''\) > iso \+ '-01'/.test(ADMIN),
   'a contagem recorta a ausencia no mes apresentado');
ok(/if \(w !== 0 && w !== 6/.test(ADMIN) || /dow !== 0 && dow !== 6 && !ferAus\.has/.test(ADMIN),
   'e conta dias uteis, sem fim de semana nem feriado');

sec('A conta da fila fecha, e o corte tem data');

// Slide de conta que nao fecha e pior que nenhum: alguem soma na sala. Em junho
// dava 0 + 50 - 4 = 46 com backlog final de 32 — catorze demandas sumiam.
ok(/const filaEntrada = m => diaDe\(m\.criado_em\);/.test(ADMIN),
   'a fila tem uma data de entrada');
ok(/if \(c\) return c < e \? e : c;/.test(ADMIN),
   'e a saida nunca e anterior a entrada (demanda concluida antes de ser cadastrada)');
ok(/return FECHADO\.includes\(m\.status_planejamento \|\| ''\) \? e : '';/.test(ADMIN),
   'fechada sem data nenhuma sai no dia em que entrou, em vez de ficar aberta para sempre');
ok(/const backlogFim = vivasFluxo\.filter\(m => abertaEm\(m, corte\)\)\.length;/.test(ADMIN),
   'o backlog do fim usa a mesma regra do inicio');
ok(/saiuEntregue/.test(ADMIN) && /saiuNegada/.test(ADMIN),
   'a recusa sai da fila sem virar entrega');
// "Em aberto ao virar o mes" era ambiguo, e com o mes em curso virar o mes ainda
// nem aconteceu.
ok(/const corte = mesEmCurso \? hojeISO : fimMes;/.test(ADMIN),
   'o corte e hoje no mes em curso, e o ultimo dia no mes fechado');
ok(/f\.emCurso \? 'EM ABERTO HOJE' : 'EM ABERTO NO FIM'/.test(APRES),
   'e o slide diz qual dos dois esta mostrando');
ok(/f\.emCurso \? 'posição de ' : 'fechamento em '/.test(APRES),
   'com a data do corte escrita');

sec('Nada de outro mes entra no deck');

// "Nao posso trazer nenhum dado de outro mes conforme filtros." Um slide estava
// fora: o que esta travado listava toda demanda pausada da base, com os dias
// contados ate hoje — uma pausada em maio aparecia no relatorio de agosto com 90
// dias.
ok(/const p = String\(m\.pausado_em \|\| ''\)\.slice\(0, 10\);[\s\S]{0,40}?return p && p <= corte;/.test(ADMIN),
   'as pausadas sao as que ja estavam pausadas no corte do periodo');
ok(/Math\.round\(\(diaMs\(corte\) - diaMs\(m\.pausado_em\)\) \/ 86400000\)/.test(ADMIN),
   'e a contagem de dias para no corte, e nao em hoje');
ok(!/abertas: abertasHoje/.test(ADMIN),
   'a fila "em aberto hoje" saiu do deck: olhava para fora do periodo');

sec('Os projetos em aberto aparecem, inclusive os parados');

// Projeto aberto ha tres meses sem uma unica tarefa nao e ausencia de noticia: e a
// noticia. Omitir o parado seria esconder o que merece pergunta na reuniao.
ok(/function slideProjetos\(pptx, lista, pagina, periodo\)/.test(APRES),
   'o deck tem o slide de projetos');
// Dito com todas as letras, e nao com um zero que se le como "nao sei".
ok(/'sem tarefa no mês'/.test(APRES),
   'e o projeto sem movimento e dito com todas as letras');
ok(/const PRJ_ABERTO = \['planejado', 'em_andamento', 'pausado', ''\];/.test(ADMIN),
   'so entram os projetos em aberto');
ok(/String\(m\.concluido_em \|\| ''\)\.slice\(0, 7\) === iso &&/.test(ADMIN),
   'as tarefas concluidas do projeto sao as do periodo');
// O slide de demanda x capacidade repetia o slide do mes depois que ele passou a
// contar backlog, entradas e saidas.
ok(!/function slideFluxo/.test(APRES),
   'o slide que repetia o do mes saiu');
ok(/slideTime\(pptx, d\.time, \+\+p, d\.periodo, d\.ausencias, d\.capacidade,/.test(APRES),
   'e a capacidade foi para o slide do time, onde se fala de gente');

sec('O atraso do mes passado nao e atraso deste');

/* A DEMANDA CONTA NO MES DO PRAZO DELA, e nao no mes em que a entrega saiu.

   A regra antiga separava o "atraso herdado" mas media as CONCLUIDAS no mes, e
   isso abria um buraco: oito demandas prometidas para julho sairam em agosto e
   sumiam dos DOIS meses — de julho porque o filtro era por conclusao, de agosto
   porque o percentual (com razao) nao cobra de agosto um prazo de julho. Julho
   fechava com ZERO entregas medidas e oito atrasos que ninguem via.            */
ok(/const prometidas = \(state\.melhorias \|\| \[\]\)\.filter\(m =>[\s\S]{0,160}String\(m\.entrega \|\| ''\)\.slice\(0, 7\) === iso\)/.test(ADMIN),
   'o bloco de prazo parte do que foi PROMETIDO para o mes');
ok(!/const atrasoHerdado/.test(ADMIN) && !/herdadas:/.test(ADMIN),
   'e nao existe mais "atraso herdado": cada demanda conta no mes dela');
ok(/const medidas = noPrazoPz\.length \+ atrasPz\.length;/.test(ADMIN),
   'o percentual sai das prometidas para o mes que ja foram entregues');
// Prometida e ainda em aberto nao entra no percentual (nao ha entrega para medir),
// mas e dita no slide: some daqui seria esconder o compromisso nao cumprido.
ok(/const prometidasEmAberto = prometidas\.filter/.test(ADMIN) && /emAberto: prometidasEmAberto\.length/.test(ADMIN),
   'o que foi prometido e ainda nao saiu aparece no slide');
ok(/Ainda em aberto/.test(APRES), 'com faixa propria, e nao somado ao atraso');
// A sala precisa saber QUE RECORTE esta vendo, senao soma as entregas do mes e
// conclui que um dos dois slides esta errado.
ok(/Conta o que foi prometido para o mês/.test(APRES),
   'e o slide diz qual e o recorte');
ok(/pct: medidas \? Math\.round\(noPrazoPz\.length \/ medidas \* 100\) : 0/.test(ADMIN),
   'e fica fora do percentual do mes quem nao foi prometido para ele');
/* A entrega de quem tinha prazo em outro mes NAO some do deck: ela aparece nos
   slides de entrega do mes em que saiu (frentes, evolucao, time). O que muda e
   so ONDE o PRAZO dela e cobrado — no mes em que foi combinada. */
ok(/aparece no relatório daquele mês/.test(APRES),
   'e o slide diz onde a entrega de outro mes vai ser cobrada');
ok(/mesAnterior: apresentacaoMesNome\(\(mes \+ 10\) % 12\)/.test(ADMIN),
   'com o mes anterior escrito por extenso');
// Doze entregas de um dev e dezoito de outro nao dizem quem carregou mais peso.
ok(/valor: d\.entregas, extra: Math\.round\(d\.pontos\)/.test(ADMIN),
   'as entregas por dev levam os pontos junto');
ok(/rotuloExtra: 'pts'/.test(APRES) && /if \(it\.extra != null && cfg\.rotuloExtra\)/.test(APRES),
   'e a barra desenha o apoio ao lado do numero');

sec('A historia do mes tem quebra, comparativo e tendencia');

// O consolidado dizia quanto entrou e quanto saiu; nao dizia de que era.
ok(/backlogInicio: quebraTipo\(abertasNaVespera\)/.test(ADMIN) &&
   /saidas: quebraTipo\(saidas\)/.test(ADMIN),
   'cada numero da historia tem a quebra evolucao x sustentacao');
// A COR SEGUE A MELHORA, E NAO O SINAL: em metade destes numeros crescer e ruim, e
// pintar "+14 no backlog" de verde faria o slide mentir para a sala.
ok(/var melhor = bomSubir \? dif > 0 : dif < 0;/.test(APRES),
   'a cor da variacao segue a melhora, e nao o sinal');
ok(/chave: 'backlogInicio', bomSubir: false/.test(APRES) &&
   /chave: 'saidas', bomSubir: true/.test(APRES),
   'e cada numero diz para que lado e a melhora');
// Comparar 14 dias de agosto com 31 de julho diria que tudo caiu.
ok(/parcial: mesEmCurso/.test(ADMIN) && /comparação parcial/.test(APRES),
   'a comparacao com mes em curso avisa que e parcial');

sec('A eficiencia do time aparece: entregas rapidas e tendencia');

// Demanda que entrou e saiu em ate dois dias e o melhor argumento de eficiencia que
// estes dados tem, e estava invisivel: 29 de 77 em agosto contra 11 de 69 em julho.
ok(/function slideRapidas\(pptx, r, pagina, periodo, anterior\)/.test(APRES),
   'o deck tem o slide de entregas rapidas');
ok(/dias === null \|\| dias > 2 \? null/.test(ADMIN),
   'com o corte em dois dias corridos entre o cadastro e a conclusao');
ok(/it\.tipo, it\.tema/.test(APRES) && /corta\(it\.dev, 20\)/.test(APRES),
   'e cada linha diz o tipo, o modulo e o dev');
// Um mes sozinho nao mostra tendencia.
ok(/function slideEvolucao\(pptx, serie, pagina, periodo\)/.test(APRES),
   'o deck tem a evolucao mes a mes');
ok(/evolucao: evolucao\.slice\(Math\.max\(0, evolucao\.findIndex/.test(ADMIN),
   'e a serie comeca no primeiro mes com movimento, sem colunas zeradas antes');
// A visao que o quadro do Planejamento da e o deck nao dava.
ok(/function slideGanttDev\(pptx, dv, pagina, periodo\)/.test(APRES),
   'os tres primeiros devs tem o mes em linha do tempo');
ok(/\(ta\.porDev \|\| \[\]\)\.slice\(0, 3\)/.test(ADMIN),
   'tres, e nao o time inteiro — com dez nomes o slide vira lista');

sec('Vincular a um projeto nao empurra a demanda para tras');

// AX-195 saiu de Levantar Requisitos e voltou ao Backlog as 16:52 de 17/08, na mesma
// gravacao em que ganhou o vinculo com o EP-003. Quem vinculou nao pediu isso: a
// funcao forcava a etapa para Backlog sempre que um projeto era escolhido, sem
// distinguir criacao de edicao — e deixava o campo desabilitado, sem como corrigir.
ok(/const editando = !!\(document\.getElementById\('n-id'\) \|\| \{\}\)\.value;/.test(DEV),
   'a funcao do projeto sabe se e criacao ou edicao');
ok(/if \(etapa && !editando\) \{ etapa\.value = 'backlog'; etapa\.disabled = true; \}/.test(DEV),
   'e so a demanda NOVA vai para o backlog ao ganhar projeto');
ok(/A demanda fica na etapa em que está/.test(DEV),
   'em edicao, o aviso diz que a etapa nao se move');
// Campo vazio em demanda vinculada faz quem olha concluir que o vinculo nao existe.
ok(/selPrj\.value = m\.projeto_id \|\| '';/.test(DEV),
   'a edicao mostra o projeto que o card ja tem');

sec('Toda demanda nasce com codigo');

// A rota do formulario publico era a UNICA escrita que nao chamava atribuiCodigos: a
// demanda entrava no Kanban como card anonimo, e so ganhava numero se alguem
// publicasse pelo Admin depois. Sem codigo ela nao e citavel no Teams, no PR nem na
// reuniao.
const rotaPublica = W.slice(W.indexOf("data.melhorias.push(nova)"));
ok(/atribuiCodigos\(data\);/.test(rotaPublica.slice(0, 600)),
   'a sugestao publica recebe codigo antes de gravar');
ok(/return json\(\{ ok: true, id: nova\.id, codigo: nova\.codigo \}/.test(W),
   'e o codigo volta para quem abriu a demanda');

sec('Card com alteracao nao gravada nao fecha calado');

// Duas tasks foram perdidas pelo mesmo caminho: o card fechava sem dizer nada no X,
// no Esc e no clique fora, e o que estava digitado morria ali.
const DIALOGO = fs.readFileSync('dialogo.js', 'utf8');
ok(/window\.escolher3 = function/.test(DIALOGO),
   'existe o dialogo de tres respostas');
ok(/id="dlg-fica"/.test(DIALOGO) && /id="dlg-alt"/.test(DIALOGO) && /id="dlg-ok"/.test(DIALOGO),
   'com salvar, descartar e continuar editando');
// O gesto ambiguo tem de cair no lado que nao apaga nada.
ok(/if \(e\.target === ov\) fecha\(''\);/.test(DIALOGO) &&
   /if \(e\.key === 'Escape'\) \{ e\.preventDefault\(\); fecha\(''\); \}/.test(DIALOGO),
   'e Esc e clique fora escolhem "continuar editando"');
// O retrato sai dos campos, e nao de uma lista de nomes: lista esquece o campo novo.
ok(/el\.querySelectorAll\('input, select, textarea'\)/.test(DIALOGO),
   'o retrato do card sai dos proprios campos do formulario');
// Salvar que para numa validacao nao pode fechar o card: era a perda de novo.
ok(/if \(aberto && okSalvo !== true\) return false;/.test(DIALOGO),
   'gravacao que para numa validacao mantem o card aberto');

[['Admin', ADMIN], ['Gantt', GANTT], ['Dev', DEV]].forEach(([tela, src]) => {
  ok(/async function closeModal\(id\) \{[\s\S]{0,200}?guardaPodeFechar\(id\)/.test(src),
     tela + ': fechar o card passa pela guarda');
  ok(/if \(topo\.id && window\.guardaMexeu && guardaMexeu\(topo\.id\)\) \{ closeModal\(topo\.id\); return; \}/.test(src),
     tela + ': e o Esc tambem — era a saida mais silenciosa de todas');
  ok(/guardaLiga\('modal-/.test(src), tela + ': a guarda e ligada ao abrir o card');
  ok(/guardaDesliga\('modal-/.test(src), tela + ': e desligada depois de gravar');
});

/* ─── AS FRENTES DE TRABALHO (pipelines) ─────────────────────────────────
   O eixo do painel que a diretoria aprovou. Cada regra aqui existe porque a
   alternativa produz um numero errado num slide de diretoria — o lugar onde
   errar custa mais caro nesta ferramenta.                                    */
sec('As frentes de trabalho sao uma regra so');

// A regra vive em pipelines.js e em lugar nenhum mais. Duas listas de frentes em
// dois arquivos e o mesmo defeito dos 42 temas com quatro grafias de AxCred.
ok(/window\.PIPELINES|raiz\.PIPELINES/.test(PIPE),
   'pipelines.js publica a regra num objeto so');
ok(/<script src="pipelines\.js/.test(ADMIN),
   'o admin carrega pipelines.js');
ok(!/const PIPELINES\s*=\s*\[/.test(semComentario(ADMIN)),
   'o admin NAO redeclara a lista de frentes');
ok(!/const PIPELINES\s*=\s*\[/.test(semComentario(APRES)),
   'o gerador do deck NAO redeclara a lista de frentes');

// Suporte, Bitrix e Analise de requisitos ficam FORA por decisao. Sem trava,
// alguem "conserta" a ausencia delas e o slide ganha tres cartoes zerados.
['Suporte', 'Bitrix 24', 'Análise de requisitos'].forEach((f) => {
  ok(new RegExp("'" + f + "'").test(PIPE.slice(PIPE.indexOf('FORA_DO_DECK'), PIPE.indexOf('FORA_DO_DECK') + 200)),
     'fica fora do deck por decisao: ' + f);
});
ok(/function canonica[\s\S]{0,200}VALIDOS\[norm\(nome\)\] \|\| ''/.test(PIPE),
   'frente que nao entra no deck resolve para vazio, e nao para si mesma');

// O CADASTRO VENCE A SEMENTE. Marcar alguem na tela e o deck ignorar e o mesmo
// defeito que fez as marcacoes de DEV-AXCred sumirem, so que silencioso.
ok(/doCadastro[\s\S]{0,200}if \(doCadastro\) return doCadastro;[\s\S]{0,120}PORNOME/.test(PIPE),
   'o cadastro vence a semente, e nao o contrario');
ok(/uSetPerfil\([^)]*\\'pipeline\\'/.test(ADMIN),
   'a tela de contas grava a frente em devs_perfil');
ok(/'devs_perfil'/.test(ADMIN.slice(ADMIN.indexOf('MEUS_CAMPOS'), ADMIN.indexOf('MEUS_CAMPOS') + 300)),
   'devs_perfil continua na lista que a tela grava — a frente mora nele');

// Quem esta sem frente APARECE. Sumir e pior: em agosto sao 48h que sairiam da
// conta sem ninguem notar.
ok(/NAO_CLASSIFICADO/.test(PIPE) && /NAO_CLASSIFICADO/.test(ADMIN),
   'quem esta sem frente vira "Nao classificado", e nao desaparece');

sec('O planejado do deck cabe na capacidade do time');

// PLANEJADO = janela do planejamento, RATEADA. Sem ratear, uma pessoa aparecia
// com 528h planejadas num mes de 184h porque as janelas se sobrepoem.
ok(/const planejado = rateiaHoras\(conc, m => \(\{[\s\S]{0,140}m\.entrega/.test(ADMIN),
   'o planejado sai da janela do planejamento (inicio -> entrega)');
ok(/rateiaHoras/.test(ADMIN.slice(ADMIN.indexOf('function apresPipelines'),
                                  ADMIN.indexOf('function apresPipelines') + 1200)),
   'e passa pelo RATEIO — dia de uma pessoa nao estica alem de 8h');
ok(/HORAS_DIA \/ quantas/.test(ADMIN),
   'o dia util e dividido entre as demandas daquele dia');

// UMA regra de hora realizada para a tela inteira. Eram tres respostas
// diferentes: a tabela preferia a digitada, o KPI usava so o rateio, e a
// "Eficiencia" dava ~100% todo mes por comparar rateio contra rateio.
ok(/function horasReaisDe\(m, rateado\)/.test(ADMIN),
   'existe UMA funcao de hora realizada');
ok(/if \(Number\.isFinite\(digitada\) && digitada > 0\) return \{ h: digitada, medida: true \}/.test(ADMIN),
   'ela prefere a hora MEDIDA quando existe');
['const totalReal', 'realPorTema', 'realPorDev'].forEach((alvo) => {
  const i = ADMIN.indexOf(alvo);
  ok(i > 0 && /horasReaisDe|somaReal|realDe/.test(ADMIN.slice(i, i + 220)),
     'usa a mesma regra de hora realizada: ' + alvo);
});
ok(/const real = horasReaisDe\(m, rateadoReal\)/.test(ADMIN),
   'e o deck usa a MESMA regra que a tela');

// A cobertura anda junto do numero: julho tem 39% das entregas com hora lancada,
// e sem a nota o slide acusa o time de nao ter trabalhado.
ok(/cobertura:\s*\{[\s\S]{0,200}comHoras/.test(ADMIN),
   'o deck leva a cobertura de horas junto');
ok(/Horas lançadas em/.test(APRES),
   'e o slide imprime essa cobertura');
ok(/cada dia útil vale 8h/.test(APRES),
   'o slide diz de onde saiu o planejado');

/* `rectRadius` SO EM roundRect — foi isso que deixou o slide de projetos VAZIO.

   Passado junto com `ellipse`, o PptxGenJS escreve <a:gd name="adj"> dentro de um
   <a:prstGeom prst="ellipse">, que nao tem parametro de ajuste. O XML fica
   invalido e o PowerPoint descarta a forma E o conteudo do cartao junto: o slide
   abria com o cabecalho certo, "7 projetos em aberto" no canto, e os cartoes em
   branco. O XML "passava" na minha conferencia porque eu media posicao e texto,
   e nao a validade da geometria.                                                */
(() => {
  const trechos = APRES.split('addShape(');
  const ruins = trechos.filter((t) => {
    const cab = t.slice(0, 260);
    return /ShapeType\.ellipse/.test(cab) && /rectRadius/.test(cab) &&
           !/if \(i >= 3\) medalha\.rectRadius/.test(cab);
  });
  ok(!ruins.length, 'nenhuma elipse recebe rectRadius — XML que o PowerPoint recusa');
  ok(/if \(i >= 3\) medalha\.rectRadius = 0\.04;/.test(APRES),
     'a medalha so ganha raio quando e o retangulo arredondado');
})();

/* CADA COR FAZ UM PAPEL SO POR SLIDE.
   No slide do time o ambar era sustentacao na barra E ausencia no texto: o olho
   achava o amarelo do grafico, procurava o amarelo do texto e ligava
   "sustentacao" a "Gabriel Fernandes, ferias" — duas coisas sem relacao. */
(() => {
  const corpo = APRES.slice(APRES.indexOf('function slideTime'),
                            APRES.indexOf('function slideAreas'));
  const ambar = (corpo.match(/C\.ambar/g) || []).length;
  ok(ambar <= 1, 'no slide do time o ambar aparece uma vez so', ambar + ' usos');
  /* A AUSENCIA E AMBAR, que no padrao quer dizer ATENCAO — e e o que ela e:
     capacidade que o mes nao teve, e a resposta para "por que entregou menos". */
  ok(/color: SIGNIFICADO\.atencao \}\);/.test(corpo),
     'a ausencia usa a cor de atencao, e nao a mesma do grafico ao lado');
})();

/* A HORA REALIZADA E RECORTADA NO MES, como o planejado ja era.

   A hora e lancada DE UMA VEZ na conclusao e vale pela demanda inteira. Quando a
   demanda atravessa o mes, essa hora inteira caia no mes em que ela terminou —
   contra um planejado que ja vinha recortado. AX-096 tem janela de 06/07 a 10/08
   e 140,5h lancadas: agosto recebia as 140,5h contra 40h de planejado, e sozinha
   ela empurrava o mes de 93% para 118%. "Entregamos 18% a mais do que
   planejamos" e uma frase que nao se sustenta numa reuniao — e nao era verdade. */
ok(/function horasDoMes\(m, deISO, ateISO, rateado\)/.test(ADMIN),
   'existe a funcao que recorta a hora medida no mes');
ok(/const hReal = horasDoMes\(m, de, ate, rateadoReal\);/.test(ADMIN),
   'e o slide de frentes usa ela, e nao a hora cheia da demanda');
ok(/hReal \+= horasDoMes\(m, iso \+ '-01', fimMes, prjRatReal\);/.test(ADMIN),
   'o ranking de projetos tambem');
ok(/return r\.h \* dentro \/ total;/.test(ADMIN),
   'o recorte e proporcional aos dias uteis da janela de trabalho');
ok(/if \(!ehData\(ini\) \|\| !ehData\(fim\) \|\| fim < ini\) return r\.h;/.test(ADMIN),
   'e demanda sem janela fica inteira no mes em que saiu, sem inventar rateio');

/* "NAO CLASSIFICADO" NAO E PALAVRA DE SLIDE EXECUTIVO.
   Ela convida a pergunta "e o que e isso?" sem ter resposta. A saida nao e
   esconder: e mapear a pessoa para a frente certa — AX Leader e Vibe Code. */
ok(/'João Carvalho': 'IA & Vibe coding'/.test(PIPE),
   'quem estava sem frente foi mapeado, e nao escondido');

// QUEM, e nao so onde: "Antifraude, 9 entregas" deixa a pergunta seguinte na mao
// de quem apresenta, no meio da reuniao.
ok(/devs: Object\.entries\(f\.devs\)/.test(ADMIN) && /f\.devs\.join\(', '\)/.test(APRES),
   'as frentes de atraso levam o responsavel');

/* O TEXTO DO DESTAQUE VEM DO CARD, EM MARKDOWN. Ia cru para o slide — "## Por que
   a mudanca" projetado na parede — e transbordava por cima do titulo e do rodape. */
ok(/function textoLimpo\(t, max\)/.test(APRES), 'existe a limpeza de markdown');
ok(/textoLimpo\(m\.texto, \d+\)/.test(APRES), 'e o destaque passa por ela');

// A REGUA DE DIAS DO GANTT: "10" saia como "1" e "0" em duas linhas.
ok(/fontSize: 9, color: C\.fraco, align: 'center', wrap: false/.test(APRES),
   'a regua de dias nao quebra o numero em duas linhas');
ok(/addText\('dia do mês'/.test(APRES),
   'e diz o que os numeros dela sao');

sec('O slide das frentes cabe no slide');

/* AS MEDIDAS DO CARTAO SAO CONTADAS, e a conta e conferida aqui.

   Eu errei essa conta DUAS vezes, e as duas apareceram no PPTX gerado, nao no
   codigo: primeiro com cartoes de 1,12" (a segunda linha terminava em 4,85" e
   passava por cima da nota de cobertura), depois com 0,66" e tres linhas (fechava
   em 4,72", mesma colisao). Layout que depende de eu somar certo de cabeca e
   layout que quebra — entao a soma vira invariante.                            */
(() => {
  const corpo = APRES.slice(APRES.indexOf('function slidePipelines'),
                            APRES.indexOf('function slidePipelines') + 9000);
  const m = corpo.match(/var CW = ([\d.]+), CH = ([\d.]+), CVX = ([\d.]+), CVY = ([\d.]+);/);
  ok(!!m, 'as medidas do cartao de frente estao declaradas juntas');
  const y0 = corpo.match(/var y = ([\d.]+) \+ lin \* \(CH \+ CVY\);/);
  ok(!!y0, 'e a linha do cartao sai de uma origem declarada');
  // A nota de cobertura e o piso: os cartoes tem de terminar antes dela.
  const nota = corpo.match(/notas\.join\('   ·   '\), \{\s*x: [\d.]+, y: ([\d.]+),/);
  ok(!!nota, 'a nota de cobertura tem posicao declarada');
  if (m && y0 && nota) {
    const [, cw, ch, cvx, cvy] = m.map(Number);
    const topo = Number(y0[1]), pisoNota = Number(nota[1]);
    // Seis frentes (as cinco + "nao classificado") em duas colunas = tres linhas.
    const linhas = Math.ceil(6 / 2);
    const fim = topo + linhas * ch + (linhas - 1) * cvy;
    ok(fim <= pisoNota,
       'com 6 frentes os cartoes terminam antes da nota de cobertura',
       fim.toFixed(2) + '" <= ' + pisoNota.toFixed(2) + '"');
    ok(5.05 + (cw + cvx) + cw <= 9.55,
       'a segunda coluna de cartoes nao passa da margem direita');
    // E o conteudo cabe DENTRO do cartao: nome, numeros e a linha de entregas.
    const ult = corpo.match(/y: y \+ ([\d.]+), w: CW - [\d.]+, h: ([\d.]+), fontSize: 7\.5,/);
    ok(!!ult && Number(ult[1]) + Number(ult[2]) <= ch,
       'a ultima linha de texto cabe dentro do cartao',
       ult ? (Number(ult[1]) + Number(ult[2])).toFixed(2) + '" <= ' + ch.toFixed(2) + '"' : '');
  }
  /* O NOME DA FRENTE SAI INTEIRO, e nao "IA & Vibe co…".
     Ele dividia a linha com o percentual e sobrava caixa para 13 caracteres — os
     nomes tem ate 20 ("Dados & Inteligência"). O percentual desceu para a linha
     dos numeros, e o nome ficou com a largura toda do cartao. */
  ok(/s\.addText\(it\.nome, \{\s*x: x \+ [\d.]+, y: y \+ [\d.]+, w: CW - 0\.22,/.test(corpo),
     'o nome da frente ocupa a largura do cartao, sem corte');
  ok(!/corta\(it\.nome/.test(corpo),
     'e nao passa por `corta`: nome truncado nao diz qual frente e');
  // Na linha dos numeros, o percentual comeca depois de onde o realizado termina.
  const real = corpo.match(/it\.real \+ 'h', \{ x: x \+ ([\d.]+), y: y \+ [\d.]+, w: ([\d.]+)/);
  const pct = corpo.match(/x: x \+ CW - ([\d.]+), y: y \+ [\d.]+, w: [\d.]+, h: [\d.]+, fontSize: 11\.5,/);
  ok(!!real && !!pct, 'realizado e percentual do cartao estao posicionados');
  if (real && pct && m) {
    const cw = Number(m[1]);
    const fimReal = Number(real[1]) + Number(real[2]);
    const iniPct = cw - Number(pct[1]);
    ok(fimReal <= iniPct, 'o realizado para antes do percentual',
       fimReal.toFixed(2) + '" <= ' + iniPct.toFixed(2) + '"');
  }
  /* O TITULO PARA ANTES DO PERIODO, que fica no canto direito do cabecalho.
     Na primeira versao o titulo tinha 6,4" de caixa a partir de 0,5" e o periodo
     abria em 6,6": 0,30" de invasao, que a prova do PPTX pegou. */
  [[/addText\('FRENTES DE TRABALHO', \{\s*x: ([\d.]+), y: [\d.]+, w: ([\d.]+),/, 'FRENTES DE TRABALHO'],
   [/addText\('PRINCIPAIS PROJETOS', \{\s*x: ([\d.]+), y: [\d.]+, w: ([\d.]+),/, 'PRINCIPAIS PROJETOS']]
    .forEach(([re, tit]) => {
      const t = APRES.match(re);
      ok(!!t, 'o titulo "' + tit + '" tem caixa declarada');
      if (t) {
        ok(Number(t[1]) + Number(t[2]) <= 6.5,
           'e ele para antes do periodo, no canto direito: ' + tit,
           (Number(t[1]) + Number(t[2])).toFixed(2) + '" <= 6,50"');
      }
    });
})();

/* O DECK INTEIRO USA A PALETA DO PAINEL APROVADO.
   Era um preto neutro; virou o azul-quase-preto daquele quadro. Nenhum slide
   escreve cor na mao — e essa regra que faz a troca valer no deck todo em vez de
   nos slides que alguem lembrou de atualizar. */
ok(/fundo:\s*'070B16'/.test(APRES), 'o fundo do deck e o azul do painel');
ok(/borda:\s*'223052'/.test(APRES), 'e existe a cor de borda dos cartoes');
(() => {
  // Cor escrita direto no slide, fora do objeto C: cada uma dessas e um lugar que
  // a proxima troca de paleta vai esquecer.
  const corpo = APRES.slice(APRES.indexOf('function slideBase'));
  const cruas = (corpo.match(/color: '[0-9A-Fa-f]{6}'/g) || [])
    .filter((c) => !/'(FFFFFF|000000)'/.test(c));
  ok(!cruas.length, 'nenhum slide escreve cor hexadecimal na mao',
     cruas.slice(0, 3).join(', '));
})();

// O RODAPE SAI UMA VEZ SO. `slideTitulo` desenhava um, e quase todo slide
// desenhava outro por cima — o numero da pagina saia duplicado e engordava.
ok(!/function slideTitulo\(pptx, titulo, sub, pagina\) \{[\s\S]{0,400}?rodape\(s, '', pagina\)/.test(APRES),
   'slideTitulo nao desenha mais o rodape');
(() => {
  // Todo slide que usa slideTitulo tem de desenhar o rodape uma vez.
  const blocos = APRES.split(/\n  function /).slice(1)
    .filter((f) => /slideTitulo\(/.test(f) && !/^slideTitulo/.test(f));
  const semRodape = blocos.filter((f) => !/rodape\(/.test(f))
    .map((f) => f.slice(0, f.indexOf('(')));
  ok(!semRodape.length, 'todo slide com titulo desenha o proprio rodape',
     semRodape.join(', '));
})();

// O SLIDE RESPEITA O FILTRO DE DATA. E a regra que ja foi violada uma vez, por
// "o que esta travado", e custou dado de outro mes num deck fechado.
ok(/apresPipelines\(conc, iso \+ '-01', fimMes\)/.test(ADMIN),
   'as frentes usam a mesma lista e o mesmo recorte do resto do deck');

/* ─── O ATRASO PARA QUANDO O DEV ENTREGA ─────────────────────────────────
   AX-165 tinha prazo em 07/08, o dev entregou em 03/08 e a validacao saiu em
   12/08: o relatorio cobrava 5 dias de atraso de uma entrega adiantada. Eram 10
   demandas e 20 dias cobrados de quem cumpriu o combinado.                    */
sec('O atraso e do dev, e para quando ele entrega');

// UMA regra, e nao uma por tela: `STATUS_ATRASO` era declarada em quatro telas e
// SO o admin incluia 'validacao' — a mesma demanda aparecia atrasada no painel do
// PM e no prazo no quadro do dev.
['admin.html', 'gantt.html', 'dev.html', 'index.html'].forEach((f) => {
  const src = lerTela(f);
  ok(/<script src="prazo\.js/.test(src), f + ' carrega prazo.js');
  ok(!/const STATUS_ATRASO\s*=/.test(semComentario(src)),
     f + ' NAO declara mais a propria lista de etapas que atrasam');
  ok(/PRAZO\.estaAtrasada\(m, /.test(src),
     f + ' decide o atraso pela regra compartilhada');
});
ok(!/new Date\(m\.entrega \+ 'T00:00:00'\) < hoje/.test(
     [ADMIN, GANTT, DEV, INDEX].join('\n')),
   'nenhuma tela compara a entrega com hoje por conta propria');

/* O NUMERO DE DIAS SAI DA MESMA REGRA DO BADGE.
   Esta era a SEXTA copia da conta, e escapou da primeira varredura porque nao
   usava STATUS_ATRASO nem prazoClassifica — calculava no proprio card:
   `Date.now() - new Date(m.entrega)`. O efeito era a mesma regra dando duas
   respostas no MESMO card: o badge respeitava a entrega do dev e o numero ao lado
   dele nao. AX-157, entregue UM dia depois do prazo, mostrava "Atrasada · 5d"
   cinco dias depois, porque a conta seguia correndo na fila da validacao.        */
ok(!/Date\.now\(\) - new Date\(m\.entrega/.test(ADMIN) &&
   !/Date\.now\(\) - new Date\(maisAntiga\.entrega/.test(ADMIN),
   'o card e o banner nao contam mais os dias por conta propria');
ok(/const diasAtraso = window\.PRAZO[\s\S]{0,120}PRAZO\.diasDeAtraso\(m, statusKey\(m\)/.test(ADMIN),
   'os dias do card saem de PRAZO.diasDeAtraso');
ok(/PRAZO\.diasDeAtraso\(maisAntiga, statusKey\(maisAntiga\)/.test(ADMIN),
   'e os do banner de risco tambem');
(() => {
  // Varredura: nenhuma tela pode subtrair a entrega de "agora" para achar atraso.
  const suspeitas = [];
  [['admin.html', ADMIN], ['gantt.html', GANTT], ['dev.html', DEV], ['index.html', INDEX]]
    .forEach(([nome, src]) => {
      const s = semComentario(src);
      if (/Date\.now\(\)[^;]{0,60}\.entrega/.test(s)) suspeitas.push(nome);
    });
  ok(!suspeitas.length, 'nenhuma tela deriva atraso de Date.now() menos a entrega',
     suspeitas.join(', '));
})();

// A ETAPA DE VALIDACAO FICA FORA das que correm: e ali que o dev ja saiu de cena.
ok(/ETAPAS_QUE_CORREM = \['planning', 'planejado', 'em_andamento'\]/.test(PRZ),
   'validacao NAO esta entre as etapas em que o atraso corre');
ok(/ETAPAS_APOS_O_DEV = \['validacao', 'concluido'\]/.test(PRZ),
   'validacao e conclusao medem pela entrega do dev, e nao por hoje');

// `entregue_em` e gravado ao ENTRAR em validacao — e por isso ele responde
// "quando o dev terminou" sem depender de o PM ter validado.
ok(/if \(colKey === 'validacao'\) \{\s*m\.entregue_em = new Date\(\)\.toISOString\(\);/.test(DEV),
   'entregue_em e gravado no instante em que a demanda entra em validacao');
/* REPROVADA CONTA A ULTIMA ENTREGA. AX-165: entregue 03/08 (prazo 07/08),
   reprovada 06/08, entregue de novo 11/08 — atraso de 4 dias, e nao zero. Guardar
   a primeira data faria uma demanda REPROVADA aparecer no prazo no relatorio. */
ok(!/colKey === 'validacao' && !m\.entregue_em/.test(DEV),
   'e entregar DE NOVO depois de reprovada sobrescreve a data');
ok(/m\.entregue_em = new Date\(\)\.toISOString\(\);/.test(
     WC.slice(WC.indexOf("m.status_planejamento = 'validacao'"),
              WC.indexOf("m.status_planejamento = 'validacao'") + 400)) &&
   !/if \(!m\.entregue_em\) m\.entregue_em = new Date/.test(WC),
   'a rota de entrega da API tambem sobrescreve, e nao so na primeira vez');
// Mas CONCLUIR nao e entregar: quem conclui e o PM/PO, e a data do dev fica.
ok(/colKey === 'concluido' && !m\.entregue_em/.test(DEV),
   'concluir so preenche a data quando ela nao existe — validar nao vira entrega');
ok(/m\.entregue_em = new Date\(\)\.toISOString\(\)/.test(WC),
   'e o servidor grava tambem, para o caminho que nao passa pela tela');
ok(/function fimDoDev\(m\)[\s\S]{0,400}entregue_em[\s\S]{0,200}concluido_em/.test(PRZ),
   'o fim do trabalho do dev e entregue_em, com concluido_em como reserva');

// O ATRASO CONGELA, NAO DESAPARECE. Zerar quem entregou atrasado seria trocar um
// erro por outro: AX-069 entregou 5 dias depois e continua mostrando 5.
ok(/ETAPAS_APOS_O_DEV\.includes\(etapa\)\) \{[\s\S]{0,200}ref = fimDoDev\(m\)/.test(PRZ),
   'depois da entrega o atraso e medido pela entrega — logo, para de crescer');

// O relatorio e o deck usam a MESMA regra: numero do slide que discorda do badge
// da tela e a origem de "mas na tela nao estava atrasado".
ok(/PRAZO\.fimDoDev\(m\)/.test(ADMIN) && /PRAZO\.diasDeAtraso\(m, 'concluido'/.test(ADMIN),
   'a classificacao de prazo do relatorio usa a regra compartilhada');
ok(!/const ce = String\(m\.concluido_em \|\| ''\)\.slice\(0, 10\);[\s\S]{0,300}dia\(ce\) - dia\(pz\)/
     .test(ADMIN),
   'e nao sobrou a conta antiga (conclusao contra prazo) no relatorio');

// Fuso: a diferenca e feita por UTC a partir das partes da data. `new Date` no
// fuso local devolve o dia anterior em UTC-3, e um dia aqui muda o veredito.
ok(/Date\.UTC\(\+p\[0\], \+p\[1\] - 1, \+p\[2\]\)/.test(PRZ),
   'a diferenca de dias e calculada em UTC, sem passar pelo fuso local');
// Pausada continua sem atrasar.
ok(/if \(m\.pausado_em && !ETAPAS_APOS_O_DEV\.includes\(etapa\)\) return null/.test(PRZ),
   'pausada nao atrasa: o prazo esta suspenso, nao estourado');

/* CONCLUIR DIRETO, SEM PASSAR PELA VALIDACAO, TAMBEM ENCERRA O PRAZO DO DEV —
   e a data fica GRAVADA, nao deduzida.

   `fimDoDev` ja caia em `concluido_em` quando faltava `entregue_em`, e o numero
   era o mesmo. O furo era outro: essa demanda, reaberta e mandada para validacao
   depois, receberia `entregue_em` com a data DAQUELE dia — e o atraso do dev
   pioraria retroativamente por causa de um passo do PM/PO.                      */
ok(/if \(!String\(m\.entregue_em \|\| ''\)\.trim\(\)\) m\.entregue_em = m\.concluido_em;/.test(ADMIN),
   'concluir pelo admin grava a data de entrega do dev');
ok(/else if \(colKey === 'concluido' && !m\.entregue_em\)/.test(DEV),
   'e concluir arrastando no painel do dev tambem grava');
ok(/sp === 'concluido' && !String\(m\.entregue_em \|\| ''\)\.trim\(\)/.test(WC),
   'o SERVIDOR garante a data em toda conclusao, qualquer que seja a rota');
(() => {
  // A garantia do servidor mora em normalizaEstados, que roda em TODO caminho de
  // escrita — numa funcao chamada de um caminho so, a outra rota ficaria de fora.
  const i = WC.indexOf('function normalizaEstados');
  const corpo = WC.slice(i, WC.indexOf('\n}', i));
  ok(/entregue_em/.test(corpo),
     'e essa garantia esta em normalizaEstados, que roda em toda escrita');
  ok((WC.match(/normalizaEstados\(/g) || []).length >= 4,
     'normalizaEstados e chamado em todas as rotas de escrita');
})();

// A API tambem congela o atraso: ela contava contra HOJE e o numero crescia todo
// dia para quem ja tinha entregado.
ok(/etapa === 'validacao' && \/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(entregue\)/.test(WC) ||
   /const ref = \(etapa === 'validacao'/.test(WC),
   'a API mede o atraso pela entrega quando a demanda esta em validacao');
ok(/atrasada: diasDeAtraso\(m, hojeBR\(\)\) > 0/.test(WC),
   'e `atrasada` da API sai da mesma conta');

/* "ESTA ATRASADA AGORA" E "ATRASOU NA ENTREGA" SAO PERGUNTAS DIFERENTES.

   Eu as juntei numa funcao so ao unificar a regra, e o efeito apareceu no painel
   do dev: "4 demandas suas estao com o prazo vencido" com as QUATRO ja
   concluidas. Quem entregou ontem com um dia de atraso abria o painel hoje e via
   cobranca de coisa que ja fez.

   O atraso vale enquanto a demanda esta na esteira do dev. Depois da entrega ele
   vira historico: continua no relatorio do mes, e sai do painel de pendencia.   */
ok(/function estaAtrasada\(m, etapa, hoje\) \{\s*if \(!ETAPAS_QUE_CORREM\.includes\(etapa\)\) return false;/.test(PRZ),
   'estaAtrasada responde so pela esteira do dev');
ok(/function atrasouNaEntrega\(m\)/.test(PRZ),
   'e existe uma funcao propria para "entregou com atraso"');

// A REGRA RODA DE VERDADE, e nao so existe no arquivo.
(() => {
  let P = null;
  try { P = require('./prazo.js'); } catch (e) { /* reportado abaixo */ }
  ok(!!P, 'prazo.js carrega como modulo');
  if (!P) return;
  const HOJE = '2026-08-20';
  // AX-165: entregou 4 dias antes do prazo, validacao saiu depois.
  ok(P.diasDeAtraso({ entrega: '2026-08-07', entregue_em: '2026-08-03T10:00:00Z',
                      concluido_em: '2026-08-12' }, 'concluido', HOJE) === 0,
     'entrega adiantada com validacao atrasada NAO conta atraso');
  // AX-088: entregou exatamente no dia combinado.
  ok(P.diasDeAtraso({ entrega: '2026-08-14', entregue_em: '2026-08-14T18:00:00Z',
                      concluido_em: '2026-08-17' }, 'concluido', HOJE) === 0,
     'entrega no dia do prazo NAO conta atraso');
  // AX-069: entregou 5 dias depois — e continua 5 daqui a quatro meses.
  ok(P.diasDeAtraso({ entrega: '2026-08-13', entregue_em: '2026-08-18T09:00:00Z' },
                    'validacao', HOJE) === 5 &&
     P.diasDeAtraso({ entrega: '2026-08-13', entregue_em: '2026-08-18T09:00:00Z' },
                    'validacao', '2026-12-31') === 5,
     'atraso de quem entregou tarde CONGELA na data da entrega');
  // Em andamento o atraso continua correndo: nada foi entregue ainda.
  ok(P.diasDeAtraso({ entrega: '2026-08-14' }, 'em_andamento', HOJE) === 6,
     'em andamento, o atraso corre contra hoje');
  ok(P.diasDeAtraso({ entrega: '2026-01-01' }, 'backlog', HOJE) === null,
     'backlog nao atrasa: nada foi prometido');
  ok(P.diasDeAtraso({ entrega: '2026-08-01', pausado_em: '2026-08-05' },
                    'em_andamento', HOJE) === null,
     'pausada em andamento nao atrasa');
  // Off-by-one de fuso, nas duas direcoes.
  ok(P.diasDeAtraso({ entrega: '2026-07-31', entregue_em: '2026-08-01T02:00:00Z' },
                    'validacao', HOJE) === 1,
     'a virada do mes conta um dia, e nao zero nem dois');

  /* O CASO DO PAINEL DO DEV: AX-157, entregue um dia depois do prazo e ja
     concluida. Ela NAO e pendencia dele — mas o relatorio do mes continua
     contando o dia de atraso que houve. */
  const entregue = { entrega: '2026-08-14', entregue_em: '2026-08-15T10:00:00Z',
                     concluido_em: '2026-08-17' };
  ok(P.estaAtrasada(entregue, 'concluido', HOJE) === false,
     'concluida nao aparece como pendencia atrasada no painel');
  ok(P.estaAtrasada(entregue, 'validacao', HOJE) === false,
     'nem a que esta esperando validacao — o dev ja entregou');
  ok(P.atrasouNaEntrega(entregue) === true &&
     P.diasDeAtraso(entregue, 'concluido', HOJE) === 1,
     'mas o relatorio continua sabendo que ela atrasou um dia');
  // O que AINDA esta com o dev continua cobrado.
  ok(P.estaAtrasada({ entrega: '2026-08-14' }, 'em_andamento', HOJE) === true,
     'e o que ainda esta na esteira do dev continua marcado');
})();

/* ─── SUBTAREFAS: o passo a passo dentro da demanda ──────────────────────
   Pedido do time (Joao Vitor): uma demanda de tres semanas fica "em andamento"
   do inicio ao fim, e quem pergunta como ela esta ouve a mesma resposta todo
   dia. As invariantes daqui protegem as duas coisas que fazem o campo servir
   para alguma coisa: o progresso ser um numero que se le sem abrir a demanda,
   e a gravacao nao passar por cima do que outra tela escreveu.               */
sec('Subtarefas');

// As funcoes puras, tiradas da tela e RODADAS. Regra conferida so por regex
// passa a existir no comentario, e nao no comportamento.
(function () {
  const fonte = ['msSubsDe', 'msSubProgresso', 'msSubParaGravar']
    .map(n => corpo(DEV, 'function ' + n + '('))
    .filter(Boolean);
  ok(fonte.length === 3, 'as tres funcoes puras da subtarefa existem em dev.html');
  if (fonte.length !== 3) return;
  const F = new Function('_msSubs', fonte.join('\n') +
    '\nreturn { msSubsDe, msSubProgresso, msSubParaGravar };');

  const S = F([]);
  ok(S.msSubProgresso([]).pct === null,
     'demanda sem subtarefa nao tem percentual — e nao 0%',
     '0% diria "nada feito"; o certo e "nao se aplica"');
  ok(S.msSubProgresso([{ feita: true }, { feita: false }, { feita: false }]).pct === 33,
     'o percentual e feitas dividido por total');
  ok(S.msSubProgresso([{ feita: true }, { feita: true }]).pct === 100,
     'todas feitas fecha em 100%');

  // Lixo no campo nao pode derrubar o card: a base e um JSON que quatro telas
  // escrevem, e o card renderiza antes de qualquer validacao.
  ok(S.msSubsDe({ subtarefas: [null, { titulo: 'a' }, undefined] }).length === 1,
     'entrada suja na lista nao quebra a leitura');
  ok(S.msSubsDe({}).length === 0 && S.msSubsDe(null).length === 0,
     'demanda sem o campo devolve lista vazia');
  ok(S.msSubsDe({ subtarefas: [{ titulo: 'x'.repeat(400) }] })[0].titulo.length === 140,
     'titulo tem teto: subtarefa e passo, e nao descricao da demanda');

  // A gravacao: linha em branco e linha que alguem abriu e nao usou.
  const G = F([{ titulo: ' passo ', data: '', feita: true },
               { titulo: '   ', data: '2026-08-19', feita: false }]);
  const grav = G.msSubParaGravar();
  ok(grav.length === 1 && grav[0].titulo === 'passo',
     'subtarefa sem texto nao vai para a base');
  const M = F(Array.from({ length: 60 }, (_, i) => ({ titulo: 'p' + i, data: '', feita: false })));
  ok(M.msSubParaGravar().length === 30,
     'a lista tem teto de 30 — demanda que precisa de mais que isso sao duas demandas');
})();

/* O CAMPO SO SOBE SE FOI MEXIDO. Mandar sempre sobrescreveria o que outra tela
   gravou entre a leitura e o salvamento — o mesmo defeito que fez as marcacoes
   de projeto "sumirem", so que silencioso. */
ok((DEV.match(/campos\.subtarefas = msSubParaGravar\(\)/g) || []).length ===
   (DEV.match(/if \(_msSubsMexido\)/g) || []).length,
   'toda gravacao de subtarefa passa pela trava de "foi mexido"');

/* O PROGRESSO APARECE NO CARD DAS DUAS TELAS. Se ele so existisse dentro do
   modal, "quanto ja andou?" continuaria exigindo abrir demanda por demanda —
   que e exatamente o que o campo veio resolver. */
ok(/kcard-sub-barra/.test(DEV) && /msSubProgresso\(subs\)/.test(DEV),
   'o card do dev mostra o progresso sem precisar abrir a demanda');
ok(/kb-sub/.test(ADMIN) && /m\.subtarefas/.test(ADMIN),
   'o card do admin tambem — quem acompanha nao entra no painel do dev');

/* ─── O REQUISITO NA PAUTA DO PLANNING ───────────────────────────────────
   Convencao do time: o anexo AX-###.PNG e o requisito daquela demanda. Num
   Planning ele e o que se le ANTES de escolher a carta, e por isso aparece na
   propria pauta em vez de virar mais um botao de anexo.                       */
sec('Requisito no Planning Poker');

(function () {
  const fonte = corpo(POKER, 'function ehRequisito(');
  ok(!!fonte, 'a regra do nome do requisito existe em poker.html');
  if (!fonte) return;
  const eh = new Function(fonte + '\nreturn ehRequisito;')();
  const anexo = (nome, extra) => Object.assign({ nome, chave: 'a/x' }, extra || {});

  ok(eh(anexo('AX-218.PNG'), { codigo: 'AX-218' }) === true,
     'AX-218.PNG e o requisito da AX-218');
  ok(eh(anexo('ax-218.png'), { codigo: 'AX-218' }) === true,
     'caixa do nome nao separa: o anexo sobe como o Windows salvou');
  ok(eh(anexo('AX-218.jpg'), { codigo: 'AX-218' }) === true &&
     eh(anexo('AX-218.webp'), { codigo: 'AX-218' }) === true,
     'jpg e webp tambem — a convencao e o nome, e nao a extensao');

  /* AS RECUSAS SAO O QUE IMPORTA: mostrar o print errado em tamanho grande no
     meio da votacao e pior que nao mostrar nada, porque ninguem confere. */
  ok(eh(anexo('AX-219.PNG'), { codigo: 'AX-218' }) === false,
     'o requisito de OUTRA demanda nao entra na pauta desta');
  ok(eh(anexo('print da tela.png'), { codigo: 'AX-218' }) === false,
     'print anexado sem a convencao continua sendo anexo comum');
  ok(eh(anexo('AX-218.pdf'), { codigo: 'AX-218' }) === false,
     'pdf nao vira imagem na pauta — o quadro so sabe desenhar imagem');
  ok(eh(anexo('AX-218.PNG', { inline: true }), { codigo: 'AX-218' }) === false &&
     eh({ nome: 'AX-218.PNG' }, { codigo: 'AX-218' }) === false,
     'anexo antigo, sem chave, nao promete uma imagem que nao da para baixar');
})();

/* AMPLIAR NAO PODE TIRAR NINGUEM DA SALA. Abrir noutra aba faz a pessoa perder a
   mesa, o cronometro e a propria carta — o pedido foi explicitamente "ver na tela
   do planning para nao sair da sala". */
ok(/\.req-lupa \{ position:fixed/.test(POKER) &&
   !/window\.open/.test(corpo(POKER, 'function ampliaRequisito(') || 'window.open') &&
   !/window\.open/.test(corpo(POKER, 'async function carregaRequisito(') || 'window.open'),
   'o requisito amplia por cima da sala, e nao em outra aba');

/* A IMAGEM NAO PODE SOBREVIVER A TROCA DE PAUTA. Sem zerar, clicar em ampliar no
   segundo seguinte a troca mostra o requisito da demanda ANTERIOR — e o erro e
   silencioso, porque uma imagem aparece. */
ok(/_reqUrl = '';\s*\n\s*if \(iReq >= 0\) carregaRequisito/.test(POKER),
   'trocar a demanda em pauta zera a imagem corrente');

// O download acontece uma vez por anexo: a pauta se redesenha a cada mudanca de
// estado, e sem cache o Planning inteiro puxaria o mesmo arquivo em loop.
ok(/_reqCache\.has\(a\.chave\)/.test(POKER) && /_reqCache\.set\(a\.chave/.test(POKER),
   'o requisito e baixado uma vez, e nao a cada redesenho');

/* O ANEXO CHEGA A QUEM TEM CREDENCIAL, e nao a quem conduz. O requisito e escrito
   PARA O DEV, e o dev vota — enquanto isso dependia de ser facilitador, a unica
   pessoa que via o requisito era justamente a que nao ia implementar. */
ok(/const temCredencial = !!\(_token \|\| _senha\);/.test(POKER) &&
   /renderDetalhe\(m \? \(temCredencial \?/.test(POKER),
   'ver o requisito depende de ter credencial, e nao de ser facilitador');

/* ─── RANKING DE ENTREGAS DA SEMANA ──────────────────────────────────────
   Aparece na sala do Planning para uma conversa que so acontece com o time
   junto. Numa tela de cobranca, um numero errado nao e um bug de tela: e uma
   pergunta injusta feita a uma pessoa na frente dos colegas, e ela nao tem como
   contestar no momento. Por isso as invariantes daqui sao as do DADO.        */
sec('Ranking de entregas (Planning)');

(function () {
  const fonte = ['function diaLocalBR(', 'function segundaDaSemana(',
                 'function somaDias(', 'function pokerRanking(']
    .map(a => corpo(W, a));
  ok(fonte.every(Boolean), 'as funcoes do ranking existem no worker');
  if (!fonte.every(Boolean)) return;
  const R = new Function('const FUSO_BR_MS = 3 * 3600 * 1000;\n' + fonte.join('\n') +
    '\nreturn { diaLocalBR, segundaDaSemana, pokerRanking };')();

  /* FUSO. `entregue_em` e gravado com toISOString(), que e UTC. Uma entrega numa
     sexta as 21h vira sabado em UTC e cairia na SEMANA SEGUINTE — a pessoa seria
     cobrada por uma entrega que fez, no dia em que fez. */
  ok(R.diaLocalBR('2026-08-22T00:30:00Z') === '2026-08-21',
     'sexta as 21h30 continua sendo sexta, e nao sabado em UTC');
  ok(R.diaLocalBR('2026-08-17T02:00:00Z') === '2026-08-16',
     'domingo as 23h nao vira segunda da semana seguinte');
  ok(R.diaLocalBR('2026-08-19') === '2026-08-19',
     'data pura ja e local e passa intacta');
  ok(R.diaLocalBR('') === '' && R.diaLocalBR('nao e data') === '',
     'carimbo vazio ou torto nao vira uma data qualquer');

  // A semana e segunda a domingo, que e como o time fala dela.
  ok(R.segundaDaSemana('2026-08-19') === '2026-08-17' &&
     R.segundaDaSemana('2026-08-23') === '2026-08-17' &&
     R.segundaDaSemana('2026-08-24') === '2026-08-24',
     'a semana comeca na segunda e o domingo ainda e dela');

  const AGORA = new Date('2026-08-19T14:00:00Z');    // quarta
  const roda = (melhorias, feriados) =>
    R.pokerRanking({ melhorias, feriados: feriados || [] }, AGORA);
  const acha = (r, nome) => r.devs.find(d => d.nome === nome);

  /* A DATA DA ENTREGA E A DO DEV. Contar pela conclusao da esteira jogaria para
     a semana seguinte tudo que ficou parado em validacao, e o dev responderia
     por uma espera que nao e dele — a mesma regra que ja vale para o atraso. */
  let r = roda([
    { id: 1, dev: 'Ana', status_planejamento: 'validacao',
      entregue_em: '2026-08-18T12:00:00Z', concluido_em: '2026-08-25' },
  ]);
  ok(acha(r, 'Ana').atual.entregas === 1,
     'entregue nesta semana conta nesta semana, mesmo esperando validacao');

  r = roda([
    { id: 1, dev: 'Ana', status_planejamento: 'concluido', concluido_em: '2026-08-12' },
  ]);
  ok(acha(r, 'Ana').anterior.entregas === 1,
     'sem entregue_em, a conclusao serve de reserva');

  // Em andamento nao e entrega. Contar aqui inflaria a semana de quem so comecou.
  r = roda([{ id: 1, dev: 'Ana', status_planejamento: 'em_andamento',
              entregue_em: '2026-08-18T12:00:00Z' }]);
  ok(acha(r, 'Ana').atual.entregas === 0 && acha(r, 'Ana').emMaos === 1,
     'demanda em andamento aparece como "em maos", e nunca como entrega');

  // O campo aceita "Fulano / Beltrano" desde sempre, e as duas pessoas contam.
  r = roda([{ id: 1, dev: 'Ana / Bruno', status_planejamento: 'concluido',
              entregue_em: '2026-08-18', poker_pontos: 8 }]);
  ok(acha(r, 'Ana').atual.entregas === 1 && acha(r, 'Bruno').atual.entregas === 1,
     'demanda em dupla conta para os dois');

  // Oculta e mesclada nao existem para nenhum relatorio desta base.
  r = roda([
    { id: 1, dev: 'Ana', status_planejamento: 'concluido', entregue_em: '2026-08-18', oculto: true },
    { id: 2, dev: 'Ana', status_planejamento: 'concluido', entregue_em: '2026-08-18', mesclado_em: 'x' },
  ]);
  ok(!acha(r, 'Ana'), 'demanda oculta ou mesclada nao entra no ranking');

  /* OS PONTOS VAO JUNTO. Contar demandas sozinho pune quem pegou a grande: tres
     ajustes de meia hora somam 3 e uma entrega de 13 pontos soma 1. */
  r = roda([{ id: 1, dev: 'Ana', status_planejamento: 'concluido',
              entregue_em: '2026-08-18', poker_pontos: 13 }]);
  ok(acha(r, 'Ana').atual.pontos === 13,
     'os pontos da entrega somam junto da contagem');

  /* QUEM NAO ENTREGOU CONTINUA NA LISTA. Sao exatamente as pessoas de quem se
     quer perguntar — uma lista que so mostra quem entregou responde a pergunta
     contraria a que foi feita. */
  r = roda([
    { id: 1, dev: 'Ana',   status_planejamento: 'concluido', entregue_em: '2026-08-18' },
    { id: 2, dev: 'Bruno', status_planejamento: 'em_andamento' },
  ]);
  ok(acha(r, 'Bruno') && acha(r, 'Bruno').atual.entregas === 0,
     'quem esta com demanda na mao e nao entregou aparece com zero');
  ok(r.devs[r.devs.length - 1].nome === 'Bruno',
     'e aparece no fim da lista, que e onde a conversa comeca');

  /* CONTA PARADA NAO E AUSENCIA DA SEMANA. Sem o corte, ex-integrantes e contas
     desativadas enchem a lista de zeros permanentes e ela deixa de ser lida. */
  r = roda([{ id: 1, dev: 'Antigo', status_planejamento: 'concluido',
              entregue_em: '2026-01-10' }]);
  ok(!acha(r, 'Antigo'),
     'quem nao entrega ha oito semanas e nao tem demanda na mao sai da lista');

  /* A SEMANA CORRENTE E PARCIAL, E O NUMERO TEM DE DIZER ISSO. Numa quarta a
     semana atual teve 3 dias uteis e a anterior teve 5: sem o aviso, todo mundo
     aparece em queda toda segunda e terca. */
  r = roda([]);
  ok(r.semanas.atual.uteisCorridos === 3 && r.semanas.atual.uteisTotal === 5,
     'na quarta-feira a semana atual soma 3 dias uteis de 5');
  r = roda([], ['2026-08-18']);
  ok(r.semanas.atual.uteisCorridos === 2,
     'feriado no meio da semana nao conta como dia util corrido');
})();

// O ranking sai junto da fila, autorizado pelo CODIGO DA SALA: quem entrou pelo
// QR ve sem senha, e o que trafega e agregado — nome e contagem, nunca a demanda.
ok(/ranking: pokerRanking\(data, agora\),/.test(W),
   'o ranking sai na resposta de poker-fila, que ja le a base inteira');

/* A LISTA NA TELA NAO E CORTADA. Um top-N no painel esconderia justamente quem
   se quer perguntar — o oposto do que a tela existe para fazer. */
ok(!/_ranking\.devs[^;]{0,80}\.slice\(/.test(POKER),
   'o painel mostra todos os devs, sem top-N');

// O aviso da semana parcial e do painel, e nao deste comentario.
ok(/uteisCorridos \+ ' de ' \+/.test(POKER) && /ainda está correndo/.test(POKER),
   'o painel avisa por escrito que a semana atual esta pela metade');

/* ─── UM SIGNIFICADO POR COR ─────────────────────────────────────────────
   Relato literal de quem apresenta: "o amarelo me leva a entender que esta no
   prazo, porem la no grafico mostra ainda em aberto". O mesmo ambar era o
   percentual do prazo de um lado e "ainda em aberto" do outro, e o olho liga as
   duas coisas antes de a pessoa terminar de ler o slide.                      */
sec('Padrao de cores do deck');

ok(/var SIGNIFICADO = \{/.test(APRES),
   'o deck declara o que cada cor quer dizer, e nao so de que tom ela e');

/* O PERCENTUAL DO PRAZO E BRANCO. Verde/ambar/vermelho conforme o valor e a
   linguagem de uma META, e nao ha meta de prazo acordada aqui: pintado de ambar,
   "62%" ja chega a sala como nota baixa e a conversa comeca na defesa. */
(() => {
  const sl = corpo(APRES, 'function slidePrazo(');
  ok(!!sl, 'existe o slide do prazo');
  if (!sl) return;
  ok(!/var cor = z\.pct >= 80/.test(sl),
     'o percentual do prazo nao muda de cor conforme o valor');
  ok(/z\.pct \+ '%'[\s\S]{0,220}SIGNIFICADO\.leitura/.test(sl),
     'ele sai em branco, que e a cor de numero sem meta');
  /* AMBAR NAO APARECE NESTE SLIDE. Era a cor do percentual E de "ainda em
     aberto"; agora "em aberto" e azul, que e a cor do previsto no resto do deck
     — e "em aberto" e exatamente isso, ainda sem veredito. */
  ok(!/C\.ambar/.test(sl), 'o ambar nao aparece no slide do prazo');
  ok(/'Ainda em aberto', val: z\.emAberto \|\| 0, cor: SIGNIFICADO\.previsto/.test(sl),
     '"ainda em aberto" usa a cor do previsto, e nao a do alerta');
})();

/* SUSTENTACAO E UMA NATUREZA DE TRABALHO, E NAO UMA NOTA. Em ambar ela chegava
   como "atencao" ao lado de evolucao em verde, e manter o que existe e trabalho
   normal — nao e um problema a ser resolvido. */
ok(!/b\.tipo === 'Sustentação' \? C\.ambar/.test(APRES),
   'sustentacao nao e pintada com a cor de alerta');
ok(/SIGNIFICADO\.categoria2/.test(APRES),
   'ela usa o neutro secundario: nem "bom" nem "atencao", so outra categoria');

/* "ago…" LIA-SE COMO TEXTO CORTADO. As reticencias marcavam mes em curso, mas
   ninguem ve isso — ve um rotulo que nao coube, e passa a desconfiar do slide. */
(() => {
  const sl = corpo(APRES, 'function slideEvolucao(');
  ok(!!sl, 'existe o slide de evolucao');
  if (!sl) return;
  ok(!/x\.rot \+ \(x\.parcial \? '…' : ''\)/.test(sl),
     'o mes em curso nao e marcado com reticencia atras do nome');
  ok(/'mês em curso'/.test(sl),
     'ele e dito por escrito, que e o que a reticencia nunca disse');
  ok(!/x\.pct >= 80 \? C\.verde/.test(sl),
     'o percentual mes a mes tambem nao muda de cor conforme o valor');
})();

/* ─── A REFERENCIA DA CARTA E O PRAZO, E NAO A HORA ──────────────────────

   A hora de desenvolvimento saiu desta referencia. Decisao do Fernando, depois
   de o time apontar ("horas desreguladas", Joao Vitor), e com os numeros na mao:

     - a carta 34 mostrava 5 h a partir de DOIS registros, 2 h (Murillo) e 8 h
       (Maury) — a mediana de uma discordancia, e nao do trabalho;
     - a mediana por PESSOA divergia seis vezes: 2 h para tres devs, 8-12 h para
       outros tres. O mesmo campo respondia a duas perguntas diferentes;
     - a dispersao dentro de uma carta ficou maior que a diferenca entre cartas —
       a faixa da carta 8 (1-6 h) cabia inteira dentro da carta 5 (1-18 h);
     - 62% de preenchimento, voluntario e autosselecionado.

   O prazo em dias nao tem esse defeito por um motivo so: NINGUEM O DIGITA. Sai
   de `inicio` -> `entrega`, com base cheia, e sai monotonico.

   Para a hora voltar a referencia, precisa antes de uma definicao escrita no
   proprio campo e de uma base refeita sob ela. Estas invariantes existem para
   que ela nao volte por engano — o buraco na tabela parece coluna esquecida.  */
sec('Referencia da carta (Planning)');

ok(!/refHoras/.test(POKER),
   'a tela nao formata mais hora na referencia');
ok(!/Horas típicas/.test(POKER),
   'a coluna de horas tipicas nao existe mais na tabela');
ok(/<th>Prazo típico<\/th>/.test(POKER),
   'o prazo em dias e a coluna principal');

/* O CORTE DE "POUCOS CASOS" MUDOU DE BASE. Ele contava `nHoras`, que era a
   contagem de quem preencheu hora; agora conta `n`, as entregas com data — que e
   a base do numero que a tela realmente mostra. Contar uma coisa e mostrar outra
   fazia a carta parecer mais firme (ou mais fraca) do que e. */
(() => {
  const rf = corpo(POKER, 'function refFirme(');
  ok(!!rf, 'existe o corte de poucos casos');
  if (!rf) return;
  ok(/l\.n \|\| 0/.test(rf) && !/nHoras/.test(rf),
     'o corte conta as entregas com data, e nao quem preencheu hora');
  const f = new Function(rf + '; return refFirme;')();
  ok(f({ n: 7 }) === true && f({ n: 6 }) === false && f({}) === false,
     'sete entregas e o corte, e carta sem base nenhuma nao passa por firme');
})();

/* O DESAPARECIMENTO E EXPLICADO NA PROPRIA TELA. O time viu a coluna de horas e
   foi ele que apontou o defeito: sumir sem uma palavra faz a pessoa procurar o
   que quebrou, ou pedir a coluna de volta. */
ok(/As horas saíram desta referência/.test(POKER),
   'a nota da tabela diz que a hora saiu, e por que');

// "1 dia uteis": `refDias` ja traz a palavra no singular, e grudar " uteis"
// depois quebrava a concordancia na carta com MAIS base (a 3, com 39 entregas).
(() => {
  const rc = corpo(POKER, 'function refDaCarta(');
  ok(!!rc && /l\.dias === 1 \? '1 dia útil'/.test(rc),
     'o texto de uma carta so concorda no singular e no plural');
})();

/* A HORA CONTINUA SENDO COLETADA. Ela saiu da referencia de votacao, e nao da
   base: e a unica medida de custo que existe, e o relatorio do comite depende
   dela. Tirar o campo junto seria trocar um numero ruim por nenhum. */
ok(/id="ms-horas"/.test(DEV) && /Horas de desenvolvimento/.test(DEV),
   'o campo de horas continua sendo pedido na entrega');
ok(/horas_realizadas/.test(ADMIN),
   'e o relatorio continua usando a hora para custo');

/* ─── CINCO CORES, UM SIGNIFICADO CADA ───────────────────────────────────
   Regra do Fernando, depois de olhar o deck e nao achar padrao nenhum:

     VERDE     esta bom      VERMELHO  esta ruim
     AMBAR     atencao       AZUL      neutro
     BRANCO    neutro (numero de leitura, sem meta)

   Prata entra como neutro SECUNDARIO, para duas categorias se distinguirem sem
   que nenhuma seja melhor que a outra.                                        */
sec('O padrao de cores do deck');

/* O ROXO SAIU INTEIRO. Ele fazia papel de "outra categoria" em quatro slides sem
   significar a mesma coisa em nenhum: sustentacao num, ausencia noutro, a terceira
   area no terceiro, o KPI de frentes no quarto. Cor sem significado fixo e pior
   que cor nenhuma, porque quem le procura o sentido e acha um errado. */
ok(!/C\.roxo/.test(APRES), 'o roxo nao existe mais no deck');

/* NENHUMA COR ESCRITA A MAO. Todo tom sai de `C` ou de `SIGNIFICADO`: hexadecimal
   solto no meio do slide e o jeito de a paleta voltar a divergir sem ninguem ver. */
ok(!/color: ['"][0-9A-Fa-f]{6}['"]/.test(APRES),
   'nenhum hexadecimal escrito a mao no deck');

/* `line: { width: 0 }` NAO APAGA O CONTORNO. O PptxGenJS emite a cor PADRAO dele
   (#333333) quando a linha nao tem cor — uma cor que nao esta na paleta e que
   ninguem escolheu, achada auditando o XML gerado. `type: 'none'` apaga. */
ok(!/line: \{ width: 0 \}/.test(APRES),
   'contorno se apaga com type:none, e nao com width:0 (que deixa o #333333 padrao)');

/* VERDE MARCA O RESULTADO DESEJADO, e nao "numero alto". Um ranking de pessoas em
   verde diz que todo mundo esta bom, o que nao informa nada — e comparacao de
   magnitude pede cor neutra, com o nome ao lado da barra fazendo a identidade. */
ok(/itens: d\.porDev, cor: SIGNIFICADO\.neutro/.test(APRES),
   'o ranking por desenvolvedor usa cor neutra, e nao a de "bom"');

/* NENHUMA COR COM JUIZO NUM NUMERO SEM META. Era a violacao mais repetida: o
   percentual do prazo e o da execucao mudavam de verde para ambar para vermelho
   conforme o valor, como se 100% fosse alvo acordado. Nao e — uma frente que
   planejou 40h e realizou 60h nao "falhou", ela recebeu trabalho fora do plano. */
(() => {
  const cp = corpo(APRES, 'function corPercentual(');
  ok(!!cp, 'existe a cor do percentual, num lugar so');
  if (!cp) return;
  ok(!/C\.verde|C\.ambar|C\.vermelho/.test(cp),
     'a execucao nao muda de cor conforme o valor — ela nao tem meta');
  const f = new Function('C', 'SIGNIFICADO', cp + '; return corPercentual;')(
    { fraco: 'FRACO' }, { leitura: 'BRANCO' });
  ok(f(null) === 'FRACO' && f(11) === 'BRANCO' && f(100) === 'BRANCO' && f(300) === 'BRANCO',
     'qualquer percentual sai neutro, e so "sem dado" sai apagado');
})();

/* OURO, PRATA E BRONZE FICAM SO NO PODIO. Ali eles nao sao juizo: sao primeiro,
   segundo e terceiro, convencao que se le sem legenda. Fora do podio, seriam uma
   sexta e setima cores sem significado declarado. */
ok((APRES.match(/C\.ouro/g) || []).length === 1 &&
   /MEDALHA = \[C\.ouro, C\.prata, C\.bronze\]/.test(APRES),
   'o ouro aparece uma vez so, e e no podio do ranking');

/* ─── OS CORTES DE PONTOS NO DECK ────────────────────────────────────────
   Os mesmos quatro recortes do painel gerencial, que faltavam no deck.       */
sec('Pontos entregues no deck');

/* A CONTA E UMA SO, e o painel e o deck chamam a mesma funcao. Duas copias da
   mesma soma e o defeito que mais aparece nesta base: foi assim que a "eficiencia"
   deu 100% todo mes (duas contas com o mesmo nome, janelas diferentes) e que o
   atraso viveu em quatro versoes divergentes. */
ok(/function gerCortesDePontos\(/.test(ADMIN),
   'os cortes de pontos vivem numa funcao propria');
ok((ADMIN.match(/gerCortesDePontos\(/g) || []).length >= 3,
   'e ela e chamada pelo painel E pelo deck, em vez de a soma ser repetida');

(() => {
  const c = corpo(ADMIN, 'function gerCortesDePontos(');
  ok(!!c, 'existe o corpo da funcao');
  if (!c) return;
  /* DEMANDA DE DUPLA DIVIDE O PONTO. Contar inteiro para cada um faz a soma por
     dev estourar o total do mes — e a primeira coisa que se faz num slide de
     diretoria e somar as fatias. */
  ok(/Number\(m\.poker_pontos\) \/ devs\.length/.test(c),
     'demanda de dupla divide o ponto entre os dois');
  /* "FORA DO MES" E "SEM SPRINT" ENTRAM como categoria propria: sem elas a soma
     das fatias nao fecha com o total. */
  ok(/'Fora do mês'/.test(c) && /'Sem sprint'/.test(c),
     'as sobras entram nomeadas, em vez de sumirem da conta');
})();

/* BARRA HORIZONTAL, E NAO A ROSCA DO PAINEL. Unica coisa que muda de forma, e a
   razao e a distancia: projetada, uma rosca de seis fatias com rotulo "AXCred -
   Cadastro - Analise de Credito - Reanalise" nao se le do fundo da sala. */
(() => {
  const p = corpo(APRES, 'function painelPontos(');
  ok(!!p, 'existe o painel de pontos do deck');
  if (!p) return;
  /* UMA COR SO nas barras: numa barra a identidade vem do ROTULO, e pintar seis
     barras de seis cores inventa um significado que nao existe. */
  ok(!/C\.verde|C\.vermelho|C\.ambar/.test(p),
     'as barras de pontos usam so a cor neutra — a identidade vem do rotulo');
  ok(/SIGNIFICADO\.neutro/.test(p), 'e essa cor e a neutra do padrao');
  /* O PAINEL E RODADO DE VERDADE, e o que ele desenha e medido.
     A versao anterior lia as constantes do codigo por regex, e parou de valer no
     dia em que a largura do trilho passou a ser CALCULADA — a invariante deu NaN
     em vez de falhar por um motivo. Rodar a funcao com um dublê de slide mede o
     que importa: nada que ela desenha sai do painel.

     Os dois tamanhos entram: o estreito (4,25", dois por slide) e o de largura
     inteira (8,76", um por slide). Sao os dois que existem, e a conta e a mesma. */
  const fonte = corpo(APRES, 'function corta(') + ';' + corpo(APRES, 'function painelPontos(');
  ok(!!corpo(APRES, 'function painelPontos('), 'existe o painel de pontos');
  if (corpo(APRES, 'function painelPontos(')) {
    const painel = new Function('C', 'SIGNIFICADO', fonte + '; return painelPontos;')(
      { texto: 'T', fraco: 'F', fundo3: 'B' }, { neutro: 'N' });

    [{ w: 4.25, nome: undefined }, { w: 8.76, nome: 3.9 }].forEach((caso) => {
      const desenhado = [];
      const slideFalso = {
        addText: (t, o) => desenhado.push({ tipo: 'texto', t: String(t), ...o }),
        addShape: (_, o) => desenhado.push({ tipo: 'forma', ...o }),
      };
      painel(slideFalso, { ShapeType: { rect: 'rect' } }, {
        x: 0.62, y: 1.55, w: caso.w, titulo: 'Teste', total: 100,
        ...(caso.nome ? { larguraNome: caso.nome } : {}),
        itens: [{ nome: 'AXCred - Cadastro - Analise de Credito - Reanalise', valor: 60 },
                { nome: 'Curto', valor: 40 }],
      });
      const limite = 0.62 + caso.w + 0.001;
      const vazam = desenhado.filter((d) => d.x + d.w > limite);
      ok(!vazam.length,
         'no painel de ' + caso.w + '" nada vaza para fora dele',
         vazam.length ? vazam.map((v) => (v.t || v.tipo) + ' ate ' + (v.x + v.w).toFixed(2)).join('; ')
                      : desenhado.length + ' elementos');
      // E o trilho tem largura POSITIVA: com o nome largo demais ele viraria
      // negativo, e uma barra de largura negativa nao aparece no slide.
      const trilhos = desenhado.filter((d) => d.tipo === 'forma' && d.fill && d.fill.color === 'B');
      ok(trilhos.length === 2 && trilhos.every((t) => t.w > 0.2),
         'o trilho da barra sobra com largura util');
    });

    /* A LINHA ENCOLHE PARA CABER, e o painel AVISA quando nem encolhendo cabe.
       A altura era fixa em 0,335", e por isso o painel comportava seis linhas — foi
       essa limitacao que forcou a cauda a virar "Outros (9)" com 810 pontos e nove
       pessoas sem nome. Agora treze assuntos numa coluna cabem com a linha
       apertada, e quando nem isso basta a funcao devolve `false` para quem chamou
       dividir em colunas, em vez de escrever por cima do rodape. */
    const rodar = (n) => {
      const d = [];
      const r = painel({ addText: (t, o) => d.push({ t: String(t), ...o }),
                         addShape: (_, o) => d.push({ forma: 1, ...o }) },
                       { ShapeType: { rect: 'rect' } },
                       { x: 0.62, y: 1.55, w: 8.76, titulo: 'T', total: 100,
                         itens: Array.from({ length: n }, (_, i) => ({ nome: 'i' + i, valor: n - i })) });
      const fundo = d.reduce((mx, x) => Math.max(mx, x.y + (x.h || 0)), 0);
      return { cabeu: r, fundo: fundo, linhas: d.filter((x) => /^i\d+$/.test(x.t || '')).length };
    };
    [6, 10, 13].forEach((n) => {
      const r = rodar(n);
      ok(r.cabeu === true && r.linhas === n && r.fundo <= 4.96,
         n + ' linhas cabem numa coluna sem passar de 4,95"',
         'cabeu=' + r.cabeu + ' linhas=' + r.linhas + ' fundo=' + r.fundo.toFixed(2));
    });
    // E 30 numa coluna nao cabem: o painel diz isso em vez de desenhar por cima.
    ok(rodar(30).cabeu === false,
       'e trinta numa coluna nao cabem — o painel devolve false em vez de invadir o rodape',
       'cabeu=' + rodar(30).cabeu);
    // Seis linhas nao ficam apertadas por causa das treze: a altura e um teto, nao fixa.
    ok(Math.abs(rodar(6).fundo - (2.07 + 6 * 0.335)) < 0.02,
       'com seis linhas a altura fica cheia (0,335"), e nao encolhida a esmo',
       rodar(6).fundo.toFixed(3));

    // O NOME ACOMPANHA A LARGURA. Fixo em 22 caracteres, o painel largo cortava um
    // nome que caberia quase inteiro nele.
    const nomes = (w, larg) => {
      const d = [];
      painel({ addText: (t, o) => d.push({ t: String(t), ...o }), addShape: () => {} },
             { ShapeType: { rect: 'rect' } },
             { x: 0.62, y: 1.55, w: w, titulo: 'T', total: 100,
               ...(larg ? { larguraNome: larg } : {}),
               itens: [{ nome: 'AXCred - Cadastro - Analise de Credito - Reanalise', valor: 100 }] });
      return d.map((x) => x.t).find((t) => t.indexOf('AXCred') === 0) || '';
    };
    const estreito = nomes(4.25);
    const largo = nomes(8.76, 3.9);
    ok(largo.length > estreito.length,
       'o painel largo mostra mais do nome do assunto que o estreito',
       estreito.length + ' -> ' + largo.length + ' caracteres');
  }
})();

/* A GRADE DE TOPICOS CASA COM O QUE O GERADOR PRODUZ.
   A lista havia descolado em tres direcoes: prometia "sprint" num painel que saiu
   do deck, escondia que "No prazo x com atraso" gera dois slides, e omitia capa,
   destaques e mensagem final — que saem sempre. Quinze caixas para vinte e um
   slides, e quem conferia procurava o erro na grade. */
sec('A grade de topicos do deck');
(() => {
  const bloco = ADMIN.slice(ADMIN.indexOf('const AP_SECOES = ['));
  const fim = bloco.indexOf('];');
  ok(fim > 0, 'existe a grade de topicos');
  if (fim < 0) return;
  let SEC;
  try { SEC = eval('(' + bloco.slice(bloco.indexOf('['), fim + 1) + ')'); }
  catch (e) { ok(false, 'a grade avalia', e.message); return; }

  /* TODA CHAVE DA GRADE E CONSULTADA PELO GERADOR, e vice-versa. Uma caixa sem
     `d.secoes.<k>` no apresentacao.js e uma caixa que nao faz nada; um
     `d.secoes.<k>` sem caixa e um slide que ninguem consegue tirar. */
    const doGerador = new Set();
  const re = /d\.secoes\.([a-zA-Z]+)/g;
  let m;
  while ((m = re.exec(APRES)) !== null) doGerador.add(m[1]);
  const daGrade = new Set(SEC.map(x => x.k));
  const soNaGrade = [...daGrade].filter(k => !doGerador.has(k));
  const soNoGerador = [...doGerador].filter(k => !daGrade.has(k));
  ok(!soNaGrade.length, 'nenhuma caixa da grade e ignorada pelo gerador', soNaGrade.join(', '));
  ok(!soNoGerador.length, 'e nenhum slide do gerador fica sem caixa', soNoGerador.join(', '));

  /* O ROTULO NAO PROMETE O QUE NAO EXISTE. O painel de sprint saiu do deck, e o
     rotulo seguiu dizendo "(semana, dev, assunto, sprint)". */
  const pontos = SEC.find(x => x.k === 'pontos');
  ok(!!pontos && !/sprint/i.test(pontos.rot),
     'o topico de pontos nao promete o painel de sprint, que saiu do deck',
     pontos ? pontos.rot : '');
  ok(!SEC.some(x => /sprint/i.test(x.rot)), 'e nenhum outro topico promete sprint');

  /* A CONTAGEM DE SLIDES E DECLARADA, e bate com o gerador. `pontos` chama tres
     funcoes de slide; `prazo` desenha o painel e mais a tabela das atrasadas. */
  ok(SEC.every(x => Number.isInteger(x.n) && x.n >= 1),
     'toda caixa declara quantos slides produz');
  const corpoGer = corpo(APRES, 'async function montaDeck(') ||
                   corpo(APRES, 'function montaDeck(') || APRES;
  const trecho = (k) => {
    const i = corpoGer.indexOf('d.secoes.' + k);
    return i < 0 ? '' : corpoGer.slice(i, i + 420);
  };
  const chamadas = (t) => (t.match(/slide[A-Z]\w*\(pptx/g) || []).length +
                          (t.match(/slideTitulo\(pptx/g) || []).length;
  ok(pontos.n === 3 && chamadas(trecho('pontos')) === 3,
     'pontos declara 3 slides e o gerador chama 3',
     pontos.n + ' vs ' + chamadas(trecho('pontos')));
  const prazo = SEC.find(x => x.k === 'prazo');
  ok(prazo && prazo.n === 2, 'prazo declara 2 — o painel e a tabela das atrasadas',
     prazo ? String(prazo.n) : '');
  ok(!!prazo.nota && /atrasada/i.test(prazo.nota),
     'e diz que o segundo so sai se houver atraso', prazo.nota || '');

  /* O QUE ENTRA SEM CAIXA esta escrito. Capa, destaques e mensagem final saem no
     arquivo e nao tem caixa — e nao ter caixa e correto, porque nao sao opcionais. */
  ok(/const AP_SEMPRE = /.test(ADMIN), 'existe a nota do que entra sempre');
  const nota = (ADMIN.match(/const AP_SEMPRE = ([\s\S]*?);\n/) || [])[1] || '';
  ok(/capa/i.test(nota) && /destaque/i.test(nota) && /mensagem/i.test(nota),
     'e ela nomeia capa, destaques e mensagem final');
  ok(/AP_SEMPRE/.test(corpo(ADMIN, 'function apresAbrir(') || ''),
     'e a tela mostra essa nota, em vez de ela viver so no codigo');

  // A contagem aparece ao lado do rotulo quando vale mais de um slide.
  const abrir = corpo(ADMIN, 'function apresAbrir(');
  ok(/s\.n \|\| 1\) > 1/.test(abrir) && /slides</.test(abrir),
     'a tela diz quantos slides a caixa produz quando e mais de um');
})();

/* "PONTOS ENTREGUES" CONTA SO O QUE FOI ENTREGUE.
   A data era `concluido_em || entrega || inicio`, e as duas reservas eram o
   defeito: sem conclusao a demanda entrava pelo PRAZO. Em agosto o slide exibia
   2502 pontos, dos quais 1295 (52%) de 46 demandas em Planejado, Em andamento e
   backlog. Mais da metade de um slide chamado "entregues" nao era entrega. */
(() => {
  const c = corpo(ADMIN, 'function gerDataRefPontos(');
  ok(!!c, 'existe a data de referencia dos pontos');
  if (!c) return;
  ok(/CAPACIDADE\.diaDaEntrega/.test(c),
     'e ela e a mesma ancora do Gantt, do Painel Dev e dos Relatorios');
  ok(!/m\.entrega/.test(c) && !/m\.inicio/.test(c),
     'o prazo e o inicio nao servem mais de reserva — nenhum dos dois e entrega');

  const it = corpo(ADMIN, 'function gerItensPontuados(');
  ok(!!it && /\['validacao', 'concluido'\]\.includes/.test(it),
     'e o corte do mes exige que a demanda tenha saido, nao so que tenha data');
  ok(/m\.oculto \|\| m\.mesclado_em/.test(it),
     'demanda aposentada ou mesclada fica fora do corte');

  /* E A OUTRA PERGUNTA GANHOU A PROPRIA FUNCAO. "Pontuada e nunca agendada" precisa
     de prazo/inicio; com a ancora de entrega ela listaria toda demanda em curso. */
  const sd = corpo(ADMIN, 'function gerPontuadasSemData(');
  ok(!!corpo(ADMIN, 'function gerTemDataDePlano('), 'existe a pergunta de data de PLANO');
  ok(!!sd && /gerTemDataDePlano/.test(sd),
     'e "pontuada sem data" usa ela, e nao a de entrega');
  const plano = corpo(ADMIN, 'function gerTemDataDePlano(');
  ok(/entrega/.test(plano) && /inicio/.test(plano),
     'data de plano e prazo ou inicio', '');
})();

/* NENHUM PONTO CAI NUM BALDE CHAMADO "OUTROS".
   Havia `topoComOutros`, que cortava em cinco e dobrava a cauda. No corte por
   desenvolvedor de agosto isso produziu "Outros (9)" com 810 pontos: 32% do mes, a
   MAIOR barra do slide, e nove pessoas sem nome dentro dela. Num slide de diretoria
   esse balde nao resume — ele gera a pergunta "quem sao os nove?", que e exatamente
   a pergunta que o slide existia para responder. */
(() => {
  ok(!corpo(APRES, 'function topoComOutros('),
     'o dobrador da cauda nao existe mais');
  ok(!/'Outros \(' \+/.test(APRES) && !/nome: 'Outros/.test(APRES),
     'e nenhum item sintetico "Outros (N)" e construido no deck');

  const t = corpo(APRES, 'function itensDoCorte(');
  ok(!!t, 'existe o conversor do corte em lista');
  if (!t) return;
  const f = new Function(t + '; return itensDoCorte;')();
  /* OS VALORES NAO ESTAO EM ORDEM DECRESCENTE, de proposito: com dados ja
     ordenados, um `sort` indevido dentro da funcao seria um no-op e a invariante
     passaria. Sao as semanas de agosto de verdade, cuja curva sobe e desce. */
  const sete = { S1: 442, S2: 511, S3: 844, S4: 558, S5: 113, S6: 21,
                 'Fora do mês': 34 };
  const r = f(sete);
  ok(r.length === 7, 'sete categorias viram sete linhas, e nao cinco mais um balde',
     r.length + ' linhas');
  ok(r.every(x => x.nome !== 'Outros' && x.nome.indexOf('Outros (') !== 0),
     'e nenhuma delas se chama "Outros"');
  ok(f({ a: 1, b: 0 }).length === 1, 'categoria zerada nao vira barra invisivel');
  ok(r.reduce((x, y) => x + y.valor, 0) === Object.values(sete).reduce((x, y) => x + y, 0),
     'a soma das barras fecha com o total');
  /* A ORDEM NAO E REORDENADA AQUI. Por semana ela e CRONOLOGICA, e ordenar por valor
     destruiria a leitura de ritmo: S3, com 844 pontos, iria para o topo e a sala
     perderia a curva do mes. O corte por dev e por assunto ja chega ordenado de
     `gerCortesDePontos`, entao reordenar aqui nao ajuda ninguem e quebra a semana. */
  ok(r.map(x => x.nome).join('|') === 'S1|S2|S3|S4|S5|S6|Fora do mês',
     'e a ordem de quem montou o corte e preservada — a semana fica cronologica',
     r.map(x => x.nome).join('|'));

  // O DIVISOR EM COLUNAS: a primeira leva o excedente, para a segunda nunca ficar
  // mais longa que a primeira (duas colunas desiguais leem como lista cortada).
  const ec = corpo(APRES, 'function emColunas(');
  ok(!!ec, 'existe o divisor em colunas');
  if (ec) {
    const g = new Function(ec + '; return emColunas;')();
    const q = (n, c) => g(Array.from({ length: n }, (_, i) => ({ nome: 's' + i, valor: 1 })), c)
      .map(x => x.length);
    ok(JSON.stringify(q(14, 2)) === '[7,7]', '14 em 2 colunas da 7 e 7', JSON.stringify(q(14, 2)));
    ok(JSON.stringify(q(15, 2)) === '[8,7]', '15 em 2 colunas da 8 e 7', JSON.stringify(q(15, 2)));
    ok(JSON.stringify(q(25, 2)) === '[13,12]', '25 em 2 colunas da 13 e 12', JSON.stringify(q(25, 2)));
    ok(JSON.stringify(q(3, 2)) === '[2,1]', '3 em 2 colunas da 2 e 1', JSON.stringify(q(3, 2)));
    // Coluna vazia nao vira painel: com 2 itens em 3 colunas a terceira sobraria.
    ok(q(2, 3).length === 2 && q(2, 3).every(x => x > 0),
       'coluna vazia e descartada em vez de virar painel em branco', JSON.stringify(q(2, 3)));
    ok(g([], 2).length === 0, 'lista vazia nao produz coluna');
  }
})();

/* ─── NADA ACIMA DE 100% ─────────────────────────────────────────────────
   "127%" numa linha chamada EXEC nao se le como informacao, se le como erro: a
   primeira reacao de quem ve e "a conta esta errada", e a segunda e "como alguem
   faz 127% de um plano?". As duas gastam a reuniao com o instrumento em vez do
   trabalho. E travar em 100% seria mentir por arredondamento — a hora existiu. */
sec('Execucao acima do plano');

(() => {
  const c = corpo(APRES, 'function rotuloExecucao(');
  ok(!!c, 'existe uma regra unica para o rotulo de execucao');
  if (!c) return;
  const f = new Function(c + '; return rotuloExecucao;')();
  ok(f(null, 0, 0) === '—', 'sem dado sai travessao, e nao 0%');
  ok(f(0, 10, 0) === '0%' && f(62, 100, 62) === '62%' && f(100, 71, 71) === '100%',
     'ate 100 o percentual continua — ali ele responde "quanto do plano andou"');
  ok(f(127, 71, 90) === '+19h',
     'acima de 100 sai a diferenca em HORA, que e a informacao de verdade');
  ok(f(300, 10, 30) === '+20h', 'e vale para qualquer excesso');
  ok(f(127, null, null) === 'acima do plano',
     'sem as horas em mao, diz que passou do plano sem inventar numero');
  ok(f(127, 90, 71) === 'acima do plano',
     'e dado incoerente tambem nao vira numero');
  // Nenhum percentual maior que 100 sobra no rotulo, para qualquer entrada.
  const ruins = [];
  for (let p = 0; p <= 400; p += 7) {
    const r = f(p, 100, p);
    const n = Number(String(r).replace('%', ''));
    if (String(r).endsWith('%') && n > 100) ruins.push(p);
  }
  ok(!ruins.length, 'nenhum valor de 0 a 400 produz um percentual acima de 100',
     ruins.length ? ruins.join(',') : '58 valores testados');
})();

/* TODO ROTULO DE EXECUCAO PASSA PELA REGRA. Sao quatro pontos: o cartao do
   projeto, o anel do slide de frentes, o cartao de cada frente e a nota do total.

   O PERCENTUAL DA EVOLUCAO NAO ENTRA AQUI, e nao e esquecimento: ele e "% no
   prazo" — `noPrazo / (noPrazo + atraso)` —, uma razao que nao passa de 100 por
   construcao. Passar ele por `rotuloExecucao` seria proteger contra um caso que
   a aritmetica ja impede, e ainda faria o slide falar de hora onde nao ha hora. */
ok((APRES.match(/rotuloExecucao\(/g) || []).length >= 5,
   'os quatro rotulos de execucao do deck passam pela regra',
   (APRES.match(/rotuloExecucao\(/g) || []).length + ' usos, com a definicao');
ok(/'% no prazo'|% no prazo/.test(APRES) || /x\.pct/.test(APRES),
   'e o percentual da evolucao segue direto: e razao no prazo, limitada a 100');

/* ─── DOIS MESES NA EVOLUCAO ─────────────────────────────────────────────
   Eram seis, e os quatro primeiros saiam zerados porque a ferramenta comecou a
   ser usada em junho: quatro pares de barras em zero num slide de diretoria nao
   dizem "nao havia dado", dizem "nao entregamos nada". */
ok(/for \(let k = 1; k >= 0; k--\) \{/.test(ADMIN),
   'a evolucao compara o mes atual com o anterior, e mais nenhum');

/* ─── O CORTE POR DEV NAO PODE DIVIDIR POR ZERO ──────────────────────────
   `devsDaDemanda` recebe a DEMANDA e le `m.dev` dentro; `splitDevs` recebe a
   STRING. Passei a primeira onde ia a segunda: a lista vinha vazia,
   `devs.length` dava zero, e a divisao apagava o corte inteiro EM SILENCIO — o
   slide saiu "sem dados no mes" com 1544 pontos ao lado. */
(() => {
  const c = corpo(ADMIN, 'function gerCortesDePontos(');
  ok(!!c, 'existe o corpo dos cortes de pontos');
  if (!c) return;
  ok(/if \(!devs\.length\)/.test(c),
     'demanda sem dono vai para um balde nomeado, e nao para uma divisao por zero');
  ok(/porDev\['Sem responsável'\]/.test(c),
     'e o balde tem nome — corte vazio passa a significar "nao ha dono mesmo"');
})();
// A chamada do deck adapta a assinatura, em vez de passar a funcao errada.
ok(/\(txt\) => window\.PIPELINES\.devsDaDemanda\(\{ dev: txt \}\)/.test(ADMIN),
   'o deck adapta devsDaDemanda para a assinatura de splitDevs');

/* ─── CAPACIDADE EM PONTOS: planejado x entregue ─────────────────────────
   A pergunta que a ferramenta nao respondia: "quanto eu joguei para essa pessoa e
   quanto ela fez". Havia hora planejada x realizada e contagem de demandas
   prometidas x entregues, e nenhuma das duas mede TAMANHO — um dev fecha 50
   pontos por semana, outro fecha 100.                                          */
sec('Capacidade em pontos (planejado x entregue)');

let erroCap = null;
try { new Function(CAPJS); } catch (e) { erroCap = e.message; }
ok(!erroCap, 'capacidade.js sem erro de sintaxe', erroCap || '');

const CAP = require('./capacidade.js');
const dm = (x) => Object.assign({ status_planejamento: 'planejado', dev: 'Ana' }, x);

/* O PLANEJADO E CONGELADO NA ALOCACAO, e nao lido no fechamento.
   A REPONTUACAO ACONTECE: na base, AX-088 foi de 34 para 55, AX-180 de 55 para 34
   e AX-200 de 2 para 8, todas pelo painel. Ler `poker_pontos` no fim do mes faria
   a repontuacao REESCREVER O PASSADO — voce prometeu 34, corrigiu para 55 depois
   de ver o tamanho real, e o relatorio diria que voce prometeu 55 desde o inicio.
   O cruzamento pararia de medir compromisso e passaria a medir a ultima edicao. */
ok(CAP.planejados(dm({ pontos_planejados: 34, poker_pontos: 55 })) === 34,
   'o planejado usa o carimbo, e nao o tamanho corrente repontuado');
ok(CAP.entregues(dm({ status_planejamento: 'concluido', pontos_planejados: 34, poker_pontos: 55 })) === 55,
   'e o ENTREGUE usa o tamanho corrente: a demanda era maior, e o trabalho foi maior');
// Sem carimbo (base antiga), o tamanho corrente e a melhor informacao que existe —
// e o servidor carimba na proxima gravacao, entao a lacuna se fecha sozinha.
ok(CAP.planejados(dm({ poker_pontos: 8 })) === 8,
   'sem carimbo, o tamanho corrente serve de reserva');

/* PONTUACAO RETROATIVA NAO E PLANEJAMENTO. 77 das 165 pontuadas receberam pontos
   DEPOIS de concluidas: conta-las faria o planejado do mes passado aparecer
   perfeito por construcao — o mesmo defeito que a conclusao retroativa causava. */
ok(CAP.planejados(dm({ status_planejamento: 'concluido', poker_pontos: 13,
                       poker_retroativo: true })) === 0,
   'pontuada so depois de concluir nao entra como planejado');
ok(CAP.entregues(dm({ status_planejamento: 'concluido', poker_pontos: 13,
                      poker_retroativo: true })) === 13,
   'mas continua contando como entregue: o trabalho existiu');

/* BACKLOG E PLANNING NAO SAO PLANO. Ali ainda se discute se a demanda entra, e
   contar como compromisso infla o plano com o que pode nem ser feito. */
['backlog', 'levantar_req', 'planning'].forEach((e) => {
  ok(CAP.planejados(dm({ status_planejamento: e, poker_pontos: 8 })) === 0,
     'etapa "' + e + '" nao conta como planejado');
});
['planejado', 'em_andamento', 'validacao', 'concluido'].forEach((e) => {
  ok(CAP.planejados(dm({ status_planejamento: e, poker_pontos: 8 })) === 8,
     'etapa "' + e + '" conta como planejado');
});

/* O ENTREGUE COMECA NA ENTREGA DO DEV, e nao na aprovacao do PM/PO — a mesma
   regra do prazo (prazo.js) e do ranking da semana. */
ok(CAP.entregues(dm({ status_planejamento: 'validacao', poker_pontos: 8 })) === 8,
   'demanda com o PM/PO ja conta como entregue: o dev fez');
ok(CAP.entregues(dm({ status_planejamento: 'em_andamento', poker_pontos: 8 })) === 0,
   'e em andamento nao conta — ainda esta na mao dele');

// A data que ancora cada lado. Usar a mesma para os dois faria o entregue cair
// sempre na semana do plano, e o cruzamento nao mediria nada.
ok(CAP.diaDoPlano({ entrega: '2026-08-20' }) === '2026-08-20',
   'o planejado ancora no PRAZO combinado');
ok(CAP.diaDaEntrega({ entregue_em: '2026-08-18T12:00:00Z', concluido_em: '2026-08-25' }) === '2026-08-18',
   'o entregue ancora na entrega do DEV, e nao na conclusao da esteira');
ok(CAP.diaDaEntrega({ concluido_em: '2026-08-25' }) === '2026-08-25',
   'sem entregue_em, a conclusao serve de reserva');
ok(CAP.diaDoPlano({ entrega: 'nao e data' }) === '' && CAP.diaDoPlano({}) === '',
   'data torta nao vira um dia qualquer');

/* ALOCADA SEM PONTUAR NAO SOMA ZERO EM SILENCIO. 27 demandas estao em
   Planejado/Em andamento sem pontuacao — nove sem prazo nenhum. Somar zero faz o
   planejado da pessoa parecer menor, e a conclusao errada e "sobra capacidade". */
ok(CAP.semPontuacao(dm({})) === true,
   'alocada sem pontuacao e contada a parte');
ok(CAP.semPontuacao(dm({ poker_pontos: 5 })) === false &&
   CAP.semPontuacao(dm({ status_planejamento: 'backlog' })) === false,
   'e nem pontuada nem em backlog contam nesse aviso');

(() => {
  const lista = [
    // Ana: prometido 21, entregou 13 (a de 8 ainda esta na mao dela)
    { dev: 'Ana', status_planejamento: 'concluido', pontos_planejados: 13, poker_pontos: 13,
      entrega: '2026-08-10', entregue_em: '2026-08-12' },
    { dev: 'Ana', status_planejamento: 'em_andamento', pontos_planejados: 8, poker_pontos: 8,
      entrega: '2026-08-20' },
    // Dupla: 8 pontos divididos entre os dois
    { dev: 'Ana / Bruno', status_planejamento: 'concluido', pontos_planejados: 8, poker_pontos: 8,
      entrega: '2026-08-15', entregue_em: '2026-08-15' },
    // Fora da janela: nao entra em nenhum dos lados
    { dev: 'Ana', status_planejamento: 'concluido', pontos_planejados: 100, poker_pontos: 100,
      entrega: '2026-07-10', entregue_em: '2026-07-11' },
    // Sem dono: nao entra em ranking nenhum
    { dev: '', status_planejamento: 'concluido', poker_pontos: 55, entrega: '2026-08-10' },
    // Alocada sem pontuar
    { dev: 'Bruno', status_planejamento: 'planejado', entrega: '2026-08-18' },
  ];
  const r = CAP.porDev(lista, '2026-08-01', '2026-08-31');
  const ana = r.find((x) => x.nome === 'Ana');
  const bruno = r.find((x) => x.nome === 'Bruno');
  ok(ana.plan === 25 && ana.entregue === 17,
     'Ana: 13 + 8 + metade de 8 planejados, 13 + metade de 8 entregues',
     ana.plan + ' / ' + ana.entregue);
  /* O PONTO E DIVIDIDO NA DUPLA. Contar inteiro para cada um faz a soma por dev
     estourar o total, e a primeira coisa que se faz numa tabela e somar a coluna. */
  ok(bruno.plan === 4 && bruno.entregue === 4, 'Bruno leva a metade da demanda em dupla');
  ok(bruno.semPontuar === 1, 'e a alocada sem pontuar aparece na linha dele');
  ok(!r.some((x) => x.nome === ''), 'demanda sem dono nao cria linha vazia');
  ok(ana.plan < 100, 'demanda de outro mes nao entra na janela');
  /* O PERCENTUAL SO EXISTE COM PLANO: sem denominador, "entregou 40" nao tem
     referencia, e um 0% ali seria inventar uma. */
  const soEntrega = CAP.porDev(
    [{ dev: 'Cara', status_planejamento: 'concluido', poker_pontos: 8,
       poker_retroativo: true, entregue_em: '2026-08-12' }],
    '2026-08-01', '2026-08-31')[0];
  ok(soEntrega.plan === 0 && soEntrega.entregue === 8 && soEntrega.pct === null,
     'entrega sem plano tem percentual nulo, e nao 0% nem 100%');
})();

/* O CARIMBO E DO SERVIDOR, e nao da tela: a demanda entra em Planejado pelo
   Gantt, pelo admin e pela API, e a terceira tela e sempre a que esquece. */
(() => {
  const bl = (dec) => {
    const i = W.indexOf(dec);
    if (i < 0) return '';
    const fim = W.indexOf(';', i);
    return W.slice(i, fim + 1) + '\n';
  };
  const i = W.indexOf('function normalizaEstados(');
  ok(i > 0, 'existe normalizaEstados no worker');
  if (i < 0) return;
  let d = 0, fim = -1;
  for (let k = W.indexOf('{', i); k < W.length; k++) {
    if (W[k] === '{') d++;
    else if (W[k] === '}') { d--; if (!d) { fim = k + 1; break; } }
  }
  const N = new Function(bl('const SP_PARA_STATUS =') + bl('const STATUS_PARA_SP =') +
                         bl('const ETAPAS_ALOCADA =') + bl('const PONTOS_PADRAO =') +
                         W.slice(i, fim) + '; return normalizaEstados;')();

  const base = { melhorias: [
    { codigo: 'novo', status_planejamento: 'em_andamento', poker_pontos: 8 },
    { codigo: 'jaTem', status_planejamento: 'concluido', poker_pontos: 55, pontos_planejados: 34 },
    { codigo: 'retro', status_planejamento: 'concluido', poker_pontos: 13, poker_retroativo: true },
    { codigo: 'backlog', status_planejamento: 'backlog', poker_pontos: 21 },
    { codigo: 'semPt', status_planejamento: 'planejado' },
  ] };
  N(base);
  const g = (c) => base.melhorias.find((m) => m.codigo === c);
  ok(g('novo').pontos_planejados === 8, 'alocada sem carimbo recebe o carimbo');
  /* A TRAVA DO CARIMBO. Sem `!m.pontos_planejados`, cada gravacao reescreveria o
     valor com o tamanho corrente e o congelamento nao existiria — era o defeito
     que a feature inteira existe para evitar. */
  ok(g('jaTem').pontos_planejados === 34,
     'e quem ja tinha carimbo NAO e reescrito, mesmo com o tamanho mudado');
  ok(g('retro').pontos_planejados === undefined,
     'pontuada depois de concluir nao ganha carimbo de plano');
  ok(g('backlog').pontos_planejados === undefined,
     'backlog nao ganha carimbo: ali ainda se discute se a demanda entra');
  /* "SEM PONTUACAO NAO HA O QUE CARIMBAR" DEIXOU DE EXISTIR: com o piso de 3, uma
     demanda alocada nunca chega sem tamanho — e por isso ela sai daqui com ponto E
     carimbo. Era esse o buraco de 904 pontos. */
  ok(g('semPt').poker_pontos === 3 && g('semPt').pontos_planejados === 3,
     'alocada sem tamanho recebe o piso e o carimbo junto');
})();

/* AS TRES TELAS USAM A MESMA REGRA. Quinta copia de conta nesta base e o caminho
   conhecido para duas telas discordarem do mesmo numero — e o painel do dev
   discordava do Gantt justamente assim: um contava por `concluido_em`, o outro
   por `entregue_em`. */
['admin.html', 'gantt.html', 'dev.html'].forEach((f) => {
  const tela = f === 'admin.html' ? ADMIN : f === 'gantt.html' ? GANTT : DEV;
  ok(/capacidade\.js/.test(tela), f + ' carrega capacidade.js');
  ok(/CAPACIDADE/.test(tela), f + ' usa a regra compartilhada');
});
ok(!/const pts = \(Number\(m\.poker_pontos\) \|\| 0\) \/ devs\.length;[\s\S]{0,200}a\.pontos \+= pts/.test(DEV),
   'o painel do dev nao soma pontos por conta propria');

/* O GANTT FILTRA AS DUAS PONTAS PELA JANELA DO MES.
   `devCards` traz o que APARECE no mes (tem inicio ou entrega nele), e somar o
   entregue de todos eles contava a demanda planejada para agosto e entregue em
   setembro como se tivesse saido em agosto. O Gantt dizia 110% onde o admin dizia
   47% — duas telas, o mesmo numero, respostas diferentes. */
(() => {
  const c = corpo(GANTT, 'function pontosPokerPorSemana(');
  ok(!!c, 'existe a conta de pontos por semana do Gantt');
  if (!c) return;
  ok(/function pontosPokerPorSemana\(devCards, semanas, de, ate\)/.test(c),
     'ela recebe a janela do mes, e nao so os cards');
  ok(/dentro\(CAP\.diaDoPlano\(m\) \|\| m\.inicio\)/.test(c) &&
     /dentro\(CAP\.diaDaEntrega\(m\)\)/.test(c),
     'e filtra o planejado E o entregue por ela');
})();

/* NADA ACIMA DE 100% TAMBEM AQUI. "178%" numa linha de capacidade se le como erro,
   e travar em 100 seria mentir — os pontos existiram. Acima do plano sai a
   diferenca em pontos, que responde "quanto saiu alem do combinado". Acontece de
   forma legitima: o dev fecha em agosto o que foi planejado para julho. */
(() => {
  const r = CAP.rotulo;
  ok(r(0, 0) === '—', 'sem plano e sem entrega, travessao');
  ok(r(100, 62) === '62%' && r(100, 100) === '100%', 'ate 100 e percentual');
  ok(r(108, 192) === '+84 pt' && r(198, 218) === '+20 pt',
     'acima do plano sai a diferenca em pontos');
  ok(r(0, 40) === '+40 pt', 'entrega sem plano tambem sai em pontos');
  let ruins = [];
  for (let p = 1; p <= 200; p += 3) for (let e = 0; e <= 400; e += 17) {
    const t = r(p, e);
    if (t.endsWith('%') && Number(t.slice(0, -1)) > 100) ruins.push(p + '/' + e);
  }
  ok(!ruins.length, 'nenhum par plano/entrega produz percentual acima de 100',
     ruins.length ? ruins.slice(0, 5).join(' ') : 'varrido 1..200 x 0..400');
  // E o `pct` cru tambem para em 100, para quem o imprimir direto.
  const so = CAP.porDev([{ dev: 'X', status_planejamento: 'concluido',
    pontos_planejados: 10, poker_pontos: 100, entrega: '2026-08-10',
    entregue_em: '2026-08-11' }], '2026-08-01', '2026-08-31')[0];
  ok(so.pct === 100 && so.rotulo === '+90 pt',
     'o pct cru para em 100, e o rotulo diz a diferenca');
})();

/* ─── A PAUSA ESTICA O PRAZO, E SEM DEPENDER DE UM CLIQUE ────────────────
   Queixa dos devs: "quando pausam demanda por dependencia de outra, o prazo
   continua sendo contabilizado".

   ERAM DOIS DEFEITOS. O primeiro: a extensao acontecia SO no clique de "Retomar"
   — uma demanda pausada e concluida sem esse clique tinha os dias parados
   cobrados como atraso. Medido na base, nas seis pausadas com prazo: AX-199
   apareceria com 9 dias de atraso, sendo os 9 de pausa; AX-163 com 10, sendo 9;
   AX-084 com 20, sendo 16.

   O segundo: a entrega ficava ESCONDIDA durante a pausa, e o card mostrava a data
   original. Quem pausou em 11/08 uma demanda com prazo 30/07 via, no proprio
   card, a palavra "pausada" ao lado de uma data que ja tinha passado.           */
sec('A pausa estica o prazo');

const PZ = require('./prazo.js');

ok(typeof PZ.prazoEfetivo === 'function' && typeof PZ.diasPausados === 'function',
   'o prazo efetivo e os dias parados sao funcoes da regra unica');

// Sem pausa, o prazo efetivo E o combinado — nenhuma folga aparece do nada.
ok(PZ.prazoEfetivo({ entrega: '2026-07-30' }, '2026-08-20') === '2026-07-30',
   'sem pausa, o prazo nao se move');
ok(PZ.prazoEfetivo({ entrega: '2026-07-30', pausado_em: '2026-08-11' }, '2026-08-20') === '2026-08-08',
   'nove dias parada esticam o prazo em nove dias');
ok(PZ.prazoEfetivo({ entrega: '2026-08-31', pausado_em: '2026-08-20' }, '2026-08-20') === '2026-08-31',
   'pausada hoje ainda nao rendeu dia nenhum');
ok(PZ.prazoEfetivo({}, '2026-08-20') === '' &&
   PZ.prazoEfetivo({ entrega: 'x' }, '2026-08-20') === '',
   'sem prazo combinado nao ha prazo efetivo');
// Referencia ANTES da pausa nao anda para tras.
ok(PZ.prazoEfetivo({ entrega: '2026-08-10', pausado_em: '2026-08-15' }, '2026-08-12') === '2026-08-10',
   'referencia anterior a pausa nao encurta o prazo');

/* O CASO QUE MOTIVOU: concluida sem alguem clicar "Retomar". */
const conc = (entrega, pausado_em, fim) => ({
  entrega, pausado_em, status_planejamento: 'concluido', entregue_em: fim });
ok(PZ.diasDeAtraso(conc('2026-08-11', '2026-08-11', '2026-08-20'), 'concluido', '2026-08-20') === 0,
   'AX-199: pausada no dia do prazo e concluida 9 dias depois nao atrasa');
ok(PZ.diasDeAtraso(conc('2026-08-10', '2026-08-11', '2026-08-20'), 'concluido', '2026-08-20') === 1,
   'AX-163: 10 dias viram 1 — os 9 de pausa saem da conta');
ok(PZ.atrasouNaEntrega(conc('2026-08-11', '2026-08-11', '2026-08-20')) === false,
   'e o relatorio concorda: nao atrasou');

/* O QUE A PAUSA NAO FAZ: apagar o atraso ANTERIOR a ela. Das seis pausadas com
   prazo, CINCO ja estavam atrasadas no dia do clique — AX-123 estava 12 dias.
   Esticar devolve os dias PARADOS, e nao os que passaram antes: pausar depois do
   prazo estourar nao desfaz o estouro. */
ok(PZ.diasDeAtraso(conc('2026-07-30', '2026-08-11', '2026-08-20'), 'concluido', '2026-08-20') === 12,
   'AX-123: 21 dias viram 12 — os 9 de pausa saem, os 12 anteriores ficam');

/* NAO HA CONTAGEM DUPLA DEPOIS DE RETOMAR. Quem retoma empurra a `entrega` E
   acumula `pausa_dias` na mesma acao, entao os dias ja retomados estao DENTRO da
   data: somar `pausa_dias` aqui daria o dobro de folga. E por isso que
   `prazoEfetivo` le so a pausa CORRENTE. */
ok(PZ.diasDeAtraso({ entrega: '2026-08-20', pausa_dias: 9, pausado_em: '',
                     status_planejamento: 'concluido', entregue_em: '2026-08-20' },
                   'concluido', '2026-08-20') === 0,
   'depois de retomar, os dias ja estao na data e nao contam de novo');
(() => {
  const c = corpo(PRZ, 'function prazoEfetivo(');
  ok(!!c && !/pausa_dias/.test(c),
     'e `prazoEfetivo` nao le `pausa_dias` — seria a contagem dupla');
})();

/* PAUSADA CONTINUA SEM ATRASO ENQUANTO ESTA PARADA. O prazo esta suspenso, nao
   estourado — e esta parte ja funcionava; a invariante existe para nao se perder
   junto com a mudanca. */
ok(PZ.diasDeAtraso({ entrega: '2026-07-30', pausado_em: '2026-08-11',
                     status_planejamento: 'em_andamento' }, 'em_andamento', '2026-08-20') === null,
   'pausada em andamento nao mostra atraso nenhum');

/* O WORKER TEM A MESMA REGRA. Ele nao carrega os scripts do site, entao a conta e
   repetida la — e duas copias que divergem sao o defeito original desta base (a
   regra de atraso viveu em quatro versoes). A invariante roda as DUAS e compara. */
(() => {
  const c = corpo(W, 'function prazoEfetivo(');
  ok(!!c, 'o worker tem o prazo efetivo');
  if (!c) return;
  const diaFn = W.slice(W.indexOf('const dia = t =>'), W.indexOf('};', W.indexOf('const dia = t =>')) + 2);
  const pe = new Function(diaFn + c + '; return prazoEfetivo;')();
  const casos = [
    [{ entrega: '2026-07-30' }, '2026-08-20'],
    [{ entrega: '2026-07-30', pausado_em: '2026-08-11' }, '2026-08-20'],
    [{ entrega: '2026-08-11', pausado_em: '2026-08-11' }, '2026-08-20'],
    [{ entrega: '2026-08-31', pausado_em: '2026-08-20' }, '2026-08-20'],
    [{ entrega: '2026-08-10', pausado_em: '2026-08-15' }, '2026-08-12'],
    [{}, '2026-08-20'],
  ];
  const difere = casos.filter(([m, r]) => pe(m, r) !== PZ.prazoEfetivo(m, r));
  ok(!difere.length, 'e ele devolve o MESMO prazo efetivo que as telas',
     difere.length ? difere.map(([m, r]) => JSON.stringify(m) + ' worker=' + pe(m, r) +
                                ' telas=' + PZ.prazoEfetivo(m, r)).join(' ; ')
                   : casos.length + ' casos iguais');
  ok(!/pausa_dias/.test(c), 'e tambem nao le pausa_dias');
})();

/* A DATA FICA A VISTA NAS TRES TELAS. Escondida, ela deixava quem planeja sem
   saber quando a demanda volta — e o card mostrava a original, ja vencida. */
[['admin.html', ADMIN], ['gantt.html', GANTT], ['dev.html', DEV]].forEach(([nome, tela]) => {
  ok(/PRAZO\.prazoEfetivo\(m, _isoHoje\(\)\)/.test(tela),
     nome + ' mostra o prazo esticado durante a pausa');
  ok(!/Entrega oculta|entrega está oculta/.test(tela),
     nome + ' nao esconde mais a entrega');
});

/* ─── ROLAGEM DE SPRINT ──────────────────────────────────────────────────
   Quantas demandas foram empurradas de uma sprint para outra, e o NOME das que
   passaram de duas.

   O DADO VEM DO `historico`, e nao do campo `sprint`: ha ZERO eventos de mudanca
   de `sprint` em toda a base — o campo nunca e editado por tela nenhuma —, e ler
   dali daria zero para sempre. O que muda e a `entrega`: 69 mudancas em 39
   demandas. Como as sprints sao as semanas do mes, uma entrega que anda de semana
   E a demanda mudando de sprint.                                               */
sec('Rolagem de sprint');

(() => {
  const r = CAP.rolagemDeSprint;
  const hist = (pares) => ({
    codigo: 'AX-T', entrega: pares[pares.length - 1][1],
    historico: pares.map(([de, para], i) => ({
      em: '2026-08-0' + (i + 1) + 'T10:00:00Z',
      mudancas: [{ campo: 'entrega', de: de, para: para }],
    })),
  });

  ok(r(hist([['2026-08-03', '2026-08-10']])).sprints === 1,
     'sete dias de avanco e uma sprint');
  ok(r(hist([['2026-08-03', '2026-08-26']])).sprints === 3,
     'vinte e tres dias sao tres sprints');
  ok(r(hist([['2026-08-10', '2026-08-14']])) === null,
     'quatro dias nao chegam a uma sprint — remarcar dentro da semana nao e pulo');

  /* PRIMEIRO PLANEJAMENTO NAO E PULO. Mudanca de "" para uma data e a demanda
     ganhando prazo, e nao sendo empurrada: ela nao tinha de onde sair. */
  ok(r(hist([['', '2026-08-26']])) === null,
     'ganhar o primeiro prazo nao conta como rolagem');
  ok(r(hist([['', '2026-08-03'], ['2026-08-03', '2026-08-26']])).sprints === 3,
     'e o pulo depois do primeiro prazo conta, medido do primeiro');

  /* MEDE O AVANCO LIQUIDO, e nao a soma dos pulos. AX-001 foi de 21/08 para
     15/01/2027 e voltou para 21/08 no minuto seguinte — correcao de digitacao. Se
     somasse os pulos, ela seria a demanda mais rolada da base. */
  ok(r(hist([['2026-08-21', '2027-01-15'], ['2027-01-15', '2026-08-21']])) === null,
     'ida e volta no mesmo prazo nao conta (a correcao de digitacao da AX-001)');
  ok(r(hist([['2026-08-03', '2026-08-31'], ['2026-08-31', '2026-08-10']])).sprints === 1,
     'e o que interessa e onde a demanda terminou, nao por onde passou');

  /* DESCONTA A PAUSA. Retomar empurra a `entrega` pelos dias parados, e isso e
     extensao acordada com motivo registrado — nao e a demanda sendo adiada. Sem o
     desconto, toda pausa longa viraria alerta justamente onde ja ha explicacao. */
  const comPausa = Object.assign(hist([['2026-08-16', '2026-08-30']]),
                                 { pausa_historico: [{ dias: 14 }] });
  ok(r(comPausa) === null, 'catorze dias de avanco com catorze de pausa nao e rolagem');
  const meiaPausa = Object.assign(hist([['2026-08-16', '2026-08-30']]),
                                  { pausa_historico: [{ dias: 7 }] });
  ok(r(meiaPausa).sprints === 1, 'e a metade que nao foi pausa continua contando');
  (() => {
    const c = corpo(CAPJS, 'function rolagemDeSprint(');
    ok(!!c && /pausa_historico/.test(c),
       'a funcao le o historico de pausa para descontar');
  })();

  // Demanda sem historico, sem prazo, ou oculta: nao ha o que medir.
  ok(r({ codigo: 'x', entrega: '2026-08-10' }) === null, 'sem historico, sem rolagem');
  ok(r(Object.assign(hist([['2026-08-03', '2026-08-26']]), { entrega: '' })) === null,
     'sem prazo atual nao da para medir onde ela terminou');
  ok(r(Object.assign(hist([['2026-08-03', '2026-08-26']]), { oculto: true })) === null,
     'demanda oculta nao entra');
})();

/* O CORTE DO ALERTA: duas sprints e tolerancia de replanejamento; da terceira em
   diante a demanda esta sendo adiada, e adiar sem dizer o nome dela e como ela
   sai de vista. */
ok(CAP.SPRINTS_PARA_ALERTA === 2, 'o alerta comeca acima de duas sprints');
(() => {
  const mk = (cod, dias) => ({
    codigo: cod, entrega: '2026-09-30',
    historico: [{ em: '2026-08-01T10:00:00Z', mudancas: [{ campo: 'entrega',
      de: (() => { const d = new Date(Date.UTC(2026, 8, 30)); d.setUTCDate(d.getUTCDate() - dias);
                   return d.toISOString().slice(0, 10); })(), para: '2026-09-30' }] }],
  });
  const r = CAP.rolagens([mk('AX-A', 7), mk('AX-B', 14), mk('AX-C', 21), mk('AX-D', 3)]);
  ok(r.total === 3, 'tres rolaram (a de tres dias nao chega a uma sprint)');
  ok(r.alerta.map((x) => x.codigo).join(',') === 'AX-C',
     'e so a de tres sprints pede atencao nominal');
  ok(r.todas[0].codigo === 'AX-C', 'a lista sai da maior para a menor');
})();

/* ─── AS TRES LINHAS DO GANTT ────────────────────────────────────────────
   A versao anterior punha tudo numa linha, com "S1:57→36 S2:65→47": o par dentro
   de cada semana obrigava o olho a ler duas coisas por bloco, e a comparacao que
   interessa ("planejei 100 na S2 e sai 47") ficava dentro de um token.          */
(() => {
  ok(/🃏 <b>\$\{pontosTotal\}<\/b> pt planejados/.test(GANTT),
     'a primeira linha e o cruzamento: planejado x entregue');
  ok(/cq-r">Plan\.<\/span>/.test(GANTT) && /cq-r">Exec\.<\/span>/.test(GANTT),
     'e ha uma linha para o planejado e outra para o executado');
  ok(!/S\$\{i\+1\}:\$\{p\}\$\{f \? '→' \+ f : ''\}/.test(GANTT),
     'os dois numeros nao voltam para dentro do mesmo bloco de semana');
  ok(/◐ \$\{semPontuar\} sem pontuar/.test(GANTT),
     'as tarefas sem pontuacao continuam a vista');

  /* UM QUADRO, E ELE CABE NA COLUNA. A coluna do dev tem 230px (206 uteis). A
     versao em linha punha rotulo + total + cinco sprints juntos e pedia ~210px:
     estourava, e o Fernando viu estourar. Com as sprints no CABECALHO, o rotulo
     cai para tres caracteres e cada sprint fica com ~34px — cabe "1270".

     E O ALINHAMENTO E POR GRID, nao por largura adivinhada: as tres linhas dividem
     o mesmo template, entao S2 do planejado cai sobre S2 do executado qualquer que
     seja o numero de digitos. A versao com `min-width: 52px` era um palpite que
     quebraria no primeiro numero de quatro digitos. */
  ok(/\.cap-quadro \{/.test(GANTT), 'o planejado x executado e um quadro');
  const tpl = GANTT.match(/grid-template-columns: ([\d.]+)em repeat\(5, 1fr\)/);
  ok(!!tpl, 'com um template unico de seis colunas');
  if (tpl) {
    // 10,5px de fonte no quadro; 230px de coluna menos 24 de padding.
    const rotulo = parseFloat(tpl[1]) * 10.5;
    const porSprint = (206 - rotulo - 5) / 5;
    ok(porSprint >= 28, 'e sobra largura por sprint para caber quatro digitos',
       porSprint.toFixed(0) + 'px por sprint');
  }
  ok(!/\.cap-sem \{[^}]*min-width/.test(GANTT) && !/cap-regua/.test(GANTT),
     'as reguas em linha, que estouravam, nao existem mais');

  /* AS TRES CORES DO EXECUTADO. Verde bateu, vermelho ficou abaixo, branco ainda
     nao aconteceu — e o "ainda nao aconteceu" e a parte que importa: julgar a
     sprint EM CURSO e o mesmo defeito do ranking do Planning, onde numa quarta a
     semana teve tres dias uteis contra cinco da anterior. O vermelho ali acusaria
     a pessoa de algo que o calendario ainda nao permitiu. */
  ok(/cq-bateu/.test(GANTT) && /cq-abaixo/.test(GANTT) && /cq-neutro/.test(GANTT),
     'o executado tem as tres cores do padrao');
  ok(/const fechou = !!fimSem && fimSem < todayStr;/.test(GANTT),
     'a tela sabe se a sprint fechou');
  /* A ASSIMETRIA E DE PROPOSITO, decisao do Fernando: o VERDE nao espera a sprint
     fechar, o VERMELHO espera.

     Bater a meta e fato, e mais tempo so pode SOMAR — quem entregou o combinado
     na quarta nao vai desentregar na quinta. Ja o vermelho na sprint em curso
     acusaria a pessoa de algo que o calendario ainda nao permitiu, que e o mesmo
     defeito do ranking do Planning. */
  ok(/const forte = window\.CAPACIDADE\.sprintForte\(p, f\);/.test(GANTT),
     'o veredito da sprint sai da regra compartilhada');
  ok(/forte \? 'cq-bateu' : \(fechou && p \? 'cq-abaixo' : 'cq-neutro'\)/.test(GANTT),
     'e o vermelho SO na sprint fechada com plano; o resto fica neutro');

  /* VERDE POR UM DOS DOIS CAMINHOS. O segundo — cem pontos em valor absoluto —
     existe porque o plano estava punindo quem entregou mais: duas pessoas fecham
     104 pontos na mesma semana, e a de plano 90 aparecia verde enquanto a de plano
     119 aparecia vermelha. A cor dizia mais sobre quem planejou do que sobre quem
     fez. Quem apontou foi o Fernando, com o caso na tela. */
  ok(CAP.PONTOS_SPRINT_FORTE === 100, 'cem pontos e o limite da semana forte');
  const sf = CAP.sprintForte;
  ok(sf(119, 104) === true, 'o caso que o Fernando mostrou: 104 contra 119 e verde');
  ok(sf(500, 100) === true && sf(500, 99) === false,
     'o limite e absoluto: cem entra, noventa e nove nao');
  ok(sf(46, 62) === true && sf(2, 2) === true,
     'e superar ou bater o plano continua verde, em qualquer volume');
  ok(sf(60, 36) === false && sf(127, 63) === false,
     'abaixo do plano e abaixo de cem nao e verde');
  ok(sf(0, 40) === false,
     'sem plano e sem volume nao ha o que celebrar — nao existia meta');
  ok(sf(0, 100) === true, 'mas cem pontos sem plano nenhum ainda e semana forte');

  // O numero da task aparece no alerta: contagem sem nome nao da o que fazer.
  ok(/rolou\.alerta\.map\(r => `\$\{esc\(r\.codigo\)\} \(\+\$\{r\.sprints\}\)`\)/.test(GANTT),
     'o alerta traz o numero da task, e nao so a contagem');
})();

/* ─── O SELO DE CACHE DE CADA SCRIPT ────────────────────────────────────
   Todo `<script src="algo.js?v=XXXX">` desta base carrega o md5 do arquivo,
   truncado em 10. O selo NAO E ENFEITE: e a chave de cache. O GitHub Pages serve
   os `.js` com cache de navegador, entao mudar o arquivo sem mudar o selo faz o
   navegador continuar usando o que ja tem — o arquivo novo esta no ar e ninguem o
   recebe.

   ISSO ACONTECEU. Num unico dia, `prazo.js` ganhou o conserto da pausa e
   `apresentacao.js` ganhou o padrao de cores, os slides de pontos e a regra de nao
   mostrar percentual acima de 100 — e os dois seguiram com o selo antigo em quatro
   telas. Quem tinha o arquivo em cache continuaria vendo a versao de ontem, SEM
   ERRO NENHUM na tela indicando isso. Foi a pergunta do Fernando ("as mudancas do
   Gantt subiram?") que levou a olhar.

   Nao ha build nesta base: os selos sao mantidos a mao, e e por isso que passam.
   Esta invariante e o que fecha a lacuna — ela recalcula todos e falha nomeando o
   arquivo, a tela e os dois valores.                                            */
sec('Selo de cache dos scripts');

(() => {
  const crypto = require('crypto');
  const telas = ['admin.html', 'dev.html', 'gantt.html', 'index.html', 'poker.html',
                 'importar.html', 'projetos.html'];
  const selo = (arq) =>
    crypto.createHash('md5').update(fs.readFileSync(arq)).digest('hex').slice(0, 10);

  const errados = [];
  let conferidos = 0;
  telas.forEach((tela) => {
    if (!fs.existsSync(tela)) return;
    const s = fs.readFileSync(tela, 'utf8');
    [...s.matchAll(/src="([a-z0-9-]+\.js)\?v=([a-z0-9]+)"/g)].forEach(([, arq, v]) => {
      if (!fs.existsSync(arq)) { errados.push(tela + ' inclui ' + arq + ', que nao existe'); return; }
      conferidos++;
      const certo = selo(arq);
      if (certo !== v) errados.push(tela + ': ' + arq + ' esta com ' + v + ' e deveria ser ' + certo);
    });
  });

  ok(conferidos > 0, 'as telas versionam os scripts com selo de cache', conferidos + ' inclusoes');
  ok(!errados.length,
     'e todo selo bate com o md5 do arquivo — script mudado sem selo novo nao chega a quem tem cache',
     errados.length ? errados.join(' ; ') : conferidos + ' selos conferidos');
})();

/* ─── PLANEJADO x ENTREGUE NO DECK ───────────────────────────────────────
   A leitura que o Fernando pediu para levar ao gerencial. O deck e a QUARTA tela
   a fazer esta conta (Gantt, painel do dev, admin e ele), e e onde a divergencia
   seria mais cara: um numero diferente do painel, projetado para a diretoria.  */
sec('Planejado x entregue no deck');

ok(/function slideCapacidade\(/.test(APRES), 'existe o slide de capacidade');
ok(/capacidade: \(\(\) => \{/.test(ADMIN) && /CAPI\.porDev\(vivasCap/.test(ADMIN),
   'e os dados dele saem de capacidade.js, e nao de uma conta propria do deck');
ok(/CAPI\.porFaixa\(vivasCap, faixas\)/.test(ADMIN),
   'inclusive o ritmo por sprint');
/* O LIMITE DA SEMANA FORTE VIAJA JUNTO. Uma copia dele no slide faria a regra do
   deck divergir da tela no dia em que alguem mudar de 100 para 80. */
ok(/limiteForte: CAPI\.PONTOS_SPRINT_FORTE/.test(ADMIN),
   'o limite da semana forte vem da regra, e nao repetido no slide');

(() => {
  const sl = corpo(APRES, 'function slideCapacidade(');
  ok(!!sl, 'existe o corpo do slide');
  if (!sl) return;
  /* NADA ACIMA DE 100%: o `rotulo` de capacidade.js ja resolve, e o slide o usa em
     vez de dividir na mao. */
  ok(/window\.CAPACIDADE\.rotulo/.test(sl),
     'a leitura do percentual passa pelo rotulo compartilhado');
  ok(!/Math\.round\(cap\.entregue \/ cap\.plan \* 100\) \+ '%'/.test(sl) ||
     /Math\.min\(100/.test(sl),
     'e a reserva, se usada, tambem para em 100');
  /* NENHUM DEV PINTADO DE VERMELHO. Abaixo do plano e um fato que os numeros ja
     dizem; a cor ali, num slide de diretoria, transforma leitura em acusacao
     diante de quem nao estava na conversa. No Gantt — ferramenta do proprio time —
     o vermelho existe e faz sentido. */
  ok(!/SIGNIFICADO\.falhou/.test(sl) && !/C\.vermelho/.test(sl),
     'nenhum desenvolvedor e pintado de vermelho no deck');
  /* A SOBRA DA LISTA E DITA. Sem isso a soma das linhas nao fecha com o total do
     cartao, e a primeira coisa que alguem faz num slide de numeros e somar. */
  ok(/e mais ' \+ sobra/.test(sl), 'a lista diz quantas pessoas ficaram de fora');
  /* A CONTA DE ALTURA, e nao a estimativa. Rodape em 5,05; nota em 4,72; sprint em
     4,30; a lista tem de terminar antes disso. A primeira versao tinha oito linhas
     de 0,26 e tres "em curso" sairam do slide — medido no XML gerado. */
  const nL = Number((sl.match(/slice\(0, (\d+)\)/) || [])[1]);
  const alt = Number((sl.match(/ALT = ([\d.]+)/) || [])[1]);
  const y0 = Number((sl.match(/Y0 = ([\d.]+)/) || [])[1]);
  ok(Number.isFinite(nL) && Number.isFinite(alt) && Number.isFinite(y0),
     'as medidas da lista sao legiveis no codigo');
  /* A CONTA E LIDA DO CODIGO, e nao repetida aqui: o `yS` do bloco de sprint sai
     do proprio arquivo, entao mover o bloco nao deixa a invariante mentindo. */
  const yS = Number((sl.match(/var yS = ([\d.]+);/) || [])[1]);
  ok(Number.isFinite(yS), 'a posicao do bloco de sprint e legivel no codigo');
  if (Number.isFinite(nL) && Number.isFinite(yS)) {
    const fim = y0 + nL * alt + 0.2;   // +0.2 da linha de sobra
    ok(fim <= yS + 0.001,
       'a lista de devs termina antes do bloco de sprint',
       fim.toFixed(2) + '" contra ' + yS.toFixed(2) + '"');
    // E o bloco de sprint termina antes da nota: rotulo 0,18 + linha 0,24.
    ok(yS + 0.44 <= 4.72 + 0.001,
       'e o bloco de sprint termina antes da nota',
       (yS + 0.44).toFixed(2) + '" contra 4,72"');
  }
  ok(/y: 4\.72, w: 8\.76, h: 0\.3/.test(sl),
     'e a nota termina em 5,02 — logo acima do rodape, que fica em 5,05');
})();

/* ─── A VISAO DE DIRETORIA NO RELATORIOS ─────────────────────────────────
   Pedido do Fernando: "como o meu time andou, o que foi planejado, o que foi
   entregue, temas relevantes, dia de entrega" — mais o funil do que vem, e um
   filtro por sistema para prestar conta por area.                             */
sec('Relatorios: a visao de diretoria');

// DUAS ESCALAS: mes (fechamento, o padrao) e semana (reuniao).
ok(/id="rel-escala"/.test(ADMIN) && /function relJanela\(\)/.test(ADMIN),
   'existe a escala e a janela que ela define');
ok(/el && el\.value === 'semana' \? 'semana' : 'mes'/.test(ADMIN),
   'o mes e o padrao — fechamento e a conversa da diretoria');

/* UMA JANELA SO, EM QUALQUER ESCALA: A QUE FOI FILTRADA.
   Havia duas. Na semana, "Entregues" olhava a semana ANTERIOR a escolhida — a
   reuniao da semana que comeca reporta o que saiu na que acabou, porque a corrente
   ainda nao fechou. Defensavel como raciocinio, indefensavel na tela: com 17/08 a
   23/08 no filtro, "Como o time andou" dizia 149 pt entregues e "Entregues"
   listava 36 demandas de 10/08 a 16/08 logo abaixo — dois blocos discordando sobre
   a mesma pergunta, cada um certo pela sua propria regra. */
(() => {
  const c = corpo(ADMIN, 'function relDados(');
  ok(!!c, 'existe relDados');
  if (!c) return;
  ok(/const C = j\.de, D = j\.ate;/.test(c),
     'a janela de entrega e a filtrada, e nao a anterior');
  ok(!/deAnt|ateAnt/.test(c),
     'e relDados nao conhece mais a janela anterior — ela e so da comparacao');
  ok(/const visiveis = relVivas\(\);/.test(c),
     'e o filtro de sistema entra numa so vez, valendo para as duas listas');
  /* A DATA DE SAIDA E A DA ENTREGA DO DEV. Era `concluido_em` aqui e `entregue_em`
     no Gantt: a mesma entrega caia em semanas diferentes nas duas telas. */
  ok(/window\.CAPACIDADE\.diaDaEntrega\(m\)/.test(c),
     'a data de saida e a entrega do dev, como no resto da ferramenta');
})();

/* A COMPARACAO SUPRIMIDA QUANDO NAO HA BASE.
   Julho tem 105 pontos de plano contra 1137 entregues — e nao foi o time superando
   o combinado: 77 demandas foram pontuadas DEPOIS de concluidas, quando a base foi
   organizada, e para elas plano nunca existiu. Um "▲ +1619" ali e um numero que
   ninguem pode defender numa reuniao. */
(() => {
  const c = corpo(ADMIN, 'function relComoAndou(');
  ok(!!c, 'existe o bloco "como o time andou"');
  if (!c) return;
  ok(/semPlano/.test(c) && /comparavel/.test(c),
     'ele mede quanto do entregue veio de demanda sem plano');
  ok(/\(semPlano \/ entregue\) < 0\.5/.test(c),
     'e metade e o corte: abaixo dela o numero fala do cadastro, e nao do trabalho');
})();
ok(/sem base para comparar/.test(ADMIN),
   'a tela diz quando nao ha base, em vez de mostrar uma variacao indefensavel');
/* MAS A CONTAGEM DE ENTREGAS COMPARA SEMPRE: ela nao depende de plano nenhum. */
ok(/delta: relDeltaHTML\(r\.agora\.entregue, r\.antes\.entregue, true\)/.test(ADMIN),
   'o entregue em pontos continua comparavel — e fato, com ou sem plano');

/* ONDE A CAPACIDADE FOI: por PONTOS, e nao por contagem. Contar demandas da o
   mesmo peso a um ajuste de meia hora e a uma entrega de 13 pontos. */
(() => {
  const c = corpo(ADMIN, 'function relTemas(');
  ok(!!c, 'existe o bloco por sistema');
  if (!c) return;
  ok(/CAPI\.entregues\(m\)/.test(c), 'ele soma pontos entregues, e nao demandas');
  ok(/b\.pts - a\.pts/.test(c), 'e ordena por ponto');
})();

/* O QUE VEM: dois grupos, e a diferenca entre eles e a ACAO.
   Em Planning o tamanho nao existe (estimar); pontuado sem prazo tem tamanho e
   falta data (agendar). */
(() => {
  const c = corpo(ADMIN, 'function relOQueVem(');
  ok(!!c, 'existe o bloco do que vem');
  if (!c) return;
  ok(/=== 'planning'/.test(c), 'um grupo e o que esta em Planning');
  ok(/Number\(m\.poker_pontos\) > 0 && !CAPI\.diaDoPlano\(m\)/.test(c),
     'e o outro e o pontuado SEM prazo — tem tamanho e falta data');
  /* NAO PROJETA DATA. Num relatorio de diretoria, projecao e lida como
     compromisso — e o compromisso e do time, nao da ferramenta. */
  ok(!/prazoPrevisto|dataPrevista|projet/i.test(c),
     'e nenhuma data e projetada para elas');
})();

// A ata copiada carrega os blocos novos e diz a ESCALA — um fechamento mensal com
// titulo "REUNIAO DE 17/08 A 23/08" seria lido como semanal.
(() => {
  const c = corpo(ADMIN, 'function relTexto(');
  ok(!!c, 'existe o texto da ata');
  if (!c) return;
  ok(/'FECHAMENTO DE '/.test(c) && /'REUNIÃO DE '/.test(c),
     'a ata diz a escala no titulo');
  ok(/COMO O TIME ANDOU/.test(c) && /ONDE A CAPACIDADE FOI/.test(c) && /O QUE VEM/.test(c),
     'e leva os tres blocos novos');
})();

/* A DATA QUE O CARD MOSTRA E A DA SAIDA, e nao o prazo.
   O card escrevia "Entrega: 07/08" para uma demanda listada na semana de 10 a
   16/08: `m.entrega` e o PRAZO, e a lista filtra por `diaDaEntrega`. Dois campos
   sob o mesmo rotulo, e o cabecalho parecia mentir sobre a janela. Esta invariante
   RODA `relSaidaHTML` contra os dois casos que apareceram na tela. */
(() => {
  const c = corpo(ADMIN, 'function relSaidaHTML(');
  ok(!!c, 'existe a data de saida do card');
  if (!c) return;

  // A conta de prazo tem de vir de prazo.js — recalcular aqui e como a ferramenta
  // ja errou antes, com quatro telas dando quatro respostas.
  ok(/PRAZO\.diasDeAtraso\(/.test(c) && /PRAZO\.prazoEfetivo\(/.test(c),
     'e ela usa as funcoes de prazo.js, sem refazer a conta');
  ok(!/86400000|Date\.UTC/.test(c),
     'sem aritmetica de data propria — isso e de prazo.js');
  ok(/CAPACIDADE\.diaDaEntrega\(/.test(c),
     'e a data vem de diaDaEntrega, a mesma que filtra a janela');

  const formatDate = iso => {
    const p = String(iso || '').slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—';
  };
  let F;
  try {
    F = new Function('esc', 'formatDate', 'statusKey', 'window',
      c + '\n; return relSaidaHTML;'
    )(t => String(t == null ? '' : t), formatDate, m => m.status_planejamento || '', globalThis);
  } catch (e) { ok(false, 'relSaidaHTML roda isolada', e.message); return; }

  const texto = h => String(h).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  // AX-154 de verdade: prazo 07/08, entregue 11/08.
  const t154 = texto(F({ entrega: '2026-08-07', entregue_em: '2026-08-11T13:00:00.000Z',
                         status_planejamento: 'concluido' }));
  ok(/11\/08\/2026/.test(t154) && !/Entregue: 07\/08/.test(t154),
     'o card diz o dia em que a demanda saiu, e nao o prazo', t154);
  ok(/4 dias? após o prazo/.test(t154),
     'e diz de quanto foi o atraso, com o prazo entre parenteses', t154);

  // AX-231 de verdade: sem prazo, entregue 12/08. Antes escrevia "Entrega: —".
  const t231 = texto(F({ entregue_em: '2026-08-12T14:01:39.060Z',
                         status_planejamento: 'concluido' }));
  ok(/12\/08\/2026/.test(t231), 'demanda sem prazo mostra a data em que saiu', t231);
  ok(/sem prazo/.test(t231),
     'e avisa que nao havia combinado — deixar sem marca se confunde com "cumpriu"', t231);

  // No prazo tem de ser dito, e nao apenas nao-dito.
  const tok = texto(F({ entrega: '2026-08-14', entregue_em: '2026-08-13T10:00:00.000Z',
                        status_planejamento: 'concluido' }));
  ok(/13\/08\/2026/.test(tok) && /no prazo/.test(tok), 'quem cumpriu aparece como cumpriu', tok);

  // Sem data de saida a demanda esta fora de qualquer fechamento, e a linha diz.
  const tsem = texto(F({ entrega: '2026-08-14', status_planejamento: 'concluido' }));
  ok(/sem data/.test(tsem), 'sem data de saida a linha diz que a demanda fica fora', tsem);
})();

/* NENHUM SISTEMA VIRA "OUTROS". A lista cortava em oito e dobrava a cauda em
   "Outros (12)" — numa reuniao de diretoria isso e uma pergunta, nao uma resposta,
   e o sistema e campo obrigatorio na demanda: sempre ha nome para mostrar. */
(() => {
  const c = corpo(ADMIN, 'function relRenderTemas(');
  ok(!!c, 'existe o bloco de onde a capacidade foi');
  if (!c) return;
  /* Mede a CONSTRUCAO, e nao a palavra: a versao anterior desta invariante casava
     com o proprio comentario que explica a correcao, e acusava o codigo corrigido. */
  ok(!/nome:\s*'Outros/.test(c) && !/'Outros \(' \+/.test(c),
     'e nenhum sistema e dobrado num item sintetico "Outros (n)"');
  ok(!/\.slice\(8\)/.test(c), 'sem cauda separada para dobrar');
  ok(!/\.slice\(0,\s*8\)/.test(c), 'sem corte em oito — a lista mostra todos');
  ok(/rel-tema-sempt/.test(c),
     'e sistema com entrega sem pontuacao nao ganha barra: zero ponto nao e pouco trabalho');
})();

/* A BANDEJA DE CADA SISTEMA RECOLHE — e esta invariante EXECUTA o codigo da tela,
   em vez de procurar palavras nele. Um regex por "aria-expanded" passaria com o
   estado guardado no DOM, que era justamente o defeito a evitar: o relatorio
   redesenha no polling de 30 s, e a bandeja reabriria sozinha no meio da leitura. */
(() => {
  const nomes = ['relRaizNome', 'relRaizDe', 'relAgrupaPorTema', 'relRecolher',
                 'relRecolherTodos', 'relAgrupadoHTML'];
  const fontes = nomes.map(n => corpo(ADMIN, 'function ' + n + '('));
  const faltando = nomes.filter((n, i) => !fontes[i]);
  ok(!faltando.length, 'existe o recolhimento por sistema', faltando.join(', '));
  if (faltando.length) return;

  const esc = t => String(t == null ? '' : t)
    .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const _relRecolhidos = new Set();
  const temas = [
    { id: 1, nome: 'AXCred - Cadastro' },
    { id: 2, nome: 'AXCred - Cadastro - Analise de Credito - Reanalise' },
    { id: 3, nome: 'AXCred - Cobranca' },
    { id: 4, nome: "AXCred - O'Brien" },   // apostrofo: quebra onclick mal escapado
  ];
  const dem = (codigo, tema_id, pontos) => ({ codigo, tema_id, poker_pontos: pontos });
  const _d = {
    entregues: [dem('AX-001', 1, 8), dem('AX-002', 2, 13), dem('AX-003', 2, 5),
                dem('AX-004', 3, 21), dem('AX-005', 4, 3)],
    andamento: [dem('AX-100', 1, 2)],
  };
  const blocos = { 'rel-entregues': { innerHTML: '' }, 'rel-andamento': { innerHTML: '' } };
  let caiuNoRender = false;

  let M;
  try {
    M = new Function('esc', '_relRecolhidos', 'state', 'relCardHTML', 'relDados',
                     'renderRelatorios', 'document',
      fontes.join('\n\n') + '\n; return { relAgrupadoHTML, relRecolher, relRecolherTodos, relAgrupaPorTema };'
    )(esc, _relRecolhidos, { temas }, (m, modo) => '<CARD ' + m.codigo + '>',
      () => _d, () => { caiuNoRender = true; },
      { getElementById: id => blocos[id] || null });
  } catch (e) { ok(false, 'o recolhimento roda isolado', e.message); return; }

  const conta = (h, re) => (h.match(re) || []).length;

  // AS RAIZES SE JUNTAM: Cadastro absorve a Reanalise, e nao viram tres cabecalhos.
  const g = M.relAgrupaPorTema(_d.entregues);
  ok(g.length === 3 && g[0].nome === 'AXCred - Cadastro' && g[0].itens.length === 3,
     'os sistemas se juntam pela raiz, e o maior vem primeiro',
     g.map(x => x.nome + '=' + x.itens.length).join(', '));

  // Tudo aberto na primeira vez: quem abre a aba ve o conteudo, e nao um indice.
  let h = M.relAgrupadoHTML(_d.entregues, 'entregues');
  ok(conta(h, /aria-expanded="true"/g) === 3 && conta(h, /<CARD /g) === 5,
     'no primeiro render tudo esta aberto');
  ok(conta(h, /<button type="button" class="rel-grupo-head"/g) === 3 &&
     !/<div class="rel-grupo-head"/.test(h),
     'o cabecalho e <button>, e nao <div> com clique — teclado e leitor de tela dependem disso');
  ok(/26 pt/.test(h), 'o cabecalho soma os pontos do grupo — recolhido, e o que sobra dele');

  // UM CLIQUE RECOLHE SO AQUELE, e o mesmo sistema no outro bloco fica como estava.
  M.relRecolher('entregues|AXCred - Cadastro');
  h = blocos['rel-entregues'].innerHTML;
  ok(!caiuNoRender, 'recolher nao redesenha a aba toda — a rolagem nao salta');
  ok(conta(h, /aria-expanded="false"/g) === 1 && conta(h, /<CARD /g) === 2,
     'um clique recolhe so o grupo clicado');
  ok(/26 pt/.test(h), 'recolhido, o cabecalho ainda diz quantos pontos ha dentro');
  ok(!/aria-expanded="false"/.test(M.relAgrupadoHTML(_d.andamento, 'andamento')),
     'e o mesmo sistema no outro bloco continua aberto');

  /* O ESTADO SOBREVIVE AO RE-RENDER. E o ponto da invariante: o bloco e redesenhado
     no polling, e guardar "esta aberto" no DOM faria tudo reabrir sozinho. */
  ok(conta(M.relAgrupadoHTML(_d.entregues, 'entregues'), /aria-expanded="false"/g) === 1,
     'e o recolhido segue recolhido no render seguinte');
  M.relRecolher('entregues|AXCred - Cadastro');
  ok(conta(blocos['rel-entregues'].innerHTML, /<CARD /g) === 5, 'clicar de novo reabre');

  // Recolher/abrir todos: com quinze sistemas, quinze cliques nao servem.
  M.relRecolherTodos('entregues', true);
  h = blocos['rel-entregues'].innerHTML;
  ok(conta(h, /aria-expanded="false"/g) === 3 && !/<CARD /.test(h) && /Abrir todos/.test(h),
     'recolher todos fecha os tres e a barra passa a oferecer abrir');
  M.relRecolherTodos('entregues', false);
  ok(conta(blocos['rel-entregues'].innerHTML, /<CARD /g) === 5, 'e abrir todos devolve tudo');

  /* O NOME DO SISTEMA VAI PARA DENTRO DE UM onclick, e `esc` nao escapa apostrofo.
     "AXCred - O'Brien" fecharia a string e o clique morreria com erro de sintaxe —
     invisivel, porque o console de quem usa a ferramenta ninguem le. Aqui o
     argumento e AVALIADO como o navegador faria. */
  h = M.relAgrupadoHTML(_d.entregues, 'entregues');
  const re = new RegExp('onclick="relRecolher\\((\'(?:[^\'\\\\]|\\\\.)*\')\\)"', 'g');
  const args = [];
  let mt;
  while ((mt = re.exec(h)) !== null) args.push(mt[1]);
  ok(args.length === 3, 'cada cabecalho tem um onclick bem formado', 'achei ' + args.length);
  let chaves = [];
  try { chaves = args.map(a => eval(a)); } catch (e) { chaves = null; }
  ok(!!chaves && chaves.every(k => typeof k === 'string' && k.indexOf('entregues|') === 0),
     'e o argumento avalia sem erro, mesmo com apostrofo no nome do sistema');
  ok(!!chaves && chaves.indexOf("entregues|AXCred - O'Brien") >= 0,
     'com a chave EXATA que o estado usa — escapar errado recolheria o grupo errado');
})();

/* O PISO DE PONTUACAO: demanda que chega a Planejado sem tamanho recebe 3.
   Havia 52 demandas alocadas sem pontuacao — 904 pontos invisiveis no cruzamento
   planejado x entregue. O buraco nao era de calculo, era de cadastro, e se repetia
   toda semana. Esta invariante EXECUTA `normalizaEstados`. */
sec('O piso de pontuacao');
(() => {
  const konst = (nome) => {
    const m = W.match(new RegExp('const ' + nome + ' = ([\\s\\S]*?);\\n'));
    // Entre parenteses: `eval('{a:1}')` le a chave como bloco, e nao como objeto.
    return m ? eval('(' + m[1] + ')') : null;
  };
  const piso = konst('PONTOS_PADRAO');
  ok(piso === 3, 'o piso e 3 — a carta que o time usa para o que sai em duas horas', String(piso));
  const c = corpo(W, 'function normalizaEstados(');
  ok(!!c, 'existe o normalizador');
  if (!c || piso !== 3) return;
  let N;
  try {
    N = new Function('ETAPAS_ALOCADA', 'PONTOS_PADRAO', 'STATUS_PARA_SP', 'SP_PARA_STATUS',
      c + '\n; return normalizaEstados;'
    )(konst('ETAPAS_ALOCADA'), piso, konst('STATUS_PARA_SP'), konst('SP_PARA_STATUS'));
  } catch (e) { ok(false, 'o normalizador roda isolado', e.message); return; }

  const passa = (m) => { N({ melhorias: [{ id: 'x', ...m }] }); return arguments; };
  const pt = (m) => { const d = { melhorias: [{ id: 'x', ...m }] }; N(d); return d.melhorias[0]; };

  /* SO A PARTIR DE PLANEJADO. E na reuniao de Planning que o tamanho e decidido, e
     carimbar 3 antes dela tiraria da mesa justamente o que ela existe para fazer —
     o PM/PO foi explicito: "o que esta em planning para tras nao tem pontos e nao
     deve ter mesmo". */
  ['backlog', 'levantar_req', 'planning'].forEach(sp => {
    ok(!(Number(pt({ status_planejamento: sp }).poker_pontos) > 0),
       sp + ' fica sem ponto — o tamanho e decidido no Planning');
  });
  ['planejado', 'em_andamento', 'validacao', 'concluido'].forEach(sp => {
    ok(pt({ status_planejamento: sp }).poker_pontos === 3, sp + ' sem ponto recebe o piso');
  });

  /* O QUE JA TEM PONTO NAO E TOCADO. Foi condicao explicita do PM/PO: "nao quero
     que mude o que ja temos pontuado". */
  const baralho = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 100];
  ok(baralho.every(v => pt({ status_planejamento: 'concluido', poker_pontos: v }).poker_pontos === v),
     'nenhuma das onze cartas do baralho e sobrescrita');
  ok(pt({ status_planejamento: 'planejado', poker_pontos: '13' }).poker_pontos === '13',
     'e ponto gravado como texto ("13") tambem sobrevive — a tela grava assim em alguns caminhos');
  // Zero e ausencia de tamanho, e nao tamanho zero.
  ok(pt({ status_planejamento: 'planejado', poker_pontos: 0 }).poker_pontos === 3,
     'zero conta como sem ponto e recebe o piso');

  /* DEMANDA APOSENTADA NAO RECEBE NADA. `oculto` e `mesclado_em` sao as duas formas
     de retirar uma demanda de circulacao, e o resto da ferramenta as ignora pelo
     mesmo par. Sem esta guarda a AX-270 — criada por engano num teste de API e
     ocultada — ganhava 3 pontos. */
  ok(!(Number(pt({ status_planejamento: 'concluido', oculto: true }).poker_pontos) > 0),
     'demanda oculta nao recebe o piso');
  ok(!(Number(pt({ status_planejamento: 'concluido', mesclado_em: '2026-08-01' }).poker_pontos) > 0),
     'e demanda mesclada tambem nao');

  /* O CARIMBO DO PLANEJADO segue as suas proprias regras, e o piso nao as afrouxa:
     retroativa recebe ponto e NAO recebe carimbo (ela nunca teve plano), e o
     carimbo nasce uma vez so. */
  const retro = pt({ status_planejamento: 'concluido', poker_retroativo: true });
  ok(retro.poker_pontos === 3 && !(Number(retro.pontos_planejados) > 0),
     'retroativa recebe o ponto mas nao o carimbo de planejado — ela nunca teve plano');
  {
    const m = { id: 'x', status_planejamento: 'planejado' };
    N({ melhorias: [m] });
    ok(m.pontos_planejados === 3, 'o carimbo nasce com o piso quando o piso e o valor');
    m.poker_pontos = 55;
    N({ melhorias: [m] });
    ok(m.pontos_planejados === 3,
       'e repontuar depois nao reescreve o carimbo — o plano era 3 na alocacao');
  }
})();

/* A ETAPA QUE O DEV MOVE SAO DUAS, e a trava do servidor RODA aqui.
   Murillo levou a AX-150 de levantar_req para planning, dali para planejado e de
   volta para planning — tres movimentos do planejamento, feitos pelo painel do
   dev. Um card que reaparece na fila do Planning sozinho muda a pauta de terca sem
   ninguem ter decidido isso. */
sec('A etapa que o dev pode mover');
(() => {
  const mLista = W.match(/const ETAPAS_QUE_O_DEV_MOVE = (\[[^\]]*\]);/);
  ok(!!mLista, 'o worker declara as etapas que o dev move');
  const mTela = DEV.match(/const ETAPAS_DO_DEV = (\[[^\]]*\]);/);
  ok(!!mTela, 'e a tela declara a mesma coisa');
  if (!mLista || !mTela) return;
  let srv, tela;
  try { srv = eval(mLista[1]); tela = eval(mTela[1]); } catch (e) { ok(false, 'as listas avaliam', e.message); return; }
  ok(JSON.stringify(srv) === JSON.stringify(['em_andamento', 'validacao']),
     'e sao Em Andamento e Validacao — comecar e entregar', JSON.stringify(srv));
  /* AS DUAS LISTAS TEM DE SER IGUAIS. Divergentes, a tela oferece o que o servidor
     reverte (o dev clica e nada acontece, sem explicacao) ou o servidor aceita o
     que a tela esconde (a trava existe no papel). */
  ok(JSON.stringify(srv) === JSON.stringify(tela),
     'e a tela e o servidor concordam', JSON.stringify(tela));

  const c = corpo(W, 'function travaEtapaDoDev(');
  ok(!!c, 'existe a trava no servidor');
  if (!c) return;
  let trava;
  try {
    trava = new Function('ETAPAS_QUE_O_DEV_MOVE', c + '\n; return travaEtapaDoDev;')(srv);
  } catch (e) { ok(false, 'a trava roda isolada', e.message); return; }

  const caso = (de, para, extra) => {
    const servidor = { melhorias: [{ id: 'x', codigo: 'AX-150', status_planejamento: de, status: 'estimada' }] };
    const recebido = { melhorias: [{ id: 'x', codigo: 'AX-150', status_planejamento: para,
                                     status: 'iniciada', ...(extra || {}) }] };
    return { rev: trava(recebido, servidor), fim: recebido.melhorias[0] };
  };

  // Os tres movimentos reais da AX-150.
  [['levantar_req', 'planning'], ['planning', 'planejado'], ['planejado', 'planning']]
    .forEach(([de, para]) => {
      const r = caso(de, para);
      ok(r.rev.length === 1 && r.fim.status_planejamento === de,
         de + ' -> ' + para + ' volta ao valor do servidor');
    });
  /* O `status` ACOMPANHA a etapa revertida. Sem isso sobra demanda com status
     'iniciada' parada em Planning, e todo relatorio que cruza os dois campos passa
     a discordar de si mesmo. */
  ok(caso('planejado', 'planning').fim.status === 'estimada',
     'e o `status` volta junto — os dois campos nao se separam');

  // A etapa VAZIA: o defeito que atingiu AX-096, AX-127 e AX-211 na base.
  ok(caso('em_andamento', '').fim.status_planejamento === 'em_andamento',
     'gravar etapa vazia e revertido — a demanda nao desaparece das colunas');

  // O que nao pode ser quebrado: os 118 movimentos legitimos da base.
  ok(caso('planejado', 'em_andamento').rev.length === 0, 'comecar passa (42x na base)');
  ok(caso('em_andamento', 'validacao').rev.length === 0, 'entregar passa (55x na base)');
  ok(caso('planejado', 'validacao').rev.length === 0, 'entregar direto do plano passa (21x na base)');
  // Demanda nova (o dev abre demanda pelo painel) nao tem transicao a policiar.
  {
    const recebido = { melhorias: [{ id: 'novo', status_planejamento: 'backlog' }] };
    ok(trava(recebido, { melhorias: [] }).length === 0 &&
       recebido.melhorias[0].status_planejamento === 'backlog',
       'demanda que o servidor nao conhece passa intacta');
  }
  // Pausar e CAMPO, nao etapa: a trava nao pode tocar nisso.
  {
    const r = caso('em_andamento', 'em_andamento', { pausado_em: '2026-08-21' });
    ok(r.rev.length === 0 && r.fim.pausado_em === '2026-08-21', 'pausar passa — pausa nao e etapa');
  }
  // Salvar texto com a demanda parada em Planning nao pode ser recusado.
  {
    const r = caso('planning', 'planning', { implementacao: 'texto novo' });
    ok(r.rev.length === 0 && r.fim.implementacao === 'texto novo',
       'salvar texto sem mexer na etapa passa, mesmo em Planning');
  }

  /* SO PARA O PAPEL `dev`. analista e admin entram pela mesma rota (`ehDev` aceita
     os tres) e para eles mover para Planning e trabalho legitimo. */
  ok(/\(await papelAtual\(\)\) === 'dev'\s*\n?\s*\? travaEtapaDoDev/.test(W) ||
     /papelAtual\(\)\) === 'dev'[\s\S]{0,80}travaEtapaDoDev/.test(W),
     'e a trava vale so para o papel dev — analista e admin decidem planejamento');
  ok(/etapas_revertidas/.test(W),
     'e a resposta diz o que foi revertido: reverter calado seria descoberto no F5');
})();

/* A TELA OBEDECE A MESMA REGRA EM TODOS OS CAMINHOS. Foi um caminho de tela — o
   arraste no Kanban — que deixou a AX-179 chegar em Validacao sem horas. */
(() => {
  // A lista da tela, relida aqui: `tela` do bloco acima nao atravessa o escopo.
  const tela = eval((DEV.match(/const ETAPAS_DO_DEV = (\[[^\]]*\]);/) || [, "[]"])[1]);
  const sel = DEV.slice(DEV.indexOf('<select id="ms-status"'),
                        DEV.indexOf('</select>', DEV.indexOf('<select id="ms-status"')));
  const vals = [...sel.matchAll(/value="([^"]*)"/g)].map(m => m[1]);
  ok(JSON.stringify(vals) === JSON.stringify(['em_andamento', 'validacao']),
     'o select do card oferece so as duas etapas do dev', JSON.stringify(vals));

  const salvar = corpo(DEV, 'async function saveStatus(');
  ok(/ETAPAS_DO_DEV\.includes\(escolhido\)/.test(salvar),
     'e saveStatus confere a etapa, para o console nao ser a proxima porta');
  ok(/escolhido \|\| String\(atual\?\.status_planejamento/.test(salvar),
     'e "manter" grava a etapa CRUA, nao a derivada de getStatusKey');

  /* O ARRASTE E EXECUTADO, e nao lido. A versao anterior desta invariante procurava
     `ETAPAS_DO_DEV.includes(colKey)` no texto de `onDrop` — e passava com o teste
     desativado por um `false &&` na frente. Verificado por sabotagem. */
  const drop = corpo(DEV, 'function onDrop(');
  const COLUMNS = [
    { key: 'planning', maps: ['planning'] },
    { key: 'planejado', maps: ['backlog', 'levantar_req', 'planejado'] },
    { key: 'em_andamento', maps: ['em_andamento'] },
    { key: 'validacao', maps: ['validacao'] },
    { key: 'concluido', maps: ['concluido'] },
  ];
  const solta = (etapaAtual, coluna) => {
    const feito = { moveu: null, modal: null, recusou: null };
    const tarefas = [];
    const amb = {
      dragId: 'x',
      ETAPAS_DO_DEV: tela,
      COLUNAS_BLOQUEADAS_MSG: {},
      ETAPAS_EXIGEM_ENTREGA: ['validacao', 'concluido'],
      COLUMNS,
      state: { melhorias: [{ id: 'x', codigo: 'AX-150', status_planejamento: etapaAtual }] },
      getStatusKey: (m) => m.status_planejamento,
      getDeps: () => [],
      checkDepBlock: () => false,
      toast: (t) => { feito.recusou = String(t); },
      openStatusModal: (id, k) => { feito.modal = k; },
      updateStatus: (id, k) => { feito.moveu = k; },
      setTimeout: (fn) => tarefas.push(fn),
      document: { querySelectorAll: () => [], getElementById: () => null },
    };
    const nomes = Object.keys(amb);
    // `dragId` e reatribuido dentro de onDrop, entao entra como `let`, e nao como
    // parametro (parametro tambem funcionaria, mas o retorno precisa ler o valor).
    const fn = new Function(...nomes.filter(n => n !== 'dragId'),
      'let dragId = "x";\n' + drop + '\n; return onDrop;'
    )(...nomes.filter(n => n !== 'dragId').map(n => amb[n]));
    fn({ preventDefault() {} }, coluna);
    tarefas.forEach(t => t());
    return feito;
  };

  // As tres colunas que o dev nao move: nada acontece, e ele e avisado.
  ['planning', 'planejado', 'concluido'].forEach(col => {
    const r = solta('em_andamento', col);
    ok(r.moveu === null && r.modal === null && !!r.recusou,
       'soltar o card em ' + col + ' nao move nada, e avisa por que',
       r.moveu || r.modal || r.recusou || '');
  });
  // E as duas que ele move seguem movendo.
  {
    const r = solta('planejado', 'em_andamento');
    ok(r.moveu === 'em_andamento' && !r.recusou, 'soltar em Em Andamento move');
    const e = solta('em_andamento', 'validacao');
    ok(e.modal === 'validacao' && !e.recusou,
       'e soltar em Validacao abre o pedido de horas e texto');
  }

  const over = corpo(DEV, 'function onDragOver(');
  ok(/dropEffect = podeSoltar/.test(over),
     'a coluna proibida recusa o cursor durante o arraste, e nao depois do gesto');

  /* "MANTER ONDE ESTA" TAMBEM E EXECUTADO. A versao anterior procurava a palavra
     `data-manter` no texto de `openStatusModal` — e trocar o atributo por um erro de
     digitacao passava calado, porque a palavra certa seguia noutra linha. Foi para
     isto que `msSelectEtapa` saiu de dentro do modal. */
  const cSel = corpo(DEV, 'function msSelectEtapa(');
  ok(!!cSel, 'a montagem do select de etapa e uma funcao propria, executavel');
  if (cSel) {
    let doc;
    const selDouble = () => {
      const ops = [{ value: 'em_andamento' }, { value: 'validacao' }];
      return {
        options: ops, value: '', get firstChild() { return ops[0]; },
        querySelector: (q) => ops.find(o => o._manter) || null,
        insertBefore: (o) => { ops.unshift(o); doc._dono = ops; },
      };
    };
    // O dobro do <option> precisa de `remove()`: e por ele que reabrir o card nao
    // acumula duas opcoes neutras, e sem isso o dobro esconderia a chamada real.
    doc = {
      _dono: null,
      createElement: () => {
        const o = { value: '', textContent: '',
                    setAttribute: (k) => { if (k === 'data-manter') o._manter = true; },
                    remove: () => { const l = doc._dono; if (!l) return;
                                    const i = l.indexOf(o); if (i >= 0) l.splice(i, 1); } };
        return o;
      },
    };
    let F;
    try {
      F = new Function('COLUMNS', 'ETAPAS_DO_DEV', 'STATUS_LABELS', 'getStatusKey', 'document',
        cSel + '\n; return msSelectEtapa;'
      )(COLUMNS, tela, { planejado: 'Planejado', planning: 'Planning' },
        m => m.status_planejamento, doc);
    } catch (e) { ok(false, 'msSelectEtapa roda isolada', e.message); }
    if (F) {
      // Demanda em Planejado: sem "manter", salvar um texto a moveria para Em Andamento.
      const s1 = selDouble();
      const v1 = F(s1, { status_planejamento: 'planejado' });
      ok(v1 === '', 'demanda em Planejado abre o card em "manter", e nao em Em Andamento', String(v1));
      ok(s1.options[0]._manter === true && /Manter em Planejado/.test(s1.options[0].textContent),
         'e a opcao neutra existe e diz onde a demanda fica', s1.options[0].textContent);
      // Demanda em Andamento: nada de opcao neutra, e o select mostra onde ela esta.
      const s2 = selDouble();
      const v2 = F(s2, { status_planejamento: 'em_andamento' });
      ok(v2 === 'em_andamento' && s2.options.length === 2,
         'demanda em Em Andamento abre nela mesma, sem opcao neutra', String(v2));
      /* Um `preselect` que nao existe na lista NAO PODE ESVAZIAR O SELECT: era assim
         que a etapa vazia era gravada, e a demanda desaparecia de todas as colunas
         (AX-096, AX-127, AX-211). */
      const s3 = selDouble();
      const v3 = F(s3, { status_planejamento: 'em_andamento' }, 'concluido');
      ok(v3 === 'em_andamento',
         'preselect inexistente ("concluido") nao esvazia o select', String(v3));
      // E chamar duas vezes nao acumula duas opcoes neutras.
      const s4 = selDouble();
      F(s4, { status_planejamento: 'planejado' });
      F(s4, { status_planejamento: 'planejado' });
      ok(s4.options.filter(o => o._manter).length === 1,
         'reabrir o card nao acumula opcoes "manter"');
    }
  }
})();

let erroW = null;
try { new Function(W.replace(/^export default/m, 'const _x =')); } catch (e) { erroW = e.message; }
ok(!erroW, 'worker.js sem erro de sintaxe', erroW || '');

let erroPz = null;
try { new Function(PRZ); } catch (e) { erroPz = e.message; }
ok(!erroPz, 'prazo.js sem erro de sintaxe', erroPz || '');

let erroP = null;
try { new Function(PIPE); } catch (e) { erroP = e.message; }
ok(!erroP, 'pipelines.js sem erro de sintaxe', erroP || '');

console.log('\n' + (falhas ? falhas + ' INVARIANTE(S) VIOLADA(S)' : 'todas as invariantes de pe'));
process.exit(falhas ? 1 : 0);
