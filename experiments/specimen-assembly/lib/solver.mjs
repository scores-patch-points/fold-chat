// solver.mjs — narrow a space of witnessed possibilities. No model is consulted here. Order of work, cheapest first:
// read the specimens (parse, interface, effects, needs) -> eliminate or hold -> run the survivors against the
// obligations (explored, bounded) -> learn scoped, verified nogoods from each counterexample -> commit the first
// combination every obligation holds for -> when nothing commits, try the trusted transformations, then name the gap.
import fs from "node:fs";
import { exportOf, collect } from "./specimen.mjs";
import { ADAPTERS, substituteCall, verifyReceipt } from "./transform.mjs";

export class Ledger {
  constructor(file = null) { this.events = []; this.file = file; if (file) fs.writeFileSync(file, ""); }
  add(kind, data = {}) {
    const e = { seq: this.events.length + 1, kind, ...data };
    this.events.push(e);
    if (this.file) fs.appendFileSync(this.file, JSON.stringify(e) + "\n");
    return e;
  }
  of(kind) { return this.events.filter((e) => e.kind === kind); }
}

// ---------------------------------------------------------------------------------------------- static reading
export function staticVerdict(program, spec, slotName, env) {
  const slot = program.slots[slotName];
  const reasons = [];
  let missing = [];
  if (!spec.parse.ok) reasons.push({ obligation: "S-parse", detail: spec.parse.error });
  else {
    const ex = exportOf(spec, slot.entry);
    if (!ex) reasons.push({ obligation: "S-interface", detail: `no exported function ${slot.entry}` });
    else {
      if (ex.params.length !== slot.arity) reasons.push({ obligation: "S-interface", detail: `${slot.entry} takes ${ex.params.length} parameters, slot wants ${slot.arity}` });
      missing = ex.needs.map((n) => { const [i, p] = [Number(n.split(":")[0]), n.split(":")[1]]; return `${slot.roles[i] ?? `p${i}`}.${p}`; }).filter((cap) => !env.caps.has(cap));
      if (missing.length) reasons.push({ obligation: "S-needs", detail: `calls ${missing.join(", ")}, not offered by the environment`, missing });
    }
    const obs = spec.effects.observed.filter((e) => program.forbiddenEffects.includes(e.kind));
    if (obs.length) reasons.push({ obligation: "S-effects", detail: `uses ${[...new Set(obs.map((o) => `${o.text} (${o.kind})`))].join(", ")}` });
    const bad = spec.props.filter((p) => program.prohibitedProps.includes(p));
    if (bad.length) reasons.push({ obligation: "S-privacy", detail: `reads prohibited identifier ${bad.join(", ")}` });
  }
  const unresolved = spec.parse.ok ? spec.effects.unresolved : [];
  const status = reasons.length ? "eliminated" : unresolved.length ? "unproved" : "ok";
  return { status, reasons, unresolved, missing };
}

const comboKey = (slots, combo) => slots.map((s) => combo[s].id).join("/");
const describe = (spec) => ({ id: spec.id, path: spec.provenance.path, origin: spec.provenance.origin, parents: spec.provenance.parents, assurance: spec.assurance });
function* product(slots, cands, i = 0, acc = {}) { if (i === slots.length) { yield { ...acc }; return; } for (const c of cands[slots[i]]) { acc[slots[i]] = c; yield* product(slots, cands, i + 1, acc); } delete acc[slots[i]]; }
const needCount = (spec, slotEntry) => (exportOf(spec, slotEntry) ? exportOf(spec, slotEntry).needs.length : 0);

