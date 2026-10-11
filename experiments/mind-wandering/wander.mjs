// wander.mjs — an agentic loop that wanders on a topic with little to no model.
//
// THE QUESTION THIS FILE ANSWERS IS AN EXPERIMENT, NOT A PRODUCT. Given a topic
// and (almost) no model, how far can the Fold's own machinery drift from the
// topic before it is no longer about the topic at all — and can a mechanical
// re-anchor rule bring it home? The agent here is a loop that OWNS a growing
// transcript and, every step, chooses a MOVE and performs it. The moves are
// taken from the fold's own stance ladder (extraction -> cultivation ->
// encounter, void-loop.js): stay on what was heard, bind to a neighbour, or
// supply what nothing named.
//
// NO MODEL DECIDES ANYTHING HERE. The generation is `continuation.js` (khora
// native/kernel): an order-N prior sedimented from a real corpus, sampled
// proportionally to counts. The move is chosen by a MEASURED fact (the running
// topic overlap), never by a model. The one place a model may enter is the gap
// the machinery itself names: a topic the corpus never heard (out of
// vocabulary). That is the fold's own doctrine (skills.js: mechanical first,
// one constrained call next, the free model path last) — and it is off by
// default, so `--model none` spends zero model tokens.
//
// THE WALL is kept: every generated token carries `from: "prior"` (or
// `from: "model"`), so a transcript can never be mistaken for something heard.

import fs from "node:fs";
import { sedimentPrior, predictNext, scorePrequential, lcg } from "../../../khora/native/kernel/continuation.js";

export const WANDER_SCHEMA = "EOMindWander@1";
export const WANDER_VERSION = 1;

// The same reference corpus prose-prior.js uses as a real prose stream. A
// caller can point at any real text file(s); the default is one public-domain
// novel so the run reproduces on any machine that has Zenodotus.
export const DEFAULT_CORPUS = "/Users/mlacy/Documents/3.0/Zenodotus/01-literature-books/gutenberg/pg345_Dracula.txt";
export const DEFAULT_ORDER = 2;

// Tokens a real reader would call words, plus the sentence punctuation the
// prior must learn to emit for the transcript to have sentence shape.
const WORD_RE = /[a-z]+(?:'[a-z]+)?|[.,;:!?]/g;

/** tokenize(text) -> lowercased word/punctuation events. */
export function tokenize(text) {
  return String(text ?? "").toLowerCase().match(WORD_RE) ?? [];
}

/** Sentence shape for display: no space before punctuation, capital after a
 *  terminator. Pure; used only for rendering. */
export function detokenize(tokens) {
  let out = "";
  let cap = true;
  for (const t of tokens ?? []) {
    if (/^[.,;:!?]$/.test(t)) { out = out.replace(/\s+$/, "") + t; cap = t === "." || t === "!" || t === "?"; continue; }
    out += (out && !/\s$/.test(out) ? " " : "") + (cap ? t.charAt(0).toUpperCase() + t.slice(1) : t);
    cap = false;
  }
  return out.trim();
}

const STOP = new Set("the a an and or of to in on at it is was were be been being i you he she we they his her their its as for with that this from by not but if so then than there here what which who how when where why all any some no nor do did does have has had will would can could may might must about into over under out up down".split(" "));
export const isStop = (t) => STOP.has(t);

/**
 * loadPrior({ corpusPaths, order }) -> {
 *   prior, tokens, vocab:Set, cooc:Map<word, Map<word,count>>, oov:boolean
 * }
 * `cooc` is a windowed co-occurrence table over content words — the mechanical
 * ground for the `associate` move and for the topic-overlap measurement. A
 * missing corpus is a disclosed failure, never a faked prior.
 */
export function loadPrior({ corpusPaths = [DEFAULT_CORPUS], order = DEFAULT_ORDER, window = 6 } = {}) {
  const tokens = [];
  const read = [];
  for (const p of corpusPaths) {
    let text;
    try { text = fs.readFileSync(p, "utf8"); }
    catch { return { ok: false, reason: `corpus not readable: ${p}` }; }
    read.push(p);
    for (const t of tokenize(text)) tokens.push(t);
  }
  if (!tokens.length) return { ok: false, reason: "corpus tokenized to nothing" };
  const prior = sedimentPrior(tokens, { order, giver: `mind-wandering:${read.map((p) => p.split("/").pop()).join("+")}` });

  // Windowed co-occurrence over content words only (function words would drown it).
  const content = [];
  const posOf = new Map(); // token index in `content` -> original index, to bound windows
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (/^[a-z]/.test(t) && !isStop(t) && t.length > 2) { posOf.set(content.length, i); content.push(t); }
  }
  const cooc = new Map();
  const bump = (a, b, n = 1) => {
    if (!cooc.has(a)) cooc.set(a, new Map());
    const m = cooc.get(a);
    m.set(b, (m.get(b) ?? 0) + n);
  };
  for (let i = 0; i < content.length; i += 1) {
    for (let j = i + 1; j < content.length; j += 1) {
      if (posOf.get(j) - posOf.get(i) > window) break;
      bump(content[i], content[j]);
      bump(content[j], content[i]);
    }
  }
  return { ok: true, prior, tokens, vocab: new Set(prior.alphabet.keys()), cooc, corpora: read };
}

