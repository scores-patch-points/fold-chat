# RESULTS — Gary's door, Terry Gross's flow, the pathos archons (2026-10-05)

Run per PREREG.md, `gemma2:2b` on local Ollama (:11435), temperature 0, max_tokens 400, one run per case. `results.json` has every
turn; `node eval/gary-flow/measure.mjs --report` reprints the tables. n is small: read every number with its n.

| criterion | BEFORE | AFTER | AFTER-NC (no cues) | AFTER-DD (+dedupe) | AFTER-INFO (+info prompts) |
|---|---|---|---|---|---|
| R route correct, gold follow-ups (n=11) | 5 | **10** | 10 | 10 | 10 |
| model-written turns | 44 | 42 | 42 | 42 | 42 |
| T topical (same turns, n=42) | 40 | 40 | 40 | 39 | 40 |
| L leak failures | 2 | 2 | 2 | 2 | 3 |
| Q question last + verbatim | 44/44 | 42/42 | 42/42 | 42/42 | 42/42 |
| G language matches | 42/44 | 40/42 | 40/42 | 40/42 | 40/42 |
| K mean prompt tokens (est.) | 1589 | 1596 | 1564 | 1565 | 1488 |
| K calls over a 4096 window | 0 | 0 | 0 | 0 | 0 |
| E ends-with-question, E25 | 1/17 | 0/17 | 1/17 | 0/17 | 0/17 |
| cold / gap turns with zero model calls | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 |

Routing (the part that changed): BEFORE searched the web for "are you sure?", "prove it" and "so what does it all mean" (it searched
"Is Sydney, Australia Worth Visiting? …", "Australia Next Australian Capital Territory election prove it"); AFTER answers them from the
thread, or writes nothing when there is no thread. The one AFTER miss (c9 turn 3, "what?") is an error in my gold: the earlier
"in javascript instead" ask HAD an answer, so following it is right; BEFORE misses it for the same reason. c4 turn 3 was also a gold
error in the first pass (nothing earlier had been written) and is correct after the re-run.

## The bars
* B1 route: AFTER 10/11 vs BEFORE 5/11 — NOT met as written (100% required); the single miss is the gold error above (10/10 on corrected gold).
* B2 no regression: L 2 ≤ 2, G 40/42 = 40/42, Q 100% — met.
* B3 topical: 40 ≥ 40 on the 42 turns both answered — met.
* B4 tokens: 1596 ≤ 1589 × 1.10 — met. The cues cost ~30 tokens (AFTER-NC 1564 → AFTER 1596). (The thread-turn row of the report, 1391 → 1135 before→after, compares a thread reply with the web-searched turn BEFORE made of the same ask; it is not a saving of the door.)
* B5 ends-with-question: 0/17 ≤ 1/17 + 0.15 — met.
* B6 cues: AFTER = AFTER-NC on T (40/40) and G, L equal, B5 holds → cues stay ON. Honest reading: the cues have NO measurable effect on
  these turns (replies are byte-identical on most). c11 (three flat canned answers, then a fresh ask) exercised the flat cue: the reply did not change.
* B7 dedupe: AFTER-DD saves 17% of thread-turn tokens (1135 → 945) but T on thread turns fell 7 → 6 and two replies degenerated
  ("It looks like you're asking for clarification!…" for "what?", "Where should I start learning guitar?" for "shorter"): without the
  earlier turns "what?" and "shorter" lose what they refer to. Bar NOT met → dedupe stays OFF (`composeTurn` option `dedupe`, default false).
  The finding stands: the thread turn carries the earlier exchange twice (Kondo: 144 of 206 est. tokens on a short one). The untested
  alternative is to keep the history and shrink the [T1]/[T2] block.
* B8 info rewrite: L 2 → 3 (the model wrote "[T2]" once the prohibition against writing labels was gone) → NOT shipped. The prohibition was
  doing a job; the real fix for that leak was mechanical, and is shipped: `stripScaffolding` now strips `[T1]`/`[T2]` (it only knew `[W n]`).

## What the measurement did not exercise
* Gary's REFUSE/withhold path and the window shed never fired on a real turn (no real prompt asks for JSON; no prompt reached 4096): they are proven by the unit falsifiers only.
* The pathos read needs 3 earlier model-written answers; only c11 (canned flat answers) reached it. Live (real app, 4 turns) it read `ground_holds` for the experiencer `model:gemma2:2b`.
* qwen2.5:14b is not installed here; gemma2:2b only.

FROZEN: passages.json sha256 1c5f40aaac498a82177fde44d2251e91992c5da6c429c5c8bdfb9ae03673dbcf
