// run.mjs — drive the REAL chat page headlessly and record every turn.
//
//   node eval/run.mjs                              # all cases, default model (gemma2:2b via autoPick), 1 rep
//   node eval/run.mjs --label frontier --model claude-sonnet-4-6 --only frontier
//   node eval/run.mjs --reps 3 --only repeat       # flakiness: runs r1..r3 (existing r1 is skipped)
//   node eval/run.mjs --ids a1_eiffel_year,d1_austen --app live
//
// Output: eval/raw/<label>__<caseId>__r<k>.json, one file per run (resumable:
// existing files are skipped). score.mjs reads them. Nothing here edits the app.
//
// Design notes
//  * The app is SNAPSHOTTED (working tree copy, sha256 of each file in raw/_app.json)
//    and served from a private port, because other people are editing the tree.
//    --app live uses FOLD_URL (default http://127.0.0.1:8814/) instead.
//  * One fresh browser context per case (clean localStorage). The Web control is
//    left as the app defaults; the model is chosen through the app's own settings
//    drawer (Settings -> Models -> click a row), never by writing storage.
//  * The persisted session JSON in localStorage "fold-chat:sessions" is the source
//    of truth (answer text, grounding record, model id); the DOM is only used for
//    panel counts and as an error fallback.
//  * Requests are serialised with delays; public-API failures (429/502) are
//    recorded in the app's own trace, never papered over.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { takeSnapshot, serve } from "./lib/snapshot.mjs";

let chromium;
try { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
catch { ({ chromium } = await import("playwright")); }

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(here);
const argv0 = process.argv.slice(2);
const argv0v = (k, d) => { const i = argv0.indexOf("--" + k); return i < 0 ? d : argv0[i + 1]; };
const rawDir = path.join(here, argv0v("rawdir", "raw"));
fs.mkdirSync(rawDir, { recursive: true });

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf("--" + k); return i < 0 ? d : (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true); };
const LABEL = arg("label", "default");
const MODEL = arg("model", "default");           // "default" = whatever the app autoPicks
const ONLY = arg("only", "all");                 // all | frontier | repeat
const IDS = (arg("ids", "") || "").split(",").filter(Boolean);
const REPS = parseInt(arg("reps", "1"), 10);
const APP = arg("app", "snapshot");
const DELAY = parseInt(arg("delay", "2500"), 10);
const TURN_TIMEOUT = parseInt(arg("turn-timeout", "240000"), 10);

const { cases } = JSON.parse(fs.readFileSync(path.join(here, "cases.json"), "utf8"));
let todo = cases.filter((c) => (IDS.length ? IDS.includes(c.id) : ONLY === "frontier" ? c.frontier : ONLY === "repeat" ? c.repeat : true));

let appUrl, server = null, appMeta = null;
if (APP === "live") appUrl = process.env.FOLD_URL || "http://127.0.0.1:8814/";
else {
  const dest = path.join(here, arg("appdir", ".app"));
  const metaPath = path.join(dest, "_meta.json");
  if (!fs.existsSync(metaPath) || arg("resnap")) { appMeta = takeSnapshot(repo, dest); fs.writeFileSync(metaPath, JSON.stringify(appMeta, null, 1)); }
  else appMeta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  server = await serve(dest);
  appUrl = server.url;
}
fs.writeFileSync(path.join(rawDir, "_app.json"), JSON.stringify({ app: APP, appUrl, snapshot: appMeta, at: new Date().toISOString() }, null, 1));
console.log(`[run] label=${LABEL} model=${MODEL} cases=${todo.length} reps=${REPS} app=${appUrl} head=${appMeta?.head?.slice(0, 7)}`);

const SEARCH_HOST = [
  [/holodeck-proxy[^/]*\/search/, "relay-search"], [/en\.wikipedia\.org\/w\/api\.php.*list=search/, "wikipedia-search"],
  [/api\.github\.com\/search/, "github-search"], [/archive\.org\/advancedsearch/, "archive-search"],
  [/api\.openalex\.org\/works\?search/, "openalex-search"], [/api\.crossref\.org\/works/, "crossref-search"],
];
const READ_HOST = /holodeck-proxy[^/]*\/raw|allorigins|codetabs|corsproxy|cors\.eu\.org|thingproxy|r\.jina\.ai|microlink/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let browser = await chromium.launch({ headless: true });
const relaunch = async () => { try { await browser.close(); } catch {} browser = await chromium.launch({ headless: true }); };

