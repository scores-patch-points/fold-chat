// fold-chat-eot.test.mjs — the EOT of a fold: penelope's Provenance@2, built in the browser, and held to its derivation.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { sha256Hex, stableProvenanceId, byteRange, EotLedger, eotFromFold, describeEvent } from "./fold-chat-eot.js";
import { createFold, addVersion, addEvent } from "./fold-chat-fold.js";

const node256 = (s) => createHash("sha256").update(s).digest("hex");

test("sha256 matches node's across lengths that cross the padding boundaries, empty, unicode and long input", () => {
  for (const s of ["", "a", "abc", "x".repeat(55), "x".repeat(56), "x".repeat(63), "x".repeat(64), "x".repeat(65), "x".repeat(119), "x".repeat(120), "héllo wörld — ∑ 日本語 🙂", "line\nbreak\r\n", "y".repeat(10000), JSON.stringify({ a: [1, 2, { b: "c" }] })]) assert.equal(sha256Hex(s), node256(s), JSON.stringify(s.slice(0, 20)) + " len " + s.length);
});

test("ids are derived exactly as penelope derives them: prefix_ + 20 hex of sha256(JSON.stringify(value))", () => {
  const v = { kind: "task", locator: "abc" };
  assert.equal(stableProvenanceId(v, "src"), "src_" + node256(JSON.stringify(v)).slice(0, 20));
  assert.match(stableProvenanceId({ n: 0 }, "evt"), /^evt_[0-9a-f]{20}$/);
});

const PENELOPE = "/Users/mlacy/Documents/3.0/penelope/organs/generation/provenance.mjs";
test("FIDELITY: the same sequence through penelope's own ProvenanceLedger and ours yields the IDENTICAL document", { skip: !existsSync(PENELOPE) && "penelope is not checked out beside this repo" }, async () => {
  const { ProvenanceLedger } = await import(PENELOPE);
  const build = (L) => {
    const s1 = L.source({ kind: "task", locator: "t1", anchor: { unit: "byte", start: 0, end: 40 } });
    const s2 = L.source({ kind: "draw", locator: "u1", meta: { m: 1 } });
    const e1 = L.event({ stage: "intent", source_id: s1, transform: "request→task" });
    const e2 = L.event({ stage: "arrange", source_id: s1, parent: e1, unit: "u1", transform: "unit-spec" });
    L.event({ stage: "draw", source_id: s2, parent: e2, unit: "u1", range: { unit: "byte", start: 0, end: 54 }, detail: { ok: true } });
    L.event({ stage: "draw", source_id: s2, parent: e2, unit: "u1", range: { unit: "byte", start: 0, end: 54 }, detail: { ok: true } });   // an exact repeat is deduped
    const ib = L.ibid(e1, { transform: "re-admit" });
    L.event({ stage: "fold", parent: ib, transform: "contributions→artifact", detail: { bytes: 54, units: 1 } });
    return L.eot({ root: "evt_root" });
  };
  const theirs = build(new ProvenanceLedger({ artifact: "html-or-code" })), ours = build(new EotLedger({ artifact: "html-or-code" }));
  assert.deepEqual(ours, theirs);
  assert.equal(ours.events.length, 5, "the repeated event was deduped by both");
});

test("a source is stored once; the same event twice is one event; ibid points back instead of duplicating", () => {
  const L = new EotLedger();
  const a = L.source({ kind: "k", locator: "x" }), b = L.source({ kind: "k", locator: "x" });
  assert.equal(a, b); assert.equal(L.sources.size, 1);
  const e1 = L.event({ stage: "read", source_id: a }), e2 = L.event({ stage: "read", source_id: a });
  assert.equal(e1, e2); assert.equal(L.events.length, 1);
  const ib = L.ibid(e1); assert.equal(L.events.at(-1).ibid, e1);
  assert.ok(ib.startsWith("evt_"));
});

// ───────────────────────── fold → EOT ─────────────────────────
let t = 0; const now = () => (t += 1000);
function sampleFold() {
  t = 0;
  const f = createFold({ task: "Build a counter with Increment and Reset buttons", id: "f", now });
  addEvent(f, { type: "read", referents: 0, relations: 0, gaps: 0 });
  addEvent(f, { type: "requirements", terms: ["increment", "reset"] });
  addVersion(f, { round: 1, maker: { kind: "penelope" }, kind: "js", code: "function alpha() {\n  return 1;\n}\n\nfunction beta() {\n  return 2;\n}", units: ["alpha", "beta"], activity: [{ tool: "swarm", status: "done", title: "alpha" }, { tool: "field", status: "done", title: "alpha" }, { tool: "mouth", status: "done", title: "beta" }, { tool: "gate", status: "passed", title: "spec-conformant" }] });
  addEvent(f, { type: "check", round: 1, name: "loads without errors", ok: false, detail: "SyntaxError" });
  addEvent(f, { type: "derive", round: 1, ok: false, refuted: 1, held: 0 });
  addEvent(f, { type: "repair", round: 2, findings: ["a script, not a page", "blank"] });
  addEvent(f, { type: "escalate", round: 2, why: "stuck", reason: "same problems" });
  addVersion(f, { round: 2, maker: { kind: "remote", model: "openai-fast" }, kind: "html", code: "<!doctype html>\n<button>Increment</button>\n<button>Reset</button>" });
  addEvent(f, { type: "check", round: 2, name: "controls respond", ok: true, detail: "clicked 2" });
  addEvent(f, { type: "done", ok: true, rounds: 2, passed: 2 });
  return f;
}

