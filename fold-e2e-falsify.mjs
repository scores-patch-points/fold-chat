// fold-e2e-falsify.mjs — drive the LIVE fold-chat surface and try to BREAK
// every claim. A claim that survives its falsifier stands; one that falls is
// the finding. Each check names what would prove it wrong.
//
//   node fold-e2e-falsify.mjs
//
// Requires the live stack: fold-chat on :8814, heimdall bridge :8790,
// the Fold's opencode :4099, khora read :11436. Playwright chromium:
//   npm i && npx playwright install chromium

// Playwright is a devDependency (npm i). The old scratch install is kept as a
// fallback so a machine that already has it keeps working.
let chromium;
try { ({ chromium } = await import("playwright")); }
catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }

const URL = process.env.FOLD_URL || "http://127.0.0.1:8814/";
const results = [];
const ok = (claim, survived, evidence, falsifier) => results.push({ claim, verdict: survived ? "STANDS" : "FALSIFIED", evidence, falsifier });

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
// The SURFACE's errors are the top window's. (The agent lane deliberately runs code it
// drew inside a sandboxed iframe to LOOK at it — that code failing, e.g. "Unexpected
// token 'export'", is the observation, not a surface error — and Playwright's `pageerror`
// does not say which frame an error came from.) So collect from the top window itself.
await ctx.addInitScript(() => {
  if (window.top !== window) return;
  window.__surfaceErrors = [];
  addEventListener("error", (e) => window.__surfaceErrors.push(String(e.message)));
  addEventListener("unhandledrejection", (e) => window.__surfaceErrors.push("unhandled rejection: " + String(e.reason && e.reason.message || e.reason)));
});
await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
// Every non-greeting turn searches the web (the globe is an indicator, not a
// switch), so there is nothing to turn off. (A fresh browser context starts the
// effort control at its default, Balanced.)

// The "this turn" chip (#turnBtn) lives in the composer and opens a menu with a
// MODE row (Chat / Agent: data-mode) and, in Chat, an EFFORT row (Fast / Balanced
// / Deep: data-effort). Drive it like a person would.
const setEffort = async (level) => {
  await page.click("#turnBtn");
  await page.click(`.epop [data-effort="${level}"]`);
  await page.waitForFunction((l) => document.getElementById("turnBtn")?.dataset.effort === l, level, { timeout: 5000 });
};
const setMode = async (mode) => {            // "chat" | "code" (the Agent engagement)
  await page.click("#turnBtn");
  await page.click(`.epop [data-mode="${mode}"]`);
  await page.waitForFunction((m) => document.getElementById("turnBtn")?.dataset.mode === m, mode, { timeout: 5000 });
};
// A running turn locks the composer: the textarea is read-only and aria-busy while
// the send button is Stop. Wait for the lock to lift.
// (waitForFunction(fn, arg, options): the timeout is the THIRD argument.)
const turnDone = (timeout = 240000) => page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled && !i.readOnly && i.getAttribute("aria-busy") !== "true"; }, undefined, { timeout }).then(() => true).catch(() => false);
// Send a message and wait until the turn has actually begun (the composer locked,
// or the answer already landed), so turnDone() cannot return before it starts.
const startTurn = async (text) => {
  const before = await page.evaluate(() => document.querySelectorAll(".msg.assistant").length);
  await page.fill("#input", text); await page.click("#send");
  await page.waitForFunction((n) => document.getElementById("input")?.getAttribute("aria-busy") === "true" || document.querySelectorAll(".msg.assistant").length > n, before, { timeout: 15000 }).catch(() => {});
};
// A question the web can really answer (the synthetic Keeper prompts cannot).
const Q = "Who founded the city of Nashville, and when?";
const storedTurns = () => page.evaluate(() => {
  const all = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated));
  return (all[0]?.messages || []).map((m) => ({ role: m.role, content: String(m.content || "").slice(0, 60), effort: m.effort ?? null, recEffort: m.grounding?.effort ?? null, process: m.grounding?.process ?? null }));
});

