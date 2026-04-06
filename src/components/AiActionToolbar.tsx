import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Edit3, BookOpen, Quote, ChevronRight, Loader2, Crown } from "lucide-react"
import { trackEvent } from "@/lib/analytics"

interface AiActionToolbarProps {
  userPlan: string
  content: string
  onApplyAction: (action: string, result: string) => void
  onUpgrade: () => void
  context?: string
  tccId: string
}

export function AiActionToolbar({ userPlan, content, onApplyAction, onUpgrade, context, tccId }: AiActionToolbarProps) {
  const [loadingAction, setLoadingAction] = React.useState<string | null>(null)
  const [nextStep, setNextStep] = React.useState<string | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)

  const handleAction = async (action: string) => {
    trackEvent('AI_ACTION_CLICK', { action, plan: userPlan, tccId })

    if (userPlan === 'FREE') {
      trackEvent('AI_ACTION_BLOCK_PLAN', { action, required: 'PRO_OR_VIP', current: 'FREE' })
      onUpgrade()
      return
    }
    const isVipAction = ['abnt', 'citacoes', 'proximopasso'].includes(action)
    if (isVipAction && userPlan !== 'VIP') {
      trackEvent('AI_ACTION_BLOCK_PLAN', { action, required: 'VIP', current: userPlan })
      onUpgrade()
      return
    }

    setLoadingAction(action)
    setActionError(null)
    setNextStep(null)
    const startTime = Date.now()
    try {
      const res = await fetch(`/api/tcc/${tccId}/ai-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text: content, context })
      })
      const data = await res.json()
      const duration = Date.now() - startTime

      if (data.error) {
        setActionError(data.error)
        trackEvent('AI_ACTION_ERROR', { action, error: data.error, durationMs: duration })
      } else if (action === 'proximopasso') {
        setNextStep(data.result)
        trackEvent('AI_ACTION_SUCCESS', { action, durationMs: duration })
        trackEvent('AI_PANEL_TOGGLE_NEXT_STEP', { state: 'open' })
      } else {
        onApplyAction(action, data.result)
        trackEvent('AI_ACTION_SUCCESS', { action, durationMs: duration })
      }
    } catch (e) {
      console.error(e)
      setActionError("Erro ao processar. Tente novamente.")
      trackEvent('AI_ACTION_ERROR', { action, error: 'Network/Unknown', durationMs: Date.now() - startTime })
    } finally {
      setLoadingAction(null)
    }
  }

  // Compact button styling — theme-aware
  const btnBase =
    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium whitespace-nowrap shrink-0 disabled:opacity-40 transition-colors"
  const btnSubtle =
    `${btnBase} bg-[var(--brand-surface)] hover:bg-[var(--brand-hover)] border-[var(--brand-border)] text-[var(--brand-text)]/70 hover:text-[var(--brand-text)]`
  const btnVip =
    `${btnBase} bg-[var(--brand-hover)] hover:bg-[var(--brand-border)] border-[var(--brand-border)] text-[var(--brand-muted)] hover:text-[var(--brand-text)]`

  return (
    <div className="flex flex-col gap-1.5 relative">
      <div className="flex items-center gap-1 overflow-x-auto custom-scroll">
        {/* Label */}
        <div className="flex items-center gap-1 px-1.5 text-[10px] font-bold tracking-widest text-[var(--brand-muted)]/60 uppercase shrink-0">
          <Sparkles size={11} />
          Ações
        </div>

        {/* Revisar — PRO + VIP */}
        <button
          onClick={() => handleAction('revisar')}
          disabled={loadingAction !== null}
          className={btnSubtle}
        >
          {loadingAction === 'revisar'
            ? <Loader2 size={12} className="animate-spin" />
            : <Edit3 size={12} className="text-[var(--brand-muted)]" />}
          {userPlan === 'VIP' ? 'Revisão Crítica' : 'Revisar'}
        </button>

        {/* ABNT — VIP only */}
        <button
          onClick={() => handleAction('abnt')}
          disabled={loadingAction !== null}
          className={btnVip}
        >
          {loadingAction === 'abnt'
            ? <Loader2 size={12} className="animate-spin" />
            : <BookOpen size={12} />}
          ABNT
          {userPlan !== 'VIP' && <Crown size={9} className="opacity-50" />}
        </button>

        {/* Citações — VIP only */}
        <button
          onClick={() => handleAction('citacoes')}
          disabled={loadingAction !== null}
          className={btnVip}
        >
          {loadingAction === 'citacoes'
            ? <Loader2 size={12} className="animate-spin" />
            : <Quote size={12} />}
          Citações
          {userPlan !== 'VIP' && <Crown size={9} className="opacity-50" />}
        </button>

        <div className="w-px h-4 bg-[var(--brand-border)] mx-0.5 shrink-0" />

        {/* Próximo Passo — VIP only, now subtle */}
        <button
          onClick={() => handleAction('proximopasso')}
          disabled={loadingAction !== null}
          className={btnVip}
        >
          {loadingAction === 'proximopasso'
            ? <Loader2 size={12} className="animate-spin" />
            : <ChevronRight size={12} />}
          Próx. Passo
          {userPlan !== 'VIP' && <Crown size={9} className="opacity-50" />}
        </button>
      </div>

      {/* Error message */}
      {actionError && (
        <div className="mx-1 px-2.5 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-red-500">
          <span className="text-[11px] leading-relaxed flex-1">{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-[10px] opacity-60 hover:opacity-100 mt-0.5">✕</button>
        </div>
      )}

      {/* Next step panel */}
      <AnimatePresence>
        {nextStep && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[var(--brand-hover)] border border-[var(--brand-border)] rounded-xl p-3 text-sm text-[var(--brand-text)] flex gap-3">
              <ChevronRight className="shrink-0 text-[var(--brand-accent)] mt-0.5" size={15} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[var(--brand-accent)] text-[10px] mb-1 uppercase tracking-wider">Orientação VIP</p>
                <p className="text-[13px] text-[var(--brand-text)]/80 leading-relaxed">{nextStep}</p>
                <button
                  onClick={() => { setNextStep(null); trackEvent('AI_PANEL_TOGGLE_NEXT_STEP', { state: 'closed' }) }}
                  className="text-[10px] text-[var(--brand-muted)]/50 mt-2 hover:text-[var(--brand-muted)] transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
