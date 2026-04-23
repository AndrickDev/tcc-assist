import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { searchPapers } from "@/lib/semantic-scholar"

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

  let papers
  try {
    papers = await searchPapers({
      query,
      limit: body.limit ?? 20,
      yearFrom: body.yearFrom,
    })
  } catch (err) {
    console.error("[references/search] Semantic Scholar error:", err)
    return NextResponse.json(
      { error: "Falha ao buscar referências. Tente novamente em instantes." },
      { status: 502 }
    )
  }

  // Persiste em batch. Upsert por (tccId, externalId) para não duplicar se já existir.
  // Mantém selected=false por padrão; se o usuário já tinha selecionado, preserva.
  for (const paper of papers) {
    await prisma.reference.upsert({
      where: { tccId_externalId: { tccId: id, externalId: paper.externalId } },
      create: {
        tccId: id,
        externalId: paper.externalId,
        source: "semantic-scholar",
        title: paper.title,
        authors: paper.authors,
        year: paper.year,
        abstract: paper.abstract,
        venue: paper.venue,
        url: paper.url,
        doi: paper.doi,
        citationCount: paper.citationCount,
        searchQuery: query,
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
        searchQuery: query,
      },
    })
  }

  const references = await prisma.reference.findMany({
    where: { tccId: id },
    orderBy: [{ selected: "desc" }, { createdAt: "desc" }],
  })

  return NextResponse.json({ query, found: papers.length, references })
}
