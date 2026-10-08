// fold-chat-cube.test.mjs — the cube placement, the gate, and the recursion.
import { test } from "node:test";
import assert from "node:assert/strict";
import { RUNGS, RUNG_GRAIN, cellOf, cellLine, routeTurn, gateTurn, runSpiral } from "./fold-chat-cube.js";

test("cellOf: a rung names a grain, and the operator names a mode·domain·terrain·stance", () => {
  const c = cellOf("NUL", "grain");
  assert.equal(c.grain, "Ground");
  assert.equal(c.mode, "Differentiate");
  assert.equal(c.domain, "Existence");
  assert.equal(c.terrain, "Void");
  assert.equal(c.stance, "Clearing");
  assert.equal(c.rung, "grain");
});

test("cellOf: the three rungs are the three grains, 0 / n / 1", () => {
  assert.equal(cellOf("SIG", "terrain").grain, "Figure");
  assert.equal(cellOf("SIG", "terrain").terrain, "Entity");
  assert.equal(cellOf("SIG", "terrain").stance, "Binding");
  assert.equal(cellOf("REC", "domain").grain, "Pattern");
  assert.equal(cellOf("REC", "domain").terrain, "Paradigm");
  assert.equal(cellOf("REC", "domain").stance, "Composing");
});

test("cellOf: a grain may be named directly", () => {
  const c = cellOf("DEF", "Ground");
  assert.equal(c.grain, "Ground");
  assert.equal(c.mode, "Differentiate");
  assert.equal(c.domain, "Interpretation");
  assert.equal(c.terrain, "Atmosphere");
  assert.equal(c.rung, null);
});

test("cellOf: an unknown operator or rung is a TYPED GAP, never a silent cell", () => {
  assert.equal(cellOf("XXX", "grain").gap, "unknown_op");
  assert.equal(cellOf("NUL", "nonesuch").gap, "unknown_rung");
  assert.deepEqual(cellOf("NUL", "nonesuch").known, RUNGS);
});

test("cellLine names mode · terrain · stance; a gap names its reason", () => {
  assert.equal(cellLine(cellOf("NUL", "grain")), "Differentiate · Void · Clearing");
  assert.match(cellLine(cellOf("NUL", "nonesuch")), /no such rung/);
  assert.equal(cellLine(null), "");
});

test("routeTurn: the constitution's order — statable, given, refused, grounded, mechanical, shown", () => {
  assert.equal(routeTurn({ statable: false }).lane, "refuse");
  assert.equal(routeTurn({ given: "a prior" }).lane, "received");
  assert.equal(routeTurn({ refused: true }).lane, "refused");
  assert.equal(routeTurn({ grounded: "spans" }).lane, "grounded");
  assert.equal(routeTurn({ mechanical: "build" }).lane, "mechanical");
  assert.equal(routeTurn({}).lane, "shown");
});

test("gateTurn: the pipeline's signals map to lanes; grounded outranks mechanical", () => {
  assert.equal(gateTurn({ satisfiable: false }).lane, "refuse");
  assert.equal(gateTurn({ build: true }).lane, "mechanical");
  assert.equal(gateTurn({ hasMaterial: true }).lane, "grounded");
  assert.equal(gateTurn({ build: true, hasMaterial: true }).lane, "grounded");
  assert.equal(gateTurn({ given: "the reader's own file" }).lane, "received");
  assert.equal(gateTurn({ refused: true }).lane, "refused");
  assert.equal(gateTurn({}).lane, "shown");
});

test("runSpiral: a step may re-open an earlier rung; the chain is recorded", async () => {
  const seen = [];
  const { acts, trace } = await runSpiral({
    atom: "start", grain: "grain", fuel: 6,
    step: async (cur, i) => {
      seen.push(cur.grain);
      if (i < 2) return { acts: [{ kind: "think", op: "REC", text: `at ${cur.grain}` }], recurse: { atom: cur.atom + "+", grain: RUNGS[i + 1], reason: "climb" } };
      return { acts: [{ kind: "think", op: "SYN", text: "held" }], done: true };
    },
  });
  assert.deepEqual(seen, ["grain", "terrain", "domain"]);
  assert.equal(acts.length, 3);
  assert.equal(trace[0].recurse, "climb");
  assert.equal(trace[trace.length - 1].stop, "done");
});

test("runSpiral: fuel is a hard stop — it keeps going, and it stops", async () => {
  let n = 0;
  const { acts, trace } = await runSpiral({
    atom: "x", fuel: 4,
    step: async () => { n += 1; return { acts: [{ kind: "think", op: "REC" }], recurse: { grain: "grain", reason: "again" } }; },
  });
  assert.equal(n, 4);
  assert.equal(acts.length, 4);
  assert.equal(trace[trace.length - 1].stop, "fuel");
});

test("runSpiral: a throwing step is a recorded act, not a crash", async () => {
  const { acts, trace } = await runSpiral({ atom: "x", fuel: 3, step: async () => { throw new Error("boom"); } });
  assert.equal(acts.length, 1);
  assert.equal(acts[0].kind, "note");
  assert.match(acts[0].errors[0].msg, /boom/);
  assert.equal(trace[trace.length - 1].stop, "error");
});

test("runSpiral: no recurse and no done is a clean stop (no-recurse)", async () => {
  const { trace } = await runSpiral({ atom: "x", fuel: 3, step: async () => ({}) });
  assert.equal(trace[trace.length - 1].stop, "no-recurse");
});

test("runSpiral: requires a step", async () => {
  await assert.rejects(() => runSpiral({ atom: "x" }), TypeError);
});
