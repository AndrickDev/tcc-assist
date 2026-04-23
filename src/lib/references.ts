// Utilitários para trabalhar com referências selecionadas no prompt da IA.

import type { Reference } from "@prisma/client"

/**
 * Tenta extrair o sobrenome do primeiro autor no formato de citação ABNT (SOBRENOME, ANO).
 * Reference.authors chega em formatos como:
 *   - "Silva, J.; Costa, M."
 *   - "Maria Clara Silva; João Paulo Costa"
 *   - "SILVA, J."
 *
 * Regras:
 * 1. Pega até o primeiro ';' ou 'et al.'
 * 2. Se tem vírgula, assume "SOBRENOME, Iniciais" — pega antes da vírgula
 * 3. Se não tem vírgula, pega a última palavra (formato "Nome Sobrenome")
 * 4. Retorna em CAIXA ALTA
 */
export function firstAuthorSurname(authorsString: string): string {
  const first = authorsString.split(/;| et al\./i)[0]?.trim() ?? ""
  if (!first) return "AUTOR"

  if (first.includes(",")) {
    const surname = first.split(",")[0].trim()
    return surname.toUpperCase()
  }

  const parts = first.split(/\s+/)
  const surname = parts[parts.length - 1] ?? first
  return surname.toUpperCase()
}

/**
 * Gera a string pronta para ser usada em uma citação ABNT inline: (SOBRENOME, ANO).
 * Se não há ano, retorna apenas (SOBRENOME).
 */
export function abntInlineCitation(ref: Pick<Reference, "authors" | "year">): string {
  const surname = firstAuthorSurname(ref.authors)
  return ref.year ? `(${surname}, ${ref.year})` : `(${surname})`
}

/**
 * Monta a entrada de referência bibliográfica no padrão ABNT NBR 6023 simplificado.
 * Ex: "SILVA, J.; COSTA, M. Título do artigo. Revista Brasileira, 2023. DOI: 10.xxx."
 */
export function abntReferenceLine(ref: Pick<Reference, "authors" | "title" | "venue" | "year" | "doi" | "url">): string {
  const parts: string[] = []
  parts.push(ref.authors.toUpperCase().trim())
  parts.push(` ${ref.title.trim()}.`)
  if (ref.venue) parts.push(` ${ref.venue.trim()},`)
  if (ref.year) parts.push(` ${ref.year}.`)
  if (ref.doi) parts.push(` DOI: ${ref.doi}.`)
  else if (ref.url) parts.push(` Disponível em: ${ref.url}.`)
  return parts.join("").replace(/\s+/g, " ").trim()
}

/**
 * Monta o bloco de contexto de referências a ser injetado no prompt da IA geradora.
 * Retorna string vazia se não há referências selecionadas.
 *
 * Para não estourar o context window, limita a N referências (default 10) e
 * trunca o resumo de cada uma em 400 caracteres. Se houver mais refs selecionadas
 * que o limite, priorizamos as mais citadas (citationCount desc).
 */
export function buildReferencesContext(
  refs: Reference[],
  maxReferences: number = 10,
  maxAbstractChars: number = 400,
): string {
  if (refs.length === 0) return ""

  const top = [...refs]
    .sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0))
    .slice(0, maxReferences)

  const formatted = top.map((ref, i) => {
    const citation = abntInlineCitation(ref)
    const abstract = ref.abstract
      ? ref.abstract.length > maxAbstractChars
        ? `${ref.abstract.slice(0, maxAbstractChars)}...`
        : ref.abstract
      : "Sem resumo disponível."
    return `[${i + 1}] ${citation} — ${ref.title}
    Autores: ${ref.authors}
    ${ref.venue ? `Veículo: ${ref.venue}` : ""}
    Resumo: ${abstract}`
  }).join("\n\n")

  return `[REFERÊNCIAS SELECIONADAS PARA ESTE TCC — USO OBRIGATÓRIO]
Você DEVE usar EXCLUSIVAMENTE as ${top.length} referências abaixo. É PROIBIDO inventar autores, obras ou fontes fictícias.
Sempre que uma afirmação do texto puder se apoiar em uma delas, cite no formato ABNT autor-data: (SOBRENOME, ANO).
Não é obrigatório citar todas; use as que fizerem sentido no contexto do capítulo.
Se o tema do capítulo não combinar com NENHUMA das referências listadas, escreva sem citação em vez de inventar.

${formatted}`
}
