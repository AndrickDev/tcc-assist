"use client"

import { AboutVideo } from "@/components/landing/AboutVideo"
import { AboutFeatureList } from "@/components/landing/AboutFeatureList"

export function AboutSection() {
  return (
    <section id="conheca" className="pt-28 pb-16 md:pt-32 md:pb-20 bg-[#141413] text-white">
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <div className="text-center space-y-4">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-serif tracking-tight">
            Conheça o Teseo
          </h2>
          <p className="mx-auto max-w-3xl text-lg leading-relaxed text-white/70">
            O Teseo é uma plataforma de IA criada para ajudar universitários a estruturar, escrever, revisar e
            acompanhar o TCC com mais clareza, controle e confiança.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-10 lg:gap-14 items-start">
          <div className="w-full flex justify-center lg:justify-start">
            <div className="w-full max-w-[640px]">
              <div className="aspect-video">
                <AboutVideo className="h-full w-full" />
              </div>
            </div>
          </div>
          <div className="w-full max-w-[520px] mx-auto lg:mx-0">
            <AboutFeatureList />
          </div>
        </div>
      </div>
    </section>
  )
}
