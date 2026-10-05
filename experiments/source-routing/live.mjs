// Live check: run the real searchWeb (route on vs off) against the real network.
import { searchWeb } from "../../fold-chat-web.js";
const qs = process.argv.slice(2).length ? process.argv.slice(2) : ["whats a good pancake recipe?", "when was the Eiffel Tower built", "does creatine improve memory"];
for (const q of qs) {
  for (const route of [true, false]) {
    const calls = []; const t0 = Date.now();
    const out = await searchWeb(q, { route, effort: "balanced", fetchImpl: (u, o) => { calls.push(new URL(u).hostname); return fetch(u, o); } });
    const rt = out.trace.find((t) => t.scope === "route");
    console.log(`\n${route ? "ROUTED" : "OLD   "} · ${q}\n  ${Date.now() - t0}ms · ${calls.length} fetches · ${out.results.length} results · ${out.passages.length} passages read`);
    if (rt) console.log(`  route: ${rt.picked.join("+")}${rt.fellBack ? " (fell back)" : ""} · skipped ${rt.skipped.join(",") || "—"}`);
    for (const p of out.passages) console.log("  read:", p.ref.slice(0, 90));
  }
}
