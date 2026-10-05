// run.mjs — runs every criterion in README.md exactly as frozen there (PREREG.sha256 records the README's hash).
// Usage: node run.mjs [M1,M2,...]   Writes out/results.json and out/ledger-main.jsonl. Prints every verdict.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collect, sha256 } from "./lib/specimen.mjs";
import { load, LIFECYCLE_POOL, CACHE_POOL } from "./lib/pool.mjs";
import { lifecycle, ENV_FULL, makeEnv, DEFAULT_BOUND } from "./lib/lifecycle.mjs";
import { cache, SLOTS as CACHE_SLOTS, DEFAULT_BOUND as CACHE_BOUND } from "./lib/cache.mjs";
import { assemble, reassemble, distinguish, fillWithModel, SpecimenStore, Ledger, staticVerdict } from "./lib/solver.mjs";
import { verifyReceipt, applyEdits } from "./lib/transform.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "out");
fs.mkdirSync(OUT, { recursive: true });
const want = process.argv[2] ? process.argv[2].split(",") : null;
const results = { startedAt: new Date().toISOString(), readmeSha256: sha256(fs.readFileSync(path.join(HERE, "README.md"), "utf8")), prereg: fs.readFileSync(path.join(HERE, "PREREG.sha256"), "utf8").trim().split("\n"), criteria: {} };
results.readmeMatchesPrereg = results.readmeSha256 === results.prereg[0].split(" ")[0];

const L = (n) => load(`lifecycle/${n}.js`);
const idOf = (spec) => spec.id;
const modelOff = () => { throw new Error("MODEL CALLED — the model port must stay off in this criterion"); };
const check = (checks, name, ok, detail = "") => { checks.push({ name, ok: !!ok, detail }); return !!ok; };
const verdict = (checks) => (checks.every((c) => c.ok) ? "PASS" : "FALSIFIED");
const cxLine = (cx) => cx && { violation: cx.violation, steps: cx.steps, fault: cx.fault, trace: cx.trace };

async function criterion(id, fn) {
  if (want && !want.includes(id)) return;
  const t = Date.now();
  process.stdout.write(`\n== ${id} ...\n`);
  const checks = [];
  let evidence = {};
  try { evidence = (await fn(checks)) || {}; } catch (e) { check(checks, "criterion ran without throwing", false, e.stack); }
  const v = verdict(checks);
  results.criteria[id] = { verdict: v, ms: Date.now() - t, checks, evidence };
  console.log(`${id}: ${v} (${Date.now() - t} ms)`);
  for (const c of checks) console.log(`   ${c.ok ? "ok  " : "FAIL"} ${c.name}${c.detail ? " — " + String(c.detail).slice(0, 300) : ""}`);
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
}

// shared state across criteria
let M1 = null, truth = null;

await criterion("M1", async (checks) => {
  const ledger = new Ledger(path.join(OUT, "ledger-main.jsonl"));
  const store = new SpecimenStore();
  const t = Date.now();
  const run = await fillWithModel(lifecycle, store, LIFECYCLE_POOL(), ENV_FULL, { proposer: modelOff, ledger });
  const res = run.result;
  M1 = { run, res, ms: Date.now() - t };
  check(checks, "committed", res.status === "committed");
  check(checks, "no model calls", run.modelCalls === 0, `calls=${run.modelCalls}`);
  // brute force: every surviving combination through every obligation, no learning, no early stop
  const t2 = Date.now();
  const bf = await assemble(lifecycle, LIFECYCLE_POOL(), ENV_FULL, { learn: false, exhaustive: true });
  truth = bf;
  const key = (c) => Object.values(c).map((s) => s.id).join("/");
  const truthKeys = bf.passes.map(key);
  check(checks, "commit is in the brute-force truth set", res.status === "committed" && truthKeys.includes(key(res.combo)), `truth set size ${truthKeys.length}`);
  return {
    commit: res.commit && { combo: res.commit.combo, paths: res.commit.paths }, guarantees: res.guarantees, statsAssemble: res.stats, assembleMs: M1.ms,
    truth: { size: truthKeys.length, combos: bf.passes.map((c) => Object.fromEntries(Object.entries(c).map(([s, sp]) => [s, sp.provenance.path]))), stats: bf.stats, ms: Date.now() - t2 },
  };
});

