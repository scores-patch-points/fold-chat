// text.mjs — shared, model-free text helpers for the study (tokens, digit normalisation, Wilson CIs, raw-HTML helpers).
import { segments, scriptOf, fold, isUnspaced } from "../app/fold-chat-mind.js";

export const normDigits = (s) => String(s ?? "")
  .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660))
  .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6f0))
  .replace(/[०-९]/g, (c) => String(c.charCodeAt(0) - 0x966))
  .replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10))
  .replace(/[    ]/g, " ").replace(/٫/g, ".").replace(/٬/g, ",");
export const gnorm = (s) => normDigits(String(s ?? "").normalize("NFKC"));

// A declared, hand-typed stopgap of question words (II.11: no giver beyond me): the matcher drops them.
const QSTOP = new Set(("what is the a an of in on to for how do does did i my me you your it its are was were who whom which when where why can could should would will " +
  "about cuál cuáles qué quién cuánto cuándo dónde cómo es la el los las de del en un una por " + "quelle quel quels quelles est la le les de du des en un une quoi comment combien quand " +
  "was ist die der das den dem ein eine wie wo wer wann welche welcher " + "qual quais é a o os as do da em um uma como quando onde quem quanto " +
  "какая какой какое какие каков какова каково в году каком как где кто когда сколько " + "ما هي هو في أي عام كم متى من كيف " + "क्या है की का के किस कितनी कितना कैसे कब कहाँ ").split(/\s+/));
const HAN_Q = /[的是了吗么呢什哪多少怎样请问个有在和与]/gu;
/** Content tokens of a text for relevance: script-aware (Intl.Segmenter), case/diacritic folded; unspaced scripts use character bigrams. */
export function tokens(text) {
  const t = gnorm(text);
  const script = scriptOf(t);
  if (isUnspaced(script)) {
    const letters = [...t.replace(HAN_Q, " ")].filter((c) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u.test(c));
    const out = new Set();
    // runs separated by non-letters, bigrams within a run
    for (const run of t.replace(HAN_Q, " ").split(/[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}ー]+/u)) {
      const cs = [...run]; for (let i = 0; i + 1 < cs.length; i++) { const bg = cs[i] + cs[i + 1]; if (!/^\p{Script=Hiragana}+$/u.test(bg)) out.add(bg); }
    }
    for (const m of t.match(/[\p{L}\p{N}]+/gu) || []) if (/^[A-Za-z0-9]{3,}$/.test(m) || /^\d{2,}$/.test(m)) out.add(m.toLowerCase());
    void letters; return [...out];
  }
  return [...new Set(segments(t, script).map((x) => fold(x.text)).filter((w) => !QSTOP.has(w) && (w.length >= 3 || /^\d+$/.test(w) && w.length >= 2)))];
}
/** Share of the ask's tokens that occur in `text`. */
export function coverage(askToks, text) {
  if (!askToks.length) return { share: 1, hit: [], n: 0 };
  const hay = gnorm(text).toLowerCase(); const hayF = fold(hay);
  const hit = askToks.filter((w) => hayF.includes(w) || hay.includes(w));
  return { share: hit.length / askToks.length, hit, n: askToks.length };
}
export const relevant = (askToks, text) => { const c = coverage(askToks, text); return c.hit.length >= Math.max(1, Math.ceil(0.34 * askToks.length)); };

export function wilson(k, n, z = 1.96) {
  if (!n) return { p: null, lo: null, hi: null, k, n };
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return { p, lo: Math.max(0, (c - m) / d), hi: Math.min(1, (c + m) / d), k, n };
}
export const pct = (w) => w.n ? `${(100 * w.p).toFixed(0)}% (${w.k}/${w.n}; CI ${(100 * w.lo).toFixed(0)}-${(100 * w.hi).toFixed(0)})` : "n/a (0)";

const ENT = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…", deg: "°", times: "×", frac12: "½" };
export const decodeEntities = (s) => String(s ?? "").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&([a-z0-9]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
/** Visible text of raw HTML, for the corroboration check only (never shown). */
export const visibleNorm = (raw) => gnorm(decodeEntities(String(raw ?? "").replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " "))).replace(/\s+/g, " ").toLowerCase();
export const squash = (s) => gnorm(s).replace(/\s+/g, " ").trim().toLowerCase();
