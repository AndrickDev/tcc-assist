import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request) {
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { name } = await req.json()
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "Nome inválido" }, { status: 400 })
  }

  await prisma.user.update({ where: { id: userId }, data: { name: name.trim() } })
  return NextResponse.json({ success: true })
}
