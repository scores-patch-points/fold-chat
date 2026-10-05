// fold-chat-channels.test.mjs — one message, separate channels.
//   content           only what the model wrote
//   record.void       the gap, structured (voidReport) — text only via voidText
//   migration         a legacy "⟂ void — …" paragraph baked into content moves out
//   modelHistory      what may ride back to the model never carries system text
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  voidReport, voidText, voidLabel, normVoid, parseLegacyVoid, splitTrailingChannels,
  migrateMessage, migrateSessions, modelHistory, modelText,
} from "./fold-chat-channels.js";
import { turnRecord } from "./fold-chat-ground.js";
import { checkable, recordable, classifyTurn } from "./fold-chat-discourse.js";
import * as FOLD from "./vendor/the-fold/fold.js";

const passages = (n) => Array.from({ length: n }, (_, i) => ({
  ref: `Wikipedia — Article ${i + 1}`, source: `https://en.wikipedia.org/wiki/A${i + 1}`, url: `https://en.wikipedia.org/wiki/A${i + 1}`, text: "x".repeat(60),
}));
const rec = (grounded, total, extra = {}) => ({ kind: "research", coverage: { grounded, total }, ...extra });
const Q = "Who founded the city of Nashville, and when?";

// ── voidReport returns DATA ──────────────────────────────────────────────────
test("voidReport: nothing reached is a structured 'unreached' gap, not a string", () => {
  const v = voidReport(rec(0, 2), Q, [], [{ scope: "web", engine: "DuckDuckGo" }, { scope: "wikipedia", engine: "Wikipedia" }, { scope: "web", engine: "DuckDuckGo" }]);
  assert.equal(typeof v, "object");
  assert.equal(v.kind, "unreached");
  assert.deepEqual(v.counts, { sentences: 2, grounded: 0 });
  assert.deepEqual(v.read, []);
  assert.deepEqual(v.tried, ["DuckDuckGo", "Wikipedia"], "the engines tried, deduped");
  assert.equal(v.question, Q);
  assert.ok(Array.isArray(v.closeBy) && v.closeBy.length >= 2);
  assert.equal(voidLabel(v), "no source was reached");
});

test("voidReport: read-but-nothing-established carries the sources as {title,domain,url}", () => {
  const v = voidReport(rec(0, 3), Q, passages(2), null);
  assert.equal(v.kind, "unsupported");
  assert.deepEqual(v.read[0], { title: "Article 1", domain: "en.wikipedia.org", url: "https://en.wikipedia.org/wiki/A1" });
  assert.equal(v.read.length, 2);
  assert.equal(voidLabel(v), "nothing retrieved supports this");
});

test("voidReport: partial coverage names the counts; full coverage has no void", () => {
  const v = voidReport(rec(3, 6), Q, passages(3), null);
  assert.equal(v.kind, "partial");
  assert.deepEqual(v.counts, { sentences: 6, grounded: 3 });
  assert.equal(voidLabel(v), "3 of 6 sentences have no source");
  assert.equal(voidReport(rec(2, 2), Q, passages(1), null), null, "fully grounded: nothing missing");
  assert.equal(voidReport(null, Q, [], null), null);
});

test("voidReport: a creative turn (a poem) has no claims — never a void, however the search went", () => {
  assert.equal(voidReport(rec(0, 8, { kind: "generate", creative: true }), "write a poem", passages(1), null), null);
  assert.equal(voidReport(rec(0, 8, { kind: "generate" }), "write a poem", passages(1), null), null, "kind alone decides when the flag is absent");
  assert.equal(voidReport(rec(0, 8, { kind: "smalltalk" }), "hi", [], null), null);
});

test("voidText is the ONE-LINE text for the process panel; it is not the message", () => {
  const v = voidReport(rec(0, 3), Q, passages(2), null);
  const t = voidText(v);
  assert.match(t, /^⟂ void — read 2 source\(s\) — Article 1; Article 2 — none established the claim/);
  assert.match(t, /is still open; to close it: /);
  assert.equal(voidText(null), "");
});

