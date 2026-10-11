# F2 PRE-REGISTRATION — checks 4 SEG, 5 CON, 6 SYN of `falsifiersOf` (fold-chat-present.js)

Written 2026-10-06 BEFORE any harness run, before any of my cases was scored. Never edited after a result exists.
Ant F2. Files: this file, eval/ants/F2-RESULTS.md, eval/ants/falsify-checks/f2/*. fold-chat-present.js is vetoed (read-only).

## What counts as "flagged" / "pass" (read from the code, before running)
The "N of 9 checks flagged" line (fold-chat-presentview.js ~353) counts a row as FAILED if any of its three grains
(ground / figure / pattern) is `failed`, else FLAGGED if any grain is `gap` or `refused`. `held`, `open` and `n/a`
are NOT flagged. So a row PASSES ("clear") when no grain is failed/gap/refused. I measure two things per row:
  * `fig`   = the status `falsifiersOf` gives the figure grain (held|failed|gap|refused|open|n/a)
  * `shown` = what the user sees under the display rule above: failed | flagged | clear
"Catch" = shown is failed or flagged on a DEFECTIVE record. "False flag" = shown is failed or flagged on a CLEAN record.
Precision of the strong form ("failed", not merely flagged) is reported separately.

## How records are produced (real beats synthetic; each case is labelled)
  REAL      : a real turn driven through the real page (eval/pivot/chat-live.mjs openChat/say, Fold server :8815, gemma2:2b),
              the stored `grounding` record (facing, unsupported, tape incl. k6 meaning checks) taken as-is. Labelled by me
              from the answer text + the sources it read, BEFORE I look at what the checks say (labels file written first).
  SYNTH     : a hand-written (answer, passages) pair put through the REAL code that builds a record: `turnRecord()`
              (fold-chat-ground.js) for facing/unsupported, and `computeCheck`/`tripleOf`/`sameMeaning` EXTRACTED VERBATIM
              from fold-chat-presentview.js (not re-implemented) for the tape k6 checks. Crosscheck by the real `falsifyAnswer`.
              Where possible the passages are real passages captured in REAL turns (marked `realMaterial`).
  I will not hand-set `status` fields. Synthetic is always labelled synthetic; any headline number is reported with
  the real-n next to it.
Sizes: >= 12 CLEAN and >= 12 DEFECTIVE SYNTH records per check, and >= 12 REAL turns for a "natural clean rate"
(real turns have no seeded defects; their label is whatever I find on reading).

## Claims (each is refuted by a concrete counterexample or by missing its threshold)

### SEG — "Is the boundary right — date, place, entity?"
 S1 PASSABLE: SEG reaches `held` on honest well-sourced answers that contain dates/figures: held on >= 70% of
    CLEAN-with-a-date SYNTH records, and shown-flagged on <= 20% of ALL CLEAN SYNTH records. (Counter: ordinals, "the 45th
    and 47th", years in a sentence, page numbers, number words, ranges cause failures.)
 S2 CATCH wrong date/year/figure: catch >= 70% (n>=8 SYNTH defects).
 S3 CATCH wrong place / wrong entity swapped in: catch >= 70% (n>=4). (The check's own question names place + entity.)
 S4 CATCH stale fact ("the current president is Biden", source dated 2025): catch >= 50% (n>=4).
 S5 NOT VACUOUS: among records where SEG says held, >= 90% contain >= 1 date or figure in the answer
    (held must mean "compared", not "had nothing to compare"). Measured on REAL turns and SYNTH.
 S6 TRUTHFUL: the `found` text "dates and figures match the sources' own" is shown only when something was compared;
    and a `failed` is never produced by a figure the sources do state (a witnessed one, a ranking/ordinal).

### CON — "Does the link hold, with the same polarity?"
 C1 PASSABLE: on CLEAN SYNTH, `fig`==held on >= 50% and shown-flagged on <= 20%. (Counter: `touches` => gap is the common
    outcome of honest paraphrase; a harmless "no/not" in the sentence => false `failed`.)
 C2 CATCH dropped "not" (source "X is not Y", answer "X is Y"): shown failed >= 70% (n>=4).
 C3 CATCH added "not" (source "X is Y", answer "X is not Y"): shown failed >= 70% (n>=4).
 C4 CATCH wrong link (right entities, wrong relation/object, no negation): shown flagged-or-failed >= 50% (n>=4).
 C5 NO FALSE FAILURE from a harmless negation word elsewhere in a clean sentence ("No other planet…", "nothing less than",
    "not only … but also", "Nobel", "not just"): shown failed on <= 10% of such CLEAN records (n>=4).
 C6 TRUTHFUL: `held` ("each link matches a link a source makes, same direction") must not be shown when every claim's
    meaning level is `none` (no link was matched at all).
 C7 LOCUS: CON's row must not be driven by something other than links. The pattern grain of CON becomes `failed`
    whenever rec.agreement has >1 value groups (sources disagree on a *figure*): that is not a link or polarity.
    Refuted if a record with agreement-disagreement and perfectly matching links shows CON failed anyway.

### SYN — "Does the whole hold, not just its parts?"
 Y1 PASSABLE: on CLEAN SYNTH answers with a causal/total word and sourced chain, `fig`==held on >= 60%; shown-flagged on
    <= 20% of ALL CLEAN SYNTH.
 Y2 CATCH unsourced cause/total claim (a "because/therefore/led to/total" sentence no source states): shown failed >= 70% (n>=4).
 Y3 CATCH figures that do not sum ("12 + 7 + 5 … in all 30") when each part is sourced: catch >= 50% (n>=4).
    (The test text promises "recompute the whole"; the code contains no arithmetic.)
 Y4 CATCH a wrong whole built without any CAUSE-regex word ("which means", "so", "making", "as a result", "thus",
    "which explains", "hence"): catch >= 50% (n>=4). (CAUSE regex is a closed word list.)
 Y5 NOT VACUOUS: `n/a` or `held` on records with no causal word gives the user "clear". Among REAL turns, report the
    fraction where SYN is n/a; claim: < 50% (otherwise the check is untested on most answers).
 Y6 TRUTHFUL: `held`'s text "each link of N causal steps is sourced" is shown only when each sentence is sourced
    AND the numbers sum; refuted by any held record whose total is wrong.

## Verdict rules (fixed now)
 USEFUL     = can reach clear on clean AND overall defect-catch >= 70% AND clean false-flag <= 20% (SYNTH), with real-turn
              behaviour not contradicting it.
 NOISE      = flags clean answers at > 20% or fires on structure unrelated to its question, regardless of catch.
 BROKEN     = a claim above is refuted by a constructed counterexample that an honest user would hit (cannot reach held,
              or catches < 30%, or its text states what the code did not do).
 UNTESTABLE-AS-BUILT = the check returns n/a / open / gap on > 70% of REAL turns, so no defect can reach it.
If a threshold is missed, the claim is recorded as FALSIFIED with the numbers; the claim text above is not reworded.
Repairs are proposed only as an UNAPPLIED eval/ants/falsify-checks/f2/F2-fix.diff.

## Addendum A (written before any case was scored; real-turn collection had begun, nothing analysed)
 * C6 is evaluated twice: (a) `falsifiersOf` directly on a record whose claims all have meaning level `none`;
   (b) whether `presentationOf` would draw the falsifiers at all for that record (layout !== "unsupported"). C6 is refuted
   only if (a) shows `held` AND (b) says the row would be drawn for a record with >=1 backed sentence.
 * Clean cases include a `derived` kind (an honest computed number the source does not print: "four days later" -> 22 June
   1815; "1961 to 1989" -> 28 years). They are counted in the clean false-flag rate, and ALSO reported separately so the
   rate with and without them is visible. Thresholds apply to the rate WITH them (an honest user writes these).
 * Display rule is the one in presentview ~353; I additionally record, for each real turn, the page's own "N of 9 checks"
   text read from the DOM (flagText) next to my recomputation, to confirm the harness reproduces the app.

## Addendum B (written after the first synthetic run and after seeing 3 real turns; thresholds above UNCHANGED, first-run numbers kept in results-shapeA-first-run.json)
Finding at that point: the first 3 real stored records carry NO tape `check k=6` entry (so `mc` is empty and CON takes the
cross-reference branch, not the NEG/flips branch). My first synthetic run built records WITH k6 ("shape A"). I therefore:
 * score every synthetic case in two shapes: A = with k6 checks (what mountLive writes when `wrote(...final)` fires),
   B = without k6 (what real turns look like if all real turns confirm it). Record shape is a property of the app, not a tuning knob.
 * the PRIMARY shape for verdicts = the shape of the majority of the real turns collected; the other is reported alongside.
 * No claim, case, label or threshold is changed. A case's `label` was fixed before scoring and is not revisited.

## Addendum C (written after the two-shape synthetic run; before these cases are scored)
Two findings from that run show my first defect sets were partly caught for an incidental reason (the wrong number is a NEW
number, so lexical attribution fails) rather than by a figure/sum check. To test the mechanism itself I add cases that
reuse ONLY figures the source states (file cases-addC.json, scored by the same harness, reported separately; old cases untouched):
 S2b SEG catches a source figure attached to the wrong event ("The Berlin Wall fell in 1961."): catch >= 50% (n=5).
 Y3b SYN catches a wrong total built only from the source's own figures: catch >= 50% (n=4).
