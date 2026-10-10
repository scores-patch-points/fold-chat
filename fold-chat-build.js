// fold-chat-build.js — THE APPEND-ONLY BUILD LOG, IN THE BROWSER (an experiment).
//
// The Fold's make used to be mouth-first: the model wrote the whole page. This
// is the weave's mechanism (penelope organs/generation/build-log.mjs) ported to
// the browser — no fs, an in-memory log — so the page can be STITCHED from what
// was actually read:
//
//   HUNT-FIRST  for each piece, the FIELD (the passages the reading already
//               produced) is consulted before the MOUTH; a piece is a real
//               addressed span, snipped, with provenance.
//   MOUTH-LAST  the mouth draws only the irreducible residue.
//   FALSIFY     a candidate the gate rejects is a REFUSAL, never a fill; the
//               artifact carries its verdict and its refusals.
//   MATERIALIZE the artifact is a PURE projection of the log (same log, same
//               bytes); the log is the truth, the page is its fold.
//
// PURE: materialize is a pure fold of the claims; createBuild is pure w.r.t. its
// injected field/hunt/draw/gate/assemble/test. Falsifying control: a refused
// candidate must never enter the projection, and a unit with no passing byte is
// left UNFILLED (a named gap), never invented.

export const BUILD_LOG_SCHEMA = "BuildLog@1";
export const PROJECTION_SCHEMA = "BuildProjection@1";

const enc = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
/** bytesOf(s) — UTF-8 length without Buffer (browser-safe). */
export function bytesOf(s) {
  const t = String(s ?? "");
  return enc ? enc.encode(t).length : t.length;
}

const bySeq = (a, b) => (a.seq ?? 0) - (b.seq ?? 0);

/** materialize(claims, { assemble, delimiter }) -> the artifact, PURE.
 *  Unit order is the order of its own `define`; each unit takes its LAST applied
 *  fill (so a repair supersedes by appending); `assemble` turns the joined bytes
 *  into the shipped artifact. No clock, no IO. */
export function materialize(claims, { assemble = null, delimiter = "\n" } = {}) {
  const rows = [...(claims ?? [])];
  const order = rows.filter((c) => c.kind === "unit" && c.phase === "define").sort(bySeq).map((c) => c.unit);
  const units = [];
  for (const name of order) {
    const fills = rows.filter((c) => c.kind === "fill" && c.unit === name && c.applied !== false).sort(bySeq);
    const last = fills[fills.length - 1];
    if (last) units.push({ unit: name, code: last.code, source: last.source ?? "draw", address: last.address ?? null, model: last.model ?? null, bytes: bytesOf(last.code) });
  }
  const joined = units.map((u) => u.code).join(delimiter);
  const code = typeof assemble === "function" ? assemble(joined, order, units) : joined;
  const verdicts = rows.filter((c) => c.kind === "verdict").sort(bySeq);
  const refusals = rows.filter((c) => c.kind === "refusal");
  return {
    schema: PROJECTION_SCHEMA,
    code,
    order,
    units,
    provenance: units.map((u) => ({ unit: u.unit, source: u.source, address: u.address, model: u.model, bytes: u.bytes })),
    verdict: verdicts.length ? verdicts[verdicts.length - 1] : null,
    refusals: refusals.length,
    complete: units.length === order.length,
  };
}

/** createBuild({ units, field, hunt, draw, gate, assemble, test }) — the in-memory
 *  build. Fills each unit field → hunt → mouth; logs a fill or a refusal for
 *  every candidate; folds; runs the real test; logs the verdict. Returns
 *  { artifact, verdict, log }.
 *    field(unit) -> { code, address } | null
 *    hunt(unit)  -> { code, address } | null
 *    draw(unit)  -> { code|text, model } | null
 *    gate(unit, code) -> { ok, reason }
 *    assemble(joined, order, units) -> code | null
 *    test(artifact, units) -> { ok, reason }
 */
