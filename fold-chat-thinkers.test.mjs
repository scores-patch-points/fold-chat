// fold-chat-thinkers.test.mjs — the thinker-profile classifier (eval/ants/B1-PREREG.md). Synthetic profiles prove each gate; the real profile is smoke-tested.
// Mutation checks: eval/ants/B1-mutate.mjs deletes each gate from a copy of the module (THINKERS_MODULE) and these tests must fail.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const M = await import(process.env.THINKERS_MODULE || "./fold-chat-thinkers.js");
const { contentStems, decodeProfile, classify, classifyThread, priorOf, knownStems, scoreKnown } = M;
const B = await import("./scripts/build-thinkers.mjs");

// A tiny synthetic canon: three speaking thinkers with their own vocabulary, one technical distractor, shared common words.
const mk = (counts) => Object.entries(counts).map(([w, c]) => [w, c]);
const THINKERS = {
  anna: { speaks: true, n: 4000, c: { justic: 60, ruler: 30, virtu: 8, common: 100, peopl: 90 } },
  boro: { speaks: true, n: 4000, c: { virtu: 70, heaven: 50, ruler: 6, common: 100, peopl: 90 } },
  cato: { speaks: true, n: 4000, c: { self: 80, soul: 60, common: 100, peopl: 90, justic: 4 } },
  tech: { speaks: false, n: 4000, c: { algebra: 90, equat: 70, common: 100, peopl: 90 } },
};
function synth(calibration = {}) {
  const vocab = [...new Set(Object.values(THINKERS).flatMap((t) => Object.keys(t.c)))].sort(), id = new Map(vocab.map((w, i) => [w, i]));
  return decodeProfile({
    schema: "ThinkerProfile@1", vocab: vocab.join(" "), calibration: { mu: 100, T: 1.5, m: 1, tau: 0.6, bonus: 4, ...calibration },
    thinkers: Object.entries(THINKERS).map(([handle, t]) => ({ handle, speaks: t.speaks, n: t.n, c: Object.entries(t.c).map(([w, k]) => id.get(w) + ":" + k).join(",") })),
  });
}
const model = synth();

test("contentStems: closed-class words, numbers and archaic pronouns are removed, plurals are stemmed", () => {
  assert.deepEqual(contentStems("Is there a God? How should I treat my enemies?"), ["god", "treat", "enemi"]);
  assert.deepEqual(contentStems("thou hast said unto thee"), []);
  assert.deepEqual(contentStems("In 1879 the 12 virtues"), ["virtu"]);
  assert.deepEqual(contentStems("water h2o formula 3rd"), ["water", "formula"], "a token with a digit is not a content stem");
  assert.deepEqual(contentStems(""), []); assert.deepEqual(contentStems(null), []);
});

test("scoring: a stem a thinker uses far above the background lifts that thinker; an unknown stem says nothing", () => {
  const s = scoreKnown(model, knownStems(model, "justice"));
  const order = [...s.keys()].sort((a, b) => s[b] - s[a]).map((i) => model.handles[i]);
  assert.equal(order[0], "anna");
  assert.equal(knownStems(model, "xyzzy plugh").length, 0);
  assert.equal(knownStems(model, ["justic", "justic", "justic"])[0].k, M.DECLARED.cap, "a repeated stem counts at most `cap` times");
});

test("accepts clear evidence: ranked list, a score and a confidence per thinker, not undetermined", () => {
  const r = classify("justice and the ruler", { model });
  assert.equal(r.undetermined, false); assert.equal(r.why, "accepted");
  assert.equal(r.ranked[0].handle, "anna");
  for (const e of r.ranked) { assert.ok(Number.isFinite(e.score)); assert.ok(e.confidence >= 0 && e.confidence <= 1); }
  assert.ok(r.ranked.length <= 3);
});

test("TYPED GAP: no known content stem is `undetermined`, and a prior is carried but never inherited", () => {
  const r = classify("and what about that?", { model, prior: { handles: ["boro"], bonus: 4 }, params: { m: 0, tau: 0 } });   // gates wide open: only the no-evidence rule can say no
  assert.equal(r.undetermined, true); assert.equal(r.why, "no-known-content-stems"); assert.deepEqual(r.ranked, []); assert.deepEqual(r.carried, ["boro"]);
});

