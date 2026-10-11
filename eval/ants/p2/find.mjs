// find.mjs <regex> [max] — authoring aid: where does a fact occur in the real pool (page ids + context). Not part of any gate.
import { loadPool } from "./pool.mjs";
const [re, max = "12"] = process.argv.slice(2);
const R = new RegExp(re, "i"); let n = 0;
for (const p of loadPool()) {
  const t = p.text.slice(0, 24000); const m = R.exec(t); if (!m) continue;
  console.log(`${p.id} ${p.kind} ${p.title || p.url || ""} @${m.index}\n   …${t.slice(Math.max(0, m.index - 120), m.index + 160).replace(/\s+/g, " ")}…`);
  if (++n >= +max) break;
}
