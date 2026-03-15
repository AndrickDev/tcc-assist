"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowLeft, Search, CheckCircle2, FileText, Menu, X, 
  Maximize2, Bold, Italic, Underline, Heading1, Heading2, 
  List, Quote, Loader2, Plus, AlertCircle, MessageSquare,
  ArrowRight, Paperclip, Upload
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { TccSidebar } from "@/components/TccSidebar"
import { EditableRichText } from "@/components/EditableRichText"
import Link from "next/link"
import { BrandLogo } from "@/components/brand/BrandLogo"

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

export default function TccWorkspacePage() {
  const { data: session } = useSession()
  const { id } = useParams()
  const router = useRouter()

  const displayName = React.useMemo(() => {
    const base = (session?.user?.name || session?.user?.email || "").toString().trim()
    if (base) return base.split(" ")[0]
    const writers = ["Clarice", "Machado", "Cecília", "Drummond", "Pessoa", "Saramago", "Kafka", "Woolf", "Borges", "Camus"]
    return writers[Math.floor(Math.random() * writers.length)]
  }, [session?.user?.email, session?.user?.name])
  
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [inputVal, setInputVal] = React.useState("")
  const [isTyping, setIsTyping] = React.useState(false)
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [rightOpen, setRightOpen] = React.useState(true)
  const [uploading, setUploading] = React.useState(false)
  const [attachmentsMeta, setAttachmentsMeta] = React.useState<{ count: number; limit: number } | null>(null)
  const [editedPercent, setEditedPercent] = React.useState(0)
  const dirtyRef = React.useRef<Record<string, { content: string; lastSent: string }>>({})
  
  const chatEndRef = React.useRef<HTMLDivElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const fetchStats = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/tcc/${id}/stats`)
      const data = await res.json()
      if (!data.error) setStats(data)
    } catch (e) { console.error(e) }
  }, [id])

  const fetchMessages = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/tcc/${id}/messages`)
      const data = await res.json()
      setMessages(data.map((m: { id: string; role: "user" | "bot"; content: string; createdAt: string }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
          hasEditor: m.role === "bot" && m.content.length > 500,
          chapterTitle: "Conteúdo Gerado",
          editorContent: m.content,
          originalContent: m.content
      })))
    } catch (e) { console.error(e) }
  }, [id])

  const fetchAttachments = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/tcc/${id}/attachments`, { cache: "no-store" })
      const data = await res.json()
      if (!data?.error) setAttachmentsMeta({ count: data.count ?? 0, limit: data.limit ?? 5 })
    } catch (e) { console.error(e) }
  }, [id])

  React.useEffect(() => {
    if (!id) return
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchMessages(), fetchStats(), fetchAttachments()])
      setLoading(false)
    }
    init()
    
    // Polling simulated real-time (WebSocket mock)
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [id])

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  const handleSend = async () => {
    if (!inputVal.trim() || isTyping) return
    
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
      fetchStats() // Update stats after bot reply
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
    formData.append('file', file)

    try {
        const res = await fetch(`/api/tcc/${id}/attachments`, {
            method: 'POST',
            body: formData
        })
        const data = await res.json()
        if (data.error) {
            alert(`Erro: ${data.error}`)
        } else {
            const uploadMsg: ChatMessage = {
                id: Date.now().toString(),
                role: "bot",
                content: `📎 Arquivo "${file.name}" anexado com sucesso! Agora posso usá-lo como referência para seu TCC.`
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
      (s || "")
        .toLowerCase()
        .replace(/<[^>]*>/g, " ")
        .match(/[a-zA-ZÀ-ÿ0-9_]+/g) ?? []

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
        } catch (e) {
          console.error(e)
        }
      }
      fetchStats()
    }, 10000)
    return () => clearInterval(interval)
  }, [id, fetchStats])

  const userPlan = (session?.user as { plan?: string } | undefined)?.plan || 'FREE'
  const isOverLimit = userPlan === 'FREE' && (stats?.totalPages || 0) >= 1
  const isAuthLow = (100 - (stats?.plagiarism || 0)) < 50 // Se originalidade < 50%

  if (loading) return (
      <div className="h-screen bg-[#0F0F1A] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-purple animate-spin" />
      </div>
  )

  return (
    <div className="h-[100dvh] bg-[#0F0F1A] text-[#F1F5F9] overflow-hidden flex flex-col">
      {/* HEADER */}
      <header className="h-[56px] shrink-0 bg-[#0F0F1A]/80 backdrop-blur-md border-b border-white/5 px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="p-2 hover:bg-white/10 rounded-md">
            <ArrowLeft size={20} />
          </button>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold text-white leading-tight truncate max-w-[200px]">Workspace TCC</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">{id?.slice(-8)}</p>
          </div>
        </div>

        <div className="font-extrabold text-sm tracking-tight text-gradient">✦ TRABALHO EM FOCO</div>

        <div className="flex items-center gap-3">
           <div className={cn(
               "px-3 py-1 rounded-full text-[10px] font-bold border flex items-center gap-2",
               userPlan === "VIP" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
               userPlan === "PRO" ? "bg-brand-purple/10 text-brand-purple border-brand-purple/20" :
               "bg-slate-500/10 text-slate-400 border-slate-500/20"
           )}>
               <CheckCircle2 size={12} /> PLANO {userPlan}
           </div>
           <button onClick={() => setRightOpen(!rightOpen)} className="p-2 hover:bg-white/10 rounded-md">
            <Menu size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* MAIN AREA */}
        <main className="flex-1 flex flex-col relative min-w-0">
            <div className="flex-1 overflow-y-auto custom-scroll p-4 pb-32 space-y-6 max-w-4xl mx-auto w-full">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-5">
                        <div className="text-xs px-3 py-1.5 rounded-full border border-black/10 dark:border-white/10 bg-[#F0EEE6] dark:bg-[#141413] text-black/70 dark:text-white/70">
                            Plano {userPlan === "FREE" ? "Gratuito" : userPlan} ·{" "}
                            <Link href="/pricing" className="underline hover:no-underline">Fazer upgrade</Link>
                        </div>

                        <div className="flex items-center justify-center gap-3">
                            <BrandLogo variant="icon" tone="dark" size="large" />
                            <h2 className="text-3xl md:text-4xl font-extrabold font-serif text-white/90">Olá, {displayName}</h2>
                        </div>

                        <p className="text-sm text-white/60 max-w-md">Como posso ajudar você hoje?</p>
                    </div>
                )}
                <AnimatePresence>
                {messages.map((m) => (
                    <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("flex flex-col w-full", m.role === "user" ? "items-end" : "items-start")}
                    >
                    <div className={cn(
                        "max-w-[85%] sm:max-w-[75%] p-4 text-[15px] leading-relaxed",
                        m.role === "user"
                        ? "bg-gradient-to-br from-brand-purple/40 to-brand-blue/40 border border-brand-purple/30 rounded-[1rem_0_1rem_1rem] text-white"
                        : "bg-white/[0.06] border border-white/[0.09] rounded-[0_1rem_1rem_1rem] text-slate-200"
                    )}>
                        {m.content}
                    </div>

                    {m.hasEditor && (
                        <div className="mt-4 w-full bg-[#13131F] border border-white/10 rounded-2xl overflow-hidden shadow-brand relative group">
                            {userPlan === 'PRO' && isAuthLow && (
                                <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-10 flex flex-col items-center justify-center p-6 text-center">
                                    <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                                    <h3 className="text-lg font-bold">Bloqueio de Autoria</h3>
                                    <p className="text-sm text-slate-400 mt-2">Originalidade inferior a 50%. PDF bloqueado até você realizar edições autorais significativas.</p>
                                </div>
                            )}
                            <div className="bg-white/5 px-4 py-2 flex items-center justify-between border-b border-white/5">
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                                <FileText size={16} className="text-brand-purple" /> {m.chapterTitle}
                                </div>
                                <div className="text-[10px] font-black tracking-widest text-slate-500">
                                    AUTORIA: {editedPercent}%
                                </div>
                            </div>
                            <EditableRichText
                                value={m.editorContent || ""}
                                onChange={(val) => {
                                    const original = m.originalContent || m.content || ""
                                    setMessages((prev) =>
                                      prev.map((msg) =>
                                        msg.id === m.id ? { ...msg, editorContent: val } : msg
                                      )
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
                {isTyping && (
                <div className="flex items-start max-w-[75%]">
                    <div className="bg-white/[0.06] border border-white/[0.09] rounded-[0_1rem_1rem_1rem] p-4 flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                </div>
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <div className="absolute bottom-6 left-0 right-0 px-4">
                <div className="max-w-4xl mx-auto">
                    <div className="relative">
                        <textarea
                            value={inputVal}
                            onChange={(e) => setInputVal(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                            placeholder="Descreva o que deseja escrever ou alterar..."
                            className="w-full bg-[#1A1A2E]/90 backdrop-blur-xl border border-white/10 rounded-2xl pl-12 pr-12 py-4 text-[15px] focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple text-slate-200 resize-none overflow-hidden shadow-2xl"
                            rows={1}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-brand-purple transition-colors"
                        >
                            {uploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
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
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-brand-purple text-white rounded-xl hover:bg-brand-purple/90 disabled:opacity-50 transition-colors"
                        >
                            <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </main>

        {/* SIDEBAR RIGHT */}
        <AnimatePresence>
            {rightOpen && (
                <motion.aside
                    initial={{ x: 300 }} animate={{ x: 0 }} exit={{ x: 300 }}
                    transition={{ type: "spring", damping: 25 }}
                    className="w-[300px] border-l border-white/5 bg-[#0F0F1A] flex flex-col z-10"
                >
                    <TccSidebar stats={stats} userPlan={userPlan} tccId={String(id)} humanAuthorshipOverride={editedPercent} />
                </motion.aside>
            )}
        </AnimatePresence>
      </div>
    </div>
  )
}
