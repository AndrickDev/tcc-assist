"use client"

/**
 * useUserPlan — client-side hook for resolving the current user's plan.
 *
 * In development: respects NEXT_PUBLIC_TESEO_DEV_PLAN override.
 * In production: always reads from the authenticated session.
 *
 * Usage:
 *   const userPlan = useUserPlan()   // "FREE" | "PRO" | "VIP"
 */

import { useSession } from "next-auth/react"
import { resolvePlan, type Plan } from "@/lib/plan"

export function useUserPlan(): Plan {
  const { data: session } = useSession()
  const rawPlan = (session?.user as { plan?: string } | undefined)?.plan
  return resolvePlan(rawPlan)
}
