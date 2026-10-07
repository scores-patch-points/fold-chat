const api = (t) => `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(t)}&prop=text%7Crevid&format=json&formatversion=2&disableeditsection=1&disablelimitreport=1&redirects=1&origin=*`;
for (const t of ["Eiffel Tower", "Canberra", "Charles III"]) {
  for (const h of [{}, { "User-Agent": "the-fold-a1-diagnosis/0.1 (research)" }]) {
    const r = await fetch(api(t), { headers: h }); const b = await r.text();
    console.log(t, Object.keys(h).length ? "UA" : "noUA", r.status, b.length, b.slice(0, 120).replace(/\n/g, " "));
  }
}
