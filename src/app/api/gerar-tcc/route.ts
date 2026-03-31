import { NextResponse } from 'next/server'
import { callGemini, callGeminiWithFiles } from '@/lib/gemini'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tema, pdfsBase64, capitulo = 'Introdução', contextoAnterior = '' } = body

    if (!tema) {
      return NextResponse.json(
        { error: 'Tema é obrigatório' },
        { status: 400 }
      )
    }

    const pdfParts = (pdfsBase64 && pdfsBase64.length > 0)
      ? (pdfsBase64 as string[]).map((pdf: string) => ({
          data: pdf.replace(/^data:application\/pdf;base64,/, ''),
          mimeType: 'application/pdf' as const
        }))
      : []

    const regrasCitacao = pdfParts.length > 0
      ? `- Você recebeu documentos PDF em anexo. Avalie se o conteúdo deles tem relação lógica com o tema "${tema}".
     - Se TIVER relação: Use-os como referência principal e faça citações diretas/indiretas.
     - Se NÃO TIVER relação clara: Ignore-os e use seu próprio conhecimento acadêmico para citar autores clássicos da área.`
      : `- Como não foram fornecidos documentos base, utilize seu vasto conhecimento acadêmico para embasar o texto.
     - Cite apenas autores reais, teorias reais e livros consolidados da área acadêmica do tema.`

    const prompt = `Você é um professor universitário rigoroso.
Tema do TCC: "${tema}".
Escreva APENAS o capítulo: "${capitulo}".

REGRAS ESTRITAS:
- Mantenha tom formal e impessoal (3ª pessoa). Formato Markdown.
${regrasCitacao}

CONTEXTO ANTERIOR (O que o aluno já escreveu):
"""
${contextoAnterior || 'Nenhum texto escrito ainda.'}
"""
Construa o novo capítulo como uma continuação natural e não repita o contexto.`

    const texto = pdfParts.length > 0
      ? await callGeminiWithFiles(pdfParts, prompt)
      : await callGemini(prompt)

    return NextResponse.json({ sucesso: true, capitulo, texto })
  } catch (error) {
    console.error('Erro ao gerar TCC:', error)
    return NextResponse.json({ error: 'Falha na geração pela IA' }, { status: 500 })
  }
}