await criterion("M2", async (checks) => {
  const res = M1.res;
  const specs = {}; for (const slot of Object.keys(lifecycle.slots)) for (const s of res.cands[slot]) specs[s.id] = s;
  const cxs = res.ledger.of("counterexample");
  const blind = L("retry-blind"), always = L("cancel-always");
  const evid = {};
  for (const [name, spec, slot, obl] of [["retry-blind", blind, "retry", "D-timeout"], ["cancel-always", always, "cancel", "D-cancel"]]) {
    let cx = cxs.find((c) => c.combo[slot] === spec.id && c.obligation === obl);
    if (!cx) {
      // not reached by the committing run: take the nearest context the ledger knows (others = the committed combination)
      const ctx = Object.fromEntries(Object.entries(res.combo).map(([s, sp]) => [s, sp]));
      const r = await lifecycle.evaluate({ ...ctx, [slot]: spec }, ENV_FULL, obl, DEFAULT_BOUND);
      cx = r.counterexample && { obligation: obl, combo: { ...Object.fromEntries(Object.entries(ctx).map(([s, sp]) => [s, sp.id])), [slot]: spec.id }, ...r.counterexample };
      evid[name + "-source"] = "targeted run in the committed context (the committing run never tried this candidate)";
    } else evid[name + "-source"] = "ledger entry from the committing run";
    check(checks, `${name}: a counterexample exists, naming slot ${slot} and its candidate`, cx && cx.combo[slot] === spec.id, cx ? cx.violation : "none");
    if (!cx) continue;
    const combo = {}; for (const s of Object.keys(lifecycle.slots)) combo[s] = specs[cx.combo[s]] || (s === slot ? spec : null);
    const rp = await lifecycle.replay(combo, ENV_FULL, { scenario: cx.obligation, choices: cx.choices, fault: cx.fault, violation: cx.violation });
    check(checks, `${name}: replays from its recorded schedule to the same violation`, rp.same, rp.violation);
    check(checks, `${name}: trace is at most 12 steps`, cx.steps <= 12, `steps=${cx.steps}`);
    evid[name] = { obligation: cx.obligation, violation: cx.violation, fault: cx.fault, steps: cx.steps, trace: cx.trace };
  }
  // control: only the combination the truth set accepts -> zero counterexamples
  const keep = res.combo;
  const pool = Object.fromEntries(Object.entries(keep).map(([s, sp]) => [s, [load(sp.provenance.path.replace("specimens/", ""))]]));
  const ctl = await assemble(lifecycle, pool, ENV_FULL, {});
  check(checks, "control: clean pool commits", ctl.status === "committed");
  check(checks, "control: zero counterexamples reported", ctl.ledger.of("counterexample").length === 0, `counterexamples=${ctl.ledger.of("counterexample").length}`);
  evid.control = { runs: ctl.stats.runs, counterexamples: ctl.ledger.of("counterexample").length };
  return evid;
});

await criterion("M3", async (checks) => {
  const ctx = M1.res.combo;
  const d1 = await distinguish(lifecycle, ENV_FULL, "store", L("store-setnx"), L("store-getset"), ctx);
  check(checks, "setnx vs getset: a distinguishing schedule is returned", d1.distinguished, d1.distinguished ? d1.obligation : "none");
  if (d1.distinguished) check(checks, "the distinguishing run is a counterexample for exactly one of them", Object.values(d1.passes).filter(Boolean).length === 1);
  const d2 = await distinguish(lifecycle, ENV_FULL, "key", L("key-body"), L("key-body-reordered"), ctx);
  check(checks, "control: reordered key is NOT distinguished", !d2.distinguished);
  check(checks, "control: the answer says 'none found within bound', not 'equivalent'", !d2.distinguished && /within the bound/.test(d2.note) && !/^equivalent/.test(d2.note) && d2.bound && d2.bound.requests === 2, d2.note);
  return { setnxVsGetset: d1.distinguished ? { obligation: d1.obligation, passes: d1.passes, counterexample: cxLine(d1.counterexample), runs: d1.runs } : d1, keyControl: d2 };
});

