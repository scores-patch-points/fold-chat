// !! NOT REPRESENTATIVE OF AN EXTENSION (found 2026-10-05, after this script's own run):
// !! Node's fetch is answered with a bot challenge (DuckDuckGo) / HTTP 429 (Brave) on the very IP where a
// !! real Chromium gets 200 OK with full results — same address, same hour, 12/12 queries, no challenge.
// !! The block is the TRANSPORT's fingerprint, not volume. The H4 verdict printed by this script is about
// !! Node, not about the extension; the browser-stack numbers are in experiments/source-routing/RESULTS.md.
// FALSIFICATION H4 — direct engines (Brave + DuckDuckGo fallback, asked at once) vs the relay.
// PRE-REGISTERED. H4 is FALSIFIED if ANY holds (12 queries, paced 4 s apart so volume is not the cause):
//   K1  fewer than 10/12 queries return >= 5 parsed results
//   K2  median end-to-end latency >= 1500 ms
//   K3  fewer than 9/12 queries have >= 3 of the top 5 results sharing >= 2 content words with the ask
//   K4  Brave refuses (challenge / 429 / not parseable) on any request
//   K5  overall success <= the relay's 5/12 measured earlier today
import { searchDirect } from "../../fold-chat-engines.js";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const QUERIES = ["how long does a sourdough starter take to ferment", "best running shoes for flat feet", "how to get red wine out of carpet", "who was Ada Lovelace", "when did the Hanseatic League dissolve", "does creatine cause kidney damage", "rust crate for async http", "python library for parsing pdf", "Nashville Metro Council meeting schedule", "meta-analysis intermittent fasting weight loss", "how many rivets does the Eiffel Tower have", "what is the capital of Australia"];
const SKIP = new Set("does what when many long take have with that this from where which would about".split(" "));
const words = (s) => [...new Set((String(s).toLowerCase().match(/[a-z0-9]{4,}/g) || []).filter((w) => !SKIP.has(w)))];
const f = (u, o = {}) => fetch(u, { ...o, headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];
for (const q of QUERIES) {
  const t0 = Date.now();
  const out = await searchDirect(q, { fetchImpl: f });
  const ms = Date.now() - t0;
  const qw = words(q);
  const rel = out.results.slice(0, 5).filter((r) => { const hay = (r.title + " " + r.snippet).toLowerCase(); return qw.filter((w) => hay.includes(w)).length >= 2; }).length;
  const brave = out.tried.find((t) => t.id === "brave");
  rows.push({ q, ok: out.results.length >= 5, ms, n: out.results.length, rel, engine: out.engine, braveWhy: brave && brave.why, tried: out.tried.map((t) => `${t.id}:${t.n}/${t.ms}ms${t.why ? "(" + t.why + ")" : ""}`).join(" ") });
  console.log(`${out.results.length >= 5 ? "ok" : "--"} ${String(out.results.length).padStart(2)} rel ${rel}/5 ${String(ms).padStart(5)}ms [${out.engine || "none"}]  ${rows.at(-1).tried}  | ${q}`);
  await sleep(4000);
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const ok = rows.filter((r) => r.ok).length, relOk = rows.filter((r) => r.rel >= 3).length, m = med(rows.map((r) => r.ms)), braveBad = rows.filter((r) => r.braveWhy).length;
const K = { K1: ok < 10, K2: m >= 1500, K3: relOk < 9, K4: braveBad > 0, K5: ok <= 5 };
console.log(`\nsuccess ${ok}/12 · median ${m}ms · relevant ${relOk}/12 · brave refused ${braveBad}/12`);
for (const [k, v] of Object.entries(K)) console.log(`${k}: ${v ? "FALSIFIES" : "ok"}`);
console.log(`VERDICT H4: ${Object.values(K).some(Boolean) ? "FALSIFIED on " + Object.entries(K).filter(([, v]) => v).map(([k]) => k).join(",") : "survives this test"}`);
