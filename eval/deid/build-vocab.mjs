// Build the "plain word" set: lowercase types that are ordinary in MANY registers of English, from the ethos corpus.
// A word is plain when it occurs (>= MIN_COUNT times) in at least MIN_FAMILIES of the register families below.
// Personal names are register-bound — "keisha" recurs in one mailbox, never across SMS, IRC, mail, books and law —
// so the cross-family rule separates them from vocabulary without a hand-typed stoplist or a name list.
//
// It ALSO builds a name lexicon from the cased families, from the other direction: a word that is almost always
// capitalised in the middle of a sentence (tom, kim, okafor, tokyo) is something with a proper name, whatever
// it is called in an all-lowercase message. A word that is usually lowercase (mark, will) never gets in, however
// many people are called it — those need a cue. This is a measured case ratio, not a list anyone typed.
// Ethos is read-only here. Usage: node eval/deid/build-vocab.mjs
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ETHOS = process.env.ETHOS || "/Users/mlacy/Documents/3.0/ethos";
const FAMILIES = {
  sms:        [["19-organic-community/nus-sms/en"], ["19-organic-community/cosem"]],
  irc:        [["19-organic-community/ubuntu-irc/ubuntu"], ["19-organic-community/ubuntu-irc/kubuntu"], ["19-organic-community/ubuntu-irc/xubuntu"], ["19-organic-community/ubuntu-irc/ubuntu-server"]],
  mail:       [["19-organic-community/enron"]],
  books:      [["01-literature-books/gutenberg"], ["01-literature-books/gitenberg"]],
  reference:  [["02-encyclopedic/wikipedia"], ["02-encyclopedic/1911-britannica"]],
  academic:   [["05-academic-papers"]],
  legal:      [["06-government-legal"]],
  code:       [["09-source-code"]],
};
const CASED = new Set(["mail", "books", "reference", "academic", "legal"]);   // families where case carries information
const INFORMAL = new Set(["sms"]), INFORMAL_DOCS = 5;   // a word typed by >= 5 different people is the register's spelling, not someone's name
const NAME_MIN_MID = 3, NAME_RATIO = 0.9, NAME_MIN_FAMILIES = 2;
const MIN_COUNT = +(process.env.MIN_COUNT || 2), MIN_FAMILIES = +(process.env.MIN_FAMILIES || 3), BYTE_CAP = 6_000_000, FILE_CAP = 400_000;
const ENGLISH = /\b(the|and|of|to|is)\b/gi;

