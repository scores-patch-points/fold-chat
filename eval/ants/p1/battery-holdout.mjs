// eval/ants/p1/battery-holdout.mjs — 16 HOLD-OUT questions (rungs 2, 6, 8, 9), written and frozen BEFORE the D+ / E glue was written.
// The glue (D+, the figure/date binder) is developed with battery.mjs in view; this set, with different entities, tests whether it generalised or was fitted.
import { page } from "./corpus.mjs";
const Q = (id, rung, q, pages, o = {}) => ({ id, rung, q, pages, answerable: true, holdout: true, ...o });
const N = (t, re) => [t, re];
export const HOLDOUT = [
  Q("h2-1", 2, "How long is the Great Wall of China in miles?", ["Great Wall of China"], { needs: [N("Great Wall of China", /13,170\.70/)], gold: [/13,170/] }),
  Q("h2-2", 2, "How tall is the Statue of Unity in feet?", ["Statue of Unity"], { needs: [N("Statue of Unity", /182 metres \(597 feet\)/)], gold: [/\b597\b/] }),
  Q("h2-3", 2, "How deep is the Challenger Deep in kilometres?", ["Challenger Deep"], { conv: true, needs: [N("Challenger Deep", /10,935 ± 6 m/)], gold: [/10\.9/] }),
  Q("h2-4", 2, "How tall is the Statue of Unity in kilometres?", ["Statue of Unity"], { conv: true, needs: [N("Statue of Unity", /182 metres/)], gold: [/0\.18/] }),
  Q("h6-1", 6, "Which is taller, the Statue of Unity or the Eiffel Tower?", ["Statue of Unity", "Eiffel Tower"], { needs: [N("Statue of Unity", /182 metres/), N("Eiffel Tower", /330 metres/)], gold: [/Eiffel/], cmp: { win: /Eiffel/, lose: /Statue of Unity|Unity/, kind: "size" } }),
  Q("h6-2", 6, "Who was born first, Cleopatra or Napoleon?", ["Cleopatra", "Napoleon"], { needs: [N("Cleopatra", /70\/69 BC/), N("Napoleon", /15 August 1769/)], gold: [/Cleopatra/], cmp: { win: /Cleopatra/, lose: /Napoleon/, kind: "first" } }),
  Q("h6-3", 6, "Who lived longer, Napoleon or Abraham Lincoln?", ["Napoleon", "Abraham Lincoln"], { needs: [N("Napoleon", /15 August 1769 – 5 May 1821/), N("Abraham Lincoln", /February 12, 1809 – April 15, 1865/)], gold: [/Lincoln/], cmp: { win: /Lincoln/, lose: /Napoleon/, kind: "size" } }),
  Q("h6-4", 6, "Which has more people, Iceland or Switzerland?", ["Iceland", "Switzerland"], { needs: [N("Iceland", /395,000/), N("Switzerland", /9 million people/)], gold: [/Switzerland/], cmp: { win: /Switzerland/, lose: /Iceland/, kind: "size" } }),
  Q("h8-1", 8, "How many years did Napoleon live?", ["Napoleon"], { needs: [N("Napoleon", /15 August 1769 – 5 May 1821/)], gold: [/\b51\b|fifty-one/] }),
  Q("h8-2", 8, "How many years did Leonardo da Vinci live?", ["Leonardo da Vinci"], { needs: [N("Leonardo da Vinci", /15 April 1452 – 2 May 1519/)], gold: [/\b67\b|sixty-seven/] }),
  Q("h8-3", 8, "How many years did Abraham Lincoln live?", ["Abraham Lincoln"], { needs: [N("Abraham Lincoln", /February 12, 1809 – April 15, 1865/)], gold: [/\b56\b|fifty-six/] }),
  Q("h8-4", 8, "How many years passed between the dedication of the Statue of Liberty and the fall of the Berlin Wall?", ["Statue of Liberty", "Fall of the Berlin Wall"], { needs: [N("Statue of Liberty", /October 28, 1886/), N("Fall of the Berlin Wall", /9 November 1989/)], gold: [/\b103\b/] }),
  Q("h9-1", 9, "Which came first, Napoleon's birth or the dedication of the Statue of Liberty?", ["Napoleon", "Statue of Liberty"], { needs: [N("Napoleon", /15 August 1769/), N("Statue of Liberty", /October 28, 1886/)], gold: [/Napoleon/], cmp: { win: /birth|Napoleon/, lose: /Statue/, kind: "first" } }),
  Q("h9-2", 9, "Which came first, the fall of the Berlin Wall or the Apollo 11 landing?", ["Fall of the Berlin Wall", "Apollo 11"], { needs: [N("Fall of the Berlin Wall", /1989/), N("Apollo 11", /1969/)], gold: [/Apollo/], cmp: { win: /Apollo/, lose: /Berlin/, kind: "first" } }),
  Q("h9-3", 9, "Who died first, Napoleon or Abraham Lincoln?", ["Napoleon", "Abraham Lincoln"], { needs: [N("Napoleon", /5 May 1821/), N("Abraham Lincoln", /April 15, 1865/)], gold: [/Napoleon/], cmp: { win: /Napoleon/, lose: /Lincoln/, kind: "first" } }),
  Q("h9-4", 9, "Who was born first, Abraham Lincoln or Mahatma Gandhi?", ["Abraham Lincoln", "Mahatma Gandhi"], { needs: [N("Abraham Lincoln", /February 12, 1809/), N("Mahatma Gandhi", /2 October 1869/)], gold: [/Lincoln/], cmp: { win: /Lincoln/, lose: /Gandhi/, kind: "first" } }),
];
export function validate() { const bad = []; for (const q of HOLDOUT) for (const [t, re] of q.needs || []) if (!re.test(page(t).text.replace(/\s+/g, " "))) bad.push(`${q.id}: ${re} not on ${t}`); return bad; }
if (import.meta.url === `file://${process.argv[1]}`) { const b = validate(); console.log(HOLDOUT.length, "holdout questions;", b.length ? b.join("\n") : "valid"); }
