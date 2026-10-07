// eval/ants/c8/primary-v2.test.mjs — C8: the new rules of the primary-page gate, each with a positive and a negative case, and the 20 frozen decoys (decoys.json) as a corpus of must-reject lines.
// PRIMARY_MODULE overrides the module under test (eval/ants/c8/mutate.mjs runs this file against a copy with one rule deleted: every rule must make a test here fail).
//   node --test eval/ants/c8/primary-v2.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { functionWordsOf } from "../../../fold-chat-snippets.js";
import { verifyNarration } from "../../../fold-chat-provenance.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const P = await import(process.env.PRIMARY_MODULE ? pathToFileURL(path.resolve(process.env.PRIMARY_MODULE)).href : "./primary-v2.mjs");
const { findPrimary, assertsClaim, spellFold, figuresGate, candidatesV2, contextStems, dropReason, mergeProvenance } = P;
const FW = functionWordsOf("en");
const ok = (claim, sentence, o = {}) => assertsClaim(claim, sentence, { fw: FW, indexHost: "en.wikipedia.org", ...o });
const accepts = (claim, sentence, o) => assert.equal(ok(claim, sentence, o).ok, true, `should accept: ${sentence} => ${JSON.stringify(ok(claim, sentence, o))}`);
const rejects = (claim, sentence, o) => assert.equal(ok(claim, sentence, o).ok, false, `should reject: ${sentence}`);
const ctx = (url, title) => contextStems({ url, title }, FW);

// ─────────────── (a) spelling folded ───────────────
test("a: spellFold maps British and American spellings to one form, and leaves ordinary words alone", () => {
  assert.equal(spellFold("metres"), spellFold("meters"));
  assert.equal(spellFold("kilometre"), spellFold("kilometer"));
  assert.equal(spellFold("centre"), spellFold("center"));
  assert.equal(spellFold("colour"), spellFold("color"));
  assert.equal(spellFold("neighbours"), spellFold("neighbors"));
  assert.equal(spellFold("organisation"), spellFold("organization"));
  assert.equal(spellFold("analyse"), spellFold("analyze"));
  for (const w of ["hour", "four", "your", "tour", "flour", "more", "figure", "rise", "size", "prize", "seize", "wise", "course", "Paris", "2022"]) assert.equal(spellFold(w), w, w);
});
test("a: a claim in 'metres' is satisfied by 'meters' (and the reverse), 'colour' by 'color'", () => {
  accepts("The Eiffel Tower is 330 metres tall.", "The Eiffel Tower is 330 meters tall.");
  accepts("The Eiffel Tower is 330 meters tall.", "The Eiffel Tower is 330 metres tall.");
  accepts("Mount Everest is 8,848.86 metres tall.", "Mount Everest is 8,848.86 meters tall.");
  accepts("The flag has a red colour band of 12 inches.", "The flag has a red color band of 12 inches.");
});
test("a: the fold does not make different words equal", () => {
  rejects("The tour lasts 4 hours.", "The tower lasts 4 hours.");
  rejects("The Eiffel Tower is 330 metres tall.", "The Eiffel Tower is 330 meters wide.");
});

// ─────────────── (b) the narrow slack ───────────────
const BONES = "An adult human has 206 bones.";
test("b: a lowercase subject qualifier may be absent when every figure, the predicate and a subject anchor are there", () => {
  const r = ok(BONES, "Adults have between 206 and 213 bones.");
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.slack, ["human"]);
});
test("b: the slack never forgives a NAME (a proper name of the subject is entity identity)", () => {
  rejects("The Eiffel Tower is 330 metres tall.", "The Canton Tower is 330 metres tall.");
  rejects("The United States Senate has 100 senators.", "The Roman Senate has 100 senators.");
  rejects("The Eiffel Tower is 330 metres tall.", "The Tower is 330 metres tall.");
});
test("b: the slack needs a figure, the predicate, an anchor, at most two forgiven stems, and a clean sentence subject", () => {
  rejects("An adult human is tall.", "Adults are tall.");                                                                // no figure in the claim
  rejects(BONES, "Adults have 206 muscles.");                                                                          // the predicate stem (bones) is absent
  rejects(BONES, "It has 206 bones.");                                                                                 // no subject anchor present
  rejects("The old adult human male has 206 bones.", "The adult has 206 bones.");                                       // three forgiven stems
  rejects(BONES, "Adult horses have 206 bones.");                                                                      // the sentence's subject names something else
  rejects(BONES, "Adults have between 207 and 213 bones.");                                                            // the figure is still required
});

