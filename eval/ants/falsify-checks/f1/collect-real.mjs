// F1 — drive the REAL page (gemma2:2b, real web reads) and save each assistant turn's persisted record verbatim.
//   node eval/ants/falsify-checks/f1/collect-real.mjs   -> real-turns.json
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const { openChat, say } = await import("../../../pivot/chat-live.mjs");
const ASKS = process.argv.slice(2).length ? process.argv.slice(2) : [
  "How tall is the Eiffel Tower?", "Who was Marie Curie?", "What is photosynthesis?", "When was the Great Wall of China built?",
  "What is the capital of Australia and how many people live there?", "Who invented the telephone?", "What causes the tides?", "How long is the Nile river?",
  "Who wrote Pride and Prejudice?", "What is the boiling point of water at the top of Mount Everest?"];
const browser = await chromium.launch();
const out = [];
for (const ask of ASKS) {
  const { ctx, page } = await openChat(browser);   // a fresh page per ask: no thread carry
  try {
    await page.fill("#input", ask); await page.click("#send");
    // wait (up to 8 min) for the stored assistant message to carry a grounding record and the input to be free again
    await page.waitForFunction(() => { const S = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")); const m = S.flatMap((x) => x.messages || []).filter((x) => x.role === "assistant").slice(-1)[0]; const i = document.getElementById("input"); return m && m.grounding && i && !i.disabled && i.getAttribute("aria-busy") !== "true"; }, undefined, { timeout: 480000, polling: 2000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const r = { spoken: await page.evaluate(() => { const S = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")); const m = S.flatMap((x) => x.messages || []).filter((x) => x.role === "assistant").slice(-1)[0]; return m ? m.content : null; }), read: 0, kind: null, authored: null };
    const rec = await page.evaluate(() => { const S = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")); const m = S.flatMap((x) => x.messages || []).filter((x) => x.role === "assistant").slice(-1)[0]; return m ? { content: m.content, grounding: m.grounding || null, notices: (m.notices || []).map((n) => n.kind) } : null; });
    out.push({ ask, spoken: r.spoken, read: r.read, kind: r.kind, authored: r.authored, rec });
    console.log(ask, "=>", String(r.spoken || "").slice(0, 120).replace(/\n/g, " "), "| read", r.read, "| keys", rec?.grounding ? Object.keys(rec.grounding).join(",") : "none");
  } catch (e) { out.push({ ask, error: String(e) }); console.log(ask, "ERR", String(e).slice(0, 100)); }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(HERE, "real-turns.json"), JSON.stringify({ at: new Date().toISOString(), model: "gemma2:2b", turns: out }, null, 1));
