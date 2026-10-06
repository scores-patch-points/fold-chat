// ctx.mjs — shows the text around the gold match of the gold-bearing snips (reading aid): node ctx.mjs id id ...
import fs from "node:fs";
const A = JSON.parse(fs.readFileSync(new URL("./asks.json", import.meta.url))).asks; const J = JSON.parse(fs.readFileSync(new URL("./judged.json", import.meta.url))).rows;
for (const id of process.argv.slice(2)) { const a = A.find((x) => x.id === id), r = J.find((x) => x.id === id); const o = JSON.parse(fs.readFileSync(new URL(`./data/out/${id}.json`, import.meta.url))); console.log("##", id, a.text);
  for (const s of o.strands.S1) { if (!(r.held.snips || []).includes(s.id)) continue; const re = new RegExp(a.gold.all[0], "iu"); const m = re.exec(s.text.normalize("NFKC")); const i = m ? m.index : 0; console.log("  ", s.id, s.site, "…" + s.text.slice(Math.max(0, i - 100), i + 130).replace(/\s+/g, " ") + "…"); } }
