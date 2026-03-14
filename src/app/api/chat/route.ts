import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { runTccWorkflow } from '@/lib/agents/aiox-integration'

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

    // O plano do usuário deve vir do banco/sessão (definido no schema Prisma como Role/Plan)
    // Se não estiver na sessão, assumimos FREE por segurança.
    const userPlan = (session.user as any).plan || 'FREE'

    const result = await runTccWorkflow(
      session.user.id!, 
      tccId, 
      message, 
      userPlan
    )

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Chat API Error:', error)
    return NextResponse.json({
      error: 'Erro no processamento da IA',
      details: error.message
    }, { status: 500 })
  }
}
