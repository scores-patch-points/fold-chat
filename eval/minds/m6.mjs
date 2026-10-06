// eval/minds/m6.mjs — M6 of eval/minds/PREREG.md: does refusing a carried referent fix a WRONG carry, and leave a RIGHT one alone?
//   node eval/minds/m6.mjs        (offline, no model, no network; the same pure planner the chat runs: fold-chat-thread.js followUp)
// Each case is a thread (admitted into the referent record the way the chat does) and a pronoun follow-up. `meant` is who/what the person meant.
// The person's refusal is simulated honestly: they refuse ONLY what was carried and is not what they meant. Verdicts: STANDS · FALSIFIED · UNMEASURED.
import { followUp } from "../../fold-chat-thread.js";
import { hintsFor } from "../../fold-chat-hints.js";
import { admitReferents, emptyReferents } from "../../fold-chat-mind.js";
import { addOp, correctionOp, emptyMinds, rejectedSurfaces } from "../../fold-chat-minds.js";

const EN = hintsFor("en");
// [first ask, answer, source titles, follow-up, meant]  — meant: a surface the person means, or null when they mean something the record does not hold
const CASES = [
  ["Who was Marie Curie?", "Marie Curie was a physicist. Her husband Pierre Curie shared the prize.", ["Marie Curie", "Pierre Curie"], "what happened to him?", "Pierre Curie"],
  ["Who was Ada Lovelace?", "Ada Lovelace worked with Charles Babbage on the Analytical Engine.", ["Ada Lovelace", "Charles Babbage"], "when did he die?", "Charles Babbage"],
  ["Who was Ada Lovelace?", "Ada Lovelace worked with Charles Babbage on the Analytical Engine.", ["Ada Lovelace", "Charles Babbage"], "when did she die?", "Ada Lovelace"],
  ["Who painted the Mona Lisa?", "Leonardo da Vinci painted it for Francesco del Giocondo.", ["Leonardo da Vinci", "Francesco del Giocondo"], "where was he born?", "Leonardo da Vinci"],
  ["Who founded Apple?", "Steve Jobs and Steve Wozniak founded Apple in 1976.", ["Steve Jobs", "Steve Wozniak"], "what did he build?", "Steve Wozniak"],
  ["Who wrote Hamlet?", "William Shakespeare wrote Hamlet, set in Elsinore.", ["William Shakespeare", "Hamlet"], "when was he born?", "William Shakespeare"],
  ["Who was Queen Victoria?", "Queen Victoria married Prince Albert in 1840.", ["Queen Victoria", "Prince Albert"], "how did he die?", "Prince Albert"],
  ["Who discovered penicillin?", "Alexander Fleming discovered penicillin; Howard Florey developed it.", ["Alexander Fleming", "Howard Florey"], "what did he win?", "Howard Florey"],
  ["Who was Rosa Parks?", "Rosa Parks refused to give up her seat in Montgomery.", ["Rosa Parks", "Montgomery Alabama"], "where did she grow up?", "Rosa Parks"],
  ["Who was Alan Turing?", "Alan Turing worked at Bletchley Park on the Enigma.", ["Alan Turing", "Bletchley Park"], "when was he born?", "Alan Turing"],
  ["Who was Grace Hopper?", "Grace Hopper wrote the first compiler at Harvard University.", ["Grace Hopper", "Harvard University"], "when did she retire?", "Grace Hopper"],
  ["Who was Nikola Tesla?", "Nikola Tesla worked for Thomas Edison before they fell out.", ["Nikola Tesla", "Thomas Edison"], "what did he invent?", "Thomas Edison"],
];

const rows = [];
for (const [q, a, titles, ask, meant] of CASES) {
  const rec = admitReferents(emptyReferents(), { question: q, answer: a, sources: titles.map((title) => ({ title })) }, { hints: EN });
  const base = followUp(ask, [{ role: "user", content: q }, { role: "assistant", content: a, authored: "sources" }], { referents: rec, hints: EN });
  const carried = base.kind === "carried" ? base.carried : [];
  const wrongBefore = carried.filter((c) => c !== meant);
  const rightBefore = carried.includes(meant);
  // the person refuses what was carried that they did not mean, once each, until nothing wrong is carried or no more can be refused
  let minds = emptyMinds(), after = base, guard = 0;
  while (guard++ < 4) {
    const bad = (after.kind === "carried" ? after.carried : []).filter((c) => c !== meant && !rejectedSurfaces(minds).includes(c));
    if (!bad.length) break;
    for (const b of bad) minds = addOp(minds, correctionOp("carry-rejected", b, 1));
    after = followUp(ask, [{ role: "user", content: q }, { role: "assistant", content: a, authored: "sources" }], { referents: rec, hints: EN, rejected: rejectedSurfaces(minds) });
  }
  const carriedAfter = after.kind === "carried" ? after.carried : [];
  rows.push({ ask, meant, carriedBefore: carried, carriedAfter, refusals: rejectedSurfaces(minds).length, wrongBefore: wrongBefore.length, rightBefore, wrongAfter: carriedAfter.filter((c) => c !== meant).length, rightAfter: carriedAfter.includes(meant) });
}
const sum = (f) => rows.reduce((n, r) => n + f(r), 0);
const needFix = rows.filter((r) => r.wrongBefore > 0), controls = rows.filter((r) => r.wrongBefore === 0 && r.rightBefore);
const fixed = needFix.filter((r) => r.wrongAfter === 0), recovered = needFix.filter((r) => r.rightAfter);
const ctlKept = controls.filter((r) => r.rightAfter && r.refusals === 0);
console.table(rows.map((r) => ({ ask: r.ask, meant: r.meant, before: r.carriedBefore.join("; ") || "—", after: r.carriedAfter.join("; ") || "—", refused: r.refusals })));
console.log(`cases ${rows.length} · wrong carry today ${needFix.length} · controls (already right, nothing to refuse) ${controls.length}`);
console.log(`wrong carries cleared by refusal: ${fixed.length}/${needFix.length} · the meant referent carried afterwards: ${recovered.length}/${needFix.length} · controls left alone: ${ctlKept.length}/${controls.length}`);
const verdict = !needFix.length ? "UNMEASURED (today's carry is never wrong on this set)" : fixed.length === needFix.length && ctlKept.length === controls.length ? "STANDS (wrong carries cleared, controls untouched)" : "FALSIFIED (a wrong carry survived refusal, or a control changed)";
console.log("M6 verdict:", verdict, ` · recovery of the meant referent is reported, not claimed: ${recovered.length}/${needFix.length}`);
process.exitCode = verdict.startsWith("FALSIFIED") ? 1 : 0;
