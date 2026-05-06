"use client"

import { useCallback, useEffect, useState } from "react"

export type DailyQuota = {
  used: number
  limit: number
  remaining: number
  resetAt: string | null
  loaded: boolean
}

const INITIAL: DailyQuota = {
  used: 0,
  limit: 0,
  remaining: 0,
  resetAt: null,
  loaded: false,
}

function parseDailyQuota(payload: unknown): DailyQuota | null {
  if (!payload || typeof payload !== "object") return null
  const quota = payload as Partial<Record<"used" | "limit" | "remaining" | "resetAt", unknown>>
  if (
    typeof quota.used !== "number" ||
    typeof quota.limit !== "number" ||
    typeof quota.remaining !== "number" ||
    (quota.resetAt !== null && typeof quota.resetAt !== "string")
  ) {
    return null
  }

  return {
    used: quota.used,
    limit: quota.limit,
    remaining: quota.remaining,
    resetAt: quota.resetAt,
    loaded: true,
  }
}

export function useDailyQuota(): {
  quota: DailyQuota
  refresh: () => Promise<DailyQuota>
  isExceeded: boolean
} {
  const [quota, setQuota] = useState<DailyQuota>(INITIAL)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/quota/me", { cache: "no-store" })
      if (!response.ok) {
        setQuota(INITIAL)
        return INITIAL
      }

      const nextQuota = parseDailyQuota(await response.json())
      if (!nextQuota) {
        setQuota(INITIAL)
        return INITIAL
      }

      setQuota(nextQuota)
      return nextQuota
    } catch {
      setQuota(INITIAL)
      return INITIAL
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    quota,
    refresh,
    isExceeded: quota.loaded && quota.limit !== -1 && quota.remaining <= 0,
  }
}
