"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { BrandIcon } from "@/components/brand/BrandIcon"

type Variant = "icon" | "full"
type Tone = "light" | "dark"
type Size = "small" | "large"

export function BrandLogo({
  variant = "full",
  tone = "dark",
  size = "small",
  className,
}: {
  variant?: Variant
  tone?: Tone
  size?: Size
  className?: string
}) {
  const iconSize = size === "large" ? 26 : 20
  const textClass =
    tone === "light" ? "text-[#141413]" : "text-[#FAF9F5]"

  if (variant === "icon") {
    return <BrandIcon size={iconSize} className={className} />
  }

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <BrandIcon size={iconSize} />
      <span className={cn("font-medium tracking-tight", textClass, size === "large" ? "text-lg" : "text-sm")}>
        Teseo
      </span>
    </div>
  )
}

