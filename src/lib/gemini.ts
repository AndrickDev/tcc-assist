// Gemini API integration - substitui todos mocks

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function chatAgent(agent: 'bibliotecario' | 'arquiteto' | 'redator', context: any = {}, userInput: string = '') {
  const ctx = context || {};
  const prompts = {
    bibliotecario: `Bibliotecário jurídico TCC. 
    TEMA: "${userInput}"
    FACULDADE: ${ctx.faculdade || 'USP'}
    CURSO: ${ctx.curso || 'Direito'}
    
    Liste EXATAMENTE 20 referências REAIS brasileiras:
    - Leis (Planalto.gov.br)
    - Julgados STJ/STF 
    - Artigos SciELO/Google Acadêmico
    - Livros doutrina
    
    FORMATO JSON:
    [
      {"titulo": "...", "autor": "...", "ano": 2026, "resumo": "50 palavras", "pagina": "23"}
    ]`,

    arquiteto: `Arquiteto normas ABNT ${ctx.faculdade || 'USP'} ${ctx.curso || 'Direito'}.
    REFERÊNCIAS: ${JSON.stringify(ctx.refs || [])}
    
    Gere sumário 5 capítulos estruturado:
    Cap1: Introdução (problema/objetivos)
    Cap2: Fundamentação teórica  
    Cap3: Análise prática
    Cap4: Metodologia
    Cap5: Conclusão
    
    FORMATO MARKDOWN com páginas estimadas.`,

    redator: `Redator jurídico PROFISSIONAL. 
    USE APENAS ESTAS ${ctx.refs?.length || 0} referências:
    ${JSON.stringify(ctx.refs || [])}
    
    Escreva ${ctx.capitulo || 'Cap1 Introdução'} 
    - 800 palavras exatas
    - Citações ABNT no texto (Autor, ano, p.X)
    - Linguagem acadêmica
    - 3 subtítulos`
  }

  return callGemini(prompts[agent]);
}

export async function callGemini(prompt: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2000
      }
    })
  })

  if (!response.ok) throw new Error(`Gemini ${response.status}: ${await response.text()}`)

  const data = await response.json()
  return data.candidates[0].content.parts[0].text
}
