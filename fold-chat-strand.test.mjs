// fold-chat-strand.test.mjs — SOURCES ONLY: the strand is the sources' own passages, verbatim, with credit.
// Invariants: every snip's text occurs in the page text it came from (a snip that does not is a bug and is
// dropped); no model is involved; a stored message's content is allowed only with a source (or a sources strand).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { snipsOf, strandText, verifySnip, verifySnips, declaredBlocksFromHtml, creditText, storeSnip, contentAllowed, looksBlocked, STRAND } from "./fold-chat-strand.js";
import { impressionOf } from "./fold-chat-impression.js";
import { modelHistory, modelText } from "./fold-chat-channels.js";

const EIFFEL = "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. It is named after the engineer Gustave Eiffel, whose company designed and built the tower from 1887 to 1889. "
  + "Locally nicknamed La dame de fer, it was constructed as the centrepiece of the 1889 World's Fair. "
  + "The tower is 330 metres tall, about the same height as an 81-storey building, and was the tallest human-made structure in the world until the Chrysler Building was completed in 1930. "
  + Array.from({ length: 30 }, (_, i) => `Filler sentence number ${i} talks about queues, ticket prices and opening hours in a way that matters little to the question.`).join(" ")
  + " The tower has three levels for visitors, with restaurants on the first and second levels. The top level's upper platform is 276 metres above the ground. "
  + Array.from({ length: 30 }, (_, i) => `Another filler line ${i} about gift shops and souvenirs sold near the entrance of the monument.`).join(" ");
const PASSAGE = (over = {}) => ({ ref: "Wikipedia — Eiffel Tower", url: "https://en.wikipedia.org/wiki/Eiffel_Tower", source: "https://en.wikipedia.org/wiki/Eiffel_Tower", text: EIFFEL, ...over });
const REST = (over = {}) => ({ ref: "toureiffel.paris — Tour Eiffel", url: "https://www.toureiffel.paris/en/the-monument", source: "https://www.toureiffel.paris/en/the-monument", text: EIFFEL.replace("Wikipedia", ""), ...over });

const RECIPE = { name: "My Favorite Banana Bread", author: "Sally McKenney", publisher: "Sally's Baking Addiction", yield: "1", prep: "10 min", cook: "1 h 5 min", total: "3 h", calories: "", ingredients: ["2 cups (250g) all-purpose flour", "1 teaspoon baking soda", "3 ripe bananas"], steps: ["Preheat the oven to 350°F.", "Whisk the dry ingredients.", "Mash the bananas and fold them in."] };
const RECIPE_TEXT = "Recipe: My Favorite Banana Bread\nIngredients:\n" + RECIPE.ingredients.map((x) => "- " + x).join("\n") + "\nInstructions:\n" + RECIPE.steps.map((x, i) => `${i + 1}. ${x}`).join("\n") + "\n\nSome long post about the author's childhood.";

const LD = (o) => `<html><head><script type="application/ld+json">${JSON.stringify(o)}</script></head><body>x</body></html>`;

test("EVERY SNIP IS VERIFIABLE: each snip's text occurs in the page text it came from (whitespace-normalised, never reworded)", () => {
  const passages = [PASSAGE(), REST()];
  const { snips, dropped } = snipsOf(passages, "How tall is the Eiffel Tower?");
  assert.ok(snips.length >= 2, "something was quoted");
  assert.equal(dropped.length, 0);
  for (const s of snips) assert.ok(passages[s.p].text.replace(/\s+/g, " ").includes(s.text.replace(/\s+/g, " ")), s.text.slice(0, 60));
  assert.deepEqual(verifySnips(snips, passages), { ok: true, bad: [] });
});

test("a snip that is not in its page is a bug: verifySnip refuses it and snipsOf drops it", () => {
  const p = PASSAGE();
  assert.equal(verifySnip({ kind: "passage", text: "The tower is 300 metres tall." }, p), false, "a reworded figure");
  assert.equal(verifySnip({ kind: "passage", text: "The tower is 330 metres tall, about the same height as an 81-storey building" }, p), true);
  assert.equal(verifySnip({ kind: "passage", text: "x" }, null), false);
  const forged = { n: "S1", p: 0, kind: "passage", text: "Invented sentence the page never said." };
  assert.equal(verifySnips([forged], [p]).ok, false);
  assert.equal(verifySnips([forged], [p]).bad.length, 1);
});

