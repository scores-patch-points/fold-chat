import { test } from "node:test";
import assert from "node:assert/strict";
import { pagesOf, pageIndexOf, pager, stepOfKey, stepOfSwipe } from "./fold-chat-pager.js";

test("pager: 'N of M', never wraps, the ends say they cannot move", () => {
  let s = pager(5);
  assert.deepEqual([s.index, s.label, s.canPrev, s.canNext, s.paged], [0, "1 of 5", false, true, true]);
  assert.equal(s.prev().index, 0, "no wrap backward");
  s = s.next().next(); assert.equal(s.label, "3 of 5");
  s = s.last(); assert.deepEqual([s.label, s.canNext], ["5 of 5", false]);
  assert.equal(s.next().index, 4, "no wrap forward");
  assert.equal(s.go(99).index, 4); assert.equal(s.go(-3).index, 0); assert.equal(s.go("x").index, 0);
});

test("pager: one page shows no pager; none is empty and safe", () => {
  assert.equal(pager(1).paged, false);
  assert.deepEqual([pager(0).label, pager(0).canNext, pager(0).index], ["", false, 0]);
  assert.equal(pager(undefined).count, 0);
});

test("pager: the state is a value (moves do not change the old one)", () => {
  const a = pager(3); const b = a.next(); assert.equal(a.index, 0); assert.equal(b.index, 1);
  assert.throws(() => { "use strict"; a.index = 2; });
});

test("keys: Left/Right/Home/End move; any other key is not ours", () => {
  const s = pager(4, 1);
  assert.equal(stepOfKey("ArrowRight", s).index, 2); assert.equal(stepOfKey("ArrowLeft", s).index, 0);
  assert.equal(stepOfKey("End", s).index, 3); assert.equal(stepOfKey("Home", s).index, 0);
  assert.equal(stepOfKey("ArrowDown", s), null); assert.equal(stepOfKey("a", s), null);
  assert.equal(stepOfKey("ArrowLeft", pager(4, 0)).index, 0, "at the start Left stays");
});

test("swipe: a clear sideways drag moves, a tap or a vertical scroll does not", () => {
  const s = pager(3, 1);
  assert.equal(stepOfSwipe(-80, 5, s).index, 2); assert.equal(stepOfSwipe(80, -5, s).index, 0);
  assert.equal(stepOfSwipe(10, 0, s), null); assert.equal(stepOfSwipe(-60, 90, s), null, "mostly vertical = a scroll");
  assert.equal(stepOfSwipe(-80, 0, pager(3, 2)).index, 2, "no wrap past the end");
});

test("pagesOf: one page per SOURCE — the same S# twice is ONE page holding both passages (the 'S2 twice' bug)", () => {
  const snips = [{ n: "S1", url: "https://a.test/x", text: "a" }, { n: "S2", url: "https://b.test/y", text: "b1" }, { n: "S2", url: "https://b.test/y", text: "b2" }, { n: "S3", url: "https://c.test/", text: "c" }];
  const pages = pagesOf(snips);
  assert.deepEqual(pages.map((p) => p.n), ["S1", "S2", "S3"]);
  assert.deepEqual(pages[1].snips.map((s) => s.text), ["b1", "b2"]);
});

test("pagesOf: the same page address under different ids (a trailing slash, a #fragment) is one page; ids stay the first one's", () => {
  const pages = pagesOf([{ n: "S1", url: "https://a.test/x/" }, { n: "S4", url: "https://a.test/x#top" }, { n: "S2", url: "https://b.test/" }]);
  assert.deepEqual(pages.map((p) => p.n), ["S1", "S2"]);
  assert.equal(pages[0].snips.length, 2);
});

test("pagesOf: snips with no id or address are each their own page; junk is skipped", () => {
  assert.equal(pagesOf([{ text: "a" }, { text: "b" }, null]).length, 2);
  assert.deepEqual(pagesOf(null), []);
});

test("pageIndexOf: a citation chip finds its page by S# or by the page address", () => {
  const pages = pagesOf([{ n: "S1", url: "https://a.test/x" }, { n: "S2", url: "https://b.test/y/" }]);
  assert.equal(pageIndexOf(pages, "S2"), 1);
  assert.equal(pageIndexOf(pages, "https://b.test/y"), 1);
  assert.equal(pageIndexOf(pages, "https://b.test/y#frag"), 1);
  assert.equal(pageIndexOf(pages, "S9"), -1); assert.equal(pageIndexOf(pages, ""), -1);
});
