import { prisma } from '@/lib/prisma';
import { generateAIContent } from '@/lib/ai/provider';
import { getGeminiConfigForPlan } from '@/lib/gemini';
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
      // Plan-aware fallback prompts
      if (plan === 'VIP') {
        agentSystemPrompt = 'Você é um redator acadêmico SÊNIOR com foco em excelência, análise crítica e estrutura impecável. Produza texto denso de nível de publicação.';
      } else if (plan === 'PRO') {
        agentSystemPrompt = 'Você é um redator acadêmico profissional focado em rigor científico e coesão textual.';
      } else {
        agentSystemPrompt = 'Você é um redator de TCC acadêmico.';
      }
    }

    // 3.5. Buscar contexto do TCC (metadados + conversas recentes)
    const tcc = await prisma.tcc.findUnique({
      where: { id: tccId },
      select: { title: true, course: true, institution: true, workType: true, norma: true, objective: true }
    });

    // Build a rich context block from TCC metadata
    const tccContextParts: string[] = [];
    if (tcc) {
      if (tcc.title) tccContextParts.push(`TEMA DO TCC: "${tcc.title}"`);
      if (tcc.course) tccContextParts.push(`CURSO: ${tcc.course}`);
      if (tcc.institution) tccContextParts.push(`INSTITUIÇÃO: ${tcc.institution}`);
      if (tcc.workType) tccContextParts.push(`TIPO DE TRABALHO: ${tcc.workType}`);
      if (tcc.norma) tccContextParts.push(`NORMA DE FORMATAÇÃO: ${tcc.norma}`);
      if (tcc.objective) tccContextParts.push(`OBJETIVO/PROBLEMA DE PESQUISA: ${tcc.objective}`);
    }
    const tccMetadataBlock = tccContextParts.length > 0
      ? `\n[CONTEXTO DO TCC]:\n${tccContextParts.join('\n')}\n[FIM CONTEXTO DO TCC]\n`
      : '';

    // Conversation context (varies by plan)
    let conversationContext = ''
    if (plan === 'PRO') {
      const lastMessages = await prisma.message.findMany({
        where: { tccId },
        orderBy: { createdAt: 'desc' },
        take: 3
      })
      if (lastMessages.length > 0) {
        conversationContext = `\n[CONTEXTO RECENTE DO CAPÍTULO]:\n${lastMessages.reverse().map(m => m.content).join('\n')}`
      }
    } else if (plan === 'VIP') {
      // VIP: Load recent context intelligently (last 8 messages, not ALL to avoid prompt overflow)
      const recentMessages = await prisma.message.findMany({
        where: { tccId },
        orderBy: { createdAt: 'desc' },
        take: 8
      })
      if (recentMessages.length > 0) {
        conversationContext = `\n[CONSISTÊNCIA GLOBAL - HISTÓRICO RECENTE DO TCC]:\n${recentMessages.reverse().map(m => m.content).join('\n')}\n[FIM CONSISTÊNCIA GLOBAL]`
      }
    }

    // 4. Get plan-specific Gemini config (tokens, temperature)
    const geminiConfig = getGeminiConfigForPlan(plan);

    // 5. Executar Geração
    let generationPrompt = `${agentSystemPrompt}${tccMetadataBlock}${conversationContext}\n\nREQUISITO DO USUÁRIO: ${message}`
    
    // Plan-specific quality guardrails
    const planQualityDirective = plan === 'VIP'
      ? `\n[DIRETIVA VIP - QUALIDADE PREMIUM]:
Você está gerando para um usuário VIP. O conteúdo precisa ser COMPLETO e PUBLISHABLE:
- Produza texto extenso; no mínimo 1500 palavras por geração.
- Use análise crítica avançada com diferentes perspectivas teóricas.
- Inclua citações teóricas coerentes com o campo de estudo (ex: "Segundo Freire (2005)", "Conforme Morin (2000)").
- Estruture com subtítulos (<h2>, <h3>) e transições suaves entre parágrafos.
- O texto deve ser denso, fluido e imediatamente utilizável numa monografia ou TCC real.
- JAMAIS produza texto curto ou superficial.\n`
      : plan === 'PRO'
      ? `\n[DIRETIVA PRO - QUALIDADE PROFISSIONAL]:
Produza texto de qualidade profissional com no mínimo 800 palavras.
Use linguagem acadêmica rigorosa e estruture em parágrafos coesos.
Inclua citações quando relevante.\n`
      : '';

    // Inject general generation guardrails strongly suppressing chat behavior
    generationPrompt += `${planQualityDirective}
[GUARDRAILS ABSOLUTOS DE GERAÇÃO TCC]:
ALERTA CRÍTICO: VOCÊ NÃO É UM CHATBOT. VOCÊ É UMA ENGINE DE REDAÇÃO DIRETIVA.

1. PROIBIDO PLACEHOLDERS (Ex: "[Insira seu nome]", "[Tema aqui]"). Você DEVE inventar ou deduzir o conteúdo com base no contexto, assumindo um texto real e final. JAMAIS use colchetes [ ] ou chaves { } para deixar lacunas. Se faltar contexto, crie.
2. PROIBIDO METALINGUAGEM (Ex: "Aqui está a sugestão", "Este é um esboço", "O texto acima é..."). NUNCA converse comigo. NUNCA.
3. PROIBIDO ANÁLISE INLINE. Entregue única e exclusivamente o corpo do texto acadêmico utilizável e copiável.
4. PRODUZA TEXTO DENSO, fluido, com citações teóricas coerentes caso necessário.
5. Formate a saída APENAS usando tags HTML simples (<p>, <strong>, <h2>, <h3>, <ul>). Nunca use markdown (\`\`\`).
6. TODO O CONTEÚDO DEVE SER SOBRE O TEMA DO TCC INFORMADO. NÃO desvie do assunto solicitado.`;

    let generatedContent = await generateAIContent(generationPrompt, 'gemini', { geminiConfig });

    // Remove raw markdown code blocks like ```html ... ``` completely
    generatedContent = generatedContent.replace(/^```[a-z]*\s*|\s*```$/gi, '').trim();

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
