import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    // @ts-ignore
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Reseta o contador diário deletando as mensagens do bot produzidas hoje para este usuário
    await prisma.message.deleteMany({
      where: {
        tcc: { userId: id },
        role: "bot",
        createdAt: { gte: today },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin Reset Limits Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
