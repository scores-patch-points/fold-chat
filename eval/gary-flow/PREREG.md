# PREREG — Gary's door, Terry Gross's flow, the pathos archons (written 2026-10-05, BEFORE any arm was run)

Status: the sets, arms, criteria and bars below were written before `measure.mjs` was run on any case. Passages are fetched
through the app's own `searchWeb` over its existing relay (serial, one retry) the FIRST time a query is needed and kept in
`passages.json` keyed by the query, so every arm that searches the same query reads the SAME sources (the arms run back to back
per case). A conversation's follow-up queries depend on the earlier answers, so the passages cannot be frozen before the arms run;
the sha256 of `passages.json` is recorded under FROZEN after the run. Bars are not changed after results; "bar not met" is reported as such.

## Question
Does composing the chat's model calls through Gary (order, question last, a refused fold withheld, window-aware), reading
follow-ups through Terry Gross (push-backs and frame-asks are moves against the thread), and giving the reply the pathos
archons' felt-shape read, make a small local model's turns better — and does any part of it make them worse?

## Model and settings (fixed)
`gemma2:2b` on the local Ollama (:11435, OpenAI-compatible, non-streaming), temperature 0, max_tokens 400. (qwen2.5:14b is not
installed on this machine; reasoning models are not used.) One run per case; n is small and every number is reported with its n.

## Sets
* **E25** — the 25 everyday asks of `everyday.mjs` (single turn), fresh conversation each.
* **C10** — ten conversations (below), 2-3 turns each. Turn 1 of each is answered ONCE under the BEFORE arm and that answer is
  the shared prior assistant turn for every arm, so the follow-up is the only variable.

| id | turns |
|---|---|
| c1 cookie | show me a cookie recipe → i want a chewier one → what? |
| c2 austen | Who wrote Pride and Prejudice? → when was it published? → are you sure? |
| c3 guitar | I want to learn guitar → where should I start? → shorter |
| c4 interest | How does compound interest work? → give me an example → so what does it all mean |
| c5 capital | What's the capital of Australia? → why not Sydney? → prove it |
| c6 virus | Explain the difference between a virus and a bacterium → which is worse? → i don't get it |
| c7 es | ¿Cuál es la capital de Francia? → ¿y la de Italia? → ¿qué? |
| c8 zh | 东京有多少人口？ → 那大阪呢？ → 什么？ |
| c9 code | How do I reverse a string in Python? → in javascript instead → what? |
| c10 cold | what?  /  are you sure?  /  prove it   (each as the FIRST message of a fresh conversation) |
| c11 flat | three canned flat answers (a run the pathos organ reads as stale), then: who wrote Mansfield Park? — the only case that exercises the felt-shape read, because every other case has fewer than 3 earlier answers |

## Arms
* **BEFORE** — the code path at the start of this work: `turnPlan` (fold-chat-thread.js), `FOLD.buildTurnMessages` with the
  same `turnBase`, history and source block, no door, no cues.
* **AFTER** — `planTurn` (Terry's moves on top of turnPlan), `door.composeTurn` (Gary: cues, refused-fold withheld, window shed,
  question last), cues = Terry's fact for the act + the pathos organ's read of the recent answers, window = Ollama's
  `context_length` for the model (read from /api/ps).
* **AFTER-NC** — AFTER with no cues (the door and the planner only). Separates the cues' effect from the door's and the planner's.

## Criteria (per case, computed mechanically; the text a person SEES = the reply after `stripScaffolding`)
* **R route** (follow-up turns): the planned mode is the pre-registered one. Gold: "i want a chewier one" → web, query holds
  `chew` and `cookie`; "when was it published?" / "¿y la de Italia?" / "那大阪呢？" → web with the carried referent in the query
  (c2/c7/c8: query holds `Pride|Austen`, `Francia|France`, `东京|Tokyo`) — **or** the arm's own plan, whatever it is, is recorded
  and judged by T below; "what?", "shorter", "i don't get it", "are you sure?", "prove it", "so what does it all mean" with an earlier
  answer → thread (no search); the same asks with NO earlier answer (c9 turn 3: nothing was written for the code ask; c10) → cold-gap,
  **zero model calls and empty model text**. "¿qué?" and "什么？" are in languages the thread cues do not cover: recorded, not scored
  against a gold (a typed gap is the expected honest outcome).
* **T topical** (every turn where the model wrote): the reply holds at least one topic word from the earlier answer / sources
  (`topicWords` per case in `measure.mjs`, fixed before the run). For thread turns the reply must also add NO number that is in
  neither the earlier answer nor the ask.
* **L leak**: the text a person sees contains none of: `[W`, `[T1]`, `[T2]`, `earlier turn`, `answer only`, `the prompt`,
  `the passage`, `the material`, `the sources`, `according to the source`, `the fold`, and — cue echo — `hand the thread back`,
  `the guest`, `drawn out`, `gone flat`, `pushed back`, `standing it earned`, `leave room for`. (Case-folded with `toLocaleLowerCase`
  in the harness only; the app has no case logic.)
