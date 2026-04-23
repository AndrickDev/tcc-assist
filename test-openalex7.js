async function test() {
  const query = "arquitetura hexagonal";
  const languages = ["pt", "en"];
  let params = new URLSearchParams({ "per-page": "5", select: "id,title" });
  params.set("filter", `title.search:${query},language:${languages.join("|")}`);
  
  let url3 = `https://api.openalex.org/works?${params.toString()}`;
  console.log(url3);
  let res3 = await fetch(url3);
  let data3 = await res3.json();
  console.log("\nTitle.search 'arquitetura hexagonal' results count:", data3.meta?.count);
  console.log("Top 3 titles (Title.search):");
  (data3.results || []).slice(0,3).forEach(r => console.log(" -", r.title));
}
test();
