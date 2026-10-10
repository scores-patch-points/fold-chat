// eval/ants/e2/lib.mjs — instrumented real turns. Drives the REAL page (openChat/say from eval/pivot/chat-live.mjs) and adds, in the page,
// (1) a fetch wrapper that times every request (start, first byte, end, status; for model calls: the request's purpose/size and the stream's chunk times)
// (2) a poller for the two moments that matter to a person: the first readable answer (TTFA) and the composer coming back (TTD).
// Nothing is stubbed; nothing is altered. Optional `patch` serves a PATCHED COPY of a module (from eval/ants/e2/patched/) in place of the tracked one.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "../../..");
export const OUT = path.join(HERE, "out");
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
export { chromium };
const { openChat, say } = await import(path.join(ROOT, "eval/pivot/chat-live.mjs"));
export { openChat, say };

const INIT = () => {
  window.__f = []; window.__clicks = []; window.__mark = {};
  const nowp = () => performance.now();
  const cls = (u) => /\/v1\/chat\/completions/.test(u) ? "model" : /\/api\/search/.test(u) ? "bridge-search" : /\/api\/page/.test(u) ? "bridge-page" : /wikipedia\.org\/w\/api/.test(u) ? "wiki-api" : /allorigins|codetabs|thingproxy|microlink|jina|corsproxy/.test(u) ? "proxy" : /^https?:\/\/(127\.0\.0\.1|localhost)/.test(u) ? "local-other" : "direct";
  const f0 = window.fetch;
  window.fetch = async function (...a) {
    const u = String(a[0]?.url || a[0]); const o = a[1] || {}; const rec = { u: u.replace(/^https?:\/\/[^/]+/, (h) => h.includes("127.0.0.1") ? "" : h).slice(0, 160), cls: cls(u), t0: nowp(), tH: null, t1: null, status: null, err: null };
    if (rec.cls === "model") { try { const b = JSON.parse(typeof o.body === "string" ? o.body : (a[0]?.body ?? "{}")); const ms = b.messages || []; rec.model = b.model; rec.maxTokens = b.max_tokens ?? null; rec.temp = b.temperature ?? null; rec.promptChars = ms.reduce((n, m) => n + String(m.content || "").length, 0); rec.sys = String(ms[0]?.content || "").slice(0, 70); rec.last = String(ms[ms.length - 1]?.content || "").slice(0, 70); rec.stream = !!b.stream; } catch {} }
    window.__f.push(rec);
    try {
      const r = await f0.apply(this, a); rec.tH = nowp(); rec.status = r.status;
      try { const c = r.clone(); if (c.body) { const rd = c.body.getReader(); let n = 0, bytes = 0; (async () => { for (;;) { const { value, done } = await rd.read(); if (done) break; n++; bytes += value ? value.length : 0; if (n === 1) rec.tFirst = nowp(); rec.chunks = n; rec.bytes = bytes; rec.tLast = nowp(); } rec.t1 = nowp(); })().catch(() => { rec.t1 = nowp(); }); } else rec.t1 = nowp(); } catch { rec.t1 = nowp(); }
      return r;
    } catch (e) { rec.t1 = nowp(); rec.err = String(e && e.name || e); throw e; }
  };
  document.addEventListener("click", (e) => { if (e.target && e.target.closest && e.target.closest("#send")) { window.__clicks.push(nowp()); window.__liveEl = null; window.__mark = { c0: nowp(), base: document.querySelectorAll(".msg.assistant").length, ttfa: null, ttd: null, seenBusy: false, liveText: [] }; } }, true);
  setInterval(() => {
    const m = window.__mark; if (!m || m.c0 == null || m.ttd != null) return;
    const t = nowp() - m.c0;
    const i = document.getElementById("input"), send = document.getElementById("send");
    const busy = !i || i.disabled || i.readOnly || i.getAttribute("aria-busy") === "true" || /stop/i.test(send?.getAttribute("aria-label") || "");
    if (busy) m.seenBusy = true;
    const live = document.querySelector(".body.live");
    if (live) { const tx = (live.innerText || "").trim(); if (m.liveText.length === 0 || m.liveText[m.liveText.length - 1].tx !== tx.slice(0, 120)) { if (m.liveText.length < 400) m.liveText.push({ t: Math.round(t), tx: tx.slice(0, 120) }); } }
    const all = [...document.querySelectorAll(".msg.assistant")];
    // the LIVE row (feed + panel) is the element that holds .body.live; the ANSWER appears when that row is swapped for the stored message
    if (!window.__liveEl && live) window.__liveEl = live.closest(".msg") || live.parentElement;
    if (m.ttfa == null && window.__liveEl && !document.contains(window.__liveEl)) { const last = [...document.querySelectorAll(".msg.assistant")].pop(); if (last && (last.querySelector(".body")?.innerText || "").trim().length > 0) m.ttfa = t; }
    if (m.seenBusy && !busy && !document.querySelector(".body.live") && (window.__liveEl ? !document.contains(window.__liveEl) : all.length > m.base)) { m.ttd = t; if (m.ttfa == null) m.ttfa = t; }
  }, 40);
};

