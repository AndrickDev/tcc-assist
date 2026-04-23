// Cliente da API pública do OpenAlex (https://docs.openalex.org/).
// Tier público gratuito: 10 req/s, 100.000 req/dia por IP. Sem key necessária.
// Recomendação da própria OpenAlex: passar `mailto=` para entrar no "polite pool" (maior prioridade).
//
// Por que OpenAlex e não Semantic Scholar: a API pública do Semantic Scholar compartilha
// rate limit global entre todos os IPs sem chave, e retorna 429 em praticamente qualquer
// chamada em produção. OpenAlex tem rate limit por IP e devolve dados mais ricos de artigos
// brasileiros em português, que é o público-alvo do Teseo.

const BASE_URL = "https://api.openalex.org/works"
const SELECT = "id,title,authorships,publication_year,abstract_inverted_index,doi,primary_location,cited_by_count,language"
const POLITE_POOL_MAILTO = process.env.OPENALEX_MAILTO ?? "contato@teseo.app"

export type ScholarPaper = {
  externalId: string
  title: string
  authors: string
  year: number | null
  abstract: string | null
  venue: string | null
  url: string | null
  doi: string | null
  citationCount: number | null
}

type RawAuthorship = {
  author?: { display_name?: string | null } | null
  raw_author_name?: string | null
}

type RawLocation = {
  landing_page_url?: string | null
  pdf_url?: string | null
  source?: { display_name?: string | null } | null
}

type RawWork = {
  id?: string | null
  title?: string | null
  authorships?: RawAuthorship[] | null
  publication_year?: number | null
  abstract_inverted_index?: Record<string, number[]> | null
  doi?: string | null
  primary_location?: RawLocation | null
  cited_by_count?: number | null
  language?: string | null
}

type RawSearchResponse = {
  results?: RawWork[] | null
  meta?: { count?: number | null } | null
}

// OpenAlex entrega abstracts em formato invertido para fins de compliance com editoras:
// { "palavra": [posicoes] }. Precisamos reconstruir o texto na ordem original.
function decodeAbstract(inverted: Record<string, number[]> | null | undefined): string | null {
  if (!inverted) return null
  const positions: Array<{ pos: number; word: string }> = []
  for (const [word, indexes] of Object.entries(inverted)) {
    for (const i of indexes) positions.push({ pos: i, word })
  }
  if (positions.length === 0) return null
  positions.sort((a, b) => a.pos - b.pos)
  return positions.map((p) => p.word).join(" ")
}

function formatAuthors(authorships: RawAuthorship[] | null | undefined): string {
  if (!authorships || authorships.length === 0) return "Autor não identificado"
  const names = authorships
    .map((a) => (a.author?.display_name ?? a.raw_author_name ?? "").trim())
    .filter((n) => n.length > 0)
  if (names.length === 0) return "Autor não identificado"

  // Formato ABNT: "SOBRENOME, Prenome" — simplificamos para "display_name"
  // e depois podemos enriquecer. Limitamos a 3 autores + "et al." para manter enxuto.
  if (names.length <= 3) return names.join("; ")
  return `${names.slice(0, 3).join("; ")}; et al.`
}

