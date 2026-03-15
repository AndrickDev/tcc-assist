"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Sparkles, Loader2, School, Book } from "lucide-react"

export default function NewTccPage() {
  const router = useRouter()
  const [step, setStep] = React.useState(1)
  const [loading, setLoading] = React.useState(false)
  const [formData, setFormData] = React.useState({
    title: "",
    course: "",
    institution: ""
  })

  const handleNext = () => {
    if (step < 3) setStep(step + 1)
    else handleCreate()
  }

  const handleCreate = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/tcc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (data.id) {
        router.push(`/tcc/${data.id}`)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0F0F1A] text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white/[0.03] border border-white/5 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-white/5">
            <motion.div 
                className="h-full bg-brand-purple"
                animate={{ width: `${(step / 3) * 100}%` }}
            />
        </div>

        <button 
          onClick={() => step > 1 ? setStep(step - 1) : router.back()}
          className="mb-8 p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-white flex items-center gap-2 text-sm font-medium"
        >
          <ArrowLeft size={18} /> {step === 1 ? "Voltar" : "Anterior"}
        </button>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <h1 className="text-2xl font-extrabold tracking-tight">Qual o tema do seu TCC?</h1>
                <p className="text-sm text-slate-500">Pode ser uma ideia inicial ou um título completo.</p>
              </div>
              <textarea 
                autoFocus
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                placeholder="Ex: O impacto da IA na educação básica..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-lg focus:outline-none focus:border-brand-purple min-h-[150px] resize-none"
              />
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <h1 className="text-2xl font-extrabold tracking-tight">Preencha os dados acadêmicos</h1>
                <p className="text-sm text-slate-500">Essas informações ajudam a IA a seguir as normas da sua faculdade.</p>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Book size={14} /> Curso
                    </label>
                    <input 
                        type="text"
                        value={formData.course}
                        onChange={e => setFormData({...formData, course: e.target.value})}
                        placeholder="Ex: Engenharia de Software"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-purple"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <School size={14} /> Instituição
                    </label>
                    <input 
                        type="text"
                        value={formData.institution}
                        onChange={e => setFormData({...formData, institution: e.target.value})}
                        placeholder="Ex: USP / UNESP"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-purple"
                    />
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-8 text-center"
            >
               <div className="w-16 h-16 bg-brand-purple/20 rounded-full flex items-center justify-center mx-auto">
                    <Sparkles className="text-brand-purple w-8 h-8" />
               </div>
               <div className="space-y-2">
                <h1 className="text-2xl font-extrabold tracking-tight">Tudo pronto para começar!</h1>
                <p className="text-sm text-slate-500">A IA vai gerar a estrutura ABNT completa baseada em seus dados.</p>
              </div>

              <div className="bg-white/5 rounded-2xl p-6 text-left border border-brand-purple/20 space-y-3">
                 <div className="text-xs font-bold text-brand-purple uppercase tracking-widest">Resumo do Projeto</div>
                 <h2 className="text-lg font-bold">&quot;{formData.title}&quot;</h2>
                 <div className="text-sm text-slate-400">{formData.course} @ {formData.institution}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-10 flex items-center justify-end">
            <button 
                onClick={handleNext}
                disabled={loading || (step === 1 && !formData.title) || (step === 2 && (!formData.course || !formData.institution))}
                className="px-8 py-3 bg-brand-purple text-white rounded-xl font-bold shadow-brand hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
            >
                {loading ? <Loader2 className="animate-spin" /> : step === 3 ? "Começar Agora" : "Continuar"}
                {step < 3 && <ArrowRight size={18} />}
            </button>
        </div>
      </div>
    </div>
  )
}
