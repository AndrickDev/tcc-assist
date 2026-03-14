"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowLeft, Search, CheckCircle2, FileText, Menu, X, 
  Maximize2, Bold, Italic, Underline, Heading1, Heading2, 
  List, Quote, Loader2, Plus, AlertCircle, MessageSquare,
  ArrowRight
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { TccSidebar } from "@/components/TccSidebar"

interface ChatMessage {
    id: string
    role: "user" | "bot"
    content: string
    hasEditor?: boolean
    chapterTitle?: string
    editorContent?: string
    timestamp?: string
}

interface Stats {
    progress: { name: string; p: number }[]
    plagiarism: number
    totalPages: number
    status: string
}

export default function TccWorkspacePage() {
  const { data: session } = useSession()
  const { id } = useParams()
  const router = useRouter()
  
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [inputVal, setInputVal] = React.useState("")
  const [isTyping, setIsTyping] = React.useState(false)
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [rightOpen, setRightOpen] = React.useState(true)
  
  const chatEndRef = React.useRef<HTMLDivElement>(null)

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/tcc/${id}/stats`)
      const data = await res.json()
      if (!data.error) setStats(data)
    } catch (e) { console.error(e) }
  }

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/tcc/${id}/messages`)
      const data = await res.json()
      setMessages(data.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
          hasEditor: m.role === "bot" && m.content.length > 500,
          chapterTitle: "Conteúdo Gerado",
          editorContent: m.content
      })))
    } catch (e) { console.error(e) }
  }

  React.useEffect(() => {
    if (!id) return
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchMessages(), fetchStats()])
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
        id: Date.now().toString() + "bot",
        role: "bot",
        content: data.content,
        hasEditor: true,
        chapterTitle: "Novo Conteúdo",
        editorContent: data.content,
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

  const userPlan = (session?.user as any)?.plan || 'FREE'
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
            <div className="flex-1 overflow-y-auto custom-scroll p-4 pb-24 space-y-6 max-w-4xl mx-auto w-full">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                        <MessageSquare size={48} className="text-brand-purple" />
                        <p className="text-sm">Comece a conversar para gerar o conteúdo do seu TCC.</p>
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
                            </div>
                            <textarea
                                className="w-full min-h-[300px] bg-transparent p-6 text-slate-300 resize-y focus:outline-none text-[15px] leading-relaxed custom-scroll"
                                defaultValue={m.editorContent || ""}
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
                            className="w-full bg-[#1A1A2E]/90 backdrop-blur-xl border border-white/10 rounded-2xl pl-4 pr-12 py-4 text-[15px] focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple text-slate-200 resize-none overflow-hidden shadow-2xl"
                            rows={1}
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
                    <TccSidebar stats={stats} userPlan={userPlan} />
                </motion.aside>
            )}
        </AnimatePresence>
      </div>
    </div>
  )
}
