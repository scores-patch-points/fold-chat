// G3 real-page reproduction: song -> 'who is mt. mckinlet named afer?' -> 'why is the sky blue' on the REAL page (heimdall, gemma2:2b, real web).
//   node eval/ants/g3/repro.mjs <label> [--patch <dir>]   (--patch: serve files from <dir> in place of the page's own, via Playwright routes — how the UNAPPLIED diff is exercised)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openChat } from "../../pivot/chat-live.mjs";
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const label = process.argv[2] || "run"; const pi = process.argv.indexOf("--patch"); const patchDir = pi > 0 ? process.argv[pi + 1] : null;
const ASKS = (process.env.G3_ASKS ? JSON.parse(process.env.G3_ASKS) : ["write me a song about trampolines", "who is mt. mckinlet named afer?", "why is the sky blue"]);
const model = process.env.PIVOT_MODEL || "gemma2:2b";
async function say(page, text, timeout = 300000) {
  const before = await page.evaluate(() => (window.__raw || []).length);
  await page.fill("#input", text); await page.click("#send"); await page.waitForTimeout(1500);
  await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled && !i.readOnly && i.getAttribute("aria-busy") !== "true" && !/stop/i.test(document.getElementById("send")?.getAttribute("aria-label") || ""); }, undefined, { timeout }).catch(() => {});
  await page.waitForTimeout(1000);
  return page.evaluate((before) => {
    const s = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {};
    const m = [...(s.messages || [])].reverse().find((x) => x.role === "assistant"); const g = m?.grounding || {};
    const feed = (g.feed || []).filter((e) => /query|Followed/i.test(String(e.title || e.label || ""))).map((e) => `${e.title || e.label}: ${e.note || ""}`);
    return { web: (g.web || []).slice(0, 12).map((w) => JSON.stringify(w).slice(0, 160)), spoken: m?.content ?? "", kind: g.kind, followed: g.followed || null, feed, reads: (g.web || []).filter((w) => w.read).map((w) => w.read), passages: (g.passages || []).map((p) => `${p.ref} <${p.url || p.source}>`),
      notices: (m?.notices || []).map((n) => `[${n.kind}] ${String(n.text || "").slice(0, 160)}`), raws: (window.__raw || []).slice(before).map((r) => r.text.slice(0, 500)),
      referents: (s.referents?.entities || []).map((e) => e.surface + "(" + e.weight.toFixed(1) + ")"), summary: { topic: s.summary?.topic, flow: s.summary?.flow, entities: s.summary?.entities } };
  }, before);
}
const browser = await chromium.launch();
const { ctx, page, calls } = await openChat(browser, { model });
if (patchDir) await page.route(/\/[^/]+\.(?:js|mjs)(?:\?.*)?$/, async (route) => { const f = path.join(patchDir, path.basename(new URL(route.request().url()).pathname)); if (fs.existsSync(f)) return route.fulfill({ status: 200, contentType: "text/javascript", body: fs.readFileSync(f, "utf8") }); return route.continue(); });
if (patchDir) { await page.reload({ waitUntil: "networkidle" }); await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled; }, undefined, { timeout: 90000 }); }
// SEED=1: replay the stored chat of the report: turn 1 asked for a song and the assistant text came back EMPTY; turn 2 was answered as a song; the referent
// record holds what those turns admitted (built by the REAL admitReferents). Only the last ask is then run live. This is the user's state, not a stub of the code under test.
if (process.env.SEED) {
  const { admitReferents, emptyReferents } = await import("../../../fold-chat-mind.js");
  const A2 = "President McKinley, a name that rings so bold,\nAcross the land, a story to be told.\nMount McKinley stands tall, in Alaska's sky,\nNamed for a president, reaching up high.";
  const ref = process.env.SEED === "song" ? emptyReferents() : admitReferents(emptyReferents(), { question: "who is mt. mckinlet named afer?", answer: A2, sources: [{ title: "William McKinley" }, { title: "Blue Room" }] });
  await say(page, "hello");   // creates the stored session (a greeting: no search); its messages are replaced below
  await page.evaluate(({ ref, A2, song }) => { const S = JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}"); const s = Object.values(S).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0];
    const at = new Date().toISOString();
    s.messages = [{ role: "user", content: "write me a song about trampolines", at }, { role: "assistant", content: "", at, mode: "chat", grounding: { kind: "generate" } }];
    if (song !== "song") s.messages.push({ role: "user", content: "who is mt. mckinlet named afer?", at }, { role: "assistant", content: A2, at, mode: "chat", grounding: { kind: "research", sources: [{ ref: "Wikipedia — William McKinley", address: "https://en.wikipedia.org/wiki/William_McKinley" }] } });
    s.referents = ref; localStorage.setItem("fold-chat:sessions", JSON.stringify(S)); }, { ref, A2, song: process.env.SEED });
  await page.reload({ waitUntil: "networkidle" }); await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled; }, undefined, { timeout: 90000 });
}
// --relay-shim: the app's web relay (a Cloudflare Worker over DuckDuckGo) answered 502 for every query during this session (curl, 3 of 3). The shim answers the SAME two relay
// endpoints from live Wikipedia: /search?scope=web&q= from Wikipedia's search API, /raw?url= by fetching the real page. The app code, the model and the pages are real; only the
// search backend differs, and the run says so. It is used identically BEFORE and AFTER.
if (process.argv.includes("--relay-shim")) {
  // every upstream answer is cached on disk (eval/ants/g3/shim-cache) so BEFORE and AFTER read the very same results, and a rate-limited upstream is retried with backoff
  const crypto = await import("node:crypto"); const CDIR = path.join(HERE, "shim-cache"); fs.mkdirSync(CDIR, { recursive: true });
  const cached = async (url, kind) => {
    const f = path.join(CDIR, crypto.createHash("sha1").update(url).digest("hex") + "." + kind);
    if (fs.existsSync(f)) return { status: 200, ctype: kind === "json" ? "application/json" : "text/html", body: fs.readFileSync(f) };
    for (let i = 0; i < 6; i++) {
      const r = await fetch(url, { headers: { "user-agent": "fold-g3-eval/1.0 (research eval)" }, redirect: "follow" });
      const buf = Buffer.from(await r.arrayBuffer());
      const ok = r.ok && (kind !== "json" || buf.toString("utf8", 0, 1) === "{");
      if (ok) { fs.writeFileSync(f, buf); return { status: 200, ctype: r.headers.get("content-type") || "text/html", body: buf }; }
      if (r.status === 404 || r.status === 403) return { status: r.status, ctype: "text/html", body: buf };
      await new Promise((res) => setTimeout(res, 3000 * (i + 1)));
    }
    throw new Error("upstream kept refusing: " + url);
  };
  await page.route("**/holodeck-proxy.prometheoid.workers.dev/**", async (route) => {
    const u = new URL(route.request().url()); const CORS = { "access-control-allow-origin": "*" };
    try {
      if (u.pathname === "/search") {
        const q = u.searchParams.get("q") || "";
        const wiki = async (qq) => JSON.parse((await cached("https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=8&srinfo=suggestion&srsearch=" + encodeURIComponent(qq), "json")).body.toString("utf8"));
        let j = await wiki(q);
        // a typo'd ask ("mckinlet", "afer") has no exact hit on Wikipedia; its own spelling suggestion is searched, as a web engine would
        if (!(j.query?.search || []).length && j.query?.searchinfo?.suggestion) j = await wiki(j.query.searchinfo.suggestion);
        const results = (j.query?.search || []).map((x) => ({ title: x.title + " - Wikipedia", url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(x.title.replace(/ /g, "_")), snippet: String(x.snippet || "").replace(/<[^>]+>/g, ""), source: "en.wikipedia.org" }));
        return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ results, engine: "Wikipedia search (shim for the 502 relay)" }) });
      }
      if (u.pathname === "/raw") {
        const r = await cached(u.searchParams.get("url"), "html");
        return route.fulfill({ status: r.status, headers: { ...CORS, "content-type": r.ctype }, body: r.body });
      }
    } catch (e) { console.error("[shim]", e.message); return route.fulfill({ status: 502, headers: CORS, body: "shim error " + e.message }); }
    return route.continue();
  });
}
const out = [];
for (const ask of ASKS) {
  const n0 = calls.length; const r = await say(page, ask);
  const sentAll = calls.slice(n0).map((c) => (c.body?.messages || []).map((m) => `${m.role}: ${String(m.content).replace(/\s+/g, " ").slice(0, 260)}`));
  const sent = sentAll.filter((c) => !/^system: You check an answer against the sources/.test(c[0] || ""));   // the answer-writing call(s), not the verifier
  out.push({ ask, ...r, modelRequest: sent[0] || null });
  console.log(`\nTURN  ${ask}\n  kind=${r.kind}  followed=${JSON.stringify(r.followed)}\n  feed: ${r.feed.join(" | ")}\n  reads: ${r.reads.join(", ")}\n  web: ${r.web.join(" || ")}\n  model got: ${(sent[0] || []).map((x) => "\n     " + x).join("")}\n  spoken: ${String(r.spoken).slice(0, 300).replace(/\n/g, " / ")}\n  notices: ${r.notices.join(" | ")}\n  referents: ${r.referents.join("; ")}`);
}
fs.writeFileSync(path.join(HERE, `repro-${label}.json`), JSON.stringify({ label, model, at: new Date().toISOString(), patchDir, turns: out }, null, 1));
await ctx.close(); await browser.close();
