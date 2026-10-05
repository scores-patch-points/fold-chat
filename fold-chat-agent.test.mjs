// fold-chat-agent.test.mjs — the agent loop: plan → act → observe → repair.
// A fake door and a fake observer; no network, no browser. Every test names
// what would prove it wrong.
import test from "node:test";
import assert from "node:assert/strict";
import { expectedKind, busyWaitSeconds, abortableSleep, requirementsOf, reasoningSpec, refutedFindings, runAgent, kindOf, stripFence, repairPrompt, findingsOf, planFor, readAnswer, DEFAULT_ROUNDS, MAX_ROUNDS } from "./fold-chat-agent.js";

const answer = (text, extra = {}) => ({ sessionId: "ses_1", text, activity: [], ms: 5, lane: "penelope-code-agent", executed: false, ...extra });
const good = { checks: [{ name: "loads without errors", ok: true }] };
const bad = (detail) => ({ checks: [{ name: "loads without errors", ok: false, detail }] });

/** A door that returns the scripted answers in order, recording its prompts. */
function door(...answers) {
  const calls = [];
  const dispatch = async (prompt, opts) => { calls.push({ prompt, ...opts }); const a = answers[Math.min(calls.length - 1, answers.length - 1)]; if (a instanceof Error) throw a; return a; };
  return { dispatch, calls };
}

test("kindOf: a page is html, a script is js, nothing is empty — never the model's word", () => {
  assert.equal(kindOf("<!DOCTYPE html><html></html>"), "html");
  assert.equal(kindOf("  <div id=a></div>"), "html");
  assert.equal(kindOf("<button>Go</button>"), "html");
  assert.equal(kindOf("a < b and c > d"), "text");
  assert.equal(kindOf("const a = 1;"), "js");
  assert.equal(kindOf("function f(){}"), "js");
  assert.equal(kindOf(""), "empty");
  assert.equal(kindOf("hello there"), "text");
});

test("stripFence unwraps one fenced block and leaves bare code alone", () => {
  assert.equal(stripFence("```js\nconst a = 1;\n```"), "const a = 1;");
  assert.equal(stripFence("const a = 1;"), "const a = 1;");
  assert.equal(stripFence("text ```js\nx\n``` more"), "text ```js\nx\n``` more");
});

test("the plan is stated up front and names the budget", () => {
  const p = planFor("x", { maxRounds: 3 });
  assert.ok(p.some((s) => /sandbox/.test(s)));
  assert.ok(p.some((s) => /up to 3 rounds/.test(s)));
  assert.ok(planFor("x", { maxRounds: 1, hasTest: true }).some((s) => /behavioral test/.test(s)));
  assert.ok(planFor("x", { maxRounds: 1 }).some((s) => /1 round\)/.test(s)));
});

test("a first attempt that runs clean ends in one round, with evidence", async () => {
  const { dispatch, calls } = door(answer("<!doctype html><title>t</title>"));
  const events = [];
  const r = await runAgent({ task: "make a page", dispatch, observe: async () => good, emit: (e) => events.push(e) });
  assert.equal(r.ok, true);
  assert.equal(r.rounds.length, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].prompt, "make a page");
  assert.deepEqual(events.map((e) => e.type), ["start", "plan", "requirements", "round", "act", "acted", "observing", "check", "done"]);
  assert.equal(events.at(-1).passed, 1);
  assert.equal(r.artifact, "<!doctype html><title>t</title>");
});

test("falsifier: a broken attempt is NOT accepted — it goes again with the observed problem, in the SAME session", async () => {
  const { dispatch, calls } = door(answer("<div>1</div>"), answer("<div>2</div>"));
  const seen = [];
  const observe = async (text) => (seen.push(text), seen.length === 1 ? bad("ReferenceError: tick is not defined") : good);
  const events = [];
  const r = await runAgent({ task: "make a clock", dispatch, observe, emit: (e) => events.push(e) });
  assert.equal(r.ok, true);
  assert.equal(r.rounds.length, 2);
  assert.match(calls[1].prompt, /ReferenceError: tick is not defined/);
  assert.match(calls[1].prompt, /make a clock/);
  assert.equal(calls[1].sessionId, "ses_1", "the repair continues the door's session");
  assert.equal(calls[0].sessionId, null);
  assert.ok(events.some((e) => e.type === "repair" && /tick is not defined/.test(e.findings[0])));
  assert.equal(r.artifact, "<div>2</div>");
});

