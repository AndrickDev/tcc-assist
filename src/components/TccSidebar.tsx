"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  AlertCircle, Download as DownloadIcon, BarChart3, Fingerprint, Upload, Crown, Info
} from "lucide-react"
import { cn } from "@/lib/utils"
import { trackEvent } from "@/lib/analytics"

interface Stats {
    progress: number
    plagiarism: number
    humanAuthorship: number
    totalPages: number
    status: string
}

interface TccSidebarProps {
    stats: Stats | null
    userPlan: string
    tccId?: string
    humanAuthorshipOverride?: number
    onUpgrade?: () => void
    onExport?: () => void
}

export function TccSidebar({ stats: initialStats, userPlan, tccId, humanAuthorshipOverride, onUpgrade, onExport }: TccSidebarProps) {
    const [stats, setStats] = React.useState<Stats | null>(initialStats)
    const [progress, setProgress] = React.useState(initialStats?.progress || 0)
    const [turnitin, setTurnitin] = React.useState(initialStats?.plagiarism || 0)
    const [humanAuthorship, setHumanAuthorship] = React.useState(67)

    const [attachmentsCount, setAttachmentsCount] = React.useState(0)
    const [attachmentsLimit, setAttachmentsLimit] = React.useState(userPlan === "VIP" ? 50 : userPlan === "PRO" ? 20 : 5)
    const [uploading, setUploading] = React.useState(false)
    const [uploadError, setUploadError] = React.useState<string | null>(null)
    const fileRef = React.useRef<HTMLInputElement>(null)

    React.useEffect(() => {
        setStats(initialStats)
        if (initialStats?.progress !== undefined) setProgress(initialStats.progress)
        if (initialStats?.plagiarism !== undefined) setTurnitin(initialStats.plagiarism)
        if (initialStats?.humanAuthorship !== undefined) setHumanAuthorship(initialStats.humanAuthorship)
    }, [initialStats])

    React.useEffect(() => {
        if (typeof humanAuthorshipOverride === "number" && !Number.isNaN(humanAuthorshipOverride)) {
            setHumanAuthorship(Math.max(0, Math.min(100, Math.round(humanAuthorshipOverride))))
        }
    }, [humanAuthorshipOverride])

    const refreshAttachments = React.useCallback(async () => {
        if (!tccId) return
        try {
            const res = await fetch(`/api/tcc/${tccId}/attachments`, { cache: "no-store" })
            const data = await res.json()
            if (!data?.error) {
                setAttachmentsCount(data.count ?? 0)
                setAttachmentsLimit(data.limit ?? attachmentsLimit)
            }
        } catch (e) {
            console.error(e)
        }
    }, [tccId, attachmentsLimit])

    React.useEffect(() => {
        refreshAttachments()
    }, [refreshAttachments])

    const handleSidebarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!tccId) return
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        const formData = new FormData()
        formData.append("file", file)
        try {
            const res = await fetch(`/api/tcc/${tccId}/attachments`, { method: "POST", body: formData })
            const data = await res.json()
            if (data?.error) {
                setUploadError(data.error)
                setTimeout(() => setUploadError(null), 5000)
            } else {
                setUploadError(null)
            }
            await refreshAttachments()
        } catch (err) {
            console.error(err)
        } finally {
            setUploading(false)
            if (fileRef.current) fileRef.current.value = ""
        }
    }

    const isOverLimit = userPlan === 'FREE' && (stats?.totalPages || 0) >= 1
    // Only block export for PRO/VIP with very low authorship — FREE always opens the watermark modal
    const isAuthLow = userPlan !== 'FREE' && turnitin > 50

    return (
        <div className="flex flex-col h-full space-y-6 p-6">
            {/* PROGRESS SECTION */}
            <div className="space-y-4">
                <div className="text-[10px] font-bold text-[var(--brand-muted)] mb-2 tracking-widest flex items-center justify-between">
                    <span>MÉTRICAS DO TCC</span>
                    {isOverLimit && <span className="text-red-500 flex items-center gap-1 font-bold animate-pulse"><AlertCircle size={10} /> LIMITE FREE</span>}
                </div>

                <div className="space-y-5">
                    {/* Progress */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <div className="flex items-center gap-2 text-[var(--brand-muted)]/80">
                                <BarChart3 size={14} className="text-[var(--brand-muted)]/70" />
                                <span className="text-[11px] font-medium">Progresso Total</span>
                            </div>
                            <span className="text-sm font-bold text-[var(--brand-text)]">{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-[var(--brand-surface)] rounded-full overflow-hidden">
                            <motion.div 
                                initial={{ width: 0 }} 
                                animate={{ width: `${progress}%` }} 
                                className="h-full bg-white/30"
                            />
                        </div>
                    </div>

                    {/* Plagiarism */}
                    <div className="relative group/turnitin">
                        <div className="flex items-center justify-between p-3 bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl hover:bg-[var(--brand-surface)] transition-colors">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🎯</span>
                                <div>
                                    <div className="text-[10px] text-[var(--brand-muted)] font-bold leading-none flex items-center gap-1.5 cursor-help"
                                         tabIndex={0}
                                         onFocus={() => trackEvent('TURNITIN_INFO_HOVER')}
                                         onMouseEnter={() => trackEvent('TURNITIN_INFO_HOVER')}
                                    >
                                        ORIGINALIDADE 
                                        <Info size={11} className="text-[var(--brand-muted)]/40 hover:text-[var(--brand-muted)]/70 transition-colors" />
                                    </div>
                                    <div className="text-[10px] text-orange-700/70 font-bold mt-1 uppercase tracking-wider">Estimativa (Mock)</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={cn(
                                    "w-2 h-2 rounded-full animate-pulse",
                                    turnitin <= 10 ? "bg-green-500" : turnitin <= 25 ? "bg-orange-700" : "bg-red-500"
                                )} />
                                <span className={cn(
                                    "text-sm font-bold",
                                    turnitin <= 10 ? "text-green-500" : turnitin <= 25 ? "text-orange-700" : "text-red-500"
                                )}>{turnitin}%</span>
                            </div>
                        </div>

                        {/* Turnitin Tooltip Popover */}
                        <div className="absolute right-0 top-[110%] w-64 bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl p-3.5 shadow-2xl opacity-0 invisible group-hover/turnitin:opacity-100 group-focus-within/turnitin:opacity-100 group-hover/turnitin:visible group-focus-within/turnitin:visible group-hover/turnitin:translate-y-1 group-focus-within/turnitin:translate-y-1 transition-all z-50 pointer-events-none">
                            <div className="flex items-start gap-2.5">
                                <div className="mt-0.5 shrink-0 bg-[var(--brand-surface)] p-1 rounded-md">
                                    <Info size={12} className="text-[var(--brand-muted)]/70" />
                                </div>
                                <div>
                                    <h4 className="text-[11px] font-bold text-[var(--brand-text)]/80 mb-1">Apoio Complementar</h4>
                                    <p className="text-[11px] text-[var(--brand-muted)] leading-relaxed font-normal">
                                        O Turnitin funciona como apoio complementar de análise. Ele não garante aprovação do TCC nem substitui a revisão acadêmica. No Teseo, a principal correção acontece com análise por IA e revisão guiada do conteúdo junto ao estudante.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Authorship */}
                    <div className="flex items-center justify-between p-3 bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl">
                        <div className="flex items-center gap-2">
                            <Fingerprint size={18} className="text-[var(--brand-muted)]/70" />
                            <div>
                                <div className="text-[10px] text-[var(--brand-muted)] font-bold leading-none">AUTORIA</div>
                                <div className="text-[11px] text-[var(--brand-text)]/80 font-medium mt-1">Human Check</div>
                            </div>
                        </div>
                        <span className="text-sm font-bold text-[var(--brand-text)]/70">{humanAuthorship}%</span>
                    </div>
                </div>
            </div>

            {/* ATTACHMENTS ACTION */}
            <div className="space-y-3">
                <button 
                    onClick={() => fileRef.current?.click()}
                    disabled={!tccId || uploading || attachmentsCount >= attachmentsLimit}
                    className="w-full flex items-center justify-between p-3 bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl hover:bg-[var(--brand-hover)] transition-all group"
                >
                    <div className="flex items-center gap-2 text-[var(--brand-text)]/80">
                        <Upload size={16} className="group-hover:text-brand-purple transition-colors" />
                        <span className="text-xs font-bold">Anexar PDF/DOC</span>
                    </div>
                    <span className="text-[10px] text-[var(--brand-muted)]">
                        {uploading ? "Enviando…" : `${attachmentsCount} de ${attachmentsLimit}`}
                    </span>
                </button>
                {uploadError && (
                    <p className="text-[11px] text-red-400 px-1 leading-snug">{uploadError}</p>
                )}
                <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                    onChange={handleSidebarUpload}
                />
            </div>

            {/* UPGRADE BUTTON */}
            {userPlan === 'FREE' && (
                <button
                    onClick={onUpgrade}
                    className="w-full py-3 bg-[var(--brand-hover)] border border-[var(--brand-border)] text-[var(--brand-text)]/80 rounded-xl font-bold text-xs hover:bg-[var(--brand-hover)] transition-colors flex items-center justify-center gap-2">
                    <Crown size={14} /> Upgrade para PRO
                </button>
            )}

            {/* EXPORT ACTION */}
            <div className="mt-auto pt-4 border-t border-[var(--brand-border)]">
                <button
                    onClick={onExport}
                    disabled={isAuthLow}
                    className="w-full py-3 border border-[var(--brand-border)] text-[var(--brand-text)]/80 rounded-xl font-bold text-sm hover:bg-[var(--brand-surface)] disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                >
                    <DownloadIcon size={16} /> Exportar Completo
                </button>
            </div>
        </div>
    )
}
