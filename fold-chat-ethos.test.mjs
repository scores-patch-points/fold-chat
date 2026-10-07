// fold-chat-ethos.test.mjs — the shared ethos block (fold-chat-ethos.js). Pre-registered gates: eval/ants/C7-PREREG.md N1–N10.
// ETHOS_MODULE=<path> runs the same tests against a MUTANT (eval/ants/c7/mutate.mjs: delete a gate, a test must fail).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { admitReferents, emptyReferents } from "./fold-chat-mind.js";
import { buildIndex } from "./fold-chat-voice.js";
import { functionWordsOf } from "./fold-chat-snippets.js";

const M = await import(process.env.ETHOS_MODULE || "./fold-chat-ethos.js");
const { ethosFor, laneOf, vetFact, runRecord, quoteIsVerbatim, ETHOS } = M;

const A = (content, model = "gemma2:2b", extra = {}) => ({ role: "assistant", content, mode: "chat", grounding: { model }, ...extra });
const U = (content) => ({ role: "user", content });
// three flat answers (pathos: stale) — the same fixture fold-chat-pathos.test.mjs uses
const FLAT = [A("The cookie is good. The cake is good. The pie is good."), A("The soup is hot. The stew is hot. The tea is hot."), A("The bread is warm. The roll is warm. The bun is warm.")];
const ALIVE = [
  A("Brown the butter first, then let it cool. It matters."),
  A("Two sugars give the chew you want, and the extra yolk makes it dense, soft, a little fudgy at the middle. Try it."),
  A("Chill the dough overnight. Bake until the edges set but the centre still looks underdone, then leave the tray alone for ten minutes. Done."),
];
const thread = (answers) => answers.flatMap((a, i) => [U(`ask number ${i + 1} about cookies`), a]);
const chat = (answers, extra = {}) => { const ms = thread(answers); return ethosFor({ lane: "chat", kind: "research", session: { messages: ms, referents: emptyReferents(), summary: { records: [] } }, messagesBefore: ms, question: "and then?", convo: "t", ...extra }); };

// a synthetic roster: 12 archons with disjoint, unusual vocabulary, so resonance is decided by what the conversation says
const words = (tag, n) => Array.from({ length: n }, (_, i) => `${tag}${["quartz", "mellow", "tundra", "vertex", "lumen", "basalt", "cinder", "onyx"][i % 8]}${i}`);
const TAGS = ["alp", "bet", "gam", "del", "eps", "zet", "eta", "the", "iot", "kap", "lam", "mus"];
const ROSTER = TAGS.map((t) => ({ handle: t + "-h", giver: `Holder ${t.toUpperCase()}`, work: `Work of ${t}`, source: { path: `canon/${t}.txt`, sha256: "00".repeat(32), chars: 9999 }, terms: words(t, 40) }));
const FW = functionWordsOf("en");
const INDEX = buildIndex(ROSTER, FW);
// the canon of archon 3 (gam): one quotable sentence carrying distinctive terms
const GAM_TERMS = words("gam", 40);
const QUOTE = `The ${GAM_TERMS[0]} and the ${GAM_TERMS[1]} are held by the ${GAM_TERMS[2]} together with the ${GAM_TERMS[3]} of the ${GAM_TERMS[4]}.`;
const CANON = "A short preface that is not a quote at all.   " + QUOTE + "   And an afterword.";
const START = CANON.indexOf(QUOTE), END = START + QUOTE.length;
const stemsOfQuote = [...new Set(GAM_TERMS.slice(0, 5).map((w) => w.toLowerCase()))];
const BANK = { "gam-h": [{ text: QUOTE, start: START, end: END, stems: stemsOfQuote.map((s) => s.slice(0, 20)) }] };
const TEXTS = { "gam-h": CANON };
const talk = (terms) => `${terms.join(" ")}`;
// a conversation that is about archon 3's vocabulary, with flat answers so the real pathos condition is `stale`
const gamAsk = (i) => U(`What do you make of ${GAM_TERMS.slice(0, 5).join(", ")}? (${i})`);
const gamMsgs = () => [gamAsk(1), A("The cookie is good. The cake is good. The pie is good."), gamAsk(2), A("The soup is hot. The stew is hot. The tea is hot."), gamAsk(3), A("The bread is warm. The roll is warm. The bun is warm.")];