export async function openInstrumented(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.close();
  // openChat makes its own context; add our init script through a page hook: patch browser.newContext once
  const orig = browser.newContext.bind(browser);
  browser.newContext = async (o) => { const c = await orig(o); await c.addInitScript(INIT); if (opts.flags) await c.addInitScript((f) => { try { for (const [k, v] of Object.entries(f)) localStorage.setItem(k, v); } catch {} }, opts.flags); for (const [url, file] of Object.entries(opts.patch || {})) await c.route(url, (r) => r.fulfill({ status: 200, contentType: "text/javascript; charset=utf-8", headers: { "cache-control": "no-store" }, body: fs.readFileSync(file, "utf8") })); return c; };
  const chat = await openChat(browser, { model: opts.model || "gemma2:2b" });
  browser.newContext = orig;
  return chat;
}

/** One instrumented turn: returns the turn's waterfall inputs. */
export async function turn(page, ask, { timeout = 300000 } = {}) {
  await page.evaluate(() => { window.__f.length = 0; window.__mark = {}; });
  const r = await say(page, ask, timeout);
  await page.waitForFunction(() => !window.__e2pending, undefined, { timeout: 240000 }).catch(() => {});   // a patched run may still be doing its post-answer checks
  const data = await page.evaluate(() => {
    const S = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {};
    const ms = S.messages || []; const m = [...ms].reverse().find((x) => x.role === "assistant") || {};
    const g = m.grounding || {};
    return { mark: window.__mark, e2: { answerAt: window.__e2answerAt ?? null, provAt: window.__e2provAt ?? null }, f: window.__f.map((x) => ({ ...x })), msg: { content: m.content ?? null, kind: g.kind ?? null, feed: g.feed || [], web: g.web || [], loop: g.loop ? { cleared: g.loop.cleared, firstTry: g.loop.firstTry, passes: (g.loop.passes || []).map((p) => ({ lap: p.lap, added: p.added, restated: (p.restated || []).filter((x) => x.to).length, failing: (p.failing || []).length })) } : null, coverage: g.coverage ? { grounded: g.coverage.grounded, n: g.coverage.entries ? g.coverage.entries.length : null, ratio: g.coverage.ratio ?? null } : null, nSources: g.nSources ?? null, effort: g.effort ?? null, process: g.process || [], pivot: m.pivot ? { stats: m.pivot.stats, skipped: m.pivot.skipped || null, gap: m.pivot.gap || null, continued: m.pivot.continued || 0 } : null, provenance: m.provenance ? { verified: m.provenance.verified, pointers: (m.provenance.pointers || []).map((p) => ({ tier: p.tier, host: p.host, ok: p.ok })) } : null, watch: m.watch ? { want: m.watch.want, flags: m.watch.flags } : null, authored: m.authored ?? null, notices: (m.notices || []).map((n) => n.kind), tape: Array.isArray(g.tape) ? g.tape.length : 0, answerTurn: !!m.answerTurn } };
  });
  return { ask, spoken: r.spoken, shown: r.shown, ...data };
}

export const median = (a) => { const x = a.filter((v) => v != null && !Number.isNaN(v)).sort((p, q) => p - q); if (!x.length) return null; const h = x.length >> 1; return x.length % 2 ? x[h] : (x[h - 1] + x[h]) / 2; };
export const pct = (a, p) => { const x = a.filter((v) => v != null).sort((p1, q) => p1 - q); if (!x.length) return null; return x[Math.min(x.length - 1, Math.floor(p * x.length))]; };
export const save = (name, obj) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(obj, null, 1));
