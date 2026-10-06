// eval/swarm/fresh-check.mjs — a SMALL out-of-sample check (<= 6 fresh public page loads, 1.3 s apart, via the harness) run AFTER
// the gate was frozen: pages the gate was never developed against. Writes eval/swarm/fresh-check.json (cached under cache/).
import fs from "node:fs";
import * as H from "./lib.mjs";
import { newLadder } from "./rescore-junk.mjs";
import { judge } from "./junk-judge.mjs";
import { wallOf } from "../../fold-chat-junk.js";
import { visibleTextOfHtml, titleOfHtml } from "../../fold-chat-region.js";
const SITES = [
  ["https://en.wikipedia.org/wiki/Okapi", "How tall is an okapi and what does it eat?"],
  ["https://docs.python.org/3/library/functools.html", "What does functools lru_cache do?"],
  ["https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/", "How long and at what temperature do I bake the cookies?"],
  ["https://stackoverflow.com/questions/231767/what-does-the-yield-keyword-do-in-python", "What does the yield keyword do in Python?"],
  ["https://www.nhs.uk/conditions/migraine/", "What are the symptoms of a migraine?"],
  ["https://www.imdb.com/title/tt0111161/", "Who directed The Shawshank Redemption?"],
];
const out = [];
for (const [url, ask] of SITES) {
  const page = await H.fetchPage(url);
  const html = page.html || "";
  const r = newLadder(page, ask);
  const vis = html ? visibleTextOfHtml(html) : "";
  out.push({ host: new URL(url).hostname, ask, status: page.status, htmlChars: html.length, wall: wallOf({ status: page.status, title: titleOfHtml(html), text: vis }), shown: r.shown.map((s) => ({ rung: s.rung, verbatim: s.verbatim, strict: s.strict, judgeJunk: judge(s.text).junk, text: s.text.slice(0, 260) })), gap: r.gap, withheld: r.withheld });
}
await H.close();
fs.writeFileSync(new URL("./fresh-check.json", import.meta.url).pathname, JSON.stringify(out, null, 1));
for (const o of out) { console.log(`## ${o.host} status=${o.status} chars=${o.htmlChars} wall=${o.wall.blocked ? o.wall.kind : "no"} gap=${o.gap ? o.gap.gap : "-"} shown=${o.shown.length} withheld=${o.withheld.map((w) => w.reason).join(",")}`); for (const s of o.shown) console.log(`   [${s.rung}] v=${s.verbatim}/${s.strict} j=${s.judgeJunk} ${s.text.replace(/\s+/g, " ").slice(0, 170)}`); }
process.exit(0);
