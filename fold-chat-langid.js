// fold-chat-langid.js — which language is this short text in? Pure: no DOM, no IO, no model, no network, deterministic.
//
// The chat's old detector counted hand-typed stopwords, and two ambiguous words ("a", "me") made "show me a cookie recipe"
// Portuguese (docs/LANGID-PREREG.md). This module reads the language the way the suite's other readers do, from priors
// with a giver: fold-chat-lang-priors.js, built by scripts/build-lang-priors.mjs from the khora's POS priors
// (Universal Dependencies gold treebanks) — each language's word distribution and character distribution.
//
//   1. SCRIPT first (Unicode blocks, omnilingual): a script that one language owns is the language (Hangul → ko, Thai → th,
//      Greek → el, Hebrew → he, Bengali → bn, …); Han with any Kana is ja, with Hangul ko, else zh. A foreign brand name or
//      a loanword inside a caseless text does not change its script (non-Latin runs are compared with Latin words).
//   2. SHARED scripts (Latin, Cyrillic, Arabic, Devanagari): naive Bayes over the words and the character 1-3-grams of each
//      candidate language's prior. A feature a language does not list costs that language its floor; features no
//      candidate lists (a name, a typo) say nothing.
//   3. A confident answer needs (a) a lead over the runner-up of at least DECLARED.margin nats, (b) for Latin script, at
//      least one function word of the winner (or a very large lead on >= 2 words) and a fit of the winner's n-grams: names,
//      one-word asks, brand names and languages with no prior stay `unknown`. An answer the
//      detector is not sure of is `unknown`, never a guess.
//   4. THREAD PRIOR: the language the conversation has been in (`prior`) is a head start of DECLARED.priorBonus nats here, and
//      fold-chat-lang.js inherits it outright when the text itself has no language evidence ("chewier", "and him?").
//
// DECLARED constants (Constitution II.11): effect measured on the labelled set in docs/LANGID-PREREG.md, not derived.
import { PRIORS } from "./fold-chat-lang-priors.js";

export const DECLARED = Object.freeze({
  // nats the winner must lead the runner-up by (per candidate group; tuned on the dev third of eval/langid)
  margin: 4,
  // weight of the word features and of the character features in the naive Bayes sum
  wordWeight: 1,
  gramWeight: 0.3,
  // Latin script: function words of the winner required before a language is named ...
  minFunctionWords: 1,
  // ... unless the lead is this large (agglutinative languages have few short function words) and the text has >= 2 words
  strongMargin: 10,
  // the winner must list at least this share of the text's character n-grams (a language with no prior fits poorly)
  minFit: 0.75,
  // per-script override of `minFit` (Cyrillic has four candidates and thin priors; Arabic and Devanagari are script-owned enough)
  scriptMinFit: { Cyrillic: 0.8, Arabic: 0, Devanagari: 0 },
  // how many of each language's most frequent forms count as its FUNCTION WORDS
  fwTop: 80,
  // per-script override of `margin` (the Cyrillic candidates are few and the Russian prior is the smallest treebank of the large languages)
  scriptMargin: { Cyrillic: 2.5 },
  // an orthographic mark only one language of the group uses (inverted ? and ! are Spanish): nats added to it
  markBonus: 8,
  // head start (nats) for the thread's language
  priorBonus: 6,
});

// Marks a Latin-script language alone writes (a declared fact about orthography; the priors only see letters)
const MARKS = Object.freeze([[/[¿¡]/, "es"]]);
// Scripts one language owns (a declared fact about writing systems). Han / Kana are decided in identify().
const SINGLE = Object.freeze({
  Greek: "el", Hebrew: "he", Thai: "th", Bengali: "bn", Gurmukhi: "pa", Gujarati: "gu", Oriya: "or", Tamil: "ta", Telugu: "te",
  Kannada: "kn", Malayalam: "ml", Sinhala: "si", Lao: "lo", Tibetan: "bo", Myanmar: "my", Georgian: "ka", Armenian: "hy",
  Ethiopic: "am", Khmer: "km", Hangul: "ko",
});
const SCRIPT_RES = [
  ["Latin", /\p{Script=Latin}/u], ["Cyrillic", /\p{Script=Cyrillic}/u], ["Arabic", /\p{Script=Arabic}/u], ["Devanagari", /\p{Script=Devanagari}/u],
  ["Han", /\p{Script=Han}/u], ["Kana", /[\p{Script=Hiragana}\p{Script=Katakana}]/u], ["Hangul", /\p{Script=Hangul}/u],
  ["Greek", /\p{Script=Greek}/u], ["Hebrew", /\p{Script=Hebrew}/u], ["Thai", /\p{Script=Thai}/u], ["Bengali", /\p{Script=Bengali}/u],
  ["Gurmukhi", /\p{Script=Gurmukhi}/u], ["Gujarati", /\p{Script=Gujarati}/u], ["Oriya", /\p{Script=Oriya}/u], ["Tamil", /\p{Script=Tamil}/u],
  ["Telugu", /\p{Script=Telugu}/u], ["Kannada", /\p{Script=Kannada}/u], ["Malayalam", /\p{Script=Malayalam}/u], ["Sinhala", /\p{Script=Sinhala}/u],
  ["Lao", /\p{Script=Lao}/u], ["Tibetan", /\p{Script=Tibetan}/u], ["Myanmar", /\p{Script=Myanmar}/u], ["Georgian", /\p{Script=Georgian}/u],
  ["Armenian", /\p{Script=Armenian}/u], ["Ethiopic", /\p{Script=Ethiopic}/u], ["Khmer", /\p{Script=Khmer}/u],
];
const LETTER = /\p{L}/u, MARK = /\p{M}/u;
function scriptOfChar(ch) {
  const c = ch.codePointAt(0);
  if (c < 0x250) return "Latin"; // ASCII and Latin-1/Extended-A/B letters (the only letters below U+0250)
  for (const [name, re] of SCRIPT_RES) if (re.test(ch)) return name;
  return "Other";
}

