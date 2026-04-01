import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { put } from "@vercel/blob"
import { resolvePlan, getAttachmentLimit } from "@/lib/plan"

export const dynamic = "force-dynamic"

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB

function safeFileName(originalName: string) {
  const base = originalName.replace(/[^\w.\-()+\s]/g, "_")
  return base.slice(0, 180) || "upload"
}

function isAllowedMime(mimeType: string) {
  return (
    mimeType === "application/pdf" ||
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
}

async function requireOwnedTcc(tccId: string, userId: string) {
  return prisma.tcc.findFirst({
    where: { id: tccId, userId },
    select: { id: true },
  })
}

// GET /api/tcc/[id]/attachments
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { id: tccId } = await params
  const tcc = await requireOwnedTcc(tccId, userId)
  if (!tcc) return NextResponse.json({ error: "TCC não encontrado" }, { status: 404 })

  const [user, attachments] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }),
    prisma.attachment.findMany({
      where: { tccId },
      orderBy: { createdAt: "desc" },
      select: { id: true, fileName: true, fileUrl: true, fileSize: true, mimeType: true, createdAt: true },
    }),
  ])

  const plan = resolvePlan(user?.plan)
  const limit = getAttachmentLimit(plan)
  return NextResponse.json({ plan, limit, count: attachments.length, attachments })
}

// POST /api/tcc/[id]/attachments
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let step = "auth"
  try {
    const session = await auth()
    const userId = (session?.user as { id?: string } | undefined)?.id
    if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    step = "params"
    const { id: tccId } = await params

    step = "ownership"
    const tcc = await requireOwnedTcc(tccId, userId)
    if (!tcc) return NextResponse.json({ error: "TCC não encontrado" }, { status: 404 })

    step = "formdata"
    const formData = await req.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
    }

    if (!isAllowedMime(file.type)) {
      return NextResponse.json({ error: "Formato não suportado. Envie PDF ou DOC/DOCX." }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "Arquivo muito grande. O limite é 20 MB por arquivo." }, { status: 400 })
    }

    step = "plan_check"
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } })
    const plan = resolvePlan(user?.plan)
    const limit = getAttachmentLimit(plan)
    const count = await prisma.attachment.count({ where: { tccId } })
    if (count >= limit) {
      return NextResponse.json(
        { error: `Limite de ${limit} anexos atingido no plano ${plan}.`, plan, limit, count },
        { status: 403 }
      )
    }

    step = "blob_upload"
    const safeName = safeFileName(file.name)
    const blobPath = `attachments/${userId}/${tccId}/${Date.now()}-${safeName}`
    const blob = await put(blobPath, file, { access: "public" })

    step = "db_save"
    const attachment = await prisma.attachment.create({
      data: { tccId, fileName: safeName, fileUrl: blob.url, fileSize: file.size, mimeType: file.type },
    })

    return NextResponse.json({ success: true, plan, limit, count: count + 1, attachment })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Attachment Upload Error [step=${step}]:`, message)
    return NextResponse.json({ error: message, step }, { status: 500 })
  }
}
