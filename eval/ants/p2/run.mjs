// run.mjs <dev|held> [--strand-only] — scores answerSpan and the CURRENT strand (snipsOf) on the same passages; writes eval/ants/p2/results-<set>.json
import fs from "node:fs";
import { passagesOf, validate } from "./asks-lib.mjs";
import { answerSpan, verifyRewrite, classifyAsk, shownText } from "../../../fold-chat-answerspan.js";
import { snipsOf } from "../../../fold-chat-strand.js";
import { containsKey, precisionOf, median, quantile, isMinimal } from "./score-lib.mjs";
const set = process.argv[2] || "dev";
const asks = set === "dev" ? (await import("./asks-dev.mjs")).DEV : set === "h2" ? (await import("./asks-h2.mjs")).H2 : set === "h3" ? (await import("./asks-h3.mjs")).H3 : (await import("./asks-held.mjs")).HELD;
const norm = (s) => String(s).replace(/\s+/g, " ").trim();
const rows = [];
for (const a of asks) {
  const errs = validate(a); if (errs.length) { console.error("BAD ASK", a.id, errs); process.exit(2); }
  const ps = passagesOf(a);
  const t0 = Date.now(); const r = answerSpan(a.q, ps); const ms = Date.now() - t0;
  const sn = process.argv.includes("--no-strand") ? { snips: [] } : snipsOf(ps, a.q);
  const strandAll = sn.snips.map((x) => x.text).join("\n");
  const strandPrimary = sn.snips.filter((x) => x.p === 0).map((x) => x.text).join("\n");
  const best = r.spans[0] || null; const shown = best ? best.shown : "";
  const answerable = a.answerable !== false && !a.gapExpected;
  const row = { id: a.id, type: a.type, lang: a.lang || "en", q: a.q, answerable, ask: r.ask.want, ms,
    span: best ? { shown, verbatim: best.text, conf: best.confidence, kind: best.kind, p: best.passageIndex, why: best.why.slice(-6), sentence: best.sentence.text } : null, gap: r.gap ? r.gap.kind : null,
    strand: { chars: strandAll.length, primaryChars: strandPrimary.length, n: sn.snips.length } };
  if (best) {
    const ver = best.rewrite ? verifyRewrite(best.rewrite, ps[best.passageIndex]) : { ok: norm(ps[best.passageIndex].text).includes(norm(best.text)) || (best.item && true) };
    row.verified = !!ver.ok; row.verifyReason = ver.reason || "";
  }
  if (answerable) {
    row.span && (row.contains = containsKey(shown, a)); row.containsVerbatim = best ? containsKey(best.text, a) : false;
    row.strandContains = containsKey(strandAll, a); row.strandPrimaryContains = containsKey(strandPrimary, a);
    row.precision = row.span && row.contains ? precisionOf(a, shown) : 0;
    row.strandPrecision = row.strandContains ? precisionOf(a, strandAll) : 0; row.strandPrimaryPrecision = row.strandPrimaryContains ? precisionOf(a, strandPrimary) : 0;
    row.precisionContained = row.contains ? precisionOf(a, shown) : null;
    row.fragment = row.span && row.contains ? shown.length < 0.6 * a.min.length : false;
    row.minimal = row.contains ? isMinimal(best, a.key, []) : null;
    row.wrongConfident = !!row.span && !row.contains;
    row.sizeRatio = row.span && row.contains ? shown.length / a.min.length : null;
  } else { row.gapOK = !best; row.strandShipped = strandAll.length > 0; row.gapExpected = !!a.gapExpected; }
  rows.push(row);
}
const ans = rows.filter((r) => r.answerable), un = rows.filter((r) => !r.answerable && !r.gapExpected), gx = rows.filter((r) => r.gapExpected);
const non = rows.filter((r) => r.lang !== "en");
const outcomeOf = (r) => (r.gapExpected ? (r.gapOK ? "gap-ok" : "WRONG-SPAN") : r.answerable ? (r.contains ? "contains" : r.span ? "WRONG" : "gap") : (r.gapOK ? "gap-ok" : "WRONG-SPAN"));
const nonOK = (r) => (r.gapExpected ? r.gapOK : r.answerable ? (r.contains || !r.span) : r.gapOK);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const f = (x) => (x == null ? "n/a" : x.toFixed(3));
const summary = {
  nonEnglish: {
    n: non.length, containOrTypedGap: non.filter(nonOK).length / (non.length || 1),
    confidentWrong: non.filter((r) => (r.answerable && r.wrongConfident) || (!r.answerable && !r.gapOK)).length / (non.length || 1),
    byLang: Object.fromEntries([...new Set(non.map((r) => r.lang))].map((l) => [l, non.filter((r) => r.lang === l).map(outcomeOf)])),
  },
  gapExpectedOK: gx.length ? gx.filter((r) => r.gapOK).length + "/" + gx.length : null,
  set, n: rows.length, answerable: ans.length, unanswerable: un.length,
  containment: ans.filter((r) => r.contains).length / ans.length, strandContainment: ans.filter((r) => r.strandContains).length / ans.length, strandPrimaryContainment: ans.filter((r) => r.strandPrimaryContains).length / ans.length,
  precisionMedianAll: median(ans.map((r) => r.precision)), precisionMedianContained: median(ans.filter((r) => r.contains).map((r) => r.precision)),
  strandPrecisionMedianAll: median(ans.map((r) => r.strandPrecision)), strandPrecisionMedianContained: median(ans.filter((r) => r.strandContains).map((r) => r.strandPrecision)),
  strandPrimaryPrecisionMedianAll: median(ans.map((r) => r.strandPrimaryPrecision)), strandPrimaryPrecisionMedianContained: median(ans.filter((r) => r.strandPrimaryContains).map((r) => r.strandPrimaryPrecision)),
  precisionQuartiles: [0.1, 0.25, 0.5, 0.75, 0.9].map((q) => quantile(ans.map((r) => r.precision), q)), strandPrecisionQuartiles: [0.1, 0.25, 0.5, 0.75, 0.9].map((q) => quantile(ans.map((r) => r.strandPrecision), q)),
  gapOnUnanswerable: un.filter((r) => r.gapOK).length / (un.length || 1), strandShippedOnUnanswerable: un.filter((r) => r.strandShipped).length / (un.length || 1),
  wrongConfident: ans.filter((r) => r.wrongConfident).length / ans.length, gapOnAnswerable: ans.filter((r) => !r.span).length / ans.length,
  minimal: ans.filter((r) => r.minimal === true).length / (ans.filter((r) => r.contains).length || 1), fragmentShare: ans.filter((r) => r.fragment).length / (ans.filter((r) => r.contains).length || 1),
  verified: rows.filter((r) => r.span).every((r) => r.verified), verifiedN: rows.filter((r) => r.span && r.verified).length + "/" + rows.filter((r) => r.span).length,
  medianShownChars: median(ans.filter((r) => r.span).map((r) => r.span.shown.length)), medianStrandChars: median(ans.map((r) => r.strand.chars)), medianMs: median(rows.map((r) => r.ms)),
};
fs.writeFileSync(new URL(`./results-${set}.json`, import.meta.url), JSON.stringify({ summary, rows }, null, 1));
console.log(JSON.stringify(summary, null, 1));
for (const r of rows) { const bad = r.answerable ? !r.contains : !r.gapOK; if (bad) console.log(`MISS ${r.id} [${r.type}] ${r.q}\n   -> ${r.span ? JSON.stringify(r.span.shown.slice(0, 160)) + " c=" + r.span.conf : "GAP " + r.gap}`); }