// ---------------------------------------------------------------------------------------------- assemble
export async function assemble(program, pool, env, opts = {}) {
  const o = { bound: program.defaultBound, policy: "strict", learn: true, exhaustive: false, rescue: true, ...opts };
  o.bound = o.bound || program.defaultBound;
  const ledger = o.ledger || new Ledger();
  const slots = Object.keys(program.slots);
  const stats = { runs: 0, evals: 0, combosTried: 0, combosPruned: 0, staticEliminated: 0, held: 0, transforms: 0, nogoods: 0 };
  const scope = { assay: program.assayHash(o.bound), envSig: env.sig, bound: o.bound };
  const memo = o.memo || new Map();
  const cands = {}, held = {}, eliminated = {}, refusals = [];
  const seen = new Set();

  const admit = (slot, spec) => {
    const v = staticVerdict(program, spec, slot, env);
    if (!seen.has(slot + spec.id)) { seen.add(slot + spec.id); ledger.add("specimen", { slot, ...describe(spec), sha256: spec.sha256, exports: spec.exports.map((e) => e.name), needs: spec.exports.flatMap((e) => e.needs) }); }
    if (v.status === "eliminated") { eliminated[slot].push({ spec, ...v }); stats.staticEliminated++; ledger.add("eliminate", { slot, id: spec.id, path: spec.provenance.path, reasons: v.reasons }); }
    else if (v.status === "unproved" && o.policy === "strict") { held[slot].push({ spec, ...v }); stats.held++; ledger.add("unproved", { slot, id: spec.id, path: spec.provenance.path, obligation: "S-effects", unresolved: v.unresolved, note: "an unknown effect stays unknown; held out of the commit under the strict policy" }); }
    else { cands[slot].push(spec); if (v.status === "unproved") ledger.add("unproved", { slot, id: spec.id, obligation: "S-effects", unresolved: v.unresolved, note: "admitted under the permissive policy; still unproved" }); }
  };
  for (const slot of slots) { cands[slot] = []; held[slot] = []; eliminated[slot] = []; for (const spec of pool[slot] || []) admit(slot, spec); }

  const runObl = async (combo, obl) => {
    const k = comboKey(slots, combo) + "|" + obl;
    if (memo.has(k)) return memo.get(k);
    const r = await program.evaluate(combo, env, obl, o.bound);
    stats.runs += r.runs; stats.evals++;
    memo.set(k, r);
    return r;
  };
  const runCombo = async (combo) => { for (const obl of program.obligations) { const r = await runObl(combo, obl); if (!r.pass) return { pass: false, failed: r }; } return { pass: true }; };
  const nogoods = [];
  const pruned = (combo) => nogoods.some((n) => Object.entries(n.fixed).every(([s, id]) => combo[s].id === id));

  const generalise = async (combo, obl) => {
    const dropped = [];
    for (const s of slots) {
      const trial = [...dropped, s];
      let allFail = true;
      const sub = {}; for (const t of trial) sub[t] = cands[t];
      for (const variant of product(trial, sub)) {
        const r = await runObl({ ...combo, ...variant }, obl);
        if (r.pass) { allFail = false; break; }
      }
      if (allFail) dropped.push(s);
    }
    const fixed = Object.fromEntries(slots.filter((s) => !dropped.includes(s)).map((s) => [s, combo[s].id]));
    nogoods.push({ obl, fixed });
    stats.nogoods++;
    ledger.add("nogood", { obligation: obl, fixed, variesOver: dropped, basis: "verified by running every completion of the varied slots against this obligation", scope });
  };

  const solve = async () => {
    const empty = slots.filter((s) => cands[s].length === 0);
    if (empty.length) return { passes: [], empty };
    const combos = [...product(slots, cands)].sort((a, b) => {
      const na = slots.reduce((n, s) => n + needCount(a[s], program.slots[s].entry), 0), nb = slots.reduce((n, s) => n + needCount(b[s], program.slots[s].entry), 0);
      return na - nb || comboKey(slots, a).localeCompare(comboKey(slots, b));
    });
    const passes = [];
    for (const combo of combos) {
      if (pruned(combo)) { stats.combosPruned++; continue; }
      stats.combosTried++;
      const res = await runCombo(combo);
      if (res.pass) { passes.push(combo); if (!o.exhaustive) break; continue; }
      const r = res.failed;
      ledger.add("counterexample", {
        obligation: r.id, combo: Object.fromEntries(slots.map((s) => [s, combo[s].id])), paths: Object.fromEntries(slots.map((s) => [s, combo[s].provenance.path])),
        violation: r.counterexample.violation, fault: r.counterexample.fault, choices: r.counterexample.choices, ops: r.counterexample.ops, trace: r.counterexample.trace, steps: r.counterexample.steps, runsToFind: r.runs,
        scope, applicability: "this combination, this environment, this assay; other combinations containing the same candidate are marked for examination, not condemned",
      });
      if (o.learn) await generalise(combo, r.id);
    }
    return { passes, empty: [] };
  };

  let out = await solve();
  // nothing commits: try the trusted transformations on candidates eliminated only for a missing capability
  if (!out.passes.length && o.rescue) {
    let added = 0;
    for (const slot of slots) {
      for (const el of eliminated[slot]) {
        if (!el.reasons.every((r) => r.obligation === "S-needs")) continue;
        for (const cap of el.missing) {
          const [role, ...rest] = cap.split("."); const method = rest.join(".");
          const adapter = ADAPTERS.find((a) => a.from === method);
          if (!adapter) { refusals.push({ slot, id: el.spec.id, cap, reason: "no trusted adapter for this method" }); ledger.add("transform-refused", { slot, id: el.spec.id, cap, reason: "no trusted adapter for this method" }); continue; }
          const t = substituteCall(el.spec, { entry: program.slots[slot].entry, adapterId: adapter.id, paramIndex: program.slots[slot].roles.indexOf(role) }, env);
          if (!t.ok) { refusals.push({ slot, id: el.spec.id, cap, reason: t.reason }); ledger.add("transform-refused", { slot, id: el.spec.id, cap, rule: adapter.id, reason: t.reason, preconditions: t.preconditions }); continue; }
          const honest = verifyReceipt(el.spec.source, t.receipt, t.specimen.source);
          ledger.add("transform", { slot, from: el.spec.id, to: t.specimen.id, rule: t.receipt.rule, adapter: adapter.id, receiptVerified: honest, receipt: t.receipt });
          stats.transforms++;
          if (honest && staticVerdict(program, t.specimen, slot, env).status === "ok") { admit(slot, t.specimen); added++; }
        }
      }
    }
    if (added) out = await solve();
  }

  const slotOf = (combo) => Object.fromEntries(slots.map((s) => [s, combo[s].id]));
  if (out.passes.length) {
    const combo = out.passes[0];
    const guarantees = program.obligations.map((obl) => {
      const r = memo.get(comboKey(slots, combo) + "|" + obl);
      return { obligation: obl, status: r.exhausted ? "holds for every schedule of this scenario within the bound" : "no counterexample found within the bound (runs capped or sampled)", runs: r.runs, bound: o.bound, assumptions: r.capsUsed, assay: scope.assay };
    });
    const staticG = slots.map((s) => ({ obligation: `static:${s}`, status: combo[s].effects.unresolved.length ? `UNPROVED: ${combo[s].effects.unresolved.map((u) => u.reason).join("; ")}` : "read from the AST: no forbidden effect, needs offered, no prohibited identifier", assumptions: exportOf(combo[s], program.slots[s].entry).needs }));
    const commit = ledger.add("commit", { combo: slotOf(combo), paths: Object.fromEntries(slots.map((s) => [s, combo[s].provenance.path])), provenance: Object.fromEntries(slots.map((s) => [s, { origin: combo[s].provenance.origin, parents: combo[s].provenance.parents, transforms: combo[s].provenance.transforms.map((t) => t.rule) }])), guarantees, staticGuarantees: staticG, scope, unexamined: `${[...product(slots, cands)].length - stats.combosTried - stats.combosPruned} surviving combinations not run (first passing combination commits)` });
    return { status: "committed", combo, commit, guarantees, passes: out.passes, held, eliminated, stats, ledger, scope, memo, cands, env };
  }

  // gap: say precisely what is missing
  const gap = { program: program.name, empty: [], failures: [], refusals, scope, eliminated: Object.fromEntries(slots.map((s) => [s, eliminated[s].map((e) => ({ id: e.spec.id, path: e.spec.provenance.path, reasons: e.reasons }))])) };
  for (const slot of out.empty) {
    gap.empty.push({
      slot, required: { entry: program.slots[slot].entry, arity: program.slots[slot].arity, roles: program.slots[slot].roles },
      eliminated: eliminated[slot].map((e) => ({ id: e.spec.id, path: e.spec.provenance.path, reasons: e.reasons })), held: held[slot].map((h) => ({ id: h.spec.id, path: h.spec.provenance.path, unresolved: h.unresolved })),
    });
  }
  if (!out.empty.length) {
    const all = [...product(slots, cands)];
    const sample = all.length <= 12 ? all : all.slice(0, 12);
    for (const combo of sample) {
      const failing = [];
      for (const obl of program.obligations) { const r = await runObl(combo, obl); if (!r.pass) failing.push({ obligation: obl, violation: r.counterexample.violation, ops: r.counterexample.ops, trace: r.counterexample.trace, steps: r.counterexample.steps }); }
      gap.failures.push({ combo: slotOf(combo), paths: Object.fromEntries(slots.map((s) => [s, combo[s].provenance.path])), failing });
    }
    gap.failures.sort((a, b) => a.failing.length - b.failing.length);
    gap.nearest = gap.failures[0] || null;
  }
  ledger.add("gap", { gap });
  return { status: "gap", gap, held, eliminated, stats, ledger, scope, memo, cands, env };
}

