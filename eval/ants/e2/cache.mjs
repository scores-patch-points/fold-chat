// eval/ants/e2/cache.mjs — L5: does asking the SAME question twice in one tab get faster (page memo; search is not memoised)?   node eval/ants/e2/cache.mjs [ask]
import { chromium, openInstrumented, turn, save } from "./lib.mjs";
const asks = process.argv.slice(2).length ? process.argv.slice(2) : ["Who painted the Mona Lisa?", "What is the capital of Canada?"];
const b = await chromium.launch(); const out = [];
for (const ask of asks) {
  const { ctx, page } = await openInstrumented(b, { flags: { "fold-chat:answerMode": "snips" } });   // sources-only: no model noise, only retrieval
  for (const k of [1, 2]) {
    const r = await turn(page, k === 1 ? ask : ask);
    const f = r.f.filter((x) => x.t1 != null && x.cls !== "model" && x.cls !== "local-other");
    const reads = f.filter((x) => /bridge-page|direct|proxy/.test(x.cls) && !/holodeck-proxy.*search|search\?scope/.test(x.u) && !/wikipedia\.org\/w\/api/.test(x.u));
    out.push({ ask, k, ttd: r.mark.ttd ?? (r.msg.feed.find((e) => e.op === "done") || {}).at, nNet: f.length, nPageFetch: reads.length, cachedReadLines: (r.msg.feed || []).filter((e) => e.op === "end" && /^r:/.test(e.id)).length });
    console.log(ask.slice(0, 30).padEnd(30), "ask #" + k, "ttd", ((out[out.length - 1].ttd || 0) / 1000).toFixed(1), "s; network requests", f.length, "; page-fetch requests", reads.length);
  }
  await ctx.close();
}
save("cache.json", out); await b.close();
