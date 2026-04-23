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
        isGenerating ? "scale-[1.10]" : "scale-100",
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          "w-full h-full text-[var(--brand-accent)] transition-all duration-1000 z-10",
          isGenerating && "opacity-80 scale-95"
        )}
      >
        {/* Labirinto Quadrado Clássico Perfeito em uma linha só */}
        <path d="M 15 15 H 85 V 85 H 15 V 35 H 65 V 65 H 35 V 50 H 50" />
      </svg>
      
      {/* Luz no centro que acende quando o sistema gera a solução para sair do labirinto */}
      {isGenerating && (
        <div className="absolute w-[15%] h-[15%] bg-[var(--brand-accent)] rounded-sm blur-sm opacity-80 animate-ping z-20" />
      )}
    </div>
  )
}
