import { test } from "node:test";
import assert from "node:assert/strict";
import { sentenceSpans, holonsOf, refsOf, verifyHolon, askOf, assemble, verifyAssembly, verifyDerivation, consequenceOf, sameClaim, certify } from "./fold-chat-assemble.js";

const TOWER = "The tower is 330 metres (1,083 ft) tall, about the same height as an 81-storey building, and the tallest structure in Paris. Its base is square, measuring 125 metres (410 ft) on each side. Construction of the tower began in 1887 and it was completed in 1889. Gustave Eiffel's company designed and built the tower. The iron weighs 7,300 tonnes. The tower has two restaurants.";
const page = (name, text) => ({ url: `https://example.test/wiki/${name}`, text });
const pages = [page("Eiffel_Tower", TOWER)];

test("sentenceSpans keeps a decimal figure whole and offsets exact", () => {
  const t = "Its height was measured in 2020 as 8,848.86 m (29,031 ft). Next one is short here.\nA U.S. firm wrote this one.";
  const s = sentenceSpans(t);
  assert.equal(s.length, 3);
  assert.ok(s[0].text.includes("8,848.86 m"));
  for (const x of s) assert.equal(t.slice(x.start, x.end), x.text);
});

test("holons are addressed, self-verifying, and two pages never share an address", () => {
  const two = [page("Rhine", "The river is long and old and wide enough for ships to pass."), { url: "https://other.test/zh-cn/Rhine", text: "The river is long and old and wide enough for ships to pass." }];
  assert.deepEqual(refsOf(two), ["Rhine", "Rhine~2"]);
  const hs = holonsOf(two);
  assert.equal(new Set(hs.map((h) => h.address)).size, hs.length);
  for (const h of hs) assert.ok(verifyHolon(h, two));
  assert.ok(!verifyHolon({ ...hs[0], text: hs[0].text + "x" }, two));
});

