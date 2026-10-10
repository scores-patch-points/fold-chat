import { DEV } from "./asks-dev.mjs"; import { passagesOf } from "./asks-lib.mjs"; import { answerSpan } from "../../../fold-chat-answerspan.js";
const only = process.argv[2];
for (const a of DEV) { if (only && !a.id.startsWith(only)) continue; const r = answerSpan(a.q, passagesOf(a));
  console.log(`\n${a.id} [${a.type}] ${a.q}\n  ask=${r.ask.want} dim=${r.ask.dim} terms=${r.ask.terms}`);
  if (r.gap) console.log("  GAP", r.gap.kind, r.gap.reason);
  else for (const s of r.spans) console.log(`  p${s.passageIndex} c=${s.confidence} [${s.kind}] ${JSON.stringify(s.shown)}\n   raw=${JSON.stringify(s.text.slice(0,160))} why=${s.why.slice(1).join(" | ")}`);
  if (a.key) console.log("  GOLD:", a.min);
}
