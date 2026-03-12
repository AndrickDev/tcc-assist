"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Eye, EyeOff } from "lucide-react"

export interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  ({ className, type, error, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)
    const isPassword = type === "password"
    const inputType = isPassword && showPassword ? "text" : type

    return (
      <div className="relative w-full">
        <input
          type={inputType}
          className={cn(
            "w-full px-4 py-3 bg-white/5 border border-white/10 rounded-[0.625rem]",
            "text-[15px] text-slate-100 placeholder:text-slate-500",
            "outline-none transition-all duration-150",
            "focus:border-brand-purple focus:ring-[3px] focus:ring-brand-purple/30",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
            className
          )}
          ref={ref}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    )
  }
)
InputField.displayName = "InputField"
