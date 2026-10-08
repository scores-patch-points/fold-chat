// fold-chat-dmd.test.mjs — the measured stop, FALSIFIED.
//
// The claim: the fold turn stops on the MEASURED DECAY of its own trajectory
// (streaming DMD), not on the fuel counter; the fuel is a floor. Each test
// attacks the claim with a trajectory built to break it.
//
// The falsification already found two defects and they are encoded here:
//   F1 · a CONSTANT second coordinate cannot carry phase — with nonmoving as the
//        second observable a clean 2-cycle fit a real positive rate and the
//        oscillation branch went deaf. Fixed: the second coordinate is the
//        residual LAG (a delay embedding, Takens), and the first pass only seeds
//        the lag (a delay coordinate is a history; a first pass has none).
//   F2 · |λ| = 1 sits on the boundary; the kernel's exact `< 1` fired a flat
//        trajectory on float noise (0.9999999999999998). Guarded in the wrapper:
//        a magnitude within 1e-9 of 1 is carrying, never decay.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTurnGate, stopLine } from "./fold-chat-dmd.js";
import { runSpiral } from "./fold-chat-cube.js";

const rep = (n, ch = "x") => ch.repeat(n);

test("decayed: a settling residual (8→4→2→1) fires `decayed`, and the run STOPS BEFORE THE FLOOR", async () => {
  const gate = createTurnGate();
  const lens = [8, 4, 2, 1, 9, 9];
  let passes = 0;
  const { trace, acts } = await runSpiral({
    atom: {}, fuel: 6,
    step: async () => {
      gate.observe({ held: false, finding: rep(lens[passes++]) });
      const d = gate.decide();
      if (d.fire) return { acts: [{ kind: "think", text: d.reason }], done: true };
      return { recurse: { grain: "grain", reason: "again" } };
    },
  });
  assert.equal(passes, 4, "the measured decay stopped it at pass 4, not the floor of 6");
  assert.equal(acts[0].text, "decayed");
  assert.equal(trace.at(-1).stop, "done");
});

test("FALSIFIER: the SAME decaying trajectory with NO gate runs to the floor — the gate is what stopped it", async () => {
  let passes = 0;
  const { trace } = await runSpiral({ atom: {}, fuel: 6, step: async () => { passes += 1; return { recurse: { grain: "grain", reason: "again" } }; } });
  assert.equal(passes, 6);
  assert.equal(trace.at(-1).stop, "fuel");
});

test("carrying: a growing residual (1→2→4→8→16) never fires — the floor governs, honestly", async () => {
  const gate = createTurnGate();
  const lens = [1, 2, 4, 8, 16];
  let passes = 0;
  const { trace } = await runSpiral({
    atom: {}, fuel: 5,
    step: async () => {
      gate.observe({ held: false, finding: rep(lens[passes++]) });
      const d = gate.decide();
      if (d.fire) return { done: true };
      return { recurse: { grain: "grain", reason: "again" } };
    },
  });
  assert.equal(passes, 5);
  assert.equal(trace.at(-1).stop, "fuel");
});

test("F2 · flat: |λ| = 1 is NOT decay — a constant residual never fires (the epsilon guard holds)", () => {
  const gate = createTurnGate();
  for (const s of ["aaa", "bbb", "ccc", "ddd"]) gate.observe({ held: false, finding: s });
  const d = gate.decide();
  assert.equal(d.fire, false);
  assert.equal(d.reason, "carrying");
});

test("F1 · oscillating: a clean period-2 alternation fires `oscillating`, not `decayed`", () => {
  const gate = createTurnGate();
  for (const n of [3, 1, 3, 1, 3, 1]) gate.observe({ held: false, finding: rep(n) });
  const d = gate.decide();
  assert.equal(d.fire, true);
  assert.equal(d.reason, "oscillating");
  assert.ok(Math.abs(d.period - 2) < 1e-6, `period ${d.period}`);
});

test("insufficient_pairs: three passes have no trajectory to judge — the gate stays silent (the floor governs)", () => {
  const gate = createTurnGate();
  for (const n of [8, 4, 2]) gate.observe({ held: false, finding: rep(n) });
  const d = gate.decide();
  assert.equal(d.fire, false);
  assert.equal(d.reason, "insufficient_pairs");
});

test("a first pass seeds the lag and pushes nothing — no [r,0] transient enters the operator", () => {
  const gate = createTurnGate();
  gate.observe({ held: false, finding: rep(8) }); // seeds the lag, pushes nothing
  assert.equal(gate.pairs, 0);
  gate.observe({ held: false, finding: rep(4) }); // first push: one state, no pair yet
  assert.equal(gate.pairs, 0);
  gate.observe({ held: false, finding: rep(2) }); // second push: the first pair exists
  assert.equal(gate.pairs, 1);
});

test("held is residual 0; the first observation of a held turn is residual 0", () => {
  const gate = createTurnGate();
  const obs = gate.observe({ held: true, finding: null });
  assert.equal(obs.residual, 0);
});

test("stopLine names the mechanism, never the floor", () => {
  assert.match(stopLine({ fire: true, reason: "decayed", magnitude: 0.62 }), /decayed/);
  assert.match(stopLine({ fire: true, reason: "oscillating", period: 12.4 }), /oscillating/);
  assert.equal(stopLine({ fire: false }), "");
});
