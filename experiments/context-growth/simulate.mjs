// simulate.mjs — what each DESIGN puts in the context, call by call, on the same tasks, with REAL file
// contents and REAL test output. No model is called, so this measures the architecture, not a model:
//
//   naive  a Claude-Code-style loop. Every message — tool calls, whole-file reads, test output — is appended
//          and re-sent on every later call. The system prompt + tool schemas ride along every time.
//   fold   stateless scoped steps. Each call carries the ask, the mechanically scoped files, an outline of the
//          rest. Nothing from earlier calls is re-sent; the tests run locally and only a failure is shown.
//
// The naive trajectory is a deliberately SHORT, competent one (list → read → edit → test → answer, with reads
// batched into one turn). Real sessions took hundreds of turns (see real-sessions.json), so this UNDERSTATES
// the naive design — it is a lower bound.
import { writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync as wf, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { loadFixture, withHiddenTests } from "../scoped-edit/harness.mjs";
import { TASKS } from "../scoped-edit/tasks.mjs";
import { scopeFor, renderScope } from "../../fold-chat-scope.js";
import { diffLines } from "../../fold-chat-workspace.js";

const CAL = JSON.parse(readFileSync(new URL("./calibration.json", import.meta.url)));
const CPT = { code: CAL.code.chars_per_token, prose: CAL.prose.chars_per_token };     // measured through a real tokenizer
const tok = (s, kind = "code") => Math.ceil(String(s).length / CPT[kind]);
const SYSTEM_TOKENS = +(process.argv.find((a) => a.startsWith("--system="))?.slice(9) ?? 16000);   // Claude Code's system prompt + tool schemas (assumption, flagged in the report)
const FOLD_SYSTEM = tok("You are a careful engineer editing a codebase. Make the smallest correct change. Return ONLY edits as SEARCH/REPLACE blocks or a fenced block with path=…. Do not edit test files.", "prose") + 60;
const PRICE = { in: 3, out: 15, cacheRead: 0.3, cacheWrite: 3.75 };                     // USD / M tokens — an ASSUMPTION for a Sonnet-class model

const files = loadFixture();
const numbered = (t) => t.split("\n").map((l, i) => String(i + 1).padStart(6) + "\t" + l).join("\n");
const fullTestOutput = (fs) => {
  const dir = mkdtempSync(join(tmpdir(), "sim-"));
  try { for (const [p, c] of Object.entries(fs)) { const f = join(dir, p); mkdirSync(dirname(f), { recursive: true }); wf(f, c); } const r = spawnSync(process.execPath, ["--test"], { cwd: dir, encoding: "utf8", timeout: 30000 }); return (r.stdout || "") + (r.stderr || ""); }
  finally { rmSync(dir, { recursive: true, force: true }); }
};
const editCost = (task) => {   // what the model must WRITE: changed lines (old + new) for edits, whole file for new files
  let out = 0;
  for (const [p, content] of Object.entries(task.golden)) { const before = files[p]; if (before === undefined) { out += tok(content); continue; } const d = diffLines(before, content); out += tok(d.filter((h) => h.op !== "eq").map((h) => h.line).join("\n")) + 40; }
  return out;
};

function naiveCalls(task, carry = []) {
  const goldenFiles = { ...withHiddenTests(files, task), ...task.golden };
  const msgs = [...carry];
  const calls = [];
  const call = (label, outTokens, then) => { calls.push({ label, ctx: SYSTEM_TOKENS + msgs.reduce((n, m) => n + m, 0), out: outTokens }); then(); };
  msgs.push(tok(task.task, "prose") + 8);                                                       // the ask
  call("list files", 40, () => { msgs.push(40); msgs.push(tok(Object.keys(files).sort().join("\n")) + 20); });
  const reads = [...new Set([...task.oracle, ...task.primary])].filter((p) => files[p] !== undefined);
  const readTokens = reads.reduce((n, p) => n + tok(numbered(files[p])) , 0);
  call("read " + (reads.length || 0) + " file(s)", 30 * Math.max(1, reads.length), () => { msgs.push(30 * Math.max(1, reads.length)); msgs.push(readTokens + 12 * reads.length); });
  if (/callers|literals|cause/.test(task.id)) call("grep usages", 40, () => { msgs.push(40); msgs.push(tok(Object.entries(files).filter(([p]) => p.startsWith("src/")).map(([p]) => p + ":1: …").join("\n")) + 30); });
  const wr = editCost(task);
  call("edit", wr, () => { msgs.push(wr); msgs.push(30 * Object.keys(task.golden).length); });
  const to = tok(fullTestOutput(goldenFiles), "prose");
  call("run tests", 30, () => { msgs.push(30); msgs.push(to); });
  call("final answer", 160, () => { msgs.push(160); });
  return { calls, msgs };
}

// WIDENING: when the scope misses a file the edit needs, the step fails and the next step widens the SCOPE
// (budget ×2, then the whole codebase) — it does not jump to a bigger model first. Every failed step is paid for.
function foldCalls(task, { budgets = [3500, 7000, Infinity] } = {}) {
  const calls = []; let recall = "", scopeFiles = 0, scopeChars = 0, widened = 0;
  for (const budget of budgets) {
    const s = scopeFor(files, task.task, { budget: budget === Infinity ? 1e9 : budget, maxFiles: budget === Infinity ? 99 : 8 });
    const body = renderScope(files, s);
    const ctx = FOLD_SYSTEM + tok(task.task, "prose") + tok(body) + 20 + (calls.length ? 60 : 0);      // a failed step leaves a one-line note and the failing test line
    const got = task.oracle.filter((p) => s.include.some((x) => x.path === p));
    calls.push({ label: calls.length ? "widened scope (" + (budget === Infinity ? "everything" : "×2") + ")" : "scoped edit", ctx, out: editCost(task) });
    recall = `${got.length}/${task.oracle.length}`; scopeFiles = s.include.length; scopeChars = s.chars;
    if (got.length === task.oracle.length) break;
    widened++;
  }
  return { calls, recall, scopeFiles, scopeChars, widened };
}

const cost = (calls, cached) => {
  let usd = 0, prev = 0;
  for (const c of calls) {
    if (!cached) usd += (c.ctx * PRICE.in + c.out * PRICE.out) / 1e6;
    else { const hit = Math.min(prev, c.ctx), fresh = c.ctx - hit; usd += (hit * PRICE.cacheRead + fresh * PRICE.cacheWrite + c.out * PRICE.out) / 1e6; prev = c.ctx + c.out; }
  }
  return usd;
};
const sum = (a, f) => a.reduce((n, x) => n + f(x), 0);

const rows = [];
for (const t of TASKS) {
  const n = naiveCalls(t), f = foldCalls(t);
  rows.push({
    task: t.id, label: t.label,
    naive: { calls: n.calls.length, ctxFirst: n.calls[0].ctx, ctxLast: n.calls.at(-1).ctx, inputTokens: sum(n.calls, (c) => c.ctx), outTokens: sum(n.calls, (c) => c.out), usdUncached: cost(n.calls, false), usdCached: cost(n.calls, true), trace: n.calls.map((c) => ({ label: c.label, ctx: c.ctx })) },
    fold: { calls: f.calls.length, widened: f.widened, ctx: f.calls[0].ctx, ctxMax: Math.max(...f.calls.map((c) => c.ctx)), inputTokens: sum(f.calls, (c) => c.ctx), outTokens: sum(f.calls, (c) => c.out), usd: cost(f.calls, false), recall: f.recall, scopeFiles: f.scopeFiles, scopeChars: f.scopeChars },
  });
}

// ONE conversation, all tasks in a row — the way a long agent session actually goes. Naive never forgets; fold resets.
let carry = [], seq = [], foldSeq = [];
for (const t of TASKS) {
  const r = naiveCalls(t, carry); carry = r.msgs;
  for (const c of r.calls) seq.push({ task: t.id, label: c.label, ctx: c.ctx });
  const f = foldCalls(t); for (const c of f.calls) foldSeq.push({ task: t.id, label: c.label, ctx: c.ctx });
}
const session = { naive: seq, fold: foldSeq, naiveInput: sum(seq, (c) => c.ctx), foldInput: sum(foldSeq, (c) => c.ctx), naiveCalls: seq.length, foldCalls: foldSeq.length };

const totals = { naiveInput: sum(rows, (r) => r.naive.inputTokens), foldInput: sum(rows, (r) => r.fold.inputTokens), naiveUsd: sum(rows, (r) => r.naive.usdUncached), naiveUsdCached: sum(rows, (r) => r.naive.usdCached), foldUsd: sum(rows, (r) => r.fold.usd) };
const out = { built: new Date().toISOString(), assumptions: { systemTokens: SYSTEM_TOKENS, foldSystemTokens: FOLD_SYSTEM, charsPerToken: CPT, calibration: "exact counts from a real tokenizer via heimdall (calibration.json)", price: PRICE, naiveTrajectory: "list → read(batched) → [grep] → edit → test → answer; a competent, SHORT path — real sessions ran hundreds of turns", codebase: { files: Object.keys(files).length, chars: Object.values(files).reduce((n, c) => n + c.length, 0) } }, rows, session, totals };
writeFileSync(new URL(`./simulation${SYSTEM_TOKENS === 16000 ? "" : "-sys" + SYSTEM_TOKENS}.json`, import.meta.url), JSON.stringify(out, null, 1));

const pad = (s, n) => String(s).padEnd(n), num = (n) => Math.round(n).toLocaleString();
console.log(`system prompt assumed for the naive loop: ${SYSTEM_TOKENS} tokens · fold step system: ${FOLD_SYSTEM}\n`);
console.log(pad("task", 24) + pad("naive calls", 12) + pad("naive ctx first→last", 22) + pad("naive input tok", 17) + pad("fold ctx max", 15) + pad("fold calls", 18) + pad("fold input", 12) + "saving   recall");
for (const r of rows) console.log(pad(r.task, 24) + pad(r.naive.calls, 12) + pad(num(r.naive.ctxFirst) + "→" + num(r.naive.ctxLast), 22) + pad(num(r.naive.inputTokens), 17) + pad(num(r.fold.ctxMax), 10) + pad(r.fold.calls + (r.fold.widened ? " (+" + r.fold.widened + " widened)" : ""), 18) + pad(num(r.fold.inputTokens), 12) + pad(Math.round((1 - r.fold.inputTokens / r.naive.inputTokens) * 100) + "%", 9) + r.fold.recall);
console.log(`\nper-task totals: naive ${num(totals.naiveInput)} input tokens vs fold ${num(totals.foldInput)}  (${(totals.naiveInput / totals.foldInput).toFixed(1)}× more)`);
console.log(`one conversation, ${TASKS.length} tasks in a row: naive ${session.naiveCalls} calls, context grows ${num(seq[0].ctx)} → ${num(seq.at(-1).ctx)}, ${num(session.naiveInput)} input tokens; fold ${session.foldCalls} calls, context stays ${num(Math.min(...foldSeq.map((c) => c.ctx)))}–${num(Math.max(...foldSeq.map((c) => c.ctx)))}, ${num(session.foldInput)} input tokens  (${(session.naiveInput / session.foldInput).toFixed(0)}× more)`);
console.log(`cost at the assumed prices — naive: $${totals.naiveUsd.toFixed(3)} uncached / $${totals.naiveUsdCached.toFixed(3)} with prompt caching;  fold: $${totals.foldUsd.toFixed(4)}`);
