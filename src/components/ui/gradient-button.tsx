import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

export const GradientButton = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
  ({ className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={cn(
          "bg-[color:var(--color-brand-accent)] text-white",
          "hover:bg-[color:var(--color-brand-accent-hover)] active:scale-[0.99]",
          "transition-all duration-200 border border-[color:var(--color-brand-border)] shadow-brand",
          className
        )}
        {...props}
      />
    )
  }
)
GradientButton.displayName = "GradientButton"
