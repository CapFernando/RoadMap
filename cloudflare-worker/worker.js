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
  // Trocar senha exige a senha atual: sem limite, o campo viraria oraculo para
  // adivinhar a senha de quem deixou a sessao aberta.
  'senha-alterar':     { max: 10, janela: 300 },
  // Recuperacao e liberada automaticamente pelo e-mail: sem limite, da para varrer
  // a lista de enderecos da empresa e redefinir senha de quem estiver na lista.
  'senha-recuperar':   { max: 5,  janela: 900 },
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
// Janela para redefinir depois de pedir. Curta de proposito: e o unico limite de
// tempo entre o pedido e a senha nova. Cinco minutos dao folga para escolher uma
// senha decente sem deixar a porta aberta.
const RESET_MIN = 5;
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
// O NOME DAS DEMANDAS, derivado do e-mail corporativo.
//
// `joao.lucas@audaxcapitalsa.com.br` vira "Joao Lucas". O e-mail e a fonte certa
// porque e a unica coisa do cadastro que a empresa padroniza: o nome digitado
// vem como a pessoa quis escrever naquele dia, com ou sem sobrenome, com ou sem
// acento.
//
// So as DUAS primeiras partes. `maria.silva.santos` vira "Maria Silva": nome e
// sobrenome e o formato que o campo `dev` das demandas usa, e o terceiro pedaco
// so alonga o rotulo em toda tela onde ele aparece.
//
// A capitalizacao respeita o acento do que a pessoa digitou quando da: se o nome
// do cadastro contem a mesma palavra, vale a versao dele — assim "joao" vira
// "João" em vez de "Joao".
function nomeDemandasDoEmail(email, nomeDigitado) {
  const partes = String(email || '').split('@')[0]
    .split(/[._-]+/).filter(Boolean).slice(0, 2);
  if (!partes.length) return '';
  const semAcento = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const doNome = String(nomeDigitado || '').split(/\s+/).filter(Boolean);
  return partes.map(p => {
    const igual = doNome.find(x => semAcento(x) === semAcento(p));
    if (igual) return igual.charAt(0).toUpperCase() + igual.slice(1);
    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  }).join(' ');
}

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
/* ── MES DE COMPROMISSO ────────────────────────────────────────────────────
   Ver o comentario grande no topo do bloco de datas: o mes e periodo, nao etapa.
   Aqui vive a trilha, e ela e a UNICA verdade sobre em que mes a demanda esta.  */

// Etapas a partir das quais a demanda esta comprometida com um mes. Antes de
// `planejado` ela ainda esta sendo entendida, e carimbar mes ali encheria o
// fechamento de trabalho que ninguem prometeu.
// Concluida e negada NAO entram no carimbo automatico. Elas ja terminaram: dar
// mes a elas agora encheria julho e junho de "compromisso" que ninguem assumiu —
// 84 demandas, na conta que fiz antes de decidir isso — e o fechamento desses
// meses viraria ficcao retroativa. Quem quiser alocar uma concluida faz no card,
// a mao, e ai e decisao de alguem.
//
// Consequencia assumida: o cumprimento so passa a valer de agora em diante. O mes
// corrente comeca sem "comprometido no inicio", porque de fato nao houve.
const MES_ETAPAS = ['planejado', 'em_andamento', 'validacao'];

function mesValido(v) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(v || ''));
}

// Le a trilha do jeito que ela estiver: registro antigo nao tem nenhuma, e
// registro vindo de tela desatualizada pode trazer lixo.
function mesTrilha(m) {
  const t = (m && Array.isArray(m.meses)) ? m.meses : [];
  return t.filter(x => x && mesValido(x.mes))
    .map(x => ({ mes: String(x.mes), em: /^\d{4}-\d{2}-\d{2}$/.test(String(x.em || ''))
                                        ? String(x.em) : String(x.mes) + '-01' }));
}

function mesAtual(m) {
  const t = mesTrilha(m);
  return t.length ? t[t.length - 1].mes : '';
}

// Soma meses sem objeto Date: mesma razao de todas as contas de data aqui — o
// fuso muda o dia e ja custou off-by-one nesta base.
function mesSoma(iso, n) {
  const a = parseInt(String(iso).slice(0, 4), 10);
  const b = parseInt(String(iso).slice(5, 7), 10);
  const t = (a * 12 + (b - 1)) + n;
  return String(Math.floor(t / 12)) + '-' + String((t % 12) + 1).padStart(2, '0');
}

// Carimba e mantem a trilha. Roda em TODA gravacao, e o servidor e o unico lugar
// onde ela e escrita: a tela manda a intencao (`mes_alvo`), aqui virou historia.
//
// Nunca reescreve o passado — so acrescenta. Uma demanda que rolou de julho para
// agosto guarda os dois, e e isso que permite responder "o que julho prometeu e
// nao entregou" depois de julho ter acabado.
// `aceitaPedido` diz se o `mes_alvo` que veio no corpo vale. Do painel dev NAO
// vale: aquela tela nao tem campo de mes, entao o que ela manda e eco do que ela
// carregou — possivelmente antes de alguem trocar o mes aqui. Um eco desses
// reescreveria a decisao de quem coordena, e ainda por cima acrescentaria uma
// rolagem falsa na trilha. O carimbo AUTOMATICO continua valendo dos dois lados:
// dev que move o card para Planejado deve mesmo carimbar o mes.
function carimbaMeses(recebido, servidor, aceitaPedido) {
  if (!recebido || !Array.isArray(recebido.melhorias)) return [];
  const antes = new Map((((servidor || {}).melhorias) || []).map(m => [m.id, m]));
  const hoje = hojeBR();
  const mudou = [];
  for (const m of recebido.melhorias) {
    if (!m || !m.id) continue;
    const guardada = mesTrilha(antes.get(m.id) || {});
    const atualGuardado = guardada.length ? guardada[guardada.length - 1].mes : '';

    // A tela pede um mes por `mes_alvo`. Vazio = nao pediu nada (nao e "apague").
    // Apagar exige `mes_alvo === null`, explicito, para um clique perdido em 200
    // demandas nao limpar a trilha de todas.
    let pedido = (aceitaPedido !== false && mesValido(m.mes_alvo)) ? String(m.mes_alvo) : '';
    if (aceitaPedido !== false && m.mes_alvo === null) {
      m.meses = [];
      m.mes_alvo = '';
      if (atualGuardado) mudou.push({ id: m.id, codigo: m.codigo || '', de: atualGuardado, para: '' });
      continue;
    }

    // Carimbo automatico: entrou em Planejado ou adiante e nao tem mes nenhum.
    // O mes vem da data de entrega quando ela existe — e a promessa que ja foi
    // feita — e do mes corrente quando nao existe.
    if (!pedido && !guardada.length && MES_ETAPAS.includes(String(m.status_planejamento || ''))) {
      const pelaEntrega = String(m.entrega || '').slice(0, 7);
      pedido = mesValido(pelaEntrega) ? pelaEntrega : hoje.slice(0, 7);
    }

    if (!pedido) {
      m.meses = guardada;
      m.mes_alvo = atualGuardado;
      continue;
    }
    if (pedido === atualGuardado) {
      m.meses = guardada;
      m.mes_alvo = atualGuardado;
      continue;
    }

    // `em` = quando o compromisso foi assumido. Para mes FUTURO vale o dia 1
    // dele: alocar em 20/08 uma demanda para setembro e compromisso do mes
    // inteiro de setembro, e nao "entrou no meio de setembro".
    const em = pedido > hoje.slice(0, 7) ? pedido + '-01' : hoje;
    m.meses = guardada.concat([{ mes: pedido, em }]);
    m.mes_alvo = pedido;
    mudou.push({ id: m.id, codigo: m.codigo || '', de: atualGuardado, para: pedido });
  }
  return mudou;
}

const HIST_CAMPOS = {
  status_planejamento: 'etapa',
  implementacao:       'o que foi implementado',
  horas_realizadas:    'horas',
  entrega:             'entrega',
  inicio:              'inicio',
  dev:                 'responsavel',
  poker_pontos:        'pontos',
  // O mes entra no historico porque rolar demanda de mes e a decisao que o
  // fechamento cobra depois. Sem registro, "essa ja rolou tres vezes" nao tem
  // como ser dito.
  mes_alvo:            'mes',
  projeto_id:          'projeto',
  titulo:              'titulo',
  pausado_em:          'pausa',
  concluido_em:        'data de conclusao',
  // Referencia ao codigo entra no historico: "quando esta demanda passou a
  // apontar para o PR 712" e pergunta de auditoria, e trocar o link de uma
  // entrega ja validada e exatamente o que ninguem deveria fazer em silencio.
  link_issue:          'issue',
  link_pr:             'PR',
  link_milestone:      'milestone',
  // A DEPENDENCIA ENTRA NO HISTORICO, e faltava. Ha seis demandas com
  // `parent_id` na base e NENHUM registro de quando cada vinculo foi criado —
  // "esta demanda ficou travada esperando qual outra, e desde quando" nao tinha
  // resposta. E justamente a pergunta que se faz ao auditar um atraso: o vinculo
  // aparecia no card e o dia dele, em nenhum lugar.
  parent_id:           'dependencia',
  is_dependency:       'e dependencia de outra',
};
// Guarda por demanda. Sem teto, um card antigo acumularia centenas de entradas e
// o arquivo (164 KB hoje) cresceria sem controle — ele e lido inteiro em toda
// abertura de tela.
const HIST_MAX = 25;

// ─── MENSAGERIA ──────────────────────────────────────────────────────────
// As mensagens escritas a mao sobre a demanda. Ficam AO LADO do historico, e nao
// dentro dele: o historico e o que o sistema observou (campo tal mudou de X para
// Y), e a mensagem e o que uma pessoa quis dizer. Misturar os dois faria a
// auditoria nao distinguir fato registrado de comentario.
//
// Teto maior que o do historico porque aqui as entradas SAO o recurso — cortar em
// 25 apagaria a conversa que a tela existe para guardar. O arquivo e lido inteiro
// em toda abertura de tela (164 KB hoje), entao o teto existe: sem ele, uma
// demanda antiga com discussao longa passa a pesar em TODAS as telas.
const MSG_MAX = 200;
const MSG_TAM = 4000;
const HIST_TEXTO = 180;   // texto longo entra cortado; o tamanho fica registrado

function histValor(v) {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v.length + ' item(ns)';
  const t = String(v);
  return t.length > HIST_TEXTO ? t.slice(0, HIST_TEXTO) + '…' : t;
}

// Compara o que chegou com o que esta gravado e anexa as diferencas. `quem` sai
// da conta autenticada; sem conta, fica o papel, que ja diz de onde veio.
// Nomes que aparecem no campo `dev` das demandas, com e sem filtro de etapa.
function devsDasDemandas(data, soAbertas) {
  const fora = new Set();
  for (const m of (data.melhorias || [])) {
    if (!m || m.oculto || m.mesclado_em) continue;
    if (soAbertas && ['concluido', 'negada'].includes(String(m.status_planejamento || ''))) continue;
    String(m.dev || '').split(/[\/,]/).forEach(n => {
      const t = n.trim();
      if (t) fora.add(t);
    });
  }
  return fora;
}

// Chave que existe no arquivo e NAO veio no envio nao e apagada.
//
// Cada tela monta o que envia a partir de uma lista fixa de campos. Quem nao esta
// nessa lista chega ausente aqui — e o arquivo e gravado com o objeto recebido,
// entao "ausente" virava "apagado". Nao foi hipotese: `devs_removidos` tinha seis
// nomes e virou lista vazia na primeira publicacao de uma tela que nao carregava
// essa chave.
//
// A regra e ausencia, e nao lista de nomes: valor vazio ENVIADO continua valendo
// (esvaziar de proposito tem de funcionar), e chave criada amanha por outra tela
// fica protegida sem ninguem precisar voltar aqui.
function preservaChaves(data, antes) {
  if (!data || typeof data !== 'object' || !antes || typeof antes !== 'object') return [];
  const voltaram = [];
  for (const k of Object.keys(antes)) {
    if (k.charAt(0) === '_') continue;          // espelho: limpaEspelhos cuida
    if (data[k] === undefined) { data[k] = antes[k]; voltaram.push(k); }
  }
  return voltaram;
}


// Limpa a lista de devs e os vinculos obsoletos. Roda em TODA gravacao, porque o
// problema aparece justamente quando uma aba antiga publica: a mesclagem de devs
// e uniao, entao a lista velha volta inteira e passa a conviver com a nova.
//
// Corrigir a mao nao resolveria — a proxima aba antiga traz tudo de novo — e pedir
// para todos recarregarem a tela e uma explicacao que ninguem deveria dar.
async function limpaDevs(env, data) {
  if (!data || !Array.isArray(data.desenvolvedores)) return [];
  if (!Array.isArray(data.devs_removidos)) data.devs_removidos = [];
  const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();

  const emDemanda = devsDasDemandas(data, false);
  const emAberto = devsDasDemandas(data, true);
  const temDemanda = n => [...emDemanda].some(x => norm(x) === norm(n));
  const temAberta = n => [...emAberto].some(x => norm(x) === norm(n));

  // As contas dizem quem EXISTE; as demandas dizem quem esta trabalhando.
  const canonicos = new Set();
  const declaradosVivos = new Set();
  if (env.POKER_DB) {
    try {
      await contasMigrar(env.POKER_DB);
      const r = await env.POKER_DB.prepare(
        'SELECT id, nome, email, nome_demandas FROM usuario WHERE ativo = 1 AND pendente = 0').all();
      for (const u of (r.results || [])) {
        const can = nomeDemandasDoEmail(u.email, u.nome);
        if (can) canonicos.add(norm(can));
        // Declarado so continua valendo enquanto casar com alguma demanda. E o
        // caso do "Leite". Quando para de casar, o campo e obsoleto: apaga, e a
        // conta volta a valer pelo e-mail sem ninguem precisar mexer.
        //
        // MAS: declarado IGUAL ao derivado do e-mail nao e obsoleto — e a mesma
        // coisa dita duas vezes. Apagar ali seria desfazer uma escolha deliberada
        // e fazer a tela mostrar "— pelo nome da conta —" logo depois de a pessoa
        // ter digitado o nome, parecendo que nao salvou. E o caso de quem
        // coordena: "Fernando Nascimento" nao casa com demanda nenhuma porque ele
        // nao desenvolve, e nem por isso a escolha dele esta errada.
        const decl = String(u.nome_demandas || '').split(/[\/,;]/).map(x => x.trim()).filter(Boolean);
        const uteis = decl.filter(temDemanda);
        uteis.forEach(x => declaradosVivos.add(norm(x)));
        const igualAoDerivado = can && decl.length === 1 && norm(decl[0]) === norm(can);
        if (decl.length && !uteis.length && !igualAoDerivado) {
          try {
            await env.POKER_DB.prepare('UPDATE usuario SET nome_demandas = NULL WHERE id = ?')
              .bind(u.id).run();
          } catch (_) {}
        }
      }
    } catch (_) { /* sem banco, so a regra das demandas vale */ }
  }

  // QUEM SAIU DO TIME e uma DECISAO, e nao um estado dedutivel dos dados. Cairo e
  // Marina tambem so tem trabalho concluido, e continuam no time; Joao Carvalho
  // saiu. Nada no arquivo distingue os dois casos — so a decisao de quem coordena.
  //
  // Por isso ela fica gravada em `devs_removidos`, e nao inferida. Um nome
  // removido volta sozinho se receber demanda ABERTA: a decisao vale enquanto
  // ninguem contrariar na pratica.
  const removidos = new Set((data.devs_removidos || []).map(norm));
  const fica = n => (temDemanda(n) || canonicos.has(norm(n)) || declaradosVivos.has(norm(n))) &&
                    (!removidos.has(norm(n)) || temAberta(n));
  const antes = data.desenvolvedores.slice();
  data.desenvolvedores = antes.filter(fica);
  return antes.filter(n => !fica(n));
}


// Chaves de espelho: dados que uma tela guardou em memoria e mandou de volta sem
// querer. Nenhuma pertence ao arquivo de demandas.
//
// A guarda e no servidor de proposito. Corrigir so a tela nao resolve: aba aberta
// desde ontem continua mandando o espelho antigo, e uma unica publicacao dessas
// devolve a tabela de contas para dentro do arquivo. Aqui e o unico ponto por onde
// toda gravacao passa.
//
// A regra e o prefixo `_`, e nao uma lista de nomes: o proximo espelho vai ter
// outro nome, e ninguem vai lembrar de vir ate aqui.
function limpaEspelhos(data) {
  if (!data || typeof data !== 'object') return [];
  const fora = Object.keys(data).filter(k => k.charAt(0) === '_');
  fora.forEach(k => { delete data[k]; });
  return fora;
}

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

