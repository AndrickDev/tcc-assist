const STOPWORDS = new Set(["a", "o", "as", "os", "um", "uma", "uns", "umas", "de", "do", "da", "dos", "das", "ao", "aos", "no", "na", "nos", "nas", "em", "com", "por", "para", "entre", "sobre", "sob", "ate", "desde", "e", "ou", "mas", "que", "se", "como", "porque", "pois", "porem", "qual", "quais", "quando", "onde", "ser", "estar", "ter", "haver", "fazer", "sao", "foi", "era", "proposta", "estudo", "analise", "pesquisa", "uso", "utilizacao", "aplicacao", "abordagem", "caso", "base", "forma", "modo", "fundamento", "fundamentos", "processo", "processos", "the", "of", "to", "for", "and", "or", "in", "on", "at", "by", "as", "is", "are", "was", "were", "be", "been", "an", "a", "with", "from", "this", "that", "these", "those"]);

function extractKeywords(title, maxWords = 8) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .slice(0, maxWords)
    .join(" ")
}

async function searchOpenAlex(query) {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=5&select=id,title&mailto=contato@teseo.app`;
  const res = await fetch(url);
  const data = await res.json();
  return data.results ? data.results.length : 0;
}

const titles = [
  "Arquitetura Hexagonal e Domain-Driven Design como fundamento de um sistema web para reencontro entre pets e tutores",
  "Sistema web para reencontro entre pets e tutores",
  "Impacto da inteligência artificial na educação básica",
  "TCC sobre React e Next.js no frontend moderno"
];

async function run() {
  for (const t of titles) {
    console.log(`Original: ${t}`);
    for (const count of [8, 5, 3, 2, 1]) {
      const q = extractKeywords(t, count);
      const results = await searchOpenAlex(q);
      console.log(`  Keywords (${count}) [${q}]: ${results} results`);
    }
    console.log("---");
  }
}
run();
