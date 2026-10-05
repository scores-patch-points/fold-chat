// fold-e2e-everyday-checks.mjs — falsifiers for the everyday-chat defects, driven through the REAL page in
// fresh headless contexts (own localStorage). The bridge's chat endpoint and Wikipedia's API are STUBBED at the
// network layer so each check is deterministic: what is under test is the fold's handling of what comes back
// (a blank stream, a 502, a forged attribution, a leaked [W1]), and the invariant that the model never speaks alone.
//
//   called by fold-e2e-falsify.mjs:   await runEverydayChecks({ browser, URL, ok })
//   standalone:                        node fold-e2e-everyday-checks.mjs
//
// Each check names what would prove it wrong (`ok(claim, survived, evidence, falsifier)`).
import { contentAllowed } from "./fold-chat-strand.js";
import { ALONE_KINDS } from "./fold-chat-gaps.js";

const Q = "Who founded the city of Nashville, and when?";
// What the stubbed Wikipedia serves: one article whose own sentences the strand must quote verbatim.
const ARTICLE = "Nashville is the capital and most populous city of the U.S. state of Tennessee. Nashville was founded in 1779 by James Robertson and John Donelson, and it was named for Francis Nash, a general of the American Revolutionary War. "
  + Array.from({ length: 24 }, (_, i) => `Filler sentence number ${i} describes traffic, weather and music venues in a way that matters little to the question of who founded the city.`).join(" ")
  + " The city was incorporated in 1806 and became the state capital in 1843.";
const sse = (text) => "data: " + JSON.stringify({ choices: [{ delta: { content: text } }] }) + "\n\ndata: [DONE]\n\n";

async function withPage(browser, URL, { chat = null, answerMode = null, wiki = true } = {}, fn) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  if (answerMode) await ctx.addInitScript((m) => { try { localStorage.setItem("fold-chat:answerMode", m); } catch {} }, answerMode);
  const page = await ctx.newPage();
  const posts = [];
  page.on("request", (r) => { if (r.method() === "POST" && /\/v1\/chat\/completions/.test(r.url())) posts.push(r.url()); });
  if (chat !== null) await page.route("**/v1/chat/completions", (route) => {
    if (chat === "EMPTY") return route.fulfill({ status: 200, contentType: "text/event-stream", body: "data: [DONE]\n\n" });
    if (chat === "502") return route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: { message: "upstream exploded" } }) });
    if (chat === "FORBID") return route.fulfill({ status: 200, contentType: "text/event-stream", body: sse("THE MODEL WAS CALLED and wrote this.") });
    return route.fulfill({ status: 200, contentType: "text/event-stream", body: sse(chat) });
  });
  // Wikipedia: search + extract served from the fixture (or refused outright); every other search door refused.
  await page.route(/wikipedia\.org\/w\/api\.php/, (route) => {
    if (!wiki) return route.abort();
    const u = route.request().url();
    const cors = { "access-control-allow-origin": "*" };
    if (/list=search/.test(u)) return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ query: { search: [{ title: "Nashville, Tennessee", snippet: "Nashville is the capital of Tennessee", wordcount: 9000 }] } }) });
    if (/prop=extracts/.test(u)) return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ query: { pages: { 1: { title: "Nashville, Tennessee", extract: ARTICLE } } } }) });
    return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: "{}" });
  });
  await page.route(/(workers\.dev|duckduckgo|brave\.com|api\.github\.com|archive\.org|openalex\.org|crossref\.org|r\.jina\.ai|allorigins|corsproxy|microlink)/, (r) => r.abort());
  await page.route(/127\.0\.0\.1:8790\/api\/(search|page)/, (r) => r.abort());
  try {
    await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled; }, undefined, { timeout: 60000 });
    return await fn(page, posts);
  } finally { await ctx.close(); }
}

async function send(page, text, timeout = 90000) {
  await page.fill("#input", text); await page.click("#send");
  await page.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).some((s) => (s.messages || []).some((m) => m.role === "assistant")), undefined, { timeout }).catch(() => {});
  await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled && !i.readOnly && i.getAttribute("aria-busy") !== "true"; }, undefined, { timeout }).catch(() => {});
}
const stored = (page) => page.evaluate(() => {
  const s = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {};
  return s.messages || [];
});
const lastBubble = (page) => page.evaluate(() => {
  const m = [...document.querySelectorAll(".msg.assistant")].slice(-1)[0];
  if (!m) return null;
  const b = m.querySelector(".body");
  return { text: (b?.innerText || "").replace(/\s+/g, " ").trim(), retry: !!m.querySelector(".note-retry"), strand: !!m.querySelector(".strand"), snips: m.querySelectorAll(".strand-snip").length, gap: !!m.querySelector(".gap"), leaked: /\[[WSM]\d*\]/.test(m.innerText), cites: m.querySelectorAll(".cite-chip").length };
});

