import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolvePlan } from '@/lib/plan'
import { buildActionPrompt } from '@/lib/agents/guardrails'
import { generateAIContent } from '@/lib/ai/provider'
import { getGeminiConfigForPlan } from '@/lib/gemini'

type Params = { params: Promise<{ id: string }> }

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

    const { action, text, context, devPlanOverride } = await req.json()
    let userPlan = resolvePlan((session.user as { plan?: string }).plan)
    
    if (process.env.NODE_ENV === 'development' && devPlanOverride) {
      userPlan = devPlanOverride
    }

    // Free users can only Generate (via the main chat). This endpoint restricts Action tools.
    if (userPlan === 'FREE') {
      return NextResponse.json({ error: 'Ações de IA são exclusivas para planos PRO e VIP.' }, { status: 403 })
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
