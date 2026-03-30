"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useUserPlan } from "@/hooks/useUserPlan"
import { getTccSlotLimit } from "@/lib/plan"
import { DevPlanSwitcher } from "@/components/DevPlanSwitcher"
import { AppSidebar } from "@/components/AppSidebar"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowRight, Plus, X, ArrowLeft, Sparkles, Loader2,
  Book, School, Calendar, Target, FileCheck, Trash2, Crown,
  BookOpen, Layers, GraduationCap, Clock, Bell,
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
      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
      : plan === "PRO"
      ? "bg-white/10 text-white/80 border-white/[0.12]"
      : "bg-white/[0.06] text-white/40 border-white/[0.08]"
  return (
    <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border", cls)}>
      {plan === "FREE" ? "Gratuito" : plan}
    </span>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, accent = false }: { value: number; accent?: boolean }) {
  return (
    <div className="h-0.5 w-full bg-white/[0.07] rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-700", accent ? "bg-amber-500" : "bg-white/30")}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

// ─── TCC Card Grid ────────────────────────────────────────────────────────────

function TccCardGrid({ tcc, confirmDeleteId, deletingId, onConfirmDelete, onCancelDelete, onDelete }: {
  tcc: Tcc; confirmDeleteId: string | null; deletingId: string | null
  onConfirmDelete: (id: string) => void; onCancelDelete: () => void; onDelete: (id: string) => void
}) {
  const isConfirming = confirmDeleteId === tcc.id
  const isDeleting = deletingId === tcc.id
  const progress = estimateProgress(tcc)
  const isActive = tcc.status !== "COMPLETED" && tcc.status !== "ARCHIVED"

  const updatedLabel = React.useMemo(() => {
    try { return new Date(tcc.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) }
    catch { return "" }
  }, [tcc.updatedAt])

  const deadlineLabel = React.useMemo(() => {
    if (!tcc.deadline) return null
    try { return new Date(tcc.deadline).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) }
    catch { return null }
  }, [tcc.deadline])

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.18 }}
      className="group relative bg-[#161614] border border-white/[0.08] rounded-2xl p-5 flex flex-col gap-4 hover:border-white/[0.16] transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", isActive ? "bg-emerald-400" : "bg-white/20")} />
          {tcc.workType && (
            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-[10px] font-bold text-amber-500/80 tracking-wide border border-amber-500/20">{tcc.workType}</span>
          )}
          {tcc.norma && <span className="text-[10px] text-white/25">{tcc.norma}</span>}
        </div>
        <button onClick={() => onConfirmDelete(tcc.id)}
          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0">
          <Trash2 size={12} />
        </button>
      </div>
      <h3 className="text-sm font-semibold text-white/90 leading-snug line-clamp-2 font-serif -mt-1">{tcc.title}</h3>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-white/35">
          <GraduationCap size={10} className="shrink-0" />
          <span className="truncate">{tcc.course} · {tcc.institution}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-white/35">
          {deadlineLabel
            ? <><Calendar size={10} className="shrink-0" /><span>Prazo: {deadlineLabel}</span></>
            : <><Clock size={10} className="shrink-0" /><span>Atualizado {updatedLabel}</span></>}
        </div>
        {(tcc._count?.messages ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-white/35">
            <MessageSquare size={10} className="shrink-0" /><span>{tcc._count?.messages} interações</span>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[9px] font-bold text-white/25 uppercase tracking-widest">Progresso</span>
          <span className="text-[11px] font-semibold text-white/50 tabular-nums">{progress}%</span>
        </div>
        <ProgressBar value={progress} accent={progress > 50} />
      </div>
      {isConfirming ? (
        <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
          <span className="text-[11px] text-white/30 flex-1">Excluir este projeto?</span>
          <button onClick={() => onDelete(tcc.id)} disabled={isDeleting}
            className="text-[11px] font-bold text-red-400 hover:text-red-300 disabled:opacity-50">
            {isDeleting ? <Loader2 size={11} className="animate-spin" /> : "Confirmar"}
          </button>
          <button onClick={onCancelDelete} className="text-white/30 hover:text-white/60"><X size={12} /></button>
        </div>
      ) : (
        <Link href={`/tcc/${tcc.id}`}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] hover:border-white/[0.14] text-white/80 text-xs font-bold rounded-xl transition-all">
          Abrir workspace <ArrowRight size={13} />
        </Link>
      )}
    </motion.div>
  )
}

