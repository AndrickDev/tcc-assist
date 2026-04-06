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
      <div className="flex min-h-screen bg-[var(--brand-bg)] text-[var(--brand-text)]">
        <AppSidebar />
        <main className="flex-1 pl-[52px] flex items-center justify-center">
          <div className="text-center space-y-3">
            <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
            <h2 className="text-lg font-bold text-[var(--brand-text)]">Mensagem enviada!</h2>
            <p className="text-sm text-[var(--brand-muted)]">Nossa equipe responderá em até 24h no seu e-mail.</p>
            <button
              onClick={() => { setMensagem(""); setStatus("idle") }}
              className="mt-2 text-xs text-[var(--brand-muted)]/50 hover:text-[var(--brand-muted)] transition-colors"
            >
              Enviar outra mensagem
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[var(--brand-bg)] text-[var(--brand-text)]">
      <AppSidebar />
      <main className="flex-1 pl-[52px] flex justify-center py-16 px-6">
        <div className="w-full max-w-[520px] space-y-6">

          {/* Header */}
          <div>
            <h1 className="text-xl font-bold text-[var(--brand-text)] flex items-center gap-2">
              <MessageSquare size={18} className="text-[var(--brand-muted)]" /> Suporte
            </h1>
            <p className="text-sm text-[var(--brand-muted)] mt-0.5">Descreva sua dúvida ou problema e retornaremos em breve.</p>
          </div>

          <div className="p-5 bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl space-y-4">
            {/* De */}
            <div className="space-y-1">
              <label className="text-[11px] text-[var(--brand-muted)] uppercase tracking-widest">De</label>
              <div className="px-3 py-2.5 bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded-xl text-sm text-[var(--brand-muted)]">
                {user?.name && <span className="text-[var(--brand-text)]/70 mr-2">{user.name}</span>}
                {user?.email ?? "—"}
              </div>
            </div>

            {/* Assunto */}
            <div className="space-y-1">
              <label className="text-[11px] text-[var(--brand-muted)] uppercase tracking-widest">Assunto</label>
              <select
                value={assunto}
                onChange={e => setAssunto(e.target.value)}
                className="w-full bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--brand-text)] focus:outline-none focus:border-[var(--brand-accent)]/50 transition-colors"
              >
                {ASSUNTOS.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>

            {/* Mensagem */}
            <div className="space-y-1">
              <label className="text-[11px] text-[var(--brand-muted)] uppercase tracking-widest">Mensagem</label>
              <textarea
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
                rows={6}
                placeholder="Descreva sua situação com detalhes..."
                className="w-full bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--brand-text)] placeholder:text-[var(--brand-muted)]/40 focus:outline-none focus:border-[var(--brand-accent)]/50 resize-none transition-colors"
              />
            </div>

            <button
              onClick={handleEnviar}
              disabled={!mensagem.trim() || status === "sending"}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[var(--brand-accent)] hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-40"
            >
              {status === "sending"
                ? <><Loader2 size={14} className="animate-spin" /> Enviando...</>
                : <><Send size={14} /> Enviar mensagem</>}
            </button>
          </div>

          <p className="text-[11px] text-[var(--brand-muted)]/50 text-center">
            Tempo médio de resposta: 24h · Atendimento via e-mail
          </p>
        </div>
      </main>
    </div>
  )
}
