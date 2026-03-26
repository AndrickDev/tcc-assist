import { callGemini, type GeminiConfig } from '@/lib/gemini'

// Tipagem genérica para ações de IA independentemente do provider
export interface AIProviderOptions {
  model?: string;
  temperature?: number;
  geminiConfig?: GeminiConfig;
}

export type SupportedProviders = 'gemini' | 'gpt';

/**
 * Ponto central de chamada de IA no projeto.
 * Atualmente restrito ao Gemini para o Beta Controlado.
 * Arquitetura pronta para plugar 'gpt' posteriormente sem alterar as actions.
 */
export async function generateAIContent(
  prompt: string, 
  provider: SupportedProviders = 'gemini',
  options?: AIProviderOptions
): Promise<string> {
  
  if (provider === 'gemini') {
    return callGemini(prompt, options?.geminiConfig)
  }
  
  if (provider === 'gpt') {
    throw new Error('GPT provider not yet implemented for Beta.')
  }

  throw new Error(`Provider ${provider} não suportado.`)
}
