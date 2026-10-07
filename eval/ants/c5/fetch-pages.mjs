// fetch-pages.mjs — real Wikipedia plain-text pages, cut to ~3000 chars at a sentence boundary (the size of the real capture in PREREG Amendment 4:
// "3 pages x ~3,000 chars"). Writes eval/ants/c5/pages.json. Network; run once, commit nothing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TITLES = ["Eiffel Tower", "Gustave Eiffel", "Paris", "Photosynthesis", "Chloroplast", "Oxygen", "Marie Curie", "Pierre Curie", "Curie (unit)", "Great Wall of China", "Hadrian's Wall", "Great Wall Motors"];
const out = {};
for (const t of TITLES) {
  const u = "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=" + encodeURIComponent(t);
  const j = await (await fetch(u, { headers: { "user-agent": "the-fold-eval-c5/1 (michael.t.lacy@gmail.com)" } })).json();
  const pg = Object.values(j.query.pages)[0];
  let text = String(pg.extract || "").replace(/\n+==+[^=\n]+==+\n/g, "\n").replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
  if (text.length > 3000) { const cut = text.lastIndexOf(". ", 3000); text = text.slice(0, cut > 1500 ? cut + 1 : 3000); }
  out[t] = { title: pg.title, url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(pg.title.replace(/ /g, "_")), text };
  console.log(t, text.length);
}
fs.writeFileSync(path.join(HERE, "pages.json"), JSON.stringify(out, null, 1));
