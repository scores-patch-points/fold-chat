import { chromium, openInstrumented, turn } from "./lib.mjs";
const b = await chromium.launch(); const { ctx, page } = await openInstrumented(b, {});
const r = await turn(page, process.argv[2] || "What is the capital of Australia?");
console.log(JSON.stringify({ mark: { ...r.mark, liveText: r.mark.liveText?.length }, spoken: r.spoken, nf: r.f.length, kind: r.msg.kind, pivot: r.msg.pivot, prov: r.msg.provenance, loop: r.msg.loop, feedN: r.msg.feed.length }, null, 1));
for (const f of r.f) console.log(f.cls.padEnd(13), String(Math.round(f.t0)).padStart(6), "→", String(Math.round(f.t1 ?? -1)).padStart(6), f.status, f.cls === "model" ? `max${f.maxTokens} T${f.temp} ${f.promptChars}ch first@${Math.round((f.tFirst ?? 0))} chunks${f.chunks}` : f.u.slice(0, 90));
for (const e of r.msg.feed) console.log(JSON.stringify(e).slice(0, 170));
await ctx.close(); await b.close();
