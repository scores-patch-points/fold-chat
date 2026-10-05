// fold-chat-snippets.js — the librarian reads the catalog card before fetching the book.
//
// A search engine's results are an INDEX: each entry carries the sentence around the hit. For many
// questions the answer is already on the card, and opening the page (a fetch, a parse, 1–2 s, a
// chance of a refusal) buys nothing. This module decides — mechanically, in any language — when the
// cards are enough, and hands them over as passages labelled as snippets (never as read pages).
//
// THE RULE (A2 in experiments/source-routing/RESULTS.md; frozen before the holdout was run):
//   · a BACKGROUND of every card this tab has seen, per language, tells which words are common —
//     no stoplist, no capitals; a word's commonness is measured, not listed;
//   · the question's RARE words are the ones that say what it is about;
//   · an ON-TOPIC card carries at least `topicFrac` of those rare words;
//   · an AGREED TERM is a word, not in the question and rare in the background, that on-topic cards
//     from at least `minHosts` DISTINCT sites share — independent sources on one point;
//   · with an agreed term the cards are sufficient and the cards that carry it are handed over.
// It knows nothing about what the answer IS, only that independent sites on the same topic agree on a
// rare word. A language with too little background (or an undetectable one) ABSTAINS: the pages are
// read as before. Learning: `learnBackground` is fed each SERP AFTER it is judged, so a search is
// never judged against itself.
//
// Measured, not assumed: the rule ships OFF (`snippetFirst: false`) until the holdout in RESULTS.md says so.

import { segments, fold } from "./fold-chat-mind.js";
import { detectLang } from "./fold-chat-lang.js";
import { FUNCTION_WORDS } from "./fold-chat-function-words.js";

export const DECLARED = Object.freeze({
  minHosts: 3,            // independent sites that must share the agreed term
  rareTerm: 0.02,         // an agreed term must be in at most this share of background cards
  rareQuestionWord: 0.10, // a question word is "rare" (says what it is about) at most this share
  topicFrac: 0.7,         // share of the question's rare words an on-topic card must carry
  minBackground: 80,      // cards of background a language needs before the rule will speak
  minSnippetChars: 40,    // a card shorter than this says nothing alone
});

const wordsOf = (s) => segments(s).map((x) => fold(x.text));
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return String(u); } };
const cardsOf = (results) => (results || []).filter((r) => r && r.url && String(r.snippet || "").length >= DECLARED.minSnippetChars)
  .map((r) => { const seq = wordsOf((r.title || "") + " " + (r.snippet || "")); return { r, host: hostOf(r.url), seq, w: new Set(seq) }; });

/** The tab's memory of what is common: per language, how many cards and in how many each word stood. */
export function makeBackground(seed = null) {
  const bg = { byLang: new Map() };
  if (seed && typeof seed === "object") for (const [lang, v] of Object.entries(seed)) bg.byLang.set(lang, { n: v.n | 0, df: new Map(Object.entries(v.df || {})) });
  return bg;
}
export const languageOf = (question, results) => detectLang([question, ...(results || []).map((r) => (r && ((r.title || "") + " " + (r.snippet || "")))).filter(Boolean)].join(" ")).lang;

/** Feed a judged SERP into the background (never before it is judged). */
export function learnBackground(bg, lang, results) {
  if (!bg || !lang || lang === "unknown") return;
  const b = bg.byLang.get(lang) || { n: 0, df: new Map() };
  for (const c of cardsOf(results)) { b.n++; for (const w of c.w) b.df.set(w, (b.df.get(w) || 0) + 1); }
  if (b.df.size > 60000) for (const [w, n] of b.df) if (n < 2) b.df.delete(w);   // bound the memory
  bg.byLang.set(lang, b);
}
/** The background as plain JSON (words seen at least twice), for shipping a seed. */
export function exportBackground(bg, { minDf = 2 } = {}) {
  const out = {};
  for (const [lang, b] of bg.byLang) out[lang] = { n: b.n, df: Object.fromEntries([...b.df].filter(([, n]) => n >= minDf)) };
  return out;
}

// ── v2: independent chains (Bukhari) + placement against a null (Fisher) + little input (Chomsky/Sullivan) ──
// Frozen before any v2 data was collected — experiments/source-routing/RESULTS.md, "v2 of the snippet rule".
// v3 (frozen before outcomes were looked at): ask the priors first. With no learned background but a function-word list
// (khora POSPrior@1, UD gold), the rule speaks in a STRICTER mode — when content cannot be told from filler, demand all of it.
export const DECLARED_V3 = Object.freeze({ topicFracNoBackground: 1.0, minChainsNoBackground: 4 });
const fwCache = new Map();
/** The function words of a language (Set), or null when the khora has no committed prior for it. */
export function functionWordsOf(lang) {
  if (!FUNCTION_WORDS[lang]) return null;
  if (!fwCache.has(lang)) fwCache.set(lang, new Set(FUNCTION_WORDS[lang]));
  return fwCache.get(lang);
}
export const DECLARED_V2 = Object.freeze({
  minChains: 3,        // independent chains that must carry the agreed term
  nullDraws: 300,      // draws of the null each placement is made against
  alpha: 0.05,         // fire only if P(null max chain count >= observed) <= alpha
  minBackground: 24,   // cards of same-language background (three SERPs) before the rule will speak
  copyRun: 6,          // cards sharing a run of this many consecutive words are one chain
});

