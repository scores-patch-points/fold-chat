// eval/pivot/salience-live.mjs — S3, S4, S5 of PREREG Amendment 4. LIVE: the real page, heimdall, gemma2:2b, real web reads. No stub of the model or the web.
//   node eval/pivot/salience-live.mjs            runs the 4-turn thread twice (salience ON, then OFF) and writes eval/pivot/salience-live.json
// Thread: "How tall is the Eiffel Tower?" · "Who designed it?" · "Why was it built?" · (topic change) "What is photosynthesis?"
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openChat, say } from "./chat-live.mjs";
let chromium;
try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASKS = ["How tall is the Eiffel Tower?", "Who designed it?", "Why was it built?", "What is photosynthesis?"];
const SRC = "The sources below were read for this turn";
const chars = (b) => (b?.messages || []).reduce((n, m) => n + String(m.content || "").length, 0);

async function run(on) {
  const browser = await chromium.launch();
  const { ctx, page, calls } = await openChat(browser);
  await page.evaluate((v) => localStorage.setItem("fold-chat:salience", v), on ? "on" : "off");
  const turns = [];
  for (const ask of ASKS) {
    const at = calls.length;
    const r = await say(page, ask);
    const mine = calls.slice(at).map((c) => c.body).filter(Boolean);
    const first = mine[0] || null;
    const msgs = first?.messages || [];
    const text = msgs.map((m) => `[${m.role}] ${m.content}`).join("\n");
    const beforeSources = msgs.map((m) => (m.role === "system" ? String(m.content).split(SRC)[0] : `[${m.role}] ${m.content}`)).join("\n");
    turns.push({ ask, requestChars: chars(first), sourced: text.includes(SRC), modelCalls: mine.length, beforeSources, spoken: r.spoken, notices: r.notices.map((n) => n.text) });
  }
  await ctx.close(); await browser.close();
  return turns;
}
const result = { model: process.env.PIVOT_MODEL || "gemma2:2b", at: new Date().toISOString() };
for (const on of [true, false]) result[on ? "on" : "off"] = await run(on);
const sourced = (t) => t.filter((x) => x.sourced && x.requestChars);
const mean = (t) => { const s = sourced(t); return s.length ? Math.round(s.reduce((n, x) => n + x.requestChars, 0) / s.length) : null; };
const leak = /eiffel|tower|gustave/i;
const change = result.on[3];
result.summary = {
  S3_topicChangeLeaks: leak.test(change.beforeSources),
  S3_followUpKeepsEiffel: /eiffel/i.test(result.on[1].beforeSources + result.on[1].requestChars),
  S4_meanSourcedChars: { on: mean(result.on), off: mean(result.off), sourcedTurns: { on: sourced(result.on).length, off: sourced(result.off).length } },
  S4_reduction: mean(result.on) && mean(result.off) ? 1 - mean(result.on) / mean(result.off) : null,
};
fs.writeFileSync(path.join(HERE, "salience-live.json"), JSON.stringify(result, null, 1));
console.log(JSON.stringify(result.summary, null, 1));
for (const k of ["on", "off"]) for (const t of result[k]) console.log(`\n[${k}] ${t.ask}  request=${t.requestChars} sourced=${t.sourced} calls=${t.modelCalls}\n  SPOKEN: ${String(t.spoken).replace(/\n+/g, " ").slice(0, 400)}`);
