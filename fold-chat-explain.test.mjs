// fold-chat-explain.test.mjs — "explain this": the mechanical outline, what the
// run verified, the strategy per message, and the optional model step's limits.
// Pure; no network, no browser. Every test names what would prove it wrong.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { outlineOf, verificationOf, planExplain, deeperRequest, pickExplainModel, toHtml, toText, esc, blankComments, MAX_SCAN, MAX_DEEP_CODE } from "./fold-chat-explain.js";
import { runAgent } from "./fold-chat-agent.js";

/* ---------- samples ---------- */
const POMODORO = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Pomodoro &amp; Focus</title>
<link rel="stylesheet" href="https://cdn.example.com/x.css"><link rel="stylesheet" href="style.css">
<style>body{font:16px sans-serif} button{padding:4px}</style></head>
<body><h1>Focus timer</h1><h2>Session</h2>
<label for="mins">Minutes</label><input id="mins" type="number" value="25">
<input type="hidden" name="csrf" value="x">
<button id="start">Start</button><button id="pause"><span>Pa</span>use</button>
<button id="reset" onclick="resetAll()">Reset</button>
<a href="#help">Help</a><a href="https://example.org/docs">Docs</a>
<!-- <button id="ghost">Ghost</button> -->
<script src="https://cdn.example.com/lib.js"></script>
<script type="application/json" id="cfg">{"a":1}</script>
<script>
  // const old = document.getElementById("nope"); old.addEventListener("click", nope);
  let t = null, left = 1500;
  const startBtn = document.getElementById("start");
  const pauseBtn = document.querySelector("#pause");
  function tick() { left--; render(); }
  const render = () => { document.title = left + "s"; };
  async function save() { await fetch("https://api.example.com/save", { method: "POST" }); localStorage.setItem("k", "1"); }
  startBtn.addEventListener("click", () => { t = setInterval(tick, 1000); });
  pauseBtn.addEventListener("click", pause);
  function pause() { clearInterval(t); }
  function resetAll() { left = 1500; }
  document.addEventListener("keydown", onKey);
  function onKey(e) { if (e.key === " ") pause(); }
