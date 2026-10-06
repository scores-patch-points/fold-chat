// eval/swarm/junk-judge.mjs — the DETERMINISTIC junk definition (frozen with docs/SNIP-JUNK-PREREG.md).
//
// A snip is JUNK when, read as a card a person is shown as "the page's words on your ask", it is
//   DOMINATED by chrome  : chrome units hold >= DOMINATED (0.5) of its word tokens, OR
//   LEADS with chrome    : one of its first LEAD_UNITS (2) units that have >= LEAD_MIN (3) word tokens is chrome
//                         (the first may be the page title, so the second is checked too).
// A UNIT is a run between sentence stops (. ! ? 。！？ before whitespace or end), line breaks, ellipsis marks, ' | '.
// A unit longer than WINDOW (40) tokens is cut into windows of 20 tokens (a menu dump has no stops).
// A unit is CHROME when
//   (L) declared chrome phrases (fold-chat-junk-lexicon.js CHROME, all languages) cover >= COVER (0.4) of its letters, or
//   (S) it is a STOPLESS RUN: >= STOPLESS_MIN (12) word tokens in a spaced script, function-word share < FW_MAX (0.10),
//       no internal sentence stop, and it is not code-like (symbol share < CODE_SYMBOLS 0.06).
//   (T) it is a TITLE-CASE RUN: >= STOPLESS_MIN word tokens in a script where case marks names (Latin, Cyrillic, Greek),
//       >= TITLE_SHARE (0.6) of the tokens begin with a capital letter or a digit, and no internal sentence stop.
// Function words are the union of fold-chat-function-words.js (UD-derived, 13 languages). Unspaced scripts (Han, Japanese,
// Thai) get rule (L) only. No capital-letter logic anywhere; case is folded with fold-chat-mind.js `fold`.
import { CHROME } from "../../fold-chat-junk-lexicon.js";
import { segments, scriptOf, isUnspaced, capitalisationIsSignificant, fold } from "../../fold-chat-mind.js";
import { FUNCTION_WORDS } from "../../fold-chat-function-words.js";

export const DEF = Object.freeze({ DOMINATED: 0.5, LEAD_MIN: 3, WINDOW: 40, STEP: 20, COVER: 0.4, STOPLESS_MIN: 12, FW_MAX: 0.1, CODE_SYMBOLS: 0.06, TITLE_SHARE: 0.6, LEAD_UNITS: 2 });
const FW = new Set(Object.values(FUNCTION_WORDS).flat().map(fold));
const PHRASES = [...new Set(Object.values(CHROME).flat().map(fold))].filter((p) => p.length >= 3).sort((a, b) => b.length - a.length);
const letters = (s) => (s.match(/[\p{L}\p{N}]/gu) || []).length;

export function units(text) {
  const out = [];
  for (const line of String(text ?? "").split(/\n+|\s…\s|…|\s\|\s/u)) {
    for (const u of line.split(/(?<=[.!?。！？]["')\]”’]*)\s+(?=\S)/u)) { const t = u.trim(); if (t) out.push(t); }
  }
  return out;
}
function windows(u) {
  const segs = segments(u); if (segs.length <= DEF.WINDOW) return [u];
  const out = []; for (let i = 0; i < segs.length; i += DEF.STEP) { const a = segs[i].start, b = segs[Math.min(i + DEF.STEP, segs.length) - 1].end; out.push(u.slice(a, b)); }
  return out;
}
function coverage(u, perToken = false) {
  const f = fold(u); const n = letters(f); if (!n) return perToken ? new Set() : 0;
  const mark = new Uint8Array(f.length);
  for (const p of PHRASES) { let at = 0; while ((at = f.indexOf(p, at)) >= 0) { for (let i = at; i < at + p.length; i++) mark[i] = 1; at += p.length; } }
  let c = 0; for (let i = 0; i < f.length; i++) if (mark[i] && /[\p{L}\p{N}]/u.test(f[i])) c++;
  return c / n;
}
// start offsets (in the unit) of the word tokens that sit inside a declared chrome phrase. Folding is length-preserving for
// the scripts used here except NFKD expansions, so the check is made on token text: a token is covered when its folded form
// occurs inside a phrase hit found in the folded unit (approximation, auditable, never used to change any text).
function phraseTokens(u) {
  const f = fold(u); const hit = new Uint8Array(f.length);
  for (const p of PHRASES) { let at = 0; while ((at = f.indexOf(p, at)) >= 0) { hit.fill(1, at, at + p.length); at += p.length; } }
  const out = new Set(); let pos = 0;
  for (const t of segments(u)) { const ft = fold(t.text); const at = f.indexOf(ft, pos); if (at >= 0) { pos = at + ft.length; if (hit[at]) out.add(t.start); } }
  return out;
}
export function classifyUnit(u) {
  const script = scriptOf(u); const toks = segments(u, script); const n = toks.length;
  const cov = coverage(u);
  if (cov >= DEF.COVER) return { chrome: true, why: "lexicon", n, cov };
  // (S) and (T) look at the tokens the lexicon did NOT already explain, and not at key: value data ("Price: 18").
  const covered = phraseTokens(u); const free = toks.filter((t) => !covered.has(t.start));
  const kv = (u.match(/[\p{L}]+:\s/gu) || []).length >= 2;
  if (!isUnspaced(script) && free.length >= DEF.STOPLESS_MIN - 4 && n >= DEF.STOPLESS_MIN && !kv) {
    const fw = free.filter((t) => FW.has(fold(t.text))).length / free.length;
    const stops = /[.!?。！？](?=\s)/u.test(u.replace(/[.!?]+$/u, ""));
    const sym = (u.match(/[{}()<>=;$\\[\]]/g) || []).length / u.length;
    if (fw < DEF.FW_MAX && !stops && sym < DEF.CODE_SYMBOLS) return { chrome: true, why: "stopless", n, cov, fw };
    if (capitalisationIsSignificant(script) && !stops) {
      const cap = free.filter((t) => /^[\p{Lu}\p{N}]/u.test(t.text)).length / free.length;
      if (cap >= DEF.TITLE_SHARE) return { chrome: true, why: "titlecase", n, cov, cap };
    }
  }
  return { chrome: false, why: "", n, cov };
}
/** { junk, dominated, leading, share, n } */
export function judge(text) {
  const us = units(text).flatMap((u) => windows(u).map((w) => ({ w, ...classifyUnit(w) })));
  const total = us.reduce((a, u) => a + u.n, 0) || 1;
  const ch = us.filter((u) => u.chrome).reduce((a, u) => a + u.n, 0);
  const head = us.filter((u) => u.n >= DEF.LEAD_MIN).slice(0, DEF.LEAD_UNITS);
  const leading = head.some((u) => u.chrome), dominated = ch / total >= DEF.DOMINATED;
  return { junk: leading || dominated, dominated, leading, share: +(ch / total).toFixed(3), n: total };
}
