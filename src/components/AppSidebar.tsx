"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { useTheme } from "next-themes"
import { LayoutDashboard, FolderOpen, BookOpen, Settings, LogOut, HelpCircle, Sun, Moon } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV = [
  { icon: LayoutDashboard, href: "/dashboard",       label: "Dashboard" },
  { icon: FolderOpen,      href: "/dashboard",       label: "Projetos",        match: "/tcc" },
  { icon: BookOpen,        href: "/dashboard",       label: "Referências" },
  { icon: Settings,        href: "/configuracoes",   label: "Configurações",   match: "/configuracoes" },
]

function TeseoLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#d97757" />
      {/* Celtic-inspired knot mark */}
      <path d="M16 6 C16 6 22 10 22 16 C22 22 16 26 16 26 C16 26 10 22 10 16 C10 10 16 6 16 6Z" stroke="white" strokeWidth="1.5" fill="none" />
      <path d="M6 16 C6 16 10 10 16 10 C22 10 26 16 26 16 C26 16 22 22 16 22 C10 22 6 16 6 16Z" stroke="white" strokeWidth="1.5" fill="none" />
      <circle cx="16" cy="16" r="2.5" fill="white" />
      <circle cx="16" cy="9" r="1.5" fill="white" fillOpacity="0.6" />
      <circle cx="16" cy="23" r="1.5" fill="white" fillOpacity="0.6" />
      <circle cx="9" cy="16" r="1.5" fill="white" fillOpacity="0.6" />
      <circle cx="23" cy="16" r="1.5" fill="white" fillOpacity="0.6" />
    </svg>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()

  const isActive = (item: typeof NAV[0]) => {
    if (item.match) return pathname.startsWith(item.match)
    return pathname === item.href
  }

  return (
    <nav className="group/sidebar w-[52px] hover:w-[180px] shrink-0 flex flex-col items-center hover:items-start py-3 gap-1 border-r border-[var(--brand-border)] bg-[var(--brand-bg)] z-40 fixed top-0 left-0 h-full overflow-hidden transition-all duration-200">
      {/* Logo */}
      <div className="w-full flex items-center px-2 mb-4 mt-1 shrink-0">
        <div className="shrink-0">
          <TeseoLogo size={32} />
        </div>
        <span className="ml-2.5 text-[var(--brand-text)] font-bold text-sm opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 whitespace-nowrap">Teseo</span>
      </div>

      {/* Nav items */}
      <div className="flex flex-col items-start w-full gap-0.5 flex-1 px-1.5">
        {NAV.map(item => {
          const active = isActive(item)
          return (
            <Link
              key={item.label}
              href={item.href}
              title={item.label}
              className={cn(
                "w-full flex items-center gap-2.5 px-2 h-9 rounded-xl transition-all",
                active
                  ? "bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]"
                  : "text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-hover)]"
              )}
            >
              <item.icon size={16} className="shrink-0" />
              <span className="text-[13px] font-medium opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 whitespace-nowrap">
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>

      {/* Bottom actions */}
      <div className="flex flex-col items-start w-full gap-0.5 px-1.5 pb-2">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          title={resolvedTheme === "dark" ? "Tema claro" : "Tema escuro"}
          className="w-full flex items-center gap-2.5 px-2 h-9 rounded-xl text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-hover)] transition-all"
        >
          {resolvedTheme === "dark"
            ? <Sun size={16} className="shrink-0" />
            : <Moon size={16} className="shrink-0" />
          }
          <span className="text-[13px] font-medium opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 whitespace-nowrap">
            {resolvedTheme === "dark" ? "Tema claro" : "Tema escuro"}
          </span>
        </button>

        <Link
          href="/suporte"
          title="Ajuda"
          className="w-full flex items-center gap-2.5 px-2 h-9 rounded-xl text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-hover)] transition-all"
        >
          <HelpCircle size={16} className="shrink-0" />
          <span className="text-[13px] font-medium opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 whitespace-nowrap">
            Ajuda
          </span>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          title="Sair"
          className="w-full flex items-center gap-2.5 px-2 h-9 rounded-xl text-[var(--brand-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all"
        >
          <LogOut size={15} className="shrink-0" />
          <span className="text-[13px] font-medium opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 whitespace-nowrap">
            Sair
          </span>
        </button>
      </div>
    </nav>
  )
}
