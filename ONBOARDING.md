# ONBOARDING — RoadMap de Melhorias

Documento de passagem. Quem chega consegue rodar, testar e publicar lendo só
isto. As armadilhas listadas aqui não são hipóteses: cada uma quebrou alguma
coisa em produção, e é por isso que estão escritas.

---

## 1. O que é

Painel de roadmap de desenvolvimento da Audax Capital. Acompanha demandas do
backlog à produção, planeja capacidade por dev, roda Planning Poker e gera a
apresentação gerencial.

**Não há servidor, não há build, não há dependências.** São arquivos HTML e JS
estáticos servidos pelo GitHub Pages, mais um Cloudflare Worker. `git clone` e
abrir o arquivo no navegador já é o ambiente de desenvolvimento.

Isso é uma propriedade, e não uma falta: `node teste-invariantes.js` roda em
qualquer máquina com Node e mais nada. Não existe `package.json`. Antes de
introduzir um empacotador, saiba que você está trocando isso por outra coisa.

---

## 2. Arquitetura

```
  navegador                Cloudflare Worker              GitHub
 ┌──────────┐             ┌──────────────────┐        ┌──────────────┐
 │ *.html   │  fetch      │ autentica        │  API   │ repo PRIVADO │
 │ (Pages,  │ ──────────► │ aplica as regras │ ─────► │ do DADO      │
 │  público)│ ◄────────── │ fala com D1 e R2 │ ◄───── │ (melhorias)  │
 └──────────┘             └──────────────────┘        └──────────────┘
                              │        │
                              ▼        ▼
                         D1 (poker)  R2 (anexos)
```

| Peça | Onde | Observação |
|---|---|---|
| Telas | este repo, **público**, via GitHub Pages | publica sozinho no push ao `main` |
| Worker | Cloudflare | **publicação manual** — ver §4 |
| Dado | repo GitHub **privado**, separado | a única porta é o Worker |
| Planning Poker | Cloudflare D1 | salas, participantes, votos |
| Anexos | Cloudflare R2 | referência por chave, nunca base64 novo |

**Por que o dado está em repo privado.** Ele já morou aqui, e este repo é
público: qualquer pessoa com a URL lia a base inteira por
`raw.githubusercontent`. Hoje a única porta é o Worker, que autentica. Não
devolva nenhum arquivo de dado para cá — o `.gitignore` tem uma linha cuidando
disso, e ela tem motivo.

**O que é segredo e onde mora.** Senhas de acesso e o token do GitHub são
*secrets do Cloudflare*, gerenciados por `wrangler secret put` e fora do
versionamento. Nenhum segredo entra neste repo, nem em `wrangler.toml`, nem
como `[vars]` — isso os transformaria em texto puro.

---

## 3. Antes de todo commit

Três comandos, nesta ordem. O primeiro é o que mais se esquece.

```bash
python scripts-tema-versao.py
```

```bash
node teste-invariantes.js
```

```bash
npm i --no-save acorn acorn-walk && node scripts-orfas.js
```

### 3.1 O selo de cache — o passo que não perdoa

`scripts-tema-versao.py` reescreve o `?v=HASH` de todo `<script src>` com o md5
do conteúdo atual. **Rode sempre que editar qualquer `.js` ou `.css`
compartilhado.**

Sem ele, o navegador de quem já abriu o site serve a versão antiga do cache e a
sua correção simplesmente não chega — o código está certo, o deploy foi feito, e
nada muda. Já aconteceu: um `?v=` fixo escrito à mão ficou para trás e o gancho
novo nunca rodou.

Ao criar um `.js` novo, inclua-o com o placeholder `?v=0000000000` e deixe o
script preencher.

### 3.2 As invariantes — 3.489 asserções

`teste-invariantes.js` não casa regex contra o código: ele **recorta a função do
arquivo e a executa**, com `new Function`, contra casos construídos. Uma
invariante que só procura texto passa a aprovar sabotagens — isso aconteceu
várias vezes e está anotado dentro do próprio arquivo.

Ao corrigir um defeito, escreva a invariante que o teria pego, e depois
**sabote**: reintroduza o defeito e confirme que a suíte fica vermelha. Uma
invariante que nunca viu o vermelho não prova nada. O padrão das baterias de
sabotagem está descrito em §7.