const $ = (id) => document.querySelector("#" + id);
const ask = async (text, ms = 30000) => {
  // Wait for the composer to be enabled (a prior turn, incl. a web search over
  // slow public APIs, disables it). A public API can stall up to ~50s; bound
  // the wait generously, and if it still hasn't returned, that is a NETWORK
  // stall, not a fold failure — record it and carry on rather than crash.
  const ready = await turnDone(150000);
  if (!ready) { results.push({ claim: `turn dispatched: "${String(text).slice(0, 40)}…"`, verdict: "STALLED (network)", evidence: "composer still disabled after 150s — a public API stalled, not the fold", falsifier: "n/a — network" }); return; }
  await startTurn(text); await page.waitForTimeout(ms);
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
  // 2026-10-05: this used to assert panelCount() === 0. A writing turn has always carried the quiet
  // "how this was answered" line (its record), so that held only while the essay was still being written when
  // the 60 s wait ended. What the claim means is that a written piece is not SCORED as a claim — no "✱ N of M
  // sentences have no source" mark — and that is what is checked.
  const scoredAsClaim = await page.evaluate(() => /\d+ of \d+ sentences? (has|have) no source/.test([...document.querySelectorAll(".msg.assistant")].slice(-1)[0]?.innerText || ""));
  ok("a write request is NOT scored as a claim (no \"✱ N of M sentences have no source\" mark)",
    !scoredAsClaim,
    `scoredAsClaim=${scoredAsClaim}`,
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
  // The facing page (RESPONSE left, SOURCES right) renders inside the assistant
  // message body. Its claims need a question the web can really answer — the
  // synthetic Keeper prompt above has no web ground, so it can never yield
  // sources — so ask a retrievable one. A small local model sometimes answers
  // such a question from memory (then the page honestly says "nothing carried"),
  // so a turn that carried no source is retried; the claim falls only if three
  // honest attempts in a row never ground anything.
  // The answer ends in ONE collapsed line ("3 passages from 1 source …"); opening it
  // lists the DOCUMENTS read and the passages each supplied.
  const readFace = async () => {
    await page.evaluate(() => { const l = [...document.querySelectorAll(".msg.assistant")].slice(-1)[0]?.querySelector(".face-sources .srcline"); if (l && l.getAttribute("aria-expanded") !== "true") l.click(); });
    return page.evaluate(() => {
      const msg = [...document.querySelectorAll(".msg.assistant")].slice(-1)[0];
      const f = msg?.querySelector(".body .facing");
      if (!f) return null;
      const line = f.querySelector(".srcline");
      const docs = [...f.querySelectorAll(".face-sources .srclist .srcdoc")].map((d) => ({
        title: d.querySelector(".src-title")?.textContent?.trim(),
        dom: d.querySelector(".src-dom")?.textContent?.trim(),
        passages: [...d.querySelectorAll(".src")].map((s) => ({
          n: s.querySelector(".src-n")?.textContent?.trim(),
          quote: s.querySelector(".src-quote")?.textContent?.trim() || "",
          ex: s.querySelector(".src-ex")?.textContent || "",
        })),
      }));
      const all = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated));
      const rec = [...(all[0]?.messages || [])].reverse().find((m) => m.role === "assistant" && m.grounding?.facing)?.grounding.facing;
      return {
        docs, srcs: docs.flatMap((d) => d.passages),
        lineText: line?.textContent?.replace(/\s+/g, " ").trim() || "",
        expanded: line?.getAttribute("aria-expanded") === "true",
        tags: (rec?.response || []).map((r) => r.tag),
        recSources: (rec?.sources || []).map((x) => x.n),
        answerLen: (f.querySelector(".face-response .ganswer")?.textContent || "").length,
        cols: getComputedStyle(f).gridTemplateColumns,
      };
    });
  };
  let face = null, attempts = 0;
  while (attempts < 3 && !(face && face.srcs.length >= 1)) {
    attempts++;
    await turnDone(300000);
    await startTurn(Q);
    await turnDone(300000);
    await page.waitForSelector(".msg.assistant .body .facing", { timeout: 15000 }).catch(() => {});
    face = await readFace();
  }
  const quoteOk = (p) => p.quote.length >= 15 && p.ex.includes(p.quote);
  const nPass = face ? face.srcs.length : 0;
  ok("the facing page renders: the answer, then ONE sources line that opens to documents (title + domain), each with numbered passages carrying a highlighted verbatim quote",
    !!face && face.answerLen > 0 && face.expanded && face.docs.length >= 1 && face.srcs.length >= 1 &&
      face.docs.every((d) => d.title && d.dom && d.passages.length >= 1) &&
      face.srcs.every((p) => /^S\d+$/.test(p.n || "") && quoteOk(p)) &&
      new RegExp(`^.?\\s*${nPass} passages? from ${face.docs.length} sources?`).test(face.lineText),
    JSON.stringify(face && { attempts, line: face.lineText, docs: face.docs.map((d) => ({ title: (d.title || "").slice(0, 30), dom: d.dom, passages: d.passages.map((p) => ({ n: p.n, quote: p.quote.slice(0, 36) })) })), cols: face.cols }),
    "no collapsed sources line, no documents with a title/domain, or a passage without a numbered tag and a verbatim quote inside its excerpt → the spread is not rendered");
  ok("every grounded sentence resolves to a listed passage: each sentence is tagged [S#] or [M], and every [S#] is a passage shown under its document",
    !!face && face.tags.length >= 1 && face.tags.every((t) => /^(S\d+|M)$/.test(t || "")) && face.tags.some((t) => /^S\d+$/.test(t)) &&
      face.tags.filter((t) => /^S\d+$/.test(t)).every((t) => face.srcs.some((p) => p.n === t) && face.recSources.includes(t)) &&
      face.srcs.every((p) => face.recSources.includes(p.n)),
    JSON.stringify(face && { attempts, passages: face.srcs.map((p) => p.n), tags: face.tags }),
    "a sentence is tagged with a passage that is not listed, or a listed passage is not in the record → grounding is not traceable");
}

