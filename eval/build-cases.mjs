// build-cases.mjs — writes eval/cases.json. Kept as code so the multilingual
// block (same fact x 11 languages) is generated from one table and reviewed in
// one place. Every gold fact below was checked against Wikipedia (en) by curl on
// 2026-10-05; the page that states it is in `gold.urls`.
//
//   node eval/build-cases.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const W = (t) => "https://en.wikipedia.org/wiki/" + t;

const cases = [];
// check kinds (all evaluated by score.mjs against the answer BODY, i.e. without the appended void note):
//   {re:[...]}            any regex matches (case-insens, unicode)
//   {nums:[[lo,hi],...]}  any number in the answer falls in any range (thousand separators normalised)
//   {all:[re,...]}        every regex must match
// `reject` regexes: if any matches, the answer is wrong even when a check matched.
const add = (c) => cases.push({ frontier: false, repeat: false, expect: { search: true, void: null }, ...c });

/* ---------------- (a) single-fact lookups ---------------- */
add({ id: "a1_eiffel_year", stratum: "a_single", turns: ["In what year was the Eiffel Tower completed?"],
  rationale: "Plain dated fact in the lead of the most-read tower article; the easiest retrieval case.",
  gold: { answer: "1889 (31 March 1889)", checks: [{ turn: 0, nums: [[1889, 1889]] }], urls: [W("Eiffel_Tower")], fact: "Eiffel Tower main structure completed end of March 1889 (31 March 1889 ceremony)." },
  topic: "eiffel", frontier: true });
add({ id: "a2_austen", stratum: "a_single", turns: ["Who wrote Pride and Prejudice?"],
  rationale: "Name lookup; answer is the first sentence of the novel's article.",
  gold: { answer: "Jane Austen", checks: [{ turn: 0, re: ["Jane Austen"] }], urls: [W("Pride_and_Prejudice")], fact: "Pride and Prejudice is a novel by English author Jane Austen." },
  topic: "pride|austen", frontier: true, repeat: true });
add({ id: "a3_apollo_date", stratum: "a_single", turns: ["On what date did Apollo 11 land on the Moon?"],
  rationale: "Date with month/day/year; tests date normalisation (July 20 / 20 July, 1969).",
  gold: { answer: "20 July 1969", checks: [{ turn: 0, all: ["\\b20\\b", "1969"] }], urls: [W("Apollo_11")], fact: "Eagle landed in the Sea of Tranquility on July 20 (1969) at 20:17 UTC." },
  topic: "apollo", frontier: false });
add({ id: "a4_fleming", stratum: "a_single", turns: ["Who discovered penicillin?"],
  rationale: "Name lookup with a well-known but non-trivial attribution (Fleming 1928).",
  gold: { answer: "Alexander Fleming (1928)", checks: [{ turn: 0, re: ["Fleming"] }], urls: [W("Alexander_Fleming"), W("Penicillin")], fact: "Fleming's 1928 discovery of benzylpenicillin from Penicillium rubens." },
  topic: "fleming|penicillin", frontier: true });
add({ id: "a5_gold_symbol", stratum: "a_single", turns: ["What is the chemical symbol for gold?"],
  rationale: "Two-letter answer; checks tokens shorter than the grounding gate's 4-char 'substantive' threshold.",
  gold: { answer: "Au", checks: [{ turn: 0, re: ["\\bAu\\b"] }], urls: [W("Gold")], fact: "Gold's chemical symbol is Au (from Latin aurum), atomic number 79." },
  topic: "^gold|/wiki/gold" });
add({ id: "a6_mona_lisa", stratum: "a_single", turns: ["Who painted the Mona Lisa?"],
  rationale: "Name lookup, multi-token name (Leonardo da Vinci) with a lowercase particle.",
  gold: { answer: "Leonardo da Vinci", checks: [{ turn: 0, re: ["Leonardo"] }], urls: [W("Mona_Lisa")], fact: "Mona Lisa is a half-length portrait painting by the Italian artist Leonardo da Vinci." },
  topic: "mona|leonardo" });

