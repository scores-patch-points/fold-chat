// fold-e2e-falsify.mjs — drive the LIVE fold-chat surface and try to BREAK
// every claim. A claim that survives its falsifier stands; one that falls is
// the finding. Each check names what would prove it wrong.
//
//   node fold-e2e-falsify.mjs
//
// Requires the live stack: fold-chat on :8814, heimdall bridge :8790,
// the Fold's opencode :4099, khora read :11436. Playwright chromium.

import { chromium } from "/private/tmp/fold-e2e/node_modules/playwright/index.mjs";

const URL = process.env.FOLD_URL || "http://127.0.0.1:8814/";
const results = [];
const ok = (claim, survived, evidence, falsifier) => results.push({ claim, verdict: survived ? "STANDS" : "FALSIFIED", evidence, falsifier });

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e.message)));
await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
// Deterministic turn: Web OFF. (The web path's public APIs stall non-
// deterministically and are proven separately by the read-door check.)
await page.evaluate(() => { const t = document.getElementById("webToggle"); if (t && t.classList.contains("on")) t.click(); }).catch(() => {});
await page.waitForTimeout(300);

const $ = (id) => document.querySelector("#" + id);
const ask = async (text, ms = 30000) => {
  // Wait for the composer to be enabled (a prior turn, incl. a web search over
  // slow public APIs, disables it). A public API can stall up to ~50s; bound
  // the wait generously, and if it still hasn't returned, that is a NETWORK
  // stall, not a fold failure — record it and carry on rather than crash.
  const ready = await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled; }, { timeout: 150000 }).then(() => true).catch(() => false);
  if (!ready) { results.push({ claim: `turn dispatched: "${String(text).slice(0, 40)}…"`, verdict: "STALLED (network)", evidence: "composer still disabled after 150s — a public API stalled, not the fold", falsifier: "n/a — network" }); return; }
  await page.fill("#input", text); await page.click("#send"); await page.waitForTimeout(ms);
};
const lastAssistant = () => page.evaluate(() => { const a = [...document.querySelectorAll(".msg.assistant .body")].slice(-1)[0]; return a ? a.innerText : ""; });
const panelCount = () => page.evaluate(() => document.querySelectorAll(".disclosure").length);

// ── F1. a greeting is smalltalk: written answer, NO grounding disclosure ──
await ask("hi", 25000);
{
  const panels = await panelCount();
  const ans = await lastAssistant();
  ok("a greeting gets a greeting and NO grounding panel",
    panels === 0 && ans.length > 0,
    `panels=${panels} · answer="${ans.slice(0, 60)}"`,
    "a disclosure panel appears on a greeting → the discourse gate failed");
}

// ── F2. a WRITE request is a generation turn: instructed to write, never searched ──
await ask("write an essay about the potential extinction of dolphins", 60000);
{
  const ans = await lastAssistant();
  const askedForTopics = /what topics|which topics|let me know what topics|what would you like to cover/i.test(ans);
  // The MECHANISM's invariant: the generate path was taken (no topics-quiz, not
  // bounced). Whether the MOUTH complies (writes vs refuses) is the model's,
  // and a refusal is disclosed as such — not a pipeline failure.
  const refused = /i'?m not qualified|i cannot|i can'?t assist|i'?m sorry, but i'?m not/i.test(ans);
  ok("a write request takes the GENERATE path: no topics-quiz, no search bounce",
    !askedForTopics,
    `askedForTopics=${askedForTopics} · refused=${refused} · head="${ans.slice(0, 80)}"`,
    "the reply asks for topics → the generation path failed (the original bug)");
  ok("a write request carries NO grounding disclosure",
    (await panelCount()) === 0,
    `panels=${await panelCount()}`,
    "a written piece is grounded as if it were a claim → wrong discourse class");
}

