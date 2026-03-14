import { prisma } from "@/lib/prisma";

/**
 * Lógica de contagem de páginas ABNT
 * Baseado em 1800 caracteres por página (Fonte 12, espaçamento 1.5)
 */
export const ABNT_PAGE_CHARS = 1800;

export async function getDailyUsage(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Busca todas as mensagens do bot geradas hoje para este usuário
  const messages = await prisma.message.findMany({
    where: {
      tcc: { userId },
      role: 'bot',
      createdAt: { gte: today }
    },
    select: {
      content: true
    }
  });

  const totalChars = messages.reduce((acc, msg) => acc + msg.content.length, 0);
  
  // Retorna o número de páginas aproximado
  return Math.ceil(totalChars / ABNT_PAGE_CHARS);
}

export function calculatePages(content: string): number {
    return Math.ceil(content.length / ABNT_PAGE_CHARS);
}
