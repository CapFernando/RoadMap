// ─────────────────────────────────────────────────────────────────────────
// Cloudflare Worker — RoadMap · Audax
//
// Guarda como SECRETS (nunca chegam ao navegador):
//   • GH_TOKEN     → token do GitHub (grava no repositório)
//   • ADMIN_SENHA  → senha do Admin (valida login e publicação)
//   • VIEW_SENHA   → (opcional) senha de leitura; criar ATIVA a trava
//   • VIEW_CHAVE   → (opcional) chave do Link de Visualização
//
// Variável opcional:
//   • DATA_REPO    → repositório do JSON; ausente = 'RoadMap' (o atual)
//
// Ações (POST JSON):
//   • { action:'dados' }                  → le o JSON fresco (sem cache de CDN)
//   • { action:'auth', senha }            → valida a senha (login do Admin)
//   • { action:'publish', senha, data }   → grava o estado completo (Admin)
//   • { action:'dev-publish', senha, data } → grava o estado completo (Painel Dev)
//   • { action:'poker-*', ... }           → planning poker (D1: binding POKER_DB)
//        poker-estado leva `participante` como sinal de vida; poker-sair remove
//   • { melhoria, novosTemas }            → sugestão pública (dash) — só adiciona no Backlog
// ─────────────────────────────────────────────────────────────────────────

const REPO_OWNER = 'CapFernando';
// Repositorio DO DADO. Fica separado do repositorio do site de proposito: o
// GitHub Pages publica tudo que esta no repositorio do site, entao enquanto o
// JSON morar la ele fica acessivel como arquivo estatico, mesmo com o
// repositorio privado. Mover o dado para um repositorio privado proprio fecha
// essa porta sem migrar hospedagem.
//
// Enquanto env.DATA_REPO nao existir, continua no repositorio atual — a virada
// e configuracao, nao deploy.
const REPO_NAME_PADRAO = 'RoadMap';
const FILE_PATH  = 'data/melhorias.json';
const ALLOWED_ORIGIN = 'https://capfernando.github.io';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
// Guardrail de gravacao: recusa payload vazio ou drasticamente menor que o
// arquivo atual. Protege contra abuso e contra bug — nenhuma operacao normal
// remove metade da base de uma vez. Usa file.size, que ja vem da metadata.
function gravacaoSuspeita(data, tamanhoAtual) {
  if (!Array.isArray(data.melhorias) || data.melhorias.length === 0) {
    return 'Gravacao recusada: nenhuma melhoria no payload.';
  }
  const novo = JSON.stringify(data).length;
  if (tamanhoAtual > 100000 && novo < tamanhoAtual * 0.5) {
    return 'Gravacao recusada por seguranca: o conteudo enviado tem menos da metade do tamanho atual.';
  }
  return null;
}

// Controle de concorrencia. O cliente informa em `base` o `atualizado_em` que ele
// leu antes de editar. Se o arquivo no servidor ja avancou, a gravacao e recusada
// com 409 e o cliente refaz o merge sobre a versao nova. Sem isto o ultimo a
// gravar vencia em silencio, e era assim que movimentacoes desapareciam: uma aba
// aberta minutos antes publicava seu estado antigo por cima do de todo mundo.
//
// `base` ausente tambem e recusado: pagina antiga em cache e justamente o caso
// perigoso. O erro pede recarregar, em vez de deixar sobrescrever.
async function conflito(gh, body, headers) {
  const rawRes = await gh('contents/' + FILE_PATH + '?raw=' + Date.now(),
                          { headers: { Accept: 'application/vnd.github.raw' } });
  if (!rawRes.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
  let atual = null;
  try { atual = JSON.parse(await rawRes.text()).atualizado_em || null; } catch (_) {}
  if (!body.base) {
    return json({ error: 'recarregue', detail: 'Esta aba esta desatualizada. Recarregue a pagina (F5) e refaca a acao.', atual }, 409, headers);
  }
  if (atual && body.base !== atual) {
    return json({ error: 'conflito', detail: 'Outra tela publicou depois que esta carregou.', atual }, 409, headers);
  }
  return null;
}

// Texto vindo de fora nao pode carregar marcacao. O formulario publico do dash
// nao exige senha: qualquer pessoa na internet consegue gravar uma demanda, e o
// titulo dela e renderizado nas telas internas. Com "<img src=x onerror=...>" no
// titulo, o script rodava no navegador do Admin — onde a senha fica na
// sessionStorage. Testado e confirmado antes desta correcao.
//
// A limpeza acontece AQUI, na entrada, alem do escape nas telas: assim uma tela
// nova (ou uma que eu tenha deixado passar) nao reabre o buraco.
function limpaTexto(v, max) {
  if (v == null) return '';
  // Remove so o que e tag de verdade (`<` seguido de letra, `/` ou `!`). Um `<`
  // solto e conteudo legitimo — "custo < 100 e prazo > 30" nao pode perder texto.
  // O escape nas telas cuida do caractere solto; aqui o alvo e a marcacao.
  return String(v)
    .replace(/<\/?[a-zA-Z!?][^>]*>?/g, '')
    .trim()
    .slice(0, max || 500);
}
// Aplica em profundidade: o discovery e um objeto com listas de textos livres.
// Anexo do publico: nome limpo, tipo restrito e `dados` apenas como data: URL.
// Sem isto o campo aceitava qualquer string — inclusive "javascript:..." que o
// painel abriria em window.open ao clicar no anexo.
function sanitizaAnexos(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.slice(0, 10).map(a => {
    if (!a) return null;
    const base = {
      nome: limpaTexto(a.nome, 160) || 'anexo',
      tipo: limpaTexto(a.tipo, 100),
      tamanho: Number(a.tamanho) || 0,
    };
    // Formato NOVO: referencia ao objeto no R2. So aceita chave no formato que a
    // rota de upload gera — nada de caminho arbitrario vindo do cliente.
    if (typeof a.chave === 'string' && /^a\/[a-z0-9-]+$/.test(a.chave)) {
      return { ...base, chave: a.chave };
    }
    // Formato ANTIGO: base64 embutido. Continua aceito para nao quebrar anexo que
    // ja existe, mas novo upload nao passa mais por aqui.
    if (typeof a.dados === 'string'
        && /^data:[a-zA-Z0-9.+/-]+;base64,[A-Za-z0-9+/=\s]*$/.test(a.dados)
        && a.dados.length <= 3 * 1024 * 1024) {
      return { ...base, dados: a.dados };
    }
    return null;
  }).filter(Boolean);
}

function limpaProfundo(v, prof) {
  if (prof > 6) return null;
  if (typeof v === 'string') return limpaTexto(v, 4000);
  if (Array.isArray(v)) return v.slice(0, 200).map(x => limpaProfundo(x, (prof || 0) + 1));
  if (v && typeof v === 'object') {
    const o = {};
    Object.keys(v).slice(0, 60).forEach(k => { o[limpaTexto(k, 60)] = limpaProfundo(v[k], (prof || 0) + 1); });
    return o;
  }
  if (typeof v === 'number' || typeof v === 'boolean' || v === null) return v;
  return null;
}

// Limite de requisicoes por IP e por acao, em janela de 1 minuto (D1).
// Alvo principal: forca bruta na senha do Admin. O login nao tinha nenhum freio —
// era possivel testar senha sem limite, e a senha da acesso de gravacao a base
// inteira. Tambem contem abuso do formulario publico, que grava sem autenticacao.
//
// Falha ABERTA de proposito: se o D1 estiver indisponivel, a requisicao passa. Um
// banco fora do ar nao pode derrubar o sistema todo; o freio e defesa contra
// abuso, nao o controle de acesso (esse e a senha).
const LIMITES = {
  'auth':           { max: 10,  janela: 60 },   // login: cobre erro de digitacao, mata brute force
  'publish':        { max: 40,  janela: 60 },
  'dev-publish':    { max: 40,  janela: 60 },
  'poker-abrir':    { max: 10,  janela: 60 },
  'poker-entrar':   { max: 20,  janela: 60 },
  'poker-votar':    { max: 60,  janela: 60 },
  'poker-gravar':   { max: 30,  janela: 60 },
  'poker-fila':     { max: 30,  janela: 60 },
  'temas-publicos': { max: 20,  janela: 60 },
  'anexo-subir':    { max: 20,  janela: 60 },
  'anexo-baixar':   { max: 60,  janela: 60 },
  'login':          { max: 10,  janela: 60 },   // mesmo freio da senha compartilhada
  'cadastro':       { max: 5,   janela: 60 },   // criar conta e raro; 5/min corta script
  'recuperar':      { max: 5,   janela: 60 },
  'usuarios':       { max: 40,  janela: 60 },
  'quem-sou':       { max: 60,  janela: 60 },
  'demanda-nova':   { max: 20,  janela: 60 },   // abertura por HTTP: 20/min por IP
  'projeto-novo':   { max: 10,  janela: 60 },
  'poker-editar':      { max: 30, janela: 60 },
  'poker-negar':       { max: 20, janela: 60 },
  'demandas-minhas':   { max: 60, janela: 60 },
  'demanda-consultar': { max: 60, janela: 60 },
  'demanda-atualizar': { max: 30, janela: 60 },
  'demanda-entregar':  { max: 20, janela: 60 },
  'sugestao':       { max: 6,   janela: 60 },   // formulario publico do dash
  // Leitura da base. Os paineis fazem polling folgado (index 60s, admin/gantt
  // 30s), entao ~4/min por pessoa cobre uso normal com sobra. O limite existe
  // porque `dados` devolve a base INTEIRA (1,7 MB): sem freio, um script coleta
  // tudo em loop. Nao substitui a trava de leitura (VIEW_SENHA) — apenas encarece
  // a coleta em massa enquanto ela nao estiver ligada.
  'dados':          { max: 40,  janela: 60 },
  // poker-estado fica de fora: o painel faz polling a cada 1,5s (~40/min por pessoa)
};

async function limiteExcedido(env, ip, acao) {
  const cfg = LIMITES[acao];
  if (!cfg || !env.POKER_DB) return false;
  try {
    const db = env.POKER_DB;
    await db.prepare('CREATE TABLE IF NOT EXISTS rate_limit (chave TEXT PRIMARY KEY, expira INTEGER NOT NULL, n INTEGER NOT NULL)').run();
    const agora = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(agora / cfg.janela);
    const chave = acao + '|' + ip + '|' + bucket;
    await db.prepare('INSERT INTO rate_limit (chave, expira, n) VALUES (?,?,1) ON CONFLICT(chave) DO UPDATE SET n = n + 1')
      .bind(chave, agora + cfg.janela * 2).run();
    const row = await db.prepare('SELECT n FROM rate_limit WHERE chave = ?').bind(chave).first();
    // faxina barata: 1 em ~50 requisicoes limpa o que expirou
    if (Math.random() < 0.02) await db.prepare('DELETE FROM rate_limit WHERE expira < ?').bind(agora).run();
    return !!row && row.n > cfg.max;
  } catch (_) {
    return false;
  }
}

// A mensagem de deboche ("parabens pela tentativa de hackear") foi REMOVIDA.
// A ideia era dissuadir quem sondasse o Worker de fora, mas quem mais viu foi
// gente do time: uma falha de credencial ao anexar imagem cai na mesma resposta,
// e a pessoa levou uma acusacao de invasao tentando fazer o trabalho dela.
// Provocar quem esta de fora nao vale ofender quem esta de dentro — a seguranca
// real sempre esteve na senha, na trava de leitura e nos limites por IP, nao no
// texto. As tentativas continuam sendo contadas em `tentativas` para
// acompanhamento; o que saiu foi so o texto devolvido ao cliente.

// Contador simples de tentativas por IP, para a mensagem citar o numero.
async function contaTentativa(env, ip, acao) {
  if (!env.POKER_DB) return 0;
  try {
    const db = env.POKER_DB;
    await db.prepare('CREATE TABLE IF NOT EXISTS tentativas (chave TEXT PRIMARY KEY, n INTEGER NOT NULL, visto TEXT NOT NULL)').run();
    const chave = ip + '|' + acao;
    await db.prepare('INSERT INTO tentativas (chave, n, visto) VALUES (?,1,?) ON CONFLICT(chave) DO UPDATE SET n = n + 1, visto = ?')
      .bind(chave, new Date().toISOString(), new Date().toISOString()).run();
    const r = await db.prepare('SELECT n FROM tentativas WHERE chave = ?').bind(chave).first();
    return (r && r.n) || 0;
  } catch (_) { return 0; }
}

// Verifica o token do Turnstile contra a Cloudflare. Ativacao gradual, como a
// trava de leitura: enquanto TURNSTILE_SECRET nao existir (ou estiver em branco),
// o envio continua funcionando como hoje. Criar o secret liga a exigencia na hora.
//
// O `trim` nao e decorativo: um secret gravado em branco no prompt do wrangler
// chega como string vazia e desligaria a protecao em silencio.
async function turnstileOk(env, token, ip) {
  const secret = String(env.TURNSTILE_SECRET || '').trim();
  if (!secret) return { ok: true, motivo: 'inativo' };
  if (!token) return { ok: false, motivo: 'sem_token' };
  try {
    const fd = new FormData();
    fd.append('secret', secret);
    fd.append('response', token);
    if (ip) fd.append('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: fd });
    const j = await r.json();
    return { ok: !!j.success, motivo: (j['error-codes'] || []).join(',') || 'recusado' };
  } catch (e) {
    // Falha de rede na verificacao: NAO libera. Este e o unico caminho de
    // gravacao sem autenticacao — em caso de duvida, recusa.
    return { ok: false, motivo: 'falha_verificacao' };
  }
}


// ═══════════════════════════════════════════════════════════════════════
// CONTAS POR PESSOA (D1)
//
// Hoje o acesso e por senha compartilhada — admin, dev e leitura. Isso significa
// que ninguem sabe QUEM fez o que, e que a senha vai embora junto com quem sai da
// empresa. Aqui cada pessoa tem conta, senha propria e papel.
//
// Senha nunca em texto puro: PBKDF2-SHA256 com salt por usuario. Nao ha bcrypt ou
// argon2 nativos no runtime dos Workers; PBKDF2 com 150k iteracoes e o que da para
// fazer bem com a Web Crypto disponivel.
// ═══════════════════════════════════════════════════════════════════════
// O runtime dos Workers recusa PBKDF2 acima de 100k iteracoes (a chamada joga
// excecao, o que derrubava o login com 1101). 100k e o teto da plataforma.
const PBKDF2_ITER = 100000;
const SESSAO_H = 12;              // sessao vale 12h
// analista = Analista de Requisitos. Conduz o Planning Poker, edita e nega
// demandas. Fica ACIMA de dev na hierarquia (herda o que o dev faz) e ABAIXO de
// admin: publicar o estado inteiro, gerir contas e fechar projeto seguem
// exclusivos do PM/PO, e todo `temNivel(x, 'admin')` continua recusando analista.
const PAPEIS = ['consulta', 'dev', 'analista', 'admin'];
// So e-mail corporativo se cadastra. Qualquer endereco de fora e recusado.
const EMAIL_DOMINIO = '@audaxcapitalsa.com.br';
const NIVEL = { consulta: 1, dev: 2, analista: 3, admin: 4 };

// ALTER TABLE tolerante: a tabela usuario ja existe em producao, e CREATE TABLE
// IF NOT EXISTS nao acrescenta coluna. Se a coluna ja esta la, o erro e ignorado.
async function colunaSeFaltar(db, tabela, coluna, tipo) {
  try { await db.prepare('ALTER TABLE ' + tabela + ' ADD COLUMN ' + coluna + ' ' + tipo).run(); }
  catch (_) { /* ja existe */ }
}

// O login deixou de ser digitado por quem se cadastra: pedir "usuario" travava
// gente de verdade — "Joao.Lucas.A.C" tem maiuscula e ponto final e era recusado,
// com uma mensagem que so repetia a regra. Agora ele sai do e-mail e existe so
// por dentro; as pessoas entram com o e-mail, que elas ja sabem de cor.
function loginDoEmail(email) {
  const base = String(email).split('@')[0]
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9._-]/g, '.')
    .replace(/\.{2,}/g, '.').replace(/^\.+|\.+$/g, '')
    .slice(0, 20);
  return base || 'usuario';
}