// Volta do `status` para a etapa, escolhendo sempre a MENOS AVANCADA quando duas
// etapas compartilham o mesmo status. Sentido unico: assim o preenchimento nunca
// inventa progresso — no maximo subestima, e quem olha o quadro corrige.
//
// Foi o cuidado que faltou na vez em que adivinhar deixou duas negadas
// invisiveis: ali o chute promovia a demanda para um estado que ela nao tinha.
// `negada` e `concluida` sao mao unica de verdade (uma etapa cada), entao nao ha
// o que escolher.
const STATUS_PARA_SP = {
  recebida: 'backlog',       // ou levantar_req — backlog e o menos avancado
  estimada: 'planning',      // ou planejado
  iniciada: 'em_andamento',  // ou validacao
  concluida: 'concluido',
  negada: 'negada',
};

// Alinha `status` a etapa em todas as demandas do payload. Devolve quantas ajustou.
//
// E preenche a ETAPA VAZIA. Duas demandas na base estavam com
// `status_planejamento` em branco (AX-127 e AX-211): elas nao entram em coluna
// nenhuma do Kanban, escapam de toda regra ancorada na etapa — inclusive a que
// exige responsavel e a que carimba o mes — e nao aparecem em relatorio por
// etapa. Ficar invisivel e pior que ficar na coluna errada: na coluna errada
// alguem ve e move.
/* Etapas em que a demanda JA FOI ALOCADA a alguem — e daqui em diante que o ponto
   conta como planejado. Backlog e Planning nao: ali ainda se discute se a demanda
   entra, e contar como plano infla o compromisso com o que pode nem ser feito.
   A mesma lista vive em capacidade.js, para as telas; aqui ela e repetida porque o
   Worker nao carrega os scripts do site, e nao por escolha. */
/* O PISO DE PONTUACAO. Demanda alocada sem tamanho nao entra em nenhuma conta de
   planejado x entregue, e era assim que 904 pontos ficaram invisiveis. Tres e a
   carta que o time usa para o que sai em ate duas horas. */
const PONTOS_PADRAO = 3;

const ETAPAS_ALOCADA = ['planejado', 'em_andamento', 'validacao', 'concluido'];

function normalizaEstados(data) {
  if (!data || !Array.isArray(data.melhorias)) return 0;
  let n = 0;
  for (const m of data.melhorias) {
    if (!m) continue;
    let sp = String(m.status_planejamento || '').trim();
    if (!sp) {
      const deduzida = STATUS_PARA_SP[String(m.status || '').trim()];
      if (deduzida) { m.status_planejamento = deduzida; sp = deduzida; n += 1; }
    }
    /* TODA CONCLUSAO TEM DATA DE ENTREGA DO DEV.

       O prazo do dev termina quando ele entrega. Quem passa pela validacao ganha
       `entregue_em` no caminho; quem e concluido DIRETO de "em andamento" nao
       ganhava nada, e a conta caia em `concluido_em` por deducao.

       O numero era o mesmo — o furo era outro: essa demanda, se fosse reaberta e
       mandada para validacao depois, receberia `entregue_em` com a data DAQUELE
       dia, e o atraso do dev pioraria retroativamente por causa de um passo do
       PM/PO. Gravando aqui, no servidor, a primeira entrega fica registrada
       qualquer que seja a tela ou a rota que concluiu.

       `concluido_em` e a melhor informacao que existe nesse caso: a conclusao E o
       fim do trabalho de quem fez. */
    if (sp === 'concluido' && !String(m.entregue_em || '').trim()) {
      const ce = String(m.concluido_em || '').slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(ce)) { m.entregue_em = ce; n += 1; }
    }

    /* OS PONTOS PROMETIDOS FICAM CONGELADOS NA ALOCACAO.

       A REPONTUACAO ACONTECE: na base, AX-088 foi de 34 para 55, AX-180 de 55
       para 34 e AX-200 de 2 para 8, todas pelo painel. Ler `poker_pontos` no
       fechamento do mes faria a repontuacao REESCREVER O PASSADO — voce prometeu
       34 ao dev, corrigiu para 55 depois de ver o tamanho real, e o relatorio
       passaria a dizer que voce havia prometido 55 desde o inicio. O cruzamento
       planejado x entregue deixaria de medir compromisso e passaria a medir a
       ultima edicao.

       CARIMBADO AQUI, NO SERVIDOR, e nao na tela: a demanda entra em Planejado
       pelo Gantt, pelo admin e pela API, e a terceira tela e sempre a que
       esquece. Mesmo motivo do `entregue_em` acima.

       PONTUACAO RETROATIVA NAO ENTRA. As 77 demandas pontuadas depois de
       concluidas (`poker_retroativo`) nunca tiveram plano: carimba-las faria o
       planejado do mes passado aparecer perfeito por construcao — o mesmo
       defeito que a conclusao retroativa causava no prazo.

       E O CAMPO SO NASCE UMA VEZ. `!m.pontos_planejados` e a trava: sem ela, cada
       gravacao reescreveria o carimbo com o tamanho corrente, e o congelamento
       nao existiria. */
    /* DEMANDA QUE CHEGA A PLANEJADO SEM PONTO RECEBE 3.

       Decisao do PM/PO, depois de uma varredura que pontuou 52 demandas alocadas
       sem pontuacao — 904 pontos que estavam invisiveis no cruzamento planejado x
       entregue. O buraco nao era de calculo: era de cadastro, e se repetia toda
       semana. O padrao fecha o buraco na hora em que ele se abre.

       TRES, PORQUE E O PISO DO BARALHO PARA TRABALHO REAL. E a carta que o time
       usa para o que sai em ate duas horas — a mediana das 29 demandas nessa faixa.

       SO A PARTIR DE PLANEJADO. Backlog, levantar_req e planning ficam de fora de
       proposito: e na reuniao de Planning que o tamanho e decidido, e carimbar 3
       antes dela tiraria da mesa justamente o que ela existe para fazer. Ideia que
       nao foi planejada nao precisa de tamanho.

       O VALOR NAO SE FIXA. `poker_pontos` continua editavel: a reuniao pode dizer
       13, e o carimbo de `pontos_planejados` logo abaixo congela o que estiver
       valendo quando a demanda for alocada. O padrao preenche um vazio, nao decide
       nada.

       O QUE ISSO CUSTA, dito por escrito porque nao esta em lugar nenhum na base:
       gravado sem marca, um 3 do padrao fica indistinguivel de um 3 que o time
       votou. A varredura acima usou a distincao entre "o time disse" e "ninguem
       disse" para calibrar as escadas; a proxima nao vai ter como. Foi decisao
       consciente do PM/PO (opcao "3 fixo", contra a alternativa de marcar e pedir
       confirmacao no Planning), e a alternativa segue barata de fazer: um campo
       `poker_padrao` aqui e um sinal na tela. */
    /* DEMANDA APOSENTADA NAO RECEBE NADA. `oculto` e `mesclado_em` sao as duas
       formas de retirar uma demanda de circulacao, e todo o resto da ferramenta
       (`prazo.js`, `capacidade.js`, cada tela) as ignora pelo mesmo par. A AX-270,
       criada por engano num teste de API e ocultada, ganharia 3 pontos aqui — sem
       efeito em relatorio nenhum, porque ela ja esta fora de todos, mas carimbar o
       que foi aposentado e como a base junta lixo que ninguem sabe explicar depois. */
    if (ETAPAS_ALOCADA.includes(sp) && !(Number(m.poker_pontos) > 0) &&
        !m.oculto && !m.mesclado_em) {
      m.poker_pontos = PONTOS_PADRAO;
      n += 1;
    }
    if (ETAPAS_ALOCADA.includes(sp) && !m.poker_retroativo &&
        !(Number(m.pontos_planejados) > 0)) {
      const pt = Number(m.poker_pontos);
      if (Number.isFinite(pt) && pt > 0) { m.pontos_planejados = pt; n += 1; }
    }
    const esperado = SP_PARA_STATUS[sp];
    if (!esperado) continue;
    if (m.status !== esperado) { m.status = esperado; n += 1; }
  }
  return n;
}


// ─── ATRASO, DERIVADO NO SERVIDOR ─────────────────────────────────────
// A API entregava `aguardando_validacao` e `concluida` como derivados, mas nada
// sobre prazo — e prazo vencido invisivel e o que faz a demanda morrer sem
// ninguem cobrar. Hoje sao 15 ativas vencidas na base.
//
// Regra: tem data de entrega, a data ja passou, a etapa nao e concluido nem
// negada, e a demanda NAO esta pausada. Pausada nao atrasa: o prazo esta suspenso
// por dependencia externa, e contar como atraso faria o vermelho perder o sentido
// para as que dependem do time — e a mesma regra que as telas ja aplicam.
//
// O FUSO importa aqui, e e o tipo de detalhe que passa despercebido: o Worker roda
// em UTC e o Brasil e UTC-3. Usando a data do servidor, das 21h a meia-noite
// "hoje" ja seria amanha, e uma demanda que vence HOJE apareceria vencida tres
// horas antes de o dia acabar para quem esta olhando a tela.
function hojeBR() {
  try {
    // en-CA da o formato AAAA-MM-DD, que compara como string sem converter nada.
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  } catch (_) {
    // Runtime sem base de fusos: aproxima subtraindo 3h do UTC. Pior que o Intl,
    // melhor que errar o dia inteiro.
    return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  }
}

// Comparacao por STRING ISO, nunca por objeto Date: `new Date('2026-08-06')` e
// meia-noite UTC, e converter para local muda o dia. Ja custou off-by-one aqui.
//
// O ATRASO E DO DEV, E PARA QUANDO ELE ENTREGA. Em validacao a demanda esta na mao
// do PM/PO, e o tempo que ela passa ali nao e atraso de desenvolvimento — a API
// contava contra HOJE e o numero crescia todo dia para quem ja tinha entregado.
// A mesma regra que as telas aplicam (ver prazo.js); aqui ela e repetida porque o
// Worker nao carrega os scripts do site, e nao por escolha.
const dia = t => {
  const [a, b, c] = String(t).split('-').map(Number);
  return Date.UTC(a, b - 1, c);
};

/* O PRAZO QUE VALE — o combinado, esticado pelos dias em que a demanda esteve
   parada por algo fora do alcance de quem faz.

   ISTO EXISTE PORQUE A EXTENSAO DEPENDIA DE UM CLIQUE. As telas empurram a
   `entrega` quando alguem clica "Retomar", e so ali: uma demanda pausada e
   concluida SEM esse clique nunca tinha a data empurrada, e os dias parados eram
   cobrados como atraso. Medido na base, nas seis pausadas com prazo: AX-199
   apareceria com 9 dias de atraso, sendo os 9 de pausa; AX-163 com 10, sendo 9.

   `pausa_dias` NAO entra: os dias ja retomados JA ESTAO dentro da `entrega`
   (quem retoma empurra a data e acumula os dias na mesma acao), e somar de novo
   daria o dobro de folga. O que falta e a pausa que ainda esta correndo.

   A mesma regra que as telas aplicam (ver prazo.js); aqui ela e repetida porque o
   Worker nao carrega os scripts do site, e nao por escolha. */
function prazoEfetivo(m, ref) {
  const pz = String((m && m.entrega) || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pz)) return '';
  const p = String((m && m.pausado_em) || '').slice(0, 10);
  const r = String(ref || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p) || !/^\d{4}-\d{2}-\d{2}$/.test(r) || r <= p) return pz;
  const extra = Math.round((dia(r) - dia(p)) / 86400000);
  const d = new Date(dia(pz));
  d.setUTCDate(d.getUTCDate() + extra);
  return d.toISOString().slice(0, 10);
}

// Comparacao por STRING ISO, nunca por objeto Date: `new Date('2026-08-06')` e
// meia-noite UTC, e converter para local muda o dia. Ja custou off-by-one aqui.
//
// O ATRASO E DO DEV, E PARA QUANDO ELE ENTREGA. Em validacao a demanda esta na mao
// do PM/PO, e o tempo que ela passa ali nao e atraso de desenvolvimento — a API
// contava contra HOJE e o numero crescia todo dia para quem ja tinha entregado.
function diasDeAtraso(m, hoje) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String((m && m.entrega) || '').slice(0, 10))) return 0;
  const etapa = String((m && m.status_planejamento) || '');
  if (etapa === 'concluido' || etapa === 'negada') return 0;
  if (String((m && m.pausado_em) || '').trim()) return 0;
  // Depois de entregue, a referencia e a data da ENTREGA, e nao o dia de hoje:
  // e o que faz o atraso de quem entregou tarde congelar em vez de crescer.
  const entregue = String((m && m.entregue_em) || '').slice(0, 10);
  const ref = (etapa === 'validacao' && /^\d{4}-\d{2}-\d{2}$/.test(entregue))
    ? entregue : hoje;
  // O prazo EFETIVO: o combinado mais os dias parados ate `ref`.
  const entrega = prazoEfetivo(m, ref);
  if (!entrega || entrega >= ref) return 0;
  return Math.round((dia(ref) - dia(entrega)) / 86400000);
}


// ─── CUSTO OBRIGATORIO PARA CONCLUIR ──────────────────────────────────
// A hora realizada e a UNICA medida de custo que a base tem: nao ha apontamento,
// nao ha planilha ao lado. Sem ela o relatorio do comite mostra entrega sem preco,
// e a conta de quanto custou o trimestre nao fecha.
//
// A entrega do dev (`demanda-entregar` e o painel) ja exigia horas. O furo estava
// do outro lado: quem CONCLUI e o PM/PO, e nenhum caminho dele cobrava nada.
//
// Trava na TRANSICAO, nao no estado: quem ja esta concluido com zero hora segue
// gravavel. Travar por estado engessaria a base historica e faria qualquer save do
// admin falhar por causa de um registro de junho.
// ─── DATA COMPROMETIDA E DO PM/PO ─────────────────────────────────────
// A partir de Planejado a data virou compromisso: ela esta no gantt, na contagem
// de atrasadas e na conversa com a area. Deixar o dev mover isso pelo painel
// desfaz o planejamento sem ninguem ver.
//
// A API ja recusava prazo (a lista de campos aceitos em `demanda-atualizar` e
// fechada). O furo era o `dev-publish`, que recebe o estado inteiro montado no
// navegador e grava o que recebe. Mesmo desenho ja usado para projeto: a versao do
// SERVIDOR sempre vence.
//
// Demanda que ainda nao existe no servidor, ou que esta em backlog / levantar_req
// / planning, segue editavel: ali nada foi prometido, e e onde o dev de fato
// precisa registrar uma previsao.
const ETAPAS_DATA_TRAVADA = ['planejado', 'em_andamento', 'validacao', 'concluido'];

function travaDatasComprometidas(recebido, servidor) {
  if (!recebido || !Array.isArray(recebido.melhorias)) return [];
  const antes = new Map();
  for (const m of (servidor && servidor.melhorias) || []) if (m && m.id) antes.set(m.id, m);
  const revertidas = [];
  for (const m of recebido.melhorias) {
    if (!m || !m.id) continue;
    const velha = antes.get(m.id);
    if (!velha) continue;
    if (!ETAPAS_DATA_TRAVADA.includes(String(velha.status_planejamento || ''))) continue;
    for (const campo of ['entrega', 'inicio']) {
      const nova = String(m[campo] || '');
      const orig = String(velha[campo] || '');
      if (nova !== orig) {
        m[campo] = velha[campo];
        revertidas.push((m.codigo || m.id) + '.' + campo);
      }
    }
  }
  return revertidas;
}

