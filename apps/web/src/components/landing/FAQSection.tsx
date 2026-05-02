"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type Faq = { q: string; a: string }

const FAQS: Faq[] = [
  {
    q: "O que é o Teseo?",
    a: "É uma plataforma que ajuda você a estruturar e conduzir o trabalho, com escrita assistida por IA, edição manual, anexos, métricas e exportação em PDF.",
  },
  {
    q: "O Teseo escreve o TCC inteiro para mim?",
    a: "Não. Ele acelera rascunhos e organização, mas você continua sendo o autor final. O melhor resultado vem quando você revisa, reescreve e ajusta a partir do seu contexto.",
  },
  {
    q: "O conteúdo segue ABNT?",
    a: "O produto foi desenhado para trabalhar com estrutura e padrões acadêmicos. A apresentação final pode variar por instituição, então recomendamos sempre conferir as exigências do seu curso.",
  },
  {
    q: "Posso editar o texto depois de gerar?",
    a: "Sim. O texto é editável no workspace e o autosave garante que você não perca alterações durante a escrita.",
  },
  {
    q: "Posso anexar PDFs e documentos?",
    a: "Sim. Você pode anexar arquivos ao seu projeto. No plano grátis existe um limite; nos planos pagos o limite aumenta.",
  },
  {
    q: "Como funciona o controle de progresso?",
    a: "O dashboard e o workspace exibem percentuais e status por projeto/capítulo. A ideia é dar previsibilidade do que falta e do que já está pronto.",
  },
  {
    q: "O sistema mostra similaridade/plágio?",
    a: "Mostramos um indicador de similaridade para orientar revisões. Isso não é uma acusação, é um sinal de qualidade para reduzir riscos antes da entrega.",
  },
  {
    q: "O plano grátis é suficiente para testar?",
    a: "Sim. O grátis existe para você entender o fluxo e validar se o produto combina com seu ritmo. Se precisar de mais volume e recursos, você sobe de plano.",
  },
  {
    q: "Qual a diferença entre Grátis, Pro e VIP?",
    a: "A diferença principal é capacidade: limites (anexos/uso), exportação e profundidade de recursos. O Pro atende a maioria dos alunos; o VIP é para uso intenso e acompanhamento avançado.",
  },
  {
    q: "Posso usar em qualquer curso?",
    a: "Sim. O fluxo do TCC é parecido em muitas áreas. Você ajusta tema, linguagem e referências conforme seu curso.",
  },
  {
    q: "O Teseo serve para monografia, artigo ou projeto?",
    a: "Ele foi pensado para TCC, mas o fluxo (estrutura, escrita, revisão e exportação) ajuda em monografias, artigos e projetos acadêmicos similares.",
  },
  {
    q: "Preciso instalar algo?",
    a: "Não. É tudo no navegador.",
  },
  {
    q: "O conteúdo fica salvo?",
    a: "Sim. Seu projeto fica salvo na sua conta e você pode continuar de onde parou.",
  },
  {
    q: "Posso exportar PDF?",
    a: "Sim. O dashboard oferece download de PDF do seu conteúdo atual. No grátis pode haver marca d'água; nos planos pagos, exportação limpa.",
  },
]

function Item({
  q,
  a,
  open,
  onToggle,
}: {
  q: string
  a: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left py-3 flex items-start justify-between gap-6"
        aria-expanded={open}
      >
        <div className="text-lg md:text-xl font-medium text-white/85">{q}</div>
        <div
          className={cn(
            "mt-1 text-white/55 transition-transform text-2xl leading-none",
            open ? "rotate-45" : "rotate-0"
          )}
          aria-hidden="true"
        >
          +
        </div>
      </button>
      {open && <div className="pb-5 text-sm text-white/60 leading-relaxed max-w-3xl">{a}</div>}
    </div>
  )
}

export function FAQSection() {
  const [open, setOpen] = React.useState<number>(0)

  return (
    <section id="faq" className="py-20 md:py-24 bg-[#141413] text-white">
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-extrabold font-serif tracking-tight text-white/90">
            Perguntas frequentes
          </h2>

          <div className="mt-10 space-y-6">
            {FAQS.map((f, idx) => (
              <Item
                key={f.q}
                q={f.q}
                a={f.a}
                open={open === idx}
                onToggle={() => setOpen((prev) => (prev === idx ? -1 : idx))}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