// Second-level labels under which a registrable domain has three parts (co.uk, com.au, ac.jp …).
const SLD = new Set(["co", "com", "org", "net", "gov", "edu", "ac", "or", "ne"]);
/** The registrable domain: en.wikipedia.org and simple.wikipedia.org are ONE publisher. */
export function registrable(host) {
  const p = String(host).split(".");
  if (p.length <= 2) return String(host);
  return p.at(-1).length === 2 && SLD.has(p.at(-2)) ? p.slice(-3).join(".") : p.slice(-2).join(".");
}

/** Group cards into independent chains: one registrable domain is one chain, and cards that share a run of
 *  `copyRun` consecutive words (a copy, a mirror, a syndication) are merged into one chain. Returns the chain
 *  id of each card, 0..k-1. */
export function chainsOf(cards, { copyRun = DECLARED_V2.copyRun } = {}) {
  const parent = cards.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); };
  const byDomain = new Map();
  cards.forEach((c, i) => { const d = registrable(c.host); if (byDomain.has(d)) union(i, byDomain.get(d)); else byDomain.set(d, i); });
  const seen = new Map();
  cards.forEach((c, i) => {
    for (let k = 0; k + copyRun <= c.seq.length; k++) {
      const sh = c.seq.slice(k, k + copyRun).join(" ");
      if (seen.has(sh)) union(i, seen.get(sh)); else seen.set(sh, i);
    }
  });
  const ids = new Map();
  return cards.map((_, i) => { const r = find(i); if (!ids.has(r)) ids.set(r, ids.size); return ids.get(r); });
}

