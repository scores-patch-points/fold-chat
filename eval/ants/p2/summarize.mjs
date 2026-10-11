// summarize.mjs — one table over the stored results files (v1 HELD = the pre-registered run; the rest are post-hoc rounds), with Wilson intervals and the union metric
// (the answer is in the span OR in what the strand quotes: what the user can reach with the span first and the group one tap away).
import fs from "node:fs";
import { median, quantile } from "./score-lib.mjs";
const W = (k, n, z = 1.96) => { if (!n) return "n/a"; const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return `${(100 * p).toFixed(0)}% (${k}/${n}; ${(100 * Math.max(0, (c - m) / d)).toFixed(0)}-${(100 * Math.min(1, (c + m) / d)).toFixed(0)})`; };
const files = process.argv.slice(2);
for (const f of files) {
  const { rows } = JSON.parse(fs.readFileSync(new URL("./" + f, import.meta.url)));
  const ans = rows.filter((r) => r.answerable), un = rows.filter((r) => !r.answerable && !r.gapExpected);
  const gx = rows.filter((r) => r.gapExpected), non = rows.filter((r) => r.lang !== "en");
  const nonOK = non.filter((r) => (r.gapExpected ? r.gapOK : r.answerable ? (r.contains || !r.span) : r.gapOK));
  const hit = ans.filter((r) => r.contains), wrong = ans.filter((r) => r.span && !r.contains), union = ans.filter((r) => r.contains || r.strandContains);
  const prec = ans.map((r) => r.precision), sprec = ans.map((r) => r.strandPrecision);
  console.log(`\n## ${f}  (asks ${rows.length}: answerable ${ans.length}, unanswerable ${un.length}, typed-gap-expected ${gx.length})`);
  console.log(`span contains answer      ${W(hit.length, ans.length)}`);
  console.log(`strand contains answer    ${W(ans.filter((r) => r.strandContains).length, ans.length)}   (primary page only: ${W(ans.filter((r) => r.strandPrimaryContains).length, ans.length)})`);
  console.log(`union (span or strand)    ${W(union.length, ans.length)}`);
  console.log(`median precision, all     span ${median(prec).toFixed(3)}   strand ${median(sprec).toFixed(3)}   (primary-only strand ${median(ans.map((r) => r.strandPrimaryPrecision)).toFixed(3)})`);
  console.log(`median precision, hits    span ${median(hit.map((r) => r.precision)).toFixed(3)}   strand ${median(ans.filter((r) => r.strandContains).map((r) => r.strandPrecision)).toFixed(3)}`);
  console.log(`precision p10/p25/p50/p75/p90 span ${[.1, .25, .5, .75, .9].map((q) => quantile(prec, q).toFixed(2)).join("/")}   strand ${[.1, .25, .5, .75, .9].map((q) => quantile(sprec, q).toFixed(2)).join("/")}`);
  console.log(`typed gap on unanswerable ${W(un.filter((r) => r.gapOK).length, un.length)}   (strand shipped something on ${un.filter((r) => r.strandShipped).length}/${un.length})`);
  console.log(`confident-wrong (span lacks the answer) ${W(wrong.length, ans.length)}   gap on answerable ${W(ans.filter((r) => !r.span).length, ans.length)}`);
  console.log(`minimal (clause-removal)  ${W(ans.filter((r) => r.minimal === true).length, hit.length)} of hits   fragments(<0.6 min) ${ans.filter((r) => r.fragment).length}`);
  console.log(`non-English contain-or-typed-gap ${W(nonOK.length, non.length)}   typed gap where no table ${gx.filter((r) => r.gapOK).length}/${gx.length}`);
  console.log(`median chars shown span ${median(ans.filter((r) => r.span).map((r) => r.span.shown.length))} vs strand ${median(ans.map((r) => r.strand.chars))}`);
}
