import { NextResponse } from "next/server"

import { getQuotaState } from "@/lib/ai-service"
import { auth } from "@/lib/auth"
import { resolvePlan } from "@/lib/plan"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  })
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const quota = await getQuotaState({ userId, plan: resolvePlan(user.plan) })
    return NextResponse.json(quota)
  } catch (error) {
    console.error("[api/quota/me] upstream error:", error)
    const message = error instanceof Error ? error.message : String(error)

    if (message === "quota_unavailable") {
      return NextResponse.json({ error: "quota_unavailable" }, { status: 503 })
    }
    if (message === "upstream_auth_failure") {
      return NextResponse.json({ error: "internal" }, { status: 500 })
    }
    return NextResponse.json({ error: "upstream_error" }, { status: 502 })
  }
}
