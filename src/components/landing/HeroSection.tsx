"use client"

import { useSession } from "next-auth/react"
import { HeroAuthCard } from "@/components/landing/HeroAuthCard"
import { HeroVideo } from "@/components/landing/HeroVideo"

export function HeroSection() {
  const { data: session } = useSession()

  return (
    <section className="bg-[#141413] text-white">
      {/* Match Claude-like composition: centered left block, portrait video with generous dark space. */}
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <div className="min-h-[calc(100dvh-76px)] pt-10 md:pt-12 pb-28 md:pb-32 grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-10 lg:gap-14 items-center">
          <div className="text-center lg:text-center">
            <h1 className="mx-auto text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.05] font-serif tracking-tight max-w-[16ch]">
              A IA para entregar seu TCC com clareza.
            </h1>
            <p className="mx-auto mt-5 text-base sm:text-lg text-white/70 max-w-[42ch] leading-relaxed">
              Escreva, revise e acompanhe seu TCC com mais controle.
            </p>

            {!session && (
              <div className="flex justify-center">
                <HeroAuthCard />
              </div>
            )}
          </div>

          <div className="w-full flex justify-center lg:justify-end">
            <div className="w-full max-w-[712px]">
              <div
                className="aspect-[9/16]"
                style={{ maxHeight: "min(1243px, calc(100dvh - 140px))" }}
              >
                <HeroVideo src="/hero-claude.mp4" className="h-full w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
