# P2 results — answerSpan: the smallest span that answers (2026-10-07)

Built: `fold-chat-answerspan.js` (pure, no model; `answerSpan`, `verifyRewrite`, `classifyAsk`, `quantitiesIn`, `datesIn`, `isMinimal`, `RULES`), `fold-chat-answerspan.test.mjs` (83 tests), `eval/ants/p2/*` (harness, asks, results, mutation check), UNAPPLIED `eval/ants/p2/wire.diff`. Pre-registration: `eval/ants/P2-PREREG.md` (written before any run; amendment log appended at its end). Freeze record: `eval/ants/p2/FREEZE.json` (sha256 of the module, asks and scorer at each stage).

## The one-paragraph answer

On real pages the mechanical span is **about 15-25x more precise than what the strand shows now** (median shown text 82-120 characters against 1,450-1,600; median precision against the hand-written minimal clause 0.28-0.67 across the rounds vs 0.024-0.035) and it returns a typed gap on 82% of unanswerable asks where the strand ships text on 100% — **but it contains the answer in only about two asks in three (pooled out-of-sample 66.7%), no better than the strand's own 70.4%**, and its confidence barely separates right from wrong (AUC 0.65-0.75). So it must not *replace* the group: span first, its sentence one tap away (open by default when confidence < 0.9), the group behind "more from this page". Span-or-strand reaches the answer in 88.9% of pooled out-of-sample asks. Two of the pre-registered thresholds were missed on the pre-registered run and I report that first.

## 1. The pre-registered run (v1 module on HELD, run once, `results-held-v1.json`)

HELD = 89 asks over real pages: 70 answerable, 16 unanswerable, 3 asks in languages with no table (the right outcome is a typed gap). Each ask is a 3-passage turn (the page that does or does not state the answer + 2 real distractor pages). Gold (`key` = the answer, `min` = the shortest verbatim clause with its subject) was written by hand from the page text; it is checked by code to be a substring of the page. Frozen by sha before the run. The strand arm is the CURRENT `snipsOf` on the same passages (everything the user would see, all passages).

| gate (PREREG) | threshold | v1 on HELD | verdict |
|---|---|---|---|
| T1 contains the answer | >= 0.80 | **70.0%** (49/70; Wilson 58-79) — strand 68.6% (48/70) | **MISSED** |
| T2 median precision, all answerable (a miss counts 0) | >= 0.30 and >= 3x strand | **0.520** vs strand 0.024 (21x); hits only 0.896 vs 0.034 | met |
| T3 typed gap on unanswerable | >= 0.70 | **14/16 = 87.5%** (strand shipped text on 16/16) | met |
| T4 confident-wrong (span shipped, lacks the answer) | <= 0.10 | **20.0%** (14/70) | **MISSED** |
| T5 every shipped span verbatim-verifiable; hostile rewrites rejected | 100% | 65/65 (73/73 incl. 2nd spans, independent re-check); hostile cases rejected in tests | met |
| T6 minimality (no clause removable while answer + subject stay) | >= 0.70 of hits | **57%** (28/49) | **MISSED** |
| T7 non-English contain-or-typed-gap / confident-wrong | >= 0.75 / <= 0.10 | 77% (10/13) / **23%** (3/13) | first part met, second **MISSED** |
| T8 every gate has a test that fails when it is deleted | 100% | not measured at v1; **63/63 killed on the final module** (`mutate.mjs`) | met (final module) |

Median shown text: span 82 characters, strand 1,602. Precision quartiles (10/25/50/75/90): span 0/0/0.52/0.98/0.99; strand 0/0/0.02/0.04/0.08.

## 2. What happened after (stated plainly: these rounds are NOT pre-registered)

The v1 misses were read, generic bugs fixed, and a **fresh held-out set was written before each new version was run** so every round has a clean test; the earlier sets become in-sample. Stages (`FREEZE.json` records each sha):