async function loginLivre(db, base) {
  for (let i = 0; i < 50; i++) {
    const tent = i === 0 ? base : base + (i + 1);
    const j = await db.prepare('SELECT 1 FROM usuario WHERE login = ?').bind(tent).first();
    if (!j) return tent;
  }
  return base + '-' + crypto.randomUUID().slice(0, 6);
}

// Codigo AX-### por demanda. Atribuido AQUI e nao no navegador de proposito: o
// Worker e o unico ponto que serializa as gravacoes (controle de concorrencia por
// `base`), entao dois cards criados ao mesmo tempo nao podem receber o mesmo
// numero. No cliente, duas abas gerariam max+1 identico.
// Projetos seguem a mesma regra dos cards: EP-### atribuido pelo Worker, pelo
// mesmo motivo — so ele serializa gravacoes.

// ─── HISTORICO DE ALTERACOES ──────────────────────────────────────────
// Registrado AQUI, no Worker, e nao nas telas: e o unico ponto por onde toda
// gravacao passa. Nas telas seria opcional — bastaria uma rota nova, ou uma tela
// esquecida, para o registro ter buraco justamente onde alguem quisesse esconder
// algo.
//
// Existe por uma consequencia concreta: o dev passou a poder corrigir o texto da
// entrega enquanto o PM/PO analisa. Isso e necessario (o PM/PO pede detalhe), mas
// abre a porta para o texto mudar depois de lido. O historico nao impede — ele
// deixa rastro, que e o que resolve na pratica.
const HIST_CAMPOS = {
  status_planejamento: 'etapa',
  implementacao:       'o que foi implementado',
  horas_realizadas:    'horas',
  entrega:             'entrega',
  inicio:              'inicio',
  dev:                 'responsavel',
  poker_pontos:        'pontos',
  projeto_id:          'projeto',
  titulo:              'titulo',
  pausado_em:          'pausa',
  concluido_em:        'data de conclusao',
};
// Guarda por demanda. Sem teto, um card antigo acumularia centenas de entradas e
// o arquivo (164 KB hoje) cresceria sem controle — ele e lido inteiro em toda
// abertura de tela.
const HIST_MAX = 25;
const HIST_TEXTO = 180;   // texto longo entra cortado; o tamanho fica registrado

function histValor(v) {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v.length + ' item(ns)';
  const t = String(v);
  return t.length > HIST_TEXTO ? t.slice(0, HIST_TEXTO) + '…' : t;
}

// Compara o que chegou com o que esta gravado e anexa as diferencas. `quem` sai
// da conta autenticada; sem conta, fica o papel, que ja diz de onde veio.
function registraHistorico(recebido, servidor, quem, origem) {
  if (!recebido || !Array.isArray(recebido.melhorias)) return 0;
  const antigas = new Map((((servidor || {}).melhorias) || []).map(m => [m.id, m]));
  const agora = new Date().toISOString();
  let n = 0;
  for (const m of recebido.melhorias) {
    if (!m || !m.id) continue;
    const velha = antigas.get(m.id);
    if (!velha) continue;                 // demanda nova nao tem o que comparar
    const mudancas = [];
    for (const campo of Object.keys(HIST_CAMPOS)) {
      const de = velha[campo], para = m[campo];
      // vazio -> vazio nao e mudanca; zero E valor.
      const vazio = v => v === undefined || v === null || v === '' ||
                         (Array.isArray(v) && v.length === 0);
      if (vazio(de) && vazio(para)) continue;
      if (JSON.stringify(de) === JSON.stringify(para)) continue;
      mudancas.push({ campo, rotulo: HIST_CAMPOS[campo],
                      de: histValor(de), para: histValor(para),
                      // O tamanho denuncia texto cortado, para ninguem achar que
                      // a descricao inteira era aquilo.
                      de_tam: typeof de === 'string' ? de.length : undefined,
                      para_tam: typeof para === 'string' ? para.length : undefined });
    }
    // A base e SEMPRE o historico gravado no servidor, nunca o que veio no corpo.
    // Duas razoes:
    // 1) As telas montam a demanda por lista fechada de campos. `historico` nao
    //    estava nessas listas, entao salvar pela aba Dados chegava aqui sem ele e
    //    apagaria tudo — a mesma armadilha que ja aconteceu com pausa e grill.
    // 2) Se a base fosse o corpo, bastaria enviar `historico: []` para limpar o
    //    proprio rastro. Um registro que o auditado pode apagar nao serve.
    const anterior = Array.isArray(velha.historico) ? velha.historico : [];
    if (!mudancas.length) {
      // Nada mudou nesta demanda, mas devolve o historico ao objeto para o caso
      // de o cliente nao te-lo enviado.
      if (anterior.length) m.historico = anterior;
      continue;
    }
    const anexosAntes = ((velha.anexos || []).length), anexosDepois = ((m.anexos || []).length);
    const entrada = { em: agora, quem: quem || '(sem conta)', origem: origem || '',
                      mudancas };
    if (anexosAntes !== anexosDepois) entrada.anexos = anexosAntes + ' -> ' + anexosDepois;
    m.historico = anterior.concat([entrada]).slice(-HIST_MAX);
    n += mudancas.length;
  }
  return n;
}



// ─── EXIGENCIA DE PAPEL ───────────────────────────────────────────────
// Quatro rotas repetiam este trecho: chamar identifica, conferir o papel na mao e
// montar a resposta 403. E exatamente a regra que quebrou tres vezes nesta sessao
// — anexo, planejamento e planning poker —, sempre porque uma copia foi corrigida
// e as outras nao.
//
// Devolve { ident } quando passa, ou { recusa } com a resposta pronta. Quem chama
// nao decide mais o texto nem o status: um lugar erra ou acerta para todos.
async function exigePapel(env, body, papeis, headers) {
  const ident = await identifica(env, body);
  if (!ident || !papeis.includes(ident.papel)) {
    return { recusa: json({ error: 'sem_permissao',
      detail: 'Informe token de sessao ou a senha de ' +
              (papeis.includes('dev') ? 'dev' : 'admin') + '.' }, 403, headers) };
  }
  return { ident };
}


// ─── UMA FONTE DE VERDADE PARA A ETAPA ────────────────────────────────
// A base tinha DUAS maquinas de estado: `status_planejamento` (backlog, planning,
// planejado, em_andamento, validacao, concluido, negada) e o legado `status`
// (recebida, estimada, iniciada, concluida, negada). Elas divergiam em 91 dos 201
// registros — na maioria concluida ainda marcada como "iniciada", campo abandonado.
//
// Havia um caso pior, e esse corrompia decisao: AX-021 e AX-023 estavam negadas
// APENAS no campo legado, com status_planejamento vazio. A API derivava backlog
// para elas, ou seja, demanda recusada contada como fila de entrada.
//
// Agora `status_planejamento` e a fonte e `status` e SEMPRE derivado dela, em todas
// as portas de gravacao. O campo continua existindo porque 5 telas o leem; remover
// exigiria varrer todas, e nao se troca um problema de dado por um de tela no mesmo
// passo. Mas ele nao pode mais contradizer a etapa: quem grava nao escolhe o valor.
const SP_PARA_STATUS = {
  backlog: 'recebida', levantar_req: 'recebida', planning: 'estimada',
  planejado: 'estimada', em_andamento: 'iniciada', validacao: 'iniciada',
  concluido: 'concluida', negada: 'negada',
};

// Alinha `status` a etapa em todas as demandas do payload. Devolve quantas ajustou.
// Etapa desconhecida ou vazia NAO e adivinhada: preencher por chute foi como as
// duas negadas acabaram invisiveis.
function normalizaEstados(data) {
  if (!data || !Array.isArray(data.melhorias)) return 0;
  let n = 0;
  for (const m of data.melhorias) {
    if (!m) continue;
    const sp = String(m.status_planejamento || '').trim();
    const esperado = SP_PARA_STATUS[sp];
    if (!esperado) continue;
    if (m.status !== esperado) { m.status = esperado; n += 1; }
  }
  return n;
}

function atribuiCodigosProjeto(data) {
  if (!data || !Array.isArray(data.projetos)) return 0;
  let maior = 0;
  for (const p of data.projetos) {
    const n = /^EP-(\d+)$/.exec(String(p && p.codigo || ''));
    if (n) maior = Math.max(maior, parseInt(n[1], 10));
  }
  let novos = 0;
  // Vazio E repetido. Dois projetos chegaram a nascer com EP-001 porque a lista
  // foi zerada entre as duas criacoes: sem olhar repetido, o Worker preservava a
  // duplicata para sempre, e dois projetos com o mesmo codigo nao se distinguem
  // em nenhum relatorio.
  const usados = new Set();
  for (const p of data.projetos) {
    if (!p) continue;
    const cod = String(p.codigo || '');
    // Proposta pendente nao queima numero: se for recusada, o EP ficaria com um
    // buraco que ninguem sabe explicar depois. O codigo nasce na aprovacao.
    if (!projetoAprovado(p)) { p.codigo = ''; continue; }
    if (cod && !usados.has(cod)) { usados.add(cod); continue; }
    maior += 1;
    p.codigo = 'EP-' + String(maior).padStart(3, '0');
    usados.add(p.codigo);
    novos += 1;
  }
  return novos;
}

// Projeto sem o campo conta como aprovado: os que existem hoje foram criados
// pelo proprio PM/PO no Admin, e criar ali JA e a aprovacao. Sem esta regra,
// todos eles virariam pendentes na primeira leitura.
function projetoAprovado(p) {
  return String((p && p.aprovacao) || 'aprovado') === 'aprovado';
}

// Demanda nao pode pertencer a projeto que nao existe ou que ainda nao foi
// aprovado. Vale no Worker porque o vinculo se faz em duas telas por caminhos
// diferentes, e uma proposta recusada nao pode deixar demanda pendurada nela.
// Nao rejeita a gravacao: solta o vinculo e informa, como corrigeSemDev.
function corrigeProjetoInvalido(data) {
  if (!data || !Array.isArray(data.melhorias)) return [];
  const validos = new Set((data.projetos || []).filter(projetoAprovado).map(p => p.id));
  const soltas = [];
  for (const m of data.melhorias) {
    if (!m || !m.projeto_id) continue;
    if (!validos.has(m.projeto_id)) {
      soltas.push({ id: m.id, codigo: m.codigo || '', titulo: m.titulo || '' });
      m.projeto_id = '';
    }
  }
  return soltas;
}

// Etapa com trabalho comprometido exige responsavel. Validado tambem AQUI porque
// as telas podem mudar e o arrastar de card tem varios caminhos; o Worker e o
// unico ponto por onde toda gravacao passa.
// Nao rejeita a gravacao inteira por causa disso: seria travar o trabalho de todo
// mundo por um card. Devolve a etapa para 'backlog' e informa quais mexeu, para a
// tela avisar.
function corrigeSemDev(data) {
  const ETAPAS = ['planejado', 'em_andamento', 'validacao'];
  const ajustados = [];
  for (const m of (data.melhorias || [])) {
    if (!m || m.mesclado_em) continue;
    if (ETAPAS.includes(m.status_planejamento) && !String(m.dev || '').trim()) {
      m.status_planejamento = 'backlog';
      m.status = 'recebida';
      ajustados.push(m.codigo || m.id);
    }
  }
  return ajustados;
}

function atribuiCodigos(data) {
  if (!data || !Array.isArray(data.melhorias)) return 0;
  let maior = 0;
  for (const m of data.melhorias) {
    const n = /^AX-(\d+)$/.exec(String(m && m.codigo || ''));
    if (n) maior = Math.max(maior, parseInt(n[1], 10));
  }
  let novos = 0;
  const vistos = new Set(data.melhorias.map(m => m && m.codigo).filter(Boolean));
  for (const m of data.melhorias) {
    if (!m) continue;
    const atual = String(m.codigo || '');
    // Sem codigo, ou com um codigo que outra demanda ja usa (importacao, copia)
    const duplicado = atual && data.melhorias.filter(x => x && x.codigo === atual).length > 1;
    if (!atual || (duplicado && vistos.has(atual) && m !== data.melhorias.find(x => x && x.codigo === atual))) {
      maior += 1;
      m.codigo = 'AX-' + String(maior).padStart(3, '0');
      vistos.add(m.codigo);
      novos += 1;
    }
  }
  return novos;
}