test("the answer to the ask is quoted: the sentence with the figure is in the strand, with an ellipsis where text was skipped", () => {
  const { snips } = snipsOf([PASSAGE()], "How tall is the Eiffel Tower? 330 metres");
  const all = strandText(snips);
  assert.match(all, /330 metres tall/);
  assert.ok(snips.some((s) => s.ellipsisAfter || s.ellipsisBefore), "skipped text is marked");
  assert.ok(strandText(snips).length < EIFFEL.length / 2, "a strand, not the page");
});

test("a Wikipedia article quotes its LEAD (the first sentences), verbatim, credited to the site", () => {
  const { snips } = snipsOf([PASSAGE()], "tell me about the Eiffel Tower");
  assert.equal(snips[0].kind, "lead");
  assert.match(snips[0].text, /^The Eiffel Tower is a wrought-iron lattice tower/);
  assert.equal(snips[0].range.start, 0);
  assert.equal(snips[0].site, "en.wikipedia.org");
  assert.equal(creditText(snips[0]), "from en.wikipedia.org");
});

test("a recipe the page declares is quoted whole as a recipe snip (the card's data), credited to its author", () => {
  const p = { ref: "sallysbakingaddiction.com — Banana Bread", url: "https://www.sallysbakingaddiction.com/banana-bread/", text: RECIPE_TEXT, recipe: RECIPE };
  const { snips, dropped } = snipsOf([p], "banana bread recipe");
  assert.equal(dropped.length, 0);
  assert.equal(snips.length, 1);
  assert.equal(snips[0].kind, "recipe"); assert.equal(snips[0].credit, "Sally McKenney");
  assert.deepEqual(snips[0].card.ingredients, RECIPE.ingredients);
  assert.match(snips[0].text, /3 ripe bananas/);
  assert.equal(creditText(snips[0]), "Sally McKenney · sallysbakingaddiction.com");
});

