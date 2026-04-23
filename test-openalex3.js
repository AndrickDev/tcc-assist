async function searchOpenAlex(query, languages) {
  const params = new URLSearchParams({
    search: query,
    "per-page": "20",
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
searchOpenAlex("arquitetura hexagonal domain-driven design sistema", ["pt", "en"]).then(console.log);
