"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useI18n } from "@/lib/i18n"
import { motion, useScroll, useTransform } from "framer-motion"
import { GradientButton } from "@/components/ui/gradient-button"
import { GlassCard } from "@/components/ui/glass-card"
import { ArrowRight, CheckCircle2, FileText, MessageSquare, Download, Play, Sun, Moon, Globe, LogOut, LayoutDashboard } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useSession, signOut } from "next-auth/react"

export default function LandingPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const { scrollY } = useScroll()
  const headerOpacity = useTransform(scrollY, [0, 100], [0, 1])
  
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, t } = useI18n()
  const { data: session, status } = useSession()

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark")
  const toggleLanguage = () => setLanguage(language === "PT" ? "EN" : "PT")

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  }

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }

  return (
    <div className="min-h-[100dvh] pb-24 overflow-x-hidden pt-16 bg-white dark:bg-[#0F0F1A] text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Header */}
      <motion.header 
        style={{ backgroundColor: `rgba(var(--header-bg), ${headerOpacity.get() * 0.8})` }}
        className="fixed top-0 left-0 right-0 z-50 h-[64px] backdrop-blur-md border-b border-black/5 dark:border-white/5 flex items-center justify-center px-4 transition-colors [--header-bg:255,255,255] dark:[--header-bg:15,15,26]"
      >
        <div className="w-full max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-extrabold text-xl tracking-tight text-gradient">TCC-ASSIST™</span>
            <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:inline border-l border-black/10 dark:border-white/10 pl-4">{t("header.tagline")}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors" aria-label="Toggle Theme">
              {mounted ? (theme === "dark" ? <Sun size={18} /> : <Moon size={18} />) : <div className="w-[18px] h-[18px]" />}
            </button>
            <button onClick={toggleLanguage} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1 text-sm font-medium" aria-label="Toggle Language">
              <Globe size={18} /> {mounted ? language : "PT"}
            </button>
            <div className="w-[1px] h-6 bg-black/10 dark:bg-white/10 hidden sm:block mx-1"></div>
            {status === "loading" ? (
              <div className="w-20 h-8 animate-pulse bg-slate-200 dark:bg-white/10 rounded-full" />
            ) : session ? (
              <div className="flex items-center gap-2">
                <Link href="/dashboard" className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full border border-black/10 dark:border-white/20 hover:border-black/30 dark:hover:border-white/50 transition-colors">
                  <LayoutDashboard size={16} />
                  Dashboard
                </Link>
                <div className="w-[1px] h-6 bg-black/10 dark:bg-white/10 hidden sm:block mx-1"></div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-purple to-brand-blue flex items-center justify-center text-white shadow-brand font-bold text-sm">
                    {session.user?.name?.[0] || session.user?.email?.[0]?.toUpperCase() || "U"}
                  </div>
                  <button onClick={() => signOut()} className="p-2 text-slate-500 hover:text-red-500 transition-colors" title="Sair">
                    <LogOut size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Link href="/login" className="px-4 py-2 text-sm font-medium rounded-full border border-black/10 dark:border-white/20 hover:border-black/30 dark:hover:border-white/50 transition-colors hidden sm:block">
                  {t("header.login")}
                </Link>
                <Link href="/register">
                  <GradientButton className="rounded-full px-4 sm:px-6 py-2 text-sm">{t("header.cta")}</GradientButton>
                </Link>
              </>
            )}
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-12 px-4 bg-[radial-gradient(ellipse_at_top,_#f8fafc_0%,_#ffffff_60%)] dark:bg-[radial-gradient(ellipse_at_top,_#1e1b4b_0%,_#0f0f1a_60%)]">
        <div className="max-w-4xl text-center space-y-6 relative z-10">
          <motion.h1 
            initial="hidden" animate="visible" variants={fadeInUp}
            className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1]"
          >
            {t("hero.h1").split("45")[0]}<span className="text-gradient hover:animate-pulse">45</span>{t("hero.h1").split("45")[1]}
          </motion.h1>
          <motion.p 
            initial="hidden" animate="visible" variants={fadeInUp} transition={{ delay: 0.1 }}
            className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto"
          >
            {t("hero.subtitle")}
          </motion.p>

          <motion.div 
            initial="hidden" animate="visible" variants={staggerContainer}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 max-w-3xl mx-auto"
          >
            {[
              { num: t("hero.stat1.num"), text: t("hero.stat1.text") },
              { num: t("hero.stat2.num"), text: t("hero.stat2.text") },
              { num: t("hero.stat3.num"), text: t("hero.stat3.text") }
            ].map((stat, i) => (
              <motion.div variants={fadeInUp} key={i}>
                <GlassCard className="p-4 text-center rounded-2xl hover:-translate-y-1 transition-transform bg-white/50 dark:bg-white/5 border-black/5 dark:border-white/10">
                  <div className="text-3xl font-extrabold text-gradient">{stat.num}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{stat.text}</div>
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>

          <motion.div 
            initial="hidden" animate="visible" variants={fadeInUp} transition={{ delay: 0.3 }}
            className="pt-10 flex flex-col items-center gap-8"
          >
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/register">
                <GradientButton className="rounded-full px-8 py-4 text-lg font-bold shadow-lg shadow-brand-purple/20">
                  {t("hero.cta.primary")} <ArrowRight className="ml-2 inline" />
                </GradientButton>
              </Link>
              <Link href="#how-it-works">
                <button className="rounded-full px-8 py-4 text-lg font-bold border border-black/10 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  {t("hero.cta.secondary")}
                </button>
              </Link>
            </div>

            <div className="relative w-full max-w-2xl aspect-video rounded-2xl outline outline-2 outline-black/5 dark:outline-brand-purple/30 shadow-xl dark:shadow-[0_20px_80px_rgba(124,58,237,0.4)] bg-slate-100 dark:bg-black/50 flex items-center justify-center cursor-pointer group shrink-0 overflow-hidden mt-4">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/10 to-brand-blue/10 mix-blend-overlay group-hover:scale-110 transition-transform duration-700" />
              <div className="relative z-20 flex items-center gap-3 bg-white/80 dark:bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-black/10 dark:border-white/20 text-slate-900 dark:text-white group-hover:-translate-y-1 transition-transform">
                <Play className="text-brand-purple dark:text-white" fill="currentColor" size={20} />
                <span className="font-medium">{t("hero.video")}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it Works section */}
      <section id="how-it-works" className="py-24 px-4 max-w-6xl mx-auto scroll-m-16">
        <h2 className="text-3xl font-bold text-center mb-16 tracking-tight">{t("how.title")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
          <div className="hidden md:block absolute top-[60px] left-[15%] right-[15%] h-[2px]" style={{ background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.2) 50%, transparent) border-box" }} />
          {[
            { icon: MessageSquare, title: t("how.step1.title"), desc: t("how.step1.desc"), step: "1" },
            { icon: FileText, title: t("how.step2.title"), desc: t("how.step2.desc"), step: "2" },
            { icon: CheckCircle2, title: t("how.step3.title"), desc: t("how.step3.desc"), step: "3" },
            { icon: Download, title: t("how.step4.title"), desc: t("how.step4.desc"), step: "4" }
          ].map((step, i) => (
            <motion.div 
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={fadeInUp}
              key={i}
            >
              <GlassCard className="relative z-10 flex flex-col items-center text-center p-6 border border-black/5 dark:border-white/10 hover:border-brand-purple/40 dark:hover:border-brand-purple/40 hover:-translate-y-2 transition-all duration-300 bg-white/80 dark:bg-white/5 h-full">
                <span className="text-xs font-extrabold text-brand-purple uppercase tracking-wider mb-3">Step {step.step}</span>
                <div className="w-[48px] h-[48px] bg-brand-purple/10 rounded-xl flex items-center justify-center text-brand-purple mb-4">
                  <step.icon size={24} />
                </div>
                <h3 className="font-bold text-lg mb-2">{step.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{step.desc}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-24 bg-slate-50 dark:bg-white/[0.02] border-y border-black/5 dark:border-white/5">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center gap-12">
          <motion.div 
            initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="flex-1 space-y-8"
          >
            <h2 className="text-3xl font-bold tracking-tight">{t("why.title")}</h2>
            <ul className="space-y-6">
              {[t("why.bullet1"), t("why.bullet2"), t("why.bullet3")].map((bullet, i) => (
                <li key={i} className="flex gap-4 items-start">
                  <div className="mt-1 shrink-0 bg-brand-purple/10 p-1 rounded-full text-brand-purple">
                    <CheckCircle2 size={20} />
                  </div>
                  <span className="text-lg text-slate-700 dark:text-slate-300 font-medium">{bullet}</span>
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.2 }}
            className="flex-1 w-full"
          >
            <div className="aspect-square relative max-w-md mx-auto rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-brand-purple/20 to-brand-blue/20 flex items-center justify-center p-8 border border-white/20">
              <GlassCard className="w-full h-full bg-white/60 dark:bg-black/40 border-white/40 dark:border-white/10 p-6 flex flex-col justify-between">
                <div className="h-6 w-32 bg-slate-200 dark:bg-white/10 rounded-full mb-4 animate-pulse"></div>
                <div className="space-y-3">
                  <div className="h-4 w-full bg-slate-200 dark:bg-white/10 rounded-full mix-blend-multiply dark:mix-blend-screen"></div>
                  <div className="h-4 w-[90%] bg-slate-200 dark:bg-white/10 rounded-full mix-blend-multiply dark:mix-blend-screen"></div>
                  <div className="h-4 w-[80%] bg-slate-200 dark:bg-white/10 rounded-full mix-blend-multiply dark:mix-blend-screen"></div>
                </div>
                <div className="flex gap-4 mt-8">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-brand-purple to-brand-blue"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 bg-slate-200 dark:bg-white/10 rounded-full"></div>
                    <div className="h-3 w-16 bg-slate-200 dark:bg-white/10 rounded-full"></div>
                  </div>
                </div>
              </GlassCard>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 px-4 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-16 tracking-tight">{t("pricing.title")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-center">
          
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <GlassCard className="p-8 border border-black/10 dark:border-white/10 hover:-translate-y-2 transition-transform bg-white/50 dark:bg-white/5">
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">{t("pricing.free.title")}</h3>
              <div className="mt-4 mb-6"><span className="text-4xl font-extrabold">{t("pricing.free.price")}</span><span className="text-slate-500 dark:text-slate-400 text-sm">{t("pricing.free.period")}</span></div>
              <ul className="space-y-4 mb-8 text-sm text-slate-600 dark:text-slate-300 font-medium">
                <li className="flex gap-3"><CheckCircle2 className="text-slate-400" size={18} /> {t("pricing.free.f1")}</li>
                <li className="flex gap-3"><CheckCircle2 className="text-slate-400" size={18} /> {t("pricing.free.f2")}</li>
                <li className="flex gap-3"><CheckCircle2 className="text-slate-400" size={18} /> {t("pricing.free.f3")}</li>
              </ul>
              <Link href="/register"><button className="w-full py-3 rounded-xl border border-black/10 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/5 font-semibold transition-colors text-slate-700 dark:text-white">{t("pricing.free.cta")}</button></Link>
            </GlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
            <GlassCard className="relative p-8 border-2 border-brand-purple bg-brand-purple/5 dark:bg-brand-purple/10 scale-100 md:scale-105 shadow-xl shadow-brand-purple/10 dark:shadow-brand z-10 hover:-translate-y-2 transition-transform">
              <div className="absolute top-0 right-8 -translate-y-1/2 bg-brand-purple text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">{t("pricing.pro.badge")}</div>
              <h3 className="text-lg font-bold text-brand-purple flex items-center gap-2">{t("pricing.pro.title")} <span className="text-xl">★</span></h3>
              <div className="mt-4 mb-6"><span className="text-5xl font-extrabold text-slate-900 dark:text-white">{t("pricing.pro.price")}</span><span className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t("pricing.pro.period")}</span></div>
              <ul className="space-y-4 mb-8 text-sm font-semibold text-slate-700 dark:text-white">
                <li className="flex gap-3"><CheckCircle2 className="text-brand-purple" size={18} /> {t("pricing.pro.f1")}</li>
                <li className="flex gap-3"><CheckCircle2 className="text-brand-purple" size={18} /> {t("pricing.pro.f2")}</li>
                <li className="flex gap-3"><CheckCircle2 className="text-brand-purple" size={18} /> {t("pricing.pro.f3")}</li>
                <li className="flex gap-3"><CheckCircle2 className="text-brand-purple" size={18} /> {t("pricing.pro.f4")}</li>
              </ul>
              <Link href="/register"><GradientButton className="w-full py-4 text-md font-bold rounded-xl shadow-lg">{t("pricing.pro.cta")} <ArrowRight className="ml-2 w-4 h-4 inline" /></GradientButton></Link>
            </GlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
            <GlassCard className="p-8 border border-brand-blue/30 dark:border-brand-blue/50 bg-brand-blue/5 hover:-translate-y-2 transition-transform">
              <h3 className="text-lg font-bold text-brand-blue">{t("pricing.vip.title")}</h3>
              <div className="mt-4 mb-6"><span className="text-4xl font-extrabold">{t("pricing.vip.price")}</span><span className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t("pricing.vip.period")}</span></div>
              <ul className="space-y-4 mb-8 text-sm text-slate-600 dark:text-slate-300 font-medium">
                <li className="flex gap-3"><CheckCircle2 className="text-brand-blue" size={18} /> {t("pricing.vip.f1")}</li>
                <li className="flex gap-3"><CheckCircle2 className="text-brand-blue" size={18} /> {t("pricing.vip.f2")}</li>
                <li className="flex gap-3"><CheckCircle2 className="text-brand-blue" size={18} /> {t("pricing.vip.f3")}</li>
                <li className="flex gap-3"><CheckCircle2 className="text-brand-blue" size={18} /> {t("pricing.vip.f4")}</li>
              </ul>
              <Link href="/register"><button className="w-full py-3 rounded-xl bg-brand-blue/10 dark:bg-brand-blue/20 hover:bg-brand-blue/20 dark:hover:bg-brand-blue/30 text-brand-blue dark:text-white font-bold transition-colors">{t("pricing.vip.cta")}</button></Link>
            </GlassCard>
          </motion.div>

        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="py-24 bg-slate-50 dark:bg-white/[0.02] border-t border-black/5 dark:border-white/5 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-12">{t("faq.title")}</h2>
          <Accordion className="w-full">
            <AccordionItem value="item-1" className="border-black/10 dark:border-white/10">
              <AccordionTrigger className="text-left font-semibold hover:text-brand-purple py-4">{t("faq.q1")}</AccordionTrigger>
              <AccordionContent className="text-slate-600 dark:text-slate-400 leading-relaxed text-base pt-2 pb-6">
                {t("faq.a1")}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2" className="border-black/10 dark:border-white/10">
              <AccordionTrigger className="text-left font-semibold hover:text-brand-purple py-4">{t("faq.q2")}</AccordionTrigger>
              <AccordionContent className="text-slate-600 dark:text-slate-400 leading-relaxed text-base pt-2 pb-6">
                {t("faq.a2")}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3" className="border-black/10 dark:border-white/10">
              <AccordionTrigger className="text-left font-semibold hover:text-brand-purple py-4">{t("faq.q3")}</AccordionTrigger>
              <AccordionContent className="text-slate-600 dark:text-slate-400 leading-relaxed text-base pt-2 pb-6">
                {t("faq.a3")}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4" className="border-black/10 dark:border-white/10">
              <AccordionTrigger className="text-left font-semibold hover:text-brand-purple py-4">{t("faq.q4")}</AccordionTrigger>
              <AccordionContent className="text-slate-600 dark:text-slate-400 leading-relaxed text-base pt-2 pb-6">
                {t("faq.a4")}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-black/5 dark:border-white/5 bg-[#080810] py-12 px-4 shadow-inner">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start">
            <div className="text-gradient font-extrabold text-2xl tracking-tighter">TCC-ASSIST™</div>
            <div className="text-slate-500 font-medium text-sm mt-1">Smart Academic Tools</div>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-400 font-medium">
            <Link href="#" className="hover:text-white transition-colors">{t("footer.how")}</Link>
            <Link href="#" className="hover:text-white transition-colors">{t("footer.pricing")}</Link>
            <Link href="#" className="hover:text-white transition-colors">{t("footer.contact")}</Link>
            <Link href="#" className="hover:text-white transition-colors">{t("footer.privacy")}</Link>
          </div>
        </div>
        <div className="max-w-6xl mx-auto text-center md:text-left text-xs text-slate-600 mt-12 pt-8 border-t border-white/5">
          {t("footer.copy")}
        </div>
      </footer>
    </div>
  )
}
