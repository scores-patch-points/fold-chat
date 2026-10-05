// fold-chat-topic.test.mjs — what a chat becomes about, and the icon most
// similar to it. The law under test: a name is drawn from the salient terms of
// the whole exchange (never just the opening words), and the icon is chosen by
// similarity over the whole lexicon (never a first-match keyword rule).

import test from "node:test";
import assert from "node:assert/strict";
import { titleOf, iconOf, topicOf, salientTerms, userTurns, provisionalTitle, TURNS_TO_NAME, FALLBACK_ICON, ICON_TERMS } from "./fold-chat-topic.js";
import { PHOSPHOR_NAMES } from "./fold-chat-icons.js";

const mk = (rows) => rows.map(([role, content]) => ({ role, content }));

const POLICE = mk([
  ["user", "I want to look into the police department audit"],
  ["assistant", "The audit covers the metropolitan police department records."],
  ["user", "who signed off on the police audit report"],
  ["assistant", "The audit report was signed by the department oversight board."],
  ["user", "what did the police department audit find about evidence"],
  ["assistant", "The audit found the police department mishandled evidence records."],
]);

const CLIMATE = mk([
  ["user", "tell me about climate change policy"],
  ["assistant", "Climate change policy addresses emissions."],
  ["user", "how does climate policy handle carbon emissions"],
  ["assistant", "Carbon emissions are central to climate policy."],
  ["user", "what about the new climate change report"],
]);

test("the icon lexicon only names real vendored Phosphor icons", () => {
  const known = new Set(PHOSPHOR_NAMES);
  for (const name of Object.keys(ICON_TERMS)) assert.ok(known.has(name), `no vendored icon: ${name}`);
  assert.ok(known.has(FALLBACK_ICON), "fallback icon must be vendored");
});

test("every lexicon entry is a non-empty list of terms", () => {
  for (const [name, terms] of Object.entries(ICON_TERMS)) {
    assert.ok(Array.isArray(terms) && terms.length, name);
    for (const t of terms) assert.equal(typeof t, "string", `${name}: ${t}`);
  }
});

test("the name is drawn from what the chat became about, not its opening", () => {
  const title = titleOf(POLICE);
  assert.doesNotMatch(title, /^I Want To Look/i, "must not just echo the first message");
  assert.match(title, /Police|Department|Audit/i);
  assert.ok(title.length <= 46);
});

test("a phrase survives into the name in the order the subject arrived", () => {
  const title = titleOf(CLIMATE);
  assert.match(title, /Climate/);
  assert.doesNotMatch(title, /^Tell Me/i);
});

test("the icon is chosen by similarity, and clear domains land on their mark", () => {
  assert.equal(iconOf(POLICE), "detective");
  assert.equal(iconOf(CLIMATE), "leaf");
  assert.equal(iconOf(mk([
    ["user", "help me fix this javascript function"],
    ["assistant", "Here is the code fix."],
    ["user", "the code still throws an error in the terminal"],
    ["assistant", "Run the terminal command to debug."],
  ])), "code");
  assert.equal(iconOf(mk([
    ["user", "what does the statute say about appeals"],
    ["assistant", "The statute governs court appeals."],
    ["user", "can a judge overturn the ruling"],
  ])), "scales");
  assert.equal(iconOf(mk([
    ["user", "my landlord is threatening eviction"],
    ["assistant", "Tenant rights protect against eviction."],
    ["user", "can the landlord raise the rent"],
  ])), "house");
});

test("an empty or contentless conversation falls back, never throws", () => {
  assert.equal(iconOf([]), FALLBACK_ICON);
  assert.equal(titleOf([]), "New chat");
  assert.equal(provisionalTitle([]), "New chat");
  assert.equal(iconOf(mk([["user", "???"]])), FALLBACK_ICON);
});

test("the choice is deterministic for the same conversation", () => {
  assert.deepEqual(topicOf(POLICE), topicOf(POLICE));
  assert.equal(iconOf(POLICE), iconOf(POLICE));
});

test("a provisional title is the opening, trimmed to the sidebar width", () => {
  const p = provisionalTitle(mk([["user", "x".repeat(80)]]));
  assert.ok(p.length <= 46);
  assert.match(p, /…$/);
});

test("userTurns counts only the person's turns, and naming waits for the fourth", () => {
  assert.equal(userTurns(POLICE), 3);
  assert.equal(TURNS_TO_NAME, 4);
  assert.equal(userTurns([]), 0);
});

test("salient terms rank the recurring subject above one-off words", () => {
  const terms = salientTerms(POLICE, 5).map((t) => t.term);
  assert.ok(terms.some((t) => /audit|police|department/.test(t)), terms.join(","));
});
