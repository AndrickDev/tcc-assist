import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

// GET /api/tcc/[id]/messages — list messages for a TCC
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id: tccId } = await params

  // Verify the TCC belongs to the current user
  const tcc = await prisma.tcc.findFirst({
    where: { id: tccId, userId: session.user.id },
  })
  if (!tcc) {
    return NextResponse.json({ error: "TCC não encontrado." }, { status: 404 })
  }

  const messages = await prisma.message.findMany({
    where: { tccId },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(messages)
}

// POST /api/tcc/[id]/messages — save a message to a TCC
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id: tccId } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 })

  const { role, content, agent } = body

  // Only allow clients to create 'user' messages.
  // 'bot' messages are created exclusively by server-side workflow (aiox-integration).
  if (role !== "user") {
    return NextResponse.json({ error: "Somente mensagens de usuário podem ser criadas por esta rota." }, { status: 403 })
  }

  if (typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ error: "Conteúdo da mensagem é obrigatório." }, { status: 400 })
  }

  if (content.length > 20000) {
    return NextResponse.json({ error: "Mensagem excede o limite de 20.000 caracteres." }, { status: 400 })
  }

  // Verify the TCC belongs to the current user
  const tcc = await prisma.tcc.findFirst({
    where: { id: tccId, userId: session.user.id },
  })
  if (!tcc) {
    return NextResponse.json({ error: "TCC não encontrado." }, { status: 404 })
  }

  const message = await prisma.message.create({
    data: { tccId, role: "user", content: content.trim(), agent: agent ?? null },
  })

  // Update TCC updatedAt timestamp
  await prisma.tcc.update({
    where: { id: tccId },
    data: { updatedAt: new Date() },
  })

  return NextResponse.json(message, { status: 201 })
}
