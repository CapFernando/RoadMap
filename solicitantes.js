/* ─────────────────────────────────────────────────────────────────────────
   SOLICITANTES — o cadastro de quem pede demanda (18/11/2026).

   POR QUE EXISTE. O campo Solicitante era texto livre, e a base juntou 161
   grafias para bem menos pessoas: "Fernando", "Fernando Nascimento",
   "Fernando Morais do Nascimento"; "Marina e Wend"; "Cobrança"; "xxxx". Filtro
   e relatorio por solicitante nao fecham conta assim.

   O CADASTRO mora na base privada, chave do topo `solicitantes`:
     { id, nome, area, ativo, apelidos: [] }
   `nome` e a grafia oficial, a que vai gravada na demanda. `apelidos` sao os
   textos antigos que apontam para a pessoa (o de-para): "Fernando Nascimento"
   e "fernando morais" -> Fernando Morais Do Nascimento. Quem saiu da empresa
   fica INATIVO: continua nas demandas antigas e nos filtros, mas nao e mais
   oferecido em demanda nova.

   O QUE NAO CASA FICA "PARA RESOLVER" (Configuracoes › Solicitantes): nome que
   serve para duas pessoas, area no lugar de pessoa, duas pessoas no campo.
   Nada aqui adivinha — quem resolve aponta o texto para uma pessoa, e o texto
   vira apelido dela.

   Modulo puro: sem DOM e sem rede. A tela, o formulario e o Quadro usam; a
   suite testa.
   ───────────────────────────────────────────────────────────────────────── */
