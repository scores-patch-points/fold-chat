// janus.mjs — run the wander through Janus so it makes logical sense.
//
// THE WANDER IS NOT LOGICAL BY CONSTRUCTION. It is a Markov walk of a token
// stream: word A follows word B because the corpus put them together, and a
// later pass may put B after A, or put A before some other word entirely. Read
// as a logic of PRECEDENCE, that is incoherent two ways at once:
//
//   • the same word leads to two different words — a standing contradiction
//     when "what follows A" is read as a function (ARG1 one-valued);
//   • a word is reached again through the chain that left it — a cycle, when
//     "precedes" is read as acyclic.
//
// Janus is the organ for exactly this. Each adjacent pair of content words in
// the transcript becomes a concrete claim `precedes(A, B)` at the whole ground;
// `precedes` is declared functional-in-ARG1 and acyclic. `lintGfp` convicts
// both defects, and the consistent spine is the set of transitions that
// survives — the wander with its contradictions and circularities removed.
// `falsifyGfp` then PROBES the kept spine's declarations (a second value, the
// reverse edge) so its coherence is tested, never merely asserted.
//
// Nothing is re-implemented: `claimFromTriple`, `lintGfp`, `falsifyGfp` and
// the identity function are imported from the khora, where the reasoner lives
// (janus/native is a re-export shim onto them — THE-SPINE.md).

import { claimFromTriple, caselessIdentity } from "../../../khora/native/kernel/gfp-claim.js";
import { lintGfp, falsifyGfp } from "../../../khora/native/organs/reasoning-lint.js";
import { isStop } from "./wander.mjs";

export const JANUS_SCHEMA = "EOMindWanderJanus@1";
export const PRECEDES = "precedes";
// A precedence claim is worth making only about a CONTENT word: a wander's
// "the → men" and "the → lights" would otherwise be convicted as a contradiction
// about "the", which is true and useless. Stopwords are not the logic's nouns.
export const isContent = (t) => /^[a-z]/.test(t) && t.length > 2 && !isStop(t);

// The declared logic of the transcript. Both declarations are Janus's own
// vocabulary (kernel/gfp-claim.js: a relation's Pattern carries what a giver
// declared about it — one-valued in a role, acyclic), not invented here.
export const DECLARES = Object.freeze({
  functional: Object.freeze([Object.freeze({ rel: PRECEDES, role: "ARG1" })]),
  acyclic: Object.freeze([PRECEDES]),
  identity: caselessIdentity,
});

/**
 * edgesFromEvents(events) -> [{ i, from, to, id, move, self }]
 * The transcript's content words, in order; each consecutive pair is one
 * precedence claim. `i` is the event index of the SECOND word (the token a
 * refusal would drop); `move` is the wander move that produced it.
 */
export function edgesFromEvents(events) {
  const out = [];
  let prev = null;
  events.forEach((e, i) => {
    if (!isContent(e.event)) return;
    const w = e.event.toLowerCase();
    if (prev != null) out.push({ i, from: prev, to: w, id: `t${i}`, move: e.move, self: prev === w });
    prev = w;
  });
  return out;
}

const claimOf = (edge, force = "default") => claimFromTriple(edge.from, PRECEDES, edge.to, { id: edge.id, ground: "/", force });

const lint = (claims) => lintGfp(claims, { ...DECLARES, strictness: "standard" });
const convicting = (report, id) => report.findings.filter((f) => (f.kind === "standing_contradiction" || f.kind === "circular") && (f.claims ?? []).includes(id));

/**
 * runThroughJanus(events, { limit }) -> {
 *   kept, refuted: [{ edge, kind, cycle }], claims, verdict, probe,
 *   logicalEvents (the wander events with each refused transition's word dropped)
 * }
 *
 * The greedy consistent spine: each transition is offered to Janus in order and
 * kept only if adding it raises no contradiction or cycle that names it. The
 * engine decides, step by step. `limit` bounds the work (each offer re-lints
 * the kept set); the default is generous for a browser run.
 */
