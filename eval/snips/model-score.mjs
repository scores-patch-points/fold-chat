// model-score.mjs — scores data/model/*.json (the app's gemma2:2b path) against the same gold, next to the snip strand's final label on the same asks.
//   automatic: gold regexes on the answer text (strandwide: all must appear), void/typed-gap detection, the app's own per-sentence grounding (ungrounded sentences,
//   unsupported numbers/names). My reading (model-reading.txt: id | y/n/void | fabricated sentences | reason) is merged when present.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gnorm, wilson, pct } from "./lib/text.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const { asks } = JSON.parse(fs.readFileSync(path.join(here, "asks.json"), "utf8"));
const J = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(here, "judged.json"), "utf8")).rows.map((r) => [r.id, r]));
const subset = JSON.parse(fs.readFileSync(path.join(here, "subset.json"), "utf8")).ids;
const reading = {}; const rf = path.join(here, "model-reading.txt");
if (fs.existsSync(rf)) for (const l of fs.readFileSync(rf, "utf8").split("\n")) { if (!l.trim() || l.startsWith("#")) continue; const [id, ok, fab, ...why] = l.split("|").map((x) => x.trim()); reading[id] = { ok, fab: +fab || 0, why: why.join("|") }; }
const re = (s) => new RegExp(s, "iu");
const rows = [];
for (const id of subset) {
  const f = path.join(here, "data", "model", id + ".json"); if (!fs.existsSync(f)) continue;
  const m = JSON.parse(fs.readFileSync(f, "utf8")); const a = asks.find((x) => x.id === id); const g = a.gold;
  const ans = gnorm(m.answer || ""); const void_ = !ans.trim() || (m.grounding && m.grounding.void && !m.grounding.hasMaterial);
  const sentences = (m.grounding && m.grounding.coverage && m.grounding.coverage.total) || 0; const grounded = (m.grounding && m.grounding.coverage && m.grounding.coverage.grounded) || 0;
  const unsup = m.grounding && m.grounding.unsupported ? m.grounding.unsupported.numbers.length + m.grounding.unsupported.names.length : 0;
  const autoGold = g.expect === "answer" ? g.all.every((x) => re(x).test(ans)) && ans.trim().length > 0 : null;
  const r = reading[id];
  rows.push({ id, class: a.class, expect: g.expect, secs: m.secs, attempts: (m.attempts || []).length, firstAttemptVoid: m.firstAttempt && m.firstAttempt.voidKind, void: !!void_, answerChars: ans.length, sentences, groundedSentences: grounded, ungrounded: sentences - grounded, unsupportedAtoms: unsup, autoGold, reading: r || null, snipFinal: J[id] && J[id].final.sat, snipChars: J[id] && J[id].chars, snipNetMs: J[id] && J[id].netMs });
}
fs.writeFileSync(path.join(here, "model-scored.json"), JSON.stringify(rows, null, 1));
const ans = rows.filter((r) => r.expect === "answer"), gp = rows.filter((r) => r.expect !== "answer");
const modelOk = (r) => (r.reading ? r.reading.ok === "y" : r.autoGold === true);
const snipOk = (r) => /^yes/.test(r.snipFinal || "");
const L = [];
L.push(`model path: ${rows.length} asks run; answer-expected ${ans.length}, gap-expected ${gp.length}; reading merged for ${rows.filter((r) => r.reading).length}`);
L.push(`MODEL answered correctly (answer-expected): ${pct(wilson(ans.filter(modelOk).length, ans.length))}; gold-regex only: ${pct(wilson(ans.filter((r) => r.autoGold).length, ans.length))}; typed void/empty: ${ans.filter((r) => r.void).length}`);
L.push(`SNIP strand satisfied (same asks): ${pct(wilson(ans.filter(snipOk).length, ans.length))}`);
L.push(`both: ${ans.filter((r) => modelOk(r) && snipOk(r)).length}; model only: ${ans.filter((r) => modelOk(r) && !snipOk(r)).map((r) => r.id).join(",")}; snip only: ${ans.filter((r) => !modelOk(r) && snipOk(r)).map((r) => r.id).join(",")}; neither: ${ans.filter((r) => !modelOk(r) && !snipOk(r)).map((r) => r.id).join(",")}`);
const fab = rows.filter((r) => !r.void); L.push(`fabrication (my reading, sentences with no source support): ${rows.reduce((n, r) => n + (r.reading ? r.reading.fab : 0), 0)} sentences across ${rows.filter((r) => r.reading && r.reading.fab > 0).length} of ${fab.length} non-void answers; app gate: ungrounded sentences ${rows.reduce((n, r) => n + r.ungrounded, 0)} of ${rows.reduce((n, r) => n + r.sentences, 0)}`);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
L.push(`time: model path median ${med(rows.map((r) => r.secs))} s per ask (incl. retries? no: last attempt only); snip mode network median ${med(rows.map((r) => r.snipNetMs / 1000).filter((x) => x))} s + snipping compute`);
L.push(`gap-expected: model typed void/empty on ${gp.filter((r) => r.void).length}/${gp.length}`);
fs.writeFileSync(path.join(here, "model-analysis.md"), L.join("\n") + "\n"); console.log(L.join("\n"));
