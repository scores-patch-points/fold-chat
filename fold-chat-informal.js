// fold-chat-informal.js — find names in caseless, informal English from priors alone: no capitals, no model, no list of names.
//
// The khora's read (and namesIn) find a name by its capital. A message typed in lowercase ("make a page for priya, she
// runs the front desk at marlow dental") has none, and measured 2% of private names caught (eval/deid). This finds them
// by SLOT and by what the word is NOT:
//   PLAIN     words ordinary across registers of English (SMS, IRC, mail, books, reference, papers, law, code)
//   INFORMAL  spellings many different people share (gud, abt, ur) — register, not identity
//   NAMES     words that carry a proper name's capital in cased text (tom, devon) — a measured case ratio
// all derived from the ethos corpus by eval/deid/build-vocab.mjs (fold-chat-priors-en.js).
// A token is a NAME when a cue puts it in a name slot (a title or kin word before it, "for/with/call/tell" …, a possessive,
// "called") and it is not an ordinary word there; or when its shape says so (@handle, nick_42, getEleanorBalance, priya_k);
// or when it is a street address. A name that is ALSO an ordinary word (mark, will, mike, kim) is caught only after a title or
// kin word and only if it is not among the most ordinary words — otherwise it is missed, and this file says so.
//
// What it cannot do: names in a language the priors have no register for (it measured 3/5 on Spanish and Turkish names),
// names that are ordinary words with no cue, and it over-masks product and tech words it has never seen after a cue
// (ubuntu, compiz). Masking too much costs quality; masking too little costs privacy — this leans to the first.
import { PLAIN, INFORMAL, NAMES } from "./fold-chat-priors-en.js";

let cached = null;
/** The shipped priors as sets. Built once. */
export function defaultPriors() {
  return cached ||= { core: new Set(PLAIN.slice(0, 400)), plain: new Set([...PLAIN, ...INFORMAL]), names: new Set(NAMES) };
}

export const STRONG_TITLE = new Set(["mr","mrs","miss","ms","mx","dr","prof","professor","rev","reverend","sir","madam","madame","dame","lord","lady","judge","sen","rep","fr","sr","sgt","capt","lt","col","gen","chief","officer","coach","pastor","imam","rabbi","sister","brother","auntie","aunty","aunt","uncle","cousin","bro","sis","mom","mum","dad","mama","mamaw","papaw","grandma","grandpa","granny","nana","boss","landlord","landlady","neighbor","neighbour","colleague","manager","client","customer","patient","husband","wife","son","daughter","girlfriend","boyfriend","fiance","friend","teacher","nurse","called","named","gf","bf","bff","bestie","fiancee","sponsor","treasurer","secretary","president","owner","director","principal","founder","ceo","lawyer","attorney","therapist","counselor","counsellor","tenant","roommate","partner","dentist","pastor","abuela","abuelo","tia","tio","nieto","nieta","hijo","hija","mijo","mija","hermano","hermana","primo","prima","don","dona","doña","senor","señor","senora","señora","srta","dra"]);
export const TITLE_ALWAYS = new Set(["mr","mrs","miss","ms","mx","dr","prof","professor","rev","reverend","sir","madam","madame","dame","lord","lady","judge","fr","sgt","capt","lt","col","pastor","imam","rabbi","auntie","aunty","uncle","mamaw","papaw","called","named","abuela","abuelo","tia","tio","don","dona","doña","senor","señor","senora","señora","srta","dra"]);
export const WEAK_CUE = new Set(["for","with","w","from","call","tell","text","ask","email","give","4","by","c/o","cc"]);
export const PARTICLE = new Set(["ah","ahh","bin","binti","bte","bt","van","von","de","del","da","di","al","el","la","le","mc","mac","st","jr","sr","ii","iii"]);
export const AND = new Set(["and","n","&","y","e","+"]);
const STREET = /\b\d{1,5}\s+(?:[a-z]+\s+){1,2}(?:st|street|ave|avenue|rd|road|blvd|boulevard|ln|lane|dr|drive|way|ct|court|pl|place|pkwy|hwy)\b/giu;

const TOKEN = /@?[\p{L}\p{N}][\p{L}\p{N}_]*/gu;
export const CORE = 400;   // the most ordinary words are function words and fillers — never a name, even after "miss" or "called"
/** Names as strings. */
export function informalNames(text, priors = defaultPriors()) { return informalTerms(text, priors).map((f) => f.term); }

