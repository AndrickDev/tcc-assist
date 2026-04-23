async function test() {
  const query = "arquitetura hexagonal";
  let url3 = `https://api.openalex.org/works?filter=title.search:${encodeURIComponent(query)}&per-page=5&select=id,title`;
  let res3 = await fetch(url3);
  let data3 = await res3.json();
  console.log("\nTitle.search 'arquitetura hexagonal' results count:", data3.meta?.count);
  console.log("Top 3 titles (Title.search):");
  (data3.results || []).slice(0,3).forEach(r => console.log(" -", r.title));

  const query2 = "domain-driven design";
  let url4 = `https://api.openalex.org/works?filter=title.search:${encodeURIComponent(query2)}&per-page=5&select=id,title`;
  let res4 = await fetch(url4);
  let data4 = await res4.json();
  console.log("\nTitle.search 'domain-driven design' results count:", data4.meta?.count);
  console.log("Top 3 titles (Title.search):");
  (data4.results || []).slice(0,3).forEach(r => console.log(" -", r.title));
}
test();
