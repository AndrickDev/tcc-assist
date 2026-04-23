import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// GET /api/tcc/[id]/references — lista todas as referências buscadas e selecionadas para o TCC.
// Ordena por: selecionadas primeiro, depois mais recentes.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { id } = await params

  const tcc = await prisma.tcc.findFirst({ where: { id, userId }, select: { id: true } })
  if (!tcc) return NextResponse.json({ error: "TCC não encontrado." }, { status: 404 })

  const references = await prisma.reference.findMany({
    where: { tccId: id },
    orderBy: [{ selected: "desc" }, { createdAt: "desc" }],
  })

  return NextResponse.json({ references })
}

// DELETE /api/tcc/[id]/references — remove todas as referências não selecionadas (limpa busca).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { id } = await params

  const tcc = await prisma.tcc.findFirst({ where: { id, userId }, select: { id: true } })
  if (!tcc) return NextResponse.json({ error: "TCC não encontrado." }, { status: 404 })

  const result = await prisma.reference.deleteMany({ where: { tccId: id, selected: false } })
  return NextResponse.json({ removed: result.count })
}
