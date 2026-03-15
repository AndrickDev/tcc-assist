"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { ArrowRight, ArrowLeft, Mail, Key, User, AlertCircle } from "lucide-react"

export default function RegisterPage() {
  const [name, setName] = useState("")
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
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Erro ao criar conta.")
        return
      }

      // Auto sign in after registration
      await signIn("credentials", { email, password, callbackUrl: "/dashboard" })
      router.push("/dashboard")
    } catch {
      setError("Ocorreu um erro. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#141413] text-white p-4">
      <div className="w-full max-w-md">
        <div className="relative mb-8 flex flex-col items-center">
          <Link href="/" className="absolute left-0 top-1 text-white/60 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium">
            <ArrowLeft size={18} /> <span className="hidden sm:inline">Voltar</span>
          </Link>
          <Link href="/" className="inline-block font-extrabold text-2xl tracking-tight mb-2">
            Teseo
          </Link>
          <h1 className="text-xl font-medium text-white/70">Crie sua conta</h1>
        </div>

        <div className="bg-[#0F0F0E] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg mb-5 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1">Nome completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all text-white placeholder:text-white/30"
                  placeholder="Seu nome"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all text-white placeholder:text-white/30"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-1">Senha</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all text-white placeholder:text-white/30"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-white text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-white/90 transition-colors disabled:opacity-50 mt-6"
            >
              {isLoading ? "Criando conta..." : "Criar conta"} <ArrowRight size={18} />
            </button>
          </form>
        </div>

        <div className="text-center mt-6 text-sm text-white/60">
          Já tem uma conta?{" "}
          <Link href="/login" className="text-white hover:text-white/80 font-medium">
            Faça login
          </Link>
        </div>
      </div>
    </div>
  )
}
