// The title gate's stem rule: "king" shares a stem with "Kingdom" (fold-chat-web.js sharesStem / titleGate). Pure.
import test from "node:test";
import assert from "node:assert/strict";
import { sharesStem, titleGate } from "./fold-chat-web.js";

const r = (title) => ({ title, url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(title) });

test("THE BUG: 'king of the UK' no longer demotes Monarchy of the United Kingdom as 'no-shared-word'", () => {
  const pool = [r("Monarchy of the United Kingdom"), r("The Kid Who Would Be King"), r("Succession to the British throne"), r("Paul King (VJ)")];
  const { off } = titleGate(pool, "Who is the king of the UK?");
  assert.ok(!off.some((o) => /Monarchy of the United Kingdom/.test(o.title)), JSON.stringify(off));
});

test("sharesStem: equal 5-char stems and 4+-char prefixes share; short or unrelated stems do not", () => {
  assert.ok(sharesStem("kingdom", new Set(["king"])));
  assert.ok(sharesStem("king", new Set(["kingd"])));
  assert.ok(sharesStem("monarchy", new Set(["monar"])));
  assert.ok(!sharesStem("the", new Set(["thero"])), "a 3-char stem is never a prefix match");
  assert.ok(!sharesStem("united", new Set(["king"])));
  assert.ok(!sharesStem("lion", new Set(["king"])));
});

test("FALSIFIER: the gate still demotes a page that shares NOTHING with the ask (the Nashville guard is not loosened)", () => {
  const pool = [r("Nashville, Tennessee"), r("Nashville SC"), r("Opryland Hotel")];
  const { off, pool: out } = titleGate(pool, "Who founded the city of Nashville, and when?");
  assert.ok(off.some((o) => /Opryland/.test(o.title)), "an unrelated title is still demoted: " + JSON.stringify(off));
  assert.equal(out[0].title, "Nashville, Tennessee");
});

test("FALSIFIER: a caseless-script ask is untouched (no stems of length >= 4 to prefix-match)", () => {
  const pool = [r("东京"), r("大阪")];
  assert.doesNotThrow(() => titleGate(pool, "东京有多少人口？"));
});