async function contasMigrar(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS usuario (
      id TEXT PRIMARY KEY, login TEXT NOT NULL UNIQUE, nome TEXT NOT NULL,
      senha_hash TEXT NOT NULL, salt TEXT NOT NULL, papel TEXT NOT NULL,
      ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL,
      ultimo_acesso TEXT, email TEXT, pendente INTEGER NOT NULL DEFAULT 0)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sessao (
      token TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, expira_em TEXT NOT NULL,
      criado_em TEXT NOT NULL)`),
    // Pedidos de nova senha. Sem servico de e-mail no Worker, o admin resolve
    // pela tela — a fila e o que faz o pedido nao se perder.
    db.prepare(`CREATE TABLE IF NOT EXISTS senha_pedido (
      id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, criado_em TEXT NOT NULL,
      atendido INTEGER NOT NULL DEFAULT 0)`),
  ]);
  // A tabela usuario nasceu sem estas duas colunas e ja existe em producao.
  await colunaSeFaltar(db, 'usuario', 'email', 'TEXT');
  await colunaSeFaltar(db, 'usuario', 'pendente', 'INTEGER NOT NULL DEFAULT 0');
  // E-mail unico, mas so entre quem tem e-mail (contas antigas ficam com NULL).
  try { await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS ix_usuario_email ON usuario(email) WHERE email IS NOT NULL').run(); } catch (_) {}
}

function hexDe(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function derivaSenha(senha, saltHex) {
  const enc = new TextEncoder();
  const salt = Uint8Array.from(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' }, key, 256);
  return hexDe(bits);
}
// Comparacao em tempo constante: comparar hash com === vaza informacao pelo tempo
// de retorno. O custo e irrelevante e remove a duvida.
function igualSeguro(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

// Resolve quem esta chamando. Devolve { papel, usuario } ou null.
//
// Aceita DOIS caminhos de proposito, durante a transicao:
//   1. token de sessao (contas novas)
//   2. senha compartilhada (admin/dev/leitura) — para nao trancar ninguem fora
//      enquanto as contas nao existem. Sai depois que todos entrarem uma vez.
async function identifica(env, body) {
  const db = env.POKER_DB;
  if (db && body.token) {
    try {
      await contasMigrar(db);
      const r = await db.prepare(
        `SELECT s.expira_em, u.id, u.login, u.nome, u.papel, u.ativo
           FROM sessao s JOIN usuario u ON u.id = s.usuario_id
          WHERE s.token = ?`).bind(String(body.token)).first();
      if (r && r.ativo && new Date(r.expira_em) > new Date()) {
        return { papel: r.papel, usuario: { id: r.id, login: r.login, nome: r.nome } };
      }
    } catch (_) {}
  }
  // legado: senha compartilhada
  const s = body.senha;
  if (s && env.ADMIN_SENHA && s === env.ADMIN_SENHA) return { papel: 'admin', usuario: null };
  if (s && env.DEV_SENHA && s === env.DEV_SENHA) return { papel: 'dev', usuario: null };
  const vS = String(env.VIEW_SENHA || '').trim();
  if (vS && String(s || '').trim() === vS) return { papel: 'consulta', usuario: null };
  const vC = String(env.VIEW_CHAVE || '').trim();
  if (vC && String(body.chave || '').trim() === vC) return { papel: 'consulta', usuario: null };
  return null;
}
function temNivel(ident, minimo) {
  return !!ident && (NIVEL[ident.papel] || 0) >= (NIVEL[minimo] || 99);
}

function toB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = ''; const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}
function uid() { return 'm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
// charset=utf-8 NAO e decorativo: sem ele o cliente escolhe como decodificar, e
// quem assume latin-1 le "JoÃ£o Vitor" e "AxCred - OperaÃ§Ãµes". O JSON.stringify
// aqui produz UTF-8 correto; o problema estava so na declaracao. Reportado por
// quem consumia a API por script.
function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

// ═══════════════════════════════════════════════════════════════════════
// PLANNING POKER (D1: binding POKER_DB)
//
// O voto fica OCULTO no servidor: antes de revelar, o estado devolve apenas
// quem já votou, nunca o valor. Esconder no navegador não seria sigilo.
// ═══════════════════════════════════════════════════════════════════════
const POKER_TTL_H = 2;    // sessão expira em 2h — duração máxima de um planning
// Janela de presenca: sem sinal de vida por este tempo, sai da mesa. O painel
// faz polling a cada 1,5s, entao a margem cobre requisicao perdida ou tela
// bloqueando por instantes, sem deixar fantasma na sala.
const PRESENCA_S  = 30;

async function pokerMigrar(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS poker_sessao (
      codigo TEXT PRIMARY KEY, melhoria_id TEXT, revelado INTEGER NOT NULL DEFAULT 0,
      criado_em TEXT NOT NULL, expira_em TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS poker_participante (
      id TEXT PRIMARY KEY, codigo TEXT NOT NULL, nome TEXT NOT NULL, visto_em TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS poker_voto (
      codigo TEXT NOT NULL, melhoria_id TEXT NOT NULL, participante TEXT NOT NULL,
      valor TEXT NOT NULL, votado_em TEXT NOT NULL,
      PRIMARY KEY (codigo, melhoria_id, participante))`),
  ]);
}

function pokerCodigo() {
  // sem 0/O/1/I para ninguém errar ao digitar
  const alf = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = ''; for (let i = 0; i < 6; i++) c += alf[Math.floor(Math.random() * alf.length)];
  return c;
}

// Fibonacci ate 89 + 100 como carta de topo, para demandas grandes ("casa dos
// 100"). Os valores antigos (21, 34) seguem existindo — trocar 21/34 por 20/40
// como fazem alguns baralhos invalidaria pontuacoes ja gravadas.
const POKER_CARTAS = ['1','2','3','5','8','13','21','34','55','89','100','?'];

