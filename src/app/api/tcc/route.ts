import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// GET /api/tcc — list user's TCCs
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const tccs = await prisma.tcc.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      course: true,
      institution: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  })

  return NextResponse.json(tccs)
}

// POST /api/tcc — create a new TCC
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { title, course, institution } = await req.json()

  if (!title || !course || !institution) {
    return NextResponse.json({ error: "Campos obrigatórios: title, course, institution." }, { status: 400 })
  }

  const tcc = await prisma.tcc.create({
    data: {
      userId: session.user.id,
      title,
      course,
      institution,
    },
  })

  return NextResponse.json(tcc, { status: 201 })
}
