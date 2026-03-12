import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"

// Middleware uses the edge-compatible config (no Prisma, no Node.js modules)
export default NextAuth(authConfig).auth

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
