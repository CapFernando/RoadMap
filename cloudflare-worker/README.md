# Proxy de gravação — Nova Melhoria (Cloudflare Worker)

Permite que qualquer pessoa envie uma sugestão pelo painel público **sem expor o token do GitHub**.
O token fica guardado como *secret* no Worker; o site nunca o vê.

## Passo a passo

### 1. Criar um token do GitHub (fine-grained)
1. GitHub → Settings → Developer settings → **Fine-grained tokens** → *Generate new token*
2. Repository access: **Only select repositories** → `CapFernando/RoadMap`
3. Permissions → Repository permissions → **Contents: Read and write**
4. Gere e **copie** o token (`github_pat_...`)

### 2. Criar o Worker na Cloudflare (grátis)
1. Crie uma conta grátis em https://dash.cloudflare.com
2. Menu **Workers & Pages** → **Create** → **Create Worker**
3. Dê um nome (ex.: `roadmap-nova-melhoria`) → **Deploy**
4. Clique em **Edit code**, apague o conteúdo e cole **todo** o `worker.js` desta pasta → **Deploy**

### 3. Guardar o token como secret
1. No Worker → **Settings** → **Variables and Secrets**
2. **Add** → tipo **Secret** → Name: `GH_TOKEN` → Value: cole o token do passo 1 → **Deploy**

### 4. Pegar a URL do Worker
Na página do Worker aparece algo como:
```
https://roadmap-nova-melhoria.SEU-SUBDOMINIO.workers.dev
```
Copie essa URL.

### 5. Ligar o painel ao Worker
No `index.html`, no início do `<script>`, preencha:
```js
const NM_PROXY_URL = 'https://roadmap-nova-melhoria.SEU-SUBDOMINIO.workers.dev';
```
Faça commit/push. A partir daí o botão **Nova Melhoria** fica visível para todos e grava com segurança.

## Observações
- O Worker só **adiciona** demandas no Backlog. Ele nunca apaga nem edita nada.
- id, data de criação e status são definidos pelo servidor (não dá para forjar).
- Se aparecer spam, é só excluir no Admin. Depois dá para adicionar Cloudflare Turnstile (anti-bot) — me avise.
- CORS liberado só para `https://capfernando.github.io`.
