// fold-chat-bookscenes.test.mjs — the SCENES BENEATH the book fold: Murch-cut scenes, each event the book's
// own sentence verbatim at its byte address. The anti-hallucination guarantees, made checks (no model).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parse } from "./fold-chat-book.js";
import { bookGrammar, bookScenes, bookScenesFor, scenePromptFor, closedClass } from "./fold-chat-bookscenes.js";

const FILE = "/Users/mlacy/Documents/3.0/pg2600.txt";
const has = fs.existsSync(FILE);
if (has) {
  const raw = fs.readFileSync(FILE, "utf8");
  const parsed = parse(raw);
  const BOOK = { id: "war-and-peace", title: "War and Peace" };

  test("closedClass: returns a frequency head (the names the canon itself says are common ride in it; that is the accepted house trade)", () => {
    const c = closedClass(raw);
    assert.ok(c.size >= 60 && c.size <= 140);
    assert.ok(c.has("the"));
    assert.ok(!c.has("xenophobia"), "a rare word is not in the frequency head");
    assert.ok([...c].every((w) => w.length >= 1));
  });

  test("bookGrammar: one whole-book pass yields the verbs and the cast", () => {
    const g = bookGrammar(raw, BOOK);
    assert.ok(g.verbs instanceof Set && g.verbs.size > 200, "a discovered verb vocabulary");
    assert.ok(g.cast.length > 100, "the book's own cast");
    assert.ok(g.closed.size > 0);
  }, { timeout: 120000 });

  test("bookScenes: scenes cut inside the book, every event VERBATIM at its address and naming a being", () => {
    const g = bookGrammar(raw, BOOK);
    const r = bookScenes(raw, parsed, "Book One (1805)", { grammar: g, maxScenes: 4, maxEvents: 5 });
    assert.ok(r.cut >= 4, `scenes were cut (${r.cut})`);
    assert.ok(r.scenes.length >= 1);
    for (const sc of r.scenes) {
      assert.ok(sc.events.length >= 1, "a kept scene has events");
      for (const e of sc.events) {
        assert.ok(e.at >= 0 && e.at + e.len <= raw.length, "the address is inside the book");
        assert.equal(raw.slice(e.at, e.at + e.len), e.verbatim, "the event IS the book's bytes at its address");
        const f = e.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        assert.ok(g.cast.some((k) => new RegExp("\\b" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(f)), "the event sentence names a being (folded: accents and case do not hide it)");
      }
    }
    assert.ok(r.scenes.every((s) => s.at >= 0), "each scene is addressed");
  }, { timeout: 180000 });

  test("bookScenesFor the whole book: every event of every kept scene is the book's bytes at its address", () => {
    const g = bookGrammar(raw, BOOK);
    const all = bookScenesFor(raw, parsed, BOOK, { grammar: g, maxScenes: 2, maxEvents: 2 });
    assert.equal(all.per.length, 17);
    let ev = 0;
    for (const p of all.per) for (const sc of p.scenes) for (const e of sc.events) {
      ev++;
      assert.equal(raw.slice(e.at, e.at + e.len), e.verbatim);
    }
    assert.ok(ev > 30, `a real scene/event harvest (${ev})`);
  }, { timeout: 240000 });
}