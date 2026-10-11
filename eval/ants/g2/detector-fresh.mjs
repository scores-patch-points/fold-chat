// G2 I2b: a FRESH set (urlsB.txt) fetched AFTER the detector was last changed. Expectations are by id prefix, fixed here before the run:
// B-tut-* = about writing the thing (expect meta); B-ctl-* = topical (expect not meta), except B-ctl-letter-law, an encyclopedia page ON the demand letter (genre: expect meta for topic 'my landlord').
import fs from "node:fs";
import { isMetaAboutType } from "../../../fold-chat-genvoid.js";
const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&#8217;/g, "'").replace(/&#\d+;/g, " ");
let ok = 0, n = 0, fn = 0, fp = 0; const rows = [];
for (const l of fs.readFileSync("eval/ants/g2/urlsB.txt", "utf8").split("\n").filter(Boolean)) {
  const [id, url, type, topic] = l.split("|"); const f = `eval/ants/g2/pages/${id}.html`;
  const html = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : ""; if (html.length < 20000) { console.log("skip (blocked/short)", id); continue; }
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ""])[1]).replace(/\s+/g, " ").trim();
  let t = html.replace(/<(script|style|noscript|svg|nav|footer|header|form|aside)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " "); t = decode(t).replace(/\s+/g, " ").trim().slice(0, 6000);
  const expect = id.startsWith("B-tut") || id === "B-ctl-letter-law";
  const r = isMetaAboutType({ title, url, text: t }, { type, topic }); n++;
  if (r.meta === expect) ok++; else if (expect) fn++; else fp++;
  console.log((r.meta === expect ? "ok  " : "FAIL"), id.padEnd(26), "expect=" + expect, "got=" + r.meta, String(r.kind).padEnd(9), "s=" + r.score, "|", title.slice(0, 60), "|", r.why.join("; ").slice(0, 80));
}
console.log(`\nFRESH: ${ok}/${n} right; missed tutorials ${fn}; false flags on topical controls ${fp}`);