/* ---------------- (b) numeric / unit conversion ---------------- */
add({ id: "b1_eiffel_feet", stratum: "b_numeric", turns: ["How tall is the Eiffel Tower in feet?"],
  rationale: "Defect seed (2). Source states 330 m (1,083 ft); a model may restate or convert, e.g. 1,082.68. Any value in the 1063-1083 ft range is correct (1,063 ft is the older published height).",
  gold: { answer: "about 1,083 ft (330 m)", checks: [{ turn: 0, nums: [[1060, 1090]] }], urls: [W("Eiffel_Tower")], fact: "The tower is 330 metres (1,083 ft) tall." },
  topic: "eiffel", frontier: true, repeat: true });
add({ id: "b2_everest_m", stratum: "b_numeric", turns: ["How tall is Mount Everest in metres?"],
  rationale: "Decimal measured value (8,848.86 m, 2020 survey); the claim gate must accept '8,848.86' or a rounded 8,849/8,848.",
  gold: { answer: "8,848.86 m (2020 survey)", checks: [{ turn: 0, nums: [[8840, 8850]] }], urls: [W("Mount_Everest")], fact: "Height most recently measured in 2020 as 8,848.86 m (29,031 ft 8.5 in)." },
  topic: "everest", frontier: true });
add({ id: "b3_mariana_ft", stratum: "b_numeric", turns: ["How deep is the Mariana Trench in feet?"],
  rationale: "Source gives metres first (10,935 m) then feet (35,876 ft); several surveys disagree (35,760-35,876) so a range is gold.",
  gold: { answer: "about 36,000 ft (35,876 ft / 10,935 m)", checks: [{ turn: 0, nums: [[35700, 36100]] }], urls: [W("Mariana_Trench")], fact: "Maximum known depth 10,935 +/- 6 m (35,876 +/- 20 ft)." },
  topic: "mariana|challenger" });
add({ id: "b4_iceland_pop", stratum: "b_numeric", turns: ["What is the population of Iceland?"],
  rationale: "Rounded, time-varying figure; gold is a range (380k-410k) around the ~395,000 the article gives.",
  gold: { answer: "about 395,000", checks: [{ turn: 0, nums: [[380000, 410000], [380, 410]] }], urls: [W("Iceland")], fact: "'roughly 395,000 residents' (Iceland article, 2026-10-05)." },
  topic: "iceland" });
add({ id: "b5_light_kms", stratum: "b_numeric", turns: ["What is the speed of light in kilometres per second?"],
  rationale: "Pure unit conversion: source states 299,792,458 metres per second; the question asks km/s. Tests derived-number handling.",
  gold: { answer: "about 299,792 km/s (~300,000)", checks: [{ turn: 0, nums: [[299000, 300100]] }], urls: [W("Speed_of_light")], fact: "299,792,458 metres per second." },
  topic: "speed of light|light", frontier: true });
add({ id: "b6_danube_mi", stratum: "b_numeric", turns: ["How long is the Danube in miles?"],
  rationale: "Source gives 2,850 km (1,770 mi); tests whether the miles figure survives or is re-converted wrongly.",
  gold: { answer: "about 1,770 miles (2,850 km)", checks: [{ turn: 0, nums: [[1740, 1790]] }], urls: [W("Danube")], fact: "The Danube flows southeast for 2,850 km (1,770 mi)." },
  topic: "danube" });

/* ---------------- (c) multi-hop / comparison ---------------- */
add({ id: "c1_oxford_harvard", stratum: "c_multihop", turns: ["Which is older, Harvard University or the University of Oxford?"],
  rationale: "Two entities, one comparison; Oxford (teaching since 1096) vs Harvard (1636).",
  gold: { answer: "Oxford is older", checks: [{ turn: 0, re: ["Oxford (is|was)[^.]{0,40}older", "Oxford[^.]{0,60}(older|oldest|earlier|first)", "older[^.]{0,40}Oxford", "1096"] }], reject: ["Harvard (is|was)[^.]{0,30}older than"], urls: [W("University_of_Oxford"), W("Harvard_University")], fact: "Oxford: teaching since 1096; Harvard founded 1636." },
  topic: "oxford|harvard", frontier: true, repeat: true });
