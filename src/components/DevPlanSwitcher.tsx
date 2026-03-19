"use client"

/**
 * DevPlanSwitcher — floating plan override UI for local development.
 * Renders ONLY when NODE_ENV === "development". Invisible in production.
 *
 * Stores the chosen plan in localStorage (key: teseo_dev_plan) and reloads
 * the page so every component picks up the new value consistently.
 *
 * To clear the override: click the active plan label.
 */

import * as React from "react"
import { DEV_PLAN_STORAGE_KEY, VALID_PLANS, type Plan } from "@/lib/plan"

const IS_DEV = process.env.NODE_ENV === "development"

const PLAN_COLORS: Record<Plan, string> = {
  FREE: "bg-white/10 text-white/60 border-white/15",
  PRO: "bg-white/90 text-black border-white",
  VIP: "bg-amber-500 text-black border-amber-400",
}

const PLAN_ACTIVE: Record<Plan, string> = {
  FREE: "ring-1 ring-white/40",
  PRO: "ring-1 ring-white",
  VIP: "ring-1 ring-amber-300",
}

export function DevPlanSwitcher() {
  const [current, setCurrent] = React.useState<Plan | null>(null)
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const stored = (localStorage.getItem(DEV_PLAN_STORAGE_KEY) ?? "").toUpperCase() as Plan
    if ((VALID_PLANS as string[]).includes(stored)) setCurrent(stored)
  }, [])

  if (!IS_DEV) return null

  const select = (plan: Plan) => {
    if (current === plan) {
      // Clicking active plan clears the override
      localStorage.removeItem(DEV_PLAN_STORAGE_KEY)
      setCurrent(null)
    } else {
      localStorage.setItem(DEV_PLAN_STORAGE_KEY, plan)
      setCurrent(plan)
    }
    setOpen(false)
    window.location.reload()
  }

  return (
    <div className="fixed bottom-4 left-4 z-[9999] flex flex-col items-start gap-1.5">
      {/* Plan buttons — shown when open */}
      {open && (
        <div className="flex flex-col gap-1">
          {VALID_PLANS.map(plan => (
            <button
              key={plan}
              onClick={() => select(plan)}
              className={[
                "px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all",
                PLAN_COLORS[plan],
                current === plan ? PLAN_ACTIVE[plan] : "opacity-70 hover:opacity-100",
              ].join(" ")}
            >
              {plan === current ? `✓ ${plan}` : plan}
            </button>
          ))}
        </div>
      )}

      {/* Toggle pill */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/80 border border-white/10 text-white/40 hover:text-white/70 transition-colors text-[10px] font-bold tracking-widest uppercase"
        title="Dev plan switcher"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        DEV {current ?? "real"}
      </button>
    </div>
  )
}
