// eval/ants/c7/wiring-check.mjs — what the NOT-APPLIED diffs would change, checked on the real threads and on the patched agent loop.
//   (1) chat lane: the replacement block hands cuesFor exactly what readFelt handed it (same felt, same cue, same gap) on every real prefix of the 8 real threads;
//   (2) agent loop (patched copy of fold-chat-agent.js, passed as AGENT_MODULE): the code model's prompts are byte-identical with and without `ethos`, a `contested` condition escalates the maker, and nothing is escalated when no ethos is given.
//   node eval/ants/c7/wiring-check.mjs          (AGENT_MODULE=<abs path of the patched fold-chat-agent.js> for part 2)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFelt } from "../../../fold-chat-pathos.js";
import { ethosFor, laneOf } from "../../../fold-chat-ethos.js";
import { emptyReferents } from "../../../fold-chat-mind.js";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const T = JSON.parse(fs.readFileSync(path.join(ROOT, "eval/voice/threads.json"), "utf8")).threads;
const out = console.log;
let same = 0, total = 0, diff = [];
for (const [k, th] of Object.entries(T)) {
  const full = th.messages.map((m) => (m.role === "assistant" ? { ...m, grounding: { model: m.model } } : m));
  for (let askAt = 0; askAt < full.length; askAt += 2) {
    const before = full.slice(0, askAt);
    const old = readFelt(before, { convo: k, memo: null });
    const eth = ethosFor({ lane: laneOf({ kind: "research" }), kind: "research", session: { messages: full, referents: emptyReferents(), summary: { records: [] } }, messagesBefore: before, question: full[askAt].content, convo: k, memo: null });
    const nu = eth.parts.pathos;
    total++;
    const eq = JSON.stringify([old.felt, old.cue, old.gap, old.condition]) === JSON.stringify([nu.felt, nu.cue, nu.gap, nu.condition]) && (old.gap || JSON.stringify(old.memo) === JSON.stringify(eth.memo));   // on a gap fold-chat.js does not assign s.pathos (`if (feltInfo && !feltInfo.gap)`), so the memo only has to agree when a reading happened
    if (eq) same++; else diff.push(`${k}@${askAt}`);
  }
}
out(`(1) chat lane: ethosFor's pathos == readFelt's on ${same}/${total} real prefixes` + (diff.length ? "; DIFFER: " + diff.join(",") : ""));

if (process.env.AGENT_MODULE) {
  const { runAgent } = await import(process.env.AGENT_MODULE);
  const F_A = "loads: threw ReferenceError x (line 12)", F_B = "renders: the page is blank";
  const script = [[F_A], [F_B], [F_A], [F_A]];
  const run = async (withEthos) => {
    const prompts = [], events = [];
    let call = 0;
    const res = await runAgent({
      task: "Write a function that sums an array of numbers.", maxRounds: 4, emit: (e) => events.push(e),
      ...(withEthos ? { ethos: (rs) => { const e = ethosFor({ lane: "agent", rounds: rs, task: "x", convo: "w" }); const p = e.parts.pathos; return { condition: p?.condition ?? null, run: p?.run ?? null, gap: p?.gap ?? null }; } } : {}),
      dispatch: async (prompt) => { prompts.push(prompt); return { sessionId: "s", text: "const x = 1; export const y = x", lane: "penelope-code-agent", model: "qwen2.5-coder:1.5b", ms: 3 }; },
      escalate: async (prompt) => { prompts.push("[ESCALATED] " + prompt); return { sessionId: null, text: "const x = 1; export const y = x", lane: "sealed-remote", model: "remote-model", ms: 3 }; },
      observe: async () => ({ checks: script[Math.min(call++, 3)].map((f) => ({ name: f.split(":")[0], ok: false, detail: f.split(": ").slice(1).join(": ") })) }),
    });
    return { prompts, events, res };
  };
  const a = await run(false), b = await run(true);
  out("(2) agent loop, same fake door, flip-flop findings A,B,A,A (a function ask, 4 rounds):");
  out("    prompts without ethos:", a.prompts.length, "| with ethos:", b.prompts.length);
  const strip = (p) => p.replace(/^\[ESCALATED\] /, "");
  out("    prompt texts identical (ignoring the escalation marker):", JSON.stringify(a.prompts.map(strip)) === JSON.stringify(b.prompts.map(strip)));
  out("    pathos events:", JSON.stringify(b.events.filter((e) => e.type === "pathos").map((e) => ({ round: e.round, condition: e.condition, run: e.run, gap: e.gap }))));
  out("    escalations without ethos:", JSON.stringify(a.events.filter((e) => e.type === "escalate").map((e) => e.why)), "| with ethos:", JSON.stringify(b.events.filter((e) => e.type === "escalate").map((e) => e.why)));
  const eth = (b.prompts.join("\n")).match(/pathos|flat|contested|conversation|atmosphere|rhythm/i);
  out("    any ethos/pathos vocabulary in any prompt sent with ethos on:", eth ? eth[0] : "none");
  out("    result ok/exhausted (with / without):", b.res.ok, b.res.exhausted, "/", a.res.ok, a.res.exhausted);
}
