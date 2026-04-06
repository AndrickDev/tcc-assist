"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"

export function BrandIcon({
  size = 20,
  className,
  alt = "Teseo",
}: {
  size?: number
  className?: string
  alt?: string
}) {
  return (
    <Image
      src="/brand/teseo-icon.png"
      alt={alt}
      width={size}
      height={size}
      className={cn("select-none object-contain", className)}
      priority
    />
  )
}
