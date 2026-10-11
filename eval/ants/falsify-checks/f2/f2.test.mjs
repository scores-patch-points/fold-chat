// F2: falsify checks 4 SEG, 5 CON, 6 SYN of falsifiersOf. Each test() is one pre-registered claim (eval/ants/F2-PREREG.md).
// A FAILING test = that claim is FALSIFIED. Writes results.json (every case with every row's status) next to this file.
//   node --test eval/ants/falsify-checks/f2/f2.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recordOf, rowsOf, P } from "./build.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const C = JSON.parse(fs.readFileSync(path.join(HERE, "cases.json"), "utf8"));
C.cases.push(...JSON.parse(fs.readFileSync(path.join(HERE, "cases-addC.json"), "utf8")).cases);   // Addendum C
const SHAPES = ["A", "B"];   // A = tape has k6 meaning checks; B = no k6 (the shape real turns have)
const run = (shape) => C.cases.map((c) => {
  const material = c.mat.map((k) => C.materials[k]);
  const rec = recordOf({ answer: c.answer, material }, { agreement: c.agreement || null, k6: shape === "A" });
  const rows = rowsOf(rec);
  const pres = P.presentationOf(rec);
  const mc = (rec.tape.find((e) => e.kind === "check" && e.k === 6) || {}).checks || [];
  return { shape, id: c.id, check: c.check, label: c.label, kind: c.kind, answer: c.answer, row: rows[c.check], flagCount: rows._flagCount, failCount: rows._failCount, layout: pres?.layout || null, levels: mc.map((m) => m.meaning?.level), unsupported: rec.unsupported, agreement: rec.agreement ? rec.agreement.groups.map((g) => g.label) : null, conRow: rows.CON, sygRow: rows.SYN };
});
const ALL = Object.fromEntries(SHAPES.map((s) => [s, run(s)]));
fs.writeFileSync(path.join(HERE, "results-both-shapes.json"), JSON.stringify(ALL, null, 1));
for (const SHAPE of SHAPES) {
const results = ALL[SHAPE];
const sel = (check, f = () => true) => results.filter((r) => r.check === check && f(r));
const rate = (xs, pred) => (xs.length ? xs.filter(pred).length / xs.length : NaN);
const flagged = (r) => r.row.shown !== "clear";
const failed = (r) => r.row.shown === "failed";
const held = (r) => r.row.fig === "held";
const pct = (x) => (100 * x).toFixed(0) + "%";
const list = (xs) => xs.map((r) => `${r.id}[${r.row.fig}/${r.row.shown}] ${r.row.found}`).join(" || ");

test(`[${SHAPE}] SEG S1 passable: held on >=70% of clean-with-a-date; flagged <=20% of all clean`, () => {
  const clean = sel("SEG", (r) => r.label === "clean"), dated = clean.filter((r) => /\d/.test(r.answer));
  const h = rate(dated, held), f = rate(clean, flagged);
  console.log(`[${SHAPE}] S1 held-on-dated ${pct(h)} (${dated.filter(held).length}/${dated.length}); clean false-flag ${pct(f)} (${clean.filter(flagged).length}/${clean.length}); flagged: ${list(clean.filter(flagged))}`);
  assert.ok(h >= 0.7, `held on dated clean = ${pct(h)}`); assert.ok(f <= 0.2, `clean false-flag = ${pct(f)}`);
});
for (const [id, kinds, min, label] of [["S2b", ["reused-figure"], 0.5, "source figure on the wrong event"], ["S2", ["wrong-year", "wrong-figure"], 0.7, "wrong date/year/figure"], ["S3", ["wrong-place", "wrong-entity"], 0.7, "wrong place / entity"], ["S4", ["stale"], 0.5, "stale fact"]]) {
  test(`[${SHAPE}] SEG ${id} catch ${label} >= ${min * 100}%`, () => {
    const d = sel("SEG", (r) => r.label === "defect" && kinds.includes(r.kind)), c = rate(d, flagged);
    console.log(`[${SHAPE}] ${id} catch ${pct(c)} (${d.filter(flagged).length}/${d.length}); missed: ${list(d.filter((r) => !flagged(r)))}`);
    assert.ok(c >= min, `${id} catch = ${pct(c)}`);
  });
}
test(`[${SHAPE}] SEG S5 not vacuous: >=90% of held rows have a date/figure in the answer`, () => {
  const h = sel("SEG", held), withFig = h.filter((r) => /\d/.test(r.answer)), v = withFig.length / h.length;
  console.log(`[${SHAPE}] S5 held ${h.length}, with a figure ${withFig.length} (${pct(v)}); vacuous holds: ${h.filter((r) => !/\d/.test(r.answer)).map((r) => r.id + (r.label === "defect" ? "(DEFECT)" : "")).join(",")}`);
  assert.ok(v >= 0.9, `non-vacuous = ${pct(v)}`);
});
test(`[${SHAPE}] SEG S6 truthful: no failure produced by a figure the sources state`, () => {
  const bad = sel("SEG", failed).filter((r) => r.label === "clean");
  console.log(`[${SHAPE}] S6 clean answers SEG failed on: ${bad.map((r) => `${r.id} ${r.kind} nums=${JSON.stringify(r.unsupported.numbers)}`).join(" | ")}`);
  assert.equal(bad.length, 0, `${bad.length} clean answers failed SEG`);
});

test(`[${SHAPE}] CON C1 passable: held >=50% and flagged <=20% of clean`, () => {
  const clean = sel("CON", (r) => r.label === "clean" && !/^agreement/.test(r.kind)), h = rate(clean, held), f = rate(clean, flagged);
  console.log(`[${SHAPE}] C1 held ${pct(h)} (${clean.filter(held).length}/${clean.length}); false-flag ${pct(f)} (${clean.filter(flagged).length}/${clean.length}); flagged: ${list(clean.filter(flagged))}`);
  assert.ok(h >= 0.5, `held ${pct(h)}`); assert.ok(f <= 0.2, `false-flag ${pct(f)}`);
});
for (const [id, kind, min, fn] of [["C2", "dropped-not", 0.7, failed], ["C3", "added-not", 0.7, failed], ["C4", "wrong-link", 0.5, flagged]]) {
  test(`[${SHAPE}] CON ${id} catch ${kind} >= ${min * 100}%`, () => {
    const d = sel("CON", (r) => r.kind === kind), c = rate(d, fn);
    console.log(`[${SHAPE}] ${id} catch ${pct(c)} (${d.filter(fn).length}/${d.length}); missed: ${list(d.filter((r) => !fn(r)))}`);
    assert.ok(c >= min, `${id} catch = ${pct(c)}`);
  });
}
test(`[${SHAPE}] CON C5 no false failure from a harmless negation: failed <=10% of those clean`, () => {
  const d = sel("CON", (r) => r.kind === "harmless-neg" || r.kind === "cannot-vs-not" || r.kind === "positive-next-to-neg-source"), f = rate(d, failed);
  console.log(`[${SHAPE}] C5 false failure ${pct(f)} (${d.filter(failed).length}/${d.length}); failed: ${list(d.filter(failed))}`);
  assert.ok(f <= 0.1, `false failure = ${pct(f)}`);
});
test(`[${SHAPE}] CON C6 truthful: held never shown when the unbacked claim has meaning level none`, () => {
  const d = sel("CON", (r) => r.kind === "all-none-plus-one-backed"), h = d.filter(held);
  console.log(`[${SHAPE}] C6 held on ${h.length}/${d.length}; levels: ${d.map((r) => r.id + ":" + r.levels.join("/") + " layout=" + r.layout + " fig=" + r.row.fig).join(" | ")}`);
  assert.equal(h.length, 0, `${h.length} of ${d.length} show "each link matches a link a source makes" with a level-none claim`);
});
test(`[${SHAPE}] CON C7 locus: figure disagreement between sources must not fail CON`, () => {
  const d = sel("CON", (r) => /^agreement/.test(r.kind));
  console.log(`[${SHAPE}] C7 ${d.map((r) => `${r.id} agreement=${JSON.stringify(r.agreement)} CON ground=${r.row.ground} fig=${r.row.fig} pattern=${r.row.pattern} shown=${r.row.shown} :: ${r.row.patternFound}`).join(" | ")}`);
  assert.equal(d.filter((r) => r.row.shown === "failed").length, 0);
});

test(`[${SHAPE}] SYN Y1 passable: held >=60% of clean with chain; flagged <=20% of clean`, () => {
  const clean = sel("SYN", (r) => r.label === "clean"), chain = clean.filter((r) => /because|caused|led to|due to|total|overall|in all|altogether/i.test(r.answer)), h = rate(chain, held), f = rate(clean, flagged);
  console.log(`[${SHAPE}] Y1 held on chain-clean ${pct(h)} (${chain.filter(held).length}/${chain.length}); clean false-flag ${pct(f)} (${clean.filter(flagged).length}/${clean.length}); failed: ${list(clean.filter(flagged))}`);
  assert.ok(h >= 0.6, `held ${pct(h)}`); assert.ok(f <= 0.2, `false-flag ${pct(f)}`);
});
for (const [id, kind, min, fn, label] of [["Y3b", "sum-wrong-reused", 0.5, flagged, "wrong total from the source's own figures"], ["Y2", "unsourced-cause", 0.7, failed, "unsourced cause"], ["Y3", "sum-wrong", 0.5, flagged, "wrong sum"], ["Y4", "whole-no-keyword", 0.5, flagged, "wrong whole without a CAUSE word"]]) {
  test(`[${SHAPE}] SYN ${id} catch ${label} >= ${min * 100}%`, () => {
    const d = sel("SYN", (r) => r.kind === kind), c = rate(d, fn);
    console.log(`[${SHAPE}] ${id} catch ${pct(c)} (${d.filter(fn).length}/${d.length}); missed: ${list(d.filter((r) => !fn(r)))}`);
    assert.ok(c >= min, `${id} catch = ${pct(c)}`);
  });
}
test(`[${SHAPE}] SYN Y6 truthful: held only when the whole is right`, () => {
  const wrong = sel("SYN", (r) => r.label === "defect" && held(r));
  console.log(`[${SHAPE}] Y6 held on defective: ${list(wrong)}`);
  assert.equal(wrong.length, 0, `${wrong.length} wrong wholes shown "each link ... is sourced"`);
});

}