</script></body></html>`;

const PLAIN_JS = `// compute primes
export function isPrime(n) { for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return n > 1; }
const primes = (max) => Array.from({ length: max }, (_, i) => i).filter(isPrime);
class Sieve { run() { return primes(100); } }
console.log(new Sieve().run()); // "http://not-a-url.example"
`;

const CANVAS_GAME = `<html><body><canvas id=c width=300 height=200></canvas><script>
const ctx = document.getElementById("c").getContext("2d");
let x = 0; function loop(){ x++; ctx.fillRect(x,10,5,5); requestAnimationFrame(loop);} loop();
window.addEventListener("keydown", e => { if (e.key==="ArrowRight") x += 10; });
</script></body></html>`;

/* ---------- outline: real samples ---------- */
test("outline: a page's title, headings, controls, labelled inputs, ids and sizes come off the markup", () => {
  const o = outlineOf(POMODORO);
  assert.equal(o.kind, "html");
  assert.equal(o.title, "Pomodoro & Focus");                       // entity decoded
  assert.deepEqual(o.headings.map((h) => h.text), ["Focus timer", "Session"]);
  assert.deepEqual(o.controls.filter((c) => c.tag === "button").map((c) => c.label), ["Start", "Pause", "Reset"]); // nested <span> text joined
  assert.ok(o.controls.some((c) => c.type === "anchor" && c.label === "Help"), "an in-page anchor is a control");
  assert.equal(o.inputs.length, 1, "a hidden input is not a field the person sees");
  assert.equal(o.inputs[0].label, "Minutes", "<label for> names the input");
  assert.equal(o.counts.buttons, 3);
  assert.ok(!o.controls.some((c) => /ghost/i.test(c.label)), "a commented-out button is not counted");
  assert.equal(o.counts.styles, 1);
  assert.ok(o.sizes.css > 0 && o.sizes.js > 0 && o.sizes.markup > 0);
});

test("outline: functions, handlers (with their targets) and features come off the script — comments ignored", () => {
  const o = outlineOf(POMODORO);
  for (const f of ["tick", "render", "save", "pause", "resetAll", "onKey"]) assert.ok(o.functions.includes(f), f);
  const h = (ev, tg) => o.handlers.find((x) => x.event === ev && x.target === tg);
  assert.ok(h("click", "#start"), "var bound to getElementById names its target");
  assert.ok(h("click", "#pause")?.fn === "pause", "a named handler is reported");
  assert.ok(h("keydown", "document"));
  assert.ok(h("click", "#reset")?.fn.startsWith("resetAll"), "an inline onclick is a handler");
  assert.ok(!o.handlers.some((x) => x.target === "old" || x.fn === "nope"), "a commented-out listener is not a handler");
  const feats = o.features.map((f) => f.label);
  for (const f of ["timers", "network requests", "local storage", "keyboard input"]) assert.ok(feats.includes(f), f);
  assert.ok(o.notes.some((n) => /data block of type application\/json/.test(n)), "a JSON data block is noted as not code");
});

test("outline: external references are split into network reaches and files the artifact does not carry", () => {
  const o = outlineOf(POMODORO);
  const remote = o.external.filter((e) => e.remote).map((e) => e.url);
  assert.ok(remote.includes("https://cdn.example.com/lib.js"));
  assert.ok(remote.includes("https://api.example.com/save"), "fetch() with a literal url");
  assert.ok(remote.includes("https://example.org/docs"));
  assert.ok(o.external.some((e) => e.via === "stylesheet" && e.url === "style.css" && !e.remote), "a relative stylesheet will not resolve in the preview");
});

test("outline: a plain script has functions and a class but no page; a url in a trailing comment is not a reach", () => {
  const o = outlineOf(PLAIN_JS);
  assert.equal(o.kind, "js");
  assert.ok(o.functions.includes("isPrime") && o.functions.includes("primes") && o.functions.includes("Sieve"));
  assert.equal(o.touchesPage, false);
  assert.ok(o.features.some((f) => f.label.startsWith("modules")));
  assert.equal(o.external.length, 0);
});

test("outline: a canvas page — canvas counted, rAF and window keydown found", () => {
  const o = outlineOf(CANVAS_GAME);
  assert.equal(o.counts.canvases, 1);
  assert.ok(o.features.some((f) => f.label === "canvas drawing"));
  assert.ok(o.features.some((f) => f.label === "timers"));
  assert.ok(o.handlers.some((h) => h.event === "keydown" && h.target === "window"));
  assert.match(o.summary, /^A web page with no <title>: 1 canvas/);
});

test("outline: strings keep their contents (so a url is found) while comments do not", () => {
  const b = blankComments('const u = "http://a.example/x"; // trailing\n/* block fetch("zzz") */ const v = 1;');
  assert.ok(b.includes("http://a.example/x"));
  assert.ok(!/trailing|zzz/.test(b));
});

/* ---------- outline: malformed and hostile ---------- */
test("outline never throws, on any shape of input", () => {
  const nasty = [
    undefined, null, 0, 12, {}, [], "", "   ", "\0\0\0", "<", "<<<<<<", "<div", '<div class="x', "<a href='", "<!--", "<!-- never closed <button>x</button>",
    "<script>var a = ", "<style>.a{", "<button", "<button>", "</button></button>", "<div <div <div>", '<input value="a" value="b" __proto__="x" constructor=y>',
    "<html><body><p>unclosed", "￿\uD800", "`unterminated template ${", "'unterminated string\nfunction f(){}", "function (", "const = => {",
  ];
  for (const n of nasty) {
    const o = outlineOf(n);
    assert.equal(typeof o.summary, "string", JSON.stringify(n));
    assert.ok(Array.isArray(o.controls) && Array.isArray(o.notes));
  }
});

test("outline: an unterminated script/comment/tag is reported, not swallowed silently or looped on", () => {
  assert.ok(outlineOf("<html><body><button>Go</button><script>function f(){}").notes.some((n) => /unterminated <script>/.test(n)));
  assert.equal(outlineOf("<html><button>Go</button><script>function f(){}").functions[0], "f", "the open script is still read");
  assert.ok(outlineOf("<div>a</div><!-- oops <button>x</button>").notes.some((n) => /unterminated comment/.test(n)));
  const o = outlineOf('<body><button id="a>Start</button><button>End</button>');
  assert.ok(o.counts.buttons >= 1, "a broken quote loses that tag but not the whole page");
});

test("outline: attributes named like object internals cannot poison the result", () => {
  const o = outlineOf('<button __proto__="x" constructor="y" id="toString">Go</button>');
  assert.equal(o.controls[0].label, "Go");
  assert.equal(({}).polluted, undefined);
});

