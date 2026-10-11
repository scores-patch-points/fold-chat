# P1 results: how complex a reasoning does the model-free machinery reach, and where is a model needed?

Ant P1, 2026-10-07. Pre-registration: `eval/ants/P1-PREREG.md` (written before any scored run; four dated amendments, all before the run they affect). Harness: `eval/ants/p1/` (node, resumable, `results/` is git-ignored run output). Every number below is produced by `p1/make-tables.mjs`, `esc-table.mjs`, `gate-eval.mjs`, `cues.mjs`, `report12.mjs`; the raw tables are in `p1/results/tables.md` (with 95% bootstrap CIs per cell).

## 0. Answer in five lines

1. **The shipped model-free machinery does not reach R2.** On 138 real-page questions, the strand (`snipsOf`), the slot pipeline, the fold/narrow pass and the khora door each fall under 70% by R2 (a figure with a unit) or R1 (slot pipeline, door). The first break is not reasoning: it is **picking the right sentence of the right page** (of the answerable misses of the snippet arms, "page quoted, the needed fact is not in the snip" is A 51 of 51, A2 57 of 60, C 60 of 74, S 24 of 35).
2. **A hand-built typed-skill layer (D+, my glue, not product code) goes further**: 73% R2, 100% R6, 78% R8, 100% R9 on the battery, in 0-1 ms. But it is **template-shaped**: 12/16 on a hold-out with new entities, **1/14 on paraphrases** of questions it answered. It is an upper bound for "a figure/date binder + evaluator", not a deployable reasoner.
3. **No model-free arm tells an answerable question from an unanswerable one** (abstention discrimination: 0 to 33 points; the 2B model with a one-line instruction: 83 points). R14/R15 are "100% correct" for D+, B and E only because they abstain on everything.
4. **gemma2:2b is the wrong fix for the composition rungs and the right one for abstention, definitions and why/how.** Even with the evidence handed over (Fo) it scores R2 55%, R6 56%, R8 33%; with the product's strand (F) it scores 67/120 answerable, because the strand lacked the evidence in 29 more cases (Fo 96/120).
5. **Recommended pass-2 gate (section 5):** trust a typed skill only when it fires with evidence, route opinion/advice to a typed gap, send everything else to the model, then the pivot. On the held-out half: 81% correct (52/64) vs 66% for the model alone; on all 138: 77% (106) vs 62% (85), paired +15 points (CI 9 to 22). Trust precision 0.92 (fit half) / 1.00 (held-out); every question that needed a model was escalated (recall 1.00 on both halves), at the price of trusting a skill on only about half of what the precise arms could answer (trust recall 0.48-0.52). The pivot final pass catches inventions, not wrong reasoning (section 5.3).

## 1. What ran

138 questions, 15 rungs (8-11 each), over 51 real Wikipedia extracts from `eval/snips/cache`; each question gets its gold page(s) plus 2 distractors (R12/R13: gold only). Ground truth is code (regex / set / number / order), validated against the page bytes before any run (`node battery.mjs`).