await criterion("M4", async (checks) => {
  const env2 = ENV_FULL.without("kv.setnx");
  const t = Date.now();
  const r = await reassemble(lifecycle, LIFECYCLE_POOL(), M1.res, env2, { ledger: new Ledger() });
  check(checks, "committed again under the new environment", r.status === "committed", r.status);
  check(checks, "only the store slot reopened", JSON.stringify(r.reopened) === JSON.stringify(["store"]), JSON.stringify(r.reopened));
  const keptSame = r.status === "committed" && ["key", "retry", "cancel"].every((s) => r.combo[s].id === M1.res.combo[s].id);
  check(checks, "(d) the other three slots were kept, not re-solved", keptSame && r.kept.length === 3);
  const tr = r.ledger.of("transform")[0];
  check(checks, "a transform with a receipt was recorded", !!tr, tr ? tr.rule : "none");
  if (tr && r.status === "committed") {
    const orig = L("store-setnx");
    const out = applyEdits(orig.source, tr.receipt.edits);
    check(checks, "(a) receipt edits re-applied to the original bytes reproduce the new specimen's sha256", sha256(out) === r.combo.store.sha256 && verifyReceipt(orig.source, tr.receipt, r.combo.store.source));
    check(checks, "(b) adapted specimen's provenance names the original", r.combo.store.provenance.parents.includes(orig.id) && r.combo.store.provenance.transforms.length === 1);
    check(checks, "(c) every obligation holds under the new environment", r.guarantees.every((g) => g.status && g.runs > 0));
    results._m4adapted = out;
  }
  const env3 = ENV_FULL.without("kv.setnx", "kv.cas");
  const g = await reassemble(lifecycle, LIFECYCLE_POOL(), M1.res, env3, { ledger: new Ledger() });
  check(checks, "control: neither setnx nor cas -> a gap, never a commit", g.status === "gap", g.status);
  const names = g.status === "gap" && JSON.stringify(g.gap.eliminated.store) + JSON.stringify(g.gap.refusals);
  check(checks, "control: the gap names the store slot and the missing needs", g.status === "gap" && /kv\.setnx/.test(names) && /kv\.cas/.test(names), names && names.slice(0, 200));
  return {
    reopened: r.reopened, kept: r.kept, removed: r.removed, invalidatedGuarantees: r.invalidatedGuarantees, statsReassemble: r.stats, ms: Date.now() - t,
    receipt: tr && { rule: tr.rule, adapter: tr.adapter, edits: tr.receipt.edits, preserves: tr.receipt.preserves, introduces: tr.receipt.introduces, in: tr.receipt.in, out: tr.receipt.out, receiptVerified: tr.receiptVerified },
    adaptedSource: results._m4adapted, controlGap: g.status === "gap" ? { refusals: g.gap.refusals, eliminatedStore: g.gap.eliminated.store, nearest: g.gap.nearest } : null,
  };
});

await criterion("M5", async (checks) => {
  const probe = load("probes/store-dynamic-call.js");
  const v = staticVerdict(lifecycle, probe, "store", ENV_FULL);
  check(checks, "S-effects is 'unproved', not a pass", v.status === "unproved", v.status);
  check(checks, "the reason names the computed member call", v.unresolved.some((u) => /computed member call/.test(u.reason)), JSON.stringify(v.unresolved.map((u) => u.reason)));
  const pool = { key: [L("key-body")], retry: [L("retry-lookup")], cancel: [L("cancel-before-only")], store: [probe, L("store-setnx")] };
  const strict = await assemble(lifecycle, pool, ENV_FULL, { ledger: new Ledger() });
  check(checks, "strict policy: probe is not in the commit", strict.status === "committed" && strict.combo.store.id !== probe.id);
  check(checks, "strict policy: probe is listed as held, apart from the eliminated", strict.held.store.some((h) => h.spec.id === probe.id) && !strict.eliminated.store.some((e) => e.spec.id === probe.id));
  check(checks, "strict policy: ledger has an 'unproved' mark and no 'eliminate' mark for it", strict.ledger.of("unproved").some((e) => e.id === probe.id) && !strict.ledger.of("eliminate").some((e) => e.id === probe.id));
  const perm = await assemble(lifecycle, pool, ENV_FULL, { policy: "permissive", ledger: new Ledger() });
  const sg = perm.status === "committed" && perm.combo.store.id === probe.id ? perm.commit.staticGuarantees.find((g) => g.obligation === "static:store").status : "probe not chosen";
  check(checks, "permissive policy: if it commits, the commit still says UNPROVED", perm.status === "committed" && (perm.combo.store.id !== probe.id || /^UNPROVED/.test(sg)), sg);
  return { verdict: v, strictCommitStore: strict.commit && strict.commit.paths.store, permissiveStaticGuarantee: sg };
});