test("the budget is a wall: a work that never holds is reported exhausted, never looped forever", async () => {
  const { dispatch, calls } = door(answer("<div></div>"));
  const r = await runAgent({ task: "t", dispatch, observe: async () => bad("blank"), maxRounds: 3 });
  assert.equal(r.ok, false);
  assert.equal(r.exhausted, true);
  assert.equal(calls.length, 3);
  assert.equal(r.events.at(-1).type, "done");
  assert.equal(r.events.at(-1).exhausted, true);
});

test("the budget is clamped: 0 and 99 both land inside [1, MAX_ROUNDS]", async () => {
  const a = door(answer("<div></div>"));
  await runAgent({ task: "t", dispatch: a.dispatch, observe: async () => bad("x"), maxRounds: 99 });
  assert.equal(a.calls.length, MAX_ROUNDS);
  const b = door(answer("<div></div>"));
  await runAgent({ task: "t", dispatch: b.dispatch, observe: async () => bad("x"), maxRounds: 0 });
  assert.equal(b.calls.length, DEFAULT_ROUNDS);
});

test("Stop: an aborted signal ends the loop at the next boundary and says so", async () => {
  const ac = new AbortController();
  const { dispatch, calls } = door(answer("<div></div>"));
  const observe = async () => { ac.abort(); return bad("x"); };
  const r = await runAgent({ task: "t", dispatch, observe, signal: ac.signal, maxRounds: 3 });
  assert.equal(r.stopped, true);
  assert.equal(r.ok, false);
  assert.equal(calls.length, 1, "no second round after Stop");
  assert.equal(r.events.at(-1).type, "stopped");
});

test("Stop before the first act sends nothing", async () => {
  const ac = new AbortController(); ac.abort();
  const { dispatch, calls } = door(answer("x"));
  const r = await runAgent({ task: "t", dispatch, observe: async () => good, signal: ac.signal });
  assert.equal(calls.length, 0);
  assert.equal(r.stopped, true);
});

test("an abort that surfaces as an AbortError from the door is a stop, not an error", async () => {
  const e = new Error("aborted"); e.name = "AbortError";
  const { dispatch } = door(e);
  const r = await runAgent({ task: "t", dispatch, observe: async () => good });
  assert.equal(r.stopped, true);
  assert.equal(r.error, null);
});

test("a door that fails stops the run with the bridge's own message (no coding machine attached)", async () => {
  const e = new Error("no coding machine attached"); e.status = 501;
  const { dispatch } = door(e);
  const events = [];
  const r = await runAgent({ task: "t", dispatch, observe: async () => good, emit: (x) => events.push(x) });
  assert.equal(r.ok, false);
  assert.match(r.error, /no coding machine/);
  assert.equal(events.at(-1).type, "error");
  assert.equal(events.at(-1).status, 501);
});

test("falsifier: an empty answer is a problem, never a pass — and a tool request as text is named", async () => {
  const empty = door(answer(""), answer("const a = 1;"));
  const r1 = await runAgent({ task: "t", dispatch: empty.dispatch, observe: async () => good });
  assert.equal(r1.rounds.length, 2);
  assert.match(empty.calls[1].prompt, /No code was returned/);

  const tool = door(answer('{"name":"write","arguments":{"filePath":"a.js","content":"x"}}', { lane: "opencode" }), answer("const a = 1;"));
  const events = [];
  const r2 = await runAgent({ task: "t", dispatch: tool.dispatch, observe: async () => good, emit: (e) => events.push(e) });
  assert.equal(r2.rounds.length, 2);
  assert.match(tool.calls[1].prompt, /only a tool request \(write\)/);
  assert.ok(events.some((e) => e.type === "tool" && e.status === "requested" && e.title === "a.js"));
});

test("a failed behavioral test from the pipeline's own verdict drives the repair", async () => {
  const { dispatch, calls } = door(
    answer("const f = () => 1;", { agents: { verdict: { ok: false, reason: "median([3,1,2]) returned 1, expected 2" } } }),
    answer("const f = () => 2;", { agents: { verdict: { ok: true, reason: "passed" } } }),
  );
  const r = await runAgent({ task: "median", dispatch, observe: async () => good, verification: { test: "..." } });
  assert.equal(r.ok, true);
  assert.equal(r.rounds.length, 2);
  assert.match(calls[1].prompt, /median\(\[3,1,2\]\) returned 1/);
  assert.deepEqual(calls[0].verification, { test: "..." });
});