test("outline: a HUGE input is read only to MAX_SCAN, says so, and stays fast", () => {
  const row = '<button id="b%d" onclick="f()">Row</button><a href="#x">l</a>\n';
  let big = "<!doctype html><html><body>";
  while (big.length < MAX_SCAN * 3) big += row;
  const t0 = Date.now();
  const o = outlineOf(big);
  assert.ok(Date.now() - t0 < 3000, "outline of ~1 MB took " + (Date.now() - t0) + "ms");
  assert.equal(o.truncated, true);
  assert.equal(o.chars, big.length);
  assert.equal(o.scanned, MAX_SCAN);
  assert.ok(o.notes.some((n) => /first .* of /.test(n)));
  assert.ok(o.controls.length <= 40 && o.handlers.length <= 40 && o.ids.length <= 40, "lists are capped");
  assert.ok(o.counts.buttons > 1000, "counts keep counting past the list caps");
});

test("outline: pathological patterns do not blow up (unclosed tags, '<' runs, long attrs, deep parens)", () => {
  const cases = [
    "<button>".repeat(20000), "<".repeat(200000), "<a " + 'x="y" '.repeat(5000), "<div".repeat(30000),
    "function(" + "(".repeat(5000), "const a = " + "(".repeat(5000) + ")", "x.addEventListener(" + '"'.repeat(5000), "fetch(" + "'a".repeat(5000),
    "<script>" + "a=(b=>".repeat(10000) + "</script>",
  ];
  for (const c of cases) {
    const t0 = Date.now();
    outlineOf(c);
    assert.ok(Date.now() - t0 < 2500, `took ${Date.now() - t0}ms on ${c.slice(0, 20)}`);
  }
});

test("outline: text and empty are not pretended to be code", () => {
  assert.equal(outlineOf("").summary, "There is no code here.");
  assert.match(outlineOf("just some words", { kind: "text" }).summary, /^Plain text, not code/);
});

/* ---------- verification, from a REAL runAgent trace ---------- */
async function realTrace({ answers, observe, derive = null, escalate = null, maxRounds = 3, signal = null, task = "Build a timer with Start, Pause and Reset buttons" }) {
  let i = 0;
  return runAgent({
    task, maxRounds, derive, escalate, signal,
    dispatch: async () => { const a = answers[Math.min(i++, answers.length - 1)]; if (a instanceof Error) throw a; return { sessionId: "s", text: a, activity: [], ms: 5, lane: "penelope-code-agent", executed: false }; },
    observe: async (code, o) => observe(code, o),
  });
}
const goodObs = () => ({ checks: [
  { name: "loads without errors", ok: true, detail: "“Timer”" },
  { name: "renders something visible", ok: true, detail: "40 chars of text · 3 control(s) · 0 input(s) · 0 visual(s)" },
  { name: "controls respond", ok: true, detail: "clicked 3; 2 changed the page" },
], facts: { loaded: true, rendered: true, controls: 3, clicked: 3, labels: ["start", "pause", "reset"], text: "start pause reset", loadErrors: [], clickErrors: [] } });
const PAGE = "<!doctype html><html><body><button>Start</button><button>Pause</button><button>Reset</button></body></html>";

test("verification: a held run — what the sandbox and janus measured, and a plain 'not verified' list that never claims correctness", async () => {
  const r = await realTrace({ answers: [PAGE], observe: goodObs, derive: async () => ({ ok: true, errors: 0, findings: [{ at: "u-load", kind: "universal_held", severity: "info" }] }) });
  const v = verificationOf(r.events);
  assert.equal(v.hasTrace, true);
  assert.equal(v.outcome, "held");
  assert.equal(v.artifactRound, 1);
  assert.equal(v.janus.state, "held");
  assert.deepEqual(v.requirements.sort(), ["pause", "reset", "start"]);
  assert.ok(v.verified.some((x) => /loaded in a hidden, sandboxed frame/.test(x)));
  assert.ok(v.verified.some((x) => /clicked once each/.test(x)));
  assert.ok(v.verified.some((x) => /janus ruled .* “start”/.test(x)), "janus's ruling names the controls the ask named");
  assert.deepEqual(v.failed, []);
  const nv = v.notVerified.join(" ");
  assert.match(nv, /Whether it actually does what you meant/);
  assert.match(nv, /first 12 controls/);
  assert.match(nv, /Appearance, layout/);
  assert.ok(!v.verified.some((x) => /works|correct/i.test(x)), "never says it 'works' or is 'correct'");
});

