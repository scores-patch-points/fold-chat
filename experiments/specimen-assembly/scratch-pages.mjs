import fs from "node:fs";
import { makeOracle, OBLIGATION_IDS } from "./lib/pagecheck.mjs";
const o = await makeOracle();
for (const f of ["tip-suite", "bill-splitter", "counter", "todo", "contact-form"]) {
  const t = Date.now();
  const r = await o.check(fs.readFileSync(`pages/${f}.html`, "utf8"));
  console.log(f, `${Date.now() - t}ms`, OBLIGATION_IDS.map((id) => (r[id].pass ? "✓" : "✗")).join(""), Object.entries(r).filter(([, v]) => !v.pass).map(([k, v]) => `${k}: ${v.detail}`).join(" | "));
}
await o.close();
