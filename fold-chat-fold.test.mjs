// fold-chat-fold.test.mjs — the fold: artifact + log + folded output, kept whole.
import test from "node:test";
import assert from "node:assert/strict";
import { createFold, addVersion, addEvent, addLog, artifactOf, foldedLines, authorship, snapshot, revive, FOLD_SCHEMA } from "./fold-chat-fold.js";

let t = 0; const now = () => (t += 1000);
const fresh = () => { t = 0; return createFold({ task: "a counter", id: "f1", now }); };
const PEN = { kind: "penelope" }, REM = { kind: "remote", model: "openai-fast" };

test("a fold starts empty, running, and says what it is", () => {
  const f = fresh();
  assert.equal(f.schema, FOLD_SCHEMA); assert.equal(f.status, "running"); assert.deepEqual(f.versions, []); assert.deepEqual(f.log, []);
  assert.equal(artifactOf(f), null); assert.deepEqual(foldedLines(f), []);
});

test("the first version is a first draft with no diff; the fold step is logged with its size", () => {
  const f = fresh();
  const v = addVersion(f, { round: 1, maker: PEN, code: "a\nb\nc", kind: "js", units: ["alpha"] });
  assert.equal(v.n, 1); assert.deepEqual(v.hunks, []); assert.equal(v.lines, 3);
  const stages = f.log.map((e) => e.stage);
  assert.ok(stages.includes("edit") && stages.includes("fold"));
  assert.equal(f.log.find((e) => e.stage === "edit").title, "first draft");
  assert.match(f.log.find((e) => e.stage === "fold").detail, /5 chars · 1 unit/);
});

test("falsifier: the EDIT between attempts is the REAL line diff — what was added and what was removed", () => {
  const f = fresh();
  addVersion(f, { round: 1, maker: PEN, code: "one\ntwo\nthree\nfour", kind: "js" });
  const v2 = addVersion(f, { round: 2, maker: REM, code: "one\nTWO\nthree\nfour\nfive", kind: "js" });
  assert.deepEqual(v2.diffStat, { added: 2, removed: 1 });
  const edit = f.log.filter((e) => e.stage === "edit")[1];
  assert.equal(edit.detail, "+2 −1 lines"); assert.equal(edit.by, "app");
  const ops = v2.hunks.flatMap((h) => h.lines).filter((l) => l.op !== "eq").map((l) => l.op + ":" + l.line);
  assert.deepEqual(ops, ["del:two", "add:TWO", "add:five"]);
});

test("an attempt that changed nothing is logged as exactly that — not as progress", () => {
  const f = fresh();
  addVersion(f, { round: 1, maker: PEN, code: "x", kind: "js" });
  addVersion(f, { round: 2, maker: PEN, code: "x", kind: "js" });
  const e = f.log.filter((x) => x.stage === "edit")[1];
  assert.equal(e.detail, "no change"); assert.equal(e.ok, false);
});

test("penelope's own per-unit record is logged AS penelope's, in its own stages", () => {
  const f = fresh();
  addVersion(f, { round: 1, maker: PEN, code: "function a(){}", kind: "js", activity: [{ tool: "swarm", status: "done", title: "a" }, { tool: "field", status: "done", title: "a" }, { tool: "mouth", status: "walled", title: "b" }, { tool: "gate", status: "failed", title: "spec-conformance" }] });
  const p = f.log.filter((e) => e.by === "penelope");
  assert.deepEqual(p.map((e) => e.stage), ["arrange", "draw", "draw", "verify", "fold"]);
  assert.equal(p.find((e) => e.title === "mouth · b").ok, false, "a walled unit is a failure on the record");
  assert.equal(p.find((e) => e.stage === "verify").ok, false);
});

test("a remote attempt is logged as the remote model's draw, named", () => {
  const f = fresh();
  addVersion(f, { round: 1, maker: PEN, code: "a", kind: "js" });
  addVersion(f, { round: 2, maker: REM, code: "<p>a</p>", kind: "html" });
  const e = f.log.find((x) => x.by === "remote:openai-fast");
  assert.ok(e); assert.equal(e.stage, "draw"); assert.match(e.title, /openai-fast wrote the revised file/);
});

test("loop events land in the log with the right stage, maker and verdict", () => {
  const f = fresh();
  addVersion(f, { round: 1, maker: PEN, code: "x", kind: "js" });
  addEvent(f, { type: "read", referents: 0, relations: 0, gaps: 0 });
  addEvent(f, { type: "requirements", terms: ["increment", "reset"] });
  addEvent(f, { type: "check", round: 1, name: "loads without errors", ok: false, detail: "SyntaxError (line 3)" });
  addEvent(f, { type: "check", round: 1, name: "penelope's own gate", ok: true });
  addEvent(f, { type: "derive", round: 1, ok: false, refuted: 2, held: 0 });
  addEvent(f, { type: "repair", round: 2, findings: ["a", "b", "c"] });
  addEvent(f, { type: "escalate", round: 2, why: "stuck", reason: "the same problems came back after a repair" });
  const by = (s) => f.log.filter((e) => e.stage === s).map((e) => e.by);
  assert.deepEqual(by("read"), ["khora", "app"]);
  assert.deepEqual(by("observe"), ["sandbox", "penelope"]);
  assert.equal(f.log.find((e) => e.by === "janus").ok, false);
  assert.match(f.log.find((e) => e.stage === "escalate").detail, /same problems came back/);
  assert.deepEqual(f.versions[0].problems, ["loads without errors: SyntaxError (line 3)"], "a failing check becomes a problem on its version");
});

