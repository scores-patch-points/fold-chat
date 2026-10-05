// probe.mjs <label/id/r1/tK> <regex>  — does any page READ in that turn contain the regex? (uses eval/cache, same readText)
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const [key, rx] = process.argv.slice(2);
const [label, id, rep, t] = key.split("/");
const raw = JSON.parse(fs.readFileSync(path.join(here, "raw", `${label}__${id}__${rep}.json`), "utf8"));
const g = raw.turns[+t.slice(1)].grounding;
const urls = (g.web || []).filter((w) => w.read && !w.skipped && w.ok !== false).map((w) => w.read);
for (const u of urls) {
  const f = path.join(here, "cache", "u_" + Buffer.from(u).toString("hex").slice(0, 80) + ".txt");
  const t2 = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "";
  const m = t2.match(new RegExp(".{0,60}(" + rx + ").{0,60}", "iu"));
  console.log((m ? "HIT  " : "no   ") + decodeURIComponent(u).slice(0, 70) + (m ? "  :: " + m[0].replace(/\s+/g, " ") : "") + (t2 ? "" : "  (uncached)"));
}
