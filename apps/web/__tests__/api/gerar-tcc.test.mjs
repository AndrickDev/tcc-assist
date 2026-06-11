import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const routeSource = readFileSync(
  join(process.cwd(), "src/app/api/gerar-tcc/route.ts"),
  "utf8"
)

test("flag off keeps legacy Gemini path and does not bypass ownership", () => {
  assert.match(routeSource, /process\.env\.USE_FASTAPI_GENERATE === 'true'/)
  assert.match(routeSource, /prisma\.tcc\.findFirst\(\{ where: \{ id: tccId, userId \}/)
  assert.match(routeSource, /if \(isFastApiGenerateEnabled\(\)\)/)
  assert.match(routeSource, /await callGemini\(prompt\)/)
  assert.match(routeSource, /await callGeminiWithFiles\(pdfParts, prompt\)/)
})

test("flag on delegates to runGenerate and skips legacy Gemini calls inside branch", () => {
  const fastApiBranch = routeSource.slice(
    routeSource.indexOf("if (isFastApiGenerateEnabled())"),
    routeSource.indexOf("// Buscar referências selecionadas")
  )
  assert.match(fastApiBranch, /await runGenerate\(\{/)
  assert.doesNotMatch(fastApiBranch, /callGemini/)
  assert.match(fastApiBranch, /requireSources: typeof body\.requireSources === 'boolean'/)
})

test("flag on maps FastAPI response to legacy BFF response", () => {
  assert.match(routeSource, /sucesso: true/)
  assert.match(routeSource, /capitulo: result\.chapter/)
  assert.match(routeSource, /texto: result\.content/)
  assert.match(routeSource, /referenciasUsadas: result\.references_used/)
  assert.match(routeSource, /citations: result\.citations/)
})

test("flag on maps tcc_id_mismatch to 403", () => {
  assert.match(routeSource, /message === 'tcc_id_mismatch'/)
  assert.match(routeSource, /Recurso não autorizado/)
  assert.match(routeSource, /status: 403/)
})

test("flag on maps upstream invalid request to 422", () => {
  assert.match(routeSource, /message === 'upstream_invalid_request'/)
  assert.match(routeSource, /Requisição inválida/)
  assert.match(routeSource, /status: 422/)
})

test("flag on maps upstream unavailable to 503", () => {
  assert.match(
    routeSource,
    /message === 'ai_provider_unavailable' \|\| message === 'ai_provider_bad_response'/
  )
  assert.match(routeSource, /IA temporariamente indisponível/)
  assert.match(routeSource, /status: 503/)
})

test("flag on maps quota exceeded to 429", () => {
  assert.match(routeSource, /error instanceof QuotaExceededError/)
  assert.match(routeSource, /Limite diário atingido/)
  assert.match(routeSource, /status: 429/)
})

test("missing tccId and non-owner cases remain before both provider paths", () => {
  assert.match(routeSource, /if \(!tccId \|\| !tema\)/)
  assert.match(routeSource, /tccId e tema são obrigatórios/)
  assert.match(
    routeSource,
    /if \(!tcc\) return NextResponse\.json\(\{ error: 'TCC não encontrado\.' \}, \{ status: 404 \}\)/
  )
})
