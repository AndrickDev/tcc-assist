import { prisma } from '@/lib/prisma';
import { generateAIContent } from '@/lib/ai/provider';
import fs from 'fs';
import path from 'path';

import { getDailyMessageLimit, type Plan } from '@/lib/plan';

/**
 * Ponte Nativa entre o Next.js e o orquestrador do AIOX-core.
 * Implementa o workflow de geração de TCC orquestrando especialistas.
 */
export async function runTccWorkflow(userId: string, tccId: string, message: string, plan: string = 'FREE') {
  try {
    // 1. Validação de Limites
    const dailyLimit = getDailyMessageLimit(plan as Plan);
    if (dailyLimit < Infinity) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const dailyUsage = await prisma.message.count({
        where: {
          tccId,
          role: 'bot',
          createdAt: { gte: today }
        }
      });
      
      if (dailyUsage >= dailyLimit) {
        throw new Error(`FREE: Limite de ${dailyLimit} páginas/dia atingido`);
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
    } catch {
      console.warn(`Could not load specialist prompt for ${agentId}, using default.`);
      agentSystemPrompt = 'Você é um redator de TCC acadêmico.';
    }

    // 3.5. Buscar contexto (Diferencial PRO/VIP)
    let contextStr = ''
    if (plan === 'PRO') {
      const lastMessages = await prisma.message.findMany({
        where: { tccId },
        orderBy: { createdAt: 'desc' },
        take: 3
      })
      contextStr = `\n[CONTEXTO RECENTE DO CAPÍTULO]:\n${lastMessages.reverse().map(m => m.content).join('\n')}`
    } else if (plan === 'VIP') {
      const allMessages = await prisma.message.findMany({
        where: { tccId },
        orderBy: { createdAt: 'asc' }
      })
      contextStr = `\n[CONSISTÊNCIA GLOBAL - TODO O TCC ATÉ AGORA]:\n${allMessages.map(m => m.content).join('\n')}\n[FIM CONSISTÊNCIA GLOBAL]`
    }

    // 4. Executar Geração (Fase 2 do workflow)
    // Usando Gemini puro como default. Futuramente pode-se extrair provider da prefs do usuario
    let generationPrompt = `${agentSystemPrompt}${contextStr}\n\nREQUISITO DO USUÁRIO: ${message}`
    
    // Inject general generation guardrails strongly suppressing chat behavior
    generationPrompt += `\n\n[GUARDRAILS ABSOLUTOS DE GERAÇÃO TCC]:
ALERTA CRÍTICO: VOCÊ NÃO É UM CHATBOT. VOCÊ É UMA ENGINE DE REDAÇÃO DIRETIVA.

1. PROIBIDO PLACEHOLDERS (Ex: "[Insira seu nome]", "[Tema aqui]"). Você DEVE inventar ou deduzir o conteúdo com base no contexto, assumindo um texto real e final. JAMAIS use colchetes [ ] ou chaves { } para deixar lacunas. Se faltar contexto, crie.
2. PROIBIDO METALINGUAGEM (Ex: "Aqui está a sugestão", "Este é um esboço", "O texto acima é..."). NUNCA converse comigo. NUNCA.
3. PROIBIDO ANÁLISE INLINE. Entregue única e exclusivamente o corpo do texto acadêmico utilizável e copiável.
4. PRODUZA TEXTO DENSO, fluido, com citações teóricas coerentes caso necessário.
5. Formate a saída APENAS usando tags HTML simples (<p>, <strong>, <h2>, <ul>). Nunca use markdown (\`\`\`).`;

    let generatedContent = await generateAIContent(generationPrompt, 'gemini');

    // Remove raw markdown code blocks like ```html ... ``` completely
    generatedContent = generatedContent.replace(/^```[a-z]*\s*|\s*```$/gi, '').trim();

    // 5. Verificação de Plágio Removida do Fluxo Inline
    // O texto do TCC deve ser puramente documental. Nenhuma análise ou separador como "---" 
    // será concatenado dentro do bloco de texto.

    const finalContent = generatedContent;

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
