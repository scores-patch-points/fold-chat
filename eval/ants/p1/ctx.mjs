// ctx.mjs — what the model (and arm C) is handed: the A2 strand (product-realistic generic snips) or an oracle-ish gold-page context (separates reasoning from retrieval).
import { runA, neutral } from "./arms/a.mjs";
import { passageSet, norm } from "./lib.mjs";
import { page } from "./corpus.mjs";
const STOP = new Set("the a an and or but of in to with by for on at from as is are was were be been it its this that these those which who what when where why how than then so also there their they he she we you i do does did name tell between many much long tall old".split(" "));
export const stems = (s) => (String(s).toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter((w) => !STOP.has(w)).map((w) => w.replace(/(?:ing|ed|es|s)$/, ""));
export const sentencesOfText = (t) => norm(t).split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/).filter((s) => s.length > 20);
export function strandContext(q, ps = passageSet(q)) {
  const np = neutral(ps);
  const r = runA(q, np);
  const label = (s) => { const p = ps[s.p]; return (p?.ref || "").replace(/^.*— /, ""); };
  return r.snips.map((s) => `[${label(s)}] ${s.text}`).join("\n\n");
}
export function goldContext(q, { budget = 2800 } = {}) {
  const parts = [];
  for (const t of q.pages) {
    const p = page(t); const all = sentencesOfText(p.text);
    if (q.rung === 12) { parts.push(`[${t}] ${norm(p.text).slice(0, budget)}`); continue; }
    const qs = new Set(stems(q.q));
    const scored = all.map((s, i) => ({ s, i, sc: stems(s).filter((w) => qs.has(w)).length + (i === 0 ? 1 : 0) + (/\d/.test(s) ? 0.2 : 0) })).sort((a, b) => b.sc - a.sc).slice(0, q.pages.length > 1 ? 4 : 7).sort((a, b) => a.i - b.i);
    parts.push(`[${t}] ` + scored.map((x) => x.s).join(" "));
  }
  const out = parts.join("\n\n");
  return out.length > budget * 1.3 ? out.slice(0, Math.round(budget * 1.3)) : out;
}

/** ORACLE evidence: for each `needs` regex, the page sentence that carries it, plus each gold page's lead sentence. Uses the battery's own evidence labels (gold) — a DIAGNOSTIC for the model arm, never a product path. */
export function oracleContext(q) {
  if (q.rung === 12 || !q.needs) return goldContext(q);
  const byPage = new Map();
  for (const t of q.pages) { const all = sentencesOfText(page(t).text); byPage.set(t, { all, keep: new Set([0]) }); }
  for (const [t, re] of q.needs) {
    const e = byPage.get(t || q.pages[0]); if (!e) continue;
    const i = e.all.findIndex((s) => re.test(s)); if (i >= 0) e.keep.add(i);
    // the evidence regex may span a sentence boundary (the sentence splitter is not the grader): fall back to the two sentences around the match
    else { const full = e.all.join(" "); const m = re.exec(full); if (m) { let pos = 0; e.all.forEach((s, k) => { if (pos <= m.index && m.index < pos + s.length + 1) { e.keep.add(k); } pos += s.length + 1; }); } }
  }
  return q.pages.map((t) => { const e = byPage.get(t); return `[${t}] ` + [...e.keep].sort((a, b) => a - b).map((i) => e.all[i]).join(" "); }).join("\n\n");
}
