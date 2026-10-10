// does the UNAPPLIED recall diff fix the two live failures (sibling-word collision; a fact turn that never names its topic)? Synthetic store shaped like the real one (R1/R2 on the real page).
import { recallOf as patched } from "./recall.patched.mjs";
import { recallOf as live } from "../../../../fold-chat-recall.js";
import { functionWordsOf } from "../../../../fold-chat-snippets.js";
import { claimAt, appendClaims } from "../../../../fold-chat-record.js";
const fw = functionWordsOf("en");
let st = [];
const add = (turn, ...texts) => { st = appendClaims(st, texts.map((t, i) => claimAt(turn, i + 1, "said", t))); };
add(1, "The source says the length of the Great Wall of China is unknown.");
add(2, "The Berlin Wall fell in 1989.");
add(3, "Marie Curie was a Polish and naturalized-French physicist and chemist.");
add(4, "It's 330 meters (1,083 feet) tall.");          // the fact-bearing turn about the Eiffel Tower names no tower
const asks = new Map([[1, "How long is the Great Wall of China?"], [2, "When did the Berlin Wall fall?"], [3, "Who was Marie Curie?"], [4, "How tall is the Eiffel Tower?"]]);
for (const q of ["What did you tell me about the Great Wall of China earlier?", "What did you tell me about the wall earlier?", "What did you tell me about the Leaning Tower of Pisa earlier?", "What did you tell me about the Eiffel Tower earlier?"]) {
  const a = live({ question: q, claims: st, fw }), b = patched({ question: q, claims: st, asks, fw });
  console.log(q, "\n   live   :", a ? "turn " + a.turn : "null", "\n   patched:", b ? "turn " + b.turn : "null");
}
