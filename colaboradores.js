/* ─────────────────────────────────────────────────────────────────────────
   QUEM PEDIU — escolhido da lista de colaboradores, e gravado com o e-mail.

   ═════════════════════════════════════════════════════════════════════════
   POR QUE ESTE ARQUIVO EXISTE.

   O campo Solicitante era texto livre: "Fulano", "fulano", "Fulano (Cobrança)",
   "área de cobrança". Para a homologação servia — uma pessoa lê e entende. Para
   o que vem depois, não: o aviso pelo AXCred precisa de um ENDEREÇO, e nome
   digitado à mão não é endereço de ninguém.

   A lista vem do WorkOS (todos os colaboradores ativos), pelo Worker — a tela
   nunca fala com o WorkOS direto, e a credencial de lá nunca chega aqui. O
   Worker devolve só nome e e-mail; o resto do cadastro fica do lado de lá.

   ═════════════════════════════════════════════════════════════════════════
   O QUE ESTE MÓDULO NÃO FAZ, e por quê.

   NÃO OBRIGA a escolher da lista. São demandas antigas com solicitante digitado,
   pedidos que chegam de área ("Cobrança") e de gente de fora. Recusar o texto
   livre prenderia quem só queria corrigir uma descrição. O que muda é que, quando
   o nome É de um colaborador, o e-mail vai junto — e quando não é, vai vazio, em
   vez de um e-mail adivinhado.

   NÃO CASA NOME PARCIAL ao gravar. "Ana" não vira "Ana Paula": o e-mail decide a
   quem o aviso chega, e mandar para a pessoa errada é pior que não mandar. A
   sugestão enquanto se digita é do `<datalist>`; o e-mail só sai de nome inteiro.
   ───────────────────────────────────────────────────────────────────────── */
(function (raiz) {
  'use strict';

  var ID_LISTA = 'colab-lista';
  var _lista = [];
  var _carga = null;

  // A mesma normalização do `dev-nome.js` e do Worker: sem acento, minúsculas,
  // espaços juntos. "joao  da silva" e "João da Silva" são a mesma pessoa.
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /** O colaborador cujo NOME INTEIRO é este texto, ou null. */
  function acha(lista, texto) {
    var alvo = norm(texto);
    if (!alvo) return null;
    for (var i = 0; i < (lista || []).length; i++) {
      var c = lista[i];
      if (c && norm(c.nome) === alvo) return c;
    }
    return null;
  }

  /** O e-mail a gravar junto do nome.
   *
   *  `antes` é a demanda como estava gravada. Ela entra porque a lista pode não
   *  ter chegado (WorkOS fora, Worker sem configuração): sem ela, salvar a
   *  demanda por qualquer outro motivo APAGARIA o e-mail que já estava lá. Nome
   *  igual ao gravado mantém o e-mail gravado; nome novo sem par na lista fica
   *  sem e-mail. */
  function emailPara(nome, antes, lista) {
    var c = acha(lista || _lista, nome);
    if (c) return c.email;
    if (antes && norm(antes.solicitante) && norm(antes.solicitante) === norm(nome)) {
      return String(antes.solicitante_email || '');
    }
    return '';
  }

  function garanteDatalist() {
    var dl = document.getElementById(ID_LISTA);
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = ID_LISTA;
      document.body.appendChild(dl);
    }
    return dl;
  }

  function preenche() {
    var dl = garanteDatalist();
    // Só o `value`, sem rótulo: num <datalist> os dois aparecem e cada nome
    // sairia duas vezes na lista (ver a nota do `fBusca` no index.html).
    dl.innerHTML = _lista.map(function (c) {
      return '<option value="' + String(c.nome).replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;').replace(/</g, '&lt;') + '"></option>';
    }).join('');
  }

  /** Busca a lista UMA vez por página. Falhar não derruba nada: o campo segue
   *  aceitando texto, só que sem sugestão — que é como ele era até hoje. */
  function carrega(proxyUrl, credenciais) {
    if (_carga) return _carga;
    _carga = fetch(proxyUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action: 'colaboradores' }, credenciais || {})),
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && Array.isArray(d.colaboradores)) {
          _lista = d.colaboradores;
          preenche();
        }
        if (d && d.consultado === false && raiz.console) {
          console.warn('[colaboradores] lista indisponivel:', d.motivo || '');
        }
        // Recusa (sessao que caiu) ou lista que nao veio: o proximo foco no
        // campo tenta de novo, em vez de a pagina ficar sem sugestao ate o F5.
        if (!_lista.length) _carga = null;
        return _lista;
      })
      .catch(function () { _carga = null; return _lista; });
    return _carga;
  }

  /** Liga um campo de texto à lista: sugere enquanto se digita e, ao sair do
   *  campo, reescreve o que foi digitado com o nome como está no cadastro —
   *  quem digita "joao da silva" vê "João da Silva" e sabe que acertou.
   *
   *  A lista é pedida no FOCO, e não ao abrir a página: na abertura a pessoa
   *  ainda pode não ter entrado, e o Worker recusaria a chamada sem sessão.
   *  `credenciais` é função pelo mesmo motivo — lida na hora do pedido. */
  function ligar(input, proxyUrl, credenciais) {
    if (!input || input.dataset.colab) return;
    input.dataset.colab = '1';
    garanteDatalist();
    input.setAttribute('list', ID_LISTA);
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('focus', function () {
      carrega(proxyUrl, typeof credenciais === 'function' ? credenciais() : credenciais);
    });
    input.addEventListener('change', function () {
      var c = acha(_lista, input.value);
      if (c) input.value = c.nome;
      input.title = c ? c.email : '';
    });
  }

  raiz.COLABORADORES = {
    norm: norm,
    acha: acha,
    emailPara: emailPara,
    carrega: carrega,
    ligar: ligar,
    lista: function () { return _lista; },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.COLABORADORES;
})(typeof globalThis !== 'undefined' ? globalThis : this);
