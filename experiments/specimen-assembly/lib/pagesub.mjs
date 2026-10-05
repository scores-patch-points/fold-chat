// pagesub.mjs — edit by SUBTRACTION. A page that already satisfies the ask (a superset) is cut down by deleting byte
// ranges; nothing is ever written, so every byte of the result is a byte of the specimen. The cutting uses the repo's
// own hands: penelope/organs/html-snip.mjs (byte-addressed balanced HTML spans) and khora's part-source.js `cssBlocks`
// (byte-ranged CSS rules); JavaScript statements come from acorn. The oracle is a real browser (pagecheck.mjs).
//
// Rounds: try to delete each atom, largest first (a holon before its parts); keep the deletion if every obligation still
// holds. Repeat until a round deletes nothing (an element the script still reads only becomes deletable after the
// statement that reads it is gone). Then one validated rewrite: a CSS rule whose selectors match nothing in the
// resulting DOM is deleted. Finally each surviving atom is deleted alone to see which obligations it holds up — those
// marks, not names, say which holon an atom belongs to.
import * as acorn from "../vendor/acorn.mjs";
import { tokens, span } from "../../../../penelope/organs/html-snip.mjs";
import { cssBlocks } from "../../../../khora/native/organs/part-source.js";
import { sha256 } from "./specimen.mjs";

const STRUCT = new Set(["html", "head", "body", "title", "meta", "link", "style", "script"]);
const one = (s) => s.replace(/\s+/g, " ").trim();

export function collectAtoms(source) {
  const toks = tokens(source);
  const atoms = [];
  const add = (a) => atoms.push({ id: atoms.length, ...a });
  toks.forEach((t, k) => {
    if (t.type === "tag" && !t.closing && !STRUCT.has(t.name)) {
      const s = span(toks, k);
      if (s.ok) {
        const id = /\bid=["']([^"']+)["']/.exec(t.attrs);
        add({ kind: "html", start: s.start, end: s.end, label: `<${t.name}${id ? "#" + id[1] : ""}>` });
      }
    }
    if (t.type === "rawtext" && t.name === "script") {
      let ast;
      try { ast = acorn.parse(t.raw, { ecmaVersion: 2022, sourceType: "script" }); } catch { return; }
      const lists = [];
      const visit = (n) => {
        if (!n || typeof n.type !== "string") return;
        if (n.type === "Program" || n.type === "BlockStatement") lists.push(n.body);
        for (const key of Object.keys(n)) { const v = n[key]; if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v.type === "string") visit(v); }
      };
      visit(ast);
      for (const list of lists) for (const st of list) add({ kind: "js", start: t.start + st.start, end: t.start + st.end, label: one(t.raw.slice(st.start, st.end)).slice(0, 72) });
    }
    if (t.type === "rawtext" && t.name === "style") {
      for (const b of cssBlocks(t.raw)) add({ kind: "css", start: t.start + b.start, end: t.start + b.end, label: b.head.slice(0, 60), head: b.head });
    }
  });
  atoms.sort((a, b) => a.start - b.start || b.end - a.end || a.id - b.id);
  const stack = [];
  atoms.forEach((a, i) => { a.order = i; });
  for (const a of atoms) {
    while (stack.length && !(stack[stack.length - 1].start <= a.start && a.end <= stack[stack.length - 1].end)) stack.pop();
    a.parent = stack.length ? stack[stack.length - 1].order : null;
    stack.push(a);
  }
  return atoms;
}

