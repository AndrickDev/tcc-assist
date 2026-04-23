# Teseo — Arquitetura Técnica Futura
## Backend FastAPI · RAG com pgvector · ABNT determinístico · Originalidade in-house
### Documento técnico para 2 devs backend plenos · Abril 2026

---

> **Uso:** documento de referência para execução técnica. Em PT-BR. Exportável para PDF (`pandoc`) ou Word.
> **Decisões já confirmadas:** pgvector como vector DB · estratégia de plágio híbrida (in-house + hook futuro para API paga) · 2 devs plenos com divisão por domínio.
> **Convenção:** *Fato* = afirmação verificada no código atual; *Hipótese* = suposição razoável a confirmar; *Recomendação* = sugestão arquitetural; *(não confirmado)* = depende de decisão de negócio ou técnica futura.

---

## Sumário

1. [Diagnóstico técnico do estado atual](#1-diagnóstico-técnico-do-estado-atual)
2. [Visão geral da arquitetura futura](#2-visão-geral-da-arquitetura-futura)
3. [Especificação dos módulos FastAPI](#3-especificação-dos-módulos-fastapi)
4. [Schema novo do PostgreSQL](#4-schema-novo-do-postgresql)
5. [Estratégia de memória e RAG](#5-estratégia-de-memória-e-rag)
6. [ABNT — pipeline determinístico](#6-abnt--pipeline-determinístico)
7. [Originalidade — pipeline híbrido](#7-originalidade--pipeline-híbrido)
8. [Roadmap detalhado em 5 fases](#8-roadmap-detalhado-em-5-fases)
9. [Divisão de devs sprint a sprint](#9-divisão-de-devs-sprint-a-sprint)
10. [Dívida técnica e mitigações](#10-dívida-técnica-e-mitigações)
11. [Apêndice A — Variáveis de ambiente e setup](#apêndice-a--variáveis-de-ambiente-e-setup)
12. [Apêndice B — Contratos OpenAPI principais](#apêndice-b--contratos-openapi-principais)
13. [Apêndice C — Decisões críticas para o time aprovar](#apêndice-c--decisões-críticas-para-o-time-aprovar)

---

## 1. Diagnóstico Técnico do Estado Atual

Todas as afirmações abaixo foram verificadas no código em `c:\Users\andri\Downloads\tcc-assist-main` (commit `816fda5`).

### 1.1 Stack confirmada

| Camada | Tecnologia | Arquivo de referência |
|---|---|---|
| Frontend | Next.js 15.5 + React 19 + TypeScript | `package.json` |
| Editor | Tiptap v3 + autosave | `src/components/RichEditor.tsx` |
| Auth | NextAuth v5 (beta) + Prisma adapter | `src/lib/auth.ts` |
| ORM | Prisma 5.22 | `prisma/schema.prisma` |
| Banco | PostgreSQL (Prisma.io) | env `DATABASE_URL` |
| Pagamento | Stripe v20 (one-time) | `src/lib/stripe.ts` |
| IA | Google Gemini Flash | `src/lib/gemini.ts` |
| Storage | Vercel Blob | `src/app/api/tcc/[id]/attachments/` |
| Deploy | Vercel | `next.config.ts` |

### 1.2 Arquitetura de IA atual — confirmada por leitura

O fluxo principal está em `src/lib/agents/aiox-integration.ts` na função `runTccWorkflow()`.

**Como o contexto é montado (linhas 56-132):**

1. Carrega do banco: `title`, `course`, `institution`, `workType`, `norma`, `objective` da tabela `Tcc`
2. Monta um bloco `[CONTEXTO DO TCC]` com esses metadados
3. Carrega histórico:
   - **FREE:** zero mensagens
   - **PRO:** últimas 3 mensagens
   - **VIP:** últimas 8 mensagens
4. Concatena: `system_prompt + tcc_metadata + conversation_context + "REQUISITO DO USUÁRIO: " + message`
5. Adiciona guardrails de qualidade (sem placeholders, sem metalinguagem)
6. Chama Gemini de forma **síncrona** dentro do request HTTP

**Não existe:**
- Sumarização de mensagens antigas
- Retrieval (RAG)
- Carregamento dos PDFs anexados (eles existem mas são ignorados aqui)
- Memória estruturada (decisões, observações)

### 1.3 Uso real dos PDFs — confirmado

PDFs são carregados via `POST /api/tcc/[id]/attachments`, gravados no Vercel Blob.

**Eles só são lidos em UM endpoint:** `src/app/api/gerar-tcc/route.ts` (linhas 26-42), onde são convertidos para base64 e enviados ao Gemini como inline binary data, sem extração de texto ou chunking.

No chat principal (`/api/chat` → `runTccWorkflow`) os PDFs são completamente ignorados. **Esta é uma das maiores oportunidades de produto perdidas hoje.**

### 1.4 Originalidade mockada — confirmada

Em `src/app/api/tcc/[id]/stats/route.ts` (linhas 45-53):

```typescript
const scores = recentMsgs
  .map(m => { const match = m.content.match(/Originalidade: (\d+)%/); return match ? 100 - parseInt(match[1]) : null; })
  .filter((s): s is number => s !== null);

const plagiarismScore = scores.length > 0
  ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10
  : 4.2;  // <-- HARDCODED FALLBACK

const humanAuthorship = Math.max(0, Math.min(100, 100 - plagiarismScore * 1.5));
```

A regex procura "Originalidade: X%" em mensagens — string que o Gemini nunca gera. Resultado: sempre cai no fallback **4.2**. A UI exibe "ORIGINALIDADE: 96.2%" como se fosse real.

### 1.5 ABNT só em prompt — confirmada

Em `src/lib/agents/guardrails.ts`, a "ação ABNT" (VIP) tem o prompt:

> "Corrija itálicos em palavras estrangeiras, espace citações longas (se aplicável na estrutura HTML fornecida), e elimine coloquialismos verbais que firam a formalidade da norma. NÃO adicione novas citações."

**Não existe nenhuma função que valide margens, fonte, espaçamento ou formato de citações.** Tudo é delegado à interpretação do Gemini. A única referência a ABNT em código é a constante `ABNT_PAGE_CHARS = 1800` usada em cálculo de páginas.

### 1.6 Versionamento — confirmado inexistente

A tabela `Tcc` tem uma coluna `content` que é **sobrescrita in-place** a cada save. Não existe tabela de snapshots, revisões ou histórico. Aceitar uma sugestão de IA destrói permanentemente o conteúdo anterior.

### 1.7 Limitações do Next.js para IA — fato

- Vercel Serverless Functions têm timeout de ~10s (Hobby/Pro). Geração de capítulos longos pode atingir esse limite.
- Não há suporte a jobs assíncronos nativos.
- Não há processo persistente: cold start a cada request, sem cache de modelos em memória.
- Bibliotecas Python (LangChain, LlamaIndex, unstructured, python-docx) não estão disponíveis.

### 1.8 Bugs e gaps conhecidos do produto

Da memória do projeto (`memory/project_status.md`):

- **B6 (alta):** rotas `/api/tcc/[id]/*` podem não validar `userId`. Risco de vazamento.
- **B5 (média):** limite diário em `localStorage`, fácil de burlar.
- **B4 (média):** Turnitin exibe valor estimado.
- LGPD: sem política de privacidade publicada, sem endpoint de exclusão.
- E-mail: sem provider, sem recuperação de senha.
- Rate limiting: inexistente além do limite diário in-memory.

---

## 2. Visão Geral da Arquitetura Futura

```
Next.js 15 (Vercel) ──── Frontend + Auth + Stripe + CRUDs simples
        │
        │  JWT (HS256, NEXTAUTH_SECRET compartilhado)
        ▼
FastAPI (Railway/Render) ──── Cérebro: IA, RAG, ABNT, originalidade
        │
        ├─ chamadas síncronas (resposta < 5s)
        │
        └─ enfileira jobs ──── Celery Workers ──── tasks longas/pesadas
                                       │
                                       ▼
                               PostgreSQL + pgvector ──── verdade única
                                       │
                                       └─ Vercel Blob ──── arquivos
                                       └─ Redis (Upstash) ── broker + cache + rate limit
```

### 2.1 Princípios arquiteturais

1. **Separação por ganho concreto** — Next.js mantém o que já funciona (frontend, NextAuth, Stripe). FastAPI assume o que o Next não consegue fazer bem (IA stateful, async, ecossistema Python).
2. **Postgres como fonte única da verdade** — não duplicar dados. Tanto Next quanto FastAPI leem do mesmo banco.
3. **Migração incremental** — em qualquer momento o produto continua funcional. Sem big bang.
4. **JWT compartilhado** — NextAuth assina, FastAPI valida. Mesmo segredo, mesmo payload, mesmo formato.
5. **Sem dívida desde o início** — versionamento de embeddings, dead-letter queue, logging estruturado e testes desde a Sprint 1.

### 2.2 O que muda no Next.js

| Permanece | É deprecado / proxy |
|---|---|
| `/login`, `/register`, `/dashboard`, `/tcc/[id]`, `/pricing` | `/api/chat` → proxy para FastAPI |
| `/api/auth/*` | `/api/ai-action` → proxy para FastAPI |
| `/api/stripe/*` | `/api/gerar-tcc` → proxy para FastAPI |
| `/api/tcc` (criar/listar/deletar) | `/api/tcc/[id]/stats` → consome FastAPI |
| `/api/tcc/[id]` (read/update content) | Upload de PDFs → proxy para FastAPI |
| `/api/user/profile` | |

### 2.3 Hosting recomendado *(não confirmado)*

| Componente | Recomendação | Custo estimado |
|---|---|---|
| Next.js | Vercel (atual) | Hobby/Pro |
| FastAPI | **Railway** | US$ 5-20/mês |
| Celery worker | Railway (mesmo serviço, processo separado) | incluído |
| Postgres | Manter Prisma.io ou migrar para Neon/Supabase | US$ 0-25/mês |
| Redis | **Upstash** (free tier 10k req/dia) | US$ 0 inicial |
| Email | **Resend** (free tier 100/dia) | US$ 0 inicial |

Subdomínio: `api.teseo.app` apontando para Railway. Cookies SameSite=Lax + CORS estrito.

---

## 3. Especificação dos Módulos FastAPI

Estrutura de pastas proposta:

```
backend/
├── app/
│   ├── main.py                  # FastAPI app, middlewares
│   ├── core/
│   │   ├── config.py            # Pydantic Settings
│   │   ├── db.py                # Async SQLAlchemy session
│   │   ├── security.py          # JWT validation
│   │   ├── deps.py              # Dependencies (get_user, get_db)
│   │   └── logging.py           # Structured JSON logging
│   ├── projects/
│   │   ├── router.py            # /projects/{tcc_id}/memory
│   │   ├── models.py            # ProjectMemory ORM
│   │   ├── schemas.py           # Pydantic IO models
│   │   └── service.py           # Business logic
│   ├── documents/
│   │   ├── router.py            # /documents/upload
│   │   ├── extractor.py         # PDF text extraction
│   │   └── chunker.py           # Semantic chunking
│   ├── embeddings/
│   │   ├── provider.py          # Gemini text-embedding-004
│   │   └── cache.py             # Redis hash-based cache
│   ├── rag/
│   │   ├── router.py            # /rag/search, /rag/ground
│   │   ├── retrieval.py         # pgvector cosine search
│   │   └── reranker.py          # (futuro) cross-encoder
│   ├── agents/
│   │   ├── orientador.py        # Project state analysis
│   │   ├── redator.py           # RAG-augmented writing
│   │   └── revisor.py           # Coesion + grammar
│   ├── abnt/
│   │   ├── validator.py         # Deterministic checks
│   │   ├── formatter.py         # HTML normalization
│   │   └── exporter.py          # HTML → DOCX
│   ├── originality/
│   │   ├── checker.py           # In-house pipeline
│   │   └── providers.py         # Hook for paid APIs
│   ├── versions/
│   │   ├── router.py            # /tcc/{id}/versions
│   │   └── differ.py            # diff_match_patch
│   └── jobs/
│       ├── celery_app.py        # Celery instance
│       ├── tasks.py             # @task decorated functions
│       └── status.py            # JobRun read API
├── alembic/                     # Migrations (only for FastAPI-owned tables)
├── tests/
├── pyproject.toml               # Poetry / uv
├── Dockerfile
└── docker-compose.yml
```

### 3.1 `core/` — Fundação

**`config.py`** — Pydantic BaseSettings, lê `.env`:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    NEXTAUTH_SECRET: str        # shared with Next.js for JWT
    REDIS_URL: str              # Upstash
    GOOGLE_API_KEY: str         # Gemini
    VERCEL_BLOB_TOKEN: str
    ENV: str = "development"
    CORS_ORIGINS: list[str] = ["https://teseo.app"]

    class Config:
        env_file = ".env"

settings = Settings()
```

**`security.py`** — Valida JWT emitido pelo NextAuth:

```python
from jose import jwt, JWTError
from fastapi import HTTPException, Depends, Header

async def get_current_user(authorization: str = Header(...)):
    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(
            token,
            settings.NEXTAUTH_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False}
        )
    except JWTError:
        raise HTTPException(401, "Invalid token")
    return CurrentUser(
        id=payload["id"],
        email=payload.get("email"),
        plan=payload.get("plan", "FREE"),
        role=payload.get("role", "USER"),
    )
```

> **Crítico:** o payload do JWT do NextAuth precisa coincidir exatamente. Atualmente em `src/lib/auth.ts` (callback `jwt`) já são adicionados `id`, `role`, `plan`. **Não mudar este formato** sem coordenar com o Next.

### 3.2 `projects/` — Memória persistente

**Endpoints:**

```
GET    /projects/{tcc_id}/memory                  # full memory
PATCH  /projects/{tcc_id}/memory                  # update fields
POST   /projects/{tcc_id}/decisions               # append decision
POST   /projects/{tcc_id}/observations            # append observation
PATCH  /projects/{tcc_id}/chapters/{chapter_id}   # update chapter status
POST   /projects/{tcc_id}/references/select       # mark PDF as selected
```

**Service (pseudocódigo):**

```python
class ProjectMemoryService:
    async def add_decision(self, tcc_id: str, decision: DecisionIn, by: str):
        memory = await self.get_or_create(tcc_id)
        memory.decisions.append({
            "date": datetime.utcnow().isoformat(),
            "decision": decision.text,
            "by": by  # "user" or "agent"
        })
        # Rotação: mantém só as últimas 50
        memory.decisions = memory.decisions[-50:]
        await self.repo.save(memory)
        return memory
```

### 3.3 `documents/` — Ingestão de PDFs

```
POST   /documents/upload?tcc_id={id}     # multipart, retorna job_id
GET    /documents/{doc_id}                # status + metadados
DELETE /documents/{doc_id}                # remove + chunks
GET    /tcc/{tcc_id}/documents            # lista documentos do TCC
```

Fluxo do upload:
1. Recebe arquivo (PDF, DOCX, TXT)
2. Salva no Vercel Blob (path `references/{tcc_id}/{doc_id}.pdf`)
3. Cria registro `Document` com status `pending`
4. Enfileira task Celery `ingest_document(doc_id)`
5. Retorna 202 com `job_id`

A task Celery:
1. Baixa arquivo do Blob
2. Extrai texto via `unstructured` ou `pypdf` (fallback)
3. Chunking semântico: 300-500 tokens por chunk, overlap 50, respeitando limites de parágrafo
4. Para cada chunk: gera embedding via `embeddings.provider.embed(text)`
5. Insere em `DocumentChunk` com vetor, posição, página
6. Atualiza status do `Document` para `ready`

### 3.4 `embeddings/`

```python
class EmbeddingProvider:
    def __init__(self, model_version: str = "gemini-text-embedding-004"):
        self.model_version = model_version

    async def embed(self, text: str) -> tuple[list[float], str]:
        # Cache lookup
        h = hashlib.sha256(text.encode()).hexdigest()
        cached = await redis.get(f"emb:{self.model_version}:{h}")
        if cached:
            return json.loads(cached), self.model_version

        # API call
        resp = await gemini_client.embed_content(
            model="models/text-embedding-004",
            content=text,
            task_type="retrieval_document"
        )
        vec = resp["embedding"]

        # Cache
        await redis.set(f"emb:{self.model_version}:{h}", json.dumps(vec), ex=86400 * 30)
        return vec, self.model_version
```

### 3.5 `rag/` — Recuperação semântica

```
POST /rag/search
  body: { tcc_id, query, top_k=5, filter_doc_ids?=[] }
  returns: [{ chunk_id, doc_id, text, page, score }]

POST /rag/ground
  body: { tcc_id, generated_text }
  returns: [{ sentence, supporting_chunks: [...] }]
```

Query SQL (pgvector):

```sql
SELECT id, doc_id, text, page,
       1 - (embedding <=> :query_vec) AS score
FROM document_chunks
WHERE tcc_id = :tcc_id
  AND embedding_model_version = :model_version
ORDER BY embedding <=> :query_vec
LIMIT :top_k;
```

### 3.6 `agents/`

```python
class RedatorAgent:
    async def write(self, tcc_id: str, instruction: str, chapter_id: str, plan: str):
        # 1. Memória do projeto
        memory = await project_service.get_memory(tcc_id)

        # 2. RAG
        chunks = await rag_service.search(tcc_id, instruction, top_k=5)

        # 3. Histórico compactado
        history = await message_service.get_compacted(tcc_id, recent=5)

        # 4. Capítulo atual
        chapter = await version_service.get_current(tcc_id, chapter_id)

        # 5. Monta prompt
        prompt = self._build_prompt(memory, chunks, history, chapter, instruction, plan)

        # 6. Chama IA
        result = await ai_provider.complete(prompt, plan=plan)

        # 7. Persiste mensagem
        await message_service.save(tcc_id, role="bot", content=result, agent=f"redator-{plan.lower()}")

        # 8. Retorna com fontes para grounding visual
        return {"content": result, "sources": chunks}
```

### 3.7 `abnt/`

**`validator.py` — checks determinísticos:**

```python
class AbntValidator:
    def validate(self, html: str) -> AbntReport:
        violations = []
        soup = BeautifulSoup(html, "lxml")

        # Citações inline
        for p in soup.find_all("p"):
            for match in re.finditer(r"\(([^)]+)\)", p.text):
                if not self._is_valid_inline_citation(match.group(1)):
                    violations.append(Violation(
                        type="invalid_inline_citation",
                        location=p.sourceline,
                        suggestion="Use formato (SOBRENOME, ANO) ou Sobrenome (ANO)"
                    ))

        # Citação direta longa
        for p in soup.find_all("p"):
            if len(p.text.split()) > 40 and "blockquote" not in p.parent.name:
                violations.append(Violation(
                    type="long_quote_not_indented",
                    location=p.sourceline,
                    suggestion="Citações > 40 palavras devem ser recuadas 4cm em bloco"
                ))

        # Referências NBR 6023
        refs_section = soup.find("section", {"id": "referencias"})
        if refs_section:
            for ref_text in refs_section.find_all("p"):
                if not self._is_valid_reference(ref_text.text):
                    violations.append(...)

        return AbntReport(violations=violations, score=self._compute_score(violations))
```

**`exporter.py` — HTML → DOCX:**

```python
from docx import Document
from docx.shared import Cm, Pt
from docx.enum.text import WD_LINE_SPACING

class AbntExporter:
    def export(self, tcc: Tcc) -> bytes:
        doc = Document()

        # Margens ABNT
        for section in doc.sections:
            section.top_margin = Cm(3)
            section.bottom_margin = Cm(2)
            section.left_margin = Cm(3)
            section.right_margin = Cm(2)

        # Estilo padrão
        style = doc.styles["Normal"]
        style.font.name = "Times New Roman"
        style.font.size = Pt(12)
        style.paragraph_format.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
        style.paragraph_format.first_line_indent = Cm(1.25)

        # Capa
        self._add_cover(doc, tcc)
        self._add_title_page(doc, tcc)

        # Sumário automático
        self._add_toc(doc)

        # Conteúdo
        self._render_html_to_docx(doc, tcc.content)

        # Referências
        self._add_references(doc, tcc.references)

        buf = io.BytesIO()
        doc.save(buf)
        return buf.getvalue()
```

### 3.8 `originality/`

```python
class OriginalityProvider(Protocol):
    async def check(self, tcc_id: str, text: str) -> OriginalityReport: ...

class InHouseProvider:
    async def check(self, tcc_id: str, text: str) -> OriginalityReport:
        # 1. Sliding-window chunking
        windows = list(self._sliding_windows(text, size=100, overlap=20))

        flagged = []
        for window in windows:
            # 2. Embed
            vec, _ = await embeddings.embed(window.text)

            # 3. Search nos próprios capítulos + PDFs do projeto
            matches = await db.execute(
                select(DocumentChunk)
                .where(DocumentChunk.tcc_id == tcc_id)
                .where(DocumentChunk.embedding.cosine_distance(vec) < 0.15)
                .limit(3)
            )

            for match in matches.scalars():
                similarity = 1 - cosine_distance(vec, match.embedding)
                if similarity > 0.85:
                    flagged.append(FlaggedSpan(
                        text=window.text,
                        start=window.start,
                        end=window.end,
                        similarity=similarity,
                        source_chunk_id=match.id,
                        source_doc=match.document.filename,
                    ))

        return OriginalityReport(
            tcc_id=tcc_id,
            flagged=flagged,
            overall_risk=self._compute_risk(flagged),
            checked_at=datetime.utcnow(),
        )

class CopyleaksProvider:
    """Drop-in replacement para plano VIP futuro."""
    async def check(self, tcc_id: str, text: str) -> OriginalityReport:
        ...  # chamada à API Copyleaks
```

### 3.9 `versions/`

```
GET    /tcc/{tcc_id}/versions                  # lista
GET    /tcc/{tcc_id}/versions/{version_id}     # conteúdo
POST   /tcc/{tcc_id}/versions                  # snapshot manual
POST   /tcc/{tcc_id}/versions/{id}/restore     # rollback
GET    /tcc/{tcc_id}/versions/diff?a=...&b=... # diff visual
```

Snapshot automático em dois eventos:
- A cada save com debounce de 30s (se conteúdo mudou)
- Quando o usuário aceita uma sugestão de IA

### 3.10 `jobs/`

```python
from celery import Celery

celery_app = Celery(
    "teseo",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def ingest_document(self, doc_id: str):
    try:
        # ... extração, chunking, embeddings
        update_status(doc_id, "ready")
    except Exception as e:
        update_status(doc_id, "failed", error=str(e))
        raise self.retry(exc=e)

# Dead-letter queue
celery_app.conf.task_routes = {
    "ingest_document": {"queue": "default"},
}
celery_app.conf.task_reject_on_worker_lost = True
celery_app.conf.task_acks_late = True
```

Endpoint público:

```
GET /jobs/{job_id}  → { id, status, progress, result_url?, error? }
```

Frontend faz polling a cada 3s para mostrar progresso. Sem WebSocket no MVP.

---

## 4. Schema Novo do PostgreSQL

### 4.1 Tabelas a serem adicionadas

**Decisão crítica:** Prisma continua dono do schema. Estas tabelas serão adicionadas ao `prisma/schema.prisma` e migradas via `prisma migrate`. SQLAlchemy do FastAPI lê via reflection.

```prisma
// ───── Memória persistente do projeto ─────
model ProjectMemory {
  id                  String   @id @default(cuid())
  tccId               String   @unique
  researchQuestion    String?  @db.Text
  methodology         String?  @db.Text
  targetAudience      String?  @db.Text
  decisions           Json     @default("[]")
  observations        Json     @default("[]")
  selectedReferences  Json     @default("[]")
  chapterStatus       Json     @default("{}")
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  tcc                 Tcc      @relation(fields: [tccId], references: [id], onDelete: Cascade)
}

// ───── Versionamento de capítulos ─────
model TccVersion {
  id              String   @id @default(cuid())
  tccId           String
  chapterId       String?
  contentHtml     String   @db.Text
  changeSummary   String?  @db.Text
  createdBy       String   // "user" | "agent"
  createdAt       DateTime @default(now())
  tcc             Tcc      @relation(fields: [tccId], references: [id], onDelete: Cascade)

  @@index([tccId, createdAt])
}

// ───── Documentos (PDFs ingeridos) ─────
model Document {
  id           String         @id @default(cuid())
  tccId        String
  fileName     String
  fileUrl      String
  fileSize     Int
  mimeType     String
  status       DocumentStatus @default(pending)
  errorMessage String?
  createdAt    DateTime       @default(now())
  chunks       DocumentChunk[]
  tcc          Tcc            @relation(fields: [tccId], references: [id], onDelete: Cascade)

  @@index([tccId])
}

enum DocumentStatus { pending  processing  ready  failed }

// ───── Chunks com embedding (pgvector) ─────
// ATENÇÃO: o tipo Unsupported("vector(768)") requer a extensão pgvector habilitada.
// Migration manual: CREATE EXTENSION IF NOT EXISTS vector;
model DocumentChunk {
  id                       String   @id @default(cuid())
  documentId               String
  tccId                    String
  text                     String   @db.Text
  page                     Int?
  position                 Int
  embedding                Unsupported("vector(768)")
  embeddingModelVersion    String
  createdAt                DateTime @default(now())
  document                 Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([tccId])
  @@index([documentId])
}

// ───── Citações extraídas ─────
model Citation {
  id          String   @id @default(cuid())
  tccId       String
  chunkId     String?
  authors     String[]
  year        Int?
  title       String?
  source      String?  // periódico, editora, URL
  format      String?  // ABNT | APA | Vancouver
  raw         String   @db.Text
  createdAt   DateTime @default(now())

  @@index([tccId])
}

// ───── Relatórios de originalidade ─────
model OriginalityReport {
  id           String   @id @default(cuid())
  tccId        String
  chapterId    String?
  flaggedSpans Json     // [{ text, start, end, similarity, source_chunk_id }]
  overallRisk  Float    // 0..1
  provider     String   // "in_house" | "copyleaks"
  createdAt    DateTime @default(now())

  @@index([tccId, createdAt])
}

// ───── Observações do agente Orientador ─────
model AgentObservation {
  id          String   @id @default(cuid())
  tccId       String
  chapterId   String?
  type        String   // gap | weak | strength | next_step
  text        String   @db.Text
  acknowledged Boolean @default(false)
  createdAt   DateTime @default(now())

  @@index([tccId])
}

// ───── Relatórios de validação ABNT ─────
model AbntCheck {
  id          String   @id @default(cuid())
  tccId       String
  violations  Json     // [{ type, location, suggestion }]
  score       Float    // 0..1
  createdAt   DateTime @default(now())

  @@index([tccId, createdAt])
}

// ───── Rastreamento de jobs Celery ─────
model JobRun {
  id          String     @id @default(cuid())
  type        String     // ingest_pdf | export_docx | originality_check | etc.
  status      JobStatus  @default(queued)
  progress    Int        @default(0)
  resultUrl   String?
  errorMessage String?
  payload     Json
  userId      String?
  tccId       String?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([userId])
  @@index([tccId])
}

enum JobStatus { queued  running  succeeded  failed }
```

### 4.2 Migrações pgvector

```sql
-- Migration manual antes da migration do Prisma:
CREATE EXTENSION IF NOT EXISTS vector;

-- Após Prisma migrate, criar índice IVFFlat:
CREATE INDEX document_chunks_embedding_idx
  ON "DocumentChunk"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

---

## 5. Estratégia de Memória e RAG

### 5.1 Construção do contexto a cada chamada de IA

```python
async def build_context(tcc_id: str, user_message: str, chapter_id: str | None) -> Context:
    # 1. Identidade (fixo)
    tcc = await tcc_repo.get(tcc_id)
    identity = format_identity(tcc)  # título, área, norma, objetivo

    # 2. Memória estruturada
    memory = await project_service.get_memory(tcc_id)
    memory_block = format_memory(memory)  # decisões, observações, status

    # 3. Capítulo em foco
    chapter_content = await version_service.get_current(tcc_id, chapter_id) if chapter_id else ""

    # 4. RAG
    chunks = await rag_service.search(tcc_id, user_message, top_k=5)
    rag_block = format_chunks(chunks)

    # 5. Histórico compactado
    summaries = await message_repo.get_old_summaries(tcc_id, before_days=7)
    recent = await message_repo.get_recent(tcc_id, limit=5)
    history_block = format_history(summaries, recent)

    return Context(
        identity=identity,
        memory=memory_block,
        chapter=chapter_content,
        rag=rag_block,
        history=history_block,
        user_message=user_message,
    )
```

### 5.2 Compactação de mensagens antigas

Job Celery rodando 1x/dia:

```python
@celery_app.task
def summarize_old_messages():
    # Para cada TCC ativo
    for tcc in active_tccs():
        # Pega mensagens > 7 dias sem summary
        old_msgs = message_repo.find_unsummarized(tcc.id, before_days=7)
        if len(old_msgs) < 5:
            continue

        # Agrupa em janelas de 5 mensagens
        for window in chunked(old_msgs, 5):
            summary = ai_provider.summarize_messages(window)
            for msg in window:
                msg.summary = summary
            message_repo.save_all(window)
```

Quando o histórico é montado, mensagens antigas vão como resumo (1 linha por janela), recentes vão cruas. Isso evita estourar o limite de tokens do Gemini.

### 5.3 Pipeline de RAG

```
Pergunta do usuário
    ↓
Embedding da query (text-embedding-004, task_type=retrieval_query)
    ↓
SELECT em DocumentChunk WHERE tcc_id = X
ORDER BY embedding <=> query_vec
LIMIT 5
    ↓
Top-5 chunks com texto, página, doc_origem
    ↓
Inseridos no prompt do Redator com formato:
    [REFERÊNCIAS RELEVANTES]
    [REF1] (Doc: Smith2020.pdf, p.23) "..."
    [REF2] (Doc: Silva2019.pdf, p.5)  "..."
    ↓
Redator é instruído a citar [REF1], [REF2] explicitamente
    ↓
Resposta da IA + lista de fontes para UI mostrar grounding
```

---

## 6. ABNT — Pipeline Determinístico

### 6.1 Validações implementadas no `validator.py`

| Categoria | Verificação | Severidade |
|---|---|---|
| Citação inline | `(SOBRENOME, ANO)` ou `Sobrenome (ANO)` | Erro |
| Citação direta longa | parágrafos &gt; 40 palavras devem estar em `<blockquote>` | Aviso |
| Referência NBR 6023 | parser por tipo (livro, artigo, web) | Erro |
| Estrutura mínima | introdução, desenvolvimento, conclusão presentes | Aviso |
| Hierarquia de títulos | sem pular níveis (H1 → H3 sem H2) | Aviso |
| Aspas | uso correto (aspas duplas para citação curta) | Info |

### 6.2 Aplicação no DOCX (`exporter.py`)

| Aspecto | Valor ABNT | Implementação |
|---|---|---|
| Margens | superior 3, esquerda 3, inferior 2, direita 2 cm | `section.{top,left,bottom,right}_margin` |
| Fonte | Times New Roman 12pt | `style.font.name`, `style.font.size` |
| Espaçamento | 1,5 linhas | `style.paragraph_format.line_spacing_rule` |
| Recuo de parágrafo | 1,25 cm na primeira linha | `style.paragraph_format.first_line_indent` |
| Citação direta longa | recuo de 4 cm, fonte 10pt, espaço simples | estilo customizado `quote_long` |
| Sumário | gerado a partir dos H1/H2 | inserção de TOC field |
| Numeração de páginas | canto superior direito a partir do sumário | section header + page field |
| Capa | título, autor, instituição, cidade, ano | template renderizado com dados do TCC |
| Folha de rosto | + tipo de trabalho, área, orientador | template |

### 6.3 Estrutura de cabeçalho/rodapé

```python
def _add_header_footer(doc, tcc):
    section = doc.sections[0]
    section.different_first_page_header_footer = True

    # Header com numeração (a partir da página 2)
    header = section.header
    p = header.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = p.add_run()
    field = OxmlElement("w:fldSimple")
    field.set(qn("w:instr"), "PAGE")
    run._r.append(field)
```

---

## 7. Originalidade — Pipeline Híbrido

### 7.1 Pseudocódigo do checker in-house

```python
async def check_originality(tcc_id: str, text: str, plan: str) -> OriginalityReport:
    # 1. Sliding window chunking
    windows = sliding_windows(text, size_tokens=100, overlap=20)

    flagged = []
    for window in windows:
        # 2. Embed
        vec, version = await embeddings.embed(window.text)

        # 3. Busca nos chunks do projeto (próprios capítulos + PDFs)
        matches = await db.execute(
            text("""
                SELECT id, doc_id, text, page,
                       1 - (embedding <=> :vec) AS similarity
                FROM document_chunks
                WHERE tcc_id = :tcc_id
                  AND embedding_model_version = :version
                ORDER BY embedding <=> :vec
                LIMIT 3
            """),
            {"vec": vec, "tcc_id": tcc_id, "version": version}
        )

        for m in matches:
            if m.similarity > 0.85:
                flagged.append({
                    "text": window.text,
                    "start": window.start,
                    "end": window.end,
                    "similarity": m.similarity,
                    "source_chunk_id": m.id,
                    "source_doc": m.doc_id,
                    "suggestion": "Reescrever mantendo a citação à fonte"
                })

    # 4. Computa risco geral
    overall_risk = compute_risk(flagged, total_windows=len(windows))

    # 5. Plano VIP futuro: chamar Copyleaks adicionalmente
    if plan == "VIP" and copyleaks_enabled:
        ext = await copyleaks_provider.check(tcc_id, text)
        flagged += ext.flagged

    # 6. Persiste relatório
    report = await report_repo.create(
        tcc_id=tcc_id,
        flagged_spans=flagged,
        overall_risk=overall_risk,
        provider="hybrid" if plan == "VIP" else "in_house",
    )

    return report
```

### 7.2 Limites éticos no produto

- **Nunca** sugerir remoção de citação para "esconder" similaridade
- **Sempre** sugerir paráfrase + manter referência à fonte
- Disclaimer obrigatório no UI: *"Esta verificação é interna ao Teseo e não substitui Turnitin/Copyleaks. Para verificação acadêmica oficial, use o serviço da sua instituição."*
- Logging: cada check gera entrada em `OriginalityReport` para auditoria

---

## 8. Roadmap Detalhado em 5 Fases

### Fase 0 — Bloqueios de produção (2-3 semanas, no Next.js atual)

| Tarefa | Onde | Critério de aceitação |
|---|---|---|
| Bug B6: validar `userId` em todas rotas `/api/tcc/[id]/*` | `src/app/api/tcc/[id]/**/*.ts` | testes manuais com 2 usuários: usuário A não acessa TCC do B |
| Política de privacidade + termos de uso | `src/app/legal/{privacy,terms}/page.tsx` | publicado, link no footer e no cadastro |
| Endpoint de exclusão de conta (LGPD Art. 18) | `src/app/api/user/delete/route.ts` | botão funcional em `/configuracoes` |
| Rate limiting com Upstash Redis | `src/middleware.ts` | 60 req/min por IP em rotas de IA |
| Recuperação de senha + Resend | `src/app/api/auth/reset/*` | fluxo completo testado |
| Remover/marcar índice de plágio mockado | `src/app/api/tcc/[id]/stats/route.ts:51` | UI mostra "calculado pelo Teseo (não substitui Turnitin)" |
| Conectar analytics ao PostHog | `src/lib/analytics.ts` | eventos visíveis no dashboard PostHog |

### Fase 1 — Bootstrap FastAPI + migração de IA (4-6 semanas)

**Entregas:**
- Repo `backend/` (monorepo subpasta) com FastAPI + SQLAlchemy + Alembic + Celery
- Docker Compose local (FastAPI + Postgres + Redis)
- Deploy em Railway com domínio `api.teseo.app`
- JWT bridge funcional
- `/api/chat`, `/api/ai-action`, `/api/gerar-tcc` proxy para FastAPI
- Schemas novos: `ProjectMemory`, `TccVersion`, `JobRun`
- Versionamento básico (snapshot ao aceitar sugestão de IA)

**Métrica de sucesso:** usuários do beta não percebem diferença; latência de chat aumenta no máx. 200ms (overhead de proxy + JWT decode).

### Fase 2 — RAG MVP + memória do projeto (6-8 semanas)

**Entregas:**
- pgvector habilitado no Postgres
- Schema `Document`, `DocumentChunk` com índice IVFFlat
- Pipeline de ingestão: upload → Celery → extração → chunking → embedding → indexação
- Endpoint `/rag/search` retornando top-5 chunks com score
- Agente Redator integrado com RAG (cita fontes nos resultados)
- API completa de `ProjectMemory` (decisões, observações, status)
- UI: aluno marca PDFs como "referências selecionadas"

**Métrica de sucesso:** em testes com 5 alunos do beta, ≥80% reportam que "a IA agora cita os PDFs que enviei".

### Fase 3 — ABNT determinístico + originalidade in-house (6-8 semanas)

**Entregas:**
- `AbntValidator` completo (margens, fonte, citações, NBR 6023)
- `AbntExporter` gerando DOCX corretamente formatado (capa, sumário, numeração)
- Pipeline de originalidade in-house funcional
- UI: trechos suspeitos destacados no editor
- Botão "sugerir paráfrase" integrado
- Sumarização automática de mensagens antigas (job diário)

**Métrica de sucesso:** export DOCX abre no Word sem warnings; passa em validação manual de 3 trabalhos reais por professor convidado.

### Fase 4 — Versão defensável (12-24 semanas)

- Agente Orientador com observações automáticas e plano de capítulos
- Comparação de artigos lado a lado
- Hook Copyleaks para plano VIP
- Painel B2B do orientador humano
- Diff visual de versões (`diff_match_patch` + UI lado a lado)
- App mobile (PWA primeiro, React Native depois)

---

## 9. Divisão de Devs Sprint a Sprint

> Convenção: 1 sprint = 2 semanas. Sprints rodam em paralelo, com escalonamento de 1 semana entre Dev A e Dev B nas primeiras sprints (B só começa S1 após A entregar S1+S2).

### Dev A — Plataforma e Persistência

| Sprint | Entregas | Critério de aceitação | Dependências |
|---|---|---|---|
| **A.S1** | Repo FastAPI + Docker Compose; conexão Postgres; CI básico (GitHub Actions: lint + test) | `docker-compose up` sobe FastAPI + Postgres + Redis local; `pytest` roda | — |
| **A.S2** | JWT bridge com NextAuth; endpoints `/health`, `/me`; CORS; logging estruturado | curl com token do Next retorna user no `/me` | A.S1 |
| **A.S3** | Migrações: ProjectMemory, TccVersion, JobRun; Celery + Upstash Redis; primeira task `ping` | task Celery executa e atualiza JobRun | A.S2 |
| **A.S4** | API `/projects/{tcc_id}/memory` (CRUD decisões, observações, status); rate limiting Redis | Postman collection valida todos endpoints | A.S3 |
| **A.S5** | Versionamento de capítulos (snapshot, listagem, restore, rollback) | snapshot automático ao chamar IA via Dev B | A.S3 |
| **A.S6** | Validador ABNT determinístico (margens, fonte, citações inline, hierarquia) | testes unitários com 10+ casos de TCC real | A.S5 |
| **A.S7** | Exporter DOCX com python-docx + estilos ABNT (capa, folha de rosto, sumário, numeração) | DOCX abre no Word sem warnings; validação manual aprovada | A.S6 |
| **A.S8** | Validador de referências NBR 6023; suite de testes; documentação OpenAPI completa | Swagger em `/docs` cobre 100% dos endpoints | A.S7 |

### Dev B — IA, RAG e Originalidade

| Sprint | Entregas | Critério de aceitação | Dependências |
|---|---|---|---|
| **B.S1** | Migrar `/api/chat` para FastAPI; abstração `AIProvider` (Gemini funcional, GPT stubbed) | chat continua funcionando idêntico ao atual | A.S2 |
| **B.S2** | Migrar `/api/ai-action` e `/api/gerar-tcc`; integração com `ProjectMemory` do Dev A | ações inline (revisar, ABNT prompt, citações, próx passo) funcionando | A.S4 |
| **B.S3** | pgvector setup; schema `Document` + `DocumentChunk`; pipeline de chunking (`unstructured` + tiktoken) | upload + ingestão de PDF de teste (10 páginas) gera ≥10 chunks com embedding | A.S3 |
| **B.S4** | Job Celery `ingest_document`; geração de embeddings via Gemini text-embedding-004; cache Redis | task processa 50-page PDF em &lt;30s | B.S3 |
| **B.S5** | Endpoint `/rag/search`; integração no agente Redator (RAG + grounding); UI mostra fontes citadas | resposta de chat com PDF anexado cita explicitamente o PDF | B.S4 |
| **B.S6** | Sumarização automática de mensagens antigas (Celery diário); compactação de contexto | TCCs com 50+ mensagens não estouram limite de tokens | B.S5 |
| **B.S7** | Pipeline de originalidade in-house; relatório `OriginalityReport`; UI de spans destacados | trecho copiado de PDF anexado é flagged com similaridade &gt; 0.85 | B.S6 |
| **B.S8** | Agente Orientador (gera observações estruturadas a cada save); UI de paráfrase | observações aparecem no painel lateral; clicar em paráfrase reescreve | B.S7 + A.S7 |

### Dependências cross-dev (visualização)

```
Semana:    1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16
Dev A:    [S1][S2][S3][S4][S5][S6][S7][S8]
Dev B:        [S1][S2][S3][S4][S5][S6][S7][S8]
                  ↑       ↑                  ↑
                  |       |                  └─ B.S8 depende de A.S7 (exporter pronto)
                  |       └─ B.S3 depende de A.S3 (Celery pronto)
                  └─ B.S1 depende de A.S2 (JWT bridge)
```

### Sincronização semanal (proposta)

- **Segunda-feira, 30 min:** revisão de contratos OpenAPI, definição de mocks para destravar
- **Sexta-feira, 30 min:** demo dos PRs da semana, deploy para staging
- **Pull Requests:** review obrigatório do outro dev em mudanças que tocam o contrato

### Pontos de risco específicos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| JWT payload diverge entre Next e FastAPI | Média | Alto | Suite de testes de contrato roda em CI dos dois lados |
| Drift de schema Prisma vs SQLAlchemy | Alta | Médio | Pre-commit hook valida que SQLAlchemy reflete schema atual |
| Celery sem visibilidade de falhas | Alta | Alto | Sentry + DLQ desde A.S3; alertas no Slack |
| Custo de embeddings escala mal | Média | Médio | Cache Redis + dedup; alerta de gasto Gemini > US$50/mês |
| Validador ABNT muito permissivo (poucos erros) ou agressivo (muitos falsos positivos) | Alta | Médio | Validação manual com 10 TCCs reais antes de fechar A.S6 |
| RAG retorna chunks irrelevantes | Média | Alto | Reranking opcional com cross-encoder em B.S5 (stretch) |

---

## 10. Dívida Técnica e Mitigações

### 10.1 Onde a dívida pode nascer

| Fonte de dívida | Mitigação | Quando travar a decisão |
|---|---|---|
| Dois ORMs (Prisma + SQLAlchemy) com fontes de verdade conflitantes | Prisma é dono. SQLAlchemy lê via reflection. Alembic só para tabelas exclusivas do FastAPI. | Antes da Sprint A.S3 |
| Duplicação de lógica de plano (limits) em Next + FastAPI | Centralizar em endpoint `/me/plan` que ambos consultam, ou tabela `plan_config` única. | Antes da Sprint B.S2 |
| Manter `/api/chat` legado no Next "por compatibilidade" | Deprecar com prazo claro (1 release), remover do código depois. | Sprint B.S2 |
| Embeddings sem versionamento de modelo | Coluna `embeddingModelVersion` em `DocumentChunk`. Job de reembedding quando trocar modelo. | Antes da Sprint B.S3 |
| Memória do projeto crescer sem limite | Limite de 50 decisões/observações. Rotação automática (mais antigas viram resumo). | Antes da Sprint A.S4 |
| Celery sem dead-letter queue | DLQ + Sentry desde Sprint A.S3. Sem deploy sem DLQ configurada. | Sprint A.S3 |
| Sem testes de integração entre Next ↔ FastAPI | Pytest sobe Docker Compose e testa fluxos completos. | Antes do fim da Fase 1 |
| Logs espalhados | Logging estruturado JSON desde Sprint A.S2. Datadog ou Better Stack. | Sprint A.S2 |
| Variáveis de ambiente sem validação | Pydantic Settings com `validate_assignment = True`. Falhar boot se faltar. | Sprint A.S1 |
| Migrations sem rollback testado | Cada migration tem `down()` testado em CI antes de merge. | Sprint A.S3 |

### 10.2 Decisões que NÃO podem ser adiadas

| Decisão | Quando | Por quê |
|---|---|---|
| Quem é dono do schema (Prisma ou Alembic) | Antes da Sprint A.S3 | Sem isso, devs bloqueiam um ao outro com migrations conflitantes |
| Como JWT é assinado e validado entre serviços | Sprint A.S2 | Dev B não pode começar B.S1 sem isso |
| Estratégia de versionamento de embeddings | Antes de B.S3 | Trocar modelo depois exige reembedding caríssimo |
| Política de retenção de memória de projeto | Antes de A.S4 | Sem limite, JSON cresce indefinidamente |
| Hosting do FastAPI | Antes de A.S1 | Dev A precisa saber onde vai deployar |

---

## Apêndice A — Variáveis de Ambiente e Setup

### A.1 Variáveis de ambiente do FastAPI

```env
# Core
ENV=development
LOG_LEVEL=info

# Database (mesmo Postgres do Next.js)
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/teseo

# Auth (compartilhado com Next.js)
NEXTAUTH_SECRET=...     # MESMO valor do .env do Next

# Redis (Upstash)
REDIS_URL=rediss://...

# AI providers
GOOGLE_API_KEY=...

# Storage
VERCEL_BLOB_TOKEN=...

# CORS
CORS_ORIGINS=https://teseo.app,https://www.teseo.app

# Sentry
SENTRY_DSN=...
```

### A.2 Variáveis adicionadas ao Next.js

```env
# Backend FastAPI
TESEO_API_URL=https://api.teseo.app
TESEO_API_INTERNAL_TOKEN=...   # opcional: para chamadas server-to-server
```

### A.3 Comandos de setup (Dev A.S1)

```bash
# Backend
cd backend
poetry install
docker-compose up -d postgres redis
poetry run alembic upgrade head
poetry run uvicorn app.main:app --reload --port 8000

# Worker (terminal separado)
poetry run celery -A app.jobs.celery_app worker --loglevel=info

# Tests
poetry run pytest -v
```

---

## Apêndice B — Contratos OpenAPI Principais

Estes contratos são o "source of truth" para integração Next ↔ FastAPI. Definidos na Sprint A.S2/B.S1.

### B.1 Auth

```yaml
GET /me
  headers:
    Authorization: Bearer <jwt>
  responses:
    200: { id, email, name, plan, role }
    401: invalid token
```

### B.2 Chat

```yaml
POST /tcc/{tcc_id}/chat
  headers:
    Authorization: Bearer <jwt>
  body:
    message: string
    chapter_id?: string
  responses:
    200:
      message_id: string
      content: string
      sources: [{ doc_id, page, text }]
      observations?: [{ type, text }]
    402: plan limit reached
    429: rate limited
```

### B.3 Documentos

```yaml
POST /documents/upload
  headers:
    Authorization: Bearer <jwt>
  body (multipart):
    tcc_id: string
    file: binary
  responses:
    202:
      document_id: string
      job_id: string
      status: pending

GET /documents/{document_id}
  responses:
    200: { id, file_name, status, chunks_count, error_message? }
```

### B.4 RAG

```yaml
POST /rag/search
  headers:
    Authorization: Bearer <jwt>
  body:
    tcc_id: string
    query: string
    top_k?: number = 5
    filter_doc_ids?: string[]
  responses:
    200:
      results: [{ chunk_id, doc_id, doc_name, page, text, score }]
```

### B.5 Memória

```yaml
GET    /projects/{tcc_id}/memory
PATCH  /projects/{tcc_id}/memory
POST   /projects/{tcc_id}/decisions
  body: { text: string }
POST   /projects/{tcc_id}/observations
  body: { type: string, text: string }
PATCH  /projects/{tcc_id}/chapters/{chapter_id}
  body: { status: string, content?: string }
```

### B.6 ABNT

```yaml
POST /tcc/{tcc_id}/abnt/validate
  responses:
    200: { violations: [...], score: number }

POST /tcc/{tcc_id}/abnt/export
  body: { include_cover: boolean, include_toc: boolean }
  responses:
    202: { job_id }

GET /jobs/{job_id}
  responses:
    200: { id, status, progress, result_url? }
```

### B.7 Originalidade

```yaml
POST /tcc/{tcc_id}/originality/check
  body:
    text: string
    chapter_id?: string
  responses:
    200:
      report_id: string
      flagged_spans: [{ text, start, end, similarity, source_doc, suggestion }]
      overall_risk: number
```

### B.8 Versões

```yaml
GET    /tcc/{tcc_id}/versions
GET    /tcc/{tcc_id}/versions/{version_id}
POST   /tcc/{tcc_id}/versions
  body: { change_summary?: string }
POST   /tcc/{tcc_id}/versions/{version_id}/restore
GET    /tcc/{tcc_id}/versions/diff?a=v1&b=v2
```

---

## Apêndice C — Decisões Críticas para o Time Aprovar

### C.1 Decisões já tomadas (confirmadas com o cliente)

| Decisão | Escolha |
|---|---|
| Vector DB | pgvector no Postgres |
| Estratégia de plágio | Híbrida (in-house MVP + hook futuro para API paga) |
| Equipe | 2 devs plenos por domínio (Plataforma vs IA) |
| Frontend | Mantém Next.js |
| Backend principal | FastAPI |

### C.2 Decisões a tomar antes da Fase 1

| Decisão | Opções | Recomendação |
|---|---|---|
| Hosting FastAPI | Railway / Render / Fly.io | **Railway** (simplicidade + custo) |
| Provider de email | Resend / SendGrid | **Resend** (free tier 100/dia) |
| Domínio do FastAPI | `api.teseo.app` próprio / Vercel rewrite | **Subdomínio próprio** |
| Dono do schema | Prisma / Alembic | **Prisma continua dono** |
| Modelo de embedding | Gemini 768d / BGE-m3 1024d | **Gemini text-embedding-004** |
| Model AI principal | Gemini Flash / Claude / GPT-4o | **Gemini Flash** (mantém atual) com `AIProvider` abstração para A/B futuro |

### C.3 Decisões a tomar antes da Fase 2

| Decisão | Opções | Recomendação |
|---|---|---|
| Reranker (sem RAG retornar lixo) | Sem reranker / Cross-Encoder leve / Cohere Rerank API | **Sem reranker no MVP**; adicionar Cross-Encoder se feedback for ruim |
| Limite de PDFs por TCC | 5 / 20 / 50 / por plano | **Por plano:** FREE 5, PRO 20, VIP 50 (já existe limite hoje) |
| TTL de cache de embeddings | 7 dias / 30 dias / sem TTL | **30 dias** com invalidação manual |

### C.4 Decisões a tomar antes da Fase 3

| Decisão | Opções | Recomendação |
|---|---|---|
| Severidade do validador ABNT | Strict (bloqueia exportação) / Permissivo (só avisa) | **Permissivo no MVP**, strict opcional no UI |
| Autoflag de originalidade | Real-time (a cada save) / sob demanda (botão) | **Sob demanda no MVP** (custo de embeddings) |
| Limite de chamadas a Copyleaks no plano VIP | Ilimitado / N por dia / por documento | **Decidir junto com pricing do VIP futuro** |

---

## Observações Finais

- Este documento é a base contratual de execução para os 2 devs backend. Cada sprint tem critério de aceitação verificável.
- O roadmap respeita a regra "produto sempre funcional": em qualquer momento da Fase 1-3, usuários do beta continuam usando o Teseo normalmente.
- A Fase 0 é independente e pode (deve) ser executada pelo dev atual em paralelo à contratação dos 2 devs backend.
- Todas as referências a `arquivo:linha` foram verificadas no código. Se algo mudar antes da execução, atualizar este documento.
- O HTML executivo correspondente ([arquitetura_executiva.html](arquitetura_executiva.html)) resume tudo isto para apresentação a sócios.

---

*Teseo — Documento Técnico de Arquitetura · v1.0 · Abril 2026*
*Repositório: `tcc-assist-main` · Branch: `main` · Uso interno*
