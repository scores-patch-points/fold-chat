// F2: recompute the three rows on REAL stored turn records (real/r*.json, produced by collect-real.mjs) and compare with the page's own text.
//   node eval/ants/falsify-checks/f2/real-report.mjs [--labels]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rowsOf, P } from "./build.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(HERE, "real");
const out = [];
for (const f of fs.readdirSync(dir).filter((x) => /^r\d+\.json$/.test(x)).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const rec = j.grounding;
  if (!rec || !rec.facing) { out.push({ f, q: j.q, note: "no facing record", flagText: j.flagText, spoken: j.spoken }); continue; }
  let rows, pres; try { rows = rowsOf(rec); pres = P.presentationOf(rec); } catch (e) { out.push({ f, q: j.q, note: "rowsOf threw " + e.message }); continue; }
  out.push({ f, q: j.q, spoken: j.spoken, layout: pres?.layout, drawn: !!(pres && pres.layout !== "creative" && pres.layout !== "unsupported"), flagText: j.flagText, mine: `${rows._failCount} failed / ${rows._flagCount} flagged`, SEG: rows.SEG, CON: rows.CON, SYN: rows.SYN, unsupported: rec.unsupported, nSources: (rec.facing.sources || []).length, levels: ((rec.tape || []).find((e) => e.kind === "check" && e.k === 6)?.checks || []).map((c) => c.meaning?.level) });
}
fs.writeFileSync(path.join(HERE, "real-report.json"), JSON.stringify(out, null, 1));
for (const o of out) console.log(o.f, "|", o.q, "|", (o.spoken || "").slice(0, 100).replace(/\n/g, " "), "\n   layout:", o.layout, "page:", (o.flagText || []).join(";"), "| mine:", o.mine, o.note || "", "\n   SEG", o.SEG && `${o.SEG.fig}/${o.SEG.shown} ${o.SEG.found}`, "\n   CON", o.CON && `${o.CON.fig}/${o.CON.shown} ${o.CON.found}`, "\n   SYN", o.SYN && `${o.SYN.fig}/${o.SYN.shown} ${o.SYN.found}`, "\n   unsupported", JSON.stringify(o.unsupported), "levels", JSON.stringify(o.levels));
