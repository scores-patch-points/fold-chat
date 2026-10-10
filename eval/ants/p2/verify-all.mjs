// verify-all.mjs <dev|held> — post-hoc (d): re-run answerSpan and check EVERY shipped span independently of run.mjs:
//   verbatim: the span text is the page's (or the declared item's) own bytes at [start,end); shown: that text, or verifyRewrite re-derives it; no digit run in the shown text that the source lacks.
import { passagesOf } from "./asks-lib.mjs"; import { answerSpan, verifyRewrite } from "../../../fold-chat-answerspan.js";
const set = process.argv[2] || "held"; const asks = set === "dev" ? (await import("./asks-dev.mjs")).DEV : set === "h2" ? (await import("./asks-h2.mjs")).H2 : set === "h3" ? (await import("./asks-h3.mjs")).H3 : (await import("./asks-held.mjs")).HELD;
let spans = 0, verbatimOK = 0, shownOK = 0, rewrites = 0; const bad = [];
for (const a of asks) {
  const ps = passagesOf(a); const r = answerSpan(a.q, ps);
  for (const s of r.spans) {
    spans++; const p = ps[s.passageIndex];
    const base = s.item ? p.declared[s.item.block].items[s.item.item] : p.text;
    const vOK = base.slice(s.start, s.end) === s.text; if (vOK) verbatimOK++; else bad.push([a.id, "verbatim"]);
    let sOK = false;
    if (s.rewrite) { rewrites++; sOK = verifyRewrite(s.rewrite, p).ok && s.rewrite.text === s.shown; } else sOK = s.shown === s.text;
    if (sOK) shownOK++; else bad.push([a.id, "shown"]);
    const held = new Set((base.match(/\d[\d,.]*/g) || []).concat((p.text.match(/\d[\d,.]*/g) || [])).map((x) => x.replace(/[,.]+$/, "").replace(/,/g, "")));
    for (const n of s.shown.match(/\d[\d,.]*/g) || []) if (!held.has(n.replace(/[,.]+$/, "").replace(/,/g, ""))) bad.push([a.id, "figure " + n]);
  }
}
console.log(JSON.stringify({ set, asks: asks.length, spans, verbatimOK, shownOK, withRewrite: rewrites, bad }));
