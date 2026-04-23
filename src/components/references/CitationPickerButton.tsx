"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Quote, Loader2, BookOpen, Check } from "lucide-react"
import { cn } from "@/lib/utils"

type SelectedRef = {
  id: string
  title: string
  authors: string
  year: number | null
  venue: string | null
  citationCount: number | null
}

type Props = {
  tccId: string
  // Callback que recebe o texto a ser inserido no cursor do editor
  // (ex: " (SILVA, 2023)"). O workspace conecta isso ao Tiptap.
  onInsertCitation: (text: string) => void
}

// Extrai o sobrenome do primeiro autor em CAIXA ALTA, para (SOBRENOME, ANO).
// Lógica igual à de src/lib/references.ts (firstAuthorSurname), mas duplicada
// aqui para manter o componente client-side sem depender do server-only helper.
function firstAuthorSurname(authorsString: string): string {
  const first = authorsString.split(/;| et al\./i)[0]?.trim() ?? ""
  if (!first) return "AUTOR"
  if (first.includes(",")) return first.split(",")[0].trim().toUpperCase()
  const parts = first.split(/\s+/)
  return (parts[parts.length - 1] ?? first).toUpperCase()
}

function abntInline(ref: Pick<SelectedRef, "authors" | "year">): string {
  const surname = firstAuthorSurname(ref.authors)
  return ref.year ? `(${surname}, ${ref.year})` : `(${surname})`
}

export function CitationPickerButton({ tccId, onInsertCitation }: Props) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [refs, setRefs] = React.useState<SelectedRef[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const loadRefs = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/tcc/${tccId}/references`, { cache: "no-store" })
      const json = await res.json()
      const all: SelectedRef[] = json.references ?? []
      setRefs(all.filter((r: { id: string; selected?: boolean }) => (r as unknown as { selected: boolean }).selected))
    } catch {
      setError("Não foi possível carregar referências.")
    } finally {
      setLoading(false)
    }
  }, [tccId])

  // Carrega quando abre (e quando reabre, pra pegar atualizações recentes)
  React.useEffect(() => {
    if (open) void loadRefs()
  }, [open, loadRefs])

  // Click fora fecha
  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener("mousedown", handler)
    return () => window.removeEventListener("mousedown", handler)
  }, [open])

  const handlePick = (ref: SelectedRef) => {
    onInsertCitation(` ${abntInline(ref)} `)
    setOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Inserir citação de uma referência selecionada"
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1.5 rounded text-[11px] font-semibold transition-colors",
          open
            ? "bg-[var(--brand-accent)]/15 text-[var(--brand-accent)]"
            : "text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-hover)]"
        )}
      >
        <Quote size={13} />
        Citação
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute top-full mt-1.5 right-0 z-50 w-[360px] max-h-[360px] bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl shadow-2xl overflow-hidden flex flex-col"
          >
            <header className="px-3 py-2 border-b border-[var(--brand-border)] flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-muted)]/70">Referências em uso</span>
              {refs.length > 0 && (
                <span className="text-[10px] text-[var(--brand-muted)]/60 tabular-nums">{refs.length}</span>
              )}
            </header>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="py-8 flex items-center justify-center text-[var(--brand-muted)]">
                  <Loader2 size={14} className="animate-spin" />
                </div>
              ) : error ? (
                <p className="px-3 py-5 text-[11px] text-red-400">{error}</p>
              ) : refs.length === 0 ? (
                <div className="px-3 py-6 text-center space-y-1.5">
                  <BookOpen size={16} className="text-[var(--brand-muted)]/50 mx-auto" />
                  <p className="text-[11px] text-[var(--brand-muted)]/70 leading-relaxed">
                    Nenhuma referência selecionada ainda. Abra o drawer de Referências e marque <Check size={10} className="inline" /> nas que quer usar.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-[var(--brand-border)]">
                  {refs.map((ref) => {
                    const citation = abntInline(ref)
                    return (
                      <li key={ref.id}>
                        <button
                          type="button"
                          onClick={() => handlePick(ref)}
                          className="w-full text-left px-3 py-2.5 hover:bg-[var(--brand-hover)] transition-colors group"
                        >
                          <div className="flex items-baseline justify-between gap-2 mb-0.5">
                            <span className="text-[11px] font-bold text-[var(--brand-accent)] tabular-nums">{citation}</span>
                            <span className="text-[10px] text-[var(--brand-muted)]/50 opacity-0 group-hover:opacity-100 transition-opacity">Inserir</span>
                          </div>
                          <p className="text-[12px] text-[var(--brand-text)] font-serif leading-snug line-clamp-2">{ref.title}</p>
                          {(ref.venue || ref.year) && (
                            <p className="text-[10px] text-[var(--brand-muted)]/60 truncate mt-0.5 italic">
                              {ref.venue ?? ""}{ref.venue && ref.year ? " · " : ""}{ref.year ?? ""}
                            </p>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
