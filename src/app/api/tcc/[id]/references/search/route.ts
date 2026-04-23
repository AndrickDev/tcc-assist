import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { searchPapers, extractKeywords } from "@/lib/papers-search"

export const dynamic = "force-dynamic"

// POST /api/tcc/[id]/references/search
// Body: { query: string, yearFrom?: number, limit?: number }
// Busca na API do Semantic Scholar e persiste os resultados (sem marcar como selecionados).
// Retorna a lista atualizada de referências do TCC (selecionadas + busca nova).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { id } = await params

  const tcc = await prisma.tcc.findFirst({
    where: { id, userId },
    select: { id: true, title: true, objective: true },
  })
  if (!tcc) return NextResponse.json({ error: "TCC não encontrado." }, { status: 404 })

  let body: { query?: string; yearFrom?: number; limit?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 })
  }

  const query = (body.query ?? tcc.title ?? "").trim()
  if (query.length < 3) {
    return NextResponse.json({ error: "Query muito curta (mínimo 3 caracteres)." }, { status: 400 })
  }

  // Títulos de TCC costumam ser longos e específicos (ex: "Arquitetura Hexagonal e
  // DDD como fundamento de um sistema web para reencontro entre pets e tutores"),
  // o que faz o OpenAlex retornar zero resultados por exigir match de todas as palavras.
  // Estratégia: tenta a query original e, se vier pouco, re-tenta com palavras-chave.
  let papers: Awaited<ReturnType<typeof searchPapers>> = []
  let effectiveQuery = query
  const attempts: Array<{ query: string; count: number }> = []
  try {
    papers = await searchPapers({
      query,
      limit: body.limit ?? 20,
      yearFrom: body.yearFrom,
    })
    attempts.push({ query, count: papers.length })

    if (papers.length < 3) {
      const keywords = extractKeywords(query)
      if (keywords && keywords !== query) {
        const fallback = await searchPapers({
          query: keywords,
          limit: body.limit ?? 20,
          yearFrom: body.yearFrom,
        })
        attempts.push({ query: keywords, count: fallback.length })
        if (fallback.length > papers.length) {
          papers = fallback
          effectiveQuery = keywords
        }
      }
    }
    console.log("[references/search] tcc=%s attempts=%j final=%d", id, attempts, papers.length)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[references/search] provider error:", message)
    return NextResponse.json(
      {
        error: "Falha ao buscar referências. Tente novamente em instantes.",
        detail: message.slice(0, 500),
      },
      { status: 502 }
    )
  }

  // Se ambas as tentativas deram zero, devolve um erro amigável com contexto de debug.
  if (papers.length === 0) {
    return NextResponse.json({
      query,
      effectiveQuery,
      found: 0,
      attempts,
      references: await prisma.reference.findMany({
        where: { tccId: id },
        orderBy: [{ selected: "desc" }, { createdAt: "desc" }],
      }),
      info: "Nenhum artigo retornado pelo OpenAlex com essas palavras-chave. Tente simplificar o título do TCC.",
    })
  }

  // Persiste em batch. Upsert por (tccId, externalId) para não duplicar se já existir.
  // Mantém selected=false por padrão; se o usuário já tinha selecionado, preserva.
  for (const paper of papers) {
    await prisma.reference.upsert({
      where: { tccId_externalId: { tccId: id, externalId: paper.externalId } },
      create: {
        tccId: id,
        externalId: paper.externalId,
        source: "openalex",
        title: paper.title,
        authors: paper.authors,
        year: paper.year,
        abstract: paper.abstract,
        venue: paper.venue,
        url: paper.url,
        doi: paper.doi,
        citationCount: paper.citationCount,
        searchQuery: effectiveQuery,
      },
      update: {
        title: paper.title,
        authors: paper.authors,
        year: paper.year,
        abstract: paper.abstract,
        venue: paper.venue,
        url: paper.url,
        doi: paper.doi,
        citationCount: paper.citationCount,
        searchQuery: effectiveQuery,
      },
    })
  }

  const references = await prisma.reference.findMany({
    where: { tccId: id },
    orderBy: [{ selected: "desc" }, { createdAt: "desc" }],
  })

  return NextResponse.json({
    query,
    effectiveQuery,
    found: papers.length,
    references,
  })
}
