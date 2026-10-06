// model-run.mjs — the app's CURRENT model path (gemma2:2b writes from sources) on the 40-ask pre-registered subset, headless Playwright,
// against the snapshot served on THIS script's own port. Serial. Never edits the app.
//   node eval/snips/model-run.mjs [--ids a,b] [--delay 3000]
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const { chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs");
const here = path.dirname(fileURLToPath(import.meta.url));
const OUTD = path.join(here, "data", "model"); fs.mkdirSync(OUTD, { recursive: true });
const argv = process.argv.slice(2); const arg = (k, d = null) => { const i = argv.indexOf("--" + k); return i < 0 ? d : argv[i + 1]; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { asks } = JSON.parse(fs.readFileSync(path.join(here, "asks.json"), "utf8"));
const subset = JSON.parse(fs.readFileSync(path.join(here, "subset.json"), "utf8")).ids;
const ids = (arg("ids", "") || "").split(",").filter(Boolean);
const todo = asks.filter((a) => (ids.length ? ids : subset).includes(a.id));
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort();
const appDir = fs.realpathSync(path.join(here, "app"));
const srv = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: appDir, stdio: "ignore" });
await sleep(1500);
const base = `http://127.0.0.1:${port}/`;
console.log("serving", appDir, "on", base);
const browser = await chromium.launch({ headless: true });
const TURN_TIMEOUT = 300000;
async function sessionState(page) {
  return page.evaluate(() => { let all = {}; try { all = JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}"); } catch {} const s = Object.values(all).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || null; const inp = document.getElementById("input"); return { session: s, disabled: !!(inp && inp.disabled) }; });
}
async function runOne(a) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // The bridge answers CORS only for its own allow-listed origins (:8814). This harness serves on its own port, so the bridge's replies get the
  // page's origin added in the browser's network layer (Playwright route); the bridge itself, and the app, are untouched.
  const pageOrigin = new URL(base).origin;
  await ctx.route(/^http:\/\/(localhost|127\.0\.0\.1):8790\//, async (route) => {
    const req = route.request();
    const cors = { "access-control-allow-origin": pageOrigin, "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-private-network": "true" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    try { const resp = await route.fetch({ timeout: 300000, headers: { ...req.headers(), origin: "http://127.0.0.1:8814", referer: "http://127.0.0.1:8814/" } }); await route.fulfill({ response: resp, headers: { ...resp.headers(), ...cors } }); }
    catch (e) { await route.abort(); }
  });
  const page = await ctx.newPage(); const errors = [], net = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
  page.on("response", (r) => { const u = r.url(); if (/holodeck-proxy|wikipedia\.org|:8790|allorigins|codetabs|corsproxy/.test(u)) net.push({ s: r.status(), u: u.slice(0, 140) }); });
  const out = { id: a.id, text: a.text, startedAt: new Date().toISOString() };
  try {
    await page.goto(base, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector("#input", { timeout: 20000 });
    const t0 = Date.now(); await page.fill("#input", a.text); await page.click("#send");
    // the app does not disable its input while a turn runs, and it stores an EMPTY assistant message at the start: a turn is finished when an assistant message
    // carries a grounding record (a typed void included) or text, and has stayed so for 2 polls
    let seen = 0; const deadline = Date.now() + TURN_TIMEOUT; let st;
    while (Date.now() < deadline) {
      await sleep(900); st = await sessionState(page);
      const last = (st.session?.messages || []).filter((m) => m.role === "assistant").pop();
      if (last && (last.grounding || (last.content && String(last.content).trim()))) { if (++seen >= 2) break; } else seen = 0;
    }
    out.secs = (Date.now() - t0) / 1000; st = await sessionState(page);
    const last = (st.session?.messages || []).filter((m) => m.role === "assistant").pop() || null;
    out.answer = last ? last.content : null; out.grounding = last ? last.grounding || null : null; out.model = st.session?.model || null;
    out.dom = await page.evaluate(() => { const b = [...document.querySelectorAll(".msg.assistant .body")].pop(); return { body: b ? b.innerText.slice(0, 3000) : null }; });
  } catch (e) { out.fatal = String(e.message || e).slice(0, 200); }
  out.pageErrors = errors; out.net = net.slice(0, 40);
  await ctx.close(); return out;
}
for (const a of todo) {
  const f = path.join(OUTD, a.id + ".json");
  if (fs.existsSync(f)) continue;
  // the app searches only through the relay in a browser (~37% single-attempt success, relay-probe.json): when its turn ends in a typed void because no
  // source was reached, the same ask is asked again (15 s later), up to 3 attempts; every attempt is kept and the first-attempt result is reported separately.
  const attempts = []; let o;
  for (let k = 1; k <= 3; k++) {
    o = await runOne(a); attempts.push({ k, secs: o.secs, answerChars: (o.answer || "").length, voidKind: o.grounding && o.grounding.void ? o.grounding.void.kind : null, hasMaterial: o.grounding ? o.grounding.hasMaterial : null });
    const unreached = !o.fatal && o.grounding && o.grounding.void && o.grounding.void.kind === "unreached";
    if (!unreached) break;
    await sleep(15000);
  }
  o.attempts = attempts; o.firstAttempt = attempts[0];
  fs.writeFileSync(f, JSON.stringify(o));
  console.log(a.id, "attempts=" + attempts.length, o.fatal || `${o.secs.toFixed(0)}s model=${o.model} chars=${(o.answer || "").length}`);
  await sleep(+arg("delay", 3000));
}
await browser.close(); srv.kill(); console.log("done");
