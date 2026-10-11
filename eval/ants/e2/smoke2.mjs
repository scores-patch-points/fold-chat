import { chromium, openInstrumented, turn } from "./lib.mjs";
import { CONFIGS } from "./configs.mjs";
const c = CONFIGS[process.argv[2] || "C"];
const b = await chromium.launch(); const { ctx, page } = await openInstrumented(b, c);
const r = await turn(page, process.argv[3] || "What is the chemical symbol for gold?");
console.log(c.name, JSON.stringify({ ttfa: r.mark.ttfa, ttd: r.mark.ttd, e2: r.e2, c0: r.mark.c0, allDone: r.e2.provAt ? r.e2.provAt - r.mark.c0 : null, spoken: r.spoken, prov: r.msg.provenance, nf: r.f.length }));
await ctx.close(); await b.close();
