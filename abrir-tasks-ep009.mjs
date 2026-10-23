/* Abre as 20 demandas do EP-009 pela API, uma a uma.
 *
 * A CREDENCIAL NAO ESTA AQUI, e nao deve estar: o script le a sua da variavel
 * de ambiente. Rode assim (PowerShell), no diretorio do projeto:
 *
 *     $env:RM_SENHA = "<sua senha do painel>"
 *     node abrir-tasks-ep009.mjs --valendo
 *
 * SEM `--valendo` ele so IMPRIME o que faria, sem tocar na base. Rode seco
 * primeiro: sao 20 gravacoes, e desfazer e 20 exclusoes na mao.
 *
 * UMA DE CADA VEZ, com pausa entre elas. O Worker vem estourando o teto de CPU
 * nas gravacoes grandes; disparar 20 em paralelo e o jeito mais rapido de
 * derrubar as ultimas e ficar sem saber quais entraram.
 */
import fs from 'node:fs';

const API = 'https://roadmap-nova-melhoria.morais-tecnologico.workers.dev';
const PROJETO = 'EP-009';
const VALENDO = process.argv.includes('--valendo');

/* A SENHA SAI DO `config.js`, que e onde ela ja mora — o mesmo arquivo que as
   telas leem, fora do git. Nao se digita aqui nem na linha de comando: linha de
   comando fica no historico do shell, e o valor passaria por mais um lugar sem
   necessidade. `RM_SENHA` continua valendo para quem preferir o ambiente. */
function senha() {
  if (process.env.RM_SENHA) return process.env.RM_SENHA;
  try {
    const cfg = fs.readFileSync(new URL('./config.js', import.meta.url), 'utf8');
    const m = /window\.ADMIN_SENHA\s*=\s*'([^']*)'/.exec(cfg);
    return (m && m[1]) || '';
  } catch (_) { return ''; }
}
const SENHA = senha();

