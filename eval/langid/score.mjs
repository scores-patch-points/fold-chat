// eval/langid/score.mjs — score a language detector on labelled.json (see docs/LANGID-PREREG.md).
//   node eval/langid/score.mjs <candidate> [--splits dev,val] [--held] [--json out.json] [--errors]
// candidates: A (the chat's fold-chat-lang.js, as shipped in git HEAD unless FOLD_LANG_A overrides the path),
//             B (ethos E1 langid-v1 NB), C (khora detectLanguage), D (fold-chat-lang.js after this study)
// 'held' is only scored with --held (the final run).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const args = process.argv.slice(2);
const cand = args[0];
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const splits = (flag("--held") ? ["held"] : (opt("--splits", "dev,val")).split(",")).filter((s) => s !== "held" || flag("--held"));
const items = JSON.parse(fs.readFileSync(path.join(HERE, "labelled.json"), "utf8"));

// ── adapters: text -> code | "unknown" ────────────────────────────────────────────────────────────────
async function adapter(c) {
  if (c === "A" || c === "D") {
    const p = c === "A" ? (process.env.FOLD_LANG_A || path.join(ROOT, "eval", "langid", "baseline", "fold-chat-lang.js")) : path.join(ROOT, "fold-chat-lang.js");
    const m = await import(pathToFileURL(p).href);
    return (t) => { const d = m.detectLang(t); return d.confident ? d.lang : "unknown"; };
  }
  if (c === "I") {
    const m = await import(pathToFileURL(path.join(ROOT, "fold-chat-langid.js")).href);
    const o = process.env.LANGID_OPTS ? JSON.parse(process.env.LANGID_OPTS) : {};
    if (process.env.LANGID_PRIORS) { const pr = await import(pathToFileURL(path.resolve(process.env.LANGID_PRIORS)).href); m.useIndex(pr.PRIORS); }
    return (t) => { const d = m.identify(t, o); return d.confident ? d.lang : "unknown"; };
  }
  if (c === "B") {
    const dir = path.join(ROOT, "eval", "priors", "out", "langid-v1");
    const { loadLangId } = await import(pathToFileURL(path.join(ROOT, "eval", "priors", "out", "langid-decode.mjs")).href);
    const L = loadLangId({ meta: fs.readFileSync(path.join(dir, "meta.json"), "utf8"), grams: fs.readFileSync(path.join(dir, "grams.txt"), "utf8"), ids: fs.readFileSync(path.join(dir, "ids.bin")), q: fs.readFileSync(path.join(dir, "q.bin")) });
    const MAP = { "pt-BR": "pt", "pt-PT": "pt", nb: "no", nn: "no", "zlm-Latn": "ms", "zlm-Arab": "ms", "de-1901": "de", "de-1996": "de", "el-monoton": "el", "el-polyton": "el", "zh-Hant": "zh", "sr-Latn": "sr", "sr-Cyrl": "sr", "bs-Latn": "bs", "bs-Cyrl": "bs", "fa-AF": "fa", cmn: "zh", yue: "zh", wuu: "zh", nan: "zh", hak: "zh" };
    return (t) => { const r = L.classify(t); return r.gap ? "unknown" : (MAP[r.best.code] || r.best.code); };
  }
  if (c === "C") {
    const { detectLanguage } = await import(pathToFileURL(path.resolve(ROOT, "..", "khora", "native", "the-fold", "language-grammar.js")).href);
    const ISO = { eng: "en", spa: "es", por: "pt", ita: "it", cat: "ca", fra: "fr", deu: "de", nld: "nl", swe: "sv", dan: "da", nob: "no", ron: "ro", pol: "pl", ces: "cs", tur: "tr", ind: "id", fin: "fi", hun: "hu", hrv: "hr", srp: "sr", vie: "vi", hin: "hi", urd: "ur", afr: "af", rus: "ru", ukr: "uk", bul: "bg", ell: "el", heb: "he", arb: "ar", fas: "fa", mar: "mr", tam: "ta", tel: "te", cmn: "zh", "cmn-hans": "zh", jpn: "ja", kor: "ko", lzh: "zh" };
    return (t) => { const r = detectLanguage(t); return r.language ? (ISO[r.language] || r.language) : "unknown"; };
  }
  throw new Error("candidate A|B|C|D");
}

