// A chat turn's live feed: web.searchWeb's onStep events and the app's stage lines become the coding lane's feed
// events (fold-chat-turnfeed.js) — pure, with a fake clock.
import test from "node:test";
import assert from "node:assert/strict";
import { newTurnTrace, startEvents, lineEvent, beginStep, endStep, noteEvent, doneEvents, eventsForStep, verbOf, summaryLine, storeEvents, fallbackProcessLine } from "./fold-chat-turnfeed.js";

const clock = () => { let t = 1000; const f = () => t; f.tick = (ms) => { t += ms; }; return f; };
const mk = (q = "Who founded the city of Nashville, and when?") => { const now = clock(); return { now, c: newTurnTrace({ now, question: q }) }; };
const ops = (evs) => evs.map((e) => `${e.op}${e.id ? ":" + e.id : ""}`);

test("the turn starts with the feed's own start and a classification line", () => {
  const { c } = mk();
  const evs = startEvents(c, { kindWord: "question of fact" });
  assert.equal(evs[0].type, "start");
  assert.equal(evs[1].op, "line"); assert.equal(evs[1].title, "Read your question"); assert.equal(evs[1].note, "question of fact");
});

test("a source asked: begin with its own slow budget, end with the real elapsed time and a result count", () => {
  const { c, now } = mk();
  const b = eventsForStep(c, { phase: "searching", scope: "wikipedia", q: "Nashville" });
  assert.deepEqual(ops(b), ["begin:q:wikipedia:Nashville", "verb"]);
  assert.match(b[0].title, /^Asking Wikipedia about “Nashville”$/);
  assert.equal(b[0].slowAfter, 3000);
  assert.match(b[0].slow, /^waiting on Wikipedia \(slow: over 3 s\)$/);
  assert.equal(b[1].text, "Waiting on Wikipedia");
  now.tick(2400);
  const e = eventsForStep(c, { phase: "found", scope: "wikipedia", q: "Nashville", n: 4 });
  assert.equal(e[0].op, "end"); assert.equal(e[0].ms, 2400); assert.equal(e[0].tone, "ok"); assert.equal(e[0].note, "4 results");
  assert.equal(e[0].title, "Asked Wikipedia");
  assert.equal(e[1].op, "verb"); assert.equal(e[1].text, "");
});

test("the web is searched with the declared 6 s budget named in its slow line", () => {
  const { c } = mk();
  const b = eventsForStep(c, { phase: "searching", scope: "web", q: c.question });
  assert.equal(b[0].title, "Searching the web");
  assert.equal(b[0].slowAfter, 6000);
  assert.match(b[0].slow, /waiting on the web \(slow: 6 s budget, then I go on without it\)/);
});

test("several sources in flight: the status line names all of them, and shrinks as they land", () => {
  const { c, now } = mk();
  eventsForStep(c, { phase: "searching", scope: "web", q: c.question });
  eventsForStep(c, { phase: "searching", scope: "wikipedia", q: "Nashville" });
  assert.equal(verbOf(c), "Waiting on the web and Wikipedia");
  now.tick(300);
  const e = eventsForStep(c, { phase: "found", scope: "wikipedia", q: "Nashville", n: 3 });
  assert.equal(e.find((x) => x.op === "verb").text, "Waiting on the web");
});

test("a failed source ends its row with the reason; a cooling-down one is info, not an error", () => {
  const { c, now } = mk();
  eventsForStep(c, { phase: "searching", scope: "github", q: "x" });
  now.tick(150);
  const f = eventsForStep(c, { phase: "failed", scope: "github", q: "x", why: "HTTP 403 rate limit exceeded" });
  assert.equal(f[0].op, "end"); assert.equal(f[0].tone, "bad"); assert.match(f[0].note, /rate limit/);
  const cool = eventsForStep(c, { phase: "failed", scope: "crossref", q: "x", why: "cooling down after a rate limit" });
  assert.equal(cool[0].op, "line"); assert.equal(cool[0].tone, "info");
});

test("the web closing on the budget is a real line; waiting for it is a note under its step", () => {
  const { c, now } = mk();
  eventsForStep(c, { phase: "searching", scope: "web", q: c.question });
  const w = eventsForStep(c, { phase: "waiting", scope: "web", why: "nothing else answered — waiting for the web" });
  assert.equal(w[0].op, "note"); assert.equal(w[0].tone, "warn");
  now.tick(6100);
  const f = eventsForStep(c, { phase: "failed", scope: "web", q: c.question, why: "slow (over 6 s) — went on without it" });
  assert.equal(f[0].ms, 6100); assert.equal(f[0].tone, "info");
});

test("a page read: 'read X', kept N of M chars; an unreadable one says so", () => {
  const { c, now } = mk();
  const url = "https://en.wikipedia.org/wiki/Nashville,_Tennessee";
  const b = eventsForStep(c, { phase: "reading", url, site: "en.wikipedia.org", title: "Nashville, Tennessee" });
  assert.equal(b[0].title, "Reading en.wikipedia.org — Nashville, Tennessee");
  assert.equal(b.find((x) => x.op === "verb").text, "Reading 1 page");
  now.tick(1800);
  const r = eventsForStep(c, { phase: "read", url, site: "en.wikipedia.org", title: "Nashville, Tennessee", chars: 24000, kept: 3000 });
  assert.equal(r[0].title, "Read en.wikipedia.org — Nashville, Tennessee");
  assert.equal(r[0].note, "kept 3,000 of 24,000 chars"); assert.equal(r[0].ms, 1800);
  eventsForStep(c, { phase: "reading", url: "https://x.example/a", site: "x.example", title: "A" });
  const u = eventsForStep(c, { phase: "unread", url: "https://x.example/a", site: "x.example", title: "A" });
  assert.equal(u[0].title, "Could not read x.example"); assert.equal(u[0].tone, "bad");
});

