import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callGemini, callGeminiWithFiles } from '@/lib/gemini'
import { buildReferencesContext } from '@/lib/references'

export async function POST(request: Request) {
  try {
    const session = await auth()
    const userId = (session?.user as { id?: string } | undefined)?.id
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const {
      tccId, capitulo = 'Introdução', contextoAnterior = '',
      tipoTrabalho, objetivo, norma, curso, tema
    } = body

    if (!tccId || !tema) {
      return NextResponse.json({ error: 'tccId e tema são obrigatórios' }, { status: 400 })
    }

    // Verificar que o TCC pertence ao usuário autenticado
    const tcc = await prisma.tcc.findFirst({ where: { id: tccId, userId }, select: { id: true } })
    if (!tcc) return NextResponse.json({ error: 'TCC não encontrado.' }, { status: 404 })

    // Buscar referências selecionadas pelo aluno (maior prioridade de embasamento)
    const selectedRefs = await prisma.reference.findMany({
      where: { tccId, selected: true },
      orderBy: [{ citationCount: 'desc' }, { createdAt: 'desc' }],
    })

    // Buscar attachments persistidos no banco
    const attachments = await prisma.attachment.findMany({
      where: { tccId, mimeType: 'application/pdf' },
      select: { fileUrl: true },
    })

    // Baixar cada PDF do Vercel Blob e converter para base64
    const pdfParts = await Promise.all(
      attachments.map(async (a) => {
        const res = await fetch(a.fileUrl, {
          headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
        })
        if (!res.ok) throw new Error(`Falha ao baixar anexo: ${res.status}`)
        const base64 = Buffer.from(await res.arrayBuffer()).toString('base64')
        return { data: base64, mimeType: 'application/pdf' as const }
      })
    )

    const referencesContext = buildReferencesContext(selectedRefs)

    // Estratégia de citação em ordem de prioridade:
    //   1. Se o aluno selecionou referências (OpenAlex) — usa EXCLUSIVAMENTE essas
    //   2. Senão, se tem PDFs anexados — usa como base, com fallback pro conhecimento geral
    //   3. Senão — só conhecimento geral da IA, com aviso forte contra alucinação
    const regrasCitacao = selectedRefs.length > 0
      ? `- Use EXCLUSIVAMENTE as referências listadas no bloco [REFERÊNCIAS SELECIONADAS].
     - Cite no formato ABNT autor-data: (SOBRENOME, ANO).
     - É PROIBIDO inventar autores ou obras. Se nenhuma referência combinar, escreva sem citação.`
      : pdfParts.length > 0
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
${referencesContext ? `\n${referencesContext}\n` : ''}
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

    return NextResponse.json({
      sucesso: true,
      capitulo,
      texto,
      referenciasUsadas: selectedRefs.length,
    })
  } catch (error) {
    console.error('Erro ao gerar TCC:', error)
    return NextResponse.json({ error: 'Falha na geração pela IA' }, { status: 500 })
  }
}
