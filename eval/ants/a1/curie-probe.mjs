import * as web from "../../../fold-chat-web.js";
import * as O from "../../../fold-chat-origin.js";
import { consequenceOf } from "../../../fold-chat-assemble.js";
for (const u of ["https://nationalstemcellfoundation.org/glossary/marie-curie/", "https://ipsb.nina.gov.pl/a/biografia/maria-sklodowska-curie"]) { }
const idx = await O.wikiIndex("https://en.wikipedia.org/wiki/Marie_Curie", { fetchImpl: fetch });
for (const n of [46, 73, 1]) { const note = [...idx.notes.values()].find((x) => x.n === n); console.log(n, note.url); const x = await web.readText(note.url, { fetchImpl: fetch, memo: web.makeMemo() });
  const t = x.text || ""; const m = [...t.matchAll(/[^.]*\b1934\b[^.]*\./g)].map((a) => a[0].trim().slice(0, 200)); console.log("  ok", x.ok, "len", t.length, "1934 sentences:", JSON.stringify(m.slice(0, 3)));
  for (const claim of ["Marie Curie died on 4 July 1934.", "Marie Curie died on July 4, 1934."]) { const c = consequenceOf(claim, [{ url: note.url, source: note.url, ref: "o", text: t }]); const s = O.supportOf(claim, { url: note.url, title: x.title, text: t }, { forWhom: "When did Marie Curie die?" }); console.log("  ", claim, "| atoms", JSON.stringify(c.atoms), c.why, c.detail, "| verdict", s.verdict, s.why, s.detail); } }
