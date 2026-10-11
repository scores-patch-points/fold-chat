// G2 I2 census: isMetaAboutType over EVERY cached real HTML page (eval/snips/cache, eval/priors/cache, eval/swarm/cache) as outputType {type, topic: the title's own content words}.
// A page is "topical" for its own title, so any flag is a candidate false flag, listed for a hand judgement.
import fs from "node:fs";
import path from "node:path";
import { isMetaAboutType, topicWords } from "../../../fold-chat-genvoid.js";
const dirs = ["eval/snips/cache", "eval/priors/cache", "eval/swarm/cache"];
const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'").replace(/&#\d+;/g, " ");
const types = (process.argv[2] || "essay,report,poem,cover letter").split(",");
let n = 0; const flagged = {}; for (const t of types) flagged[t] = [];
for (const d of dirs) for (const f of fs.readdirSync(d)) {
  if (!f.endsWith(".json")) continue;
  let meta; try { meta = JSON.parse(fs.readFileSync(path.join(d, f), "utf8")); } catch { continue; }
  if (!/html/i.test(meta.ctype || "")) continue;
  const bf = path.join(d, f.replace(/\.json$/, ".body")); if (!fs.existsSync(bf)) continue;
  const html = fs.readFileSync(bf, "utf8"); if (html.length < 3000) continue;
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ""])[1]).replace(/\s+/g, " ").trim();
  let text = html.replace(/<(script|style|noscript|svg|nav|footer|header|form|aside)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ");
  text = decode(text).replace(/\s+/g, " ").trim().slice(0, 6000);
  if (text.split(" ").length < 40) continue;
  const topic = topicWords(title.split(/\s+[|–—-]\s+/)[0]).slice(0, 3).join(" ");
  n++;
  for (const t of types) { const r = isMetaAboutType({ title, url: meta.url, text }, { type: t, topic }); if (r.meta) flagged[t].push({ url: meta.url, title: title.slice(0, 80), topic, kind: r.kind, score: r.score, why: r.why.join("; ").slice(0, 100) }); }
}
console.log("html pages scanned:", n);
for (const t of types) console.log(`type=${t}: flagged ${flagged[t].length} (${(100 * flagged[t].length / n).toFixed(2)}%)`);
fs.writeFileSync("eval/ants/g2/census.json", JSON.stringify({ n, flagged }, null, 1));
for (const t of types) { console.log("\n== " + t); for (const x of flagged[t].slice(0, 45)) console.log(`[${x.kind} s=${x.score}] ${x.title} | ${x.url.slice(0, 80)} | ${x.why}`); }
