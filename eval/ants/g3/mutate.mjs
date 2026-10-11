// G3 mutation check: delete each gate clause in a scratch copy of the tree; the tests must FAIL (a gate whose removal changes nothing is not a gate).
//   node eval/ants/g3/mutate.mjs        -> eval/ants/g3/mutation-results.json
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SCR = process.env.G3_SCRATCH || "/private/tmp/claude-501/-Users-mlacy-Documents-3-0-the-fold/0c804cde-75c0-4276-bf91-3cc3a46d1c35/scratchpad/mut-tree";
const TESTS = ["fold-chat-anaphora.test.mjs", "fold-chat-histkind.test.mjs", "fold-chat-flow.test.mjs"];
const M = [
  // [name, file, from, to]
  ["anaphora: strong pronoun clause removed", "fold-chat-anaphora.js", 'if (!cls.strong.has(x.t)) continue;', 'continue;'],
  ["anaphora: weak pronoun clause removed", "fold-chat-anaphora.js", 'if (n <= ANAPHORA.weakMaxTokens && !own) {', 'if (false) {'],
  ["anaphora: weak-pronoun length cap removed", "fold-chat-anaphora.js", 'if (n <= ANAPHORA.weakMaxTokens && !own) {', 'if (!own) {'],
  ["anaphora: weak-pronoun 'names its own entity' guard removed", "fold-chat-anaphora.js", 'if (n <= ANAPHORA.weakMaxTokens && !own) {', 'if (n <= ANAPHORA.weakMaxTokens) {'],
  ["anaphora: expletive list emptied", "fold-chat-anaphora.js", 'const expletive = cls.expletive.some((re) => re.test(lower));', 'const expletive = false;'],
  ["anaphora: determiner/complementizer guard removed", "fold-chat-anaphora.js", 'if (["that", "this", "these", "those"].includes(x.t)) {', 'if (false) {'],
  ["anaphora: 'one' only-at-end guard removed", "fold-chat-anaphora.js", 'if (x.t === "one" || x.t === "ones") {', 'if (false) {'],
  ["anaphora: fragment clause (no content word) removed", "fold-chat-anaphora.js", 'if (content.length === 0 && n <= ANAPHORA.fragmentMaxTokens) return', 'if (false) return'],
  ["anaphora: connective clause removed", "fold-chat-anaphora.js", 'if (lead) {', 'if (false) {'],
  ["anaphora: connective 'clause of its own' guard removed", "fold-chat-anaphora.js", 'const clause = rest.some((x) => cls.wh.has(x.t));', 'const clause = false;'],
  ["anaphora: comparative clause removed", "fold-chat-anaphora.js", 'if (cls.comparative.test(lower) && n <=', 'if (false && n <='],
  ["anaphora: comparative 'than/or' guard removed", "fold-chat-anaphora.js", '&& !toks.some((x) => cls.than.has(x.t))) return', ') return'],
  ["anaphora: French inverted-clitic guard removed", "fold-chat-anaphora.js", 'if (x.inv && toks.slice(0, i).some(isContent)) continue;', ''],
  ["anaphora: elided-clitic stub guard removed", "fold-chat-anaphora.js", '!x.el && ', ''],
  ["anaphora: undecided language carries instead of declining", "fold-chat-anaphora.js", 'if (!trig.size) return verdict(false, null,', 'if (!trig.size) return verdict(true, "pronoun",'],
  ["anaphora: no declared class + hints: article-like trigger accepted for every token", "fold-chat-anaphora.js", 'const hit = toks.find((x) => trig.has(x.t));', 'const hit = toks[0];'],
  ["thread: followUp ignores the verdict (the old trigger path)", "fold-chat-thread.js", 'if (!gate.carry) return { ...base, gate,', 'if (false) return { ...base, gate,'],
  ["mind: resolveQuestion ignores gate=false", "fold-chat-mind.js", 'if (gate && gate.carry === false) return', 'if (false) return'],
  ["mind: resolveQuestion forced carry removed (a fragment needs the trigger prior)", "fold-chat-mind.js", 'const forced = !!(gate && gate.carry === true);', 'const forced = false;'],
  ["mind: a line break no longer opens a sentence", "fold-chat-mind.js", '/[.!?¿¡]\\s*$|\\n\\s*$/u', '/[.!?¿¡]\\s*$/u'],
  ["mind: a creative answer admits referents", "fold-chat-mind.js", '[[turn?.creative ? "" : a, "answer"], [q, "question"]]) {\n    for', '[[a, "answer"], [q, "question"]]) {\n    for'],
  ["flow: a move need not lean on the last turn (the merged feature fires on a standalone ask)", "fold-chat-flow.js", "isMove(question, act) && moveLeans()) {", "isMove(question, act)) {"],
  ["anaphora: demonstrativeAsPronoun ignored", "fold-chat-anaphora.js", "if (!demonstrativeAsPronoun && next", "if (next"],
  ["salience: continuesThread ignores the verdict", "fold-chat-salience.js", 'if (follow && follow.gate) return false;', ''],
  ["histkind: creative exchanges are kept verbatim", "fold-chat-histkind.js", 'if (!creative || (leansOnLast && n === lastIdx))', 'if (true)'],
  ["histkind: a creative TURN still gets the marker", "fold-chat-histkind.js", 'if (CREATIVE_KINDS.includes(kind)) return msgs;', ''],
  ["histkind: the exchange the ask leans on is replaced anyway", "fold-chat-histkind.js", '(leansOnLast && n === lastIdx)', 'false'],
  ["histkind: the pending ask is subject to the rule", "fold-chat-histkind.js", 'if (n === pending) { out.push(...ex); lastWasMarker = false; return; }', ''],
  ["histkind: an empty creative reply is not recognised (ask classifier removed)", "fold-chat-histkind.js", '(typeof classify === "function" && CREATIVE_KINDS.includes(classify(textOf(ask)))) || ', ''],
  ["histkind: a creative reply flag is not recognised", "fold-chat-histkind.js", '|| ex.slice(1).some(isCreativeReply));', ');'],
];
function sync() {
  fs.rmSync(SCR, { recursive: true, force: true }); fs.mkdirSync(path.join(SCR, "eval/ants/g3"), { recursive: true });
  for (const f of fs.readdirSync(ROOT)) if (/\.(js|mjs)$/.test(f)) fs.copyFileSync(path.join(ROOT, f), path.join(SCR, f));
  fs.symlinkSync(path.join(ROOT, "vendor"), path.join(SCR, "vendor"));
  for (const e of fs.readdirSync(path.join(ROOT, "eval"))) if (e !== "ants") fs.symlinkSync(path.join(ROOT, "eval", e), path.join(SCR, "eval", e));   // the tests read eval data (cases, priors)
  for (const f of fs.readdirSync(path.join(ROOT, "eval/ants/g3"))) if (/\.mjs$/.test(f)) fs.copyFileSync(path.join(ROOT, "eval/ants/g3", f), path.join(SCR, "eval/ants/g3", f));
}
const run = (cwd) => { const tests = TESTS.filter((t) => fs.existsSync(path.join(cwd, t))); try { execFileSync("node", ["--test", ...tests], { cwd, stdio: "pipe", timeout: 180000 }); return { fail: 0 }; } catch (e) { const out = String(e.stdout || "") + String(e.stderr || ""); const m = out.match(/ℹ fail (\d+)/); return { fail: m ? Number(m[1]) : -1 }; } };
sync();
const base = run(SCR); console.log("baseline (no mutation): failing tests =", base.fail);
const results = [];
for (const [name, file, from, to] of M) {
  const p = path.join(SCR, file);
  if (!fs.existsSync(p)) { results.push({ name, skipped: "file absent" }); console.log("SKIP", name); continue; }
  const src = fs.readFileSync(p, "utf8");
  if (!src.includes(from)) { results.push({ name, error: "pattern not found" }); console.log("PATTERN-NOT-FOUND", name); continue; }
  fs.writeFileSync(p, src.replace(from, to));
  const r = run(SCR); fs.writeFileSync(p, src);
  results.push({ name, failing: r.fail, killed: r.fail !== 0 }); console.log(r.fail !== 0 ? "KILLED  " : "SURVIVED", `(${r.fail} failing)`, name);
}
fs.writeFileSync(path.join(ROOT, "eval/ants/g3/mutation-results.json"), JSON.stringify({ at: new Date().toISOString(), baselineFailing: base.fail, results }, null, 1));
console.log(`\n${results.filter((r) => r.killed).length}/${results.length} mutants killed`);
