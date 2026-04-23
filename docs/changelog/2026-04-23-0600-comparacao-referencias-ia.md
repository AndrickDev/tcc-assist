---
data: 2026-04-23 06:00
titulo: Comparação de referências com IA destacando diferenças em negrito
categoria: feat
commit: 06d8786
autor: Andrick
status: deployed
---

# Comparação de referências com IA destacando diferenças em negrito

## Resumo
Quando o aluno favorita 2 ou mais referências no drawer, pode clicar em "Comparar" e um orientador IA gera um resumo comparativo curto (300-500 palavras), destacando em **negrito** exatamente o que é diferente entre os artigos — metodologia, foco, ano, conclusão. No final, uma linha "Sugestão:" indica qual combina mais com o tema e o objetivo do TCC. Direto da tela de comparação o aluno clica em "Usar esta" e a referência escolhida entra no conjunto que a IA vai usar nas próximas gerações.

## Motivação
O sócio pediu diretamente: "Na hora de comparar pode criar mais uma janela à parte e só mostrar o resumo da comparação deixando em negrito o que realmente tem de diferença entre uma e outra para dar ênfase e entender. E após isso selecionar qual vai manter e inserir na citação no editor."

Ler 4 abstracts inteiros pra decidir entre artigos similares é cansativo e o aluno médio não tem paciência — ou escolhe no olhômetro ou seleciona todos. A ideia da comparação com diferenças em negrito resolve isso: em vez de ler 4 resumos, ele lê 1 parágrafo que já aponta o que efetivamente difere.

## O que mudou (técnico)
- `src/app/api/tcc/[id]/references/compare/route.ts` (novo) — endpoint `POST` que recebe `{ refIds: string[] }` (mínimo 2, máximo 5). Valida ownership do TCC, busca as referências no banco, monta um prompt estruturado e chama a Gemini Flash via `callGemini`. O prompt é bem explícito:
  - Contexto: tema + objetivo do TCC
  - Lista as referências como `[REF A]`, `[REF B]`, ... com citação ABNT, título, autores, ano, veículo, abstract truncado em 800 chars e citationCount
  - Regra crítica: `**negrito**` APENAS no que DIFERE entre referências (não é para destaque genérico)
  - Proibido: inventar dados, copiar literal do abstract, usar headings, listas longas
  - Obrigatório: terminar com linha `"Sugestão:"` indicando qual combina mais com o tema/objetivo
  - Retorna `{ summaryMarkdown, references: [...] }` com versão abreviada das refs
- `src/components/references/ReferencesCompareModal.tsx` (novo) — modal full-screen com backdrop blur. Animação spring via framer-motion. Loading state com `"O orientador está comparando as referências..."`. Mini-parser de markdown inline (`**bold**` + parágrafos) para não depender de lib pesada. Cada card de referência tem botão `Usar esta` que chama `onSelectReference(refId)` — o drawer que invocou é responsável por marcar `selected=true` e fechar a modal. ESC fecha, click no backdrop fecha.
- `src/components/references/ReferencesDrawer.tsx` — estado novo `compareOpen` e `compareIds`. Botão "Comparar" do footer agora:
  - Fica habilitado quando há 2+ favoritas
  - Mostra label dinâmico: `"Comparar (N)"` onde N = min(favoritas, 5)
  - Ao clicar, pega as primeiras 5 favoritas, popula `compareIds` e abre o modal
  - Ao `onSelectReference`: chama `togglePatch({ selected: true })` (reaproveita infra) e fecha o modal

## Como validar
Após deploy:

1. Abrir um TCC no workspace
2. Clicar em **Referências** no header → buscar um tema → encontrar 4-5 artigos
3. Favoritar 2 ou mais com a estrela ★
4. No footer do drawer, o botão "Comparar" agora deve mostrar `"Comparar (N)"` e estar habilitado
5. Clicar em **Comparar** — modal abre com um ícone de `⇆` e um loading de ~3-5s
6. Aparece o resumo da IA: 2-4 parágrafos curtos, com trechos em **cor terracota** marcando as diferenças
7. Abaixo, cards compactos de cada referência comparada com botão **"Usar esta"**
8. Linha final começando com `"Sugestão:"` recomenda a mais aderente ao TCC
9. Clicar em `Usar esta` numa referência — o modal fecha, a ref vai pra "Em uso" no drawer
10. Recarregar a página — estado persiste (já persistido via PATCH)

## Impacto
- **Usuário:** reduz o trabalho de decidir entre artigos parecidos de "ler 4 abstracts" pra "ler 1 parágrafo com as diferenças marcadas". Público brasileiro de TCC ama atalhos inteligentes que respeitam o pouco tempo dele.
- **Qualidade acadêmica:** o aluno tende a escolher melhor quando vê as diferenças explícitas, em vez de escolher pela capa (título + ano).
- **Custos:** uma chamada Gemini Flash por comparação (~1200-2000 tokens input + 500-1000 output). Barato. Limite de 5 refs por comparação pra não estourar context.
- **Performance:** 2-5 segundos de loading pela geração da Gemini. Percepção é boa porque o loading state explica que "o orientador está comparando".
- **Segurança:** ownership check do TCC + filtro dos refIds só aceita refs do próprio TCC.
- **Breaking change:** não.

## Próximos passos
- **Entrega C2:** botão "Inserir citação" no editor Tiptap. Picker das referências selecionadas, clicar numa e ela aplica `(SOBRENOME, ANO)` na posição do cursor + adiciona na seção "Referências" no final do documento.

## Referências
- Commit: `06d8786` (`git show 06d8786`)
- Relacionados:
  - [Drawer de Referências](2026-04-23-0130-drawer-referencias-workspace.md)
  - [IA usa referências selecionadas](2026-04-23-0410-ia-usa-referencias-selecionadas.md)
