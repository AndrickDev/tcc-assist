// Cliente da API pública do Semantic Scholar.
// Docs: https://api.semanticscholar.org/api-docs/graph
// Tier gratuito: 100 req/5min por IP, sem key necessária.
// Se SEMANTIC_SCHOLAR_API_KEY estiver no env, é enviada no header para aumentar o rate limit.

const BASE_URL = "https://api.semanticscholar.org/graph/v1"
const SEARCH_FIELDS = "paperId,title,authors,year,abstract,venue,url,externalIds,citationCount"

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

type RawAuthor = { name?: string | null }
type RawPaper = {
  paperId?: string
  title?: string | null
  authors?: RawAuthor[] | null
  year?: number | null
  abstract?: string | null
  venue?: string | null
  url?: string | null
  externalIds?: { DOI?: string | null } | null
  citationCount?: number | null
}
type RawSearchResponse = { data?: RawPaper[] | null; total?: number | null }

function formatAuthors(authors: RawAuthor[] | null | undefined): string {
  if (!authors || authors.length === 0) return "Autor não identificado"
  const names = authors
    .map((a) => a?.name?.trim())
    .filter((n): n is string => Boolean(n))
  if (names.length === 0) return "Autor não identificado"
  if (names.length <= 3) return names.join("; ")
  return `${names.slice(0, 3).join("; ")}; et al.`
}

function normalize(raw: RawPaper): ScholarPaper | null {
  if (!raw.paperId || !raw.title) return null
  return {
    externalId: raw.paperId,
    title: raw.title,
    authors: formatAuthors(raw.authors),
    year: typeof raw.year === "number" ? raw.year : null,
    abstract: raw.abstract ?? null,
    venue: raw.venue && raw.venue.trim().length > 0 ? raw.venue : null,
    url: raw.url ?? null,
    doi: raw.externalIds?.DOI ?? null,
    citationCount: typeof raw.citationCount === "number" ? raw.citationCount : null,
  }
}

export type SearchOptions = {
  query: string
  limit?: number
  yearFrom?: number
}

export async function searchPapers(opts: SearchOptions): Promise<ScholarPaper[]> {
  const query = opts.query.trim()
  if (!query) return []

  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100)
  const params = new URLSearchParams({ query, limit: String(limit), fields: SEARCH_FIELDS })
  if (opts.yearFrom) params.set("year", `${opts.yearFrom}-`)

  const headers: Record<string, string> = { "User-Agent": "Teseo/1.0 (beta)" }
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY
  if (apiKey) headers["x-api-key"] = apiKey

  const res = await fetch(`${BASE_URL}/paper/search?${params.toString()}`, {
    headers,
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Semantic Scholar ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = (await res.json()) as RawSearchResponse
  const papers = (data.data ?? [])
    .map(normalize)
    .filter((p): p is ScholarPaper => p !== null)

  return papers
}
