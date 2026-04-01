"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, FileText, X,
  Loader2, AlertCircle, ArrowRight, Paperclip, Sparkles,
  CheckCircle2, Clock, Crown, Download, RefreshCw, BrainCircuit, Plus, Trash2, Save, RotateCcw,
  Check, XCircle, BarChart2
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { TccSidebar } from "@/components/TccSidebar"
import { EditableRichText } from "@/components/EditableRichText"
import { DevPlanSwitcher } from "@/components/DevPlanSwitcher"
import { useUserPlan } from "@/hooks/useUserPlan"
import { getDailyMessageLimit } from "@/lib/plan"
import { AiActionToolbar } from "@/components/AiActionToolbar"
import { trackEvent } from "@/lib/analytics"
import { Editor } from "@tiptap/react"

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: "user" | "bot"
  content: string
  hasEditor?: boolean
  chapterTitle?: string
  editorContent?: string
  originalContent?: string
  timestamp?: string
  userPrompt?: string
}

interface Stats {
  progress: number
  plagiarism: number
  humanAuthorship: number
  totalPages: number
  status: string
}

interface TccMeta {
  id: string
  title: string
  course: string
  institution: string
  workType?: string | null
  norma?: string | null
  deadline?: string | null
  objective?: string | null
  content?: string | null
}

// State for review mode
interface ReviewState {
  messageId: string
  suggestionHtml: string
  userPrompt?: string
}

function getDailyKey(userId: string, plan: string) {
  return `teseo.daily.${userId}.${plan}.${new Date().toISOString().slice(0, 10)}`
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripHtmlTags(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim()
}

function extractHeadings(html: string): { id: string; text: string; level: number }[] {
  const matches = [...html.matchAll(/<(h[1-3])[^>]*>(.*?)<\/h[1-3]>/gi)]
  return matches.map((m, i) => ({
    id: `heading-${i}`,
    text: stripHtmlTags(m[2]),
    level: parseInt(m[1].replace('h', ''))
  }))
}

function computeLinguisticFidelity(original: string, suggestion: string): number {
  // Simple word overlap metric for fidelity display
  if (!original || !suggestion) return 88
  const origWords = new Set(stripHtmlTags(original).toLowerCase().split(/\s+/).filter(w => w.length > 4))
  const suggWords = stripHtmlTags(suggestion).toLowerCase().split(/\s+/).filter(w => w.length > 4)
  if (origWords.size === 0) return 88
  const overlap = suggWords.filter(w => origWords.has(w)).length
  const base = Math.round((overlap / Math.max(origWords.size, suggWords.length)) * 100)
  return Math.min(Math.max(base, 72), 97)
}

// ─── PDF / Gemini helpers ─────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function markdownToHtml(md: string): string {
  const html = md
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^---$/gm, '<hr/>')
  return html
    .split(/\n{2,}/)
    .map(block => {
      const trimmed = block.trim()
      if (!trimmed) return ''
      if (/^<(h[1-6]|hr)/.test(trimmed)) return trimmed
      return trimmed
        .split('\n')
        .filter(l => l.trim())
        .map(l => /^<(h[1-6]|hr)/.test(l.trim()) ? l : `<p>${l}</p>`)
        .join('')
    })
    .join('')
}

// ─── Review Mode Panel (3 columns) ───────────────────────────────────────────