add({ id: "c2_eiffel_liberty", stratum: "c_multihop", turns: ["Which is taller, the Eiffel Tower or the Statue of Liberty?"],
  rationale: "Comparison where the two figures live in two different articles (330 m vs the statue's 46 m / 93 m with pedestal).",
  gold: { answer: "Eiffel Tower is taller", checks: [{ turn: 0, re: ["Eiffel Tower (is|stands|was)[^.]{0,30}taller", "Eiffel[^.]{0,60}(taller|higher)", "(taller|higher)[^.]{0,30}Eiffel"] }], reject: ["Statue of Liberty (is|stands|was)[^.]{0,30}taller"], urls: [W("Eiffel_Tower"), W("Statue_of_Liberty")], fact: "Eiffel 330 m; Statue of Liberty ~46 m (statue) / 93 m (with pedestal)." },
  topic: "eiffel|liberty", frontier: true });
add({ id: "c3_danube_rhine", stratum: "c_multihop", turns: ["Which is longer, the Danube or the Rhine?"],
  rationale: "Comparison; Danube 2,850 km vs Rhine ~1,230 km.",
  gold: { answer: "The Danube is longer", checks: [{ turn: 0, re: ["Danube (is|was)[^.]{0,30}longer", "Danube[^.]{0,80}(longer|longest)", "longer[^.]{0,30}Danube"] }], reject: ["Rhine (is|was)[^.]{0,30}longer than"], urls: [W("Danube"), W("Rhine")], fact: "Danube 2,850 km; Rhine about 1,230 km." },
  topic: "danube|rhine" });
add({ id: "c4_galileo_newton", stratum: "c_multihop", turns: ["Who was born first, Isaac Newton or Galileo Galilei?"],
  rationale: "Comparison of two birth dates in two articles (1564 vs 1643).",
  gold: { answer: "Galileo (1564) before Newton (1643)", checks: [{ turn: 0, re: ["Galileo[^.]{0,60}(first|earlier|older|1564)", "1564[^.]{0,80}Galileo", "Galileo (was|is)[^.]{0,30}born first"] }], reject: ["Newton (was|is)[^.]{0,30}born first"], urls: [W("Galileo_Galilei"), W("Isaac_Newton")], fact: "Galileo 15 Feb 1564; Newton 4 Jan 1643." },
  topic: "galileo|newton" });
add({ id: "c5_russia_canada", stratum: "c_multihop", turns: ["Which is larger by area, Russia or Canada?"],
  rationale: "Comparison across two articles; Russia is the largest country, Canada 9,984,670 km2.",
  gold: { answer: "Russia is larger", checks: [{ turn: 0, re: ["Russia (is|was)[^.]{0,30}larger", "Russia[^.]{0,80}(larger|largest)", "larger[^.]{0,30}Russia"] }], reject: ["Canada (is|was)[^.]{0,30}larger than Russia"], urls: [W("Russia"), W("Canada")], fact: "Russia is the largest country in the world; Canada 9,984,670 km2." },
  topic: "russia|canada" });
add({ id: "c6_apple_founders", stratum: "c_multihop", turns: ["Who founded the company that makes the iPhone, and in what year?"],
  rationale: "True multi-hop: iPhone -> Apple -> founders + year. Needs the entity the question never names.",
  gold: { answer: "Steve Jobs, Steve Wozniak (and Ronald Wayne), 1976", checks: [{ turn: 0, all: ["Jobs", "1976"] }], urls: [W("Apple_Inc.")], fact: "Founded in 1976 as Apple Computer Company by Steve Jobs, Steve Wozniak and Ronald Wayne." },
  topic: "apple|iphone", frontier: true });
add({ id: "c7_eiffel_country_capital", stratum: "c_multihop", turns: ["What is the capital of the country where the Eiffel Tower is located?"],
  rationale: "Two hops (Eiffel -> France -> capital) with the middle entity unstated.",
  gold: { answer: "Paris", checks: [{ turn: 0, re: ["Paris"] }], urls: [W("Eiffel_Tower"), W("France"), W("Paris")], fact: "Eiffel Tower is in Paris, France; Paris is the capital of France." },
  topic: "france|paris|eiffel" });

/* ---------------- (d) pronoun / ellipsis follow-ups ---------------- */
add({ id: "d1_austen", stratum: "d_followup", turns: ["Who wrote Pride and Prejudice?", "When was she born?", "Where did she die?"],
  rationale: "Defect seed (1). Feminine pronoun, then a bare 'where did she die' — no entity string in the follow-up turns at all.",
  gold: { answer: "Jane Austen; 16 Dec 1775; Winchester", checks: [{ turn: 0, re: ["Jane Austen"] }, { turn: 1, re: ["1775"] }, { turn: 2, re: ["Winchester"] }], urls: [W("Jane_Austen")], fact: "Jane Austen (16 December 1775 - 18 July 1817); died in Winchester." },
  topic: ["pride|austen", "austen", "austen"], frontier: true });
