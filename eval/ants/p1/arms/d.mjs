// arm D (D0 evaluate as written; D+ = mech.mjs glue)
import { evaluate } from "../../../../fold-chat-compute.js";
import { answerDplus } from "../mech.mjs";
import { BATTERY, passageSet, gradeStated, store, timed, selected } from "../lib.mjs";
import { HOLDOUT } from "../battery-holdout.mjs";
const holdout = process.argv.includes("--holdout");
const arm = holdout ? "Dh" : "D";
const st = store(arm);
const qs = holdout ? HOLDOUT : selected();
for (const q of qs) {
  if (st.done.has(q.id)) continue;
  const ps = passageSet(q);
  const d0 = evaluate(q.q);
  const { out, err, ms } = await timed(() => answerDplus(q.q, ps));
  const o = out || { gap: true, why: "error", text: "" };
  const g = gradeStated(q, o.text, { gap: o.gap });
  st.put({ id: q.id, rung: q.rung, ms, err, d0ok: !!d0.ok, gap: o.gap, why: o.why || null, skill: o.skill || null, text: o.text, evidence: o.evidence, grade: g });
  console.log(q.id, g.ok ? "OK " : "-- ", o.skill || o.why, g.why, "|", (o.text || "").slice(0, 100));
}
