// fold-chat-ground.js — the fold's grounding mechanisms, ported lean for the
// chat surface, and its per-turn RECORD in the holodeck's own voice.
//
// The fold's organs (eoreader7 native/organs: cite.js, grounding.js, source.js)
// run the full pipeline against a workspace's retrieved chunks. This surface is
// sealed-external and never touches the workspace, so the material it grounds
// against is the one it already carries: the person's OWN messages. Same
// mechanisms, reading that material:
//
//   stripSelfCitations  the model is never shown an address and never asked to
//                       cite; a bracket address in its OWN output is neutralized.
//   attribute/coverage  attach each answer sentence to the material it shares a
//                       PHRASE with (a consecutive run of >= MIN_RUN tokens),
//                       addressed to a byte range within that message, and veto
//                       the attachment if the sentence commits to a proper name
//                       the material does not contain.
//   unsupportedClaims   the figures and names in the answer the material does
//                       not say at all.
//   turnRecord          the holodeck's one-line record: addresses checked,
//                       nothing unsupported (or how many are not in the material).
//
// It never judges whether an uncited claim is TRUE; it says what the material
// backs and what it does not. The model proposes; the record decides.

export const MIN_RUN = 2;
// A run of shared tokens only warrants a claim if at least one token is
// SUBSTANTIVE — a content word, not a function word. Without this, two common
// words ("Washington, D.C.") anchor an unrelated "founded 1795".
const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "was", "were", "be", "been", "by", "as", "at", "it", "its", "this", "that", "these", "those", "with", "from", "into", "his", "her", "their", "they", "them", "we", "you", "he", "she", "had", "has", "have", "not", "but", "also", "first", "one", "two", "new", "old", "then", "than", "when", "where", "which", "who", "will", "would", "could", "should", "said", "says", "any", "all", "some", "may", "more", "most", "other", "such", "only", "own", "same", "so", "no", "nor", "too", "very"]);
const isFigure = (t) => /^\d/.test(t);
const substantive = (t) => t.length >= 4 && !STOP.has(t);
// A shared run anchors a claim only when it carries real content: at least TWO
// substantive tokens, at least one a word (not a bare figure). "in 2014",
// "the first", "its first", "was the first" all fail (one substantive);
// "was founded in 1857" passes (founded + 1857, one a word). This is the bar
// that stops unrelated prose from grounding a claim.
const substantiveRun = (toks) => {
  const subs = toks.filter(substantive);
  return subs.length >= 2 && subs.some((t) => !isFigure(t));
};
// A trailing token that only LOOKS like a sentence end: titles, a multi-dot
// abbreviation (D.C., U.S., a.m.), or a lone initial (J. R. R. Tolkien).
const ABBREV = /\b(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|no|fig|inc|ltd|co|gov|dept|approx|est|mt|ave|blvd|rd|gen|col|capt|lt|sgt|hon|rev|pres|vol|ed|pp?)\.$|(?:\b[A-Za-z]\.){2,}$|\b[A-Z]\.$/i;

/** Split an answer into sentences. A newline boundary is unconditional; only
 *  a ./!/? boundary can be an abbreviation in disguise. */
export function splitSentences(text) {
  const src = String(text ?? "");
  const pieces = [];
  let start = 0;
  const re = /(?<=[.!?])\s+|\n+/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const piece = src.slice(start, m.index);
    const boundaryIsSentencePunct = /[.!?]$/.test(src.slice(0, m.index));
    if (boundaryIsSentencePunct && ABBREV.test(piece.trimEnd())) continue;
    const trimmed = piece.trim();
    if (trimmed) pieces.push(trimmed);
    start = m.index + m[0].length;
  }
  const tail = src.slice(start).trim();
  if (tail) pieces.push(tail);
  const out = [];
  for (const piece of pieces) {
    if (out.length && /^\[[^\]\s]+#\d+-\d+\]/.test(piece)) out[out.length - 1] += " " + piece;
    else out.push(piece);
  }
  return out;
}

