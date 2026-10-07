// fold-chat-provenance.test.mjs — the pointing call's reply is a CLAIM that is checked, never believed. Every falsifier hands the verifier a lie.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PROVENANCE, pointerMessages, parsePointerReply, locate, bearsOn, verifyPointer, narrate, verifyNarration, TEMPLATES } from "./fold-chat-provenance.js";
import { functionWordsOf } from "./fold-chat-snippets.js";

const FW = functionWordsOf("en");
const WIKI = { ref: "en.wikipedia.org — Monarchy of the United Kingdom", title: "Monarchy of the United Kingdom", url: "https://en.wikipedia.org/wiki/Monarchy_of_the_United_Kingdom", tertiary: true,
  text: "The monarchy of the United Kingdom is the constitutional form of government. Charles III is the king of the United Kingdom and the other Commonwealth realms, having acceded on 8 September 2022.   He succeeded his mother." };
const ROYAL = { ref: "royal.uk — The King", title: "The King", url: "https://www.royal.uk/the-king", origin: true, foundVia: { host: "en.wikipedia.org" },
  text: "His Majesty King Charles III is the monarch of the United Kingdom. The King was born in 1948." };
const BBC = { ref: "bbc.com — King Charles", title: "King Charles", url: "https://www.bbc.com/news/uk-1", text: "King Charles III became king on 8 September 2022 following the death of Queen Elizabeth II. King Charles III is the monarch of the United Kingdom, having acceded on that date." };
const CLAIM = "Charles III is the king of the United Kingdom.";

test("pointerMessages: the model is asked to COPY a sentence, with the sources numbered, and nothing about provenance is asked of it in prose", () => {
  const m = pointerMessages({ answer: CLAIM, passages: [WIKI, ROYAL] });
  assert.equal(m[0].role, "system"); assert.match(m[0].content, /copy it exactly/i); assert.match(m[0].content, /NONE/);
  assert.match(m[1].content, /\[S1\] Monarchy of the United Kingdom/); assert.match(m[1].content, /\[S2\] The King/); assert.match(m[1].content, /ANSWER\nCharles III is the king/);
});

test("parsePointerReply: the shapes a small model actually replies in, and NONE", () => {
  assert.deepEqual(parsePointerReply("SOURCE: S2\nSENTENCE: His Majesty King Charles III is the monarch."), { source: 2, sentence: "His Majesty King Charles III is the monarch." });
  assert.deepEqual(parsePointerReply('Source: [S1]\nSentence: "Charles III is the king."'), { source: 1, sentence: "Charles III is the king." });
  assert.deepEqual(parsePointerReply("NONE"), { none: true });
  assert.equal(parsePointerReply("I think it is Charles."), null);
  assert.equal(parsePointerReply(""), null);
});

test("locate: finds the sentence character for character (whitespace and typographic marks normalised) and returns the SOURCE's own slice, with offsets", () => {
  const a = locate("Charles III is the king of the United Kingdom and the other Commonwealth realms, having acceded on 8 September 2022.", [WIKI, ROYAL], 1);
  assert.equal(a.ok, true); assert.equal(a.index, 0);
  assert.equal(WIKI.text.slice(a.start, a.end), a.text, "offsets slice back into the source");
  assert.match(a.text, /8 September 2022\.$/, "extended to the source's own terminal mark");
  const b = locate("He   succeeded his mother", [WIKI]);              // the model collapsed nothing; the source has a triple space elsewhere
  assert.equal(b.ok, true);
  const c = locate("charles iii is the king of the united kingdom", [ROYAL, WIKI], 1);
  assert.equal(c.ok, true); assert.equal(c.index, 1, "the hint (S1 = ROYAL) is searched first but never trusted: the sentence is not there, so the search goes on and finds it in WIKI");
});

test("FALSIFIER: a sentence the model INVENTED, a paraphrase, an ellipsised copy and a too-short copy are all rejected", () => {
  assert.deepEqual(locate("Charles III has been king since the year 2022 and lives in Windsor Castle.", [WIKI, ROYAL]), { ok: false, why: "not_in_sources" });
  assert.deepEqual(locate("King Charles III currently reigns over the United Kingdom.", [WIKI, ROYAL]), { ok: false, why: "not_in_sources" });
  assert.equal(locate("Charles III is the king of the United Kingdom and the other ... realms", [WIKI]).ok, false);
  assert.deepEqual(locate("Charles III.", [WIKI]), { ok: false, why: "too_short" });
});

