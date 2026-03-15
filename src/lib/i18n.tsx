"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

type Language = "PT" | "EN"

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const translations = {
  PT: {
    "nav.back_to_site": "Voltar ao site",
    "header.tagline": "Seu orientador IA para TCC — 4% Turnitin",
    "header.login": "Entrar",
    "header.cta": "Começar grátis",

    "hero.h1": "TCC aprovado em 45 minutos",
    "hero.subtitle": "Estrutura ABNT automática, referências reais e revisão anti-plágio. Sem cartão para começar.",
    "hero.stat1.num": "350+",
    "hero.stat1.text": "TCCs guiados",
    "hero.stat2.num": "4,2%",
    "hero.stat2.text": "Similaridade média",
    "hero.stat3.num": "25min",
    "hero.stat3.text": "por capítulo",
    "hero.video": "demo 15s: chat → PDF",
    "hero.cta.primary": "Começar grátis - sem cartão",
    "hero.cta.secondary": "Ver como funciona",

    "how.title": "COMO FUNCIONA",
    "how.step1.title": "Defina seu projeto",
    "how.step1.desc": "Informe curso, instituição e tema. Adaptamos às regras da sua faculdade.",
    "how.step2.title": "Monte sua pesquisa",
    "how.step2.desc": "Assistente sugere estrutura e reúne referências reais (artigos, leis, julgados) para aprovação.",
    "how.step3.title": "Escreva com suporte IA",
    "how.step3.desc": "Gere rascunhos por capítulo, reescreva com suas palavras e revise junto com o sistema.",
    "how.step4.title": "Entregue com segurança",
    "how.step4.desc": "PDF formatado ABNT + relatório de similaridade antes de enviar ao orientador.",

    "why.title": "POR QUE ESTUDANTES ESCOLHEM O TCC-ASSIST",
    "why.bullet1": "Evita reprovação por plágio (média 4,2% similaridade Turnitin)",
    "why.bullet2": "Economiza 40+ horas de organização e pesquisa",
    "why.bullet3": "Funciona em qualquer área: Direito, Administração, TI, Saúde",

    "pricing.title": "PLANOS",
    "pricing.free.title": "GRÁTIS",
    "pricing.free.price": "R$ 0",
    "pricing.free.period": "/mês",
    "pricing.free.f1": "1 página/dia",
    "pricing.free.f2": "ABNT básica",
    "pricing.free.f3": "Download PDF",
    "pricing.free.cta": "Começar",

    "pricing.pro.title": "PRO",
    "pricing.pro.badge": "Mais escolhido",
    "pricing.pro.price": "R$ 200",
    "pricing.pro.period": "/TCC",
    "pricing.pro.f1": "Capítulos ilimitados (1 TCC)",
    "pricing.pro.f2": "Referências reais sugeridas",
    "pricing.pro.f3": "Revisão anti-plágio",
    "pricing.pro.f4": "Chat suporte projeto",
    "pricing.pro.cta": "Assinar PRO",

    "pricing.vip.title": "VIP",
    "pricing.vip.price": "R$ 1000",
    "pricing.vip.period": "/projeto",
    "pricing.vip.f1": "Acompanhamento até TCC pronto",
    "pricing.vip.f2": "Revisão pré-banca completa",
    "pricing.vip.f3": "Checklist argumentos",
    "pricing.vip.f4": "Suporte prioritário",
    "pricing.vip.cta": "Falar c/ IA",

    "faq.title": "PERGUNTAS FREQUENTES",
    "faq.q1": "Como funciona o anti-plágio?",
    "faq.a1": "Nosso sistema possui uma verificação cruzada com bancos de dados similares aos de universidades, garantindo originalidade e prevenindo reprovações.",
    "faq.q2": "É legal usar IA no TCC?",
    "faq.a2": "Sim. Nossa IA funciona como um orientador que guia sua escrita, sugere estrutura e pesquisa referências reais. Você é o autor do texto final, o que é totalmente permitido.",
    "faq.q3": "Como funciona o suporte?",
    "faq.a3": "Dependendo do plano, oferecemos desde suporte automatizado via chat até mentoria personalizada e revisão pré-banca com especialistas.",
    "faq.q4": "Garantia de aprovação?",
    "faq.a4": "O TCC-ASSIST maximiza drasticamente as chances de aprovação devido à estruturação ABNT e checagem anti-plágio. Contudo, a nota recai na banca avaliadora.",

    "footer.how": "Como funciona",
    "footer.pricing": "Preços",
    "footer.contact": "Contato",
    "footer.privacy": "Privacidade",
    "footer.copy": "© 2026 TCC-ASSIST — Orientação acadêmica legal. Não substitui orientador institucional.",

    "dashboard.title": "Dashboard",
    "dashboard.new_tcc": "Novo TCC",
    "dashboard.loading": "Carregando seus TCCs...",
    "dashboard.empty_title": "Você ainda não criou nenhum TCC.",
    "dashboard.empty_desc": "Clique em “Novo TCC” para começar.",
    "dashboard.summary": "RESUMO",
    "dashboard.progress": "Progresso TCCs",
    "dashboard.turnitin_avg": "TURNITIN MÉDIO",
    "dashboard.realtime": "Real-time (poll 5s)",
    "dashboard.attachments": "ANEXOS",
    "dashboard.attachments_selected": "Do TCC selecionado",
    "dashboard.attachments_select": "Selecione um TCC",
    "dashboard.plan": "Plano",
    "dashboard.config": "Config",
    "dashboard.open_workspace": "Abrir Workspace",
    "dashboard.pdf": "PDF",

    "newtcc.title": "Novo TCC",
    "newtcc.step": "PASSO",
    "newtcc.step1": "1) Qual o tema?",
    "newtcc.step2": "2) Curso e instituição",
    "newtcc.step3": "3) Confirmar",
    "newtcc.back": "Voltar",
    "newtcc.continue": "Continuar",
    "newtcc.confirm": "Confirmar",
    "newtcc.creating": "Criando...",

    "config.title": "Configurações",
    "config.theme": "Tema",
    "config.language": "Idioma",
    "config.upgrade": "Upgrade",
    "config.account": "CONTA",
    "config.signout": "Sair",
  },
  EN: {
    "nav.back_to_site": "Back to site",
    "header.tagline": "Your AI Thesis Advisor — 4% Turnitin",
    "header.login": "Log In",
    "header.cta": "Start Free",

    "hero.h1": "Thesis approved in 45 minutes",
    "hero.subtitle": "Automatic ABNT structure, real references, anti-plagiarism review. No card required to start.",
    "hero.stat1.num": "350+",
    "hero.stat1.text": "Theses guided",
    "hero.stat2.num": "4.2%",
    "hero.stat2.text": "Avg similarity",
    "hero.stat3.num": "25min",
    "hero.stat3.text": "Per chapter",
    "hero.video": "15s demo: chat → PDF",
    "hero.cta.primary": "Start free - no card",
    "hero.cta.secondary": "See how it works",

    "how.title": "HOW IT WORKS",
    "how.step1.title": "Define your project",
    "how.step1.desc": "Enter course, institution and topic. We adapt to your university rules.",
    "how.step2.title": "Build your research",
    "how.step2.desc": "Assistant suggests structure and gathers real references (articles, laws, cases) for approval.",
    "how.step3.title": "Write with AI support",
    "how.step3.desc": "Generate chapter drafts, rewrite in your words, review with the system.",
    "how.step4.title": "Deliver safely",
    "how.step4.desc": "ABNT formatted PDF + similarity report before submitting to advisor.",

    "why.title": "WHY STUDENTS CHOOSE TCC-ASSIST",
    "why.bullet1": "Avoids plagiarism rejection (avg 4.2% Turnitin similarity)",
    "why.bullet2": "Saves 40+ hours of organization and research",
    "why.bullet3": "Works for any field: Law, Business, IT, Health",

    "pricing.title": "PLANS",
    "pricing.free.title": "FREE",
    "pricing.free.price": "$0",
    "pricing.free.period": "/month",
    "pricing.free.f1": "1 page/day",
    "pricing.free.f2": "Basic ABNT",
    "pricing.free.f3": "PDF download",
    "pricing.free.cta": "Start",

    "pricing.pro.title": "PRO",
    "pricing.pro.badge": "Most popular",
    "pricing.pro.price": "$40",
    "pricing.pro.period": "/thesis",
    "pricing.pro.f1": "Unlimited chapters (1 thesis)",
    "pricing.pro.f2": "Real references suggested",
    "pricing.pro.f3": "Anti-plagiarism review",
    "pricing.pro.f4": "Project chat support",
    "pricing.pro.cta": "Subscribe PRO",

    "pricing.vip.title": "VIP",
    "pricing.vip.price": "$200",
    "pricing.vip.period": "/project",
    "pricing.vip.f1": "Full guidance until thesis done",
    "pricing.vip.f2": "Pre-defense full review",
    "pricing.vip.f3": "Argument checklist",
    "pricing.vip.f4": "Priority support",
    "pricing.vip.cta": "Talk to AI",

    "faq.title": "FREQUENTLY ASKED QUESTIONS",
    "faq.q1": "How does anti-plagiarism work?",
    "faq.a1": "Our system cross-checks your text against massive databases similar to university standards, ensuring originality and preventing rejections.",
    "faq.q2": "Is using AI for a thesis legal?",
    "faq.a2": "Yes. Our AI acts as an advisor, guiding your writing, structuring chapters, and finding real references. You remain the final author of the text.",
    "faq.q3": "How does support operate?",
    "faq.a3": "Depending on the plan, we offer anything from automated chat help to 1-on-1 personalized mentoring and complete pre-defense reviews.",
    "faq.q4": "Is approval guaranteed?",
    "faq.a4": "TCC-ASSIST drastically increases your chances by ensuring perfect ABNT formatting and zero plagiarism. However, final grading lies with the evaluation committee.",

    "footer.how": "How it works",
    "footer.pricing": "Pricing",
    "footer.contact": "Contact",
    "footer.privacy": "Privacy",
    "footer.copy": "© 2026 TCC-ASSIST — Legal academic guidance. Does not replace an institutional advisor.",

    "dashboard.title": "Dashboard",
    "dashboard.new_tcc": "New TCC",
    "dashboard.loading": "Loading your TCCs...",
    "dashboard.empty_title": "You haven't created any TCC yet.",
    "dashboard.empty_desc": "Click “New TCC” to start.",
    "dashboard.summary": "SUMMARY",
    "dashboard.progress": "TCC Progress",
    "dashboard.turnitin_avg": "AVG TURNITIN",
    "dashboard.realtime": "Real-time (poll 5s)",
    "dashboard.attachments": "ATTACHMENTS",
    "dashboard.attachments_selected": "From selected TCC",
    "dashboard.attachments_select": "Select a TCC",
    "dashboard.plan": "Plan",
    "dashboard.config": "Settings",
    "dashboard.open_workspace": "Open Workspace",
    "dashboard.pdf": "PDF",

    "newtcc.title": "New TCC",
    "newtcc.step": "STEP",
    "newtcc.step1": "1) Topic",
    "newtcc.step2": "2) Course & institution",
    "newtcc.step3": "3) Confirm",
    "newtcc.back": "Back",
    "newtcc.continue": "Continue",
    "newtcc.confirm": "Confirm",
    "newtcc.creating": "Creating...",

    "config.title": "Settings",
    "config.theme": "Theme",
    "config.language": "Language",
    "config.upgrade": "Upgrade",
    "config.account": "ACCOUNT",
    "config.signout": "Sign out",
  }
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("PT")

  useEffect(() => {
    const saved = localStorage.getItem("tcc_lang") as Language
    if (saved && (saved === "PT" || saved === "EN")) {
      setLanguage(saved)
    }
  }, [])

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang)
    localStorage.setItem("tcc_lang", lang)
  }

  const t = (key: string): string => {
    return (translations[language] as Record<string, string>)[key] || key
  }

  return (
    <I18nContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider")
  }
  return context
}
