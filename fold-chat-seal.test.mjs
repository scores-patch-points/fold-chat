// fold-chat-seal.test.mjs — what "sealed" is allowed to mean, and the audit that holds it to that.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sha256Hex, canonMessages, contentSha256, withProvenance, scanSecrets, createTaint, gradeRequest, verifyAgainst, makeWorldSet, mulberry32, symmetryAudit, ATTACKS, estTokens, PROVENANCE } from "./fold-chat-seal.js";

const hex = (s) => createHash("sha256").update(s).digest("hex");

test("the hash and canonical text match heimdall's byte for byte (the two sides can compare)", async () => {
  assert.equal(await sha256Hex("abc"), hex("abc"));
  const m = [{ role: "system", content: "s" }, { role: "user", content: "u" }];
  assert.equal(canonMessages(m), "system\ns\n\u0000\nuser\nu", "the exact formula heimdall/src/audit.js uses");
  assert.equal(await contentSha256(m), hex(canonMessages(m)));
});

test("withProvenance keeps the wire messages clean and the origin of every segment", () => {
  const { messages, segments } = withProvenance([{ role: "system", content: "fixed", provenance: "template" }, { role: "user", content: "the ask", provenance: "ask" }, { content: 5 }]);
  assert.deepEqual(messages, [{ role: "system", content: "fixed" }, { role: "user", content: "the ask" }]);
  assert.deepEqual(segments.map((s) => s.provenance), ["template", "ask"]);
  assert.ok(!JSON.stringify(messages).includes("provenance"), "provenance is for the audit — it never rides the wire");
});

test("scanSecrets finds credentials, local paths and emails without echoing the secret", () => {
  const t = "key sk-abcdefghijklmnopqrstuvwxyz123456 and AKIAABCDEFGHIJKLMNOP at /Users/mlacy/Documents/x.js mail me@example.com password = hunter2hunter2";
  const kinds = scanSecrets(t).map((h) => h.kind);
  for (const k of ["OpenAI/Anthropic-style key", "AWS access key", "home directory path", "email address", "password assignment"]) assert.ok(kinds.includes(k), k);
  assert.ok(!JSON.stringify(scanSecrets(t)).includes("abcdefghijklmnopqrstuvwxyz"), "the secret itself is never echoed");
  assert.deepEqual(scanSecrets("make a countdown timer with Start and Pause buttons"), []);
});

test("the taint registry catches a private particular wherever it hides — case, spacing, unicode", () => {
  const taint = createTaint().add("Eleanor Voss", "name").add("acme_billing_service", "identifier");
  assert.equal(taint.scan("the board named eleanor VOSS in 1907").length, 1);
  assert.equal(taint.scan("call ACME_BILLING_SERVICE now").length, 1);
  assert.equal(taint.scan("nothing private here").length, 0);
  assert.equal(taint.add("ab").size, 2, "terms under 3 characters are not tracked — they would match everything");
});

test("addFromText learns names, quoted strings and identifiers from a local read", () => {
  const t = createTaint().addFromText('Eleanor Voss led the Office of the Keeper. See "Marden Act" and getInvoiceTotal and fetch_user_rows.');
  const found = t.scan("the Marden Act and getInvoiceTotal and Eleanor Voss and fetch_user_rows").map((h) => h.term).sort();
  assert.deepEqual(found, ["Eleanor Voss", "Marden Act", "fetch_user_rows", "getInvoiceTotal"].sort());
});

// ───────────────────────── grading: never rounded up ─────────────────────────

const req = (parts, extra = {}) => ({ ...withProvenance(parts), gate: true, ...extra });

test("falsifier: raw content under the gate is graded GATE and is never shown as sealed", () => {
  const g = gradeRequest(req([{ role: "system", content: "You are an engineer.", provenance: "template" }, { role: "user", content: "make a timer", provenance: "ask" }]));
  assert.equal(g.level, "gate");
  assert.equal(g.sealed, false);
  assert.equal(g.raw, true);
  assert.match(g.notes.join(" "), /provider can read the ask/);
});

