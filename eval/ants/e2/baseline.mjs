// eval/ants/e2/baseline.mjs — the baseline waterfall: >= 20 real turns of a mix (facts, follow-ups, writing, live, source-asks) on the REAL page.
//   node eval/ants/e2/baseline.mjs [label] [--only=facts|follow|write|live|src]
import fs from "node:fs";
import { chromium, openInstrumented, turn, save } from "./lib.mjs";
const truth = JSON.parse(fs.readFileSync(new URL("./truth.json", import.meta.url)));
const F = Object.fromEntries(truth.facts.map((f) => [f.id, f]));
const label = process.argv[2] || "baseline";
const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7) || null;
// threads: a fresh page per thread (cold memo), turns in order
const THREADS = [
  { g: "facts", t: [F.eiffel, F.austen] },
  { g: "facts", t: [F.canberra, F.wall] },
  { g: "facts", t: [F.mona, { g: "follow", id: "mona-when", ask: "When was it painted?" }] },
  { g: "facts", t: [F.gold, F.python, { g: "follow", id: "python-release", ask: "When was it first released?" }] },
  { g: "facts", t: [F.everest, F.moon] },
  { g: "facts", t: [F.ottawa, F.penicillin] },
  { g: "facts", t: [F.ww2, F.light] },
  { g: "facts", t: [F.curie, { g: "follow", id: "curie-disc", ask: "What did she discover?" }, { g: "follow", id: "curie-husband", ask: "Tell me more about her husband." }] },
  { g: "facts", t: [F.relativity, F.photo, { g: "src", id: "src-where", ask: "where did you get that?" }] },
  { g: "write", t: [{ id: "w-eiffel", ask: "Write a short paragraph about the Eiffel Tower." }, { id: "w-photo", ask: "Write two sentences about photosynthesis for a child." }] },
  { g: "write", t: [{ id: "w-haiku", ask: "Write a haiku about autumn." }, { id: "w-email", ask: "Draft a short email thanking a colleague for covering my shift." }] },
  { g: "live", t: [{ id: "live-weather", ask: "What is the weather in Chicago today?" }, { id: "live-news", ask: "What is the latest news about NASA?" }] },
  { g: "src", t: [F.eiffel, { g: "src", id: "src-primary", ask: "find a primary source" }] },
];
const browser = await chromium.launch();
const out = [];
for (const [ti, th] of THREADS.entries()) {
  if (only && th.g !== only && !th.t.some((x) => x.g === only)) continue;
  const { ctx, page } = await openInstrumented(browser, {});
  for (const q of th.t) {
    const t0 = Date.now();
    let r; try { r = await turn(page, q.ask); } catch (e) { r = { ask: q.ask, error: String(e) }; }
    r.id = q.id; r.group = q.g || th.g; r.thread = ti; r.wall = Date.now() - t0;
    if (q.re) r.correct = new RegExp(q.re, "i").test(String(r.spoken || "") + " " + String(r.shown || ""));
    out.push(r);
    console.log(`[${out.length}] ${r.group.padEnd(6)} ${q.ask.slice(0, 44).padEnd(44)} ttfa ${r.mark ? (r.mark.ttfa / 1000).toFixed(1) : "?"}s  ttd ${r.mark ? (r.mark.ttd / 1000).toFixed(1) : "?"}s  ${q.re ? (r.correct ? "OK " : "WRONG ") : ""}${String(r.spoken || "").slice(0, 70).replace(/\n/g, " ")}`);
    save(`${label}.json`, { label, at: new Date().toISOString(), load: null, turns: out });
  }
  await ctx.close();
}
await browser.close();
