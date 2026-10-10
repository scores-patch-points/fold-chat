// taxonomy.mjs <dev|held> — breaks results-<set>.json down by ask type and language, and classifies every miss and every imperfect hit (error taxonomy), all by code.
import fs from "node:fs";
import { passagesOf } from "./asks-lib.mjs";
import { containsKey, median } from "./score-lib.mjs";
import { fold } from "../../../fold-chat-mind.js";
const set = process.argv[2] || "held";
const asks = new Map((set === "dev" ? (await import("./asks-dev.mjs")).DEV : set === "h2" ? (await import("./asks-h2.mjs")).H2 : set === "h3" ? (await import("./asks-h3.mjs")).H3 : (await import("./asks-held.mjs")).HELD).map((a) => [a.id, a]));
const res = JSON.parse(fs.readFileSync(new URL(`./results-${set}.json`, import.meta.url)));
const rows = res.rows; const pct = (n, d) => (d ? (100 * n / d).toFixed(0) + "%" : "n/a"); const f2 = (x) => (x == null ? "n/a" : x.toFixed(2));
const out = { set, byType: {}, byLang: {}, misses: [], imperfect: { pronounUnresolved: [], noSubject: [], overWide: [], fragment: [] }, counts: {} };
for (const type of [...new Set(rows.map((r) => r.type))]) {
  const rs = rows.filter((r) => r.type === type && r.answerable);
  if (type === "unanswerable") { const u = rows.filter((r) => r.type === type); out.byType[type] = { n: u.length, gap: u.filter((r) => r.gapOK).length, strandShipped: u.filter((r) => r.strandShipped).length }; continue; }
  out.byType[type] = { n: rs.length, contains: rs.filter((r) => r.contains).length, strandContains: rs.filter((r) => r.strandContains).length, gap: rs.filter((r) => !r.span).length, precisionMedian: median(rs.map((r) => r.precision)), strandPrecisionMedian: median(rs.map((r) => r.strandPrecision)) };
}
for (const lang of [...new Set(rows.map((r) => r.lang))]) { const rs = rows.filter((r) => r.lang === lang); out.byLang[lang] = { n: rs.length, outcomes: rs.map((r) => (r.gapExpected ? (r.gapOK ? "gap-ok" : "WRONG-SPAN") : r.answerable ? (r.contains ? "contains" : r.span ? "WRONG" : "gap") : (r.gapOK ? "gap-ok" : "WRONG-SPAN"))) }; }
const classes = {};
for (const r of rows.filter((x) => x.answerable && !x.contains)) {
  const a = asks.get(r.id); const ps = passagesOf(a); const primary = ps[0].text.replace(/\s+/g, " ");
  const keyOnPrimary = containsKey(primary, a);
  let cls, why = "";
  if (!r.span) { cls = "gap on an answerable ask (the ask's words or type did not match: synonym, unsupported measure noun, low coverage)"; }
  else {
    const inSentence = containsKey(r.span.sentence, a);
    if (inSentence) { cls = "right sentence, wrong atom or clause (the figure/name chosen inside it is not the answer, or the trim cut the answer off)"; }
    else if (r.span.p !== 0) { cls = "wrong page (a distractor passage supplied the span)"; }
    else { cls = "wrong sentence on the right page (a sentence that matches the ask's words better than the one that states the answer)"; }
    if (a.type === "reason") cls += " [reason: the page states it with a different verb/noun than the ask]";
  }
  (classes[cls] ||= []).push(r.id); out.misses.push({ id: r.id, q: r.q, class: cls, shipped: r.span ? r.span.shown.slice(0, 140) : null, keyOnPrimary });
}
out.counts = Object.fromEntries(Object.entries(classes).map(([k, v]) => [k, v]));
for (const r of rows.filter((x) => x.answerable && x.contains && x.span)) {
  const a = asks.get(r.id); const sh = r.span.shown;
  if (/^(?:It|He|She|They|This|Its|His|Her|Their|Elle|Il|Su)\b/.test(sh)) out.imperfect.pronounUnresolved.push(r.id);
  const terms = a.q.toLowerCase().match(/\p{L}{4,}/gu) || [];
  if (!terms.some((t) => fold(sh).includes(fold(t).slice(0, 5)))) out.imperfect.noSubject.push(r.id);
  if (sh.length > 2 * a.min.length) out.imperfect.overWide.push(r.id);
  if (sh.length < 0.6 * a.min.length) out.imperfect.fragment.push(r.id);
}
fs.writeFileSync(new URL(`./taxonomy-${set}.json`, import.meta.url), JSON.stringify(out, null, 1));
console.log("BY TYPE (answerable): n | span contains | strand contains | gaps | median precision (span / strand)");
for (const [t, v] of Object.entries(out.byType)) console.log(t.padEnd(13), t === "unanswerable" ? `n=${v.n} gap=${v.gap} strandShipped=${v.strandShipped}` : `${v.n} | ${v.contains} (${pct(v.contains, v.n)}) | ${v.strandContains} (${pct(v.strandContains, v.n)}) | ${v.gap} | ${f2(v.precisionMedian)} / ${f2(v.strandPrecisionMedian)}`);
console.log("\nBY LANGUAGE:"); for (const [l, v] of Object.entries(out.byLang)) console.log(l.padEnd(4), v.n, v.outcomes.join(","));
console.log("\nMISSES by class:"); for (const [k, v] of Object.entries(classes)) console.log(v.length, k, "->", v.join(" "));
console.log("\nIMPERFECT HITS:", Object.fromEntries(Object.entries(out.imperfect).map(([k, v]) => [k, v.length + " " + v.join(",")])));