// ─── A ETAPA QUE O DEV PODE MOVER ─────────────────────────────────────
// O painel do dev tem tres acoes de fluxo: comecar (Em Andamento), entregar para
// validacao do PM/PO, e pausar. Pausar nao e etapa — sao campos (`pausado_em`,
// `pausa_dias`) —, entao sobram DOIS destinos de etapa para o dev.
//
// O que existia era uma lista de opcoes na tela e nada aqui. Murillo levou a
// AX-150 de `levantar_req` para `planning`, de `planning` para `planejado` e de
// `planejado` de volta para `planning` — tres movimentos que sao do planejamento,
// nao do desenvolvimento. Quem decide se uma demanda vai para a mesa de Planning
// e quem conduz a reuniao; um card que reaparece na fila do Planning sozinho muda
// a pauta de terca sem ninguem ter decidido isso.
//
// A TELA NAO PODE SER A UNICA TRAVA — foi um caminho de tela (o arraste no Kanban)
// que deixou a AX-179 chegar em Validacao sem horas. Aqui a regra vale para
// qualquer corpo que chegue nesta rota.
//
// REVERTE, NAO RECUSA — mesmo desenho da trava de datas. O `dev-publish` recebe o
// estado inteiro montado no navegador, e o dev costuma estar salvando OUTRA coisa
// (horas, texto da entrega, anexo). Derrubar a gravacao toda por causa de um campo
// que ele talvez nem tenha tocado perderia o trabalho dele por um erro que nao e
// dele. A etapa volta ao valor do servidor e o resto segue.
//
// VALE SO PARA O PAPEL `dev`. `analista` e `admin` tambem entram por esta rota
// (`ehDev` aceita os tres) e para eles mover para Planning e trabalho legitimo —
// o analista faz descoberta, e o admin e a autoridade que decide.
const ETAPAS_QUE_O_DEV_MOVE = ['em_andamento', 'validacao'];

function travaEtapaDoDev(recebido, servidor) {
  if (!recebido || !Array.isArray(recebido.melhorias)) return [];
  const antes = new Map();
  for (const m of (servidor && servidor.melhorias) || []) if (m && m.id) antes.set(m.id, m);
  const revertidas = [];
  for (const m of recebido.melhorias) {
    if (!m || !m.id) continue;
    const velha = antes.get(m.id);
    // Demanda que o servidor nao conhece e cadastro novo — nao ha transicao para
    // policiar, e o dev abre demanda pelo painel.
    if (!velha) continue;
    const nova = String(m.status_planejamento || '');
    const orig = String(velha.status_planejamento || '');
    if (nova === orig) continue;
    if (ETAPAS_QUE_O_DEV_MOVE.includes(nova)) continue;
    m.status_planejamento = velha.status_planejamento;
    // O `status` acompanha a etapa: deixar um sem o outro cria demanda "concluida"
    // em Planejado, e todo relatorio que cruza os dois passa a discordar de si.
    if (velha.status !== undefined) m.status = velha.status;
    revertidas.push((m.codigo || m.id) + ': ' + (orig || '(vazio)') + ' -> ' + (nova || '(vazio)'));
  }
  return revertidas;
}

// ─── ENTREGAR EXIGE HORAS E TEXTO ─────────────────────────────────────
// Colocar em Validacao e dizer "acabei, valide". Sem horas e sem o texto do que
// foi feito, o PM/PO nao tem o que validar e o relatorio do comite sai vazio.
//
// A tela ja pede as duas coisas, mas a tela nao pode ser a unica trava: foi
// exatamente um caminho de tela — o arraste no Kanban, que testava 'concluido' e
// esqueceu 'validacao' — que deixou a AX-179 chegar em Validacao com zero hora e
// sem texto. Qualquer outro caminho futuro repetiria o furo em silencio.
//
// Vale so para o `dev-publish`. O PM/PO mover um card para Validacao pelo Admin
// e decisao dele, e ele e quem cobra o resto.
function entrandoEmValidacaoSemEntrega(recebido, servidor) {
  if (!recebido || !Array.isArray(recebido.melhorias)) return [];
  const antes = new Map();
  for (const m of (servidor && servidor.melhorias) || []) if (m && m.id) antes.set(m.id, m);
  const presos = [];
  for (const m of recebido.melhorias) {
    if (!m || String(m.status_planejamento || '') !== 'validacao') continue;
    const velha = antes.get(m.id);
    if (!velha) continue;                                        // demanda nova
    if (String(velha.status_planejamento || '') === 'validacao') continue;  // ja estava
    const h = Number(m.horas_realizadas);
    const t = String(m.implementacao || '').trim();
    if (!Number.isFinite(h) || h <= 0 || !t) presos.push(m.codigo || m.id);
  }
  return presos;
}

function faltaHoras(m) {
  const h = Number(m && m.horas_realizadas);
  return !Number.isFinite(h) || h <= 0;
}

// Devolve os codigos que estao ENTRANDO em concluido sem hora nenhuma.
function entrandoEmConcluidoSemHoras(recebido, servidor) {
  if (!recebido || !Array.isArray(recebido.melhorias)) return [];
  const antes = new Map();
  for (const m of (servidor && servidor.melhorias) || []) if (m && m.id) antes.set(m.id, m);
  const presos = [];
  for (const m of recebido.melhorias) {
    if (!m || String(m.status_planejamento || '') !== 'concluido') continue;
    const velha = antes.get(m.id);
    // Demanda que o servidor nao conhece e import de historico ou cadastro do
    // proprio PM/PO — a autoridade que decide. Nao e o furo do fluxo.
    if (!velha) continue;
    if (String(velha.status_planejamento || '') === 'concluido') continue;  // ja estava
    if (faltaHoras(m)) presos.push(m.codigo || m.id);
  }
  return presos;
}


/* SISTEMA E OBRIGATORIO A PARTIR DE PLANEJADO.
 *
 * A AX-290 ficou viva sem tema e aparecia como "Sem sistema" no grafico do painel —
 * uma fatia que nao responde a pergunta que o grafico faz. E o efeito nao para na
 * tela: demanda sem sistema cai fora do filtro por sistema, do corte por assunto do
 * deck, do agrupamento dos Relatorios e da conta de "para onde a capacidade foi".
 * Ela existe em todo lugar como uma sobra sem nome.
 *
 * SO A PARTIR DE PLANEJADO, como o piso de pontuacao: em backlog e levantar_req a
 * ideia ainda esta sendo entendida, e exigir o sistema ali barraria o registro de
 * uma demanda que acabou de chegar. Do compromisso em diante, ela precisa dizer de
 * que sistema e.
 *
 * RECUSA, e nao carimba um padrao. Nao ha sistema padrao defensavel: escolher um
 * colocaria informacao errada onde nao havia nenhuma, e informacao errada e pior
 * que ausente porque ninguem a procura depois. Mesmo desenho de
 * `entrandoEmConcluidoSemDev`.
 */
function entrandoAlocadaSemSistema(recebido, servidor) {
  if (!recebido || !Array.isArray(recebido.melhorias)) return [];
  const temas = new Set(((recebido.temas) || []).map(t => t && t.id).filter(Boolean));
  const antes = new Map();
  for (const m of (servidor && servidor.melhorias) || []) if (m && m.id) antes.set(m.id, m);
  const presos = [];
  for (const m of recebido.melhorias) {
    if (!m || m.oculto || m.mesclado_em) continue;
    if (!ETAPAS_ALOCADA.includes(String(m.status_planejamento || ''))) continue;
    if (m.tema_id && temas.has(m.tema_id)) continue;
    const velha = antes.get(m.id);
    /* JA ESTAVA ASSIM: nao barra. Travar por ESTADO faria toda gravacao falhar por
       causa de um registro antigo, e a pessoa que so queria salvar um texto ficaria
       presa a um problema que nao criou. A trava e na TRANSICAO — mesmo criterio das
       horas e do responsavel. */
    if (velha && ETAPAS_ALOCADA.includes(String(velha.status_planejamento || '')) &&
        !(velha.tema_id && temas.has(velha.tema_id))) continue;
    presos.push(m.codigo || m.id);
  }
  return presos;
}

/** A ASSINATURA DE UM TITULO — como duas demandas se reconhecem iguais.
 *
 *  Existe porque nada, em camada nenhuma, impedia criar duas demandas identicas.
 *  Em 25/08 a AX-324 e a AX-325 nasceram com 91 segundos de diferenca, mesmo
 *  titulo, mesma dev e a MESMA descricao de 848 caracteres byte a byte. As duas
 *  gravaram, as duas deram "Salvo!", e a primeira ficou orfa ate ser apagada a
 *  mao — e apagar nao deixa rastro, entao o caso so foi reconstituivel pelos
 *  commits do repositorio de dados.
 *
 *  So o TITULO entra. Medido nas 324 demandas da base: comparar por titulo,
 *  ignorando dev e descricao, colide exatamente UMA vez — no par que se quer
 *  barrar. Zero falso positivo em toda a historia. Uma regra que exigisse
 *  tambem a descricao deixaria passar a duplicata que ninguem descreveu.
 *
 *  ESTE CORPO E COPIADO NO WORKER, e uma invariante exige que os dois sejam
 *  identicos. A tela avisa antes; o Worker recusa. Se as duas normalizacoes
 *  divergirem, a tela liberaria o que o servidor barra — e a pessoa levaria um
 *  erro que a tela dizia nao existir. */
