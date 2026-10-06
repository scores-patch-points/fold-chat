// fold-chat-lang.js — which language a person wrote in, and whether the reply
// is in it. Pure: no DOM, no IO, no model.
//
// The app answers in the asker's language (docs/NEXT-ARCHITECTURE.md: "Answer in
// the asker's language"). Retrieval may cross languages; the MOUTH voices in the
// asker's. A small local model handed English sources answers in English no
// matter what the question was written in (measured 2026-10-05: es, fr, de asks
// answered or refused in English), so the app does three things:
//   1. names the language in the system prompt (`languageInstruction`),
//   2. measures the reply's language with the SAME detector as the question's
//      (`sameLanguage`), and
//   3. when they differ, asks the model to restate its own reply in the asker's
//      language (`restateMessages`) and checks again; if it still differs the
//      fold says so (a typed note), it does not pretend.
//
// HOW IT DETECTS (no model, no network):
//   • A NON-LATIN script is a language family by itself (Han → zh, Kana → ja,
//     Hangul → ko, Cyrillic → ru, Arabic → ar, Devanagari → hi, …). scriptOf
//     comes from fold-chat-mind.js (letter-count dominant script).
//   • LATIN script is split by a small DECLARED signature per language: the
//     function words each language uses most (STOP) plus orthographic marks
//     (¿ ¡ ñ → es, ß → de, ç ã õ → pt, œ → fr …). The best score wins only when
//     it has at least MIN_HITS evidence and beats the runner-up; otherwise the
//     language is "unknown" and NOTHING is restated (the safe default: never
//     rewrite an answer on a coin-flip).
//
// WHAT IS MEASURED vs DECLARED (Constitution II.11): the stopword lists are
// DECLARED vocabulary (the most frequent function words of each language, typed
// here, no giver but the language); MIN_HITS and MARGIN are DECLARED defaults
// whose effect was measured on the labelled sample in fold-chat-lang.test.mjs
// (see the note there), not derived from data.

import { scriptOf } from "../../../fold-chat-mind.js";

export const DECLARED = Object.freeze({
  // Latin-script evidence needed before a language is named: two function words
  // (or one orthographic mark plus one function word).
  minHits: 2,
  // The winner must lead the runner-up by this many hits.
  margin: 1,
  // A reply shorter than this many letters is never judged (a one-word answer
  // has no language signature).
  minReplyLetters: 24,
});

export const LANG_NAMES = Object.freeze({
  en: "English", es: "Spanish", fr: "French", de: "German", pt: "Portuguese", it: "Italian", nl: "Dutch",
  ru: "Russian", uk: "Ukrainian", zh: "Chinese", ja: "Japanese", ko: "Korean", ar: "Arabic", he: "Hebrew", hi: "Hindi", th: "Thai", el: "Greek",
});

const SCRIPT_LANG = { Han: "zh", Japanese: "ja", Hangul: "ko", Cyrillic: "ru", Arabic: "ar", Hebrew: "he", Devanagari: "hi", Thai: "th", Greek: "el" };

