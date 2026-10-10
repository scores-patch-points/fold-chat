// score-lib.mjs — the scoring of P2, all by code (see eval/ants/P2-PREREG.md).
import { fold } from "../../../fold-chat-mind.js";
import { quantitiesIn, isMinimal, verifyRewrite, classifyAsk } from "../../../fold-chat-answerspan.js";
const sq = (s) => fold(String(s ?? "")).replace(/[   ]/g, " ").replace(/\s+/g, " ").trim();
const digitsOf = (s) => String(s).replace(/(?<=\d)[,  ](?=\d{3})/g, "");
/** Does `text` contain the answer? A figure key matches by value + dimension (330 metres == 330 m); anything else by case/diacritic/whitespace-folded substring. */
export function containsKey(text, ask) {
  const keys = [ask.key, ...(ask.alt || [])].filter(Boolean);
  const hay = sq(digitsOf(text));
  for (const k of keys) {
    if (ask.type === "figure") {
      const kq = quantitiesIn(k)[0];
      if (kq) { if (quantitiesIn(text).some((q) => q.v === kq.v && (q.dim === kq.dim || kq.dim === "bare" || q.dim === "bare"))) return true; continue; }
    }
    if (hay.includes(sq(digitsOf(k)))) return true;
  }
  return false;
}
export const precisionOf = (ask, shown) => (shown && shown.length ? Math.min(1, ask.min.replace(/\s+/g, " ").length / shown.replace(/\s+/g, " ").length) : 0);
export const median = (xs) => { const a = [...xs].sort((x, y) => x - y); return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null; };
export const quantile = (xs, q) => { const a = [...xs].sort((x, y) => x - y); if (!a.length) return null; const i = (a.length - 1) * q; const lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); };
export { isMinimal, verifyRewrite, classifyAsk };