test("verifyPointer: a REAL sentence that does not bear on the claim is rejected (unrelated), and so is one missing a figure the claim states", () => {
  const real = "SOURCE: S1\nSENTENCE: The monarchy of the United Kingdom is the constitutional form of government.";
  assert.equal(verifyPointer({ reply: real, claim: "The United Kingdom is a constitutional monarchy.", passages: [WIKI], fw: FW }).ok, true, "a real sentence that bears on the claim");
  assert.deepEqual(verifyPointer({ reply: real, claim: "Charles III is the king of the UK.", passages: [WIKI], fw: FW }), { ok: false, why: "unrelated" }, "real, but shares no content stem with THIS claim: rejected, not rescued");
  assert.deepEqual(verifyPointer({ reply: "SOURCE: S2\nSENTENCE: The King was born in 1948.", claim: "Paris is the capital of France.", passages: [WIKI, ROYAL], fw: FW }), { ok: false, why: "unrelated" });
  const fig = verifyPointer({ reply: "SOURCE: S1\nSENTENCE: He succeeded his mother.", claim: "Charles became king in 2022 and succeeded his mother.", passages: [WIKI], fw: FW });
  assert.equal(fig.ok, false); assert.match(fig.why, /^figure_missing:2022/);
  assert.deepEqual(verifyPointer({ reply: "NONE", claim: CLAIM, passages: [WIKI], fw: FW }), { ok: false, why: "none" });
  assert.deepEqual(verifyPointer({ reply: "gibberish", claim: CLAIM, passages: [WIKI], fw: FW }), { ok: false, why: "unparsed" });
});

test("verifyPointer returns the tier: primary, index (an encyclopedia), origin (a primary page reached through one)", () => {
  const p = (reply, passages) => verifyPointer({ reply, claim: CLAIM, passages, fw: FW });
  assert.equal(p("SOURCE: S1\nSENTENCE: Charles III is the king of the United Kingdom and the other Commonwealth realms, having acceded on 8 September 2022.", [WIKI]).tier, "index");
  assert.equal(p("SOURCE: S1\nSENTENCE: His Majesty King Charles III is the monarch of the United Kingdom.", [ROYAL]).tier, "origin");
  assert.equal(p("SOURCE: S1\nSENTENCE: King Charles III became king on 8 September 2022 following the death of Queen Elizabeth II.", [BBC]).tier, "primary");
});

test("narrate: the app's words around the source's words — three tiers, a corroborating second host, and the honest 'none'", () => {
  const ps = [WIKI, ROYAL, BBC];
  const v = (reply, claim = CLAIM) => verifyPointer({ reply, claim, passages: ps, fw: FW });
  const r1 = v("SOURCE: S2\nSENTENCE: His Majesty King Charles III is the monarch of the United Kingdom.");
  const r2 = v("SOURCE: S3\nSENTENCE: King Charles III became king on 8 September 2022 following the death of Queen Elizabeth II.", "King Charles III became king on 8 September 2022.");
  const n = narrate([r1, r2], { indexHost: "en.wikipedia.org" });
  assert.match(n.text, /^I checked this on Wikipedia, but I treat that as an index to primary sources, so I followed it to royal\.uk and verified it there\. It says: “His Majesty King Charles III is the monarch of the United Kingdom\.” It also says it on bbc\.com: “King Charles III became king/);
  assert.equal(n.verified, 2);
  assert.equal(verifyNarration(n, ps, [r1, r2], { indexHost: "en.wikipedia.org" }).ok, true);
  const idx = narrate([v("SOURCE: S1\nSENTENCE: Charles III is the king of the United Kingdom and the other Commonwealth realms, having acceded on 8 September 2022.")]);
  assert.match(idx.text, /^I found this on Wikipedia, which I treat as a pointer rather than a source, and I could not reach a primary page that says it, so treat it as unconfirmed\. It says: “Charles III is the king/);
  const prim = narrate([v("SOURCE: S3\nSENTENCE: King Charles III became king on 8 September 2022 following the death of Queen Elizabeth II.", "King Charles III became king in September 2022.")]);
  assert.match(prim.text, /^I got this from King Charles \(bbc\.com\)\. It says: “King Charles III became king/);
  const none = narrate([{ ok: false, why: "not_in_sources" }]);
  assert.equal(none.text, TEMPLATES.none()); assert.equal(none.verified, 0);
  const same = narrate([r1, { ...r1, quote: "A different sentence from the same site entirely." }]);
  assert.ok(!/also says it/.test(same.text), "the same host twice is not a second witness");
});

