/* ─────────────────────────────────────────────────────────────────────────
   ACHAR A DEMANDA PELO QUE A PESSOA TEM NA MAO

   Ela chega de tres jeitos, e nenhum deles e escolha de quem procura:

     AX-042   o codigo, que vem do card e do commit
     #042     o mesmo codigo escrito como o time fala, com cerquilha
     #1087    o numero da ISSUE no GitHub, que e o que aparece no PR

   O `#` NAO DIZ QUAL DOS DOIS E. "#157" pode ser a AX-157 e pode ser a issue
   157 — as duas numeracoes existem e se cruzam. Entao tenta-se o codigo
   primeiro (e a identificacao da propria plataforma) e a issue depois, e a
   resposta DIZ QUAL CASOU: sem isso, quem procurou a issue 157 e recebeu a
   AX-157 nao tem como perceber que veio outra coisa.

   Na base de producao sao 25 demandas com `link_issue`, de 353 vivas. Procurar
   so por issue acharia quase nada; procurar so por codigo deixaria de fora
   justamente o numero que o dev tem no navegador aberto.

   ───────────────────────────────────────────────────────────────────────────
   POR QUE ESTE ARQUIVO EXISTE

   A mesma regra roda em dois lugares: no Worker (`demanda-consultar`, para quem
   automatiza) e na tela do dev (que ja tem a base inteira em memoria e nao
   precisa de ida ao servidor). Duas copias de uma regra de casamento e o comeco
   de as duas discordarem — e a divergencia seria muda: a tela acharia e a API
   nao, ou o contrario, e ninguem saberia qual das duas acreditar.

   O Worker e um bundle e nao importa arquivo daqui, entao a copia dele e
   inevitavel. O que NAO e inevitavel e ela divergir: `teste-invariantes.js` roda
   as DUAS implementacoes contra os mesmos casos e exige a mesma resposta.
   ───────────────────────────────────────────────────────────────────────────*/
(function (raiz) {
  'use strict';

  /** Só os dígitos. "AX-042" vira "042", "#1087" vira "1087". */
  function soDigitos(t) {
    return String(t == null ? '' : t).replace(/\D+/g, '');
  }

  /** O CÓDIGO, nas formas que a pessoa digita.
   *
   *  Aceita "AX-042", "ax042", "#042", "042" e "42".
   *
   *  O NÚMERO É COMPARADO COMO NÚMERO. Os códigos têm zero à esquerda e quem
   *  digita escreve "42" — comparar as strings deixava a demanda invisível para
   *  a forma mais natural de pedi-la, e foi o teste que mostrou.
   *
   *  As LETRAS só entram quando foram digitadas: "042" acha a AX-042, e "XY-042"
   *  não — quem escreveu o prefixo disse qual queria. */
  function achaPorCodigo(lista, cru) {
    /* NAO SE LIMPA NADA ANTES. Havia um `replace` tirando espaco, `#` e hifen, e
       ele nao fazia diferenca nenhuma: o que se usa abaixo sao os DIGITOS e as
       LETRAS, e tudo o mais ja fica de fora por construcao. Foi a sabotagem que
       mostrou — apagar aquele `replace` nao quebrava teste nenhum de
       comportamento. Linha que parece proteger e nao protege e pior que linha
       nenhuma: alguem a copia para outro lugar acreditando que resolve algo. */
    var cod = String(cru == null ? '' : cru).trim().toUpperCase();
    var num = cod.replace(/\D+/g, '');
    if (!num) return null;
    var letras = cod.replace(/[^A-Z]/g, '');
    for (var i = 0; i < (lista || []).length; i++) {
      var c = String((lista[i] && lista[i].codigo) || '').toUpperCase();
      var cn = c.replace(/\D+/g, '');
      if (!cn) continue;
      // O NUMERO E COMPARADO COMO NUMERO, e nao como texto: os codigos tem zero a
      // esquerda ("AX-042") e quem digita escreve "42". Comparar as strings
      // deixava a demanda invisivel para a forma mais natural de pedi-la.
      if (Number(cn) !== Number(num)) continue;
      // E se a pessoa digitou letras, elas tem de bater — "XY-042" nao e a AX-042.
      if (letras && c.replace(/[^A-Z]/g, '') !== letras) continue;
      return lista[i];
    }
    return null;
  }

  /** O NÚMERO DA ISSUE É O FIM DA URL, e não um trecho dela.
   *
   *  `link_issue` guarda a URL inteira. Comparar a string faria "1087" casar com
   *  a issue 10871, e com qualquer número que aparecesse no meio do caminho —
   *  inclusive o número do repositório. O que identifica a issue é o último
   *  segmento, e é ele que se compara. */
  function numeroDaIssue(url) {
    var m = String(url == null ? '' : url).trim().match(/(\d+)\s*$/);
    return m ? m[1] : '';
  }

  function achaPorIssue(lista, cru) {
    var num = soDigitos(cru);
    if (!num) return null;
    for (var i = 0; i < (lista || []).length; i++) {
      if (numeroDaIssue(lista[i] && lista[i].link_issue) === num) return lista[i];
    }
    return null;
  }

  /** ACHA, E DIZ POR ONDE ACHOU — ou `null` quando não existe.
   *
   *  `null` é resposta, e é a resposta certa: inventar a demanda mais parecida
   *  faria quem digitou um número errado trabalhar na demanda de outra pessoa.
   *
   *  `opcoes.so` limita a busca a um caminho (`'codigo'` ou `'issue'`), para
   *  quem sabe o que está pedindo e não quer o outro por engano. */
  function acha(lista, termo, opcoes) {
    var so = (opcoes || {}).so || '';
    var cru = String(termo == null ? '' : termo).trim();
    if (!cru) return null;

    if (so !== 'issue') {
      var porCod = achaPorCodigo(lista, cru);
      if (porCod) return { demanda: porCod, por: 'codigo' };
    }
    if (so !== 'codigo') {
      var porIssue = achaPorIssue(lista, cru);
      if (porIssue) return { demanda: porIssue, por: 'issue' };
    }
    return null;
  }

  raiz.BUSCA_DEMANDA = {
    soDigitos: soDigitos,
    achaPorCodigo: achaPorCodigo,
    numeroDaIssue: numeroDaIssue,
    achaPorIssue: achaPorIssue,
    acha: acha,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.BUSCA_DEMANDA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
