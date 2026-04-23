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

async function searchOpenAlex(query, languages) {
  const params = new URLSearchParams({
    search: query,
    "per-page": "10",
    select: "id,title",
    mailto: "contato@teseo.app",
  });
  if (languages) {
    params.set("filter", `language:${languages.join("|")}`);
  }
  const url = `https://api.openalex.org/works?${params.toString()}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.results ? data.results.length : 0;
}

const title = "ARQUITETURA HEXAGONAL E DOMAIN-DRIVEN DESIGN COMO FUNDAMENTO DE UM SISTEMA WEB PARA REENCONTRO ENTRE PETS E TUTORES";

async function run() {
  console.log(`Original: ${title}`);
  for (const count of [8, 5, 3, 2, 1]) {
    const q = extractKeywords(title, count);
    const resNoLang = await searchOpenAlex(q, null);
    const resLang = await searchOpenAlex(q, ["pt", "en"]);
    console.log(`  Keywords (${count}) [${q}]: ${resLang} results (with lang), ${resNoLang} results (no lang)`);
  }
}
run();
