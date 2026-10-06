// eval/backward/identity.mjs — S8 of docs/BACKWARDS-GROUNDING-PREREG.md: sentence identity by consequence on the frozen pairs.
//   node eval/backward/identity.mjs [--out eval/backward/identity-run1.json]
import fs from "node:fs";
import path from "node:path";
import { here, root, readJson } from "./lib.mjs";
const argv = process.argv.slice(2);
const out = argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : path.join(here, "identity-run.json");
const m = await import(path.join(root, "fold-chat-assemble.js"));
const P = readJson(path.join(here, "identity-pairs.json"));
const pages = P.ground.map((g) => ({ ref: g.ref, url: "https://example.test/" + g.ref, text: g.text }));
const rows = [];
for (const k of ["same", "different", "hard", "crossLanguage"]) for (const [a, b] of P[k]) {
  const r = m.sameClaim(a, b, pages);
  rows.push({ class: k, a, b, verdict: r.verdict, why: r.why || null, detail: r.detail || null, atomsA: r.a.atoms, atomsB: r.b.atoms });
}
const n = (k, f) => rows.filter((r) => r.class === k && f(r.verdict)).length;
const summary = {
  same_decided_same: `${n("same", (v) => v === "same")}/${P.same.length}`,
  different_decided_same: `${n("different", (v) => v === "same")}/${P.different.length}`,
  different_decided_different_or_undecidable: `${n("different", (v) => v !== "same")}/${P.different.length}`,
  hard_decided_same: `${n("hard", (v) => v === "same")}/${P.hard.length}`,
  crossLanguage_undecidable: `${n("crossLanguage", (v) => v === "undecidable")}/${P.crossLanguage.length}`,
  B11: n("same", (v) => v === "same") >= 5 && n("different", (v) => v === "same") === 0 && n("hard", (v) => v === "same") === 0 && n("crossLanguage", (v) => v === "undecidable") === P.crossLanguage.length,
};
fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), summary, rows }, null, 1));
console.log(JSON.stringify(summary, null, 1));
