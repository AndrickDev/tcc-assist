"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, FileText, Menu, X, Check, PanelRightOpen,
  Loader2, AlertCircle, ArrowRight, Paperclip, Sparkles,
  CheckCircle2, Clock, Crown, Download, Wand2, RefreshCw, Hand, BrainCircuit, Plus, Trash2, ArrowDownToLine, Save, RotateCcw
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
  userPrompt?: string // Store prompt for regeneration
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

function getDailyKey(userId: string, plan: string) {
  return `teseo.daily.${userId}.${plan}.${new Date().toISOString().slice(0, 10)}`
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
            <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-white/[0.08] rounded-lg transition-colors">
              <X size={14} className="text-white/40" />
            </button>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{isPro ? "Upgrade para VIP" : "Escolha seu plano"}</p>
              <h2 className="text-xl font-bold text-white">{isPro ? "O melhor resultado para seu TCC" : "Escreva seu TCC sem limites"}</h2>
            </div>
            {!isPro && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.03] space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">PRO</p>
                    <p className="text-lg font-black text-white leading-none mt-1">R$ 200</p>
                    <p className="text-[10px] text-white/30 mt-0.5">por TCC</p>
                  </div>
                  <ul className="space-y-1.5">
                    {["50 mensagens/dia", "Revisão por cap.", "PDF sem marca"].map(f => (
                      <li key={f} className="text-[11px] text-white/45 flex items-center gap-1.5"><CheckCircle2 size={10} className="text-white/25 shrink-0" /> {f}</li>
                    ))}
                  </ul>
                  <button onClick={onPricing} className="w-full py-2 text-[11px] font-bold border border-white/[0.12] rounded-lg text-white/60 hover:bg-white/[0.06] transition-colors">Ver PRO</button>
                </div>
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] space-y-3 relative">
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">Premium</div>
                  <div>
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">VIP</p>
                    <p className="text-lg font-black text-white leading-none mt-1">R$ 1.000</p>
                    <p className="text-[10px] text-white/30 mt-0.5">2 TCCs</p>
                  </div>
                  <ul className="space-y-1.5">
                    {["Ilimitado", "Revisão completa", "Consistência global"].map(f => (
                      <li key={f} className="text-[11px] text-white/70 flex items-center gap-1.5"><CheckCircle2 size={10} className="text-amber-400 shrink-0" /> {f}</li>
                    ))}
                  </ul>
                  <button onClick={onPricing} className="w-full py-2 text-[11px] font-bold bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors">Ver VIP</button>
                </div>
              </div>
            )}
            {isPro && (
              <div className="p-5 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-amber-400">VIP</p>
                    <p className="text-2xl font-black text-white">R$ 1.000 <span className="text-sm font-normal text-white/30">/ 2 TCCs</span></p>
                  </div>
                  <Crown size={26} className="text-amber-400/50" />
                </div>
                <ul className="space-y-2">
                  {["Mensagens ilimitadas", "2 projetos simultâneos", "Revisão completa", "Consistência automática", "50 uploads de referências", "Suporte VIP"].map(f => (
                    <li key={f} className="text-sm text-white/65 flex items-center gap-2"><CheckCircle2 size={12} className="text-amber-400 shrink-0" /> {f}</li>
                  ))}
                </ul>
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
            <div className="space-y-1.5"><h2 className="text-lg font-bold text-white">Limite diário atingido</h2><p className="text-sm text-white/50 leading-relaxed">Você usou suas {dailyLimit} mensagens de hoje no plano {planName}. Faça upgrade para continuar agora.</p></div>
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

  // Scroll lock
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
  
  // Tab control in right panel
  const [activeTab, setActiveTab] = React.useState<"chat" | "metricas">("chat")
  
  const [attachmentsMeta, setAttachmentsMeta] = React.useState<{ count: number; limit: number } | null>(null)
  const [uploading, setUploading] = React.useState(false)
  
  const [upgradeOpen, setUpgradeOpen] = React.useState(false)
  const [limitOpen, setLimitOpen] = React.useState(false)
  const [exportOpen, setExportOpen] = React.useState(false)

  // ── Beta tracking ──────────────────────────────────────────────────────────
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
    if (!tccContent) return // export button is disabled when content is empty
    const stripHtml = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim()
    const body = stripHtml(tccContent)
    const title = tccMeta?.title ?? "TCC"
    const meta = [tccMeta?.course, tccMeta?.institution, tccMeta?.workType, tccMeta?.norma].filter(Boolean).join(" · ")
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${title} — Teseo FREE</title><style>* { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: "Times New Roman", serif; max-width: 780px; margin: 60px auto; padding: 0 48px 80px; line-height: 1.9; color: #111; } h1 { font-size: 16pt; text-align: center; margin-bottom: 6px; } .meta { text-align: center; color: #666; font-size: 10pt; margin-bottom: 48px; } .body { font-size: 12pt; white-space: pre-wrap; word-break: break-word; } .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-40deg); font-size: 80pt; font-weight: 900; color: rgba(0,0,0,0.04); pointer-events: none; white-space: nowrap; font-family: sans-serif; } .footer { margin-top: 56px; padding-top: 16px; border-top: 1px solid #ddd; text-align: center; font-size: 9pt; color: #aaa; } @media print { .watermark { color: rgba(0,0,0,0.06); } }</style></head><body><div class="watermark">TESEO FREE</div><h1>${title}</h1>${meta ? `<div class="meta">${meta}</div>` : ""}<div class="body">${body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div><div class="footer">Exportado pelo Teseo (plano gratuito) · teseo.com.br</div></body></html>`
    const win = window.open("", "_blank")
    if (!win) {
      // Popup blocked — surface inline message in the chat
      const errorMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "bot",
        content: "⚠️ O navegador bloqueou a janela de exportação. Permita popups para este site nas configurações do navegador e tente novamente.",
      }
      setMessages(prev => [...prev, errorMsg])
      setActiveTab("chat")
      return
    }
    win.document.documentElement.innerHTML = html
    win.focus()
    setTimeout(() => { win.print() }, 400)
  }, [tccContent, tccMeta, setMessages, setActiveTab])

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
      const data = await safeJson(await fetch(`/api/tcc/${id}`))
      if (data && !data.error) {
        setTccMeta(data)
        if (data.content) {
            setTccContent(data.content)
            setTccSavedContent(data.content)
        }
      }
    } catch (e) { console.error(e) }
  }, [id])

  React.useEffect(() => {
    if (!id) return
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchMessages(), fetchStats(), fetchAttachments(), fetchMeta()])
      setLoading(false)
    }
    init()
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [id, fetchMessages, fetchStats, fetchAttachments, fetchMeta])

  // Scroll Chat to bottom
  React.useEffect(() => {
    if (activeTab === "chat") chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping, activeTab])

  // Auto-Save TCC Content
  React.useEffect(() => {
      if (!id || tccContent === tccSavedContent) return
      
      const timeout = setTimeout(async () => {
          setSavingStatus("saving")
          try {
              const res = await fetch(`/api/tcc/${id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ content: tccContent })
              })
              if (res.ok) {
                  setTccSavedContent(tccContent)
                  setSavingStatus("saved")
                  setTimeout(() => setSavingStatus("idle"), 2000)
              } else {
                  setSavingStatus("error")
              }
          } catch(e) {
              setSavingStatus("error")
          }
      }, 2000)
      return () => clearTimeout(timeout)
  }, [tccContent, tccSavedContent, id])

  const handleManualSave = async () => {
    if (!id || savingStatus === "saving") return
    setSavingStatus("saving")
    try {
      const res = await fetch(`/api/tcc/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: tccContent })
      })
      if (res.ok) {
        setTccSavedContent(tccContent)
        setSavingStatus("saved")
        setTimeout(() => setSavingStatus("idle"), 2000)
        trackEvent('MANUAL_SAVE_TCC', { plan: userPlan })
      } else {
        setSavingStatus("error")
      }
    } catch(e) {
      setSavingStatus("error")
    }
  }

  const handleSendPrompt = async (forcedPrompt?: string) => {
    const text = forcedPrompt || inputVal
    if (!text.trim() || isTyping) return

    if (dailyLimit < Infinity && getDailyCount() >= dailyLimit) {
      setLimitOpen(true)
      return
    }

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: text }
    setMessages(prev => [...prev, userMsg])
    if (!forcedPrompt) setInputVal("")
    setIsTyping(true)
    setActiveTab("chat")

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tccId: id, message: text, devPlanOverride: userPlan }),
      })
      const data = await res.json()

      const botMsg: ChatMessage = {
        id: data.id || (Date.now().toString() + "bot"),
        role: "bot",
        content: data.content,
        hasEditor: data.content.length > 300,
        editorContent: data.content,
        timestamp: data.timestamp,
        userPrompt: text, // Store the prompt used
      }
      setMessages(prev => [...prev, botMsg])
      incrementDailyCount()
      fetchStats()
      if (dailyLimit < Infinity && getDailyCount() >= dailyLimit) setLimitOpen(true)
    } catch (e) {
      console.error(e)
    } finally {
      setIsTyping(false)
    }
  }

  // File Upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (attachmentsMeta && attachmentsMeta.count >= attachmentsMeta.limit) {
      const limitMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "bot",
        content: `⚠️ Limite de ${attachmentsMeta.limit} anexos atingido no plano ${userPlan}. Faça upgrade para adicionar mais referências ao seu TCC.`,
      }
      setMessages(prev => [...prev, limitMsg])
      setActiveTab("chat")
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }
    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    try {
      await fetch(`/api/tcc/${id}/attachments`, { method: "POST", body: formData })
      const uploadMsg: ChatMessage = { id: Date.now().toString(), role: "bot", content: `📎 Arquivo "${file.name}" anexado com sucesso.` }
      setMessages(prev => [...prev, uploadMsg])
      fetchAttachments()
    } catch (err) { } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // AI Main Actions Handlers
  const handleInsertDocument = (suggestionHtml: string, mode: 'cursor' | 'end' | 'replace' = 'cursor') => {
      if (!editorRef.current) return
      
      const editor = editorRef.current
      if (mode === 'cursor') {
          editor.chain().focus().insertContent(suggestionHtml).run()
      } else if (mode === 'replace') {
          editor.chain().focus().insertContent(suggestionHtml).run() // In Tiptap, insertContent updates selection if any
      } else {
          editor.chain().focus('end').insertContent(suggestionHtml).run()
      }
      trackEvent('INSERT_SUGGESTION_DOCUMENT', { plan: userPlan, mode })
  }

  const handleApplyAiAction = (action: string, resultHtml: string) => {
      // In this new paradigm, Toolbar acts on Document Content directly
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
            isVip ? "bg-amber-500/20 text-amber-400" : userPlan === "PRO" ? "bg-white/15 text-white/80" : "bg-white/[0.07] text-white/50 border border-white/[0.10]"
          )}
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {userPlan === "FREE" ? "Free" : userPlan}
        </div>
      </nav>

      {/* ── O Documento Central (The TCC) ── */}
      <main className="flex-1 flex flex-col relative min-w-0 bg-[#0F0F0E]">
        {/* Superior Header */}
        <header className="h-[60px] border-b border-white/[0.06] bg-[#111110] flex items-center justify-between px-6 shrink-0 shadow-sm z-10 w-full">
            <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center">
                    <FileText size={16} className="text-white/60" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="font-bold text-sm text-white/90 leading-tight">{tccMeta?.title || "Seu TCC"}</h1>
                        <div className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase", isVip ? "bg-amber-500/20 text-amber-400" : userPlan === "PRO" ? "bg-white/15 text-white/80" : "bg-white/[0.07] text-white/50")}>
                            {userPlan}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-white/40 font-medium">{tccMeta?.course || tccMeta?.institution || "—"}</span>
                        <div className="w-1 h-1 rounded-full bg-white/20" />
                        <div className="flex items-center gap-1.5 text-[10px]">
                            {savingStatus === "saving" && <><Loader2 size={10} className="animate-spin text-amber-500" /><span className="text-amber-500">Salvando...</span></>}
                            {savingStatus === "saved" && <><CheckCircle2 size={10} className="text-emerald-500" /><span className="text-emerald-500">Salvo em nuvem</span></>}
                            {savingStatus === "error" && <><AlertCircle size={10} className="text-red-500" /><span className="text-red-500">Erro ao salvar</span></>}
                            {savingStatus === "idle" && tccContent !== tccSavedContent && (
                                <button 
                                    onClick={handleManualSave}
                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 transition-colors border border-amber-500/20 font-bold"
                                >
                                    <Save size={10} /> Salvar Agora
                                </button>
                            )}
                            {savingStatus === "idle" && tccContent === tccSavedContent && <span className="text-white/30">Atualizado</span>}
                        </div>
                    </div>
                </div>
            </div>
            {/* Quick Actions Global */}
            <div className="flex items-center gap-2">
                {/* Embedded global AiActionToolbar modifying the entire document implicitly */}
                <div className="bg-transparent border-none pr-3 py-0">
                    <AiActionToolbar 
                        userPlan={userPlan}
                        content={tccContent}
                        onApplyAction={handleApplyAiAction}
                        onUpgrade={() => setUpgradeOpen(true)}
                        tccId={String(id)}
                        context={tccMeta ? Object.values(tccMeta).join(' ') : ""}
                    />
                </div>
            </div>
        </header>

        {/* Editor Wrapper */}
        <div className="flex-1 overflow-y-auto custom-scroll w-full flex justify-center py-10 bg-[#0A0A09]">
           <div className="w-full max-w-[850px] mx-4 sm:mx-8">
              {/* This mimics a real Google Document page effect visually */}
              <div className="w-full bg-[#111110] border border-white/[0.08] shadow-2xl rounded-sm min-h-[90vh] py-0">
                 <EditableRichText 
                     value={tccContent} 
                     onChange={setTccContent} 
                     editorRef={editorRef}
                     className="border-none shadow-none bg-transparent"
                 />
              </div>
           </div>
        </div>
      </main>

      {/* ── Painel Assistente Lateral (Right Sidebar) ── */}
      <aside className="w-[360px] shrink-0 border-l border-white/[0.06] bg-[#111110] flex flex-col z-20 relative shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
        {/* Tab Headers */}
        <div className="flex items-center border-b border-white/[0.06] px-1 pt-1 shrink-0 bg-[#161615]">
            <button 
                onClick={() => setActiveTab("chat")}
                className={cn("flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2", activeTab === "chat" ? "border-amber-500 text-amber-400" : "border-transparent text-white/40 hover:text-white/70")}
            >
               <span className="flex items-center justify-center gap-2"><BrainCircuit size={14}/> Sugestões</span>
            </button>
            <button 
                onClick={() => setActiveTab("metricas")}
                className={cn("flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2", activeTab === "metricas" ? "border-amber-500 text-amber-400" : "border-transparent text-white/40 hover:text-white/70")}
            >
               Métricas
            </button>
        </div>

        {/* Tab Body: Metrics */}
        {activeTab === "metricas" && (
            <div className="flex-1 overflow-y-auto custom-scroll">
                 <TccSidebar
                    stats={stats}
                    userPlan={userPlan}
                    tccId={String(id)}
                    onUpgrade={() => setUpgradeOpen(true)}
                    onExport={() => {
                    trackEvent('EXPORT_CLICK', { plan: userPlan, hasContent: !!tccContent })
                    if (userPlan === "FREE") setExportOpen(true)
                    else handleWatermarkedExport()
                 }}
                />
            </div>
        )}

        {/* Tab Body: Chat / Assistant Workflow */}
        {activeTab === "chat" && (
            <>
                <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-5 pb-[140px]">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40 px-4">
                            <Wand2 size={32} className="mb-4" />
                            <p className="text-sm">Selecione uma ação rápida ou peça para a IA gerar conteúdo para o seu TCC.</p>
                        </div>
                    )}

                    <AnimatePresence>
                        {messages.map(m => (
                            <motion.div key={m.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={cn("flex flex-col w-full", m.role === "user" ? "items-end" : "items-start")}>
                                {m.role === "user" ? (
                                    <div className="max-w-[85%] px-4 py-3 text-[13px] bg-[#1E1D19] border border-white/[0.08] rounded-[1rem_0_1rem_1rem] text-white/90 leading-relaxed shadow-sm">
                                        {m.content}
                                    </div>
                                ) : (
                                    // NOVO FORMATO: CARD DE SUGESTÃO
                                    <div className="w-full bg-[#181816] border-2 border-dashed border-amber-500/30 rounded-xl overflow-hidden shadow-lg mt-2 relative group flex flex-col">
                                        <div className="px-3 py-2 bg-amber-500/10 border-b border-amber-500/10 flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-amber-500 tracking-widest uppercase">
                                                <Sparkles size={12} /> Sugestão da IA
                                            </div>
                                            <button 
                                                onClick={() => setMessages(msgs => msgs.filter(x => x.id !== m.id))}
                                                className="text-amber-500/50 hover:text-red-400 transition-colors flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold"
                                                title="Descartar sugestão"
                                            >
                                                <Trash2 size={12} /> Descartar
                                            </button>
                                        </div>
                                        <div className="p-4 text-[13px] leading-relaxed text-slate-300 font-serif overflow-y-auto max-h-[300px] custom-scroll relative">
                                            {/* Preview mode of the text to feel less like an immense block */}
                                            <div dangerouslySetInnerHTML={{ __html: m.editorContent || m.content }} />
                                        </div>
                                        
                                        {/* Action Bar inside the Card */}
                                        <div className="p-2 border-t border-white/[0.04] bg-[#141413] flex flex-col gap-2">
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleInsertDocument(m.editorContent || m.content, 'cursor')}
                                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 hover:bg-white/[0.06] text-white/70 text-[11px] font-bold rounded-lg transition-colors border border-white/[0.08]"
                                                    title="Inserir onde o cursor está"
                                                >
                                                    <Hand size={14} /> No cursor
                                                </button>
                                                <button 
                                                    onClick={() => handleInsertDocument(m.editorContent || m.content, 'replace')}
                                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 hover:bg-white/[0.06] text-white/70 text-[11px] font-bold rounded-lg transition-colors border border-white/[0.08]"
                                                    title="Substituir texto selecionado"
                                                >
                                                    <Plus size={14} /> Substituir
                                                </button>
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleInsertDocument(m.editorContent || m.content, 'end')}
                                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-bold rounded-lg transition-colors"
                                                >
                                                    <ArrowDownToLine size={14} /> Adicionar ao final
                                                </button>
                                                {m.userPrompt && (
                                                    <button 
                                                        onClick={() => {
                                                            setMessages(msgs => msgs.filter(x => x.id !== m.id))
                                                            handleSendPrompt(m.userPrompt)
                                                        }}
                                                        className="px-3 flex items-center justify-center bg-white/[0.05] hover:bg-white/[0.1] text-white/60 rounded-lg transition-colors border border-white/[0.08]"
                                                        title="Regerar sugestão"
                                                    >
                                                        <RotateCcw size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {isTyping && (
                        <div className="flex gap-1.5 px-4"><span className="w-1.5 h-1.5 rounded-full bg-amber-500/50 animate-bounce" /><span className="w-1.5 h-1.5 rounded-full bg-amber-500/50 animate-bounce delay-75" /><span className="w-1.5 h-1.5 rounded-full bg-amber-500/50 animate-bounce delay-150" /></div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Chat Input Pinned at Bottom */}
                <div className="absolute bottom-0 left-0 right-0 bg-[#111110] border-t border-white/[0.06] p-3 shadow-2xl z-10 space-y-2">
                    {/* Quick Guided Continuation Prompts */}
                    <div className="flex gap-2 overflow-x-auto pb-1 custom-scroll">
                        <button onClick={() => handleSendPrompt("Continue a introdução deste TCC")} disabled={isTyping} className="shrink-0 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[10px] text-white/60 font-medium whitespace-nowrap transition-colors flex items-center gap-1.5">
                            <Plus size={10} /> Continuar Introdução
                        </button>
                        <button onClick={() => handleSendPrompt("Melhore a coesão geral dos parágrafos selecionados do TCC")} disabled={isTyping} className="shrink-0 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[10px] text-white/60 font-medium whitespace-nowrap transition-colors flex items-center gap-1.5">
                            <RefreshCw size={10} /> Melhorar Parágrafos
                        </button>
                    </div>

                    <div className="relative">
                        <textarea
                            value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendPrompt() } }}
                            placeholder="Peça para gerar texto ou revisar..."
                            className="w-full bg-[#181816] border border-white/[0.08] rounded-xl pl-10 pr-10 py-3 text-[13px] text-white/90 placeholder:text-white/30 focus:outline-none focus:border-amber-500/30 resize-none shadow-inner" rows={1}
                        />
                        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1.5 text-white/30 hover:text-white/60">
                            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleUpload} accept=".pdf,.doc,.docx" className="hidden" />
                        <button onClick={() => handleSendPrompt()} disabled={!inputVal.trim() || isTyping} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400 disabled:opacity-30 disabled:bg-white/10 disabled:text-white/30 transition-all">
                            <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            </>
        )}
      </aside>

      {/* ── Modals ── */}
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} onPricing={() => { router.push("/pricing"); setUpgradeOpen(false) }} currentPlan={userPlan} />
      <LimitModal open={limitOpen} onClose={() => setLimitOpen(false)} onUpgrade={() => { setLimitOpen(false); setUpgradeOpen(true) }} dailyLimit={dailyLimit} planName={userPlan === "FREE" ? "gratuito" : userPlan} />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} onUpgrade={() => { setExportOpen(false); setUpgradeOpen(true) }} onExport={() => { handleWatermarkedExport(); setExportOpen(false) }} />
      <DevPlanSwitcher />
    </div>
  )
}