async function sessionState(page) {
  return page.evaluate(() => {
    let all = {}; try { all = JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}"); } catch {}
    const s = Object.values(all).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || null;
    const inp = document.getElementById("input");
    return { session: s, disabled: !!(inp && inp.disabled), hasInput: !!inp };
  });
}

async function selectModel(page, model) {
  // The UI is being modernised: take whichever "new chat" / "settings" control exists, clicked via the DOM so a hidden rail does not matter.
  await page.evaluate(() => { for (const id of ["railNew", "topNew", "chatNew"]) { const e = document.getElementById(id); if (e) { e.click(); return; } } });
  await page.evaluate(() => { for (const id of ["railSettings"]) { const e = document.getElementById(id); if (e) { e.click(); return; } } });
  await page.waitForSelector("#models .model, #models .tier", { timeout: 20000 });
  const find = () => page.locator("#models .model", { has: page.locator(".name", { hasText: new RegExp("^" + esc(model) + "$") }) }).first();
  let row = find();
  if (!(await row.count())) { // free tiers start collapsed; open every tier and retry
    for (const t of await page.$$("#models .tier.clickable:not(.open)")) await t.click().catch(() => {});
    row = find();
  }
  if (!(await row.count())) throw new Error("model not listed in the settings drawer: " + model);
  await row.click();
  await page.click("#settingsCancel").catch(() => {});
  const st = await sessionState(page);
  if (st.session?.model !== model) throw new Error(`model selection did not take: session.model=${st.session?.model}`);
}

async function runTurn(page, text, netLog) {
  const before = await sessionState(page);
  const nBefore = (before.session?.messages || []).filter((m) => m.role === "assistant").length;
  await page.evaluate(() => { window.__steps = []; });
  netLog.length = 0;
  const t0 = Date.now();
  await page.fill("#input", text);
  await page.click("#send");
  let started = false, seenDone = 0;
  const nUserBefore = (before.session?.messages || []).filter((m) => m.role === "user").length;
  const deadline = Date.now() + TURN_TIMEOUT;
  let st;
  while (Date.now() < deadline) {
    await sleep(600);
    st = await sessionState(page);
    const msgs0 = st.session?.messages || [];
    const nAsst = msgs0.filter((m) => m.role === "assistant").length;
    const nUser = msgs0.filter((m) => m.role === "user").length;
    // "started": the composer locked (older builds), or our user message was persisted (builds that never lock the composer)
    if (st.disabled || nAsst > nBefore || nUser > nUserBefore) started = true;
    const live = await page.evaluate(() => !!document.querySelector(".live-stat, .live-sites, .body.live, .msg .live"));
    if (started && !st.disabled && !live && nAsst > nBefore) { if (++seenDone >= 2) break; }
    else if (started && !st.disabled && !live && nAsst === nBefore) {
      // composer free, nothing live, no new answer: an error body (older builds do not persist it) - give it 3 polls then stop
      if (++seenDone >= 4 && Date.now() - t0 > 8000) break;
    } else seenDone = 0;
    if (!started && Date.now() - t0 > 20000) break; // the send never took
  }
  const secs = (Date.now() - t0) / 1000;
  st = await sessionState(page);
  const msgs = st.session?.messages || [];
  const asst = msgs.filter((m) => m.role === "assistant");
  const last = asst.length > nBefore ? asst[asst.length - 1] : null;
  const dom = await page.evaluate(() => {
    const bodies = [...document.querySelectorAll(".msg.assistant .body")];
    const lastEl = bodies[bodies.length - 1];
    const msgEls = [...document.querySelectorAll(".msg.assistant")];
    const lastMsg = msgEls[msgEls.length - 1];
    return {
      lastBodyText: lastEl ? lastEl.innerText.slice(0, 4000) : null,
      facing: lastMsg ? lastMsg.querySelectorAll(".facing").length : 0,
      src: lastMsg ? lastMsg.querySelectorAll(".src").length : 0,
      cite: lastMsg ? lastMsg.querySelectorAll(".cite").length : 0,
      disclosure: lastMsg ? lastMsg.querySelectorAll(".disclosure").length : 0,
      steps: window.__steps || [],
    };
  });
  const timedOut = !last && started && st.disabled;
  return {
    q: text, secs: +secs.toFixed(2), started, timedOut,
    error: !last ? (dom.lastBodyText || "no assistant message") : (/^error:/i.test(dom.lastBodyText || "") ? dom.lastBodyText : null),
    answer: last ? last.content : null,
    notices: last ? last.notices || null : null, msgVoid: last ? last.void ?? null : null, msgKeys: last ? Object.keys(last) : null,
    grounding: last ? last.grounding || null : null,
    sessionModel: st.session?.model || null, sealed: st.session?.sealed ?? null,
    dom, net: netLog.slice(),
    searchTriggered: netLog.some((n) => n.kind === "search"),
    readsViaNetwork: netLog.filter((n) => n.kind === "read").length,
  };
}

