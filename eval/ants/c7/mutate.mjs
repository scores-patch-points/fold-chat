// eval/ants/c7/mutate.mjs — mutation check for fold-chat-ethos.js: delete / invert each pre-registered gate in a COPY (fold-chat-ethos.mut.js, removed after), run the same test file against it; every mutant must be killed.
//   node eval/ants/c7/mutate.mjs
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SRC = fs.readFileSync(path.join(ROOT, "fold-chat-ethos.js"), "utf8");
const MUT = path.join(ROOT, "fold-chat-ethos.mut.js");
// [name, gate, from (exact text in the module), to]
const M = [
  ["N5 directive gate deleted", "N5", 'if (DIRECTIVE.test(t)) return { ok: false, why: "directive" };', ""],
  ["N3 score gate deleted (facts)", "N3", 'if (SCORE.test(t)) return { ok: false, why: "score" };', ""],
  ["N5 apparatus-name gate deleted", "N5", 'if (APPARATUS.test(t)) return { ok: false, why: "apparatus_name" };', ""],
  ["N5 vendored apparatus ban deleted", "N5", 'if (bannedHits(t).length) return { ok: false, why: "apparatus:" + bannedHits(t).join(",") };', ""],
  ["N1 speaks-as gate deleted", "N1", 'if (AS_HOLDER.test(t)) return { ok: false, why: "speaks_as" };', ""],
  ["N1 holder-name gate deleted", "N1", 'for (const n of names) if (n && low.includes(String(n).toLowerCase())) return { ok: false, why: "names_a_holder:" + n };', ""],
  ["N2 quote re-verification deleted", "N2", "if (!quoteIsVerbatim(a, voice)) return { none: \"quote_not_verbatim\" };", ""],
  ["N2 verbatim checker always true", "N2", "export function quoteIsVerbatim(aside, { texts = null, bank = null } = {}) {", "export function quoteIsVerbatim(aside, { texts = null, bank = null } = {}) { return true;"],
  ["N1 frame check deleted", "N1", 'if (a.text !== frameOf(a)) return { none: "frame_altered" };', ""],
  ["N3 frame score gate deleted", "N3", "if (SCORE.test(frame) || AS_HOLDER.test(frame)) return { none: \"frame_unsafe\" };", ""],
  ["N8 lane none enforced nowhere", "N8", 'if (laneName === "none") return empty("lane:none");', ""],
  ["N8 laneOf ignores modelBarred/slot/strand", "N8", "if (modelBarred || slot || strand) return \"none\";", ""],
  ["N9 agent cuePathos on", "N9", 'agent:   Object.freeze({ atmosphere: true, lens: true,  pathos: true,  aside: true,  cueAtmosphere: false, cuePathos: false,', 'agent:   Object.freeze({ atmosphere: true, lens: true,  pathos: true,  aside: true,  cueAtmosphere: false, cuePathos: true,'],
  ["N9 agent cueAtmosphere on", "N9", 'agent:   Object.freeze({ atmosphere: true, lens: true,  pathos: true,  aside: true,  cueAtmosphere: false,', 'agent:   Object.freeze({ atmosphere: true, lens: true,  pathos: true,  aside: true,  cueAtmosphere: true,'],
  ["N9 agent natural-break rule deleted", "N9", 'if (lane === "agent" && !naturalBreak) return { none: "not_a_natural_break" };', ""],
  ["writing lane pathos cue on", "lane", 'writing: Object.freeze({ atmosphere: true, lens: true,  pathos: false, aside: false, cueAtmosphere: true,  cuePathos: false,', 'writing: Object.freeze({ atmosphere: true, lens: true,  pathos: true, aside: false, cueAtmosphere: true,  cuePathos: true,'],
  ["counsel lane aside on", "lane", 'counsel: Object.freeze({ atmosphere: true, lens: true,  pathos: true,  aside: false,', 'counsel: Object.freeze({ atmosphere: true, lens: true,  pathos: true,  aside: true,'],
  ["N4 pathos gate always off", "N4", "gate: voice.gate !== false,", "gate: false,"],
  ["N6 unverified-maker gate deleted", "N6", 'if (!makers.length) return { text: "", who: null, rounds: rs.length, cycles: 0, repeats: 0, gap: "unverified_maker" };', ""],
  ["N6 too-few-rounds gate deleted", "N6", 'if (rs.length < ETHOS.minRounds) return { text: "", who: null, rounds: rs.length, cycles: 0, repeats: 0, gap: "too_few_rounds" };', ""],
  ["strain: cycles not counted", "N6", "if (first >= 0 && gone > first && at.indexOf(true, gone + 1) > gone) cycles++;", ""],
  ["repeats not counted", "N6", "if (at.filter(Boolean).length >= 2) repeats++;", ""],
  ["N10 curve gap not said", "N10", 'else gaps.push({ part: "pathos.curve",', 'else void ({ part: "pathos.curve",'],
  ["N10 paradigm gap not said", "N10", 'gaps.push({ part: "paradigm", why: "no ledger notes on this pipeline (needs resolved referents and acts at sentence grain)" });', ""],
  ["N10 curve input status claims measured", "N10", '"gap: unmeasured — no reader fold is run over this lane, so collapse cannot fire"', '"measured"'],
  ["N7 purity: a clock reaches the module", "N7", "const sentence = (s) =>", "const _t = Date.now(); const sentence = (s) =>"],
  ["N7 purity: input mutated", "N7", "const L = ETHOS.lanes[lane] || ETHOS.lanes.none;", "const L = ETHOS.lanes[lane] || ETHOS.lanes.none; if (session && session.messages) session.messages.push({ role: 'user', content: 'x' });"],
  ["N5 cues not vetted", "N5", "const v = vetFact(text, { names: names2 }); if (v.ok)", "const v = { ok: true }; if (v.ok)"],
  ["N6 experiencer label trusted (chat): readFelt replaced", "N6", "else pathos = readFelt(messagesBefore ?? sess?.messages ?? [], { convo, memo });", "else pathos = readFelt((messagesBefore ?? sess?.messages ?? []).map((m) => ({ ...m, grounding: { model: m.who || m.grounding?.model } })), { convo, memo });"],
  ["address struck: carry basis bug left in", "N10", "String(c.basis || \"\").replace(/\\s*·?\\s*\\[object Object\\]/g, \"\").trim()", "String(c.basis || \"\")"],
];
let killed = 0; const survived = [];
try {
  for (const [name, gate, from, to] of M) {
    if (!SRC.includes(from)) { console.log(`?? ${name}: pattern not found in the module (mutant not applied)`); survived.push(name + " [not applied]"); continue; }
    fs.writeFileSync(MUT, SRC.replace(from, to));
    const r = spawnSync(process.execPath, ["--test", "fold-chat-ethos.test.mjs"], { cwd: ROOT, env: { ...process.env, ETHOS_MODULE: "./fold-chat-ethos.mut.js" }, encoding: "utf8" });
    const dead = r.status !== 0;
    console.log(`${dead ? "killed  " : "SURVIVED"} [${gate}] ${name}`);
    if (dead) killed++; else survived.push(name);
  }
} finally { fs.rmSync(MUT, { force: true }); }
console.log(`\n${killed}/${M.length} mutants killed` + (survived.length ? "; survivors: " + survived.join(" | ") : ""));
process.exit(survived.length ? 1 : 0);