const NONLATIN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Arabic}\p{Script=Hebrew}]/u;
const HARD = (t) => { const L = (t.match(/\p{L}/gu) || []); return L.length && L.filter((c) => NONLATIN.test(c)).length / L.length > 0.5; };
const CASED_NL = /[\p{Script=Cyrillic}\p{Script=Greek}]/u;
const isLatin = (t) => { const L = (t.match(/\p{L}/gu) || []); return L.length && L.filter((c) => /\p{Script=Latin}/u.test(c)).length / L.length > 0.5; };
const GROUP = { es: "romance", pt: "romance", it: "romance", ca: "romance", no: "nordic", da: "nordic", sv: "nordic", hr: "southslavic", sr: "southslavic", bs: "southslavic", id: "malay", ms: "malay", hi: "hindustani", ur: "hindustani", nl: "lowlands", af: "lowlands" };

const det = await adapter(cand);
const rows = []; const times = [];
const tc0 = process.hrtime.bigint(); det("show me a cookie recipe"); const firstCallMs = Number(process.hrtime.bigint() - tc0) / 1e6;  // cold: decodes the priors

for (const it of items) {
  if (!splits.includes(it.split)) continue;
  const t0 = process.hrtime.bigint(); const ans = det(it.text); const dt = Number(process.hrtime.bigint() - t0) / 1e6; times.push(dt);
  const confident = ans !== "unknown";
  const correct = it.accept.includes(ans);
  const answerable = !it.accept.includes("unknown");
  rows.push({ ...it, ans, confident, correct, wrong: confident && !correct, abstain: !confident && answerable, answerable, latin: !!isLatin(it.text), hard: !!HARD(it.text) });
}
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + "% (" + a + "/" + b + ")" : "n/a (0)");
function prec(rs) { const c = rs.filter((r) => r.confident); return { prec: c.length ? c.filter((r) => r.correct).length / c.length : 1, n: c.length, wrong: c.filter((r) => r.wrong).length }; }
function cov(rs) { const a = rs.filter((r) => r.answerable); return { cov: a.length ? a.filter((r) => r.confident).length / a.length : 1, n: a.length }; }

