"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { BookOpen, ShieldCheck, Search, ArrowRight, LayoutDashboard } from "lucide-react"

export default function OnboardingPage() {
  const router = useRouter()

  const cards = [
    {
      title: "Estrutura ABNT automática",
      description: "IA monta sumário + capítulos conforme normas da sua instituição.",
      icon: <BookOpen className="w-8 h-8 text-brand-purple" />,
    },
    {
      title: "Anti-plágio em tempo real",
      description: "Turnitin sempre <5% + autoria humana controlada rigorosamente.",
      icon: <ShieldCheck className="w-8 h-8 text-green-500" />,
    },
    {
      title: "Referências reais",
      description: "Google Scholar + formatação NBR automática para seu trabalho.",
      icon: <Search className="w-8 h-8 text-brand-blue" />,
    },
  ]

  return (
    <div className="min-h-screen bg-[color:var(--color-brand-bg)] text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-5xl w-full space-y-12 text-center">
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="space-y-4"
        >
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight font-serif">
            Vamos começar seu <span className="text-gradient">TCC!</span> 🎓
          </h1>
          <p className="text-[color:var(--color-brand-muted)] text-lg md:text-xl max-w-2xl mx-auto">
            A plataforma mais avançada para guiar sua jornada acadêmica com inteligência.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-[color:var(--color-brand-surface)] border border-[color:var(--color-brand-border)] p-8 rounded-2xl hover:border-[color:var(--color-brand-accent)] transition-all group"
            >
              <div className="mb-6 bg-[color:var(--color-brand-hover)] w-16 h-16 rounded-xl flex items-center justify-center">
                {card.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{card.title}</h3>
              <p className="text-[color:var(--color-brand-muted)] text-sm leading-relaxed">{card.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div 
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           transition={{ delay: 0.5 }}
           className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-10"
        >
          <button 
            onClick={() => router.push("/dashboard/new-tcc")}
            className="w-full sm:w-auto px-8 py-4 bg-[color:var(--color-brand-accent)] hover:bg-[color:var(--color-brand-accent-hover)] text-white rounded-xl font-bold text-lg shadow-brand active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            Começar meu TCC <ArrowRight size={20} />
          </button>
          
          <button 
            onClick={() => router.push("/dashboard")}
            className="w-full sm:w-auto px-8 py-4 bg-[color:var(--color-brand-hover)] border border-[color:var(--color-brand-border)] text-[color:var(--color-brand-muted)] rounded-xl font-bold text-lg hover:text-white transition-all flex items-center justify-center gap-2"
          >
            <LayoutDashboard size={20} /> Ver meus TCCs
          </button>
        </motion.div>
      </div>
    </div>
  )
}
