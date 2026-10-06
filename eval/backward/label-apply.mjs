// eval/backward/label-apply.mjs — joins the hand verdicts for the backward arm's S1 sentences to the sentences themselves (quote beside each verdict) and
// computes B3. Verdict s = the sentence (or, for derived, its recomputed equation / the premise it rests on) says what answers or directly supports the ask;
// o = true to its source but does not bear on the ask (or, for a derived line, a wrong claim). The labeller is the agent that built the assembler; audit the file.
import fs from "node:fs";
import path from "node:path";
import { here, readJson } from "./lib.mjs";
const V = {
  "assembled-run1.json": { a2_austen: "ooo", a3_apollo_date: "oo", a4_fleming: "oso", a5_gold_symbol: "sso", a6_mona_lisa: "soo", b1_eiffel_feet: "soo", b2_everest_m: "soo", b3_mariana_ft: "sso", b4_iceland_pop: "soo", b5_light_kms: "oss", c1_oxford_harvard: "ooo", c2_eiffel_liberty: "ooo", c3_danube_rhine: "sso", c4_galileo_newton: "oso", c5_russia_canada: "oos", c6_apple_founders: "sso" },
  "assembled-run2.json": { a1_eiffel_year: "soo", a3_apollo_date: "ooo", a4_fleming: "sss", a5_gold_symbol: "sso", a6_mona_lisa: "soo", b1_eiffel_feet: "soo", b2_everest_m: "soo", b3_mariana_ft: "sso", b4_iceland_pop: "soo", b5_light_kms: "ssos", c3_danube_rhine: "sss", c5_russia_canada: "oos", c6_apple_founders: "sso" },
};
const out = {};
for (const [file, by] of Object.entries(V)) {
  const o = readJson(path.join(here, file));
  const rows = [];
  for (const r of o.rows.filter((x) => x.set === "S1" && x.sentences.length)) {
    const v = by[r.id]; if (!v || v.length !== r.sentences.length) throw new Error(`${file} ${r.id}: ${v?.length} verdicts for ${r.sentences.length} sentences`);
    r.sentences.forEach((s, i) => rows.push({ id: r.id, idx: i, how: s.how, verdict: v[i] === "s" ? "states" : "off", quote: s.text.slice(0, 160) }));
  }
  const states = rows.filter((x) => x.verdict === "states").length;
  const topK = (K) => { let n = 0, st = 0; for (const r of o.rows.filter((x) => x.set === "S1" && x.sentences.length)) { let vi = 0; for (const [i, s] of r.sentences.entries()) { if (s.how === "verbatim" && vi++ >= K) continue; n++; if (by[r.id][i] === "s") st++; } } return `${st}/${n} (${(100 * st / n).toFixed(1)}%)`; };
  out[file] = { states, sentences: rows.length, precision: `${states}/${rows.length} (${(100 * states / rows.length).toFixed(1)}%)`, sensitivity_topK_verbatim_plus_derived: { 1: topK(1), 2: topK(2), 3: topK(3) }, rows };
}
fs.writeFileSync(path.join(here, "labels-backward.json"), JSON.stringify(out, null, 1));
for (const [f, x] of Object.entries(out)) console.log(f, x.precision, JSON.stringify(x.sensitivity_topK_verbatim_plus_derived));
