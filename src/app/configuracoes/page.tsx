"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { AppSidebar } from "@/components/AppSidebar"
import { User, Mail, Crown, Calendar, Save, Loader2, CheckCircle2 } from "lucide-react"
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
    <div className="flex min-h-screen bg-[#0A0A09] text-white">
      <AppSidebar />
      <main className="flex-1 pl-[52px] flex justify-center py-16 px-6">
        <div className="w-full max-w-[520px] space-y-6">

          {/* Header */}
          <div>
            <h1 className="text-xl font-bold text-white/90">Configurações</h1>
            <p className="text-sm text-white/35 mt-0.5">Gerencie seu perfil e plano</p>
          </div>

          {/* Avatar + plano */}
          <div className="flex items-center gap-4 p-4 bg-[#111110] border border-white/[0.07] rounded-2xl">
            <div className="w-14 h-14 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
              {user?.image
                ? <img src={user.image} alt="avatar" className="w-full h-full object-cover" />
                : <span className="text-lg font-bold text-white/50">{initials}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white/85 truncate">{user?.name ?? "—"}</p>
              <p className="text-xs text-white/35 truncate">{user?.email ?? "—"}</p>
            </div>
            <span className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border shrink-0",
              plan === "VIP" ? "bg-orange-700/20 text-orange-600 border-orange-700/30" :
              plan === "PRO" ? "bg-white/10 text-white/70 border-white/[0.12]" :
              "bg-white/[0.05] text-white/35 border-white/[0.07]"
            )}>
              {PLAN_LABEL[plan] ?? plan}
            </span>
          </div>

          {/* Editar nome */}
          <section className="p-4 bg-[#111110] border border-white/[0.07] rounded-2xl space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/30">Perfil</h2>

            <div className="space-y-1">
              <label className="text-[11px] text-white/40 flex items-center gap-1.5"><User size={11} /> Nome</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-[#0A0A09] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/25 focus:outline-none focus:border-white/20"
                placeholder="Seu nome"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-white/40 flex items-center gap-1.5"><Mail size={11} /> E-mail</label>
              <input
                value={user?.email ?? ""}
                disabled
                className="w-full bg-[#0A0A09] border border-white/[0.05] rounded-xl px-3 py-2.5 text-sm text-white/30 cursor-not-allowed"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving === "saving" || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-white/70 text-xs font-semibold rounded-xl transition-all disabled:opacity-40"
            >
              {saving === "saving" ? <><Loader2 size={12} className="animate-spin" /> Salvando...</> :
               saving === "saved"  ? <><CheckCircle2 size={12} className="text-emerald-400" /> Salvo!</> :
               <><Save size={12} /> Salvar alterações</>}
            </button>
          </section>

          {/* Plano */}
          <section className="p-4 bg-[#111110] border border-white/[0.07] rounded-2xl space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/30">Plano atual</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown size={14} className="text-orange-600" />
                <span className="text-sm font-semibold text-white/80">{PLAN_LABEL[plan] ?? plan}</span>
              </div>
              {plan === "FREE" && (
                <a href="/pricing" className="text-xs font-bold text-orange-600 hover:text-orange-500 transition-colors">
                  Fazer upgrade →
                </a>
              )}
            </div>
            <p className="text-xs text-white/25">
              {plan === "FREE" && "3 mensagens/dia · 1 projeto · 5 uploads"}
              {plan === "PRO"  && "50 mensagens/dia · 1 projeto · 20 uploads"}
              {plan === "VIP"  && "Mensagens ilimitadas · 2 projetos · 50 uploads"}
            </p>
          </section>

          {/* Membro desde */}
          <p className="text-[11px] text-white/20 flex items-center gap-1.5 pl-1">
            <Calendar size={10} />
            Conta criada em {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
        </div>
      </main>
    </div>
  )
}