// ─────────────── equivalents (declared) ───────────────
test("eq: win~award, tall~height, founded~began, senators~members; a different word is not an equivalent", () => {
  accepts("Albert Einstein won the 1921 Nobel Prize in Physics.", "The Nobel Prize in Physics 1921 was awarded to Albert Einstein.");
  accepts("The Eiffel Tower is 330 metres tall.", "The Eiffel Tower reached a height of 330 metres.");
  accepts("The United Nations was founded on 24 October 1945.", "The United Nations officially began on 24 October 1945.");
  accepts("The United States Senate has 100 senators.", "The United States Senate has 100 members.");
  rejects("The United States Senate has 100 senators.", "The United States Senate has 100 committees.");
  rejects("Albert Einstein won the 1921 Nobel Prize in Physics.", "Albert Einstein lost the 1921 Nobel Prize in Physics.");
});

// ─────────────── names the sentence leaves out are supplied by the page's own identity ───────────────
const SEN = "The United States Senate has 100 senators.";
test("supply: a name the sentence leaves out is supplied by the page's own title, and only for a sentence that names its own subject", () => {
  const c = ctx("https://www.usa.gov/branches-of-government", "U.S. Senate | USAGov");
  accepts(SEN, "The Senate has 100 members, two from each state.", { context: c });
  rejects(SEN, "The Senate has 100 members, two from each state.", { context: ctx("https://example.com/x", "A page about nothing") });
  rejects(SEN, "The Roman Senate had 100 senators.", { context: ctx("https://example.org/rome", "United States Senate and the Roman Senate") });   // foreign subject word
  rejects("The Mona Lisa is on display at the Louvre.", "This is how the royal collections that the Louvre has displayed since the Revolution grew.", { context: ctx("https://www.paristickets.com/mona-lisa", "Mona Lisa tickets") });   // no named subject
  rejects("The Mona Lisa is on display at the Louvre.", "Since 2005, the Mona Lisa has been displayed in the middle of the room.", { context: ctx("https://www.paristickets.com/louvre-mona-lisa", "Louvre Museum Mona Lisa tickets") });   // a name in the PREDICATE is never supplied
  rejects("Canberra is the capital of Australia.", "Canberra is the capital.", { context: ctx("https://www.example.gov.au/about", "About Australia") });
  rejects("Harvard University was founded in 1636.", "1636: First College in American colonies founded.", { context: ctx("https://www.harvard.edu/about/history", "History timeline - Harvard University") });   // no subject, no supply
});
test("f: U.S. / US / USA is the United States", () => {
  accepts(SEN, "The U.S. Senate has 100 senators.");
  accepts(SEN, "The US Senate has 100 senators.");
  rejects(SEN, "The Senate has 100 senators.");
});

// ─────────────── (c) a figure in a NAME binds to the name ───────────────
test("c: 'Apollo 11' is a name: the sentence must say Apollo 11, and a bare 11 elsewhere does not count", () => {
  const claim = "Apollo 11 landed on the Moon on 20 July 1969.";
  accepts(claim, "Apollo 11 landed on the Moon on July 20, 1969.");
  accepts(claim, "On July 20, 1969, Apollo-11 landed on the Moon.");
  rejects(claim, "Apollo 17 spent 11 days in space and landed on the Moon on 20 July 1969.");
  rejects(claim, "Apollo 12 landed on the Moon on 19 November 1969.");
  rejects(claim, "Apollo landed on the Moon on 20 July 1969.");
  assert.deepEqual(figuresGate(claim, "Apollo 11 landed on the Moon on July 20, 1969.", FW).bound, ["Apollo 11"]);
  assert.equal(figuresGate("The tower has 11 floors.", "The tower has 11 floors.", FW).bound.length, 0, "a quantity is not a name figure");
  assert.equal(figuresGate("It was founded on 24 October 1945.", "Founded on 24 October 1945.", FW).bound.length, 0, "a month before a year is not a name");
  accepts("The Charter came into force on October 24 1945.", "The Charter came into force on 24 October 1945.");     // October 24 is a date, not a name with a figure
});

// ─────────────── (d) unit equivalence ───────────────
test("d: a quantity in another unit within 1% is the same figure; a different quantity, or the same number in another unit, is not", () => {
  accepts("The Eiffel Tower is 330 metres tall.", "The Eiffel Tower is 1,083 feet tall.");
  accepts("The Moon is about 384,400 kilometres from Earth.", "The Moon is about 238,855 miles from Earth.");
  accepts("The Moon is about 384,400 kilometres from Earth.", "The Moon is 238,855 miles (384,400 kilometers) from Earth.");
  accepts("Mount Everest is 8,848.86 metres tall.", "Mount Everest is 29,031.7 feet tall.");
  accepts("The Moon is about 384,400 kilometres from Earth.", "The Moon is about 238,900 miles from Earth.");        // 384,472 km: a rounded conversion, 0.02% off, outside the claim's own precision but inside 1%
  rejects("The Eiffel Tower is 330 metres tall.", "The Eiffel Tower is 1,063 feet tall.");                         // 324 m: 1.8% off
  rejects("The Eiffel Tower is 330 metres tall.", "The Eiffel Tower is 324 metres tall.");
  rejects("The Moon is about 384,400 kilometres from Earth.", "The Moon is about 384,400 miles from Earth.");        // the same number, another unit
  rejects("The Moon is about 384,400 kilometres from Earth.", "The Moon is about 238,855 kilometres from Earth.");
  rejects("The Moon is about 384,400 kilometres from Earth.", "The Moon is about 363,300 kilometres from Earth.");
  rejects("The Eiffel Tower is 330 metres tall.", "The Eiffel Tower is 330 kilograms tall.");                        // not even the same dimension
});