// ───────────────────────────────────────── lanes (N8) ─────────────────────────────────────────
test("laneOf: a turn the model may not voice is lane none, whatever its kind (N8)", () => {
  assert.equal(laneOf({ kind: "research" }), "chat");
  assert.equal(laneOf({ kind: "chat" }), "chat");
  assert.equal(laneOf({ kind: "advice" }), "chat");
  assert.equal(laneOf({ kind: "code", threadTurn: true }), "chat");
  assert.equal(laneOf({ kind: "generate" }), "writing");
  assert.equal(laneOf({ kind: "compose" }), "writing");
  assert.equal(laneOf({ agent: true }), "agent");
  for (const kind of ["compute", "transform", "code", "smalltalk", "self"]) assert.equal(laneOf({ kind }), "none", kind);
  assert.equal(laneOf({ kind: "research", modelBarred: true }), "none", "the model is barred on this turn");
  assert.equal(laneOf({ kind: "research", slot: true }), "none", "a slot turn has no model text");
  assert.equal(laneOf({ kind: "research", strand: true }), "none", "a Sources-only turn is the sources' own words");
  assert.equal(laneOf({ kind: "research", modelBarred: true, agent: true }), "none");
});

test("lane none (and an unknown lane) gets nothing: no cues, no aside, no pathos, a typed reason (N8, N4)", () => {
  for (const lane of ["none", "no-such-lane", undefined]) {
    const r = ethosFor({ lane, session: { messages: thread(FLAT), referents: emptyReferents() }, messagesBefore: thread(FLAT), voice: { index: INDEX, bank: BANK, texts: TEXTS } });
    assert.deepEqual(r.cues, []);
    assert.equal(r.aside, null);
    assert.equal(r.parts.pathos, null);
    assert.equal(r.lane, "none");
    assert.equal(r.gaps.length, 1);
    assert.deepEqual(r.gaps[0], { part: "all", why: "lane:none" });
    assert.equal(r.parts.atmosphere, null);
  }
});

// ───────────────────────────────────────── facts, not directives (N5) · no score (N3) · no impersonation (N1) ─────────────────────────────────────────
test("vetFact: information passes; a directive, a prohibition, apparatus vocabulary, a score, speech-as-someone and a holder's name do not (N1, N3, N5)", () => {
  assert.equal(vetFact("The recent answers in this conversation have been flat — the same rhythm every time.").ok, true);
  assert.equal(vetFact("For 2 exchanges the conversation has stood on The Eiffel Tower and Maurice Koechlin.").ok, true);
  assert.equal(vetFact("Do not repeat yourself.").why, "directive");
  assert.equal(vetFact("Always answer in one line.").why, "directive");
  assert.equal(vetFact("Write more slowly.").why, "directive");
  assert.match(vetFact("The pathos of this conversation is low.").why, /apparatus/);
  assert.match(vetFact("Read the passage and the prompt.").why, /apparatus/);
  assert.equal(vetFact("This answer is rated 7/10 for tone.").why, "score");
  assert.equal(vetFact("Confidence is high that they are upset.").why, "score");
  assert.equal(vetFact("The mood is 80% flat.").why, "score");
  assert.equal(vetFact("Speaking as Laozi, the way is empty.").why, "speaks_as");
  assert.equal(vetFact("Holder GAM wrote about the quartz.", { names: ["Holder GAM"] }).why, "names_a_holder:Holder GAM");
  assert.equal(vetFact("").why, "empty");
});

test("every cue sentence the pathos organ can produce passes vetFact (so the shared block never withholds the organ's own words)", async () => {
  const { pathosCueFor } = await import("./vendor/khora/native/the-fold/pathos-turn.js");
  for (const kind of ["stale", "contested", "collapse"]) assert.equal(vetFact(pathosCueFor({ kind })).ok, true, kind);
});

// ───────────────────────────────────────── chat lane: pathos reaches the model as a fact ─────────────────────────────────────────
test("chat lane: three flat answers → the pathos condition is `stale`; the cue rides ONLY if Terry does not already speak it (cuePathos true, but readFelt drops the stale cue)", () => {
  const r = chat(FLAT);
  assert.equal(r.lane, "chat");
  assert.equal(r.parts.pathos.condition, "stale");
  assert.equal(r.parts.pathos.felt.flatline, true);
  // fold-chat-pathos.js: Terry already speaks a flat exchange in her own words, so the organ's sentence is withheld for `stale`
  assert.equal(r.parts.pathos.cue, null);
  assert.deepEqual(r.cues, []);
  assert.ok(r.memo && Array.isArray(r.memo.log) && r.memo.log.length === 1, "the re-ground is a recorded act on the ledger");
});