export async function createBuild({ units = [], field = null, hunt = null, draw = null, gate = () => ({ ok: true, reason: "ungated" }), assemble = null, test = null } = {}) {
  const log = [];
  const A = (claim) => { const row = { schema: BUILD_LOG_SCHEMA, seq: log.length, ...claim }; log.push(row); return row; };
  for (const u of units) A({ kind: "unit", phase: "define", unit: u.name, spec: u.spec ?? null });
  for (const u of units) {
    let filled = false;
    for (const [source, fn] of [["field", field], ["hunt", hunt]]) {
      if (filled || typeof fn !== "function") continue;
      const cand = await fn(u);
      if (!cand) continue;
      const g = gate(u, cand.code);
      if (g.ok) { A({ kind: "fill", unit: u.name, source, address: cand.address ?? null, code: cand.code, model: null, applied: true }); filled = true; }
      else A({ kind: "refusal", unit: u.name, source, address: cand.address ?? null, reason: g.reason });
    }
    if (!filled && typeof draw === "function") {
      let d = null;
      try { d = await draw(u); } catch { d = null; }
      const code = d?.code ?? d?.text ?? "";
      const g = code ? gate(u, code) : { ok: false, reason: "empty draw" };
      if (code && g.ok) { A({ kind: "fill", unit: u.name, source: "draw", address: null, code, model: d.model ?? null, applied: true }); filled = true; }
      else A({ kind: "refusal", unit: u.name, source: "draw", reason: g.reason || "empty draw" });
    }
    if (!filled) A({ kind: "unfilled", unit: u.name, reason: "field, hunt and mouth all came back without a passing byte — a named gap" });
  }
  const artifact = materialize(log, { assemble });
  A({ kind: "fold", bytes: bytesOf(artifact.code), units: artifact.units.length });
  let verdict = { ok: null, reason: "no test declared" };
  try { verdict = typeof test === "function" ? await test(artifact.code, units) : verdict; } catch (e) { verdict = { ok: false, reason: String((e && e.message) || e) }; }
  A({ kind: "verdict", ok: verdict.ok === true, reason: verdict.reason ?? null });
  return { artifact: materialize(log, { assemble }), verdict, log };
}

/** orderOf(claims) — the build's units in the order they were defined. Pure. */
export function orderOf(claims) {
  return [...(claims ?? [])].filter((c) => c.kind === "unit" && c.phase === "define").sort(bySeq).map((c) => ({ name: c.unit, spec: c.spec ?? null }));
}

const stem = (w) => String(w).replace(/(ies|es|s|ing|ed)$/i, "");
/** editedUnits(edit, units) — the units an edit NAMES, best first, ties to the earlier unit.
 *  A NAMED unit (its name shares a word with the edit; stemmed, so "button" meets "buttons")
 *  beats a spec match, so "add a 25% button" touches `buttons`, not every unit whose spec says
 *  "tip". Spec matches are used only when no name matches. Empty when the edit names nothing the
 *  build has. Pure. */
export function editedUnits(edit, units) {
  const want = [...new Set(words(edit).map(stem))];
  if (!want.length) return [];
  const nameHits = [], specHits = [];
  (units ?? []).forEach((u, i) => {
    const nm = new Set(words(u.name).map(stem)), sp = new Set(words(u.spec).map(stem));
    let n = 0, s = 0;
    for (const w of want) { if (nm.has(w)) n += 1; if (sp.has(w)) s += 1; }
    if (n) nameHits.push({ u, score: 2 * n + s, i });
    else if (s) specHits.push({ u, score: s, i });
  });
  const pick = nameHits.length ? nameHits : specHits;
  pick.sort((a, b) => b.score - a.score || a.i - b.i);
  return pick.map((x) => x.u);
}

/** applyEdit(claims, { edit, units, addUnits, draw, field, hunt, gate, assemble, test }) — an
 *  ATOMIC edit to the build log. Only the units the edit TOUCHES get a new `fill` (appended, so it
 *  supersedes the last one); every other unit keeps its last fill BYTE-FOR-BYTE. The artifact is
 *  the fold of the grown log — no unit is redefined, the whole page is never redrawn. Returns
 *  { artifact, verdict, log, touched }. Falsifying control: an untouched unit whose bytes move, or
 *  a unit define row appended for an existing unit, concedes the rule. */
