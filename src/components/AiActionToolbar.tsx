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
    // PRO can only review. ABNT, citacoes, proximopasso are VIP.
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
      setActionError("Ocorreu um erro ao processar a solicitação. Tente novamente.")
      trackEvent('AI_ACTION_ERROR', { action, error: 'Network/Unknown', durationMs: Date.now() - startTime })
    } finally {
      setLoadingAction(null)
    }
  }

  return (
    <div className="bg-[#1a1a18] border-b border-white/[0.06] px-3 py-2 flex flex-col gap-2 relative">
      <div className="flex items-center gap-1.5 overflow-x-auto p-1 custom-scroll">
        <div className="flex items-center gap-1.5 px-2 text-[10px] font-bold tracking-widest text-white/40 uppercase shrink-0">
          <Sparkles size={12} className="text-white/30" />
          Ações
        </div>

        <button 
          onClick={() => handleAction('revisar')}
          disabled={loadingAction !== null}
          aria-label={userPlan === 'VIP' ? 'Revisão Crítica VIP' : 'Revisão Gramatical'}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] transition-colors rounded-lg border border-white/[0.06] text-[11px] font-medium text-white/70 whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          {loadingAction === 'revisar' ? <Loader2 size={13} className="animate-spin" /> : <Edit3 size={13} className="text-blue-400" />}
          {userPlan === 'VIP' ? 'Revisão Crítica' : 'Revisão Gramatical'}
        </button>

        <button 
          onClick={() => handleAction('abnt')}
          disabled={loadingAction !== null}
          aria-label="Formatar nas Normas ABNT"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] transition-colors rounded-lg border border-orange-700/20 text-[11px] font-medium text-orange-100 whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          {loadingAction === 'abnt' ? <Loader2 size={13} className="animate-spin" /> : <BookOpen size={13} className="text-orange-600" />}
          Formatar ABNT
          {userPlan !== 'VIP' && <Crown size={10} className="text-orange-700/50" />}
        </button>

        <button 
          onClick={() => handleAction('citacoes')}
          disabled={loadingAction !== null}
          aria-label="Melhorar Citações e Referências"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] transition-colors rounded-lg border border-orange-700/20 text-[11px] font-medium text-orange-100 whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          {loadingAction === 'citacoes' ? <Loader2 size={13} className="animate-spin" /> : <Quote size={13} className="text-orange-600" />}
          Melhorar Citações
          {userPlan !== 'VIP' && <Crown size={10} className="text-orange-700/50" />}
        </button>

        <div className="w-px h-4 bg-white/[0.1] mx-1 shrink-0" />

        <button 
          onClick={() => handleAction('proximopasso')}
          disabled={loadingAction !== null}
          aria-label="Orientação sobre o próximo passo"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-700 hover:bg-orange-600 transition-colors rounded-lg text-[11px] font-bold text-black whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          {loadingAction === 'proximopasso' ? <Loader2 size={13} className="animate-spin" /> : <ChevronRight size={13} />}
          Próximo Passo
          {userPlan !== 'VIP' && <Crown size={10} className="text-black/50" />}
        </button>

      </div>

      {actionError && (
        <div className="mx-2 mt-1 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-red-200">
          <span className="text-[11px] leading-relaxed">{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-[10px] text-red-400 hover:text-red-300 ml-auto pt-0.5">X</button>
        </div>
      )}

      <AnimatePresence>
        {nextStep && (
          <motion.div 
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-orange-700/10 border border-orange-700/30 rounded-xl p-3 text-sm text-orange-200 flex gap-3">
              <ChevronRight className="shrink-0 text-orange-600 mt-0.5" size={16} />
              <div>
                <p className="font-bold text-orange-600 text-xs mb-1 uppercase tracking-wider">Orientação VIP</p>
                <p>{nextStep}</p>
                <button onClick={() => {
                  setNextStep(null)
                  trackEvent('AI_PANEL_TOGGLE_NEXT_STEP', { state: 'closed' })
                }} className="text-[10px] text-orange-600/50 mt-2 hover:text-orange-600">Fechar</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
