// eval/ants/p1/lib.mjs — shared: the passage set of a question, the graders (by CODE), bootstrap, timing, jsonl store.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { BATTERY } from "./battery.mjs";
import { page, titles, passageOf } from "./corpus.mjs";
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const RESULTS = path.join(HERE, "results");
fs.mkdirSync(RESULTS, { recursive: true });
const h32 = (s) => parseInt(crypto.createHash("sha1").update(s).digest("hex").slice(0, 8), 16);

/** the fixed passage set of a question: gold pages + 2 hash-picked distractors (none for R12/R13), hash-shuffled */
export function passageSet(q) {
  const gold = q.pages;
  let list = gold.map((t) => ({ t, gold: true }));
  if (q.rung !== 12 && q.rung !== 13) {
    const pool = titles().filter((t) => !gold.includes(t) && page(t).text.length >= 5000 && !/^(?:List of|\d{4} )/.test(t));
    const picked = [];
    for (let k = 0; picked.length < 2 && k < 50; k++) { const t = pool[h32(q.id + ":" + k) % pool.length]; if (!picked.includes(t)) picked.push(t); }
    list = list.concat(picked.map((t) => ({ t, gold: false })));
  }
  list.sort((a, b) => h32(q.id + "|" + a.t) - h32(q.id + "|" + b.t));
  return list.map((x) => ({ ...passageOf(x.t), _gold: x.gold }));
}
export const byId = (id) => BATTERY.find((q) => q.id === id);
export const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

