// specimen.mjs — turn source bytes into a specimen: the bytes, where they came from, and what can be read off
// them without running or believing anything. Comments are ignored (they are claims); only the AST is read.
import crypto from "node:crypto";
import vm from "node:vm";
import * as acorn from "../vendor/acorn.mjs";

export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

export function parse(src) { return acorn.parse(src, { ecmaVersion: 2022, sourceType: "module" }); }

export function walk(node, visit, parent = null) {
  visit(node, parent);
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === "string") walk(c, visit, node); }
    else if (v && typeof v.type === "string") walk(v, visit, node);
  }
}

const EFFECT_GLOBALS = {
  Date: "clock", performance: "clock",
  fetch: "net", XMLHttpRequest: "net", WebSocket: "net",
  process: "host", require: "host", globalThis: "host", window: "host", document: "host", eval: "host", Function: "host",
  setTimeout: "timer", setInterval: "timer", setImmediate: "timer", queueMicrotask: "timer",
  console: "io", crypto: "random",
};
const SAFE_GLOBALS = new Set(["JSON", "Object", "Array", "Map", "Set", "Promise", "Error", "String", "Number", "Boolean", "Math",
  "parseInt", "parseFloat", "isNaN", "undefined", "NaN", "Infinity", "Symbol"]);

// member chain `a.b.c` rooted at an identifier -> {root, path:["b","c"]}; null if computed or not rooted at an identifier
function chain(node) {
  const path = [];
  let n = node;
  while (n && n.type === "MemberExpression") {
    if (n.computed) return { dynamic: true };
    path.unshift(n.property.name);
    n = n.object;
  }
  if (n && n.type === "Identifier") return { root: n.name, path };
  return null;
}

// the names a declaration binds (parameters, vars, function names) anywhere in the file: used to tell a local from a global
function declaredNames(ast) {
  const names = new Set();
  const addPattern = (p) => {
    if (!p) return;
    if (p.type === "Identifier") names.add(p.name);
    else if (p.type === "ObjectPattern") p.properties.forEach((q) => addPattern(q.value || q.argument));
    else if (p.type === "ArrayPattern") p.elements.forEach(addPattern);
    else if (p.type === "AssignmentPattern") addPattern(p.left);
    else if (p.type === "RestElement") addPattern(p.argument);
  };
  walk(ast, (n) => {
    if (n.type === "FunctionDeclaration" || n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression") {
      if (n.id) names.add(n.id.name);
      n.params.forEach(addPattern);
    }
    if (n.type === "VariableDeclarator") addPattern(n.id);
    if (n.type === "CatchClause") addPattern(n.param);
  });
  return names;
}

function analyseFunction(fn, declared) {
  const params = fn.params.map((p) => (p.type === "Identifier" ? p.name : null));
  const unresolved = [];
  const aliases = new Map(); // local name -> {param, path}
  const rootOf = (name) => {
    const i = params.indexOf(name);
    if (i >= 0) return { param: i, path: [] };
    return aliases.get(name) || null;
  };
  fn.params.forEach((p) => { if (p.type !== "Identifier") unresolved.push({ reason: "non-identifier parameter pattern", at: [p.start, p.end] }); });
  // one alias level: `const p = param.a.b`
  walk(fn.body, (n) => {
    if (n.type === "VariableDeclarator" && n.init) {
      if (n.id.type === "ObjectPattern") {
        const c = chain(n.init);
        if (c && !c.dynamic && rootOf(c.root)) unresolved.push({ reason: "destructured parameter", at: [n.start, n.end] });
        return;
      }
      const c = chain(n.init);
      if (n.id.type === "Identifier" && c && !c.dynamic) {
        const r = rootOf(c.root);
        if (r) aliases.set(n.id.name, { param: r.param, path: [...r.path, ...c.path] });
      }
    }
  });
  const needs = new Set();
  const propsRead = new Set();
  const usedParams = new Set();
  walk(fn.body, (n, parent) => {
    if (n.type === "Identifier") {
      const i = params.indexOf(n.name);
      if (i >= 0 && !(parent && parent.type === "MemberExpression" && parent.property === n && !parent.computed)) usedParams.add(i);
    }
    if (n.type === "MemberExpression" && !n.computed) propsRead.add(n.property.name);
    if (n.type === "Property" && !n.computed && n.key.type === "Identifier") propsRead.add(n.key.name);
    if (n.type === "CallExpression") {
      const callee = n.callee;
      if (callee.type === "MemberExpression") {
        const c = chain(callee);
        if (c && c.dynamic) { unresolved.push({ reason: "computed member call", at: [n.start, n.end] }); return; }
        if (c) {
          const r = rootOf(c.root);
          if (r) needs.add(`${r.param}:${[...r.path, ...c.path].join(".")}`);
        } else if (callee.object.type === "CallExpression") {
          // `x.f().g()` — the receiver is a value we cannot name; skip unless it is clearly local
        }
      } else if (callee.type === "Identifier") {
        // calling a parameter (a thunk the skeleton hands over) or a local or a safe global: resolved
      } else if (callee.type === "CallExpression") {
        unresolved.push({ reason: "call of a call result", at: [n.start, n.end] });
      }
    }
  });
  const unusedParams = params.map((p, i) => (usedParams.has(i) ? null : i)).filter((x) => x !== null);
  return { params, needs: [...needs].sort(), unresolved, propsRead: [...propsRead].sort(), unusedParams, async: fn.async };
}

