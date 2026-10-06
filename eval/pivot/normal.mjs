// eval/pivot/normal.mjs — "does it answer NORMALLY?": the same real threads (real page, heimdall, gemma2:2b, real web) with the Pivot ON and OFF.
//   node eval/pivot/normal.mjs      → eval/pivot/normal-results.json + a table. A turn is ANSWERED when the person is shown words that answer (a model answer, or a source fall-back);
//   a GAP is a turn that ends in a fold note with no answer text. Nothing is judged for truth here: the spoken text of every turn is printed for a person to read.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openChat, say } from "./chat-live.mjs";
import { chromium } from "playwright";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const THREADS = [
  ["How tall is the Eiffel Tower?", "Who designed it?", "Why was it built?", "What is photosynthesis?", "Where in a plant does it happen?"],
  ["Who was Marie Curie?", "What did she discover?", "When did she die?", "who are you?"],
];
const out = {};
const browser = await chromium.launch();
for (const mode of (process.env.MODES || "on,off").split(",")) {
  out[mode] = [];
  for (const thread of THREADS) {
    const { ctx, page } = await openChat(browser, { pivot: mode === "off" ? "off" : null });
    for (const ask of thread) {
      const r = await say(page, ask);
      const answered = !!String(r.spoken || "").trim();
      out[mode].push({ ask, answered, authored: r.authored, spoken: r.spoken, notices: r.notices.map((n) => n.kind), pivot: r.pivot ? { kept: r.pivot.stats?.kept, in: r.pivot.stats?.in, dropped: (r.pivot.dropped || []).map((d) => d.why), gap: r.pivot.gap?.kind || null } : null, reads: r.reads, modelCalls: r.raws.length });
      console.log(`[${mode}] ${answered ? (r.authored === "sources" ? "SOURCES " : "ANSWER  ") : "GAP     "} ${ask}  →  ${JSON.stringify(String(r.spoken || r.notices.map((n) => n.text).join(" ")).slice(0, 110))}`);
    }
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(HERE, "normal-results.json"), JSON.stringify({ model: process.env.PIVOT_MODEL || "gemma2:2b", at: new Date().toISOString(), out }, null, 1));
for (const mode of Object.keys(out)) { const a = out[mode]; console.log(`\nPivot ${mode.toUpperCase()}: ${a.filter((x) => x.answered && x.authored !== "sources").length} model answers · ${a.filter((x) => x.authored === "sources").length} source fall-backs · ${a.filter((x) => !x.answered).length} gaps  (of ${a.length})`); }