test("verification: an exhausted run is not dressed up — failing checks and findings are named, the last attempt is the one kept", async () => {
  const r = await realTrace({ answers: [PAGE], maxRounds: 2, observe: () => ({ checks: [{ name: "loads without errors", ok: false, detail: "x is not defined (line 3)" }], facts: { loaded: true, rendered: true, loadErrors: [{ message: "x is not defined" }] } }) });
  const v = verificationOf(r.events, { outcome: "exhausted" });
  assert.equal(v.outcome, "exhausted");
  assert.equal(v.rounds, 2);
  assert.ok(v.failed.some((x) => /x is not defined/.test(x)));
  assert.ok(v.notVerified.some((x) => /gave up after 2 rounds.*LAST attempt/.test(x)));
  assert.ok(v.notVerified.some((x) => /did not pass the load check/.test(x)));
});

test("verification: when a LATER round returned nothing, the checks of the round that made the kept artifact are the ones reported", async () => {
  const r = await realTrace({ answers: [PAGE, "(the machine door returned no text)"], maxRounds: 2, observe: () => ({ checks: [{ name: "renders something visible", ok: false, detail: "the page is blank" }], facts: { loaded: true, rendered: false } }) });
  const v = verificationOf(r.events);
  assert.equal(v.artifactRound, 1, "the kept artifact came from round 1");
  assert.ok(v.failed.some((x) => /blank/.test(x)));
});

test("verification: a sealed-remote escalation and the audit rows are reported as what left the machine", () => {
  const events = [
    { type: "start", task: "t", maxRounds: 3 }, { type: "round", round: 1, of: 3 },
    { type: "escalate", round: 1, why: "slow", reason: "the local machine took over 75s" },
    { type: "acted", round: 1, kind: "html", lane: "sealed-remote", model: "big-remote", executed: false, chars: 90 },
    { type: "observing", round: 1 }, { type: "check", round: 1, name: "loads without errors", ok: true },
    { type: "done", ok: true, rounds: 1 },
    { type: "audit", entries: [{ id: "a", model: "big-remote", host: "api.example", bytes: 800, leaks: 0, verified: true }], summary: { hosts: [{ host: "api.example" }], bytes: 800, leaks: 0 } },
  ];
  const v = verificationOf(events);
  assert.deepEqual(v.remoteModels, ["big-remote"]);
  assert.equal(v.audit.requests, 1);
  assert.deepEqual(v.audit.hosts, ["api.example"]);
  assert.equal(v.executed, false);
  assert.ok(v.notVerified.some((x) => /composed, not executed/.test(x)));
});

test("verification: janus unreachable is information, never a silent pass; a missing trace says so", () => {
  const v = verificationOf([
    { type: "round", round: 1 }, { type: "acted", round: 1, kind: "html" }, { type: "observing" },
    { type: "check", name: "loads without errors", ok: true }, { type: "derive", round: 1, error: "ECONNREFUSED", fallback: true }, { type: "done", ok: true },
  ]);
  assert.equal(v.janus.state, "unreachable");
  assert.ok(v.info.some((x) => /janus could not be reached/.test(x)));
  assert.ok(!v.verified.some((x) => /janus/.test(x)));
  const none = verificationOf(undefined);
  assert.equal(none.hasTrace, false);
  assert.match(none.notVerified[0], /No run record is stored/);
});

test("verification: garbled events (nulls, wrong types, junk) never throw", () => {
  for (const evs of [null, "x", 5, [null, 1, "a", {}, { type: 5 }, { type: "check" }, { type: "audit", entries: "no" }, { type: "derive" }, { type: "round" }]]) {
    assert.doesNotThrow(() => verificationOf(evs));
  }
});

test("verification: a click that changed nothing is flagged as unconfirmed", () => {
  const v = verificationOf([{ type: "round", round: 1 }, { type: "acted", kind: "html" }, { type: "check", name: "controls respond", ok: true, detail: "clicked 3; 0 changed the page" }, { type: "done", ok: true }]);
  assert.ok(v.notVerified.some((x) => /None of the clicks visibly changed the page/.test(x)));
});

/* ---------- strategy per message ---------- */
const agentMsg = (events, content = "```html\n" + PAGE + "\n```", extra = {}) => ({ role: "assistant", mode: "agent", content, grounding: { code: true, events, outcome: "held" }, ...extra });
const ASK = { role: "user", content: "Build a timer with Start, Pause and Reset buttons", mode: "agent" };
const MODELS = [{ id: "qwen2.5-coder:1.5b", tier: "local" }, { id: "gemma2:2b", tier: "local" }, { id: "claude-big", sealed: true, tier: "frontier" }];

