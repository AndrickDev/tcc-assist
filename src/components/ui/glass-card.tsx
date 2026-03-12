import * as React from "react"
import { cn } from "@/lib/utils"

export type GlassCardProps = React.HTMLAttributes<HTMLDivElement>

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("bg-glass rounded-2xl p-6 shadow-brand", className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
GlassCard.displayName = "GlassCard"
