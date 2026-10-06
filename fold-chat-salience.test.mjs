import test from "node:test";
import assert from "node:assert/strict";
import { termsOf, askTerms, salientExcerpt, verifyExcerpt, salientSources, continuesThread, salientHistory, salientSummary, SALIENCE } from "./fold-chat-salience.js";
import { functionWordsOf } from "./fold-chat-snippets.js";

const fw = functionWordsOf("en");
const EIFFEL = "The Eiffel Tower is a lattice tower in Paris. It was designed by Gustave Eiffel. The tower is 330 metres tall. It opened in 1889. Many visitors come each year. The base is square.";
const FILM = "Tomorrowland is a 2015 film. It stars George Clooney. The film was directed by Brad Bird.";
const page = (ref, text) => ({ ref, text });
const terms = (q) => askTerms({ question: q }, fw);

test("S2: an excerpt is made only of verbatim slices of the page, in page order, within budget", () => {
  const p = page("w — Eiffel Tower", EIFFEL);
  const ex = salientExcerpt(p, terms("How tall is the Eiffel Tower?"), { chars: 120 });
  assert.ok(ex.text.includes("330 metres"));
  assert.ok(verifyExcerpt(p, ex));
  assert.ok(ex.text.replace(/…/g, "").length <= 120 + 40);
  for (let i = 1; i < ex.slices.length; i++) assert.ok(ex.slices[i].start >= ex.slices[i - 1].end);
  assert.equal(verifyExcerpt(p, { ...ex, text: ex.text + " invented" }), false, "the check catches a word the page does not carry");
});

test("S2: an off-topic page is dropped; the on-topic one is kept", () => {
  const r = salientSources([page("film", FILM), page("e — Eiffel Tower", EIFFEL)], terms("How tall is the Eiffel Tower?"));
  assert.deepEqual(r.passages.map((p) => p.ref), ["e — Eiffel Tower"]);
  assert.ok(r.dropped.some((d) => d.ref === "film"));
  assert.equal(r.measured, true);
});

test("S2: an ask whose terms match no page yields NO passages (the caller then has nothing to hand a model)", () => {
  const r = salientSources([page("film", FILM), page("e", EIFFEL)], terms("What is photosynthesis?"));
  assert.equal(r.passages.length, 0);
  assert.equal(r.dropped.length, 2);
});

test("a language with no closed-class prior is passed through unchanged, and says so", () => {
  const list = [page("a", EIFFEL)];
  const r = salientSources(list, null);
  assert.equal(r.measured, false);
  assert.deepEqual(r.passages, list);
  assert.equal(termsOf("x", null), null);
});

test("budget: the page limit and the total are honoured and the dropped are named", () => {
  const many = [1, 2, 3, 4, 5].map((i) => page("p" + i + " — Eiffel Tower", EIFFEL));
  const r = salientSources(many, terms("How tall is the Eiffel Tower?"));
  assert.ok(r.passages.length <= SALIENCE.maxSources);
  assert.ok(r.dropped.every((d) => d.why));
});

test("S3 (offline half): a topic change hands the model no old thread; a follow-up still gets the Eiffel exchange", () => {
  const history = [{ role: "user", content: "How tall is the Eiffel Tower?" }, { role: "assistant", content: "330 metres." }];
  const last = { ask: "How tall is the Eiffel Tower?", said: "330 metres." };
  const change = continuesThread({ follow: { kind: "standalone" }, terms: terms("How does photosynthesis work?"), lastExchange: last });
  assert.equal(change, false);
  assert.deepEqual(salientHistory(history, { continues: change }), []);
  const sum = salientSummary({ topic: "Eiffel", flow: "x", entities: ["Eiffel Tower"], context: "c", records: [{ gist: "Eiffel Tower is tall" }], folds: ["f"] }, { continues: change, terms: terms("How does photosynthesis work?"), empty: { topic: null, flow: null, entities: [], context: null, records: [], folds: [] } });
  assert.equal(JSON.stringify(sum).toLowerCase().includes("eiffel"), false, "nothing of the old thread survives a topic change");
  const follow = continuesThread({ follow: { kind: "carried" }, terms: terms("Who designed it?"), lastExchange: last });
  assert.equal(follow, true);
  assert.equal(salientHistory(history, { continues: follow }).length, 2);
});

test("a standalone ask that shares a content stem with the last exchange continues the thread", () => {
  const last = { ask: "How tall is the Eiffel Tower?", said: "330 metres." };
  assert.equal(continuesThread({ follow: { kind: "standalone" }, terms: terms("When was the Eiffel Tower built?"), lastExchange: last }), true);
});
