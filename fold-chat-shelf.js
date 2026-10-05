// fold-chat-shelf.js — make it once.
//
// Anything the agent builds that HOLDS (it ran in the sandbox, janus ruled on
// what was measured) goes on the shelf, keyed by what was asked. The next ask
// meets the shelf before it meets a model:
//
//   exact   the same ask (identical once normalized, literals included) → served with no model call and
//           nothing leaving this machine, and is RE-VERIFIED first (the same
//           sandbox and the same janus ruling) — a shelved thing is trusted only
//           as far as it still holds today.
//   near    a similar ask → NEVER served as-is (word overlap cannot tell a rewording from a
//           real difference — measured). The closest shelved artifact is handed to the maker as
//           the thing to CHANGE: a scoped edit, "NO CHANGE" allowed, verified like any build.
//   none    nothing close → built from scratch, then shelved.
//
// The principle is Lovelace's: the engine originates nothing it has already
// proven. The accounting is kept honestly: what a reuse saved is counted from the
// requests the original build actually made, never invented.
//
// Pure: storage is injected, the clock is injected, nothing touches the network.

const STOP = new Set(("a an the with and or of to for that it its in on at by single file html page build make create write me please simple small app application must should show shows display displays have has using use which is are be as from into this these those then also just can will")
  .split(" "));

const stem = (w) => w.length > 4 && /ies$/.test(w) ? w.slice(0, -3) + "y" : w.length > 4 && /ing$/.test(w) ? w.slice(0, -3) : w.length > 3 && /ed$/.test(w) ? w.slice(0, -2) : w.length > 3 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w;

/** What an ask is made of: its salient words, and the literals (numbers) that change what is built. */
export function normalizeTask(task) {
  const t = String(task ?? "").toLowerCase();
  const numbers = [...new Set((t.match(/\d+(?::\d+)*%?/g) || []))].sort();
  const words = (t.replace(/\d+(?::\d+)*%?/g, " ").match(/[a-z][a-z-]{1,}/g) || [])
    .map((w) => stem(w.replace(/^-+|-+$/g, "")))
    .filter((w) => w.length >= 2 && !STOP.has(w));
  const tokens = [...new Set(words)].sort();
  return { tokens, numbers, key: tokens.join(" ") + (numbers.length ? " #" + numbers.join(",") : "") };
}

/** 0..1 — word overlap, with a ceiling below "exact" when the literals differ. */
export function similarity(a, b) {
  const A = new Set(a.tokens), B = new Set(b.tokens);
  if (!A.size && !B.size) return 0;
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  const jacc = inter / (A.size + B.size - inter);
  const sameNumbers = a.numbers.join(",") === b.numbers.join(",");
  return sameNumbers ? jacc : Math.min(jacc, 0.9) * 0.95;
}

/** A short cheap content hash (cyrb53) — an identity for the shelf, not a security claim. */
export function hash53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

const titleOf = (code, task) => (String(code).match(/<title>([^<]{1,80})<\/title>/i)?.[1] || String(task).replace(/\s+/g, " ").slice(0, 60)).trim();

export const EXACT_AT = 1;       // identical word set AND identical literals
export const NEAR_AT = 0.45;     // similar enough to build on

