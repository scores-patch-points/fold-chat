// compose.mjs — mull over something, in real sentences, coherently.
//
// WHY NOT THE TOKEN WANDER. A word-level order-N prior over one novel produces
// locally-plausible tokens and globally nonsense ("utter nonsense", the
// operator, on seeing it). No amount of gating fixes a generator whose unit is
// a word. The unit here is the SENTENCE, taken whole from real material: every
// sentence the reader meets is a sentence someone actually wrote, so the output
// is grammatical by construction. What the system does is MULL — select the
// next sentence that continues the present thread (Janus's continuity of
// reference), and let it drift and return to what it was given to think about.
//
// FEED IT SOMETHING TO THINK ABOUT. `seedText` is the thought. Its content words
// are the standing anchors: the walk leaves them and keeps coming back
// (rumination), so the passage is a sustained reflection on the seed, not a
// free drift. `topic` is optional and just adds anchors.
//
// JANUS keeps it coherent: a candidate sentence is LICENSED only if it shares at
// least one content word with the present focus (the reference thread is
// continuous); a sentence off the thread is REFUSED and the next candidate is
// tried. Every step carries its verdict.
//
// PENELOPE gives it pathos: she routes one archon from the seed (mechanical),
// biases the walk toward the register's feeling-words, and lays in that
// archon's own VERIFIED sentences as refrains where their words touch the
// thread. The record names her; the passage never does.

import fs from "node:fs";
import { lcg } from "../../../khora/native/kernel/continuation.js";
import { isStop } from "./wander.mjs";
import { routeArchon, sentencesOf, REGISTERS } from "./penelope.mjs";
import { loadManifest } from "../../../penelope/organs/pythia.mjs";

export const COMPOSE_SCHEMA = "EOMindWanderCompose@1";