add({ id: "d2_mona_lisa", stratum: "d_followup", turns: ["Who painted the Mona Lisa?", "When did he die?"],
  rationale: "Masculine pronoun; the person was named only in the previous ANSWER.",
  gold: { answer: "Leonardo; 2 May 1519", checks: [{ turn: 0, re: ["Leonardo"] }, { turn: 1, re: ["1519"] }], urls: [W("Leonardo_da_Vinci")], fact: "Leonardo (15 April 1452 - 2 May 1519)." },
  topic: ["mona|leonardo", "leonardo"], frontier: true, repeat: true });
add({ id: "d3_everest", stratum: "d_followup", turns: ["How tall is Mount Everest?", "Which mountain range is it in?", "And who first climbed it?"],
  rationale: "Thing-pronoun 'it' twice, and an 'And ...' ellipsis.",
  gold: { answer: "8,848.86 m; Himalayas (Mahalangur Himal); Hillary & Tenzing 1953", checks: [{ turn: 0, nums: [[8840, 8850], [29020, 29035]] }, { turn: 1, re: ["Himalaya", "Mahalangur"] }, { turn: 2, re: ["Hillary", "Tenzing"] }], urls: [W("Mount_Everest")], fact: "Mahalangur Himal sub-range of the Himalayas; first documented ascent by Tenzing Norgay and Edmund Hillary in 1953." },
  topic: ["everest", "everest|himalaya", "everest|hillary|tenzing"] });
add({ id: "d4_telephone", stratum: "d_followup", turns: ["Who invented the telephone?", "Where was he born?"],
  rationale: "Pronoun follow-up on a (conventionally) attributed inventor; gold per Wikipedia: Alexander Graham Bell, born Edinburgh.",
  gold: { answer: "Alexander Graham Bell; Edinburgh", checks: [{ turn: 0, re: ["Bell"] }, { turn: 1, re: ["Edinburgh"] }], urls: [W("Alexander_Graham_Bell")], fact: "Bell was born in Edinburgh, Scotland, on March 3, 1847." },
  topic: ["telephone|bell", "bell"] });
add({ id: "d5_armstrong_age", stratum: "d_followup", turns: ["Who was the first person to walk on the Moon?", "How old was he at the time?"],
  rationale: "Pronoun AND a computed answer (born 5 Aug 1930, landed 20 Jul 1969 -> 38). Article II.3: a model may phrase but not originate a number.",
  gold: { answer: "Neil Armstrong; 38", checks: [{ turn: 0, re: ["Armstrong"] }, { turn: 1, nums: [[38, 38]] }], urls: [W("Neil_Armstrong"), W("Apollo_11")], fact: "Armstrong born August 5, 1930; Apollo 11 landing July 20, 1969 -> 38 years old." },
  topic: ["moon|armstrong|apollo", "armstrong"], frontier: true, repeat: true });
add({ id: "d6_curie", stratum: "d_followup", turns: ["Tell me about Marie Curie.", "Which Nobel Prizes did she win?", "Where was she born?"],
  rationale: "Open-ended opener, then two pronoun questions with different expected sources.",
  gold: { answer: "Physics 1903, Chemistry 1911; born in Warsaw", checks: [{ turn: 0, re: ["Curie"] }, { turn: 1, all: ["1903", "1911"] }, { turn: 2, re: ["Warsaw", "Warszawa"] }], urls: [W("Marie_Curie")], fact: "Shared the 1903 Nobel Prize in Physics; won the 1911 Nobel Prize in Chemistry; born in Warsaw." },
  topic: ["curie", "curie", "curie"] });
add({ id: "d7_canberra_pop", stratum: "d_followup", turns: ["What is the capital of Australia?", "And its population?"],
  rationale: "Pure ellipsis ('And its population?'): no verb, no entity.",
  gold: { answer: "Canberra; ~485,000 (2025 est.; 2021 census 453,558)", checks: [{ turn: 0, re: ["Canberra"] }, { turn: 1, nums: [[430000, 500000], [430, 500]] }], urls: [W("Canberra")], fact: "Canberra's estimated population 484,630 as of 2025." },
  topic: ["australia|canberra", "canberra"], frontier: true });