test("a year ask is answered by a sentence with a year bound to an event, quoted verbatim with its address", () => {
  const r = assemble({ question: "In what year was the Eiffel Tower completed?", pages });
  assert.ok(r.sentences.length >= 1);
  assert.equal(r.sentences[0].how, "verbatim");
  assert.match(r.sentences[0].text, /completed in 1889/);
  assert.match(r.sentences[0].address[0], /^Eiffel_Tower#\d+-\d+$/);
  assert.ok(verifyAssembly(r, pages).ok);
});

test("a unit the ask names is stated by the source or DERIVED with its premise (never reworded)", () => {
  const m = assemble({ question: "How tall is the Eiffel Tower in metres?", pages: [page("Eiffel_Tower", "The tower stands 1,083 ft tall in the middle of the city, said the guide.")] });
  const d = m.sentences.find((s) => s.how === "derived");
  assert.ok(d, "a conversion is derived");
  assert.match(d.text, /1,083 ft = 330\.\d* metres/);
  assert.equal(d.derivation.rule, "unit-conversion");
  assert.equal(d.derivation.premises[0].address, d.address[0]);
  assert.ok(verifyAssembly(m, [page("Eiffel_Tower", "The tower stands 1,083 ft tall in the middle of the city, said the guide.")]).ok);
});

test("falsifier: a derived line whose arithmetic or premise is tampered is refused by the checker", () => {
  const p = [page("Eiffel_Tower", "The tower stands 1,083 ft tall in the middle of the city, said the guide.")];
  const r = assemble({ question: "How tall is the Eiffel Tower in metres?", pages: p });
  const d = r.sentences.find((s) => s.how === "derived");
  const bad = { ...r, sentences: [{ ...d, derivation: { ...d.derivation, value: d.derivation.value + 1 } }] };
  assert.equal(verifyAssembly(bad, p).ok, false);
  const wrongPremise = { ...r, sentences: [{ ...d, derivation: { ...d.derivation, premises: [{ ...d.derivation.premises[0], figure: "1,084" }] } }] };
  assert.equal(verifyAssembly(wrongPremise, p).ok, false);
  const forged = { sentences: [{ text: "The tower is 450 metres tall.", address: ["Eiffel_Tower#0-10"], how: "verbatim" }] };
  assert.equal(verifyAssembly(forged, p).ok, false);
});

test("a comparison derives from two sourced quantities, both premises quoted; an area figure is not a length", () => {
  const ps = [
    page("Danube", "Originating in Germany, the Danube flows southeast for 2,850 km (1,770 mi), passing through many countries."),
    page("Rhine", "Draining an area of 185,000 km, it is the second-longest river in Central and Western Europe (after the Danube), at about 1,230 km (760 mi) with a large discharge."),
  ];
  const r = assemble({ question: "Which is longer, the Danube or the Rhine?", pages: ps });
  const d = r.sentences.find((s) => s.how === "derived");
  assert.ok(d && d.derivation.rule === "compare-quantity");
  assert.equal(d.derivation.winner, 0);                      // the Danube, 2,850 km > 1,230 km (never the 185,000 area)
  assert.equal(d.address.length, 2);
  assert.ok(verifyAssembly(r, ps).ok);
  assert.equal(verifyDerivation({ ...d, derivation: { ...d.derivation, winner: 1 } }, holonsOf(ps)).ok, false);
});

test("a comparison with a missing quantity is a typed gap, not a pile of sentences", () => {
  const ps = [page("Danube", "Originating in Germany, the Danube flows southeast for 2,850 km (1,770 mi), passing through many countries.")];
  const r = assemble({ question: "Which is longer, the Danube or the Rhine?", pages: ps });
  assert.equal(r.sentences.length, 0);
  assert.equal(r.gaps[0].kind, "no-figure-of-kind");
});

test("falsifier: a page that does not hold the answer yields a typed gap", () => {
  const r = assemble({ question: "In what year was the Eiffel Tower completed?", pages: [page("Under_the_Eiffel_Tower", "He gets on a plane and returns to France to see the woman he loves. The winery sale is completed, and he and Louise reconcile.")] });
  assert.equal(r.sentences.length, 0);
  assert.ok(r.gaps.length === 1 && r.gaps[0].kind);
  const none = assemble({ question: "Who won the 2034 World Cup?", pages: [] });
  assert.equal(none.gaps[0].kind, "no-source");
  assert.equal(none.sentences.length, 0);
});

test("askOf reads referents, the answer type and the unit; a rate is not a length", () => {
  const a = askOf("What is the speed of light in kilometres per second?");
  assert.ok(a.wants.unit && a.wants.unit.dim === "len" && a.wants.rate);
  const b = askOf("On what date did Apollo 11 land on the Moon?");
  assert.ok(b.referents.some((r) => r.toks.includes("11")) && b.wants.year);
  const c = askOf("Who wrote Pride and Prejudice?");
  assert.equal(c.referents.length, 1);
  assert.ok(c.wants.person);
});

test("identity by consequence: the same quantity in another unit is one claim; another quantity is not", () => {
  assert.equal(sameClaim("The tower is 330 metres tall.", "The tower is 1,083 feet tall.", pages).verdict, "same");
  assert.equal(sameClaim("The tower was completed in 1889.", "Construction of the tower began in 1887.", pages).verdict, "different");
  assert.equal(sameClaim("Gustave Eiffel's company built the tower.", "The tower was built by the company of Gustave Eiffel.", pages).verdict, "same");
});

test("identity falsifiers: unit contradiction, negation, ordering and another language are undecidable, never same", () => {
  assert.equal(certify("The tower is 330 feet tall.", pages).accepted, false);            // the gate alone accepts this: 330 = 330
  assert.equal(certify("The iron weighs 7,300 kilograms.", pages).accepted, false);
  assert.equal(certify("The iron weighs 7,300 tonnes.", pages).accepted, true);
  assert.equal(sameClaim("The tower is 330 metres tall.", "The tower is not 330 metres tall.", pages).verdict, "undecidable");
  assert.equal(sameClaim("The tower is taller than the Statue of Liberty.", "The Statue of Liberty is taller than the tower.", pages).verdict, "undecidable");
  assert.equal(sameClaim("The tower is 330 metres tall.", "La torre mide 330 metros de altura.", pages).verdict, "undecidable");
  assert.equal(consequenceOf("The tower is 300 metres tall.", pages).atoms.length, 0);
});