test("chat lane: a lively exchange holds its ground; nothing is said (N4)", () => {
  const r = chat(ALIVE);
  assert.equal(r.parts.pathos.condition, "ground_holds");
  assert.deepEqual(r.cues, []);
  assert.equal(r.aside, null);
});

test("chat lane: the four pathos inputs are listed with what is READ and what is a typed GAP (N10)", () => {
  const r = chat(FLAT);
  const i = r.parts.pathos.inputs;
  assert.equal(i.experiencer.status, "read");
  assert.equal(i.experiencer.who, "model:gemma2:2b");
  assert.equal(i.rhythm.status, "read");
  assert.match(i.strain.status, /^read:report/);
  assert.match(i.curve.status, /^gap: unmeasured/);
  assert.ok(r.gaps.some((g) => g.part === "pathos.curve" && /unmeasured/.test(g.why)), "the curve gap is said");
  assert.ok(r.gaps.some((g) => g.part === "paradigm"), "the Paradigm gap is said");
  assert.deepEqual(r.parts.paradigm, { gap: "no_ledger_notes" });
});

test("chat lane: too few answers is a typed gap, never a guessed reading (N10); the person's own words are never read as the fold's (N6)", () => {
  const r = chat(FLAT.slice(0, 2));
  assert.equal(r.parts.pathos.gap, "too_few_answers");
  assert.deepEqual(r.cues, []);
  const onlyPerson = ethosFor({ lane: "chat", kind: "research", session: { messages: [U("hi"), U("hello again"), U("anyone there?")], referents: emptyReferents() }, messagesBefore: [U("hi"), U("hello again"), U("anyone there?")] });
  assert.equal(onlyPerson.parts.pathos.gap, "no_model_authored_answers");
  assert.equal(onlyPerson.parts.pathos.inputs, null);
});

test("chat lane: the experiencer is read from the turn's own record — a label on the message changes nothing (N6)", () => {
  const labelled = FLAT.map((m, i) => ({ ...m, who: "Alex", holder: "Alex", experiencer: { who: "Taylor", read: "x" } }));
  assert.deepEqual(chat(labelled).parts.pathos.inputs.experiencer, chat(FLAT).parts.pathos.inputs.experiencer);
  assert.doesNotMatch(JSON.stringify(chat(labelled).parts.pathos.inputs), /Alex|Taylor/);
});

// ───────────────────────────────────────── Atmosphere + Lens on the lanes that carry no summary ─────────────────────────────────────────
function withReferents(msgs) {
  let rec = emptyReferents();
  for (let i = 0; i + 1 < msgs.length; i += 2) rec = admitReferents(rec, { question: msgs[i].content, answer: msgs[i + 1].content, sources: [] });
  return rec;
}
const EIFFEL = [U("How tall is the Eiffel Tower?"), A("The Eiffel Tower is 330 meters (1,083 ft) tall."), U("Who designed it?"), A("The Eiffel Tower was designed by the engineers Maurice Koechlin and Émile Nouguier, along with architect Stephen Sauvestre. Eiffel led and built it.")];

test("writing lane: the Atmosphere rides as ONE fact (the lane has no running summary); pathos does not ride on a writing request (cuePathos false)", () => {
  const r = ethosFor({ lane: "writing", kind: "generate", session: { messages: EIFFEL, referents: withReferents(EIFFEL), summary: { records: [] } }, messagesBefore: EIFFEL, question: "write a paragraph about its builders" });
  assert.equal(r.lane, "writing");
  assert.equal(r.cues.length, 1);
  assert.equal(r.cues[0].from, "atmosphere");
  assert.match(r.cues[0].text, /Eiffel Tower/);
  assert.equal(r.parts.pathos, null);
  assert.equal(vetFact(r.cues[0].text).ok, true);
  assert.doesNotMatch(r.cues[0].text, /\[turn:\d+\]/, "no address reaches a model-facing line");
  assert.doesNotMatch(r.basis, /\[object Object\]/, "carryOf's basis printed the Lens's object; the shared block strikes it");
});

