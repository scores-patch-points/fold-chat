# UDHR falsification — RESULTS (2026-10-07)

Pre-registration `UDHR-FALSIFY-PREREG.md` (written before any run; it was NOT edited). Instrument
`udhr-falsify.mjs`; corpus = the 516 UDHR translations on disk. Ground truth = each file's declared language.
The run's raw numbers are in `results/udhr-falsify.json` (regenerated deterministically; determinism checked
0 re-read divergences). Fixes/claims unchanged since the prereg. One instrument bug (header leak into the
sample) was fixed BEFORE the deciding runs and is reported below; the deciding numbers are from the corrected
sample (real prose, no header).

## Deciding numbers (corrected run)

| measure | value |
|---|---|
| UDHR files parsed | 516 |
| …whose language the detector has a prior for (mapped to the fold's 40 codes) | 51 |
| …with NO prior (all must come back `unknown`) | 465 |

| claim | verdict | measured |
|---|---|---|
| **C1 — never confidently wrong; a no-prior language must be `unknown`** | **REFUTED** | on the full sample, **309 of 516** files were given a confident language the detector has no prior for (e.g. files 007→`pt`, 008→`it`, 011→`id`, 023→`zh`, 026→`ko`, 028→`en`, 029→`mt`, 030→`tr`). On the short first sentence: 270 of 516. The detector does not abstain when it lacks ground — it names the nearest prior. |
| **C2 — the 22 E2E languages on full UDHR** | **STANDS** | confident-RIGHT **20/20** (2 of the 22 have no file on disk); confident-wrong **0**. |
| **C3 — the SHORT first sentence of UDHR, same languages** | **STANDS** | confident-RIGHT **20/20**, wrong **0**. (With a prior, short text is fine — the earlier "short text implodes" was the header-leak artifact.) Short, with-prior across all 51: 51/51 right, 0 wrong. The 270 short-wrongs are all no-prior files again. |
| **C4 — embeddings (nomic) don't beat the shape** | **UNMEASURED** | prototypes of UDHR sentences per language could not be built: the harness's sentence-split of its truncated (700-char) sample produced < 3 long sentences for every language ("too short / embed unavailable"). No embedding A/B was made. This is an instrument limitation, NOT a model result. |
| **C5 — the declared-clue fix stands (ru/uk/bg; es ¿¿; de-after-en; en-after-de)** | **STANDS** | the regression suite `fold-chat-langid.test.mjs` 16/16 including the 2026-10-07 cases; the full lang suites 23/23. |

## What this proves, honestly

1. **The "shape" reads well WHEN it has ground.** 51 for-51 right on full UDHR, 51-for-51 on the short first
   sentence, 20-for-20 on the app's own 22 languages, deterministic (0 divergences). The script+ngram+clue
   detector is not weak on its own territory — it just trained (treebanks) + declared clues. The E2E failures
   were short-input + thin-prior noise, and the clue fix removed them.
2. **The detector cannot tell when it has no ground.** 309 of 516 UDHR languages are confidently (re)named as
   some prior-bearing language. That is the C1 refutation and it is the important one: a no-prior language is
   `pt`/`id`/`zh`/`en` at random-ish, which is exactly the "answered in the wrong language" failure mode.
   The flask it needs is an abstention gate: if the top candidate's fit/floor is too weak, say `unknown` —
   not a guess.
3. **The UDHR corpus is the right instrument to close both sides**: it gave us ground truth for 516 languages
   in minutes and it is the training set for fixing the instinct (build priors from the UDHR's own text, so
   "no-prior" shrinks; and a pairwise "does the winner's prior actually FIT this text" gate so the rest abstains).
4. **Embeddings are still untested here** (C4 UNMEASURED) — the "is this a good place for embeddings" question
   gets a fair A/B only after the harness's prototype extraction is fixed; it is not a pass.

## Falsifying cases (the ones that fired)

- no-prior confident guesses: `udhr-007 -> pt`, `udhr-011 -> id`, `udhr-023 -> zh`, `udhr-026 -> ko`, `udhr-028 -> en`, `udhr-029 -> mt`, `udhr-030 -> tr`, `udhr-032 -> tr` (full and short both).
- controls that held: every prior-bearing language, full and short, right; determinism 0/0; es `¿…` stays Spanish after an en thread; `Кто/Хто/Кой»` correct.

## What did NOT get measured

- C4 (embedding A/B) — harness limitation; a follow-up will fix the prototype extraction (use the raw corpus
  articles, not a truncated sample) and re-run against the same prereg thresholds.
- Anything that would have required the browser or the model for the DETECTOR claims — none; the detector is pure.
## Addendum 2 — the coverage attempt (built 2026-10-07), and the survival verdict

The falsification's constructive verdict was "fix by coverage": the detector is 51/51 on ground it has and cannot
abstain cleanly, so build a prior from every UDHR translation and turn "no prior" into "has a prior". That was built
(`scripts/build-udhr-priors.mjs` → 470 new priors, 510 total) and measured as a SECOND tier so it could not pollute the
tuned 40 — core scored first, UDHR only after the core abstains (`identify` `tier`, `minUdhVocab` 0.25, normal margin,
≥2 tokens). Deciding re-run:

| bar | result | verdict |
|---|---|---|
| core suites (app's 40) | 26/26 green (C2 20/20, C3 20/20 unchanged) | **SURVIVES** |
| UDHR-only tier accuracy (470 new languages, full UDHR sample) | **179/448 right; 258/448 WRONG (42%)** — the errors are family-right/code-wrong (a creole read as its base; a dialect read as the standard) | **FAILS the routing bar** |
| the app's own languages | core 20/20 short AND full | **STANDS** |
| determinism | 0/0 | STANDS |

Reading it: the shape detector, at 470-language resolution, misattributes close dialects — worse than abstaining for
ROUTING (a wrong language name tells the model to write the answer in the wrong language). The UDHR tier is therefore
**a suggestion at best, kept behind the tier switch, NOT wired as routing** (the product should say `unknown` rather
than guess). The core 40 + declared-clue fixes are the configuration that survived: they are wired already (the app
detector), and that is what "wire into khora and everywhere needed" should carry.

Changed-claims rule: C2/C3 thresholds were re-verified, not edited; the new tier's own declared constants
(`minUdhVocab` 0.25, margin, ≥2 tokens) were written before its deciding run. UNMEASURED: the embedding A/B (C4)
still could not build prototypes (harness sentence-split); it remains untested, not passed.
