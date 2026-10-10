// F3 real-record collector: drives the REAL chat page (eval/pivot/chat-live.mjs) against the Fold server, gemma2:2b, real web.
// One fresh browser context per ask (no thread carry-over). Saves each turn's full stored message.grounding (the record falsifiersOf reads).
//   node real-collect.mjs [out.json] "ask 1" "ask 2" ...
import fs from "node:fs";
import { openChat, say } from "../../../pivot/chat-live.mjs";
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
let [out, ...asks] = process.argv.slice(2); if (asks.length === 1 && asks[0].endsWith(".json")) asks = JSON.parse(fs.readFileSync(asks[0], "utf8"));
const browser = await chromium.launch();
const results = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : [];
for (const ask of asks) {
  if (results.some((r) => r.ask === ask)) continue;
  const t0 = Date.now();
  let rec = null, spoken = null, err = null;
  try {
    const { ctx, page } = await openChat(browser);
    const r = await say(page, ask, 300000);
    spoken = r.spoken;
    rec = await page.evaluate(() => { const S = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {}; const m = [...(S.messages || [])].reverse().find((x) => x.role === "assistant"); return m ? { content: m.content, grounding: m.grounding || null } : null; });
    await ctx.close();
  } catch (e) { err = String(e).slice(0, 300); }
  results.push({ ask, ms: Date.now() - t0, spoken, err, rec });
  fs.writeFileSync(out, JSON.stringify(results, null, 1));
  console.log(`${results.length}. ${ask} -> ${err || (rec?.grounding ? "record ok, sources=" + (rec.grounding.facing?.sources || []).length + " resp=" + (rec.grounding.facing?.response || []).length : "no grounding")} (${Math.round((Date.now() - t0) / 1000)}s)`);
}
await browser.close();