/** topNeighbours(prior, word, n) -> [word] by co-occurrence count, content only. */
export function topNeighbours(loaded, word, n = 8) {
  const m = loaded.cooc.get(String(word).toLowerCase());
  if (!m) return [];
  return [...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n).map(([w]) => w);
}

/** Sample one event from a distribution Map, with a temperature (0 = greedy)
 *  and an injected rng. Deterministic given rng. */
export function sampleDist(dist, { rng, temperature = 1 } = {}) {
  if (typeof rng !== "function") throw new TypeError("sampleDist: rng is declared");
  const entries = [...dist];
  if (!entries.length) return null;
  if (temperature <= 0) return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  const weights = entries.map(([, p]) => Math.pow(p, 1 / temperature));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < entries.length; i += 1) { r -= weights[i]; if (r <= 0) return entries[i][0]; }
  return entries[entries.length - 1][0];
}

/** orderedCandidates(dist, { rng, temperature, n }) -> up to `n` events, drawn
 *  WITHOUT replacement, weighted by the distribution (temperature-shaped). The
 *  gate walks this list so the token that streams is both likely and licensed,
 *  not merely the single top draw. Deterministic given rng. */
export function orderedCandidates(dist, { rng, temperature = 1, n = 16 } = {}) {
  const pool = [...dist].map(([e, p]) => ({ e, w: temperature <= 0 ? p : Math.pow(p, 1 / temperature) })).filter((x) => x.w > 0);
  const out = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((a, x) => a + x.w, 0);
    let r = rng() * total, k = 0;
    for (; k < pool.length; k += 1) { r -= pool[k].w; if (r <= 0) break; }
    if (k >= pool.length) k = pool.length - 1;
    out.push(pool[k].e); pool.splice(k, 1);
  }
  return out;
}

/** Mix a prior distribution toward the topic's own follow-distribution. The
 *  topic pull is a NUMBER the run declares (0 = pure drift, 1 = recite the
 *  topic) — the loop's one free variable, exactly void-loop.js's ladder rung. */
export function mixedDist(prior, context, topicDist, pull = 0) {
  const p = predictNext(prior, context);
  if (!topicDist || pull <= 0) return p;
  const dist = new Map(p.dist);
  for (const [e, q] of topicDist) dist.set(e, (dist.get(e) ?? 0) * (1 - pull) + q * pull);
  let total = 0; for (const v of dist.values()) total += v;
  for (const [e, v] of dist) dist.set(e, v / total);
  return { grain: p.grain, total, dist, mixed: true };
}

/** topicDistOf(prior, topicWords) -> the merged follow-distribution after the
 *  topic's own words (what the corpus says usually comes next). */
export function topicDistOf(prior, topicWords) {
  const acc = new Map();
  for (const w of topicWords) {
    const p = predictNext(prior, [w]);
    for (const [e, q] of p.dist) acc.set(e, (acc.get(e) ?? 0) + q);
  }
  const total = [...acc.values()].reduce((a, b) => a + b, 0) || 1;
  for (const [e, v] of acc) acc.set(e, v / total);
  return acc;
}

/** overlap(windowTokens, topicWords, loaded) -> [0,1] how much of the recent
 *  window is the topic or a measured neighbour of it. This is the MEASURED
 *  fact the move rule reads; no model is consulted. */
export function topicOverlap(windowTokens, topicWords, loaded) {
  const topicSet = new Set(topicWords);
  const neighbourhood = new Set(topicWords);
  for (const w of topicWords) for (const nb of topNeighbours(loaded, w, 12)) neighbourhood.add(nb);
  const content = (windowTokens ?? []).filter((t) => /^[a-z]/.test(t) && !isStop(t));
  if (!content.length) return { overlap: 1, content: 0 };
  let hit = 0;
  for (const t of content) if (topicSet.has(t)) hit += 1; else if (neighbourhood.has(t)) hit += 0.5;
  return { overlap: Math.min(1, hit / content.length), content: content.length };
}

