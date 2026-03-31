"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Users, Search, Filter, RefreshCcw, 
  CreditCard, ChevronDown, 
  AlertCircle, Loader2,
  ArrowUpDown, ExternalLink, Ban, Shield
} from "lucide-react"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"

interface AdminUser {
  id: string
  email: string
  name: string
  plan: string
  activeTccs: number
  pagesToday: number
  lastLogin: string
}

export default function AdminUsersPage() {
  const { data: session } = useSession()
  const [users, setUsers] = React.useState<AdminUser[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [filterPlan, setFilterPlan] = React.useState("all")
  const [actionLoading, setActionLoading] = React.useState<string | null>(null)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/users")
      const data = await res.json()
      if (Array.isArray(data)) {
        setUsers(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchUsers()
  }, [])

  const handleUpdatePlan = async (userId: string, plan: string) => {
    setActionLoading(userId + "-plan")
    try {
      await fetch(`/api/admin/users/${userId}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })
      await fetchUsers()
    } finally {
      setActionLoading(null)
    }
  }

  const handleResetLimits = async (userId: string) => {
    setActionLoading(userId + "-reset")
    try {
      await fetch(`/api/admin/users/${userId}/reset-limits`, {
        method: "POST",
      })
      await fetchUsers()
    } finally {
      setActionLoading(null)
    }
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesPlan = filterPlan === "all" || u.plan === filterPlan
    return matchesSearch && matchesPlan
  })

  // @ts-expect-error role is not in the default session type
  if (session?.user?.role !== "ADMIN") {
    return (
      <div className="h-screen bg-[#0F0F1A] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Shield className="w-16 h-16 text-red-500 mx-auto opacity-50" />
          <h1 className="text-2xl font-bold text-white">Acesso Negado</h1>
          <p className="text-slate-400">Você não tem permissão para acessar esta área.</p>
          <a href="/dashboard" className="inline-block px-6 py-2 bg-brand-purple text-white rounded-xl font-bold">Voltar ao Dashboard</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F0F1A] text-[#F1F5F9]">
      <header className="h-[70px] border-b border-white/5 bg-[#0F0F1A]/80 backdrop-blur-xl sticky top-0 z-30 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-purple/10 rounded-lg">
            <Users size={24} className="text-brand-purple" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-xs text-slate-500">Gestão de Usuários e Métricas</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Buscar email ou nome..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-brand-purple w-64"
            />
          </div>
          <button 
            onClick={fetchUsers}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-400 hover:text-white"
          >
            <RefreshCcw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* STATS SUMMARY */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Usuários", value: users.length, icon: Users, color: "text-blue-500" },
            { label: "Planos PRO/VIP", value: users.filter(u => u.plan !== "FREE").length, icon: CreditCard, color: "text-brand-purple" },
            { label: "TCCs Ativos", value: users.reduce((acc, u) => acc + u.activeTccs, 0), icon: ExternalLink, color: "text-green-500" },
            { label: "Páginas Hoje", value: users.reduce((acc, u) => acc + u.pagesToday, 0), icon: ArrowUpDown, color: "text-brand-blue" },
          ].map(s => (
            <div key={s.label} className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500">{s.label}</span>
                <s.icon size={18} className={s.color} />
              </div>
              <div className="text-2xl font-bold">{s.value}</div>
            </div>
          ))}
        </div>

        {/* FILTERS & LIST */}
        <div className="bg-white/[0.03] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-white/5 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-500" />
              <span className="text-sm font-medium text-slate-400">Filtrar por plano:</span>
              <div className="flex bg-white/5 p-1 rounded-xl">
                {["all", "FREE", "PRO", "VIP"].map(p => (
                  <button
                    key={p}
                    onClick={() => setFilterPlan(p)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      filterPlan === p ? "bg-brand-purple text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    {p === "all" ? "Todos" : p}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Exibindo <span className="text-white font-bold">{filteredUsers.length}</span> usuários
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Usuário</th>
                  <th className="px-6 py-4">Plano</th>
                  <th className="px-6 py-4">TCCs Ativos</th>
                  <th className="px-6 py-4">Páginas Hoje</th>
                  <th className="px-6 py-4">Último Login</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <AnimatePresence mode="popLayout">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center">
                        <Loader2 className="w-8 h-8 text-brand-purple animate-spin mx-auto mb-4" />
                        <p className="text-slate-500 animate-pulse">Carregando base de usuários...</p>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center">
                        <AlertCircle className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                        <p className="text-slate-500">Nenhum usuário encontrado com estes filtros.</p>
                      </td>
                    </tr>
                  ) : filteredUsers.map((u) => (
                    <motion.tr 
                      key={u.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="group hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-purple/20 to-brand-blue/20 flex items-center justify-center text-brand-purple font-bold text-xs border border-brand-purple/20">
                            {u.name?.[0] || u.email?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white leading-tight">{u.name || "Sem nome"}</div>
                            <div className="text-xs text-slate-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative inline-block group/select">
                          <div className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1.5 cursor-pointer",
                            u.plan === "FREE" ? "bg-slate-500/10 text-slate-400 border-slate-500/20" :
                            u.plan === "PRO" ? "bg-brand-purple/10 text-brand-purple border-brand-purple/20" :
                            "bg-orange-500/10 text-orange-500 border-orange-500/20"
                          )}>
                            {u.plan}
                            <ChevronDown size={10} />
                          </div>
                          
                          <div className="absolute top-full left-0 mt-2 w-24 bg-[#1A1A2E] border border-white/10 rounded-xl overflow-hidden hidden group-hover/select:block z-40 shadow-2xl">
                            {["FREE", "PRO", "VIP"].map(p => (
                              <button 
                                key={p}
                                onClick={() => handleUpdatePlan(u.id, p)}
                                className="w-full px-4 py-2 text-[10px] text-left hover:bg-white/5 font-bold transition-colors"
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <div className={cn(
                             "w-12 h-2 rounded-full bg-white/5 overflow-hidden",
                             u.activeTccs > 0 ? "bg-green-500/10" : ""
                           )}>
                             <div className="h-full bg-green-500 transition-all" style={{ width: `${u.activeTccs * 50}%` }} />
                           </div>
                           <span className="text-xs font-bold">{u.activeTccs}/2</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "text-xs font-bold px-2 py-0.5 rounded-md",
                          u.pagesToday > 0 ? "bg-brand-blue/10 text-brand-blue" : "text-slate-600"
                        )}>
                          {u.pagesToday} pgs
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-slate-400">
                          {new Date(u.lastLogin).toLocaleDateString()}
                          <div className="text-[10px] text-slate-600">{new Date(u.lastLogin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleResetLimits(u.id)}
                            title="Resetar limites diários"
                            className="p-2 hover:bg-brand-blue/10 text-slate-500 hover:text-brand-blue rounded-lg transition-all"
                          >
                            {actionLoading === u.id + "-reset" ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                          </button>
                          <button 
                            title="Mudar Plano"
                            className="p-2 hover:bg-brand-purple/10 text-slate-500 hover:text-brand-purple rounded-lg transition-all"
                          >
                            <CreditCard size={16} />
                          </button>
                          <button 
                            title="Banir Usuário"
                            className="p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-500 rounded-lg transition-all"
                          >
                            <Ban size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
