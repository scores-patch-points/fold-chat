// scripts/archon-dossier-check.mjs — AntiStrauss's disclosure rule, mechanically enforced.
// A dossier entry passes only if: a snip manifest exists and is status verified; scholarship is cited;
// a verdict is given; and EITHER bends[] is non-empty (each naming ours AND theirs) OR noBendReason is stated.
// A name used as a label with no snip is "tokenized" and refused.
import fs from "node:fs"; import path from "node:path";
const ROOT = "/Users/mlacy/Documents/3.0", DIR = "docs/archons/dossier";
const VERDICTS = ["justified", "partial", "fails"];
let bad = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".json"))) {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")), why = [];
  // standing: "verified" (PD, verified snip) | "deferred" (copyrighted: scholarship stands in, manifest says copyrighted_deferred) | "nomination" (our name, no author's work claimed)
  const standing = d.standing || "verified";
  if (!["verified", "deferred", "nomination"].includes(standing)) why.push("standing invalid");
  if (standing === "nomination") {
    if (!d.noBendReason) why.push("nomination needs noBendReason");
    if (d.creditAsScholarship !== false) why.push("nomination must set creditAsScholarship:false");
  } else if (!d.snips?.length) why.push("no snip: tokenized");
  for (const s of d.snips || []) {
    const p = path.join(ROOT, s);
    if (!fs.existsSync(p)) { why.push(`missing manifest ${s}`); continue; }
    const st = String(JSON.parse(fs.readFileSync(p, "utf8")).status);
    if (standing === "nomination" && !(st.startsWith("verified") || st === "copyrighted_deferred")) why.push(`snip neither verified nor deferred: ${s}`);
    if (standing === "verified" && !st.startsWith("verified")) why.push(`snip not verified: ${s}`);
    if (standing === "deferred" && !(st.startsWith("verified") || st === "copyrighted_deferred")) why.push(`snip neither verified nor deferred: ${s}`);
  }
  if (!d.whatTheyArgued) why.push("whatTheyArgued missing");
  if (standing !== "nomination" && !d.scholarship?.length) why.push("no scholarship");
  if (!VERDICTS.includes(d.verdict)) why.push("verdict must be " + VERDICTS.join("|"));
  if (!d.bends?.length && !d.noBendReason) why.push("bends[] empty without noBendReason");
  for (const b of d.bends || []) if (!b.ours || !b.theirs || !b.kind) why.push(`bend ${b.id}: needs kind, ours, theirs`);
  if (d.verdict === "justified" && d.bends?.length) why.push("justified but lists bends");
  console.log(why.length ? `FAIL ${d.handle}: ${why.join("; ")}` : `ok   ${d.handle} (${d.verdict}, ${d.bends?.length || 0} bends)`);
  bad += why.length ? 1 : 0;
}
process.exit(bad ? 1 : 0);
