// replay-gate.mjs — re-run the RECORDED turns of eval/results.json through the gate, offline (no browser, no model, no search).
//
//   node eval/replay-gate.mjs [--out eval/replay-gate.json]
//
// A case of eval/cases.json needs a live search and a model to run; what it recorded does not: the answer the model wrote and the
// pages the turn read. This replays exactly that — each recorded answer against the cached pages that turn read (cut to 12000 chars as
// fold-chat.js does) — through the committed gate before the fix (eval/lib/ground-baseline.mjs) and through the working tree's
// fold-chat-ground.js, and reports what changed: how many sentences are grounded, how many answers JUDGED WRONG still carry a grounded
// sentence, and how many sentences are typed as a language gap. Answer correctness itself is the model's and does not change here.
// Pages not in eval/cache (pg_<sha1(url)>.txt, written by rescore-labels.mjs) are skipped, and the skip count is reported.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf("--" + k); return i < 0 ? d : argv[i + 1]; };
const oldG = await import(path.join(here, "lib/ground-baseline.mjs"));
const newG = await import(path.join(here, "..", "fold-chat-ground.js"));
const results = JSON.parse(fs.readFileSync(path.join(here, "results.json"), "utf8"));
const sha = (u) => crypto.createHash("sha1").update(u).digest("hex");
const page = (u) => { const f = path.join(here, "cache", "pg_" + sha(u) + ".txt"); return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null; };
const rows = [];
let skipped = 0;
for (const r of results.rows) {
  const raw = JSON.parse(fs.readFileSync(path.join(here, "raw", `${r.label}__${r.id}__r${r.rep}.json`), "utf8"));
  const t = raw.turns[r.turn];
  const g = t?.grounding;
  if (!g || !g.hasMaterial || !t.answer || g.creative) continue;
  const urls = (g.web || []).filter((w) => w.read && !w.skipped && w.ok !== false).map((w) => w.read);
  const pages = urls.map((u) => ({ u, t: page(u) }));
  if (!urls.length || pages.some((p) => p.t == null)) { skipped++; continue; }
  const material = pages.map((p) => ({ ref: decodeURIComponent(p.u.split("/").pop() || p.u), source: p.u, text: p.t.slice(0, 12000) }));
  const answer = String(t.answer).replace(/\[citation removed[^\]]*\]/g, "");
  const o = oldG.coverage(answer, material), n = newG.coverage(answer, material);
  rows.push({ key: r.key, label: r.label, stratum: r.stratum, correct: r.correct, sentences: n.total, oldGrounded: o.grounded, newGrounded: n.grounded,
    gaps: n.entries.filter((e) => e.why === "cross-language").length, newWhy: Object.fromEntries(n.entries.filter((e) => !e.ref).map((e) => [e.why || "?", 0])) });
}
const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0);
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + "%" : "n/a");
const block = (xs) => ({
  turns: xs.length, sentences: sum(xs, (x) => x.sentences),
  groundedSentences: { before: sum(xs, (x) => x.oldGrounded), after: sum(xs, (x) => x.newGrounded) },
  groundedRatio: { before: pct(sum(xs, (x) => x.oldGrounded), sum(xs, (x) => x.sentences)), after: pct(sum(xs, (x) => x.newGrounded), sum(xs, (x) => x.sentences)) },
  turnsWithAnyGroundedSentence: { before: xs.filter((x) => x.oldGrounded > 0).length, after: xs.filter((x) => x.newGrounded > 0).length },
  typedLanguageGapSentences: sum(xs, (x) => x.gaps),
});
const wrong = rows.filter((x) => x.correct === false), right = rows.filter((x) => x.correct === true);
const out = { at: new Date().toISOString(), skippedTurnsWithUncachedPages: skipped, all: block(rows), answersJudgedCorrect: block(right), answersJudgedWrong: block(wrong),
  byLabel: Object.fromEntries(["default", "frontier"].map((l) => [l, block(rows.filter((x) => x.label === l))])), rows };
fs.writeFileSync(path.join(here, arg("out", "replay-gate.json")), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ ...out, rows: undefined }, null, 1));