async function runCase(c, rep, attempt) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const netLog = [];
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 300)));
  page.on("response", (r) => {
    const u = r.url();
    let kind = null;
    for (const [re, k] of SEARCH_HOST) if (re.test(u)) kind = "search";
    if (!kind && READ_HOST.test(u)) kind = "read";
    if (!kind && /:8790\/v1\/chat/.test(u)) kind = "chat";
    if (!kind && /wikipedia\.org\/wiki\//.test(u)) kind = "read";
    if (kind) netLog.push({ kind, status: r.status(), url: u.replace(/\?.*$/, (m) => m.slice(0, 160)).slice(0, 220) });
  });
  page.on("requestfailed", (r) => { const u = r.url(); if (/wikipedia|github|archive\.org|openalex|crossref|holodeck-proxy|allorigins|codetabs|corsproxy|8790/.test(u)) netLog.push({ kind: "fail", status: 0, url: u.slice(0, 200), why: r.failure()?.errorText }); });
  await page.addInitScript(() => {
    window.__steps = [];
    const grab = () => { for (const e of document.querySelectorAll(".live-site")) { const t = e.textContent; if (t && !window.__steps.includes(t)) window.__steps.push(t); } };
    document.addEventListener("DOMContentLoaded", () => { new MutationObserver(grab).observe(document.documentElement, { subtree: true, childList: true, characterData: true }); });
  });
  const out = { id: c.id, stratum: c.stratum, lang: c.lang || null, rep, attempt, label: LABEL, requestedModel: MODEL, app: { url: appUrl, head: appMeta?.head || null }, startedAt: new Date().toISOString(), turns: [], pageErrors: errors };
  try {
    await page.goto(appUrl, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector("#input", { timeout: 20000 });
    if (MODEL !== "default") await selectModel(page, MODEL);
    for (const q of c.turns) {
      const t = await runTurn(page, q, netLog);
      out.turns.push(t);
      if (t.error && !t.answer) break;           // a dead turn ends the conversation
      await sleep(1000);
    }
  } catch (e) { out.fatal = String(e.message || e); }
  out.pageErrors = errors;
  await ctx.close();
  return out;
}

const queue = [];
for (const c of todo) for (let r = 1; r <= REPS; r++) queue.push([c, r]);
let done = 0;
for (const [c, rep] of queue) {
  const f = path.join(rawDir, `${LABEL}__${c.id}__r${rep}.json`);
  if (fs.existsSync(f)) { done++; continue; }
  const safe = async (a) => { try { return await runCase(c, rep, a); } catch (e) { await relaunch(); return { id: c.id, stratum: c.stratum, lang: c.lang || null, rep, attempt: a, label: LABEL, turns: [], fatal: String(e.message || e).slice(0, 200) }; } };
  let res = await safe(1);
  const dead = res.fatal || res.turns.some((t) => t.error && !t.answer);
  if (dead) { console.log(`  retry ${c.id}: ${res.fatal || res.turns.find((t) => t.error)?.error?.slice(0, 80)}`); await sleep(5000); res = await safe(2); res.retried = true; }
  fs.writeFileSync(f, JSON.stringify(res, null, 1));
  done++;
  const t = res.turns.map((x) => `${x.secs}s`).join("+");
  console.log(`[${done}/${queue.length}] ${LABEL} ${c.id} r${rep} ${t} :: ${(res.turns.at(-1)?.answer || res.fatal || "(none)").replace(/\s+/g, " ").slice(0, 90)}`);
  await sleep(DELAY);
}
await browser.close();
if (server) server.close();
console.log("[run] done");
