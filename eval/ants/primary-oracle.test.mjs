import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { classifyPage, scoreClaim, scoreAll } from "./primary-oracle.mjs";
const corpus = JSON.parse(fs.readFileSync(new URL("./primary-corpus.json", import.meta.url), "utf8"));
const claim = (id) => corpus.claims.find((c) => c.id === id);
const canb = claim("capital");
const T = "Canberra is the capital of Australia and the seat of the Parliament.";

test("the corpus is 14 labelled claims, each with hosts and say-regexes", () => {
  assert.equal(corpus.claims.length, 14);
  for (const c of corpus.claims) { assert.ok(c.claim && c.hostsOk.length && c.say.length, c.id); assert.ok(!c.hostsOk.some((h) => new RegExp(h, "i").test("en.wikipedia.org")), c.id + " hostsOk must never admit wikipedia"); }
});
test("wikipedia and mirrors are forbidden even when the text says it", () => {
  for (const u of ["https://en.wikipedia.org/wiki/Canberra", "https://fr.wikipedia.org/wiki/Canberra", "https://www.wikiwand.com/en/Canberra", "https://en.wikipedia.thetimetube.example/x", "https://www.britannica.com/place/Canberra", "https://www.quora.com/x", "https://canberrapedia.example/x", "https://somewiki.net/c"])
    assert.equal(classifyPage({ url: u, text: T }, canb, corpus).cls, "forbidden", u);
});
test("a government host whose page says it is reach; one that does not is host_ok_text_fails", () => {
  assert.equal(classifyPage({ url: "https://www.act.gov.au/about", text: T }, canb, corpus).cls, "reach");
  assert.equal(classifyPage({ url: "https://www.act.gov.au/about", text: "Rates and fees for residents." }, canb, corpus).cls, "host_ok_text_fails");
});
test("an unknown host is never reach: passes-text or fails-text, for a person to judge", () => {
  assert.equal(classifyPage({ url: "https://some-news.example/x", text: T }, canb, corpus).cls, "unlisted_passes_text");
  assert.equal(classifyPage({ url: "https://some-news.example/x", text: "nothing" }, canb, corpus).cls, "unlisted_fails_text");
});
test("typographic text and case do not defeat the text check", () => {
  assert.equal(classifyPage({ url: "https://www.senate.gov/a", text: "The  U.S.   SENATE has 100 members" }, claim("count-senate"), corpus).cls, "reach");
});
test("scoreClaim: a tainted claim (reach page + a mirror page) is not a reach and counts a mirror false accept", () => {
  const r = scoreClaim({ passages: [{ url: "https://www.act.gov.au/a", text: T }, { url: "https://en.wikipedia.org/wiki/Canberra", text: T }] }, canb, corpus);
  assert.equal(r.reach, false); assert.equal(r.reachedButTainted, true); assert.equal(r.mirrorFA, 1);
});
test("scoreClaim: empty passages is an abstention, not a false accept", () => {
  const r = scoreClaim({ passages: [] }, canb, corpus);
  assert.deepEqual([r.abstained, r.reach, r.mirrorFA, r.wrongFA], [true, false, 0, 0]);
});
test("scoreAll sums", () => {
  const a = scoreClaim({ passages: [{ url: "https://www.act.gov.au/a", text: T }] }, canb, corpus);
  const b = scoreClaim({ passages: [{ url: "https://www.britannica.com/x", text: T }] }, canb, corpus);
  const t = scoreAll([a, b]);
  assert.deepEqual([t.reach, t.mirrorFA_pages, t.claims], [1, 1, 2]);
});
