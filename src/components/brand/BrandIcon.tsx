"use client"

import { cn } from "@/lib/utils"

export interface BrandIconProps {
  size?: number
  className?: string
  isGenerating?: boolean
}

export function BrandIcon({
  size = 24,
  className,
  isGenerating = false,
}: BrandIconProps) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center transition-all duration-700 ease-in-out",
        isGenerating ? "scale-[1.15]" : "scale-100",
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          "w-full h-full text-[var(--brand-accent)] transition-all duration-1000",
          isGenerating && "animate-pulse"
        )}
      >
        {/* Símbolo do Infinito (Laço Contínuo) minimalista */}
        <path d="M 25 50 C 25 15, 50 15, 50 50 C 50 85, 75 85, 75 50 C 75 15, 50 15, 50 50 C 50 85, 25 85, 25 50 Z" />
      </svg>
      {/* Círculo central iluminado quando está gerando */}
      {isGenerating && (
        <div className="absolute w-[20%] h-[20%] bg-[var(--brand-accent)] rounded-full blur-sm opacity-60 animate-ping" />
      )}
    </div>
  )
}