test("FALSIFIER of the narrator: add a word of the app's own, or alter a quote, and verifyNarration fails; the model never authors any part", () => {
  const ps = [WIKI, ROYAL];
  const r1 = verifyPointer({ reply: "SOURCE: S2\nSENTENCE: His Majesty King Charles III is the monarch of the United Kingdom.", claim: CLAIM, passages: ps, fw: FW });
  const n = narrate([r1]);
  assert.equal(verifyNarration(n, ps, [r1]).ok, true);
  const extra = structuredClone(n); extra.parts[0].text += " This is certainly true.";
  assert.equal(verifyNarration(extra, ps, [r1]).ok, false, "an added claim by anyone");
  const altered = structuredClone(n); altered.parts[1].text = "“His Majesty King Charles III is the Emperor of the United Kingdom.”";
  assert.equal(verifyNarration(altered, ps, [r1]).ok, false, "an altered quote");
  assert.ok(n.parts.every((x) => x.kind === "app" || x.kind === "quote"));
});

test("a quote is bounded and cut at a word, with the full source slice still addressable", () => {
  const long = { ref: "x.org — Long", title: "Long", url: "https://x.org/l", text: "The tower " + "stands tall and is made of wrought iron lattice ".repeat(20) + "in Paris." };
  const v = verifyPointer({ reply: "SOURCE: S1\nSENTENCE: " + long.text, claim: "The tower is made of wrought iron.", passages: [long], fw: FW });
  assert.equal(v.ok, true); assert.ok(v.quote.length <= PROVENANCE.maxQuote + 1 && v.quote.endsWith("…"));
  assert.equal(long.text.slice(v.start, v.end).length > v.quote.length, true);
});

