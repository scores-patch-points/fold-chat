// fold-chat-shelf.test.mjs — make it once. What holds is shelved; the next ask meets the shelf before a model.
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTask, similarity, createShelf, adaptPrompt, isNoChange, ago, hash53, EXACT_AT, NEAR_AT } from "./fold-chat-shelf.js";

const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const TIMER = "Build a single-file HTML countdown timer with Start, Pause and Reset buttons. It must show minutes and seconds, count down from 05:00, and stop at zero.";
const CODE = "<!doctype html><title>Countdown Timer</title><button>Start</button>";
let clock = 0;
const shelf = (o = {}) => createShelf({ storage: store(), now: () => new Date(Date.UTC(2026, 9, 5, 12, 0, clock++)).toISOString(), ...o });
const held = (task, code = CODE, extra = {}) => ({ task, code, checks: [{ name: "loads", ok: true }], origin: { lane: "sealed-remote", model: "openai-fast", ms: 9000 }, auditIds: ["a1", "a2"], savedBasis: { calls: 2, bytes: 4800, ms: 9000 }, ...extra });

test("normalizeTask: the same ask worded differently has the same key; different literals do not", () => {
  const a = normalizeTask("Build a countdown timer with Start, Pause and Reset buttons, from 05:00");
  const b = normalizeTask("Make a simple HTML countdown timer: buttons Start, Pause, Reset. Starts from 05:00");
  assert.equal(a.key, b.key);
  assert.notEqual(a.key, normalizeTask("Build a countdown timer with Start, Pause and Reset buttons, from 10:00").key);
  assert.deepEqual(a.numbers, ["05:00"]);
});

test("similarity: same words and literals = 1; different literal is capped below exact; unrelated is low", () => {
  const n = (s) => normalizeTask(s);
  assert.equal(similarity(n(TIMER), n(TIMER)), 1);
  const ten = similarity(n(TIMER), n(TIMER.replace("05:00", "10:00")));
  assert.ok(ten < EXACT_AT && ten >= NEAR_AT, "a different start time is a near match: " + ten);
  assert.ok(similarity(n(TIMER), n("a tip calculator with a Bill field")) < NEAR_AT);
});

test("falsifier: what was NOT built is never served — an empty shelf finds nothing", () => {
  const f = shelf().find(TIMER);
  assert.equal(f.kind, "none"); assert.equal(f.entry, null);
});

test("an exact repeat is found on the shelf — punctuation, case, filler words and word order do not matter", () => {
  const s = shelf(); const e = s.put(held(TIMER));
  const f = s.find("build a COUNTDOWN timer (single-file html page)!! with start, pause and reset buttons; it must show seconds and minutes, count down from 05:00 & stop at zero.");
  assert.equal(f.kind, "exact"); assert.equal(f.entry.id, e.id);
});

test("FALSIFIER (measured): word overlap cannot separate a rewording from a REAL difference, so neither is ever 'exact'", () => {
  const s = shelf(); s.put(held(TIMER));
  const dropsReset = "Build a single-file HTML countdown timer with Start and Pause buttons. It must show minutes and seconds, count down from 05:00, and stop at zero.";
  const addsAlarm = "Build a single-file HTML countdown timer with Start, Pause and Reset buttons and a sound alarm. It must show minutes and seconds, count down from 05:00, and stop at zero.";
  const reworded = "Make a simple countdown timer page: Start, Pause, Reset buttons, show minutes and seconds, from 05:00, stop at zero";
  const n = (t) => similarity(normalizeTask(TIMER), normalizeTask(t));
  assert.ok(n(dropsReset) > n(reworded), "a real difference scores HIGHER than a harmless rewording — overlap is not meaning");
  for (const t of [dropsReset, addsAlarm, reworded]) { const f = s.find(t); assert.equal(f.kind, "near", t); assert.ok(f.score < 1); }
});

test("a similar ask is a NEAR match — the shelved thing is what to change", () => {
  const s = shelf(); s.put(held(TIMER));
  const f = s.find("Build a single-file HTML countdown timer with Start, Pause and Reset buttons, count down from 10:00");
  assert.equal(f.kind, "near"); assert.ok(f.score >= NEAR_AT && f.score < 1);
});

test("an unrelated ask misses the shelf", () => {
  const s = shelf(); s.put(held(TIMER));
  assert.equal(s.find("Write a function that parses CSV with quoted fields").kind, "none");
});

test("put refuses what must not be shelved: no task, no code, code over the limit", () => {
  const s = shelf({ maxCodeBytes: 100 });
  assert.equal(s.put({ task: "", code: "x" }), null);
  assert.equal(s.put({ task: "t", code: "   " }), null);
  assert.equal(s.put({ task: "t", code: "x".repeat(101) }), null);
  assert.equal(s.stats().items, 0);
});

