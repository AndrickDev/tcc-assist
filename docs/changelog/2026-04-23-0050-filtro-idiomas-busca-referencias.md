---
data: 2026-04-23 00:50
titulo: Filtro de idiomas na busca de referências (default pt + en)
categoria: feat
commit: 2488cc2
autor: Andrick
status: deployed
---

# Filtro de idiomas na busca de referências (default pt + en)

## Resumo
A busca de artigos acadêmicos agora retorna apenas trabalhos em português e inglês por padrão. Isso garante que o aluno brasileiro de TCC receba referências que ele realmente pode usar no texto, sem poluir a lista com artigos em espanhol, francês ou outros idiomas.

## Motivação
No primeiro teste em produção (com a query "inteligência artificial educação"), 4 dos 5 primeiros resultados vieram em espanhol — de universidades colombianas, mexicanas e argentinas. O aluno brasileiro praticamente nunca cita artigo em espanhol no TCC (ABNT aceita, mas não é comum, e o orientador brasileiro costuma preferir fonte nacional ou em inglês). Manter esses artigos na lista gerava ruído: o aluno precisava abstract após abstract só pra descobrir que a referência estava num idioma que ele não quer usar.

Com o filtro aplicado, o mesmo teste trouxe 5 artigos brasileiros em português no topo (UFRGS, PUC-SP, PUC-MG) — exatamente o que o público do Teseo precisa.

## O que mudou (técnico)
- `src/lib/papers-search.ts` — `SearchOptions` ganhou o campo opcional `languages?: string[]` (ISO 639-1). Quando não informado, default para `["pt", "en"]`.
- A montagem do parâmetro `filter` da URL do OpenAlex passou a combinar idiomas (`language:pt|en`) com `from_publication_date` (quando o caller passa `yearFrom`). Formato: `filter=language:pt|en,from_publication_date:2015-01-01`.
- Nenhuma mudança no contrato de `/api/tcc/[id]/references/search` — o endpoint continua ignorando o campo `languages` no body (podemos expor depois via UI se fizer sentido oferecer "incluir espanhol/francês").

## Como validar
No ambiente Vercel logado, DevTools → Console, com um TCC aberto:

```js
const tccId = location.pathname.split('/').pop()
const r = await fetch(`/api/tcc/${tccId}/references/search`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'inteligencia artificial educacao' })
})
const data = await r.json()
console.table(data.references.slice(0,10).map(r => ({
  ano: r.year,
  citacoes: r.citationCount,
  autores: r.authors.slice(0,40),
  titulo: r.title.slice(0,60)
})))
```

Resultado esperado: a maior parte dos 10 primeiros vem em português (titulo em pt) ou inglês. Nenhum em espanhol.

## Impacto
- **Usuário:** vai ver uma lista muito mais relevante — menos ruído, mais artigos nacionais/em inglês. Reduz tempo para selecionar referências.
- **Custos:** nenhum — é só um parâmetro a mais na chamada da API.
- **Performance:** nenhuma — mesmo tempo de resposta (46-200ms).
- **Breaking change:** não. Interface da lib e do endpoint permaneceu compatível.

## Próximos passos
- Na UI da Entrega 2, adicionar um toggle "Incluir também outros idiomas" para casos específicos (cursos de Letras, relações internacionais, etc.).
- Considerar futuramente um boost explícito para `authorships.countries:BR`, priorizando autores brasileiros acima de ingleses quando a query for ambígua.

## Referências
- Commit: `2488cc2` (`git show 2488cc2`)
- Docs OpenAlex (filtros): https://docs.openalex.org/how-to-use-the-api/get-lists-of-entities/filter-entity-lists
- Entrega anterior: [2026-04-23-0010-troca-semantic-scholar-por-openalex.md](2026-04-23-0010-troca-semantic-scholar-por-openalex.md)