test("strategy: an agent artifact is OUTLINED and checked, locally — it never asks to re-run the task", async () => {
  const r = await realTrace({ answers: [PAGE], observe: goodObs });
  const msgs = [ASK, agentMsg(r.events)];
  const p = planExplain({ messages: msgs, index: 1, models: MODELS });
  assert.equal(p.strategy, "artifact-outline");
  assert.equal(p.lane.model, null);
  assert.equal(p.lane.leavesMachine, false);
  assert.equal(p.outline.counts.buttons, 3);
  assert.equal(p.code, PAGE, "the code rides the plan so the optional step needs no second parse");
  const ids = p.sections.map((s) => s.id);
  for (const id of ["ask", "what", "use", "built", "external", "verified", "not"]) assert.ok(ids.includes(id), id);
  assert.match(p.sections.find((s) => s.id === "use").lines[0], /“Start”, “Pause”, “Reset”/);
  assert.match(p.headline, /only those checks/);
  assert.ok(p.deeper.available && p.deeper.model === "gemma2:2b", "the optional step offers the general local model, not the coder");
  assert.match(p.deeper.sends, /nothing leaves the machine/);
});

test("strategy: the ask is taken from the run's own record — a message with NO preceding user turn is still explained", async () => {
  const r = await realTrace({ answers: [PAGE], observe: goodObs });
  const p = planExplain({ messages: [agentMsg(r.events)], index: 0, models: MODELS });
  assert.equal(p.strategy, "artifact-outline");
  assert.equal(p.ask, "Build a timer with Start, Pause and Reset buttons");
  const bare = planExplain({ messages: [agentMsg([])], index: 0, models: [] });
  assert.equal(bare.strategy, "artifact-outline", "a legacy artifact with no trace and no ask still outlines the code");
  assert.equal(bare.ask, null);
  assert.match(bare.headline, /No run record is stored/);
  assert.equal(bare.deeper.available, false, "no models → the model step is unavailable, and says why");
});

test("strategy: an iterate/continue ask is not mistaken for the original task (the run's own start event wins)", async () => {
  const r = await realTrace({ answers: [PAGE], observe: goodObs, task: "make the buttons blue" });
  const p = planExplain({ messages: [{ role: "user", content: "Continue." }, agentMsg(r.events)], index: 1, models: [] });
  assert.equal(p.ask, "make the buttons blue");
});

test("strategy: a stopped agent turn with no code says there is nothing to explain and what happened — and re-runs nothing", async () => {
  const ac = new AbortController();
  ac.abort();
  const stopped = runAgent({ task: "x", signal: ac.signal, dispatch: async () => ({ text: "" }), observe: async () => ({ checks: [] }) });
  const ev = (await stopped).events;
  const m = { role: "assistant", mode: "agent", content: "", grounding: { code: true, events: ev, outcome: "stopped" }, notices: [{ kind: "agent", text: "stopped before the agent produced any code" }] };
  const p = planExplain({ messages: [ASK, m], index: 1, models: MODELS });
  assert.equal(p.strategy, "agent-no-artifact");
  assert.match(p.headline, /nothing to explain/);
  assert.equal(p.deeper, null);
  assert.match(JSON.stringify(p.sections), /stopped/);
  assert.match(JSON.stringify(p.sections), /Nothing was re-run/);
});

test("strategy: an agent that failed on an error reports the error and the last findings", () => {
  const events = [{ type: "start", task: "t" }, { type: "round", round: 1 }, { type: "repair", findings: ["No code was returned."] }, { type: "error", round: 1, message: "heimdall refused: busy" }];
  const m = { role: "assistant", mode: "agent", content: "", grounding: { code: true, events }, notices: [{ kind: "agent", text: "the agent produced no code — heimdall refused: busy" }] };
  const p = planExplain({ messages: [ASK, m], index: 1 });
  assert.equal(p.strategy, "agent-no-artifact");
  assert.match(JSON.stringify(p.sections), /heimdall refused: busy/);
  assert.match(JSON.stringify(p.sections), /No code was returned/);
});

test("strategy: an agent turn with neither code nor a record falls back to the fold's own note", () => {
  const m = { role: "assistant", mode: "agent", content: "", grounding: { code: true }, notices: [{ kind: "agent", text: "the agent produced no code" }] };
  const p = planExplain({ messages: [m], index: 0 });
  assert.equal(p.strategy, "agent-no-artifact");
  assert.match(JSON.stringify(p.sections), /the agent produced no code/);
});