test("the same ask rebuilt replaces the older version and keeps its use count", () => {
  const s = shelf(); const a = s.put(held(TIMER, CODE + "<!--v1-->")); s.touch(a.id); s.touch(a.id);
  const b = s.put(held(TIMER, CODE + "<!--v2-->"));
  assert.equal(s.list().length, 1); assert.equal(b.rebuilt, true); assert.equal(b.uses, 2);
  assert.equal(s.find(TIMER).entry.code.slice(-9), "<!--v2-->");
});

test("the same code put twice is one entry (content-addressed)", () => {
  const s = shelf(); const a = s.put(held(TIMER)), b = s.put(held(TIMER));
  assert.equal(a.id, b.id); assert.equal(s.list().length, 1);
});

test("touch counts what an EXACT reuse actually saved — from the original build's own record — and a near reuse saves nothing it cannot prove", () => {
  const s = shelf(); const e = s.put(held(TIMER));
  s.touch(e.id, { reuse: "exact" }); s.touch(e.id, { reuse: "exact" }); s.touch(e.id, { reuse: "near" });
  const st = s.stats();
  assert.equal(st.uses, 3); assert.equal(st.savedCalls, 4); assert.equal(st.savedBytes, 9600); assert.equal(st.savedMs, 18000);
});

test("falsifier: a shelved thing that no longer holds is NOT served again", () => {
  const s = shelf(); const e = s.put(held(TIMER));
  s.markStale(e.id, "janus refuted: a click threw");
  assert.equal(s.find(TIMER).kind, "none");
  assert.equal(s.stats().stale, 1); assert.equal(s.stats().items, 0);
  s.put(held(TIMER, CODE + "<!--fixed-->"));
  assert.equal(s.find(TIMER).kind, "exact", "rebuilt, it is served again");
});

test("it survives a reload, and a full store never blocks a build", () => {
  const st = store();
  const a = createShelf({ storage: st }); a.put(held(TIMER));
  assert.equal(createShelf({ storage: st }).find(TIMER).kind, "exact");
  const full = createShelf({ storage: { getItem: () => null, setItem: () => { throw new Error("quota"); } } });
  assert.ok(full.put(held(TIMER)));
});

test("over budget, the least-used, oldest things go — never the newest", () => {
  const s = shelf({ max: 3 });
  const ids = [];
  for (let i = 0; i < 3; i++) ids.push(s.put(held("ask number " + i + " about widget" + i, CODE + i)).id);
  s.touch(ids[0]); s.touch(ids[0]); s.touch(ids[2]);
  const newest = s.put(held("a brand new thing entirely", CODE + "new"));
  assert.equal(s.list().length, 3);
  assert.ok(s.get(newest.id), "the newest stays"); assert.ok(s.get(ids[0]), "the most used stays"); assert.equal(s.get(ids[1]), null, "the unused one goes");
});

test("export and import round-trip, and import refuses garbage", () => {
  const a = shelf(); a.put(held(TIMER));
  const b = shelf(); assert.deepEqual(b.importJson(a.exportJson()), { added: 1 });
  assert.equal(b.find(TIMER).kind, "exact");
  assert.equal(b.importJson(a.exportJson()).added, 0, "no duplicates");
  assert.equal(b.importJson("not json").error, "not JSON");
  assert.equal(b.importJson('{"x":1}').error, "no entries");
});

test("adaptPrompt turns a near match into a SCOPED edit with NO CHANGE allowed — never a fresh build", () => {
  const p = adaptPrompt({ task: "from 10:00", priorTask: "from 05:00", code: CODE });
  assert.match(p, /already exists/); assert.match(p, /from 05:00/); assert.match(p, /SEARCH\/REPLACE/); assert.match(p, /exactly: NO CHANGE/);
  assert.ok(p.includes(CODE), "the shelved code is shown once");
  assert.ok(isNoChange("NO CHANGE") && isNoChange("  no change.\n") && isNoChange("NO_CHANGE"));
  assert.ok(!isNoChange("NO CHANGE needed, but here is more") && !isNoChange(""));
});

test("ago and hash53", () => {
  assert.equal(ago("2026-01-01T00:00:00Z", "2026-01-01T00:00:30Z"), "30s ago");
  assert.equal(ago("2026-01-01T00:00:00Z", "2026-01-01T02:00:00Z"), "2h ago");
  assert.equal(ago("2026-01-01T00:00:00Z", "2026-01-04T00:00:00Z"), "3d ago");
  assert.equal(hash53("abc"), hash53("abc")); assert.notEqual(hash53("abc"), hash53("abd"));
});
