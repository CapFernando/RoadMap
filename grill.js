/* ═══ GRILL: O DEV JULGA A DEMANDA ANTES DE ELA ENTRAR NO PLANEJAMENTO ══════
 *
 * "Abra uma marcação para admin e dev, onde eu consiga flagar Grill e, quando
 *  for para o dev, aparecer na esteira que existe hoje mas com visual de grill,
 *  onde ele deverá levantar os pontos da task."
 *
 * E, sobre o que é um "ponto": "seria dúvidas ou questionamentos".
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * O FLUXO, na ordem em que as pessoas o vivem.
 *
 *   1. O PM/PO MARCA a demanda como Grill, de onde ela estiver.
 *   2. Ela aparece no painel do dev na MESMA coluna de sempre — só que com o
 *      visual de Grill, que é o que faz ele parar nela.
 *   3. O dev dá um de dois vereditos:
 *        ENTENDI       → a demanda vai para PLANNING
 *        TENHO DÚVIDAS → ele escreve os pontos, e ela vai para LEVANTAR REQ.
 *   4. O PM/PO lê as dúvidas, resolve, e organiza a ida para Planning.
 *
 * NÃO TRAVA NADA, por decisão do Fernando ("não trava — é um aviso"). A demanda
 * segue movível enquanto o Grill está pendente; o visual chama e o dev decide a
 * hora. Trava aqui prenderia demanda por esquecimento.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * O CAMPO `grill` FOI REAPROVEITADO, e isso precisa estar escrito.
 *
 * Havia um "Grill" antigo no admin: uma sabatina que lia as respostas do
 * discovery e dava veredito de qualidade em cada uma. Nunca foi usado — medido
 * na base: ZERO demandas com o campo preenchido — e o Fernando pediu para
 * retirá-lo. O nome ficou, o conteúdo é outro.
 *
 * A leitura abaixo é tolerante de propósito: uma demanda que tenha sobrado do
 * formato antigo (`{ pergunta_id: 'resposta' }`) não tem `marcado`, então ela
 * lê como "não marcada" e nada quebra. O dado velho continua no arquivo — quem
 * grava parte de `...existing` — e ninguém o apaga por engano. */
