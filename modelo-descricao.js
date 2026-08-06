/* ─────────────────────────────────────────────────────────────────────────
   MODELO DE DESCRIÇÃO — padrão único para especificar uma demanda
   ─────────────────────────────────────────────────────────────────────────
   Existe porque descrição em texto livre chegava em qualquer formato, e o que
   falta numa especificação só aparece na hora de desenvolver — quando custa uma
   reunião. As seções abaixo são os requisitos mínimos definidos pelo PM/PO.

   Arquivo compartilhado de propósito: Admin, Planejamento e painel Dev usam o
   MESMO modelo. Três cópias divergiriam na primeira mexida, e aí o padrão que
   este arquivo existe para criar deixaria de existir.

   COMO A COBRANÇA FUNCIONA, e por que assim:

   As linhas de orientação começam com "> ". Elas NÃO contam como conteúdo. Ou
   seja: inserir o modelo e salvar sem escrever nada é recusado, seção por seção,
   com o nome do que falta. Era o pedido — "não permitir salvar se o texto não foi
   alterado" — e é o único jeito de o modelo virar padrão em vez de decoração.

   Só cobra de quem USA o modelo. Demanda antiga com texto livre continua
   salvando: são mais de 200 na base, e transformar uma padronização em bloqueio
   retroativo pararia o time no meio do dia por causa de card de junho.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // O ambiente vem primeiro porque é o que muda a leitura de todo o resto: a
  // mesma frase significa coisas diferentes em AXCred e em AXPag.
  var MODELO = [
    'AXCred — Ambiente de Operações',
    '> Troque pelo sistema e ambiente certos, se não for este.',
    '',
    '1. OBJETIVO DA ALTERAÇÃO',
    '> Em uma frase: criar nova opção para… / alterar a regra de… / remover o campo…',
    '',
    '2. LOCAL DA IMPLEMENTAÇÃO',
    '> O caminho na tela. Ex.: Operações > Dashboard > Cadastro > Aba Garantias',
    '',
    '3. REGRA DE NEGÓCIO',
    '> Como a funcionalidade deve se comportar: validações, permissões, cálculos,',
    '> obrigatoriedades e exceções. O que não estiver aqui será decidido por quem',
    '> desenvolve, e provavelmente diferente do que você espera.',
    '',
    '4. IMPACTOS NA APLICAÇÃO',
    '> Telas, funcionalidades ou processos afetados pela alteração.',
    '',
    '5. IMPACTOS EM DOCUMENTOS E RELATÓRIOS',
    '[ ] PDF   [ ] Capa da operação   [ ] Contrato   [ ] Relatórios   [ ] Exportações (Excel/CSV)',
    '> Marque com [x] o que for afetado e diga o que muda em cada um.',
    '> Se nenhum for afetado, escreva "nenhum" — em branco não distingue',
    '> "não afeta" de "não verifiquei".',
    '',
    '6. CRITÉRIOS DE ACEITE',
    '> Como saber que ficou pronto. Ex.: o campo aparece na tela; a regra é aplicada',
    '> conforme especificado; o PDF reflete a alteração; nada que já existia quebrou.',
    '',
  ].join('\n');

  // Os títulos são a âncora da validação. Mexer aqui exige mexer no modelo acima:
  // a busca é pelo texto do título, não pela posição.
  var SECOES = [
    { n: 1, titulo: '1. OBJETIVO DA ALTERAÇÃO',            rotulo: 'Objetivo da alteração' },
    { n: 2, titulo: '2. LOCAL DA IMPLEMENTAÇÃO',           rotulo: 'Local da implementação' },
    { n: 3, titulo: '3. REGRA DE NEGÓCIO',                 rotulo: 'Regra de negócio' },
    { n: 4, titulo: '4. IMPACTOS NA APLICAÇÃO',            rotulo: 'Impactos na aplicação' },
    { n: 5, titulo: '5. IMPACTOS EM DOCUMENTOS E RELATÓRIOS', rotulo: 'Impactos em documentos e relatórios' },
    { n: 6, titulo: '6. CRITÉRIOS DE ACEITE',              rotulo: 'Critérios de aceite' },
  ];

  function norm(t) {
    return String(t == null ? '' : t)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toUpperCase().replace(/\s+/g, ' ').trim();
  }

  // O texto usa o modelo? Basta uma seção reconhecível: alguém que apagou metade
  // do modelo mas manteve os títulos ainda está dentro do padrão, e cobrar dele
  // é o ponto. Texto livre sem nenhum título não é cobrado.
  function usaModelo(texto) {
    var t = norm(texto);
    var achou = 0;
    for (var i = 0; i < SECOES.length; i++) {
      if (t.indexOf(norm(SECOES[i].titulo)) >= 0) achou++;
    }
    return achou >= 2;
  }

  // Conteúdo de uma seção: o que vem entre o título dela e o próximo título,
  // descontadas as linhas de orientação ("> ") e a linha de caixas não marcadas.
  function conteudoDaSecao(texto, idx) {
    var linhas = String(texto || '').split(/\r?\n/);
    var alvo = norm(SECOES[idx].titulo);
    var proximos = SECOES.slice(idx + 1).map(function (s) { return norm(s.titulo); });
    var dentro = false;
    var corpo = [];
    for (var i = 0; i < linhas.length; i++) {
      var l = linhas[i];
      var nl = norm(l);
      if (!dentro) { if (nl.indexOf(alvo) >= 0) dentro = true; continue; }
      if (proximos.some(function (p) { return nl.indexOf(p) >= 0; })) break;
      if (/^\s*>/.test(l)) continue;                    // orientação, não conteúdo
      // Linha de caixas: só conta se alguma estiver marcada. Caixa vazia é o
      // modelo intacto, e o pedido foi justamente não aceitar isso.
      if (/\[\s*[xX]?\s*\]/.test(l)) {
        if (/\[\s*[xX]\s*\]/.test(l)) corpo.push(l.trim());
        continue;
      }
      if (l.trim()) corpo.push(l.trim());
    }
    return corpo.join(' ').trim();
  }

  function temSecao(texto, idx) {
    return norm(texto).indexOf(norm(SECOES[idx].titulo)) >= 0;
  }

  // Quais seções continuam sem conteúdo. Vazio = pode salvar.
  //
  // MÍNIMO deliberado de 3 caracteres: "-", ".", "x" não é especificação, e
  // aceitar isso transformaria a cobrança em ritual de contornar o campo.
  //
  // Cobra a seção que ESTÁ no texto e está vazia, não as seis sempre. O modelo
  // recém-inserido tem as seis, então o caso central — inserir e salvar sem
  // escrever nada — continua recusado. A diferença aparece na demanda que vem do
  // dash: ela chega com as seções que a área de negócio soube responder, e sem
  // "Regra de negócio" e "Critérios de aceite", que são trabalho de produto. Se a
  // cobrança fosse pelas seis, o PM/PO não conseguiria nem trocar o sistema do
  // card antes de escrever a especificação inteira — e triagem trancada não
  // melhora especificação nenhuma, só empurra todo mundo de volta ao texto livre.
  function pendencias(texto) {
    if (!usaModelo(texto)) return [];
    var falta = [];
    for (var i = 0; i < SECOES.length; i++) {
      if (!temSecao(texto, i)) continue;
      if (conteudoDaSecao(texto, i).length < 3) falta.push(SECOES[i].rotulo);
    }
    return falta;
  }

  // Mensagem única, para as três telas dizerem a mesma coisa.
  function mensagem(falta) {
    if (!falta || !falta.length) return '';
    if (falta.length === 1) return 'Falta preencher: ' + falta[0] + '.';
    return 'Faltam ' + falta.length + ' seções do modelo: ' + falta.join(', ') + '.';
  }

  // Insere o modelo. NUNCA sobrescreve texto sem confirmação: perder o que a
  // pessoa digitou é o pior defeito que esta ferramenta já teve.
  function inserir(el) {
    if (!el) return false;
    var atual = String(el.value || '').trim();
    if (atual && !usaModelo(atual)) {
      if (!window.confirm('Já existe texto neste campo. Substituir pelo modelo?\n\n' +
                          'O texto atual será perdido.')) return false;
    } else if (atual && usaModelo(atual)) {
      if (!window.confirm('O modelo já está aqui, com o que você preencheu. ' +
                          'Recomeçar do modelo em branco?')) return false;
    }
    el.value = MODELO;
    el.focus();
    // Cursor na primeira seção, não no fim: no fim a pessoa não vê onde escrever.
    var p = el.value.indexOf('1. OBJETIVO');
    try { el.setSelectionRange(p, p); } catch (_) {}
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  // Liga o botão e o aviso ao lado do campo. `alvo` é o id do textarea.
  // `opts.auto` insere o modelo sozinho quando o campo está vazio — usado ao
  // abrir uma demanda NOVA, onde não há nada a perder.
  function ligar(alvo, opts) {
    opts = opts || {};
    var el = document.getElementById(alvo);
    if (!el || el._modeloLigado) return;
    el._modeloLigado = true;

    var barra = document.createElement('div');
    barra.className = 'md-barra';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'md-btn';
    btn.textContent = '📋 Usar modelo';
    btn.title = 'Insere o padrão de especificação com as seções obrigatórias.';
    btn.onclick = function () { inserir(el); atualiza(); };
    var aviso = document.createElement('span');
    aviso.className = 'md-aviso';
    barra.appendChild(btn);
    barra.appendChild(aviso);
    if (el.parentNode) el.parentNode.insertBefore(barra, el.nextSibling);

    function atualiza() {
      var falta = pendencias(el.value);
      if (!usaModelo(el.value)) { aviso.textContent = ''; aviso.className = 'md-aviso'; return; }
      if (!falta.length) {
        aviso.textContent = '✓ modelo completo';
        aviso.className = 'md-aviso ok';
      } else {
        // Conta e nomes: só a conta não diz o que fazer, e só os nomes numa lista
        // longa esconde o tamanho do que falta.
        aviso.textContent = falta.length + ' de 6 seções em branco: ' + falta.join(', ');
        aviso.className = 'md-aviso falta';
      }
    }
    el.addEventListener('input', atualiza);
    el._modeloAtualiza = atualiza;
    if (opts.auto && !String(el.value || '').trim()) inserir(el);
    atualiza();
  }

  // Chamada pelas telas antes de gravar. Devolve true se pode seguir; se não,
  // avisa, foca o campo e leva o cursor até a primeira seção em branco.
  function validar(alvo, toast) {
    var el = document.getElementById(alvo);
    if (!el) return true;
    var falta = pendencias(el.value);
    if (!falta.length) return true;
    var msg = mensagem(falta);
    if (typeof toast === 'function') toast(msg, 'err'); else window.alert(msg);
    el.focus();
    // Cursor na primeira em branco: mandar "falta a seção 4" sem levar até lá
    // obriga a pessoa a caçar no meio do texto.
    for (var i = 0; i < SECOES.length; i++) {
      if (falta.indexOf(SECOES[i].rotulo) >= 0) {
        var p = el.value.toUpperCase().indexOf(SECOES[i].titulo.toUpperCase());
        if (p >= 0) { try { el.setSelectionRange(p, p); } catch (_) {} }
        break;
      }
    }
    if (el._modeloAtualiza) el._modeloAtualiza();
    return false;
  }

  var css = document.createElement('style');
  css.textContent = [
    '.md-barra { display:flex; align-items:center; gap:9px; flex-wrap:wrap; margin-top:6px; }',
    '.md-btn { font-family:inherit; font-size:11.5px; cursor:pointer; padding:3px 10px;',
    '  border-radius:20px; background:var(--bg3,#1E1E1C); color:var(--text2,#B5B3AA);',
    '  border:1px solid var(--border,#2E2E2B); white-space:nowrap; }',
    '.md-btn:hover { color:var(--text,#ECEAE2); border-color:var(--border2,#3A3A36); }',
    '.md-aviso { font-size:11px; line-height:1.35; }',
    '.md-aviso.ok { color:var(--green,#3EC98E); }',
    '.md-aviso.falta { color:var(--amber-tx,#FFC470); }',
  ].join('\n');
  document.head.appendChild(css);

  window.MODELO_DESCRICAO = MODELO;
  window.modeloDescricaoSecoes = SECOES;
  window.modeloDescricaoUsa = usaModelo;
  window.modeloDescricaoPendencias = pendencias;
  window.modeloDescricaoMensagem = mensagem;
  window.ligaModeloDescricao = ligar;
  window.validaModeloDescricao = validar;
})();
