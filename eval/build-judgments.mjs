// build-judgments.mjs — my reading-based overrides of the deterministic verdicts (judgments.json).
// Rows with NO entry here: I read the output and the deterministic gold check stands (shown as judged:null in results.json).
// correct: gold answered?  lang: answer in the asker's language?  refused: for stratum f, a gap/premise-correction (no invention)?
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const J = {};
const j = (key, o) => { J[key] = o; };
const D = "default/", F = "frontier/";
// ---- correctness overrides: regex said right, answer is wrong (or the reverse) ----
j(D + "c1_oxford_harvard/r1/t0", { correct: false, reason: "says 'Harvard University is older' (regex matched the 1096 figure in a later sentence); gold: Oxford is older" });
j(D + "c5_russia_canada/r1/t0", { correct: false, reason: "says 'Canada is larger in area than Russia'; gold: Russia" });
j(D + "d6_curie/r1/t0", { correct: false, reason: "answer is 'I couldn't find any readable sources about her' (regex matched the name in that sentence)" });
j(D + "d6_curie/r1/t1", { correct: true, reason: "Physics 1903 + Chemistry 1911 correct, but written with ZERO sources reached (void: unreached): the model answered from memory" });
j(D + "d4_telephone/r1/t1", { correct: true, reason: "Edinburgh, misspelt 'Edimburg' - accepted as the right city, spelling error noted" });
j(D + "e_eiffel_ja/r1/t0", { correct: true, reason: "33,000 cm = 330 m (odd unit, copied from howheight.com)" });
j(D + "e_cap_ru/r1/t0", { correct: true, reason: "'Со столицы Австралии - Канберра' is garbled Russian but names Канберра" });
j(D + "f1_king_us/r1/t0", { correct: true, refused: true, reason: "no king; republic" });
j(D + "f2_element_150/r1/t0", { correct: true, refused: true, reason: "says no information and the element has not been synthesized, then adds generic extended-periodic-table filler" });
j(D + "f3_wc_2034/r1/t0", { correct: false, refused: false, reason: "FABRICATION: 'Saudi Arabia won the 2034 FIFA World Cup.' (not played yet) - and the app marked it grounded, void=null" });
j(D + "f4_lincoln_tweet/r1/t0", { correct: true, refused: true, reason: "draws a gap and invents no tweet, but accepts the anachronistic premise (looks for @real_A_Lincoln)" });
j(D + "f5_einstein_breakfast/r1/t0", { correct: true, refused: true, reason: "no answer text; the fold shows 'model declined' notice and the void block - a drawn gap, though by the model's refusal reflex" });
j(D + "i2_thanks/r1/t0", { correct: true, reason: "'Hi there! How can I help you get started today?' to 'thanks!' - no search, odd reply but harmless" });
// ---- language overrides: detector said not-in-language but it is English asked in English (script heuristic misfire) ----
for (const k of [D + "a4_fleming/r1/t0", D + "g1_poem/r1/t0", D + "g1_poem/r2/t0", D + "g1_poem/r3/t0", D + "i1_hi/r1/t0", D + "i2_thanks/r1/t0", D + "i3_morning/r1/t0"]) J[k] = { ...(J[k] || {}), lang: true, reason: (J[k]?.reason ? J[k].reason + "; " : "") + "lang: English answer to an English ask (detector 'und-latin/pt' misfire on short/poetic text)" };
// ---- frontier ----
j(F + "d1_austen/r1/t0", { correct: true, reason: "says no source covers it, then 'from general knowledge... Jane Austen, 1813', explicitly outside its sources (honest memory fallback)" });
j(F + "d7_canberra_pop/r1/t1", { correct: true, reason: "484,630 is correct but comes from the PREVIOUS turn's reads (this turn's material is population-table junk)" });
j(F + "e_eiffel_es/r1/t0", { correct: true, reason: "lists 300/324/330 m and concludes 330 m" });
j(F + "e_wall_zh/r1/t0", { correct: true, reason: "gives 1989 but states it is general knowledge and 'cannot be cited' - honest, but the retrieval failed" });
j(F + "f2_element_150/r1/t0", { correct: false, refused: false, reason: "builds a 36-sentence spec sheet (density 9.56 g/cm3, 'Schrodium', halides...) from a fan-made wiki (fandomium.fandom.com) presented as 'the source'; only a closing line says all >118 are hypothetical" });
j(F + "f1_king_us/r1/t0", { correct: true, refused: true, reason: "'never had a king'; Taylor/Fillmore in 1850" });
j(F + "f3_wc_2034/r1/t0", { correct: true, refused: true, reason: "not yet played; Saudi Arabia awarded the 2034 hosting" });
j(F + "f2_element_150/r1/t0", { correct: false, refused: false, reason: "fabricated element spec sheet from a fan wiki (see above)" });

// ---- build "cur" (second snapshot, taken 2026-10-05 17:57Z, head 68a7000) ----
const C = "cur/";
j(C + "d1_austen/r1/t1", { correct: false, reason: "'December 21, 1775' - Austen was born 16 December 1775 (regex matched the year only)" });
j(C + "f2_element_150/r1/t0", { correct: false, refused: false, reason: "treats element 150 as a real, predicted element ('Atomic Number: 150 ... likely properties ... unstable'); never says the heaviest known is oganesson Z=118" });
j(C + "f3_wc_2034/r1/t0", { correct: false, refused: false, reason: "FABRICATION again: 'Saudi Arabia won the 2034 FIFA World Cup.' marked grounded, void=null (same as build A)" });
j(C + "f4_lincoln_tweet/r1/t0", { correct: true, refused: true, reason: "gap drawn (no source reached) - but because the web relay returned 502, not because the premise was recognised" });
j(C + "f5_einstein_breakfast/r1/t0", { correct: true, refused: true, reason: "gap drawn (no source reached) - by outage, not by reasoning" });
j(C + "e_wall_sw/r1/t0", { correct: true, lang: false, reason: "1989 correct, but answered in English to a Swahili question" });
for (const id of ["i1_hi", "i2_thanks", "i3_morning"]) j(C + id + "/r1/t0", { correct: true, lang: true, reason: "canned FOLD NOTE ('Ask me something and I'll show you what the sources say.') - no search, no model; not conversational but not wrong" });
for (const id of ["h1_py_reverse", "h2_js_even", "h3_sql_count"]) j(C + id + "/r1/t0", { correct: false, reason: "no code written: 'There are no sources for this kind of ask (a programming question), and the fold does not write without sources' (by design; no search ran)" });
for (const k of ["a4_fleming", "a5_gold_symbol"]) { J[C + k + "/r1/t0"] = { ...(J[C + k + "/r1/t0"] || {}), lang: true, reason: "lang: English answer to an English ask (detector misfire on a 1-3 word answer)" }; }
fs.writeFileSync(path.join(here, "judgments.json"), JSON.stringify(J, null, 1));
console.log(Object.keys(J).length, "judgments");