function tituloAssinatura(t) {
  return String(t == null ? '' : t)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** DUAS DEMANDAS VIVAS COM O MESMO TITULO — recusa.
 *
 *  Trava na CRIACAO, e nao no estado: so olha melhoria que o servidor ainda nao
 *  conhece. Mesmo criterio das outras cinco guardas — travar por estado faria
 *  toda gravacao falhar por causa de um registro antigo, e quem so queria salvar
 *  um texto ficaria preso a um problema que nao criou.
 *
 *  Compara contra as VIVAS: negada, oculta e mesclada nao contam. Reaproveitar o
 *  titulo de uma demanda negada e legitimo — a ideia voltou.
 *
 *  Confere tambem as novas ENTRE SI, no mesmo envio: duas iguais que nunca
 *  chegaram ao servidor nao teriam com que colidir sem isso.
 */
/* PROCURA A MESMA COISA NO REPOSITORIO DE CODIGO.
 *
 * A busca da plataforma cobria o Roadmap e mais nada, e o vinculo entre os dois
 * mundos quase nao e feito: das 98 issues abertas no AXCRED-DJANGO, 97 nao tem
 * demanda correspondente — oito delas de seguranca. Um dev consulta, recebe
 * "pode criar", e cria uma demanda sobre algo que ja esta descrito numa issue.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * "NAO ACHEI" E "NAO CONSEGUI OLHAR" SAO RESPOSTAS DIFERENTES.
 *
 * Esta e a regra que da o formato a funcao. O repositorio de codigo tem OUTRO
 * dono (`audaxcapitalsa`) que o dos dados (`CapFernando`), e nao ha garantia de
 * que o token do Worker alcance os dois. Devolver `[]` quando a chamada falha
 * faria o dev criar a duplicata acreditando que a busca foi completa — pior do
 * que nao ter busca nenhuma, porque da confianca falsa.
 *
 * Entao: ou `consultado: true` com a lista, ou `consultado: false` com o motivo.
 * Nunca uma lista vazia significando as duas coisas.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Busca no TITULO (`in:title`), aberta E fechada: issue fechada e trabalho que
 * ja foi feito, e saber disso vale tanto quanto saber do que esta em aberto — e
 * a mesma pergunta que `validada` responde do lado do Roadmap.
 */
async function procuraNoGit(env, palavras) {
  const repo = String((env && env.CODE_REPO) || '').trim();
  if (!repo) {
    return { consultado: false, motivo: 'repositorio_nao_configurado',
             detalhe: 'Defina CODE_REPO (ex.: "dono/repo") para a busca alcancar o codigo.' };
  }
  if (!palavras || !palavras.length) {
    return { consultado: false, motivo: 'termo_sem_palavras',
             detalhe: 'O termo nao tem palavra especifica o bastante para procurar no codigo.' };
  }
  /* DUAS PALAVRAS, E NAO SEIS. O GitHub trata os termos como E: exigir seis
     palavras no titulo casou 1 de 7 nos testes contra o repositorio real; duas
     casaram 6 de 7.

     E sao DUAS TENTATIVAS porque as duas escolhas erram em casos diferentes. As
     duas PRIMEIRAS palavras perdem a #1087 — o titulo do dev comeca em "expansao
     societaria" e a issue fala "rastreamento" e "autenticacao". As duas MAIORES
     acham essa e perdem as que dependem de palavra curta e especifica, como
     "serasa" ou "grupo". A segunda so roda quando a primeira volta vazia, entao
     na pratica a maioria das buscas custa uma chamada. */
  const maiores = palavras.slice()
    .sort((a, b) => b.length - a.length || palavras.indexOf(a) - palavras.indexOf(b));
  const tentativas = [
    { nome: 'primeiras', termos: palavras.slice(0, 2) },
    { nome: 'mais-longas', termos: maiores.slice(0, 2) },
  ].filter((t, i, todas) => t.termos.length &&
    // A segunda so vale a pena se for diferente da primeira.
    (i === 0 || t.termos.join(' ') !== todas[0].termos.join(' ')));

  try {
    let j = null, usada = '';
    for (const t of tentativas) {
      const q = t.termos.join(' ') + ' in:title repo:' + repo + ' is:issue';
      const r = await fetch('https://api.github.com/search/issues?per_page=8&q=' +
                            encodeURIComponent(q), {
        headers: { Authorization: 'token ' + env.GH_TOKEN,
                   Accept: 'application/vnd.github.v3+json',
                   'User-Agent': 'audax-roadmap-worker' },
      });
      if (!r.ok) {
        // 403 aqui e quase sempre teto de busca do GitHub (30/min) ou token sem
        // alcance no repositorio — os dois merecem aparecer, e nao virar lista vazia.
        return { consultado: false, motivo: 'http_' + r.status, repositorio: repo,
                 detalhe: r.status === 403
                   ? 'Sem permissao no repositorio, ou limite de busca do GitHub atingido.'
                   : 'O GitHub respondeu ' + r.status + ' para a busca.' };
      }
      j = await r.json();
      usada = t.termos.join(' ');
      if ((j.items || []).length) break;
    }
    return {
      consultado: true,
      repositorio: repo,
      // Por quais palavras a busca foi feita. Sem isso, "total: 0" nao distingue
      // "nao existe" de "procurei pelas palavras erradas" — e o dev nao tem como
      // decidir se refina o termo ou se pode criar.
      procurado_por: usada,
      total: (j && j.total_count) || 0,
      issues: ((j && j.items) || []).map(i => ({
        numero: i.number,
        titulo: i.title || '',
        estado: i.state || '',
        resolvida: i.state === 'closed',
        url: i.html_url || '',
        rotulos: (i.labels || []).map(l => (typeof l === 'string' ? l : l.name)).filter(Boolean),
      })),
    };
  } catch (e) {
    return { consultado: false, motivo: 'falha_rede', repositorio: repo,
             detalhe: String((e && e.message) || e).slice(0, 160) };
  }
}

function criandoTituloRepetido(recebido, servidor) {
  if (!recebido || !Array.isArray(recebido.melhorias)) return [];
  const viva = m => m && !m.oculto && !m.mesclado_em &&
                    String(m.status_planejamento || '') !== 'negada';
  const conhecidos = new Set();
  const porTitulo = new Map();
  for (const m of (servidor && servidor.melhorias) || []) {
    if (!m || !m.id) continue;
    conhecidos.add(m.id);
    if (!viva(m)) continue;
    const k = tituloAssinatura(m.titulo);
    if (k && !porTitulo.has(k)) porTitulo.set(k, m.codigo || m.id);
  }
  const presos = [];
  for (const m of recebido.melhorias) {
    if (!m || !m.id || conhecidos.has(m.id)) continue;   // so o que e NOVO
    if (!viva(m)) continue;
    const k = tituloAssinatura(m.titulo);
    if (!k) continue;
    const dono = porTitulo.get(k);
    if (dono) presos.push({ titulo: String(m.titulo || '').slice(0, 70), existente: dono });
    else porTitulo.set(k, m.codigo || '(a mesma gravacao)');
  }
  return presos;
}

// Entrar em CONCLUIDO sem responsavel. `corrigeSemDev` cobre planejado,
// em_andamento e validacao rebaixando para backlog — mas concluido nao pode ser
// rebaixado: a demanda foi entregue, e devolver ela para o backlog seria apagar
// a entrega para consertar um campo. Entao aqui a saida e a mesma das horas:
// recusar a transicao, e deixar quem esta na tela preencher.
//
// Sem esta guarda sobra o que sobrou na base: AX-079, concluida sem dev desde a
// carga inicial, invisivel em todo relatorio por pessoa.
function entrandoEmConcluidoSemDev(recebido, servidor) {
  if (!recebido || !Array.isArray(recebido.melhorias)) return [];
  const antes = new Map();
  for (const m of (servidor && servidor.melhorias) || []) if (m && m.id) antes.set(m.id, m);
  const presos = [];
  for (const m of recebido.melhorias) {
    if (!m || String(m.status_planejamento || '') !== 'concluido') continue;
    const velha = antes.get(m.id);
    // Igual a guarda das horas: registro que o servidor nao conhece e import ou
    // cadastro do proprio PM/PO, e nao o furo do fluxo.
    if (!velha) continue;
    if (String(velha.status_planejamento || '') === 'concluido') continue;
    if (!String(m.dev || '').trim()) presos.push(m.codigo || m.id);
  }
  return presos;
}


// ─── REFERENCIA AO GITHUB ──────────────────────────────────────────────
// Antes havia UM campo `link_externo` para "o link da demanda", e ele estava
// preenchido em ZERO das 201 demandas. Duas razoes: um slot para tres coisas
// diferentes nao serve para nenhuma, e — a parte que faltava notar — ele nunca
// existiu em tela alguma; so a API o aceitava.
//
// Agora sao tres, e cada um sabe o que e. E o que permite ir do card para o
// codigo e voltar. `link_externo` continua aceito e devolvido, para nao quebrar
// automacao que ja o use.
const LINKS_GH = ['link_issue', 'link_pr', 'link_milestone'];

// Aceita o NUMERO SOLO, mas SO com o repositorio informado em `link_repo`. Quem
// automatiza tem o numero vindo do proprio GitHub, e exigir a URL montada seria
// trabalho de string do lado errado — mas expandir com um repositorio padrao era
// pior: existem axcaixa, PDF_CADASTRO, Workos_ia e outros, e um "683" de axcaixa
// virava link de axcred, gravado e clicavel apontando para o lugar errado.
// Reportado no mesmo dia em que subiu. Erro silencioso e o pior tipo.
//
// `link_pr` aceita varios separados por espaco: demanda quebrada em dois PRs e
// rotina, e sem isso o segundo iria para a observacao.
const GH_CAMINHO = { link_issue: 'issues', link_pr: 'pull', link_milestone: 'milestone' };
// owner/repo, ou vazio. Recusa qualquer coisa que nao tenha essa forma: aceitar
// texto livre aqui montaria URL invalida com cara de valida.
function ghRepoValido(t) {
  const s = String(t || '').trim().replace(/^\/+|\/+$/g, '');
  return /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(s) ? s : '';
}

function linkGhNormaliza(campo, valor, repo) {
  const r = ghRepoValido(repo);
  const um = (v) => {
    const t = String(v || '').trim();
    if (!t) return '';
    if (/^https?:\/\//i.test(t)) return t;
    const n = t.replace(/^#/, '').trim();
    // Sem repositorio o numero fica como esta e a validacao recusa. Expandir com
    // um padrao e exatamente o defeito que isto corrige.
    if (/^\d+$/.test(n) && r) {
      return 'https://github.com/' + r + '/' + GH_CAMINHO[campo] + '/' + n;
    }
    return t;
  };
  const bruto = String(valor || '').trim();
  if (!bruto) return '';
  if (campo !== 'link_pr') return um(bruto);
  return bruto.split(/[\s,;]+/).filter(Boolean).map(um).join(' ');
}

// Devolve o texto do erro, ou '' se esta valido.
function linkGhErro(campo, valor, repo) {
  const v = linkGhNormaliza(campo, valor, repo);
  if (!v) return '';
  const partes = campo === 'link_pr' ? v.split(/\s+/).filter(Boolean) : [v];
  for (const u of partes) {
    if (!/^https?:\/\//i.test(u)) {
      if (/^#?\d+$/.test(u)) {
        return 'Para usar so o numero em ' + campo + ', informe tambem "link_repo" ' +
               '(ex.: "audaxcapitalsa/axcaixa"). Ou mande o endereco completo.';
      }
      return 'Em ' + campo + ', use o numero (com "link_repo") ou o endereco completo ' +
             'comecando com http.';
    }
  }
  return '';
}

// Aplica os tres sobre a demanda. Devolve o texto do erro (e nao aplica nada) ou
// null. Uma funcao para as duas rotas: a validacao de `link_externo` estava
// escrita duas vezes e ja divergia — uma checava vazio antes, a outra nao.
function aplicaLinksGh(m, body, mudou) {
  // Valida TODOS antes de aplicar QUALQUER um. Numa passada so, um corpo com
  // issue valida e PR invalido deixava a issue gravada no objeto e devolvia erro:
  // hoje a rota descarta o objeto e nao ha dano, mas e armadilha pronta para
  // quem reusar esta funcao antes de um save.
  // `link_repo` NAO e gravado na demanda: o repositorio ja esta dentro da URL, e
  // guardar de novo criaria duas fontes que podem discordar.
  const repo = body.link_repo;
  if (typeof body.link_repo === 'string' && body.link_repo.trim() && !ghRepoValido(repo)) {
    return { campo: 'link_repo',
             detail: 'Use a forma "organizacao/repositorio", ex.: "audaxcapitalsa/axcaixa".' };
  }
  for (const campo of LINKS_GH) {
    if (typeof body[campo] !== 'string') continue;
    const err = linkGhErro(campo, body[campo], repo);
    if (err) return { campo, detail: err };
  }
  for (const campo of LINKS_GH) {
    if (typeof body[campo] !== 'string') continue;
    m[campo] = limpaTexto(linkGhNormaliza(campo, body[campo], repo), 600);
    if (mudou) mudou.push(campo);
  }
  return null;
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
  // Nome que a pessoa usa NAS DEMANDAS. O campo `dev` da demanda e texto livre
  // ("Gabriel"), o nome da conta e completo ("Gabriel Rodrigues"), e casar por
  // heuristica deixava 7 das 9 contas sem reconhecer nenhuma demanda. Aceita mais
  // de um nome separado por `/` ou `,`: a mesma pessoa aparece grafada de formas
  // diferentes em bases que ninguem padronizou.
  await colunaSeFaltar(db, 'usuario', 'nome_demandas', 'TEXT');
  // Redefinicoes de senha feitas pela propria pessoa. A linha NAO e apagada
  // depois de usada: ela e a trilha que torna o abuso visivel, e sem trilha a
  // liberacao automatica seria invisivel por definicao.
  await db.prepare(`CREATE TABLE IF NOT EXISTS senha_reset (
    token TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, expira_em TEXT NOT NULL,
    criado_em TEXT NOT NULL, ip TEXT, usado_em TEXT)`).run();
  // Data da ultima redefinicao propria, para o proximo login avisar a pessoa.
  await colunaSeFaltar(db, 'usuario', 'reset_em', 'TEXT');
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
        `SELECT s.expira_em, u.id, u.login, u.nome, u.email, u.papel, u.ativo,
                u.nome_demandas, u.ultimo_acesso
           FROM sessao s JOIN usuario u ON u.id = s.usuario_id
          WHERE s.token = ?`).bind(String(body.token)).first();
      if (r && r.ativo && new Date(r.expira_em) > new Date()) {
        // "Ultimo acesso" era gravado SO no login. A sessao vale 12h e a aba fica
        // aberta o dia inteiro: quem entrou de manha e trabalhou ate a noite
        // aparecia com o horario da manha, e quem deixou a aba aberta de ontem
        // aparecia como se nao tivesse voltado. A coluna media login, e nao uso.
        //
        // Agora qualquer chamada autenticada atualiza — no maximo uma vez a cada
        // 10 minutos, senao seria uma gravacao no banco por requisicao, incluindo
        // o polling de cada tela aberta.
        const agoraMs = Date.now();
        const antesMs = r.ultimo_acesso ? Date.parse(r.ultimo_acesso) : 0;
        if (!antesMs || agoraMs - antesMs > 10 * 60 * 1000) {
          try {
            await db.prepare('UPDATE usuario SET ultimo_acesso = ? WHERE id = ?')
              .bind(new Date(agoraMs).toISOString(), r.id).run();
          } catch (_) {}
        }
        return { papel: r.papel, usuario: { id: r.id, login: r.login, nome: r.nome,
                                           email: r.email || '',
                                           nome_demandas: r.nome_demandas || '' } };
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

// Quantos dias UTEIS existem entre duas datas, contando as duas pontas. Feriado
// cadastrado nao conta. Datas em texto ISO e aritmetica em UTC: `new Date(iso)` no
// fuso local puxa o dia para tras em -03 e uma entrega no mesmo dia viraria zero.
/** AS DATAS DOS FERIADOS, venha a colecao como for.
 *
 *  A colecao tem duas formas vivas: o Gantt gravava string crua e o Admin
 *  normaliza para `{ data }` e republica assim. `new Set(data.feriados)` so casa
 *  com a primeira — entao no dia em que um feriado fosse cadastrado, o Worker
 *  pararia de enxerga-lo sem erro nenhum, e `diasUteis` contaria Natal como dia
 *  util. Aceitar as duas custa uma linha e fecha a divergencia. */
function feriadosISO(data) {
  return ((data && data.feriados) || [])
    .map(f => (f && typeof f === 'object' ? f.data : f))
    .filter(Boolean);
}

function diasUteis(de, ate, feriados) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(de || '')) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(ate || ''))) return null;
  if (ate < de) return null;
  let n = 0;
  let t = Date.parse(de + 'T00:00:00Z');
  const fim = Date.parse(ate + 'T00:00:00Z');
  // Trava de sanidade: data digitada errada (2206 no lugar de 2026) nao pode
  // virar um laco de 60 mil voltas a cada leitura da fila.
  if (!isFinite(t) || !isFinite(fim) || fim - t > 400 * 86400000) return null;
  while (t <= fim) {
    const dia = new Date(t);
    const iso = dia.toISOString().slice(0, 10);
    const s = dia.getUTCDay();
    if (s !== 0 && s !== 6 && !feriados.has(iso)) n++;
    t += 86400000;
  }
  return n;
}

// REFERENCIA DA CARTA: quanto cada carta custou de PRAZO no historico.
//
// Prazo, e nao horas, porque foi o que os dados sustentaram: pontos x dias uteis
// deu correlacao 0,89 em 109 entregas, contra 0,48 de pontos x horas — e metade
// das horas registradas e "1" ou "2", numero redondo digitado no fim. A escada dos
// dias ainda se repete entre devs diferentes, o que a torna referencia e nao media
// curiosa.
//
// Roda na mesma leitura que ja monta a fila: nenhuma chamada nova, e o numero se
// refaz sozinho a cada rodada. Nao existe tabela para alguem manter.
/* ─── RANKING DE ENTREGAS DA SEMANA ──────────────────────────────────────

   Serve a uma conversa de Planning: quem entregou o que na semana que passou e
   na que esta correndo. Aparece na sala porque e la que o time inteiro esta
   junto — num relatorio enviado depois, ninguem pergunta nada a ninguem.

   A DATA DA ENTREGA E A DO DEV, e nao a da conclusao da esteira: `entregue_em`
   primeiro, `concluido_em` como reserva. E a mesma regra do atraso (ver
   prazo.js) — o momento em que o dev tirou a demanda da mao dele. Contar pela
   conclusao jogaria para a semana seguinte tudo que ficou parado em validacao,
   e o dev responderia por uma espera que nao e dele.

   FUSO DE SAO PAULO, EXPLICITO. `entregue_em` e gravado com `toISOString()`, que
   e UTC: uma entrega numa sexta as 21h vira sabado em UTC e cairia na semana
   seguinte. Numa tela de cobranca isso e um erro que a pessoa nao tem como
   contestar — ela entregou na sexta. O Brasil nao tem mais horario de verao
   desde 2019, entao -3h fixo esta certo.

   PONTOS JUNTO DA CONTAGEM. Contar demandas sozinho pune quem pegou a grande:
   tres ajustes de meia hora viram "3" e uma entrega de 13 pontos vira "1". Os
   dois numeros saem lado a lado para a conversa comecar inteira.               */
const FUSO_BR_MS = 3 * 3600 * 1000;

// A data local (Sao Paulo) de um carimbo qualquer: aceita "2026-08-19" e
// "2026-08-19T02:00:00Z", e devolve sempre "AAAA-MM-DD".
function diaLocalBR(carimbo) {
  const t = String(carimbo || '').trim();
  if (!t) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;    // data pura ja e local
  const d = new Date(t);
  if (isNaN(d.getTime())) return '';
  return new Date(d.getTime() - FUSO_BR_MS).toISOString().slice(0, 10);
}

// A segunda-feira da semana de uma data. Segunda a domingo, que e como o time
// fala de semana — "o que voce entregou nesta semana" comeca na segunda.
function segundaDaSemana(diaISO) {
  const [a, b, c] = String(diaISO).split('-').map(Number);
  const d = new Date(Date.UTC(a, b - 1, c));
  const dow = d.getUTCDay();                       // 0 = domingo
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return d.toISOString().slice(0, 10);
}

