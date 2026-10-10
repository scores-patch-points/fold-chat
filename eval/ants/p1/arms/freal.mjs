// arm F-real — CONTRAST on the REAL page: eval/pivot/chat-live.mjs openChat/say against http://127.0.0.1:8815/ with gemma2:2b, real web reads, the product's own gates.
// One question per rung (the first of the rung, rewritten to name its pages in plain words, since a real chat has no "this page"). Slow (a search, reads, a model call): labelled a small contrast, n=1 per rung.
import fs from "node:fs";
import path from "node:path";
import { BATTERY, gradeStated, store, HERE } from "../lib.mjs";
const { openChat, say } = await import("../../../pivot/chat-live.mjs");
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const REWRITE = { "r12-2": "Summarize the Wikipedia article about Marie Curie in 3 sentences.", "r13-1": "Do the Wikipedia articles on the Moon and on lunar distance agree on the average distance from the Earth to the Moon?" };
const ids = (process.argv.find((a) => a.startsWith("--ids=")) || "").slice(6).split(",").filter(Boolean);
const pick = ids.length ? ids : BATTERY.filter((q) => q.rung !== 12 && q.rung !== 13).map((q) => q).reduce((m, q) => (m.has(q.rung) ? m : m.set(q.rung, q.id)), new Map()).values();
const list = ids.length ? ids : [...pick, "r12-2", "r13-1"];
const st = store("Freal");
const browser = await chromium.launch({ headless: true });
for (const id of list) {
  if (st.done.has(id)) continue;
  const q = BATTERY.find((x) => x.id === id); const ask = REWRITE[id] || q.q;
  const t0 = Date.now();
  let r = null, err = null;
  try { const { ctx, page, calls } = await openChat(browser, {}); r = await say(page, ask, 300000); await ctx.close(); r.nCalls = calls.length; } catch (e) { err = String(e).slice(0, 200); }
  const text = r?.spoken ?? r?.shown ?? "";
  const g = gradeStated(q, text, { gap: !String(text).trim() });
  st.put({ id, rung: q.rung, ask, ms: Date.now() - t0, err, text, shown: r?.shown ?? null, authored: r?.authored ?? null, kind: r?.kind ?? null, reads: r?.reads ?? [], modelCalls: r?.raws?.length ?? null, pivot: r?.pivot ? { skipped: r.pivot.skipped || null, gap: r.pivot.gap?.kind || null, kept: r.pivot.stats?.kept ?? null } : null, grade: g });
  console.log(id, g.ok ? "OK " : "-- ", g.why, Math.round((Date.now() - t0) / 1000) + "s", "| authored:", r?.authored, "| model calls:", r?.raws?.length, "|", String(text).replace(/\s+/g, " ").slice(0, 100));
}
await browser.close();