const D = [
  ['Fase 0 · Fechar as 31 decisões de produto da Controladoria',
   'DEC-01..DEC-26 e DEC-30..DEC-34 da AXC-CTRL-BKL-001 v1.2. As 183 tarefas da spec dependem destas respostas. Sete travam arquitetura: dono dos dados (DEC-01), esteira na v1 ou v2 (DEC-03), papel do robô (DEC-14), assinatura (DEC-18), corte do conluio (DEC-21), nomenclatura de tranche (DEC-22), fornecedor de transcrição (DEC-25). Inclui as divergências DEC-35..DEC-43 entre protótipo e levantamento.'],
  ['Base · Domínio de cedente, papéis e vínculo controlador↔cedente',
   'BASE-01, BASE-07 e BASE-08.'],
  ['Base · Esqueleto do módulo, entrada de títulos, auditoria e agendador',
   'BASE-05 (entrada de títulos do Smart e do robô), BASE-09 (log de auditoria), BASE-10 (tarefas agendadas) e BASE-11 (esqueleto do módulo).'],
  ['E1 · Solicitação à Controladoria',
   'E1-01 botão na esteira, E1-02 formulário, E1-03 autorização do cedente, E1-04 regras, E1-05 painel do gestor.'],
  ['E2 · Carteira e distribuição de controladores',
   'E2-01 atribuição automática, E2-02 cedente novo pela coordenação, E2-03 ajudantes por sacado, E2-04 registro de quem executou, E2-05 desativação, E2-06 tela de carteiras.'],
  ['E5 · Dispensa — solicitação, aprovação, revogação e regra por carteira',
   'E5-01 solicitar, E5-02 aprovação, E5-03 dispensa definida pelo crédito na montagem, E5-04 revogação, E5-05 apoio à decisão, E5-06 regra por carteira, E5-07 canal gestão × crédito × Controladoria, E5-08 pacificação, E5-09 volta automática para pendente (esta última cai na Onda 2). Depende de DEC-10 (limite por carteira ou caso a caso) e DEC-16 (dispensa abaixo de R$ 3.000 × envio ao robô abaixo de R$ 30.000).'],
  ['E6 · Decisão do crédito e liberação do pagamento',
   'E6-01 visão do crédito na operação, E6-02 liberação no pré, E6-03 opções de decisão, e as demais de E6.'],
  ['E7 · Pendências, negativas e alertas ao gestor',
   'E7-01 pendência lançada uma vez, E7-02 tipos, E7-03 pendência gerada pela negativa, e os alertas ao gestor.'],
  ['E9 + E13 + E16 · Carta de correção, agenda e card do cedente',
   'E9-01..E9-04 carta de correção e bloqueio de duplicata divergente; E13-01..E13-04 adiar contato com histórico, alerta por data e calendário; E16-01 card do cedente.'],
  ['E11 · Validação de lastro (comissária)',
   'E11-01 card agrupado por cedente, E11-02 checklist de lastro, E11-03 validação automática de domínio, e as demais de E11.'],
  ['E10 · Conluio e fraude',
   'E10-01 adicionar indício, E10-02 conclusão pelo Antifraude, E10-03 vínculo do indício. Depende de DEC-20 (onde registrar a recusa) e DEC-21 (corte de R$ 10.000 e onde roda a checagem de endereço/e-mail).'],
  ['E8 · Duplicata e aceite (agro)',
   'E8-01 etapa de aceite, E8-02 tela de controle de aceite, E8-03 regra de exigência de duplicata por modalidade, e as demais de E8.'],
  ['E12 · Tranche — dimensões, status de entrega e frete',
   'E12-01 dimensões separadas, E12-03 modalidade de frete e as demais. Complementa a AX-610, que hoje cobre só o status. Depende de DEC-22: a v1 tem 4 status e a reunião definiu 6.'],
  ['E14 + E15 · Transcrição, busca por IA, metas e ranking',
   'E14-01 transcrição automática, E14-02 busca por IA, E15-01 meta semanal, E15-03 ranking e bonificação (top 3), E15-04 fim dos relatórios manuais. O dash de indicadores (E15-02) já é a AX-841. Depende de DEC-25.'],
  ['T · Integração v1↔v2, migração das planilhas, avisos e rollout',
   'T-01 avisos, T-02 envio a externos, T-03 antifraude mínimo na v2, T-04 integração v1↔v2, T-05 migração das planilhas, T-06 transição do grupo de WhatsApp, T-07 treinamento e rollout por onda.'],
  ['T-08 · Robô de primeiro contato — integração e telas',
   'T-08 integração com WhatsApp e Chatwoot, mais as telas do Robô: FE-31 estado e controle, FE-32 histórico de disparos, FE-33 relatório, FE-34 metas e projeção. As telas vêm junto porque a integração sem elas não se opera e as telas sem a integração não têm o que mostrar. Novo na v1.2. Depende de DEC-14 (o robô continua, é substituído ou é integrado?).'],
  ['FE · Navegação, Operações, Carteiras e Pré Operação',
   'FE-00 menu, FE-01 Visão Geral, FE-02 dashboard de Operações e detalhe, FE-03 modal "Solicitar Controladoria", FE-04 cards por cedente, FE-05 filtros e busca, FE-06 barra de controladores, FE-07 atribuir controlador pelo card, FE-08 Pré Operação. Telas do mockup controladoria.html.'],
  ['FE · Lista de sacados, amostragem e ações em lote',
   'FE-09 tabela de sacados, FE-10 seleção por amostragem, FE-11 ações em lote, FE-12 drawer "Andamento das notificações", FE-13 drawer de notificação do sacado.'],
  ['FE · Atendimento do sacado',
   'FE-14 chat WhatsApp, FE-15 ligação VOIP com gravação, FE-16 telefones, FE-17 títulos no atendimento, FE-18 vincular anexo como evidência, FE-19 bloqueio por atendimento simultâneo, FE-20 outras operações, FE-21 etiquetas e observações, FE-22 anexos e painel lateral, FE-29 aba Sacado, FE-30 "Robô responde" no chat.'],
  ['FE · Telas de fluxo da Controladoria',
   'FE-23 indícios de conluio, FE-24 tranche e entrega, FE-25 validação de lastro, FE-26 aceite de duplicata, FE-27 cartas de correção, FE-28 demais telas de controladoria-fluxos.html.'],
];

