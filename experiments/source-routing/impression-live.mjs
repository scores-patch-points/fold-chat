// Live: on real pages, does the fact that answers the ask survive?
//   old  = the first 4,000 chars (what the model was shown)
//   impression = impressionOf(page, ask), budget 3,000
import { readText } from "../../fold-chat-web.js";
import { impressionOf } from "../../fold-chat-impression.js";
const CASES = [
  ["https://en.wikipedia.org/wiki/Eiffel_Tower", "how many rivets does the Eiffel Tower have", /rivets/i],
  ["https://en.wikipedia.org/wiki/Creatine", "does creatine cause kidney damage", /kidney/i],
  ["https://en.wikipedia.org/wiki/Nashville,_Tennessee", "what was the population of Nashville in the 2020 census", /2020 (?:United States )?census|689,/i],
  ["https://en.wikipedia.org/wiki/Pancake", "what is the difference between American pancakes and crêpes", /cr[eê]pe/i],
  ["https://en.wikipedia.org/wiki/Sourdough", "how long does a sourdough starter take to ferment", /ferment/i],
  ["https://en.wikipedia.org/wiki/Ada_Lovelace", "what did Ada Lovelace write about the Analytical Engine", /Analytical Engine/i],
  ["https://en.wikipedia.org/wiki/Hanseatic_League", "when did the Hanseatic League dissolve", /1669|1862/],
];
let oldHit = 0, impHit = 0, oldChars = 0, impChars = 0, n = 0;
for (const [url, ask, re] of CASES) {
  const rd = await readText(url, { timeoutMs: 20000 });
  if (!rd.ok) { console.log("SKIP (unreadable):", url); continue; }
  n++;
  const head = rd.text.slice(0, 4000);
  const e = impressionOf(rd.text, ask, { budget: 3000 });
  const a = re.test(head), b = re.test(e.text);
  oldHit += a; impHit += b; oldChars += head.length; impChars += e.text.length;
  console.log(`${a ? "old ✓" : "old ✗"}  ${b ? "impression ✓" : "impression ✗"}  page ${rd.text.length.toLocaleString().padStart(6)}  kept ${String(e.shadow.kept).padStart(5)} (${Math.round(100 * e.shadow.kept / rd.text.length)}%)  ${ask}`);
}
console.log(`\nfact present: first-4000 ${oldHit}/${n}   impression ${impHit}/${n}`);
console.log(`chars given to the model: first-4000 ${oldChars}   impression ${impChars}`);
