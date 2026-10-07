// fold-chat-thinkers.js — which thinkers of the ingested canon bear on this question? Pure: no DOM, no IO, no model, no network, deterministic.
//
// The same shape as the language detector (fold-chat-langid.js): static PROFILES with a giver (each thinker's own verified canon, built by
// scripts/build-thinkers.mjs into voice/thinkers-profile.json), a scoring rule, a SESSION PRIOR (the previous turn's thinkers get a head start), and a typed
// gap — `undetermined` — instead of a guess. The gate (m, tau) and the temperature T are chosen on a held-out calibration set and written INTO the profile
// (`calibration`), not in this file: eval/ants/B1-PREREG.md pre-registers the bars, eval/ants/B1-eval.mjs measures them.
//
//   features  CONTENT STEMS: closed-class words (functionWordsOf("en") + a small declared set) and numbers removed, stemmed by fold-chat-ground.js.
//   score     s_t(q) = sum over the query's known stems w (count capped) of  log((c_tw + mu*p_w)/(n_t + mu)) - log p_w        (Dirichlet-smoothed
//             query likelihood against the background p_w = the MEAN of the thinkers' own per-stem frequencies, so each thinker counts once, not by byte size)
//   posterior softmax(s / T), uniform over thinkers; the session prior adds `bonus` nats to each of the previous turn's thinkers.
//   gate      `undetermined` unless the query holds >= m known stems AND the top-3 posterior mass >= tau. A turn with NO known stem inherits nothing.
//
// What it is NOT: it does not know what a thinker MEANT. It says whose vocabulary this question's content words belong to, calibrated against held-out canon
// and against text that is not canon. Meaning-level bearing is the reader's job; what each thinker says is the pointing call's (fold-chat-provenance.js).
import { tokenize, stemOf } from "./fold-chat-ground.js";
import { functionWordsOf } from "./fold-chat-snippets.js";

export const DECLARED = Object.freeze({
  minStem: 3,            // shortest stem kept
  cap: 2,                // a query stem counts at most this many times
  listMax: 3,            // thinkers returned when a question is accepted (the gate's mass is the top-3's, so the offer is the top 3)
  mu: 2000, T: 12, m: 2, tau: 0.8, bonus: 2,   // fall-backs only; the shipped profile's `calibration` overrides them
  // Declared closed-class additions to functionWordsOf("en"): interrogatives, auxiliaries, and the archaic pronouns that would otherwise key a profile on its TRANSLATOR's idiom, not the thinker.
  extraClosed: "how why who whom whose whom when where which whether do does did done doing can could may might must am are was were be been being have has had having get gets got tell say says said saying think thinks know knows ask asks please thing things something anything everything nothing someone anyone everyone want wants need needs like make makes made thou thee thy thine thyself ye hath hast doth dost wilt shalt wouldst couldst shouldst unto yea nay lo oh ah yes also just really very much many one two".split(" "),
});

let CLOSED = null;
function closedSet() {
  if (!CLOSED) { const fw = functionWordsOf("en") || new Set(); CLOSED = new Set([...fw, ...DECLARED.extraClosed]); }
  return CLOSED;
}
/** The CONTENT STEMS of a text, in order. Closed-class words, numbers and short stems are dropped. */
export function contentStems(text) {
  const closed = closedSet(), out = [];
  for (const t of tokenize(String(text ?? ""))) {
    if (t.length < DECLARED.minStem || closed.has(t) || /\d/.test(t) || !/\p{L}/u.test(t)) continue;
    const s = stemOf(t);
    if (s && s.length >= DECLARED.minStem && !closed.has(s)) out.push(s);
  }
  return out;
}

// ── the profile, decoded ──────────────────────────────────────────────────────────────────────────────────
/** decodeProfile(json) → a model. Profile format (voice/thinkers-profile.json): vocab = the stems joined by a space; each thinker = { handle, n, c: "id:count,id:count" }. */
export function decodeProfile(profile) {
  if (!profile || !profile.vocab || !Array.isArray(profile.thinkers)) throw new Error("not a ThinkerProfile@1");
  const stems = profile.vocab.split(" "), V = stems.length, T = profile.thinkers.length;
  const index = new Map(); stems.forEach((s, i) => index.set(s, i));
  const counts = new Uint32Array(V * T);              // counts[id*T + t]
  const n = new Float64Array(T), handles = [];
  profile.thinkers.forEach((th, t) => {
    handles.push(th.handle); n[t] = th.n;
    if (th.c) for (const e of th.c.split(",")) { const k = e.indexOf(":"); counts[(+e.slice(0, k)) * T + t] = +e.slice(k + 1); }
  });
  // background: the MEAN of the thinkers' own per-stem frequencies (each thinker counts once)
  const bg = new Float64Array(V);
  for (let id = 0; id < V; id++) { let a = 0; for (let t = 0; t < T; t++) a += counts[id * T + t] / n[t]; bg[id] = a / T; }
  const speaks = profile.thinkers.map((th) => th.speaks !== false);   // a DISTRACTOR class (technical canon) competes in the posterior but is never offered
  return { profile, stems, index, V, T, counts, n, handles, bg, speaks, calibration: { ...DECLARED, ...(profile.calibration || {}) } };
}

/** The known stems of a text (or of an array of content stems already extracted) → [{ id, k }] (distinct, count capped). Unknown stems say nothing. */
export function knownStems(model, text, cap = DECLARED.cap) {
  const seen = new Map();
  for (const s of (Array.isArray(text) ? text : contentStems(text))) { const id = model.index.get(s); if (id !== undefined) seen.set(id, Math.min(cap, (seen.get(id) || 0) + 1)); }
  return [...seen].map(([id, k]) => ({ id, k }));
}

