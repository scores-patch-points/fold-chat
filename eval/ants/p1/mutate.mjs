// mutate.mjs — mutation-check the gates: for each mutation, edit the file in place, run p1.test.mjs, EXPECT it to fail, restore the file. (run when no arm is mid-run: arms import these modules.)
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const M = [
  ["g.mjs", "escalate: delete the opinion route", /if \(f\.cue === "opinion"\) return \{[^}]*\};/, ""],
  ["g.mjs", "escalate: ignore the coverage threshold", /f\.C\.cov >= params\.tauCov && /, ""],
  ["g.mjs", "escalate: ignore the shape check", /\(f\.C\.cov >= params\.tauCov && f\.C\.shaped\)/, "(f.C.cov >= params.tauCov)"],
  ["g.mjs", "escalate: trust a composed answer without its check", /f\[st\]\.answered && f\[st\]\.check/, "f[st] && f[st].answered"],
  ["g.mjs", "cueClass: the opinion pattern never fires", /if \(\/\\b\(\?:should i\|/, "if (/\\bzzzz(?:should i|"],
  ["lib.mjs", "compareVerdict: ignore negation", /if \(\/\\b\(\?:not\|never\|no\|n't\)\\b\|n't\/i\.test\(a\)\) flip = !flip;/, ""],
  ["lib.mjs", "gradeStated: an answer to an unanswerable counts as correct", /return \{ ok: refuses\(t\), why: refuses\(t\) \? "declined" : "answered-unanswerable" \};/, 'return { ok: true, why: "x" };'],
  ["lib.mjs", "gradeSnippets: skip the R5 co-location rule", /if \(!together\) \{ ok = false; why = "coref-dangling"; \}/, ""],
  ["mech.mjs", "D+ lifespan: off by one year (ignore the month)", /if \(d\.m < b\.m \|\| \(d\.m === b\.m && d\.d < b\.d\)\) age--;/, ""],
  ["mech.mjs", "D+ list complement: pick the first option", /if \(missing\.length === 1\) return ok\("list-complement", `\$\{missing\[0\]\} is the odd one out; the page lists/, 'if (missing.length >= 1) return ok("list-complement", `${opts[0]} is the odd one out; the page lists'],
];
let survived = 0;
for (const [file, name, re, to] of M) {
  const p = path.join(here, file); const src = fs.readFileSync(p, "utf8");
  if (!re.test(src)) { console.log("NO-MATCH ", name); survived++; continue; }
  fs.writeFileSync(p, src.replace(re, to));
  let failed = false;
  try { execFileSync("node", ["--test", path.join(here, "p1.test.mjs")], { stdio: "pipe" }); } catch { failed = true; }
  fs.writeFileSync(p, src);
  console.log(failed ? "killed   " : "SURVIVED ", name);
  if (!failed) survived++;
}
console.log(survived ? `${survived} mutation(s) not killed` : "all mutations killed");