/* ---------------- (e) multilingual: SAME 3 facts x 11 languages ---------------- */
const LANGS = ["en", "es", "fr", "de", "pt", "ru", "ar", "zh", "ja", "hi", "sw"];
const Q = {
  eiffel: { en: "How tall is the Eiffel Tower?", es: "¿Qué altura tiene la Torre Eiffel?", fr: "Quelle est la hauteur de la tour Eiffel ?", de: "Wie hoch ist der Eiffelturm?", pt: "Qual é a altura da Torre Eiffel?", ru: "Какова высота Эйфелевой башни?", ar: "كم يبلغ ارتفاع برج إيفل؟", zh: "埃菲尔铁塔有多高？", ja: "エッフェル塔の高さはどれくらいですか？", hi: "एफ़िल टॉवर कितना ऊँचा है?", sw: "Mnara wa Eiffel una urefu gani?" },
  wall: { en: "In what year did the Berlin Wall fall?", es: "¿En qué año cayó el Muro de Berlín?", fr: "En quelle année le mur de Berlin est-il tombé ?", de: "In welchem Jahr fiel die Berliner Mauer?", pt: "Em que ano caiu o Muro de Berlim?", ru: "В каком году пала Берлинская стена?", ar: "في أي عام سقط جدار برلين؟", zh: "柏林墙是哪一年倒塌的？", ja: "ベルリンの壁はいつ崩壊しましたか？", hi: "बर्लिन की दीवार किस वर्ष गिरी थी?", sw: "Ukuta wa Berlin ulianguka mwaka gani?" },
  cap: { en: "What is the capital of Australia?", es: "¿Cuál es la capital de Australia?", fr: "Quelle est la capitale de l'Australie ?", de: "Was ist die Hauptstadt von Australien?", pt: "Qual é a capital da Austrália?", ru: "Какая столица Австралии?", ar: "ما هي عاصمة أستراليا؟", zh: "澳大利亚的首都是哪里？", ja: "オーストラリアの首都はどこですか？", hi: "ऑस्ट्रेलिया की राजधानी क्या है?", sw: "Mji mkuu wa Australia ni upi?" },
};
const CANBERRA = { en: "Canberra", es: "Canberra", fr: "Canberra", de: "Canberra", pt: "Canberra", sw: "Canberra", ru: "Канберр", ar: "كانبرا|كانبيرا", zh: "堪培拉", ja: "キャンベラ", hi: "कैनबरा|कैनबेरा|कैनबरा" };
const FRONT = new Set(["eiffel:es", "eiffel:ru", "eiffel:zh", "eiffel:ar", "eiffel:ja", "wall:zh", "wall:hi", "cap:ru", "cap:ar"]);
const REP = new Set(["eiffel:zh", "cap:ru", "wall:ar"]);
for (const L of LANGS) {
  add({ id: `e_eiffel_${L}`, stratum: "e_multilingual", lang: L, fact: "eiffel", turns: [Q.eiffel[L]],
    rationale: `Same fact (Eiffel Tower height) asked in ${L}. Gold: 330 m / 1,083 ft (older 324 m / 1,063 ft); metre, feet or km figures all accepted.`,
    gold: { answer: "330 m / 1,083 ft", checks: [{ turn: 0, nums: [[324, 330], [1063, 1083], [0.324, 0.330]] }], urls: [W("Eiffel_Tower")], fact: "The tower is 330 metres (1,083 ft) tall." },
    topic: "eiffel", frontier: FRONT.has("eiffel:" + L), repeat: REP.has("eiffel:" + L) });
  add({ id: `e_wall_${L}`, stratum: "e_multilingual", lang: L, fact: "wall", turns: [Q.wall[L]],
    rationale: `Same fact (year the Berlin Wall fell) asked in ${L}. Language-independent gold token: 1989.`,
    gold: { answer: "1989 (9 November 1989)", checks: [{ turn: 0, nums: [[1989, 1989]] }], urls: [W("Berlin_Wall")], fact: "East German government announced on 9 November 1989 that all GDR citizens could visit the FRG and West Berlin." },
    topic: "berlin", frontier: FRONT.has("wall:" + L), repeat: REP.has("wall:" + L) });
  add({ id: `e_cap_${L}`, stratum: "e_multilingual", lang: L, fact: "cap", turns: [Q.cap[L]],
    rationale: `Same fact (capital of Australia) asked in ${L}. Gold: Canberra, in the asker's script.`,
    gold: { answer: "Canberra", checks: [{ turn: 0, re: [CANBERRA[L]] }], urls: [W("Canberra")], fact: "Canberra is the capital city of Australia." },
    topic: "canberra|australia", frontier: FRONT.has("cap:" + L), repeat: REP.has("cap:" + L) });
}

