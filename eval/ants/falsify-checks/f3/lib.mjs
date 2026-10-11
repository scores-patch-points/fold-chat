// F3 harness library: build records the way fold-chat.js builds them, run the nine falsifiers and the headline arithmetic.
// Pure apart from reading files. Imports the REAL modules (fold-chat-present.js, fold-chat-ground.js); never edits them.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "../../../..");

export async function load(presentPath = path.join(ROOT, "fold-chat-present.js")) {
  const present = await import(presentPath + (presentPath.includes("?") ? "" : ""));
  const ground = await import(path.join(ROOT, "fold-chat-ground.js"));
  return { present, ground };
}

const siteOf = (dom, title) => `${/wikipedia/.test(dom) ? "Wikipedia" : dom} — ${title}`;
/** A synthetic turn record: turnRecord() + agreementOf() from the repo over authored pages, tape `quick` events as the server writes them. */
export function mkRec(c, { present, ground }) {
  const material = (c.pages || []).map(([dom, title, text]) => ({ ref: siteOf(dom, title), source: `https://${dom}/wiki/${encodeURIComponent(title)}`, url: `https://${dom}/wiki/${encodeURIComponent(title)}`, text }));
  const rec = ground.turnRecord(c.answer, material, { turn: 1, question: c.question || "" });
  if (material.length) { try { const ag = present.agreementOf(c.answer, material); if (ag) rec.agreement = ag; } catch {} }
  rec.passages = material;
  rec.tape = material.map((m, i) => ({ at: i, seq: i, kind: "quick", n: i + 1, of: material.length, p: { text: m.text, url: m.url, ref: m.ref } }));
  if (c.noClaims) rec.noClaims = "synthetic: the model wrote no claims (vacuity probe)";
  return rec;
}

/** The headline, replicated from fold-chat-presentview.js ~L283 (falsifiers computed from presentationOf's meanChecks/fz) and ~L351-355
 *  (bad/flag counted over the three grains of each row). Returns the exact string the page would show, or null when no checks line is drawn. */
export function headlineOf(rec, { present }, question = "") {
  const pres = present.presentationOf(rec, { question });
  if (!pres) return null;
  let rows = null;
  if (pres.layout !== "creative" && pres.layout !== "unsupported") rows = present.falsifiersOf(rec, { meanChecks: pres.meanChecks, fz: pres.fz });
  let bad = 0, flag = 0, total = 0; const perRow = [];
  if (rows) {
    total = rows.length;
    for (const r of rows) { const st = [r.ground, r.figure, r.pattern].map((c) => c?.status); const k = st.includes("failed") ? "failed" : (st.includes("gap") || st.includes("refused")) ? "flagged" : "ok"; perRow.push({ op: r.op, k, st, row: r }); if (k === "failed") bad++; else if (k === "flagged") flag++; }
  } else { total = (pres.checks || []).length; bad = (pres.checks || []).filter((c) => !c.ok).length; }
  const text = !total ? null : bad ? `${bad} of ${total} checks failed` : flag ? `${flag} of ${total} checks flagged` : `held ${total} checks`;
  return { layout: pres.layout, rows, perRow, bad, flag, total, text, pres };
}

