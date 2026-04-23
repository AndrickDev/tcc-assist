async function test() {
  // Test 1: Using global search
  const query = "arquitetura hexagonal domain-driven design sistema";
  let url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=5&select=id,title`;
  let res = await fetch(url);
  let data = await res.json();
  console.log("Global search results count:", data.meta.count);
  console.log("Top 3 titles (Global):");
  data.results.slice(0,3).forEach(r => console.log(" -", r.title));

  // Test 2: Using filter=default.search (Title + Abstract)
  let url2 = `https://api.openalex.org/works?filter=default.search:${encodeURIComponent(query)}&per-page=5&select=id,title`;
  let res2 = await fetch(url2);
  let data2 = await res2.json();
  console.log("\nDefault.search results count:", data2.meta?.count);
  console.log("Top 3 titles (Default.search):");
  (data2.results || []).slice(0,3).forEach(r => console.log(" -", r.title));

  // Test 3: Title only search
  let url3 = `https://api.openalex.org/works?filter=title.search:${encodeURIComponent(query)}&per-page=5&select=id,title`;
  let res3 = await fetch(url3);
  let data3 = await res3.json();
  console.log("\nTitle.search results count:", data3.meta?.count);
  console.log("Top 3 titles (Title.search):");
  (data3.results || []).slice(0,3).forEach(r => console.log(" -", r.title));
}
test();
