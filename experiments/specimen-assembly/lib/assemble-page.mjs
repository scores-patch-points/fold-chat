// assemble-page.mjs — the page program: evaluate every specimen against the obligations in a real browser; if one
// already satisfies them all (a superset), cut it down by subtraction; if none does, define the void holonically.
import * as acorn from "../vendor/acorn.mjs";
import { tokens } from "../../../../penelope/organs/html-snip.mjs";
import { OBLIGATION_IDS } from "./pagecheck.mjs";
import { collectAtoms, subtract, attribute } from "./pagesub.mjs";
import { defineVoid, asksOf, holonOfObligation, leaves } from "./holons.mjs";
import { sha256 } from "./specimen.mjs";

// statements in the nearest specimen that touch the controls its satisfied neighbours own: where a missing holon must attach
export function seamsOf(html, ids) {
  const wanted = Object.values(ids).filter(Boolean);
  if (!wanted.length) return {};
  const names = new Set();
  for (const t of tokens(html)) {
    if (t.type !== "rawtext" || t.name !== "script") continue;
    let ast; try { ast = acorn.parse(t.raw, { ecmaVersion: 2022, sourceType: "script" }); } catch { continue; }
    const walkNode = (n) => {
      if (!n || typeof n.type !== "string") return;
      if (n.type === "VariableDeclarator" && n.id.type === "Identifier" && n.init && n.init.type === "CallExpression" && n.init.callee.property && n.init.callee.property.name === "getElementById" && n.init.arguments[0] && wanted.includes(n.init.arguments[0].value)) names.add(n.id.name);
      for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walkNode); else if (v && typeof v.type === "string") walkNode(v); }
    };
    walkNode(ast);
  }
  const atoms = collectAtoms(html).filter((a) => a.kind === "js");
  const hasKid = new Set(atoms.map((a) => a.parent).filter((p) => p !== null));
  const mention = (text) => [...names].some((n) => new RegExp(`\\b${n}\\b`).test(text)) || wanted.some((id) => text.includes(`"${id}"`) || text.includes(`'${id}'`) || text.includes(`#${id}`));
  const seam = atoms.filter((a) => !hasKid.has(a.order) && mention(html.slice(a.start, a.end))).slice(0, 8).map((a) => ({ start: a.start, end: a.end, text: html.slice(a.start, a.end).replace(/\s+/g, " ").trim().slice(0, 160) }));
  return { "tip-buttons": seam, compute: seam, display: seam };
}

export async function assemblePage(pool, oracle, ledger, { onState } = {}) {
  const rows = [];
  for (const sp of pool) {
    const res = await oracle.check(sp.html);
    const passed = OBLIGATION_IDS.filter((id) => res[id].pass);
    rows.push({ name: sp.name, path: sp.path, bytes: sp.html.length, sha256: sha256(sp.html), results: res, passed: passed.length, total: OBLIGATION_IDS.length, html: sp.html });
    ledger.add("specimen-evaluated", { name: sp.name, path: sp.path, sha256: rows[rows.length - 1].sha256, bytes: sp.html.length, passed: passed.length, of: OBLIGATION_IDS.length, failed: OBLIGATION_IDS.filter((id) => !res[id].pass) });
  }
  const full = rows.filter((r) => r.passed === r.total).sort((a, b) => a.bytes - b.bytes);
  if (full.length) {
    const chosen = full[0];
    ledger.add("chosen", { name: chosen.name, why: `satisfies all ${chosen.total} obligations; the smallest of ${full.length} that do; cut by subtraction, nothing written` });
    const sub = await subtract(chosen.html, oracle, { ledger, onState });
    const final = await oracle.check(sub.html);
    const attribution = await attribute(sub.html, oracle);
    const byHolon = {};
    for (const a of attribution) for (const b of a.breaks) { const h = holonOfObligation(b) || "(syntax)"; (byHolon[h] ||= []).push({ kind: a.kind, label: a.label, start: a.start, end: a.end, leaf: !attribution.some((x) => x.parent === a.order), obligations: a.breaks }); }
    ledger.add("assembled", { from: chosen.name, bytesIn: chosen.bytes, bytesOut: sub.html.length, generatedBytes: 0, finalObligations: Object.fromEntries(Object.entries(final).map(([k, v]) => [k, v.pass])) });
    return { status: "assembled", rows, chosen: { name: chosen.name, path: chosen.path, bytes: chosen.bytes }, sub, final, attribution, byHolon };
  }
  const nearest = [...rows].sort((a, b) => b.passed - a.passed || a.bytes - b.bytes)[0];
  const ids = await oracle.ids(nearest.html);
  const seams = seamsOf(nearest.html, ids);
  const def = defineVoid(nearest.results, { specimen: nearest.name, seams, ids });
  const asks = asksOf(def);
  ledger.add("void", { nearest: nearest.name, voids: def.voids.map((v) => ({ holon: v.holon, status: v.status, unmet: v.unmet.map((u) => u.obligation) })), asks: asks.length });
  return { status: "void", rows, nearest: { name: nearest.name, path: nearest.path, passed: nearest.passed, bytes: nearest.bytes }, def, asks };
}
export const specimenFile = (fs, dir, f) => ({ name: f.replace(/\.html$/, ""), path: `pages/${f}`, html: fs.readFileSync(`${dir}/${f}`, "utf8") });
