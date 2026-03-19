"use client"

import * as React from "react"
import { useUserPlan } from "@/hooks/useUserPlan"
import { motion } from "framer-motion"
import { Check, X, ArrowLeft, Loader2, Crown, Zap, Star, MessageCircle, FileText, RefreshCw, Layers } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

type PlanVariant = "muted" | "pro" | "vip"

interface PlanFeature {
  text: string
  included: boolean
}

interface Plan {
  id: string
  name: string
  price: string
  priceNote?: string
  description: string
  featured?: boolean
  badge?: string
  icon: React.ReactNode
  features: PlanFeature[]
  cta: string
  variant: PlanVariant
}

export default function PricingPage() {
  const [loading, setLoading] = React.useState<string | null>(null)
  const userPlan = useUserPlan()

  const handleUpgrade = async (plan: "PRO" | "VIP") => {
    setLoading(plan)
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (err) {
      console.error(err)
      alert("Erro ao iniciar checkout. Tente novamente.")
    } finally {
      setLoading(null)
    }
  }

  const plans: Plan[] = [
    {
      id: "FREE",
      name: "Gratuito",
      price: "R$ 0",
      description: "Para conhecer o Teseo",
      icon: <Zap size={18} className="text-white/40" />,
      variant: "muted",
      cta: userPlan === "FREE" ? "Plano atual" : "Downgrade",
      features: [
        { text: "3 mensagens de IA por dia", included: true },
        { text: "1 projeto ativo", included: true },
        { text: "Estrutura básica de capítulos", included: true },
        { text: "5 uploads de referências", included: true },
        { text: "Export com marca d'água", included: true },
        { text: "Revisão por capítulo", included: false },
        { text: "Export limpo em PDF", included: false },
        { text: "Consistência global do TCC", included: false },
      ],
    },
    {
      id: "PRO",
      name: "PRO",
      price: "R$ 200",
      priceNote: "por TCC",
      description: "Para quem quer terminar o TCC com qualidade",
      icon: <Star size={18} className="text-white" />,
      variant: "pro",
      cta: userPlan === "PRO" ? "Plano atual" : userPlan === "VIP" ? "Plano inferior" : "Começar com PRO",
      features: [
        { text: "50 mensagens de IA por dia", included: true },
        { text: "1 projeto completo", included: true },
        { text: "Revisão por capítulo com IA", included: true },
        { text: "20 uploads de referências PDF", included: true },
        { text: "Export em PDF sem marca d'água", included: true },
        { text: "IA com contexto acadêmico ABNT", included: true },
        { text: "2 projetos simultâneos", included: false },
        { text: "Consistência global do TCC", included: false },
      ],
    },
    {
      id: "VIP",
      name: "VIP",
      price: "R$ 1.000",
      priceNote: "2 TCCs simultâneos",
      description: "Para quem precisa do melhor resultado possível",
      featured: true,
      badge: "Recomendado",
      icon: <Crown size={18} className="text-amber-400" />,
      variant: "vip",
      cta: userPlan === "VIP" ? "Plano atual" : "Começar com VIP",
      features: [
        { text: "Mensagens de IA ilimitadas", included: true },
        { text: "2 projetos simultâneos", included: true },
        { text: "Revisão completa do trabalho com IA", included: true },
        { text: "50 uploads de referências PDF", included: true },
        { text: "Export premium sem marca d'água", included: true },
        { text: "IA com máxima precisão e contexto", included: true },
        { text: "Consistência global e ABNT automática", included: true },
        { text: "Suporte direto via WhatsApp", included: true },
      ],
    },
  ]

  const highlights = [
    { icon: <MessageCircle size={20} />, label: "IA Precisa", desc: "Contexto acadêmico real, não respostas genéricas" },
    { icon: <FileText size={20} />, label: "ABNT Nativo", desc: "Citações e referências no padrão correto" },
    { icon: <RefreshCw size={20} />, label: "Revisão Real", desc: "Análise crítica de consistência e argumentação" },
    { icon: <Layers size={20} />, label: "Resultado Final", desc: "Export em PDF pronto para entrega" },
  ]

  return (
    <div className="min-h-screen bg-[#0C0C0B] text-white">
      {/* Subtle ambient */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute top-0 right-[20%] w-[500px] h-[500px] bg-amber-500/[0.04] blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-[10%] w-[400px] h-[400px] bg-white/[0.02] blur-[100px] rounded-full" />
      </div>

      <nav className="relative z-10 px-6 py-5 flex items-center justify-between max-w-5xl mx-auto">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors text-sm group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Dashboard
        </Link>
        <div className="text-sm font-semibold tracking-wide text-white/60">Teseo</div>
      </nav>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12 pb-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-16"
        >
          <p className="text-[11px] font-bold tracking-widest text-white/30 uppercase mb-4">Planos</p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 text-white">
            Conclua seu TCC com qualidade
          </h1>
          <p className="text-white/40 text-lg max-w-xl mx-auto leading-relaxed">
            Escolha o plano que se encaixa na sua situação. Sem surpresas, sem mensalidade.
          </p>
        </motion.div>

        {/* Plans grid */}
        <div className="grid md:grid-cols-3 gap-4 items-stretch mb-16">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.35 }}
              className={cn(
                "relative flex flex-col rounded-2xl border transition-all duration-300",
                plan.variant === "vip" &&
                  "border-amber-500/30 bg-amber-500/[0.04] ring-1 ring-amber-500/10",
                plan.variant === "pro" &&
                  "border-white/10 bg-white/[0.03] hover:border-white/20",
                plan.variant === "muted" && "border-white/[0.06] bg-white/[0.01]"
              )}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[10px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
                  {plan.badge}
                </div>
              )}

              <div className="p-6 flex-1 flex flex-col">
                {/* Plan header */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg grid place-items-center",
                      plan.variant === "vip" ? "bg-amber-500/15" : "bg-white/[0.06]"
                    )}>
                      {plan.icon}
                    </div>
                    <span className={cn(
                      "text-sm font-bold",
                      plan.variant === "vip" ? "text-amber-400" : "text-white/70"
                    )}>
                      {plan.name}
                    </span>
                    {userPlan === plan.id && (
                      <span className="ml-auto text-[10px] font-bold text-white/30 uppercase tracking-wider border border-white/10 px-2 py-0.5 rounded-full">
                        Atual
                      </span>
                    )}
                  </div>

                  <div className="mb-1">
                    <span className="text-3xl font-bold text-white tracking-tight">{plan.price}</span>
                    {plan.priceNote && (
                      <span className="ml-2 text-xs text-white/30">{plan.priceNote}</span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed">{plan.description}</p>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map(feature => (
                    <li key={feature.text} className="flex items-start gap-2.5">
                      <div className={cn(
                        "mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center",
                        feature.included
                          ? plan.variant === "vip"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-white/10 text-white/60"
                          : "bg-transparent text-white/15"
                      )}>
                        {feature.included
                          ? <Check size={10} strokeWidth={2.5} />
                          : <X size={10} strokeWidth={2} />
                        }
                      </div>
                      <span className={cn(
                        "text-sm leading-snug",
                        feature.included
                          ? plan.variant === "vip" ? "text-white/80" : "text-white/50"
                          : "text-white/20 line-through"
                      )}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => {
                    if (plan.id !== "FREE" && userPlan !== plan.id && plan.variant !== "muted") {
                      handleUpgrade(plan.id as "PRO" | "VIP")
                    }
                  }}
                  disabled={
                    plan.id === "FREE" ||
                    userPlan === plan.id ||
                    plan.variant === "muted" ||
                    loading !== null ||
                    (userPlan === "VIP" && plan.id === "PRO")
                  }
                  className={cn(
                    "w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                    plan.variant === "vip" && userPlan !== "VIP" &&
                      "bg-amber-500 text-black hover:bg-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.2)]",
                    plan.variant === "vip" && userPlan === "VIP" &&
                      "bg-amber-500/20 text-amber-400/60 cursor-default",
                    plan.variant === "pro" && userPlan !== "PRO" && userPlan !== "VIP" &&
                      "bg-white text-[#0C0C0B] hover:opacity-90",
                    plan.variant === "pro" && (userPlan === "PRO" || userPlan === "VIP") &&
                      "bg-white/[0.06] text-white/30 cursor-default",
                    plan.variant === "muted" &&
                      "bg-white/[0.04] text-white/25 cursor-default"
                  )}
                >
                  {loading === plan.id ? <Loader2 size={16} className="animate-spin" /> : plan.cta}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Value props */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <p className="text-center text-[11px] font-bold tracking-widest text-white/20 uppercase mb-8">
            O que torna o Teseo diferente
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {highlights.map(h => (
              <div key={h.label} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                <div className="text-white/30">{h.icon}</div>
                <p className="text-sm font-semibold text-white/70">{h.label}</p>
                <p className="text-xs text-white/35 leading-relaxed">{h.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Footer note */}
        <p className="text-center text-xs text-white/20 mt-12">
          Pagamento único por projeto. Sem assinatura mensal. Sem renovação automática.
        </p>
      </main>
    </div>
  )
}
