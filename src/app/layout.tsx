import type { Metadata } from "next"
import { Inter, Lora } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SessionProvider } from "next-auth/react"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "Teseo | Seu orientador IA para TCC",
  description: "Faça seu TCC com IA, revisão e normas ABNT aplicadas automaticamente.",
  manifest: "/manifest.json",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className="selection:bg-brand-purple selection:text-white">
      <body
        className={`${inter.variable} ${lora.variable} font-sans antialiased min-h-[100dvh] custom-scroll relative overflow-x-hidden`}
      >
        <SessionProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
