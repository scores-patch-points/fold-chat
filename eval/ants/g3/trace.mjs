// G3 trace: the reproduction, turn by turn, through the REAL planTurn / admitReferents / applyCarry / modelHistory (HEAD code, no model).
import { planTurn } from "../../../fold-chat-flow.js";
import { admitReferents, emptyReferents, resolveQuestion } from "../../../fold-chat-mind.js";
import { hintsFor } from "../../../fold-chat-hints.js";
import { classifyTurn } from "../../../fold-chat-discourse.js";
import { modelHistory } from "../../../fold-chat-channels.js";
import { applyCarry, carryOf } from "../../../fold-chat-carry.js";
import { threadOf } from "../../../fold-chat-thread.js";
const hints = hintsFor("en");
const T1 = "write me a song about trampolines", T2 = "who is mt. mckinlet named afer?", T3 = "why is the sky blue";
const A2 = "President McKinley, a name that rings so bold,\nAcross the land, a story to be told.\nMount McKinley stands tall, in Alaska's sky,\nNamed for a president, reaching up high.";
const msgs = [{ role: "user", content: T1 }, { role: "assistant", content: "", mode: "chat", grounding: { kind: "generate" } }];
console.log("kinds:", [T1, T2, T3].map((q) => classifyTurn(q, {})));
let ref = emptyReferents();
// turn 2 plan (referents empty or from turn 1 = none)
let p2 = planTurn(T2, msgs, { referents: ref, hints });
console.log("T2 plan:", JSON.stringify({ kind: p2.kind, mode: p2.mode, search: p2.search, reason: p2.reason }));
console.log("T2 history the model gets (modelHistory of transcript before answer):", JSON.stringify(modelHistory([...msgs, { role: "user", content: T2 }])));
msgs.push({ role: "user", content: T2 }, { role: "assistant", content: A2, grounding: { kind: "research", sources: [{ ref: "Wikipedia — Denali", address: "https://en.wikipedia.org/wiki/Denali" }, { ref: "Wikipedia — William McKinley", address: "https://en.wikipedia.org/wiki/William_McKinley" }] } });
ref = admitReferents(ref, { question: T2, answer: A2, sources: [{ title: "Denali" }, { title: "William McKinley" }] });
console.log("record after T2:", ref.entities.map((e) => `${e.surface}(${e.weight.toFixed(1)})`).join(", "));
for (const q of [T3, "why is sky blue", "who painted the Mona Lisa", "what is the boiling point of ethanol", "how do bats see in the dark"]) {
  const r = resolveQuestion(q, ref, { hints });
  const p = planTurn(q, msgs, { referents: ref, hints });
  console.log(`T3 "${q}": resolve.reason=${r.reason}  plan=${JSON.stringify({ kind: p.kind, mode: p.mode, search: p.search, carried: p.carried, reason: p.reason, act: p.act })}`);
}