test("chat lane: Atmosphere is NOT re-sent as a cue (it already rides in summary.flow via applyCarry) — but it is reported in parts", () => {
  const r = ethosFor({ lane: "chat", kind: "research", session: { messages: EIFFEL, referents: withReferents(EIFFEL), summary: { records: [] } }, messagesBefore: EIFFEL, question: "why was it built?" });
  assert.equal(r.cues.some((c) => c.from === "atmosphere"), false);
  assert.match(r.parts.atmosphere.text, /Where the conversation stands/);
  assert.ok(r.parts.atmosphere.active.length > 0);
});

test("no referent yet → Atmosphere is a typed gap, never filler (N4/N10)", () => {
  const r = ethosFor({ lane: "writing", kind: "generate", session: { messages: thread(ALIVE), referents: emptyReferents(), summary: { records: [] } }, messagesBefore: [], question: "write about cookies" });
  assert.deepEqual(r.cues, []);
  assert.equal(r.parts.atmosphere, null);
  assert.ok(r.gaps.some((g) => g.part === "atmosphere"));
});

// ───────────────────────────────────────── counsel lane ─────────────────────────────────────────
test("counsel lane: Atmosphere as a fact; the lane carries no aside (the draft is already the voice) (lane table)", () => {
  const r = ethosFor({ lane: "counsel", kind: "research", session: { messages: EIFFEL, referents: withReferents(EIFFEL), summary: { records: [] } }, messagesBefore: EIFFEL, question: "what would Eiffel say?", voice: { index: INDEX, bank: BANK, texts: TEXTS } });
  assert.equal(r.cues[0]?.from, "atmosphere");
  assert.equal(r.aside, null);
  assert.ok(r.gaps.some((g) => g.part === "voice" && /lane:counsel/.test(g.why)));
});

// ───────────────────────────────────────── the code lane (N9) ─────────────────────────────────────────
const F_LOAD = "loads: threw ReferenceError x (line 12)", F_BLANK = "renders: the page is blank", F_PAGE = "The ask is for a page, but the answer was a bare script.";
const rd = (n, findings, maker = "qwen2.5-coder:1.5b") => ({ n, findings, maker });

test("runRecord: a finding that was fixed and came back is a directed cycle ON THE RECORD (strain strict); a finding that repeats is counted; both measured, neither inferred from prose", () => {
  const flip = runRecord([rd(1, [F_LOAD]), rd(2, [F_BLANK]), rd(3, [F_LOAD])]);
  assert.equal(flip.cycles, 1);
  assert.equal(flip.gap, null);
  assert.equal(flip.who, "maker:qwen2.5-coder:1.5b");
  const same = runRecord([rd(1, [F_PAGE, F_BLANK]), rd(2, [F_PAGE, F_BLANK]), rd(3, [F_PAGE, F_BLANK])]);
  assert.equal(same.cycles, 0);
  assert.equal(same.repeats, 2);
  const line = runRecord([rd(1, ["loads: threw TypeError at (line 3)"]), rd(2, ["loads: threw TypeError at (line 9)"])]);
  assert.equal(line.repeats, 1, "a line number does not make a different failure (the loop's own signature)");
});

test("runRecord: too few rounds and an unverified maker are typed gaps, not readings (N6, N10)", () => {
  assert.equal(runRecord([rd(1, [F_LOAD])]).gap, "too_few_rounds");
  assert.equal(runRecord([]).gap, "too_few_rounds");
  assert.equal(runRecord([{ n: 1, findings: [F_LOAD] }, { n: 2, findings: [F_BLANK] }]).gap, "unverified_maker");
  assert.equal(runRecord(null).gap, "too_few_rounds");
});

test("agent lane: repairs undoing each other read as `contested` over the same four inputs — and the code model gets NO cue (N9)", () => {
  const rounds = [rd(1, [F_LOAD]), rd(2, [F_BLANK]), rd(3, [F_LOAD])];
  const r = ethosFor({ lane: "agent", rounds, task: "Build a tip calculator page", names: ["tip calculator"], convo: "run1" });
  assert.equal(r.lane, "agent");
  assert.equal(r.parts.pathos.condition, "contested");
  assert.equal(r.parts.pathos.felt.strain, "strict");
  assert.equal(r.parts.pathos.inputs.experiencer.who, "maker:qwen2.5-coder:1.5b");
  assert.equal(r.parts.pathos.run.cycles, 1);
  assert.deepEqual(r.cues, [], "N9: the loop's condition steers the loop; the code model's prompt is not touched");
  assert.equal(r.memo.log.length, 1, "the concession is recorded");
});

