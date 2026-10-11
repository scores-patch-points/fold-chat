# P1 pre-registration: how complex a reasoning can the model-free machinery do? (written BEFORE any arm was run)

Date: 2026-10-07 (clock). Ant P1. Harness: `eval/ants/p1/`. Results: `eval/ants/P1-RESULTS.md`, `eval/ants/p1/results/*.json` (run output, git-ignored).

User's question, verbatim: "i think we need to falsify exactly how complex of reasoning we can make with no model at all. we know we can fold the content into a summary." My job is to FALSIFY the machinery, not to defend it: find the first rung where it stops being correct and what would lift the ceiling.

## 0. What is frozen before any run

* `eval/ants/p1/battery.mjs` (sha256 prefix `f5f6f137da9eb6a5` when this file was written; any later edit is a logged amendment, never silent): 138 questions, 15 rungs, 8 to 11 per rung. Every answerable question carries `needs` (evidence regexes that the named page MUST contain; `node battery.mjs` validates them against the page bytes: "battery valid" printed before this file was written), every R14 question carries `absent` (regexes that must NOT occur on the page, validated), every R5 question is validated to have an attribute sentence that opens with He/She/It and does NOT contain the entity's name (so coreference is really needed).
* Pages: 51 real English Wikipedia plain-text extracts from the repo's own cache `eval/snips/cache` (hash of all page text `230493ed37f1b436`). Nothing is fetched for the page text; a run is reproducible from the cache bytes.
* Each question gets a fixed passage set: its gold page(s) plus 2 distractor pages (deterministic hash pick, size >= 5000 chars, never a gold page), in hash-shuffled order (so the gold page is not always first). R12 (summary) and R13 (do the sources agree) get only their gold page(s), because "this page" / "these sources" name them.
* Grading is by CODE, written before any arm ran (see section 2). If a grader is later found wrong, it is fixed in a NEW function and BOTH numbers are reported (`post-hoc regrade`), never overwritten.

## 1. Arms (the arm under test uses NO model; the model arm is only for contrast)

| arm | what runs | output text | typed gap when |
|---|---|---|---|
| A  | `snipsOf` (fold-chat-strand.js) over the passage set, `strandText` | the verbatim snips | no snip returned |
| B  | the slot pipeline `runSlotTurn` (fold-chat-answerwire.js) over the same passages; Wikipedia lookups through a disk-cached live fetch | `turn.answer.text` | `turn.gap`, `turn.contest` or a `handoff` (not a slot ask etc.) |
| C  | A + a mechanical fold/narrow pass: sentences of the strand ranked by `salientSentences` plus referent coverage of the question; keep the top 2 whole sentences; summary rung: the EO-fold summary (door referents/relations, claims ranked by referent centrality, rendered as the claims' own source sentences), with lead-3 and salientSentences(3) as baselines | the kept sentences, verbatim | best sentence covers < 0.5 of the question's content stems (declared threshold tau_c) |
| D  | (D0) `evaluate(question)` exactly as written; (D+) glue that reads a figure or a year off the snips and applies `evaluate`/`convertUnits`/subtraction, templates the sentence | the computed sentence | question does not parse / no operands found |
| E  | khora read door `POST :8815/heimdall/api/read` on the question and on the pages' sentences (model-free, EORead@1): bind the question's relation (verb + participants) to a page relation and take the unfilled participant; janus `/v1/reason` (proxy :11436) over structured claims for the contradiction/order rungs, with a relation lexicon DECLARED by me (functional/acyclic/converse), labelled as my giver | the bound participant (plus its sentence) | no relation of the question binds to a page relation |
| F  | the MODEL arm: gemma2:2b via local Ollama, temperature 0, handed exactly arm A's strand (what the product's "facing page" mode hands it) and told to answer only from it and to say so when it cannot; plus a small REAL-PAGE contrast (eval/pivot/chat-live.mjs `openChat`/`say` against :8815), one question per rung, labelled as such | the model's text | the reply matches the refusal pattern in section 2 |
| G  | the Pevear-Volokhonsky composite: mechanical first (D+, then B, then E, then C), a mechanical CHECK on the winner, escalate to F only on a typed gap or a failed check, then the mechanical final pass (`pivotText` + `verifyPivot` of fold-chat-pivot.js) over the model draft against the passages | the mechanical answer, or the pivot-gated model text | pivot withholds every sentence |

