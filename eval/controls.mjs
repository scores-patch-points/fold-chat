// controls.mjs — verify the grounding GATE against material it should REJECT
// (Article IV.1: a gate not shown to reject is not a gate), and accept.
//
//   node eval/controls.mjs
//
// No browser, no model. It loads the app's own fold-chat-ground.js (from the
// snapshot in eval/.app, so it is the build the browser run used), fetches real
// Wikipedia articles with the app's own readText() (cached in eval/cache), and
// feeds hand-written sentences straight to `turnRecord` / `attribute`. A sentence
// is "accepted" iff the gate attaches it to the material (entry.ref != null).
//
// Classes
//   NEG   plainly false against the passage            -> must be REJECTED
//   POS   true, near-verbatim in the passage           -> must be ACCEPTED
//   DER   true & source-supported but not copied (unit conversion, paraphrase,
//         markup) -> an ideal gate accepts; we record what it does
//   XL    true, source is English, sentence is in another language -> same
//   SELF  verbatim sentence from a same-language Wikipedia article -> must accept
//   SELFN same, with its first number replaced by 7777 -> must reject
//   SCRIPT  (added with docs/GATE-FIX-PREREG.md) verbatim sentences from hi / ar / zh Wikipedia articles
//           other than the Eiffel Tower, split on that script's own terminators -> must accept
//   SCRIPTN the digit-bearing SCRIPT sentences with their first number replaced by 7777 -> must reject
//   HOLDN / HOLDP  HELD-OUT false / true English sentences written BEFORE any gate change, never used to tune.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf("--" + k); return i < 0 ? d : argv[i + 1]; };
// --live scores the working tree's own fold-chat-ground.js (the repo root) instead of a frozen snapshot.
const appDir = argv.includes("--live") ? path.join(here, "..") : path.join(here, argOf("app", ".app"));
if (!fs.existsSync(appDir)) throw new Error("run eval/run.mjs once first (it snapshots the app into eval/.app)");
const ground = await import(path.join(appDir, "fold-chat-ground.js"));
const webm = await import(path.join(appDir, "fold-chat-web.js"));
const cacheDir = path.join(here, "cache");
fs.mkdirSync(cacheDir, { recursive: true });

