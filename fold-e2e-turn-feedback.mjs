// fold-e2e-turn-feedback.mjs — falsifiers for the chat-quality fixes of 2026-10-05, driven through the REAL page in fresh
// headless contexts (own localStorage; never the shared pane). The model's chat endpoint, Wikipedia and the bridge's
// /api/ps are STUBBED at the network layer, so each check is deterministic.
//
//   1. a model call the safety gate REFUSES (403) never ends a turn that read sources with nothing: the strand is drawn;
//   2. a slow search is a LIVE FEED (several visible states, a ticking clock, an honest "waiting on …" line), Stop works,
//      and the feed collapses into "how this was answered" and replays from the stored trace after a reload;
//   3. the + beside "Chats" is the one new-chat control there (reuses an empty chat), touch-sized on a phone;
//   4. the footer says which models are LOADED (loaded / none loaded / bridge not reachable), not "sealed-external".
//
//   called by fold-e2e-falsify.mjs:   await runTurnFeedbackChecks({ browser, URL, ok })
//   standalone:                        node fold-e2e-turn-feedback.mjs

const Q = "Who founded the city of Nashville, and when?";
const ARTICLE = "Nashville is the capital and most populous city of the U.S. state of Tennessee. Nashville was founded in 1779 by James Robertson and John Donelson, and it was named for Francis Nash, a general of the American Revolutionary War. "
  + Array.from({ length: 24 }, (_, i) => `Filler sentence number ${i} describes traffic, weather and music venues in a way that matters little to the question of who founded the city.`).join(" ")
  + " The city was incorporated in 1806 and became the state capital in 1843.";
const GATE = "refused by the safety-and-ethics gate (AntiStrauss): the call contravenes the standing law — terror attack planning";
const sse = (text) => "data: " + JSON.stringify({ choices: [{ delta: { content: text } }] }) + "\n\ndata: [DONE]\n\n";
const CORS = { "access-control-allow-origin": "*" };

export async function withPage(browser, URL, { chat = "A short model answer.", wikiDelayMs = 0, viewport = { width: 1200, height: 900 }, mobile = false, colorScheme = "light", ps = undefined, bridgeDown = false, init = null, cookies = false, chatDelayMs = 0 } = {}, fn) {
  const ctx = await browser.newContext({ viewport, colorScheme, ...(mobile ? { hasTouch: true, isMobile: true } : {}) });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const posts = [];
  page.__bodies = []; page.__searches = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/v1\/chat\/completions/.test(r.url())) { posts.push(r.url()); page.__bodies.push(r.postData() || ""); }
    if (/wikipedia\.org\/w\/api\.php/.test(r.url()) && /list=search/.test(r.url())) { try { page.__searches.push(new globalThis.URL(r.url()).searchParams.get("srsearch") || ""); } catch {} }
  });
  await page.route("**/v1/chat/completions", async (route) => {
    if (chatDelayMs) await new Promise((r) => setTimeout(r, chatDelayMs));
    if (chat === "GATE403") return route.fulfill({ status: 403, headers: CORS, contentType: "application/json", body: JSON.stringify({ error: { message: GATE } }) });
    return route.fulfill({ status: 200, headers: CORS, contentType: "text/event-stream", body: sse(chat) });
  });
  await page.route(/wikipedia\.org\/w\/api\.php/, async (route) => {
    if (wikiDelayMs) await new Promise((r) => setTimeout(r, wikiDelayMs));
    const u = route.request().url();
    if (/list=search/.test(u)) return route.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify({ query: { search: [{ title: "Nashville, Tennessee", snippet: "Nashville is the capital of Tennessee", wordcount: 9000 }] } }) });
    if (/prop=extracts/.test(u)) return route.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify({ query: { pages: { 1: { title: "Nashville, Tennessee", extract: ARTICLE } } } }) });
    return route.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: "{}" });
  });
  await page.route(/(workers\.dev|duckduckgo|brave\.com|api\.github\.com|archive\.org|openalex\.org|crossref\.org|r\.jina\.ai|allorigins|corsproxy|microlink)/, (r) => r.abort());
  await page.route(/127\.0\.0\.1:8790\/api\/(search|page)/, (r) => r.abort());
  // `cookies`: the open-web search (the relay) and the page read are STUBBED with a cookie-recipe page; the query asked is
  // recorded in page.__searches.
  if (cookies) {
    await page.route(/workers\.dev\/search/, (route) => {
      const q = new globalThis.URL(route.request().url()).searchParams.get("q") || ""; page.__searches.push(q);
      return route.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify({ scope: "web", engine: "stub", count: 1, results: [{ title: "Chocolate chip cookies - Cookie Recipes", url: "https://cookies.example/recipe", snippet: "A chocolate chip cookie recipe", source: "cookies.example" }] }) });
    });
    await page.route(/cookies\.example\//, (route) => route.fulfill({ status: 200, headers: CORS, contentType: "text/html", body: "<html><title>Chocolate chip cookies</title><body><p>" + "Cream the butter and both sugars until light and fluffy, then fold in the flour and the chocolate chips and bake for eleven minutes until golden. ".repeat(3) + "</p></body></html>" }));
  }
  // The footer's two sources. `ps`: { fleet: [...], local: [...] } models resident; `bridgeDown`: the bridge answers nothing.
  // `bridgeDown`: the bridge answers NOTHING (hello, tags, ps, chat — as on an origin it refuses). Registered LAST so it wins.
  if (bridgeDown) await page.route(/(localhost|127\.0\.0\.1):(8790|11434)\//, (r) => r.abort());
  else if (ps) {
    await page.route(/(localhost|127\.0\.0\.1):8790\/api\/ps/, (r) => r.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify({ models: ps.fleet || [] }) }));
    await page.route(/(localhost|127\.0\.0\.1):11434\/api\/ps/, (r) => r.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify({ models: ps.local || [] }) }));
  }
  try {
    await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled; }, undefined, { timeout: 60000 });
    return await fn(page, posts);
  } finally { await ctx.close(); }
}

