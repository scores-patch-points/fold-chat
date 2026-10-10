// concepts.mjs — mull over a thought by drawing on the universe of priors.
//
// THE UNIT IS A CONCEPT, NOT A TOKEN. A word-level prior makes soup; the read's
// bound edge is only as good as its gloss. Under both sits the project's own
// CONCEPT universe, and it is large and clean: **Concepticon** — 4,165 concept
// sets, each with an English GLOSS, a SEMANTIC FIELD, and a DEFINITION
// (Zenodotus/11-multi-language/concepticon), plus 854 typed relations
// (`partof`, `instanceof`, …). A definition is a coherent sentence whose subject
// is a concept; a relation is an edge between concepts. That is the material a
// passage of thought is actually made of.
//
// FEED IT SOMETHING TO THINK ABOUT. The thought's words are matched to concepts
// (HOME for "homecoming", GUEST for "the guest"); those concepts are the
// standing focus. Each step sets down one concept — its definition, in English —
// and moves along a real relation to the next. It drifts within a SEMANTIC FIELD
// (the concepts that belong together) and returns to the seed (rumination).
//
// JANUS keeps it coherent: a concept is admitted only if a real relation (or a
// shared semantic field) ties it to the present one — continuity of topic.
// PENELOPE gives it pathos: she routes an archon from the thought and lays in
// its verified sentences as refrains. No model is called; everything is a prior.

import fs from "node:fs";

export const DEFAULT_CONCEPTICON = "/Users/mlacy/Documents/3.0/Zenodotus/11-multi-language/concepticon";
export const CONCEPTS_SCHEMA = "EOMindWanderConcepts@1";