function somaDias(diaISO, n) {
  const [a, b, c] = String(diaISO).split('-').map(Number);
  const d = new Date(Date.UTC(a, b - 1, c));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* O NOME QUE VAI NA DEMANDA.

   A conta tem o nome civil ("Joao Vitor Batista de Siqueira") e a base tem o
   nome pelo qual o time chama a pessoa ("Joao Siqueira"). A leitura ja
   conciliava os dois — `nome_demandas` existe para isso e `meuDono` aceita
   varios —, mas a ESCRITA carimbava o nome da conta: toda demanda aberta pelo
   painel nascia com um nome que nenhuma outra tela usava, e a pessoa aparecia
   duas vezes em relatorio, em grafico e no ranking do Planning.

   O primeiro nome declarado e o canonico: `nome_demandas` aceita varios porque a
   base tem grafias antigas para conciliar na leitura, mas escrever exige
   escolher um. Sem declaracao nenhuma, o nome da conta segue valendo — que e o
   que sempre valeu.                                                            */
function nomeNaDemanda(ident) {
  const u = (ident && ident.usuario) || {};
  const declarado = String(u.nome_demandas || '').split(/[\/,;]/)
    .map(x => x.trim()).filter(Boolean)[0];
  return declarado || String(u.nome || '').trim();
}

function pokerRanking(data, agora) {
  const hoje = diaLocalBR(agora.toISOString());
  const iniAtual = segundaDaSemana(hoje);
  const fimAtual = somaDias(iniAtual, 6);
  const iniAnterior = somaDias(iniAtual, -7);
  const fimAnterior = somaDias(iniAtual, -1);
  // O corte do elenco: oito semanas. Quem nao entregou nada nesse periodo e nao
  // tem demanda na mao nao e ausencia da semana — e conta parada, e uma fila de
  // zeros permanentes so faz a lista deixar de ser lida.
  const corteElenco = somaDias(iniAtual, -56);

  const dev = new Map();
  const pega = (nome) => {
    if (!dev.has(nome)) dev.set(nome, {
      nome,
      atual: { entregas: 0, pontos: 0 },
      anterior: { entregas: 0, pontos: 0 },
      emMaos: 0,
    });
    return dev.get(nome);
  };

  for (const m of (data.melhorias || [])) {
    if (!m || m.oculto || m.mesclado_em) continue;
    // O campo aceita "Fulano / Beltrano" desde sempre, e as duas pessoas contam.
    const nomes = String(m.dev || '').split('/').map(x => x.trim()).filter(Boolean);
    if (!nomes.length) continue;

    const etapa = String(m.status_planejamento || '');
    const emMaos = etapa === 'planejado' || etapa === 'em_andamento';
    const dia = diaLocalBR(m.entregue_em || m.concluido_em || '');
    const contaEntrega = !!dia && (etapa === 'validacao' || etapa === 'concluido');
    const pts = Number(m.poker_pontos);
    const pontos = Number.isFinite(pts) ? pts : 0;

    if (!emMaos && !(contaEntrega && dia >= corteElenco)) continue;

    for (const nome of nomes) {
      const d = pega(nome);
      if (emMaos) d.emMaos += 1;
      if (!contaEntrega) continue;
      if (dia >= iniAtual && dia <= fimAtual) {
        d.atual.entregas += 1; d.atual.pontos += pontos;
      } else if (dia >= iniAnterior && dia <= fimAnterior) {
        d.anterior.entregas += 1; d.anterior.pontos += pontos;
      }
    }
  }

  /* A ORDEM E DECRESCENTE, e o desempate e por pontos. Quem esta no fim da lista
     e o assunto da conversa — e por isso a lista vai INTEIRA, com os zeros. Uma
     lista cortada no top 5 esconde exatamente quem se quer perguntar. */
  const devs = [...dev.values()].sort((x, y) =>
    y.atual.entregas - x.atual.entregas ||
    y.atual.pontos - x.atual.pontos ||
    y.anterior.entregas - x.anterior.entregas ||
    x.nome.localeCompare(y.nome));

  /* A SEMANA CORRENTE ESTA PELA METADE, E A TELA TEM DE DIZER ISSO.
     Numa quarta-feira a semana atual teve 3 dias e a anterior teve 5. Sem o
     aviso, todo mundo aparece "caindo" toda segunda e terca, e a pergunta que
     nasce disso ("por que voce entregou menos?") tem resposta obvia e culpa
     ninguem — o que gasta a reuniao e a confianca na propria tela. */
  const fer = new Set(feriadosISO(data));
  const uteis = (de, ate) => {
    let n = 0, d = de;
    for (let g = 0; g < 15 && d <= ate; g++) {
      const [a, b, c] = d.split('-').map(Number);
      const dow = new Date(Date.UTC(a, b - 1, c)).getUTCDay();
      if (dow !== 0 && dow !== 6 && !fer.has(d)) n++;
      d = somaDias(d, 1);
    }
    return n;
  };

  return {
    semanas: {
      atual: { de: iniAtual, ate: fimAtual,
               uteisCorridos: uteis(iniAtual, hoje < fimAtual ? hoje : fimAtual),
               uteisTotal: uteis(iniAtual, fimAtual) },
      anterior: { de: iniAnterior, ate: fimAnterior,
                  uteisCorridos: uteis(iniAnterior, fimAnterior),
                  uteisTotal: uteis(iniAnterior, fimAnterior) },
    },
    devs,
  };
}

function pokerReferencia(data) {
  const feriados = new Set(feriadosISO(data));
  const porCarta = new Map();
  for (const m of (data.melhorias || [])) {
    if (!m || m.oculto || m.mesclado_em) continue;
    if (String(m.status_planejamento || '') !== 'concluido') continue;
    const pts = m.poker_pontos;
    if (pts === null || pts === undefined || pts === '') continue;
    const carta = String(pts);
    if (!POKER_CARTAS.includes(carta)) continue;
    const dias = diasUteis(m.inicio, m.entrega || m.concluido_em, feriados);
    if (dias === null) continue;
    if (!porCarta.has(carta)) porCarta.set(carta, { dias: [], horas: [] });
    const alvo = porCarta.get(carta);
    alvo.dias.push(dias);
    const h = Number(m.horas_realizadas);
    if (isFinite(h) && h > 0) alvo.horas.push(h);
  }
  // MEDIANA, e nao media: uma demanda parada duas semanas por dependencia externa
  // nao pode arrastar a referencia da carta inteira.
  const mediana = v => {
    if (!v.length) return null;
    const o = v.slice().sort((a, b) => a - b);
    const i = Math.floor(o.length / 2);
    return o.length % 2 ? o[i] : Math.round(((o[i - 1] + o[i]) / 2) * 10) / 10;
  };
  // `n` e `nHoras` sao contagens DIFERENTES de proposito: toda concluida com data
  // entra na de dias, e so as que tiveram hora preenchida entram na de horas. Uma
  // contagem so faria a carta parecer mais firme do que e no numero que a tela
  // esta mostrando.
  const linhas = [];
  for (const [carta, v] of porCarta) {
    linhas.push({ carta, n: v.dias.length, dias: mediana(v.dias),
                  nHoras: v.horas.length, horas: mediana(v.horas) });
  }
  linhas.sort((a, b) => Number(a.carta) - Number(b.carta));
  return { linhas, total: linhas.reduce((s, l) => s + l.n, 0) };
}

async function pokerEstado(db, codigo) {
  const ses = await db.prepare('SELECT * FROM poker_sessao WHERE codigo = ?').bind(codigo).first();
  if (!ses) return null;
  if (new Date(ses.expira_em) < new Date()) return { expirada: true };

  const corte = new Date(Date.now() - PRESENCA_S * 1000).toISOString();
  const parts = (await db.prepare(
    // ORDEM POR NOME, nao por `visto_em`. `visto_em` e a hora do ultimo sinal de
    // vida e muda a cada batida do polling de cada pessoa — a mesa embaralhava
    // sozinha a cada segundo e meio, sem nada ter acontecido, e a carta que voce
    // estava olhando pulava de lugar. Nome e estavel e ainda ajuda a achar alguem.
    'SELECT id, nome, visto_em FROM poker_participante WHERE codigo = ? ' +
    'ORDER BY nome COLLATE NOCASE, id').bind(codigo).all()).results || [];
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
          /* A ESTRELA VEM, e e ela que ordena a fila da Planning.
             Sem este campo a marca do card nao chegava a mesa: a estrela existia
             no Admin, no Gantt e no deck, e a fila do poker a ignorava — quem
             marcava as prioridades da reuniao nao via diferenca nenhuma nela. */
          destaque: !!m.destaque,
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
                      // Vai junto porque este e o unico ponto que ja le o arquivo
                      // inteiro nesta tela: calcular aqui nao custa chamada nenhuma.
                      referencia: pokerReferencia(data),
                      // Mesmo motivo da referencia: o arquivo ja esta lido aqui.
                      ranking: pokerRanking(data, agora),
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
        /* ── O SELO DE VALIDACAO ────────────────────────────────────────────
           QUEM FECHOU A PONTUACAO, e quando. E o que permite o card dizer, no
           Kanban e no Gantt, que aquela demanda passou pela planning — e por
           quem.

           POR QUE ISTO NAO SE DEDUZ do que ja existia: `poker_pontos` sozinho
           nao distingue a pontuacao FECHADA numa reuniao da estimada por alguem
           no formulario. As duas gravam o mesmo campo, e a segunda e comum —
           por isso o proprio card ja tinha o aviso "sem pontos do Planning
           Poker". O selo e a outra ponta dessa mesma distincao.

           GRAVA O NOME E O LOGIN. O nome vai no selo, que e nominal; o login e
           o que sobrevive a alguem trocar o nome de exibicao, e e por ele que
           a tela decide de quem e o selo. O `nome_demandas` tem preferencia
           porque e o nome com que a pessoa aparece nas demandas — o selo tem de
           dizer o mesmo nome que o card ja diz.

           APAGA QUANDO A PONTUACAO E APAGADA: gravar `null` nos pontos e
           desfazer a pontuacao, e um selo de "validado" sobre demanda sem
           pontos afirmaria algo que deixou de ser verdade. */
        const _uP = (_ident && _ident.usuario) || null;
        if (pontos === null && media === null) {
          alvo.poker_validado_por = null;
          alvo.poker_validado_login = null;
          alvo.poker_validado_em = null;
        } else if (_uP) {
          alvo.poker_validado_por = String(_uP.nome_demandas || _uP.nome || '').trim() || null;
          alvo.poker_validado_login = String(_uP.login || '').trim() || null;
          alvo.poker_validado_em = iso;
        }
        // QUEM VOTOU O QUE. Antes so a media sobrevivia a reuniao, e a media
        // esconde justamente o que interessa: um 3 e um 34 na mesma demanda dizem
        // que as duas pessoas entenderam coisas diferentes — e quem votou baixo
        // costuma ser quem ja fez algo parecido. Isso decide para quem vai a
        // demanda, e evaporava junto com a sessao.
        //
        // Guarda o NOME (nao o id do participante): o id so existe enquanto a
        // sala existe, e o card e lido meses depois.
        if (env.POKER_DB && body.codigo) {
          try {
            const vs = (await env.POKER_DB.prepare(
              `SELECT p.nome AS nome, v.valor AS valor
                 FROM poker_voto v JOIN poker_participante p ON p.id = v.participante
                WHERE v.codigo = ? AND v.melhoria_id = ?
                ORDER BY p.nome COLLATE NOCASE`)
              .bind(String(body.codigo), mid).all()).results || [];
            if (vs.length) {
              alvo.poker_votos = vs.map(v => ({ nome: v.nome, voto: String(v.valor) }));
              alvo.poker_votado_em = iso;
            }
          } catch (_) { /* votacao sem sala: grava so media e pontos */ }
        }
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
        return json({ ok: true, poker_media: media, poker_pontos: pontos,
                      votos: (alvo.poker_votos || []).length,
                      validado_por: alvo.poker_validado_por || null }, 200, headers);
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
    // ── MENSAGERIA: uma mensagem nova na demanda ──────────────────────────
    //
    // O SERVIDOR E A AUTORIDADE, pela mesma razao do historico: a lista chega
    // aqui pelo que ESTA GRAVADO, e nunca pelo que veio no corpo. Se a base fosse
    // o corpo, bastaria enviar `mensagens: []` para apagar a propria conversa — e
    // um registro que o auditado pode apagar nao serve para auditar.
    //
    // Cada mensagem carrega QUEM e QUANDO vindos do servidor, e nao do cliente.
    // Aceitar o nome do corpo deixaria qualquer um escrever no lugar de qualquer
    // outro, o que e o oposto do que uma trilha de auditoria precisa ser.
    if (body.action === 'mensagem-nova') {
      if (!(await ehDev())) return json({ error: 'credencial',
        detail: 'Entre com a sua conta para escrever na mensageria.' }, 401, headers);

      const mid = String(body.melhoria_id || '');
      if (!mid) return json({ error: 'melhoria_id obrigatorio' }, 400, headers);
      const texto = limpaTexto(body.texto, MSG_TAM);
      if (!texto) return json({ error: 'texto_vazio',
        detail: 'Escreva a mensagem antes de enviar.' }, 400, headers);

      const metaM = await gh('contents/' + FILE_PATH + '?t=' + Date.now());
      if (!metaM.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
      const fileM = await metaM.json();
      const rawM = await gh('contents/' + FILE_PATH + '?raw=' + Date.now(),
        { headers: { Accept: 'application/vnd.github.raw' } });
      if (!rawM.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
      const dataM = JSON.parse(await rawM.text());
      const alvoM = (dataM.melhorias || []).find(x => x.id === mid);
      if (!alvoM) return json({ error: 'Demanda nao encontrada' }, 404, headers);

      /* O CARIMBO NASCE AQUI. Havia um `iso` pronto no arquivo e eu o usei — mas
         ele mora DENTRO do bloco do Planning Poker (linhas 2059–2477), e esta
         rota fica fora dele. `node --check` valida sintaxe e não escopo: passaria
         limpo e estouraria `ReferenceError` na primeira mensagem enviada, com a
         demanda já lida do GitHub e nada gravado. */
      const agoraM = new Date().toISOString();
      const quemM = nomeNaDemanda(_ident) || (_ident && _ident.login) || '(sem conta)';

      /* AS MENCOES SAO CONFERIDAS CONTRA A LISTA DE PESSOAS, e nao aceitas como
         vieram. Duas razoes: `@` seguido de qualquer coisa viraria mencao a
         alguem que nao existe, e o nome so serve para notificar se casar com
         alguem de verdade. O texto NAO e reescrito — quem escreveu "@Joao" ve
         "@Joao"; o que se guarda separado e a lista de quem foi de fato
         mencionado. */
      const pessoas = devsDasDemandas(dataM, false) || [];
      const mencoes = [];
      const rx = /@([\p{L}][\p{L}\s.'-]{1,39})/gu;
      let mm;
      while ((mm = rx.exec(texto)) !== null) {
        const escrito = mm[1].trim().toLowerCase();
        for (const p of pessoas) {
          const nome = String(p || '').trim();
          if (!nome) continue;
          // Casa pelo comeco: quem digita "@Emilly" alcanca "Emilly Souza" sem
          // ter de escrever o nome inteiro.
          if (escrito.startsWith(nome.toLowerCase()) || nome.toLowerCase().startsWith(escrito)) {
            if (!mencoes.includes(nome)) mencoes.push(nome);
          }
        }
      }

      const anteriorM = Array.isArray(alvoM.mensagens) ? alvoM.mensagens : [];
      const entradaM = { em: agoraM, quem: quemM, texto };
      if (mencoes.length) entradaM.mencoes = mencoes;
      alvoM.mensagens = anteriorM.concat([entradaM]).slice(-MSG_MAX);
      dataM.atualizado_em = agoraM;

      const riscoM = gravacaoSuspeita(dataM, fileM.size || 0);
      if (riscoM) return json({ error: riscoM }, 409, headers);
      const putM = await gh('contents/' + FILE_PATH, {
        method: 'PUT',
        body: JSON.stringify({
          message: 'chore: mensageria ' + (alvoM.codigo || mid),
          content: toB64(JSON.stringify(dataM)), sha: fileM.sha }),
      });
      if (!putM.ok) {
        const e = await putM.text();
        return json({ error: 'Falha ao salvar', detail: e.slice(0, 200) }, 502, headers);
      }
      return json({ ok: true, mensagem: entradaM,
                    total: alvoM.mensagens.length }, 200, headers);
    }

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
        // `nome_demandas` ja sai preenchido do cadastro. Sem isso a conta nova
        // chegava no painel sem vinculo, e o resolvedor tentava adivinhar por
        // semelhanca — foi assim que um dev novo abriu a fila do Joao Lucas.
        await env.POKER_DB.prepare(
          `INSERT INTO usuario (id, login, nome, email, senha_hash, salt, papel, ativo, pendente,
                                criado_em, nome_demandas)
           VALUES (?,?,?,?,?,?,?,0,1,?,?)`)
          .bind('u-' + crypto.randomUUID().slice(0, 8), login, nome, email, hash, salt, 'dev',
                new Date().toISOString(), nomeDemandasDoEmail(email, nome) || null).run();
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
      // `link_externo` fica por compatibilidade: nenhuma demanda o usa, mas
      // automacao antiga pode ler o campo.
      link_externo: m.link_externo || '',
      link_issue: m.link_issue || '',
      link_pr: m.link_pr || '',
      link_milestone: m.link_milestone || '',
      projeto_id: m.projeto_id || '',
      pausado: !!String(m.pausado_em || '').trim(),
      pausa_motivo: m.pausa_motivo || '',
      entregue_em: m.entregue_em || '',
      concluido_em: m.concluido_em || '',
      criado_em: m.criado_em || '',
      // Estado derivado, para a automacao nao ter de reimplementar a regra:
      aguardando_validacao: (m.status_planejamento || '') === 'validacao',
      concluida: (m.status_planejamento || '') === 'concluido',
      // Prazo: `atrasada` e `dias_atraso` saem daqui prontos. Sem isto quem
      // automatiza teria de reimplementar a regra — inclusive a parte de pausada
      // nao atrasar, que ninguem adivinha de fora.
      atrasada: diasDeAtraso(m, hojeBR()) > 0,
      dias_atraso: diasDeAtraso(m, hojeBR()),
    });

    const ETAPAS_DEV = ['backlog', 'levantar_req', 'planning', 'planejado', 'em_andamento'];

    /* A LISTA BRANCA DE QUEM ENTRA AQUI.
     *
     * Esquecer um nome nela nao da erro: a acao cai no `acao_invalida` la
     * embaixo, como se nunca tivesse sido escrita. Aconteceu com
     * `demanda-procurar` — o endpoint inteiro subiu para producao como codigo
     * morto, e a prova local nao pegou porque extraia o BLOCO e o executava
     * direto, passando por cima do roteamento.
     *
     * Ha invariante conferindo que todo `body.action` tratado dentro deste bloco
     * esta nesta lista. */
    if (['demandas-minhas', 'demanda-consultar', 'demanda-procurar',
         'demanda-atualizar', 'demanda-entregar']
        .includes(body.action)) {
      const perm = await exigePapel(env, body, ['dev', 'admin'], headers);
      if (perm.recusa) return perm.recusa;
      const ident = perm.ident;
      const ehAdm = ident.papel === 'admin';
      const eu = nomeNaDemanda(ident) || limpaTexto(body.dev, 80);

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
      // A heuristica de prefixo que morava aqui foi removida. Ela comparava o nome
      // da conta com o nome na demanda e aceitava um ser prefixo do outro — um
      // caminho por onde a fila de uma pessoa chega na mao de outra. Hoje o nome
      // usado nas demandas sai do e-mail no cadastro, entao ha sempre algo EXATO
      // para comparar, e nao ha mais o que inferir.
      // Nomes que ESTA conta reconhece como seus. Quando a conta declara o nome
      // usado nas demandas, a comparacao passa a ser EXATA (normalizada por acento e
      // caixa): declarado e declarado, nao ha o que inferir. Sem o campo, cai na
      // heuristica de prefixo — que resolveu o caso do nome completo mas nao alcanca
      // apelido de um nome so, e por isso o campo existe.
      // O NOME PADRAO E O DO E-MAIL: `nome.sobrenome` vira "Nome Sobrenome", e e
      // ele que passa a valer em toda a base. O campo "nome nas demandas" deixa de
      // ser necessario — vira EXCECAO, para o caso em que a pessoa e conhecida por
      // outro nome (o "Leite" e o unico hoje).
      //
      // Os tres convivem, todos por IGUALDADE: derivado do e-mail, declarado, e o
      // nome da conta. Somar em vez de escolher elimina a janela da virada — entre
      // trocar o nome nas demandas e trocar o cadastro, ninguem fica sem ver a
      // propria fila. E nenhum deles infere nada: ou o nome bate, ou nao bate.
      const declarados = String((ident.usuario && ident.usuario.nome_demandas) || '')
        .split(/[\/,;]/).map(x => x.trim()).filter(Boolean);
      const doEmail = nomeDemandasDoEmail((ident.usuario && ident.usuario.email) || '', eu);
      const aceitos = [...declarados, doEmail, eu].filter(Boolean);
      const meuDono = m => {
        const naDemanda = String(m.dev || '').split('/').map(x => x.trim()).filter(Boolean);
        return naDemanda.some(n => aceitos.some(a => normNome(n) === normNome(a)));
      };

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
        // Filtro de atraso: e a pergunta mais comum de quem automatiza ("o que eu
        // preciso resolver hoje"), e sem ele a resposta exigiria puxar tudo e
        // recalcular fora.
        if (body.atrasadas === true) {
          const hj = hojeBR();
          lista = lista.filter(m => diasDeAtraso(m, hj) > 0);
        }
        lista.sort((a, b) => String(a.entrega || '9999').localeCompare(String(b.entrega || '9999')));
        return json({ ok: true, dev: eu, total: lista.length,
                      // Por qual nome a busca foi feita. Sem isto "total: 0" nao
                      // distingue "nao tenho demanda" de "meu nome nao casou" — foi
                      // essa duvida que gerou o chamado do dev.
                      nomes_procurados: declarados.length ? declarados : [eu],
                      criterio: declarados.length ? 'nome declarado na conta' : 'nome da conta',
                      demandas: lista.map(m => devVisao(m, temas)) }, 200, headers);
      }

      /* ACHAR A DEMANDA PELO QUE A PESSOA TEM NA MAO.
       *
       * Ela chega de tres jeitos, e nenhum deles e escolha de quem procura:
       *   AX-042   o codigo, que vem do card e do commit
       *   #042     o mesmo codigo escrito como o time fala, com cerquilha
       *   #1087    o numero da ISSUE no GitHub, que e o que aparece no PR
       *
       * O `#` NAO DIZ QUAL DOS DOIS E. "#157" pode ser a AX-157 e pode ser a issue
       * 157 — as duas numeracoes existem e se cruzam. Entao tenta-se o codigo
       * primeiro (e o que a plataforma usa) e a issue depois, e a RESPOSTA DIZ
       * QUAL CASOU: sem isso, quem procurou a issue 157 e recebeu a AX-157 nao tem
       * como perceber que veio outra coisa.
       *
       * Na base de producao, 25 das 357 demandas tem `link_issue` — procurar so
       * por issue acharia quase nada, e procurar so por codigo deixaria de fora
       * justamente o numero que o dev tem no navegador aberto. */
      const soDigitos = t => String(t || '').replace(/\D+/g, '');

      const achaPorCodigo = (cru) => {
        // Sem limpeza previa: o que se usa sao os DIGITOS e as LETRAS, e o resto
        // ja fica de fora. Ver o comentario equivalente em `busca-demanda.js`.
        const cod = String(cru || '').trim().toUpperCase();
        const num = cod.replace(/\D+/g, '');
        if (!num) return null;
        const letras = cod.replace(/[^A-Z]/g, '');
        return todas.find(m => {
          const c = String(m.codigo || '').toUpperCase();
          const cn = c.replace(/\D+/g, '');
          if (!cn) return false;
          // O NUMERO COMO NUMERO: os codigos tem zero a esquerda ("AX-042") e quem
          // digita escreve "42". Comparar texto escondia a demanda da forma mais
          // natural de pedi-la.
          if (Number(cn) !== Number(num)) return false;
          if (letras && c.replace(/[^A-Z]/g, '') !== letras) return false;
          return true;
        }) || null;
      };

      /* A ISSUE E PROCURADA NO NUMERO, e nao no texto do link. `link_issue` guarda
       * a URL inteira; comparar a string faria "1087" casar com a issue 10871 e
       * com qualquer PR que tivesse 1087 no meio do caminho. O numero e o ultimo
       * trecho da URL, e e ele que se compara. */
      const numeroDaIssue = (url) => {
        const m = String(url || '').trim().match(/(\d+)\s*$/);
        return m ? m[1] : '';
      };

      const achaPorIssue = (cru) => {
        const num = soDigitos(cru);
        if (!num) return null;
        return todas.find(m => numeroDaIssue(m.link_issue) === num) || null;
      };

      // Devolve a demanda E por qual caminho ela foi encontrada.
      const achaComoAchou = () => {
        const id = String(body.id || '').trim();
        if (id) {
          const m = todas.find(x => x.id === id);
          return m ? { m, por: 'id' } : null;
        }
        const cru = String(body.codigo || body.issue || '').trim();
        if (!cru) return null;
        // O codigo primeiro: e a identificacao da propria plataforma.
        const porCod = body.issue && !body.codigo ? null : achaPorCodigo(cru);
        if (porCod) return { m: porCod, por: 'codigo' };
        const porIssue = achaPorIssue(cru);
        if (porIssue) return { m: porIssue, por: 'issue' };
        return null;
      };

      const acha = () => {
        const r = achaComoAchou();
        return r ? r.m : null;
      };

      if (body.action === 'demanda-consultar') {
        const r = achaComoAchou();
        if (!r) {
          return json({ error: 'nao_encontrada',
                        detail: 'Informe "codigo" (ex.: AX-042, #042 ou #1087 para a issue) ' +
                                'ou "id" de uma demanda existente.' }, 404, headers);
        }
        /* CONSULTAR NAO EXIGE POSSE, e e deliberado: o dev precisa ver a demanda
           que o colega esta tocando para nao duplicar trabalho, e a que o PM cita
           na reuniao. GRAVAR continua exigindo — `demanda-atualizar` e
           `demanda-entregar` respondem 403 `nao_sua`.
           `sua` viaja na resposta para a tela saber se oferece as acoes ou se
           mostra em modo leitura: oferecer um botao que o servidor vai recusar e
           fazer a pessoa levar erro no clique de algo que a tela dizia poder. */
        return json({ ok: true,
                      achada_por: r.por,
                      sua: meuDono(r.m),
                      demanda: devVisao(r.m, temas) }, 200, headers);
      }

      /* PROCURAR ANTES DE CRIAR.
       *
       * `demanda-consultar` responde "como esta a AX-042" — exige o codigo que se
       * procura. Nao respondia "ja existe alguma sobre isto?", e era essa a
       * pergunta que faltava: sem ela, o script cria e descobre a duplicata
       * depois, no 409.
       *
       * NAO E "VALIDAR". O nome foi evitado de proposito: nesta base validacao e a
       * ETAPA em que o PM/PO aprova a entrega, e um `demanda-validar` seria lido
       * como "aprovar a demanda" por quem chegasse depois.
       *
       * DUAS RESPOSTAS DIFERENTES, e a distincao e o que torna o endpoint util:
       *   `identica`   mesma assinatura de titulo. E o que `demanda-nova` VAI
       *                recusar — quem chama sabe disso antes de tentar.
       *   `parecidas`  compartilham palavras. Nao barram nada; sao para os olhos
       *                de quem decide.
       *
       * A ASSINATURA E A MESMA DA TRAVA (`tituloAssinatura`). Se fosse outra, o
       * endpoint diria "pode criar" e a gravacao recusaria — e quem automatiza
       * ficaria sem entender qual das duas acreditar. */
      if (body.action === 'demanda-procurar') {
        /* O TETO DA BUSCA E MAIOR QUE O DA CRIACAO, e nao por descuido.
         *
         * `demanda-nova` corta o titulo em 200 porque e o maximo que ele grava.
         * Cortar a BUSCA no mesmo numero criou uma divergencia silenciosa: a
         * AX-257 tem 233 caracteres (nasceu pela tela, que nao corta), entao
         * procurar por ela comparava os primeiros 200 contra os 233 gravados,
         * nao achava, e o endpoint respondia "pode criar" para um titulo que a
         * trava recusa. Pego rodando os 304 titulos vivos contra as duas regras.
         *
         * 500 cobre qualquer titulo que a base tenha (o maior tem 233) e continua
         * sendo um limite — corpo sem teto e porta de abuso. Ha invariante
         * conferindo que nenhum titulo vivo passa disso. */
        const termo = limpaTexto(body.titulo || body.termo, 500);
        if (termo.length < 3) {
          return json({ error: 'termo',
                        detail: 'Informe "titulo" (ou "termo") com ao menos 3 caracteres.' }, 400, headers);
        }
        const viva = m => m && !m.oculto && !m.mesclado_em &&
                          String(m.status_planejamento || '') !== 'negada';
        const alvoTema = String(body.tema_id || '').trim();
        const candidatas = todas.filter(m => viva(m) && (!alvoTema || String(m.tema_id) === alvoTema));

        const chave = tituloAssinatura(termo);
        const identica = candidatas.find(m => tituloAssinatura(m.titulo) === chave) || null;

        /* PALAVRAS DE 4 LETRAS OU MAIS, e sem as vazias. "de", "no", "da" estao em
         * metade dos titulos da base e casariam tudo com tudo; "ajuste", "erro" e
         * "tela" tambem, e por isso entram na lista de ruido. O que sobra e o
         * assunto. */
        const RUIDO = new Set(['para', 'pelo', 'pela', 'como', 'ajuste', 'ajustes', 'erro',
                               'bug', 'tela', 'campo', 'novo', 'nova', 'quando', 'sobre',
                               'esta', 'estao', 'mais', 'menos', 'todos', 'todas']);
        const palavras = t => [...new Set(tituloAssinatura(t).split(' ')
          .filter(p => p.length >= 4 && !RUIDO.has(p)))];
        const doTermo = palavras(termo);
        const parecidas = doTermo.length
          ? candidatas
              .filter(m => !identica || m.id !== identica.id)
              .map(m => {
                const dela = palavras(m.titulo);
                const comuns = doTermo.filter(p => dela.includes(p));
                // Jaccard: proporcao do que as duas compartilham sobre o que as
                // duas tem juntas. Contar so os comuns faria um titulo enorme
                // casar com qualquer coisa, por conter muitas palavras.
                const uniao = new Set([...doTermo, ...dela]).size || 1;
                return { m, comuns, forca: comuns.length / uniao };
              })
              .filter(x => x.comuns.length >= 2 || x.forca >= 0.34)
              .sort((a, b) => b.forca - a.forca)
              .slice(0, 8)
          : [];

        /* A SITUACAO NA VALIDACAO, DITA COM TODAS AS LETRAS.
         *
         * `etapa` ja vinha, mas obrigava quem chama a saber que 'concluido'
         * significa "o PM/PO aprovou" e 'validacao' significa "entregue,
         * esperando aprovacao". Sao tres respostas diferentes para "isso ja passou
         * pela validacao?", e derivar isso de um texto de etapa e exatamente o
         * tipo de regra que cada script escreve de um jeito.
         *
         *   validada              o PM/PO aprovou: acabou
         *   aguardando_validacao  o dev entregou, esta com o PM/PO
         *   em_esteira            ainda esta sendo feita
         */
        const situacao = (m) => {
          const e = String(m.status_planejamento || '');
          return { validada: e === 'concluido',
                   aguardando_validacao: e === 'validacao',
                   em_esteira: !['concluido', 'validacao'].includes(e) };
        };
        /* E O QUE LEVA AO GIT VAI JUNTO. `devVisao` ja carregava os tres campos de
           link; o que faltava era dizer que ELES EXISTEM, sem quem chama ter de
           testar tres campos vazios para descobrir. */
        const doGit = (m) => [m.link_issue, m.link_pr, m.link_milestone]
          .filter(x => String(x || '').trim());
        const comSituacao = (m) => Object.assign(devVisao(m, temas), situacao(m),
                                                 { links_git: doGit(m) });

        return json({ ok: true,
                      termo: termo,
                      // O que a trava vai fazer se este titulo for gravado. E a
                      // informacao acionavel: `false` aqui significa que
                      // `demanda-nova` aceita.
                      bloqueia_criacao: !!identica,
                      identica: identica ? comSituacao(identica) : null,
                      parecidas: parecidas.map(x => Object.assign(
                        comSituacao(x.m), { palavras_em_comum: x.comuns })),
                      total_parecidas: parecidas.length,
                      // O repositorio de codigo. NUNCA devolve lista vazia para
                      // dizer "nao consegui olhar" — ver `procuraNoGit`.
                      git: await procuraNoGit(env, doTermo) }, 200, headers);
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
        const errLink = aplicaLinksGh(m, body, mudou);
        if (errLink) return json({ error: errLink.campo, detail: errLink.detail }, 400, headers);
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
                                'link_issue, link_pr, link_milestone, horas_realizadas, ' +
                                'etapa ou projeto_id.' }, 400, headers);
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
        const errLinkE = aplicaLinksGh(m, body, null);
        if (errLinkE) return json({ error: errLinkE.campo, detail: errLinkE.detail }, 400, headers);
        m.implementacao = impl;
        m.horas_realizadas = h;
        m.status_planejamento = 'validacao';
        m.status = 'iniciada';
        // SEMPRE atualiza, e nao so na primeira vez: se a validacao reprovou e o
        // dev entregou de novo, e a ENTREGA QUE PASSOU que encerra o prazo. Manter
        // a data da primeira ida faria uma demanda reprovada aparecer no prazo.
        m.entregue_em = new Date().toISOString();
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
      /* Quem abre e o dono. Conta legada (senha compartilhada) precisa dizer quem e.

         O nome vem de `nomeNaDemanda`, e nao direto da conta: a conta guarda o
         nome civil e a base guarda o nome do time. Carimbar o civil fazia a
         mesma pessoa aparecer duas vezes em todo relatorio. */
      const devNome = nomeNaDemanda(ident) || limpaTexto(body.dev, 80);
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

      /* A API PASSA PELA MESMA TRAVA DAS TELAS.
       *
       * `criandoTituloRepetido` foi ligada em `publish` e `dev-publish` no dia em
       * que a AX-324 e a AX-325 nasceram identicas com 91 segundos de diferenca —
       * e ESTE caminho ficou de fora. As duas telas protegidas e a API aberta e
       * pior do que nenhuma protecao: da a impressao de que o problema foi
       * resolvido, e um script que rode duas vezes cria as duas mesmo assim.
       *
       * Reusa a funcao, e nao uma comparacao escrita aqui: uma segunda regra
       * divergiria da das telas, e ai a API recusaria o que a tela aceita (ou o
       * contrario), que e o pior dos dois mundos para quem automatiza.
       *
       * `nova.id` acabou de ser gerado e o servidor nao o conhece — entao ela e
       * vista como criacao, que e exatamente o caso que a trava cobre. */
      const repetida = criandoTituloRepetido({ melhorias: [nova] }, atual);
      if (repetida.length) {
        return json({ error: 'titulo_repetido',
                      itens: repetida,
                      detail: 'Ja existe demanda viva com este titulo: ' +
                              repetida.map(r => r.existente + ' — "' + r.titulo + '"').join('; ') +
                              '. Consulte antes com "demanda-procurar": se for a mesma coisa, ' +
                              'atualize a que existe; se for outra, diferencie o titulo.' },
                    409, headers);
      }

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
      // Avisa se a senha foi redefinida pelo fluxo automatico. Se nao foi a
      // propria pessoa, e aqui que ela descobre — no mesmo dia, e nao nunca.
      const avisoReset = u.reset_em && (Date.now() - new Date(u.reset_em).getTime()) < 30 * 86400 * 1000
        ? u.reset_em : '';
      // `nome_demandas` vai no retorno porque e ele que liga a conta ao nome
      // grafado nas demandas. Sem ele aqui, o painel nao consegue se vincular
      // sozinho e precisa pedir para a pessoa se procurar numa lista de vinte
      // botoes — que e exatamente o que este campo existe para evitar.
      return json({ ok: true, token, expira_em: expira, senha_redefinida_em: avisoReset,
                    usuario: { login: u.login, nome: u.nome, papel: u.papel,
                               nome_demandas: u.nome_demandas || '' } }, 200, headers);
    }

    // ── Meu vinculo: o nome que EU uso nas demandas ─────────────────
    // Existe a versao de admin (`usuarios` / op `nome-demandas`). Esta e a da
    // propria pessoa, e e o que torna a jornada automatica: quando o painel nao
    // acha as demandas dela, ela aponta o nome uma vez e nunca mais e perguntada.
    //
    // So escreve na PROPRIA conta — o id vem da sessao, nunca do corpo do pedido.
    // Com login no corpo, qualquer dev renomearia o vinculo de qualquer outro e
    // passaria a enxergar as demandas dele.
    if (body.action === 'meu-nome-demandas') {
      if (!env.POKER_DB) return json({ error: 'indisponivel' }, 503, headers);
      const ident = await identifica(env, body);
      if (!ident || !ident.usuario || !ident.usuario.id) {
        return json({ error: 'sem_conta',
                      detail: 'Este ajuste é da conta. Entre com usuário e senha.' }, 401, headers);
      }
      const nomes = String(body.nome_demandas || '').split(/[\/,;]/)
        .map(x => limpaTexto(x, 80).trim()).filter(Boolean);
      if (nomes.length > 5) {
        return json({ error: 'muitos_nomes',
                      detail: 'No maximo 5 nomes.' }, 400, headers);
      }
      await env.POKER_DB.prepare('UPDATE usuario SET nome_demandas = ? WHERE id = ?')
        .bind(nomes.join(' / ') || null, ident.usuario.id).run();
      return json({ ok: true, nome_demandas: nomes.join(' / ') }, 200, headers);
    }

// ── Fechar o mes: rola para o mes seguinte o que ficou em aberto ──
    //
    // Uma acao propria, e nao um publish comum, por tres razoes:
    //
    //   1. Ela mexe em dezenas de demandas de uma vez. Pela tela, seriam dezenas
    //      de edicoes e um publish gigante, com todo o risco de concorrencia que
    //      isso traz.
    //   2. O `em` das roladas e o DIA 1 do mes destino, e nao a data em que o
    //      botao foi clicado. Fechar agosto no dia 3 de setembro nao transforma
    //      as roladas em "entrou no meio de setembro" — elas sao compromisso de
    //      setembro inteiro. E um caso que a gravacao normal nao sabe distinguir.
    //   3. Rolar e decisao de quem coordena. Exige admin.
    //
    // O que NAO rola: concluida e negada. Elas ficaram no mes em que estavam, e e
    // isso que permite ao fechamento de agosto continuar dizendo, em dezembro, o
    // que agosto prometeu e o que agosto entregou.
    if (body.action === 'mes-fechar') {
      const negaMes = await exigePapel(env, body, 'admin', headers);
      if (negaMes) return negaMes;
      const mesDe = String(body.mes || '');
      if (!mesValido(mesDe)) return json({ error: 'mes_invalido' }, 400, headers);
      const mesPara = mesValido(body.para) ? String(body.para) : mesSoma(mesDe, 1);
      if (mesPara <= mesDe) {
        return json({ error: 'mes_destino',
                      detail: 'O mes destino tem de ser depois do que esta sendo fechado.' },
                    400, headers);
      }

      // Leitura RAW, e nao base64 decodificado aqui: `atob` quebra acento, e isso
      // ja corrompeu titulo de demanda nesta base uma vez. O sha vem da chamada
      // normal, que e o que o PUT exige.
      const getM = await gh('contents/' + FILE_PATH + '?t=' + Date.now());
      if (!getM.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
      const fileM = await getM.json();
      const rawM = await gh('contents/' + FILE_PATH + '?raw=' + Date.now(),
                            { headers: { Accept: 'application/vnd.github.raw' } });
      if (!rawM.ok) return json({ error: 'Falha ao ler dados' }, 502, headers);
      const textoM = await rawM.text();
      const dataM = JSON.parse(textoM);
      const confM = await conflito(gh, body, headers);
      if (confM) return confM;

      const ABERTAS = m => !['concluido', 'negada'].includes(String(m.status_planejamento || ''));
      const roladas = [];
      for (const m of (dataM.melhorias || [])) {
        if (!m || m.mesclado_em || m.oculto) continue;
        if (mesAtual(m) !== mesDe) continue;
        if (!ABERTAS(m)) continue;
        m.meses = mesTrilha(m).concat([{ mes: mesPara, em: mesPara + '-01' }]);
        m.mes_alvo = mesPara;
        roladas.push({ id: m.id, codigo: m.codigo || '', titulo: m.titulo || '',
                       dev: m.dev || '', rolos: m.meses.length - 1 });
      }

      // Nada a rolar tambem e resposta: o mes fechou limpo, e dizer isso e melhor
      // do que gravar por gravar.
      if (!roladas.length) {
        return json({ ok: true, roladas: [], mes: mesDe, para: mesPara }, 200, headers);
      }

      const quemM = (await papelAtual()) || 'admin';
      registraHistorico(dataM, JSON.parse(textoM), quemM, 'fechamento do mes');
      dataM.atualizado_em = new Date().toISOString();
      const putM = await gh('contents/' + FILE_PATH, {
        method: 'PUT',
        body: JSON.stringify({ message: 'chore: fecha ' + mesDe + ' e rola ' + roladas.length +
                                        ' para ' + mesPara,
                               content: toB64(JSON.stringify(dataM)), sha: fileM.sha }),
      });
      if (!putM.ok) { const e = await putM.text(); return json({ error: 'Falha ao salvar', detail: e }, 502, headers); }
      return json({ ok: true, roladas, mes: mesDe, para: mesPara,
                    atualizado_em: dataM.atualizado_em }, 200, headers);
    }

    // ── Recuperar senha: pedir ──────────────────────────────────────
    // Liberacao AUTOMATICA pelo e-mail, como pedido. O e-mail e obrigatorio e e a
    // unica prova; ver o comentario da tabela senha_reset para o risco disso e
    // para o porque das tres guardas.
    if (body.action === 'senha-recuperar') {
      if (!env.POKER_DB) return json({ error: 'indisponivel' }, 503, headers);
      await contasMigrar(env.POKER_DB);
      const email = String(body.email || '').trim().toLowerCase();
      if (!email.endsWith(EMAIL_DOMINIO) || !/^[a-z0-9._%+-]+@/.test(email)) {
        return json({ error: 'email',
                      detail: 'Informe seu e-mail corporativo, terminando em ' + EMAIL_DOMINIO + '.' },
                    400, headers);
      }
      await contaTentativa(env, ip, 'senha-recuperar');
      const u = await env.POKER_DB.prepare(
        'SELECT id, nome, login, papel, ativo, pendente FROM usuario WHERE email = ?')
        .bind(email).first();
      // Dizer que o e-mail nao existe e deliberado: foi pedido que o retorno
      // VALIDE o e-mail, e num time de 10 pessoas com enderecos publicos esconder
      // isso nao protegeria nada e só geraria chamado de "nao acontece nada".
      if (!u) {
        return json({ error: 'nao_encontrado',
                      detail: 'Nao ha conta com esse e-mail. Confira o endereco ou fale com o administrador.' },
                    404, headers);
      }
      if (u.pendente) {
        return json({ error: 'pendente',
                      detail: 'Seu cadastro ainda nao foi liberado por um administrador.' }, 403, headers);
      }
      if (!u.ativo) {
        return json({ error: 'inativa',
                      detail: 'Esta conta esta desativada. Fale com o administrador.' }, 403, headers);
      }
      // ADMIN NAO. Redefinir a senha de um admin com apenas o e-mail seria
      // entregar a ferramenta inteira — contas, papeis e base — a quem souber um
      // endereco. Sao tres admins; um recupera pelo outro.
      if (u.papel === 'admin') {
        return json({ error: 'admin',
                      detail: 'Contas de administrador nao se redefinem por aqui, por seguranca. ' +
                              'Peca a outro administrador para gerar sua nova senha.' }, 403, headers);
      }
      // Limite POR CONTA, alem do limite por IP: trocar de rede nao pode virar
      // caminho para insistir na mesma pessoa.
      const desde = new Date(Date.now() - 3600 * 1000).toISOString();
      const recentes = await env.POKER_DB.prepare(
        'SELECT COUNT(*) AS n FROM senha_reset WHERE usuario_id = ? AND criado_em > ?')
        .bind(u.id, desde).first();
      if (((recentes && recentes.n) || 0) >= 3) {
        return json({ error: 'limite',
                      detail: 'Muitos pedidos para esta conta na ultima hora. Espere ou fale com o administrador.' },
                    429, headers);
      }
      const tk = crypto.randomUUID() + '-' + crypto.randomUUID();
      const agoraIso = new Date().toISOString();
      const exp = new Date(Date.now() + RESET_MIN * 60 * 1000).toISOString();
      await env.POKER_DB.prepare(
        'INSERT INTO senha_reset (token, usuario_id, expira_em, criado_em, ip) VALUES (?,?,?,?,?)')
        .bind(tk, u.id, exp, agoraIso, String(ip || '')).run();
      // Faxina barata das janelas vencidas, para a tabela nao crescer sem limite.
      await env.POKER_DB.prepare('DELETE FROM senha_reset WHERE expira_em < ? AND usado_em IS NULL')
        .bind(new Date(Date.now() - 7 * 86400 * 1000).toISOString()).run();
      return json({ ok: true, token: tk, expira_em: exp, minutos: RESET_MIN,
                    nome: u.nome }, 200, headers);
    }

    // ── Recuperar senha: definir a nova ─────────────────────────────────
    if (body.action === 'senha-redefinir') {
      if (!env.POKER_DB) return json({ error: 'indisponivel' }, 503, headers);
      await contasMigrar(env.POKER_DB);
      const tk = String(body.token || '');
      const nova = String(body.senhaNova || '');
      if (nova.length < 8) {
        return json({ error: 'senha_curta',
                      detail: 'A nova senha precisa de ao menos 8 caracteres.' }, 400, headers);
      }
      const r = await env.POKER_DB.prepare(
        'SELECT token, usuario_id, expira_em, usado_em FROM senha_reset WHERE token = ?')
        .bind(tk).first();
      if (!r) return json({ error: 'invalido', detail: 'Pedido nao encontrado. Comece de novo.' }, 404, headers);
      // Uso unico: sem isso a janela viraria uma chave permanente para a conta.
      if (r.usado_em) {
        return json({ error: 'usado', detail: 'Este pedido ja foi usado. Comece de novo.' }, 409, headers);
      }
      if (new Date(r.expira_em) <= new Date()) {
        return json({ error: 'expirado',
                      detail: 'O tempo para redefinir terminou. Peca de novo.' }, 410, headers);
      }
      const agoraIso = new Date().toISOString();
      const salt = hexDe(crypto.getRandomValues(new Uint8Array(16)));
      const hash = await derivaSenha(nova, salt);
      await env.POKER_DB.prepare(
        'UPDATE usuario SET senha_hash = ?, salt = ?, reset_em = ? WHERE id = ?')
        .bind(hash, salt, agoraIso, r.usuario_id).run();
      await env.POKER_DB.prepare('UPDATE senha_reset SET usado_em = ? WHERE token = ?')
        .bind(agoraIso, tk).run();
      // Encerra tudo que estava aberto: se a redefinicao nao foi a dona da conta,
      // quem estava dentro sai; se foi ela, ela entra de novo com a senha nova.
      await env.POKER_DB.prepare('DELETE FROM sessao WHERE usuario_id = ?').bind(r.usuario_id).run();
      await env.POKER_DB.prepare('UPDATE senha_pedido SET atendido = 1 WHERE usuario_id = ?')
        .bind(r.usuario_id).run();
      // NAO devolve sessao: entrar com a senha nova prova que ela ficou como a
      // pessoa quis, e um erro de digitacao aparece agora e nao amanha.
      return json({ ok: true }, 200, headers);
    }

    // ── Trocar a PROPRIA senha ──────────────────────────────────────
    // Antes so o admin trocava senha, pela aba Usuarios. Isso obrigava a senha
    // nova a trafegar por Teams ate chegar em quem ia usar, e senha definida por
    // terceiro tende a nunca ser trocada — fica a padrao que todo mundo conhece.
    //
    // EXIGE CONTA (token de sessao). Quem entrou pela senha compartilhada nao tem
    // senha individual: aceitar aqui trocaria a senha de qual pessoa?
    if (body.action === 'senha-alterar') {
      if (!env.POKER_DB) return json({ error: 'indisponivel' }, 503, headers);
      await contasMigrar(env.POKER_DB);
      const ident = await identifica(env, body);
      if (!ident || !ident.usuario) {
        return json({ error: 'sem_conta',
                      detail: 'Entre com sua conta para trocar a senha. A senha compartilhada ' +
                              'do time nao e individual e nao pode ser alterada aqui.' }, 403, headers);
      }
      const atual = String(body.senhaAtual || '');
      const nova = String(body.senhaNova || '');
      if (nova.length < 8) {
        return json({ error: 'senha_curta',
                      detail: 'A nova senha precisa de ao menos 8 caracteres.' }, 400, headers);
      }
      if (nova === atual) {
        return json({ error: 'igual',
                      detail: 'A nova senha e igual a atual.' }, 400, headers);
      }
      const u = await env.POKER_DB.prepare(
        'SELECT id, senha_hash, salt FROM usuario WHERE id = ?').bind(ident.usuario.id).first();
      if (!u) return json({ error: 'nao_encontrado' }, 404, headers);
      // Confere a senha ATUAL. Sem isso, um token vazado trocaria a senha e
      // trancaria a pessoa fora da propria conta.
      const hAtual = await derivaSenha(atual, u.salt);
      if (!igualSeguro(hAtual, u.senha_hash)) {
        // Conta a tentativa: sem limite, o campo "senha atual" seria um oraculo
        // para adivinhar a senha de quem deixou a sessao aberta.
        await contaTentativa(env, ip, 'senha-alterar');
        return json({ error: 'credencial',
                      detail: 'Senha atual incorreta.' }, 401, headers);
      }
      const saltN = hexDe(crypto.getRandomValues(new Uint8Array(16)));
      const hashN = await derivaSenha(nova, saltN);
      await env.POKER_DB.prepare('UPDATE usuario SET senha_hash = ?, salt = ? WHERE id = ?')
        .bind(hashN, saltN, u.id).run();
      // Encerra TODAS as sessoes da pessoa e devolve uma nova: trocar senha e o
      // gesto de quem suspeita de acesso indevido, e manter as outras sessoes de
      // pe esvaziaria o sentido. Devolver token novo evita expulsar quem trocou.
      await env.POKER_DB.prepare('DELETE FROM sessao WHERE usuario_id = ?').bind(u.id).run();
      const tk = crypto.randomUUID() + '-' + crypto.randomUUID();
      const agoraIso = new Date().toISOString();
      const exp = new Date(Date.now() + SESSAO_H * 3600 * 1000).toISOString();
      await env.POKER_DB.prepare(
        'INSERT INTO sessao (token, usuario_id, expira_em, criado_em) VALUES (?,?,?,?)')
        .bind(tk, u.id, exp, agoraIso).run();
      // Resolve pedido de recuperacao em aberto: a pessoa se resolveu sozinha, e
      // deixar na fila faria o admin trocar a senha que ela acabou de definir.
      await env.POKER_DB.prepare('UPDATE senha_pedido SET atendido = 1 WHERE usuario_id = ?')
        .bind(u.id).run();
      return json({ ok: true, token: tk, expira_em: exp }, 200, headers);
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
        // `email` ja vem na consulta: e dele que sai a sugestao de nome para as
        // demandas, montada abaixo. O seletor do Admin so conhece nomes que ja
        // aparecem em alguma demanda — para um dev novo, que por definicao nao tem
        // nenhuma, nao havia nada certo para escolher.
        const r = await env.POKER_DB.prepare(
          `SELECT id, login, nome, email, papel, ativo, pendente, criado_em, ultimo_acesso,
                  nome_demandas, reset_em
             FROM usuario ORDER BY pendente DESC, nome`).all();
        // Pedidos de senha em aberto, para o admin resolver na mesma tela.
        const p = await env.POKER_DB.prepare(
          `SELECT p.id, p.criado_em, u.login, u.nome
             FROM senha_pedido p JOIN usuario u ON u.id = p.usuario_id
            WHERE p.atendido = 0 ORDER BY p.criado_em`).all();
        // Redefinicoes proprias dos ultimos 30 dias. A liberacao e automatica, entao
        // esta lista e o unico lugar onde um abuso apareceria.
        const resets = await env.POKER_DB.prepare(
          `SELECT s.criado_em, s.usado_em, s.ip, u.login, u.nome
             FROM senha_reset s JOIN usuario u ON u.id = s.usuario_id
            WHERE s.criado_em > ? ORDER BY s.criado_em DESC LIMIT 40`)
          .bind(new Date(Date.now() - 30 * 86400 * 1000).toISOString()).all();
        // `nome_sugerido` vai junto de cada conta: e o nome derivado do e-mail, e
        // e o que o Admin oferece quando a pessoa ainda nao tem demanda nenhuma.
        // Derivar aqui, e nao na tela, mantem UMA implementacao da regra — a
        // mesma que o cadastro usa.
        const comSugestao = (r.results || []).map(u => Object.assign({}, u, {
          nome_sugerido: nomeDemandasDoEmail(u.email, u.nome),
        }));
        return json({ ok: true, usuarios: comSugestao, pedidos: p.results || [],
                      resets: resets.results || [] }, 200, headers);
      }

      // Libera um cadastro pendente, ja definindo a permissao.
      if (op === 'aprovar') {
        const login = String(body.login || '').trim().toLowerCase();
        // Papel EXPLICITO, sem padrao. Antes caia em 'dev' quando o corpo nao
        // mandava o campo — e 'dev' GRAVA. A mesma rota de criar conta usava
        // 'consulta' como padrao: dois padroes para a mesma decisao, e o inseguro
        // ficou no caminho mais usado, que e liberar um cadastro pendente.
        //
        // Padrao seguro seria 'consulta', mas exigir e melhor que adivinhar: liberar
        // alguem como somente-leitura sem querer gera um "nao consigo salvar" no dia
        // seguinte. Quem aprova diz o papel.
        if (!PAPEIS.includes(body.papel)) {
          return json({ error: 'papel_obrigatorio',
                        detail: 'Escolha o papel ao liberar o cadastro: ' + PAPEIS.join(', ') + '.' },
                      400, headers);
        }
        const papel = body.papel;
        const uu = await env.POKER_DB.prepare(
          'SELECT id, nome, email, nome_demandas FROM usuario WHERE login = ?').bind(login).first();
        if (!uu) return json({ error: 'nao_encontrado' }, 404, headers);
        // Conta cadastrada ANTES da derivacao automatica nao tem o campo. Aqui e o
        // ultimo momento em que da para preencher sem incomodar ninguem: a pessoa
        // ainda nao entrou.
        let nomeDem = String(uu.nome_demandas || '').trim();
        if (!nomeDem) {
          nomeDem = nomeDemandasDoEmail(uu.email, uu.nome);
          if (nomeDem) {
            await env.POKER_DB.prepare('UPDATE usuario SET nome_demandas = ? WHERE id = ?')
              .bind(nomeDem, uu.id).run();
          }
        }
        await env.POKER_DB.prepare('UPDATE usuario SET pendente = 0, ativo = 1, papel = ? WHERE id = ?')
          .bind(papel, uu.id).run();
        // O nome volta para a tela: e com ele que o Admin acrescenta a pessoa na
        // lista de devs. Sem estar na lista, ninguem consegue atribuir demanda a
        // ela — e o vinculo automatico ficaria apontando para um nome que nao
        // existe em demanda nenhuma.
        return json({ ok: true, nome_demandas: nomeDem, papel }, 200, headers);
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

      // Corrige o nome da pessoa. Nao havia caminho para isto, e o nome nao e
      // cosmetico: aparece no historico do card, na mensagem de commit e na
      // heuristica de posse de quem nao declarou nome nas demandas.
      if (op === 'nome') {
        const login = String(body.login || '').trim().toLowerCase();
        const novo = limpaTexto(body.nome, 80).trim();
        if (novo.length < 3) {
          return json({ error: 'nome', detail: 'Informe o nome completo da pessoa.' }, 400, headers);
        }
        const uu = await env.POKER_DB.prepare('SELECT id FROM usuario WHERE login = ?').bind(login).first();
        if (!uu) return json({ error: 'nao_encontrado' }, 404, headers);
        await env.POKER_DB.prepare('UPDATE usuario SET nome = ? WHERE id = ?').bind(novo, uu.id).run();
        return json({ ok: true, nome: novo }, 200, headers);
      }

      // Define o nome que a conta usa nas demandas. Vazio limpa e volta a heuristica.
      if (op === 'nome-demandas') {
        const login = String(body.login || '').trim().toLowerCase();
        const uu = await env.POKER_DB.prepare('SELECT id FROM usuario WHERE login = ?').bind(login).first();
        if (!uu) return json({ error: 'nao_encontrado' }, 404, headers);
        // Guarda normalizado no separador, nao no texto: o acento e a caixa
        // pertencem ao nome como ele esta na demanda, e a comparacao ja normaliza.
        const nomes = String(body.nome_demandas || '').split(/[\/,;]/)
          .map(x => limpaTexto(x, 80).trim()).filter(Boolean);
        if (nomes.length > 5) {
          return json({ error: 'muitos_nomes',
                        detail: 'No maximo 5 nomes. Se precisa de mais, o campo `dev` das ' +
                                'demandas esta grafado de formas demais e vale padronizar.' }, 400, headers);
        }
        await env.POKER_DB.prepare('UPDATE usuario SET nome_demandas = ? WHERE id = ?')
          .bind(nomes.join(' / ') || null, uu.id).run();
        return json({ ok: true, nome_demandas: nomes.join(' / ') }, 200, headers);
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
      // Nada entra em Concluido sem custo registrado. A recusa vem ANTES de
      // registraHistorico: gravar historico de uma publicacao que sera recusada
      // sujaria a trilha com um evento que nao aconteceu.
      const semHorasPub = entrandoEmConcluidoSemHoras(data, antesPub);
      const semSistemaPub = entrandoAlocadaSemSistema(data, antesPub);
      if (semSistemaPub.length) {
        return json({ error: 'sem_sistema',
                      codigos: semSistemaPub,
                      detail: 'Escolha o sistema antes de planejar: ' + semSistemaPub.join(', ') +
                              '. Sem ele a demanda fica de fora do filtro, do grafico e de ' +
                              'todo relatorio por sistema.' }, 400, headers);
      }
      /* DUAS VIVAS COM O MESMO TITULO NAO ENTRAM. Vem junto das outras guardas,
         antes de `registraHistorico`, para a trilha nao guardar evento de uma
         gravacao que sera recusada. */
      const repetidoPub = criandoTituloRepetido(data, antesPub);
      if (repetidoPub.length) {
        return json({ error: 'titulo_repetido',
                      itens: repetidoPub,
                      detail: 'Já existe demanda viva com este título: ' +
                              repetidoPub.map(r => r.existente + ' — "' + r.titulo + '"').join('; ') +
                              '. Se for a mesma coisa, edite a que existe; se for outra, ' +
                              'diferencie o título.' }, 400, headers);
      }
      const semDevPub = entrandoEmConcluidoSemDev(data, antesPub);
      if (semDevPub.length) {
        return json({ error: 'sem_responsavel',
                      detail: 'Sem responsável para concluir: ' + semDevPub.join(', ') +
                              '. De Planejado em diante toda demanda tem dono — sem ele a '  +
                              'entrega não entra em nenhum relatório por pessoa.' },
                    400, headers);
      }
      if (semHorasPub.length) {
        return json({ error: 'horas_obrigatorias',
                      codigos: semHorasPub,
                      detail: 'Informe as horas de desenvolvimento antes de concluir: ' +
                              semHorasPub.join(', ') + '. A hora e a unica medida de ' +
                              'custo da base — sem ela a entrega entra no relatorio sem preco.' },
                    400, headers);
      }
      // ANTES do historico, de proposito: assim o carimbo automatico do mes
      // tambem vira linha no card. Depois dele, so a marcacao manual apareceria,
      // e a automatica seria um dado que muda sozinho sem deixar rastro.
      // ANTES de limpaDevs, que LE `devs_removidos`: se a chave nao voltou
      // primeiro, a limpeza decide sem saber quem ja tinha saido do time.
      const voltaramPub = preservaChaves(data, antesPub);
      const devsForaPub = await limpaDevs(env, data);
      carimbaMeses(data, antesPub, true);
      registraHistorico(data, antesPub, (_ident && _ident.usuario && _ident.usuario.nome) ||
                        (await papelAtual()) || '', 'painel');
      const espelhos = limpaEspelhos(data);
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
      // `espelhos_descartados` vai na resposta para o descarte nao ser silencioso:
      // se uma tela voltar a mandar espelho, aparece aqui em vez de virar um dado
      // que ninguem sabe explicar de onde veio.
      return json({ ok: true, codigos: codigosMel, codigos_projeto: codigosPrj,
                    sem_dev: semDev, sem_projeto: soltas,
                    espelhos_descartados: espelhos,
                    // Diz o que saiu: limpeza silenciosa vira "sumiu um dev da
                    // lista e ninguem sabe por que".
                    devs_removidos: devsForaPub,
                    // Diz quais chaves a tela nao mandou e o servidor segurou.
                    // Silencio aqui seria uma tela publicando incompleta todo dia
                    // sem ninguem ficar sabendo.
                    chaves_preservadas: voltaramPub,
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
      // Datas de demanda ja comprometida voltam ao valor do servidor. Nao recusa a
      // gravacao inteira: o dev costuma estar salvando OUTRA coisa (horas, texto,
      // anexo) e derrubar tudo por causa de um campo que ele talvez nem tenha
      // tocado seria perder o trabalho dele por um erro que nao e dele.
      const datasRevertidas = travaDatasComprometidas(data, antesDev);
      /* A etapa tambem volta, e pelo mesmo motivo. So para o papel `dev`: analista
         e admin entram por esta rota e para eles mover para Planning e trabalho. */
      const etapasRevertidas = (await papelAtual()) === 'dev'
        ? travaEtapaDoDev(data, antesDev) : [];
      // Entregar sem horas e sem texto e recusado. Aqui a gravacao PARA, ao
      // contrario da trava de datas: la o campo volta ao valor do servidor e o
      // resto segue; aqui nao ha valor anterior para restaurar — a demanda estaria
      // entrando num estado que nao se sustenta, e deixar passar e o que produziu
      // a AX-179.
      const semEntrega = entrandoEmValidacaoSemEntrega(data, antesDev);
      if (semEntrega.length) {
        return json({ error: 'entrega_incompleta',
                      codigos: semEntrega,
                      detail: 'Para entregar (' + semEntrega.join(', ') + ') informe as horas ' +
                              'de desenvolvimento e o que foi implementado. E o que o PM/PO le ' +
                              'para validar.' }, 400, headers);
      }
      // Nada entra em Concluido sem custo registrado. A recusa vem ANTES de
      // registraHistorico: gravar historico de uma publicacao que sera recusada
      // sujaria a trilha com um evento que nao aconteceu.
      const semHorasDev = entrandoEmConcluidoSemHoras(data, antesDev);
      const semSistema = entrandoAlocadaSemSistema(data, antesDev);
      if (semSistema.length) {
        return json({ error: 'sem_sistema',
                      codigos: semSistema,
                      detail: 'Escolha o sistema antes de planejar: ' + semSistema.join(', ') +
                              '. Sem ele a demanda fica de fora do filtro, do grafico e de ' +
                              'todo relatorio por sistema.' }, 400, headers);
      }
      /* DUAS VIVAS COM O MESMO TITULO NAO ENTRAM. Vem junto das outras guardas,
         antes de `registraHistorico`, para a trilha nao guardar evento de uma
         gravacao que sera recusada. */
      const repetidoDev = criandoTituloRepetido(data, antesDev);
      if (repetidoDev.length) {
        return json({ error: 'titulo_repetido',
                      itens: repetidoDev,
                      detail: 'Já existe demanda viva com este título: ' +
                              repetidoDev.map(r => r.existente + ' — "' + r.titulo + '"').join('; ') +
                              '. Se for a mesma coisa, edite a que existe; se for outra, ' +
                              'diferencie o título.' }, 400, headers);
      }
      const semDevDev = entrandoEmConcluidoSemDev(data, antesDev);
      if (semDevDev.length) {
        return json({ error: 'sem_responsavel',
                      detail: 'Sem responsável para concluir: ' + semDevDev.join(', ') +
                              '. De Planejado em diante toda demanda tem dono — sem ele a '  +
                              'entrega não entra em nenhum relatório por pessoa.' },
                    400, headers);
      }
      if (semHorasDev.length) {
        return json({ error: 'horas_obrigatorias',
                      codigos: semHorasDev,
                      detail: 'Informe as horas de desenvolvimento antes de concluir: ' +
                              semHorasDev.join(', ') + '. A hora e a unica medida de ' +
                              'custo da base — sem ela a entrega entra no relatorio sem preco.' },
                    400, headers);
      }
      // ANTES do historico, de proposito: assim o carimbo automatico do mes
      // tambem vira linha no card. Depois dele, so a marcacao manual apareceria,
      // e a automatica seria um dado que muda sozinho sem deixar rastro.
      // ANTES de limpaDevs, que LE `devs_removidos`: se a chave nao voltou
      // primeiro, a limpeza decide sem saber quem ja tinha saido do time.
      const voltaramDev = preservaChaves(data, antesDev);
      const devsForaDev = await limpaDevs(env, data);
      carimbaMeses(data, antesDev, false);
      registraHistorico(data, antesDev, (_ident && _ident.usuario && _ident.usuario.nome) ||
                        (await papelAtual()) || '', 'painel dev');
      const espelhos = limpaEspelhos(data);
      normalizaEstados(data);
      atribuiCodigos(data);
      corrigeProjetoInvalido(data);
      data.atualizado_em = new Date().toISOString();
      const putRes = await gh('contents/' + FILE_PATH, {
        method: 'PUT',
        body: JSON.stringify({ message: 'chore: dev atualiza ' + new Date().toISOString(), content: toB64(JSON.stringify(data)), sha: file.sha }),
      });
      if (!putRes.ok) { const e = await putRes.text(); return json({ error: 'Falha ao salvar', detail: e }, 502, headers); }
      // Diz o que foi revertido: gravar diferente do que a tela mandou e recusar em
      // silencio, e a pessoa so descobriria no proximo F5.
      return json({ ok: true, datas_revertidas: datasRevertidas,
                    etapas_revertidas: etapasRevertidas,
                    espelhos_descartados: espelhos,
                    devs_removidos: devsForaDev,
                    chaves_preservadas: voltaramDev }, 200, headers);
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
    // O CODIGO NASCE AQUI TAMBEM. Esta era a unica rota de escrita que nao chamava
    // `atribuiCodigos`, e por isso a demanda aberta pelo formulario publico ficava
    // sem numero — apareceu no Kanban como card anonimo, e so ganhava codigo se
    // alguem publicasse pelo Admin depois. Sem codigo ela nao tem como ser citada
    // no Teams, no PR, nem na reuniao.
    atribuiCodigos(data);
    data.atualizado_em = new Date().toISOString();

    const putRes = await gh('contents/' + FILE_PATH, {
      method: 'PUT',
      body: JSON.stringify({ message: 'feat: nova sugestao (publico) - ' + nova.titulo, content: toB64(JSON.stringify(data)), sha: file.sha }),
    });
    if (!putRes.ok) { const e = await putRes.text(); return json({ error: 'Falha ao salvar', detail: e }, 502, headers); }
    // Devolve o codigo: quem abriu precisa saber o numero para acompanhar.
    return json({ ok: true, id: nova.id, codigo: nova.codigo }, 200, headers);
  },
};