export async function applyEdit(claims, { edit = "", units = null, addUnits = [], draw = null, field = null, hunt = null, gate = () => ({ ok: true, reason: "ungated" }), assemble = null, test = null } = {}) {
  const log = [...(claims ?? [])];
  const A = (claim) => { const row = { schema: BUILD_LOG_SCHEMA, seq: log.length, ...claim }; log.push(row); return row; };
  for (const u of addUnits) A({ kind: "unit", phase: "define", unit: u.name, spec: u.spec ?? null });
  const prior = new Map(materialize(log, { assemble }).units.map((u) => [u.unit, u.code]));
  const targets = (units && units.length) ? units : editedUnits(edit, orderOf(log));
  const touched = [];
  for (const u of targets) {
    const name = u.name, priorCode = prior.get(name) ?? "";
    let filled = false;
    for (const [source, fn] of [["field", field], ["hunt", hunt]]) {
      if (filled || typeof fn !== "function") continue;
      const cand = await fn(u, priorCode, edit);
      if (!cand) continue;
      if (cand.code === priorCode) { A({ kind: "refusal", unit: name, source, address: cand.address ?? null, reason: "the source came back unchanged — nothing to set down" }); continue; }
      const g = gate(u, cand.code, priorCode, edit);
      if (g.ok) { A({ kind: "fill", unit: name, source, address: cand.address ?? null, code: cand.code, model: null, applied: true }); filled = true; }
      else A({ kind: "refusal", unit: name, source, address: cand.address ?? null, reason: g.reason });
    }
    if (!filled && typeof draw === "function") {
      let d = null; try { d = await draw(u, priorCode, edit); } catch { d = null; }
      const code = d?.code ?? d?.text ?? "";
      if (code && code === priorCode) A({ kind: "refusal", unit: name, source: "draw", reason: "the draw came back unchanged — nothing to set down" });
      else {
        const g = code ? gate(u, code, priorCode, edit) : { ok: false, reason: "empty draw" };
        if (code && g.ok) { A({ kind: "fill", unit: name, source: "draw", address: null, code, model: d.model ?? null, applied: true }); filled = true; }
        else A({ kind: "refusal", unit: name, source: "draw", reason: g.reason || "empty draw" });
      }
    }
    if (filled) touched.push(name);
  }
  const artifact = materialize(log, { assemble });
  A({ kind: "fold", bytes: bytesOf(artifact.code), units: artifact.units.length });
  let verdict = { ok: null, reason: "no test declared" };
  try { verdict = typeof test === "function" ? await test(artifact.code, log) : verdict; } catch (e) { verdict = { ok: false, reason: String((e && e.message) || e) }; }
  A({ kind: "verdict", ok: verdict.ok === true, reason: verdict.reason ?? null });
  return { artifact: materialize(log, { assemble }), verdict, log, touched };
}

/** unitsFromOutline(outline) — one unit per planned line ("signature — spec"),
 *  the `NEEDS:` line dropped. A line that is MARKUP or code is NOT a part: when a
 *  planner "plans" by dumping the whole page, the units must never become
 *  "```html", "<!DOCTYPE html>", "<head>" — those are refused, a named gap, not
 *  parts to fill. Pure. */
