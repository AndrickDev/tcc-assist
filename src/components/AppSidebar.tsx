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
    <nav className="group/sidebar w-[52px] hover:w-[180px] shrink-0 flex flex-col items-center hover:items-start py-3 gap-1 border-r border-white/[0.06] bg-[#0A0A09] z-40 fixed top-0 left-0 h-full overflow-hidden transition-all duration-200">
      {/* Logo */}
      <div className="w-full flex items-center px-2 mb-4 mt-1 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-white grid place-items-center shrink-0">
          <span className="text-[#0A0A09] font-bold text-sm leading-none">T</span>
        </div>
        <span className="ml-2.5 text-white font-bold text-sm opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 whitespace-nowrap">Teseo</span>
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
                  ? "bg-white/[0.10] text-white"
                  : "text-white/30 hover:text-white/60 hover:bg-white/[0.05]"
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
        <button
          title="Ajuda"
          className="w-full flex items-center gap-2.5 px-2 h-9 rounded-xl text-white/20 hover:text-white/50 hover:bg-white/[0.05] transition-all"
        >
          <HelpCircle size={16} className="shrink-0" />
          <span className="text-[13px] font-medium opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 whitespace-nowrap">
            Ajuda
          </span>
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          title="Sair"
          className="w-full flex items-center gap-2.5 px-2 h-9 rounded-xl text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
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