test("agent lane: the same failure three times is NOT `stale` by rhythm (measured) — the run's own `repeats` count is the stuck signal, reported beside, never relabelled", () => {
  const rounds = [1, 2, 3].map((n) => rd(n, [F_PAGE, F_BLANK]));
  const r = ethosFor({ lane: "agent", rounds, task: "Build a page", convo: "run2" });
  assert.equal(r.parts.pathos.condition, "ground_holds");
  assert.equal(r.parts.pathos.run.repeats, 2);
  assert.deepEqual(r.cues, []);
});

test("agent lane: one round, or no verified maker, reads nothing (typed gap)", () => {
  assert.equal(ethosFor({ lane: "agent", rounds: [rd(1, [F_LOAD])], task: "x" }).parts.pathos.gap, "too_few_rounds");
  assert.equal(ethosFor({ lane: "agent", rounds: [{ n: 1, findings: [F_LOAD] }, { n: 2, findings: [F_BLANK] }], task: "x" }).parts.pathos.gap, "unverified_maker");
});

// ───────────────────────────────────────── the aside: re-verified, rare, never impersonating (N1 N2 N3 N4) ─────────────────────────────────────────
const asideInput = ({ voice: vo = {}, ...rest } = {}) => {
  const ms = gamMsgs();
  return { lane: "chat", kind: "research", session: { messages: ms, referents: emptyReferents(), summary: { records: [] } }, messagesBefore: ms, question: `And what of ${GAM_TERMS.slice(0, 5).join(" and ")}?`, convo: "g", ...rest, voice: { index: INDEX, bank: BANK, texts: TEXTS, exchangeIndex: 4, sinceLast: Infinity, used: [], seed: 7, draws: 200, ...vo } };
};

test("the aside: when the conversation resonates beyond the null AND the pathos gate is open, ONE verbatim quote in the fixed frame, with its audit (N1)", () => {
  const r = ethosFor(asideInput());
  assert.ok(r.aside, JSON.stringify(r.gaps));
  assert.equal(r.aside.audit.handle, "gam-h");
  assert.equal(r.aside.audit.condition, "stale");
  assert.ok(r.aside.text.startsWith("This reminds me of something Holder GAM wrote about "));
  assert.ok(r.aside.text.includes(`“${QUOTE}”`) || r.aside.text.includes(QUOTE));
  assert.equal(CANON.slice(r.aside.audit.quote.start, r.aside.audit.quote.end), r.aside.audit.quote.text, "the quote is the canon's own slice, at the audited span");
  assert.doesNotMatch(r.aside.text.split(QUOTE).join(""), /\bas Holder|speaking as|in the voice of|\bI am\b/);
  assert.deepEqual(r.cues, [], "the aside is the app's to speak; it is never put in a prompt");
});

test("N3 no score: the audit may carry p and score; the spoken aside and every cue do not", () => {
  const r = ethosFor(asideInput());
  assert.ok(r.aside);
  assert.equal(typeof r.aside.audit.p, "number");
  const frame = r.aside.text.split(QUOTE).join("");
  assert.doesNotMatch(frame, /score|rating|confidence|p\s*[=<]|\d\s*%|\d+\s*\/\s*\d+/i);
  for (const c of r.cues) assert.doesNotMatch(c.text, /score|rating|confidence|\d\s*%/i);
});

