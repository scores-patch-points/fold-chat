// The pure parts of the agent run feed: time/size formatting, truncation, and
// the plan checklist's state — which must follow real stage completions only.
import test from "node:test";
import assert from "node:assert/strict";
import { secs, size, foldList, clipText, itemsOf, stageOfStep, planProgress, replayFeed } from "./fold-chat-agentfeed.js";
import { liveWords, slowWords } from "./fold-chat-agentfeed-words.js";
import { planFor } from "./fold-chat-agent.js";
import { FEED_CSS, FEED_STYLE_ID } from "./fold-chat-agentfeed.css.js";

const steps = planFor("x", { maxRounds: 3, hasTest: true, pipelines: { read: true, derive: true, act: "penelope" } });
const states = (events, s = steps) => planProgress(s, events).map((p) => p.state);

test("secs reads like a status line", () => {
  assert.equal(secs(840), "840ms"); assert.equal(secs(3200), "3.2s"); assert.equal(secs(41000), "41s");
  assert.equal(secs(78000), "78s"); assert.equal(secs(125000), "2m 05s"); assert.equal(secs(undefined), "");
  assert.equal(size(1024), "1.0 KB"); assert.equal(size(20), "20 chars");
});

test("foldList keeps the first N and counts the rest", () => {
  assert.deepEqual(foldList([1, 2, 3, 4, 5], 2), { shown: [1, 2], hidden: [3, 4, 5], more: 3 });
  assert.equal(foldList([1, 2], 2).more, 0);
  assert.deepEqual(foldList(null, 2), { shown: [], hidden: [], more: 0 });
});

test("clipText cuts on a word and says how much was dropped", () => {
  assert.deepEqual(clipText("short", 20), { text: "short", dropped: 0 });
  const c = clipText("alpha beta gamma delta epsilon", 14);
  assert.ok(c.text.endsWith("…") && c.dropped > 0 && c.text.length <= 15);
});

test("itemsOf: first line carries the state, the rest continue it", () => {
  assert.deepEqual(itemsOf("a\n\nb\r\nc", "bad").map((i) => [i.text, i.kind]), [["a", "bad"], ["b", "cont"], ["c", "cont"]]);
  assert.deepEqual(itemsOf("", "ok"), []);
});

test("every planFor line maps to a stage", () => {
  assert.deepEqual(steps.map(stageOfStep), ["read", "act", "run", "rule", "test", "repair"]);
  const k = planFor("x", { pipelines: { act: "khora" } });
  assert.deepEqual(k.map(stageOfStep), ["act", "run", "repair"]);
});

test("plan: nothing is ticked before anything happens", () => {
  assert.deepEqual(states([{ type: "start" }, { type: "plan", steps }]), Array(6).fill("pending"));
});

test("plan: stages tick only when they really finish", () => {
  assert.deepEqual(states([{ type: "reading" }]), ["active", "pending", "pending", "pending", "pending", "pending"]);
  assert.deepEqual(states([{ type: "reading" }, { type: "read", referents: 0 }, { type: "act" }]), ["done", "active", "pending", "pending", "pending", "pending"]);
  const upToCheck = [{ type: "reading" }, { type: "read" }, { type: "act" }, { type: "acted" }, { type: "observing" }, { type: "check", name: "it runs", ok: false }];
  assert.deepEqual(states(upToCheck), ["done", "done", "done", "pending", "pending", "pending"]);
  assert.deepEqual(states([...upToCheck, { type: "deriving" }]), ["done", "done", "done", "active", "pending", "pending"]);
  assert.deepEqual(states([...upToCheck, { type: "deriving" }, { type: "derive", ok: false }, { type: "repair" }]), ["done", "done", "done", "done", "pending", "active"]);
});

test("plan: a failed khora read or janus is skipped, not ticked", () => {
  assert.equal(states([{ type: "reading" }, { type: "read", error: "x" }])[0], "skip");
  assert.equal(states([{ type: "deriving" }, { type: "derive", error: "x" }])[3], "skip");
});

test("plan: the behavioral test and the repair step follow the verdict", () => {
  assert.equal(states([{ type: "check", name: "your behavioral test", ok: true }])[4], "done");
  assert.equal(states([{ type: "check", name: "your behavioral test", ok: false }])[4], "fail");
  assert.equal(states([{ type: "check", name: "penelope's own gate", ok: true }])[2], "pending");
  assert.equal(states([{ type: "repair" }, { type: "done", ok: true }])[5], "done");
  assert.equal(states([{ type: "done", ok: true }])[5], "skip");
  assert.equal(states([{ type: "repair" }, { type: "done", ok: false }])[5], "fail");
});

test("plan: stop or error puts in-flight stages back to pending", () => {
  assert.equal(states([{ type: "act" }, { type: "stopped" }])[1], "pending");
  assert.equal(states([{ type: "act" }, { type: "error" }])[1], "pending");
});

