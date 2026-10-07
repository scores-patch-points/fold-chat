// eval/ants/primary-diagnose.mjs — for each page an arm READ and then WITHDREW ("unsupported"), is the claim's sentence among the numbered candidates the pointing model was shown?
// (oracle: a candidate whose own text matches every `say` regex of the claim). Separates "the candidate generator never offered it" from "the model picked another" from "the gate refused a right pick".
//   node eval/ants/primary-diagnose.mjs <primary-eval-*.json>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { candidatesFor } from "../../fold-chat-provenance.js";
import { FUNCTION_WORDS } from "../../fold-chat-function-words.js";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(fs.readFileSync(path.join(HERE, "primary-corpus.json"), "utf8"));
const cache = JSON.parse(fs.readFileSync(path.join(HERE, ".primary-cache.json"), "utf8"));
const run = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const fw = new Set(FUNCTION_WORDS.en);
const good = (c, t) => c.hostsOk.some((h) => new RegExp(h, "i").test(new URL(t.url).hostname.replace(/^www\./, "")));
let offered = 0, notOffered = 0, rows = [];
for (const r of run.rows) {
  const c = corpus.claims.find((x) => x.id === r.id);
  for (const t of r.trail.filter((x) => x.verdict === "unsupported" && x.url && good(c, x))) {
    const pg = cache["r:" + t.url]; if (!pg?.text) continue;
    const cs = candidatesFor(r.claim, [{ text: pg.text, url: t.url }], fw);
    const hit = cs.find((x) => c.say.every((s) => new RegExp(s, "i").test(x.text)));
    // does ANY sentence of the page carry every say-regex (so a right one exists at all)?
    const any = pg.text.split(/(?<=[.!?])\s+|\n/).find((s) => c.say.every((re) => new RegExp(re, "i").test(s)));
    hit ? offered++ : notOffered++;
    rows.push({ id: r.id, host: t.host, why: t.why, candidates: cs.length, rightSentenceOffered: !!hit, rightSentenceExistsOnPage: !!any, example: (hit?.text || any || "").slice(0, 120) });
  }
}
for (const x of rows) console.log(JSON.stringify(x));
console.log(JSON.stringify({ officialPagesWithdrawn: rows.length, rightSentenceOffered: offered, notOffered }));
