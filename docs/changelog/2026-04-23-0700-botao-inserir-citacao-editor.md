---
data: 2026-04-23 07:00
titulo: Botão "Citação" no editor com picker das referências selecionadas
categoria: feat
commit: f1f4d74
autor: Andrick
status: deployed
---

# Botão "Citação" no editor com picker das referências selecionadas

## Resumo
A barra de ferramentas do editor do TCC ganhou um botão "Citação". Clicando nele, o aluno vê todas as referências que já selecionou (check verde no drawer), e ao clicar em uma delas, a citação `(SOBRENOME, ANO)` aparece no formato ABNT exatamente onde está o cursor do texto. Se ainda não houver referência selecionada, o picker explica o que o aluno precisa fazer primeiro.

## Motivação
Era o último pedaço da promessa "seu TCC cita artigos reais que você escolheu". Já tínhamos: busca (OpenAlex), seleção (drawer), IA gerando com citações das referências selecionadas, comparação com diferenças em negrito. Faltava o ato manual mais comum: o aluno escreveu uma frase, quer completar com uma citação específica de uma referência que ele já separou. Antes disso, ele teria que sair do editor, olhar o nome do autor, voltar e digitar à mão — tempo perdido e chance de erro no formato ABNT.

Esse era o pedido literal do sócio: "após isso selecionar qual vai manter e inserir na citação no editor".

## O que mudou (técnico)
- `src/components/references/CitationPickerButton.tsx` (novo) — botão que abre um dropdown (popover) com as referências marcadas como `selected: true` no TCC atual. Implementa `firstAuthorSurname` localmente (duplicado do `src/lib/references.ts`) para manter o componente 100% client-side sem depender de imports server-only. Ao clicar numa referência, chama callback `onInsertCitation(text)` com `" (SOBRENOME, ANO) "` (com espaços laterais para não grudar em palavras). Fecha o popover ao clicar numa, clicar fora ou pressionar o botão novamente.
  - Loading state com spinner
  - Error state
  - Empty state explicando que precisa selecionar uma referência antes
  - Mostra citação em terracota + título + veículo/ano em cada item
- `src/components/EditableRichText.tsx` — ganhou prop nova `toolbarExtras?: React.ReactNode` que renderiza depois das ações padrão da MenuBar, separada por divisor vertical. Permite ao pai injetar ações contextuais sem tocar no componente.
- `src/app/tcc/[id]/page.tsx` — passa `<CitationPickerButton>` como `toolbarExtras` do editor. O callback `onInsertCitation` usa o `editorRef` existente para chamar `editor.chain().focus().insertContent(text).run()` do Tiptap, que insere o conteúdo na posição do cursor e devolve o foco ao editor. Dispara evento `CITATION_INSERTED` no analytics.
- `src/lib/analytics.ts` — novo `EventName` `'CITATION_INSERTED'`.

## Como validar
Após deploy:

1. Abrir um TCC no workspace
2. Abrir o drawer de Referências (botão no header), buscar um tema, selecionar ✓ em 2-3 artigos
3. Fechar o drawer
4. Na barra do editor (ao lado do botão de imagem, separado por uma linha vertical), aparece o botão **📑 Citação**
5. Posicionar o cursor num parágrafo do texto, clicar em "Citação"
6. Popover abre mostrando as referências em uso — cada uma com a citação `(SOBRENOME, ANO)` em terracota, título e veículo/ano
7. Clicar em uma → a citação é inserida exatamente no ponto do cursor do editor, com um espaço antes e depois
8. Escrever normalmente no editor, posicionar cursor em outro ponto, abrir o popover de novo — lista se mantém atualizada
9. Testar com **zero refs selecionadas**: popover mostra empty state "Nenhuma referência selecionada ainda..."
10. Trocar seleção no drawer (desmarcar uma) e abrir o popover — a lista atualiza (fetch a cada abertura)

## Impacto
- **Usuário:** escrever com citações ABNT deixa de ser digitação manual e passa a ser 2 cliques. Reduz erro de formato (`(SILVA, 2023)` sempre formatado certo, em caixa alta, com vírgula). Dá sensação de produto real, não rascunho.
- **Performance:** popover faz 1 fetch ao abrir (cacheado pelo browser por sessão). Insert é síncrono no Tiptap (milissegundos).
- **Segurança:** usa endpoints existentes com ownership check. Nenhuma nova superfície.
- **Breaking change:** não. `toolbarExtras` é opcional no `EditableRichText`.

## Próximos passos
- **Futuro próximo:** geração automática da seção "Referências" no final do TCC a partir das `selected=true`, aplicando o formato NBR 6023 (função `abntReferenceLine` já existe em `src/lib/references.ts`). Botão "Gerar lista de referências" na toolbar ou menu de exportação.
- Teclas de atalho: `Ctrl+Shift+C` abrir o picker (atalho padrão do Notion pra citações).
- Quando a entrega de ABNT determinística entrar (Fase 3 da arquitetura), o picker pode adicionar metadados invisíveis (span com `data-ref-id`) para o validador encontrar a referência no texto e verificar coerência com a bibliografia final.

## Referências
- Commit: `f1f4d74` (`git show f1f4d74`)
- Relacionados:
  - [Drawer de Referências](2026-04-23-0130-drawer-referencias-workspace.md)
  - [IA usa referências selecionadas](2026-04-23-0410-ia-usa-referencias-selecionadas.md)
  - [Comparação com IA](2026-04-23-0600-comparacao-referencias-ia.md)