test("an observer that throws is information, not a verdict: the loop does not loop on the sandbox's own failure", async () => {
  const { dispatch } = door(answer("const a = 1;"));
  const r = await runAgent({ task: "t", dispatch, observe: async () => { throw new Error("no iframe"); } });
  assert.equal(r.ok, true, "ok:null info is not a failing check");
  assert.equal(r.rounds[0].checks[0].ok, null);
});

test("tool activity from the door is replayed as events, one per step", async () => {
  const { dispatch } = door(answer("const a = 1;", { activity: [{ tool: "swarm", status: "done", title: "u1" }, { tool: "gate", status: "passed", title: "ok" }] }));
  const events = [];
  await runAgent({ task: "t", dispatch, observe: async () => good, emit: (e) => events.push(e) });
  assert.deepEqual(events.filter((e) => e.type === "tool").map((e) => e.tool), ["swarm", "gate"]);
});

test("a throwing emit never breaks the run", async () => {
  const { dispatch } = door(answer("const a = 1;"));
  const r = await runAgent({ task: "t", dispatch, observe: async () => good, emit: () => { throw new Error("ui"); } });
  assert.equal(r.ok, true);
});

test("findingsOf / repairPrompt / readAnswer are pure and say what they found", () => {
  assert.deepEqual(findingsOf({ checks: [{ name: "a", ok: true }, { name: "b", ok: false, detail: "boom" }, { name: "c", ok: null }], text: "x" }), ["b: boom"]);
  assert.deepEqual(findingsOf({ text: "" }), ["No code was returned."]);
  assert.match(repairPrompt({ task: "T", round: 2, findings: ["f1", "f2"] }), /attempt 2[\s\S]*T[\s\S]*1\. f1\n2\. f2[\s\S]*complete corrected file/);
  assert.deepEqual(readAnswer({ lane: "penelope-code-agent", text: '{"name":"x","arguments":{}}' }).calls, [], "the penelope lane is never split");
  assert.equal(readAnswer({ lane: "opencode", text: '{"name":"x","arguments":{}} hi' }).calls.length, 1);
});

// ───────────────────────── the real pipelines: khora reads, janus rules ─────────────────────────

const facts = (o = {}) => ({ loaded: true, loadErrors: [], rendered: true, controls: 3, clicked: 3, changed: 2, clickErrors: [], labels: ["start", "pause", "reset"], text: "05:00", ...o });
/** A fake janus: refutes exactly the universals that carry counterexamples, as the engine does. */
const janus = (calls = []) => async (spec) => {
  calls.push(spec);
  const findings = spec.universals.map((u) => u.counterexamples.length
    ? { kind: "universal_refuted", severity: "error", detail: `"${u.end1} ${u.label}" refuted`, at: u.ref }
    : { kind: "universal_holds", severity: "info", detail: "holds", at: u.ref });
  return { ok: !findings.some((f) => f.severity === "error"), errors: findings.filter((f) => f.severity === "error").length, findings };
};

test("requirementsOf reads the controls the ask names, and only those", () => {
  const terms = (t) => requirementsOf(t).map((r) => r.term).sort();
  assert.deepEqual(terms("Build a countdown timer with Start, Pause and Reset buttons"), ["pause", "reset", "start"]);
  assert.deepEqual(terms('make a form with a "Submit" control'), ["submit"]);
  assert.deepEqual(terms("add a Save button and a Load button"), ["load", "save"]);
  assert.deepEqual(terms("write a function that sorts numbers"), [], "a plain ask names no controls — nothing is invented");
  assert.deepEqual(terms("don't use the 'quick' method"), [], "contractions and single quotes are not requirements");
});

test("reasoningSpec turns measured facts into universals with their counterexamples", () => {
  const clean = reasoningSpec({ facts: facts(), requirements: requirementsOf("Start, Pause and Reset buttons") });
  assert.deepEqual(clean.universals.map((u) => u.ref), ["u-load", "u-render", "u-click", "u-ask"]);
  assert.ok(clean.universals.every((u) => u.counterexamples.length === 0), "a clean page claims nothing it cannot back");
  assert.equal(clean.universals.find((u) => u.ref === "u-click").tested, 3);
  const bad = reasoningSpec({ facts: facts({ clickErrors: [{ message: "ReferenceError: x is not defined", line: 9 }], labels: ["start"], text: "" }), requirements: requirementsOf("Start, Pause and Reset buttons") });
  assert.match(bad.universals.find((u) => u.ref === "u-click").counterexamples[0], /a click threw ReferenceError: x is not defined \(line 9\)/);
  assert.deepEqual(bad.universals.find((u) => u.ref === "u-ask").counterexamples.length, 2, "pause and reset are missing");
  const blank = reasoningSpec({ facts: facts({ rendered: false, controls: 0 }) });
  assert.match(blank.universals.find((u) => u.ref === "u-render").counterexamples[0], /blank/);
  assert.equal(blank.universals.some((u) => u.ref === "u-click"), false, "no controls, no click claim");
  const hung = reasoningSpec({ facts: facts({ loaded: false }) });
  assert.equal(hung.universals.some((u) => u.ref === "u-render"), false);
  assert.match(hung.universals[0].counterexamples[0], /never finished loading/);
});

