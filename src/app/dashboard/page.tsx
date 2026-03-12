"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowRight, Menu, Plus, UploadCloud, FileText, Settings, User,
  Paperclip, CheckCircle2, Search, Download as DownloadIcon, X,
  Maximize2, Bold, Italic, Underline, Heading1, Heading2, List,
  Quote, LogOut, Loader2
} from "lucide-react"
import { mockTemplates, mockRefs, ChatMessage } from "@/lib/mock-data"
import { useSession, signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import { INITIAL_CONTEXT } from "@/lib/constants"

// ── Types ──────────────────────────────────────────────────────────────────────
interface Tcc {
  id: string
  title: string
  course: string
  institution: string
  status: string
  updatedAt: string
}

const WELCOME_MSG: ChatMessage = {
  id: "bot-welcome",
  role: "bot",
  content: "Olá! Qual é o tema do seu TCC?",
}

export default function DashboardPage() {
  const { data: session } = useSession()

  const [leftOpen, setLeftOpen] = React.useState(true)
  const [rightOpen, setRightOpen] = React.useState(true)
  const [messages, setMessages] = React.useState<ChatMessage[]>([WELCOME_MSG])
  const [inputVal, setInputVal] = React.useState("")
  const [isTyping, setIsTyping] = React.useState(false)
  const chatEndRef = React.useRef<HTMLDivElement>(null)

  // TCC state
  const [tccs, setTccs] = React.useState<Tcc[]>([])
  const [activeTccId, setActiveTccId] = React.useState<string | null>(null)
  const [loadingTccs, setLoadingTccs] = React.useState(true)

  // New TCC modal
  const [showNewTcc, setShowNewTcc] = React.useState(false)
  const [newTitle, setNewTitle] = React.useState("")
  const [newCourse, setNewCourse] = React.useState("")
  const [newInstitution, setNewInstitution] = React.useState("")
  const [creatingTcc, setCreatingTcc] = React.useState(false)

  // ── Responsive sidebar ────────────────────────────────────────────────────
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setRightOpen(false)
      if (window.innerWidth < 768) setLeftOpen(false)
      if (window.innerWidth >= 1024) { setLeftOpen(true); setRightOpen(true) }
    }
    window.addEventListener("resize", handleResize)
    handleResize()
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  // ── Load TCCs ─────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!session?.user?.id) return
    setLoadingTccs(true)
    fetch("/api/tcc")
      .then(r => r.json())
      .then((data: Tcc[]) => { setTccs(data); setLoadingTccs(false) })
      .catch(() => setLoadingTccs(false))
  }, [session?.user?.id])

  // ── Select TCC & load its messages ───────────────────────────────────────
  const selectTcc = async (tcc: Tcc) => {
    setActiveTccId(tcc.id)
    setMessages([{ id: "loading", role: "bot", content: "Carregando histórico..." }])
    try {
      const res = await fetch(`/api/tcc/${tcc.id}/messages`)
      const data = await res.json()
      setMessages(
        data.length > 0
          ? data.map((m: { id: string; role: "user" | "bot"; content: string; createdAt: string }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.createdAt,
            }))
          : [WELCOME_MSG]
      )
    } catch {
      setMessages([WELCOME_MSG])
    }
  }

  // ── Create new TCC ────────────────────────────────────────────────────────
  const createTcc = async () => {
    if (!newTitle || !newCourse || !newInstitution) return
    setCreatingTcc(true)
    try {
      const res = await fetch("/api/tcc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, course: newCourse, institution: newInstitution }),
      })
      const tcc: Tcc = await res.json()
      setTccs(prev => [tcc, ...prev])
      setShowNewTcc(false)
      setNewTitle(""); setNewCourse(""); setNewInstitution("")
      await selectTcc(tcc)
    } finally {
      setCreatingTcc(false)
    }
  }

  // ── Save message to DB ────────────────────────────────────────────────────
  const saveMessage = async (tccId: string, role: "user" | "bot", content: string, agent?: string) => {
    try {
      await fetch(`/api/tcc/${tccId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, content, agent }),
      })
    } catch (e) {
      console.warn("Could not persist message:", e)
    }
  }

  // ── Agent call ────────────────────────────────────────────────────────────
  const context = INITIAL_CONTEXT

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callAgent = async (agent: string, ctx: any, input: string) => {
    if (!input.trim()) return
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: input }
    setMessages(prev => [...prev, userMsg])
    setInputVal("")
    setIsTyping(true)

    if (activeTccId) await saveMessage(activeTccId, "user", input)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent, context: ctx, input }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const botMsg: ChatMessage = {
        id: Date.now().toString() + "bot",
        role: "bot",
        content: data.content,
        hasEditor: agent === "redator" || agent === "arquiteto",
        chapterTitle: agent === "arquiteto" ? "Sumário Gerado" : "Capítulo Gerado",
        editorContent: data.content,
        timestamp: data.timestamp,
      }
      setMessages(prev => [...prev, botMsg])

      if (activeTccId) await saveMessage(activeTccId, "bot", data.content, agent)
    } catch (error: unknown) {
      setMessages(prev => [...prev, {
        id: Date.now().toString() + "err",
        role: "bot",
        content: `❌ Erro: ${error instanceof Error ? error.message : String(error)}`,
      }])
    } finally {
      setIsTyping(false)
    }
  }

  const handleSend = () => {
    if (!inputVal.trim()) return
    const msgLower = inputVal.toLowerCase()
    if (msgLower.includes("referência") || msgLower.includes("bibliografia")) {
      callAgent("bibliotecario", context, inputVal)
    } else if (msgLower.includes("sumário") || msgLower.includes("capítulo")) {
      callAgent("arquiteto", context, inputVal)
    } else {
      callAgent("redator", context, inputVal)
    }
  }

  const exportPDF = async () => {
    try {
      const html2canvas = (await import("html2canvas")).default
      const jsPDF = (await import("jspdf")).default
      const el = document.getElementById("editor-content")
      if (!el) return
      const canvas = await html2canvas(el)
      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF("p", "mm", "a4")
      pdf.addImage(imgData, "PNG", 10, 10, 190, (canvas.height * 190) / canvas.width)
      pdf.save("TCC-Capitulo.pdf")
    } catch (e) { console.error("PDF Export failed", e) }
  }

  return (
    <div className="h-[100dvh] bg-[#0F0F1A] text-[#F1F5F9] overflow-hidden flex flex-col">
      {/* HEADER */}
      <header className="h-[56px] shrink-0 bg-[#0F0F1A]/80 backdrop-blur-md border-b border-white/5 px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => setLeftOpen(!leftOpen)} className="p-2 hover:bg-white/10 rounded-md xl:hidden">
            <Menu size={20} />
          </button>
          <button
            className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
            onClick={() => setShowNewTcc(true)}
          >
            <Plus size={16} /> Novo TCC
          </button>
        </div>

        <div className="font-extrabold text-sm sm:text-base tracking-tight text-gradient">✦ TCC-ASSIST</div>

        <div className="flex items-center gap-3">
          <button className="p-2 hover:bg-white/10 rounded-md hidden sm:block"><Settings size={18} /></button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-purple to-brand-blue flex items-center justify-center cursor-pointer shadow-brand text-white font-bold text-sm">
              {session?.user?.name?.[0] || session?.user?.email?.[0]?.toUpperCase() || <User size={16} />}
            </div>
            <button onClick={() => signOut()} className="p-2 text-slate-500 hover:text-red-500 transition-colors" title="Sair">
              <LogOut size={18} />
            </button>
          </div>
          <button onClick={() => setRightOpen(!rightOpen)} className="p-2 hover:bg-white/10 rounded-md lg:hidden">
            <Menu size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT SIDEBAR */}
        <AnimatePresence>
          {leftOpen && (
            <motion.aside
              initial={{ x: -250 }} animate={{ x: 0 }} exit={{ x: -250 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="absolute md:static top-0 left-0 bottom-0 w-[250px] bg-[#0F0F1A] border-r border-white/5 flex flex-col z-10"
            >
              <div className="p-4 flex-1 overflow-y-auto custom-scroll space-y-6">
                <button
                  onClick={() => setShowNewTcc(true)}
                  className="w-full py-2.5 px-4 bg-brand-purple/20 text-brand-purple hover:bg-brand-purple/30 rounded-xl font-medium text-sm border border-brand-purple/30 transition-colors flex items-center gap-2"
                >
                  <Plus size={16} /> Novo TCC
                </button>

                {/* TCC History */}
                <div>
                  <div className="text-xs font-bold text-slate-500 mb-3 px-2">RECENTES</div>
                  <div className="space-y-1">
                    {loadingTccs
                      ? <div className="px-3 py-2 text-xs text-slate-500 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Carregando...</div>
                      : tccs.length === 0
                        ? <div className="px-3 py-2 text-xs text-slate-500">Nenhum TCC ainda.</div>
                        : tccs.map(tcc => (
                          <button
                            key={tcc.id}
                            onClick={() => selectTcc(tcc)}
                            className={cn(
                              "w-full text-left py-2 px-3 rounded-lg text-sm truncate transition-colors",
                              activeTccId === tcc.id
                                ? "bg-brand-purple/20 text-brand-purple border border-brand-purple/30"
                                : "text-slate-300 hover:bg-white/5"
                            )}
                          >
                            💬 {tcc.title}
                          </button>
                        ))
                    }
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-500 mb-3 px-2">UPLOAD NORMAS</div>
                  <div className="border border-dashed border-white/15 rounded-xl p-4 text-center text-xs text-slate-500 hover:border-brand-purple/60 hover:bg-brand-purple/5 transition-colors cursor-pointer group">
                    <UploadCloud size={24} className="mx-auto mb-2 group-hover:text-brand-purple transition-colors" />
                    Arraste o PDF de normas da sua faculdade
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-500 mb-3 px-2">TEMPLATES</div>
                  <div className="flex flex-wrap gap-2">
                    {mockTemplates.map(t => (
                      <button
                        key={t}
                        onClick={() => setInputVal(`Quero fazer um TCC na área de ${t}.`)}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 text-xs px-3 py-1.5 rounded-full text-slate-300 transition-colors hover:border-brand-purple/50 focus:outline-none"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* MAIN CHAT */}
        <main className="flex-1 flex flex-col relative min-w-0 bg-[#0F0F1A]">
          <div className="flex-1 overflow-y-auto custom-scroll p-4 pb-20 space-y-6 max-w-4xl mx-auto w-full">
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
                    <motion.div
                      id="editor-content"
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                      className="mt-4 w-full bg-[#13131F] border border-white/10 rounded-2xl overflow-hidden shadow-brand"
                    >
                      <div className="bg-white/5 px-4 py-2 flex items-center justify-between border-b border-white/5">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                          <FileText size={16} className="text-brand-purple" /> {m.chapterTitle}
                        </div>
                        <div className="flex gap-2">
                          <button className="text-slate-400 hover:text-white" title="Expandir"><Maximize2 size={16} /></button>
                          <button className="text-slate-400 hover:text-white" title="Fechar"><X size={16} /></button>
                        </div>
                      </div>
                      <div className="px-4 py-2 bg-black/20 border-b border-white/5 flex gap-3 text-slate-400">
                        <Bold size={16} className="hover:text-white cursor-pointer" />
                        <Italic size={16} className="hover:text-white cursor-pointer" />
                        <Underline size={16} className="hover:text-white cursor-pointer" />
                        <div className="w-px h-4 bg-white/10" />
                        <Heading1 size={16} className="hover:text-white cursor-pointer" />
                        <Heading2 size={16} className="hover:text-white cursor-pointer" />
                        <div className="w-px h-4 bg-white/10" />
                        <List size={16} className="hover:text-white cursor-pointer" />
                        <Quote size={16} className="hover:text-white cursor-pointer" />
                      </div>
                      <textarea
                        className="w-full min-h-[250px] bg-transparent p-4 text-slate-300 resize-y focus:outline-none text-[15px] leading-relaxed custom-scroll"
                        defaultValue={m.editorContent || ""}
                      />
                      <div className="text-xs text-slate-500 flex justify-between px-4 py-3 bg-white/[0.02] border-t border-white/5 items-center">
                        <div>Palavras: 487 / 800</div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5 bg-green-500/10 text-green-500 px-2 py-1 rounded-md font-medium">
                            <CheckCircle2 size={14} /> Turnitin: 4%
                          </div>
                          <button className="text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-md transition-colors font-medium">Salvar rascunho</button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ))}

              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start max-w-[75%]">
                  <div className="bg-white/[0.06] border border-white/[0.09] rounded-[0_1rem_1rem_1rem] p-4 flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="absolute bottom-0 left-0 right-0 p-4 pt-0 bg-gradient-to-t from-[#0F0F1A] via-[#0F0F1A] to-transparent">
            {!activeTccId && (
              <div className="max-w-4xl mx-auto mb-3">
                <div className="bg-brand-purple/10 border border-brand-purple/30 rounded-xl p-3 flex items-center gap-3 text-sm text-brand-purple">
                  <Plus size={16} className="shrink-0" />
                  <span>Crie ou selecione um TCC na barra lateral para salvar o histórico automaticamente.</span>
                </div>
              </div>
            )}
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-4 px-2 mb-2 text-xs text-slate-500">
                <button className="hover:text-white flex items-center gap-1.5 transition-colors"><Paperclip size={14} /> Anexar PDF</button>
                <button className="hover:text-white flex items-center gap-1.5 transition-colors"><Search size={14} /> 4% Turnitin</button>
                <button onClick={exportPDF} className="hover:text-white flex items-center gap-1.5 transition-colors ml-auto text-brand-purple hover:text-brand-purple/80 font-medium">
                  <DownloadIcon size={14} /> Export PDF
                </button>
              </div>
              <div className="relative">
                <textarea
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder="Mensagem ou /comando..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-4 pr-12 py-4 text-[15px] focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple text-slate-200 resize-none overflow-hidden max-h-[150px] custom-scroll shadow-lg"
                  rows={Math.min(6, inputVal.split("\n").length)}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputVal.trim() || isTyping}
                  className="absolute right-3 bottom-3 p-2 bg-brand-purple text-white rounded-xl hover:bg-brand-purple/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT SIDEBAR */}
        <AnimatePresence>
          {rightOpen && (
            <motion.aside
              initial={{ x: 250 }} animate={{ x: 0 }} exit={{ x: 250 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="absolute lg:static top-0 right-0 bottom-0 w-[250px] bg-[#0F0F1A] border-l border-white/5 flex flex-col z-10"
            >
              <div className="p-4 flex-1 overflow-y-auto custom-scroll space-y-8">
                <div>
                  <div className="text-xs font-bold text-slate-500 mb-4 px-2 tracking-wider flex items-center gap-2"><CheckCircle2 size={14} /> PROGRESSO TCC</div>
                  <div className="space-y-4 px-2">
                    {[{ name: "Cap 1 Intro", p: 80 }, { name: "Cap 2 Desenv", p: 20 }, { name: "Cap 3 Conc", p: 0 }, { name: "Cap 4 Refs", p: 0 }].map(cap => (
                      <div key={cap.name} className="space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-300">
                          <span>{cap.name}</span><span className="font-medium">{cap.p}%</span>
                        </div>
                        <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }} animate={{ width: `${cap.p}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
                            className="h-full bg-gradient-to-r from-brand-purple to-brand-blue"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-500 mb-4 px-2 tracking-wider flex items-center gap-2"><FileText size={14} /> BIBLIOGRAFIA</div>
                  <ul className="space-y-2 px-2">
                    {mockRefs.map(r => (
                      <li key={r.id} className="flex items-center gap-2 group p-2 hover:bg-white/5 rounded-md cursor-grab active:cursor-grabbing text-xs text-slate-300">
                        <Menu size={14} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="truncate flex-1">{r.author} ({r.year})</span>
                        <X size={14} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 cursor-pointer" />
                      </li>
                    ))}
                  </ul>
                  <button className="mt-3 ml-2 text-xs text-brand-purple font-medium hover:text-brand-purple/80 transition-colors flex items-center gap-1"><Plus size={14} /> Adicionar ref</button>
                </div>

                <div className="px-2">
                  <div className="text-xs font-bold text-slate-500 mb-4 tracking-wider flex items-center gap-2"><Search size={14} /> TURNITIN LIVE</div>
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                    <div className="text-3xl font-extrabold text-green-500 mb-1">4%</div>
                    <div className="text-xs text-slate-400 mb-3">Meta: ≤ 10%</div>
                    <button className="w-full py-1.5 bg-white/5 hover:bg-white/10 rounded-md text-xs font-medium text-slate-300 transition-colors">Ver relatório</button>
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* NEW TCC MODAL */}
      <AnimatePresence>
        {showNewTcc && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowNewTcc(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#13131F] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <h2 className="text-lg font-bold mb-5 flex items-center gap-2"><Plus size={18} className="text-brand-purple" /> Novo TCC</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tema / Título</label>
                  <input
                    className="w-full bg-black/30 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-brand-purple"
                    placeholder="Ex: O impacto da IA no Direito Penal"
                    value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Curso</label>
                  <input
                    className="w-full bg-black/30 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-brand-purple"
                    placeholder="Ex: Direito"
                    value={newCourse} onChange={e => setNewCourse(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Instituição</label>
                  <input
                    className="w-full bg-black/30 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-brand-purple"
                    placeholder="Ex: USP"
                    value={newInstitution} onChange={e => setNewInstitution(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowNewTcc(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 text-sm transition-colors">Cancelar</button>
                <button
                  onClick={createTcc}
                  disabled={creatingTcc || !newTitle || !newCourse || !newInstitution}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-purple to-brand-blue text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                >
                  {creatingTcc ? <><Loader2 size={16} className="animate-spin" /> Criando...</> : "Criar TCC"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
