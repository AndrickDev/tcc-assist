import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

async function authorize(tccId: string) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) }

  const tcc = await prisma.tcc.findFirst({ where: { id: tccId, userId }, select: { id: true } })
  if (!tcc) return { error: NextResponse.json({ error: "TCC não encontrado." }, { status: 404 }) }

  return { userId }
}

// PATCH /api/tcc/[id]/references/[refId]
// Body: { selected?: boolean; favorited?: boolean }
// Atualiza o estado da referência. Pelo menos um dos dois campos deve vir.
// "selected": vai ser usada pela IA ao gerar texto.
// "favorited": marcada pra comparar/lembrar, não necessariamente usada.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; refId: string }> }
) {
  const { id, refId } = await params
  const guard = await authorize(id)
  if (guard.error) return guard.error

  let body: { selected?: boolean; favorited?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 })
  }

  const hasSelected = typeof body.selected === "boolean"
  const hasFavorited = typeof body.favorited === "boolean"
  if (!hasSelected && !hasFavorited) {
    return NextResponse.json(
      { error: "Informe 'selected' e/ou 'favorited' (boolean)." },
      { status: 400 }
    )
  }

  const existing = await prisma.reference.findFirst({ where: { id: refId, tccId: id } })
  if (!existing) return NextResponse.json({ error: "Referência não encontrada." }, { status: 404 })

  const data: {
    selected?: boolean
    selectedAt?: Date | null
    favorited?: boolean
    favoritedAt?: Date | null
  } = {}
  if (hasSelected) {
    data.selected = body.selected!
    data.selectedAt = body.selected ? new Date() : null
  }
  if (hasFavorited) {
    data.favorited = body.favorited!
    data.favoritedAt = body.favorited ? new Date() : null
  }

  const updated = await prisma.reference.update({ where: { id: refId }, data })
  return NextResponse.json({ reference: updated })
}

// DELETE /api/tcc/[id]/references/[refId]
// Remove uma referência específica (selecionada ou não).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; refId: string }> }
) {
  const { id, refId } = await params
  const guard = await authorize(id)
  if (guard.error) return guard.error

  const existing = await prisma.reference.findFirst({ where: { id: refId, tccId: id } })
  if (!existing) return NextResponse.json({ error: "Referência não encontrada." }, { status: 404 })

  await prisma.reference.delete({ where: { id: refId } })
  return NextResponse.json({ ok: true })
}