| round | module / set | span contains | strand contains | span-or-strand | median precision span / strand | typed gap on unanswerable | confident-wrong |
|---|---|---|---|---|---|---|---|
| 1 pre-registered | v1 on HELD (n=70) | 70% (49) | 69% (48) | 86% (60) | 0.52 / 0.024 | 14/16 | 20% (14) |
| 2 clean | v2 on H2 (n=30; 42 asks) | **57% (17)** | 70% (21) | 90% (27) | 0.28 / 0.035 | 9/10 | **37% (11)** |
| 3 clean | v3 on H3 (n=35; 48 asks) | 69% (24) | 74% (26) | 94% (33) | 0.63 / 0.034 | 8/12 | 20% (7) |
| **pooled clean (1+2+3)** | n=135 | **66.7% (90)** | **70.4% (95)** | **88.9% (120)** | | **31/38 = 82%** | **23.7% (32)** |
| 4 final, IN-SAMPLE | v4 on HELD | 80% (56) | 69% | 90% | 0.67 / 0.024 | 14/16 | 14% |
| | v4 on H2 | 73% (22) | 70% | 90% | 0.59 / 0.035 | 9/10 | 20% |
| | v4 on H3 | 69% (24) | 74% | 94% | 0.63 / 0.034 | 10/12 | 17% |
| | v4 on DEV (30 asks the module was built on) | 90% (27) | 70% | 93% | 0.98 / 0.031 | 4/4 | 10% |

v4 numbers are in-sample (every set informed some change): they show what the fixes bought on the asks that motivated them, not how v4 will do on new asks. The last honest out-of-sample numbers are rounds 1-3 and their pooled row. Wilson 95% intervals are wide (H3 span 69%: 52-81; pooled 66.7%: 58-74).

What each version changed (all in `FREEZE.json`, tests for each in the test file, each gate mutation-checked):
- v2 (after HELD): the ask's language is decided by its own closed classes (the detector read "When was Albert Einstein born?" as German and produced a language gap: four answerable asks were lost that way in v1); a bare month ("the March on Washington") is not a date; a biographical-lead shortcut ("Name (14 March 1879 – 18 April 1955)"); "according to X" in an ask is not a content term; a year in a page's title that the ask does not name marks a narrower page; a parenthesised series is content; the chrome gate judges the SHOWN span, not the whole sentence (a 40-word sentence ending in a list of names was called chrome and a correct reason was lost); lead sentences up to 130 words; Russian four-letter stems; compound units ("metres per second"), "how long" accepts a duration, ₹.
- v3 (after H2): the asker's own measure word ("population") outranks a synonym ("residents"); a unit the asker names fixes the dimension ("how many metres" is a length); a split at "U.S. state" is not a sentence end; a definition may open with the asked words and any verb; a figure in a parenthesis right after another figure is its conversion, not a second answer; "named after" is a word-history cause; an `agreement` count (other passages' best spans with the same atom).
- v4 (in-sample): `predWeight` 2 (a missing predicate word costs double; chosen by `sweep.mjs`: gap on unanswerable 35/42 -> 37/42, contains 132/165 -> 129/165) and "boiling point" is one measure word (found when the slot-pipeline smoke test returned null for the flagship ethanol ask on a one-sentence passage).

## 3. Verbatim-verifiability, minimality, speed