export async function runEverydayChecks({ browser, URL, ok }) {
  // ── E1. a blank stream is never a blank bubble ───────────────────────────
  await withPage(browser, URL, { chat: "EMPTY" }, async (page) => {
    await send(page, Q);
    const msgs = await stored(page); const a = msgs.filter((m) => m.role === "assistant").pop(); const b = await lastBubble(page);
    ok("a turn whose model streams NO text is never a blank bubble: a typed 'empty' note is stored and drawn, with a retry",
      !!a && !String(a.content || "").trim() && (a.notices || []).some((n) => n.kind === "empty" && n.retry) && !!b && b.text.length > 20 && b.retry,
      JSON.stringify({ content: a?.content, notices: (a?.notices || []).map((n) => n.kind), bubble: b?.text.slice(0, 120), retry: b?.retry }),
      "an assistant message with empty content and no notice, or a bubble with no text / no retry → the blank bubble is back");
  });
  // ── E2. a failed turn is stored (not an ephemeral 'error:' string) and survives a reload ──
  await withPage(browser, URL, { chat: "502" }, async (page) => {
    await send(page, Q);
    const a = (await stored(page)).filter((m) => m.role === "assistant").pop();
    await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(600);
    const b = await lastBubble(page);
    ok("a turn that DIED (bridge 502) is stored as a typed, retry-able note and is still there after a reload",
      !!a && (a.notices || []).some((n) => n.kind === "error" && n.retry) && !!b && /turn failed|Nothing was written/i.test(b.text) && b.retry && !/^error:/i.test(b.text),
      JSON.stringify({ notices: (a?.notices || []).map((n) => n.kind), afterReload: b?.text.slice(0, 100), retry: b?.retry }),
      "the failure was only a transient 'error: …' string, lost on reload, with no retry → a dead turn leaves nothing");
  });
  // ── E3. a forged attribution is neutralised; a leaked [W1] never reaches the person ──
  await withPage(browser, URL, { chat: "According to The Weather Channel, Nashville was founded in 1779 [W1]. According to the information provided in [W1], it was named for Francis Nash." }, async (page) => {
    await send(page, Q);
    const a = (await stored(page)).filter((m) => m.role === "assistant").pop(); const b = await lastBubble(page);
    ok("the model may not name a source the page did not give it: 'According to The Weather Channel' is removed and recorded as a typed notice",
      !!a && !/Weather Channel/i.test(a.content || "") && /Nashville was founded in 1779/.test(a.content || "") && (a.notices || []).some((n) => n.kind === "attribution" && /Weather Channel/.test(n.text)),
      JSON.stringify({ content: a?.content, notices: (a?.notices || []).map((n) => n.kind) }),
      "the stored answer still credits a source nobody read, or no 'attribution removed' notice exists → II.9 is broken");
    ok("a source-block marker ([W1]) never reaches the person: it is stripped from the text and the passage it pointed at is drawn as a real citation chip",
      !!a && !/\[[WS]\d+\]/.test(a.content || "") && !!b && !b.leaked && b.cites >= 1,
      JSON.stringify({ content: a?.content, leakedInDom: b?.leaked, chips: b?.cites }),
      "'[W1]' is in the stored answer or on screen, or no citation chip replaced it → scaffolding leaks");
  });
  // ── E4. SOURCES ONLY: no model call, verbatim snips, verifiable ──────────
  await withPage(browser, URL, { chat: "FORBID", answerMode: "snips" }, async (page, posts) => {
    await send(page, Q);
    const msgs = await stored(page); const a = msgs.filter((m) => m.role === "assistant").pop(); const b = await lastBubble(page);
    const flat = ARTICLE.replace(/\s+/g, " ");
    const snips = a?.snips || [];
    ok("Sources only: NO request is POSTed to /v1/chat/completions (the model is not called at all)",
      posts.length === 0 && a?.authored === "sources" && a?.answerMode === "snips",
      `chatPOSTs=${posts.length} authored=${a?.authored} answerMode=${a?.answerMode} userMode=${msgs.find((m) => m.role === "user")?.answerMode}`,
      "a chat completion was requested on a Sources-only turn → the model spoke");
    ok("Sources only: the answer is the page's own words — every stored snip's text occurs in the page text it came from, and message.content is their plain concatenation",
      snips.length >= 1 && snips.every((s) => flat.includes(String(s.text).replace(/\s+/g, " "))) && String(a.content).replace(/\s+/g, " ") === snips.map((s) => String(s.text).replace(/\s+/g, " ")).join(" ").replace(/\s+/g, " ") && !/THE MODEL WAS CALLED/.test(a.content),
      JSON.stringify({ n: snips.length, first: String(snips[0]?.text || "").slice(0, 90), credit: snips[0]?.credit, kinds: snips.map((s) => s.kind) }),
      "a snip is not a substring of the page it names → the strand is not verbatim");
    ok("Sources only is drawn as one reading column: the passages, each with its S# chip, credit and link; no model-written prose",
      !!b && b.strand && b.snips >= 1,
      JSON.stringify({ strand: b?.strand, snips: b?.snips }),
      "the strand column is missing from a Sources-only turn");
    // the chip remembers the choice and a re-run reuses it
    const chip = await page.evaluate(() => ({ stored: localStorage.getItem("fold-chat:answerMode"), data: document.getElementById("turnBtn")?.dataset.answer }));
    ok("the Answer choice is remembered (fold-chat:answerMode) and shown on the chip",
      chip.stored === "snips" && chip.data === "snips", JSON.stringify(chip), "the chip forgot the answer mode");
  });
  // ── E5. no sources → NO model-written answer, only a typed gap ───────────
  await withPage(browser, URL, { chat: "FORBID", wiki: false }, async (page, posts) => {
    await send(page, Q);
    const a = (await stored(page)).filter((m) => m.role === "assistant").pop(); const b = await lastBubble(page);
    ok("a turn with NO sources produces no model-written answer: no model call, empty content, an app-authored typed gap built from the real search trace, with a retry",
      posts.length === 0 && !!a && !String(a.content || "").trim() && a.grounding?.void?.kind === "unreached" && /Searched for/.test(a.grounding?.void?.note || "") && !!b && b.gap && b.retry,
      JSON.stringify({ chatPOSTs: posts.length, content: a?.content, gap: a?.grounding?.void && { kind: a.grounding.void.kind, note: a.grounding.void.note }, retry: b?.retry }),
      "the model wrote something with nothing read, or the gap is not drawn / has no trace → the model spoke alone");
  });
  // ── E6. the kinds that search nothing are app-authored: a card, a fixed line, a note ──
  await withPage(browser, URL, { chat: "FORBID" }, async (page, posts) => {
    await send(page, "What is 15% of 240?");
    const calc = await page.evaluate(() => { const m = [...document.querySelectorAll(".msg.assistant")].slice(-1)[0]; return { card: !!m?.querySelector(".calc"), text: m?.querySelector(".calc")?.innerText.replace(/\s+/g, " ") }; });
    ok("arithmetic is a mechanical result card (the fold's evaluator), not a model's sentence",
      posts.length === 0 && calc.card && /15% of 240/.test(calc.text) && /= 36/.test(calc.text), JSON.stringify({ posts: posts.length, ...calc }), "a model computed the number, or no result card was drawn");
    await send(page, "hi");
    const hi = await lastBubble(page);
    ok("a greeting is a fixed app-authored line, not model prose",
      posts.length === 0 && !!hi && /show you what the sources say/.test(hi.text), JSON.stringify({ posts: posts.length, text: hi?.text }), "a model answered a greeting alone");
    await send(page, "Write a short thank-you note to my neighbor for watering my plants");
    const note = await lastBubble(page);
    ok("a creative ask with no sources is an app-authored note saying there are no sources for this kind of ask — never a blank bubble, never a model-written note",
      posts.length === 0 && !!note && /no sources for this kind of ask/.test(note.text), JSON.stringify({ posts: posts.length, text: note?.text.slice(0, 140) }), "the model wrote the note, or the bubble is blank");
  });
  // ── E7. the invariant, swept over EVERYTHING stored by the runs above ─────
  await withPage(browser, URL, { chat: "FORBID" }, async (page) => {
    await send(page, "What is 2+2?");
    await send(page, "hi");
    const all = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).flatMap((s) => s.messages || []));
    const bad = all.filter((m) => !contentAllowed(m, ALONE_KINDS));
    ok("INVARIANT: no stored assistant message has non-notice content unless the turn had a source (or is a sources strand, or an ALONE_KINDS kind)",
      all.some((m) => m.role === "assistant") && bad.length === 0, JSON.stringify({ assistant: all.filter((m) => m.role === "assistant").length, violations: bad.map((m) => String(m.content).slice(0, 60)) }), "a stored message carries words nobody sourced");
  });
}

// standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  let chromium;
  try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
  const results = [];
  const ok = (claim, survived, evidence, falsifier) => results.push({ claim, verdict: survived ? "STANDS" : "FALSIFIED", evidence, falsifier });
  const browser = await chromium.launch();
  await runEverydayChecks({ browser, URL: process.env.FOLD_URL || "http://127.0.0.1:8814/", ok });
  await browser.close();
  for (const r of results) console.log(`${r.verdict === "STANDS" ? "✔ stands " : "✘ FALSIFIED"} — ${r.claim}\n    evidence: ${r.evidence}\n    falsifier: ${r.falsifier}`);
  const bad = results.filter((r) => r.verdict !== "STANDS");
  console.log(`\n${results.length - bad.length}/${results.length} stand`);
  process.exit(bad.length ? 1 : 0);
}
