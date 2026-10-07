// P5 follow-up: did the encyclopedia-to-original step reach an ORIGINAL page, with and without the budget gate? (the message the real chat stored is searched for the
// feed rows the origin step writes and for the provenance tiers). Uses measure.mjs's gate (hedge 1, no model clock = the post-hoc 'p' variant) vs no gate.
//   node eval/ants/c4/reach.mjs
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { makeGate, ASKS } from "./measure.mjs";
import { PRESETS } from "../../../fold-chat-budget.js";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { openChat, say } = await import("../../pivot/chat-live.mjs");
const { chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs");
const browser = await chromium.launch(); const out = [];
for (const gated of [false, true]) for (const ask of ASKS.filter((a) => ["eiffel", "canberra", "wall", "austen"].includes(a.id))) {
  const { ctx, page } = await openChat(browser, {});
  let G = null; let go = false;
  if (gated) { G = makeGate({ preset: "balanced", config: { ...PRESETS.balanced, hedge: 1, timeModels: false } }); await ctx.route("**/*", (route) => { if (!go) return route.continue(); const r = route.request(); return G.decide({ url: r.url(), method: r.method() }).allow ? route.continue() : route.abort("blockedbyclient"); }); }
  go = true;
  const r = await say(page, ask.q);
  const msg = await page.evaluate(() => { const s = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {}; const m = [...(s.messages || [])].reverse().find((x) => x.role === "assistant"); return m ? JSON.stringify(m) : "{}"; });
  const dom = await page.evaluate(() => document.body.innerText);
  const hay = msg + "\n" + dom;
  const count = (re) => (hay.match(re) || []).length;
  const m = JSON.parse(msg);
  const rec = { gated, ask: ask.id, answerOk: ask.truth.test(r.spoken || ""), followed: count(/Followed the encyclopedia to its source/g), onlyPoints: count(/The encyclopedia only points/g), couldNot: count(/Could not follow the encyclopedia/g), provenanceTiers: (m.provenance && m.provenance.pointers || []).map((p) => `${p.host}:${p.tier}`), provVerified: m.provenance ? m.provenance.verified : null, originHosts: [...new Set((hay.match(/followed the article's own reference to ([a-z0-9.-]+)/gi) || []).map((x) => x.replace(/.* to /, "")))] };
  console.log(JSON.stringify(rec)); out.push(rec); await ctx.close();
}
fs.writeFileSync(path.join(HERE, "reach.json"), JSON.stringify(out, null, 1)); await browser.close();
