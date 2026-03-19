/**
 * plan.ts — centralized plan resolution for Teseo
 *
 * All plan logic lives here:
 *   - Plan type + valid values
 *   - Dev override via NEXT_PUBLIC_TESEO_DEV_PLAN (ignored in production)
 *   - Per-plan feature limits
 *
 * Usage:
 *   Server routes:  import { resolvePlan, getAttachmentLimit } from "@/lib/plan"
 *   Client hooks:   import { useUserPlan } from "@/hooks/useUserPlan"
 */

export type Plan = "FREE" | "PRO" | "VIP"

export const VALID_PLANS: Plan[] = ["FREE", "PRO", "VIP"]

/**
 * Returns the dev plan override when:
 *   - NODE_ENV === "development", AND
 *   - NEXT_PUBLIC_TESEO_DEV_PLAN is set to a valid plan string
 *
 * Returns null in production, or when the variable is absent/invalid.
 *
 * This function works in both server (API routes) and client (React) contexts
 * because Next.js exposes NEXT_PUBLIC_* vars in both environments.
 */
/** localStorage key used by the in-app dev switcher (client only). */
export const DEV_PLAN_STORAGE_KEY = "teseo_dev_plan"

export function getDevPlanOverride(): Plan | null {
  if (process.env.NODE_ENV !== "development") return null

  // 1. Client-side: localStorage set by the in-app switcher takes priority
  if (typeof window !== "undefined") {
    const local = (localStorage.getItem(DEV_PLAN_STORAGE_KEY) ?? "").toUpperCase()
    if ((VALID_PLANS as string[]).includes(local)) return local as Plan
  }

  // 2. Env var fallback (works both server and client)
  const raw = (process.env.NEXT_PUBLIC_TESEO_DEV_PLAN ?? "").trim().toUpperCase()
  if (!raw) return null
  if ((VALID_PLANS as string[]).includes(raw)) return raw as Plan
  console.warn(
    `[teseo/plan] NEXT_PUBLIC_TESEO_DEV_PLAN="${raw}" is not valid. Use FREE, PRO, or VIP.`
  )
  return null
}

/**
 * Resolves the effective plan for a user.
 *
 * In development: returns the override if set, otherwise falls back to realPlan.
 * In production:  always returns realPlan.
 *
 * @param realPlan — raw plan string from session or DB (may be null/undefined)
 */
export function resolvePlan(realPlan: string | null | undefined): Plan {
  const override = getDevPlanOverride()
  if (override) return override
  const upper = (realPlan ?? "FREE").toUpperCase()
  return (VALID_PLANS as string[]).includes(upper) ? (upper as Plan) : "FREE"
}

// ─── Per-plan limits ─────────────────────────────────────────────────────────

/** How many TCC projects the plan allows simultaneously. */
export function getTccSlotLimit(plan: Plan): number {
  if (plan === "VIP") return 2
  return 1 // FREE and PRO both get 1
}

/** How many file attachments a user can upload per TCC. */
export function getAttachmentLimit(plan: Plan): number {
  if (plan === "VIP") return 50
  if (plan === "PRO") return 20
  return 5 // FREE
}

/**
 * Daily AI message limit.
 * Returns Infinity for VIP (unlimited).
 */
export function getDailyMessageLimit(plan: Plan): number {
  if (plan === "VIP") return Infinity
  if (plan === "PRO") return 50
  return 3 // FREE
}

/** Returns a user-facing label for the plan. */
export function getPlanLabel(plan: Plan): string {
  if (plan === "FREE") return "Gratuito"
  return plan // "PRO" | "VIP"
}
