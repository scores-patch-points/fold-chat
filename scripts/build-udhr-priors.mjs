// Build the UDHR-extended language priors. The falsified gap (eval/langid/UDHR-FALSIFY-RESULTS.md): the detector
// reads languages it has a prior for (51/51 on UDHR ground truth) but confidently guesses for the ~465 it doesn't —
// and no threshold separates the two, so the fix is COVERAGE: build a prior from every UDHR translation (an ~1850-token
// verified sample of that language) and add it to fold-chat-lang-priors.js. The treebank-derived priors (the shipped
// 40) are kept untouched; UDHR priors are added only for codes the fold does not already have.
//   node scripts/build-udhr-priors.mjs [--corpus ../ethos/06-government-legal/un-udhr] [--out ../fold-chat-lang-priors.js]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const CORPUS = path.resolve(arg("--corpus", path.join(HERE, "..", "..", "ethos", "06-government-legal", "un-udhr")));
const OUT = path.resolve(arg("--out", path.join(HERE, "..", "fold-chat-lang-priors.js")));
const RHO = +arg("--rho", 0.25), KW = 500, K2 = 300, K3 = 900, FW = 120, ALPHA = 0.5;

// the fold's 40 (treebank) codes + their UDHR 3-letter twins — those keep their treebank priors
const F2U = { en:"eng", es:"spa", fr:"fra", de:"deu", it:"ita", pt:"por", nl:"nld", af:"afr", sv:"swe", da:"dan", no:"nor", ro:"ron", pl:"pol", cs:"ces", sk:"slk", sl:"slv", hr:"hrv", sr:"srp", bs:"bos", tr:"tur", id:"ind", ms:"msa", fi:"fin", et:"est", hu:"hun", vi:"vie", lt:"lit", lv:"lav", cy:"cym", ga:"gle", mt:"mlt", eu:"eus", ru:"rus", uk:"ukr", bg:"bul", zh:"zho", ja:"jpn", ko:"kor", ar:"ara", fa:"fas", ur:"urd", he:"heb", hi:"hin", mr:"mar", bn:"ben", pa:"pan", gu:"guj", or:"ori", ta:"tam", te:"tel", kn:"kan", ml:"mal", si:"sin", th:"tha", lo:"lao", km:"khm", my:"mya", bo:"bod", ka:"kat", hy:"hye", am:"amh", el:"ell" };
const TREEBANK = new Set(Object.keys(F2U));
const U2F = Object.fromEntries(Object.entries(F2U).map(([f, u]) => [u, f]));

const fold = (s) => s.normalize("NFD").replace(/\p{M}+/gu, "").normalize("NFC");
const LETTERS = /[^\p{L}\p{M}]+/u;
const q = (c, T) => Math.min(255, Math.max(0, Math.round(-Math.log(c / T) * 10)));

function scriptOf(text) {
  const counts = {};
  for (const ch of text) { const cp = ch.codePointAt(0); if (cp >= 0x3041 && cp <= 0x30ff) counts.Kana = (counts.Kana || 0) + 1; else if (/\p{Script=Cyrillic}/u.test(ch)) counts.Cyrillic = (counts.Cyrillic || 0) + 1; else if (/\p{Script=Arabic}/u.test(ch)) counts.Arabic = (counts.Arabic || 0) + 1; else if (/\p{Script=Devanagari}/u.test(ch)) counts.Devanagari = (counts.Devanagari || 0) + 1; else if (/\p{Script=Han}/u.test(ch)) counts.Han = (counts.Han || 0) + 1; else if (/\p{Script=Greek}/u.test(ch)) counts.Greek = (counts.Greek || 0) + 1; else if (/\p{Script=Hebrew}/u.test(ch)) counts.Hebrew = (counts.Hebrew || 0) + 1; else if (/\p{Script=Hangul}/u.test(ch)) counts.Hangul = (counts.Hangul || 0) + 1; else if (/\p{Script=Thai}/u.test(ch)) counts.Thai = (counts.Thai || 0) + 1; else if (/\p{Script=Bengali}/u.test(ch)) counts.Bengali = (counts.Bengali || 0) + 1; else if (cp < 0x0250 || /\p{Script=Latin}/u.test(ch)) counts.Latin = (counts.Latin || 0) + 1; else counts.Other = (counts.Other || 0) + 1; }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length ? (sorted[0][1] >= (text.length * 0.4) ? sorted[0][0] : "Latin") : "Latin";
}
const SCRIPT_KEY = { Latin: "Latin", Cyrillic: "Cyrillic", Arabic: "Arabic", Devanagari: "Devanagari", Han: "Han", Greek: "Greek", Hebrew: "Hebrew", Hangul: "Hangul", Thai: "Thai", Bengali: "Bengali", Kana: "Han" };

