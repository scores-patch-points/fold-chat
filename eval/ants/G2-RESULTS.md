# G2 results — the void for generated output, and the failure paths of a generate turn (2026-10-07)

Atom: when a generate turn ("write me an essay on this") fails or is tripped, draw a typed void that NAMES the output and what is missing, and never a quote of the pages standing in for the piece.
Built: `fold-chat-genvoid.js` (pure; 51 tests in `fold-chat-genvoid.test.mjs`), additive edits to `fold-chat-channels.js` and `fold-chat-gaps.js` (+ their tests), `eval/ants/g2/*`, and two UNAPPLIED diffs for `fold-chat.js`.
Pre-registration: `eval/ants/G2-PREREG.md` (written before any instrument ran; cases frozen, sha256 `0811ab2d…`). The files `fold-chat.js`, `index.html`, `fold-chat-presentview.js`, `fold-chat-discourse.js` were not touched.

## 1. What the failure was (reproduced on the real page, not inferred)
Real page (:8815), real gemma2:2b, real search, the model transport aborted on turn 2 only (Playwright `page.route`), after "who invented the telephone?":
- **The query is the instruction.** `planTurn` searched `write essay invented telephone` (or `Alexander Graham Bell Elisha Gray write me an essay on this`, `write essay …` varies with the referent store). What came back: bartleby, gradesfixer, quora, cram, leverageedu, essays.io, papersowl, ivypanda. Not one is about the telephone as a topic; they are about writing about it.
- **The strand fallback fires for ANY kind.** `catch (modelErr)` (fold-chat.js ~2243) calls `snipsOf(webPassages)` and draws "model declined · The model could not answer (network error). Showing what the sources say instead. FROM THE SOURCES, UNCHANGED · NO MODEL WROTE THIS". Observed content of that strand: a Bartleby student essay, a gradesfixer sample, **a bot-check page** ("This website uses a security service to protect against malicious bots"), and — once the relay's recorded results were used — the leverageedu tutorial sentence "To write an essay on telephone in simple words, first start with an introduction…" — the user's screenshot, reproduced.
- **Empty thread** (`write me an essay on this`, nothing earlier): `planTurn` says `mode:"web", reason:"points-back-but-nothing-to-carry"` and searches the literal ask; it read papersowl, essaypro, wrizzle and quoted "4 Tips to get the best essay from AI essay writer" and "Choose from our team of human writers…" — essay-mill advertising as "the sources, unchanged".
- **Three other routes into the same strand**, found by running them: (a) the Pivot gap ("None of the model's sentences could be traced to what was read") also falls back to `snipsOf` — a 13-word teaser reply produced a strand quoting "Custom essay delivered in as few as 3 hours"; (b) a tutorial-shaped model reply ("How to Write an Essay… Step 1") is shown AS the essay; (c) an empty model reply with a carried referent draws **nothing**: `emptyNotice` is guarded by `!notices.length` and the "read as…" carry notice is a notice, so the turn is a blank bubble with "the model wrote no answer text".
- With no source at all the old path draws the typed `unreached` gap — "No answer was written: no source could be read to write one from." — which never says an essay was asked for.

## 2. The module
`genVoid({ outputType, webPassages, failure, modelResult, question, hasMaterial, barred })` -> `{ ok, reason, void, notice, fallbackAllowed, passages, setAside, offer }`.
- `void` = `{ kind:"generate", reason, outputType, topic, missing[], had[], setAside[], unblock[], note, said?, offer?, retry, read, closeBy, counts }` (`read`/`closeBy` are the names the existing gap block reads). `notice.text` is the app's sentence "I can't write the essay: …"; the model's own words ride only as `void.said` data.
- `fallbackAllowed` is `false`, or `"offer"` when on-topic pages exist: the person may CHOOSE "show what the sources say about X (their own words, not an essay)" — a labelled button, never the passages drawn as the piece. It is never `true` (mutation-tested).
- Gates, in order (what the person can fix first): unsupported type -> unknown type -> no topic -> own text missing -> lane barred and nothing to write from -> sources (none / all about writing / all walls / all off-topic) -> model failure (network, timeout, rate-limit, gate, sealed, no-model, withheld by the Pivot; Stop is not a void) -> the draft judged as the thing (empty, refused, stub/teaser, a question back, wrote a how-to-write guide, never mentions the topic).
- `isMetaAboutType(passage, outputType)` -> tutorial | sample | template | service | genre (scored cues: title names the output + a how-to/example cue, address, how-to phrases, the output's name per 1000 words, writing-service wording; a topical title subtracts; threshold 4). `unusablePassage` adds wall (bot check) and off-topic. `topicQuery`, `outputTypeFromAsk` (fallback), `failureKind`, `judgeDraft`, `strandFallbackAllowed`, `KNOWN_FORMS`.
- Accepts G1's `describeOutput` shape through `genVoidShape(desc, KNOWN_FORMS)` (G1's own wire already calls `aloneTurn(kind, { outputType, hasMaterial, question })` — I implemented that signature). Handles G1's family `other` + `form`, `{n, unit:"words"}` lengths, gap names.
- Additive edits: `VOID_KINDS` +generate, `voidLabel`/`voidText`, `migrateMessage` keeps a creative record's generate void, `gapAnswerLine` ("No essay was written."), `aloneTurn(kind, { outputType, … })` returns the typed void for a barred writing kind.