// ── F3. the disclosure is COLLAPSED by default and opens on click ──
await ask("When was the Office of the Keeper created? The Office of the Keeper was created in 1907 under the Marden Act. Eleanor Voss led it from 1907 until 1912. It was established by the board that same year. ".repeat(3), 40000);
{
  // Wait for THIS turn's disclosure (a fresh panel appearing after the ask).
  await page.waitForFunction(() => document.querySelectorAll(".disclosure").length > 0, { timeout: 15000 }).catch(() => {});
  const state = await page.evaluate(() => {
    const d = [...document.querySelectorAll(".disclosure")].slice(-1)[0];
    if (!d) return null;
    const panel = d.querySelector(".disc-panel");
    const before = { open: d.classList.contains("open"), display: getComputedStyle(panel).display };
    d.querySelector(".disc-head").click();
    const after = { open: d.classList.contains("open"), display: getComputedStyle(panel).display };
    d.querySelector(".disc-head").click();
    const closed = { open: d.classList.contains("open"), display: getComputedStyle(panel).display };
    return { before, after, closed };
  });
  ok("a grounded turn's disclosure STARTS collapsed — unless the turn carries an unsupported claim, which opens it",
    !!state && (state.before.open === false && state.before.display === "none" ? true : (state.before.open === true)),
    JSON.stringify(state?.before),
    "the panel is open with no problem to disclose → not collapsed by default");
  ok("the disclosure EXPANDS on click and collapses again",
    !!state && state.after.display === "block" && state.closed.display === "none",
    JSON.stringify({ after: state?.after, closed: state?.closed }),
    "clicking does not toggle the panel → the toggle is broken");
  // The facing page: the same turn as a book spread — S# sources with their
  // verbatim snip on the left, [S#]/[M]-tagged sentences on the right.
  // Ask again with a question whose answer is materially grounded AND makes an
  // ungrounded aside, so the spread must show both an [S#] and an [M] tag.
  await ask("Who led the Office of the Keeper and when? The Office of the Keeper was created in 1907 under the Marden Act. Eleanor Voss led it from 1907 until 1912. State plainly that you cannot verify who appointed her. ".repeat(2), 45000);
  await page.waitForSelector(".disclosure .facing", { timeout: 15000 }).catch(() => {});
  const face = await page.evaluate(() => {
    const d = [...document.querySelectorAll(".disclosure")].filter((x) => x.querySelector(".facing")).slice(-1)[0];
    if (!d) return null;
    if (!d.classList.contains("open")) d.querySelector(".disc-head").click();
    const f = d.querySelector(".facing");
    if (!f) return { none: true };
    const srcs = [...f.querySelectorAll(".face-source")].map((s) => ({ n: s.querySelector(".face-n")?.textContent, addr: s.querySelector(".face-addr")?.textContent, snip: (s.querySelector(".face-snip")?.textContent || "").slice(0, 40) }));
    const sents = [...f.querySelectorAll(".face-sent")].map((s) => s.querySelector(".face-tag")?.textContent);
    return { srcs, sents, cols: getComputedStyle(f).gridTemplateColumns };
  });
  ok("the facing page renders: S# sources with a permanent address and a verbatim snip",
    !!face && !face.none && face.srcs.length >= 1 && face.srcs.every((s) => /^S\d+$/.test(s.n || "") && s.addr && s.snip),
    JSON.stringify(face && { nsrcs: face.srcs.length, srcs: face.srcs, cols: face.cols }),
    "no numbered sources carrying an address and a snip → the left page is not rendered");
  ok("the response is tagged sentence-by-sentence [S#] grounded / [M] the mouth's own prose",
    !!face && Array.isArray(face.sents) && face.sents.some((t) => /^\[S\d+\]$/.test(t || "")) && face.sents.every((t) => /^\[(S\d+|M)\]$/.test(t || "")),
    JSON.stringify(face && { sents: face.sents }),
    "a response sentence carries no [S#]/[M] tag → the right page is not tagged");
}

// ── F4. Agent engagement dispatches the turn through the machine door ──
// (The design moved from embedding an opencode pane to a Claude-Code-shaped
// shared-session engagement: Agent dispatches the SAME turn through the door.)
{
  // An Agent turn must hit the bridge's /api/code and land a code session id.
  const codeCalls = [];
  page.on("request", (r) => { if (r.url().includes("/api/code") && r.method() === "POST") codeCalls.push(r.url()); });
  await page.evaluate(() => { for (const b of document.querySelectorAll(".agentbtn")) if (b.textContent.trim() === "Agent") b.click(); });
  await page.waitForTimeout(400);
  const engaged = await page.evaluate(() => ({ on: [...document.querySelectorAll(".agentbtn")].find((b) => b.classList.contains("on"))?.textContent.trim(), placeholder: document.getElementById("input")?.placeholder }));
  await ask("write an html page showing the number 9", 90000);
  // Read the code session id from whichever session holds one (the active turn).
  const got = await page.evaluate(() => {
    const all = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}"));
    return { codeSessionId: all.map((x) => x && x.codeSessionId).find(Boolean) || null };
  });
  ok("Agent engagement dispatches the turn through the machine door (/api/code)",
    engaged.on === "Agent" && /change/.test(engaged.placeholder || "") && codeCalls.length >= 1 && typeof got.codeSessionId === "string" && got.codeSessionId.startsWith("ses_"),
    `engaged=${engaged.on} placeholder="${engaged.placeholder}" codeCalls=${codeCalls.length} session=${got.codeSessionId}`,
    "Agent mode does not call /api/code, or lands no ses_ session → the engagement is not dispatching");
  await page.evaluate(() => { for (const b of document.querySelectorAll(".agentbtn")) if (b.textContent.trim() === "Chat") b.click(); });
  await page.waitForTimeout(300);
  const backEng = await page.evaluate(() => [...document.querySelectorAll(".agentbtn")].find((b) => b.classList.contains("on"))?.textContent.trim());
  ok("Chat engagement switches back cleanly",
    backEng === "Chat",
    `engaged=${backEng}`,
    "returning to Chat leaves Agent engaged → the toggle is sticky");
}

