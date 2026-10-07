# C5 — PRE-REGISTRATION (written before any run of eval/ants/c5/run.mjs)

Atom: does the SALIENT prompt (fold-chat-salience.js: salientSources / salientHistory / salientSummary) hand the model less, without losing a dependency a follow-up needs?

State found before registering (read from the code, not assumed): fold-chat.js ALREADY calls the salience module (around line 2119, `if (salienceEnabled())`), behind localStorage `fold-chat:salience` with `SALIENCE_DEFAULT = false`. So "wiring" here means the switch's default plus the two fixes Amendment 4 itself names (history capped by characters; the withheld-draft cause). The harness builds the prompt with the SAME functions fold-chat.js uses (planTurn, classifyTurn, askTerms, continuesThread, salient*, exchangesOf/applyExchange/applyCarry, sourcesPrompt, threadPrompt, garyDoor.composeTurn -> FOLD.buildTurnMessages), in two arms.

## Material
* conversation.json: 12 turns, fixed before running. 3 topic switches (T4, T6, T9), 2 dependent follow-ups (T2 "Who designed it?", T7 "Where was she born?"), 1 pronoun-only follow-up (T5 "Why?"), 2 chit-chat (T3 "Thanks!", T8 "How are you?"), the rest standalone/same-topic (T1, T10, T11, T12).
* Sources: real Wikipedia plain text (pages.json, fetched live, cut to ~3,000 chars at a sentence boundary = the size of the real Amendment-4 capture), 3 pages per web turn: topic page, a related page, a near-miss page.
* Model: local Ollama gemma2:2b, temperature 0, seed 0, num_ctx 8192, one run per arm (plus one repeat per arm to check determinism). Each arm feeds its OWN answers back as history (real behaviour). A PAIRED size comparison is also reported: the salient prompt rebuilt on the CURRENT arm's transcript, so size is compared on identical history.
* Declared limits (not modelled): flow cues / pathos cues (`cues` = []), the ON RECORD block (records need the full Pivot), the Pivot's verification, the web search itself (sources are scripted), minds/voice lanes. The answer used in the history is the model's raw first draft, not the Pivot-verified text.

## Measures per turn (both arms)
1. prompt chars and tokens (chars/4) of all messages; plus Ollama's own `prompt_eval_count`.
2. what was kept: per source page the sentences kept of total (excerpt.sentences), the number of earlier messages carried, whether a PAST DISCOURSE block is present.
3. the dependency check below.

## Criteria per turn (a turn PASSES an arm if all its criteria hold)
* NEEDLE = the hand-listed verbatim fragment (conversation.json) occurs in the source block of the prompt.
* D-CONV (dependent turns T2, T5, T7) = the previous exchange is carried by the conversation channel: BOTH the previous ask text and the previous answer text occur in the prompt's messages other than the source block (history messages / system PAST DISCOURSE / the thread block for T5), AND the referent name (`referent`) occurs there.
* T1: NEEDLE. T2, T7: NEEDLE and D-CONV. T5 (thread turn, no search): D-CONV, where the thread block counts. T10, T11, T12: NEEDLE.
* LEAK (switch turns T4, T6, T9) = any `markers` word of the previous topic occurring (case-insensitive) in the prompt OUTSIDE the source block. Passes if there is none. NEEDLE also required.
* Chit-chat (T3, T8): classifyTurn must be `smalltalk` => the model is NOT called in either arm (the fold's fixed line); both arms get 0 prompt tokens. The effect on the next turn's history (a user message with no assistant reply) is reported.

## What would refute the claim "salience cuts the prompt without losing a needed dependency" (the falsifiers)
* F1: any dependent turn (T2, T5, T7) where the salient arm fails a criterion the current arm meets.
* F2: any other turn where the salient arm loses NEEDLE that the current arm has.
* F3 (size): mean prompt-char reduction over model-called turns below 50% (the S4 bar of Amendment 4, which failed at 30%). Reported either way; not the only verdict.
* F4 (answers, hand-judged, labelled file judgments.json): on T2, T5, T7 the salient answer is worse than the current answer (labels below). Rubric: CORRECT = states the expected fact for the turn (T2: Gustave Eiffel / his company; T7: Warsaw) or, for T5, an explanation about the previous answer's subject (photosynthesis/oxygen/water) drawn from what was handed; PARTIAL = on topic, correct but does not answer, or hedges; WRONG = wrong topic, wrong fact or fabricated. Labels are written after reading the answers, once, and never edited; the harness output is saved raw first.
* F5 (leak): a topic-change turn whose salient prompt still carries previous-topic marker words outside the sources.

## Not claimed
That one scripted thread generalises; that fewer tokens make a 2B model wise; that the Pivot-verified answer would match (the model draft only, one run). n = 1 conversation x 2 arms; temperature 0 removes sampling variance but not prompt sensitivity.

## Addendum 1 (written after run1/run2/run3, BEFORE run4) — what the runs showed and the second fix being tried
Observed in run1 (as shipped): the salient arm kept the needle and the previous exchange on every dependent turn, but old-topic words still reached the prompt outside the sources on the non-switch turns T5 ("Why?": the Eiffel reply), T7 and T10. Cause 1 (history): `salientHistory` slices the last 2n MESSAGES; a chit-chat user message with no reply shifts the window. Run3's first fix (exchange-aligned + 900-char cap, `salience-fixed.js` v1) did NOT clear the leak: the last TWO exchanges are the window, and after a topic switch the older of them is still the previous topic (T5: T2's Eiffel exchange).
Second fix (v2, `fold` arm "fixed" in run4): the window walks back from the newest exchange and takes an earlier exchange only if it shares a content stem (termsOf with the closed class) with the exchange after it. Predictions, registered now: (a) T5 and T10 carry no old-topic word outside the sources; (b) T7 STILL carries "eiffel/tower" because its Flow line is built from a search query the carry polluted ("Marie Curie The Eiffel Tower Where was she born?") — the carry lane's defect, not the history's; (c) no dependent turn (T2, T5, T7) loses D-CONV or NEEDLE; (d) mean prompt chars stay within 3% of run3's salient. Refuted if any of (a)-(c) fails.
