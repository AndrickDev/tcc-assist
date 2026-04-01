import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callGemini, callGeminiWithFiles } from '@/lib/gemini'

export async function POST(request: Request) {
  try {
    const session = await auth()
    const userId = (session?.user as { id?: string } | undefined)?.id
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const {
      tema, pdfsBase64, capitulo = 'Introdução', contextoAnterior = '', tccId,
      tipoTrabalho, objetivo, norma, curso
    } = body

    // Verificar que o TCC pertence ao usuário autenticado (quando fornecido)
    if (tccId) {
      const tcc = await prisma.tcc.findFirst({ where: { id: tccId, userId }, select: { id: true } })
      if (!tcc) return NextResponse.json({ error: 'TCC não encontrado.' }, { status: 404 })
    }

    if (!tema) {
      return NextResponse.json({ error: 'Tema é obrigatório' }, { status: 400 })
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

    const bussolaAcademica = `
[BÚSSOLA ACADÊMICA - DIRETRIZES IMUTÁVEIS DO TRABALHO]
Tipo de Trabalho: ${tipoTrabalho || 'TCC / Monografia'}
Área / Curso: ${curso || 'Não informado'}
Norma: ${norma || 'ABNT'}
Tema Central: ${tema}
Objetivo Principal: ${objetivo || 'Não definido. Foque no tema central.'}

REGRA 1: Tudo o que você escrever DEVE estar alinhado para alcançar o Objetivo Principal e responder ao Tema Central acima. Nunca desvie desse escopo.`

    const prompt = `Você é um acadêmico rigoroso nível doutorado.
${bussolaAcademica}

[TAREFA ATUAL]
Escreva APENAS o seguinte capítulo/seção: "${capitulo}".

[REGRAS DE ESCRITA E CITAÇÃO]
- Tom formal, impessoal (3ª pessoa). Formato Markdown.
${regrasCitacao}

[CONTINUIDADE E COERÊNCIA]
O que já foi escrito no documento:
"""
${contextoAnterior || 'Nenhum texto escrito ainda.'}
"""
Construa a nova seção como continuação lógica. NÃO REPITA o que já foi dito acima.`

    const texto = pdfParts.length > 0
      ? await callGeminiWithFiles(pdfParts, prompt)
      : await callGemini(prompt)

    return NextResponse.json({ sucesso: true, capitulo, texto })
  } catch (error) {
    console.error('Erro ao gerar TCC:', error)
    return NextResponse.json({ error: 'Falha na geração pela IA' }, { status: 500 })
  }
}