// ---------------------------------------------------------------------------------------------- the distinguishing experiment
export async function distinguish(program, env, slot, specA, specB, context, bound = program.defaultBound) {
  const slots = Object.keys(program.slots);
  let runs = 0;
  for (const obl of program.obligations) {
    const ra = await program.evaluate({ ...context, [slot]: specA }, env, obl, bound);
    const rb = await program.evaluate({ ...context, [slot]: specB }, env, obl, bound);
    runs += ra.runs + rb.runs;
    if (ra.pass !== rb.pass) return { distinguished: true, obligation: obl, passes: { [specA.id]: ra.pass, [specB.id]: rb.pass }, counterexample: (ra.pass ? rb : ra).counterexample, runs };
  }
  return { distinguished: false, bound, runs, note: "no obligation separates them within the bound; assay-equivalent, not proven equivalent" };
}

// ---------------------------------------------------------------------------------------------- environment change
export async function reassemble(program, pool, prev, newEnv, opts = {}) {
  const slots = Object.keys(program.slots);
  const ledger = opts.ledger || prev.ledger;
  const removed = [...prev.env.caps].filter((c) => !newEnv.caps.has(c));
  const reopened = [];
  for (const s of slots) {
    const ex = exportOf(prev.combo[s], program.slots[s].entry);
    const needs = ex.needs.map((n) => { const [i, p] = [Number(n.split(":")[0]), n.split(":")[1]]; return `${program.slots[s].roles[i]}.${p}`; });
    if (needs.some((c) => removed.includes(c))) reopened.push(s);
  }
  const invalid = prev.guarantees.filter((g) => g.assumptions.some((a) => removed.includes(a))).map((g) => g.obligation);
  ledger.add("invalidate", { removedCapabilities: removed, reopenedSlots: reopened, guaranteesInvalidated: invalid });
  const kept = slots.filter((s) => !reopened.includes(s));
  const pool2 = Object.fromEntries(slots.map((s) => [s, reopened.includes(s) ? pool[s] : [prev.combo[s]]]));
  const res = await assemble(program, pool2, newEnv, { ...opts, ledger });
  return { ...res, reopened, kept, removed, invalidatedGuarantees: invalid };
}

