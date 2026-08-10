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
const diretos = (W.match(/const ident\w* = await identifica\(env, body\);/g) || []).length;
ok(diretos <= 3, 'identifica chamado direto apenas onde a semantica difere',
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
ok(/nome_demandas[\s\S]{0,400}?normNome\(n\) === normNome\(a\)/.test(W),
   'com o campo preenchido a comparacao e EXATA, nao por prefixo');
// A heuristica continua para quem nao declarou: ninguem fica pior do que estava.
const dono = corpo(W, 'const meuDono = m => {');
ok(!!dono && /mesmaPessoa\(n, eu\)/.test(dono),
   'sem o campo, cai na heuristica antiga (ninguem perde acesso)');
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
sec('Modelo de descricao: um arquivo, tres telas, e cobranca de verdade');

const MODELO = lerTela('modelo-descricao.js');
// Um arquivo so. Tres copias do modelo divergiriam na primeira mexida, e o padrao
// que ele existe para criar deixaria de existir.
for (const [nome, src] of [['admin', ADMIN], ['gantt', GANTT], ['dev', DEV]]) {
  ok(/modelo-descricao\.js\?v=/.test(src), nome + ' carrega o modelo compartilhado');
  ok(!/OBJETIVO DA ALTERA/.test(src), nome + ' nao tem copia do texto do modelo');
  ok(/validaModeloDescricao\(/.test(src), nome + ' valida antes de gravar');
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
     'apagar as orientacoes sem escrever nada segue recusado');
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
     'texto livre de demanda antiga continua salvando');
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
ok(/falta\.join\(', '\)/.test(MODELO), 'a recusa nomeia as secoes que faltam');

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
  const semHash = (src.match(/src="(tema\.js|anexo-cola\.js|modelo-descricao\.js|links-github\.js|senha\.js|dialogo\.js)"/g) || [])
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

let erroW = null;
try { new Function(W.replace(/^export default/m, 'const _x =')); } catch (e) { erroW = e.message; }
ok(!erroW, 'worker.js sem erro de sintaxe', erroW || '');

console.log('\n' + (falhas ? falhas + ' INVARIANTE(S) VIOLADA(S)' : 'todas as invariantes de pe'));
process.exit(falhas ? 1 : 0);