(function (raiz) {
  'use strict';

  /* OS DOIS DESTINOS SÃO DO MÓDULO, e não de cada tela. Eles são a regra: é
     para onde o veredito do dev leva a demanda. Escritos em três lugares,
     divergiriam no primeiro ajuste — e o sintoma seria a demanda parando na
     coluna errada, que ninguém associa ao Grill. */
  var DESTINO_OK = 'planning';
  var DESTINO_DUVIDA = 'levantar_req';
  var MAX_PONTOS = 20;
  var MAX_TEXTO = 400;

  function dados(m) {
    var g = (m && m.grill && typeof m.grill === 'object') ? m.grill : {};
    var v = String(g.veredito || '');
    return {
      marcado: !!g.marcado,
      marcado_em: String(g.marcado_em || ''),
      marcado_por: String(g.marcado_por || ''),
      veredito: (v === 'ok' || v === 'duvida') ? v : '',
      respondido_em: String(g.respondido_em || ''),
      respondido_por: String(g.respondido_por || ''),
      pontos: (Array.isArray(g.pontos) ? g.pontos : []).filter(Boolean)
        .slice(0, MAX_PONTOS).map(function (p) {
          /* ACEITA TEXTO SOLTO tambem: a primeira versao da tela mandava uma
             lista de strings, e um `p.texto` cru viraria `undefined` na tela
             sem erro nenhum aparecer. */
          if (typeof p === 'string') return { texto: p.slice(0, MAX_TEXTO), em: '', por: '' };
          return { texto: String(p.texto || '').slice(0, MAX_TEXTO),
                   em: String(p.em || ''), por: String(p.por || '') };
        })
        .filter(function (p) { return p.texto.trim() !== ''; }),
    };
  }

  /* O ESTADO EM UMA PALAVRA. As telas desenham a partir daqui, e não de
     combinações de campos feitas na mão em cada uma. */
  function estado(m) {
    var g = dados(m);
    if (!g.marcado) return 'nao';
    if (g.veredito === 'ok') return 'ok';
    if (g.veredito === 'duvida') return 'duvida';
    return 'pendente';
  }

  /* PENDENTE É O QUE PEDE AÇÃO DO DEV, e é o único estado que muda o visual do
     card na esteira. Respondido continua marcado — o rastro fica —, mas já não
     interrompe ninguém. */
  function pendente(m) { return estado(m) === 'pendente'; }

  function pontos(m) { return dados(m).pontos; }

  function destinoDoVeredito(v) {
    if (v === 'ok') return DESTINO_OK;
    if (v === 'duvida') return DESTINO_DUVIDA;
    return '';
  }

  /* O RÓTULO CURTO do card. Sai daqui para as duas telas mostrarem a mesma
     palavra — "Grill" no admin e outra coisa no painel do dev seria o mesmo
     recurso com dois nomes. */
  function rotulo(m) {
    var e = estado(m);
    if (e === 'pendente') return 'Grill';
    if (e === 'ok') return 'Grill · entendido';
    if (e === 'duvida') {
      var n = pontos(m).length;
      return 'Grill · ' + n + (n === 1 ? ' dúvida' : ' dúvidas');
    }
    return '';
  }

  /* MARCAR E DESMARCAR, aplicados no objeto. Ficam aqui para o admin não
     montar o formato do dado na mão — é assim que um campo nasce com nome
     diferente em cada tela. */
  function marca(m, quem) {
    if (!m) return m;
    var g = dados(m);
    m.grill = { marcado: true,
                marcado_em: new Date().toISOString(),
                marcado_por: String(quem || ''),
                /* O VEREDITO ANTERIOR É ZERADO. Marcar de novo é pedir um novo
                   julgamento; manter o "entendido" da rodada passada faria a
                   demanda nascer respondida. */
                veredito: '', respondido_em: '', respondido_por: '',
                /* AS DÚVIDAS DA RODADA ANTERIOR FICAM. Elas são o histórico do
                   que já se perguntou, e apagá-las faria a segunda rodada
                   repetir a primeira. */
                pontos: g.pontos };
    return m;
  }

  function desmarca(m) {
    if (!m) return m;
    var g = dados(m);
    /* NÃO APAGA AS DÚVIDAS. Desmarcar é dizer "não precisa mais de Grill", e
       não "aquelas perguntas nunca existiram". */
    m.grill = { marcado: false, marcado_em: '', marcado_por: '',
                veredito: g.veredito, respondido_em: g.respondido_em,
                respondido_por: g.respondido_por, pontos: g.pontos };
    return m;
  }

  /* O VEREDITO DO DEV. Devolve a etapa de destino, ou `''` quando o veredito
     não vale — para quem chama não gravar metade. */
  function responde(m, veredito, listaPontos, quem) {
    if (!m) return '';
    var destino = destinoDoVeredito(veredito);
    if (!destino) return '';
    var g = dados(m);
    var novos = (listaPontos || []).map(function (t) {
      return { texto: String(t || '').slice(0, MAX_TEXTO).trim(),
               em: new Date().toISOString(), por: String(quem || '') };
    }).filter(function (p) { return p.texto !== ''; });
    /* DÚVIDA SEM PONTO NENHUM NÃO É DÚVIDA. Quem chama já deveria ter barrado,
       mas deixar passar gravaria uma demanda em Levantar Req. sem uma linha
       dizendo o que falta — que é o pior estado possível para quem vai ler. */
    if (veredito === 'duvida' && !novos.length && !g.pontos.length) return '';
    m.grill = { marcado: true, marcado_em: g.marcado_em, marcado_por: g.marcado_por,
                veredito: veredito,
                respondido_em: new Date().toISOString(),
                respondido_por: String(quem || ''),
                pontos: g.pontos.concat(novos).slice(0, MAX_PONTOS) };
    return destino;
  }

  var api = {
    DESTINO_OK: DESTINO_OK, DESTINO_DUVIDA: DESTINO_DUVIDA,
    MAX_PONTOS: MAX_PONTOS, MAX_TEXTO: MAX_TEXTO,
    dados: dados, estado: estado, pendente: pendente, pontos: pontos,
    rotulo: rotulo, destinoDoVeredito: destinoDoVeredito,
    marca: marca, desmarca: desmarca, responde: responde,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.GRILL = api;
}(typeof window !== 'undefined' ? window : this));