/** Names as { term, whole }: `whole:false` for pieces of identifiers (getEleanorBalance, tasha_orders.csv), which have no word edges to match on. */
export function informalTerms(text, { plain, names, core } = defaultPriors()) {
  const t = String(text ?? ""), toks = [];
  for (const m of t.matchAll(TOKEN)) toks.push({ raw: m[0], w: m[0].toLowerCase(), at: m.index, end: m.index + m[0].length });
  const found = new Set(), inside = new Set();
  const alpha = (w) => /^[\p{L}]{2,}$/u.test(w);
  const isPlain = (w) => plain.has(w) || plain.has(w.replace(/(es|s)$/, "")) || (/ing$|ed$|ly$/.test(w) && w.length > 5);
  const oov = (w) => alpha(w) && !isPlain(w);
  const nameish = (w) => oov(w) || (alpha(w) && names.has(w));
  const take = (i, strongPlainOk, depth = 0) => {   // a run starting at i: the head, then more name-ish words, particles, initials, "and"-joined names
    let j = i; const run = [];
    const head = toks[j];
    if (!head || !alpha(head.w)) return;
    if (core.has(head.w)) return;
    if (!(strongPlainOk || nameish(head.w))) return;
    run.push(head.raw); j++;
    for (; j < toks.length && run.length < 4; j++) {
      const n = toks[j];
      if (t.slice(toks[j - 1].end, n.at).replace(/[ \t]/g, "") !== "") break;   // punctuation ends a run
      if (nameish(n.w) || PARTICLE.has(n.w) || (n.w.length === 1 && /\p{L}/u.test(n.w))) run.push(n.raw);
      else if (AND.has(n.w) && toks[j + 1] && nameish(toks[j + 1].w)) { run.push(n.raw, toks[j + 1].raw); j++; }
      else break;
    }
    for (const r of run) if (!AND.has(r.toLowerCase())) found.add(r);
    // a list of names: "bubba, tink, and little mo" — once the first is a name, the out-of-vocabulary words that follow commas are too
    const after = toks[j - 1];
    if (after && /^\s*,\s*(?:and\s+|n\s+|&\s+)?$/.test(t.slice(after.end, toks[j]?.at ?? after.end)) && toks[j] && depth < 4) take(j, false, depth + 1);
  };
  for (let i = 0; i < toks.length; i++) {
    const { w, raw } = toks[i];
    if (TITLE_ALWAYS.has(w) && toks[i + 1] && /^[ \t.]*$/.test(t.slice(toks[i].end, toks[i + 1].at))) take(i + 1, true);
    else if (STRONG_TITLE.has(w) && toks[i + 1] && /^[ \t.]*$/.test(t.slice(toks[i].end, toks[i + 1].at))) take(i + 1, false);
    if (STRONG_TITLE.has(w) && toks[i + 1] && /^(is|was|are|=)$/.test(toks[i + 1].w) && toks[i + 2]) take(i + 2, false);   // "treasurer is linda okonkwo"
    if (w === "name" && toks[i + 1] && /^(is|was)$/.test(toks[i + 1].w) && toks[i + 2]) take(i + 2, true);                    // "his name is rashad jenkins"
    if (WEAK_CUE.has(w) && toks[i + 1]) take(i + 1, false);
    if (/^@/.test(raw) && raw.length > 2) found.add(raw.slice(1));
    else if (/^[a-z]{4,}_?\d{2,}$/i.test(raw) || /^[a-z]+_\d{2,}$/i.test(raw) || /^[a-z]+_[a-z0-9]+$/i.test(raw) && raw.split("_").some((p) => oov(p.toLowerCase()) && p.length >= 4)) found.add(raw);
    // identifiers: an internal capital on a non-plain word (getEleanorBalance), or a snake part that is not a word (priya_k)
    if (/[a-z][A-Z]/.test(raw)) for (const p of raw.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(" ")) if (p.length >= 4 && oov(p.toLowerCase())) { found.add(p); inside.add(p); }
    if (/^[a-z]+_[a-z0-9]+$/i.test(raw) && !/\d{2,}$/.test(raw)) for (const p of raw.split("_")) if (p.length >= 3 && oov(p.toLowerCase())) { found.add(p); inside.add(p); }
    // possessive: "ayesha's" — an out-of-vocabulary word taking 's
    if (t[toks[i].end] === "'" && /^[sS]\b/.test(t.slice(toks[i].end + 1)) && oov(w)) found.add(raw);
  }
  for (const m of t.matchAll(STREET)) found.add(m[0]);
  return [...found].filter((x) => x.length >= 2).map((term) => ({ term, whole: !inside.has(term) }));
}
