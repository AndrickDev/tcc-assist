import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// GET /api/tcc/[id] — fetch single TCC metadata
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id } = await params

  const tcc = await prisma.tcc.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      title: true,
      course: true,
      institution: true,
      workType: true,
      norma: true,
      deadline: true,
      objective: true,
      content: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!tcc) {
    return NextResponse.json({ error: "TCC não encontrado." }, { status: 404 })
  }

  return NextResponse.json(tcc)
}

// DELETE /api/tcc/[id] — delete TCC and all related data (cascade)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id } = await params

  const tcc = await prisma.tcc.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })

  if (!tcc) {
    return NextResponse.json({ error: "TCC não encontrado." }, { status: 404 })
  }

  await prisma.tcc.delete({ where: { id } })

  return new NextResponse(null, { status: 204 })
}

// PUT /api/tcc/[id] — update TCC content/metadata
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json().catch(() => null)

  if (!body) return NextResponse.json({ error: "No body" }, { status: 400 })

  const tcc = await prisma.tcc.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })

  if (!tcc) {
    return NextResponse.json({ error: "TCC não encontrado." }, { status: 404 })
  }

  const updated = await prisma.tcc.update({
    where: { id },
    data: {
      content: body.content !== undefined ? body.content : undefined,
    },
  })

  return NextResponse.json({ success: true, id: updated.id })
}
