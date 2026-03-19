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
  Book, School, Calendar, Target, FileCheck, ChevronRight, Trash2, Crown,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ──────────────────────────────────────────────────────────────────

type Tcc = {
  id: string
  title: string
  course: string
  institution: string
  workType?: string | null
  norma?: string | null
  status: string
  createdAt: string
  updatedAt: string
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

// ─── Mottos ──────────────────────────────────────────────────────────────────

const TITLES = [
  "Reflexões ao entardecer",
  "Coruja da madrugada",
  "Sol da meia-noite",
  "Entre linhas e silêncio",
  "Caderno aberto",
  "Ritmo de trabalho",
  "Manhã de escrita",
]

const BYLINES = [
  "Uma boa página começa com uma boa pergunta.",
  "Quando a casa dorme, as ideias acordam.",
  "Disciplina é gentileza com o seu futuro.",
  "Escrever é organizar o caos com calma.",
  "O rascunho é o caminho mais curto para o texto final.",
  "Pouco por dia vence muito de vez em quando.",
  "Clareza primeiro; o resto acompanha.",
]

const WRITERS = [
  "Clarice Lispector",
  "Machado de Assis",
  "Fernando Pessoa",
  "Virginia Woolf",
  "Jorge Luis Borges",
  "Franz Kafka",
  "Cecília Meireles",
  "Carlos Drummond de Andrade",
]

function safeParseInt(value: string) {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : null
}

function randIndex(maxExclusive: number) {
  if (maxExclusive <= 1) return 0
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return buf[0] % maxExclusive
  }
  return Math.floor(Math.random() * maxExclusive)
}

function pickMotto() {
  const lastKey = "teseo.dashboard.motto.last"
  const last = typeof window !== "undefined" ? window.sessionStorage.getItem(lastKey) : null
  const lastParsed = last ? safeParseInt(last) : null

  let titleIndex = randIndex(TITLES.length)
  if (lastParsed !== null && TITLES.length > 1 && titleIndex === lastParsed) {
    titleIndex = (titleIndex + 1) % TITLES.length
  }
  if (typeof window !== "undefined") window.sessionStorage.setItem(lastKey, String(titleIndex))

  const bylineIndex = randIndex(BYLINES.length)
  const writer = WRITERS[randIndex(WRITERS.length)]
  return { title: TITLES[titleIndex], byline: `${BYLINES[bylineIndex]} — ${writer}` }
}

// ─── Plan badge ───────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string }) {
  const cls =
    plan === "VIP"
      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
      : plan === "PRO"
      ? "bg-[#fdf0eb] text-[#c4663a] border-[#c4663a]/20 dark:bg-[#c4663a]/10 dark:text-[#e88b6c] dark:border-[#c4663a]/20"
      : "bg-[color:var(--color-brand-hover)] text-[color:var(--color-brand-muted)] border-[color:var(--color-brand-border)]"
  return (
    <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide border", cls)}>
      {plan === "FREE" ? "Gratuito" : plan}
    </span>
  )
}

// ─── NewTccModal ─────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5
const WORK_TYPES = ["TCC", "Monografia", "Dissertação de Mestrado", "Tese de Doutorado", "Artigo Científico", "Relatório de Estágio"]
const NORMAS = ["ABNT", "APA", "Vancouver", "Chicago", "Outra"]

const INPUT_CLS =
  "w-full bg-[color:var(--color-brand-bg)] border border-[color:var(--color-brand-border)] rounded-xl px-4 py-3 text-sm text-[color:var(--color-brand-text)] placeholder:text-[color:var(--color-brand-muted)] focus:outline-none focus:border-[color:var(--color-brand-text)] transition-colors"

