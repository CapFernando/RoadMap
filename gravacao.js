/* ─────────────────────────────────────────────────────────────────────────
   GRAVACAO — como o app AXIS (axis.html) grava na base.

   O MODELO E O DO PAINEL DO DEV, e nao o do admin. O admin acumula edicoes,
   guarda um retrato da base e, ao publicar, calcula o que cada aba mudou
   (`camposAlterados` + `mesclaMelhorias`). No app novo cada acao e imediata —
   mover, validar, editar um campo — e ja nasce como PATCH: { id: { campo:
   valor } }. Gravar e entao:

     1. ler a base FRESCA do servidor (nunca a da tela, que pode estar velha);
     2. aplicar SO os campos do patch por cima dela (o resto e do servidor);
     3. conferir o pre-voo (PREVOO.primeiro) com o par antes/depois;
     4. enviar com `base` = atualizado_em lido, para o servidor recusar corrida;
     5. numa corrida (409 conflito), refazer UMA vez a partir de nova leitura.

   E exatamente o `saveToGitHub(patch)` do dev.html, com a acao escolhida pelo
   perfil: admin grava por `publish`, dev por `dev-publish`. O servidor continua
   sendo quem decide; a tela so evita descobrir a regra pela mensagem de erro.

   `undefined` no patch APAGA o campo (mesma convencao do `camposAlterados` do
   admin, onde a chave sai do objeto).

   Publica em `window.GRAVACAO` e em `module.exports`: a suite executa `aplicar`.
   ───────────────────────────────────────────────────────────────────────── */
(function (raiz) {
  'use strict';

  /** Base + patch -> base nova. Puro: nao toca o objeto recebido.
   *  `raizPatch` troca chaves do topo (temas, projetos, ausencias...). */
  function aplicar(base, patch, raizPatch) {
    var out = Object.assign({}, base || {});
    var p = patch || {};
    var vistos = {};
    out.melhorias = ((base || {}).melhorias || []).map(function (m) {
      if (!m || !p[m.id]) return m;
      vistos[m.id] = true;
      var novo = Object.assign({}, m);
      Object.keys(p[m.id]).forEach(function (k) {
        if (p[m.id][k] === undefined) delete novo[k]; else novo[k] = p[m.id][k];
      });
      return novo;
    });
    // Demanda nova: so entra se vier completa o bastante para existir (id e
    // titulo) — a mesma guarda do dev.html, que impede um patch de campo solto
    // de virar demanda fantasma quando a original foi apagada por outra pessoa.
    Object.keys(p).forEach(function (id) {
      if (vistos[id]) return;
      var n = p[id];
      if (n && n.id === id && typeof n.titulo === 'string' && n.titulo.trim()) out.melhorias.push(Object.assign({}, n));
    });
    Object.keys(raizPatch || {}).forEach(function (k) { out[k] = raizPatch[k]; });
    return out;
  }

  /** Os ids do patch que nao existem na base e nao sao demanda nova valida —
   *  a demanda foi apagada ou mesclada por outra pessoa enquanto a tela estava
   *  aberta. Quem grava avisa, em vez de "salvar" algo que nao entrou. */
  function orfaos(base, patch) {
    var ids = {};
    ((base || {}).melhorias || []).forEach(function (m) { if (m) ids[m.id] = true; });
    return Object.keys(patch || {}).filter(function (id) {
      var n = patch[id];
      return !ids[id] && !(n && n.id === id && typeof n.titulo === 'string' && n.titulo.trim());
    });
  }

  /** Grava. `o`: { ler(): Promise<base>, enviar(corpo, replacer): Promise<{status, corpo}>,
   *  papel, patch, raiz, credenciais }. Devolve { ok, resp, base, falta, erro, status, itens }. */
  async function gravar(o, _tentativa) {
    var tentativa = _tentativa || 1;
    var base = await o.ler();
    if (!base || !Array.isArray(base.melhorias) || !base.melhorias.length) {
      return { ok: false, erro: 'Gravação abortada por segurança: a leitura do servidor veio vazia.' };
    }
    var perdidos = orfaos(base, o.patch);
    if (perdidos.length) {
      return { ok: false, erro: 'A demanda foi apagada ou mesclada por outra pessoa enquanto a tela estava aberta.', ids: perdidos };
    }
    var antes = { melhorias: base.melhorias.slice() };
    var depois = aplicar(base, o.patch, o.raiz);
    var PV = raiz.PREVOO;
    if (PV && PV.primeiro && !o.semPrevoo) {
      var falta = PV.primeiro(depois, antes, {});
      if (falta) return { ok: false, falta: falta, erro: falta.motivo };
    }
    var corpo = Object.assign({
      action: o.papel === 'admin' ? 'publish' : 'dev-publish',
      data: depois, base: base.atualizado_em || null, sem_trilha: true
    }, o.credenciais || {});
    var replacer = raiz.PUBLICACAO ? raiz.PUBLICACAO.semTrilha : undefined;
    var r = await o.enviar(corpo, replacer);
    if (r.status === 409 && r.corpo && r.corpo.error === 'conflito' && tentativa === 1) {
      return gravar(o, 2);
    }
    if (r.status < 200 || r.status >= 300) {
      var c = r.corpo || {};
      return { ok: false, status: r.status, erro: c.detail || c.error || ('HTTP ' + r.status),
               codigo: c.error || '', itens: Array.isArray(c.itens) ? c.itens : [] };
    }
    var resp = r.corpo || {};
    // Codigo AX- que o servidor deu a demanda nova volta para a base local.
    Object.keys(resp.codigos || {}).forEach(function (id) {
      var m = depois.melhorias.find(function (x) { return x.id === id; });
      if (m && !m.codigo) m.codigo = resp.codigos[id];
    });
    Object.keys(resp.codigos_projeto || {}).forEach(function (id) {
      var p = (depois.projetos || []).find(function (x) { return x.id === id; });
      if (p && !p.codigo) p.codigo = resp.codigos_projeto[id];
    });
    return { ok: true, resp: resp, base: depois };
  }

  var api = { aplicar: aplicar, orfaos: orfaos, gravar: gravar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.GRAVACAO = api;
}(typeof window !== 'undefined' ? window : this));
