// Build fold-chat-lang-priors.js — the language-identification priors — from the khora's POSPrior@1 files
// (Universal Dependencies gold treebanks, CC BY-SA 4.0). READ-ONLY on the khora.
//   node scripts/build-lang-priors.mjs [--src ../khora] [--kw 500] [--k3 900] [--k2 300] [--fw 120] [--rho 0.25]
//
// For each language: its WORD distribution (top Kw word forms with log-probabilities) and its CHARACTER distribution
// (1-3-grams over "_word_", all unigrams, top K2 bigrams, top K3 trigrams, weighted by token count), and its FUNCTION
// WORDS (the top FW word forms by count). A share RHO of every form's weight goes to its diacritic-folded spelling,
// because chat is often typed without accents ("donde esta el bano"): RHO is a DECLARED constant (a judgement about
// how people type, not derived from data), and its effect is measured in docs/LANGID-PREREG.md.
// Log-probabilities are quantised to 0.1 nat (q = round(-ln p * 10)); the decoder in fold-chat-langid.js reverses it.
// Serbian is Latin in the UD treebank; its Cyrillic twin is made by the standard digraph transliteration (declared table).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const SRC = path.resolve(arg("--src", path.join(HERE, "..", "..", "khora")));
const DIR = path.join(SRC, "native", "priors");
const ALPHA = +arg("--alpha", 0.5);
// optional longer lists for chosen script groups (--big Cyrillic,Arabic,Devanagari): measured on dev+val, +0.2 points of precision for +280KB, so OFF
const BIG = new Set(arg("--big", "").split(",").filter(Boolean)), KWB = +arg("--kwbig", 2000), K3B = +arg("--k3big", 1800);
const KW = +arg("--kw", 500), K3 = +arg("--k3", 900), K2 = +arg("--k2", 300), FW = +arg("--fw", 120), RHO = +arg("--rho", 0.25);

// khora prior stem (ISO 639-3) -> [language code, script group]. Only languages a person plausibly types a chat ask in;
// the dead and tiny ones (Latin, Sanskrit, Wolof, Classical Chinese, Uyghur, Ancient Greek) are left out on purpose:
// they would only steal Italian/English/Persian text. Galician (glg) is left out for the same reason: on short chat text its
// small formal treebank cannot be told from Portuguese/Spanish and stole them (measured on the dev third, docs/LANGID-PREREG.md).
const STEMS = {
  eng: ["en", "Latin"], spa: ["es", "Latin"], por: ["pt", "Latin"], ita: ["it", "Latin"], cat: ["ca", "Latin"],
  fra: ["fr", "Latin"], deu: ["de", "Latin"], nld: ["nl", "Latin"], afr: ["af", "Latin"], swe: ["sv", "Latin"], dan: ["da", "Latin"], nob: ["no", "Latin"],
  ron: ["ro", "Latin"], pol: ["pl", "Latin"], ces: ["cs", "Latin"], slk: ["sk", "Latin"], slv: ["sl", "Latin"], hrv: ["hr", "Latin"], srp: ["sr", "Latin"],
  tur: ["tr", "Latin"], ind: ["id", "Latin"], fin: ["fi", "Latin"], est: ["et", "Latin"], hun: ["hu", "Latin"], vie: ["vi", "Latin"],
  lit: ["lt", "Latin"], lav: ["lv", "Latin"], cym: ["cy", "Latin"], gle: ["ga", "Latin"], mlt: ["mt", "Latin"], eus: ["eu", "Latin"],
  rus: ["ru", "Cyrillic"], ukr: ["uk", "Cyrillic"], bul: ["bg", "Cyrillic"],
  arb: ["ar", "Arabic"], fas: ["fa", "Arabic"], urd: ["ur", "Arabic"],
  hin: ["hi", "Devanagari"], mar: ["mr", "Devanagari"],
};
// Serbian Latin -> Cyrillic (Vuk's alphabet): digraphs first.
const DIGRAPH = [["lj", "љ"], ["nj", "њ"], ["dž", "џ"]];
const SR_CYR = { a: "а", b: "б", v: "в", g: "г", d: "д", đ: "ђ", e: "е", ž: "ж", z: "з", i: "и", j: "ј", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", r: "р", s: "с", t: "т", ć: "ћ", u: "у", f: "ф", h: "х", c: "ц", č: "ч", š: "ш" };
const toCyr = (w) => { let s = w; for (const [a, b] of DIGRAPH) s = s.split(a).join(b); let out = ""; for (const ch of s) { if (/\p{Script=Cyrillic}/u.test(ch)) out += ch; else if (SR_CYR[ch]) out += SR_CYR[ch]; else return null; } return out; };

const fold = (s) => s.normalize("NFD").replace(/\p{M}+/gu, "").normalize("NFC");
const LETTERS = /[^\p{L}\p{M}]+/u;

function tokensOf(prior) {
  // word -> weight (token count), forms split on non-letters so that the training sees what the detector will see
  const cnt = new Map();
  for (const [form, tags] of Object.entries(prior.forms)) {
    let c = 0; for (const n of Object.values(tags)) c += n;
    const f = form.normalize("NFC").toLowerCase();
    for (const t of f.split(LETTERS)) if (t && /\p{L}/u.test(t)) cnt.set(t, (cnt.get(t) || 0) + c);
  }
  return cnt;
}

function build(code, cnt, script) {
  const KW_ = BIG.has(script) ? KWB : KW, K3_ = BIG.has(script) ? K3B : K3;
  // spread RHO of each form's weight onto its folded spelling
  const w = new Map();
  for (const [t, c] of cnt) { const f = fold(t); if (f !== t) { w.set(t, (w.get(t) || 0) + c * (1 - RHO)); w.set(f, (w.get(f) || 0) + c * RHO); } else w.set(t, (w.get(t) || 0) + c); }
  let N = 0; for (const c of cnt.values()) N += c;
  const words = [...w].sort((a, b) => b[1] - a[1]).slice(0, KW_);
  const fwSrc = [...cnt].sort((a, b) => b[1] - a[1]).slice(0, FW).map(([t]) => t);
  const fwAll = new Set(); for (const t of fwSrc) { fwAll.add(t); fwAll.add(fold(t)); }
  // grams
  const g1 = new Map(), g2 = new Map(), g3 = new Map();
  for (const [t, c] of w) {
    const s = "_" + t + "_"; const cs = [...s];
    for (let i = 0; i < cs.length; i++) {
      if (cs[i] !== "_") g1.set(cs[i], (g1.get(cs[i]) || 0) + c);
      if (i + 2 <= cs.length) { const g = cs[i] + cs[i + 1]; if (g !== "__") g2.set(g, (g2.get(g) || 0) + c); }
      if (i + 3 <= cs.length) { const g = cs[i] + cs[i + 1] + cs[i + 2]; g3.set(g, (g3.get(g) || 0) + c); }
    }
  }
  let NG = 0; for (const m of [g1, g2, g3]) for (const c of m.values()) NG += c;
  const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k);
  const grams = [...top(g1, 1e9), ...top(g2, K2), ...top(g3, K3_)];
  const q = (c, T) => Math.min(255, Math.max(0, Math.round(-Math.log(c / T) * 10)));
    return {
    n: Math.round(N),
    wf: q(ALPHA, N), gf: q(ALPHA, NG),
    w: words.map(([t, c]) => t + ":" + q(c, N)).join(","),
    g: grams.map(([t, c]) => t + ":" + q(c, NG)).join(","),
    fw: [...fwAll].join(" "),
  };
}

