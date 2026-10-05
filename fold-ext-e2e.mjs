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
const OUT = "/private/tmp/fold-ext-e2e-results.json";
let playwright;
try { playwright = await import("playwright"); } catch { playwright = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs"); }
const { chromium } = playwright;

const QUERIES = [
  "statute of frauds contract writing requirement", "adverse possession elements", "force majeure clause meaning",
  "promissory estoppel versus consideration", "doctrine of laches equitable defense", "UCC article 2 perfect tender rule",
  "res ipsa loquitur negligence", "Miranda warning custodial interrogation", "easement by prescription requirements",
  "liquidated damages penalty clause enforceability", "attorney client privilege crime fraud exception", "summary judgment standard federal rule 56",
];
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = { startedAt: new Date().toISOString(), chromium: null, boot: {}, guard: {}, search: {}, reads: {}, sandbox: {}, relay: {} };
const hard = [];                                                   // failures of things that must hold
const check = (ok, what) => { console.log((ok ? "  ✔ " : "  ✖ ") + what); if (!ok) hard.push(what); };

async function withExtension(dir, fn) {
  const ext = path.join(ROOT, "dist", dir);
  if (!fs.existsSync(path.join(ext, "manifest.json"))) throw new Error("build first: node scripts/build-extension.mjs" + (dir.endsWith("test") ? " --test-all-hosts" : ""));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "fold-ext-profile-"));
  const ctx = await chromium.launchPersistentContext(profile, { channel: "chromium", headless: true, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
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
  const mounted = await page.evaluate(() => document.querySelector(".app")?.children.length || 0);
  const csp = problems.filter((p) => /Content Security Policy|Refused to (execute|load|apply)/i.test(p));
  results.boot = { id, mounted, problems };
  check(mounted > 0, `the chat mounted (${mounted} top-level nodes) from chrome-extension://${id.slice(0, 8)}…/index.html`);
  check(csp.length === 0, "no CSP violations booting the page" + (csp.length ? ": " + csp[0] : ""));
  const other = problems.filter((p) => !csp.includes(p) && !/localhost:8790|127\.0\.0\.1:8790|ERR_CONNECTION_REFUSED|Failed to load resource/i.test(p));
  console.log(other.length ? "  · other console errors: " + other.slice(0, 3).join(" | ") : "  · no other console errors");

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
  for (const q of QUERIES) {
    const r = await page.evaluate(async (q) => {
      const web = await import("./fold-chat-web.js");
      const t0 = performance.now();
      try { const out = await web.search("web", q, 0, { direct: true }); return { ok: true, ms: Math.round(performance.now() - t0), n: out.results.length, engine: out.engine, first: out.results[0]?.url || null }; }
      catch (e) { return { ok: false, ms: Math.round(performance.now() - t0), why: String(e.message || e).slice(0, 240) }; }
    }, q);
    runs.push({ q, ...r });
    console.log(`  ${r.ok ? "·" : "✖"} ${String(r.ms).padStart(5)} ms  ${r.ok ? r.n + " results via " + r.engine : r.why}  — ${q}`);
    await sleep(2500);
  }
  const okRuns = runs.filter((r) => r.ok);
  const med = median(runs.map((r) => r.ms));
  results.search = { runs, succeeded: okRuns.length, of: runs.length, medianMs: med, engines: [...new Set(okRuns.map((r) => r.engine))] };
  const falsified1 = okRuns.length < runs.length || med >= 1500;
  console.log(`  → ${okRuns.length}/${runs.length} answered, median ${med} ms — falsifier 1 ${falsified1 ? "TRIPPED" : "not tripped"}`);
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
});

// ── 2. the test build (also grants https://*/*): direct page reads (falsifier 2) and no relay ─────────────
console.log("\n[2] dist/extension-test — direct page reads, and nothing goes through a relay");
await withExtension("extension-test", async (ctx, id) => {
  watch(ctx);
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${id}/index.html`, { waitUntil: "load" });
  await sleep(1000);
  const reads = [];
  for (const q of QUERIES.slice(0, 4)) {
    const r = await page.evaluate(async (q) => {
      const web = await import("./fold-chat-web.js");
      const out = await web.search("web", q, 0, { direct: true });
      const top = out.results.slice(0, 3);
      const rows = [];
      for (const x of top) {
        const t0 = performance.now();
        const rd = await web.readText(x.url, { direct: true, timeoutMs: 8000 });
        rows.push({ url: x.url, ok: !!rd.ok, via: rd.via, chars: rd.ok ? rd.text.length : 0, why: rd.ok ? null : rd.error || "unreadable", ms: Math.round(performance.now() - t0) });
      }
      return rows;
    }, q).catch((e) => [{ url: q, ok: false, why: "search failed: " + String(e.message).slice(0, 120) }]);
    reads.push(...r);
    for (const x of r) console.log(`  ${x.ok ? "·" : "✖"} ${String(x.ms ?? "").padStart(5)} ms  ${x.ok ? x.chars + " chars" : x.why}  ${String(x.url).slice(0, 70)}`);
    await sleep(2500);
  }
  const readable = reads.filter((x) => x.ok).length;
  const frac = reads.length ? readable / reads.length : 0;
  results.reads = { rows: reads, readable, of: reads.length, fraction: Math.round(frac * 100) / 100, falsifier2Tripped: frac < 0.8 };
  console.log(`  → ${readable}/${reads.length} top-3 results readable (${Math.round(frac * 100)}%) — falsifier 2 ${frac < 0.8 ? "TRIPPED" : "not tripped"}`);
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
