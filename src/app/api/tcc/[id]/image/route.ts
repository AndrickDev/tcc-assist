import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { put } from "@vercel/blob"
import { prisma as db } from "@/lib/prisma"

const IMAGE_LIMIT = 10

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: tccId } = await params
  const userId = (session.user as { id?: string }).id

  // Verify ownership
  const tcc = await db.tcc.findUnique({ where: { id: tccId } })
  if (!tcc || tcc.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Count existing images for this TCC stored in blob (stored as imageCount metadata on TCC or count from attachments)
  // We track image count via a simple metadata field or by counting blob attachments with type image
  // For simplicity, count attachments of type image
  const imageCount = await db.attachment.count({
    where: { tccId, mimeType: { startsWith: "image/" } }
  })

  if (imageCount >= IMAGE_LIMIT) {
    return NextResponse.json(
      { error: `Limite de ${IMAGE_LIMIT} imagens por TCC atingido.` },
      { status: 429 }
    )
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  // Validate image type
  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]
  if (!validTypes.includes(file.type)) {
    return NextResponse.json({ error: "Tipo de arquivo inválido. Use JPEG, PNG, WebP ou GIF." }, { status: 400 })
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Imagem muito grande. Máximo 5MB." }, { status: 400 })
  }

  const ext = file.name.split(".").pop() ?? "jpg"
  const filename = `tcc-images/${tccId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const blob = await put(filename, file, {
    access: "public",
    contentType: file.type,
  })

  // Record attachment
  await db.attachment.create({
    data: {
      tccId,
      fileName: file.name,
      fileUrl: blob.url,
      fileSize: file.size,
      mimeType: file.type,
    }
  })

  return NextResponse.json({ url: blob.url, remaining: IMAGE_LIMIT - imageCount - 1 })
}
