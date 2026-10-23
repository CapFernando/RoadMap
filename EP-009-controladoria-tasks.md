# EP-009 · Ambiente Controladoria — o que abrir

Fonte: `AXC-CTRL-BKL-001 v1.2` (46 páginas, **183 tarefas em 8 blocos**) +
`mockup controladoria.html` + `Módulo de Controladoria Artefato.html`.

Teto de 30 demandas no projeto. Já existem **10** → cabem **20 novas**.

---

## 1. Validação do que já está aberto

As 10 demandas atuais cobrem **27 das 183 tarefas** da especificação (15%).
Nenhuma precisa ser fechada ou refeita; três precisam de ajuste de escopo.

| Demanda | Etapa | O que cobre na spec | Situação |
|---|---|---|---|
| AX-572 Operação, títulos, sacados | Backlog | BASE-02, BASE-03, BASE-04 | ✅ bate |
| AX-608 Leitura do código v1 e v2 | Planejado | descoberta técnica (base do doc) | ✅ bate |
| AX-609 Limites e rating do cedente | Planejado | BASE-06 | ✅ bate |
| AX-610 Status de tranche (v2) | Em andamento | E12-02 | ⚠️ **parcial** — E12 tem 6 tarefas (dimensões separadas, modalidade de frete, nomenclatura). Ver DEC-22: a v1 tem 4 status e a reunião definiu 6. |
| AX-611 Controle de notificações | Planning | E3 (12 tarefas) | ⚠️ **título largo demais** — E3 inclui fila, máquina de status, trava de contato, amostragem, roteiro. Sugiro usar esta como "E3 · Fila e máquina de status" e tirar o resto para a nova de evidências. |
| AX-612 Parecer da Controladoria | Planning | E4 (7 tarefas) | ⚠️ **parcial** — E4 é anexos tipados, anexo em massa, trava de qualidade, reabertura e evidência para a Cobrança. |
| AX-727 Fluxo visual | Concluído | DEC-31 (validar protótipo) | ✅ fechada, e o mockup é o resultado |
| AX-841 Dash de monitoramento | Em andamento | E15-02 (indicadores) | ✅ bate, parte de E15 |
| AX-874 UML + C4 Model | Validação área | fundação de arquitetura | ✅ bate |
| AX-875 Desenho do fluxo de dados | Validação área | fundação de arquitetura | ✅ bate |

**Buracos grandes, hoje sem nenhuma demanda:** as 31 decisões da Fase 0, toda a
Onda 2 (pendências, carta de correção, agenda), toda a Onda 3 (lastro, conluio,
duplicata), os transversais (integração v1↔v2, migração, robô) e **as 35 telas
do protótipo**.

---

## 2. As 20 demandas a abrir

Agrupadas por épico — a mesma granularidade das 10 que já existem.
O rótulo `[IDs]` diz quais tarefas da spec cada uma fecha.

### Fase 0 — destrava o resto (1)

**1. Fase 0 · Fechar as 31 decisões de produto da Controladoria**
As 183 tarefas dependem destas respostas. Sete são bloqueadoras de arquitetura:
quem é dono dos dados (DEC-01), esteira fica na v1 ou vem para a v2 (DEC-03),
papel do robô (DEC-14), assinatura (DEC-18), corte do conluio (DEC-21),
nomenclatura de tranche (DEC-22), fornecedor de transcrição (DEC-25).
`[DEC-01..DEC-26, DEC-30..DEC-34]` · 31 tarefas

### Base · Fundação (2)

**2. Base · Domínio de cedente, papéis e vínculo controlador↔cedente**
`[BASE-01, BASE-07, BASE-08]`

**3. Base · Esqueleto do módulo, entrada de títulos, auditoria e agendador**
Entrada de títulos vinda do Smart e do robô, log de auditoria e tarefas
agendadas — a espinha que as ondas usam.
`[BASE-05, BASE-09, BASE-10, BASE-11]`

### Onda 1 · Núcleo da notificação (4)

**4. E1 · Solicitação à Controladoria**
Botão na esteira, formulário, autorização do cedente, regras e painel do gestor.
`[E1-01..E1-05]`

**5. E2 · Carteira e distribuição de controladores**
Atribuição automática, cedente novo pela coordenação, ajudantes por sacado,
registro de quem executou, desativação e tela de carteiras.
`[E2-01..E2-06]`

**6. E5 · Dispensa — solicitação, aprovação, revogação e regra por carteira**
Inclui o canal gestão × crédito × Controladoria, a pacificação e a volta
automática para pendente (esta cai na Onda 2). Depende de DEC-10 (limite por
carteira ou caso a caso) e DEC-16 (dispensa abaixo de R$ 3.000 × envio ao robô
abaixo de R$ 30.000 — a spec pergunta se são regras diferentes).
`[E5-01..E5-09]` · 9 tarefas

**7. E6 · Decisão do crédito e liberação do pagamento**
Visão do crédito na operação, liberação no pré, opções de decisão.
`[E6-01..E6-06]`

