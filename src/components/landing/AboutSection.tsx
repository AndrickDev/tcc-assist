"use client"

import { AboutVideo } from "@/components/landing/AboutVideo"
import { AboutFeatureList } from "@/components/landing/AboutFeatureList"

export function AboutSection() {
  return (
    <section id="conheca" className="pt-28 pb-16 md:pt-32 md:pb-20 bg-brand-bg text-brand-text">
      <div className="max-w-7xl mx-auto px-5 sm:px-6">
        <div className="text-center space-y-4">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-serif tracking-tight">
            Conheça o Teseo
          </h2>
          <p className="mx-auto max-w-3xl text-lg leading-relaxed text-brand-muted">
            O Teseo é uma plataforma de IA criada para ajudar universitários a estruturar, escrever, revisar e
            acompanhar o TCC com mais clareza, controle e confiança.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-10 lg:gap-12 items-start">
          <div className="w-full">
            <div className="aspect-video">
              <AboutVideo className="h-full w-full" />
            </div>
          </div>
          <div className="w-full">
            <AboutFeatureList />
          </div>
        </div>
      </div>
    </section>
  )
}