(function (raiz) {
  'use strict';

  /** Sem acento, minusculas, espacos juntos: a mesma regra de colaboradores.js. */
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function limpo(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  function lista(cad) { return Array.isArray(cad) ? cad.filter(function (p) { return p && p.id && limpo(p.nome); }) : []; }

  /** { textoNormalizado: pessoa }, pelo nome e pelos apelidos. Guardado pela
   *  identidade da lista: o Quadro pergunta por demanda, e a lista so troca
   *  inteira (cada gravacao do cadastro monta uma nova). */
  var _ixDe = null, _ix = null;
  function indice(cad) {
    if (cad && cad === _ixDe && _ix) return _ix;
    var ix = {};
    lista(cad).forEach(function (p) {
      [p.nome].concat(p.apelidos || []).forEach(function (t) {
        var k = norm(t);
        if (k && !ix[k]) ix[k] = p;
      });
    });
    if (Array.isArray(cad)) { _ixDe = cad; _ix = ix; }
    return ix;
  }

  /** A pessoa do cadastro para este texto (nome ou apelido), ou null. */
  function resolve(texto, cad, ix) {
    var k = norm(texto);
    if (!k) return null;
    return (ix || indice(cad))[k] || null;
  }

  /** A chave para agrupar: a pessoa, se o texto casa; senao o proprio texto normalizado. */
  function chave(texto, cad, ix) {
    var p = resolve(texto, cad, ix);
    return p ? 'p:' + p.id : norm(texto);
  }

  /** O nome a mostrar: o oficial, se o texto casa; senao o texto como esta. */
  function rotulo(texto, cad, ix) {
    var p = resolve(texto, cad, ix);
    return p ? p.nome : limpo(texto);
  }

  /** O texto que vai gravado na demanda. Com cadastro, so entra nome (ou
   *  apelido) de pessoa ATIVA, e grava o nome oficial. Sem mudanca (o mesmo
   *  texto de antes, `antes`), passa como esta: corrigir a descricao de uma
   *  demanda antiga nao pode esbarrar no solicitante dela. Cadastro vazio =
   *  o campo livre de sempre. Devolve { ok, nome } ou { ok: false, erro }. */
  function valida(texto, antes, cad) {
    var t = limpo(texto);
    if (!t) return { ok: true, nome: '' };
    if (antes != null && norm(t) === norm(antes)) return { ok: true, nome: String(antes) };
    if (!lista(cad).length) return { ok: true, nome: t };
    var p = resolve(t, cad);
    if (!p) return { ok: false, erro: '"' + t + '" não está no cadastro de solicitantes. Escolha um nome da lista — quem não estiver nela, o admin cadastra em Configurações › Solicitantes.' };
    if (p.ativo === false) return { ok: false, erro: p.nome + ' está inativo no cadastro de solicitantes e não recebe demanda nova.' };
    return { ok: true, nome: p.nome };
  }

  function ativos(cad) {
    return lista(cad).filter(function (p) { return p.ativo !== false; })
      .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
  }

  function vivas(melhorias) {
    return (melhorias || []).filter(function (m) { return m && !m.mesclado_em; });
  }

  /** Os textos das demandas que nao apontam para ninguem: [{ texto, n }], do mais usado. */
  function pendentes(melhorias, cad) {
    var ix = indice(cad), por = {};
    vivas(melhorias).forEach(function (m) {
      var t = limpo(m.solicitante);
      if (!t || ix[norm(t)]) return;
      var k = norm(t);
      var g = por[k] || (por[k] = { texto: t, n: 0 });
      g.n++;
    });
    return Object.keys(por).map(function (k) { return por[k]; })
      .sort(function (a, b) { return b.n - a.n || a.texto.localeCompare(b.texto, 'pt-BR'); });
  }

  /** As demandas cujo texto casa com alguem e esta escrito diferente do nome oficial. */
  function migracao(melhorias, cad) {
    var ix = indice(cad), out = [];
    vivas(melhorias).forEach(function (m) {
      var t = String(m.solicitante || '');
      var p = ix[norm(t)];
      if (p && t !== p.nome) out.push({ id: m.id, codigo: m.codigo || '', de: t, para: p.nome });
    });
    return out;
  }

  /** Quantas demandas cada pessoa tem: { id: n }. */
  function contagem(melhorias, cad) {
    var ix = indice(cad), c = {};
    vivas(melhorias).forEach(function (m) {
      var p = ix[norm(m.solicitante)];
      if (p) c[p.id] = (c[p.id] || 0) + 1;
    });
    return c;
  }

  /** Quem ja usa este texto (nome ou apelido), fora `menosId`. */
  function donoDoTexto(cad, texto, menosId) {
    var k = norm(texto);
    return lista(cad).filter(function (p) {
      return p.id !== menosId && [p.nome].concat(p.apelidos || []).some(function (t) { return norm(t) === k; });
    })[0] || null;
  }

  /** Cria ou edita. `x` = { id?, nome, area, apelidos?: [] | texto com "|" }. */
  function salvar(cad, x, novoId) {
    var base = lista(cad).map(function (p) { return Object.assign({}, p, { apelidos: (p.apelidos || []).slice() }); });
    var nome = limpo(x.nome);
    if (!nome) return { ok: false, erro: 'Informe o nome.', campo: 'nome' };
    var id = x.id || novoId;
    var outro = donoDoTexto(base, nome, id);
    if (outro) return { ok: false, erro: '"' + nome + '" já é ' + (norm(outro.nome) === norm(nome) ? 'o nome' : 'um apelido') + ' de ' + outro.nome + '.', campo: 'nome' };
    var aps = (Array.isArray(x.apelidos) ? x.apelidos : String(x.apelidos || '').split('|')).map(limpo).filter(Boolean);
    var vistos = {}; vistos[norm(nome)] = 1;
    var final = [];
    for (var i = 0; i < aps.length; i++) {
      var k = norm(aps[i]);
      if (vistos[k]) continue;
      var d = donoDoTexto(base, aps[i], id);
      if (d) return { ok: false, erro: 'O apelido "' + aps[i] + '" já aponta para ' + d.nome + '.', campo: 'apelidos' };
      vistos[k] = 1; final.push(aps[i]);
    }
    var atual = base.filter(function (p) { return p.id === id; })[0];
    var novo = Object.assign({}, atual || { ativo: true }, { id: id, nome: nome, area: limpo(x.area), apelidos: final });
    if ('ativo' in x) novo.ativo = x.ativo !== false;
    var out = atual ? base.map(function (p) { return p.id === id ? novo : p; }) : base.concat([novo]);
    return { ok: true, lista: out, pessoa: novo };
  }

  /** Aponta um texto pendente para uma pessoa: o texto vira apelido dela. */
  function apontar(cad, texto, pessoaId) {
    var base = lista(cad);
    var p = base.filter(function (x) { return x.id === pessoaId; })[0];
    if (!p) return { ok: false, erro: 'Escolha a pessoa.' };
    var d = donoDoTexto(base, texto, '');
    if (d) return d.id === p.id ? { ok: true, lista: base, pessoa: p } : { ok: false, erro: '"' + limpo(texto) + '" já aponta para ' + d.nome + '.' };
    return salvar(base, { id: p.id, nome: p.nome, area: p.area, apelidos: (p.apelidos || []).concat([limpo(texto)]) });
  }

  function alternar(cad, id) {
    var achou = false;
    var out = lista(cad).map(function (p) {
      if (p.id !== id) return p;
      achou = true;
      return Object.assign({}, p, { ativo: p.ativo === false });
    });
    return achou ? { ok: true, lista: out } : { ok: false, erro: 'Pessoa não encontrada.' };
  }

  /* IMPORTAR CSV. Cabecalho obrigatorio com `nome`; `area`, `ativo` e
     `apelidos` opcionais. Separador ; (ou tab, ou ,). `ativo`: sim/nao. Os
     apelidos vem separados por "|". Quem ja existe (pelo nome) e atualizado e
     os apelidos se somam; ninguem e apagado. Linha com problema nao para a
     importacao: vai para `erros`, com o numero da linha. */
  function separador(cab) {
    if (cab.indexOf(';') >= 0) return ';';
    if (cab.indexOf('\t') >= 0) return '\t';
    return ',';
  }
  function campos(linha, sep) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < linha.length; i++) {
      var ch = linha[i];
      if (q) {
        if (ch === '"' && linha[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }
  function simNao(v) {
    var k = norm(v);
    if (!k) return null;
    if (['sim', 's', 'true', '1', 'ativo', 'x'].indexOf(k) >= 0) return true;
    if (['nao', 'n', 'false', '0', 'inativo', 'saiu'].indexOf(k) >= 0) return false;
    return undefined;
  }
  function deCSV(texto, cad, gerarId) {
    var linhas = String(texto || '').replace(/^﻿/, '').split(/\r?\n/);
    while (linhas.length && !linhas[0].trim()) linhas.shift();
    if (!linhas.length) return { ok: false, erro: 'O arquivo está vazio.' };
    var sep = separador(linhas[0]);
    var cab = campos(linhas[0], sep).map(norm);
    var ci = { nome: cab.indexOf('nome'), area: cab.indexOf('area'), ativo: cab.indexOf('ativo'), apelidos: cab.indexOf('apelidos') };
    if (ci.area < 0) ci.area = cab.indexOf('departamento');
    if (ci.nome < 0) return { ok: false, erro: 'Falta a coluna "nome" no cabeçalho.' };
    var atual = lista(cad), novos = 0, atualizados = 0, erros = [];
    for (var i = 1; i < linhas.length; i++) {
      if (!linhas[i].trim()) continue;
      var c = campos(linhas[i], sep);
      var nome = limpo(c[ci.nome]);
      if (!nome) { erros.push('linha ' + (i + 1) + ': sem nome'); continue; }
      var at = ci.ativo >= 0 ? simNao(c[ci.ativo]) : null;
      if (at === undefined) { erros.push('linha ' + (i + 1) + ': "ativo" deve ser sim ou não'); continue; }
      var ja = atual.filter(function (p) { return norm(p.nome) === norm(nome); })[0];
      var aps = ci.apelidos >= 0 ? String(c[ci.apelidos] || '').split('|').map(limpo).filter(Boolean) : [];
      var x = {
        id: ja ? ja.id : gerarId(),
        nome: ja ? ja.nome : nome,
        area: ci.area >= 0 && limpo(c[ci.area]) ? limpo(c[ci.area]) : (ja ? ja.area : ''),
        apelidos: (ja ? ja.apelidos || [] : []).concat(aps)
      };
      if (at !== null) x.ativo = at;
      var r = salvar(atual, x, x.id);
      if (!r.ok) { erros.push('linha ' + (i + 1) + ': ' + r.erro); continue; }
      atual = r.lista;
      if (ja) atualizados++; else novos++;
    }
    return { ok: true, lista: atual, novos: novos, atualizados: atualizados, erros: erros };
  }

  var api = {
    norm: norm, indice: indice, resolve: resolve, valida: valida, chave: chave, rotulo: rotulo, ativos: ativos,
    pendentes: pendentes, migracao: migracao, contagem: contagem,
    salvar: salvar, apontar: apontar, alternar: alternar, deCSV: deCSV
  };
  raiz.SOLICITANTES = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