/* ---------------- (f) not retrievable / false premise: correct = a drawn gap ---------------- */
const refuseExpect = { search: true, void: null, refuse: true };
add({ id: "f1_king_us", stratum: "f_gap", turns: ["Who was the king of the United States in 1850?"], expect: refuseExpect,
  rationale: "False premise: the US has never had a king (13th president Millard Fillmore took office in 1850). Correct = say there was no king.",
  gold: { answer: "No king; the US is a republic (President Fillmore in 1850)", checks: [], urls: [W("Millard_Fillmore")], fact: "Fillmore: 13th president, serving from 1850 to 1853." },
  fabrication: ["\\bKing [A-Z][a-z]+ (of|I|II|III|IV|V)\\b.{0,40}(United States|America)", "the king of the United States (was|in 1850 was) [A-Z]"], frontier: true, repeat: true });
add({ id: "f2_element_150", stratum: "f_gap", turns: ["What are the properties of the chemical element with atomic number 150?"], expect: refuseExpect,
  rationale: "False premise: the heaviest known element is oganesson, Z=118; no element 150 has been observed.",
  gold: { answer: "No such element is known (heaviest is oganesson, Z=118)", checks: [], urls: [W("Oganesson")], fact: "Oganesson: symbol Og, atomic number 118, first synthesized in 2002; the heaviest known." },
  fabrication: ["element 150[^.]{0,40}(is|has|melts|boils) (a|an|the) ?(solid|liquid|gas|metal|noble)"], frontier: true });
add({ id: "f3_wc_2034", stratum: "f_gap", turns: ["Who won the 2034 FIFA World Cup?"], expect: refuseExpect,
  rationale: "Future event: the 2034 World Cup has not happened (today is 2026-10-05). Wikipedia: 'will be the 25th FIFA World Cup'; Saudi Arabia host.",
  gold: { answer: "It has not been played yet", checks: [], urls: [W("2034_FIFA_World_Cup")], fact: "The 2034 FIFA World Cup will be the 25th FIFA World Cup; Saudi Arabia confirmed host December 2024." },
  fabrication: ["won the 2034 (FIFA )?World Cup", "(Brazil|France|Argentina|Germany|Spain|England|Saudi Arabia) (won|are the champions|were the champions)"], frontier: true });
add({ id: "f4_lincoln_tweet", stratum: "f_gap", turns: ["What did Abraham Lincoln tweet on his last birthday?"], expect: refuseExpect,
  rationale: "Anachronistic premise: Lincoln died 1865, Twitter founded 2006.",
  gold: { answer: "Lincoln never tweeted (Twitter did not exist)", checks: [], urls: [W("Abraham_Lincoln")], fact: "Lincoln was assassinated in April 1865." },
  fabrication: ["Lincoln tweeted[^.]{0,5}[:\"“]", "tweet(ed)?[^.]{0,30}[\"“][^\"”]{10,}[\"”]"] });
add({ id: "f5_einstein_breakfast", stratum: "f_gap", turns: ["What did Albert Einstein eat for breakfast on 14 March 1950?"], expect: refuseExpect,
  rationale: "Unknowable private detail: no source records it; correct = a gap, not a menu.",
  gold: { answer: "Not recorded anywhere retrievable", checks: [], urls: [W("Albert_Einstein")], fact: "No such record exists." },
  fabrication: ["(ate|had|ate for breakfast|eating)[^.]{0,40}(eggs|toast|porridge|oatmeal|coffee|bread|cheese|bacon)"] });

