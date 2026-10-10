// eval/ants/e1/run.mjs — E1: do the effort levels / answer modes buy anything? Drives the REAL page (eval/pivot/chat-live.mjs).
//   node eval/ants/e1/run.mjs [--workers 3] [--reps 2] [--only a1,b2] [--limit N]    resumable: runs already in results-e1.json are skipped
// Output: eval/ants/e1/results-e1.json (array of per-run records, rewritten after every run)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { parseBrave, braveHasResults, UA as UA_ } from "/Users/mlacy/Documents/3.0/heimdall/src/websearch.js";
import { openChat, say } from "../../pivot/chat-live.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, (process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "results-e1.json"));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const PROXY = args.includes("--proxy-search");   // regime B: the relay's open-web SEARCH is answered by this machine's own heimdall search (127.0.0.1:8790); everything else is untouched
const WORKERS = +opt("workers", 3), REPS = +opt("reps", 2), ONLY = opt("only", null), LIMIT = +opt("limit", 1e9);
const Q = JSON.parse(fs.readFileSync(path.join(HERE, "questions.json"), "utf8")).filter((q) => !ONLY || ONLY.split(",").includes(q.id));
const CELLS = [["fast", "facing"], ["balanced", "facing"], ["deep", "facing"], ["balanced", "snips"]];
const NOANS = /\b(no one|none|nobody|not (been|yet|known|available|found|established|specified)|has not|hasn't|never|unknown|no (record|source|information|evidence)|cannot|can't|unable)\b/i;
let { chromium } = await import("playwright");

// deterministic shuffle (seeded) so order is not confounded with cell
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const jobs = [];
for (const q of Q) for (const [effort, answer] of CELLS) for (let rep = 1; rep <= REPS; rep++) jobs.push({ id: `${q.id}|${effort}|${answer}|${rep}`, q, effort, answer, rep });
{ const r = rng(20261006); for (let i = jobs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [jobs[i], jobs[j]] = [jobs[j], jobs[i]]; } }


// REGIME B search: one live search per DISTINCT query (spaced >= GAP ms apart, serialized), cached for the whole battery, so the three levels
// (and both repeats) of a question are handed the SAME result page and the upstream engines are not hammered (Brave answered 429 under regime A's load).
const SERP = new Map(), SERPSTAT = { hit: 0, miss: 0, live: 0, liveFail: 0 };
let serpChain = Promise.resolve(), lastLive = 0;
const GAP = +opt("gap", 7) * 1000;
function liveSearch(q) {
  const p = serpChain.then(async () => {
    if (SERP.has(q)) return SERP.get(q);
    for (let attempt = 0; attempt < +opt("attempts", 4); attempt++) {
      const wait = lastLive + GAP - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastLive = Date.now(); SERPSTAT.live++;
      try {   // heimdall's own Brave request + parser, fetched with curl (Node's fetch was answered 429 by Brave while curl from the same address was answered 200)
        const html = await new Promise((res, rej) => execFile("curl", ["-s", "-m", "15", "-A", UA_, "-H", "accept-language: en-US,en;q=0.9", "https://search.brave.com/search?" + new URLSearchParams({ q, source: "web" })], { maxBuffer: 20e6 }, (e, out) => (e ? rej(e) : res(out))));
        if (braveHasResults(html)) { const results = parseBrave(html); if (results.length) { const body = JSON.stringify({ scope: "web", q, engine: "Brave Search", count: results.length, results }); SERP.set(q, body); return body; } }
      } catch {}
      SERPSTAT.liveFail++;
      await new Promise((r) => setTimeout(r, +opt("retry", 15) * 1000 * (attempt + 1)));
    }
    return null;
  });
  serpChain = p.catch(() => {});
  return p;
}
let results = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : [];
const done = new Set(results.map((r) => r.id));
const todo = jobs.filter((j) => !done.has(j.id)).slice(0, LIMIT);
console.log(`jobs ${jobs.length}, done ${done.size}, to run ${todo.length}, workers ${WORKERS}`);
const save = () => { fs.writeFileSync(OUT + ".tmp", JSON.stringify(results)); fs.renameSync(OUT + ".tmp", OUT); };

function breakdown(g) {
  const st = (g.tape || []).filter((t) => t.kind === "st").map((t) => ({ at: t.at, ...t.st }));
  const doneEv = (g.feed || []).find((e) => e.op === "done");
  const total = doneEv ? doneEv.at / 1000 : null;
  const firstRead = st.find((s) => s.phase === "reading");
  const reads = st.filter((s) => s.phase === "read" || s.phase === "unread");
  const lastRead = reads.length ? Math.max(...reads.map((s) => s.at)) : null;
  const foundAts = st.filter((s) => s.phase === "found" || s.phase === "failed").map((s) => s.at);
  const searchEnd = firstRead ? firstRead.at : (foundAts.length ? Math.max(...foundAts) : null);
  return { turn_s: total, search_s: searchEnd, read_s: firstRead && lastRead != null ? lastRead - firstRead.at : null, post_s: total != null && lastRead != null ? total - lastRead : (total != null && searchEnd != null ? total - searchEnd : null),
    n_read_ok: st.filter((s) => s.phase === "read").length, n_unread: st.filter((s) => s.phase === "unread").length, n_snippet: st.filter((s) => s.phase === "snippet").length };
}

