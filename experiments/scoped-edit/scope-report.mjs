// scope-report.mjs — no model. Does the Fold's MECHANICAL scope contain the files an engineer would open?
import { loadFixture } from "./harness.mjs";
import { TASKS } from "./tasks.mjs";
import { scopeFor } from "../../fold-chat-scope.js";
const files = loadFixture();
const total = Object.values(files).reduce((n, c) => n + c.length, 0);
const budget = +process.argv[2] || 3500; const legacy = process.argv[3] === "legacy";
console.log(`codebase: ${Object.keys(files).length} files, ${total} chars · scope budget ${budget} chars (${Math.round(budget / total * 100)}% of the stack)\n`);
let missed = 0;
for (const t of TASKS) {
  const s = scopeFor(files, t.task, { budget, maxFiles: 8, legacy });
  const inc = s.include.map((x) => x.path);
  const need = t.oracle;
  const got = need.filter((p) => inc.includes(p)), miss = need.filter((p) => !inc.includes(p));
  if (miss.length) missed++;
  console.log(`${t.id.padEnd(24)} recall ${got.length}/${need.length} ${miss.length ? "✗ MISSED " + miss.join(", ") : "✓"}  · scope ${s.chars} chars (${Math.round(s.chars / total * 100)}% of stack) · ${inc.length} files`);
  console.log("   scoped:", s.include.map((x) => `${x.path} [${x.why.map((w) => w.split(":")[0]).join("+")}]`).join("  "));
  if (miss.length) for (const m of miss) { const full = scopeFor(files, t.task, { budget: 1e9, maxFiles: 99, legacy }).include.find((x) => x.path === m); console.log(`   ${m}: ${full ? "found only with an unlimited budget as [" + full.why.join(", ") + "] score " + full.score : "NOT FOUND by any rule"}`); }
}
console.log(`\n${missed} of ${TASKS.length} tasks had at least one needed file outside the mechanical scope`);
