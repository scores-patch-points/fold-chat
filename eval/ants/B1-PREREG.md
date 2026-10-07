# ANT B1 — the thinker-profile classifier: pre-registration (2026-10-06, written BEFORE any classifier run)

Before this file: I read docs/VOICE.md, E1 of docs/ETHOS-PRIORS-STUDY.md, fold-chat-langid.js, the concern-field headers (source paths, sha256, sizes), threads.json and pages.json
(titles and structure only). I have run NO scoring of any text. Nothing below was tuned on a result.

## The question this atom answers
Given a question or a conversation window, WHICH thinkers of the ingested English canon bear on it? Not a term-overlap against concern-field dwellings (falsified, docs/VOICE.md), but a
calibrated PROFILE CLASSIFIER like the language detector: static per-thinker profiles, a background, a threshold fixed on a calibration set for a stated precision, a SESSION PRIOR,
and a typed gap (`undetermined`) in place of a guess.

## What is built (declared, not derived)
* **Thinker** = one canon handle whose source file is English and whose sha256 equals the concern field's recorded hash (a differing file is REFUSED). Handles that share one source
  (huginn/muninn) collapse to the first. Non-English canons (Marcus Aurelius, Nietzsche, Pascal, Boethius, Dante, Goethe, Cervantes, Homer, Virgil, Tolstoy, Rubin, Frege, Ibn Khaldun, the Gita in
  IAST) are named as gaps, not profiled. Technical canons (algebra, materia medica, salmon, evidence law, style) ARE profiled; whether they may speak is the user's roster decision.
* **Features** = CONTENT STEMS: `ground.tokenize` → drop `functionWordsOf("en")` plus a small DECLARED closed set (interrogatives, auxiliaries, archaic pronouns thou/thee/hath…) → `ground.stemOf`, length >= 3, not
  a number. Project-Gutenberg header/footer stripped (everything outside `*** START/END`), as are paragraphs naming Project Gutenberg.
* **Units** = consecutive paragraphs accumulated to >= 40 content stems. **Split BY POSITION in blocks**: units are numbered per file, in runs of 20; run b goes to TRAIN if b mod 5 in {0,1,2},
  DEV if 3, TEST if 4. (So a test unit comes from a stretch of the book no training unit touched, but the SAME book/translator/vocabulary: this measures generalisation across sections, NOT across
  books. A split by file would measure the wrong thing here: one file IS one thinker.) The test set is touched ONCE, after every parameter below is frozen on DEV.