function cleanDoi(doi: string | null | undefined): string | null {
  if (!doi) return null
  // OpenAlex devolve o DOI completo como "https://doi.org/10.xxx". Removemos o prefixo
  // para armazenar só o identificador canônico.
  return doi.replace(/^https?:\/\/doi\.org\//i, "")
}

function extractExternalId(openAlexId: string | null | undefined): string | null {
  if (!openAlexId) return null
  // id vem como "https://openalex.org/W1234567890" — salvamos só o "W..." para ficar curto.
  const m = openAlexId.match(/\/(W\d+)$/)
  return m ? m[1] : openAlexId
}

function normalize(raw: RawWork): ScholarPaper | null {
  const externalId = extractExternalId(raw.id)
  if (!externalId || !raw.title) return null

  return {
    externalId,
    title: raw.title,
    authors: formatAuthors(raw.authorships),
    year: typeof raw.publication_year === "number" ? raw.publication_year : null,
    abstract: decodeAbstract(raw.abstract_inverted_index),
    venue: raw.primary_location?.source?.display_name ?? null,
    url:
      raw.primary_location?.pdf_url ??
      raw.primary_location?.landing_page_url ??
      (raw.doi ? raw.doi : null),
    doi: cleanDoi(raw.doi),
    citationCount:
      typeof raw.cited_by_count === "number" ? raw.cited_by_count : null,
  }
}

export type SearchOptions = {
  query: string
  limit?: number
  yearFrom?: number
  // Idiomas aceitos no formato ISO 639-1 (pt, en, es...). Default: pt + en.
  // Alunos brasileiros de TCC raramente citam espanhol, então o default exclui.
  languages?: string[]
}

// Stopwords PT/EN + termos genéricos de TCC que não ajudam na busca.
// Quando o aluno escreve um título longo tipo "Arquitetura Hexagonal e Domain-Driven
// Design como fundamento de um sistema web para reencontro entre pets e tutores",
// o OpenAlex busca por TODAS as palavras juntas e retorna 0 resultados. Extraindo
// apenas os termos técnicos principais, conseguimos dezenas a milhares de hits.
const STOPWORDS = new Set([
  // PT - artigos, preposições, conjunções
  "a", "o", "as", "os", "um", "uma", "uns", "umas",
  "de", "do", "da", "dos", "das", "ao", "aos", "no", "na", "nos", "nas",
  "em", "com", "por", "para", "entre", "sobre", "sob", "ate", "desde",
  "e", "ou", "mas", "que", "se", "como", "porque", "pois", "porem",
  "qual", "quais", "quando", "onde",
  // PT - verbos e genéricos
  "ser", "estar", "ter", "haver", "fazer", "e", "sao", "foi", "era",
  // PT - termos comuns em TCC que raramente são keywords úteis sozinhos
  "proposta", "estudo", "analise", "pesquisa", "uso", "utilizacao",
  "aplicacao", "abordagem", "caso", "base", "forma", "modo",
  "fundamento", "fundamentos", "processo", "processos",
  // EN
  "the", "of", "to", "for", "and", "or", "in", "on", "at", "by", "as",
  "is", "are", "was", "were", "be", "been", "an", "a",
  "with", "from", "this", "that", "these", "those",
])

/**
 * Extrai até `maxWords` palavras-chave de um título/frase removendo stopwords,
 * acentos e pontuação. Usado como query fallback quando a busca literal
 * no OpenAlex retorna poucos ou zero resultados.
 */
export function extractKeywords(title: string, maxWords: number = 8): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .slice(0, maxWords)
    .join(" ")
}

export async function searchPapers(opts: SearchOptions): Promise<ScholarPaper[]> {
  const query = opts.query.trim()
  if (!query) return []

  const perPage = Math.min(Math.max(opts.limit ?? 20, 1), 50)
  const languages = opts.languages && opts.languages.length > 0 ? opts.languages : ["pt", "en"]

  const params = new URLSearchParams({
    "per-page": String(perPage),
    select: SELECT,
    mailto: POLITE_POOL_MAILTO,
  })

  // OpenAlex combina filtros via vírgula; dentro de um filtro o pipe é OR.
  // Usamos title_and_abstract.search para evitar que palavras comuns (ex: sistema) 
  // deem match no texto completo de artigos irrelevantes.
  const filters: string[] = [`title_and_abstract.search:${query}`, `language:${languages.join("|")}`]
  if (opts.yearFrom) filters.push(`from_publication_date:${opts.yearFrom}-01-01`)
  params.set("filter", filters.join(","))

  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: { "User-Agent": `Teseo/1.0 (+${POLITE_POOL_MAILTO})` },
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`OpenAlex ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = (await res.json()) as RawSearchResponse
  return (data.results ?? [])
    .map(normalize)
    .filter((p): p is ScholarPaper => p !== null)
}
