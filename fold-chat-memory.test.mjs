// fold-chat-memory.test.mjs — the identity pipeline: learn only when stated,
// carry it, and refuse an ungrounded identity claim.
import test from "node:test";
import assert from "node:assert/strict";
import { extractStatedName, asksIdentity, systemContext, identityClaims, ungroundedIdentity, identityCorrection, NO_INVENT } from "./fold-chat-memory.js";

test("a stated name is learned; a question never yields one", () => {
  assert.equal(extractStatedName("my name is Michael"), "Michael");
  assert.equal(extractStatedName("I'm Anna"), "Anna");
  assert.equal(extractStatedName("call me mike"), "Mike");
  assert.equal(extractStatedName("my name is not important"), null);
  assert.equal(extractStatedName("what is my name?"), null);
  assert.equal(extractStatedName("hello"), null);
});

test("asksIdentity spots the identity question", () => {
  assert.equal(asksIdentity("what is my name?"), true);
  assert.equal(asksIdentity("do you know my name"), true);
  assert.equal(asksIdentity("what is the capital of France"), false);
});

test("systemContext carries the name or says it is unknown, plus the rule", () => {
  const known = systemContext({ readerName: "Michael" });
  assert.match(known, /is Michael/);
  assert.match(known, new RegExp(NO_INVENT.slice(0, 20)));
  const unknown = systemContext({});
  assert.match(unknown, /do not know the person's name/i);
});

test("the failure that started this: 'your name is Qwen' is ungrounded", () => {
  const reply = "Your name appears to be Qwen. How can I assist you today?";
  const bad = ungroundedIdentity(reply, {});
  assert.ok(bad, "the claim is caught");
  assert.equal(bad.name, "Qwen");
  assert.match(identityCorrection(bad, {}), /not grounded|withdraw/i);
});

test("a grounded name is not flagged", () => {
  assert.equal(ungroundedIdentity("Hi Michael, your name is Michael.", { readerName: "Michael" }), null);
  assert.equal(ungroundedIdentity("Your name is Michael.", { facts: { name: "Michael" } }), null);
  assert.equal(ungroundedIdentity("The capital is Paris.", {}), null);
});

test("identityClaims finds the claim forms", () => {
  assert.equal(identityClaims("your name is Ada").length, 1);
  assert.equal(identityClaims("I'll call you Ada").length, 1);
  assert.equal(identityClaims("no claim here").length, 0);
});