async function runOne(browser, job) {
  const t0 = Date.now();
  const rec = { id: job.id, qid: job.q.id, cat: job.q.cat, effort: job.effort, answer: job.answer, rep: job.rep, at: new Date().toISOString() };
  let ctx;
  try {
    const o = await openChat(browser);
    ctx = o.ctx; const page = o.page;
    if (PROXY) await ctx.route(/holodeck-proxy\.prometheoid\.workers\.dev\/search\?scope=web/, async (route) => {
      const q = new URL(route.request().url()).searchParams.get("q") || "";
      const hdr = { "access-control-allow-origin": "*" };
      const hit = SERP.get(q);
      if (hit) { SERPSTAT.hit++; return route.fulfill({ status: 200, contentType: "application/json", headers: hdr, body: hit }); }
      SERPSTAT.miss++;
      const body = await liveSearch(q);
      if (body) return route.fulfill({ status: 200, contentType: "application/json", headers: hdr, body });
      return route.fulfill({ status: 502, contentType: "application/json", headers: hdr, body: "{}" });
    });
    await page.evaluate(([e, a]) => { localStorage.setItem("fold-chat:effort", e); localStorage.setItem("fold-chat:answerMode", a); }, [job.effort, job.answer]);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled; }, undefined, { timeout: 60000 });
    const tAsk = Date.now();
    const r = await say(page, job.q.q, 240000);
    rec.wall_s = (Date.now() - tAsk) / 1000;
    rec.timeout = rec.wall_s > 235;
    const m = await page.evaluate(() => { const S = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0]; return [...(S?.messages || [])].reverse().find((x) => x.role === "assistant") || null; });
    if (!m) { rec.error = "no assistant message"; return rec; }
    const g = m.grounding || {};
    const spoken = String(m.content || "");
    rec.spoken = spoken.slice(0, 1500); rec.len = spoken.length;
    rec.effort_stamped = g.effort || null; rec.answerMode_stamped = g.answerMode || m.answerMode || null;
    rec.model_calls = (r.raws || []).length;
    Object.assign(rec, breakdown(g));
    rec.nSources = g.nSources ?? 0;
    rec.coverage = g.coverage ? { grounded: g.coverage.grounded, total: g.coverage.total } : null;
    rec.falsify = g.falsify ? { checked: g.falsify.checked, supported: g.falsify.supported, weak: g.falsify.weak, unsupported: g.falsify.unsupported, entries: (g.falsify.entries || []).map((e) => ({ text: String(e.text).slice(0, 160), verdict: e.verdict })) } : null;
    rec.loop = g.loop ? { passes: (g.loop.passes || []).length, cleared: !!g.loop.cleared, firstTry: !!g.loop.firstTry, restated: (g.loop.passes || []).reduce((n, p) => n + (p.restated || []).filter((x) => x.to).length, 0), after: g.loop.after || null } : null;
    rec.void = g.void ? g.void.kind : null;
    rec.web = (g.web || []).filter((w) => w.scope && w.scope !== "route" && w.scope !== "topic" && !w.read).map((w) => ({ scope: w.scope, ok: !!w.ok, n: w.n ?? null, engine: w.engine || null, why: w.why ? String(w.why).slice(0, 80) : null }));
    rec.webOk = rec.web.some((w) => w.scope === "web" && w.ok);
    rec.anySearchOk = rec.web.some((w) => w.ok);
    rec.readUrls = (g.web || []).filter((w) => w.read && w.ok !== false && w.chars).map((w) => w.read);
    const passages = (g.passages || []).map((p) => String(p.text || ""));
    rec.nPassages = passages.length;
    // ground truth, by code
    if (job.q.gt) {
      const re = new RegExp(job.q.gt);
      rec.right = re.test(spoken);
      rec.backedCode = passages.some((t) => re.test(t));
      rec.gc = rec.right && rec.backedCode;
      rec.gcFold = job.answer === "facing" ? (rec.right && (rec.coverage?.grounded || 0) >= 1) : null;
      rec.concise = rec.right && spoken.length <= 400;
      rec.gtInReads = rec.backedCode;
    } else {
      rec.honest = !spoken.trim() || !!g.void || NOANS.test(spoken);
    }
    rec.fail = !spoken.trim() && !rec.nSources; // nothing spoken and no source reached
    rec.empty = !spoken.trim();
  } catch (e) { rec.error = String(e && e.message || e).slice(0, 300); }
  finally { try { await ctx?.close(); } catch {} rec.total_s = (Date.now() - t0) / 1000; }
  return rec;
}

if (PROXY) {   // warm the cache for every question's natural-language query before any timed run
  const SF = path.join(HERE, "serp-cache.json");
  if (fs.existsSync(SF)) for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(SF, "utf8")))) SERP.set(k, v);
  for (const q of Q) if (!SERP.has(q.q)) { const b = await liveSearch(q.q); console.log("prewarm", q.id, b ? "ok" : "FAILED"); fs.writeFileSync(SF, JSON.stringify(Object.fromEntries(SERP))); }
}
if (args.includes("--prewarm-only")) { console.log("prewarmed", SERP.size, "of", Q.length); process.exit(0); }
const browser = await chromium.launch();
let idx = 0, n = 0;
const worker = async (w) => {
  while (idx < todo.length) {
    const job = todo[idx++];
    const rec = await runOne(browser, job);
    results.push(rec); save(); n++;
    console.log(`[${n}/${todo.length}] w${w} ${job.id} turn=${rec.turn_s?.toFixed?.(1)}s ${rec.error ? "ERR " + rec.error : (job.q.gt ? (rec.gc ? "GC" : rec.right ? "right-unbacked" : "wrong") : (rec.honest ? "honest" : "HALLUC"))} ${JSON.stringify((rec.spoken || "").slice(0, 70))}`);
  }
};
await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i + 1)));
await browser.close();
console.log("serp cache", JSON.stringify(SERPSTAT));
if (PROXY) fs.writeFileSync(path.join(HERE, "serp-cache.json"), JSON.stringify(Object.fromEntries(SERP)));
console.log("finished");
