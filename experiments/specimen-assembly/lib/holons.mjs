// holons.mjs — the ask as a tree of holons, each with a contract. A holon is a whole made of parts and a part of a larger
// whole; what it PROVIDES and REQUIRES is its contract, and its obligations are what a browser can check. A VOID is not
// "the page is wrong": it is a named holon, the obligations it does not meet, what its neighbours around it already
// give (suppliers) and need from it (consumers), and the exact seam in the nearest specimen where it must attach.
// That is the whole of what a model is ever shown (one small ask carrying only its own path — the convention of
// khora/native/organs/talk-build.js).
import { OBLIGATIONS } from "./pagecheck.mjs";

export const ASK = "single-file HTML tip calculator: bill input, 10%/15%/20% tip buttons, people input, live tip and per-person text, never negative";

export const TREE = {
  id: "page", say: "one self-contained page that computes a tip and a per-person share", children: [
    { id: "inputs", say: "where the numbers come in", children: [
      { id: "bill-input", say: "a bill amount field", obligations: ["P-bill"], provides: { bill: "a number, never below 0 once used" }, requires: [] },
      { id: "people-input", say: "a number-of-people field", obligations: ["P-people"], provides: { people: "a whole number, at least 1 once used" }, requires: [] },
    ] },
    { id: "tip-selector", say: "choosing the tip percentage", children: [
      { id: "tip-buttons", say: "three buttons, 10%, 15% and 20%, that set the tip percentage", obligations: ["P-tipbuttons"], provides: { pct: "10, 15 or 20 (15 until one is pressed)" }, requires: [] },
    ] },
    { id: "result", say: "tip and per-person text that follow the inputs live", children: [
      { id: "compute", say: "tip = bill x pct / 100; per person = (bill + tip) / people", obligations: ["P-compute-15", "P-compute-20-split"], provides: { tip: "number", perPerson: "number" }, requires: [{ from: "bill-input", give: "bill" }, { from: "people-input", give: "people" }, { from: "tip-buttons", give: "pct" }] },
      { id: "display", say: "writes the tip and the per-person amount as text, again on every change", obligations: ["P-live"], provides: { text: "'Tip ...' and 'Per person ...'" }, requires: [{ from: "compute", give: "tip, perPerson" }] },
    ] },
    { id: "guard", say: "no negative, NaN or Infinity ever shown", obligations: ["P-nonneg-bill", "P-nonneg-people"], provides: { clamp: "bill >= 0, people >= 1" }, requires: [] },
    { id: "shell", say: "a titled page that fits a phone and is self-contained", obligations: ["P-title", "P-layout", "P-clean"], provides: {}, requires: [] },
  ],
};
export const CONSTRAINTS = ["a single HTML file", "no external scripts, styles or images", "never shows a negative number, NaN or Infinity", "fits 390 px wide without sideways scrolling", "no clocks, randomness, network or storage needed"];

export const leaves = (node = TREE, out = []) => { if (node.children) node.children.forEach((c) => leaves(c, out)); else out.push(node); return out; };
export const find = (id, node = TREE) => { if (node.id === id) return node; for (const c of node.children || []) { const f = find(id, c); if (f) return f; } return null; };
export const pathTo = (id, node = TREE, trail = []) => { const t = [...trail, node.id]; if (node.id === id) return t; for (const c of node.children || []) { const p = pathTo(id, c, t); if (p) return p; } return null; };
export const holonOfObligation = (obl) => leaves().find((l) => (l.obligations || []).includes(obl))?.id;

// status of every node from the oracle's results: held (all pass), void (none pass), partial
export function statusTree(results, node = TREE) {
  if (!node.children) {
    const obs = (node.obligations || []).map((id) => ({ id, pass: !!results[id]?.pass, detail: results[id]?.detail, say: OBLIGATIONS[id].say }));
    const passed = obs.filter((o) => o.pass).length;
    return { id: node.id, say: node.say, provides: node.provides, requires: node.requires, obligations: obs, status: passed === obs.length ? "held" : passed === 0 ? "void" : "partial" };
  }
  const kids = node.children.map((c) => statusTree(results, c));
  const st = kids.every((k) => k.status === "held") ? "held" : kids.every((k) => k.status === "void") ? "void" : "partial";
  return { id: node.id, say: node.say, status: st, children: kids };
}
export const statusLeaves = (t, out = []) => { if (t.children) t.children.forEach((c) => statusLeaves(c, out)); else out.push(t); return out; };

// the void, defined: for every holon that is not held — what is unmet, who supplies it, who consumes it, where it attaches
export function defineVoid(results, { specimen, seams = {}, ids = {} } = {}) {
  const tree = statusTree(results);
  const flat = statusLeaves(tree);
  const byId = Object.fromEntries(flat.map((l) => [l.id, l]));
  const voids = flat.filter((l) => l.status !== "held").map((l) => {
    const suppliers = (l.requires || []).map((r) => ({ holon: r.from, gives: r.give, status: byId[r.from]?.status, element: ids[r.from] ? "#" + ids[r.from] : null }));
    const consumers = flat.filter((o) => (o.requires || []).some((r) => r.from === l.id)).map((o) => ({ holon: o.id, needs: Object.keys(l.provides || {}).join(", "), status: o.status }));
    return {
      holon: l.id, path: ["ask", ...pathTo(l.id)], status: l.status, say: l.say,
      unmet: l.obligations.filter((o) => !o.pass).map((o) => ({ obligation: o.id, scenario: o.say, observed: o.detail })),
      alreadyMet: l.obligations.filter((o) => o.pass).map((o) => o.id),
      contract: { provides: l.provides, requires: l.requires }, suppliers, consumers, seam: seams[l.id] || [],
    };
  });
  return { ask: ASK, specimen, tree, voids, constraints: CONSTRAINTS };
}

// one small ask per void, in dependency order (a holon whose supplier is itself a void waits for it), carrying only its own path
export function asksOf(def) {
  const order = []; const seen = new Set();
  const visit = (v) => { if (seen.has(v.holon)) return; seen.add(v.holon); for (const s of v.suppliers) { const sv = def.voids.find((x) => x.holon === s.holon); if (sv) visit(sv); } order.push(v); };
  def.voids.forEach(visit);
  return order.map((v) => ({
    path: v.path,
    ask: `In the page below, add or change only what is needed for "${v.holon}": ${v.say}.`,
    contract: v.contract,
    holdsAlready: v.suppliers.filter((s) => s.status === "held").map((s) => `${s.holon}${s.element ? " (" + s.element + ")" : ""} gives ${s.gives}`),
    consumersNeed: v.consumers.map((c) => `${c.holon} needs ${c.needs}`),
    mustPass: v.unmet.map((u) => ({ id: u.obligation, scenario: u.scenario, observedNow: u.observed })),
    attachAt: v.seam.map((s) => ({ bytes: [s.start, s.end], text: s.text })),
    constraints: def.constraints,
    returns: "only the replacement text for the attach-at statements and any new HTML fragment; nothing else may change",
  }));
}
