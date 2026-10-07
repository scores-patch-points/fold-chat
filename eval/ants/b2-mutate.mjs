#!/usr/bin/env node
// eval/ants/b2-mutate.mjs — mutation check of fold-chat-counsel.js: each gate is deleted in a COPY (fold-chat-counsel.mut.js, removed afterwards) and the test file is run against it; a surviving mutant is a gate no test needs.
//   node eval/ants/b2-mutate.mjs
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = fs.readFileSync(path.join(ROOT, "fold-chat-counsel.js"), "utf8");
const MUT = path.join(ROOT, "fold-chat-counsel.mut.js");
// [layered] = a defence that another layer duplicates, so alone it is an equivalent mutant (the combined mutant below it kills); a mutation is [name, from, to] or [name, [from,to], [from,to], ...] (several edits at once: a defence that is deliberately layered is only a real mutant when every layer is removed)
const M = [
  ["gate: stem beyond the question (the lexical trap)", 'if (!sharedNovel.length) return { ok: false, why: "shares_only_the_questions_words" };', ""],
  ["gate: question restated adds nothing", 'if (!novel.length) return { ok: false, why: "no_content_beyond_the_question" };', ""],
  ["gate: coverage (all stems or >= 60%)", "if (!allOf && !(shared.length >= minShared && shared.length / all.length >= coverageMin))", "if (false)"],
  ["gate: minShared floor", "shared.length >= minShared && shared.length / all.length >= coverageMin", "shared.length / all.length >= coverageMin"],
  ["gate: figures", 'if (missing.length) return { ok: false, why: "figure_missing:" + missing.join(",") };', ""],
  ["gate: negation parity", 'if (negated(assertion) !== negated(sentence)) return { ok: false, why: "polarity_differs" };', ""],
  ["gate: frame/giver words not counted as content", "const all = [...new Set(stemsOf(assertion, fw))].filter((s) => !skip.has(s));", "const all = [...new Set(stemsOf(assertion, fw))];"],
  ["turn: the gate is not enforced on the pointer", "if (v.ok && gate.ok) {", "if (v.ok) {"],
  ["turn: verifyNumber is not enforced", "if (v.ok && gate.ok) {", "if (gate.ok || true) {"],
  ["turn: gate runs on the model's number only if it names a candidate (candidate text = canon slice) [layered]", "text: text ? text.slice(c.start, c.end) : c.text, n: i + 1", "text: c.text, n: i + 1"],
  ["turn: caller's forged candidate is dropped", "material = material.filter((m) => text.slice(m.start, m.end) === m.text);", "void 0;"],
  ["turn: abort from the pointer propagates", 'catch (e) { if (isAbort(e)) throw e; verdict = { tied: false, why: "call_failed:"', 'catch (e) { verdict = { tied: false, why: "call_failed:"'],
  ["turn: abort from the draft propagates", 'catch (e) { if (isAbort(e)) throw e; return done([], { why: "draft_failed:"', 'catch (e) { return done([], { why: "draft_failed:"'],
  ["turn: a pre-aborted signal stops before a call", "if (signal?.aborted) throw abortError();", ""],
  ["turn: no canon -> refused", 'if (!text && !given.length) return done([], { refused: true, why: "no_verified_canon" });', ""],
  ["turn: a NOTHING/empty draft ends the turn", 'if (!texts.length) return done([], { why: "draft_made_no_assertion" });', ""],
  ["turn: pointer 'none' is final", '["none", "unparsed", "no_such_sentence"].includes(v.why)', "false"],
  ["turn: the rejected pick is withdrawn before the retry", "const rest = candidates.filter((c) => c.n !== picked?.n).map((c, i) => ({ ...c, n: i + 1 }));", "const rest = candidates.map((c, i) => ({ ...c, n: i + 1 }));"],
  ["turn: BOTH layers that keep a forged candidate out (re-slice + filter)", ["text: text ? text.slice(c.start, c.end) : c.text, n: i + 1", "text: c.text, n: i + 1"], ["material = material.filter((m) => text.slice(m.start, m.end) === m.text);", ""]],
  ["split: quotation marks stripped from the model's assertion", 'let x = s.replace(QUOTES_RE, "")', "let x = s"],
  ["split: NOTHING is no assertion", "if (!t || /^\\W*NOTHING\\b/i.test(t)) return [];", "if (!t) return [];"],
  ["split: questions are not assertions", "|| /\\?$/.test(x)) continue;", ") continue;"],
  ["narrate: only tied assertions are narrated", "const tied = (assertions || []).filter((a) => a.tied && a.pointer);", "const tied = (assertions || []).filter((a) => a.pointer || a.text);"],
  ["narrate: the model's reading has the app's prefix", "`My reading of that, not ${giver}'s words: ${text}`", "`${text}`"],
  ["verify: quote is the canon's slice [layered]", 'if (!Number.isInteger(part.start) || !Number.isInteger(part.end) || src.slice(part.start, part.end) !== part.text) bad.push({ why: "quote_not_canon_slice"', 'if (false) bad.push({ why: "quote_not_canon_slice"'],
  ["verify: every app part is a rendering of the assertions", 'bad.push({ why: "not_the_rendering_of_the_assertions" });', "void 0;"],
  ["verify: withheld text must not be in the narration [layered]", 'if (!a.tied && a.text && n.text.includes(a.text)) bad.push({ why: "withheld_text_in_narration"', 'if (false) bad.push({ why: "withheld_text_in_narration"'],
  ["verify: a tied pointer is the canon's slice", 'src.slice(p.start, p.end) !== p.quote) bad.push({ why: "pointer_not_the_canons_slice"', 'false) bad.push({ why: "pointer_not_the_canons_slice"'],
  ["verify: unknown part kinds [layered]", 'else if (part.kind !== "app") bad.push({ why: "unknown_part_kind", kind: part.kind });', ""],
  ["verify: ALL the narration checks removed (quote slice, rendering, withheld leak, kinds)", ['if (!Number.isInteger(part.start) || !Number.isInteger(part.end) || src.slice(part.start, part.end) !== part.text) bad.push({ why: "quote_not_canon_slice"', 'if (false) bad.push({ why: "quote_not_canon_slice"'], ['bad.push({ why: "not_the_rendering_of_the_assertions" });', "void 0;"], ['if (!a.tied && a.text && n.text.includes(a.text)) bad.push({ why: "withheld_text_in_narration"', 'if (false) bad.push({ why: "withheld_text_in_narration"'], ['else if (part.kind !== "app") bad.push({ why: "unknown_part_kind", kind: part.kind });', ""], ['if (n.text !== want.text) bad.push({ why: "text_not_the_join_of_the_parts" });', ""]],
  ["narrate: a copied quote shows no reading", "if (!sameAsQuote(a.text, a.pointer.quote)) g.readings.push(a.text);", "g.readings.push(a.text);"],
  ["split: the giver's label is stripped", 'if (label) x = x.replace(label, "").trim();', ""],
  ["canon: a single newline is not a sentence end", "/[.!?][\"')\\]”’]*(?=\\s)|\\n[ \\t]*\\n/g", "/[.!?][\"')\\]”’]*(?=\\s)|\\n/g"],
  ["canon: an abbreviation/initial does not end a sentence", 'if (m[0][0] === "." && (ABBR.has(word) || /^\\p{L}$/u.test(word))) continue;', ""],
  ["canon: scan debris is not quotable", "if (/[\\^|_{}<>\\\\]/.test(s)) return false;", ""],
];
let killed = 0; const survivors = [];
for (const [name, ...edits0] of M) {
  const edits = Array.isArray(edits0[0]) ? edits0 : [edits0];
  let out = SRC, missing = false;
  for (const [from, to] of edits) { if (!out.includes(from)) missing = true; out = out.replace(from, to); }
  if (missing) { console.log("NOT FOUND (fix the runner):", name); survivors.push(name + " [pattern missing]"); continue; }
  fs.writeFileSync(MUT, out);
  const r = spawnSync(process.execPath, ["--test", "fold-chat-counsel.test.mjs"], { cwd: ROOT, env: { ...process.env, COUNSEL_MODULE: "fold-chat-counsel.mut.js" }, encoding: "utf8" });
  const failed = r.status !== 0;
  const which = [...(r.stdout || "").matchAll(/^✖ (.{0,70})/gm)].map((m) => m[1]).slice(0, 2);
  const layered = /\[layered\]$/.test(name);
  console.log((failed ? "KILLED  " : layered ? "LAYERED " : "SURVIVED") + " " + name + (failed ? "   <- " + which.join(" | ") : ""));
  if (failed) killed++; else if (!layered) survivors.push(name);
}
fs.rmSync(MUT, { force: true });
console.log(`\n${killed}/${M.length} mutants killed; survivors: ${survivors.length ? "\n  " + survivors.join("\n  ") : "none"}`);
