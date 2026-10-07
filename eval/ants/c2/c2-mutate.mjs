// eval/ants/c2/c2-mutate.mjs — mutation check of fold-chat-voices.js (C2-h): delete/weaken each gate in turn; the unit tests must FAIL for each.
//   node eval/ants/c2/c2-mutate.mjs        (writes a temporary fold-chat-voices.mut.js next to the module and removes it)
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SRC = fs.readFileSync(path.join(ROOT, "fold-chat-voices.js"), "utf8");
const MUTNAME = `fold-chat-voices.mut-${process.pid}.js`, MUT = path.join(ROOT, MUTNAME);
const M = (name, from, to) => ({ name, from, to });
const MUTANTS = [
  M("strict: all stems -> any one stem (n<=2)", "n <= 2 ? n :", "n <= 2 ? 1 :"),
  M("strict: switch ignored (always loose)", "(!strict ? 1 :", "(true ? 1 :"),
  M("strict: majority rule for n>2 dropped", "Math.ceil((2 * n) / 3)", "1"),
  M("shared bearsOn floor removed", "if (!bearsOn(question, s.text, fw).ok) continue;", ""),
  M("shared verifyNumber removed", "if (!v.ok) continue;", ""),
  M("canon-slice check removed", "if (text && text.slice(s.start, s.end) !== s.text) continue;", ""),
  M("sha refusal removed (findVoice)", "canon.sha256 !== thinker.source.sha256) return none", "false) return none"),
  M("no-verified-source refusal removed", "if (!thinker?.source?.sha256) return none(\"no_verified_source\");", ""),
  M("digit-run filter removed", "new RegExp(`\\\\d{${L.maxDigitRun + 1},}`).test(s.text) ||", ""),
  M("question-sentence filter removed", "/\\?[\"')\\]”’]*$/.test(s.text) ||", ""),
  M("lowercase-opening filter removed", "|| /^\\p{Ll}/u.test(s.text)", ""),
  M("minStems filter removed", "if (s.stems.size < L.minStems) continue;", ""),
  M("max cap: loop break removed", "if (found.length >= L.max) break;", ""),
  M("max cap: final slice removed", "found.slice(0, L.max).sort(byName)", "found.sort(byName)"),
  M("alphabetical order removed", "found.slice(0, L.max).sort(byName)", "found.slice(0, L.max)"),
  M("frame: every canon 'wrote'", "(OWN_WORDS.has(String(thinker?.handle ?? \"\")) ? TEMPLATES.wrote : TEMPLATES.records)", "(true ? TEMPLATES.wrote : TEMPLATES.records)"),
  M("frame: no canon 'wrote'", "(OWN_WORDS.has(String(thinker?.handle ?? \"\")) ? TEMPLATES.wrote : TEMPLATES.records)", "(false ? TEMPLATES.wrote : TEMPLATES.records)"),
  M("line: several threshold 2 -> 3", "n >= 2 ? TEMPLATES.several()", "n >= 3 ? TEMPLATES.several()"),
  M("line: one -> several", "n === 1 ? TEMPLATES.one()", "n === 1 ? TEMPLATES.several()"),
  M("line names the first voice", "several: () => \"Several voices bear on this.", "several: () => \"Mozi is the best of the voices that bear on this."),
  M("short giver: parentheses kept", ".replace(/\\s*\\([^)]*\\)?/g, \"\")", ""),
  M("short giver: comma tail kept", ".split(\",\")[0]", ".split(\"\\u0000\")[0]"),
  M("candidate dedupe removed", "if (!handle || seen.has(handle)) continue;", "if (!handle) continue;"),
  M("unknown thinker accepted", "if (!thinker) {", "if (false) {"),
  M("throwing canon reader unguarded", "try { canon = canonOf(handle, thinker); } catch (e) { considered.push({ handle, ok: false, why: \"canon_unreadable\" }); continue; }", "canon = canonOf(handle, thinker);"),
  M("section heuristic disabled", "section: text ? sectionAt(", "section: false ? sectionAt("),
  M("rank: stems-first sort dropped", "b.k - a.k || a.far - b.far || a.id - b.id", "a.id - b.id"),
  M("verify: slice check removed", "canon.text.slice(s.start, s.end) !== v.quote", "false"),
  M("verify: bank-row check removed", "} else if (!(canon.rows || []).some((r) => r.start === s.start && r.end === s.end && r.text === v.quote)) bad.push", "} else if (false) bad.push"),
  M("verify: frame check removed", "if (v.frame !== frameFor(th))", "if (false)"),
  M("verify: line check removed", "if (result.line !== lineFor(vs.length))", "if (false)"),
  M("verify: alphabetical check removed", "if (vs.length && vs.some((v, i) => i && byName(vs[i - 1], v) > 0))", "if (false)"),
  M("verify: max check removed", "if (vs.length > L.max)", "if (false)"),
  M("verify: duplicate thinker check removed", "if (new Set(vs.map((v) => v.handle)).size !== vs.length)", "if (false)"),
  M("verify: giver-short check removed", "if (v.giver !== shortGiver(th) || /[\\d()]/.test(v.giver) || v.giver.length > 30)", "if (false)"),
  M("verify: sha check removed", "if (!canon || canon.sha256 !== th.source.sha256 || s.sha256 !== th.source.sha256 || s.path !== th.source.path)", "if (!canon)"),
  M("verify: unknown thinker accepted", "if (!th) { bad.push({ why: \"unknown_thinker\", handle: v.handle }); continue; }", "if (!th) continue;"),
  M("calls counter lies", "considered, calls: 0 };\n}", "considered, calls: 1 };\n}"),
];
const run = () => { const r = spawnSync(process.execPath, ["--test", "fold-chat-voices.test.mjs"], { cwd: ROOT, env: { ...process.env, VOICES_MODULE: MUTNAME }, encoding: "utf8" }); return { code: r.status, out: r.stdout + r.stderr }; };
const rows = [];
try {
  for (const m of MUTANTS) {
    if (!SRC.includes(m.from)) { rows.push({ name: m.name, status: "NOT-APPLIED (pattern absent)" }); continue; }
    fs.writeFileSync(MUT, SRC.replace(m.from, m.to));
    const r = run();
    const fails = (/ℹ fail (\d+)/.exec(r.out) || [])[1];
    rows.push({ name: m.name, status: r.code !== 0 ? "killed" : "SURVIVED", failing: fails ? +fails : null });
  }
  // layered pair: bearsOn AND verifyNumber both removed
  fs.writeFileSync(MUT, SRC.replace("if (found.length >= L.max) break;", "").replace("found.slice(0, L.max).sort(byName)", "found.sort(byName)"));
  { const r = run(); rows.push({ name: "PAIR: both max-3 caps removed", status: r.code !== 0 ? "killed" : "SURVIVED" }); }
  fs.writeFileSync(MUT, SRC.replace("if (!bearsOn(question, s.text, fw).ok) continue;", "").replace("if (!v.ok) continue;", ""));
  { const r = run(); rows.push({ name: "PAIR: bearsOn + verifyNumber both removed", status: r.code !== 0 ? "killed" : "SURVIVED" }); }
} finally { fs.rmSync(MUT, { force: true }); }
for (const r of rows) console.log(r.status.padEnd(10), r.name, r.failing != null ? `(${r.failing} failing)` : "");
const killed = rows.filter((r) => r.status === "killed").length;
console.log(`\n${killed}/${rows.length} killed; survived: ${rows.filter((r) => r.status === "SURVIVED").map((r) => r.name).join("; ") || "none"}; not applied: ${rows.filter((r) => r.status.startsWith("NOT")).map((r) => r.name).join("; ") || "none"}`);
fs.writeFileSync(path.join(ROOT, "eval/ants/c2/c2-mutate-results.json"), JSON.stringify(rows, null, 1));
