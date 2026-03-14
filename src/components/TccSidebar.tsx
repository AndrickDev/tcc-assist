"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  CheckCircle2, FileText, Search, AlertCircle, 
  Download as DownloadIcon, Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Stats {
    progress: { name: string; p: number }[]
    plagiarism: number
    totalPages: number
    status: string
}

interface TccSidebarProps {
    stats: Stats | null
    userPlan: string
}

export function TccSidebar({ stats, userPlan }: TccSidebarProps) {
    const isOverLimit = userPlan === 'FREE' && (stats?.totalPages || 0) >= 1
    const isAuthLow = userPlan === 'PRO' && (100 - (stats?.plagiarism || 0)) < 50

    return (
        <div className="flex flex-col h-full space-y-8 p-6">
            {/* PROGRESS SECTION */}
            <div className={cn(
                "transition-all duration-1000 p-1 rounded-2xl",
                isOverLimit ? "bg-red-500/20 animate-pulse" : ""
            )}>
                <div className="text-[10px] font-bold text-slate-500 mb-4 tracking-widest flex items-center justify-between">
                    <span>PROGRESSO ABNT</span>
                    {isOverLimit && <span className="text-red-500 flex items-center gap-1"><AlertCircle size={10} /> LIMITE ATINGIDO</span>}
                </div>
                <div className="space-y-4">
                    {stats?.progress.map(cap => (
                        <div key={cap.name} className="space-y-1.5">
                            <div className="flex justify-between text-[11px] text-slate-400">
                                <span>{cap.name}</span><span className="font-bold">{cap.p}%</span>
                            </div>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }} 
                                    animate={{ width: `${cap.p}%` }} 
                                    className="h-full bg-gradient-to-r from-brand-purple to-brand-blue" 
                                />
                            </div>
                        </div>
                    )) || <div className="text-xs text-slate-600 animate-pulse">Carregando métricas...</div>}
                </div>
            </div>

            {/* PLAGIARISM & AUTHORSHIP SECTION */}
            <div className="space-y-4">
                <div className="text-[10px] font-bold text-slate-500 mb-2 tracking-widest flex items-center justify-between">
                    <span>MÉTRICAS TURNITIN</span>
                    <span className="text-xs text-slate-300">{stats?.totalPages || 0}/60 pgs</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <div className={cn(
                        "rounded-2xl p-4 text-center border transition-all",
                        (stats?.plagiarism || 0) > 10 
                            ? "bg-red-500/10 border-red-500/20 text-red-500" 
                            : "bg-green-500/10 border-green-500/20 text-green-500"
                    )}>
                        <div className="text-2xl font-extrabold mb-1">{stats?.plagiarism || 0}%</div>
                        <div className="text-[9px] opacity-60 font-bold uppercase tracking-widest">Plágio</div>
                    </div>

                    <div className="rounded-2xl p-4 text-center border border-white/5 bg-white/5 text-brand-blue">
                        <div className="text-2xl font-extrabold mb-1">{(stats as any)?.humanAuthorship || 67}%</div>
                        <div className="text-[9px] opacity-60 font-bold uppercase tracking-widest">Autoria</div>
                    </div>
                </div>
            </div>

            {/* UPGRADE MESSAGES */}
            <div className="space-y-3">
                {userPlan === 'FREE' && (
                    <div className="bg-brand-blue/10 border border-brand-blue/20 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-brand-blue font-bold leading-tight">
                            1p/dia usada. PRO R$200 = ilimitado
                        </p>
                    </div>
                )}
                {userPlan === 'PRO' && (
                    <div className="bg-brand-purple/10 border border-brand-purple/20 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-brand-purple font-bold leading-tight">
                            1 TCC ativo. VIP R$1000 = 2 TCCs
                        </p>
                    </div>
                )}

                {userPlan === 'PRO' && isAuthLow && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                        <div className="text-[10px] font-bold text-red-500 flex items-center gap-2 mb-1">
                            <AlertCircle size={12} /> BLOQUEIO DE PDF
                        </div>
                        <p className="text-[9px] text-red-400">
                            Autoria abaixo de 50%. Edite o texto para liberar o download.
                        </p>
                    </div>
                )}
            </div>

            {/* ACTION */}
            <div className="mt-auto">
                <button 
                    disabled={(userPlan === 'PRO' && isAuthLow) || isOverLimit}
                    className="w-full py-3 bg-brand-purple text-white rounded-xl font-bold text-sm shadow-brand hover:bg-brand-purple/90 disabled:opacity-30 disabled:grayscale transition-all flex items-center justify-center gap-2"
                >
                    <DownloadIcon size={16} /> Exportar Completo
                </button>
            </div>
        </div>
    )
}