test("refutedFindings keeps only what the ENGINE refuted", () => {
  const spec = { universals: [{ ref: "a", counterexamples: ["measured: A"] }, { ref: "b", counterexamples: ["measured: B"] }] };
  assert.deepEqual(refutedFindings(spec, { findings: [{ kind: "universal_refuted", severity: "error", at: "b" }] }), ["measured: B"]);
  assert.deepEqual(refutedFindings(spec, null), ["measured: A", "measured: B"], "no ruling → the measured facts stand");
});

test("khora reads the ask first, and the read is shown — even when it finds nothing", async () => {
  const { dispatch } = door(answer("<button>Start</button>"));
  const events = [];
  const read = async () => ({ schema: "EORead@1", ms: 11, referents: [], relations: [], gaps: [] });
  await runAgent({ task: "Start button", dispatch, observe: async () => ({ ...good, facts: facts() }), read, emit: (e) => events.push(e) });
  const types = events.map((e) => e.type);
  assert.ok(types.indexOf("reading") < types.indexOf("round"), "the read happens before any act");
  const r = events.find((e) => e.type === "read");
  assert.equal(r.pipeline, "khora"); assert.equal(r.referents, 0);
  assert.ok(events.find((e) => e.type === "plan").steps[0].startsWith("khora reads"));
});

test("a khora read that fails is disclosed and never stops the work", async () => {
  const { dispatch } = door(answer("<div>x</div>"));
  const events = [];
  const r = await runAgent({ task: "t", dispatch, observe: async () => good, read: async () => { throw new Error("khora down"); }, emit: (e) => events.push(e) });
  assert.equal(r.ok, true);
  assert.match(events.find((e) => e.type === "read").error, /khora down/);
});

test("falsifier: janus REFUTES a click that threw — the round fails on the engine's word, and the repair carries the measured counterexample", async () => {
  const { dispatch, calls } = door(answer("<button>Reset</button>"), answer("<button>Reset</button>"));
  let n = 0;
  const observe = async () => ({ checks: [{ name: "loads without errors", ok: true }], facts: ++n === 1 ? facts({ clickErrors: [{ message: "ReferenceError: reset is not defined" }] }) : facts() });
  const events = [];
  const specs = [];
  const r = await runAgent({ task: "Reset button", dispatch, observe, derive: janus(specs), emit: (e) => events.push(e) });
  assert.equal(r.ok, true);
  assert.equal(r.rounds.length, 2);
  assert.match(calls[1].prompt, /a click threw ReferenceError: reset is not defined/);
  const d1 = events.filter((e) => e.type === "derive")[0];
  assert.equal(d1.pipeline, "janus"); assert.equal(d1.ok, false); assert.ok(d1.refuted >= 1);
  assert.equal(events.filter((e) => e.type === "derive")[1].ok, true);
  assert.equal(specs.length, 2, "janus ruled each round");
});

test("falsifier: the ask names a control the page lacks — janus refutes it and the next attempt is told which", async () => {
  const { dispatch, calls } = door(answer("<button>Start</button>"), answer("<button>Start</button><button>Pause</button>"));
  let n = 0;
  const observe = async () => ({ checks: [], facts: ++n === 1 ? facts({ labels: ["start"], text: "start", controls: 1, clicked: 1 }) : facts({ labels: ["start", "pause"], text: "start pause", controls: 2, clicked: 2 }) });
  const r = await runAgent({ task: "a Start button and a Pause button", dispatch, observe, derive: janus() });
  assert.equal(r.rounds.length, 2);
  assert.match(calls[1].prompt, /shows no “pause”/);
  assert.equal(r.ok, true);
});

