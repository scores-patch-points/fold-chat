// G2: mutation check. Each gate of fold-chat-genvoid.js is deleted/inverted in a COPY (GENVOID_MODULE points the test file at it); the tests must fail.
// A second pass runs the frozen case harness (run.mjs) on the same mutants: the harness should notice the mutants that change a verdict.
// Gates in fold-chat-channels.js / fold-chat-gaps.js are mutated in a scratch copy of the tree (the shared tree is never edited).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const SRC = fs.readFileSync("fold-chat-genvoid.js", "utf8");
const M = [
  ["gate: no topic", `if (ot.needsSources && topicMissing) {`, `if (false) {`],
  ["gate: own text missing", `if (needs.length && !hasMaterial) {`, `if (false) {`],
  ["gate: alone-barred", `if (barred && !usable.length && !hasMaterial && !passages.length) {`, `if (false) {`],
  ["gate: unusable sources (none/meta/wall/off-topic)", `if (ot.needsSources && !failure && !usable.length) {`, `if (false) {`],
  ["gate: unsupported type", `if (ot.unsupported) return`, `if (false) return`],
  ["gate: unknown type", `if (!ot.type || !ot.known) return`, `if (false) return`],
  ["gate: model failure branch", `  if (fk) {\n    const missing`, `  if (false) {\n    const missing`],
  ["gate: Stop is not a void", `if (fk === "stopped") return ok();`, ``],
  ["gate: draft judged at all", `    const j = judgeDraft(modelResult, ot);\n    if (!j.ok) {`, `    const j = { ok: true };\n    if (!j.ok) {`],
  ["page: meta pages set aside", `if (m.meta) return { usable: false, why: "meta-" + m.kind, meta: m };`, ``],
  ["page: wall pages set aside", `if (WALL.test(text.slice(0, 1500)) && nWords(text) < 120) return`, `if (false) return`],
  ["page: off-topic pages set aside", `if (!tw.some((x) => hay.includes(stem(x)))) return { usable: false, why: "off-topic" };`, ``],
  ["page: empty pages set aside", `if (nWords(text) < 8) return { usable: false, why: "empty" };`, ``],
  ["failure: timeout", `if (st === 504 ||`, `if (false ||`],
  ["failure: rate-limit", `if (st === 429 ||`, `if (false ||`],
  ["failure: sealed", `if (st === 422 ||`, `if (false ||`],
  ["failure: gate (403)", `if (st === 403 ||`, `if (false ||`],
  ["failure: no-model", `if (/no model|none is (?:available|served)|not loaded/i.test(msg) || failure.kind === "no-model") return "no-model";`, ``],
  ["failure: network", `if (st === 0 || /unreachable|failed to fetch|network|load failed|econn|enotfound|fetch failed/i.test(msg)) return "network";`, ``],
  ["draft: empty", `if (!text) return { ok: false, reason: "empty", words: 0 };`, ``],
  ["draft: refusal", `if (REFUSAL.test(text) && w < 90)`, `if (false)`],
  ["draft: question back", `if (w < Math.max(floor, 60) + 90 && ASKS.test(text)`, `if (false && ASKS.test(text)`],
  ["draft: length floor", `else if (w < floor) return { ok: false, reason: "stub"`, `else if (false) return { ok: false, reason: "stub"`],
  ["draft: teaser with colon", `else if (TEASER.test(text) && /:\\s*$/.test(lastLine(text)))`, `else if (false)`],
  ["draft: build-size floor", `if (text.length < (spec.minChars || 80)) return`, `if (false) return`],
  ["draft: wrote a tutorial", `if (m.meta && m.kind !== "genre" &&`, `if (false &&`],
  ["draft: off-topic", `if (tw.length && w >= floor) { const hay`, `if (false) { const hay`],
  ["no fallback: default false", `fallbackAllowed = false }) {\n  const note`, `fallbackAllowed = true }) {\n  const note`],
  ["no fallback: offer, not strand", `fallbackAllowed: "offer", offer };`, `fallbackAllowed: true, offer };`],
  ["offer only with usable on-topic pages", `r.ok || !usable.length || !ot.topic`, `r.ok || false || !ot.topic`],
  ["had lists only usable pages", `const had = usable.slice(0, 6).map((p) => pageEntry(p, "about the topic"));`, `const had = passages.slice(0, 6).map((p) => pageEntry(p, "about the topic"));`],
  ["setAside is reported", `const setAside = judged.filter((x) => !x.v.usable).map((x) => ({ ...pageEntry(x.p), why: x.v.why }));`, `const setAside = [];`],
  ["strandFallbackAllowed", `kind !== "generate" && kind !== "compose"`, `true`],
  ["topicQuery strips the writing request", `.replace(WRITE_VERBS, " ")`, ``],
  ["topicQuery strips the type words", `if (re) q = q.replace(re, " ");`, ``],
  ["meta: topic IS the type is exempt", `const topicHasType = !!(re && re.test(ot.topic));`, `const topicHasType = false;`],
  ["meta: topical title is exempt", `if (titleHasTopic && !tHasType && !tCue) { s -= 3;`, `if (false) { s -= 3;`],
  ["meta: body cues need the type named 3x", `nType >= 3) {`, `nType >= 0) {`],
  ["meta: how-to-write title of any form", `if (!tHasType && /\\bhow to (?:write|draft|compose)\\b/i.test(title) && !titleHasTopic0) {`, `if (false) {`],
  ["meta: address cue", `if (slugType && URL_CUE.test(path)) { s += 3;`, `if (false) { s += 3;`],
  ["meta: service cue needs the type", `if (serviceHit && (nType >= 1 || tHasType))`, `if (serviceHit)`],
  ["meta: threshold", `{ threshold = 4 } = {}) {\n  const ot = normOutputType(outputType);\n  const none`, `{ threshold = 1 } = {}) {\n  const ot = normOutputType(outputType);\n  const none`],
  ["meta: language-agnostic type table (unknown type is never meta)", `if (!passage || !ot.type || !ot.known) return none;`, `if (!passage) return none;`],
  ["failure: withheld", `|stopped|failed|withheld)$/.test(failure.kind)) return failure.kind;`, `|stopped|failed)$/.test(failure.kind)) return failure.kind;`],
  ["retry list", `const RETRY = ["network", "timeout", "rate-limit", "failed", "withheld",`, `const RETRY = ["zzz",`],
  ["topicQuery drops stated length", `.replace(/\\b\\d{2,5}[\\s-]*words?\\b|\\bwords?\\b/gi, " ")`, ``],
  ["topicQuery drops unsupported type names", `[...Object.keys(TYPES), ...UNSUPPORTED].sort((a, b) => b.length - a.length)) { const re = typeRe(t, "gi")`, `[...Object.keys(TYPES)].sort((a, b) => b.length - a.length)) { const re = typeRe(t, "gi")`],
  ["outputTypeFromAsk: stated length", `constraints: { ...(/(\\d{2,5})`, `constraints: { ...(false && /(\\d{2,5})`],
  ["outputTypeFromAsk: own-text need", `voidIfMissing: ownText && !hasMaterial && base.type === "summary" ? ["own-text"] : []`, `voidIfMissing: []`],
  ["no-topic: deictic words", `const DEICTIC = new Set(["this", "that", "it", "these", "those", "them", "the above", "above", "the topic", "topic", "the same", "same", "the last answer", "that answer", "the answer", "what you said", "the previous"]);`, `const DEICTIC = new Set([]);`],
  ["constraint: stated word count lowers the floor", `const floor = spec.text === false ? 0 : (wantN ?`, `const floor = spec.text === false ? 0 : (false ?`],
];
fs.mkdirSync("eval/ants/g2/mut", { recursive: true });
const results = [];
for (const [name, from, to] of M) {
  if (!SRC.includes(from)) { results.push({ name, status: "PATTERN-NOT-FOUND" }); continue; }
  if (SRC.split(from).length > 2 && !name.startsWith("failure") ) { /* ambiguous replace: only the first occurrence is mutated */ }
  const mut = SRC.replace(from, to);
  const file = path.resolve("eval/ants/g2/mut/genvoid.mut.js"); fs.writeFileSync(file, mut);
  const r = spawnSync("node", ["--test", "fold-chat-genvoid.test.mjs"], { env: { ...process.env, GENVOID_MODULE: file }, encoding: "utf8" });
  const fails = Number((/ℹ fail (\d+)/.exec(r.stdout) || [])[1] || 0);
  const h = spawnSync("node", ["eval/ants/g2/run.mjs"], { env: { ...process.env, GENVOID_MODULE: file, QUIET: "1" }, encoding: "utf8" });
  let harness = null; try { const s = JSON.parse(h.stdout.trim().split("\n").pop()); harness = { failuresMissed: s.nFailure - s.after.pass, falseVoids: s.controls.falseVoids }; } catch { harness = { error: String(h.stderr).slice(0, 80) }; }
  results.push({ name, status: fails > 0 ? "KILLED" : "SURVIVED", testsFailing: fails, harness });
  console.log((fails > 0 ? "killed   " : "SURVIVED ") + name.padEnd(62), "tests failing:", fails, " harness:", JSON.stringify(harness));
}
fs.rmSync("eval/ants/g2/mut", { recursive: true, force: true });
const k = results.filter((r) => r.status === "KILLED").length;
console.log(`\n${k}/${results.length} mutants killed by the tests; survivors: ${results.filter((r) => r.status !== "KILLED").map((r) => r.name + " [" + r.status + "]").join("; ") || "none"}`);
fs.writeFileSync("eval/ants/g2/mutation.json", JSON.stringify(results, null, 1));

