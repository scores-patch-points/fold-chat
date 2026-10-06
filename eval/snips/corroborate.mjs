// corroborate.mjs — re-checks every candidate snip against the CACHED raw page bytes (offline): is the snip text found in the page's visible text
//   (a) exactly after whitespace collapsing, (b) ignoring ALL whitespace, (c) not at all (+ why)? Writes corroboration.json.
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { visibleNorm, squash, gnorm, decodeEntities } from "./lib/text.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const h = (k) => crypto.createHash("sha1").update(k).digest("hex");
const FOLD_RELAY = "https://holodeck-proxy.prometheoid.workers.dev";
const rawOf = (url) => { for (const k of [`chromium GET ${url}`, `node GET ${url}`, `node GET ${FOLD_RELAY}/raw?url=${encodeURIComponent(url)}`]) { const f = path.join(here, "cache", h(k)); if (fs.existsSync(f + ".body") && JSON.parse(fs.readFileSync(f + ".json", "utf8")).status === 200) return fs.readFileSync(f + ".body", "utf8"); } return null; };
const nows = (s) => gnorm(s).replace(/\s+/g, "").toLowerCase();
const tally = {}; const bump = (k, f) => { tally[k] ||= { n: 0, exact: 0, noWs: 0, residue: 0, escapeLiteral: 0, other: 0, samples: [] }; tally[k].n++; tally[k][f]++; };
for (const f of fs.readdirSync(path.join(here, "data", "out"))) {
  if (!f.endsWith(".json") || f.includes("__raw")) continue;
  const o = JSON.parse(fs.readFileSync(path.join(here, "data", "out", f), "utf8"));
  const vis = {}; const noWs = {};
  for (const rd of o.reads || []) if (rd.ok) { const raw = rawOf(rd.url); if (raw) { vis[rd.srcIdx] = visibleNorm(raw); noWs[rd.srcIdx] = vis[rd.srcIdx].replace(/\s+/g, ""); } }
  for (const s of o.candidates || []) {
    if (!(s.srcIdx in vis)) continue;                       // Wikipedia plain-text extracts have no raw HTML to compare
    const kind = s.kind === "prose" ? "prose" : s.rung;
    // the app's reader joins separate <p>/<li> blocks with newlines, dropping what lies between them, so a prose segment is checked block by block
    const pieces = s.kind === "prose" ? s.segments.flatMap((g) => g.text.split(/\n+/)).filter((x) => x.trim().length > 3) : s.items;
    let exact = 0, ws = 0, res = 0, esc = 0;
    for (const p of pieces) { if (vis[s.srcIdx].includes(squash(p))) exact++; else if (noWs[s.srcIdx].includes(nows(p))) ws++; else if (/&#?\w{2,8};/.test(p)) res++; else if (/\\u[0-9a-f]{4}/i.test(p)) esc++; }
    const all = pieces.length;
    const cls = exact === all ? "exact" : exact + ws === all ? "noWs" : res ? "residue" : esc ? "escapeLiteral" : "other";
    bump(kind, cls); if (cls === "other" && tally[kind].samples.length < 3) tally[kind].samples.push({ ask: o.id, snip: s.id, text: pieces[0].slice(0, 100) });
  }
}
fs.writeFileSync(path.join(here, "corroboration.json"), JSON.stringify(tally, null, 1));
for (const [k, v] of Object.entries(tally)) console.log(k.padEnd(12), JSON.stringify({ n: v.n, exact: v.exact, whitespaceOnly: v.noWs, entityResidue: v.residue, literalEscape: v.escapeLiteral, other: v.other }));
