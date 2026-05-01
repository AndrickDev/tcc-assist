# ADR-0003 — Gemini API ao invés de LLM local

- **Status:** Aceito
- **Data:** 2026-05-01
- **Decisor:** Andrick (solo dev)
- **Tags:** arquitetura, ia, llm, custo

---

## Contexto

Hoje a geração de IA usa Gemini Flash via API REST diretamente dentro do Next.js:

- `src/lib/gemini.ts` chama `gemini-flash-latest` via `fetch`.
- `callGemini` atende prompts textuais.
- `callGeminiWithFiles` envia PDFs inline junto com prompt textual.
- `getGeminiConfigForPlan` limita temperatura e tokens por plano: FREE (~2k), PRO (~6k) e VIP
  (~16k tokens de saída).
- `src/lib/agents/aiox-integration.ts` monta prompts longos com contexto do TCC, referências
  selecionadas, histórico recente e diretivas de qualidade por plano.

A decisão aqui é se o gerador de texto principal deve continuar como API gerenciada (Gemini) ou se
devemos self-hostar um LLM, por exemplo Llama/Mistral via vLLM ou Ollama.

As restrições reais do produto pesam contra self-host agora:

- 1 dev solo.
- Sem usuários pagantes ainda.
- Sem orçamento para GPU dedicada.
- Qualidade em PT-BR acadêmico é não-negociável.
- Conformidade com ABNT e citações coerentes é não-negociável.

Rodar LLM próprio neste estágio deslocaria esforço de produto para operação de modelo, autoscaling,
batching, monitoramento de GPU e tuning de prompts/modelos antes de existir volume que pague esse
custo.

## Decisão

Usar **Gemini Flash via API** como LLM gerador de texto.

O serviço FastAPI (`tcc-assist-ai`) será responsável por encapsular o provider em
`app/providers/`, isolando a orquestração do SDK ou protocolo específico da Gemini. Trocar de
provider no futuro deve ser uma mudança pontual nesse módulo, sem reescrever workflows de chat,
geração, ações, RAG ou quota.

Embeddings rodam localmente no serviço FastAPI com **bge-m3**, dimensão `1024`, conforme definido na
ADR-0002. Local também pode ser usado futuramente para reranker. O LLM gerador, porém, continua
gerenciado via API.

## Consequências

### Positivas
- Time-to-market rápido: o produto já usa Gemini e a migração para FastAPI pode ser incremental.
- Qualidade forte em PT-BR acadêmico sem treinar modelo próprio.
- Operação simples: sem GPU idle, autoscaling de inferência, batching customizado ou fila de
  geração por capacidade de hardware.
- Custo unitário baixo no estágio atual: Gemini Flash fica em centavos por TCC nos cenários
  estimados.
- A futura camada `app/providers/` reduz acoplamento e preserva margem para trocar de provider.

### Negativas
- Dependência do uptime e das políticas operacionais do Google.
- Custo escala linearmente com usuários e volume de geração; mitigação prevista na ADR-0005 via
  quota e rate limit.
- Lock-in é mitigado pela abstração de provider, mas não desaparece: prompts, safety behavior e
  formatos de resposta ainda precisam de validação por modelo.
- Políticas de conteúdo do Google podem rejeitar prompts raros em TCCs de áreas sensíveis, mesmo
  quando o uso for acadêmico.

### Neutras
- A abstração de provider permite troca futura sem reescrever a orquestração.
- Embeddings e rerankers podem evoluir localmente sem mudar a decisão sobre o gerador de texto.
- A decisão não impede testes A/B futuros com outros modelos gerenciados.

## Alternativas consideradas

**A. Llama 3.x 70B via vLLM em GPU dedicada.**
Rejeitada. GPU dedicada A100/H100 custa em torno de US$1–4/hora mesmo ociosa, inviável sem usuários
pagantes. Além disso, modelos abertos grandes ainda tendem a exigir mais tuning para PT-BR acadêmico
e citações ABNT do que Gemini Flash.

**B. Mistral 7B/Mixtral 8x7B local.**
Rejeitada. A qualidade esperada para texto acadêmico longo em PT-BR é insuficiente para o padrão do
produto, com risco maior de alucinação de citações e inconsistência em ABNT.

**C. GPT-4o mini via OpenAI API.**
Rejeitada agora. Para a mesma classe de resposta, tende a custar aproximadamente 2–3x Gemini Flash
nos cenários do produto, sem ganho concreto comprovado em PT-BR acadêmico que justifique a troca.

**D. Claude Haiku via Anthropic API.**
Rejeitada agora. Adiciona SDK/provider novo e custo similar ou superior sem ganho claro nesta fase.

**E. Self-host de Llama 3.1 8B em CPU.**
Rejeitada. Latência de geração de capítulo ficaria inviável para experiência de produto, especialmente
em saídas longas do plano VIP (>30s).

## Tabela comparativa de custo

Estimativas não são benchmark formal. Usam preço público do Gemini 2.5 Flash Standard em 2026-05-01:
US$0,30 por 1M tokens de input e US$2,50 por 1M tokens de output.

| Tipo de geração | Tokens IN aprox | Tokens OUT aprox | Custo Gemini Flash USD |
|---|---:|---:|---:|
| Chat curto | 2.000 | 500 | 0,00 |
| Ação inline | 5.000 | 1.500 | 0,01 |
| Geração capítulo VIP | 20.000 | 16.000 | 0,05 |

## Gatilhos pra reavaliar

- Mais de 10k usuários pagantes mensais: volume passa a justificar análise econômica de fine-tune,
  modelos próprios ou contrato enterprise.
- Custo Gemini acima de 15% da receita mensal: margem fica pressionada e a decisão precisa ser
  reaberta.
- Requisito de privacidade que impeça envio de conteúdo ao Google, como LGPD agravada ou dado
  sensível em massa. Nesse cenário, considerar Azure OpenAI com residência de dados no Brasil ou
  self-host.
- Latência p95 da Gemini Flash acima de 8s consistentemente em janela de 7 dias.

## Notas de implementação

- O FastAPI no repo `tcc-assist-ai` terá módulo `app/providers/gemini.py`.
- A dependência de integração fica como TBD da tarefa de implementação: cliente HTTP simples
  (`httpx`) ou SDK oficial do Google.
- Toda chamada à Gemini deve logar `tokens_in`, `tokens_out`, `latency_ms` e `model` via `structlog`.
- Embeddings (`bge-m3`) rodam localmente no serviço FastAPI e não chamam API externa, mantendo custo
  zero por embedding gerado.
- O provider não deve vazar detalhes do SDK para `app/orchestrator/`, `app/rag/` ou rotas HTTP.

## Referências

- ADR-0001 — Separação do serviço de IA em FastAPI com RAG.
- ADR-0002 — pgvector como vector store, fixando dimensão 1024 do `bge-m3`.
- ADR-0006 — Comunicação Next ↔ FastAPI por JWT interno (a escrever em BL-005).
- Google AI for Developers — Gemini Developer API pricing.

