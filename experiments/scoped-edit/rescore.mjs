// rescore.mjs — re-score every stored answer with the CURRENT parser. No model calls.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadFixture, HERE } from "./harness.mjs";
import { TASKS } from "./tasks.mjs";
import { scoreAnswer } from "./score.mjs";
const OUT = join(HERE, "results.jsonl");
const files = loadFixture();
const rs = readFileSync(OUT, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
let changed = 0, flipped = 0, unscorable = 0; const keep = [];
for (const r of rs) {
  if (!r.answer || String(r.err || "").startsWith("model-error")) { keep.push(r); continue; }
  if (r.answerChars > r.answer.length) { unscorable++; continue; }                 // truncated at the time: drop it so the runner redoes it
  const t = TASKS.find((x) => x.id === r.task);
  const n = scoreAnswer(t, files, r.answer, r.ctxFiles);
  if (n.ok !== r.ok || n.err !== r.err) { changed++; if (n.ok !== r.ok) flipped++; }
  keep.push({ ...r, ...n, rescored: true });
}
writeFileSync(OUT, keep.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`rescored ${rs.length} runs: ${changed} changed verdict-or-reason, ${flipped} flipped pass/fail, ${unscorable} dropped (truncated answers, will be re-asked)`);
