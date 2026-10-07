#!/usr/bin/env node
// eval/ants/c8/v2-eval.mjs — C8: reach of fold-chat-primary.js (A2, "a2") vs c8/primary-v2.mjs ("v2") on A3's cached web snapshot, with A3's oracle.
//   node eval/ants/c8/v2-eval.mjs --module a2|v2 [--prefilter] [--lean] [--pointer model|best] [--tag x]
// NO network: search/readPage are served ONLY from eval/ants/.primary-cache.json (A3's snapshot; a miss is "no results"/"unreadable" and is counted). Indexed Wikipedia text = cache "w:<question>" (as A3's a2idx arm).
//   --pointer model : local Ollama gemma2:2b, temperature 0 (the real pointing model, as A3).
//   --pointer best  : a model-free BEST-CASE pointer: picks the first numbered candidate that passes the module's own gate (a2: provenance.bearsOn + its assertsClaim; v2: the gate PRE-FILTERS the numbered list and the pointer takes #1, so the page's own context reaches the gate). It isolates "can the gate+generator ever accept it" from the 2b model's pointing.
// Beyond A3's oracle (which is page-level), every returned page's POINTED QUOTE is also checked against the claim's `say` regexes (quoteSays), and counted as a false accept when it does not.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { classifyPage, scoreClaim, scoreAll } from "../primary-oracle.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ANTS = path.resolve(HERE, "..");
const ROOT = path.resolve(HERE, "../../..");
const args = process.argv.slice(2);
const flag = (n, d = null) => { const i = args.indexOf("--" + n); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true); };
const MODULE = flag("module", "v2"), LEAN = !!flag("lean"), PREFILTER = !!flag("prefilter"), POINTER = flag("pointer", "model"), TAG = flag("tag", "");
const corpus = JSON.parse(fs.readFileSync(path.join(ANTS, "primary-corpus.json"), "utf8"));
const cache = JSON.parse(fs.readFileSync(path.join(ANTS, ".primary-cache.json"), "utf8"));
const misses = { search: 0, read: 0 };
async function search(q) { const v = cache["d:" + q]; if (!v) { misses.search++; return []; } return v; }
async function readPage(u) { const v = cache["r:" + u]; if (!v) { misses.read++; return { ok: false, error: "not_in_snapshot" }; } return v; }
const { FUNCTION_WORDS } = await import(pathToFileURL(path.join(ROOT, "fold-chat-function-words.js")).href);
const fw = new Set(FUNCTION_WORDS.en);
const mod = await import(pathToFileURL(MODULE === "a2" ? path.join(ROOT, "fold-chat-primary.js") : path.join(HERE, "primary-v2.mjs")).href);
const prov = await import(pathToFileURL(path.join(ROOT, "fold-chat-provenance.js")).href);

let ollamaCalls = 0;
async function modelPoint(messages) {
  ollamaCalls++;
  const r = await fetch("http://127.0.0.1:11434/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "gemma2:2b", messages, stream: false, options: { temperature: 0, num_ctx: 4096 } }), signal: AbortSignal.timeout(90000) });
  const j = await r.json(); return String(j?.message?.content ?? "");
}
function bestPoint(claim) {
  return async (messages) => {
    const lines = String(messages[1].content).split("\n").filter((l) => /^\[\d+\]/.test(l));
    for (const l of lines) {
      const n = /^\[(\d+)\]/.exec(l)[1], text = l.replace(/^\[\d+\]\s*/, "");
      const gate = mod.assertsClaim(claim, text, { fw, indexHost: "en.wikipedia.org", english: true });
      const rel = MODULE === "a2" ? prov.bearsOn(claim, text, fw) : { ok: true };
      if (gate.ok && rel.ok) return n;
    }
    return "NONE";
  };
}
const norm = (t) => String(t ?? "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").toLowerCase();
const withTimeout = (p, ms) => new Promise((resolve) => { const t = setTimeout(() => resolve({ timedOut: true }), ms); p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); resolve({ error: String(e?.stack || e).slice(0, 400) }); }); });

