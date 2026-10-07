// eval/ants/c7/audit.mjs — C7 audit: call the REAL functions over REAL data (eval/voice/threads.json: the real page, gemma2:2b, stored spoken answers).
//   node eval/ants/c7/audit.mjs > eval/ants/c7/audit-output.txt
// Pre-registered in eval/ants/C7-PREREG.md (A1-A6). No model is called.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathosOf } from "../../../vendor/khora/native/organs/pathos.js";
import { readFelt } from "../../../fold-chat-pathos.js";
import { carryOf } from "../../../fold-chat-carry.js";
import { admitReferents, emptyReferents } from "../../../fold-chat-mind.js";
import { cuesFor, actOf } from "../../../fold-chat-flow.js";
import { door } from "../../../fold-chat-gary.js";
import { runAgent, repairPrompt, withBase } from "../../../fold-chat-agent.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..", "..");
const T = JSON.parse(fs.readFileSync(path.join(ROOT, "eval/voice/threads.json"), "utf8")).threads;
const out = (...a) => console.log(...a);
const short = (s, n = 90) => String(s).replace(/\s+/g, " ").slice(0, n) + (String(s).length > n ? "…" : "");

// ── A3: pathosOf on 5 real spoken answers ───────────────────────────────────────────────────────────────────────────────
out("== A3  pathosOf on 5 real model-authored answers (declared experiencer = the model that wrote them, as fold-chat-pathos.js declares it)");
const picks = [["R1", 3], ["R2", 5], ["R3", 3], ["R5", 3], ["R2", 1]].map(([k, i]) => ({ k, m: T[k].messages[i] }));
let measured = 0, nonReport = 0;
for (const { k, m } of picks) {
  const r = pathosOf({ text: m.content, experiencer: { who: "model:" + m.model, read: "conversation:" + k } });
  if (r.curve.measured) measured++;
  if (r.strain !== "report") nonReport++;
  out(`[${k}] "${short(m.content, 80)}"`);
  out("     forWhom=" + JSON.stringify(r.forWhom) + "  rhythm=" + JSON.stringify(r.rhythm) + "  strain=" + r.strain + "  curve.measured=" + r.curve.measured + (r.curve.unmeasured ? "  (" + r.curve.unmeasured + ")" : ""));
}
out(`A3 result: curve measured on ${measured}/5 ; strain != "report" on ${nonReport}/5`);
// a refusal check: no experiencer
try { pathosOf({ text: "x y z." }); out("pathosOf with no experiencer: NOT refused (!)"); } catch (e) { out("pathosOf with no experiencer: refused ->", String(e.message).slice(0, 100)); }

// ── A2: readFelt at the prompt of each turn of the 8 real threads ──────────────────────────────────────────────────────
out("\n== A2  what the chat's readFelt hands the model at turn N (messages BEFORE the ask, as fold-chat.js:2114 slices them)");
let felt = 0, slots = 0;
for (const [k, th] of Object.entries(T)) {
  const msgs = th.messages;
  const row = [];
  for (let askAt = 0; askAt < msgs.length; askAt += 2) {          // askAt = index of the user ask
    const r = readFelt(msgs.slice(0, askAt), { convo: k });
    slots++;
    if (r.felt) felt++;
    row.push(`t${askAt / 2 + 1}:${r.gap || ("felt:" + r.condition)}`);
  }
  // one step past the thread: a 4th ask would see all 3 answers
  const r4 = readFelt(msgs, { convo: k });
  row.push(`t4(hypothetical):${r4.gap || ("felt:" + r4.condition + (r4.cue ? " cue=" + JSON.stringify(r4.cue) : ""))}`);
  out(`[${k}] ${row.join("  ")}`);
}
out(`A2 result: a felt reading existed at ${felt}/${slots} real prompts`);

// ── what the model is handed today, assembled by the chat's own cuesFor + Gary's door ──────────────────────────────────
out("\n== the cue facts the chat adds to the prompt (cuesFor: Terry Gross' act cue + the pathos cue), for each real ask of R1..R5");
for (const k of ["R1", "R2", "R3", "R4", "R5"]) {
  const msgs = T[k].messages;
  const ask = msgs[4].content;
  const r = readFelt(msgs.slice(0, 4), { convo: k });
  const c = cuesFor({ act: actOf(ask), felt: r.felt, pathosCue: r.cue, door });
  out(`[${k}] ask="${short(ask, 60)}" act=${c.act} felt=${JSON.stringify(r.felt)} cues=${JSON.stringify(c.cues.map((x) => x.from + ": " + short(x.text, 80)))}`);
}

