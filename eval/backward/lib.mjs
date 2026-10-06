// eval/backward/lib.mjs — shared instrument helpers for the backward-grounding study (docs/BACKWARDS-GROUNDING-PREREG.md).
// `runCheck`/`numbersOf` are copied from eval/score.mjs (the re / all / nums branches only) so the gold check is the
// SAME check the earlier eval applied to model answers. Pages come from eval/cache (pg_<sha1(url)>.txt), cut to 12000
// chars exactly as the app and eval/replay-gate.mjs do.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
export const here = path.dirname(fileURLToPath(import.meta.url));
export const evalDir = path.join(here, "..");
export const root = path.join(evalDir, "..");
const DIGITS = { "٠": 0, "١": 1, "٢": 2, "٣": 3, "٤": 4, "٥": 5, "٦": 6, "٧": 7, "٨": 8, "٩": 9, "०": 0, "१": 1, "२": 2, "३": 3, "४": 4, "५": 5, "६": 6, "७": 7, "८": 8, "९": 9, "０": 0, "１": 1, "２": 2, "３": 3, "４": 4, "５": 5, "６": 6, "７": 7, "８": 8, "９": 9 };
const asciiDigits = (s) => String(s).replace(/[٠-٩०-९０-９]/g, (d) => String(DIGITS[d]));
export function numbersOf(text) {
  const t = asciiDigits(text).replace(/[   ]/g, " ");
  const out = new Set();
  for (const m of t.matchAll(/\d[\d.,  ]*\d|\d/g)) {
    const raw = m[0].replace(/\s+$/, "");
    const variants = new Set();
    variants.add(parseFloat(raw.replace(/[, ]/g, "")));
    variants.add(parseFloat(raw.replace(/[. ]/g, "").replace(",", ".")));
    variants.add(parseFloat(raw.replace(/ /g, "").replace(",", ".")));
    for (const part of raw.split(/ +/)) variants.add(parseFloat(part.replace(/,/g, "")));
    for (const v of variants) if (Number.isFinite(v)) out.add(v);
  }
  return [...out];
}
export function runCheck(chk, body) {
  const re = (s) => new RegExp(s, "iu");
  if (chk.re) { const m = chk.re.find((s) => re(s).test(body)); return { pass: !!m, why: m ? `matched /${m}/` : "no re match" }; }
  if (chk.all) { const miss = chk.all.filter((s) => !re(s).test(body)); return { pass: !miss.length, why: miss.length ? `missing ${miss.join(", ")}` : "all present" }; }
  if (chk.nums) {
    const ns = numbersOf(body);
    for (const [lo, hi] of chk.nums) { const hit = ns.find((n) => n >= lo && n <= hi); if (hit !== undefined) return { pass: true, why: `number ${hit} in [${lo},${hi}]` }; }
    return { pass: false, why: "no number in range" };
  }
  return { pass: null, why: "no check" };
}
/** gold check of a case turn against a text: all of the turn's checks must pass; `reject` regexes veto (as score.mjs). */
export function goldPass(c, turn, body) {
  const checks = (c.gold.checks || []).filter((k) => k.turn === turn);
  if (!checks.length) return null;
  const res = checks.map((k) => runCheck(k, body));
  if (res.some((r) => r.pass === null)) return null;
  const rej = (c.gold.reject || []).find((s) => new RegExp(s, "iu").test(body));
  return res.every((r) => r.pass) && !rej;
}
export const sha = (u) => crypto.createHash("sha1").update(u).digest("hex");
export const pageText = (u) => { const f = path.join(evalDir, "cache", "pg_" + sha(u) + ".txt"); return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null; };
export const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
export const CASES = readJson(path.join(evalDir, "cases.json")).cases;
/** The pages one recorded turn read, in read order: [{ url, text }] cut to 12000 chars; `missing` counts uncached ones. */
export function turnPages(label, id, turn, rawDirName = "raw") {
  const f = path.join(evalDir, rawDirName, `${label}__${id}__r1.json`);
  if (!fs.existsSync(f)) return null;
  const r = readJson(f);
  const t = r.turns[turn]; if (!t) return null;
  const urls = (t.grounding?.web || []).filter((w) => w.read && !w.skipped && w.ok !== false).map((w) => w.read);
  const pages = urls.map((u) => ({ url: u, text: pageText(u) }));
  return { urls, pages: pages.filter((p) => p.text != null).map((p) => ({ url: p.url, text: p.text.slice(0, 12000) })), missing: pages.filter((p) => p.text == null).length, answer: String(t.answer || "").replace(/\[citation removed[^\]]*\]/g, ""), secs: t.secs, hasMaterial: !!t.grounding?.hasMaterial, voidRec: t.grounding?.void || null };
}
export const LATIN_LANGS = new Set(["en", "es", "fr", "de", "pt", "sw"]);
export const NONLATIN_LANGS = new Set(["ru", "ar", "zh", "ja", "hi"]);