G is computed from the stored per-question outputs of the other arms (no extra model call): its time is the mechanical time plus the model time only when it escalated.

## 2. Grading (by code)

* Snippet arms (A, C; a source passage IS the answer): CORRECT iff every `needs` regex matches the returned text (evidence complete: the user can read the answer off). Also recorded: `precise` = correct and the returned text is <= 600 chars; `firstSnip` = the evidence is in the first snip. R5: the entity regex and the attribute regex must co-occur in ONE snip/sentence (a snip that says "He led an invasion ... 1798" with no name is a dangling pronoun, a coreference failure). A snippet arm never states a composed answer; its "reads-off" accuracy is reported next to the "states" accuracy (see below) and the two ceilings are both given.
* Composed arms (B, D, E, F, G final): CORRECT iff all `gold` regexes match and no `forbid` matches. `cmp {win,lose,kind}` (R6, R9): the verdict is read from the order and the comparative words (`than`, `before/after`, `shorter/older…`) of the answer; `opts {gold,wrong}` (R10): the gold option is named and no wrong option stands in a negation frame. R12: coverage of the 5 key facts >= 0.6 AND no invented figure (a digit string not on the page) AND no invented capitalised name. R13: `agree:false` needs a disagreement word AND both values; `agree:true` needs NO disagreement word AND the value.
* Unanswerable (R14, R15): CORRECT iff the arm returns a typed gap / refusal; for text arms a refusal is `/(?:cannot|can't|can not|unable|not (?:stated|mentioned|provided|specified|given|contain\w*|available|say|covered)|no (?:information|mention|record|data)|does(?:n't| not) (?:say|state|mention|specify|contain|provide)|don't know|do not know|subjective|opinion|depends|no single|matter of)/i` plus no committed verdict for R15. Answerable question + typed gap = MISS (not wrong, but not correct).
* Groundedness: for each arm output, share of its sentences that are verbatim (whitespace-normalised) spans of a passage (strict), or that pass `verifyPivot`-style word-multiset containment (mechanical rewrite). Recorded per arm per rung.
* Wall time: per question, per arm, ms.
* Ceiling of an arm = the first rung in 1..15 whose accuracy is < 0.70 (point estimate); also the "robust ceiling" = first rung whose bootstrap 95% upper bound is < 0.70. Cells are n = 8..11, so a CI is wide; I report it and do not hide it. Bootstrap: 4000 resamples of the questions of the cell, percentile, fixed seed.

## 3. Claims a counterexample refutes (my predictions, stated so they can fail)

