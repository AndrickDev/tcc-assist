---
data: 2026-04-23 03:30
titulo: Lixeira para apagar mensagens do histórico do chat
categoria: feat
commit: 9b11e16
autor: Andrick
status: deployed
---

# Lixeira para apagar mensagens do histórico do chat

## Resumo
O aluno agora pode apagar mensagens individuais do histórico do chat do workspace — tanto as que ele escreveu quanto as respostas geradas pela IA. Útil pra limpar rascunhos descartados, tentativas anteriores ou introduções que não vão ser usadas, mantendo a tela focada no que importa.

## Motivação
O sócio pediu: "coloque também um botão de lixeira para apagar dentro do workspace as coisas geradas pela IA aonde tem essa janela de comparar e inserir as introdução feita o que seja para não ficar tão poluído o histórico caso a pessoa queira organizar". O chat acumulava rapidamente conforme o aluno ia pedindo gerações e revisões, e não havia como tirar da tela o que não serviu. Qualquer teste longo virava um scroll infinito.

A mudança é pequena mas muda muito a sensação de controle — agora o aluno curadora o próprio histórico.

## O que mudou (técnico)
- `src/app/api/tcc/[id]/messages/[messageId]/route.ts` (novo) — rota `DELETE` com ownership check do TCC. Usa `prisma.message.deleteMany` (não erra se o `messageId` não existir no banco, cenário comum quando a mensagem ainda está apenas no estado local do frontend antes de sincronizar).
- `src/app/tcc/[id]/page.tsx` — nova função `handleDeleteMessage(messageId)` com update otimista: remove da UI imediatamente e tenta apagar no backend em background. Falha silenciosa se algo der errado (usuário já viu o resultado).
- UI:
  - Mensagens do usuário: botão lixeira à esquerda da bolha, aparece ao passar o mouse (`opacity-0 group-hover:opacity-100`), vermelho discreto.
  - Mensagens da IA: botão lixeira no header do card, ao lado do botão "Revisar". Sempre visível (ações da IA são as mais frequentemente limpas).
  - Animação de saída com `exit={{ opacity: 0, height: 0 }}` via framer-motion — card colapsa suavemente ao ser removido.
- `src/lib/analytics.ts` — novo event name `MESSAGE_DELETED`, disparado a cada exclusão com `plan`.

## Como validar
Com o deploy da Vercel concluído:

1. Abrir um TCC com várias mensagens no histórico do chat
2. Passar o mouse sobre uma mensagem que **você escreveu** — deve aparecer um ícone de lixeira discreto à esquerda
3. Clicar — a mensagem some com animação suave
4. Numa mensagem **da IA**, procurar o ícone de lixeira no canto superior direito do card (ao lado de "Revisar"), visível sempre
5. Clicar — o card colapsa
6. Recarregar a página (F5) — as mensagens apagadas continuam fora do histórico (está persistido no banco)
7. Tentar numa mensagem recém-gerada (ainda não recarregou a página) — deve funcionar igual, e não volta no próximo reload

## Impacto
- **Usuário:** controle real sobre o histórico. Menos poluição visual. Sensação de "workspace limpo" depois de algumas tentativas.
- **Segurança:** rota nova exige sessão e verifica ownership do TCC antes de deletar. `deleteMany` restringe pelo `tccId` pra evitar qualquer deleção cross-tenant.
- **Performance:** update otimista faz a UI reagir instantaneamente; a chamada HTTP é assíncrona em background.
- **Breaking change:** não.

## Próximos passos
- **Entrega B (próxima):** IA passa a receber as referências selecionadas no prompt de geração (`/api/gerar-tcc` e `/api/chat`). O texto que a IA escreve começa a citar `(SILVA, 2023)` de artigos reais que o aluno escolheu, em vez de inventar.
- **Entrega C:** modal de comparação de referências favoritas (IA destaca diferenças em negrito) + botão "Inserir citação" no editor Tiptap.

## Referências
- Commit: `9b11e16` (`git show 9b11e16`)
- Relacionados: [Drawer de Referências](2026-04-23-0130-drawer-referencias-workspace.md)
