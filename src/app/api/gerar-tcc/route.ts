import { NextResponse } from 'next/server'
import { callGeminiWithFiles } from '@/lib/gemini'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tema, pdfsBase64 } = body

    if (!tema || !pdfsBase64 || pdfsBase64.length === 0) {
      return NextResponse.json(
        { error: 'Tema e PDFs são obrigatórios' },
        { status: 400 }
      )
    }

    const pdfParts = (pdfsBase64 as string[]).map(pdf => ({
      data: pdf.replace(/^data:application\/pdf;base64,/, ''),
      mimeType: 'application/pdf'
    }))

    const prompt = `Você é um professor universitário rigoroso. Escreva o primeiro capítulo (1. Introdução) de um TCC com o tema "${tema}". Use os PDFs anexados como referência. Estruture com: Contextualização, Problema de Pesquisa e Justificativa. Mantenha tom formal, objetivo, em 3ª pessoa (impessoal). Formato Markdown.`

    const texto = await callGeminiWithFiles(pdfParts, prompt)

    return NextResponse.json({ sucesso: true, capitulo: '1. Introdução', texto })
  } catch (error) {
    console.error('Erro ao gerar TCC:', error)
    return NextResponse.json({ error: 'Falha na geração pela IA' }, { status: 500 })
  }
}