test("GATE minimum evidence: fewer known stems than m is undetermined (mass gate off, so only this gate can say no)", () => {
  const r = classify("justice", { model, params: { m: 2, tau: 0 } });
  assert.equal(r.undetermined, true); assert.match(r.why, /too-few-known-stems/);
  assert.equal(classify("justice ruler", { model, params: { m: 2, tau: 0 } }).undetermined, false);
});

test("GATE mass: a stem every thinker uses equally does not stand out, so it is undetermined, not a guess", () => {
  const r = classify("common people", { model, params: { m: 1, tau: 0.9 } });
  assert.equal(r.undetermined, true); assert.match(r.why, /no-thinker-stands-out/); assert.deepEqual(r.ranked, []);
  assert.ok(r.considered.length === 3, "the diagnostic top 3 is still shown");
});

test("DISTRACTOR classes: technical canon absorbs technical text and is never offered", () => {
  const r = classify("algebra equation", { model, params: { m: 1, tau: 0.2 } });
  assert.equal(r.undetermined, true, "the technical canon owns this text; no speaking thinker owns it");
  assert.equal(r.closestSpeaks, false); assert.equal(r.closest, "tech");
  const r2 = classify("virtue and the ruler", { model, params: { tau: 0.2 } });
  assert.ok(!r2.ranked.some((e) => e.handle === "tech") && !r2.candidates.some((e) => e.handle === "tech"));
});

test("SESSION PRIOR reorders but cannot open the gate", () => {
  // 'justice' alone favours anna; a prior on cato with a big head start moves cato up the list ...
  const p = { handles: ["cato"], bonus: 4 };
  const base = classify("justice", { model, params: { tau: 0 } }), withP = classify("justice", { model, prior: p, params: { tau: 0 } });
  assert.equal(base.ranked[0].handle, "anna"); assert.equal(withP.ranked[0].handle, "cato");
  assert.ok(withP.ranked.find((e) => e.handle === "cato").confidence > base.ranked.find((e) => e.handle === "cato").confidence);
  // ... but a stem that does not stand out stays undetermined under any prior (the gate reads the evidence alone)
  const weak = classify("common people", { model, prior: { handles: ["anna", "boro", "cato"], bonus: 8 }, params: { m: 1, tau: 0.9 } });
  assert.equal(weak.undetermined, true);
  // gatePrior:true is the run-1 behaviour (the prior in the gate) and would have offered it
  assert.equal(classify("common people", { model, prior: { handles: ["anna", "boro", "cato"], bonus: 8 }, params: { m: 1, tau: 0.9, gatePrior: true } }).undetermined, false);
});

test("priorOf / classifyThread: only an accepted turn becomes the next prior; an undetermined turn carries the old one", () => {
  const acc = classify("justice and the ruler", { model });
  assert.deepEqual(priorOf(acc).handles, acc.ranked.map((r) => r.handle));
  assert.equal(priorOf(classify("common people", { model, params: { tau: 0.9 } })), null);
  const rs = classifyThread(["justice and the ruler", "and what about that?", "xyzzy"], { model });
  assert.equal(rs.length, 3); assert.equal(rs[1].undetermined, true); assert.ok(rs[1].carried && rs[1].carried.length, "turn 2 carries the thread's thinkers");
});

test("never throws on garbage; no model is a typed gap", () => {
  for (const x of [undefined, null, 42, {}, [], "", "   ", "????", "x".repeat(10000)]) { const r = classify(x, { model }); assert.equal(r.undetermined, true); assert.ok(Array.isArray(r.ranked)); }
  assert.equal(classify("justice", {}).why, "no-profile");
  assert.throws(() => decodeProfile({}), /ThinkerProfile/);
});

test("determinism: the same input gives the same output", () => {
  assert.deepEqual(classify("justice and the ruler", { model }), classify("justice and the ruler", { model }));
});