test("code a model produced is raw content too — the note says the provider can read the code", () => {
  const g = gradeRequest(req([{ role: "user", content: "<p>x</p>", provenance: "generated" }, { role: "user", content: "fix", provenance: "ask" }]));
  assert.match(g.notes.join(" "), /and the code it carries/);
});

test("symbols and templates only, with a clean scan, grade ABSTRACT and sealed", () => {
  const g = gradeRequest(req([{ role: "system", content: "Answer in each world.", provenance: "template" }, { role: "user", content: "Given s1,s2: r(s1,s2). What follows?", provenance: "symbolic" }]), { taint: createTaint().add("Eleanor Voss") });
  assert.equal(g.level, "abstract"); assert.equal(g.sealed, true); assert.deepEqual(g.leaks, []);
});

test("falsifier: a request labelled symbolic that CARRIES a private particular is a leak, not abstract", () => {
  const taint = createTaint().add("Eleanor Voss", "name");
  const g = gradeRequest(req([{ role: "user", content: "Does Eleanor Voss follow from s1?", provenance: "symbolic" }]), { taint });
  assert.equal(g.sealed, false);
  assert.equal(g.level, "gate", "a leak drops it back to gate");
  assert.equal(g.leaks[0].type, "particular"); assert.equal(g.particularHits, 1);
});

test("falsifier: file bytes or a local read in a request is a provenance leak at any level", () => {
  for (const p of ["workspace-file", "local-read"]) {
    const g = gradeRequest(req([{ role: "user", content: "x", provenance: p }]));
    assert.equal(g.sealed, false);
    assert.ok(g.leaks.some((l) => l.type === "provenance" && l.kind === p), p);
  }
});

test("content the audit cannot place is refused as unplaced, not trusted", () => {
  const g = gradeRequest(req([{ role: "user", content: "x", provenance: "mystery" }]));
  assert.ok(g.leaks.some((l) => /unknown origin/.test(l.detail || "")));
});

test("a request that did not declare the gate is a leak of its own", () => {
  const g = gradeRequest({ ...withProvenance([{ role: "user", content: "s1", provenance: "symbolic" }]), gate: false });
  assert.ok(g.leaks.some((l) => l.type === "gate")); assert.equal(g.sealed, false);
});

test("WORLDS is earned: abstract + a set of ≥3 + a PASSED symmetry audit — each condition removed drops it", () => {
  const parts = [{ role: "user", content: "world 1: r(s1,s2)", provenance: "world" }];
  const base = { ...withProvenance(parts), gate: true, worlds: { setId: "S", slot: 0, n: 5 }, symmetry: { passed: true } };
  assert.equal(gradeRequest(base).level, "worlds");
  assert.equal(gradeRequest({ ...base, symmetry: { passed: false } }).level, "abstract");
  assert.match(gradeRequest({ ...base, symmetry: { passed: false } }).notes.join(" "), /FAILED the symmetry audit/);
  assert.equal(gradeRequest({ ...base, symmetry: undefined }).level, "abstract");
  assert.equal(gradeRequest({ ...base, worlds: { setId: "S", slot: 0, n: 2 } }).level, "abstract", "two worlds is a coin flip with a hint, not a set");
  assert.equal(gradeRequest({ ...base, worlds: null }).level, "abstract");
});

// ───────────────────────── verifying against what heimdall says left ─────────────────────────

test("verifyAgainst: the bytes heimdall sent are the ones this surface built", async () => {
  const mine = withProvenance([{ role: "system", content: "s", provenance: "template" }, { role: "user", content: "u", provenance: "ask" }]);
  const theirs = { privacy: "sealed-external", host: "h.test", provider: "p", model: "m", request: { contentSha256: hex(canonMessages(mine.messages)), sha256: "wire", bytes: 99 }, response: { status: 200 } };
  const v = await verifyAgainst(mine, theirs);
  assert.equal(v.verified, true); assert.deepEqual(v.problems, []); assert.equal(v.host, "h.test");
});

