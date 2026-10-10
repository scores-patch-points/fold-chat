# F3 PRE-REGISTRATION — DEF / EVA / REC and the "N of 9 checks flagged" count

Written 2026-10-06 BEFORE any run of the F3 harness. Source read first: `falsifiersOf` in fold-chat-present.js (lines ~238-328),
the headline arithmetic in fold-chat-presentview.js (~L353-355 `flag`/`bad`, and `falsifyEl` ~L203-210).
Not touched: checks 1-6 (NUL SIG INS SEG CON SYN). Vetoed files are read-only; fixes go in `falsify-checks/f3/F3-fix.diff`, unapplied.

Terms. A check is *flagged* if, over its three grains (ground, figure, pattern), any grain is `gap` or `refused` and none is `failed`;
`failed` counts as failed (that is the headline's own rule). `open` and `n/a` do NOT flag in the headline code.
CLEAN record = an honest, well-sourced answer with no seeded defect for that check. DEFECTIVE = a seeded defect for that check
(defined per check below). Cases are authored in `falsify-checks/f3/cases.json` BEFORE the first run and frozen; the real-page records
(`real-records.json`) are collected by driving the real chat (gemma2:2b, real web) and are labelled by hand AFTER collection, with the
label rule written here: *fine* = every sentence of the spoken answer is stated by a page the turn read, by my reading, with no
figure/name that is not on a read page. Real records cannot be seeded; they feed (P) and (AGG), not catch rate.

## Predictions from reading the code (each is a claim a counterexample refutes)

### 7 DEF  "Is each term used inside its definition?"
- D-P1  PASSABLE: `held` is reachable (>=1 clean case returns held). Refuted if no clean synthetic OR real case gives held.
- D-P2  The "definition" is any copula clause: DEF_RX accepts "Paris is the capital of France" as the definition of "Paris".
        Refuted if a case whose only "definition" is a plain predication (no "refers to / means / is defined as", not a gloss) does NOT return held.
        (Prediction: it returns held -> held does not mean "defined".)
- D-U1  USEFUL catch: on >=12 DEFECTIVE cases (term used in a sense other than the source's definition: the source defines X as one thing, the answer
        uses X in another, sharing no 5+-letter content word with the definition) DEF returns gap/failed on >= 80% (>=10/12).
        Refuted (check is not useful) if catch < 80%.  NB the code can only emit `gap` for drift, never `failed`.
- D-U2  False-flag on >=12 CLEAN cases (honest answers, term used in its sense, OR no definition in the sources at all): flagged <= 20% (<=2/12).
        Prediction: REFUTED — clean answers whose terms the sources never define return `gap` ("their sense is the model's"), so DEF flags
        every definition-free clean answer. Threshold for "flag is noise": clean false-flag > 20%.
- D-U3  Defect within a *polysemous* term whose sense-bearing sentence shares a word with the answer (e.g. source defines "bank" as a financial
        institution that holds deposits; answer: "the river bank holds deposits of silt") -> DEF returns held (a miss). Refuted if DEF flags it.
- D-T   Truthful: `found` for held says "used inside the definitions the sources give". Refuted-as-truthful if a held case shows the "definition" is not a definition (D-P2).

### 8 EVA  "Does the comparison hold against a null?"
- E-P1  `n/a` ("no comparison or magnitude claimed") is reachable only when `fz` is null. Prediction: on ordinary non-creative factual answers
        with sources and no figure/name to swap and no CMP word, EVA = `gap` ("swap could not run"), not n/a. Refuted if >=1 such clean case returns n/a or held.
- E-P2  `held` is reachable only via (a) an armed swap that discriminates, or (b) a comparison sentence containing any figure that is a SUBSTRING of the read text.
        Refuted if (b) held is NOT returned for a comparison whose only "baseline" figure is a substring of an unrelated figure (e.g. "2" inside "2019").
- E-P3  The check does not read the comparison's null at all when a swap is armed: a sentence "X is the largest" with a figure and a rival figure in the
        source returns held/failed on swap discrimination, regardless of whether any source states a baseline. Refuted if baseline-free comparison with an armed swap returns gap.
- E-U1  Catch on >=12 DEFECTIVE (comparison/superlative with no baseline stated in any source): flagged (gap/failed) >= 80%. Refuted if < 80%.
- E-U2  False-flag on >=12 CLEAN (no comparison, OR comparison whose baseline a source states): flagged <= 20%. Prediction REFUTED (>50%) because EVA returns gap when nothing is swappable.
- E-U3  CMP is a word list: ordinary non-comparative sentences ("the first president", "the only child", "the last chapter") are treated as comparisons.
        Refuted if a clean no-comparison sentence containing first/only/last/most does not make EVA treat it as a comparison (gap/failed with "comparison").
- E-T   Truthful: found text "no comparison or magnitude claimed" must only appear when none was; "no declared null" must only appear when the code looked for one.

### 9 REC  "Is it still true on the rebuilt ground?"
- R-P1  When the record has no cross-referenced sources, REC is `held` unconditionally ("the ground was rebuilt this turn"): it cannot fail. Refuted if any record with fz null and a changed ground returns non-held.
- R-P2  With sources, REC is a re-label of CON/SIG: REC.failed iff CON.failed(fz contradiction), REC.gap iff some claim is not backed. Measured as the co-occurrence over all records; refuted (REC independent) if agreement of REC-flag with (CON-failed or SIG-not-held) is < 90%.
- R-U1  Catch on >=12 DEFECTIVE (claim overturned by a later retraction/update sentence IN the sources): >= 80%. Refuted if < 80%.
        Two defect families, each >= 6: (a) retraction with polarity flip ("withdrawn / did not"), (b) update with a revised figure of the same unit.
- R-U2  Defect "changed fact on the re-read" (>= 12 pairs: answer built from read 1, ground replaced by read 2 where the fact changed): catch >= 80%. Prediction: UNTESTABLE-AS-BUILT — falsifiersOf takes ONE turn's record and has no second read to compare to; only an overturn that happens to be in the sources of that one record is visible. Refuted if REC catches >= 80% of re-read changes where the new read is the only ground in the record.
- R-U3  False-flag on >= 12 CLEAN: <= 20%.
- R-T   Truthful: "the ground was rebuilt this turn" is true only if a rebuild occurred; the code does not rebuild anything (it reads rec). Check: the found text is emitted whatever rec contains. Also "covers retractions and updates" (test text) is true only where the polarity/figure clash fires.

### AGG  "N of 9 checks flagged"
- A-1  Over >= 20 diverse records (real if possible), on records labelled *fine*, N >= 3 for the majority (> 50%). Refuted if <= 50% of fine records have N >= 3.
- A-2  Of the flagged checks on fine records, > 50% of flags are statuses that mean "could not run / nothing to find" rather than "found a problem"
        (gap with text "not a pass, not a failure", "no definition read", "only one source", "every attestation traces to one site", etc.). I classify each flag text by the code's
        own wording into: PROBLEM-FOUND (failed; refused with unsourced sentences; gap whose text names a competitor/discrepancy) vs NOT-RUN (gap whose text says could not run / no X read / single source). Refuted if <= 50% NOT-RUN.
- A-3  The headline text shows only `bad` when bad>0 (flagged hidden) and only `flag` when bad==0. Verified by reading the arithmetic; harness reproduces it.
- A-4  The headline cannot distinguish a clean-but-thin answer from an answer with a real defect: the distribution of N on seeded-defective records vs fine records overlaps (AUC of N as defect detector < 0.8). Refuted if AUC >= 0.8.
- A-5  Honest alternative: count only `failed`+`refused`-with-unsourced; list NOT-RUN checks separately. Compare discrimination (AUC) and the share of fine records shown as "clean": must beat current by >= 0.1 AUC to be called a fix.

## Mutation discipline
For each of the three checks the harness runs a mutant (check gate deleted: DEF drift test, EVA baseline test, REC contested test) by re-evaluating
on a patched copy of fold-chat-present.js in the scratchpad (never in-tree); the seeded-defect test must lose catches. Reported.

## Verdict rule (fixed now)
USEFUL: catch >= 80% AND clean false-flag <= 20% AND `held` reachable. NOISE: reachable and runs but fails either rate. BROKEN: a code path emits a status/text that is false about what it did, or held is vacuous. UNTESTABLE-AS-BUILT: the defect class cannot be expressed in the record the function receives.
Results are written to F3-RESULTS.md from the harness output only; no case is edited after the first run (a later change = a new numbered case file, reported as such).

## AMENDMENT 1 (still before any run of the harness; real-record collection had started, no synthetic case had been run)
- Case authoring strata (fixed in cases.json before the first run; rates are reported per stratum AND pooled, so a reader can reweigh):
  DEF clean(12) = 4 restate-the-definition, 2 present-tense predication (not a definition), 3 term defined by source and used correctly WITHOUT repeating the definition's words, 3 past-tense facts with no definition anywhere.
  DEF defective(12 easy) = polysemous term, source defines one sense with a copula, answer uses another sense sharing no 5+-letter content word with the definition; plus 6 HARD (sense differs but the answer shares a word with the definition).
  EVA clean(12) = 3 comparison whose baseline a source states, 3 non-comparison with a figure and a rival figure in the source, 3 non-comparison with neither, 3 containing first/only/last/most in a non-comparative use.
  EVA defective(12) = superlative/comparative with no baseline in any source: 6 carrying the entity's own figure (which the source also states), 6 with no figure.
  REC clean(12) = 4 one page, 4 two pages agreeing, 4 with a sibling-entity same-unit figure on another page of the same site list (a realistic distractor). REC defective(12) = 6 retraction (3 with a negation word, 3 worded "retracted/revoked/withdrawn" with no negation word) + 6 update with a revised same-unit figure. REC re-read(12 pairs). Probes (not in rates): 3 temporal-order cases, 4 `noClaims` vacuity cases.
- "Catch" is reported two ways: FLAG-catch (status in gap/failed/refused) and SPECIFIC-catch (the found text names the defect class: DEF "used outside the sense", EVA "no baseline"/"does not tell them apart", REC status failed or text with "contested"). Verdict uses FLAG-catch AND clean false-flag AND whether the flag text is specific; a check that flags both clean and defective with the same text is NOISE.
- Synthetic records are built with the repo's own turnRecord()+agreementOf() over authored pages (so facing/unsupported/agreement are the real functions' output), with tape `quick` events carrying the pages as the real server does. No meaning-organ check events (k=6) are synthesised; this is a synthetic limit. Real records (collected by chat-live's openChat/say, gemma2:2b) carry whatever the real turn made.

## cases.json frozen
sha256 4f6ed84a920f4a22e7e84690af1fffd4cbf15fd35459e6e0f1458cee4b6d2b28, frozen before any harness run (2026-10-06).