const REC = {
  turn: 1, kind: "research", hasMaterial: true, effort: "balanced",
  coverage: { grounded: 2, total: 3 }, unsupported: { numbers: ["1969"], names: [] },
  facing: {
    sources: [{ n: "S1", domain: "en.wikipedia.org", label: "Apollo 11", url: "https://en.wikipedia.org/wiki/Apollo_11", text: "Apollo 11 landed on the Moon.", cite: 2 }, { n: "S2", domain: "nasa.gov", label: "NASA", url: "javascript:alert(1)", text: "Crew of three.", cite: 1 }],
    response: [{ tag: "S1", text: "Apollo 11 landed on the Moon.", grounded: true }, { tag: "S2", text: "It had a crew of three.", grounded: true }, { tag: "M", text: "It was a great day for humanity, in 1969.", grounded: false }],
  },
  void: { kind: "partial", counts: { sentences: 3, grounded: 2 }, read: [], tried: [], question: "when did it launch", closeBy: ["open a source", "attach a document"] },
  process: ["classified · question of fact", "searched the web · read 2 source(s)", "wrote the answer · local"],
  web: [{ scope: "web", engine: "ddg", n: 5 }, { read: "https://en.wikipedia.org/wiki/Apollo_11" }, { scope: "web", ok: false, why: "timeout" }],
  falsify: { checked: 3, supported: 1, weak: 1, unsupported: 1, entries: [{ verdict: "weak", text: "It had a crew of three." }] },
};
const chatMsg = (g = REC, content = "Apollo 11 landed on the Moon. It had a crew of three. It was a great day for humanity, in 1969.", extra = {}) => ({ role: "assistant", mode: "chat", content, grounding: g, ...extra });

test("strategy: a chat answer is explained from its OWN record — sources, grounded vs own prose, unsupported figures, the void — and nothing is re-searched", () => {
  const p = planExplain({ messages: [{ role: "user", content: "who landed on the moon?" }, chatMsg()], index: 1, models: MODELS });
  assert.equal(p.strategy, "answer-record");
  assert.equal(p.deeper, null, "no model is needed or offered");
  assert.equal(p.lane.leavesMachine, false);
  const by = (id) => p.sections.find((s) => s.id === id);
  assert.match(p.headline, /2 of 3 sentences are tied to a source/);
  assert.ok(by("sources").lines.some((l) => /S1 · en\.wikipedia\.org · cited 2×/.test(l.text)));
  assert.ok(by("sentences").lines.some((l) => /1 are the model's own wording|1 is the model's own wording/.test(l) || /2 of 3 sentences trace/.test(l)));
  assert.ok(by("sentences").lines.some((l) => /Own wording: “It was a great day/.test(l)));
  assert.ok(by("sentences").lines.some((l) => /1969/.test(l)), "the unsupported figure is named");
  assert.ok(by("sentences").lines.some((l) => /1 firmly supported · 1 on a weak anchor · 1 unsupported/.test(l)));
  assert.match(JSON.stringify(by("void")), /1 of 3 sentences has no source/);
  assert.match(JSON.stringify(by("not")), /word overlap, not proof/);
  assert.ok(by("how").lines.some((l) => /1 page read; 1 search\/read failed/.test(l)));
});

test("strategy: an answer with no material says the answer rests on the model alone; a creative turn says nothing was checked", () => {
  const none = planExplain({ messages: [chatMsg({ turn: 1, hasMaterial: false, coverage: { grounded: 0, total: 1 }, facing: { sources: [], response: [] } }, "Hello there.")], index: 0 });
  assert.match(none.headline, /not tied to any source/);
  assert.match(JSON.stringify(none.sections), /stands on the model alone/);
  const creative = planExplain({ messages: [chatMsg({ ...REC, creative: true, kind: "generate" })], index: 0 });
  assert.match(JSON.stringify(creative.sections), /creative/i);
  assert.match(JSON.stringify(creative.sections), /nothing in it was checked/);
});

test("strategy: a fast-effort answer says the gap check did not run", () => {
  const p = planExplain({ messages: [chatMsg({ ...REC, effort: "fast", void: null })], index: 0 });
  assert.match(JSON.stringify(p.sections.find((s) => s.id === "not")), /Fast effort skips the gap check/);
});

test("strategy: a refused answer (empty content) is 'nothing to explain' with the reason, not a re-run", () => {
  const p = planExplain({ messages: [chatMsg(REC, "", { notices: [{ kind: "refusal", text: "The model declined to answer from the sources it was given." }] })], index: 0 });
  assert.equal(p.strategy, "nothing");
  assert.match(JSON.stringify(p.sections), /declined/);
});

