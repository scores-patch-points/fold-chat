// ceiling.mjs — the within-turn ceiling: asked COLD (fresh session), does the needle reach the model (live compression: salientSentences 4/page) and does it reach the READ passages? Replay only.
import fs from "node:fs";
import { makeReplayFetch } from "./lib/replay.mjs";
import { newSession, runTurn, makeCtx, norm } from "./sim.mjs";
const A = JSON.parse(fs.readFileSync(new URL("./corpus/asks.json", import.meta.url), "utf8")), N = JSON.parse(fs.readFileSync(new URL("./corpus/needles.json", import.meta.url), "utf8"));
const f = makeReplayFetch({ mode: "replay" }); const rows = [];
for (const lang of ["en", "es", "fr"]) for (const [id, t] of Object.entries(A[lang])) { if (!N[lang]?.[id]) continue;
  for (const k of [0, 1]) { if (lang !== "en" && k === 1) continue; const r = await runTurn(newSession("c"), t.qa[k], makeCtx({ fetchImpl: f })); const nd = norm(N[lang][id][k]); rows.push({ lang, id, k, q: t.qa[k], read: r.promptText.read.includes(nd), handed: r.promptText.live.includes(nd), salience: r.promptText.salience.includes(nd), web: r.web, pages: r.pages, chars: r.arms.live.chars }); } }
fs.mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("./out/ceiling.json", import.meta.url), JSON.stringify(rows, null, 1));
const n = rows.length, c = (k) => rows.filter((r) => r[k]).length;
console.log(`cold asks ${n}: needle in READ passages ${c("read")} (${Math.round(100 * c("read") / n)}%) · reaches the MODEL (live compression) ${c("handed")} (${Math.round(100 * c("handed") / n)}%) · reaches the model with salience ON ${c("salience")} (${Math.round(100 * c("salience") / n)}%)`);
for (const r of rows) console.log(r.lang, r.id, r.k, "read", r.read ? 1 : 0, "handed", r.handed ? 1 : 0, "sal", r.salience ? 1 : 0, "|", r.q.slice(0, 55));
