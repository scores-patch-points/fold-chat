// G2 I1: reproduce the screenshot failure on the REAL page (real search, real sources); the model call is aborted at the transport on turn 2 only.
//   node eval/ants/g2/repro.mjs <variant>   variants: network | empty | control
import fs from "node:fs";
import { openChat, say } from "../../pivot/chat-live.mjs";
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const variant = process.argv[2] || "network";
// variant "fulfill:<stub|refusal|empty|question|tutorial|http429|http403|http504>" — the model transport answers with this canned reply (the search and sources are real)
const FUL = { stub: "Certainly, I'd be happy to help you write an essay on the telephone!", refusal: "I'm sorry, but I cannot write an essay for you.", empty: "", question: "What topic would you like the essay to cover? Could you tell me more about what you have in mind?", tutorial: "How to Write an Essay\n\nStep 1: Start with an introduction. Step 2: Write the body with a topic sentence in each paragraph. Step 3: End with a conclusion. Tips for your essay: keep to the word limit and write a thesis statement. ".repeat(4) };
const browser = await chromium.launch();
// PATCHED=1: the page is served from the scratch tree that has eval/ants/g2/wire.diff applied (FOLD_URL, port 8841); its API calls (/heimdall, /api, /v1: search relay, model bridge) are forwarded to the real server on 8815.
if (process.env.PATCHED) { const orig = browser.newContext.bind(browser); browser.newContext = async (o) => { const c = await orig(o); await c.route("http://127.0.0.1:" + (process.env.PATCHED_PORT || "8841") + "/**", async (route) => { const u = new URL(route.request().url()); if (/^\/(heimdall|api|v1)\//.test(u.pathname)) { try { const r = await route.fetch({ url: "http://127.0.0.1:8815" + u.pathname + u.search, headers: { ...route.request().headers(), origin: "http://127.0.0.1:8815", referer: "http://127.0.0.1:8815/" }, timeout: 280000 }); return route.fulfill({ response: r }); } catch (e) { return route.abort(); } } return route.continue(); }); return c; }; }
// SEARCH_STUB=natural|meta — the open-web search relay (holodeck-proxy /search) answered 408/429 (DuckDuckGo/Brave rate limits) for hours on 2026-10-07, so ONLY that one endpoint is answered here with RECORDED real results
// (the urls the real engine returned in the runs above; pages are still fetched live, the model is still gemma2:2b or the canned transport reply). natural: a writing query gets the essay-sample pages the engine really returned
// for "write essay invented telephone", a topical query gets topical pages; meta: every web query gets the essay/tutorial pages (the worst case).
if (process.env.SEARCH_STUB) {
  const ESSAYS = [["Essay on Telephone in 100, 200, 300, and 500 Words - Leverage Edu", "https://leverageedu.com/discover/school-education/essay-on-telephone/"], ["Invention of Telephone - Telephone Topic Essay", "https://gradesfixer.com/free-essay-examples/invention-of-telephone/"], ["The Invention of the Telephone, Essay Example | Essays.io", "https://essays.io/the-invention-of-the-telephone-essay-example/"], ["Write My Essay | Essay Writing Service from $8/page", "https://papersowl.com/"], ["AI Essay Generator | Write High-Quality Essays Fast & Free", "https://ivypanda.com/tools/ai-essay-generator/"]];
  const TOPICAL = [["Telephone - Wikipedia", "https://en.wikipedia.org/wiki/Telephone"], ["History of the telephone - Wikipedia", "https://en.wikipedia.org/wiki/History_of_the_telephone"], ["Alexander Graham Bell - Wikipedia", "https://en.wikipedia.org/wiki/Alexander_Graham_Bell"], ["Did Alexander Graham Bell invent the telephone? | National Museums Scotland", "https://www.nms.ac.uk/discover-catalogue/did-alexander-graham-bell-invent-the-telephone"]];
  globalThis.__stubLog = [];
  const orig2 = browser.newContext.bind(browser);
  browser.newContext = async (o) => { const c = await orig2(o); await c.route("https://holodeck-proxy.prometheoid.workers.dev/search*", async (route) => {
    const u = new URL(route.request().url()); const q = u.searchParams.get("q") || ""; const writing = /\b(write|essay|compose|draft)\b/i.test(q);
    const list = process.env.SEARCH_STUB === "meta" || writing ? ESSAYS : TOPICAL; globalThis.__stubLog.push({ q, list: list === ESSAYS ? "essays" : "topical" });
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ engine: "recorded results", results: list.map(([title, url]) => ({ title, url, snippet: title })) }) });
  }); return c; };
}
const { ctx, page } = await openChat(browser, {});
const out = { variant, at: new Date().toISOString(), turns: [] };
async function turn(ask, abortModel, canned = null) {
  let handler = null;
  if (abortModel) { handler = (route) => route.abort("failed"); await page.route("**/v1/chat/completions", handler); }
  if (canned != null) {
    handler = (route) => {
      if (/^http(\d+)$/.test(canned)) return route.fulfill({ status: Number(canned.slice(4)), contentType: "application/json", body: JSON.stringify({ error: { message: "canned " + canned } }) });
      const text = FUL[canned];
      const sse = (text ? `data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: null }] })}\n\n` : "") + `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`;
      return route.fulfill({ status: 200, contentType: "text/event-stream", body: sse });
    };
    await page.route("**/v1/chat/completions", handler);
  }
  const r = await say(page, ask, 200000);
  if (handler) await page.unroute("**/v1/chat/completions", handler);
  const extra = await page.evaluate(() => {
    const s = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {};
    const m = [...(s.messages || [])].reverse().find((x) => x.role === "assistant") || {};
    const g = m.grounding || {};
    return { searched: g.followed?.searched || null, kind: g.kind, creative: g.creative, voidKind: g.void?.kind || null, snips: (m.snips || []).map((x) => ({ ref: x.ref, text: String(x.text || "").slice(0, 300) })), fell: m.fellBackFrom || null, authored: m.authored || null, passages: (g.passages || []).map((p) => ({ ref: p.ref, url: p.url, text: String(p.text || "").slice(0, 700) })), web: (g.web || []).filter((w) => w.read).map((w) => w.read), trace: (g.web || []).filter((w) => !w.read).map((w) => ({ scope: w.scope, engine: w.engine, q: w.q, ok: w.ok, n: w.n, why: w.why })).slice(0, 8), voidFull: g.void || null, process: (g.process || []).slice(-6) };
  });
  out.turns.push({ ask, abortModel, ...r, raws: undefined, nRaw: r.raws?.length, ...extra });
  console.log("\nYOU:", ask, abortModel ? "(model transport aborted)" : "");
  console.log("  searched:", extra.searched, "| kind:", extra.kind, "| void:", extra.voidKind, "| authored:", extra.authored, "| fellBack:", extra.fell);
  console.log("  notices:", JSON.stringify(r.notices));
  if (process.env.TRACE) console.log("  trace:", JSON.stringify(extra.trace), "\n  void:", JSON.stringify(extra.voidFull)?.slice(0, 900), "\n  process:", JSON.stringify(extra.process));
  console.log("  reads:", r.reads);
  console.log("  SHOWN:", String(r.shown || "").replace(/\s+/g, " ").slice(0, 700));
  console.log("  snips:", extra.snips.map((x) => x.ref + " :: " + x.text.slice(0, 160)));
}
if (variant === "network") { await turn("who invented the telephone?", false); await turn("write me an essay on this", true); }
else if (variant === "empty") { await turn("write me an essay on this", true); }
else if (variant.startsWith("fulfill:")) { await turn("who invented the telephone?", false); await turn("write me an essay on this", false, variant.slice(8)); }
else if (variant === "control") { await turn("who invented the telephone?", false); await turn("write me an essay on this", false); }
if (globalThis.__stubLog) console.log("  stubbed search queries:", JSON.stringify(globalThis.__stubLog));
fs.writeFileSync(`eval/ants/g2/repro-${variant.replace(/[^a-z0-9]/gi, "_")}-${Date.now()}.json`, JSON.stringify(out, null, 1));
await ctx.close(); await browser.close();
