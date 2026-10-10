// G2 I3: REAL gemma2:2b replies to generate asks, handed the same system message the page hands it (GENERATE_NUDGE + sourcesPrompt of real pages).
// Output eval/ants/g2/model-outputs.json: { id, ask, outputType, sources:[ids], reply, finish } — the modelResult of the real-model cases.
import fs from "node:fs";
import { GENERATE_NUDGE } from "../../../fold-chat-discourse.js";
import { sourcesPrompt } from "../../../fold-chat-gaps.js";
const pages = Object.fromEntries(JSON.parse(fs.readFileSync("eval/ants/g2/pages.json", "utf8")).map((p) => [p.id, p]));
const P = (id, n = 2500) => ({ ref: `${new URL(pages[id].url).hostname.replace(/^www\./, "")} — ${pages[id].title}`, url: pages[id].url, text: pages[id].text.slice(0, n) });
const plan = [
  ["telephone-good", "write me an essay on the telephone", { type: "essay", topic: "the telephone" }, ["ctl-wp-telephone", "ctl-wp-history-telephone", "ctl-nms-bell"]],
  ["telephone-meta", "write me an essay on this", { type: "essay", topic: "invented telephone" }, ["tut-leverageedu-telephone", "tut-gradesfixer-telephone", "tut-essaysio-telephone"]],
  ["telephone-service", "write me an essay on this", { type: "essay", topic: "invented telephone" }, ["tut-papersowl", "tut-ivypanda-tool"]],
  ["sea-poem", "write a poem about the sea", { type: "poem", topic: "the sea" }, ["ctl-wp-sea"]],
  ["solar-report", "write a report on solar power", { type: "report", topic: "solar power" }, ["ctl-wp-solar", "ctl-nasa-solar"]],
  ["haiku-nosrc", "write a haiku about autumn", { type: "haiku", topic: "autumn" }, []],
  ["essay-nosrc", "write an essay about the extinction of dolphins", { type: "essay", topic: "the extinction of dolphins" }, []],
  ["coverletter-nosrc", "write a cover letter for my job application", { type: "cover letter", topic: "my job application" }, []],
  ["essay-howto-src", "write an essay about climate", { type: "essay", topic: "climate" }, ["tut-purdue-essay", "tut-wikihow-essay"]],
  ["wedding-speech", "write a speech for my sister's wedding", { type: "speech", topic: "my sister's wedding" }, ["ctl-wp-wedding"]],
];
const out = [];
for (const [id, ask, outputType, srcs] of plan) for (const rep of [1, 2]) {
  const sys = [GENERATE_NUDGE, srcs.length ? sourcesPrompt(srcs.map((s) => P(s))) : null].filter(Boolean).join("\n\n");
  const r = await fetch("http://127.0.0.1:11434/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "gemma2:2b", messages: [{ role: "system", content: sys }, { role: "user", content: ask }], max_tokens: 1024, temperature: 0.7 }) });
  const j = await r.json(); const reply = j.choices?.[0]?.message?.content ?? ""; const finish = j.choices?.[0]?.finish_reason ?? null;
  out.push({ id: `${id}#${rep}`, ask, outputType, sources: srcs, reply, finish });
  console.log(`\n== ${id}#${rep} (${reply.split(/\s+/).length} words, finish ${finish})\n${reply.slice(0, 260).replace(/\n/g, " ")}`);
}
fs.writeFileSync("eval/ants/g2/model-outputs.json", JSON.stringify({ model: "gemma2:2b", at: new Date().toISOString(), out }, null, 1));
