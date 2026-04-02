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
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="22" fill="#FAF9F0" />
      {/* Celtic knot — 4-fold interlaced loops matching brand logo */}
      <g stroke="#c4663a" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Outer loops */}
        <path d="M50 12 C65 12 78 20 78 35 C78 45 70 50 70 50 C70 50 78 55 78 65 C78 80 65 88 50 88 C35 88 22 80 22 65 C22 55 30 50 30 50 C30 50 22 45 22 35 C22 20 35 12 50 12Z" />
        <path d="M12 50 C12 35 20 22 35 22 C45 22 50 30 50 30 C50 30 55 22 65 22 C80 22 88 35 88 50 C88 65 80 78 65 78 C55 78 50 70 50 70 C50 70 45 78 35 78 C20 78 12 65 12 50Z" />
        {/* Inner cross/over paths for interlacing effect */}
        <path d="M38 38 C38 38 44 44 50 50 C56 56 62 62 62 62" />
        <path d="M62 38 C62 38 56 44 50 50 C44 56 38 62 38 62" />
        {/* Corner dots — characteristic of Celtic knotwork */}
        <circle cx="50" cy="50" r="4" fill="#c4663a" stroke="none" />
        <circle cx="50" cy="22" r="3" fill="#c4663a" stroke="none" fillOpacity="0.5" />
        <circle cx="50" cy="78" r="3" fill="#c4663a" stroke="none" fillOpacity="0.5" />
        <circle cx="22" cy="50" r="3" fill="#c4663a" stroke="none" fillOpacity="0.5" />
        <circle cx="78" cy="50" r="3" fill="#c4663a" stroke="none" fillOpacity="0.5" />
      </g>
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
