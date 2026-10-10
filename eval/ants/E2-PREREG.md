# E2 pre-registration — where does a turn's time go, and how do we cut it by a large factor

Written 2026-10-06 BEFORE any instrumented run. Before writing it I had only (a) read fold-chat.js `run()` (lines 1811-2758) and
fold-chat-turnfeed.js, and (b) run three 17-token `ollama /api/generate` smoke calls (gemma2:2b: ~10 tok/s, prefill 0.1-0.9 s, machine load
average 57 because other ants share it — every wall-clock number below is therefore measured UNDER CONTENTION and said so).

Task (user): "see how we can vastly speed up the responses." Product rules that may not be weakened: find/snip/cite never rewrite; the model
is never alone; honest gaps are drawn; every claim is checked; nothing raw leaves the trust domain.

## What I read in the code (hypotheses, not findings)

H-structure. In `run()` the answer is HELD until every check has run: search -> (slot turn) -> origin-following -> model write -> continue
reprompt -> language restate -> REC loop (<= 2 laps, each = re-search + page reads + model restatements, budget 25 s) -> Pivot (mechanical) ->
provenance pointer (2nd model call) -> findPrimary when the lead is an encyclopedia (search + page reads + model calls) -> watcher ->
`appendMsg`. Nothing is streamed (pivot on). So time-to-first-visible-answer (TTFA) should equal time-to-done (TTD) to within the UI tail.

## Method (frozen)

Harness: `eval/ants/e2/` drives the REAL page (`eval/pivot/chat-live.mjs openChat/say`) against http://127.0.0.1:8815/ with local Ollama
gemma2:2b (heimdall). In-page wrappers record every `fetch` (start, first byte, end, url class, status) with `performance.now()` relative to
the click on Send; the turn's own feed (`record.feed`, `at`/`ms` per step) and tape are read back from localStorage. TTFA = first moment a
non-live `.msg.assistant` body with text exists in the DOM; TTD = composer re-enabled. Server-side engine timings come from a node
probe of each engine's real endpoints. No synthetic latency anywhere.

Turn mix (>= 20, one fresh chat per group so follow-ups have a thread): 8 single facts, 4 pronoun/elliptical follow-ups, 4 writing
requests, 2 live-data asks, 2 source-asks / "sources only". Ground-truth set: 16 factual questions with a known answer regex
(`eval/ants/e2/truth.json`, frozen before the first run): correct = the SPOKEN text (or sources-only text) matches the regex.
Grounded coverage = share of spoken sentences the Pivot kept (`pivot.stats.kept/in`) plus `grounding.coverage` when present.

## Claims a counterexample refutes (baseline)

B1. Median TTD of a research turn is > 25 s on this machine. Refuted if the measured median <= 15 s.
B2. TTFA is within 1.5 s of TTD on > 90% of turns (the answer is held). Refuted if >= 20% of turns have a readable answer >= 3 s before done.
B3. Post-model work (REC loop + provenance pointer + findPrimary + origin following) accounts for >= 25% of the median research turn's
    time; search + page reads for >= 30%; the model write for <= 40%. Each is refuted if outside by more than 10 points.
B4. Search is the dominant slow tail: the slowest single search step per turn is >= 4 s on the median research turn.
B5. At least 30% of pages read in a turn are never cited / never carry a spoken sentence ("never used").

## Targets for the recommended changes (after levers)

T-A. Median TTFA <= 8 s and median TTD <= 20 s on research turns, same machine, same load class.
T-B. Non-inferior quality on the same 16-question ground truth: correct count after >= correct count before - 1 (of 16, one question of
     noise for a sampled small model), and mean Pivot-kept share not lower by more than 0.05. Every product rule still true: a pointer never
     model-written; REC/provenance still run on every research turn (only their ORDER relative to the first visible answer may change);
     the draft is still not shown unchecked (the Pivot's checked text is what appears first).
T-C. A lever is "real" only if its measured saving is >= 1 s on the median of its eligible turns AND quality T-B holds. A lever whose
     measured saving is under 1 s, or that moves any quality metric outside T-B, is reported as FAILED, not rounded up.

## Levers to test (candidate list; each has its own refutation)

L1  Answer-first: show the Pivot-checked answer, THEN run provenance pointing / findPrimary / watcher and append them under it.
    Expected: TTFA falls by the whole provenance (+findPrimary) time. Refuted if the pointer step is < 1 s of the median turn.
L2  REC loop after visibility (lap 1 only inside the budget, results arrive as a notice) OR skip when the Pivot has already withheld
    every failing sentence. Refuted if the REC loop changed the spoken text on >= 20% of turns (then ordering matters for correctness).
L3  Page reads in parallel / not serial; stop reading when read budget is met. Refuted if reads are already parallel (see trace).
L4  Skip provably useless work: Sources-only turn -> no model, no pointer step; follow-up on the thread -> no search; single-fact slot
    turn handled mechanically. Refuted if these turns were already skipped (check the feed).
L5  Cache: page memo across turns, search memo for follow-ups, `web.readText` memo for findPrimary. Refuted if the 2nd identical ask is
    not faster by >= 1 s.
L6  Engine race with early exit and dead-engine memory; shorter fail-fast timeouts. Refuted if no engine call in the sample exceeds
    its useful budget (p95 of useful search results returned <= 4 s).
L7  Smaller/faster model for the pointer and classify steps (qwen2.5-coder:1.5b or none). Refuted if pointer accuracy (pointer sentence
    found verbatim in a page) drops by more than 1 of 16.
L8  Trim prompt size (salience). Refuted if prefill share of write time < 15%.

Every lever is tested with a real before/after on the real page where the patch can be injected by `page.route` serving a PATCHED COPY
of the module from `eval/ants/e2/patched/` (no tracked file is edited). Where that cannot be done safely the lever is measured by
module-level replay with the recorded timings and reported as "modelled, not measured".

## What would make me abandon a claim

Any lever whose after-run quality falls outside T-B. Any baseline claim contradicted by >= 20% of turns. Results are never edited after
the fact; deviations are listed in E2-RESULTS.md under "Deviations".
