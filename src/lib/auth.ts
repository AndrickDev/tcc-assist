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
})
