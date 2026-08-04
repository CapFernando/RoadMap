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

// Mensagem para tentativa bloqueada. Vai SOMENTE em resposta que ja era negada
// (429, 401, acao invalida): nao revela nada que o requisitante ainda nao
// soubesse, entao provoca sem servir de pista. Cosmetico e dissuasorio — a
// seguranca real esta na senha, na trava de leitura e nos limites por IP.
const TROLL = [
  'Parabens pela tentativa de hackear. Registrada.',
  'Parabens pela tentativa de hackear. Boa sorte na proxima.',
  'Parabens pela tentativa de hackear. Sua origem foi anotada.',
];
function troll(i) { return TROLL[i % TROLL.length]; }

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
const PAPEIS = ['consulta', 'dev', 'admin'];
// So e-mail corporativo se cadastra. Qualquer endereco de fora e recusado.
const EMAIL_DOMINIO = '@audaxcapitalsa.com.br';
const NIVEL = { consulta: 1, dev: 2, admin: 3 };

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
function atribuiCodigosProjeto(data) {
  if (!data || !Array.isArray(data.projetos)) return 0;
  let maior = 0;
  for (const p of data.projetos) {
    const n = /^EP-(\d+)$/.exec(String(p && p.codigo || ''));
    if (n) maior = Math.max(maior, parseInt(n[1], 10));
  }
  let novos = 0;
  for (const p of data.projetos) {
    if (p && !p.codigo) { maior += 1; p.codigo = 'EP-' + String(maior).padStart(3, '0'); novos += 1; }
  }
  return novos;
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
function json(obj, status, headers) { return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...headers } }); }

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
      const n = await contaTentativa(env, ip, acaoLim);
      return json({ error: 'muitas_tentativas',
                    detail: 'Muitas requisicoes. Aguarde um minuto e tente de novo.',
                    mensagem: troll(n) + ' Tentativa #' + n + ' desta origem.' }, 429, headers);
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
    const ehDev   = async () => { const p = await papelAtual(); return p === 'dev' || p === 'admin'; };
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

      // Abre (ou reaproveita) a sessao — so o facilitador, com senha
      if (body.action === 'poker-abrir') {
        if (!senhaOk(body.senha)) return json({ error: 'senha' }, 401, headers);
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

        const enxuta = (m) => ({
          id: m.id, titulo: m.titulo || '', dev: m.dev || '', tipo: m.tipo || '',
          tema_id: m.tema_id || '', poker_pontos: m.poker_pontos ?? null,
          poker_media: m.poker_media ?? null, status_planejamento: m.status_planejamento || '',
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

      // Daqui pra baixo e o facilitador: exige senha
      if (!senhaOk(body.senha)) return json({ error: 'senha' }, 401, headers);

      if (body.action === 'poker-revelar') {
        // Acao de facilitador: o painel sempre manda a senha, mas o servidor nao
        // conferia. Sem isto, quem tivesse o codigo da sala revelava votos, trocava
        // a pauta ou gravava pontuacao em qualquer demanda do arquivo.
        if (!senhaOk(body.senha)) return json({ error: 'senha' }, 401, headers);
        await db.prepare('UPDATE poker_sessao SET revelado = 1 WHERE codigo = ?').bind(codigo).run();
        return json({ ok: true, estado: await pokerEstado(db, codigo) }, 200, headers);
      }

      // Troca a demanda em votacao e zera a rodada
      if (body.action === 'poker-demanda') {
        // Acao de facilitador: o painel sempre manda a senha, mas o servidor nao
        // conferia. Sem isto, quem tivesse o codigo da sala revelava votos, trocava
        // a pauta ou gravava pontuacao em qualquer demanda do arquivo.
        if (!senhaOk(body.senha)) return json({ error: 'senha' }, 401, headers);
        const mid = String(body.melhoria_id || '');
        await db.prepare('UPDATE poker_sessao SET melhoria_id = ?, revelado = 0 WHERE codigo = ?').bind(mid, codigo).run();
        await db.prepare('DELETE FROM poker_voto WHERE codigo = ? AND melhoria_id = ?').bind(codigo, mid).run();
        return json({ ok: true, estado: await pokerEstado(db, codigo) }, 200, headers);
      }

      // Zera tudo: sai da pauta, esconde resultado e apaga os votos da sessao.
      if (body.action === 'poker-zerar') {
        if (!senhaOk(body.senha)) return json({ error: 'senha' }, 401, headers);
        await db.prepare("UPDATE poker_sessao SET melhoria_id = '', revelado = 0 WHERE codigo = ?").bind(codigo).run();
        await db.prepare('DELETE FROM poker_voto WHERE codigo = ?').bind(codigo).run();
        return json({ ok: true, estado: await pokerEstado(db, codigo) }, 200, headers);
      }

      if (body.action === 'poker-revotar') {
        // Acao de facilitador: o painel sempre manda a senha, mas o servidor nao
        // conferia. Sem isto, quem tivesse o codigo da sala revelava votos, trocava
        // a pauta ou gravava pontuacao em qualquer demanda do arquivo.
        if (!senhaOk(body.senha)) return json({ error: 'senha' }, 401, headers);
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
        if (!senhaOk(body.senha)) return json({ error: 'senha' }, 401, headers);
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
        alvo.poker_media = media;
        alvo.poker_pontos = pontos;
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
          return json({ error: 'captcha', detail: 'Verificacao necessaria para anexar arquivo.',
                        mensagem: troll(n) + ' Tentativa #' + n + ' desta origem.' }, 403, headers);
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
        return json({ error: 'credencial', detail: 'Usuário ou senha inválidos.',
                      mensagem: troll(n) + ' Tentativa #' + n + '.' }, 401, headers);
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
      const identU = await identifica(env, body);
      if (!temNivel(identU, 'admin')) return json({ error: 'sem_permissao' }, 403, headers);
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
      return json({ error: 'senha', mensagem: troll(nAuth) + ' Tentativa #' + nAuth + '.' }, 401, headers);
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
      atribuiCodigos(data);
      atribuiCodigosProjeto(data);
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
      atribuiCodigos(data);
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
      return json({ error: 'acao_invalida',
                    mensagem: troll(nAcao) + ' Tentativa #' + nAcao + ' desta origem.' }, 400, headers);
    }

    // ── Sugestão pública (dash) — só adiciona no Backlog ──
    // Captcha antes de tudo: barra automacao sem gastar chamada ao GitHub.
    const ts = await turnstileOk(env, body.turnstile, ip);
    if (!ts.ok) {
      const nTs = await contaTentativa(env, ip, 'captcha');
      return json({ error: 'captcha',
                    detail: ts.motivo === 'sem_token'
                      ? 'Confirme que voce nao e um robo antes de enviar.'
                      : 'Verificacao de seguranca nao passou. Recarregue a pagina e tente de novo.',
                    mensagem: troll(nTs) + ' Tentativa #' + nTs + ' desta origem.' }, 403, headers);
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
