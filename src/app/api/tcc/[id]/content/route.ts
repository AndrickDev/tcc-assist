import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

// PUT /api/tcc/[id]/content - update a bot message's content (owner-only)
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { id: tccId } = await params

  const tcc = await prisma.tcc.findFirst({
    where: { id: tccId, userId },
    select: { id: true },
  })
  if (!tcc) return NextResponse.json({ error: "TCC não encontrado" }, { status: 404 })

  const body = await req.json().catch(() => null)
  const messageId = body?.messageId as string | undefined
  const content = body?.content as string | undefined
  if (!messageId || typeof content !== "string") {
    return NextResponse.json({ error: "Campos obrigatórios: messageId, content." }, { status: 400 })
  }

  const message = await prisma.message.findFirst({
    where: { id: messageId, tccId },
    select: { id: true, role: true },
  })
  if (!message) return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 })
  if (message.role !== "bot") {
    return NextResponse.json({ error: "Somente mensagens do bot são editáveis." }, { status: 400 })
  }

  await prisma.$transaction([
    prisma.message.update({
      where: { id: messageId },
      data: { content },
    }),
    prisma.tcc.update({
      where: { id: tccId },
      data: { updatedAt: new Date() },
    }),
  ])

  return NextResponse.json({ success: true })
}
