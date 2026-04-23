"use client"

import * as React from "react"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { BrandLogo } from "@/components/brand/BrandLogo"

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm text-[color:var(--color-brand-muted)] hover:text-[color:var(--color-brand-text)] transition-colors"
    >
      {children}
    </Link>
  )
}

export function LandingHeader() {
  const { data: session } = useSession()

  const primaryHref = session ? "/dashboard" : "/register"
  const primaryLabel = session ? "Dashboard" : "Experimente o Teseo"
  const secondaryHref = session ? "/dashboard" : "/login"
  const secondaryLabel = session ? "Dashboard" : "Entrar"

  return (
    <header className="sticky top-0 z-50 bg-[#141413]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto h-[76px] px-5 sm:px-6 flex items-center justify-between gap-4">
        <Link href="/" className="shrink-0" aria-label="TCC-ASSIST">
          <BrandLogo variant="full" tone="dark" size="large" />
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <NavLink href="#conheca">Conheça o Teseo</NavLink>
          <NavLink href="#precos">Preços</NavLink>
          <NavLink href="#faq">FAQ</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          {!session && (
            <Link
              href={secondaryHref}
              className="px-4 py-2.5 rounded-full border border-white/25 bg-transparent text-white text-sm font-medium hover:border-white/40 transition-colors"
            >
              {secondaryLabel}
            </Link>
          )}
          <Link
            href={primaryHref}
            className="px-4 py-2.5 rounded-full bg-[#FAF9F5] text-[#141413] text-sm font-semibold hover:bg-white transition-colors"
          >
            {primaryLabel}
          </Link>

          {session && (
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="ml-2 px-4 py-2.5 rounded-full border border-[var(--brand-accent)]/80 bg-transparent text-[var(--brand-accent)] text-sm font-semibold hover:bg-[var(--brand-accent)]/10 transition-colors"
            >
              Sair
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
