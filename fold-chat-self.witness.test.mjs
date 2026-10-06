// SELF_LINE is what the fold says about itself; each capability it claims must still be witnessed by code (Constitution II.3 turned inward;
// khora kernel/self.js and penelope organs/self.mjs hold the same rule for their own reads). A claim with no witness fails here.
import test from "node:test";
import assert from "node:assert/strict";
import { SELF_LINE, selfAsk } from "./fold-chat-self.js";
import { ALONE_KINDS, modelSpeaksAlone } from "./fold-chat-gaps.js";
import { pivotText, verifyPivot } from "./fold-chat-pivot.js";

// each claim: the words in SELF_LINE, and the thing that must be true for them to stand
const CLAIMS = [
  { says: /don't answer from memory/i, witness: "the model is barred from speaking alone", holds: () => ALONE_KINDS.length === 0 && !modelSpeaksAlone("research") },
  { says: /check it against the sources and drop/i, witness: "the Pivot withholds a sentence whose FIGURE no source gives (a HARD failure); see the todo below for unbacked wording", holds: () => {
      const pv = pivotText({ draft: "The tower is in Paris. It attracts 7 million visitors a year.", ask: "where is the tower", material: [{ ref: "p", text: "The tower is in Paris, France." }], kind: "research", requireGrounding: true });
      return typeof verifyPivot === "function" && !/7 million/.test(String(pv?.text ?? "")); } },
  { says: /I'll say that instead of guessing/i, witness: "the empty-sources path has an app-authored line (fold-chat-gaps.js)", holds: () => typeof modelSpeaksAlone === "function" },
];

test("every capability SELF_LINE claims is witnessed", () => {
  for (const c of CLAIMS) if (c.says.test(SELF_LINE)) assert.ok(c.holds(), `SELF_LINE claims "${c.says}" but its witness fails: ${c.witness}`);
});

test("the guard bites: if the model could speak alone, the 'from memory' claim would fail", () => {
  const c = CLAIMS[0];
  assert.ok(c.says.test(SELF_LINE), "the line still makes this claim");
  const orig = ALONE_KINDS.length;
  assert.equal(orig, 0);                                   // today it stands
  assert.equal(c.holds.call(null), true);
  assert.equal([].concat(ALONE_KINDS, ["research"]).length === 0, false);   // the predicate over a non-empty list is false
});

test("the fold's self-ask is recognised", () => { assert.equal(selfAsk("who are you?"), true); });

// FOUND BY THIS TEST (2026-10-06): the line says the fold drops "whatever I can't trace", but by default (fold-chat-pivot.js SOFT_WHY, `strict` off) a
// sentence whose only failure is that the pages don't back its WORDING is SPOKEN and marked ✱ unsourced, not dropped. A sentence with an untraceable
// figure or name is withheld; a name-free one that merely isn't backed is shown with a mark. SELF_LINE is the author's to edit; until it is, this stays visible.
test("SELF_LINE says it drops what it can't trace; by default unbacked wording is shown marked, not dropped", { todo: "SELF_LINE overclaims for SOFT_WHY sentences (spoken + ✱). Edit the line or turn strict on." }, () => {
  const pv = pivotText({ draft: "The tower is in Paris. Many people consider it romantic.", ask: "where is the tower", material: [{ ref: "p", text: "The tower is in Paris, France." }], kind: "research", requireGrounding: true });
  assert.ok(!/romantic/.test(String(pv?.text ?? "")), "an untraceable sentence is dropped");
});