// ─── TCC Card List ────────────────────────────────────────────────────────────

function TccCardList({ tcc, confirmDeleteId, deletingId, onConfirmDelete, onCancelDelete, onDelete }: {
  tcc: Tcc; confirmDeleteId: string | null; deletingId: string | null
  onConfirmDelete: (id: string) => void; onCancelDelete: () => void; onDelete: (id: string) => void
}) {
  const isConfirming = confirmDeleteId === tcc.id
  const isDeleting = deletingId === tcc.id
  const progress = estimateProgress(tcc)
  const isActive = tcc.status !== "COMPLETED" && tcc.status !== "ARCHIVED"
  const updatedLabel = React.useMemo(() => {
    try { return new Date(tcc.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) }
    catch { return "" }
  }, [tcc.updatedAt])

  return (
    <motion.div layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
      className="group flex items-center gap-4 px-5 py-4 bg-[#161614] border border-white/[0.08] rounded-xl hover:border-white/[0.14] transition-all">
      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
        <BookOpen size={14} className="text-amber-500/70" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", isActive ? "bg-emerald-400" : "bg-white/20")} />
          <h3 className="text-sm font-semibold text-white/85 truncate font-serif">{tcc.title}</h3>
          {tcc.workType && (
            <span className="hidden sm:inline px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-500/70 border border-amber-500/20">{tcc.workType}</span>
          )}
        </div>
        <p className="text-[11px] text-white/30 truncate">{tcc.course} · {tcc.institution}</p>
      </div>
      <div className="hidden sm:flex items-center gap-2 shrink-0 w-24">
        <ProgressBar value={progress} accent={progress > 50} />
        <span className="text-[10px] text-white/30 tabular-nums w-6 text-right">{progress}%</span>
      </div>
      <span className="hidden lg:inline text-[11px] text-white/25 shrink-0 w-20 text-right">{updatedLabel}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        {isConfirming ? (
          <>
            <button onClick={() => onDelete(tcc.id)} disabled={isDeleting}
              className="text-[11px] font-bold text-red-400 hover:text-red-300 disabled:opacity-50">
              {isDeleting ? <Loader2 size={11} className="animate-spin" /> : "Confirmar"}
            </button>
            <button onClick={onCancelDelete} className="text-white/30"><X size={12} /></button>
          </>
        ) : (
          <>
            <button onClick={() => onConfirmDelete(tcc.id)}
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all">
              <Trash2 size={12} />
            </button>
            <Link href={`/tcc/${tcc.id}`}
              className="flex items-center gap-1 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-white/70 text-xs font-bold rounded-lg transition-all">
              Abrir <ArrowRight size={11} />
            </Link>
          </>
        )}
      </div>
    </motion.div>
  )
}

// ─── Intelligence Feed ────────────────────────────────────────────────────────

