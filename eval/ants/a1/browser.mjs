// A1: drive the REAL page with the five asks; record per ask: the stored message (grounding.web, feed/trace, spoken), and EVERY network request to a non-local host
// (url, status, or failure text) so CORS / relay failures are seen by the browser itself. Output eval/ants/a1/browser-run.json
import fs from "node:fs";
import { openChat, say } from "../../pivot/chat-live.mjs";
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const ASKS = process.argv.slice(2).length ? process.argv.slice(2) : ["Who is the king of the UK?", "How tall is the Eiffel Tower?", "What is the capital of Australia?", "How many legs does a spider have?", "When did Marie Curie die?"];
const browser = await chromium.launch();
const out = [];
for (const ask of ASKS) {
  const { ctx, page } = await openChat(browser);
  const net = [];
  page.on("response", (r) => { const u = r.url(); if (!/127\.0\.0\.1|localhost/.test(u)) net.push({ t: Date.now(), kind: "resp", status: r.status(), url: u.slice(0, 300) }); });
  page.on("requestfailed", (r) => { const u = r.url(); if (!/127\.0\.0\.1|localhost/.test(u)) net.push({ t: Date.now(), kind: "fail", err: r.failure()?.errorText, url: u.slice(0, 300) }); });
  const consoleErr = []; page.on("console", (m) => { if (m.type() === "error") consoleErr.push(m.text().slice(0, 300)); });
  const t0 = Date.now();
  let r; try { r = await say(page, ask, 240000); } catch (e) { r = { err: String(e) }; }
  const stored = await page.evaluate(() => {
    const s = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {};
    const m = [...(s.messages || [])].reverse().find((x) => x.role === "assistant") || {};
    return { keys: Object.keys(m), grounding: m.grounding || null, feed: m.feed || m.trace || null, notices: m.notices || null, prov: m.provenance || m.prov || null, content: m.content };
  });
  const feedText = await page.evaluate(() => [...document.querySelectorAll(".feed, .trace, [class*=feed], [class*=trace]")].map((e) => e.innerText).join("\n---\n").slice(0, 6000));
  out.push({ ask, ms: Date.now() - t0, r, stored, feedText, net, consoleErr });
  console.log(ask, Date.now() - t0, "ms; net", net.length, "keys", stored.keys.join(","));
  await ctx.close();
}
fs.writeFileSync(new URL("./browser-run.json", import.meta.url), JSON.stringify(out, null, 1));
await browser.close();