test("when janus cannot be reached the round is judged from the measured facts — and the feed says so", async () => {
  const { dispatch, calls } = door(answer("<div></div>"), answer("<div></div>"));
  let n = 0;
  const observe = async () => ({ checks: [], facts: ++n === 1 ? facts({ rendered: false, controls: 0 }) : facts() });
  const events = [];
  const r = await runAgent({ task: "t", dispatch, observe, derive: async () => { throw new Error("khora reason did not answer"); }, emit: (e) => events.push(e) });
  const d = events.find((e) => e.type === "derive");
  assert.equal(d.fallback, true); assert.match(d.error, /did not answer/);
  assert.match(calls[1].prompt, /the page is blank/, "a missing ruling is never a silent pass");
  assert.equal(r.ok, true);
});

test("falsifier: a prose answer to a build task is NOT a pass — it is named as prose and goes again", async () => {
  const { dispatch, calls } = door(answer("Sure, here is how you would do that in general terms."), answer("const a = 1;"));
  const specs = [];
  const r = await runAgent({ task: "t", dispatch, observe: async () => ({ ...good, facts: facts() }), derive: janus(specs) });
  assert.equal(r.rounds.length, 2);
  assert.match(calls[1].prompt, /The answer was prose, not code/);
  assert.equal(specs.length, 1, "janus only ruled on the round that had code to observe");
  assert.equal(r.artifact, "const a = 1;", "prose is never kept as the artifact");
});

test("the plan names the pipelines that feed the run", () => {
  const p = planFor("x", { maxRounds: 2, pipelines: { read: true, derive: true, act: "khora" } });
  assert.ok(p[0].startsWith("khora reads") && p.some((s) => /agent loop works in its sandbox/.test(s)) && p.some((s) => /janus rules/.test(s)));
  assert.ok(planFor("x", { pipelines: { act: "penelope" } }).some((s) => /penelope composes/.test(s)));
});

// ───────────────────────── a busy machine is waited out, not given up on ─────────────────────────

const busy = (s = 18) => Object.assign(new Error(`every server is busy — the least wait is ~${s}s on local. Heimdall holds the turn; retry in ${s}s.`), { status: 503 });

test("busyWaitSeconds reads heimdall's own retry hint, and nothing else", () => {
  assert.equal(busyWaitSeconds(busy(18)), 18);
  assert.equal(busyWaitSeconds(new Error("retry in 500s")), 120, "capped");
  assert.equal(busyWaitSeconds(new Error("the coding machine did not answer")), null);
});

test("falsifier: a busy refusal waits (visibly) and retries the SAME prompt — it is not a failure", async () => {
  const { dispatch, calls } = door(busy(2), busy(2), answer("const a = 1;"));
  const events = [], slept = [];
  const r = await runAgent({ task: "t", dispatch, observe: async () => good, sleep: async (ms) => (slept.push(ms), true), emit: (e) => events.push(e) });
  assert.equal(r.ok, true);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].prompt, calls[2].prompt, "the same prompt goes again");
  assert.deepEqual(slept, [3000, 3000]);
  assert.deepEqual(events.filter((e) => e.type === "wait").map((e) => e.attempt), [1, 2]);
  assert.equal(r.rounds.length, 1, "waiting is not a round");
});

test("the busy wait is bounded: past the limit it fails with the bridge's own message", async () => {
  const { dispatch, calls } = door(busy(1));
  const r = await runAgent({ task: "t", dispatch, observe: async () => good, sleep: async () => true, maxBusyWaits: 2 });
  assert.equal(calls.length, 3);
  assert.equal(r.ok, false);
  assert.match(r.error, /every server is busy/);
});

test("Stop interrupts a busy wait", async () => {
  const ac = new AbortController();
  const { dispatch } = door(busy(30));
  const r = await runAgent({ task: "t", dispatch, observe: async () => good, signal: ac.signal, sleep: async () => { ac.abort(); return false; } });
  assert.equal(r.stopped, true);
});

test("abortableSleep resolves true after the time and false when stopped", async () => {
  assert.equal(await abortableSleep(5, null), true);
  const ac = new AbortController(); setTimeout(() => ac.abort(), 5);
  assert.equal(await abortableSleep(5000, ac.signal), false);
  const gone = new AbortController(); gone.abort();
  assert.equal(await abortableSleep(5000, gone.signal), false);
});

// ───────────────────────── escalation: delay goes to a sealed remote model ─────────────────────────

