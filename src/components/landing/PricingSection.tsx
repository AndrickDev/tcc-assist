"use client"

import { Sparkle, Shield, Crown } from "lucide-react"
import { PricingCard, type PricingPlan } from "@/components/landing/PricingCard"

const PLANS: PricingPlan[] = [
  {
    key: "FREE",
    icon: <Sparkle size={18} />,
    name: "Grátis",
    subtitle: "Para começar e testar o fluxo.",
    priceLine: "R$ 0",
    cta: "Começar grátis",
    href: "/register",
    features: [
      "Criar seu primeiro TCC",
      "Estruturar o tema inicial",
      "Escrita assistida básica",
      "Acompanhar progresso do trabalho",
      "Exportação com limitações do plano",
    ],
  },
  {
    key: "PRO",
    icon: <Shield size={18} />,
    name: "Pro",
    subtitle: "Para desenvolver o TCC com mais profundidade.",
    priceLine: "R$ 200 / TCC",
    cta: "Assinar Pro",
    href: "/pricing",
    emphasized: true,
    features: [
      "Mais volume de geração e revisão",
      "Edição com mais liberdade",
      "Mais anexos por projeto",
      "Exportação limpa",
      "Fluxo melhor para entrega acadêmica",
    ],
  },
  {
    key: "VIP",
    icon: <Crown size={18} />,
    name: "VIP",
    subtitle: "Para uso avançado e acompanhamento intensivo.",
    priceLine: "R$ 1000 / projeto",
    cta: "Falar com a equipe",
    href: "/pricing",
    features: [
      "Limites ampliados",
      "Maior capacidade por projeto",
      "Fluxo mais robusto",
      "Mais controle sobre o material",
      "Suporte prioritário",
    ],
  },
]

export function PricingSection() {
  return (
    <section id="precos" className="py-20 md:py-24 bg-[#141413] text-white">
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-serif tracking-tight">
            Conferir planos
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <PricingCard key={plan.key} plan={plan} />
          ))}
        </div>
      </div>
    </section>
  )
}