| arm | machinery | answer text |
|---|---|---|
| A | `snipsOf`, Wikipedia URLs (the encyclopedia-lead path) | verbatim snips |
| A2 | same pages under a neutral host, so `snipsOf` takes its generic sentence path | verbatim snips |
| S | `fold-chat-salience.js salientSources` (the product's "only what is salient" selector) | verbatim excerpts |
| B | the slot pipeline (`runAnswerTurn` via `slotDeps`; Wikipedia through a cached, rate-limited fetch) | `answer.text`; handoff/gap/contest = typed gap |
| C | A + my mechanical narrow pass (idf-weighted sentence ranking, tau_c 0.5, He/She -> entity rewrite) | 1-2 whole sentences |
| D+ | `mech.mjs`: figure / date / lifespan / list-complement binder + `convertUnits` (D0 = `evaluate()` as written: **0 of 138** parse) | a templated sentence of page figures |
| E | khora read door (EORead@1) bound to the question's relation + janus `/v1/reason` over claims | the bound participant |
| F | gemma2:2b (temp 0) handed arm A2's strand | model text |
| Fg, Fo | same model, gold-ish context (Fg), ORACLE evidence sentences (Fo, diagnostic: uses my gold labels) | model text |
| G | the Pevear-Volokhonsky composite: cue-route -> D+ -> B -> E -> snippet route -> F + pivot (`pivotText`, `verifyPivot`) | computed from stored arm outputs |
| Gs | the recommended gate: D+ trusted, opinion -> gap, all else -> F + pivot | same |

Grading: snippet arms (A, A2, S, C) are CORRECT when the returned text carries every `needs` evidence regex (reads-off), R5 additionally needs the entity and the attribute in one snip; composed arms (B, D+, E, F, G) are CORRECT when the stated answer matches `gold` and no `forbid` (comparisons, option exceptions, R12 coverage/invention, R13 verdict have their own graders). Unanswerable = a typed gap or refusal. Post-hoc regrade v2 (see section 8) is the headline; v1 numbers sit next to it in `results/tables.md`.

## 2. The ladder (correct / n; CIs in `results/tables.md`)

| rung | n | A | A2 | S | B | C | D+ | E | F | Fo | G | Gs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| R1 single fact | 10 | 9 | 10 | 10 | 3 | 7 | 0 | 1 | 9 | 10 | 7 | 8 |
| R2 figure + unit/conversion | 11 | 6 | 1 | 5 | 0 | 2 | 8 | 0 | 2 | 6 | 9 | 9 |
| R3 definition | 10 | 10 | 10 | 10 | 0 | 2 | 0 | 0 | 10 | 9 | 10 | 10 |
| R4 list | 10 | 4 | 6 | 7 | 0 | 5 | 0 | 0 | 7 | 9 | 7 | 7 |
| R5 coreference (He/She) | 9 | 2 | 0 | 9* | 0 | 7 | 0 | 0 | 3 | 9 | 3 | 3 |
| R6 comparison | 9 | 5 | 3 | 5 | 0 | 1 | 9 | 0 | 5 | 5 | 9 | 9 |
| R7 multi-hop (2 pages) | 8 | 4 | 4 | 7 | 0 | 2 | 0 | 0 | 6 | 8 | 2 | 6 |
| R8 arithmetic / aggregation | 9 | 6 | 4 | 5 | 0 | 1 | 7 | 0 | 0 | 3 | 7 | 7 |
| R9 temporal order | 9 | 5 | 3 | 6 | 0 | 2 | 9 | 0 | 6 | 9 | 9 | 9 |
| R10 negation / exception | 9 | 4 | 5 | 8 | 0 | 7 | 5 | 0 | 7 | 9 | 8 | 8 |
| R11 causal why/how | 9 | 3 | 6 | 6 | 0 | 3 | 0 | 0 | 7 | 7 | 7 | 7 |
| R12 summary (3 sentences) | 8 | 7 | 5 | 2 | 0 | 4 | 0 | 0 | 1 | 6 | 4 | 1 |
| R13 do the sources agree | 9 | 4 | 3 | 5 | 0 | 3 | 0 | 2 | 4 | 6 | 3 | 4 |
| R14 unanswerable | 9 | 0 | 0 | 0 | 9** | 2 | 9** | 9** | 9 | 9 | 9 | 9 |
| R15 opinion / advice | 9 | 0 | 0 | 0 | 9** | 1 | 9** | 9** | 9 | 8 | 9 | 9 |
| all 138 | | 69 | 60 | 85 | 21 | 49 | 56 | 21 | 85 | 113 | 103 | 106 |

\* S's R5 is "entity and attribute in one excerpt": its excerpt starts with the page lead, so the entity is there while the pronoun sentence still dangles. C's R5 is one sentence with the pronoun rewritten to the entity.
\*\* vacuous: these arms abstain on (nearly) everything; see abstention table.
R13 base rates: always-"agree" scores 6/9, always-"disagree" 3/9. Fo is a diagnostic (my evidence labels), not a product path.

### Ceilings (first rung whose accuracy is < 70%; pre-registered)

| arm | ceiling | rungs >= 70% (point estimate) | note |
|---|---|---|---|
| A (Wikipedia lead path) | **R2** (55%) | R1 R3 R12 | returns the lead of every page whatever was asked: median 1.6 k chars, 0 of its 69 correct answers are <= 600 chars |
| A2 (generic sentence path) | **R2** (9%) | R1 R3 | picks off-topic sentences for "how tall is the Eiffel Tower" |
| S (salientSources) | **R2** (45%) | R1 R3 R4 R5* R7 R10 | a wall too: median 1.4 k chars, 0 precise |
| B slot pipeline | **R1** (30%) | none | answers 11 of 120 answerable questions, 3 correctly after v2 (8 of its answers are right in v1; 5 were pronoun-led row sentences) |
| C narrow pass | **R2** (18%) | R1 R5 R10 | precise (median 440 chars) but 8 of 10 definitions pick the wrong sentence |
| D+ typed skills | **R1** (no template) | R2 R6 R8 R9 | answers 40 of 120, 38 correct (95%); brittle (section 3) |
| E door + janus | **R1** (10%) | none | answers 7 of 120; janus is not the bottleneck (section 4) |
| F gemma2:2b on the strand | **R2** (18%) | R1 R3 R4 R7 R10 R11 | refuses 17% of answerable questions |
| Fo (oracle evidence) | **R2** (55%); then R6 56, R8 33, R13 67 | R1 R3 R4 R5 R7 R9 R10 R11 R12 | the 2B model's own limit |
| G composite | **R5** | R1-R4 R6 R8-R11 R14 R15 | fails R5 (B's pronoun sentence trusted first), R7, R12, R13 |
| Gs gate | **R5** | R1-R4 R6-R11 R14 R15 | fails R5 (strand-starved model), R12, R13 |

Bootstrap robust ceilings (CI upper bound < 70%): A R5, A2 R2, S R12, C R2, B R1, D+ R1, E R1, F R2, Fo R8, G R5, Gs R5. Cells are 8-11 questions: a CI of +-25 points is normal.

**Model-free envelope** (an oracle picks, per question, the best model-free arm; an upper bound on any composite): with passage walls allowed it is >= 78% on R1-R10 and R12, 67% on R11 and R13. Restricted to precise arms (B, C, D+, E: no walls, which is what the user asked for) it is 100% R6 R9, 89% R10, 78% R5 R8, 73% R2, 70% R1, and below 70% on **R3 20%, R4 50%, R7 25%, R11 33%, R12 50%, R13 44%**. So the first rung that no precise model-free arm clears is **R3**: not because definitions are hard, but because no precise arm knows that "what is X" wants the page's first sentence.

## 3. What broke, per arm (error taxonomy; full per-rung lists in `results/tables.md`)

* **A / A2 / S / C (snippets).** The dominant failure is "page quoted, needed fact not in the snip": A 51 of 51 answerable misses, A2 57 of 60 (3 are dangling pronouns), C 60 of 74 (10 coverage-rule withholdings, 4 wrong-page/missing-page), S 24 of 35 (6 withholdings, 5 missing page). That is sentence selection inside the right page, not page retrieval (a gold page was absent from the snips in 0 cases for A and A2, 5 for S, 4 for C). The Wikipedia path ignores the question entirely; the generic path (impressionOf) ranks "Tokyo Tower was inspired by the Eiffel Tower" above "The tower is 330 metres tall". R5: A2 has 3 dangling-pronoun misses among its 9; C's He/She rewrite fixes it (7/9).
* **B slot pipeline.** Of 138: handoff "not a slot ask" 46 (+1 "referents unresolved"), `unwitnessed` gap 62, `no_present_holder` 2, `contest` 16 (9 of 10 definitions end in "the sources disagree"), answers 11 (3 correct, 5 pronoun-led row sentences, 1 wrong slot type: it answered *who* for "at which theatre"). Slot asks cost up to 2 minutes of rate-limited Wikipedia probing when the answer then fails (live product time box: 25 s).
* **D+.** Where a template exists it is almost always right (38/40 answered). Failures: wrong sentence for an event year ("the Eiffel Tower was finished in 1930" is the Chrysler Building's sentence; "assassination" matched the 1864 attempt page text), unit-table gaps (`km/s` is not in `fold-chat-compute.js`; a speed of light given as `m⋅s−1` was unparsed until my regex), "10,935 ± 6 meters" read as "6 meters" before the plus-minus fix. Glue limit, not a limit of the idea.
* **E door.** The door's relations are phrase debris ("Penicillin was" -discovered- "in 1928 by the Scottish physician Alexander Fleming ..."): the door reads no relation in the question for 83 of 138 and no wh-slot in 33 more; 22 questions had both and a page relation bound for 7 (3 correct). janus's 5 verdicts were all consistent with the two figures it was handed (flags 1818 vs 1865, agrees on 1605 and 1969). The R13 failures are my figure binder (wrong year from the wrong sentence), as predicted in C3.
* **F model.** With the strand: **42 of its 53 answerable misses are retrieval-starved** (arm A2's strand, which is what it was handed, did not contain the evidence; 5 of the R2, R5 and R8 misses each are "refused although asked"). With the evidence handed over (Fo) the remaining errors are reasoning: R2 conversion (5 of 11), R6 comparison (4 of 9 name the wrong winner), R8 arithmetic (6 of 9), R13 verdict.

## 4. The fold as a summarizer (R12) and the other "fold" claims

The user's premise "we know we can fold the content into a summary" was tested on the 8 summary pages. Key facts are 5 regexes per page that **I wrote from the page leads, which favours lead-quoting extractors**.

| summariser | mean key-fact coverage of 5 | correct (cov >= 0.6, nothing invented) |
|---|---|---|
| lead-3 | 0.85 | 8/8 |
| A strand (lead) | 0.77 | 7/8 |
| Fg (model on the page head) | 0.65 | 6/8 |
| EO-fold (door referents, central claims as their own sentences) | 0.50 | 4/8 |
| F (model on the strand) | 0.47 | 1/8 |
| `salientSentences(3)` | 0.20 | 0/8 |

On this measure the fold built from the door's referents is **not better than lead-3** (-0.35). I did not run the resolutions blocks (Lens / Paradigm / Atmosphere of `resolutions.js`): they are conversation-memory blocks over a ledger of notes with standing, and no model-free reader here produces such notes from a page (the door gives phrase debris), so "a Lens line standing in for a sentence" could not be tested. Say what that means plainly: **the claim that content can be folded into a summary mechanically is supported only in the trivial form "take the first sentences"**; the EO fold as a summarizer is unmeasured, not confirmed.

## 5. When a model is needed: the escalation gate (pass 2)

### 5.1 The data behind it

By cue class (answerable questions; "any precise arm" = B, C, D+, E correct):

| cue class | n | any precise model-free arm | F (strand) | Fo (oracle ev.) |
|---|---|---|---|---|
| compare | 17 | 17 | 11 | 13 |
| arithmetic | 9 | 7 | 0 | 3 |
| figure (unit/conversion) | 11 | 7 | 3 | 7 |
| negation | 9 | 8 | 7 | 9 |
| slot (who/when/where) | 24 | 14 | 17 | 24 |
| list | 11 | 6 | 7 | 10 |
| definition | 10 | 2 | 10 | 9 |
| causal | 9 | 3 | 7 | 7 |
| summarise | 8 | 4 | 1 | 6 |
| agree | 9 | 4 | 4 | 6 |
| other | 3 | 3 | 0 | 2 |

The 2B model beats the precise model-free arms on **definition, causal, slot, list**; the typed skills beat it on **compare, arithmetic, figure** (F 0-11 of 17/9/11 questions; with oracle evidence 13/17, 3/9, 7/11); on **summarise** the precise arm (4) beats the model (1). Question-level: **45 of 120 answerable questions have no correct precise model-free arm**; the model alone (F) fixes 26 of them.

### 5.2 The gate as a pure function (what the code in `p1/g.mjs` does; fitted on odd-indexed questions per rung, scored on the even-indexed)

```
cue    = cueClass(question)      // closed-class patterns: opinion | summarise | agree | negation | arithmetic | compare |
                                 // causal | figure | list | definition | slot | other      (English, declared; opinion patterns were written
                                 // with the battery in view)
D      = typed-skill answer {text, evidence[], skill} or gap            // mech.mjs shapes: convert, lifespan, year/figure diff, sum, compare, order, list-complement
dCheck = D answered && D.evidence.length >= 1 && (a date ask => the text carries a 4-digit year)

escalate(question, D) ->
  if cue == opinion:            return GAP("no verdict: opinion/advice")     // no model asked
  if D answered && dCheck:      return MECHANICAL(D)                          // trusted
  return MODEL(strand) -> pivot (normalise a bare answer with a full stop) -> if nothing survives: GAP
```
Optional trusted routes (variants G, Gw): B or E when their own check passes; a snippet arm per cue (fitted per cue class: C for slot/summarise, S/A for list/figure/definition, never for compare/arithmetic/negation/agree: a snippet is evidence there, not an answer). Fitting `tau` for C's best-sentence coverage chose 0.4; **coverage is a poor signal** (precision 0.32, recall 0.27 for "no precise arm is correct").

### 5.3 Precision and recall (odd = fit half, even = held-out half)

| gate | correct (odd / even) | model alone F (odd / even) | trust precision | trust recall of precise-mech-correct | model-needed recall | escalation precision* | escalated |
|---|---|---|---|---|---|---|---|
| **Gs** (recommended) | 54/74 73% / 52/64 81% | 58% / 66% | 0.92 / **1.00** | 0.52 / 0.48 | **1.00 / 1.00** | 0.56 / 0.61 | 89 of 138 |
| G (adds trusted B, E, C routes) | 56/74 76% / 47/64 73% | 58% / 66% | 0.72 / 0.70 | 0.79 / 0.79 | 0.81 / 0.79 | 0.65 / 0.74 | 53 of 138 |
| Gw (walls allowed as the answer) | 59/74 / 50/64 | | | | | | 29 of 138 |

\* share of escalations where no precise model-free arm was correct. "Model-needed" = no precise arm correct AND the model correct. All 138: F 85, Gs 106, G 103, Gw 109, Fo 113. Paired difference **Gs - F: +15.2 points (95% CI 9.4 to 21.7)**, +17.5 on R1-13 alone (10.8 to 25.0).

Why the trusted B/E/C routes are dropped in Gs: stage accuracy in G is D 38/40 (95%), C 11/22 (50%), B 3/9, E 2/5, escalated model 40/53, opinion gap 9/9. Everything except D+ was trusted wrongly about half the time (trust precision 0.70-0.72, exactly the 0.70 line).

Single signals do not carry the decision (precision / recall for "no precise model-free arm is correct"): cue is compare/arithmetic/negation/agree/causal 0.26 / 0.31; the ask names two pages 0.22 / 0.11; best sentence lacks a typed filler 0.40 / 0.04; "D+, B and E all returned a gap" 0.61 / 0.87 (the best single one). `cueClass == opinion` fires on 0 of 120 answerable questions and on 9 of 9 opinion questions, but its patterns were written with those questions visible.

### 5.4 The escalation table (G vs the model alone, per rung; `results/esc-G.md`, `results/esc-Gs.md`)

| rung | F | G | G escalated | G median ms | F median ms | G - F correct |
|---|---|---|---|---|---|---|
| R1 | 9/10 | 7/10 | 0 | 1737 | 3972 | -20 pts (-50..0) |
| R2 | 2/11 | 9/11 | 2 | 5 | 10222 | +64 (36..91) |
| R3 | 10/10 | 10/10 | 10 | 12980 | 5542 | 0 |
| R4 | 7/10 | 7/10 | 10 | 59877 | 4220 | 0 |
| R5 | 3/9 | 3/9 | 0 | 9977 | 6669 | 0 |
| R6 | 5/9 | 9/9 | 0 | 9 | 15697 | +44 (11..78) |
| R7 | 6/8 | 2/8 | 4 | 61688 | 12294 | -50 (-88..-13) |
| R8 | 0/9 | 7/9 | 1 | 3 | 8682 | +78 (44..100) |
| R9 | 6/9 | 9/9 | 0 | 11 | 5113 | +33 (0..67) |
| R10 | 7/9 | 8/9 | 4 | 25 | 3517 | +11 (0..33) |
| R11 | 7/9 | 7/9 | 9 | 7444 | 7173 | 0 |
| R12 | 1/8 | 4/8 | 0 | 5099 | 3611 | +38 (13..75) |
| R13 | 4/9 | 3/9 | 4 | 3634 | 6738 | -11 (-44..22) |
| R14 | 9/9 | 9/9 | 9 | 4719 | 4363 | 0 |
| R15 | 9/9 | 9/9 | 0 (gap) | 1 | 14173 | 0 |

Read: the composite is much faster and more correct exactly where a typed skill fires (R2, R6, R8, R9: +33 to +78 points, 3-25 ms vs 5-16 s; R10 +11); it **loses to the model where it trusts a snippet** (R1 -20, R7 -50). G's R3/R4/R7 times (13-62 s, the R3 one mostly B's probing) are the slot pipeline B being waited for (live, rate-limited Wikipedia); G without waiting for B: median 2.1 s (R1-5 4.0 s, R6-13 71 ms) against F 5.8 / 6.1 s. B was right 3 times in 138 and never alone; dropping it from the chain costs nothing measured. G escalates 53 of 138 (Gs 89 of 138).

**The pivot (mechanical final pass) does not catch wrong answers.** On the 89 escalated Gs drafts: wrong before the pass 29, after 30; 11 drafts had a sentence withheld; one correct draft lost with normalisation, **7 correct drafts lost without it** (a bare one-token answer like "Canberra" or "1969" has no terminal mark, so `pivotText` reads it as a draft cut off and withholds it: `truncated`; "Au" is withheld as `cross-language`). `verifyPivot` is a re-derivability check of words and numbers; it passed "the museum that holds the Mona Lisa is in Florence" on the real page (below) because the words are on some read page.

### 5.5 Real-page contrast (F-real, 1 question per rung, n=1 each, labelled)

`eval/pivot/chat-live.mjs` against :8815 with gemma2:2b and the product's own gates: **8 of 15 correct** (R14/R15 correct as gaps; R1 2 model calls 77 s, R2 "29,031.7 feet" (the page's own compute evaluator converted it), R3, R5, R9, R10 correct; R4, R11, R12, R13 returned nothing (typed gap although answerable); R6 returned the Everest lead; R7 answered "Florence" for the Mona Lisa's city; R8 answered 1961 and 1989 for "how many years"). 21-163 s per turn including the search. This is the product with retrieval in the loop and one question per rung, not comparable cell for cell; it agrees with the controlled arms on where the breaks are (R4, R6, R7, R8, R11-R13).

## 6. The capabilities whose absence sets each ceiling (for the boss to decide what to build)

1. **A sentence selector that returns the fact sentence (precise) instead of a wall.** The strand returns walls (A 1.6 k, A2 1.9 k, S 1.4 k chars median, 0 of 214 correct answers precise (A 69, A2 60, S 85)); the precise arm (C) is wrong on 8/10 definitions and 7/9 comparisons because one idf coverage score does not know what kind of sentence the question wants. Needed: a cue-aware selector (definition -> the lead sentence; figure -> the sentence where a typed figure follows the dimension word; list -> the list sentence; mechanism -> the "because / due to / caused by / which" sentence; date -> the sentence whose subject is the asked event). Evidence: Fo - F = +24 points on answerable questions (96 vs 67): the strand, not the model, is the larger loss.
2. **A typed binder (figure + unit + dimension + subject; event date; life dates; list + complement) behind a grammar-level question parser.** D+ shows what it buys (R2 73, R6 100, R8 78, R9 100, R10 56 alone and 89 in the envelope, 0-1 ms) and what is missing: it is regex templates (paraphrases 1/14; hold-out 12/16 = 75% against 33/38 = 87% on the battery, right-reason 69% vs 76%), it binds an event to the first sentence that shares the words rather than the sentence whose **subject** is the event ("finished in 1930" was the Chrysler Building), and `fold-chat-compute.js` has no `km/s`. The door gives relations without voice or polarity and phrase-sized participants (E answered 7 of 138): a sentence-grain claim reader (`ClaimReading@1`, GROUNDING-BY-MEANING.md section 4) is the missing front end.
3. **Pronoun resolution.** C's He/She -> entity rewrite lifts R5 from 2/9 (A) to 7/9 and costs nothing; B and A2 return the dangling sentence (B R5 0/9 after v2).
4. **An abstention rule.** No model-free arm separates unanswerable from answerable (C 8 points, D+ 33, B 9, E 6; walls 0); lexical overlap is high on R14 by construction (the trap), so coverage cannot do it. What the 2B model does with "say so if the passages lack it": 83-94 points. A mechanical rule would be "is the asked slot's typed filler bound to the asked entity in some sentence", which needs the binder of item 2. Until then the model is the abstainer.
5. **Cross-source figure alignment (R13).** janus is correct when handed two comparable claims; what is missing is binding the same quantity of the same entity out of two pages (E: wrong year from the wrong sentence 3 times, gap 4). The base rate for "agree" is 6/9, so R13 scores need to beat 67%; nothing here does except Fg/Fo on a lucky rate.
6. **Why/how.** Best precise arm 33%, walls 67%, model 78%: no mechanism-sentence selector exists. The model is genuinely useful here.
7. **Multi-hop (R7).** Precise arms 25%; walls 88% only because both pages' leads are dumped. Needs an entity-chain step (resolve the intermediate entity from page 1, then ask page 2): not present in any arm.
8. **Summaries.** lead-3 (0.85) beats everything else; nothing measured supports the EO fold as a summarizer (section 4).

## 7. Pre-registered predictions, scored

| claim | outcome |
|---|---|
| P1 A >= 70% on R1-R5 then falls; < 20% on R14/R15 | **REFUTED first half** (A is 55% at R2, 22% at R5); second half held (0%) |
| P2 B ceiling R1 or R2; answers < 70% of R1 | HELD (R1 30%; answers 11/120) |
| P3 D0 applicable to <= 3 questions; D+ < 50% on R2 is false-direction | D0 HELD (0/138); D+ lifted R2 to 73% and R8 to 78% (I predicted it would not lift R8 overall): **REFUTED on the battery**, with the caveat that the battery was in view when D+ was written |
| P4 E answers < 30% of R1-R5, ceiling R1, janus useful only on R13 | HELD (E 7 of 138; janus's 5 verdicts consistent with the claims it was handed) |
| P5 F >= 70% through R5; < 70% on R8, R10, R14/R15 | **REFUTED**: F fails R2 and R5 (retrieval-starved); is 78% on R10 and 100% on R14/R15; only R8 (0%) as predicted |
| P6 best-of-mechanical ceiling between R5 and R8 | **REFUTED**: walls envelope >= 78% to R10; precise envelope breaks at R3 (20%) and R4, R7 |
| P7 EO-fold not better than lead-3 by > 0.10 | HELD (fold 0.50 vs lead-3 0.85) |
| P8 G beats F on time R1-5 and loses < 5 points on any rung; escalates >= 80% on R6+ | **REFUTED**: loses 20 points at R1 and 50 at R7; escalates 9/9 on R11 but 0/9 on R6 (the skill answers) |
| P9 gate precision and recall >= 0.70 on the held-out half | HELD at the line for G (0.70 / 0.79); Gs trust precision 1.00 but trust recall 0.48 |
| P10 first breaks are composition capabilities, not retrieval | **REFUTED**: the first break (R2, R4, R5 for the snippet arms and F) is sentence-grain retrieval; composition breaks come later and are covered by D+ templates |
| A2 >= A on R2/R5, A2 < A on R3 | REFUTED: A2 is below A on R2 (9 vs 55) and R5 (0 vs 22), equal on R3 |
| S >= A2; snippet arms never abstain | HELD (S 85 vs A2 60; 0% gap on R14/R15) |
| D+ loses >= 15 points on the hold-out | NOT MET: 87% -> 75% (-12), right-reason 76% -> 69% |
| Fo >= 70% on R1-R7, R9-R10; < 70% on R8, R13, R14, R15 | PARTLY: Fo fails R2 (55%) and R6 (56%); R14/R15 are 100/89% |

## 8. Deviations, post-hoc changes, and honest limits

* **Amendments** 1-4 in the PREREG, each dated and before the run it affects: A2 (generic path) and S added after a smoke of A showed the Wikipedia-lead shortcut; hold-out written before the glue; Fo added after reading Fg outputs.
* **Post-hoc regrade v2** (kept next to v1 in `results/tables.md`; v1 -> v2 correct counts: B 26 -> 21, D 56 -> 56, E 21 -> 21, F 81 -> 85, Fg 83 -> 85, Fo 108 -> 113): (a) a refusal on an answerable question is a MISS, and a comparison with both entities named needs a verdict cue (a refusal had passed because the winner was named first); (b) R13 "agree" is graded by the verdict, not a date-format regex ("January 30, 1948"); (c) R5 stated answers that open with a bare He/She and never name the entity are `coref-dangling`. r2-10's gold was loosened from `0.33\b` to `0.33` (0.3300984 km is correct): a gold bug, battery sha changed after the first D+ run.
* **G variants**: the pre-registered G chain is as stated; the per-cue snippet routes and `tau` are fitted on the odd half. G's composite excluding B's wait is a derived number, not a separate run. The pivot is run with a content-free full-stop normalisation (raw un-normalised numbers given in 5.4).
* **B** uses `runAnswerTurn` (the `runSlotTurn` minus the post-hoc "follow the encyclopedia pointer" step, which only adds a citation and costs many rate-limited fetches); a 180 s time box and a cached, 2 s-serialised, 429-retrying fetch replaced the product's 25 s box because Wikipedia rate-limited this IP while other ants ran.
* **The 28-question smoke of arm A** (first two per rung) wrote rows later reused: the arm is deterministic, so a re-run gives identical rows.
* **Not measured / limits**: English and Wikipedia only (cleaner than the web; every ceiling is an upper bound for the product); passage sets are given, so end-to-end retrieval is not tested (the 2 distractors test only ranking among 3 pages); qwen2.5:14b is not installed, so "needs a model" means "needs a 2B model" and a larger model might clear R2/R6/R8/R13; 8-11 questions per cell (CIs +-25 points); one author's questions and key facts (R12 keys favour the lead); D+ and E glue are my own quick code (a failure there says "this glue"); model times were measured under contention with other ants; F-real is n=1 per rung; the Lens/Paradigm/Atmosphere blocks and the EO fold as a summarizer were not run (no model-free claim reader supplies their input); `qwen`/thinking models were not used; the opinion cue was fitted to the 9 opinion questions and is lexical.
* **Mutation check** (`node p1/mutate.mjs`): 10 mutations of the gate, graders and D+ skills, all killed by `p1.test.mjs` (8 tests).

## 9. Files

`eval/ants/p1/`: `battery.mjs` (138 questions), `battery-holdout.mjs` (16), `corpus.mjs`, `lib.mjs` (passage sets, graders v1/v2, bootstrap), `ctx.mjs`, `mech.mjs` (D+), `cfetch.mjs`, `arms/{a,b,c,d,e,f,s,dp,freal}.mjs`, `g.mjs` (the pure gate, fitting, composite), `gate-eval.mjs`, `esc-table.mjs`, `cues.mjs`, `report.mjs`, `report12.mjs`, `make-tables.mjs`, `p1.test.mjs`, `mutate.mjs`. Run output (git-ignored): `results/*.jsonl`, `tables.md`, `esc-*.md`, `gate*.json`, `cues-*.txt`. Reproduce: `node battery.mjs && node arms/a.mjs && … && node g.mjs && node make-tables.mjs`.
