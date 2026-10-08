/* ═══ O QUE PODE SER ANEXADO, E COMO ELE VOLTA ══════════════════════════════
 *
 * "em projetos, preciso anexar arquivos excalidraw e hoje nao me permite.
 *  Tambem necessito de outros formatos, pode abrir?"
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUE A LISTA ERA FECHADA EM PDF/JPEG/PNG.
 *
 * O anexo e aberto com `window.open(URL.createObjectURL(blob))`, e um `blob:`
 * HERDA A ORIGEM da pagina. Um `.svg` ou um `.html` anexado executaria script
 * dentro do Admin, com acesso a sessao de quem abriu. A lista curta era a
 * unica defesa — e por isso cada formato novo virava uma decisao de seguranca.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * O QUE MUDA: A DEFESA SAI DA LISTA E VAI PARA O MODO DE ABRIR.
 *
 * So cinco tipos abrem DENTRO do navegador — os que ele sabe desenhar sem
 * executar nada. Todo o resto e BAIXADO, e arquivo baixado nao roda na origem
 * de ninguem. Com isso o formato deixa de ser questao de seguranca e vira o que
 * sempre deveria ter sido: uma lista do que a equipe usa.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * E QUEM DECIDE E A EXTENSAO, NAO O QUE O NAVEGADOR DISSE.
 *
 * Dois motivos, e o primeiro e a razao de o `.excalidraw` nao subir hoje:
 *
 *   1. `.excalidraw` e `.drawio` NAO TEM tipo registrado. O navegador manda
 *      `type` vazio, o `readAsDataURL` produz `data:;base64,...`, e a expressao
 *      do Worker exige um tipo — a recusa vinha antes de qualquer lista.
 *   2. O tipo declarado vem do cliente e pode ser qualquer coisa. Guardar o que
 *      ele disse seria deixa-lo escolher como o arquivo volta.
 *
 * Entao a extensao decide se entra, e o tipo guardado sai de um mapa fixo daqui.
 */
