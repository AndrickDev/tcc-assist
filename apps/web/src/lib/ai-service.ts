import "server-only"

import { type Plan, signInternalJwt } from "@/lib/internal-jwt"

export type QuotaState = {
  used: number
  limit: number
  remaining: number
  resetAt: string
}

type GetQuotaStateInput = {
  userId: string
  plan: Plan
}

type QuotaMeWire = {
  used: number
  limit: number
  remaining: number
  reset_at: string
}

function getAiServiceUrl(): string {
  const raw = process.env.AI_SERVICE_URL?.trim()
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AI_SERVICE_URL ausente")
    }
    return "http://localhost:8000"
  }
  return raw.replace(/\/+$/, "")
}

function parseQuotaMe(payload: unknown): QuotaMeWire {
  if (!payload || typeof payload !== "object") {
    throw new Error("upstream_invalid_shape")
  }

  const candidate = payload as Partial<Record<keyof QuotaMeWire, unknown>>
  if (
    typeof candidate.used !== "number" ||
    typeof candidate.limit !== "number" ||
    typeof candidate.remaining !== "number" ||
    typeof candidate.reset_at !== "string"
  ) {
    throw new Error("upstream_invalid_shape")
  }

  return {
    used: candidate.used,
    limit: candidate.limit,
    remaining: candidate.remaining,
    reset_at: candidate.reset_at,
  }
}

async function readUpstreamError(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as unknown
    if (payload && typeof payload === "object" && "error" in payload) {
      const error = (payload as { error?: unknown }).error
      return typeof error === "string" ? error : null
    }
  } catch {
    return null
  }
  return null
}

export async function getQuotaState({ userId, plan }: GetQuotaStateInput): Promise<QuotaState> {
  const token = await signInternalJwt({ sub: userId, plan, scope: "quota" })
  const response = await fetch(`${getAiServiceUrl()}/v1/quota/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  if (response.status === 200) {
    const quota = parseQuotaMe(await response.json())
    return {
      used: quota.used,
      limit: quota.limit,
      remaining: quota.remaining,
      resetAt: quota.reset_at,
    }
  }

  const upstreamError = await readUpstreamError(response)
  if (
    response.status === 401 &&
    (upstreamError === "invalid_token" || upstreamError === "missing_token")
  ) {
    throw new Error("upstream_auth_failure")
  }
  if (response.status === 503 && upstreamError === "quota_backend_unavailable") {
    throw new Error("quota_unavailable")
  }
  throw new Error(`upstream_error_${response.status}`)
}
