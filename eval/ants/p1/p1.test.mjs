// p1.test.mjs — node --test eval/ants/p1/p1.test.mjs : the graders, the D+ skills on tiny synthetic pages, the cue classes and the escalation gate. (mutation-checked: see mutate.mjs)
import test from "node:test";
import assert from "node:assert/strict";
import { compareVerdict, gradeStated, gradeSnippets, refuses } from "./lib.mjs";
import { answerDplus } from "./mech.mjs";
import { cueClass, escalate, PARAMS } from "./g.mjs";

const P = (title, text) => ({ ref: "Wikipedia — " + title, text });

test("compareVerdict reads direction, negation and order", () => {
  const c = { win: /Everest/, lose: /Eiffel/, kind: "size" };
  assert.equal(compareVerdict("Mount Everest is taller than the Eiffel Tower.", c), "right");
  assert.equal(compareVerdict("The Eiffel Tower is taller than Everest.", c), "wrong");
  assert.equal(compareVerdict("The Eiffel Tower is shorter than Mount Everest.", c), "right");
  assert.equal(compareVerdict("The Eiffel Tower is not taller than Mount Everest.", c), "right");
  assert.equal(compareVerdict("Everest", c), "right");
  assert.equal(compareVerdict("The Eiffel Tower.", c), "wrong");
});
test("gradeStated: unanswerable needs a gap or a refusal; an answer to an unanswerable is wrong", () => {
  const q = { answerable: false, opinion: false };
  assert.equal(gradeStated(q, "", { gap: true }).ok, true);
  assert.equal(gradeStated(q, "I cannot answer that from the passages.").ok, true);
  assert.equal(gradeStated(q, "Blue.").ok, false);
  assert.equal(refuses("The passage does not say."), true);
});
test("gradeStated: gold and forbid", () => {
  const q = { answerable: true, gold: [/1969/], forbid: [/1970/] };
  assert.equal(gradeStated(q, "In 1969.").ok, true);
  assert.equal(gradeStated(q, "In 1969, or maybe 1970.").ok, false);
  assert.equal(gradeStated(q, "", { gap: true }).ok, false);
});
test("gradeStated: exception option must be the one named and no other option negated", () => {
  const q = { answerable: true, opts: { gold: /Titan/, wrong: [/Io/, /Europa/] }, gold: [/Titan/] };
  assert.equal(gradeStated(q, "Titan is the odd one out; the page lists Io, Europa.").ok, true);
  assert.equal(gradeStated(q, "Io is not a moon of Jupiter.").ok, false);
});
test("gradeSnippets: evidence complete, and R5 needs entity and attribute in ONE snip", () => {
  const q = { answerable: true, needs: [["T", /1798/]], coref: { ent: /Napoleon/, attr: /1798/ } };
  assert.equal(gradeSnippets(q, ["He led an invasion of Egypt in 1798.", "Napoleon Bonaparte was emperor."]).ok, false);
  assert.equal(gradeSnippets(q, ["Napoleon led an invasion of Egypt in 1798."]).ok, true);
});
test("D+ lifespan, convert, sum, order, complement on synthetic pages", () => {
  const curie = P("Marie Curie", "Marie Curie (7 November 1867 – 4 July 1934) was a physicist. She won in 1903.");
  assert.match(answerDplus("How many years did Marie Curie live?", [curie]).text, /66 years/);
  const tower = P("Eiffel Tower", "The tower is 330 metres (1,083 ft) tall, and the tallest structure in Paris.");
  assert.match(answerDplus("How tall is the Eiffel Tower in kilometres?", [tower]).text, /0\.33/);
  const a = P("Canberra", "With an estimated population of 484,630 as of 2025, Canberra is large."), b = P("Iceland", "The country has roughly 395,000 residents.");
  assert.match(answerDplus("What is the combined population of Canberra and Iceland?", [a, b]).text, /879630/);
  const j = P("Jupiter", "The four largest moons — Io, Europa, Ganymede, and Callisto — orbit within the magnetosphere.");
  assert.match(answerDplus("Which of these is not a moon of Jupiter: Io, Europa, Titan, Callisto?", [j]).text, /^Titan/);
  assert.equal(answerDplus("What is photosynthesis?", [curie]).gap, true);
});
test("cue classes", () => {
  assert.equal(cueClass("Was Napoleon a better leader than Lincoln?"), "opinion");
  assert.equal(cueClass("Summarize this page in 3 sentences."), "summarise");
  assert.equal(cueClass("Which is taller, A or B?"), "compare");
  assert.equal(cueClass("How many years did Marie Curie live?"), "arithmetic");
  assert.equal(cueClass("Why is the sky blue?"), "causal");
  assert.equal(cueClass("Who wrote Don Quixote?"), "slot");
  assert.equal(cueClass("Should I buy gold as an investment?"), "opinion");
  assert.equal(cueClass("Is it morally right to climb Mount Everest?"), "opinion");
});
test("escalation gate: opinion is a typed gap; a passing composed answer is trusted; the snippet route is per cue; no mechanical answer escalates", () => {
  const P = { tauCov: 0.6, snipRoute: { slot: "C", definition: "S" } };
  assert.deepEqual(escalate({ cue: "opinion", C: { answered: true, cov: 1, shaped: true } }, P).route, "gap");
  assert.equal(escalate({ cue: "compare", D: { answered: true, check: true } }, P).route, "D");
  assert.equal(escalate({ cue: "compare", D: { answered: true, check: false } }, P).escalate, true);   // an answer that fails its check is not trusted
  assert.equal(escalate({ cue: "compare", D: { answered: false }, C: { answered: true, cov: 1, shaped: true } }, P).escalate, true);
  assert.equal(escalate({ cue: "slot", C: { answered: true, cov: 0.9, shaped: true } }, P).route, "C");
  assert.equal(escalate({ cue: "slot", C: { answered: true, cov: 0.3, shaped: true } }, P).escalate, true);
  assert.equal(escalate({ cue: "slot", C: { answered: true, cov: 0.9, shaped: false } }, P).escalate, true);
  assert.equal(escalate({ cue: "definition", S: { answered: true } }, P).route, "S");
  assert.equal(escalate({ cue: "definition", S: { answered: false } }, P).escalate, true);
  assert.equal(escalate({ cue: "causal", C: { answered: true, cov: 1, shaped: true } }, P).escalate, true);
});