// ── A6 / Atmosphere + Lens as the chat computes them (carryOf over the real transcript) ────────────────────────────────
out("\n== Atmosphere + Lens as carryOf computes them from the real threads (referents admitted turn by turn as fold-chat.js:2539 does, no sources recorded)");
for (const k of ["R1", "R3", "L1", "L3"]) {
  const msgs = T[k].messages;
  let rec = emptyReferents();
  for (let i = 0; i < msgs.length; i += 2) rec = admitReferents(rec, { question: msgs[i].content, answer: msgs[i + 1]?.content || "", sources: [] });
  const c = carryOf({ messages: msgs, referents: rec, summary: { records: [] } }, { question: msgs[msgs.length - 2].content });
  out(`[${k}] entities=${JSON.stringify(c.entities.slice(0, 4))} active=${JSON.stringify(c.active)} basis="${short(c.basis, 120)}"`);
  out(`     text=${JSON.stringify(short(c.text, 240))}`);
}
out("A6: carryOf calls lensBlock with notes: [] and never calls paradigmBlock (fold-chat-carry.js:66; grep below).");

// ── A1: the agent lane's exact prompts ─────────────────────────────────────────────────────────────────────────────────
out("\n== A1  every prompt runAgent builds, captured through a fake door (the real runAgent, the real planFor/repairPrompt/withBase)");
const TASK = "Build a tip calculator page with 10%, 15% and 20% tip buttons and a Save button.";
const prompts = [];
const BAD_PAGE = "const total = 0; export function tip(){ return total }";
const res = await runAgent({
  task: TASK, maxRounds: 3,
  dispatch: async (prompt, o) => { prompts.push({ round: o.round, prompt }); return { sessionId: "s1", text: BAD_PAGE, lane: "penelope-code-agent", ms: 5 }; },
  observe: async () => ({ checks: [{ name: "loads", ok: true }, { name: "renders", ok: false, detail: "the page is blank" }] }),
  read: async () => ({ referents: [{ text: "tip calculator" }], relations: [], gaps: [] }),
});
for (const p of prompts) out(`--- dispatch prompt, round ${p.round} (${p.prompt.length} chars) ---\n${p.prompt}`);
out("--- first prompt from a reset base (withBase) ---\n" + withBase("make the buttons blue", { code: "<!doctype html><button>10%</button>", kind: "html" }));
out("--- repairPrompt direct ---\n" + repairPrompt({ task: TASK, round: 2, findings: ["renders: the page is blank"] }));
const plan = res.events.find((e) => e.type === "plan");
out("--- plan event the person sees ---\n" + plan.steps.map((s) => "  - " + s).join("\n"));
const ETHOS_RE = /atmosphere|lens|paradigm|pathos|ethos|archon|flat|rhythm|ground|conversation|reminds me|wrote about/i;
const hits = prompts.filter((p) => ETHOS_RE.test(p.prompt));
out(`A1 result: ${prompts.length} prompts built; ${hits.length} contain any ethos/pathos/atmosphere/archon vocabulary`);
if (hits.length) for (const h of hits) out("   hit in round", h.round, ETHOS_RE.exec(h.prompt)[0]);
// the remote lane's fixed system + parts (fold-chat-client.js:918 REMOTE_CODE_SYSTEM) — read from source, not re-typed
const cs = fs.readFileSync(path.join(ROOT, "fold-chat-client.js"), "utf8");
const sys = /const REMOTE_CODE_SYSTEM = "([^"]*)"/.exec(cs)[1];
out("--- remoteCode system message (fold-chat-client.js REMOTE_CODE_SYSTEM) ---\n" + sys);
out("    ethos/pathos vocabulary in it: " + (ETHOS_RE.test(sys) ? "YES" : "none"));
out("--- what pathos WOULD read over those rounds: the events the agent emits are impersonal; e.g. the rounds' findings sentences ---");
out(JSON.stringify(res.rounds.map((r) => ({ n: r.n, kind: r.kind, findings: r.findings })), null, 1));
