// eval/pivot/followups-live.mjs — follow-up messages in the REAL chat: does the discourse planner read each one against the thread
// BEFORE anything goes to the web? Prints, per turn, what was searched (the feed's "searching for …" note), what was read, what was spoken.
//   node eval/pivot/followups-live.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openChat, say, show } from "./chat-live.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const ASKS = process.argv.slice(2).length ? process.argv.slice(2) : [
  "Who is the king of the UK?",
  "find a primary source",
  "where did you get that?",
  "are you sure?",
  "who was the monarch before him?",
  "when did he become king",
  "why?",
  "ok. what is the capital of Australia?",
  "source?",
];
const browser = await chromium.launch();
const { ctx, page } = await openChat(browser);
const out = [];
let i = 0;
for (const ask of ASKS) {
  i++;
  const r = await say(page, ask);
  const feed = await page.evaluate(() => [...document.querySelectorAll(".msg.assistant")].slice(-1).map((el) => (el.innerText || "").split("\n").filter((l) => /searching for|Followed on|Searched the web|Read your question|conversation|nothing earlier|Read what you are after|Discourse check|Read back/i.test(l)).slice(0, 6))[0] || []);
  const watch = await page.evaluate(() => { const S = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {}; const m = [...(S.messages || [])].reverse().find((x) => x.role === "assistant"); return m?.watch || null; });
  show(i, ask, { raws: [], ...r });
  console.log("  ── WATCHER ── " + JSON.stringify(watch));
  console.log("  ── SEARCH/FLOW LINES ── " + (feed.join(" | ") || "(none: no search lines)"));
  out.push({ ask, feed, watch, ...r });
}
fs.writeFileSync(path.join(HERE, "followups-live.json"), JSON.stringify({ at: new Date().toISOString(), turns: out }, null, 1));
await ctx.close(); await browser.close();
