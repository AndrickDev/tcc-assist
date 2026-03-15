"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type Item = {
  id: string
  title: string
  blurb: string
  details: string
}

const ITEMS: Item[] = [
  {
    id: "new",
    title: "Criar um novo TCC",
    blurb: "Tema, curso e instituição em 1 minuto.",
    details:
      "Você cria o projeto com o mínimo necessário. O Teseo organiza o workspace, capítulos e o que falta para avançar.",
  },
  {
    id: "structure",
    title: "Gerar estrutura inicial",
    blurb: "Capítulos e subtópicos coerentes com seu tema.",
    details:
      "A IA sugere uma estrutura inicial e você ajusta. O objetivo não é entregar um texto pronto, e sim uma base clara para escrever com controle.",
  },
  {
    id: "write",
    title: "Escrever capitulos com IA",
    blurb: "Rascunhos por etapa, com continuidade.",
    details:
      "Você pede um rascunho por capítulo, refinando por partes. Isso reduz bloqueio e acelera sem perder consistência acadêmica.",
  },
  {
    id: "edit",
    title: "Editar manualmente (autosave)",
    blurb: "Você assume o texto. O sistema acompanha.",
    details:
      "Edite o texto como quiser. O autosave evita perda de conteúdo e ajuda a medir autoria humana no que foi reescrito por você.",
  },
  {
    id: "attach",
    title: "Anexar PDFs e documentos",
    blurb: "Centralize referências e materiais.",
    details:
      "Anexe artigos, PDFs e outros arquivos do seu projeto. Assim o workspace vira o lugar único do seu TCC.",
  },
  {
    id: "track",
    title: "Acompanhar progresso em tempo real",
    blurb: "Visão de andamento por projeto e capítulo.",
    details:
      "Você enxerga o que está pronto, o que falta e o ritmo do projeto. Isso melhora previsibilidade e reduz a ansiedade de 'não sei por onde começar'.",
  },
  {
    id: "similarity",
    title: "Ver similaridade (Turnitin)",
    blurb: "Indicador para reduzir risco antes de entregar.",
    details:
      "O sistema exibe a média de similaridade para ajudar a revisar trechos sensíveis. Não é acusatório: é uma ferramenta de qualidade.",
  },
  {
    id: "export",
    title: "Exportar PDF final",
    blurb: "Um arquivo pronto para enviar ao orientador.",
    details:
      "Exporte o conteúdo atual com consistência visual. No plano grátis, o PDF pode ter marca d'água; nos planos pagos, exportação limpa.",
  },
]

function PreviewCard() {
  return (
    <div className="rounded-2xl border border-[color:var(--color-brand-border)] bg-[color:var(--color-brand-surface)] shadow-brand overflow-hidden">
      <div className="h-10 border-b border-[color:var(--color-brand-border)] bg-[color:var(--color-brand-hover)] flex items-center px-4">
        <div className="text-xs text-[color:var(--color-brand-muted)]">Preview do fluxo</div>
      </div>
      <div className="p-5 space-y-3">
        <div className="rounded-xl border border-[color:var(--color-brand-border)] p-4 bg-[color:var(--color-brand-bg)]/40">
          <div className="text-xs font-semibold text-[color:var(--color-brand-muted)]">Capitulo 2</div>
          <div className="mt-1 text-sm font-semibold">Referencial teorico</div>
          <div className="mt-2 h-2 rounded-full bg-[color:var(--color-brand-border)] overflow-hidden">
            <div className="h-full w-[62%] bg-white/35" />
          </div>
        </div>
        <div className="rounded-xl border border-[color:var(--color-brand-border)] p-4">
          <div className="text-xs font-semibold text-[color:var(--color-brand-muted)]">Similaridade</div>
          <div className="mt-1 text-sm font-semibold">4.2% (baixo risco)</div>
        </div>
      </div>
    </div>
  )
}

export function WorkflowSection() {
  const [activeId, setActiveId] = React.useState<string>(ITEMS[0].id)
  const active = React.useMemo(() => ITEMS.find((i) => i.id === activeId) ?? ITEMS[0], [activeId])

  return (
    <section className="py-16 md:py-20 bg-[#141413] text-white border-t border-white/10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="space-y-2">
          <div className="text-xs font-semibold tracking-widest text-[color:var(--color-brand-muted)]">COMO FUNCIONA</div>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-[0.95fr_1.05fr] gap-10 items-start">
          <div className="space-y-4">
            <PreviewCard />
            <div className="text-sm text-[color:var(--color-brand-muted)] leading-relaxed">
              Clique nos itens ao lado para entender como cada etapa ajuda a sair do zero com segurança e controle.
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--color-brand-border)] bg-[color:var(--color-brand-surface)] shadow-brand overflow-hidden">
            <div className="p-5 border-b border-[color:var(--color-brand-border)] bg-[color:var(--color-brand-hover)]">
              <div className="text-sm font-semibold">Etapas do workspace</div>
              <div className="text-sm text-[color:var(--color-brand-muted)] mt-1">Do planejamento a entrega final.</div>
            </div>

            <div className="p-2">
              {ITEMS.map((item) => {
                const isActive = item.id === activeId
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveId(item.id)}
                    className={cn(
                      "w-full text-left rounded-xl p-4 transition-colors",
                      isActive
                        ? "bg-[color:var(--color-brand-bg)]/40 border border-[color:var(--color-brand-border)]"
                        : "hover:bg-[color:var(--color-brand-hover)]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className={cn("font-semibold")}>
                          {item.title}
                        </div>
                        <div className="text-sm text-[color:var(--color-brand-muted)]">{item.blurb}</div>
                      </div>
                      <div
                        className={cn(
                          "mt-1 w-2 h-2 rounded-full",
                          isActive ? "bg-white/55" : "bg-[color:var(--color-brand-border)]"
                        )}
                      />
                    </div>

                    {isActive && (
                      <div className="mt-3 text-sm leading-relaxed text-[color:var(--color-brand-muted)]">
                        {active.details}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