// ─────────────── what stays: assertion, figures, mirrors ───────────────
test("kept: the assertion gate (denial, hedge, question, negation) and every-figure are unchanged", () => {
  rejects("Emmanuel Macron is the president of France.", "Emmanuel Macron is not the president of France.");
  rejects("Canberra is the capital of Australia.", "Canberra is not the capital of Australia, contrary to popular belief.");
  rejects("Canberra is the capital of Australia.", "Some people say Canberra is the capital of Australia.");
  rejects("Canberra is the capital of Australia.", "Is Canberra the capital of Australia?");
  rejects("Marie Curie died on 4 July 1934.", "Marie Curie died on 4 July 1943.");
  accepts("Canberra is the capital of Australia.", "Canberra is the capital city of Australia.");
});
test("kept: mirror / encyclopedia / farm hosts are dropped unread", () => {
  for (const h of ["www.britannica.com", "www.wikiwand.com", "dbpedia.org", "eiffel.fandom.com", "www.quora.com", "en.everybodypedia.org", "www.geeksforgeeks.org", "grokipedia.com"]) assert.ok(dropReason("https://" + h + "/x", "en.wikipedia.org"), h);
  assert.equal(dropReason("https://www.nasa.gov/x", "en.wikipedia.org"), null);
});

// ─────────────── (e) the candidate generator ───────────────
const CLAIM = "The Eiffel Tower is 330 metres tall.";
const FILL = "Visit the official site for opening times, ticket prices and accessibility information before you plan your trip to the monument.";
const pointing = (needle) => async (messages) => { const lines = String(messages[1].content).split("\n").filter((l) => /^\[\d+\]/.test(l)); const hit = lines.find((l) => l.includes(needle)); return hit ? /^\[(\d+)\]/.exec(hit)[1] : "NONE"; };
const run = (text, point, o = {}) => findPrimary({ claim: CLAIM, sentence: CLAIM, indexHost: "en.wikipedia.org", fw: FW, search: async () => [{ url: "https://www.eiffel-museum.org/en/the-monument", title: "The Eiffel Tower" }], readPage: async () => text, point, limits: { prefilter: false, ...o } });

test("e: a heading plus the sentence under it is offered as ONE verbatim slice, and the entity comes from the heading", async () => {
  const text = [FILL, "The Eiffel Tower", "It is 330 metres tall.", FILL].join("\n");
  const cs = candidatesV2(CLAIM, [{ text, url: "https://www.eiffel-museum.org/x", title: "x" }], FW);
  const pair = cs.find((c) => /Eiffel Tower\nIt is 330/.test(c.text));
  assert.ok(pair, JSON.stringify(cs.map((c) => c.text)));
  assert.equal(text.slice(pair.start, pair.end), pair.text);
  const r = await run(text, pointing("330"));
  assert.equal(r.passages.length, 1);
  const p = r.pointers[0];
  assert.match(p.quote, /Eiffel Tower It is 330 metres tall\./);
  assert.ok(verifyNarration(mergeProvenance({ pointers: [], ps: [], calls: 0, claim: CLAIM }, r, { indexHost: "en.wikipedia.org" }).narr, r.passages, r.pointers, { indexHost: "en.wikipedia.org" }).ok !== false);
});
test("e: a pair whose heading names ANOTHER entity does not lend its entity", async () => {
  const text = [FILL, "Canton Tower", "It is 330 metres tall.", FILL].join("\n");
  const r = await run(text, pointing("330"));
  assert.equal(r.passages.length, 0, JSON.stringify(r.trail));
});
test("e: a short fragment or list item that carries the figure is offered even when provenance's own salience list is full", async () => {
  const noisy = Array.from({ length: 9 }, (_, i) => `The Eiffel Tower is a tall tower of ${300 + i} metres, said guide number ${i}.`);
  const text = [FILL, ...noisy, "Eiffel Tower height 330 metres", FILL].join("\n");
  const r = await run(text, pointing("Eiffel Tower height 330 metres"));
  assert.equal(r.passages.length, 1, JSON.stringify(r.trail));
  assert.match(r.pointers[0].quote, /^Eiffel Tower height 330 metres$/);
});
test("e: heading/fragment/pair candidates are offered only from a classified host (government, education, agency, organisation); an unclassified host keeps sentences only", async () => {
  const text = [FILL, "The Eiffel Tower", "It is 330 metres tall.", FILL].join("\n");
  const on = candidatesV2(CLAIM, [{ text, url: "https://www.eiffel-museum.org/x", title: "x" }], FW);
  const off = candidatesV2(CLAIM, [{ text, url: "https://www.eiffel-tickets.com/x", title: "x" }], FW);
  assert.ok(on.some((c) => /Eiffel Tower\nIt is 330/.test(c.text)));
  assert.ok(!off.some((c) => /Eiffel Tower\nIt is 330/.test(c.text)));
  const r = await findPrimary({ claim: CLAIM, sentence: CLAIM, indexHost: "en.wikipedia.org", fw: FW, search: async () => [{ url: "https://www.eiffel-tickets.com/x", title: "x" }], readPage: async () => text, point: pointing("330"), limits: { prefilter: false } });
  assert.equal(r.passages.length, 0);
});
test("e: a fragment or a pair that does not carry the claim's figure is not offered", () => {
  const noisy = Array.from({ length: 9 }, (_, i) => `The Eiffel Tower is a tall tower of ${300 + i} metres, said guide number ${i}.`);
  const text = [FILL, ...noisy, "Eiffel Tower height 324 metres", "Eiffel Tower", "It is 324 metres tall.", FILL].join("\n");
  const cs = candidatesV2(CLAIM, [{ text, url: "https://www.eiffel-museum.org/x", title: "x" }], FW);
  assert.ok(!cs.some((c) => c.text === "Eiffel Tower height 324 metres"), "fragment with another figure");
  assert.ok(!cs.some((c) => /^Eiffel Tower\nIt is 324/.test(c.text)), "pair with another figure");
});