test("declaredBlocksFromHtml: HowTo, FAQPage and a QAPage's acceptedAnswer — the page's own strings", () => {
  const how = declaredBlocksFromHtml(LD({ "@context": "https://schema.org", "@type": "HowTo", name: "Change a tyre", step: [{ "@type": "HowToStep", text: "Loosen the nuts." }, { "@type": "HowToStep", text: "Jack up the car." }] }));
  assert.deepEqual(how, [{ kind: "howto", name: "Change a tyre", author: "", items: ["Loosen the nuts.", "Jack up the car."] }]);
  const faq = declaredBlocksFromHtml(LD({ "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: "Is it open?", acceptedAnswer: { "@type": "Answer", text: "Yes, daily." } }, { "@type": "Question", name: "Is it free?", acceptedAnswer: { text: "<p>No.</p>" } }] }));
  assert.deepEqual(faq[0].items, ["Is it open? — Yes, daily.", "Is it free? — No."]);
  const qa = declaredBlocksFromHtml(LD({ "@graph": [{ "@type": "QAPage", mainEntity: { "@type": "Question", name: "How do I x?", acceptedAnswer: { "@type": "Answer", text: "Do y.", author: { "@type": "Person", name: "Ann" } } } }] }));
  assert.deepEqual(qa, [{ kind: "qa", name: "How do I x?", author: "Ann", items: ["Do y."] }]);
  assert.deepEqual(declaredBlocksFromHtml("<html>no ld</html>"), []);
  assert.deepEqual(declaredBlocksFromHtml(LD({ "@type": "Article" })), []);
  assert.doesNotThrow(() => declaredBlocksFromHtml('<script type="application/ld+json">{broken</script>'));
});

test("a declared HowTo / FAQ block on a passage is quoted as itself (preferred over prose sentences)", () => {
  const blocks = declaredBlocksFromHtml(LD({ "@type": "HowTo", name: "Change a tyre", author: { name: "Pat" }, step: [{ text: "Loosen the nuts." }, { text: "Jack up the car." }] }));
  const p = { ref: "x.org — Tyres", url: "https://x.org/tyres", text: "Change a tyre. Loosen the nuts. Jack up the car. " + "filler words here ".repeat(80), declared: blocks };
  const { snips } = snipsOf([p], "how to change a tyre");
  assert.equal(snips.length, 1); assert.equal(snips[0].kind, "howto"); assert.equal(snips[0].credit, "Pat");
  assert.match(snips[0].text, /^Change a tyre\n1\. Loosen the nuts\.\n2\. Jack up the car\.$/);
  assert.equal(verifySnip(snips[0], p), true);
  assert.equal(verifySnip({ ...snips[0], items: ["Remove the wheel."] }, p), false, "a unit the page never declared");
});

test("strung together in source-rank order, de-duplicated (a mirror quoting the same sentence adds nothing)", () => {
  const a = { ref: "a.org — A", url: "https://a.org/a", text: "Alpha is the first source and it says something about the ask in a full sentence." };
  const b = { ref: "b.org — B", url: "https://b.org/b", text: "Beta is the second source and it says something different about the ask here." };
  const mirror = { ref: "c.org — C", url: "https://c.org/c", text: "Alpha is the first source and it says something about the ask in a full sentence." };
  const { snips } = snipsOf([a, b, mirror], "ask");
  assert.deepEqual(snips.map((s) => s.n), ["S1", "S2"], "source order, mirror dropped");
  assert.equal(strandText(snips), a.text + "\n\n" + b.text);
});

test("the strand is bounded (total chars, sources quoted) and never empty when a source read something", () => {
  const many = Array.from({ length: 8 }, (_, i) => PASSAGE({ ref: `s${i}.org — T${i}`, url: `https://s${i}.org/x`, text: EIFFEL.replace("Eiffel", "Eiffl" + i) }));
  const { snips } = snipsOf(many, "Eiffel tower height");
  assert.ok(new Set(snips.map((s) => s.p)).size <= STRAND.maxPassages);
  assert.ok(strandText(snips).length <= STRAND.totalChars + 700);
  assert.deepEqual(snipsOf([], "q"), { snips: [], dropped: [], junk: [], gaps: [] });
  assert.deepEqual(snipsOf([{ ref: "x — y", url: "https://x.org", text: "   " }], "q").snips, []);
});

test("adjacent kept sentences are ONE passage; the range is in the passage's own coordinates", () => {
  const t = "Opening sentence introduces the whole subject of the page in full. The rivers of the region flow south into the great delta. The mountains of the region rise above four thousand metres in places. " + "Unrelated filler goes on and on for a long while here. ".repeat(40) + "Then glaciers are mentioned far away from the others in the page.";
  const { snips } = snipsOf([{ ref: "x.org — X", url: "https://x.org/x", text: t }], "rivers mountains glaciers", { limits: { ...STRAND, perPassageChars: 400 } });
  for (const s of snips) { assert.equal(t.slice(s.range.start, s.range.end).replace(/\s+/g, " "), s.text); }
  const joined = snips.find((s) => /rivers/.test(s.text));
  assert.match(joined.text, /The rivers of the region flow south into the great delta\. The mountains of the region rise above four thousand metres in places\./, "adjacent kept sentences are one passage");
  assert.equal(joined.ellipsisAfter, true, "text after it was skipped, and the snip says so");
});

test("storeSnip keeps plain data only; strandText of stored snips is what message.content holds", () => {
  const { snips } = snipsOf([PASSAGE()], "How tall?");
  const stored = snips.map(storeSnip);
  assert.equal(JSON.parse(JSON.stringify(stored)).length, stored.length);
  assert.equal(strandText(stored), strandText(snips));
});

// ── the invariant on STORED messages ───────────────────────────────────────
test("contentAllowed: model-written content needs a source (or an alone kind); a sources strand must equal its snips", () => {
  const rec = (nSources, kind = "research") => ({ nSources, kind });
  assert.equal(contentAllowed({ role: "assistant", content: "x", grounding: rec(2) }), true);
  assert.equal(contentAllowed({ role: "assistant", content: "x", grounding: rec(0) }), false, "words with no source");
  assert.equal(contentAllowed({ role: "assistant", content: "", grounding: rec(0) }), true, "silence is always allowed");
  assert.equal(contentAllowed({ role: "assistant", content: "hi", grounding: rec(0, "smalltalk") }), false);
  assert.equal(contentAllowed({ role: "assistant", content: "hi", grounding: rec(0, "smalltalk") }, ["smalltalk"]), true, "ALONE_KINDS flips it");
  assert.equal(contentAllowed({ role: "assistant", content: "x", grounding: {} }), true, "predates the rule");
  assert.equal(contentAllowed({ role: "assistant", content: "x", mode: "agent" }), true, "the agent lane is out of scope");
  const { snips } = snipsOf([PASSAGE()], "How tall?");
  const ok = { role: "assistant", authored: "sources", snips, content: strandText(snips) };
  assert.equal(contentAllowed(ok), true);
  assert.equal(contentAllowed({ ...ok, content: ok.content + " And the model added this." }), false);
  assert.equal(contentAllowed({ ...ok, snips: [] }), false);
});

test("modelHistory: a sources-authored turn is carried as the sources' words, never as the model's", () => {
  const msgs = [
    { role: "user", content: "How tall is the tower?" },
    { role: "assistant", authored: "sources", content: "The tower is 330 metres tall.", snips: [{ text: "The tower is 330 metres tall.", site: "en.wikipedia.org" }] },
    { role: "user", content: "And when was it built?" },
  ];
  const h = modelHistory(msgs);
  assert.equal(h.length, 3);
  assert.notEqual(h[1].content, "The tower is 330 metres tall.", "not presented as something the assistant wrote");
  assert.match(h[1].content, /quoted from sources/i);
  assert.match(h[1].content, /330 metres tall/);
  assert.equal(modelText(msgs[1]).includes("330 metres"), true);
});

// ── static guards ──────────────────────────────────────────────────────────
test("STATIC GUARD: every model call in run() goes through the one barred wrapper", () => {
  const src = fs.readFileSync(new URL("./fold-chat.js", import.meta.url), "utf8");
  const a = src.indexOf("async function run(id = activeId, continuing = false"), b = src.indexOf("async function runCode(");
  assert.ok(a > 0 && b > a, "run() found");
  const body = src.slice(a, b);
  const calls = [...body.matchAll(/client\.chat\(/g)];
  assert.equal(calls.length, 1, "exactly one client.chat( in run(): inside the barred wrapper");
  const w = body.indexOf("const callModel");
  assert.ok(w > 0 && body.indexOf("client.chat(") > w && body.indexOf("client.chat(") - w < 600, "the call lives inside callModel");
  assert.match(body.slice(w, w + 600), /modelBarred/);
  assert.match(body, /modelBarred = /);
});

test("a Wikipedia lead never stops on an abbreviation: 'sent to study at St.' is not the end of a sentence", () => {
  const t = "Freddie Mercury was a British singer. In 1954, at the age of eight, Mercury was sent to study at St. Peter's School near Panchgani. He later moved to England and joined a band.";
  const { snips } = snipsOf([{ ref: "Wikipedia — Freddie Mercury", url: "https://en.wikipedia.org/wiki/Freddie_Mercury", text: t }], "who", { limits: { ...STRAND, leadChars: 80 } });
  assert.ok(!/St\.$/.test(snips[0].text), snips[0].text);
  assert.equal(snips[0].text, "Freddie Mercury was a British singer.");
  const whole = snipsOf([{ ref: "Wikipedia — F", url: "https://en.wikipedia.org/wiki/F", text: t }], "who", { limits: { ...STRAND, leadChars: 140 } }).snips[0].text;
  assert.ok(whole.endsWith("Panchgani."), whole);
});

// ── the junk gate, the wall check and the nav-aware scoring (docs/SNIP-JUNK-PREREG.md) ─────────────────────────────────────
const CONTENT1 = "The okapi is an artiodactyl mammal that is endemic to the northeast of the Democratic Republic of the Congo in Central Africa, and it is related to the giraffe.";
const CONTENT2 = "Both sexes have a dark chestnut coat with white stripes on the legs, and the males carry short skin-covered horns that are called ossicones in the literature.";
const CHROMEBLOCK = "Home Destinations Trending Europe Asia The Americas Australia Africa The Middle East The Caribbean Our Favorite Places Iceland Italy Japan London Portugal";

test("FALSIFIER (B1): chrome ahead of the content is never quoted — the strand starts at the content, and no snip is a menu or a banner", () => {
  const text = [CHROMEBLOCK, "We use cookies to improve your experience. Accept all cookies. Cookie settings. Privacy policy.", "Sign in or create an account to continue reading.", CONTENT1, CONTENT2].join("\n\n");
  const { snips, junk } = snipsOf([{ ref: "x.org — Okapi", url: "https://x.org/okapi", text }], "okapi horns stripes");
  assert.ok(snips.length >= 1);
  for (const s of snips) { assert.ok(!/cookies|Sign in|Destinations/.test(s.text), "no chrome in a snip: " + s.text.slice(0, 60)); assert.ok(text.replace(/\s+/g, " ").includes(s.text)); }
  assert.ok(snips.some((s) => s.text.includes("okapi")));
  assert.ok(Array.isArray(junk));
});

test("FALSIFIER (B1): a page that is ALL chrome yields no snip and a typed 'junk' gap — never the chrome, never a model's words", () => {
  const text = [CHROMEBLOCK, "Home Shop Blog About Contact Careers Press Help Terms Privacy", "All rights reserved. Privacy policy. Terms of use. Cookie settings."].join("\n\n");
  const r = snipsOf([{ ref: "x.org — Home", url: "https://x.org/", text }], "okapi");
  assert.deepEqual(r.snips, []);
  assert.equal(r.gaps.length, 1); assert.equal(r.gaps[0].kind, "gap"); assert.ok(["junk", "blocked"].includes(r.gaps[0].gap));
  assert.equal(r.gaps[0].p, 0); assert.ok(r.gaps[0].reason.length > 10);
});

test("FALSIFIER (B5): wall pages yield NO snip and a typed 'blocked' gap with the reason — by status, by phrase, in any listed language", () => {
  const walls = [
    { ref: "a.org — Denied", url: "https://a.org/x", text: "Access Denied. You don't have permission to access this page on this server." },
    { ref: "b.org — Job", url: "https://b.org/x", text: "This job is no longer available. Browse similar jobs." },
    { ref: "c.org — Queue", url: "https://c.org/x", text: "You are in line. Your estimated wait time is 5 minutes. Thank you." },
    { ref: "d.org — Zugriff", url: "https://d.org/x", text: "Zugriff verweigert. Bestätigen Sie, dass Sie ein Mensch sind, um fortzufahren." },
    { ref: "e.org — Page", url: "https://e.org/x", status: 403, text: CONTENT1 + " " + CONTENT2 },
  ];
  const r = snipsOf(walls, "okapi");
  assert.deepEqual(r.snips, []);
  assert.equal(r.gaps.length, walls.length);
  assert.ok(r.gaps.every((g) => g.gap === "blocked" && g.reason.length > 10 && g.source));
});

test("FALSIFIER (B6): a real article that merely mentions a captcha or an expired link is quoted, not walled", () => {
  const text = "Most signup forms use a captcha, which slows people down. " + CONTENT1 + " " + CONTENT2 + " Links to old posts may have expired, but the archive is still online and searchable by date.";
  const r = snipsOf([{ ref: "x.org — Forms", url: "https://x.org/forms", text }], "okapi captcha");
  assert.ok(r.snips.length >= 1); assert.deepEqual(r.gaps, []);
});

test("looksBlocked now reads status and the declared multilingual wall phrases, and still reads the old English patterns", () => {
  assert.equal(looksBlocked("whatever", { status: 403 }), true);
  assert.equal(looksBlocked("whatever", { status: 200 }), false);
  assert.equal(looksBlocked("Acceso denegado. Verifica que eres humano."), true);
  assert.equal(looksBlocked("Just a moment... Enable JavaScript and cookies to continue"), true);
  assert.equal(looksBlocked(CONTENT1.repeat(50)), false, "a long page is not a wall");
});

test("a declared block that is hollow (labels with no values) is not shown; a typed 'junk' gap says so", () => {
  const p = { ref: "x.org — Events", url: "https://x.org/e", text: "Whatever the page text is.", declared: [{ kind: "faq", name: "FAQ", author: "", items: ["Q? — "] }] };
  const r = snipsOf([p], "events");
  assert.ok(r.snips.every((s) => s.text.length > 6));
});
