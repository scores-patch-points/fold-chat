// F3 compute: every case and every real record through falsifiersOf + the headline arithmetic. Exports compute(); `node compute.mjs [presentPath]` prints JSON.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load, mkRec, headlineOf, loadCases, loadReal, loadLabels, rowOf, rowClass, honestCount, notRunCount, honestText, defsDisplay } from "./lib.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHECKOF = { DEF: "DEF", EVA: "EVA", REC: "REC" };

export async function compute(presentPath) {
  const mod = await load(presentPath);
  const slim = (p) => p && ({ op: p.op, k: p.k, st: p.st, figure: p.row.figure, ground: p.row.ground, pattern: p.row.pattern, cls: rowClass(p.row) });
  const syn = [];
  for (const c of loadCases()) {
    const rec = mkRec(c, mod); const h = headlineOf(rec, mod, c.question || "");
    const row = (op) => slim(rowOf(h, op));
    syn.push({ id: c.id, check: c.check, label: c.label, stratum: c.stratum, answer: c.answer, layout: h?.layout ?? null, fzNull: !mod.present.crossCheckOf(rec), headline: h?.text ?? null, bad: h?.bad ?? null, flag: h?.flag ?? null, total: h?.total ?? null, honestN: honestCount(h), notRunN: notRunCount(h), honest: honestText(h), DEF: row("DEF"), EVA: row("EVA"), REC: row("REC"), CON: row("CON"), SIG: row("SIG"), allStatus: h?.perRow.map((p) => [p.op, p.k, p.row.figure.status]) ?? null, defs: c.check === "DEF" ? defsDisplay(rec) : undefined });
  }
  const labels = loadLabels();
  const real = [];
  for (const r of loadReal()) {
    const rec = r.rec.grounding; let h = null, err = null;
    try { h = headlineOf(rec, mod, r.ask); } catch (e) { err = String(e).slice(0, 200); }
    real.push({ ask: r.ask, spoken: r.spoken, label: labels[r.ask] ?? null, err, layout: h?.layout ?? null, headline: h?.text ?? null, bad: h?.bad ?? null, flag: h?.flag ?? null, total: h?.total ?? null, honestN: honestCount(h), notRunN: notRunCount(h), honest: honestText(h), rows: h?.perRow?.map((p) => ({ op: p.op, k: p.k, st: p.st, found: [p.row.ground.found, p.row.figure.found, p.row.pattern.found], cls: rowClass(p.row) })) ?? null, defs: defsDisplay(rec), facing: { sources: (rec.facing?.sources || []).map((s) => ({ url: s.url, mark: s.mark })), response: rec.facing?.response, unsupported: rec.unsupported }, loop: rec.loop ? { passes: rec.loop.passes?.length ?? 0 } : null });
  }
  return { syn, real };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = await compute(process.argv[2] && process.argv[2] !== "-" ? process.argv[2] : undefined);
  fs.writeFileSync(path.join(HERE, process.argv[3] || "results.json"), JSON.stringify(out, null, 1));
  console.log("syn", out.syn.length, "real", out.real.length);
}
