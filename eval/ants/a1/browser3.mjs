// A1: the REAL page, REAL chat turn, with a runtime SHIM (playwright route; no file on disk is edited) that wraps originatePassages to record, in window.__a1, the passages it was
// HANDED (url, text length, first 200 chars) and the full slim trails it returned (status, refs, tried[] with read/verdict/why). Network is logged as in browser.mjs.
import fs from "node:fs";
import { openChat, say } from "../../pivot/chat-live.mjs";
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const ASKS = process.argv.slice(2).length ? process.argv.slice(2) : ["Who is the king of the UK?", "How tall is the Eiffel Tower?", "What is the capital of Australia?", "How many legs does a spider have?", "When did Marie Curie die?"];
const SRC = fs.readFileSync(new URL("../../../fold-chat-originwire.js", import.meta.url), "utf8");
const shim = SRC.replace("export async function originatePassages(", "async function _orig(") + `
export async function originatePassages(passages, question, opts) {
  const A = (window.__a1 ||= { calls: [] });
  const rec = { question, t0: Date.now(), passages: (passages || []).map((p) => ({ url: p.url || p.source || "", len: String(p.text || "").length, head: String(p.text || "").slice(0, 160), text: String(p.text || ""), title: p.title || "", ref: p.ref || "", snippetOnly: !!p.snippetOnly })) };
  A.calls.push(rec);
  const out = await _orig(passages, question, opts);
  rec.ms = Date.now() - rec.t0; rec.trails = out.trails; rec.after = (passages || []).map((p) => ({ url: p.url || p.source || "", origin: !!p.origin, tertiary: !!p.tertiary, origins: (p.origins || []).length, pointers: (p.pointers || []).length }));
  return out;
}`;
const browser = await chromium.launch();
const out = [];
for (const ask of ASKS) {
  const { ctx, page } = await openChat(browser);
  await page.route("**/fold-chat-originwire.js*", (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: shim }));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled; }, undefined, { timeout: 90000 });
  const net = [];
  page.on("response", (r) => { const u = r.url(); if (!/127\.0\.0\.1|localhost/.test(u)) net.push({ t: Date.now(), kind: "resp", status: r.status(), url: u.slice(0, 300) }); });
  page.on("requestfailed", (r) => { const u = r.url(); if (!/127\.0\.0\.1|localhost/.test(u)) net.push({ t: Date.now(), kind: "fail", err: r.failure()?.errorText, url: u.slice(0, 300) }); });
  let r; try { r = await say(page, ask, 240000); } catch (e) { r = { err: String(e) }; }
  const a1 = await page.evaluate(() => window.__a1 || null);
  const prov = await page.evaluate(() => { const s = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {}; const m = [...(s.messages || [])].reverse().find((x) => x.role === "assistant") || {}; return { spoken: m.content, parts: (m.provenance && m.provenance.parts || []).map((p) => p.text).join(" "), quotes: (m.provenance && m.provenance.parts || []).filter((p) => p.kind === "quote").map((p) => ({ text: p.text, host: p.host, index: p.index })), pointers: (m.provenance && m.provenance.pointers || []).map((p) => ({ url: p.url, host: p.host })) }; });
  out.push({ ask, a1, prov, net });
  console.log(ask, "shim calls", a1 && a1.calls.length, JSON.stringify(a1 && a1.calls.map((c) => c.trails && c.trails.map((t) => t.trail.status))));
  await ctx.close();
}
fs.writeFileSync(new URL("./browser3-run.json", import.meta.url), JSON.stringify(out, null, 1));
await browser.close();
