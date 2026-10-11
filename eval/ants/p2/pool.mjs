// pool.mjs — builds the page pool the P2 asks are written over: the REAL page texts already on disk (no network).
//   A: eval/snips/data/pages/*.txt   (the text the app reads: 914 pages as the strand saw them)
//   B: eval/snips/cache/*.json+.body  Wikipedia plain-text extracts (explaintext=1), `title`, `extract`
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
export function loadPool() {
  const pool = [];
  const pd = path.join(ROOT, "eval/snips/data/pages");
  for (const f of fs.readdirSync(pd)) if (f.endsWith(".txt")) { const text = fs.readFileSync(path.join(pd, f), "utf8"); pool.push({ id: "A:" + f.replace(".txt", ""), kind: "page", text, url: (text.match(/Copy URL (https?:\S+)/) || [])[1] || null }); }
  const cd = path.join(ROOT, "eval/snips/cache");
  for (const f of fs.readdirSync(cd)) {
    if (!f.endsWith(".json")) continue;
    let m; try { m = JSON.parse(fs.readFileSync(path.join(cd, f), "utf8")); } catch { continue; }
    if (!/wikipedia\.org\/w\/api\.php.*extracts/.test(m.url || "")) continue;
    let b; try { b = JSON.parse(fs.readFileSync(path.join(cd, f.replace(".json", ".body")), "utf8")); } catch { continue; }
    for (const p of Object.values(b?.query?.pages || {})) if (p && p.extract) pool.push({ id: "B:" + f.replace(".json", "").slice(0, 10) + ":" + p.pageid, kind: "wiki", title: p.title, text: p.extract, url: "https://" + new URL(m.url).hostname + "/wiki/" + encodeURIComponent(String(p.title).replace(/ /g, "_")) });
  }
  return pool;
}
export const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
if (process.argv[1] === new URL(import.meta.url).pathname) { const p = loadPool(); console.log(p.length, p.filter((x) => x.kind === "wiki").length); }
