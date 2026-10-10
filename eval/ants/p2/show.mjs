// show.mjs <title-or-id-substring> [from] [len] — authoring aid: print a real page's text so asks and gold can be written from it.
import { loadPool } from "./pool.mjs";
const [q, from = "0", len = "1500"] = process.argv.slice(2);
const p = loadPool().find((x) => x.id === q || (x.title && x.title.toLowerCase() === q.toLowerCase())) || loadPool().find((x) => x.title && x.title.toLowerCase().includes(q.toLowerCase()));
if (!p) { console.log("none"); process.exit(); }
console.log(p.id, p.title || p.url, p.text.length); console.log(p.text.slice(+from, +from + +len));
