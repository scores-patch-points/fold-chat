# Patches that belong in the khora (NOT applied)

The chat's gate is `fold-chat-ground.js`, a lean fork of the khora's `organs/cite.js` + `organs/grounding.js`. The fix
for the defects in `docs/GATE-FIX-PREREG.md` was made and measured HERE. `vendor/khora/` is a frozen copy
(`VENDOR-KHORA.json`: "Never edit by hand") and `/Users/mlacy/Documents/3.0/khora` was not touched. This file is the
exact change each of those defects asks of the khora, in the order of the khora's own files. Each hunk names the
test that falsifies it in the-fold (`fold-chat-ground.test.mjs`, `eval/controls.mjs`); the khora needs its own tests
before any of it lands.

How the khora's `cite.js` differs from the fork, so the hunks are not copied blindly: the khora scores a sentence by
a null-sampled shared-term run (`overlap`, `NULL_SAMPLES`), vetoes on `namesIn`/`namesSupported`, and has NO figure
check in `attribute` at all; figures are only checked at answer level by `grounding.js` (`numberSet` / `hasNumber`),
over every passage together. So the khora has defects 3 and 4 as the fork had them, and defects 1 and 2 in a different
form (a figure anywhere in the pooled passages supports a sentence; nothing checks the predicate).

---

## 1. `organs/source.js` — `tokenize`: keep combining marks, segment unspaced scripts (defect 4)

`tokenize` splits on `/[^\p{L}\p{N}%.\-]+/u`. A Devanagari or Arabic vowel sign is `\p{M}`, not `\p{L}`, so it is a
split point: `कैनबरा` becomes `क`, `नबर`. The header comment already discloses that CJK is not segmented and that
`tokenize("北京")` is `[]` because of the length floor `t.length > 2`. Both have a mechanical fix.

```diff
--- a/native/organs/source.js
+++ b/native/organs/source.js
@@ export function tokenize(text) {
-  return foldDiacritics(text)
+  const folded = foldDiacritics(text)
     .toLowerCase()
-    .split(/[^\p{L}\p{N}%.\-]+/u)
-    .map((t) => t.replace(/^[.\-]+|[.\-]+$/g, ""))
-    .filter((t) => (t.length > 2 || isNumeral(t)) && !STOPWORDS.has(t));
+    // \p{M}: a vowel sign belongs to its word (Devanagari, Arabic, Thai, Hebrew points).
+    .split(/[^\p{L}\p{N}\p{M}%.\-]+/u)
+    .map((t) => t.replace(/^[.\-]+|[.\-]+$/g, ""))
+    .filter(Boolean);
+  // A run with ideographs or Thai is cut into WORDS by Intl.Segmenter (granularity "word"), never one oversized token.
+  const words = folded.flatMap((t) => (UNSPACED.test(t) ? segmentWords(t) : [t]));
+  // The length floor is a fact about the script: an ideographic or Hangul word is 2+ characters, the rest 3+.
+  return words.filter((t) => (t.length >= minLen(t) || isNumeral(t)) && !STOPWORDS.has(t));
 }
+const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;
+const IDEO = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
+const minLen = (t) => (IDEO.test(t) ? 2 : 3);
+const segmentWords = (run) => typeof Intl !== "undefined" && Intl.Segmenter
+  ? [...new Intl.Segmenter(/\p{Script=Thai}/u.test(run) ? "th" : /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(run) ? "ja" : "zh", { granularity: "word" }).segment(run)].filter((x) => x.isWordLike).map((x) => x.segment)
+  : [...run];                      // no segmenter: one token per character, so a lexical run can still be found
```

`fold.test.mjs` pins the old CJK behaviour ("`tokenize('北京')` is `[]`"); that pin has to be inverted when this lands.
Falsifier in the-fold: `tokenize("北京是一座全球城市，也是世界人口第三多的城市。")` is several words, none longer than 6 characters;
verbatim zh / hi / ar sentences ground to their own page (12 of 12 in `eval/controls.mjs`, class SCRIPT) and the same sentence
with its first number replaced by 7777 does not (6 of 6, class SCRIPTN).

