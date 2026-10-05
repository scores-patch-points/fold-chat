// !! NOT REPRESENTATIVE OF AN EXTENSION (found 2026-10-05, after this script's own run):
// !! Node's fetch is answered with a bot challenge (DuckDuckGo) / HTTP 429 (Brave) on the very IP where a
// !! real Chromium gets 200 OK with full results — same address, same hour, 12/12 queries, no challenge.
// !! The block is the TRANSPORT's fingerprint, not volume. The H2 verdict printed by this script is about
// !! Node, not about the extension; the browser-stack numbers are in experiments/source-routing/RESULTS.md.
// FALSIFICATION H2 — the Fold as a browser EXTENSION searches directly (no relay, no CORS).
//
// An extension's background worker holds host permissions: it fetches any origin with no CORS wall,
// from THE USER'S OWN address. Node on this machine is the closest stand-in (same IP, no CORS; the
// UA is set to a desktop Chrome string, which is what the extension's own requests would carry).
//
// H2: searching DuckDuckGo directly (html face, parsed by the khora's own parseSearchResults) beats
//     the Cloudflare relay on success AND latency.
// PRE-REGISTERED. H2 is FALSIFIED if ANY holds:
//   G1  direct success rate <= relay success rate   (success = parsed >= 5 results, not challenged)
//   G2  median direct latency >= median relay latency (successful calls only)
//   G3  more than 25% of direct calls come back as a bot challenge
//   G4  mean results per successful direct call < 5
// Then H3 (direct page reads, no proxy chain):
//   G5  fewer than 80% of the top-3 result pages read directly (>= 40 readable chars, not a shell/challenge)
// 12 queries, one engine at a time, 1.2 s apart. One machine, one hour: NOT a measurement of the web.

import { parseSearchResults, looksLikeShell, looksLikeChallenge, extractReadable } from "../../vendor/khora/native/organs/web.js";
const RELAY = "https://holodeck-proxy.prometheoid.workers.dev";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const QUERIES = ["how long does a sourdough starter take to ferment", "best running shoes for flat feet", "how to get red wine out of carpet", "who was Ada Lovelace", "when did the Hanseatic League dissolve", "does creatine cause kidney damage", "rust crate for async http", "python library for parsing pdf", "Nashville Metro Council meeting schedule", "meta-analysis intermittent fasting weight loss", "how many rivets does the Eiffel Tower have", "what is the capital of Australia"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const timed = async (fn) => { const t = Date.now(); try { return { ...(await fn()), ms: Date.now() - t }; } catch (e) { return { ok: false, err: String(e.message || e).slice(0, 60), ms: Date.now() - t }; } };
const fetchT = (u, o = {}, ms = 25000) => { const c = new AbortController(); const id = setTimeout(() => c.abort(), ms); return fetch(u, { ...o, signal: c.signal, headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9", ...(o.headers || {}) } }).finally(() => clearTimeout(id)); };

const relay = (q) => timed(async () => { const r = await fetchT(`${RELAY}/search?scope=web&q=${encodeURIComponent(q)}`); if (!r.ok) return { ok: false, err: "HTTP " + r.status }; const j = await r.json(); const n = (j.results || []).length; return { ok: n >= 5, n, urls: (j.results || []).map((x) => x.url) }; });
const ddg = (q) => timed(async () => { const r = await fetchT(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`); const h = await r.text(); const p = parseSearchResults(h); if (p.blocked) return { ok: false, blocked: true, err: "challenge" }; return { ok: p.results.length >= 5, n: p.results.length, urls: p.results.map((x) => x.url), status: r.status }; });
const lite = (q) => timed(async () => { const r = await fetchT(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`); const h = await r.text(); const p = parseSearchResults(h); if (p.blocked) return { ok: false, blocked: true, err: "challenge" }; return { ok: p.results.length >= 5, n: p.results.length, urls: p.results.map((x) => x.url), status: r.status }; });

const rows = [];
for (const q of QUERIES) {
  const row = { q, relay: await relay(q) }; await sleep(1200);
  row.ddg = await ddg(q); await sleep(1200);
  row.lite = await lite(q); await sleep(1200);
  rows.push(row);
  const f = (x) => (x.ok ? `ok ${String(x.n).padStart(2)} ${String(x.ms).padStart(5)}ms` : `-- ${(x.err || "").padEnd(9)} ${String(x.ms).padStart(5)}ms`);
  console.log(`relay ${f(row.relay)} | ddg ${f(row.ddg)} | lite ${f(row.lite)} | ${q}`);
}
const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const stat = (k) => { const ok = rows.filter((r) => r[k].ok); return { rate: ok.length / rows.length, ok: ok.length, med: med(ok.map((r) => r[k].ms)), mean: ok.length ? ok.reduce((a, r) => a + r[k].n, 0) / ok.length : 0, blocked: rows.filter((r) => r[k].blocked).length }; };
const S = { relay: stat("relay"), ddg: stat("ddg"), lite: stat("lite") };
console.log("\n", JSON.stringify(S));
const best = S.ddg.rate >= S.lite.rate ? "ddg" : "lite";
const g1 = S[best].rate <= S.relay.rate, g2 = S[best].med == null || (S.relay.med != null && S[best].med >= S.relay.med), g3 = S[best].blocked / rows.length > 0.25, g4 = S[best].mean < 5;
console.log(`direct engine used: ${best}\nG1 success ${S[best].ok}/${rows.length} vs relay ${S.relay.ok}/${rows.length}: ${g1 ? "FALSIFIES" : "ok"}\nG2 median ${S[best].med}ms vs relay ${S.relay.med}ms: ${g2 ? "FALSIFIES" : "ok"}\nG3 challenged ${S[best].blocked}/${rows.length}: ${g3 ? "FALSIFIES" : "ok"}\nG4 mean results ${S[best].mean.toFixed(1)}: ${g4 ? "FALSIFIES" : "ok"}`);

// ── H3: direct page reads, no proxy chain ──
const urls = []; for (const r of rows) for (const u of (r[best].urls || []).slice(0, 3)) urls.push(u);
let read = 0, tried = 0; const fails = {};
await Promise.all(urls.map(async (u, i) => { await sleep((i % 6) * 100); tried++; const t = await timed(async () => { const r = await fetchT(u, {}, 12000); if (!r.ok) return { ok: false, err: "HTTP " + r.status }; const html = (await r.text()).slice(0, 600000); const x = extractReadable(html); const text = (x.text || x.content || (typeof x === "string" ? x : "")); return text.length >= 40 && !looksLikeShell(text) && !looksLikeChallenge({ title: x.title, textChars: text.length }) ? { ok: true } : { ok: false, err: "shell/short" }; }); if (t.ok) read++; else { const h = (() => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } })(); (fails[h] ||= []).push(t.err); } }));
console.log(`\nH3 direct page reads: ${read}/${tried} (${Math.round(100 * read / tried)}%)  G5 (<80%): ${read / tried < 0.8 ? "FALSIFIES" : "ok"}`);
console.log("failures by host:", JSON.stringify(fails));
console.log(`\nVERDICT H2: ${[g1, g2, g3, g4].some(Boolean) ? "FALSIFIED on " + ["G1", "G2", "G3", "G4"].filter((_, i) => [g1, g2, g3, g4][i]).join(",") : "survives"}   H3: ${read / tried < 0.8 ? "FALSIFIED (G5)" : "survives"}`);
