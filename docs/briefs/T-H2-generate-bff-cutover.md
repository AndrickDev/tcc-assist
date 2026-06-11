```markdown
# T-H2 BFF cut-over `/api/gerar-tcc` para FastAPI atrás de `USE_FASTAPI_GENERATE`

## Context

Repo: tcc-assist monorepo. Scope: `apps/web/`. Branch off `main`: `feat/th2-generate-bff-cutover`.
Phase 5 (generate cut-over), segunda task. T-H1 (PR #50) entregou o FastAPI side com
`POST /v1/generate` + orchestrator. Esta task é o equivalente de T-F2: bifurca o BFF por
uma flag para permitir canary controlado em prod.

ADRs:
- ADR-0001 — orchestrator no FastAPI.
- ADR-0006 — JWT interno scope `generate`.
- ADR-0008 — provider Google (geração usa o mesmo).

## Verified state — do not re-infer

- `services/ai/app/api/generate.py`: endpoint `POST /v1/generate` em produção (PR #50).
  Body: `{ tcc_id: string, chapter: string (1..5000), previous_context?: string (<=200000),
  require_sources?: bool }`. Auth scope `generate`. Resposta:
  `{ content, agent_id, chapter, references_used, citations[] }`.
- `services/ai/app/orchestrator/generate.py::run_generate` busca `Tcc` + `Reference` no
  Postgres via repository, monta o prompt internamente e injeta contexto RAG quando
  `require_sources=true`. Não faz download de PDFs em tempo de geração.
- BFF atual `apps/web/src/app/api/gerar-tcc/route.ts` (109 linhas):
  - Lê `{ tccId, capitulo, contextoAnterior, tipoTrabalho, objetivo, norma, curso, tema }`.
  - Valida ownership do TCC.
  - Busca `selectedRefs` (Prisma) + faz download de PDFs do Vercel Blob.
  - Constrói o prompt inline + chama `callGemini`/`callGeminiWithFiles` (legacy).
  - Retorna `{ sucesso, capitulo, texto, referenciasUsadas }`.
- `apps/web/src/lib/ai-service.ts` já contém `runChat`, `runAction`, e helpers de mapeamento
  de erro upstream. Ainda **não** tem `runGenerate`.
- `apps/web/src/lib/jwt-signer.ts::signInternalJwt` (ou equivalente) aceita `scope: "generate"`
  por `Scope` TypeScript já definido em conjunto com o FastAPI.
- Ambiente: variável `USE_FASTAPI_GENERATE` não existe ainda em código nem em Vercel — esta task
  introduz a leitura. Flag começa **off** (default `false`).
- O endpoint FastAPI **não** processa PDFs anexados ao TCC. Phase 4 RAG cobre PDFs via
  T-G3 ingestion. Atualmente a UI pode anexar PDFs e o BFF legacy passa pra Gemini em runtime.
  Esta divergência é conhecida e fica fora desta task (registrar em BACKLOG, ver §"Do not do").

Estado atual do mapeamento (a usar como contrato no novo `runGenerate`):

| BFF input atual | FastAPI body | Notas |
|---|---|---|
| `tccId` | `tcc_id` | snake_case do FastAPI |
| `capitulo` | `chapter` | string |
| `contextoAnterior` | `previous_context` | string ou `null` se vazio |
| `tipoTrabalho`, `objetivo`, `norma`, `curso`, `tema` | (dropados) | FastAPI orchestrator lê do `Tcc` via `tcc_id` |
| `selectedRefs`, `pdfParts` (lidos no BFF) | (dropados) | FastAPI lê refs e RAG por conta própria |
| (novo) `require_sources` no body opcional | mesmo | default `false` |

| FastAPI response | BFF response | Notas |
|---|---|---|
| `content` | `texto` | nome legacy preservado p/ UI |
| `chapter` | `capitulo` | espelhado pra compat |
| `references_used` | `referenciasUsadas` | número |
| `citations[]` | (novo) `citations[]` | opcional, UI futuro |

## Scope

### 1. Adicionar `runGenerate` em `apps/web/src/lib/ai-service.ts`

Padrão idêntico ao `runAction` existente. Recebe input forte tipado, assina JWT
`scope=generate`, faz POST, parseia erros conhecidos.

```ts
type RunGenerateInput = {
  userId: string
  plan: Plan
  tccId: string
  chapter: string
  previousContext: string | null
  requireSources: boolean
}