/** Raw scores s_t over all thinkers for a list of known stems. */
export function scoreKnown(model, known, mu = model.calibration.mu) {
  const { T, counts, n, bg } = model, s = new Float64Array(T);
  for (const { id, k } of known) {
    const p = bg[id], base = id * T;
    for (let t = 0; t < T; t++) s[t] += k * (Math.log((counts[base + t] + mu * p) / (n[t] + mu)) - Math.log(p));
  }
  return s;
}

/** softmax(s/Temp), with `bonusVec` (nats, per thinker) added first. */
export function posteriorOf(s, Temp, bonusVec = null) {
  const T = s.length, z = new Float64Array(T); let mx = -Infinity;
  for (let t = 0; t < T; t++) { z[t] = s[t] / Temp + (bonusVec ? bonusVec[t] : 0); if (z[t] > mx) mx = z[t]; }
  let sum = 0; for (let t = 0; t < T; t++) { z[t] = Math.exp(z[t] - mx); sum += z[t]; }
  for (let t = 0; t < T; t++) z[t] /= sum;
  return z;
}
const orderOf = (a, only = null) => [...a.keys()].filter((t) => !only || only[t]).sort((x, y) => a[y] - a[x] || x - y);

/** The session prior: { handles: [...], bonus? } from the previous turn's accepted result (or null). Like langid's `prior`. */
export const priorOf = (result, bonus) => (result && !result.undetermined && result.ranked?.length ? { handles: result.ranked.map((r) => r.handle), ...(bonus != null ? { bonus } : {}) } : null);

/**
 * classify(text, { model, prior: { handles, bonus? }, params: { mu, T, m, tau, bonus, listMax, gatePrior } })
 *   → { ranked: [{ handle, score, confidence }], undetermined: boolean, why: string, known, mass3, considered, carried? }
 * `ranked` is empty when `undetermined` (a typed gap, never a guess); `considered` (top 3) and `candidates` (top 5, speaking thinkers) are diagnostics either way: the candidates a pointing call may try to tie to a verbatim sentence, NOT an offer. Never throws.
 */
export function classify(text, { model, prior = null, params = {} } = {}) {
  const none = (why, extra = {}) => ({ ranked: [], undetermined: true, why, known: 0, mass3: 0, considered: [], ...extra });
  try {
    if (!model) return none("no-profile");
    const P = { ...model.calibration, ...params };
    const known = knownStems(model, text, P.cap);
    const carried = prior && prior.handles && prior.handles.length ? prior.handles.slice() : undefined;
    // a turn with no known stem inherits NOTHING: the thread's thinkers are carried, never offered on no evidence
    if (!known.length) return none("no-known-content-stems", { carried });
    const s = scoreKnown(model, known, P.mu);
    let bonusVec = null;
    if (prior && prior.handles) {
      bonusVec = new Float64Array(model.T);
      const b = prior.bonus ?? P.bonus;
      for (const h of prior.handles) { const t = model.handles.indexOf(h); if (t >= 0) bonusVec[t] = b; }
    }
    const post = posteriorOf(s, P.T, bonusVec), ord = orderOf(post, model.speaks), top = orderOf(post)[0];
    // The GATE reads the EVIDENCE alone (a prior reorders and re-weights, it cannot open the gate): eval/ants/B1-PREREG.md Amendment 2 — with the prior in the gate, one weak stem + a 4-nat head start offered a thinker.
    const gPost = P.gatePrior || !bonusVec ? post : posteriorOf(s, P.T), gOrd = P.gatePrior || !bonusVec ? ord : orderOf(gPost, model.speaks);
    const mass3 = gOrd.slice(0, 3).reduce((a, t) => a + gPost[t], 0);
    const hitsOf = (t) => { let h = 0; for (const { id } of known) h += model.counts[id * model.T + t]; return h; };   // how often this thinker's own TRAIN canon uses the question's known stems
    const entry = (t) => ({ handle: model.handles[t], score: +s[t].toFixed(3), confidence: +post[t].toFixed(4), hits: hitsOf(t) });
    const considered = ord.slice(0, 3).map(entry), candidates = ord.slice(0, 5).map(entry);
    const base = { known: known.length, mass3: +mass3.toFixed(4), considered, candidates, carried, closest: model.handles[top], closestSpeaks: model.speaks[top] };
    if (known.length < P.m && !(P.gateMinEvidence === false)) return { ...base, ranked: [], undetermined: true, why: `too-few-known-stems (${known.length} < ${P.m})` };
    if (mass3 < P.tau && !(P.gateMass === false)) return { ...base, ranked: [], undetermined: true, why: `no-thinker-stands-out (top-3 mass ${mass3.toFixed(2)} < ${P.tau}${model.speaks[top] ? "" : "; the closest canon is technical: " + model.handles[top]})` };
    return { ...base, ranked: ord.slice(0, P.listMax).map(entry), undetermined: false, why: "accepted" };
  } catch (e) {
    return none("error: " + (e && e.message));
  }
}

/** Convenience for a conversation: classify each user turn in order, each turn's accepted thinkers as the next turn's prior. Returns the per-turn results. */
export function classifyThread(turns, { model, params = {} } = {}) {
  const out = []; let prior = null;
  for (const t of turns) { const r = classify(t, { model, prior, params }); out.push(r); prior = priorOf(r, params.bonus) || (r.carried ? { handles: r.carried, bonus: params.bonus } : prior); }
  return out;
}
