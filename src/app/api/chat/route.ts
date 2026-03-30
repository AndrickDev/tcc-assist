import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { runTccWorkflow } from '@/lib/agents/aiox-integration'
import { resolvePlan } from '@/lib/plan'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { tccId, message, devPlanOverride } = await req.json()

    if (!tccId || !message) {
      return NextResponse.json({ error: 'Dados insuficientes (tccId e message são obrigatórios)' }, { status: 400 })
    }

    // Verificar que o TCC pertence ao usuário autenticado
    const tcc = await prisma.tcc.findFirst({
      where: { id: tccId, userId: session.user.id! },
      select: { id: true }
    })
    if (!tcc) {
      return NextResponse.json({ error: 'TCC não encontrado.' }, { status: 404 })
    }

    let userPlan = resolvePlan((session.user as { plan?: string }).plan)
    if (process.env.NODE_ENV === 'development' && devPlanOverride) {
      userPlan = devPlanOverride
    }

    const result = await runTccWorkflow(
      session.user.id!, 
      tccId, 
      message, 
      userPlan
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Chat API Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({
      error: 'Erro no processamento da IA',
      details: message
    }, { status: 500 })
  }
}