/** A remote that answers with the scripted code and records what it was asked. */
function remote(...texts) {
  const calls = [];
  const escalate = async (prompt, opts) => { calls.push({ prompt, ...opts }); return { sessionId: null, text: texts[Math.min(calls.length - 1, texts.length - 1)], activity: [{ tool: "remote", status: "done", title: "openai-fast" }], ms: 3, lane: "sealed-remote", executed: false, model: "openai-fast" }; };
  return { escalate, calls };
}

test("falsifier: a long busy hold does NOT make the agent wait — it escalates to the sealed remote at once", async () => {
  const { dispatch, calls } = door(busy(18));
  const { escalate, calls: rcalls } = remote("<button>Go</button>");
  const events = [], slept = [];
  const r = await runAgent({ task: "a Go button", dispatch, escalate, observe: async () => ({ ...good, facts: facts({ labels: ["go"], text: "go" }) }), sleep: async (ms) => (slept.push(ms), true), emit: (e) => events.push(e) });
  assert.equal(r.ok, true);
  assert.equal(calls.length, 1, "the local door was tried once");
  assert.equal(slept.length, 0, "no waiting");
  assert.equal(rcalls.length, 1);
  const esc = events.find((e) => e.type === "escalate");
  assert.equal(esc.why, "busy"); assert.match(esc.reason, /busy \(~18s\)/);
  assert.deepEqual(events.filter((e) => e.type === "act").map((e) => e.pipeline), ["penelope", "remote"]);
  assert.equal(events.find((e) => e.type === "acted").model, "openai-fast");
});

test("a SHORT busy hold is still waited out even when a remote exists — escalation is for real delay", async () => {
  const { dispatch, calls } = door(busy(3), answer("<div>x</div>"));
  const { escalate, calls: rcalls } = remote("never");
  const slept = [];
  const r = await runAgent({ task: "t", dispatch, escalate, observe: async () => good, sleep: async (ms) => (slept.push(ms), true) });
  assert.equal(r.ok, true);
  assert.deepEqual(slept, [4000]);
  assert.equal(calls.length, 2); assert.equal(rcalls.length, 0);
});

test("falsifier: a local draw that is too slow is cancelled and escalated", async () => {
  let aborted = false;
  const dispatch = (prompt, { signal }) => new Promise((_, rej) => signal.addEventListener("abort", () => { aborted = true; rej(Object.assign(new Error("aborted"), { name: "AbortError" })); }));
  const { escalate } = remote("<p>fast</p>");
  const events = [];
  const r = await runAgent({ task: "t", dispatch, escalate, slowAfterMs: 20, observe: async () => good, emit: (e) => events.push(e) });
  assert.equal(aborted, true, "the slow local call was cancelled, not left running");
  assert.equal(r.ok, true);
  assert.equal(events.find((e) => e.type === "escalate").why, "slow");
});

test("without a remote to go to, there is no slow deadline — the local call is never cut short", async () => {
  let aborted = false;
  const dispatch = (prompt, { signal }) => new Promise((res) => { signal.addEventListener("abort", () => { aborted = true; }); setTimeout(() => res(answer("<p>ok</p>")), 40); });
  const r = await runAgent({ task: "t", dispatch, slowAfterMs: 5, observe: async () => good });
  assert.equal(aborted, false);
  assert.equal(r.ok, true);
});

test("falsifier: a local round that returns nothing usable sends the NEXT round to the remote, which carries the prior code", async () => {
  const { dispatch, calls } = door(answer(""));
  const { escalate, calls: rcalls } = remote("<div>fixed</div>");
  const events = [];
  const r = await runAgent({ task: "make it", dispatch, escalate, observe: async () => good, emit: (e) => events.push(e) });
  assert.equal(r.ok, true);
  assert.equal(r.rounds.length, 2);
  assert.equal(calls.length, 1, "local was not asked again");
  assert.match(rcalls[0].prompt, /No code was returned/);
  assert.equal(events.find((e) => e.type === "escalate").why, "empty");
});

test("escalation is sticky: once remote, later rounds stay remote and carry the last good artifact as prior", async () => {
  const { dispatch } = door(busy(30));
  const { escalate, calls: rcalls } = remote("<div>1</div>", "<div>2</div>");
  let n = 0;
  const r = await runAgent({ task: "t", dispatch, escalate, observe: async () => ({ checks: [], facts: ++n === 1 ? facts({ rendered: false }) : facts() }), derive: janus() });
  assert.equal(r.rounds.length, 2);
  assert.equal(rcalls[1].prior, "<div>1</div>");
});

