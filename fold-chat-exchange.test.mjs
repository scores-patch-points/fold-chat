// fold-chat-exchange.test.mjs — the discourse summary is about what the PERSON and the FOLD said; research never enters it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { exchangesOf, exchangeFlow, exchangeTopic, usedRefs, foldAnswer, applyExchange, actOf, EXCHANGE } from "./fold-chat-exchange.js";

const U = (c) => ({ role: "user", content: c });
const A = (c, extra = {}) => ({ role: "assistant", content: c, ...extra });
// an assistant message whose grounding carries a LOT of research (page titles, cited sources) that must never reach the summary
const RESEARCH = { grounding: { web: [{ read: "https://worldatlas.com/x" }, { read: "https://britannica.com/y" }], sources: [{ address: "Petřín Lookout Tower#1-5" }] } };

test("exchangesOf: one exchange per ask the fold replied to; the act is read from the stored message, never from the page", () => {
  const ms = [U("How tall is the Eiffel Tower?"), A("The Eiffel Tower is 330 meters tall. It was built in 1889.", RESEARCH), U("who are you?"), A("Who Are You is the eighth studio album by the Who. More text here.", { authored: "sources" }), U("hmm"), A("", { notices: [{ kind: "stopped" }] }), U("and?"), A("")];
  const ex = exchangesOf(ms);
  assert.deepEqual(ex.map((e) => e.act), ["answered", "showed-sources", "stopped", "no-answer"]);
  assert.equal(ex[0].said, "The Eiffel Tower is 330 meters tall.", "the fold's own first sentence");
  assert.equal(ex[1].said, "", "a sources-only turn's words are the PAGE's: not recorded as what the fold said");
  assert.equal(actOf(A("", { notices: [{ kind: "alone" }] })), "fixed-line");
});

test("FALSIFIER: the flow never contains a retrieved page's title, a cited source or the page's own sentence — only asks and the fold's own words", () => {
  const ms = [U("How tall is the Eiffel Tower?"), A("The Eiffel Tower is 330 meters tall.", RESEARCH), U("who are you?"), A("Who Are You is the eighth studio album by the English rock band the Who.", { authored: "sources", ...RESEARCH })];
  const flow = exchangeFlow(exchangesOf(ms));
  for (const research of ["WorldAtlas", "worldatlas", "Britannica", "Petřín", "album", "English rock band", "#1-5", "Cited"]) assert.ok(!flow.includes(research), research + " leaked into: " + flow);
  assert.match(flow, /they asked "How tall is the Eiffel Tower\?" and I said "The Eiffel Tower is 330 meters tall\."/);
  assert.match(flow, /they asked "who are you\?" and I showed the sources' own words/);
});

test("the flow is ordered, bounded, and counts what it folds away", () => {
  const ms = []; for (let i = 1; i <= 9; i++) ms.push(U("question number " + i + " " + "x".repeat(200)), A("answer " + i + ". more"));
  const ex = exchangesOf(ms);
  const flow = exchangeFlow(ex);
  assert.match(flow, /^So far, in order: 3 earlier exchanges \(the first opened on "question number 1/);
  assert.equal((flow.match(/they asked/g) || []).length, EXCHANGE.maxExchanges);
  assert.ok(flow.indexOf("question number 4") < flow.indexOf("question number 9"), "oldest first");
  assert.ok(flow.length < 1200, "bounded: " + flow.length);
  assert.equal(exchangeFlow([]), null);
});

test("topic is the latest ask as the person wrote it (it moves with the conversation), not the first one", () => {
  const ex = exchangesOf([U("How tall is the Eiffel Tower?"), A("330 meters."), U("What is photosynthesis?"), A("It converts light.")]);
  assert.equal(exchangeTopic(ex), "What is photosynthesis?");
});

test("usedRefs: a page counts only if a SPOKEN sentence was witnessed by it; with the Pivot on, the record's wider list does not count", () => {
  const pivot = { units: [{ support: "en.wikipedia.org — Eiffel Tower#10-60" }, { text: "unsupported but spoken" }, { support: "en.wikipedia.org — Eiffel Tower#70-90" }] };
  assert.deepEqual([...usedRefs({ pivot, record: { sources: [{ address: "worldatlas.com — X#1-2" }] } })], ["en.wikipedia.org — Eiffel Tower"]);
  assert.deepEqual([...usedRefs({ pivot: { units: [] }, record: { sources: [{ address: "worldatlas.com — X#1-2" }] } })], [], "the Pivot spoke nothing witnessed: no page names anything");
  assert.deepEqual([...usedRefs({ pivot: null, record: { sources: [{ address: "a — B#1-2" }] } })], ["a — B"], "no Pivot: the record's grounded sources");
  assert.deepEqual([...usedRefs({})], []);
});

test("foldAnswer records the fold's words, or the ACT when the words were a page's or absent", () => {
  assert.equal(foldAnswer({ text: "It is 330 meters tall." }), "It is 330 meters tall.");
  assert.equal(foldAnswer({ text: "page text here", strand: { snips: [{}] } }), "(showed the sources' own words)");
  assert.equal(foldAnswer({ text: "   " }), "(no answer)");
});

test("applyExchange replaces topic and flow only; entities, context and the record stores are the caller's", () => {
  const summary = { topic: "old", flow: "old flow", entities: ["Gustave Eiffel"], context: "open: x", records: [1], folds: ["f"] };
  const out = applyExchange(summary, { messages: [U("Who designed it?"), A("Gustave Eiffel's company did.")] });
  assert.equal(out.topic, "Who designed it?");
  assert.match(out.flow, /they asked "Who designed it\?" and I said "Gustave Eiffel's company did\."/);
  assert.deepEqual([out.entities, out.context, out.records, out.folds], [summary.entities, summary.context, summary.records, summary.folds]);
  assert.equal(applyExchange(summary, { messages: [] }), summary, "nothing exchanged yet: left exactly as it was");
  assert.equal(applyExchange(null, { messages: [] }), null);
});

test("non-Latin asks and answers fold the same way (no case logic, no English patterns beyond the sentence ends)", () => {
  const ex = exchangesOf([U("東京の人口は？"), A("東京の人口は約一千四百万人です。 他の文。")]);
  assert.equal(ex[0].said, "東京の人口は約一千四百万人です。");
  assert.match(exchangeFlow(ex), /東京の人口は？/);
});

test("the module owns no model, network or storage", () => {
  const src = fs.readFileSync(new URL("./fold-chat-exchange.js", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
  assert.ok(!/\b(fetch|XMLHttpRequest|callModel|client\.chat|localStorage)\b/.test(src));
});

test("topic stays on the thread: a tangent the fold did not answer (a gap, a fixed line, only a page's words) does not move it", () => {
  const ex = exchangesOf([U("How tall is the Eiffel Tower?"), A("330 meters."), U("who are you?"), A("Who Are You is an album.", { authored: "sources" }), U("hmm"), A("", { notices: [{ kind: "alone" }] })]);
  assert.equal(exchangeTopic(ex), "How tall is the Eiffel Tower?");
  assert.equal(exchangeTopic(exchangesOf([U("who are you?"), A("", { notices: [{ kind: "alone" }] })])), "who are you?", "with nothing answered yet, the latest ask");
});