- (d) Every shipped span, over the four sets: verbatim substring of its page (or declared FAQ item) at the reported [start,end), and the shown text is those bytes or `verifyRewrite` re-derives it by the named rules; no digit run that the source lacks. held 77/77, H2 30/30, H3 36/36, dev 31/31 (`verify-*-v4.json`, an independent check, not run.mjs's). 63/63 mutants of the module's gates are killed by the 83 tests (`mutation-results.json`, `mutate-v4.log`); `verifyRewrite` rejects a forged figure, a paraphrase, an unnamed rule, a bad range, a mis-ordered rule list and an out-of-range antecedent (tests).
- **The named rewrite rules that actually fired on the 159 shipped first spans:** `terminal-stop` 58, `capitalise` 24, `strip-aside` 13, `tidy-space` 9. **`resolve-pronoun`, `unit-swap`, `attribute-quote`, `drop-marker`, `decode-entities` and `strip-citation` fired 0 times** on real data (`rulecount.mjs`). They are tested on synthetic strings only. Pronoun resolution refuses unless the previous sentence has a clean, unrivalled subject that holds a word of the ask; on real Wikipedia text the antecedent is usually the page's subject, not the previous sentence's ("It received 9.0 million visitors in 2025." stays "It received …"), so the rule is safe and nearly inert.
- (c) Minimality by clause-removal: 55-71% of hits (v4: held 55%, H2 50%, H3 71%). It is a strict test (any removable clause fails); median precision of hits is 0.73-0.98. Over-wide spans (>2x the gold clause): 14/56 on HELD, mostly whole sentences kept because their subject or predicate sits in a distant clause; fragments (<0.6x gold) 1.
- Speed: CPU time of one `answerSpan` call, 3 passages of up to 24,000 characters each: median 160 ms, p90 222 ms, max 367 ms (`cpu-held-v4.json`; v1 225 ms). Wall times in the run logs (2-3 s) are inflated by a machine load average of 90-250; CPU time is the figure.

## 4. By ask type (v4, HELD + H2 + H3 pooled, answerable asks; span / strand contain the answer)

figure 31/39 (79%) / 23 (59%); date 17/29 (59%) / 20 (69%); name 12/17 (71%) / 13 (76%); place 11/13 (85%) / 9 (69%); definition 16/19 (84%) / 19 (100%); list 2/4 / 2; reason 5/6 / 2; yes/no 8/8 / 7; unanswerable 33/38 typed gaps, strand shipped text on 38/38. The span is best at figures with units and places; **dates are its weak type** (a date sentence without the asked verb loses to a sentence that has it). The strand is better on definitions and dates because it ships the whole lead.

## 5. Language coverage

Closed-class tables (wh-words, auxiliaries, measure words, months, causal markers) exist for en, es, fr, ru, zh (function words come from `functionWordsOf`). Any other language gets a typed gap (`kind: "language"`), never a guess: the de, pt and ja asks all gave it (6/6: 3 on HELD, 2 on H2, 1 on H3). Pooled supported-language asks (HELD + H2 + H3, v4): es 1/4 contain (3 wrong spans), fr 2/4 (2 wrong), ru 3/6 (2 wrong, 1 gap), zh 2/4 (2 gaps) — small numbers; the tables are thin (a measure noun the table lacks gives `want: other` and a weak match) and Han text is read as character pairs because **`Intl.Segmenter` in this Node build cuts Han text into single characters** (so the ask's terms are bigrams; `fold-chat-mind.js` `segments` would do the same, which is worth knowing for every module that relies on it). Caseless scripts have no name atoms: a "who" ask in zh returns a gap.

## 6. Error taxonomy (the 33 misses of v4 on HELD + H2 + H3; plus the unanswerable failures)

| class | n | what it is | examples (ask id) |
|---|---|---|---|
| wrong sentence, right page | 17 | a sentence that shares more of the ask's words beats the one that states the answer; the ask and the page use different words | "Who created Python?" -> `NOP … needed to create an empty code block` (h27; the page says "began working on"); "Who founded Rome?" -> "dates the founding of Rome at around 753 BC" (h29; the page says "founder"); "Where is Heathrow located?" -> a lounge "located land-side" (h35; the page says "lies 14 miles west of"); "How long is the Great Wall?" -> "3,080 km … long in total", a sub-total, not the 21,196 km (d03); "the average distance from the Earth to the Moon" -> "spiraling away … at an average rate of 3.8 cm per year" (h05) |
| gap on an answerable ask | 11 | too few of the ask's words found (synonym, a predicate the page words differently, a measure the table lacks) | "When did the French Revolution end?" (p09), "When did the 2025 NBA Finals end?" (p11), zh/ru definitions and dates |
| right sentence, wrong atom or trim | 4 | the span is cut before the answer or keeps the wrong figure of the same dimension | "When was the PS5 launched in North America?" cut before "on November 12, 2020" (p06) |
| wrong page | 1 | a distractor passage's span outranks the right page | n01 |

- **Wrong figure in the same sentence / same dimension**: 4 right-sentence cases above; the nearest-to-the-asked-word rule picks the figure next to the cue word ("tall", "population"), which is wrong when the sentence also gives a record, a subtotal or an earlier value.
- **Coreference**: the answer sentence begins with a pronoun in 4/56 (HELD), 1/22 (H2), 0/24 (H3) of the hits and the rule resolves none of them (see section 3): a shipped "It received 9.0 million visitors in 2025." is true but only understandable next to its page. 0-9% of hits ship with no word of the ask at all ("noSubject": 4/56, 2/22, 0/24).
- **Scope**: one ask in five is answered by a statement about a narrower or wider thing than the one asked (metropolitan area vs city, a single year's page vs all-time, a 1% subtotal).
- **Table text**: not tested. The pool is Wikipedia plain text and declared FAQ blocks; no ask was built over a table, a code block or a wiki infobox. `fold-chat-region.js` `tableRowsOfHtml` is the existing row reader and this module does not replace it.
- **Valid answers the frozen scorer counts as misses** (so the headline is, if anything, slightly low): h13 (the speed of light given in miles per second), n01 (Spanish "jueves 9 al viernes 10 de noviembre de 1989"), h21 ("in 1969" for "when did the landings begin"), k14 (a more specific location), k20 (the definition is right; `strip-aside` removed the acronym "(CNS)" that my gold key contained). About 5 of 33.
- **Unanswerable failures** (v1 HELD u03, u10; later H2/H3): near-miss entities. "How much does Mount Everest weigh?" -> "theodolites each weighing 500 kg"; "How long does it take to get a UK passport?" on a US-passport FAQ -> "4 to 6 weeks"; "Who invented the Windsor knot?" -> a sentence about why it was invented. Two H3 "unanswerable" asks were answered correctly from the distractor page (the mascot of Euro 2024 is on the "UEFA Euro 2024" page): my labels are relative to the primary page — a labelling flaw, left as scored.
- **Calibration**: the confidence score separates hits from confident-wrong weakly: AUC 0.75 (v1 HELD), 0.68/0.66/0.65 (v4 HELD/H2/H3). At >= 0.9 it keeps 41/49 hits and 6/14 wrongs (v1 HELD, post-hoc). It is a ranking, not a probability; the wire diff therefore never hides the sentence behind a tap for a span below 0.9.
- **Findings about shared code**: (1) `junkOf` flags the plain sentence "Booth conceived a plan to kidnap Lincoln in order to blackmail the Union into resuming prisoner exchanges, and he recruited Samuel Arnold, George Atzerodt, … and John Surratt to help him." as `leads-with-chrome` (a structural, not lexical, hit on the run of capitalised names); the strand's own gate would drop it too. (2) `junkOf` calls "Ethanol boils at 78.37 °C" a `fragment` (5 words, no stop), so a minimal span cannot go through the strand's `add()` gate; the wire pushes span snips after their own verification. (3) `sentencesWithOffsets` splits at "the U.S. state" (a dotted acronym before a lowercase word); this module merges a lowercase-starting "sentence" back. (4) `detectLang` reads short questions full of names badly.

## 7. The user's own failure, end to end

"what is the boiling point of ethanol" over the Mariana-Trench FAQ page (real HTML, JSON-LD FAQPage, 6 items): the strand shows the FAQ block (4,264 characters; its first item is "What is the Mariana Trench? — …"); `answerSpan` returns the typed gap "no sentence in what was read states this". With a page that states it ("Ethanol boils at 78.37 °C, which is lower than water, and …") `answerSpan` returns exactly "Ethanol boils at 78.37 °C." (unit test; and through the patched slot pipeline in a smoke test: `minimalOfTurn` -> `answerLine` -> `contentAllowed` true). "How tall is Mount Everest in feet?" over the magicalnepal FAQ page: strand 2,321 characters (three FAQ items); span "29,031.7 feet, or 29,031 feet and 8.5 inches." "How many passengers did Heathrow serve in 2021?": strand 1,546 characters from the lead; span "In 2021, Heathrow served 19.4 million passengers."

## 8. Wiring (UNAPPLIED: `eval/ants/p2/wire.diff`, `patch -p1 --dry-run` is clean on the current tree)

Sources-only mode (`fold-chat-strand.js` `snipsOf`): one `answerSpan` pass; the span is the first snip (kind "span": `text` = the mechanical final pass, `verbatim` = the page's bytes, `context` = its sentence, `rewrite`, `confidence`, `agreement`), every other snip is `more: true`; `verifySnip` checks span snips (and re-derives the rewrite); no span -> the groups as today plus `minimalGap`. Strand view: span large; "the sentence" toggle (open by default when confidence < 0.9 and no second page agrees); "more from this page" as `<details>`; typed gap line. Slot pipeline (`fold-chat-answerwire.js`): `minimalOfTurn` cuts the span from `answer.row.sentence`, `answerLine` returns it, `answerTurnBacksContent` accepts it. Tertiary (encyclopedia) passages never supply the span. Off switch `STRAND.minimal = false`. The answer card (`fold-chat-presentview.js`) needs the same two-line draw; not included.

## 9. What I did NOT do

- No model arm (neither as the module nor as a labelled comparison); no model-written word exists anywhere in this atom.
- No wiring applied; no edit to the strand, snip, chat, index, presentview, styles or vendor; no git add/commit/push; no browser pane.
- No table, infobox or code-block asks; no scanned/PDF text; only en/es/fr/ru/zh tables (ja, de, pt, ar, hi, … get a typed gap).
- No measurement of `agreement` (my distractor pages are mostly unrelated, so two independent pages rarely carry the same atom; it is reported by the module and used only in the wire's open-by-default rule, unmeasured).
- No latency measurement in the browser; CPU time in Node only.
- No clean test of the final v4: every set is in-sample for it. v4's `predWeight` 2 was chosen by an in-sample sweep over all four sets.
- No calibration of confidence beyond reporting AUC; thresholds 0.62 (typed gap) and 0.9 (the wire's open-by-default) are declared, not fitted.
- The pronoun, unit-swap, attribution and entity rules are evidenced by tests on synthetic strings only (0 firings on real data).
- I peeked at three HELD asks (h54, h01, u08) in a smoke test of the wiring after the freeze and before the first full run, and read the HELD misses to write v2; both are stated in the freeze/amendment record.

## 10. Reproduce

`node --test fold-chat-answerspan.test.mjs` (83) · `node eval/ants/p2/mutate.mjs` (63/63) · `node eval/ants/p2/run.mjs <dev|held|h2|h3>` (writes `results-<set>.json`; `*-v1/-v2/-v3/-v4.json` are the stored per-round results; the v1 module is `answerspan-v1-frozen.js`, sha in `FREEZE.json`) · `node eval/ants/p2/summarize.mjs results-held-v1.json …` · `taxonomy.mjs`, `verify-all.mjs`, `cpu.mjs`, `rulecount.mjs`, `sweep.mjs <weights>`. Authoring aids (`pool.mjs`, `find.mjs`, `show.mjs`, `sent.mjs`, `gather.mjs`, `showhtml.mjs`, `dbg.mjs`) read the real pages already on disk (`eval/snips/data/pages`, the Wikipedia extracts and raw HTML in `eval/snips/cache`); no network was used.
