// lifecycle.mjs — program 1: a STAND-IN bounded request lifecycle (idempotent submit, retry, cancel, persistence,
// restart) over a simulated provider that does not dedupe by itself. It is the lifecycle sketched in the design
// note, not Heimdall's shipped code (Heimdall has no retry/cancel/poll yet). The skeleton below is the trusted
// partial program; the four slots are filled by specimens.
import { instantiate, sha256 } from "./specimen.mjs";
import { Run, explore, taskOf } from "./sim.mjs";

export const SLOTS = {
  key: { entry: "key", arity: 1, roles: ["req"] },
  store: { entry: "makeStore", arity: 1, roles: ["kv"] },
  retry: { entry: "retry", arity: 2, roles: ["run", "ctx"] },
  cancel: { entry: "cancelPolicy", arity: 2, roles: ["signal", "phase"] },
};

export function makeEnv(caps, slots = SLOTS) {
  const set = new Set(caps);
  return {
    caps: set,
    roleOf(entry, i) { const s = Object.values(slots).find((x) => x.entry === entry); return s ? s.roles[i] : `p${i}`; },
    sig: [...set].sort().join(","),
    without(...cs) { return makeEnv([...set].filter((c) => !cs.includes(c)), slots); },
  };
}
export const FULL_CAPS = ["kv.get", "kv.set", "kv.setnx", "kv.del", "kv.cas", "kv.incr", "ctx.provider.lookup", "ctx.provider.charge"];
export const ENV_FULL = makeEnv(FULL_CAPS);

// ---------------------------------------------------------------------------------------------- simulated world
function timeoutError(accepted) { const e = new Error("provider timeout"); e.name = "TimeoutError"; if (accepted === false) e.accepted = false; return e; }

export function makeWorld(run, env, { providerFault = null } = {}) {
  const kv = new Map();
  const charges = [];
  let chargeCalls = 0;
  run.events = run.events || [];
  const P = (name, fn) => run.port(name, fn, name);
  const all = {
    get: (k) => P("kv.get", () => kv.get(k)),
    set: (k, v) => P("kv.set", () => { kv.set(k, v); }),
    setnx: (k, v) => P("kv.setnx", () => { if (kv.has(k)) return false; kv.set(k, v); return true; }),
    del: (k) => P("kv.del", () => { kv.delete(k); }),
    cas: (k, exp, v) => P("kv.cas", () => { if (kv.get(k) === exp) { kv.set(k, v); return true; } return false; }),
    incr: (k) => P("kv.incr", () => { const n = (kv.get(k) || 0) + 1; kv.set(k, n); return n; }),
  };
  const backend = {};
  for (const [name, fn] of Object.entries(all)) if (env.caps.has(`kv.${name}`)) backend[name] = fn;
  const provider = {
    charge: (key, amount) => P("ctx.provider.charge", () => {
      chargeCalls++;
      if (providerFault === "timeout-before-accept" && chargeCalls === 1) throw timeoutError(false);
      const c = { id: `ch_${charges.length + 1}`, key, amount, by: run.cur };
      charges.push(c);
      run.note(`provider accepted ${c.id} for ${c.by}`);
      if (providerFault === "timeout-after-accept" && chargeCalls === 1) throw timeoutError();
      return { chargeId: c.id };
    }),
    lookup: (key) => P("ctx.provider.lookup", () => { const c = charges.find((x) => x.key === key); return c ? { chargeId: c.id } : null; }),
  };
  return { kv, charges, backend, provider };
}

