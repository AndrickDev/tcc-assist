"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export function AboutVideo({
  src,
  poster,
  className,
}: {
  src?: string
  poster?: string
  className?: string
}) {
  if (!src) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-[22px] border border-[color:var(--color-brand-border)] bg-[color:var(--color-brand-surface)] shadow-brand",
          className
        )}
        aria-label="Video demonstrativo do produto"
      >
        <div className="absolute inset-0 opacity-35" style={{ background: "radial-gradient(circle at 25% 25%, rgba(250,249,245,0.16), transparent 60%)" }} />
        <div className="absolute inset-0 opacity-25" style={{ background: "radial-gradient(circle at 70% 70%, rgba(255,255,255,0.10), transparent 60%)" }} />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.25),rgba(0,0,0,0.65))]" />
        <div className="relative h-full w-full flex items-end p-6">
          <div className="text-sm text-brand-text/90">
            Vídeo horizontal do produto entra aqui.
            <div className="text-xs text-brand-muted mt-1">mp4/webm com autoplay, muted, loop</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <video
      className={cn(
        "w-full h-full object-cover rounded-[22px] border border-[color:var(--color-brand-border)] shadow-brand",
        className
      )}
      src={src}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
    />
  )
}