test("N2 never invent a quote: a bank whose entry is not at its span of the canon, or a canon that lacks the sentence, yields NO aside — never a repaired one", () => {
  const moved = { "gam-h": [{ text: QUOTE, start: START + 3, end: END + 3, stems: BANK["gam-h"][0].stems }] };
  const r1 = ethosFor(asideInput({ voice: { texts: TEXTS, bank: moved } }));
  assert.equal(r1.aside, null);
  assert.ok(r1.gaps.some((g) => g.part === "voice" && /quote_not_verbatim|no_quotable/.test(g.why)), JSON.stringify(r1.gaps));
  const lied = { "gam-h": "A canon that never says it. " + "x".repeat(200) };
  const r2 = ethosFor(asideInput({ voice: { texts: lied, bank: null } }));
  assert.equal(r2.aside, null);
  // the module's own checker
  assert.equal(quoteIsVerbatim({ handle: "gam-h", quote: { text: QUOTE, start: START, end: END } }, { texts: TEXTS }), true);
  assert.equal(quoteIsVerbatim({ handle: "gam-h", quote: { text: QUOTE + "!", start: START, end: END } }, { texts: TEXTS }), false);
  assert.equal(quoteIsVerbatim({ handle: "gam-h", quote: { text: QUOTE, start: START, end: END } }, { bank: BANK }), true);
  assert.equal(quoteIsVerbatim({ handle: "gam-h", quote: { text: QUOTE, start: START, end: END + 1 } }, { bank: BANK }), false);
  assert.equal(quoteIsVerbatim({ handle: "gam-h", quote: { text: "", start: 0, end: 0 } }, { texts: TEXTS }), false);
  assert.equal(quoteIsVerbatim({ handle: "nobody", quote: { text: QUOTE, start: START, end: END } }, { texts: TEXTS, bank: BANK }), false);
});

test("N4 silence is the default: no voice index, a lookup kind, the first exchange, too soon, a repeat archon, an unread or holding pathos gate → no aside, with the reason", () => {
  const why = (r) => r.gaps.find((g) => g.part === "voice")?.why;
  assert.equal(why(ethosFor({ ...asideInput(), voice: null })), "no_voice_index");
  for (const kind of ["compute", "code", "transform", "smalltalk", "self"]) assert.equal(ethosFor({ ...asideInput(), kind }).aside, null, kind);
  assert.equal(ethosFor(asideInput({ voice: { exchangeIndex: 1 } })).aside, null);
  assert.equal(ethosFor(asideInput({ voice: { sinceLast: 1 } })).aside, null);
  assert.equal(ethosFor(asideInput({ voice: { used: ["gam-h"] } })).aside, null);
  // the gate: lively answers → ground_holds → closed
  const ms = [gamAsk(1), ALIVE[0], gamAsk(2), ALIVE[1], gamAsk(3), ALIVE[2]];
  const holding = ethosFor({ ...asideInput(), session: { messages: ms, referents: emptyReferents() }, messagesBefore: ms });
  assert.equal(holding.parts.pathos.condition, "ground_holds");
  assert.equal(holding.aside, null);
  assert.match(why(holding), /pathos:ground_holds/);
  // the gate: pathos unread (too few answers) → closed
  const young = gamMsgs().slice(0, 4);
  const unread = ethosFor({ ...asideInput(), session: { messages: young, referents: emptyReferents() }, messagesBefore: young });
  assert.equal(unread.aside, null);
  assert.match(why(unread), /pathos_unread/);
  // a roster the conversation does not touch is not resonance
  const off = [U("how do I bake bread"), A("The bread is warm. The roll is warm. The bun is warm."), U("and cake"), A("The soup is hot. The stew is hot. The tea is hot."), U("and pie"), A("The cookie is good. The cake is good. The pie is good.")];
  assert.equal(ethosFor({ ...asideInput(), session: { messages: off, referents: emptyReferents() }, messagesBefore: off, question: "and tart" }).aside, null);
});