function fold(s) {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const oneLine = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const URL_RE = /^https?:\/\//i;
export const isUrl = (source) => URL_RE.test(String(source ?? ""));
export const domainOf = (source) => {
  if (!isUrl(source)) return null;
  try { return new URL(String(source)).hostname.replace(/^www\./, ""); } catch { return null; }
};

/** The verbatim excerpt around a byte span in the material: the SENTENCE that
 *  contains the supporting span, split so the span itself can be marked. The
 *  reader sees the sentence that supports the claim, with the exact span
 *  highlighted — never the answer sentence, never a run fragment. */
export function excerpt(text, span, { max = 240 } = {}) {
  const s = String(text ?? "");
  if (!span || span.start == null || span.end == null)
    return { before: "", mark: oneLine(s).slice(0, max), after: "", quote: oneLine(s).slice(0, max), ellipsisBefore: false, ellipsisAfter: s.length > max };
  const LOOK = 200;
  const from = Math.max(0, span.start - LOOK);
  const to = Math.min(s.length, span.end + LOOK);
  const beforeTxt = s.slice(from, span.start);
  const bIdx = Math.max(beforeTxt.lastIndexOf("."), beforeTxt.lastIndexOf("!"), beforeTxt.lastIndexOf("?"), beforeTxt.lastIndexOf("\n"));
  const start = bIdx >= 0 ? from + bIdx + 1 : from;
  const afterTxt = s.slice(span.end, to);
  const aIdx = afterTxt.search(/[.!?\n]/);
  const end = aIdx >= 0 ? span.end + aIdx + 1 : to;
  let before = oneLine(s.slice(start, span.start));
  const mark = oneLine(s.slice(span.start, span.end));
  let after = oneLine(s.slice(span.end, end));
  // Hard-cap around the mark, cutting on word boundaries.
  const room = Math.max(0, max - mark.length);
  if (before.length + after.length > room) {
    const half = Math.floor(room / 2);
    before = wordTail(before, half);
    after = wordHead(after, half);
  }
  return { before, mark, after, quote: oneLine([before, mark, after].filter(Boolean).join(" ")), ellipsisBefore: start > 0, ellipsisAfter: end < s.length };
}

// Cut on word boundaries only — never mid-token.
const wordTail = (t, n) => (t.length <= n ? t : (t.slice(t.length - n).replace(/^\S*\s+/, "") || ""));
const wordHead = (t, n) => (t.length <= n ? t : (t.slice(0, n).replace(/\s+\S*$/, "") || ""));

/** Tokens with their character offsets in the source, so a shared run can be
 *  mapped back to a real byte range. */
export function tokensWithOffsets(text) {
  const src = String(text ?? "");
  const folded = src.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const out = [];
  const re = /[\p{L}\p{N}]+/gu;
  let m;
  while ((m = re.exec(folded)) !== null) out.push({ t: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length });
  return out;
}

export function tokenize(text) { return tokensWithOffsets(text).map((x) => x.t); }

/** The longest run of tokens two sequences share in order. A shared word is a
 *  coincidence; a shared run is a phrase, the smallest thing that can be said
 *  to have come from somewhere. */
export function overlap(a, b) {
  const x = a || [], y = b || [];
  let prev = new Uint16Array(y.length + 1);
  let best = 0;
  for (let i = 1; i <= x.length; i++) {
    const row = new Uint16Array(y.length + 1);
    for (let j = 1; j <= y.length; j++) {
      if (x[i - 1] === y[j - 1]) { row[j] = prev[j - 1] + 1; if (row[j] > best) best = row[j]; }
    }
    prev = row;
  }
  return best;
}

/** The best aligned run, with the material token index where it ends, so the
 *  shared phrase can be addressed. When two runs tie on length, the SUBSTANTIVE
 *  one wins — a run of stopwords ("its first leader") must never outrank a run
 *  that carries content ("john a macdonald"). Substantiveness is checked only
 *  when a run beats the current best (never per-cell): the inner loop is
 *  O(n·m) over whole articles and must not allocate. */
function bestRun(sentenceTokens, matTokens) {
  const a = sentenceTokens, b = matTokens;
  let prev = new Uint16Array(b.length + 1);
  let best = 0, endJ = -1, bestSub = 0, endSub = -1;
  const subRun = (j, n) => {
    let subs = 0, hasWord = false;
    for (let k = j - n; k < j; k++) {
      const t = b[k];
      if (t.length >= 4 && !STOP.has(t)) { subs++; if (!isFigure(t)) hasWord = true; }
    }
    return subs >= 2 && hasWord;
  };
  for (let i = 1; i <= a.length; i++) {
    const row = new Uint16Array(b.length + 1);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        const run = prev[j - 1] + 1;
        row[j] = run;
        if (run > best) { best = run; endJ = j; }
        if (run > bestSub && subRun(j, run)) { bestSub = run; endSub = j; }
      }
    }
    prev = row;
  }
  return bestSub >= MIN_RUN ? { score: bestSub, endJ: endSub } : { score: best, endJ };
}

