---
data: 2026-04-23 08:30
titulo: Botão "Gerar refs" monta a seção REFERÊNCIAS no final do TCC
categoria: feat
commit: 34aa443
autor: Andrick
status: deployed
---

# Botão "Gerar refs" monta a seção REFERÊNCIAS no final do TCC

## Resumo
A barra do editor ganhou um botão "Gerar refs" ao lado do botão "Citação". Com um clique, o Teseo adiciona (ou atualiza) a seção **REFERÊNCIAS** no final do documento, com todas as referências que o aluno selecionou, formatadas em ABNT NBR 6023 e em ordem alfabética pelo sobrenome do primeiro autor. Se o aluno selecionar mais uma referência depois e clicar de novo, a seção é substituída automaticamente — nunca duplica.

## Motivação
Todo TCC em ABNT exige duas coisas relacionadas a citação:
1. Citação **inline** no texto, ex: `(SILVA, 2023)` — já tínhamos (botão "Citação").
2. Lista **bibliográfica completa** no final do documento — não tínhamos.

Sem a segunda, o orientador reprova. O aluno teria que fazer manualmente: abrir o drawer, copiar cada referência, formatar no padrão ABNT (`AUTOR, Nome. Título. Veículo, ANO. DOI.`), colar no final do doc. Minutos (ou horas) de trabalho braçal, alto risco de erro de formato. Essa era a pergunta literal do sócio: **"para que essa parte de exportar seção referencias automaticamente?"** — explicação dada e aprovada pra implementar.

## O que mudou (técnico)
- `src/components/references/GenerateReferencesButton.tsx` (novo) — botão na toolbar do editor. Ao clicar:
  1. Faz `GET /api/tcc/[id]/references` e filtra apenas as `selected=true`.
  2. Ordena por sobrenome do primeiro autor (`a.authors.localeCompare(b.authors, "pt-BR")`).
  3. Monta cada linha no padrão NBR 6023 simplificado: `AUTORES EM CAIXA ALTA. Título. <em>Veículo</em>, ano. DOI: x.`
  4. Agrupa tudo em `<h2>REFERÊNCIAS</h2>` + `<p>` por entrada, **cada elemento marcado com `data-teseo-refs="true"`**.
  5. Chama o callback `onInsertSection(html)`.
  - Feedback visual: ícone muda pra check verde e texto mostra `"N inseridas"` por 2,5 segundos; se não houver refs selecionadas, mostra `"Sem refs"`.
- `src/app/tcc/[id]/page.tsx` — conecta o callback `onInsertSection` ao editor Tiptap:
  1. Pega `editor.getHTML()`.
  2. Remove blocos antigos com regex sobre `data-teseo-refs="true"` (cobre `<h1>-<h6>`, `<p>` e `<div>`).
  3. `editor.commands.setContent(cleaned + sectionHtml)` — aplica no editor.
  4. `editor.chain().focus("end").run()` — devolve o foco no final do documento pra o aluno ver a seção sendo criada.
- `src/lib/analytics.ts` — novo event `REFERENCES_SECTION_GENERATED`.

## Por que usar `data-teseo-refs="true"` como marcador
Sem marcador, seria preciso detectar "onde começa a seção de referências" por heurística (procurando `<h2>REFERÊNCIAS`) — frágil porque o aluno pode ter um capítulo chamado "Referências Teóricas" e a regex iria apagar a coisa errada. O marcador `data-teseo-refs="true"` é invisível no texto final (Tiptap/navegador não renderizam atributos data) mas deixa claro "isso foi o Teseo que gerou e é seguro substituir". Deixa o comportamento determinístico e idempotente.

## Como validar
Após deploy:

1. Abrir um TCC, escrever alguns parágrafos
2. Abrir drawer de Referências, buscar, selecionar ✓ em 3-4 artigos
3. Fechar o drawer, voltar ao editor
4. Clicar no botão **"Gerar refs"** na toolbar (ao lado de "Citação")
5. Ícone vira check verde com `"3 inseridas"` por 2 segundos
6. No final do documento, aparece:
   ```
   REFERÊNCIAS
   SOBRENOME1, Nome. Título 1. Veículo, 2023.
   SOBRENOME2, Nome. Título 2. Conferência, 2022.
   ...
   ```
   Ordem alfabética por autor.
7. Voltar ao drawer, selecionar mais uma referência, fechar
8. Clicar em "Gerar refs" de novo → a seção é **substituída** (não duplicada), agora com 4 entradas
9. Desmarcar todas no drawer, clicar "Gerar refs" → seção mostra "Nenhuma referência selecionada ainda."

## Impacto
- **Usuário:** economia direta de tempo e zero erro de formato ABNT. Um dos maiores stressors do aluno de TCC (formatar bibliografia) vira 1 clique.
- **Fluxo completo fechado:** buscar → selecionar → comparar → inserir citação inline → gerar lista final. O ciclo de referências está 100% implementado.
- **Segurança:** usa endpoints existentes com ownership check. Nenhuma nova superfície.
- **Performance:** 1 fetch + manipulação de string + setContent do Tiptap — milissegundos.
- **Breaking change:** não.

## Limitações conhecidas
- O padrão NBR 6023 usado é simplificado. Casos raros (livros com edição, capítulos de livro, dissertações) ainda não são tratados especificamente — o OpenAlex retorna principalmente artigos/conferências. Pra esses casos específicos, o aluno precisa ajustar a linha manualmente.
- A regex de substituição assume que os `data-teseo-refs` atuais vêm exatamente do formato emitido por este componente. Se o aluno editar manualmente as linhas depois, o próximo "Gerar refs" pode ou não preservar as edições — comportamento intencional, o botão serve pra regenerar do banco.

## Referências
- Commit: `34aa443` (`git show 34aa443`)
- Relacionados:
  - [Drawer de Referências](2026-04-23-0130-drawer-referencias-workspace.md)
  - [Botão Citação](2026-04-23-0700-botao-inserir-citacao-editor.md)
  - [Comparação com IA](2026-04-23-0600-comparacao-referencias-ia.md)
