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

const $ = (id) => document.querySelector("#" + id);
const ask = async (text, ms = 30000) => { await page.fill("#input", text); await page.click("#send"); await page.waitForTimeout(ms); };
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

// ── F2. a WRITE request is a generation turn: it writes, and does not search ──
await ask("write an essay about the potential extinction of dolphins", 60000);
{
  const ans = await lastAssistant();
  const askedForTopics = /what topics|which topics|let me know what topics|what would you like to cover/i.test(ans);
  const wrote = ans.length > 400;
  ok("a write request is WRITTEN, never bounced back as a question",
    wrote && !askedForTopics,
    `len=${ans.length} · askedForTopics=${askedForTopics} · head="${ans.slice(0, 80)}"`,
    "the reply asks for topics or is a stub → the generation path failed (the original bug)");
  ok("a write request carries NO grounding disclosure",
    (await panelCount()) === 0,
    `panels=${await panelCount()}`,
    "a written piece is grounded as if it were a claim → wrong discourse class");
}

// ── F3. the disclosure is COLLAPSED by default and opens on click ──
await ask("When was the Office of the Keeper created? The Office of the Keeper was created in 1907 under the Marden Act. Eleanor Voss led it from 1907 until 1912. It was established by the board that same year. ".repeat(3), 40000);
{
  const state = await page.evaluate(() => {
    const d = document.querySelector(".disclosure");
    if (!d) return null;
    const panel = d.querySelector(".disc-panel");
    const before = { open: d.classList.contains("open"), display: getComputedStyle(panel).display };
    d.querySelector(".disc-head").click();
    const after = { open: d.classList.contains("open"), display: getComputedStyle(panel).display };
    d.querySelector(".disc-head").click();
    const closed = { open: d.classList.contains("open"), display: getComputedStyle(panel).display };
    return { before, after, closed };
  });
  ok("a grounded turn's disclosure STARTS collapsed (panel hidden)",
    !!state && state.before.open === false && state.before.display === "none",
    JSON.stringify(state?.before),
    "the panel is visible without a click → not collapsed by default");
  ok("the disclosure EXPANDS on click and collapses again",
    !!state && state.after.display === "block" && state.closed.display === "none",
    JSON.stringify({ after: state?.after, closed: state?.closed }),
    "clicking does not toggle the panel → the toggle is broken");
}

// ── F4. Code mode pivots the UX to opencode and hides the chat sheet ──
{
  await page.evaluate(() => { for (const b of document.querySelectorAll(".agentbtn")) if (b.textContent.trim() === "Code") b.click(); });
  await page.waitForTimeout(1200);
  const code = await page.evaluate(() => {
    const pane = document.querySelector(".codepane");
    return {
      pane: pane ? getComputedStyle(pane).display : "none",
      composer: getComputedStyle(document.getElementById("composerWrap")).display,
      frame: document.querySelector(".codepane-frame")?.getAttribute("src") || null,
    };
  });
  await page.evaluate(() => { for (const b of document.querySelectorAll(".agentbtn")) if (b.textContent.trim() === "Chat") b.click(); });
  await page.waitForTimeout(600);
  const back = await page.evaluate(() => ({ pane: document.querySelector(".codepane") ? getComputedStyle(document.querySelector(".codepane")).display : "none", composer: getComputedStyle(document.getElementById("composerWrap")).display }));
  ok("Code mode shows the opencode pane and hides the chat composer",
    code.pane === "flex" && code.composer === "none" && /:4099/.test(code.frame || ""),
    JSON.stringify(code),
    "the composer stays or no opencode frame → the pivot failed");
  ok("Chat mode restores the fold sheet and hides the code pane",
    back.pane === "none" && back.composer !== "none",
    JSON.stringify(back),
    "returning to Chat leaves the code pane up → the pivot is sticky");
}

// ── F5. the bridge's code door returns a REAL artifact (not the conductor stub) ──
{
  const r = await fetch("http://127.0.0.1:8790/api/code", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "Write a self-contained HTML page showing the number 7. Return ONLY the html in a fence.", title: "e2e", model: { providerID: "heimdall", modelID: "qwen2.5-coder:1.5b" } }) });
  const j = await r.json().catch(() => ({}));
  const isStub = /perm:source-a|Office of the Keeper|admit purpose/.test(j.text || "");
  ok("the code door returns a real artifact, never the conductor stub",
    !isStub && typeof j.sessionId === "string" && j.sessionId.startsWith("ses_"),
    `sessionId=${j.sessionId} stub=${isStub} head="${String(j.text || j.error || "").slice(0, 60)}"`,
    "the response names perm:source-a or has no ses_ id → it is still the conductor");
}

// ── F6. code iteration continues the SAME session (the record) ──
{
  const one = await (await fetch("http://127.0.0.1:8790/api/code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: "Write a tiny html page showing 1. Return only html in a fence.", model: { providerID: "heimdall", modelID: "qwen2.5-coder:1.5b" } }) })).json();
  const two = await (await fetch("http://127.0.0.1:8790/api/code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: "Now change it to show 2 instead.", sessionId: one.sessionId, model: { providerID: "heimdall", modelID: "qwen2.5-coder:1.5b" } }) })).json();
  ok("a follow-up code turn continues the same session and builds on it",
    two.sessionId === one.sessionId && two.iterated === true && /2/.test(two.text || ""),
    `same=${two.sessionId === one.sessionId} iterated=${two.iterated}`,
    "a new session id or iterated:false → code does not iterate via the record");
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

await browser.close();

const falsified = results.filter((r) => r.verdict === "FALSIFIED");
console.log("\n=== E2E + FALSIFY ===");
for (const r of results) console.log(`${r.verdict === "STANDS" ? "✔ stands " : "✘ FALSIFIED"} — ${r.claim}\n    evidence: ${r.evidence}\n    falsifier: ${r.falsifier}`);
console.log(`\n${results.length - falsified.length}/${results.length} stand · ${falsified.length} falsified`);
process.exit(falsified.length ? 1 : 0);