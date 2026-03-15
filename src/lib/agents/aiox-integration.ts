import { prisma } from '@/lib/prisma';
import { callGemini } from '@/lib/gemini';
import fs from 'fs';
import path from 'path';

/**
 * Ponte Nativa entre o Next.js e o orquestrador do AIOX-core.
 * Implementa o workflow de geração de TCC orquestrando especialistas.
 */
export async function runTccWorkflow(userId: string, tccId: string, message: string, plan: string = 'FREE') {
  try {
    // 1. Validação de Limites (Skill prisma-validator nativa)
    if (plan === 'FREE') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const dailyUsage = await prisma.message.count({
        where: {
          tccId,
          role: 'bot',
          createdAt: { gte: today }
        }
      });
      
      if (dailyUsage >= 1) {
        throw new Error('FREE: Limite de 1 página/dia atingido');
      }
    }

    // 2. Seleção de Agente Baseado no Plano
    const agentId = plan === 'VIP' ? 'redator-vip' : (plan === 'PRO' ? 'redator-pro' : 'redator-free');
    
    // 3. Carregar Prompt do Agente Especialista
    const agentPromptPath = path.join(process.cwd(), '.codex', 'agents', `${agentId}.md`);
    let agentSystemPrompt = '';
    try {
      const agentFile = fs.readFileSync(agentPromptPath, 'utf8');
      // Extrair o "System Prompt" do final do arquivo markdown
      agentSystemPrompt = agentFile.split('## System Prompt')[1]?.trim() || '';
    } catch (e) {
      console.warn(`Could not load specialist prompt for ${agentId}, using default.`);
      agentSystemPrompt = 'Você é um redator de TCC acadêmico.';
    }

    // 4. Executar Geração (Fase 2 do workflow)
    const generationPrompt = `${agentSystemPrompt}\n\nREQUISITO DO USUÁRIO: ${message}`;
    const generatedContent = await callGemini(generationPrompt);

    // 5. Verificação de Plágio (Fase 3 do workflow)
    const plagiarismPrompt = `Você é o Agente Anti-Plágio. Analise o seguinte texto e dê uma nota de originalidade (0-100%).\n\nTEXTO: ${generatedContent}\n\nSua resposta deve começar com "✅ Originalidade: X%"`;
    const plagiarismReport = await callGemini(plagiarismPrompt);

    const finalContent = `${generatedContent}\n\n---\n${plagiarismReport}`;

    // 6. Salvar no Prisma (Persistência)
    const savedMessage = await prisma.message.create({
      data: {
        tccId,
        role: 'bot',
        content: finalContent,
        agent: agentId
      }
    });

    return {
      id: savedMessage.id,
      content: finalContent,
      agent: agentId,
      timestamp: savedMessage.createdAt
    };
  } catch (error) {
    console.error('Error in TCC workflow:', error);
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(message || 'Falha na geração assistida por IA');
  }
}
