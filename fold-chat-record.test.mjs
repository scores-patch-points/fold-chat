import test from "node:test";
import assert from "node:assert/strict";
import { claimsOfTurn, citedAt, pointerOf, appendClaims, claimsAt, projectRecord, spokenFrom, holonOfSource, turnAddress } from "./fold-chat-record.js";
import * as FOLD from "./vendor/the-fold/fold.js";

const S1 = "The Eiffel Tower is 330 metres tall.";
const S2 = "It was completed in 1889.";
const pivot = { units: [
  { kind: "sentence", text: S1, support: "https://x.org/eiffel#10-46" },
  { kind: "sentence", text: S2, support: "https://x.org/eiffel#50-75" },
] };

test("a source address becomes a holon path, one segment per part", () => {
  assert.equal(holonOfSource("a/b c#3-9"), "/s/a~b~c/3-9");
  assert.notEqual(holonOfSource("a//b#1-2"), holonOfSource("a/b#1-2"), "distinct refs never collide");
  assert.equal(holonOfSource(""), null);
});

test("spoken sentences become claims at /t<turn>/c<i>, verbatim, each carrying its witness", () => {
  const cs = claimsOfTurn({ turn: 7, pivot });
  assert.deepEqual(cs.map((c) => c.ground), ["/t7/c1", "/t7/c2"]);
  assert.equal(cs[0].roles.ARG1, S1);
  assert.equal(cs[0].basis.support, "https://x.org/eiffel#10-46");
  assert.equal(cs[0].basis.source, "/s/https:~~x.org~eiffel/10-46");
});

test("no spoken units: the sources the fold SHOWED are the claims", () => {
  const cs = claimsOfTurn({ turn: 2, pivot: null, record: { sources: [{ address: "r1#0-5", text: "Page words." }] } });
  assert.equal(cs.length, 1);
  assert.equal(cs[0].rel, "showed");
  assert.equal(cs[0].roles.ARG1, "Page words.");
});

test("ROUND TRIP: the store alone rebuilds the spoken text; the 100-char view is a cut, the store is not", () => {
  const cs = claimsOfTurn({ turn: 7, pivot });
  const store = appendClaims([], cs);
  const rec = { ...FOLD.buildWarrantRecord({ turn: 7, gist: "x" }), ...pointerOf({ turn: 7, claims: cs }) };
  assert.equal(spokenFrom(rec, store), `${S1} ${S2}`);
  assert.equal(projectRecord(rec, store, { max: 20 }).length, 20);
  assert.equal(spokenFrom(rec, store), `${S1} ${S2}`, "cutting the view leaves the store whole");
});

test("the store is append-only and idempotent; another turn's claims never leak into this address", () => {
  const a = claimsOfTurn({ turn: 1, pivot });
  const b = claimsOfTurn({ turn: 2, pivot: { units: [{ kind: "sentence", text: "Other." }] } });
  let store = appendClaims(appendClaims([], a), b);
  store = appendClaims(store, a);
  assert.equal(store.length, 3);
  assert.deepEqual(claimsAt(turnAddress(2), store).map((c) => c.roles.ARG1), ["Other."]);
});

test("the pointer rides the warrant record additively; an old-shape record is unchanged", () => {
  const old = FOLD.buildWarrantRecord({ turn: 1, gist: "g", refs: [] });
  assert.equal(old.address, undefined);
  const cs = claimsOfTurn({ turn: 7, pivot });
  const rec = { ...FOLD.buildWarrantRecord({ turn: 7, gist: "g" }), ...pointerOf({ turn: 7, claims: cs, forWhom: "who is tall" }) };
  assert.equal(rec.address, "/t7");
  assert.deepEqual(rec.claimIds, ["t7c1", "t7c2"]);
  assert.equal(rec.forWhom, "who is tall");
});

test("basis.cited is the source's own bytes at the support span, read from the MATERIAL (not the spoken sentence, not the record's text); absent when it cannot be", () => {
  const page = "xxxx Eiffel Tower height: 330 m. yyyy";
  const material = [{ ref: "https://x.org/eiffel", text: page }];
  const pv = { units: [{ kind: "sentence", text: S1, support: "https://x.org/eiffel#5-32" }, { kind: "sentence", text: S2, support: "https://x.org/eiffel#5-999" }, { kind: "sentence", text: "Z.", support: "other#0-3" }, { kind: "sentence", text: "Y." }] };
  const cs = claimsOfTurn({ turn: 7, pivot: pv, material, record: { sources: [{ address: "https://x.org/eiffel#5-32", text: "the SPOKEN sentence" }] } });
  assert.equal(cs[0].basis.cited, page.slice(5, 32));
  assert.notEqual(cs[0].basis.cited, cs[0].roles.ARG1, "the spoken sentence is not the cited bytes");
  assert.equal("cited" in cs[1].basis, false, "a span past the end of the page: absent");
  assert.equal("cited" in cs[2].basis, false, "a ref not in the material: absent");
  assert.equal("support" in cs[3].basis, false, "no support: no cited");
  assert.equal(citedAt("a#b#2-4", [{ ref: "a#b", text: "0123456" }]), "23", "a ref may itself contain #");
  const shown = claimsOfTurn({ turn: 2, pivot: null, record: { sources: [{ address: "r1#0-5", text: "ignored" }] }, material: [{ ref: "r1", text: "Page words." }] });
  assert.equal(shown[0].basis.cited, "Page ");
});
