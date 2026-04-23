async function test() {
  const query = "arquitetura hexagonal";
  const languages = ["pt", "en"];
  let params = new URLSearchParams({ "per-page": "5", select: "id,title" });
  params.set("filter", `title_and_abstract.search:${query},language:${languages.join("|")}`);
  
  let url3 = `https://api.openalex.org/works?${params.toString()}`;
  let res3 = await fetch(url3);
  let data3 = await res3.json();
  console.log("\ntitle_and_abstract.search 'arquitetura hexagonal' results count:", data3.meta?.count);
  console.log("Top 3 titles:");
  (data3.results || []).slice(0,3).forEach(r => console.log(" -", r.title));

  const q5 = "arquitetura hexagonal domain-driven design sistema";
  params.set("filter", `title_and_abstract.search:${q5},language:${languages.join("|")}`);
  let url5 = `https://api.openalex.org/works?${params.toString()}`;
  let res5 = await fetch(url5);
  let data5 = await res5.json();
  console.log("\ntitle_and_abstract.search q5 results count:", data5.meta?.count);
  console.log("Top 3 titles:");
  (data5.results || []).slice(0,3).forEach(r => console.log(" -", r.title));
}
test();
