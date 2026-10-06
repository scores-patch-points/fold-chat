// fold-chat-gates.test.mjs — the gate history (fold a900f6e) over the Pivot's gates. Falsifiers first: no history may EVER yield `pass`
// for a gate that has not rejected something, and a failed run is `fail` whatever its rejections.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { PIVOT_GATES, gateRows, noteRun, loadLedger, saveLedger, compact, report, verdictOf, gatesLine, totals, GATES_KEY } from "./fold-chat-gates.js";
import { createGateLedger, recordGate } from "./vendor/fold/gate-ledger.mjs";
import { gateVerdict } from "./vendor/fold/reasoning-stages.mjs";
import { pivotText } from "./fold-chat-pivot.js";

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), _m: m }; };
const clean = pivotText({ draft: "Honesty usually protects trust. It lets people rely on you.", ask: "x" });
const dirty = pivotText({ draft: "I'm so sorry to hear that. Take the 40 offer. Honesty matters.", ask: "x" });

test("the vendored copy is the fold's, byte for byte (a900f6e), and its own control holds: no input with rejected 0 yields pass", () => {
  const pin = JSON.parse(fs.readFileSync(new URL("./vendor/fold/VENDOR-FOLD.json", import.meta.url), "utf8"));
  assert.equal(pin.commit, "a900f6e");
  for (const [f, h] of Object.entries(pin.files)) {
    const have = crypto.createHash("sha256").update(fs.readFileSync(new URL("./vendor/fold/" + f.split("/").pop(), import.meta.url))).digest("hex");
    assert.equal(have, h, f + " drifted from its pin");
  }
  for (const rows of [0, 1, 50, 10 ** 6]) assert.notEqual(gateVerdict({ rows, rejected: 0, failed: 0 }), "pass");
  assert.equal(gateVerdict({ rows: 5, rejected: 0, failed: 1 }), "fail", "failure trumps 'never rejected' (the a900f6e precedence fix)");
});

test("with no history every Pivot gate is unmeasured, never pass", () => {
  const st = mem();
  const rep = report(loadLedger(st));
  assert.equal(rep.length, PIVOT_GATES.length);
  assert.ok(rep.every((r) => r.verdict === "unmeasured"));
  assert.match(gatesLine(rep), new RegExp(`${PIVOT_GATES.length} of ${PIVOT_GATES.length} checks have never withheld anything — shown, not measured`));
});

test("a clean run leaves every gate unmeasured however many clean runs there are; a caught sentence flips ONLY that gate to pass", () => {
  const st = mem();
  for (let i = 0; i < 25; i++) noteRun(clean, { storage: st, at: i });
  assert.ok(report(loadLedger(st)).every((r) => r.verdict === "unmeasured"), "25 clean runs prove nothing");
  const r = noteRun(dirty, { storage: st, at: 100 });
  assert.equal(r.gates.boilerplate, "pass");
  assert.equal(r.gates.number_not_given, "pass");
  assert.equal(r.gates.label, "unmeasured", "a gate that has not rejected anything stays unmeasured");
  assert.equal(r.gates.verify, "unmeasured");
});

test("a realiser the check refused is `fail` — whatever else has been rejected", () => {
  const st = mem();
  noteRun(dirty, { storage: st, at: 1 });
  const r = noteRun(clean, { verified: false, storage: st, at: 2 });
  assert.equal(r.gates.verify, "fail");
  assert.match(gatesLine(r.report), /1 gate failed/);
});

test("a turn the Pivot did not read (no grammar) records nothing and moves no verdict", () => {
  const st = mem();
  const skipped = pivotText({ draft: "สวัสดี", ask: "x", read: "th" });
  assert.deepEqual(gateRows(skipped), {});
  noteRun(skipped, { storage: st });
  assert.equal(st._m.has(GATES_KEY), false, "nothing was written");
});

test("history survives a JSON round trip; compaction keeps every gate's cumulative totals exactly and bounds the records", () => {
  const st = mem();
  for (let i = 0; i < 30; i++) noteRun(i % 3 === 0 ? dirty : clean, { storage: st, at: i });
  const before = loadLedger(st);
  const t0 = PIVOT_GATES.map((g) => totals(before, "pivot:" + g));
  const small = compact(before, 5);
  assert.ok(small.records.length <= 5 * PIVOT_GATES.length, "bounded: " + small.records.length);
  const t1 = PIVOT_GATES.map((g) => totals(small, "pivot:" + g));
  assert.deepEqual(t1, t0, "cumulative totals (rows, rejected, failed, runs) unchanged by compaction");
  saveLedger(small, st);
  assert.deepEqual(PIVOT_GATES.map((g) => totals(loadLedger(st), "pivot:" + g)), t0);
  assert.deepEqual(report(loadLedger(st)).map((r) => r.verdict), report(before).map((r) => r.verdict));
});

test("blocked or corrupt storage is an empty history (unmeasured), never a throw and never pass", () => {
  const throwing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  const r = noteRun(dirty, { storage: throwing });
  assert.ok(Object.values(r.gates).every((v) => v === "unmeasured" || v === "pass"));
  assert.doesNotThrow(() => loadLedger({ getItem: () => "{not json" }));
  assert.ok(report(loadLedger({ getItem: () => "{not json" })).every((x) => x.verdict === "unmeasured"));
});

test("verdictOf reasons match the fold's wording; gateRows counts what each gate withheld", () => {
  const led = createGateLedger();
  recordGate(led, { gate: "pivot:question", rows: 4, rejected: 0, at: 1 });
  assert.match(verdictOf(led, "question").reason, /never rejected anything across 1 run\(s\) — shown, not measured/);
  recordGate(led, { gate: "pivot:question", rows: 4, rejected: 2, at: 2 });
  assert.match(verdictOf(led, "question").reason, /has rejected before \(2 across 2 run\(s\)\)/);
  const r = gateRows(dirty);
  assert.equal(r.boilerplate.rejected, 1); assert.equal(r.number_not_given.rejected, 1); assert.equal(r.verify.failed, 0);
  assert.equal(gateRows(dirty, { verified: false }).verify.failed, 1);
});
