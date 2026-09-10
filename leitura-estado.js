/* ─────────────────────────────────────────────────────────────────────────
   A LEITURA FALHOU — e a tela tem de dizer isso, em vez de parecer vazia.

   ═════════════════════════════════════════════════════════════════════════
   O RELATO QUE ORIGINOU ESTE ARQUIVO.

   "Não está aparecendo os módulos. Dessa forma vou criar - Cobrança e logo
   depois vc aloca dentro do módulo correto." E, um minuto depois: "Nem a lista
   de dev está aparecendo." E depois: "Criei a issue e aparentemente não foi
   criada" — seguido de "agora a task apareceu".

   Três sintomas, uma causa. A leitura dos dados falhou e CADA TELA ESCONDEU
   ISSO DE UM JEITO DIFERENTE:

     admin.html   `catch { toast(msg); renderAll(); }`
                  O toast desaparece em segundos, e o `renderAll` redesenha a
                  tela com o estado INICIAL — `{ temas: [], desenvolvedores: [] }`.
                  Uma tela que parece funcionando e está vazia.

     dev.html     `catch (e) { console.warn('loadData error', e); }`
                  Nada na tela. E, no modo senha, uma resposta não-ok fazia a
                  função voltar em silêncio sem nem chamar `applyData`.

     gantt.html   `catch (_) {}` no laço de atualização.

   ═════════════════════════════════════════════════════════════════════════
   POR QUE ISSO NÃO É SÓ UM AVISO QUE FALTAVA: ELE PRODUZ DADO ERRADO.

   `catalogoResolve` evita tema duplicado comparando o nome digitado com
   `state.temas`. Com a lista VAZIA, a comparação não acha nada e o caminho
   "+ outro (escrever)" CRIA UM TEMA NOVO.

   Foi exatamente o que aconteceu: o servidor tinha `AXCred - Cobrança`, a tela
   mostrava uma lista vazia, e nasceu um `Cobrança` solto na raiz. O mesmo vale
   para a lista de devs — os dois caminhos que cadastram dev deduplicam contra
   `state.desenvolvedores`, e uma lista vazia aprova qualquer nome.

   Ou seja: a tela em silêncio não deixa a pessoa só sem informação. Ela a
   convida a recriar o que já existe.

   ═════════════════════════════════════════════════════════════════════════
   O QUE ESTE ARQUIVO FAZ, E O QUE NÃO FAZ.

   FAZ: guarda um estado ("a última leitura falhou"), desenha uma FAIXA FIXA que
   não desaparece sozinha e oferece um botão de tentar de novo.

   NÃO FAZ: ler dados. Cada tela continua com o seu caminho de leitura — este
   arquivo só é avisado do resultado, por `LEITURA.falhou(motivo)` e
   `LEITURA.ok()`.

   FAIXA E NÃO TOAST, e a diferença é o tempo: um toast responde "o que acabou de
   acontecer" e some; a faixa responde "em que estado esta tela está" e fica
   enquanto o estado durar. O que a pessoa precisava saber ao abrir o formulário
   dois minutos depois era o segundo.
   ───────────────────────────────────────────────────────────────────────── */
(function (raiz) {
  'use strict';

  var ID = 'leitura-faixa';
  var estado = { falhou: false, motivo: '', quando: null };
  var _tentarDeNovo = null;

  function texto(v) { return String(v == null ? '' : v); }

  function esc(s) {
    return texto(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function hora(iso) {
    try {
      return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (_) { return ''; }
  }

  /* A FAIXA É CRIADA NA HORA, e não pedida ao HTML de cada tela. São quatro
     telas; um `<div>` a manter em quatro arquivos é a mesma divergência que este
     projeto já pagou em outros lugares. */
  function faixa() {
    var el = document.getElementById(ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = ID;
    /* `role="alert"` e `aria-live` para quem usa leitor de tela ouvir a mudança
       de estado sem precisar varrer a página procurando o que mudou. */
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'assertive');
    el.style.display = 'none';
    if (document.body) document.body.appendChild(el);
    return el;
  }

  function desenha() {
    var el = faixa();
    if (!estado.falhou) { el.style.display = 'none'; el.innerHTML = ''; return; }
    var quando = estado.quando ? hora(estado.quando) : '';
    el.innerHTML =
      '<strong>Os dados não foram lidos.</strong> ' +
      'O que está na tela pode estar incompleto — e as listas de sistema e de dev ' +
      'podem aparecer vazias mesmo tendo conteúdo no servidor. ' +
      '<span class="lf-motivo">' + esc(estado.motivo || 'sem detalhe') +
      (quando ? ' · ' + esc(quando) : '') + '</span>' +
      '<button type="button" id="lf-retry">Tentar de novo</button>';
    el.style.display = 'flex';
    var btn = document.getElementById('lf-retry');
    if (btn) {
      btn.onclick = function () {
        btn.disabled = true;
        btn.textContent = 'Lendo…';
        try {
          var p = _tentarDeNovo && _tentarDeNovo();
          if (p && typeof p.then === 'function') {
            p.then(function () {}, function () {}).then(function () {
              /* SÓ REABILITA SE A FAIXA CONTINUA DE PÉ. Quando a leitura dá
                 certo, `ok()` já apagou a faixa e este botão não existe mais —
                 mexer nele daria erro no console de quem acabou de ser
                 atendido. */
              var b = document.getElementById('lf-retry');
              if (b) { b.disabled = false; b.textContent = 'Tentar de novo'; }
            });
          } else {
            location.reload();
          }
        } catch (_) { location.reload(); }
      };
    }
  }

  /** A leitura falhou. `motivo` é o que se mostra à pessoa. */
  function falhou(motivo) {
    estado.falhou = true;
    estado.motivo = texto(motivo);
    estado.quando = new Date().toISOString();
    desenha();
  }

  /** A leitura deu certo — a faixa sai. */
  function ok() {
    if (!estado.falhou) return;
    estado.falhou = false;
    estado.motivo = '';
    estado.quando = null;
    desenha();
  }

  /** A tela está mostrando dado possivelmente incompleto?
   *
   *  É o que `catalogo.js` consulta para NÃO oferecer "+ outro (escrever)" numa
   *  lista que não carregou: sem lista, a checagem de duplicata é cega, e o
   *  campo livre vira uma fábrica de tema repetido. */
  function incompleta() { return !!estado.falhou; }

  /** Quem sabe reler. A faixa chama isto no botão; sem ninguém registrado, ela
   *  recarrega a página, que é o caminho que sempre funciona. */
  function aoTentarDeNovo(fn) { _tentarDeNovo = typeof fn === 'function' ? fn : null; }

  raiz.LEITURA = {
    falhou: falhou,
    ok: ok,
    incompleta: incompleta,
    aoTentarDeNovo: aoTentarDeNovo,
    motivo: function () { return estado.motivo; },
  };
})(window);
