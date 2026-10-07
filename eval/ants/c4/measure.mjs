// C4 measurement: drive the REAL chat (real page, heimdall, gemma2:2b, real web) and count what each ask sends.
//   node eval/ants/c4/measure.mjs before 1|2      → baseline (no gate), writes eval/ants/c4/before-N.json
//   node eval/ants/c4/measure.mjs live            → the same asks with the pre-registered budget as a Playwright route() gate, writes live.json
//   node eval/ants/c4/measure.mjs replay          → applies the budget offline to before-1/2 and tests "an answer-bearing request is kept"
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { makeBudget, classifyUrl, PRESETS } from "../../../fold-chat-budget.js";
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ASKS = [
  { id: "eiffel", kind: "factual", q: "How tall is the Eiffel Tower?", truth: /\b(330|324|1,?0[68]\d)\b/ },
  { id: "canberra", kind: "factual", q: "What is the capital of Australia?", truth: /Canberra/ },
  { id: "wall", kind: "factual", q: "When did the Berlin Wall fall?", truth: /1989/ },
  { id: "austen", kind: "factual", q: "Who wrote Pride and Prejudice?", truth: /Austen/ },
  { id: "telephone", kind: "contested", q: "Who invented the telephone?", truth: /Bell/, spoken: /Bell|Meucci|Gray/ },
  { id: "pluto", kind: "contested", q: "Is Pluto a planet?", truth: /dwarf planet/ },
  { id: "hello", kind: "chat", q: "Hello, how are you today?", truth: null },
  { id: "thanks", kind: "chat", q: "Thanks, that was really helpful.", truth: null },
];

// ── the gate: ONE decision function used by the live route() gate and by the offline replay, so they cannot disagree about the rules ──
export function makeGate({ preset = "balanced", config = null, now = Date.now } = {}) {
  const budget = makeBudget({ preset, config, now });
  const st = { phase: "search", reads: new Set(), searches: new Set(), models: 0, log: [] };
  const decide = (req) => {   // req: { url, method }
    const info = classifyUrl(req.url, req.method || "GET");
    if (!info) return { count: false, allow: true };
    let tier, kind = info.kind, deny = null;
    if (kind === "models") { tier = st.models === 0 ? "answer" : "corroborate"; st.phase = "model"; }
    else if (kind === "web") { tier = st.searches.has(info.key) || st.searches.size < 2 ? "answer" : "corroborate"; st.searches.add(info.key); }
    else {   // pages
      const isParse = /action=parse/.test(req.url);
      if (isParse && st.phase !== "model") st.phase = "origin";
      if (st.phase === "origin" || st.phase === "model") tier = "origin";
      else {
        st.phase = "read";
        if (!st.reads.has(info.key)) { if (st.reads.size >= 3) deny = "ladder"; else st.reads.add(info.key); }
        if (!deny) tier = [...st.reads].indexOf(info.key) < 2 ? "answer" : "corroborate";
      }
    }
    let r = deny ? { ok: false, why: deny } : budget.spend(kind, tier, info.key);
    if (r.ok && info.proxy && !budget.hedgeSlot(info.key)) r = { ok: false, why: "hedge" };
    if (kind === "models" && r.ok) st.models++;
    st.log.push({ kind, tier, key: info.key, allow: r.ok, why: r.ok ? null : r.why });
    return { count: true, kind, tier, key: info.key, allow: r.ok, why: r.why || null, proxy: !!info.proxy };
  };
  return { budget, decide, st };
}