## 2. `organs/cite.js` — `splitSentences`: the other scripts' full stops (defect 4)

`/(?<=[.!?])\s+|\n+/` never splits Chinese (`。` is followed by no space at all) or Hindi (`।`), so a whole paragraph is "one
sentence" and a single shared clause grounds all of it.

```diff
--- a/native/organs/cite.js
+++ b/native/organs/cite.js
@@ export function splitSentences(text) {
-  const src = String(text ?? "");
+  // CJK full stops carry no space after them: a boundary is made after each one.
+  const src = String(text ?? "").replace(/([。！？]+['"”’)\]」』]*)(?=\S)/gu, "$1\n");
@@
-  const re = /(?<=[.!?])\s+|\n+/g;
+  const re = /(?<=[.!?।॥؟。！？])\s+|\n+/g;
```

## 3. `organs/cite.js` — `namesSupported`: a name is a whole token, and a tag or a site is not a name (defect 3, and a substring bug)

`hay.includes(p)` is substring containment: the part `macdonald` is "present" inside `macdonalds`, `ann` inside `annex`. (The
fork's comment already says "Whole-token membership, not substring".) And `namesIn` reads `[W1]`, `Wikipedia`,
`According to the …` as names, so a true sentence is vetoed for a name the passage cannot have.

```diff
--- a/native/organs/cite.js
+++ b/native/organs/cite.js
@@ function namesSupported(text, chunk) {
-  const hay = foldDiacritics(chunk.text.toLowerCase());
-  return namesIn(text).every((n) => {
+  const hay = new Set(foldDiacritics(chunk.text.toLowerCase()).split(/[^\p{L}\p{N}\p{M}]+/u).filter(Boolean));
+  return namesIn(claimOf(text)).every((n) => {
     const parts = foldDiacritics(n.toLowerCase()).split(/\s+/).filter((p) => p.length > 1);
-    return parts.every((p) => hay.includes(p));
+    return parts.every((p) => hay.has(p));
   });
 }
+
+// What is NOT the claim: leaked source tags ([W1], W2), "According to the … article,", "The sources indicate that",
+// a trailing "according to [W2]", markdown emphasis, and the names of the sites the answer cites.
+const TAG_RE = /\[\s*[WSM]?\d+\s*\]|\b[WS]\d+\b(?!\.\d)/g;
+const SAYS = /^\s*(?:(?:the|these|those|my|your|this|that)\s+(?:[\p{L}'’-]+\s+){0,2})?(?:sources?|passages?|articles?|pages?|documents?|texts?|results?|excerpts?|materials?)\s+(?:indicates?|shows?|says?|states?|suggests?|mentions?|notes?|reports?|confirms?|explains?|describes?)(?:\s+that)?\s*[,:]?\s*/iu;
+const LEAD_IN = /^\s*(?:according to|per|based on|as (?:stated|reported|noted) (?:by|in|on))\s+[^,:;]{0,90}[,:]\s*/iu;
+const SITES = /(?<![\p{L}\p{N}])(?:wikipedia|wikipédia|википедия|维基百科|ウィキペディア|ويكيبيديا|विकिपीडिया)(?![\p{L}\p{N}])/giu;
+export function claimOf(text) {
+  let s = String(text ?? "").replace(/[*_`#>]+/g, " ").replace(TAG_RE, " ");
+  const lead = s.match(LEAD_IN);
+  if (lead && /wikipedia|article|page|source|site|passage|text|document/i.test(lead[0])) s = s.slice(lead[0].length);
+  return s.replace(SAYS, "").replace(SITES, " ").replace(/\s+/g, " ").trim();
+}
```

(`fold-chat-ground.js::claimOf` is the tested version; it also strips a list item's bold label and the other Wikipedias'
names from `SITE_NAMES` in `fold-chat-mind.js`.) Falsifier: `namesIn("According to Wikipedia [W1], Gustave Eiffel built the
tower.")` is `["Gustave Eiffel"]`, and a false figure or an absent name behind the same packaging is still rejected.

## 4. `organs/cite.js` — `attribute`: figures and predicate read in the SAME window (defects 1 and 2)

The khora attributes a sentence to a passage on a shared run and a name veto; it never asks whether the sentence's figures
are in the passage, and `grounding.js` asks it only over all passages pooled. The fork's measured defects, and the
structure that closes them (all in `fold-chat-ground.js::attribute/analyse/verify`, tested in
`fold-chat-ground.test.mjs`):

* cut the passage into sentences with offsets; a claim is checked against a WINDOW (a sentence and one either side),
  chosen by how much of the claim's figures / names / content terms it carries, not by the longest run;
* every figure of the claim must be in the window (`figureMatches`, below); a figure belongs with the words it sits beside
  in the claim: at least half of its nearest content words must stand in the figure's own clause in the window
  ("landed … July 16" is not "launched … July 16");
* a name that is not the passage's subject must be in the window, and is bound to the words beside it in its own sentence
  ("Sydney … capital");
* every content term (not a function word, hedge, or a word that only reports a measurement) must be on the passage at all
  ("pasta", "wood", "volcanic" are not), and a claim whose terms mostly sit outside the window is not this window's;
* the cited span is searched only in the sentence that carries the evidence, so the quote shown is the sentence that says it.

A sentence the `grounding.js` pooled check passes can still fail here; that is the intended difference.

## 5. `organs/grounding.js` — `numberSet` / `hasNumber`: a declared unit table and rounding to the claim's own precision (defect 3)

`hasNumber(numbers, token)` is exact string membership, so 330 m is never 1,082.68 ft, 0.33 km, or 8,849 for 8,848.86.
The fork's table is small and declared (length: m km cm ft mi; mass: kg g lb; spellings in en es fr de pt ru zh ja ar hi).

```js
// figureMatches(c, w): c = the claim's figure { v, dec, unit }, w = a figure of the material.
// same figure | same dimension in another unit, to the precision the CLAIM states | the claim's rounding of a decimal
const nearFig = (v, c) => Math.abs(v - c.v) <= 0.5 * Math.pow(10, -c.dec) + 1e-9 * Math.abs(c.v);
function figureMatches(c, w) {
  if (c.norm === w.norm) return true;
  if (!c.numeric || !w.numeric) return false;
  if (c.unit && w.unit) return c.unit.dim === w.unit.dim && nearFig(w.v * w.unit.f / c.unit.f, c);
  if (w.dec > c.dec) return Number(w.v.toFixed(c.dec)) === c.v;
  return false;
}
```

Tolerance is for units only — years are not within "rounding" of each other. Digits of other scripts (`१९४७`, `٢٠٢٤`)
are mapped to ASCII one for one before extraction (`asciiDigits`). Falsifiers: `eval/controls.mjs` DER (11 of 12 true
unit / paraphrase accepted) against NEG (26 of 26 false rejected, single and pooled).

## 6. What is NOT a khora patch

* Cross-language grounding. A claim in Spanish against an English passage cannot share a phrase. The fork does not fake
  it; it returns the typed reason `cross-language` on the entry, `gaps` on the record and a one-line note
  (`languageGapNote`). The khora's `Intl`-free `foldDiacritics`/`tokenize` would need the same typed reason, not a
  translation table. Real cross-language grounding needs the khora's retrieval (activation) to find a same-language
  source — that is `docs/NEXT-ARCHITECTURE.md`'s job, not the gate's.
* Retrieval (`fold-chat-web.js`) is the chat's own and was fixed in the-fold.
