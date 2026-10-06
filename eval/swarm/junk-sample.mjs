// eval/swarm/junk-sample.mjs — reproduces the 78-snip hand-label sample (docs/SNIP-JUNK-PREREG.md) from the BASELINE ladder
// (eval/swarm/lib.mjs `snip`) over the cached pages. Usage: node eval/swarm/junk-sample.mjs  -> prints the keys it would sample.
import crypto from "node:crypto";
import * as H from "./lib.mjs";
import { loadSites } from "./sites.mjs";
const h = (x) => crypto.createHash("sha1").update(x).digest("hex");
export const splitOf = (key) => ["dev", "test", "held"][parseInt(h("split|" + key).slice(0, 8), 16) % 3];
export async function baselineSnips() {
  const out = {};
  for (const s of loadSites()) { out[s.id] = !s.page || !s.page.html ? [] : (await H.snip(s.page, s.ask)).snips.map(({ rung, type, text, verbatim }) => ({ rung, type, text, verbatim })); }
  return out;
}
export function sampleOf(base, sites, n = 78) {
  const rows = [];
  for (const s of sites) { if (!s.rec.fetchOk || s.rec.blocked) continue; (base[s.id] || []).forEach((sn, k) => rows.push({ key: s.id + "|" + sn.rung, id: s.id, rung: sn.rung, text: sn.text, k })); }
  rows.sort((a, b) => h(a.key).localeCompare(h(b.key)) || a.k - b.k);
  const seen = new Set(), ded = [];
  for (const r of rows) { const t = r.id + r.text; if (seen.has(t)) continue; seen.add(t); ded.push(r); }
  return ded.slice(0, n).map((r) => ({ ...r, lk: r.key + "|" + h(r.text).slice(0, 6), split: splitOf(r.key) }));
}
if (process.argv[1] && process.argv[1].endsWith("junk-sample.mjs")) {
  const sites = loadSites(); const m = sampleOf(await baselineSnips(), sites);
  console.log(m.length, "snips;", m.reduce((a, r) => (a[r.split] = (a[r.split] || 0) + 1, a), {}));
  process.exit(0);
}
