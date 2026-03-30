import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import path from "path"
import { mkdir, writeFile } from "fs/promises"
import { resolvePlan, getAttachmentLimit } from "@/lib/plan"

export const dynamic = "force-dynamic"

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB

function safeFileName(originalName: string) {
  const base = path.basename(originalName).replace(/[^\w.\-()+\s]/g, "_")
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

// GET /api/tcc/[id]/attachments - list attachments for a TCC (owner-only)
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
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        fileSize: true,
        mimeType: true,
        createdAt: true,
      },
    }),
  ])

  const plan = resolvePlan(user?.plan)
  const limit = getAttachmentLimit(plan)

  return NextResponse.json({ plan, limit, count: attachments.length, attachments })
}

// POST /api/tcc/[id]/attachments - upload attachment (owner-only)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const userId = (session?.user as { id?: string } | undefined)?.id
    if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const { id: tccId } = await params
    const tcc = await requireOwnedTcc(tccId, userId)
    if (!tcc) return NextResponse.json({ error: "TCC não encontrado" }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
    }

    if (!isAllowedMime(file.type)) {
      return NextResponse.json(
        { error: "Formato não suportado. Envie PDF ou DOC/DOCX." },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Arquivo muito grande. O limite é 20 MB por arquivo." },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    })
    const plan = resolvePlan(user?.plan)
    const limit = getAttachmentLimit(plan)
    const count = await prisma.attachment.count({ where: { tccId } })
    if (count >= limit) {
      return NextResponse.json(
        { error: `Limite de anexos atingido para o plano ${plan} (${limit})`, plan, limit, count },
        { status: 403 }
      )
    }

    // Local upload (dev-friendly): public/uploads/<userId>/<tccId>/<timestamp>-<name>
    const safeName = safeFileName(file.name)
    const stamp = Date.now()
    const relativeDir = path.posix.join("uploads", userId, tccId)
    const relativePath = path.posix.join(relativeDir, `${stamp}-${safeName}`)
    const absDir = path.join(process.cwd(), "public", "uploads", userId, tccId)
    const absPath = path.join(process.cwd(), "public", relativePath.split("/").join(path.sep))
    await mkdir(absDir, { recursive: true })
    const bytes = Buffer.from(await file.arrayBuffer())
    await writeFile(absPath, bytes)

    const attachment = await prisma.attachment.create({
      data: {
        tccId,
        fileName: safeName,
        fileUrl: `/${relativePath}`,
        fileSize: file.size,
        mimeType: file.type,
      },
    })

    return NextResponse.json({ success: true, plan, limit, count: count + 1, attachment })
  } catch (error) {
    console.error("Attachment Upload Error:", error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message || "Internal Server Error" }, { status: 500 })
  }
}
