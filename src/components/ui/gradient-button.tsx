import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

export const GradientButton = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
  ({ className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={cn(
          "bg-gradient-to-br from-brand-purple to-brand-blue text-white",
          "hover:opacity-90 hover:-translate-y-[1px] active:scale-95",
          "transition-all duration-200 border-none shadow-brand",
          className
        )}
        {...props}
      />
    )
  }
)
GradientButton.displayName = "GradientButton"