// ── F3b. effort is PER TURN: turn A is sent with Fast and keeps Fast although the
// control moves to Deep while it runs; turn B is then sent with Deep; neither
// turn's record changes the other's. (Records only — whether the small model's
// answer happens to be grounded is not what is under test here.) ──
{
  const t0 = Date.now();
  await turnDone(300000);
  await setEffort("fast");
  await startTurn(Q);
  await setEffort("deep");               // moved mid-turn: must not reach back into A
  await turnDone(300000);
  const turnsA = await storedTurns();    // the thread so far; A is its last user/assistant pair
  const aOk = turnsA.length >= 2 && turnsA[turnsA.length - 1].role === "assistant";
  const lineA = await page.evaluate(() => [...document.querySelectorAll(".msg.assistant .disclosure .disc-line")].slice(-1)[0]?.textContent || "");
  await startTurn(Q);                                           // B: the control still says Deep
  const bDone = await turnDone(900000);  // Deep reads 6+ sources and falsifies: minutes, by design
  const turns = await storedTurns();
  // B is the pair appended after A; A is re-read from the SAME positions after B ran.
  const userB = turns[turnsA.length], recB = turns[turnsA.length + 1];
  const userA = turns[turnsA.length - 2], recA = turns[turnsA.length - 1];
  const lineB = await page.evaluate(() => [...document.querySelectorAll(".msg.assistant .disclosure .disc-line")].slice(-1)[0]?.textContent || "");
  const chip = await page.evaluate(() => ({ e: document.getElementById("turnBtn")?.dataset.effort, stored: localStorage.getItem("fold-chat:effort") }));
  ok("effort is per turn: A (Fast) stays Fast after the control moved to Deep mid-turn, B carries Deep, and each turn's process line says so",
    aOk && bDone && userA?.effort === "fast" && recA?.recEffort === "fast" && /effort · Fast/.test((recA.process || []).join("|")) && !/falsified/.test((recA.process || []).join("|")) &&
      /effort fast/.test(lineA) &&
      userB?.effort === "deep" && recB?.recEffort === "deep" && /effort · Deep/.test((recB.process || []).join("|")) && /effort deep/.test(lineB) &&
      chip.e === "deep" && chip.stored === "deep",
    JSON.stringify({ A: { user: userA?.effort, rec: recA?.recEffort, line: lineA }, B: { user: userB?.effort, rec: recB?.recEffort, line: lineB, done: bDone }, chip, secs: Math.round((Date.now() - t0) / 1000) }),
    "A's recorded effort changed when the control moved, B did not carry Deep, the process line omits the effort, or the control forgot its last value → effort is not captured per turn");
}

