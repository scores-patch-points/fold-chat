// transform.mjs — a deliberately small transformation language. Every rule has preconditions, a byte-range edit
// list, what it preserves, what it introduces, and a receipt that lets anyone re-derive the output bytes from the
// input bytes. A change outside these rules is not "adapted": it is a new, unverified candidate.
import { parse, walk, collect, sha256, exportOf } from "./specimen.mjs";

export function applyEdits(source, edits) {
  let out = source;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.to + out.slice(e.end);
  return out;
}

// re-derive: the receipt is honest iff its edits turn the input into exactly the output
export function verifyReceipt(inputSource, receipt, outputSource) {
  return sha256(inputSource) === receipt.in.sha256 && sha256(applyEdits(inputSource, receipt.edits)) === receipt.out.sha256 && sha256(outputSource) === receipt.out.sha256;
}

function finish(spec, rule, args, preconditions, edits, preserves, introduces) {
  const source = applyEdits(spec.source, edits);
  const receipt = {
    rule, args, preconditions, edits: edits.map((e) => ({ ...e, from: spec.source.slice(e.start, e.end) })),
    in: { id: spec.id, sha256: spec.sha256 }, out: { sha256: sha256(source) }, preserves, introduces, trusted: true,
  };
  const out = collect({ source, origin: spec.provenance.origin, path: spec.provenance.path, note: `adapted by ${rule}`,
    parents: [...spec.provenance.parents, spec.id], transforms: [...spec.provenance.transforms, receipt], assurance: "none" });
  receipt.out.id = out.id;
  return { ok: true, specimen: out, receipt };
}

// the trusted equivalence table: method pairs whose substitution preserves the stated property
export const ADAPTERS = [
  {
    id: "setnx->cas", from: "setnx", to: "cas", requires: ["cas"], preserves: ["atomic claim: both succeed only when the key was absent"],
    introduces: ["call arity changes: setnx(k, v) becomes cas(k, undefined, v)"],
    edit(call, member) { return [{ start: member.property.start, end: member.property.end, to: "cas" }, { start: call.arguments[0].end, end: call.arguments[0].end, to: ", undefined" }]; },
    applies: (call) => call.arguments.length === 2,
  },
];

// substitute-call: rewrite `<param-rooted>.from(...)` to the adapted form for one export.
export function substituteCall(spec, { entry, adapterId, paramIndex }, env) {
  const adapter = ADAPTERS.find((a) => a.id === adapterId);
  const pre = [];
  const check = (name, ok, detail) => { pre.push({ check: name, ok: !!ok, detail }); return ok; };
  if (!check("adapter known", adapter, adapterId)) return { ok: false, reason: `unknown adapter ${adapterId}`, preconditions: pre };
  if (!check("specimen parses", spec.parse.ok)) return { ok: false, reason: "does not parse", preconditions: pre };
  const ex = exportOf(spec, entry);
  if (!check("entry exported", ex, entry)) return { ok: false, reason: `no export ${entry}`, preconditions: pre };
  const role = env.roleOf(entry, paramIndex);
  const missing = adapter.requires.filter((m) => !env.caps.has(`${role}.${m}`));
  if (!check("environment offers replacement", missing.length === 0, missing.join(","))) return { ok: false, reason: `environment lacks ${missing.map((m) => `${role}.${m}`).join(",")}`, preconditions: pre };
  const ast = parse(spec.source);
  const fnNode = ast.body.find((n) => n.type === "ExportNamedDeclaration" && n.declaration && n.declaration.id && n.declaration.id.name === entry).declaration;
  const pname = ex.params[paramIndex];
  const edits = [];
  walk(fnNode.body, (n) => {
    if (n.type === "CallExpression" && n.callee.type === "MemberExpression" && !n.callee.computed && n.callee.property.name === adapter.from) {
      let root = n.callee.object;
      while (root.type === "MemberExpression") root = root.object;
      if (root.type === "Identifier" && root.name === pname && adapter.applies(n)) edits.push(...adapter.edit(n, n.callee));
    }
  });
  if (!check("at least one call site", edits.length > 0)) return { ok: false, reason: "no call site to rewrite", preconditions: pre };
  return finish(spec, "substitute-call", { entry, adapterId, paramIndex }, pre, edits, adapter.preserves, adapter.introduces);
}

// rename-param: precondition is conservative — the new name must not appear anywhere in the file.
export function renameParam(spec, { entry, from, to }) {
  const pre = [];
  const check = (name, ok, detail) => { pre.push({ check: name, ok: !!ok, detail }); return ok; };
  const ex = exportOf(spec, entry);
  if (!check("entry exported", ex)) return { ok: false, reason: "no such export", preconditions: pre };
  if (!check("parameter exists", ex.params.includes(from))) return { ok: false, reason: "no such parameter", preconditions: pre };
  const ast = parse(spec.source);
  let clash = false;
  walk(ast, (n) => { if (n.type === "Identifier" && n.name === to) clash = true; });
  if (!check("new name unused in file", !clash, to)) return { ok: false, reason: "name already present", preconditions: pre };
  const fnNode = ast.body.find((n) => n.type === "ExportNamedDeclaration" && n.declaration && n.declaration.id && n.declaration.id.name === entry).declaration;
  const edits = [];
  const paramNodes = new Set(fnNode.params);
  walk(fnNode, (n, parent) => {
    if (n.type !== "Identifier" || n.name !== from) return;
    if (parent && parent.type === "MemberExpression" && parent.property === n && !parent.computed) return;
    if (parent && parent.type === "Property" && parent.key === n && !parent.computed && !parent.shorthand) return;
    if (parent && parent.type === "Property" && parent.shorthand) return; // shorthand would change the key: refuse below
    edits.push({ start: n.start, end: n.end, to });
  });
  let shorthand = false;
  walk(fnNode, (n, parent) => { if (n.type === "Identifier" && n.name === from && parent && parent.type === "Property" && parent.shorthand) shorthand = true; });
  if (!check("no shorthand property uses it", !shorthand)) return { ok: false, reason: "shorthand property would change a key", preconditions: pre };
  return finish(spec, "rename-param", { entry, from, to }, pre, edits, ["behaviour: a bound-name change only"], []);
}
