// cache.mjs — program 2: a bounded result cache, checked by seeded property tests with greedy shrinking.
// Used for the gap -> proposal -> verification -> reuse path (criterion M7).
import { instantiate, sha256 } from "./specimen.mjs";

export const SLOTS = { cache: { entry: "makeCache", arity: 1, roles: ["limit"] } };

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function genOps(rand, n, keys) {
  const ops = [];
  for (let i = 0; i < n; i++) ops.push(rand() < 0.55 ? { op: "set", k: `k${Math.floor(rand() * keys)}`, v: Math.floor(rand() * 1000) } : { op: "get", k: `k${Math.floor(rand() * keys)}` });
  return ops;
}

// returns null or a violation string for an op sequence
const PROPS = {
  "C-bounded": (cache, ops, limit) => { for (const o of ops) { if (o.op === "set") cache.set(o.k, o.v); else cache.get(o.k); if (cache.size() > limit) return `size ${cache.size()} exceeds limit ${limit}`; } return null; },
  "C-never-stale": (cache, ops) => { const last = new Map(); for (const o of ops) { if (o.op === "set") { cache.set(o.k, o.v); last.set(o.k, o.v); } else { const v = cache.get(o.k); if (v !== undefined && v !== last.get(o.k)) return `get(${o.k}) returned ${v}, last set was ${last.get(o.k)}`; } } return null; },
  "C-latest-kept": (cache, ops) => { for (const o of ops) { if (o.op === "set") { cache.set(o.k, o.v); const v = cache.get(o.k); if (v !== o.v) return `get(${o.k}) right after set(${o.k}, ${o.v}) returned ${v}`; } else cache.get(o.k); } return null; },
  "C-remembers-under-limit": (cache, ops, limit) => { const seen = new Map(); for (const o of ops) { if (o.op === "set") { cache.set(o.k, o.v); seen.set(o.k, o.v); } else { const v = cache.get(o.k); if (seen.size <= limit && seen.has(o.k) && v !== seen.get(o.k)) return `forgot ${o.k} while only ${seen.size} distinct keys (limit ${limit})`; } } return null; },
};
export const OBLIGATIONS = Object.keys(PROPS);

function fmt(ops) { return ops.map((o) => (o.op === "set" ? `set(${o.k},${o.v})` : `get(${o.k})`)).join(" "); }

function shrink(prop, make, ops, limit) {
  let cur = ops;
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < cur.length; i++) {
      const cand = cur.slice(0, i).concat(cur.slice(i + 1));
      let v; try { v = prop(make(limit), cand, limit); } catch { v = "threw"; }
      if (v) { cur = cand; changed = true; break; }
    }
  }
  return cur;
}

export const DEFAULT_BOUND = { limit: 3, sequences: 200, length: 30, keys: 6, seed: 7 };

export const cache = {
  name: "cache", slots: SLOTS, obligations: OBLIGATIONS, defaultBound: DEFAULT_BOUND,
  prohibitedProps: [], forbiddenEffects: ["clock", "random", "net", "host", "timer", "io"],
  assayHash(bound) { return sha256(JSON.stringify(PROPS, (k, v) => (typeof v === "function" ? v.toString() : v)) + JSON.stringify(bound)).slice(0, 12); },
  async evaluate(combo, env, id, bound = DEFAULT_BOUND) {
    const mod = instantiate(combo.cache);
    const make = (limit) => mod.makeCache(limit);
    const rand = mulberry32(bound.seed);
    for (let s = 0; s < bound.sequences; s++) {
      const ops = genOps(rand, bound.length, bound.keys);
      let v;
      try { v = PROPS[id](make(bound.limit), ops, bound.limit); } catch (e) { v = `threw: ${e.message}`; }
      if (v) {
        const small = shrink(PROPS[id], make, ops, bound.limit);
        let v2; try { v2 = PROPS[id](make(bound.limit), small, bound.limit); } catch (e) { v2 = `threw: ${e.message}`; }
        return { id, pass: false, bound, runs: s + 1, exhausted: false, capsUsed: [],
          counterexample: { violation: v2 || v, ops: small, trace: [fmt(small)], steps: small.length, scenario: id, fault: null, choices: [], seed: bound.seed, sequence: s } };
      }
    }
    return { id, pass: true, bound, runs: bound.sequences, exhausted: false, capsUsed: [], counterexample: null };
  },
  // a sequence the property rejects must reject again when replayed
  async replay(combo, cx, bound = DEFAULT_BOUND) {
    const mod = instantiate(combo.cache);
    let v; try { v = PROPS[cx.scenario](mod.makeCache(bound.limit), cx.ops, bound.limit); } catch (e) { v = `threw: ${e.message}`; }
    return { violation: v, same: v === cx.violation };
  },
};
