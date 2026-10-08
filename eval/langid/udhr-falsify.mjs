// eval/langid/udhr-falsify.mjs — the UDHR falsification (see UDHR-FALSIFY-PREREG.md).
// Ground truth: the 516 UDHR translations on disk. Never edits the corpus; writes results to results/.
// The embedding arm needs local Ollama nomic-embed-text at 11435; without it that arm is UNMEASURED.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { identify } from "../../fold-chat-langid.js";
import { PRIORS } from "../../fold-chat-lang-priors.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = process.env.UDHR_CORPUS || "/Users/mlacy/Documents/3.0/Zenodotus/06-government-legal/un-udhr";
const OUT = join(HERE, "results");
mkdirSync(OUT, { recursive: true });

// fold 2-letter code → the 3-letter UDHR file code (declared map; used only to know WHICH ground truth the
// detector has a prior for — a UDHR language outside this map must come back `unknown`, never a wrong guess)
const F2U = {
  en:"eng", es:"spa", fr:"fra", de:"deu", it:"ita", pt:"por", nl:"nld", af:"afr", sv:"swe", da:"dan", no:"nor",
  ro:"ron", pl:"pol", cs:"ces", sk:"slk", sl:"slv", hr:"hrv", sr:"srp", bs:"bos", tr:"tur", id:"ind", ms:"msa",
  fi:"fin", et:"est", hu:"hun", vi:"vie", lt:"lit", lv:"lav", cy:"cym", ga:"gle", mt:"mlt", eu:"eus",
  ru:"rus", uk:"ukr", bg:"bul", zh:"zho", ja:"jpn", ko:"kor", ar:"ara", fa:"fas", ur:"urd", he:"heb",
  hi:"hin", mr:"mar", bn:"ben", pa:"pan", gu:"guj", or:"ori", ta:"tam", te:"tel", kn:"kan", ml:"mal",
  si:"sin", th:"tha", lo:"lao", km:"khm", my:"mya", bo:"bod", ka:"kat", hy:"hye", am:"amh", el:"ell",
};
const U2F = Object.fromEntries(Object.entries(F2U).map(([f, u]) => [u, f]));
// canonicalise UDHR code spellings to the fold 2-letter codes (udhr-cmn.txt, udhr-arb.txt, ...); a UDHR-English
  // 3-letter code that now has its OWN UDHR-built prior IS prior-bearing (expected = that code), else no prior (unknown)
function canon(c) {
  const over = { cmn: "zho", cmn_hans: "zho", cmn_hant: "zho", arb: "ara", nno: "nor", nob: "nor", hbs: null };
  const key = Object.prototype.hasOwnProperty.call(over, c) ? over[c] : c;
  if (Object.prototype.hasOwnProperty.call(U2F, key)) return U2F[key];
  return Object.prototype.hasOwnProperty.call(PRIORS, key) ? key : null;
}

// A language-pure sample: the prose right after the header and the title (heading lines are per-language;
// Article headings are translated too, so the sample IS the whole short prose block after "Preamble").
function sampleOf(raw) {
  const lines = raw.split(/\r?\n/);
  const body = [];
  let started = false, seenBlank = 0;
  for (const line of lines) {
    const t = line.trim();
    if (!started) {
      if (/^Universal Declaration of Human Rights$/i.test(t)) { started = true; continue; }
      if (/^Language:|^Adopted:|^Publisher:|^Preamble/i.test(t)) continue;
      continue;
    }
    if (/^Preamble\s*$/i.test(t) || /^Language:|^Adopted:|^Publisher:/i.test(t)) continue;
    if (!t) { seenBlank++; continue; }
    if (/^(?:Now, therefore|The General Assembly|Proclaims|Article\s*\d|УНИВЕРСАЛЬНАЯ|Universal Declaration)/i.test(t)) continue;
    body.push(t);
    if (body.join(" ").length >= 1200) break;
  }
  return body.join(" ").replace(/\s+/g, " ").slice(0, 1200);
}
function firstSentence(s) { const m = s.match(/^[^.!?।。！？]+[.!?।。！？]/u); return (m ? m[0] : s.slice(0, 120)).trim(); }

// ── the fold detector ─────────────────────────────────────────────────────────
const ngram = (s) => { const d = identify(s); return d.confident ? d.lang : "unknown"; };

// ── embedding arm (needs local nomic-embed-text; else UNMEASURED) ────────────
const EMBED_URL = "http://127.0.0.1:11435/api/embed";
const cache = new Map();
async function embed(text) {
  if (cache.has(text)) return cache.get(text);
  try {
    const r = await fetch(EMBED_URL, { method: "POST", body: JSON.stringify({ model: "nomic-embed-text", input: [text.slice(0, 3000)] }) });
    if (!r.ok) throw new Error("embed http " + r.status);
    const v = (await r.json()).embeddings?.[0];
    if (!v) throw new Error("no embedding");
    cache.set(text, v); return v;
  } catch (e) { cache.set(text, null); return null; }
}
const dots = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

