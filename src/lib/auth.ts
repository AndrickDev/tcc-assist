import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { authConfig } from "@/lib/auth.config"

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    // Safe diagnostic for server logs (does not print secrets).
    console.error(`[auth] Missing environment variable: ${name}`)
  }
  return value
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,

  // Override providers with the full Node.js version (with authorize)
  providers: [
    GoogleProvider({
      clientId:
        requireEnv("GOOGLE_CLIENT_ID") ??
        requireEnv("AUTH_GOOGLE_ID") ??
        requireEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID"),
      clientSecret: requireEnv("GOOGLE_CLIENT_SECRET") ?? requireEnv("AUTH_GOOGLE_SECRET"),
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string
        const password = credentials?.password as string

        if (!email || !password) return null

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user || !user.password) return null

        const passwordMatch = await bcrypt.compare(password, user.password)
        if (!passwordMatch) return null

        return { id: user.id, name: user.name, email: user.email, image: user.image }
      },
    }),
  ],

  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  // Sobrescreve só o callback `jwt` — mantém `session` e `authorized` de authConfig.
  // Motivo: o plano (FREE/PRO/VIP) pode mudar no banco depois do login (upgrade via
  // script admin, Stripe webhook no futuro). Sem refresh, o usuário precisaria
  // deslogar pra ver o novo plano. Aqui refazemos a leitura do plan/role do banco
  // automaticamente a cada 5 minutos, ou imediatamente quando o client chamar
  // `useSession().update()` (por ex. botão "Atualizar" em /configuracoes).
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      const PLAN_REFRESH_TTL_MS = 5 * 60 * 1000

      // Login inicial — popula do objeto user fornecido pelo authorize/adapter.
      if (user) {
        token.id = user.id
        ;(token as { role?: string }).role = (user as { role?: string }).role
        ;(token as { plan?: string }).plan = (user as { plan?: string }).plan
        ;(token as { lastPlanRefresh?: number }).lastPlanRefresh = Date.now()
        return token
      }

      // Refresh forçado pelo client ou por TTL (5 minutos)
      const lastRefresh = (token as { lastPlanRefresh?: number }).lastPlanRefresh ?? 0
      const aged = Date.now() - lastRefresh > PLAN_REFRESH_TTL_MS
      const forced = trigger === "update"

      if ((aged || forced) && token.id) {
        try {
          const fresh = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { plan: true, role: true },
          })
          if (fresh) {
            ;(token as { plan?: string }).plan = fresh.plan
            ;(token as { role?: string }).role = fresh.role
            ;(token as { lastPlanRefresh?: number }).lastPlanRefresh = Date.now()
          }
        } catch (err) {
          console.warn("[auth.jwt] falha ao atualizar plano do banco:", err)
        }
      }
      return token
    },
  },
})
