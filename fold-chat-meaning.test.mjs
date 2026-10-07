// fold-chat-meaning.test.mjs — word meaning from the reading's own hyperlexicon (fold-chat-meaning.js) and the gated synonym rung of
// fold-chat-origin.js. Falsifiers are marked FALSIFIER. No network, no model, no list of synonyms anywhere.
import test from "node:test";
import assert from "node:assert/strict";
import { readLedger, sameMeaning, MEANING } from "./fold-chat-meaning.js";
import { supportOf, IDENTITY } from "./fold-chat-origin.js";
import { functionWordsOf } from "./fold-chat-snippets.js";

const FW = functionWordsOf("en");
const note = (ref, end1, label, end2, polarity = "+") => ({ ref, end1, label, end2, polarity });
// a hand-built ledger: the article (an independent source) heard "runs" and "flows" relate the SAME ends; "married" relates other ends
const LEDGER = { notes: [
  note("article", "quillon", "runs", "sund sea"), note("article", "quillon", "flows", "sund sea"),
  note("article", "mara dene", "married", "pell"), note("article", "quillon", "crosses", "ostland"),
  note("claim", "quillon", "rises", "karth mountains"), note("page", "quillon", "empties", "karth mountains"),
], verbs: new Set(), sources: ["article", "claim", "page"] };

test("sameMeaning: two words that fill the SAME slot, heard in an independent source, are one meaning there — and the slot is shown", () => {
  const r = sameMeaning("runs", "flows", LEDGER, { exclude: ["claim", "page"] });
  assert.equal(r.verdict, "same"); assert.equal(r.via, "slot");
  assert.deepEqual(r.slots, ["quillon → sund sea"]); assert.deepEqual(r.witnesses, ["article"]);
});

test("sameMeaning FALSIFIER: CIRCULARITY IS REFUSED — slots heard only in the claim and the page under test are not evidence that their words are one meaning", () => {
  // 'rises' (claim) and 'empties' (page) share a slot ONLY because the claim and the page are being compared
  assert.equal(sameMeaning("rises", "empties", LEDGER, { exclude: ["claim", "page"] }).verdict, "refused", "set aside, neither word fills any slot");
  assert.equal(sameMeaning("rises", "empties", LEDGER, { exclude: [] }).verdict, "same", "(and only without the guard does it look like synonymy)");
});

test("sameMeaning: typed outcomes — other (each fills slots, never a common one), refused (a word with no slot), folded identity, polarity kept apart", () => {
  assert.equal(sameMeaning("runs", "married", LEDGER, { exclude: ["claim", "page"] }).verdict, "other");
  const gap = sameMeaning("runs", "meanders", LEDGER, { exclude: ["claim", "page"] });
  assert.equal(gap.verdict, "refused"); assert.match(gap.why, /"meanders" fills no slot/);
  assert.deepEqual(sameMeaning("Runs", "runs", { notes: [] }), { verdict: "same", via: "folded" });
  assert.equal(sameMeaning("", "x", LEDGER).verdict, "refused");
  const neg = { notes: [note("a", "q", "runs", "s"), note("a", "q", "flows", "s", "-")] };
  assert.equal(sameMeaning("runs", "flows", neg).verdict, "other", "a slot heard asserted and a slot heard denied are not one slot");
  assert.equal(sameMeaning("runs", "flows", null).verdict, "refused");
});

test("readLedger: the vocabulary is MEASURED from the text — a lone claim and one page admit no verb, so every pair is a typed gap (the measured null)", () => {
  const l = readLedger([{ ref: "claim", text: "She won the 1911 Nobel Prize in Chemistry for discovering radium." }, { ref: "page", text: "The Nobel Prize in Chemistry 1911 was awarded to Marie Curie. Marie Curie worked in Paris." }], { fw: FW });
  assert.equal(l.verbs.size, 0); assert.deepEqual(l.notes, []);
  assert.equal(sameMeaning("won", "awarded", l).verdict, "refused");
  for (const bad of [null, [], [{ ref: "x", text: "" }], [{ ref: "x" }]]) assert.deepEqual(readLedger(bad, { fw: FW }).notes, [], "nothing it is given can make it throw");
});

