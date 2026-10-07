// eval/ants/c7/audit2.mjs — C7 audit part 2: the chat's real composed prompt, the Pivot's pathos, counsel/continue/restate/pointer prompts, and the import graph (A4/A5/A6).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { door } from "../../../fold-chat-gary.js";
import { readFelt } from "../../../fold-chat-pathos.js";
import { cuesFor, actOf } from "../../../fold-chat-flow.js";
import { pivotText } from "../../../fold-chat-pivot.js";
import { draftMessages } from "../../../fold-chat-counsel.js";
import { continueMessages } from "../../../fold-chat-continue.js";
import { restateMessages } from "../../../fold-chat-lang.js";
import { numberedMessages } from "../../../fold-chat-provenance.js";
import { applyCarry } from "../../../fold-chat-carry.js";
import { admitReferents, emptyReferents } from "../../../fold-chat-mind.js";
import { emptySummary } from "../../../vendor/the-fold/fold.js";
import { SELF_LINE } from "../../../fold-chat-self.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..", "..");
const T = JSON.parse(fs.readFileSync(path.join(ROOT, "eval/voice/threads.json"), "utf8")).threads;
const out = (...a) => console.log(...a);

out("== the chat's real composed prompt for a real thread (L1 turn 3: 'Why was it built?'), via the page's own garyDoor.composeTurn + applyCarry");
const msgs = T.L1.messages;
let rec = emptyReferents(), sess = { messages: msgs.slice(0, 4), referents: null, summary: emptySummary() };
for (let i = 0; i < 4; i += 2) rec = admitReferents(rec, { question: msgs[i].content, answer: msgs[i + 1].content, sources: [] });
sess.referents = rec;
sess.summary = applyCarry({ ...sess.summary, topic: "Eiffel Tower", records: [] }, sess);
const ask = msgs[4].content;
const fi = readFelt(msgs.slice(0, 4), { convo: "L1" });
const cues = cuesFor({ act: actOf(ask), felt: fi.felt, pathosCue: fi.cue, door });
const composed = door.composeTurn({ basePrompt: "You are the fold.", cues: cues.cues, summary: sess.summary, history: msgs.slice(0, 4).map((m) => ({ role: m.role, content: m.content })), question: ask, sourceBlock: null }, { model: "gemma2:2b", maxTokens: 1024, material: 1 });
for (const m of composed.messages) out(`--- ${m.role} ---\n${String(m.content).slice(0, 900)}`);
out("felt reading for that prompt:", JSON.stringify({ gap: fi.gap, felt: fi.felt, cue: fi.cue }));

out("\n== the Pivot's pathos on a real answer: what it returns and what it changes (R3 turn 3 answer, declared experiencer = the model)");
const ans = T.R3.messages[5].content;
const pr = pivotText({ draft: ans, ask: T.R3.messages[4].content, material: [{ ref: "W1", source: "x", text: ans }], requireGrounding: false, kind: "chat", experiencer: { who: "gemma2:2b", read: "chat-draft:test" } });
out("felt =", JSON.stringify(pr.felt));
out("spoken text differs from draft only in whitespace:", pr.text.replace(/\s+/g, " ") === ans.replace(/\s+/g, " "));

out("\n== other model-voiced prompts: counsel draft, continue, restate, provenance pointer");
out("counsel draft system:\n" + draftMessages({ question: "What is a good life?", giver: "Aristotle", work: "Nicomachean Ethics", material: [{ text: "Happiness is an activity of the soul in accordance with virtue." }] })[0].content);
out("continue (last message):\n" + JSON.stringify(continueMessages([{ role: "system", content: "S" }, { role: "user", content: "Q" }], "The tower was built for the 1889 World's Fair, and").slice(-1)));
out("restate:\n" + JSON.stringify(restateMessages("The tower is tall.", "Spanish")).slice(0, 400));
out("pointer:\n" + JSON.stringify(numberedMessages({ claim: "The tower is 330 m.", candidates: [{ n: 1, text: "It is 330 metres tall.", start: 0, end: 20, passageIndex: 0 }], passages: [{ text: "It is 330 metres tall.", ref: "W1" }] })).slice(0, 500));
out("SELF_LINE (app-authored, no model):", SELF_LINE.slice(0, 80) + "…");

out("\n== import graph (A4/A5/A6) from the source");
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const chat = src("fold-chat.js");
for (const m of ["voice", "counsel", "thinkers", "primary", "originwire", "carry", "pathos", "pivot", "provenance", "self", "agent"]) out(`fold-chat.js imports fold-chat-${m}.js :`, new RegExp(`from "\\./fold-chat-${m}\\.js"`).test(chat));
out("paradigmBlock/resolutionBlocks referenced in fold-chat*.js (non-test):", fs.readdirSync(ROOT).filter((f) => /^fold-chat.*\.js$/.test(f)).filter((f) => /paradigmBlock|resolutionBlocks/.test(src(f))).join(", ") || "none");
out("agent file imports of pathos/carry/voice:", /fold-chat-(pathos|carry|voice)/.test(src("fold-chat-agent.js")));
