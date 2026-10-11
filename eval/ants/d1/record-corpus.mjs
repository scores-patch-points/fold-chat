// record-corpus.mjs — record the REAL pages for every ask of the fact bank (record mode; resumable: a stored request is never re-fetched).
//   node eval/ants/d1/record-corpus.mjs            writes corpus/store.json (the replay store) and corpus/passages.json (what searchWeb handed back, for choosing needles)
import fs from "node:fs";
import * as web from "../../../fold-chat-web.js";
import { makeReplayFetch } from "./lib/replay.mjs";
const asks = JSON.parse(fs.readFileSync(new URL("./corpus/asks.json", import.meta.url), "utf8"));
const f = makeReplayFetch({ mode: "record" });
const out = {};
for (const lang of Object.keys(asks)) for (const [id, t] of Object.entries(asks[lang])) for (const q of t.qa) {
  const memo = web.makeMemo();
  const w = await web.searchWeb(q, { effort: "balanced", memo, fetchImpl: f });
  out[q] = { lang, id, passages: w.passages.map((p) => ({ ref: p.ref, url: p.url, chars: p.text.length, text: p.text })), trace: w.trace.map((x) => ({ scope: x.scope, ok: x.ok, n: x.n, why: x.why })) };
  console.log(lang, id, "|", q, "→", w.passages.map((p) => p.ref.replace(/^.*— /, "") + "(" + p.text.length + ")").join(" · ") || "NOTHING");
  f.flush();
}
fs.writeFileSync(new URL("./corpus/passages.json", import.meta.url), JSON.stringify(out, null, 1));
f.flush(); console.log(JSON.stringify(f.stats));
