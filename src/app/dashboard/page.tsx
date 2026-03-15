"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { ArrowRight, FileText, LogOut, Plus } from "lucide-react"

type Tcc = {
  id: string
  title: string
  course: string
  institution: string
  status: string
  createdAt: string
  updatedAt: string
}

type Motto = {
  title: string
  byline: string
}

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

function pickMotto() {
  const lastKey = "teseo.dashboard.motto.last"
  const last = typeof window !== "undefined" ? window.sessionStorage.getItem(lastKey) : null
  const lastParsed = last ? safeParseInt(last) : null

  let titleIndex = randIndex(TITLES.length)
  if (lastParsed !== null && TITLES.length > 1 && titleIndex === lastParsed) {
    titleIndex = (titleIndex + 1) % TITLES.length
  }

  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(lastKey, String(titleIndex))
  }

  const bylineIndex = randIndex(BYLINES.length)
  const writer = WRITERS[randIndex(WRITERS.length)]
  return { title: TITLES[titleIndex], byline: `${BYLINES[bylineIndex]} — ${writer}` }
}

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

function hashString(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return hash
}

export default function DashboardPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [loadingTccs, setLoadingTccs] = React.useState(true)
  const [tccs, setTccs] = React.useState<Tcc[]>([])
  const [motto, setMotto] = React.useState<Motto>(() => ({ title: "Bem-vindo(a)", byline: "Selecione um TCC à esquerda para abrir seu workspace." }))

  React.useEffect(() => {
    if (status === "unauthenticated") router.push("/")
  }, [router, status])

  React.useEffect(() => {
    setMotto(pickMotto())
  }, [])

  React.useEffect(() => {
    let cancelled = false
    async function run() {
      setLoadingTccs(true)
      try {
        const res = await fetch("/api/tcc", { cache: "no-store" })
        const data = await res.json()
        if (!cancelled && Array.isArray(data)) setTccs(data)
      } finally {
        if (!cancelled) setLoadingTccs(false)
      }
    }
    if (status === "authenticated") void run()
    return () => {
      cancelled = true
    }
  }, [status])

  if (status === "loading") return null

  return (
    <div className="min-h-[100dvh] bg-[#141413] text-white">
      <header className="h-[76px] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 grid place-items-center">
              <FileText size={18} className="text-white/70" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-none">Dashboard</div>
              <div className="text-xs text-white/55 mt-1">{session?.user?.email}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors"
            >
              Voltar ao site
            </Link>
            <Link
              href="/dashboard/new-tcc"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors"
            >
              <Plus size={16} /> Novo TCC
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors"
            >
              <LogOut size={16} /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 items-start">
          <aside className="rounded-2xl bg-[#0F0F0E] border border-white/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <div className="text-xs font-semibold tracking-widest text-white/60">HISTÓRICO DO TCC</div>
            </div>

            <div className="p-2">
              {loadingTccs ? (
                <div className="p-4 text-sm text-white/60">Carregando…</div>
              ) : tccs.length === 0 ? (
                <div className="p-4 text-sm text-white/60">
                  Você ainda não tem nenhum TCC.
                  <div className="mt-3">
                    <Link
                      href="/dashboard/new-tcc"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors"
                    >
                      <Plus size={16} /> Criar primeiro TCC
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {tccs.map((tcc) => (
                    <Link
                      key={tcc.id}
                      href={`/tcc/${tcc.id}`}
                      className="block rounded-xl px-4 py-3 border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{tcc.title}</div>
                          <div className="text-xs text-white/55 truncate mt-1">
                            {tcc.course} • {tcc.institution}
                          </div>
                        </div>
                        <ArrowRight size={16} className="text-white/50 shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <section className="min-h-[520px] rounded-2xl bg-[#0F0F0E] border border-white/10 flex items-center justify-center px-6">
            <div className="max-w-2xl w-full text-center space-y-4">
              <div className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight font-serif">
                {motto.title}
              </div>
              <div className="text-base sm:text-lg text-white/60 leading-relaxed">
                {motto.byline}
              </div>

              <div className="pt-6 text-sm text-white/60">
                Selecione um TCC no histórico à esquerda para abrir o workspace.
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
