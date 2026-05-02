import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { callGemini } from "@/lib/gemini"
import { abntInlineCitation } from "@/lib/references"

export const dynamic = "force-dynamic"

// POST /api/tcc/[id]/references/compare
// Body: { refIds: string[] }  (mínimo 2, máximo 5)
//
// Para o aluno decidir qual referência faz mais sentido no contexto do TCC,
// este endpoint gera um resumo comparativo estruturado via Gemini, destacando
// em **negrito markdown** o que EFETIVAMENTE difere entre as referências:
// foco, metodologia, amostra, conclusão, ano, relevância.
//
// Retorno: { summaryMarkdown: string, references: Reference[] }
//   - summaryMarkdown: texto já com ** ** aplicado nas diferenças
//   - references: versão abreviada das refs comparadas (pro front poder listar)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { id: tccId } = await params

  const tcc = await prisma.tcc.findFirst({
    where: { id: tccId, userId },
    select: { id: true, title: true, objective: true },
  })
  if (!tcc) return NextResponse.json({ error: "TCC não encontrado." }, { status: 404 })

  let body: { refIds?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 })
  }

  const refIds = Array.isArray(body.refIds) ? body.refIds.filter((x): x is string => typeof x === "string") : []
  if (refIds.length < 2) {
    return NextResponse.json({ error: "Selecione pelo menos 2 referências para comparar." }, { status: 400 })
  }
  if (refIds.length > 5) {
    return NextResponse.json({ error: "Limite de 5 referências por comparação." }, { status: 400 })
  }

  // Só aceita ids que pertencem a este TCC — segurança e prevenção de erro
  const references = await prisma.reference.findMany({
    where: { id: { in: refIds }, tccId },
    orderBy: { createdAt: "asc" },
  })

  if (references.length < 2) {
    return NextResponse.json(
      { error: "Nenhuma referência válida encontrada para este TCC." },
      { status: 400 }
    )
  }

  const listing = references.map((ref, i) => {
    const citation = abntInlineCitation(ref)
    const abstract = ref.abstract
      ? ref.abstract.length > 800
        ? `${ref.abstract.slice(0, 800)}...`
        : ref.abstract
      : "Resumo não disponível."
    return `[REF ${String.fromCharCode(65 + i)}] ${citation}
Título: ${ref.title}
Autores: ${ref.authors}
Ano: ${ref.year ?? "não informado"}
Veículo: ${ref.venue ?? "não informado"}
Citações recebidas: ${ref.citationCount ?? "não informado"}
Resumo: ${abstract}`
  }).join("\n\n")

  const prompt = `Você é um orientador acadêmico auxiliando um aluno de graduação a decidir qual referência é melhor para o TCC dele.

CONTEXTO DO TCC:
- Tema: "${tcc.title}"
- Objetivo: "${tcc.objective ?? "não definido"}"

REFERÊNCIAS A COMPARAR:

${listing}

TAREFA:
Escreva um resumo comparativo curto e objetivo (300-500 palavras, formato markdown) que ajude o aluno a escolher qual(is) referência(s) faz(em) mais sentido para o contexto do TCC.

REGRAS DE FORMATAÇÃO — CRÍTICAS:
- Use \`**palavra**\` (markdown negrito) APENAS em palavras/trechos que marquem uma DIFERENÇA relevante entre as referências (ex: metodologia distinta, amostra diferente, foco específico, ano mais recente, conclusão oposta).
- NÃO coloque em negrito informação comum entre todas. Negrito é marcador de DIFERENÇA, não de destaque.
- Use a forma (SOBRENOME, ANO) ao citar cada referência — as citações já vêm prontas no bloco acima.
- Estruture em 2 a 4 parágrafos curtos ou uma pequena lista.
- No final, inclua UMA linha de recomendação começando com "Sugestão:" dizendo qual(is) combina(m) mais com o tema/objetivo do TCC e por quê.

PROIBIDO:
- Inventar dados que não estão nas referências fornecidas.
- Copiar literalmente o resumo de uma referência.
- Usar cabeçalhos markdown (#, ##).
- Bullets (-, *) exceto em no máximo uma pequena lista.`

  let summaryMarkdown: string
  try {
    summaryMarkdown = await callGemini(prompt)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[references/compare] Gemini error:", message)
    return NextResponse.json(
      { error: "Falha ao gerar comparação.", detail: message.slice(0, 300) },
      { status: 502 }
    )
  }

  return NextResponse.json({
    summaryMarkdown: summaryMarkdown.trim(),
    references: references.map((r) => ({
      id: r.id,
      title: r.title,
      authors: r.authors,
      year: r.year,
      venue: r.venue,
      citationCount: r.citationCount,
      abstract: r.abstract,
      url: r.url,
      doi: r.doi,
      selected: r.selected,
      favorited: r.favorited,
    })),
  })
}