/** Classify each flagged cell's text by the code's OWN wording: did the check run and find something (PROBLEM), or say it could not run / had nothing to test (NOTRUN)? */
export const NOTRUN_RX = [
  /could not run/, /none of the answer's terms is defined/, /every attestation traces to one site/, /each cited passage appears in one page only/,
  /no claim's link is stated by a source/, /links not read as relations/, /only one source per edge/, /not a pass, and not a failure/, /not measured/, /not tracked/,
];
export function cellClass(cell) { if (!cell) return null; if (cell.status === "failed") return "PROBLEM"; if (cell.status === "gap" || cell.status === "refused") return NOTRUN_RX.some((rx) => rx.test(cell.found || "")) ? "NOTRUN" : "PROBLEM"; return null; }
/** A flagged ROW is PROBLEM if any flagged/failed cell in it is PROBLEM; else NOTRUN. */
export function rowClass(row) { const cs = [row.ground, row.figure, row.pattern].map(cellClass).filter(Boolean); return !cs.length ? null : cs.includes("PROBLEM") ? "PROBLEM" : "NOTRUN"; }
/** The honest wording's number: rows failed + rows flagged-with-a-problem-found. */
export function honestCount(h) { if (!h?.rows) return 0; return h.perRow.filter((p) => p.k !== "ok" && rowClass(p.row) === "PROBLEM").length; }
export function notRunCount(h) { if (!h?.rows) return 0; return h.perRow.filter((p) => p.k === "flagged" && rowClass(p.row) === "NOTRUN").length; }
export const honestText = (h) => { if (!h?.rows) return null; const f = h.perRow.filter((p) => p.k === "failed").length, p = h.perRow.filter((p) => p.k === "flagged" && rowClass(p.row) === "PROBLEM").length, n = notRunCount(h); return `${f} failed · ${p} flagged · ${n} could not run`; };

export function auc(pos, neg) { if (!pos.length || !neg.length) return null; let w = 0; for (const p of pos) for (const n of neg) w += p > n ? 1 : p === n ? 0.5 : 0; return w / (pos.length * neg.length); }
export const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
export const rowOf = (h, op) => h?.perRow.find((p) => p.op === op);
export const flagged = (p) => p && p.k !== "ok";
/** the per-row status the figure cell reports (what the row's own text decides), and the worst of three grains */
export const figStatus = (p) => p?.row.figure.status;

export function loadCases() { return JSON.parse(fs.readFileSync(path.join(HERE, "cases.json"), "utf8")).cases; }
export function loadReal() {
  const out = [];
  for (const f of ["real-a.json", "real-b.json", "real-c.json"]) { const p = path.join(HERE, f); if (fs.existsSync(p)) for (const r of JSON.parse(fs.readFileSync(p, "utf8"))) if (r.rec?.grounding?.facing) out.push({ ...r, file: f }); }
  return out;
}
export function loadLabels() { const p = path.join(HERE, "real-labels.json"); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {}; }

/** DEF's matching, replicated from fold-chat-present.js for DISPLAY ONLY (what counted as "the definition"). Mirrors lines ~268-280. */
export function defsDisplay(rec) {
  const DEF_STOP = new Set("about above after again against along among around because before being below between could during every first found given great having their there these those through under until using various where which while whose would which other often still since since".split(" "));
  const resp = rec?.facing?.response || [], text = resp.map((r) => r.text).join(" ");
  const readTxt = [...(rec?.tape || []).filter((e) => e.kind === "quick").map((e) => String(e.p?.text || "")), ...(rec?.facing?.sources || []).map((s) => [s.before, s.mark, s.after].join(" "))].map((x) => x.slice(0, 4000));
  const cw = (s) => new Set((String(s).toLowerCase().match(/[\p{L}]{5,}/gu) || []).filter((w) => !DEF_STOP.has(w)));
  const terms = [...cw(text)].slice(0, 12), defd = [];
  const DEF_RX = /^[\p{L}-]+\b[^.]{0,30}?\b(?:is|are|refers to|means|is defined as)\b([^.]{8,160})/iu;
  for (const t of terms) { for (const x of readTxt) { const low = x.toLowerCase(); let at = low.indexOf(t), hit = null; for (let k = 0; at >= 0 && k < 6 && !hit; k++, at = low.indexOf(t, at + t.length)) { if (at > 0 && /[\p{L}]/u.test(low[at - 1])) continue; const m = DEF_RX.exec(x.slice(at, at + 220)); if (m) hit = m[1]; } if (hit) { defd.push({ t, d: hit.trim() }); break; } } if (defd.length >= 5) break; }
  return defd;
}
