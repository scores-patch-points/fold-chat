// fold-chat-scope.js — what a model needs to see to make ONE edit, computed without a model.
//
// Sending a whole codebase to an outside model to change one function is slow,
// expensive, and the opposite of sealed. The claim this module exists to test is
// that it is never necessary: a scoped request — the files an edit touches, the
// files that must stay consistent with it, and an outline of everything else —
// is enough. The scope is computed MECHANICALLY (names, imports, usages, failing
// traces), so the Fold decides what leaves the machine, not the model asking for it.
//
// What goes in the scope, and why each file is there (the reason is returned, so a
// person can read why the model was shown a file and not another):
//   named    defines a symbol the ask names
//   caller   uses a symbol the ask names (a signature change must reach its callers)
//   callee   defines something a scoped file uses (the edit must call it correctly)
//   literal  contains a literal the ask names (a threshold changed "everywhere")
//   path     the ask names the file, or its stem matches an ask word
//   trace    appears in a failing test's stack
//   sibling  lives beside a NEW file the ask asks for (the pattern to follow)
//   term     shares salient words with the ask (a weak signal, used last)
//
// Everything outside the scope is shown as an OUTLINE (path + the names it
// defines), never as code. The honest limit is stated in the result: a
// convention that lives in a file with no term, name, import or trace linking it
// to the ask is invisible to every mechanical scoper — see the experiment.
//
// Pure: takes { path: content }, returns data.

const SRC_EXT = /\.(?:[mc]?[jt]sx?|py|go|rs|rb|java|php|css|html?|json|md)$/i;
const CODE_EXT = /\.(?:[mc]?[jt]sx?|py|go|rs|rb|java|php)$/i;

const STOP = new Set("a an the and or of to for that it its in on at by with from into this these those then also just can will make add change update new file files function functions code every all should must when where which what how use using used get set return returns value values name names one two three item items".split(" "));

const splitIdent = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_\-.]/g, " ").toLowerCase().split(/\s+/).filter(Boolean);
const words = (s) => (String(s).toLowerCase().match(/[a-z][a-z0-9]{2,}/g) || []).filter((w) => !STOP.has(w));

