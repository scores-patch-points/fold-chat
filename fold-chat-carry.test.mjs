import test from "node:test";
import assert from "node:assert/strict";
import { indexOfReferents, transcriptOf, carryOf, applyCarry } from "./fold-chat-carry.js";
import { admitReferents, emptyReferents } from "./fold-chat-mind.js";

const turn = (rec, q, a, titles = []) => admitReferents(rec, { question: q, answer: a, sources: titles.map((t) => ({ title: t })) });
const msgs = (pairs) => pairs.flatMap(([q, a]) => [{ role: "user", content: q }, { role: "assistant", content: a }]);

test("the transcript is answered asks only: attachments and Continue are not exchanges", () => {
  const t = transcriptOf([{ role: "user", content: "x", attachment: true }, { role: "user", content: "Who is Ada Lovelace?" }, { role: "assistant", content: "Ada Lovelace wrote notes." }, { role: "user", content: "Continue." }, { role: "assistant", content: "More." }]);
  assert.equal(t.length, 1);
  assert.equal(t[0].turn, 1);
});

test("identity is the record's: a question and an old answer naming one being resolve to one id", () => {
  let rec = turn(emptyReferents(), "Who is Ada Lovelace?", "Ada Lovelace wrote notes on the Analytical Engine.", ["Ada Lovelace — Wikipedia"]);
  const ix = indexOfReferents(rec);
  assert.deepEqual([...ix.resolveIn("what did ada lovelace do")], ["ada lovelace"]);
  assert.equal(ix.represent("ada lovelace"), "Ada Lovelace");
});

test("the carry is computed, struck of addresses, and says where the conversation stands", () => {
  let rec = emptyReferents(); const pairs = [];
  for (const [q, a, t] of [["Who is Ada Lovelace?", "Ada Lovelace wrote notes on the Analytical Engine.", "Ada Lovelace — Wikipedia"], ["What did Ada Lovelace publish?", "Ada Lovelace published a translation with notes.", "Ada Lovelace — Wikipedia"]]) { rec = turn(rec, q, a, [t]); pairs.push([q, a]); }
  const c = carryOf({ referents: rec, messages: msgs(pairs), summary: { records: [] } });
  assert.match(c.text, /Where the conversation stands/);
  assert.match(c.text, /Ada Lovelace/);
  assert.ok(!/\[turn:/.test(c.text), "addresses are struck in the mouth-facing text");
  assert.ok(c.lines.some((l) => /\[turn:/.test(l)), "the record keeps them");
  assert.match(c.basis, /grounds segmented/);
});

test("a new subject turns the ground and the carry says it turned", () => {
  let rec = emptyReferents(); const pairs = [];
  for (const [q, a] of [["Who is Ada Lovelace?", "Ada Lovelace wrote notes."], ["Who is Alan Turing?", "Alan Turing studied computation."]]) { rec = turn(rec, q, a); pairs.push([q, a]); }
  const c = carryOf({ referents: rec, messages: msgs(pairs), summary: { records: [] } });
  assert.match(c.text, /turned there/);
});

test("it is omnilingual: a Han conversation yields a carry, not 'no entities'", () => {
  let rec = turn(emptyReferents(), "谁是李白?", "李白是唐代诗人。", ["李白 — 维基百科"]);
  const c = carryOf({ referents: rec, messages: msgs([["谁是李白?", "李白是唐代诗人。"]]), summary: { records: [] } });
  assert.ok(c.entities.some((e) => e.includes("李白")), JSON.stringify(c.entities));
  assert.match(c.text, /李白/);
});

test("nothing resolves → the summary is left exactly as it was (it can only add)", () => {
  const s = { topic: "t", flow: "1 turn(s)", entities: ["X"], records: [] };
  assert.deepEqual(applyCarry(s, { referents: emptyReferents(), messages: [] }), s);
});

test("applyCarry puts the atmosphere in Flow and the record's names in Entities, with its basis", () => {
  let rec = turn(emptyReferents(), "Who is Ada Lovelace?", "Ada Lovelace wrote notes.", ["Ada Lovelace — Wikipedia"]);
  const out = applyCarry({ topic: "t", flow: "1 turn(s)", entities: [], records: [] }, { referents: rec, messages: msgs([["Who is Ada Lovelace?", "Ada Lovelace wrote notes."]]) });
  assert.match(out.flow, /stood on Ada Lovelace/);
  assert.ok(!/\[turn:/.test(out.flow));
  assert.ok(out.entities.includes("Ada Lovelace"));
  assert.ok(out.carry.basis);
});
