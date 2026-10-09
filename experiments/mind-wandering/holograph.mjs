// holograph.mjs — mull over a thought using the HOLOGRAPH (the read, not a raw
// token prior).
//
// THE MATERIAL IS THE READ. `khora/native/eval/the-fold/scene/eot-odyssey-150000.json`
// is the scene read just landed: 1,353 referents, 6,299 bound edges, the
// chapters, the voice, the telling. The reader now BINDS real beings — the
// boarding clause made Telemachus a subject ("Telemachus boarded the ship",
// THE-BOARDING-CLAUSE.md). So the coherent unit is not a Markov token; it is a
// bound EDGE: `subject — action — object`, with the subject/object resolved to
// the being's name and the action rendered through the received dictionary
// gloss (translate.mjs's `g`).
//
// WHAT IS KEPT, AND WHAT IS NOT. An edge is admitted to the bank only when its
// action has a real gloss (never `?`) and at least one end is a NAMED being.
// Unglossed verbs, `?ος`-style unresolved referents, and pronoun seats ("you",
// "I") are DISCLOSED, not laundered into prose — the fold's own discipline.
// So every sentence the muller can emit is a clause the read actually made.

import fs from "node:fs";
import { g as gGrk, G as GGrk } from "../../../khora/native/eval/the-fold/scene/translate.mjs";
import { g as gSan, G as GSan } from "../../../khora/native/eval/the-fold/scene/translate-san.mjs";
import { isStop } from "./wander.mjs";

export const DEFAULT_HOLOGRAPH = "/Users/mlacy/Documents/3.0/khora/native/eval/the-fold/scene/eot-odyssey-150000.json";

