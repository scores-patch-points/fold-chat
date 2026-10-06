// query-frame.mjs — does stripping the question frame ("Who is the …") from the Wikipedia query put the right article in the top 3?
// Arms: A = the literal question (today) · B = frame-stripped (leading function words of the khora prior removed) · C = B's hits, then A's (deduped).
// Gold: each eval case's `topic` regex against the result title (eval/cases.json, English single-language cases only). Network: Wikipedia API only, serial.
//   node eval/falsify/query-frame.mjs [--extra]      # --extra adds the king/president/spider/WW2 asks that motivated this
import fs from "node:fs";
import { functionWordsOf } from "../../fold-chat-snippets.js";
import { wikiEdition } from "../../fold-chat-web.js";
import { stripFrame } from "../../fold-chat-frame.js";

const cases = JSON.parse(fs.readFileSync(new URL("../cases.json", import.meta.url), "utf8")).cases || JSON.parse(fs.readFileSync(new URL("../cases.json", import.meta.url), "utf8"));
const rows = [];
for (const c of cases) {
  const q = c.turns?.[0]; if (!q || !c.topic) continue;
  if (wikiEdition(q) !== "en") continue;
  rows.push({ id: c.id, q, topic: new RegExp(c.topic, "i") });
}
if (process.argv.includes("--extra")) for (const [id, q, t] of [["x_king", "Who is the king of the UK?", "monarchy of the united kingdom|british monarch|charles iii|list of british monarchs"], ["x_pres", "Who is the president of the UK?", "prime minister|monarchy|united kingdom"], ["x_spider", "How many legs does a spider have?", "spider|arachnid"], ["x_ww2", "What year did World War 2 end?", "world war ii|second world war"], ["x_kingfr", "Who is the king of France?", "french monarch|king of france|list of french"], ["x_pm", "Who is the prime minister of the UK?", "prime minister of the united kingdom"]]) rows.push({ id, q, topic: new RegExp(t, "i") });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function wiki(q) {
  const u = "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=6&srsearch=" + encodeURIComponent(q);
  for (let i = 0; i < 5; i++) { try { const r = await fetch(u, { headers: { "Api-User-Agent": "fold-chat-eval/0.1 (research; local)" } }); if (r.ok) return ((await r.json()).query?.search || []).map((x) => x.title); } catch {} await sleep(1500 * (i + 1)); }
  return null;
}
const hit = (titles, re, k) => !!titles && titles.slice(0, k).some((t) => re.test(t));
const tally = { A: { 1: 0, 3: 0 }, B: { 1: 0, 3: 0 }, C: { 1: 0, 3: 0 }, D: { 1: 0, 3: 0 } }; let n = 0, changed = 0; const flips = [], skipped = [], all = [];
for (const r of rows) {
  const s = stripFrame(r.q, functionWordsOf("en"));
  const A = await wiki(r.q); await sleep(400);
  const B = s && s !== r.q ? await wiki(s) : A; if (s !== r.q) await sleep(400);
  if (!A || !B) { skipped.push(r.id); continue; }
  const C = [...new Set([...B, ...A])];
  const D = []; for (let i = 0; i < Math.max(A.length, B.length); i++) for (const T of [B, A]) if (T[i] && !D.includes(T[i])) D.push(T[i]);   // D = interleave, stripped first
  n++; if (s !== r.q) changed++;
  all.push({ id: r.id, q: r.q, stripped: s === r.q ? null : s, a1: hit(A, r.topic, 1), b1: hit(B, r.topic, 1), a3: hit(A, r.topic, 3), b3: hit(B, r.topic, 3), c3: hit(C, r.topic, 3), d1: hit(D, r.topic, 1), d3: hit(D, r.topic, 3), A3: A.slice(0, 3), B3: B.slice(0, 3) });
  for (const [k, T] of [["A", A], ["B", B], ["C", C], ["D", D]]) for (const m of [1, 3]) if (hit(T, r.topic, m)) tally[k][m]++;
  const a3 = hit(A, r.topic, 3), b3 = hit(B, r.topic, 3), c3 = hit(C, r.topic, 3), d3 = hit(D, r.topic, 3);
  if (a3 !== b3 || a3 !== c3 || a3 !== d3) flips.push({ id: r.id, q: r.q, stripped: s, A: A.slice(0, 3), B: B.slice(0, 3), a3, b3, c3 });
}
console.log(`n=${n} (asks whose frame changed: ${changed}) skipped on fetch failure: ${skipped.join(",") || "none"}`);
for (const a of all) console.log(`${a.id.padEnd(22)} ${a.stripped ? "stripped" : "same    "}  top1 A:${+a.a1} B:${+a.b1}  top3 A:${+a.a3} B:${+a.b3} C:${+a.c3} D:${+a.d3}  ${a.stripped ? "-> " + a.stripped : ""}`);
for (const k of ["A", "B", "C", "D"]) console.log(`${k}  top1 ${tally[k][1]}/${n}  top3 ${tally[k][3]}/${n}`);
console.log("\nCASES WHERE ARMS DISAGREE ON TOP-3 (gold topic in top 3?):");
for (const f of flips) console.log(`${f.id}: "${f.q}" -> "${f.stripped}"  A:${f.a3} B:${f.b3} C:${f.c3}\n    A ${f.A.join(" | ")}\n    B ${f.B.join(" | ")}`);
fs.writeFileSync(new URL("./query-frame-results.json", import.meta.url), JSON.stringify({ n, changed, skipped, tally, all, flips }, null, 1));
