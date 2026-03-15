"use client"

import * as React from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useSession, signOut } from "next-auth/react"
import { useI18n } from "@/lib/i18n"
import { Logo } from "@/components/Logo"
import { cn } from "@/lib/utils"

export function Header({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const { language, setLanguage } = useI18n()
  const { data: session } = useSession()

  return (
    <header className={cn("w-full bg-[color:var(--color-brand-bg)] border-b border-[color:var(--color-brand-border)]", className)}>
      <div className="max-w-6xl mx-auto h-[64px] px-4 flex items-center justify-between gap-4">
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden md:flex items-center gap-5 text-sm">
          <Link className="text-[color:var(--color-brand-muted)] hover:text-white transition-colors" href="/dashboard">
            Dashboard
          </Link>
          <Link className="text-[color:var(--color-brand-muted)] hover:text-white transition-colors" href="/pricing">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="px-3 py-2 rounded-lg bg-[color:var(--color-brand-hover)] border border-[color:var(--color-brand-border)] text-[color:var(--color-brand-muted)] hover:text-white"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button
            onClick={() => setLanguage(language === "PT" ? "EN" : "PT")}
            className="px-3 py-2 rounded-lg bg-[color:var(--color-brand-hover)] border border-[color:var(--color-brand-border)] text-[color:var(--color-brand-muted)] hover:text-white"
          >
            {language}
          </button>

          {session ? (
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="px-3 py-2 rounded-lg bg-[color:var(--color-brand-hover)] border border-[color:var(--color-brand-border)] text-[color:var(--color-brand-muted)] hover:text-white"
            >
              Sign out
            </button>
          ) : (
            <Link
              href="/login"
              className="px-3 py-2 rounded-lg bg-[color:var(--color-brand-accent)] hover:bg-[color:var(--color-brand-accent-hover)] text-white font-medium"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

