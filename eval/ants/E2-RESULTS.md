# E2 — where a turn's time goes, and how to cut it (results)

Ant E2, 2026-10-06/07. Pre-registration: `eval/ants/E2-PREREG.md` (written before any instrumented run). Harness and run output: `eval/ants/e2/`.
Unapplied diffs: `eval/ants/e2/*.diff` (ordered below). Nothing tracked was edited; no git add/commit/push.

**Read this first: every wall-clock number below was measured on a machine under heavy contention** (load average 100-400 for the whole session, other
ants running models and browsers; `gemma2:2b` ran at 6-10 tokens/s). Absolute seconds are therefore inflated by an unknown factor (I did not get an idle machine
to calibrate). What survives load: the *structure* (what is on the critical path, how many sequential model calls and round trips), the paired
before/after on the same questions, and counts (requests, calls, wins). Where a number is modelled rather than measured it says so.

## 1. The answer to "where does the time go"

26 timed real turns on the real page (+3 app-answered turns of ~0 s), local `gemma2:2b`, the live relay and live web:

* **TTFA == TTD on 29 of 29 turns.** The answer is *held* (the Pivot reads a draft; nothing is streamed) until every later step has run, so the person waits for
  the whole turn before reading one word. Half of all wall-clock (50%) is spent **after the model has finished writing** — work that does not change the words
  that are finally shown (provenance pointing, REC laps; the Pivot's own reading is milliseconds): median 21.8 s (feed) / 25.7 s (fetch log) of a 42.3 s turn; 18 of 26 turns spent >= 5 s there.
* **The model's own write is only 27% of wall-clock** (median call 10.2 s: 5.7 s to the first token (prefill of a ~4.8k-char prompt), then ~16 tokens at 6.6 tok/s).
* **Search + reads are small:** web search median 1.8 s (p90 4.7 s, one 16.9 s), Wikipedia median 1.0 s; page reads median 0.6 s (p90 7.5 s, max 18.7 s). The slow tail
  of "Reading 3 pages… 11 s" is a few straggler reads (browser-direct fetch refused after 5-7 s; an 8 s timeout), not the typical read.
* **Encyclopedia-origin following costs and (so far) yields nothing:** 74 trails, **0** reached an original ("Followed the encyclopedia to its source"); it blocks the model's
  write for a median 1.6 s (8 of 26 turns >= 7 s; two at the 12 s box).
* **The REC loop never changed a word:** in 7 of 26 turns the first check broke a sentence and the loop went back (median 37 s before the answer appeared); it made 13 restatement
  model calls (163 s of model time) and **replaced 0 sentences**; a second lap added 0 sources in 5 of 6 two-lap turns (1 source in the sixth) and replaced 0 sentences in 6 of 6.
* **Provenance pointing is the other half:** 56 pointer calls over 17 turns (3.3 per turn, 5.9 s each) + `findPrimary` (3 serial searches, 3 serial page reads, a model call per page)
  = median 20.6 s after the answer exists. They never change the answer text either.
* **Dead doors:** for every page the browser could not read itself, the chain asks 5 public proxies at once. Over 29 turns: allorigins answered 1 of 132, codetabs / corsproxy.io /
  cors.eu.org / thingproxy 0 of 132 each (660 requests, each telling a third party a page address, for 1 page). The fold's own relay answered 168 of 208; the browser's own read 10 of 142.
* No hidden CPU: between model/network steps the app computes in ms (1% of post-write time is neither model nor network; the UI and the Pivot are not the cost).

### Waterfall (baseline, medians in seconds; feed `at` + in-page fetch log)

| turn type | n | total | search (to first read) | reads | origin+prompt gap | model write | after the write (checks) | p90 total |
|---|---|---|---|---|---|---|---|---|
| facts | 16 | 57.0 | 2.4 | 1.6 | 3.0 | 10.2 | 31.3 | 101.7 |
| follow-ups (pronoun, thread) | 4 | 21.6 | 3.8 | 1.4 | 0.3 | 11.1 | 4.7 | 85.6 |
| writing requests | 3 | 28.6 | 2.9 | 3.4 | 0.1 | 8.1 | 0.3 | 35.3 |
| live asks (weather, news) | 2 | 30.5 | 2.1 | 8.3 | 4.8 | 15.0 | 0.2 | 32.7 |
| **all timed** | **26** | **42.3** | 2.9 | 1.8 | 1.6 | 10.2 | **21.8** | 101.7 |

App-answered turns (a "where did you get that?", a compose request with no source, "find a primary source"): ~0 s, no search, no model — already optimal.
Per-turn rows: `eval/ants/e2/out/baseline.rows.json`, `baseline.waterfall.json`; raw: `baseline.json` (all feed events are stored; note the stored feed keeps only the first 60 events, so the
tail of long turns is cut — the tail analysis therefore uses the fetch log, not the feed).

Share of all wall-clock (26 timed turns, 1306 s): pre-write span 50% (the model write call 27%, network-busy 22%); post-write span 50% (model-busy 38%, network-busy 12%).
Model calls by purpose: write 26 calls / 349 s; **pointer 56 calls / 329 s (17 turns)**; **restate-claim 13 calls / 163 s (6 turns, 0 sentences replaced)**.
Network: direct 482 calls (304 failed/blocked), wiki-api 219 (3 failed), proxy 586 (564 failed).

### Pre-registered baseline claims (E2-PREREG.md)

| claim | verdict |
|---|---|
| B1 median TTD of a research turn > 25 s (refuted if <= 15 s) | **held**: facts 57.0 s, all timed 42.3 s |
| B2 TTFA within 1.5 s of TTD on > 90% of turns | **held**: 29/29 |
| B3 post-model work >= 25%, search+reads >= 30%, write <= 40% | post-write 50% **held**; write 27% **held**; **search+reads >= 30% refuted** (about 11% of the median turn; 22% network-busy in the pre-write span) |
| B4 slowest single search step >= 4 s on the median research turn | **refuted**: median slowest step 1.8 s; 5 of 26 turns >= 4 s |
| B5 >= 30% of pages read never used | **held**: 62 of 173 reads (36%) were read beyond what the turn kept (includes REC-lap reads) |

(Prereg line "refuted if the measured median <= 15 s" for B1 and the deviations below are the only places I departed from the frozen text; see "Deviations".)

## 2. Engines (node probe of the same `search()`, 5 asks x 6 scopes, in parallel as the page does)

| engine | median ms | max ms | answered with results |
|---|---|---|---|
| web (relay -> DuckDuckGo/Brave) | 1785 | 6965 | 5/5 |
| wikipedia | 1292 | 5133 | 5/5 |
| github | 833 | 3454 | 2/5 |
| archive | 986 | 3033 | 1/5 |
| openalex | 787 | 3259 | 1/5 (HTTP 400 on 4) |
| crossref | 649 | 3035 | 5/5 |

All engines already run in parallel (`searchWeb`), and the source router skips archive/openalex/crossref for a plain factual ask (47 engine steps in 26 turns were only web + wikipedia + 2 github).
The web has a flat 6 s budget (never hit in the baseline window; **hit in about half the turns of the later windows** — the relay's latency swings by time of day, see lever L10).
The hosted tier (`/api/race`) was **not measured**: no provider key is configured in this environment and the route is token-gated; I did not use the bridge token.

## 3. Before / after (paired, interleaved, same 16 ground-truth questions, real page, real model, real web)

`eval/ants/e2/matrix.mjs`: for each question every config runs back to back in a fresh tab (cold page memo), order rotated per question so drift cancels. Configs serve a PATCHED COPY of the
module through `page.route` (`eval/ants/e2/patched/`, built from the tracked file by `patch-*.mjs`; the tracked files are untouched) or flip an existing flag. "answer" = the moment the stored
answer replaces the live panel in the DOM (TTFA); "all checks" = when the last post-answer check finished. Medians in seconds; "paired" = median of (config - baseline) on the same question.
Two windows (the relay's speed and the machine's load differ between them, so compare within a window, never across): **window 1** = matrix, **window 2** = matrix2.

| window / config | what it is | answer shown (median, p90) | composer back (TTD) | all checks done | paired d(answer) vs A | correct /16 | Pivot kept share | model calls before the answer |
|---|---|---|---|---|---|---|---|---|
| 1 A | tracked code | 81.9 (p90 141.4) | 81.9 | 81.9 | - | 15 | 0.88 | 2 |
| 1 B | L1 answer-first only | 32.0 (64.7) | 32.0 | 75.5 | -46.8 s, faster on 14/16 | 14 | 1.00 | 1 |
| 1 C | L1+L2a+L3+L6(hedge) | 35.6 (58.8) | 35.6 | 71.3 | -53.1 s, 14/16 | 15 | 0.94 | 1 |
| 1 D | C + salience flag | 25.3 (64.1) | 25.3 | 63.5 | -54.6 s, 14/16 | 15 | 1.00 | 1 |
| 1 E | slot pipeline flag (tracked code) | 17.9 (31.2) | 17.9 | 17.9 | -69.3 s, 15/16 | **11** | 1.00 | 0 |
| 2 A | tracked code | 80.7 (113.7) | 80.7 | 80.7 | - | 15 | 0.93 | 2 |
| 2 F | L1+L2a+L3 + read cap/grace | 25.8 (44.4) | 25.8 | 53.4 | -58.3 s, 14/16 | 15 | 0.94 | 1 |
| 2 G | F + L2b (REC laps after) + L9 (origin box 2 s) | **16.6 (39.8)** | **16.6** | 48.1 | **-62.7 s, 16/16** | 14 | 0.87 | 1 |
| 2 H | Sources only (existing mode) | 16.4 (29.9) | 16.4 | 16.4 | -65.8 s, 16/16 | 14 | n/a | 0 |
| 2 I | Sources only + read cap/grace | 15.9 (39.0) | 15.9 | 15.9 | -63.9 s, 16/16 | 15 | n/a | 0 |
| 3 F | as 2 F (re-run) | 23.5 (50.2) | 23.5 | 50.0 | - | 15 | 0.87 | 1 |
| 3 J | F + web budget ends 2 s after another source answered (L10) | 15.2 (42.1) | 15.2 | 46.0 | J-F: -4.4 s, faster on 12/16 | 14 of 15 valid (mona: the turn never started, 0 requests) | 0.86 | 1 |
| 4 A | tracked code (machine load 8-40) | 60.0 (88.5) | 60.0 | 60.0 | - | 15 | 0.87 | 2 |
| 4 K | **everything**: L1+L2a+L2b+L3+L9 + read cap/grace + doors + web budget grace | **12.2 (42.1)** | **12.2** | 37.9 | **-46.5 s, faster on 14/16** | 14 | 0.88 | 1 |
| 4 L | Sources only + the web changes | 11.1 (28.8) | 11.1 | 11.1 | -48.2 s, 15/16 | 15 | n/a | 0 |

(Per-question tables: `node eval/ants/e2/compare.mjs matrix2` etc.; quality: `node eval/ants/e2/quality.mjs matrix matrix2 matrix3 matrix4`; components: `components.mjs`, `writecall.mjs`.)

**Headline.** With everything applied (window 4, the quietest: load 8-40) the median time to a readable, checked answer fell **60.0 s -> 12.2 s (4.9x; p90 88.5 -> 42.1 s), faster on 14 of 16 paired questions**; with all but the web-budget change
(window 2, load ~100) 80.7 -> 16.6 s (4.9x, faster on 16/16); with fewer levers (window 1) 81.9 -> 32.0 s (L1 alone, 2.6x). The composer is back at the same moment (TTD = TTFA), "all checks done" is 37.9 s (window 4) because the
checks still run — they are just no longer waited for. **Model-call totals are unchanged** (window 2: A 33, F 33, G 32 calls over 16 turns; nothing was skipped) and provenance verified on 12/14 (A), 14/14 (K) turns in window 4.
The prereg target "median TTFA <= 8 s" was **not met** (best 12.2 s); "TTD <= 20 s" was met by the full stacks (G 16.6 s, K 12.2 s) and not by the partial ones (B 32.0, C 35.6, F 23.5-25.8 s). Because TTD = TTFA once the answer is no longer held, both targets are one number.

**Quality (same 16 questions, frozen regex).** A 15/16 in all four windows; B 14, C 15, D 15, F 15 / 15, G 14, K 14, J 14 of 15 valid; sources-only H 14, I 15, L 15; slot pipeline E 11. Every model-written config misses "tallest mountain" (the pages it reads say Mauna Kea; tracked code in 3 of 3 windows, patched code too; the sources-only configs pass it). The other misses are retrieval variance, not an effect of reordering: Austen (B, H in other windows, K here), "first person on the Moon" (G, H, I in window 2: the film *A Walk on the Moon*), one turn that never started (J, mona: 0 requests, excluded).
Pivot kept share is 0.86-1.00 everywhere; the tracked code itself read 0.88, 0.93 and 0.87 in its three windows, so differences under ~0.06 are noise at n=16. **Not shown by these numbers and the one real risk:** the web-budget change (K, J) read Wikipedia's "Pride" pages for
the Austen ask once because the web's better page arrived after Wikipedia + 2 s (that run is one of the two misses); L10 trades a little retrieval breadth for 3-4 s.

Why the rest is still 12 s (window 4, K): web search 3.6 s (it was 6.0 s in A: the web's flat 6 s budget fired in 8 of 16 A turns in window 1 and in about half of all matrix turns, 37/80), the encyclopedia follow-up still holds the write 2.1 s, reads 0.5 s, so the write
starts at 6.5 s (A: 14.0 s); the write itself is 1.7 s on the quiet machine (TTFT 1.3 s; in the loaded windows 4-10 s). The REC laps and provenance, which dominated, are off the critical path. Sources-only (no model at all) takes 11.1 s for the same reasons plus the origin follow, which that mode needs.

## 4. Levers (expected vs measured; quality; risk), in the order I recommend applying them

Flags (localStorage) turn each patched behaviour off again in the same file, so every row can be A/B'd live. "Unit" = a node test that passes on the patched file and FAILS on the tracked one (mutation check, `primary-par.test.mjs`, `web-patches.test.mjs`).

| # | lever / diff | expected saving | measured saving | quality delta (same 16 Qs) | risk |
|---|---|---|---|---|---|
| 1 | **Answer first, provenance after** `1-answer-first.diff` (68 lines; flag `fold-chat:e2defer`) | the provenance step: median 20.6 s on the 17 of 26 baseline turns that have one | **B vs A: -46.8 s paired median (14/16 faster), 81.9 -> 32.0 s**; model calls before the answer 2 -> 1; all-checks-done 81.9 -> 75.5 s (moved, not removed) | 14/16 vs 15/16 (Austen: retrieval); provenance verified 14/15 vs 13/14 | the person reads the checked answer a moment before its source line is drawn (the same message redraws with it); the next turn waits for pending checks (`s._after`), so a follow-up sent at once waits for the remainder; Stop no longer reaches the background checks. The Pivot still reads the draft first: nothing unchecked is shown. |
| 2 | **Skip a lap that repeats the last** `2-rec-futile-lap.diff` (11 lines; flag `e2rec`) | a second REC lap that reads the same sentences and pages and asks the same query | in 6 baseline two-lap turns lap 2 added 0 sources in 5 (1 in the sixth) and replaced 0 sentences in all 6 (and 0 in the 2 lap turns of window 4's baseline); the end-to-end effect is not resolvable at n=16 | none (text unchanged by construction) | lap 2 could differ only by search nondeterminism |
| 3 | **REC laps after the answer, no restating** `7-rec-laps-after-answer.diff` (apply after 1 and 2; flag `e2recdefer`) | 7 of 26 baseline turns went back; median 37 s before the answer, up to 88 s | eiffel (lap turn) 62.7 -> 24.8 s; window 2 F -> G: median answer 25.8 -> 16.6 s (with item 4 also in G); modelled on the baseline: 28.5 -> 23.9 s on top of item 1 | G 14/16 vs F 15/16 (moon: retrieval); kept share 0.87 vs 0.94 (within the 0.87-0.93 spread of tracked code across windows) | the first check still runs inline and marks a broken sentence at once; the laps then only search and re-check, they never replace a sentence (baseline: 13 restatement calls, 163 s, **0** sentences replaced); a sentence the laps would have repaired is now only marked; the Pivot decides on pre-lap material (extra sources can only add support). **Needs a product decision**: it ends "SYN restates a failing sentence". |
| 4 | **Encyclopedia follow no longer holds the write** `6-origin-box.diff` (40 lines; flag `e2origin`) | last-read-to-write gap: baseline median 1.6 s (8 of 26 turns >= 7 s, two at the 12 s box), 5-7 s in the matrix windows | write starts at 9.0 s (G) vs 15.5 (F) / 16.4 s (A): origin gap 2.1 s vs 6.7 / 5.5 s; the follow carried on beside the write in 11 of 16 turns | the follow found 0 originals in 74 baseline trails, so nothing the model read changed in practice; it is joined before the Pivot reads the draft | if the follow does find an original after the 2 s, the model did not see it in its prompt (the Pivot, REC, provenance do) |
| 5 | **findPrimary: searches and page reads in parallel** `3-primary-parallel.diff` (34 lines) | 3 serial searches + 3 serial reads (+ a model call per page) -> overlapped | unit only: `primary-par.test.mjs` passes on the patched file; on the tracked file the network wait was 669 ms where the patched bound is 450 ms; the 33 existing primary tests pass on the patched file. End to end it is inside window 2's "all checks" 80.7 -> 53.4 s (with items 1-3), not separable | same candidates, same order, same gate (trail and pointers asserted equal when the slow page ranks first) | up to 3 pages fetched that the early exit would not have; bounded by `maxPages` |
| 6 | **Read grace** `5-read-grace.diff` (23 lines) | `searchWeb` waits for every read worker, so a straggler holds the turn (8 s timeout) after `want` pages are in | modelled on the baseline: 5 of 26 turns save >= 1 s (max 6.8 s, 25 s total = 2% of wall-clock). Live: no straggler occurred in the paired windows (max read span 1.2-1.7 s in all but one 7.1 s), so not measured live | the kept pages are the top-ranked ones that answered; a slower top page is replaced by the next that succeeded | small ranking effect when the top page needs > 1.5 s |
| 7 | **Direct-read budget 1.5 s** `4-direct-read-cap.diff` (19 lines; flag `e2cap`) | a CORS-closed host answers only to be refused (5-7 s on the slow ones) before the relay is asked | unit: 4.7 s -> 1.7 s. Live: failed direct fetches averaged 0.3-0.7 s in the matrix windows (the 5-7 s cases were in the smoke run and the baseline tail), so not resolvable end to end | none (the relay chain is unchanged) | a CORS-open host slower than 1.5 s is read through the relay (a third party learns that page's address, as for every CORS-closed page today) |
| 8 | **Dead-door memory** `9-dead-door-memory.diff` (33 lines; flag `e2doors`) | 660 requests / 29 turns to 5 public proxies that answered 1 time (each told a third party the page address); 142 direct fetches that answered 10 times | unit: each proxy asked <= 6 times over 9 refused reads (tracked: 9); a door that answered once stays up; the relay is always asked. Latency effect: none measurable (they run in parallel) — this is a **privacy and waste** lever | none | a door that comes back to life is retried after 10 min |
| 9 | **Web budget ends 2 s after another source answered** `8-web-budget-grace.diff` (36 lines; flag `e2webgrace`) | the web's flat 6 s clock: hit in 37 of 80 matrix turns | window 3: search span 6.7 -> 3.3 s, write start 16.6 -> 11.4 s, answer 23.5 -> 15.2 s (J vs F paired -4.4 s, faster on 12/16); window 4 K: search 3.6 s | J 14 of 15 valid vs F 15/16; K's Austen miss (Wikipedia read before the web's page arrived) | **the one lever that can change what is read**: web results later than Wikipedia+2 s are dropped from that turn; make it conditional on a plain factual ask if you want it safe |
| - | Salience flag (existing) | smaller prompt | prompt chars median 5089 (D) vs 4254 (C): **no reduction**; answer 25.3 vs 35.6 s is inside the +-10 s noise between near-identical configs (B 32.0, C 35.6) | 15/16 | not a speed lever as shipped |
| - | Slot pipeline flag (existing, off) | no model for one-fact asks | answer 17.9 s (-69 s paired) | **11/16**: "capital of Australia" -> "The Australian Capital Territory.", "Berlin Wall fall" -> a 2009 anniversary, others empty/wrong | blocked by its own known failure on real pages (`fold-chat-answerwire.js` comment); do not enable |
| - | Sources-only mode (existing) | no model call | 16.4 s (H), 15.9 s (I), 11.1 s (L, with the web changes) | 14, 15, 15 of 16 | the other product mode; it shows the model is not what holds the floor — retrieval + the encyclopedia follow are |
| - | Page memo (existing, 10 min TTL) | repeat asks | the same ask twice in one tab: 32.5 s -> 4.4 s and 16.6 s -> 6.4 s (sources-only, 67 -> 7 and 56 -> 3 network requests); search itself is not memoised | - | a search memo (5 min) would help a REC lap or a retry that asks the same query again; not built |

**Pre-registered lever claims, scored.** L1 (answer first): not refuted (provenance is 20.6 s median on turns that have it, far above the 1 s bar). L2 (REC after / skip): not refuted — the REC loop changed the spoken text on 0 of 7 lap turns (bar: 20%), so ordering does not matter for correctness. L3 (parallel reads): **partly refuted** — `searchWeb` already races every engine and reads 3 pages at a time; only `findPrimary` and the straggler wait were serial. L4 (skip provably useless work): **refuted as a lever** — app-answered turns ("where did you get that?", no-source compose, "find a primary source") already take ~0 s, a thread follow-up that asks a new fact must search, and the one-fact slot turn fails quality (11/16). L5 (cache): not refuted for pages (second identical ask 32.5 -> 4.4 s) and not built for searches. L6 (race engines, fail fast): the engines are already parallel; the web relay is the variance (p90 4.7 s, 6 s budget fired in ~half the matrix turns) and L10 is the fix that worked. L7 (smaller model for pointer/classify): not measured (off the critical path after diff 1; classify is 0.1 s). L8 (trim the prompt): the prefill is 60% of the write's time but the shipped salience does not shrink the prompt, so the lever is open and unbuilt.

## 5. Recommended order (saving / risk), each tiny and testable

All diffs are `patch -p1` diffs against the working tree as it stood when I generated them (fold-chat.js is being edited by other sessions; `patched/fold-chat-g.js` in the matrix was built from an earlier state of it, same edits). Within one file apply in numeric order — **page** (`fold-chat.js`): 1, 2, 6, 7 (7 needs 1 and 2); **primary**: 3; **web** (`fold-chat-web.js`): 4, 5, 8, 9 (incremental, each on the previous). I checked that all nine apply in sequence and that the result of 4+5+8+9 is byte-identical to the web file windows 3 and 4 ran. Each is behind a localStorage flag so it can be A/B'd in place; `eval/ants/e2/matrix.mjs` + `configs.mjs` is the live before/after.

By saving / risk:
1. `1-answer-first.diff` — biggest win, lowest product risk (provenance is the same code, same checks, run after the Pivot's text is on the page). 2.6x alone.
2. `2-rec-futile-lap.diff` — 11 lines, text unchanged by construction.
3. `6-origin-box.diff` — 74 trails, 0 originals; saves 4-7 s of the pre-write span.
4. `3-primary-parallel.diff` (+ `primary-par.test.mjs`) — pure waiting; same verdicts. Shrinks the background checks (all-checks-done 80.7 -> 53.4 s in window 2) so the next turn waits less.
5. `7-rec-laps-after-answer.diff` — **product decision**: laps stop restating. Largest tail cut (the 7 of 26 turns that took 25-88 s).
6. `5-read-grace.diff`, `4-direct-read-cap.diff` — small, tail-only, unit-tested (4 first in the chain).
7. `9-dead-door-memory.diff` — waste and third-party exposure, not latency.
8. `8-web-budget-grace.diff` — 3-4 s on slow-relay days, the only lever that can change which pages are read.

Tests that ship with the proposal (they live in `eval/ants/e2/` and import `./fold-chat-*.js`, so they run where the patched files sit; I ran them against copies of the patched files in a scratch dir that symlinks the rest of the repo):
`primary-par.test.mjs` (3 tests; 2 pass / 1 FAIL on the tracked file), `web-patches.test.mjs` (7 tests; 3 pass / 4 FAIL on the tracked file; the existing 11 `fold-chat-web` tests and 33 `fold-chat-primary` tests pass on the patched files).
The page-level diffs (1, 2, 3, 6) are in `run()`, which has no DOM test; their test is `matrix.mjs` on the real page (flags off = the tracked path in the same file).

## 6. What blocks / what I could not measure

* **Load.** The machine ran at load average 100-400 for most of the session (8-40 for window 4). All absolute seconds are inflated and noisy: the tracked code's own median swung 60.0-81.9 s across windows. I trust: the structure, the 14-16-of-16 paired wins, the call counts, and that differences below about 10 s between near-identical configs are noise (B 32.0 / C 35.6 / D 25.3 are the same path). I could not get an idle machine.
* **Hosted tier (`/api/race`) not measured**: no provider key is configured here and the route is token-gated; I did not use the bridge token. The local model was `gemma2:2b` only (6-10 tok/s loaded; TTFT 1.3-5.7 s depending on load).
* **Smaller model for the pointer / classify steps (L7) not measured.** Pointer calls (56 in 17 baseline turns, 5.9 s each loaded) are now off the critical path under diff 1, so the saving would be in "all checks done", not in the answer. Classify and plan cost 0.1 s: nothing to gain.
* **Prompt trimming not solved**: salience as shipped does not shrink the prompt (median 5.1k vs 4.3k chars); the write's time-to-first-token is prefill-bound (1.3 s idle, 5.7 s loaded), so a smaller prompt remains the lever for the write itself, untested.
* **L2b changes product behaviour** (laps no longer restate); only 7/26 baseline turns went back and 0 of 13 restatements held, but that is a small sample of one small model.
* **Search memo, early-exit between engines, alternative relays**: not built. The web relay is the single slowest and most variable step (6 s budget fired in about half the matrix turns; p90 4.7 s, max 17 s in the baseline window); a second relay or a direct Brave API key is the real fix and is outside the files I may touch.
* The stored turn feed keeps only the first 60 events (`storeEvents(..., {max: 60})`), so for long turns the tail steps are missing from a reloaded record; I used the in-page fetch log for the tail. If you want post-hoc timing from a stored turn, raise that cap or keep the per-step `ms` of the last events.
* `eval/ants/e2/out/` (~20 MB of run JSON) is **not** git-ignored: add it to `.gitignore` or delete it before any commit. `eval/ants/e2/patched/` is generated (rebuild with `patch-*.mjs`).

## 7. Deviations from the pre-registration (listed, not edited away)

* The ground-truth regex for "speed of light" accepted only metric forms, so the baseline's correct "186,282 miles per second" scored WRONG; reported as is (the strict count includes it, 16/17 in the baseline mix), not re-scored. The regexes were otherwise unchanged.
* The prereg planned L2/L3 as a single page-patch each; I split provenance (L1), a futile lap (L2a), laps-after (L2b), origin (L9), primary-parallel, read grace, direct cap, doors and the web budget (L10) into separate diffs so each can be taken or refused. L9, L10 and the doors came out of the baseline data, they were not in the candidate list.
* Median TTFA <= 8 s was missed (12.2 s best); TTD <= 20 s met; quality non-inferior within the stated margin (correct count 14 vs 15 of 16, kept share within the tracked code's own window-to-window spread).
* The matrix used 4 windows with different configs paired to their own baseline; no cross-window comparison is made.
* The first smoke run and the first baseline attempt used a TTFA detector that fired when the live row dropped its `.live` class (after the model write), not when the stored answer replaced it; I killed that run and re-ran with the fixed detector (`window.__liveEl` swap). No result of the first attempt is used.

## 8. Files

* Harness: `eval/ants/e2/lib.mjs` (instrumented real turns), `baseline.mjs`, `matrix.mjs`, `configs.mjs`, `analyze.mjs`, `waterfall.mjs`, `components.mjs`, `quality.mjs`, `writecall.mjs`, `model.mjs` (modelled levers), `engines.mjs`, `cache.mjs`, `report-baseline.mjs`, `truth.json` (frozen).
* Patch builders (never edit tracked files): `patch-l1.mjs` (parts `l1,l2a,l2b,origin`), `patch-primary.mjs`, `patch-web-f.mjs` (parts `cap,grace,webgrace,doors`), `patch-web.mjs`/`patch-web-grace.mjs` (the earlier hedge variant used in window-1 config C/D, superseded by the 1.5 s cap).
* Diffs: `eval/ants/e2/1-answer-first.diff` … `9-dead-door-memory.diff`; tests: `primary-par.test.mjs`, `web-patches.test.mjs`.
* Run output: `eval/ants/e2/out/` (`baseline.json`, `matrix*.json`, `*.log`).
