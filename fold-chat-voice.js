// fold-chat-voice.js — the VOICE OF CONTENT, stages 1–2 (docs/VOICE.md; pre-registration eval/voice/PREREG.md). Pure: no DOM, no IO, no model, no clock.
//
// An ORGANIC, RARE aside: "This reminds me of something <holder> wrote about <topic>: “<their own words>”", chosen mechanically from ingested canon, with provenance
// (file, byte span, sha256). Nothing is said that the code did not measure. What stage 2 measures is TERM-LEVEL resonance: the conversation's content stems against
// an archon's concern-field dwellings (Zenodotus/derived-priors/concern-priors: terms the canon returns to beyond its own seeded null), weighted by how few archons share
// the term, judged against a SEEDED NULL (random roster vocabulary of the same size as the part of the conversation the roster can match). It is NOT paradigm matching (needs ethos ledger notes) and NOT curve matching
// (needs a recursive reader); the aside never claims it was chosen for either.
//
//   buildIndex(archons, fw)               archons: [{ handle, giver, work, source:{path,sha256,chars}, terms:[…] }] → the searchable index
//   conversationTerms(exchanges, fw)      Map(stem → weight): the person's words weigh 2, the fold's spoken answer 1; the closed class and short words are dropped
//   resonance(index, conv, opts)          ranked [{ handle, shared, score, p }] — p is against the seeded shuffle null (the max over archons, so it is corrected for choosing)
//   quoteFrom(text, shared, opts)         ONE verbatim sentence of the canon that carries >= 2 shared stems: { text, start, end } (slices back into `text`), or null
//   permitted(state)                      may an aside be offered THIS turn? kind, turn index, spacing, repeat, and (optionally) the real pathos condition
//   asideOf({ index, conv, text, … })     the whole decision → { aside } | { none: <typed reason> }
//   frameOf(aside)                        the fixed, app-authored sentence around the quote
//
// DECLARED, not measured (Constitution II.11), in VOICE; giver: the author's draft, 2026-10-06, to be corrected by the user. alpha is the house standing alpha (0.05).

import * as ground from "./fold-chat-ground.js";
import { sentencesWithOffsets } from "./fold-chat-impression.js";

export const VOICE = Object.freeze({
  giver: "the author's draft, 2026-10-06; declared, not measured (II.11)",
  alpha: 0.05,               // the house alpha: p against the shuffle null must be <= this
  nullDraws: 200,            // seeded shuffles of archon <-> term-set
  minShared: 2,              // distinct shared stems
  minIdf: 0.4,               // ln(N/df) a shared stem must reach to count (a term in most archons' fields tells them apart not at all)
  minStem: 4,                // characters of a content stem
  quoteMin: 40, quoteMax: 320,
  everyN: 5,                 // at most one aside per this many exchanges
  firstTurn: 2,              // never on the first exchange (1-based index of the exchange being answered must be >= this)
  kindsOff: Object.freeze(["compute", "code", "transform", "compose", "generate", "self", "smalltalk"]),
  conditionsOpen: Object.freeze(["contested", "stale"]),   // the real pathos conditions that open the gate when it is ON
});

const stemOf = (t) => (ground.stemOf ? ground.stemOf(t) : t);
const stemsOf = (text, fw) => ground.tokenize(String(text ?? "")).filter((t) => t.length >= VOICE.minStem && !(fw && fw.has(t))).map(stemOf);

export function buildIndex(archons, fw) {
  const list = (Array.isArray(archons) ? archons : []).map((a) => ({ ...a, stems: new Set((a.terms || []).flatMap((t) => stemsOf(t, fw))) })).filter((a) => a.stems.size);
  const df = new Map();
  for (const a of list) for (const s of a.stems) df.set(s, (df.get(s) || 0) + 1);
  return { archons: list, df, N: list.length, fw: fw || null };
}

export function conversationTerms(exchanges, fw) {
  const m = new Map(); m.surface = new Map();   // surface: stem -> the word as the conversation said it (for the frame)
  const note = (text, w) => { for (const t of ground.tokenize(String(text ?? ""))) { if (t.length < VOICE.minStem || (fw && fw.has(t))) continue; const s = stemOf(t); m.set(s, Math.max(m.get(s) || 0, w)); if (!m.surface.has(s)) m.surface.set(s, t); } };
  for (const e of exchanges || []) { note(e?.ask, 2); note(e?.said, 1); }
  return m;
}

const idf = (index, s) => Math.log(index.N / (index.df.get(s) || index.N));

function scoreArchon(index, stems, conv) {
  const shared = [];
  let score = 0;
  for (const [s, w] of conv) if (stems.has(s)) { const x = idf(index, s); if (x >= VOICE.minIdf) { shared.push(s); score += w * x; } }
  return { shared, score };
}

// a small seeded PRNG (mulberry32): the null is reproducible
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/**
 * Ranked archons with their score and p. The NULL: the conversation's stems that the roster's vocabulary can match (m of them) are replaced, draw by draw, by m stems drawn at
 * random from that same vocabulary (seeded); p = (1 + #draws whose best archon score >= the observed best) / (1 + draws). So p answers: would m RANDOM roster terms overlap some
 * archon this distinctively? It is corrected for choosing the best of all archons, and a conversation that touches almost nothing the roster holds cannot be beyond it.
 */
