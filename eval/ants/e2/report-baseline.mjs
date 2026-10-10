// eval/ants/e2/report-baseline.mjs — prints the baseline waterfall as markdown (from out/baseline.json + out/baseline.waterfall.json). node eval/ants/e2/report-baseline.mjs
import fs from "node:fs";
import { median, pct, OUT } from "./lib.mjs";
const D = JSON.parse(fs.readFileSync(OUT + "/baseline.json", "utf8"));
const W = JSON.parse(fs.readFileSync(OUT + "/baseline.waterfall.json", "utf8"));
const wf = Object.fromEntries(W.map((r, i) => [i, r]));
const s = (v) => (v == null ? "-" : (v / 1000).toFixed(1));
const md = [];
// per-turn feed splits BEFORE the write (the feed keeps the early events; the tail is trimmed to 60 events)
const rows = [];
for (const t of D.turns) {
  const f = t.msg.feed || []; const done = f.find((e) => e.op === "done"); const T = t.mark.ttd ?? (done ? done.at : null);
  if (!T || T < 1500) { rows.push({ id: t.id, group: t.group, instant: true, T: done ? done.at : null }); continue; }
  const w = f.find((e) => e.op === "begin" && e.id === "write"), we = f.find((e) => e.op === "end" && e.id === "write"); const cut = w ? w.at : Infinity;
  const q = f.filter((e) => e.op === "end" && /^q:/.test(e.id) && e.at <= cut), rb = f.filter((e) => e.op === "begin" && /^r:/.test(e.id) && e.at <= cut), re = f.filter((e) => e.op === "end" && /^r:/.test(e.id) && e.at <= cut);
  const sEnd = q.length ? Math.max(...q.map((e) => e.at)) : 0; const r0 = rb.length ? Math.min(...rb.map((e) => e.at)) : sEnd; const r1 = re.length ? Math.max(...re.map((e) => e.at)) : sEnd;
  rows.push({ id: t.id, group: t.group, T, search: r0 - 0, reads: r1 - r0, origin: w ? w.at - r1 : null, write: we ? we.ms : null, writeEnd: we ? we.at : null, post: we ? T - we.at : 0, correct: t.correct });
}
const timed = rows.filter((r) => !r.instant);
const grp = (name, f) => { const a = timed.filter(f); if (!a.length) return; const m = (k) => median(a.map((r) => r[k])); md.push(`| ${name} | ${a.length} | ${s(m("T"))} | ${s(m("search"))} | ${s(m("reads"))} | ${s(m("origin"))} | ${s(m("write"))} | ${s(m("post"))} | ${s(pct(a.map((r) => r.T), 0.9))} |`); };
md.push("| turn type | n | total (median s) | search (to first read) | reads | origin+prompt gap | model write | after the write (checks) | p90 total |"); md.push("|---|---|---|---|---|---|---|---|---|");
grp("facts", (r) => r.group === "facts"); grp("follow-ups", (r) => r.group === "follow"); grp("writing", (r) => r.group === "write"); grp("live asks", (r) => r.group === "live"); grp("all timed", () => true);
const inst = rows.filter((r) => r.instant);
md.push("", `App-answered turns (no search, no model): ${inst.map((r) => r.id).join(", ")} — feed total ${inst.map((r) => s(r.T)).join(" / ")} s.`);
console.log(md.join("\n"));