function rngFrom(seedText) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seedText.length; i++) { h ^= seedText.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return () => { h = (h + 0x6d2b79f5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** A figure is a placement against a null built by shuffling, or it is refused (Fisher). The null: every chain keeps
 *  the NUMBER of candidate terms it carries and draws them uniformly from the pool of candidate terms the on-topic
 *  chains offer; the statistic is the largest number of chains any one term lands in. Returns P(null max >= observed). */
export function placement(chainTerms, observed, { draws = DECLARED_V2.nullDraws, seed = "" } = {}) {
  const pool = [...new Set(chainTerms.flatMap((t) => [...t]))];
  if (!pool.length) return 1;
  const rng = rngFrom(seed + "|" + pool.length + "|" + chainTerms.length);
  let ge = 0;
  for (let d = 0; d < draws; d++) {
    const count = new Map();
    for (const terms of chainTerms) {
      const k = terms.size;
      const idx = new Set();
      while (idx.size < Math.min(k, pool.length)) idx.add(Math.floor(rng() * pool.length));
      for (const i of idx) count.set(i, (count.get(i) || 0) + 1);
    }
    let mx = 0; for (const v of count.values()) if (v > mx) mx = v;
    if (mx >= observed) ge++;
  }
  return (ge + 1) / (draws + 1);
}

/**
 * @returns { sufficient, abstained, why, term, lang, covering:[result], hosts }
 */
export function snippetsSufficient(results = [], question = "", { background = null, lang = null, rule = "v1", ...over } = {}) {
  if (rule === "v2") return snippetsSufficientV2(results, question, { background, lang, ...over });
  if (rule === "v3") return snippetsSufficientV2(results, question, { background, lang, useFunctionWords: true, ...over });
  const D = { ...DECLARED, ...over };
  const L = lang || languageOf(question, results);
  const none = (why, extra = {}) => ({ sufficient: false, abstained: false, why, term: null, lang: L, covering: [], hosts: 0, ...extra });
  const b = background && background.byLang.get(L);
  if (!b || b.n < D.minBackground) return none(`no background for ${L}: ${b ? b.n : 0} of ${D.minBackground} cards — reading the pages instead`, { abstained: true });
  const cards = cardsOf(results);
  if (new Set(cards.map((c) => c.host)).size < D.minHosts) return none("too few cards from distinct sites");
  const share = (w) => (b.df.get(w) || 0) / b.n;
  const q = [...new Set(wordsOf(question))];
  const qRare = q.filter((w) => share(w) <= D.rareQuestionWord);
  if (!qRare.length) return none("the question has no rare word to be about");
  const need = Math.ceil(D.topicFrac * qRare.length);
  const on = cards.filter((c) => qRare.filter((w) => c.w.has(w)).length >= need);
  if (new Set(on.map((c) => c.host)).size < D.minHosts) return none(`only ${new Set(on.map((c) => c.host)).size} site(s) carry the question's rare words`);
  const asked = new Set(q);
  const per = new Map();
  for (const c of on) for (const w of c.w) { if (asked.has(w) || w.length < 2) continue; if (!per.has(w)) per.set(w, new Set()); per.get(w).add(c.host); }
  let best = null;
  for (const [w, hs] of per) {
    if (hs.size < D.minHosts || share(w) > D.rareTerm) continue;
    const score = hs.size * Math.log(1 / (share(w) + 1 / b.n));
    if (!best || score > best.score) best = { w, score };
  }
  if (!best) return none("no rare term that independent sites share");
  const covering = on.filter((c) => c.w.has(best.w));
  return { sufficient: true, abstained: false, why: `independent sites agree on "${best.w}"`, term: best.w, lang: L, covering: covering.map((c) => c.r), hosts: new Set(covering.map((c) => c.host)).size };
}

function snippetsSufficientV2(results, question, { background = null, lang = null, useFunctionWords = false, ...over } = {}) {
  const D = { ...DECLARED, ...DECLARED_V2, ...over };
  const L = lang || languageOf(question, results);
  const none = (why, extra = {}) => ({ sufficient: false, abstained: false, why, term: null, lang: L, covering: [], hosts: 0, chains: 0, ...extra });
  const b0 = background && background.byLang.get(L);
  const hasBg = !!b0 && b0.n >= D.minBackground;
  const fw = useFunctionWords ? functionWordsOf(L) : null;
  if (!hasBg && !fw) return none(`no background for ${L}: ${b0 ? b0.n : 0} of ${D.minBackground} cards${useFunctionWords ? " and no function-word prior" : ""} — reading the pages instead`, { abstained: true });
  // v3 with no learned background: the stricter mode (all the question's content words on a card, ≥ 4 independent chains)
  if (!hasBg) { D.topicFrac = DECLARED_V3.topicFracNoBackground; D.minChains = DECLARED_V3.minChainsNoBackground; }
  const b = hasBg ? b0 : { n: 1, df: new Map() };
  const cards = cardsOf(results);
  const chain = chainsOf(cards, { copyRun: D.copyRun });
  if (new Set(chain).size < D.minChains) return none("too few independent chains");
  const share = (w) => (fw && fw.has(w) ? 1 : hasBg ? (b.df.get(w) || 0) / b.n : 0);
  const q = [...new Set(wordsOf(question))];
  const qRare = q.filter((w) => share(w) <= D.rareQuestionWord);
  if (!qRare.length) return none("the question has no rare word to be about");
  const need = Math.ceil(D.topicFrac * qRare.length);
  const onIdx = cards.map((c, i) => (qRare.filter((w) => c.w.has(w)).length >= need ? i : -1)).filter((i) => i >= 0);
  const onChains = new Set(onIdx.map((i) => chain[i]));
  if (onChains.size < D.minChains) return none(`only ${onChains.size} independent chain(s) carry the question's rare words`);
  const asked = new Set(q);
  // chain -> the candidate terms it carries (a chain carries a term if any of its on-topic cards does)
  const chainIds = [...onChains];
  const terms = chainIds.map(() => new Set());
  for (const i of onIdx) for (const w of cards[i].w) { if (asked.has(w) || w.length < 2 || share(w) > D.rareTerm) continue; terms[chainIds.indexOf(chain[i])].add(w); }
  const count = new Map();
  for (const t of terms) for (const w of t) count.set(w, (count.get(w) || 0) + 1);
  let best = null;
  for (const [w, c] of count) { const score = c * Math.log(1 / (share(w) + 1 / b.n)); if (!best || c > best.c || (c === best.c && score > best.score)) best = { w, c, score }; }
  if (!best || best.c < D.minChains) return none("no rare term that independent chains share");
  const p = placement(terms, best.c, { draws: D.nullDraws, seed: question });
  if (p > D.alpha) return none(`"${best.w}" in ${best.c} chains is not placed against chance (p=${p.toFixed(3)} > ${D.alpha}) — refused`, { chains: best.c, placement: p });
  const covering = onIdx.filter((i) => cards[i].w.has(best.w)).map((i) => cards[i]);
  return { sufficient: true, abstained: false, why: `${best.c} independent chains agree on "${best.w}" (p=${p.toFixed(3)})`, term: best.w, lang: L, covering: covering.map((c) => c.r), hosts: new Set(covering.map((c) => chain[cards.indexOf(c)])).size, chains: best.c, placement: p };
}

/** The cards as passages — labelled as snippets, one per distinct site, best first. */
export function snippetPassages(covering = [], { max = 5 } = {}) {
  const seen = new Set(), out = [];
  for (const r of covering) {
    const h = hostOf(r.url);
    if (seen.has(h)) continue;
    seen.add(h);
    out.push({ ref: (r.source || h) + " — " + (r.title || h), source: r.url, text: (r.title ? r.title + ". " : "") + r.snippet, via: "snippet", url: r.url, snippetOnly: true });
    if (out.length >= max) break;
  }
  return out;
}