function NewTccModal({
  open,
  onClose,
  onCreated,
  userPlan,
  tccCount,
}: {
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
  userPlan: string
  tccCount: number
}) {
  const [step, setStep] = React.useState(1)
  const [loading, setLoading] = React.useState(false)
  const [slotError, setSlotError] = React.useState("")
  const [form, setForm] = React.useState<FormData>({
    title: "",
    course: "",
    institution: "",
    workType: "TCC",
    norma: "ABNT",
    deadline: "",
    objective: "",
  })

  const patch = (key: keyof FormData, val: string) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const canNext = React.useMemo(() => {
    if (step === 1) return form.title.trim().length > 0
    if (step === 2) return form.course.trim().length > 0 && form.institution.trim().length > 0
    if (step === 3) return form.workType.length > 0 && form.norma.length > 0
    if (step === 4) return form.objective.trim().length > 0
    return true
  }, [step, form])

  const handleNext = () => {
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
          title: form.title,
          course: form.course,
          institution: form.institution,
          workType: form.workType,
          norma: form.norma,
          deadline: form.deadline || null,
          objective: form.objective,
        }),
      })
      const text = await res.text()
      if (!text) return
      const data = JSON.parse(text)
      if (data?.limitReached) {
        setSlotError(data.error ?? "Limite de projetos atingido.")
        return
      }
      if (!res.ok) return
      if (data?.id) onCreated(data.id)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    onClose()
    setTimeout(() => { setStep(1); setSlotError("") }, 300)
  }

  const slotLimit = userPlan === "VIP" ? 2 : 1
  const atSlotLimit = tccCount >= slotLimit

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
          onClick={e => { if (e.target === e.currentTarget) handleClose() }}
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative w-full max-w-lg bg-[color:var(--color-brand-surface)] rounded-2xl shadow-2xl overflow-hidden border border-[color:var(--color-brand-border)]"
          >
            {/* Progress bar */}
            <div className="h-0.5 bg-[color:var(--color-brand-border)]">
              <motion.div
                className="h-full bg-[color:var(--color-brand-text)]"
                animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              />
            </div>

            <div className="p-7">
              {/* Modal nav */}
              <div className="flex items-center justify-between mb-7">
                <button
                  onClick={() => (step > 1 ? setStep(s => s - 1) : handleClose())}
                  className="flex items-center gap-1.5 text-sm text-[color:var(--color-brand-muted)] hover:text-[color:var(--color-brand-text)] transition-colors"
                >
                  <ArrowLeft size={15} />
                  {step === 1 ? "Cancelar" : "Voltar"}
                </button>
                <span className="text-xs text-[color:var(--color-brand-muted)] tabular-nums">
                  {step} / {TOTAL_STEPS}
                </span>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg hover:bg-[color:var(--color-brand-hover)] transition-colors"
                >
                  <X size={15} className="text-[color:var(--color-brand-muted)]" />
                </button>
              </div>

              {/* Steps */}
              <AnimatePresence mode="wait">

                {step === 1 && (
                  <motion.div key="s1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-[color:var(--color-brand-text)]">Qual é o tema do seu TCC?</h2>
                      <p className="mt-1 text-sm text-[color:var(--color-brand-muted)]">Pode ser uma ideia inicial ou um título provisório.</p>
                    </div>
                    <textarea
                      autoFocus
                      value={form.title}
                      onChange={e => patch("title", e.target.value)}
                      placeholder="Ex: O impacto da inteligência artificial na educação básica brasileira..."
                      className={cn(INPUT_CLS, "min-h-[110px] resize-none")}
                    />
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div key="s2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-[color:var(--color-brand-text)]">Dados acadêmicos</h2>
                      <p className="mt-1 text-sm text-[color:var(--color-brand-muted)]">Ajudam a IA a adaptar o tom e as normas corretas.</p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-brand-muted)] uppercase tracking-wider mb-1.5">
                          <Book size={11} /> Curso
                        </label>
                        <input
                          autoFocus
                          type="text"
                          value={form.course}
                          onChange={e => patch("course", e.target.value)}
                          placeholder="Ex: Engenharia de Software"
                          className={INPUT_CLS}
                        />
                      </div>
                      <div>
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-brand-muted)] uppercase tracking-wider mb-1.5">
                          <School size={11} /> Faculdade / Instituição
                        </label>
                        <input
                          type="text"
                          value={form.institution}
                          onChange={e => patch("institution", e.target.value)}
                          placeholder="Ex: USP, UNESP, Mackenzie…"
                          className={INPUT_CLS}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div key="s3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-[color:var(--color-brand-text)]">Tipo de trabalho e norma</h2>
                      <p className="mt-1 text-sm text-[color:var(--color-brand-muted)]">Define a estrutura e o estilo de citação que a IA vai usar.</p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-brand-muted)] uppercase tracking-wider mb-1.5">
                          <FileCheck size={11} /> Tipo de trabalho
                        </label>
                        <select
                          value={form.workType}
                          onChange={e => patch("workType", e.target.value)}
                          className={cn(INPUT_CLS, "appearance-none cursor-pointer")}
                        >
                          {WORK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-[color:var(--color-brand-muted)] uppercase tracking-wider mb-2 block">
                          Norma de formatação
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {NORMAS.map(n => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => patch("norma", n)}
                              className={cn(
                                "px-4 py-2 rounded-xl text-sm font-medium border transition-colors",
                                form.norma === n
                                  ? "bg-[color:var(--color-brand-text)] text-[color:var(--color-brand-bg)] border-[color:var(--color-brand-text)]"
                                  : "bg-[color:var(--color-brand-bg)] text-[color:var(--color-brand-muted)] border-[color:var(--color-brand-border)] hover:border-[color:var(--color-brand-text)] hover:text-[color:var(--color-brand-text)]"
                              )}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 4 && (
                  <motion.div key="s4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-[color:var(--color-brand-text)]">Prazo e objetivo</h2>
                      <p className="mt-1 text-sm text-[color:var(--color-brand-muted)]">Quanto mais claro o objetivo, mais focado fica o workspace.</p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-brand-muted)] uppercase tracking-wider mb-1.5">
                          <Calendar size={11} /> Prazo de entrega <span className="normal-case font-normal">(opcional)</span>
                        </label>
                        <input
                          type="date"
                          value={form.deadline}
                          onChange={e => patch("deadline", e.target.value)}
                          className={INPUT_CLS}
                        />
                      </div>
                      <div>
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-brand-muted)] uppercase tracking-wider mb-1.5">
                          <Target size={11} /> Objetivo / problema de pesquisa
                        </label>
                        <textarea
                          autoFocus
                          value={form.objective}
                          onChange={e => patch("objective", e.target.value)}
                          placeholder="Ex: Analisar como modelos de linguagem podem reduzir o tempo de produção sem comprometer a qualidade acadêmica..."
                          className={cn(INPUT_CLS, "min-h-[100px] resize-none")}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 5 && (
                  <motion.div key="s5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="space-y-5">
                    {/* Slot limit error state */}
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
                        <Link
                          href="/pricing"
                          onClick={handleClose}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[color:var(--color-brand-text)] hover:opacity-80 text-[color:var(--color-brand-bg)] text-sm font-semibold rounded-xl transition-opacity"
                        >
                          <Crown size={14} /> Ver planos e fazer upgrade
                        </Link>
                      </div>
                    ) : (
                      <>
                        <div className="text-center">
                          <div className="w-12 h-12 bg-[color:var(--color-brand-accent)]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Sparkles className="w-6 h-6 text-[color:var(--color-brand-accent)]" />
                          </div>
                          <h2 className="text-lg font-bold text-[color:var(--color-brand-text)]">Tudo pronto para começar</h2>
                          <p className="mt-1 text-sm text-[color:var(--color-brand-muted)]">Revise o resumo antes de criar o workspace.</p>
                        </div>
                        <div className="bg-[color:var(--color-brand-bg)] border border-[color:var(--color-brand-border)] rounded-xl p-5 space-y-3">
                          <div className="text-[10px] font-bold text-[color:var(--color-brand-muted)] uppercase tracking-widest">Resumo do projeto</div>
                          <p className="font-semibold text-[color:var(--color-brand-text)] leading-snug">"{form.title}"</p>
                          <div className="space-y-1 text-sm text-[color:var(--color-brand-muted)]">
                            <div>{form.course} · {form.institution}</div>
                            <div>{form.workType} · Norma {form.norma}</div>
                            {form.deadline && (
                              <div>Prazo: {new Date(form.deadline + "T00:00:00").toLocaleDateString("pt-BR")}</div>
                            )}
                            {form.objective && (
                              <p className="pt-1 text-xs line-clamp-2">{form.objective}</p>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}

              </AnimatePresence>

              {/* CTA */}
              <div className="mt-7 flex justify-end">
                <button
                  onClick={handleNext}
                  disabled={!canNext || loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[color:var(--color-brand-text)] hover:opacity-80 text-[color:var(--color-brand-bg)] text-sm font-semibold rounded-xl transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  {step === TOTAL_STEPS ? "Criar workspace" : "Continuar"}
                  {step < TOTAL_STEPS && !loading && <ArrowRight size={15} />}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const userPlan = useUserPlan()
  const tccSlotLimit = getTccSlotLimit(userPlan)

  const [loadingTccs, setLoadingTccs] = React.useState(true)
  const [tccs, setTccs] = React.useState<Tcc[]>([])
  const [motto, setMotto] = React.useState<{ title: string; byline: string }>({
    title: "Bem-vindo ao Teseo",
    byline: "Selecione um projeto à esquerda para abrir o workspace.",
  })
  const [modalOpen, setModalOpen] = React.useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await fetch(`/api/tcc/${id}`, { method: "DELETE" })
      setTccs(prev => prev.filter(t => t.id !== id))
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

  React.useEffect(() => {
    setMotto(pickMotto())
  }, [])

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

  return (
    <div className="min-h-[100dvh] bg-[color:var(--color-brand-bg)] text-[color:var(--color-brand-text)]">
      {/* ── Header ── */}
      <header className="h-[60px] border-b border-[color:var(--color-brand-border)] bg-[color:var(--color-brand-surface)]">
        <div className="w-full px-5 sm:px-6 h-full flex items-center justify-between gap-3">
          {/* Left: identity */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[color:var(--color-brand-text)] grid place-items-center shrink-0">
              <span className="text-[color:var(--color-brand-bg)] font-bold text-xs leading-none">T</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-none truncate">Dashboard</div>
              <div className="text-[11px] text-[color:var(--color-brand-muted)] mt-0.5 truncate">
                {session?.user?.email}
              </div>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 shrink-0">
            <PlanBadge plan={userPlan} />
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[color:var(--color-brand-text)] hover:opacity-80 text-[color:var(--color-brand-bg)] text-sm font-semibold transition-opacity"
            >
              <Plus size={14} /> Novo TCC
            </button>
            <Link
              href="/"
              className="hidden sm:inline-flex px-3 py-1.5 rounded-lg text-sm text-[color:var(--color-brand-muted)] hover:text-[color:var(--color-brand-text)] hover:bg-[color:var(--color-brand-hover)] border border-[color:var(--color-brand-border)] transition-colors"
            >
              Voltar ao site
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
      <main className="w-full px-5 sm:px-6 py-7 min-h-[calc(100dvh-60px)]">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-start min-h-[calc(100dvh-60px-56px)]">

          {/* Sidebar: TCC list */}
          <aside className="rounded-xl bg-[color:var(--color-brand-surface)] border border-[color:var(--color-brand-border)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[color:var(--color-brand-border)] flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-widest text-[color:var(--color-brand-muted)] uppercase">
                Seus projetos
              </span>
              <span className={cn(
                "text-[10px] font-semibold tabular-nums",
                tccs.length >= tccSlotLimit
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-[color:var(--color-brand-muted)]"
              )}>
                {tccs.length}/{tccSlotLimit}
              </span>
            </div>

            <div className="p-2">
              {loadingTccs ? (
                <div className="px-3 py-4 flex items-center gap-2 text-sm text-[color:var(--color-brand-muted)]">
                  <Loader2 size={13} className="animate-spin" /> Carregando…
                </div>
              ) : tccs.length === 0 ? (
                <div className="px-3 py-8 text-center space-y-4">
                  <p className="text-sm text-[color:var(--color-brand-muted)]">
                    Nenhum projeto ainda.
                  </p>
                  <button
                    onClick={() => setModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[color:var(--color-brand-text)] hover:opacity-80 text-[color:var(--color-brand-bg)] text-sm font-semibold transition-opacity"
                  >
                    <Plus size={14} /> Criar primeiro TCC
                  </button>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {tccs.map(tcc => (
                    <div key={tcc.id} className="group relative">
                      {confirmDeleteId === tcc.id ? (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[color:var(--color-brand-hover)]">
                          <span className="text-xs text-[color:var(--color-brand-muted)] flex-1">Excluir projeto?</span>
                          <button
                            onClick={() => handleDelete(tcc.id)}
                            disabled={deletingId === tcc.id}
                            className="text-[11px] font-semibold text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
                          >
                            {deletingId === tcc.id ? <Loader2 size={11} className="animate-spin" /> : "Confirmar"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-[color:var(--color-brand-muted)] hover:text-[color:var(--color-brand-text)] transition-colors"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <Link
                          href={`/tcc/${tcc.id}`}
                          className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-[color:var(--color-brand-hover)] transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate text-[color:var(--color-brand-text)]">
                              {tcc.title}
                            </div>
                            <div className="text-[11px] text-[color:var(--color-brand-muted)] truncate mt-0.5">
                              {tcc.course} · {tcc.institution}
                              {tcc.norma ? ` · ${tcc.norma}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <button
                              onClick={e => { e.preventDefault(); setConfirmDeleteId(tcc.id) }}
                              className="p-1 rounded opacity-0 group-hover:opacity-100 text-[color:var(--color-brand-muted)] hover:text-red-500 transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                            <ChevronRight size={13} className="text-[color:var(--color-brand-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* Center: editorial motto */}
          <section className="min-h-[480px] lg:min-h-[calc(100dvh-60px-56px)] flex items-center justify-center">
            <div className="w-full text-center space-y-5 mx-auto">
              <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold tracking-tight font-serif text-[color:var(--color-brand-text)] leading-[1.05]">
                {motto.title}
              </h1>
              <p className="text-base sm:text-lg text-[color:var(--color-brand-muted)] leading-relaxed">
                {motto.byline}
              </p>
              <p className="pt-4 text-sm text-[color:var(--color-brand-muted)]/50">
                {tccs.length === 0
                  ? "Comece criando seu primeiro projeto."
                  : "Selecione um projeto à esquerda para abrir o workspace."}
              </p>
            </div>
          </section>

        </div>
      </main>

      {/* ── Modal ── */}
      <NewTccModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={id => {
          setModalOpen(false)
          router.push(`/tcc/${id}`)
        }}
        userPlan={userPlan}
        tccCount={tccs.length}
      />
      <DevPlanSwitcher />
    </div>
  )
}
