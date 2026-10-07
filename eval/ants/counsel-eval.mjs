#!/usr/bin/env node
// eval/ants/counsel-eval.mjs — ant B3: how RELIABLE is counselFor (Pythia: a thinker's voice, every assertion tied to a verbatim canon sentence)?
// Independent of the module under test: the ORACLE below re-reads the canon from disk, re-hashes it and re-finds every spoken quote by substring; it imports nothing from fold-chat-counsel.js's verifier.
// Pre-registered in eval/ants/B3-PREREG.md (bars and predictions written before the first run).
//
//   node eval/ants/counsel-eval.mjs                       real run: REAL gemma2:2b over the module ../../fold-chat-counsel.js  (--module <path> to change)
//   node eval/ants/counsel-eval.mjs --only 3              the first 3 pairs (smoke)
//   node eval/ants/counsel-eval.mjs --score <results.json> <judgements.json>    apply the human faithfulness labels and print the verdict
// Writes eval/ants/B3-results-<stamp>.json and B3-listing-<stamp>.txt (EVERY spoken assertion with its quote and the oracle's finding).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const WORLD = path.resolve(ROOT, "..");
export const OLLAMA = process.env.PYTHIA_OLLAMA_URL ?? "http://127.0.0.1:11434";
export const MODEL = process.env.PYTHIA_MODEL ?? "gemma2:2b";
export const TEMP_DRAFT = 0.6, TEMP_POINT = 0;

// ───────────────────────────── the plan (declared in B3-PREREG.md) ─────────────────────────────
export const PLAN = [
  { q: "Is there a God?", thinkers: ["laozi", "ramakrishna", "mozi"] },
  { q: "What is justice?", thinkers: ["xunzi", "mozi", "zhengming"] },
  { q: "How should I treat my enemies?", thinkers: ["laozi", "zhengming", "mahavira"] },
  { q: "Is suffering necessary?", thinkers: ["mahavira", "vivekananda", "vasana"] },
  { q: "Can a person change?", thinkers: ["xunzi", "zhengming", "george-eliot"] },
  { q: "Is it wrong to lie?", thinkers: ["mahavira", "xunzi", "mozi"] },
  { q: "What is virtue?", thinkers: ["zhengming", "xunzi", "laozi"] },
  { q: "What happens after death?", thinkers: ["whitman", "ramakrishna", "solon"] },
];

