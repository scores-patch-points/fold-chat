// fold-chat-voices.js — "SEVERAL VOICES BEAR ON THIS": each thinker's OWN verbatim sentence, nothing paraphrased. Pure: no DOM, no IO, no clock, NO MODEL; the canon is injected.
// (eval/ants/C2-PREREG.md pre-registers every gate here; eval/ants/C2-RESULTS.md reports the run.)
//
// User, 2026-10-06 (relayed): for a contested ask ("Is there a God?") find the thinkers who thought about it and show each one's own words from their real canon, framed by the app, with provenance.
// B3 (eval/ants/B3-*.json) measured why the model may not paraphrase them: only 72% of tied assertions were faithful, 4 were X, and the lexical tie gate accepts 7 of 9 one-word meaning flips.
// B1 (fold-chat-thinkers.js) measured why no thinker may be named the winner: all 12 contested questions are `undetermined` on its calibrated bar (a 1-2 stem question cannot single out a thinker).
// So: B1's CANDIDATES are the only thinkers looked at; for each, the app finds a sentence of the thinker's canon that carries the question's own content words, checked by the SHARED
// bearsOn / verifyNumber of fold-chat-provenance.js (driven by a mechanical number, not a model); the quote is the canon's slice by construction; the words around it are templates.
//
//   voicesFor({ question, candidates, thinkers, canonOf, fw, limits }) → { voices:[{ handle, giver, quote, source:{ path, sha256, work, section, start, end }, frame }], line, why, considered, calls:0 }
//   verifyVoices({ result, thinkers, canonOf }) → { ok, bad[] }     every quote is canon.slice(start,end); the sha256 matches; frame + line are the templates, re-rendered; <= max; alphabetical
//   renderText(result) → the voices as plain text (line, then frame + “quote” + source, per voice)
//
// DECLARED, not measured (II.11): the strict rule (all of a short question's stems), the extra sentence filters, the handle tables, the templates. giver: the user's brief 2026-10-06 (shape);
// the author's thresholds. LIMITS (said): the match is LEXICAL — "lie" meets recline, "just" meets merely; a sentence can carry the question's words and answer another question. The display
// says nothing about WHAT the quote means; a person reads it. A thinker B1 does not list is never heard. Whole canon files are searched (the profile has no section offsets for Solon / Grotius).
import { functionWordsOf } from "./fold-chat-snippets.js";
import { contentStems } from "./fold-chat-thinkers.js";
import { bearsOn, verifyNumber } from "./fold-chat-provenance.js";
import { indexCanon, indexRows } from "./fold-chat-counsel.js";

export const VOICES = Object.freeze({
  giver: "the user's brief 2026-10-06 (shape); the author's thresholds and wording; declared, not measured (II.11)",
  max: 3,                 // voices shown
  richStems: 12,          // among sentences with equally many of the question's stems, prefer the one nearest this many content stems
  minStems: 4,            // a sentence with fewer content stems says too little to be a voice
  maxDigitRun: 3,         // a run of more than this many digits is an index, a date or a footnote number
  strict: true,           // true: ALL of a <= 2-stem question's stems (ceil(2n/3) of more); false (comparison arm only): one shared stem, as bearsOn alone asks
  headLookback: 4000,     // lines scanned upward for the section heading
});

// The short name a person would say. The profile's `giver` is a catalogue label (dates, parentheses, "recorded by"); B3 found the label makes a model write years, and a person would not say it.
export const SHORT = Object.freeze({
  aletheia: "Parmenides", arokin: "the Yoruba court historians", dignaga: "Dignaga", "george-eliot": "George Eliot", grotius: "Hugo Grotius", huginn: "Snorri Sturluson", ise: "W. G. Aston",
  jaimini: "Jaimini", kairos: "Posidippus", kanada: "Kanada", laozi: "Laozi", mahavira: "Mahavira", mozi: "Mozi", nagarjuna: "Nagarjuna", ramakrishna: "Sri Ramakrishna",
  scheherazade: "Scheherazade", sima: "Sima Qian", solon: "Solon", vasana: "Vyasa", vivekananda: "Swami Vivekananda", whitman: "Walt Whitman", xunzi: "Xunzi", zhengming: "Confucius",
});
// Canons that ARE the thinker's own writing. Every other canon RECORDS or REPORTS the thinker (the Gospel is M's, Solon is Herodotus's, the Four Books hold Mencius, the Sutras come with commentary):
// "wrote" would be false there, so the frame says "canon records".
export const OWN_WORDS = Object.freeze(new Set(["laozi", "mozi", "xunzi", "whitman", "george-eliot", "grotius", "vivekananda", "ise"]));