test("eotFromFold is a Provenance@2 document wrapped as ArrangementEOT@2, and it says who gave it", () => {
  const e = eotFromFold(sampleFold());
  assert.equal(e.schema, "ArrangementEOT@2"); assert.equal(e.provenance.schema, "Provenance@2");
  assert.equal(e.giver, "the-fold (browser)", "never claims to be penelope's own file");
  assert.deepEqual(e.provenance.addressSpace, { artifact: "folded-bytes", unit: "byte", encoding: "utf8" });
  assert.equal(e.prompt, "Build a counter with Increment and Reset buttons");
});

test("every event's source and parent exist, ids are unique, the root is the last event, and the chain starts at intent", () => {
  const { provenance: p } = eotFromFold(sampleFold());
  const ids = new Set(p.events.map((x) => x.event_id)), srcs = new Set(p.sources.map((s) => s.source_id));
  assert.equal(ids.size, p.events.length);
  for (const ev of p.events) { if (ev.source_id) assert.ok(srcs.has(ev.source_id), "source " + ev.source_id); if (ev.parent) assert.ok(ids.has(ev.parent), "parent " + ev.parent); }
  assert.equal(p.root, p.events.at(-1).event_id);
  assert.equal(p.events[0].stage, "intent");
});

test("the stages are penelope's own vocabulary, not invented ones", () => {
  const VOCAB = new Set(["intent", "prior", "read", "ground", "arrange", "draw-request", "draw", "hunt", "fold", "verify", "repair", "materialize", "ibid", "void"]);
  for (const ev of eotFromFold(sampleFold()).provenance.events) assert.ok(VOCAB.has(ev.stage), ev.stage);
});

test("a penelope attempt's units become draw events with the BYTE RANGE of that unit in the artifact", () => {
  const f = sampleFold(); const code = f.versions[0].code;
  const { provenance: p } = eotFromFold(f);
  const draws = p.events.filter((e) => e.unit === "beta" && e.range);
  assert.ok(draws.length, "a ranged event for unit beta");
  const r = draws[0].range;
  assert.equal(code.slice(r.start, r.end).trim().startsWith("function beta"), true, JSON.stringify(code.slice(r.start, r.end)));
  assert.ok(r.end <= new TextEncoder().encode(code).length);
});

test("penelope's field / hunt / mouth outcomes keep their own stage (field & mouth draw, hunt hunt, gate verify)", () => {
  const { provenance: p } = eotFromFold(sampleFold());
  const by = (u) => p.events.filter((e) => e.unit === u).map((e) => e.stage);
  assert.ok(by("alpha").includes("arrange") && by("alpha").includes("draw"));
  assert.ok(p.events.some((e) => e.stage === "verify" && e.detail?.via === "penelope"), "the gate is a verify event from penelope");
});

test("the EDIT between attempts is a repair event that points at the attempt before it, with the real change counts", () => {
  const { provenance: p } = eotFromFold(sampleFold());
  const rep = p.events.filter((e) => e.stage === "repair" && e.transform === "attempt→attempt");
  assert.equal(rep.length, 1);
  assert.ok(rep[0].detail.added > 0 && rep[0].detail.removed > 0);
  assert.ok(p.events.find((e) => e.event_id === rep[0].parent), "its parent is an earlier event");
});

test("every attempt is a source with its maker and its byte length — the contributions that were folded", () => {
  const e = eotFromFold(sampleFold());
  const arts = e.provenance.sources.filter((s) => s.kind === "artifact-version");
  assert.equal(arts.length, 2);
  assert.deepEqual(arts.map((s) => s.meta.maker.kind), ["penelope", "remote"]);
  assert.deepEqual(e.corpus.attempts.map((a) => a.attempt), [1, 2]);
  assert.equal(e.provenance.events.at(-1).stage, "materialize");
});

test("DETERMINISTIC: the same fold always yields the same EOT, ids included; a different fold does not", () => {
  const a = JSON.stringify(eotFromFold(sampleFold())), b = JSON.stringify(eotFromFold(sampleFold()));
  assert.equal(a, b);
  const f = sampleFold(); addEvent(f, { type: "stopped", round: 3 });
  assert.notEqual(JSON.stringify(eotFromFold(f)), a);
});

test("an empty fold still yields a valid, tiny EOT; the document is JSON-clean", () => {
  const e = eotFromFold(createFold({ task: "x", now }));
  assert.equal(e.provenance.events.length, 1); assert.equal(e.provenance.events[0].stage, "intent");
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(eotFromFold(sampleFold()))));
});

