// ─────────────────────────────────────────────────────────────────────────
// Cloudflare Worker — proxy de gravação da "Nova Melhoria" (RoadMap · Audax)
//
// Objetivo: permitir que QUALQUER pessoa envie uma sugestão de melhoria pelo
// painel público, SEM expor o token do GitHub. O token fica guardado como
// SECRET no Worker (env.GH_TOKEN) e nunca chega ao navegador.
//
// Deploy: ver README.md nesta pasta.
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
function toB64(str) { const b = new TextEncoder().encode(str); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); }
function fromB64(b64) { const bin = atob(b64.replace(/\n/g, '')); const arr = Uint8Array.from(bin, c => c.charCodeAt(0)); return new TextDecoder().decode(arr); }
function uid() { return 'm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function json(obj, status, headers) { return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...headers } }); }

export default {
  async fetch(request, env) {
    const headers = corsHeaders();
    if (request.method === 'OPTIONS') return new Response(null, { headers });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers });

    let body;
    try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400, headers); }

    const m = body.melhoria || {};
    if (!m.titulo || !String(m.titulo).trim()) return json({ error: 'Título obrigatório' }, 400, headers);
    if (JSON.stringify(body).length > 5 * 1024 * 1024) return json({ error: 'Conteúdo muito grande' }, 413, headers);

    const gh = (path, opts = {}) => fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/${path}`, {
      ...opts,
      headers: { Authorization: `token ${env.GH_TOKEN}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'audax-roadmap-worker', ...(opts.headers || {}) },
    });

    // Lê o estado atual
    const getRes = await gh(`contents/${FILE_PATH}?t=${Date.now()}`);
    if (!getRes.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
    const file = await getRes.json();
    const data = JSON.parse(fromB64(file.content));
    data.melhorias = data.melhorias || [];
    data.temas = data.temas || [];

    // Resolve tema: usa existente por nome; senão cria os novos enviados
    let temaId = m.tema_id || '';
    (body.novosTemas || []).forEach(t => {
      if (!t || !t.nome) return;
      const existing = data.temas.find(x => (x.nome || '').toLowerCase() === t.nome.toLowerCase());
      if (existing) { if (temaId === t.id) temaId = existing.id; }
      else { const novo = { id: t.id || uid(), nome: t.nome }; data.temas.push(novo); if (temaId === t.id) temaId = novo.id; }
    });

    // Sanitiza: o servidor define id, datas e status (entra no Backlog)
    const nova = {
      titulo: String(m.titulo).trim(),
      descricao: m.descricao || '',
      tema_id: temaId,
      solicitante: m.solicitante || '',
      discovery: m.discovery || undefined,
      anexos: Array.isArray(m.anexos) ? m.anexos : [],
      id: uid(),
      status: 'recebida',
      status_planejamento: 'backlog',
      dev: '',
      prioridade: '',
      inicio: '',
      entrega: '',
      estimativa: '',
      criado_em: new Date().toISOString(),
    };
    data.melhorias.push(nova);
    data.atualizado_em = new Date().toISOString();

    const putRes = await gh(`contents/${FILE_PATH}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `feat: nova sugestão (público) — ${nova.titulo}`,
        content: toB64(JSON.stringify(data, null, 2)),
        sha: file.sha,
      }),
    });
    if (!putRes.ok) { const e = await putRes.text(); return json({ error: 'Falha ao salvar', detail: e }, 502, headers); }
    return json({ ok: true, id: nova.id }, 200, headers);
  },
};
