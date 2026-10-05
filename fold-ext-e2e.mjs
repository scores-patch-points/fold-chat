// fold-ext-e2e.mjs — load the BUILT extension into a real Chromium and check what unit tests cannot:
// that the page boots under the extension CSP, that web calls leave from the extension page with no
// CORS wall and no relay, that the exit rules hold in the browser, and what the artifact sandbox does.
//
//   node scripts/build-extension.mjs && node scripts/build-extension.mjs --test-all-hosts
//   node fold-ext-e2e.mjs            (needs network; ~2 min; writes /private/tmp/fold-ext-e2e-results.json)
//
// Not part of `node --test`: it needs a browser and the live web. Search is measured here and never from
// Node — Node's fetch is challenged by the engines where a browser is not (experiments/source-routing).
// Pre-registered falsifiers (experiments/source-routing/RESULTS.md, 'Open'):
//   1. any of 12 paced Brave requests refused, or median latency >= 1.5 s
//   2. fewer than 80% of the top-3 results readable by a direct page read

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.FOLD_E2E_QUICK ? "/private/tmp/fold-ext-e2e-quick.json" : "/private/tmp/fold-ext-e2e-results.json";
let playwright;
try { playwright = await import("playwright"); } catch { playwright = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs"); }
const { chromium } = playwright;
// Headless Chromium advertises "HeadlessChrome"; Brave answers that UA with a 429 and a slider captcha (measured
// 2026-10-05), which says nothing about a person's real browser. The harness sends an ordinary Chrome UA instead.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

const QUERIES = [
  "statute of frauds contract writing requirement", "adverse possession elements", "force majeure clause meaning",
  "promissory estoppel versus consideration", "doctrine of laches equitable defense", "UCC article 2 perfect tender rule",
  "res ipsa loquitur negligence", "Miranda warning custodial interrogation", "easement by prescription requirements",
  "liquidated damages penalty clause enforceability", "attorney client privilege crime fraud exception", "summary judgment standard federal rule 56",
];
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const QUICK = !!process.env.FOLD_E2E_QUICK;     // 2 searches, 1 read set: for checking the harness, NOT a falsifier run
const results = { quick: QUICK, startedAt: new Date().toISOString(), chromium: null, boot: {}, guard: {}, search: {}, reads: {}, sandbox: {}, relay: {} };
const hard = [];                                                   // failures of things that must hold
const check = (ok, what) => { console.log((ok ? "  ✔ " : "  ✖ ") + what); if (!ok) hard.push(what); };

async function withExtension(dir, fn) {
  const ext = path.join(ROOT, "dist", dir);
  if (!fs.existsSync(path.join(ext, "manifest.json"))) throw new Error("build first: node scripts/build-extension.mjs" + (dir.endsWith("test") ? " --test-all-hosts" : ""));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "fold-ext-profile-"));
  const ctx = await chromium.launchPersistentContext(profile, { channel: "chromium", headless: true, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, `--user-agent=${UA}`] });
  try {
    let [sw] = ctx.serviceWorkers();
    if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 15000 });
    const id = new URL(sw.url()).host;
    results.chromium = ctx.browser()?.version?.() ?? null;
    return await fn(ctx, id, sw);
  } finally { await ctx.close(); fs.rmSync(profile, { recursive: true, force: true }); }
}

const exitedTo = [];                                               // every host any page in the context asked for
const watch = (ctx) => ctx.on("request", (r) => { try { exitedTo.push({ host: new URL(r.url()).host, url: r.url(), type: r.resourceType() }); } catch {} });

