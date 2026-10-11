// G2: run the frozen case table through `before` (the current path, modelled) and `after` (genVoid). Writes eval/ants/g2/results.json + results.md.
import fs from "node:fs";
import crypto from "node:crypto";
import { CASES } from "./cases.mjs";
import { before } from "./before.mjs";
import { genVoid, topicQuery } from "../../../fold-chat-genvoid.js";
const sha = crypto.createHash("sha256").update(fs.readFileSync(new URL("./cases.mjs", import.meta.url))).digest("hex");
const MUT = process.env.GENVOID_MODULE ? await import(process.env.GENVOID_MODULE) : null;
const gv = MUT ? MUT.genVoid : genVoid;
const urlsOf = (arr) => new Set(arr.map((x) => x.url).filter(Boolean));
const rows = [];
for (const c of CASES.all) {
  const b = before(c);
  const a = gv({ outputType: c.outputType, webPassages: c.passages, failure: c.failure, modelResult: c.modelResult, question: c.ask, hasMaterial: c.hasMaterial, barred: c.barred });
  const type = String(c.outputType?.type || "").toLowerCase();
  const typeRe = new RegExp(`\\b${type.replace(/ /g, "[\\s-]+")}s?\\b`, "i");
  const usableUrls = new Set((c.passages || []).filter((p) => (c.usable || []).includes(p.id)).map((p) => p.url));
  const asideUrls = new Set((c.passages || []).filter((p) => (c.aside || []).includes(p.id)).map((p) => p.url));
  const row = { id: c.id, cat: c.cat, expectOk: c.expect.ok, before: { drawn: b.drawn, quotes: b.quotesSourceAsOutput, typedGap: b.typedGapDrawn, names: b.namesType, kind: b.kind, searchQ: b.searchQ }, after: { ok: a.ok, reason: a.reason, fallbackAllowed: a.fallbackAllowed } };
  if (!c.expect.ok) {
    const v = a.void;
    const checks = {
      detected: !a.ok && c.expect.reasons.includes(a.reason),
      name: !!v && type.length > 0 && typeRe.test(a.notice.text) && typeRe.test(v.note) && v.outputType === type || (!!v && !type),
      missing: !!v && v.missing.length > 0,
      unblock: !!v && v.unblock.length > 0 && JSON.stringify(v.closeBy) === JSON.stringify(v.unblock),
      nofake: a.fallbackAllowed !== true && a.fallbackAllowed !== "strand" && !!v && !JSON.stringify(a).includes("FROM THE SOURCES") && c.passages.every((p) => !p.text || !JSON.stringify({ n: a.notice, v }).includes(p.text.slice(100, 160))),
      hadExact: !!v && [...urlsOf(v.had.filter((h) => h.kind === "page"))].every((u) => usableUrls.has(u)) && [...usableUrls].every((u) => urlsOf(v.had).has(u) || v.had.length >= 6),
      asideExact: !!v && [...urlsOf(v.setAside)].every((u) => asideUrls.has(u)) && (c.expect.reasons.some((r) => /network|timeout|rate|gate|sealed|no-model|empty|refus|stub|asked|tutorial|off-topic-draft|no-topic|own-text|alone|unsupported|type-unknown|no-sources/.test(r)) || [...asideUrls].every((u) => urlsOf(v.setAside).has(u))),
    };
    row.checks = checks; row.pass = Object.values(checks).every(Boolean);
  } else {
    row.checks = { noVoid: a.ok && a.void === null && a.notice === null && a.fallbackAllowed === null }; row.pass = row.checks.noVoid;
  }
  rows.push(row);
}
const F = rows.filter((r) => !r.expectOk), Cn = rows.filter((r) => r.expectOk);
const sum = {
  sha, mutated: !!MUT, nFailure: F.length, nControl: Cn.length,
  before: { namesType: F.filter((r) => r.before.names).length, quotesSourceAsOutput: F.filter((r) => r.before.quotes).length, typedGapDrawn: F.filter((r) => r.before.typedGap).length, noGapAtAll: F.filter((r) => !r.before.typedGap && !r.before.quotes && !r.before.names).length },
  after: { pass: F.filter((r) => r.pass).length, detected: F.filter((r) => r.checks.detected).length, name: F.filter((r) => r.checks.name).length, missing: F.filter((r) => r.checks.missing).length, unblock: F.filter((r) => r.checks.unblock).length, nofake: F.filter((r) => r.checks.nofake).length, hadExact: F.filter((r) => r.checks.hadExact).length, asideExact: F.filter((r) => r.checks.asideExact).length },
  controls: { falseVoids: Cn.filter((r) => !r.pass).length, of: Cn.length },
};
fs.writeFileSync(new URL(MUT ? "./results-mut.json" : "./results.json", import.meta.url), JSON.stringify({ sum, rows }, null, 1));
if (process.env.QUIET) { console.log(JSON.stringify(sum)); process.exit(0); }
console.log(JSON.stringify(sum, null, 1));
for (const r of rows) console.log((r.pass ? "ok  " : "FAIL"), r.id.padEnd(30), "| before:", String(r.before.drawn).slice(0, 44).padEnd(44), "names=" + r.before.names, "| after:", r.after.ok ? "ok" : r.after.reason, r.after.fallbackAllowed ? "(" + r.after.fallbackAllowed + ")" : "", r.pass ? "" : JSON.stringify(Object.entries(r.checks).filter(([, v]) => !v).map(([k]) => k)));
