// fold-chat-fold.test.mjs — the vendored conversation fold: the recency window
// is a caller's budget, so a short exchange can be carried verbatim while a
// long one is still bounded.

import test from "node:test";
import assert from "node:assert/strict";
import { buildTurnMessages, RECENCY_WINDOW } from "./vendor/the-fold/fold.js";

test("buildTurnMessages: the default sends only the recent raw turns, never the whole transcript", () => {
  const history = Array.from({ length: 12 }, (_, i) => ({ role: "user", content: "m" + i }));
  const msgs = buildTurnMessages({ basePrompt: "sys", history, question: "q" });
  const raw = msgs.filter((m) => m.role !== "system");
  assert.equal(raw.length, RECENCY_WINDOW + 1);
  assert.equal(raw[0].content, "m" + (12 - RECENCY_WINDOW));
  assert.equal(raw[raw.length - 1].content, "q");
});

test("buildTurnMessages: a caller may widen the window so a short exchange rides verbatim", () => {
  const history = Array.from({ length: 6 }, (_, i) => ({ role: "user", content: "m" + i }));
  const msgs = buildTurnMessages({ basePrompt: "sys", history, question: "q", recencyWindow: 10 });
  const raw = msgs.filter((m) => m.role !== "system");
  assert.equal(raw.length, 7);
  assert.equal(raw[0].content, "m0");
  assert.equal(raw[raw.length - 1].content, "q");
});
