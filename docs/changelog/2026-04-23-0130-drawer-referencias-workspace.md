---
data: 2026-04-23 01:30
titulo: Drawer de Referências no workspace (seleção + favoritos)
categoria: feat
commit: 5e81b13
autor: Andrick
status: deployed
---

# Drawer de Referências no workspace (seleção + favoritos)

## Resumo
O aluno agora tem um painel dedicado de referências dentro do workspace do TCC, com busca acadêmica embutida, lista de artigos, seleção de quais a IA vai usar pra escrever, e um sistema de favoritos pra comparar referências depois. Toda a UI fica escondida atrás de um botão discreto no topo, não atrapalha quem não quer usar ainda.

## Motivação
O sócio pediu uma experiência inspirada no Smile AI: um painel separado pra consultar cada referência (título + resumo) sem sair do fluxo do editor, com a possibilidade de favoritar para comparar depois. O design tinha que respeitar o workspace atual, ser minimalista e orientado ao público brasileiro de TCC — que está em cima do prazo, quer clareza e não suporta telas cheias de informação.

A separação entre "selecionado" (a IA vai usar) e "favoritado" (estou considerando) é importante porque o aluno precisa comparar artigos antes de decidir. Sem isso, ele ou seleciona todos ou não seleciona nenhum.

## O que mudou (técnico)
- `prisma/schema.prisma` — `Reference` ganhou `favorited: Boolean` e `favoritedAt: DateTime?`.
- `prisma/migrations/20260423011000_add_reference_favorited/migration.sql` — migration aditiva (ADD COLUMN), aplicada em produção com `prisma migrate deploy`.
- `src/app/api/tcc/[id]/references/[refId]/route.ts` — `PATCH` agora aceita `selected` e/ou `favorited`. Pelo menos um dos dois é obrigatório. Seta automaticamente os timestamps (`selectedAt`, `favoritedAt`).
- `src/app/api/tcc/[id]/references/route.ts` — `GET` passa a ordenar por `selected desc, favorited desc, createdAt desc`, trazendo primeiro o que o aluno já decidiu usar.
- `src/components/references/ReferencesDrawer.tsx` (novo) — drawer lateral direita com overlay, header com contador (`20 encontradas · 3 em uso · 2 favoritas`), search com auto-fill do título do TCC, filter chips (`Todas / Em uso / Favoritas`), lista scrollable, cards de referência com abstract expandível via animação framer-motion, 2 ações por card (selecionar ✓ e favoritar ★), empty states diferentes pra cada filtro, CTA "Comparar" no footer desabilitado até ter ≥2 favoritas (implementação virá na próxima entrega), fecha com ESC ou click no backdrop.
- `src/app/tcc/[id]/page.tsx` — novo botão "Referências" no header do workspace (entre os controles de review e o AiActionToolbar). Quando há selecionadas, mostra contador discreto em cor de destaque (terracota). Drawer é renderizado junto dos modais. Estados `referencesOpen` e `selectedRefsCount` controlam abertura e contador.
- Updates otimistas: toggle de selecionar/favoritar é instantâneo na UI; se a API falhar, o estado é revertido.

## Como validar
Com o deploy da Vercel concluído:

1. Abrir um TCC existente no workspace
2. Clicar no botão **Referências** no header (canto direito, próximo à barra de ações da IA)
3. Drawer desliza da direita, sobrepondo a sidebar atual
4. No empty state, clicar em **Buscar agora** — deve retornar ~20 artigos sobre o tema do TCC, em português/inglês
5. Clicar em **Ler resumo** em qualquer card — abstract aparece com animação
6. Clicar no ✓ verde (lado direito) — card fica levemente destacado e contador "em uso" sobe
7. Clicar na ★ (abaixo do ✓) — card fica com ícone de estrela preenchida ao lado do título
8. Usar os chips **Em uso** e **Favoritas** pra filtrar — lista reage instantaneamente
9. Fechar com o X, ESC ou click no backdrop
10. Reabrir — o estado persiste (está no banco)
11. Voltar ao header: o botão **Referências** agora mostra o número de selecionadas em terracota

## Impacto
- **Usuário:** primeira experiência real de poder **escolher as referências** antes de gerar conteúdo. Passo fundamental pro Teseo parar de parecer "um wrapper de ChatGPT" e virar uma ferramenta acadêmica séria.
- **Design:** drawer é opt-in — quem não abre não vê diferença no workspace.
- **Performance:** toggles são otimistas (UI instantânea), busca leva ~1s (API do OpenAlex).
- **Segurança:** todas as rotas continuam checando ownership do TCC.
- **Breaking change:** não. `Reference.favorited` tem default `false`, registros antigos não são afetados.

## Próximos passos
- **Entrega 2b (próxima):** tela de comparação lado a lado das referências favoritas (aparece ao clicar em "Comparar" quando há ≥2 favoritas). Mostra abstracts lado a lado com opção de escolher uma, ou marcar as 2.
- **Entrega 3:** integrar com `/api/gerar-tcc` pra que o prompt enviado à IA inclua os artigos selecionados, forçando citações no padrão ABNT.
- **Entrega 4:** botão "Inserir citação" no editor Tiptap que abre um picker das referências selecionadas e aplica `(SOBRENOME, ANO)` no texto + adiciona na lista final.

## Referências
- Commit: `5e81b13` (`git show 5e81b13`)
- Entregas relacionadas:
  - [Backend Semantic Scholar](2026-04-22-1910-backend-referencias-semantic-scholar.md)
  - [Troca para OpenAlex](2026-04-23-0010-troca-semantic-scholar-por-openalex.md)
  - [Filtro de idiomas](2026-04-23-0050-filtro-idiomas-busca-referencias.md)
