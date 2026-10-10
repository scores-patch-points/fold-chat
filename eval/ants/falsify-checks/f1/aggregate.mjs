// Load every cases/*.json, score each with the REAL falsifiersOf, and aggregate per check / group / origin.
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import { fileURLToPath } from "node:url";
import { recOf } from "./mkrec.mjs"; import { scoreRec } from "./score.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CHECKS = ["NUL", "SIG", "INS"];
// groups reported separately and kept OUT of the pre-registered "core" catch rate (the prereg lists their scope as grey / out of the named defect list)
export const SEPARATE = new Set(["nul-lowercase-entity", "ins-misattributed", "clean-quote-far"]);
export function loadCases() {
  const dir = path.join(HERE, "cases"), all = [], hashes = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) { const raw = fs.readFileSync(path.join(dir, f)); hashes[f] = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16); all.push(...JSON.parse(raw)); }
  return { cases: all, hashes };
}
export function run() {
  const { cases, hashes } = loadCases();
  const rows = cases.map((c) => { let sc; try { sc = scoreRec(c.rec || recOf(c)); } catch (e) { sc = { error: String(e) }; } return { id: c.id, origin: c.origin, group: c.group, topic: c.topic, labels: c.labels, answer: c.answer, note: c.note, sc }; });
  return { rows, hashes };
}
const rate = (xs, f) => xs.length ? +(xs.filter(f).length / xs.length).toFixed(3) : null;
export function summarise(rows) {
  const out = {};
  for (const ck of CHECKS) {
    const lab = (l) => rows.filter((r) => r.labels[ck] === l && r.sc[ck]);
    const clean = lab("clean"), defect = lab("defect");
    const core = defect.filter((r) => !SEPARATE.has(r.group)), cleanCore = clean.filter((r) => !SEPARATE.has(r.group));
    const grp = {};
    for (const r of [...clean, ...defect]) { const g = (grp[r.group] ||= { label: r.labels[ck], n: 0, figFlag: 0, headFlag: 0, figStatuses: {} }); g.n++; if (r.sc[ck].figureFlag) g.figFlag++; if (r.sc[ck].headlineFlag) g.headFlag++; g.figStatuses[r.sc[ck].figure] = (g.figStatuses[r.sc[ck].figure] || 0) + 1; }
    const byOrigin = {};
    for (const o of [...new Set(rows.map((r) => r.origin))]) { const c = clean.filter((r) => r.origin === o), d = defect.filter((r) => r.origin === o); byOrigin[o] = { nClean: c.length, nDefect: d.length, falseFlagFigure: rate(c, (r) => r.sc[ck].figureFlag), falseFlagHeadline: rate(c, (r) => r.sc[ck].headlineFlag), catchFigure: rate(d, (r) => r.sc[ck].figureFlag), catchHeadline: rate(d, (r) => r.sc[ck].headlineFlag) }; }
    out[ck] = {
      nClean: clean.length, nDefect: defect.length, nDefectCore: core.length,
      canPassHeadline: clean.some((r) => !r.sc[ck].headlineFlag), canPassFigure: clean.some((r) => !r.sc[ck].figureFlag),
      witnessHeadline: (clean.find((r) => !r.sc[ck].headlineFlag) || {}).id || null,
      falseFlagFigure: rate(clean, (r) => r.sc[ck].figureFlag), falseFlagHeadline: rate(clean, (r) => r.sc[ck].headlineFlag),
      catchFigureAll: rate(defect, (r) => r.sc[ck].figureFlag), catchHeadlineAll: rate(defect, (r) => r.sc[ck].headlineFlag),
      catchFigureCore: rate(core, (r) => r.sc[ck].figureFlag), catchHeadlineCore: rate(core, (r) => r.sc[ck].headlineFlag),
      groups: grp, byOrigin,
    };
  }
  const cleanAll = rows.filter((r) => CHECKS.some((c) => r.labels[c] === "clean") && r.sc.nineFlagged != null);
  out.nineFlaggedOnClean = { n: cleanAll.length, mean: +(cleanAll.reduce((a, r) => a + r.sc.nineFlagged, 0) / (cleanAll.length || 1)).toFixed(2), zeroFlagged: cleanAll.filter((r) => r.sc.nineFlagged === 0).length };
  return out;
}
if (import.meta.url === new URL(process.argv[1], "file://").href) {
  const { rows, hashes } = run(); const sum = summarise(rows);
  fs.writeFileSync(path.join(HERE, "results.json"), JSON.stringify({ at: new Date().toISOString(), hashes, summary: sum, rows }, null, 1));
  console.log(JSON.stringify({ hashes, summary: sum }, null, 1).slice(0, 12000));
}
