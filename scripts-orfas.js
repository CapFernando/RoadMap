/* ─────────────────────────────────────────────────────────────────────────
   IDENTIFICADOR USADO E NUNCA DECLARADO — a varredura que faltava.

   ═════════════════════════════════════════════════════════════════════════
   POR QUE ESTE ARQUIVO EXISTE.

   O deck Gerencial parou de gerar em produção com `dentro is not defined`.

   O que aconteceu: a conta da fila saiu do `admin.html` para `fila.js`, e o
   bloco removido carregava uma função auxiliar — `dentro(v)` — que outro
   trecho, trinta linhas abaixo, continuava chamando. O arquivo continuou
   sintaticamente válido, `node --check` passou, as ~2100 invariantes passaram,
   o CI passou, e o defeito só apareceu quando alguém clicou em "Gerar
   apresentação".

   ESSA É A LACUNA: nada aqui executa `apresGerar` — ela depende do DOM e de
   dados reais. Uma referência órfã dentro dela é invisível até o clique.

   ═════════════════════════════════════════════════════════════════════════
   POR QUE UM PARSER, E NÃO REGEX.

   A primeira versão disto procurava declarações com expressão regular e
   acusou 23 falsos positivos de uma vez — funções que existiam no topo do
   arquivo, mas cujo reconhecimento morria num backtick de template literal.
   Um verificador em que não se confia não é verificação, é ruído: a pessoa
   aprende a ignorar a saída, e aí ele deixa de valer para o dia em que estiver
   certo. Com `acorn`, o escopo é o escopo de verdade — `var` sobe para a
   função, `let`/`const` ficam no bloco, parâmetros contam, desestruturação
   conta.

   ═════════════════════════════════════════════════════════════════════════
   POR QUE ELE NÃO ESTÁ DENTRO DE `teste-invariantes.js`.

   Este repositório não tem empacotador nem dependências — está escrito no
   `ci.yml` e é uma propriedade, não um descuido: `node teste-invariantes.js`
   roda em qualquer máquina com Node e mais nada. Pôr `acorn` lá dentro
   quebraria isso para todo mundo. Então a dependência fica aqui, instalada na
   hora pelo CI (`npm i --no-save acorn acorn-walk`), e o gate continua sendo
   dois comandos independentes.

   USO:  node scripts-orfas.js            (todos os alvos)
         node scripts-orfas.js admin.html (um arquivo)
   ───────────────────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');

let acorn, walk;
try {
  acorn = require('acorn');
  walk = require('acorn-walk');
} catch (_) {
  console.error('Esta varredura precisa do parser:  npm i --no-save acorn acorn-walk');
  process.exit(2);
}

/* O QUE O NAVEGADOR JÁ DÁ. Lista curta de propósito: cada nome aqui é um nome
   que o verificador deixa de checar, então engordá-la por conveniência é abrir
   buraco. Entra o que o navegador realmente expõe, e nada mais. */
const DO_NAVEGADOR = new Set([
  'window', 'document', 'console', 'localStorage', 'sessionStorage', 'navigator',
  'location', 'history', 'screen', 'event', 'fetch', 'alert', 'confirm', 'prompt',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'matchMedia',
  'Math', 'JSON', 'Date', 'Object', 'Array', 'String', 'Number', 'Boolean',
  'Set', 'Map', 'WeakMap', 'WeakSet', 'Promise', 'RegExp', 'Error', 'TypeError',
  'RangeError', 'Symbol', 'Proxy', 'Reflect', 'Intl', 'URL', 'URLSearchParams',
  'Blob', 'File', 'FileReader', 'FormData', 'Headers', 'Request', 'Response',
  'AbortController', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver',
  'CustomEvent', 'Event', 'Image', 'Audio', 'DOMParser', 'XMLHttpRequest',
  'parseInt', 'parseFloat', 'isFinite', 'isNaN', 'encodeURIComponent',
  'decodeURIComponent', 'encodeURI', 'decodeURI', 'btoa', 'atob', 'structuredClone',
  'Uint8Array', 'Int8Array', 'Uint16Array', 'Uint32Array', 'Float32Array', 'Float64Array',
  'ArrayBuffer', 'DataView', 'TextEncoder', 'TextDecoder', 'crypto', 'performance',
  'globalThis', 'undefined', 'NaN', 'Infinity', 'arguments', 'queueMicrotask',
  'module', 'require', 'exports', 'process', 'BigInt',
  // Herdados e pouco usados, mas reais: `unescape` (legado, vive no decode de
  // base64 com acento) e `CSS` (CSS.escape / CSS.supports).
  'unescape', 'escape', 'CSS',
]);