export function collect({ source, origin, path = null, note = null, parents = [], transforms = [], assurance = "none" }) {
  const spec = {
    id: sha256(source).slice(0, 16), sha256: sha256(source), bytes: Buffer.byteLength(source), source,
    provenance: { origin, path, note, parents, transforms }, assurance,
    parse: { ok: true }, imports: [], exports: [], effects: { observed: [], unresolved: [] }, props: [],
  };
  let ast;
  try { ast = parse(source); } catch (e) { spec.parse = { ok: false, error: String(e.message) }; return spec; }
  const declared = declaredNames(ast);
  const props = new Set();
  for (const node of ast.body) {
    if (node.type === "ImportDeclaration") spec.imports.push(node.source.value);
    if (node.type === "ExportNamedDeclaration" && node.declaration && node.declaration.type === "FunctionDeclaration") {
      const fn = node.declaration;
      const a = analyseFunction(fn, declared);
      spec.exports.push({ name: fn.id.name, ...a, range: [node.start, node.end], declStart: fn.start });
      a.propsRead.forEach((p) => props.add(p));
      spec.effects.unresolved.push(...a.unresolved.map((u) => ({ ...u, in: fn.id.name })));
    }
  }
  spec.props = [...props].sort();
  // observed effects: references to effectful globals (that the file does not itself declare), and Math.random
  walk(ast, (n, parent) => {
    if (n.type === "Identifier") {
      const isKey = parent && ((parent.type === "MemberExpression" && parent.property === n && !parent.computed) || (parent.type === "Property" && parent.key === n && !parent.computed));
      if (!isKey && !declared.has(n.name) && EFFECT_GLOBALS[n.name]) spec.effects.observed.push({ kind: EFFECT_GLOBALS[n.name], text: n.name, at: [n.start, n.end] });
    }
    if (n.type === "MemberExpression" && !n.computed && n.object.type === "Identifier" && n.object.name === "Math" && n.property.name === "random" && !declared.has("Math"))
      spec.effects.observed.push({ kind: "random", text: "Math.random", at: [n.start, n.end] });
    if (n.type === "ImportExpression") spec.effects.unresolved.push({ reason: "dynamic import", at: [n.start, n.end] });
  });
  // a bare call to an identifier that is neither declared, a parameter, nor a safe global is unresolved
  walk(ast, (n) => {
    if (n.type === "CallExpression" && n.callee.type === "Identifier") {
      const nm = n.callee.name;
      if (!declared.has(nm) && !SAFE_GLOBALS.has(nm) && !EFFECT_GLOBALS[nm]) spec.effects.unresolved.push({ reason: `call of unbound identifier ${nm}`, at: [n.start, n.end] });
    }
  });
  return spec;
}

export function exportOf(spec, name) { return spec.exports.find((e) => e.name === name) || null; }

// run the specimen's exported functions in a fresh vm context with a deliberately thin global set (no Date, no
// Math.random, no fetch, no process). This is a determinism fence, not a security boundary.
export function instantiate(spec) {
  if (!spec.parse.ok) throw new Error("cannot instantiate a specimen that does not parse");
  let out = "", at = 0;
  for (const e of [...spec.exports].sort((a, b) => a.range[0] - b.range[0])) { out += spec.source.slice(at, e.range[0]) + spec.source.slice(e.declStart, e.range[1]); at = e.range[1]; }
  out += spec.source.slice(at);
  const names = spec.exports.map((e) => e.name);
  const math = Object.freeze(Object.fromEntries(Object.getOwnPropertyNames(Math).filter((k) => k !== "random").map((k) => [k, Math[k]])));
  const sandbox = { JSON, Object, Array, Map, Set, Promise, Error, String, Number, Boolean, Math: math, parseInt, parseFloat, isNaN, Symbol, Date: undefined };
  const code = `(function(){\n${out}\nreturn {${names.join(",")}};\n})()`;
  return vm.runInNewContext(code, sandbox, { timeout: 1000, filename: `specimen:${spec.id}` });
}
