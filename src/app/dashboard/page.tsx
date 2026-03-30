"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useUserPlan } from "@/hooks/useUserPlan"
import { getTccSlotLimit } from "@/lib/plan"
import { DevPlanSwitcher } from "@/components/DevPlanSwitcher"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowRight, LogOut, Plus, X, ArrowLeft, Sparkles, Loader2,
  Book, School, Calendar, Target, FileCheck, Trash2, Crown,
  BookOpen, Layers, GraduationCap, Clock, Bell, Settings,
  TrendingUp, Zap, CheckCircle2, MessageSquare, LayoutGrid, List,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { trackEvent } from "@/lib/analytics"

// ─── Types ────────────────────────────────────────────────────────────────────

type Tcc = {
  id: string
  title: string
  course: string
  institution: string
  workType?: string | null
  norma?: string | null
  deadline?: string | null
  status: string
  createdAt: string
  updatedAt: string
  _count?: { messages: number }
}

type FormData = {
  title: string
  course: string
  institution: string
  workType: string
  norma: string
  deadline: string
  objective: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estimateProgress(tcc: Tcc): number {
  const msgs = tcc._count?.messages ?? 0
  if (msgs === 0) return 0
  if (msgs >= 40) return 92
  return Math.min(Math.round((msgs / 40) * 90), 90)
}

function getStatusLabel(status: string) {
  if (status === "COMPLETED") return { label: "Concluído", cls: "text-[color:var(--color-brand-muted)]" }
  if (status === "ARCHIVED") return { label: "Arquivado", cls: "text-[color:var(--color-brand-muted)]/60" }
  return { label: "Ativo", cls: "text-emerald-600 dark:text-emerald-400" }
}

function getHour() {
  const h = new Date().getHours()
  if (h < 12) return "Bom dia"
  if (h < 18) return "Boa tarde"
  return "Boa noite"
}

// ─── Plan Badge ───────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string }) {
  const cls =
    plan === "VIP"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : plan === "PRO"
      ? "bg-[color:var(--color-brand-accent)]/10 text-[color:var(--color-brand-accent)] border-[color:var(--color-brand-accent)]/20"
      : "bg-[color:var(--color-brand-hover)] text-[color:var(--color-brand-muted)] border-[color:var(--color-brand-border)]"
  return (
    <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border", cls)}>
      {plan === "FREE" ? "Gratuito" : plan}
    </span>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-0.5 w-full bg-[color:var(--color-brand-border)] rounded-full overflow-hidden">
      <div
        className="h-full bg-[color:var(--color-brand-accent)] rounded-full transition-all duration-700"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

// ─── TCC Project Card ────────────────────────────────────────────────────────

function TccCard({
  tcc,
  confirmDeleteId,
  deletingId,
  onConfirmDelete,
  onCancelDelete,
  onDelete,
  view = "grid",
}: {
  tcc: Tcc
  confirmDeleteId: string | null
  deletingId: string | null
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
  onDelete: (id: string) => void
  view?: "grid" | "list"
}) {
  const isConfirming = confirmDeleteId === tcc.id
  const isDeleting = deletingId === tcc.id
  const progress = estimateProgress(tcc)
  const { label: statusLabel, cls: statusCls } = getStatusLabel(tcc.status)

  const updatedLabel = React.useMemo(() => {
    try {
      return new Date(tcc.updatedAt).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "short", year: "numeric",
      })
    } catch { return "" }
  }, [tcc.updatedAt])

  const deadlineLabel = React.useMemo(() => {
    if (!tcc.deadline) return null
    try {
      return new Date(tcc.deadline).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "short", year: "numeric",
      })
    } catch { return null }
  }, [tcc.deadline])

  if (view === "list") {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="group flex items-center gap-4 px-5 py-4 bg-[color:var(--color-brand-surface)] border border-[color:var(--color-brand-border)] rounded-xl hover:border-[color:var(--color-brand-text)]/20 hover:shadow-sm transition-all"
      >
        {/* Icon */}
        <div className="w-9 h-9 rounded-lg bg-[color:var(--color-brand-accent)]/10 flex items-center justify-center shrink-0">
          <BookOpen size={15} className="text-[color:var(--color-brand-accent)]" />
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-[color:var(--color-brand-text)] truncate">{tcc.title}</h3>
            {tcc.workType && (
              <span className="hidden sm:inline px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[color:var(--color-brand-accent)]/10 text-[color:var(--color-brand-accent)]">
                {tcc.workType}
              </span>
            )}
          </div>
          <p className="text-xs text-[color:var(--color-brand-muted)] truncate">
            {tcc.course} · {tcc.institution}
          </p>
        </div>

        {/* Status */}
        <span className={cn("hidden md:inline text-xs font-medium shrink-0", statusCls)}>{statusLabel}</span>

        {/* Progress */}
        <div className="hidden sm:flex items-center gap-2 shrink-0 w-28">
          <ProgressBar value={progress} />
          <span className="text-[11px] text-[color:var(--color-brand-muted)] tabular-nums w-6 text-right">{progress}%</span>
        </div>

        {/* Updated */}
        <span className="hidden lg:inline text-xs text-[color:var(--color-brand-muted)] shrink-0 w-24 text-right">{updatedLabel}</span>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isConfirming ? (
            <>
              <button
                onClick={() => onDelete(tcc.id)}
                disabled={isDeleting}
                className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
              >
                {isDeleting ? <Loader2 size={11} className="animate-spin" /> : "Confirmar"}
              </button>
              <button onClick={onCancelDelete} className="text-[color:var(--color-brand-muted)]">
                <X size={12} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onConfirmDelete(tcc.id)}
                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-[color:var(--color-brand-muted)] hover:text-red-500 hover:bg-red-50 transition-all"
              >
                <Trash2 size={12} />
              </button>
              <Link
                href={`/tcc/${tcc.id}`}
                className="flex items-center gap-1 px-3 py-1.5 bg-[color:var(--color-brand-text)] hover:opacity-80 text-[color:var(--color-brand-bg)] text-xs font-semibold rounded-lg transition-opacity"
              >
                Abrir <ArrowRight size={11} />
              </Link>
            </>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className="group bg-[color:var(--color-brand-surface)] border border-[color:var(--color-brand-border)] rounded-2xl p-5 flex flex-col gap-4 hover:border-[color:var(--color-brand-text)]/20 hover:shadow-sm transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={cn("text-[10px] font-semibold", statusCls)}>{statusLabel}</span>
            {tcc.workType && (
              <span className="px-2 py-0.5 rounded-md bg-[color:var(--color-brand-accent)]/10 text-[10px] font-semibold text-[color:var(--color-brand-accent)] tracking-wide">
                {tcc.workType}
              </span>
            )}
            {tcc.norma && (
              <span className="text-[10px] text-[color:var(--color-brand-muted)]">{tcc.norma}</span>
            )}
          </div>
          <h3 className="text-[15px] font-semibold text-[color:var(--color-brand-text)] leading-snug line-clamp-2">
            {tcc.title}
          </h3>
        </div>
        <button
          onClick={() => onConfirmDelete(tcc.id)}
          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-[color:var(--color-brand-muted)] hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
          title="Excluir projeto"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Metadata */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-[color:var(--color-brand-muted)]">
          <GraduationCap size={11} className="shrink-0" />
          <span className="truncate">{tcc.course} · {tcc.institution}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[color:var(--color-brand-muted)]">
          {deadlineLabel ? (
            <>
              <Calendar size={11} className="shrink-0" />
              <span>Prazo: {deadlineLabel}</span>
            </>
          ) : (
            <>
              <Clock size={11} className="shrink-0" />
              <span>Atualizado {updatedLabel}</span>
            </>
          )}
        </div>
        {(tcc._count?.messages ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-[color:var(--color-brand-muted)]">
            <MessageSquare size={11} className="shrink-0" />
            <span>{tcc._count?.messages} interações com a IA</span>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-semibold text-[color:var(--color-brand-muted)] uppercase tracking-wider">Progresso</span>
          <span className="text-[11px] font-semibold text-[color:var(--color-brand-text)] tabular-nums">{progress}%</span>
        </div>
        <ProgressBar value={progress} />
      </div>

      {/* Footer */}
      {isConfirming ? (
        <div className="flex items-center gap-2 pt-3 border-t border-[color:var(--color-brand-border)]">
          <span className="text-xs text-[color:var(--color-brand-muted)] flex-1">Excluir este projeto?</span>
          <button
            onClick={() => onDelete(tcc.id)}
            disabled={isDeleting}
            className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            {isDeleting ? <Loader2 size={11} className="animate-spin" /> : "Confirmar"}
          </button>
          <button onClick={onCancelDelete} className="text-[color:var(--color-brand-muted)] hover:text-[color:var(--color-brand-text)] transition-colors">
            <X size={13} />
          </button>
        </div>
      ) : (
        <Link
          href={`/tcc/${tcc.id}`}
          className="mt-auto flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[color:var(--color-brand-text)] hover:opacity-80 text-[color:var(--color-brand-bg)] text-sm font-semibold rounded-xl transition-opacity"
        >
          Abrir workspace <ArrowRight size={14} />
        </Link>
      )}
    </motion.div>
  )
}

// ─── Intelligence Feed ────────────────────────────────────────────────────────

function IntelligenceFeed({ tccs }: { tccs: Tcc[] }) {
  const items = React.useMemo(() => {
    const feed: { icon: React.ReactNode; title: string; desc: string; time: string; type: "tip" | "milestone" | "suggestion" }[] = []

    const active = tccs.find(t => t.status === "IN_PROGRESS" || t.status === "DRAFTING" || (t.status !== "COMPLETED" && t.status !== "ARCHIVED"))
    if (active) {
      const msgs = active._count?.messages ?? 0
      if (msgs > 5) {
        feed.push({
          icon: <CheckCircle2 size={14} className="text-emerald-500" />,
          title: "Marco atingido",
          desc: `${msgs} interações com a IA em "${active.title.slice(0, 40)}${active.title.length > 40 ? '…' : ''}"`,
          time: "Recente",
          type: "milestone",
        })
      }
      if (msgs < 3) {
        feed.push({
          icon: <Zap size={14} className="text-[color:var(--color-brand-accent)]" />,
          title: "Sugestão da IA",
          desc: `Continue desenvolvendo "${active.title.slice(0, 35)}…" — abra o workspace e peça para a IA gerar o próximo capítulo.`,
          time: "Agora",
          type: "suggestion",
        })
      }
    }

    if (tccs.length === 0) {
      feed.push({
        icon: <Sparkles size={14} className="text-[color:var(--color-brand-accent)]" />,
        title: "Bem-vindo ao Teseo",
        desc: "Crie seu primeiro projeto e deixe a IA te guiar desde o tema até a entrega.",
        time: "Agora",
        type: "tip",
      })
    }

    feed.push({
      icon: <TrendingUp size={14} className="text-[color:var(--color-brand-muted)]" />,
      title: "Dica de produtividade",
      desc: "Trabalhe em blocos de 25 minutos por capítulo. A IA gera rascunhos — você refina e humaniza.",
      time: "Hoje",
      type: "tip",
    })

    return feed.slice(0, 3)
  }, [tccs])

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl border border-[color:var(--color-brand-border)] bg-[color:var(--color-brand-surface)]">
          <div className="w-7 h-7 rounded-lg bg-[color:var(--color-brand-hover)] flex items-center justify-center shrink-0 mt-0.5">
            {item.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="text-[11px] font-semibold text-[color:var(--color-brand-text)]">{item.title}</span>
              <span className="text-[10px] text-[color:var(--color-brand-muted)] shrink-0">{item.time}</span>
            </div>
            <p className="text-xs text-[color:var(--color-brand-muted)] leading-relaxed">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Sidebar Stats ────────────────────────────────────────────────────────────

function SidebarStats({ tccs, userPlan }: { tccs: Tcc[]; userPlan: string }) {
  const totalProgress = tccs.length > 0
    ? Math.round(tccs.reduce((acc, t) => acc + estimateProgress(t), 0) / tccs.length)
    : 0

  const totalMessages = tccs.reduce((acc, t) => acc + (t._count?.messages ?? 0), 0)
  const aiCapacityPct = userPlan === "FREE"
    ? Math.min(Math.round((totalMessages / 3) * 100), 100)
    : userPlan === "PRO"
    ? Math.min(Math.round((totalMessages / 50) * 100), 100)
    : Math.min(Math.round((totalMessages / 999) * 100), 100)

  const aiCapacityLabel = userPlan === "FREE" ? "3/dia" : userPlan === "PRO" ? "50/dia" : "Ilimitado"

  return (
    <div className="space-y-4">
      {/* Monthly Velocity */}
      <div className="p-4 rounded-xl border border-[color:var(--color-brand-border)] bg-[color:var(--color-brand-surface)]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--color-brand-muted)] mb-3">Velocidade Mensal</p>
        <div className="flex items-center justify-center py-3">
          <div className="relative w-20 h-20">
            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="32" fill="none" stroke="var(--brand-border)" strokeWidth="5" />
              <circle
                cx="40" cy="40" r="32" fill="none"
                stroke="var(--brand-accent)" strokeWidth="5"
                strokeDasharray={`${2 * Math.PI * 32}`}
                strokeDashoffset={`${2 * Math.PI * 32 * (1 - totalProgress / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-[color:var(--color-brand-text)]">{totalProgress}%</span>
            </div>
          </div>
        </div>
        <p className="text-center text-[11px] text-[color:var(--color-brand-muted)] mt-1">
          Progresso médio dos projetos
        </p>
      </div>

      {/* System Status */}
      <div className="p-4 rounded-xl border border-[color:var(--color-brand-border)] bg-[color:var(--color-brand-surface)]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--color-brand-muted)]">Status do Sistema</p>
          <PlanBadge plan={userPlan} />
        </div>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] text-[color:var(--color-brand-muted)]">Capacidade IA</span>
              <span className="text-[11px] font-semibold text-[color:var(--color-brand-text)]">{aiCapacityLabel}</span>
            </div>
            <ProgressBar value={aiCapacityPct} />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] text-[color:var(--color-brand-muted)]">Projetos</span>
              <span className="text-[11px] font-semibold text-[color:var(--color-brand-text)]">
                {tccs.length} / {userPlan === "VIP" ? "2" : "1"}
              </span>
            </div>
            <ProgressBar value={userPlan === "VIP" ? (tccs.length / 2) * 100 : tccs.length * 100} />
          </div>
        </div>
        <Link
          href="/pricing"
          className="mt-3 block w-full text-center text-[11px] font-semibold text-[color:var(--color-brand-accent)] hover:underline"
        >
          Gerenciar plano →
        </Link>
      </div>

      {/* Quick tip */}
      <div className="p-4 rounded-xl border border-[color:var(--color-brand-accent)]/20 bg-[color:var(--color-brand-accent)]/5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={13} className="text-[color:var(--color-brand-accent)]" />
          <span className="text-[11px] font-bold text-[color:var(--color-brand-accent)]">Nota do Teseo</span>
        </div>
        <p className="text-xs text-[color:var(--color-brand-muted)] leading-relaxed">
          Comece sempre pela Introdução e Metodologia — são as seções que mais reprovam por falta de clareza.
        </p>
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col items-center justify-center text-center px-4 py-20 max-w-sm mx-auto w-full"
    >
      <div className="w-16 h-16 rounded-2xl bg-[color:var(--color-brand-accent)]/10 flex items-center justify-center mb-6">
        <BookOpen className="w-7 h-7 text-[color:var(--color-brand-accent)]" />
      </div>
      <h2 className="text-2xl sm:text-3xl font-bold font-serif text-[color:var(--color-brand-text)] leading-snug mb-3">
        Seu próximo capítulo começa aqui
      </h2>
      <p className="text-sm text-[color:var(--color-brand-muted)] leading-relaxed mb-8">
        O Teseo te acompanha do tema à entrega — estruturando, revisando e orientando cada etapa do seu trabalho acadêmico.
      </p>
      <div className="grid grid-cols-3 gap-2.5 w-full mb-8">
        {([
          { Icon: Layers, label: "Estrutura guiada" },
          { Icon: FileCheck, label: "Revisão e ABNT" },
          { Icon: Sparkles, label: "IA especializada" },
        ] as const).map(({ Icon, label }) => (
          <div key={label} className="bg-[color:var(--color-brand-surface)] border border-[color:var(--color-brand-border)] rounded-xl p-3 flex flex-col items-center gap-1.5">
            <Icon className="w-4 h-4 text-[color:var(--color-brand-accent)]" />
            <span className="text-[11px] font-medium text-[color:var(--color-brand-text)] text-center leading-tight">{label}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onNew}
        className="inline-flex items-center gap-2 px-6 py-3 bg-[color:var(--color-brand-text)] hover:opacity-80 text-[color:var(--color-brand-bg)] text-sm font-semibold rounded-xl transition-opacity"
      >
        <Plus size={16} /> Criar primeiro TCC
      </button>
    </motion.div>
  )
}

// ─── NewTccModal ──────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5
const WORK_TYPES = ["TCC", "Monografia", "Dissertação de Mestrado", "Tese de Doutorado", "Artigo Científico", "Relatório de Estágio"]
const NORMAS = ["ABNT", "APA", "Vancouver", "Chicago", "Outra"]
const STEP_NAMES = ["Tema", "Dados acadêmicos", "Tipo e norma", "Prazo e objetivo", "Confirmar"]

const INPUT_CLS =
  "w-full bg-[color:var(--color-brand-bg)] border border-[color:var(--color-brand-border)] rounded-xl px-4 py-3 text-sm text-[color:var(--color-brand-text)] placeholder:text-[color:var(--color-brand-muted)] focus:outline-none focus:border-[color:var(--color-brand-text)] transition-colors"

function NewTccModal({
  open, onClose, onCreated, userPlan, tccCount,
}: {
  open: boolean; onClose: () => void; onCreated: (id: string) => void; userPlan: string; tccCount: number
}) {
  const [step, setStep] = React.useState(1)
  const [loading, setLoading] = React.useState(false)
  const [slotError, setSlotError] = React.useState("")
  const [form, setForm] = React.useState<FormData>({
    title: "", course: "", institution: "", workType: "TCC", norma: "ABNT", deadline: "", objective: "",
  })

  const patch = (key: keyof FormData, val: string) => setForm(prev => ({ ...prev, [key]: val }))

  const canNext = React.useMemo(() => {
    switch (step) {
      case 1: return form.title.trim().length > 0
      case 2: return form.course.trim().length > 0 && form.institution.trim().length > 0
      case 3: return form.workType.length > 0 && form.norma.length > 0
      case 4: return form.objective.trim().length > 0
      default: return true
    }
  }, [step, form.title, form.course, form.institution, form.workType, form.norma, form.objective])

  const handleNext = () => {
    trackEvent('ONBOARDING_STEP', { step, name: STEP_NAMES[step - 1], plan: userPlan })
    if (step < TOTAL_STEPS) setStep(s => s + 1)
    else handleCreate()
  }

  const handleCreate = async () => {
    setLoading(true)
    setSlotError("")
    try {
      const res = await fetch("/api/tcc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title, course: form.course, institution: form.institution,
          workType: form.workType, norma: form.norma,
          deadline: form.deadline || null, objective: form.objective,
        }),
      })
      const text = await res.text()
      if (!text) return
      const data = JSON.parse(text)
      if (data?.limitReached) { setSlotError(data.error ?? "Limite de projetos atingido."); return }
      if (!res.ok) return
      if (data?.id) {
        trackEvent('TCC_CREATED', { plan: userPlan, workType: form.workType, norma: form.norma, hasDeadline: !!form.deadline })
        onCreated(data.id)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => { onClose(); setTimeout(() => { setStep(1); setSlotError("") }, 300) }

  const slotLimit = userPlan === "VIP" ? 2 : 1
  const atSlotLimit = tccCount >= slotLimit
  const summaryRows = [
    { label: "Tema", value: form.title },
    { label: "Curso", value: `${form.course} · ${form.institution}` },
    { label: "Tipo", value: `${form.workType} · ${form.norma}` },
    ...(form.deadline ? [{ label: "Prazo", value: new Date(form.deadline + "T00:00:00").toLocaleDateString("pt-BR") }] : []),
  ]
  const showCta = !(step === TOTAL_STEPS && (slotError || atSlotLimit))

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) handleClose() }}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }} transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-lg bg-[color:var(--color-brand-surface)] rounded-2xl shadow-2xl overflow-hidden border border-[color:var(--color-brand-border)]"
          >
            <div className="h-[3px] bg-[color:var(--color-brand-border)]">
              <motion.div
                className="h-full bg-[color:var(--color-brand-accent)]"
                animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              />
            </div>
            <div className="p-7">
              <div className="flex items-center justify-between mb-7">
                <button
                  onClick={() => (step > 1 ? setStep(s => s - 1) : handleClose())}
                  className="flex items-center gap-1.5 text-sm text-[color:var(--color-brand-muted)] hover:text-[color:var(--color-brand-text)] transition-colors"
                >
                  <ArrowLeft size={15} />
                  {step === 1 ? "Cancelar" : "Voltar"}
                </button>
                <div className="text-center">
                  <div className="text-xs font-semibold text-[color:var(--color-brand-text)]">{STEP_NAMES[step - 1]}</div>
                  <div className="text-[10px] text-[color:var(--color-brand-muted)] tabular-nums">{step} de {TOTAL_STEPS}</div>
                </div>
                <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-[color:var(--color-brand-hover)] transition-colors">
                  <X size={15} className="text-[color:var(--color-brand-muted)]" />
                </button>
              </div>

              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div key="s1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }} className="space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-[color:var(--color-brand-text)]">Qual é o tema do seu TCC?</h2>
                      <p className="mt-1 text-sm text-[color:var(--color-brand-muted)]">Pode ser uma ideia inicial ou um título provisório — você refina depois.</p>
                    </div>
                    <textarea autoFocus value={form.title} onChange={e => patch("title", e.target.value)} placeholder="Ex: O impacto da inteligência artificial na educação básica brasileira…" className={cn(INPUT_CLS, "min-h-[110px] resize-none")} onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey && canNext) handleNext() }} />
                    <p className="text-[11px] text-[color:var(--color-brand-muted)]">Dica: quanto mais específico o tema, mais focada fica a orientação da IA.</p>
                  </motion.div>
                )}
                {step === 2 && (
                  <motion.div key="s2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }} className="space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-[color:var(--color-brand-text)]">Dados acadêmicos</h2>
                      <p className="mt-1 text-sm text-[color:var(--color-brand-muted)]">Essenciais para a IA adaptar o tom, a estrutura e as normas ao seu contexto.</p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-brand-muted)] uppercase tracking-wider mb-1.5">
                          <Book size={11} /> Curso
                        </label>
                        <input autoFocus type="text" value={form.course} onChange={e => patch("course", e.target.value)} placeholder="Ex: Engenharia de Software" className={INPUT_CLS} />
                      </div>
                      <div>
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-brand-muted)] uppercase tracking-wider mb-1.5">
                          <School size={11} /> Faculdade / Instituição
                        </label>
                        <input type="text" value={form.institution} onChange={e => patch("institution", e.target.value)} placeholder="Ex: USP, UNESP, Mackenzie…" className={INPUT_CLS} />
                      </div>
                    </div>
                  </motion.div>
                )}
                {step === 3 && (
                  <motion.div key="s3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }} className="space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-[color:var(--color-brand-text)]">Tipo de trabalho e norma</h2>
                      <p className="mt-1 text-sm text-[color:var(--color-brand-muted)]">Define a estrutura de capítulos e o estilo de citação que a IA vai adotar.</p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-brand-muted)] uppercase tracking-wider mb-1.5">
                          <FileCheck size={11} /> Tipo de trabalho
                        </label>
                        <select value={form.workType} onChange={e => patch("workType", e.target.value)} className={cn(INPUT_CLS, "appearance-none cursor-pointer")}>
                          {WORK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-[color:var(--color-brand-muted)] uppercase tracking-wider mb-2 block">Norma de formatação</label>
                        <div className="flex flex-wrap gap-2">
                          {NORMAS.map(n => (
                            <button key={n} type="button" onClick={() => patch("norma", n)}
                              className={cn("px-4 py-2 rounded-xl text-sm font-medium border transition-colors",
                                form.norma === n
                                  ? "bg-[color:var(--color-brand-text)] text-[color:var(--color-brand-bg)] border-[color:var(--color-brand-text)]"
                                  : "bg-[color:var(--color-brand-bg)] text-[color:var(--color-brand-muted)] border-[color:var(--color-brand-border)] hover:border-[color:var(--color-brand-text)] hover:text-[color:var(--color-brand-text)]"
                              )}>{n}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
                {step === 4 && (
                  <motion.div key="s4" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }} className="space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-[color:var(--color-brand-text)]">Prazo e objetivo</h2>
                      <p className="mt-1 text-sm text-[color:var(--color-brand-muted)]">Com um objetivo claro, o Teseo orienta cada capítulo com mais precisão.</p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-brand-muted)] uppercase tracking-wider mb-1.5">
                          <Calendar size={11} /> Prazo de entrega <span className="normal-case font-normal">(opcional)</span>
                        </label>
                        <input type="date" value={form.deadline} onChange={e => patch("deadline", e.target.value)} className={INPUT_CLS} />
                      </div>
                      <div>
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-brand-muted)] uppercase tracking-wider mb-1.5">
                          <Target size={11} /> Objetivo / problema de pesquisa
                        </label>
                        <textarea autoFocus value={form.objective} onChange={e => patch("objective", e.target.value)} placeholder="Ex: Analisar como modelos de linguagem podem reduzir o tempo de produção sem comprometer a qualidade acadêmica…" className={cn(INPUT_CLS, "min-h-[100px] resize-none")} />
                      </div>
                    </div>
                  </motion.div>
                )}
                {step === 5 && (
                  <motion.div key="s5" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }} className="space-y-5">
                    {(slotError || atSlotLimit) ? (
                      <div className="text-center space-y-4">
                        <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                          <Crown className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-[color:var(--color-brand-text)]">Limite de projetos atingido</h2>
                          <p className="mt-1 text-sm text-[color:var(--color-brand-muted)]">
                            {slotError || `Seu plano ${userPlan} permite ${slotLimit} projeto${slotLimit > 1 ? "s" : ""} simultâneo${slotLimit > 1 ? "s" : ""}.`}
                          </p>
                        </div>
                        <Link href="/pricing" onClick={handleClose} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[color:var(--color-brand-text)] hover:opacity-80 text-[color:var(--color-brand-bg)] text-sm font-semibold rounded-xl transition-opacity">
                          <Crown size={14} /> Ver planos e fazer upgrade
                        </Link>
                      </div>
                    ) : (
                      <>
                        <div className="text-center">
                          <div className="w-12 h-12 bg-[color:var(--color-brand-accent)]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Sparkles className="w-5 h-5 text-[color:var(--color-brand-accent)]" />
                          </div>
                          <h2 className="text-lg font-bold text-[color:var(--color-brand-text)]">Tudo certo — pronto para começar</h2>
                          <p className="mt-1 text-sm text-[color:var(--color-brand-muted)]">O Teseo vai preparar seu workspace com base neste contexto.</p>
                        </div>
                        <div className="bg-[color:var(--color-brand-bg)] border border-[color:var(--color-brand-border)] rounded-xl divide-y divide-[color:var(--color-brand-border)] overflow-hidden">
                          {summaryRows.map(row => (
                            <div key={row.label} className="flex gap-3 px-4 py-2.5">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-brand-muted)] w-14 pt-0.5 shrink-0">{row.label}</span>
                              <span className="text-sm text-[color:var(--color-brand-text)] font-medium line-clamp-2">{row.value}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {showCta && (
                <div className="mt-7 flex justify-end">
                  <button
                    onClick={handleNext} disabled={!canNext || loading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[color:var(--color-brand-text)] hover:opacity-80 text-[color:var(--color-brand-bg)] text-sm font-semibold rounded-xl transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {loading && <Loader2 size={15} className="animate-spin" />}
                    {step === TOTAL_STEPS ? "Criar workspace" : "Continuar"}
                    {step < TOTAL_STEPS && !loading && <ArrowRight size={15} />}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const userPlan = useUserPlan()
  const tccSlotLimit = getTccSlotLimit(userPlan)

  const [loadingTccs, setLoadingTccs] = React.useState(true)
  const [tccs, setTccs] = React.useState<Tcc[]>([])
  const [modalOpen, setModalOpen] = React.useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [view, setView] = React.useState<"grid" | "list">("grid")

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await fetch(`/api/tcc/${id}`, { method: "DELETE" })
      setTccs(prev => prev.filter(t => t.id !== id))
      trackEvent('TCC_DELETED', { plan: userPlan })
    } catch (e) {
      console.error(e)
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  React.useEffect(() => {
    if (status === "unauthenticated") router.push("/")
  }, [router, status])

  const loadTccs = React.useCallback(async () => {
    setLoadingTccs(true)
    try {
      const res = await fetch("/api/tcc", { cache: "no-store" })
      if (!res.ok) return
      const text = await res.text()
      if (!text) return
      const data = JSON.parse(text)
      if (Array.isArray(data)) setTccs(data)
    } catch (e) {
      console.error("Erro ao carregar TCCs:", e)
    } finally {
      setLoadingTccs(false)
    }
  }, [])

  React.useEffect(() => {
    if (status === "authenticated") void loadTccs()
  }, [status, loadTccs])

  if (status === "loading") return null

  const firstName = session?.user?.name?.split(" ")[0] ?? null
  const canAddMore = tccs.length < tccSlotLimit
  const slotsLeft = tccSlotLimit - tccs.length

  return (
    <div className="min-h-[100dvh] bg-[color:var(--color-brand-bg)] text-[color:var(--color-brand-text)]">

      {/* ── Header ── */}
      <header className="h-[60px] border-b border-[color:var(--color-brand-border)] bg-[color:var(--color-brand-surface)] sticky top-0 z-30">
        <div className="w-full px-5 sm:px-6 h-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[color:var(--color-brand-text)] grid place-items-center shrink-0">
              <span className="text-[color:var(--color-brand-bg)] font-bold text-xs leading-none">T</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-none">Teseo</div>
              <div className="text-[11px] text-[color:var(--color-brand-muted)] mt-0.5 truncate max-w-[180px]">
                {session?.user?.email}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PlanBadge plan={userPlan} />
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[color:var(--color-brand-text)] hover:opacity-80 text-[color:var(--color-brand-bg)] text-sm font-semibold transition-opacity"
            >
              <Plus size={14} /> Novo TCC
            </button>
            <button className="p-1.5 rounded-lg text-[color:var(--color-brand-muted)] hover:text-[color:var(--color-brand-text)] hover:bg-[color:var(--color-brand-hover)] border border-[color:var(--color-brand-border)] transition-colors" title="Notificações">
              <Bell size={15} />
            </button>
            <Link href="/pricing" className="hidden sm:flex p-1.5 rounded-lg text-[color:var(--color-brand-muted)] hover:text-[color:var(--color-brand-text)] hover:bg-[color:var(--color-brand-hover)] border border-[color:var(--color-brand-border)] transition-colors" title="Configurações">
              <Settings size={15} />
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="p-1.5 rounded-lg text-[color:var(--color-brand-muted)] hover:text-[color:var(--color-brand-text)] hover:bg-[color:var(--color-brand-hover)] border border-[color:var(--color-brand-border)] transition-colors"
              title="Sair"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="w-full px-5 sm:px-6 py-8 min-h-[calc(100dvh-60px)]">
        {loadingTccs ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-5 h-5 animate-spin text-[color:var(--color-brand-muted)]" />
          </div>
        ) : tccs.length === 0 ? (
          <EmptyState onNew={() => setModalOpen(true)} />
        ) : (
          <div className="max-w-6xl mx-auto">

            {/* ── Overview row ── */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--color-brand-muted)] mb-1">Visão geral</p>
                <h1 className="text-2xl font-bold text-[color:var(--color-brand-text)]">
                  {getHour()}{firstName ? `, ${firstName}` : ""}.
                </h1>
                <p className="mt-1 text-sm text-[color:var(--color-brand-muted)]">
                  {tccs.length} projeto{tccs.length !== 1 ? "s" : ""} em andamento
                  {canAddMore ? ` · ${slotsLeft} vaga${slotsLeft !== 1 ? "s" : ""} disponível${slotsLeft !== 1 ? "is" : ""}` : " · limite do plano atingido"}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(true)}
                className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 bg-[color:var(--color-brand-text)] hover:opacity-80 text-[color:var(--color-brand-bg)] text-sm font-semibold rounded-xl transition-opacity"
              >
                <Plus size={15} /> Novo manuscrito
              </button>
            </div>

            {/* ── Two-column layout ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">

              {/* ── Left: projects + feed ── */}
              <div className="space-y-6">

                {/* Active projects section */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--color-brand-muted)]">
                      Projetos ativos
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setView("grid")}
                        className={cn("p-1.5 rounded-lg transition-colors", view === "grid" ? "bg-[color:var(--color-brand-hover)] text-[color:var(--color-brand-text)]" : "text-[color:var(--color-brand-muted)] hover:text-[color:var(--color-brand-text)]")}
                      >
                        <LayoutGrid size={14} />
                      </button>
                      <button
                        onClick={() => setView("list")}
                        className={cn("p-1.5 rounded-lg transition-colors", view === "list" ? "bg-[color:var(--color-brand-hover)] text-[color:var(--color-brand-text)]" : "text-[color:var(--color-brand-muted)] hover:text-[color:var(--color-brand-text)]")}
                      >
                        <List size={14} />
                      </button>
                    </div>
                  </div>

                  {view === "grid" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <AnimatePresence>
                        {tccs.map(tcc => (
                          <TccCard key={tcc.id} tcc={tcc} view="grid"
                            confirmDeleteId={confirmDeleteId} deletingId={deletingId}
                            onConfirmDelete={setConfirmDeleteId} onCancelDelete={() => setConfirmDeleteId(null)} onDelete={handleDelete}
                          />
                        ))}
                      </AnimatePresence>
                      {canAddMore && (
                        <motion.button
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          onClick={() => setModalOpen(true)}
                          className="group min-h-[180px] bg-[color:var(--color-brand-surface)] border-2 border-dashed border-[color:var(--color-brand-border)] rounded-2xl p-5 flex flex-col items-center justify-center gap-3 hover:border-[color:var(--color-brand-text)]/30 hover:bg-[color:var(--color-brand-hover)] transition-all cursor-pointer"
                        >
                          <div className="w-10 h-10 rounded-full bg-[color:var(--color-brand-border)] group-hover:bg-[color:var(--color-brand-text)]/10 flex items-center justify-center transition-colors">
                            <Plus size={18} className="text-[color:var(--color-brand-muted)] group-hover:text-[color:var(--color-brand-text)] transition-colors" />
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-semibold text-[color:var(--color-brand-muted)] group-hover:text-[color:var(--color-brand-text)] transition-colors">Novo projeto</div>
                            <div className="text-xs text-[color:var(--color-brand-muted)]/60 mt-0.5">{slotsLeft} vaga{slotsLeft !== 1 ? "s" : ""} disponível{slotsLeft !== 1 ? "is" : ""}</div>
                          </div>
                        </motion.button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <AnimatePresence>
                        {tccs.map(tcc => (
                          <TccCard key={tcc.id} tcc={tcc} view="list"
                            confirmDeleteId={confirmDeleteId} deletingId={deletingId}
                            onConfirmDelete={setConfirmDeleteId} onCancelDelete={() => setConfirmDeleteId(null)} onDelete={handleDelete}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </section>

                {/* Upgrade banner when at limit */}
                {!canAddMore && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl border border-amber-200 bg-amber-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <Crown className="w-4 h-4 text-amber-600 shrink-0" />
                      <p className="text-sm text-amber-700">
                        Limite do plano <strong>{userPlan === "FREE" ? "Gratuito" : userPlan}</strong> atingido. Faça upgrade para criar mais projetos.
                      </p>
                    </div>
                    <Link href="/pricing" className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors">
                      Ver planos
                    </Link>
                  </motion.div>
                )}

                {/* Intelligence Feed */}
                <section>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--color-brand-muted)] mb-3">Feed de inteligência</p>
                  <IntelligenceFeed tccs={tccs} />
                </section>
              </div>

              {/* ── Right: sidebar stats ── */}
              <aside className="hidden lg:block">
                <SidebarStats tccs={tccs} userPlan={userPlan} />
              </aside>
            </div>
          </div>
        )}
      </main>

      {/* ── Modal ── */}
      <NewTccModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={id => { setModalOpen(false); router.push(`/tcc/${id}`) }}
        userPlan={userPlan}
        tccCount={tccs.length}
      />

      <DevPlanSwitcher />
    </div>
  )
}
