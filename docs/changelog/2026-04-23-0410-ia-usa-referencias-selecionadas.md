---
data: 2026-04-23 04:10
titulo: IA usa as referências selecionadas ao gerar texto
categoria: feat
commit: fa83149
autor: Andrick
status: deployed
---

# IA usa as referências selecionadas ao gerar texto

## Resumo
Quando o aluno seleciona referências no drawer de "Referências" e pede para a IA gerar um capítulo ou mandar uma mensagem no chat, a IA agora recebe essas referências no prompt e é instruída a citar APENAS autores reais dessa lista, no formato ABNT `(SOBRENOME, ANO)`. Fim do risco de ver citações inventadas no texto do TCC.

## Motivação
Essa é a entrega que conecta toda a feature de referências que construímos. Até aqui, o aluno conseguia buscar (OpenAlex), selecionar e favoritar artigos — mas a IA **não sabia da existência deles**. A cada geração, a Gemini inventava autores e obras plausíveis mas fictícias, o que é exatamente o comportamento que a ferramenta precisa evitar para manter credibilidade acadêmica e passar nos detectores de IA dos professores.

Com esta entrega, o fluxo fecha: **buscar → selecionar → gerar → citar de verdade**. É o ponto em que o Teseo começa efetivamente a entregar o valor que o nome promete.

## O que mudou (técnico)
- `src/lib/references.ts` (novo) — utilitários:
  - `firstAuthorSurname(authorsString)` — extrai o sobrenome do primeiro autor e retorna em CAIXA ALTA. Lida com múltiplos formatos de entrada do OpenAlex (`"Silva, J."`, `"Maria Silva"`, etc.).
  - `abntInlineCitation(ref)` — retorna `(SOBRENOME, ANO)` pronta pra colar.
  - `abntReferenceLine(ref)` — gera uma entrada de bibliografia no padrão NBR 6023 simplificado.
  - `buildReferencesContext(refs, max=10, truncAbs=400)` — monta o bloco formatado que é injetado no prompt. Ordena por `citationCount desc`, limita a 10 referências e trunca cada abstract a 400 chars (cabe no context window da Gemini).
- `src/app/api/gerar-tcc/route.ts` — agora busca `prisma.reference.findMany({ where: { tccId, selected: true } })` e injeta o bloco no prompt. A estratégia de citação passa a ser em três níveis:
  1. Se tem refs selecionadas → **usa EXCLUSIVAMENTE essas**, proibido inventar
  2. Senão, se tem PDFs anexados → usa PDFs como base
  3. Senão → conhecimento geral da Gemini (com aviso forte contra alucinação)
  Resposta ganha o campo `referenciasUsadas: number` pra feedback na UI.
- `src/lib/agents/aiox-integration.ts` (chat normal) — mesma lógica. Busca refs selecionadas e injeta um `referencesBlock` no `generationPrompt`, posicionado entre os metadados do TCC e o histórico recente de conversa.
- `src/app/tcc/[id]/page.tsx` — ao receber resposta de `/api/gerar-tcc` com `referenciasUsadas > 0`, insere uma mensagem info no chat: `"✓ Gerado com base em N referência(s) selecionada(s)."`, dando feedback visual pro aluno perceber que o sistema consumiu as escolhas dele.

## Como validar
Com o deploy da Vercel concluído:

1. Abrir um TCC existente
2. No header, clicar em **Referências** → buscar um tema → selecionar de 3 a 5 artigos (✓ no ícone verde)
3. Fechar o drawer. Contador no botão **Referências** deve mostrar o número selecionado em terracota.
4. Na barra de geração (sidebar de chat), escolher um capítulo e clicar **Gerar Capítulo**
5. Esperar a IA responder. Antes do card do capítulo, deve aparecer uma mensagem tipo `"✓ Gerado com base em 3 referências selecionadas."`
6. Ler o texto gerado — deve conter citações no padrão `(SILVA, 2023)`, `(SANTOS, 2022)` com sobrenomes que batem com os autores das referências que você selecionou.
7. Testar o chat normal: com as referências ainda selecionadas, pedir algo tipo "Me dê um parágrafo sobre X" — a resposta deve citar autores reais da lista.
8. Desselecionar tudo no drawer, pedir uma nova geração — o comportamento volta ao antigo (sem citações explícitas ou com autores clássicos gerais).

## Impacto
- **Usuário:** o texto passa a citar **autores reais** que ele escolheu. Credibilidade acadêmica real e muito menos chance de ser flagado em detector de IA.
- **Transparência:** mensagem `"Gerado com base em N referências"` no chat mostra que o sistema está usando as escolhas dele.
- **Qualidade:** o prompt novo instrui explicitamente "se nenhuma referência combinar, escreva sem citação em vez de inventar" — prefere texto honesto a invenção plausível.
- **Performance:** uma query extra `prisma.reference.findMany` por geração (desprezível). Sem aumento perceptível de latência.
- **Custos:** aumento pequeno de tokens no prompt (até ~4k tokens no cenário de 10 refs com abstracts truncados). Dentro do limite normal da Gemini Flash.
- **Breaking change:** não. Se o aluno não tem refs selecionadas, o comportamento é idêntico ao anterior.

## Próximos passos
- **Entrega C (próxima):** tela de comparação de referências favoritas com diferenças destacadas em negrito (IA gera resumo comparativo) + botão "Inserir citação" no editor Tiptap aplicando `(SOBRENOME, ANO)` + adicionando na bibliografia final.
- Considerar no futuro: gerar automaticamente a seção "Referências" do TCC a partir das `selected=true` (usando `abntReferenceLine`), ao invés de depender do aluno compor manualmente.
- Telemetria sugerida: medir taxa de geração com/sem referências selecionadas pra ver se o aluno adota o fluxo.

## Referências
- Commit: `fa83149` (`git show fa83149`)
- Relacionados:
  - [Backend de busca acadêmica](2026-04-22-1910-backend-referencias-semantic-scholar.md)
  - [Troca por OpenAlex](2026-04-23-0010-troca-semantic-scholar-por-openalex.md)
  - [Drawer de Referências](2026-04-23-0130-drawer-referencias-workspace.md)
