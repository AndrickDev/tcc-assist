"use client"

import Link from "next/link"

function GoogleMark({ className }: { className?: string }) {
  // Official-like multicolor Google "G" mark (inline SVG).
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.2 0 6.1 1.1 8.4 3.1l6.2-6.2C34.9 2.9 29.8 1 24 1 14.6 1 6.5 6.4 2.6 14.2l7.2 5.6C11.5 13.7 17.3 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v7.8h12.5c-.3 2-1.8 5-5.1 7l7.8 6c4.6-4.3 6.9-10.6 6.9-16.7z"
      />
      <path
        fill="#FBBC05"
        d="M9.8 28.2c-.5-1.4-.8-2.8-.8-4.2s.3-2.8.8-4.2l-7.2-5.6C1.6 16.4 1 20 1 24c0 4 1 7.6 2.6 10.8l7.2-5.6z"
      />
      <path
        fill="#34A853"
        d="M24 47c5.8 0 10.7-1.9 14.3-5.2l-7.8-6c-2.1 1.5-5 2.5-8.5 2.5-6.7 0-12.4-4.2-14.2-10.1l-7.2 5.6C6.5 41.6 14.6 47 24 47z"
      />
    </svg>
  )
}

export function HeroAuthCard() {
  return (
    <div className="mt-8 w-full max-w-[380px] rounded-[22px] bg-[#1B1B1A] border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.35)] p-6">
      <div className="space-y-3">
        <Link
          href="/login"
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-[#141413] border border-white/15 text-white text-sm font-medium hover:border-white/25 transition-colors"
        >
          <GoogleMark className="shrink-0" />
          Continuar com Google
        </Link>

        <div className="flex items-center gap-3 text-xs text-white/55">
          <div className="h-px flex-1 bg-white/10" />
          ou
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <input
          placeholder="Digite seu e-mail"
          className="w-full px-4 py-3 rounded-full bg-[#30302E] text-white placeholder:text-white/55 border border-white/10 focus:outline-none"
        />

        <Link
          href="/register"
          className="w-full inline-flex items-center justify-center px-4 py-3 rounded-full bg-[#FAF9F5] text-[#141413] text-sm font-semibold hover:bg-white transition-colors"
        >
          Continuar com e-mail
        </Link>

        <div className="text-[11px] text-white/55 leading-relaxed">
          Ao continuar, você concorda com nossos Termos e Política de Privacidade.
        </div>
      </div>
    </div>
  )
}
