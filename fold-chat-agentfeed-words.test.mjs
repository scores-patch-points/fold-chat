// The agent feed's wording: every event type, in plain words, and none of the
// fold's internal vocabulary in anything a person reads by default.
import test from "node:test";
import assert from "node:assert/strict";
import { describe, plainProblem, plainProblems, plainCheck, plainError, askedFor, whyOnline, toolWords, scrub, planLabel, planHeader, stageOfStep, liveWords, slowWords, REASSURANCE } from "./fold-chat-agentfeed-words.js";
import { planFor } from "./fold-chat-agent.js";

/** What a person must never meet in the default text. */
export const BANNED = /khora|janus|penelope|heimdall|sealed|sandbox|ledger|refuted|\bclaims?\b|\bheld\b|\bEOT\b|frontier|composed|executed|escalat|pipeline|\bdoor\b|\blane\b|\bmouth\b|\bgate\b|\btokens?\b|openai|measured:|\bbytes?\b/i;
const plainOnly = (d) => [d.title, d.detail, ...(d.bullets || []), d.verdict?.text, ...(d.links || []).map((l) => l.label)].filter(Boolean).join("\n");

const steps = planFor("x", { maxRounds: 3, hasTest: true, pipelines: { read: true, derive: true, act: "penelope" } });

test("plan: five plain steps, the attempt budget kept", () => {
  const d = describe({ type: "plan", steps });
  assert.equal(d.title, "Here's what I'll do:");
  assert.deepEqual(d.bullets, ["Understand your request", "Write the code", "Try it out", "Check the results", "Check it against the test you attached", "Fix anything that's wrong (up to 3 attempts)"]);
  assert.equal(d.tech, steps.join("\n"));
  assert.equal(planHeader(5, 0), "Here's what I'll do · 5 steps"); assert.equal(planHeader(5, 2), "Here's what I'll do · 2 of 5 done");
  assert.equal(planLabel("repair", "if it fails, go again (up to 1 round)"), "Fix anything that's wrong");
  assert.equal(stageOfStep("khora reads the ask — what it names"), "read");
});

test("understanding the ask: names the controls, or says there are none", () => {
  assert.equal(askedFor(["increment", "decrement", "reset"]), "You asked for Increment, Decrement and Reset. I'll check the page has each one.");
  assert.equal(askedFor(["save"]), "You asked for Save. I'll check the page has it.");
  assert.equal(askedFor([]), "I didn't find specific buttons or labels to check for.");
  const d = describe({ type: "requirements", terms: ["increment", "reset"] });
  assert.equal(d.title, "Understanding your request"); assert.match(d.detail, /Increment and Reset/); assert.match(d.tech, /held to “increment” “reset”/);
  assert.match(describe({ type: "reading" }).tech, /khora/);
  const r = describe({ type: "read", referents: 2, relations: 1, gaps: 0, ms: 400, names: ["a", "b"] });
  assert.equal(r.tech, "2 referents · 1 relation · a, b"); assert.doesNotMatch(plainOnly(r), BANNED);
  assert.match(describe({ type: "read", error: "boom" }).detail, /going ahead/);
});

