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
// semantica e outra: dentro do proprio helper e no quem-sou, que REPORTA o papel.
const diretos = (W.match(/const ident\w* = await identifica\(env, body\);/g) || []).length;
ok(diretos <= 2, 'identifica chamado direto apenas onde a semantica difere',
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
  const semHash = (src.match(/src="(tema\.js|anexo-cola\.js)"/g) || [])
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

let erroW = null;
try { new Function(W.replace(/^export default/m, 'const _x =')); } catch (e) { erroW = e.message; }
ok(!erroW, 'worker.js sem erro de sintaxe', erroW || '');

console.log('\n' + (falhas ? falhas + ' INVARIANTE(S) VIOLADA(S)' : 'todas as invariantes de pe'));
process.exit(falhas ? 1 : 0);
