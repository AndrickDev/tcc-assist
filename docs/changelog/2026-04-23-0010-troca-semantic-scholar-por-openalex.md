---
data: 2026-04-23 00:10
titulo: Troca Semantic Scholar por OpenAlex como provedor de referências
categoria: fix
commit: 34bc020
autor: Andrick
status: deployed
---

# Troca Semantic Scholar por OpenAlex como provedor de referências

## Resumo
A busca de artigos acadêmicos não estava funcionando em produção — o Semantic Scholar rejeitava quase todas as chamadas. Trocamos pelo OpenAlex, que tem rate limit generoso por IP, não exige chave de API e ainda traz mais artigos brasileiros em português, que é o público do Teseo.

## Motivação
Logo após o deploy da entrega anterior, testei a rota `/api/tcc/[id]/references/search` no ambiente Vercel e a resposta foi **502 Bad Gateway**. Investigando, a API pública do Semantic Scholar retornou `429 Too Many Requests` mesmo na primeira chamada. Motivo: sem chave de API, o rate limit do Semantic Scholar é global compartilhado entre todos os IPs sem autenticação — na prática, inutilizável em produção.

O OpenAlex (sucessor do Microsoft Academic Graph, mantido pela OurResearch) tem três vantagens decisivas:
1. **10 req/s e 100.000 req/dia por IP**, sem key.
2. Entra no "polite pool" se o cliente passa um email de contato (já enviamos `contato@teseo.app`).
3. Cobertura significativamente melhor de artigos brasileiros em português — o teste feito com "inteligência artificial educação" trouxe artigos da UFRGS, PUC-SP e outras instituições nacionais no topo, exatamente o que o aluno brasileiro precisa pra TCC.

## O que mudou (técnico)
- Criado `src/lib/papers-search.ts` substituindo `src/lib/semantic-scholar.ts` (removido).
- A interface `ScholarPaper` foi mantida idêntica — zero mudança necessária nos endpoints que consumem a lib.
- Peculiaridades do OpenAlex tratadas na nova lib:
  - **Abstracts em formato invertido** (`{ "palavra": [posicoes] }`) — reconstruídos no texto original ordenando por posição.
  - **ID do tipo `https://openalex.org/W1234567890`** — extraído só o `W1234567890` para ficar curto no banco.
  - **DOI com prefixo URL** — limpado para armazenar só o identificador canônico (ex: `10.5753/cbie.sbie.2005.351-360`).
  - **Formato de autores** — `authorships[].author.display_name`, limitado a 3 + "et al." para manter enxuto no UI.
- `src/app/api/tcc/[id]/references/search/route.ts` agora importa de `@/lib/papers-search` e salva com `source: "openalex"`.
- Variável de ambiente opcional `OPENALEX_MAILTO` permite customizar o email do polite pool por ambiente (default: `contato@teseo.app`).

## Como validar
Mesmo passo da entrega anterior, na Vercel logado, DevTools → Console:

```js
const tccId = location.pathname.split('/').pop()
const r = await fetch(`/api/tcc/${tccId}/references/search`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'inteligencia artificial educacao' })
})
const data = await r.json()
console.log('Encontrados:', data.found)
console.table(data.references.slice(0,5).map(r => ({ ano: r.year, pais: 'BR?', autores: r.authors.slice(0,40), titulo: r.title.slice(0,60) })))
```

Resultado esperado: `found` ≥ 10, com vários artigos brasileiros (UFRGS, PUC, UFMG etc.) nos primeiros resultados. A tabela deve vir preenchida com título, autores e ano reais.

## Impacto
- **Usuário:** nenhum visível (backend). Mas agora a busca efetivamente funciona em produção.
- **Custos:** zero — OpenAlex é gratuito.
- **Latência:** 46-200ms por chamada (medido no teste direto via `curl`). Melhor que Semantic Scholar.
- **Dados existentes:** nenhuma linha na tabela `Reference` precisou ser migrada porque a feature acabou de entrar no ar e ainda não havia registros reais.
- **Breaking change:** não, a interface pública da lib não mudou.

## Próximos passos
- **Entrega 2 (UI):** painel "Suas Referências" no workspace com busca, lista, seleção, abstract expandível, empty state persuasivo. Esse é o próximo passo lógico agora que o backend funciona de verdade.
- Considerar, numa fase futura, um boost para artigos com `authorships[].countries` contendo `BR` quando o curso do TCC for nacional — hoje o OpenAlex já traz por relevância textual, mas um filtro explícito pode melhorar ainda mais.

## Referências
- Commit: `34bc020` (`git show 34bc020`)
- Docs OpenAlex: https://docs.openalex.org/
- Entrega anterior: [2026-04-22-1910-backend-referencias-semantic-scholar.md](2026-04-22-1910-backend-referencias-semantic-scholar.md)