test("live label and hints speak plainly for the stage and lane", () => {
  assert.equal(liveWords("act", "penelope"), "Writing the code"); assert.equal(liveWords("act", "remote"), "Waiting for the online AI");
  assert.equal(liveWords("run"), "Trying it out"); assert.equal(liveWords("wait"), "Waiting for the AI to be free"); assert.equal(liveWords(null), "Working");
  assert.match(slowWords("penelope", true), /stronger AI online/); assert.doesNotMatch(slowWords("penelope", null), /online/);
  assert.match(slowWords("remote"), /10 to 40 seconds/);
});

test("the stylesheet is namespaced cc-* and never touches the old rules", () => {
  assert.equal(FEED_STYLE_ID, "fold-agentfeed-style");
  assert.ok(!/\.ar-|\.agentrun|\.ob-/.test(FEED_CSS));
  assert.match(FEED_CSS, /minmax\(0, 1fr\)/);
});

// ---------- the user's own output, rendered: no jargon by default, the technical text one click away ----------

class FNode { constructor(t) { this.nodeType = 3; this.data = String(t); } }
class FEl {
  constructor(tag) { this.tag = tag; this.nodeType = 1; this.kids = []; this.className = ""; this.dataset = {}; this.attrs = {}; this.hidden = false; this.open = false; this.listeners = {}; this.id = ""; this.title = ""; this.id = ""; }
  get classList() { const o = this; return { contains: (c) => o.className.split(/\s+/).includes(c), add: (...cs) => { for (const c of cs) if (!o.classList.contains(c)) o.className = (o.className + " " + c).trim(); }, remove: (...cs) => { o.className = o.className.split(/\s+/).filter((x) => x && !cs.includes(x)).join(" "); }, toggle: (c, on) => { const has = o.classList.contains(c); const want = on === undefined ? !has : on; if (want && !has) o.classList.add(c); if (!want && has) o.classList.remove(c); return want; } }; }
  get children() { return this.kids.filter((k) => k.nodeType === 1); }
  set textContent(t) { this.kids = String(t) === "" ? [] : [new FNode(t)]; }
  get textContent() { return this.kids.map((k) => (k.nodeType === 3 ? k.data : k.textContent)).join(""); }
  append(...ns) { for (const n of ns) this.kids.push(typeof n === "string" ? new FNode(n) : n); }
  insertBefore(n, ref) { const i = this.kids.indexOf(ref); this.kids.splice(i < 0 ? this.kids.length : i, 0, n); }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return this.attrs[k] ?? null; }
  addEventListener() {} removeEventListener() {} closest() { return null; }
  find(pred, out = []) { for (const k of this.kids) if (k.nodeType === 1) { if (pred(k)) out.push(k); k.find(pred, out); } return out; }
  all(cls) { return this.find((e) => e.classList.contains(cls)); }
}
/** What a person sees: hidden rows and collapsed technical blocks are left out, as innerText would. */
function visibleText(node, techOn = false) {
  const lines = [];
  const walk = (n, tech) => {
    if (n.nodeType === 3) { lines.push(n.data); return; }
    if (n.hidden) return;
    const opens = tech || n.classList.contains("cc-tech-open") || n.classList.contains("cc-tech-all");
    if (n.classList.contains("cc-tech") && !opens) return;
    for (const k of n.kids) walk(k, opens);
  };
  walk(node, techOn);
  return lines.join(" ").replace(/\s+/g, " ");
}
function renderFeed(events, opts = {}) {
  globalThis.document = { getElementById: () => ({}), createElement: (t) => new FEl(t), head: new FEl("head"), documentElement: new FEl("html") };
  const host = new FEl("div");
  const f = replayFeed(host, events, opts);
  return { f, host, root: f.root, text: () => visibleText(f.root), click: (cls, i = 0) => f.root.all(cls)[i].onclick() };
}

const BAN = /khora|janus|penelope|heimdall|sealed|sandbox|ledger|refuted|\bclaims?\b|\bheld\b|\bEOT\b|frontier|composed|executed|escalat|pipeline|\bdoor\b|\blane\b|\bmouth\b|\bgate\b|\btokens?\b|openai|measured:|\bbytes?\b/i;

