// Experiment: does the source router pick the right places to look?
// Offline, deterministic. Each question is hand-labelled with the specialist
// sources a person would say it NEEDS (empty = the open web is enough).
// We compare the old policy (every source, every time) with routeSources()
// alone (step 1) — the probe (step 2) is a second chance on top, measured live.
import { routeSources } from "../../fold-chat-route.js";

const SPECIALISTS = ["wikipedia", "github", "archive", "openalex", "crossref"];
const P = ["openalex", "crossref"];
const CASES = [
  // [question, needed specialists]
  ["whats a good pancake recipe?", []],
  ["how do I get red wine out of a carpet", []],
  ["best running shoes for flat feet", []],
  ["what time does the post office close on saturday", []],
  ["how long to boil an egg", []],
  ["cheap flights from nashville to lisbon in march", []],
  ["why is my sourdough starter not rising", []],
  ["who was Ada Lovelace", ["wikipedia"]],
  ["what is the capital of Australia", ["wikipedia"]],
  ["history of the Hanseatic League", ["wikipedia"]],
  ["Compare the founding of Canberra, Brasília, Ottawa, and Washington, D.C.", ["wikipedia"]],
  ["when was the Eiffel Tower built", ["wikipedia"]],
  ["is there an open source library for parsing PDFs in python", ["github"]],
  ["best npm package for date handling", ["github"]],
  ["rust crate for async http", ["github"]],
  ["find a react framework for drag and drop", ["github"]],
  ["what does the research say about the effect of creatine on memory", P],
  ["meta-analysis of intermittent fasting and weight loss", P],
  ["peer-reviewed studies on remote work productivity", P],
  ["clinical trial results for semaglutide", P],
  ["out of print books about 1850s whaling", ["archive"]],
  ["public domain manuscript of Pride and Prejudice full text", ["archive", "wikipedia"]],
  ["scanned newspaper from 1906 San Francisco earthquake", ["archive"]],
  ["Judy Liff Zachary Liff Nashville", []],
  ["find the relationship between Judy and Zachary Liff from Nashville", []],
  ["what's the weather in Nashville", []],
  ["python library for scraping and the research behind it", ["github", ...P]],
  ["tell me about Marie Curie's research on radioactivity", ["wikipedia", ...P]],
  ["how do I install docker on ubuntu", ["github"]],
  ["explain how vaccines work", ["wikipedia"]],
];

let oldCalls = 0, newCalls = 0, need = 0, got = 0, over = 0, perfect = 0;
const misses = [], overs = [];
for (const [q, needed] of CASES) {
  const r = routeSources(q);
  const picked = r.scopes.filter((s) => s !== "web");
  oldCalls += SPECIALISTS.length; newCalls += picked.length;
  need += needed.length;
  const hit = needed.filter((s) => picked.includes(s));
  got += hit.length;
  const extra = picked.filter((s) => !needed.includes(s));
  over += extra.length;
  const miss = needed.filter((s) => !picked.includes(s));
  if (!miss.length && !extra.length) perfect++;
  if (miss.length) misses.push([q, miss.join(",")]);
  if (extra.length) overs.push([q, extra.join(",")]);
}
const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "n/a");
console.log(`questions            ${CASES.length}`);
console.log(`specialist calls     old ${oldCalls}  →  new ${newCalls}   (${pct(oldCalls - newCalls, oldCalls)} fewer)`);
console.log(`needed-source recall ${got}/${need}  ${pct(got, need)}`);
console.log(`unneeded calls left  ${over}`);
console.log(`exactly right        ${perfect}/${CASES.length}`);
if (misses.length) { console.log("\nMISSED (needed, not routed — the probe may still catch these):"); for (const [q, m] of misses) console.log("  -", q, "→ missing", m); }
if (overs.length) { console.log("\nOVER-FETCHED:"); for (const [q, m] of overs) console.log("  -", q, "→ extra", m); }
