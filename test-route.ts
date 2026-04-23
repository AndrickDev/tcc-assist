import { searchPapers, extractKeywords } from "./src/lib/papers-search";

async function run() {
  const query = "ARQUITETURA HEXAGONAL E DOMAIN-DRIVEN DESIGN COMO FUNDAMENTO DE UM SISTEMA WEB PARA REENCONTRO ENTRE PETS E TUTORES";
  const tryQueries = [
    { q: query },
    { q: extractKeywords(query, 8) },
    { q: extractKeywords(query, 5) },
    { q: extractKeywords(query, 3) },
    { q: extractKeywords(query, 2) },
    { q: extractKeywords(query, 1) }
  ]
  
  let papers = [];
  const attempts = [];
  for (const attempt of tryQueries) {
    const result = await searchPapers({
      query: attempt.q,
      limit: 20,
      languages: ["pt", "en"],
    })
    attempts.push({ query: attempt.q, count: result.length })
    if (result.length > papers.length) {
      papers = result
    }
    if (papers.length >= 10) break
  }
  
  console.log("Attempts:", attempts);
  console.log("Final papers count:", papers.length);
}
run();
