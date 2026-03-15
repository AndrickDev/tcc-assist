"use client"

import Link from "next/link"
import { BrandLogo } from "@/components/brand/BrandLogo"

function FooterLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="block text-sm text-white/65 hover:text-white/85 transition-colors">
      {children}
    </Link>
  )
}

export function LandingFooter() {
  return (
    <footer className="bg-[#0A0A0A] text-white">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] gap-10">
          <div className="space-y-4">
            <BrandLogo variant="full" tone="dark" size="large" />
            <div className="text-sm text-white/60 leading-relaxed max-w-sm">
              Orientação acadêmica assistida por IA. O Teseo não substitui orientador institucional.
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold tracking-widest text-white/55">NAVEGAÇÃO</div>
            <div className="space-y-2">
              <FooterLink href="#conheca">Conheça</FooterLink>
              <FooterLink href="#precos">Preços</FooterLink>
              <FooterLink href="#faq">FAQ</FooterLink>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold tracking-widest text-white/55">PRODUTO</div>
            <div className="space-y-2">
              <FooterLink href="/dashboard">Dashboard</FooterLink>
              <FooterLink href="/pricing">Planos</FooterLink>
              <FooterLink href="/onboarding">Onboarding</FooterLink>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold tracking-widest text-white/55">CONTA</div>
            <div className="space-y-2">
              <FooterLink href="/login">Entrar</FooterLink>
              <FooterLink href="/register">Criar conta</FooterLink>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-xs text-white/55">© 2026 Teseo. Todos os direitos reservados.</div>
          <div className="text-xs text-white/55">
            Suporte:{" "}
            <a className="underline hover:text-white/80" href="mailto:contato@tcc-assist.com">
              contato@tcc-assist.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