await criterion("M6", async (checks) => {
  const probe = load("probes/store-takeover.js");
  const pool = () => ({ key: [L("key-body")], retry: [L("retry-lookup")], cancel: [L("cancel-before-only")], store: [probe] });
  const b2 = { ...DEFAULT_BOUND, requests: 2 };
  const r2 = await assemble(lifecycle, pool(), ENV_FULL, { bound: b2, ledger: new Ledger() });
  const g2 = r2.status === "committed" && r2.guarantees.find((g) => g.obligation === "D-dup");
  check(checks, "N=2: not eliminated (committed)", r2.status === "committed", r2.status);
  check(checks, "N=2: the verdict carries the bound and a run count, not a bare pass", g2 && g2.bound.requests === 2 && g2.runs > 0 && /within the bound/.test(g2.status), g2 && JSON.stringify({ status: g2.status, runs: g2.runs, bound: g2.bound }));
  const b3 = { ...DEFAULT_BOUND, requests: 3 };
  const r3 = await assemble(lifecycle, pool(), ENV_FULL, { bound: b3, ledger: new Ledger() });
  const cx3 = r3.ledger.of("counterexample").find((e) => e.obligation === "D-dup");
  check(checks, "N=3: eliminated with a counterexample", r3.status === "gap" && !!cx3, r3.status);
  check(checks, "N=3: found within 20 000 runs", cx3 && cx3.runsToFind <= 20000, cx3 && `runs=${cx3.runsToFind}`);
  return { n2: g2, n3: cx3 && { violation: cx3.violation, runsToFind: cx3.runsToFind, steps: cx3.steps, trace: cx3.trace } };
});

await criterion("M7", async (checks) => {
  const cenv = makeEnv([], CACHE_SLOTS);
  const base = CACHE_POOL();
  const first = await assemble(cache, base, cenv, { ledger: new Ledger() });
  check(checks, "the pool alone does not commit (it is a gap)", first.status === "gap", first.status);
  const perCand = first.status === "gap" ? first.gap.failures.map((f) => ({ candidate: f.paths.cache, violates: f.failing.map((x) => ({ obligation: x.obligation, ops: x.ops && x.ops.length })) })) : [];
  check(checks, "the gap names, per candidate, the obligations it violates", perCand.length === 3 && perCand.every((c) => c.violates.length > 0), JSON.stringify(perCand));
  check(checks, "failing sequences are shrunk (each has at most 12 operations)", first.status === "gap" && first.gap.failures.every((f) => f.failing.every((x) => x.ops.length <= 12)));
  const store = new SpecimenStore();
  const ledger = new Ledger(path.join(OUT, "ledger-cache.jsonl"));
  let guarded = 0;
  const scripted = [fs.readFileSync(path.join(HERE, "specimens/proposals/proposal-1-wrong.js"), "utf8"), fs.readFileSync(path.join(HERE, "specimens/proposals/proposal-2-right.js"), "utf8")];
  const proposerCalls = [];
  const run = await fillWithModel(cache, store, base, cenv, { proposer: async (req, n) => { proposerCalls.push(req); return scripted[n - 1]; }, guard: (r) => { guarded++; return r; }, ledger });
  check(checks, "committed after the model's proposals", run.result.status === "committed");
  check(checks, "the wrong proposal was rejected by the assay", run.rejected.length === 1 && run.rejected[0].violates.some((v) => v.obligation === "C-bounded"), JSON.stringify(run.rejected.map((r) => ({ id: r.id, violates: r.violates.map((v) => v.obligation) }))));
  const acc = run.result.status === "committed" ? run.result.combo.cache : null;
  check(checks, "accepted code is recorded as model-proposed", acc && acc.provenance.origin === "model-proposed");
  check(checks, "its assurance is 'witnessed under assay', nothing stronger", acc && /^witnessed under assay/.test(acc.assurance) && !/proven(?! )/.test(acc.assurance.replace("not proven", "")) , acc && acc.assurance);
  check(checks, "ledger shows it entered 'unverified' before acceptance", ledger.of("model-candidate").some((e) => e.assurance === "unverified") && ledger.of("model-candidate-accepted").length === 1);
  check(checks, "the guard hook ran on every request", guarded === run.modelCalls && guarded === 2, `guarded=${guarded} calls=${run.modelCalls}`);
  // task 2: different limit, model off
  const t2bound = { ...CACHE_BOUND, limit: 2, seed: 11 };
  const run2 = await fillWithModel(cache, store, base, cenv, { proposer: modelOff, bound: t2bound, ledger: new Ledger() });
  check(checks, "task 2 (limit 2) commits with zero model calls", run2.result.status === "committed" && run2.modelCalls === 0, `calls=${run2.modelCalls}`);
  check(checks, "task 2 used the model-proposed specimen from the store", run2.result.status === "committed" && run2.result.combo.cache.id === (acc && acc.id));
  return { gap: perCand, requestsSent: proposerCalls.map((r) => ({ keys: Object.keys(r), nearest: r.nearestAttempt && r.nearestAttempt.candidate, size: JSON.stringify(r).length })), rejected: run.rejected, acceptedAssurance: acc && acc.assurance, modelCalls: { task1: run.modelCalls, task2: run2.modelCalls } };
});