// ── the priors, decoded once ──────────────────────────────────────────────────────────────────────────────────
let INDEX = {};
/** Swap the priors (experiments and tests only): useIndex(otherPriors), or useIndex() for the shipped ones. */
export function useIndex(priors = null, { fwTop = null, drop = [] } = {}) { INDEX = {}; OVERRIDE = priors; FWTOP = fwTop; DROP = new Set(drop); }
let OVERRIDE = null, FWTOP = null, DROP = new Set();
function fold(s) { return s.normalize("NFD").replace(/\p{M}+/gu, "").normalize("NFC"); }
// One script group is decoded the first time a text in that script is read (a Latin ask never pays for Cyrillic).
function groupOf(script) {
  if (INDEX[script]) return INDEX[script];
  const g = { codes: [], keys: [], wf: [], gf: [], words: new Map(), grams: new Map(), fw: [] };
  for (const [key, p] of Object.entries(OVERRIDE || PRIORS)) {
    if (p.script !== script || DROP.has(key)) continue;
    const i = g.codes.length;
    g.codes.push(key.split("#")[0]); g.keys.push(key); g.wf.push(-p.wf / 10); g.gf.push(-p.gf / 10);
    g.fw.push(new Set(p.fw.split(" ").slice(0, FWTOP || DECLARED.fwTop)));
    for (const e of p.w.split(",")) { const k = e.lastIndexOf(":"); const w = e.slice(0, k), q = +e.slice(k + 1); let a = g.words.get(w); if (!a) g.words.set(w, (a = [])); a.push(i, -q / 10 + p.wf / 10); }
    for (const e of p.g.split(",")) { const k = e.lastIndexOf(":"); const w = e.slice(0, k), q = +e.slice(k + 1); let a = g.grams.get(w); if (!a) g.grams.set(w, (a = [])); a.push(i, -q / 10 + p.gf / 10); }
  }
  return (INDEX[script] = g.codes.length ? g : null);
}

/** Candidate languages the priors can tell apart in a script group, e.g. languagesOf("Latin"). */
export const languagesOf = (script) => (groupOf(script)?.codes || []).slice();

// ── tokens and script runs ──────────────────────────────────────────────────────────────────────────────────
function runsOf(text) {
  // maximal runs of letters (+ their marks) of one script; Han/Kana runs are one 'Cjk' family, digits and punctuation split runs
  const s = String(text ?? "").normalize("NFC").toLowerCase().replace(/̇/g, "");
  const out = []; let cur = null;
  for (const ch of s) {
    if (MARK.test(ch) && cur) { cur.text += ch; continue; }
    if (!LETTER.test(ch)) { cur = null; continue; }
    const sc = scriptOfChar(ch);
    const fam = sc === "Kana" ? "Han" : sc;
    if (cur && cur.fam === fam) { cur.text += ch; cur.letters++; if (sc === "Kana") cur.kana++; if (sc === "Han") cur.han++; continue; }
    cur = { fam, text: ch, letters: 1, kana: sc === "Kana" ? 1 : 0, han: sc === "Han" ? 1 : 0 };
    out.push(cur);
  }
  return out;
}

