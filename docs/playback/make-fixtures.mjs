// docs/playback/make-fixtures.mjs — run a few REAL turns through the real page (heimdall, gemma2:2b, real web reads) and keep each turn's whole
// grounding record (tape, coverage, facing sources, passages) as design fixtures for the playback stages. No stub of the model or the web.
//   node docs/playback/make-fixtures.mjs        -> docs/playback/fixtures/turns.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openChat, say } from "../../eval/pivot/chat-live.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const ASKS = ["who invented the telephone?", "how tall is the Eiffel Tower?", "who is the president of the United States?", "what is photosynthesis?", "when did the Berlin Wall fall?"];
const browser = await chromium.launch();
const { ctx, page } = await openChat(browser, {});
const out = [];
for (const ask of ASKS) {
  try {
    await say(page, ask);
    const rec = await page.evaluate(() => {
      const S = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {};
      const m = [...(S.messages || [])].reverse().find((x) => x.role === "assistant" && x.grounding);
      return m ? { content: m.content, grounding: m.grounding, provenance: m.provenance || null, model: m.model } : null;
    });
    out.push({ ask, at: new Date().toISOString(), ...rec });
    fs.writeFileSync(path.join(HERE, "fixtures", "turns.json"), JSON.stringify(out, null, 1));
    console.log("kept", ask, rec ? (rec.grounding.tape || []).length + " tape entries" : "no record");
  } catch (e) { console.log("failed", ask, String(e).slice(0, 120)); }
}
await ctx.close(); await browser.close();