async function runAsk(browser, ask, { gate }) {
  const { openChat, say } = await import("../../pivot/chat-live.mjs");
  const { ctx, page } = await openChat(browser, {});
  const reqs = []; let t0 = null; const bodies = new Map();
  let G = gate ? makeGate({ preset: ask.kind === "chat" ? "chat" : "balanced", config: (process.env.HEDGE || process.env.NOTIMEMODELS) && ask.kind !== "chat" ? { ...PRESETS.balanced, ...(process.env.HEDGE ? { hedge: +process.env.HEDGE } : {}), ...(process.env.NOTIMEMODELS ? { timeModels: false } : {}) } : null }) : null;
  if (G) await ctx.route("**/*", async (route) => {
    const r = route.request();
    if (t0 === null) return route.continue();   // before the send: page boot, not part of the ask
    const d = G.decide({ url: r.url(), method: r.method() });
    if (d.allow) return route.continue();
    return route.abort("blockedbyclient");
  });
  ctx.on("request", (r) => { if (t0 === null) return; reqs.push({ t: Date.now() - t0, m: r.method(), u: r.url(), body: r.method() === "POST" ? String(r.postData() || "").slice(0, 4000) : null }); });
  const blocked = new Set(); ctx.on("requestfailed", (r) => { if (/blockedbyclient/i.test(String(r.failure() && r.failure().errorText))) blocked.add(r.url() + "|" + r.method()); });
  ctx.on("response", async (resp) => {
    if (t0 === null) return; const u = resp.url();
    const info = classifyUrl(u, resp.request().method()); if (!info || info.kind === "models") return;
    try { const txt = await resp.text(); bodies.set(u, { status: resp.status(), len: txt.length, text: txt.slice(0, 400000) }); } catch {}
  });
  // the send happens inside say(); start the clock when the request listener should begin: mark just before say
  t0 = Date.now(); const wall0 = Date.now();
  const r = await say(page, ask.q);
  const wall = Date.now() - wall0;
  const grounding = await page.evaluate(() => { const s = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {}; const m = [...(s.messages || [])].reverse().find((x) => x.role === "assistant"); return { web: (m?.grounding?.web || []).map((w) => ({ url: w.url || w.read || null, read: !!w.read, tertiary: w.tertiary || null, origin: !!w.origin })), provenance: m?.provenance ? { verified: m.provenance.verified, hosts: (m.provenance.pointers || []).map((p) => p.host), why: m.provenance.why || null, calls: m.provenance.calls } : null }; }).catch(() => null);
  await ctx.close();
  // settle: late responses
  const rec = reqs.map((q) => { const info = classifyUrl(q.u, q.m); const b = bodies.get(q.u); return { blocked: blocked.has(q.u + "|" + q.m), t: q.t, m: q.m, u: q.u.slice(0, 400), kind: info ? info.kind : null, key: info ? info.key : null, proxy: !!(info && info.proxy), status: b ? b.status : null, len: b ? b.len : null, bearing: ask.truth && b && b.status === 200 ? ask.truth.test(b.text.replace(/<[^>]+>/g, " ")) : false, body: q.body && /completions/.test(q.u) ? (() => { try { const j = JSON.parse(q.body); const last = (j.messages || []).slice(-1)[0]; return String(last && last.content || "").slice(0, 200); } catch { return q.body.slice(0, 120); } })() : undefined }; });
  return { ask: ask.id, kind: ask.kind, q: ask.q, wallMs: wall, spoken: r.spoken, shown: r.shown, notices: r.notices, answerOk: ask.truth ? (ask.spoken || ask.truth).test(r.spoken || "") : null, reads: r.reads, modelCalls: r.raws.length, grounding, reqs: rec, gate: G ? { snapshot: G.budget.snapshot(), log: G.st.log } : null };
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  const [mode, n] = process.argv.slice(2);
  if (mode === "before" || mode === "live") {
    const { chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs");
    const browser = await chromium.launch(); const out = [];
    const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
    for (const ask of ASKS) { if (only && !only.includes(ask.id)) continue; const r = await runAsk(browser, ask, { gate: mode === "live" }); out.push(r); const c = (k) => r.reqs.filter((x) => x.kind === k).length; console.log(`${mode}${n || ""} ${ask.id.padEnd(10)} wall ${(r.wallMs / 1000).toFixed(1)}s  wire: web ${c("web")} pages ${c("pages")} models ${c("models")}  answerOk ${r.answerOk}  | ${String(r.spoken).slice(0, 90)}`); fs.writeFileSync(path.join(HERE, `${mode === "live" ? (n ? "live-" + n : "live") : "before-" + n}.json`), JSON.stringify({ at: new Date().toISOString(), mode, runs: out }, null, 1)); }
    await browser.close();
  }
}
