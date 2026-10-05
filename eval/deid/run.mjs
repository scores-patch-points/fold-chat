// Probe: how much of the private naming in informal, caseless asks does the de-identifier actually mask?
// Usage: node eval/deid/run.mjs [--no-read]   (the read goes to the local heimdall bridge; nothing leaves this machine)
import { readFileSync } from "node:fs";
import { createDeid, namesIn } from "../../fold-chat-deid.js";
import { read } from "../../fold-chat-client.js";
import { informalTerms, defaultPriors } from "../../fold-chat-informal.js";
const PRIORS = defaultPriors();
const useInformal = process.argv.includes("--informal");

const casesFile = process.argv.find((a) => a.startsWith("--cases="))?.slice(8) || "./cases.json";
const { cases } = JSON.parse(readFileSync(new URL(casesFile, import.meta.url)));
const useRead = !process.argv.includes("--no-read");
const lc = (s) => s.toLowerCase();
let rows = [];
for (const c of cases) {
  let named = [], viaRead = false;
  if (useRead) { try { const r = await read(c.text, { source: "deid-probe" }); named = (r.referents || []).flatMap((x) => x.surfaces || []); viaRead = named.length > 0; } catch { /* the bridge being down is a result, not a crash */ } }
  if (!named.length) named = namesIn(c.text);
  const inf = useInformal ? informalTerms(c.text, PRIORS) : [];
  const extra = [...named.map((term) => ({ term, whole: true })), ...inf];
  named = [...new Set([...named, ...inf.map((f) => f.term)])];
  const d = createDeid({ extra });
  const masked = d.mask(c.text);
  const left = c.gold.filter((g) => lc(masked).includes(lc(g)));
  // a gold name counts as caught when none of its words (≥3 chars, not a bare connector) survive
  const missed = c.gold.filter((g) => g.split(/\s+/).filter((w) => w.length >= 2 && !/^(and|the)$/.test(w)).some((w) => lc(masked).includes(lc(w.replace(/^@/, "")))));
  const over = [...new Set(named)].filter((n) => !c.gold.some((g) => lc(g).includes(lc(n)) || lc(n).includes(lc(g))));
  rows.push({ id: c.id, reg: c.reg, gold: c.gold.length, caught: c.gold.length - missed.length, missed, over, viaRead, masked });
}
const pad = (s, n) => String(s).padEnd(n);
for (const r of rows) console.log(pad(r.id, 8), pad(r.reg, 10), `${r.caught}/${r.gold}`.padEnd(5), r.viaRead ? "read " : "floor", r.missed.length ? "MISSED " + JSON.stringify(r.missed) : "", r.over.length ? "OVER " + JSON.stringify(r.over) : "");
const g = rows.reduce((a, r) => a + r.gold, 0), k = rows.reduce((a, r) => a + r.caught, 0);
const negs = rows.filter((r) => r.gold === 0), overAll = rows.reduce((a, r) => a + r.over.length, 0);
console.log(`\nrecall ${k}/${g} = ${(100 * k / g).toFixed(0)}%   over-masked terms: ${overAll} (${negs.filter((r) => r.over.length).length}/${negs.length} no-name asks touched)   read used on ${rows.filter((r) => r.viaRead).length}/${rows.length}`);
const byReg = {}; for (const r of rows) { const b = (byReg[r.reg] ||= { g: 0, k: 0 }); b.g += r.gold; b.k += r.caught; }
console.log(Object.entries(byReg).filter(([, b]) => b.g).map(([k, b]) => `${k} ${b.k}/${b.g}`).join(" · "));
if (process.argv.includes("--show")) for (const r of rows) console.log("\n" + r.id + ": " + r.masked);
