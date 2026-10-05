// Fast mechanism tests (the criteria themselves are in run.mjs and take minutes). node --test experiments/specimen-assembly/
import test from "node:test";
import assert from "node:assert/strict";
import { collect, exportOf, instantiate } from "./lib/specimen.mjs";
import { load } from "./lib/pool.mjs";
import { substituteCall, renameParam, verifyReceipt, applyEdits } from "./lib/transform.mjs";
import { lifecycle, ENV_FULL } from "./lib/lifecycle.mjs";
import { cache, SLOTS as CSLOTS } from "./lib/cache.mjs";
import { assemble, staticVerdict, Ledger } from "./lib/solver.mjs";
import { makeEnv } from "./lib/lifecycle.mjs";

const L = (n) => load(`lifecycle/${n}.js`);

test("specimen: needs, effects and props are read from the AST, comments are ignored", () => {
  const s = collect({ source: `// uses fetch and Math.random\nexport function f(a, b) { const p = b.provider; return a.x.y(p.lookup(1)); }`, origin: "test" });
  const ex = exportOf(s, "f");
  assert.deepEqual(ex.needs, ["0:x.y", "1:provider.lookup"]);
  assert.equal(s.effects.observed.length, 0);
  const bad = collect({ source: `export function f() { return Math.random() + Date.now(); }`, origin: "test" });
  assert.deepEqual(bad.effects.observed.map((e) => e.kind).sort(), ["clock", "random"]);
});

test("specimen: a computed member call is unresolved, a parse error is recorded not thrown", () => {
  const s = L("../probes/store-dynamic-call");
  assert.ok(s.effects.unresolved.some((u) => /computed member call/.test(u.reason)));
  const broken = collect({ source: "export function (", origin: "test" });
  assert.equal(broken.parse.ok, false);
});

test("static verdict: privacy, effects and needs are separate reasons", () => {
  assert.deepEqual(staticVerdict(lifecycle, L("key-email"), "key", ENV_FULL).reasons.map((r) => r.obligation), ["S-privacy"]);
  assert.deepEqual(staticVerdict(lifecycle, L("key-nonce"), "key", ENV_FULL).reasons.map((r) => r.obligation), ["S-effects"]);
  const env = ENV_FULL.without("kv.setnx");
  const v = staticVerdict(lifecycle, L("store-setnx"), "store", env);
  assert.equal(v.status, "eliminated");
  assert.deepEqual(v.missing, ["kv.setnx"]);
});

test("instantiate: the sandbox has no Date and no Math.random", () => {
  const s = collect({ source: `export function f() { return typeof Date + typeof Math.random; }`, origin: "test" });
  assert.equal(instantiate(s).f(), "undefinedundefined");
});

test("transform: setnx->cas receipt re-derives the output bytes; tampering is detected", () => {
  const orig = L("store-setnx");
  const env = ENV_FULL.without("kv.setnx");
  const t = substituteCall(orig, { entry: "makeStore", adapterId: "setnx->cas", paramIndex: 0 }, env);
  assert.ok(t.ok);
  assert.match(t.specimen.source, /backend\.cas\("claim:" \+ k, undefined, "pending"\)/);
  assert.ok(verifyReceipt(orig.source, t.receipt, t.specimen.source));
  assert.deepEqual(t.specimen.provenance.parents, [orig.id]);
  assert.ok(!verifyReceipt(orig.source, { ...t.receipt, edits: t.receipt.edits.slice(1) }, t.specimen.source));
  // precondition: refused when the environment has no replacement
  const none = substituteCall(orig, { entry: "makeStore", adapterId: "setnx->cas", paramIndex: 0 }, ENV_FULL.without("kv.setnx", "kv.cas"));
  assert.equal(none.ok, false);
  assert.match(none.reason, /kv\.cas/);
});

test("transform: rename-param refuses a clashing name and leaves property keys alone", () => {
  const s = collect({ source: `export function f(a) { return { a: a.a, b: a }; }`, origin: "test" });
  const ok = renameParam(s, { entry: "f", from: "a", to: "z" });
  assert.ok(ok.ok);
  assert.equal(instantiate(ok.specimen).f({ a: 1 }).a, 1);
  assert.match(ok.specimen.source, /\{ a: z\.a, b: z \}/);
  assert.equal(renameParam(s, { entry: "f", from: "a", to: "b" }).ok, false);
});

test("sim: the same choice vector replays the same trace (determinism)", async () => {
  const combo = { key: L("key-body"), store: L("store-getset"), retry: L("retry-lookup"), cancel: L("cancel-before-only") };
  const r = await lifecycle.evaluate(combo, ENV_FULL, "D-dup");
  assert.equal(r.pass, false);
  const again = await lifecycle.replay(combo, ENV_FULL, { scenario: "D-dup", ...r.counterexample });
  assert.ok(again.same, again.violation);
});

test("lifecycle: the good combination passes every obligation; a planted defect fails the expected one", async () => {
  const good = { key: L("key-body"), store: L("store-setnx"), retry: L("retry-lookup"), cancel: L("cancel-before-only") };
  for (const id of ["D-restart", "D-timeout", "D-cancel"]) assert.ok((await lifecycle.evaluate(good, ENV_FULL, id)).pass, id);
  const bad = await lifecycle.evaluate({ ...good, cancel: L("cancel-always") }, ENV_FULL, "D-cancel");
  assert.equal(bad.pass, false);
  assert.match(bad.counterexample.violation, /ended pending/);
});

test("assemble: a pinned pool commits and reports bounds; an impossible slot is a gap, not a commit", async () => {
  const pool = { key: [L("key-body")], store: [L("store-setnx")], retry: [L("retry-lookup")], cancel: [L("cancel-before-only")] };
  const r = await assemble(lifecycle, pool, ENV_FULL, { ledger: new Ledger() });
  assert.equal(r.status, "committed");
  assert.ok(r.guarantees.every((g) => g.bound && g.runs > 0));
  const g = await assemble(lifecycle, { ...pool, store: [L("store-setnx")] }, ENV_FULL.without("kv.setnx", "kv.cas"), { ledger: new Ledger() });
  assert.equal(g.status, "gap");
  assert.equal(g.gap.empty[0].slot, "store");
  assert.match(JSON.stringify(g.gap.refusals), /kv\.cas/);
});

test("cache: shrunken counterexamples replay; the right LRU passes", async () => {
  const env = makeEnv([], CSLOTS);
  const un = { cache: load("cache/cache-unbounded.js") };
  const r = await cache.evaluate(un, env, "C-bounded");
  assert.equal(r.pass, false);
  assert.ok(r.counterexample.ops.length <= 12);
  assert.ok((await cache.replay(un, r.counterexample)).same);
  const ok = { cache: load("proposals/proposal-2-right.js") };
  for (const id of cache.obligations) assert.ok((await cache.evaluate(ok, env, id)).pass, id);
});