### 3.3 Identificadores órfãos

`scripts-orfas.js` usa o acorn para achar função chamada que não existe. Ele
nasceu de um `dentro is not defined` em produção: `node --check` passava, as
invariantes passavam, e o defeito só aparecia no clique do botão.

---

## 4. Publicar

**As telas** — `git push origin main`. O GitHub Pages publica sozinho.

**O Worker** — manual, de dentro de `cloudflare-worker/`:

```bash
npx wrangler deploy
```

> **O CI não publica nada.** Ele roda as invariantes, o scan de órfãs e
> `node --check` no Worker. Subir o `worker.js` ao `main` **não** o coloca no
> ar. Se você mudou o Worker e esqueceu o `wrangler deploy`, o site continua
> rodando a versão anterior — e os sintomas disso são confusos.

**Para diagnosticar o Worker em produção**, esta é a ferramenta que funciona:

```bash
npx wrangler tail --format json
```

---

## 5. As armadilhas

Cada uma destas custou pelo menos uma investigação inteira.

**1. O Worker não importa nada deste repo.** Ele roda isolado na Cloudflare. As
regras de negócio estão escritas **duas vezes** de propósito — aqui e lá — e as
invariantes executam as duas lado a lado contra os mesmos casos. Ao mudar uma
regra, mude as duas, ou a tela e o servidor passam a discordar em silêncio.

**2. A tela nunca pode ser mais rígida que o servidor.** Já aconteceu duas
vezes: a tela barrava o que o servidor aceitaria, e o usuário via "erro" seguido
de "salvo". Quando escrever uma trava na tela, prove caso a caso que ela recusa
exatamente o que o servidor recusa.

**3. Nenhuma migração no caminho de leitura.** Pôr `CREATE TABLE` ou migração na
rota que carrega o quadro já derrubou a tela inteira. Migração vai em rota
própria, ou atrás de um sinalizador que roda uma vez por isolate.

**4. Toda exceção do Worker tem de sair com CORS.** Existe um `try/catch` de
último recurso envolvendo o handler inteiro. Sem ele, uma exceção vira página de
erro da Cloudflare **sem cabeçalho CORS**, e o navegador relata apenas "Failed
to fetch", sem status. Isso foi o teto de uma investigação inteira: nenhum
defeito abaixo dele era diagnosticável. Não remova, e não mexa na indentação do
corpo (ela ficou assim para o diff continuar legível).

**5. No gantt, `::before` e `::after` já têm dono.** São de pausada, atrasado e
quebra; `border` é da herdada, via `border-image`. Para marcar algo novo numa
barra, confira o que sobrou antes — e declare a precedência quando dois sinais
disputarem o mesmo canal, em vez de deixá-la por conta da ordem do arquivo.

**6. Mensagem genérica não pode apagar a específica.** Há um ponto único
(`avisaFalha`) e um sinalizador que diz "já expliquei". Quatro rodadas foram
gastas nisto: toasts genéricos sobrescreviam o motivo real da falha, e o usuário
só via "não foi possível salvar".

---

## 6. Onde moram as regras

Módulos compartilhados: cada um é um IIFE que publica em `window` **e** em
`module.exports`, para a tela e a suíte lerem o mesmo arquivo. Quando a mesma
conta aparece em duas telas, ela vira módulo — duas cópias divergem.

| Módulo | Responde |
|---|---|
| `prazo.js` | prazo efetivo, atraso, pausa suspendendo o relógio |
| `etapa-demanda.js` | qual é a etapa da demanda (gravada × efetiva) |
| `capacidade.js` | capacidade e carga por dev |
| `abertura.js` | com que data uma demanda pode nascer; origem e triagem |
| `prevoo.js` | o que é obrigatório antes de publicar |
| `catalogo.js` | árvore de temas e sistemas |
| `fila.js` | entradas e saídas da fila |
| `vinculo.js` | vínculo entre demandas |
| `subtarefa.js` | subtarefas |
| `anexo-tipos.js` | que anexo abre na tela e que anexo baixa |
| `busca-demanda.js` | busca |
| `dev-nome.js` | normalização de nome de dev |
| `resumo-dev.js`, `resumo-projeto.js` | resumos |
| `pipelines.js`, `grill.js` | pipelines e grade |
| `deck-grafico.js`, `deck-fundo.js` | gramática dos gráficos da apresentação |
| `leitura-estado.js` | leitura de estado compartilhada |

