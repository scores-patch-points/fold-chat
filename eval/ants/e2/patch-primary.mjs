// eval/ants/e2/patch-primary.mjs — builds patched/fold-chat-primary.js from the tracked fold-chat-primary.js (never edits it): L3 "findPrimary asks and reads in parallel".
// Same candidates, same order, same gate, same pointing — only the WAITING changes: the (<= 3) searches go out together, and the first maxPages ranked pages are fetched together
// while the model points at them one after another in rank order (so the verdicts, the trail and the early exit are identical).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
let s = fs.readFileSync(path.join(HERE, "../../../fold-chat-primary.js"), "utf8");
const rep = (from, to, label) => { if (!s.includes(from)) { console.error("ANCHOR MISSING:", label); process.exit(1); } s = s.replace(from, to); };
rep(`  for (const query of queries) {
    if (cands.length >= L.maxPages * 2) break;
    let results;
    try { results = await search(query); }
    catch (e) { if (isAbort(e)) throw e; trail.push({ query, url: null, host: "", verdict: "unreadable", why: "search_failed:" + String(e?.message || e).slice(0, 60) }); continue; }`,
`  // E2 L3: every query is asked at once (they were asked one after another, ~1-6 s each); results are consumed in the SAME order
  const asked = queries.map((query) => { const p = Promise.resolve().then(() => search(query)); p.catch(() => {}); return { query, p }; });
  for (const { query, p } of asked) {
    if (cands.length >= L.maxPages * 2) break;
    let results;
    try { results = await p; }
    catch (e) { if (isAbort(e)) throw e; trail.push({ query, url: null, host: "", verdict: "unreadable", why: "search_failed:" + String(e?.message || e).slice(0, 60) }); continue; }`, "queries");
rep(`  let tried = 0;
  for (const c of ranked) {`, `  // E2 L3: the pages the loop below may try (the first maxPages of the ranking) are fetched together, not one at a time (~2-6 s each)
  const pre = new Map();
  for (const c of ranked.slice(0, L.maxPages)) { const p = Promise.resolve().then(() => readPage(c.url)); p.catch(() => {}); pre.set(c.url, p); }
  let tried = 0;
  for (const c of ranked) {`, "reads");
rep(`    try { text = await readPage(c.url); }`, `    try { text = await (pre.get(c.url) || readPage(c.url)); }`, "read use");
fs.writeFileSync(path.join(HERE, "patched/fold-chat-primary.js"), s);
console.log("patched/fold-chat-primary.js written");
