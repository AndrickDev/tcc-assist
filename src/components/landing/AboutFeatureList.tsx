"use client"

import { FileText, BookOpen, BarChart3 } from "lucide-react"
import { AboutFeatureItem } from "@/components/landing/AboutFeatureItem"

export function AboutFeatureList() {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[#141413] shadow-brand overflow-hidden">
      <div className="px-6">
        <AboutFeatureItem
          emphasized
          icon={<FileText size={18} />}
          title="Criar com o Teseo"
          description="Use a plataforma para estruturar capítulos, desenvolver trechos do texto, revisar partes importantes e transformar ideias soltas em um trabalho acadêmico mais consistente."
        />
      </div>

      <div className="h-px bg-white/10" />

      <div className="px-6">
        <AboutFeatureItem
          icon={<BookOpen size={18} />}
          title="Traga seu contexto"
          description="Adicione tema, curso, objetivos, referências e materiais de apoio para orientar a geração do conteúdo e receber resultados mais alinhados ao seu TCC."
        />
      </div>

      <div className="h-px bg-white/10" />

      <div className="px-6">
        <AboutFeatureItem
          icon={<BarChart3 size={18} />}
          title="Acompanhe e evolua com clareza"
          description="Acompanhe progresso, edição, anexos e indicadores do trabalho em um único fluxo, com mais controle sobre o que já foi feito e o que ainda falta entregar."
        />
      </div>
    </div>
  )
}
