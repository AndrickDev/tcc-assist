import { prisma } from "../../../src/lib/prisma";

export async function validatePlanLimits({ userId, tccId }: { userId: string, tccId: string }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const tcc = await prisma.tcc.findUnique({ where: { id: tccId } });
  
  if (!user || !tcc) {
    throw new Error('User or TCC not found');
  }

  if (user.plan === 'FREE') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dailyUsage = await prisma.message.count({
      where: {
        tccId,
        role: 'bot', // No prisma.prisma está como 'user' ou 'bot'
        createdAt: { gte: today }
      }
    });
    
    if (dailyUsage >= 1) {
      throw new Error('FREE: Limite de 1 página/dia atingido');
    }
  }
  
  return { valid: true, plan: user.plan };
}
