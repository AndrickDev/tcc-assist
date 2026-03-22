import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { resolvePlan } from '@/lib/plan'
import { buildActionPrompt } from '@/lib/agents/guardrails'
import { generateAIContent } from '@/lib/ai/provider'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { action, text, context, devPlanOverride } = await req.json()
    let userPlan = resolvePlan((session.user as { plan?: string }).plan)
    
    if (process.env.NODE_ENV === 'development' && devPlanOverride) {
      userPlan = devPlanOverride
    }

    // Free users can only Generate (via the main chat). This endpoint restricts Action tools.
    // Let's implement blocked paths.
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

    // Call unified AI provider (only gemini for Beta)
    const result = await generateAIContent(prompt, 'gemini')

    // Regex to remove generic markdown code blocks like ```html ... ``` or just ``` ... ```
    const cleanResult = result.replace(/^```[a-z]*\s*|\s*```$/gi, '').trim()

    return NextResponse.json({ success: true, result: cleanResult })
  } catch (error) {
    console.error('AI Action API Error:', error)
    return NextResponse.json({ error: 'Erro no processamento da IA' }, { status: 500 })
  }
}