test("voidText ↔ parseLegacyVoid round-trips every kind", () => {
  const cases = [
    voidReport(rec(0, 2), Q, [], [{ scope: "web", engine: "Web" }]),
    voidReport(rec(0, 3), Q, passages(3), null),
    voidReport(rec(3, 6), Q, passages(3), null),
  ];
  for (const v of cases) {
    const back = parseLegacyVoid(voidText(v), { coverage: { grounded: v.counts.grounded, total: v.counts.sentences } });
    assert.equal(back.kind, v.kind);
    assert.deepEqual(back.counts, v.counts);
    assert.equal(back.question, v.question);
    assert.deepEqual(back.closeBy, v.closeBy);
    if (v.kind === "unreached") assert.deepEqual(back.tried, v.tried);
    if (v.kind === "unsupported") assert.deepEqual(back.read.map((r) => r.title), v.read.map((r) => r.title));
  }
});

// ── splitting a legacy paragraph off content ────────────────────────────────
const LEGACY_POEM_VOID = '⟂ void — read 1 source(s) — Wikipedia — List of Nashville cast members — none established the claim; the search itself may have missed; "write a short poem about autumn in Nashville" is still open; to close it: a broader web/records/news search, or attach the document you are working from.';
const POEM = "Crimson leaves dance on Music's breeze,\nAutumn's touch paints Nashville trees.\n\nOn Broadway's stage, the crickets sing.";

test("splitTrailingChannels strips the trailing void paragraph, keeps the model's text verbatim", () => {
  const r = splitTrailingChannels(POEM + " \n\n\n" + LEGACY_POEM_VOID);
  assert.equal(r.content, POEM);
  assert.equal(r.void, LEGACY_POEM_VOID);
  assert.deepEqual(r.notes, []);
});

test("splitTrailingChannels is the identity on clean content (idempotent)", () => {
  assert.equal(splitTrailingChannels(POEM).content, POEM);
  assert.equal(splitTrailingChannels(POEM).void, null);
  const once = splitTrailingChannels(POEM + "\n\n" + LEGACY_POEM_VOID).content;
  assert.equal(splitTrailingChannels(once).content, once);
});

test("splitTrailingChannels also peels a '⟂ fold:' identity note, and a void after it", () => {
  const note = "⟂ fold: I don't have your name. The reply above asserted \"Bob\" — that is not grounded, and I withdraw it. Tell me your name and I'll keep it.";
  const r = splitTrailingChannels("Your name is Bob.\n\n" + note + "\n\n" + LEGACY_POEM_VOID);
  assert.equal(r.content, "Your name is Bob.");
  assert.deepEqual(r.notes, [note]);
  assert.equal(r.void, LEGACY_POEM_VOID);
});

test("splitTrailingChannels: a void whose question spans lines is still one paragraph; a glyph mid-sentence is untouched", () => {
  const multi = '⟂ void — no source was reached (tried Web); "two\nlines" is still open; to close it: a broader web/records/news search, or attach the document you are working from.';
  assert.equal(splitTrailingChannels("Answer.\n\n" + multi).content, "Answer.");
  const mid = "The mark ⟂ void — is a glyph the model might quote, mid-line.";
  assert.equal(splitTrailingChannels(mid).content, mid);
  assert.equal(splitTrailingChannels(LEGACY_POEM_VOID).content, "", "an answer that was only the void leaves no model text");
});

// ── migration ────────────────────────────────────────────────────────────────
test("migrateMessage: a creative (generate) legacy turn loses the void and ✱, keeps its words", () => {
  const m = { role: "assistant", content: POEM + "\n\n" + LEGACY_POEM_VOID, grounding: { kind: "generate", void: LEGACY_POEM_VOID, coverage: { grounded: 0, total: 3 }, process: ["classified · writing request", "void · " + LEGACY_POEM_VOID] } };
  assert.equal(migrateMessage(m), true);
  assert.equal(m.content, POEM);
  assert.equal(m.grounding.void, undefined, "a poem has no claims — no gap");
  assert.equal(m.grounding.creative, true);
  assert.ok(m.grounding.process.some((p) => p.startsWith("void · ")), "the process line keeps the history");
});