export function resonance(index, conv, { seed = 20261006, draws = VOICE.nullDraws } = {}) {
  if (!index?.archons?.length || !conv?.size) return [];
  const rows = index.archons.map((a) => ({ handle: a.handle, ...scoreArchon(index, a.stems, conv) }));
  const best = Math.max(0, ...rows.map((r) => r.score));
  if (!best) return [];
  const pool = [...index.df.keys()];
  const inPool = [...conv].filter(([s]) => index.df.has(s));
  const m = inPool.length;
  const rand = rng(seed);
  let ge = 0;
  for (let d = 0; d < draws; d++) {
    const fake = new Map();
    for (let k = 0; k < m; k++) fake.set(pool[Math.floor(rand() * pool.length)], inPool[k][1]);
    let nb = 0; for (const a of index.archons) nb = Math.max(nb, scoreArchon(index, a.stems, fake).score);
    if (nb >= best) ge++;
  }
  const p = (1 + ge) / (1 + draws);
  return rows.filter((r) => r.shared.length).map((r) => ({ handle: r.handle, shared: r.shared, score: r.score, p })).sort((a, b) => b.score - a.score);
}

/** One verbatim sentence of the canon with >= 2 distinct shared stems (the most, then the shortest), as offsets into `text`. */
export function quoteFrom(text, shared, { min = VOICE.quoteMin, max = VOICE.quoteMax } = {}) {
  const want = new Set(shared || []);
  if (want.size < 2) return null;
  let best = null;
  for (const s of sentencesWithOffsets(String(text ?? ""))) {
    const len = s.end - s.start;
    if (len < min || len > max) continue;
    const letters = (s.text.match(/\p{L}/gu) || []).length;
    if (letters / len < 0.7) continue;                        // a table, a heading, a run of numerals
    if (!/[.!?。！？]["')\]”’」』]*$/u.test(s.text)) continue;   // ends like a sentence
    const have = new Set(ground.tokenize(s.text).map(stemOf).filter((x) => want.has(x)));
    if (have.size < 2) continue;
    if (!best || have.size > best.n || (have.size === best.n && len < best.len)) best = { text: s.text, start: s.start, end: s.end, n: have.size, len, matched: [...have] };
  }
  return best ? { text: best.text, start: best.start, end: best.end, matched: best.matched } : null;
}

/** The same choice from a prebuilt BANK of verbatim sentences ({ text, start, end, stems }): the one carrying the most shared stems (>= 2), then the shortest. The page uses this: it cannot read the canon. */
export function quoteFromBank(bank, shared) {
  const want = new Set(shared || []);
  let best = null;
  for (const e of Array.isArray(bank) ? bank : []) {
    const have = (e.stems || []).filter((s) => want.has(s));
    if (have.length < 2) continue;
    const len = e.end - e.start;
    if (!best || have.length > best.n || (have.length === best.n && len < best.len)) best = { text: e.text, start: e.start, end: e.end, n: have.length, len, matched: have };
  }
  return best ? { text: best.text, start: best.start, end: best.end, matched: best.matched } : null;
}

/** May an aside be offered THIS turn? `condition` is the real pathos condition (fold-chat-pathos.js readFelt) or null; `gate: true` requires it to be open. */
export function permitted({ kind = null, exchangeIndex = 1, sinceLast = Infinity, condition = null, gate = false, used = [], handle = null } = {}) {
  if (VOICE.kindsOff.includes(kind)) return { ok: false, why: "kind:" + kind };
  if (exchangeIndex < VOICE.firstTurn) return { ok: false, why: "first_exchange" };
  if (sinceLast < VOICE.everyN) return { ok: false, why: "too_soon" };
  if (handle && used.includes(handle)) return { ok: false, why: "repeat_archon" };
  if (gate) { if (!condition) return { ok: false, why: "pathos_unread" }; if (!VOICE.conditionsOpen.includes(condition)) return { ok: false, why: "pathos:" + condition }; }
  return { ok: true, why: null };
}

const clean = (g) => String(g ?? "").replace(/\s*\([^)]*\)\s*$/u, "").trim();

export function frameOf(a) {
  return `This reminds me of something ${a.holder} wrote about ${a.topic}: “${a.quote.text}” I'm not sure it fits, but it came to mind.`;
}

/**
 * The whole decision. `texts` = { [handle]: canon text } OR `bank` = { [handle]: [{ text, start, end, stems }] } (loaded by the caller; the module never reads a file). → { aside } | { none: reason, … }.
 * The aside carries everything an audit needs: holder, work, quote, the file's path/sha256 and the byte span, the shared stems, the score and p.
 */
export function asideOf({ index, conv, texts, bank = null, state = {}, seed, draws } = {}) {
  const ranked = resonance(index, conv, { seed, draws });
  if (!ranked.length) return { none: "no_resonance", ranked };
  for (const r of ranked) {
    if (r.shared.length < VOICE.minShared) continue;
    if (r.p > VOICE.alpha) return { none: "not_beyond_null", best: r, ranked };
    const gate = permitted({ ...state, handle: r.handle });
    if (!gate.ok) return { none: gate.why, best: r, ranked };
    const a = index.archons.find((x) => x.handle === r.handle);
    const text = texts?.[r.handle];
    if (!text && !bank?.[r.handle]) return { none: "canon_not_loaded", best: r, ranked };
    const q = bank?.[r.handle] ? quoteFromBank(bank[r.handle], r.shared) : quoteFrom(text, r.shared);
    if (!q) continue;
    const topicStem = [...r.shared].sort((x, y) => idf(index, y) - idf(index, x))[0];
    const aside = { handle: r.handle, holder: clean(a.giver), work: a.work, topic: conv.surface?.get(topicStem) || topicStem, quote: q, source: { ...a.source, start: q.start, end: q.end }, shared: r.shared, score: r.score, p: r.p, grade: "canon" };
    return { aside: { ...aside, text: frameOf(aside) }, ranked };
  }
  return { none: "no_quotable_sentence", ranked };
}
