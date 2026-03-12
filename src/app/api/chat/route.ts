import { chatAgent } from '@/lib/gemini'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { agent, context, input } = await req.json()

    if (!process.env.GOOGLE_API_KEY) {
      return NextResponse.json({ error: 'API Key não configurada' }, { status: 500 })
    }

    const response = await chatAgent(agent, context, input)

    return NextResponse.json({
      content: response,
      agent,
      timestamp: new Date().toISOString()
    })
  } catch (error: unknown) {
    return NextResponse.json({
      error: 'Gemini API falhou',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
