import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolvePlan, getTccSlotLimit } from "@/lib/plan"

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
      workType: true,
      norma: true,
      deadline: true,
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

  const { title, course, institution, workType, norma, deadline, objective } = await req.json()

  if (!title || !course || !institution) {
    return NextResponse.json({ error: "Campos obrigatórios: title, course, institution." }, { status: 400 })
  }

  // Enforce TCC slot limits per plan (FREE & PRO: 1, VIP: 2)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  })
  const effectivePlan = resolvePlan(user?.plan)
  const slotLimit = getTccSlotLimit(effectivePlan)
  const tccCount = await prisma.tcc.count({ where: { userId: session.user.id } })
  if (tccCount >= slotLimit) {
    return NextResponse.json(
      {
        error: `Limite de projetos atingido para o plano ${effectivePlan}. Faça upgrade para criar mais.`,
        limitReached: true,
        plan: effectivePlan,
      },
      { status: 403 }
    )
  }

  const tcc = await prisma.tcc.create({
    data: {
      userId: session.user.id,
      title,
      course,
      institution,
      workType: workType || null,
      norma: norma || null,
      deadline: deadline ? new Date(deadline) : null,
      objective: objective || null,
    },
  })

  return NextResponse.json(tcc, { status: 201 })
}
