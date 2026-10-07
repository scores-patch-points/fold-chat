// eval/voice/collect.mjs — drive the REAL page (heimdall, gemma2:2b, real web) through 8 threads of 3 turns and store what was asked and what was SPOKEN.
//   node eval/voice/collect.mjs  → eval/voice/threads.json     (no stubs: the aside is judged over real transcripts)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openChat, say } from "../pivot/chat-live.mjs";
import { chromium } from "playwright";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const THREADS = {
  R1: ["I keep arguing with my brother and neither of us will back down.", "What should I do about it?", "Why is it so hard to let go of being right?"],
  R2: ["I've been working really hard and nobody notices.", "Should I tell my manager how I feel?", "Is it wrong to want recognition?"],
  R3: ["I'm afraid of failing at the new job.", "How do people deal with fear?", "Why does fear make me freeze up?"],
  R4: ["A friend lied to me about something small.", "Should I confront her?", "Can trust be rebuilt once it is broken?"],
  R5: ["I want to be more patient with my kids.", "What helps with patience?", "Why do I lose my temper so fast?"],
  L1: ["How tall is the Eiffel Tower?", "Who designed it?", "Why was it built?"],
  L2: ["What is photosynthesis?", "Where in a plant does it happen?", "What does it produce?"],
  L3: ["Who was Marie Curie?", "What did she discover?", "When did she die?"],
};
const browser = await chromium.launch();
const out = {};
for (const [id, asks] of Object.entries(THREADS)) {
  const { ctx, page } = await openChat(browser);
  const turns = [];
  for (const ask of asks) {
    const r = await say(page, ask);
    turns.push({ ask, spoken: r.spoken || "", authored: r.authored, notices: r.notices.map((n) => ({ kind: n.kind, text: n.text.slice(0, 120) })) });
    console.log(`[${id}] ${ask} → ${JSON.stringify(String(r.spoken || r.notices.map((n) => n.text).join(" ")).slice(0, 90))}`);
  }
  // the stored session, so the REAL pathos read can run over it offline (messages with model provenance)
  const session = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0]);
  out[id] = { turns, messages: (session?.messages || []).map((m) => ({ role: m.role, content: m.content || "", model: m.model || null, authored: m.authored || null, notices: (m.notices || []).map((n) => ({ kind: n.kind })) })) };
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(HERE, "threads.json"), JSON.stringify({ model: process.env.PIVOT_MODEL || "gemma2:2b", at: new Date().toISOString(), threads: out }, null, 1));
console.log("done");
