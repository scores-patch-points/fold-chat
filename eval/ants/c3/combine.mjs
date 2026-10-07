// eval/ants/c3/combine.mjs — POST-HOC, descriptive (not pre-registered): what happens if a mechanical check must agree with the model judge ("the model proposes, the check disposes")? Reads the stored results; no calls.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { report } from "./lib.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
for (const SET of ["", "-cf"]) {
  const t = JSON.parse(fs.readFileSync(path.join(here, `results-tokens${SET}.json`))).rows, r = JSON.parse(fs.readFileSync(path.join(here, `results-ref${SET}.json`))).rows;
  const rows = t.map((x) => { const y = r.find((q) => q.id === x.id); return { ...x, R2: y.R2, R2andT1: y.R2 === "ACCEPT" && x.T1 === "ACCEPT" ? "ACCEPT" : "REJECT", R2andT2: y.R2 === "ACCEPT" && x.T2 === "ACCEPT" ? "ACCEPT" : "REJECT", R2andK2: y.R2 === "ACCEPT" && x.K2 === "ACCEPT" ? "ACCEPT" : "REJECT" }; });
  console.log(`#### set ${SET || "main"}`);
  for (const k of ["R2", "R2andT1", "R2andK2", "R2andT2"]) console.log(report(k, rows, k).split("\n").slice(0, 2).join("\n"));
}
