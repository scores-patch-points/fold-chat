// eval/origin/meaning-coverage.mjs — LIVE: how much synonymy does the reading's OWN hyperlexicon earn on a real article? (fold-chat-meaning.js)
// The user's rule: two words are one meaning iff they fill the same (end1, end2) slot in equivalent claims. Prints, per article, the verbs the relation reader
// admits, the notes it hears, the slots, and the slots in which TWO OR MORE different labels sit — the only place a synonym could be earned.
import { readLedger } from "../../fold-chat-meaning.js";
import { functionWordsOf } from "../../fold-chat-snippets.js";
const ua = (u) => fetch(u, { headers: { "user-agent": "the-fold-dev/1.0 (eval/origin/meaning-coverage.mjs)" } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// politeness: Wikipedia answers "too many requests" with plain text — wait and retry once rather than crash
async function getJson(url) {
  for (let i = 0; i < 3; i++) { const r = await ua(url); const t = await r.text(); try { return JSON.parse(t); } catch { await sleep(4000 * (i + 1)); } }
  throw new Error("Wikipedia would not answer: " + url);
}
const fw = functionWordsOf("en");
const titles = process.argv.slice(2).length ? process.argv.slice(2) : ["Marie_Curie", "Apollo_11", "Nashville,_Tennessee", "Charles_III", "Monarchy_of_the_United_Kingdom", "Eiffel_Tower"];
for (const title of titles) {
  await sleep(1500);
  const ex = Object.values((await getJson(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(title)}`)).query.pages)[0].extract;
  const l = readLedger([{ ref: "article", text: ex }], { fw });
  const slots = new Map();
  for (const n of l.notes) { const k = `${n.end1}|${n.end2}|${n.polarity}`; if (!slots.has(k)) slots.set(k, new Set()); slots.get(k).add(n.label); }
  const multi = [...slots].filter(([, v]) => v.size > 1);
  console.log(`${title.padEnd(32)} chars=${String(ex.length).padStart(6)} verbs=${String(l.verbs.size).padStart(3)} notes=${String(l.notes.length).padStart(4)} slots=${String(slots.size).padStart(4)} slots-with-2+labels=${multi.length}`, multi.slice(0, 3).map(([k, v]) => `${k.replace(/\|[+-]$/, "")}→{${[...v]}}`).join(" ; "));
}