/**
 * makeWanderer({ loaded, topic, seed, order, temperature, anchorEvery,
 *                driftBelow, homeAbove, model }) -> { step(), state }
 *
 * The loop. Each `step()` advances the transcript by ONE event and returns a
 * disclosed decision record. The move is chosen from the measured overlap:
 *
 *   anchor  — pull hard to the topic (overlap has fallen below `driftBelow`)
 *   reopen  — hard reset the context to the topic (drift has run long)
 *   drift   — truncate the context to one word so the prior leads unanchored
 *   associate — jump the context to the topic's strongest neighbour (a tangent)
 *   continue — the ordinary rung: extend the current context, lightly anchored
 *
 * `model` is an optional async (topic) => string. It is called at most once,
 * and ONLY when the topic is out of the corpus vocabulary — the named gap.
 */
export function makeWanderer({
  loaded, topic, seed = 1, order = DEFAULT_ORDER, temperature = 0.9,
  anchorEvery = 40, associateEvery = 17, driftP = 0.16, driftBelow = 0.05,
  homeAbove = 0.2, maxDriftRun = 30, model = null, gate = null,
} = {}) {
  if (!loaded?.ok) throw new TypeError("makeWanderer: a loaded prior is required");
  const rng = lcg(seed);
  const topicWords = tokenize(topic).filter((t) => /^[a-z]/.test(t) && !isStop(t));
  if (!topicWords.length) throw new TypeError("makeWanderer: the topic names no content word");

  let oov = topicWords.every((w) => !loaded.vocab.has(w));
  const transcript = tokenize(topic); // the seed words ARE the first heard events
  let context = transcript.slice(-order);
  let driftRun = 0;
  let modelCalls = 0;
  let modelText = null;
  const events = [];

  const state = () => ({
    transcript: [...transcript],
    context: [...context],
    driftRun,
    modelCalls,
    oov,
    topicWords: [...topicWords],
    steps: events.length,
  });

  /** The one place a model may enter; async because so is the caller's. */
  async function gapFill() {
    if (!model || modelCalls > 0 || !oov) return false;
    modelCalls += 1;
    try {
      modelText = String(await model(topic) ?? "").trim();
    } catch { modelText = null; }
    if (modelText) {
      const evs = tokenize(modelText);
      // The model's gloss becomes heard material for THIS run only; every
      // token it supplied is marked, so it can never pass as corpus-heard.
      for (const e of evs) { transcript.push(e); context.push(e); }
      context = context.slice(-order);
      oov = false;
      return true;
    }
    return false;
  }

  function pickMove(ov) {
    if (driftRun >= maxDriftRun) return "reopen";
    if (ov.overlap < driftBelow && driftRun >= 4) return "anchor";
    if (events.length && events.length % associateEvery === 0) return "associate";
    if (events.length > 8 && rng() < driftP) return "drift";
    return "continue";
  }

  /** One step. Async only so the model gap can be awaited; with no model it
   *  resolves immediately and synchronously in effect. */
  async function step() {
    if (oov) { const filled = await gapFill(); if (!filled) { /* fall through: prior still answers at grain 0 */ } }

    const window = transcript.slice(-24);
    const ov = topicOverlap(window, topicWords, loaded);
    const move = pickMove(ov);
    const topicDist = move === "drift" ? null : topicDistOf(loaded.prior, topicWords);

    let activeContext = context;
    if (move === "reopen" || move === "anchor") activeContext = topicWords.slice(-order);
    if (move === "drift") activeContext = context.slice(-1);
    if (move === "associate") {
      const hub = topicWords.map((w) => topNeighbours(loaded, w, 1)[0]).filter(Boolean)[0] ?? context.at(-1);
      activeContext = [hub ?? context.at(-1)].filter(Boolean);
    }
    if (!activeContext.length) activeContext = [topicWords.at(-1)];

    const pull = move === "anchor" || move === "reopen" ? 0.85 : move === "continue" ? 0.25 : 0;
    const dist = mixedDist(loaded.prior, activeContext, topicDist, pull);
    const source = "prior"; // generation is always the prior's; a model may only seed context (marked in `modelText`)

    // ── the gate: Janus decides what is allowed to stream ────────────────────
    // The head is the last CONTENT word already in the transcript. Each
    // proposed token is offered to the gate in weighted order; the first the
    // gate licenses is the one that streams, and every refusal is disclosed.
    const head = [...transcript].reverse().find((t) => /^[a-z]/.test(t) && t.length > 2 && !isStop(t)) ?? null;
    let event, janusVerdict = null, refusedTokens = [];
    if (gate) {
      const cands = orderedCandidates(dist.dist, { rng, temperature, n: 16 });
      for (const c of cands) {
        const v = gate.judge(head, c);
        if (v.ok) { event = c; janusVerdict = v; break; }
        refusedTokens.push({ token: c, kind: v.kind });
        if (!janusVerdict) janusVerdict = v;
      }
      if (event == null) {
        // Nothing the prior offered the gate would license. Do not force an
        // incoherent token: re-anchor and disclose the dead end.
        context = topicWords.slice(-order);
        const rec = {
          n: transcript.length, move: "janus_refused", event: null, grain: dist.grain ?? null,
          overlap: +ov.overlap.toFixed(3), pull, driftRun, source,
          context: activeContext.join(" "), janus: janusVerdict, refusedTokens: refusedTokens.slice(0, 6),
          text: detokenize(transcript.slice(-Math.min(transcript.length, 40))), modelCalls,
        };
        events.push(rec);
        return rec;
      }
    } else {
      event = sampleDist(dist.dist, { rng, temperature });
    }

    context.push(event);
    context = context.slice(-Math.max(order, 2));
    transcript.push(event);

    // Drift is a RUN of off-topic steps, whatever moves produced them — the
    // measured fact the rule above reads on the next pass. It resets the
    // moment the recent window is home again.
    if (ov.overlap < driftBelow) driftRun += 1; else driftRun = 0;

    const rec = {
      n: transcript.length, move, event, grain: dist.grain ?? null,
      overlap: +ov.overlap.toFixed(3), pull, driftRun, source,
      context: activeContext.join(" "), janus: janusVerdict, refusedTokens: refusedTokens.slice(0, 6),
      text: detokenize(transcript.slice(-Math.min(transcript.length, 40))),
      modelCalls,
    };
    events.push(rec);
    return rec;
  }

  return { step, state, topicWords, isOov: () => oov };
}

