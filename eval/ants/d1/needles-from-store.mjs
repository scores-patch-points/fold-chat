// like record-corpus.mjs but REPLAY only (no network): writes corpus/passages-<lang>.json for the asks already in the store
import fs from "node:fs";
import * as web from "../../../fold-chat-web.js";
import { makeReplayFetch } from "./lib/replay.mjs";
const lang = process.argv[2] || "en";
const asks = JSON.parse(fs.readFileSync(new URL("./corpus/asks.json", import.meta.url), "utf8"))[lang];
const f = makeReplayFetch({ mode: "replay" });
const out = {};
for (const [id, t] of Object.entries(asks)) for (const q of t.qa) {
  const w = await web.searchWeb(q, { effort: "balanced", memo: web.makeMemo(), fetchImpl: f });
  out[q] = { lang, id, passages: w.passages.map((p) => ({ ref: p.ref, url: p.url, chars: p.text.length, text: p.text })) };
}
fs.writeFileSync(new URL(`./corpus/passages-${lang}.json`, import.meta.url), JSON.stringify(out, null, 1)); console.log(JSON.stringify(f.stats));