const rows = [];
for (const c of corpus.claims) {
  const claim = LEAN ? c.claimLean : c.claim;
  const idx = cache["w:" + c.question];
  const t0 = Date.now(); const oc0 = ollamaCalls;
  const out = await withTimeout(Promise.resolve(mod.findPrimary({ claim, sentence: claim, indexHost: "en.wikipedia.org", search, readPage, point: POINTER === "best" ? (MODULE === "v2" ? async () => "1" : bestPoint(claim)) : modelPoint, fw, limits: MODULE === "v2" ? { prefilter: PREFILTER || POINTER === "best" } : {}, ...(idx?.text ? { indexText: idx.text } : {}) })), 240000);
  const res = out && !out.timedOut && !out.error ? out : { passages: [], trail: [], pointers: [] };
  const sc = scoreClaim(res, c, corpus);
  const quotes = (res.pointers || []).map((p) => { const ps = res.passages[p.index]; return { host: ps?.url ? new URL(ps.url).hostname.replace(/^www\./, "") : "", url: ps?.url, quote: String(ps?.text || "").slice(p.start, p.end).replace(/\s+/g, " ").trim(), gate: p.gate || null }; });
  for (const q of quotes) q.says = (c.say || []).every((s) => new RegExp(s, "i").test(norm(q.quote)));
  const quoteBad = quotes.filter((q) => !q.says).length;
  rows.push({ ...sc, shape: c.shape, claim, ms: Date.now() - t0, modelCalls: ollamaCalls - oc0, timedOut: !!out?.timedOut, error: out?.error || null, quotes, quoteBad, trail: (res.trail || []).slice(0, 40), passages: (res.passages || []).map((p) => ({ title: p.title, url: p.url, textLen: String(p.text || "").length })) });
  const r = rows[rows.length - 1];
  console.log(`${MODULE}${PREFILTER ? "+pf" : ""}/${POINTER} ${c.id.padEnd(18)} ${r.reach ? "REACH" : r.abstained ? "none " : r.mirrorFA ? "MIRROR" : "miss "} pages=${r.pages.length} quoteBad=${quoteBad} ${r.pages.map((p) => p.cls + ":" + p.host).join(" | ")} (${((r.ms) / 1000).toFixed(0)}s, model ${r.modelCalls}${out?.timedOut ? " TIMEOUT" : ""}${out?.error ? " ERROR " + out.error.slice(0, 80) : ""})`);
  for (const q of quotes) console.log("     quote:", q.says ? "ok " : "BAD", q.host, "|", q.quote.slice(0, 170));
}
const totals = scoreAll(rows);
const reachQ = rows.filter((r) => r.reach && r.quotes.some((q, i) => q.says && r.pages[i]?.cls === "reach")).length;
const summary = { module: MODULE, prefilter: PREFILTER, pointer: POINTER, lean: LEAN, reach: totals.reach, reachWithSayingQuote: reachQ, claims: totals.claims, mirrorFA_pages: totals.mirrorFA_pages, wrongFA_pages: totals.wrongFA_pages, unlistedPass_pages: totals.unlistedPass_pages, quoteBad_pages: rows.reduce((a, r) => a + r.quoteBad, 0), abstained: totals.abstained, returnedPages: rows.reduce((a, r) => a + r.pages.length, 0), cacheMisses: misses, modelCalls: ollamaCalls };
console.log("\n== " + JSON.stringify(summary));
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const base = `v2-eval-${MODULE}${PREFILTER ? "-pf" : ""}-${POINTER}${LEAN ? "-lean" : ""}${TAG ? "-" + TAG : ""}-${stamp}`;
fs.writeFileSync(path.join(HERE, base + ".json"), JSON.stringify({ summary, rows }, null, 1));
console.log("wrote", base + ".json");
