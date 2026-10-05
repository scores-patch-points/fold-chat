// Live: how long does a real turn take, and where does the time go? Two turns in one tab (shared memo).
import { searchWeb, makeMemo } from "../../fold-chat-web.js";
const memo = makeMemo();
const qs = process.argv.slice(2).length ? process.argv.slice(2) : ["how long does a sourdough starter take to ferment", "how long does a sourdough starter take to ferment"];
for (const [i, q] of qs.entries()) {
  const t0 = Date.now(); const T = () => String(Date.now() - t0).padStart(6) + "ms";
  const log = [];
  const f = async (u, o) => { const s = Date.now(); let st = "ERR"; try { const r = await fetch(u, o); st = r.status; return r; } finally { log.push(`${String(Date.now() - s).padStart(6)}ms ${st} ${new URL(u).hostname}`); } };
  const marks = [];
  const out = await searchWeb(q, { effort: "balanced", fetchImpl: f, memo, onStep: (s) => { if (["found", "failed", "routed", "read", "unread"].includes(s.phase)) marks.push(`${T()}  ${s.phase} ${s.scope || s.site || ""}${s.n != null ? " n=" + s.n : ""}${s.via ? " via " + s.via : ""}${s.why ? " — " + String(s.why).slice(0, 50) : ""}`); } });
  console.log(`\nTURN ${i + 1}: ${q}\n${marks.join("\n")}\n${T()}  DONE · ${out.passages.length} passages · ${log.length} fetches`);
}
