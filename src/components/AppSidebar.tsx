"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { LayoutDashboard, FolderOpen, BookOpen, Settings, LogOut, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV = [
  { icon: LayoutDashboard, href: "/dashboard", label: "Dashboard" },
  { icon: FolderOpen,      href: "/dashboard", label: "Projetos",   match: "/tcc" },
  { icon: BookOpen,        href: "/dashboard", label: "Referências" },
  { icon: Settings,        href: "/pricing",   label: "Configurações" },
]

export function AppSidebar() {
  const pathname = usePathname()

  const isActive = (item: typeof NAV[0]) => {
    if (item.match) return pathname.startsWith(item.match)
    return pathname === item.href
  }

  return (
    <nav className="w-[52px] shrink-0 flex flex-col items-center py-3 gap-1 border-r border-white/[0.06] bg-[#0A0A09] z-40 fixed top-0 left-0 h-full">
      {/* Logo */}
      <div className="w-8 h-8 rounded-lg bg-white grid place-items-center mb-4 mt-1 shrink-0">
        <span className="text-[#0A0A09] font-bold text-sm leading-none">T</span>
      </div>

      {/* Nav items */}
      <div className="flex flex-col items-center gap-1 flex-1">
        {NAV.map(item => {
          const active = isActive(item)
          return (
            <Link
              key={item.label}
              href={item.href}
              title={item.label}
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                active
                  ? "bg-white/[0.10] text-white"
                  : "text-white/30 hover:text-white/60 hover:bg-white/[0.05]"
              )}
            >
              <item.icon size={16} />
            </Link>
          )
        })}
      </div>

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-1 pb-2">
        <button
          title="Ajuda"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/[0.05] transition-all"
        >
          <HelpCircle size={16} />
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          title="Sair"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut size={15} />
        </button>
      </div>
    </nav>
  )
}