// the byte ranges a deletion really takes: an atom that has its lines to itself takes the whole lines
function expand(source, a) {
  let s = a.start, e = a.end;
  let ls = s; while (ls > 0 && (source[ls - 1] === " " || source[ls - 1] === "\t")) ls--;
  let le = e; while (le < source.length && (source[le] === " " || source[le] === "\t")) le++;
  if ((ls === 0 || source[ls - 1] === "\n") && (le >= source.length || source[le] === "\n")) { s = ls; e = le < source.length ? le + 1 : le; }
  return [s, e];
}
export function cut(source, atoms, removedIds) {
  const set = new Set(removedIds);
  const live = atoms.filter((a) => set.has(a.id) && !(a.parent !== null && ancestorRemoved(atoms, a, set)));
  const ranges = live.map((a) => expand(source, a)).sort((x, y) => x[0] - y[0]);
  const merged = [];
  for (const r of ranges) { const l = merged[merged.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else merged.push([...r]); }
  let out = "", at = 0;
  for (const [s, e] of merged) { out += source.slice(at, s); at = e; }
  return { html: out + source.slice(at), ranges: merged };
}
const ancestorRemoved = (atoms, a, set) => { for (let p = a.parent; p !== null; p = atoms[p].parent) if (set.has(atoms[p].id)) return true; return false; };

function scriptsParse(html) {
  for (const t of tokens(html)) if (t.type === "rawtext" && t.name === "script") { try { acorn.parse(t.raw, { ecmaVersion: 2022, sourceType: "script" }); } catch (e) { return String(e.message); } }
  return null;
}

export async function subtract(source, oracle, { ledger, onState = () => {}, maxRounds = 5 } = {}) {
  const atoms = collectAtoms(source);
  const stats = { atoms: atoms.length, oracleCalls: 0, parseRejected: 0, rounds: 0 };
  const allHold = async (html, failFast = true) => { stats.oracleCalls++; const r = await oracle.check(html, { failFast }); return { pass: Object.values(r).every((v) => v.pass), r }; };
  const base = await allHold(source, false);
  if (!base.pass) throw new Error("the specimen does not satisfy the obligations to begin with: " + JSON.stringify(Object.entries(base.r).filter(([, v]) => !v.pass).map(([k]) => k)));
  const removed = new Set();
  const tried = new Set();
  const states = [{ step: 0, html: source, bytes: source.length, note: "the superset, as found" }];
  for (let round = 1; round <= maxRounds; round++) {
    stats.rounds = round;
    let changed = false;
    for (const a of atoms) {
      if (a.kind === "css" || removed.has(a.id) || ancestorRemoved(atoms, a, removed)) continue;
      const key = [...removed].sort((x, y) => x - y).join(",") + "|" + a.id;
      if (tried.has(key)) continue;
      tried.add(key);
      const cand = new Set(removed); cand.add(a.id);
      const { html } = cut(source, atoms, cand);
      const bad = scriptsParse(html);
      if (bad) { stats.parseRejected++; ledger.add("kept", { round, atom: a.id, atomKind: a.kind, label: a.label, why: "the script would no longer parse: " + bad }); continue; }
      const res = await allHold(html);
      if (res.pass) {
        removed.add(a.id); changed = true;
        ledger.add("cut", { round, atom: a.id, atomKind: a.kind, label: a.label, bytes: a.end - a.start, htmlBytes: html.length });
        states.push({ step: states.length, html, bytes: html.length, note: `cut ${a.kind} ${a.label}` });
        onState(states[states.length - 1]);
      } else {
        const failed = Object.entries(res.r).filter(([, v]) => !v.pass).map(([k, v]) => `${k}: ${v.detail}`);
        ledger.add("kept", { round, atom: a.id, atomKind: a.kind, label: a.label, why: failed[0] || "an obligation failed" });
      }
    }
    if (!changed) break;
  }
  // validated rewrite: delete CSS rules whose selectors match nothing in the page as it now stands
  let html = cut(source, atoms, removed).html;
  const cssAtoms = atoms.filter((a) => a.kind === "css" && !ancestorRemoved(atoms, a, removed));
  const lists = cssAtoms.map((a) => (a.head.startsWith("@") ? ["*"] : a.head.split(",").map((s) => s.trim().replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, "").trim() || "*")));
  const dead = await oracle.unmatched(html, lists);
  const deadIds = cssAtoms.filter((_, i) => dead[i] && !/^(:root|html|body|\*)$/.test(cssAtoms[i].head.trim())).map((a) => a.id);
  if (deadIds.length) {
    const cand = new Set([...removed, ...deadIds]);
    const h2 = cut(source, atoms, cand).html;
    if (!scriptsParse(h2) && (await allHold(h2)).pass) {
      deadIds.forEach((id) => { removed.add(id); const a = atoms[id]; ledger.add("cut", { round: "css", atom: a.id, atomKind: "css", label: a.label, rule: "prune-dead-css", precondition: "no element in the page matches this selector" }); });
      html = h2; states.push({ step: states.length, html, bytes: html.length, note: `pruned ${deadIds.length} CSS rule(s) matching nothing` });
    }
  }
  const final = cut(source, atoms, removed);
  const receipt = {
    rule: "subtract", in: { sha256: sha256(source), bytes: source.length }, out: { sha256: sha256(final.html), bytes: final.html.length },
    edits: final.ranges.map(([s, e]) => ({ start: s, end: e, to: "", from: source.slice(s, e) })), generatedBytes: 0, copiedBytes: final.html.length,
    preserves: "every obligation, re-checked in a real browser after each cut", introduces: "nothing: bytes were only deleted",
  };
  return { atoms, removed, html: final.html, states, receipt, stats };
}

// which obligations does each surviving atom hold up? (delete it alone; read what breaks)
export async function attribute(html, oracle) {
  const atoms = collectAtoms(html).filter((a) => a.kind !== "css");
  const out = [];
  for (const a of atoms) {
    const { html: h } = cut(html, atoms, [a.id]);
    if (a.parent !== null && atoms[a.parent]) { /* nested: still tested alone, its parent stays */ }
    const bad = scriptsParse(h);
    if (bad) { out.push({ id: a.id, kind: a.kind, label: a.label, start: a.start, end: a.end, parent: a.parent, breaks: ["(syntax)"], parse: bad }); continue; }
    const r = await oracle.check(h);
    out.push({ id: a.id, kind: a.kind, label: a.label, start: a.start, end: a.end, parent: a.parent, breaks: Object.entries(r).filter(([, v]) => !v.pass).map(([k]) => k) });
  }
  return out;
}
