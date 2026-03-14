import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    // @ts-expect-error role is not in the default session type
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            tccs: {
              where: { status: "IN_PROGRESS" },
            },
          },
        },
        tccs: {
          select: {
            id: true,
            messages: {
              where: {
                role: "bot",
                createdAt: { gte: today },
              },
              select: {
                content: true,
              },
            },
          },
        },
        sessions: {
          take: 1,
          orderBy: { expires: "desc" },
          select: { expires: true }
        }
      },
    });

    const formattedUsers = users.map((u) => {
      let totalCharsToday = 0;
      u.tccs.forEach((tcc) => {
        tcc.messages.forEach((msg) => {
          totalCharsToday += msg.content.length;
        });
      });

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        plan: u.plan,
        activeTccs: u._count.tccs,
        pagesToday: Math.ceil(totalCharsToday / 1800),
        lastLogin: u.sessions[0]?.expires || u.createdAt,
        createdAt: u.createdAt,
      };
    });

    return NextResponse.json(formattedUsers);
  } catch (error) {
    console.error("Admin Users GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