function scoreGroup(g, tokens, { wordWeight, gramWeight }, prior) {
  const n = g.codes.length, s = new Float64Array(n);
  let words = 0, grams = 0, gramsAll = 0, fwHits = new Int32Array(n), gramHit = new Int32Array(n);
  for (const t of tokens) {
    const wa = g.words.get(t);
    if (wa) { words++; for (let k = 0; k < wa.length; k += 2) s[wa[k]] += wordWeight * wa[k + 1]; }
    // the character n-grams of "_word_"
    const cs = [...("_" + t + "_")];
    for (let i = 0; i < cs.length; i++) {
      for (let len = 1; len <= 3 && i + len <= cs.length; len++) {
        const gr = len === 1 ? cs[i] : len === 2 ? cs[i] + cs[i + 1] : cs[i] + cs[i + 1] + cs[i + 2];
        if (len === 1 && gr === "_") continue; if (len === 2 && gr === "__") continue;
        gramsAll++;
        const ga = g.grams.get(gr);
        if (ga) { grams++; for (let k = 0; k < ga.length; k += 2) { s[ga[k]] += gramWeight * ga[k + 1]; gramHit[ga[k]]++; } }
      }
    }
  }
  // every feature at least one language lists costs the others their floor
  for (let i = 0; i < n; i++) s[i] += wordWeight * words * g.wf[i] + gramWeight * grams * g.gf[i];
  for (const t of tokens) if (t.length >= 2) for (let i = 0; i < n; i++) if (g.fw[i].has(t)) fwHits[i]++;
  if (prior && prior.lang) { const j = g.codes.indexOf(prior.lang); if (j >= 0) s[j] += prior.bonus; }
  return { s, fwHits, words, grams, gramsAll, gramHit };
}

/** identify(text, { prior: { lang, bonus? } }) → { lang, script, confident, hits, margin, second, inherited, scores? }.
 *  lang is a language code, or 'unknown'. Never throws. */
export function identify(text, opts = {}) {
  const P = { ...DECLARED, ...opts };
  const none = (script = "Other", extra = {}) => ({ lang: "unknown", script, confident: false, hits: 0, margin: 0, second: null, inherited: false, ...extra });
  try {
    const runs = runsOf(text);
    if (!runs.length) return none();
    const prior = opts.prior && opts.prior.lang ? { lang: opts.prior.lang, bonus: opts.prior.bonus ?? P.priorBonus } : null;
    // which script is the text in? Latin WORDS (brand names, loanwords) are counted against non-Latin RUNS.
    const latinWords = runs.filter((r) => r.fam === "Latin").length;
    const byFam = new Map();
    for (const r of runs) if (r.fam !== "Latin") { const e = byFam.get(r.fam) || { runs: 0, letters: 0, kana: 0, han: 0 }; e.runs++; e.letters += r.letters; e.kana += r.kana; e.han += r.han; byFam.set(r.fam, e); }
    let nl = null; for (const [fam, e] of byFam) if (!nl || e.letters > nl.e.letters) nl = { fam, e };
    const script = nl && nl.e.runs >= latinWords ? nl.fam : "Latin";
    if (script === "Han") {
      const han = byFam.get("Han");
      const lang = han.kana > 0 ? "ja" : "zh";
      return { lang, script: han.kana > 0 ? "Japanese" : "Han", confident: true, hits: 1, margin: Infinity, second: null, inherited: false };
    }
    if (SINGLE[script]) return { lang: SINGLE[script], script, confident: true, hits: 1, margin: Infinity, second: null, inherited: false };
    if (script === "Other") return none("Other");
    const g = groupOf(script);
    if (!g) return none(script);
    const tokens = runs.filter((r) => r.fam === script).map((r) => r.text);
    const { s, fwHits, words, grams, gramsAll, gramHit } = scoreGroup(g, tokens, P, prior);
    if (script === "Latin") for (const [re, code] of MARKS) { const j = g.codes.indexOf(code); if (j >= 0 && re.test(String(text))) s[j] += P.markBonus; }
    let b = 0, b2 = -1; for (let i = 1; i < s.length; i++) if (s[i] > s[b]) b = i;
    for (let i = 0; i < s.length; i++) if (i !== b && (b2 < 0 || s[i] > s[b2])) b2 = i;
    const margin = s[b] - (b2 >= 0 ? s[b2] : 0);
    const lang = g.codes[b], second = b2 >= 0 ? g.codes[b2] : null;
    const hits = fwHits[b];
    const fit = gramsAll ? gramHit[b] / gramsAll : 0;
    const base = { script, hits, margin, second, fit };
    if (opts.debug) base.top = [...s].map((v, i) => [g.codes[i], +v.toFixed(1)]).sort((x, y) => y[1] - x[1]).slice(0, 4);
    if (!words && !grams) return none(script, base);
    const needFw = script === "Latin" ? P.minFunctionWords : 0;
    const need = (P.scriptMargin && P.scriptMargin[script]) ?? P.margin;
    const own = margin >= need && fit >= ((P.scriptMinFit && P.scriptMinFit[script]) ?? P.minFit) && (hits >= needFw || (margin >= P.strongMargin && tokens.length >= 2));
    if (own) return { ...base, lang, confident: true, inherited: false };
    return none(script, base);   // (inheriting the thread's language outright is fold-chat-lang.js's job)
  } catch (e) {
    return none();
  }
}