// ── part 2: the additive gates in fold-chat-channels.js / fold-chat-gaps.js, mutated in a scratch copy of the tree ─────────────
const SCRATCH = process.env.G2_SCRATCH || "/private/tmp/claude-501/-Users-mlacy-Documents-3-0-the-fold/0c804cde-75c0-4276-bf91-3cc3a46d1c35/scratchpad/g2-tree";
const M2 = [
  ["channels: VOID_KINDS has generate", "fold-chat-channels.js", `"model", "generate"]);`, `"model"]);`],
  ["channels: voidLabel generate", "fold-chat-channels.js", `if (v.kind === "generate") return genVoidLabel(v);`, ``],
  ["channels: voidText generate", "fold-chat-channels.js", `if (v.kind === "generate") return genVoidText(v);`, ``],
  ["channels: migration keeps a creative record's generate void", "fold-chat-channels.js", `rec.void.kind === "generate" || `, ``],
  ["gaps: gapAnswerLine generate", "fold-chat-gaps.js", `if (v.kind === "generate") return genVoidLine(v);`, ``],
  ["gaps: aloneTurn names the output", "fold-chat-gaps.js", `if (outputType && (kind === "generate" || kind === "compose")) {`, `if (false) {`],
  ["gaps: aloneTurn only for writing kinds", "fold-chat-gaps.js", `(kind === "generate" || kind === "compose")) {`, `true) {`],
];
fs.rmSync(SCRATCH, { recursive: true, force: true }); fs.mkdirSync(SCRATCH, { recursive: true });
spawnSync("sh", ["-c", `cp *.js *.mjs '${SCRATCH}'/ && cp -R vendor '${SCRATCH}'/vendor`]);
const r2 = [];
for (const [name, file, from, to] of M2) {
  const orig = fs.readFileSync(file, "utf8"); if (!orig.includes(from)) { r2.push({ name, status: "PATTERN-NOT-FOUND" }); console.log("PATTERN-NOT-FOUND", name); continue; }
  fs.writeFileSync(path.join(SCRATCH, file), orig.replace(from, to));
  const r = spawnSync("node", ["--test", "fold-chat-channels.test.mjs", "fold-chat-gaps.test.mjs"], { cwd: SCRATCH, encoding: "utf8" });
  const fails = Number((/ℹ fail (\d+)/.exec(r.stdout) || [])[1] || 0);
  fs.writeFileSync(path.join(SCRATCH, file), orig);
  r2.push({ name, status: fails > 0 ? "KILLED" : "SURVIVED", testsFailing: fails }); console.log((fails > 0 ? "killed   " : "SURVIVED ") + name.padEnd(62), "tests failing:", fails);
}
fs.rmSync(SCRATCH, { recursive: true, force: true });
console.log(`\npart 2: ${r2.filter((x) => x.status === "KILLED").length}/${r2.length} killed`);
fs.writeFileSync("eval/ants/g2/mutation.json", JSON.stringify({ genvoid: results, channelsAndGaps: r2 }, null, 1));