test("a remote that fails ends the run with its own message — never a fake answer", async () => {
  const { dispatch } = door(busy(30));
  const r = await runAgent({ task: "t", dispatch, escalate: async () => { throw Object.assign(new Error("no sealed remote model answered (a: boom)"), { status: 502 }); }, observe: async () => good });
  assert.equal(r.ok, false);
  assert.match(r.error, /no sealed remote model answered/);
});

test("the remote draw's per-model attempts are shown as events", async () => {
  const { dispatch } = door(busy(30));
  const escalate = async (p, { onTry }) => { onTry("dead"); onTry("openai-fast"); return { text: "<p>x</p>", model: "openai-fast", lane: "sealed-remote", activity: [], ms: 1 }; };
  const events = [];
  await runAgent({ task: "t", dispatch, escalate, observe: async () => good, emit: (e) => events.push(e) });
  assert.deepEqual(events.filter((e) => e.type === "try").map((e) => e.model), ["dead", "openai-fast"]);
});


// ───────────────────────── a page was asked for ─────────────────────────

test("expectedKind: a request for a page with controls expects html; a plain function request does not", () => {
  assert.equal(expectedKind("Build a single-file HTML counter with Increment, Decrement and Reset buttons, and a number display"), "html");
  assert.equal(expectedKind("Build a countdown timer page with Start and Pause buttons"), "html");
  assert.equal(expectedKind("Write a function that sorts numbers"), "any");
  assert.equal(expectedKind("Add validatePrice(p) to the validators"), "any");
});

test("falsifier: a bare script is NOT an answer to a page request — it is named, and the repair asks for a document", async () => {
  const { dispatch, calls } = door(answer("export function counter() { let n = 0; return n; }"), answer("<!doctype html><button>Increment</button><button>Decrement</button><button>Reset</button><div id=n>0</div>"));
  const r = await runAgent({ task: "Build a single-file HTML counter with Increment, Decrement and Reset buttons, and a number display.", dispatch, observe: async () => good });
  assert.equal(r.rounds.length, 2);
  assert.match(calls[1].prompt, /bare script/); assert.match(calls[1].prompt, /ONE complete HTML document/);
  assert.equal(r.ok, true);
});

test("a script that answers a NON-page ask is fine — the page rule only applies when a page was asked for", async () => {
  const { dispatch } = door(answer("export function sort(a) { return [...a].sort(); }"));
  const r = await runAgent({ task: "Write a function that sorts numbers", dispatch, observe: async () => good });
  assert.equal(r.ok, true); assert.equal(r.rounds.length, 1);
});


test("falsifier: the SAME problem coming back after a repair changes the maker — it does not repeat the question", async () => {
  const script = "export function counter() { return 0; }";
  const { dispatch, calls } = door(answer(script), answer(script), answer(script));
  const { escalate, calls: rcalls } = remote("<!doctype html><button>Increment</button><button>Decrement</button><button>Reset</button><div>0</div>");
  const events = [];
  const r = await runAgent({ task: "Build a single-file HTML counter with Increment, Decrement and Reset buttons, and a number display.", dispatch, escalate, observe: async () => ({ ...good, facts: facts({ labels: ["increment", "decrement", "reset"], text: "0" }) }), maxRounds: 4, pageToRemote: false, emit: (e) => events.push(e) });
  assert.equal(calls.length, 2, "the local maker got two tries, not three");
  assert.equal(rcalls.length, 1, "then the sealed remote took over");
  assert.equal(events.find((e) => e.type === "escalate").why, "stuck");
  assert.equal(r.ok, true);
});

test("different problems each round are progress, not 'stuck' — no escalation", async () => {
  const { dispatch } = door(answer("<div>1</div>"), answer("<div>2</div>"), answer("<div>3</div>"));
  const { escalate, calls: rcalls } = remote("never");
  let n = 0;
  const problems = [["a click threw ReferenceError: foo is not defined"], ["the page is blank"], []];
  const events = [];
  await runAgent({ task: "t", dispatch, escalate, derive: async () => ({ ok: true, findings: [] }), observe: async () => { const i = n++; return { checks: problems[i].map((d) => ({ name: "x", ok: false, detail: d })), facts: facts() }; }, maxRounds: 4, emit: (e) => events.push(e) });
  assert.equal(rcalls.length, 0); assert.ok(!events.some((e) => e.type === "escalate"));
});


