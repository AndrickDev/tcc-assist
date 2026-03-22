import { callGemini } from '@/lib/gemini'

// Tipagem genérica para ações de IA independentemente do provider
export interface AIProviderOptions {
  model?: string;
  temperature?: number;
}

export type SupportedProviders = 'gemini' | 'gpt';

/**
 * Ponto central de chamada de IA no projeto.
 * Atualmente restrito ao Gemini para o Beta Controlado.
 * Arquitetura pronta para plugar 'gpt' posteriormente sem alterar as actions.
 */
export async function generateAIContent(
  prompt: string, 
  provider: SupportedProviders = 'gemini'
): Promise<string> {
  
  if (provider === 'gemini') {
    // Para simplificar no beta, a implementação bruta chama a API do Gemini.
    return callGemini(prompt)
  }
  
  if (provider === 'gpt') {
    // Preparação para futura integração GPT
    // return callOpenAI(prompt, options)
    throw new Error('GPT provider not yet implemented for Beta.')
  }

  throw new Error(`Provider ${provider} não suportado.`)
}
