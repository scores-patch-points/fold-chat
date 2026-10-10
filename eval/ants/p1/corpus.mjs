// eval/ants/p1/corpus.mjs — the page store for the P1 ladder: REAL Wikipedia plain-text extracts from the repo's own page cache (eval/snips/cache).
// A page is {title,url,text}. Nothing is fetched; a run is reproducible from the cache bytes. The ladder's `pages` field names titles from here.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(here, "..", "..", "snips", "cache");
let INDEX = null;
function index() {
  if (INDEX) return INDEX;
  INDEX = new Map();
  for (const f of fs.readdirSync(CACHE)) {
    if (!f.endsWith(".json")) continue;
    let m; try { m = JSON.parse(fs.readFileSync(path.join(CACHE, f), "utf8")); } catch { continue; }
    const u = m.url || "";
    const w = /en\.wikipedia\.org\/w\/api\.php\?.*prop=extracts.*titles=([^&]+)/.exec(u);
    if (!w || m.status !== 200) continue;
    const body = path.join(CACHE, f.replace(/\.json$/, ".body"));
    if (!fs.existsSync(body)) continue;
    let j; try { j = JSON.parse(fs.readFileSync(body, "utf8")); } catch { continue; }
    const page = Object.values(j?.query?.pages || {})[0];
    const text = page?.extract;
    if (!text || text.length < 1500) continue;
    const title = page.title;
    const prev = INDEX.get(title);
    if (!prev || text.length > prev.text.length) INDEX.set(title, { title, url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(title.replace(/ /g, "_")), text });
  }
  return INDEX;
}
export function page(title) { const p = index().get(title); if (!p) throw new Error("page not in cache: " + title); return p; }
export function titles() { return [...index().keys()].sort(); }
/** passages in the chat's read shape: { ref: "Wikipedia — Title", source: url, url, text } */
export const passageOf = (title) => { const p = page(title); return { ref: "Wikipedia — " + p.title, source: p.url, url: p.url, text: p.text }; };
