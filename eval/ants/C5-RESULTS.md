# C5 — RESULTS: the salient prompt vs the current prompt, 12-turn scripted conversation

Pre-registration: `eval/ants/C5-PREREG.md` (written before run1; Addendum 1 written after run1–3 and before run4). Harness and raw data: `eval/ants/c5/` (`run.mjs`, `conversation.json`, `pages.json` = real Wikipedia text, `results-run1..4.json`, `judgments.json`, `analyze.mjs`, `wire*.diff`).

## 0. What the repo actually is (corrects the task brief and memory note `salient-only-prompt`)
`fold-chat-salience.js` IS wired into `fold-chat.js` already: the `if (salienceEnabled())` block (around the Gary `composeTurn` call, ~line 2119 when I read it, ~2145 now; the file is being edited by other sessions) calls `askTerms`, `exchangesOf`, `continuesThread`, `salientHistory`, `salientSummary`, `salientSources`. It sits behind localStorage `fold-chat:salience` with `SALIENCE_DEFAULT = false` (eval/pivot/PREREG.md Amendment 4: S4 reached -30% not -50%; S5 had 2 of 3 follow-ups fall back to the page's sentences). So "wiring" = the default and the two fixes Amendment 4 itself named. My harness builds the prompt with the very functions fold-chat.js uses (planTurn, classifyTurn, askTerms, continuesThread, salient*, applyCarry/admitReferents/applyExchange, sourcesPrompt, threadPrompt, `makeDoor().composeTurn` -> `buildTurnMessages`) and the shipped Fold preset text read out of fold-chat.js. Two arms: CURRENT = salience off, SALIENT = salience on (the exact branch). A third arm, FIXED, is the proposed wire.diff.

Model: Ollama gemma2:2b, temperature 0, seed 0, `num_ctx` 8192, model unloaded before every call (so `prompt_eval_count` is the real token count, no prefix cache). Sources: 3 real Wikipedia pages per web turn (~2.8–3.0k chars each: topic page, related page, near-miss). **Determinism check: runs 1, 2, 3 and 4 produced byte-identical answers for every current and salient turn (all 24 turn records compared in each of run2, run3 and run4 against run1, 20 of them real model answers).**

## 1. The conversation (fixed before running)
T1 "How tall is the Eiffel Tower?" · T2 "Who designed it?" (dependent) · T3 "Thanks!" (chit-chat) · T4 "What does photosynthesis release as a byproduct?" (SWITCH 1) · T5 "Why?" (pronoun-only, thread turn) · T6 "When did Marie Curie win her first Nobel Prize?" (SWITCH 2) · T7 "Where was she born?" (dependent) · T8 "How are you?" (chit-chat) · T9 "How long is the Great Wall of China?" (SWITCH 3) · T10–T12 same-topic standalone asks.
Chit-chat T3/T8 classify `smalltalk`: the fold answers with a fixed line, no model call in either arm (0 tokens both) — as pre-registered.

## 2. Size, per turn (chars = all messages; tokens = chars/4; run1)
| T | ask | cur chars | sal chars | cur tok | sal tok | cut | paired cut* | cur hist msgs | sal hist msgs | sources kept/of, current | sources kept/of, salient | stale old-topic words outside the sources, cur / sal |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | How tall is the Eiffel Tower? | 10765 | 4839 | 2691 | 1210 | 55% | 55% | 0 | 0 | 21/21, 15/15, 16/16 | 11/21, 8/15 (Paris dropped: no word of the ask) | - / - |
| 2 | Who designed it? | 11486 | 5436 | 2872 | 1359 | 53% | 53% | 2 | 2 | 21/21, 15/15, 16/16 | 10/21, 8/15 (Paris dropped) | - / - |
| 4 | What does photosynthesis release…? | 11797 | 4818 | 2949 | 1205 | 59% | 59% | 5 | 0 | 16/16, 23/23, 18/18 | 6/15, 8/18 (Chloroplast dropped) | eiffel,tower,gustave / - |
| 5 | Why? | 3138 | 2651 | 785 | 663 | 16% | 18% | 7 | 4 | thread block only | thread block only | eiffel,tower,gustave / eiffel,tower |
| 6 | When did Marie Curie win…? | 12552 | 4866 | 3138 | 1217 | 61% | 61% | 9 | 0 | 22/22, 26/26, 21/21 | 9/22, 10/24 (Curie (unit) dropped: budget) | eiffel,tower,gustave,photosynthesis,oxygen / - |
| 7 | Where was she born? | 12808 | 5965 | 3202 | 1491 | 53% | 54% | 11 | 4 | 22/22, 26/26, 21/21 | 9/22, 10/24 | eiffel,tower,gustave,photosynthesis,oxygen / eiffel,tower,photosynthesis,oxygen |
| 9 | How long is the Great Wall…? | 12867 | 4827 | 3217 | 1207 | 62% | 62% | 14 | 0 | 17/17, 21/21, 26/26 | 7/17, 11/26 (Hadrian's Wall dropped: budget) | eiffel,…,curie,nobel,warsaw / - |
| 10 | Which dynasty built…? | 13111 | 5794 | 3278 | 1449 | 56% | 57% | 16 | 4 | 17/17, 21/21, 26/26 | 9/17, 11/26 | eiffel,…,warsaw / curie,warsaw |
| 11 | Why was the Great Wall built? | 13324 | 5826 | 3331 | 1457 | 56% | 57% | 18 | 4 | 17/17, 21/21, 26/26 | 8/17, 11/26 | eiffel,…,warsaw / - |
| 12 | Is it a UNESCO World Heritage Site? | 13736 | 5910 | 3434 | 1478 | 57% | 51% | 4 | 4 | 17/17, 21/21, 26/26 | 8/17, 11/26 | eiffel,tower,curie,nobel,warsaw / - |

\* paired = the salient prompt rebuilt on the CURRENT arm's transcript (identical history); it agrees with the own-transcript cut to within a few points.
T3 and T8: not sent to a model. (Current history sizes are counts of messages carried; the current arm sends the whole chat while it is under 1,600 chars, then the last 4 messages.)

**Mean over the 10 model-called turns: current 11,558 chars (2,890 tokens), salient 5,093 chars (1,273 tokens) = -55.9% (paired -55.6%). Ollama's own `prompt_eval_count`: mean 2,664 -> 1,176 tokens = -55.9%.** Where it comes from (mean chars): sources 8,722 -> 3,234; PAST DISCOURSE block 1,033 -> 371; history 496 -> 181; the rest (persona + rules + question) is constant at ~1,300. The cut is smallest on the thread turn T5 (-16%): that prompt is already small and its "sources" are the one earlier answer.
Kept sentences: salient keeps the lead plus the sentences that share a stem with the ask plus one neighbour (about 40-50% of a page's sentences, ~1,350 of ~2,900 chars) and drops whole near-miss pages (Paris, Chloroplast, Curie (unit), Hadrian's Wall; the per-turn excerpts are in `results-run1.json` `arms.salient[].info.sal.pages[].excerpt`).

## 3. The dependency criteria (pre-registered), run1 — current / salient
| T | criterion | current | salient |
|---|---|---|---|
| 1 | NEEDLE "330 metres (1,083 ft) tall" | pass | pass |
| 2 | NEEDLE "whose company designed and built the tower" + D-CONV (previous ask, previous answer, "Eiffel Tower" in the conversation channel) | pass | pass (all three parts present) |
| 4 | no old-topic markers outside the sources + NEEDLE | **FAIL** (eiffel, tower, gustave) | pass |
| 5 | D-CONV (the earlier ask and answer in the prompt) | pass | pass |
| 6 | no old-topic markers + NEEDLE | **FAIL** (photosynthesis, oxygen, eiffel) | pass |
| 7 | NEEDLE "born in Warsaw" + D-CONV ("Marie Curie" + the T6 exchange) | pass | pass |
| 9 | no old-topic markers + NEEDLE | **FAIL** (curie, nobel, warsaw, photosynthesis) | pass |
| 10, 11, 12 | NEEDLE | pass | pass |
Chit-chat T3, T8: both arms no model call (pass).

## 4. The falsifiers
* **F1 (salience loses a needed dependency on T2/T5/T7): NOT tripped.** In all three turns the previous exchange is still in the prompt and the needed source sentence is still in the excerpt.
* **F2 (salience loses a needle the current arm has on another turn): NOT tripped** (9/9 needles kept).
* **F3 (size): -55.9% — clears the 50% bar** that Amendment 4's live run missed (-30.2%). Why the difference: here the model's drafts are one sentence (~100-130 chars), so the "last 2 exchanges verbatim" history is small. Amendment 4's capture carried long spoken answers (5,951 chars of history on its turn 3), which is what the 900-char cap in the proposed fix is for; I did NOT test long answers.
* **F4 (hand-judged answers on T2/T5/T7): TRIPPED on T2, by the pre-registered strict reading** — `judgments.json`:
  * T2 current "Gustave Eiffel and his company" = CORRECT; salient "Maurice Koechlin and Émile Nouguier, two senior engineers working for the Compagnie des Établissements Eiffel" = PARTIAL. It is verbatim in the Eiffel Tower page ("The design of the Eiffel Tower is attributed to…") and the model resolved "it"; the lead sentence naming Gustave Eiffel was also in the excerpt. So the dependency was not lost; the 2B model picked the other grounded sentence (arguably the better answer to "who designed"), but it is not the pre-registered expected answer, and I am reporting the registered label, not a kinder one.
  * T5 "Why?": PARTIAL in both arms, byte-identical (circular, and adds "carbon dioxide… glucose", which the handed earlier answer does not contain).
  * T7 "Where was she born?": CORRECT in both arms, byte-identical.
  * Net: salient CORRECT 1/3, current CORRECT 2/3 on the registered rubric; the whole difference is one T2 sentence choice. n=1 conversation, one deterministic draw per arm: it is a signal, not a rate.
* **F5 (leak on a topic change): NOT tripped for salient** (T4/T6/T9: zero old-topic words outside the sources; current fails all three, as it carries the whole thread). But the leak the pre-registration did not look for on non-switch turns exists in the SHIPPED salient arm, see 5.

**Verdict on the claim "salience cuts the prompt without losing a dependency the follow-up needs": it holds on the prompt-presence criteria (F1, F2), the size bar (F3) and the leak bar (F5); one registered answer-quality check (F4, T2) came out worse and is reported as such.** What this does not say: that the Pivot would accept these drafts (Amendment 4's S5 failure was a Pivot withhold; my harness has no Pivot, so that failure is neither reproduced nor ruled out).

## 5. What else the measurement found (not pre-registered; stated as found)
1. **`salientHistory` slices the last 2n MESSAGES, and chit-chat breaks that.** A "Thanks!" / "How are you?" user message gets no assistant reply in the model history (an empty assistant turn is omitted), so the window slips: on T5 the salient history started with an orphan assistant message, the old Eiffel reply ("eiffel,tower" in the "Why?" prompt); on T10 the Curie reply rode into a Great Wall prompt. The CURRENT arm is worse in a visible way: it carries the unanswered "How are you?" and the model answers it inside T9 ("I'm doing well, thanks! … The Great Wall of China is about 21,196.18 kilometers…"); the salient arm has no history on that turn.
2. **Even exchange-aligned, "the last 2 exchanges" crosses a topic switch.** Run3 (fix v1: exchange-aligned + 900-char cap) left the leak unchanged: the older of the two exchanges was still the pre-switch topic. Fix v2 (run4, registered in Addendum 1 before running): the window walks back from the newest exchange and takes an earlier one only if it shares a content stem with the exchange after it. Registered predictions vs run4: (a) T5 and T10 clean — **T5 yes (history 4 -> 2 messages), T10 NO**: the Curie reply and the Great Wall reply share the stem "russian" ("born in Warsaw, Russian Empire" / "Sino-Russian border"); a one-stem overlap cannot tell a coincidence from a topic link. (b) T7 still carries eiffel/tower — **yes, as predicted** (photosynthesis/oxygen are gone). (c) T2/T5/T7 lose nothing — **yes** (all 12 criteria pass in the fixed arm; answers identical to current/salient on T5/T7, the same Koechlin answer on T2). (d) size within 3% — **yes** (5,062 vs 5,093 chars mean; cut vs current 56.2%). So 3 of 4 predictions held, one (T10) is refuted and left unfixed; a stricter overlap (two stems, or the later exchange's ASK only) is a candidate I did not try.
3. **Carry pollutes the search query with a stale referent (not the salience module's defect).** T7's planned search was "Marie Curie The Eiffel Tower Where was she born?": the pronoun "she" resolved to both the latest referent and an older one still weighted in the referent record. In the real fold that would be searched, and salience's `askTerms` then treats "eiffel/tower" as terms of the ask, which keeps the old Eiffel exchange alive in the summary Flow line on T7 even after the history fix. The owner of the fix is fold-chat-carry.js / fold-chat-mind.js `resolveQuestion`/`admitReferents`.
4. The summary block shrinks too: PAST DISCOURSE 1,033 -> 371 chars on average, and on a topic change it is empty (topic = null), so "Topic: How tall is the Eiffel Tower?" no longer rides into a photosynthesis prompt.

## 6. The proposed wiring (NOT applied; `git apply --check` passes against the working tree)
* `eval/ants/c5/wire.diff` — (i) `fold-chat-salience.js`: `salientHistory` takes whole EXCHANGES (an ask with its reply; a reply-less user message is not one), the window ends where the topic does (needs `fw`), capped at `SALIENCE.historyChars = 900` with the newest exchange always kept; (ii) `fold-chat.js`: the one call site passes `fw: fwS`. Backward compatible: `fw` null / old signature behave as before; the 7 existing salience tests pass on the patched module (run in a scratch tree), plus `eval/ants/c5/salience-history.test.mjs` (8 tests; 6 mutants — old slice, no cap, cap drops newest, orphan allowed, no topic bound, bound never breaks — each killed). The tests import `eval/ants/c5/salience-fixed.js` (the patched copy), not the repo's file.
* `eval/ants/c5/wire-default-on.diff` — `SALIENCE_DEFAULT = true`. **I do not recommend applying it yet**: one scripted thread without the Pivot cannot overturn Amendment 4's S5 (two follow-ups withheld). Re-run `eval/pivot/salience-live.mjs` with `fold-chat:salience=on` on the real page first; if the Pivot still withholds, the cause named there (the model paraphrases from less context while verification runs against the full page) is the next thing to diagnose.
* The `fold-chat.js` hunk's line number drifts as other sessions edit that file; it is a one-token change.

## 7. Not done / limits
Did not edit fold-chat.js or fold-chat-salience.js, did not commit. Not modelled: the Pivot and its withhold/fallback, the ON RECORD block, flow/pathos/voice cues (`cues` = []), minds, the real web search (sources scripted from real Wikipedia text), the real page with heimdall. The history answers are raw first drafts of gemma2:2b (not Pivot-verified text). One conversation, one deterministic draw per arm; no long-answer thread, no non-English thread (`askTerms` is English-closed-class; other languages pass through unchanged, untested here). The chars/4 token estimate tracked Ollama's real count (mean 2,890 vs 2,664 est/real for current; 1,273 vs 1,176 salient). C4's per-ask request budget (`fold-chat-budget.js`) acts on the same prompt; I did not read it or test the two together.
