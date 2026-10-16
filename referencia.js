/* ═══ LINKS DE REFERÊNCIA DA DEMANDA ═══════════════════════════════════════
 *
 * "Campos de links de referência, para podermos colocar uma descrição e link,
 *  e poder adicionar vários links por meio de um botão +."
 *
 * O DADO É UMA LISTA DE `{ descricao, url }`. Não reaproveita `link_issue` /
 * `link_pr` / `link_milestone`: aqueles três são campos FIXOS do GitHub, com
 * significado próprio em relatório e no card. Estes são livres — a planilha do
 * cliente, o Figma, o chamado no Bitrix, a thread do Teams.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SÓ `http` E `https`, E ISSO NÃO É ZELO EXCESSIVO.
 *
 * O link vira `<a href>` em três telas. `javascript:alert(1)` num href é
 * execução de script na origem de quem abriu — e esta base já teve XSS por
 * texto vindo de fora: o `<img src=x onerror=...>` no título, que rodava no
 * navegador do Admin, onde a credencial vive. O título foi limpo na ENTRADA
 * por causa disso. Um campo que é href por natureza não pode nascer sem a
 * mesma regra.
 *
 * `data:` fica de fora pelo mesmo motivo, e `mailto:`/`tel:` porque não são o
 * que o campo existe para guardar — quem quiser um e-mail escreve na
 * descrição.
 *
 * A DESCRIÇÃO É OBRIGATÓRIA NA PRÁTICA: link sem descrição vira uma fileira de
 * URLs que ninguém lê. Quando ela falta, o host entra no lugar — é a pior
 * descrição possível, mas ainda diz para onde o link vai.
 */
(function (raiz) {
  'use strict';

  var MAX_LINKS = 20;
  var MAX_DESC = 120;
  var MAX_URL = 500;

  /** A URL, se for aceitável. '' quando não for — e '' faz o link inteiro ser
   *  descartado: meia referência é pior que nenhuma. */
  function limpaUrl(v) {
    var s = String(v == null ? '' : v).trim().slice(0, MAX_URL);
    if (!s) return '';
    /* SEM ESQUEMA, ASSUME `https://`. Quem cola "docs.google.com/..." não está
       pedindo um link relativo — está colando um endereço. Sem isto o href
       sairia relativo ao próprio painel e levaria a lugar nenhum. */
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) s = 'https://' + s;
    var esquema = (/^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(s) || [, ''])[1].toLowerCase();
    if (esquema !== 'http' && esquema !== 'https') return '';
    /* E O ENDEREÇO TEM DE SER VÁLIDO. `https://` sozinho passa na checagem de
       esquema e não é link nenhum. */
    try {
      var u = new URL(s);
      if (!u.hostname || u.hostname.indexOf('.') < 0) return '';
      return u.href.slice(0, MAX_URL);
    } catch (_) { return ''; }
  }

  function limpaDesc(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, MAX_DESC);
  }

  /** O host, para servir de descrição quando ela faltar. */
  function host(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return ''; }
  }

  /** A LISTA DE UMA DEMANDA, normalizada, sem repetida e sem link inválido.
   *
   *  Aceita o que vier da base — `null` no meio do array já aconteceu com
   *  `subtarefas`, e o remédio é o mesmo. */
  function daDemanda(m) {
    var bruto = (m || {}).links;
    if (!Array.isArray(bruto)) return [];
    var vistos = {};
    var fora = [];
    bruto.forEach(function (x) {
      if (!x || typeof x !== 'object') return;
      var url = limpaUrl(x.url || x.link);
      if (!url) return;
      if (vistos[url]) return;
      vistos[url] = true;
      fora.push({ descricao: limpaDesc(x.descricao || x.titulo) || host(url), url: url });
    });
    return fora.slice(0, MAX_LINKS);
  }

  var api = { MAX_LINKS: MAX_LINKS, MAX_DESC: MAX_DESC, MAX_URL: MAX_URL,
              limpaUrl: limpaUrl, limpaDesc: limpaDesc, host: host,
              daDemanda: daDemanda };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.REFERENCIA = api;
}(typeof window !== 'undefined' ? window : this));