// ── F3c. the chrome budget: a conversation at rest shows 12 or fewer visible controls
// (buttons, links, fields; hover-only ones excluded), however many sources the answer has ──
{
  const ctx2 = await browser.newContext();   // its own storage: only the seeded chat
  const p2 = await ctx2.newPage();
  await p2.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await p2.evaluate(() => {
    const now = new Date().toISOString();
    const doc = { label: "Wikipedia — Nashville, Tennessee", source: "https://en.wikipedia.org/wiki/Nashville,_Tennessee", url: "https://en.wikipedia.org/wiki/Nashville,_Tennessee", domain: "en.wikipedia.org" };
    const P = (n, mark) => ({ n, address: doc.label + "#" + n, ref: doc.label, span: { start: 1, end: 2 }, ...doc, text: mark, before: "", mark, after: "", ellipsisBefore: true, ellipsisAfter: true, cite: 1 });
    const srcs = [P("S1", "established a trading post in 1689"), P("S2", "chartered by the North Carolina General Assembly in 1784"), P("S3", "named in honor of Francis Nash")];
    const text = "Nashville grew from a trading post in 1689 and was chartered in 1784.";
    const rec = { turn: 1, kind: "research", effort: "balanced", hasMaterial: true, coverage: { grounded: 1, total: 2 }, process: ["classified · question of fact"],
      void: { kind: "partial", counts: { sentences: 2, grounded: 1 }, read: [], tried: [], question: "q", closeBy: ["a broader web/records/news search"] },
      facing: { sources: srcs, response: [{ tag: "S1", text, grounded: true, address: srcs[0].address }, { tag: "M", text: "x", grounded: false, address: null }] } };
    const msgs = [{ role: "user", content: "q", at: now, mode: "chat", effort: "balanced" }, { role: "assistant", content: text, at: now, mode: "chat", grounding: rec }];
    localStorage.setItem("fold-chat:sessions", JSON.stringify({ seed: { id: "seed", title: "seed", titleAuto: false, named: true, icon: "map-trifold", messages: msgs, grounding: true, effort: "balanced", model: "gemma2:2b", sealed: false, project: null, preset: "fold", cwd: null, createdAt: now, updated: now } }));
  });
  await p2.reload({ waitUntil: "networkidle" }); await p2.waitForTimeout(800);
  const visible = await p2.evaluate(() => {
    const sel = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=menuitem], [role=menuitemradio], [tabindex]:not([tabindex="-1"])';
    const out = [];
    for (const e of new Set(document.querySelectorAll(sel))) {
      const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.right <= 0 || r.left >= innerWidth) continue;
      let ok = true, op = 1;
      for (let n = e; n && n !== document.documentElement; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === "none" || cs.visibility === "hidden") { ok = false; break; } op *= parseFloat(cs.opacity); }
      if (ok && op >= 0.1) out.push((e.id ? "#" + e.id : e.tagName.toLowerCase() + "." + String(e.className).split(" ")[0]));
    }
    return out;
  });
  ok("a conversation at rest shows 12 or fewer visible controls (ONE explanation affordance per answer: the disc-head opens the facing page and the process together; the sources line is not shown; actions wait for hover)",
    visible.length <= 12 && !visible.includes("button.srcline") && visible.includes("button.disc-head"),
    `${visible.length} controls: ${visible.join(" ")}`,
    "more than 12 controls are on screen at rest → the chrome has crept back");
  await ctx2.close();
}