/* BIBLIOTECAS DE TERCEIROS carregadas por CDN — não há arquivo local para ler. */
const DE_CDN = new Set(['Chart', 'ChartDataLabels', 'PptxGenJS', 'html2canvas',
                        'turnstile']);   // Cloudflare Turnstile, no index

const ALVOS = ['admin.html', 'dev.html', 'gantt.html', 'index.html', 'poker.html',
               'follow.html', 'mensageria.html', 'projetos.html',
               'apresentacao.js', 'relatorio-ppt.js', 'fila.js', 'vinculo.js',
               'prazo.js', 'capacidade.js', 'catalogo.js', 'pipelines.js',
               'etapa-demanda.js', 'busca-demanda.js', 'leitura-estado.js',
               'dev-nome.js', 'resumo-dev.js'];

const RAIZ = __dirname;

function lerScriptsInline(html) {
  const out = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function lerScriptsExternos(html) {
  const out = [];
  const re = /<script[^>]*\bsrc="([^"?]+)(?:\?[^"]*)?"/gi;
  let m;
  while ((m = re.exec(html))) if (!/^https?:/i.test(m[1])) out.push(m[1]);
  return out;
}

/** Os nomes que um arquivo .js PUBLICA: declarações de topo e o que ele pendura
 *  em `window` / na raiz. É o que um `<script src>` passa a oferecer à página. */
function exportadosDe(arquivo) {
  const nomes = new Set();
  let txt;
  try { txt = fs.readFileSync(path.join(RAIZ, arquivo), 'utf8'); } catch (_) { return nomes; }
  let ast;
  try { ast = acorn.parse(txt, { ecmaVersion: 2022, sourceType: 'script' }); }
  catch (_) { return nomes; }
  for (const no of ast.body) {
    if (no.type === 'FunctionDeclaration' && no.id) nomes.add(no.id.name);
    if (no.type === 'VariableDeclaration') {
      no.declarations.forEach(d => { if (d.id.type === 'Identifier') nomes.add(d.id.name); });
    }
  }
  // `window.X = ...`, `raiz.X = ...` — o padrão dos arquivos de regra daqui
  walk.simple(ast, {
    AssignmentExpression(n) {
      if (n.left.type === 'MemberExpression' && !n.left.computed &&
          n.left.property.type === 'Identifier' &&
          n.left.object.type === 'Identifier' &&
          /^(window|raiz|globalThis|self)$/.test(n.left.object.name)) {
        nomes.add(n.left.property.name);
      }
    },
    // `raiz.REGRA = { a: ..., b: ... }` publica REGRA, e é assim que as regras
    // compartilhadas aparecem nas páginas.
    Property() {},
  });
  return nomes;
}

function ehEscopo(n) {
  return /Function|Program|BlockStatement|ForStatement|ForInStatement|ForOfStatement|CatchClause|SwitchStatement/.test(n.type);
}

function naoDeclarados(codigo, conhecidos) {
  let ast;
  try { ast = acorn.parse(codigo, { ecmaVersion: 2022, sourceType: 'script', locations: true }); }
  catch (e) { return [{ nome: '(erro de sintaxe) ' + e.message, linha: e.loc ? e.loc.line : 0 }]; }

  const escopos = new Map();
  const pais = new Map();
  const declara = (no, nome) => {
    if (!escopos.has(no)) escopos.set(no, new Set());
    escopos.get(no).add(nome);
  };
  const doPadrao = (p, add) => {
    if (!p) return;
    if (p.type === 'Identifier') add(p.name);
    else if (p.type === 'ObjectPattern') p.properties.forEach(pr => doPadrao(pr.value || pr.argument, add));
    else if (p.type === 'ArrayPattern') p.elements.forEach(e => doPadrao(e, add));
    else if (p.type === 'AssignmentPattern') doPadrao(p.left, add);
    else if (p.type === 'RestElement') doPadrao(p.argument, add);
  };
  const escopoDe = (no, sofuncao) => {
    let a = no;
    while (a && !(ehEscopo(a) && (!sofuncao || /Function|Program/.test(a.type)))) a = pais.get(a);
    return a;
  };

  (function visita(no, pai) {
    if (!no || typeof no.type !== 'string') return;
    pais.set(no, pai);
    if (ehEscopo(no) && !escopos.has(no)) escopos.set(no, new Set());
    if (/Function/.test(no.type)) {
      if (no.id && no.type !== 'FunctionDeclaration') declara(no, no.id.name);
      no.params.forEach(p => doPadrao(p, n => declara(no, n)));
    }
    if (no.type === 'CatchClause' && no.param) doPadrao(no.param, n => declara(no, n));
    for (const k of Object.keys(no)) {
      if (k === 'type' || k === 'loc' || k === 'start' || k === 'end') continue;
      const v = no[k];
      if (Array.isArray(v)) v.forEach(x => x && typeof x.type === 'string' && visita(x, no));
      else if (v && typeof v.type === 'string') visita(v, no);
    }
  })(ast, null);

  // segunda passada: declarações, agora que a árvore de pais existe
  walk.full(ast, (no) => {
    if (no.type === 'VariableDeclaration') {
      const alvo = escopoDe(pais.get(no), no.kind === 'var') || ast;
      no.declarations.forEach(d => doPadrao(d.id, n => declara(alvo, n)));
    }
    if ((no.type === 'FunctionDeclaration' || no.type === 'ClassDeclaration') && no.id) {
      const alvo = escopoDe(pais.get(no), false) || ast;
      declara(alvo, no.id.name);
    }
  });

  const visiveis = (no) => {
    const set = new Set();
    let cur = no;
    while (cur) { (escopos.get(cur) || []).forEach(n => set.add(n)); cur = pais.get(cur); }
    return set;
  };

  const achados = [];
  walk.ancestor(ast, {
    Identifier(no, _st, anc) {
      const pai = anc[anc.length - 2];
      if (!pai) return;
      if (pai.type === 'MemberExpression' && pai.property === no && !pai.computed) return;
      if (pai.type === 'Property' && pai.key === no && !pai.computed) return;
      if (pai.type === 'VariableDeclarator' && pai.id === no) return;
      if (/Function|Class/.test(pai.type) && (pai.id === no || (pai.params || []).includes(no))) return;
      if (/LabeledStatement|BreakStatement|ContinueStatement/.test(pai.type)) return;
      if (pai.type === 'ExportSpecifier' || pai.type === 'ImportSpecifier') return;
      if (conhecidos.has(no.name)) return;
      const esc = escopoDe(anc[anc.length - 2], false) || ast;
      if (visiveis(esc).has(no.name)) return;
      achados.push({ nome: no.name, linha: no.loc.start.line });
    },
  });
  return achados;
}

const alvos = process.argv.slice(2).length ? process.argv.slice(2) : ALVOS;
let problemas = 0;

for (const alvo of alvos) {
  let txt;
  try { txt = fs.readFileSync(path.join(RAIZ, alvo), 'utf8'); } catch (_) { continue; }
  const conhecidos = new Set([...DO_NAVEGADOR, ...DE_CDN]);
  let pedacos;
  if (/\.html$/.test(alvo)) {
    lerScriptsExternos(txt).forEach(js => exportadosDe(js).forEach(n => conhecidos.add(n)));
    pedacos = lerScriptsInline(txt);
  } else {
    pedacos = [txt];
  }
  const vistos = new Map();
  pedacos.forEach(c => naoDeclarados(c, conhecidos)
    .forEach(x => { if (!vistos.has(x.nome)) vistos.set(x.nome, x.linha); }));
  if (vistos.size) {
    problemas += vistos.size;
    console.log('\n' + alvo);
    [...vistos.entries()].sort((a, b) => a[1] - b[1])
      .forEach(([n, l]) => console.log('   linha ' + l + '  —  ' + n + ' é usado e nunca declarado'));
  } else {
    console.log('ok  ' + alvo);
  }
}

console.log('\n' + (problemas
  ? problemas + ' IDENTIFICADOR(ES) SEM DECLARAÇÃO'
  : 'nenhum identificador órfão'));
process.exit(problemas ? 1 : 0);
