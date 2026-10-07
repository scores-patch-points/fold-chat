# C3 pre-registration (written 2026-10-06 BEFORE any scorer ran on eval/ants/c3/battery.json)

Atom C3: what would a meaning-level grounding check need. Battery: 30 (claim, sentence) pairs hand-labelled by C3 (E entails 12, T same-topic-not-entailed 6, C contradicts 9, U unrelated 3; 3 marked `loose`). Labels are fixed in battery.json; they are not edited after any run. If a label looks wrong after a run it is REPORTED as disputed, not changed.

Disclosure of what I touched before this file: one door probe (`The Eiffel Tower was designed by Leonardo da Vinci.`, not in the battery) and one janus text probe on `Spiders have eight legs. Spiders have six legs.` (close to pair 4: it returned "2 claims, 0 inferences, several-valued pairs counted, not judged"). No scorer had been written.

Signals scored (each reduces to ACCEPT (says the claim) / REJECT):
 T1  `bearsOn(claim, sentence, fw)` from fold-chat-provenance.js (what verifyNumber applies): one shared content stem + every digit figure of the claim in the sentence.
 T2  T1 AND `assertsClaim` from fold-chat-primary.js (every content stem + same negation/denial/hedge profile): the strictest gate the chat has today.
 T3  fold-chat-ground.js `attribute(claim,[{sentence}])` grounded (the answer-grounding window check).
 K1  khora door `/heimdall/api/read` relation signal: read claim and sentence separately; ACCEPT iff some claim relation and some sentence relation share a verb stem AND their two ends overlap in content stems in the same order. Also record `swapped` (ends overlap crosswise only) and the coverage (pairs where both sides produce >= 1 relation) and referent counts.
 K2  vendored khora `grounding.js` numberSet (word numbers parsed): ACCEPT iff T1's stem test passes AND every number the claim states (word or digit) is in the sentence.
 K3  janus `/v1/reason` text door on `claim + " " + sentence`: contradiction flagged? (expected to say "counted, not judged")
 K4  ORACLE FRONT-END ceiling, clearly labelled: hand-authored GFP claims for the contradiction/entailment pairs where a relation shape exists, sent to `/v1/reason` with declared `functional`/polarity, to learn which of the C pairs the janus BACK end can catch IF a sentence->claim front end existed. This measures the back end only; it says nothing about extracting claims.
 R1  (reference, not khora) cosine of nomic-embed-text embeddings (Ollama): AUC of E vs the rest, E vs C.
 R2  (reference, not khora) gemma2:2b as a three-way judge (ENTAILS / CONTRADICTS / NEITHER), temperature 0, one call per pair. The Fold's rule is the model is never alone; this is a baseline to show what a model-only meaning check does, not a proposal.

Claims that a counterexample REFUTES (each says what outcome would refute it):
 P1  The token checks cannot separate entails from contradicts: T1 accepts >= 60% of the 9 C pairs and >= 60% of the 6 T pairs. REFUTED if T1 accepts < 40% of C.
 P2  The token checks also false-reject true entailments: T2 rejects >= 4 of the 12 E pairs; T1 rejects >= 2 (the figure/approximation/unit/number-word cases 21, 22, 29). REFUTED if T2 rejects <= 1 E pair.
 P3  The strict gate buys precision by losing recall: T2 accepts fewer C pairs than T1 but accepts fewer E pairs by more than it removes false accepts. (Report both; REFUTED if T2 accepts at most 1 fewer E pair than T1 or equal-or-more C.)
 P4  The door's relations are phrase-level: both sides of a pair yield >= 1 relation in < 60% of the 30 pairs; referents are 0 for every single sentence; so K1 fires (ACCEPT) on < 40% of the 12 E pairs. REFUTED if K1 accepts >= 8 E pairs.
 P5  No khora-derived signal deployable today (K1, K2) has precision AND recall >= 0.7 on E-vs-rest. REFUTED if one does (K2 is expected to look good on numeric pairs only).
 P6  Polarity, tense and role swaps are invisible to every deployable signal: among pairs 5, 7, 12, 14, 19, 24, 26, each of T1 and K1 misclassifies >= 4 of the 7 (accepts them or rejects them for the wrong reason).
 P7  Embedding cosine does not separate E from C: AUC(E vs C) < 0.75 and some C pair outscores some E pair. REFUTED if AUC >= 0.85.
 P8  gemma2:2b as a lone judge beats T1 on accuracy for E-vs-not but still errs on >= 2 of the 7 tense/polarity/swap pairs. REFUTED if it errs on <= 1 of them or does not beat T1.
 P9  K4: the janus back end catches the functional-relation contradictions (4, 5, 9) and polarity (7, 19) when handed claims, but not role swap (12) or comparative swap (14) unless acyclic/asymmetry is declared. REFUTED if it catches 12 or 14 with only a `functional` declaration, or misses 4/5/9 with it.

Decision metric stays honest: confusion matrices over the four labels x {ACCEPT, REJECT}; accuracy for the binary task "accept iff E"; false-accept rate = ACCEPT among C+T+U; false-reject rate = REJECT among E. Every number reported with and without the 3 `loose` pairs.

Not done / limits stated in advance: 30 pairs is a probe, not a benchmark; labels are one author's; English only; nothing here was built in khora.

## Addendum A (written after the main run's first results, BEFORE the control set was run)

What the main run showed that I must now control for: every one of the 9 C claims in battery.json is FALSE in the world and every E claim is TRUE, so a model that answers from what it remembers about the world (not from the sentence) would score well on R2 by construction. R2 got 28/30. That is a confound in my own battery, not a result.
Control: eval/ants/c3/battery-cf.json, 14 counterfactual pairs, labels written now: E with claims that are false in the world (and fictional entities the model cannot know), C with claims that are TRUE in the world, T fictional. Same scorers, same rules (`C3_SET=cf`).
 P10 R2 (gemma2:2b judge) reads less than it remembers: its accuracy on the control set (accept iff E) is >= 10 points below its 93.3% on the main set. REFUTED if the control accuracy is >= 90% or within 10 points.
 P11 The token checks do not depend on world truth: T1 accepts >= 60% of the control's C pairs; T2 rejects >= 2 of the 5 control E pairs. REFUTED otherwise.
 P12 The relation signal K1 (door) fires on the control the way it does on the main set: it accepts <= 2 of the 5 E pairs (coverage < 60%).
Also noted before the control run: R2 prediction P8 as written ("errs on >= 2 of the 7 tense/polarity/swap pairs") was REFUTED by the main run (R2 got all 7 right; its two false rejects were 15 and 22, antonym comparative and unit conversion); P7's first half held (AUC E-vs-C 0.537), P4/P6 etc. are scored in the results doc, not here.