// ---------------------------------------------------------------------------------------------- the specimen store and the model port
export class SpecimenStore {
  constructor() { this.entries = []; }
  add(slotName, program, spec, evidence) { this.entries.push({ program: program.name, slot: slotName, spec, evidence }); }
  poolFor(program, base = {}) {
    const pool = {};
    for (const s of Object.keys(program.slots)) {
      const mine = this.entries.filter((e) => e.program === program.name && e.slot === s).map((e) => e.spec);
      pool[s] = [...(base[s] || []), ...mine.filter((m) => !(base[s] || []).some((b) => b.id === m.id))];
    }
    return pool;
  }
}

export function gapRequest(program, gap) {
  const slot = gap.empty.length ? gap.empty[0].slot : Object.keys(program.slots)[0];
  const near = gap.nearest;
  return {
    task: `Write one ES module that exports a function ${program.slots[slot].entry} satisfying the interface and obligations below. Do not use clocks, randomness, network, timers or console.`,
    slot, interface: program.slots[slot], obligations: program.obligations,
    nearestAttempt: near ? { candidate: near.combo[slot] || near.combo, violates: near.failing.map((f) => ({ obligation: f.obligation, shortestFailingSequence: f.trace && f.trace[0], violation: f.violation })) } : null,
    failures: gap.failures.map((f) => ({ candidate: f.combo, violates: f.failing.map((x) => x.obligation) })),
  };
}