test("readLedger: where a text recurs enough to admit verbs, notes keep the source they were heard in", () => {
  const article = "Alder Quill reached Ostland. Brenna Dray reached Ostland. Corvin Holt reached Karth. Alder Quill left Ostland. Brenna Dray left Karth. Corvin Holt left Ostland. Dara Pell reached Karth.";
  const l = readLedger([{ ref: "article", text: article }], { fw: FW });
  assert.ok(l.verbs.size >= 1, "'reached' follows several distinct names: admitted by recurrence, not listed");
  assert.ok(l.notes.length >= 1 && l.notes.every((n) => n.ref === "article" && n.end1 && n.label && n.end2));
  assert.equal(MEANING.minSurfaces, 2);
});

// ───────────────────────── the gated rung in the support check ─────────────────────────
const PAGE = { url: "https://survey.example.org/q", title: "Rivers", text: "Rivers of Ostland. The Quillon river flows for 640 kilometres from the Karth Mountains in the north to the Sund Sea. It is the longest river of Ostland." };
const CLAIM = "The Quillon runs for 640 kilometres to the Sund Sea.";

test("supportOf: OFF by default — a reworded claim is typed undecidable (terms) with no ledger; with the reading's ledger it is SAME and every substituted pair is disclosed", () => {
  const off = supportOf(CLAIM, PAGE, { forWhom: "how far" });
  assert.equal(off.verdict, "undecidable"); assert.equal(off.why, "terms");
  const on = supportOf(CLAIM, PAGE, { forWhom: "how far", meaning: { ledger: LEDGER, exclude: ["claim", "page"] } });
  assert.equal(on.verdict, "same"); assert.equal(on.rung, "meaning"); assert.equal(on.identity.by, "meaning");
  assert.deepEqual(on.synonyms.map((s) => [s.claim, s.page]), [["runs", "flows"]]);
  assert.deepEqual(on.synonyms[0].via, ["quillon → sund sea"]);
  assert.match(on.sentence, /^The Quillon river flows for 640 kilometres/);
  assert.equal(PAGE.text.slice(...on.address.split("#")[1].split("-").map(Number)), on.sentence, "still addressed by the page's own bytes");
  assert.equal(on.identity.measured, false); assert.deepEqual({ ...on.identity }, { ...IDENTITY("how far", "meaning") });
});

test("supportOf FALSIFIER: an unearned pair, a circular pair, or a substitution that the STRICT check then refuses never becomes 'same'", () => {
  const ex = ["claim", "page"];
  const noSlot = { notes: [note("article", "mara dene", "married", "pell")] };
  assert.notEqual(supportOf(CLAIM, PAGE, { meaning: { ledger: noSlot, exclude: ex } }).verdict, "same", "the reading never placed 'runs' and 'flows': a typed gap");
  const circular = { notes: [note("claim", "quillon", "runs", "sund sea"), note("page", "quillon", "flows", "sund sea")] };
  assert.notEqual(supportOf(CLAIM, PAGE, { meaning: { ledger: circular, exclude: ex } }).verdict, "same", "the claim and the page cannot witness their own synonymy");
  // synonymy earned, but the figure differs: the strict consequence is run again after the substitution and refuses
  const wrongFigure = supportOf("The Quillon runs for 580 kilometres to the Sund Sea.", PAGE, { meaning: { ledger: LEDGER, exclude: ex } });
  assert.notEqual(wrongFigure.verdict, "same");
  assert.notEqual(supportOf("The Quillon runs for 640 kilometres to the Sund Sea.", { ...PAGE, text: "The Quillon river does not flow for 640 kilometres to the Sund Sea at all." }, { meaning: { ledger: LEDGER, exclude: ex } }).verdict, "same", "a negated page never supports");
});