/* ---------------- (g) creative / generative: no web search, no void, no fake sources ---------------- */
const noSearch = { search: false, void: false, sources: 0 };
add({ id: "g1_poem", stratum: "g_creative", turns: ["Write a short poem about autumn rain."], expect: noSearch,
  rationale: "Defect seed (3). A poem needs no facts; correct = writes it, no search, no void note, no sources panel.",
  gold: { answer: "A poem of at least 4 lines", checks: [{ turn: 0, minLines: 4 }], urls: [], fact: "n/a (generative)" }, frontier: true, repeat: true });
add({ id: "g2_story", stratum: "g_creative", turns: ["Write a very short story (about 80 words) about a robot who learns to paint."], expect: noSearch,
  rationale: "Generative prose; should not be sent to Wikipedia/GitHub/OpenAlex.",
  gold: { answer: "A story of 40-200 words", checks: [{ turn: 0, minWords: 40 }], urls: [], fact: "n/a (generative)" } });
add({ id: "g3_haiku", stratum: "g_creative", turns: ["Compose a haiku about the sea."], expect: noSearch,
  rationale: "Tiny generative request.",
  gold: { answer: "A three-line haiku", checks: [{ turn: 0, minLines: 3 }], urls: [], fact: "n/a (generative)" } });

/* ---------------- (h) code ---------------- */
add({ id: "h1_py_reverse", stratum: "h_code", turns: ["Write a python function that reverses the words in a sentence."], expect: noSearch,
  rationale: "Code request; correct = a working function, no web search. Scored by EXECUTING the first python block on 'the quick brown fox'.",
  gold: { answer: "def f(s): return ' '.join(s.split()[::-1])", checks: [{ turn: 0, python: { call: "the quick brown fox", expect: "fox brown quick the" } }], urls: [], fact: "n/a (code)" }, frontier: true });
add({ id: "h2_js_even", stratum: "h_code", turns: ["In JavaScript, how do I check whether a number is even?"], expect: noSearch,
  rationale: "Code question phrased as 'how do I'; the discourse classifier may route 'how ...' to research.",
  gold: { answer: "n % 2 === 0", checks: [{ turn: 0, re: ["%\\s*2\\s*(===?|!==?)\\s*[01]", "&\\s*1"] }], urls: [], fact: "n/a (code)" } });
add({ id: "h3_sql_count", stratum: "h_code", turns: ["Write a SQL query that counts the rows in a table called users."], expect: noSearch,
  rationale: "Code request.",
  gold: { answer: "SELECT COUNT(*) FROM users;", checks: [{ turn: 0, re: ["SELECT\\s+COUNT\\s*\\(\\s*(\\*|1|\\w+)\\s*\\)\\s+FROM\\s+users"] }], urls: [], fact: "n/a (code)" } });

/* ---------------- (i) smalltalk ---------------- */
add({ id: "i1_hi", stratum: "i_smalltalk", turns: ["hi"], expect: { search: false, void: false, sources: 0 },
  rationale: "Greeting; correct = a greeting back with no search and no grounding record.", gold: { answer: "any greeting", checks: [{ turn: 0, minWords: 1 }], urls: [], fact: "n/a" }, frontier: true });
add({ id: "i2_thanks", stratum: "i_smalltalk", turns: ["thanks!"], expect: { search: false, void: false, sources: 0 },
  rationale: "Thank-you; no search.", gold: { answer: "any acknowledgement", checks: [{ turn: 0, minWords: 1 }], urls: [], fact: "n/a" } });
add({ id: "i3_morning", stratum: "i_smalltalk", turns: ["good morning"], expect: { search: false, void: false, sources: 0 },
  rationale: "Greeting variant in the SMALLTALK_RE.", gold: { answer: "any greeting", checks: [{ turn: 0, minWords: 1 }], urls: [], fact: "n/a" } });

fs.writeFileSync(path.join(here, "cases.json"), JSON.stringify({
  meta: { built: new Date().toISOString(), goldVerifiedAgainst: "en.wikipedia.org via curl, 2026-10-05", strata: [...new Set(cases.map((c) => c.stratum))], n: cases.length, langs: LANGS },
  cases,
}, null, 1));
const by = {}; for (const c of cases) by[c.stratum] = (by[c.stratum] || 0) + 1;
console.log(cases.length, "cases", by, "frontier:", cases.filter((c) => c.frontier).length, "repeat:", cases.filter((c) => c.repeat).length);