const content = (s) => (String(s ?? "").toLowerCase().match(/[a-z']+/g) ?? []).filter((w) => w.length > 2 && !isStop(w));

// The register's feeling-words: a MECHANICAL bias on which fine sentence to
// prefer, declared here, never a model's taste.
const REGISTER_WORDS = Object.freeze({
  elegiac: "night dark death dead grave tears sorrow memory cold pale shadow moon lost weep mourn silent passing gone".
    split(" "),
  dread: "fear terror blood dread horror scream demon devil monster death night shadow tremble grey awful".
    split(" "),
  tender: "love heart dear sweet gentle kiss warm soft friend kind smile mother child hand quiet".
    split(" "),
  attentive: "look see watch hear listen thought mind wonder question strange curious".
    split(" "),
  plain: [],
});

/** loadSentences(corpusPath) -> [{ i, text, cw:Set, cwArr }] real whole sentences. */
export function loadSentences(corpusPath, { minWords = 7, maxWords = 55 } = {}) {
  const text = fs.readFileSync(corpusPath, "utf8").replace(/\r/g, " ").replace(/\s+/g, " ");
  const parts = text.split(/(?<=[.!?])\s+/);
  const out = [];
  for (const p of parts) {
    const t = p.trim();
    const wc = t.split(" ").length;
    if (wc < minWords || wc > maxWords) continue;
    if (!/^["“']?[A-Z]/.test(t)) continue;
    const cwArr = content(t);
    if (cwArr.length < 3) continue;
    out.push({ i: out.length, text: t, cw: new Set(cwArr), cwArr });
  }
  return out;
}

/** idfOver(sentences) -> (word) => weight; a word in most sentences cannot route. */
export function idfOver(sentences) {
  const df = new Map();
  for (const s of sentences) for (const w of s.cw) df.set(w, (df.get(w) ?? 0) + 1);
  return (w) => Math.log(1 + sentences.length / (df.get(w) ?? 1));
}

/**
 * makeMuller({ sentences, idf, thinkText, topic, register, seed, take, driftP,
 *              returnP, refrainEvery }) -> { step(), record() }
 *
 * One `step()` appends ONE real sentence (and sometimes a Penelope refrain).
 * The focus is a bag of content words; each step extends the thread, sometimes
 * drifts to a new thread that a shared word opens, and periodically RETURNS to
 * the seed's own anchors (rumination).
 */
export function makeMuller({
  sentences, idf, thinkText = "", topic = "", register = "elegiac",
  seed = 1, take = 40, driftP = 0.18, returnP = 0.14, refrainEvery = 5,
} = {}) {
  if (!sentences?.length) throw new TypeError("makeMuller: a sentence bank is required");
  if (!REGISTERS.includes(register)) register = "attentive";
  const rng = lcg(seed);
  const thinkAnchors = new Set([...content(thinkText), ...content(topic)]);
  const registerWords = new Set(REGISTER_WORDS[register] ?? []);

  // Penelope routes one archon from the thought; her verified sentences become
  // the refrains. Model-free; a missing cast is disclosed, never faked.
  let archon = null, refrains = [];
  try {
    const routed = routeArchon(loadManifest(), { topic: `${thinkText} ${topic}`, spine: thinkText });
    if (routed?.voice) {
      archon = routed.rec;
      refrains = sentencesOf(routed.voice).map((text, at) => ({ text, at, bag: new Set(content(text)) }));
    }
  } catch { /* no cast */ }
  const usedRefrains = new Set();

  const used = new Set();
  const recent = new Set(thinkAnchors);
  let steps = 0;
  const rows = [];

  const overlapOf = (bag) => { let n = 0; for (const w of bag) if (thinkAnchors.has(w)) n += 1; return n; };

  function score(s, { drift = false, ret = false } = {}) {
    let shared = 0, novel = 0, res = 0, feel = 0;
    for (const w of s.cw) {
      const weight = idf(w);
      if (recent.has(w)) (drift ? (novel += 0) : (shared += weight));
      else novel += weight;
      if (thinkAnchors.has(w)) res += weight * (ret ? 2 : 0.8);
      if (registerWords.has(w)) feel += weight * 0.5;
    }
    const driftTerm = drift ? novel : 0;
    return shared + driftTerm + res + feel;
  }

  function candidates(opts) {
    const out = [];
    for (const s of sentences) {
      if (used.has(s.i)) continue;
      const sc = score(s, opts);
      if (sc <= 0) continue;
      out.push({ s, sc });
    }
    out.sort((a, b) => b.sc - a.sc || a.s.i - b.s.i);
    return out.slice(0, 30);
  }

  function weightedPick(cands) {
    const weights = cands.map((c) => Math.exp(c.sc));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    for (let i = 0; i < cands.length; i += 1) { r -= weights[i]; if (r <= 0) return cands[i]; }
    return cands[cands.length - 1];
  }

  function refrainFor() {
    const near = new Set([...recent].slice(-14));
    let best = null;
    for (const r of refrains) {
      if (usedRefrains.has(r.at)) continue;
      let hit = 0; for (const w of r.bag) if (near.has(w)) hit += 1;
      if (hit > 0 && (!best || hit > best.hit)) best = { r, hit };
    }
    if (!best) return null;
    usedRefrains.add(best.r.at);
    return best.r.text.replace(/^["“]|["”]$/g, "");
  }

  function step() {
    steps += 1;
    const drift = rng() < driftP;
    const ret = rng() < returnP;
    const cands = candidates({ drift, ret });
    if (!cands.length) {
      // Nothing continues the thread: return to the seed's own words.
      for (const w of thinkAnchors) recent.add(w);
      return rows.push({ n: steps, move: "return", sentence: null, janus: { ok: true, kind: "licensed", detail: "re-centred on the thought" }, refrain: null }), rows.at(-1);
    }
    // JANUS: the first candidate that keeps the thread (shares a word with the
    // present focus) is licensed; otherwise the walk would not cohere.
    const refused = [];
    let chosen = null;
    for (const c of cands) {
      const shares = [...c.s.cw].some((w) => recent.has(w));
      if (shares || ret || drift && overlapOf(c.s.cw) > 0) { chosen = c; break; }
      refused.push(c.s.i);
    }
    if (!chosen) chosen = cands[0]; // disclosed fallback: the least disconnected
    used.add(chosen.s.i);

    // The focus moves to the new sentence, but the seed's anchors stay in mind
    // (they never leave `recent`), so rumination is structural.
    recent.clear();
    for (const w of chosen.s.cw) recent.add(w);
    for (const w of thinkAnchors) recent.add(w);

    const refrain = steps % refrainEvery === 0 ? refrainFor() : null;
    const row = {
      n: steps, move: ret ? "return" : drift ? "drift" : "continue",
      sentence: chosen.s.text,
      anchors: chosen.s.cwArr.slice(0, 6),
      resonance: overlapOf(chosen.s.cw),
      janus: { ok: refused.length === 0, kind: refused.length ? "off-thread-refused" : "licensed", detail: refused.length ? `${refused.length} candidate(s) refused as off-thread` : "continuity of reference holds" },
      refused: refused.length,
      refrain,
    };
    rows.push(row);
    return row;
  }

  function record() {
    const passage = rows.map((r) => r.sentence).filter(Boolean).join(" ");
    return {
      schema: COMPOSE_SCHEMA, register, think: thinkText, topic,
      steps: rows.length,
      archon: archon ? { handle: archon.handle, giver: archon.giver, work: archon.work, source: archon.source.path } : null,
      refrains: rows.filter((r) => r.refrain).map((r) => r.refrain),
      resonance: rows.filter((r) => r.resonance > 0).length,
      janus: { licensed: rows.filter((r) => r.janus.kind === "licensed").length, refusedCandidates: rows.reduce((a, r) => a + (r.refused ?? 0), 0) },
      passage,
      basis: `${rows.length} real sentences chained; ${rows.filter((r) => r.resonance > 0).length} resonant with the thought; Janus refused ${rows.reduce((a, r) => a + (r.refused ?? 0), 0)} off-thread candidate(s); ${archon ? `Penelope laid ${rows.filter((r) => r.refrain).length} refrain(s) from ${archon.handle}, unnamed in the passage` : "no cast for refrains"} — no model called`,
    };
  }

  return { step, record, thinkAnchors };
}

/** mull(...) — headless: run the whole thing and return the record. */
export function mull({ corpus, sentences = null, idf = null, thinkText = "", topic = "", register = "elegiac", steps = 40, seed = 1 } = {}) {
  const bank = sentences ?? loadSentences(corpus);
  const idfFn = idf ?? idfOver(bank);
  const m = makeMuller({ sentences: bank, idf: idfFn, thinkText, topic, register, seed });
  for (let i = 0; i < steps; i += 1) m.step();
  return m.record();
}

// CLI: node compose.mjs --think "..." --topic night --steps 24 [--corpus PATH]
if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (n, d = null) => { const i = process.argv.indexOf("--" + n); return i >= 0 ? (process.argv[i + 1] ?? true) : d; };
  const corpus = String(arg("corpus", "/Users/mlacy/Documents/3.0/Zenodotus/01-literature-books/gutenberg/pg345_Dracula.txt"));
  const thinkText = String(arg("think", "fear of the night and what waits in the dark"));
  const topic = String(arg("topic", ""));
  const register = String(arg("register", "elegiac"));
  const steps = Number(arg("steps", 30));
  const seed = Number(arg("seed", 1));
  const bank = loadSentences(corpus);
  console.error(`[compose] ${bank.length.toLocaleString()} sentences`);
  const rec = mull({ corpus, sentences: bank, idf: idfOver(bank), thinkText, topic, register, steps, seed });
  console.log(`\n── mulling: "${thinkText}" (${register}) ──\n`);
  console.log(rec.passage);
  console.log(`\n${rec.basis}`);
}
