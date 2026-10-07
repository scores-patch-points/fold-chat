// exploration only (not a measured run): what do a chat ask's requests look like on the wire?
import { openChat, say } from "../../pivot/chat-live.mjs";
import { chromium } from "/private/tmp/fold-e2e/node_modules/playwright/index.mjs";
const browser = await chromium.launch();
const { ctx, page } = await openChat(browser, {});
const reqs = []; const t0 = Date.now();
ctx.on("request", (r) => reqs.push({ t: Date.now() - t0, m: r.method(), u: r.url().slice(0, 160), rt: r.resourceType() }));
const r = await say(page, process.argv[2] || "How tall is the Eiffel Tower?");
for (const q of reqs) console.log(q.t, q.m, q.rt, q.u);
console.log("SPOKEN:", r.spoken, "| reads:", r.read);
await browser.close();
