import test from "node:test";
import assert from "node:assert/strict";
import { isSourceAsk } from "./fold-chat-sourceask.js";
import { planTurn } from "./fold-chat-flow.js";

const prior = [{ role: "user", content: "Who is the king of the UK?" }, { role: "assistant", content: "King Charles III is the king of the UK." }];

test("source-asks are recognised (the measured miss: 'find a primary source')", () => {
  for (const q of ["find a primary source", "Find me a primary source for that", "where did you get that?", "source?", "link?", "can you cite that", "how do you know", "what is the primary source for that", "got a better source?", "verify that on a government site", "is that on the official site", "who says that?"])
    assert.equal(isSourceAsk(q), true, q);
});
test("asks with a topic, entity or figure of their own are NOT source-asks", () => {
  for (const q of ["find a source of income", "find a primary source for the Treaty of Versailles", "who was the monarch before?", "when did he become king", "what is a primary source", "find 3 sources", "is the earth round", "how do I cite a book in APA", "tell me about primary sources in history class"])
    assert.equal(isSourceAsk(q), false, q);
});
test("with an earlier answer it is searched as the ask that answer answered; the words stay the person's", () => {
  const p = planTurn("find a primary source", prior);
  assert.equal(p.mode, "web"); assert.equal(p.kind, "source-ask");
  assert.equal(p.search, "Who is the king of the UK?");
  assert.equal(p.said, "find a primary source");
});
test("cold: nothing to follow → no search, no model", () => {
  const p = planTurn("find a primary source", []);
  assert.equal(p.mode, "cold-gap"); assert.equal(p.search, null); assert.equal(p.modelMay, false);
});
test("an unanswered ask is not a thread: the nudge path is untouched", () => {
  const p = planTurn("well?", [{ role: "user", content: "Who is the king of the UK?" }]);
  assert.equal(p.kind, "retry");
});
test("a standalone ask that merely mentions sources is still searched as asked", () => {
  const p = planTurn("what is a primary source", prior);
  assert.notEqual(p.kind, "source-ask");
});

import { sourceRecall, wantsNewSource } from "./fold-chat-sourceask.js";
const prov = (tier) => ({ schema: "Provenance@1", claim: "The capital of Australia is Canberra.", verified: 1, pointers: [{ host: tier === "primary" ? "nca.gov.au" : "mappr.co", tier }], parts: [] });
const withProv = (tier) => [{ role: "user", content: "what is the capital of Australia?" }, { role: "assistant", content: "The capital of Australia is Canberra.", provenance: prov(tier) }];

test("'where did you get that?' reads back the stored source line: no search", () => {
  const r = sourceRecall(withProv("index"), "where did you get that?");
  assert.ok(r); assert.equal(r.turn, 1); assert.equal(r.provenance.pointers[0].host, "mappr.co");
});
test("'find a primary source' after a NON-primary source line searches again; after a primary one it reads back", () => {
  assert.equal(sourceRecall(withProv("index"), "find a primary source"), null);
  assert.ok(sourceRecall(withProv("primary"), "find a primary source"));
  assert.equal(wantsNewSource("source?"), false);
});
test("no stored/verified source line → null (the ask is searched as the last answer's topic)", () => {
  assert.equal(sourceRecall([{ role: "user", content: "hi" }, { role: "assistant", content: "Hello." }], "source?"), null);
  assert.equal(sourceRecall([], "source?"), null);
});
test("a source-ask earlier in the thread is not the topic of a later one (the measured 'where did you get that?' → teacher guides)", () => {
  const msgs = [{ role: "user", content: "Who is the king of the UK?" }, { role: "assistant", content: "King Charles III." }, { role: "user", content: "find a primary source" }, { role: "assistant", content: "Here is one." }];
  const p = planTurn("where did you get that?", msgs);
  assert.equal(p.kind, "source-ask"); assert.equal(p.search, "Who is the king of the UK?");
});

test("a read-back turn is not the turn a source line came from: the recall points at the ORIGINAL answer", () => {
  const msgs = [...withProv("primary"), { role: "user", content: "source?" }, { role: "assistant", content: "", provenance: prov("primary"), watch: { appAnswered: true } }];
  const r = sourceRecall(msgs, "where did you get that?");
  assert.equal(r.turn, 1);
});

test("an 'origin' on a reference/aggregator host is not primary: 'find a primary source' searches again", () => {
  const p = { schema: "Provenance@1", claim: "The capital of Australia is Canberra.", verified: 1, pointers: [{ host: "mappr.co", tier: "origin" }], parts: [] };
  const msgs = [{ role: "user", content: "capital of Australia?" }, { role: "assistant", content: "The capital of Australia is Canberra.", provenance: p }];
  assert.equal(sourceRecall(msgs, "find a primary source"), null);
  assert.ok(sourceRecall(msgs, "where did you get that?"));
  msgs[1].provenance = { ...p, pointers: [{ host: "nca.gov.au", tier: "origin" }] };
  assert.ok(sourceRecall(msgs, "find a primary source"));
});