function IntelligenceFeed({ tccs }: { tccs: Tcc[] }) {
  const items = React.useMemo(() => {
    const feed: { icon: React.ReactNode; title: string; desc: string; time: string }[] = []
    const active = tccs.find(t => t.status !== "COMPLETED" && t.status !== "ARCHIVED")
    if (active) {
      const msgs = active._count?.messages ?? 0
      if (msgs > 5) feed.push({ icon: <CheckCircle2 size={13} className="text-emerald-400" />, title: "Marco atingido", desc: `${msgs} interações em "${active.title.slice(0, 35)}…"`, time: "Recente" })
      if (msgs < 3) feed.push({ icon: <Zap size={13} className="text-amber-400" />, title: "Sugestão da IA", desc: `Continue "${active.title.slice(0, 30)}…" — gere o próximo capítulo.`, time: "Agora" })
    }
    if (tccs.length === 0) feed.push({ icon: <Sparkles size={13} className="text-amber-400" />, title: "Bem-vindo ao Teseo", desc: "Crie seu primeiro projeto e deixe a IA te guiar.", time: "Agora" })
    feed.push({ icon: <TrendingUp size={13} className="text-white/30" />, title: "Dica de produtividade", desc: "Trabalhe em blocos de 25 min por capítulo. A IA gera rascunhos — você refina.", time: "Hoje" })
    return feed.slice(0, 3)
  }, [tccs])

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl border border-white/[0.06] bg-[#161614]">
          <div className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">{item.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="text-[11px] font-bold text-white/70">{item.title}</span>
              <span className="text-[10px] text-white/25 shrink-0">{item.time}</span>
            </div>
            <p className="text-[11px] text-white/35 leading-relaxed">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Sidebar Stats ────────────────────────────────────────────────────────────

function SidebarStats({ tccs, userPlan }: { tccs: Tcc[]; userPlan: string }) {
  const totalProgress = tccs.length > 0
    ? Math.round(tccs.reduce((acc, t) => acc + estimateProgress(t), 0) / tccs.length) : 0
  const totalMessages = tccs.reduce((acc, t) => acc + (t._count?.messages ?? 0), 0)
  const aiLimit = userPlan === "FREE" ? 3 : userPlan === "PRO" ? 50 : 999
  const aiCapacityPct = Math.min(Math.round((totalMessages / aiLimit) * 100), 100)
  const aiCapacityLabel = userPlan === "FREE" ? "3/dia" : userPlan === "PRO" ? "50/dia" : "Ilimitado"
  const slotLimit = userPlan === "VIP" ? 2 : 1

  return (
    <div className="space-y-3">
      <div className="p-4 rounded-xl border border-white/[0.07] bg-[#161614]">
        <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-4">Velocidade Mensal</p>
        <div className="flex items-center justify-center py-2">
          <div className="relative w-20 h-20">
            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
              <circle cx="40" cy="40" r="32" fill="none"
                stroke={totalProgress > 50 ? "#f59e0b" : "rgba(255,255,255,0.25)"} strokeWidth="5"
                strokeDasharray={`${2 * Math.PI * 32}`}
                strokeDashoffset={`${2 * Math.PI * 32 * (1 - totalProgress / 100)}`}
                strokeLinecap="round" className="transition-all duration-700" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-white/80">{totalProgress}%</span>
            </div>
          </div>
        </div>
        <p className="text-center text-[10px] text-white/25 mt-2">Progresso médio dos projetos</p>
      </div>
      <div className="p-4 rounded-xl border border-white/[0.07] bg-[#161614]">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/25">Status do Sistema</p>
          <PlanBadge plan={userPlan} />
        </div>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[11px] text-white/35">Capacidade IA</span>
              <span className="text-[11px] font-semibold text-white/50">{aiCapacityLabel}</span>
            </div>
            <ProgressBar value={aiCapacityPct} accent />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[11px] text-white/35">Projetos</span>
              <span className="text-[11px] font-semibold text-white/50">{tccs.length} / {slotLimit}</span>
            </div>
            <ProgressBar value={(tccs.length / slotLimit) * 100} />
          </div>
        </div>
        <Link href="/pricing" className="mt-4 block text-center text-[10px] font-bold text-amber-500/70 hover:text-amber-400 transition-colors tracking-wide">
          GERENCIAR PLANO →
        </Link>
      </div>
      <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.04]">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={12} className="text-amber-500/70" />
          <span className="text-[10px] font-bold text-amber-500/70 tracking-wide">NOTA DO TESEO</span>
        </div>
        <p className="text-[11px] text-white/35 leading-relaxed">
          Comece sempre pela Introdução e Metodologia — são as seções que mais reprovam por falta de clareza.
        </p>
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center text-center px-4 py-24 max-w-sm mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
        <BookOpen className="w-7 h-7 text-amber-500/70" />
      </div>
      <h2 className="text-2xl font-bold font-serif text-white/85 leading-snug mb-3">Seu próximo capítulo começa aqui</h2>
      <p className="text-sm text-white/35 leading-relaxed mb-8">O Teseo te acompanha do tema à entrega — estruturando, revisando e orientando cada etapa.</p>
      <div className="grid grid-cols-3 gap-2.5 w-full mb-8">
        {([
          { Icon: Layers, label: "Estrutura guiada" },
          { Icon: FileCheck, label: "Revisão e ABNT" },
          { Icon: Sparkles, label: "IA especializada" },
        ] as const).map(({ Icon, label }) => (
          <div key={label} className="bg-[#161614] border border-white/[0.07] rounded-xl p-3 flex flex-col items-center gap-1.5">
            <Icon className="w-4 h-4 text-amber-500/60" />
            <span className="text-[10px] font-medium text-white/40 text-center leading-tight">{label}</span>
          </div>
        ))}
      </div>
      <button onClick={onNew} className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#111110] text-sm font-bold rounded-xl hover:opacity-90 transition-opacity">
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
const INPUT_CLS = "w-full bg-[#111110] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white/85 placeholder:text-white/25 focus:outline-none focus:border-white/20 transition-colors"

function NewTccModal({ open, onClose, onCreated, userPlan, tccCount }: {
  open: boolean; onClose: () => void; onCreated: (id: string) => void; userPlan: string; tccCount: number
}) {
  const [step, setStep] = React.useState(1)
  const [loading, setLoading] = React.useState(false)
  const [slotError, setSlotError] = React.useState("")
  const [form, setForm] = React.useState<FormData>({ title: "", course: "", institution: "", workType: "TCC", norma: "ABNT", deadline: "", objective: "" })
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

  const handleCreate = async () => {
    setLoading(true); setSlotError("")
    try {
      const res = await fetch("/api/tcc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: form.title, course: form.course, institution: form.institution, workType: form.workType, norma: form.norma, deadline: form.deadline || null, objective: form.objective }) })
      const text = await res.text(); if (!text) return
      const data = JSON.parse(text)
      if (data?.limitReached) { setSlotError(data.error ?? "Limite de projetos atingido."); return }
      if (!res.ok) return
      if (data?.id) { trackEvent('TCC_CREATED', { plan: userPlan, workType: form.workType, norma: form.norma }); onCreated(data.id) }
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const handleNext = () => { trackEvent('ONBOARDING_STEP', { step, name: STEP_NAMES[step - 1], plan: userPlan }); if (step < TOTAL_STEPS) setStep(s => s + 1); else handleCreate() }
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={e => { if (e.target === e.currentTarget) handleClose() }}>
          <motion.div initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }} transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-lg bg-[#1a1a18] rounded-2xl shadow-2xl overflow-hidden border border-white/[0.10]">
            <div className="h-[2px] bg-white/[0.05]">
              <motion.div className="h-full bg-amber-500" animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }} transition={{ duration: 0.25, ease: "easeOut" }} />
            </div>
            <div className="p-7">
              <div className="flex items-center justify-between mb-7">
                <button onClick={() => (step > 1 ? setStep(s => s - 1) : handleClose())} className="flex items-center gap-1.5 text-sm text-white/35 hover:text-white/70 transition-colors">
                  <ArrowLeft size={15} />{step === 1 ? "Cancelar" : "Voltar"}
                </button>
                <div className="text-center">
                  <div className="text-xs font-semibold text-white/70">{STEP_NAMES[step - 1]}</div>
                  <div className="text-[10px] text-white/25 tabular-nums">{step} de {TOTAL_STEPS}</div>
                </div>
                <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"><X size={15} className="text-white/35" /></button>
              </div>
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div key="s1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }} className="space-y-4">
                    <div><h2 className="text-lg font-bold text-white/90 font-serif">Qual é o tema do seu TCC?</h2><p className="mt-1 text-sm text-white/35">Pode ser uma ideia inicial — você refina depois.</p></div>
                    <textarea autoFocus value={form.title} onChange={e => patch("title", e.target.value)} placeholder="Ex: O impacto da inteligência artificial na educação básica brasileira…" className={cn(INPUT_CLS, "min-h-[110px] resize-none")} onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey && canNext) handleNext() }} />
                    <p className="text-[11px] text-white/25">Dica: quanto mais específico o tema, mais focada fica a IA.</p>
                  </motion.div>
                )}
                {step === 2 && (
                  <motion.div key="s2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }} className="space-y-4">
                    <div><h2 className="text-lg font-bold text-white/90 font-serif">Dados acadêmicos</h2><p className="mt-1 text-sm text-white/35">Essenciais para a IA adaptar tom e estrutura.</p></div>
                    <div className="space-y-3">
                      <div><label className="flex items-center gap-1.5 text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1.5"><Book size={10} /> Curso</label><input autoFocus type="text" value={form.course} onChange={e => patch("course", e.target.value)} placeholder="Ex: Engenharia de Software" className={INPUT_CLS} /></div>
                      <div><label className="flex items-center gap-1.5 text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1.5"><School size={10} /> Faculdade / Instituição</label><input type="text" value={form.institution} onChange={e => patch("institution", e.target.value)} placeholder="Ex: USP, UNESP, Mackenzie…" className={INPUT_CLS} /></div>
                    </div>
                  </motion.div>
                )}
                {step === 3 && (
                  <motion.div key="s3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }} className="space-y-4">
                    <div><h2 className="text-lg font-bold text-white/90 font-serif">Tipo de trabalho e norma</h2><p className="mt-1 text-sm text-white/35">Define estrutura e estilo de citação da IA.</p></div>
                    <div className="space-y-4">
                      <div><label className="flex items-center gap-1.5 text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1.5"><FileCheck size={10} /> Tipo</label><select value={form.workType} onChange={e => patch("workType", e.target.value)} className={cn(INPUT_CLS, "appearance-none cursor-pointer")}>{WORK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                      <div>
                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2 block">Norma</label>
                        <div className="flex flex-wrap gap-2">
                          {NORMAS.map(n => (
                            <button key={n} type="button" onClick={() => patch("norma", n)} className={cn("px-4 py-2 rounded-xl text-sm font-medium border transition-colors", form.norma === n ? "bg-white text-[#111110] border-white" : "bg-transparent text-white/40 border-white/[0.10] hover:border-white/25 hover:text-white/60")}>{n}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
                {step === 4 && (
                  <motion.div key="s4" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }} className="space-y-4">
                    <div><h2 className="text-lg font-bold text-white/90 font-serif">Prazo e objetivo</h2><p className="mt-1 text-sm text-white/35">Com objetivo claro, o Teseo orienta com mais precisão.</p></div>
                    <div className="space-y-3">
                      <div><label className="flex items-center gap-1.5 text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1.5"><Calendar size={10} /> Prazo <span className="normal-case font-normal">(opcional)</span></label><input type="date" value={form.deadline} onChange={e => patch("deadline", e.target.value)} className={INPUT_CLS} /></div>
                      <div><label className="flex items-center gap-1.5 text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1.5"><Target size={10} /> Objetivo / problema de pesquisa</label><textarea autoFocus value={form.objective} onChange={e => patch("objective", e.target.value)} placeholder="Ex: Analisar como modelos de linguagem podem reduzir o tempo de produção…" className={cn(INPUT_CLS, "min-h-[100px] resize-none")} /></div>
                    </div>
                  </motion.div>
                )}
                {step === 5 && (
                  <motion.div key="s5" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }} className="space-y-5">
                    {(slotError || atSlotLimit) ? (
                      <div className="text-center space-y-4">
                        <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto"><Crown className="w-5 h-5 text-amber-500" /></div>
                        <div><h2 className="text-lg font-bold text-white/90">Limite atingido</h2><p className="mt-1 text-sm text-white/35">{slotError || `Plano ${userPlan}: ${slotLimit} projeto${slotLimit > 1 ? "s" : ""} simultâneo${slotLimit > 1 ? "s" : ""}.`}</p></div>
                        <Link href="/pricing" onClick={handleClose} className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-[#111110] text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"><Crown size={14} /> Ver planos</Link>
                      </div>
                    ) : (
                      <>
                        <div className="text-center">
                          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3"><Sparkles className="w-5 h-5 text-amber-500" /></div>
                          <h2 className="text-lg font-bold text-white/90 font-serif">Tudo certo — pronto para começar</h2>
                          <p className="mt-1 text-sm text-white/35">O Teseo vai preparar seu workspace com este contexto.</p>
                        </div>
                        <div className="bg-[#111110] border border-white/[0.07] rounded-xl divide-y divide-white/[0.05] overflow-hidden">
                          {summaryRows.map(row => (
                            <div key={row.label} className="flex gap-3 px-4 py-2.5">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-white/25 w-14 pt-0.5 shrink-0">{row.label}</span>
                              <span className="text-sm text-white/70 font-medium line-clamp-2">{row.value}</span>
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
                  <button onClick={handleNext} disabled={!canNext || loading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-[#111110] text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-25 disabled:cursor-not-allowed">
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
    try { await fetch(`/api/tcc/${id}`, { method: "DELETE" }); setTccs(prev => prev.filter(t => t.id !== id)); trackEvent('TCC_DELETED', { plan: userPlan }) }
    catch (e) { console.error(e) }
    finally { setDeletingId(null); setConfirmDeleteId(null) }
  }

  React.useEffect(() => { if (status === "unauthenticated") router.push("/") }, [router, status])

  const loadTccs = React.useCallback(async () => {
    setLoadingTccs(true)
    try {
      const res = await fetch("/api/tcc", { cache: "no-store" }); if (!res.ok) return
      const text = await res.text(); if (!text) return
      const data = JSON.parse(text); if (Array.isArray(data)) setTccs(data)
    } catch (e) { console.error(e) }
    finally { setLoadingTccs(false) }
  }, [])

  React.useEffect(() => { if (status === "authenticated") void loadTccs() }, [status, loadTccs])

  if (status === "loading") return null

  const firstName = session?.user?.name?.split(" ")[0] ?? null
  const canAddMore = tccs.length < tccSlotLimit
  const slotsLeft = tccSlotLimit - tccs.length

  return (
    <div className="flex min-h-[100dvh] bg-[#0F0F0E] text-white font-sans">

      {/* ── Left nav sidebar ── */}
      <AppSidebar />

      {/* ── Page content (offset by sidebar width) ── */}
      <div className="flex-1 flex flex-col pl-[52px]">

        {/* Top bar */}
        <header className="h-[52px] border-b border-white/[0.06] bg-[#0F0F0E] sticky top-0 z-30 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-white/25 uppercase tracking-widest">MANUSCRIPT</span>
            <span className="text-white/10">·</span>
            <span className="text-[11px] text-white/15 uppercase tracking-widest">OUTLINE</span>
            <span className="text-white/10">·</span>
            <span className="text-[11px] text-white/15 uppercase tracking-widest">ARCHIVE</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-[#161614] border border-white/[0.07] rounded-lg px-3 py-1.5">
              <span className="text-[11px] text-white/25">Buscar...</span>
            </div>
            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white/25 hover:text-white/50 hover:bg-white/[0.05] transition-all">
              <Bell size={14} />
            </button>
            <PlanBadge plan={userPlan} />
            <button onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[#111110] text-xs font-bold hover:opacity-90 transition-opacity">
              <Plus size={13} /> Novo TCC
            </button>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 px-8 py-8 overflow-y-auto">
          {loadingTccs ? (
            <div className="flex items-center justify-center py-32"><Loader2 className="w-5 h-5 animate-spin text-white/20" /></div>
          ) : tccs.length === 0 ? (
            <EmptyState onNew={() => setModalOpen(true)} />
          ) : (
            <div className="max-w-5xl mx-auto">

              {/* Overview */}
              <div className="mb-8">
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1">OVERVIEW</p>
                <div className="flex items-end justify-between gap-4">
                  <h1 className="text-3xl font-bold text-white/90 font-serif">
                    {getHour()}{firstName ? `, ${firstName}` : ""}.
                  </h1>
                  <button onClick={() => setModalOpen(true)}
                    className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-white/70 text-sm font-bold rounded-xl transition-all">
                    <Plus size={14} /> NEW MANUSCRIPT
                  </button>
                </div>
              </div>

              {/* Two-column */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8">

                {/* Left */}
                <div className="space-y-8">
                  {/* Active projects */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">ACTIVE PROJECTS</p>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setView("grid")} className={cn("p-1.5 rounded-lg transition-colors", view === "grid" ? "bg-white/[0.08] text-white/70" : "text-white/25 hover:text-white/50")}><LayoutGrid size={13} /></button>
                        <button onClick={() => setView("list")} className={cn("p-1.5 rounded-lg transition-colors", view === "list" ? "bg-white/[0.08] text-white/70" : "text-white/25 hover:text-white/50")}><List size={13} /></button>
                      </div>
                    </div>
                    {view === "grid" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <AnimatePresence>
                          {tccs.map(tcc => (
                            <TccCardGrid key={tcc.id} tcc={tcc} confirmDeleteId={confirmDeleteId} deletingId={deletingId} onConfirmDelete={setConfirmDeleteId} onCancelDelete={() => setConfirmDeleteId(null)} onDelete={handleDelete} />
                          ))}
                        </AnimatePresence>
                        {canAddMore && (
                          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setModalOpen(true)}
                            className="group min-h-[180px] bg-transparent border border-dashed border-white/[0.08] rounded-2xl p-5 flex flex-col items-center justify-center gap-3 hover:border-white/[0.16] hover:bg-white/[0.02] transition-all cursor-pointer">
                            <div className="w-9 h-9 rounded-full border border-white/[0.08] group-hover:border-white/[0.16] flex items-center justify-center transition-colors">
                              <Plus size={16} className="text-white/25 group-hover:text-white/50 transition-colors" />
                            </div>
                            <div className="text-center">
                              <div className="text-xs font-semibold text-white/25 group-hover:text-white/50 transition-colors">Novo projeto</div>
                              <div className="text-[10px] text-white/15 mt-0.5">{slotsLeft} vaga{slotsLeft !== 1 ? "s" : ""}</div>
                            </div>
                          </motion.button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <AnimatePresence>
                          {tccs.map(tcc => (
                            <TccCardList key={tcc.id} tcc={tcc} confirmDeleteId={confirmDeleteId} deletingId={deletingId} onConfirmDelete={setConfirmDeleteId} onCancelDelete={() => setConfirmDeleteId(null)} onDelete={handleDelete} />
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </section>

                  {!canAddMore && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Crown className="w-4 h-4 text-amber-500/70 shrink-0" />
                        <p className="text-sm text-white/40">Limite do plano <strong className="text-white/60">{userPlan === "FREE" ? "Gratuito" : userPlan}</strong> atingido.</p>
                      </div>
                      <Link href="/pricing" className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-colors">Ver planos</Link>
                    </motion.div>
                  )}

                  {/* Intelligence Feed */}
                  <section>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-4">INTELLIGENCE FEED</p>
                    <IntelligenceFeed tccs={tccs} />
                  </section>
                </div>

                {/* Right sidebar stats */}
                <aside className="hidden lg:block">
                  <SidebarStats tccs={tccs} userPlan={userPlan} />
                </aside>
              </div>
            </div>
          )}
        </main>
      </div>

      <NewTccModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={id => { setModalOpen(false); router.push(`/tcc/${id}`) }} userPlan={userPlan} tccCount={tccs.length} />
      <DevPlanSwitcher />
    </div>
  )
}
