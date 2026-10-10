// rulecount.mjs — how often each named rewrite rule fired on the shipped (first) span, over all four ask sets (final module)
import { passagesOf } from "./asks-lib.mjs"; import { answerSpan } from "../../../fold-chat-answerspan.js";
const sets = { dev: (await import("./asks-dev.mjs")).DEV, held: (await import("./asks-held.mjs")).HELD, h2: (await import("./asks-h2.mjs")).H2, h3: (await import("./asks-h3.mjs")).H3 };
const cnt = {}; let spans = 0, withRule = 0, pron = [];
for (const [name, asks] of Object.entries(sets)) for (const a of asks) {
  const r = answerSpan(a.q, passagesOf(a)); const s = r.spans[0]; if (!s) continue; spans++;
  if (s.rewrite && s.rewrite.rules.length) { withRule++; for (const x of s.rewrite.rules) { cnt[x.rule] = (cnt[x.rule] || 0) + 1; if (x.rule === "resolve-pronoun" || x.rule === "unit-swap" || x.rule === "attribute-quote" || x.rule === "drop-marker") pron.push(`${name}/${a.id} ${x.rule}: ${JSON.stringify(s.text.slice(0, 50))} -> ${JSON.stringify(s.shown.slice(0, 70))}`); } }
}
console.log(JSON.stringify({ shippedSpans: spans, withAtLeastOneRule: withRule, ruleCounts: cnt }, null, 1)); console.log(pron.join("\n"));