## 3. Numbers
### 3.1 The failure table (53 failure cases) and controls (19) — `eval/ants/g2/cases.mjs`, sha256 0811ab2d79926a6d9e26d583873fb18540a65d33ff24044a0becf4085a38d934
18 failure cases use real fetched pages and/or real gemma2:2b replies; 14 contain synthetic parts (a canned reply, a 429/422 status, an unsupported type). The table says which. 13 of 19 controls carry a real gemma2:2b reply.

| measure | BEFORE (current path, modelled with the page's own pure functions) | AFTER (genVoid) |
|---|---|---|
| failure cases whose drawn gap/notice names the output asked for | **0 / 53** | **53 / 53** |
| failure cases drawn as a quote of the pages | **9 / 53** (all 9 = a model call that failed while pages were read) | **0 / 53** (`fallbackAllowed` never true; 18 offer a choice) |
| failure cases drawing a typed gap that does not name the output | 17 / 53 (`unreached`) | — |
| failure cases drawing no gap, no note (the draft, the stub or a tutorial shown as the piece, or the model called on unusable pages) | 27 / 53 | 0 / 53 |
| verdict is the labelled reason | — | 53 / 53 |
| names `missing`, `unblock` (each an act), `had` exact (only pages I judged on-topic), `setAside` exact | — | 53 / 53 each |
| successful turns drawn as a void (false voids) | — | **0 / 19** (first run: **1 / 19**, see 4) |

### 3.2 Per class (cases, before -> after)
network 4, timeout 2, rate-limit 2, gate 2, sealed 2, no-model 2, empty 2, refused 3, stub 3, asked-instead 2, wrote-tutorial 3, off-topic-draft 1, no-topic 5, no-sources 3, meta-only 6, wall-only 1, off-topic-only 1, unsupported-type 3, own-text-missing 3, alone-barred 1, type-unknown 2. Row by row:

| # | case | failure class | BEFORE: what the current path draws (modelled) | AFTER: genVoid |
|---|---|---|---|---|
| 1 | net-screenshot | network | source strand drawn as the turn (3 snip(s)) **[quotes pages as the piece]** | network |
| 2 | net-good | network | source strand drawn as the turn (6 snip(s)) **[quotes pages as the piece]** | network + offer |
| 3 | net-poem-nosrc | network | typed gap: unreached | network |
| 4 | net-emptythread-service | no-topic | source strand drawn as the turn (4 snip(s)) **[quotes pages as the piece]** | no-topic |
| 5 | timeout-good | timeout | source strand drawn as the turn (1 snip(s)) **[quotes pages as the piece]** | timeout + offer |
| 6 | timeout-report-nopages | timeout | typed gap: unreached | timeout |
| 7 | ratelimit-good | rate-limit | source strand drawn as the turn (2 snip(s)) **[quotes pages as the piece]** | rate-limit + offer |
| 8 | ratelimit-story | rate-limit | typed gap: unreached | rate-limit |
| 9 | gate-good | gate | source strand drawn as the turn (1 snip(s)) **[quotes pages as the piece]** | gate + offer |
| 10 | gate-story | gate | typed gap: unreached | gate |
| 11 | sealed-letter | sealed | note: no sources for this kind | sealed |
| 12 | sealed-essay | sealed | source strand drawn as the turn (1 snip(s)) **[quotes pages as the piece]** | sealed + offer |
| 13 | nomodel-good | no-model | source strand drawn as the turn (6 snip(s)) **[quotes pages as the piece]** | no-model + offer |
| 14 | nomodel-nopages | no-model | typed gap: unreached | no-model |
| 15 | empty-good | empty | empty note | empty + offer |
| 16 | empty-poem | empty | typed gap: unreached | empty |
| 17 | refusal-sorry | refused | refusal note | refused + offer |
| 18 | refusal-asai | refused | refusal note | refused + offer |
| 19 | refusal-cannot | refused | typed gap: unreached | refused |
| 20 | stub-teaser | stub | model text shown as the answer | stub + offer |
| 21 | stub-oneliner | stub | model text shown as the answer | stub + offer |
| 22 | stub-colon | stub | model text shown as the answer | stub + offer |
| 23 | asked-real-coverletter | asked-instead | note: no sources for this kind | asked-instead |
| 24 | asked-topics | asked-instead | model text shown as the answer | asked-instead + offer |
| 25 | tutorial-real-service-1 | wrote-tutorial|off-topic-draft | model text shown as the answer | wrote-tutorial + offer |
| 26 | tutorial-real-service-2 | wrote-tutorial|off-topic-draft | model text shown as the answer | wrote-tutorial + offer |
| 27 | tutorial-synth | wrote-tutorial | model text shown as the answer | wrote-tutorial + offer |
| 28 | offtopic-synth | off-topic-draft | model text shown as the answer | off-topic-draft + offer |
| 29 | notopic-emptythread | no-topic | typed gap: unreached | no-topic |
| 30 | notopic-it | no-topic | typed gap: unreached | no-topic |
| 31 | notopic-pages-cannot-rescue | no-topic | model called; unknown | no-topic |
| 32 | notopic-bare | no-topic | typed gap: unreached | no-topic |
| 33 | nopages-essay | no-sources | typed gap: unreached | no-sources |
| 34 | nopages-report | no-sources | typed gap: unreached | no-sources |
| 35 | nopages-story-sourced | no-sources | typed gap: unreached | no-sources |
| 36 | meta-leverage-gradesfixer | meta-only | model text shown as the answer | meta-only |
| 37 | meta-service | meta-only | model text shown as the answer | meta-only |
| 38 | meta-tutorials-climate | meta-only | model text shown as the answer | meta-only |
| 39 | meta-report-guide | meta-only | model called; unknown | meta-only |
| 40 | meta-speech | meta-only | not a generate turn: compose | meta-only |
| 41 | wall-only | wall-only | model called; unknown | wall-only |
| 42 | wall-and-meta | meta-only|wall-only | model called; unknown | meta-only |
| 43 | offtopic-only | off-topic-only | model called; unknown | off-topic-only |
| 44 | mixed-network | network | source strand drawn as the turn (11 snip(s)) **[quotes pages as the piece]** | network + offer |
| 45 | unsupported-image | unsupported-type | typed gap: unreached | unsupported-type |
| 46 | unsupported-video | unsupported-type | typed gap: unreached | unsupported-type |
| 47 | unsupported-slides | unsupported-type | not a generate turn: chat | unsupported-type |
| 48 | owntext-coverletter | own-text-missing | note: no sources for this kind | own-text-missing |
| 49 | owntext-summary | own-text-missing | note: no sources for this kind | own-text-missing |
| 50 | owntext-reply | own-text-missing | not a generate turn: chat | own-text-missing |
| 51 | alone-poem | alone-barred | typed gap: unreached | alone-barred |
| 52 | type-unknown-widget | type-unknown | not a generate turn: chat | type-unknown |
| 53 | type-none | type-unknown | typed gap: unreached | type-unknown |


Nine of those rows say "model called; unknown" or "not a generate turn": the case is a generate turn with no captured reply (the page would call the model on writing-guide pages) or `classifyTurn` does not call the ask generate at all (a slide deck, a widget, "reply to that email"); I do not claim what the page then draws.

### 3.3 The meta-page detector (real pages)
| set | tutorials / samples / services flagged | topical pages falsely flagged |
|---|---|---|
| dev (11 pages, the only ones the cues were tuned on) | 7 / 7 | 0 / 3 (+2/2 genre cases right) |
| held-out (20 pages fetched before tuning) | 7 / 7 | 0 / 11 (+4/4 genre) |
| fresh (15 pages fetched AFTER the last threshold change; wikiHow, reedsy, Cornell, Wikipedia…) | 6 / 7 first run, 7 / 7 after one added rule (see 4) | 0 / 10 |
| census: every cached real HTML page (772) x {essay, report, poem, cover letter} with the page's own title as its topic | — | 1 / 3088 flagged (0.03%): a "What is a Haiku — Definition, Examples" page, a true positive |
| adversarial controls I wrote before running them (10: how-to-write topics, Montaigne, "annual reports", a guide to solar power, an op-ed named "Essay") | — | 9 / 9 not flagged, the op-ed predicted flagged and was |
The real failure pages: leverageedu 'Essay on Telephone' -> sample (score 9), gradesfixer -> sample, essays.io -> sample, papersowl -> service, ivypanda tool -> service, Purdue OWL -> tutorial.

### 3.4 Real model replies (gemma2:2b, 20 replies, GENERATE_NUDGE + the real source block)
Essay on the telephone with on-topic pages: 2/2 fine (438, 468 words). With only essay-sample pages: 2/2 fine essays (the model ignores the samples). With only essay-service pages (papersowl, ivypanda): **2/2 wrote an essay about AI essay generators** (wrong topic, judged `wrote-tutorial`). A cover letter with no details: **2/2 asked for them instead** (judged `asked-instead`). Poems, haiku, reports, wedding speeches: 10/10 real attempts (the speeches carry `[Sister's name]` placeholders and are not voided). A stub/teaser: **0/20** — gemma2:2b never produced one; that gate is tested on a canned reply and live through the canned transport.

### 3.5 The real page, before and after (paired runs, `paired-batch.log`, `g1-batch.log`)
The open-web search relay answered 502/408/429 for hours (DuckDuckGo 408, Brave 429), so for the paired runs ONLY that one endpoint was answered with recorded real results (the urls the real engine returned earlier); pages are fetched live, the model is real or a canned transport reply.
| scenario | before (current page) | after (wire.diff applied in a scratch tree) |
|---|---|---|
| network error, pages found | strand of Bell biography / essay samples as "FROM THE SOURCES" | "No essay was written. I can't write the essay: the model could not be reached (a network error)." what the turn had (3 pages), the offer, try again |
| the 13-word teaser reply | strand incl. an essay-mill ad (earlier run) | "the model returned only 13 words, too short to be an essay" |
| refusal | "model declined … try again or rephrase" (no essay named) + stray "creative — no claims checked" | "the model refused to write it" |
| empty reply (carry notice present) | **blank bubble**, no note | "the model returned no text" |
| model asks a question | strand of essay samples (Pivot gap) | "the model asked a question instead of writing it" |
| tutorial-shaped reply | **shown as the essay** ("How to Write an Essay…") | "the model wrote a guide to writing it instead of the piece itself" |
| HTTP 429 / 403 | strand of essay samples | "rate-limited" / "declined the request" |
| search returns only essay samples, network error | strand quoting leverageedu | "every page found was about writing an essay, not about …" 3 set aside (sample), listed with why |
| empty thread | searched the literal ask, quoted essay-mill ads | no search; "the request names no topic" + two ways to close it |
| control: real model, on-topic pages | essay shown | essay shown, no void (patched control 1/1 after the harness proxy timeout was raised; see 4) |
Combined with G1 (`g1/wire.diff` then `wire-on-g1.diff`): the topic is read as "the telephone" (clean, vs "Says Alexander Graham Bell and March" from the referent store), the empty thread is not searched, and the same five failures draw typed voids; the control writes an essay (1/1).

### 3.6 Mutation (each gate deleted or inverted in a copy; the tests must fail)
51 gates of `fold-chat-genvoid.js` + 7 of `fold-chat-channels.js`/`fold-chat-gaps.js` (scratch tree): **58 / 58 killed**. The first pass killed 35/45: ten survived (sealed and 403 by status alone, the teaser-with-colon rule, the topical-title penalty, the body-cue guard, the address cue, the service-cue guard, the threshold, the unknown-type guard, the deictic list). I wrote a test for each (the tests were weak, the gates were not dead) and re-ran. The frozen-case harness independently noticed 23 of the 51 module mutants (the rest change only behaviour the table does not exercise).

## 4. What falsified me, and what I changed because of it
1. **A false void (control 1/19).** A 31-word summary was voided as a stub (floor 40). I lowered all length floors to "less than a real attempt" (summary 12, email 12, essay 120, …); the real stubs are 10-20 words. 0/19 afterwards. (The floors are declared defaults, not measured.)
2. **The detector's first census run flagged a Redfin "When Was My House Built? How to Find Out" page as a writing service** (generic how-to phrases + the word "buy"). I removed bare "buy", required the output's name 3x for any body cue and for the service cue. Census 3 flags -> 1 (a true one). The fresh set was fetched after that fix; one tutorial was missed (a eulogy page for a "speech" request: a sub-type my table does not know), so I added "any 'how to write …' title is meta unless the topic is in the title" and the fresh set went 6/7 -> 7/7 — **that last number is not independent**.
3. **Prediction P2 was wrong as stated.** I predicted >= 70% of failure cases that had passages would draw the strand; it is 9/29 = 31%. The nine are exactly the cases where a model call failed while pages were read (9/9). The other 20 are cases where the old path shows the model's bad draft as the piece or draws no gap at all.
4. **The 'before' model disagrees with the live page in two places and I did not correct it** (cases were frozen): a stub reply is not "shown as the answer" but falls to the strand through the Pivot gap, and an empty reply draws nothing, not `emptyNotice`. Both make the real 'before' worse than the modelled one.
5. **My patched-page control first failed live** ("the model could not be reached (a network error)", twice). Cause: my Playwright proxy to the real server used `route.fetch`'s 30 s default; the 450-word essay took longer. Raising the timeout to 280 s fixed it (control void: null). The void was correctly drawn for a real transport failure — and it would have been a false void only because the harness broke the transport.
6. P5 (a real stub/teaser) not observed (0/20). P1 for the empty thread was a single real run, not three.

## 5. What I did NOT do / could not do
- Did not edit `fold-chat.js`, `index.html`, `fold-chat-presentview.js`, `fold-chat-discourse.js` or any G1 file; no git add/commit/push; no browser-pane tools (headless Playwright against :8815 and scratch servers on :8841/:8842, now stopped; scratch trees deleted).
- Did not measure on qwen2.5:14b (not installed; only gemma2:2b and a coder model are). English only: a non-English ask or page is never judged meta and never voided on language alone.
- Could not use the real search relay (rate-limited upstream): paired live runs use recorded real results for that one endpoint. The reproduction of the user's exact screenshot sentence needed that stub; the same failure shape (strand of essay samples + a bot-check page) was seen once with the real search.
- Policy decisions I made visible rather than silently: (a) essay-SAMPLE pages (essays.io, gradesfixer) are set aside as material, so a turn whose only pages are samples is a void where the old path let the model write from them (the 2b model wrote a fine essay from them, 2/2); (b) `compose`/`generate` with nothing to write from is the `alone-barred` void (ALONE_KINDS is still `[]`; G1's `mayWriteAlone` decides whether a poem may be written alone and is read first); (c) the offer button sets the answer mode to Sources only, as the existing "unsupported" button does.
- Did not fix: the carried-referent topic quality in the standalone wire (G1's describeOutput topic is the cleaner source: use `wire-on-g1.diff`); the `!notices.length` guard on `emptyNotice` for other kinds (a blank bubble still happens for a research turn with a carry notice); the stray "creative — no claims checked" process line on a void turn; `looksBlocked` in the strand did not catch the Bartleby bot-check page (my `wall` set-aside does, for generate turns only).

## 6. Wiring (the boss's job; both diffs verified)
- `eval/ants/g2/wire-on-g1.diff` — apply AFTER `eval/ants/g1/wire.diff` (recommended). `git apply --check` on the current `fold-chat.js` for the pair is clean (applied in sequence in a scratch copy; the result passes `node --check` and was served and run on the real page: 5 scenarios + control).
- `eval/ants/g2/wire.diff` — standalone, against the current `fold-chat.js`, `git apply --check` clean; uses `outputTypeFromAsk` instead of G1.
- Both do the same four things: (1) the generate/compose turn gets `genOt`; pages about writing it are set aside after the search; (2) a failed/blank/stub/refused/tutorial/off-topic draft, a Pivot gap, no model, a model error all set `genGate` instead of falling to `snipsOf`; (3) `genGate.void` becomes `record.void` (the gap IS the turn; `creative`/`noClaims` deleted); (4) `renderGap` draws what is missing, what the turn had, what was set aside, the offer, and a Try again for kind `generate`. `refresh-wire.sh` rebuilds and re-verifies both.
