import { LandingHeader } from "@/components/landing/LandingHeader"
import { HeroSection } from "@/components/landing/HeroSection"
import { AboutSection } from "@/components/landing/AboutSection"
import { WorkflowSection } from "@/components/landing/WorkflowSection"
import { PricingSection } from "@/components/landing/PricingSection"
import { FAQSection } from "@/components/landing/FAQSection"
import { LandingFooter } from "@/components/landing/LandingFooter"

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-brand-bg text-brand-text">
      <LandingHeader />
      <main>
        <HeroSection />
        <AboutSection />
        <WorkflowSection />
        <PricingSection />
        <FAQSection />
      </main>
      <LandingFooter />
    </div>
  )
}