export function unitsFromOutline(outline, { max = 12 } = {}) {
  const out = [];
  for (const raw of String(outline ?? "").split("\n")) {
    const line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
    if (!line || /^NEEDS\s*:/i.test(line)) continue;
    // a LINE OF CODE OR MARKUP is not a unit — a whole page was dumped, not a plan
    if (/^(<[\w/!]|```|~~~|<!doctype)/i.test(line)) continue;
    if (/[\{\};]/.test(line) && /[=]/.test(line)) continue;   // JS/CSS: code, not a part
    const m = /^(.*?)\s*(?:—|--|:|–)\s*(.*)$/.exec(line);
    const name = (m ? m[1] : line).replace(/["']/g, "").replace(/\s+/g, " ").trim();
    const spec = (m ? m[2] : "").trim();
    if (name && !/^<[^>]*>$/.test(name) && !/^```/.test(name)) out.push({ name: name.slice(0, 60), spec: spec.slice(0, 160) });
    if (out.length >= max) break;
  }
  return out;
}

const STOP = new Set("the a an of and or to in on for with that this it is are was were be as by from at into over a the".split(" "));
const words = (s) => String(s ?? "").toLowerCase().match(/[a-z0-9]{3,}/g)?.filter((w) => !STOP.has(w)) ?? [];

/** snipFor(unit, material) — the best field candidate for a unit: the passage
 *  whose words overlap the unit's name/spec most, snipped to its own sentences,
 *  with an ADDRESS (source#offset). Ties break to the earlier passage. A unit
 *  with no overlap is null (nothing was read about it). Pure. */
export function snipFor(unit, material) {
  const want = new Set([...words(unit.name), ...words(unit.spec)]);
  if (!want.size) return null;
  let best = null, bestScore = 0, bestIdx = -1;
  const ms = Array.isArray(material) ? material : [];
  for (let i = 0; i < ms.length; i += 1) {
    const text = String(ms[i]?.text ?? "");
    const have = new Set(words(text));
    let score = 0;
    for (const w of want) if (have.has(w)) score += 1;
    if (score > bestScore) { bestScore = score; best = ms[i]; bestIdx = i; }
  }
  if (!best || bestScore < 2) return null;
  const snip = String(best.text).split(/(?<=[.!?])\s+/).slice(0, 3).join(" ").trim();
  return { code: snip, address: `${best.source || best.url || "material"}#${bestIdx}` };
}

/** figuresIn(s) — the numbers a fragment asserts (typed, for the gate). Pure. */
export function figuresIn(s) {
  return String(s ?? "").match(/\d[\d,]*(?:\.\d+)?/g)?.map((n) => n.replace(/,/g, "")) ?? [];
}

/** grounded(unit, code, material) — the gate for a stitched fragment: it may not
 *  carry a figure no passage holds. A fragment from the field passes by
 *  construction; this guards the DRAWN residue. Pure. */
export function grounded(unit, code, material) {
  const allowed = new Set((material ?? []).flatMap((m) => figuresIn(m.text)));
  const bad = figuresIn(code).filter((n) => !allowed.has(n));
  if (bad.length) return { ok: false, reason: `asserts ${bad.length} figure(s) no source holds: ${bad.slice(0, 3).join(", ")}` };
  return { ok: true, reason: "every figure traces to a passage" };
}

/** askConstraints / foreignOptions / satisfiesAsk / optionValues were REMOVED
 *  (2026-10-07). They graded a page against a rule the app authored — a family of
 *  options it happened to recognise (a percentage) — which is a private
 *  convention, not a judgment: measured, it passed a page with NONE of an ask's
 *  named buttons. What the ask requires is now read FROM THE ASK and verified
 *  against it (fold-chat-require.js); the product is measured against that by
 *  what it observably shows. External in, external out. */

const IMG_URL = /https?:\/\/[^\s"'<>)}\]]+?\.(?:png|jpe?g|gif|webp|avif|svg)(?:\?[^\s"'<>)}\]]*)?/gi;
/** imageUrlsIn(s) — absolute image URLs already present in what was read (a
 *  passage's own text or links). No invention: only URLs the material carries.
 *  Pure. */
export function imageUrlsIn(s) {
  const out = [];
  for (const m of String(s ?? "").matchAll(IMG_URL)) { if (!out.includes(m[0])) out.push(m[0]); }
  return out;
}

// An IMAGE noun — never a bare layout word ("hero", "banner"), which a text unit
// ("hero title") would match (measured: F3).
const IMAGEISH = /\b(images?|photos?|photographs?|pictures?|logos?|illustrations?|graphics?|icons?|thumbnails?|avatars?)\b/i;
/** assetFor(unit, material) — an EXISTING image for an image-like unit: the
 *  first image URL carried by a passage that is ABOUT the same thing (the same
 *  ≥2-word floor snipFor uses), as an <img> with provenance. A unit with no
 *  relevant source image is null — a named gap, never a made-up URL, never
 *  another source's picture. Pure. */
export function assetFor(unit, material) {
  const u = unit || {};
  if (!IMAGEISH.test(`${u.name || ""} ${u.spec || ""}`)) return null;
  const want = new Set([...words(u.name), ...words(u.spec)]);
  const ms = Array.isArray(material) ? material : [];
  for (let i = 0; i < ms.length; i += 1) {
    const urls = [...imageUrlsIn(ms[i]?.text), ...(Array.isArray(ms[i]?.images) ? ms[i].images : [])].filter((x) => typeof x === "string" && /^https?:\/\//.test(x));
    if (!urls.length) continue;
    if (want.size) {
      const have = words(ms[i]?.text);
      let n = 0; for (const w of want) if (have.includes(w)) n += 1;
      if (n < 2) continue; // the image is not this piece's
    }
    const alt = String(u.name || "image").replace(/["<>]/g, "").slice(0, 80);
    return { code: `<img src="${urls[0]}" alt="${alt}" loading="lazy">`, address: `${ms[i].source || ms[i].url || "material"}#img${i}` };
  }
  return null;
}

export default { BUILD_LOG_SCHEMA, PROJECTION_SCHEMA, bytesOf, materialize, createBuild, orderOf, editedUnits, applyEdit, unitsFromOutline, snipFor, figuresIn, grounded, imageUrlsIn, assetFor };