test("the module owns no model, network or storage", () => {
  const src = fs.readFileSync(new URL("./fold-chat-provenance.js", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
  assert.ok(!/\b(fetch|XMLHttpRequest|callModel|client\.chat)\b/.test(src) && !/localStorage\.(setItem|removeItem)/.test(src), "the only storage touch is the READ of the off-switch");
});

test("what is returned is the SOURCE'S slice, not the model's copy: case, quotes and spacing come from the page", () => {
  const page = { ref: "a.org — A", title: "A", url: "https://a.org/x", text: "Intro here. He said “Hello”  there, and left the room. Tail." };
  const a = locate('he said "hello" there, and left the room.', [page]);
  assert.equal(a.ok, true);
  assert.equal(a.text, "He said “Hello”  there, and left the room.", "the page's own characters, double space and curly quotes included");
  assert.equal(page.text.slice(a.start, a.end), a.text);
});

import { provenanceFor, provenanceEnabled, candidatesFor, looksLikeSentence, numberedMessages, parsePointerNumber, verifyNumber } from "./fold-chat-provenance.js";
// a stub model that POINTS: it reads the numbered list it was handed and answers with the number of the first sentence containing `needle`
const pointAt = (...needles) => { const seen = []; let i = 0; const f = async (msgs) => { seen.push(msgs); const needle = needles[Math.min(i++, needles.length - 1)]; if (needle instanceof Error) throw needle; if (needle === "NONE") return "NONE"; const list = msgs[1].content.split("\n\nANSWER")[0].split("\n").filter((l) => /^\[\d+\]/.test(l)); const hit = list.find((l) => l.includes(needle)); return hit ? hit.match(/^\[(\d+)\]/)[1] : "99"; }; f.seen = seen; return f; };

test("candidatesFor: the numbered sentences are VERBATIM slices of the pages, in page order, bounded, from the pages that bear on the claim", () => {
  const cs = candidatesFor(CLAIM, [WIKI, ROYAL, BBC], FW);
  assert.ok(cs.length >= 3 && cs.length <= 20);
  cs.forEach((c, i) => assert.equal(c.n, i + 1));
  for (const c of cs) assert.equal([WIKI, ROYAL, BBC][c.passageIndex].text.slice(c.start, c.end).trim(), c.text);
  assert.ok(cs.some((c) => /Charles III is the king of the United Kingdom/.test(c.text)));
});

test("numberedMessages / parsePointerNumber: the model is asked for a NUMBER; replies in the shapes a small model uses", () => {
  const cs = candidatesFor(CLAIM, [WIKI], FW);
  const m = numberedMessages({ claim: CLAIM, candidates: cs, passages: [WIKI] });
  assert.match(m[0].content, /Reply with the number/); assert.match(m[1].content, /\[1\] /); assert.match(m[1].content, /ANSWER\nCharles III is the king/);
  assert.deepEqual(parsePointerNumber("3"), { n: 3 }); assert.deepEqual(parsePointerNumber("[2]"), { n: 2 }); assert.deepEqual(parsePointerNumber("The answer is sentence 4."), { n: 4 });
  assert.deepEqual(parsePointerNumber("NONE"), { none: true }); assert.deepEqual(parsePointerNumber("none of them"), { none: true }); assert.equal(parsePointerNumber("I think so"), null); assert.equal(parsePointerNumber(""), null);
});

test("verifyNumber: the sentence is the PAGE'S OWN by construction; a number that does not exist, an unrelated sentence and a missing figure are rejected", () => {
  const ps = [WIKI, ROYAL];
  const cs = candidatesFor(CLAIM, ps, FW);
  const n = cs.find((c) => /Commonwealth realms/.test(c.text)).n;
  const ok = verifyNumber({ reply: String(n), claim: CLAIM, candidates: cs, passages: ps, fw: FW });
  assert.equal(ok.ok, true); assert.equal(ok.by, "number"); assert.equal(ps[ok.index].text.slice(ok.start, ok.end).trim().startsWith("Charles III is the king"), true);
  assert.deepEqual(verifyNumber({ reply: "99", claim: CLAIM, candidates: cs, passages: ps, fw: FW }), { ok: false, why: "no_such_sentence" });
  assert.deepEqual(verifyNumber({ reply: "NONE", claim: CLAIM, candidates: cs, passages: ps, fw: FW }), { ok: false, why: "none" });
  assert.deepEqual(verifyNumber({ reply: "words", claim: CLAIM, candidates: cs, passages: ps, fw: FW }), { ok: false, why: "unparsed" });
  assert.deepEqual(verifyNumber({ reply: String(n), claim: "Paris is the capital of France.", candidates: cs, passages: ps, fw: FW }), { ok: false, why: "unrelated" });
  const fig = verifyNumber({ reply: String(n), claim: "Charles III is the king of the United Kingdom since 2019.", candidates: cs, passages: ps, fw: FW });
  assert.equal(fig.ok, false); assert.match(fig.why, /^figure_missing:2019/);
});

test("provenanceFor: call 1 over all pages, call 2 over the OTHER hosts only; the narration is verified and the stored record is plain JSON", async () => {
  const point = pointAt("Majesty King Charles III is the monarch", "is the monarch of the United Kingdom, having acceded");
  const r = await provenanceFor({ answer: "King Charles III is the monarch of the United Kingdom. He became king in 2022.", passages: [WIKI, ROYAL, BBC], point, fw: FW, preferRefs: [ROYAL.ref] });
  assert.equal(r.calls, 2, "one pointing call per witness when both verify at once"); assert.equal(r.claim, "King Charles III is the monarch of the United Kingdom.");
  assert.equal(r.ps[0].ref, ROYAL.ref, "the page the answer was witnessed by comes first");
  assert.ok(!/Majesty/.test(point.seen[1][1].content) && /became king/.test(point.seen[1][1].content), "call 2 does not offer the first host's sentence again");
  assert.equal(r.stored.verified, 2);
  assert.equal(verifyNarration(r.narr, r.ps, r.pointers).ok, true);
  JSON.parse(JSON.stringify(r.stored));
  assert.deepEqual(r.stored.pointers.map((p) => p.host), ["royal.uk", "bbc.com"]);
});

test("FALSIFIER: the model names a sentence number that does not exist (or NONE) → NO provenance is claimed, and the narration says so in the app's words", async () => {
  for (const needle of ["zzz-no-such", "NONE"]) {
    const r = await provenanceFor({ answer: CLAIM, passages: [WIKI, BBC], point: pointAt(needle), fw: FW });
    assert.equal(r.calls, needle === "NONE" ? 1 : 2, "a number that is not on the list is rejected and asked ONCE more; NONE is an answer"); assert.equal(r.stored.verified, 0); assert.ok(["no_such_sentence", "none"].includes(r.stored.why), r.stored.why);
    assert.equal(r.narr.text, TEMPLATES.none());
  }
});

test("a failed or aborted model call: failure is typed and the turn survives; an abort propagates", async () => {
  const r = await provenanceFor({ answer: CLAIM, passages: [WIKI], point: pointAt(new Error("model down")), fw: FW });
  assert.match(r.stored.why, /^call_failed:model down/); assert.equal(r.narr.text, TEMPLATES.none());
  const ab = Object.assign(new Error("stopped"), { name: "AbortError" });
  await assert.rejects(() => provenanceFor({ answer: CLAIM, passages: [WIKI], point: pointAt(ab), fw: FW }), (e) => e.name === "AbortError");
});

test("one host only: a single call; no passages or no claim: no call at all; the switch", async () => {
  const r = await provenanceFor({ answer: CLAIM, passages: [WIKI], point: pointAt("Commonwealth realms"), fw: FW });
  assert.equal(r.calls, 1); assert.equal(r.stored.verified, 1); assert.equal(r.stored.pointers[0].tier, "index");
  assert.equal((await provenanceFor({ answer: CLAIM, passages: [], point: pointAt("x"), fw: FW })).calls, 0);
  assert.equal((await provenanceFor({ answer: "", passages: [WIKI], point: pointAt("x"), fw: FW })).calls, 0);
  assert.equal(provenanceEnabled({ getItem: () => "off" }), false); assert.equal(provenanceEnabled({ getItem: () => null }), true);
  assert.equal(provenanceEnabled({ getItem() { throw new Error("blocked"); } }), true);
});

test("FALSIFIER (found live: spiders): a scraped run-on is not a candidate, and a second witness must share two content stems with the claim", async () => {
  const JUNK = { ref: "albatt.com \u2014 Q&A", title: "Q&A", url: "https://albatt.com/q", text: "A happy blue jay is a blue jay weighing a peanut just as a bowler does when searching for the perfect heft to a bowling ball filled with strikes.Q&A\"Why do spiders have eight legs and insects only six?" };
  assert.equal(looksLikeSentence(JUNK.text), false);
  assert.equal(looksLikeSentence("Spiders typically have eight walking legs (insects have six)."), true);
  assert.deepEqual(candidatesFor("A spider has eight legs.", [JUNK], FW), [], "the glued run-on is never offered to the model");
  const SP = { ref: "en.wikipedia.org \u2014 Spider", title: "Spider", url: "https://en.wikipedia.org/wiki/Spider", tertiary: true, text: "Spiders typically have eight walking legs (insects have six). They are arachnids." };
  const WEAK = { ref: "x.org \u2014 Legs", title: "Legs", url: "https://x.org/l", text: "Humans have two legs and stand upright on them every day." };
  const r = await provenanceFor({ answer: "A spider typically has eight walking legs.", passages: [SP, WEAK], point: pointAt("eight walking legs", "two legs"), fw: FW });
  assert.equal(r.stored.verified, 1, "a one-stem coincidence (legs) is not a second witness");
});

test("ordering: a primary page is offered before the encyclopedia, the page the answer was witnessed by first within a tier", async () => {
  const r = await provenanceFor({ answer: CLAIM, passages: [WIKI, BBC, ROYAL], point: pointAt("NONE"), fw: FW, preferRefs: [WIKI.ref] });
  assert.deepEqual(r.ps.map((p) => p.ref), [ROYAL.ref, BBC.ref, WIKI.ref], "origin first, then primary, the encyclopedia last — even though the answer was witnessed by the encyclopedia");
});

test("a clean but enormous 'sentence' (a table, a wall of text) is not a candidate either", () => {
  const wall = "The tower " + "is made of wrought iron lattice and stands tall over the city ".repeat(10) + "in Paris.";
  assert.ok(wall.length > PROVENANCE.maxCandidate);
  assert.equal(looksLikeSentence(wall), false);
  assert.equal(looksLikeSentence("The tower is made of wrought iron lattice."), true);
});

test("one bounded retry: a real number whose sentence does not say it is withdrawn and the model is asked once more over the rest; a second wrong pick is final", async () => {
  const DEATH = { ref: "n.org \u2014 Curie", title: "Curie", url: "https://n.org/c", text: "Marie Curie died in July 1934 at a sanatorium. Marie Curie died on 4 July 1934, in Savoy, France. She won two Nobel Prizes." };
  const claim = "Marie Curie died on July 4, 1934.";
  const r = await provenanceFor({ answer: claim, passages: [DEATH], point: pointAt("in July 1934 at a sanatorium", "died on 4 July 1934"), fw: FW });
  assert.equal(r.calls, 2); assert.equal(r.stored.verified, 1);
  assert.match(r.stored.pointers[0].start >= 0 ? DEATH.text.slice(r.stored.pointers[0].start, r.stored.pointers[0].end) : "", /Savoy/);
  const final = await provenanceFor({ answer: claim, passages: [DEATH], point: pointAt("in July 1934 at a sanatorium", "She won two Nobel Prizes"), fw: FW });
  assert.equal(final.calls, 2); assert.equal(final.stored.verified, 0);
  const none = await provenanceFor({ answer: claim, passages: [DEATH], point: pointAt("NONE"), fw: FW });
  assert.equal(none.calls, 1, "NONE is an answer, not a rejection: no retry");
});

test("FALSIFIER (found live: spiders): a heading that shares words ('Myth: Eight legs always means spider') is NOT a second witness; one that says it is", async () => {
  const SP = { ref: "en.wikipedia.org \u2014 Spider", title: "Spider", url: "https://en.wikipedia.org/wiki/Spider", tertiary: true, text: "Spiders typically have eight walking legs (insects have six)." };
  const MYTH = { ref: "burke.org \u2014 Myths", title: "Myths", url: "https://burke.org/m", text: "Myth: Eight legs always means spider. Fact: scorpions and mites have eight legs too." };
  const SAYS = { ref: "museum.org \u2014 Spiders", title: "Spiders", url: "https://museum.org/s", text: "Spiders typically have eight walking legs and two body parts." };
  const a = await provenanceFor({ answer: "Spiders typically have eight walking legs.", passages: [SP, MYTH], point: pointAt("eight walking legs", "Myth: Eight legs"), fw: FW });
  assert.equal(a.stored.verified, 1, "the heading is not a second witness");
  const b = await provenanceFor({ answer: "Spiders typically have eight walking legs.", passages: [SP, SAYS], point: pointAt("eight walking legs and two body parts", "eight walking legs (insects"), fw: FW });
  assert.equal(b.stored.verified, 2); assert.deepEqual(b.stored.pointers.map((p) => p.host), ["museum.org", "en.wikipedia.org"], "the primary page leads, the encyclopedia corroborates");
});

test("the retry WITHDRAWS the rejected candidate: a model that answers '1' twice gets a different sentence the second time", async () => {
  const P = { ref: "n.org \\u2014 Curie", title: "Curie", url: "https://n.org/c", text: "Marie Curie died in July 1934 at a sanatorium. Marie Curie died on 4 July 1934, in Savoy, France." };
  let calls = 0; const point = async () => { calls++; return "1"; };
  const r = await provenanceFor({ answer: "Marie Curie died on July 4, 1934.", passages: [P], point, fw: FW });
  assert.equal(calls, 2); assert.equal(r.stored.verified, 1, "the second '1' now names the next sentence");
  assert.match(P.text.slice(r.stored.pointers[0].start, r.stored.pointers[0].end), /Savoy/);
});

test("bearsOn: a sentence sharing only the commonest word is not 'where it came from' (measured: King George V / Windsor for 'King Charles III')", () => {
  const claim = "The King of the UK is King Charles III.";
  const fw = new Set(["the", "of", "is", "in", "was", "with", "because", "to", "a", "his", "who", "on", "at", "for", "and"]);
  assert.equal(bearsOn(claim, "In 1917 King George V changed the royal house's name to Windsor because the United Kingdom was at war with Germany.", fw).ok, false);
  assert.equal(bearsOn(claim, "The monarch since 8 September 2022 is King Charles III, who ascended the throne on the death of his mother.", fw).ok, true);
});

test("an encyclopedia other than Wikipedia is an INDEX too: Britannica is a pointer, not a source (measured: 'I got this from Britannica')", async () => {
  const { isTertiary } = await import("./fold-chat-provenance.js");
  assert.equal(isTertiary("https://www.britannica.com/biography/Charles-III"), true);
  assert.equal(isTertiary("https://en.wikipedia.org/wiki/Charles_III"), true);
  assert.equal(isTertiary("https://www.royal.uk/the-king"), false);
  assert.equal(isTertiary("https://www.nobelprize.org/prizes/physics/1903/"), false);
});

test("a heading (no sentence end) is not a candidate sentence (measured: a BBC page title quoted as the source of 'Charles III is king')", async () => {
  const { looksLikeSentence } = await import("./fold-chat-provenance.js");
  assert.equal(looksLikeSentence("Royal Family tree: King Charles III's closest family and line of succession"), false);
  assert.equal(looksLikeSentence("The monarch since 8 September 2022 is King Charles III."), true);
  assert.equal(looksLikeSentence("He said “it is so.”"), true);
});
