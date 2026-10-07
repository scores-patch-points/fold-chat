// eval/ants/c5/salience-history.test.mjs — the proposed salientHistory (salience-fixed.js == wire.diff applied). node --test eval/ants/c5/salience-history.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { salientHistory } from "./salience-fixed.js";
const U = (c) => ({ role: "user", content: c }), A = (c) => ({ role: "assistant", content: c });

test("a topic change carries nothing", () => assert.deepEqual(salientHistory([U("a"), A("b")], { continues: false }), []));
test("the last two exchanges are carried whole, in order", () => {
  const h = [U("q1"), A("a1"), U("q2"), A("a2"), U("q3"), A("a3")];
  assert.deepEqual(salientHistory(h, { continues: true }).map((m) => m.content), ["q2", "a2", "q3", "a3"]);
});
test("chit-chat with no reply is not an exchange: the previous topic's reply is not dragged into the window (the C5 defect)", () => {
  const h = [U("How tall is the Eiffel Tower?"), A("330 m."), U("Thanks!"), U("What does photosynthesis release?"), A("Oxygen.")];
  const out = salientHistory(h, { continues: true }).map((m) => m.content);
  assert.deepEqual(out, ["How tall is the Eiffel Tower?", "330 m.", "What does photosynthesis release?", "Oxygen."].slice(0, 4));
  assert.ok(!out.includes("Thanks!"));
  // the old slice(-4) would have started on an orphan assistant message
  const h2 = [U("q0"), A("a0"), U("q1"), A("a1"), U("Thanks!"), U("q2"), A("a2")];
  const out2 = salientHistory(h2, { continues: true });
  assert.equal(out2[0].role, "user");
  assert.equal(out2.length % 2, 0);
});
test("a character cap drops the OLDEST exchange, never the newest", () => {
  const big = "x".repeat(800);
  const h = [U("q1"), A(big), U("q2"), A("short")];
  assert.deepEqual(salientHistory(h, { continues: true, maxChars: 500 }).map((m) => m.content), ["q2", "short"]);
  assert.equal(salientHistory([U("q"), A(big)], { continues: true, maxChars: 10 }).length, 2, "the newest exchange survives any cap");
});
test("an assistant reply with no ask before it is never carried", () => {
  assert.deepEqual(salientHistory([A("orphan"), A("reply")], { continues: true }), []);
  assert.deepEqual(salientHistory([A("orphan"), U("q"), A("a")], { continues: true }).map((m) => m.content), ["q", "a"]);
});

import { functionWordsOf } from "../../../fold-chat-snippets.js";
const FW = functionWordsOf("en");
test("with the closed class, the window stops at a topic change: the exchange before the switch is not carried", () => {
  const h = [U("How tall is the Eiffel Tower?"), A("The Eiffel Tower is 330 metres tall."), U("Thanks!"), U("What does photosynthesis release as a byproduct?"), A("Photosynthesis releases oxygen as a byproduct of water splitting.")];
  const out = salientHistory(h, { continues: true, fw: FW }).map((m) => m.content);
  assert.deepEqual(out, ["What does photosynthesis release as a byproduct?", "Photosynthesis releases oxygen as a byproduct of water splitting."]);
  assert.ok(!out.join(" ").toLowerCase().includes("eiffel"));
});
test("two exchanges on the SAME topic are both carried", () => {
  const h = [U("How tall is the Eiffel Tower?"), A("The Eiffel Tower is 330 metres tall."), U("Who designed it?"), A("The Eiffel Tower was designed by Gustave Eiffel's company.")];
  assert.equal(salientHistory(h, { continues: true, fw: FW }).length, 4);
});
test("without a closed class (no prior) the last n exchanges ride, as before", () => {
  const h = [U("How tall is the Eiffel Tower?"), A("330 m."), U("What does photosynthesis release?"), A("Oxygen.")];
  assert.equal(salientHistory(h, { continues: true, fw: null }).length, 4);
});
