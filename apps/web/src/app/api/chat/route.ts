import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { runTccWorkflow } from '@/lib/agents/aiox-integration'
import { resolvePlan } from '@/lib/plan'
import { QuotaExceededError, runChat } from '@/lib/ai-service'
import { useFastApiAi as isFastApiAiEnabled } from '@/lib/feature-flags'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { tccId, message } = await req.json()

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

    const userPlan = resolvePlan((session.user as { plan?: string }).plan)

    if (isFastApiAiEnabled()) {
      console.info('[api/chat] using fastapi', { tccId, plan: userPlan })
      try {
        const chatResult = await runChat({
          userId: session.user.id,
          plan: userPlan,
          tccId,
          message,
        })
        const savedMessage = await prisma.message.create({
          data: {
            tccId,
            role: 'bot',
            content: chatResult.content,
            agent: chatResult.agentId,
          },
        })

        return NextResponse.json({
          id: savedMessage.id,
          content: chatResult.content,
          agent: chatResult.agentId,
          timestamp: savedMessage.createdAt,
        })
      } catch (error) {
        console.error('[api/chat] fastapi failure', {
          tccId,
          error: error instanceof Error ? error.message : String(error),
        })
        return mapFastApiError(error)
      }
    }

    const result = await runTccWorkflow(
      session.user.id, 
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

function mapFastApiError(error: unknown): NextResponse {
  if (error instanceof QuotaExceededError) {
    return NextResponse.json(
      {
        error: 'Limite diário atingido',
        remaining: error.remaining,
        resetAt: error.resetAt,
      },
      { status: 429 }
    )
  }

  const message = error instanceof Error ? error.message : String(error)
  if (message === 'tcc_id_mismatch') {
    return NextResponse.json({ error: 'Recurso não autorizado' }, { status: 403 })
  }
  if (message === 'tcc_not_found') {
    return NextResponse.json({ error: 'TCC não encontrado' }, { status: 404 })
  }
  if (message === 'ai_provider_unavailable' || message === 'ai_provider_bad_response') {
    return NextResponse.json({ error: 'IA temporariamente indisponível' }, { status: 503 })
  }
  if (message === 'quota_unavailable') {
    return NextResponse.json({ error: 'Serviço temporariamente indisponível' }, { status: 503 })
  }
  if (message === 'upstream_auth_failure') {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
  return NextResponse.json({ error: 'Erro inesperado da IA' }, { status: 502 })
}
