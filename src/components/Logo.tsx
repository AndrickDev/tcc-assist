"use client"

import * as React from "react"

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <path
          d="M8 8 L24 8 L24 12 L18 12 L18 24 L14 24 L14 12 L8 12 Z"
          fill="#d97757"
        />
      </svg>
      {!compact && <span className="text-lg font-semibold text-[color:var(--color-brand-text)]">Teseo</span>}
    </div>
  )
}
