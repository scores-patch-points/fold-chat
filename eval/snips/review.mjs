// review.mjs — a compact reading sheet per class so every output can be read by a person (the "read every output" step).
//   node eval/snips/review.mjs <class|id,id,...> [--chars 230]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const { asks } = JSON.parse(fs.readFileSync(path.join(here, "asks.json"), "utf8"));
const J = JSON.parse(fs.readFileSync(path.join(here, "judged.json"), "utf8")).rows; const jb = Object.fromEntries(J.map((r) => [r.id, r]));
const sel = process.argv[2]; const W = +(process.argv.includes("--chars") ? process.argv[process.argv.indexOf("--chars") + 1] : 230);
const want = asks.filter((a) => a.class === sel || sel.split(",").includes(a.id));
for (const a of want) {
  const f = path.join(here, "data", "out", a.id + ".json"); if (!fs.existsSync(f)) { console.log(`## ${a.id} (no output)`); continue; }
  const r = JSON.parse(fs.readFileSync(f, "utf8")); const j = jb[a.id] || {};
  console.log(`\n## ${a.id} [${a.language}] ${a.text}  | expect=${a.gold.expect} search=${r.search && r.search.transport} reads=${j.readsOk}/${j.readsTried} gap=${r.gap ? r.gap.kind : "-"} held=${j.held && j.held.answered} auto=${j.auto && j.auto.sat}`);
  if (r.resolution) console.log(`   resolved: ${r.resolution.reason} ${JSON.stringify(r.resolution.carried)}`);
  for (const s of r.strands.S1) {
    const gold = j.held && j.held.snips && j.held.snips.includes(s.id) ? "*GOLD*" : ""; const ar = (j.snipRel || []).find((x) => x.id === s.id); const mark = ar ? (ar.rel ? "+" : "-") : "?";
    const host = (s.site || "").slice(0, 28);
    const txt = s.text.replace(/\s+/g, " ").slice(0, W);
    console.log(`   ${mark} ${s.id} ${s.rung} ${s.chars}c ${host} ${gold} ${s.check && !s.check.exact ? "!!VERBATIM-FAIL" : ""}${s.check && s.check.entityResidue ? " [entity-residue]" : ""} :: ${txt}`);
  }
}