function ReviewPanel({
  original,
  suggestion,
  onAccept,
  onReject,
  onRegenerate,
}: {
  original: string
  suggestion: string
  onAccept: () => void
  onReject: () => void
  onRegenerate?: () => void
}) {
  const fidelity = computeLinguisticFidelity(original, suggestion)

  const issues = React.useMemo(() => {
    const list: { label: string; detail: string }[] = []
    const suggText = stripHtmlTags(suggestion).toLowerCase()
    if (suggText.includes("kind of") || suggText.includes("basically") || suggText.includes("um ") || suggText.includes("né")) {
      list.push({ label: "LINGUAGEM INFORMAL", detail: "Expressões coloquiais detectadas. Substitua por formulações acadêmicas rigorosas." })
    }
    if (suggText.length < 300) {
      list.push({ label: "EXTENSÃO REDUZIDA", detail: "O trecho gerado é curto. Considere expandir com argumentação adicional." })
    }
    if (!suggText.includes("segundo") && !suggText.includes("conforme") && !suggText.includes("de acordo") && !suggText.includes("(20")) {
      list.push({ label: "CITAÇÕES AUSENTES", detail: "Nenhuma referência detectada. Adicione autores para embasar o argumento." })
    }
    if (list.length === 0) {
      list.push({ label: "PRECISÃO TERMINOLÓGICA", detail: "Verifique se os termos técnicos estão alinhados com a norma da área." })
    }
    return list.slice(0, 2)
  }, [suggestion])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex-1 flex overflow-hidden"
    >
      {/* ── Col 1: Original Manuscript ── */}
      <div className="flex-1 flex flex-col border-r border-white/[0.06] min-w-0">
        <div className="px-6 py-3 border-b border-white/[0.05]">
          <span className="text-[9px] font-bold tracking-widest text-white/25 uppercase">Manuscrito Original</span>
        </div>
        <div className="flex-1 overflow-y-auto custom-scroll px-8 py-8">
          {original ? (
            <div
              className="text-[15px] leading-[1.85] text-white/45 font-serif max-w-[480px]"
              dangerouslySetInnerHTML={{ __html: original }}
            />
          ) : (
            <p className="text-white/20 text-sm font-serif italic">Documento ainda sem conteúdo. A sugestão será adicionada ao final.</p>
          )}
        </div>
      </div>

      {/* ── Col 2: Revision Suggestion ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#131311]">
        {/* Header with REJECT / ACCEPT */}
        <div className="px-6 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <span className="text-[9px] font-bold tracking-widest text-white/25 uppercase">Sugestão de Revisão</span>
          <div className="flex items-center gap-3">
            <button
              onClick={onReject}
              className="text-[11px] font-bold text-white/35 hover:text-red-400 tracking-wider uppercase transition-colors flex items-center gap-1"
            >
              <XCircle size={13} /> Rejeitar
            </button>
            <button
              onClick={onAccept}
              className="text-[11px] font-bold text-white/80 hover:text-white tracking-wider uppercase transition-colors flex items-center gap-1.5 bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] px-3 py-1.5 rounded-lg"
            >
              <Check size={13} /> Aceitar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll px-8 py-8">
          <div
            className="text-[15px] leading-[1.85] text-white/85 font-serif max-w-[480px]"
            dangerouslySetInnerHTML={{ __html: suggestion }}
          />
        </div>

        {/* Bottom: regenerate */}
        {onRegenerate && (
          <div className="px-6 py-3 border-t border-white/[0.05]">
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/60 transition-colors font-medium"
            >
              <RotateCcw size={11} /> Regerar sugestão
            </button>
          </div>
        )}
      </div>

      {/* ── Col 3: Analysis Panel ── */}
      <div className="w-[220px] shrink-0 border-l border-white/[0.06] flex flex-col overflow-y-auto custom-scroll">
        <div className="px-5 py-3 border-b border-white/[0.05]">
          <span className="text-[9px] font-bold tracking-widest text-white/25 uppercase">Análise</span>
        </div>

        <div className="p-5 space-y-6">
          {/* Linguistic Fidelity */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Fidelidade Linguística</span>
              <span className="text-sm font-bold text-white/70">{fidelity}%</span>
            </div>
            <div className="h-0.5 bg-white/[0.07] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white/40 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${fidelity}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Issues */}
          <div className="space-y-4">
            {issues.map((issue, i) => (
              <div key={i}>
                <p className="text-[9px] font-bold text-white/35 tracking-widest mb-1">{issue.label}</p>
                <p className="text-[11px] text-white/30 leading-relaxed">{issue.detail}</p>
              </div>
            ))}
          </div>

          {/* Structural Metrics */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <BarChart2 size={11} className="text-white/25" />
              <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Métricas Estruturais</span>
            </div>
            <div className="space-y-2.5">
              {[
                { label: "Densidade de Transição", value: Math.round(fidelity * 0.72) },
                { label: "Profundidade Lexical", value: Math.round(fidelity * 0.85) },
              ].map(m => (
                <div key={m.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] text-white/25">{m.label}</span>
                  </div>
                  <div className="h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full bg-white/20 rounded-full" style={{ width: `${m.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tip quote */}
          <div className="border-t border-white/[0.05] pt-4">
            <p className="text-[11px] text-white/20 leading-relaxed italic font-serif">
              &ldquo;O contraste entre o &lsquo;objetivo&rsquo; e o &lsquo;subjetivo&rsquo; pode ser enfatizado na conclusão.&rdquo;
            </p>
          </div>

          {/* Apply Strategy */}
          <button
            onClick={onAccept}
            className="w-full py-2 text-[10px] font-bold text-white/40 hover:text-white/70 border border-white/[0.08] hover:border-white/[0.16] rounded-lg transition-all uppercase tracking-widest"
          >
            Aplicar Estratégia
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function UpgradeModal({ open, onClose, onPricing, currentPlan }: { open: boolean; onClose: () => void; onPricing: () => void; currentPlan: string }) {
  const isPro = currentPlan === "PRO"
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative w-full max-w-md bg-[#1a1a18] rounded-2xl border border-white/[0.1] p-7 space-y-5">
            <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-white/[0.08] rounded-lg transition-colors"><X size={14} className="text-white/40" /></button>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{isPro ? "Upgrade para VIP" : "Escolha seu plano"}</p>
              <h2 className="text-xl font-bold text-white">{isPro ? "O melhor resultado para seu TCC" : "Escreva seu TCC sem limites"}</h2>
            </div>
            {!isPro && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.03] space-y-3">
                  <div><p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">PRO</p><p className="text-lg font-black text-white leading-none mt-1">R$ 200</p><p className="text-[10px] text-white/30 mt-0.5">por TCC</p></div>
                  <ul className="space-y-1.5">{["50 mensagens/dia", "Revisão por cap.", "PDF sem marca"].map(f => (<li key={f} className="text-[11px] text-white/45 flex items-center gap-1.5"><CheckCircle2 size={10} className="text-white/25 shrink-0" /> {f}</li>))}</ul>
                  <button onClick={onPricing} className="w-full py-2 text-[11px] font-bold border border-white/[0.12] rounded-lg text-white/60 hover:bg-white/[0.06] transition-colors">Ver PRO</button>
                </div>
                <div className="p-4 rounded-xl border border-orange-700/30 bg-orange-700/[0.05] space-y-3 relative">
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-orange-700 text-black text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">Premium</div>
                  <div><p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">VIP</p><p className="text-lg font-black text-white leading-none mt-1">R$ 1.000</p><p className="text-[10px] text-white/30 mt-0.5">2 TCCs</p></div>
                  <ul className="space-y-1.5">{["Ilimitado", "Revisão completa", "Consistência global"].map(f => (<li key={f} className="text-[11px] text-white/70 flex items-center gap-1.5"><CheckCircle2 size={10} className="text-orange-600 shrink-0" /> {f}</li>))}</ul>
                  <button onClick={onPricing} className="w-full py-2 text-[11px] font-bold bg-orange-700 text-black rounded-lg hover:bg-orange-600 transition-colors">Ver VIP</button>
                </div>
              </div>
            )}
            {isPro && (
              <div className="p-5 rounded-xl border border-orange-700/30 bg-orange-700/[0.05] space-y-3">
                <div className="flex items-center justify-between"><div><p className="text-sm font-bold text-orange-600">VIP</p><p className="text-2xl font-black text-white">R$ 1.000 <span className="text-sm font-normal text-white/30">/ 2 TCCs</span></p></div><Crown size={26} className="text-orange-600/50" /></div>
                <ul className="space-y-2">{["Mensagens ilimitadas", "2 projetos simultâneos", "Revisão completa", "Consistência automática", "50 uploads de referências", "Suporte VIP"].map(f => (<li key={f} className="text-sm text-white/65 flex items-center gap-2"><CheckCircle2 size={12} className="text-orange-600 shrink-0" /> {f}</li>))}</ul>
              </div>
            )}
            <div className="space-y-2 pt-1">
              <button onClick={onPricing} className="w-full py-3 bg-white text-[#0F0F0E] font-bold text-sm rounded-xl hover:opacity-80 transition-opacity">{isPro ? "Fazer upgrade para VIP" : "Ver planos e preços"}</button>
              <button onClick={onClose} className="w-full py-2.5 text-sm text-white/35 hover:text-white/60 transition-colors">Continuar no plano atual</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function LimitModal({ open, onClose, onUpgrade, dailyLimit, planName }: { open: boolean; onClose: () => void; onUpgrade: () => void; dailyLimit: number; planName: string }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.18, ease: "easeOut" }} className="w-full max-w-sm bg-[#1a1a18] rounded-2xl border border-white/[0.1] p-7 text-center space-y-5">
            <div className="w-12 h-12 rounded-full bg-white/[0.05] border border-white/[0.07] flex items-center justify-center mx-auto"><Clock size={20} className="text-white/40" /></div>
            <div className="space-y-1.5"><h2 className="text-lg font-bold text-white">Limite diário atingido</h2><p className="text-sm text-white/50 leading-relaxed">Você usou suas {dailyLimit} mensagens de hoje no plano {planName}.</p></div>
            <div className="space-y-2"><button onClick={() => { onUpgrade(); onClose() }} className="w-full py-3 bg-white text-[#0F0F0E] font-bold text-sm rounded-xl hover:opacity-80 transition-opacity">Fazer upgrade</button><button onClick={onClose} className="w-full py-2.5 text-sm text-white/35 hover:text-white/60 transition-colors">Voltar amanhã</button></div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ExportModal({ open, onClose, onExport, onUpgrade }: { open: boolean; onClose: () => void; onExport: () => void; onUpgrade: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.18, ease: "easeOut" }} className="w-full max-w-sm bg-[#1a1a18] rounded-2xl border border-white/[0.1] p-7 space-y-5">
            <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-white/[0.06] grid place-items-center shrink-0"><Download size={16} className="text-white/50" /></div><div><h2 className="text-base font-bold text-white">Exportar TCC</h2><p className="text-[11px] text-white/40">Plano gratuito</p></div></div>
            <p className="text-sm text-white/50 leading-relaxed">Seu PDF será exportado com a marca d&apos;água do Teseo. Com o <span className="text-white/70 font-medium">Plano PRO</span>, você exporta sem marca e com formatação ABNT.</p>
            <div className="space-y-2"><button onClick={() => { onUpgrade(); onClose() }} className="w-full py-3 bg-white text-[#0F0F0E] font-bold text-sm rounded-xl hover:opacity-80 transition-opacity">Fazer upgrade PRO</button><button onClick={() => { onExport(); onClose() }} className="w-full py-2.5 text-sm text-white/35 hover:text-white/60 transition-colors">Exportar com marca d&apos;água</button></div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Workspace ───────────────────────────────────────────────────────────────

export default function TccWorkspacePage() {
  const { data: session } = useSession()
  const { id } = useParams()
  const router = useRouter()

  const userPlan = useUserPlan()
  const dailyLimit = getDailyMessageLimit(userPlan)
  const isVip = userPlan === "VIP"

  React.useEffect(() => {
    document.documentElement.style.overflow = "hidden"
    return () => { document.documentElement.style.overflow = "" }
  }, [])

  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [tccContent, setTccContent] = React.useState("")
  const [tccSavedContent, setTccSavedContent] = React.useState("")
  const [tccMeta, setTccMeta] = React.useState<TccMeta | null>(null)
  const [savingStatus, setSavingStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle")
  const editorRef = React.useRef<Editor | null>(null)
  const chatEndRef = React.useRef<HTMLDivElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [inputVal, setInputVal] = React.useState("")
  const [isTyping, setIsTyping] = React.useState(false)
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState<"chat" | "metricas">("chat")
  const [attachmentsMeta, setAttachmentsMeta] = React.useState<{ count: number; limit: number } | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [pdfFiles, setPdfFiles] = React.useState<File[]>([])
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [selectedChapter, setSelectedChapter] = React.useState("Introdução")
  const [upgradeOpen, setUpgradeOpen] = React.useState(false)
  const [limitOpen, setLimitOpen] = React.useState(false)
  const [exportOpen, setExportOpen] = React.useState(false)

  const headings = React.useMemo(() => extractHeadings(tccContent), [tccContent])

  // ── Review mode state ──────────────────────────────────────────────────────
  const [reviewState, setReviewState] = React.useState<ReviewState | null>(null)

  const _trackedOpen = React.useRef(false)
  React.useEffect(() => {
    if (!loading && tccMeta && !_trackedOpen.current) {
      _trackedOpen.current = true
      trackEvent('WORKSPACE_OPEN', { plan: userPlan, tccId: String(id) })
    }
  }, [loading, tccMeta, userPlan, id])

  React.useEffect(() => {
    if (upgradeOpen) trackEvent('UPGRADE_MODAL_SHOWN', { plan: userPlan, source: 'workspace' })
  }, [upgradeOpen, userPlan])

  React.useEffect(() => {
    if (limitOpen) trackEvent('LIMIT_MODAL_SHOWN', { plan: userPlan, dailyLimit })
  }, [limitOpen, userPlan, dailyLimit])

  const handleWatermarkedExport = React.useCallback(() => {
    if (!tccContent) return
    const body = stripHtmlTags(tccContent)
    const title = tccMeta?.title ?? "TCC"
    const meta = [tccMeta?.course, tccMeta?.institution, tccMeta?.workType, tccMeta?.norma].filter(Boolean).join(" · ")
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${title} — Teseo FREE</title><style>* { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: "Times New Roman", serif; max-width: 780px; margin: 60px auto; padding: 0 48px 80px; line-height: 1.9; color: #111; } h1 { font-size: 16pt; text-align: center; margin-bottom: 6px; } .meta { text-align: center; color: #666; font-size: 10pt; margin-bottom: 48px; } .body { font-size: 12pt; white-space: pre-wrap; word-break: break-word; } .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-40deg); font-size: 80pt; font-weight: 900; color: rgba(0,0,0,0.04); pointer-events: none; white-space: nowrap; font-family: sans-serif; } .footer { margin-top: 56px; padding-top: 16px; border-top: 1px solid #ddd; text-align: center; font-size: 9pt; color: #aaa; }</style></head><body><div class="watermark">TESEO FREE</div><h1>${title}</h1>${meta ? `<div class="meta">${meta}</div>` : ""}<div class="body">${body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div><div class="footer">Exportado pelo Teseo (plano gratuito) · teseo.com.br</div></body></html>`
    const win = window.open("", "_blank")
    if (!win) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "bot", content: "⚠️ O navegador bloqueou a janela de exportação. Permita popups e tente novamente." }])
      setActiveTab("chat"); return
    }
    win.document.documentElement.innerHTML = html
    win.focus()
    setTimeout(() => { win.print() }, 400)
  }, [tccContent, tccMeta])

  const userId = (session?.user as { id?: string } | undefined)?.id ?? "anon"
  const getDailyCount = React.useCallback(() => {
    if (typeof window === "undefined") return 0
    return parseInt(localStorage.getItem(getDailyKey(userId, userPlan)) || "0", 10)
  }, [userId, userPlan])
  const incrementDailyCount = React.useCallback(() => {
    if (typeof window === "undefined") return
    localStorage.setItem(getDailyKey(userId, userPlan), String(getDailyCount() + 1))
  }, [userId, userPlan, getDailyCount])

  const safeJson = async (res: Response) => {
    if (!res.ok) return null
    const text = await res.text()
    if (!text) return null
    try { return JSON.parse(text) } catch { return null }
  }

  const fetchStats = React.useCallback(async () => {
    try {
      const data = await safeJson(await fetch(`/api/tcc/${id}/stats`))
      if (data && !data.error) setStats(data)
    } catch (e) { console.error(e) }
  }, [id])

  const fetchMessages = React.useCallback(async () => {
    try {
      const data = await safeJson(await fetch(`/api/tcc/${id}/messages`))
      if (!Array.isArray(data)) return
      setMessages(data.map((m: { id: string; role: "user" | "bot"; content: string; createdAt: string }) => ({
        id: m.id, role: m.role, content: m.content, timestamp: m.createdAt,
        hasEditor: m.role === "bot" && m.content.length > 300,
        editorContent: m.content,
      })))
    } catch (e) { console.error(e) }
  }, [id])

  const fetchAttachments = React.useCallback(async () => {
    try {
      const data = await safeJson(await fetch(`/api/tcc/${id}/attachments`, { cache: "no-store" }))
      if (data && !data.error) setAttachmentsMeta({ count: data.count ?? 0, limit: data.limit ?? 5 })
    } catch (e) { console.error(e) }
  }, [id])

  const fetchMeta = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/tcc/${id}`)
      if (!res.ok) { router.push("/dashboard"); return }
      const data = await safeJson(res)
      if (data && !data.error) {
        setTccMeta(data)
        if (data.content) { setTccContent(data.content); setTccSavedContent(data.content) }
      }
    } catch (e) { console.error(e) }
  }, [id, router])

  React.useEffect(() => {
    if (!id) return
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchMessages(), fetchStats(), fetchAttachments(), fetchMeta()])
      setLoading(false)
    }
    init()
    const interval = setInterval(fetchStats, 15000)
    return () => clearInterval(interval)
  }, [id, fetchMessages, fetchStats, fetchAttachments, fetchMeta])

  React.useEffect(() => {
    if (activeTab === "chat") chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping, activeTab])

  React.useEffect(() => {
    if (!id || tccContent === tccSavedContent) return
    const timeout = setTimeout(async () => {
      setSavingStatus("saving")
      try {
        const res = await fetch(`/api/tcc/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: tccContent }) })
        if (res.ok) { setTccSavedContent(tccContent); setSavingStatus("saved"); setTimeout(() => setSavingStatus("idle"), 2000) }
        else setSavingStatus("error")
      } catch { setSavingStatus("error") }
    }, 2000)
    return () => clearTimeout(timeout)
  }, [tccContent, tccSavedContent, id])

  const handleManualSave = async () => {
    if (!id || savingStatus === "saving") return
    setSavingStatus("saving")
    try {
      const res = await fetch(`/api/tcc/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: tccContent }) })
      if (res.ok) { setTccSavedContent(tccContent); setSavingStatus("saved"); setTimeout(() => setSavingStatus("idle"), 2000); trackEvent('MANUAL_SAVE_TCC', { plan: userPlan }) }
      else setSavingStatus("error")
    } catch { setSavingStatus("error") }
  }

  const handleSendPrompt = async (forcedPrompt?: string) => {
    const text = forcedPrompt || inputVal
    if (!text.trim() || isTyping) return
    if (dailyLimit < Infinity && getDailyCount() >= dailyLimit) { setLimitOpen(true); return }

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: text }
    setMessages(prev => [...prev, userMsg])
    if (!forcedPrompt) setInputVal("")
    setIsTyping(true)
    setActiveTab("chat")
    // Exit review mode when sending a new prompt
    setReviewState(null)

    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tccId: id, message: text }),
      })
      const data = await res.json()
      const botMsg: ChatMessage = {
        id: data.id || (Date.now().toString() + "bot"),
        role: "bot", content: data.content,
        hasEditor: data.content.length > 300, editorContent: data.content,
        timestamp: data.timestamp, userPrompt: text,
      }
      setMessages(prev => [...prev, botMsg])
      incrementDailyCount()
      fetchStats()
      if (dailyLimit < Infinity && getDailyCount() >= dailyLimit) setLimitOpen(true)

      // ── Auto-enter review mode for substantial bot responses ──
      if (data.content.length > 200) {
        setReviewState({ messageId: botMsg.id, suggestionHtml: data.content, userPrompt: text })
      }
    } catch (e) { console.error(e) }
    finally { setIsTyping(false) }
  }

  // Review mode handlers
  const handleAcceptReview = React.useCallback(() => {
    if (!reviewState) return
    if (editorRef.current) {
      editorRef.current.chain().focus('end').insertContent(reviewState.suggestionHtml).run()
    } else {
      setTccContent(prev => prev + reviewState.suggestionHtml)
    }
    trackEvent('REVIEW_ACCEPTED', { plan: userPlan })
    setReviewState(null)
  }, [reviewState, userPlan])

  const handleRejectReview = React.useCallback(() => {
    if (!reviewState) return
    setMessages(prev => prev.filter(m => m.id !== reviewState.messageId))
    trackEvent('REVIEW_REJECTED', { plan: userPlan })
    setReviewState(null)
  }, [reviewState, userPlan])

  const handleRegenerateReview = React.useCallback(() => {
    if (!reviewState?.userPrompt) return
    const prompt = reviewState.userPrompt
    setMessages(prev => prev.filter(m => m.id !== reviewState.messageId))
    setReviewState(null)
    handleSendPrompt(prompt)
  }, [reviewState])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (attachmentsMeta && attachmentsMeta.count >= attachmentsMeta.limit) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "bot", content: `⚠️ Limite de ${attachmentsMeta.limit} anexos atingido no plano ${userPlan}.` }])
      setActiveTab("chat")
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }
    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    try {
      await fetch(`/api/tcc/${id}/attachments`, { method: "POST", body: formData })
      if (file.type === "application/pdf") setPdfFiles(prev => [...prev, file])
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "bot", content: `📎 Arquivo "${file.name}" anexado com sucesso.` }])
      fetchAttachments()
    } catch { } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleGerarTcc = async () => {
    if (pdfFiles.length === 0 || !tccMeta) return
    setIsGenerating(true)
    setActiveTab("chat")
    try {
      const pdfsBase64 = await Promise.all(pdfFiles.map(fileToBase64))
      const res = await fetch('/api/gerar-tcc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tema: tccMeta.title,
          tipoTrabalho: tccMeta.workType,
          objetivo: tccMeta.objective,
          norma: tccMeta.norma,
          curso: tccMeta.course,
          pdfsBase64,
          capitulo: selectedChapter,
          contextoAnterior: stripHtmlTags(tccContent)
        })
      })
      const data = await res.json()
      if (data.sucesso) {
        const html = markdownToHtml(data.texto)
        const botMsg: ChatMessage = {
          id: Date.now().toString() + "bot",
          role: "bot",
          content: html,
          hasEditor: true,
          editorContent: html,
          userPrompt: `Gerar ${selectedChapter} — ${tccMeta.title}`,
        }
        setMessages(prev => [...prev, botMsg])
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: "bot", content: `⚠️ ${data.error ?? "Erro ao gerar introdução."}` }])
      }
    } catch (e) {
      console.error(e)
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "bot", content: "⚠️ Falha na conexão com a IA. Tente novamente." }])
    } finally {
      setIsGenerating(false)
      setPdfFiles([])
    }
  }

  const handleInsertDocument = (suggestionHtml: string, mode: 'cursor' | 'end' | 'replace' = 'cursor') => {
    if (!editorRef.current) return
    const editor = editorRef.current
    if (mode === 'end') editor.chain().focus('end').insertContent(suggestionHtml).run()
    else editor.chain().focus().insertContent(suggestionHtml).run()
    trackEvent('INSERT_SUGGESTION_DOCUMENT', { plan: userPlan, mode })
  }

  const handleApplyAiAction = (_action: string, resultHtml: string) => {
    setTccContent(resultHtml)
  }

  if (loading) return (
    <div className="h-screen bg-[#0F0F0E] flex items-center justify-center">
      <Loader2 className="w-7 h-7 text-white/40 animate-spin" />
    </div>
  )

  return (
    <div className="h-[100dvh] bg-[#0F0F0E] text-[#F1F0EC] overflow-hidden flex font-sans">
      {/* ── Left nav rail ── */}
      <nav className="w-[52px] shrink-0 flex flex-col items-center py-4 gap-3 border-r border-white/[0.06] bg-[#0A0A09] z-20">
        <button onClick={() => router.push("/dashboard")} className="p-2 hover:bg-white/[0.08] rounded-lg transition-colors" title="Voltar ao dashboard">
          <ArrowLeft size={16} />
        </button>
        <div className="w-8 h-8 rounded-full bg-white/[0.10] grid place-items-center mt-1 shrink-0">
          <span className="text-white/80 font-bold text-sm leading-none uppercase">{(session?.user?.name || session?.user?.email || "?")[0]}</span>
        </div>
        <div className="flex-1" />
        <div
          className={cn("px-2 py-1 rounded-md text-[9px] font-bold tracking-widest uppercase select-none",
            isVip ? "bg-orange-700/20 text-orange-600" : userPlan === "PRO" ? "bg-white/15 text-white/80" : "bg-white/[0.07] text-white/50 border border-white/[0.10]"
          )}
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {userPlan === "FREE" ? "Free" : userPlan}
        </div>
      </nav>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-[52px] border-b border-white/[0.06] bg-[#111110] flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center shrink-0">
                <FileText size={14} className="text-white/50" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-sm text-white/85 leading-tight">{tccMeta?.title || "Seu TCC"}</h1>
                  <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase", isVip ? "bg-orange-700/20 text-orange-600" : userPlan === "PRO" ? "bg-white/15 text-white/80" : "bg-white/[0.07] text-white/50")}>{userPlan}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-white/35">{tccMeta?.course || "—"}</span>
                  {reviewState && <span className="text-[10px] text-orange-700/70 font-bold tracking-widest">· MODO REVISÃO</span>}
                </div>
              </div>
            </div>
            {/* Saving status */}
            <div className="flex items-center gap-1.5 text-[10px] ml-2">
              {savingStatus === "saving" && <><Loader2 size={10} className="animate-spin text-orange-700" /><span className="text-orange-700">Salvando...</span></>}
              {savingStatus === "saved" && <><CheckCircle2 size={10} className="text-emerald-500" /><span className="text-emerald-500">Salvo</span></>}
              {savingStatus === "error" && <><AlertCircle size={10} className="text-red-500" /><span className="text-red-500">Erro</span></>}
              {savingStatus === "idle" && tccContent !== tccSavedContent && (
                <button onClick={handleManualSave} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-700/10 hover:bg-orange-700/20 text-orange-700 transition-colors border border-orange-700/20 font-bold">
                  <Save size={10} /> Salvar
                </button>
              )}
              {savingStatus === "idle" && tccContent === tccSavedContent && <span className="text-white/25">Atualizado</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {reviewState && (
              <div className="flex items-center gap-2 mr-2">
                <button onClick={handleRejectReview} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white/40 hover:text-red-400 border border-white/[0.08] hover:border-red-500/30 rounded-lg transition-all">
                  <XCircle size={12} /> Rejeitar
                </button>
                <button onClick={handleAcceptReview} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.14] rounded-lg transition-all">
                  <Check size={12} /> Aceitar
                </button>
              </div>
            )}
            <div className="bg-transparent border-none">
              <AiActionToolbar
                userPlan={userPlan} content={tccContent}
                onApplyAction={handleApplyAiAction} onUpgrade={() => setUpgradeOpen(true)}
                tccId={String(id)} context={tccMeta ? Object.values(tccMeta).join(' ') : ""}
              />
            </div>
          </div>
        </header>

        {/* Body: review mode or normal editor */}
        <div className="flex-1 flex overflow-hidden">
          <AnimatePresence mode="wait">
            {reviewState ? (
              /* ── Review Mode: 3 columns ── */
              <ReviewPanel
                key="review"
                original={tccContent}
                suggestion={reviewState.suggestionHtml}
                onAccept={handleAcceptReview}
                onReject={handleRejectReview}
                onRegenerate={reviewState.userPrompt ? handleRegenerateReview : undefined}
              />
            ) : (
              /* ── Normal editor mode ── */
              <motion.div
                key="editor"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 overflow-y-auto custom-scroll bg-[#0A0A09]"
              >
                <div className="min-h-full py-10 flex justify-center gap-4 px-4 sm:px-8">
                  {/* TOC — só aparece em telas largas quando há headings */}
                  {headings.length > 0 && (
                    <aside className="hidden xl:flex w-[170px] shrink-0 self-start sticky top-10 flex-col gap-1">
                      <p className="text-[9px] font-bold tracking-widest uppercase text-white/25 mb-1">Índice</p>
                      {headings.map((h, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            const el = document.querySelector(`[data-heading-index="${i}"]`)
                            el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }}
                          className="text-left text-[11px] text-white/35 hover:text-white/70 transition-colors leading-snug py-0.5 truncate"
                          style={{ paddingLeft: `${(h.level - 1) * 8}px` }}
                        >
                          {h.text}
                        </button>
                      ))}
                    </aside>
                  )}

                  {/* Editor */}
                  <div className="w-full max-w-[850px]">
                    <div className="w-full bg-[#111110] border border-white/[0.08] shadow-2xl rounded-sm min-h-[90vh]">
                      <EditableRichText value={tccContent} onChange={setTccContent} editorRef={editorRef} className="border-none shadow-none bg-transparent" />
                    </div>
                  </div>

                  {/* Phantom para manter editor centralizado quando TOC aparece */}
                  {headings.length > 0 && <div className="hidden xl:block w-[170px] shrink-0" />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Right sidebar (chat / metrics) — hidden in review mode ── */}
          {!reviewState && (
            <aside className="w-[340px] shrink-0 border-l border-white/[0.06] bg-[#111110] flex flex-col z-20">
              {/* Tabs */}
              <div className="flex items-center border-b border-white/[0.06] px-1 pt-1 shrink-0 bg-[#161615]">
                <button onClick={() => setActiveTab("chat")} className={cn("flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2", activeTab === "chat" ? "border-orange-700 text-orange-600" : "border-transparent text-white/40 hover:text-white/70")}>
                  <span className="flex items-center justify-center gap-2"><BrainCircuit size={13} /> Sugestões</span>
                </button>
                <button onClick={() => setActiveTab("metricas")} className={cn("flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2", activeTab === "metricas" ? "border-orange-700 text-orange-600" : "border-transparent text-white/40 hover:text-white/70")}>
                  Métricas
                </button>
              </div>

              {activeTab === "metricas" && (
                <div className="flex-1 overflow-y-auto custom-scroll">
                  <TccSidebar stats={stats} userPlan={userPlan} tccId={String(id)} onUpgrade={() => setUpgradeOpen(true)}
                    onExport={() => { trackEvent('EXPORT_CLICK', { plan: userPlan, hasContent: !!tccContent }); if (userPlan === "FREE") setExportOpen(true); else handleWatermarkedExport() }} />
                </div>
              )}

              {activeTab === "chat" && (
                <>
                  <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-4 pb-[130px]">
                    {messages.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-60 px-5 space-y-3 pt-12">
                        <div className="w-12 h-12 rounded-2xl bg-orange-700/10 flex items-center justify-center border border-orange-700/20 text-orange-700 mb-2"><Sparkles size={22} /></div>
                        <h3 className="text-white/90 font-bold text-sm">Boas-vindas ao seu TCC!</h3>
                        <p className="text-[12px] text-white/40 leading-relaxed font-serif">Peça para a IA gerar um capítulo. A sugestão aparecerá no modo de revisão lado a lado com seu texto.</p>
                      </div>
                    )}
                    <AnimatePresence>
                      {messages.map(m => (
                        <motion.div key={m.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className={cn("flex flex-col w-full", m.role === "user" ? "items-end" : "items-start")}>
                          {m.role === "user" ? (
                            <div className="max-w-[85%] px-3 py-2.5 text-[13px] bg-[#1E1D19] border border-white/[0.08] rounded-[1rem_0_1rem_1rem] text-white/85 leading-relaxed">{m.content}</div>
                          ) : (
                            <div className="w-full bg-[#181816] border border-orange-700/20 rounded-xl overflow-hidden">
                              <div className="px-3 py-2 bg-orange-700/[0.06] border-b border-orange-700/10 flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-700/70 tracking-widest uppercase"><Sparkles size={11} /> Sugestão da IA</div>
                                <button
                                  onClick={() => setReviewState({ messageId: m.id, suggestionHtml: m.editorContent || m.content, userPrompt: m.userPrompt })}
                                  className="text-[10px] font-bold tracking-wider uppercase transition-colors px-2 py-0.5 rounded text-white/30 hover:text-white/60"
                                >
                                  Revisar
                                </button>
                              </div>
                              <div className="p-3 text-[12px] leading-relaxed text-white/50 font-serif max-h-[160px] overflow-hidden relative">
                                <div dangerouslySetInnerHTML={{ __html: m.editorContent || m.content }} />
                                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#181816] to-transparent" />
                              </div>
                              <div className="px-3 py-2 border-t border-white/[0.04] flex gap-2">
                                <button
                                  onClick={() => setReviewState({ messageId: m.id, suggestionHtml: m.editorContent || m.content, userPrompt: m.userPrompt })}
                                  className="flex-1 py-1.5 text-[10px] font-bold text-white/40 hover:text-white/70 border border-white/[0.08] hover:border-white/[0.16] rounded-lg transition-all"
                                >
                                  Ver revisão lado a lado
                                </button>
                                <button
                                  onClick={() => handleInsertDocument(m.editorContent || m.content, 'end')}
                                  className="flex-1 py-1.5 text-[10px] font-bold bg-orange-700/80 hover:bg-orange-700 text-black rounded-lg transition-all"
                                >
                                  Inserir direto
                                </button>
                                {m.userPrompt && (
                                  <button
                                    onClick={() => { setMessages(prev => prev.filter(x => x.id !== m.id)); handleSendPrompt(m.userPrompt) }}
                                    className="p-1.5 text-white/25 hover:text-white/50 border border-white/[0.08] rounded-lg transition-all"
                                  >
                                    <RotateCcw size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {isTyping && (
                      <div className="flex gap-1.5 px-2"><span className="w-1.5 h-1.5 rounded-full bg-orange-700/50 animate-bounce" /><span className="w-1.5 h-1.5 rounded-full bg-orange-700/50 animate-bounce delay-75" /><span className="w-1.5 h-1.5 rounded-full bg-orange-700/50 animate-bounce delay-150" /></div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Chat input */}
                  <div className="absolute bottom-0 right-0 w-[340px] bg-[#111110] border-t border-white/[0.06] p-3 z-10 space-y-2">
                    <div className="space-y-1.5">
                      <select
                        value={selectedChapter}
                        onChange={e => setSelectedChapter(e.target.value)}
                        className="w-full bg-[#1a1a18] border border-white/10 text-white/70 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-orange-700/50"
                      >
                        <option>Introdução</option>
                        <option>Revisão Bibliográfica (Referencial Teórico)</option>
                        <option>Metodologia</option>
                        <option>Desenvolvimento (Resultados)</option>
                        <option>Conclusão</option>
                      </select>
                      <button onClick={handleGerarTcc} disabled={isGenerating}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-700/10 border border-orange-700/30 text-orange-600 text-xs font-semibold rounded-xl hover:bg-orange-700/20 transition-colors disabled:opacity-50">
                        {isGenerating
                          ? <><Loader2 size={12} className="animate-spin" /> Gerando Inteligência...</>
                          : pdfFiles.length > 0
                            ? <><Sparkles size={12} /> Gerar com {pdfFiles.length} PDF{pdfFiles.length > 1 ? 's' : ''}</>
                            : <><Sparkles size={12} /> Gerar sem Referências</>}
                      </button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 custom-scroll">
                      <button onClick={() => handleSendPrompt("Continue a introdução deste TCC")} disabled={isTyping} className="shrink-0 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[10px] text-white/50 font-medium whitespace-nowrap transition-colors flex items-center gap-1">
                        <RefreshCw size={9} /> Continuar introdução
                      </button>
                      <button onClick={() => handleSendPrompt("Melhore a coesão geral dos parágrafos do TCC")} disabled={isTyping} className="shrink-0 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[10px] text-white/50 font-medium whitespace-nowrap transition-colors flex items-center gap-1">
                        <Sparkles size={9} /> Melhorar coesão
                      </button>
                    </div>
                    <div className="relative">
                      <textarea value={inputVal} onChange={e => setInputVal(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendPrompt() } }}
                        placeholder="Peça para gerar ou revisar..."
                        className="w-full bg-[#181816] border border-white/[0.08] rounded-xl pl-9 pr-9 py-2.5 text-[13px] text-white/85 placeholder:text-white/25 focus:outline-none focus:border-orange-700/30 resize-none" rows={1} />
                      <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-white/25 hover:text-white/50">
                        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                      </button>
                      <input type="file" ref={fileInputRef} onChange={handleUpload} accept=".pdf,.doc,.docx" className="hidden" />
                      <button onClick={() => handleSendPrompt()} disabled={!inputVal.trim() || isTyping} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 bg-orange-700 text-black rounded-lg hover:bg-orange-600 disabled:opacity-30 disabled:bg-white/10 disabled:text-white/30 transition-all">
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </aside>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} onPricing={() => { router.push("/pricing"); setUpgradeOpen(false) }} currentPlan={userPlan} />
      <LimitModal open={limitOpen} onClose={() => setLimitOpen(false)} onUpgrade={() => { setLimitOpen(false); setUpgradeOpen(true) }} dailyLimit={dailyLimit} planName={userPlan === "FREE" ? "gratuito" : userPlan} />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} onUpgrade={() => { setExportOpen(false); setUpgradeOpen(true) }} onExport={() => { handleWatermarkedExport(); setExportOpen(false) }} />
      <DevPlanSwitcher />
    </div>
  )
}