// ── F4. Agent engagement dispatches the turn through the machine door ──
// (The design moved from embedding an opencode pane to a Claude-Code-shaped
// shared-session engagement: Agent dispatches the SAME turn through the door.)
{
  // An Agent turn must hit the bridge's /api/code and land a code session id.
  const codeCalls = [];
  page.on("request", (r) => { if (r.url().includes("/api/code") && r.method() === "POST") codeCalls.push(r.url()); });
  await setMode("code");
  await page.waitForTimeout(300);
  const engaged = await page.evaluate(() => ({ on: document.getElementById("turnBtn")?.dataset.mode === "code" ? "Agent" : "Chat", chip: document.getElementById("turnBtn")?.textContent.trim(), placeholder: document.getElementById("input")?.placeholder }));
  // Agent has no grounded pipeline: the chip drops its effort and the menu offers no effort row.
  await page.click("#turnBtn");
  const agentMenu = await page.evaluate(() => ({ efforts: document.querySelectorAll(".epop [data-effort]").length, modes: document.querySelectorAll(".epop [data-mode]").length }));
  await page.keyboard.press("Escape");
  ok("the effort control is not offered in Agent engagement (the chip reads \"Agent\", the menu has no effort row, only the mode row)",
    agentMenu.efforts === 0 && agentMenu.modes === 2 && engaged.chip === "Agent",
    `chip="${engaged.chip}" effortItems=${agentMenu.efforts} modeItems=${agentMenu.modes}`,
    "an effort row is offered for a turn it cannot affect");
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
  await setMode("chat");
  await page.waitForTimeout(300);
  await page.click("#turnBtn");
  const backMenu = await page.evaluate(() => ({ mode: document.getElementById("turnBtn")?.dataset.mode, efforts: document.querySelectorAll(".epop [data-effort]").length }));
  await page.keyboard.press("Escape");
  ok("Chat engagement switches back cleanly, and the effort row returns",
    backMenu.mode === "chat" && backMenu.efforts === 3,
    `mode=${backMenu.mode} effortItems=${backMenu.efforts}`,
    "returning to Chat leaves Agent engaged or the effort row missing → the toggle is sticky");
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
const pageErrors = await page.evaluate(() => window.__surfaceErrors || null);
ok("the surface raises no page error during the whole run",
  Array.isArray(pageErrors) && pageErrors.length === 0,
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

// ── F10. the everyday-chat defects (a blank bubble, a forged attribution, a leaked [W1], the model speaking
// alone, Sources-only making no model call …) — deterministic: the chat endpoint and Wikipedia are stubbed at the
// network layer in fresh contexts. See fold-e2e-everyday-checks.mjs. ──
{
  const { runEverydayChecks } = await import("./fold-e2e-everyday-checks.mjs");
  await runEverydayChecks({ browser, URL, ok });
}

// ── F11. chat quality: a gate refusal falls back to the strand, the live turn feed, the + beside Chats, the models-loaded
// footer, and no-bridge Sources only. See fold-e2e-turn-feedback.mjs. ──
{
  const { runTurnFeedbackChecks } = await import("./fold-e2e-turn-feedback.mjs");
  await runTurnFeedbackChecks({ browser, URL, ok });
}

await browser.close();

const falsified = results.filter((r) => r.verdict === "FALSIFIED");
console.log("\n=== E2E + FALSIFY ===");
for (const r of results) console.log(`${r.verdict === "STANDS" ? "✔ stands " : "✘ FALSIFIED"} — ${r.claim}\n    evidence: ${r.evidence}\n    falsifier: ${r.falsifier}`);
console.log(`\n${results.length - falsified.length}/${results.length} stand · ${falsified.length} falsified`);
process.exit(falsified.length ? 1 : 0);