const STOP_SIMPLE = new Set(["when", "which", "who", "whom", "this", "that", "they", "them", "there", "then", "than", "with", "from", "into", "upon", "over", "have", "been", "being", "will", "would", "could", "should", "must", "might", "shall", "does", "did", "are", "was", "were", "the", "and", "for", "not", "but", "you", "him", "her", "his", "its", "our", "their", "one", "all", "some", "any", "…", "of", "to", "in", "on", "at", "as", "by", "is", "be", "it", "we", "he", "she", "i"]);
const cap = (s) => { const t = String(s ?? ""); return t.charAt(0).toUpperCase() + t.slice(1); };
const contentOf = (parts) => parts.flatMap((p) => String(p ?? "").toLowerCase().match(/[a-z']+/g) ?? []).filter((w) => w.length > 2 && !STOP_SIMPLE.has(w) && !isStop(w));

/** readHolograph(path, {dict}) -> { eot, name, edges, counts } with names
 *  resolved and each edge carrying a gloss (or null) and the named ends. The
 *  dict is the janus dictionary for the read's language — Greek by default,
 *  Sanskrit (translate-san) for the Rigveda. */
export function readHolograph(path = DEFAULT_HOLOGRAPH, { dict = gGrk } = {}) {
  path = path || DEFAULT_HOLOGRAPH;
  const eot = JSON.parse(fs.readFileSync(path, "utf8"));
  const name = new Map(eot.referents.map((r) => [r.hash, r.name]));
  const named = (h) => { const n = String(name.get(h) ?? "").trim(); return n && !n.startsWith("?") && n !== "…" ? n : null; };
  const gloss = (w) => { const y = dict(w); return y && !String(y).startsWith("?") && !STOP_SIMPLE.has(String(y).toLowerCase()) ? y : null; };
  const edges = eot.edges.map((e) => ({ at: e.at, span: e.span, s: named(e.subject), o: named(e.object), verb: gloss(e.action), raw: e.action, subject: e.subject, object: e.object }));
  return { eot, name, named, gloss, edges, counts: eot.counts, dict };
}

/**
 * holographBank(path) -> [{ i, text, cw:Set, cwArr, edge }] — the muller's
 * sentences: one per ADMITTED edge (glossed action, at least one named being).
 * A sentence is a bound clause the read actually made, rendered in English.
 */
export function holographBank(path = DEFAULT_HOLOGRAPH) {
  const h = readHolograph(path);
  const bank = [];
  for (const e of h.edges) {
    if (!e.verb) continue;
    if (!e.s && !e.o) continue;
    const parts = [e.s, e.verb, e.o].filter(Boolean);
    const text = cap(parts.join(" ")) + ".";
    const cwArr = [...new Set(contentOf([e.s, e.verb, e.o]))];
    if (!cwArr.length) continue;
    bank.push({ i: bank.length, text, cw: new Set(cwArr), cwArr, edge: e });
  }
  return bank;
}

/** The named beings the holograph holds, by degree — what a thought can be
 *  about. Useful for seeding and for the UI's suggestions. */
export function castOf(path = DEFAULT_HOLOGRAPH, { limit = 24 } = {}) {
  path = path || DEFAULT_HOLOGRAPH;
  const { name, edges } = readHolograph(path);
  const deg = new Map();
  for (const e of edges) { if (e.s) deg.set(e.s, (deg.get(e.s) ?? 0) + 1); if (e.o) deg.set(e.o, (deg.get(e.o) ?? 0) + 1); }
  return [...deg].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([being, n]) => ({ being, edges: n }));
}

// ── the muller over the read ────────────────────────────────────────────────
// A clause the read actually made, rendered: the being, the act (the gloss when
// the read has one, else the read's OWN Greek surface in quotes — disclosed,
// never replaced by an invented English verb), and the object when named.
export function renderEdge(e) {
  const s = e.s || "the unbound seat";
  const act = e.verb ? e.verb : `“${e.raw}”`;
  const o = e.o ? ` ${e.o}` : "";
  return `${s} ${act}${o}.`;
}

/**
 * makeHoloMuller({ think, register, seed, driftP, refrainEvery, path }) ->
 *   { step(), record(), cast }
 *
 * FEED IT A THOUGHT: the beings the thought names (Telemachus, Athena, the
 * suitors) are the standing focus — the walk leaves them and returns
 * (rumination). Each step follows ONE bound edge whose subject is in focus, in
 * the read's own story order, so the passage is a continuous thread about the
 * thought's cast. Janus keeps the thread: a clause is licensed only if it
 * shares its being with the present focus (continuity of reference); the
 * occasional drift follows a named OBJECT into its own acts. Penelope routes an
 * archon from the thought and lays its verified sentences as refrains.
 */
export async function makeHoloMuller({ think = "", register = "elegiac", seed = 1, driftP = 0.16, refrainEvery = 5, path = DEFAULT_HOLOGRAPH, dict = gGrk } = {}) {
  path = path || DEFAULT_HOLOGRAPH;
  const h = readHolograph(path, { dict });
  const lc = (s) => String(s ?? "").toLowerCase();
  const lower = think.toLowerCase();
  const allBeings = [...new Set(h.edges.flatMap((e) => [e.s, e.o]).filter(Boolean))];
  const seedBeings = allBeings.filter((b) => lower.includes(lc(b)));
  const start = (seedBeings.length ? seedBeings : allBeings).slice(0, 4);
  const anchor = new Set(start.map(lc));

  const bySubject = new Map();
  for (const e of h.edges) if (e.s) { const k = lc(e.s); if (!bySubject.has(k)) bySubject.set(k, []); bySubject.get(k).push(e); }
  for (const list of bySubject.values()) list.sort((a, b) => a.at - b.at);

  const rng = (() => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  const used = new Set();
  const rows = [];
  const focus = new Set(anchor);
  const recent = new Map(); // being -> last story position, for the refrain scent

  // Penelope: one archon from the thought; her verified sentences are refrains.
  let archon = null, refrains = [];
  try {
    const { routeArchon, sentencesOf } = await import("./penelope.mjs");
    const { loadManifest } = await import("../../../penelope/organs/pythia.mjs");
    const routed = routeArchon(loadManifest(), { topic: think, spine: think });
    if (routed?.voice) { archon = routed.rec; refrains = sentencesOf(routed.voice).map((text, at) => ({ text, at, bag: new Set(contentOf([text])) })); }
  } catch { /* no cast */ }
  const usedRefrain = new Set();

  function nextEdge() {
    const drift = rng() < driftP;
    const prefs = drift ? [...focus].slice(-1) : [...focus];
    for (const b of prefs) {
      const list = bySubject.get(b) ?? [];
      for (const e of list) if (!used.has(e)) return { e, basis: b, drift };
    }
    // nothing in focus: an edge sharing a named object with the recent thread
    for (const e of h.edges) if (!used.has(e) && e.o && focus.has(lc(e.o))) return { e, basis: lc(e.o), drift: true };
    return null;
  }

  function refrainFor() {
    const near = new Set([...recent.keys()].slice(-8));
    let best = null;
    for (const r of refrains) { if (usedRefrain.has(r.at)) continue; let hit = 0; for (const w of r.bag) if (near.has(w)) hit += 1; if (hit > 0 && (!best || hit > best.hit)) best = { r, hit }; }
    if (!best) return null;
    usedRefrain.add(best.r.at);
    return best.r.text.replace(/^["“]|["”]$/g, "");
  }

  let n = 0;
  function step() {
    n += 1;
    const pick = nextEdge();
    if (!pick) {
      for (const b of anchor) focus.add(b); // re-centre on the thought
      const row = { n, move: "return", sentence: null, janus: { ok: true, kind: "licensed", detail: "the read has no further bound act for this cast — re-centred on the thought" }, refrain: null };
      rows.push(row); return row;
    }
    const { e, basis, drift } = pick;
    used.add(e);
    if (e.s) focus.add(lc(e.s));
    if (e.o) focus.add(lc(e.o));
    if (focus.size > 8) { for (const b of [...focus]) if (!anchor.has(b) && focus.size > 6) focus.delete(b); }
    recent.set(lc(e.s ?? e.o ?? ""), e.at);
    for (const m of new Set(contentOf([e.verb, e.raw]))) recent.set(m, e.at);

    const refrain = n % refrainEvery === 0 ? refrainFor() : null;
    const row = {
      n, move: drift ? "drift" : "continue",
      sentence: renderEdge(e),
      at: e.at, being: e.s, act: e.verb || e.raw, glossed: !!e.verb, object: e.o,
      janus: { ok: true, kind: "licensed", detail: `continuity: ${basis} is on the thread` },
      refrain,
    };
    rows.push(row); return row;
  }

  function record() {
    const passage = rows.map((r) => r.sentence).filter(Boolean).join(" ");
    const glossed = rows.filter((r) => r.glossed).length;
    return {
      schema: "EOMindWanderHolograph@1", think, register,
      stepCount: rows.length,
      cast: start,
      archon: archon ? { handle: archon.handle, giver: archon.giver, work: archon.work, source: archon.source.path } : null,
      refrains: rows.filter((r) => r.refrain).map((r) => r.refrain),
      gloss: { glossed, unglossed: rows.length - glossed },
      passage,
      basis: `${rows.length} bound act(s) followed from the read; ${glossed} carry an English gloss, ${rows.length - glossed} show the read's own Greek surface (the gloss gap, disclosed); ${archon ? `Penelope laid ${rows.filter((r) => r.refrain).length} refrain(s) from ${archon.handle}` : "no cast for refrains"} — no model called`,
    };
  }

  return { step, record, cast: start, beings: allBeings };
}