* **Score**: Dirichlet-smoothed query-likelihood ratio against the background (mean of the thinkers' own per-stem frequencies, so each thinker counts equally, not by byte size):
  `s_t(q) = sum over query stems w (count capped at 2) of log((c_tw + mu*p_w)/(n_t + mu)) - log p_w`. Posterior = softmax(s/T) over thinkers (uniform thinker prior), T fitted on DEV by log-loss.
* **Gate (the typed gap)**: `undetermined` unless (a) the query holds >= m KNOWN content stems and (b) the posterior mass of the top-3 thinkers >= tau. m and tau are chosen on DEV (below).
* **Session prior**: the previous turn's accepted thinkers are a head start of `bonus` nats each (like `priorBonus` in langid). A turn with NO known stem inherits nothing: it stays `undetermined` and carries
  the prior in `carried` (never offered).
* Grids, frozen now: mu in {100, 500, 2000, 8000}; T from a log grid 1..60; m in {1,2,3,4}; tau in {0.30..0.95 step 0.05}; session bonus in {0, 1, 2, 4} nats.
  mu chosen by DEV top-3 accuracy at N=12; (m, tau) = the COVERAGE-maximising pair with DEV canon precision >= 0.92 AND DEV negative false-offer rate <= 0.07 (margins over the test bars below).
  If no pair meets both, I ship the closest and report the bar as not met (nothing is loosened).
* Query lengths for held-out canon text: N = 3, 6, 12, 40 content stems, a seeded contiguous run from a held-out unit (questions are short; a window is long).
  Per-thinker macro averages (every thinker counts once), at most 400 DEV and 400 TEST units per thinker (seeded).

## Negatives (text that is NOT canon; nothing of it is used to build a profile)
* **NEG-A** (named by the user): the asks and spoken answers of the 3 LOOKUP threads in eval/voice/threads.json, plus windows (12 stems; and each full sentence) of the 8 Wikipedia pages in
  eval/pivot/data/pages.json. Too small to split, so it is used ONLY to report, never to choose m/tau (its dev role is done by NEG-X). It is reported as the primary negative result.
* **NEG-X** (secondary, more data): windows of ethos organic chat (ubuntu-irc, enron emails, nus-sms English) and of the science/history Wikipedia pages in ethos (Cell_biology, Chemistry, DNA, Entropy,
  General_relativity, Mathematics, Neuroscience, Quantum_mechanics, Thermodynamics, Industrial_Revolution, Cold_War, Ming_dynasty, Mongol_Empire, Byzantine_Empire), split BY FILE into DEV (even index) and TEST (odd), 12-stem windows.
  Philosophy/religion Wikipedia pages (Ethics, Christianity, …) are NOT negatives: thinkers legitimately bear on them.
* **REFLECT** (no bar): the 5 reflective threads' asks, window by thread, with the session prior across turns. These are where the product WANTS an aside; I report who is offered and read it.

## Claims (each can be refuted; failing is reported as a failure)
* **B1-a held-out top-3 accuracy** on TEST (macro, ungated): N=40 >= 0.85; N=12 >= 0.60; N=3 >= 0.25 (chance with ~40 thinkers is ~0.07). Top-1 reported alongside. Predicted miss: N=3.
* **B1-b negatives**: at the DEV-chosen (m, tau), false-offer rate (an `undetermined:false` result) on NEG-X TEST <= 0.10 AND on NEG-A <= 0.10. Every NEG-A offer is listed with its thinkers.
* **B1-c gate precision**: over ACCEPTED TEST canon windows pooled at N in {6, 12, 40}, the true thinker is among the offered thinkers >= 0.90. COVERAGE (share accepted) is reported at each N and has NO bar
  (precision before coverage); I expect it to be low for N = 3.
* **B1-d calibration**: ECE of top-1 posterior on TEST pooled over N in {6,12,40} <= 0.05 (langid missed its analogue at 0.058-0.08; I predict this may miss too and will say so).
* **B1-e session prior**: sessions = (turn 1: N=40 window of thinker X; turn 2: N=4 window of X). Correct prior lifts turn-2 top-3 accuracy by >= +0.10 over no prior; a WRONG prior (a different, random thinker)
  costs <= 0.15; and a prior never creates an offer from nothing: a zero-evidence turn with a prior is `undetermined` in 100% of cases, and NEG-X false-offer with a wrong prior stays <= 0.10.
* **B1-f leakage control**: a profile trained on units whose thinker labels are randomly permuted scores top-3 <= 0.15 on TEST at N=12 (otherwise the profiles are keyed on something other than the thinker).
* **B1-g the 12 contested questions** (written below, before running): READ by me. Prediction: >= 6 of 12 receive an offer (the rest `undetermined`, which is correct when the canon is silent), and of the offered,
  I judge the top-3 plausible (a thinker whose canon really addresses it) for >= 70%. A wrong-but-confident offer is listed as junk. Failing either is a finding, not hidden.
* **B1-h mutation checks**: each gate in `fold-chat-thinkers.js` (the closed-class filter, the minimum-evidence gate, the mass gate, the prior bonus, the no-evidence rule) is deleted in turn and the unit tests must fail.

## The 12 questions (frozen)
1 Is there a God? · 2 What is justice? · 3 How should I treat my enemies? · 4 Is suffering necessary? · 5 Can a person change? · 6 What is a good ruler? · 7 Is it wrong to lie? ·
8 What happens after death? · 9 What is the self? · 10 Why obey the law? · 11 Is war ever just? · 12 What is virtue?

## Known limits stated now
Held-out accuracy tests "which thinker's text is this passage", which is a proxy for "which thinker bears on this question": it rewards a thinker's idiom as well as topic and does not know that two thinkers
agree. The questions are a bag of 1–4 content stems: synonyms ("enemies" vs "foe") are invisible to a word profile. Bearing is lexical here; meaning-level bearing is the reader's job (khora stage 5b+).

---

## Amendment 1 (written after the FIRST DEV run, BEFORE any TEST run; the TEST split has not been touched)
**What the first DEV run showed** (kept as `eval/ants/B1-dev-original-rule.json`; the rule as registered above): canon DEV top-3 accuracy at N=12 was 0.89, but the registered gate (top-3 posterior mass) could
not separate canon from non-canon: NO (m, tau) pair met "DEV canon precision >= 0.92 AND NEG-X false-offer <= 0.07"; the closest (tau 0.95) kept 0.98 precision at 0.12 false-offer. A softmax over canon classes is a
CLOSED-WORLD statistic: any text is "most like" some thinker. Reading the false offers: on the science Wikipedia pages they were Sherrington (neuroscience), Liu Hui / Koopman / Lovelace (mathematics), i.e. the
TECHNICAL canons legitimately own science vocabulary; the rest were a handful of chat windows on a few unknown-name stems.
**Amendment (a declared design change, the user's to edit — docs/VOICE.md open decision 1):** each profile carries `speaks`. The technical canons (`TECHNICAL` in scripts/build-thinkers.mjs: brahmagupta, koopman, liu-hui,
lovelace, sockeye, strunk-white, synapse, thrax, xushen, shizhen, panini, wigmore, tala, bharata, brillat-savarin) stay in the posterior as DISTRACTOR classes (they absorb science/technical text) but are never offered. The
offered list is the top 3 SPEAKING thinkers; the gate's mass is those 3's posterior mass (over ALL classes); the closest class being technical is reported in `why`. Consequences for the claims:
* **B1-a** still reports all thinkers (as registered), now plus a speaking-only line; same bars.
* **B1-c** precision/coverage are over windows whose truth is a SPEAKING thinker (precision = truth among the offered 3). Technical-canon windows are a NEW negative family **NEG-T** (reported, no bar): the share of them that
  receive an offer. The DEV (m,tau) constraint is unchanged: canon precision >= 0.92 (speaking windows, N in {6,12,40}) and NEG-X DEV false-offer <= 0.07.
* Nothing else changes: mu, T, session bonus, bars, the 12 questions, NEG-A (which still cannot choose a parameter).
This is a post-hoc change to the registered design, motivated by DEV evidence, disclosed here; the reader should weigh the B1-b result as "met after an amendment", not "met as registered".

---

## Amendment 2 (written AFTER the first TEST run — not a fresh held-out; read this as exploratory)
**The first TEST run** (Amendment 1's rule; saved untouched as `eval/ants/B1-results-run1.json` and `B1-run1-test-output.txt`) met B1-a, B1-b (NEG-X 5.8%, NEG-A 6.0%), B1-c (precision 97.8%), B1-d (ECE 0.030), B1-f, and the
turn-2 lift/cost of B1-e. It FAILED two registered sub-claims of **B1-e**: (1) "a zero-evidence turn with a prior is undetermined in 100%": 14/15 — the 15th ("ok and then?", one weak known stem) was OFFERED because a 4-nat
head start was enough to clear the mass gate; (2) "NEG-X false-offer with a wrong prior <= 10%": 11.9%. And **B1-g**: all 12 contested questions were `undetermined` (top-3 mass 0.17–0.46 vs tau 0.85): a one- or two-stem question cannot
identify one thinker, and the gate is calibrated on authorship of 6–40-stem windows (coverage at N=3 was 5.8%).
**Amendment 2 (declared design changes, made after seeing that):**
* (a) The gate reads the EVIDENCE alone: the prior reorders the list and re-weights `confidence`, but cannot open the gate (`gatePrior: false` by default; `true` reproduces run 1). This is a fix of a defect the registered claim found, not a loosening.
* (b) `classify()` also returns `candidates` (top-5 speaking thinkers, with `hits` = how often each thinker's TRAIN canon uses the question's known stems) even when `undetermined`. They are NOT an offer: they are what a pointing call could try to
  tie to a verbatim sentence (precision is then enforced by the verifier, docs/VOICE.md behaviour 2). Candidate recall at each N is reported (no bar).
* mu, T, m, tau, bonus are NOT re-chosen (DEV numbers are identical, deterministic); no bar was moved. Run 2 = `node eval/ants/B1-eval.mjs --write` again (results `B1-results.json`). Run 1 stands as the registered result; run 2 is reported next to it.

---

## Results (appended after run 2; run 1 = registered rule + Amendment 1, `B1-results-run1.json`; run 2 = + Amendment 2, `B1-results.json`; DEV choice: mu 8000, T 1.57, m 1, tau 0.85, session bonus 4 nats)
| claim | bar | run 1 | run 2 |
|---|---|---|---|
| B1-a top-3 (all thinkers; speaking only) N=40 / 12 / 3 | .85 / .60 / .25 | .969 (.966) / .884 (.872) / .641 (.626) MET | same |
| B1-b NEG-X TEST false-offer; NEG-A | <= .10 each | 5.8%; 6.0% (9 of 150 listed) MET | same |
| B1-c gate precision, pooled N 6/12/40; coverage | >= .90 | 97.8%; coverage 66.9% (N=3: 5.8%) MET | same |
| B1-d ECE (T=1.57; T=1 was 0.089) | <= .05 | 0.030 MET | same |
| B1-e turn-2 lift / wrong-prior cost | >= +.10 / <= .15 | +0.276 / 0.057 MET | same |
| B1-e zero-evidence + prior undetermined; NEG-X with wrong prior | 100% ; <= .10 | 14/15 NOT MET ; 11.9% NOT MET | 15/15 MET ; 5.8% MET (by construction: the prior cannot open the gate) |
| B1-f label-permuted profile top-3 at N=12 | <= .15 | 0.076 MET | same |
| B1-g 12 questions: >= 6 offered, >= 70% of those plausible | | 0/12 offered: NOT MET | 0/12 offered: NOT MET |
| B1-h mutation | all gates | 10/10 mutants killed (eval/ants/B1-mutate.mjs) | |
The 12 questions, my reading of the unoffered top-3 candidates (`B1-run2-test-output.txt`): plausible top-3 for God, Justice, Good ruler, Self, Virtue; partly for Enemies, Suffering, Law; weak for After death, War; junk for Change, Lie. Top-3 mass did not separate the plausible from the junk (Self 0.22 plausible, Lie 0.22 junk).