test("going online: plain reasons and one reassurance line", () => {
  assert.equal(whyOnline({ why: "slow", reason: "the local machine took over 75s" }), "the AI on this computer was taking too long (over 75 seconds)");
  assert.equal(whyOnline({ why: "busy", reason: "the local machine is busy (~35s)" }), "this computer's AI was busy (about 35 seconds' wait)");
  assert.equal(whyOnline({ why: "empty", reason: "x" }), "the last attempt came back with nothing usable");
  const d = describe({ type: "escalate", why: "slow", reason: "the local machine took over 75s" });
  assert.equal(d.title, "Asking a more powerful AI online for help");
  assert.deepEqual(d.bullets, [REASSURANCE]); assert.equal(REASSURANCE, "Only your request and the code so far are sent. Nothing else from your computer leaves it.");
  assert.match(d.tech, /Escalating to a sealed remote model — local took over 75s\nonly your task text .* heimdall's sealed-external gate — never workspace files/);
  assert.doesNotMatch(plainOnly(d), BANNED);
});

test("writing, answering, trying: act / try / acted / observing", () => {
  assert.equal(describe({ type: "act", pipeline: "penelope" }).title, "Writing the code…");
  assert.equal(describe({ type: "act", pipeline: "penelope", continuing: true }).title, "Fixing the code…");
  assert.equal(describe({ type: "act", pipeline: "remote" }).tech, "Ask a remote model (sealed)");
  assert.equal(describe({ type: "act", pipeline: "khora", continuing: true }).tech, "Revise in the agent loop (khora)");
  assert.equal(describe({ type: "try", model: "openai-fast" }, { tries: 1 }).detail, "Contacting an online AI service…");
  assert.match(describe({ type: "try", model: "x" }, { tries: 2 }).detail, /trying another/);
  assert.equal(describe({ type: "try", model: "openai-fast" }).tech, "trying openai-fast…");
  const a = describe({ type: "acted", lane: "sealed-remote", model: "openai-fast", kind: "html", chars: 1016, executed: false, escalated: true }, { remote: true });
  assert.equal(a.title, "The online AI answered"); assert.equal(a.detail, "It's a web page.");
  assert.equal(a.tech, "answered · openai-fast · sealed-external · html · 1016 chars · composed, not executed · escalated to the frontier");
  assert.equal(describe({ type: "acted", kind: "html", chars: 10, lane: "penelope-code-agent" }).title, "Wrote the code");
  assert.equal(describe({ type: "acted", kind: "js", chars: 10 }, { continuing: true }).title, "Fixed the code");
  assert.match(describe({ type: "acted", kind: "text", chars: 10 }).detail, /came back as text, not code/);
  assert.equal(describe({ type: "observing", kind: "html" }).title, "Trying it out — opening the page and clicking every button");
  assert.equal(describe({ type: "observing", kind: "js" }).title, "Trying it out — running the code");
});

test("checks come out as plain statements", () => {
  const c = (name, ok, detail) => describe({ type: "check", name, ok, detail });
  assert.equal(c("loads without errors", true, "“Counter”").title, "The page opens without errors");
  assert.equal(c("loads without errors", false, "Uncaught SyntaxError: Unexpected token 'export' (line 63)").title, "The page opens with an error: SyntaxError: Unexpected “export” (line 63)");
  assert.equal(c("loads without errors", false, "the page never finished loading (it hung or blocked)").title, "The page never finished opening");
  assert.equal(c("renders something visible", true, "5 chars of text · 3 control(s)").title, "The page shows something on screen");
  assert.equal(c("renders something visible", false, "the page is blank").title, "The page is blank");
  assert.equal(c("controls respond", true, "clicked 3; 2 changed the page").title, "All 3 buttons respond when clicked");
  assert.equal(c("controls respond", false, "a click threw: ReferenceError: state is not defined at reset").title, "Clicking “Reset” causes an error: state is not defined");
  assert.match(c("controls respond", null, "clicked 3 control(s); the sandbox did not report back").title, /couldn't confirm/);
  assert.equal(c("your behavioral test", true).title, "It passes the test you attached");
  assert.match(c("penelope's own gate", false, "no tests ran").title, /built-in quality check: no tests ran/);
  assert.equal(c("loads without errors", false, "x").tone, "bad"); assert.equal(c("console", null, "warn x").tone, "info");
  assert.equal(c("loads without errors", false, "the page never finished loading (it hung or blocked)").tech, "loads without errors: the page never finished loading (it hung or blocked)");
});

test("the real problem strings read plainly", () => {
  assert.equal(plainProblem("measured: the page never finished loading (it hung or blocked)"), "The page never finished opening");
  assert.equal(plainProblem("Uncaught SyntaxError: Unexpected token 'export' (line 63)"), "SyntaxError: Unexpected “export” (line 63)");
  assert.equal(plainProblem("loads without errors: Uncaught SyntaxError: Unexpected token 'export' (line 63)"), "The page opens with an error: SyntaxError: Unexpected “export” (line 63)");
  assert.equal(plainProblem("measured: a click threw ReferenceError: state is not defined at reset"), "Clicking “Reset” causes an error: state is not defined");
  assert.equal(plainProblem("measured: the page shows no “decrement” (the ask names it)"), "I can't find “Decrement” on the page — you asked for it");
  assert.equal(plainProblem("measured: the page is blank — no text, controls or visuals"), "The page is blank");
  assert.match(plainProblem("The ask is for a page, but the answer was a bare script. Return ONE complete HTML document"), /^You asked for a web page/);
  assert.equal(plainProblem("No code was returned."), "No code came back");
  assert.match(plainProblem("The behavioral test failed: 2 of 3 passed."), /^It doesn't pass the test you attached: 2 of 3 passed/);
  assert.deepEqual(plainProblems(["measured: the page is blank — x", "renders something visible: the page is blank"]), ["The page is blank"]);
  for (const raw of ["measured: loading threw SyntaxError (line 3)", "janus refuted the penelope sandbox claim", "weird thing from the ledger"]) assert.doesNotMatch(plainProblem(raw), BANNED);
  assert.doesNotMatch(scrub("heimdall's sealed-external door"), BANNED);
});

test("repair: how many problems, the plain list, no repeats; tech keeps the originals", () => {
  const findings = ["measured: the page never finished loading (it hung or blocked)", "measured: a click threw ReferenceError: state is not defined at reset", "measured: the page shows no “increment” (the ask names it)", "measured: the page is blank — no text, controls or visuals"];
  const d = describe({ type: "repair", round: 2, findings }, { of: 3 });
  assert.equal(d.title, "Attempt 2 of 3 — fixing 4 problems:"); assert.equal(d.bullets.length, 4);
  assert.equal(describe({ type: "repair", round: 2, findings: [findings[0]] }, { of: 3 }).title, "Attempt 2 of 3 — fixing 1 problem:");
  assert.match(d.tech, /Round 2 · repairing — 4 problems:\n– measured: the page never finished loading/);
  assert.doesNotMatch(plainOnly(d), BANNED);
  assert.equal(describe({ type: "round", round: 2, of: 3, repair: true }).title, "Attempt 2 of 3");
});

test("busy waits, tool calls and the checking step", () => {
  const w = { type: "wait", round: 1, seconds: 15, attempt: 1, of: 4, reason: "every server is busy — retry in 14s" };
  const d = describe(w, { live: true, left: 12 });
  assert.equal(d.title, "The AI is busy right now"); assert.equal(d.detail, "trying again in 12s (attempt 1 of 4)");
  assert.equal(describe(w, { live: true, left: 0 }).detail, "trying again now (attempt 1 of 4)");
  assert.equal(describe(w).detail, "waited 15s, then tried again (attempt 1 of 4)");
  assert.match(d.tech, /every server is busy/);
  assert.deepEqual(toolWords({ tool: "read", title: "a.js", status: "done" }), { title: "Looked at file", detail: "a.js", tech: "Read(a.js)" });
  assert.equal(toolWords({ tool: "write", title: "b.js" }).title, "Wrote file");
  assert.equal(toolWords({ tool: "bash", title: "npm test" }).title, "Ran the code");
  assert.equal(toolWords({ tool: "read", title: "a.js", status: "requested" }).title, "Asked to look at file");
  assert.equal(toolWords({ tool: "mystery" }).title, "Used a tool");
  assert.equal(describe({ type: "deriving", claims: 2 }).title, "Checking the results");
  assert.equal(describe({ type: "derive", ok: true, held: 4, refuted: 0, ms: 300 }).detail, "Everything I measured is fine");
  assert.equal(describe({ type: "derive", ok: false, held: 0, refuted: 2, ms: 300 }).detail, "2 checks failed");
  assert.equal(describe({ type: "derive", ok: false, refuted: 1 }).detail, "1 check failed");
  const bad = describe({ type: "derive", ok: false, held: 0, refuted: 2, ms: 300 });
  assert.equal(bad.tech, "refuted 2 claims — the engine's veto, not the model's opinion · 0 held");
  assert.match(describe({ type: "derive", error: "x", fallback: true }).detail, /judged from what I saw directly/);
  for (const e of [w, { type: "deriving", claims: 1 }, { type: "derive", ok: false, refuted: 2 }, { type: "derive", error: "janus down" }]) assert.doesNotMatch(plainOnly(describe(e)), BANNED);
});

test("audit: what was sent, said plainly, with a verdict and a link", () => {
  const entry = (o) => ({ id: "a1", model: "openai-fast", host: "pollinations", level: "gate", bytes: 14336, leaks: 0, verified: true, problems: [], via: "heimdall", status: "ok", ...o });
  const ev = (entries, bytes = 14336, leaks = 0) => ({ type: "audit", entries, summary: { hosts: [{ host: "pollinations" }], bytes, leaks } });
  const ok = describe(ev([entry()]));
  assert.equal(ok.title, "Sent to an outside AI service"); assert.equal(ok.detail, "Your request and the code so far (14 KB). Nothing else.");
  assert.ok(ok.bullets.includes("The outside service can read this text.")); assert.equal(ok.verdict.text, "Double-checked: what was sent matches what I meant to send");
  assert.deepEqual(ok.links, [{ id: "a1", label: "show exactly what was sent" }]); assert.match(ok.tech, /ledger agrees/);
  const bad = describe(ev([entry({ verified: false, problems: ["extra field"] })]));
  assert.equal(bad.verdict.tone, "bad"); assert.match(bad.verdict.text, /Something was sent that I didn't intend/); assert.match(bad.tech, /ledger DISAGREES: extra field/);
  assert.equal(describe(ev([entry({ level: "abstract", verified: null })], 300)).verdict.text, "Not double-checked yet");
  assert.equal(describe(ev([entry(), entry({ id: "a2" })])).title, "Sent 2 requests to an outside AI service");
  assert.equal(describe(ev([entry({ level: "abstract" })])).bullets[0], "Only a summary was sent, not your exact words.");
  for (const e of [ok, bad]) assert.doesNotMatch(plainOnly(e), BANNED);
});

test("the footer: done, gave up, stopped, and every kind of error", () => {
  const d = describe({ type: "done", ok: true, rounds: 3, passed: 3, at: 78000 });
  assert.equal(d.title, "Done — it works. 3 attempts, 78s."); assert.equal(d.tone, "ok"); assert.equal(d.tech, "it holds — 3 rounds, 3 checks passed · 78s");
  assert.equal(describe({ type: "done", ok: true, rounds: 1, passed: 1, at: 9000 }).title, "Done — it works. 1 attempt, 9.0s.");
  const f = describe({ type: "done", ok: false, rounds: 3, exhausted: true, at: 90000, findings: ["measured: the page never finished loading (it hung or blocked)", "loads without errors: the page never finished loading (it hung or blocked)"] });
  assert.equal(f.title, "I couldn't get it working after 3 attempts."); assert.match(f.detail, /closest version is below/);
  assert.deepEqual(f.bullets, ["The page never finished opening"]); assert.match(f.tech, /gave up — still failing after 3 rounds · 90s/);
  assert.deepEqual([describe({ type: "stopped", at: 5000 }).title, describe({ type: "stopped", at: 5000 }).tech], ["Stopped.", "stopped by you · 5.0s"]);
  const busy = "every server is busy — the least wait is ~18s on local (1 ahead at ~16.9s each), past the 12s promise. Heimdall holds the turn; retry in 18s.";
  assert.deepEqual(plainError(busy), { text: "The AI is too busy right now", detail: "Try again in about 18 seconds." });
  assert.equal(describe({ type: "error", message: busy }).title, "Something went wrong: the AI is too busy right now.");
  assert.equal(describe({ type: "error", message: busy }).tech, "the run failed\n" + busy);
  assert.match(plainError("heimdall refused: model not allowed for this lane (status 403)").text, /wouldn't take this request/);
  assert.match(plainError("request timed out after 120s").text, /took too long/);
  assert.match(plainError("no coding machine attached").text, /No AI is connected/);
  assert.match(plainError("Failed to fetch").text, /couldn't reach/);
  for (const m of [busy, "heimdall refused: model not allowed for this lane (status 403)", "no coding machine attached", "penelope exploded in the sandbox"]) assert.doesNotMatch(plainOnly(describe({ type: "error", message: m })), BANNED);
});

test("live words: the verb and the slow-step hint", () => {
  assert.equal(liveWords("run"), "Trying it out"); assert.equal(liveWords("rule"), "Checking the results");
  assert.match(slowWords("penelope", true), /I'll ask a stronger AI online/); assert.doesNotMatch(slowWords("penelope", true), BANNED);
  assert.doesNotMatch(slowWords("remote"), BANNED);
});

test("every event type has a description, and none of the default text is jargon", () => {
  const evs = [{ type: "start", task: "t" }, { type: "plan", steps }, { type: "reading" }, { type: "read", referents: 0, relations: 0 }, { type: "requirements", terms: [] }, { type: "round", round: 1, of: 1 }, { type: "repair", round: 2, findings: ["x"] }, { type: "act", pipeline: "khora" }, { type: "try", model: "m" }, { type: "wait", seconds: 1, attempt: 1, of: 4, reason: "r" }, { type: "escalate", why: "busy", reason: "the local machine is busy (~35s)" }, { type: "tool", tool: "read", title: "f" }, { type: "acted", kind: "html", chars: 3 }, { type: "observing", kind: "html" }, { type: "check", name: "console", ok: null, detail: "x" }, { type: "deriving", claims: 1 }, { type: "derive", ok: true }, { type: "audit", entries: [], summary: { hosts: [], bytes: 0 } }, { type: "done", ok: true, rounds: 1, passed: 1 }, { type: "stopped" }, { type: "error", message: "m" }];
  for (const e of evs) { const d = describe(e); assert.ok(d && typeof d.title === "string" && Array.isArray(d.bullets) && typeof d.tech === "string", e.type); assert.doesNotMatch(plainOnly(d), BANNED, e.type); }
  assert.equal(describe({ type: "nonsense" }).title, "");
});