(function (raiz) {
  'use strict';

  /* ABREM NO NAVEGADOR. Formatos que o navegador desenha sem executar script.
     SVG NAO ESTA AQUI de proposito: ele e XML e aceita `<script>` dentro. */
  var INLINE = {
    'pdf':  'application/pdf',
    'jpg':  'image/jpeg',
    'jpeg': 'image/jpeg',
    'png':  'image/png',
    'gif':  'image/gif',
    'webp': 'image/webp',
  };

  /* BAIXAM. O tipo aqui e so para o arquivo chegar com a cara certa ao abrir
     fora; nenhum deles e renderizado pela nossa tela. */
  var BAIXA = {
    'excalidraw': 'application/json',
    'drawio': 'application/xml',
    'svg':  'image/svg+xml',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'csv':  'text/csv',
    'txt':  'text/plain',
    'md':   'text/markdown',
    'json': 'application/json',
    'zip':  'application/zip',
    /* HTML, PARA O DEV ANEXAR ESTUDO E SPIKE.
     *
     * Ele entra EXATAMENTE como o `svg` entrou, e pelo mesmo motivo: o perigo
     * do HTML nunca foi o formato, foi o modo de abrir. O comentário no topo
     * deste arquivo já o nomeia — "um `.svg` ou um `.html` anexado executaria
     * script dentro do Admin, com acesso à sessão de quem abriu". Era verdade
     * quando a defesa era a lista curta; deixou de ser quando a defesa virou o
     * `entrega`, que embrulha tudo que não é INLINE em `octet-stream` e baixa.
     *
     * NUNCA MOVER PARA `INLINE`. Um `.html` aberto em aba a partir de um `blob:`
     * roda script na origem de quem abriu — e um estudo de spike costuma vir de
     * uma ferramenta de fora, que é justamente o arquivo em que ninguém olhou o
     * conteúdo. Baixado, ele abre no navegador como arquivo local, fora da
     * origem do painel, e lá não alcança sessão nenhuma.
     *
     * `htm` vai junto: é o mesmo formato, e aceitar um e recusar o outro faria a
     * recusa parecer defeito. */
    'html': 'text/html',
    'htm':  'text/html',
  };

  function ext(nome) {
    var m = /\.([A-Za-z0-9]+)$/.exec(String(nome || ''));
    return m ? m[1].toLowerCase() : '';
  }

  function permitido(nome) {
    var e = ext(nome);
    return !!(INLINE[e] || BAIXA[e]);
  }

  /* O TIPO QUE SE GUARDA. Sai da extensao, e nunca do que o cliente declarou. */
  function tipoDe(nome) {
    var e = ext(nome);
    return INLINE[e] || BAIXA[e] || '';
  }

  /* ABRE NA TELA OU BAIXA? Perguntado pelo TIPO GUARDADO, e nao pelo nome: e
     assim que o anexo antigo — que so tem o tipo, gravado antes desta regra —
     tambem responde certo. */
  function abreNaTela(tipo) {
    var t = String(tipo || '').toLowerCase();
    for (var e in INLINE) { if (INLINE[e] === t) return true; }
    return false;
  }

  /* A frase da recusa mora aqui, pelo mesmo motivo do `abertura.js`: sao quatro
     telas, e quatro redacoes da mesma regra ensinam que ela depende da tela. */
  function lista() {
    var todas = [];
    for (var a in INLINE) todas.push(a);
    for (var b in BAIXA) todas.push(b);
    // 'jpg' e 'jpeg' sao o mesmo formato para quem le.
    return todas.filter(function (x) { return x !== 'jpeg'; }).sort();
  }
  /** O `accept` DO SELETOR DE ARQUIVO, saído da mesma lista.
   *
   *  Ele estava escrito à mão em cinco telas, e tinha ficado para trás: dizia
   *  `.pdf,.jpg,.jpeg,.png` muito depois de excalidraw, docx e zip passarem a
   *  ser aceitos. A regra abriu e o seletor não — quem fosse anexar um
   *  `.excalidraw` via o arquivo cinza na janela e concluía que não dava, sem
   *  nunca chegar à mensagem que explicaria.
   *
   *  Escrito à mão, isso acontece de novo no próximo formato. Daqui, não. */
  function aceita() {
    return lista().map(function (e) { return '.' + e; })
      .concat(['.jpeg'])   // par de `.jpg`, tirado de `lista()` por ser o mesmo formato
      .join(',');
  }

  function recusa(nome) {
    return '"' + (nome || 'arquivo') + '" não foi anexado. Aceitamos: ' +
           lista().join(', ') + '.';
  }

  /* ═══ COMO O ANEXO CHEGA A PESSOA ═════════════════════════════════════════
   *
   * ESTA E A DEFESA, e nao a lista de formatos.
   *
   * `window.open(URL.createObjectURL(blob))` abre o blob HERDANDO A ORIGEM da
   * pagina. Com um `.svg` ou um `.html` dentro, o arquivo executa script no
   * Admin, com a sessao de quem clicou. Era isso que a lista curta evitava.
   *
   * Aqui o que nao e imagem nem PDF e BAIXADO — e arquivo baixado nao roda na
   * origem de ninguem. Duas camadas, porque uma so seria suposicao:
   *   1. o tipo do blob vira `application/octet-stream`, entao mesmo aberto o
   *      navegador nao renderiza;
   *   2. `<a download>`, para o arquivo ir direto para a pasta com o nome certo.
   *
   * Uma funcao so, usada pelas cinco telas: cinco `window.open` soltos era o
   * que existia, e bastaria um ficar para tras. */
  function entrega(blob, nome, tipo, janela) {
    var doc = (janela || (typeof window !== 'undefined' ? window : {})).document;
    if (abreNaTela(tipo)) {
      janela.open(janela.URL.createObjectURL(blob), '_blank');
      return 'tela';
    }
    var seguro = new janela.Blob([blob], { type: 'application/octet-stream' });
    var url = janela.URL.createObjectURL(seguro);
    var a = doc.createElement('a');
    a.href = url;
    a.download = String(nome || 'anexo');
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    // Solta o endereco depois do clique: mantido, ele segura o arquivo inteiro
    // na memoria da aba ate ela fechar.
    janela.setTimeout(function () { janela.URL.revokeObjectURL(url); }, 30000);
    return 'baixou';
  }

  var api = { INLINE: INLINE, BAIXA: BAIXA, ext: ext, permitido: permitido,
              tipoDe: tipoDe, abreNaTela: abreNaTela, lista: lista, aceita: aceita, recusa: recusa,
              entrega: entrega };

  /* E O PROPRIO MODULO PREENCHE OS SELETORES. Qualquer `<input type="file">`
     marcado com `data-anexo-accept` recebe a lista ao carregar a pagina. Sem
     isto, cada tela teria de lembrar de chamar `aceita()` — e lembrar em cinco
     lugares e exatamente o que fez a lista antiga ficar para tras.

     `DOMContentLoaded` ja passou? Entao o HTML ja esta de pe e preenche na
     hora: este arquivo pode ser carregado depois do corpo da pagina. */
  function ligaSeletores(doc) {
    if (!doc || !doc.querySelectorAll) return 0;
    var ns = doc.querySelectorAll('input[type="file"][data-anexo-accept]');
    for (var i = 0; i < ns.length; i++) ns[i].setAttribute('accept', aceita());
    return ns.length;
  }
  api.ligaSeletores = ligaSeletores;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { ligaSeletores(document); });
    } else { ligaSeletores(document); }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.ANEXOTIPO = api;
}(typeof window !== 'undefined' ? window : this));
