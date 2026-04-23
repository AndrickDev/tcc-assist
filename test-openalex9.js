async function test() {
  const query = "domain-driven design";
  const languages = ["pt", "en"];
  let params = new URLSearchParams({ "per-page": "5", select: "id,title" });
  params.set("filter", `title_and_abstract.search:${query},language:${languages.join("|")}`);
  
  let url3 = `https://api.openalex.org/works?${params.toString()}`;
  let res3 = await fetch(url3);
  let data3 = await res3.json();
  console.log("\ntitle_and_abstract.search 'domain-driven design' results count:", data3.meta?.count);
}
test();
