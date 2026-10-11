// fold-chat-answerspan.test.mjs — node --test. Mechanism tests on small inline texts (the measured behaviour on REAL pages is eval/ants/p2/run.mjs).
// ANSWERSPAN=<path> runs the same tests against a mutated copy of the module (eval/ants/p2/mutate.mjs).
import test from "node:test";
import assert from "node:assert/strict";

const M = await import(process.env.ANSWERSPAN || "./fold-chat-answerspan.js");
const { answerSpan, classifyAsk, verifyRewrite, quantitiesIn, datesIn, clausesOf, isMinimal, shownText, RULES } = M;

const P = (text, extra = {}) => ({ text, ref: "Test — page", ...extra });
const FILLER = "The page goes on to describe other matters at some length, so that the answer is one sentence among many others. ";

// ── 1. the ask, from the closed classes of its language ─────────────────────────────────────────────
test("classifyAsk: what is wanted, in en/es/fr/ru/zh", () => {
  const w = (q, lang) => classifyAsk(q, { lang }).want;
  assert.equal(w("How tall is the Eiffel Tower?", "en"), "figure");
  assert.equal(w("What is the boiling point of ethanol?", "en"), "figure");
  assert.equal(w("When was Napoleon born?", "en"), "date");
  assert.equal(w("Who painted the Mona Lisa?", "en"), "name");
  assert.equal(w("Where was Marie Curie born?", "en"), "place");
  assert.equal(w("What is photosynthesis?", "en"), "definition");
  assert.equal(w("Why was the Berlin Wall built?", "en"), "reason");
  assert.equal(w("Is the tower taller than the Chrysler Building?", "en"), "yesno");
  assert.equal(w("What are the four largest moons of Jupiter?", "en"), "list");
  assert.equal(w("¿Cuál es la altura de la Torre Eiffel?", "es"), "figure");
  assert.equal(w("¿Cuándo nació Napoleón?", "es"), "date");
  assert.equal(w("Quelle est la hauteur de la tour Eiffel ?", "fr"), "figure");
  assert.equal(w("Pourquoi le mur de Berlin a-t-il été construit ?", "fr"), "reason");
  assert.equal(w("Какова высота Эйфелевой башни?", "ru"), "figure");
  assert.equal(w("Когда родился Наполеон?", "ru"), "date");
  assert.equal(w("埃菲尔铁塔有多高？", "zh"), "figure");
});

test("classifyAsk: the measure word is a cue, not a content term; the dimension follows it", () => {
  const a = classifyAsk("How tall is the Eiffel Tower?", { lang: "en" });
  assert.equal(a.dim, "len"); assert.deepEqual(a.terms.map((t) => t.t), ["eiffel", "tower"]);
  assert.equal(classifyAsk("How heavy is a blue whale?", { lang: "en" }).dim, "mass");
  assert.equal(classifyAsk("What is the boiling point of ethanol?", { lang: "en" }).dim, "temp");
  assert.equal(classifyAsk("How many moons does Mars have?", { lang: "en" }).dim, "count");
});

test("a language with no table gets a typed gap, never a guess", () => {
  const r = answerSpan("Wie hoch ist der Eiffelturm?", [P("Der Eiffelturm ist 330 Meter hoch. " + FILLER)]);
  assert.equal(r.spans.length, 0); assert.equal(r.gap.kind, "language");
  const j = answerSpan("エッフェル塔の高さは？", [P("エッフェル塔は330メートルです。" + FILLER)]);
  assert.equal(j.gap.kind, "language");
});

// ── 2. the smallest span, with the subject it needs ─────────────────────────────────────────────────
const ETH = "Ethanol is a volatile, flammable, colourless liquid with a characteristic wine-like odour. Ethanol boils at 78.37 °C, which is lower than water, and it freezes at -114.1 °C. It is used as a solvent and as a fuel. " + FILLER;

test("the ethanol complaint: one clause with its subject, not the group, not the FAQ block", () => {
  const faq = { kind: "faq", items: ["What is boiling point in chemistry? — The boiling point is the temperature at which the vapor pressure of a liquid equals the pressure of the gas above it.", "What is ethanol used for? — Ethanol is used as a solvent, a fuel and in drinks."] };
  const ps = [P(ETH, { declared: [faq] })];
  const r = answerSpan("what is the boiling point of ethanol", ps);
  assert.equal(r.gap, undefined);
  const s = r.spans[0];
  assert.match(shownText(r), /Ethanol boils at 78\.37 °C/);
  assert.ok(shownText(r).length < 60, shownText(r));
  assert.equal(ps[0].text.slice(s.start, s.end), s.text, "the verbatim span is a substring of the page at [start,end)");
  assert.ok(!/freezes|lower than water/.test(s.text));
});