// ── 1. the real build: boot, exit rules, search ─────────────────────────────
console.log("\n[1] dist/extension — boot, exit rules, direct search");
await withExtension("extension", async (ctx, id) => {
  watch(ctx);
  const page = await ctx.newPage();
  const problems = [];
  page.on("console", (m) => { if (m.type() === "error") problems.push("console: " + m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push("pageerror: " + String(e.message).slice(0, 200)));
  await page.goto(`chrome-extension://${id}/index.html`, { waitUntil: "load" });
  await page.waitForSelector(".app *", { timeout: 15000 }).catch(() => {});
  await sleep(1500);
  const gateOn = await page.evaluate(() => typeof fetch[Symbol.for("fold.exit.guarded")] !== "undefined" && fetch[Symbol.for("fold.exit.guarded")] === true);
  const linkErrors = problems.filter((p) => /does not provide an export|Failed to resolve module|Unexpected token|SyntaxError|Cannot use import/i.test(p));
  const csp = problems.filter((p) => /Content Security Policy|Refused to (execute|load|apply)/i.test(p));
  results.boot = { id, gateOn, problems };
  check(csp.length === 0, "no CSP violations booting the page" + (csp.length ? ": " + csp[0] : ""));
  check(linkErrors.length === 0, "the page's module graph linked and ran" + (linkErrors.length ? " — " + linkErrors[0] : ""));
  check(gateOn, "the exit gate is on the page's fetch by the time the app has loaded (installed by fold-exit-install.js, the first import)");
  const other = problems.filter((p) => !csp.includes(p) && !linkErrors.includes(p) && !/localhost:8790|127\.0\.0\.1:8790|ERR_CONNECTION_REFUSED|Failed to load resource/i.test(p));
  console.log(other.length ? "  · other console errors: " + other.slice(0, 3).join(" | ") : "  · no other console errors");

  // the options page (the one setting) must load and report a status
  const opt = await ctx.newPage();
  const optErrors = [];
  opt.on("pageerror", (e) => optErrors.push(String(e.message).slice(0, 160)));
  await opt.goto(`chrome-extension://${id}/fold-options.html`);
  await opt.waitForFunction(() => !/Checking/.test(document.getElementById("status")?.textContent || "Checking"), null, { timeout: 8000 }).catch(() => {});
  const optStatus = await opt.evaluate(() => ({ status: document.getElementById("status")?.textContent, hosts: document.querySelectorAll("#hosts li").length, grant: !document.getElementById("grant")?.hidden }));
  await opt.close();
  results.options = { optErrors, ...optStatus };
  check(optErrors.length === 0 && optStatus.hosts > 0, "the options page loads without errors and lists " + optStatus.hosts + " always-allowed hosts" + (optErrors[0] ? " — " + optErrors[0] : ""));
  check(/^Off/.test(optStatus.status || "") && optStatus.grant, "…and shows reading arbitrary websites OFF by default, with the button to allow it (\"" + String(optStatus.status).slice(0, 40) + "…\")");

  // the exit rules, from inside the extension page, through the page's own global fetch
  const g = await page.evaluate(async () => {
    const t = async (u, o) => { try { const r = await fetch(u, o); return "passed:" + r.status; } catch (e) { return String(e.name + ": " + e.message).slice(0, 90); } };
    return {
      http: await t("http://example.com/"), loopbackOtherPort: await t("http://127.0.0.1:9/"), ip: await t("https://192.168.1.1/"),
      localhost: await t("https://localhost/"), post: await t("https://en.wikipedia.org/w/api.php", { method: "POST", body: "x" }),
      lanName: await t("https://printer.local/"), ownFile: await t(location.origin + "/manifest.json"),
    };
  });
  results.guard = g;
  for (const k of ["http", "loopbackOtherPort", "ip", "localhost", "post", "lanName"]) check(/exit rules/.test(g[k]), `fetch refused in the page — ${k}: ${g[k]}`);
  check(g.ownFile === "passed:200", "the extension's own files still load through the gate (" + g.ownFile + ")");

  // direct search, 12 paced requests (falsifier 1) — a call from the extension page, not a same-origin fetch
  const runs = [];
  let throttled = false;                                            // once an engine refuses, stop asking: more traffic only deepens the throttle
  const REFUSED = /429|rate.?limited|limiting|cooling down|human check|challenge/i;
  for (const q of (process.env.FOLD_E2E_SKIP_SEARCH ? [] : QUICK ? QUERIES.slice(0, 2) : QUERIES)) {
    if (throttled) { runs.push({ q, ok: false, skipped: true, ms: 0, why: "not attempted — the engine was already refusing" }); console.log(`  · skipped (engine refusing) — ${q}`); continue; }
    const r = await page.evaluate(async (q) => {
      const web = await import("./fold-chat-web.js");
      const t0 = performance.now();
      try { const out = await web.search("web", q, 0, { direct: true }); return { ok: true, ms: Math.round(performance.now() - t0), n: out.results.length, engine: out.engine, first: out.results[0]?.url || null }; }
      catch (e) { return { ok: false, ms: Math.round(performance.now() - t0), why: String(e.message || e).slice(0, 240) }; }
    }, q);
    runs.push({ q, ...r });
    if (!r.ok && /429|rate.?limited|limiting|cooling down/i.test(r.why || "")) throttled = true;
    console.log(`  ${r.ok ? "·" : "✖"} ${String(r.ms).padStart(5)} ms  ${r.ok ? r.n + " results via " + r.engine : r.why}  — ${q}`);
    await sleep(2500);
  }
  const okRuns = runs.filter((r) => r.ok);
  const med = median(runs.filter((r) => !r.skipped).map((r) => r.ms));
  results.search = { runs, succeeded: okRuns.length, of: runs.length, skipped: runs.filter((r) => r.skipped).length, stoppedOnRefusal: throttled, medianMs: med, engines: [...new Set(okRuns.map((r) => r.engine))] };
  const falsified1 = !QUICK && runs.length > 0 && (okRuns.length < runs.length || med >= 1500);
  console.log(`  → ${okRuns.length}/${runs.length} answered, median ${med} ms — ${QUICK ? "(quick run — not a falsifier test)" : "falsifier 1 " + (falsified1 ? "TRIPPED" : "not tripped")}`);
  results.search.falsifier1Tripped = falsified1;

  // the artifact sandbox, as it stands (an srcdoc iframe running inline script)
  const sb = await page.evaluate(async () => {
    const m = await import("./fold-chat-sandbox.js");
    const r = await m.observeArtifact('<!doctype html><title>t</title><h1>hello</h1><button onclick="document.title=\'clicked\'">go</button><script>document.body.append("ran")<\/script>', { kind: "html", timeoutMs: 6000 });
    return r.checks;
  });
  results.sandbox = { checks: sb };
  const loads = sb.find((c) => c.name === "loads without errors");
  console.log("  · artifact sandbox: " + sb.map((c) => `${c.name}=${c.ok}`).join(", "));
  results.sandbox.loads = !!(loads && loads.ok);

  // the extension's sandbox page, driven through the real helper (fold-chat-sandframe.js): an artifact's own inline script
  // must run there, it must have no extension API, and it must NOT be able to read the person's chats from storage
  await page.bringToFront();
  const proto = await page.evaluate(async () => {
    const { sandboxDoc } = await import("./fold-chat-sandframe.js");
    return await new Promise((resolve) => {
      const f = document.createElement("iframe");
      f.setAttribute("sandbox", "allow-scripts");
      f.style.cssText = "position:fixed;left:0;top:0;width:300px;height:200px;opacity:0";
      const t = setTimeout(() => resolve({ ran: false, why: "timeout" }), 6000);
      window.addEventListener("message", (e) => { if (e.source === f.contentWindow && e.data && e.data.__t === "ran") { clearTimeout(t); resolve({ ran: true, how: "sandbox-page", ...e.data }); } });
      localStorage.setItem("fold-e2e-canary", "the person's chat");
      const html = '<!doctype html><body><script>var ls;try{ls=localStorage.getItem("fold-e2e-canary")}catch(e){ls="blocked:"+e.name}parent.postMessage({__t:"ran",extApi:typeof (window.chrome&&chrome.runtime&&chrome.runtime.id),storage:ls},"*")<\/script></body>';
      sandboxDoc(f, html, { nonce: "e2e" });
      document.body.append(f);
    });
  });
  await page.evaluate(() => localStorage.removeItem("fold-e2e-canary"));
  results.sandbox.page = proto;
  check(proto.ran, "an artifact's inline script runs inside the extension's sandbox page" + (proto.ran ? "" : " (" + proto.why + ")"));
  check(proto.ran && proto.extApi === "undefined", "…it has no extension API there (chrome.runtime.id is " + proto.extApi + ")");
  check(proto.ran && /^blocked:SecurityError$/.test(String(proto.storage)), "…and it cannot read the person's chats from storage (" + proto.storage + ")");
  console.log("  · fold-chat-sandbox.js itself still uses srcdoc: " + (results.sandbox.loads ? "observer works in the extension" : "its observer cannot run in the extension until it loads fold-sandbox.html (patch sent to its owner)"));
});

// ── 2. the test build (also grants https://*/*): direct page reads (falsifier 2) and no relay ─────────────
console.log("\n[2] dist/extension-test — direct page reads, and nothing goes through a relay");
await withExtension("extension-test", async (ctx, id) => {
  watch(ctx);
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${id}/index.html`, { waitUntil: "load" });
  await sleep(1000);
  const reads = [];
  let stopped = false;
  for (const q of (QUICK ? QUERIES.slice(0, 1) : QUERIES.slice(Number(process.env.FOLD_E2E_READS_FROM || 0)))) {
    if (stopped) break;
    const r = await page.evaluate(async (q) => {
      const web = await import("./fold-chat-web.js");
      const out = await web.search("web", q, 0, { direct: true });
      const top = out.results.slice(0, 3);
      const rows = [];
      for (const x of top) {
        const t0 = performance.now();
        const rd = await web.readText(x.url, { direct: true, timeoutMs: 8000 });
        rows.push({ url: x.url, ok: !!rd.ok, via: rd.via, chars: rd.ok ? rd.text.length : 0, head: rd.ok && rd.text.length < 800 ? rd.text.slice(0, 160).replace(/\s+/g, " ") : null, why: rd.ok ? null : rd.error || "unreadable", ms: Math.round(performance.now() - t0) });
      }
      return rows;
    }, q).catch((e) => [{ url: q, ok: false, searchFailed: true, why: "search failed: " + String(e.message).slice(0, 120) }]);
    reads.push(...r);
    if (r.some((x) => x.searchFailed && /429|rate.?limited|limiting|cooling down/i.test(x.why || ""))) { stopped = true; console.log("  · the engine is refusing — stopping here rather than add to the throttle"); }
    for (const x of r) console.log(`  ${x.ok ? "·" : "✖"} ${String(x.ms ?? "").padStart(5)} ms  ${x.ok ? x.chars + " chars" : x.why}  ${String(x.url).slice(0, 70)}`);
    await sleep(2500);
  }
  // "read" = the module's own test (>= 40 readable chars); "substantive" also drops a short answer that SAYS it is a shell
  // (a bot wall, a refusal, a paywall stub) — judged from the text itself, which is kept for every read under 800 chars.
  const SHELL = /access (denied|issue)|captcha|verify (you|that)|enable javascript|are you a (human|robot)|forbidden|request blocked|not available|subscribe to (read|continue)/i;
  for (const x of reads) x.shell = !!(x.ok && x.head && SHELL.test(x.head));
  const pages = reads.filter((x) => !x.searchFailed);                        // a search that failed is not a page that went unread
  const failedSearches = reads.length - pages.length;
  const readable = pages.filter((x) => x.ok).length;
  const substantive = pages.filter((x) => x.ok && !x.shell).length;
  const frac = pages.length ? readable / pages.length : 0;
  const frac2 = pages.length ? substantive / pages.length : 0;
  const PREREG = 36;
  const incomplete = !QUICK && pages.length < PREREG;
  results.reads = { rows: reads, readable, substantive, of: pages.length, preRegisteredN: PREREG, failedSearches, incomplete, fraction: Math.round(frac * 100) / 100, fractionSubstantive: Math.round(frac2 * 100) / 100, falsifier2Tripped: !QUICK && !incomplete && frac2 < 0.8 };
  for (const x of reads.filter((x) => x.head)) console.log(`  · short read (${x.chars} chars)${x.shell ? " — LOOKS LIKE A SHELL" : ""}: "${x.head.slice(0, 110)}"  ${x.url.slice(0, 50)}`);
  console.log(`  → ${readable}/${pages.length} pages read (module test, >= 40 chars); ${substantive}/${pages.length} substantive (${Math.round(frac2 * 100)}%)` + (failedSearches ? `; ${failedSearches} search(es) failed, so those queries' pages were never tried` : ""));
  console.log(QUICK ? "  (quick run — not a falsifier test)" : incomplete ? `  falsifier 2: INCOMPLETE — ${pages.length} of the pre-registered ${PREREG} pages were tried; no verdict` : `  falsifier 2 ${frac2 < 0.8 ? "TRIPPED" : "not tripped"} (pre-registered: < 80% of ${PREREG})`);
});

// ── 3. across both runs: no relay, no public proxy, no credentials ──────────────────────────────────
const THIRD_PARTY = /workers\.dev|allorigins|codetabs|corsproxy|cors\.eu\.org|thingproxy|r\.jina\.ai|microlink|n8n/i;
const viaThird = exitedTo.filter((r) => THIRD_PARTY.test(r.host));
const hosts = [...new Set(exitedTo.filter((r) => r.type === "fetch" || r.type === "xhr" || r.type === "other").map((r) => r.host))].sort();
results.relay = { requestsViaRelayOrProxy: viaThird.length, hostsContacted: hosts };
console.log("\n[3] where the extension's requests actually went");
console.log("  hosts: " + hosts.join(", "));
check(viaThird.length === 0, "no request went through the relay or a public CORS proxy" + (viaThird.length ? ": " + viaThird[0].url : ""));

results.hardFailures = hard;
fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log(`\nresults → ${OUT}`);
console.log(hard.length ? `\n${hard.length} check(s) FAILED:\n  - ${hard.join("\n  - ")}` : "\nall hard checks held.");
process.exit(hard.length ? 1 : 0);
