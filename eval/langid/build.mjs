// eval/langid/build.mjs — turn asks.mjs (+ eval/cases.json questions + the everyday asks) into labelled.json.
// No detector is imported here. The split is by sha1 round-robin inside each (class, gold) cell so each third
// has the same mix: dev (tuning), val (selection), held (scored once, at the end).
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BLOCKS } from "./asks.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const norm = (t) => t.toLowerCase().normalize("NFC").replace(/[\s?!.,¿¡'’"]+/g, " ").trim();
const items = []; const seen = new Map();
// the same text under two golds (a sentence that hr, sr and bs speakers all write identically) accepts BOTH: the label is the union
const add = (text, gold, cls, src) => {
  const k = norm(text); if (!k) return;
  if (seen.has(k)) { const o = seen.get(k); for (const g of gold.split("|")) if (!o.accept.includes(g)) { o.accept.push(g); o.shared = true; } return; }
  const it = { text, accept: gold.split("|"), cls, src }; seen.set(k, it); items.push(it);
};

for (const [g, body] of BLOCKS) {
  const [gold, tag] = g.split("#");
  const cls = tag === "ct" ? "cannot-tell" : tag === "oos" ? "no-prior" : tag === "kw" ? "en-keyword" : tag === "mix" ? "code-switch" : tag === "short" ? "short" : gold === "en" ? "en" : "lang";
  for (const line of body.split("\n")) if (line.trim()) add(line.trim(), gold, cls, "asks");
}
// eval/cases.json: the multilingual stratum's questions, labelled by the case's own lang field (sw has no prior here)
const cases = JSON.parse(fs.readFileSync(path.join(HERE, "..", "cases.json"), "utf8")).cases;
for (const c of cases) if (c.stratum === "e_multilingual" && c.lang) add(c.turns[0], c.lang === "sw" ? "unknown" : c.lang, c.lang === "sw" ? "no-prior" : c.lang === "en" ? "en" : "lang", "cases.json");
// the everyday asks (scratchpad/everyday.mjs), English unless marked
const EVERYDAY = [["hi", "unknown", "cannot-tell"],
  ["What's a good recipe for banana bread?", "en"], ["Explain the difference between a virus and a bacterium", "en"], ["How do I reverse a string in Python?", "en"],
  ["What is 15% of 240?", "en"], ["Give me a 3-day itinerary for Lisbon", "en"], ["What's the capital of Australia?", "en"],
  ["Write a short thank-you note to my neighbor for watering my plants", "en"], ["Translate 'where is the train station' into Spanish and French", "en"],
  ["Is it safe to eat eggs after the expiration date?", "en"], ["Compare iPhone and Android for a first-time smartphone user", "en"],
  ["Who won the World Cup in 2018?", "en"], ["How many calories are in an avocado?", "en"], ["what's the weather like in Seattle today", "en"],
  ["Give me tips to fall asleep faster", "en"], ["How does compound interest work? Give an example.", "en"], ["wat is the tallest mountain on earth lol", "en"],
  ["tell me about mercury", "en"], ["Who wrote Pride and Prejudice?", "en"], ["When was it published?", "en"], ["What else did she write?", "en"],
  ["I want to learn guitar", "en"], ["where should I start?", "en"], ["¿Cuál es la capital de Francia?", "es"], ["东京有多少人口？", "zh"], ["Wie funktioniert ein Elektromotor?", "de"],
  ["I have a job interview tomorrow and I'm nervous. Any advice?", "en"]];
for (const [t, g, c] of EVERYDAY) add(t, g, c || (g === "en" ? "en" : "lang"), "everyday");

// split: sha1 order inside each cell, round robin dev / val / held
const cell = (x) => x.cls + "|" + x.accept.join("|");
const by = new Map(); for (const x of items) { const k = cell(x); if (!by.has(k)) by.set(k, []); by.get(k).push(x); }
for (const list of by.values()) {
  list.sort((a, b) => crypto.createHash("sha1").update(a.text).digest("hex").localeCompare(crypto.createHash("sha1").update(b.text).digest("hex")));
  list.forEach((x, i) => { x.split = ["dev", "val", "held"][i % 3]; });
}
items.forEach((x, i) => { x.id = "a" + String(i + 1).padStart(4, "0"); });
fs.writeFileSync(path.join(HERE, "labelled.json"), JSON.stringify(items, null, 1));
const count = (f) => items.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
console.log("items", items.length, "by class", count((x) => x.cls), "by split", count((x) => x.split));
console.log("languages", Object.keys(count((x) => x.accept[0])).length, count((x) => x.accept[0]));