type GenerateCitation = {
  n: number
  source_type: string
  source_ref: string
  ordinal: number
  score: number
  excerpt: string
}

export type GenerateResult = {
  content: string
  chapter: string
  references_used: number
  citations: GenerateCitation[]
}

export async function runGenerate({
  userId, plan, tccId, chapter, previousContext, requireSources,
}: RunGenerateInput): Promise<GenerateResult> {
  const token = await signInternalJwt({ sub: userId, plan, scope: "generate", tccId })
  let response: Response
  try {
    response = await fetch(`${getAiServiceUrl()}/v1/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tcc_id: tccId,
        chapter,
        previous_context: previousContext,
        require_sources: requireSources,
      }),
      cache: "no-store",
    })
  } catch {
    throw new Error("ai_provider_unavailable")
  }

  const payload = await readUpstreamPayload(response)
  const payloadObject = isObject(payload) ? payload : null

  if (response.status === 200) {
    return parseGenerate(payload)
  }

  const upstreamError =
    payloadObject && typeof payloadObject.error === "string" ? payloadObject.error : null
  if (
    response.status === 401 &&
    (upstreamError === "invalid_token" || upstreamError === "missing_token")
  ) {
    throw new Error("upstream_auth_failure")
  }
  if (response.status === 403 && upstreamError === "tcc_id_mismatch") {
    throw new Error("tcc_id_mismatch")
  }
  if (response.status === 404 && upstreamError === "tcc_not_found") {
    throw new Error("tcc_not_found")
  }
  if (response.status === 422) {
    throw new Error("upstream_invalid_request")
  }
  if (response.status === 429 && upstreamError === "quota_exceeded") {
    throw new QuotaExceededError({
      remaining:
        payloadObject && typeof payloadObject.remaining === "number"
          ? payloadObject.remaining : null,
      resetAt:
        payloadObject && typeof payloadObject.reset_at === "string"
          ? payloadObject.reset_at : null,
    })
  }
  if (response.status === 502 && upstreamError === "ai_provider_bad_response") {
    throw new Error("ai_provider_bad_response")
  }
  if (response.status === 503 && upstreamError === "ai_provider_unavailable") {
    throw new Error("ai_provider_unavailable")
  }
  if (response.status === 503 && upstreamError === "quota_backend_unavailable") {
    throw new Error("quota_unavailable")
  }
  throw new Error(`upstream_error_${response.status}`)
}

function parseGenerate(payload: unknown): GenerateResult {
  if (!isObject(payload)) throw new Error("upstream_invalid_request")
  const content = typeof payload.content === "string" ? payload.content : null
  const chapter = typeof payload.chapter === "string" ? payload.chapter : null
  const referencesUsed = typeof payload.references_used === "number" ? payload.references_used : 0
  const citations = Array.isArray(payload.citations)
    ? (payload.citations as GenerateCitation[])
    : []
  if (content === null || chapter === null) {
    throw new Error("upstream_invalid_request")
  }
  return { content, chapter, references_used: referencesUsed, citations }
}
```

Importações novas (`getAiServiceUrl`, `signInternalJwt`, `readUpstreamPayload`, `isObject`,
`QuotaExceededError`, `Plan`) já existem no arquivo — reusar.

### 2. Bifurcar `apps/web/src/app/api/gerar-tcc/route.ts`

Manter contrato externo (request/response do BFF) inalterado. Adicionar feature flag e
delegar para `runGenerate` quando `true`. Manter o caminho legacy intacto enquanto o canary
roda.

```ts
export const maxDuration = 120

function isFastApiGenerateEnabled(): boolean {
  return process.env.USE_FASTAPI_GENERATE === 'true'
}

export async function POST(request: Request) {
  // ... auth + body parse iguais ao atual
  if (!tccId || !tema) { /* 400 */ }
  const tcc = await prisma.tcc.findFirst({ where: { id: tccId, userId }, select: { id: true } })
  if (!tcc) { /* 404 */ }

  if (isFastApiGenerateEnabled()) {
    try {
      const userPlan = resolvePlan((session.user as { plan?: string }).plan)
      const result = await runGenerate({
        userId,
        plan: userPlan,
        tccId,
        chapter: capitulo,
        previousContext: typeof contextoAnterior === 'string' && contextoAnterior.length > 0
          ? contextoAnterior : null,
        requireSources: typeof body.requireSources === 'boolean' ? body.requireSources : false,
      })
      return NextResponse.json({
        sucesso: true,
        capitulo: result.chapter,
        texto: result.content,
        referenciasUsadas: result.references_used,
        citations: result.citations,
      })
    } catch (error) {
      console.error('[api/gerar-tcc] fastapi failure', {
        tccId, error: error instanceof Error ? error.message : String(error),
      })
      return mapFastApiGenerateError(error)
    }
  }

  // ===== Caminho legacy preservado intacto =====
  // (continua com selectedRefs, pdfParts, callGemini/callGeminiWithFiles, regrasCitacao, etc.)
}

function mapFastApiGenerateError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error)
  if (message === 'tcc_id_mismatch') return NextResponse.json({ error: 'Recurso não autorizado' }, { status: 403 })
  if (message === 'tcc_not_found')   return NextResponse.json({ error: 'TCC não encontrado' }, { status: 404 })
  if (message === 'upstream_invalid_request') return NextResponse.json({ error: 'Requisição inválida' }, { status: 422 })
  if (message === 'ai_provider_unavailable' || message === 'ai_provider_bad_response') {
    return NextResponse.json({ error: 'IA temporariamente indisponível' }, { status: 503 })
  }
  if (message === 'upstream_auth_failure') return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  if (message === 'quota_unavailable')     return NextResponse.json({ error: 'Quota indisponível' }, { status: 503 })
  return NextResponse.json({ error: 'Erro inesperado da IA' }, { status: 502 })
}
```

Notas:
- `maxDuration = 120` para casar com timeout Gemini 90s (mesmo padrão do ai-action route).
- Caminho legacy fica idêntico ao atual; nenhum import dropado nesta task.
- `resolvePlan` importado de `@/lib/plan` (mesmo padrão do route ai-action).
- Quando a flag é `true` e o usuário tem PDFs anexados, o FastAPI **não** os processa neste
  momento. Documentar em §"Limitations" do PR.

### 3. Atualizar `docs/BACKLOG.md`

- BL-014 já está em "Em andamento" para Phase 6. Phase 5 não tem BL ativo; criar
  **BL-016 — Cut-over `/api/gerar-tcc` para `POST /v1/generate`** apontando para PRs e
  trade-offs (PDF flow, RAG dependência de ingestion).

### 4. Tests

`apps/web/__tests__/api/gerar-tcc.test.ts` (criar se não existir) ou equivalente Vitest/Jest:

- `flag desligada` -> chama callGemini, NÃO chama runGenerate. Mock de `@/lib/gemini` +
  `@/lib/ai-service`.
- `flag ligada` -> chama runGenerate, NÃO chama callGemini. Response mapeada para
  `{ sucesso, capitulo, texto, referenciasUsadas, citations }`.
- `flag ligada + upstream tcc_id_mismatch` -> 403 com `Recurso não autorizado`.
- `flag ligada + upstream invalid_request` -> 422 com `Requisição inválida`.
- `flag ligada + upstream unavailable` -> 503 `IA temporariamente indisponível`.
- `tccId ausente` -> 400 (mesmo nas duas vias).
- `usuário não dono` -> 404 (mesmo nas duas vias).

Se o repo `apps/web` não tem testes para rotas API hoje, criar a pasta + setup mínimo
seguindo o padrão de `apps/web/__tests__/api/ai-action.test.ts` se existir; senão, deixar
um teste manual smoke documentado no PR e seguir.

### 5. README / docs

- Atualizar `apps/web/README.md` (se houver seção de env vars) com a entrada
  `USE_FASTAPI_GENERATE` (default off). Linkar para BL-016.

## Closed decisions

- Flag começa **off** em Vercel. Tu flipa em prod quando T-H2 mergeado.
- `runGenerate` em `ai-service.ts`. Sem novo arquivo só pra isso.
- `maxDuration = 120` na route igual a Phase 6.
- Mapping de erros idêntico a `mapFastApiActionError`. Padrão consistente.
- `require_sources` exposto no BFF body mas default `false` para zero impacto na UI atual.
- Resposta BFF acrescenta `citations[]`; UI legacy ignora silenciosamente; futuras releases
  podem renderizar.
- Phase 4 RAG schema e ingestion **já** estão em prod (T-G1..T-G6, ADR-0009 cobre auto-deploy).
  RAG fica disponível se `require_sources=true`.
- PDFs anexados via UI **não** vão para FastAPI nesta task. Comportamento legacy preserva PDF
  flow; quando flag ligar, usuários com PDFs perdem esse contexto até resolverem ingest. Limitação
  registrada.

## Do not do

- Não dropar `callGemini` / `callGeminiWithFiles` / `buildReferencesContext` / `lib/gemini.ts`
  funções restantes. T-H3 fará a limpeza só após canary estável.
- Não mexer no FastAPI side (T-H1 já entregue em PR #50).
- Não escrever migration nova. Schema RAG já em prod.
- Não adicionar suporte de PDFs ao FastAPI nesta task — sai do escopo. Documentar como
  limitação.
- Não tocar UI components. Resposta JSON adiciona `citations[]` mas UI atual ignora.
- Não push, não abrir PR. Local commit only.

## Definition of done

Verifiable file checks:

- `grep -q 'export async function runGenerate' apps/web/src/lib/ai-service.ts`
- `grep -q 'isFastApiGenerateEnabled' apps/web/src/app/api/gerar-tcc/route.ts`
- `grep -q 'USE_FASTAPI_GENERATE' apps/web/src/app/api/gerar-tcc/route.ts`
- `grep -q 'export const maxDuration = 120' apps/web/src/app/api/gerar-tcc/route.ts`
- `grep -q 'mapFastApiGenerateError' apps/web/src/app/api/gerar-tcc/route.ts`
- `grep -q 'BL-016' docs/BACKLOG.md`

Behavioral checks:

- Tests cobrem ambos caminhos (legacy + FastAPI) e cinco mapeamentos de erro.
- `npm run lint` PASS.
- `npm run typecheck` PASS.

## Gates

From `apps/web/`:

```bash
npm run lint
npm run typecheck
npm run build
```

`services/ai/` não tocado. Skip.

## Branch + commit

Branch from `main`:

```bash
git checkout main
git pull
git checkout -b feat/th2-generate-bff-cutover
```

Single commit:

```
feat(generate): BFF cut-over de /api/gerar-tcc por USE_FASTAPI_GENERATE (T-H2)

Espelha T-F2. Adiciona runGenerate em lib/ai-service.ts seguindo
o mesmo padrão de runAction. /api/gerar-tcc/route.ts bifurca por
process.env.USE_FASTAPI_GENERATE; quando true delega ao FastAPI
endpoint POST /v1/generate (PR #50) e devolve { sucesso, capitulo,
texto, referenciasUsadas, citations }. Quando false mantem o
caminho legacy callGemini/callGeminiWithFiles intacto.

maxDuration 120 alinhado com o timeout 90s do provider Gemini no
FastAPI.

Limitacao conhecida: o FastAPI endpoint nao processa PDFs anexados
em tempo de geracao. Para usuarios com attachments, o caminho legacy
ainda os passa para Gemini; flag ligada perde esse contexto ate o
suporte ser portado. Registrado em BL-016 no BACKLOG.

Mapping de erros: tcc_id_mismatch=403, tcc_not_found=404,
upstream_invalid_request=422, ai_provider_unavailable=503,
upstream_auth_failure=500.

Tests cobrem dois caminhos + cinco erros mapeados.
```

Do not push. Do not open PR.

## Expected return summary

Reportar:

1. Branch + commit SHA.
2. Arquivos modificados/criados com line counts.
3. Output de `npm run lint`, `npm run typecheck`, `npm run build` (build pode falhar
   localmente por Stripe env ausente — registrar como deviation; Vercel CI tem env).
4. Quantidade de testes novos.
5. Resumo de qualquer divergência do brief.
```