function countTokens(text) {
  const cnt = new Map();
  for (const t of text.normalize("NFC").toLowerCase().split(LETTERS)) if (t && /\p{L}/u.test(t)) cnt.set(t, (cnt.get(t) || 0) + 1);
  return cnt;
}
function build(cnt) {
  const w = new Map();
  for (const [t, c] of cnt) { const f = fold(t); if (f !== t) { w.set(t, (w.get(t) || 0) + c * (1 - RHO)); w.set(f, (w.get(f) || 0) + c * RHO); } else w.set(t, (w.get(t) || 0) + c); }
  let N = 0; for (const c of cnt.values()) N += c;
  const words = [...w].sort((a, b) => b[1] - a[1]).slice(0, KW);
  const fwAll = new Set(); for (const t of [...cnt].sort((a, b) => b[1] - a[1]).slice(0, FW).map(([t]) => t)) { fwAll.add(t); fwAll.add(fold(t)); }
  const g1 = new Map(), g2 = new Map(), g3 = new Map();
  for (const [t, c] of w) { const cs = [...("_" + t + "_")]; for (let i = 0; i < cs.length; i++) { if (cs[i] !== "_") g1.set(cs[i], (g1.get(cs[i]) || 0) + c); if (i + 2 <= cs.length) { const g = cs[i] + cs[i + 1]; if (g !== "__") g2.set(g, (g2.get(g) || 0) + c); } if (i + 3 <= cs.length) { const g = cs[i] + cs[i + 1] + cs[i + 2]; g3.set(g, (g3.get(g) || 0) + c); } } }
  let NG = 0; for (const m of [g1, g2, g3]) for (const c of m.values()) NG += c;
  const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k);
  const grams = [...top(g1, 1e9), ...top(g2, K2), ...top(g3, K3)];
  return { n: Math.round(N), wf: q(ALPHA, N), gf: q(ALPHA, NG), w: words.map(([t, c]) => t + ":" + q(c, N)).join(","), g: grams.map(([t, c]) => t + ":" + q(c, NG)).join(","), fw: [...fwAll].join(" ") };
}

const src = fs.readFileSync(OUT, "utf8");
const importPRIORS = await import("file://" + OUT + `?ts=${Date.now()}`);
const PARAMS = importPRIORS.PARAMS;
const GIVERS = { ...importPRIORS.GIVERS };
const PRIORS = { ...importPRIORS.PRIORS };

const added = {}, names = {};
let addedTok = 0, nFiles = 0;
for (const f of fs.readdirSync(CORPUS).filter((x) => x.startsWith("udhr-") && x.endsWith(".txt"))) {
  nFiles++;
  const raw = fs.readFileSync(path.join(CORPUS, f), "utf8");
  const code = f.replace(/^udhr-|\.txt$/g, "").replace(/_/g, "");
  if (TREEBANK.has(U2F[code]) || Object.prototype.hasOwnProperty.call(PRIORS, code)) continue;   // the fold already has ground
  // keep the ~known main dialects out of the treebank 40's way: a UDHR translation that IS one of the 40 under
  // another spelling is already covered by U2F; everything else is genuinely new ground
  const name = (raw.match(/^Language:\s*([^(]*?)\(/m) || [])[1] || code;
  const body = raw.split(/\r?\n/).filter((l) => !/^(?:Language:|Adopted:|Publisher:|Universal Declaration of Human Rights|Preamble)/i.test(l.trim())).join("\n");
  const text = body.replace(/\s+/g, " ").slice(0, 40000);
  const cnt = countTokens(text);
  if (cnt.size < 60) continue;
  const script = SCRIPT_KEY[scriptOf(text)] || "Latin";
  let lang = code;
  if (Object.prototype.hasOwnProperty.call(U2F, code)) lang = U2F[code];           // never reached (treebank), kept for safety
  PRIORS[lang] = { script, ...build(cnt) };
  GIVERS[lang] = { file: f, tokens: PRIORS[lang].n, giver: `UDHR (OHCHR) translation ${f}` };
  added[lang] = true; names[lang] = name; addedTok += PRIORS[lang].n;
}
console.log("UDHR files read:", nFiles, "| priors added:", Object.keys(added).length, "| tokens added:", addedTok);

const head = `// fold-chat-lang-priors.js — per-language word and character priors for fold-chat-langid.js.
// GENERATED. The shipped 40 languages come from the khora's POSPrior@1 files (Universal Dependencies gold treebanks,
// CC BY-SA 4.0); the UDHR priors (scripts/build-udhr-priors.mjs) come from the OHCHR UDHR translations
// (Universal Declaration of Human Rights, OHCHR public-domain translations) and close the no-prior gap the
// UDHR falsification measured. Never edit by hand; regenerate.
// q = round(-ln p * 10); wf/gf are the floors for a word / gram the language does not list.
`;
const out = head
  + `export const PARAMS = Object.freeze(${JSON.stringify({ KW, K2, K3, FW, RHO, ALPHA, ...PARAMS })});\n`
  + `export const GIVERS = Object.freeze(${JSON.stringify(GIVERS)});\n`
  + `export const NAMES = Object.freeze(${JSON.stringify(names)});\n`
  + `export const PRIORS = ${JSON.stringify(PRIORS)};\n`;
fs.writeFileSync(OUT, out);
console.log("->", path.relative(process.cwd(), OUT), Math.round(fs.statSync(OUT).size / 1024) + "KB,", Object.keys(PRIORS).length, "languages");