// ───────────────────────── graders (written before any arm ran) ─────────────────────────
const REFUSE = /(?:cannot|can't|can not|unable|not (?:stated|mentioned|provided|specified|given|contain\w*|available|say|covered|clear|found)|no (?:information|mention|record|data|answer)|does(?:n't| not) (?:say|state|mention|specify|contain|provide|have)|don't know|do not know|subjective|opinion|depends|no single|matter of|there is no|isn't (?:stated|mentioned)|neither)/i;
export const refuses = (t) => REFUSE.test(String(t ?? ""));
const DISAGREE = /\b(?:disagree\w*|differ\w*|conflict\w*|inconsisten\w*|contradict\w*|discrepan\w*|not agree|do not match|don't match|vary|varies|varying)\b/i;
const POS = /\b(?:taller|higher|longer|larger|bigger|older|earlier|deeper|greater|heavier|farther|further|more|first|before|earlier|longer-lived|lived longer)\b/i;
const NEG = /\b(?:shorter|lower|smaller|younger|later|less|fewer|nearer|closer|lighter|after)\b/i;

/** read the verdict of a two-entity comparison out of an answer: 'right' | 'wrong' | 'none' */
export function compareVerdict(text, { win, lose, kind }) {
  const t = String(text ?? "");
  const iw = t.search(win), il = t.search(lose);
  if (iw < 0 && il < 0) return "none";
  if (iw >= 0 && il < 0) return "right";
  if (il >= 0 && iw < 0) return "wrong";
  // both named: find "than"/"before"/"after"-structure first
  const m = /([^.;]*?)\b(than|before|after|earlier than|later than)\b([^.;]*)/i.exec(t);
  if (m) {
    const a = m[1], b = m[3], word = m[2].toLowerCase();
    const subjWin = win.test(a) && !lose.test(a), subjLose = lose.test(a) && !win.test(a);
    const cmpWord = (a + " " + word).match(new RegExp(NEG.source, "i"));
    let flip = !!cmpWord && !/\bbefore\b/.test(word) ? true : /\bafter\b/.test(word) || /\blater than\b/.test(word);
    if (/\b(?:not|never|no|n't)\b|n't/i.test(a)) flip = !flip;
    if (subjWin) return flip ? "wrong" : "right";
    if (subjLose) return flip ? "right" : "wrong";
    if (win.test(b) && !lose.test(b)) return flip ? "right" : "wrong";
    if (lose.test(b) && !win.test(b)) return flip ? "wrong" : "right";
  }
  return iw < il ? "right" : "wrong";
}
const hasNegFrame = (text, re) => {
  const t = String(text ?? "");
  const r = new RegExp(re.source, "i");
  for (const s of t.split(/(?<=[.!?;])\s+/)) if (r.test(s) && /\b(?:not|isn't|aren't|wasn't|weren't|no|never|neither|nor|none|doesn't|don't|didn't|cannot|can't)\b/i.test(s)) {
    // negation must be near the option
    const i = s.search(r); const win = s.slice(Math.max(0, i - 40), i + 40);
    if (/\b(?:not|isn't|aren't|wasn't|weren't|no|never|neither|nor|none|doesn't|don't|didn't|cannot|can't)\b/i.test(win)) return true;
  }
  return false;
};
const FIGS = (t) => String(t).match(/\d[\d,.]*\d|\d/g) || [];
const CAPS = (t) => (String(t).match(/\b[A-Z][a-z]{3,}\b/g) || []);

/** grade a STATED answer (composed arms). returns {ok, why} */
export function gradeStated(q, text, { gap = false } = {}) {
  const t = String(text ?? "");
  if (!q.answerable) {
    if (gap || (t.trim() === "")) return { ok: true, why: "gap" };
    if (q.opinion) return { ok: refuses(t), why: refuses(t) ? "declined" : "committed" };
    return { ok: refuses(t), why: refuses(t) ? "declined" : "answered-unanswerable" };
  }
  if (gap || !t.trim()) return { ok: false, why: "gap-on-answerable" };
  if (q.keys) return gradeSummary(q, t);
  if (q.vals) {
    const bothVals = q.vals.every((v) => v.test(t));
    const dis = DISAGREE.test(t);
    if (q.agree === false) return { ok: dis && bothVals, why: dis ? (bothVals ? "ok" : "missing-values") : "missed-disagreement" };
    return { ok: !dis && q.vals.some((v) => v.test(t)), why: dis ? "false-disagreement" : (q.vals.some((v) => v.test(t)) ? "ok" : "no-value") };
  }
  if (q.opts) {
    const named = q.opts.gold.test(t);
    const wrongNeg = q.opts.wrong.some((w) => hasNegFrame(t, w));
    const goldFirst = (() => { const gi = t.search(q.opts.gold); return gi >= 0 && q.opts.wrong.every((w) => { const wi = t.search(w); return wi < 0 || gi <= wi || hasNegFrame(t, q.opts.gold); }); })();
    if (!named) return { ok: false, why: "gold-option-absent" };
    if (wrongNeg) return { ok: false, why: "wrong-option-negated" };
    return { ok: goldFirst || hasNegFrame(t, q.opts.gold), why: "ok" };
  }
  if (q.cmp) {
    const v = compareVerdict(t, q.cmp);
    return { ok: v === "right", why: v };
  }
  const goldOk = (q.gold || []).every((g) => g.test(t));
  const bad = (q.forbid || []).find((f) => f.test(t));
  return { ok: goldOk && !bad, why: !goldOk ? "gold-missing" : bad ? "forbidden" : "ok" };
}
export function gradeSummary(q, t) {
  const page0 = norm(passageOf(q.pages[0]).text);
  const hit = q.keys.filter((k) => k.test(t)).length;
  const cov = hit / q.keys.length;
  const pf = new Set(FIGS(page0)); const inv = FIGS(t).filter((f) => !pf.has(f) && !page0.includes(f));
  const pc = new Set(CAPS(page0).map((x) => x.toLowerCase())); const invN = CAPS(t).filter((c) => !pc.has(c.toLowerCase()) && !/^(?:The|This|Its|Summary|Here|These|They|Despite|However|Although|While|During|After|Before)$/.test(c));
  return { ok: cov >= 0.6 && inv.length === 0 && invN.length === 0, why: cov < 0.6 ? "coverage" : inv.length ? "invented-figure" : invN.length ? "invented-name" : "ok", coverage: cov, invented: inv.concat(invN) };
}
/** grade a SNIPPET arm's output: evidence complete in the returned text (and R5 co-location) */
export function gradeSnippets(q, snips, { gap = false } = {}) {
  const parts = (Array.isArray(snips) ? snips : [snips]).map((s) => norm(typeof s === "string" ? s : s?.text));
  const text = parts.join(" \n ");
  if (!q.answerable) return { ok: gap || !text.trim(), why: gap || !text.trim() ? "gap" : "returned-passages-for-unanswerable", chars: text.length };
  if (gap || !text.trim()) return { ok: false, why: "gap-on-answerable", chars: 0 };
  if (q.keys) { const r = gradeSummary(q, text); return { ...r, chars: text.length }; }
  const evText = (Array.isArray(snips) ? snips : [snips]).map((x) => norm(typeof x === "string" ? x : [x?.text, x?.from].filter(Boolean).join(" "))).join(" \n ");   // a mechanically rewritten snip is checked against the sentence it came from too
  const needsOk = (q.needs || []).every(([, re]) => re.test(text) || re.test(evText));
  let ok = needsOk, why = needsOk ? "ok" : "evidence-missing";
  if (ok && q.coref) {
    const together = parts.some((p) => q.coref.ent.test(p) && q.coref.attr.test(p));
    if (!together) { ok = false; why = "coref-dangling"; }
  }
  const first = parts.length ? (q.needs || []).every(([, re]) => re.test(parts[0])) : false;
  return { ok, why, chars: text.length, precise: ok && text.length <= 600, firstSnip: first };
}

// ───────────────────────── stats ─────────────────────────
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function bootCI(xs, { n = 4000, seed = 12345 } = {}) {
  if (!xs.length) return [NaN, NaN];
  const r = rng(seed), m = xs.length, means = [];
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < m; j++) s += xs[Math.floor(r() * m)]; means.push(s / m); }
  means.sort((a, b) => a - b);
  return [means[Math.floor(0.025 * n)], means[Math.min(n - 1, Math.floor(0.975 * n))]];
}
export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
export const median = (xs) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// ───────────────────────── resumable result store ─────────────────────────
export function store(arm) {
  const file = path.join(RESULTS, `${arm}.jsonl`);
  const done = new Map();
  if (fs.existsSync(file)) for (const l of fs.readFileSync(file, "utf8").split("\n").filter(Boolean)) { try { const o = JSON.parse(l); done.set(o.id, o); } catch {} }
  return { file, done, put(o) { done.set(o.id, o); fs.appendFileSync(file, JSON.stringify(o) + "\n"); } };
}
export async function timed(fn) { const t0 = performance.now(); let out, err = null; try { out = await fn(); } catch (e) { err = String(e?.stack || e).slice(0, 400); } return { out, err, ms: Math.round(performance.now() - t0) }; }
export const argv = (name, dflt = null) => { const i = process.argv.indexOf("--" + name); return i < 0 ? dflt : (process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : true); };
export function selected() {
  const rung = argv("rung"), id = argv("id"), limit = +argv("limit", 0);
  let qs = BATTERY.filter((q) => (rung ? rung.split(",").map(Number).includes(q.rung) : true) && (id ? id.split(",").includes(q.id) : true));
  if (limit) { const per = {}; qs = qs.filter((q) => (per[q.rung] = (per[q.rung] || 0) + 1) <= limit); }
  return qs;
}
export { BATTERY };

