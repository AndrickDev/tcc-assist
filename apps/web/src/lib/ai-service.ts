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

type RunChatInput = {
  userId: string
  plan: Plan
  tccId: string
  message: string
}

type QuotaMeWire = {
  used: number
  limit: number
  remaining: number
  reset_at: string
}

type ChatWire = {
  content: string
  agent_id: string
  quota: {
    used: number
    remaining: number
    reset_at: string
  }
}

export type ChatResult = {
  content: string
  agentId: string
  quota: {
    used: number
    remaining: number
    resetAt: string
  }
}

export class QuotaExceededError extends Error {
  remaining: number | null
  resetAt: string | null

  constructor({ remaining, resetAt }: { remaining: number | null; resetAt: string | null }) {
    super("quota_exceeded")
    this.name = "QuotaExceededError"
    this.remaining = remaining
    this.resetAt = resetAt
  }
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

function parseChat(payload: unknown): ChatWire {
  if (!payload || typeof payload !== "object") {
    throw new Error("upstream_invalid_shape")
  }

  const candidate = payload as {
    content?: unknown
    agent_id?: unknown
    quota?: unknown
  }
  if (
    typeof candidate.content !== "string" ||
    typeof candidate.agent_id !== "string" ||
    !candidate.quota ||
    typeof candidate.quota !== "object"
  ) {
    throw new Error("upstream_invalid_shape")
  }

  const quota = candidate.quota as Partial<Record<"used" | "remaining" | "reset_at", unknown>>
  if (
    typeof quota.used !== "number" ||
    typeof quota.remaining !== "number" ||
    typeof quota.reset_at !== "string"
  ) {
    throw new Error("upstream_invalid_shape")
  }

  return {
    content: candidate.content,
    agent_id: candidate.agent_id,
    quota: {
      used: quota.used,
      remaining: quota.remaining,
      reset_at: quota.reset_at,
    },
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

async function readUpstreamPayload(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function isObject(payload: unknown): payload is Record<string, unknown> {
  return Boolean(payload) && typeof payload === "object"
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

export async function runChat({ userId, plan, tccId, message }: RunChatInput): Promise<ChatResult> {
  const token = await signInternalJwt({ sub: userId, plan, scope: "chat", tccId })
  const response = await fetch(`${getAiServiceUrl()}/v1/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tcc_id: tccId, message }),
    cache: "no-store",
  })

  const payload = await readUpstreamPayload(response)
  const payloadObject = isObject(payload) ? payload : null
  if (response.status === 200) {
    const chat = parseChat(payload)
    return {
      content: chat.content,
      agentId: chat.agent_id,
      quota: {
        used: chat.quota.used,
        remaining: chat.quota.remaining,
        resetAt: chat.quota.reset_at,
      },
    }
  }

  const upstreamError =
    payloadObject && typeof payloadObject.error === "string" ? payloadObject.error : null
  if (
    response.status === 401 &&
    (upstreamError === "invalid_token" || upstreamError === "missing_token")
  ) {
    throw new Error("upstream_auth_failure")
  }
  if (response.status === 403 && upstreamError === "tcc_id_mismatch") {
    throw new Error("tcc_id_mismatch")
  }
  if (response.status === 404 && upstreamError === "tcc_not_found") {
    throw new Error("tcc_not_found")
  }
  if (response.status === 422) {
    throw new Error("upstream_invalid_request")
  }
  if (response.status === 429 && upstreamError === "quota_exceeded") {
    throw new QuotaExceededError({
      remaining:
        payloadObject && typeof payloadObject.remaining === "number" ? payloadObject.remaining : null,
      resetAt:
        payloadObject && typeof payloadObject.reset_at === "string" ? payloadObject.reset_at : null,
    })
  }
  if (response.status === 502 && upstreamError === "ai_provider_bad_response") {
    throw new Error("ai_provider_bad_response")
  }
  if (response.status === 503 && upstreamError === "ai_provider_unavailable") {
    throw new Error("ai_provider_unavailable")
  }
  if (response.status === 503 && upstreamError === "quota_backend_unavailable") {
    throw new Error("quota_unavailable")
  }
  throw new Error(`upstream_error_${response.status}`)
}
