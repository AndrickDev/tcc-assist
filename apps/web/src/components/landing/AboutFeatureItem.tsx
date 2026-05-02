"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export function AboutFeatureItem({
  icon,
  title,
  description,
  emphasized = false,
}: {
  icon: React.ReactNode
  title: string
  description: string
  emphasized?: boolean
}) {
  return (
    <div className={cn("py-6", emphasized ? "text-white" : "text-white/90")}>
      <div className="flex items-start gap-4">
        <div className="mt-0.5 shrink-0 text-white/80">{icon}</div>
        <div className="space-y-2">
          <div className="text-base font-semibold tracking-tight">{title}</div>
          <div className="text-sm leading-relaxed text-white/65">{description}</div>
        </div>
      </div>
    </div>
  )
}

