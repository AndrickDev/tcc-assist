"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, ArrowLeft, Mail, Key, Sparkles } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      })

      if (res?.error) {
        setError("Credenciais inválidas. Tente novamente.")
      } else {
        router.push("/dashboard")
      }
    } catch {
      setError("Ocorreu um erro ao fazer login.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    signIn("google", { callbackUrl: "/dashboard" })
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#0F0F1A] text-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="relative mb-8 flex flex-col items-center">
          <Link href="/" className="absolute left-0 top-1 text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium">
            <ArrowLeft size={18} /> <span className="hidden sm:inline">Voltar</span>
          </Link>
          <Link href="/" className="inline-block font-extrabold text-2xl tracking-tight text-gradient mb-2">
            TCC-ASSIST™
          </Link>
          <h1 className="text-xl font-medium text-slate-300">Bem-vindo(a) de volta</h1>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg mb-6 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all text-white placeholder:text-slate-600"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Senha</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all text-white placeholder:text-slate-600"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-brand-purple to-brand-blue rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isLoading ? "Entrando..." : "Entrar"} <ArrowRight size={18} />
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#151522] px-2 text-slate-500">ou continue com</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            type="button"
            className="w-full py-3 bg-white text-black font-semibold rounded-xl flex items-center justify-center gap-3 hover:bg-slate-100 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
              <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.25024 6.64998L5.32026 9.79998C6.27525 6.74998 9.17528 4.75 12.0003 4.75Z" fill="#EA4335" />
              <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L20.18 21.29C22.575 19.09 24.0303 15.86 24.0303 12.275H23.49Z" fill="#4285F4" />
              <path d="M5.31976 14.1999C5.07976 13.4499 4.93976 12.6499 4.93976 11.8499C4.93976 11.0499 5.07976 10.2499 5.31976 9.49994L1.24976 6.34998C0.454756 7.94998 0 9.84994 0 11.8499C0 13.8499 0.454756 15.7499 1.24976 17.3499L5.31976 14.1999Z" fill="#FBBC05" />
              <path d="M12.0004 24C15.2404 24 17.9654 22.925 19.9554 21.095L15.9354 17.965C14.8654 18.685 13.5654 19.12 12.0054 19.12C9.08041 19.12 6.13042 17.02 5.23042 13.91L1.1604 17.06C3.1604 21.12 7.26041 24 12.0004 24Z" fill="#34A853" />
            </svg>
            Google
          </button>
        </div>

        <div className="text-center mt-6 text-sm text-slate-400">
          Não tem uma conta? <Link href="/register" className="text-brand-purple hover:text-brand-purple/80 font-medium">Cadastre-se</Link>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-purple/10 via-transparent to-transparent"></div>
    </div>
  )
}