test("strategy: a chat answer that carries code also outlines that code, and says grounding does not cover it", () => {
  const p = planExplain({ messages: [chatMsg(REC, "Here is a page.\n\n```html\n" + PAGE + "\n```")], index: 0 });
  const code = p.sections.find((s) => s.id === "code");
  assert.ok(code);
  assert.match(code.lines.join(" "), /3 buttons/);
  assert.match(code.lines.join(" "), /not whether the code works/);
});

test("strategy: a penelope generation turn is explained from its generation record", () => {
  const p = planExplain({ messages: [{ role: "assistant", content: "An essay.", grounding: { generate: true, units: ["intro", "body"], stages: { field: "ok", mouth: "ok" }, verdict: "unverified" } }], index: 0 });
  assert.equal(p.strategy, "generation-record");
  assert.match(JSON.stringify(p.sections), /intro/);
});

test("refusals: user turn, bad index, empty message, record-less message — each says why and offers nothing silent", () => {
  const msgs = [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }, { role: "assistant", content: "" }];
  for (const [i, why] of [[0, /your own message/], [1, /no process record/], [2, /empty|no process record/], [9, /no message at that position/], [-1, /no message/], [1.5, /no message/]]) {
    const p = planExplain({ messages: msgs, index: i });
    assert.equal(p.strategy, "nothing", String(i));
    assert.match(p.refusal.reason, why, String(i));
    assert.equal(p.deeper, null);
  }
  assert.equal(planExplain().strategy, "nothing");
  assert.equal(planExplain({ messages: "no", index: 0 }).strategy, "nothing");
});