* **Q question last**: the final message sent is the person's own message, verbatim (after Gary's strike of an address, none here).
* **G language**: `sameLanguage(question, reply).same` (the app's own detector) for every model-written reply.
* **K tokens**: estimated prompt tokens (chars/4, Gary's own estimator) per call; mean, max, and the number of calls over a
  4096 window with 400 output.
* **E ends-with-question**: the reply's last sentence ends with `?` (Terry's cue says "hand the thread back"; a model may take that
  as licence to ask). Rate per arm on E25.
* **W words**: reply length in words, mean per arm.

## Bars (the shipping rule; each is checked against the numbers, not against how they feel)
* **B1** R: AFTER routes 100% of the English gold follow-ups correctly and BEFORE routes fewer. (If BEFORE is already 100% the bar is "AFTER = 100%".)
* **B2** no regression: AFTER L-failures ≤ BEFORE L-failures, AFTER G-failures ≤ BEFORE G-failures, Q = 100% for AFTER.
* **B3** T: AFTER topical count ≥ BEFORE topical count (over the cases both answer).
* **B4** K: AFTER mean prompt tokens ≤ BEFORE mean × 1.10.
* **B5** E: AFTER ends-with-question rate on E25 ≤ BEFORE rate + 0.15.
* **B6** cues: the cues ship ON only if AFTER ≥ AFTER-NC on T and G and ≤ on L, and B5 holds; otherwise they ship OFF (`FLOW_CUES = false`
  in fold-chat-flow.js) and the report says so. The door and the planner ship on B1-B4 regardless of the cues.

## Declared, not measured (II.11)
max_tokens 400 (the app asks for 1024; shorter to keep the run small — a longer budget can only make the E and W numbers larger);
temperature 0 (the app uses 0.7; this measures the prompt, not the sampler); the leak and topic lists above.

## Addendum — written after the main run started, BEFORE the AFTER-DD arm was run
Kondo (Gary's counter of what a prompt carries twice) found that a thread turn carries the earlier ask and answer twice: once as
the recent turns and once in its own [T1]/[T2] block (144 of 206 estimated tokens on a short answer; the earlier answer is clipped
at 4,000 characters in the block, so a long one costs far more). `carryOnce` (fold-chat-gary.js) leaves a repeated ask+answer PAIR
out of the turns when the system block already quotes it. Arm **AFTER-DD** = AFTER + that dedupe, nothing else.
* **B7** dedupe ships ON only if, over the THREAD turns (plan mode thread, model-written), AFTER-DD's T count ≥ AFTER's, its L failures
  ≤ AFTER's, its G count ≥ AFTER's, and its mean prompt tokens on those turns are lower. Otherwise it ships OFF.

## Addendum 2 — written after the main run and BEFORE the AFTER-INFO arm was run
Main-run readings that prompted it (numbers in RESULTS.md): the leak that remains in every arm is the model saying "the sources" —
the words the app's own source block gives it while telling it NOT to say them. Gary's rule (information-not-prohibition) predicts
exactly that. Gary also flags that block and the thread block (8 and 2 prohibition clauses). Arm **AFTER-INFO** = AFTER-DD with the
two blocks (`sourcesPrompt`, `threadPrompt`) rewritten as plain information in this harness only (nothing shipped): no prohibition
clause, and the word "pages"/"texts" in place of "sources". The label markers `[W1]`/`[T1]` stay (the app maps them back to citation chips).
* **B8** the rewrite ships only if, over the same turns as AFTER-DD, L failures are lower, T and G counts are not lower, Gary finds
  zero prohibitions and zero apparatus nouns in the rewritten blocks, and `stripScaffolding` still resolves a `[W1]` the model writes.
Also recorded, post-hoc and disclosed: a first reading of the main run showed `planTurn` leaving "prove it" to the carried-pronoun
search; the planner was fixed (a push-back wins over the pronoun trigger) and the AFTER arms for that case were re-run.
Two of the gold routes in C10 were wrong, not the app: c4 turn 3 (nothing earlier had been written — the earlier asks were unreached
gaps — so "cold-gap" IS right) and c9 turn 3 (the second ask got an answer, so there WAS something to follow). They are reported as
scored (X) and then annotated, never silently re-scored.

## FROZEN
passages.json sha256 1c5f40aaac498a82177fde44d2251e91992c5da6c429c5c8bdfb9ae03673dbcf (37 of 39 queries reached sources; "Who wrote Pride and Prejudice?" and "东京有多少人口？" never did — the relay answered 502 — so their first turns are typed gaps in every arm). Passages for the 15 cases whose first pass hit a 502 were re-fetched once and those cases re-run in full; every other case is from the first pass.