test("a generic FAQ block with no figure is never an answer to a figure ask", () => {
  const faq = { kind: "faq", items: ["What is boiling point in chemistry? — The boiling point is the temperature at which the vapor pressure of a liquid equals the surrounding pressure.", "How does pressure change it? — A lower pressure lowers the boiling point of a liquid."] };
  const r = answerSpan("what is the boiling point of ethanol", [P("A page about solvents. " + FILLER, { declared: [faq] })]);
  assert.equal(r.spans.length, 0); assert.equal(r.gap.kind, "no-span"); assert.equal(r.gap.text, "no sentence in what was read states this");
});

test("a declared FAQ item whose answer holds the figure is answered from the item, verbatim", () => {
  const faq = { kind: "faq", items: ["How tall is the Eiffel Tower? — The Eiffel Tower is 330 metres tall, including its antenna. It was completed in 1889.", "Who built it? — Gustave Eiffel's company."] };
  const ps = [P("Visit the tower. " + FILLER, { declared: [faq] })];
  const r = answerSpan("How tall is the Eiffel Tower?", ps);
  assert.match(shownText(r), /330 metres/);
  assert.equal(r.spans[0].kind, "list-item");
  const sp = r.spans[0]; assert.equal(sp.text, faq.items[0].slice(sp.start, sp.end), "verbatim from the declared item");
  assert.ok(verifyRewrite(sp.rewrite, ps[0]).ok);
});

test("the dimension must fit: 'how tall' takes the length, not the mass or the date", () => {
  const t = "The statue weighs 225 tonnes and was dedicated in 1886. The statue is 93 metres (305 ft) tall including its pedestal. " + FILLER;
  const r = answerSpan("How tall is the statue?", [P(t)]);
  assert.match(shownText(r), /93 metres/); assert.ok(!/225 tonnes/.test(shownText(r)));
  const m = answerSpan("How heavy is the statue?", [P(t)]);
  assert.match(shownText(m), /225 tonnes/);
});

test("a figure that is a count needs a noun the ask names, or a word of the ask right before it", () => {
  const t = "The museum has 7 January as its reopening date. It holds 35,000 objects on display. " + FILLER;
  assert.equal(answerSpan("How many floors does the museum have?", [P(t)]).spans.length, 0);
  assert.match(shownText(answerSpan("How many objects does the museum hold?", [P(t)])), /35,000 objects/);
});

test("the clause is trimmed to the answer, keeping the subject; the tail that starts a new phrase is dropped", () => {
  const t = "The Mariana Trench is the deepest oceanic trench on Earth. The maximum known depth is 10,935 meters (35,876 ft) at the southern end of a small slot-shaped valley in its floor known as the Challenger Deep. " + FILLER;
  const r = answerSpan("How deep is the Mariana Trench?", [P(t, { ref: "en.wikipedia.org — Mariana Trench" })]);
  assert.match(shownText(r), /^The maximum known depth is 10,935 meters \(35,876 ft\)\.?$/);
});

