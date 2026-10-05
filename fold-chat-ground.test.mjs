// fold-chat-ground.test.mjs — the grounding mechanisms, falsifiable:
//   stripSelfCitations  a model's own bracket address is neutralized
//   attribute/coverage  a sentence is addressed only to material it shares a
//                       PHRASE with, and never when it commits to a name the
//                       material lacks (the Bryan-TX-PD veto)
//   unsupportedClaims   figures and names the material does not say
//   turnRecord          the holodeck's one-line record
import test from "node:test";
import assert from "node:assert/strict";
import { splitSentences, tokenize, overlap, stripSelfCitations, namesIn, numbersIn, attribute, coverage, unsupportedClaims, turnRecord, facingPage, MIN_RUN } from "./fold-chat-ground.js";

test("splitSentences does not cut on abbreviations or initials", () => {
  const s = splitSentences("Washington, D.C. was founded in 1791. Its site was chosen by Congress.");
  assert.equal(s.length, 2, "D.C. is not a sentence boundary");
  assert.match(s[0], /D\.C\. was founded in 1791\.$/);
  const initials = splitSentences("The plan was drawn by J. R. R. Tolkien in 1937. It sold well.");
  assert.equal(initials.length, 2);
  assert.match(initials[0], /Tolkien in 1937\.$/);
});

test("splitSentences splits on sentence punctuation and newlines, not abbreviations", () => {
  assert.deepEqual(splitSentences("One claim. Two claims!\nA third."), ["One claim.", "Two claims!", "A third."]);
  assert.deepEqual(splitSentences("See Dr. Smith now. Done."), ["See Dr. Smith now.", "Done."]);
});

test("overlap finds the longest shared run in order; MIN_RUN is 2", () => {
  assert.equal(overlap(tokenize("missing contract funds"), tokenize("about the missing contract funds today")), 3);
  assert.equal(overlap(tokenize("alpha"), tokenize("beta")), 0);
  assert.equal(MIN_RUN, 2);
});

