/* ─────────────────────────────────────────────────────────────────────────
   AXIS — Configuracoes (so admin). Prototipo: Configuracoes.dc.html.

   A NAVEGACAO E VERTICAL, como no prototipo (.cfg + .tabs.vert com grupos).
   As secoes estao registradas em `abas` para o nucleo resolver a rota
   (#configuracoes/pessoas) e cair na primeira quando ela vier vazia ou torta;
   `abasDe` devolve [] para o nucleo NAO desenhar a regua horizontal — quem
   desenha a navegacao e esta tela, com os grupos do prototipo.

   QUATRO SECOES TEM DADO REAL NO ROADMAP: Catalogo de sistemas (a arvore de
   temas), Pessoas e perfis (contas + lista de devs), Sprint e calendario e
   Aparencia. As outras do prototipo (Empresa e marca, Modulos, Fluxos, SLA,
   API, Widget, Auditoria) continuam VISIVEIS no menu, marcadas, e abrem um
   estado honesto: o que o AXIS completo traz e o que o RoadMap faz hoje no
   lugar. Esconder daria a impressao de que a tela esta pronta; inventar
   numero daria a impressao de que o dado existe.

   OS CADASTROS GRAVAM DAQUI, com as regras das telas antigas:
     Catalogo   criar e renomear tema (`saveTema`), juntar dois temas
                (`juntarTemas`, que recusa quem tem submodulos) e excluir
                (`deleteTema`) — admin.html, aba Temas.
     Pessoas    as contas pela rota `usuarios` do Worker, como a aba Usuarios
                do admin (`renderUsuarios`): criar, liberar e recusar cadastro,
                papel, ativo, nova senha, nome, e-mail, nome nas demandas e
                aprova spike; DEV-AXCred e frente em `devs_perfil` (`uSetPerfil`).
                A lista de devs como o gantt.html: incluir (`addDev`), tirar
                (`removeDev`), reincluir quem saiu e juntar dois nomes da mesma
                pessoa (`juntarDevs`, que reescreve o `dev` das demandas).
   A LISTA DO TOPO (temas, desenvolvedores, devs_removidos, devs_perfil) VAI
   INTEIRA na gravacao, e por isso e montada sobre a base FRESCA lida logo
   antes (`gravaRaiz`), e nao sobre a da tela — a mesma ideia das ausencias no
   Planejamento. As regras puras estao em `REGRAS_CFG` e vao para a suite.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var raiz = typeof window !== 'undefined' ? window : globalThis;

  // ══ REGRAS (puras) ═══════════════════════════════════════════════════════
  function txt(v) { return String(v == null ? '' : v).trim(); }
  function falha(erro, campo) { return { ok: false, erro: erro, campo: campo || '' }; }
  function semAcento(t) { return String(t || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  /* SALVAR TEMA — COPIA de `saveTema` (admin.html): o nome e o caminho; o
     mesmo nome (sem diferenca de caixa) em outro id e recusado; renomear
     mantem o id, e as demandas vinculadas nao mudam. */
  function temaSalvar(temas, id, nome, novoId) {
    var n = txt(nome);
    if (!n) return falha('Escreva o caminho do tema.', 'nome');
    var dup = (temas || []).find(function (t) { return String(t.nome || '').toLowerCase() === n.toLowerCase() && t.id !== id; });
    if (dup) return falha('Já existe um tema com esse Sistema/Módulo.', 'nome');
    var out = (temas || []).map(function (t) { return t; });
    if (id) {
      var i = out.findIndex(function (t) { return t.id === id; });
      if (i < 0) return falha('Tema não encontrado. Recarregue.');
      out[i] = Object.assign({}, out[i], { nome: n });
    } else out.push({ id: novoId, nome: n });
    return { ok: true, temas: out, id: id || novoId };
  }

  /* JUNTAR DOIS TEMAS — COPIA de `juntarTemas` e `temaFilhosDe` (admin.html):
     as demandas do tema eliminado passam para o que fica, e o eliminado sai da
     lista. RECUSA quando ele tem submodulos: o galho ficaria pendurado num
     caminho que deixou de existir. `dentro` e o `catalogoDentro`. */
  function temaJuntar(D, deId, paraId, dentro) {
    if (!deId || !paraId) return falha('Escolha os dois temas.');
    if (deId === paraId) return falha('Escolha dois temas diferentes.');
    var temas = (D && D.temas) || [];
    var de = temas.find(function (t) { return t.id === deId; });
    var para = temas.find(function (t) { return t.id === paraId; });
    if (!de || !para) return falha('Tema nao encontrado. Recarregue.');
    var filhos = temas.filter(function (t) { return String(t.nome || '') !== String(de.nome || '') && dentro(t.nome, de.nome); });
    if (filhos.length) return { ok: false, filhos: filhos, erro: '"' + de.nome + '" tem submodulos: juntar deixaria ' + filhos.length + ' deles pendurados num caminho que deixou de existir. Renomeie ou junte os submodulos primeiro.' };
    var afetadas = ((D && D.melhorias) || []).filter(function (m) { return m && m.tema_id === deId; });
    var patch = {};
    afetadas.forEach(function (m) { patch[m.id] = { tema_id: paraId }; });
    return { ok: true, de: de, para: para, afetadas: afetadas, patch: patch, temas: temas.filter(function (t) { return t.id !== deId; }) };
  }

  /* EXCLUIR TEMA — `deleteTema` (admin.html): sai da lista; as demandas
     vinculadas ficam sem tema (o aviso diz quantas). */
  function temaExcluir(D, id) {
    var temas = (D && D.temas) || [];
    if (!temas.some(function (t) { return t.id === id; })) return falha('Tema nao encontrado. Recarregue.');
    return { ok: true, temas: temas.filter(function (t) { return t.id !== id; }),
             n: ((D && D.melhorias) || []).filter(function (m) { return m && m.tema_id === id; }).length };
  }

  /* UM NOME DE DEV TROCADO POR OUTRO NO CAMPO COMPOSTO — COPIA de `gJuntaDevEm`
     e `splitDevs` (gantt.html): troca a PARTE inteira, sem caixa nem acento,
     e nao repete o destino ("Murillo / Murillo Jesus" vira "Murillo Jesus"). */
  function juntaDevEm(valorDev, de, para) {
    var partes = String(valorDev || '').split(/[\/,]/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!partes.length) return valorDev;
    var alvo = semAcento(de), trocou = false, saida = [];
    partes.forEach(function (p) {
      var nome = semAcento(p) === alvo ? (trocou = true, para) : p;
      if (saida.some(function (x) { return semAcento(x) === semAcento(nome); })) return;
      saida.push(nome);
    });
    return trocou ? saida.join(' / ') : valorDev;
  }

  /* JUNTAR DOIS NOMES DA MESMA PESSOA — COPIA de `juntarDevs` (gantt.html):
     reescreve o `dev` de TODAS as demandas (as concluidas sao o historico), o
     nome que fica entra na lista, o que sai vira decisao gravada em
     `devs_removidos`, e o perfil (DEV-AXCred, frente) acompanha. */
  function devsJuntar(D, de, para) {
    if (!txt(de) || !txt(para)) return falha('Escolha os dois nomes.');
    if (de === para) return falha('Escolha dois nomes diferentes.');
    var patch = {}, abertas = 0, fechadas = 0;
    ((D && D.melhorias) || []).forEach(function (m) {
      if (!m) return;
      var novo = juntaDevEm(m.dev, de, para);
      if (novo === m.dev) return;
      patch[m.id] = { dev: novo };
      if (['concluido', 'negada'].indexOf(String(m.status_planejamento || '')) >= 0) fechadas++; else abertas++;
    });
    var devs = ((D && D.desenvolvedores) || []).slice();
    if (devs.indexOf(para) < 0) devs.push(para);
    var i = devs.indexOf(de);
    if (i >= 0) devs.splice(i, 1);
    var rem = ((D && D.devs_removidos) || []).slice();
    if (rem.indexOf(de) < 0) rem.push(de);
    var perf = JSON.parse(JSON.stringify((D && D.devs_perfil) || {}));
    if (perf[de]) { if (!perf[para]) perf[para] = perf[de]; delete perf[de]; }
    return { ok: true, patch: patch, abertas: abertas, fechadas: fechadas,
             raiz: { desenvolvedores: devs, devs_removidos: rem, devs_perfil: perf } };
  }

  /* TIRAR DA LISTA DE DEVS — COPIA de `removeDev` (gantt.html), sem o caso do
     dev "teste" (que apaga demandas e nao tem lugar numa tela de cadastro):
     com demanda ATIVA nao sai; saindo, a remocao vira decisao gravada em
     `devs_removidos`, senao a lista se remonta e o nome volta. */
  var STATUS_BLOQUEIO = ['backlog', 'levantar_req', 'planning', 'planejado', 'em_andamento', 'validacao', 'atrasado'];
  function devTirar(D, nome) {
    var ativas = ((D && D.melhorias) || []).filter(function (m) {
      return m && String(m.dev || '').split(/[\/,]/).map(function (d) { return d.trim(); }).indexOf(nome) >= 0 &&
        STATUS_BLOQUEIO.indexOf(m.status_planejamento || 'backlog') >= 0;
    });
    if (ativas.length) return { ok: false, ativas: ativas, erro: 'Não dá para tirar "' + nome + '": ele está em ' + ativas.length + ' demanda(s) ativa(s). Reatribua essas demandas antes.' };
    var devs = ((D && D.desenvolvedores) || []).filter(function (d) { return d !== nome; });
    var rem = ((D && D.devs_removidos) || []).slice();
    if (rem.indexOf(nome) < 0) rem.push(nome);
    return { ok: true, raiz: { desenvolvedores: devs, devs_removidos: rem } };
  }

  /* INCLUIR NA LISTA DE DEVS — `addDev` (gantt.html): o nome repetido e
     recusado. E quem tinha saido volta de verdade: sai de `devs_removidos`,
     senao a limpeza do Worker (`limpaDevs`) o tiraria de novo na gravacao. */
  function devIncluir(D, nome) {
    var n = txt(nome);
    if (!n) return falha('Escreva o nome do dev.', 'nome');
    var devs = ((D && D.desenvolvedores) || []).slice();
    var rem = ((D && D.devs_removidos) || []).filter(function (x) { return semAcento(x) !== semAcento(n); });
    if (devs.indexOf(n) >= 0 && rem.length === ((D && D.devs_removidos) || []).length) return falha('Dev já existe.', 'nome');
    if (devs.indexOf(n) < 0) devs.push(n);
    return { ok: true, raiz: { desenvolvedores: devs, devs_removidos: rem } };
  }

  /* A CONTA QUE DESENVOLVE ENTRA NA LISTA — `uAprovar` e `uNomeDemandas`
     (admin.html): sem estar na lista, ninguem atribui demanda a pessoa. So
     acrescenta (em ordem), e so se o nome ainda nao estiver la. */
  function naLista(D, nome) {
    var n = txt(nome);
    var devs = (D && D.desenvolvedores) || [];
    if (!n || devs.some(function (d) { return String(d).trim().toLowerCase() === n.toLowerCase(); })) return null;
    return { desenvolvedores: devs.concat([n]).sort(function (a, b) { return String(a).localeCompare(String(b), 'pt-BR'); }) };
  }

  /* O PERFIL DO DEV — COPIA de `uSetPerfil` (admin.html) e `gSetPerfil`
     (gantt.html): vazio ou falso tira o campo; perfil vazio sai do mapa. */
  function perfilCom(perfis, nome, campo, valor) {
    var out = JSON.parse(JSON.stringify(perfis || {}));
    var atual = Object.assign({}, out[nome] || {});
    if (valor === '' || valor === false) delete atual[campo]; else atual[campo] = valor;
    if (Object.keys(atual).length) out[nome] = atual; else delete out[nome];
    return out;
  }

  /* O LINK DE VISUALIZACAO SEM LOGIN — COPIA de `copiarLinkVisualizacao`
     (gantt.html): `?view=` liga o modo so-leitura do Gantt e `&k=` leva a
     chave de leitura do Worker (secret VIEW_CHAVE, publicada em config.js). */
  var VIEW_KEY = 'vz-audax-26';
  function linkVisualizacao(origem, chave) {
    return String(origem || '') + 'gantt.html?view=' + VIEW_KEY + (chave ? '&k=' + encodeURIComponent(chave) : '');
  }

  var DOMINIO = '@audaxcapitalsa.com.br';
  /* A CONTA NOVA — as conferencias de `uCriar` (admin.html), na mesma ordem.
     O login sai do e-mail, no servidor. */
  function contaNova(v) {
    var nome = txt(v.nome), email = txt(v.email).toLowerCase(), senha = String(v.senha || '');
    if (!nome) return { erro: 'Escreva o nome da pessoa.', campo: 'nome' };
    if (!email.endsWith(DOMINIO) || email.indexOf('@') < 1) return { erro: 'O e-mail precisa terminar com ' + DOMINIO, campo: 'email' };
    if (senha.length < 8) return { erro: 'A senha está curta: faltam ' + (8 - senha.length) + ' caractere' + (8 - senha.length > 1 ? 's' : '') + ' para chegar a 8.', campo: 'senha' };
    return '';
  }
  /** O e-mail sugerido a partir do nome (`uPreencher`): nome.sobrenome no dominio. */
  function emailSugerido(nome) {
    var p = semAcento(nome).replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
    return p.length ? (p.length > 1 ? p[0] + '.' + p[p.length - 1] : p[0]) + DOMINIO : '';
  }

  var REGRAS_CFG = { temaSalvar: temaSalvar, temaJuntar: temaJuntar, temaExcluir: temaExcluir, juntaDevEm: juntaDevEm,
                     devsJuntar: devsJuntar, devTirar: devTirar, devIncluir: devIncluir, naLista: naLista,
                     perfilCom: perfilCom, linkVisualizacao: linkVisualizacao, VIEW_KEY: VIEW_KEY, STATUS_BLOQUEIO: STATUS_BLOQUEIO,
                     contaNova: contaNova, emailSugerido: emailSugerido, DOMINIO: DOMINIO };
  if (typeof module !== 'undefined' && module.exports) { module.exports = REGRAS_CFG; return; }
  raiz.AXIS_CFG = REGRAS_CFG;
  if (!raiz.AXIS_APP) return;
  var H = raiz.AXIS_APP.H;
  var esc = H.esc, ico = H.ico;

  // ── Secoes ──────────────────────────────────────────────────────────────
  // `real: false` = existe no prototipo e ainda nao tem dado no RoadMap.
  // "Temas" do prototipo (cadastro) e a mesma lista que o Catalogo mostra —
  // no RoadMap tema E o sistema/modulo — por isso virou uma secao so. O
  // claro/escuro, que no prototipo mora dentro de Empresa e marca, ganhou
  // secao propria (Aparencia): e a parte da marca que ja funciona.
  var GRUPOS = [
    { grp: 'EMPRESA', itens: [
      { id: 'marca', rotulo: 'Empresa e marca', real: false },
      { id: 'aparencia', rotulo: 'Aparência', real: true },
      { id: 'modulos', rotulo: 'Módulos', real: false }
    ] },
    { grp: 'REGRAS', itens: [
      { id: 'fluxos', rotulo: 'Fluxos e etapas', real: false },
      { id: 'sla', rotulo: 'Prioridade e SLA', real: false },
      { id: 'sprint', rotulo: 'Sprint e calendário', real: true }
    ] },
    { grp: 'CADASTROS', itens: [
      { id: 'pessoas', rotulo: 'Pessoas e perfis', real: true },
      { id: 'catalogo', rotulo: 'Catálogo de sistemas', real: true }
    ] },
    { grp: 'INTEGRAÇÕES', itens: [
      // A secao e uma tela propria (axis-tela-api.js): o item leva ate ela.
      { id: 'api', rotulo: 'API e integrações', real: true, href: '#api' },
      { id: 'widget', rotulo: 'Widget', real: false }
    ] },
    { grp: 'SEGURANÇA', itens: [
      { id: 'auditoria', rotulo: 'Auditoria', real: false }
    ] }
  ];
  var TODAS = [];
  GRUPOS.forEach(function (g) { g.itens.forEach(function (i) { TODAS.push(i); }); });
  // A primeira de `abas` e a que abre em #configuracoes: tem de ser uma com dado.
  var ABAS = [{ id: 'catalogo', rotulo: 'Catálogo de sistemas' }].concat(
    TODAS.filter(function (i) { return i.id !== 'catalogo'; }).map(function (i) { return { id: i.id, rotulo: i.rotulo }; }));

  // Estado da tela (filtros, selecao). Vive enquanto a pagina vive.
  var est = { catBusca: '', catSis: '', pesFiltro: 'todos', pesBusca: '', pesSel: '' };
  // Contas: uma leitura por minuto basta — elas mudam pelo admin, nao aqui.
  var contas = { lista: null, pedidos: [], erro: '', em: 0, carregando: false };
  // Os nomes de contas desativadas (rota `devs-inativos`): saem da capacidade, como no admin e no Gantt.
  var inativos = { lista: [], pedido: false };

  function css() {
    if (document.getElementById('css-tela-configuracoes')) return;
    var s = document.createElement('style');
    s.id = 'css-tela-configuracoes';
    s.textContent =
      '.axa .cfg .tabs.vert .tab{display:flex;align-items:center;gap:8px;text-decoration:none}' +
      '.axa .cfg .tabs.vert .tab .pend{margin-left:auto;font-size:11px;color:var(--tx4)}' +
      '.axa .cfg .tabs.vert .tab.fut{color:var(--tx4)}' +
      '.axa .cfg .tabs.vert .tab.fut.on{color:var(--tx2)}' +
      '.axa .cfg-hd{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px}' +
      '.axa .cfg-tt{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1 1 380px;max-width:640px}' +
      '.axa .cfg-lin{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px}' +
      '.axa .cfg-val{height:32px;display:inline-flex;align-items:center;padding:0 12px;border-radius:9px;background:var(--sf3);border:1px solid var(--bd2);color:var(--tx);font-size:12.5px;white-space:nowrap}' +
      '.axa .cfg-sis{cursor:pointer;text-align:left;font:inherit;color:inherit;padding:14px 16px;gap:10px}' +
      '.axa .cfg-sis:hover{border-color:var(--bd4)}' +
      '.axa .cfg-sis.on{border-color:rgba(var(--ac-rgb),.55);box-shadow:inset 0 0 0 1px rgba(var(--ac-rgb),.35)}' +
      '.axa .cfg-ab{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:Montserrat,sans-serif;font-weight:800;font-size:12px;flex-shrink:0}' +
      '.axa .cfg-dot{width:9px;height:9px;border-radius:3px;flex-shrink:0;display:inline-block}' +
      '.axa .cfg-tr td{cursor:pointer}' +
      '.axa .cfg-tr.on{background:rgba(var(--ac-rgb),.08)}' +
      '.axa .cfg-tr:hover{background:var(--sf2)}' +
      '.axa .cfg-sw{width:36px;height:20px;border-radius:10px;position:relative;flex-shrink:0;background:var(--sf4)}' +
      '.axa .cfg-sw.on{background:var(--ac)}' +
      '.axa .cfg-sw::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:8px;background:var(--tx3)}' +
      '.axa .cfg-sw.on::after{left:18px;background:var(--on-ac)}' +
      '.axa button.cfg-sw{border:0;padding:0;cursor:pointer}' +
      '.axa button.cfg-sw:focus-visible,.axa .cfg-papel:focus-visible{outline:2px solid var(--ac);outline-offset:2px}' +
      '.axa .cfg-it{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;background:var(--sf2);font-size:13px}' +
      '.axa .cfg-it.hj{box-shadow:inset 3px 0 0 var(--ac)}' +
      '.axa .cfg-it.pass{opacity:.6}' +
      '.axa .cfg-ton{height:44px;border-radius:10px;border:1px solid var(--bd2)}' +
      '.axa .cfg-q{width:240px;max-width:100%}' +
      '.axa .cfg-rec{display:inline-block;width:0}';
    document.head.appendChild(s);
  }

  // ── Pedacos ────────────────────────────────────────────────────────────
  var CORES = ['ac', 'in', 'ok', 'pu', 'tl', 'wn', 'dg'];
  function cab(titulo, sub, acoes) {
    return '<header class="cfg-hd"><div class="cfg-tt"><h1 class="h1">' + esc(titulo) + '</h1>' +
      (sub ? '<span class="sub">' + sub + '</span>' : '') + '</div>' +
      (acoes ? '<div class="row" style="flex-wrap:wrap;justify-content:flex-end">' + acoes + '</div>' : '') + '</header>';
  }
  function linha(rot, val) {
    return '<div class="cfg-lin"><span>' + rot + '</span><span class="cfg-val">' + val + '</span></div>';
  }
  function info(txt) {
    return '<div class="lock" style="background:rgba(var(--in-rgb),.08);border-color:rgba(var(--in-rgb),.3);color:var(--in-t)">' +
      '<span>' + ico('info') + '</span><span>' + txt + '</span></div>';
  }
  function linkExt(href, rot, cls, titulo) {
    return '<a class="' + (cls || 'btn') + '" href="' + href + '" title="' + esc(titulo || '') + '">' + esc(rot) + ' ' +
      ico('external', 'style="font-size:12px;opacity:.7"') + '</a>';
  }
  function norm(s) {
    return raiz.DEVNOME ? raiz.DEVNOME.norm(s) : String(s || '').toLowerCase().trim();
  }
  function aberta(m) {
    var c = H.colunaDe(m);
    return c !== 'concluido' && c !== 'negada';
  }

  // ── Navegacao vertical ─────────────────────────────────────────────────
  function nav(aba) {
    var h = '<nav class="tabs vert" aria-label="Seções das configurações">';
    GRUPOS.forEach(function (g) {
      h += '<span class="grp">' + esc(g.grp) + '</span>';
      g.itens.forEach(function (i) {
        var on = i.id === aba;
        h += '<a href="' + (i.href || '#configuracoes/' + i.id) + '" class="tab' + (on ? ' on' : '') + (i.real ? '' : ' fut') + '"' +
          (on ? ' aria-current="page"' : '') + (i.real ? '' : ' title="Chega com o AXIS completo"') + '>' +
          esc(i.rotulo) + (i.real ? '' : '<span class="pend">' + ico('lock') + '</span>') + '</a>';
      });
    });
    return h + '</nav>';
  }

  // ════════════════════════════════════════════════════════════════════════
  // CATALOGO DE SISTEMAS — a arvore de temas
  // ════════════════════════════════════════════════════════════════════════
  /* O NOME E O CAMINHO (catalogo.js): "AXCred - Cadastro - Reanalise". A
     ordem e o agrupamento vem do catalogo (`catalogoOrdena`, `catalogoSistema`,
     `catalogoForaDoPadrao`), e nao de uma segunda regra aqui. As contagens sao as do
     admin (aba Temas): demandas com `tema_id` igual ao do tema — so que sobre
     as visiveis (sem oculta e sem mesclada), como o resto do app novo. */
  function dadosCatalogo(D) {
    var ordena = raiz.catalogoOrdena || function (l) { return l.slice(); };
    var sisDe = raiz.catalogoSistema || function (n) { return String(n || '').split(' - ')[0]; };
    var temas = ordena((D.temas || []).filter(function (t) { return t && t.nome; }));
    var porTema = {};
    H.visiveis().forEach(function (m) {
      var k = String(m.tema_id || '');
      var c = porTema[k] || (porTema[k] = { total: 0, abertas: 0, andamento: 0 });
      c.total++;
      if (aberta(m)) c.abertas++;
      if (H.colunaDe(m) === 'em_andamento') c.andamento++;
    });
    var sistemas = [], porSis = {};
    temas.forEach(function (t) {
      var s = sisDe(t.nome);
      var k = norm(s);
      if (!porSis[k]) { porSis[k] = { nome: s, temas: [], total: 0, abertas: 0, andamento: 0 }; sistemas.push(porSis[k]); }
      var c = porTema[String(t.id)] || { total: 0, abertas: 0, andamento: 0 };
      porSis[k].temas.push(t);
      porSis[k].total += c.total; porSis[k].abertas += c.abertas; porSis[k].andamento += c.andamento;
    });
    sistemas.forEach(function (s, i) { s.cor = CORES[i % CORES.length]; s.k = norm(s.nome); });
    var semTema = H.visiveis().filter(function (m) {
      return !m.tema_id || !temas.some(function (t) { return String(t.id) === String(m.tema_id); });
    });
    var torto = {}, tortoPara = {};
    (raiz.catalogoForaDoPadrao ? raiz.catalogoForaDoPadrao(temas) : []).forEach(function (a) {
      if (a && a.de) torto[String(a.de.id)] = a.motivo;
      // Duplicado tem destino certo: o Juntar ja abre com ele (`prepararJuncao` do admin).
      if (a && a.de && a.tipo === 'duplicado' && a.para) tortoPara[String(a.de.id)] = a.para.id;
    });
    return { temas: temas, porTema: porTema, sistemas: sistemas, porSis: porSis, semTema: semTema, torto: torto, tortoPara: tortoPara };
  }

  function sigla(nome) {
    var p = String(nome || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[1][0]).toUpperCase();
  }

  function cartaoSistema(s) {
    var on = est.catSis === s.k;
    return '<button type="button" class="pn cfg-sis' + (on ? ' on' : '') + '" data-cfg-sis="' + esc(s.k) + '" aria-pressed="' + on + '">' +
      '<span class="row" style="justify-content:space-between;width:100%"><span class="row" style="min-width:0">' +
      '<span class="cfg-ab" style="background:rgba(var(--' + s.cor + '-rgb),.18);color:var(--' + s.cor + '-t)">' + esc(sigla(s.nome)) + '</span>' +
      '<b class="ell" style="font-size:14.5px" title="' + esc(s.nome) + '">' + esc(s.nome) + '</b></span></span>' +
      '<span style="display:flex;flex-direction:column;gap:5px;font-size:12.5px;color:var(--tx2);width:100%">' +
      '<span class="row" style="justify-content:space-between"><span class="note">Demandas abertas</span><span class="mono">' + s.abertas + '</span></span>' +
      '<span class="row" style="justify-content:space-between"><span class="note">Em andamento</span><span class="mono">' + s.andamento + '</span></span>' +
      '<span class="row" style="justify-content:space-between"><span class="note">Total de demandas</span><span class="mono">' + s.total + '</span></span>' +
      '<span class="row" style="justify-content:space-between"><span class="note">Temas</span><span class="mono">' + s.temas.length + '</span></span>' +
      '</span></button>';
  }

  /* A ARVORE NA TABELA. Cada sistema abre com uma linha propria (a soma dos
     modulos), mesmo quando o tema-raiz nao existe na base — e o caso comum:
     ninguem cadastra "AXCred" sozinho, so "AXCred - Operacoes". Modulo cujo pai
     tambem nao existe ("AXCred - Cadastro - Analise de Credito" sem "AXCred -
     Cadastro") mostra o caminho desde o ancestral que existe, para a folha nao
     aparecer solta num nivel que a tabela nao desenhou. */
  function linhasTemas(c) {
    var q = norm(est.catBusca);
    var partes = function (n) { return String(n || '').split(' - ').map(function (x) { return x.trim(); }).filter(Boolean); };
    var completo = raiz.catalogoCompleto || function (n) { return partes(n).join(' › '); };
    var celulas = function (cont, nivelTxt, t) {
      return '<td class="mono"' + (cont.total ? '' : ' style="color:var(--tx4)"') + '>' + cont.total + '</td>' +
        '<td class="mono"' + (cont.abertas ? ' style="color:var(--tx)"' : ' style="color:var(--tx4)"') + '>' + cont.abertas + '</td>' +
        '<td class="note" style="white-space:nowrap">' + nivelTxt + '</td>' + acoesTema(t);
    };
    // Renomear, juntar e excluir: so na linha que E um tema (a do sistema sem tema-raiz e soma).
    var acoesTema = function (t) {
      if (!t || !H.pode('configurar')) return '<td></td>';
      var b = function (acao, icone, titulo, cls) {
        return '<button type="button" class="btns' + (cls ? ' ' + cls : '') + '" data-cfg-acao="' + acao + '" data-cfg-id="' + esc(t.id) + '" title="' + esc(titulo) + '" aria-label="' + esc(titulo + ': ' + t.nome) + '">' + ico(icone) + '</button>';
      };
      return '<td style="white-space:nowrap;text-align:right"><span class="row" style="gap:4px;justify-content:flex-end">' +
        b('tema-editar', 'edit', 'Renomear') + b('tema-juntar', 'link', c.tortoPara[String(t.id)] ? 'Juntar (há um tema igual)' : 'Juntar em outro tema', c.tortoPara[String(t.id)] ? 'on' : '') +
        b('tema-excluir', 'trash', 'Excluir') + '</span></td>';
    };
    var tortoChip = function (t) {
      var m = c.torto[String(t.id)];
      return m ? ' ' + H.chip(ico('alert') + ' fora do padrão', 'wn', m) : '';
    };
    var sistemas = c.sistemas.filter(function (s) { return !est.catSis || s.k === est.catSis; });
    var out = [];
    if (q) {
      sistemas.forEach(function (s) {
        s.temas.forEach(function (t) {
          if (norm(t.nome).indexOf(q) < 0) return;
          var cont = c.porTema[String(t.id)] || { total: 0, abertas: 0 };
          out.push('<tr><td style="color:var(--tx);font-weight:600"><span class="row" style="gap:8px"><span class="cfg-dot" style="background:var(--' + s.cor + ')"></span>' +
            '<span style="min-width:0">' + esc(completo(t.nome)) + '</span>' + tortoChip(t) + '</span></td>' +
            celulas(cont, partes(t.nome).length > 1 ? 'módulo' : 'sistema', t) + '</tr>');
        });
      });
    } else {
      sistemas.forEach(function (s) {
        var so = s.temas.length === 1 && partes(s.temas[0].nome).length === 1;
        out.push('<tr><td style="color:var(--tx);font-weight:800"><span class="row" style="gap:8px"><span class="cfg-dot" style="background:var(--' + s.cor + ')"></span>' +
          esc(s.nome) + (so ? tortoChip(s.temas[0]) : '') + '</span></td>' +
          celulas({ total: s.total, abertas: s.abertas }, so ? 'sistema' : 'sistema · ' + H.plural(s.temas.length, 'tema', 'temas'), so ? s.temas[0] : null) + '</tr>');
        if (so) return;
        var nomes = {};
        s.temas.forEach(function (t) { nomes[norm(t.nome)] = true; });
        s.temas.forEach(function (t) {
          var p = partes(t.nome);
          var cont = c.porTema[String(t.id)] || { total: 0, abertas: 0 };
          var rot, recuo;
          if (p.length === 1) { rot = '<i style="color:var(--tx3)">sem módulo</i>'; recuo = 1; }
          else {
            var anc = 0;
            for (var i = p.length - 1; i >= 2; i--) { if (nomes[norm(p.slice(0, i).join(' - '))]) { anc = i - 1; break; } }
            rot = esc(p.slice(anc + 1).join(' › '));
            recuo = anc + 1;
          }
          out.push('<tr title="' + esc(completo(t.nome)) + '"><td><span class="row" style="gap:6px;padding-left:' + (recuo * 18 - 4) + 'px">' +
            '<span style="color:var(--tx4)">└</span><span style="min-width:0;color:var(--tx2)">' + rot + '</span>' + tortoChip(t) + '</span></td>' +
            celulas(cont, 'módulo · nível ' + (p.length - 1), t) + '</tr>');
        });
      });
    }
    if (!out.length) {
      return '<tr><td colspan="5">' + H.vazio('search', 'Nenhum tema encontrado', est.catBusca ? 'Nada casa com "' + est.catBusca + '".' : 'Este sistema ainda não tem tema.') + '</td></tr>';
    }
    return out.join('');
  }

  function secCatalogo(ctx) {
    var c = dadosCatalogo(ctx.D);
    var abertasTot = c.sistemas.reduce(function (t, s) { return t + s.abertas; }, 0);
    var nTorto = Object.keys(c.torto).length;
    var acoes = H.pode('configurar') ? '<button type="button" class="btnp" data-cfg-acao="tema-novo">' + ico('plus') + ' Novo tema</button>' : '';
    var h = cab('Catálogo de sistemas',
      'Sistemas e módulos usados para classificar as demandas. O nome do tema é o caminho (“AXCred - Cadastro - Reanálise”): a árvore sai dele, sem campo à parte. ' +
      esc(H.plural(c.sistemas.length, 'sistema', 'sistemas')) + ' · ' + esc(H.plural(c.temas.length, 'tema', 'temas')) + ' · ' + esc(H.plural(abertasTot, 'demanda aberta', 'demandas abertas')) + '.',
      acoes);
    if (!c.temas.length) return h + H.vazio('folder', 'Nenhum tema cadastrado', 'Crie o primeiro em "Novo tema" — o nome é o caminho, com " - " entre os níveis.');
    h += '<div class="grid" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">' + c.sistemas.map(cartaoSistema).join('') + '</div>';
    var avisos = '';
    if (nTorto) avisos += '<div class="lock"><span>' + ico('alert') + '</span><span><b>' + H.plural(nTorto, 'tema fora do padrão', 'temas fora do padrão') +
      '.</b> Nome fora do padrão quebra o filtro por sistema: quem filtra por um não vê o outro. Junte pelo botão da linha (o que tem tema igual já abre com o destino) ou renomeie.</span></div>';
    if (c.semTema.length) avisos += info(H.plural(c.semTema.length, 'demanda visível está', 'demandas visíveis estão') + ' sem tema (ou com tema apagado) e não entram na contagem acima.');
    h += avisos;
    var sisSel = est.catSis && c.sistemas.filter(function (s) { return s.k === est.catSis; })[0];
    h += '<section class="pn" style="padding:16px 14px 8px">' +
      '<div class="row" style="justify-content:space-between;flex-wrap:wrap;padding:0 6px"><h2 class="h2">' +
      (sisSel ? 'Temas de ' + esc(sisSel.nome) : 'Todos os temas') + '</h2>' +
      '<span class="row" style="gap:8px">' + (sisSel ? '<button type="button" class="btns" data-cfg-sis="">Todos os sistemas</button>' : '') +
      '<input class="in cfg-q" id="cfg-cat-q" type="search" placeholder="Buscar tema ou sistema" value="' + esc(est.catBusca) + '" aria-label="Buscar tema ou sistema"></span></div>' +
      '<table class="tbl"><thead><tr><th>TEMA</th><th>DEMANDAS</th><th>ABERTAS</th><th>NÍVEL</th><th style="text-align:right">AÇÕES</th></tr></thead>' +
      '<tbody id="cfg-cat-linhas">' + linhasTemas(c) + '</tbody></table>' +
      '<span class="note" style="padding:4px 6px 8px">As contagens são do próprio tema; a linha e o cartão do sistema somam todos os módulos dele. Aberta = fora de Concluído e de Negada.</span></section>';
    return h;
  }

  // ════════════════════════════════════════════════════════════════════════
  // PESSOAS E PERFIS — contas (rota `usuarios`) + lista de devs da base
  // ════════════════════════════════════════════════════════════════════════
  var PAPEL = {
    admin: { rot: 'Admin', cor: 'ac' }, analista: { rot: 'Analista de Requisitos', cor: 'pu' },
    dev: { rot: 'Dev', cor: 'in' }, consulta: { rot: 'Consulta', cor: 'tl' }, semconta: { rot: 'Sem conta', cor: 'bk' }
  };

  /* Os nomes de dev que aparecem nas demandas. COPIA de `uDevsDosCards`
     (admin.html, aba Usuarios): o campo aceita "Ana / Bruno", "Ana e Bruno". */
  function devsDosCards(D) {
    var vistos = {};
    (D.melhorias || []).forEach(function (m) {
      String(m.dev || '').split(/\s*(?:,|\/|;|\se\s|&)\s*/i).forEach(function (t) {
        t = t.trim(); if (t) vistos[t] = true;
      });
    });
    return Object.keys(vistos).sort();
  }
  /* O nome pelo qual a conta aparece nas demandas. COPIA de `uNomeDeDev`
     (admin.html): o declarado primeiro, depois o sugerido, depois o nome — o
     primeiro que existir nos cards; se nenhum existir, o primeiro candidato. */
  function nomeDeDev(u, nomesCards) {
    var decl = String(u.nome_demandas || '').split(/[\/,;]/).map(function (x) { return x.trim(); }).filter(Boolean);
    var cand = decl.concat([String(u.nome_sugerido || '').trim(), String(u.nome || '').trim()]).filter(Boolean);
    var achado = cand.filter(function (c) { return nomesCards.some(function (n) { return norm(n) === norm(c); }); })[0];
    return achado || cand[0] || '';
  }
  /* Quem conta na capacidade: a lista de devs sem quem saiu. COPIA de
     `capDevsAtivos` (gantt.html). */
  function devsAtivos(D) {
    var fora = {};
    (D.devs_removidos || []).concat(D.devs_inativos || inativos.lista || []).forEach(function (n) { fora[String(n).trim().toLowerCase()] = true; });
    return (D.desenvolvedores || []).filter(function (n) { return !fora[String(n).trim().toLowerCase()]; });
  }
  /* A frente como o admin mostra: o cadastro vence; sem cadastro, a semente de
     `pipelines.js` aparece como "(por padrao)", para nao confundir o que alguem
     marcou com o que o sistema deduziu (ver `uCelulaPipeline` no admin). */
  function frenteDe(nome, D) {
    var P = raiz.PIPELINES;
    if (!P || !nome) return { txt: '', padrao: false };
    var perf = (D.devs_perfil || {})[nome];
    var cad = P.canonica(perf && typeof perf === 'object' ? perf.pipeline : '');
    if (cad) return { txt: cad, padrao: false };
    var sem = P.doDev(nome, {});
    return sem ? { txt: sem, padrao: true } : { txt: '', padrao: false };
  }

  function pessoas(D) {
    var cards = devsDosCards(D);
    var ativos = devsAtivos(D);
    var ehAtivo = function (n) { return ativos.some(function (a) { return norm(a) === norm(n); }); };
    var vs = H.visiveis();
    var contaDemandas = function (nomes) {
      var t = 0, a = 0;
      vs.forEach(function (m) {
        var dele = nomes.some(function (n) { return raiz.DEVNOME ? raiz.DEVNOME.eDe(m, n) : H.devsDe(m).indexOf(n) >= 0; });
        if (dele) { t++; if (aberta(m)) a++; }
      });
      return { total: t, abertas: a };
    };
    var out = (contas.lista || []).map(function (u) {
      var nd = nomeDeDev(u, cards);
      var decl = String(u.nome_demandas || '').split(/[\/,;]/).map(function (x) { return x.trim(); }).filter(Boolean);
      var desenvolve = ['dev', 'analista'].indexOf(String(u.papel || '')) >= 0;
      var perf = (D.devs_perfil || {})[nd] || {};
      return {
        chave: 'u:' + u.login, u: u, login: u.login, nome: u.nome || u.login, email: u.email || '', papel: u.papel || 'consulta',
        status: u.pendente ? 'pendente' : (u.ativo ? 'ativo' : 'off'), nomeDev: nd, declarado: decl.join(' / '),
        frente: (desenvolve || ehAtivo(nd)) ? frenteDe(nd, D) : { txt: '', padrao: false },
        axcred: !!(perf && perf.axcred), spike: !!u.aprova_spike, nova: !!u.interface_nova,
        capacidade: nd && ehAtivo(nd), acesso: u.ultimo_acesso || '', criado: u.criado_em || '',
        dem: contaDemandas(decl.length ? decl : (nd ? [nd] : []))
      };
    });
    // Quem esta na lista de devs (e portanto na capacidade) mas nao tem conta.
    ativos.forEach(function (n) {
      if (out.some(function (p) { return p.nomeDev && norm(p.nomeDev) === norm(n); })) return;
      var perf = (D.devs_perfil || {})[n] || {};
      out.push({ chave: 'd:' + n, login: '', nome: n, email: '', papel: 'semconta', status: 'semconta', nomeDev: n, declarado: n,
        frente: frenteDe(n, D), axcred: !!perf.axcred, spike: false, capacidade: true, acesso: '', criado: '', dem: contaDemandas([n]) });
    });
    var ordemPapel = { admin: 0, analista: 1, dev: 2, consulta: 3, semconta: 4 };
    return out.sort(function (a, b) {
      var oa = (a.status === 'pendente' ? -1 : 0) + (a.status === 'off' ? 10 : 0) + ordemPapel[a.papel];
      var ob = (b.status === 'pendente' ? -1 : 0) + (b.status === 'off' ? 10 : 0) + ordemPapel[b.papel];
      return oa - ob || String(a.nome).localeCompare(String(b.nome), 'pt-BR');
    });
  }

  var FILTROS = [
    { id: 'todos', rot: 'Todos', f: function () { return true; } },
    { id: 'admin', rot: 'Admin', f: function (p) { return p.papel === 'admin' && p.status !== 'off'; } },
    { id: 'analista', rot: 'Analista', f: function (p) { return p.papel === 'analista' && p.status !== 'off'; } },
    { id: 'dev', rot: 'Dev', f: function (p) { return p.papel === 'dev' && p.status !== 'off'; } },
    { id: 'consulta', rot: 'Consulta', f: function (p) { return p.papel === 'consulta' && p.status !== 'off'; } },
    { id: 'semconta', rot: 'Sem conta', f: function (p) { return p.status === 'semconta'; } },
    { id: 'pendente', rot: 'Pendentes', f: function (p) { return p.status === 'pendente'; } },
    { id: 'off', rot: 'Desativados', f: function (p) { return p.status === 'off'; } }
  ];

  function quando(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var dia = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    return H.dma(dia) + ' ' + d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  }

  function chipStatus(p) {
    if (p.status === 'pendente') return H.chip('pendente', 'wn', 'Pediu acesso e aguarda liberação no admin');
    if (p.status === 'off') return H.chip('desativado', 'dg');
    if (p.status === 'semconta') return H.chip('sem conta', 'bk', 'Está na lista de devs da base, mas não tem conta própria');
    return '';
  }

  function chipsPessoas(D) {
    if (!contas.lista) return '';
    var todas = pessoas(D);
    return FILTROS.map(function (f) {
      var n = todas.filter(f.f).length;
      if (!n && f.id !== 'todos' && f.id !== est.pesFiltro) return '';
      return '<button type="button" class="btns' + (f.id === est.pesFiltro ? ' on' : '') + '" data-cfg-pes-f="' + f.id + '">' + esc(f.rot) + ' ' + n + '</button>';
    }).join('');
  }
  // Redesenha so a lista e os filtros: o campo de busca fica com o foco.
  function pintarPessoas(D) {
    var box = document.getElementById('cfg-pes');
    if (box) box.innerHTML = corpoPessoas(D);
    var f = document.getElementById('cfg-pes-f');
    if (f) f.innerHTML = chipsPessoas(D);
  }

  function corpoPessoas(D) {
    if (contas.erro) {
      return H.vazio('alert', 'Não foi possível ler as contas', contas.erro,
        '<button type="button" class="btn" data-cfg-acao="recarregar-contas">Tentar de novo</button>');
    }
    if (!contas.lista) {
      return '<div class="grid" style="grid-template-columns:minmax(0,1fr) 320px;align-items:start">' +
        '<div class="sk" style="height:420px"></div><div class="sk" style="height:420px"></div></div>';
    }
    var todas = pessoas(D);
    var q = norm(est.pesBusca);
    var filtro = FILTROS.filter(function (f) { return f.id === est.pesFiltro; })[0] || FILTROS[0];
    var lista = todas.filter(filtro.f).filter(function (p) {
      return !q || norm([p.nome, p.login, p.email, p.nomeDev].join(' ')).indexOf(q) >= 0;
    });
    var sel = lista.filter(function (p) { return p.chave === est.pesSel; })[0] || lista[0] || null;
    var linhas = lista.length ? lista.map(function (p) {
      var pp = PAPEL[p.papel] || { rot: p.papel, cor: 'bk' };
      return '<tr class="cfg-tr' + (sel && p.chave === sel.chave ? ' on' : '') + '" data-cfg-pes="' + esc(p.chave) + '" tabindex="0">' +
        '<td><span class="row">' + H.av(p.nome) + '<span style="display:flex;flex-direction:column;min-width:0"><b style="font-size:13px;color:var(--tx)">' + esc(p.nome) + '</b>' +
        '<span class="note ell" style="font-size:11.5px">' + esc(p.email || (p.login ? p.login : 'só na lista de devs')) + '</span></span></span></td>' +
        '<td><span class="row" style="gap:6px;flex-wrap:wrap">' + (p.papel === 'semconta' ? '' : H.chip(esc(p.papel === 'analista' ? 'Analista' : pp.rot), pp.cor, pp.rot)) + chipStatus(p) + '</span></td>' +
        '<td>' + (p.frente.txt ? esc(p.frente.txt) + (p.frente.padrao ? ' <span class="note">(por padrão)</span>' : '') : '<span style="color:var(--tx4)">—</span>') +
        (p.axcred ? ' ' + H.chip('DEV-AXCred', 'ac') : '') + '</td>' +
        '<td class="mono" style="white-space:nowrap">' + (p.capacidade ? raiz.SPRINTPO.PONTOS_POR_DEV + ' pts' : '<span style="color:var(--tx4)">—</span>') + '</td>' +
        '<td class="mono" style="white-space:nowrap" title="abertas / total">' + (p.dem.total ? p.dem.abertas + '/' + p.dem.total : '<span style="color:var(--tx4)">0</span>') + '</td></tr>';
    }).join('') : '<tr><td colspan="5">' + H.vazio('users', 'Ninguém neste filtro', q ? 'Nada casa com "' + est.pesBusca + '".' : '') + '</td></tr>';

    return blocoPedidos() + '<div class="grid" style="grid-template-columns:minmax(0,1fr) 290px;align-items:start">' +
      '<section class="pn" style="padding:14px 12px 6px"><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>PESSOA</th><th>PAPEL</th><th>FRENTE</th><th>CAP.</th><th title="Demandas abertas / total">DEM.</th></tr></thead><tbody>' +
      linhas + '</tbody></table></div></section>' + painelPessoa(sel, D) + '</div>' +
      '<span class="note">Capacidade = ' + raiz.SPRINTPO.PONTOS_POR_DEV + ' pontos por sprint para quem está na lista de devs ativos (a mesma conta do Gantt). Demandas casam pelo “nome nas demandas”.</span>' + blocoDevs(D) + blocoLink();
  }

  /* Quantas demandas um nome alcanca — COPIA de `uQtdPorNome` (admin.html):
     conta com nome errado mostra 0 e a pessoa ve na hora. */
  function qtdPorNome(nome, D) {
    var alvo = semAcento(nome);
    if (!alvo) return 0;
    return (D.melhorias || []).filter(function (m) {
      return m && !m.mesclado_em && !m.oculto && String(m.dev || '').split('/').some(function (n) { return semAcento(n.trim()) === alvo; });
    }).length;
  }
  /* O seletor do nome nas demandas — COPIA de `uCelulaNomeDemandas`
     (admin.html): os nomes que existem na base, o declarado que saiu dela e o
     derivado do e-mail (escolher esse cria a pessoa na lista de devs). */
  function opcoesNomeDem(u, D) {
    var nomes = devsDosCards(D);
    var decl = String(u.nome_demandas || '').split(/[\/,;]/).map(txt).filter(Boolean);
    var ops = nomes.map(function (n) { return { v: n, r: n }; });
    decl.forEach(function (d) { if (!nomes.some(function (n) { return semAcento(n) === semAcento(d); })) ops.push({ v: d, r: d + ' (fora da base)' }); });
    var sug = txt(u.nome_sugerido);
    if (sug && !ops.some(function (o) { return semAcento(o.v) === semAcento(sug); })) ops.push({ v: sug, r: sug + ' (criar — do e-mail)' });
    return '<option value="">— pelo nome da conta —</option>' + ops.map(function (o) {
      return '<option value="' + esc(o.v) + '"' + (decl.some(function (d) { return semAcento(d) === semAcento(o.v); }) ? ' selected' : '') + '>' +
        esc(o.r + '  (' + qtdPorNome(o.v, D) + ')') + '</option>';
    }).join('');
  }
  /** O alcance pelos tres nomes que a API aceita (declarado, do e-mail e o da conta). */
  function alcance(u, D) {
    var decl = String(u.nome_demandas || '').split(/[\/,;]/).map(txt).filter(Boolean);
    var aceitos = decl.concat([txt(u.nome_sugerido), txt(u.nome)]).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    var n = aceitos.reduce(function (t, d) { return t + qtdPorNome(d, D); }, 0);
    var porQual = aceitos.filter(function (d) { return qtdPorNome(d, D) > 0; });
    if (n) return H.plural(n, 'demanda', 'demandas') + (porQual.length ? ' · por ' + porQual.map(esc).join(' e ') : '');
    return ['dev', 'analista'].indexOf(String(u.papel || '')) >= 0 ? '<span style="color:var(--dg-t)">nenhuma demanda casa — a API devolve vazio</span>' : '';
  }
  /* A frente — COPIA de `uCelulaPipeline` (admin.html): so as frentes do deck,
     e a semente aparece como "(por padrao)" em vez de vir marcada em silencio. */
  function opcoesFrente(nome, D) {
    var P = raiz.PIPELINES;
    if (!P) return '';
    var perf = (D.devs_perfil || {})[nome];
    var cad = P.canonica(perf && typeof perf === 'object' ? perf.pipeline : '');
    var sem = P.doDev(nome, {});
    return '<option value=""' + (cad ? '' : ' selected') + '>' + (sem ? '(por padrão) ' + esc(sem) : '— definir —') + '</option>' +
      P.nomes.map(function (n) { return '<option value="' + esc(n) + '"' + (cad === n ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('');
  }

  function painelPessoa(p, D) {
    if (!p) return '<section class="pnh">' + H.vazio('user', 'Escolha uma pessoa', 'Clique numa linha para ver o perfil.') + '</section>';
    var edita = H.pode('configurar');
    var u = p.u || {};
    var L = esc(p.login || '');
    var noDev = !!p.nomeDev;
    var naLst = noDev && devsAtivos(D).some(function (a) { return norm(a) === norm(p.nomeDev); });
    var papeis = ['consulta', 'dev', 'analista', 'admin'].map(function (k) {
      var on = k === p.papel;
      var est = on ? 'background:rgba(var(--ac-rgb),.16);color:var(--ac-t);box-shadow:inset 0 0 0 1px rgba(var(--ac-rgb),.4)' : 'background:var(--sf2);color:var(--tx3)';
      var rot = esc(k === 'analista' ? 'Analista' : PAPEL[k].rot);
      return edita && p.status !== 'pendente'
        ? '<button type="button" class="chip cfg-papel" style="justify-content:center;height:30px;border:0;cursor:pointer;' + est + '" data-cfg-acao="u-papel" data-cfg-login="' + L + '" data-cfg-papel="' + k + '" aria-pressed="' + on + '">' + rot + '</button>'
        : '<span class="chip" style="justify-content:center;height:30px;' + est + '">' + rot + '</span>';
    }).join('');
    var sw = function (rot, on, titulo, acao, dados) {
      var ctl = edita && acao
        ? '<button type="button" class="cfg-sw' + (on ? ' on' : '') + '" data-cfg-acao="' + acao + '"' + dados + ' role="switch" aria-checked="' + on + '" aria-label="' + esc(rot) + '"></button>'
        : '<span class="cfg-sw' + (on ? ' on' : '') + '" role="img" aria-label="' + (on ? 'sim' : 'não') + '"></span>';
      return '<div class="cfg-lin" title="' + esc(titulo) + '"><span>' + rot + '</span>' + ctl + '</div>';
    };
    var b = function (acao, rot, cls, dados, icone) {
      return '<button type="button" class="' + (cls || 'btn') + '" data-cfg-acao="' + acao + '"' + (dados || '') + '>' + (icone ? ico(icone) + ' ' : '') + esc(rot) + '</button>';
    };
    var dLogin = ' data-cfg-login="' + L + '"', dDev = ' data-cfg-dev="' + esc(p.nomeDev || '') + '"';
    var h = '<section class="pnh">' +
      '<div class="row">' + H.av(p.nome, 44) + '<span style="display:flex;flex-direction:column;min-width:0"><b style="font-size:15px" class="ell">' + esc(p.nome) + '</b>' +
      '<span class="note ell">' + esc(p.email || p.login || 'sem conta própria') + '</span></span></div>' +
      (p.status !== 'ativo' ? '<div>' + chipStatus(p) + '</div>' : '');
    if (p.status === 'pendente') {
      h += info('Pediu acesso' + (p.criado ? ' em ' + esc(quando(p.criado)) : '') + '. Liberar pede o papel — sem padrão: quem libera diz o que a pessoa pode fazer.') +
        (edita ? '<div class="row" style="gap:8px">' + b('u-aprovar', 'Liberar…', 'btnp', dLogin) + b('u-recusar', 'Recusar', 'btn perigo', dLogin) + '</div>' : '');
      return h + '</section>';
    }
    if (p.papel === 'semconta') {
      h += info('Está na lista de devs da base (entra na capacidade e no Gantt), mas não tem login.') +
        (edita ? '<div class="row">' + b('u-criar', 'Criar conta', 'btnp', ' data-cfg-nome="' + esc(p.nome) + '"', 'plus') + '</div>' : '');
    } else {
      h += '<span class="note">Papel</span><div class="grid" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:6px">' + papeis + '</div>' +
        '<label class="note" for="cfg-u-nomedem">Nome que aparece nas demandas</label>' +
        (edita ? '<select class="in" id="cfg-u-nomedem"' + dLogin + '>' + opcoesNomeDem(u, D) + '</select>'
               : '<span class="in">' + (p.declarado || p.nomeDev ? esc(p.declarado || p.nomeDev) : '<span style="color:var(--tx4)">— não declarado —</span>') + '</span>') +
        '<span class="note" style="font-size:12px">' + alcance(u, D) + '</span>';
    }
    if (noDev) {
      h += '<label class="note" for="cfg-frente">Frente</label>' +
        (edita ? '<select class="in" id="cfg-frente"' + dDev + '>' + opcoesFrente(p.nomeDev, D) + '</select>'
               : '<span class="in">' + (p.frente.txt ? esc(p.frente.txt) : '<span style="color:var(--tx4)">— sem frente —</span>') + '</span>') +
        '<div class="cfg-lin"><span>Lista de devs <span class="note" style="display:block;font-size:11.5px">' +
        (naLst ? 'entra na capacidade · ' + raiz.SPRINTPO.PONTOS_POR_DEV + ' pts por sprint' : 'fora da capacidade') + '</span></span>' +
        (edita ? (naLst ? b('dev-tirar', 'Tirar da lista', 'btns', dDev) : b('dev-incluir', 'Incluir na lista', 'btns', dDev)) : '') + '</div>';
    }
    h += '<span class="note">' + H.plural(p.dem.abertas, 'demanda aberta', 'demandas abertas') + ' · ' + H.plural(p.dem.total, 'no total', 'no total') + '</span>' +
      '<span class="lab" style="margin-top:6px">PERMISSÕES EXTRAS</span>' +
      (p.papel !== 'semconta' ? sw('Aprova spike', p.spike, 'Pode assinar a aprovação de um spike', 'u-spike', dLogin) : '') +
      (p.papel !== 'semconta' && p.status !== 'pendente' ? sw('Interface nova', p.nova, 'Usa o app AXIS; desligado, entra nas telas de sempre', 'u-interface', dLogin) : '') +
      (noDev ? sw('DEV-AXCred', p.axcred, 'Aparece primeiro no Planejamento', 'perfil-axcred', dDev) : '');
    if (p.status !== 'semconta') {
      h += '<span class="note" style="font-size:12px">' + (p.acesso ? 'Último acesso em ' + esc(quando(p.acesso)) : '<span style="color:var(--wn-t)">Nunca entrou com a conta</span> (pode estar usando a senha geral)') +
        (p.criado ? ' · conta criada em ' + esc(H.dma(String(p.criado).slice(0, 10))) : '') + '</span>';
      if (edita) {
        h += '<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:4px">' + b('u-nome', 'Renomear', 'btns', dLogin) + b('u-email', p.email ? 'E-mail' : '+ E-mail', 'btns', dLogin) +
          b('u-senha', 'Nova senha', 'btns', dLogin) + '</div>' +
          (p.status === 'off' ? b('u-ativo', 'Reativar conta', 'btnp', dLogin + ' data-cfg-ativo="1"') : b('u-ativo', 'Desativar conta', 'btn perigo', dLogin + ' data-cfg-ativo="0"'));
      }
    }
    return h + '</section>';
  }

  /* A LISTA DE DEVS, abaixo das pessoas: quem esta nela (a capacidade), quem
     saiu (`devs_removidos`) e quem tem a conta desativada. Incluir, reincluir
     e juntar dois nomes da mesma pessoa sao daqui. */
  function blocoDevs(D) {
    var ativos = devsAtivos(D);
    var rem = (D.devs_removidos || []).filter(function (n) { return !ativos.some(function (a) { return norm(a) === norm(n); }); });
    var ina = (inativos.lista || []).filter(function (n) { return (D.desenvolvedores || []).some(function (a) { return norm(a) === norm(n); }); });
    var edita = H.pode('configurar');
    return '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><h2 class="h2">Lista de devs <span class="note mono">' + ativos.length + '</span></h2>' +
      (edita ? '<span class="row" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn" data-cfg-acao="dev-juntar">' + ico('link') + ' Juntar dois nomes</button>' +
        '<button type="button" class="btnp" data-cfg-acao="dev-incluir">' + ico('plus') + ' Incluir dev</button></span>' : '') + '</div>' +
      '<span class="note">Quem está aqui entra na capacidade e no Planejamento. Tirar não mexe nas demandas concluídas; com demanda ativa, não sai. Juntar reescreve o responsável em todas as demandas, inclusive as concluídas.</span>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px">' + ativos.slice().sort(function (a, b) { return String(a).localeCompare(String(b), 'pt-BR'); }).map(function (n) {
        return H.chip(esc(n), (D.devs_perfil || {})[n] && D.devs_perfil[n].axcred ? 'ac' : 'bk', (D.devs_perfil || {})[n] && D.devs_perfil[n].axcred ? 'DEV-AXCred' : '');
      }).join('') + '</div>' +
      (ina.length ? '<span class="note" style="font-size:12px">Fora da capacidade por conta desativada: ' + ina.map(esc).join(', ') + '.</span>' : '') +
      (rem.length ? '<span class="lab" style="margin-top:4px">SAÍRAM DA LISTA</span><div style="display:flex;flex-direction:column;gap:6px">' + rem.map(function (n) {
        return '<div class="cfg-it"><span style="flex:1;min-width:0" class="ell">' + esc(n) + '</span><span class="note">' + H.plural(qtdPorNome(n, D), 'demanda', 'demandas') + '</span>' +
          (edita ? '<button type="button" class="btns" data-cfg-acao="dev-incluir" data-cfg-dev="' + esc(n) + '">Reincluir</button>' : '') + '</div>';
      }).join('') + '</div>' : '') + '</section>';
  }

  /* OS PEDIDOS DE SENHA em aberto (rota `usuarios`, op `listar`): a mesma
     caixa do admin, resolvida aqui com "Nova senha". */
  function blocoPedidos() {
    var ps = contas.pedidos || [];
    if (!ps.length) return '';
    return '<section class="pn" style="border-color:rgba(var(--wn-rgb),.4)"><h2 class="h2">' + H.plural(ps.length, 'pedido de senha', 'pedidos de senha') + '</h2>' +
      ps.map(function (q) {
        return '<div class="cfg-it"><span style="flex:1;min-width:0;display:flex;flex-direction:column"><b class="ell">' + esc(q.nome || q.login) + '</b><span class="note" style="font-size:11.5px">' +
          esc(q.login) + ' · pediu em ' + esc(quando(q.criado_em)) + '</span></span>' +
          (H.pode('configurar') ? '<button type="button" class="btnp" data-cfg-acao="u-senha" data-cfg-login="' + esc(q.login) + '">Nova senha</button>' : '') + '</div>';
      }).join('') + '</section>';
  }

  /* O LINK DE VISUALIZACAO SEM LOGIN (gantt.html, `copiarLinkVisualizacao`).
     O app novo e so com conta — a consulta e o perfil de quem so le —, entao o
     link continua abrindo o Gantt em modo so-leitura, para quem nao tem conta. */
  function blocoLink() {
    var chave = raiz.VIEW_CHAVE || '';
    return '<section class="pn"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><h2 class="h2">Link de visualização sem login</h2>' +
      '<button type="button" class="btn" data-cfg-acao="link-view">' + ico('clipboard') + ' Copiar link</button></div>' +
      '<span class="note">Abre o Gantt em modo somente leitura, sem pedir senha — para quem acompanha e não tem conta. Quem tem conta entra aqui pelo perfil Consulta, com nome.' +
      (chave ? '' : ' <span style="color:var(--wn-t)">A chave de leitura (VIEW_CHAVE) não está configurada neste ambiente: com a trava de leitura ligada no Worker, o link abre sem dados.</span>') + '</span></section>';
  }

  function secPessoas(ctx) {
    var acoes = H.pode('configurar') ? '<button type="button" class="btn" data-cfg-acao="u-interface-admins" title="Liga a interface nova para todos os admins ativos">Interface nova para todos os admins</button>' +
      '<button type="button" class="btnp" data-cfg-acao="u-criar">' + ico('plus') + ' Criar conta</button>' : '';
    return cab('Pessoas e perfis', 'Contas (login próprio) e a lista de devs da base: papel, nome nas demandas, frente, capacidade e as permissões extras. O que se muda aqui vale para o admin, o Gantt e o Worker.', acoes) +
      '<div class="row" style="flex-wrap:wrap;gap:8px"><span id="cfg-pes-f" class="row" style="flex-wrap:wrap;gap:8px;flex:1 1 320px;min-width:0">' + chipsPessoas(ctx.D) + '</span>' +
      '<input class="in cfg-q" id="cfg-pes-q" type="search" placeholder="Buscar pessoa" value="' + esc(est.pesBusca) + '" aria-label="Buscar pessoa"></div>' +
      '<div id="cfg-pes" style="display:flex;flex-direction:column;gap:16px">' + corpoPessoas(ctx.D) + '</div>';
  }

  function carregarContas(forcar) {
    if (contas.carregando) return;
    if (!forcar && contas.lista && Date.now() - contas.em < 60000) return;
    contas.carregando = true; contas.erro = '';
    H.api('usuarios', { op: 'listar' }).then(function (j) {
      contas.lista = j.usuarios || [];
      contas.pedidos = j.pedidos || [];
      contas.em = Date.now();
    }).catch(function (e) {
      contas.erro = e.status === 401 || e.status === 403 ? 'Esta sessão não tem permissão para listar contas.' : String(e.message || e);
    }).then(function () {
      contas.carregando = false;
      if (raiz.AXIS_APP.APP.rota.aba === 'pessoas') pintarPessoas(raiz.AXIS_APP.APP.D);
    });
    // Os nomes das contas desativadas, uma vez por pagina (como `devsCarregaInativos` no admin).
    if (!inativos.pedido) {
      inativos.pedido = true;
      H.api('devs-inativos').then(function (j) {
        inativos.lista = Array.isArray(j.nomes) ? j.nomes : [];
        if (inativos.lista.length && raiz.AXIS_APP.APP.rota.aba === 'pessoas') pintarPessoas(raiz.AXIS_APP.APP.D);
      }).catch(function () { inativos.pedido = false; });
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // AS GRAVACOES DOS CADASTROS
  // ════════════════════════════════════════════════════════════════════════
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  var U_ERROS = {
    sem_permissao: 'Só quem é admin pode gerenciar contas.', existe: 'Já existe conta com esse usuário ou e-mail.',
    nao_encontrado: 'Conta não encontrada.', ultimo_admin: 'Este é o único admin ativo. Promova outra pessoa antes.',
    nao_pendente: 'Esta conta já está em uso. Use Desativar.', indisponivel: 'O banco de dados não está disponível.',
    limite: 'Muitas tentativas em pouco tempo. Espere um minuto.'
  };
  var U_PAPEL_ROTULO = { consulta: 'Consulta', dev: 'Dev', analista: 'Analista de Requisitos', admin: 'Admin' };

  async function chamaConta(op, extra, msg) {
    try {
      var j = await H.api('usuarios', Object.assign({ op: op }, extra || {}));
      if (msg) H.toast(typeof msg === 'function' ? msg(j || {}) : msg);
      return j || {};
    } catch (e) {
      H.toast((e.corpo && e.corpo.detail) || U_ERROS[e.codigo] || (e.status === 401 ? 'Sessão expirada — saia e entre de novo.' : 'Não foi possível concluir. Tente novamente.'), 'erro');
      return null;
    } finally { carregarContas(true); }
  }

  /** Grava uma chave do topo montada sobre a base FRESCA (a de `H.gravar` e
   *  relida de novo antes de enviar; a janela que sobra e a de uma leitura). */
  async function gravaRaiz(fn, ok) {
    var base;
    try { base = await H.api('dados'); }
    catch (e) { H.toast(e.status === 401 ? 'Sessão expirada — saia e entre de novo.' : 'Sem conexão com o servidor: ' + (e.message || e), 'erro'); return { ok: false }; }
    var r = fn(base);
    if (!r || !r.ok) { if (r && r.erro) H.toast(r.erro, 'erro'); return r || { ok: false }; }
    return H.gravar(r.patch || {}, { ok: typeof ok === 'function' ? ok(r) : ok, raiz: r.raiz });
  }

  /** A caixa de pergunta do app (`AXIS_ACOES.caixa`), com um retoque depois de
   *  aberta (senha escondida, lista de sugestoes, previa). */
  function caixa(o, retoque) {
    var A = raiz.AXIS_ACOES;
    if (!A) { H.toast('axis-acoes.js não carregado.', 'erro'); return Promise.resolve(null); }
    var p = A.caixa(o);
    var ovs = document.querySelectorAll('.ovl');
    var ov = ovs[ovs.length - 1];
    if (retoque && ov) { try { retoque(ov); } catch (e) { console.error(e); } }
    return p;
  }
  function senhaEscondida(ov, id) { var s = ov.querySelector('#axc-' + id); if (s) { s.type = 'password'; s.autocomplete = 'new-password'; } }
  function comLista(ov, id, nomes) {
    var i = ov.querySelector('#axc-' + id);
    if (!i) return;
    var dl = document.createElement('datalist');
    dl.id = 'cfg-dl-' + id;
    dl.innerHTML = nomes.map(function (n) { return '<option value="' + esc(n) + '"></option>'; }).join('');
    ov.appendChild(dl);
    i.setAttribute('list', dl.id);
  }
  function confirma(titulo, texto, ok, perigo) { return caixa({ titulo: titulo, texto: texto, ok: ok, perigo: perigo !== false }); }
  function contaDe(login) { return (contas.lista || []).filter(function (u) { return u.login === login; })[0] || null; }
  function D0() { return raiz.AXIS_APP.APP.D || {}; }
  function temaPorId(id) { return (D0().temas || []).filter(function (t) { return String(t.id) === String(id); })[0] || null; }
  function temaPorNome(nome) {
    var n = txt(nome).toLowerCase();
    return (D0().temas || []).filter(function (t) { return String(t.nome || '').toLowerCase() === n; })[0] || null;
  }
  function previaTema(v) {
    v = txt(v);
    if (!v) return 'Separe os níveis com " - " (espaço, hífen, espaço).';
    var p = v.split(' - ').map(txt).filter(Boolean);
    return p.join(' › ') + (p.length === 1 ? ' (sistema, sem módulo)' : '');
  }
  function comPrevia(ov, id) {
    var i = ov.querySelector('#axc-' + id), n = i && i.parentNode.querySelector('.note');
    if (!i || !n) return;
    var pinta = function () { n.textContent = previaTema(i.value); };
    i.addEventListener('input', pinta); pinta();
  }

  var CFG_ACOES = {
    'recarregar-contas': function () { contas.erro = ''; pintarPessoas(D0()); carregarContas(true); },

    // ── Catalogo ───────────────────────────────────────────────────────
    'tema-novo': function () { return CFG_ACOES['tema-editar'](null); },
    'tema-editar': async function (el) {
      var id = el ? el.getAttribute('data-cfg-id') : '';
      var t = id ? temaPorId(id) : null;
      var v = await caixa({ titulo: t ? 'Renomear tema' : 'Novo tema',
        texto: t ? 'O id continua o mesmo: as demandas vinculadas não mudam, só o nome que aparece nelas.' : 'Um campo só: o nome é o caminho. "AXCred - Cadastro - Reanálise" é um tema de terceiro nível.',
        campos: [{ nome: 'nome', rotulo: 'Caminho completo', valor: t ? t.nome : '', dica: 'Ex.: AXCred - Cadastro - Análise de Crédito - Reanálise', obrig: true, nota: ' ' }],
        ok: 'Salvar', valida: function (x) { var r = temaSalvar(D0().temas || [], t ? t.id : '', x.nome, 'x'); return r.ok ? '' : { erro: r.erro, campo: 'nome' }; } },
        function (ov) { comPrevia(ov, 'nome'); });
      if (!v) return;
      var novoId = uid();
      return gravaRaiz(function (base) {
        var r = temaSalvar(base.temas || [], t ? t.id : '', v.nome, novoId);
        if (r.ok) r.raiz = { temas: r.temas };
        return r;
      }, 'Tema salvo.');
    },
    'tema-juntar': async function (el) {
      var de = temaPorId(el.getAttribute('data-cfg-id'));
      if (!de) return;
      var c = dadosCatalogo(D0());
      var sugerido = temaPorId(c.tortoPara[String(de.id)]);
      var dentro = raiz.catalogoDentro || function () { return false; };
      var pre = temaJuntar(D0(), de.id, sugerido ? sugerido.id : (D0().temas || []).filter(function (t) { return t.id !== de.id; }).map(function (t) { return t.id; })[0], dentro);
      if (!pre.ok && pre.filhos) {
        await caixa({ titulo: '"' + de.nome + '" tem submódulos', texto: 'Juntar deixaria ' + pre.filhos.length + ' deles pendurados num caminho que deixou de existir — e o filtro por sistema pararia de trazê-los:\n\n' +
          pre.filhos.map(function (x) { return '• ' + x.nome; }).join('\n') + '\n\nRenomeie ou junte os submódulos primeiro.', ok: 'Entendi' });
        return;
      }
      var alvo = null;
      var v = await caixa({ titulo: 'Juntar "' + de.nome + '"',
        texto: 'As demandas deste tema passam para o tema que fica, e "' + de.nome + '" sai da lista. Não há como desfazer.',
        campos: [{ nome: 'para', rotulo: 'Tema que fica', valor: sugerido ? sugerido.nome : '', dica: 'Digite ou escolha o caminho', obrig: true }],
        ok: 'Continuar', valida: function (x) {
          alvo = temaPorNome(x.para);
          if (!alvo) return { erro: 'Nenhum tema com esse caminho. Escolha um da lista.', campo: 'para' };
          var r = temaJuntar(D0(), de.id, alvo.id, dentro);
          return r.ok ? '' : { erro: r.erro, campo: 'para' };
        } }, function (ov) { comLista(ov, 'para', (D0().temas || []).filter(function (t) { return t.id !== de.id; }).map(function (t) { return t.nome; })); });
      if (!v || !alvo) return;
      var r0 = temaJuntar(D0(), de.id, alvo.id, dentro);
      var ok = await confirma('Juntar "' + de.nome + '" em "' + alvo.nome + '"',
        (r0.afetadas.length ? r0.afetadas.length + ' demanda(s) passam a ser de "' + alvo.nome + '". ' : 'Nenhuma demanda usa este tema. ') +
        'O tema "' + de.nome + '" sai da lista. Não há como desfazer.', 'Juntar');
      if (!ok) return;
      var paraId = alvo.id;
      return gravaRaiz(function (base) {
        var r = temaJuntar(base, de.id, paraId, dentro);
        if (r.ok) r.raiz = { temas: r.temas };
        return r;
      }, function (r) { return r.afetadas.length + ' demanda(s) agora são de "' + r.para.nome + '".'; });
    },
    'tema-excluir': async function (el) {
      var t = temaPorId(el.getAttribute('data-cfg-id'));
      if (!t) return;
      var n = temaExcluir(D0(), t.id).n;
      var ok = await confirma('Excluir tema', '"' + t.nome + '" sai da lista. ' + (n ? 'As ' + n + ' demanda(s) vinculadas ficam sem tema — juntar em outro tema as preserva. ' : 'Nenhuma demanda usa este tema. ') + 'Não há como desfazer.', 'Excluir');
      if (!ok) return;
      return gravaRaiz(function (base) {
        var r = temaExcluir(base, t.id);
        if (r.ok) r.raiz = { temas: r.temas };
        return r;
      }, 'Tema removido.');
    },

    // ── Contas ─────────────────────────────────────────────────────────
    'u-criar': async function (el) {
      var nome = el ? el.getAttribute('data-cfg-nome') || '' : '';
      var v = await caixa({ titulo: 'Criar conta', texto: nome ? 'Confira o e-mail sugerido e defina a senha inicial de ' + nome + '.' : 'O login sai do e-mail. Entregue o e-mail e a senha para a pessoa; ela troca depois em Minha conta.',
        campos: [{ nome: 'nome', rotulo: 'Nome', valor: nome, dica: 'Nome completo', obrig: true },
                 { nome: 'email', rotulo: 'E-mail', valor: nome ? emailSugerido(nome) : '', dica: 'nome.sobrenome' + DOMINIO, obrig: true },
                 { nome: 'papel', rotulo: 'Permissão', tipo: 'opcoes', valor: nome ? 'dev' : 'consulta', opcoes: ['consulta', 'dev', 'analista', 'admin'].map(function (k) { return { v: k, r: U_PAPEL_ROTULO[k] }; }) },
                 { nome: 'senha', rotulo: 'Senha inicial', dica: 'Ao menos 8 caracteres', obrig: true }],
        ok: 'Criar conta', valida: contaNova },
        function (ov) {
          senhaEscondida(ov, 'senha');
          var ni = ov.querySelector('#axc-nome'), ei = ov.querySelector('#axc-email');
          // O nome sugere os colaboradores (rota `colaboradores`), e o e-mail vem junto.
          if (raiz.COLABORADORES && ni) {
            raiz.COLABORADORES.ligar(ni, raiz.AXIS_APP.WORKER, function () { return { token: raiz.AXIS_APP.APP.token }; });
            ni.addEventListener('change', function () {
              var c = raiz.COLABORADORES.acha(raiz.COLABORADORES.lista(), ni.value);
              if (c && c.email && ei && !txt(ei.value)) ei.value = c.email;
            });
          }
        });
      if (!v) return;
      var email = txt(v.email).toLowerCase();
      return chamaConta('criar', { nome: txt(v.nome), email: email, papel: v.papel, senhaNova: v.senha },
        'Conta de ' + txt(v.nome) + ' criada. Entregue o e-mail "' + email + '" e a senha para a pessoa.');
    },
    'u-aprovar': async function (el) {
      var login = el.getAttribute('data-cfg-login');
      var v = await caixa({ titulo: 'Liberar "' + login + '"', texto: 'A pessoa já pode entrar com a senha que ela escolheu. Escolha o que ela pode fazer.',
        campos: [{ nome: 'papel', tipo: 'opcoes', valor: '', opcoes: [{ v: '', r: 'Escolha o papel', d: 'Sem padrão: com Dev pré-escolhido, liberar sem olhar dava permissão de gravar.' }].concat(
          ['dev', 'analista', 'consulta', 'admin'].map(function (k) { return { v: k, r: U_PAPEL_ROTULO[k] }; })) }],
        ok: 'Liberar', verde: true, valida: function (x) { return x.papel ? '' : 'Escolha o papel antes de liberar "' + login + '".'; } });
      if (!v) return;
      var r = await chamaConta('aprovar', { login: login, papel: v.papel });
      if (!r) return;
      var nomeDem = txt(r.nome_demandas);
      if (!(nomeDem && v.papel === 'dev')) { H.toast('"' + login + '" liberado. A pessoa já pode entrar com a senha que ela escolheu.'); return; }
      if (!naLista(D0(), nomeDem)) { H.toast('"' + login + '" liberado. Já está na lista de devs como "' + nomeDem + '".'); return; }
      var g = await gravaRaiz(function (base) { var rz = naLista(base, nomeDem); return rz ? { ok: true, raiz: rz } : { ok: false, ja: true }; },
        '"' + login + '" liberado. Adicionada à lista de devs como "' + nomeDem + '".');
      if (g && g.ja) H.toast('"' + login + '" liberado. Já está na lista de devs como "' + nomeDem + '".');
      else if (!g || !g.ok) H.toast('ATENÇÃO: não consegui incluir "' + nomeDem + '" na lista de devs — inclua abaixo, em Lista de devs.', 'erro');
    },
    'u-recusar': async function (el) {
      var login = el.getAttribute('data-cfg-login');
      if (!(await confirma('Recusar cadastro', 'O cadastro de "' + login + '" é apagado. A pessoa pode se cadastrar de novo.', 'Recusar'))) return;
      return chamaConta('recusar', { login: login }, 'Cadastro de "' + login + '" recusado.');
    },
    'u-papel': async function (el) {
      var login = el.getAttribute('data-cfg-login'), papel = el.getAttribute('data-cfg-papel');
      var u = contaDe(login);
      if (!u || u.papel === papel) return;
      return chamaConta('papel', { login: login, papel: papel }, 'Permissão de "' + login + '" agora é ' + U_PAPEL_ROTULO[papel] + '.');
    },
    'u-ativo': async function (el) {
      var login = el.getAttribute('data-cfg-login'), ativo = el.getAttribute('data-cfg-ativo') === '1';
      if (!ativo && !(await confirma('Desativar conta', '"' + login + '" perde o acesso imediatamente. O histórico é preservado.', 'Desativar'))) return;
      return chamaConta('ativo', { login: login, ativo: ativo }, ativo ? '"' + login + '" reativado.' : '"' + login + '" desativado e desconectado.');
    },
    'u-senha': async function (el) {
      var login = el.getAttribute('data-cfg-login');
      var v = await caixa({ titulo: 'Nova senha para ' + login, texto: 'A pessoa será desconectada e terá de entrar com esta senha. Ela pode trocar depois em Minha conta.',
        campos: [{ nome: 'senha', rotulo: 'Nova senha', dica: 'Ao menos 8 caracteres', obrig: true }], ok: 'Trocar senha', perigo: true,
        valida: function (x) { return String(x.senha || '').length < 8 ? { erro: 'A senha precisa de ao menos 8 caracteres.', campo: 'senha' } : ''; } },
        function (ov) { senhaEscondida(ov, 'senha'); });
      if (!v) return;
      return chamaConta('senha', { login: login, senhaNova: v.senha }, 'Senha de "' + login + '" trocada. Sessões abertas dessa pessoa foram encerradas.');
    },
    'u-email': async function (el) {
      var login = el.getAttribute('data-cfg-login'), u = contaDe(login) || {};
      var v = await caixa({ titulo: 'E-mail de ' + login, texto: 'É por ele que a pessoa entra e recupera a senha. Deixe vazio para remover.',
        campos: [{ nome: 'email', rotulo: 'E-mail', valor: u.email || '', dica: 'nome.sobrenome' + DOMINIO }], ok: 'Salvar',
        valida: function (x) { var e = txt(x.email).toLowerCase(); return e && !e.endsWith(DOMINIO) ? { erro: 'O e-mail precisa terminar com ' + DOMINIO, campo: 'email' } : ''; } });
      if (!v) return;
      var e = txt(v.email).toLowerCase();
      return chamaConta('email', { login: login, email: e }, e ? '"' + login + '" agora entra também pelo e-mail ' + e + '.' : 'E-mail de "' + login + '" removido.');
    },
    'u-nome': async function (el) {
      var login = el.getAttribute('data-cfg-login'), u = contaDe(login) || {};
      var v = await caixa({ titulo: 'Renomear conta', texto: 'O nome aparece no histórico do card e na mensagem de commit. Errado, ele contamina a trilha de auditoria.',
        campos: [{ nome: 'nome', rotulo: 'Nome completo', valor: u.nome || '', obrig: true }], ok: 'Salvar',
        valida: function (x) { return txt(x.nome).length < 3 ? { erro: 'Informe o nome completo.', campo: 'nome' } : ''; } });
      if (!v) return;
      return chamaConta('nome', { login: login, nome: txt(v.nome) }, 'Nome corrigido.');
    },
    /* INTERFACE NOVA POR CONTA (axis-interface.js). Ligada, a pessoa passa a
       usar o app; desligada, volta as telas de sempre na proxima tela que abrir. */
    'u-interface': async function (el) {
      var login = el.getAttribute('data-cfg-login'), u = contaDe(login) || {};
      var liga = !u.interface_nova;
      return chamaConta('interface', { login: login, nova: liga },
        liga ? '"' + login + '" passa a usar a interface nova na próxima tela que abrir.' : '"' + login + '" volta às telas de sempre.');
    },
    'u-interface-admins': async function () {
      if (window.confirmar && !(await window.confirmar({ titulo: 'Interface nova para todos os admins',
          texto: 'Todos os admins ativos passam a usar o app AXIS na próxima tela que abrirem. Dá para desligar um a um depois.', ok: 'Ligar' }))) return;
      return chamaConta('interface', { todos_admins: true, nova: true }, 'Interface nova ligada para todos os admins.');
    },
    'u-spike': async function (el) {
      var login = el.getAttribute('data-cfg-login'), u = contaDe(login) || {};
      var aprova = !u.aprova_spike;
      var r = await chamaConta('aprova-spike', { login: login, aprova: aprova });
      if (!r) return;
      // Com menos de tres aprovadores ativos, nenhum spike consegue fechar (`uAprovaSpike`).
      if (typeof r.aprovadores === 'number' && r.aprovadores < (r.minimo || 3)) {
        H.toast('Agora só ' + r.aprovadores + ' pessoa(s) podem assinar spike, e são necessárias ' + (r.minimo || 3) + '. Enquanto for assim, nenhum spike consegue ser concluído.', 'erro');
      } else H.toast(aprova ? 'Passa a aprovar spike.' : 'Não aprova mais spike.');
    },
    'u-nomedem': async function (el) {
      var login = el.getAttribute('data-cfg-login'), valor = el.value;
      var r = await chamaConta('nome-demandas', { login: login, nome_demandas: valor });
      if (!r) return;
      // So quem desenvolve ganha linha na lista de devs (`uNomeDemandas`).
      var conta = contaDe(login) || {};
      var desenvolve = ['dev', 'analista'].indexOf(String(conta.papel || '')) >= 0;
      var msg = valor ? 'Pronto: as demandas de "' + valor + '" passam a ser desta conta.' : 'Voltou a casar pelo nome da conta.';
      if (!(desenvolve && valor && naLista(D0(), valor))) { H.toast(msg); return; }
      var g = await gravaRaiz(function (base) { var rz = naLista(base, valor); return rz ? { ok: true, raiz: rz } : { ok: false, ja: true }; }, msg + ' "' + valor + '" foi criado na lista de devs.');
      if (g && g.ja) H.toast(msg);
      else if (!g || !g.ok) H.toast('ATENÇÃO: não consegui criar "' + valor + '" na lista de devs.', 'erro');
    },

    // ── Perfil e lista de devs ─────────────────────────────────────────
    'perfil-axcred': function (el) {
      var nome = el.getAttribute('data-cfg-dev');
      if (!nome) { H.toast('Sem nome nas demandas, não há a quem marcar.', 'erro'); return; }
      var liga = !(((D0().devs_perfil || {})[nome]) || {}).axcred;
      return gravaRaiz(function (base) { return { ok: true, raiz: { devs_perfil: perfilCom(base.devs_perfil, nome, 'axcred', liga) } }; },
        liga ? '"' + nome + '" marcado como DEV-AXCred — aparece primeiro no Planejamento.' : 'Marcação de DEV-AXCred removida de "' + nome + '".');
    },
    'perfil-frente': function (el) {
      var nome = el.getAttribute('data-cfg-dev'), valor = el.value;
      if (!nome) return;
      return gravaRaiz(function (base) { return { ok: true, raiz: { devs_perfil: perfilCom(base.devs_perfil, nome, 'pipeline', valor) } }; },
        valor ? 'Frente de "' + nome + '": ' + valor + '.' : 'Frente de "' + nome + '" volta ao padrão.');
    },
    'dev-tirar': async function (el) {
      var nome = el.getAttribute('data-cfg-dev');
      var pre = devTirar(D0(), nome);
      if (!pre.ok) {
        await caixa({ titulo: 'Não dá para tirar "' + nome + '"', texto: 'Está em ' + pre.ativas.length + ' demanda(s) ativa(s):\n\n' +
          pre.ativas.slice(0, 12).map(function (m) { return '• ' + (m.codigo ? m.codigo + ' ' : '') + (m.titulo || m.id); }).join('\n') + '\n\nReatribua essas demandas antes de tirar o dev.', ok: 'Entendi' });
        return;
      }
      if (!(await confirma('Tirar da lista de devs', '"' + nome + '" sai da lista e da capacidade. As demandas concluídas dele não são afetadas.', 'Tirar'))) return;
      return gravaRaiz(function (base) { return devTirar(base, nome); }, 'Dev removido.');
    },
    'dev-incluir': async function (el) {
      var nome = el ? el.getAttribute('data-cfg-dev') || '' : '';
      if (!nome) {
        var v = await caixa({ titulo: 'Incluir dev', texto: 'Entra na lista de devs: passa a ser atribuível no Planejamento e conta na capacidade.',
          campos: [{ nome: 'nome', rotulo: 'Nome do dev', dica: 'Como aparece nas demandas', obrig: true }], ok: 'Incluir',
          valida: function (x) { var r = devIncluir(D0(), x.nome); return r.ok ? '' : { erro: r.erro, campo: 'nome' }; } },
          function (ov) { var i = ov.querySelector('#axc-nome'); if (raiz.COLABORADORES && i) raiz.COLABORADORES.ligar(i, raiz.AXIS_APP.WORKER, function () { return { token: raiz.AXIS_APP.APP.token }; }); });
        if (!v) return;
        nome = txt(v.nome);
      }
      var g = await gravaRaiz(function (base) { return devIncluir(base, nome); }, 'Dev adicionado.');
      /* A LIMPEZA DO WORKER (`limpaDevs`) mantem na lista quem tem demanda ou
         conta ativa. Nome sem nenhum dos dois sai na propria gravacao — dizer
         isso e melhor que a pessoa achar que incluiu. */
      if (g && g.ok && !((D0().desenvolvedores || []).some(function (d) { return norm(d) === norm(nome); }))) {
        H.toast('O servidor não manteve "' + nome + '" na lista: sem conta ativa e sem demanda, a limpeza da lista o tira. Crie a conta ou atribua uma demanda.', 'erro');
      }
      return g;
    },
    'dev-juntar': async function () {
      var nomes = ((D0().desenvolvedores) || []).slice().sort(function (a, b) { return String(a).localeCompare(String(b), 'pt-BR'); });
      var v = await caixa({ titulo: 'Juntar dois nomes da mesma pessoa',
        texto: 'O nome que sai é trocado pelo que fica em TODAS as demandas — inclusive as concluídas, que é de onde sai o histórico. A marca DEV-AXCred e a frente acompanham.',
        campos: [{ nome: 'de', rotulo: 'Nome a eliminar', dica: 'Escolha da lista', obrig: true }, { nome: 'para', rotulo: 'Nome que fica', dica: 'Escolha da lista', obrig: true }],
        ok: 'Continuar', valida: function (x) {
          if (nomes.indexOf(x.de) < 0) return { erro: '"' + x.de + '" não está na lista de devs.', campo: 'de' };
          if (nomes.indexOf(x.para) < 0) return { erro: '"' + x.para + '" não está na lista de devs.', campo: 'para' };
          var r = devsJuntar(D0(), x.de, x.para);
          return r.ok ? '' : { erro: r.erro, campo: 'para' };
        } }, function (ov) { comLista(ov, 'de', nomes); comLista(ov, 'para', nomes); });
      if (!v) return;
      var pre = devsJuntar(D0(), v.de, v.para);
      var n = Object.keys(pre.patch).length;
      var ok = await confirma('Juntar "' + v.de + '" em "' + v.para + '"', n === 0 ? 'Nenhuma demanda usa "' + v.de + '". Ele sai apenas da lista de devs.'
        : n + ' demanda(s) passam a ser de "' + v.para + '"' + (pre.fechadas > 0 ? ' — ' + pre.abertas + ' aberta(s) e ' + pre.fechadas + ' já concluída(s)/negada(s), que é de onde sai o histórico.' : '.') + ' Não há como desfazer.', 'Juntar');
      if (!ok) return;
      return gravaRaiz(function (base) { return devsJuntar(base, v.de, v.para); }, function (r) { return Object.keys(r.patch).length + ' demanda(s) agora são de "' + v.para + '".'; });
    },

    'link-view': async function () {
      var link = linkVisualizacao(location.origin + location.pathname.replace(/[^\/]*$/, ''), raiz.VIEW_CHAVE || '');
      try { await navigator.clipboard.writeText(link); H.toast('Link de visualização copiado!'); }
      catch (_) { await caixa({ titulo: 'Copie o link', campos: [{ nome: 'link', rotulo: 'Link de visualização', valor: link }], ok: 'Fechar' }); }
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // SPRINT E CALENDARIO
  // ════════════════════════════════════════════════════════════════════════
  // Tipos de ausencia: COPIA de AUSENCIA_TIPOS (gantt.html), com as cores do AXIS.
  var AUS = {
    ferias: { rot: 'Férias', ico: 'calendar', cor: 'tl' }, atestado: { rot: 'Atestado', ico: 'pulse', cor: 'dg' },
    folga: { rot: 'Folga', ico: 'pause', cor: 'in' }, outro: { rot: 'Outro', ico: 'pin', cor: 'pu' }
  };
  var feriadoISO = function (f) { return (f && typeof f === 'object' ? f.data : f) || ''; };

  function secSprint(ctx) {
    var D = ctx.D, S = raiz.SPRINTPO, P = raiz.PIPELINES;
    var fer = D.feriados || [];
    var hoje = H.hoje();
    var atual = H.sprintAtual();
    var faixa = atual ? S.faixaDaSprint(atual, fer) : null;
    var ano = +hoje.slice(0, 4), mes = +hoje.slice(5, 7);
    var doMes = S.sprintsDoMes(ano, mes, fer);
    var prox = S.proximasSprints ? (S.proximasSprints(hoje, 3, fer) || []).filter(function (x) { return !x.agora; }).slice(0, 3) : [];
    // Duracao e pontos sao codigo (sprint.js): nao ha onde editar. O que se
    // edita e a ausencia e o feriado, no Planejamento; o andamento da sprint mora em Sprints.
    var acoes = '<a class="btn" href="#sprints">' + ico('refresh') + ' Ver sprints</a>' +
      (H.pode('editar') ? '<a class="btnp" href="#planejamento/ausencias" title="Abre o cadastro de ausências do Planejamento">Ausências</a>' : '');

    // Capacidade nominal por grupo: a MESMA chamada do Gantt (`renderCapSprint`).
    var grupos = S.capacidadePorTrilha(D, atual, {
      devs: devsAtivos(D),
      frenteDoDev: function (n) { return P ? P.doDev(n, D.devs_perfil) : ''; },
      frenteDados: P ? P.FRENTE_DADOS : '', frenteSales: 'Sales Ops',
      semFrente: P ? P.NAO_CLASSIFICADO : 'Desenvolvimento', etapaDe: H.etapaDe
    });
    var capTot = grupos.reduce(function (t, g) { return t + g.capacidade; }, 0);
    var capLinhas = grupos.map(function (g) {
      var h = '<tr><td style="color:var(--tx);font-weight:700">' + esc(g.nome) + '</td><td class="mono" title="' + esc(g.pessoas.join(', ')) + '">' + g.pessoas.length + '</td>' +
        '<td class="mono">' + g.pessoas.length + ' × ' + S.PONTOS_POR_DEV + ' = <b style="color:var(--tx)">' + g.capacidade + '</b> pts</td></tr>';
      if (g.frentes && g.frentes.length > 1) {
        h += g.frentes.map(function (f) {
          return '<tr><td style="padding-left:24px"><span style="color:var(--tx4)">└ </span>' + esc(f.frente) + '</td><td class="mono" title="' + esc(f.pessoas.join(', ')) + '">' + f.pessoas.length + '</td>' +
            '<td class="mono note">' + f.capacidade + ' pts</td></tr>';
        }).join('');
      }
      return h;
    }).join('');

    var anoFer = fer.map(function (f) { return { data: feriadoISO(f), nome: (f && f.nome) || '' }; })
      .filter(function (f) { return f.data.slice(0, 4) === String(ano) || f.data.slice(0, 4) === String(ano + 1) && f.data.slice(5, 7) === '01'; })
      .sort(function (a, b) { return a.data.localeCompare(b.data); });
    var ferPass = anoFer.filter(function (f) { return f.data < hoje; }).length;
    var ferVem = anoFer.filter(function (f) { return f.data >= hoje; });

    var aus = (D.ausencias || []).slice().sort(function (a, b) { return String(a.inicio || '').localeCompare(String(b.inicio || '')); });
    var ausVem = aus.filter(function (a) { return String(a.fim || a.inicio || '') >= hoje; });
    var ausPass = aus.length - ausVem.length;

    var h = cab('Sprint e calendário', 'O ritmo do time: como a sprint é contada, quanto cabe nela e quem está fora. As regras moram em <span class="mono">sprint.js</span> e valem igual no Gantt, no admin, no painel do dev e no Worker.', acoes);
    h += '<div class="grid" style="grid-template-columns:1fr 1fr;align-items:start">';
    // Sprint
    h += '<section class="pn"><h2 class="h2">Sprint</h2><span class="note">Duração</span>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap"><span class="btns on" style="cursor:default">1 semana útil</span>' +
      '<span class="note" style="font-size:12px">segunda a sexta, sem feriado; fixa no código</span></div>' +
      linha('Sprint atual', atual ? '<b class="mono" title="' + esc(atual) + '">' + esc(S.rotuloCurto(atual)) + '</b>' + (faixa ? '&nbsp;· ' + H.dm(faixa.de) + '–' + H.dm(faixa.ate) : '') : '—') +
      linha('Rótulo', '<span class="mono">S&lt;n&gt;-MM-AAAA</span>') +
      linha('Pontos por dev', '<span class="mono">' + S.PONTOS_POR_DEV + '</span>&nbsp;por sprint') +
      linha('Quem põe na sprint', 'PM/PO (o dev abre no backlog)') +
      linha('Contas à parte', S.TRILHAS.map(function (t) { return esc(t.nome); }).join(' · ')) +
      (prox.length ? '<span class="lab" style="margin-top:6px">PRÓXIMAS SPRINTS</span>' + prox.map(function (x) {
        return '<div class="cfg-lin"><span class="mono" title="' + esc(x.rotulo) + '">' + esc(S.rotuloCurto(x.rotulo)) + '</span><span class="note mono">' +
          H.dm(x.de) + ' a ' + H.dm(x.ate) + ' · ' + H.plural(x.dias, 'dia útil', 'dias úteis') + '</span></div>';
      }).join('') : '') +
      '</section>';
    // Capacidade
    h += '<section class="pn"><div class="row" style="justify-content:space-between"><h2 class="h2">Capacidade nominal</h2><span class="note mono">' + capTot + ' pts</span></div>' +
      '<span class="note">Pessoas ativas da lista de devs × ' + S.PONTOS_POR_DEV + ' pontos, por conta (Desenvolvimento aberto por frente). O alocado de cada sprint está em Sprints.</span>' +
      '<table class="tbl"><thead><tr><th>GRUPO</th><th>PESSOAS</th><th>CAPACIDADE</th></tr></thead><tbody>' + capLinhas + '</tbody></table></section>';
    // Calendario
    h += '<section class="pn"><h2 class="h2">Calendário</h2>' +
      linha('Horário útil', 'seg–sex') + linha('Fuso', '<span class="mono">America/Sao_Paulo</span>') +
      '<span class="lab" style="margin-top:6px">SPRINTS DE ' + esc(H.MESES[mes - 1].toUpperCase()) + '</span>' +
      doMes.map(function (s) {
        var hj = s.rotulo === atual, pass = s.ate < hoje;
        return '<div class="cfg-it' + (hj ? ' hj' : '') + (pass && !hj ? ' pass' : '') + '"><span class="mono" style="width:56px;color:var(--tx)">' + esc(S.rotuloCurto(s.rotulo)) + '</span>' +
          '<span style="flex:1" class="note mono">' + H.dm(s.de) + ' a ' + H.dm(s.ate) + '</span><span class="note">' + H.plural(s.dias, 'dia útil', 'dias úteis') + '</span>' +
          (hj ? H.chip('atual', 'ac') : '') + '</div>';
      }).join('') +
      '<span class="lab" style="margin-top:6px">FERIADOS · ' + ano + '</span>' +
      (ferVem.length ? ferVem.map(function (f) {
        return '<div class="cfg-lin"><span>' + (f.nome ? esc(f.nome) : '<span class="note">sem nome</span>') + '</span><span class="mono note">' + H.dma(f.data) + '</span></div>';
      }).join('') : '<span class="note">Nenhum feriado cadastrado daqui para a frente.</span>') +
      (ferPass ? '<span class="note" style="font-size:12px">' + H.plural(ferPass, 'feriado já passou', 'feriados já passaram') + ' em ' + ano + '.</span>' : '') +
      '<span class="note" style="font-size:12px">Os feriados vêm do cadastro da base e são lidos pelo Gantt, pelo admin e pelo Worker. <a href="#planejamento/feriados">Editar no Planejamento</a>.</span></section>';
    // Ausencias (no lugar do Plantao do prototipo)
    h += '<section class="pn"><div class="row" style="justify-content:space-between"><h2 class="h2">Ausências</h2>' +
      (H.pode('editar') ? '<a class="btns" href="#planejamento/ausencias" title="Abre o cadastro de ausências do Planejamento">Planejamento</a>' : '') + '</div>' +
      '<span class="note">Férias, atestados e folgas. Dia ausente sai da capacidade do mês no Gantt.</span>' +
      (ausVem.length ? ausVem.map(function (a) {
        var t = AUS[a.tipo] || AUS.outro;
        var agora = String(a.inicio || '') <= hoje;
        return '<div class="cfg-it' + (agora ? ' hj' : '') + '">' + H.av(a.dev, 26) +
          '<span style="flex:1;min-width:0;display:flex;flex-direction:column"><b class="ell" style="font-size:13px">' + esc(a.dev) + '</b>' +
          '<span class="note ell" style="font-size:11.5px">' + H.dm(a.inicio) + (a.fim && a.fim !== a.inicio ? ' a ' + H.dm(a.fim) : '') + (a.obs ? ' · ' + esc(a.obs) : '') + '</span></span>' +
          (agora ? H.chip('agora', 'ac') + ' ' : '') + H.chip(ico(t.ico) + ' ' + t.rot, t.cor) + '</div>';
      }).join('') : '<span class="note">Ninguém fora daqui para a frente.</span>') +
      (ausPass ? '<span class="note" style="font-size:12px">' + H.plural(ausPass, 'ausência passada', 'ausências passadas') + ' no histórico do Gantt.</span>' : '') +
      '</section>';
    h += '</div>';
    return h;
  }

  // ════════════════════════════════════════════════════════════════════════
  // APARENCIA — claro/escuro e a cor de acento em uso
  // ════════════════════════════════════════════════════════════════════════
  var TONS = [
    { v: '--ac', n: 'Principal' }, { v: '--ac-l', n: 'Claro' }, { v: '--ac-t', n: 'Texto' },
    { v: '--ac-h', n: 'Hover' }, { v: '--ac-d', n: 'Escuro' }, { v: '--on-ac', n: 'Sobre a cor' }
  ];

  function secAparencia(ctx) {
    var tema = raiz.temaAtual ? raiz.temaAtual() : 'escuro';
    var eu = ctx.eu || {};
    var primeiro = String(eu.nome || eu.login || '').split(/\s+/)[0];
    // Previa com dado real: a sprint atual e um item dela, quando houver.
    var S = raiz.SPRINTPO, atual = H.sprintAtual();
    var naSprint = atual && S ? H.visiveis().filter(function (m) { return S.naSprint(m, atual); }) : [];
    var feitas = naSprint.filter(function (m) { return H.colunaDe(m) === 'concluido'; }).length;
    var pct = naSprint.length ? Math.round(feitas / naSprint.length * 100) : 0;
    var ex = naSprint.filter(function (m) { return H.colunaDe(m) === 'em_andamento'; })[0] || naSprint[0] || H.visiveis()[0];
    var pz = ex ? H.prazoTxt(ex) : null;

    var h = cab('Aparência', 'Tema claro ou escuro e a cor da marca em uso. O AXIS completo será whitelabel (cor, logo e nome por empresa); hoje a marca é uma só e a cor é fixa nos tokens.');
    h += '<div class="grid" style="grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);align-items:start">';
    h += '<div style="display:flex;flex-direction:column;gap:16px;min-width:0">';
    // Tema
    h += '<section class="pn"><h2 class="h2">Tema</h2><div class="row" style="gap:8px">' +
      ['escuro', 'claro'].map(function (t) {
        return '<button type="button" class="btns' + (t === tema ? ' on' : '') + '" data-cfg-tema="' + t + '" aria-pressed="' + (t === tema) + '">' +
          ico(t === 'claro' ? 'sun' : 'moon') + ' ' + (t === 'claro' ? 'Claro' : 'Escuro') + '</button>';
      }).join('') + '</div>' +
      '<span class="note" style="font-size:12px">Vale para este navegador e para todas as telas do RoadMap (o mesmo botão da barra do topo). Escuro é o padrão da marca; padrão por empresa chega com o AXIS completo.</span></section>';
    // Cor
    h += '<section class="pn"><h2 class="h2">Cor principal</h2>' +
      '<div class="row" style="gap:12px"><span style="width:40px;height:40px;border-radius:12px;background:var(--ac);box-shadow:0 0 0 2px var(--bg0,var(--sf)),0 0 0 4px var(--ac)"></span>' +
      '<span class="note">Cor em uso</span><span class="in mono" style="height:34px" data-cfg-cor="--ac">—</span></div>' +
      '<span class="lab" style="margin-top:4px">TONS DERIVADOS · TEMA ' + (tema === 'claro' ? 'CLARO' : 'ESCURO') + '</span>' +
      '<div class="grid" style="grid-template-columns:repeat(6,minmax(0,1fr));gap:8px">' + TONS.map(function (t) {
        return '<div style="display:flex;flex-direction:column;gap:6px;min-width:0"><span class="cfg-ton" style="background:var(' + t.v + ')"></span>' +
          '<b style="font-size:12px">' + esc(t.n) + '</b><span class="mono note" style="font-size:11px" data-cfg-cor="' + t.v + '">—</span></div>';
      }).join('') + '</div>' +
      '<span class="note" style="font-size:12px">As telas usam só os tokens (<span class="mono">--ac</span>, <span class="mono">--ac-t</span>…); trocar a cor da empresa vai ser trocar estes valores. A escolha de cor por empresa chega com o AXIS completo.</span></section>';
    // Identidade em uso
    h += '<section class="pn"><h2 class="h2">Identidade</h2><div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">' +
      '<div style="padding:14px;border-radius:12px;border:1px dashed var(--bd4);display:flex;flex-direction:column;gap:8px;align-items:center;text-align:center">' +
      '<span class="axis-logo" role="img" aria-label="AXIS" style="height:26px"></span><span class="note" style="font-size:11.5px">logo do tema atual</span></div>' +
      '<div style="padding:14px;border-radius:12px;border:1px dashed var(--bd4);display:flex;flex-direction:column;gap:8px;align-items:center;text-align:center">' +
      '<span class="sb-mark" style="width:34px;height:34px;border-radius:10px"><img src="axis/marca/axis-leao-branco.png" alt="" style="width:22px;height:auto;display:block"></span>' +
      '<span class="note" style="font-size:11.5px">ícone do menu</span></div></div>' +
      '<span class="note" style="font-size:12px">Nome do produto, empresa, endereço e logos por empresa ficam em Empresa e marca, que chega com o AXIS completo.</span></section>';
    h += '</div>';
    // Previa
    h += '<section class="pnh" style="gap:14px"><span class="labo">PRÉVIA AO VIVO</span>' +
      '<div style="display:grid;grid-template-columns:150px minmax(0,1fr);border-radius:14px;overflow:hidden;border:1px solid var(--bd2)">' +
      '<div style="background:var(--side);padding:14px 10px;display:flex;flex-direction:column;gap:4px;font-size:12px">' +
      '<span style="font-family:Montserrat,sans-serif;font-weight:800;font-size:15px;padding:0 6px 10px">AX<span style="color:var(--ac)">IS</span></span>' +
      '<span style="padding:7px 8px;border-radius:8px;background:rgba(var(--ac-rgb),.18);color:var(--tx-hi,var(--tx));font-weight:700">Início</span>' +
      '<span style="padding:7px 8px;color:var(--tx3)">Quadro</span><span style="padding:7px 8px;color:var(--tx3)">Backlog</span></div>' +
      '<div style="padding:16px;display:flex;flex-direction:column;gap:12px;background:var(--bg-top);min-width:0">' +
      '<b style="font-family:Montserrat,sans-serif;font-size:17px">' + esc(H.saudacao(new Date().getHours())) + (primeiro ? ', ' + esc(primeiro) : '') + '</b>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap">' + (ex ? H.chip(esc(ex.codigo || ''), 'ac') + ' ' + H.chipEtapa(ex) : '') +
      (pz && pz.txt !== '—' ? ' <span class="note" style="color:' + pz.cor + '">' + esc(pz.txt) + '</span>' : '') + '</div>' +
      '<div class="bar" title="' + feitas + ' de ' + naSprint.length + ' concluídas na sprint atual"><span style="width:' + pct + '%;background:linear-gradient(90deg,var(--ac),var(--ac-t))"></span></div>' +
      '<span class="note" style="font-size:11.5px">' + (atual ? esc(S.rotuloCurto(atual)) + ' · ' : '') + feitas + ' de ' + naSprint.length + ' concluídas</span>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap"><span class="btnp" style="height:34px">Ação principal</span><span class="btn" style="height:34px">Secundária</span></div>' +
      '<a href="#configuracoes/aparencia" style="font-size:13px">Um link</a></div></div>' +
      info('A prévia usa os mesmos tokens das telas: trocar o tema aqui muda o app inteiro na hora. Nada de cor fica escrito no código das telas.') +
      '</section>';
    h += '</div>';
    return h;
  }

  function pintarTons(el) {
    var cs = getComputedStyle(document.documentElement);
    [].forEach.call(el.querySelectorAll('[data-cfg-cor]'), function (s) {
      var v = cs.getPropertyValue(s.getAttribute('data-cfg-cor')).trim();
      s.textContent = v ? v.toUpperCase() : '—';
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // SECOES QUE CHEGAM COM O AXIS COMPLETO
  // ════════════════════════════════════════════════════════════════════════
  /* Cada uma diz o que o prototipo promete e o que o RoadMap faz HOJE no
     lugar — em vez de uma tela vazia ou de numero inventado. */
  function secFutura(id, ctx) {
    var F = {
      marca: { t: 'Empresa e marca', sub: 'O AXIS será whitelabel: cada empresa com a sua cor, o seu logo, o seu nome e o seu endereço.',
        hoje: 'O RoadMap tem uma marca só (AXIS, laranja). Tema claro/escuro e a cor em uso estão em <a href="#configuracoes/aparencia">Aparência</a>.' },
      modulos: { t: 'Módulos', sub: 'Cada empresa liga só o que usa; desligar um módulo esconde o menu, as telas e os avisos dele.',
        hoje: 'Todas as telas estão ligadas para todos. O que muda o menu é o perfil (admin, dev, consulta).' },
      fluxos: { t: 'Fluxos e etapas', sub: 'Etapas, colunas do quadro, quem move e o que cada passagem exige, por empresa.',
        hoje: 'As etapas são fixas no código (<span class="mono">etapa-demanda.js</span>), as mesmas em todas as telas:', etapas: true },
      sla: { t: 'Prioridade e SLA', sub: 'Matriz impacto × urgência e prazos de resposta e solução por prioridade.',
        hoje: 'O RoadMap não tem SLA nem chamado. A prioridade é um campo da demanda e entra na ordem do quadro; o prazo é a data de entrega.' },
      api: { t: 'API e integrações', sub: 'Chaves por sistema, com escopo e expiração.',
        hoje: 'Há um endpoint único (o Worker), com sessão por login. Chaves por sistema e documentação OpenAPI chegam com o AXIS completo.' },
      widget: { t: 'Widget', sub: 'Abrir demanda de dentro de outro sistema.',
        hoje: 'Não existe no RoadMap. Hoje a demanda nasce no admin, no painel do dev ou pelo formulário de abertura.' },
      auditoria: { t: 'Auditoria', sub: 'Quem mudou o quê nas configurações, com o valor anterior.',
        hoje: 'Cada demanda guarda o próprio histórico (aba Histórico do item) e a base guarda os commits. Auditoria de configurações chega com o AXIS completo.' }
    }[id];
    if (!F) return H.vazio('info', 'Seção não encontrada', '');
    var h = cab(F.t, esc(F.sub), H.chip(ico('lock') + ' chega com o AXIS completo', 'bk'));
    h += '<section class="pn"><span class="lab">HOJE NO ROADMAP</span><span style="font-size:13.5px;line-height:21px;color:var(--tx2)">' + F.hoje + '</span>';
    if (F.etapas) {
      h += '<div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">' + H.ETAPAS.map(function (e, i) {
        var n = H.visiveis().filter(function (m) { return H.colunaDe(m) === e.id; }).length;
        return '<div class="cfg-it"><span class="mono note" style="width:22px">' + (i + 1) + '</span><span class="cfg-dot" style="background:' + e.dot + ';border-radius:5px;width:10px;height:10px"></span>' +
          '<b style="flex:1;font-size:13.5px">' + esc(e.rotulo) + '</b><span class="note mono">' + H.plural(n, 'demanda', 'demandas') + '</span></div>';
      }).join('') + '</div>';
    }
    h += '</section>';
    return h;
  }

  var _ocupado = false;
  function roda(fn, alvo) {
    if (_ocupado) return;
    _ocupado = true;
    alvo.disabled = true;
    Promise.resolve().then(function () { return fn(alvo); })
      .catch(function (ex) { console.error(ex); H.toast('Não foi possível: ' + (ex.message || ex), 'erro'); })
      .then(function () { _ocupado = false; if (alvo.isConnected) alvo.disabled = false; });
  }

  // ── Registro ────────────────────────────────────────────────────────────
  raiz.AXIS_APP.tela({
    id: 'configuracoes',
    rotulo: 'Configurações',
    papeis: ['admin'],
    abas: ABAS,
    // A regua horizontal do nucleo some: a navegacao desta tela e a vertical.
    abasDe: function () { return []; },
    titulo: function (r) {
      var i = TODAS.filter(function (x) { return x.id === r.aba; })[0];
      return 'Configurações' + (i ? ' · ' + i.rotulo : '');
    },
    render: function (el, ctx) {
      css();
      var aba = ctx.aba || 'catalogo';
      var corpo = aba === 'catalogo' ? secCatalogo(ctx)
        : aba === 'pessoas' ? secPessoas(ctx)
        : aba === 'sprint' ? secSprint(ctx)
        : aba === 'aparencia' ? secAparencia(ctx)
        : secFutura(aba, ctx);
      return '<div class="cfg">' + nav(aba) + '<div class="view" style="min-width:0">' + corpo + '</div></div>';
    },
    depois: function (el, ctx) {
      var aba = ctx.aba || 'catalogo';
      if (aba === 'pessoas') carregarContas(false);
      if (aba === 'aparencia') pintarTons(el);

      // Buscas: so a lista redesenha, o campo fica com o foco. Por delegacao,
      // porque a secao do catalogo e redesenhada inteira ao escolher sistema.
      el.addEventListener('input', function (e) {
        if (e.target.id === 'cfg-cat-q') {
          est.catBusca = e.target.value;
          var tb = el.querySelector('#cfg-cat-linhas');
          if (tb) tb.innerHTML = linhasTemas(dadosCatalogo(ctx.D));
        } else if (e.target.id === 'cfg-pes-q') {
          est.pesBusca = e.target.value;
          pintarPessoas(ctx.D);
        }
      });

      el.addEventListener('click', function (e) {
        var s = e.target.closest('[data-cfg-sis]');
        if (s) {
          var k = s.getAttribute('data-cfg-sis');
          est.catSis = est.catSis === k ? '' : k;
          // Sem `desenhar()`: ele volta a pagina ao topo, e quem clicou no
          // cartao quer ver a tabela logo abaixo.
          var vw = el.querySelector('.cfg > .view');
          if (vw) vw.innerHTML = secCatalogo(ctx);
          return;
        }
        var f = e.target.closest('[data-cfg-pes-f]');
        if (f) {
          est.pesFiltro = f.getAttribute('data-cfg-pes-f');
          pintarPessoas(ctx.D);
          return;
        }
        var p = e.target.closest('[data-cfg-pes]');
        if (p) {
          est.pesSel = p.getAttribute('data-cfg-pes');
          pintarPessoas(ctx.D);
          return;
        }
        var t = e.target.closest('[data-cfg-tema]');
        if (t) {
          var quer = t.getAttribute('data-cfg-tema');
          if (raiz.temaAtual && raiz.temaAlternar && raiz.temaAtual() !== quer) raiz.temaAlternar();
          raiz.AXIS_APP.desenhar();
          return;
        }
        // Os gestos que gravam: um por vez, com o botao desligado ate a resposta.
        var ac = e.target.closest('[data-cfg-acao]');
        if (ac && ac.tagName !== 'SELECT') {
          var fn = CFG_ACOES[ac.getAttribute('data-cfg-acao')];
          if (fn) roda(fn, ac);
        }
      });
      el.addEventListener('change', function (e) {
        if (e.target.id === 'cfg-u-nomedem') roda(CFG_ACOES['u-nomedem'], e.target);
        else if (e.target.id === 'cfg-frente') roda(CFG_ACOES['perfil-frente'], e.target);
      });
      el.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var p = e.target.closest && e.target.closest('[data-cfg-pes]');
        if (!p) return;
        e.preventDefault();
        est.pesSel = p.getAttribute('data-cfg-pes');
        pintarPessoas(ctx.D);
        var box = el.querySelector('#cfg-pes');
        var de = box && box.querySelector('[data-cfg-pes="' + (raiz.CSS && CSS.escape ? CSS.escape(est.pesSel) : est.pesSel) + '"]');
        if (de) de.focus();
      });
    }
  });
})();