const langs = {}, prov = {};
for (const [stem, [code, script]] of Object.entries(STEMS)) {
  const file = `pos-${stem}.json`;
  const prior = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
  const cnt = tokensOf(prior);
  langs[code] = { script, ...build(code, cnt, script) };
  prov[code] = { file, tokens: langs[code].n, giver: String(prior.provenance?.giver || "").replace(/ — .*$/, ""), source: String(prior.provenance?.source || "") };
  if (stem === "srp") {
    const cyr = new Map(); let lost = 0, all = 0;
    for (const [t, c] of cnt) { all += c; const y = toCyr(t); if (y) cyr.set(y, (cyr.get(y) || 0) + c); else lost += c; }
    langs["sr#cyr"] = { script: "Cyrillic", ...build("sr", cyr, "Cyrillic") };
    prov["sr#cyr"] = { file, tokens: langs["sr#cyr"].n, giver: "transliterated from pos-srp.json (Serbian Latin -> Cyrillic, declared table); " + Math.round(100 * lost / all) + "% of tokens had a foreign letter and were dropped" };
  }
}
let commit = "unknown"; try { commit = execFileSync("git", ["-C", SRC, "rev-parse", "--short", "HEAD"]).toString().trim(); } catch {}
const head = `// fold-chat-lang-priors.js — per-language word and character priors for fold-chat-langid.js.
// GENERATED by scripts/build-lang-priors.mjs from the khora's POSPrior@1 files (Universal Dependencies gold treebanks, CC BY-SA 4.0),
// khora commit ${commit}. Never edit by hand; regenerate. Declared constants: KW=${KW} words, K2=${K2} bigrams, K3=${K3} trigrams,
// FW=${FW} function words, ALPHA=${ALPHA} (an unlisted word/gram has probability ALPHA/N: 'seen half a time' in that language's own corpus; the same rule for every language), RHO=${RHO} (share of each form's weight given to its diacritic-folded spelling: people omit accents).
// q = round(-ln p * 10); wf/gf are the floors (q) for a word / gram the language does not list. 'sr#cyr' is Serbian Cyrillic (transliterated).
`;
const file = path.resolve(arg("--out", path.join(HERE, "..", "fold-chat-lang-priors.js")));
fs.writeFileSync(file, head + `export const PARAMS = Object.freeze(${JSON.stringify({ KW, K2, K3, FW, RHO, ALPHA, khora: commit })});\nexport const GIVERS = Object.freeze(${JSON.stringify(prov)});\nexport const PRIORS = ${JSON.stringify(langs)};\n`);
console.log(Object.keys(langs).length, "languages ->", path.relative(process.cwd(), file), Math.round(fs.statSync(file).size / 1024) + "KB");
