// build-report-data.mjs — the static half of the report: tasks, the fixture, and what each scoper chose.
import { writeFileSync } from "node:fs";
import { loadFixture } from "./harness.mjs";
import { TASKS } from "./tasks.mjs";
import { scopeFor } from "../../fold-chat-scope.js";
const files = loadFixture();
const total = Object.values(files).reduce((n, c) => n + c.length, 0);
const BUDGET = 3500;
const sizes = Object.fromEntries(Object.entries(files).map(([p, c]) => [p, c.length]));
const tasks = TASKS.map((t) => {
  const scopes = {};
  for (const [name, legacy] of [["SCOPED1", true], ["SCOPED2", false]]) {
    const s = scopeFor(files, t.task, { budget: BUDGET, maxFiles: 8, legacy });
    const inc = s.include.map((x) => x.path);
    scopes[name] = { include: s.include.map((x) => ({ path: x.path, why: x.why, score: x.score, chars: x.chars })), chars: s.chars, recall: t.oracle.filter((p) => inc.includes(p)).length, need: t.oracle.length, missed: t.oracle.filter((p) => !inc.includes(p)) };
  }
  return { id: t.id, label: t.label, task: t.task, why: t.why, primary: t.primary, oracle: t.oracle, scopes };
});
writeFileSync("report-data.json", JSON.stringify({ built: new Date().toISOString(), fixture: { files: Object.keys(files).length, chars: total, sizes }, budget: BUDGET, tasks }, null, 1));
console.log("report-data.json:", tasks.length, "tasks,", Object.keys(files).length, "files,", total, "chars");
