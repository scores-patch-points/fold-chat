# C1 results — A1's two fixes for the origin lane, measured (2026-10-06)

Pre-registration: `C1-PREREG.md` (written before any run; not edited). Everything is in `eval/ants/c1/`. `fold-chat-origin.js` was not touched (md5 09d7010d… before and after); the work is on copies: `c1/origin-base.mjs` (the real file, imports re-pathed, byte-identical otherwise) and `c1/origin-fixed.mjs` (the fixes). Ready-to-apply patch: **`c1/origin-fixes.diff`** (8 hunks, `patch -p1 fold-chat-origin.js < origin-fixes.diff` verified on a scratch copy: the result equals `origin-fixed.mjs`). NOT applied. The 34 existing tests of `fold-chat-origin.test.mjs` pass against the fixed module (re-pathed copy run).

## What the diff contains
1. **Fix 1 (gate):** `ORIGIN.minAtomsSlot = 2`: a claim with a `fig:` AND a `name:` atom needs 2 non-holon atoms; every other claim still needs 3. (Not A1's unconditional 2.)
2. **Fix 2 (route):** `corroborateAnswer(claim, hits, {…})` + `admitHost` / `NOT_A_WITNESS` (host gate: encyclopedias, wiki mirrors, content farms, Q&A, social; A2's classes, copied so origin.js does not import fold-chat-primary.js). `followClaim` takes `hits` and `answerClaim`; after the footnotes and the already-read pages fail, the answer's atomic claim is asked of the first 8 admissible hits (read concurrently, `readMs` each), the first `supportOf = same` in search order is the origin (path found-in, alongside, read). `originateTurn` takes `hits` and passes `turn.answer.text` as the answer claim for the answer row only.
3. **Fix 6 (locate):** `folded()` skips `/…/` and `[…]` segments that hold IPA characters, and `ⓘ`; the map still indexes the original block text.
4. **Two additions I made AFTER the pre-registered runs, because the runs showed they were needed (post-hoc, labelled as such below):**
   * **2b:** `corroboration()` (the existing already-read-pages route) uses the same host gate. Today it excludes only `wikipedia.org`: a Britannica page the turn happened to read is an origin (3 of 14 corpus claims).
   * **Fix 7:** in `supportOf`, a rung-2 (bound) `same` is accepted only if the page sentence carries every figure the claim states (`figuresCovered`). Reason: rung 2 fills a `time` slot with the YEAR, so "launch on July 16, 1969" and "San Francisco 1945" were accepted for "landed on 20 July 1969" / "founded on 24 October 1945". This is a bug in the shipped module, independent of Fixes 1/2/6 (the real `min3` module has it).
Tests: `c1/origin-fixed.test.mjs`, 27 pass; mutation check `c1/mutate.mjs`: **32/32 mutants killed** (each gate deleted or inverted: slot rule off/always on/figure-only/name-only/threshold 1; IPA skip off/any bracket/glyph kept/slash-only/bracket-only; host gate off/each host class admitted/wikipedia admitted; last-wins instead of first; no read cap; no dedupe; any-verdict-but-different; hit text ignored; snippet trusted; abort ignored; hits ignored/asked before alongside; answerClaim ignored/taken from the sentence/for every row; alongside gate off; fix 7 off).

## Headline numbers

### The five asks (A1's), origins reached; "primary" = host on the per-ask list in the prereg
Source of search hits: A1's recorded in-page search results (`a1/search-fix-sim.json`); Wikipedia passages: A1's live browser run 3 (`a1/browser3-run.json`); pages re-read from Node (cached). Run file: `five-run-pre-2026-10-06T20-51-25.json` (pre-registered arms) and `five-run-post-…` (with 2b + Fix 7: identical result).

| ask | L0 lane today | L1 Fix 1+6 | L2 Fix 2 alone (old gate) | L3 Fix 1+2+6 |
|---|---|---|---|---|
| king of the UK | none | none | **bbc.com (primary)** | **bbc.com (primary)** |
| Eiffel height | none | none | none (idle) | eiffeltowertravel.com (ticket seller, not primary) |
| capital of Australia | none | none | mappr.co (aggregator) | mappr.co (aggregator) |
| spider legs | none | none | worldatlas.com (aggregator; the quoted sentence only implies it: "all eight legs connect to") | same |
| Marie Curie death | none | none | **nobelprize.org (primary)** | **nobelprize.org (primary)** |
| **origins / primary** | **0/5 / 0** | **0/5 / 0** | **4/5 / 2** | **5/5 / 2** |

Host gate on these five (post-hoc `posthoc.json`): without it Britannica is `same` for Australia (twice) and for Marie Curie, where it would come first (the gate moves Curie from britannica.com to nobelprize.org). Fix 6 alone: the two `unlocated` claims (Eiffel lead, Gustave Eiffel lead) become followed trails (`no-reference`, `unsupported`), no origin. Fix 1 alone: 0/5 by itself; it only matters once Fix 2 supplies pages (Eiffel: 3 tourist pages go from `idle` to `same`; `toureiffel.paris` stays `undecidable/figure-binding`).

### A3's 14-claim corpus (atomic claim = `claimLean`, query = the question; scored by A3's independent oracle)
Run: `corpus-run-pre-2026-10-06T20-56-02.json` (pre-registered arms) and `corpus-run-post-2026-10-06T21-02-42.json` (with 2b + Fix 7, a post-hoc re-run on the same cached web).

| arm (n = 14) | origins | reach (expected host AND text says it) | mirror/encyclopedia/farm FALSE ACCEPTS | wrong-page FA (oracle) | origin on a host the oracle does not list |
|---|---|---|---|---|---|
| **today** (original module, first 3 pages read as `alongside`, no host gate) | 8 | 4 | **3** (britannica.com: head of state, capital, Curie) | 0 | 1 |
| R-gate pre-reg (Fix 1+2+6, host gate) | 13 | 5 | **0** | 0 | 8 |
| R-nogate (same, gate off) | 13 | 4 | **3** (the same three Britannica pages) | 0 | 6 |
| R-min3 (Fix 2 only, old idle gate) | 11 | 5 | 0 | 0 | 6 |
| R-rank (R-gate, hits read/kept in kind-rank order: gov/edu/agency first) | 13 | 6 | 0 | 0 | 7 |
| post-hoc: today + host gate in `corroboration()` | 7 | 4 | 0 | 0 | 3 |
| post-hoc R-gate with Fix 7 | 12 | 4 | 0 | 0 | 8 |
| post-hoc R-rank with Fix 7 | 12 | 5 | 0 | 0 | 7 |
| (A3 reference, different instrument) first non-Wikipedia search hit, no verification | n/a | 9 | 2 pages | — | — |

### Decoy battery (`decoys.json`, written before any run): 14 true pages + 56 decoys (wrong filler, other entity, neighbour mention, negation), run through supportOf. FALSE ACCEPTS, exact:
| arm | rung 1 only (no frame) | with the live asker frame (rung 2 on), before Fix 7 | with the frame, after Fix 7 |
|---|---|---|---|
| min3 (the real module) | 0/56; true 11/14 | **1/56** (Apollo "21 July 1969" for "20 July 1969"); true 12/14 | (no Fix 7 in this arm) 1/56 |
| min2-all (A1's copy, unconditional 2) | 0/56; true 13/14 | **1/56** (same one); true 14/14 | 1/56 (no Fix 7 in this arm) |
| minSlot (Fix 1; in the post run the module also has Fix 7) | **0/56**; true 13/14 | **1/56** (same one); true 14/14 | **0/56**; true 14/14 |
Fix 1 itself added no false accept (min2-all and minSlot are indistinguishable from min3 on false accepts; both add exactly Everest and Eiffel as true accepts). The one decoy accepted comes from rung 2, which Fix 1 does not touch.

### Fix 6 (locate)
15 Wikipedia articles (the five asks' passages plus Eiffel, Canberra, Spider, Charles III), 1,255 article sentences checked by `noteMarksFor` before/after: **0 lost, 0 moved**, 0 gained in the article's own text, and 3 extract-form sentences gained (Eiffel lead, Gustave Eiffel lead, Canberra). The Eiffel lead exactly as the chat quotes it: located before = false, after = true. (`fix6-run-pre-….json`.)

## Against the pre-registration (every prediction scored, including the ones that failed)
* **P1 decoys:** min3 0 FA (held on rung 1; **1 with the real frame: not predicted**); trues min3 9-11 (11 held); **min2-all 1-3 FA: refuted (0 on rung 1, 1 with frame, the same decoy as min3)**: unconditional 2 is no less safe than the slot rule on this battery, so the figure+name condition is a precaution I could not show was needed; minSlot 0 FA (held on rung 1; **refuted with the frame until Fix 7**); minSlot trues = min3 + 2 held.
* **P2 five asks:** held in full (L0 0, L1 0, L2 4/2, L3 5/2). Note I made it with A1's report in hand; the numbers are A1's route reproduced from Node.
* **P3 corpus:** origins 9-12 **missed (13)**; reach 5-8 held (5); forbidden 0 held; wrong-page FA 0-1 held on the oracle's count (0) **but see below, 2 hand-judged wrong-sentence accepts before Fix 7**; unlisted >= 3 held (8); R-nogate forbidden >= 2 claims held (3); **R-min3 reach lower than R-gate by 1-2: refuted (equal, 5/5; Fix 1 adds 2 origins, both on non-primary hosts)**; R-rank reach >= R-gate held (6 vs 5), fewer unlisted held (7 vs 8).
* **P4 Fix 6:** held (and 2 more articles' leads).
* **P5 time:** cold-read p50 866 ms; 10 of 126 cold reads (8%) exceeded 6 s (the product's `readMs`; those pages would be cut). The product reads the 8 pages concurrently, so the route's wall time is bounded by `readMs` = 6 s inside the 12 s turn box. Not measured in the real browser (relay chain); A1's in-page sim read 6/8, 8/8, 8/8, 7/7, 6/6 of the same kind of hits.
* **Bar 1 (minSlot false accepts on I1 = 0): not met as first measured** (1, from rung 2, identical in min3); met after post-hoc Fix 7 (0) and on rung 1 alone.
* **Bar 2 (forbidden 0, wrong-page FA <= 1):** met by the oracle's count (0, 0). **Not met in spirit before Fix 7:** reading each accepted sentence by hand, 2 of the 13 pre-registered R-gate origins did not state the claim: nasa.gov (Apollo 11: "launch on July 16, 1969, the landing of the lunar module...", for "landed on 20 July 1969"; the oracle called it `reach` because the page text elsewhere has the date) and cfr.org ("Founding of the United Nations—San Francisco 1945", for "24 October 1945"); both rung 2 (bound). After Fix 7 all 12 origin sentences state the claim (one is a page title, voteatlas "U.S. Senate - 100 Senators, ...").
* **Bar 3 (>= +2 primary-grade origins on the five asks):** met (0 -> 2).
* **Bar 4 (Fix 6 regressions 0):** met.

## The finding that matters
**Fix 2 raises "origins" a lot and "primary" origins much less.** Five asks: 0 -> 5 origins, 0 -> 2 primary. Corpus: 13 origins but only 5 on hosts the oracle calls primary (4 after Fix 7); the other 8 are tourist/trivia/blog/aggregator pages (ottawapress.org, youtooproject.com, magicalnepal.com, voteatlas.com, cfr.org then freiheit.org, grunge.com, ubiehealth.com, eiffeltowertravel.com; for the five asks also mappr.co and worldatlas.com). None of those is a mirror, an encyclopedia or a farm by the declared tables (the gate holds: 0 forbidden), and every one of the sentences does say the claim; but the product wording "verified on <host>" would present them like nobelprize.org. First-in-search-order is the cause: official pages read `undecidable` more often than blogs (elysee.fr `cross-language`/`name`/`different`, senate.gov `figure`, toureiffel.paris `figure`/`figure-binding`, un.org `terms`/`figure`, because `supportOf` is strict on wording). Reading in kind-rank order (R-rank) gained one reach (6 vs 5, 5 vs 4 post-Fix 7) and no safety cost, and the corpus reach is still below the no-verification first-hit baseline (9/14 in A3, which also took 2 Britannica pages). So: the route buys safety (3 Britannica false accepts removed; 3 wrong-sentence accepts of the existing module removed with Fix 7) at the price of reach; it does not buy "primary".

## Suggested product call (mine, not measured)
Ship the route only (a) with the host gate in both routes (2b), (b) with Fix 7, and (c) in kind-rank order; and word a non-primary `same` page as "also stated on <host>", reserving "verified at the source" for the government/education/agency/organisation kinds (A2's `kindOf` already ranks them). Fix 1 is safe on this battery but worth only the short numeric answers (Eiffel, Everest): both landed on non-primary hosts; Fix 6 is safe and cheap.

## Wiring that is NOT in the diff (the boss's, vetoed files)
* `fold-chat.js` `runSlotTurn({ … })` call (about line 2040): add `hits: webResults` (the search results list already in scope, `webResults = w.results`); `fold-chat-answerwire.js` `runSlotTurn` signature and its `originateTurn(turn, { …, hits })` call: pass `hits` through. Nothing else: `originateTurn` already reads `turn.answer.text` as the answer claim.
* The strand lane (`fold-chat-originwire.js` `originatePassages`) has no answer sentence, so it does not use Fix 2 as written; only the slot-turn (answer card) lane does.
* `fold-chat-web.js` dead public proxies (A1's rank 5) not touched.

## What I did NOT do / limits
* Not the real browser: reads here go through Node (and Chromium when blocked), not the page's CORS-proxy ladder; A1 showed the relay reads non-footnote pages as well for these asks, but a datacenter-IP wall (reuters, toureiffel.paris) can only lower reach.
* The five asks use A1's recorded search snapshot and A1's live Wikipedia passages (one run), not a fresh live search or a fresh browser run; the corpus used the live chat search once (cached, one snapshot) with the question as the query.
* The host gate's tables descend from A2's, which descend from A3's forbid list: "0 forbidden" is partly by construction (A3 said the same of A2). The independent evidence is the hand review above (no mirror/encyclopedia/farm among the 13/12 origin hosts; aggregators such as mappr.co and worldatlas.com are NOT in the tables and do pass).
* Fix 7 and 2b were designed after seeing the pre-registered runs; their numbers are on the same data (a re-run, not a fresh test), flagged "post-hoc". Fix 7's guard is conservative: a claim figure written another way (a unit conversion, a spelled-out number) fails the bound rung and falls back to rung 1.
* Decoys are 56 sentences I wrote, one per kind per claim; 0 false accepts on them is not a false-accept rate.
* Not measured: the model path (none is used), run-to-run search drift, non-English asks, `maxAttempts`, memory/latency of 8 concurrent reads in a phone browser, the card wording.

## Files (all new, under eval/ants/)
`C1-PREREG.md`, `C1-RESULTS.md`; `c1/origin-fixes.diff` (the patch), `c1/origin-base.mjs`, `c1/origin-fixed.mjs`, `c1/origin-fixed-slot3.mjs` (generated by the harness: Fix 2 with the old idle gate), `c1/origin-fixed.test.mjs`, `c1/mutate.mjs`, `c1/decoys.json`, `c1/decoy-battery.mjs` + `decoy-battery-{,post-}{rung1,frame}.json`, `c1/route-eval.mjs` + `five-run-{pre,post}-*.json`, `corpus-run-{pre,post}-*.json`, `fix6-run-pre-*.json`, `c1/posthoc.mjs` + `posthoc.json`, `c1/probe-rung2.mjs`, `c1/io.mjs`, `c1/cache.json` (the web snapshot).
Re-run: `node --test eval/ants/c1/origin-fixed.test.mjs`; `node eval/ants/c1/mutate.mjs`; `node eval/ants/c1/decoy-battery.mjs [--frame]`; `node eval/ants/c1/route-eval.mjs five|corpus|fix6` (set `C1_TAG=post`).