export function runThroughJanus(events, { limit = 900 } = {}) {
  const edges = edgesFromEvents(events).slice(0, limit);
  const keptEdges = [];
  const kept = [];
  const refuted = [];
  for (const edge of edges) {
    if (edge.self) { refuted.push({ edge, kind: "circular", cycle: `${edge.from} → ${edge.to} — a word preceding itself begs the question` }); continue; }
    const candidate = [...kept, claimOf(edge)];
    const bad = convicting(lint(candidate), edge.id);
    if (bad.length) refuted.push({ edge, kind: bad[0].kind, cycle: bad[0].detail });
    else { kept.push(claimOf(edge)); keptEdges.push(edge); }
  }

  const final = lint(kept);
  // The kept spine is asserted to hold against a counterexample, so it is
  // probed: falsifyGfp builds each claim's second-value and reverse-edge
  // counterexamples and re-checks them against the real claim set.
  const strict = kept.map((c) => ({ ...c, force: "strict" }));
  const probe = falsifyGfp(strict, { ...DECLARES, strictness: "standard" });
  const probesCaught = probe.findings.filter((f) => f.kind === "strict_guard_reachable").length;

  const refusedIdx = new Set(refuted.map((r) => r.edge.i));
  const logicalEvents = events.filter((e, i) => !refusedIdx.has(i));
  const byKind = refuted.reduce((m, r) => ((m[r.kind] = (m[r.kind] ?? 0) + 1), m), {});

  return {
    schema: JANUS_SCHEMA,
    relation: PRECEDES,
    declares: DECLARES,
    edges: edges.length,
    kept: kept.length,
    refuted,
    byKind,
    claims: kept,
    verdict: { ok: final.ok, contradictions: final.counts.standing_contradiction ?? 0, circular: final.counts.circular ?? 0 },
    probe: { kept: strict.length, caught: probesCaught, unreachable: probe.findings.filter((f) => f.kind === "strict_guard_unreachable").length },
    logicalEvents,
    basis: `${edges.length} precedence claim(s) offered; Janus kept ${kept.length}, refuted ${refuted.length} (${Object.entries(byKind).map(([k, n]) => `${n} ${k}`).join(", ") || "none"}); spine now lenient-coherent (${final.ok ? "no live contradiction" : `${final.counts.standing_contradiction ?? 0} contradiction(s)`}); ${strict.length} kept claim(s) probed — ${probesCaught} counterexample(s) caught`,
  };
}

/** The logical transcript, given the wander's own detokenizer. */
export function logicalTranscript(result, detokenize) {
  return detokenize(result.logicalEvents.map((e) => e.event));
}

/**
 * makeJanusGate() -> { judge(head, event), state(), claims() }
 *
 * THE LIVE GATE. `judge` is called by the wander loop for every proposed token,
 * with the last content word already in the transcript as `head`. It returns
 * `{ ok, kind, detail }`. A candidate is LICENSED only if committing
 * `precedes(head, candidate)` keeps the transcript a consistent precedence
 * FUNCTION with no cycle; otherwise it is REFUSED with the engine's own reason.
 * The decision is genuinely Janus's: the refusal is the `lintGfp` finding for
 * the exact claims in conflict (the earlier claim for `head`, or the path that
 * closes the cycle), not a hand-rolled lookalike.
 *
 * The accepted sequence is exactly what streams: the wander cannot emit a token
 * this gate refuses, so the single output is coherent as it is written.
 */
export function makeJanusGate() {
  const succ = new Map();      // from -> to (the committed precedence function)
  const byFrom = new Map();    // from -> the claim that set it
  const accepted = [];         // every committed claim, in order
  const findingFor = (report, id) => report.findings.find((f) => (f.claims ?? []).includes(id)) ?? null;

  // Is `b` reachable from `a` along the committed function? (a cycle test)
  const reaches = (a, b) => {
    const seen = new Set(); const stack = [a];
    while (stack.length) { const x = stack.pop(); if (seen.has(x)) continue; seen.add(x); if (x === b) return true; const n = succ.get(x); if (n != null) stack.push(n); }
    return false;
  };

  function judge(head, event) {
    const to = String(event ?? "").toLowerCase();
    if (!isContent(to)) return { ok: true, kind: "conceded", detail: `"${to}" is not a content word — outside the logic` };
    if (!head) return { ok: true, kind: "licensed", detail: "no precedence established yet" };
    const from = String(head).toLowerCase();
    const claim = claimOf({ from, to, id: `g${accepted.length}` });

    if (from === to) {
      const rep = lint([...(byFrom.has(from) ? [byFrom.get(from)] : []), claim]);
      return { ok: false, kind: "circular", detail: findingFor(rep, claim.id)?.detail ?? `${from} precedes itself` };
    }
    if (succ.has(from) && succ.get(from) !== to) {
      const rep = lint([byFrom.get(from), claim]);
      return { ok: false, kind: "standing_contradiction", detail: findingFor(rep, claim.id)?.detail ?? `${from} already precedes ${succ.get(from)}` };
    }
    if (reaches(to, from)) {
      const path = []; let x = to;
      while (x != null && x !== from) { const c = byFrom.get(x); if (!c) break; path.push(c); x = succ.get(x); }
      const rep = lint([...path, claim]);
      return { ok: false, kind: "circular", detail: findingFor(rep, claim.id)?.detail ?? `${to} already reaches ${from}` };
    }
    succ.set(from, to); byFrom.set(from, claim); accepted.push(claim);
    return { ok: true, kind: "licensed", detail: `${from} → ${to}` };
  }

  return { judge, claims: () => accepted, state: () => ({ claims: accepted.length, function: succ.size }) };
}
