// rescore-labels.mjs — re-score the 136 hand-labelled answer sentences OFFLINE with a gate build.
//
//   node eval/rescore-labels.mjs --gate baseline|live [--fetch] [--out eval/rescore-<gate>.json]
//
// For every labelled sentence (eval/labels.json) it rebuilds what the app handed the gate: the pages the turn READ
// (raw/<label>__<id>__r1.json -> grounding.web[].read), each cut to 12000 chars as fold-chat.js does, and runs the
// sentence (the app's own entry text) through the chosen gate. `baseline` = the committed gate before the fix
// (eval/lib/ground-baseline.mjs) and is used to CHECK THE RIG: it must reproduce the flags the app recorded.
// Page text comes from eval/cache (pg_<sha1(url)>.txt); old u_<hex40> cache files are only reused when no other read
// URL shares their 40-char prefix (the old key collided). --fetch fetches the rest once, with a User-Agent, politely.
// Strict precision needs "does the CITED QUOTE say it": a quote unchanged from the hand-labelled run keeps its label; a
// new or changed quote needs a hand label in eval/labels-v2.json (this script lists them, it never invents one).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf("--" + k); return i < 0 ? d : argv[i + 1]; };
const gateName = arg("gate", "live");
const ground = await import(gateName === "baseline" ? path.join(here, "lib/ground-baseline.mjs") : path.join(here, "..", "fold-chat-ground.js"));
const webm = await import(path.join(here, "..", "fold-chat-web.js"));
const rawDir = path.join(here, "raw"), cacheDir = path.join(here, "cache");
const labels = JSON.parse(fs.readFileSync(path.join(here, "labels.json"), "utf8")).sentences;
const v2 = fs.existsSync(path.join(here, "labels-v2.json")) ? JSON.parse(fs.readFileSync(path.join(here, "labels-v2.json"), "utf8")).sentences : [];
const v2by = new Map(v2.map((l) => [`${l.key}#${l.idx}#${l.quote}`, l]));
const UA = { "user-agent": "fold-eval/1.0 (accuracy harness; scores.patch.points@proton.me)" };
const fetchUA = (u, o = {}) => fetch(u, { ...o, headers: { ...(o.headers || {}), ...UA } });
const sha = (u) => crypto.createHash("sha1").update(u).digest("hex");
const oldKey = (u) => "u_" + Buffer.from(u).toString("hex").slice(0, 80) + ".txt";

// URLs per labelled turn, and the global prefix-collision map
const turns = new Map();
const allUrls = new Set();
for (const l of labels) {
  const [lab, id, rep, t] = l.key.split("/");
  const f = path.join(rawDir, `${lab}__${id}__${rep}.json`);
  const r = JSON.parse(fs.readFileSync(f, "utf8"));
  const ti = Number(t.slice(1));
  const g = r.turns[ti].grounding;
  const urls = (g.web || []).filter((w) => w.read && !w.skipped && w.ok !== false).map((w) => w.read);
  urls.forEach((u) => allUrls.add(u));
  turns.set(l.key, { g, urls });
}
// every URL in raw/ (the old cache key collided across all of them, not just the labelled ones)
const everyUrl = new Set(allUrls);
for (const f of fs.readdirSync(rawDir).filter((x) => x.endsWith(".json") && !x.startsWith("_"))) {
  try { for (const t of JSON.parse(fs.readFileSync(path.join(rawDir, f), "utf8")).turns) for (const w of t.grounding?.web || []) if (w.read) everyUrl.add(w.read); } catch {}
}
const byOld = new Map();
for (const u of everyUrl) { const k = oldKey(u); (byOld.get(k) || byOld.set(k, []).get(k)).push(u); }
async function page(u) {
  const f = path.join(cacheDir, "pg_" + sha(u) + ".txt");
  if (fs.existsSync(f)) return fs.readFileSync(f, "utf8");
  const old = path.join(cacheDir, oldKey(u));
  if (byOld.get(oldKey(u)).length === 1 && fs.existsSync(old)) { const t = fs.readFileSync(old, "utf8"); fs.writeFileSync(f, t); return t; }
  if (!argv.includes("--fetch")) return null;
  const r = await webm.readText(u, { fetchImpl: fetchUA, timeoutMs: 20000 });
  const t = r.ok ? r.text : "";
  fs.writeFileSync(f, t); await new Promise((x) => setTimeout(x, 1000));
  return t;
}
const pages = new Map();
let missing = 0;
for (const u of allUrls) { const t = await page(u); if (t == null) missing++; pages.set(u, t); }
if (missing) console.log(`(${missing} pages not cached; rerun with --fetch)`);