// ── run ───────────────────────────────────────────────────────────────────────
const lang = {};
for (const f of readdirSync(CORPUS).filter((x) => x.startsWith("udhr-") && x.endsWith(".txt"))) {
  const raw = readFileSync(join(CORPUS, f), "utf8");
  const code = f.replace(/^udhr-|\.txt$/g, "").replace(/_/g, "_");
  const sample = sampleOf(raw);
  if (sample.length < 80) continue;
  const fold = canon(code); // fold language code the ground truth maps to, or null = "no prior"
  lang[f] = { udhr: code, fold, sample };
}
const E2E = ["en","es","fr","de","it","pt","nl","sv","pl","cs","ru","uk","tr","el","fi","zh","ja","ko","th","hi","ar","he"];
const rows = [];
for (const [f, p] of Object.entries(lang)) {
  const g = ngram(p.sample);
  const short = ngram(firstSentence(p.sample));
  const g2 = ngram(p.sample); // determinism re-read
  rows.push({ f, udhr: p.udhr, fold: p.fold, expected: p.fold || "unknown", full: g, short, determ: g === g2, len: p.sample.length, sample: p.sample.slice(0, 700) });
}
function stats(rs) {
  const withPrior = rs.filter((r) => r.fold);
  return {
    total: rs.length, withPrior: withPrior.length,
    confidentRight: withPrior.filter((r) => r.full === r.fold).length,
    confidentWrong: rs.filter((r) => r.full !== "unknown" && r.full !== r.fold).length,   // counts "no prior but guessed" too
    unknownWithPrior: withPrior.filter((r) => r.full === "unknown").length,
    shortRight: withPrior.filter((r) => r.short === r.fold).length,
    shortWrong: rs.filter((r) => r.short !== "unknown" && r.short !== r.fold).length,
  };
}
// the 22 E2E languages → their UDHR files (via U2F), plus every file whose fold mapping exists
const e2eFiles = rows.filter((r) => E2E.includes(r.fold));
const allWithPrior = rows.filter((r) => r.fold);

// embedding A/B on the E2E set: prototypes = this DOC's own later paragraphs; test = the short first sentence
let emb = null; const embLog = [];
if (process.env.NO_EMBED !== "1" && e2eFiles.length) {
  const tests = e2eFiles.filter((r) => r.fold).slice(0, 22);
  const protos = new Map();
  for (const r of tests) {
    const sents = r.sample.match(/[^.!?।。！？]+[.!?।。！？]+/gu) || [];
    const long = sents.map((x) => x.trim()).filter((x) => x.length > 30);
    if (long.length < 3) { embLog.push(`${r.fold}: too short / embed unavailable`); continue; }
    const paras = long.slice(2, Math.min(6, long.length - 1));
    const vecs = (await Promise.all(paras.map(embed))).filter((x) => x);
    if (vecs.length < 2) { embLog.push(`${r.fold}: too short / embed unavailable`); continue; }
    const proto = []; for (let i = 0; i < vecs[0].length; i++) proto.push(vecs.reduce((s, v) => s + v[i], 0) / vecs.length);
    protos.set(r.fold, proto);
  }
  for (const r of tests) {
    const sents = r.sample.match(/[^.!?।।。！？]+[.!?।।。！？]+/gu) || [];
    const long = sents.map((x) => x.trim()).filter((x) => x.length > 30);
    if (!long.length) continue;
    await new Promise((res) => setTimeout(res, 60));
    const t = await embed(long[0]);
    if (!t) continue;
    let best = null, bs = -Infinity;
    for (const [c, pr] of protos) { const s = dots(t, pr); if (s > bs) { bs = s; best = c; } }
    embLog.push(`${r.fold}: ${best} (${best === r.fold ? "hit" : "miss"})`);
  }
  emb = { perFold: embLog };
}

const result = {
  prereg: "eval/langid/UDHR-FALSIFY-PREREG.md",
  at: new Date().toISOString(),
  corpus: CORPUS,
  parsed: Object.keys(lang).length,
  all: stats(rows),
  e2e: stats(e2eFiles),
  allWithPrior: stats(allWithPrior),
  embedding: emb,
  determinismViolations: rows.filter((r) => !r.determ).length,
  wrongs: rows.filter((r) => r.full !== "unknown" && r.full !== r.fold).map((r) => `${r.udhr} -> ${r.full}`).slice(0, 40),
  shortWrongs: rows.filter((r) => r.short !== "unknown" && r.short !== r.fold).map((r) => `${r.udhr} -> ${r.short}`).slice(0, 40),
};
writeFileSync(join(OUT, "udhr-falsify.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));