test("falsifier: heimdall sent DIFFERENT content, no record, a weaker privacy mode, or a wrong world slot → not verified, and why", async () => {
  const mine = { ...withProvenance([{ role: "user", content: "u", provenance: "ask" }]), worlds: { setId: "S", slot: 1, n: 3 } };
  const right = hex(canonMessages(mine.messages));
  const ok = { privacy: "sealed-external", worlds: { setId: "S", slot: 1, n: 3 }, request: { contentSha256: right } };
  assert.equal((await verifyAgainst(mine, ok)).verified, true);
  assert.match((await verifyAgainst(mine, { ...ok, request: { contentSha256: "deadbeef" } })).problems[0], /differs from what this surface built/);
  assert.match((await verifyAgainst(mine, null)).problems[0], /no record/);
  assert.match((await verifyAgainst(mine, { ...ok, privacy: "raw" })).problems[0], /privacy mode/);
  assert.match((await verifyAgainst(mine, { ...ok, worlds: { setId: "S", slot: 2, n: 3 } })).problems[0], /world slot/);
  assert.match((await verifyAgainst({ ...mine, worlds: null }, ok)).problems.join(" "), /did not send/);
});

// ───────────────────────── possible worlds: construction and attack ─────────────────────────

test("a world set always contains the real world at the recorded slot (the KEY), and it is a member", () => {
  for (const mode of ["naive", "symmetric"]) {
    const rng = mulberry32(3);
    for (let i = 0; i < 50; i++) {
      const { worlds, real } = makeWorldSet({ n: 5, mode, rng });
      assert.equal(worlds.length, 5); assert.ok(real >= 0 && real < 5);
    }
  }
});

test("EXPERIMENT (naive neighbouring decoys): the real world is read off the set far above chance — the audit FAILS it", () => {
  for (const n of [3, 5, 8]) {
    const r = symmetryAudit({ mode: "naive", n, trials: 3000, seed: 11 });
    assert.equal(r.passed, false, `N=${n}`);
    assert.ok(r.worst.rate > 3 * r.chance || r.worst.rate > 0.85, `N=${n}: worst ${r.worst.attack} ${r.worst.rate}`);
    assert.ok(r.leaking.includes("centroid"));
  }
});

test("EXPERIMENT (symmetric worlds): every attack is held to chance — the audit PASSES it", () => {
  for (const n of [3, 5, 8]) {
    const r = symmetryAudit({ mode: "symmetric", n, trials: 6000, seed: 11 });
    assert.equal(r.passed, true, `N=${n}: ${JSON.stringify(r.rates)}`);
    for (const a of Object.keys(ATTACKS)) assert.ok(Math.abs(r.rates[a] - r.chance) < 0.04, `${a} ${r.rates[a]} vs ${r.chance}`);
  }
});

test("falsifier: the audit is not a rubber stamp — a generator that always puts the real world first is CAUGHT by the position attack", () => {
  const biased = (rng) => { const { worlds, real } = makeWorldSet({ n: 5, mode: "symmetric", rng }); const w = worlds.slice(); [w[0], w[real]] = [w[real], w[0]]; return { worlds: w, real: 0 }; };
  const r = symmetryAudit({ generate: biased, n: 5, trials: 2000, seed: 2 });
  assert.equal(r.passed, false);
  assert.equal(r.rates.position, 1, "real is always slot 0");
  assert.deepEqual(r.leaking.includes("position"), true);
});

test("falsifier: a generator that makes the real world the cluster centre is CAUGHT by the centroid attack", () => {
  const centred = (rng) => { const { worlds } = makeWorldSet({ n: 5, mode: "naive", rng }); return { worlds, real: ATTACKS.centroid(worlds) }; };
  const r = symmetryAudit({ generate: centred, n: 5, trials: 1500, seed: 4 });
  assert.equal(r.passed, false); assert.equal(r.rates.centroid, 1);
});

test("a fair generator passes the same attacks the biased ones fail (the harness discriminates both ways)", () => {
  const r = symmetryAudit({ mode: "symmetric", n: 5, trials: 6000, seed: 2 });
  assert.equal(r.passed, true);
});

test("estTokens is an estimate, not a measurement", () => { assert.equal(estTokens("x".repeat(400)), 100); assert.equal(estTokens(""), 0); assert.ok(PROVENANCE.template); });