test("migrateMessage: a research legacy turn gets a structured record.void, with source urls from its own web trace", () => {
  const legacy = '⟂ void — read 2 source(s) — Wikipedia — Singham Again; Wikipedia — Which One — none established the claim; the search itself may have missed; "Which year was that again?" is still open; to close it: a broader web/records/news search, or attach the document you are working from.';
  const m = { role: "assistant", content: "1779 \n\n\n" + legacy, grounding: { kind: "research", coverage: { grounded: 0, total: 1 }, void: legacy, web: [{ scope: "wikipedia" }, { read: "https://en.wikipedia.org/wiki/Singham_Again" }, { read: "https://en.wikipedia.org/wiki/Which_One" }] } };
  assert.equal(migrateMessage(m), true);
  assert.equal(m.content, "1779");
  const v = m.grounding.void;
  assert.equal(typeof v, "object");
  assert.equal(v.kind, "unsupported");
  assert.deepEqual(v.counts, { sentences: 1, grounded: 0 });
  assert.deepEqual(v.read, [
    { title: "Singham Again", domain: "en.wikipedia.org", url: "https://en.wikipedia.org/wiki/Singham_Again" },
    { title: "Which One", domain: "en.wikipedia.org", url: "https://en.wikipedia.org/wiki/Which_One" },
  ]);
  assert.equal(v.question, "Which year was that again?");
});

test("migrateMessage: an unparseable void is kept raw as {kind:'legacy', text}; a void with no record moves to message.void", () => {
  const odd = "⟂ void — something a future build wrote that no parser knows.";
  const m = { role: "assistant", content: "Answer.\n\n" + odd, grounding: { kind: "research", coverage: { grounded: 0, total: 1 }, void: odd } };
  migrateMessage(m);
  assert.equal(m.content, "Answer.");
  assert.deepEqual(m.grounding.void, { kind: "legacy", text: odd });
  const bare = { role: "assistant", content: "Hi.\n\n" + LEGACY_POEM_VOID };
  migrateMessage(bare);
  assert.equal(bare.content, "Hi.");
  assert.equal(bare.void.kind, "unsupported");
  assert.equal(normVoid(odd).kind, "legacy");
  assert.equal(normVoid(null), null);
});

test("migrateMessage never touches a user message or an agent/generation record's own void", () => {
  const u = { role: "user", content: "Paste:\n\n" + LEGACY_POEM_VOID };
  assert.equal(migrateMessage(u), false);
  assert.equal(u.content, "Paste:\n\n" + LEGACY_POEM_VOID, "the user's text is never altered");
  const g = { role: "assistant", content: "essay", grounding: { generate: true, kind: "generate", void: { kind: "gap", reason: "no brief" } } };
  assert.equal(migrateMessage(g), false);
  assert.deepEqual(g.grounding.void, { kind: "gap", reason: "no brief" });
});

test("migrateSessions runs once per session, saves back (returns true), never loses a user message", () => {
  const sessions = { a: { id: "a", messages: [
    { role: "user", content: Q },
    { role: "assistant", content: "Founded 1779.\n\n" + LEGACY_POEM_VOID, grounding: { kind: "research", coverage: { grounded: 0, total: 1 }, void: LEGACY_POEM_VOID } },
  ] }, b: { id: "b", channels: 1, messages: [{ role: "assistant", content: "keep\n\n" + LEGACY_POEM_VOID }] } };
  assert.equal(migrateSessions(sessions), true);
  assert.equal(sessions.a.messages[0].content, Q);
  assert.equal(sessions.a.messages[1].content, "Founded 1779.");
  assert.equal(sessions.a.channels, 1);
  assert.match(sessions.b.messages[0].content, /⟂ void/, "a session already marked migrated is not rescanned");
  assert.equal(migrateSessions(sessions), false, "second pass is a no-op");
});

