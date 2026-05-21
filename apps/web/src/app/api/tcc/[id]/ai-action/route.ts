import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolvePlan } from '@/lib/plan'
import { buildActionPrompt } from '@/lib/agents/guardrails'
import { generateAIContent } from '@/lib/ai/provider'
import { getGeminiConfigForPlan } from '@/lib/gemini'
import { isAllowedAction, runAction } from '@/lib/ai-service'

type Params = { params: Promise<{ id: string }> }

function isFastApiActionsEnabled(): boolean {
  return process.env.USE_FASTAPI_ACTIONS === 'true'
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id: tccId } = await params

    // Verificar que o TCC pertence ao usuário autenticado
    const tcc = await prisma.tcc.findFirst({
      where: { id: tccId, userId: (session.user as { id?: string }).id! },
      select: { id: true }
    })
    if (!tcc) {
      return NextResponse.json({ error: 'TCC não encontrado.' }, { status: 404 })
    }

    const { action, text, context } = await req.json()
    const userPlan = resolvePlan((session.user as { plan?: string }).plan)

    // Free users can only Generate (via the main chat). This endpoint restricts Action tools.
    if (userPlan === 'FREE') {
      return NextResponse.json({ error: 'Ações de IA são exclusivas para planos PRO e VIP.' }, { status: 403 })
    }

    if (isFastApiActionsEnabled()) {
      if (!isAllowedAction(action)) {
        return NextResponse.json({ error: 'Funcionalidade exclusiva VIP ou ação desconhecida.' }, { status: 403 })
      }
      if (typeof text !== 'string' || text.length === 0) {
        return NextResponse.json({ error: 'Texto obrigatório.' }, { status: 400 })
      }
      try {
        const result = await runAction({
          userId: (session.user as { id: string }).id,
          plan: userPlan,
          tccId,
          action,
          text,
          context: typeof context === 'string' && context.length > 0 ? context : null,
        })
        return NextResponse.json({ success: true, result: result.result })
      } catch (error) {
        console.error('[api/ai-action] fastapi failure', {
          tccId,
          action,
          error: error instanceof Error ? error.message : String(error),
        })
        return mapFastApiActionError(error)
      }
    }

    // Build the guarded prompt
    let prompt = ''
    try {
      prompt = buildActionPrompt(action, userPlan, text, context)
    } catch {
      return NextResponse.json({ error: 'Funcionalidade exclusiva VIP ou ação desconhecida.' }, { status: 403 })
    }

    // Get plan-specific config for the AI call
    const geminiConfig = getGeminiConfigForPlan(userPlan)

    // Call unified AI provider with plan-specific config
    const result = await generateAIContent(prompt, 'gemini', { geminiConfig })

    // Regex to remove generic markdown code blocks like ```html ... ``` or just ``` ... ```
    const cleanResult = result.replace(/^```[a-z]*\s*|\s*```$/gi, '').trim()

    return NextResponse.json({ success: true, result: cleanResult })
  } catch (error) {
    console.error('AI Action API Error:', error)
    return NextResponse.json({ error: 'Erro no processamento da IA' }, { status: 500 })
  }
}

function mapFastApiActionError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error)
  if (message === 'free_plan_forbidden') {
    return NextResponse.json(
      { error: 'Ações de IA são exclusivas para planos PRO e VIP.' },
      { status: 403 }
    )
  }
  if (message === 'tcc_id_mismatch') {
    return NextResponse.json({ error: 'Recurso não autorizado' }, { status: 403 })
  }
  if (message === 'tcc_not_found') {
    return NextResponse.json({ error: 'TCC não encontrado' }, { status: 404 })
  }
  if (message === 'upstream_invalid_request') {
    return NextResponse.json({ error: 'Requisição inválida' }, { status: 422 })
  }
  if (message === 'ai_provider_unavailable' || message === 'ai_provider_bad_response') {
    return NextResponse.json({ error: 'IA temporariamente indisponível' }, { status: 503 })
  }
  if (message === 'upstream_auth_failure') {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
  return NextResponse.json({ error: 'Erro inesperado da IA' }, { status: 502 })
}
