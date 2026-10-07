// fold-chat-counsel.js — HOW A THINKER WOULD ANSWER, said only where it can be TIED to their own words. Pure: no DOM, no IO, no clock; the model calls are injected.
// (docs/VOICE.md "The three product behaviours" #2; eval/ants/B2-PREREG.md is the pre-registration of every gate here.)
//
// User, 2026-10-06: "If someone asks, is there a God? It should find all the people who thought about this … say how it thinks they would answer using Pythia if we think that's reliable to try to
// speak in their voice, but it should tie all of its assertions of what they would say, the paraphrasing, to examples in their real canon — this is where the mechanical fold is so important."
//
//   counselFor({ question, thinker:{handle,giver,work,source:{path,sha256},candidates|text}, draft, point, fw, limits }) → { assertions, narration, calls, ... }
//     1. the thinker's raw material for THIS question is chosen mechanically from their canon (sentences that carry the question's stems; no model);
//     2. draft(messages)  — Pythia: "say what <giver> would say, from ONLY these passages" — writes a few short sentences, each an ASSERTION;
//     3. each assertion is split off and, one by one, 4. point(messages) is asked to POINT BY NUMBER at the canon sentence that says it (shortlist chosen mechanically; the model never copies a sentence);
//        a pointer is believed only if it passes tieGate (stem coverage, a stem beyond the question's own, figures, negation parity), with ONE bounded retry;
//     5. the narration is written by the APP from fixed templates: "In <work>, <giver> wrote: “<verbatim>”. My reading of that, not <giver>'s words: <assertion>." An assertion with no verified tie is WITHHELD
//        (listed in `assertions` with tied:false and why; its text never reaches the narration).
//   verifyCounsel({ result, canon }) → { ok, bad[] }   every quote part is canon.slice(start,end); every app part is a template rendering of the result; no withheld text appears.
//
// The model's words reach the reader in exactly one place: the `reading` part, under a fixed app prefix, next to its verbatim tie, with double-quote characters removed (it cannot forge a quote).
// DECLARED, not measured (II.11): the templates, the gate's thresholds (0.6 coverage, 2 stems), the frame-word list, the bounds below. giver: the user's brief 2026-10-06 (shape), the author for wording.
// LIMITS (said): the gate is LEXICAL. A tied quote carries the assertion's content stems; it may still not MEAN what the paraphrase says. Meaning-level grounding needs the khora reader.

import * as ground from "./fold-chat-ground.js";
import { functionWordsOf } from "./fold-chat-snippets.js";
import { numberedMessages, verifyNumber, parsePointerNumber, looksLikeSentence } from "./fold-chat-provenance.js";

export const COUNSEL = Object.freeze({
  giver: "the user's brief 2026-10-06 (shape); the author's wording and thresholds; declared, not measured (II.11)",
  rawSentences: 6,        // how many of the thinker's own sentences the draft model is given
  maxAssertions: 4,       // assertions taken from the draft (each costs a pointing call, two at most)
  shortlist: 10,          // sentences offered to the pointing call per assertion by stem overlap (plus the draft's raw material)
  maxCandidates: 16,
  quoteMin: 25, quoteMax: 320,
  minAssertion: 20, maxAssertion: 300,
  coverageMin: 0.6,       // the share of the assertion's content stems the quote must carry unless it carries them all
  minShared: 2,           // and at least this many of them
  richStems: 9,           // among sentences with equally many of the question's stems, prefer the one nearest this many content stems (a lone "This is the vision of God." says little)
  spacing: 1500,          // raw-material sentences are at least this many characters apart (no run of neighbours)
});

// the words of "X holds that …" that say nothing about what X holds
const FRAME = ["would", "likely", "probably", "perhaps", "say", "says", "said", "hold", "holds", "held", "believe", "believes", "believed", "think", "thinks", "thought", "view", "views", "teach", "teaches", "taught",
  "argue", "argues", "argued", "consider", "considers", "regard", "regards", "according", "suggest", "suggests", "maintain", "maintains", "claim", "claims", "emphasize", "emphasizes", "also", "thus", "therefore"];