// The exact run the user pasted: asked a remote model, hung page, "refuted 2 claims", round 2 repairing 4 problems.
const userTask = "Make a counter page with Increment, Decrement and Reset buttons";
const userAudit = { type: "audit", at: 60000, entries: [{ id: "a1", model: "openai-fast", host: "text.pollinations.ai", level: "gate", sealed: true, bytes: 14336, leaks: 0, verified: true, problems: [], via: "heimdall", status: "ok" }], summary: { hosts: [{ host: "text.pollinations.ai" }], bytes: 14336, leaks: 0 } };
const userRun = [
  { type: "start", at: 0, task: userTask, maxRounds: 3 }, { type: "plan", at: 0, steps },
  { type: "reading", at: 5 }, { type: "read", at: 400, referents: 2, relations: 1, gaps: 0, ms: 400, names: ["counter", "page"] },
  { type: "requirements", at: 401, terms: ["increment", "decrement", "reset"] },
  { type: "round", at: 402, round: 1, of: 3, repair: false }, { type: "act", at: 403, round: 1, pipeline: "penelope", continuing: false },
  { type: "escalate", at: 76000, round: 1, why: "slow", reason: "the local machine took over 75s" },
  { type: "act", at: 76010, round: 1, pipeline: "remote", continuing: false }, { type: "try", at: 76020, round: 1, model: "openai-fast" },
  { type: "acted", at: 87000, round: 1, ms: 11000, lane: "sealed-remote", executed: false, chars: 1016, kind: "html", model: "openai-fast", escalated: true },
  { type: "observing", at: 87100, round: 1, kind: "html" },
  { type: "check", at: 91600, round: 1, name: "loads without errors", ok: false, detail: "the page never finished loading (it hung or blocked)" },
  { type: "deriving", at: 91700, round: 1, pipeline: "janus", claims: 2 },
  { type: "derive", at: 92000, round: 1, pipeline: "janus", ok: false, ms: 39000, findings: [], held: 0, refuted: 2 },
  { type: "round", at: 92100, round: 2, of: 3, repair: true },
  { type: "repair", at: 92110, round: 2, findings: ["measured: the page never finished loading (it hung or blocked)", "Uncaught SyntaxError: Unexpected token 'export' (line 63)", "measured: a click threw ReferenceError: state is not defined at reset", "measured: the page shows no “decrement” (the ask names it)"] },
  { type: "act", at: 92200, round: 2, pipeline: "remote", continuing: false }, { type: "try", at: 92210, round: 2, model: "openai-fast" },
  { type: "acted", at: 100000, round: 2, ms: 7800, lane: "sealed-remote", executed: false, chars: 2200, kind: "html", model: "openai-fast", escalated: true },
  userAudit,
  { type: "done", at: 105000, ok: false, rounds: 3, exhausted: true, findings: ["loads without errors: the page never finished loading (it hung or blocked)", "measured: the page shows no “decrement” (the ask names it)"] },
];

test("render: the pasted run shows no internal vocabulary by default", () => {
  const r = renderFeed(userRun);
  const t = r.text();
  assert.doesNotMatch(t, BAN, "visible text: " + (t.match(BAN) || [])[0]);
  for (const must of ["Here's what I'll do", "Understanding your request", "You asked for Increment, Decrement and Reset", "Asking a more powerful AI online for help", "the AI on this computer was taking too long (over 75 seconds)", "Only your request and the code so far are sent", "Trying it out", "The page never finished opening", "2 checks failed", "Attempt 2 of 3 — fixing 4 problems", "Clicking “Reset” causes an error", "Sent to an outside AI service", "show exactly what was sent", "couldn't get it working after 3 attempts"]) assert.ok(t.includes(must), must);
  assert.equal((t.match(/The page never finished opening/g) || []).length, 3, "once per stage that reports it (the try-out, the repair list, the final list) — never twice in one list");
});

test("render: details reveal the old technical text, per step and all at once", () => {
  const r = renderFeed(userRun);
  assert.doesNotMatch(r.text(), /Rule \(janus\)|sealed-external|openai-fast/);
  // per step: the details button of the remote-model step
  const btns = r.root.all("cc-dt").filter((b) => !b.hidden);
  assert.ok(btns.length >= 6, "a details button on every step");
  assert.ok(btns.every((b) => b.tag === "button" && b.getAttribute("aria-expanded") === "false" && b.getAttribute("aria-controls")));
  const remote = r.root.all("cc-step").find((s) => visibleText(s).includes("Asking a more powerful AI online for help"));
  remote.all("cc-dt")[0].onclick();
  const rt = visibleText(remote);
  for (const old of ["Compose (penelope)", "Escalating to a sealed remote model — local took over 75s", "heimdall's sealed-external gate — never workspace files", "Ask a remote model (sealed)", "trying openai-fast…", "answered · openai-fast · sealed-external · html · 1016 chars · composed, not executed · escalated to the frontier"]) assert.ok(rt.includes(old), old);
  assert.equal(remote.all("cc-dt")[0].getAttribute("aria-expanded"), "true");
  assert.doesNotMatch(visibleText(r.root.all("cc-step")[0]), /referent/); // other steps stay collapsed
  // all at once, from the footer
  const tt = r.root.all("cc-tt")[0]; assert.equal(tt.textContent, "show technical details"); tt.onclick();
  assert.equal(tt.textContent, "hide technical details");
  const all = r.text();
  for (const old of ["Run in sandbox and click its controls (sandbox) 4.5s", "loads without errors: the page never finished loading (it hung or blocked)", "Rule (janus) on 2 claims 39s", "refuted 2 claims — the engine's veto, not the model's opinion · 0 held", "Round 2 · repairing — 4 problems:", "– measured: the page never finished loading (it hung or blocked)", "gave up — still failing after 3 rounds · 105s", "2 requests left this machine".replace("2 requests", "1 request"), "openai-fast · raw · the provider can read it · 14336 B · ledger agrees", "2 referents · 1 relation · counter, page", "held to “increment” “decrement” “reset”"]) assert.ok(all.includes(old), old);
  tt.onclick(); assert.doesNotMatch(r.text(), /Rule \(janus\)/);
});

