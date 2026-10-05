// fold-chat-flow.test.mjs — Terry Gross: the conversation's flow (fold-chat-flow.js), built on fold-chat-thread.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { actOf, isMove, planTurn, cuesFor, withoutProhibitions, FLOW, FLOW_ENFORCEMENT, flowRules, SPEECH_ACT } from "./fold-chat-flow.js";
import { door } from "./fold-chat-gary.js";
import { turnPlan } from "./fold-chat-thread.js";
import { bannedHits } from "./vendor/khora/native/the-fold/earned-cast.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PRIOR = [{ role: "user", content: "show me a cookie recipe" }, { role: "assistant", content: "Here is a chocolate chip cookie recipe: brown butter, two sugars, one egg.", mode: "chat" }];

test("actOf: Terry's own reading of the turn's speech act", () => {
  assert.equal(actOf("are you sure?"), "escalation");
  assert.equal(actOf("prove it"), "escalation");
  assert.equal(actOf("so what does it all mean"), "frame-ask");
  assert.equal(actOf("how do these fit together"), "map-ask");
  assert.equal(actOf("I think the capital is Sydney"), "assertion");
  assert.equal(actOf("show me a cookie recipe"), "question");
  assert.equal(actOf("   "), null);
  for (const a of ["question", "assertion", "escalation", "frame-ask", "map-ask"]) assert.ok(SPEECH_ACT.includes(a));
});

test("isMove: a short push-back, frame-ask or map-ask that names nothing of its own", () => {
  for (const q of ["are you sure?", "prove it", "wait, what", "so what does it all mean", "how do these fit together"]) assert.ok(isMove(q), q);
});

test("FALSIFIER: an ask that names a topic of its own is NEVER a move, whatever cue word it carries", () => {
  for (const q of [
    "actually, what is the tallest mountain",      // Terry hears 'actually' as push-back; it is a new question
    "are you sure about the 1889 date",             // a figure is its own topic
    "are you sure Paris is bigger than Lyon",       // names entities
    "wait, how do I reverse a string in Python",    // long, names a topic
    "prove it again with a different example please yes",   // over the word limit
  ]) assert.ok(!isMove(q), q);
});

test("planTurn: a push-back with an earlier answer is a reply ABOUT it — no search, the model grounded in the thread", () => {
  for (const q of ["are you sure?", "prove it", "so what does it all mean", "how do these fit together"]) {
    const p = planTurn(q, PRIOR);
    assert.equal(p.mode, "thread", q);
    assert.equal(p.search, null, q + ": the web is not asked");
    assert.equal(p.modelMay, true);
    assert.equal(p.kind, "move");
    assert.match(p.thread.answer, /chocolate chip/);
  }
});

test("FALSIFIER: a cold push-back or cold 'what?' (nothing earlier to follow) writes nothing — no search, no model", () => {
  for (const q of ["are you sure?", "prove it", "how do these fit together", "what?", "why?"]) {
    const p = planTurn(q, []);
    assert.equal(p.mode, "cold-gap", q);
    assert.equal(p.search, null);
    assert.equal(p.modelMay, false);
  }
  // an earlier turn that wrote nothing (a gap or a failure) is nothing to follow either
  const gapOnly = [{ role: "user", content: "show me a cookie recipe" }, { role: "assistant", content: "", notices: [{ kind: "no-sources" }] }];
  assert.equal(planTurn("are you sure?", gapOnly).mode, "cold-gap");
});

test("planTurn builds ON turnPlan: everything else is turnPlan's own answer, plus the act", () => {
  for (const q of ["what?", "i want a chewier one", "show me a cookie recipe", "Who wrote Pride and Prejudice?"]) {
    const a = planTurn(q, PRIOR), b = turnPlan(q, PRIOR);
    assert.equal(a.mode, b.mode, q);
    assert.equal(a.kind, b.kind, q);
    assert.equal(a.search, b.search, q);
    assert.ok(a.act, "the act is always read");
  }
  assert.equal(planTurn("what?", PRIOR).mode, "thread");
  assert.equal(planTurn("i want a chewier one", PRIOR).mode, "web");
});

