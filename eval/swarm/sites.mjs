// eval/swarm/sites.mjs — the swarm's 96 recorded sites joined to their cached pages. READ-ONLY: never fetches.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const DIR = path.dirname(new URL(import.meta.url).pathname);
export const cacheKey = (url) => crypto.createHash("sha1").update(url).digest("hex").slice(0, 16);
/** [{ id:'news#1', type, host, url, ask, rec (the result row), page (cached fetch) | null }] */
export function loadSites() {
  const out = [];
  for (const f of fs.readdirSync(path.join(DIR, "results")).filter((x) => x.endsWith(".json")).sort()) {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, "results", f), "utf8"));
    (d.sites || []).forEach((s, i) => {
      const cf = path.join(DIR, "cache", cacheKey(s.url) + ".json");
      let page = null; try { page = JSON.parse(fs.readFileSync(cf, "utf8")); } catch {}
      out.push({ id: d.type + "#" + (i + 1), type: d.type, host: s.host, url: s.url, ask: s.ask, rec: s, page });
    });
  }
  return out;
}
