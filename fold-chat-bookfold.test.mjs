// fold-chat-bookfold.test.mjs — the mechanical fold of a shelfed book: cast from capitalization,
// per-chapter event line, chapter→book fold, Houdini folding-out. No model, no IO.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parse, bookAsk, bookOffer } from "./fold-chat-book.js";
import { foldCast, eventLine, chaptersOf, plotFold, foldPrompt } from "./fold-chat-bookfold.js";

const BOOK = { title: "War and Peace", author: "Leo Tolstoy", translator: "Maude", home: "https://example/2600", via: "test" };

const RAW = `BOOK ONE

CHAPTER I

Pierre met Natasha at the Rostov house that cold winter evening. In this chapter we have seen Pierre and Natasha described at length by the author. Natasha laughed at Pierre across the crowded room. The snow fell on the empty street outside the window.

CHAPTER II

Natasha danced with Pierre again at the Rostov ball that night. Pierre watched Natasha from the far side of the long hall. Natasha smiled at Pierre when the music finally stopped.

BOOK TWO

CHAPTER I

Napoleon reviewed his troops on the hill before the battle began. Napoleon spoke to Pierre about the coming war with great confidence. Pierre nodded to Napoleon and said nothing at all in reply.
`;

test("foldCast: a being the book keeps capitalizing is admitted; a common word and a title are not", () => {
  const cast = foldCast(RAW, { min: 3 });
  const keys = cast.map((c) => c.key);
  assert.ok(keys.includes("pierre"), "Pierre is a being");
  assert.ok(keys.includes("natasha"), "Natasha is a being");
  assert.ok(keys.includes("napoleon"), "Napoleon is a being");
  assert.ok(!keys.includes("the"), "a common word is not a being");
  assert.ok(!keys.includes("author"), "the author is folded out (the telling)");
  assert.ok(cast.every((c) => c.n >= 3 && c.weight === Math.log(1 + c.n)), "degree + weight");
});

test("eventLine: the sentence a being is densest in wins; a telling-line that names beings is folded out", () => {
  const cast = foldCast(RAW, { min: 3 });
  const { best, foldedMeta } = eventLine("Pierre met Natasha at the Rostov house that cold winter evening. In this chapter we have seen Pierre and Natasha described at length by the author. Natasha laughed at Pierre across the crowded room.", cast);
  assert.ok(best, "an event line is found");
  assert.ok(best.named.includes("pierre") && best.named.includes("natasha"), "it names the beings");
  assert.ok(!/in this chapter|the author/i.test(best.t), "the telling-line is not the event line");
  assert.equal(foldedMeta, 1, "the telling-line that named a being was folded out");
});

test("chaptersOf: paragraphs group into chapters in story order with their byte spans", () => {
  const parsed = parse(RAW);
  const chs = chaptersOf(parsed);
  assert.equal(chs.length, 3);
  assert.deepEqual(chs.map((c) => c.book), ["Book One", "Book One", "Book Two"]);
  assert.deepEqual(chs.map((c) => c.chapter), ["I", "II", "I"]);
  assert.ok(chs.every((c) => c.start < c.end));
});

test("plotFold: chapters fold into books, each book to its strongest event line, addressed", () => {
  const parsed = parse(RAW);
  const fold = plotFold(parsed.text, parsed, BOOK, "explain the plot", { castMin: 3 });
  assert.equal(fold.chapterCount, 3);
  assert.equal(fold.books.length, 2);
  assert.deepEqual(fold.books.map((b) => b.label), ["Book One", "Book Two"]);
  assert.ok(fold.books.every((b) => b.fold && b.foldWhere), "every book folds to a line");
  assert.equal(fold.passages.length, 2, "one passage per book fold");
  assert.ok(fold.passages[0].ref.startsWith("War and Peace — Book One"), "the passage carries its place");
  assert.ok(fold.passages.every((p) => p.text && p.at && p.at.start < p.at.end), "every fold line is addressed");
  assert.ok(fold.plot.some((p) => /Pierre|Natasha/.test(p.line || "")), "the plot is drawn from the beings");
});

test("foldPrompt: says what it holds, the cast, and that no model wrote it", () => {
  const parsed = parse(RAW);
  const fold = plotFold(parsed.text, parsed, BOOK, "explain the plot", { castMin: 3 });
  const prompt = foldPrompt(BOOK, fold, "explain the plot");
  assert.match(prompt, /folded MECHANICALLY/);
  assert.match(prompt, /no model/);
  assert.match(prompt, /pierre/);
  assert.match(prompt, /The plot, one line per book/);
});

test("bookAsk: the system knows it holds the book, and whether the ask wants it read (vs a bare mention)", () => {
  assert.equal(bookAsk("summarize war and peace")?.book.id, "war-and-peace");
  assert.equal(bookAsk("summarize war and peace")?.content, true, "a summary ask wants the book read");
  assert.equal(bookAsk("what happens in war and peace")?.content, true);
  assert.equal(bookAsk("war and peace?")?.content, false, "a bare mention is an open ask, not yet a content ask");
  assert.equal(bookAsk("explain the plot of war and peace")?.content, true);
  assert.equal(bookAsk("why is the sky blue"), null);
});

test("bookOffer: the fold's own words when it could read the book or search the web", () => {
  const offer = bookOffer(bookAsk("war and peace?").book);
  assert.match(offer, /whole text of War and Peace/);
  assert.match(offer, /read it/);
  assert.match(offer, /search online/);
});

test("plotFold on the real War and Peace folds 365 chapters into 17 books (if the corpus is present)", (t) => {
  const file = "/Users/mlacy/Documents/3.0/pg2600.txt";
  if (!fs.existsSync(file)) return t.skip("pg2600.txt not present");
  const raw = fs.readFileSync(file, "utf8");
  const parsed = parse(raw);
  const fold = plotFold(raw, parsed, BOOK, "explain the plot of war and peace");
  assert.equal(fold.chapterCount, 365);
  assert.equal(fold.books.length, 17);
  assert.ok(fold.passages.length >= 15, "most books fold to a line");
  assert.ok(fold.withLine > 300, "most chapters keep an event line");
});
