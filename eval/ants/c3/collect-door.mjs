// eval/ants/c3/collect-door.mjs — real calls to the Fold server's khora read door for every claim, sentence and claim+sentence of the C3 battery. Raw responses are stored; scoring happens in score-door.mjs.
//   node eval/ants/c3/collect-door.mjs [base]   (default http://127.0.0.1:8815/heimdall)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const SET = process.env.C3_SET ? "-" + process.env.C3_SET : "";   // C3_SET=cf → the counterfactual control (battery-cf.json, results-*-cf.json)
const base = process.argv[2] || "http://127.0.0.1:8815/heimdall";
const battery = JSON.parse(fs.readFileSync(path.join(here, `battery${SET}.json`), "utf8"));
async function read(text) {
  const r = await fetch(base + "/api/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
  if (!r.ok) throw new Error("door " + r.status + " " + (await r.text()).slice(0, 120));
  return r.json();
}
const out = { at: new Date().toISOString(), base, pairs: [] };
for (const p of battery.pairs) {
  const rec = { id: p.id };
  rec.claim = await read(p.claim);
  rec.sentence = await read(p.sentence);
  rec.joint = await read(p.sentence + " " + p.claim);
  out.pairs.push(rec);
}
fs.writeFileSync(path.join(here, `door-raw${SET}.json`), JSON.stringify(out, null, 1));
const n = (x) => (x.relations || []).length;
console.log("pairs", out.pairs.length, "relations claim/sentence/joint:", out.pairs.map((r) => `${r.id}:${n(r.claim)}/${n(r.sentence)}/${n(r.joint)}`).join(" "));
console.log("referents (claim,sentence,joint) total:", out.pairs.reduce((a, r) => a + (r.claim.referents || []).length + (r.sentence.referents || []).length + (r.joint.referents || []).length, 0));
console.log("stagesNotRun", JSON.stringify(out.pairs[0].claim.stagesNotRun), "sentences field:", JSON.stringify(out.pairs[0].claim.sentences));