test("done marks the fold held or gave-up, and the held version becomes THE artifact", () => {
  const f = fresh();
  addVersion(f, { round: 1, maker: PEN, code: "<p>1</p>", kind: "html" });
  addVersion(f, { round: 2, maker: REM, code: "<p>2</p>", kind: "html" });
  addVersion(f, { round: 3, maker: REM, code: "<p>3</p>", kind: "html" });
  addEvent(f, { type: "done", ok: true, rounds: 3, passed: 3 });
  assert.equal(f.status, "held"); assert.equal(artifactOf(f).n, 3);
  const g = fresh(); addVersion(g, { round: 1, maker: PEN, code: "x", kind: "js" }); addVersion(g, { round: 2, maker: REM, code: "<p/>", kind: "html" });
  addEvent(g, { type: "done", ok: false, rounds: 2, exhausted: true, findings: ["still bad"] });
  assert.equal(g.status, "gave-up"); assert.equal(artifactOf(g).kind, "html", "no version held: the latest page is shown, honestly marked gave-up");
});

test("stopped and failed are recorded as such", () => {
  const a = fresh(); addEvent(a, { type: "stopped", round: 1 }); assert.equal(a.status, "stopped");
  const b = fresh(); addEvent(b, { type: "error", round: 1, message: "heimdall refused" }); assert.equal(b.status, "failed"); assert.equal(b.log[0].ok, false);
});

test("the log is APPEND-ONLY: sequence numbers only grow, and entries already written never change", () => {
  const f = fresh();
  addLog(f, { stage: "read", title: "x" });
  const before = JSON.stringify(f.log[0]);
  addVersion(f, { round: 1, maker: PEN, code: "x", kind: "js" }); addEvent(f, { type: "done", ok: true, rounds: 1, passed: 1 });
  assert.equal(JSON.stringify(f.log[0]), before);
  assert.deepEqual(f.log.map((e) => e.seq), f.log.map((_, i) => i + 1));
});

// ───────────────────────── the folded output: who wrote each line ─────────────────────────

test("FOLDED: every line carries the attempt and maker that wrote it; unchanged lines keep their ORIGINAL author", () => {
  const f = fresh();
  addVersion(f, { round: 1, maker: PEN, code: "keep1\nold\nkeep2", kind: "js" });
  addVersion(f, { round: 2, maker: REM, code: "keep1\nnew\nkeep2\nadded", kind: "js" });
  const L = foldedLines(f, f.versions[1]);
  assert.deepEqual(L.map((l) => [l.text, l.round, l.maker.kind]), [["keep1", 1, "penelope"], ["new", 2, "remote"], ["keep2", 1, "penelope"], ["added", 2, "remote"]]);
  assert.deepEqual(L.map((l) => l.n), [1, 2, 3, 4]);
});

test("blame survives several attempts: a line rewritten twice belongs to the last writer; a line removed and never back is gone", () => {
  const f = fresh();
  addVersion(f, { round: 1, maker: PEN, code: "a\nb\nc", kind: "js" });
  addVersion(f, { round: 2, maker: REM, code: "a\nB\nc", kind: "js" });
  addVersion(f, { round: 3, maker: { kind: "agent-loop" }, code: "a\nB2\nc", kind: "js" });
  const L = foldedLines(f, f.versions[2]);
  assert.deepEqual(L.map((l) => [l.text, l.round]), [["a", 1], ["B2", 3], ["c", 1]]);
  assert.equal(authorship(L)[0].maker, "penelope");
});

test("authorship says who wrote how much", () => {
  const f = fresh();
  addVersion(f, { round: 1, maker: PEN, code: "1\n2\n3\n4", kind: "js" });
  addVersion(f, { round: 2, maker: REM, code: "1\nX\n3\n4", kind: "js" });
  const a = authorship(foldedLines(f));
  assert.deepEqual(a.map((x) => [x.maker, x.lines]), [["penelope", 3], ["remote:openai-fast", 1]]);
  assert.equal(a[0].share, 0.75);
});

test("a penelope version's units tag the lines they sit in", () => {
  const f = fresh();
  addVersion(f, { round: 1, maker: PEN, code: "function alpha() {\n  return 1;\n}\n\nfunction beta() {\n  return 2;\n}", kind: "js", units: ["alpha", "beta"] });
  const L = foldedLines(f);
  assert.deepEqual([L[0].unit, L[1].unit, L[4].unit, L[5].unit], ["alpha", "alpha", "beta", "beta"]);
});

