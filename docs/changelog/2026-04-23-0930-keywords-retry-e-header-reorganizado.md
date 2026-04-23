---
data: 2026-04-23 09:30
titulo: Busca de referências com extração de keywords + header reorganizado
categoria: fix
commit: 244cfee
autor: Andrick
status: deployed
---

# Busca de referências com extração de keywords + header reorganizado

## Resumo
Dois problemas resolvidos em um commit. Primeiro: a busca de referências deixou de retornar zero resultados quando o título do TCC é longo e muito específico — o sistema agora extrai automaticamente as palavras-chave técnicas e faz uma segunda tentativa. Segundo: o layout do header do workspace foi reorganizado, movendo o botão Referências e a toolbar de ações (Revisão Crítica, Norma ABNT, Citações, Próx. Passo) para a esquerda, junto do título do TCC. Status de salvamento e botões de revisão ficam à direita.

## Motivação
Relato do sócio ao testar com um TCC real: **"ARQUITETURA HEXAGONAL E DOMAIN-DRIVEN DESIGN COMO FUNDAMENTO DE UM SISTEMA WEB PARA REENCONTRO ENTRE PETS E TUTORES"**. Clicando em "Buscar referências", vinham 0 resultados — e os 20 artigos antigos de outro TCC de teste ainda apareciam na listagem.

A raiz do bug: o OpenAlex procura por TODAS as palavras do `search` juntas. Um título com 15 palavras muito específicas não bate com nenhum artigo. Teste direto:
- Query original → 0 resultados
- Keywords extraídas (`arquitetura hexagonal domain-driven design web reencontro pets tutores`) → 29+ resultados focados.

Sobre o layout: o sócio pediu literalmente "jogue as ações da toolbar em cima no workspace para esquerda e deixe todas ações após ela". A lógica UX é sólida — ações ficam mais perto do contexto (título do TCC) e o status de salvamento não precisa disputar espaço com elas.

## O que mudou (técnico)

### Fix da busca vazia (`src/lib/papers-search.ts` + `src/app/api/tcc/[id]/references/search/route.ts`)
- Nova função `extractKeywords(title, maxWords = 8)` em `papers-search.ts`:
  - Lista de stopwords PT + EN (artigos, preposições, conjunções)
  - Lista de termos genéricos de TCC que pouco ajudam sozinhos (`proposta`, `estudo`, `fundamento`, `sistema`, `uso`, `aplicacao`, etc.)
  - Normaliza para lowercase, remove acentos (NFD + replace de diacríticos) e pontuação
  - Retorna no máximo 8 palavras-chave concatenadas
- Endpoint `POST /api/tcc/[id]/references/search` agora:
  1. Tenta primeiro com a query original
  2. Se `papers.length < 3`, extrai keywords e faz nova chamada
  3. Usa o resultado que trouxer mais papers
  4. Retorna `effectiveQuery` no JSON para debug/transparência (útil se o frontend quiser mostrar "buscamos por X")
  5. Grava no banco `searchQuery` com a query efetiva (não com a original que veio vazia)

### Reorganização do header (`src/app/tcc/[id]/page.tsx`)
- Antes:
  - Esquerda: logo + título + status de salvamento
  - Direita: review buttons + Referências + AiActionToolbar
- Depois:
  - Esquerda: logo + título + **Referências + AiActionToolbar** (separados por divisor vertical)
  - Direita: status de salvamento + review buttons
- Ações contextuais passam a estar próximas do título do TCC, que é o contexto que elas operam. Reduz o travel visual do olho.

## Como validar
Após deploy:

**Busca com título longo:**
1. Num TCC com título real (20+ palavras técnicas), abrir o drawer de Referências
2. Clicar em **"Atualizar referências"** (ou "Buscar referências" se a primeira vez)
3. Deve vir uma lista de artigos **coerentes com as keywords técnicas** do tema (não mais aqueles sobre IA na educação ou resultados vazios)
4. Selecionar, favoritar, comparar — fluxo normal

**Header reorganizado:**
1. Abrir qualquer TCC
2. Header do workspace: à esquerda, logo + título do TCC, e **logo ao lado** (com uma linha divisória vertical) vêm os botões "Referências" e a toolbar AI (Revisão Crítica, Norma ABNT, Citações, Próximo Passo)
3. À direita do header: apenas o status de salvamento ("Atualizado" / "Salvando..." / "Salvo")
4. Entrar em modo review (clicar em "Revisar" numa resposta da IA): botões "Rejeitar" e "Aceitar" aparecem à direita

## Impacto
- **Usuário:** a busca agora funciona de verdade para TCCs com título longo (maioria dos casos reais). E o header fica mais organizado — ações agrupadas com o contexto.
- **Custos:** na pior das hipóteses, 2 chamadas ao OpenAlex por busca (quando a primeira falha). Ainda dentro do generoso tier gratuito.
- **Segurança:** nenhuma mudança no modelo de auth.
- **Breaking change:** não. O campo `effectiveQuery` é adicional no response — clientes antigos continuam funcionando.

## Próximos passos
- Se ainda houver queries que não trazem resultados mesmo com keywords, pode valer tentar versão em inglês da query (termos técnicos como "hexagonal architecture" são mais comuns em inglês na literatura).
- Futuramente, permitir ao aluno editar manualmente as keywords antes de buscar (caso ele queira especializar em subtema).

## Referências
- Commit: `244cfee` (`git show 244cfee`)
- Relacionados:
  - [Simplifica busca de referências](2026-04-23-0800-simplifica-busca-referencias.md)
  - [Drawer de Referências](2026-04-23-0130-drawer-referencias-workspace.md)