test("FALSIFIER (the false-positive side): no first ask of the eval's cases and none of its 221 snippet asks is turned into a move", () => {
  const cases = JSON.parse(fs.readFileSync(path.join(HERE, "eval/cases.json"), "utf8")).cases;
  const asks = JSON.parse(fs.readFileSync(path.join(HERE, "eval/snips/asks.json"), "utf8")).asks;
  const standalone = [...cases.map((c) => c.turns[0]), ...asks.map((a) => a.text)].filter(Boolean);
  assert.ok(standalone.length > 250);
  const moved = standalone.filter((q) => isMove(q));
  assert.deepEqual(moved, [], "a standalone ask must stay a search");
  for (const q of standalone.slice(0, 40)) assert.notEqual(planTurn(q, PRIOR).kind, "move", q);
});

test("omnilingual: a language Terry does not read is never made a move (a typed gap, not a guess); nothing throws", () => {
  for (const q of ["你确定吗？", "คุณแน่ใจไหม", "هل أنت متأكد؟", "¿estás seguro?", "уверен?"]) {
    assert.ok(!isMove(q), q);
    assert.notEqual(planTurn(q, PRIOR).kind, "move", q);
  }
  assert.equal(FLOW.moveMaxWords, 6);
});

// ── the facts a reply hears ────────────────────────────────────────────────────────────────────────────────────────────────

test("cuesFor: Terry's own fact for the act, covert and object-level, read by Gary and the covert ban", () => {
  for (const act of ["question", "assertion", "escalation", "frame-ask", "map-ask"]) {
    const { cues } = cuesFor({ act, door });
    assert.equal(cues.length, 1, act);
    assert.equal(cues[0].from, "terry-gross");
    assert.deepEqual(bannedHits(cues[0].text), [], "no persona name, apparatus noun or covert term");
    const read = door.hand([{ role: "system", content: cues[0].text }], { record: false });
    assert.ok(!read.findings.some((f) => ["no-apparatus", "information-not-prohibition", "no-json-ask"].includes(f.rule)), `${act}: Gary finds nothing in "${cues[0].text}"`);
  }
  assert.deepEqual(cuesFor({ act: null, door }).cues, []);
  assert.deepEqual(cuesFor({ act: "not-an-act", door }).cues, []);
});

test("cuesFor: a prohibition clause in Terry's text is CUT, never sent (Gary: a fact to reason from, never a ban)", () => {
  const raw = "the person pushed back; this is where the conversation tightens — hold the claim to its ground, do not smooth the disagreement away.";
  const read = door.hand([{ role: "system", content: raw }], { record: false });
  const clauses = read.findings.find((f) => f.rule === "information-not-prohibition").clauses;
  const cut = withoutProhibitions(raw, clauses);
  assert.doesNotMatch(cut, /do not/);
  assert.match(cut, /the person pushed back/);
  assert.match(cut, /hold the claim to its ground/);
  const { cues } = cuesFor({ act: "escalation", door });
  assert.doesNotMatch(cues[0].text, /\bdo not\b/);
});

test("cuesFor: Terry's fact that names the instrument (strict strain: 'the record is contested') is DROPPED, and the drop is disclosed", () => {
  const { cues, dropped } = cuesFor({ act: "escalation", felt: { strain: "strict" }, door });
  assert.deepEqual(cues, []);
  assert.deepEqual(dropped.map((d) => d.why), ["no-apparatus"]);
});

test("cuesFor: a flat exchange is Terry's own sentence; the pathos organ's sentence rides only for a register she does not speak", () => {
  const flat = cuesFor({ act: "question", felt: { flatline: true }, door });
  assert.match(flat.cues[0].text, /gone flat/);
  const extra = cuesFor({ act: "question", pathosCue: "This conversation keeps returning to the same unresolved disagreement.", door });
  assert.deepEqual(extra.cues.map((c) => c.from), ["terry-gross", "pathos"]);
});

// ── her rules, and where this app holds each ────────────────────────────────────────────────────────────────────────────────

test("FLOW_ENFORCEMENT: every flow rule Terry keeps is mapped to code in THIS app, or visibly unwired", async () => {
  assert.deepEqual(FLOW_ENFORCEMENT.map((r) => r.rule), flowRules(), "the table covers exactly Terry's rules, in her order");
  const unwired = [];
  for (const row of FLOW_ENFORCEMENT) {
    if (row.enforced === null) { unwired.push(row.rule); continue; }
    const mod = await import("./" + row.enforced.file);
    assert.equal(typeof mod[row.enforced.holds], "function", `${row.rule}: ${row.enforced.file} exports ${row.enforced.holds}`);
  }
  assert.ok(unwired.length > 0 && unwired.length < FLOW_ENFORCEMENT.length, "the unwired are listed, not hidden: " + unwired.join("; "));
});
