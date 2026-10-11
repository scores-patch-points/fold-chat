// eval/ants/e2/waterfall.mjs — attribute each turn's wall clock to model / network / compute from the in-page fetch log (independent of the feed's own step lines).
//   node eval/ants/e2/waterfall.mjs out/baseline.json
import fs from "node:fs";
import { median, pct } from "./lib.mjs";
const file = process.argv[2] || new URL("./out/baseline.json", import.meta.url).pathname;
const D = JSON.parse(fs.readFileSync(file, "utf8"));
const union = (iv) => { iv = iv.filter((x) => x[1] > x[0]).sort((a, b) => a[0] - b[0]); let tot = 0, cur = null; for (const x of iv) { if (!cur || x[0] > cur[1]) { if (cur) tot += cur[1] - cur[0]; cur = [x[0], x[1]]; } else cur[1] = Math.max(cur[1], x[1]); } if (cur) tot += cur[1] - cur[0]; return tot; };
const purpose = (f, i, first) => (i === first ? "write" : f.maxTokens === 220 ? "pointer" : f.temp === 0.1 ? "restate-claim" : f.temp === 0.2 ? "restate-lang" : /Continue exactly/.test(f.last || "") ? "continue" : "other");
const rows = [];
for (const t of D.turns) {
  if (!t.mark || !t.msg) continue;
  const done = (t.msg.feed || []).find((e) => e.op === "done");
  const T = t.mark.ttd ?? (done ? done.at : null);
  if (!T || T < 1500) continue;                     // app-answered turns (no search, no model): reported separately
  const c0 = t.mark.c0;
  const F = (t.f || []).filter((f) => f.t1 != null).map((f) => ({ ...f, a: f.t0 - c0, b: f.t1 - c0 })).filter((f) => f.cls !== "local-other" && f.b > 0 && f.a < T + 500);
  const models = F.filter((f) => f.cls === "model").sort((x, y) => x.a - y.a);
  const first = F.indexOf(models[0]);
  const wEnd = models[0] ? models[0].b : null;
  const net = F.filter((f) => f.cls !== "model");
  const seg = (lo, hi) => ({ model: union(models.filter((f) => f.b > lo && f.a < hi).map((f) => [Math.max(f.a, lo), Math.min(f.b, hi)])), net: union(net.filter((f) => f.b > lo && f.a < hi).map((f) => [Math.max(f.a, lo), Math.min(f.b, hi)])), span: hi - lo });
  const pre = seg(0, wEnd ?? T), post = wEnd != null ? seg(wEnd, T) : { model: 0, net: 0, span: 0 };
  const calls = models.map((f, i) => ({ p: purpose(f, i, 0), ms: f.b - f.a, ttft: f.tFirst != null ? f.tFirst - f.t0 : null, chars: f.promptChars, at: f.a }));
  const by = {}; for (const c of calls) { (by[c.p] ||= { n: 0, ms: 0 }); by[c.p].n++; by[c.p].ms += c.ms; }
  const netBy = {}; for (const f of net) { (netBy[f.cls] ||= { n: 0, ms: 0, fail: 0 }); netBy[f.cls].n++; netBy[f.cls].ms += f.b - f.a; if (f.status == null || f.status >= 400) netBy[f.cls].fail++; }
  rows.push({ id: t.id, group: t.group, T, wEnd, pre, post, calls, by, netBy, tokens: (/(\d+) token/.exec(((t.msg.feed || []).find((e) => e.op === "end" && e.id === "write") || {}).note || "") || [])[1] || null });
}
const s = (v) => (v == null ? "  -" : (v / 1000).toFixed(1).padStart(5));
console.log("id".padEnd(14), "  T", "  pre:span mdl net", " | post:span mdl net", " | calls (purpose:n/ms)");
for (const r of rows) console.log(String(r.id).padEnd(14), s(r.T), "  ", s(r.pre.span), s(r.pre.model), s(r.pre.net), " |", s(r.post.span), s(r.post.model), s(r.post.net), " |", Object.entries(r.by).map(([k, v]) => `${k}:${v.n}/${(v.ms / 1000).toFixed(1)}`).join(" "));
const sum = (k) => rows.reduce((n, r) => n + k(r), 0);
const T = sum((r) => r.T);
console.log(`\nn=${rows.length} timed turns, total ${(T / 1000).toFixed(0)} s. Shares of all wall-clock:`);
console.log(`  pre-write span (search+reads+origin+slot+prompt): ${(100 * sum((r) => r.pre.span) / T).toFixed(0)}%   of which network-busy ${(100 * sum((r) => r.pre.net) / T).toFixed(0)}%`);
console.log(`  model write call(s) up to first completion: ${(100 * sum((r) => r.calls[0] ? r.calls[0].ms : 0) / T).toFixed(0)}%`);
console.log(`  post-write span (REC laps, pivot, provenance, findPrimary, watcher): ${(100 * sum((r) => r.post.span) / T).toFixed(0)}%   model-busy ${(100 * sum((r) => r.post.model) / T).toFixed(0)}%  network-busy ${(100 * sum((r) => r.post.net) / T).toFixed(0)}%  neither ${(100 * sum((r) => Math.max(0, r.post.span - r.post.model - r.post.net)) / T).toFixed(0)}%`);
const P = {}; for (const r of rows) for (const [k, v] of Object.entries(r.by)) { (P[k] ||= { n: 0, ms: 0, turns: 0 }); P[k].n += v.n; P[k].ms += v.ms; P[k].turns++; }
console.log("model calls by purpose (all turns):", Object.entries(P).map(([k, v]) => `${k}: ${v.n} calls in ${v.turns} turns, ${(v.ms / 1000).toFixed(0)} s total, ${(v.ms / v.n / 1000).toFixed(1)} s each`).join(" | "));
const NB = {}; for (const r of rows) for (const [k, v] of Object.entries(r.netBy)) { (NB[k] ||= { n: 0, ms: 0, fail: 0 }); NB[k].n += v.n; NB[k].ms += v.ms; NB[k].fail += v.fail; }
console.log("network calls by class:", Object.entries(NB).map(([k, v]) => `${k}: ${v.n} calls (${v.fail} failed/blocked), mean ${(v.ms / v.n / 1000).toFixed(1)} s`).join(" | "));
const w = rows.map((r) => r.calls[0]).filter(Boolean);
console.log("write call: median total", s(median(w.map((c) => c.ms))), "s; median TTFT", s(median(w.map((c) => c.ttft))), "s; median prompt chars", median(w.map((c) => c.chars)));
const tok = rows.filter((r) => r.tokens && r.calls[0]).map((r) => ({ t: +r.tokens, ms: r.calls[0].ms, ttft: r.calls[0].ttft })); if (tok.length) console.log("write tokens/s (tokens / (total-ttft)):", median(tok.map((x) => x.t / Math.max(0.2, (x.ms - (x.ttft || 0)) / 1000))).toFixed(1), "median over", tok.length, "turns; tokens median", median(tok.map((x) => x.t)));
fs.writeFileSync(file.replace(/\.json$/, ".waterfall.json"), JSON.stringify(rows, null, 1));