/** What a file defines, imports and mentions. Regex-level, language-light — a scoper, not a parser. */
export function indexFile(path, text) {
  const defs = new Set(), imports = new Set(), uses = new Set();
  const t = String(text);
  for (const m of t.matchAll(/\b(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g)) defs.add(m[1]);
  for (const m of t.matchAll(/\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) defs.add(m[1]);
  for (const m of t.matchAll(/\b(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/g)) defs.add(m[1]);
  for (const m of t.matchAll(/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/gm)) defs.add(m[1]);
  for (const m of t.matchAll(/^\s*class\s+([A-Za-z_]\w*)/gm)) defs.add(m[1]);
  for (const m of t.matchAll(/\bfrom\s+["']([^"']+)["']|\brequire\(\s*["']([^"']+)["']\s*\)|\bimport\s+["']([^"']+)["']/g)) imports.add(m[1] || m[2] || m[3]);
  for (const m of t.matchAll(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm)) imports.add(m[1] || m[2]);
  for (const m of t.matchAll(/[A-Za-z_$][\w$]*/g)) uses.add(m[0]);
  return { path, defs, imports, uses, chars: t.length };
}

/** Resolve a relative import specifier to a file in the set. */
function resolveImport(from, spec, paths) {
  if (!spec || !/^\.{1,2}\//.test(spec)) return null;
  const base = from.includes("/") ? from.slice(0, from.lastIndexOf("/") + 1) : "";
  const parts = (base + spec).split("/"); const out = [];
  for (const p of parts) { if (p === "." || p === "") continue; if (p === "..") out.pop(); else out.push(p); }
  const stem = out.join("/");
  return [stem, stem + ".js", stem + ".mjs", stem + ".ts", stem + ".jsx", stem + ".tsx", stem + "/index.js", stem + "/index.ts"].find((c) => paths.has(c)) || null;
}

/** What an ask names: identifiers, file paths, literals, plain salient words. */
export function termsOf(task) {
  const t = String(task ?? "");
  const files = new Set((t.match(/[\w./-]+\.[A-Za-z0-9]{1,6}\b/g) || []).filter((f) => SRC_EXT.test(f)));
  const idents = new Set();
  for (const m of t.matchAll(/`([^`]{2,60})`/g)) for (const w of m[1].match(/[A-Za-z_$][\w$]{1,}/g) || []) idents.add(w);
  for (const m of t.matchAll(/\b([a-z]+[A-Z][A-Za-z0-9]*|[A-Z][a-z0-9]+[A-Z][A-Za-z0-9]*|[a-z]+_[a-z0-9_]+|[A-Z][A-Z0-9_]{2,})\b/g)) idents.add(m[1]);
  for (const m of t.matchAll(/\b([A-Za-z_$][\w$]*)\(/g)) idents.add(m[1]);                  // name( … ) — a call or a definition
  for (const m of t.matchAll(/["“']([A-Za-z_$][\w$]{2,})["”']/g)) idents.add(m[1]);
  const literals = new Set();
  for (const m of t.matchAll(/\$?\d[\d,.]*%?/g)) { const v = m[0].replace(/[$,]/g, ""); if (v.length >= 2) literals.add(v); }
  return { files: [...files], idents: [...idents], literals: [...literals], words: [...new Set(words(t))] };
}

/**
 * Scope an edit.
 * @param files    { path: content } — the whole codebase
 * @param task     the ask, verbatim
 * @param opts     { budget: chars of full bodies to include, trace: [paths from a failing test's stack], keep: [paths always included],
 *                   legacy: the first version's weighting, kept so the experiment can measure what the fix changed }
 * @returns { include:[{path, why:[…], score, chars}], outline:[{path, defs}], chars, total, omitted, notes:[…] }
 */
export function scopeFor(files, task, { budget = 12000, trace = [], keep = [], maxFiles = 12, legacy = false } = {}) {
  const paths = Object.keys(files).filter((p) => CODE_EXT.test(p) || /\.(?:css|html?|json|md)$/i.test(p));
  const pset = new Set(paths);
  const idx = new Map(paths.map((p) => [p, indexFile(p, files[p])]));
  const T = termsOf(task);
  const score = new Map(), why = new Map();
  const add = (p, w, reason) => { if (!pset.has(p)) return; score.set(p, (score.get(p) || 0) + w); const r = why.get(p) || []; if (!r.includes(reason)) r.push(reason); why.set(p, r); };

  const definesNamed = (p) => T.idents.filter((n) => idx.get(p).defs.has(n));
  const usesNamed = (p) => T.idents.filter((n) => idx.get(p).uses.has(n) && !idx.get(p).defs.has(n));

  // named / caller
  for (const p of paths) {
    const d = definesNamed(p); if (d.length) add(p, 6 + d.length, "named:" + d.join(","));
    const u = usesNamed(p); if (u.length) add(p, 4, "caller:" + u.join(","));
  }
  // explicit paths, and path stems that match an ask word
  for (const f of T.files) { const hit = paths.find((p) => p === f || p.endsWith("/" + f)); if (hit) add(hit, 7, "path:named"); }
  const stemWords = new Set(T.words.concat(T.idents.flatMap(splitIdent)));
  for (const p of paths) {
    const stem = p.split("/").pop().replace(/\.[^.]+$/, "");
    if (stemWords.has(stem.toLowerCase()) || splitIdent(stem).some((w) => w.length > 3 && stemWords.has(w))) add(p, 3, "path:" + stem);
  }
  // literal
  for (const p of paths) for (const lit of T.literals) { if (new RegExp("(^|[^\\d.])" + lit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^\\d]|$)").test(files[p])) { add(p, 4, "literal:" + lit); } }
  // failing trace
  for (const tp of trace) { const hit = paths.find((p) => p === tp || tp.endsWith("/" + p) || p.endsWith("/" + tp)); if (hit) add(hit, 6, "trace"); }
  for (const k of keep) add(k, 20, "kept");

  // callee: what a scoped file depends on. v2: only the file(s) the ask actually POINTS AT
  // (named / path / trace) are trusted as seeds, an import edge from them is the strongest
  // dependency evidence there is (3.5), and a mere shared-symbol edge is weak (1.5). v1
  // expanded from every file that had scored 4+, so a dozen weak callees outranked the
  // one import that mattered.
  const strong = (p) => (why.get(p) || []).some((r) => /^(named|path:named|trace|kept)/.test(r));
  const seeds = legacy ? [...score.entries()].filter(([, s]) => s >= 4).map(([p]) => p) : paths.filter(strong);
  for (const sp of seeds) {
    const i = idx.get(sp);
    for (const spec of i.imports) { const r = resolveImport(sp, spec, pset); if (r && r !== sp) add(r, legacy ? 2.5 : 3.5, "callee:imported by " + sp); }
    for (const q of paths) if (q !== sp) { for (const d of idx.get(q).defs) if (i.uses.has(d) && d.length > 3 && !i.defs.has(d)) { add(q, legacy ? 2 : 1.5, "callee:" + d); break; } }
  }
  // sibling: the ask names a file that does not exist yet → its directory shows the pattern
  for (const f of T.files) if (!paths.some((p) => p === f || p.endsWith("/" + f))) {
    const dir = f.includes("/") ? f.slice(0, f.lastIndexOf("/") + 1) : "";
    for (const p of paths) if (p.startsWith(dir) && !p.slice(dir.length).includes("/") && CODE_EXT.test(p)) add(p, 1.5, "sibling:" + f);
  }
  // name: an identifier DEFINED in a file whose words (camelCase / snake_case split) overlap the ask's
  // words — `qualifiesForFreeShipping` carries "free" and "shipping". v2 only: names are how code says
  // what it is about, and a single lowercase token ("qualifiesforfreeshipping") hides it.
  if (!legacy) {
    const askWords = new Set(T.words);
    for (const p of paths) {
      if (!CODE_EXT.test(p)) continue;
      let best = null, bestN = 0;
      for (const d of idx.get(p).defs) { const ws = splitIdent(d).filter((w) => w.length > 2); const n = ws.filter((w) => askWords.has(w) || askWords.has(w.replace(/s$/, ""))).length; if (n > bestN) { bestN = n; best = d; } }
      if (bestN >= 2) add(p, 3 + bestN * 0.5, "name:" + best);
    }
  }
  // term: weak overlap with the ask's words
  if (T.words.length) {
    for (const p of paths) { const hay = new Set(words(files[p]).concat(splitIdent(p).filter((w) => w.length > 2))); let n = 0; for (const w of T.words) if (hay.has(w)) n++; if (n >= 2) add(p, Math.min(2, n * 0.4), "term:" + n); }
  }

  const isTest = (p) => /(^|\/)(tests?|__tests__|spec)\//i.test(p) || /\.(test|spec)\.[a-z]+$/i.test(p);
  if (!legacy) for (const [p, sc] of score) if (isTest(p)) score.set(p, sc * 0.5);   // a test is evidence, not the thing being changed
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const include = []; let used = 0;
  for (const [p, s] of ranked) {
    if (include.length >= maxFiles) break;
    const c = files[p].length;
    if (include.length && used + c > budget && !keep.includes(p)) continue;
    include.push({ path: p, why: why.get(p), score: +s.toFixed(2), chars: c }); used += c;
  }
  const inSet = new Set(include.map((x) => x.path));
  const outline = paths.filter((p) => !inSet.has(p)).map((p) => ({ path: p, defs: [...idx.get(p).defs].slice(0, 14) }));
  const total = paths.reduce((n, p) => n + files[p].length, 0);
  const notes = [];
  if (!include.length) notes.push("nothing in the codebase matches the ask by name, path, literal, trace or term — the model gets only the outline");
  notes.push("a convention in a file with no name, import, literal, trace or term linking it to the ask cannot be found mechanically");
  return { include, outline, chars: used, total, omitted: paths.length - include.length, notes };
}

/** The scoped prompt body: full text of the scoped files, then the outline of the rest. */
export function renderScope(files, scope, { outlineOnly = false } = {}) {
  const parts = [];
  if (!outlineOnly) for (const f of scope.include) parts.push(`### ${f.path}\n\`\`\`\n${files[f.path]}\n\`\`\``);
  if (scope.outline.length) parts.push("### other files (outline only — names they define, not their code)\n" + scope.outline.map((o) => `- ${o.path}${o.defs.length ? ": " + o.defs.join(", ") : ""}`).join("\n"));
  return parts.join("\n\n");
}

/** Everything, rendered the same way — the "full code stack". */
export function renderFull(files) {
  return Object.keys(files).sort().map((p) => `### ${p}\n\`\`\`\n${files[p]}\n\`\`\``).join("\n\n");
}