const UA = { "user-agent": "fold-eval/1.0 (accuracy harness; scores.patch.points@proton.me)" };
const fetchUA = (u, o = {}) => fetch(u, { ...o, headers: { ...(o.headers || {}), ...UA } });
async function article(lang, title) {
  const f = path.join(cacheDir, `${lang}__${encodeURIComponent(title).replace(/%/g, "_")}.txt`);
  if (fs.existsSync(f)) return fs.readFileSync(f, "utf8");
  const url = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`;
  const r = await webm.readText(url, { fetchImpl: fetchUA, timeoutMs: 20000 });
  if (!r.ok) throw new Error("could not read " + url);
  fs.writeFileSync(f, r.text);
  await new Promise((x) => setTimeout(x, 1200));
  return r.text;
}

const ART = {
  nashville: ["en", "Nashville,_Tennessee"], eiffel: ["en", "Eiffel_Tower"], wall: ["en", "Berlin_Wall"], canberra: ["en", "Canberra"],
  pride: ["en", "Pride_and_Prejudice"], everest: ["en", "Mount_Everest"], apollo: ["en", "Apollo_11"],
};
const text = {};
for (const [k, [l, t]] of Object.entries(ART)) text[k] = await article(l, t);
const mat = (k) => [{ ref: `Wikipedia — ${ART[k][1].replace(/_/g, " ")}`, source: `https://${ART[k][0]}.wikipedia.org/wiki/${ART[k][1]}`, text: text[k] }];

const C = []; // { id, cls, art, s, note }
const add = (id, cls, art, s, note = "") => C.push({ id, cls, art, s, note });
// ---- NEG: plainly false against the same passage ----
add("n01", "NEG", "nashville", "Nashville was founded in 1850.", "date swap; 1850 occurs elsewhere in the article (cholera 1849-1850)");
add("n02", "NEG", "nashville", "Nashville was founded in 1779 by Napoleon Bonaparte.", "true date + invented founder");
add("n03", "NEG", "nashville", "Nashville is the capital of Texas.", "wrong state");
add("n04", "NEG", "nashville", "Nashville was founded in 1780.", "off-by-one year");
add("n05", "NEG", "eiffel", "The Eiffel Tower was completed in 1925.", "date not in passage");
add("n06", "NEG", "eiffel", "The Eiffel Tower is 450 metres tall.", "number not in passage");
add("n07", "NEG", "eiffel", "The Eiffel Tower is a type of pasta.", "no number/name conflict, only a false predicate");
add("n08", "NEG", "eiffel", "The Eiffel Tower is located in London.", "wrong city (London may occur in the article)");
add("n09", "NEG", "eiffel", "The Eiffel Tower is not 330 metres tall; it is 33 metres tall.", "negation + wrong number (330 present)");
add("n10", "NEG", "eiffel", "The Statue of Liberty is 330 metres tall.", "entity swap");
add("n11", "NEG", "eiffel", "The Eiffel Tower was designed by Leonardo da Vinci.", "invented designer");
add("n12", "NEG", "eiffel", "The Eiffel Tower is 330 metres tall and made entirely of wood.", "true prefix + false predicate");
add("n13", "NEG", "wall", "The Berlin Wall fell in 1991.", "date not in passage");
add("n14", "NEG", "wall", "The Berlin Wall fell in 1989 because of a volcanic eruption.", "true prefix + false cause");
add("n15", "NEG", "wall", "The Berlin Wall was built in 1989 and fell in 1961.", "both numbers present, swapped");
add("n16", "NEG", "canberra", "Canberra is the capital of Australia and has a population of 12 million.", "true prefix + false number");
add("n17", "NEG", "canberra", "Sydney is the capital of Australia.", "wrong city");
add("n18", "NEG", "pride", "Pride and Prejudice was written by Charles Dickens.", "wrong author");
add("n19", "NEG", "pride", "Pride and Prejudice was published in 1913.", "wrong year");
add("n20", "NEG", "everest", "Mount Everest is located in the Andes.", "wrong range");
add("n21", "NEG", "everest", "Mount Everest is 5,000 metres tall.", "wrong number");
add("n22", "NEG", "apollo", "Apollo 11 landed on the Moon on July 16, 1969.", "16 July is the LAUNCH date (in the passage)");
add("n23", "NEG", "apollo", "Apollo 11 landed on Mars.", "wrong body");
add("n24", "NEG", "apollo", "Apollo 12 landed on the Moon on July 20, 1969.", "wrong mission");
add("n25", "NEG", "eiffel", "Photosynthesis converts sunlight into chemical energy in plants.", "off-topic");
add("n26", "NEG", "eiffel", "The Eiffel Tower was built in 1889 and was destroyed in 1923.", "true clause + false clause");
// ---- POS: near-verbatim true ----
add("p01", "POS", "nashville", "Nashville was founded in 1779.");
add("p02", "POS", "eiffel", "The Eiffel Tower is 330 metres (1,083 ft) tall.");
add("p03", "POS", "eiffel", "The tower is 330 metres tall, about the same height as an 81-storey building.");
add("p04", "POS", "eiffel", "The Eiffel Tower is named after the engineer Gustave Eiffel.");
add("p05", "POS", "wall", "The Berlin Wall encircled West Berlin from 1961 to 1989.");
add("p06", "POS", "canberra", "Canberra is the capital city of Australia.");
add("p07", "POS", "pride", "Pride and Prejudice is a novel by English author Jane Austen.");
add("p08", "POS", "everest", "Mount Everest lies in the Mahalangur Himal sub-range of the Himalayas.");
add("p09", "POS", "apollo", "Apollo 11 landed in the Sea of Tranquility on July 20.");
add("p10", "POS", "everest", "Its height was most recently measured in 2020 as 8,848.86 m.");
// ---- DER: true, supported, not copied ----
add("d01", "DER", "eiffel", "The Eiffel Tower is 1,083 feet tall.", "feet vs 'ft'");
add("d02", "DER", "eiffel", "The Eiffel Tower is about 1,082.68 feet tall.", "defect seed (2): decimal unit conversion of 330 m");
add("d03", "DER", "eiffel", "The Eiffel Tower stands 0.33 kilometres high.", "unit conversion m -> km");
add("d04", "DER", "eiffel", "The tower reaches a height of 330 m.", "'m' for 'metres'");
add("d05", "DER", "everest", "Mount Everest is roughly 8,849 metres high.", "rounded 8,848.86");
add("d06", "DER", "wall", "The wall came down in 1989.", "paraphrase");
add("d07", "DER", "eiffel", "Gustave Eiffel's firm built the tower between 1887 and 1889.", "paraphrase of 'from 1887 to 1889'");
add("d08", "DER", "pride", "It was Austen's third novel.", "paraphrase");
add("d09", "DER", "eiffel", "The Eiffel Tower is **330 metres** (1,083 ft) tall.", "markdown bold around the figure");
add("d10", "DER", "eiffel", "According to Wikipedia [W1], the Eiffel Tower is 330 metres tall.", "internal [W1] tag leaked by the writer model (seen in claude-sonnet-4-6 output)");
add("d11", "DER", "eiffel", "The Eiffel Tower is 330 meters tall.", "US spelling meters vs metres");
add("d12", "DER", "eiffel", "The Eiffel Tower is 330 metres tall, which is about 1,083 feet.", "two-unit sentence");
// ---- XL: cross-lingual, true; source English ----
add("x01", "XL", "eiffel", "La Torre Eiffel mide 330 metros de altura.", "es");
add("x02", "XL", "eiffel", "La tour Eiffel mesure 330 mètres de haut.", "fr");
add("x03", "XL", "eiffel", "Die Höhe des Eiffelturms beträgt 330 Meter.", "de");
add("x04", "XL", "eiffel", "Высота Эйфелевой башни составляет 330 метров.", "ru");
add("x05", "XL", "eiffel", "埃菲尔铁塔高330米。", "zh");
add("x06", "XL", "eiffel", "エッフェル塔の高さは330メートルです。", "ja");
add("x07", "XL", "eiffel", "يبلغ ارتفاع برج إيفل 330 مترا.", "ar");
add("x08", "XL", "eiffel", "एफ़िल टॉवर की ऊँचाई 330 मीटर है।", "hi");
add("x09", "XL", "wall", "El Muro de Berlín cayó en 1989.", "es");
add("x10", "XL", "wall", "柏林墙于1989年倒塌。", "zh");
add("x11", "XL", "canberra", "Канберра — столица Австралии.", "ru");
add("x12", "XL", "canberra", "La capital de Australia es Canberra.", "es");
add("xn1", "XLN", "eiffel", "La Torre Eiffel mide 450 metros de altura.", "es, FALSE number (must reject)");
add("xn2", "XLN", "eiffel", "埃菲尔铁塔高450米。", "zh, FALSE number (must reject)");
add("xn3", "XLN", "eiffel", "Эйфелева башня была построена в 1925 году.", "ru, FALSE date (must reject)");
add("xn4", "XLN", "wall", "El Muro de Berlín cayó en 1991.", "es, FALSE date (must reject)");

// ---- SELF / SELFN: same-language source ----
const SELF = [
  ["zh", "埃菲尔铁塔"], ["ja", "エッフェル塔"], ["ru", "Эйфелева_башня"], ["ar", "برج_إيفل"], ["hi", "एफ़िल_टॉवर"], ["es", "Torre_Eiffel"], ["fr", "Tour_Eiffel"], ["de", "Eiffelturm"],
];
const selfMat = {};
for (const [l, t] of SELF) {
  try {
    const tx = await article(l, t);
    const sents = ground.splitSentences(tx).filter((s) => /\d{2,}/.test(s) && s.length >= 25 && s.length <= 260);
    if (!sents.length) { console.log("  (no digit sentence found for", l, ")"); continue; }
    const s = sents[0];
    selfMat[l] = [{ ref: `Wikipedia(${l}) — ${t}`, source: `https://${l}.wikipedia.org/wiki/${t}`, text: tx }];
    C.push({ id: `s_${l}`, cls: "SELF", art: "self:" + l, s, note: `verbatim from ${l}.wikipedia ${t}` });
    const m = s.match(/\d[\d,.]*/);
    const swapped = m ? s.replace(m[0], "7777") : null;
    if (swapped) C.push({ id: `sn_${l}`, cls: "SELFN", art: "self:" + l, s: swapped, note: `same, first number ${m[0]} -> 7777` });
  } catch (e) { console.log("  (skip self-source", l, String(e.message).slice(0, 60), ")"); }
}


// ---- HELD-OUT (written before the gate fix; generalisation check, never tuned against) ----
const addH = (id, cls, art, s, note = "") => C.push({ id, cls, art, s, note });
addH("h01", "HOLDN", "nashville", "Nashville is the capital of Tennessee and is located on the Pacific coast.", "true prefix + false place");
addH("h02", "HOLDN", "eiffel", "The Eiffel Tower is the shortest structure in Paris.", "predicate flip ('tallest' is in the passage)");
addH("h03", "HOLDN", "wall", "The Berlin Wall separated West Berlin from the Soviet Union for 40 years.", "wrong number + wrong relation");
addH("h04", "HOLDN", "canberra", "Canberra is the largest city in Australia.", "HARD: 'largest' + 'city' are in the passage ('largest inland city')");
addH("h05", "HOLDN", "pride", "Pride and Prejudice is a novel by Charlotte Bronte.", "wrong author");
addH("h06", "HOLDN", "everest", "Mount Everest is the tallest mountain in Africa.", "wrong continent");
addH("h07", "HOLDN", "apollo", "Neil Armstrong was the second person to walk on the Moon.", "HARD: 'second' is in the passage about something else");
addH("h08", "HOLDN", "eiffel", "The Eiffel Tower has been closed to visitors since 1889.", "true year + false predicate");
addH("h09", "HOLDN", "wall", "The Berlin Wall was demolished by the United Nations in 1990.", "1990 is in the passage; the actor is invented");
addH("h10", "HOLDN", "nashville", "Nashville has a population of 50 million people.", "wrong number");
addH("h11", "HOLDN", "everest", "Mount Everest was first climbed in 1853 by Marco Polo.", "invented climber and year");
addH("h12", "HOLDN", "apollo", "Apollo 11 carried five astronauts to the Moon.", "HARD: word-number; 'three astronauts' is in the passage");
addH("hp1", "HOLDP", "canberra", "Canberra is Australia's largest inland city.", "verbatim fragment");
addH("hp2", "HOLDP", "everest", "Mount Everest is the highest mountain on Earth above sea level.", "verbatim fragment");
addH("hp3", "HOLDP", "apollo", "Apollo 11 was the American spaceflight that first landed humans on the Moon.", "verbatim fragment");
addH("hp4", "HOLDP", "eiffel", "The Eiffel Tower was constructed as the centrepiece of the 1889 World's Fair.", "verbatim fragment");
addH("hp5", "HOLDP", "pride", "The novel follows the character development of Elizabeth Bennet.", "verbatim fragment");
addH("hp6", "HOLDP", "wall", "The Berlin Wall was a guarded concrete barrier that encircled West Berlin.", "verbatim fragment");
addH("hp7", "HOLDP", "nashville", "Nashville is the capital and most populous city in the U.S. state of Tennessee.", "verbatim fragment");
addH("hp8", "HOLDP", "eiffel", "At 330 m, the Eiffel Tower is about 1,083 feet high.", "unit variant + paraphrase");
addH("hp9", "HOLDP", "everest", "Mount Everest stands about 29,032 feet above sea level.", "unit conversion of 8,848.86 m (29,031.7 ft)");
addH("hp10", "HOLDP", "wall", "Construction of the Berlin Wall began on 13 August 1961.", "paraphrase of 'was commenced ... on 13 August 1961'");

// ---- SCRIPT / SCRIPTN: verbatim same-language sentences, three caseless / non-Latin scripts ----
const SCRIPT = [["hi", "भारत"], ["ar", "القاهرة"], ["zh", "北京市"]];
const scriptMat = {};
for (const [l, t] of SCRIPT) {
  const tx = await article(l, t);
  scriptMat[l] = [{ ref: `Wikipedia(${l}) — ${t}`, source: `https://${l}.wikipedia.org/wiki/${t}`, text: tx }];
  const lim = l === "zh" ? [14, 110] : [30, 220];
  const sents = tx.split(/(?<=[।。.!?؟])\s*/u).map((x) => x.trim()).filter((x) => x.length >= lim[0] && x.length <= lim[1] && !/[\n\[\]]/.test(x));
  const withDigits = sents.filter((x) => /\d{2,}/.test(x)).slice(0, 2), without = sents.filter((x) => !/\d/.test(x)).slice(0, 2);
  [...withDigits, ...without].forEach((s, i) => {
    C.push({ id: `sc_${l}${i + 1}`, cls: "SCRIPT", art: "script:" + l, s, note: `verbatim from ${l}.wikipedia ${t}` });
    const m = s.match(/\d[\d,.]*/);
    if (m) C.push({ id: `scn_${l}${i + 1}`, cls: "SCRIPTN", art: "script:" + l, s: s.replace(m[0], "7777"), note: `same, first number ${m[0]} -> 7777` });
  });
}

// SELFP: the same true hand-written Eiffel-height sentences as XL, but graded against the SAME-LANGUAGE article
// (is the gate language-agnostic once a same-language source exists, or only for verbatim copies?)
const LANGOF = { x01: "es", x02: "fr", x03: "de", x04: "ru", x05: "zh", x06: "ja", x07: "ar", x08: "hi" };
for (const c of [...C]) if (LANGOF[c.id] && selfMat[LANGOF[c.id]]) C.push({ id: "sp_" + LANGOF[c.id], cls: "SELFP", art: "self:" + LANGOF[c.id], s: c.s, note: `true hand-written sentence vs ${LANGOF[c.id]}.wikipedia article (not a verbatim copy)` });
const res = [];
for (const c of C) {
  const material = c.art.startsWith("self:") ? selfMat[c.art.slice(5)] : c.art.startsWith("script:") ? scriptMat[c.art.slice(7)] : mat(c.art);
  const rec = ground.turnRecord(c.s, material, { turn: 1 });
  const e = rec.coverage.entries[0] || {};
  const grounded = !!e.ref;
  const expectAccept = ["POS", "DER", "XL", "SELF", "SELFP", "SCRIPT", "HOLDP"].includes(c.cls);
  res.push({
    id: c.id, cls: c.cls, sentence: c.s, note: c.note, article: c.art, grounded, score: e.score ?? null, why: e.why ?? null,
    unsupported: rec.unsupported, quote: rec.facing?.sources?.[0]?.text ?? null,
    ok: expectAccept ? grounded : !grounded,
    verdict: expectAccept ? (grounded ? "accepted (correct)" : "REJECTED (false negative)") : (grounded ? "ACCEPTED (FALSE POSITIVE)" : "rejected (correct)"),
  });
}

// POOLED: the real app hands the gate 3-5 pages at once; repeat the NEG set with all English articles together.
const pool = Object.keys(ART).flatMap((k) => mat(k));
for (const c of C.filter((x) => x.cls === "NEG")) {
  const rec = ground.turnRecord(c.s, pool, { turn: 1 });
  const e = rec.coverage.entries[0] || {};
  res.push({ id: c.id + "@pool", cls: "NEG-POOL", sentence: c.s, note: "all 7 articles as material", article: "pool", grounded: !!e.ref, score: e.score ?? null, unsupported: rec.unsupported, ok: !e.ref, verdict: e.ref ? "ACCEPTED (FALSE POSITIVE)" : "rejected (correct)", citedTo: e.ref || null });
}

const agg = {};
for (const r of res) { const a = (agg[r.cls] ||= { n: 0, ok: 0 }); a.n++; if (r.ok) a.ok++; }
const sum = (cls) => agg[cls] ? `${agg[cls].ok}/${agg[cls].n}` : "n/a";
const summary = {
  specificity_NEG_single_article: sum("NEG"), specificity_NEG_pooled: sum("NEG-POOL"),
  sensitivity_POS_verbatim: sum("POS"), sensitivity_DER_derived_paraphrase: sum("DER"), sensitivity_XL_cross_lingual_true: sum("XL"),
  specificity_XLN_cross_lingual_false: sum("XLN"), XL_unaccepted_with_typed_cross_language_reason: `${res.filter((r) => r.cls === "XL" && !r.grounded && r.why === "cross-language").length}/${res.filter((r) => r.cls === "XL" && !r.grounded).length}`, sensitivity_SCRIPT_hi_ar_zh_verbatim: sum("SCRIPT"), specificity_SCRIPTN_hi_ar_zh_number_swapped: sum("SCRIPTN"), specificity_HOLDN_heldout_false: sum("HOLDN"), sensitivity_HOLDP_heldout_true: sum("HOLDP"), sensitivity_SELF_same_language_verbatim: sum("SELF"), sensitivity_SELFP_same_language_paraphrase: sum("SELFP"), specificity_SELFN_same_language_false: sum("SELFN"),
  falsePositives: res.filter((r) => (r.cls.startsWith("NEG") || ["HOLDN", "SCRIPTN", "XLN", "SELFN"].includes(r.cls)) && r.grounded).map((r) => r.id),
};
fs.writeFileSync(path.join(here, argOf("out", "controls-results.json")), JSON.stringify({ at: new Date().toISOString(), gate: "fold-chat-ground.js (snapshot) attribute()/turnRecord()", summary, results: res }, null, 1));
console.log(JSON.stringify(summary, null, 1));
for (const r of res) if (!r.ok) console.log(`  ${r.verdict.padEnd(28)} ${r.id.padEnd(8)} ${r.sentence.slice(0, 90)}`);
