// eval/pivot/recall-live.mjs — LIVE check of fold-chat-recall.js: ask something, then "What did you tell me earlier?" — the second turn must make ZERO model calls and ZERO web requests,
// and answer in the fold's own words from the claim store. Real page, heimdall, gemma2:2b, real web for turn 1.
import { openChat, say } from "./chat-live.mjs";
let chromium;
try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const browser = await chromium.launch();
const { ctx, page, calls } = await openChat(browser);
const out = {};
let net = [];
page.on("request", (r) => { const u = r.url(); if (!/^(http:\/\/(127\.0\.0\.1|localhost))/.test(u) && !u.startsWith("data:")) net.push(u); });
const r1 = await say(page, "How tall is the Eiffel Tower?");
out.turn1 = { spoken: r1.spoken, modelCalls: calls.length };
net = []; const c0 = calls.length;
const r2 = await say(page, "What did you tell me earlier?");
out.turn2 = { spoken: r2.spoken, shown: r2.shown, modelCalls: calls.length - c0, externalRequests: net.length, sample: net.slice(0, 3) };
out.claims = await page.evaluate(() => { const s = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}"))[0]; return (s?.claims || []).map((c) => ({ id: c.id, ground: c.ground, text: c.roles.ARG1.slice(0, 80) })); });
console.log(JSON.stringify(out, null, 1));
await ctx.close(); await browser.close();
