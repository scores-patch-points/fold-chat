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

// ── F4. Code engagement dispatches the turn through the machine door ──
// (The design moved from embedding an opencode pane to a Claude-Code-shaped
// shared-session engagement: Code dispatches the SAME turn through the door.)
{
  // A Code turn must hit the bridge's /api/code and land a code session id.
  const codeCalls = [];
  page.on("request", (r) => { if (r.url().includes("/api/code") && r.method() === "POST") codeCalls.push(r.url()); });
  await page.evaluate(() => { for (const b of document.querySelectorAll(".agentbtn")) if (b.textContent.trim() === "Code") b.click(); });
  await page.waitForTimeout(400);
  const engaged = await page.evaluate(() => ({ on: [...document.querySelectorAll(".agentbtn")].find((b) => b.classList.contains("on"))?.textContent.trim(), placeholder: document.getElementById("input")?.placeholder }));
  await ask("write an html page showing the number 9", 60000);
  const got = await page.evaluate(() => { const x = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}"))[0]; return { codeSessionId: x?.codeSessionId || null, last: (x?.messages || []).slice(-1)[0]?.content?.slice(0, 60) || "" }; });
  ok("Code engagement dispatches the turn through the machine door (/api/code)",
    engaged.on === "Code" && /change/.test(engaged.placeholder || "") && codeCalls.length >= 1 && typeof got.codeSessionId === "string" && got.codeSessionId.startsWith("ses_"),
    `engaged=${engaged.on} placeholder="${engaged.placeholder}" codeCalls=${codeCalls.length} session=${got.codeSessionId}`,
    "Code mode does not call /api/code, or lands no ses_ session → the engagement is not dispatching");
  await page.evaluate(() => { for (const b of document.querySelectorAll(".agentbtn")) if (b.textContent.trim() === "Chat") b.click(); });
  await page.waitForTimeout(300);
  const backEng = await page.evaluate(() => [...document.querySelectorAll(".agentbtn")].find((b) => b.classList.contains("on"))?.textContent.trim());
  ok("Chat engagement switches back cleanly",
    backEng === "Chat",
    `engaged=${backEng}`,
    "returning to Chat leaves Code engaged → the toggle is sticky");
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