test("N1/N3 the module never trusts the voice module's decision: a hostile asideOf that alters the frame, adds a score, or speaks as the holder is dropped", () => {
  const good = ethosFor(asideInput()).aside;
  assert.ok(good);
  const base = { handle: "gam-h", holder: "Holder GAM", work: "W", topic: "quartz", quote: { text: QUOTE, start: START, end: END }, source: { path: "p", sha256: "00", start: START, end: END }, shared: ["a", "b"], score: 3.2, p: 0.01, grade: "canon" };
  const hostile = (text) => ({ asideOf: () => ({ aside: { ...base, text } }) });
  const frame = `This reminds me of something Holder GAM wrote about quartz: “${QUOTE}” I'm not sure it fits, but it came to mind.`;
  assert.ok(ethosFor(asideInput({ voice: hostile(frame) })).aside, "the true frame passes");
  const altered = ethosFor(asideInput({ voice: hostile(frame + " It is the best passage.") }));
  assert.equal(altered.aside, null);
  assert.ok(altered.gaps.some((g) => g.part === "voice" && g.why === "frame_altered"));
  const scored = ethosFor(asideInput({ voice: { asideOf: () => ({ aside: { ...base, topic: "quartz (confidence 9/10)", text: `This reminds me of something Holder GAM wrote about quartz (confidence 9/10): “${QUOTE}” I'm not sure it fits, but it came to mind.` } }) } }));
  assert.equal(scored.aside, null);
  assert.ok(scored.gaps.some((g) => g.part === "voice" && g.why === "frame_unsafe"));
  const speaksAs = ethosFor(asideInput({ voice: { asideOf: () => ({ aside: { ...base, holder: "Holder GAM, speaking as Plato", text: `This reminds me of something Holder GAM, speaking as Plato wrote about quartz: “${QUOTE}” I'm not sure it fits, but it came to mind.` } }) } }));
  assert.equal(speaksAs.aside, null);
  const notThere = ethosFor(asideInput({ voice: { asideOf: () => ({ aside: { ...base, quote: { text: "An invented sentence of some length.", start: 0, end: 36 }, text: `This reminds me of something Holder GAM wrote about quartz: “An invented sentence of some length.” I'm not sure it fits, but it came to mind.` } }) } }));
  assert.equal(notThere.aside, null);
  assert.ok(notThere.gaps.some((g) => g.part === "voice" && g.why === "quote_not_verbatim"));
});

test("N5 every model-facing line is vetted: an Atmosphere that carries a directive-shaped word (a title like \"Never Let Me Go\") is withheld and the withholding is said — over-withholding is the safe side", () => {
  const ms = [U("Who wrote Never Let Me Go?"), A("Never Let Me Go was written by Kazuo Ishiguro."), U("When was Never Let Me Go published?"), A("Never Let Me Go was published in 2005.")];
  const r = ethosFor({ lane: "writing", kind: "generate", session: { messages: ms, referents: withReferents(ms), summary: { records: [] } }, messagesBefore: ms, question: "write a paragraph about it" });
  assert.deepEqual(r.cues, []);
  assert.ok(r.gaps.some((g) => g.part === "cue:atmosphere" && /^withheld:directive/.test(g.why)), JSON.stringify(r.gaps));
});

test("agent lane: an aside only at a natural break (the run just ended, or the loop is stale/contested), never while it works (N9)", () => {
  const rounds = [rd(1, [F_LOAD]), rd(2, [F_BLANK]), rd(3, [F_LOAD])];
  const task = `Build a page that shows ${GAM_TERMS.slice(0, 5).join(", ")}`;
  const mid = ethosFor({ lane: "agent", rounds, task, names: [], convo: "r", naturalBreak: false, voice: { index: INDEX, bank: BANK, texts: TEXTS, exchangeIndex: 4, seed: 7 } });
  assert.equal(mid.aside, null);
  assert.ok(mid.gaps.some((g) => g.part === "voice" && g.why === "not_a_natural_break"));
  assert.deepEqual(mid.cues, []);
});

// ───────────────────────────────────────── purity (N7) ─────────────────────────────────────────
test("N7 purity: the same input twice is deep-equal, the inputs are not mutated, and the source reaches for no clock, randomness, network, process or DOM", () => {
  const input = asideInput();
  const snap = JSON.stringify(input.session);
  const a = ethosFor(input), b = ethosFor(input);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(input.session), snap);
  const src = fs.readFileSync(new URL(process.env.ETHOS_MODULE || "./fold-chat-ethos.js", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
  for (const bad of [/\bDate\b/, /Math\.random/, /\bfetch\s*\(/, /\bprocess\./, /\bdocument\./, /\bwindow\./, /localStorage/, /readFileSync/, /\bsetTimeout\b/]) assert.doesNotMatch(src, bad, String(bad));
});

test("the lane table is frozen, names its reason for every lane, and the code lane's model-facing pathos is off (N9)", () => {
  assert.ok(Object.isFrozen(ETHOS.lanes));
  for (const [k, v] of Object.entries(ETHOS.lanes)) { assert.ok(v.why, k); assert.ok(Object.isFrozen(v), k); }
  assert.equal(ETHOS.lanes.agent.cuePathos, false);
  assert.equal(ETHOS.lanes.agent.cueAtmosphere, false);
  assert.equal(ETHOS.lanes.writing.cuePathos, false);
  assert.equal(ETHOS.lanes.none.aside, false);
});
