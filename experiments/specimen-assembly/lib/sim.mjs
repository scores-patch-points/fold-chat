// sim.mjs — a deterministic cooperative scheduler. Every call a specimen makes across a port (backend, provider)
// is an await point the scheduler controls, so "which request moves next" is an explicit choice vector and the
// whole space of interleavings up to a bound can be walked and any failing one replayed byte for byte.
import { AsyncLocalStorage } from "node:async_hooks";

export const taskOf = new AsyncLocalStorage();
const tick = () => new Promise((r) => setImmediate(r));

export class Run {
  constructor(choices = [], { maxSteps = 200 } = {}) {
    this.choices = choices; this.pos = 0; this.executed = []; this.branching = [];
    this.pending = []; this.trace = []; this.maxSteps = maxSteps; this.capsUsed = new Set(); this.stuck = false;
  }
  // a port call: runs `fn` atomically when the scheduler picks it
  port(name, fn, cap) {
    const task = taskOf.getStore() || "?";
    const label = `${task}:${name}`;
    if (cap) this.capsUsed.add(cap);
    return new Promise((resolve, reject) => {
      this.pending.push({ label, exec: () => { this.cur = task; try { resolve(fn()); } catch (e) { reject(e); } } });
    });
  }
  note(text) { this.trace.push(`  · ${text}`); }
  // start tasks (each is [label, async fn]) and drive them to completion. `inject(step, phase)` may inject a fault:
  // phase "pre" = after the previous op's continuation ran, before op `step` executes; "post" = right after op
  // `step` executed, before its continuation has run (the window in which an abort lands "after the provider accepted").
  async drive(tasks, inject) {
    const results = {};
    let open = tasks.length;
    for (const [label, fn] of tasks) {
      taskOf.run(label, () => {
        fn().then((v) => { results[label] = { ok: true, value: v }; open--; }, (e) => { results[label] = { ok: false, error: e }; open--; });
      });
    }
    let step = 0;
    for (;;) {
      await tick();
      if (open === 0) break;
      if (inject) inject(step, "pre");
      await tick();
      if (this.pending.length === 0) { if (open === 0) break; this.stuck = true; this.trace.push("  ! stuck: tasks unfinished, nothing pending"); break; }
      if (step >= this.maxSteps) { this.stuck = true; this.trace.push("  ! step budget exhausted"); break; }
      const idx = this.pos < this.choices.length ? this.choices[this.pos] : 0;
      this.branching.push(this.pending.length); this.executed.push(idx); this.pos++;
      const e = this.pending.splice(idx, 1)[0];
      this.trace.push(e.label);
      e.exec();
      if (inject) inject(step, "post");
      step++;
    }
    for (const [label] of tasks) if (!results[label]) results[label] = { ok: false, error: new Error("did not finish (stuck or step budget)") };
    return results;
  }
}

// walk every interleaving (and every fault) of `scenario(run, fault)` up to maxRuns.
// scenario returns null when its checks hold, or a violation string.
export async function explore(scenario, faults = [null], { maxRuns = 20000 } = {}) {
  let runs = 0, exhausted = true;
  let best = null;
  const capsUsed = new Set();
  for (const fault of faults) {
    const stack = [[]];
    while (stack.length) {
      if (runs >= maxRuns) { exhausted = false; break; }
      const prefix = stack.pop();
      const run = new Run(prefix);
      const violation = await scenario(run, fault);
      runs++;
      run.capsUsed.forEach((c) => capsUsed.add(c));
      if (violation) {
        const steps = run.trace.filter((l) => !l.startsWith("  ")).length;
        if (!best || steps < best.steps) best = { violation, fault, choices: run.executed.slice(), trace: run.trace.slice(), steps, scenario: scenario.id };
        break; // first failing schedule for this fault is enough; try the next fault for a shorter one
      }
      for (let d = prefix.length; d < run.branching.length; d++)
        for (let alt = 1; alt < run.branching[d]; alt++) stack.push(run.executed.slice(0, d).concat(alt));
    }
    if (runs >= maxRuns) { exhausted = false; break; }
  }
  return { counterexample: best, runs, exhausted, capsUsed: [...capsUsed] };
}

// replay a recorded counterexample: same fault, same choice vector, expect the same violation
export async function replay(scenario, cx) {
  const run = new Run(cx.choices);
  const violation = await scenario(run, cx.fault);
  return { violation, same: violation === cx.violation };
}