export const TEMPLATES = Object.freeze({
  wrote: ({ giver }) => `Here is what ${giver} wrote that bears on this:`,
  records: ({ giver }) => `Here is what ${giver}${/s$/i.test(giver) ? "'" : "'s"} canon records that bears on this:`,
  several: () => "Several voices bear on this. These are their own sentences, quoted exactly; I have not paraphrased any of them and I am not saying which is right.",
  one: () => "One voice bears on this. This is its own sentence, quoted exactly; I have not paraphrased it and I am not saying it settles the question.",
});

/** The short giver for a thinker record: the declared name, else the profile's giver with parentheses and everything after a comma removed. */
export function shortGiver(thinker) {
  const h = String(thinker?.handle ?? "");
  if (SHORT[h]) return SHORT[h];
  const g = String(thinker?.giver ?? h).replace(/\s*\([^)]*\)?/g, "").split(",")[0].replace(/\s+/g, " ").trim();
  return g || h || "the thinker";
}
export const frameFor = (thinker) => (OWN_WORDS.has(String(thinker?.handle ?? "")) ? TEMPLATES.wrote : TEMPLATES.records)({ giver: shortGiver(thinker) });

/** { handle → { handle, giver, work, source:{ path, sha256 } } } from a ThinkerProfile@1 (voice/thinkers-profile.json): the speaking thinkers only. */
export function thinkerTable(profile) {
  const out = {};
  for (const t of profile?.thinkers || []) if (t.speaks !== false && t.source?.sha256) out[t.handle] = { handle: t.handle, giver: t.giver, work: t.work, source: { path: t.source.path, sha256: t.source.sha256 } };
  return out;
}

// ─────────────── the section (a declared heuristic, reported with its hit rate) ───────────────
const HEAD_WORD = /^(?:book|chapter|part|section|canto|sutra|sutras|fragment|lecture|letter|song|ode|volume|vol\.|adhyaya|pada|hymn|psalm|epigram)\b/i;
const looksLikeHeading = (line) => {
  const t = line.trim();
  if (t.length < 3 || t.length > 70) return false;
  if (HEAD_WORD.test(t) && !/[a-z]{4,}\s+[a-z]{4,}\s+[a-z]{4,}\s+[a-z]{4,}/.test(t)) return true;
  const letters = t.replace(/[^\p{L}]/gu, "");
  return letters.length >= 3 && letters === letters.toUpperCase() && /\p{Lu}/u.test(letters) && !/[.!?]$/.test(t);
};
/** The nearest heading-like line above `pos` (a short line, blank-line bounded above, all caps or opening Book/Chapter/…), or null. */
export function sectionAt(text, pos, { lookback = VOICES.headLookback } = {}) {
  const src = String(text ?? "");
  let end = Math.min(Math.max(0, pos), src.length), n = 0;
  while (end > 0 && n < lookback) {
    const nl = src.lastIndexOf("\n", end - 1);
    const line = src.slice(nl + 1, end);
    end = nl < 0 ? 0 : nl; n++;
    if (!line.trim()) continue;
    const prevBlank = nl <= 0 || !src.slice(src.lastIndexOf("\n", nl - 1) + 1, nl).trim();
    if (prevBlank && looksLikeHeading(line)) return line.trim().replace(/\s+/g, " ");
    if (nl < 0) break;
  }
  return null;
}

// ─────────────── choosing the sentence ───────────────
const FWDEFAULT = functionWordsOf("en");
// counsel's own index cache holds 4 canons and a question asks up to 5 (run 1 of eval/ants/c2 re-indexed the 8 MB Complete Works on nearly every question: warm max 44 s); this one holds 24.
// A hit is only a speed-up: findVoice below still demands the canon's own slice for every sentence it uses, so a stale entry (same hash and length, other text) yields nothing, never a wrong quote.
const IDX = new Map();
const indexOf = (text, fw, key) => {
  const k = `${key}|${text.length}|${text.slice(0, 48)}|${text.slice(-48)}`;
  if (IDX.has(k)) return IDX.get(k);
  const idx = indexCanon(text, fw, null);
  if (IDX.size >= 24) IDX.delete(IDX.keys().next().value);
  IDX.set(k, idx);
  return idx;
};
const needOf = (n, strict) => (!strict ? 1 : n <= 2 ? n : Math.ceil((2 * n) / 3));

