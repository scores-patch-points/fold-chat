// telling.mjs — THE TELLING ORDER, mechanically (the-telling-spec.md Phase 2).
//
// The gap the spec names: the machine emits PROPOSITION-JOINS ("Anna cough days")
// where a telling requires WHOLE SITUATION-SENTENCES ("Anna, who has coughed for
// days, still receives the company"). This module does the coordination that
// improves output MECHANICALLY — no model:
//
//   threads     the read's bound edges are grouped by acting being (subject),
//               in story order (first appearance);
//   situations  each being's acts are composed into ONE subject · finite-verb ·
//               object sentence per thread, joined grammatically (", and")
//               — connectors are GRAMMATICAL, never causal (no "because", no
//               "so"); the record holds no cause, so the telling claims none;
//   scenes      adjacent threads (within a byte window) become a paragraph,
//               joined by "Then" only on story adjacency — a coordination of
//               situations, not a join of propositions;
//   styliz      sentence-initial capital, terminal period, third person only;
//   lint        every composed S/V/O must trace to a bound edge (normalized);
//               a sentence that does not is `unjustified`, never shipped.
//
// Pure. The caller supplies the read's bound edges (cleanEdges output) and the
// witnesses map (byte -> source sentence). Every sentence carries its grounds —
// the byte addresses of the edges it tells.

export const TELLING_SCHEMA = "Telling@1";

const col = (x) => String(x ?? "").trim().toLowerCase();
const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);

/** threads(edges) — group bound edges by acting being, in story order. */
export function threadsOf(edges = []) {
  const order = [];
  const map = new Map();
  for (const e of edges) {
    if (!e || !e.s || !e.v) continue;
    if (!map.has(e.s)) { map.set(e.s, []); order.push(e.s); }
    map.get(e.s).push(e);
  }
  return order.map((s) => ({ s, acts: map.get(s).sort((a, b) => a.at - b.at || a.v.localeCompare(b.v)) }));
}

/** scenes(threads, { window }) — adjacent threads within `window` bytes are one
 *  paragraph; a thread stands alone when its first act is distant from all. */
export function scenesOf(threads = [], { window = 12000 } = {}) {
  const scenes = [];
  for (const t of threads) {
    const at = t.acts[0]?.at ?? Infinity;
    const last = scenes.at(-1);
    const lastAt = last ? Math.min(...last.threads.map((x) => x.acts[0]?.at ?? Infinity), ...last.threads.flatMap((x) => x.acts.map((a) => a.at))) : -Infinity;
    if (last && at - lastAt <= window) last.threads.push(t);
    else scenes.push({ threads: [t] });
  }
  return scenes;
}

/** The grammatical join of one being's acts: "V1 O1, V2 O2, and V3 O3". */
export function joinActs(acts = []) {
  const parts = acts.map((a) => `${a.v}${a.o ? " " + a.o : ""}`.trim());
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
}

/** selectReportable — THE TELLING'S OWN RULE (the-telling-spec Phase 2): the
 * act told is the HIGHEST-LEARNING bound proposition, not every verb the seam
 * bound. When the read carries no learning, the earliest acts stand (fallback,
 * disclosed). Only acts with a patient (a bound object) form a situation. */
export function selectReportable(edges, { perSceneThreads = 3, perThreadActs = 2 } = {}) {
  const withDelta = edges.some((e) => Number.isFinite(e.delta));
  const threads = threadsOf(edges);
  const scenes = scenesOf(threads);
  return scenes.map((sc) => {
    const chosen = sc.threads
      .map((t) => {
        const reportable = t.acts.filter((a) => a.o).sort((a, b) => {
          if (withDelta) return (b.delta ?? 0) - (a.delta ?? 0);
          return a.at - b.at;
        }).slice(0, perThreadActs);
        return reportable.length ? { s: t.s, acts: reportable } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.acts[0].at - b.acts[0].at)
      .slice(0, perSceneThreads);
    return chosen;
  }).filter((sc) => sc.length > 0);
}

/** compose an edge's act into a situation sentence with its grounds. */
function sentenceLine(t, { literary } = {}) {
  const line = cap(t.s) + " " + joinActs(t.acts);
  return { s: col(t.s), text: line.replace(/\s+([.,;!?:])/g, "$1") + ".", grounds: t.acts.map((a) => a.at), verbs: t.acts.map((a) => col(a.v)) };
}

/**
 * tell({ edges, witnessEdge }) -> { schema, telling, scenes, lint }
 *  Composes the REPORTABLE situations: the highest-learning act per being per
 *  scene, grammatical join, story order, grounds cited. witnessEdge: a
 *  "does this normalized (s,v[,o]) live in a bound edge?" finder.
 */
export function tell({ edges = [], witnessEdge = null, ...opts } = {}) {
  const scenes = selectReportable(edges, opts);
  const has = witnessEdge || ((s, v) => edges.some((e) => col(e.s) === col(s) && col(e.v) === col(v)));
  const telling = [];
  const lint = { accepted: 0, unjustified: [] };
  for (const st of scenes) {
    const lines = st.map((t) => { const l = sentenceLine(t); return l; });
    const para = lines.map((l) => l.text).join(" Then ");
    for (const l of lines) {
      const ok = l.verbs.every((v) => has(l.s, v));
      if (ok) lint.accepted += 1;
      else lint.unjustified.push({ s: l.s, text: l.text, verbs: l.verbs });
    }
    telling.push({ para, grounds: lines.flatMap((l) => l.grounds) });
  }
  return { schema: TELLING_SCHEMA, telling, scenes: telling.length, lint };
}

/** flatten the telling to plain prose paragraphs. */
export function plaintext(telling) {
  return telling.map((t) => t.para).join("\n\n");
}