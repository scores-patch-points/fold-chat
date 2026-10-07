// eval.mjs — run the pre-registered classifier over the cached battery. Usage: node eval/ants/c6/eval.mjs [battery.json] [--out name]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { read } from "./reader.mjs";
import { fetchVoice, createFetchedBank, sha256Hex } from "../../../fold-chat-fetchedvoice.js";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "battery.json";
const outName = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "results-run1";
const items = JSON.parse(fs.readFileSync(path.join(HERE, file), "utf8")).items;
const ARMS = ["full", "hosts_only", "features_only", "features_blind"];
const NOW = "2026-10-06T00:00:00.000Z";
const ALIASES = process.argv.includes("--aliases") ? { G9: ["Eric Blair", "Eric Arthur Blair"] } : {};   // caller-supplied alias (run 2 only)
const rows = [];
for (const it of items) {
  const row = { id: it.id, person: it.person, url: it.url, label: it.label, kind: it.kind, arms: {} };
  for (const arm of ARMS) {
    const r = await fetchVoice({ person: (ALIASES[it.id] || it.aliases) ? { name: it.person, aliases: ALIASES[it.id] || it.aliases } : it.person, url: it.url, read, now: () => NOW, arm });
    row.arms[arm] = { verdict: r.verdict, reasons: r.reasons, attribution: r.attribution?.tier, features: r.features && Object.fromEntries(Object.entries(r.features).map(([k, v]) => [k, typeof v === "number" ? +v.toFixed(3) : v])), evidence: r.attribution?.evidence, own: !!r.entry };
    if (arm === "full" && r.entry) { row.spans = r.entry.bank.length; row.spansOk = r.entry.bank.filter((b) => r.entry.text.slice(b.start, b.end) === b.text).length; }
    if (arm === "full" && r.entry) row.entry = { handle: r.entry.handle, sha256: r.entry.source.sha256, chars: r.entry.source.chars, text: r.entry.text, bank: r.entry.bank.length, terms: r.entry.terms.slice(0, 12) };
  }
  rows.push(row);
}
const matrix = (arm) => {
  const m = { own_own: 0, own_unsure: 0, own_refuse: 0, own_unreadable: 0, not_own: 0, not_unsure: 0, not_refuse: 0, not_unreadable: 0 };
  for (const r of rows) { const v = r.arms[arm].verdict; const pre = r.label === "own" ? "own" : "not"; const k = pre + "_" + (v === "own" ? (pre === "own" ? "own" : "own") : v); m[pre === "own" ? "own_" + (v === "own" ? "own" : v) : "not_" + (v === "own" ? "own" : v)]++; }
  return m;
};
const M = Object.fromEntries(ARMS.map((a) => [a, matrix(a)]));
const falseAccepts = Object.fromEntries(ARMS.map((a) => [a, rows.filter((r) => r.label === "not_own" && r.arms[a].verdict === "own").map((r) => ({ id: r.id, kind: r.kind, reasons: r.arms[a].reasons }))]));
// F5: provenance round-trip for accepted pages (full arm)
let f5 = { checked: 0, shaOk: 0, spanOk: 0, spans: 0 };
const bankMod = createFetchedBank();
for (const r of rows) if (r.entry && r.label) {
  const e = r.entry; f5.checked++;
  if (await sha256Hex(e.text) === e.sha256) f5.shaOk++;
  f5.spans += r.spans; f5.spanOk += r.spansOk;
}
fs.writeFileSync(path.join(HERE, outName + ".json"), JSON.stringify({ at: new Date().toISOString(), battery: file, matrix: M, falseAccepts, f5, rows: rows.map((r) => ({ ...r, entry: r.entry && { ...r.entry, text: undefined } })) }, null, 1));
console.log("MATRIX (rows: truth; cols: own/unsure/refuse/unreadable)");
for (const a of ARMS) console.log(a.padEnd(14), "own-pages:", JSON.stringify([M[a].own_own, M[a].own_unsure, M[a].own_refuse, M[a].own_unreadable]), " trap-pages:", JSON.stringify([M[a].not_own, M[a].not_unsure, M[a].not_refuse, M[a].not_unreadable]));
console.log("\nFALSE ACCEPTS (traps admitted as own):");
for (const a of ARMS) { console.log(" ", a, falseAccepts[a].length ? "" : "none"); for (const f of falseAccepts[a]) console.log("    ", f.id, f.kind, f.reasons.join(",")); }
console.log("\nPER PAGE (full arm):");
for (const r of rows) { const a = r.arms.full, f = a.features; console.log(r.id.padEnd(4), r.label.padEnd(7), a.verdict.padEnd(7), (a.reasons[0] || "").padEnd(48), "attr=" + a.attribution, f ? `fp=${f.fp} tp=${f.tp} nm=${f.nm} q=${f.quoteShare} al=${f.attrLines} bio=${f.bio} w=${f.words}` : "", "| fo:", r.arms.features_only.verdict, r.arms.features_only.reasons[0] || "", "| ho:", r.arms.hosts_only.verdict); }
console.log("\nF5", JSON.stringify(f5));