/** One thinker's sentence for the question, or { none:true, why }. `canon` = { text, sha256 } (the whole canon file) or { rows:[{ text, start, end }], sha256 } (a bank of verbatim sentences with their offsets). */
export function findVoice({ question, thinker, canon, fw = FWDEFAULT, limits = {} }) {
  const L = { ...VOICES, ...limits };
  const none = (why) => ({ none: true, why });
  if (!thinker?.source?.sha256) return none("no_verified_source");
  if (!canon || canon.sha256 !== thinker.source.sha256) return none("canon_not_the_verified_file");          // the file the profile hashed, or nothing
  const text = typeof canon.text === "string" && canon.text ? canon.text : null;
  const rows = !text && Array.isArray(canon.rows) ? canon.rows.filter((r) => r && typeof r.text === "string" && Number.isInteger(r.start) && Number.isInteger(r.end)) : null;
  if (!text && !(rows && rows.length)) return none("no_canon");
  const qStems = [...new Set(contentStems(question))];
  if (!qStems.length) return none("no_content_stems_in_the_question");
  const idx = text ? indexOf(text, fw, thinker.source.sha256) : indexRows(rows, fw);
  const need = needOf(qStems.length, L.strict);
  const hit = new Map();
  for (const st of qStems) for (const id of idx.post.get(st) || []) hit.set(id, (hit.get(id) || 0) + 1);
  const ranked = [...hit.entries()].filter(([, k]) => k >= need)
    .map(([id, k]) => ({ id, k, far: Math.abs(idx.sents[id].stems.size - L.richStems) }))
    .sort((a, b) => b.k - a.k || a.far - b.far || a.id - b.id);
  if (!ranked.length) return none(hit.size ? "no_sentence_carries_enough_of_the_question" : "no_sentence_carries_the_question");
  const passages = [{ text: text ?? "", ref: thinker.source.path }];
  for (const r of ranked) {
    const s = idx.sents[r.id];
    if (s.stems.size < L.minStems) continue;
    if (new RegExp(`\\d{${L.maxDigitRun + 1},}`).test(s.text) || /\?["')\]”’]*$/.test(s.text) || /^\p{Ll}/u.test(s.text)) continue;
    if (text && text.slice(s.start, s.end) !== s.text) continue;                                                 // the canon's own slice, or not at all
    const cand = [{ n: 1, passageIndex: 0, start: s.start, end: s.end, text: s.text }];
    if (!bearsOn(question, s.text, fw).ok) continue;                                                          // the shared relevance floor
    const v = text ? verifyNumber({ reply: "1", claim: question, candidates: cand, passages, fw }) : { ok: true, start: s.start, end: s.end };   // the shared pointer check, driven by the app's number
    if (!v.ok) continue;
    return { quote: s.text, start: s.start, end: s.end, shared: r.k, of: qStems.length, section: text ? sectionAt(text, s.start, { lookback: L.headLookback }) : null };
  }
  return none("no_sentence_passes_the_filters");
}

// ─────────────── the display ───────────────
const byName = (a, b) => (a.giver.toLowerCase() < b.giver.toLowerCase() ? -1 : a.giver.toLowerCase() > b.giver.toLowerCase() ? 1 : a.handle < b.handle ? -1 : 1);

/** The line above the voices, from the number alone (it names nobody). */
export const lineFor = (n) => (n >= 2 ? TEMPLATES.several() : n === 1 ? TEMPLATES.one() : "");

/**
 * The voices on a question. `candidates` = B1's classify().candidates (in its order; only [{ handle }] is needed). `thinkers` = thinkerTable(profile). `canonOf(handle, thinker)` → { text|rows, sha256 } | null (the host reads the file).
 * The first `max` candidates that yield a sentence are kept; they are then shown ALPHABETICALLY (the order of the evidence is not a ranking and B1 says no thinker stands out). Never throws; no model is called (calls is always 0).
 */
export function voicesFor({ question, candidates, thinkers, canonOf, fw = FWDEFAULT, limits = {} }) {
  const L = { ...VOICES, ...limits };
  const considered = [], found = [];
  try {
    const seen = new Set();
    for (const c of Array.isArray(candidates) ? candidates : []) {
      if (found.length >= L.max) break;
      const handle = c?.handle;
      if (!handle || seen.has(handle)) continue;
      seen.add(handle);
      const thinker = thinkers?.[handle];
      if (!thinker) { considered.push({ handle, ok: false, why: "not_a_speaking_thinker_of_the_profile" }); continue; }
      let canon = null;
      try { canon = canonOf(handle, thinker); } catch (e) { considered.push({ handle, ok: false, why: "canon_unreadable" }); continue; }
      const r = findVoice({ question, thinker, canon, fw, limits });
      if (r.none) { considered.push({ handle, ok: false, why: r.why }); continue; }
      considered.push({ handle, ok: true, shared: r.shared, of: r.of });
      found.push({
        handle, giver: shortGiver(thinker), quote: r.quote,
        source: { path: thinker.source.path, sha256: thinker.source.sha256, work: thinker.work, section: r.section, start: r.start, end: r.end },
        frame: frameFor(thinker),
      });
    }
  } catch (e) { return { voices: [], line: "", why: "error: " + String(e?.message || e).slice(0, 80), considered, calls: 0 }; }
  const voices = found.slice(0, L.max).sort(byName);
  return { voices, line: lineFor(voices.length), why: voices.length ? "voices_found" : "no_passage_bears_on_the_question", considered, calls: 0 };
}

/** The result as plain text: the line, then for each voice its frame, the quote in quotation marks, and where it is from. */
export function renderText(result) {
  if (!result?.voices?.length) return "";
  const out = [result.line];
  for (const v of result.voices) out.push(`${v.frame}\n“${v.quote}”\n— ${v.source.work}${v.source.section ? `, ${v.source.section}` : ""} (${v.source.path}, characters ${v.source.start}–${v.source.end})`);
  return out.join("\n\n");
}

/** The check on the display. `canonOf(handle, thinker)` returns the file as the HOST holds it. Pure. */
export function verifyVoices({ result, thinkers, canonOf, limits = {} }) {
  const L = { ...VOICES, ...limits };
  const bad = [];
  const vs = Array.isArray(result?.voices) ? result.voices : null;
  if (!vs) return { ok: false, bad: [{ why: "no_voices_array" }] };
  if (vs.length > L.max) bad.push({ why: "more_than_max", n: vs.length });
  if (result.line !== lineFor(vs.length)) bad.push({ why: "line_is_not_the_template" });
  if (vs.length && vs.some((v, i) => i && byName(vs[i - 1], v) > 0)) bad.push({ why: "not_alphabetical" });
  if (new Set(vs.map((v) => v.handle)).size !== vs.length) bad.push({ why: "one_thinker_twice" });
  for (const v of vs) {
    const th = thinkers?.[v.handle];
    if (!th) { bad.push({ why: "unknown_thinker", handle: v.handle }); continue; }
    if (v.giver !== shortGiver(th) || /[\d()]/.test(v.giver) || v.giver.length > 30) bad.push({ why: "giver_not_short", handle: v.handle });
    if (v.frame !== frameFor(th)) bad.push({ why: "frame_is_not_the_template", handle: v.handle });
    const canon = canonOf(v.handle, th);
    const s = v.source || {};
    if (!canon || canon.sha256 !== th.source.sha256 || s.sha256 !== th.source.sha256 || s.path !== th.source.path) { bad.push({ why: "canon_not_the_verified_file", handle: v.handle }); continue; }
    if (typeof canon.text === "string") {
      if (!Number.isInteger(s.start) || !Number.isInteger(s.end) || canon.text.slice(s.start, s.end) !== v.quote) bad.push({ why: "quote_is_not_the_canons_slice", handle: v.handle });
    } else if (!(canon.rows || []).some((r) => r.start === s.start && r.end === s.end && r.text === v.quote)) bad.push({ why: "quote_is_not_a_bank_row", handle: v.handle });
    if (!(typeof v.quote === "string" && v.quote.trim())) bad.push({ why: "empty_quote", handle: v.handle });
  }
  return { ok: bad.length === 0, bad };
}