const CODE_EXT = /\.(c|h|cc|cpp|go|py|rs|ts|js|java|rb|md|txt)$/i;
function* files(dir, any = false) {
  let ents; try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) { const p = join(dir, e.name); if (e.isDirectory()) yield* files(p); else if (any ? CODE_EXT.test(e.name) : /\.(txt|md)$/i.test(e.name)) yield p; }
}
const perFamily = {};
for (const [fam, groups] of Object.entries(FAMILIES)) {
  const counts = new Map(), mid = new Map(), low = new Map(), docFreq = new Map(); let bytes = 0, docs = 0, skipped = 0;
  outer: for (const [g] of groups) for (const f of files(join(ETHOS, g), fam === "code")) {
    if (bytes >= BYTE_CAP) break outer;
    let t; try { t = readFileSync(f, "utf8").slice(0, FILE_CAP); } catch { continue; }
    if (((t.match(ENGLISH) || []).length * 5) / Math.max(1, t.split(/\s+/).length) < 0.15) { skipped++; continue; }   // not English enough: its words are not English vocabulary
    bytes += t.length; docs++;
    const body = fam === "code" ? t.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ") : t;   // identifiers are read as the words they are made of
    let prevEnd = -1; const inDoc = new Set();
    for (const m of body.matchAll(/[\p{L}][\p{L}'’]*/gu)) {
      const raw = m[0].replace(/['’]s$/, ""), w = raw.toLowerCase();
      counts.set(w, (counts.get(w) || 0) + 1); inDoc.add(w);
      if (CASED.has(fam) && raw.length >= 3) {
        const gap = prevEnd < 0 ? "." : body.slice(prevEnd, m.index);
        const starts = /[.!?:;"“”\n\r(]/.test(gap) || prevEnd < 0;           // a sentence-initial capital says nothing about the word
        const cap = raw[0] !== raw[0].toLowerCase() && raw.slice(1) === raw.slice(1).toLowerCase();
        if (cap && !starts) mid.set(w, (mid.get(w) || 0) + 1);
        else if (raw === w) low.set(w, (low.get(w) || 0) + 1);
      }
      prevEnd = m.index + m[0].length;
    }
    for (const w of inDoc) docFreq.set(w, (docFreq.get(w) || 0) + 1);
  }
  perFamily[fam] = { counts, mid, low, docFreq, bytes, docs, skipped };
  console.log(fam.padEnd(10), `${docs} docs, ${(bytes / 1e6).toFixed(1)} MB, ${skipped} non-English skipped, ${counts.size} types`);
}
const fams = Object.keys(perFamily), tally = new Map();
for (const f of fams) for (const [w, n] of perFamily[f].counts) if (n >= MIN_COUNT) tally.set(w, (tally.get(w) || 0) + 1);
const rel = (w) => fams.reduce((a, f) => a + (perFamily[f].counts.get(w) || 0) / perFamily[f].counts.size, 0);
const plain = [...tally].filter(([w, k]) => k >= MIN_FAMILIES && w.length >= 2).map(([w]) => [w, rel(w)]).sort((a, b) => b[1] - a[1]).map(([w]) => w);   // most ordinary first: the head of the list is the function words
const informalSet = new Set();
for (const f of fams) if (INFORMAL.has(f)) for (const [w, d] of perFamily[f].docFreq) if (d >= INFORMAL_DOCS && w.length >= 2) informalSet.add(w);
writeFileSync(new URL("./informal-en.json", import.meta.url), JSON.stringify({ schema: "InformalWords@1", language: "en", provenance: { giver: "ethos 19-organic-community (SMS), read-only", declared: { INFORMAL_DOCS }, note: "Types typed by >= INFORMAL_DOCS different contributors' documents: shared informal spelling (gud, abt, ur, lah), not private names." }, words: [...informalSet].sort() }));
console.log(`informal words: ${informalSet.size}`);
const nameTally = new Map();
for (const f of fams) if (CASED.has(f)) for (const [w, n] of perFamily[f].mid) { const e = nameTally.get(w) || { mid: 0, low: 0, fams: 0 }; e.mid += n; e.fams++; nameTally.set(w, e); }
for (const f of fams) if (CASED.has(f)) for (const [w, n] of perFamily[f].low) { const e = nameTally.get(w); if (e) e.low += n; }
const names = [...nameTally].filter(([w, e]) => e.mid >= NAME_MIN_MID && e.fams >= NAME_MIN_FAMILIES && e.mid / (e.mid + e.low) >= NAME_RATIO).map(([w]) => w).sort();
writeFileSync(new URL("./names-en.json", import.meta.url), JSON.stringify({
  schema: "ProperNameWords@1", language: "en",
  provenance: { giver: "ethos corpus, read-only", cased_families: [...CASED], declared: { NAME_MIN_MID, NAME_RATIO, NAME_MIN_FAMILIES }, note: "Words capitalised mid-sentence in >= NAME_RATIO of their cased occurrences, >= NAME_MIN_MID times, in >= NAME_MIN_FAMILIES cased families. Person, place and organisation names are not told apart — nothing here labels them." },
  words: names,
}));
console.log(`name words: ${names.length}  (${(JSON.stringify(names).length / 1024).toFixed(0)} KB json)`);
writeFileSync(new URL("./vocab-en.json", import.meta.url), JSON.stringify({
  schema: "PlainWords@1", language: "en",
  provenance: { giver: "ethos corpus, read-only", families: Object.fromEntries(fams.map((f) => [f, { docs: perFamily[f].docs, mb: +(perFamily[f].bytes / 1e6).toFixed(1) }])), declared: { MIN_COUNT, MIN_FAMILIES, BYTE_CAP, FILE_CAP }, note: "Ordered most-ordinary first (mean relative frequency across families). Types that occur >= MIN_COUNT times in >= MIN_FAMILIES register families. Derived, not hand-typed. Names are register-bound, so they fall out; a name that is also a word (mark, will) is in, by construction — only a cue can catch it." },
  words: plain,
}));
console.log(`plain words: ${plain.length}  (${(JSON.stringify(plain).length / 1024).toFixed(0)} KB json)`);

// The shipped copy: one module the page imports, so nothing is fetched at runtime and nothing leaves the machine to read it.
const informalList = [...informalSet].sort();
writeFileSync(new URL("../../fold-chat-priors-en.js", import.meta.url), `// fold-chat-priors-en.js — GENERATED by eval/deid/build-vocab.mjs from the ethos corpus. Do not edit by hand.
// PLAIN: words ordinary across registers of English, most ordinary first. INFORMAL: spellings shared by many SMS writers.
// NAMES: words that carry a proper name's capital in cased text. Derived measurements (see the build script), not typed lists.
// Families and thresholds are recorded in eval/deid/vocab-en.json "provenance".
const split = (s) => s.split(" ");
export const PLAIN = split(${JSON.stringify(plain.join(" "))});
export const INFORMAL = split(${JSON.stringify(informalList.join(" "))});
export const NAMES = split(${JSON.stringify(names.join(" "))});
`);
console.log("wrote fold-chat-priors-en.js");