/** wander({ loaded, topic, steps, ... }) -> { events, summary } — run to
 *  completion without a server; the headless arm of the experiment. */
export async function wander({ loaded, topic, steps = 200, seed = 1, model = null, homeAbove = 0.2, driftBelow = 0.05, ...opts } = {}) {
  const w = makeWanderer({ loaded, topic, seed, model, homeAbove, driftBelow, ...opts });
  const events = [];
  for (let i = 0; i < steps; i += 1) events.push(await w.step());
  const st = w.state();
  const overlaps = events.map((e) => e.overlap);
  const home = events.filter((e) => e.overlap >= homeAbove).length;
  const excursions = events.filter((e) => e.overlap < driftBelow).length;
  let run = 0, maxRun = 0;
  for (const o of overlaps) { if (o < driftBelow) { run += 1; maxRun = Math.max(maxRun, run); } else run = 0; }
  const hubs = new Map();
  for (const t of st.transcript) if (/^[a-z]/.test(t) && !isStop(t) && t.length > 3) hubs.set(t, (hubs.get(t) ?? 0) + 1);
  const distinctHubs = [...hubs.values()].filter((c) => c >= 2).length;
  const transcript = detokenize(st.transcript);
  const generated = events.map((e) => e.event);
  const bits = generated.length ? scorePrequential(loaded.prior, generated, {}).bitsPerEvent : 0;
  return {
    schema: WANDER_SCHEMA, version: WANDER_VERSION, topic, seed, steps,
    events, transcript, modelCalls: st.modelCalls, oov: st.oov,
    summary: {
      meanOverlap: +(overlaps.reduce((a, b) => a + b, 0) / (overlaps.length || 1)).toFixed(3),
      minOverlap: +Math.min(...overlaps).toFixed(3),
      maxOverlap: +Math.max(...overlaps).toFixed(3),
      homeShare: +(home / (events.length || 1)).toFixed(3),
      excursionShare: +(excursions / (events.length || 1)).toFixed(3),
      maxDriftRun: maxRun,
      distinctHubs,
      bitsPerEvent: +bits.toFixed(3),
      reopens: events.filter((e) => e.move === "reopen").length,
      anchors: events.filter((e) => e.move === "anchor").length,
      associates: events.filter((e) => e.move === "associate").length,
      drifts: events.filter((e) => e.move === "drift").length,
    },
  };
}

export const WANDER = {
  schema: WANDER_SCHEMA, version: WANDER_VERSION,
  describe: "an agentic loop that wanders on a topic using only a sedimented order-N prior, with a model called only at a named out-of-vocabulary gap",
};