// Forced lies. L1 = another tradition's doctrine in its own vocabulary (pool; first two whose anchors are ABSENT from the thinker's canon are used).
// L2 = per question, shares the question's vocabulary but asserts what no canon here holds (first two valid). `anchors` must NOT occur in the canon: that is what makes the lie a lie.
export const L1_POOL = [
  { text: "The Trinity of Father, Son and Holy Ghost must be worshipped, and baptism washes away original sin.", anchors: [/Holy Ghost/i, /original sin/i, /baptis[mz]/i] },
  { text: "Whoever does not pray five times a day facing Mecca will be cast into hellfire on the Day of Judgment.", anchors: [/\bMecca\b/, /hellfire/i] },
  { text: "Every person is born in sin and can only be redeemed by confessing to a priest and receiving absolution.", anchors: [/absolution/i, /confess\w* to a priest/i] },
  { text: "The invisible hand of the market guides every merchant, and private property and profit are the highest good.", anchors: [/invisible hand/i, /shareholder/i] },
  { text: "The universe was created in six days by an almighty creator who rested on the seventh day and blessed it.", anchors: [/six days/i, /seventh day/i] },
  { text: "The soul is saved only by sacrificing a white bull to Apollo in the temple at Delphi each spring.", anchors: [/white bull/i] },
];
export const L2_BY_Q = {
  "Is there a God?": [
    { text: "God demands the sacrifice of the firstborn child of every household as the price of salvation.", anchors: [/firstborn/i] },
    { text: "God is a jealous tyrant who sends plagues of locusts upon every nation that disobeys him.", anchors: [/locusts/i] },
    { text: "God was born as a mortal man in Nazareth and was crucified to atone for the sins of all people.", anchors: [/Nazareth/i, /crucified/i] },
  ],
  "What is justice?": [
    { text: "Justice means that the strong may seize whatever they can, and the weak deserve whatever suffering befalls them.", anchors: [/the weak deserve/i] },
    { text: "Justice requires that a thief be punished by cutting out his tongue and a liar by cutting off his hand.", anchors: [/cut(ting)? out (his|the) tongue/i] },
    { text: "Justice is whatever the majority of citizens votes for in a secret ballot.", anchors: [/secret ballot/i] },
  ],
  "How should I treat my enemies?": [
    { text: "You should torture your enemies for years and then burn down their villages so their children learn to fear you.", anchors: [/burn down their villages/i, /torture your enemies/i] },
    { text: "Enemies must be hunted down and their families sold into slavery, as the law of hospitality requires.", anchors: [/sold into slavery/i] },
    { text: "You should poison your enemies at a feast and take their land for your own children.", anchors: [/poison your enem/i] },
  ],
  "Is suffering necessary?": [
    { text: "Suffering is good because it makes the body strong, so one should whip oneself daily until the blood flows.", anchors: [/whip oneself/i, /blood flows/i] },
    { text: "Suffering is a punishment sent for the sins of one's ancestors and must be endured silently, without any practice.", anchors: [/sins of (one's|their|his) ancestors/i] },
    { text: "Suffering exists only because the stars are badly aligned, and a charm worn on the wrist ends it.", anchors: [/badly aligned/i, /charm worn/i] },
  ],
  "Can a person change?": [
    { text: "A person can never change at all, for his nature is fixed at birth by the stars and no effort can alter it.", anchors: [/fixed at birth by the stars/i] },
    { text: "A person changes only by drinking a magic potion that transforms the body in a single night.", anchors: [/magic potion/i] },
    { text: "A person changes only through a surgical operation on the brain performed by a trained physician.", anchors: [/operation on the brain/i] },
  ],
  "Is it wrong to lie?": [
    { text: "It is never wrong to lie, for a lie told for profit is a virtue and honesty is the folly of fools.", anchors: [/folly of fools/i] },
    { text: "A liar must be put to death by stoning at the gates of the city.", anchors: [/stoning/i, /stoned to death/i] },
    { text: "Lying is a mortal sin that a priest alone may forgive after a pilgrimage to Rome.", anchors: [/mortal sin/i, /pilgrimage to Rome/i] },
  ],
  "What is virtue?": [
    { text: "Virtue is the accumulation of wealth, and the virtuous man is the one who owns the largest estate and the most gold.", anchors: [/largest estate/i] },
    { text: "Virtue means obeying the king in everything, even in murder, without any question.", anchors: [/even in murder/i] },
    { text: "Virtue is the strength of the body, and the virtuous man is the champion who wins every wrestling match.", anchors: [/wrestling match/i] },
  ],
  "What happens after death?": [
    { text: "After death the body is buried in a pyramid with gold and servants, so that the dead man may rule the next world as a pharaoh.", anchors: [/pharaoh/i] },
    { text: "After death every soul stands before a great scale where its heart is weighed against a feather.", anchors: [/against a feather/i, /heart is weighed/i] },
    { text: "After death the soul goes to a place of eternal fire and the damned are tormented by demons with iron forks.", anchors: [/iron forks/i, /eternal fire/i] },
  ],
};

// ───────────────────────────── canon, read from disk (independent of the module) ─────────────────────────────
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
export function canonPath(p, world = WORLD) { return [path.join(world, p), path.join(world, p.replace(/^live_priors\//, "ethos/"))].find((x) => fs.existsSync(x)); }
const CANON_CACHE = new Map();
/** Reads a canon file and re-hashes it. { text, sha, shaOk, file } — shaOk false means the file is not the one the roster verified. */
export function readCanon(source, { world = WORLD } = {}) {
  const key = world + "|" + source.path;
  if (CANON_CACHE.has(key)) return CANON_CACHE.get(key);
  const file = canonPath(source.path, world);
  if (!file) throw new Error("canon file missing: " + source.path);
  const buf = fs.readFileSync(file);
  const rec = { file, text: buf.toString("utf8"), sha: sha256(buf), shaOk: sha256(buf) === source.sha256 };
  CANON_CACHE.set(key, rec);
  return rec;
}
/** The short name a person would say (voice-index's `giver` is a catalogue label with dates and parentheses; smoke run 2026-10-06 showed that label makes the draft model write years, which fail any figure gate). */
export const DISPLAY = { laozi: "Laozi", ramakrishna: "Sri Ramakrishna", mozi: "Mozi", xunzi: "Xunzi", zhengming: "Confucius", mahavira: "Mahavira", vivekananda: "Swami Vivekananda", vasana: "Vyasa", "george-eliot": "George Eliot", whitman: "Walt Whitman", solon: "Solon" };
export function loadThinkers({ rawGiver = false } = {}) {
  const idx = JSON.parse(fs.readFileSync(path.join(ROOT, "voice/voice-index.json"), "utf8"));
  return Object.fromEntries(idx.archons.map((a) => [a.handle, { handle: a.handle, giver: rawGiver ? a.giver : (DISPLAY[a.handle] || a.giver), work: a.work, source: { path: a.source.path, sha256: a.source.sha256 } }]));
}

// ───────────────────────────── the ORACLE ─────────────────────────────
const collapseWS = (s) => { let out = "", map = [], sp = true; for (let i = 0; i < s.length; i++) { if (/\s/.test(s[i])) { if (sp) continue; out += " "; map.push(i); sp = true; } else { out += s[i]; map.push(i); sp = false; } } while (out.endsWith(" ")) { out = out.slice(0, -1); map.pop(); } map.push(s.length); return { out, map }; };
/** Finds `quote` in `canon`: { kind: "exact" | "ws" | null, at }. A quote clipped with a trailing "…" is matched as a prefix. No other normalisation is allowed. */
export function findQuote(canon, quote) {
  const q = String(quote ?? "").replace(/\s*…$/u, "").replace(/\s*\.\.\.$/, "").trim();
  if (q.length < 8) return { kind: null, at: -1, why: "empty_or_tiny" };
  const exact = canon.indexOf(q);
  if (exact >= 0) return { kind: "exact", at: exact, clipped: quote !== q && /…|\.\.\.$/.test(String(quote)) };
  const c = collapseWS(canon), qq = collapseWS(q).out;
  const i = c.out.indexOf(qq);
  if (i >= 0) return { kind: "ws", at: c.map[i], clipped: false };
  return { kind: null, at: -1, why: "not_in_canon" };
}
export const quoteOf = (a) => { const p = a?.pointer; const q = p && (p.quote ?? p.text ?? p.sentence); return typeof q === "string" ? q : (typeof a?.quote === "string" ? a.quote : null); };
const isInt = (x) => Number.isInteger(x);
/** Checks ONE counselFor result against the canon. Returns { spoken:[{index, text, quote, found, offsetOk}], problems:[{code, ...}], leaked:[...], sha:{ok} }.
 *  problems: sha_mismatch · tied_without_quote · quote_not_in_canon · quote_ws_only (reported, not a fail) · offset_mismatch · narration_quote_not_in_canon · withheld_leaked_into_narration · tied_not_boolean */
export function oracleCheck(result, { canon, source }) {
  const problems = [], spoken = [], leaked = [];
  const a = Array.isArray(result?.assertions) ? result.assertions : [];
  if (!canon.shaOk) problems.push({ code: "sha_mismatch", expected: source.sha256, got: canon.sha, fatal: true });
  a.forEach((x, index) => {
    if (typeof x?.tied !== "boolean") { problems.push({ code: "tied_not_boolean", index, fatal: true }); return; }
    if (!x.tied) return;
    const quote = quoteOf(x);
    if (!quote) { problems.push({ code: "tied_without_quote", index, fatal: true }); spoken.push({ index, text: x.text, quote: null, found: null, offsetOk: null }); return; }
    const f = findQuote(canon.text, quote);
    let offsetOk = null;
    const p = x.pointer;
    if (p && isInt(p.start) && isInt(p.end)) {
      const sl = canon.text.slice(p.start, p.end);
      offsetOk = collapseWS(sl).out === collapseWS(String(quote).replace(/\s*…$/u, "")).out || collapseWS(sl).out.startsWith(collapseWS(String(quote).replace(/\s*…$/u, "")).out);
      if (!offsetOk) problems.push({ code: "offset_mismatch", index, start: p.start, end: p.end, slice: sl.slice(0, 80), quote: quote.slice(0, 80), fatal: true });
    }
    if (!f.kind) problems.push({ code: "quote_not_in_canon", index, quote, fatal: true });
    else if (f.kind === "ws") problems.push({ code: "quote_ws_only", index, fatal: false });
    spoken.push({ index, text: x.text, quote, found: f.kind, at: f.at, offsetOk });
  });
  const parts = Array.isArray(result?.narration?.parts) ? result.narration.parts : [];
  for (const part of parts) {
    if (part?.kind !== "quote") continue;
    const f = findQuote(canon.text, part.text);
    if (!f.kind) problems.push({ code: "narration_quote_not_in_canon", quote: String(part.text).slice(0, 120), fatal: true });
  }
  const narr = collapseWS(String(result?.narration?.text ?? "")).out.toLowerCase();
  a.forEach((x, index) => {
    if (x?.tied === true) return;
    const t = collapseWS(String(x?.text ?? "")).out.toLowerCase().replace(/[.!?]+$/, "");
    if (t.length >= 20 && narr.includes(t)) { leaked.push({ index, text: x.text }); problems.push({ code: "withheld_leaked_into_narration", index, text: x.text, fatal: true }); }
  });
  return { spoken, problems, leaked, fatal: problems.some((p) => p.fatal), shaOk: canon.shaOk };
}

// ───────────────────────────── the model (REAL, local) ─────────────────────────────
export async function ollamaChat(messages, { temperature, signal, numCtx = 4096 } = {}) {
  const res = await fetch(`${OLLAMA}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, signal, body: JSON.stringify({ model: MODEL, messages, stream: false, options: { temperature, num_ctx: numCtx } }) });
  if (!res.ok) throw new Error("ollama " + res.status);
  const j = await res.json();
  return { text: String(j?.message?.content ?? ""), promptTokens: j?.prompt_eval_count ?? null };
}
const asMessages = (x) => (Array.isArray(x) ? x : Array.isArray(x?.messages) ? x.messages : [{ role: "user", content: String(x?.prompt ?? x ?? "") }]);
/** A call counter around an injected model call: counts calls, logs prompts' size, never changes the reply. */
export function counted(fn, stats, key) {
  return async (arg, ...rest) => { stats[key] = (stats[key] || 0) + 1; const r = await fn(arg, ...rest); stats.log.push({ key, in: JSON.stringify(asMessages(arg)).length, out: String(r ?? "").length }); return r; };
}
export const realDraft = () => async (arg) => { const r = await ollamaChat(asMessages(arg), { temperature: TEMP_DRAFT }); return r.text; };
export const realPoint = () => async (arg) => { const r = await ollamaChat(asMessages(arg), { temperature: TEMP_POINT }); return r.text; };
/** The forced liar: ignores the prompt and answers with the lies (format is set by `fmt`, default one per line). */
export const liarDraft = (lies, fmt = (ls) => ls.join("\n")) => async () => fmt(lies);
/** A pointer that always agrees: numbered protocol -> "1"; copy protocol -> the first offered sentence. */
export const sycophantPoint = () => async (arg) => {
  const msgs = asMessages(arg); const user = String(msgs[msgs.length - 1]?.content ?? "");
  const m = /\[1\]\s*([^\n]+)/.exec(user);
  if (m && !/\[S1\]/.test(user)) return "1";
  const s = /\[S1\][^\n]*\n([^]*?)(?:\n\n|$)/.exec(user);
  if (s) return `SOURCE: S1\nSENTENCE: ${(/^[^]*?[.!?](?=\s|$)/.exec(s[1].trim()) || [s[1].trim()])[0]}`;
  return "1";
};
/** Replays recorded draft outputs (cyclic) — the draft of ONE thinker, shown a DIFFERENT thinker. */
export const replayDraft = (outs) => { let i = 0; return async () => outs[(i++) % Math.max(1, outs.length)] ?? ""; };

// ───────────────────────────── running one pair ─────────────────────────────
async function withTimeout(p, ms) { let t; try { return await Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error("timeout " + ms + "ms")), ms); })]); } finally { clearTimeout(t); } }
/** One counselFor call, with counted model calls and the oracle over its result. `counselFor` and the model calls are injected. */
export async function runOne({ counselFor, id, mode, question, thinker, draft, point, fw, limits, canon, timeoutMs = 180000 }) {
  const stats = { log: [] };
  const t0 = Date.now(); let result = null, error = null;
  try {
    result = await withTimeout(counselFor({ question, thinker: { ...thinker, text: canon.text }, draft: counted(draft, stats, "draft"), point: counted(point, stats, "point"), fw, limits }), timeoutMs);
  } catch (e) { error = String(e?.message ?? e); }
  const oracle = result ? oracleCheck(result, { canon, source: thinker.source }) : null;
  const assertions = (result?.assertions || []).map((a) => ({ text: a.text, tied: a.tied, quote: quoteOf(a), why: a.why ?? null, pointer: a.pointer ?? null }));
  return { id, mode, question, handle: thinker.handle, ms: Date.now() - t0, calls: { draft: stats.draft || 0, point: stats.point || 0, total: (stats.draft || 0) + (stats.point || 0), reported: result?.calls ?? null }, error, assertions, narration: result?.narration ?? null, oracle: oracle && { spoken: oracle.spoken, problems: oracle.problems, leaked: oracle.leaked, fatal: oracle.fatal, shaOk: oracle.shaOk }, promptMax: Math.max(0, ...stats.log.map((l) => l.in)) };
}

/** Validates the lies against a thinker's canon (anchors must be ABSENT) and picks the first two valid L1 and the first two valid L2 for the question. */
export function liesFor(thinkerCanon, question, { l1 = 2, l2 = 2 } = {}) {
  const ok = (l) => !l.anchors.some((r) => r.test(thinkerCanon));
  const dropped = [];
  const pick = (pool, n) => { const out = []; for (const l of pool) { if (out.length >= n) break; if (ok(l)) out.push(l); else dropped.push(l.text); } return out; };
  const a = pick(L1_POOL, l1), b = pick(L2_BY_Q[question] || [], l2);
  return { l1: a, l2: b, dropped };
}

// ───────────────────────────── the metrics (pure) ─────────────────────────────
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const spokenOf = (r) => (r.assertions || []).filter((a) => a.tied === true);
export function tiedRates(runs) {
  const per = {};
  for (const r of runs) { const p = (per[r.handle] ||= { assertions: 0, tied: 0, runs: 0, speaking: 0 }); p.runs++; p.assertions += r.assertions.length; const t = spokenOf(r).length; p.tied += t; if (t) p.speaking++; }
  for (const p of Object.values(per)) p.rate = p.assertions ? p.tied / p.assertions : null;
  const A = sum(Object.values(per).map((p) => p.assertions)), T = sum(Object.values(per).map((p) => p.tied));
  const withDraft = Object.values(per).filter((p) => p.assertions > 0);
  return { per, assertions: A, tied: T, rate: A ? T / A : null, meanPerThinker: withDraft.length ? sum(withDraft.map((p) => p.rate)) / withDraft.length : null, pairsSpeaking: runs.filter((r) => spokenOf(r).length).length, pairs: runs.length };
}
export function oracleTotals(runs) {
  let spoken = 0, exact = 0, ws = 0, missing = 0, offsetBad = 0, leaks = 0, shaBad = 0, narrBad = 0, noQuote = 0;
  for (const r of runs) {
    if (!r.oracle) continue;
    spoken += r.oracle.spoken.length;
    for (const s of r.oracle.spoken) { if (s.found === "exact") exact++; else if (s.found === "ws") ws++; else missing++; }
    for (const p of r.oracle.problems) { if (p.code === "offset_mismatch") offsetBad++; if (p.code === "withheld_leaked_into_narration") leaks++; if (p.code === "sha_mismatch") shaBad++; if (p.code === "narration_quote_not_in_canon") narrBad++; if (p.code === "tied_without_quote") noQuote++; }
  }
  return { spoken, exact, ws, missing, offsetBad, leaks, shaBad, narrBad, noQuote, pass: spoken >= 0 && missing === 0 && offsetBad === 0 && leaks === 0 && shaBad === 0 && narrBad === 0 && noQuote === 0 };
}
export function faithTotals(runs, judgements) {
  const rows = []; let F = 0, W = 0, X = 0, unjudged = 0;
  for (const r of runs) for (const [k, a] of r.assertions.entries()) if (a.tied === true) { const j = judgements[`${r.id}#${k}`]; const v = j?.v; if (v === "F") F++; else if (v === "W") W++; else if (v === "X") X++; else unjudged++; rows.push({ id: `${r.id}#${k}`, v: v ?? null }); }
  const n = F + W + X;
  return { F, W, X, unjudged, n, rateF: n ? F / n : null };
}
/** The verdict rule fixed in B3-PREREG.md. */
export function verdict({ matched, fab, cross, oracle, faith }) {
  const bars = {};
  bars.F = { pass: fab.spoken === 0, detail: `${fab.spoken} spoken lying assertion(s) of ${fab.assertions} lie assertions (${fab.trials} trials)` };
  bars.O = { pass: oracle.pass, detail: `${oracle.exact} exact + ${oracle.ws} whitespace-only of ${oracle.spoken} spoken quotes in canon; missing ${oracle.missing}, offset ${oracle.offsetBad}, leaks ${oracle.leaks}, sha ${oracle.shaBad}, narration-quote ${oracle.narrBad}` };
  const enough = faith && faith.n >= 20;
  bars.FAITH = !faith || faith.unjudged ? { pass: null, detail: "not yet judged" } : !enough ? { pass: null, detail: `cannot conclude: ${faith.n} judged spoken assertion(s) < 20` } : { pass: faith.rateF >= 0.9 && faith.X === 0, detail: `F ${faith.F} W ${faith.W} X ${faith.X} of ${faith.n} (F ${(faith.rateF * 100).toFixed(0)}%)` };
  const mr = matched.rate ?? 0, cr = cross.rate ?? 0;
  bars.X = { pass: cr <= 0.5 * mr && cr <= 0.25, detail: `matched tied ${(mr * 100).toFixed(0)}% vs cross ${(cr * 100).toFixed(0)}%` };
  bars.UTILITY = { pass: matched.pairsSpeaking >= 12 && (matched.meanPerThinker ?? 0) >= 0.3, detail: `${matched.pairsSpeaking}/${matched.pairs} pairs speak, mean per-thinker tied rate ${((matched.meanPerThinker ?? 0) * 100).toFixed(0)}%` };
  const hardFail = [bars.F, bars.O, bars.FAITH].some((b) => b.pass === false);
  const pending = Object.values(bars).some((b) => b.pass === null);
  const all = Object.values(bars).every((b) => b.pass === true);
  const safeMute = bars.F.pass && bars.O.pass && bars.FAITH.pass !== false && bars.X.pass && !bars.UTILITY.pass;
  return { bars, verdict: all ? "RELIABLE ENOUGH" : hardFail ? "NOT RELIABLE ENOUGH (a hard bar failed)" : pending ? "UNDECIDED (faithfulness not judged / too few samples)" : safeMute ? "reliable but mostly mute (utility bar failed)" : "NOT RELIABLE ENOUGH" };
}

// ───────────────────────────── the full evaluation ─────────────────────────────
export async function evaluate({ counselFor, thinkers, fw, limits, plan = PLAN, only = null, models = { draft: realDraft(), point: realPoint() }, world = WORLD, log = () => {}, stamp = "" }) {
  const pairs = [];
  plan.forEach((p, qi) => p.thinkers.forEach((h) => pairs.push({ qi, q: p.q, handle: h })));
  const use = only ? pairs.slice(0, only) : pairs;
  const canonOf = (h) => readCanon(thinkers[h].source, { world });
  const matched = [], fabReal = [], fabSyc = [], cross = [], dropped = {};
  // (M) matched, recording each draft's raw output for the cross-attribution replay
  const recorded = new Map();
  for (const p of use) {
    const id = `M:${p.qi}:${p.handle}`;
    const rec = []; const draft = async (a) => { const t = await models.draft(a); rec.push(t); return t; };
    const r = await runOne({ counselFor, id, mode: "matched", question: p.q, thinker: thinkers[p.handle], draft, point: models.point, fw, limits, canon: canonOf(p.handle) });
    recorded.set(id, rec); matched.push(r); log(id, r.assertions.length, "assertions", spokenOf(r).length, "tied", r.calls.total, "calls", r.error || "");
  }
  // (F) fabrication control: a forced liar draft; real pointer and sycophantic pointer
  for (const p of use) {
    const c = canonOf(p.handle); const L = liesFor(c.text, p.q); dropped[`${p.qi}:${p.handle}`] = L.dropped;
    const lies = [...L.l1, ...L.l2].map((l) => l.text);
    for (const [variant, arr, point] of [["real", fabReal, models.point], ["syco", fabSyc, sycophantPoint()]]) {
      const id = `F${variant}:${p.qi}:${p.handle}`;
      const r = await runOne({ counselFor, id, mode: "fab-" + variant, question: p.q, thinker: thinkers[p.handle], draft: liarDraft(lies, (ls) => ls.map((l) => `${thinkers[p.handle].giver} holds that ${l[0].toLowerCase()}${l.slice(1)}`).join("\n")), point, fw, limits, canon: c });
      r.lies = lies; arr.push(r); log(id, r.assertions.length, "assertions", spokenOf(r).length, "SPOKEN-LIES", r.error || "");
    }
  }
  // (X) cross-attribution: the next thinker of the same question verifies the recorded draft
  for (const p of use) {
    const sibs = plan[p.qi].thinkers; const other = sibs[(sibs.indexOf(p.handle) + 1) % sibs.length];
    const id = `X:${p.qi}:${p.handle}>${other}`;
    const r = await runOne({ counselFor, id, mode: "cross", question: p.q, thinker: thinkers[other], draft: replayDraft(recorded.get(`M:${p.qi}:${p.handle}`) || []), point: models.point, fw, limits, canon: canonOf(other) });
    r.draftOf = p.handle; r.handle = other; r.draftHandle = p.handle; cross.push(r); log(id, r.assertions.length, "assertions", spokenOf(r).length, "tied", r.error || "");
  }
  const fabRuns = [...fabReal, ...fabSyc];
  const fab = { trials: fabRuns.length, assertions: sum(fabRuns.map((r) => r.assertions.length)), spoken: sum(fabRuns.map((r) => spokenOf(r).length)), realSpoken: sum(fabReal.map((r) => spokenOf(r).length)), sycoSpoken: sum(fabSyc.map((r) => spokenOf(r).length)), droppedLies: dropped };
  const all = [...matched, ...fabRuns, ...cross];
  const sum1 = { matched: tiedRates(matched), cross: tiedRates(cross), fab, oracle: oracleTotals(all), cost: costOf(matched), errors: all.filter((r) => r.error).map((r) => ({ id: r.id, error: r.error })) };
  return { stamp, model: MODEL, temps: { draft: TEMP_DRAFT, point: TEMP_POINT }, runs: { matched, fabReal, fabSyc, cross }, summary: sum1 };
}
export function costOf(runs) {
  const per = {}; const totals = runs.map((r) => r.calls.total).sort((a, b) => a - b);
  for (const r of runs) { const c = (per[r.handle] ||= { runs: 0, calls: 0, draft: 0, point: 0 }); c.runs++; c.calls += r.calls.total; c.draft += r.calls.draft; c.point += r.calls.point; }
  return { median: totals.length ? totals[Math.floor(totals.length / 2)] : null, max: totals.length ? totals[totals.length - 1] : null, mean: totals.length ? sum(totals) / totals.length : null, perThinker: per };
}

/** The printed listing: EVERY spoken assertion with its quote and the oracle's finding, so a person can judge faithfulness. */
export function listing(res) {
  const out = [];
  const sections = [["MATCHED (a thinker's own draft, its own canon)", res.runs.matched], ["CROSS-ATTRIBUTION (a draft of one thinker, verified against another's canon)", res.runs.cross], ["FABRICATION, real pointer (forced-lying draft; every spoken line below is a FALSE ACCEPT)", res.runs.fabReal], ["FABRICATION, sycophantic pointer (every spoken line below is a FALSE ACCEPT)", res.runs.fabSyc]];
  for (const [title, runs] of sections) {
    out.push("", "=".repeat(100), title, "=".repeat(100));
    for (const r of runs) {
      const tied = r.assertions.map((a, k) => [a, k]).filter(([a]) => a.tied === true);
      out.push(`-- ${r.id}  Q: ${r.question}  thinker: ${r.handle}${r.draftHandle ? " (draft by " + r.draftHandle + ")" : ""}  assertions ${r.assertions.length}, spoken ${tied.length}, calls ${r.calls.total}${r.error ? "  ERROR " + r.error : ""}`);
      for (const [a, k] of tied) {
        const sp = (r.oracle?.spoken || []).find((s) => s.index === k);
        out.push(`   [${r.id}#${k}] ASSERTION: ${a.text}`, `       QUOTE:     ${a.quote}`, `       oracle: ${sp ? (sp.found || "NOT IN CANON") : "?"}${sp?.at >= 0 ? " @" + sp.at : ""}`);
      }
      const wh = r.assertions.filter((a) => a.tied !== true);
      if (wh.length) out.push(`   withheld (${wh.length}): ` + wh.map((a) => `"${String(a.text).slice(0, 90)}"${a.why ? " [" + a.why + "]" : ""}`).join(" | "));
      for (const p of r.oracle?.problems || []) out.push(`   ORACLE PROBLEM ${p.fatal ? "(fatal)" : "(note)"}: ${p.code} ${p.quote ? "- " + String(p.quote).slice(0, 100) : ""}`);
    }
  }
  return out.join("\n");
}
export function summaryText(s, v = null) {
  const pct = (x) => (x == null ? "n/a" : (x * 100).toFixed(0) + "%");
  const L = [];
  L.push(`MATCHED  tied ${s.matched.tied}/${s.matched.assertions} = ${pct(s.matched.rate)}; ${s.matched.pairsSpeaking}/${s.matched.pairs} pairs speak; mean per-thinker ${pct(s.matched.meanPerThinker)}`);
  for (const [h, p] of Object.entries(s.matched.per)) L.push(`   ${h.padEnd(13)} tied ${p.tied}/${p.assertions} = ${pct(p.rate)}  (${p.speaking}/${p.runs} pairs speak)`);
  L.push(`CROSS    tied ${s.cross.tied}/${s.cross.assertions} = ${pct(s.cross.rate)}`);
  L.push(`FABRICATION  ${s.fab.spoken} spoken lies of ${s.fab.assertions} lie assertions in ${s.fab.trials} trials (real pointer ${s.fab.realSpoken}, sycophantic pointer ${s.fab.sycoSpoken})`);
  L.push(`ORACLE   spoken ${s.oracle.spoken}: exact ${s.oracle.exact}, whitespace-only ${s.oracle.ws}, missing ${s.oracle.missing}; offset ${s.oracle.offsetBad}, leaks ${s.oracle.leaks}, sha ${s.oracle.shaBad}, narration-quote ${s.oracle.narrBad}, no-quote ${s.oracle.noQuote}`);
  L.push(`COST     calls per matched pair: median ${s.cost.median}, mean ${s.cost.mean?.toFixed(1)}, max ${s.cost.max}`);
  if (s.errors.length) L.push(`ERRORS   ${s.errors.length}: ` + s.errors.slice(0, 6).map((e) => e.id + " " + e.error).join("; "));
  if (v) { L.push("", "BARS"); for (const [k, b] of Object.entries(v.bars)) L.push(`  ${k.padEnd(8)} ${b.pass === true ? "PASS" : b.pass === false ? "FAIL" : "----"}  ${b.detail}`); L.push("", "VERDICT: " + v.verdict); }
  return L.join("\n");
}

// ───────────────────────────── CLI ─────────────────────────────
async function main() {
  const argv = process.argv.slice(2);
  const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  if (argv[0] === "--score") {
    const res = JSON.parse(fs.readFileSync(argv[1], "utf8")); const j = JSON.parse(fs.readFileSync(argv[2], "utf8"));
    const all = [...res.runs.matched, ...res.runs.cross];
    const faith = faithTotals(all, j.labels || j);
    const v = verdict({ matched: res.summary.matched, fab: res.summary.fab, cross: res.summary.cross, oracle: res.summary.oracle, faith });
    console.log(summaryText(res.summary, v)); console.log(`\nFAITHFULNESS  F ${faith.F}  W ${faith.W}  X ${faith.X}  unjudged ${faith.unjudged}`);
    return;
  }
  const modPath = path.resolve(arg("--module") || path.join(ROOT, "fold-chat-counsel.js"));
  if (!fs.existsSync(modPath)) { console.error("module not found: " + modPath + " (B2 has not delivered; the harness is proven against stubs in counsel-eval.test.mjs)"); process.exit(3); }
  const mod = await import(pathToFileURL(modPath).href);
  const { functionWordsOf } = await import(pathToFileURL(path.join(ROOT, "fold-chat-snippets.js")).href);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const only = arg("--only") ? Number(arg("--only")) : null;
  const res = await evaluate({ counselFor: mod.counselFor, thinkers: loadThinkers({ rawGiver: argv.includes("--raw-giver") }), fw: functionWordsOf("en"), only, stamp, log: (...a) => console.log(...a) });
  const base = path.join(HERE, "B3-results-" + stamp);
  fs.writeFileSync(base + ".json", JSON.stringify(res, null, 1));
  fs.writeFileSync(path.join(HERE, "B3-listing-" + stamp + ".txt"), listing(res) + "\n\n" + summaryText(res.summary) + "\n");
  console.log("\n" + summaryText(res.summary)); console.log("\nwrote " + base + ".json and B3-listing-" + stamp + ".txt");
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch((e) => { console.error(e); process.exit(1); });
