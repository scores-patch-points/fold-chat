// G1 mutation check: delete each gate of fold-chat-outputtype.js in turn and run fold-chat-outputtype.test.mjs against the mutant. A gate whose deletion
// leaves the tests green is not a gate. Usage: node eval/ants/g1/mutate.mjs
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const src = fs.readFileSync(path.join(root, "fold-chat-outputtype.js"), "utf8");
const M = [
  ["G1 question-frame", "QUESTION_FRAME.has(t.f) || REPORTING.has(t.f)", "false"],
  ["G1b reported request", "QUESTION_FRAME.has(t.f) || REPORTING.has(t.f)", "QUESTION_FRAME.has(t.f)"],
  ["G1 sentence scope", "t.end <= lead.at && t.at >= sentStart", "t.end <= lead.at"],
  ["G1c declaration", "if (DECLARATIVE.test(bt) && !WANTING.test(bt)) return null;", ""],
  ["G1c wanting exemption", "DECLARATIVE.test(bt) && !WANTING.test(bt)", "DECLARATIVE.test(bt)"],
  ["G1d negation/modal in frame", '"cannot", "can\'t", "cant", "don\'t", "dont", "won\'t", "didn\'t", "couldn\'t", "wouldn\'t", "never", "not", "no", "doesn\'t", "isn\'t"', ""],
  ["G2 between-words", "if (NOT_BETWEEN.has(w) &&", "if (false &&"],
  ["G3 particle", "if (nxt && PARTICLES.has(nxt.f) && !TOPIC_PREP.has(nxt.f)) return null;", ""],
  ["G4 existing-work (the + Title)", 'if (/^(?:the|la|le|el)$/.test(prev || "") && nextW && /^\\p{Lu}/u.test(text.slice(nextW.at, nextW.at + 1)) && !TOPIC_PREP.has(nextW.f)) return null;', ""],
  ["G5 code-first", "if (codeAsk) return", "if (false) return"],
  ["G6 thread resolution", "const d = depth < 3 ? describeOutput(a,", "const d = depth < -1 ? describeOutput(a,"],
  ["G6 fragment skip", " || wordsOf(a).length <= 2) continue;", ") continue;"],
  ["G6 deictic from thread (thread-ask subject)", "const subj = subjectOfAsk(a);\n    if (subj && subj.length > 1) return", "const subj = null;\n    if (subj && subj.length > 1) return"],
  ["G7 evidence check", "if (!evidenceFor(a, turn)) return desc;", ""],
  ["G7 two-order agreement", "if (!a || a !== b || !opts.includes(a)) return desc;", "if (!a || !opts.includes(a)) return desc;"],
  ["G7 closed list", "if (!a || a !== b || !opts.includes(a)) return desc;", "if (!a || a !== b) return desc;"],
  ["G7 only the undecided go to a model", "if (!desc || !desc.undecided || typeof pick", "if (!desc || typeof pick"],
  ["G8 capability question", "if (lead && !topicRaw && !between.some(isMod) &&", "if (false && lead && !topicRaw && !between.some(isMod) &&"],
  ["G9 writing guides set aside", "usable = usable.filter((p) => !isWritingGuide(p));", ""],
  ["G9 two cues needed", "WRITING_GUIDE_CUES.filter((re) => re.test(t)).length >= 2", "WRITING_GUIDE_CUES.filter((re) => re.test(t)).length >= 1"],
  ["typo: first letter never edited", "a[0] !== b[0]", "false"],
  ["typo: real near-words", "NEAR_REAL.has(word) ||", ""],
  ["typo: suffix is not a typo", "if (i >= l.length - 1) return false;", ""],
  ["compound nouns head-final", "if (nx && nx[2] === 1 && HEAD_TYPES.has(nx[0])", "if (false && nx && nx[2] === 1 && HEAD_TYPES.has(nx[0])"],
  ["ambiguous verb is a noun after 'a'", "if (!AMBIGUOUS_LEAD.has(x.v)) return true;", "return true;"],
  ["'for' yields to a later 'on/about'", "if (first >= 0 && FOR_LIKE.has(after[first].f))", "if (false)"],
  ["container is not a subject", "if (CONTAINER.test(raw) && !DEICTIC.test(fold(raw))) raw = \"\";", ""],
  ["public recipient needs facts", "(PUBLIC_RECIPIENT.test(seg.segText) || !REQUESTY.test(seg.segText))", "!REQUESTY.test(seg.segText)"],
  ["personal forms need no sources", "(!PERSONAL_FORMS.has(String(form)) || WANTS_FACTS.test(seg.segText))", "true"],
  ["count nouns only when counted", "else n = null; }", "else { /* keep */ } }"],
  ["counted advice stays advice", 'if (d.type === "list" && /^(?:tips|ways|suggestions)$/.test(String(d.form))) return null;', ""],
  ["visual verbs are unsupported", "if (lead && VISUAL_LEADS.has(lead.v)) {", "if (false && lead && VISUAL_LEADS.has(lead.v)) {"],
  ["named text is a topic (namedTarget)", "namedTarget: true", "namedTarget: false"],
  ["no transform without the kinds detector", "const ts = transformShape(text, { hasMaterial: ctx.hasMaterial });\n    if (ts && ts.kind !== \"other\")", "const ts = null;\n    if (ts && ts.kind !== \"other\")"],
];
const tmp = path.join(root, ".g1-mutant.js");
const results = [];
for (const [name, from, to] of M) {
  if (!src.includes(from)) { results.push({ name, status: "SNIPPET-NOT-FOUND" }); continue; }
  fs.writeFileSync(tmp, src.replace(from, to));
  const r = spawnSync("node", ["--test", path.join(root, "fold-chat-outputtype.test.mjs")], { cwd: root, env: { ...process.env, OT_PATH: tmp }, encoding: "utf8" });
  const failed = /ℹ fail (\d+)/.exec(r.stdout)?.[1];
  results.push({ name, status: Number(failed) > 0 ? "KILLED" : "SURVIVED", failedTests: Number(failed) });
}
fs.rmSync(tmp, { force: true });
const base = spawnSync("node", ["--test", path.join(root, "fold-chat-outputtype.test.mjs")], { cwd: root, encoding: "utf8" });
console.log("baseline (unmutated):", /ℹ pass (\d+)/.exec(base.stdout)?.[1], "pass,", /ℹ fail (\d+)/.exec(base.stdout)?.[1], "fail");
for (const r of results) console.log(r.status.padEnd(18), r.name, r.failedTests != null ? `(${r.failedTests} failing)` : "");
console.log(`\n${results.filter((r) => r.status === "KILLED").length}/${results.length} mutants killed`);
fs.writeFileSync(path.join(root, "eval/ants/g1/mutation-results.json"), JSON.stringify(results, null, 1));
