# P2 pre-registration — answerSpan: the smallest span that answers (written 2026-10-07 BEFORE any run of the module or of the baseline)

The complaint (user): the snipped answer is "more info than needed" ("What is the boiling point of ethanol" showed a generic FAQ block, not the one sentence/figure). Frame: pevearVolokhonskyMethod — mechanical answer first, a model only if needed, then a mechanical final pass. This atom is the mechanical first pass and the mechanical final pass. NO MODEL anywhere in the module under test.

## What is built and what is measured
`fold-chat-answerspan.js`: `answerSpan(question, passages, opts)` and `verifyRewrite(rewrite, passage)`. Measured against the CURRENT strand (`fold-chat-strand.js` `snipsOf` on the same passages, default `STRAND` limits).

## Data (real pages only; no page is written by me)
Pool = `eval/snips/data/pages/*.txt` (914 page texts as the strand read them) + Wikipedia plain-text extracts in `eval/snips/cache` (435) + raw HTML of cached pages in `eval/snips/cache/*.body` read by the app's own `regionOfHtml` + `declaredBlocksFromHtml` (FAQPage / HowTo JSON-LD pages, the very case of the complaint). Page text is capped at 24000 chars, as the app caps it.
Each ask = a question, a primary page that does (or deliberately does not) state the answer, and two distractor pages (real, other topics), so every ask is a 3-passage turn.
Gold, written by hand from the page BEFORE any run: `key` = the shortest verbatim string that IS the answer (a figure, name, date …); `min` = the shortest verbatim clause that carries it with the subject it needs. Both must be substrings of the page (checked by code; an ask whose gold is not in the page is rejected, not repaired).
Split: DEV (30 asks, `asks-dev.mjs`) written first and used to build the module. HELD (>= 70 asks incl. >= 15 unanswerable, `asks-held.mjs`) written after the module is built and its tests pass; its sha256 is written to `eval/ants/p2/FREEZE.json` BEFORE the first run on it; it is run ONCE and every number below is reported on HELD (DEV reported separately and labelled in-sample). Held asks use pages and fact types the dev set did not tune on where the pool allows; I have seen some pool pages while authoring (disclosed).

## Metrics (all scored by code)
(a) CONTAINS: the shipped text (default view: first span) contains `key` (case/whitespace/diacritic-insensitive, digit-normalised, after the declared rewrite rules). Strand: any snip text contains `key`.
(b) PRECISION = len(min) / len(shipped text), capped at 1. Reported two ways: over ALL answerable asks (a miss counts 0) — the pre-registered headline — and over contained asks only. Strand shipped text = all snips of all three passages (what the user sees) and, separately, only the primary page's snips (the generous reading).
(c) MINIMALITY, by code: a shipped span is minimal iff no single comma/semicolon/dash/parenthesis-delimited clause can be removed from it while `key` and the subject words of `min` stay. Also len(shipped) <= 2 x len(min).
(d) VERBATIM-VERIFIABLE: every shipped span is a substring of its passage (whitespace-normalised) OR `verifyRewrite` re-derives it from the source bytes by the named rules; target 100%. Plus a hostile check: a figure not in the source, a model-style paraphrase, an unnamed rule, are each rejected by `verifyRewrite`.
(e) TYPED GAP on unanswerable asks: the module returns `gap` and no span.
(f) LANGUAGE: asks in es/fr/ru/de/zh (>= 8 held): contain `key` or return a typed gap; never a confident wrong span.

## Pre-registered thresholds (declared, no measurement behind them — II.11; the giver is me, P2)
T1 containment over answerable HELD asks >= 0.80.
T2 median precision over ALL answerable HELD asks >= 0.30, AND >= 3x the strand's median precision on the same asks.
T3 typed gap on >= 0.70 of unanswerable HELD asks.
T4 confident-wrong rate (a span shipped that lacks `key`, on an answerable ask) <= 0.10 of answerable asks.
T5 verbatim-verifiable = 100% of shipped spans; hostile rewrites rejected 100%.
T6 minimality (clause-removal test) >= 0.70 of contained spans.
T7 non-English asks: contain-or-typed-gap >= 0.75, confident-wrong <= 0.10.
T8 every gate of the module has a test that FAILS when the gate is deleted (mutation check, `eval/ants/p2/mutate.mjs`): 100% of gates killed.

## What would refute me (reported if it happens, never edited after)
Any of T1–T8 missed. Specifically I expect (and will report) failures from: coreference beyond one sentence back, a sentence carrying two quantities of the same unit where the nearer one is not the answer, table text flattened to a line, a participial opener with no subject ("Created by X in 1995"), and answers that live in two sentences.

## Rules I keep
New files only (`fold-chat-answerspan.js`, its test, `eval/ants/p2/*`); no edit to strand/snip/chat/index/presentview/styles/vendor; wiring is an UNAPPLIED diff `eval/ants/p2/wire.diff`; no git add/commit/push; no browser pane; the model appears nowhere (not even as a comparison arm unless stated in RESULTS, and then only as a labelled arm).

---
## Amendment log (appended 2026-10-07 after the HELD run; everything above this line is unchanged from before any run)
1. HELD (89 asks) was frozen by sha before its first run (`eval/ants/p2/FREEZE.json`). Before that run two harness fixes were made and recorded there: HTML passages carry the page `<title>` as their `ref` (as the app labels passages), and a syntax error in my own summary line of `run.mjs` (it stopped the first attempt before any ask ran; no held result was seen).
2. The pre-registered run is `eval/ants/p2/results-held-v1.json` (module sha 4e577265…, snapshot `answerspan-v1-frozen.js`). T1, T4, T6 and the confident-wrong half of T7 were MISSED; T2, T3, T5 and the first half of T7 were met; T8 was evaluated on the final module (63/63).
3. After reading the HELD misses the module was changed twice more (v2, v3) and then v4; a NEW held-out set was written after each set of fixes and before the new module ran on it (H2 `asks-h2.mjs`, 42 asks; H3 `asks-h3.mjs`, 48 asks). Those are post-hoc rounds, not part of the pre-registration; HELD, H2 and H3 are in-sample for every later version. v4's `predWeight` was chosen by an in-sample sweep. See `P2-RESULTS.md` section 2 for what each round changed and measured.
4. I ran three HELD asks (h54, h01, u08) through a smoke test of the wiring before the first full HELD run; no module change followed from it.