const NEG_RE = /\b(?:not|no|never|nor|neither|none|nothing|nowhere|cannot)\b|n['’]t\b/gi;
const QUOTES_RE = /["“”„‟«»]/g;

const stemOf = (t) => (ground.stemOf ? ground.stemOf(t) : t);
const FWDEFAULT = functionWordsOf("en");
const stemsOf = (text, fw) => ground.tokenize(String(text ?? "")).filter((t) => t.length > 2 && !(fw && fw.has(t))).map(stemOf);
const negated = (text) => (String(text ?? "").match(NEG_RE) || []).length > 0;

// ─────────────── the canon as sentences (hard-wrapped scans: a single newline is NOT a sentence end) ───────────────

const ABBR = new Set(["mr", "mrs", "ms", "dr", "st", "vs", "etc", "viz", "vol", "no", "ch", "cf", "ibid", "pp", "p", "i.e", "e.g", "sri", "jr", "sr", "mt", "lit", "trans", "ed"]);

/** Sentences of a canon with exact offsets (canon.slice(start,end) is the sentence, trimmed). A sentence ends at . ! ? (plus closing marks) before whitespace and a capital/quote/digit, or at a blank line. */
export function canonSentences(text) {
  const src = String(text ?? ""), out = [];
  const re = /[.!?]["')\]”’]*(?=\s)|\n[ \t]*\n/g;
  let start = 0, m;
  const push = (a, b) => {
    let s = a, e = b;
    while (s < e && /\s/.test(src[s])) s++;
    while (e > s && /\s/.test(src[e - 1])) e--;
    if (e > s) out.push({ start: s, end: e });
  };
  while ((m = re.exec(src))) {
    const at = m.index, end = at + m[0].length;
    if (m[0][0] !== "\n") {
      const before = /([\p{L}.]+)$/u.exec(src.slice(Math.max(0, at - 12), at));
      const word = before ? before[1].toLowerCase().replace(/\.$/, "") : "";
      if (m[0][0] === "." && (ABBR.has(word) || /^\p{L}$/u.test(word))) continue;          // "Mr.", "St.", "i.e.", an initial
      const next = /^\s+(.)/su.exec(src.slice(end, end + 6));
      if (m[0][0] === "." && next && /\p{Ll}/u.test(next[1])) continue;                       // a lowercase continuation: not a sentence end
    }
    push(start, end); start = end;
  }
  push(start, src.length);
  return out;
}

const okSentence = (t) => {
  const s = String(t);
  const len = s.length;
  if (len < COUNSEL.quoteMin || len > COUNSEL.quoteMax) return false;
  if (!/^["“‘'(\[]?\p{Lu}/u.test(s)) return false;                         // begins like a sentence
  if (!/[.!?]["')\]”’]*$/u.test(s)) return false;                         // ends like one
  if (/[\^|_{}<>\\]/.test(s)) return false;                               // scan debris / footnote marks
  return looksLikeSentence(s);
};

/** The same index over sentences the caller already holds (the static voice bank: verbatim sentences with their offsets into a canon the page cannot read). */
export function indexRows(rows, fw = FWDEFAULT) {
  const sents = [], post = new Map();
  for (const r of rows) {
    const stems = new Set(stemsOf(r.text, fw));
    if (stems.size < 2) continue;
    const id = sents.length;
    sents.push({ start: r.start, end: r.end, text: r.text, stems });
    for (const st of stems) { let a = post.get(st); if (!a) post.set(st, (a = [])); a.push(id); }
  }
  return { sents, post };
}

const INDEX_CACHE = new Map();
/** The canon's sentences that can be quoted, each with its stems, and an inverted index stem → sentence ids. Memoised per (sha256|length) for the process. */
export function indexCanon(text, fw = FWDEFAULT, key = null) {
  const k = key ? `${key}|${text.length}` : null;
  if (k && INDEX_CACHE.has(k)) return INDEX_CACHE.get(k);
  const sents = [], post = new Map();
  for (const s of canonSentences(text)) {
    const t = text.slice(s.start, s.end);
    if (!okSentence(t)) continue;
    const stems = new Set(stemsOf(t, fw));
    if (stems.size < 2) continue;
    const id = sents.length;
    sents.push({ start: s.start, end: s.end, text: t, stems });
    for (const st of stems) { let a = post.get(st); if (!a) post.set(st, (a = [])); a.push(id); }
  }
  const idx = { sents, post };
  if (k) { if (INDEX_CACHE.size >= 4) INDEX_CACHE.delete(INDEX_CACHE.keys().next().value); INDEX_CACHE.set(k, idx); }
  return idx;
}

/** The thinker's sentences for the QUESTION, by the question's stems: most distinct stems first, then the one nearest COUNSEL.richStems content stems, spaced apart. Mechanical; no model. */
export function rawMaterial(questionStems, idx, { n = COUNSEL.rawSentences, spacing = COUNSEL.spacing } = {}) {
  const score = new Map();
  for (const st of questionStems) for (const id of idx.post.get(st) || []) score.set(id, (score.get(id) || 0) + 1);
  const ranked = [...score.entries()].map(([id, hit]) => ({ id, hit, far: Math.abs(idx.sents[id].stems.size - COUNSEL.richStems) })).sort((a, b) => b.hit - a.hit || a.far - b.far || a.id - b.id);
  const out = [];
  for (const r of ranked) {
    const s = idx.sents[r.id];
    if (out.some((o) => Math.abs(o.start - s.start) < spacing)) continue;
    out.push({ start: s.start, end: s.end, text: s.text });
    if (out.length >= n) break;
  }
  return out;
}

// ─────────────── the gate ───────────────

const frameStems = (giver, fw) => new Set([...FRAME.map(stemOf), ...stemsOf(giver, null)]);

/** The tie gate (B2-PREREG.md): may this sentence stand as the canon's tie for this assertion? Pure; returns { ok, why, kind?, shared?, of? }. */
export function tieGate({ assertion, sentence, question = "", giver = "", fw = FWDEFAULT, coverageMin = COUNSEL.coverageMin, minShared = COUNSEL.minShared }) {
  const skip = frameStems(giver, fw);
  const qs = new Set(stemsOf(question, fw));
  const all = [...new Set(stemsOf(assertion, fw))].filter((s) => !skip.has(s));
  const novel = all.filter((s) => !qs.has(s));
  const have = new Set(stemsOf(sentence, fw));
  const shared = all.filter((s) => have.has(s));
  const sharedNovel = novel.filter((s) => have.has(s));
  if (!all.length) return { ok: false, why: "nothing_to_tie" };
  if (!novel.length) return { ok: false, why: "no_content_beyond_the_question" };
  if (!sharedNovel.length) return { ok: false, why: "shares_only_the_questions_words" };
  const figs = ground.numbersIn(String(assertion ?? "")), sFigs = new Set(ground.numbersIn(String(sentence ?? "")));
  const missing = figs.filter((f) => !sFigs.has(f));
  if (missing.length) return { ok: false, why: "figure_missing:" + missing.join(",") };
  if (negated(assertion) !== negated(sentence)) return { ok: false, why: "polarity_differs" };
  const allOf = shared.length === all.length;
  if (!allOf && !(shared.length >= minShared && shared.length / all.length >= coverageMin)) return { ok: false, why: `too_few_stems:${shared.length}/${all.length}` };
  return { ok: true, kind: allOf ? "all_stems" : "majority", shared, of: all.length };
}

// ─────────────── the draft: Pythia, from the thinker's own sentences only ───────────────

export function draftMessages({ question, giver, work, material }) {
  const list = material.map((m) => `- ${m.text.replace(/\s+/g, " ")}`).join("\n");
  const system = `You help say how ${giver} would answer a question, using ONLY the passages below, which are ${giver}'s own words from ${work}. `
    + `Write 2 to 4 short sentences. Each sentence must state ONE thing that ${giver} says or holds in the passages, in plain words, and must begin with "${giver}". `
    + "Do not use quotation marks. Do not add anything the passages do not say. If the passages do not address the question, reply with exactly: NOTHING";
  return [{ role: "system", content: system }, { role: "user", content: `PASSAGES\n${list}\n\nQUESTION\n${String(question ?? "").trim()}` }];
}

/** The draft's reply as ASSERTIONS: its sentences, cleaned (list marks, quotation marks and any preamble line removed), at most `max`, without duplicates. */
export function splitAssertions(reply, { max = COUNSEL.maxAssertions, giver = "" } = {}) {
  const label = giver ? new RegExp("^" + String(giver).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*[:\\-–—]\\s+", "i") : null;
  const t = String(reply ?? "").trim();
  if (!t || /^\W*NOTHING\b/i.test(t)) return [];
  const out = [], seen = new Set();
  const flat = t.replace(/\r/g, "").split(/\n+/).map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim()).filter(Boolean).join(" ");
  for (const s of flat.match(/[^.!?。！？]+[.!?。！？]+(?=\s|$)|[^.!?。！？]+$/gu) || []) {
    let x = s.replace(QUOTES_RE, "").replace(/\s+/g, " ").replace(/^\W+/, "").trim();
    if (label) x = x.replace(label, "").trim();                                    // "Swami Vivekananda: The goal is …" -> "The goal is …"
    if (x.length < COUNSEL.minAssertion || x.length > COUNSEL.maxAssertion || /\?$/.test(x)) continue;
    if (/^(here|sure|okay|certainly|based on)\b/i.test(x) && /:$/.test(x)) continue;
    const k = x.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); out.push(x);
    if (out.length >= max) break;
  }
  return out;
}

// ─────────────── the narration: the app's words around the canon's words ───────────────

export const TEMPLATES = Object.freeze({
  quote: ({ work, giver }) => `From ${work}, in ${giver}'s canon:`,           // not "wrote": a canon may be a record of the thinker (the Gospel is M's) or about them (Solon is Herodotus's)
  reading: ({ giver, text }) => `My reading of that, not ${giver}'s words: ${text}`,
  withheld: ({ giver, n }) => `I withheld ${n} other thing${n === 1 ? "" : "s"} the model suggested ${giver} would say, because I could not tie ${n === 1 ? "it" : "them"} to ${giver}'s own words.`,
  nothing: ({ giver, work }) => `I could not tie anything the model suggested ${giver} would say to ${giver}'s own words in ${work}, so I am not saying anything in their name.`,
  refused: ({ giver }) => `I have no verified words of ${giver} on this question, so I will not speak for them.`,
});

const flat = (t) => String(t ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
/** An assertion that IS the quote (the model copied the sentence) needs no "reading" under it: the quote already says it. */
export const sameAsQuote = (assertion, quote) => flat(assertion) === flat(quote);

/** The narration, rendered by the app from the assertions. Tied assertions are grouped under their verbatim quote (the first quote seen first). { text, parts[] } with parts { kind:"app", rule, text } | { kind:"quote", text, start, end } (the reading is an app part with rule "reading" and model:true). */
export function narrateCounsel({ giver, work, assertions, canon = null, refused = false }) {
  const parts = [];
  const tied = (assertions || []).filter((a) => a.tied && a.pointer);
  const withheld = (assertions || []).length - tied.length;
  if (refused) parts.push({ kind: "app", rule: "refused", text: TEMPLATES.refused({ giver }) });
  else if (!tied.length) parts.push({ kind: "app", rule: "nothing", text: TEMPLATES.nothing({ giver, work }) });
  else {
    const groups = [];
    for (const a of tied) { let g = groups.find((x) => x.pointer.start === a.pointer.start && x.pointer.end === a.pointer.end); if (!g) groups.push((g = { pointer: a.pointer, readings: [] })); if (!sameAsQuote(a.text, a.pointer.quote)) g.readings.push(a.text); }
    for (const g of groups) {
      parts.push({ kind: "app", rule: "quote", text: TEMPLATES.quote({ work, giver }) });
      parts.push({ kind: "quote", text: g.pointer.quote, start: g.pointer.start, end: g.pointer.end });
      for (const r of g.readings) parts.push({ kind: "app", rule: "reading", model: true, text: TEMPLATES.reading({ giver, text: r }) });
    }
    if (withheld) parts.push({ kind: "app", rule: "withheld", text: TEMPLATES.withheld({ giver, n: withheld }) });
  }
  return { text: parts.map((p) => (p.kind === "quote" ? `“${p.text}”` : p.text)).join(" "), parts };
}

/** The check on the narrator. `canon` is the thinker's text as the caller holds it (hash it against thinker.source.sha256 first). */
export function verifyCounsel({ result, canon, giver = result?.thinker?.giver, work = result?.thinker?.work }) {
  const bad = [];
  const n = result?.narration;
  const src = String(canon ?? "");
  if (!n || !Array.isArray(n.parts)) return { ok: false, bad: [{ why: "no_narration" }] };
  for (const a of result.assertions || []) {
    if (!a.tied) continue;
    const p = a.pointer;
    if (!p || p.tier !== "canon" || !Number.isInteger(p.start) || !Number.isInteger(p.end) || src.slice(p.start, p.end) !== p.quote) bad.push({ why: "pointer_not_the_canons_slice", text: String(a.text).slice(0, 60) });
  }
  for (const part of n.parts) {
    if (part.kind === "quote") { if (!Number.isInteger(part.start) || !Number.isInteger(part.end) || src.slice(part.start, part.end) !== part.text) bad.push({ why: "quote_not_canon_slice", text: String(part.text).slice(0, 60) }); }
    else if (part.kind !== "app") bad.push({ why: "unknown_part_kind", kind: part.kind });
  }
  const want = narrateCounsel({ giver, work, assertions: result.assertions, refused: !!result.refused });
  if (JSON.stringify(n.parts.map((x) => [x.kind, x.text, x.start ?? null, x.end ?? null])) !== JSON.stringify(want.parts.map((x) => [x.kind, x.text, x.start ?? null, x.end ?? null]))) bad.push({ why: "not_the_rendering_of_the_assertions" });
  if (n.text !== want.text) bad.push({ why: "text_not_the_join_of_the_parts" });
  for (const a of result.assertions || []) if (!a.tied && a.text && n.text.includes(a.text)) bad.push({ why: "withheld_text_in_narration", text: a.text.slice(0, 60) });
  return { ok: bad.length === 0, bad };
}

// ─────────────── the turn ───────────────

const isAbort = (e) => !!e && (e.name === "AbortError" || /abort|stopped/i.test(String(e.message || "")));
const abortError = () => Object.assign(new Error("aborted"), { name: "AbortError" });

export async function counselFor({ question, thinker, draft, point, fw = FWDEFAULT, limits = {} }) {
  const L = { ...COUNSEL, ...limits };
  const signal = limits.signal || null;
  const giver = String(thinker?.giver || thinker?.handle || "the thinker"), work = String(thinker?.work || "their work");
  const calls = { draft: 0, point: 0 };
  const base = { thinker: { handle: thinker?.handle ?? null, giver, work, source: thinker?.source ?? null } };
  const done = (assertions, extra = {}) => ({ ...base, assertions, narration: narrateCounsel({ giver, work, assertions, ...extra }), calls, ...extra });
  const ask = async (fn, kind, messages) => {
    if (signal?.aborted) throw abortError();
    calls[kind]++;
    return fn(messages);
  };

  const text = typeof thinker?.text === "string" && thinker.text ? thinker.text : null;
  const given = Array.isArray(thinker?.candidates) ? thinker.candidates.filter((c) => c && typeof c.text === "string" && Number.isInteger(c.start) && Number.isInteger(c.end)) : [];
  if (!text && !given.length) return done([], { refused: true, why: "no_verified_canon" });

  // 1. the canon's sentences and the raw material for this question (mechanical)
  const idx = text ? indexCanon(text, fw, thinker?.source?.sha256 || null) : indexRows(given, fw);
  const qStems = [...new Set(stemsOf(question, fw))];
  const span = Math.min(L.spacing, Math.floor((text ? text.length : Math.max(0, ...given.map((c) => c.end))) / (L.rawSentences * 4)));
  let material = text && given.length ? given.slice(0, L.rawSentences) : rawMaterial(qStems, idx, { n: L.rawSentences, spacing: span });
  if (text) {
    material = material.filter((m) => text.slice(m.start, m.end) === m.text);                  // a candidate that is not the canon's own slice is dropped
    if (!material.length) material = rawMaterial(qStems, idx, { n: L.rawSentences, spacing: span });
  }
  if (!material.length) return done([], { why: "no_sentence_bears_on_the_question" });

  // 2. the draft (Pythia)
  let reply = "";
  try { reply = await ask(draft, "draft", draftMessages({ question, giver, work, material })); }
  catch (e) { if (isAbort(e)) throw e; return done([], { why: "draft_failed:" + String(e?.message || e).slice(0, 60) }); }
  // 3. assertions
  const texts = splitAssertions(reply, { max: L.maxAssertions, giver });
  if (!texts.length) return done([], { why: "draft_made_no_assertion" });

  // 4. per assertion: shortlist (mechanical) → point by number → verify (verifyNumber + tieGate), one bounded retry
  const assertions = [];
  for (const a of texts) {
    const skip = frameStems(giver, fw);
    const aStems = [...new Set(stemsOf(a, fw))].filter((s) => !skip.has(s));
    const seen = new Map();
    const add = (c) => { if (!seen.has(c.start + ":" + c.end)) seen.set(c.start + ":" + c.end, { start: c.start, end: c.end, text: c.text }); };
    const sc = new Map();
    for (const st of aStems) for (const id of idx.post.get(st) || []) sc.set(id, (sc.get(id) || 0) + 1);
    [...sc.entries()].sort((x, y) => y[1] - x[1] || idx.sents[x[0]].stems.size - idx.sents[y[0]].stems.size || x[0] - y[0]).slice(0, L.shortlist).forEach(([id]) => add(idx.sents[id]));
    for (const m of material) add(m);
    let candidates = [...seen.values()].slice(0, L.maxCandidates).map((c, i) => ({ ...c, text: text ? text.slice(c.start, c.end) : c.text, n: i + 1, passageIndex: 0 }));   // with the canon in hand the candidate IS the canon's slice
    const passages = [{ text: text ?? "", ref: thinker?.source?.path || thinker?.handle || "canon" }];
    let verdict = { tied: false, why: "no_candidates" };
    for (let attempt = 0; attempt < 2 && candidates.length; attempt++) {
      let r = "";
      try { r = await ask(point, "point", numberedMessages({ claim: a, candidates, passages })); }
      catch (e) { if (isAbort(e)) throw e; verdict = { tied: false, why: "call_failed:" + String(e?.message || e).slice(0, 60) }; break; }
      const v = verifyNumber({ reply: r, claim: a, candidates, passages, fw });
      if (!v.ok && ["none", "unparsed", "no_such_sentence"].includes(v.why)) { verdict = { tied: false, why: v.why }; break; }   // an answer that names no real sentence is final
      const picked = candidates.find((c) => c.n === parsePointerNumber(r)?.n);
      const gate = v.ok && picked ? tieGate({ assertion: a, sentence: picked.text, question, giver, fw }) : { ok: false, why: v.why || "rejected" };
      if (v.ok && gate.ok) {
        const quote = text ? text.slice(picked.start, picked.end) : picked.text;
        verdict = { tied: true, pointer: { start: picked.start, end: picked.end, quote, tier: "canon" }, why: gate.kind === "all_stems" ? `carries all ${gate.of} content stems` : `carries ${gate.shared.length} of ${gate.of} content stems` };
        break;
      }
      verdict = { tied: false, why: gate.why };
      // the pick was a real sentence that does not say it: withdraw THAT candidate and ask once more over the rest
      const rest = candidates.filter((c) => c.n !== picked?.n).map((c, i) => ({ ...c, n: i + 1 }));
      if (attempt === 0 && rest.length) candidates = rest; else break;
    }
    assertions.push({ text: a, ...verdict });
  }
  return done(assertions);
}