const ALREADY_CITED = /\[[^\]\s]+#\d+-\d+\]/g;

export function stripSelfCitations(text) {
  let removed = 0;
  const out = String(text ?? "").replace(ALREADY_CITED, () => { removed++; return "[citation removed — not issued by this instrument]"; });
  return { text: out, removed };
}

const NAME_RUN_RE = /(?<![\p{L}\p{N}_])(\p{Lu}[\p{L}\p{N}_.'-]*(?:\s+\p{Lu}[\p{L}\p{N}_.'-]*)+)(?<=[\p{L}\p{N}_])/gu;
const ACRONYM_RE = /(?<![\p{L}\p{N}_])(\p{Lu}{2,})(?![\p{L}\p{N}_])/gu;
// A single capitalized word that is not the first word of the sentence — a lone
// proper noun (Washington, Ottawa, Canberra, Brasília). The sentence-initial
// word is skipped (any capitalized opener is "The/In/At…"), so a mid-sentence
// capital is a name the sentence commits to.
const LONE_NAME_RE = /(?<![\p{L}\p{N}_.'-])(\p{Lu}[\p{L}\p{N}_'-]+)(?![\p{L}\p{N}_.'-])/gu;
const COMMON_CAP = new Set(["The", "A", "An", "In", "On", "At", "Of", "For", "To", "And", "But", "Or", "It", "Its", "This", "That", "These", "Those", "When", "Where", "Which", "Who", "Why", "How", "As", "By", "From", "With", "His", "Her", "Their", "They", "We", "You", "He", "She", "If", "So", "Then", "There", "Here", "Today", "Tomorrow", "Yesterday", "It's", "There's", "However", "Meanwhile", "Also", "Both", "Each", "Every", "Some", "Most", "Many", "After", "Before", "During", "Between", "Under", "Over", "Now", "Once", "Yet", "Thus", "Hence", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);

/** The names a sentence commits to: runs of >= 2 capitalized words, bare
 *  acronyms, and LONE proper nouns (a capitalized word that is not a common
 *  opener). This is what lets "founded in 1795" be checked against a passage
 *  lacking Washington/Ottawa — a lone subject capital IS a name. */
export function namesIn(text) {
  const s = String(text ?? "");
  const names = new Set();
  const taken = []; // spans already consumed by a name-run or acronym
  for (const m of s.matchAll(NAME_RUN_RE)) { names.add(m[1]); taken.push([m.index, m.index + m[0].length]); }
  for (const m of s.matchAll(ACRONYM_RE)) { names.add(m[1]); taken.push([m.index, m.index + m[0].length]); }
  const inTaken = (i) => taken.some(([a, b]) => i >= a && i < b);
  for (const m of s.matchAll(LONE_NAME_RE)) {
    const w = m[1];
    if (COMMON_CAP.has(w)) continue;         // an opener, not a name
    if (inTaken(m.index)) continue;          // already part of a name-run
    if (/^[A-Z][a-z]?$/.test(w)) continue;   // a lone initial, not a name
    names.add(w);
  }
  return [...names];
}

function namesSupported(text, hayTokens) {
  const hay = hayTokens instanceof Set ? hayTokens : tokenize(hayTokens || "");
  return namesIn(text).every((n) => {
    const parts = tokenize(n).filter((p) => p.length > 1);
    // Whole-token membership, not substring: "macdonald" must BE a passage
    // token, never merely inside another ("macdonalds").
    return parts.length > 0 && parts.every((p) => hay.has(p));
  });
}

/** Numbers the sentence commits to must appear in the material. A sentence
 *  saying "founded in 1795" cannot be grounded on a passage that never says
 *  1795 — sharing "Washington, D.C." is not support for the figure. */
function numbersSupported(text, hayNumbers) {
  return numbersIn(text).every((n) => hayNumbers.has(n));
}

const NUMBER_RE = /\b\d[\d,]*(?:\.\d+)?%?(?:st|nd|rd|th|s)?\b/g;
export function numbersIn(text) {
  const out = new Set();
  for (const m of String(text ?? "").matchAll(NUMBER_RE)) out.add(m[0].replace(/,/g, "").toLowerCase());
  return [...out];
}

/** Attribute each sentence of an answer to the material it came from. `material`
 *  is [{ ref, label, text }] where `ref` is the display name and `label` the
 *  short source tag (S1, S2). Returns [{ text, ref, source, span, score }];
 *  `ref`/`span` are null when the sentence is not grounded. */
export function attribute(answer, material = []) {
  if (!material.length) return [];
  // Bound the work: attribution is synchronous in the browser tab, so neither
  // the answer nor each passage may be unbounded. 20k chars of material per
  // source is far more than any sentence needs to match against. Token arrays
  // are built ONCE per passage and reused for every sentence (building them
  // per sentence is the biggest GC churn on the multi-entity path).
  const offered = material.map((m) => {
    const text = String(m.text || "").slice(0, 20000);
    const toks = tokensWithOffsets(text);
    return { ...m, text, toks, toksPlain: toks.map((x) => x.t) };
  });
  const sentences = splitSentences(answer).slice(0, 80);
  return sentences.map((text) => {
    const st = tokenize(text);
    let best = { score: 0, endJ: -1 }, hit = null;
    for (const m of offered) {
      const r = bestRun(st, m.toksPlain);
      if (r.score > best.score) { best = r; hit = m; }
    }
    if (!hit || best.score < MIN_RUN) return { text, ref: null, source: null, span: null, score: best.score };
    const runToks = hit.toks.slice(best.endJ - best.score, best.endJ).map((x) => x.t);
    const hayNames = new Set(hit.toksPlain);
    const hayNums = new Set(numbersIn(hit.text));
    if (!substantiveRun(runToks) || !namesSupported(text, hayNames) || !numbersSupported(text, hayNums)) return { text, ref: null, source: null, span: null, score: best.score };
    const endTok = hit.toks[best.endJ - 1];
    const startTok = hit.toks[best.endJ - best.score];
    const span = { start: startTok.start, end: endTok.end };
    return { text, ref: hit.ref, source: hit.source, span, address: `${hit.ref}#${span.start}-${span.end}`, score: best.score, sourceText: hit.text };
  });
}

export function coverage(answer, material = []) {
  const entries = attribute(answer, material);
  const grounded = entries.filter((e) => e.ref);
  const refs = [...new Set(grounded.map((e) => e.address))];
  return { entries, grounded: grounded.length, total: entries.length, refs, ratio: entries.length ? grounded.length / entries.length : 0 };
}

/** The checkable claims the material does NOT support. */
export function unsupportedClaims(answer, material = []) {
  const hayNumbers = new Set();
  const hayToks = new Set();
  for (const m of material) {
    for (const n of numbersIn(m.text)) hayNumbers.add(n);
    for (const t of tokenize(m.text)) hayToks.add(t);
  }
  const numbers = numbersIn(answer).filter((n) => !hayNumbers.has(n));
  const names = namesIn(answer).filter((name) => {
    const parts = tokenize(name).filter((p) => p.length > 1);
    return parts.length > 0 && !parts.every((p) => hayToks.has(p));
  });
  return { numbers, names };
}

/** The full per-turn RECORD, holodeck-shaped: what was addressed, what is not
 *  in the material, the ungrounded sentences, and the one-line record. */
export function turnRecord(answer, material = [], { turn = 1, question = "", model = "", sealed = false } = {}) {
  const has = material.length > 0 && material.some((m) => String(m?.text ?? "").trim().length >= 40);
  const cov = has ? coverage(answer, material) : { entries: [], grounded: 0, total: splitSentences(answer).length, refs: [], ratio: 0 };
  const uns = has ? unsupportedClaims(answer, material) : { numbers: [], names: [] };
  // Addressed sources, deduped by address.
  const seen = new Set();
  const sources = [];
  for (const e of cov.entries) {
    if (!e.address || seen.has(e.address)) continue;
    seen.add(e.address);
    sources.push({ address: e.address, ref: e.ref, span: e.span, text: e.text });
  }
  const ungrounded = cov.entries.filter((e) => !e.ref).map((e) => e.text);
  const bad = [...uns.numbers, ...uns.names];
  const bits = [
    nbOrd(cov.refs.length, "address", "addresses") + " checked",
    bad.length ? bad.length + " not in the material" : "nothing unsupported",
    cov.total - cov.grounded > 0 ? (cov.total - cov.grounded) + " sentence(s) ungrounded" : "every sentence grounded",
  ];
  const line = has
    ? `On record · turn ${turn} · ${bits.join(" · ")}`
    : `On record · turn ${turn} · no material carried · the answer stands on the model alone`;
  // The facing page rides the record when material was read (never over a
  // greeting): the spread the surface renders.
  const facing = has ? facingPage(answer, material) : { sources: [], response: [], has: false };
  // examined: the panel is shown ONLY when the fold actually read material
  // (the holodeck's lesson — a grounding report over nothing is noise, and a
  // greeting is not a claim). A materialless turn carries examined:false and
  // the surface renders no panel at all.
  return { turn, hasMaterial: has, examined: has, coverage: cov, unsupported: uns, sources, ungrounded, facing, line };
}

const nbOrd = (n, a, b) => n + " " + (n === 1 ? a : (b || a + "s"));

/** The facing page: the turn as a book spread (the holodeck's own construction,
 *  ported lean). LEFT are the SOURCES — each cited passage numbered S1, S2, …
 *  by first use, carrying the verbatim sentence read from the real material and
 *  its permanent address (ref#byteStart-byteEnd). RIGHT is the RESPONSE — every
 *  sentence tagged [S#] to the passage it draws from, or [M] for the mouth's own
 *  prose (ungrounded). Nothing is re-summarized: the snip is the material's own
 *  bytes and the tags are the turn's own attributions, laid side by side.
 *  Returns { sources, response, has }. */
export function facingPage(answer, material = []) {
  const entries = attribute(answer, material);
  const fnum = new Map();
  for (const e of entries) if (e.ref && !fnum.has(e.address)) fnum.set(e.address, fnum.size + 1);
  const cites = new Map();
  for (const e of entries) if (e.ref) cites.set(e.address, (cites.get(e.address) || 0) + 1);
  const sources = [...fnum.entries()].map(([address, n]) => {
    const e = entries.find((x) => x.address === address);
    const ex = excerpt(e?.sourceText, e?.span);
    return {
      n: "S" + n, address, ref: e?.ref ?? null, span: e?.span ?? null,
      // Identity tokens for a source-faithful card (label · domain · url).
      label: e?.ref ?? null, source: e?.source ?? null,
      url: isUrl(e?.source) ? e.source : null,
      domain: domainOf(e?.source),
      // The verbatim material sentence around the span, split so the span is
      // marked; `text` is the whole sentence for a quick read.
      text: ex.quote || String(e?.text ?? "").trim(),
      before: ex.before, mark: ex.mark, after: ex.after,
      ellipsisBefore: ex.ellipsisBefore, ellipsisAfter: ex.ellipsisAfter,
      cite: cites.get(address) || 0,
    };
  });
  const response = entries.map((e) => ({
    tag: e.ref && fnum.has(e.address) ? "S" + fnum.get(e.address) : "M",
    text: String(e.text ?? "").trim(),
    grounded: !!(e.ref && fnum.has(e.address)),
    address: e.ref ? e.address : null,
  }));
  return { sources, response, has: sources.length > 0 };
}

/** THE FALSIFY PASS — the adversarial re-check of the attribution, run when the
 *  fold thinks deep. A grounded entry is only STRONG when its shared run is a
 *  long, content-bearing anchor (>= 4 tokens); a 2–3 token run is a WEAK anchor
 *  and is demoted — never shown as settled. Returns a verdict per sentence and
 *  the counts, so the fold can name exactly what survived and what did not. */
export function falsify(entries = []) {
  const out = [];
  let supported = 0, weak = 0, unsupported = 0;
  for (const e of entries) {
    if (!e.ref) { unsupported++; out.push({ text: e.text, verdict: "unsupported" }); continue; }
    if ((e.score || 0) >= 4) { supported++; out.push({ text: e.text, ref: e.ref, verdict: "supported" }); }
    else { weak++; out.push({ text: e.text, ref: e.ref, verdict: "weak" }); }
  }
  return { checked: out.length, supported, weak, unsupported, entries: out };
}

/** The fold-voice note appended under an answer that overreached — what the
 *  material does not say, named. */
export function ungroundedNote(unsupported) {
  const parts = [];
  if (unsupported.numbers.length) parts.push(`figures ${unsupported.numbers.slice(0, 6).join(", ")}`);
  if (unsupported.names.length) parts.push(`names ${unsupported.names.slice(0, 6).join(", ")}`);
  if (!parts.length) return "";
  return `⟂ fold: the material here does not say ${parts.join("; ")} — not grounded in what you gave me.`;
}

/** A mechanical one-line gist for the record (System 1 style): the answer's
 *  first sentence, clipped. Never a claim about truth, only a fold of the text. */
export function foldLine(question, answer) {
  const s = splitSentences(answer).find((x) => x.length > 12) || String(answer || "").trim();
  const clip = s.replace(/\s+/g, " ").trim().slice(0, 160);
  return clip ? (clip.length < s.length ? clip + "…" : clip) : "";
}