/* O ID VEM FIXO, e nao de uma consulta.
 *
 * Duas tentativas falharam antes desta. A primeira chamava uma rota `projetos`
 * que NAO EXISTE — o ensaio seco nao pegou, porque ele nao chega a falar com o
 * servidor. A segunda caiu em `dados`, que devolve a base inteira: a conexao
 * cortou no meio dos 3 MB (`UND_ERR_SOCKET`), que e o mesmo peso que vem
 * derrubando as publicacoes.
 *
 * Buscar 3 MB para ler um campo e o oposto do que este projeto vem corrigindo.
 * O id e estavel; se um dia mudar, o Worker recusa com `projeto_id nao
 * encontrado` e a mensagem diz exatamente isso. */
const PROJETO_ID = 'prj-mufqforp-j1j3w';   // EP-009 · Ambiente Controladoria
/* O TEMA E OBRIGATORIO na criacao, e o ensaio seco nao pegou — ele nao fala com
   o servidor. A primeira tentativa voltou 400 `tema_id invalido`. Este e o tema
   que 8 das 10 demandas atuais do EP-009 ja usam. */
const TEMA_ID = 'mufqzy7ahmzvk';           // Controladoria
/* A primeira demanda da lista ja foi criada (AX-989) na chamada piloto, que
   serviu para descobrir o campo que faltava. `--pular 1` nao a repete. */
const PULAR = (() => {
  const i = process.argv.indexOf('--pular');
  return i >= 0 ? Number(process.argv[i + 1]) || 0 : 0;
})();

(async () => {
  console.log(VALENDO ? '>> VALENDO: vai gravar na base.' : '>> seco: nada será gravado.');
  if (VALENDO && !SENHA) {
    console.error('Sem credencial: nao achei ADMIN_SENHA em config.js nem $env:RM_SENHA.');
    process.exit(1);
  }
  const pid = PROJETO_ID;
  if (VALENDO) console.log('projeto ' + PROJETO + ' = ' + pid);

  let ok = 0;
  for (let i = PULAR; i < D.length; i++) {
    const [titulo, descricao] = D[i];
    console.log('\n' + String(i + 1).padStart(2) + '. ' + titulo);
    if (!VALENDO) { console.log('    ' + descricao.slice(0, 110) + '…'); continue; }
    const r = await fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'demanda-nova', senha: SENHA,
        titulo, descricao, projeto_id: pid, tema_id: TEMA_ID,
        // Sem dono: quem distribui é o PM/PO, no Planejamento.
        dev: null,
        tipo: 'evolucao',
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { ok++; console.log('    ✅ ' + (j.codigo || j.id || 'criada')); }
    else console.log('    ❌ ' + r.status + ' ' + (j.detail || j.error || ''));
    /* PAUSA LONGA, e nao curta. Com 1,5s a primeira leva deu 503 nas sete
       ultimas — o Worker nao aguenta a cadencia — e uma que respondeu 200
       (AX-1001) foi SOBRESCRITA dois segundos depois por um "admin publica",
       que grava a base inteira por cima. Dar espaco entre as gravacoes reduz
       as duas coisas: o 503 e a janela da corrida. */
    await new Promise((s) => setTimeout(s, 6000));
  }
  if (VALENDO) console.log('\n' + ok + ' de ' + D.length + ' criadas.');
})();
