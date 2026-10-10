// arm Dp — D+ on PARAPHRASES of 14 questions it answered (post-hoc brittleness probe; the glue is template-shaped, so a changed surface form should show it).
import { byId, passageSet, gradeStated2, store, timed } from "../lib.mjs";
import { answerDplus } from "../mech.mjs";
const P = [
  ["r2-1", "What is the height of Mount Everest in feet?"], ["r2-2", "Tell me how tall the Eiffel Tower is in metres."], ["r2-11", "Give me the height of Mount Everest in kilometres."],
  ["r6-1", "Mount Everest or the Eiffel Tower: which one is higher?"], ["r6-3", "Between Leonardo da Vinci and Napoleon, who came into the world first?"], ["r6-5", "Out of Alexander Fleming and Marie Curie, who had the longer life?"],
  ["r8-2", "How long did Marie Curie live for?"], ["r8-6", "What was Albert Einstein's age at death?"], ["r8-1", "What is the gap in years between the Apollo 11 landing and the fall of the Berlin Wall?"],
  ["r8-8", "Add up the populations of Canberra and Iceland."], ["r9-3", "Was Lincoln's assassination earlier than the completion of the Eiffel Tower?"], ["r9-9", "Of Gandhi and Einstein, who passed away first?"],
  ["r10-1", "Io, Europa, Titan, Callisto: which of these is not a moon of Jupiter?"], ["r6-6", "Does Canberra or Iceland have a larger population?"],
];
const st = store("Dp");
for (const [id, q2] of P) {
  const q = byId(id); const qq = { ...q, id: id + "~p", q: q2 };
  if (st.done.has(qq.id)) continue;
  const o = answerDplus(q2, passageSet(q)); const g = gradeStated2(q, o.text, { gap: o.gap });
  st.put({ id: qq.id, orig: id, rung: q.rung, q: q2, gap: o.gap, why: o.why || null, skill: o.skill || null, text: o.text, grade: g });
  console.log(id, g.ok ? "OK " : "-- ", o.gap ? "gap:" + o.why : "", "|", q2.slice(0, 60), "=>", (o.text || "").slice(0, 70));
}