test("routing, the topic gates and the snippet shortcut become one-line decisions", () => {
  const { c } = mk();
  assert.match(eventsForStep(c, { phase: "routed", picked: ["web", "wikipedia"], skipped: ["github"], webDown: false })[0].note, /^the web \+ Wikipedia \(not GitHub\)$/);
  assert.equal(eventsForStep(c, { phase: "skipped", n: 2 })[0].note, "2 results did not match the ask");
  const d = eventsForStep(c, { phase: "demoted", n: 2, titles: ["Nashville SC", "2023 Nashville school shooting"] })[0];
  assert.equal(d.title, "Read look-alike pages last"); assert.match(d.note, /Nashville SC/);
  assert.equal(eventsForStep(c, { phase: "nope" }).length, 0);
});

test("the app's own steps: begin/end with the honest slow line, a note, and the closing summary closes open rows", () => {
  const { c, now } = mk();
  const b = beginStep(c, "write", "Writing the answer from 3 source(s) · gemma2:2b", { slowAfter: 8000, slow: "waiting on gemma2:2b (slow: a model on this machine can take 10–20 s)" });
  assert.equal(b[0].slowAfter, 8000);
  assert.equal(b.find((x) => x.op === "verb").text, "Writing the answer from 3 source(s) · gemma2:2b");
  assert.equal(noteEvent(c, "write", "the first words are coming in")[0].op, "note");
  now.tick(9000);
  const d = doneEvents(c, { ok: false, title: "Stopped after 9 s" });
  assert.deepEqual(ops(d), ["end:write", "done"]);
  assert.equal(d[0].ms, 9000); assert.equal(d[0].tone, "bad");
  assert.equal(d[1].title, "Stopped after 9 s");
  const e = endStep(mk().c, "ghost");   // ending an unknown step is harmless
  assert.equal(e[0].ms, 0);
});

test("a whole turn replays to the same rows: begin/end pairs balance and every end has its duration", () => {
  const { c, now } = mk();
  const all = [...startEvents(c, { kindWord: "question of fact" })];
  all.push(...eventsForStep(c, { phase: "searching", scope: "web", q: c.question }), ...eventsForStep(c, { phase: "searching", scope: "wikipedia", q: "Nashville" }));
  now.tick(400); all.push(...eventsForStep(c, { phase: "found", scope: "wikipedia", q: "Nashville", n: 2 }));
  now.tick(2600); all.push(...eventsForStep(c, { phase: "found", scope: "web", q: c.question, n: 8, engine: "DDG" }));
  all.push(...beginStep(c, "write", "Writing"));
  now.tick(5000); all.push(...endStep(c, "write", { tone: "ok", note: "41 tokens" }));
  all.push(...lineEvent(c, "Checked the answer against what was read"));
  all.push(...doneEvents(c, { ok: true, title: summaryLine({ ms: 8000, nSources: 3, model: "gemma2:2b" }) }));
  const begins = all.filter((e) => e.op === "begin").map((e) => e.id), ends = all.filter((e) => e.op === "end").map((e) => e.id);
  assert.deepEqual(begins.sort(), ends.sort());
  assert.ok(all.filter((e) => e.op === "end").every((e) => typeof e.ms === "number"));
  assert.equal(all[all.length - 1].op, "done");
  const stored = storeEvents(all);
  assert.deepEqual(stored.map((e) => e.op), all.map((e) => e.op));
  assert.equal(JSON.stringify(stored).includes("function"), false);
});

test("summaryLine: one honest line per way a turn can end", () => {
  assert.equal(summaryLine({ ms: 12400, nSources: 3, model: "gemma2:2b" }), "Answered in 12 s · read 3 sources · gemma2:2b");
  assert.equal(summaryLine({ ms: 2300, nSources: 1, mode: "snips" }), "Answered in 2.3 s · read 1 source · no model");
  assert.match(summaryLine({ ms: 5000, nSources: 2, fellBack: true }), /^Answered from the sources in 5\.0 s · the model declined · read 2 sources$/);
  assert.match(summaryLine({ ms: 800, gap: true }), /^No answer in under 1 s · no source reached$/);
  // #3: an UNTRACEABLE model answer is never summarised as "no model reachable"
  assert.match(summaryLine({ ms: 5000, nSources: 2, fellBack: "untraceable" }), /^Answered from the sources in 5\.0 s · the model's answer was not traceable to the read pages · read 2 sources$/);
});

test("fallbackProcessLine: the reason is named, and an untraceable answer is never called 'no model reachable'", () => {
  const untraceable = fallbackProcessLine({ kind: "fold", reason: "untraceable", gate: "the model's words could not be traced to what was read" });
  assert.match(untraceable, /could not be traced to what was read/);
  assert.doesNotMatch(untraceable, /no model reachable/);
  assert.doesNotMatch(untraceable, /model did not answer/);
  // the genuine no-model fallback still says so
  assert.match(fallbackProcessLine({ kind: "fold" }), /\(no model reachable\)/);
  assert.match(fallbackProcessLine({ kind: "declined", gate: "the provider refused" }), /\(the provider refused\)/);
});

test("storeEvents bounds the trace and always keeps the closing line", () => {
  const evs = Array.from({ length: 200 }, (_, i) => ({ type: "t", op: "line", title: "x".repeat(500), tone: "ok", junk: () => 1, at: i }));
  evs.push({ type: "t", op: "done", ok: true, title: "end" });
  const st = storeEvents(evs, { max: 60 });
  assert.equal(st.length, 60); assert.equal(st[59].op, "done");
  assert.ok(st[0].title.length <= 200); assert.equal(st[0].junk, undefined);
});
