"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, Loader2, Check, Sparkles, ExternalLink, GitCompare } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReferenceItem } from "./ReferencesDrawer"

type Props = {
  tccId: string
  open: boolean
  refIds: string[]
  onClose: () => void
  // Chamado ao clicar "Usar esta" num card. O drawer que invocou é
  // responsável por marcar selected=true e atualizar a própria lista.
  onSelectReference: (refId: string) => Promise<void> | void
}

type ComparePayload = {
  summaryMarkdown: string
  references: Array<Pick<ReferenceItem, "id" | "title" | "authors" | "year" | "venue" | "citationCount" | "url" | "doi" | "selected"> & { abstract: string | null }>
}

// Mini-parser de markdown bem controlado: só ** ** (bold), quebras de linha e
// citações (SOBRENOME, ANO) — suficiente pro que o prompt instrui a Gemini a produzir.
function renderCompareMarkdown(md: string): string {
  return md
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-[var(--brand-accent)] font-semibold">$1</strong>')
    .split(/\n{2,}/)
    .map((block) => `<p class="mb-2 last:mb-0">${block.split("\n").map((l) => l.trim()).filter(Boolean).join("<br/>")}</p>`)
    .join("")
}

export function ReferencesCompareModal({ tccId, open, refIds, onClose, onSelectReference }: Props) {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<ComparePayload | null>(null)
  const [selectingId, setSelectingId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    if (refIds.length < 2) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)
    fetch(`/api/tcc/${tccId}/references/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refIds }),
    })
      .then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error ?? "Falha ao comparar.")
        return json as ComparePayload
      })
      .then((payload) => { if (!cancelled) setData(payload) })
      .catch((err) => { if (!cancelled) setError(err.message ?? "Erro desconhecido.") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, tccId, refIds])

  // Close on ESC
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  const handlePick = async (refId: string) => {
    setSelectingId(refId)
    try {
      await onSelectReference(refId)
    } finally {
      setSelectingId(null)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-2xl bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
              {/* Header */}
              <header className="px-6 py-4 border-b border-[var(--brand-border)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/20 flex items-center justify-center">
                    <GitCompare size={15} className="text-[var(--brand-accent)]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold font-serif text-[var(--brand-text)]">Comparar referências</h2>
                    <p className="text-[11px] text-[var(--brand-muted)]/60">Diferenças entre {refIds.length} artigos favoritados, destacadas em <span className="text-[var(--brand-accent)] font-semibold">negrito</span></p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-[var(--brand-muted)]/60 hover:text-[var(--brand-text)] hover:bg-[var(--brand-hover)] transition-colors"
                  aria-label="Fechar"
                >
                  <X size={16} />
                </button>
              </header>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {loading && (
                  <div className="py-12 flex flex-col items-center gap-3 text-[var(--brand-muted)]">
                    <Sparkles size={18} className="text-[var(--brand-accent)] animate-pulse" />
                    <p className="text-[12px]">O orientador está comparando as referências...</p>
                  </div>
                )}

                {error && (
                  <div className="py-8 text-center text-[12px] text-red-400">
                    {error}
                  </div>
                )}

                {data && (
                  <>
                    {/* Summary */}
                    <section className="bg-[var(--brand-hover)] border border-[var(--brand-border)] rounded-xl p-4 text-[13px] text-[var(--brand-text)] leading-relaxed font-serif">
                      <div
                        dangerouslySetInnerHTML={{ __html: renderCompareMarkdown(data.summaryMarkdown) }}
                      />
                    </section>

                    {/* Cards */}
                    <section className="space-y-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-muted)]/60">Referências comparadas</p>
                      {data.references.map((ref) => {
                        const isSelected = ref.selected
                        const picking = selectingId === ref.id
                        const externalUrl = ref.url ?? (ref.doi ? `https://doi.org/${ref.doi}` : null)
                        return (
                          <div
                            key={ref.id}
                            className={cn(
                              "rounded-xl border p-3.5 space-y-2 transition-all",
                              isSelected
                                ? "bg-[var(--brand-accent)]/[0.04] border-[var(--brand-accent)]/30"
                                : "bg-[var(--brand-bg)] border-[var(--brand-border)]"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 space-y-0.5">
                                <h3 className="text-[13px] font-semibold text-[var(--brand-text)] font-serif leading-snug line-clamp-2">{ref.title}</h3>
                                <p className="text-[11px] text-[var(--brand-muted)]/70 truncate">
                                  {ref.authors}{ref.year ? ` · ${ref.year}` : ""}{typeof ref.citationCount === "number" && ref.citationCount > 0 ? ` · ${ref.citationCount} cit.` : ""}
                                </p>
                                {ref.venue && (
                                  <p className="text-[10px] text-[var(--brand-muted)]/50 truncate italic">{ref.venue}</p>
                                )}
                              </div>
                              <div className="shrink-0 flex flex-col items-end gap-1.5">
                                <button
                                  disabled={picking || isSelected}
                                  onClick={() => handlePick(ref.id)}
                                  className={cn(
                                    "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                                    isSelected
                                      ? "bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] cursor-default"
                                      : "bg-[var(--brand-accent)] text-white hover:opacity-90"
                                  )}
                                >
                                  {picking
                                    ? <Loader2 size={11} className="animate-spin" />
                                    : isSelected ? <><Check size={11} /> Em uso</> : <><Check size={11} /> Usar esta</>
                                  }
                                </button>
                                {externalUrl && (
                                  <a href={externalUrl} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-0.5 text-[10px] text-[var(--brand-muted)]/60 hover:text-[var(--brand-accent)]">
                                    Abrir <ExternalLink size={9} />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </section>
                  </>
                )}
              </div>

              {/* Footer */}
              <footer className="px-6 py-3 border-t border-[var(--brand-border)] text-[11px] text-[var(--brand-muted)]/60 flex items-center justify-between">
                <span>ESC pra fechar</span>
                <button
                  onClick={onClose}
                  className="text-[var(--brand-muted)] hover:text-[var(--brand-text)] font-medium"
                >
                  Fechar
                </button>
              </footer>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