export async function send(page, text, { wait = true, timeout = 90000 } = {}) {
  await page.fill("#input", text); await page.click("#send");
  if (!wait) return;
  await page.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).some((s) => (s.messages || []).some((m) => m.role === "assistant")), undefined, { timeout }).catch(() => {});
  await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled && !i.readOnly && i.getAttribute("aria-busy") !== "true"; }, undefined, { timeout }).catch(() => {});
}
export const stored = (page) => page.evaluate(() => {
  const s = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {};
  return s.messages || [];
});
const nSessions = (page) => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).length);

export async function runTurnFeedbackChecks({ browser, URL, ok }) {
  const flat = ARTICLE.replace(/\s+/g, " ");

  // ── 1. the gate refuses the model → the sources, never nothing ───────────
  await withPage(browser, URL, { chat: "GATE403" }, async (page, posts) => {
    await send(page, Q);
    const a = (await stored(page)).filter((m) => m.role === "assistant").pop();
    const dom = await page.evaluate(() => {
      const m = [...document.querySelectorAll(".msg.assistant")].slice(-1)[0];
      const note = m?.querySelector(".fold-note.kind-declined"), strand = m?.querySelector(".strand");
      const i = document.getElementById("input"), s = document.getElementById("send");
      return {
        note: note?.innerText.replace(/\s+/g, " ") || null, noteRetry: !!note?.querySelector(".note-retry"), strand: !!strand, snips: m?.querySelectorAll(".strand-snip").length || 0,
        noteAboveStrand: !!(note && strand && (note.compareDocumentPosition(strand) & Node.DOCUMENT_POSITION_FOLLOWING)),
        composerFree: !!i && !i.disabled && !i.readOnly && s?.dataset.state !== "stop", cites: m?.querySelectorAll(".strand-credit, .strand-snip a, .cite-chip").length || 0,
        text: (m?.querySelector(".body")?.innerText || "").replace(/\s+/g, " ").slice(0, 200),
      };
    });
    const snips = a?.snips || [];
    const dn = (a?.notices || []).find((n) => n.kind === "declined");
    ok("a model call the safety gate REFUSES (HTTP 403) never leaves a turn that read sources with nothing: the model WAS asked, and the answer is the sources-only strand with real snips",
      posts.length >= 1 && a?.authored === "sources" && snips.length >= 1 && snips.every((s) => flat.includes(String(s.text).replace(/\s+/g, " "))) && dn && String(a.content).trim().length > 40,
      JSON.stringify({ chatPOSTs: posts.length, authored: a?.authored, snips: snips.length, content: String(a?.content || "").slice(0, 80) }),
      "the turn ended with only an error note, or the strand's snips are not verbatim page text");
    ok("the typed note above the strand quotes the gate's own words, says 'Showing what the sources say instead', offers a retry; message.fellBackFrom is 'facing'",
      !!dn && dn.text.includes(GATE) && /^The model declined this request \(the safety gate said: /.test(dn.text) && /Showing what the sources say instead\.$/.test(dn.text) && a.fellBackFrom === "facing" && dom.noteAboveStrand && dom.noteRetry && dom.note?.includes("terror attack planning"),
      JSON.stringify({ note: dom.note?.slice(0, 160), fellBackFrom: a?.fellBackFrom, noteAboveStrand: dom.noteAboveStrand, retry: dom.noteRetry }),
      "no declined notice, a paraphrase of the gate, the note below the strand, no retry, or fellBackFrom missing");
    ok("after the fallback the composer is free and the strand is drawn (credit + passages)",
      dom.composerFree && dom.strand && dom.snips >= 1, JSON.stringify({ composerFree: dom.composerFree, strand: dom.strand, snips: dom.snips }),
      "the composer is still locked or no strand column is on screen");
  });

  // ── 2. a slow search is a live feed; Stop works; it collapses and replays ─
  await withPage(browser, URL, { wikiDelayMs: 4200, chatDelayMs: 1800 }, async (page) => {
    await send(page, Q, { wait: false });
    const states = new Set(), clocks = new Set(), seen = { slow: false, verb: new Set(), liveRows: 0, stop: false, tick: false };
    for (let i = 0; i < 80; i++) {
      await page.waitForTimeout(200);
      const snap = await page.evaluate(() => {
        const run = [...document.querySelectorAll(".msg.assistant .cc-run")].slice(-1)[0];
        if (!run) return null;
        const rows = [...run.querySelectorAll(".cc-step")].map((r) => r.querySelector(".cc-lab")?.textContent.trim() + "|" + r.className.replace(/cc-step\s*/, "") + "|" + (r.querySelector(".cc-note")?.textContent || "").trim());
        const active = [...run.querySelectorAll(".cc-step.cc-run .cc-tm")].map((x) => x.textContent.trim()).filter(Boolean);
        return { sig: rows.join(" // "), rows: rows.length, active, verb: run.querySelector(".cc-live-v")?.textContent || "", clock: run.querySelector(".cc-live-m")?.textContent || "", slow: /waiting on Wikipedia \(slow/.test(run.innerText), stop: !!run.querySelector(".cc-stop"), liveOn: run.classList.contains("cc-live-on") };
      });
      if (!snap) continue;
      states.add(snap.sig); if (snap.active.length) clocks.add(snap.active.join(",")); if (snap.clock) clocks.add("g:" + snap.clock.split("·")[0].trim());
      seen.slow ||= snap.slow; seen.stop ||= snap.stop; if (snap.verb) seen.verb.add(snap.verb); if (snap.liveOn) seen.liveRows++;
      const done = await page.evaluate(() => !document.querySelector(".msg.assistant .cc-run.cc-live-on"));
      if (done && i > 8) break;
    }
    ok("during a deliberately slow search the live feed shows at least 3 distinct visible states before the answer",
      states.size >= 3, JSON.stringify({ distinctStates: states.size, sample: [...states].slice(-1)[0]?.slice(0, 220) }),
      "the feed shows one static line (fewer than 3 distinct row-sets) while the search is slow");
    ok("the step in flight carries a TICKING clock (its elapsed time changes while we watch) and the live line names what it is waiting on",
      clocks.size >= 2 && [...seen.verb].some((v) => /Waiting on|Reading|Writing/.test(v)), JSON.stringify({ clocks: [...clocks].slice(0, 6), verbs: [...seen.verb] }),
      "no changing clock text was ever observed, or the status line never named a source");
    ok("an honest 'waiting on Wikipedia (slow: …)' line appears when the source really is slow, and the Stop control is on the feed",
      seen.slow && seen.stop, JSON.stringify({ slow: seen.slow, stop: seen.stop }), "the slow line never appeared, or the feed has no Stop");
    // the answer lands
    await page.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).some((s) => (s.messages || []).some((m) => m.role === "assistant")), undefined, { timeout: 60000 });
    await page.waitForTimeout(500);
    const landed = await page.evaluate(() => {
      const m = [...document.querySelectorAll(".msg.assistant")].slice(-1)[0];
      const disc = m?.querySelector(".disclosure");
      return { live: !!document.querySelector(".cc-run.cc-live-on"), line: disc?.querySelector(".disc-line")?.textContent || "", title: disc?.querySelector(".disc-title")?.textContent || "", closed: !disc?.classList.contains("open"), feedRows: disc?.querySelectorAll(".disc-feed .cc-step").length || 0 };
    });
    ok("when the answer lands the live feed is gone and collapses into the one 'how this was answered' line, summarising the turn",
      !landed.live && landed.title === "how this was answered" && /^Answered in /.test(landed.line) && landed.closed, JSON.stringify(landed),
      "a live feed is still on screen, or the disclosure line has no summary of the turn");
    await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(700);
    const re = await page.evaluate(async () => {
      const m = [...document.querySelectorAll(".msg.assistant")].slice(-1)[0];
      m?.querySelector(".disc-head")?.click();
      const run = m?.querySelector(".disc-feed .cc-run");
      const t0 = [...(run?.querySelectorAll(".cc-tm") || [])].map((x) => x.textContent).join(",");
      await new Promise((r) => setTimeout(r, 1200));
      const t1 = [...(run?.querySelectorAll(".cc-tm") || [])].map((x) => x.textContent).join(",");
      const labs = [...(run?.querySelectorAll(".cc-lab") || [])].map((x) => x.textContent.trim());
      return { rows: run?.querySelectorAll(".cc-step").length || 0, still: t0 === t1, live: !!run?.classList.contains("cc-live-on"), labs: labs.slice(0, 8), foot: run?.querySelector(".cc-fl")?.textContent || "" };
    });
    ok("after a reload the feed replays from the stored trace: the same rows, no live clock, no timers (the times do not change)",
      re.rows >= 3 && re.still && !re.live && re.labs.some((l) => /Wikipedia|Searching the web/.test(l)) && /^✓ Answered in /.test(re.foot), JSON.stringify(re),
      "no stored trace, or the replay is still ticking");
  });

  // Stop works on the new feed
  await withPage(browser, URL, { wikiDelayMs: 9000 }, async (page) => {
    await send(page, Q, { wait: false });
    await page.waitForSelector(".msg.assistant .cc-run .cc-stop", { timeout: 15000 });
    await page.waitForTimeout(600);
    await page.click(".msg.assistant .cc-run .cc-stop");
    await page.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).some((s) => (s.messages || []).some((m) => m.role === "assistant" && (m.notices || []).some((n) => n.kind === "stopped"))), undefined, { timeout: 15000 }).catch(() => {});
    const st = await page.evaluate(() => { const i = document.getElementById("input"); return { composerFree: !!i && !i.disabled, liveFeed: !!document.querySelector(".cc-run.cc-live-on"), stopped: [...document.querySelectorAll(".fold-note.kind-stopped")].length }; });
    const a = (await stored(page)).filter((m) => m.role === "assistant").pop();
    ok("Stop on the feed ends the turn: a typed 'stopped' note, the live feed removed, the composer free",
      (a?.notices || []).some((n) => n.kind === "stopped") && st.composerFree && !st.liveFeed && st.stopped >= 1, JSON.stringify(st),
      "the turn kept running after Stop, or the feed stayed on screen");
  });

  // ── 3. the + beside "Chats" ──────────────────────────────────────────────
  await withPage(browser, URL, {}, async (page) => {
    const info = await page.evaluate(() => {
      const head = document.querySelector('.sec[data-sec="chats"] .sec-head'), b = head?.querySelector("#chatsNew");
      return { inHead: !!b, label: b?.getAttribute("aria-label"), type: b?.type, dupes: document.querySelectorAll('[aria-label="New chat"]').length, opacity: b ? getComputedStyle(b).opacity : null };
    });
    ok("the sidebar has a compact + with aria-label 'New chat' right in the Chats section header (plus the existing top-bar button — no other duplicate)",
      info.inHead && info.label === "New chat" && info.type === "button" && info.dupes === 2, JSON.stringify(info), "no + in the Chats header, or a stray duplicate New chat control");
    await page.focus("#chatsNew");
    const focused = await page.evaluate(() => getComputedStyle(document.getElementById("chatsNew")).opacity);
    ok("on desktop it is hidden until the header is hovered or the button focused, and keyboard focus reveals it", info.opacity === "0" && focused === "1", JSON.stringify({ rest: info.opacity, focused }), "the + is always hidden, or not reachable by keyboard");
    await page.click("#chatsNew"); const n1 = await nSessions(page);
    await page.click("#chatsNew"); const n2 = await nSessions(page);
    ok("it runs the same handler as the top-bar button: an empty current chat is reused (two clicks make one chat)", n1 === 1 && n2 === 1, JSON.stringify({ afterFirst: n1, afterSecond: n2 }), "each click piled up another empty chat");
    await send(page, "hi");
    await page.click("#chatsNew"); const n3 = await nSessions(page);
    ok("once the chat has a message the + makes a new one", n3 === 2, JSON.stringify({ chats: n3 }), "the + did nothing after a chat had content");
  });
  await withPage(browser, URL, { viewport: { width: 375, height: 812 }, mobile: true }, async (page) => {
    await page.click("#topMenu"); await page.waitForTimeout(400);
    const box = await page.evaluate(() => { const b = document.getElementById("chatsNew"), r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), opacity: getComputedStyle(b).opacity, visible: r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= innerWidth }; });
    ok("on a phone the + is always visible and at least 40 px square", box.w >= 40 && box.h >= 40 && box.opacity === "1" && box.visible, JSON.stringify(box), "the + is too small or hidden on touch");
  });

  // ── 4. the footer: which models are loaded ───────────────────────────────
  const footer = (page) => page.evaluate(() => ({ text: document.getElementById("footer")?.innerText.replace(/\s+/g, " ").trim(), kind: document.getElementById("fLoaded")?.dataset.kind, title: document.getElementById("fLoaded")?.title || "" }));
  await withPage(browser, URL, { ps: { fleet: [], local: [{ name: "gemma2:2b", size: 2355678412, size_vram: 2355678412 }, { name: "qwen2.5-coder:1.5b:latest", size: 986062089, size_vram: 0 }] } }, async (page) => {
    await page.waitForFunction(() => document.getElementById("fLoaded")?.dataset.kind === "loaded", undefined, { timeout: 15000 }).catch(() => {});
    const f = await footer(page);
    ok("footer, models loaded: '● gemma2:2b · qwen2.5-coder:1.5b loaded' with sizes and places in the tooltip; the old 'sealed-external by default' is gone",
      f.kind === "loaded" && /^● gemma2:2b · qwen2\.5-coder:1\.5b loaded$/.test(f.text) && /this machine/.test(f.title) && /2\.4 GB/.test(f.title) && !/sealed-external by default/.test(f.text), JSON.stringify(f), "the footer still says sealed-external, or does not list the resident models");
  });
  await withPage(browser, URL, { ps: { fleet: [], local: [] } }, async (page) => {
    await page.waitForFunction(() => document.getElementById("fLoaded")?.dataset.kind === "idle" && /no model loaded/.test(document.getElementById("fLoaded").innerText), undefined, { timeout: 15000 }).catch(() => {});
    const f = await footer(page);
    ok("footer, nothing resident: '○ no model loaded — the first ask will load one'", f.kind === "idle" && f.text === "○ no model loaded — the first ask will load one", JSON.stringify(f), "the footer claims a model is loaded when none is");
  });
  await withPage(browser, URL, { bridgeDown: true }, async (page) => {
    await page.waitForFunction(() => document.getElementById("fLoaded")?.dataset.kind === "down", undefined, { timeout: 15000 }).catch(() => {});
    const f = await footer(page);
    const side = await page.evaluate(() => document.getElementById("models")?.innerText.replace(/\s+/g, " ") || "");
    const hint = await page.evaluate(() => { const h = document.getElementById("turnHint"); return { shown: !!h && !h.hidden, text: h?.innerText.replace(/\s+/g, " ") || "" }; });
    ok("footer, bridge down: '○ no model reachable — Sources only still works'; the model list says WHY there is no model (not a bare 'no model')",
      f.kind === "down" && f.text === "○ no model reachable — Sources only still works" && /bridge isn't reachable/.test(side), JSON.stringify({ footer: f.text, models: side.slice(0, 120) }), "a bare 'no models' or a footer that does not say Sources only still works");
    ok("with the chip on Facing page and no model reachable, a one-line hint under the composer says to switch to Sources only",
      hint.shown && /Sources only/.test(hint.text), JSON.stringify(hint), "no hint, or it does not mention Sources only");
    await page.click("#turnHintBtn");
    const after = await page.evaluate(() => ({ chip: document.querySelector(".echip")?.dataset.answer, hidden: document.getElementById("turnHint").hidden }));
    ok("clicking the hint's button moves the chip to Sources only and the hint goes away", after.chip === "snips" && after.hidden, JSON.stringify(after), "the button did nothing");
  });
  // ── 5. NO BRIDGE, NO MODEL: Sources only still answers; Facing falls back to the strand instead of a toast ─────
  await withPage(browser, URL, { bridgeDown: true, init: () => { try { localStorage.setItem("fold-chat:answerMode", "snips"); } catch {} } }, async (page, posts) => {
    await send(page, Q);
    const a = (await stored(page)).filter((m) => m.role === "assistant").pop();
    const dom = await page.evaluate(() => { const m = [...document.querySelectorAll(".msg.assistant")].slice(-1)[0]; const i = document.getElementById("input"); return { strand: !!m?.querySelector(".strand"), snips: m?.querySelectorAll(".strand-snip").length || 0, credit: !!m?.querySelector(".strand-credit, .strand-snip a"), composerFree: !!i && !i.disabled, toast: document.getElementById("toast")?.textContent || "" }; });
    const snips = a?.snips || [];
    ok("bridge unreachable + Sources only: the turn is NOT stopped by a 'no model' toast — it returns cited, verbatim snips, with no model call",
      posts.length === 0 && a?.authored === "sources" && snips.length >= 1 && snips.every((x) => flat.includes(String(x.text).replace(/\s+/g, " "))) && dom.strand && dom.snips >= 1 && dom.credit && dom.composerFree && !/no model/i.test(dom.toast),
      JSON.stringify({ chatPOSTs: posts.length, authored: a?.authored, snips: snips.length, dom }), "nothing was answered, a 'no model' toast appeared, or the snips are not verbatim");
  });
  await withPage(browser, URL, { bridgeDown: true }, async (page, posts) => {
    await send(page, Q);
    const a = (await stored(page)).filter((m) => m.role === "assistant").pop();
    const dom = await page.evaluate(() => { const m = [...document.querySelectorAll(".msg.assistant")].slice(-1)[0]; const note = m?.querySelector(".fold-note.kind-fold"), strand = m?.querySelector(".strand"); return { note: note?.innerText.replace(/\s+/g, " ") || null, above: !!(note && strand && (note.compareDocumentPosition(strand) & Node.DOCUMENT_POSITION_FOLLOWING)), snips: m?.querySelectorAll(".strand-snip").length || 0 }; });
    const n = (a?.notices || []).find((x) => x.kind === "fold");
    ok("bridge unreachable + Facing page: the turn falls back to the strand with the app's note above it (kind 'fold', fellBackFrom 'facing') instead of stopping",
      posts.length === 0 && a?.authored === "sources" && a?.fellBackFrom === "facing" && !!n && n.text === "No model is reachable (the bridge isn't running), so this shows what the sources say. Start `heimdall up` for written answers." && dom.above && dom.snips >= 1,
      JSON.stringify({ chatPOSTs: posts.length, fellBackFrom: a?.fellBackFrom, note: n?.text, dom }), "a toast and nothing else, a different note, or the note below the strand");
  });
  // ── 6. THE CONVERSATION IS A SOURCE: follow-ups resolve against the thread before any search ─────
  const COOKIE = "Show me a good chocolate chip cookie recipe";
  const COOKIE_ANSWER = "Cream the butter and both sugars until light, fold in the flour and chocolate chips, then bake for eleven minutes.";
  await withPage(browser, URL, { chat: COOKIE_ANSWER, cookies: true }, async (page) => {
    await send(page, COOKIE);
    const before = page.__searches.length;
    await send(page, "i want a chewier one");
    const qs = page.__searches.slice(before);
    const a = (await stored(page)).filter((m) => m.role === "assistant").pop();
    ok("'i want a chewier one' after a cookie turn is SEARCHED WITH THE COOKIE TOPIC (not as a literal phrase), and the record says what was searched; the person's words stay as said",
      qs.some((q) => /chewier/i.test(q) && /cookie/i.test(q) && /chocolate chip/i.test(q)) && !qs.includes("i want a chewier one") && a?.grounding?.followed?.kind === "elliptical" && /chewier/.test(a.grounding.followed.searched || "") && (await stored(page)).filter((m) => m.role === "user").pop()?.content === "i want a chewier one",
      JSON.stringify({ searched: qs, followed: a?.grounding?.followed }), "the literal phrase was searched, or the cookie referent was lost");
  });
  await withPage(browser, URL, { cookies: true, chat: "That is the cookie recipe above, said more simply: cream the butter and sugars, add flour and chips, bake eleven minutes." }, async (page, posts) => {
    await send(page, COOKIE);
    const searches = page.__searches.length, postsBefore = posts.length;
    await send(page, "what?");
    const msgs = await stored(page);
    const a = msgs.filter((m) => m.role === "assistant").pop();
    const body = page.__bodies[page.__bodies.length - 1] || "";
    const note = await page.evaluate(() => [...document.querySelectorAll(".msg.assistant")].slice(-1)[0]?.querySelector(".fold-note.kind-thread")?.innerText.replace(/\s+/g, " ") || null);
    ok("'what?' after an answer is NOT searched; the model replies grounded in the earlier turn alone, and the reply is labelled 'answered from this conversation' citing that turn",
      page.__searches.length === searches && posts.length === postsBefore + 1 && /\[T2\]/.test(body) && /cream the butter/i.test(body) && !/\[W1\]/.test(body) && String(a?.content || "").trim().length > 20 && (a?.notices || []).some((n) => n.kind === "thread" && n.turn === 1) && a?.grounding?.answeredFrom?.turn === 1 && /Answered from this conversation, turn 1/.test(note || ""),
      JSON.stringify({ newSearches: page.__searches.length - searches, newPosts: posts.length - postsBefore, note: note?.slice(0, 120), content: String(a?.content || "").slice(0, 60) }), "'what?' was web-searched, or the reply is not labelled / cited");
  });
  await withPage(browser, URL, { chat: "THE MODEL WAS CALLED and wrote this." }, async (page, posts) => {
    await send(page, "what?");
    const a = (await stored(page)).filter((m) => m.role === "assistant").pop();
    const bubble = await page.evaluate(() => [...document.querySelectorAll(".msg.assistant")].slice(-1)[0]?.querySelector(".body")?.innerText.replace(/\s+/g, " ") || "");
    ok("FALSIFIER: a cold 'what?' (nothing earlier in the chat) produces NO model answer and NO web search \u2014 only an app-authored note",
      posts.length === 0 && page.__searches.length === 0 && !!a && !String(a.content || "").trim() && (a.notices || []).some((n) => /nothing earlier in this chat/.test(n.text)) && !/THE MODEL WAS CALLED/.test(bubble),
      JSON.stringify({ chatPOSTs: posts.length, searches: page.__searches.length, content: a?.content, bubble: bubble.slice(0, 100) }), "a cold 'what?' was searched or answered by the model");
  });
}

// standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  let chromium;
  try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
  const results = [];
  const ok = (claim, survived, evidence, falsifier) => results.push({ claim, verdict: survived ? "STANDS" : "FALSIFIED", evidence, falsifier });
  const browser = await chromium.launch();
  await runTurnFeedbackChecks({ browser, URL: process.env.FOLD_URL || "http://127.0.0.1:8814/", ok });
  await browser.close();
  for (const r of results) console.log(`${r.verdict === "STANDS" ? "✔ stands " : "✘ FALSIFIED"} — ${r.claim}\n    evidence: ${r.evidence}\n    falsifier: ${r.falsifier}`);
  const bad = results.filter((r) => r.verdict !== "STANDS");
  console.log(`\n${results.length - bad.length}/${results.length} stand`);
  process.exit(bad.length ? 1 : 0);
}
