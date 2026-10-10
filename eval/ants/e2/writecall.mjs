// eval/ants/e2/writecall.mjs — the model WRITE call per config: prompt size, time to first token, total, tokens/s.   node eval/ants/e2/writecall.mjs matrix [matrix2]
import fs from "node:fs";
import path from "node:path";
import { median, OUT } from "./lib.mjs";
const labels = process.argv.slice(2).length ? process.argv.slice(2) : ["matrix"];
const turns = [];
for (const f of fs.readdirSync(OUT)) for (const l of labels) if (f.startsWith(l + "-w") && f.endsWith(".json")) turns.push(...JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")).turns);
const by = {};
for (const t of turns) { if (!t.f) continue; const m = t.f.filter((x) => x.cls === "model" && x.t1 != null).sort((a, b) => a.t0 - b.t0)[0]; if (!m) continue; (by[t.cfg] ||= []).push({ chars: m.promptChars, ttft: m.tFirst != null ? m.tFirst - m.t0 : null, total: m.t1 - m.t0, id: t.id }); }
console.log("cfg  n  prompt chars (med)  TTFT s (med)  write total s (med)");
for (const [k, a] of Object.entries(by).sort()) console.log(k.padEnd(4), String(a.length).padStart(2), String(median(a.map((x) => x.chars))).padStart(10), (median(a.map((x) => x.ttft)) / 1000).toFixed(1).padStart(14), (median(a.map((x) => x.total)) / 1000).toFixed(1).padStart(14));