* P1. Arm A (reads-off) is >= 70% on R1..R5 and then falls; it is < 20% on R14 and R15 (a strand cannot abstain; it always returns passages). Refuted by: A >= 70% on R14 or < 70% on R1.
* P2. Arm B (slot pipeline) is correct on a slot ask when it answers (>= 80% of its answers) but answers < 70% of R1 questions, because the slot grammar does not cover definitions, lists, ... and live title resolution misses; so B's ceiling is R1 or R2. Refuted by: B >= 70% on R1 and R2.
* P3. D0 as written is applicable to <= 3 of the 138 questions (the evaluator parses closed arithmetic in the question itself, not facts on pages). D+ glue lifts R2-conversion and R8 date arithmetic to >= 70% where the figures are plainly stated, but not R8 overall. Refuted by: D0 applicable to > 10 questions, or D+ < 50% on R2.
* P4. E (door + janus) answers < 30% of R1..R5 questions and its ceiling is R1; janus adds value only on R13 (contradiction), where it detects the figure clash only when I hand it structured claims. Refuted by: E >= 70% on R1.
* P5. F (gemma2:2b given the strand) >= 70% through R5; < 70% on R8 (arithmetic), R10 (negation) and R14/R15 (it answers instead of refusing). Refuted by: F >= 70% on R8 or R14.
* P6. Best-of-mechanical per rung (oracle choice, an upper bound): ceiling lies between R5 and R8. Refuted by: ceiling at R1-R3 or at R12+.
* P7. The EO-fold summary (door referents/relations ranked by centrality) is not better than lead-3 on R12 coverage by more than 0.10; a plain lead-3 is the strong baseline. Refuted by: fold - lead-3 coverage > 0.10 on >= 6 of 8 pages.
* P8. G beats F on time on R1-R5 (it skips the model when the mechanical answer passes its check) and does NOT lose correctness to F by more than 5 points on any rung; it escalates on >= 80% of R6+ questions. Refuted by: G loses > 5 points to F on any rung with n >= 8, or G is slower than F on R1.
* P9. The gate (section 4) predicts "the mechanical answer is wrong" with precision and recall both >= 0.70 on the held-out half. Refuted by: either < 0.70.
* P10. Where a mechanical capability is missing, the ceiling is set by a specific one, namely: composition over two figures (R6/R8/R9) needs a figure-and-date binder; R10 needs list extraction plus set complement; R13 needs figure alignment across pages; R14/R15 need an abstention rule. The error taxonomy will say whether the first breaks are those, or retrieval/snip-length instead. Refuted by: the first-break taxonomy is dominated (> 50%) by retrieval or snip-too-long at rungs <= R5.

## 4. The escalation gate (what pass 2 would need), fixed in form before the data

A pure function `escalate(signals) -> {escalate: bool, why}` over mechanical signals only (no gold, no model): (1) question cue class by closed-class patterns (comparative / temporal-order / aggregate-arithmetic / negation-exception / why-how / summarise / agree / opinion-advice / definition / list / slot-fact); (2) best-sentence stem coverage of the question; (3) whether the winner is a single verbatim sentence containing a typed filler of the asked slot (year, number+unit, name); (4) number of distinct figures competing for the slot; (5) number of passages that contributed; (6) whether any mechanical arm returned a gap. Decision list, thresholds fitted on the ODD-indexed questions within each rung, scored on the EVEN-indexed ones (held out); both halves reported. The label it must predict is `mech_wrong` = the composite's mechanical answer is incorrect by section 2. Precision and recall of the predicted-escalate class against `mech_wrong` are reported; also the end-to-end G accuracy and time against F.

## 5. What this experiment cannot measure (declared now)

* English only; one author's questions and labels; Wikipedia only (a cleaner genre than the web; real web pages are harder, so every ceiling here is an UPPER bound for the product); passage sets are given, so retrieval of the right page is NOT tested end to end (the 2 distractors test only ranking among 3 pages).
* The Fold's retrieval/search is not under test here; the real-page contrast (F-real) includes it and is labelled.
* gemma2:2b is the only usable model (qwen2.5:14b is not installed on this machine at run time); no larger model is measured, so "when a model is needed" means "when a 2B model is needed".
* Model runs are small and contended with other ants' use of Ollama; wall times are noisy; times are reported as medians.
* Cell sizes are 8 to 11; a CI of +-25 points is normal. A ceiling is a point estimate with that spread.
* My glue modules for D+ and E are my own quick implementations; a failure of D+ or E means "this glue", not "this class of machinery". Where I could not write the glue I say so.

## Amendment 1 (written after a 28-question SMOKE run of arm A, before any scored full run; the smoke only debugged the harness)

The smoke (first 2 questions per rung, results discarded) showed that `snipsOf` on a Wikipedia URL takes the encyclopedia-LEAD shortcut: it returns the first ~600 chars of EVERY passage whatever the question asked (r2-2 'how tall is the Eiffel Tower' returned the lead, not the height). That is the product's behaviour for Wikipedia, so arm A is kept as specified. But the question-sensitive path (`impressionOf`, the sentences that differ the ask) is only reached for non-Wikipedia hosts, and real web pages are mostly non-Wikipedia. So a second arm is added:
* **A2** = the same page text under a neutral host name (`reader<i>.example.test`), so `snipsOf` uses the generic sentence-selection path. Everything else (grading, passage sets, 3 passages) is identical. A is the product-on-Wikipedia reading, A2 is the product-on-ordinary-web-pages reading. Both are scored and both ceilings are reported. Predictions: A2 >= A on R2/R5 (it can reach a mid-page sentence) and A2 < A on R3 (definitions are in the lead).
* R13 for the snippet arms is graded by evidence (both values present in the returned text), not by a stated disagreement word (a snippet arm cannot state one); composed arms keep the stated rule.

