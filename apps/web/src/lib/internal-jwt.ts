import "server-only"

import { SignJWT } from "jose"

export type Scope = "chat" | "generate" | "action" | "quota"
export type Plan = "FREE" | "PRO" | "VIP"

type SignInternalJwtInput = {
  sub: string
  plan: Plan
  scope: Scope
  tccId?: string
}

const SCOPES_WITH_TCC_ID: ReadonlySet<Scope> = new Set(["chat", "generate", "action"])

export async function signInternalJwt({
  sub,
  plan,
  scope,
  tccId,
}: SignInternalJwtInput): Promise<string> {
  const secret = process.env.INTERNAL_JWT_SECRET
  if (!secret) {
    throw new Error("INTERNAL_JWT_SECRET ausente")
  }
  if (SCOPES_WITH_TCC_ID.has(scope) && !tccId) {
    throw new Error("tccId ausente")
  }
  if (scope === "quota" && tccId) {
    throw new Error("tccId inesperado")
  }

  const payload: { plan: Plan; scope: Scope; tccId?: string } = { plan, scope }
  if (tccId) payload.tccId = tccId

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("tcc-assist-web")
    .setAudience("tcc-assist-ai")
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(new TextEncoder().encode(secret))
}
