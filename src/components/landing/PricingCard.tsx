"use client"

import Link from "next/link"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export type PricingPlan = {
  key: "FREE" | "PRO" | "VIP"
  icon: React.ReactNode
  name: string
  subtitle: string
  priceLine: string
  cta: string
  href: string
  features: string[]
  emphasized?: boolean
}

export function PricingCard({ plan }: { plan: PricingPlan }) {
  return (
    <div
      className={cn(
        "rounded-[22px] border bg-[#141413] shadow-brand px-7 py-7 flex flex-col min-h-[520px]",
        plan.emphasized ? "border-white/20" : "border-white/10"
      )}
    >
      <div className="text-white/85">{plan.icon}</div>
      <div className="mt-4">
        <div className="text-lg font-semibold tracking-tight text-white">{plan.name}</div>
        <div className="mt-2 text-sm leading-relaxed text-white/60">{plan.subtitle}</div>
      </div>

      <div className="mt-6 text-sm text-white/75">{plan.priceLine}</div>

      <div className="mt-6">
        <Link
          href={plan.href}
          className="w-full inline-flex items-center justify-center px-4 py-3 rounded-full bg-[#FAF9F5] text-[#141413] text-sm font-semibold hover:bg-white transition-colors"
        >
          {plan.cta}
        </Link>
      </div>

      <div className="mt-7 h-px bg-white/10" />

      <ul className="mt-7 space-y-3 text-sm text-white/70">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-3">
            <span className="mt-0.5 text-white/55">
              <Check size={16} />
            </span>
            <span className="leading-relaxed">{f}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

