export function buildActionPrompt(action: string, userPlan: string, text: string, context: string = ''): string {
  // 1. Guardrails Rígidos e Universais (para ações in-loco de edição)
  const baseGuardrails = `
REGRAS MANDATÓRIAS DE SAÍDA:
1. NUNCA retorne blocos de código markdown (como \`\`\`html ou similares). Apenas o texto puro processado.
2. NUNCA desvirtue ou altere desnecessariamente a estrutura HTML existente (tags, classes).
3. NUNCA invente referências bibliográficas, nomes de autores, anos ou fontes fictícias (ALUCINAÇÃO ZERO).
4. NUNCA mude o escopo ou sentido original do texto sem extrema necessidade. Mantenha as alterações localizadas.
5. Mantenha a linguagem estritamente acadêmica, natural e formal, sem soar robótica ou genérica.
6. Se o texto já estiver suficientemente bom e não houver melhoria substancial a ser feita, devolva o texto praticamente idêntico, com ajustes mínimos estruturais.
7. O retorno deve conter EXCLUSIVAMENTE o conteúdo editado, sem cumprimentos, explicações ou notas.
`

  // 2. Composição da Tarefa
  let task = ''
  
  if (action === 'revisar') {
    if (userPlan === 'VIP') {
      task = `Você é um Revisor Acadêmico VIP. Faça uma revisão crítica profunda do conteúdo a seguir. Melhore coesão, fluidez, elimine pleonasmos e garanta um tom formidável e acadêmico sem alterar o formato HTML base (negritos, itálicos, parágrafos).`
    } else { // PRO
      task = `Você é um Revisor Acadêmico. Revise apenas a ortografia e gramática do texto a seguir mantendo 100% da estrutura.`
    }
  } 
  else if (action === 'abnt') {
    task = `Você é um Especialista em Normas ABNT. Ajuste a estrutura textual a seguir. Corrija itálicos em palavras estrangeiras, espace citações longas (se aplicável na estrutura HTML fornecida), e elimine coloquialismos verbais que firam a formalidade da norma. NÃO adicione novas citações.`
  }
  else if (action === 'citacoes') {
    task = `Você é um Especialista em Revisão Bibliográfica. Dado o HTML a seguir, melhore pontualmente as chamadas de citações existentes (ex: "Segundo Silva (2020)...") para fluírem melhor no texto acadêmico e verifique se o formato autor-data está correto. NÃO invente bibliografia, apenas ajuste a sintaxe das existentes se houver.`
  }
  else if (action === 'proximopasso') {
    // Para próximo passo, os guardrails de HTML não se aplicam da mesma forma, pois é só texto.
    return `Com base no contexto do TCC (${context}) e neste último trecho escrito: escreva APENAS uma frase curta (max 20 palavras) de orientação sobre o próximo passo ideal (ex: "Agora, você deve introduzir a metodologia sugerida..."). NÃO justifique, NÃO pule linha, NÃO use HTML.` + `\n\nTEXTO BASE:\n${text}`
  }
  else {
    throw new Error('Ação Desconhecida')
  }

  // 3. Montagem Final
  return `${task}\n${baseGuardrails}\nTEXTO_FONTE:\n${text}`
}