### As telas

| Arquivo | O que é |
|---|---|
| `index.html` | painel público (leitura exige credencial) |
| `admin.html` | administração — a maior, ~14 mil linhas |
| `gantt.html` | planejamento e calendário |
| `dev.html` | painel do dev |
| `poker.html` | Planning Poker |
| `projetos.html` | projetos por tema |
| `follow.html` | acompanhamentos |
| `mensageria.html` | mensageria |
| `importar.html` | importação de demandas |

---

## 7. Como se corrige um defeito aqui

O ciclo que o projeto usa, e que as 3.489 invariantes sustentam:

1. **Meça antes de concluir.** Rode a regra candidata contra a base real e veja
   quantos casos ela muda. Boa parte das suposições deste projeto morreu assim —
   inclusive várias minhas.
2. **Escreva a invariante que teria pego o defeito**, executando a função, não
   casando texto.
3. **Sabote.** Um script que, para cada defeito plausível, aplica a mudança,
   roda a suíte e confirma que ela acusa. O script deve restaurar os arquivos e
   **conferir byte a byte** no fim.
4. **Deixe escrito por quê.** Os comentários longos deste repo não são enfeite:
   eles impedem que a próxima pessoa "conserte" uma decisão deliberada. Há casos
   marcados com `Leia antes de "corrigir"` — leia mesmo.

> Em Windows, scripts de sabotagem precisam de nova tentativa na escrita: o
> painel de prévia segura o arquivo e o `write` falha com EINVAL. E escreva-os
> com um editor de arquivos, não por heredoc — o escape se perde.

---

## 8. O que está em aberto

Herda-se isto junto com o projeto:

- **`exceededCpu` no Worker, não resolvido.** Requisições são mortas pelo teto
  de CPU da Cloudflare. Uma otimização das idas ao D1 foi feita e **medida com
  tráfego real, sem ganho demonstrável** — está honestamente registrada como
  inconclusiva. Próximo suspeito, ainda não testado: a rota de leitura
  materializa o arquivo inteiro com `await res.text()` em vez de repassar
  `res.body` em fluxo.
- **Decisão de modelo de acesso, pendente.** Hoje qualquer usuário autenticado
  lê a base inteira. É intencional? As opções levantadas foram: recortar por
  papel no Worker, remover o histórico da carga do dev, ou manter e documentar.
- **Um secret órfão no Cloudflare.** Existe um segundo token do GitHub guardado
  que **nenhum código lê** — o Worker usa apenas um. Revogue-o no GitHub e
  remova-o do Worker.
- **Arquivo de cache versionado.** `.wrangler/cache/` está rastreado neste repo
  público e não deveria. O `.gitignore` cobre `cloudflare-worker/.wrangler` e
  deixou passar o da raiz.

---

## 9. Passagem de responsabilidade

Acesso ao código **não é o item difícil** — este repo é público e qualquer
pessoa já o lê. O que precisa trocar de mão é o resto:

- [ ] **Repos para a organização da empresa.** Hoje estão numa conta pessoal.
      ⚠️ A transferência muda a URL do GitHub Pages, e o Worker tem a origem
      permitida **fixa no código**. Transferir sem trocar essa constante e
      republicar o Worker derruba a aplicação inteira com erro de CORS. Os dois
      passos são um só.
- [ ] **Acesso à conta Cloudflare**, por convite de membro — Worker, D1, R2 e os
      secrets. Sem isso não se publica o Worker.
- [ ] **Trocar o token do GitHub por um de conta de serviço.** Hoje ele é de uma
      conta pessoal: o Worker lê e grava a base *como aquela pessoa*. Se a conta
      sair, a aplicação para. É o ponto mais frágil da passagem.
- [ ] **Escrita neste repo** — por fork e Pull Request (o CI roda nos PRs), ou
      como colaborador com o `main` protegido. Lembre que o `main` **é** a
      produção: o Pages serve ele.
- [ ] **Itens operacionais de negócio** (demandas pendentes, temas a mesclar)
      não entram neste arquivo, que é público. Passe-os à parte.