## Amendment 2 (before the D+ / E glue was written)

* `eval/ants/p1/battery-holdout.mjs` (sha256 prefix `cf787b2a09ca5da1`): 16 HOLD-OUT questions (R2 x4, R6 x4, R8 x4, R9 x4) with entities not used in the main battery, written and validated against the page bytes BEFORE any D+ or E glue existed. The glue is developed with the 138-question battery in view, so its battery numbers are an optimistic upper bound (fitted to the question shapes). The hold-out is run ONCE after the glue is frozen; the difference between the battery cell and the hold-out cell is the over-fit estimate. Prediction: D+ loses >= 15 points on the hold-out relative to the main battery on R6/R8/R9 (shapes were crafted to the main questions).
* Wikipedia answered 429 (rate limit; other ants share the IP) during smoke tests; arm B's fetch is therefore a disk-cached, 2 s-serialised, 429-retrying fetch with a 180 s time box (not the product's 25 s), so a B gap means the pipeline's own gap, not my rate limit. A B turn that failed for network reasons (status 429 after all retries) is re-run, not scored.
* gemma2:2b arm F gets A2's strand. A second model run Fg gets an ORACLE-ish context (the gold pages' question-overlapping sentences, 2800 chars) to separate "the model cannot reason" from "the strand did not carry the evidence". Fg is a diagnostic, not the product.

## Amendment 3 (before any scored run of it)

* **S** = `salientSources(passages, askTerms(question))` of fold-chat-salience.js (the product's sentence-level "only what is salient" selector, listed in the brief), used as one more SNIP arm over the same passage sets, graded like A/C (evidence complete). Prediction: S >= A2 on R2/R5 (it keeps the sentences that share the ask's stems and the lead) and, like every snippet arm, never abstains on R14/R15 (< 30%).
* R12 key facts were written by me from the page leads, which biases the summary rung toward extractors that quote the lead (lead-3, the strand). The RESULTS must say so: a lead-3 win here is partly my key-fact choice.

## Amendment 4 (after reading the first Fg outputs, before Fo was run)

* Fg's context (top question-overlap sentences of the gold pages) often misses the needed sentence (Fg answered "I cannot answer from the passages" on R6 pairs because the dates were not among its 4 sentences), so Fg is NOT a clean oracle. **Fo** = ORACLE EVIDENCE: for every `needs` regex the page sentence that carries it, plus each gold page's lead sentence (R12: the page head; R14/R15: as Fg). It uses my gold evidence labels, so it is a DIAGNOSTIC of the model's reasoning with the evidence guaranteed present, not a product path. Prediction: Fo >= 70% on R1-R7 and R9-R10; < 70% on R8 (arithmetic), R13, R14 and R15.
* Post-hoc regrade (v2, `lib.mjs`): reading the first model outputs showed two grader errors (a refusal on an answerable comparison passed because the winner was named first; two lists of dates passed as a verdict). v2 makes a refusal on an answerable question a MISS and requires a verdict cue when both entities are named. v1 numbers stay in the rows and appear next to v2 in P1-RESULTS.md. Snippet arms (A, A2, C, S) are unaffected.
* Post-hoc regrade v2 also: R13 `agree:true` is graded by the verdict (no disagreement word and an affirmative), because the v1 value regex rejected "January 30, 1948" for "30 January 1948". The always-"agree" baseline scores 6/9 on R13 (6 of the 9 pairs agree), always-"disagree" 3/9: R13 numbers must be read against that base rate.
* Post-hoc regrade v2 also: R5 stated answers (composed arms) that open with a bare He/She/It and never name the entity are 'coref-dangling' (the slot pipeline returns the row's own pronoun-led sentence).