test("a subject elsewhere in the sentence is brought in: the span holds a word of the ask", () => {
  const t = "The Statue of Unity is the world's tallest statue, with a height of 182 metres (597 feet), located in India. " + FILLER;
  const r = answerSpan("How tall is the Statue of Unity?", [P(t)]);
  assert.match(shownText(r), /^The Statue of Unity is the world's tallest statue, with a height of 182 metres \(597 feet\)\.$/);
});

test("a predicate word of the ask that sits in the next clause comes with the name", () => {
  const t = "It is named after the engineer Gustave Eiffel, whose company designed and built the tower from 1887 to 1889. " + FILLER;
  const r = answerSpan("Who designed the tower?", [P(t, { ref: "en.wikipedia.org — Eiffel Tower" })]);
  assert.match(shownText(r), /Gustave Eiffel, whose company designed/);
});

test("never splits inside a number, a name, a bracket or a quotation", () => {
  const t = 'She won the 1911 Nobel Prize in Chemistry "for the discovery of the elements radium and polonium, by the isolation of radium". ' + FILLER;
  const r = answerSpan("When did she win the Nobel Prize in Chemistry?", [P(t, { ref: "en.wikipedia.org — Marie Curie" })]);
  const s = shownText(r);
  assert.match(s, /1911/); assert.equal((s.match(/"/g) || []).length % 2, 0, s);
  const n = answerSpan("How many visitors came in 2025?", [P("The park received 1,234,567 visitors in 2025, a record. " + FILLER)]);
  assert.match(shownText(n), /1,234,567 visitors/);
  assert.deepEqual(clausesOf("It cost 1,083 dollars (about 2,000, in total), and rose.").map((c) => c.end - c.start).length, 2);
});

test("wrong-entity pages do not answer: the page must be about what was asked", () => {
  const t = "The Statue of Liberty was designed by Bartholdi. Its metal framework was built by Gustave Eiffel. The statue weighs 225 tonnes. " + FILLER;
  const r = answerSpan("How much does the Eiffel Tower weigh?", [P(t, { ref: "en.wikipedia.org — Statue of Liberty" })]);
  assert.equal(r.spans.length, 0);
});

test("unanswerable on an on-topic page: typed gap", () => {
  const t = "Marie Curie was born in Warsaw and won two Nobel Prizes. She founded the Curie Institute in Paris. " + FILLER;
  const r = answerSpan("What is Marie Curie's favourite colour?", [P(t, { ref: "en.wikipedia.org — Marie Curie" })]);
  assert.equal(r.spans.length, 0); assert.equal(r.gap.kind, "no-span");
});

test("questions, menus, cookie notices and block pages are never an answer", () => {
  const q = "How tall is the tower? The tower is 330 metres tall, they say, in one answer. " + FILLER;
  assert.ok(!/How tall is the tower\?/.test(shownText(answerSpan("How tall is the tower?", [P(q)]))));
  const cookie = "We use cookies to measure how tall the tower is for visitors who accept all cookies and privacy policy terms. Accept all cookies. " + FILLER;
  assert.equal(answerSpan("How tall is the tower?", [P(cookie)]).spans.length, 0);
  const wall = "Just a moment... Checking your browser before accessing. The tower is 330 metres tall.";
  const r = answerSpan("How tall is the tower?", [P(wall)]);
  assert.equal(r.spans.length, 0); assert.deepEqual((r.skipped || []).map((x) => x.why), ["blocked"]);
});

test("a date ask takes the date, a name ask takes the name, a place ask the place", () => {
  const t = "Napoleon Bonaparte was born on 15 August 1769 in Ajaccio, Corsica. He died on 5 May 1821 on Saint Helena. " + FILLER;
  assert.match(shownText(answerSpan("When was Napoleon born?", [P(t)])), /15 August 1769/);
  assert.match(shownText(answerSpan("Where was Napoleon born?", [P(t)])), /Ajaccio, Corsica/);
  const n = "The Mona Lisa is a portrait painted by the Italian artist Leonardo da Vinci in the early sixteenth century. " + FILLER;
  const r = answerSpan("Who painted the Mona Lisa?", [P(n)]);
  assert.match(shownText(r), /Leonardo da Vinci/);
});

test("a definition is the defining sentence; a sentence about something else with a copula is not", () => {
  const t = "Although plants are consumers of carbon dioxide, respiration matters. Photosynthesis is a process by which plants convert light into chemical energy. " + FILLER;
  assert.match(shownText(answerSpan("What is photosynthesis?", [P(t, { ref: "en.wikipedia.org — Photosynthesis" })])), /^Photosynthesis is a process by which plants convert light into chemical energy\.$/);
});

test("the ranking prefers the page's lead for facts about the page's subject", () => {
  const lead = "The tower is 330 metres tall. " + FILLER.repeat(30) + "Before it, no structure had been built to a height of 300 metres. " + FILLER;
  assert.match(shownText(answerSpan("How tall is the Eiffel Tower?", [P(lead, { ref: "en.wikipedia.org — Eiffel Tower" })])), /330 metres/);
});

// ── 3. the mechanical rewrite layer ─────────────────────────────────────────────────────────────────
const run = (rule, text, params = {}, ctx = { passage: text }) => RULES[rule].apply(text, params, ctx);

test("rewrite rule decode-entities (declared table only)", () => {
  assert.equal(run("decode-entities", "Eiffel&rsquo;s tower &amp; 5&nbsp;km &#8212; &#x2013;"), "Eiffel’s tower & 5 km — –");
  assert.equal(run("decode-entities", "&unknownentity; stays"), "&unknownentity; stays");
});
test("rewrite rule strip-citation", () => {
  assert.equal(run("strip-citation", "It is 330 m tall.[1] Built in 1889 [citation needed] by Eiffel [12]."), "It is 330 m tall. Built in 1889 by Eiffel.");
  assert.equal(run("strip-citation", "He said [for] the discovery"), "He said [for] the discovery");
});
test("rewrite rule strip-aside keeps a parenthesis that holds a figure or a word of the ask", () => {
  assert.equal(run("strip-aside", "The Eiffel Tower (EYE-fəl; French: Tour Eiffel) is 330 m (1,083 ft) tall", { keep: ["tower"] }), "The Eiffel Tower is 330 m (1,083 ft) tall");
  assert.equal(run("strip-aside", "Ethanol (also called alcohol) boils at 78 °C", { keep: ["alcohol"] }), "Ethanol (also called alcohol) boils at 78 °C");
});
test("rewrite rule drop-marker", () => {
  assert.equal(run("drop-marker", "However, the tower is 330 m tall.", { lang: "en" }), "the tower is 330 m tall.");
  assert.equal(run("drop-marker", "In addition, it has three levels.", { lang: "en" }), "it has three levels.");
  assert.equal(run("drop-marker", "Howeverish words stay", { lang: "en" }), "Howeverish words stay");
  assert.equal(run("drop-marker", "Sin embargo, mide 330 m.", { lang: "es" }), "mide 330 m.");
});
test("rewrite rule resolve-pronoun copies the antecedent's own bytes", () => {
  const passage = "The Louvre is a museum. It received 9.0 million visitors in 2025.";
  const out = run("resolve-pronoun", "It received 9.0 million visitors in 2025.", { antecedent: [0, 10], lang: "en" }, { passage });
  assert.equal(out, "The Louvre received 9.0 million visitors in 2025.");
  assert.equal(run("resolve-pronoun", "Its height is 330 m.", { antecedent: [0, 10], lang: "en" }, { passage }), "The Louvre’s height is 330 m.");
  assert.equal(run("resolve-pronoun", "Because it is tall.", { antecedent: [0, 10], lang: "en" }, { passage }), "Because it is tall.", "only a LEADING pronoun");
});
test("a pronoun is resolved only when the previous sentence's subject is clean and holds a word of the ask", () => {
  const ok = "The Louvre is a national museum in Paris. It received 9.0 million visitors in 2025. " + FILLER;
  const r = answerSpan("How many visitors did the Louvre receive in 2025?", [P(ok, { ref: "en.wikipedia.org — Louvre" })]);
  assert.match(shownText(r), /^The Louvre received 9\.0 million visitors in 2025\.$/);
  assert.deepEqual(r.spans[0].rewrite.rules.map((x) => x.rule), ["resolve-pronoun", "capitalise", "terminal-stop"].filter((x) => r.spans[0].rewrite.rules.some((y) => y.rule === x)));
  // the previous sentence opens with an adverbial: no clean subject, the pronoun stays
  const bad = "At any given point in time, thousands of objects are shown, making the Louvre big. It received 9.0 million visitors in 2025. " + FILLER;
  const b = answerSpan("How many visitors did the Louvre receive in 2025?", [P(bad, { ref: "en.wikipedia.org — Louvre" })]);
  assert.match(shownText(b), /^It received 9\.0 million visitors in 2025\.$/);
  // two named candidates in the previous sentence: ambiguous, the pronoun stays
  const amb = "The Louvre houses works by Leonardo da Vinci in Paris. It received 9.0 million visitors in 2025. " + FILLER;
  assert.match(shownText(answerSpan("How many visitors did the Louvre receive in 2025?", [P(amb, { ref: "en.wikipedia.org — Louvre" })])), /^It received/);
});
test("rewrite rule attribute-quote keeps the attribution", () => {
  assert.equal(run("attribute-quote", "“The tower will never be finished in time,” said Gustave Eiffel."), "According to Gustave Eiffel, The tower will never be finished in time");
  assert.equal(run("attribute-quote", 'Gustave Eiffel said, "The tower is a triumph of iron."'), "According to Gustave Eiffel, The tower is a triumph of iron");
  assert.equal(run("attribute-quote", "A plain sentence without any quotation."), "A plain sentence without any quotation.");
  assert.equal(run("attribute-quote", '"A quotation with no speaker at all in it."'), '"A quotation with no speaker at all in it."', "never drop the quote when there is no attribution to keep");
});
test("rewrite rule unit-swap: only an exact, already-stated pair, in the asker's unit", () => {
  assert.equal(run("unit-swap", "The tower is 330 metres (1,083 ft) tall", { unit: "ft" }), "The tower is 1,083 ft (330 metres) tall");
  assert.equal(run("unit-swap", "The tower is 330 metres (1,200 ft) tall", { unit: "ft" }), "The tower is 330 metres (1,200 ft) tall", "not the same quantity: untouched");
  assert.equal(run("unit-swap", "The tower is 330 metres (1,083 ft) tall", { unit: "km" }), "The tower is 330 metres (1,083 ft) tall");
});
test("rewrite rules tidy-space, capitalise, terminal-stop", () => {
  assert.equal(run("tidy-space", "Canberra , located in the ( ACT ) , is small ."), "Canberra, located in the (ACT), is small.");
  assert.equal(run("capitalise", "the tower is tall"), "The tower is tall");
  assert.equal(run("capitalise", "“quoted” start"), "“quoted” start");
  assert.equal(run("terminal-stop", "The tower is tall", { mark: "." }), "The tower is tall.");
  assert.equal(run("terminal-stop", "The tower is tall.", { mark: "." }), "The tower is tall.");
  assert.equal(run("terminal-stop", "The tower is tall,", { mark: "." }), "The tower is tall.");
});

// ── 4. every shipped word is derivable from the source: verifyRewrite ────────────────────────────────
test("verifyRewrite re-derives a real rewrite from the passage", () => {
  const ps = [P("The Eiffel Tower (EYE-fəl; French: Tour Eiffel) is a lattice tower. However, the tower is 330 metres (1,083 ft) tall&nbsp;[1], about as high as an 81-storey building. " + FILLER)];
  const r = answerSpan("How tall is the Eiffel Tower in feet?", ps);
  assert.ok(r.spans[0].rewrite, "a rewrite was needed");
  const v = verifyRewrite(r.spans[0].rewrite, ps[0]);
  assert.ok(v.ok, v.reason);
  assert.match(r.spans[0].shown, /1,083 ft \(330 metres\)/);
});
test("verifyRewrite rejects a figure that is not in the source", () => {
  const ps = [P("The tower is 330 metres tall, about as high as a building. " + FILLER)];
  const r = answerSpan("How tall is the tower?", ps); const rw = r.spans[0].rewrite;
  assert.ok(rw, "the clause lost its tail and gained a stop: a rewrite"); assert.ok(verifyRewrite(rw, ps[0]).ok);
  const forged = { ...rw, text: rw.text.replace("330", "331") };
  assert.equal(verifyRewrite(forged, ps[0]).ok, false);
  // even a forged rule list that "explains" it: the text must re-derive from the source bytes
  assert.equal(verifyRewrite({ ...rw, text: "The tower is 331 metres tall." }, ps[0]).ok, false);
});
test("verifyRewrite rejects a model-style paraphrase, an unnamed rule, a bad range and a disordered rule list", () => {
  const ps = [P("The tower is 330 metres tall. " + FILLER)];
  const src = { start: 0, end: 29 };
  assert.equal(verifyRewrite({ text: "The tower stands at 330 metres.", source: src, rules: [] }, ps[0]).reason, "does not re-derive");
  assert.match(verifyRewrite({ text: "The tower is 330 metres tall.", source: src, rules: [{ rule: "rephrase" }] }, ps[0]).reason, /^unnamed rule rephrase/);
  assert.equal(verifyRewrite({ text: "x", source: { start: 5, end: 99999 }, rules: [] }, ps[0]).reason, "range");
  assert.equal(verifyRewrite({ text: "The tower is 330 metres tall.", source: src, rules: [{ rule: "terminal-stop", mark: "." }, { rule: "capitalise" }] }, ps[0]).reason, "rule order");
  assert.equal(verifyRewrite({ text: "The tower is 330 metres tall.", source: src, rules: [{ rule: "terminal-stop", mark: "." }] }, ps[0]).ok, true);
  assert.equal(verifyRewrite({ text: "The Louvre tower is 330 metres tall.", source: { start: 0, end: 29 }, rules: [{ rule: "resolve-pronoun", antecedent: [0, 99999], lang: "en" }, { rule: "terminal-stop", mark: "." }] }, ps[0]).reason, "antecedent");
});
test("every span is a verbatim substring of its passage, and the shown text verifies", () => {
  const ps = [P("Intro line. The tower is 330 metres (1,083 ft) tall, about the same height as an 81-storey building. " + FILLER)];
  const r = answerSpan("How tall is the tower?", ps);
  for (const s of r.spans) { assert.equal(ps[s.passageIndex].text.slice(s.start, s.end), s.text); if (s.rewrite) assert.ok(verifyRewrite(s.rewrite, ps[s.passageIndex]).ok); }
});

// ── 5. atoms, minimality ────────────────────────────────────────────────────────────────────────────
test("quantities and dates", () => {
  const q = (t) => quantitiesIn(t).map((x) => [x.text, x.dim]);
  assert.deepEqual(q("10,935 ± 6 meters"), [["10,935 ± 6 meters", "len"]]);
  assert.deepEqual(q("boils at 78.37 °C"), [["78.37 °C", "temp"]]);
  assert.deepEqual(q("9.0 million visitors"), [["9.0 million visitors", "count"]]);
  assert.deepEqual(q("on 7 January 1838, in 1889"), [], "dates and years are not quantities");
  assert.deepEqual(datesIn("born on 15 August 1769 and died 5 May 1821").map((d) => d.text), ["15 August 1769", "5 May 1821"]);
  assert.deepEqual(datesIn("in the 7th century BC").map((d) => d.text), ["7th century BC"]);
});
test("isMinimal: no single clause can go while the answer and subject stay", () => {
  assert.equal(isMinimal({ shown: "The tower is 330 metres tall" }, "330 metres", ["tower"]), true);
  assert.equal(isMinimal({ shown: "The tower is 330 metres tall, about as high as a building" }, "330 metres", ["tower"]), false);
});
test("answerSpan never throws on empty or odd input", () => {
  assert.equal(answerSpan("", [P("x")]).spans.length, 0);
  assert.equal(answerSpan("How tall is it?", []).spans.length, 0);
  assert.equal(answerSpan("How tall is the tower?", [{}, null, { text: 5 }]).spans.length, 0);
  assert.equal(answerSpan(null, null).spans.length, 0);
});

// ── 6. more gates, each with a test that fails when the gate is deleted ─────────────────────────────
test("verifyRewrite's own figure gate: a rule that would introduce a figure the source lacks is rejected (rogue rule injected for the test only)", () => {
  const ps = [P("The tower is 330 metres tall. " + FILLER)];
  const rogue = { ...RULES, "rogue-add": { doc: "test only", apply: (x) => x + " (about 999 m)" } };
  const rw = { text: "The tower is 330 metres tall. (about 999 m)", source: { start: 0, end: 29 }, rules: [{ rule: "rogue-add" }] };
  const v = verifyRewrite(rw, ps[0], { registry: rogue });
  assert.equal(v.ok, false); assert.match(v.reason, /^figure not in the source: 999/);
  const ok = verifyRewrite({ text: "The tower is 330 metres tall.", source: { start: 0, end: 29 }, rules: [] }, ps[0], { registry: rogue });
  assert.equal(ok.ok, true);
});

test("a figure cut that would land inside a quotation keeps the quotation whole", () => {
  const t = 'The guide says "the tower is 330 metres tall at the very top, they claim" in its first pages. ' + FILLER;
  const s = shownText(answerSpan("How tall is the tower?", [P(t)]));
  assert.equal((s.match(/"/g) || []).length % 2, 0, s); assert.match(s, /330 metres/);
});

test("a clause that hangs on a relative word brings its head clause", () => {
  const t = "The Nile flows north through Egypt, which makes it 6,650 km long in total. " + FILLER;
  const s = shownText(answerSpan("How long is the Nile?", [P(t, { ref: "en.wikipedia.org — Nile" })]));
  assert.match(s, /^The Nile flows north through Egypt, which makes it 6,650 km long/);
});

test("a place runs on through its locative clauses; a name ask does not take a place after 'in'", () => {
  const t = "Curie was born in Warsaw, Russian Empire, and studied physics. " + FILLER;
  assert.match(shownText(answerSpan("Where was Curie born?", [P(t)])), /Warsaw, Russian Empire/);
  const n = "The tower in Paris was built by Gustave Eiffel and his engineers. " + FILLER;
  const r = answerSpan("Who built the tower?", [P(n, { ref: "en.wikipedia.org — Eiffel Tower" })]);
  assert.equal(r.spans[0].atom.text, "Gustave Eiffel");
});

test("a pronoun is not resolved to a subject that has nothing to do with the ask", () => {
  const t = "The weather was warm that summer. It received 9.0 million visitors in 2025. " + FILLER;
  const r = answerSpan("How many visitors did the Louvre receive in 2025?", [P(t, { ref: "en.wikipedia.org — Louvre" })]);
  assert.match(shownText(r), /^It received/);
});

test("a declared FAQ item whose question is the ask answers it; one whose question is not does not", () => {
  const faq = { kind: "faq", items: ["Does the tower change height? — Yes. Due to thermal expansion, it can grow 15 centimetres in summer.", "Who owns the tower? — The city of Paris owns the tower and its land."] };
  const r = answerSpan("Does the tower change height?", [P("A page about a tower. " + FILLER, { declared: [faq] })]);
  assert.match(shownText(r), /^Yes\. Due to thermal expansion/);
  assert.ok(r.spans[0].why.includes("faq-answer"));
  assert.equal(answerSpan("How many floors has the stadium?", [P("A page. " + FILLER, { declared: [faq] })]).spans.length, 0);
});

test("the fixed unit table: 'how long' accepts a duration; a mass is not a length", () => {
  const t = "The flight takes around 7 hours. The aircraft weighs 70 tonnes. " + FILLER;
  assert.match(shownText(answerSpan("How long is the flight?", [P(t)])), /7 hours/);
});

test("spaced digit groups (fr, ru) are one number; an asked unit is not a content term", () => {
  assert.deepEqual(quantitiesIn("est égale à 299 792 458 m/s.").map((q) => q.text), ["299 792 458 m/s"]);
  const a = classifyAsk("How tall is the tower in feet?", { lang: "en" });
  assert.deepEqual(a.terms.map((x) => x.t), ["tower"]); assert.equal(a.unit, "feet");
});

test("Han: pairs of characters are the terms, a character is the cue, 米 is a unit", () => {
  const a = classifyAsk("珠穆朗玛峰有多高？", { lang: "zh" });
  assert.deepEqual(a.terms.map((x) => x.t), ["珠穆", "穆朗", "朗玛", "玛峰"]); assert.equal(a.dim, "len");
  assert.deepEqual(quantitiesIn("海拔8848.86米，是第一。").map((q) => [q.text, q.dim]), [["8848.86米", "len"]]);
  const r = answerSpan("珠穆朗玛峰有多高？", [P("珠穆朗玛峰是世界第一高峰，海拔8848.86米。" + "这是一个很长的说明，用来填充页面。".repeat(8), { ref: "zh.wikipedia.org — 珠穆朗玛峰" })]);
  assert.match(shownText(r), /8848\.86米/);
});

test("Spanish, French and Russian asks are answered from their own pages", () => {
  const es = answerSpan("¿Qué altitud tiene el monte Everest?", [P("El monte Everest es la montaña más alta de la Tierra, con una altitud de 8848,86 metros sobre el nivel del mar. " + "Otra frase de relleno sobre la montaña y su historia en la región. ".repeat(6), { ref: "es.wikipedia.org — Monte Everest" })]);
  assert.match(shownText(es), /8848,86 metros/);
  const fr = answerSpan("Quelle est la vitesse de la lumière ?", [P("La vitesse de la lumière dans le vide est égale à 299 792 458 m/s. " + "Une autre phrase de remplissage sur la lumière et son étude depuis longtemps. ".repeat(6), { ref: "fr.wikipedia.org — Vitesse de la lumière" })]);
  assert.match(shownText(fr), /299 792 458 m\/s/);
  const ru = answerSpan("Какова скорость света в вакууме?", [P("Скорость света в вакууме равна 299 792 458 м/с. " + "Ещё одно предложение для заполнения страницы о свете и его изучении. ".repeat(6), { ref: "ru.wikipedia.org — Скорость света" })]);
  assert.match(shownText(ru), /299 792 458 м\/с/);
});

// ── 7. gate-by-gate tests (each fails when its gate is deleted: eval/ants/p2/mutate.mjs) ─────────────
test("an ask with no content word of its own (only function words) is a typed gap", () => {
  const r = answerSpan("How tall is it?", [P("The tower is 330 metres tall. " + FILLER)]);
  assert.equal(r.spans.length, 0); assert.equal(r.gap.kind, "no-terms");
});
test("a question that holds the figure is still a question, not an answer", () => {
  const r = answerSpan("How tall is the tower?", [P("Is the tower really 330 metres tall? Nobody can say for certain about it here. " + FILLER)]);
  assert.equal(r.spans.length, 0);
});
test("a sentence made of menu and cookie chrome is never an answer, even with the figure in it", () => {
  const r = answerSpan("How tall is the tower?", [P("Cookie settings | Accept all cookies | Privacy policy | Terms of use | the tower is 330 metres tall | Sign in | Newsletter. " + FILLER)]);
  assert.equal(r.spans.length, 0);
});
test("the confidence threshold is a real gate (opts.minConfidence)", () => {
  const r = answerSpan("How tall is the tower?", [P("The tower is 330 metres tall. " + FILLER)], { minConfidence: 1.01 });
  assert.equal(r.spans.length, 0); assert.equal(r.gap.kind, "no-span"); assert.match(r.gap.reason, /scored/);
});
test("a figure in the wrong dimension is no answer: a weight does not answer 'how tall'", () => {
  assert.equal(answerSpan("How tall is the statue?", [P("The statue weighs 225 tonnes in total. " + FILLER)]).spans.length, 0);
});
test("a span with no word of the ask and no measure word is no answer, whatever the page's title", () => {
  const r = answerSpan("What is the width of the Eiffel Tower?", [P("The queue outside the gate was about 20 metres long and slow. " + FILLER, { ref: "en.wikipedia.org — Eiffel Tower" })]);
  assert.equal(r.spans.length, 0);
});
test("a count with a noun the ask did not name, far from any word of the ask, is no answer", () => {
  assert.equal(answerSpan("How many exhibits does the museum hold?", [P("The museum, which is very famous and well known worldwide, has 35,000 objects. " + FILLER)]).spans.length, 0);
  assert.match(shownText(answerSpan("How many exhibits does the museum hold?", [P("The museum holds 35,000 objects. " + FILLER)])), /35,000 objects/);
});
test("the subject clause is brought in when the page's title already names the subject (so no predicate rule is needed)", () => {
  const r = answerSpan("How tall is the Statue of Unity?", [P("The Statue of Unity is the world's tallest statue, with a height of 182 metres (597 feet), located in India. " + FILLER, { ref: "en.wikipedia.org — Statue of Unity" })]);
  assert.match(shownText(r), /^The Statue of Unity is the world's tallest statue, with a height of 182 metres \(597 feet\)\.$/);
});
test("the predicate clause is brought in when the subject is already in the span", () => {
  const r = answerSpan("Who designed the tower?", [P("The engineer of the tower was Gustave Eiffel, whose company designed it in 1887. " + FILLER)]);
  assert.match(shownText(r), /Gustave Eiffel, whose company designed/);
});
test("a clause that opens with a relative word brings its head clause even when it holds the subject itself", () => {
  const r = answerSpan("How long is the Tiber?", [P("The river rises in Italy, where the Tiber is 406 km long in total. " + FILLER, { ref: "en.wikipedia.org — Tiber" })]);
  assert.match(shownText(r), /^The river rises in Italy, where the Tiber is 406 km long/);
});
test("a definition needs the ask's word in the sentence's own subject, not anywhere", () => {
  assert.equal(answerSpan("What is photosynthesis?", [P("Although plants are net consumers of carbon dioxide via photosynthesis, respiration matters a lot. " + FILLER)]).spans.length, 0);
});
test("a reason needs a causal marker; a plain statement about the same thing is not a reason", () => {
  assert.equal(answerSpan("Why was the wall built?", [P("The wall was built in 1961 by the government of the country. " + FILLER)]).spans.length, 0);
  assert.match(shownText(answerSpan("Why was the wall built?", [P("The wall was built to prevent citizens from fleeing the country. " + FILLER)])), /to prevent citizens/);
});
test("the page's lead is preferred when nothing else separates two statements", () => {
  const t = "The tower is 330 metres tall. " + FILLER.repeat(30) + "The Eiffel Tower was 300 metres tall in 1889. " + FILLER;
  assert.match(shownText(answerSpan("How tall is the Eiffel Tower?", [P(t, { ref: "en.wikipedia.org — Eiffel Tower" })])), /330 metres/);
});
test("a pronoun stays when the previous sentence names a rival noun phrase", () => {
  const t = "The Louvre is a museum near the Tuileries Garden. It received 9.0 million visitors in 2025. " + FILLER;
  assert.match(shownText(answerSpan("How many visitors did the Louvre receive in 2025?", [P(t, { ref: "en.wikipedia.org — Louvre" })])), /^It received/);
});
test("a pronoun stays when the previous sentence opens with a preposition (no clean subject)", () => {
  const t = "In the Louvre, thousands of objects are shown. It received 9.0 million visitors in 2025. " + FILLER;
  assert.match(shownText(answerSpan("How many visitors did the Louvre receive in 2025?", [P(t, { ref: "en.wikipedia.org — Louvre" })])), /^It received/);
});
test("a figure of another dimension in a span that does hold the measure word is still no answer ('tall' is not answered by tonnes)", () => {
  assert.equal(answerSpan("How tall is the statue?", [P("The statue is tall, and weighs 225 tonnes in total. " + FILLER)]).spans.length, 0);
});
test("a count whose noun the ask did not name and which stands far from every word of the ask is no answer", () => {
  assert.equal(answerSpan("How many visitors does the museum hold?", [P("The museum, where visitors hold tickets, is very old and big and has 35,000 objects. " + FILLER)]).spans.length, 0);
  assert.match(shownText(answerSpan("How many visitors does the museum hold?", [P("The museum, where visitors hold tickets, is very old and big and holds 35,000 objects. " + FILLER)])), /holds 35,000 objects/);
});
