import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { I18nProvider } from "@/lib/i18n"
import { SessionProvider } from "next-auth/react"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "TCC-ASSIST™ | Seu orientador IA para TCC",
  description: "Faça seu TCC aprovado em 45min com IA, anti-plágio e normas ABNT aplicadas automaticamente.",
  manifest: "/manifest.json",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className="selection:bg-brand-purple selection:text-white">
      <body className={`${inter.variable} font-sans antialiased min-h-[100dvh] custom-scroll relative overflow-x-hidden`}>
        <SessionProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <I18nProvider>
              {children}
            </I18nProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