// ─────────────── the pre-filter and the ordering ───────────────
test("prefilter: the numbered list the model sees holds only sentences that pass the gate; off, the model is shown all and a wrong pick is withdrawn", async () => {
  const text = [FILL, "The Eiffel Tower is 324 metres tall including its antenna of the old measure.", "The Eiffel Tower is 330 metres tall, about the height of an 81-storey building.", FILL].join("\n");
  const seen = [];
  const first = async (messages) => { seen.push(String(messages[1].content)); return "1"; };
  const on = await run(text, first, { prefilter: true });
  assert.equal(on.passages.length, 1, JSON.stringify(on.trail));
  assert.ok(!/324/.test(seen[0]), "a sentence that fails the gate is not shown");
  const off = await run(text, async (messages) => { seen.push("off:" + messages[1].content); return "1"; }, { prefilter: false });
  assert.ok(seen.some((s) => s.startsWith("off:") && /324/.test(s)), "off: the model is shown everything");
  assert.equal(off.passages.length, 0, "off: the first numbered sentence was the wrong one and the pick is checked, not believed");
});
test("prefilter: a declarative sentence is listed before a heading that happens to carry the figure", async () => {
  const text = [FILL, "Eiffel Tower 330 metres tall", FILL, "The Eiffel Tower is 330 metres tall, as the engineers confirmed in 2022.", FILL].join("\n");
  const r = await run(text, async () => "1", { prefilter: true });
  assert.equal(r.passages.length, 1);
  assert.match(r.pointers[0].quote, /as the engineers confirmed/);
});

// ─────────────── the model still only points; a pick is checked ───────────────
test("a model that points at a decoy is not believed (worst-case pointer), whichever way the page is built", async () => {
  const text = [FILL, "The Eiffel Tower is 324 metres tall.", FILL].join("\n");
  assert.equal((await run(text, pointing("324"), { prefilter: false })).passages.length, 0);
  assert.equal((await run(text, async () => "1", { prefilter: true })).passages.length, 0);
});

// ─────────────── the 20 frozen decoys: every one rejected at the gate, in both wordings ───────────────
const corpus = JSON.parse(fs.readFileSync(path.join(HERE, "../primary-corpus.json"), "utf8"));
const D = JSON.parse(fs.readFileSync(path.join(HERE, "decoys.json"), "utf8"));
test("the 20 frozen decoys (wrong figure, wrong entity, negation, outdated holder) are all rejected, in both claim wordings", () => {
  assert.equal(D.decoys.length, 20);
  const bad = [];
  for (const d of D.decoys) {
    const c = corpus.claims.find((x) => x.id === d.claimId);
    const text = (d.heading ? d.heading + " " : "") + d.sentence;
    const context = ctx("https://www." + d.host + "/page", d.title);
    for (const claim of [c.claim, c.claimLean]) if (ok(claim, text, { context }).ok) bad.push(d.id + " <- " + claim);
  }
  assert.deepEqual(bad, []);
});