async function pokerEstado(db, codigo) {
  const ses = await db.prepare('SELECT * FROM poker_sessao WHERE codigo = ?').bind(codigo).first();
  if (!ses) return null;
  if (new Date(ses.expira_em) < new Date()) return { expirada: true };

  const corte = new Date(Date.now() - PRESENCA_S * 1000).toISOString();
  const parts = (await db.prepare(
    'SELECT id, nome, visto_em FROM poker_participante WHERE codigo = ? ORDER BY visto_em').bind(codigo).all()).results || [];
  const votos = (await db.prepare(
    'SELECT participante, valor FROM poker_voto WHERE codigo = ? AND melhoria_id = ?')
    .bind(codigo, ses.melhoria_id || '').all()).results || [];

  const porPart = {};
  votos.forEach(v => { porPart[v.participante] = v.valor; });
  const revelado = !!ses.revelado;

  // numéricos entram na média; '?' conta como abstenção
  const nums = votos.map(v => parseFloat(v.valor)).filter(n => isFinite(n));
  const media = revelado && nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;

  return {
    codigo, melhoria_id: ses.melhoria_id || '', revelado, cartas: POKER_CARTAS,
    // Mesa dinamica: mostra quem deu sinal de vida na janela de presenca OU quem
    // ja votou nesta rodada. Manter o voto na mesa evita a media contar alguem
    // que a tela nao mostra (celular que travou por alguns segundos, por ex.).
    participantes: parts
      .filter(p => p.visto_em > corte || porPart[p.id] !== undefined)
      .map(p => ({
        id: p.id, nome: p.nome,
        votou: porPart[p.id] !== undefined,
        online: p.visto_em > corte,
        // valor só sai depois de revelar
        valor: revelado ? (porPart[p.id] ?? null) : null,
      })),
    media,
    total_votos: votos.length,
  };
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders();
    if (request.method === 'OPTIONS') return new Response(null, { headers });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers });

    let body;
    try { body = await request.json(); } catch (e) { return json({ error: 'JSON invalido' }, 400, headers); }

    // Freio por IP antes de qualquer trabalho. `sugestao` cobre o formulario
    // publico, que nao tem action propria.
    const ip = request.headers.get('CF-Connecting-IP') || 'sem-ip';
    const acaoLim = body.action || 'sugestao';
    if (await limiteExcedido(env, ip, acaoLim)) {
      await contaTentativa(env, ip, acaoLim);
      return json({ error: 'muitas_tentativas',
                    detail: 'Muitas requisicoes. Aguarde um minuto e tente de novo.' }, 429, headers);
    }

    const REPO_NAME = env.DATA_REPO || REPO_NAME_PADRAO;
    const gh = (path, opts = {}) => fetch('https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME + '/' + path, {
      ...opts,
      headers: { Authorization: 'token ' + env.GH_TOKEN, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'audax-roadmap-worker', ...(opts.headers || {}) },
    });
    // Papel de quem chama, resolvido UMA vez por requisicao. Vem do token de
    // sessao (conta por pessoa) ou, durante a transicao, da senha compartilhada.
    let _ident = null, _identFeita = false;
    const papelAtual = async () => {
      if (!_identFeita) { _identFeita = true; _ident = await identifica(env, body); }
      return _ident ? _ident.papel : null;
    };
    // Mantem a assinatura antiga (sincrona) para nao reescrever cada rota: a versao
    // sincrona cobre a senha compartilhada; a assincrona cobre token tambem.
    const senhaOk = (s) => s && env.ADMIN_SENHA && s === env.ADMIN_SENHA;
    const ehAdmin = async () => (await papelAtual()) === 'admin';
    // analista entra aqui porque anexa arquivo e edita demanda: sao acoes de dev e
    // ele esta acima de dev. Sem isto, complementar uma demanda na reuniao com um
    // print seria recusado.
    const ehDev   = async () => ['dev', 'analista', 'admin'].includes(await papelAtual());
    // Definido AQUI, junto de senhaOk, e nao mais adiante: `const` nao existe antes
    // da declaracao, e a rota de anexo (que usa devOk) roda antes do ponto onde
    // isto estava. Chamar dali lancaria ReferenceError em tempo de execucao — o
    // mesmo tipo de erro que fez o painel publico cair no fallback silencioso.
    const devOk = (s) => senhaOk(s) || !!(s && env.DEV_SENHA && s === env.DEV_SENHA);

    // Leitura protegida por senha, com ativacao gradual: enquanto nem VIEW_SENHA
    // nem VIEW_CHAVE existirem, a leitura segue aberta e nada muda para quem usa
    // hoje. Criar um desses secrets liga a trava na hora, sem novo deploy.
    //   • VIEW_SENHA  → senha de leitura (painel publico)
    //   • VIEW_CHAVE  → chave usada no Link de Visualizacao (sem digitar senha)
    // A senha do admin tambem serve, para quem edita nao precisar de duas.
    // Secret criado em branco (Enter sem digitar) chegava como string vazia e
    // desligava a trava silenciosamente — o painel seguia aberto e nada avisava.
    // Aqui o valor e normalizado: espaco em branco conta como ausente.
    const vSenha = String(env.VIEW_SENHA || '').trim();
    const vChave = String(env.VIEW_CHAVE || '').trim();
    const travaAtiva = () => !!(vSenha || vChave);
    // Aceita token de sessao (qualquer papel le) alem da senha compartilhada.
    // A versao async e usada onde da; a sincrona segue para nao reescrever tudo.
    const leituraLiberadaAsync = async (body) => {
      if (!travaAtiva()) return true;
      if (await papelAtual()) return true;
      return leituraLiberada(body);
    };
    const leituraLiberada = (body) => {
      if (!travaAtiva()) return true;
      if (senhaOk(body.senha)) return true;
      if (vSenha && String(body.senha || '').trim() === vSenha) return true;
      if (vChave && String(body.chave || '').trim() === vChave) return true;
      return false;
    };

    // ── PLANNING POKER ──────────────────────────────────────────────
    if (typeof body.action === 'string' && body.action.startsWith('poker-')) {
      const db = env.POKER_DB;
      if (!db) return json({ error: 'Banco POKER_DB nao configurado no Worker' }, 503, headers);
      await pokerMigrar(db);
      const agora = new Date();
      const iso = agora.toISOString();

      // Acao de facilitador: quem conduz a votacao. Aceita conta propria (token)
      // OU a senha compartilhada, exatamente como o Admin e o Gantt. Antes olhava
      // so `senhaOk`, isto e, so a senha compartilhada: quem entrou pela propria
      // conta nao conseguia abrir a sala nem revelar votos. Mesma lacuna que o
      // Gantt e o anexo tiveram, pelo mesmo motivo — a regra estava escrita em
      // cada rota em vez de vir de um lugar so.
      // Conduzir a votacao (abrir sala, revelar, gravar pontos, complementar, negar)
      // e do PM/PO E do Analista de Requisitos. Dev e consulta seguem so votando.
      const facilitadorOk = async () =>
        ['admin', 'analista'].includes(await papelAtual()) || senhaOk(body.senha);
      const recusaFacilitador = () => json({ error: 'senha',
        detail: 'Ação do facilitador: entre com a sua conta de PM/PO ou informe a senha de acesso.' },
        401, headers);

      // Abre (ou reaproveita) a sessao — so o facilitador, com senha
      if (body.action === 'poker-abrir') {
        if (!(await facilitadorOk())) return recusaFacilitador();
        const viva = await db.prepare(
          'SELECT codigo FROM poker_sessao WHERE expira_em > ? ORDER BY criado_em DESC LIMIT 1').bind(iso).first();
        if (viva && !body.nova) {
          // Reaproveita a sala, mas ZERA a rodada: abrir a sala e o inicio de uma
          // reuniao, e a media/pontos da reuniao anterior apareciam preenchidos.
          // Um refresh de pagina nao passa por aqui (vai direto no poker-estado
          // com o codigo guardado), entao recarregar no meio de uma votacao nao
          // perde a rodada em andamento.
          await db.prepare("UPDATE poker_sessao SET melhoria_id = '', revelado = 0 WHERE codigo = ?").bind(viva.codigo).run();
          await db.prepare('DELETE FROM poker_voto WHERE codigo = ?').bind(viva.codigo).run();
          return json({ ok: true, codigo: viva.codigo }, 200, headers);
        }
        const codigo = pokerCodigo();
        const expira = new Date(agora.getTime() + POKER_TTL_H * 3600 * 1000).toISOString();
        await db.prepare('INSERT INTO poker_sessao (codigo, melhoria_id, revelado, criado_em, expira_em) VALUES (?,?,0,?,?)')
          .bind(codigo, body.melhoria_id || '', iso, expira).run();
        return json({ ok: true, codigo }, 200, headers);
      }

      const codigo = String(body.codigo || '').toUpperCase().trim();
      if (!codigo) return json({ error: 'Informe o codigo da sessao' }, 400, headers);

      // Entrar: so o nome. E voto de estimativa, nao dado sensivel.
      if (body.action === 'poker-entrar') {
        const nome = String(body.nome || '').trim().slice(0, 40);
        if (!nome) return json({ error: 'Informe seu nome' }, 400, headers);
        const ses = await db.prepare('SELECT codigo, expira_em FROM poker_sessao WHERE codigo = ?').bind(codigo).first();
        if (!ses) return json({ error: 'Sessao nao encontrada' }, 404, headers);
        if (new Date(ses.expira_em) < agora) return json({ error: 'Sessao expirada' }, 410, headers);
        const existente = await db.prepare('SELECT id FROM poker_participante WHERE codigo = ? AND nome = ?')
          .bind(codigo, nome).first();
        const id = existente ? existente.id : 'p-' + Math.random().toString(36).slice(2, 10);
        if (existente) await db.prepare('UPDATE poker_participante SET visto_em = ? WHERE id = ?').bind(iso, id).run();
        else await db.prepare('INSERT INTO poker_participante (id, codigo, nome, visto_em) VALUES (?,?,?,?)')
          .bind(id, codigo, nome, iso).run();
        return json({ ok: true, participante: id, nome }, 200, headers);
      }

      // Saida explicita (botao Sair ou aba fechando). Remove o participante e o
      // voto dele na rodada: se saiu de proposito, nao deve entrar na media.
      if (body.action === 'poker-sair') {
        const pid = String(body.participante || '');
        if (!pid) return json({ error: 'participante obrigatorio' }, 400, headers);
        const ses = await db.prepare('SELECT melhoria_id FROM poker_sessao WHERE codigo = ?').bind(codigo).first();
        await db.prepare('DELETE FROM poker_voto WHERE codigo = ? AND melhoria_id = ? AND participante = ?')
          .bind(codigo, (ses && ses.melhoria_id) || '', pid).run();
        await db.prepare('DELETE FROM poker_participante WHERE id = ? AND codigo = ?').bind(pid, codigo).run();
        return json({ ok: true }, 200, headers);
      }

      // Fila do planning para quem entra pelo QR, SEM senha de leitura.
      //
      // A alternativa seria embutir a senha de leitura no QR — mas o QR circula em
      // print, mensagem e tela compartilhada, e a senha da acesso a base INTEIRA,
      // para sempre. Aqui quem autoriza e o proprio codigo da sala: escopo minimo
      // (so o que a tela do poker mostra) e prazo curto (a sessao morre em 2h).
      //
      // Devolve apenas id, titulo, dev, tipo, tema e pontuacao. Descricao,
      // discovery, anexos e solicitante NAO saem por aqui.
      if (body.action === 'poker-fila') {
        const ses = await db.prepare('SELECT codigo, expira_em, melhoria_id FROM poker_sessao WHERE codigo = ?')
          .bind(codigo).first();
        if (!ses) return json({ error: 'Sessao nao encontrada' }, 404, headers);
        if (new Date(ses.expira_em) < agora) return json({ error: 'Sessao expirada' }, 410, headers);

        const rawRes = await gh('contents/' + FILE_PATH + '?raw=' + Date.now(),
                                { headers: { Accept: 'application/vnd.github.raw' } });
        if (!rawRes.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
        let data;
        try { data = JSON.parse(await rawRes.text()); } catch (_) { return json({ error: 'Falha ao ler dados' }, 502, headers); }

        // Leva o que se discute numa planning, nao so o titulo: sem descricao,
        // solicitante e anexos, o facilitador precisava do Admin aberto ao lado — e
        // votar olhando outra tela e como o time perde o contexto.
        //
        // `anexos` vai SEM o base64 (campo `dados`): um anexo inline de 1,5 MB por
        // demanda multiplicaria o tamanho desta resposta, que e pedida a cada
        // atualizacao da fila. Vai a referencia; o conteudo sai pelo anexo-baixar.
        const enxuta = (m) => ({
          id: m.id, titulo: m.titulo || '', dev: m.dev || '', tipo: m.tipo || '',
          tema_id: m.tema_id || '', poker_pontos: m.poker_pontos ?? null,
          poker_media: m.poker_media ?? null, status_planejamento: m.status_planejamento || '',
          codigo: m.codigo || '', descricao: m.descricao || '',
          solicitante: m.solicitante || '', entrega: m.entrega || '',
          criado_em: m.criado_em || '', debito_tecnico: !!m.debito_tecnico,
          anexos: (m.anexos || []).map(a => ({
            nome: a.nome || 'arquivo', chave: a.chave || '',
            tipo: a.tipo || '', tamanho: a.tamanho || 0,
            // Anexo antigo guardado como base64 dentro do JSON nao tem chave: nao da
            // para baixar por referencia, e dizer isso e melhor que um link morto.
            inline: !a.chave && !!a.dados,
          })),
          // O discovery vai INTEIRO. A primeira versao recortava tres campos que eu
          // supus (objetivo/impacto/beneficiados) e dois nem existem: o formulario
          // do dash grava `beneficiarios`, e `contexto`, `escopo`, `regras_negocio`,
          // `requisitos_funcionais` e `criterios_aceite` sao objetos e listas, nao
          // texto. Recortar de novo repetiria o erro de supor a forma do dado.
          //
          // O teto e no JSON inteiro: um discovery bem preenchido tem ~1,5 KB, e o
          // limite existe para um caso extremo nao inflar uma resposta que e pedida
          // a cada atualizacao da fila.
          discovery: (m.discovery && typeof m.discovery === 'object' &&
                      JSON.stringify(m.discovery).length < 8000) ? m.discovery : null,
        });
        const todas = data.melhorias || [];
        const fila = todas.filter(m => (m.status_planejamento || '') === 'planning').map(enxuta);
        // a demanda em pauta pode ter saido de Planning no meio da reuniao; sem ela
        // o titulo do card em votacao apareceria vazio
        if (ses.melhoria_id && !fila.some(m => m.id === ses.melhoria_id)) {
          const emPauta = todas.find(m => m.id === ses.melhoria_id);
          if (emPauta) fila.push(enxuta(emPauta));
        }
        return json({ ok: true,
                      melhorias: fila,
                      temas: (data.temas || []).map(t => ({ id: t.id, nome: t.nome })) }, 200, headers);
      }

      if (body.action === 'poker-estado') {
        // O proprio polling serve de sinal de vida: quem para de chamar sai da
        // mesa sozinho. Antes o participante era gravado na entrada e nunca mais
        // saia, entao quem fechava a aba ficava na sala para sempre.
        if (body.participante) {
          await db.prepare('UPDATE poker_participante SET visto_em = ? WHERE id = ? AND codigo = ?')
            .bind(iso, String(body.participante), codigo).run();
        }
        // faxina: registro sem sinal de vida ha muito tempo nao volta mais
        const velho = new Date(agora.getTime() - 2 * 3600 * 1000).toISOString();
        await db.prepare('DELETE FROM poker_participante WHERE codigo = ? AND visto_em < ?').bind(codigo, velho).run();
        // O voto do participante removido ficava na base e seguia contando: a mesa
        // aparecia vazia e o placar mostrava "5 votos" com media de gente que nao
        // esta mais na sala. Voto sem participante e apagado junto.
        await db.prepare(
          'DELETE FROM poker_voto WHERE codigo = ? AND participante NOT IN (SELECT id FROM poker_participante WHERE codigo = ?)'
        ).bind(codigo, codigo).run();

        const est = await pokerEstado(db, codigo);
        if (!est) return json({ error: 'Sessao nao encontrada' }, 404, headers);
        if (est.expirada) return json({ error: 'Sessao expirada' }, 410, headers);
        return json({ ok: true, estado: est }, 200, headers);
      }

      if (body.action === 'poker-votar') {
        const ses = await db.prepare('SELECT melhoria_id, revelado, expira_em FROM poker_sessao WHERE codigo = ?').bind(codigo).first();
        if (!ses) return json({ error: 'Sessao nao encontrada' }, 404, headers);
        if (new Date(ses.expira_em) < agora) return json({ error: 'Sessao expirada' }, 410, headers);
        if (ses.revelado) return json({ error: 'Votacao encerrada nesta rodada' }, 409, headers);
        if (!ses.melhoria_id) return json({ error: 'Nenhuma demanda em votacao' }, 409, headers);
        if (!POKER_CARTAS.includes(String(body.valor))) return json({ error: 'Carta invalida' }, 400, headers);
        // participante precisa existir NESTA sala: sem isto era possivel votar em
        // nome de outra pessoa mandando o id dela.
        const pOk = await db.prepare('SELECT id FROM poker_participante WHERE id = ? AND codigo = ?')
          .bind(String(body.participante || ''), codigo).first();
        if (!pOk) return json({ error: 'Participante nao esta na sala' }, 403, headers);
        const p = await db.prepare('SELECT id FROM poker_participante WHERE id = ? AND codigo = ?')
          .bind(String(body.participante || ''), codigo).first();
        if (!p) return json({ error: 'Participante nao reconhecido' }, 403, headers);
        await db.prepare('INSERT INTO poker_voto (codigo, melhoria_id, participante, valor, votado_em) VALUES (?,?,?,?,?) ON CONFLICT(codigo, melhoria_id, participante) DO UPDATE SET valor = ?, votado_em = ?')
          .bind(codigo, ses.melhoria_id, p.id, String(body.valor), iso, String(body.valor), iso).run();
        return json({ ok: true }, 200, headers);
      }

      // Daqui pra baixo e o facilitador. Esta porteira roda ANTES da conferencia de
      // cada rota, entao ela e que decide de verdade: enquanto olhava so
      // `senhaOk`, quem entrou pela propria conta abria a sala (rota anterior a
      // esta linha) e era recusado em TUDO depois — por em pauta, revelar, gravar.
      // Ficava impossivel conduzir a votacao.
      if (!(await facilitadorOk())) return recusaFacilitador();

      if (body.action === 'poker-revelar') {
        // Acao de facilitador: o painel sempre manda a senha, mas o servidor nao
        // conferia. Sem isto, quem tivesse o codigo da sala revelava votos, trocava
        // a pauta ou gravava pontuacao em qualquer demanda do arquivo.
        if (!(await facilitadorOk())) return recusaFacilitador();
        await db.prepare('UPDATE poker_sessao SET revelado = 1 WHERE codigo = ?').bind(codigo).run();
        return json({ ok: true, estado: await pokerEstado(db, codigo) }, 200, headers);
      }

      // Troca a demanda em votacao e zera a rodada
      if (body.action === 'poker-demanda') {
        // Acao de facilitador: o painel sempre manda a senha, mas o servidor nao
        // conferia. Sem isto, quem tivesse o codigo da sala revelava votos, trocava
        // a pauta ou gravava pontuacao em qualquer demanda do arquivo.
        if (!(await facilitadorOk())) return recusaFacilitador();
        const mid = String(body.melhoria_id || '');
        await db.prepare('UPDATE poker_sessao SET melhoria_id = ?, revelado = 0 WHERE codigo = ?').bind(mid, codigo).run();
        await db.prepare('DELETE FROM poker_voto WHERE codigo = ? AND melhoria_id = ?').bind(codigo, mid).run();
        return json({ ok: true, estado: await pokerEstado(db, codigo) }, 200, headers);
      }

      // Zera tudo: sai da pauta, esconde resultado e apaga os votos da sessao.
      if (body.action === 'poker-zerar') {
        if (!(await facilitadorOk())) return recusaFacilitador();
        await db.prepare("UPDATE poker_sessao SET melhoria_id = '', revelado = 0 WHERE codigo = ?").bind(codigo).run();
        await db.prepare('DELETE FROM poker_voto WHERE codigo = ?').bind(codigo).run();
        return json({ ok: true, estado: await pokerEstado(db, codigo) }, 200, headers);
      }

      if (body.action === 'poker-revotar') {
        // Acao de facilitador: o painel sempre manda a senha, mas o servidor nao
        // conferia. Sem isto, quem tivesse o codigo da sala revelava votos, trocava
        // a pauta ou gravava pontuacao em qualquer demanda do arquivo.
        if (!(await facilitadorOk())) return recusaFacilitador();
        const ses = await db.prepare('SELECT melhoria_id FROM poker_sessao WHERE codigo = ?').bind(codigo).first();
        await db.prepare('UPDATE poker_sessao SET revelado = 0 WHERE codigo = ?').bind(codigo).run();
        await db.prepare('DELETE FROM poker_voto WHERE codigo = ? AND melhoria_id = ?')
          .bind(codigo, (ses && ses.melhoria_id) || '').run();
        return json({ ok: true, estado: await pokerEstado(db, codigo) }, 200, headers);
      }

      // Grava so os dois campos na demanda — nao recebe o estado inteiro, entao
      // uma tela desatualizada nao pode sobrescrever o resto da base.
      if (body.action === 'poker-gravar') {
        // Acao de facilitador: o painel sempre manda a senha, mas o servidor nao
        // conferia. Sem isto, quem tivesse o codigo da sala revelava votos, trocava
        // a pauta ou gravava pontuacao em qualquer demanda do arquivo.
        if (!(await facilitadorOk())) return recusaFacilitador();
        const mid = String(body.melhoria_id || '');
        if (!mid) return json({ error: 'melhoria_id obrigatorio' }, 400, headers);
        const getRes = await gh('contents/' + FILE_PATH + '?t=' + Date.now());
        if (!getRes.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
        const file = await getRes.json();
        const rawRes = await gh('contents/' + FILE_PATH + '?raw=' + Date.now(), { headers: { Accept: 'application/vnd.github.raw' } });
        if (!rawRes.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
        const data = JSON.parse(await rawRes.text());
        const alvo = (data.melhorias || []).find(x => x.id === mid);
        if (!alvo) return json({ error: 'Demanda nao encontrada' }, 404, headers);
        const media  = body.poker_media  === null || body.poker_media  === '' ? null : Number(body.poker_media);
        const pontos = body.poker_pontos === null || body.poker_pontos === '' ? null : parseInt(body.poker_pontos);
        if (media !== null && !isFinite(media)) return json({ error: 'media invalida' }, 400, headers);
        if (pontos !== null && !isFinite(pontos)) return json({ error: 'pontos invalidos' }, 400, headers);
        // Retrato antes de mexer: a pontuacao alimenta o ranking do dev e o
        // relatorio do comitê, entao trocar um valor gravado nao pode ser invisivel.
        // Era a unica porta de gravacao que ficava fora do historico.
        const antesPoker = JSON.parse(JSON.stringify(alvo));
        alvo.poker_media = media;
        alvo.poker_pontos = pontos;
        registraHistorico(data, { melhorias: [antesPoker] },
                          (_ident && _ident.usuario && _ident.usuario.nome) || 'facilitador',
                          'planning poker');
        data.atualizado_em = iso;
        const risco = gravacaoSuspeita(data, file.size || 0);
        if (risco) return json({ error: risco }, 409, headers);
        const putRes = await gh('contents/' + FILE_PATH, {
          method: 'PUT',
          body: JSON.stringify({ message: 'chore: planning poker - ' + String(alvo.titulo || mid).slice(0, 60),
                                 content: toB64(JSON.stringify(data)), sha: file.sha }),
        });
        if (!putRes.ok) { const e = await putRes.text(); return json({ error: 'Falha ao salvar', detail: e }, 502, headers); }
        return json({ ok: true, poker_media: media, poker_pontos: pontos }, 200, headers);
      }

      // ── Complementar a demanda durante a reuniao ──────────────────────
      // O que aparece na planning e o que falta na demanda: "onde exatamente",
      // "qual tela", um print do erro. Sem isto o facilitador anotava fora e
      // transcrevia depois — quando transcrevia.
      //
      // ACRESCENTA, nao substitui: a descricao original e do solicitante, e
      // sobrescrever o pedido de alguem numa reuniao onde ele pode nem estar seria
      // apagar contexto. O texto novo entra datado no fim.
      if (body.action === 'poker-editar') {
        if (!(await facilitadorOk())) return recusaFacilitador();
        const mid = String(body.melhoria_id || '');
        if (!mid) return json({ error: 'melhoria_id obrigatorio' }, 400, headers);
        const add = limpaTexto(body.complemento, 4000);
        const novosAnexos = sanitizaAnexos(body.anexos_add || []);
        if (!add && !novosAnexos.length) {
          return json({ error: 'nada_a_mudar',
                        detail: 'Escreva o complemento ou anexe um arquivo.' }, 400, headers);
        }
        const metaE = await gh('contents/' + FILE_PATH + '?t=' + Date.now());
        if (!metaE.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
        const fileE = await metaE.json();
        const rawE = await gh('contents/' + FILE_PATH + '?raw=' + Date.now(),
          { headers: { Accept: 'application/vnd.github.raw' } });
        if (!rawE.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
        const dataE = JSON.parse(await rawE.text());
        const alvoE = (dataE.melhorias || []).find(x => x.id === mid);
        if (!alvoE) return json({ error: 'Demanda nao encontrada' }, 404, headers);
        const antesE = JSON.parse(JSON.stringify(alvoE));
        const quemE = (_ident && _ident.usuario && _ident.usuario.nome) || 'facilitador';
        if (add) {
          const dia = new Date().toISOString().slice(0, 10).split('-').reverse().join('/');
          const cabeca = '--- Planning ' + dia + ' (' + quemE + ') ---';
          alvoE.descricao = [String(alvoE.descricao || '').trim(), cabeca, add]
            .filter(Boolean).join('\n\n');
        }
        if (novosAnexos.length) {
          alvoE.anexos = (alvoE.anexos || []).concat(novosAnexos);
        }
        registraHistorico(dataE, { melhorias: [antesE] }, quemE, 'planning poker');
        dataE.atualizado_em = iso;
        const riscoE = gravacaoSuspeita(dataE, fileE.size || 0);
        if (riscoE) return json({ error: riscoE }, 409, headers);
        const putE = await gh('contents/' + FILE_PATH, {
          method: 'PUT',
          body: JSON.stringify({ message: 'chore: planning complementa ' + (alvoE.codigo || mid),
                                 content: toB64(JSON.stringify(dataE)), sha: fileE.sha }),
        });
        if (!putE.ok) { const e = await putE.text(); return json({ error: 'Falha ao salvar', detail: e.slice(0, 200) }, 502, headers); }
        return json({ ok: true, descricao: alvoE.descricao,
                      anexos: (alvoE.anexos || []).length }, 200, headers);
      }

      // ── Negar a demanda na propria reuniao ────────────────────────────
      // A planning e onde se descobre que a demanda nao se sustenta. Obrigar a sair
      // daqui, abrir o Admin e negar la e o passo em que a decisao se perde: a
      // demanda volta para a fila e o time reestima na semana seguinte.
      //
      // Motivo obrigatorio: sem ele, quem pediu nao sabe o que aconteceu, e a mesma
      // ideia volta igual em um mes.
      if (body.action === 'poker-negar') {
        if (!(await facilitadorOk())) return recusaFacilitador();
        const mid = String(body.melhoria_id || '');
        if (!mid) return json({ error: 'melhoria_id obrigatorio' }, 400, headers);
        const motivo = limpaTexto(body.motivo, 2000);
        if (!motivo) {
          return json({ error: 'motivo',
                        detail: 'Explique por que a demanda foi negada: quem pediu vai ler.' }, 400, headers);
        }
        const metaN = await gh('contents/' + FILE_PATH + '?t=' + Date.now());
        if (!metaN.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
        const fileN = await metaN.json();
        const rawN = await gh('contents/' + FILE_PATH + '?raw=' + Date.now(),
          { headers: { Accept: 'application/vnd.github.raw' } });
        if (!rawN.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
        const dataN = JSON.parse(await rawN.text());
        const alvoN = (dataN.melhorias || []).find(x => x.id === mid);
        if (!alvoN) return json({ error: 'Demanda nao encontrada' }, 404, headers);
        if ((alvoN.status_planejamento || '') === 'concluido') {
          return json({ error: 'concluida',
                        detail: 'Demanda concluida nao se nega.' }, 409, headers);
        }
        const antesN = JSON.parse(JSON.stringify(alvoN));
        const quemN = (_ident && _ident.usuario && _ident.usuario.nome) || 'facilitador';
        alvoN.status_planejamento = 'negada';
        // Pelo mapa, nao a mao: assim uma mudanca no mapa alcanca esta rota tambem.
        alvoN.status = SP_PARA_STATUS.negada;
        alvoN.motivo_negacao = motivo;
        alvoN.negada_em = iso;
        alvoN.negada_por = quemN;
        // Sai da pauta: manter negada em votacao deixaria a sala num estado sem
        // sentido, e o proximo revelar gravaria pontos numa demanda recusada.
        await db.prepare("UPDATE poker_sessao SET melhoria_id = '', revelado = 0 WHERE codigo = ?")
          .bind(codigo).run();
        await db.prepare('DELETE FROM poker_voto WHERE codigo = ? AND melhoria_id = ?')
          .bind(codigo, mid).run();
        registraHistorico(dataN, { melhorias: [antesN] }, quemN, 'planning poker');
        dataN.atualizado_em = iso;
        const riscoN = gravacaoSuspeita(dataN, fileN.size || 0);
        if (riscoN) return json({ error: riscoN }, 409, headers);
        const putN = await gh('contents/' + FILE_PATH, {
          method: 'PUT',
          body: JSON.stringify({ message: 'chore: planning nega ' + (alvoN.codigo || mid),
                                 content: toB64(JSON.stringify(dataN)), sha: fileN.sha }),
        });
        if (!putN.ok) { const e = await putN.text(); return json({ error: 'Falha ao salvar', detail: e.slice(0, 200) }, 502, headers); }
        return json({ ok: true, codigo: alvoN.codigo || '',
                      estado: await pokerEstado(db, codigo) }, 200, headers);
      }

      return json({ error: 'Acao de poker desconhecida' }, 400, headers);
    }

    // ── Leitura fresca dos dados ────────────────────────────────────
    // raw.githubusercontent.com serve com Cache-Control max-age=300 e IGNORA
    // cache-buster na query (comprovado: X-Cache HIT com ?t= aleatorio). Isso
    // fazia os paineis lerem estado de ate 5 min atras — o card "voltava" de
    // coluna depois de publicado, e pior: a leitura feita ANTES de publicar
    // podia perder alteracao recente de outra pessoa. Aqui a leitura vai pela
    // API autenticada, que nao passa por esse cache.
    // ── ANEXOS (R2) ──────────────────────────────────────────────────────
    // Antes o arquivo ia como base64 dentro do proprio JSON: 1,53 MB de um total
    // de 1,64 MB, baixados a cada leitura da base por qualquer tela. Agora o
    // binario vive no R2 e o JSON guarda so { nome, tipo, tamanho, chave }.
    //
    // Subir exige credencial de ESCRITA (admin ou dev) OU, no formulario publico,
    // o captcha — mesmo criterio de quem pode criar demanda.
    if (body.action === 'anexo-subir') {
      if (!env.ANEXOS) return json({ error: 'armazenamento indisponivel' }, 503, headers);
      // ehDev() cobre conta por pessoa (token) E as senhas compartilhadas. Antes
      // olhava so a senha crua: quem entrou pela propria conta nao tinha senha no
      // corpo, caia no captcha e nao conseguia anexar.
      const autorizado = (await ehDev()) || senhaOk(body.senha) || devOk(body.senha);
      if (!autorizado) {
        const ts = await turnstileOk(env, body.turnstile, ip);
        if (!ts.ok) {
          const n = await contaTentativa(env, ip, 'anexo-subir');
          return json({ error: 'captcha', detail: 'Verificacao necessaria para anexar arquivo.' }, 403, headers);
        }
      }
      const dados = String(body.dados || '');
      const mt = dados.match(/^data:([a-zA-Z0-9.+\/-]+);base64,([A-Za-z0-9+\/=\s]*)$/);
      if (!mt) return json({ error: 'formato invalido', detail: 'Envie o arquivo como data: URL base64.' }, 400, headers);
      const tipo = mt[1];
      // Lista fechada de tipos. A trava real e aqui: validar so no navegador se
      // contorna com uma requisicao direta. Anexos antigos de outros tipos
      // continuam guardados e acessiveis — a regra vale para o que ENTRA.
      const TIPOS_OK = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!TIPOS_OK.includes(String(tipo).toLowerCase())) {
        return json({ error: 'tipo_nao_permitido',
                      detail: 'Só é possível anexar PDF, JPEG ou PNG.' }, 415, headers);
      }
      let bin;
      try { bin = Uint8Array.from(atob(mt[2].replace(/\s/g, '')), c => c.charCodeAt(0)); }
      catch (_) { return json({ error: 'base64 invalido' }, 400, headers); }
      if (bin.length > 2 * 1024 * 1024) return json({ error: 'arquivo grande', detail: 'Limite de 2 MB por arquivo.' }, 413, headers);

      // chave opaca: o nome original nao entra no caminho (evita colisao e
      // evita expor nome de arquivo em log de acesso)
      const chave = 'a/' + Date.now().toString(36) + '-' + crypto.randomUUID();
      await env.ANEXOS.put(chave, bin, { httpMetadata: { contentType: tipo } });
      return json({ ok: true, chave, nome: limpaTexto(body.nome, 160) || 'anexo',
                    tipo, tamanho: bin.length }, 200, headers);
    }

    // Baixar exige a MESMA autorizacao da leitura da base: quem nao pode ver o
    // roadmap nao pode abrir anexo dele.
    if (body.action === 'anexo-baixar') {
      if (!env.ANEXOS) return json({ error: 'armazenamento indisponivel' }, 503, headers);
      if (!(await leituraLiberadaAsync(body))) return json({ error: 'credencial' }, 401, headers);
      const chave = String(body.chave || '');
      if (!/^a\/[a-z0-9-]+$/.test(chave)) return json({ error: 'chave invalida' }, 400, headers);
      const obj = await env.ANEXOS.get(chave);
      if (!obj) return json({ error: 'anexo nao encontrado' }, 404, headers);
      return new Response(obj.body, {
        status: 200,
        headers: {
          'Content-Type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream',
          'Cache-Control': 'private, no-store',
          ...headers,
        },
      });
    }

    // Lista de temas para o formulario publico, SEM senha de leitura.
    //
    // Sugerir uma melhoria nao pode exigir senha: quem tem uma ideia desiste antes
    // de procurar credencial. Mas o formulario precisa da lista de sistemas para
    // preencher o dropdown, e ela vinha de `dados`, que agora e travado.
    //
    // Aqui sai SO id e nome do tema. Nenhuma demanda, nenhuma descricao, nenhum
    // nome de dev. O envio em si continua protegido pelo Turnstile e pelo limite
    // por IP; consultar o painel continua exigindo a senha.
    if (body.action === 'temas-publicos') {
      const rawRes = await gh('contents/' + FILE_PATH + '?raw=' + Date.now(),
                              { headers: { Accept: 'application/vnd.github.raw' } });
      if (!rawRes.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
      let data;
      try { data = JSON.parse(await rawRes.text()); } catch (_) { return json({ error: 'Falha ao ler dados' }, 502, headers); }
      return json({ ok: true, temas: (data.temas || []).map(t => ({ id: t.id, nome: t.nome })) }, 200, headers);
    }

    // -- CONTAS: login, sessao e gestao ---------------------------------
    // Autocadastro do time. Nao libera acesso sozinho: a conta nasce PENDENTE e
    // um admin aprova. Sem isso, qualquer pessoa que abrisse a URL criaria conta
    // e leria a base inteira.
    if (body.action === 'cadastro') {
      if (!env.POKER_DB) return json({ error: 'indisponivel' }, 503, headers);
      await contasMigrar(env.POKER_DB);
      const nome = limpaTexto(body.nome, 80);
      const email = String(body.email || '').trim().toLowerCase();
      const senhaU = String(body.senhaUsuario || '');
      if (nome.length < 3) return json({ error: 'nome', detail: 'Informe seu nome completo.' }, 400, headers);
      if (!email.endsWith(EMAIL_DOMINIO) || email.length <= EMAIL_DOMINIO.length ||
          !/^[a-z0-9._%+-]+@/.test(email)) {
        return json({ error: 'email', detail: 'Use seu e-mail corporativo, terminando em ' + EMAIL_DOMINIO + '.' }, 400, headers);
      }
      if (senhaU.length < 8) return json({ error: 'senha_curta', detail: 'A senha precisa de ao menos 8 caracteres.' }, 400, headers);

      // Se o e-mail ja tem conta, para aqui: senao geraria outro login e a pessoa
      // acabaria com duas contas.
      const jaTem = await env.POKER_DB.prepare('SELECT 1 FROM usuario WHERE email = ?').bind(email).first();
      if (jaTem) {
        return json({ error: 'existe', detail: 'Ja existe um cadastro com esse e-mail. Fale com o administrador.' }, 409, headers);
      }
      const login = await loginLivre(env.POKER_DB, loginDoEmail(email));
      const salt = hexDe(crypto.getRandomValues(new Uint8Array(16)));
      const hash = await derivaSenha(senhaU, salt);
      try {
        await env.POKER_DB.prepare(
          `INSERT INTO usuario (id, login, nome, email, senha_hash, salt, papel, ativo, pendente, criado_em)
           VALUES (?,?,?,?,?,?,?,0,1,?)`)
          .bind('u-' + crypto.randomUUID().slice(0, 8), login, nome, email, hash, salt, 'dev',
                new Date().toISOString()).run();
      } catch (e) {
        // Nao revela se colidiu no login ou no e-mail: seria uma forma de
        // descobrir quem ja tem conta.
        return json({ error: 'existe', detail: 'Ja existe um cadastro com esse usuario ou e-mail. Fale com o administrador.' }, 409, headers);
      }
      return json({ ok: true, pendente: true,
                    detail: 'Cadastro enviado. Um administrador precisa liberar seu acesso.' }, 200, headers);
    }

    // Pedido de recuperacao de senha. Nao ha envio de e-mail no Worker, entao o
    // pedido entra numa fila que o admin ve no painel e resolve gerando nova senha.
    if (body.action === 'recuperar') {
      if (!env.POKER_DB) return json({ error: 'indisponivel' }, 503, headers);
      await contasMigrar(env.POKER_DB);
      const quem = String(body.login || body.email || '').trim().toLowerCase();
      if (!quem) return json({ error: 'dados', detail: 'Informe seu usuario ou e-mail.' }, 400, headers);
      const u = await env.POKER_DB.prepare(
        'SELECT id FROM usuario WHERE login = ? OR email = ?').bind(quem, quem).first();
      if (u) {
        await env.POKER_DB.prepare(
          `INSERT INTO senha_pedido (id, usuario_id, criado_em, atendido) VALUES (?,?,?,0)`)
          .bind('p-' + crypto.randomUUID().slice(0, 8), u.id, new Date().toISOString()).run();
      }
      // Resposta identica exista ou nao a conta: senao isto viraria um verificador
      // de quem tem acesso ao sistema.
      return json({ ok: true, detail: 'Pedido registrado. O administrador vai gerar uma nova senha e entregar a voce.' }, 200, headers);
    }

    // Abertura de demanda pelo proprio dev, por HTTP. Serve para o bug que chega
    // direto para ele e para automacao — alerta de monitoramento, script, o que for.
    // Exige credencial de dev: nao e rota publica.
    //
    // O `dev` NAO vem do corpo: sai de quem esta autenticado. Se viesse do corpo,
    // qualquer dev poderia lancar demanda no nome de outro.
    // Proposta de projeto pelo dev. Nasce PENDENTE: quem valida e o PM/PO, e ate
    // a aprovacao nao se pode pendurar demanda nela (corrigeProjetoInvalido).
    // Admin tambem pode usar, e nesse caso ja nasce aprovado — criar no Admin e
    // a aprovacao, nao faria sentido o PM/PO aprovar a si mesmo.

    // ═══════════════════════════════════════════════════════════════════
    // API DO DEV
    // Serve automacao: a skill do dev cria a milestone, marca as tarefas no git,
    // pega o codigo AX da demanda e amarra tudo na issue principal.
    //
    // REGRA QUE NAO SE NEGOCIA: nada aqui conclui demanda. O maximo que um dev
    // faz e entregar para validacao; quem fecha e o PM/PO, na tela dele. Por isso
    // `status_planejamento` NAO esta na lista de campos aceitos por
    // demanda-atualizar — se estivesse, bastaria mandar "concluido" e a etapa de
    // validacao deixaria de existir para quem usa a API.
    // ═══════════════════════════════════════════════════════════════════

    // Subconjunto util de uma demanda. Nao devolve o objeto cru: campos internos
    // mudam de forma sem aviso, e quem automatiza acabaria dependendo deles.
    const devVisao = (m, temas) => ({
      id: m.id,
      codigo: m.codigo || '',
      titulo: m.titulo || '',
      descricao: m.descricao || '',
      etapa: m.status_planejamento || 'backlog',
      tipo: m.tipo || '',
      tema_id: m.tema_id || '',
      tema: ((temas || []).find(t => String(t.id) === String(m.tema_id)) || {}).nome || '',
      dev: m.dev || '',
      solicitante: m.solicitante || '',
      inicio: m.inicio || '',
      entrega: m.entrega || '',
      pontos: m.poker_pontos == null ? null : m.poker_pontos,
      horas_realizadas: m.horas_realizadas || 0,
      implementacao: m.implementacao || '',
      link_externo: m.link_externo || '',
      projeto_id: m.projeto_id || '',
      pausado: !!String(m.pausado_em || '').trim(),
      pausa_motivo: m.pausa_motivo || '',
      entregue_em: m.entregue_em || '',
      concluido_em: m.concluido_em || '',
      criado_em: m.criado_em || '',
      // Estado derivado, para a automacao nao ter de reimplementar a regra:
      aguardando_validacao: (m.status_planejamento || '') === 'validacao',
      concluida: (m.status_planejamento || '') === 'concluido',
    });

    const ETAPAS_DEV = ['backlog', 'levantar_req', 'planning', 'planejado', 'em_andamento'];

    if (['demandas-minhas', 'demanda-consultar', 'demanda-atualizar', 'demanda-entregar']
        .includes(body.action)) {
      const perm = await exigePapel(env, body, ['dev', 'admin'], headers);
      if (perm.recusa) return perm.recusa;
      const ident = perm.ident;
      const ehAdm = ident.papel === 'admin';
      const eu = (ident.usuario && ident.usuario.nome) || limpaTexto(body.dev, 80);

      const rawRes = await gh('contents/' + FILE_PATH + '?raw=' + Date.now(),
        { headers: { Accept: 'application/vnd.github.raw' } });
      if (!rawRes.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
      const base = JSON.parse(await rawRes.text());
      const temas = base.temas || [];
      const todas = (base.melhorias || []).filter(m => m && !m.mesclado_em && !m.oculto);
      // Um campo com "Ana / Bruno" e uma demanda de dois: comparar a string inteira
      // deixaria os dois de fora da propria lista.
      // Posse da demanda. O campo `dev` e texto livre digitado no planejamento, e o
      // nome da CONTA e o nome completo: "Joao Vitor Batista de Siqueira" na conta
      // contra "Joao Vitor" na demanda. Comparar texto exato reprovava o dono da
      // propria demanda — reportado por quem tentou usar a API e recebeu
      // "nao_sua" em todas as suas.
      //
      // A comparacao normaliza (acento, caixa, espaco repetido) e aceita que um
      // nome seja o COMECO do outro, desde que com dois nomes ou mais. Dois nomes
      // e o limite deliberado: "Joao" sozinho casaria com qualquer Joao da equipe,
      // e isto decide quem pode gravar.
      //
      // Ainda ha um risco residual: duas contas que comecem com os mesmos dois
      // nomes se reconheceriam na mesma demanda. Resolver de vez pede um campo
      // explicito na conta ("nome usado nas demandas"); enquanto isso, isto
      // desbloqueia sem afrouxar para nome unico.
      const normNome = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/\s+/g, ' ').trim();
      const mesmaPessoa = (a, b) => {
        const x = normNome(a), y = normNome(b);
        if (!x || !y) return false;
        if (x === y) return true;
        const curto = x.length <= y.length ? x : y;
        const longo = x.length <= y.length ? y : x;
        if (curto.split(' ').length < 2) return false;
        return longo === curto || longo.startsWith(curto + ' ');
      };
      const meuDono = m => String(m.dev || '').split('/').map(x => x.trim())
        .some(n => mesmaPessoa(n, eu));

      if (body.action === 'demandas-minhas') {
        if (!eu) {
          return json({ error: 'dev',
                        detail: 'Sem conta identificada, informe "dev" com o seu nome.' }, 400, headers);
        }
        let lista = todas.filter(meuDono);
        const etapa = String(body.etapa || '').trim();
        if (etapa) {
          const pedidas = etapa.split(',').map(x => x.trim()).filter(Boolean);
          lista = lista.filter(m => pedidas.includes(m.status_planejamento || 'backlog'));
        }
        if (body.pausadas === false) lista = lista.filter(m => !String(m.pausado_em || '').trim());
        lista.sort((a, b) => String(a.entrega || '9999').localeCompare(String(b.entrega || '9999')));
        return json({ ok: true, dev: eu, total: lista.length,
                      demandas: lista.map(m => devVisao(m, temas)) }, 200, headers);
      }

      // Consulta por codigo (AX-###) ou por id. O codigo e o que a pessoa tem em
      // maos, vindo do card ou do commit.
      const acha = () => {
        const cod = String(body.codigo || '').trim().toUpperCase().replace(/\s+/g, '');
        const id = String(body.id || '').trim();
        if (id) return todas.find(m => m.id === id);
        if (!cod) return null;
        const norm = c => String(c || '').toUpperCase().replace(/-/g, '');
        return todas.find(m => norm(m.codigo) === norm(cod));
      };

      if (body.action === 'demanda-consultar') {
        const m = acha();
        if (!m) {
          return json({ error: 'nao_encontrada',
                        detail: 'Informe "codigo" (ex.: AX-042) ou "id" de uma demanda existente.' }, 404, headers);
        }
        return json({ ok: true, demanda: devVisao(m, temas) }, 200, headers);
      }

      // ── daqui para baixo, escreve ──────────────────────────────────────
      const alvo = acha();
      if (!alvo) {
        return json({ error: 'nao_encontrada',
                      detail: 'Informe "codigo" (ex.: AX-042) ou "id" de uma demanda existente.' }, 404, headers);
      }
      if (!ehAdm && !meuDono(alvo)) {
        return json({ error: 'nao_sua',
                      detail: 'Esta demanda esta com ' + (alvo.dev || 'outra pessoa') +
                              '. Pela API voce altera apenas as suas.' }, 403, headers);
      }
      // Mesma regra da tela do dev, que e mais estreita do que "congelada":
      // em validacao ele NAO move a demanda nem troca o projeto, mas corrigir a
      // propria descricao e as horas segue liberado — pedir mais detalhe no texto
      // e justamente o caso mais comum enquanto o PM/PO analisa. Se a API
      // recusasse, ela contradiria a tela, e quem automatiza receberia erro no que
      // a interface aceita. Concluida continua fechada para tudo.
      const etapaAtual = alvo.status_planejamento || 'backlog';
      if (etapaAtual === 'concluido') {
        return json({ error: 'concluida',
                      detail: 'Demanda concluida e validada: nao pode ser alterada pela API.' }, 409, headers);
      }
      const emValidacao = etapaAtual === 'validacao';
      if (emValidacao && body.action === 'demanda-entregar') {
        return json({ error: 'em_validacao',
                      detail: 'Demanda ja esta aguardando validacao do PM/PO.' }, 409, headers);
      }
      if (emValidacao && (typeof body.etapa === 'string' && body.etapa.trim())) {
        return json({ error: 'em_validacao',
                      detail: 'Demanda com o PM/PO: a etapa nao muda por aqui. Corrija o texto e as ' +
                              'horas se precisar; para mudar de etapa, peca ao PM/PO para devolver.' }, 409, headers);
      }
      if (emValidacao && typeof body.projeto_id === 'string') {
        return json({ error: 'em_validacao',
                      detail: 'Demanda com o PM/PO: o vinculo de projeto nao muda por aqui.' }, 409, headers);
      }

      // Releitura para pegar o sha e gravar sobre a versao corrente.
      const metaRes = await gh('contents/' + FILE_PATH + '?t=' + Date.now());
      if (!metaRes.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
      const file = await metaRes.json();
      const raw2 = await gh('contents/' + FILE_PATH + '?raw=' + Date.now(),
        { headers: { Accept: 'application/vnd.github.raw' } });
      if (!raw2.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
      const atual = JSON.parse(await raw2.text());
      const m = (atual.melhorias || []).find(x => x.id === alvo.id);
      if (!m) return json({ error: 'nao_encontrada' }, 404, headers);

      const mudou = [];
      let msg = '';

      if (body.action === 'demanda-atualizar') {
        // Lista fechada, de proposito. Etapa, prazo, dev e pontos ficam FORA: sao
        // decisao de planejamento, e abrir isso pela API tiraria do PM/PO o
        // controle do funil sem ninguem perceber.
        if (typeof body.implementacao === 'string') {
          m.implementacao = limpaTexto(body.implementacao, 4000); mudou.push('implementacao');
        }
        if (typeof body.descricao === 'string') {
          m.descricao = limpaTexto(body.descricao, 4000); mudou.push('descricao');
        }
        if (typeof body.observacao === 'string') {
          m.observacao = limpaTexto(body.observacao, 2000); mudou.push('observacao');
        }
        if (typeof body.link_externo === 'string') {
          const u = limpaTexto(body.link_externo, 500);
          if (u && !/^https?:\/\//i.test(u)) {
            return json({ error: 'link_externo',
                          detail: 'O link deve comecar com http:// ou https://.' }, 400, headers);
          }
          m.link_externo = u; mudou.push('link_externo');
        }
        if (body.horas_realizadas !== undefined) {
          const h = Number(body.horas_realizadas);
          if (!Number.isFinite(h) || h < 0) {
            return json({ error: 'horas_realizadas',
                          detail: 'Informe um numero de horas maior ou igual a zero.' }, 400, headers);
          }
          m.horas_realizadas = h; mudou.push('horas_realizadas');
        }
        if (typeof body.etapa === 'string' && body.etapa.trim()) {
          const e = body.etapa.trim();
          if (!ETAPAS_DEV.includes(e)) {
            return json({ error: 'etapa',
                          detail: 'Pela API a etapa vai ate "em_andamento". Para entregar use ' +
                                  'demanda-entregar; concluir e do PM/PO.',
                          aceitas: ETAPAS_DEV }, 400, headers);
          }
          m.status_planejamento = e; mudou.push('etapa');
        }
        if (typeof body.projeto_id === 'string') {
          const pid = body.projeto_id.trim();
          if (pid) {
            const p = (atual.projetos || []).find(x => x.id === pid);
            if (!p) return json({ error: 'projeto_id', detail: 'Projeto nao encontrado.' }, 400, headers);
            if (!projetoAprovado(p)) {
              return json({ error: 'projeto_nao_aprovado',
                            detail: 'O projeto "' + (p.nome || '') + '" ainda nao foi aprovado pelo PM/PO.' }, 409, headers);
            }
          }
          m.projeto_id = pid; mudou.push('projeto_id');
        }
        if (!mudou.length) {
          return json({ error: 'nada_a_mudar',
                        detail: 'Informe ao menos um campo: implementacao, descricao, observacao, ' +
                                'link_externo, horas_realizadas, etapa ou projeto_id.' }, 400, headers);
        }
        msg = 'chore: ' + (m.codigo || m.id) + ' atualizada por ' + (eu || 'api') +
              ' (' + mudou.join(', ') + ')';
      }

      if (body.action === 'demanda-entregar') {
        // Mesmas exigencias da tela, e nao por simetria: sem o texto o PM/PO nao
        // tem o que validar, e sem horas o relatorio do comitê sai furado.
        const impl = limpaTexto(body.implementacao, 4000) || String(m.implementacao || '').trim();
        if (!impl) {
          return json({ error: 'implementacao',
                        detail: 'Descreva o que foi implementado: e o texto que o PM/PO le para validar.' }, 400, headers);
        }
        const h = body.horas_realizadas !== undefined
          ? Number(body.horas_realizadas) : Number(m.horas_realizadas);
        if (!Number.isFinite(h) || h <= 0) {
          return json({ error: 'horas_realizadas',
                        detail: 'Informe as horas de desenvolvimento (maior que zero).' }, 400, headers);
        }
        if (typeof body.link_externo === 'string' && body.link_externo.trim()) {
          const u = limpaTexto(body.link_externo, 500);
          if (!/^https?:\/\//i.test(u)) {
            return json({ error: 'link_externo',
                          detail: 'O link deve comecar com http:// ou https://.' }, 400, headers);
          }
          m.link_externo = u;
        }
        m.implementacao = impl;
        m.horas_realizadas = h;
        m.status_planejamento = 'validacao';
        m.status = 'iniciada';
        if (!m.entregue_em) m.entregue_em = new Date().toISOString();
        // NAO grava concluido_em: quem entrega nao conclui. A data nasce na
        // aprovacao do PM/PO.
        mudou.push('entregue para validacao');
        msg = 'chore: ' + (m.codigo || m.id) + ' entregue para validacao por ' + (eu || 'api');
      }

      normalizaEstados(atual);
      registraHistorico(atual, base, eu || ident.papel, 'api');
      atribuiCodigos(atual);
      corrigeProjetoInvalido(atual);
      atual.atualizado_em = new Date().toISOString();
      const put = await gh('contents/' + FILE_PATH, {
        method: 'PUT',
        body: JSON.stringify({ message: msg, content: toB64(JSON.stringify(atual)), sha: file.sha }),
      });
      if (!put.ok) {
        const t = await put.text();
        return json({ error: 'Falha ao salvar', detail: t.slice(0, 200) }, 502, headers);
      }
      return json({ ok: true, alterado: mudou,
                    demanda: devVisao((atual.melhorias || []).find(x => x.id === alvo.id) || m,
                                      atual.temas || []) }, 200, headers);
    }

    if (body.action === 'projeto-novo') {
      const perm = await exigePapel(env, body, ['dev', 'admin'], headers);
      if (perm.recusa) return perm.recusa;
      const ident = perm.ident;
      const nome = limpaTexto(body.nome, 160);
      if (nome.length < 3) {
        return json({ error: 'nome', detail: 'Informe o nome do projeto.' }, 400, headers);
      }
      const getRes = await gh('contents/' + FILE_PATH + '?t=' + Date.now());
      if (!getRes.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
      const file = await getRes.json();
      const rawRes = await gh('contents/' + FILE_PATH + '?raw=' + Date.now(),
        { headers: { Accept: 'application/vnd.github.raw' } });
      if (!rawRes.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
      const atual = JSON.parse(await rawRes.text());
      atual.projetos = atual.projetos || [];

      // Nome repetido cria dois projetos que ninguem distingue no relatorio.
      const norm = t => String(t || '').trim().toLowerCase();
      const igual = atual.projetos.find(p => norm(p.nome) === norm(nome));
      if (igual) {
        return json({ error: 'duplicado',
                      detail: 'Ja existe um projeto chamado "' + (igual.nome || '') + '"' +
                              (igual.codigo ? ' (' + igual.codigo + ')' : '') + '.' }, 409, headers);
      }
      const quem = (ident.usuario && ident.usuario.nome) || limpaTexto(body.dev, 80);
      if (!quem) {
        return json({ error: 'dev',
                      detail: 'Sem conta identificada, informe "dev" com o seu nome.' }, 400, headers);
      }
      const ehAdm = ident.papel === 'admin';
      const agora = new Date().toISOString();
      const novo = {
        id: 'prj-' + Date.now().toString(36) + '-' + crypto.randomUUID().slice(0, 6),
        codigo: '',
        nome,
        descricao: limpaTexto(body.descricao, 4000),
        justificativa: limpaTexto(body.justificativa, 2000),
        status: 'planejado',
        responsavel: limpaTexto(body.responsavel, 80) || quem,
        inicio: '', fim: '', anexos: [],
        origem: ehAdm ? 'admin' : 'dev',
        solicitado_por: quem,
        aprovacao: ehAdm ? 'aprovado' : 'pendente',
        aprovado_em: ehAdm ? agora : '',
        aprovado_por: ehAdm ? quem : '',
        recusa_motivo: '',
        criado_em: agora,
        atualizado_em: agora,
      };
      atual.projetos.push(novo);
      atribuiCodigosProjeto(atual);
      atual.atualizado_em = agora;
      const put = await gh('contents/' + FILE_PATH, {
        method: 'PUT',
        body: JSON.stringify({ message: 'chore: projeto proposto por ' + quem,
                               content: toB64(JSON.stringify(atual)), sha: file.sha }),
      });
      if (!put.ok) {
        const t = await put.text();
        return json({ error: 'Falha ao salvar', detail: t.slice(0, 200) }, 502, headers);
      }
      const salvo = atual.projetos.find(p => p.id === novo.id);
      return json({ ok: true, id: salvo.id, codigo: salvo.codigo || '',
                    aprovacao: salvo.aprovacao, nome: salvo.nome }, 200, headers);
    }

    if (body.action === 'demanda-nova') {
      const perm = await exigePapel(env, body, ['dev', 'admin'], headers);
      if (perm.recusa) return perm.recusa;
      const ident = perm.ident;
      const titulo = limpaTexto(body.titulo, 200);
      if (titulo.length < 3) {
        return json({ error: 'titulo', detail: 'Informe o titulo da demanda.' }, 400, headers);
      }
      const tipo = ['sustentacao', 'evolucao'].includes(body.tipo) ? body.tipo : '';
      if (!tipo) {
        return json({ error: 'tipo',
                      detail: 'Informe tipo: "sustentacao" (Erro/Bug) ou "evolucao" (Melhoria).' }, 400, headers);
      }
      // Duas chamadas de proposito, como nas outras rotas de escrita: a primeira
      // traz o `sha` que o PUT exige, a segunda traz o conteudo em UTF-8.
      // NAO usar atob(file.content): atob devolve os bytes como Latin-1, entao
      // cada caractere acentuado vira dois na memoria e a gravacao assa isso no
      // arquivo. Custou 1864 acentos corrompidos em 04/08/2026.
      const getRes = await gh('contents/' + FILE_PATH + '?t=' + Date.now());
      if (!getRes.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
      const file = await getRes.json();
      const rawRes = await gh('contents/' + FILE_PATH + '?raw=' + Date.now(),
        { headers: { Accept: 'application/vnd.github.raw' } });
      if (!rawRes.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
      const atual = JSON.parse(await rawRes.text());

      // O tema tem de existir: aceitar texto livre criaria tema duplicado a cada
      // chamada e sujaria a classificacao para todo mundo.
      const temaId = body.tema_id;
      const tema = (atual.temas || []).find(t => String(t.id) === String(temaId));
      if (!tema) {
        return json({ error: 'tema',
                      detail: 'tema_id invalido. Consulte a lista em temas-publicos.' }, 400, headers);
      }
      // Quem abre e o dono. Conta legada (senha compartilhada) precisa dizer quem e.
      const devNome = (ident.usuario && ident.usuario.nome) || limpaTexto(body.dev, 80);
      if (!devNome) {
        return json({ error: 'dev',
                      detail: 'Sem conta identificada, informe "dev" com o seu nome.' }, 400, headers);
      }
      const sp = ['backlog', 'planejado', 'em_andamento'].includes(body.status_planejamento)
        ? body.status_planejamento : 'em_andamento';
      const agora = new Date().toISOString();
      const nova = {
        id: 'ep-' + Date.now().toString(36) + '-' + crypto.randomUUID().slice(0, 6),
        codigo: '',                       // atribuido abaixo, como em qualquer gravacao
        titulo,
        descricao: limpaTexto(body.descricao, 4000),
        tema_id: tema.id,
        tipo,
        dev: devNome,
        solicitante: limpaTexto(body.solicitante, 80) || devNome,
        origem: 'endpoint',
        status_planejamento: sp,
        status: sp === 'backlog' ? 'recebida' : (sp === 'planejado' ? 'estimada' : 'iniciada'),
        inicio: /^\d{4}-\d{2}-\d{2}$/.test(String(body.inicio || '')) ? body.inicio : '',
        entrega: /^\d{4}-\d{2}-\d{2}$/.test(String(body.entrega || '')) ? body.entrega : '',
        prioridade: '', estimativa: '', horas_realizadas: 0,
        anexos: [], oculto: false,
        criado_em: agora,
      };
      atual.melhorias = atual.melhorias || [];
      atual.melhorias.push(nova);
      atribuiCodigos(atual);
      corrigeSemDev(atual);
      atual.atualizado_em = agora;
      const put = await gh('contents/' + FILE_PATH, {
        method: 'PUT',
        body: JSON.stringify({ message: 'chore: demanda aberta por ' + devNome + ' (endpoint)',
                               content: toB64(JSON.stringify(atual)), sha: file.sha }),
      });
      if (!put.ok) {
        const t = await put.text();
        return json({ error: 'Falha ao salvar', detail: t.slice(0, 200) }, 502, headers);
      }
      const salva = atual.melhorias.find(m => m.id === nova.id);
      return json({ ok: true, codigo: salva.codigo, id: salva.id,
                    status_planejamento: salva.status_planejamento, dev: salva.dev }, 200, headers);
    }

    if (body.action === 'login') {
      if (!env.POKER_DB) return json({ error: 'indisponivel' }, 503, headers);
      await contasMigrar(env.POKER_DB);
      const login = String(body.login || '').trim().toLowerCase();
      const senhaU = String(body.senhaUsuario || '');
      if (!login || !senhaU) return json({ error: 'dados', detail: 'Informe seu usuário (ou e-mail) e a senha.' }, 400, headers);
      // Entra pelo e-mail (o que a pessoa sabe) ou pelo login interno, que segue
      // valendo para as contas criadas antes desta mudanca.
      const u = await env.POKER_DB.prepare(
        'SELECT * FROM usuario WHERE login = ? OR email = ?').bind(login, login).first();
      // Mesma resposta para usuario inexistente e senha errada: dizer qual dos
      // dois falhou permitiria descobrir quem tem conta.
      const generico = async () => {
        const n = await contaTentativa(env, ip, 'login');
        return json({ error: 'credencial', detail: 'Usuário ou senha inválidos.' }, 401, headers);
      };
      if (!u) return generico();
      // Conta recem-cadastrada esperando liberacao: dizer isso evita chamado de
      // suporte e a pessoa acabou de se cadastrar, ja sabe que a conta existe.
      if (u.pendente) {
        return json({ error: 'pendente',
                      detail: 'Seu cadastro ainda não foi liberado por um administrador.' }, 403, headers);
      }
      if (!u.ativo) return generico();
      const hash = await derivaSenha(senhaU, u.salt);
      if (!igualSeguro(hash, u.senha_hash)) return generico();

      const token = crypto.randomUUID() + '-' + crypto.randomUUID();
      // Marcacao de tempo local: `agora`/`iso` pertencem ao bloco do poker.
      const nowIso = new Date().toISOString();
      const expira = new Date(Date.now() + SESSAO_H * 3600 * 1000).toISOString();
      await env.POKER_DB.prepare('INSERT INTO sessao (token, usuario_id, expira_em, criado_em) VALUES (?,?,?,?)')
        .bind(token, u.id, expira, nowIso).run();
      await env.POKER_DB.prepare('UPDATE usuario SET ultimo_acesso = ? WHERE id = ?').bind(nowIso, u.id).run();
      if (Math.random() < 0.1) await env.POKER_DB.prepare('DELETE FROM sessao WHERE expira_em < ?').bind(nowIso).run();
      return json({ ok: true, token, expira_em: expira,
                    usuario: { login: u.login, nome: u.nome, papel: u.papel } }, 200, headers);
    }

    if (body.action === 'logout') {
      if (env.POKER_DB && body.token) {
        await contasMigrar(env.POKER_DB);
        await env.POKER_DB.prepare('DELETE FROM sessao WHERE token = ?').bind(String(body.token)).run();
      }
      return json({ ok: true }, 200, headers);
    }

    // Quem sou eu — o painel usa para saber o papel e mostrar so o que cabe.
    if (body.action === 'quem-sou') {
      const ident = await identifica(env, body);
      if (!ident) return json({ error: 'credencial' }, 401, headers);
      return json({ ok: true, papel: ident.papel, usuario: ident.usuario,
                    legado: !ident.usuario }, 200, headers);
    }

    // Gestao de usuarios — so admin.
    if (body.action === 'usuarios') {
      if (!env.POKER_DB) return json({ error: 'indisponivel' }, 503, headers);
      // Mesmo ponto das outras rotas. temNivel compara por hierarquia (NIVEL) e
      // aqui o minimo era admin, que e o topo — o efeito e identico, e passar pelo
      // exigePapel faz a recusa trazer a instrucao em vez de sair seca.
      const permU = await exigePapel(env, body, ['admin'], headers);
      if (permU.recusa) return permU.recusa;
      const identU = permU.ident;
      await contasMigrar(env.POKER_DB);
      const op = String(body.op || 'listar');

      if (op === 'listar') {
        const r = await env.POKER_DB.prepare(
          `SELECT id, login, nome, email, papel, ativo, pendente, criado_em, ultimo_acesso
             FROM usuario ORDER BY pendente DESC, nome`).all();
        // Pedidos de senha em aberto, para o admin resolver na mesma tela.
        const p = await env.POKER_DB.prepare(
          `SELECT p.id, p.criado_em, u.login, u.nome
             FROM senha_pedido p JOIN usuario u ON u.id = p.usuario_id
            WHERE p.atendido = 0 ORDER BY p.criado_em`).all();
        return json({ ok: true, usuarios: r.results || [], pedidos: p.results || [] }, 200, headers);
      }

      // Libera um cadastro pendente, ja definindo a permissao.
      if (op === 'aprovar') {
        const login = String(body.login || '').trim().toLowerCase();
        const papel = PAPEIS.includes(body.papel) ? body.papel : 'dev';
        const uu = await env.POKER_DB.prepare('SELECT id FROM usuario WHERE login = ?').bind(login).first();
        if (!uu) return json({ error: 'nao_encontrado' }, 404, headers);
        await env.POKER_DB.prepare('UPDATE usuario SET pendente = 0, ativo = 1, papel = ? WHERE id = ?')
          .bind(papel, uu.id).run();
        return json({ ok: true }, 200, headers);
      }

      // Recusa um cadastro pendente: apaga, para nao deixar login ocupado.
      if (op === 'recusar') {
        const login = String(body.login || '').trim().toLowerCase();
        const uu = await env.POKER_DB.prepare(
          'SELECT id, pendente FROM usuario WHERE login = ?').bind(login).first();
        if (!uu) return json({ error: 'nao_encontrado' }, 404, headers);
        // Trava de seguranca: recusar so vale para cadastro que nunca foi liberado.
        // Em conta ativa, o caminho e desativar — que preserva o historico.
        if (!uu.pendente) return json({ error: 'nao_pendente', detail: 'Esta conta ja esta em uso. Use Desativar.' }, 409, headers);
        await env.POKER_DB.prepare('DELETE FROM senha_pedido WHERE usuario_id = ?').bind(uu.id).run();
        await env.POKER_DB.prepare('DELETE FROM usuario WHERE id = ?').bind(uu.id).run();
        return json({ ok: true }, 200, headers);
      }

      if (op === 'criar' || op === 'senha') {
        let login = String(body.login || '').trim().toLowerCase();
        const emailC = String(body.email || '').trim().toLowerCase();
        const nova = String(body.senhaNova || '');
        // Na criacao o login e opcional: sem ele, sai do e-mail. Em `senha` ele e
        // a chave de quem vai trocar, entao continua vindo preenchido.
        if (op === 'criar' && !login && emailC) login = await loginLivre(env.POKER_DB, loginDoEmail(emailC));
        if (!/^[a-z0-9._-]{3,24}$/.test(login)) {
          return json({ error: 'login', detail: 'Informe o e-mail da pessoa.' }, 400, headers);
        }
        if (nova.length < 8) return json({ error: 'senha_curta', detail: 'A senha precisa de ao menos 8 caracteres.' }, 400, headers);
        const salt = hexDe(crypto.getRandomValues(new Uint8Array(16)));
        const hash = await derivaSenha(nova, salt);

        if (op === 'criar') {
          const papel = PAPEIS.includes(body.papel) ? body.papel : 'consulta';
          const nome = limpaTexto(body.nome, 80) || login;
          try {
            await env.POKER_DB.prepare(
              `INSERT INTO usuario (id, login, nome, email, senha_hash, salt, papel, ativo, criado_em)
               VALUES (?,?,?,?,?,?,?,1,?)`)
              .bind('u-' + crypto.randomUUID().slice(0, 8), login, nome, emailC || null, hash, salt, papel,
                    new Date().toISOString()).run();
          } catch (e) {
            return json({ error: 'existe', detail: 'Ja existe usuario com esse login.' }, 409, headers);
          }
          return json({ ok: true, login }, 200, headers);
        }
        const uu = await env.POKER_DB.prepare(
          'SELECT id FROM usuario WHERE login = ? OR email = ?').bind(login, login).first();
        if (!uu) return json({ error: 'nao_encontrado' }, 404, headers);
        await env.POKER_DB.prepare('UPDATE usuario SET senha_hash = ?, salt = ? WHERE id = ?')
          .bind(hash, salt, uu.id).run();
        // trocar senha encerra as sessoes abertas daquela pessoa
        await env.POKER_DB.prepare('DELETE FROM sessao WHERE usuario_id = ?').bind(uu.id).run();
        // Resolve o pedido de recuperacao, se havia um em aberto.
        await env.POKER_DB.prepare('UPDATE senha_pedido SET atendido = 1 WHERE usuario_id = ?')
          .bind(uu.id).run();
        return json({ ok: true }, 200, headers);
      }

      // Contas criadas antes da coluna `email` existir ficaram sem e-mail e so
      // entram pelo login. Isto permite completar o cadastro delas.
      if (op === 'email') {
        const login = String(body.login || '').trim().toLowerCase();
        const novo = String(body.email || '').trim().toLowerCase();
        if (novo && (!novo.endsWith(EMAIL_DOMINIO) || !/^[a-z0-9._%+-]+@/.test(novo))) {
          return json({ error: 'email', detail: 'O e-mail precisa terminar em ' + EMAIL_DOMINIO + '.' }, 400, headers);
        }
        const uu = await env.POKER_DB.prepare('SELECT id FROM usuario WHERE login = ?').bind(login).first();
        if (!uu) return json({ error: 'nao_encontrado' }, 404, headers);
        try {
          await env.POKER_DB.prepare('UPDATE usuario SET email = ? WHERE id = ?')
            .bind(novo || null, uu.id).run();
        } catch (e) {
          return json({ error: 'existe', detail: 'Outra conta já usa esse e-mail.' }, 409, headers);
        }
        return json({ ok: true }, 200, headers);
      }

      if (op === 'papel' || op === 'ativo') {
        const login = String(body.login || '').trim().toLowerCase();
        const uu = await env.POKER_DB.prepare('SELECT id, papel FROM usuario WHERE login = ?').bind(login).first();
        if (!uu) return json({ error: 'nao_encontrado' }, 404, headers);
        const contaAdmins = async () => {
          const c = await env.POKER_DB.prepare(
            'SELECT COUNT(*) AS n FROM usuario WHERE papel = ? AND ativo = 1').bind('admin').first();
          return (c && c.n) || 0;
        };
        if (op === 'papel') {
          if (!PAPEIS.includes(body.papel)) return json({ error: 'papel_invalido' }, 400, headers);
          // Nao deixa remover o ultimo admin: sem admin ninguem gerencia contas.
          if (uu.papel === 'admin' && body.papel !== 'admin' && (await contaAdmins()) <= 1) {
            return json({ error: 'ultimo_admin', detail: 'Este e o unico admin ativo. Promova outra pessoa antes.' }, 409, headers);
          }
          await env.POKER_DB.prepare('UPDATE usuario SET papel = ? WHERE id = ?').bind(body.papel, uu.id).run();
        } else {
          const ativo = body.ativo ? 1 : 0;
          if (!ativo && uu.papel === 'admin' && (await contaAdmins()) <= 1) {
            return json({ error: 'ultimo_admin', detail: 'Este e o unico admin ativo.' }, 409, headers);
          }
          await env.POKER_DB.prepare('UPDATE usuario SET ativo = ? WHERE id = ?').bind(ativo, uu.id).run();
          if (!ativo) await env.POKER_DB.prepare('DELETE FROM sessao WHERE usuario_id = ?').bind(uu.id).run();
        }
        return json({ ok: true }, 200, headers);
      }
      return json({ error: 'op_invalida' }, 400, headers);
    }

    if (body.action === 'dados') {
      // 401 sinaliza ao painel que ele deve pedir a credencial. O cliente reage
      // ao status, entao nao precisa saber se a trava esta ligada ou nao.
      if (!(await leituraLiberadaAsync(body))) return json({ error: 'credencial' }, 401, headers);
      const rawRes = await gh('contents/' + FILE_PATH + '?raw=' + Date.now(), { headers: { Accept: 'application/vnd.github.raw' } });
      if (!rawRes.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
      return new Response(await rawRes.text(), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
      });
    }

    // ── Login do Admin ──
    if (body.action === 'auth') {
      if (senhaOk(body.senha)) return json({ ok: true }, 200, headers);
      // Senha errada: conta e provoca. O painel reage ao status 401, nao ao corpo,
      // entao a mensagem extra nao muda o comportamento das telas.
      const nAuth = await contaTentativa(env, ip, 'auth');
      return json({ error: 'senha' }, 401, headers);
    }

    // ── Publicação do Admin (estado completo) ──
    if (body.action === 'publish') {
      // admin por conta (token) ou pela senha compartilhada, durante a transicao
      if (!(await ehAdmin())) return json({ error: 'senha' }, 401, headers);
      const data = body.data;
      if (!data || !Array.isArray(data.melhorias)) return json({ error: 'dados invalidos' }, 400, headers);
      if (JSON.stringify(data).length > 25 * 1024 * 1024) return json({ error: 'Conteudo muito grande' }, 413, headers);
      const getRes = await gh('contents/' + FILE_PATH + '?t=' + Date.now());
      if (!getRes.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
      const file = await getRes.json();
      const risco = gravacaoSuspeita(data, file.size || 0);
      if (risco) return json({ error: risco }, 409, headers);
      const conf = await conflito(gh, body, headers);
      if (conf) return conf;
      // Antes de mexer em nada: compara com o que esta gravado.
      const antesPub = JSON.parse(await (await gh('contents/' + FILE_PATH + '?raw=' + Date.now(),
        { headers: { Accept: 'application/vnd.github.raw' } })).text());
      registraHistorico(data, antesPub, (_ident && _ident.usuario && _ident.usuario.nome) ||
                        (await papelAtual()) || '', 'painel');
      normalizaEstados(data);
      atribuiCodigos(data);
      atribuiCodigosProjeto(data);
      const semDev = corrigeSemDev(data);
      const soltas = corrigeProjetoInvalido(data);
      // O codigo nasce aqui, entao o cliente nao tem como saber qual foi. Devolver
      // o mapa evita uma releitura inteira da base so para descobrir o numero.
      const codigosMel = {};
      (data.melhorias || []).forEach(m => { if (m && m.id && m.codigo) codigosMel[m.id] = m.codigo; });
      const codigosPrj = {};
      (data.projetos || []).forEach(p => { if (p && p.id && p.codigo) codigosPrj[p.id] = p.codigo; });
      data.atualizado_em = new Date().toISOString();
      const putRes = await gh('contents/' + FILE_PATH, {
        method: 'PUT',
        body: JSON.stringify({ message: 'chore: admin publica ' + new Date().toISOString(), content: toB64(JSON.stringify(data)), sha: file.sha }),
      });
      if (!putRes.ok) { const e = await putRes.text(); return json({ error: 'Falha ao salvar', detail: e }, 502, headers); }
      return json({ ok: true, codigos: codigosMel, codigos_projeto: codigosPrj,
                    sem_dev: semDev, sem_projeto: soltas,
                    atualizado_em: data.atualizado_em }, 200, headers);
    }

    // Aceita a senha do time (DEV_SENHA) ou a do admin (ADMIN_SENHA). Enquanto
    // DEV_SENHA nao existir, a do admin resolve — assim exigir senha aqui nao
    // derruba o painel no momento do redeploy.

    // ── Login do Dev (painel dev) ──
    if (body.action === 'dev-auth') {
      return devOk(body.senha) ? json({ ok: true }, 200, headers) : json({ error: 'senha' }, 401, headers);
    }

    // ── Gravação do Dev (estado completo montado no navegador) ──
    // ANTES esta rota nao pedia senha: qualquer um com a URL do Worker (que esta
    // no HTML publico) podia sobrescrever toda a base com um curl. CORS nao
    // protege, porque so vale para navegador.
    if (body.action === 'dev-publish') {
      if (!(await ehDev())) return json({ error: 'senha' }, 401, headers);
      const data = body.data;
      if (!data || !Array.isArray(data.melhorias)) return json({ error: 'dados invalidos' }, 400, headers);
      if (JSON.stringify(data).length > 25 * 1024 * 1024) return json({ error: 'Conteudo muito grande' }, 413, headers);
      const getRes = await gh('contents/' + FILE_PATH + '?t=' + Date.now());
      if (!getRes.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
      const file = await getRes.json();
      const risco = gravacaoSuspeita(data, file.size || 0);
      if (risco) return json({ error: risco }, 409, headers);
      const confDev = await conflito(gh, body, headers);
      if (confDev) return confDev;
      const antesDev = JSON.parse(await (await gh('contents/' + FILE_PATH + '?raw=' + Date.now(),
        { headers: { Accept: 'application/vnd.github.raw' } })).text());
      // PROJETO NAO E EDITAVEL PELO DEV. Fechar, renomear ou reabrir projeto e do
      // PM/PO — e o painel do dev nem tem tela para isso. Mas esta rota recebe o
      // estado inteiro e grava o que recebe: sem esta linha, bastaria um corpo
      // montado a mao para mudar o status de um projeto. A lista do servidor
      // sempre vence.
      data.projetos = antesDev.projetos || [];
      registraHistorico(data, antesDev, (_ident && _ident.usuario && _ident.usuario.nome) ||
                        (await papelAtual()) || '', 'painel dev');
      normalizaEstados(data);
      atribuiCodigos(data);
      corrigeProjetoInvalido(data);
      data.atualizado_em = new Date().toISOString();
      const putRes = await gh('contents/' + FILE_PATH, {
        method: 'PUT',
        body: JSON.stringify({ message: 'chore: dev atualiza ' + new Date().toISOString(), content: toB64(JSON.stringify(data)), sha: file.sha }),
      });
      if (!putRes.ok) { const e = await putRes.text(); return json({ error: 'Falha ao salvar', detail: e }, 502, headers); }
      return json({ ok: true }, 200, headers);
    }

    // Acao presente mas desconhecida = sondagem. Antes caia no fluxo de sugestao
    // publica e respondia "Titulo obrigatorio", o que ja era uma pista. Agora e
    // recusada de forma explicita, e a superficie da API fica fechada ao que existe.
    if (typeof body.action === 'string' && body.action.length) {
      const nAcao = await contaTentativa(env, ip, 'acao-invalida');
      return json({ error: 'acao_invalida' }, 400, headers);
    }

    // ── Sugestão pública (dash) — só adiciona no Backlog ──
    // Captcha antes de tudo: barra automacao sem gastar chamada ao GitHub.
    const ts = await turnstileOk(env, body.turnstile, ip);
    if (!ts.ok) {
      const nTs = await contaTentativa(env, ip, 'captcha');
      return json({ error: 'captcha',
                    detail: ts.motivo === 'sem_token'
                      ? 'Confirme que voce nao e um robo antes de enviar.'
                      : 'Verificacao de seguranca nao passou. Recarregue a pagina e tente de novo.' }, 403, headers);
    }

    const m = body.melhoria || {};
    if (!m.titulo || !String(m.titulo).trim()) return json({ error: 'Titulo obrigatorio' }, 400, headers);
    if (JSON.stringify(body).length > 5 * 1024 * 1024) return json({ error: 'Conteudo muito grande' }, 413, headers);

    // sha via metadata (content vem vazio se >1MB); conteúdo via media type "raw".
    // Ler o base64 da Contents API quebrava aqui (JSON.parse de string vazia) e
    // era a causa do erro 1101 — o arquivo já passou de 1MB.
    const getRes = await gh('contents/' + FILE_PATH + '?t=' + Date.now());
    if (!getRes.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
    const file = await getRes.json();
    const rawRes = await gh('contents/' + FILE_PATH + '?raw=' + Date.now(), { headers: { Accept: 'application/vnd.github.raw' } });
    if (!rawRes.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
    const data = JSON.parse(await rawRes.text());
    data.melhorias = data.melhorias || [];
    data.temas = data.temas || [];

    let temaId = m.tema_id || '';
    (body.novosTemas || []).forEach(t => {
      if (!t || !t.nome) return;
      const existing = data.temas.find(x => (x.nome || '').toLowerCase() === t.nome.toLowerCase());
      if (existing) { if (temaId === t.id) temaId = existing.id; }
      else { const nome = limpaTexto(t.nome, 120); if (!nome) return;
             const novo = { id: uid(), nome }; data.temas.push(novo); if (temaId === t.id) temaId = novo.id; }
    });

    // tipo: aceita apenas os dois valores conhecidos; qualquer outra coisa entra
    // vazia e o Admin classifica ao planejar (nao confiamos no cliente).
    const TIPOS_VALIDOS = ['sustentacao', 'evolucao'];
    const tipo = TIPOS_VALIDOS.includes(m.tipo) ? m.tipo : '';

    // Todo texto que vem de fora passa pela limpeza. Sem isto, titulo com
    // "<img src=x onerror=...>" executava script no navegador do Admin.
    const nova = {
      titulo: limpaTexto(m.titulo, 300),
      descricao: limpaTexto(m.descricao, 4000),
      tema_id: temaId,
      tipo: tipo,
      solicitante: limpaTexto(m.solicitante, 120),
      discovery: m.discovery ? limpaProfundo(m.discovery, 0) : undefined,
      anexos: sanitizaAnexos(m.anexos),
      id: uid(),
      status: 'recebida',
      status_planejamento: 'backlog',
      dev: '', prioridade: '', inicio: '', entrega: '', estimativa: '',
      criado_em: new Date().toISOString(),
    };
    if (!nova.titulo) return json({ error: 'Titulo invalido' }, 400, headers);
    data.melhorias.push(nova);
    data.atualizado_em = new Date().toISOString();

    const putRes = await gh('contents/' + FILE_PATH, {
      method: 'PUT',
      body: JSON.stringify({ message: 'feat: nova sugestao (publico) - ' + nova.titulo, content: toB64(JSON.stringify(data)), sha: file.sha }),
    });
    if (!putRes.ok) { const e = await putRes.text(); return json({ error: 'Falha ao salvar', detail: e }, 502, headers); }
    return json({ ok: true, id: nova.id }, 200, headers);
  },
};
