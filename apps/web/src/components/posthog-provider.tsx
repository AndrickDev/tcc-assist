"use client"

import { Suspense, useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import posthog from "posthog-js"

let didInitPostHog = false
let didWarnMissingKey = false

type PostHogWindow = Window & {
  posthog?: typeof posthog
}

function getPostHog() {
  if (typeof window === "undefined") return undefined
  return (window as PostHogWindow).posthog
}

function initPostHog() {
  if (typeof window === "undefined") return undefined
  if (didInitPostHog) return getPostHog()

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) {
    if (!didWarnMissingKey) {
      console.warn("PostHog disabled: NEXT_PUBLIC_POSTHOG_KEY is not set.")
      didWarnMissingKey = true
    }
    return undefined
  }

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") ph.debug()
    },
  })

  ;(window as PostHogWindow).posthog = posthog
  didInitPostHog = true

  return posthog
}

function PostHogPageview() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const ph = initPostHog()
    if (!ph || !pathname) return

    const query = searchParams.toString()
    const url = query ? `${pathname}?${query}` : pathname

    ph.capture("$pageview", { $current_url: url })
  }, [pathname, searchParams])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { data, status } = useSession()
  const identifiedUserIdRef = useRef<string | null>(null)
  const wasAuthenticatedRef = useRef(false)

  useEffect(() => {
    initPostHog()
  }, [])

  useEffect(() => {
    const ph = initPostHog()
    if (!ph) return

    if (status === "authenticated" && data.user?.id) {
      wasAuthenticatedRef.current = true

      if (identifiedUserIdRef.current !== data.user.id) {
        ph.identify(data.user.id, {
          email: data.user.email,
          name: data.user.name,
        })
        identifiedUserIdRef.current = data.user.id
      }

      return
    }

    if (status === "unauthenticated" && wasAuthenticatedRef.current) {
      ph.reset()
      identifiedUserIdRef.current = null
      wasAuthenticatedRef.current = false
    }
  }, [data?.user?.email, data?.user?.id, data?.user?.name, status])

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageview />
      </Suspense>
      {children}
    </>
  )
}
