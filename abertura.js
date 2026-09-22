/* ═══ A DATA COM QUE UMA DEMANDA PODE NASCER ════════════════════════════════
 *
 * "Bloquear abertura de issues com datas retroativas, tanto admin, gantt, dev
 *  ou api. Se abrir permitir apenas para data atual."
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUE ISTO EXISTE.
 *
 * Demanda que nasce com data no passado se perde. A AX-288 foi programada para
 * agosto em setembro e nunca apareceu no gantt — só as quatro etapas de
 * `PRAZO.ETAPAS_QUE_HERDAM` reaparecem no mês seguinte, e nas outras a demanda
 * some do quadro e da fila ao mesmo tempo. A rede do limbo avisa depois do
 * estrago; esta regra impede o estrago.
 *
 * E ela também suja o passado: uma demanda aberta hoje com início em junho entra
 * no fechamento de junho, que já foi apresentado. O mês fechado deixa de ser
 * fechado.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DUAS REGRAS, E A SEGUNDA É SOBRE QUEM ABRE.
 *
 *   TODOS      não se abre com data no passado. Medido na base: 79 demandas
 *              nasceram assim.
 *   DEV E API  só o dia de hoje. Planejar adiante é decisão do PM/PO — a mesma
 *              separação que o painel do dev já mantém na etapa (ele move para
 *              "em andamento" e entrega; Planning e Planejado são do PM/PO).
 *
 * O ADMIN E O GANTT SEGUEM PLANEJANDO. Medido: 216 demandas nasceram com início
 * no futuro e 302 com entrega no futuro. Proibir isso seria trocar um defeito
 * por uma tela que não serve para planejar.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * VALE SÓ NA ABERTURA, e é o chamador que diz se está abrindo.
 *
 * Editar uma demanda velha continua livre: a data dela já é passado por
 * construção, e recusar a edição prenderia todo o histórico. */
(function (raiz) {
  'use strict';

  /* QUEM NÃO PLANEJA. São os valores que o `origem` já usa no arquivo — o campo
     existe desde antes disto, gravado pelo Worker: `dev` no painel e `endpoint`
     na API. Reaproveitar o vocabulário do dado evita um segundo nome para a
     mesma coisa. */
  var SEM_PLANEJAMENTO = ['dev', 'endpoint'];

  var CAMPOS = [
    { chave: 'inicio', rot: 'início' },
    { chave: 'entrega', rot: 'entrega' },
  ];

  function ehData(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }

  function planeja(origem) {
    return SEM_PLANEJAMENTO.indexOf(String(origem || '').toLowerCase()) < 0;
  }

  /* ABERTA PELO DEV OU PELA API — é o que o gantt pinta de listrado, para quem
     olha o quadro saber de onde aquela barra veio sem abrir o card. */
  function deDevOuApi(m) {
    return SEM_PLANEJAMENTO.indexOf(String((m || {}).origem || '').toLowerCase()) >= 0;
  }

  /* O VEREDITO DE UM CAMPO. Devolve `''` quando está tudo bem, ou a frase que a
     tela mostra — a frase mora aqui para as quatro portas dizerem a MESMA coisa.
     Quatro mensagens diferentes para a mesma recusa é como se fossem quatro
     regras, e a pessoa aprende que "depende da tela". */
  function checaCampo(valor, rot, origem, hoje) {
    var v = String(valor || '').trim();
    if (!v) return '';                       // sem data: nada a conferir
    if (!ehData(v)) return 'A data de ' + rot + ' precisa estar em AAAA-MM-DD.';
    if (!ehData(hoje)) return '';            // sem hoje confiável, não inventa recusa
    if (v < hoje) {
      return 'Não dá para abrir uma demanda com ' + rot + ' em ' + v +
             ', que já passou. Demanda com data para trás não aparece no ' +
             'planejamento e entra num mês que já foi apresentado. Use ' + hoje +
             ' ou uma data à frente.';
    }
    if (v > hoje && !planeja(origem)) {
      return 'Pelo ' + (String(origem).toLowerCase() === 'endpoint' ? 'endpoint' : 'painel') +
             ', a demanda nasce com a data de hoje (' + hoje + '). Combinar prazo ' +
             'para ' + v + ' é do planejamento — o PM/PO ajusta depois de olhar a fila.';
    }
    return '';
  }

  /* A ABERTURA INTEIRA. Devolve `{ ok, erro, campo }` — `campo` para a tela
     poder pôr o foco onde está o problema, em vez de só mostrar um toast e
     deixar a pessoa procurar. */
  function checa(dados, origem, hoje) {
    var d = dados || {};
    for (var i = 0; i < CAMPOS.length; i++) {
      var c = CAMPOS[i];
      var erro = checaCampo(d[c.chave], c.rot, origem, hoje);
      if (erro) return { ok: false, erro: erro, campo: c.chave };
    }
    return { ok: true, erro: '', campo: '' };
  }

  /* O QUE O DEV E A API PODEM GRAVAR, já corrigido. Serve ao caminho em que
     recusar seria pior do que ajustar — por exemplo, um script que manda a data
     de ontem por causa de fuso. Quem chama decide entre `checa` (recusa) e
     `ajusta` (corrige); as duas leem a mesma regra. */
  function ajusta(dados, origem, hoje) {
    var d = dados || {};
    var out = { inicio: String(d.inicio || ''), entrega: String(d.entrega || '') };
    if (!ehData(hoje)) return out;
    CAMPOS.forEach(function (c) {
      var v = out[c.chave];
      if (!ehData(v)) { out[c.chave] = ''; return; }
      if (v < hoje) out[c.chave] = hoje;
      else if (v > hoje && !planeja(origem)) out[c.chave] = hoje;
    });
    return out;
  }

  var api = { SEM_PLANEJAMENTO: SEM_PLANEJAMENTO, ehData: ehData, planeja: planeja,
              deDevOuApi: deDevOuApi, checaCampo: checaCampo, checa: checa, ajusta: ajusta };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.ABERTURA = api;
}(typeof window !== 'undefined' ? window : this));