await criterion("M8", async (checks) => {
  const variants = {
    key: [`export function key(req) {\n  const h = req.idempotencyKey;\n  return h;\n}\n`, `export function key(req) {\n  return req.idempotencyKey === undefined ? undefined : req.idempotencyKey;\n}\n`],
    retry: [`export async function retry(run, ctx) {\n  const first = await run();\n  return first;\n}\n`, `export async function retry(run, ctx) {\n  let last;\n  for (let n = 0; n < 2; n++) {\n    try {\n      return await run();\n    } catch (e) {\n      if (e.name !== "TimeoutError") throw e;\n      last = e;\n    }\n  }\n  throw last;\n}\n`],
    cancel: [`export function cancelPolicy(signal, phase) {\n  const stop = signal.aborted;\n  return stop;\n}\n`, `export function cancelPolicy(signal, phase) {\n  return phase === "before-charge" ? false : signal.aborted;\n}\n`],
  };
  const big = LIFECYCLE_POOL();
  let n = 0;
  for (const [slot, srcs] of Object.entries(variants)) for (const source of srcs) { big[slot].push(collect({ source, origin: "authored-for-harness", path: `run.mjs:M8-variant-${++n}`, note: "extra non-solving specimen for the cost measurement" })); }
  const row = async (name, pool, learn) => { const t = Date.now(); const r = await assemble(lifecycle, pool, ENV_FULL, { learn, ledger: new Ledger() }); return { pool: name, learn, status: r.status, ...r.stats, ms: Date.now() - t }; };
  const rows = [];
  rows.push(await row("base (4/3/3/3)", LIFECYCLE_POOL(), true));
  rows.push(await row("base (4/3/3/3)", LIFECYCLE_POOL(), false));
  rows.push(await row("enlarged (4/3/5/5)", big, true));
  rows.push(await row("enlarged (4/3/5/5)", big, false));
  check(checks, "all four runs committed (reported, not thresholded)", rows.every((r) => r.status === "committed"));
  console.table(rows.map((r) => ({ pool: r.pool, learn: r.learn, assayRuns: r.runs, evals: r.evals, combosTried: r.combosTried, pruned: r.combosPruned, nogoods: r.nogoods, ms: r.ms })));
  return { rows };
});

results.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
console.log("\nSUMMARY");
for (const [id, c] of Object.entries(results.criteria)) console.log(`  ${id}  ${c.verdict}  (${c.checks.filter((x) => x.ok).length}/${c.checks.length} checks)  ${c.ms} ms`);
console.log(`README matches PREREG hash: ${results.readmeMatchesPrereg}`);