const STOP = new Set("the a an and or of to in on at it is was were be been being i you he she we they his her their its as for with that this from by not but if so then than there here what which who how when where why all any some no nor do did does have has had will would can could may might must about into over under out up down".split(" "));
const words = (s) => (String(s ?? "").toLowerCase().match(/[a-z']+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w));

/**
 * loadConceptUniverse({ dir }) -> {
 *   concepts: Map<id, { id, gloss, field, def, category }>,
 *   neighbours: Map<id, [{ rel, to }]>,   // directed both ways
 *   byField: Map<field, id[]>,
 *   byGloss: Map<GLOSS, id>,
 *   stats
 * }
 * Reads the shipped Concepticon TSVs. A missing file is a disclosed refusal.
 */
export function loadConceptUniverse({ dir = DEFAULT_CONCEPTICON } = {}) {
  const read = (f) => { try { return fs.readFileSync(`${dir}/${f}`, "utf8"); } catch { return null; } };
  const ctsv = read("concepticon.tsv");
  const rtsv = read("conceptrelations.tsv");
  if (!ctsv) return { ok: false, reason: `concepticon.tsv not readable under ${dir}` };
  const concepts = new Map();
  const byGloss = new Map();
  const byField = new Map();
  for (const line of ctsv.split("\n").slice(1)) {
    if (!line.trim()) continue;
    const [id, gloss, field, def, category] = line.split("\t");
    const n = Number(id);
    if (!Number.isFinite(n) || !gloss) continue;
    if (def && def.trim() === "?") { /* relational concept: gloss only */ }
    const c = { id: n, gloss, field: field || "", def: def && def !== "?" ? def : null, category: category || "" };
    concepts.set(n, c);
    if (!byGloss.has(gloss)) byGloss.set(gloss, n);
    if (!byField.has(c.field)) byField.set(c.field, []);
    byField.get(c.field).push(n);
  }
  const neighbours = new Map();
  const add = (a, b, rel) => { if (!neighbours.has(a)) neighbours.set(a, []); neighbours.get(a).push({ rel, to: b }); };
  if (rtsv) for (const line of rtsv.split("\n").slice(1)) {
    if (!line.trim()) continue;
    const [src, , rel, tgt] = line.split("\t");
    const a = Number(src), b = Number(tgt);
    if (!concepts.has(a) || !concepts.has(b)) continue;
    add(a, b, rel); add(b, a, rel);
  }
  return { ok: true, concepts, neighbours, byField, byGloss, stats: { concepts: concepts.size, relations: [...neighbours.values()].reduce((n, l) => n + l.length, 0) / 2, fields: byField.size } };
}

const cap = (s) => { const t = String(s ?? ""); return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase(); };
const sentence = (c) => `${cap(c.gloss)} — ${c.def || `related as ${c.category || "a concept"}.`}`;

/**
 * makeConceptMuller({ think, register, seed, steps, driftP, returnP, refrainEvery })
 *   -> { step(), record(), seeds }
 *
 * One `step()` sets down ONE concept (its definition) and moves along a real
 * relation. Janus licenses only a concept tied to the present one by a relation
 * or a shared semantic field.
 */
export async function makeConceptMuller({ think = "", register = "attentive", seed = 1, driftP = 0.2, returnP = 0.12, refrainEvery = 6, universe = null } = {}) {
  const U = universe ?? loadConceptUniverse();
  if (!U.ok) return { ok: false, reason: U.reason, step: () => ({ sentence: null }), record: () => ({ schema: CONCEPTS_SCHEMA, drew: false, gap: U.reason }) };

  const rng = (() => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  const tw = words(think);
  // seed concepts: exact gloss match on a thought word, else the concept whose
  // gloss shares the most words with the thought, else the best-connected one.
  const seeds = [];
  for (const w of tw) { const g = w.toUpperCase(); if (U.byGloss.has(g) && !seeds.includes(U.byGloss.get(g))) seeds.push(U.byGloss.get(g)); }
  if (!seeds.length) {
    let best = null;
    for (const c of U.concepts.values()) { const bag = new Set(words(c.gloss + " " + c.def)); let hit = 0; for (const w of tw) if (bag.has(w)) hit += 1; if (hit > 0 && (!best || hit > best.hit)) best = { id: c.id, hit }; }
    if (best) seeds.push(best.id);
  }
  if (!seeds.length) { const top = [...U.neighbours.entries()].sort((a, b) => b[1].length - a[1].length)[0]; if (top) seeds.push(top[0]); }
  if (!seeds.length) return { ok: false, reason: "the universe holds no concept to start from", step: () => ({ sentence: null }), record: () => ({ schema: CONCEPTS_SCHEMA, drew: false, gap: "no seed concept" }) };

  const anchor = new Set(seeds);
  let cur = seeds[0];
  const used = new Set();
  const rows = [];
  let n = 0;

  // Penelope: one archon from the thought; its verified sentences are refrains.
  let archon = null, refrains = [];
  try {
    const { routeArchon, sentencesOf } = await import("./penelope.mjs");
    const { loadManifest } = await import("../../../penelope/organs/pythia.mjs");
    const routed = routeArchon(loadManifest(), { topic: think, spine: think });
    if (routed?.voice) { archon = routed.rec; refrains = sentencesOf(routed.voice).map((t, at) => ({ text: t, at, bag: new Set(words(t)) })); }
  } catch { /* no cast */ }
  const usedRefrain = new Set();
  const recent = new Map();

  function candidates() {
    const rels = (U.neighbours.get(cur) ?? []).filter((x) => !used.has(x.to));
    if (rels.length) return rels.map((x) => ({ id: x.to, via: x.rel }));
    // no relation: drift within the semantic field of the current concept
    const field = U.concepts.get(cur)?.field;
    const sibs = (U.byField.get(field) ?? []).filter((id) => id !== cur && !used.has(id));
    if (sibs.length) return sibs.map((id) => ({ id, via: "same-field" }));
    // exhausted: any unused concept (disclosed as a leap)
    return [...U.concepts.keys()].filter((id) => !used.has(id)).slice(0, 20).map((id) => ({ id, via: "leap" }));
  }

  function refrainFor() {
    const near = new Set([...recent.keys()].slice(-8));
    let best = null;
    for (const r of refrains) { if (usedRefrain.has(r.at)) continue; let hit = 0; for (const w of r.bag) if (near.has(w)) hit += 1; if (hit > 0 && (!best || hit > best.hit)) best = { r, hit }; }
    if (!best) return null; usedRefrain.add(best.r.at); return best.r.text.replace(/^["“]|["”]$/g, "");
  }

  function step() {
    n += 1;
    const c = U.concepts.get(cur);
    const refrain = n % refrainEvery === 0 ? refrainFor() : null;
    const row = {
      n, concept: { id: c.id, gloss: c.gloss, field: c.field, def: c.def, category: c.category },
      sentence: sentence(c), field: c.field, refrain,
      janus: { ok: true, kind: "licensed", detail: `concept ${c.gloss} is on the thread` },
    };
    rows.push(row);
    used.add(cur);
    if (c.def) for (const w of words(c.def)) recent.set(w, c.id);

    // choose the next move after the statement
    const drift = rng() < driftP, ret = rng() < returnP;
    let next = null;
    if (ret && !used.has(seeds[0])) next = { id: seeds[0], via: "return" };
    else {
      const cands = candidates();
      const preferField = drift && c.field ? cands.filter((x) => U.concepts.get(x.id)?.field === c.field) : cands;
      const pool = (preferField.length ? preferField : cands);
      if (pool.length) next = pool[Math.floor(rng() * pool.length)];
    }
    if (next) {
      row.next = { gloss: U.concepts.get(next.id)?.gloss, via: next.via };
      row.janus.detail = `${c.gloss} —${next.via}→ ${U.concepts.get(next.id)?.gloss}`;
      cur = next.id;
    } else {
      // exhausted and no relation: re-centre on the thought
      cur = seeds[Math.floor(rng() * seeds.length)];
      row.next = { gloss: U.concepts.get(cur)?.gloss, via: "return" };
    }
    return row;
  }

  function record() {
    const passage = rows.map((r) => r.sentence).join(" ");
    return {
      schema: CONCEPTS_SCHEMA, think, register, steps: rows.length, seeds: seeds.map((id) => U.concepts.get(id)?.gloss),
      archon: archon ? { handle: archon.handle, giver: archon.giver, work: archon.work } : null,
      refrains: rows.filter((r) => r.refrain).map((r) => r.refrain),
      fields: [...new Set(rows.map((r) => r.field))],
      universe: U.stats,
      passage,
      basis: `${rows.length} concept(s) drawn from ${U.stats.concepts.toLocaleString()} concept sets / ${U.stats.relations} relations; ${[...new Set(rows.map((r) => r.field))].length} semantic field(s) visited; ${archon ? `Penelope laid ${rows.filter((r) => r.refrain).length} refrain(s) from ${archon.handle}` : "no cast for refrains"} — no model called`,
    };
  }

  return { ok: true, step, record, seeds };
}
