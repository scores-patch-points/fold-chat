# G2 pre-registration (written 2026-10-06 BEFORE any instrument of mine was run)

Atom: THE VOID FOR GENERATED OUTPUT, and every failure path of a `generate` turn.
Files I will create/edit: `fold-chat-genvoid.js` (+ `fold-chat-genvoid.test.mjs`), small additions to `fold-chat-channels.js` (VOID_KINDS/voidLabel/voidText/normVoid/parse) and `fold-chat-gaps.js` (`gapAnswerLine`) with their tests, `eval/ants/g2/*`, `eval/ants/G2-RESULTS.md`, `eval/ants/g2/wire.diff` (UNAPPLIED).

## What I had seen/run before writing this (honest disclosure)
Read (no run): README, fold-chat-channels.js, fold-chat-gaps.js, the generate branches of fold-chat.js (lines ~1860-2300, 2555-2700), fold-chat-discourse.js, fold-chat-kinds.js, planTurn in fold-chat-flow.js, renderGap/renderFacingPage in fold-chat.js.
Run (three throwaway one-liners, results noted): `classifyTurn` on 6 asks ("write me an essay on this" -> generate; "write me a thank you note to my neighbour" -> compose, which SKIPS search); `planTurn("write me an essay on this", prior=[who invented the telephone?])` -> `{mode:"web", kind:"elliptical", search:"write essay invented telephone"}`; with an empty thread the search is the literal ask, "write me an essay on this". I did NOT run the real page, the model, or any detector.
Consequence I predict from reading: the screenshot failure has TWO causes, not one. (a) the SEARCH QUERY carries the output type ("write essay ..."), so the pages that come back are essays-about-writing-essays; (b) when the model call throws, the `catch (modelErr)` in fold-chat.js (~line 2238) falls back to `snipsOf(webPassages)` for ANY kind, including `generate`, and `declinedFallbackNotice` says "Showing what the sources say instead".

## The instruments (nothing here is run until this file is saved)
**I1 reproduction (real page).** `eval/pivot/chat-live.mjs` (`openChat`, `say`) against http://127.0.0.1:8815/ with gemma2:2b: turn 1 "who invented the telephone?", turn 2 "write me an essay on this". For the failing variant, I abort `**/v1/chat/completions` on turn 2 only with Playwright `page.route` (a network error injected at the transport; the page, the search and the sources are real). Also turn 2 on an EMPTY thread. Output: what was searched, pages read, notices, shown text.
**I2 real pages for the meta-detector.** Fetch (curl, scratch dir) >= 10 real pages that are ABOUT an output type: essay tutorials/samples (leverageedu 'Essay on Telephone', a byjus/vedantu-style 'essay on X in 100 words', a writing-centre 'how to write an essay'), cover-letter template pages, poem/haiku how-to pages, report-writing guides, a 'blog post template' page. Controls: >= 30 real topical pages (Wikipedia/Britannica/etc. about the telephone, Bell, climate, ... ) taken from `eval/snips/cache` bodies, plus the WHOLE cache scan (3508 `.body` files) as the false-flag census: every page flagged is listed and I hand-judge up to 40 of them.
**I3 the case table (>= 40 cases, frozen below in the harness `eval/ants/g2/cases.mjs` BEFORE I run `before`/`after`).** Each case = { ask, outputType (G1 shape: {type, topic, constraints, needsSources, voidIfMissing}), webPassages, failure, modelResult, expect }. Categories (>= 3 each): model unreachable/network; timeout/504; rate-limit/429; gate decline (403) ; sealed/de-id wall (422); no model loaded (m.none); model returns empty; model refuses in prose ("I cannot write..."); model returns a stub/teaser ("Certainly, I'd be happy to help you write..."); model asks a question instead ("what topics should I cover?"); model's text is a tutorial/meta ("How to write an essay: step 1"); model output cut at length; no topic ("write me an essay on this", empty thread); topic but zero passages; topic but all passages meta-about-type; topic and mixed (meta + on-topic); unsupported output type; person's own text required but missing ("write a cover letter" w/o details, "translate/rewrite this" w/o text) ; CONTROLS: successful turns (essay, poem, report, letter, haiku, list, summary of sources, with and without sources where needsSources=false). Real model outputs (gemma2:2b, qwen2.5:14b via Ollama) supply the modelResult of >= 8 cases; real fetched pages supply the passages of >= 10 cases; the rest are synthetic where a real one can't be forced (429, 422), and the table says which is which.
**I4 'before'** = a faithful model of what the current code path does per case, `eval/ants/g2/before.mjs`: which branch of fold-chat.js (2193-2250 + 2105-2115 + 2438-2450) fires, what is drawn (strand quoting passages? typed gap? error notice?), whether the output type is named, whether a quoted-source passage is shown as the output. It is cross-checked against I1 on the cases I can run live; any disagreement is reported and the model is corrected before scoring (disclosed).
**I5 'after'** = `genVoid(...)` verdicts.

