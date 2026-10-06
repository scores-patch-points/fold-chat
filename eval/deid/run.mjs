// How much of the private naming in informal, caseless asks does the whole JS pipeline mask?
// Runs fold-chat-redact.js deidentify() against the local Python redactor (scripts/pii/server.py must be up). Nothing leaves this machine.
// Usage: node eval/deid/run.mjs [--cases=./cases-heldout.json] [--mode=open] [--show] [--no-redactor]
import { readFileSync } from "node:fs";
import { createRedactor, deidentify } from "../../fold-chat-redact.js";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) || d;
const { cases } = JSON.parse(readFileSync(new URL(arg("cases", "./cases.json"), import.meta.url)));
const mode = arg("mode", "default"), floorOnly = process.argv.includes("--no-redactor");
const redactor = createRedactor();
if (!floorOnly && !(await redactor.health())) { console.error("the PII redactor is not up: scripts/pii/.venv/bin/python scripts/pii/server.py"); process.exit(2); }
const lc = (s) => s.toLowerCase();
const rows = [];
for (const c of cases) {
  let out;
  try { out = await deidentify([c.text], { mode, redact: floorOnly ? null : (t) => redactor.spans(t) }); } catch (e) { rows.push({ ...c, error: e.message, caught: 0 }); continue; }
  const masked = out.texts[0];
  const missed = c.gold.filter((g) => lc(masked).includes(lc(g.replace(/^@/, ""))));
  rows.push({ ...c, masked, missed, caught: c.gold.length - missed.length, ids: out.deid.stats().count, passes: out.passes });
}
for (const r of rows) console.log(r.id.padEnd(8), r.reg.padEnd(10), `${r.caught}/${r.gold.length}`.padEnd(5), r.error ? "REFUSED " + r.error : r.missed.length ? "MISSED " + JSON.stringify(r.missed) : "", r.gold.length ? "" : `masked ${r.ids} (should be 0)`);
const g = rows.reduce((a, r) => a + r.gold.length, 0), k = rows.reduce((a, r) => a + r.caught, 0);
const neg = rows.filter((r) => !r.gold.length), touched = neg.filter((r) => r.ids > 0).length;
console.log(`\nmode ${mode}${floorOnly ? " (floor only: no redactor)" : ""}: recall ${k}/${g} = ${(100 * k / g).toFixed(0)}%   no-name asks with anything masked: ${touched}/${neg.length}`);
const by = {}; for (const r of rows) { const b = (by[r.reg] ||= [0, 0]); b[0] += r.caught; b[1] += r.gold.length; }
console.log(Object.entries(by).filter(([, b]) => b[1]).map(([x, b]) => `${x} ${b[0]}/${b[1]}`).join(" · "));
if (process.argv.includes("--show")) for (const r of rows) console.log("\n" + r.id + ": " + (r.masked ?? "(refused)"));