test("planExplain never mutates the stored messages", () => {
  const msgs = JSON.parse(JSON.stringify([ASK, agentMsg([{ type: "start", task: "t" }, { type: "round", round: 1 }, { type: "acted", kind: "html" }, { type: "done", ok: true }]), chatMsg()]));
  const before = JSON.stringify(msgs);
  const deepFreeze = (o) => { if (o && typeof o === "object") { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
  deepFreeze(msgs);
  for (let i = 0; i < msgs.length; i++) planExplain({ messages: msgs, index: i, models: MODELS });
  assert.equal(JSON.stringify(msgs), before);
});

test("planExplain: a 2 MB artifact is outlined on a prefix, quickly, and the model step is offered only a truncated slice", () => {
  const huge = "<html><body>" + "<button>x</button>".repeat(120000) + "</body></html>";
  const t0 = Date.now();
  const p = planExplain({ messages: [agentMsg([], "```html\n" + huge + "\n```")], index: 0, models: MODELS });
  assert.ok(Date.now() - t0 < 4000);
  assert.equal(p.outline.truncated, true);
  assert.match(p.sections.find((s) => s.id === "notes").lines.join(" "), /first .* of /);
  assert.match(p.deeper.sends, /the first .* of /);
});

/* ---------- the optional model step ---------- */
test("deeper: picks a LOCAL GENERAL model — never a coder, an embedder, or a sealed model", () => {
  assert.equal(pickExplainModel(MODELS).model.id, "gemma2:2b");
  assert.equal(pickExplainModel([{ id: "qwen2.5-coder:1.5b", tier: "local" }, { id: "nomic-embed-text", tier: "local" }]), null, "only a coder and an embedder: no model");
  assert.equal(pickExplainModel([{ id: "claude-big", sealed: true }]), null, "a sealed model is never the default");
  assert.equal(pickExplainModel([{ id: "gpt-x", tier: "remote" }]), null, "an open-remote model leaves the machine too");
  assert.equal(pickExplainModel([{ id: "fleet-llama", tier: "fleet" }]), null, "a linked host is not this device");
  assert.equal(pickExplainModel([{ id: "mystery" }]), null, "a model of unknown tier is not assumed to be on this device");
  assert.equal(pickExplainModel([{ id: "fleet-llama", tier: "fleet" }], { allowFleet: true }).leavesMachine, true);
  assert.equal(pickExplainModel([{ id: "claude-big", sealed: true }], { allowSealed: true }).leavesMachine, true);
  assert.equal(pickExplainModel([{ id: "claude-big", sealed: true }, { id: "gemma2:2b", tier: "local" }], { allowSealed: true }).model.id, "gemma2:2b", "local still wins when sealed is allowed");
});

test("deeper: the request is built (not sent), carries provenance for the audit, truncates, and is labelled", () => {
  const code = PAGE + "\n<!-- " + "x".repeat(MAX_DEEP_CODE * 2) + " -->";
  const plan = planExplain({ messages: [agentMsg([{ type: "round", round: 1 }, { type: "acted", kind: "html" }, { type: "check", name: "loads without errors", ok: true }, { type: "done", ok: true }], "```html\n" + code + "\n```")], index: 0, models: MODELS });
  const r = deeperRequest({ models: MODELS, code, plan });
  assert.equal(r.ok, true);
  assert.equal(r.model, "gemma2:2b");
  assert.equal(r.leavesMachine, false);
  assert.equal(r.truncated, true);
  assert.equal(r.messages.length, 2);
  assert.ok(r.messages[1].content.length < MAX_DEEP_CODE + 2000, "the code slice is bounded");
  assert.deepEqual(r.audit.segments.map((s) => s.provenance), ["template", "generated"], "the code is marked generated, so the audit grades it as raw content");
  assert.equal(r.audit.purpose, "explain artifact");
  assert.match(r.messages[1].content, /verified: It loaded in a hidden/);
  assert.match(r.label, /on this device/);
  assert.match(r.label, /not a verified fact/);
  assert.equal(r.privacy, "sealed-external", "the app-wide default privacy mode rides through client.chat");
});

test("deeper: refuses honestly — no code, no suitable model — and never falls back to a coder or an outside model", () => {
  assert.equal(deeperRequest({ models: MODELS, code: "  " }).ok, false);
  const r = deeperRequest({ models: [{ id: "qwen2.5-coder:1.5b", tier: "local" }, { id: "claude-big", sealed: true }], code: "<p>x</p>" });
  assert.equal(r.ok, false);
  assert.match(r.reason, /never a code model/);
  assert.equal(deeperRequest({}).ok, false);
});

test("deeper: a sealed model is reachable only when explicitly allowed, and is then labelled as NOT on this device", () => {
  const r = deeperRequest({ models: [{ id: "claude-big", sealed: true }], code: "<p>x</p>", allowSealed: true });
  assert.equal(r.ok, true);
  assert.equal(r.leavesMachine, true);
  assert.match(r.label, /NOT on this device/);
});

/* ---------- rendering ---------- */
test("toHtml escapes EVERYTHING that came from the code or the record, and links only http(s)", () => {
  const evil = '<img src=x onerror=alert(1)><script>alert(2)</script>';
  const page = `<html><head><title>a&lt;img src=x onerror=alert(1)&gt;</title></head><body><button aria-label="${evil.replace(/"/g, "&quot;")}"></button><input placeholder='${evil}'></body></html>`;
  const p = planExplain({ messages: [agentMsg([], "```html\n" + page + "\n```")], index: 0 });
  const html = toHtml(p);
  assert.ok(!/<img src=x|<script>alert/.test(html), "no raw tag from the artifact survives");
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
  const a = toHtml(planExplain({ messages: [chatMsg()], index: 0 }));
  assert.ok(a.includes('href="https://en.wikipedia.org/wiki/Apollo_11"') && a.includes('rel="noopener noreferrer"'));
  assert.ok(!a.includes("javascript:alert"), "a javascript: url never becomes a link");
  assert.equal(esc(`<&"'>`), "&lt;&amp;&quot;&#39;&gt;");
  assert.match(a, /class="disclosure open explain-card"/);
});

test("toText renders every section, and the lane line says nothing was sent", () => {
  const t = toText(planExplain({ messages: [chatMsg()], index: 0 }));
  assert.match(t, /WHERE IT CAME FROM/);
  assert.match(t, /nothing sent anywhere/);
});

/* ---------- discipline ---------- */
test("the module is pure: only relative pure imports, no DOM, no timers, no network call", () => {
  const src = readFileSync(new URL("./fold-chat-explain.js", import.meta.url), "utf8");
  const imports = [...src.matchAll(/^import .* from "(.+)";/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ["./fold-chat-agent.js", "./fold-chat-artifacts.js", "./fold-chat-channels.js", "./fold-chat-client.js"]);
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // the FEATURE patterns legitimately mention fetch/localStorage as regex text; real calls would not be written like this
  assert.doesNotMatch(code, /document\.(createElement|body|getElementById|querySelector)|window\.(location|open|addEventListener)|\bawait\s|setTimeout\(|new XMLHttpRequest|(?<![\w.\\])fetch\(/);
});
