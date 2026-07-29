// ─────────────────────────────────────────────────────────────────────────
// Cloudflare Worker — RoadMap · Audax
//
// Guarda como SECRETS (nunca chegam ao navegador):
//   • GH_TOKEN     → token do GitHub (grava no repositório)
//   • ADMIN_SENHA  → senha do Admin (valida login e publicação)
//
// Ações (POST JSON):
//   • { action:'auth', senha }            → valida a senha (login do Admin)
//   • { action:'publish', senha, data }   → grava o estado completo (Admin)
//   • { action:'dev-publish', senha, data } → grava o estado completo (Painel Dev)
//   • { action:'poker-*', ... }           → planning poker (D1: binding POKER_DB)
//   • { melhoria, novosTemas }            → sugestão pública (dash) — só adiciona no Backlog
// ─────────────────────────────────────────────────────────────────────────

const REPO_OWNER = 'CapFernando';
const REPO_NAME  = 'RoadMap';
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
const POKER_TTL_H = 12;   // sessão expira em 12h

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

const POKER_CARTAS = ['1','2','3','5','8','13','21','34','?'];

async function pokerEstado(db, codigo) {
  const ses = await db.prepare('SELECT * FROM poker_sessao WHERE codigo = ?').bind(codigo).first();
  if (!ses) return null;
  if (new Date(ses.expira_em) < new Date()) return { expirada: true };

  const parts = (await db.prepare(
    'SELECT id, nome FROM poker_participante WHERE codigo = ? ORDER BY visto_em').bind(codigo).all()).results || [];
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
    participantes: parts.map(p => ({
      id: p.id, nome: p.nome,
      votou: porPart[p.id] !== undefined,
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

    const gh = (path, opts = {}) => fetch('https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME + '/' + path, {
      ...opts,
      headers: { Authorization: 'token ' + env.GH_TOKEN, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'audax-roadmap-worker', ...(opts.headers || {}) },
    });
    const senhaOk = (s) => s && env.ADMIN_SENHA && s === env.ADMIN_SENHA;

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
        if (viva && !body.nova) return json({ ok: true, codigo: viva.codigo }, 200, headers);
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

      if (body.action === 'poker-estado') {
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
        await db.prepare('UPDATE poker_sessao SET revelado = 1 WHERE codigo = ?').bind(codigo).run();
        return json({ ok: true, estado: await pokerEstado(db, codigo) }, 200, headers);
      }

      // Troca a demanda em votacao e zera a rodada
      if (body.action === 'poker-demanda') {
        const mid = String(body.melhoria_id || '');
        await db.prepare('UPDATE poker_sessao SET melhoria_id = ?, revelado = 0 WHERE codigo = ?').bind(mid, codigo).run();
        await db.prepare('DELETE FROM poker_voto WHERE codigo = ? AND melhoria_id = ?').bind(codigo, mid).run();
        return json({ ok: true, estado: await pokerEstado(db, codigo) }, 200, headers);
      }

      if (body.action === 'poker-revotar') {
        const ses = await db.prepare('SELECT melhoria_id FROM poker_sessao WHERE codigo = ?').bind(codigo).first();
        await db.prepare('UPDATE poker_sessao SET revelado = 0 WHERE codigo = ?').bind(codigo).run();
        await db.prepare('DELETE FROM poker_voto WHERE codigo = ? AND melhoria_id = ?')
          .bind(codigo, (ses && ses.melhoria_id) || '').run();
        return json({ ok: true, estado: await pokerEstado(db, codigo) }, 200, headers);
      }

      // Grava so os dois campos na demanda — nao recebe o estado inteiro, entao
      // uma tela desatualizada nao pode sobrescrever o resto da base.
      if (body.action === 'poker-gravar') {
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

    // ── Login do Admin ──
    if (body.action === 'auth') {
      return senhaOk(body.senha) ? json({ ok: true }, 200, headers) : json({ error: 'senha' }, 401, headers);
    }

    // ── Publicação do Admin (estado completo) ──
    if (body.action === 'publish') {
      if (!senhaOk(body.senha)) return json({ error: 'senha' }, 401, headers);
      const data = body.data;
      if (!data || !Array.isArray(data.melhorias)) return json({ error: 'dados invalidos' }, 400, headers);
      if (JSON.stringify(data).length > 25 * 1024 * 1024) return json({ error: 'Conteudo muito grande' }, 413, headers);
      const getRes = await gh('contents/' + FILE_PATH + '?t=' + Date.now());
      if (!getRes.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
      const file = await getRes.json();
      const risco = gravacaoSuspeita(data, file.size || 0);
      if (risco) return json({ error: risco }, 409, headers);
      data.atualizado_em = new Date().toISOString();
      const putRes = await gh('contents/' + FILE_PATH, {
        method: 'PUT',
        body: JSON.stringify({ message: 'chore: admin publica ' + new Date().toISOString(), content: toB64(JSON.stringify(data)), sha: file.sha }),
      });
      if (!putRes.ok) { const e = await putRes.text(); return json({ error: 'Falha ao salvar', detail: e }, 502, headers); }
      return json({ ok: true }, 200, headers);
    }

    // Aceita a senha do time (DEV_SENHA) ou a do admin (ADMIN_SENHA). Enquanto
    // DEV_SENHA nao existir, a do admin resolve — assim exigir senha aqui nao
    // derruba o painel no momento do redeploy.
    const devOk = (s) => senhaOk(s) || !!(s && env.DEV_SENHA && s === env.DEV_SENHA);

    // ── Login do Dev (painel dev) ──
    if (body.action === 'dev-auth') {
      return devOk(body.senha) ? json({ ok: true }, 200, headers) : json({ error: 'senha' }, 401, headers);
    }

    // ── Gravação do Dev (estado completo montado no navegador) ──
    // ANTES esta rota nao pedia senha: qualquer um com a URL do Worker (que esta
    // no HTML publico) podia sobrescrever toda a base com um curl. CORS nao
    // protege, porque so vale para navegador.
    if (body.action === 'dev-publish') {
      if (!devOk(body.senha)) return json({ error: 'senha' }, 401, headers);
      const data = body.data;
      if (!data || !Array.isArray(data.melhorias)) return json({ error: 'dados invalidos' }, 400, headers);
      if (JSON.stringify(data).length > 25 * 1024 * 1024) return json({ error: 'Conteudo muito grande' }, 413, headers);
      const getRes = await gh('contents/' + FILE_PATH + '?t=' + Date.now());
      if (!getRes.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
      const file = await getRes.json();
      const risco = gravacaoSuspeita(data, file.size || 0);
      if (risco) return json({ error: risco }, 409, headers);
      data.atualizado_em = new Date().toISOString();
      const putRes = await gh('contents/' + FILE_PATH, {
        method: 'PUT',
        body: JSON.stringify({ message: 'chore: dev atualiza ' + new Date().toISOString(), content: toB64(JSON.stringify(data)), sha: file.sha }),
      });
      if (!putRes.ok) { const e = await putRes.text(); return json({ error: 'Falha ao salvar', detail: e }, 502, headers); }
      return json({ ok: true }, 200, headers);
    }

    // ── Sugestão pública (dash) — só adiciona no Backlog ──
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
      else { const novo = { id: t.id || uid(), nome: t.nome }; data.temas.push(novo); if (temaId === t.id) temaId = novo.id; }
    });

    // tipo: aceita apenas os dois valores conhecidos; qualquer outra coisa entra
    // vazia e o Admin classifica ao planejar (nao confiamos no cliente).
    const TIPOS_VALIDOS = ['sustentacao', 'evolucao'];
    const tipo = TIPOS_VALIDOS.includes(m.tipo) ? m.tipo : '';

    const nova = {
      titulo: String(m.titulo).trim(),
      descricao: m.descricao || '',
      tema_id: temaId,
      tipo: tipo,
      solicitante: m.solicitante || '',
      discovery: m.discovery || undefined,
      anexos: Array.isArray(m.anexos) ? m.anexos : [],
      id: uid(),
      status: 'recebida',
      status_planejamento: 'backlog',
      dev: '', prioridade: '', inicio: '', entrega: '', estimativa: '',
      criado_em: new Date().toISOString(),
    };
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
