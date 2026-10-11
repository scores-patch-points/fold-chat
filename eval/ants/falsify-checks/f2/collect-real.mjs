// F2: drive the REAL page (eval/pivot/chat-live.mjs) for real turns; store each turn's persisted grounding record untouched.
//   node eval/ants/falsify-checks/f2/collect-real.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openChat, say } from "../../../pivot/chat-live.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "real");
const QS = [
  "When did the Berlin Wall fall?",
  "How tall is the Eiffel Tower?",
  "Who is the current president of the United States?",
  "What caused the 2008 financial crisis?",
  "How many moons does Mars have and what are they called?",
  "Did Napoleon lose the Battle of Waterloo?",
  "Where was Albert Einstein born and when?",
  "What is the capital of Australia and is it the largest city?",
  "Why did the Roman Empire fall?",
  "How long is the Great Wall of China?",
  "Is Pluto a planet?",
  "When did the Apollo 11 mission land on the Moon?",
  "How many people live in Tokyo?",
  "What is the boiling point of water at sea level?",
  "Who wrote Pride and Prejudice and when was it published?",
  "Why is the sky blue?",
];
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const browser = await chromium.launch();
let n = 0;
for (const q of QS) {
  const { ctx, page } = await openChat(browser);
  try {
    const r = await say(page, q, 240000);
    const grounding = await page.evaluate(() => { const s = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {}; const m = [...(s.messages || [])].reverse().find((x) => x.role === "assistant"); return m ? m.grounding || null : null; });
    const flagText = await page.evaluate(() => (document.body.innerText.match(/\d+ of \d+ checks? (?:flagged|failed)|held \d+ checks?/g) || []));
    fs.writeFileSync(path.join(OUT, `r${String(++n).padStart(2, "0")}.json`), JSON.stringify({ q, spoken: r.spoken, shown: r.shown, flagText, grounding }, null, 1));
    console.log(n, q, "→", (r.spoken || "").slice(0, 90).replace(/\n/g, " "), "|", flagText.join(";"));
  } catch (e) { console.log("ERR", q, String(e).slice(0, 120)); }
  await ctx.close();
}
await browser.close();
