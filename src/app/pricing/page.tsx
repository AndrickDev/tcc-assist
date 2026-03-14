"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { motion } from "framer-motion"
import { Check, Star, Zap, Crown, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default function PricingPage() {
    const { data: session } = useSession()
    const [loading, setLoading] = React.useState<string | null>(null)

    const handleUpgrade = async (plan: 'PRO' | 'VIP') => {
        setLoading(plan)
        try {
            const res = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan })
            })
            const { url, error } = await res.json()
            if (error) throw new Error(error)
            window.location.href = url
        } catch (err) {
            console.error(err)
            alert("Erro ao iniciar checkout. Tente novamente.")
        } finally {
            setLoading(null)
        }
    }

    const plans = [
        {
            id: 'FREE',
            name: 'FREE',
            price: 'R$ 0',
            icon: <Zap className="text-slate-400" size={24} />,
            features: [
                '1 página (1800 caracteres) por dia',
                '1 TCC ativo simultâneo',
                'PDF com marca d\'água',
                'Suporte via comunidade'
            ],
            cta: 'Plano Atual',
            disabled: true,
            color: 'slate'
        },
        {
            id: 'PRO',
            name: 'PRO ⭐',
            price: 'R$ 200',
            sub: 'por TCC completo',
            icon: <Star className="text-brand-blue" size={24} />,
            features: [
                'Páginas ilimitadas (sem trava diária)',
                '1 TCC completo',
                'PDF sem marca d\'água',
                'IA de alta qualidade (Gemini Pro)'
            ],
            cta: 'Comprar PRO',
            disabled: false,
            color: 'blue'
        },
        {
            id: 'VIP',
            name: 'VIP',
            price: 'R$ 1.000',
            sub: '2 TCCs simultâneos',
            icon: <Crown className="text-brand-purple" size={24} />,
            features: [
                'Tudo do plano PRO',
                'Até 2 TCCs ativos simultâneos',
                'Prioridade na fila de geração',
                'Suporte direto via WhatsApp'
            ],
            cta: 'Comprar VIP',
            disabled: false,
            color: 'purple'
        }
    ]

    return (
        <div className="min-h-screen bg-[#05050A] text-white selection:bg-brand-purple/30">
            {/* BACKGROUND RADIANT */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-purple/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-blue/10 blur-[120px] rounded-full" />
            </div>

            <nav className="relative z-10 p-6 flex items-center justify-between max-w-7xl mx-auto">
                <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group">
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    Voltar ao Dashboard
                </Link>
                <div className="text-xl font-black tracking-tighter bg-gradient-to-r from-white to-slate-500 bg-clip-text text-transparent">
                    TCC-ASSIST
                </div>
            </nav>

            <main className="relative z-10 max-w-7xl mx-auto px-6 py-20 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-16"
                >
                    <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4">
                        Acelere sua <span className="text-brand-purple">Graduação</span>
                    </h1>
                    <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                        Escolha o plano ideal para finalizar seu TCC com a ajuda da nossa inteligência artificial avançada.
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-3 gap-8 items-stretch">
                    {plans.map((plan, i) => (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className={cn(
                                "group relative flex flex-col p-8 rounded-3xl border transition-all duration-500",
                                plan.color === 'blue' && "border-brand-blue/20 bg-brand-blue/5 hover:border-brand-blue/50",
                                plan.color === 'purple' && "border-brand-purple/20 bg-brand-purple/5 hover:border-brand-purple/50",
                                plan.color === 'slate' && "border-white/5 bg-white/5"
                            )}
                        >
                            {plan.id === 'PRO' && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-blue text-white text-[10px] font-black tracking-widest px-4 py-1.5 rounded-full uppercase shadow-lg shadow-brand-blue/40">
                                    Mais Popular
                                </div>
                            )}

                            <div className="mb-8 text-left">
                                <div className="p-3 w-fit rounded-2xl bg-white/5 mb-4">{plan.icon}</div>
                                <h3 className="text-2xl font-black tracking-tight mb-2">{plan.name}</h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black tracking-tighter">{plan.price}</span>
                                    {plan.sub && <span className="text-slate-500 text-xs">{plan.sub}</span>}
                                </div>
                            </div>

                            <ul className="space-y-4 mb-10 text-left flex-1">
                                {plan.features.map(feature => (
                                    <li key={feature} className="flex gap-3 items-start text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                                        <div className={cn(
                                            "mt-1 p-0.5 rounded-full",
                                            plan.color === 'blue' && "bg-brand-blue/20 text-brand-blue",
                                            plan.color === 'purple' && "bg-brand-purple/20 text-brand-purple",
                                            plan.color === 'slate' && "bg-white/10 text-slate-500"
                                        )}>
                                            <Check size={12} />
                                        </div>
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => !plan.disabled && handleUpgrade(plan.id as 'PRO' | 'VIP')}
                                disabled={plan.disabled || loading !== null}
                                className={cn(
                                    "w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                                    plan.id === 'FREE' && "bg-white/10 text-slate-500 cursor-not-allowed",
                                    plan.id === 'PRO' && "bg-brand-blue text-white hover:bg-brand-blue/90 shadow-lg shadow-brand-blue/20",
                                    plan.id === 'VIP' && "bg-brand-purple text-white hover:bg-brand-purple/90 shadow-lg shadow-brand-purple/20"
                                )}
                            >
                                {loading === plan.id ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : plan.cta}
                            </button>
                        </motion.div>
                    ))}
                </div>
            </main>
        </div>
    )
}