const rows = [];
for (const l of labels) {
  const { g, urls } = turns.get(l.key);
  const e = g.coverage.entries[l.idx]; if (!e) continue;
  const material = urls.filter((u) => pages.get(u)).map((u) => ({ ref: decodeURIComponent(u.split("/").pop() || u), source: u, text: String(pages.get(u)).slice(0, 12000) }));
  const ent = material.length ? ground.attribute(e.text, material)[0] : null;
  const rec = !!e.ref;
  const now = !!(ent && ent.ref);
  const ex = now ? ground.excerpt(ent.sourceText, ent.span) : null;
  const oldQuote = e.address ? (g.facing?.sources || []).find((x) => x.address === e.address)?.text || null : null;
  rows.push({ key: l.key, idx: l.idx, text: e.text, oldQuote, recorded: rec, recordedSource: e.source || null, gate: now, source: now ? ent.source : null, span: now ? ent.span : null, quote: ex ? ex.quote : null, why: ent?.why || null, detail: ent?.detail || null, urls,
    label: { quoteSupports: l.quoteSupports, doc: l.doc, truth: l.truth }, material: material.length });
}
const norm = (t) => String(t || "").replace(/\s+/g, "");
const sameCite = (r) => r.gate && r.recorded && r.source === r.recordedSource && r.oldQuote && r.quote && (norm(r.oldQuote) === norm(r.quote) || norm(r.oldQuote).includes(norm(r.quote)) || norm(r.quote).includes(norm(r.oldQuote)));
const agree = rows.filter((r) => r.gate === r.recorded).length;
// labelled quote for a row: kept when the gate cites the same source as the hand-labelled run AND its quote is the quote
// that was labelled (we cannot see the old quote here, so "same source" + a v2 label lookup decides; unlabelled changes are listed)
const need = [];
for (const r of rows) {
  if (!r.gate) continue;
  const v = v2by.get(`${r.key}#${r.idx}#${r.quote}`);
  if (v) { r.quoteSupports = v.quoteSupports; r.labelledBy = "v2"; }
  else if (gateName === "baseline" || sameCite(r)) { r.quoteSupports = r.label.quoteSupports; r.labelledBy = "v1"; }
  else { r.quoteSupports = undefined; r.labelledBy = "NEEDS-LABEL"; need.push(r); }
}
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + "%" : "n/a");
const G = rows.filter((r) => r.gate);
const gq = G.filter((r) => r.quoteSupports != null);
const sd = rows.filter((r) => r.label.doc === true);
const out = {
  gate: gateName, at: new Date().toISOString(), n: rows.length,
  rigAgreementWithRecordedFlags: `${agree}/${rows.length} (${pct(agree, rows.length)})`,
  appGrounded: G.length,
  precision_strict_quote: `${gq.filter((r) => r.quoteSupports).length}/${gq.length} (${pct(gq.filter((r) => r.quoteSupports).length, gq.length)})`,
  precision_doc_level: (() => { const d = G.filter((r) => r.label.doc != null); const k = d.filter((r) => r.label.doc === true || r.label.doc === "derived").length; return `${k}/${d.length} (${pct(k, d.length)})`; })(),
  recall: `${sd.filter((r) => r.gate).length}/${sd.length} (${pct(sd.filter((r) => r.gate).length, sd.length)})`,
  groundedButFalse: G.filter((r) => r.label.truth === false).map((r) => ({ key: r.key, idx: r.idx, text: r.text })),
  unlabelledNewQuotes: need.length,
  rows,
};
fs.writeFileSync(path.join(here, arg("out", `rescore-${gateName}.json`)), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ ...out, rows: undefined, groundedButFalse: out.groundedButFalse.length }, null, 1));
if (need.length && argv.includes("--list-needs")) for (const r of need) console.log(`NEEDS LABEL ${r.key}#${r.idx}\n  claim: ${r.text.slice(0, 200)}\n  quote: ${(r.quote || "").slice(0, 300)}\n  src: ${r.source}`);