test("onVersion hands every attempt's code to the fold as it lands, with its maker; a throwing hook never blocks the run", async () => {
  const { dispatch } = door(answer("<div>1</div>", { activity: [{ tool: "field", status: "done", title: "u" }], agents: { units: ["u"] } }), answer("<div>2</div>"));
  const { escalate } = remote("<div>3</div>");
  const seen = [];
  let n = 0;
  const r = await runAgent({ task: "t", dispatch, escalate, slowAfterMs: 0, maxRounds: 3, observe: async () => ({ checks: [], facts: facts({ rendered: ++n > 2 }) }), derive: janus(), onVersion: (v) => { seen.push([v.round, v.maker.kind, v.kind, v.units.join(","), v.activity.length]); throw new Error("fold bug"); } });
  assert.deepEqual(seen[0], [1, "penelope", "html", "u", 1]);
  assert.ok(seen.length >= 2 && r.rounds.length >= 2, "the run went on after the hook threw");
});


// ───────────────────────── measured slowness: janus's deadline, and pages go straight to the remote ─────────────────────────

test("falsifier: a janus that never answers costs the run its DEADLINE, not minutes — then the facts decide, and the feed says so", async () => {
  const { dispatch, calls } = door(answer("<div></div>"), answer("<div>ok</div>"));
  let n = 0, sawSignal = null;
  const events = [];
  const t0 = Date.now();
  const r = await runAgent({ task: "t", dispatch, deriveTimeoutMs: 40, observe: async () => ({ checks: [], facts: ++n === 1 ? facts({ rendered: false, controls: 0 }) : facts() }), derive: (spec, { signal }) => { sawSignal = signal; return new Promise(() => {}); }, emit: (e) => events.push(e) });
  assert.ok(Date.now() - t0 < 2000, "the hung ruling did not hold the run");
  const d = events.find((e) => e.type === "derive");
  assert.equal(d.fallback, true); assert.match(d.error, /no answer within/);
  assert.equal(sawSignal.aborted, true, "the stuck request was cancelled, not left running");
  assert.match(calls[1].prompt, /the page is blank/, "the round was judged from the measured facts");
  assert.equal(r.ok, true);
});

test("a janus that answers inside the deadline is used as before", async () => {
  const { dispatch } = door(answer("<div>1</div>"));
  const events = [];
  await runAgent({ task: "t", dispatch, deriveTimeoutMs: 500, observe: async () => ({ checks: [], facts: facts() }), derive: async () => ({ ok: true, findings: [{ at: "u-load", severity: "info" }] }), emit: (e) => events.push(e) });
  assert.equal(events.find((e) => e.type === "derive").ok, true); assert.ok(!events.find((e) => e.type === "derive").fallback);
});

test("FALSIFIER: a PAGE request goes straight to the escalation maker — the local writer is never asked", async () => {
  const { dispatch, calls } = door(answer("export function x() {}"));
  const { escalate, calls: rcalls } = remote("<!doctype html><button>Increment</button><button>Decrement</button><button>Reset</button><div>0</div>");
  const events = [];
  const r = await runAgent({ task: "Build a single-file HTML counter with Increment, Decrement and Reset buttons, and a number display.", dispatch, escalate, observe: async () => ({ checks: [], facts: facts({ labels: ["increment", "decrement", "reset"], text: "0" }) }), derive: janus(), emit: (e) => events.push(e) });
  assert.equal(calls.length, 0, "no time spent on a lane that cannot make a page");
  assert.equal(rcalls.length, 1);
  assert.equal(events.find((e) => e.type === "escalate").why, "page");
  assert.deepEqual(events.filter((e) => e.type === "act").map((e) => e.pipeline), ["remote"]);
  assert.equal(r.ok, true);
});

test("a NON-page request still starts local, and with escalation off nothing changes", async () => {
  const a = door(answer("export function sort(a) { return a; }"));
  const { escalate, calls: rcalls } = remote("never");
  await runAgent({ task: "Write a function that sorts numbers", dispatch: a.dispatch, escalate, observe: async () => good });
  assert.equal(a.calls.length, 1); assert.equal(rcalls.length, 0);
  const b = door(answer("<div>x</div>"));
  const r = await runAgent({ task: "Build an HTML counter with buttons and a display", dispatch: b.dispatch, escalate: null, observe: async () => good });
  assert.equal(b.calls.length, 1, "no remote available → the local writer is all there is");
  assert.equal(r.ok, true);
});
