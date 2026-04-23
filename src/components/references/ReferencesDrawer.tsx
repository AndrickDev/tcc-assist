"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  X, Loader2, RefreshCw, Star, Check, ChevronDown, ChevronUp,
  ExternalLink, BookOpen, Sparkles, GitCompare, Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ReferencesCompareModal } from "./ReferencesCompareModal"

export type ReferenceItem = {
  id: string
  title: string
  authors: string
  year: number | null
  abstract: string | null
  venue: string | null
  url: string | null
  doi: string | null
  citationCount: number | null
  selected: boolean
  favorited: boolean
  searchQuery: string | null
  createdAt: string
}

type Filter = "all" | "selected" | "favorited"

type Props = {
  tccId: string
  tccTitle: string
  open: boolean
  onClose: () => void
  onSelectedCountChange?: (count: number) => void
}

export function ReferencesDrawer({ tccId, tccTitle, open, onClose, onSelectedCountChange }: Props) {
  const [loading, setLoading] = React.useState(false)
  const [searching, setSearching] = React.useState(false)
  const [refs, setRefs] = React.useState<ReferenceItem[]>([])
  const [filter, setFilter] = React.useState<Filter>("all")
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [compareOpen, setCompareOpen] = React.useState(false)
  const [compareIds, setCompareIds] = React.useState<string[]>([])

  // Fetch existing references when drawer opens (first time)
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/tcc/${tccId}/references`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setRefs(data.references ?? [])
      })
      .catch(() => { if (!cancelled) setError("Não foi possível carregar suas referências.") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, tccId])

  // Notify parent about selected count
  React.useEffect(() => {
    const count = refs.filter((r) => r.selected).length
    onSelectedCountChange?.(count)
  }, [refs, onSelectedCountChange])

  // Close on ESC
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  // Busca fixada no título do TCC. Também limpa resultados antigos não selecionados
  // para evitar confusão quando o usuário renomeia o TCC ou testa em projetos diferentes.
  const runSearch = async () => {
    const finalQuery = tccTitle.trim()
    if (finalQuery.length < 3) {
      setError("O título do TCC está muito curto para buscar referências.")
      return
    }
    setSearching(true)
    setError(null)
    try {
      // Limpa resultados anteriores não selecionados (mantém os que o aluno já marcou)
      await fetch(`/api/tcc/${tccId}/references`, { method: "DELETE" }).catch(() => null)

      const res = await fetch(`/api/tcc/${tccId}/references/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: finalQuery }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Falha na busca."); return }
      setRefs(data.references ?? [])
    } catch {
      setError("Erro ao conectar com o servidor.")
    } finally { setSearching(false) }
  }

  const togglePatch = async (refId: string, patch: { selected?: boolean; favorited?: boolean }) => {
    // Optimistic update
    setRefs((prev) => prev.map((r) => r.id === refId ? { ...r, ...patch } : r))
    try {
      const res = await fetch(`/api/tcc/${tccId}/references/${refId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error("patch failed")
    } catch {
      // Rollback
      setRefs((prev) => prev.map((r) => r.id === refId
        ? { ...r, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, !v])) }
        : r))
    }
  }

  const visible = React.useMemo(() => {
    if (filter === "selected") return refs.filter((r) => r.selected)
    if (filter === "favorited") return refs.filter((r) => r.favorited)
    return refs
  }, [refs, filter])

  const counts = React.useMemo(() => ({
    total: refs.length,
    selected: refs.filter((r) => r.selected).length,
    favorited: refs.filter((r) => r.favorited).length,
  }), [refs])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={onClose}
          />
          {/* Drawer */}
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[480px] bg-[var(--brand-surface)] border-l border-[var(--brand-border)] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <header className="px-5 py-4 border-b border-[var(--brand-border)] flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/20 flex items-center justify-center shrink-0">
                  <BookOpen size={14} className="text-[var(--brand-accent)]/80" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-[var(--brand-text)] font-serif truncate">Referências</h2>
                  <p className="text-[10px] text-[var(--brand-muted)]/60 tabular-nums">
                    {counts.total} encontradas · {counts.selected} em uso · {counts.favorited} favoritas
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[var(--brand-muted)]/60 hover:text-[var(--brand-text)] hover:bg-[var(--brand-hover)] transition-colors shrink-0"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </header>

            {/* Search — sempre baseada no título do TCC */}
            <div className="px-5 pt-4 pb-3 border-b border-[var(--brand-border)] space-y-3">
              <button
                type="button"
                onClick={() => runSearch()}
                disabled={searching || !tccTitle.trim()}
                title={tccTitle ? `Busca referências sobre "${tccTitle.slice(0, 60)}${tccTitle.length > 60 ? "..." : ""}"` : "Título do TCC vazio"}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--brand-hover)] hover:bg-[var(--brand-accent)]/10 border border-[var(--brand-border)] hover:border-[var(--brand-accent)]/30 rounded-xl text-[12px] font-bold text-[var(--brand-text)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {searching
                  ? <><Loader2 size={13} className="animate-spin" /> Buscando...</>
                  : <><RefreshCw size={13} /> {refs.length > 0 ? "Atualizar referências" : "Buscar referências"}</>}
              </button>
              {tccTitle && (
                <p className="text-[10px] text-[var(--brand-muted)]/60 px-1 leading-snug">
                  <span className="font-semibold text-[var(--brand-muted)]/80">Tema:</span> {tccTitle.slice(0, 120)}{tccTitle.length > 120 ? "..." : ""}
                </p>
              )}

              {/* Filter chips */}
              <div className="flex items-center gap-1.5 text-[11px]">
                {([
                  { key: "all", label: `Todas`, count: counts.total },
                  { key: "selected", label: `Em uso`, count: counts.selected },
                  { key: "favorited", label: `Favoritas`, count: counts.favorited },
                ] as const).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={cn(
                      "px-2.5 py-1 rounded-full border transition-colors font-medium",
                      filter === f.key
                        ? "bg-[var(--brand-accent)]/10 border-[var(--brand-accent)]/30 text-[var(--brand-accent)]"
                        : "border-[var(--brand-border)] text-[var(--brand-muted)]/70 hover:text-[var(--brand-text)] hover:border-[var(--brand-border)]"
                    )}
                  >
                    {f.label} <span className="tabular-nums opacity-60">{f.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={18} className="animate-spin text-[var(--brand-muted)]" />
                </div>
              ) : error ? (
                <div className="p-5 text-center text-[12px] text-red-400">{error}</div>
              ) : visible.length === 0 ? (
                <EmptyState
                  filter={filter}
                  hasAny={counts.total > 0}
                  onSearch={() => runSearch()}
                  searching={searching}
                  tccTitle={tccTitle}
                />
              ) : (
                <ul className="divide-y divide-[var(--brand-border)]">
                  {visible.map((r) => (
                    <ReferenceCard
                      key={r.id}
                      item={r}
                      expanded={expandedId === r.id}
                      onExpand={() => setExpandedId((prev) => prev === r.id ? null : r.id)}
                      onToggleSelected={(v) => togglePatch(r.id, { selected: v })}
                      onToggleFavorited={(v) => togglePatch(r.id, { favorited: v })}
                    />
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            <footer className="px-5 py-3 border-t border-[var(--brand-border)] bg-[var(--brand-surface)] flex items-center justify-between gap-3">
              <div className="text-[11px] text-[var(--brand-muted)]/70 min-w-0">
                {counts.selected > 0
                  ? <><span className="text-[var(--brand-accent)] font-semibold">{counts.selected}</span> prontas pra gerar</>
                  : <>Selecione pelo menos 3 para fortalecer o texto</>}
              </div>
              <button
                disabled={counts.favorited < 2}
                onClick={() => {
                  const favoriteIds = refs.filter((r) => r.favorited).slice(0, 5).map((r) => r.id)
                  if (favoriteIds.length < 2) return
                  setCompareIds(favoriteIds)
                  setCompareOpen(true)
                }}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-[var(--brand-hover)] border border-[var(--brand-border)] text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-border)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title={counts.favorited < 2 ? "Favorite 2 ou mais para comparar" : "Comparar até 5 favoritas"}
              >
                <GitCompare size={12} /> Comparar{counts.favorited >= 2 ? ` (${Math.min(counts.favorited, 5)})` : ""}
              </button>
            </footer>
          </motion.aside>

          <ReferencesCompareModal
            tccId={tccId}
            open={compareOpen}
            refIds={compareIds}
            onClose={() => setCompareOpen(false)}
            onSelectReference={async (refId) => {
              await togglePatch(refId, { selected: true })
              setCompareOpen(false)
            }}
          />
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Reference Card ───────────────────────────────────────────────────────────

function ReferenceCard({
  item, expanded, onExpand, onToggleSelected, onToggleFavorited,
}: {
  item: ReferenceItem
  expanded: boolean
  onExpand: () => void
  onToggleSelected: (v: boolean) => void
  onToggleFavorited: (v: boolean) => void
}) {
  const doiUrl = item.doi ? `https://doi.org/${item.doi}` : null
  const externalUrl = item.url ?? doiUrl

  return (
    <li className={cn(
      "group px-5 py-4 transition-colors",
      item.selected ? "bg-[var(--brand-accent)]/[0.04]" : "hover:bg-[var(--brand-hover)]/50"
    )}>
      <div className="flex items-start gap-3">
        {/* Left: content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start gap-2">
            {item.favorited && (
              <Star size={11} className="text-[var(--brand-accent)] fill-[var(--brand-accent)] shrink-0 mt-1" />
            )}
            <h3 className="text-[13px] font-semibold text-[var(--brand-text)] leading-snug font-serif line-clamp-2">
              {item.title}
            </h3>
          </div>

          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-[var(--brand-muted)]/70">
            <span className="truncate max-w-[220px]">{item.authors}</span>
            {item.year && <span>· {item.year}</span>}
            {typeof item.citationCount === "number" && item.citationCount > 0 && (
              <span className="tabular-nums">· {item.citationCount} cit.</span>
            )}
          </div>

          {item.venue && (
            <p className="text-[10px] text-[var(--brand-muted)]/50 truncate italic">{item.venue}</p>
          )}

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="pt-2 space-y-2">
                  {item.abstract ? (
                    <p className="text-[12px] text-[var(--brand-muted)]/80 leading-relaxed">{item.abstract}</p>
                  ) : (
                    <p className="text-[11px] italic text-[var(--brand-muted)]/50">Resumo não disponível.</p>
                  )}
                  {externalUrl && (
                    <a href={externalUrl} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand-accent)]/80 hover:text-[var(--brand-accent)]">
                      Abrir artigo <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3 pt-1.5">
            <button onClick={onExpand}
              className="inline-flex items-center gap-1 text-[11px] text-[var(--brand-muted)]/60 hover:text-[var(--brand-text)] transition-colors">
              {expanded ? <>Fechar <ChevronUp size={11} /></> : <>Ler resumo <ChevronDown size={11} /></>}
            </button>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            onClick={() => onToggleSelected(!item.selected)}
            className={cn(
              "w-7 h-7 rounded-lg border flex items-center justify-center transition-all",
              item.selected
                ? "bg-[var(--brand-accent)] border-[var(--brand-accent)] text-white"
                : "bg-transparent border-[var(--brand-border)] text-[var(--brand-muted)]/50 hover:border-[var(--brand-accent)]/40 hover:text-[var(--brand-accent)]"
            )}
            title={item.selected ? "Remover da seleção" : "Usar esta referência"}
          >
            <Check size={13} />
          </button>
          <button
            onClick={() => onToggleFavorited(!item.favorited)}
            className={cn(
              "w-7 h-7 rounded-lg border flex items-center justify-center transition-all",
              item.favorited
                ? "bg-[var(--brand-accent)]/10 border-[var(--brand-accent)]/40 text-[var(--brand-accent)]"
                : "bg-transparent border-[var(--brand-border)] text-[var(--brand-muted)]/50 hover:border-[var(--brand-accent)]/40 hover:text-[var(--brand-accent)]/80"
            )}
            title={item.favorited ? "Desfavoritar" : "Favoritar (para comparar)"}
          >
            <Star size={13} className={item.favorited ? "fill-[var(--brand-accent)]" : ""} />
          </button>
        </div>
      </div>
    </li>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  filter, hasAny, onSearch, searching, tccTitle,
}: {
  filter: Filter
  hasAny: boolean
  onSearch: () => void
  searching: boolean
  tccTitle: string
}) {
  if (filter === "selected" && hasAny) {
    return (
      <div className="py-20 px-6 text-center">
        <p className="text-[12px] text-[var(--brand-muted)]/70">
          Nenhuma referência selecionada ainda. Marque com <Check size={11} className="inline" /> as que você quer que a IA use no texto.
        </p>
      </div>
    )
  }
  if (filter === "favorited" && hasAny) {
    return (
      <div className="py-20 px-6 text-center">
        <p className="text-[12px] text-[var(--brand-muted)]/70">
          Nenhuma favorita ainda. Use a <Star size={11} className="inline" /> para comparar referências depois.
        </p>
      </div>
    )
  }
  return (
    <div className="py-16 px-6 text-center max-w-xs mx-auto">
      <div className="w-12 h-12 rounded-xl bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/20 flex items-center justify-center mx-auto mb-4">
        <Sparkles size={16} className="text-[var(--brand-accent)]/80" />
      </div>
      <h3 className="text-sm font-bold text-[var(--brand-text)] font-serif mb-2">
        Encontre referências reais
      </h3>
      <p className="text-[12px] text-[var(--brand-muted)]/70 leading-relaxed mb-5">
        Seu TCC fica mais forte — e passa mais fácil em detectores — quando a IA escreve com base em artigos reais. Vamos começar buscando sobre seu tema.
      </p>
      <button
        onClick={onSearch}
        disabled={searching || !tccTitle}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--brand-accent)] hover:opacity-90 text-white text-[12px] font-bold rounded-lg transition-opacity disabled:opacity-50"
      >
        {searching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
        Buscar agora
      </button>
    </div>
  )
}
