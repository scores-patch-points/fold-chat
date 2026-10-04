// fold-e2e-fold.mjs — e2e + falsify for the CONVERSATION FOLD: the claim is
// that the context window does NOT grow with the conversation (each turn is
// folded to a summary + records + a small recency window; the raw transcript
// beyond that is never resent). Falsifier: send many turns and prove the
// message array the surface sends stays bounded while the transcript grows.
//
//   node fold-e2e-fold.mjs

import { chromium } from "/private/tmp/fold-e2e/node_modules/playwright/index.mjs";

const URL = process.env.FOLD_URL || "http://127.0.0.1:8814/";
const results = [];
const ok = (claim, survived, evidence, falsifier) => results.push({ claim, verdict: survived ? "STANDS" : "FALSIFIED", evidence, falsifier });

// Capture the exact chat body the client sends (so we measure what rides the wire).
const sent = [];
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.route("**/v1/chat/completions", async (route) => {
  try { const b = JSON.parse(route.request().postData() || "{}"); sent.push({ messages: b.messages || [], chars: (b.messages || []).reduce((n, m) => n + (m.content || "").length, 0) }); } catch {}
  await route.continue();
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message)));
await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });

const ask = async (t, ms = 30000) => { await page.fill("#input", t); await page.click("#send"); await page.waitForTimeout(ms); };

// Turn on Web off (pure chat turns keep this deterministic/fast).
const wt = await page.$("#webToggle"); if (wt) { const on = await page.evaluate(() => document.getElementById("webToggle")?.classList.contains("on")); if (on) await wt.click(); }

// A long, growing transcript: 6 turns.
for (let i = 1; i <= 6; i++) {
  await ask(`Turn ${i}: remember that the secret word for step ${i} is ALPHA${i}. Reply briefly.`, 22000);
}

const transcriptChars = await page.evaluate(() => {
  const s = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}"))[0];
  return (s?.messages || []).reduce((n, m) => n + (m.content || "").length, 0);
});

// The claim: what rode the LAST turn is bounded by summary + recency, not the transcript.
const last = sent[sent.length - 1] || { messages: [], chars: 0 };
const systemMsgs = last.messages.filter((m) => m.role === "system");
const rawMsgs = last.messages.filter((m) => m.role !== "system");

ok("the wire carries the whole transcript on the last turn (should be FALSE)",
  false === (last.chars >= transcriptChars * 0.9 && transcriptChars > 2000),
  `transcript=${transcriptChars} chars · last-sent=${last.chars} chars`,
  "if last-sent ≈ transcript, the fold is not bounding anything");

ok("a turn's payload is bounded (summary + a recency window), not the growing transcript",
  last.chars < 6000 && rawMsgs.length <= 6,
  `sentChars=${last.chars} · nonSystemMessages=${rawMsgs.length} of ~13 transcript msgs`,
  "payload grows with the conversation → the fold failed");

ok("exactly one system message carries past discourse + records",
  systemMsgs.length === 1,
  `systemMessages=${systemMsgs.length}`,
  "more than one system message → the folded blocks were not merged (WebLLM would reject it anyway)");

ok("the fold store accrued (summary folds + records) on the session",
  await page.evaluate(() => { const s = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}"))[0]; return (s?.summary?.folds?.length || 0) >= 6 && (s?.summary?.records?.length || 0) >= 6; }),
  await page.evaluate(() => { const s = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}"))[0]; return `folds=${s?.summary?.folds?.length || 0} records=${s?.summary?.records?.length || 0} turnCount=${s?.summary?.turnCount || 0}`; }),
  "the store did not accrue → the summary is not advancing");

ok("no page error during the folded run", errors.length === 0, JSON.stringify(errors), "any uncaught error falsifies the port");

await browser.close();

const falsified = results.filter((r) => r.verdict === "FALSIFIED");
console.log("\n=== E2E + FALSIFY — the conversation fold ===");
for (const r of results) console.log(`${r.verdict === "STANDS" ? "✔ stands " : "✘ FALSIFIED"} — ${r.claim}\n    evidence: ${r.evidence}\n    falsifier: ${r.falsifier}`);
console.log(`\n${results.length - falsified.length}/${results.length} stand · ${falsified.length} falsified`);
process.exit(falsified.length ? 1 : 0);