## Scored properties
For each FAILURE case (everything but controls):
- P-name: the notice and void name the output type (the word 'essay', 'poem', ... appears in `notice.text` and `void.outputType`).
- P-missing: `void.missing` is non-empty and says WHAT (topic / sources about the topic / the model's draft / your text / a supported type).
- P-had: `void.had` lists only material the turn really had (page titles/domains from the input); it never contains a page that `isMetaAboutType` flagged presented as source for the topic - those are listed separately as `setAside`.
- P-unblock: `void.unblock` non-empty and each item is an act the person can take.
- P-nofake: `fallbackAllowed` is never `true`/'strand'; the notice never carries a quoted passage; for a writing-type output, no field of the result is a quoted-source body.
- Before-metric: P-name, P-nofake judged on I4's output.
For each CONTROL case: `void === null`, `notice === null`, i.e. false-void rate.
For `isMetaAboutType`: recall on I2 tutorial pages, false-flag rate on I2 controls and on the census.

## Predictions (numbers)
- P1 (reproduction): on I1 with the model aborted, the real page draws a source strand from pages found by the query `write essay invented telephone` (or similar), and >= 1 of the strand's passages is about essay-WRITING rather than the telephone: reproduced in >= 1 of 3 attempts (search is non-deterministic; leverageedu specifically may not recur). On an empty thread the search is the literal 'write me an essay on this' and returns essay-writing pages: >= 2 of 3 attempts.
- P2 (before): across the failure cases that HAVE passages (~20), >= 70% draw a source strand as the turn's content (the catch-fallback for every generate failure), 0% name the output type as the missing thing, 0 of the unsupported/own-text cases have a typed void naming them. Across ALL failure cases: output type named in <= 25% (only errorNotice-ish texts that happen to quote the model's error).
- P3 (after): 100% of failure cases pass P-name, P-missing, P-unblock, P-nofake; P-had exact. Controls: 0 false voids / >= 12 controls.
- P4 (meta detector): recall >= 9/10 on the real tutorial pages; false flags on the 30 topical controls = 0; census over all cached pages (essay as the type, as the type-agnostic detector would run with outputType 'essay'): flagged <= 1% of 3508, and of the <= 40 flagged I judge by hand >= 80% genuinely about writing/templates (if less, the threshold is wrong).
- P5 (model failure classes): of the real gemma2:2b outputs for generate asks, >= 1 is a stub/teaser or a question-back (the hedge the GENERATE_NUDGE comment says was measured); if the model writes fully every time, the stub gate is untested on real data and I say so.
- P6 (mutation): deleting each gate (no-topic, empty-model, refusal, stub, meta-pages, unsupported-type, own-text, sealed, network, timeout, rate-limit, gate, length, no-model, fallbackAllowed=false) makes >= 1 test fail; 15/15 gates killed.

## What would refute me
- A control (successful generate turn) gets a void -> the gate is unsafe; I fix the gate or report it unfixed.
- A failure case gets `fallbackAllowed` other than false/'offer' or a notice that does not name the type.
- The detector flags >= 1 of the 30 topical controls, or misses >= 2 of 10 tutorials.
- 'Before' already names the output type in > 50% of failure cases (then the problem is narrower than the user said).
- I cannot reproduce the screenshot failure at all (reported as such; the table is then labelled trace-derived, not observed).

## Declared vocabulary (II.11: declared, not measured)
The meta-page cue lists (tutorial/template/sample/prompt/words-count/class-level cues) and per-type nouns are hand-written declared vocabulary; thresholds are declared defaults, tuned ONLY on the dev half of I2 (pages fetched first, listed in the harness) and reported on the held-out half and on the census. English only; a non-English ask/page is out of scope and the module returns 'unknown language: not judged' (never a void on language alone).