// function words, folded to lower case WITH diacritics kept (they carry evidence)
const STOP = {
  en: "the of and to in is are was were what who how when where why which that this with for from it you your do does did can will would should there their they have has be been not but or on at as by an about tell give my i".split(" "),
  es: "el la los las de del que qué cuál cuáles cómo cuándo dónde quién por para con una un es son está están fue era y en no se su sus al lo como más pero sobre me mi mis tengo puedo hay muy también quiero dame háblame hablame consejos aprender tocar mejor ser tiene tienen puede hacer sin entre cada todo todos".split(" "),
  fr: "le la les des du de un une est sont était et en que qui quoi quel quelle quels comment quand où pourquoi pour avec dans sur ne pas ce cette ces il elle nous vous je mon ma mes au aux plus mais ou donc très aussi puis parle donne conseils veux apprendre mieux être avoir peut faire sans entre chaque tout tous moi toi".split(" "),
  de: "der die das den dem des ein eine einen einem einer ist sind war waren und in zu von mit für auf nicht wie was wer wann wo warum welche wird werden kann können ich du sie es wir auch aber oder bei nach über sich dass gib erzähl mir dir tipps lernen möchte besser sein hat haben kann machen ohne zwischen jede alle schneller um".split(" "),
  pt: "o a os as de do da dos das que qual quais como quando onde quem por para com um uma é são está estão foi era e em não se seu sua ao como mais mas sobre me meu minha tenho posso há muito também você fale dê dicas quero aprender melhor ser tem têm pode fazer sem entre cada todo todos quantas quantos tocar".split(" "),
  it: "il lo la i gli le di del della dei delle che chi cosa quale quali come quando dove perché per con un una è sono era e in non si suo sua al come più ma su mi mio mia ho posso c'è molto anche parlami dammi consigli voglio imparare meglio essere ha hanno può fare senza tra ogni tutto tutti quante quanti suonare".split(" "),
  nl: "de het een van en in is zijn was waren wat wie hoe wanneer waar waarom welke dat dit met voor op niet ik je jij het ook maar of bij naar over zich dat geef vertel tips willen leren beter zijn heeft hebben kan maken zonder tussen elke alle sneller om te ik wil veilig".split(" "),
};
// Marks that point at one language. Weighted as a hit each.
const MARKS = [
  ["es", /[¿¡ñ]/g], ["de", /[ßäöü]/g], ["pt", /[ãõ]/g], ["fr", /[œêèàùâîôû]/g], ["it", /[ìò]/g], ["nl", /\bij\b|\bhet\b/g],
];
// "ç" is French and Portuguese; "é" is everywhere in the Romance languages — neither is counted alone.
const SPLIT = /[^\p{L}'’]+/u;

/** Letters only, code and URLs removed (a code block says nothing about the prose's language). */
export function proseOf(text) {
  return String(text ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\[[WS]\d+\]/g, " ")
    .replace(/[*_#>|~]/g, " ");
}

/** The language of a text: { lang, script, hits, name, confident }. lang is a
 *  code ('es'), or the script family for non-Latin, or 'unknown'. Never throws. */
export function detectLang(text) {
  const prose = proseOf(text);
  const script = scriptOf(prose);
  if (script === "Cyrillic") {
    const uk = /[іїєґ]/i.test(prose) && !/[ыэё]/i.test(prose);
    const lang = uk ? "uk" : "ru";
    return { lang, script, hits: 1, name: LANG_NAMES[lang], confident: true };
  }
  if (SCRIPT_LANG[script]) { const lang = SCRIPT_LANG[script]; return { lang, script, hits: 1, name: LANG_NAMES[lang], confident: true }; }
  if (script !== "Latin") return { lang: "unknown", script, hits: 0, name: null, confident: false };
  const lower = prose.toLowerCase();
  const toks = lower.split(SPLIT).filter(Boolean);
  const score = {};
  for (const [lang, list] of Object.entries(STOP)) {
    const set = new Set(list);
    score[lang] = toks.reduce((n, t) => n + (set.has(t) ? 1 : 0), 0);
  }
  for (const [lang, re] of MARKS) { const n = (lower.match(re) || []).length; if (n) score[lang] += Math.min(n, 2); }
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const [best, hits] = ranked[0];
  const second = ranked[1]?.[1] ?? 0;
  if (hits >= DECLARED.minHits && hits - second >= DECLARED.margin) return { lang: best, script, hits, name: LANG_NAMES[best], confident: true };
  return { lang: "unknown", script, hits, name: null, confident: false };
}

/** Is `reply` in the same language as `question`? Only a CONFIDENT difference
 *  counts as a mismatch: unknown on either side, or a reply too short to judge,
 *  is treated as the same (nothing is restated on a coin-flip). Languages that
 *  share a script and cannot be told apart by it (ru/uk) compare by script. */
export function sameLanguage(question, reply) {
  const q = detectLang(question);
  if (!q.confident) return { same: true, question: q, reply: null, why: "the question's language is not confidently known" };
  const letters = (String(proseOf(reply)).match(/\p{L}/gu) || []).length;
  if (letters < DECLARED.minReplyLetters) return { same: true, question: q, reply: null, why: "the reply is too short to judge" };
  const r = detectLang(reply);
  if (!r.confident) {
    // A Latin-script reply that matched no language signature while the question
    // is NOT Latin script is still a mismatch (a script is evidence enough).
    if (r.script === "Latin" && q.script !== "Latin") return { same: false, question: q, reply: r, why: "the reply is in Latin script, the question is " + q.script };
    return { same: true, question: q, reply: r, why: "the reply's language is not confidently known" };
  }
  if (q.script !== r.script) return { same: false, question: q, reply: r, why: `question ${q.name}, reply ${r.name}` };
  if (q.script === "Latin") return { same: q.lang === r.lang, question: q, reply: r, why: q.lang === r.lang ? "" : `question ${q.name}, reply ${r.name}` };
  return { same: true, question: q, reply: r, why: "" };
}

/** The sentence that goes in the system prompt. Always asks for the asker's
 *  language; names it when the detector is confident (a named language moves a
 *  small model far more than the general rule does). */
export function languageInstruction(question) {
  const q = detectLang(question);
  const general = "Reply in the same language the person wrote in.";
  if (q.confident && q.lang !== "en") return `${general} The person wrote in ${q.name}: write your whole reply in ${q.name}, even when the sources you were given are in another language.`;
  return general;
}

/** The two messages that ask the model to restate ITS OWN draft in the asker's
 *  language. It is told to keep every figure and name and to add nothing. */
export function restateMessages(draft, langName) {
  return [
    { role: "system", content: `You translate text into ${langName}. Output ONLY the translation, in ${langName}. Keep every number, name, URL and line of code exactly as written. Do not add, remove, explain or comment.` },
    { role: "user", content: String(draft ?? "") },
  ];
}

/** The typed note for a reply that is still in the wrong language after a restate attempt. */
export function languageNotice(q, r, { restated = false } = {}) {
  return {
    kind: "language",
    text: `You wrote in ${q.name}, but the reply came back in ${r?.name || "another language"}${restated ? " even after the model was asked to restate it" : ""}. The words below are the model's; the fold did not translate them.`,
  };
}