test("render: the audit link still opens the evidence", () => {
  const opened = [];
  const r = renderFeed(userRun, { onAuditOpen: (id) => opened.push(id) });
  const row = r.root.find((e) => e.dataset.auditId === "a1")[0];
  assert.ok(row && row.tabIndex === 0); row.onclick(); row.onkeydown({ key: "Enter", preventDefault() {} });
  assert.deepEqual(opened, ["a1", "a1"]);
});

test("render: the real error strings never show jargon, and keep their original behind details", () => {
  const strings = [
    "every server is busy — the least wait is ~18s on local (1 ahead at ~16.9s each), past the 12s promise. Heimdall holds the turn; retry in 18s.",
    "heimdall refused: model not allowed for this lane (status 403)",
  ];
  for (const message of strings) {
    const r = renderFeed([{ type: "start", at: 0 }, { type: "act", at: 1, pipeline: "penelope" }, { type: "error", at: 5, round: 1, message }]);
    assert.doesNotMatch(r.text(), BAN, message); assert.match(r.text(), /Something went wrong:/);
    r.click("cc-tt"); assert.ok(r.text().includes(message));
  }
  const findings = ["the page never finished loading (it hung or blocked)", "Uncaught SyntaxError: Unexpected token 'export' (line 63)", "a click threw ReferenceError: state is not defined at reset", "the page shows no “decrement” (the ask names it)"];
  const r = renderFeed([{ type: "start", at: 0 }, { type: "repair", at: 1, round: 2, findings }, { type: "done", at: 9, ok: false, rounds: 3, findings }]);
  assert.doesNotMatch(r.text(), BAN);
});

test("render: success, stop, busy wait and the khora tool lines read plainly", () => {
  const ok = renderFeed([{ type: "start", at: 0 }, { type: "act", at: 1, pipeline: "khora" }, { type: "tool", tool: "read", title: "index.html" }, { type: "tool", tool: "write", title: "index.html" }, { type: "tool", tool: "run", title: "node t.js" }, { type: "acted", at: 9000, ms: 9000, lane: "khora-agent", kind: "html", chars: 900 },
    { type: "observing", at: 9100, kind: "html" }, { type: "check", at: 12000, name: "loads without errors", ok: true }, { type: "check", at: 12000, name: "controls respond", ok: true, detail: "clicked 3; 3 changed the page" }, { type: "done", at: 78000, ok: true, rounds: 3, passed: 2 }]);
  assert.doesNotMatch(ok.text(), BAN);
  for (const m of ["Looked at file index.html", "Wrote file index.html", "Ran the code node t.js", "All 3 buttons respond when clicked", "Done — it works. 3 attempts, 78s."]) assert.ok(ok.text().includes(m), m);
  const stop = renderFeed([{ type: "start", at: 0 }, { type: "act", at: 1, pipeline: "penelope" }, { type: "stopped", at: 4000 }]);
  assert.match(stop.text(), /Stopped\./); assert.doesNotMatch(stop.text(), BAN);
  const busy = renderFeed([{ type: "start", at: 0 }, { type: "act", at: 1, pipeline: "penelope" }, { type: "wait", at: 5, seconds: 15, attempt: 1, of: 4, reason: "every server is busy — retry in 14s" }]);
  assert.match(busy.text(), /The AI is busy right now — waited 15s, then tried again \(attempt 1 of 4\)/); assert.doesNotMatch(busy.text(), BAN);
});

test("render: failing checks are listed first and tool/result rows keep their limits", () => {
  const r = renderFeed([{ type: "start", at: 0 }, { type: "observing", at: 1, kind: "html" }, { type: "check", at: 2, name: "loads without errors", ok: true }, { type: "check", at: 2, name: "renders something visible", ok: false, detail: "the page is blank" }]);
  const t = r.text();
  assert.ok(t.indexOf("The page is blank") < t.indexOf("The page opens without errors"));
});
