// live.mjs — the whole path on real data: person -> the chat's own web search -> ranked pages -> read (Node fetch, Playwright fallback) -> classify -> bank. Not pre-registered; a demonstration with its full trail.
import { read, closeReader } from "./reader.mjs";
import { voicesFor, createFetchedBank } from "../../../fold-chat-fetchedvoice.js";
const web = await import("../../../fold-chat-web.js");
const search = async (q) => { for (let i = 0; i < 3; i++) { try { const r = await web.search("web", q); const out = (r.results || []).filter((x) => /^https?:/.test(x.url || "")).map((x) => ({ url: x.url, title: x.title || "", snippet: x.snippet || "" })); if (out.length) return out; } catch {} await new Promise((r) => setTimeout(r, 1200 * (i + 1))); } return []; };
const people = process.argv.slice(2);
for (const person of people) {
  const res = await voicesFor({ person, search, read, limits: { maxPages: 5 } });
  console.log("\n==", person, "—", res.entries.length, "admitted");
  for (const t of res.trail) console.log("  ", (t.verdict || "").padEnd(9), (t.reasons || [t.query]).join(",").padEnd(46), t.url || "");
  const bank = createFetchedBank(); for (const e of res.entries) bank.admit(e);
  for (const e of res.entries) console.log("   ->", e.handle, e.source.host, e.source.sha256.slice(0, 10), e.source.chars + " chars", e.bank.length + " quotable sentences", "|", e.bank[Math.floor(e.bank.length / 2)]?.text.slice(0, 110));
}
await closeReader();
