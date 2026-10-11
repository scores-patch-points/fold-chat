// G1 live run on the REAL page (Fold server :8815, heimdall, gemma2:2b, real web). Variant "repo" = the repo as it is (my classifyTurn change is live, fold-chat.js is not rewired);
// variant "wired" = the same page with fold-chat.js replaced IN THE BROWSER (never on disk) by the patched copy from eval/ants/g1/wire.diff.
//   node eval/ants/g1/live.mjs repo|wired
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const { openChat, say } = await import("../../pivot/chat-live.mjs");
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const variant = process.argv[2] || "repo";
let patched = null;
if (variant === "wired") {
  const tmp = path.join(HERE, ".wired-fold-chat.js");
  fs.copyFileSync(path.join(ROOT, "fold-chat.js"), tmp);
  execFileSync("patch", ["-s", tmp, path.join(HERE, "wire.diff")]);
  patched = fs.readFileSync(tmp, "utf8"); fs.rmSync(tmp); fs.rmSync(tmp + ".orig", { force: true });
}
const SCEN = [
  { name: "thread", turns: ["who invented the telephone?", "write me an essay on this"] },
  { name: "empty", turns: ["write me an essay on this"] },
  { name: "poem", turns: ["write a short poem about autumn rain"] },
  { name: "joke-then-this", turns: ["what is the capital of Peru?", "now a haiku about it"] },
];
const only = process.argv[3];
const browser = await chromium.launch();
const out = [];
for (const sc of SCEN.filter((x) => !only || x.name === only)) {
  const origNew = browser.newContext.bind(browser);
  browser.newContext = async (o) => { const c = await origNew(o); if (patched) await c.route("**/fold-chat.js*", (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: patched })); return c; };
  const { ctx, page } = await openChat(browser, {});
  const reqs = [];
  page.on("request", (r) => { const u = decodeURIComponent(r.url()); if (/search|srsearch|[?&]q=|duckduckgo|brave|bing|\/api\/(web|read|search)/i.test(u) && !/127\.0\.0\.1:8815\/.*\.(js|css)/.test(u)) reqs.push(u.slice(0, 220)); });
  const turns = [];
  for (const t of sc.turns) {
    const before = reqs.length;
    const r = await say(page, t, 300000);
    turns.push({ ask: t, spoken: String(r.spoken ?? "").slice(0, 600), shown: String(r.shown ?? "").slice(0, 700), notices: r.notices, searched: reqs.slice(before).slice(0, 6) });
    console.log(`\n[${variant}/${sc.name}] YOU: ${t}\n  searched: ${JSON.stringify(reqs.slice(before).slice(0, 3))}\n  spoken: ${String(r.spoken ?? "(nothing)").slice(0, 300).replace(/\n/g, " ")}\n  SHOWN ON THE PAGE: ${String(r.shown ?? "(nothing)").slice(0, 500).replace(/\n/g, " | ")}\n  notices: ${JSON.stringify(r.notices).slice(0, 400)}`);
  }
  const rec = await page.evaluate(() => { const S = JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}"); const s = Object.values(S).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {}; const m = [...(s.messages || [])].reverse().find((x) => x.role === "assistant") || {}; return { kind: m.record?.kind ?? m.record?.line ?? null, line: m.record?.line ?? null, creative: m.record?.creative ?? null, void: m.void ?? m.record?.void ?? null, sources: (m.grounding?.sources || []).length }; });
  out.push({ scenario: sc.name, turns, record: rec });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(HERE, `live-${variant}${only ? "-" + only : ""}.json`), JSON.stringify({ variant, model: "gemma2:2b", at: new Date().toISOString(), out }, null, 1));