> E3 e E4 **não entram aqui** — já existem como AX-611 e AX-612. Ver os ajustes
> de escopo na tabela acima.

### Onda 2 · Pendências e acompanhamento (2)

**8. E7 · Pendências, negativas e alertas ao gestor**
Pendência lançada uma vez, tipos, pendência gerada pela negativa, alertas.
`[E7-01..E7-06]`

**9. E9 + E13 + E16 · Carta de correção, agenda/follow-up e card do cedente**
Carta de correção e bloqueio de duplicata divergente; adiar contato com
histórico, alerta por data e calendário; card do cedente na Controladoria.
`[E9-01..E9-04, E13-01..E13-04, E16-01]` · 9 tarefas

### Onda 3 · Modalidades específicas (4)

**10. E11 · Validação de lastro (comissária)**
Card agrupado por cedente, checklist, validação automática de domínio.
`[E11-01..E11-05]`

**11. E10 · Conluio e fraude**
Indício, conclusão pelo Antifraude, vínculo do indício. Depende de DEC-20 e
DEC-21 (o corte de R$ 10.000 e onde roda a checagem de endereço/e-mail).
`[E10-01..E10-05]`

**12. E8 · Duplicata e aceite (agro)**
Etapa de aceite, tela de controle, regra de exigência por modalidade.
`[E8-01..E8-07]` · 7 tarefas

**13. E12 · Tranche — dimensões, status de entrega e frete**
Complementa AX-610, que hoje cobre só o status. Depende de DEC-22.
`[E12-01, E12-03..E12-06]`

### Onda 4 · Inteligência (1)

**14. E14 + E15 · Transcrição, busca por IA, metas e ranking**
Transcrição automática e busca por IA sobre as evidências; meta semanal,
ranking top 3 e fim dos relatórios manuais. O dash (E15-02) já é o AX-841.
Depende de DEC-25 (fornecedor, custo e política de dados).
`[E14-01, E14-02, E15-01, E15-03, E15-04]`

### Transversais (2)

**15. T · Integração v1↔v2, migração das planilhas, avisos e rollout**
Avisos, envio a externos, antifraude mínimo, integração v1↔v2, migração das
planilhas, transição do grupo de WhatsApp, treinamento e rollout por onda.
`[T-01..T-07]` · 7 tarefas

**16. T-08 · Robô de primeiro contato — integração e telas**
Integração com WhatsApp e Chatwoot, mais as quatro telas do Robô: estado e
controle, histórico de disparos, relatório, metas e projeção.
**As telas vêm junto de propósito** — a integração sem as telas não se opera, e
as telas sem a integração não têm o que mostrar; separadas, seriam duas
demandas que só fecham ao mesmo tempo. Depende de DEC-14 (o robô continua, é
substituído ou é integrado?), que está na demanda 1.
`[T-08, FE-31..FE-34]` · 5 tarefas · **novo na v1.2**

### Front · telas do protótipo (4)

**17. FE · Navegação, Operações, Carteiras e Pré Operação**
Menu, Visão Geral, dashboard de Operações e detalhe, modal "Solicitar
Controladoria", cards de carteira por cedente, filtros e busca, barra de
controladores, atribuir controlador pelo card e Pré Operação.
`[FE-00..FE-08]` · 9 telas

**18. FE · Lista de sacados, amostragem e ações em lote**
Tabela de sacados, seleção por amostragem, ações em lote, drawers de andamento
e de notificação.
`[FE-09..FE-13]` · 5 telas

**19. FE · Atendimento do sacado**
Chat WhatsApp, VOIP com gravação, telefones, títulos, vincular anexo como
evidência, bloqueio por atendimento simultâneo, outras operações, etiquetas,
painel lateral com aba Sacado e "Robô responde" no chat.
`[FE-14..FE-22, FE-29, FE-30]` · 11 telas

**20. FE · Telas de fluxo da Controladoria**
Indícios de conluio, tranche e entrega, validação de lastro, aceite de
duplicata, cartas de correção e as demais telas de `controladoria-fluxos.html`.
`[FE-23..FE-28]` · 6 telas

---

## 3. Cobertura

| | tarefas |
|---|---|
| Já cobertas pelas 10 atuais | 27 |
| Cobertas pelas 20 novas | 156 |
| **Total** | **183 de 183** |

As 9 divergências `DEC-35..DEC-43` (protótipo × levantamento) ficam dentro da
demanda 1, porque são decisões e não construção.

---

## 4. Ordem sugerida

1. **Fase 0** (demanda 1) antes de qualquer código — 7 das 31 decisões travam arquitetura.
2. **Base** (2 e 3) em paralelo com o Front de navegação (16).
3. **Onda 1** (4..7 + AX-611 + AX-612) — é o núcleo que entrega valor sozinho.
4. Ondas 2 e 3 por modalidade, conforme o agro e a comissária pedirem.
5. Onda 4 por último: depende de evidência acumulada para a IA ter o que buscar.