test("describeEvent gives the one-line view: stage, transform, unit, bytes, source, parent, verdict", () => {
  const e = eotFromFold(sampleFold()); const src = new Map(e.provenance.sources.map((s) => [s.source_id, s]));
  const d = describeEvent(e.provenance.events.find((x) => x.unit === "beta" && x.range), src);
  assert.equal(d.unit, "beta"); assert.match(d.range, /^bytes \d+–\d+$/); assert.match(d.source, /^artifact-version/); assert.equal(d.short.length, 8);
});

test("the trace lines up with the events one for one, and the cursor sees only attempts that exist by then", async () => {
  const { createFold, addVersion, addEvent } = await import("./fold-chat-fold.js");
  const { eotFromFold, versionAtCursor } = await import("./fold-chat-eot.js");
  const f = createFold({ task: "a counter" });
  addEvent(f, { type: "read", referents: 1, relations: 0 });
  addVersion(f, { round: 1, maker: { kind: "remote", model: "m" }, code: "<b>one</b>", kind: "html" });
  addEvent(f, { type: "check", round: 1, name: "page opens", ok: true });
  addVersion(f, { round: 2, maker: { kind: "remote", model: "m" }, code: "<b>two</b>\n<i>more</i>", kind: "html" });
  addEvent(f, { type: "done", ok: true, rounds: 2, passed: 1 });
  const trace = []; const eot = eotFromFold(f, { trace });
  assert.equal(trace.length, eot.provenance.events.length);
  trace.forEach((t, i) => assert.equal(t.event_id, eot.provenance.events[i].event_id));
  assert.equal(versionAtCursor(f, trace, 0), null, "at the very first event there is no draft yet");
  const firstDraw = trace.findIndex((t) => t.round === 1 && t.stage === "draw");
  assert.equal(versionAtCursor(f, trace, firstDraw).round, 1);
  const lastOfOne = trace.map((t) => t.round).lastIndexOf(1);
  assert.equal(versionAtCursor(f, trace, lastOfOne).round, 1, "attempt 2 does not exist yet at attempt 1's last event");
  assert.equal(versionAtCursor(f, trace, trace.length - 1).round, 2);
});

test("codeOfEvent: an edit event is the WHOLE file with every change marked; a unit's draw is exactly its bytes; checks carry no code", async () => {
  const { createFold, addVersion, addEvent } = await import("./fold-chat-fold.js");
  const { eotFromFold, codeOfEvent } = await import("./fold-chat-eot.js");
  const f = createFold({ task: "a counter" });
  const one = "function counter() {\n  return 0;\n}\n\nfunction inc() {\n  return 1;\n}";
  const two = "function counter() {\n  return 0;\n}\n\nfunction inc() {\n  return 2;\n}\n// é done";
  addVersion(f, { round: 1, maker: { kind: "penelope" }, kind: "js", code: one, units: ["counter", "inc"], activity: [{ tool: "field", status: "done", title: "counter" }, { tool: "mouth", status: "done", title: "inc" }] });
  addEvent(f, { type: "check", round: 1, name: "loads", ok: true });
  addVersion(f, { round: 2, maker: { kind: "remote", model: "m" }, kind: "js", code: two });
  addEvent(f, { type: "done", ok: true, rounds: 2, passed: 1 });
  const eot = eotFromFold(f), P = eot.provenance, srcs = new Map(P.sources.map((x) => [x.source_id, x]));
  const code = (pred) => P.events.map((e) => codeOfEvent(f, e, srcs)).filter(Boolean).find(pred);
  const edit2 = code((c) => c.kind === "diff" && c.round === 2);
  assert.ok(edit2, "attempt 2's edit event has a diff");
  assert.equal(edit2.from, 1);
  assert.equal(edit2.diff.filter((d) => d.op === "eq").length, 6, "the unchanged lines are all there, not just the hunk");
  assert.deepEqual(edit2.diff.filter((d) => d.op !== "eq").map((d) => d.op + ":" + d.line.trim()), ["del:return 1;", "add:return 2;", "add:// é done"]);
  const first = code((c) => c.kind === "diff" && c.round === 1);
  assert.equal(first.from, null); assert.equal(first.removed, 0, "the first draft is all additions");
  const unit = code((c) => c.kind === "range" && c.round === 1);
  assert.ok(unit && unit.text.length < one.length, "a unit's draw is a slice of the file");
  assert.ok(one.includes(unit.text), "and the slice is verbatim from the attempt");
  assert.equal(unit.startLine >= 1, true);
  const checks = P.events.filter((e) => e.stage === "verify" && e.transform === "artifact→observation");
  assert.ok(checks.length && checks.every((e) => codeOfEvent(f, e, srcs) === null), "a check changed no code");
  const mat = P.events.find((e) => e.stage === "materialize");
  assert.equal(codeOfEvent(f, mat, srcs).kind, "whole");
});
