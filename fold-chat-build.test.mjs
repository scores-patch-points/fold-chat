// fold-chat-build.test.mjs — the in-memory build log: purity, provenance, the
// refusal, resume, hunt-first order, the named gap, and the field snipper.
import { test } from "node:test";
import assert from "node:assert/strict";
import { materialize, createBuild, unitsFromOutline, snipFor, grounded, figuresIn, bytesOf, BUILD_LOG_SCHEMA, imageUrlsIn, assetFor } from "./fold-chat-build.js";

const mk = (arr) => arr.map((c, i) => ({ seq: i, ...c }));
const base = mk([
  { kind: "unit", phase: "define", unit: "a", spec: "returns A" },
  { kind: "unit", phase: "define", unit: "b", spec: "returns B" },
  { kind: "fill", unit: "a", source: "field", address: "corpus://a", code: "const a = () => 'A';" },
]);

test("materialize is pure — same log, same bytes", () => {
  assert.equal(materialize(base).code, materialize(base).code);
});

test("provenance carries source + address", () => {
  const p = materialize(base);
  assert.equal(p.units[0].source, "field");
  assert.equal(p.units[0].address, "corpus://a");
});

test("a refusal never enters the projection; the unit stays unfilled", () => {
  const refused = mk([...base, { kind: "refusal", unit: "b", source: "draw", reason: "did not parse" }]);
  const pr = materialize(refused);
  assert.ok(!pr.code.includes("'B'"));
  assert.equal(pr.units.length, 1);
  assert.equal(pr.complete, false);
  assert.equal(pr.refusals, 1);
});

test("resume is append — a later fill supersedes and completes the projection", () => {
  const resumed = mk([...base, { kind: "fill", unit: "b", source: "hunt", address: "https://x/b.js", code: "const b = () => 'B';" }]);
  const pres = materialize(resumed);
  assert.equal(pres.complete, true);
  assert.ok(pres.code.includes("'B'"));
  assert.equal(pres.units[1].source, "hunt");
});

test("createBuild: hunt-first (field, then hunt, then the mouth); the log records every source", async () => {
  const order = [];
  const { artifact, verdict, log } = await createBuild({
    units: [{ name: "a", spec: "" }, { name: "b", spec: "" }, { name: "c", spec: "" }],
    field: async (u) => { order.push("field:" + u.name); return u.name === "a" ? { code: "A()", address: "corpus://a" } : null; },
    hunt: async (u) => { order.push("hunt:" + u.name); return u.name === "b" ? { code: "B()", address: "https://x/b" } : null; },
    draw: async (u) => { order.push("draw:" + u.name); return { code: "C()", model: "m" }; },
    gate: () => ({ ok: true }),
    test: () => ({ ok: true, reason: "15/15" }),
  });
  assert.deepEqual(order.slice(0, 2), ["field:a", "field:b"]);
  assert.equal(artifact.units.length, 3);
  assert.equal(artifact.units[0].source, "field");
  assert.equal(artifact.units[1].source, "hunt");
  assert.equal(artifact.units[2].source, "draw");
  assert.equal(artifact.units[2].model, "m");
  assert.equal(verdict.ok, true);
  assert.equal(log[log.length - 1].kind, "verdict");
  assert.equal(log.every((c) => c.schema === BUILD_LOG_SCHEMA), true);
});

test("createBuild: a rejected candidate is a refusal and the mouth is then asked", async () => {
  const { artifact, log } = await createBuild({
    units: [{ name: "a", spec: "" }],
    field: async () => ({ code: "bad", address: "corpus://a" }),
    draw: async () => ({ code: "good", model: "m" }),
    gate: (u, code) => ({ ok: code === "good", reason: "must be good" }),
  });
  assert.equal(artifact.units[0].source, "draw");
  assert.equal(log.filter((c) => c.kind === "refusal").length, 1);
  assert.equal(log.filter((c) => c.kind === "refusal")[0].source, "field");
});

