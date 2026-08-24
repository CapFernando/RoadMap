Cole o bloco abaixo **uma vez** na conversa de intercorrências. Ele ensina o
formato das suas 78 ocorrências, para as novas nascerem idênticas.

Depois disso, seu fluxo é: colar o e-mail → receber a nota pronta.

---

Vou colar e-mails do time reportando intercorrências de TI. Para cada um, produza
uma nota para o meu vault do Obsidian seguindo exatamente o padrão abaixo.

**Onde:** `Audax Capital/Ocorrencias TI/`

**Nome do arquivo:** `AAAA-MM-DD - [Categoria] Sistema — Resumo curto.md`

- A data é a do e-mail, não a de hoje.
- Categoria: `[BI]` (o caso mais comum), `[Infra]`, `[Plataforma]`, `[Automacao]`,
  `[Lentidao]`, `[Solicitacao]`, `[Diagnostico]`. Se nenhuma servir, escolha uma
  palavra sua e me diga que criou categoria nova.
- O resumo diz o SINTOMA, não o sistema: "Erro grafico evolucao Equiplex CNPJ
  vazio" e não "Problema no BI".
- Sem `\ / : * ? " < > |` no nome. Acento e travessão podem.
- O caminho inteiro tem de caber em 260 caracteres — a pasta já ocupa ~85, então
  o nome fica em até 140.

**Estrutura:**

```markdown
---
tags: [audax, ti, ocorrencias, <sistema>, <modulo>, <palavras-chave>]
data: DD/MM/AAAA
atualizado: DD/MM/AAAA
status: em-andamento | resolvido | monitorando
area: <Área> / <Sistema> — <Módulo>
responsavel: <quem age> (o que faz) · <outro> (o que faz)
solicitante: <quem reportou>
canal: <Teams, e-mail, telefone — ou —>
---

# [Categoria] Sistema — Descrição do problema

## Descrição
O que foi reportado, com **negrito** no que importa. Tabela quando houver dados
concretos (datas, valores, CNPJs, registros afetados).

## Diagnóstico
O que se descobriu que estava causando. Nomes reais de tabela, campo e medida
entre acentos graves.

## Resolução
**Ação 1 (imediata):** o que estancou o sangramento.
**Ação 2 (definitiva):** o que resolve na origem.

## Causa Raiz
Uma frase sobre a causa real, e uma sobre o que faltava para ela não acontecer
(validação ausente, campo sem obrigatoriedade, processo sem conferência).

## Mitigação / Prevenção
- [ ] Tarefas em aberto, cada uma com dono implícito
- [ ] Inclua sempre uma que pergunte "isso está acontecendo em outro lugar?"

## Linha do tempo
| Momento | Evento |
|---|---|
| DD/MM/AAAA | O que aconteceu, na ordem |
```

**Três regras que valem mais que o formato:**

1. **Não invente.** Se o e-mail não diz a causa raiz, escreva "Não identificada no
   relato — depende de apuração" em vez de uma hipótese que vai parecer fato daqui
   a seis meses.
2. **Separe o que aconteceu do que se decidiu.** Descrição e Diagnóstico são fato;
   Resolução e Prevenção são decisão. Misturar os dois faz a nota parecer mais
   certa do que é.
3. **Nomeie as pessoas** em responsavel e solicitante. A nota existe para eu saber
   a quem voltar, e "a área" não responde e-mail.

Se você tiver acesso de escrita ao vault, grave a nota. Se não tiver, me devolva o
markdown completo e o nome do arquivo, que eu salvo.