// ── the build step's pure parts ──
test("build: the split is by position in runs of 20 (60/20/20) and units are >= 40 content stems; Gutenberg boilerplate is stripped", () => {
  const sp = Array.from({ length: 100 }, (_, i) => B.splitOf(i));
  assert.equal(sp.filter((x) => x === "train").length, 60); assert.equal(sp.filter((x) => x === "dev").length, 20); assert.equal(sp.filter((x) => x === "test").length, 20);
  assert.equal(B.splitOf(0), "train"); assert.equal(B.splitOf(60), "dev"); assert.equal(B.splitOf(80), "test"); assert.equal(B.splitOf(99), "test"); assert.equal(B.splitOf(100), "train");
  const body = Array.from({ length: 60 }, (_, i) => `The virtuous ruler considers justice number ${i} among the peoples of heaven and earth.`).join("\n\n");
  const g = `Header Project Gutenberg junk\n*** START OF THIS PROJECT GUTENBERG EBOOK X ***\n${body}\n*** END OF THIS PROJECT GUTENBERG EBOOK X ***\nlicense gutenberg trademark`;
  assert.ok(!/gutenberg|trademark|Header/i.test(B.stripBoilerplate(g)));
  const us = B.unitsOf(g); assert.ok(us.length >= 2); for (const u of us.slice(0, -1)) assert.ok(u.stems.length >= 40);
  assert.ok(us.every((u) => !u.stems.includes("gutenberg")));
});

// ── the real profile ──
const PROFILE = path.join(HERE, "voice/thinkers-profile.json");
const have = fs.existsSync(PROFILE);
test("real profile: calibrated, every thinker has a verified source hash, the technical canons are distractors", { skip: !have }, () => {
  const prof = JSON.parse(fs.readFileSync(PROFILE, "utf8")); const m = decodeProfile(prof);
  assert.ok(prof.calibration.chosenOn, "calibration was written by eval/ants/B1-eval.mjs --write");
  assert.ok(m.T >= 30 && m.V > 10000);
  for (const t of prof.thinkers) assert.match(t.source.sha256, /^[0-9a-f]{64}$/);
  for (const h of ["synapse", "wigmore", "brahmagupta"]) assert.equal(m.speaks[m.handles.indexOf(h)], false, h);
  assert.ok(fs.statSync(PROFILE).size < 1.5 * 1024 * 1024, "profile stays under ~1.5 MB");
});
test("real profile: every handle's source hash equals the concern field's recorded hash (the canon is not another file)", { skip: !have || !fs.existsSync(B.FIELDS) }, () => {
  const prof = JSON.parse(fs.readFileSync(PROFILE, "utf8"));
  for (const t of prof.thinkers) { const f = JSON.parse(fs.readFileSync(path.join(B.FIELDS, t.handle + ".json"), "utf8")); assert.equal(t.source.sha256, f.source.sha256, t.handle); }
});
test("real profile: verbatim canon sentences are recognised (smoke, not a held-out claim); lookups and chatter are typed gaps", { skip: !have || !fs.existsSync(path.join(HERE, "voice/voice-bank.json")) }, () => {
  const m = decodeProfile(JSON.parse(fs.readFileSync(PROFILE, "utf8")));
  const bank = JSON.parse(fs.readFileSync(path.join(HERE, "voice/voice-bank.json"), "utf8"));
  let ok = 0, n = 0;
  for (const h of ["mozi", "xunzi", "ramakrishna", "vivekananda", "mahavira", "nagarjuna", "vasana", "zhengming", "solon", "whitman"]) {
    const rows = bank[h]; if (!rows || rows.length < 6) continue;
    const text = rows.slice(0, 12).map((r) => r.text).join(" "); const r = classify(text, { model: m }); n++;
    if (!r.undetermined && r.ranked.some((e) => e.handle === h)) ok++;
  }
  assert.ok(n >= 6 && ok / n >= 0.75, `recognised ${ok}/${n}`);
  for (const q of ["How tall is the Eiffel Tower?", "Who designed it?", "hey does anybody know why my wifi keeps dropping", "What is the capital of Australia?"]) assert.equal(classify(q, { model: m }).undetermined, true, q);
});