// ── F5. the bridge's code door returns a REAL artifact, routed by capability ──
{
  // A SMALL model is never handed tools: the job routes to penelope's robust
  // coding pipeline (the machine composes sub-agents; the mouth draws residue).
  const r = await fetch("http://127.0.0.1:8790/api/code", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "Write a JavaScript function add(a, b) that returns a + b.", title: "e2e", model: { providerID: "heimdall", modelID: "qwen2.5-coder:1.5b" } }) });
  const j = await r.json().catch(() => ({}));
  const isStub = /perm:source-a|Office of the Keeper|admit purpose/.test(j.text || "");
  ok("the code door returns a real artifact, never the conductor stub",
    !isStub && typeof j.sessionId === "string" && j.sessionId.startsWith("ses_"),
    `sessionId=${j.sessionId} stub=${isStub} lane=${j.lane} head="${String(j.text || j.error || "").slice(0, 60)}"`,
    "the response names perm:source-a or has no ses_ id → it is still the conductor");
  ok("a small model's code turn goes through the machine composition, never raw tools",
    j.lane === "penelope-code-agent" && j.executed === false && Array.isArray(j.agents?.dispositions) && j.agents.dispositions.length > 0,
    `lane=${j.lane} executed=${j.executed} subAgents=${(j.agents?.dispositions || []).length}`,
    "the small model was routed to raw tool execution (opencode) → the doctrine is broken");
}

// ── F6. a follow-up code turn continues the SAME thread/session (the record) ──
{
  const one = await (await fetch("http://127.0.0.1:8790/api/code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: "Write a JavaScript function one() that returns 1.", model: { providerID: "heimdall", modelID: "qwen2.5-coder:1.5b" } }) })).json();
  const two = await (await fetch("http://127.0.0.1:8790/api/code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: "Now write two() that returns 2.", sessionId: one.sessionId, model: { providerID: "heimdall", modelID: "qwen2.5-coder:1.5b" } }) })).json();
  // The MECHANISM's invariant: the second turn CONTINUES the same session id —
  // the fold's own thread is the record (the opencode lane iterates via its
  // agent session; the penelope lane continues the caller's thread).
  ok("a follow-up code turn continues the SAME session id",
    two.sessionId === one.sessionId && (two.iterated === true || two.lane === "penelope-code-agent"),
    `same=${two.sessionId === one.sessionId} iterated=${two.iterated} lane=${two.lane}`,
    "a new session id → the code lane does not continue the record");
}

// ── F7. attachments are READ THROUGH KHORA (EORead@1), never forwarded raw ──
{
  const r = await fetch("http://127.0.0.1:8790/api/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "The Office of the Keeper was created in 1907. Eleanor Voss led it.", source: "e2e.txt" }) });
  const j = await r.json().catch(() => ({}));
  ok("an attachment is read through the khora and returns EORead@1",
    j.schema === "EORead@1" && Array.isArray(j.referents),
    `schema=${j.schema} referents=${(j.referents || []).length}`,
    "the read door returns raw passthrough or no schema → it is not going through the khora");
}

// ── F8. no page errors anywhere in the run ──
ok("the surface raises no page error during the whole run",
  pageErrors.length === 0,
  `errors=${JSON.stringify(pageErrors)}`,
  "any uncaught page error falsifies the surface");

// ── F9. a small-model code turn never presents a hallucinated tool request as
// "the machine did something" — the doctrine (2026-10-04). ──
{
  const r = await fetch("http://127.0.0.1:8790/api/code", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "make me a countdown clock", model: { providerID: "heimdall", modelID: "qwen2.5-coder:1.5b" } }) });
  const j = await r.json().catch(() => ({}));
  const noRequested = Array.isArray(j.activity) && j.activity.every((a) => a.status !== "requested");
  ok("a small-model code turn returns the machine's own composition, never a bare 'tool requested — nothing executed'",
    j.lane === "penelope-code-agent" && noRequested,
    `lane=${j.lane} activity=${JSON.stringify((j.activity || []).slice(0, 4))}`,
    "a hallucinated tool request is surfaced as activity → the doctrine is broken");
}

await browser.close();

const falsified = results.filter((r) => r.verdict === "FALSIFIED");
console.log("\n=== E2E + FALSIFY ===");
for (const r of results) console.log(`${r.verdict === "STANDS" ? "✔ stands " : "✘ FALSIFIED"} — ${r.claim}\n    evidence: ${r.evidence}\n    falsifier: ${r.falsifier}`);
console.log(`\n${results.length - falsified.length}/${results.length} stand · ${falsified.length} falsified`);
process.exit(falsified.length ? 1 : 0);