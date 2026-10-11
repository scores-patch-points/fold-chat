// G2 I2: turn the fetched real pages into {id,url,type,topic,role,title,text} (crude tag-strip: harsher than the app's extractor, which also drops nav).
import fs from "node:fs";
const dev = new Set(["tut-leverageedu-telephone","tut-gradesfixer-telephone","tut-purdue-essay","tut-coverletter-indeed","tut-haiku-poets","tut-blog-hubspot","tut-poem-wikihow","ctl-wp-telephone","ctl-wp-bell","ctl-nms-bell","ctl-wp-essay"]);  // DECLARED before tuning: the only pages the detector may be tuned on
const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&#8217;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#\d+;/g, " ");
const rows = fs.readFileSync("eval/ants/g2/urls.txt", "utf8").split("\n").filter(Boolean).map((l) => l.split("|"));
const out = [];
for (const [id, url, type, topic] of rows) {
  const f = `eval/ants/g2/pages/${id}.html`; if (!fs.existsSync(f)) continue;
  const html = fs.readFileSync(f, "utf8"); if (html.length < 20000) continue;
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ""])[1]).replace(/\s+/g, " ").trim();
  let t = html.replace(/<(script|style|noscript|svg|nav|footer|header|form|aside)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ");
  t = decode(t).replace(/\s+/g, " ").trim();
  out.push({ id, url, type, topic, role: id.startsWith("tut") ? "tutorial" : "control", split: dev.has(id) ? "dev" : "held", title, text: t.slice(0, 6000), chars: t.length });
}
fs.writeFileSync("eval/ants/g2/pages.json", JSON.stringify(out, null, 1));
console.log(out.length, "pages;", out.filter((p) => p.role === "tutorial").length, "tutorials;", out.filter((p) => p.split === "dev").length, "dev");
for (const p of out) console.log(p.split.padEnd(5), p.role.padEnd(9), p.id.padEnd(28), p.chars, "|", p.title.slice(0, 70));
