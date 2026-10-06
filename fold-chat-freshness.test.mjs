import test from "node:test";
import assert from "node:assert/strict";
import { freshnessOf } from "./fold-chat-freshness.js";

const S1 = "The bridge opened to traffic in 1932.";
const S2 = "It carried four lanes and a rail line.";
const page = `Intro text. ${S1} ${S2} Closing.`;
const addr = (ref, hay, s) => { const i = hay.indexOf(s); return `${ref}#${i}-${i + s.length}`; };

/** Claims in the FoldRecord@1 shape the chat stores (fold-chat-record.js claimsOfTurn): `basis.support` is the witnessing source address,
 *  `basis.cited` the source's own bytes there, `roles.ARG1` what the fold SAID. Built by hand so this test depends on nothing uncommitted. */
const claim = (turn, i, said, support, cited) => ({ id: `t${turn}c${i}`, rel: "said", roles: { ARG0: "fold", ARG1: said }, basis: { turn, kind: "sentence", ...(support ? { support } : {}), ...(cited !== undefined ? { cited } : {}) } });
const claims = (hay = page, ref = "bridge") => {
  const a1 = addr(ref, hay, S1), a2 = addr(ref, hay, S2);
  return [claim(1, 1, "The bridge opened in 1932.", a1, S1), claim(1, 2, "Four lanes and rail.", a2, S2), claim(1, 3, "An unsupported remark.", null)];
};

test("unchanged pages: every checkable claim is exact, and the unsupported sentence is skipped, not gone", () => {
  const out = freshnessOf({ claims: claims(), pages: [{ ref: "bridge", text: page }] });
  assert.equal(out.checked, 2);
  assert.equal(out.skipped, 1);
  assert.deepEqual(out.counts, { exact: 2, shifted: 0, moved: 0, gone: 0, unchecked: 0 });
  assert.deepEqual(out.stale, []);
});

test("the claim's SPOKEN text is never compared to the address: a paraphrase witnessed by a source sentence is not stale", () => {
  const out = freshnessOf({ claims: claims(), pages: [{ ref: "bridge", text: page }] });
  assert.equal(out.stale.length, 0);   // ARG1 "The bridge opened in 1932." is not the bytes at the address, and must not be reported gone
});

test("a page edited above the cited sentence: shifted, with the new address beside the old", () => {
  const edited = `A new paragraph was added. ${page}`;
  const out = freshnessOf({ claims: claims(), pages: [{ ref: "bridge", text: edited }] });
  assert.equal(out.counts.shifted, 2);
  assert.equal(out.stale[0].kind, "shifted");
  assert.equal(out.stale[0].was, addr("bridge", page, S1));
  assert.equal(out.stale[0].at, addr("bridge", edited, S1));
});

test("the same words under another ref: moved, never gone (refs are unique per call, not across turns)", () => {
  const out = freshnessOf({ claims: claims(), pages: [{ ref: "bridge-2", text: page }] });
  assert.equal(out.counts.moved, 2);
  assert.equal(out.counts.gone, 0);
  assert.equal(out.stale[0].source, "bridge-2");
});

test("a page that was not re-read is UNCHECKED, listed apart, never counted gone", () => {
  const out = freshnessOf({ claims: claims(), pages: [] });
  assert.equal(out.counts.unchecked, 2);
  assert.equal(out.counts.gone, 0);
  assert.deepEqual(out.stale, []);
  assert.deepEqual(out.unchecked, ["t1c1", "t1c2"]);
});

test("cited words that no longer exist on the loaded page: gone, with the typed reason", () => {
  const rewritten = "Intro text. A wholly different history of the crossing now stands in its place. Closing words follow here.";
  const out = freshnessOf({ claims: claims(), pages: [{ ref: "bridge", text: rewritten }] });
  assert.equal(out.counts.gone, 2);
  assert.equal(out.stale[0].kind, "gone");
  assert.equal(out.stale[0].why, "address_names_other_bytes");
});

test("a claim with no basis.cited (the record held no such span) is skipped, never guessed or reported gone", () => {
  const a = addr("bridge", page, S1);
  const c = [claim(2, 1, "Said it.", a)];
  assert.equal(c[0].basis.cited, undefined);
  const out = freshnessOf({ claims: c, pages: [{ ref: "bridge", text: "completely different page text" }] });
  assert.equal(out.checked, 0);
  assert.equal(out.skipped, 1);
  assert.deepEqual(out.stale, []);
});

test("showed-claims (no spoken unit) carry their own bytes and are checked", () => {
  const a = addr("bridge", page, S1);
  const c = [{ ...claim(3, 1, S1, a, S1), rel: "showed" }];
  assert.equal(freshnessOf({ claims: c, pages: [{ ref: "bridge", text: page }] }).counts.exact, 1);
});

test("it never rewrites: claims and pages are untouched, and degenerate input is empty, not a throw", () => {
  const cs = claims(); const snap = JSON.stringify(cs);
  freshnessOf({ claims: cs, pages: [{ ref: "bridge", text: `x ${page}` }] });
  assert.equal(JSON.stringify(cs), snap);
  assert.deepEqual(freshnessOf(), { checked: 0, skipped: 0, counts: { exact: 0, shifted: 0, moved: 0, gone: 0, unchecked: 0 }, stale: [], unchecked: [] });
  assert.equal(freshnessOf({ claims: [null, 3, "x"], pages: null }).checked, 0);
});
