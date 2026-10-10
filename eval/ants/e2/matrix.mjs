// eval/ants/e2/matrix.mjs — paired, interleaved before/after: for each ground-truth question, every config is run back to back (order rotated per question to cancel drift).
//   node eval/ants/e2/matrix.mjs <label> <worker 0..n-1> <n workers> [configs=ABCDE]
import fs from "node:fs";
import { chromium, openInstrumented, turn, save } from "./lib.mjs";
import { CONFIGS } from "./configs.mjs";
const [label, wi, wn, cfgs = "ABCDE"] = process.argv.slice(2);
const truth = JSON.parse(fs.readFileSync(new URL("./truth.json", import.meta.url))).facts;
const mine = truth.filter((_, i) => i % Number(wn) === Number(wi));
const browser = await chromium.launch();
const out = [];
for (const [qi, q] of mine.entries()) {
  const order = [...cfgs]; for (let k = 0; k < qi % order.length; k++) order.push(order.shift());
  for (const key of order) {
    const c = CONFIGS[key];
    const { ctx, page } = await openInstrumented(browser, c);
    let r; try { r = await turn(page, q.ask); } catch (e) { r = { ask: q.ask, error: String(e) }; }
    r.id = q.id; r.cfg = key; r.correct = new RegExp(q.re, "i").test(String(r.spoken || "") + " " + String(r.shown || ""));
    if (r.mark) { const c0 = r.mark.c0; r.t = { ttfa: r.mark.ttfa, ttd: r.mark.ttd, all: Math.max(r.mark.ttd ?? 0, r.e2?.provAt ? r.e2.provAt - c0 : 0) }; }
    out.push(r);
    console.log(`${q.id.padEnd(11)} ${key} ttfa ${r.t ? (r.t.ttfa / 1000).toFixed(1) : "?"}  ttd ${r.t ? (r.t.ttd / 1000).toFixed(1) : "?"}  all ${r.t ? (r.t.all / 1000).toFixed(1) : "?"}  ${r.correct ? "OK " : "WRONG "} ${String(r.spoken || "").slice(0, 60).replace(/\n/g, " ")}`);
    save(`${label}-w${wi}.json`, { label, worker: wi, at: new Date().toISOString(), turns: out });
    await ctx.close();
  }
}
await browser.close();