test("stripSelfCitations neutralizes a bracket address the model invented", () => {
  const r = stripSelfCitations("The funds are gone [audit#80-174]. See above.");
  assert.equal(r.removed, 1);
  assert.match(r.text, /citation removed — not issued by this instrument/);
  assert.doesNotMatch(r.text, /\[audit#80-174\]/);
});

test("namesIn reads a name whole across accents; a lone capital is not a name", () => {
  assert.deepEqual(namesIn("Anna Pávlovna greeted Éloise"), ["Anna Pávlovna", "Éloise"]);
  assert.ok(namesIn("the MNPD BOLO was issued").includes("MNPD BOLO"));
  // A sentence-initial capital is an opener, not a name.
  assert.deepEqual(namesIn("Today is fine."), []);
  // A LONE mid-sentence proper noun IS a name the sentence commits to — this is
  // what lets "founded in 1795" be checked against a passage lacking Washington.
  assert.deepEqual(namesIn("Washington was founded in 1795."), ["Washington"]);
});

test("a lone proper noun must appear in the material to warrant the claim", () => {
  // The Snowden-disclosures failure: an Ottawa sentence riding a shared phrase.
  const snowden = [{ ref: "Wikipedia — Snowden disclosures", source: "https://en.wikipedia.org/wiki/Snowden", text: "According to a secret NSA memo dated September 2010, the Italian embassy in Washington was targeted." }];
  const out = attribute("Ottawa was the first capital of Canada.", snowden);
  assert.equal(out[0].ref, null, "Ottawa is not in the Snowden passage — no grounding");
  // A true support still grounds.
  const real = [{ ref: "Wikipedia — Ottawa", source: "https://en.wikipedia.org/wiki/Ottawa", text: "Ottawa was founded in 1857 and became the capital of the Province of Canada." }];
  assert.ok(attribute("Ottawa was founded in 1857.", real)[0].ref, "the real Ottawa passage still grounds");
});

test("attribute: a shared phrase is addressed; a lone shared word is not", () => {
  const material = [{ ref: "you · message 1", source: "S1", text: "The audit found the contract funds are unaccounted for." }];
  const cov = coverage("The contract funds are unaccounted for, the report says. I cannot verify the rest.", material);
  assert.ok(cov.grounded >= 1, "the shared phrase is addressed");
  assert.match(cov.entries.find((e) => e.ref).address, /^you · message 1#\d+-\d+$/);
  // A single shared word is not a phrase: not addressed.
  const lone = attribute("Search happened.", [{ ref: "m", source: "S1", text: "The search records are attached." }]);
  assert.equal(lone[0].ref, null);
});

test("the veto: a shared phrase does NOT warrant a name the material lacks", () => {
  // The Bryan TX PD / MNPD BOLO incident: the phrase is real, the subject is not.
  const material = [{ ref: "S1", source: "S1", text: "Hendersonville TN PD: the reason was MNPD BOLO." }];
  const out = attribute("Bryan TX PD: the reason was MNPD BOLO.", material);
  assert.equal(out[0].ref, null, "the invented subject is not warranted by the shared phrase");
});

test("unsupportedClaims names the figures and names the material does not say", () => {
  const material = [{ ref: "S1", source: "S1", text: "The audit found the contract funds are unaccounted for." }];
  const u = unsupportedClaims("The contract funds total $4.2 million and were signed by Jane Doe.", material);
  assert.ok(u.numbers.includes("4.2"), "an invented figure is caught");
  assert.ok(u.names.some((n) => /Jane Doe/.test(n)), "an invented name is caught");
});

test("turnRecord is the holodeck's one-line record, with addresses checked", () => {
  const material = [{ ref: "you · message 1", source: "S1", text: "The audit found the contract funds are unaccounted for." }];
  const rec = turnRecord("The contract funds are unaccounted for. They total $4.2 million.", material, { turn: 2 });
  assert.match(rec.line, /^On record · turn 2 · /);
  assert.match(rec.line, /address.* checked/);
  assert.match(rec.line, /not in the material/);
  assert.ok(rec.sources.length >= 1);
  assert.ok(rec.unsupported.numbers.includes("4.2"));
  assert.equal(rec.facing.has, true, "the record carries the facing page when material was read");
});

test("turnRecord with no material says the answer stands on the model alone", () => {
  const rec = turnRecord("Hello there.", [], { turn: 1 });
  assert.match(rec.line, /no material carried/);
  assert.equal(rec.hasMaterial, false);
  assert.equal(rec.facing.has, false, "no material means no facing page");
});

test("facingPage: sources are numbered S# with address+verbatim snip; response tags [S#]/[M]", () => {
  const material = [
    { ref: "you · pasted 1", source: "S1", text: "The audit found the contract funds are unaccounted for." },
    { ref: "you · pasted 2", source: "S2", text: "The report was filed in March by the comptroller." },
  ];
  const face = facingPage(
    "The contract funds are unaccounted for. The report was filed in March by the comptroller. I cannot verify the rest.",
    material,
  );
  assert.equal(face.has, true);
  assert.equal(face.sources.length, 2, "two cited passages become two sources");
  assert.equal(face.sources[0].n, "S1");
  assert.match(face.sources[0].address, /^you · pasted 1#\d+-\d+$/);
  assert.match(face.sources[0].text, /contract funds are unaccounted/);
  // The first two sentences cite S1 and S2; the third is the mouth's own prose.
  assert.equal(face.response[0].tag, "S1");
  assert.equal(face.response[1].tag, "S2");
  assert.equal(face.response[2].tag, "M");
  assert.equal(face.response[2].grounded, false);
});

test("facingPage over no material has no sources, and every sentence is [M]", () => {
  const face = facingPage("A greeting is not a claim.", []);
  assert.equal(face.has, false);
  assert.equal(face.sources.length, 0);
  assert.ok(face.response.every((r) => r.tag === "M" && !r.grounded));
});

test("sourceDocs: passages of one document are listed under it, in first-seen order, each keeping its S# tag", async () => {
  const { sourceDocs } = await import("./fold-chat-ground.js");
  const wiki = { label: "Wikipedia — Nashville", url: "https://en.wikipedia.org/wiki/Nashville", domain: "en.wikipedia.org" };
  const docs = sourceDocs([
    { n: "S1", ...wiki, mark: "a" },
    { n: "S2", label: "Other", url: "https://example.org/x", domain: "example.org", mark: "b" },
    { n: "S3", ...wiki, mark: "c" },
  ]);
  assert.equal(docs.length, 2);
  assert.deepEqual(docs[0].passages.map((p) => p.n), ["S1", "S3"]);
  assert.equal(docs[0].title, "Wikipedia — Nashville");
  assert.equal(docs[0].domain, "en.wikipedia.org");
  assert.deepEqual(docs[1].passages.map((p) => p.n), ["S2"]);
  assert.deepEqual(sourceDocs(null), []);
  assert.deepEqual(sourceDocs([{ n: "S1", ref: "local file", mark: "x" }])[0].url, null, "a local source has no link");
});
