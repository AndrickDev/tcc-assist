# 01 — Visão Geral da Camada de IA do Teseo

## Objetivo desta documentação

Este conjunto de documentos descreve como a camada de inteligência artificial do Teseo
funciona hoje, o que ela não é (ainda), e o que seria necessário para evoluí-la.

O objetivo é evitar confusão entre termos como RAG, context injection, e prompt engineering,
que são frequentemente usados de forma intercambiável mas descrevem arquiteturas muito diferentes.

---

## O que o Teseo precisa da IA

O Teseo usa IA para:

1. **Geração de conteúdo acadêmico** — o usuário descreve o que quer escrever e o modelo produz
   texto acadêmico estruturado (parágrafos, capítulos, seções).

2. **Revisão e edição in-loco** — o usuário seleciona um trecho do documento e pede revisão
   ortográfica, revisão crítica, ajuste ABNT, ou melhoria de citações.

3. **Orientação de próximo passo** — o modelo sugere qual parte do TCC o usuário deveria
   escrever a seguir, com base no contexto do projeto.

A IA não precisa, por ora, recuperar conhecimento externo de uma base de documentos.
Ela opera sobre o conteúdo que o próprio usuário gerou e sobre o contexto do projeto
(título, curso, norma, objetivo) coletado no onboarding.

---

## Conceitos-chave desta documentação

### Prompt Engineering
Técnica de compor instruções textuais (system prompt + contexto + tarefa) para guiar o
comportamento do modelo. Não envolve recuperação externa. É o que o Teseo usa hoje.

### Context Injection
Subconjunto de prompt engineering onde dados estruturados (mensagens anteriores, metadados
do projeto) são inseridos diretamente no prompt antes da chamada ao modelo.

### RAG — Retrieval-Augmented Generation
Arquitetura onde existe uma **etapa de retrieval separada da geração**:
- Documentos externos são ingeridos, fragmentados (chunked), transformados em embeddings
  e indexados em um banco vetorial.
- Na hora da geração, uma query de busca recupera os fragmentos mais relevantes (top-k).
- Os fragmentos recuperados são inseridos no prompt junto com a tarefa.

**RAG exige**: ingestão → chunking → embeddings → índice vetorial → retrieval → geração.

### O que diferencia na prática

| Critério | Context Injection | RAG |
|---|---|---|
| Recuperação por similaridade semântica | Não | Sim |
| Embeddings | Não | Sim |
| Banco vetorial | Não | Sim |
| Escala de conhecimento | Limitada ao histórico do usuário | Ilimitada (base indexada) |
| Custo de infraestrutura | Baixo | Médio-alto |
| Complexidade de manutenção | Baixa | Alta |

---

## Resumo executivo

**O Teseo usa Context Injection com Prompt Engineering estruturado.**

Não usa RAG. O modelo Gemini recebe um prompt composto por:
- System prompt do agente (arquivo `.md` em `.codex/agents/`)
- Histórico de mensagens do TCC (últimas 3 para PRO, todas para VIP)
- Guardrails de saída
- A instrução do usuário

Não há embeddings, banco vetorial, chunking ou retrieval semântico.
Os arquivos de referência enviados pelo usuário (PDFs, DOC) são armazenados
no Vercel Blob mas **não são processados nem injetados no contexto da IA**.

---

_Próximo: [02 — Arquitetura Atual](02-current-architecture.md)_