// ───────────────────────── storage ─────────────────────────

test("snapshot is JSON-clean and bounded; revive gets it back; a stranger's object is refused", () => {
  const f = fresh();
  for (let i = 1; i <= 12; i++) addVersion(f, { round: i, maker: REM, code: "v" + i + "\n" + "x".repeat(50), kind: "js" });
  assert.ok(f.versions.length <= 8, "versions are capped");
  assert.equal(f.versions[0].round, 1, "the first draft is always kept");
  assert.equal(f.versions.at(-1).round, 12, "and the latest");
  const s = snapshot(f);
  assert.ok(!("_now" in s)); assert.doesNotThrow(() => JSON.stringify(s));
  const r = revive(JSON.parse(JSON.stringify(s)));
  assert.equal(r.versions.length, f.versions.length);
  assert.equal(revive({ schema: "other" }), null); assert.equal(revive(null), null);
  assert.deepEqual(foldedLines(r).length > 0, true);
});

test("oversized code is cut, never stored whole", () => {
  const f = fresh();
  const v = addVersion(f, { round: 1, maker: PEN, code: "x".repeat(300000), kind: "js" });
  assert.equal(v.chars, 200000);
});

test("falsifier: runAgent's own onVersion payload (code under `text`) lands in the fold with its code", async () => {
  const { runAgent } = await import("./fold-chat-agent.js");
  const f = fresh();
  const page = "<!doctype html><button id=a>+</button><script>document.getElementById('a').onclick=()=>{}</script>";
  await runAgent({
    task: "a script that clicks a button",
    dispatch: async () => ({ text: page, maker: { kind: "penelope" }, ms: 5 }),
    observe: async () => ({ checks: [], facts: {} }),
    pageToRemote: false, maxRounds: 1,
    onVersion: (v) => addVersion(f, v),
  });
  assert.equal(f.versions.length, 1);
  assert.ok(f.versions[0].code.includes("<button"), "the attempt's code must be stored, not an empty string");
  assert.ok(f.versions[0].lines >= 1);
});

test("framesOf: frames are the moments the CONTENT changes — never the actions taken about it", async () => {
  const { framesOf } = await import("./fold-chat-fold.js");
  const f = createFold({ task: "t" });
  addEvent(f, { type: "read", referents: 1, relations: 0 });                              // actions: not frames
  addEvent(f, { type: "requirements", terms: ["x"] });
  assert.equal(framesOf(f).length, 1, "before any code there is only the empty start");
  const one = ["function a() {", "  return 1;", "}", "", "function b() {", "  return 2;", "}"].join("\n");
  addVersion(f, { round: 1, maker: { kind: "penelope" }, kind: "js", code: one, units: ["a", "b"] });
  addEvent(f, { type: "check", round: 1, name: "loads", ok: true });                       // a check: not a frame
  addEvent(f, { type: "escalate", round: 2, why: "stuck" });                               // an escalation: not a frame
  let fr = framesOf(f);
  assert.deepEqual(fr.map((x) => x.kind), ["start", "unit", "unit"], "the first draft assembles unit by unit");
  assert.ok(fr[1].code.includes("function a") && !fr[1].code.includes("function b"), "frame 1 has only the first unit");
  assert.equal(fr[2].code, one); assert.equal(fr[2].complete, true); assert.equal(fr[1].complete, false);
  // attempt 2 changes two places → two change frames, each building on the last; attempt 3 is identical → no frame
  const two = one.replace("return 1;", "return 10;").replace("return 2;", "return 20;");
  addVersion(f, { round: 2, maker: { kind: "remote", model: "m" }, kind: "js", code: two });
  addVersion(f, { round: 3, maker: { kind: "remote", model: "m" }, kind: "js", code: two });
  fr = framesOf(f);
  assert.deepEqual(fr.map((x) => x.kind), ["start", "unit", "unit", "change", "change"], "an identical re-draft adds no frame");
  assert.ok(fr[3].code.includes("return 10;") && fr[3].code.includes("return 2;") && !fr[3].code.includes("return 20;"), "change 1 of 2 is applied, change 2 is not yet");
  assert.equal(fr[4].code, two); assert.equal(fr[4].complete, true);
  assert.deepEqual(fr[3].step, [1, 2]);
  assert.equal(fr.every((x, i) => x.n === i), true);
});

test("framesOf: a first draft with no units is one frame; a one-change edit is one 'revision' frame", async () => {
  const { framesOf } = await import("./fold-chat-fold.js");
  const f = createFold({ task: "t" });
  addVersion(f, { round: 1, maker: { kind: "remote", model: "m" }, kind: "html", code: "<b>one</b>\n<i>two</i>" });
  addVersion(f, { round: 2, maker: { kind: "remote", model: "m" }, kind: "html", code: "<b>ONE</b>\n<i>two</i>" });
  assert.deepEqual(framesOf(f).map((x) => x.kind), ["start", "first", "revision"]);
});
