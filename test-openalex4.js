const search = require("./src/lib/papers-search");

async function run() {
  try {
    const q = search.extractKeywords("ARQUITETURA HEXAGONAL E DOMAIN-DRIVEN DESIGN COMO FUNDAMENTO DE UM SISTEMA WEB PARA REENCONTRO ENTRE PETS E TUTORES", 5);
    console.log("Query:", q);
    const results = await search.searchPapers({ query: q, limit: 20 });
    console.log("Normalized results length:", results.length);
    if (results.length > 0) {
      console.log("First result title:", results[0].title);
    }
  } catch(e) {
    console.error("Error:", e);
  }
}
run();
