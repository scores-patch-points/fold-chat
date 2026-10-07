// C1 POST-HOC addendum (declared after the pre-registered runs; not in C1-PREREG.md):
//  (a) the existing `alongside` route with the host gate added (corroboration() with admitHost): does it remove the 3 Britannica false accepts of "today"?
//  (b) five asks: the route WITHOUT the host gate, to show what the gate removes there;
//  (c) full text of every gate-arm origin sentence (for the hand judgement), and cold-read times from the cache.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import glob from "node:fs";
import * as BASE from "./origin-base.mjs"; import * as FIX from "./origin-fixed.mjs";
import { classifyPage } from "../primary-oracle.mjs"; import { cachedFetch, readPage, stats } from "./io.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)); const latest = (pre) => fs.readdirSync(HERE).filter((f) => f.startsWith(pre)).sort().pop();
const corpus = JSON.parse(fs.readFileSync(path.join(HERE, "../primary-corpus.json"), "utf8"));
const run = JSON.parse(fs.readFileSync(path.join(HERE, latest("corpus-run-pre-")), "utf8"));
const out = { corpus: [], five: [] }; let tg = { origins: 0, reach: 0, forbidden: 0, wrongFA: 0, unlistedPass: 0 };
for (const r of run.rows) {
  const c = corpus.claims.find((x) => x.id === r.id); const frame = await BASE.readFrame(c.question, { fetchImpl: cachedFetch });
  const three = []; for (const u of r.hits.filter((u) => !BASE.isTertiary(u))) { if (three.length >= 3) break; const rd = await readPage(u); if (rd.ok) three.push({ url: rd.url || u, title: rd.title, text: rd.text }); }
  const o = FIX.corroboration(r.claim, three, { forWhom: c.question, reading: frame });
  const cls = o ? classifyPage({ url: o.url, text: o.passage.text }, c, corpus).cls : null;
  out.corpus.push({ id: r.id, todayPlusGate: o ? o.host : null, cls }); if (o) { tg.origins++; if (cls === "reach") tg.reach++; if (cls === "forbidden") tg.forbidden++; if (/fails/.test(cls || "")) tg.wrongFA++; if (cls === "unlisted_passes_text") tg.unlistedPass++; }
  // (c)
  const g = r.arms.gate; if (g.origin) { const rd = await readPage(g.origin.url); const full = (rd.text || "").split("\n").find((l) => l.includes((g.origin.sentence || "").slice(0, 60))) || g.origin.sentence; out.corpus[out.corpus.length - 1].gateSentence = (g.origin.sentence || "").slice(0, 400); out.corpus[out.corpus.length - 1].gateRung = g.origin.rung; out.corpus[out.corpus.length - 1].gateHost = g.origin.host; }
}
out.todayPlusGateTotals = tg;
const five = JSON.parse(fs.readFileSync(path.join(HERE, latest("five-run-pre-")), "utf8")); const sim = JSON.parse(fs.readFileSync(path.join(HERE, "../a1/search-fix-sim.json"), "utf8"));
for (const r of five.rows) {
  const hits = sim.find((x) => x.ask === r.ask).rows.map((x) => ({ url: x.url })); const frame = await BASE.readFrame(r.ask, { fetchImpl: cachedFetch });
  const ng = await FIX.corroborateAnswer(r.claim, hits, { read: readPage, fetchImpl: cachedFetch, forWhom: r.ask, reading: frame, admit: (u) => !FIX.tertiaryOf(u) });
  out.five.push({ ask: r.ask, nogate: ng.origin ? ng.origin.host : null, gate: r.arms.L3.origin ? r.arms.L3.origin.host : null, tried: ng.tried.map((t) => (t.read ? t.verdict : "UNREAD") + " " + t.host) });
}
const ms = Object.values(JSON.parse(fs.readFileSync(path.join(HERE, "cache.json"), "utf8"))).filter((v) => v && typeof v.ms === "number").map((v) => v.ms).sort((a, b) => a - b);
out.coldReadMs = { n: ms.length, p50: ms[Math.floor(ms.length / 2)], over6000: ms.filter((x) => x > 6000).length };
fs.writeFileSync(path.join(HERE, "posthoc.json"), JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
process.exit(0);