// the trusted skeleton: the partial program whose four holes are the slots
export function makeHandler(parts, world, run) {
  const store = parts.makeStore(world.backend);
  return async function handle(req, signal) {
    const k = parts.key(req);
    const c = await store.claim(k);
    if (c.state === "done") return { status: "ok", chargeId: c.result.chargeId, cached: true };
    if (c.state === "pending") return { status: "pending" };
    const abortBefore = !!parts.cancelPolicy(signal, "before-charge");
    run.events.push({ type: "policy-before", task: taskOf.getStore(), signalAborted: signal.aborted, abort: abortBefore });
    run.note(`before-charge policy: signal.aborted=${signal.aborted} -> abort=${abortBefore}`);
    if (abortBefore) { await store.release(k); return { status: "cancelled" }; }
    let result;
    try {
      result = await parts.retry(() => world.provider.charge(k, req.amount), { provider: world.provider, key: k });
    } catch (e) {
      if (e && e.accepted === false) { await store.release(k); return { status: "error" }; }
      return { status: "unknown" };
    }
    if (parts.cancelPolicy(signal, "after-charge")) { run.note("after-charge policy honoured abort"); return { status: "cancelled" }; }
    await store.complete(k, result);
    return { status: "ok", chargeId: result.chargeId };
  };
}

// ---------------------------------------------------------------------------------------------- obligations
const req = (user, extra = {}) => ({ userId: user, op: "charge", amount: 500, ...extra });
const errText = (r) => (r.error && r.error.message) || String(r.error);
const chargesBy = (w, t) => w.charges.filter((c) => c.by === t).length;

function scenarios(parts, env, bound) {
  const S = {};
  S["D-restart"] = Object.assign(async (run) => {
    const w = makeWorld(run, env);
    const sig = { aborted: false };
    const r1 = await run.drive([["A", () => makeHandler(parts, w, run)(req("u1"), sig)]]);
    if (!r1.A.ok) return `first submit threw: ${errText(r1.A)}`;
    if (r1.A.value.status !== "ok") return `first submit ended ${r1.A.value.status}`;
    const r2 = await run.drive([["B", () => makeHandler(parts, w, run)(req("u1"), { aborted: false })]]); // fresh handler, same backend
    if (!r2.B.ok) return `resubmit after restart threw: ${errText(r2.B)}`;
    if (r2.B.value.status !== "ok") return `resubmit after restart ended ${r2.B.value.status}`;
    if (w.charges.length !== 1) return `${w.charges.length} charges after restart resubmit`;
    return null;
  }, { id: "D-restart", faults: [null] });

  S["D-timeout"] = Object.assign(async (run, fault) => {
    const w = makeWorld(run, env, { providerFault: fault });
    const h = makeHandler(parts, w, run);
    const r1 = await run.drive([["A", () => h(req("u1"), { aborted: false })]]);
    if (!r1.A.ok) return `submit threw: ${errText(r1.A)}`;
    if (fault === "timeout-before-accept" && (r1.A.value.status !== "ok" || w.charges.length !== 1)) return `after a timeout before accept: status ${r1.A.value.status}, ${w.charges.length} charges (wanted ok, 1)`;
    if (w.charges.length > 1) return `${w.charges.length} charges after a timeout (${fault})`;
    const r2 = await run.drive([["B", () => h(req("u1"), { aborted: false })]]);
    if (!r2.B.ok) return `resubmit threw: ${errText(r2.B)}`;
    if (w.charges.length > 1) return `${w.charges.length} charges after resubmit following a timeout (${fault})`;
    return null;
  }, { id: "D-timeout", faults: ["timeout-before-accept", "timeout-after-accept"] });

  // abort point c: even = "pre" of step c/2, odd = "post" of step (c-1)/2; null = never
  const cancelPoints = [null, ...Array.from({ length: 2 * bound.cancelSteps + 1 }, (_, i) => i)];
  S["D-cancel"] = Object.assign(async (run, c) => {
    const w = makeWorld(run, env);
    const h = makeHandler(parts, w, run);
    const sig = { aborted: false };
    const inject = (step, phase) => {
      if (c === null || sig.aborted) return;
      if (2 * step + (phase === "post" ? 1 : 0) === c) { sig.aborted = true; run.trace.push(`  ✂ abort signal set (${phase} step ${step})`); }
    };
    const r1 = await run.drive([["A", () => h(req("u1"), sig)]], inject);
    if (!r1.A.ok) return `submit threw: ${errText(r1.A)}`;
    const seen = run.events.find((e) => e.type === "policy-before" && e.signalAborted);
    if (seen && chargesBy(w, "A") > 0) return "an abort seen before the charge decision did not prevent the charge";
    if (w.charges.length > 1) return `${w.charges.length} charges`;
    const r2 = await run.drive([["B", () => h(req("u1"), { aborted: false })]]);
    if (!r2.B.ok) return `resubmit threw: ${errText(r2.B)}`;
    if (r2.B.value.status !== "ok") return `resubmit after abort ended ${r2.B.value.status} (A ended ${r1.A.value.status}, ${w.charges.length} charge)`;
    if (w.charges.length !== 1) return `${w.charges.length} charges after resubmit`;
    return null;
  }, { id: "D-cancel", faults: cancelPoints });

  S["D-distinct"] = Object.assign(async (run) => {
    const w = makeWorld(run, env);
    const h = makeHandler(parts, w, run);
    const r = await run.drive([["A", () => h(req("u1"), { aborted: false })], ["B", () => h(req("u2"), { aborted: false })]]);
    for (const t of ["A", "B"]) { if (!r[t]) return "stuck"; if (!r[t].ok) return `${t} threw: ${errText(r[t])}`; if (r[t].value.status !== "ok") return `${t} (a different user) ended ${r[t].value.status}`; }
    if (w.charges.length !== 2) return `${w.charges.length} charges for 2 distinct users`;
    return null;
  }, { id: "D-distinct", faults: [null] });

  S["D-dup"] = Object.assign(async (run) => {
    const w = makeWorld(run, env);
    const h = makeHandler(parts, w, run);
    const labels = ["A", "B", "C", "D"].slice(0, bound.requests);
    const r = await run.drive(labels.map((t) => [t, () => h(req("u1"), { aborted: false })]));
    for (const t of labels) { if (!r[t]) return "stuck"; if (!r[t].ok) return `${t} threw: ${errText(r[t])}`; }
    if (w.charges.length > 1) return `${w.charges.length} charges for ${labels.length} identical concurrent submits`;
    if (!labels.some((t) => r[t].value.status === "ok")) return "no submit ended ok";
    return null;
  }, { id: "D-dup", faults: [null] });
  return S;
}

