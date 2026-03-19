import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { runTccWorkflow } from '@/lib/agents/aiox-integration'
import { resolvePlan } from '@/lib/plan'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { tccId, message } = await req.json()

    if (!tccId || !message) {
      return NextResponse.json({ error: 'Dados insuficientes (tccId e message são obrigatórios)' }, { status: 400 })
    }

    const userPlan = resolvePlan((session.user as { plan?: string }).plan)

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
