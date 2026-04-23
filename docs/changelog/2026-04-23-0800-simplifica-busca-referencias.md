---
data: 2026-04-23 08:00
titulo: Simplifica busca de referências (botão único baseado no título do TCC)
categoria: fix
commit: 5cefd10
autor: Andrick
status: deployed
---

# Simplifica busca de referências (botão único baseado no título do TCC)

## Resumo
A barra de pesquisa manual do drawer de Referências foi substituída por um botão único "Atualizar referências" que sempre busca com base no título atual do TCC. Antes de buscar, o sistema também limpa resultados antigos não selecionados para evitar acúmulo de artigos irrelevantes vindos de buscas anteriores. O aluno nunca mais vê resultados de outro tema aparecendo.

## Motivação
Relato direto do teste: o TCC era sobre **"Arquitetura Hexagonal e Domain-Driven Design como fundamento de um sistema web para reencontro entre pets e tutores"**, mas no drawer apareciam artigos sobre **"IA na educação"** — um tema completamente diferente. Isso acontecia porque:

1. O input de busca retinha o termo de uma busca anterior em outro TCC de teste.
2. Resultados antigos ficavam persistidos no banco e eram listados mesmo depois de clicar em "Atualizar".

Para o aluno de TCC que está começando, ver resultados irrelevantes passa a impressão de que a ferramenta está quebrada. Além disso, a maioria nem sabe formular uma boa query acadêmica — o título do TCC é o ponto de partida natural e óbvio.

## O que mudou (técnico)
- `src/components/references/ReferencesDrawer.tsx`:
  - Removido o state `query` e o `<form>` com input de busca livre.
  - Adicionado botão único **"Buscar referências" / "Atualizar referências"** (o label muda quando já há resultados).
  - Abaixo do botão, um subtítulo `Tema: <título do TCC>` mostra exatamente o que o sistema vai buscar — transparência.
  - `runSearch()` agora sempre usa `tccTitle.trim()` como query.
  - **Antes de cada busca**, chama `DELETE /api/tcc/[id]/references` que limpa os registros `selected=false AND favorited=false`. Seleções e favoritos do aluno são preservados.

## Como validar
1. Abrir um TCC com título diferente do que foi testado antes (ex: algo sobre "Arquitetura Hexagonal")
2. Clicar em **Referências** no header → drawer abre
3. Drawer mostra agora apenas o botão "Buscar referências" + a frase "Tema: Arquitetura Hexagonal..."
4. Clicar no botão → ~2 segundos de loading → lista de 20 artigos, **agora coerentes com o tema real**
5. Selecionar algumas com ✓ e favoritar outras com ★
6. Clicar em **"Atualizar referências"** novamente → lista é refeita, **mas seleções e favoritos continuam lá**
7. Não existe mais input de texto no drawer; o aluno não precisa pensar em como formular a query

## Impacto
- **Usuário:** menos fricção, menos confusão. Um clique em vez de digitar uma query.
- **Qualidade dos resultados:** cada busca começa limpa — sem acúmulo de termos errados.
- **Breaking change:** não. Endpoints mantiveram o mesmo contrato.

## Próximos passos
Se no futuro alguma situação pedir busca livre (tipo especializar um capítulo em subtema específico), dá pra trazer o input de volta como opção secundária — tipo um "Refinar busca" dentro de um `<details>` fechado por padrão. Só implementar se surgir a demanda real.

## Referências
- Commit: `5cefd10` (`git show 5cefd10`)
- Relacionados: [Drawer de Referências](2026-04-23-0130-drawer-referencias-workspace.md)
