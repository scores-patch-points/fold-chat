// showhtml.mjs <cache-prefix> [from] [len] — authoring aid: the page text the app would read (regionOfHtml) and its declared FAQ items
import { passageOf } from "./asks-lib.mjs";
const [pre, from = "0", len = "1500"] = process.argv.slice(2);
const p = passageOf("html:" + pre);
console.log(p.id, p.url, p.text.length, "declared:", (p.declared || []).map((b) => b.kind + ":" + b.items.length).join(","));
console.log(p.text.slice(+from, +from + +len));
for (const b of p.declared || []) b.items.slice(0, 12).forEach((it, i) => console.log(`  [${b.kind}#${i}]`, it.slice(0, 230)));
