"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { AppSidebar } from "@/components/AppSidebar"
import { Send, CheckCircle2, Loader2, MessageSquare } from "lucide-react"

const ASSUNTOS = [
  "Dúvida sobre o produto",
  "Problema técnico",
  "Cobrança / plano",
  "Sugestão de melhoria",
  "Outro",
]

export default function SuportePage() {
  const { data: session } = useSession()
  const user = session?.user as { name?: string; email?: string } | undefined

  const [assunto, setAssunto] = React.useState(ASSUNTOS[0])
  const [mensagem, setMensagem] = React.useState("")
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent">("idle")

  const handleEnviar = async () => {
    if (!mensagem.trim()) return
    setStatus("sending")
    // Simula envio — integrar com email/Resend futuramente
    await new Promise(r => setTimeout(r, 1200))
    setStatus("sent")
  }

  if (status === "sent") {
    return (
      <div className="flex min-h-screen bg-[#0A0A09] text-white">
        <AppSidebar />
        <main className="flex-1 pl-[52px] flex items-center justify-center">
          <div className="text-center space-y-3">
            <CheckCircle2 size={36} className="text-emerald-400 mx-auto" />
            <h2 className="text-lg font-bold text-white/85">Mensagem enviada!</h2>
            <p className="text-sm text-white/35">Nossa equipe responderá em até 24h no seu e-mail.</p>
            <button
              onClick={() => { setMensagem(""); setStatus("idle") }}
              className="mt-2 text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              Enviar outra mensagem
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#0A0A09] text-white">
      <AppSidebar />
      <main className="flex-1 pl-[52px] flex justify-center py-16 px-6">
        <div className="w-full max-w-[520px] space-y-6">

          {/* Header */}
          <div>
            <h1 className="text-xl font-bold text-white/90 flex items-center gap-2">
              <MessageSquare size={18} className="text-white/40" /> Suporte
            </h1>
            <p className="text-sm text-white/35 mt-0.5">Descreva sua dúvida ou problema e retornaremos em breve.</p>
          </div>

          <div className="p-5 bg-[#111110] border border-white/[0.07] rounded-2xl space-y-4">
            {/* De */}
            <div className="space-y-1">
              <label className="text-[11px] text-white/40 uppercase tracking-widest">De</label>
              <div className="px-3 py-2.5 bg-[#0A0A09] border border-white/[0.06] rounded-xl text-sm text-white/35">
                {user?.name && <span className="text-white/50 mr-2">{user.name}</span>}
                {user?.email ?? "—"}
              </div>
            </div>

            {/* Assunto */}
            <div className="space-y-1">
              <label className="text-[11px] text-white/40 uppercase tracking-widest">Assunto</label>
              <select
                value={assunto}
                onChange={e => setAssunto(e.target.value)}
                className="w-full bg-[#0A0A09] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/70 focus:outline-none focus:border-white/20"
              >
                {ASSUNTOS.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>

            {/* Mensagem */}
            <div className="space-y-1">
              <label className="text-[11px] text-white/40 uppercase tracking-widest">Mensagem</label>
              <textarea
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
                rows={6}
                placeholder="Descreva sua situação com detalhes..."
                className="w-full bg-[#0A0A09] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/70 placeholder:text-white/20 focus:outline-none focus:border-white/20 resize-none"
              />
            </div>

            <button
              onClick={handleEnviar}
              disabled={!mensagem.trim() || status === "sending"}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/[0.07] hover:bg-white/[0.11] border border-white/[0.09] text-white/70 text-sm font-semibold rounded-xl transition-all disabled:opacity-40"
            >
              {status === "sending"
                ? <><Loader2 size={14} className="animate-spin" /> Enviando...</>
                : <><Send size={14} /> Enviar mensagem</>}
            </button>
          </div>

          <p className="text-[11px] text-white/20 text-center">
            Tempo médio de resposta: 24h · Atendimento via e-mail
          </p>
        </div>
      </main>
    </div>
  )
}
