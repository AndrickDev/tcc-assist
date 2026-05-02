"use client"

import * as React from "react"
import { FileText, Loader2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

type SelectedRef = {
  id: string
  title: string
  authors: string
  year: number | null
  venue: string | null
  url: string | null
  doi: string | null
  selected: boolean
}

type Props = {
  tccId: string
  // Recebe o HTML bruto da seção pronta (com <h2>REFERÊNCIAS</h2> + <p>s)
  // e devolve o HTML atualizado do documento. O workspace é quem chama
  // editor.commands.setContent(next) para aplicar.
  onInsertSection: (sectionHtml: string) => void
}

// Gera a linha de cada referência no padrão ABNT NBR 6023 simplificado.
// Ex: "SILVA, J.; COSTA, M. Título do artigo. Revista Brasileira, 2023. DOI: 10.xxx."
function buildAbntLine(ref: SelectedRef): string {
  const parts: string[] = []
  parts.push(ref.authors.toUpperCase().trim())
  parts.push(` ${ref.title.trim()}.`)
  if (ref.venue) parts.push(` <em>${ref.venue.trim()}</em>,`)
  if (ref.year) parts.push(` ${ref.year}.`)
  if (ref.doi) parts.push(` DOI: ${ref.doi}.`)
  else if (ref.url) parts.push(` Disponível em: ${ref.url}.`)
  return parts.join("").replace(/\s+/g, " ").trim()
}

// Monta o HTML da seção inteira com um marcador invisível (data-teseo-refs)
// que permite ao workspace detectar e substituir em vez de duplicar a seção.
function buildSectionHtml(refs: SelectedRef[]): string {
  if (refs.length === 0) {
    return `<h2 data-teseo-refs="true">REFERÊNCIAS</h2><p data-teseo-refs="true"><em>Nenhuma referência selecionada ainda.</em></p>`
  }
  const lines = refs
    .slice()
    .sort((a, b) => a.authors.localeCompare(b.authors, "pt-BR"))
    .map((ref) => `<p data-teseo-refs="true">${buildAbntLine(ref)}</p>`)
    .join("")
  return `<h2 data-teseo-refs="true">REFERÊNCIAS</h2>${lines}`
}

export function GenerateReferencesButton({ tccId, onInsertSection }: Props) {
  const [loading, setLoading] = React.useState(false)
  const [lastCount, setLastCount] = React.useState<number | null>(null)
  const [showSuccess, setShowSuccess] = React.useState(false)

  const handleClick = async () => {
    setLoading(true)
    setShowSuccess(false)
    try {
      const res = await fetch(`/api/tcc/${tccId}/references`, { cache: "no-store" })
      const data = await res.json()
      const all: SelectedRef[] = data.references ?? []
      const selected = all.filter((r) => r.selected)

      const html = buildSectionHtml(selected)
      onInsertSection(html)
      setLastCount(selected.length)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2500)
    } catch {
      // silencioso — o botão volta ao estado normal e usuário pode tentar de novo
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title="Insere/atualiza a seção REFERÊNCIAS no final do documento com todas as referências selecionadas, formatadas em ABNT"
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1.5 rounded text-[11px] font-semibold transition-colors",
        showSuccess
          ? "text-emerald-500 bg-emerald-500/10"
          : "text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-hover)]"
      )}
    >
      {loading
        ? <Loader2 size={13} className="animate-spin" />
        : showSuccess
          ? <CheckCircle2 size={13} />
          : <FileText size={13} />}
      {showSuccess
        ? (lastCount === 0 ? "Sem refs" : `${lastCount} inseridas`)
        : "Gerar refs"}
    </button>
  )
}
