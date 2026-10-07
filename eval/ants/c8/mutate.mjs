#!/usr/bin/env node
// eval/ants/c8/mutate.mjs — mutation check: each new rule of primary-v2.mjs is deleted (one at a time) in a copy and primary-v2.test.mjs must FAIL. A surviving mutant = a rule no test needs.
//   node eval/ants/c8/mutate.mjs
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, "primary-v2.mjs"), "utf8");
const M = [
  ["a1 spell: -re -> -er removed", 'x = x.replace(/([b-df-hj-np-tv-xz])re(s?)$/, "$1er$2");', "/*removed*/"],
  ["a2 spell: -our -> -or removed", 'if (!OUR_KEEP.has(x)) x = x.replace(', "if (false) x = x.replace("],
  ["a2b spell: -our exclusion list removed (hour/four/tour fold)", "const OUR_KEEP = new Set([", "const OUR_KEEP = new Set([].concat(["],
  ["a3 spell: -ize -> -ise removed", 'x = x.replace(/^([a-z]{3,})(iz|yz)(e|es|ed|ing|ation|ations|er|ers)$/', 'x = x.replace(/^zzzzzzzzzzzz$/'],
  ["f abbreviation: U.S. -> United States removed", '.replace(/\\bU\\.\\s?S\\.(?:\\s?A\\.)?|\\bUSA\\b|\\bUS\\b/g, "United States")', ""],
  ["eq equivalents removed", "const equivIn = (s, have) => (EQUIV.get(s) || [])", "const equivIn = (s, have) => ([])"],
  ["b slack removed entirely", "{ used.slack = lacking.slice(); lacking = []; }", "{ }"],
  ["b slack: names forgivable (cap filter removed)", "const forgivable = new Set(subj.filter((x) => !x.cap).map((x) => x.stem));", "const forgivable = new Set(subj.map((x) => x.stem));"],
  ["b slack: figure requirement removed", "if (fg.n >= 1 && lacking.length <= 2", "if (lacking.length <= 2"],
  ["b slack: at-most-2 removed", "if (fg.n >= 1 && lacking.length <= 2 && ", "if (fg.n >= 1 && "],
  ["b slack: anchor requirement removed", "&& anchor && !foreignOf", "&& !foreignOf"],
  ["b slack: foreign-subject check removed", "&& anchor && !foreignOf(sw, true).length)", "&& anchor)"],
  ["supply removed (page identity never supplies a name)", "if (lacking.length && context && context.size) {", "if (false) {"],
  ["supply: predicate names suppliable too", "const nameStems = new Set(contentStems(regionOf(cw).subject, fw).filter((x) => x.cap).map((x) => x.stem));", "const nameStems = new Set(contentStems(cw, fw).filter((x) => x.cap).map((x) => x.stem));"],
  ["supply: foreign/own-subject check removed", "if (foreign.length) return { ok: false, why: \"foreign_subject:\"", "if (false) return { ok: false, why: \"foreign_subject:\""],
  ["supply: known words include the page title (title lends subject words)", "const known = new Set([...want, ...want.flatMap((s) => EQUIV.get(s) || [])]);", "const known = new Set([...want, ...want.flatMap((s) => EQUIV.get(s) || []), ...(context || [])]);"],
  ["c name-bound figure disabled (a bare figure satisfies)", "const nm = nameOfFigure(c, claim, fw);", "const nm = null;"],
  ["c name-bound: months/weekdays not excluded", "|| MONTHS.has(low)) return null;", ") return null;"],
  ["d unit conversion removed", "const a = c.v * c.unit.f, b = w.v * w.unit.f;\n    return a > 0 && Math.abs(a - b) / a <= tol;", "return false;"],
  ["d tolerance widened 1% -> 5%", "function figureSays(c, w, tol = 0.01)", "function figureSays(c, w, tol = 0.05)"],
  ["d same number in another unit accepted (unit factor check removed)", "if (c.unit.f === w.unit.f) return !!ground.figureMatches(c, w);", "return !!ground.figureMatches(c, w) || (c.numeric && w.numeric && Math.abs(c.v * c.unit.f - w.v * w.unit.f) / (c.v * c.unit.f) <= tol);"],
  ["d dimension check removed", "if (c.unit.dim !== w.unit.dim) return false;", ""],
  ["d unit word still required after conversion", "const want = want0.filter((s) => !fg.unitStems.has(s) || have.has(s));", "const want = want0;"],
  ["e fragments/pairs removed (candidatesV2 = provenance's list)", "  let extra = 0;\n", "  return out.slice(0, max).map((c, i) => ({ ...c, n: i + 1 }));\n  let extra = 0;\n"],
  ["e pair: heading lends its entity unconditionally (gate on pair removed)", "if (carries(pair) && share(pair) > share(alone)) add(", "if (share(pair) > share(alone)) add("],
  ["e fragment: figure requirement removed", "const carries = (t) => cfig.length ? figuresGate(claim, t, fw).ok && share(t) >= 0.5 : share(t) >= 0.7;", "const carries = (t) => share(t) >= 0.5;"],
  ["e: unclassified hosts get fragments too (minRank check removed)", "if ((kindOf(hostOf(p?.url || p?.source || \"\")).rank || 0) < minRank) return;", ""],
  ["prefilter removed (the model is shown everything)", "  if (prefilter) {\n    const graded", "  if (false) {\n    const graded"],
  ["order: declarative-first removed", "Number(declarative(b.c)) - Number(declarative(a.c)) || a.i - b.i", "a.i - b.i"],
  ["pick not checked (gate on the model's pick removed)", "const gate = assertsClaim(claim, c.text, { fw, indexHost, english, context });\n  if (!gate.ok) return { ok: false, why: gate.why };", "const gate = { ok: true };"],
  ["assertion: negation parity removed", 'if (s.neg !== c.neg) return { ok: false, why: "polarity" };', ""],
  ["every-figure removed", 'if (!fg.ok) return { ok: false, why: "figure_missing:" + fg.missing.join(",") };', ""],
];
let killed = 0, survived = [];
for (const [name, find, rep] of M) {
  const n = SRC.split(find).length - 1;
  if (n !== 1) { console.log(`ERROR  ${name}: pattern found ${n} times`); survived.push(name + " (pattern)"); continue; }
  const f = path.join(HERE, ".mutant.mjs");
  fs.writeFileSync(f, SRC.replace(find, () => rep));
  const r = spawnSync("node", ["--test", path.join(HERE, "primary-v2.test.mjs")], { env: { ...process.env, PRIMARY_MODULE: f }, encoding: "utf8" });
  const dead = r.status !== 0;
  const failing = [...(r.stdout.matchAll(/^✖ (.+?) \(/gm))].map((m) => m[1]).filter((x, i, a) => a.indexOf(x) === i).slice(0, 2).join(" | ");
  console.log(`${dead ? "killed  " : "SURVIVED"} ${name}${dead ? "   <- " + failing.slice(0, 110) : ""}`);
  dead ? killed++ : survived.push(name);
}
try { fs.unlinkSync(path.join(HERE, ".mutant.mjs")); } catch {}
console.log(`\n${killed}/${M.length} mutants killed` + (survived.length ? "; survivors: " + survived.join("; ") : ""));
process.exit(survived.length ? 1 : 0);
