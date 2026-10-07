// node --test fold-chat-casts.test.mjs — fix (e): a pronoun binds to ONE referent the person can reach.
// And RC1: a pronoun ask never falls into the comparative "variant" bag-of-words branch.
import test from "node:test";
import assert from "node:assert/strict";
import { followUp } from "./fold-chat-thread.js";
import { castOf, resolveCast } from "./fold-chat-casts.js";
import { emptyReferents, admitReferents } from "./fold-chat-mind.js";
import { hintsFor } from "./fold-chat-hints.js";

const HINTS = hintsFor("en");
const PRIOR = [
  { role: "user", content: "did donald trump win the 2020 presidential election in a landslide?" },
  { role: "assistant", content: "There is no consensus that Donald Trump won a landslide. The 2020 United States presidential election was closely contested." },
];
let REC = emptyReferents();
REC = admitReferents(REC, { question: "did donald trump win the 2020 presidential election in a landslide?", answer: "There is no consensus that Donald Trump won a landslide in the 2020 presidential election.", sources: [{ title: "en.wikipedia.org · 2020 United States presidential election - Wikipedia" }] });

test("RC1: a pronoun ask is a REFERENT ask, never the comparative bag of words", () => {
  const f = followUp("wait say more about him losing the election", PRIOR, { referents: REC, hints: HINTS, lang: "en" });
  assert.equal(f.kind, "carried", `got ${f.kind} (${f.reason})`);
  assert.ok(f.carried.length, "a referent is carried");
});

test("cast: a pronoun binds ONE person-like referent, not the inanimate election blob", () => {
  const cast = castOf(PRIOR, REC);
  const r = resolveCast("say more about him losing the election", cast, { pronoun: "him" });
  assert.equal(r.carried.length, 1, "one referent, never top-2");
  assert.match(r.carried[0].surface, /Trump/i);
  assert.equal(r.reason, "carried");
});

test("cast: a refused referent is never rebound", () => {
  const cast = castOf(PRIOR, REC);
  const r = resolveCast("say more about him losing the election", cast, { pronoun: "him", rejected: ["Donald Trump"] });
  assert.ok(!r.carried.some((c) => /trump/i.test(c.surface)), `still carries Trump: ${JSON.stringify(r.carried)}`);
});

test("cast: a referent no turn ever mentioned (source-only) is not reachable", () => {
  const rec = emptyReferents();
  rec.entities.push({ surface: "President (band)", weight: 9 });
  const cast = castOf(PRIOR, rec);
  assert.equal(cast.established.find((e) => /band/i.test(e.surface))?.holder, "source");
  const r = resolveCast("what about it", cast, { pronoun: "it" });
  assert.equal(r.carried.length, 0);
});

test("CONTROL: with casts OFF the old path still carries (backwards compatible)", () => {
  const f = followUp("wait say more about him losing the election", PRIOR, { referents: REC, hints: HINTS, lang: "en", casts: null });
  assert.equal(f.kind, "carried");
});