// ── what may ride back to the model ─────────────────────────────────────────
test("modelHistory: only what each author wrote — defensively strips an unmigrated void, drops an empty assistant turn", () => {
  const msgs = [
    { role: "user", content: Q },
    { role: "assistant", content: "Founded 1779.\n\n" + LEGACY_POEM_VOID },
    { role: "user", content: "again?" },
    { role: "assistant", content: "", notices: [{ kind: "refusal", text: "The model declined…" }] },
    { role: "system", content: "never" },
    { role: "user", content: "hello" },
  ];
  const h = modelHistory(msgs);
  assert.deepEqual(h.map((x) => x.role), ["user", "assistant", "user", "user"]);
  assert.equal(h[1].content, "Founded 1779.");
  assert.ok(!JSON.stringify(h).includes("⟂"));
  assert.equal(modelText(msgs[1]), "Founded 1779.");
});

const SYSTEM_STRINGS = [/⟂/, /✱/, /\bvoid\b/i, /is still open/, /to close it/, /none established the claim/, /citation removed/, /\[attachment read/, /\bON RECORD — .*NOT supported by that material: .*⟂/s];

test("REGRESSION: across a simulated 3-turn conversation no system-authored string ever reaches the model", () => {
  // Mirrors run(): classify → record → gap (voidReport) → message {content, grounding, notices}.
  const convo = [
    { q: Q, kind: "research", answer: "Nashville was founded in 1779.\nIt was named for Francis Nash.", mat: [{ ref: "Wikipedia — Nashville", source: "https://en.wikipedia.org/wiki/Nashville", text: "Nashville was founded in 1779 when the territory was still part of North Carolina. Named in honor of Francis Nash, a general of the Continental Army." }] },
    { q: "write a short poem about autumn in Nashville", kind: "generate", answer: "Crimson leaves dance on Music's breeze,\nAutumn's touch paints Nashville trees.", mat: [{ ref: "Wikipedia — List of Nashville cast members", source: "https://en.wikipedia.org/wiki/List", text: "Nashville is an American musical drama television series created by Callie Khouri and produced by R. J. Cutler." }] },
    { q: "Which year was that again?", kind: "research", answer: "1779", mat: [{ ref: "Wikipedia — Singham Again", source: "https://en.wikipedia.org/wiki/Singham_Again", text: "Singham Again is a 2024 Indian Hindi-language action film directed by Rohit Shetty." }] },
  ];
  const s = { messages: [], summary: FOLD.emptySummary() };
  let sawGap = 0, sawCreativeGap = 0;
  const requests = [];
  for (const [i, c] of convo.entries()) {
    s.messages.push({ role: "user", content: c.q });
    const history = modelHistory(s.messages);
    const msgs = FOLD.buildTurnMessages({ basePrompt: "persona", summary: s.summary, history: history.slice(0, -1), question: c.q, sourceBlock: "[W1] " + c.mat[0].ref + "\n" + c.mat[0].text, recencyWindow: history.length });
    requests.push(msgs);
    // — the turn lands
    const record = recordable(c.kind) ? turnRecord(c.answer, c.mat, { turn: i + 1, question: c.q }) : null;
    record.kind = c.kind; record.process = ["classified · " + c.kind];
    if (!checkable(c.kind)) { record.creative = true; record.unsupported = { numbers: [], names: [] }; }
    const gap = voidReport(record, c.q, c.mat.map((p) => ({ ...p, url: p.source })), null);
    if (gap) { record.void = gap; record.process.push("void · " + voidText(gap)); sawGap++; if (c.kind === "generate") sawCreativeGap++; }
    s.messages.push({ role: "assistant", content: c.answer, grounding: record });
    const fold = FOLD.mechanicalFoldLine(c.q, c.answer);
    s.summary = FOLD.addWarrantRecord(FOLD.advanceSummaryFold(s.summary, fold), FOLD.buildWarrantRecord({
      turn: i + 1, plane: "world", gist: fold, channels: ["web", "model"], refs: (record.sources || []).map((r) => r.address),
      unsupported: record.creative ? [] : [...record.unsupported.numbers, ...record.unsupported.names], open: [],
    }));
    s.summary.topic = s.summary.topic || c.q;
  }
  assert.ok(sawGap >= 1, "the simulation does produce a gap on a turn with unsupported claims");
  assert.equal(sawCreativeGap, 0, "and never on the poem");
  // the gap is in the record — and only there
  const withVoid = s.messages.filter((m) => m.grounding?.void);
  assert.ok(withVoid.length >= 1);
  for (const m of s.messages) assert.ok(!/⟂/.test(m.content), "content is only what the model wrote");
  for (const [i, msgs] of requests.entries()) {
    for (const m of msgs) {
      if (m.role === "system") continue;   // the persona/source/record blocks carry the fold's own instructions
      for (const re of SYSTEM_STRINGS) assert.ok(!re.test(m.content), `request ${i} ${m.role} message matches ${re}: ${m.content.slice(0, 80)}`);
    }
    const sys = msgs[0].content;
    assert.ok(!/⟂ void/.test(sys), `request ${i}: the system block carries no void paragraph`);
    assert.ok(!/NOT supported by that material:\s*(Crimson|Autumn|On Broadway)/.test(sys), "a poem's words are never recorded as 'not supported'");
  }
});

test("REGRESSION (static guard): fold-chat.js never glues text onto the model's content", () => {
  const src = fs.readFileSync(new URL("./fold-chat.js", import.meta.url), "utf8");
  assert.ok(!/\btext\s*=\s*text\s*\+/.test(src), "no `text = text + …` — content is only what the model wrote");
  assert.ok(!/voidNote/.test(src), "the void is data (voidReport), not a note appended as text");
  assert.ok(/modelHistory\(s\.messages\)/.test(src), "history is built through modelHistory");
  assert.ok(!/\.filter\(\(x\) => x\.role !== "system"\)\.map\(\(x\) => \(\{ role: x\.role, content: x\.content \}\)\)/.test(src), "no raw content → history map");
});

// ── answer modes + the model never speaks alone ─────────────────────────────
test("a sources-authored record has no void: it is never scored by the grounding check", () => {
  assert.equal(voidReport({ kind: "research", authored: "sources", coverage: { grounded: 0, total: 3 } }, "q", passages(2), []), null);
});

test("advice: no void unless the answer committed to a figure nothing read says", () => {
  const base = { kind: "advice", coverage: { grounded: 0, total: 3 }, unsupported: { numbers: [], names: [] } };
  assert.equal(voidReport(base, "tips to sleep", passages(2), []), null);
  assert.equal(voidReport({ ...base, unsupported: { numbers: ["8"], names: [] } }, "tips to sleep", passages(2), [])?.kind, "unsupported");
});

test("the new typed gaps: live data and nothing reachable carry their own labels and one-line text", () => {
  assert.equal(voidLabel({ kind: "live" }), "live data — nothing reachable");
  assert.match(voidText({ kind: "live", note: "Changes by the minute." }), /live data/);
  assert.equal(voidLabel({ kind: "unreached" }), "no source was reached");
});

test("voidReport 'unreached' carries what the TRACE says was searched and why it failed (app-authored)", () => {
  const trace = [{ scope: "web", q: "x", engine: "DuckDuckGo", n: 0, ok: true }, { scope: "wikipedia", q: "x", ok: false, why: "Wikipedia answered 429." }, { scope: "route", ok: true, engine: "source router", webDown: true }];
  const v = voidReport(rec(0, 1), "x", [], trace);
  assert.equal(v.kind, "unreached");
  assert.deepEqual(v.tried, ["DuckDuckGo", "Wikipedia"], "the router is not an engine");
  assert.equal(v.attempts.length, 2);
  assert.match(v.note, /Web \(DuckDuckGo\) returned 0 results/); assert.match(v.note, /Wikipedia failed \u2014 Wikipedia answered 429\. Nothing/); assert.doesNotMatch(v.note, /\.\./);
});

test("a migration never deletes the typed gap of a turn that has no answer (live / nothing reachable)", () => {
  const m = { role: "assistant", content: "", grounding: { kind: "generate", creative: true, void: { kind: "unreached", attempts: [], note: "n" } } };
  migrateMessage(m);
  assert.equal(m.grounding.void.kind, "unreached");
  const old = { role: "assistant", content: "x", grounding: { kind: "generate", creative: true, void: { kind: "unsupported", counts: { sentences: 1, grounded: 0 }, read: [], tried: [], question: "", closeBy: [] } } };
  migrateMessage(old);
  assert.equal(old.grounding.void, undefined, "a creative turn's CLAIM void is still dropped, as before");
});
