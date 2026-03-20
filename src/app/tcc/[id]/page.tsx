"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, FileText, Menu, X,
  Loader2, AlertCircle, ArrowRight, Paperclip,
  CheckCircle2, Clock, Crown, Download,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { TccSidebar } from "@/components/TccSidebar"
import { EditableRichText } from "@/components/EditableRichText"
import { DevPlanSwitcher } from "@/components/DevPlanSwitcher"
import { useUserPlan } from "@/hooks/useUserPlan"
import { getDailyMessageLimit } from "@/lib/plan"

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
}

function getDailyKey(userId: string, plan: string) {
  return `teseo.daily.${userId}.${plan}.${new Date().toISOString().slice(0, 10)}`
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function UpgradeModal({ open, onClose, onPricing, currentPlan }: {
  open: boolean; onClose: () => void; onPricing: () => void; currentPlan: string
}) {
  const isPro = currentPlan === "PRO"
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={e => { if (e.target === e.currentTarget) onClose() }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative w-full max-w-md bg-[#1a1a18] rounded-2xl border border-white/[0.1] p-7 space-y-5">
            <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-white/[0.08] rounded-lg transition-colors">
              <X size={14} className="text-white/40" />
            </button>

            <div className="space-y-1">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                {isPro ? "Upgrade para VIP" : "Escolha seu plano"}
              </p>
              <h2 className="text-xl font-bold text-white">
                {isPro ? "O melhor resultado para seu TCC" : "Escreva seu TCC sem limites"}
              </h2>
            </div>

            {/* FREE → show PRO + VIP side by side */}
            {!isPro && (
              <div className="grid grid-cols-2 gap-3">
                {/* PRO */}
                <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.03] space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">PRO</p>
                    <p className="text-lg font-black text-white leading-none mt-1">R$ 200</p>
                    <p className="text-[10px] text-white/30 mt-0.5">por TCC</p>
                  </div>
                  <ul className="space-y-1.5">
                    {["50 mensagens/dia", "Revisão por cap.", "PDF sem marca"].map(f => (
                      <li key={f} className="text-[11px] text-white/45 flex items-center gap-1.5">
                        <CheckCircle2 size={10} className="text-white/25 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <button onClick={onPricing} className="w-full py-2 text-[11px] font-bold border border-white/[0.12] rounded-lg text-white/60 hover:bg-white/[0.06] transition-colors">
                    Ver PRO
                  </button>
                </div>
                {/* VIP */}
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] space-y-3 relative">
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
                    Premium
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">VIP</p>
                    <p className="text-lg font-black text-white leading-none mt-1">R$ 1.000</p>
                    <p className="text-[10px] text-white/30 mt-0.5">2 TCCs</p>
                  </div>
                  <ul className="space-y-1.5">
                    {["Ilimitado", "Revisão completa", "Consistência global"].map(f => (
                      <li key={f} className="text-[11px] text-white/70 flex items-center gap-1.5">
                        <CheckCircle2 size={10} className="text-amber-400 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <button onClick={onPricing} className="w-full py-2 text-[11px] font-bold bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors">
                    Ver VIP
                  </button>
                </div>
              </div>
            )}

            {/* PRO → show only VIP upgrade */}
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
                  {["Mensagens ilimitadas", "2 projetos simultâneos", "Revisão completa do trabalho", "Consistência global automática", "50 uploads de referências", "Suporte via WhatsApp"].map(f => (
                    <li key={f} className="text-sm text-white/65 flex items-center gap-2">
                      <CheckCircle2 size={12} className="text-amber-400 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <button onClick={onPricing}
                className="w-full py-3 bg-white text-[#0F0F0E] font-bold text-sm rounded-xl hover:opacity-80 transition-opacity">
                {isPro ? "Fazer upgrade para VIP" : "Ver planos e preços"}
              </button>
              <button onClick={onClose} className="w-full py-2.5 text-sm text-white/35 hover:text-white/60 transition-colors">
                Continuar no plano atual
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function LimitModal({ open, onClose, onUpgrade, dailyLimit, planName }: {
  open: boolean; onClose: () => void; onUpgrade: () => void; dailyLimit: number; planName: string
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={e => { if (e.target === e.currentTarget) onClose() }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-sm bg-[#1a1a18] rounded-2xl border border-white/[0.1] p-7 text-center space-y-5">
            <div className="w-12 h-12 rounded-full bg-white/[0.05] border border-white/[0.07] flex items-center justify-center mx-auto">
              <Clock size={20} className="text-white/40" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-white">Limite diário atingido</h2>
              <p className="text-sm text-white/50 leading-relaxed">
                Você usou suas {dailyLimit} mensagens de hoje no plano {planName}.
                Faça upgrade para continuar agora, ou aguarde 24h para o limite renovar.
              </p>
            </div>
            <div className="space-y-2">
              <button onClick={() => { onUpgrade(); onClose() }}
                className="w-full py-3 bg-white text-[#0F0F0E] font-bold text-sm rounded-xl hover:opacity-80 transition-opacity">
                {planName === "PRO" ? "Fazer upgrade para VIP" : "Fazer upgrade"}
              </button>
              <button onClick={onClose} className="w-full py-2.5 text-sm text-white/35 hover:text-white/60 transition-colors">
                Voltar amanhã
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ExportModal({ open, onClose, onExport, onUpgrade }: {
  open: boolean; onClose: () => void; onExport: () => void; onUpgrade: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={e => { if (e.target === e.currentTarget) onClose() }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-sm bg-[#1a1a18] rounded-2xl border border-white/[0.1] p-7 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/[0.06] grid place-items-center shrink-0">
                <Download size={16} className="text-white/50" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Exportar TCC</h2>
                <p className="text-[11px] text-white/40">Plano gratuito</p>
              </div>
            </div>
            <p className="text-sm text-white/50 leading-relaxed">
              Seu PDF será exportado com a marca d&apos;água do Teseo. Com o{" "}
              <span className="text-white/70 font-medium">Plano PRO</span>, você exporta sem marca d&apos;água, sem limites e com formatação ABNT completa.
            </p>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5 flex items-center gap-3">
              <Crown size={14} className="text-white/30 shrink-0" />
              <p className="text-[11px] text-white/40">
                PRO — exportação ilimitada, sem marca d&apos;água, formatação ABNT automática
              </p>
            </div>
            <div className="space-y-2">
              <button onClick={() => { onUpgrade(); onClose() }}
                className="w-full py-3 bg-white text-[#0F0F0E] font-bold text-sm rounded-xl hover:opacity-80 transition-opacity">
                Fazer upgrade PRO
              </button>
              <button onClick={() => { onExport(); onClose() }}
                className="w-full py-2.5 text-sm text-white/35 hover:text-white/60 transition-colors">
                Exportar com marca d&apos;água
              </button>
            </div>
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

  // Lock body scroll for fullscreen workspace
  React.useEffect(() => {
    document.documentElement.style.overflow = "hidden"
    return () => { document.documentElement.style.overflow = "" }
  }, [])

  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [inputVal, setInputVal] = React.useState("")
  const [isTyping, setIsTyping] = React.useState(false)
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [tccMeta, setTccMeta] = React.useState<TccMeta | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [rightOpen, setRightOpen] = React.useState(true)
  const [uploading, setUploading] = React.useState(false)
  const [attachmentsMeta, setAttachmentsMeta] = React.useState<{ count: number; limit: number } | null>(null)
  const [editedPercent, setEditedPercent] = React.useState(0)
  const [upgradeOpen, setUpgradeOpen] = React.useState(false)
  const [limitOpen, setLimitOpen] = React.useState(false)
  const [exportOpen, setExportOpen] = React.useState(false)

  const handleWatermarkedExport = React.useCallback(() => {
    const botMessages = messages.filter(m => m.role === "bot")
    if (!botMessages.length) {
      alert("Nenhum conteúdo gerado ainda para exportar.")
      return
    }
    const stripHtml = (html: string) =>
      html.replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim()
    const body = botMessages
      .map(m => stripHtml(m.editorContent || m.content))
      .filter(Boolean)
      .join("\n\n")
    const title = tccMeta?.title ?? "TCC"
    const meta = [tccMeta?.course, tccMeta?.institution, tccMeta?.workType, tccMeta?.norma]
      .filter(Boolean).join(" · ")
    const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>${title} — Teseo FREE</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Times New Roman", serif; max-width: 780px; margin: 60px auto; padding: 0 48px 80px; line-height: 1.9; color: #111; }
h1 { font-size: 16pt; text-align: center; margin-bottom: 6px; }
.meta { text-align: center; color: #666; font-size: 10pt; margin-bottom: 48px; }
.body { font-size: 12pt; white-space: pre-wrap; word-break: break-word; }
.watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-40deg); font-size: 80pt; font-weight: 900; color: rgba(0,0,0,0.04); pointer-events: none; white-space: nowrap; font-family: sans-serif; }
.footer { margin-top: 56px; padding-top: 16px; border-top: 1px solid #ddd; text-align: center; font-size: 9pt; color: #aaa; }
@media print { .watermark { color: rgba(0,0,0,0.06); } }
</style></head>
<body>
<div class="watermark">TESEO FREE</div>
<h1>${title}</h1>
${meta ? `<div class="meta">${meta}</div>` : ""}
<div class="body">${body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
<div class="footer">Exportado pelo Teseo (plano gratuito) · Versão com marca d'água · teseo.com.br</div>
</body></html>`
    const win = window.open("", "_blank")
    if (!win) {
      alert("Permita popups para exportar o PDF.")
      return
    }
    win.document.documentElement.innerHTML = html
    win.focus()
    setTimeout(() => { win.print() }, 400)
  }, [messages, tccMeta])

  const userId = (session?.user as { id?: string } | undefined)?.id ?? "anon"

  const getDailyCount = React.useCallback(() => {
    if (typeof window === "undefined") return 0
    return parseInt(localStorage.getItem(getDailyKey(userId, userPlan)) || "0", 10)
  }, [userId, userPlan])

  const incrementDailyCount = React.useCallback(() => {
    if (typeof window === "undefined") return
    localStorage.setItem(getDailyKey(userId, userPlan), String(getDailyCount() + 1))
  }, [userId, userPlan, getDailyCount])
  const dirtyRef = React.useRef<Record<string, { content: string; lastSent: string }>>({})

  const chatEndRef = React.useRef<HTMLDivElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

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
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.createdAt,
        hasEditor: m.role === "bot" && m.content.length > 500,
        chapterTitle: "Conteúdo Gerado",
        editorContent: m.content,
        originalContent: m.content,
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
      if (data && !data.error) setTccMeta(data)
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

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  const handleSend = async () => {
    if (!inputVal.trim() || isTyping) return

    // Check daily limit (VIP = unlimited)
    if (dailyLimit < Infinity && getDailyCount() >= dailyLimit) {
      setLimitOpen(true)
      return
    }

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: inputVal }
    setMessages(prev => [...prev, userMsg])
    setInputVal("")
    setIsTyping(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tccId: id, message: inputVal }),
      })
      const data = await res.json()

      const botMsg: ChatMessage = {
        id: data.id || (Date.now().toString() + "bot"),
        role: "bot",
        content: data.content,
        hasEditor: true,
        chapterTitle: "Novo Conteúdo",
        editorContent: data.content,
        originalContent: data.content,
        timestamp: data.timestamp,
      }
      setMessages(prev => [...prev, botMsg])
      incrementDailyCount()
      fetchStats()

      // After limit is reached on this send, show upgrade hint
      if (dailyLimit < Infinity && getDailyCount() >= dailyLimit) {
        setLimitOpen(true)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsTyping(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (attachmentsMeta && attachmentsMeta.count >= attachmentsMeta.limit) {
      alert(`Limite de anexos atingido (${attachmentsMeta.count}/${attachmentsMeta.limit}).`)
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch(`/api/tcc/${id}/attachments`, { method: "POST", body: formData })
      const data = await res.json()
      if (data.error) {
        alert(`Erro: ${data.error}`)
      } else {
        const uploadMsg: ChatMessage = {
          id: Date.now().toString(),
          role: "bot",
          content: `📎 Arquivo "${file.name}" anexado com sucesso! Agora posso usá-lo como referência para seu TCC.`,
        }
        setMessages(prev => [...prev, uploadMsg])
        fetchAttachments()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const computeEditedPercent = React.useCallback((original: string, edited: string) => {
    const toWords = (s: string) =>
      (s || "").toLowerCase().replace(/<[^>]*>/g, " ").match(/[a-zA-ZÀ-ÿ0-9_]+/g) ?? []

    const a = new Set(toWords(original))
    const b = new Set(toWords(edited))
    if (a.size === 0 && b.size === 0) return 0
    const union = new Set([...a, ...b]).size
    let inter = 0
    for (const w of a) if (b.has(w)) inter++
    const similarity = union ? inter / union : 1
    const pct = Math.round((1 - similarity) * 100)
    return Math.max(0, Math.min(100, pct))
  }, [])

  React.useEffect(() => {
    if (!id) return
    const interval = setInterval(async () => {
      const dirty = dirtyRef.current
      const entries = Object.entries(dirty).filter(([, v]) => v.content !== v.lastSent)
      if (!entries.length) return
      for (const [messageId, { content }] of entries) {
        try {
          const res = await fetch(`/api/tcc/${id}/content`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId, content }),
          })
          const data = await res.json()
          if (!data?.error && dirtyRef.current[messageId]) dirtyRef.current[messageId].lastSent = content
        } catch (e) { console.error(e) }
      }
      fetchStats()
    }, 10000)
    return () => clearInterval(interval)
  }, [id, fetchStats])

  const isAuthLow = (100 - (stats?.plagiarism || 0)) < 50

  if (loading) return (
    <div className="h-screen bg-[#0F0F0E] flex items-center justify-center">
      <Loader2 className="w-7 h-7 text-white/40 animate-spin" />
    </div>
  )

  return (
    <div className="h-[100dvh] bg-[#0F0F0E] text-[#F1F0EC] overflow-hidden flex">

      {/* ── Left nav rail ── */}
      <nav className="w-[52px] shrink-0 flex flex-col items-center py-4 gap-3 border-r border-white/[0.06] z-20">
        <button
          onClick={() => router.push("/dashboard")}
          className="p-2 hover:bg-white/[0.08] rounded-lg transition-colors"
          title="Voltar ao dashboard"
        >
          <ArrowLeft size={16} />
        </button>

        {/* User initial */}
        <div className="w-8 h-8 rounded-full bg-white/[0.10] grid place-items-center mt-1 shrink-0">
          <span className="text-white/80 font-bold text-sm leading-none uppercase">
            {(session?.user?.name || session?.user?.email || "?")[0]}
          </span>
        </div>

        <div className="flex-1" />

        {/* Plan badge — vertical */}
        <div
          className={cn(
            "px-2 py-1 rounded-md text-[9px] font-bold tracking-widest uppercase select-none",
            userPlan === "VIP"
              ? "bg-amber-500/20 text-amber-400"
              : userPlan === "PRO"
              ? "bg-white/15 text-white/80"
              : "bg-white/[0.07] text-white/50 border border-white/[0.10]"
          )}
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          title={`Plano ${userPlan}`}
        >
          {userPlan === "FREE" ? "Free" : userPlan}
        </div>

        <button
          onClick={() => setRightOpen(v => !v)}
          className="p-2 hover:bg-white/[0.08] rounded-lg transition-colors"
          title="Abrir/fechar painel"
        >
          <Menu size={16} />
        </button>
      </nav>

      <div className="flex-1 flex overflow-hidden relative">
        {/* ── Chat area ── */}
        <main className="flex-1 flex flex-col relative min-w-0">
          <div className="flex-1 overflow-y-auto custom-scroll p-4 pb-32 space-y-5 max-w-3xl mx-auto w-full">

            {/* Empty state */}
            {messages.length === 0 && (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center space-y-5">
                {tccMeta && (
                  <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-5 py-4 text-left max-w-sm w-full space-y-1">
                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">
                      Contexto do projeto
                    </div>
                    <p className="text-sm font-medium text-white/80 leading-snug">&ldquo;{tccMeta.title}&rdquo;</p>
                    <p className="text-xs text-white/40">{tccMeta.course} · {tccMeta.institution}</p>
                    {tccMeta.objective && (
                      <p className="text-xs text-white/40 pt-1 line-clamp-2">{tccMeta.objective}</p>
                    )}
                  </div>
                )}

                <p className="text-sm text-white/40 max-w-sm">
                  Descreva o que deseja escrever ou pergunte algo sobre seu TCC.
                </p>
              </div>
            )}

            {/* Messages */}
            <AnimatePresence>
              {messages.map(m => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex flex-col w-full", m.role === "user" ? "items-end" : "items-start")}
                >
                  <div className={cn(
                    "max-w-[85%] sm:max-w-[75%] px-4 py-3 text-[14px] leading-relaxed",
                    m.role === "user"
                      ? "bg-white/[0.08] border border-white/[0.12] rounded-[1rem_0_1rem_1rem] text-white/90"
                      : "bg-white/[0.05] border border-white/[0.08] rounded-[0_1rem_1rem_1rem] text-white/80"
                  )}>
                    {m.content}
                  </div>

                  {m.hasEditor && (
                    <div className="mt-3 w-full bg-[#141413] border border-white/[0.08] rounded-2xl overflow-hidden shadow-brand relative group">
                      {userPlan === "PRO" && isAuthLow && (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-10 flex flex-col items-center justify-center p-6 text-center">
                          <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
                          <h3 className="text-base font-bold">Bloqueio de Autoria</h3>
                          <p className="text-sm text-white/50 mt-1.5">Originalidade inferior a 50%. PDF bloqueado até você realizar edições significativas.</p>
                        </div>
                      )}
                      <div className="bg-white/[0.03] px-4 py-2.5 flex items-center justify-between border-b border-white/[0.06]">
                        <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                          <FileText size={14} className="text-white/40" /> {m.chapterTitle}
                        </div>
                        <div className="text-[10px] font-bold tracking-widest text-white/30">
                          AUTORIA {editedPercent}%
                        </div>
                      </div>
                      <EditableRichText
                        value={m.editorContent || ""}
                        onChange={val => {
                          const original = m.originalContent || m.content || ""
                          setMessages(prev =>
                            prev.map(msg => msg.id === m.id ? { ...msg, editorContent: val } : msg)
                          )
                          const pct = computeEditedPercent(original, val)
                          setEditedPercent(pct)
                          const curr = dirtyRef.current[m.id]
                          dirtyRef.current[m.id] = { content: val, lastSent: curr?.lastSent ?? (m.editorContent || "") }
                        }}
                      />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex items-start max-w-[75%]">
                <div className="bg-white/[0.05] border border-white/[0.08] rounded-[0_1rem_1rem_1rem] px-4 py-3 flex gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* ── Input bar ── */}
          <div className="absolute bottom-5 left-0 right-0 px-4">
            <div className="max-w-3xl mx-auto">
              <div className="relative">
                <textarea
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
                  }}
                  placeholder="Descreva o que deseja escrever ou alterar…"
                  className="w-full bg-[#1A1A18]/95 backdrop-blur-xl border border-white/[0.09] rounded-2xl pl-11 pr-11 py-3.5 text-[14px] text-white/90 placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none overflow-hidden shadow-2xl"
                  rows={1}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 text-white/30 hover:text-white/60 transition-colors"
                >
                  {uploading ? <Loader2 size={17} className="animate-spin" /> : <Paperclip size={17} />}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleUpload}
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputVal.trim() || isTyping}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-white text-[#0F0F0E] rounded-xl hover:opacity-80 disabled:opacity-30 transition-opacity"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* ── Right sidebar ── */}
        <AnimatePresence>
          {rightOpen && (
            <motion.aside
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              transition={{ type: "spring", damping: 26 }}
              className="w-[280px] border-l border-white/[0.06] bg-[#0F0F0E] flex flex-col z-10 overflow-y-auto custom-scroll"
            >
              {/* Project context header in sidebar */}
              {tccMeta && (
                <div className="px-5 pt-5 pb-4 border-b border-white/[0.06] space-y-1">
                  <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">
                    Projeto
                  </div>
                  <p className="text-xs font-semibold text-white/80 leading-snug line-clamp-2">
                    {tccMeta.title}
                  </p>
                  <p className="text-[11px] text-white/40">{tccMeta.course} · {tccMeta.institution}</p>
                  {(tccMeta.workType || tccMeta.norma) && (
                    <p className="text-[11px] text-white/30">
                      {[tccMeta.workType, tccMeta.norma].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              )}
              <TccSidebar
                stats={stats}
                userPlan={userPlan}
                tccId={String(id)}
                humanAuthorshipOverride={editedPercent}
                onUpgrade={() => setUpgradeOpen(true)}
                onExport={() => {
                  if (userPlan === "FREE") setExportOpen(true)
                  // PRO/VIP: future PDF generation
                }}
              />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* ── Modals ── */}
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        onPricing={() => { router.push("/pricing"); setUpgradeOpen(false) }}
        currentPlan={userPlan}
      />
      <LimitModal
        open={limitOpen}
        onClose={() => setLimitOpen(false)}
        onUpgrade={() => { setLimitOpen(false); setUpgradeOpen(true) }}
        dailyLimit={dailyLimit}
        planName={userPlan === "FREE" ? "gratuito" : userPlan}
      />
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onUpgrade={() => { setExportOpen(false); setUpgradeOpen(true) }}
        onExport={() => { handleWatermarkedExport(); setExportOpen(false) }}
      />
      <DevPlanSwitcher />
    </div>
  )
}