export const OBLIGATIONS = ["D-restart", "D-timeout", "D-cancel", "D-distinct", "D-dup"];
export const DEFAULT_BOUND = { requests: 2, cancelSteps: 4, maxRuns: 20000 };

export function instantiateCombo(combo) {
  const parts = {};
  for (const [slot, spec] of Object.entries(combo)) Object.assign(parts, instantiate(spec));
  return parts;
}

export const lifecycle = {
  name: "lifecycle", slots: SLOTS, obligations: OBLIGATIONS, defaultBound: DEFAULT_BOUND,
  prohibitedProps: ["email", "phone", "ssn"],
  forbiddenEffects: ["clock", "random", "net", "host", "timer", "io"],
  assayHash(bound) { return sha256(makeHandler.toString() + scenarios.toString() + JSON.stringify(bound)).slice(0, 12); },
  scenario(combo, env, id, bound) { return scenarios(instantiateCombo(combo), env, bound)[id]; },
  async replay(combo, env, cx, bound = DEFAULT_BOUND) {
    const sc = this.scenario(combo, env, cx.scenario, bound);
    const run = new Run(cx.choices);
    const violation = await sc(run, cx.fault);
    return { violation, same: violation === cx.violation };
  },
  async evaluate(combo, env, id, bound = DEFAULT_BOUND) {
    let sc;
    try { sc = this.scenario(combo, env, id, bound); } catch (e) {
      return { id, pass: false, counterexample: { violation: `instantiation failed: ${e.message}`, fault: null, choices: [], trace: [], steps: 0, scenario: id }, runs: 0, exhausted: true, capsUsed: [] };
    }
    const r = await explore(sc, sc.faults, { maxRuns: bound.maxRuns });
    return { id, pass: !r.counterexample, bound, ...r };
  },
};
