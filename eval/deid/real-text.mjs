// What does the informal-name detector flag in REAL informal English? Precision is judged by eye on the listing —
// there is no gold for these corpora, so this reports counts and the flagged tokens, not a score.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { informalTerms, defaultPriors } from "../../fold-chat-informal.js";
const PRIORS = defaultPriors();
const E = "/Users/mlacy/Documents/3.0/ethos/19-organic-community";
const src = { sms: join(E, "nus-sms/en"), cosem: join(E, "cosem"), irc: join(E, "ubuntu-irc/ubuntu") };
for (const [name, dir] of Object.entries(src)) {
  const files = readdirSync(dir).filter((f) => /\.txt$/.test(f)).slice(0, 12);
  let lines = 0, flaggedLines = 0; const tally = new Map(), ctx = new Map();
  for (const f of files) for (const line of readFileSync(join(dir, f), "utf8").split("\n").slice(0, 600)) {
    if (!line.trim() || line.startsWith("---")) continue; lines++;
    const hits = informalTerms(line.toLowerCase(), PRIORS).map((f) => f.term);   // lowercased: this is the caseless case on real text
    if (hits.length) flaggedLines++;
    for (const h of hits) { const k = h.toLowerCase(); tally.set(k, (tally.get(k) || 0) + 1); if (!ctx.has(k)) ctx.set(k, line.slice(0, 90)); }
  }
  console.log(`\n== ${name}: ${lines} lines, ${flaggedLines} with a flagged token (${(100 * flaggedLines / lines).toFixed(1)}%), ${tally.size} distinct tokens`);
  const top = [...tally].sort((a, b) => b[1] - a[1]).slice(0, 40);
  console.log(top.map(([w, n]) => `${w}×${n}`).join("  "));
  if (process.argv.includes("--ctx")) for (const [w] of top.slice(0, 15)) console.log("  ", w.padEnd(14), ctx.get(w));
}
