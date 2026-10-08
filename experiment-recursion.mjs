// experiment-recursion.mjs — THE LOOP THAT CANNOT CLOSE ITSELF.
//
// The essay's claim, made mechanical against our own medium:
//   L3 (self-representation) IS achievable — the fold is a quine.
//   The STOP is NOT self-encodable — the loop closes only when an OUTSIDE
//   interpreter (a real test) injects measurable difference.
//
// Hypothesis H: the fold's recursion can terminate by its own trajectory alone.
// Falsifier: remove the outside interpreter (the real test's varying output) and
// the SAME machinery never fires — the floor governs.
//
//   node experiment-recursion.mjs
import { materialize, createBuild } from "./fold-chat-build.js";
import { runSpiral } from "./fold-chat-cube.js";
import { createTurnGate } from "./fold-chat-dmd.js";

const line = (s) => console.log(s);
const ok = (b) => (b ? "HOLDS " : "FAILS ");

// ── L3: the quine — the artifact is the fold of its own log ─────────────────
const { artifact, log } = await createBuild({
  units: [{ name: "hero", spec: "the opening" }],
  field: async () => ({ code: "<div>built from the field</div>", address: "corpus://a#0" }),
  test: async () => ({ ok: true, reason: "runs" }),
});
const replay = materialize(log);
line("L3 SELF-ENCODING (the quine) " + ok(replay.code === artifact.code));
line(`   project(log) === materialize(log): ${replay.code === artifact.code}  ·  ${artifact.units.length} unit, source=${artifact.units[0].source} @${artifact.units[0].address}`);
line("");

// ── the STOP: same machinery, outside interpreter present or absent ─────────
async function turn({ outside }) {
  const gate = createTurnGate();
  // The residual is what the REAL TEST returns. With no outside test (the mouth
  // stalls, the page never arrives), the system has only its own constant signal.
  const residual = outside ? [8, 4, 2, 1, 9, 9] : [1, 1, 1, 1, 1, 1];
  let passes = 0, stop = "fuel", fired = null;
  const { acts } = await runSpiral({
    atom: {}, fuel: 6,
    step: async () => {
      gate.observe({ held: false, residual: residual[passes++] });
      const d = gate.decide();
      if (d.fire) { stop = "dmd:" + d.reason; fired = d; return { acts: [{ text: d.reason }], done: true }; }
      return { recurse: { grain: "grain", reason: "again" } };
    },
  });
  return { passes, stop, fired, line: acts[0]?.text };
}

const closed = await turn({ outside: true });
const open = await turn({ outside: false });

line("THE STOP — outside interpreter PRESENT (the real test injects a decaying residual)");
line(`   ${ok(closed.stop.startsWith("dmd"))}stopped at pass ${closed.passes} on ${closed.stop} (floor was 6)`);
line("");
line("THE STOP — outside interpreter ABSENT (the system's own constant signal)");
line(`   ${ok(open.stop === "fuel")}ran to the FLOOR (${open.passes} passes, ${open.stop}) — the loop could not close itself`);
line("");

// ── the cycle: the loop names itself only when the difference is measurable ─
const g = createTurnGate();
for (const n of [3, 1, 3, 1, 3, 1]) g.observe({ held: false, residual: n });
const cyc = g.decide();
line("THE CYCLE — a measurable alternation");
line(`   ${ok(cyc.fire && cyc.reason === "oscillating")}fired ${cyc.reason} (period ${cyc.period}) — the system naming its own repetition`);
line("");

line("VERDICT: the fold self-encodes (L3 HOLDS); it cannot self-stop (the floor governs when no");
line("         outside interpreter varies the material). The closing interpreter is the REAL TEST —");
line("         and, past that, the reader. Penelope: the cloth held open by the one who reads it.");