const enSafe = rows.filter((r) => ["en", "en-keyword"].includes(r.cls));
const enBad = enSafe.filter((r) => r.confident && r.ans !== "en");
const enRecall = rows.filter((r) => r.cls === "en");
const ct = rows.filter((r) => r.cls === "cannot-tell");
const pairItem = (r) => r.latin && r.accept.length && GROUP[r.accept[0]] && r.cls === "lang";
const core = rows.filter((r) => ["en", "lang"].includes(r.cls) && !pairItem(r));
const hard = rows.filter((r) => r.hard);
const cased = rows.filter((r) => !r.hard && !r.latin);
times.sort((a, b) => a - b);
const out = {
  cand, splits, n: rows.length,
  enSafety: { nonEnglishConfident: enBad.length, n: enSafe.length, notNonEnglish: 1 - enBad.length / enSafe.length, bad: enBad.map((r) => [r.text, r.ans]) },
  enStrictRecall: { en: enRecall.filter((r) => r.ans === "en").length, n: enRecall.length },
  overall: { ...prec(rows), coverageCore: cov(core), coverageAll: cov(rows) },
  cannotTell: { unknown: ct.filter((r) => !r.confident).length, n: ct.length, bad: ct.filter((r) => r.confident).map((r) => [r.text, r.ans]) },
  caseless: { ...prec(hard), ...cov(hard), n: hard.length },
  casedNonLatin: { ...prec(cased), ...cov(cased), n: cased.length },
  speed: { firstCallMs, meanMs: times.reduce((a, b) => a + b, 0) / times.length, p95Ms: times[Math.floor(times.length * 0.95)], maxMs: times[times.length - 1] },
  byClass: {}, byLang: {}, pairs: {},
};
for (const c of [...new Set(rows.map((r) => r.cls))]) { const rs = rows.filter((r) => r.cls === c); out.byClass[c] = { n: rs.length, correct: rs.filter((r) => r.correct).length, wrongConfident: rs.filter((r) => r.wrong).length, abstain: rs.filter((r) => r.abstain).length }; }
for (const l of [...new Set(rows.map((r) => r.accept[0]))]) { const rs = rows.filter((r) => r.accept[0] === l); out.byLang[l] = { n: rs.length, correct: rs.filter((r) => r.correct).length, wrong: rs.filter((r) => r.wrong).length, abstain: rs.filter((r) => r.abstain).length }; }
for (const g of new Set(Object.values(GROUP))) {
  const rs = rows.filter((r) => pairItem(r) && GROUP[r.accept[0]] === g);
  const conf = rs.filter((r) => r.confident);
  out.pairs[g] = { n: rs.length, confident: conf.length, exact: conf.filter((r) => r.correct).length, familyOk: conf.filter((r) => GROUP[r.ans] === g).length, abstain: rs.length - conf.length };
}
const errs = rows.filter((r) => r.wrong);
console.log(`\n=== ${cand} on ${splits.join("+")} (${rows.length} asks) ===`);
console.log(`1 en safety (non-English confident on en+en-keyword): ${enBad.length}/${enSafe.length} -> ${(100 * out.enSafety.notNonEnglish).toFixed(2)}% not-non-English (bar >= 99%)   [strict en answered en: ${pct(out.enStrictRecall.en, out.enStrictRecall.n)}]`);
console.log(`2 precision on confident: ${(100 * out.overall.prec).toFixed(1)}% (${out.overall.n - out.overall.wrong}/${out.overall.n}) bar >= 95%   | coverage core ${(100 * out.overall.coverageCore.cov).toFixed(1)}% of ${out.overall.coverageCore.n} (bar >= 80%)   all answerable ${(100 * out.overall.coverageAll.cov).toFixed(1)}%`);
console.log(`3 cannot-tell unknown: ${pct(out.cannotTell.unknown, out.cannotTell.n)} (bar >= 90%)`);
console.log(`4 caseless/CJK/Indic/Arabic/Hebrew/Thai: precision ${(100 * out.caseless.prec).toFixed(1)}% (${out.caseless.n && 0}) n=${out.caseless.n} wrong=${out.caseless.wrong}  coverage ${(100 * out.caseless.cov).toFixed(1)}%  (bars >= 98% / >= 95%)`);
console.log(`   cased non-Latin (Cyrillic/Greek): precision ${(100 * out.casedNonLatin.prec).toFixed(1)}% wrong=${out.casedNonLatin.wrong} coverage ${(100 * out.casedNonLatin.cov).toFixed(1)}% n=${out.casedNonLatin.n}`);
console.log(`5 speed: mean ${out.speed.meanMs.toFixed(3)} ms, p95 ${out.speed.p95Ms.toFixed(3)} ms, first (cold) call ${out.speed.firstCallMs.toFixed(0)} ms, max ${out.speed.maxMs.toFixed(2)} ms (bar < 2 ms)`);
console.log("by class:", JSON.stringify(out.byClass));
console.log("pairs:", JSON.stringify(out.pairs));
if (flag("--errors") || flag("--v")) { for (const r of errs) console.log(`  WRONG ${r.cls} gold=${r.accept.join("|")} ans=${r.ans}  ${JSON.stringify(r.text)}`); if (flag("--v")) for (const r of rows.filter((x) => x.abstain)) console.log(`  abstain ${r.cls} gold=${r.accept.join("|")}  ${JSON.stringify(r.text)}`); }
if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify({ ...out, errors: errs.map((r) => [r.id, r.cls, r.accept, r.ans, r.text]) }, null, 1));