// call the model only if assembly has produced a gap; whatever comes back is an unverified candidate
export async function fillWithModel(program, store, base, env, { proposer, guard = (r) => r, maxCalls = 3, ledger = new Ledger(), bound, learn = true } = {}) {
  let modelCalls = 0, guardCalls = 0;
  const rejected = [];
  const memo = new Map();
  const solveNow = () => assemble(program, store.poolFor(program, base), env, { ledger, bound, learn, memo });
  let res = await solveNow();
  while (res.status !== "committed" && modelCalls < maxCalls) {
    const g = await guard(gapRequest(program, res.gap)); guardCalls++;
    const request = g && g.request ? g.request : g;   // a guard may return { request, unmask } (see lib/guard.mjs)
    const unmask = g && g.unmask ? g.unmask : (x) => x;
    ledger.add("model-request", { request });
    modelCalls++;
    const source = unmask(await proposer(request, modelCalls));
    const spec = collect({ source, origin: "model-proposed", note: `proposal ${modelCalls}`, assurance: "unverified" });
    const slot = request.slot;
    ledger.add("model-candidate", { id: spec.id, sha256: spec.sha256, assurance: "unverified", note: "enters the possibility space with no assurance; parsing, constraints and execution decide" });
    const tryPool = store.poolFor(program, base); tryPool[slot] = [...tryPool[slot], spec];
    const r2 = await assemble(program, tryPool, env, { ledger, bound, learn, memo });
    const used = r2.status === "committed" && r2.combo[slot].id === spec.id;
    if (used) {
      spec.assurance = `witnessed under assay ${r2.scope.assay} (bound ${JSON.stringify(r2.scope.bound)}); not proven`;
      store.add(slot, program, spec, { assay: r2.scope.assay, guarantees: r2.guarantees });
      ledger.add("model-candidate-accepted", { id: spec.id, assurance: spec.assurance });
      res = r2;
    } else {
      const why = r2.status === "gap" ? (r2.gap.failures.find((f) => Object.values(f.combo).includes(spec.id)) || { failing: [] }).failing.map((f) => ({ obligation: f.obligation, violation: f.violation })) : [{ obligation: "static", violation: "eliminated before execution" }];
      const stat = staticVerdict(program, spec, slot, env);
      rejected.push({ id: spec.id, static: stat.status, reasons: stat.reasons, violates: why });
      ledger.add("model-candidate-rejected", { id: spec.id, static: stat.status, staticReasons: stat.reasons, violates: why });
      res = r2;
    }
  }
  return { result: res, modelCalls, guardCalls, rejected, ledger };
}
