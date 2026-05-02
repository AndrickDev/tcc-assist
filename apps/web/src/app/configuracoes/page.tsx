"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { AppSidebar } from "@/components/AppSidebar"
import { User, Mail, Crown, Calendar, Save, Loader2, CheckCircle2, Shield, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const PLAN_LABEL: Record<string, string> = { FREE: "Gratuito", PRO: "PRO", VIP: "VIP" }

export default function ConfiguracoesPage() {
  const { data: session, update } = useSession()
  const user = session?.user as { id?: string; name?: string; email?: string; image?: string; plan?: string } | undefined

  const [name, setName] = React.useState(user?.name ?? "")
  const [saving, setSaving] = React.useState<"idle" | "saving" | "saved" | "error">("idle")

  React.useEffect(() => { if (user?.name) setName(user.name) }, [user?.name])

  const initials = (user?.name ?? user?.email ?? "?").slice(0, 2).toUpperCase()
  const plan = (user?.plan ?? "FREE") as string

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving("saving")
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (res.ok) {
        await update({ name: name.trim() })
        setSaving("saved")
        setTimeout(() => setSaving("idle"), 2500)
      } else {
        setSaving("error")
      }
    } catch {
      setSaving("error")
    }
  }

  return (
    <div className="flex min-h-screen bg-[var(--brand-bg)] text-[var(--brand-text)]">
      <AppSidebar />
      <main className="flex-1 pl-[52px] flex justify-center py-16 px-6">
        <div className="w-full max-w-[520px] space-y-6">

          {/* Header */}
          <div>
            <h1 className="text-xl font-bold text-[var(--brand-text)]">Configurações</h1>
            <p className="text-sm text-[var(--brand-muted)] mt-0.5">Gerencie seu perfil e plano</p>
          </div>

          {/* Avatar + plano */}
          <div className="flex items-center gap-4 p-4 bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl">
            <div className="w-14 h-14 rounded-full bg-[var(--brand-hover)] border border-[var(--brand-border)] flex items-center justify-center shrink-0 overflow-hidden">
              {user?.image
                ? <img src={user.image} alt="avatar" className="w-full h-full object-cover" />
                : <span className="text-lg font-bold text-[var(--brand-muted)]">{initials}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[var(--brand-text)] truncate">{user?.name ?? "—"}</p>
              <p className="text-xs text-[var(--brand-muted)] truncate">{user?.email ?? "—"}</p>
            </div>
            <span className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border shrink-0",
              plan === "VIP" ? "bg-orange-700/20 text-orange-600 border-orange-700/30" :
              plan === "PRO" ? "bg-[var(--brand-hover)] text-[var(--brand-text)] border-[var(--brand-border)]" :
              "bg-[var(--brand-hover)] text-[var(--brand-muted)] border-[var(--brand-border)]"
            )}>
              {PLAN_LABEL[plan] ?? plan}
            </span>
          </div>

          {/* Editar nome */}
          <section className="p-4 bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--brand-muted)]">Perfil</h2>

            <div className="space-y-1">
              <label className="text-[11px] text-[var(--brand-muted)] flex items-center gap-1.5"><User size={11} /> Nome</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--brand-text)] placeholder:text-[var(--brand-muted)]/50 focus:outline-none focus:border-[var(--brand-accent)]/50 transition-colors"
                placeholder="Seu nome"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-[var(--brand-muted)] flex items-center gap-1.5"><Mail size={11} /> E-mail</label>
              <input
                value={user?.email ?? ""}
                disabled
                className="w-full bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--brand-muted)]/50 cursor-not-allowed"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving === "saving" || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-hover)] hover:bg-[var(--brand-border)] border border-[var(--brand-border)] text-[var(--brand-text)] text-xs font-semibold rounded-xl transition-all disabled:opacity-40"
            >
              {saving === "saving" ? <><Loader2 size={12} className="animate-spin" /> Salvando...</> :
               saving === "saved"  ? <><CheckCircle2 size={12} className="text-emerald-500" /> Salvo!</> :
               <><Save size={12} /> Salvar alterações</>}
            </button>
          </section>

          {/* Plano */}
          <section className="p-4 bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--brand-muted)]">Plano atual</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {plan === "VIP"
                  ? <Crown size={14} className="text-[var(--brand-accent)]" />
                  : plan === "PRO"
                    ? <Shield size={14} className="text-[var(--brand-text)]/80" />
                    : <Sparkles size={14} className="text-[var(--brand-muted)]" />}
                <span className="text-sm font-semibold text-[var(--brand-text)]">{PLAN_LABEL[plan] ?? plan}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => update()}
                  className="text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
                  title="Re-verificar o plano no banco"
                >
                  Atualizar
                </button>
                {plan === "FREE" && (
                  <a href="/pricing" className="text-xs font-bold text-[var(--brand-accent)] hover:opacity-80 transition-colors">
                    Fazer upgrade →
                  </a>
                )}
              </div>
            </div>
            <p className="text-xs text-[var(--brand-muted)]">
              {plan === "FREE" && "3 mensagens/dia · 1 projeto · 5 uploads"}
              {plan === "PRO"  && "50 mensagens/dia · 1 projeto · 20 uploads"}
              {plan === "VIP"  && "Mensagens ilimitadas · 2 projetos · 50 uploads"}
            </p>
          </section>

          {/* Membro desde */}
          <p className="text-[11px] text-[var(--brand-muted)]/50 flex items-center gap-1.5 pl-1">
            <Calendar size={10} />
            Conta criada em {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
        </div>
      </main>
    </div>
  )
}
