"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { signOut } from "next-auth/react"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowUpRight,
  FileText,
  Plus,
  Settings,
  X,
  LayoutDashboard,
  PieChart,
  Target,
  Paperclip,
  Crown,
  Sun,
  Moon,
  Globe,
  LogOut,
  Download,
  Loader2,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

type Plan = "FREE" | "PRO" | "VIP"

interface Tcc {
  id: string
  title: string
  course: string
  institution: string
  status: string
  createdAt: string
  updatedAt: string
}

interface TccStats {
  progress: number
  plagiarism: number
  humanAuthorship: number
  totalPages: number
  status: string
}

function planLabel(plan: Plan) {
  return plan ?? "FREE"
}

function getAttachmentLimit(plan: Plan) {
  if (plan === "VIP") return 50
  if (plan === "PRO") return 20
  return 5
}

function turnitinColor(plagiarism: number) {
  if (plagiarism <= 10) return "text-green-500"
  if (plagiarism <= 25) return "text-amber-500"
  return "text-red-500"
}

function dotColor(plagiarism: number) {
  if (plagiarism <= 10) return "bg-green-500"
  if (plagiarism <= 25) return "bg-amber-500"
  return "bg-red-500"
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function ProgressRing({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div
      className="w-16 h-16 rounded-full grid place-items-center"
      style={{
        background: `conic-gradient(rgb(168 85 247) ${v}%, rgba(255,255,255,0.08) 0)`,
      }}
    >
      <div className="w-12 h-12 rounded-full bg-brand-bg border border-brand-border grid place-items-center">
        <span className="text-xs font-black">{v}%</span>
      </div>
    </div>
  )
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.button
        type="button"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Fechar"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="relative w-full max-w-lg bg-brand-bg border border-brand-border rounded-3xl p-7 shadow-brand"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black tracking-tight text-white">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
            <X size={18} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const userPlan = planLabel((((session?.user as { plan?: Plan } | undefined)?.plan ?? "FREE") as Plan))

  const { theme, setTheme } = useTheme()
  const { language, setLanguage, t } = useI18n()

  const [loadingTccs, setLoadingTccs] = React.useState(true)
  const [tccs, setTccs] = React.useState<Tcc[]>([])
  const [activeTccId, setActiveTccId] = React.useState<string | null>(null)

  const [statsById, setStatsById] = React.useState<Record<string, TccStats | undefined>>({})
  const [attachmentsById, setAttachmentsById] = React.useState<Record<string, { count: number; limit: number } | undefined>>({})

  const [showNewTcc, setShowNewTcc] = React.useState(false)
  const [newStep, setNewStep] = React.useState<1 | 2 | 3>(1)
  const [creating, setCreating] = React.useState(false)
  const [newForm, setNewForm] = React.useState({ title: "", course: "", institution: "" })

  const [showConfig, setShowConfig] = React.useState(false)

  const loadTccs = React.useCallback(async () => {
    setLoadingTccs(true)
    try {
      const res = await fetch("/api/tcc", { cache: "no-store" })
      const data = await res.json()
      if (Array.isArray(data)) {
        setTccs(data)
        if (!activeTccId && data[0]?.id) setActiveTccId(data[0].id)
      }
    } finally {
      setLoadingTccs(false)
    }
  }, [activeTccId])

  const loadStats = React.useCallback(async (tccId: string) => {
    const res = await fetch(`/api/tcc/${tccId}/stats`, { cache: "no-store" })
    const data = await res.json()
    if (!data?.error) {
      setStatsById((prev) => ({ ...prev, [tccId]: data }))
    }
  }, [])

  const loadAttachmentsMeta = React.useCallback(async (tccId: string) => {
    const res = await fetch(`/api/tcc/${tccId}/attachments`, { cache: "no-store" })
    const data = await res.json()
    if (!data?.error) {
      setAttachmentsById((prev) => ({ ...prev, [tccId]: { count: data.count ?? 0, limit: data.limit ?? getAttachmentLimit(userPlan) } }))
    }
  }, [userPlan])

  React.useEffect(() => {
    if (status !== "authenticated") return
    loadTccs()
  }, [status, loadTccs])

  React.useEffect(() => {
    if (!activeTccId) return
    loadStats(activeTccId)
    loadAttachmentsMeta(activeTccId)
    const interval = setInterval(() => loadStats(activeTccId), 5000)
    return () => clearInterval(interval)
  }, [activeTccId, loadStats, loadAttachmentsMeta])

  React.useEffect(() => {
    if (!tccs.length) return
    // Preload stats quickly for the visible cards
    tccs.slice(0, 6).forEach((t) => {
      if (!statsById[t.id]) loadStats(t.id)
    })
  }, [tccs, statsById, loadStats])

  const activeStats = activeTccId ? statsById[activeTccId] : undefined
  const activeAttachments = activeTccId ? attachmentsById[activeTccId] : undefined

  const avgTurnitin = React.useMemo(() => {
    const values = tccs
      .map((t) => statsById[t.id]?.plagiarism)
      .filter((v): v is number => typeof v === "number")
    if (!values.length) return 0
    return round1(values.reduce((a, b) => a + b, 0) / values.length)
  }, [tccs, statsById])

  const avgProgress = React.useMemo(() => {
    const values = tccs
      .map((t) => statsById[t.id]?.progress)
      .filter((v): v is number => typeof v === "number")
    if (!values.length) return 0
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
  }, [tccs, statsById])

  const createTcc = async () => {
    setCreating(true)
    try {
      const res = await fetch("/api/tcc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
      })
      const data = await res.json()
      if (data?.id) {
        setShowNewTcc(false)
        setNewStep(1)
        setNewForm({ title: "", course: "", institution: "" })
        await loadTccs()
        setActiveTccId(data.id)
      } else if (data?.error) {
        alert(data.error)
      } else {
        alert("Falha ao criar TCC.")
      }
    } finally {
      setCreating(false)
    }
  }

  const downloadPdf = async (tcc: Tcc) => {
    const stats = statsById[tcc.id]
    try {
      const jsPDF = (await import("jspdf")).default
      const doc = new jsPDF({ unit: "pt", format: "a4" })
      const margin = 48
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      const title = `TCC: ${tcc.title}`
      doc.setFont("helvetica", "bold")
      doc.setFontSize(18)
      doc.text(title, margin, 72, { maxWidth: pageWidth - margin * 2 })
      doc.setFont("helvetica", "normal")
      doc.setFontSize(11)
      doc.text(`${tcc.course} • ${tcc.institution}`, margin, 96)
      doc.text(`Progresso: ${stats?.progress ?? 0}% • Turnitin: ${stats?.plagiarism ?? 0}%`, margin, 114)

      // Pull content: last bot messages (simple compile)
      const msgRes = await fetch(`/api/tcc/${tcc.id}/messages`, { cache: "no-store" })
      const msgs = await msgRes.json()
      const body = Array.isArray(msgs)
        ? (msgs as Array<{ role?: string; content?: unknown }>)
            .filter((m) => m.role === "bot")
            .slice(-8)
            .map((m) => String(m.content ?? ""))
            .join("\n\n")
        : ""

      let y = 150
      const textWidth = pageWidth - margin * 2
      doc.setFontSize(11)
      const lines = doc.splitTextToSize(body || "Sem conteúdo ainda. Gere um capítulo no workspace.", textWidth)
      for (const line of lines) {
        if (y > pageHeight - margin) {
          doc.addPage()
          y = margin
        }
        doc.text(line, margin, y)
        y += 14
      }

      if (userPlan === "FREE") {
        doc.setTextColor(150, 150, 150)
        doc.setFontSize(44)
        doc.setFont("helvetica", "bold")
        doc.text(
          "TCC-ASSIST FREE",
          pageWidth / 2,
          pageHeight / 2,
          ({ align: "center", angle: 35 } as unknown as Record<string, unknown>)
        )
        doc.setTextColor(0, 0, 0)
      } else {
        doc.setFontSize(9)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(120, 120, 120)
        doc.text("Gerado por TCC-ASSIST", pageWidth / 2, pageHeight - 18, { align: "center" })
        doc.setTextColor(0, 0, 0)
      }

      doc.save(`${tcc.title.slice(0, 40) || "TCC"}.pdf`)
    } catch (e) {
      console.error(e)
      alert("Falha ao gerar PDF (verifique se o pacote jspdf está instalado).")
    }
  }

  if (status === "loading") {
    return <div className="min-h-[100dvh] bg-brand-bg text-brand-text grid place-items-center">Carregando...</div>
  }

  if (status !== "authenticated") {
    router.push("/login")
    return null
  }

  return (
    <div className="min-h-[100dvh] bg-brand-bg text-brand-text">
      <header className="h-[62px] sticky top-0 z-20 bg-brand-bg/80 backdrop-blur-md border-b border-brand-border px-4">
        <div className="h-full max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-brand-surface border border-brand-border grid place-items-center shadow-brand">
              <LayoutDashboard size={18} className="text-brand-purple" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-black tracking-tight">{t("dashboard.title")}</div>
              <div className="text-[11px] text-[color:var(--color-brand-muted)]">{tccs.length} TCC(s) • Plano {userPlan}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-bg border border-brand-border hover:bg-black/5 dark:hover:bg-white/10 text-xs font-black shadow-brand"
              title={t("nav.back_to_site")}
            >
              {t("nav.back_to_site")}
            </Link>
            <button
              onClick={() => setShowNewTcc(true)}
              className="px-3.5 py-2 rounded-xl bg-brand-purple text-white font-extrabold text-xs shadow-brand hover:brightness-95 active:scale-[0.99] transition"
            >
              <span className="inline-flex items-center gap-2">
                <Plus size={16} /> {t("dashboard.new_tcc")}
              </span>
            </button>
            <button onClick={() => setShowConfig(true)} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 border border-brand-border">
              <Settings size={18} />
            </button>
            <button onClick={() => signOut({ callbackUrl: "/" })} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 border border-brand-border">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 px-4 py-6">
        <section className="space-y-4">
          {loadingTccs ? (
            <div className="p-6 rounded-3xl border border-brand-border bg-brand-surface shadow-brand">
              <div className="flex items-center gap-3 text-[color:var(--color-brand-muted)]">
                <Loader2 className="animate-spin" size={18} /> {t("dashboard.loading")}
              </div>
            </div>
          ) : tccs.length === 0 ? (
            <div className="p-10 rounded-3xl border border-brand-border bg-brand-surface shadow-brand">
              <div className="text-xl font-black">{t("dashboard.empty_title")}</div>
              <div className="text-sm text-[color:var(--color-brand-muted)] mt-2">{t("dashboard.empty_desc")}</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tccs.map((tcc) => {
                const stats = statsById[tcc.id]
                const progress = stats?.progress ?? 0
                const plagiarism = stats?.plagiarism ?? 0
                const selected = activeTccId === tcc.id
                return (
                  <div
                    key={tcc.id}
                    onClick={() => setActiveTccId(tcc.id)}
                    className={cn(
                      "text-left p-5 rounded-3xl border bg-brand-surface hover:brightness-[0.99] transition shadow-brand",
                      selected ? "border-brand-purple/50" : "border-brand-border"
                    )}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setActiveTccId(tcc.id)
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-brand-purple" />
                          <div className="font-black truncate">TCC: {tcc.title}</div>
                        </div>
                        <div className="text-xs text-[color:var(--color-brand-muted)] mt-1 truncate">
                          {tcc.course} • {tcc.institution}
                        </div>
                      </div>
                      <ProgressRing value={progress} />
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <div className="text-xs text-[color:var(--color-brand-muted)]">
                        Cap 1: {Math.min(100, Math.round(progress * 0.67))}% • Turnitin:{" "}
                        <span className={cn("font-black", turnitinColor(plagiarism))}>{round1(plagiarism)}%</span>{" "}
                        <span className={cn("inline-block w-2 h-2 rounded-full ml-1 align-middle", dotColor(plagiarism))} />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <Link
                        href={`/tcc/${tcc.id}`}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-bg border border-brand-border hover:bg-black/5 dark:hover:bg-white/10 text-xs font-bold"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t("dashboard.open_workspace")} <ArrowUpRight size={14} />
                      </Link>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-bg border border-brand-border hover:bg-black/5 dark:hover:bg-white/10 text-xs font-bold"
                        onClick={(e) => {
                          e.stopPropagation()
                          downloadPdf(tcc)
                        }}
                      >
                        {t("dashboard.pdf")} <Download size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-3xl border border-brand-border bg-brand-surface p-6 space-y-6 sticky top-[86px] shadow-brand">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-black text-[color:var(--color-brand-muted)] tracking-widest">{t("dashboard.summary")}</div>
            <div className="text-[10px] font-black text-brand-purple tracking-widest uppercase">{userPlan}</div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-brand-text">
              <PieChart size={16} className="text-brand-purple" />
              <div className="text-xs font-bold">{t("dashboard.progress")}</div>
            </div>
            <div className="text-sm font-black">{avgProgress}%</div>
          </div>
          <div className="h-2 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${avgProgress}%` }} className="h-full bg-brand-purple" />
          </div>

          <div className="flex items-center justify-between p-3 bg-brand-bg border border-brand-border rounded-2xl shadow-brand">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-brand-blue" />
              <div>
                <div className="text-[10px] text-[color:var(--color-brand-muted)] font-black leading-none">{t("dashboard.turnitin_avg")}</div>
                <div className="text-[11px] text-[color:var(--color-brand-muted)] font-medium mt-1">{t("dashboard.realtime")}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full animate-pulse", dotColor(avgTurnitin))} />
              <div className={cn("text-sm font-black", turnitinColor(avgTurnitin))}>{avgTurnitin}%</div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-brand-bg border border-brand-border rounded-2xl shadow-brand">
            <div className="flex items-center gap-2">
              <Paperclip size={16} className="text-[color:var(--color-brand-muted)]" />
              <div>
                <div className="text-[10px] text-[color:var(--color-brand-muted)] font-black leading-none">{t("dashboard.attachments")}</div>
                <div className="text-[11px] text-[color:var(--color-brand-muted)] font-medium mt-1">
                  {activeTccId ? t("dashboard.attachments_selected") : t("dashboard.attachments_select")}
                </div>
              </div>
            </div>
            <div className="text-sm font-black text-white">
              {activeTccId ? `${activeAttachments?.count ?? 0}/${activeAttachments?.limit ?? getAttachmentLimit(userPlan)}` : "--/--"}
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-brand-purple/20 bg-brand-purple/5 flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] text-[color:var(--color-brand-muted)] font-black tracking-widest uppercase">{t("dashboard.plan")}</div>
              <div className="text-sm font-black">{userPlan}</div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/pricing" className="px-3 py-2 rounded-xl bg-brand-bg border border-brand-border text-xs font-black hover:bg-black/5 dark:hover:bg-white/10">
                PRO R$200
              </Link>
              <Link href="/pricing" className="px-3 py-2 rounded-xl bg-brand-bg border border-brand-border text-xs font-black hover:bg-black/5 dark:hover:bg-white/10">
                VIP R$1000
              </Link>
            </div>
          </div>

          <button onClick={() => setShowConfig(true)} className="w-full px-4 py-3 rounded-2xl border border-brand-border bg-brand-bg hover:bg-black/5 dark:hover:bg-white/10 text-left shadow-brand">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-[color:var(--color-brand-muted)]" />
                <div className="text-xs font-black">{t("dashboard.config")}</div>
              </div>
              <div className="text-[11px] text-[color:var(--color-brand-muted)]">
                {theme === "dark" ? "Dark" : "Light"} • {language} • Sair
              </div>
            </div>
          </button>
        </aside>
      </main>

      <AnimatePresence>
        {showNewTcc && (
          <ModalShell title={t("newtcc.title")} onClose={() => setShowNewTcc(false)}>
            <div className="flex items-center justify-between mb-5">
              <div className="text-[10px] text-[color:var(--color-brand-muted)] font-black tracking-widest">{t("newtcc.step")} {newStep}/3</div>
              <div className="h-1.5 w-32 bg-white/5 rounded-full overflow-hidden">
                <motion.div className="h-full bg-brand-purple" animate={{ width: `${(newStep / 3) * 100}%` }} />
              </div>
            </div>

            {newStep === 1 && (
              <div className="space-y-3">
                <div className="text-sm font-black">{t("newtcc.step1")}</div>
                <textarea
                  autoFocus
                  value={newForm.title}
                  onChange={(e) => setNewForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Ex: IA na Saúde"
                  className="w-full min-h-[120px] bg-brand-bg border border-brand-border rounded-2xl p-4 text-sm text-brand-text focus:outline-none focus:border-brand-purple shadow-brand"
                />
              </div>
            )}

            {newStep === 2 && (
              <div className="space-y-3">
                <div className="text-sm font-black">{t("newtcc.step2")}</div>
                <input
                  value={newForm.course}
                  onChange={(e) => setNewForm((p) => ({ ...p, course: e.target.value }))}
                  placeholder="Curso (ex: Engenharia)"
                  className="w-full bg-brand-bg border border-brand-border rounded-2xl px-4 py-3 text-sm text-brand-text focus:outline-none focus:border-brand-purple shadow-brand"
                />
                <input
                  value={newForm.institution}
                  onChange={(e) => setNewForm((p) => ({ ...p, institution: e.target.value }))}
                  placeholder="Instituição (ex: USP)"
                  className="w-full bg-brand-bg border border-brand-border rounded-2xl px-4 py-3 text-sm text-brand-text focus:outline-none focus:border-brand-purple shadow-brand"
                />
              </div>
            )}

            {newStep === 3 && (
              <div className="space-y-3">
                <div className="text-sm font-black">{t("newtcc.step3")}</div>
                <div className="p-4 rounded-2xl border border-brand-border bg-brand-surface shadow-brand">
                  <div className="text-[10px] text-[color:var(--color-brand-muted)] font-black tracking-widest uppercase">Resumo</div>
                  <div className="text-white font-black mt-2">&quot;{newForm.title}&quot;</div>
                  <div className="text-sm text-[color:var(--color-brand-muted)] mt-1">
                    {newForm.course} • {newForm.institution}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setNewStep((s) => (s === 1 ? 1 : ((s - 1) as 1 | 2 | 3)))}
                disabled={creating || newStep === 1}
                className="px-4 py-2 rounded-xl border border-brand-border hover:bg-black/5 dark:hover:bg-white/10 text-xs font-black disabled:opacity-40 shadow-brand"
              >
                {t("newtcc.back")}
              </button>
              <button
                onClick={() => {
                  if (newStep < 3) setNewStep((s) => ((s + 1) as 1 | 2 | 3))
                  else createTcc()
                }}
                disabled={
                  creating ||
                  (newStep === 1 && !newForm.title.trim()) ||
                  (newStep === 2 && (!newForm.course.trim() || !newForm.institution.trim()))
                }
                className="px-5 py-2.5 rounded-xl bg-brand-purple text-white text-xs font-black shadow-brand disabled:opacity-50"
              >
                {creating ? <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={14} /> {t("newtcc.creating")}</span> : newStep === 3 ? t("newtcc.confirm") : t("newtcc.continue")}
              </button>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConfig && (
          <ModalShell title={t("config.title")} onClose={() => setShowConfig(false)}>
            <div className="space-y-3">
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="w-full flex items-center justify-between p-4 bg-brand-surface rounded-2xl border border-brand-border hover:bg-black/5 dark:hover:bg-white/10 shadow-brand"
              >
                <div className="flex items-center gap-3">
                  {theme === "dark" ? <Moon size={18} className="text-brand-purple" /> : <Sun size={18} className="text-brand-purple" />}
                  <div className="text-sm font-bold">{t("config.theme")}</div>
                </div>
                <div className="text-xs font-black text-[color:var(--color-brand-muted)]">{theme === "dark" ? "Dark" : "Light"}</div>
              </button>

              <button
                onClick={() => setLanguage(language === "PT" ? "EN" : "PT")}
                className="w-full flex items-center justify-between p-4 bg-brand-surface rounded-2xl border border-brand-border hover:bg-black/5 dark:hover:bg-white/10 shadow-brand"
              >
                <div className="flex items-center gap-3">
                  <Globe size={18} className="text-brand-blue" />
                  <div className="text-sm font-bold">{t("config.language")}</div>
                </div>
                <div className="text-xs font-black text-[color:var(--color-brand-muted)]">{language}</div>
              </button>

              <div className="flex items-center justify-between p-4 bg-brand-purple/5 rounded-2xl border border-brand-purple/20">
                <div className="flex items-center gap-3">
                  <Crown size={18} className="text-brand-purple" />
                  <div>
                    <div className="text-sm font-bold leading-none">Plano</div>
                    <div className="text-[10px] text-brand-purple font-black tracking-widest uppercase mt-1">{userPlan}</div>
                  </div>
                </div>
                <Link href="/pricing" className="px-4 py-2 bg-brand-purple text-white text-xs font-black rounded-xl shadow-brand">
                  {t("config.upgrade")}
                </Link>
              </div>

              <div className="p-4 bg-brand-surface rounded-2xl border border-brand-border shadow-brand">
                <div className="text-[10px] text-[color:var(--color-brand-muted)] font-black tracking-widest">{t("config.account")}</div>
              <div className="text-sm font-black mt-2">{session?.user?.name ?? session?.user?.email}</div>
                <div className="text-xs text-[color:var(--color-brand-muted)] mt-1">{session?.user?.email}</div>
              </div>

              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full flex items-center justify-center gap-2 p-4 bg-red-500/10 rounded-2xl border border-red-500/20 hover:bg-red-500/15 text-red-300 font-black text-sm"
              >
                <LogOut size={18} /> {t("config.signout")}
              </button>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>
    </div>
  )
}
