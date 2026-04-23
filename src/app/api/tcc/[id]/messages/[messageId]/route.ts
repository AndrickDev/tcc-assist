import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// DELETE /api/tcc/[id]/messages/[messageId]
// Remove uma mensagem específica do histórico do chat do TCC.
// Útil para o aluno limpar mensagens antigas (rascunhos gerados, tentativas descartadas)
// e manter o histórico organizado.
//
// IDs locais (criados antes da mensagem sincronizar com o banco) simplesmente
// retornam 200 com removed=0 — o cliente já apagou da UI de qualquer forma.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { id: tccId, messageId } = await params

  const tcc = await prisma.tcc.findFirst({ where: { id: tccId, userId }, select: { id: true } })
  if (!tcc) return NextResponse.json({ error: "TCC não encontrado." }, { status: 404 })

  // deleteMany não erra se o id não existir (útil para ids locais ainda não sincronizados).
  const result = await prisma.message.deleteMany({
    where: { id: messageId, tccId },
  })

  return NextResponse.json({ removed: result.count })
}