export function createShelf({ storage = null, key = "fold-chat:shelf", max = 80, maxCodeBytes = 200_000, maxTotalBytes = 3_000_000, now = () => new Date().toISOString() } = {}) {
  let entries = [];
  try { const raw = storage?.getItem(key); if (raw) entries = JSON.parse(raw); } catch { entries = []; }
  if (!Array.isArray(entries)) entries = [];
  const persist = () => {
    // Over budget: let the least valuable shelved things go (least used, then oldest) — never the newest.
    let total = entries.reduce((n, e) => n + (e.code?.length || 0), 0);
    while ((entries.length > max || total > maxTotalBytes) && entries.length > 1) {
      const victim = [...entries].sort((a, b) => (a.uses - b.uses) || String(a.lastUsedAt).localeCompare(String(b.lastUsedAt)))[0];
      entries.splice(entries.indexOf(victim), 1); total -= victim.code?.length || 0;
    }
    try { storage?.setItem(key, JSON.stringify(entries)); } catch { /* a full store never blocks a build */ }
  };

  const api = {
    /** Shelve something that HELD. Returns the entry, or null when it must not be shelved. */
    put({ task, code, kind = "html", checks = [], facts = null, origin = null, auditIds = [], savedBasis = null, parentId = null }) {
      if (!task || typeof code !== "string" || !code.trim() || code.length > maxCodeBytes) return null;
      const n = normalizeTask(task);
      const id = hash53(n.key + "\u0000" + code);
      let e = entries.find((x) => x.id === id);
      if (e) { e.lastUsedAt = now(); persist(); return e; }
      // The same ask rebuilt: the newer proven version replaces the older.
      const sameAsk = entries.find((x) => x.key === n.key);
      const prior = sameAsk ? { uses: sameAsk.uses, madeAt: sameAsk.madeAt } : null;
      if (sameAsk) entries.splice(entries.indexOf(sameAsk), 1);
      e = {
        id, task: String(task).trim(), key: n.key, tokens: n.tokens, numbers: n.numbers, title: titleOf(code, task), kind, code,
        madeAt: now(), lastUsedAt: now(), uses: prior?.uses || 0, rebuilt: !!sameAsk, parentId,
        checks: checks.map((c) => ({ name: c.name, ok: c.ok })), facts: facts ? { controls: facts.controls ?? null, labels: (facts.labels || []).slice(0, 20), title: facts.title ?? null } : null,
        origin, auditIds, // what this build cost: the requests it actually made
        savedBasis: savedBasis || { calls: auditIds.length, bytes: 0, ms: origin?.ms ?? 0 },
        savedCalls: 0, savedBytes: 0, savedMs: 0, stale: false,
      };
      entries.push(e); persist();
      return e;
    },
    /** What does the shelf know about this ask? */
    find(task, { limit = 3 } = {}) {
      const n = normalizeTask(task);
      const scored = entries.filter((e) => !e.stale).map((e) => ({ entry: e, score: e.key === n.key ? 1 : similarity(n, { tokens: e.tokens, numbers: e.numbers }) })).sort((a, b) => b.score - a.score);
      const best = scored[0];
      if (best && best.score >= EXACT_AT) return { kind: "exact", entry: best.entry, score: 1, others: scored.slice(1, limit) };
      if (best && best.score >= NEAR_AT) return { kind: "near", entry: best.entry, score: best.score, others: scored.slice(1, limit).filter((s) => s.score >= NEAR_AT) };
      return { kind: "none", entry: null, score: best?.score ?? 0, others: [] };
    },
    /** A reuse happened: count what it actually saved (from the original build's own request record). */
    touch(id, { reuse = "exact" } = {}) {
      const e = entries.find((x) => x.id === id); if (!e) return null;
      e.uses++; e.lastUsedAt = now();
      if (reuse === "exact") { e.savedCalls += e.savedBasis.calls; e.savedBytes += e.savedBasis.bytes; e.savedMs += e.savedBasis.ms; }
      persist(); return e;
    },
    /** A shelved thing that no longer holds is not served again until rebuilt. */
    markStale(id, reason = null) { const e = entries.find((x) => x.id === id); if (e) { e.stale = true; e.staleReason = reason; persist(); } return e || null; },
    get(id) { return entries.find((x) => x.id === id) || null; },
    remove(id) { const i = entries.findIndex((x) => x.id === id); if (i >= 0) { entries.splice(i, 1); persist(); return true; } return false; },
    list() { return entries.slice().sort((a, b) => String(b.lastUsedAt).localeCompare(String(a.lastUsedAt))); },
    clear() { entries = []; persist(); },
    /** The shelf's own books: what is on it and what it has saved. */
    stats() {
      const live = entries.filter((e) => !e.stale);
      return { items: live.length, stale: entries.length - live.length, uses: entries.reduce((n, e) => n + e.uses, 0), savedCalls: entries.reduce((n, e) => n + e.savedCalls, 0), savedBytes: entries.reduce((n, e) => n + e.savedBytes, 0), savedMs: entries.reduce((n, e) => n + e.savedMs, 0), bytes: entries.reduce((n, e) => n + e.code.length, 0) };
    },
    exportJson() { return JSON.stringify({ exportedAt: now(), entries }, null, 2); },
    importJson(text) {
      let j; try { j = JSON.parse(text); } catch { return { added: 0, error: "not JSON" }; }
      const list = Array.isArray(j) ? j : j?.entries; if (!Array.isArray(list)) return { added: 0, error: "no entries" };
      let added = 0;
      for (const e of list) { if (e && typeof e.code === "string" && e.task && !entries.some((x) => x.id === e.id)) { entries.push({ ...e, stale: false }); added++; } }
      persist(); return { added };
    },
  };
  return api;
}

/**
 * The prompt that turns a near match into a SCOPED EDIT: the shelved code is shown once, the model is asked
 * for the smallest change, and "NO CHANGE" is an allowed answer — a similar ask is often already satisfied.
 * Measured (see experiments/scoped-edit): word overlap cannot tell a harmless rewording (0.77) from a real
 * difference (dropping a button scores 0.92, adding an alarm 0.87), so a near match is NEVER served as-is;
 * it is only ever the thing to change, and what comes back is verified like any new build.
 */
export function adaptPrompt({ task, priorTask, code }) {
  return [
    `A working version already exists, built for this earlier ask: ${priorTask}`,
    `The new ask: ${task}`,
    "```\n" + code + "\n```",
    "Change the existing code only as far as the NEW ask requires. Reply with SEARCH/REPLACE edits for the file (the exact existing lines, then the replacement), not the whole file. If the existing code already does everything the new ask says, reply with exactly: NO CHANGE",
  ].join("\n\n");
}

/** Did the maker say the shelved code already does it? */
export const isNoChange = (answer) => /^\s*NO[ _-]?CHANGE\.?\s*$/i.test(String(answer ?? ""));

/** Human-readable "how long ago". */
export function ago(iso, nowIso = new Date().toISOString()) {
  const s = Math.max(0, Math.round((Date.parse(nowIso) - Date.parse(iso)) / 1000));
  if (!Number.isFinite(s)) return "earlier";
  if (s < 90) return s + "s ago"; if (s < 5400) return Math.round(s / 60) + "m ago"; if (s < 129600) return Math.round(s / 3600) + "h ago"; return Math.round(s / 86400) + "d ago";
}
