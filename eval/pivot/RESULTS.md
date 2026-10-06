# The Pivot — results (2026-10-06)

Predictions: `PREREG.md` (written before each run). History is appended, never edited; post-hoc changes are named.

## Unit (`fold-chat-pivot.test.mjs`): 22 tests, full repo suite 1349/1349
Forced-bad drafts (list, reflex, invented figure, fragment, third person, invented designer, invented attribution) must not reach the text
AND the raw draft must fail the same check. Fuzz: 300 random drafts, never markup / "!" / a fresh figure, always `verifyPivot`-ok.
Mutation check (delete a gate, tests must fail): boilerplate, third-person, number-origin, grounding, label, question, truncation, markup,
attribution, no-grammar gap, coref rescue, echo cut, pathos paragraphing, experiencer requirement — ALL killed. TWO mutations survive and
are reported: the "only on thin" guard on the antecedent rescue, and the "only on terms" guard on the echo cut (each is defence in depth: the
chained / remainder check fails for a bad term anyway, so no test can see the guard).

## Real page (`fold-e2e-pivot.mjs`, FOLD_URL :8814, forced-bad model, MutationObserver on every assistant bubble)
Run 1: 6 stand, 1 FALSIFIED — **E1**: the invented designer never reached the DOM, but the TRUE sentence "It is 330 metres tall." was withheld
as `ungrounded:thin` (over-withholding, the false-positive side). Fix after the run (disclosed, post-hoc): the antecedent rescue.
Run 2 (after the fix, and again after the pathos wiring): **7 stand, 0 falsified, 0 unmeasured.** E7 (switch off) shows the invented
designer IS stored and shown, so E1–E3 pass because of the Pivot. 'Stands' = survived this attempt.

## Real small model (`eval/pivot/live.mjs`, gemma2:2b, temp 0, 16 sourced asks over 8 real Wikipedia intros + 6 judgment asks)
| | prediction | run 1 | run 2 (after the echo-cut fix) |
|---|---|---|---|
| L1 defects in spoken text (markup, "!", reflex, >1 question, fragment) | 0/22 | **0/22** (raw 6/22) | **0/22** |
| L2 verifyPivot ok | 22/22 | 22/22 | 22/22 |
| L3 coverage ratio spoken >= raw on every sourced case, mean rises | yes | 0.99 → 1.00 (n=12; 4 empty) | 0.74 → 0.75 (n=16), never lower |
| L4 unsupported figures+names spoken <= raw | yes | 0 → 0 | 0 → 0 |
| L5 withheld share (sourced) 10–40%, `nothing_survived` <= 2/16 | | 10%, **4/16 — FAILED** | 2%, 0/16 |
| L6 judgment: 20–60% withheld, >= 4/6 keep >= 2 sentences | | 47%, 5/6 | 47%, 5/6 |

**What run 1 showed (a real defect, found by the prediction failing):** all four empty cases were the single true sentence "The most notable
fact about X is that …", withheld as `ungrounded:terms` because "most notable fact" are the person's OWN ask-frame words that no source says.
Fix after the run (post-hoc): the echo cut — only after the full sentence failed ONLY on terms, the ask's own leading words are cut and the
remainder is held to the sources; an echo with nothing after it, or a fabricated remainder, is still withheld (tests).

**What the numbers do NOT show.** L3/L4 are flat: gemma2:2b with sources already copies them (raw coverage ~0.74, no unsupported figures),
so there is no evidence here that the Pivot improved factual accuracy on this battery — the measured gains are in shape (L1). The judgment
asks show the limit: the spoken text is the model's generic restatement minus barrage/markup/reflex ("You're asking about a sensitive
situation…"), and a stock opener the table does not list ("It sounds like you're weighing…") passes. 21 of 45 judgment sentences were
withheld; some may have been fine — `show/` lists every one with its reason for a person to judge. Not claimed: that anything is wise.

## Amendment 2 — the gate history (fold a900f6e): results
Unit (`fold-chat-gates.test.mjs`, 8 tests; repo suite **1363/1363**): the vendored copy is byte-identical to its pin and its own control holds
(no input with rejected 0 yields `pass`; failure trumps 'never rejected'); 25 clean runs leave every gate `unmeasured`; one caught sentence
flips ONLY the gates that caught something; a refused realiser reads `fail`; an unread turn records nothing; compaction keeps cumulative
totals exact; blocked/corrupt storage is an empty history, never `pass`. Mutation check, all killed: failed-always-0, rejected-not-counted,
skipped-turn-recorded, compaction-drops-totals, empty-history-reads-pass, verdict-ignores-history.
Real page (`fold-e2e-pivot.mjs` E8, E9): **9 of 9 stand** over the whole file. E9 FALSIFIED on its FIRST run (the history read null after the
clean turn and the ledger held one turn's records instead of two — one turn recorded no gate verdicts); it then stood on two reruns. I did not
find the cause of that first failure, so it is a flake of unknown origin, not a fixed bug.
What the real battery says (22 gemma2:2b asks, shown on the demo page): `label`, `boilerplate`, `question`, `ungrounded` have withheld
something (**pass**); `third_person`, `attribution`, `number_not_given`, `truncated` and `verify` have **never** withheld anything in that
battery (**unmeasured**). Their unit tests reject, but the live battery never exercised them — that is exactly the difference stage 12 draws.