// ───────── POST-HOC REGRADE (v2). Written after reading the first model outputs; the v1 grades stay in the rows and are reported next to v2 (P1-PREREG: "BOTH numbers are reported"). ─────────
// Two grader errors found by reading outputs: (a) a REFUSAL on an answerable comparison ("the text does not contain the length of the Great Wall or the Nile") passed `compareVerdict`
// because the fallback "the winner is named first" fired on a text that makes no comparison; (b) a text that merely lists both entities' dates ("Fleming lived until 1955. Curie lived until 1934")
// passed for the same reason. v2: an answerable question answered by a refusal is a MISS, and with both entities named a verdict needs a verdict cue.
const VERDICT_CUE = /\b(?:than|before|after|first|earlier|later|older|younger|taller|shorter|longer|higher|lower|larger|smaller|more|fewer|less|deeper|greater|lived longer|born first|died first|came first|oldest|youngest|tallest|longest)\b/i;
export function compareVerdict2(text, c) {
  const t = String(text ?? "");
  const iw = t.search(c.win), il = t.search(c.lose);
  if (iw >= 0 && il >= 0 && !VERDICT_CUE.test(t)) return "none";
  return compareVerdict(t, c);
}
export function gradeStated2(q, text, opts = {}) {
  const t = String(text ?? "");
  if (q.answerable && !opts.gap && t.trim() && refuses(t) && !q.vals && !q.keys && !q.opts) return { ok: false, why: "refused-answerable" };
  // R13, sources agree (agree:true): the verdict is the answer; a date written "January 30, 1948" must not fail a regex that expects "30 January 1948"
  if (q.answerable && q.vals && q.agree === true && !opts.gap && t.trim()) { const dis = DISAGREE.test(t); const aff = /\b(?:yes|agree[sd]?|same|consistent|match(?:es)?)\b/i.test(t) || q.vals.some((v) => v.test(t)); return { ok: !dis && aff && !/^\s*no\b/i.test(t), why: dis ? "false-disagreement" : aff ? "ok" : "no-verdict" }; }
  if (q.answerable && q.cmp && !opts.gap && t.trim()) { const v = compareVerdict2(t, q.cmp); return { ok: v === "right", why: v }; }
  const g = gradeStated(q, t, opts);
  // R5: a stated answer that opens with a bare pronoun and never names the entity leaves the pronoun dangling (B returns the row's own sentence, "He led an invasion ... 1798")
  if (g.ok && q.coref && /^\s*(?:He|She|It|They)\b/.test(t) && !q.coref.ent.test(t)) return { ok: false, why: "coref-dangling" };
  return g;
}
