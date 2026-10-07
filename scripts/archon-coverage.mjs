// scripts/archon-coverage.mjs — mechanical audit (no model): for each of the compendium's archons,
// does a verified snip manifest exist, what status, and is a primary source on disk?
import fs from "node:fs";
import path from "node:path";
const ROOT = "/Users/mlacy/Documents/3.0";
const { ARCHONS } = await import(`${ROOT}/khora/native/organs/archon-compendium.js`);
const MAN = path.join(ROOT, "eo-teachings/manifest");
const mans = fs.readdirSync(MAN).filter((f) => f.endsWith(".json")).map((f) => ({ f, ...JSON.parse(fs.readFileSync(path.join(MAN, f), "utf8")) }));
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");
const rows = ARCHONS.map((a) => {
  const keys = [a.handle, a.name].map(norm);
  const hit = mans.filter((m) => keys.some((k) => k && (norm(m.handle).includes(k) || norm(m.f).includes(k) || norm(m.giver).includes(k))));
  const srcOk = hit.some((m) => m.source?.path && fs.existsSync(path.join(ROOT, m.source.path)));
  return { handle: a.handle, pd: a.pdStatus, snips: hit.length, statuses: [...new Set(hit.map((m) => m.status))].join("|"), primarySourceOnDisk: srcOk };
});
const sum = (p) => rows.filter(p).length;
console.log(JSON.stringify({ archons: rows.length, withSnip: sum((r) => r.snips), withSourceOnDisk: sum((r) => r.primarySourceOnDisk), noSnip: rows.filter((r) => !r.snips).map((r) => `${r.handle}(${r.pd})`) }, null, 1));
fs.writeFileSync("docs/archons/coverage.json", JSON.stringify(rows, null, 1));
