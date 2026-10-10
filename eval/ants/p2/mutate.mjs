// mutate.mjs — mutation check of every gate of fold-chat-answerspan.js: delete (or neutralise) the gate in a COPY of the module, run the test file against the copy
// (ANSWERSPAN=<copy>), and require it to FAIL. The copy lives beside the module (its relative imports must resolve) and is removed after each mutant.
//   node eval/ants/p2/mutate.mjs            -> writes eval/ants/p2/mutation-results.json, exit 1 if any mutant survives
import fs from "node:fs"; import path from "node:path"; import { spawnSync } from "node:child_process";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const SRC = path.join(ROOT, "fold-chat-answerspan.js"); const COPY = path.join(ROOT, "fold-chat-answerspan.__mut.js"); const TEST = "fold-chat-answerspan.test.mjs";
const src = fs.readFileSync(SRC, "utf8");
const M = [
  ["unsupported-language gap", 'if (!ask.supported) return {', 'if (false) return {'],
  ["no-content-terms gap", 'if (!ask.terms.length) return { ask: publicAsk, spans: [], gap: { kind: "no-terms"', 'if (false) return { ask: publicAsk, spans: [], gap: { kind: "no-terms"'],
  ["block-page (wall) gate", 'if (w.blocked) { skipped.push', 'if (false) { skipped.push'],
  ["question-sentence filter", 'if (isQuestion(st) || /^={2,}/.test(st)) return;', 'if (/^={2,}/.test(st)) return;'],
    ["confidence threshold", 'const ok = found.filter((f) => f.confidence >= thr);', 'const ok = found;'],
  ["term-coverage threshold", 'if (cov < SPAN.minCoverage) return null;', ''],
  ["anchor gate (a word of the ask or a cue is in the span)", 'if (!(inSpan > 0 || cueHit || weakHit)) return null;', ''],
  ["figure dimension fit (length)", 'if (d === "len") return a.dim === "len" ? 1 : 0;', 'if (d === "len") return 1;'],
  ["figure fit floor (minFit)", 'atoms = atoms.filter((a) => a.fit >= SPAN.minFit);', ''],
  ["count needs a named noun or an adjacent word of the ask", 'return near ? 0.9 : 0.35;', 'return 1;'],
  ["month is not a quantity unit", 'if (MONTH_SET.has(u)) continue;', ''],
  ["subject clause (the span holds a word of the ask)", 'for (let guard = 0; guard < 20 && !need(', 'for (let guard = 0; guard < 0 && !need('],
  ["predicate clause (a non-subject word of the ask comes with the answer)", 'for (let guard = 0; guard < 6; guard++) {\n    const miss = missingPred();', 'for (let guard = 0; guard < 0; guard++) {\n    const miss = missingPred();'],
  ["relative-word head clause", 'if (f && REL_START.test(f.t)) { lo--;', 'if (false) { lo--;'],
  ["locative tail of a place", 'while (hi < clauses.length - 1 && lead(clauses[hi + 1])', 'while (false && hi < clauses.length - 1 && lead(clauses[hi + 1])'],
  ["tail cut after a figure", 'if (rest.trim() && (!first || fw.has(first.t)) && words(cut, end) >= 3) { end = cut; why.push("tail-cut"); }', ''],
  ["never end inside a quotation or bracket", 'const open = () => { const t = st.slice(start, end); return', 'const open = () => { const t = st.slice(start, end); return false &&'],
  ["name ask excludes a place after 'in'", 'return ask.want === "name" ? !locative : true;', 'return true;'],
    ["causal marker for a reason ask", 'else if (ask.want === "reason") fit = causalHit(ask, st) ? 1 : 0;', 'else if (ask.want === "reason") fit = 1;'],
  ["FAQ item answers only when its question carries the ask", 'if (share < SPAN.faqDirect) continue;', ''],
  ["lead-of-page prior", 'leadWeight: 0.12,', 'leadWeight: 0,'],
  ["pronoun: antecedent subject holds a word of the ask", 'if (holds && gendered && rivals === 0)', 'if (gendered && rivals === 0)'],
  ["pronoun: no rival noun phrase in the antecedent sentence", 'if (holds && gendered && rivals === 0)', 'if (holds && gendered)'],
  ["pronoun: the antecedent sentence opens with a clean subject", 'if (fw.has(toks[0].t) && !DET.has(toks[0].t)) return null;', ''],
  ["rewrite rule: strip-citation", '\\[(?:\\d{1,3}|[a-z]|citation needed|', '\\[(?:\\d{9}|[a-z]{9}|citation needed9|'],
    ["rewrite rule: drop-marker", 'if (f.startsWith(mf) && /^[,\\s]/.test(f.slice(mf.length))', 'if (false && f.startsWith(mf) && /^[,\\s]/.test(f.slice(mf.length))'],
  ["rewrite rule: attribute-quote keeps the attribution", 'return `According to ${m[1].trim()}, ${m[2].replace(/[,.]$/, "")}`;', 'return m[2].replace(/[,.]$/, "");'],
  ["rewrite rule: unit-swap needs the same quantity (figureMatches)", "|| !figureMatches(a, b) && !figureMatches(b, a)) return t;", ") return t;"],
  ["rewrite rule: tidy-space", '.replace(/\\s+([,.;:!?)])/g, "$1")', '.replace(/\\s+(NOMATCH9)/g, "$1")'],
  ["rewrite rule: capitalise", 'apply: (t) => cap1(t) }', 'apply: (t) => t }'],
  ["rewrite rule: terminal-stop", 'apply: (t, p) => (/[.!?。！？…]["\'”’)\\]」]*$/u.test(t.trim()) ? t : t.replace(', 'apply: (t, p) => (true ? t : t.replace('],
  ["verifyRewrite: re-derives the text from the source", 'if (out.text !== rewrite.text) return bad("does not re-derive");', ''],
  ["verifyRewrite: only named rules", 'if (!st || !Object.prototype.hasOwnProperty.call(registry, st.rule)) return bad("unnamed rule " + (st && st.rule));', ''],
  ["verifyRewrite: fixed rule order", 'if (i <= last) return bad("rule order");', ''],
  ["verifyRewrite: source range", 'src.end > String(passage.text ?? "").length', 'false'],
  ["verifyRewrite: antecedent range", 'a[1] > String(passage.text ?? "").length || (!src.item && a[1] > src.start)', 'false'],
  ["verifyRewrite: no figure the source lacks", 'return bad("figure not in the source: " + n);', 'continue;'],
  ["v2: language resolved from the ask's own closed classes", '  const other = ASK_LANGS.find(recognised);\n  return other || d;', '  return d;'],
  ["v2: a bare month is a date only after a preposition", String.raw`if (!(/\b(?:in|during|since|until|by|from|before|after|en|dans|depuis|jusqu'en|desde|hasta|в)\s+$/.test(before) && /^(?:[,.;:)]|\s*$)/.test(after))) continue;`, ''],
  ["v2: biographical lead", 'if (ask.want === "date" && ask.tab.life && ix.titleKs.size) {', 'if (false) {'],
  ["v2: a life ask wants born XOR died", '(wantBorn !== wantDied)', 'true'],
  ["v2: the page must be titled for the person asked", 'ask.terms.filter((t) => ix.titleKs.has(t.k)).length >= Math.min(2, ix.titleKs.size)', 'true'],
  ["v2: a source named in the ask is not a content term", '/(?:according to|as per|as stated|as reported)/i.test(m) ||', 'false ||'],
  ["v2: a year in the title narrows the page", 'const narrow = yearInTitle ? -0.08 : 0;', 'const narrow = 0;'],
  ["v2: a parenthesis that holds a series is content", 'if (/\\d/.test(inner) || inner.includes(",")) return m;', 'if (/\\d/.test(inner)) return m;'],
  ["v2: the chrome gate judges the shown span", 'spanJunk.set(t, !!(j.leading || j.dominated || j.markup));', 'spanJunk.set(t, false);'],
  ["v2: a lead sentence may run to 130 words", 'maxSentenceWords: 130,', 'maxSentenceWords: 70,'],
  ["v2: Russian four-letter stem", 'if (lang === "ru") return w.length >= 5 ? w.slice(0, 4) : w;', ''],
  ["v2: 'how long' accepts a duration", 'long: ["lentime",', 'long: ["len",'],
  ["v2: a bare Yes./No. FAQ answer takes the next sentence", 'if (first.toks.length <= 3 && arr[1]) last = arr[1].s;', ''],
  ["v2: 'per' makes a speed", 'perDim = bd === "len" && /^(?:second|hour|minute|s|h)$/i.test(perM[2]) ? "speed" : bd || null;', 'perDim = bd || null;'],
  ["v2: a sentence stop is not part of the unit", '{ const trimmed = unit3.replace(/[.\\-]+$/, ""); cut += unit3.length - trimmed.length; unit3 = trimmed; }', '{}'],
  ["v3: the asker's own measure word beats its synonym", 'const ownHit = cueWanted && toks.some((x) => ownKs.has(x.k));', 'const ownHit = cueWanted && toks.some((x) => cueKs.has(x.k));'],
  ["v3: a named unit says the dimension", 'if (want === "figure" && unit && (dim === "count" || dim === "any")) dim = UNIT_DIM.get(unit);', ''],
  ["v3: a lowercase start continues the previous sentence", 'if (prev && LOWER.test(x.text) && casedScript(x.text) &&', 'if (false && prev && LOWER.test(x.text) && casedScript(x.text) &&'],
  ["v3: a definition may open with the asked words", 'return ask.terms.length > 0 && ask.terms.every((t) => opening.has(t.k));', 'return false;'],
  ["v3: a conversion figure is not a second answer", 'atoms = atoms.filter((a, i) => !atoms.some((b, j) => j !== i && b.end <= a.start && /^\\s*\\(\\s*$/.test(st.slice(b.end, a.start))));', ''],
  ["v3: agreement of independent passages", 'for (const f of found) { const k = atomKey(f);', 'for (const f of found) { const k = null;'],
  ["v3: 'named after' is a word-history cause", '"because", "named after", "named for", "named in honor", "called after", "to prevent",', '"because", "to prevent",'],
  ["v4: a predicate word weighs double in coverage", "predWeight: 2,", "predWeight: 1,"],
  ["v4: 'boiling point' is one measure word", 'if (L === "en" && x.t === "point" && /^(?:boiling|melting|freezing|flash|dew)$/.test(toks[ti - 1]?.t || "")) continue;', ''],
  ["definition head (the subject holds a word of the ask)", 'if (i >= 0 && toks.slice(0, i).some((x) => termKs.has(x.k))) return true;', 'if (i >= 0) return true;'],
  ["rewrite rule: strip-aside keeps a parenthesis with a figure", 'if (/\\d/.test(inner) || inner.includes(",")) return m;', 'if (inner.includes(",")) return m;'],
];
const results = [];
const run = (env) => spawnSync(process.execPath, ["--test", TEST], { cwd: ROOT, env: { ...process.env, ...env }, encoding: "utf8", timeout: 110000 });
const base = run({});
if (base.status !== 0) { console.error("the unmutated module must pass its tests first"); console.error((base.stdout || "").split("\n").filter((l) => /✖|fail/.test(l)).slice(0, 10).join("\n")); process.exit(2); }
let survived = 0;
for (const [name, find, repl] of M) {
  const n = src.split(find).length - 1;
  if (n !== 1) { results.push({ name, status: "BAD-PATTERN", occurrences: n }); console.log(`BAD-PATTERN (${n}x)  ${name}`); survived++; continue; }
  fs.writeFileSync(COPY, src.replace(find, () => repl));
  const r = run({ ANSWERSPAN: "./fold-chat-answerspan.__mut.js" });
  fs.unlinkSync(COPY);
  const killed = r.status !== 0;
  const failing = (r.stdout || "").split("\n").filter((l) => l.startsWith("✖") && !/failing tests/.test(l)).map((l) => l.replace(/\s*\(\d+(\.\d+)?ms\)/, "")).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
  results.push({ name, status: killed ? "killed" : "SURVIVED", killedBy: failing });
  console.log(`${killed ? "killed   " : "SURVIVED "} ${name}${killed ? "  <- " + failing[0] : ""}`);
  if (!killed) survived++;
}
fs.writeFileSync(path.join(ROOT, "eval/ants/p2/mutation-results.json"), JSON.stringify({ at: new Date().toISOString(), total: M.length, killed: results.filter((r) => r.status === "killed").length, survived, results }, null, 1));
console.log(`\n${results.filter((r) => r.status === "killed").length}/${M.length} gates killed, ${survived} survived`);
process.exit(survived ? 1 : 0);
