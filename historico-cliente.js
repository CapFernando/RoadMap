/* ═══ A TRILHA DAS DEMANDAS VOLTA PARA `m.historico` (03/11/2026) ═════════════
 *
 * O historico saiu da base: ele morava em `data/melhorias.json` e era 1,6 MB dos
 * 4,3 MB que o Worker lia e regravava a cada publicacao — e foi isso que levou
 * o servidor ao "Worker exceeded CPU time limit". Agora ele mora no D1 e e lido
 * pela rota `historico` (ver HIST_NA_BASE no Worker).
 *
 * As contas que usam a trilha — o funil do PM, a aba Historico, as rolagens do
 * Gantt, o selo da planning e a origem da demanda — continuam lendo
 * `m.historico`. Esta funcao recoloca a trilha ali logo depois da leitura, e
 * por isso nenhuma delas precisou mudar.
 *
 * SO AGE QUANDO A BASE VEM SEM TRILHA. Enquanto o Worker ainda grava nos dois
 * lugares, a base traz o historico completo e nada e buscado.
 *
 * UMA BUSCA POR VERSAO DA BASE. O historico so muda quando alguem grava, e toda
 * gravacao muda `atualizado_em`; o polling de 30 segundos nao repete a busca.
 *
 * FALHAR NAO DERRUBA A TELA. Sem a trilha a pessoa ainda trabalha; ela so nao ve
 * o historico ate a proxima leitura dar certo. */
(function (raiz) {
  'use strict';

  var _versao = null;     // `atualizado_em` da base cuja trilha esta em cache
  var _itens = null;      // { id: [entradas] }

  function baseTemTrilha(dados) {
    var ms = (dados && dados.melhorias) || [];
    for (var i = 0; i < ms.length; i++) {
      if (ms[i] && Array.isArray(ms[i].historico)) return true;
    }
    return false;
  }

  function aplica(dados, itens) {
    ((dados && dados.melhorias) || []).forEach(function (m) {
      if (m && m.id) m.historico = (itens && Array.isArray(itens[m.id])) ? itens[m.id] : [];
    });
    return dados;
  }

  async function hidrata(dados, url, credenciais) {
    if (!dados || !Array.isArray(dados.melhorias) || baseTemTrilha(dados)) return dados;
    var versao = dados.atualizado_em || '';
    if (_itens && _versao === versao) return aplica(dados, _itens);
    try {
      var r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ action: 'historico' }, credenciais || {}))
      });
      if (r.ok) {
        var j = await r.json();
        _itens = (j && j.itens) || {};
        _versao = versao;
      } else {
        console.warn('historico: HTTP ' + r.status);
      }
    } catch (e) {
      console.warn('historico: ' + ((e && e.message) || e));
    }
    // Sem a busca nova, a ultima trilha conhecida e melhor que nenhuma.
    return _itens ? aplica(dados, _itens) : dados;
  }

  var api = { hidrata: hidrata, baseTemTrilha: baseTemTrilha, aplica: aplica };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.HISTCLIENTE = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
