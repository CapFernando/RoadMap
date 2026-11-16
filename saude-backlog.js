/* ─────────────────────────────────────────────────────────────────────────
   SAUDE DO BACKLOG (PRD RF-26 e RF-27, 16/11/2026).

   "Ver de uma vez tudo o que esta travado ou incompleto." Os avisos ja
   existiam, espalhados entre Inicio, Quadro e Sprints; aqui eles viram uma
   lista so, cada linha com a contagem E as demandas — a contagem e sempre o
   tamanho da lista, por construcao.

   AS REGRAS SAO INJETADAS, e nao copiadas: cada categoria pergunta a quem ja
   decide aquilo (a etapa, a sprint, a homologacao, a pausa). Uma segunda
   versao de "o que e atrasado" aqui seria a primeira a divergir.

     opts = {
       etapaDe(m)          etapa GRAVADA (a coluna)
       etapaEfetiva(m)     etapa com a leitura de atraso ('atrasado')
       pontosDe(m)         pontos do Planning Poker
       situacaoDaSprint(r) 'montando' | 'em_curso' | 'fechada'
       diasNaArea(m, hoje) dias uteis na Validacao da area (homologacao.js)
       retornoVencido(m, hoje)  pausa por terceiro com o retorno vencido
     }

   Publica em `window.SAUDE` e em `module.exports` (a suite executa).
   ───────────────────────────────────────────────────────────────────────── */
(function (raiz) {
  'use strict';

  var FECHADAS = ['concluido', 'negada'];
  var COMPROMETIDAS = ['planejado', 'em_andamento'];
  var DIAS_NA_AREA = 5;

  var CATEGORIAS = [
    { k: 'sem_dono_na_sprint', rotulo: 'Sem dono numa sprint em curso',
      d: 'Estão na fila do time: alguém precisa pegar.' },
    { k: 'sem_pontos', rotulo: 'Comprometidas sem pontos',
      d: 'De Planejado em diante sem pontuação do Planning Poker: o planejado do dev aparece menor.' },
    { k: 'parada_na_area', rotulo: 'Paradas na Validação da área',
      d: 'Há ' + DIAS_NA_AREA + ' dias úteis ou mais esperando a homologação de quem pediu.' },
    { k: 'vencida', rotulo: 'Com prazo vencido', d: 'O prazo combinado passou e ainda não foram entregues.' },
    { k: 'sem_sistema', rotulo: 'Comprometidas sem sistema',
      d: 'Sem sistema, ficam fora do filtro, do gráfico e de todo relatório por sistema.' },
    { k: 'terceiro_vencido', rotulo: 'Aguardando terceiro com retorno vencido',
      d: 'O fornecedor passou da data que prometeu: hora de cobrar.' }
  ];

  function txt(v) { return String(v == null ? '' : v).trim(); }

  /** As categorias com as demandas de cada uma, na ordem da tela. */
  function problemas(dados, hoje, opts) {
    var o = opts || {};
    var etapa = typeof o.etapaDe === 'function' ? o.etapaDe : function (m) { return txt(m.status_planejamento); };
    var efetiva = typeof o.etapaEfetiva === 'function' ? o.etapaEfetiva : etapa;
    var pontos = typeof o.pontosDe === 'function' ? o.pontosDe : function (m) { return Number(m.poker_pontos) || 0; };
    var sit = typeof o.situacaoDaSprint === 'function' ? o.situacaoDaSprint : function () { return ''; };
    var naArea = typeof o.diasNaArea === 'function' ? o.diasNaArea : function () { return 0; };
    var terceiro = typeof o.retornoVencido === 'function' ? o.retornoVencido : function () { return false; };
    var ids = {};
    CATEGORIAS.forEach(function (c) { ids[c.k] = []; });
    ((dados || {}).melhorias || []).forEach(function (m) {
      if (!m || !m.id || m.oculto || txt(m.mesclado_em)) return;
      var e = etapa(m);
      if (FECHADAS.indexOf(e) >= 0) return;
      var s = txt(m.sprint_po);
      if (s && !txt(m.dev) && sit(s) === 'em_curso') ids.sem_dono_na_sprint.push(m.id);
      if (COMPROMETIDAS.indexOf(e) >= 0 && !pontos(m)) ids.sem_pontos.push(m.id);
      if (e === 'validacao_area' && (naArea(m, hoje) || 0) >= DIAS_NA_AREA) ids.parada_na_area.push(m.id);
      if (efetiva(m) === 'atrasado') ids.vencida.push(m.id);
      if (COMPROMETIDAS.indexOf(e) >= 0 && !txt(m.tema_id)) ids.sem_sistema.push(m.id);
      if (terceiro(m, hoje)) ids.terceiro_vencido.push(m.id);
    });
    return CATEGORIAS.map(function (c) {
      return { k: c.k, rotulo: c.rotulo, d: c.d, n: ids[c.k].length, ids: ids[c.k] };
    });
  }

  var api = { problemas: problemas, CATEGORIAS: CATEGORIAS, DIAS_NA_AREA: DIAS_NA_AREA };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.SAUDE = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
