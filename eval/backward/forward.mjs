// eval/backward/forward.mjs — the FORWARD side of docs/BACKWARDS-GROUNDING-PREREG.md, and the page ceiling.
// For every case turn with cached pages: (1) ceiling = the gold check on the pooled page text (what ANY extractor could reach);
// (2) forward = the recorded model answer of `default` (gemma2:2b), each sentence run through the working tree's gate against the
// pages that turn read; recall = the gold check on the GROUNDED sentences only (what the gate lets stand); also the check on the
// whole answer (what the model said, grounded or not) and the count of grounded / total sentences.
//   node eval/backward/forward.mjs [--label default] [--out eval/backward/forward.json]
import fs from "node:fs";
import path from "node:path";
import { here, root, CASES, turnPages, goldPass, LATIN_LANGS, NONLATIN_LANGS } from "./lib.mjs";
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf("--" + k); return i < 0 ? d : argv[i + 1]; };
const label = arg("label", "default");
const ground = await import(path.join(root, "fold-chat-ground.js"));
const STRATA = ["a_single", "b_numeric", "c_multihop", "e_multilingual"];
const rows = [];
for (const c of CASES.filter((x) => STRATA.includes(x.stratum))) {
  const tp = turnPages(label, c.id, 0);
  if (!tp) { rows.push({ id: c.id, stratum: c.stratum, lang: c.lang || "en", status: "no-run" }); continue; }
  const lang = c.lang || "en";
  if (!tp.pages.length) { rows.push({ id: c.id, stratum: c.stratum, lang, status: "no-pages", urls: tp.urls.length, missing: tp.missing }); continue; }
  const pooled = tp.pages.map((p) => p.text).join("\n\n");
  const ceiling = goldPass(c, 0, pooled);
  const material = tp.pages.map((p) => ({ ref: decodeURIComponent(p.url.split("/").pop() || p.url), source: p.url, text: p.text }));
  const cov = tp.answer.trim() ? ground.coverage(tp.answer, material) : { entries: [], grounded: 0, total: 0 };
  const groundedText = cov.entries.filter((e) => e.ref).map((e) => e.text).join(" ");
  rows.push({ id: c.id, stratum: c.stratum, lang, status: "ok", pages: tp.pages.length, missingPages: tp.missing, ceiling,
    forwardWholeAnswer: goldPass(c, 0, tp.answer), forwardGroundedRecall: goldPass(c, 0, groundedText),
    sentences: cov.total, grounded: cov.grounded, secs: tp.secs, answerChars: tp.answer.length });
}
const ok = rows.filter((r) => r.status === "ok");
const sum = (xs, f) => xs.reduce((a, x) => a + (f(x) ? 1 : 0), 0);
const grp = (name, xs) => ({ name, n: xs.length, ceiling: sum(xs, (r) => r.ceiling), forwardGroundedRecall: sum(xs, (r) => r.forwardGroundedRecall), forwardWhole: sum(xs, (r) => r.forwardWholeAnswer), sentences: xs.reduce((a, r) => a + r.sentences, 0), grounded: xs.reduce((a, r) => a + r.grounded, 0) });
const out = { at: new Date().toISOString(), label, groups: [
  grp("a+b+c", ok.filter((r) => ["a_single", "b_numeric", "c_multihop"].includes(r.stratum))),
  grp("a_single", ok.filter((r) => r.stratum === "a_single")), grp("b_numeric", ok.filter((r) => r.stratum === "b_numeric")), grp("c_multihop", ok.filter((r) => r.stratum === "c_multihop")),
  grp("e latin", ok.filter((r) => r.stratum === "e_multilingual" && LATIN_LANGS.has(r.lang))),
  grp("e non-latin", ok.filter((r) => r.stratum === "e_multilingual" && NONLATIN_LANGS.has(r.lang))),
], statusCounts: rows.reduce((m, r) => (m[r.status] = (m[r.status] || 0) + 1, m), {}), rows };
fs.writeFileSync(arg("out", path.join(here, "forward.json")), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ ...out, rows: undefined }, null, 1));
for (const r of rows) console.log(r.id.padEnd(24), r.status, r.status === "ok" ? `ceil=${r.ceiling} fwdGrounded=${r.forwardGroundedRecall} fwdWhole=${r.forwardWholeAnswer} sent=${r.sentences} grd=${r.grounded}` : "");