test("createBuild: nothing passes -> the unit is a NAMED GAP, never invented", async () => {
  const { artifact, log } = await createBuild({ units: [{ name: "a", spec: "" }], field: async () => null, draw: async () => null, gate: () => ({ ok: true }) });
  assert.equal(artifact.complete, false);
  assert.equal(artifact.units.length, 0);
  assert.equal(log.some((c) => c.kind === "unfilled" && c.unit === "a"), true);
});

test("unitsFromOutline: one unit per line, the NEEDS line dropped", () => {
  const u = unitsFromOutline("hero — the opening statement\ncards: prices\nNEEDS: nothing\n\n- faq — common questions");
  assert.deepEqual(u.map((x) => x.name), ["hero", "cards", "faq"]);
  assert.equal(u[0].spec, "the opening statement");
});

test("snipFor: the most-overlapping passage, snipped, with an address; null below the floor", () => {
  const material = [
    { source: "a.example", text: "Unrelated words about weather and tides." },
    { source: "b.example", text: "The dolphin population fell to 52 by 2019. The survey counted calves." },
  ];
  const s = snipFor({ name: "dolphin population", spec: "the count" }, material);
  assert.equal(s.address, "b.example#1");
  assert.match(s.code, /52/);
  assert.equal(snipFor({ name: "zzz qqq", spec: "" }, material), null);
});

test("grounded: a DRAWN figure no passage holds fails; a field figure passes", () => {
  const material = [{ text: "The count was 52 in 2019." }];
  assert.equal(grounded({ name: "x" }, "There were 52 calves.", material).ok, true);
  assert.equal(grounded({ name: "x" }, "There were 900 calves.", material).ok, false);
  assert.deepEqual(figuresIn("1,234 and 5.6"), ["1234", "5.6"]);
});

test("bytesOf: UTF-8 length without Buffer", () => {
  assert.equal(bytesOf("abc"), 3);
  assert.equal(bytesOf("é"), 2);
});

// ── the ask is checked ELSEWHERE (fold-chat-require.js): the ask folds into
//    verbatim-verified atoms and the page is joined against them. This module
//    no longer recognises any family of options (the removed percentage rule). ──

// ── the asset field: an EXISTING image, never an invented URL ────────────────
test("imageUrlsIn: only real image URLs in the material's own text", () => {
  assert.deepEqual(imageUrlsIn("see https://x.example/a.png and https://y.example/not-a-page"), ["https://x.example/a.png"]);
  assert.deepEqual(imageUrlsIn("no urls here"), []);
});

test("assetFor: an image-like unit takes an existing image from a passage ABOUT it", () => {
  const material = [{ source: "a.example", text: "the hero image shows a dolphin in the bay", images: ["https://a.example/dolphin.jpg"] }];
  const a = assetFor({ name: "hero image", spec: "a dolphin" }, material);
  assert.match(a.code, /^<img src="https:\/\/a\.example\/dolphin\.jpg"/);
  assert.equal(a.address, "a.example#img0");
  assert.equal(assetFor({ name: "prices", spec: "the table" }, material), null);
});

test("F3 · assetFor: a TEXT unit named 'hero title' gets no image (a bare 'hero' is not an image)", () => {
  const material = [{ source: "a.example", text: "hero title welcome", images: ["https://a.example/photo.jpg"] }];
  assert.equal(assetFor({ name: "hero title", spec: "the headline" }, material), null);
});

test("F4 · assetFor: an image from an UNRELATED passage is refused (no cross-source picture)", () => {
  const material = [
    { source: "dolphins.example", text: "Dolphins are mammals.", images: ["https://dolphins.example/dolphin.jpg"] },
    { source: "widgets.example", text: "A tip calculator computes gratuity.", images: [] },
  ];
  assert.equal(assetFor({ name: "hero image", spec: "a tip calculator" }, material), null);
});

test("assetFor: an image-like unit with no source image is a named gap, never a made-up URL", () => {
  assert.equal(assetFor({ name: "hero image", spec: "a dolphin" }, [{ source: "a.example", text: "dolphins" }]), null);
});
