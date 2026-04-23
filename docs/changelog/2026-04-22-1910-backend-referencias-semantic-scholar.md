---
data: 2026-04-22 19:10
titulo: Backend de busca acadêmica via Semantic Scholar
categoria: feat
commit: b42057a
autor: Andrick
status: deployed
---

# Backend de busca acadêmica via Semantic Scholar

## Resumo
O Teseo agora pode buscar artigos acadêmicos reais (título, autores, ano, resumo, DOI) a partir do tema do TCC do aluno, usando a base pública do Semantic Scholar (200+ milhões de artigos). Essa é a primeira peça da funcionalidade que vai permitir o aluno selecionar as referências que a IA usa para escrever os capítulos.

## Motivação
Até hoje a IA escrevia "baseada em conhecimento geral do Gemini", o que deixava o texto muito parecido com qualquer ferramenta genérica e aumentava o risco de ser flagado por detectores de IA dos professores. A aposta do produto é deixar o aluno escolher 3 a 20 referências reais antes de gerar o texto, e a IA passa a citar essas fontes. Esta entrega monta o backend; a UI vem na próxima.

## O que mudou (técnico)
- `prisma/schema.prisma` — novo modelo `Reference` vinculado a `Tcc` (campos: externalId, title, authors, year, abstract, venue, url, doi, citationCount, selected, selectedAt, searchQuery).
- `prisma/migrations/20260422190000_add_reference_model/migration.sql` — migration aditiva (CREATE TABLE + 2 indexes + 1 FK), aplicada no banco de produção com `prisma migrate deploy`.
- `src/lib/semantic-scholar.ts` — cliente da API pública do Semantic Scholar (sem key, rate limit 100 req/5min; suporta `SEMANTIC_SCHOLAR_API_KEY` opcional). Normaliza a resposta para o formato `ScholarPaper` e formata autores no padrão ABNT (`SILVA, J.; COSTA, M.`).
- `src/app/api/tcc/[id]/references/route.ts` — `GET` lista referências (selecionadas primeiro); `DELETE` limpa só as não selecionadas (reset de busca).
- `src/app/api/tcc/[id]/references/search/route.ts` — `POST` recebe `{ query, yearFrom?, limit? }`, busca no Semantic Scholar, faz upsert em batch preservando as já selecionadas, retorna lista atualizada.
- `src/app/api/tcc/[id]/references/[refId]/route.ts` — `PATCH` troca flag `selected`; `DELETE` remove uma referência específica.
- Todas as rotas checam ownership do TCC contra `session.user.id` antes de qualquer operação (fecha o B6 dessa área).

## Como validar
No navegador, logado na Vercel, com um TCC existente, abrir o DevTools → Console e rodar:

```js
// Buscar
await fetch('/api/tcc/<TCC_ID>/references/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'inteligencia artificial educacao' })
}).then(r => r.json())
```

Deve retornar `{ query, found: <n>, references: [...] }` com até 20 artigos. Cada item tem título, autores, ano, abstract, DOI e URL.

```js
// Listar
await fetch('/api/tcc/<TCC_ID>/references').then(r => r.json())

// Selecionar uma
await fetch('/api/tcc/<TCC_ID>/references/<REF_ID>', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ selected: true })
}).then(r => r.json())
```

Erros esperados: 401 se não logado, 404 se TCC não é do usuário, 502 se Semantic Scholar estiver fora.

## Impacto
- **Usuário:** nada visível ainda — é a fundação. A tela vem na próxima entrega.
- **Segurança:** todas as rotas exigem sessão e verificam ownership do TCC. Nenhuma nova superfície de ataque.
- **Performance:** uma chamada externa por busca (~1-3s). Resultados são persistidos, então listagens subsequentes são instantâneas. Sem impacto no resto do app.
- **Custos:** zero. API do Semantic Scholar é gratuita; consumo de Postgres é desprezível (20 linhas por busca).
- **Breaking change:** não.

## Próximos passos
- **Entrega 2:** painel "Suas Referências" no workspace — lista, busca, seleção, abstract expandível, empty state persuasivo.
- **Entrega 3:** integração com `/api/gerar-tcc` (prompt passa a receber os artigos selecionados) e botão "Inserir citação" no editor Tiptap.

## Referências
- Commit: `b42057a` (`git show b42057a`)
- Migration aplicada em produção via `npx prisma migrate deploy`
- API docs Semantic Scholar: https://api.semanticscholar.org/api-docs/graph
