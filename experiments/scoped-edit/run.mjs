// run.mjs — the scoped-edit experiment against a REAL model through heimdall's sealed gate.
//
//   node run.mjs [--k 3] [--only T3,T5b] [--conds FULL,SCOPED,FILE,ORACLE] [--model openai-fast]
//
// For every (task × condition × sample): build the context the condition allows, ask the model for
// edits, apply them with the same parser the agent uses, then run the REAL tests (with the task's
// hidden tests laid over the result) in a scratch copy. Results append to results.jsonl and a rerun
// skips what is done, so the app quitting never costs the experiment.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { scoreAnswer } from "./score.mjs";
import { scopeFor, renderScope, renderFull } from "../../fold-chat-scope.js";
import { chat } from "../../fold-chat-client.js";
import { loadFixture, runTests, HERE } from "./harness.mjs";
import { TASKS } from "./tasks.mjs";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i >= 0 ? process.argv[i + 1] : d; };
const K = +arg("k", 3), ONLY = (arg("only", "") || "").split(",").filter(Boolean), CONDS = (arg("conds", "FULL,SCOPED1,SCOPED2,FILE,ORACLE")).split(",");
const MODEL = arg("model", "openai-fast"), FALLBACK = "GLM-5.3-Flash", BASE = arg("base", "http://127.0.0.1:8795"), CONC = +arg("conc", 1);
const BUDGET = +arg("budget", 3500), OUT = join(HERE, arg("out", "results.jsonl"));

const SYSTEM = `You are a careful engineer editing a codebase. Make the smallest correct change that does what the task asks. Return ONLY edits — no explanation, no commentary.
To change an existing file, use SEARCH/REPLACE blocks: the file path on its own line, then
<<<<<<< SEARCH
(exact existing text to replace, copied from the file)
=======
(the new text)
>>>>>>> REPLACE
To create a new file, use one fenced code block whose info string is path=<file path>.
Do not edit test files.`;

const files = loadFixture();
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(16); };

function contextFor(cond, t) {
  const src = (list) => list.map((p) => `### ${p}\n\`\`\`\n${files[p]}\n\`\`\``).join("\n\n");
  if (cond === "FULL") return { text: renderFull(files), files: Object.keys(files) };
  if (cond === "SCOPED1" || cond === "SCOPED2") {
    const s = scopeFor(files, t.task, { budget: BUDGET, maxFiles: 8, legacy: cond === "SCOPED1" });
    return { text: renderScope(files, s), files: s.include.map((x) => x.path), scope: s };
  }
  if (cond === "FILE") return { text: t.primary.length ? src(t.primary) : "(no existing code is shown — this task creates a new file)", files: t.primary };
  if (cond === "ORACLE") return { text: src(t.oracle), files: t.oracle };
  throw new Error("unknown condition " + cond);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The free endpoints rate-limit hard (measured: 53 of 58 requests got HTTP 429 at concurrency 3). Pace the
// whole experiment through ONE gate — a minimum gap between request starts — and treat a throttled or empty
// reply as "ask again later", never as a result about the model.
const GAP_MS = +arg("gap", 14000);
let nextSlot = 0;
async function gate() { const now = Date.now(); const at = Math.max(now, nextSlot); nextSlot = at + GAP_MS; if (at > now) await sleep(at - now); }
async function ask(messages, auditId) {
  const waits = [0, 20000, 40000, 60000, 90000, 120000];
  let last = null, attempts = 0;
  for (let i = 0; i < waits.length; i++) {
    const model = i < 4 ? MODEL : FALLBACK;
    if (waits[i]) await sleep(waits[i]);
    await gate(); attempts++;
    try { const out = await chat(model, messages, { base: BASE, privacy: "sealed-external", temperature: 0.2, maxTokens: 3500, totalTimeoutMs: 150000, audit: { id: auditId + "-a" + attempts } }); if (out.text.trim()) return { text: out.text, model, attempts }; last = new Error("empty answer (throttled)"); }
    catch (e) { last = e; }
  }
  throw last || new Error("model failed");
}

const done = new Map();
if (existsSync(OUT)) for (const l of readFileSync(OUT, "utf8").split("\n").filter(Boolean)) { const r = JSON.parse(l); if (String(r.err || "").startsWith("model-error")) continue; done.set(`${r.task}|${r.cond}|${r.k}`, r); }

const jobs = [];
for (const t of TASKS) { if (ONLY.length && !ONLY.some((o) => t.id.startsWith(o))) continue; for (const cond of CONDS) for (let k = 0; k < K; k++) if (!done.has(`${t.id}|${cond}|${k}`)) jobs.push({ t, cond, k }); }
console.log(`${jobs.length} runs to do (${done.size} already done) · model ${MODEL} · budget ${BUDGET} · concurrency ${CONC}`);

async function runOne({ t, cond, k }) {
  const ctx = contextFor(cond, t);
  const messages = [{ role: "system", content: SYSTEM }, { role: "user", content: `${t.task}\n\n# The code you may see\n${ctx.text}` }];
  const promptChars = messages.reduce((n, m) => n + m.content.length, 0);
  const ctxHash = hash(JSON.stringify(messages));
  // identical prompt already answered for this (task, sample) → the same draw, not a new one
  for (const r of done.values()) if (r.task === t.id && r.k === k && r.ctxHash === ctxHash) { const copy = { ...r, cond, reusedFrom: r.cond }; appendFileSync(OUT, JSON.stringify(copy) + "\n"); done.set(`${t.id}|${cond}|${k}`, copy); return copy; }
  const auditId = `se-${t.id}-${cond}-${k}-${Date.now().toString(36)}`;
  const rec = { task: t.id, cond, k, ctxHash, promptChars, ctxFiles: ctx.files, ctxFileCount: ctx.files.length, auditId, model: null, err: null, edits: 0, applied: 0, failedEdits: [], notes: [], ok: false, tests: null, ms: 0, answer: "" };
  const t0 = Date.now();
  try {
    const { text, model, attempts } = await ask(messages, auditId);
    rec.model = model; rec.attempts = attempts; rec.answer = text.slice(0, 40000); rec.answerChars = text.length;
    Object.assign(rec, scoreAnswer(t, files, text, ctx.files));
  } catch (e) { rec.err = "model-error: " + String(e.message).slice(0, 120); }
  rec.ms = Date.now() - t0;
  appendFileSync(OUT, JSON.stringify(rec) + "\n"); done.set(`${t.id}|${cond}|${k}`, rec);
  console.log(`${rec.ok ? "PASS" : "FAIL"} ${t.id.padEnd(22)} ${cond.padEnd(8)} k${k} prompt ${String(promptChars).padStart(5)}ch ${rec.err ? "· " + rec.err : ""} (${(rec.ms / 1000).toFixed(1)}s)`);
  return rec;
}

let next = 0;
await Promise.all(Array.from({ length: CONC }, async () => { while (next < jobs.length) await runOne(jobs[next++]); }));
console.log("done →", OUT);
