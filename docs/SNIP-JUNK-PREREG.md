# Snip junk, walls and stitched snips: pre-registration

Frozen 2026-10-06 (UTC) BEFORE any change to `fold-chat-impression.js`, `fold-chat-strand.js`, `fold-chat-snip.js`, `fold-chat-web.js` or any new gate code. If a bar is not met the number is reported; the bar is not moved.

Source of the problem: `docs/SNIP-SWARM-REPORT.md` (96 sites, 23 types, no-model ladder rungs a/b/c/d). Data: `eval/swarm/results/*.json` (per-site records), `eval/swarm/cache/` (cached pages; **no live fetching in this work**). The harness `eval/swarm/lib.mjs` is the baseline ladder, unchanged.

## 1. The bars (given by the user, frozen as written)

Measured on the swarm cache, over the same 96 sites. Reachable = fetchOk and not blocked in the result record (82 sites).

| # | Bar | Baseline (swarm report) |
|---|---|---|
| B1 | **Junk shown <= 5% of reachable sites** (a site is junk-shown if ANY snip shown for it is junk) | 82% (88% of reachable) |
| B2 | **Verbatim 100%** of shown snips (the harness `isVerbatim`: every piece, split on newline and ellipsis, is on the page) | 97% of sites (3 stitched failures) |
| B3 | **Relevance >= 1 on reachable sites not lower than 95%** | 95% (78/82) |
| B4 | **Answers (relevance 2) not lower than 48%** | 48% (39/82) |
| B5 | **Every blocked/wall page yields NO snip**: a typed gap `blocked` with the reason. **Recall of wall detection >= 0.9 on the 12 known walls** | wall text was shown as snips |
| B6 | **False walls <= 2% of reachable pages** (<= 1 of 82) | n/a |
| B7 | **Non-English pages not worse** (nonenglish type: junk-shown, relevance >= 1, answers each no worse than baseline) | baseline per section 4 |

Falsifier tests (unit tests in `fold-chat-junk.test.mjs`) must exist for each of B1, B2, B5, B6 and for the sentence-splitter and region fixes; each is a case where the new code would FAIL if the fix were removed.

## 2. Definitions

**Junk (deterministic).** `eval/swarm/junk-judge.mjs`. A snip is junk when it is dominated by chrome (chrome units hold >= 0.5 of its word tokens) or leads with chrome (one of its first 2 units of >= 3 tokens is chrome). A unit is chrome when declared chrome phrases (the multilingual constant `CHROME` in `fold-chat-junk-lexicon.js`) cover >= 0.4 of its letters, or it is a stopless run (>= 12 tokens, function-word share < 0.10, no internal sentence stop, not code-like), or a title-case run (>= 12 tokens, >= 0.6 capitalised in a script where case marks names, no stop); the last two are computed over the tokens the lexicon did not already explain and skip `key: value` data. Unspaced scripts get the lexicon rule only. No capital-letter logic outside the Latin/Cyrillic/Greek-scoped title-case rule. Thresholds are in `DEF` in the judge file.

**Junk (hand).** `eval/swarm/junk-labels.json`: 78 baseline snips from reachable sites (the old ladder's rungs a-d), hand-labelled junk/clean by the same two questions (dominated by chrome? opens with a chrome run?) before the new code existed. 36 junk, 42 clean. Split by sha1 of site|rung into **dev 29 / test 20 / held 29**. The judge's lexicon and rules were tuned on **dev only**. **held was not used to choose a lexicon entry, a rule or a threshold, and is not evaluated until the end.**

**Judge vs hand labels at freeze:** dev+test: tp 16, fp 0, fn 4, tn 29, accuracy 0.918 (the 4 misses: a documentation baseline badge, an arXiv footer, a forum header whose title unit hides the nav, a form-terms line). The held-out agreement is reported at the end, unmoved.

**Circularity, stated.** The judge shares its phrase lexicon with the gate, so a gate that removes lexicon-detectable chrome will score well on the judge by construction. Therefore B1 is decided by **two** measures and the worse is the verdict: (i) the judge on every shown snip, (ii) a **hand audit of every shown snip on every reachable site** after the run (the heads of each snip read and labelled junk/clean by the two hand questions; written to `eval/swarm/junk-audit.json`). The held-out third checks the judge itself against hand labels.

**Relevance.** The recorded values in the result files (single-rater) are the baseline. The new ladder is re-rated by hand on all 82 reachable sites from the shown snips and the ask: 2 = a shown snip states the fact asked; 1 = shown text is about the asked topic or is a page gist; 0 = nothing shown, only chrome, or unrelated. A reachable page that gets a typed gap counts 0. B3/B4 compare the hand rating of the new output with the recorded baseline (95% / 48%). A deterministic proxy (share of the ask's content words found in the shown text) is reported for old and new beside it, so the comparison does not rest on the rater alone. The rater is the same agent that wrote the code; the proxy and the published rating rules are the guard.

**Walls.** `blocked = true` in the result records: 12 sites (government#2, health#2, jobs#3, jobs#4, localbiz#3, product#3, product#4, product#6, realestate#1, realestate#3, travel#4, blog#3). Of these 10 are HTTP errors with a body (403, 404, 410, 429); 2 are HTTP 200 (blog#3 a member-only story, product#3 a waiting room); product#6 failed at the protocol layer and has no page at all, so no detector reading page text or status can type it `blocked`: it counts as a MISS for recall (best possible recall is 11/12 = 0.917) while still yielding no snip. Detection input is `{status, title, visible text}`. These 12 are the pages the detector is designed against, so recall on them is **in-sample**; there are no other known walls. Specificity (B6) is out-of-sample: every reachable page is checked and each page flagged is read by hand and labelled true wall or false wall. The unit tests add synthetic walls in other languages and kinds that are not in the cache.

**Stitched snips.** A snip assembled from non-contiguous pieces must be re-verified after joining; pieces are shown separated by an ellipsis; a piece that is not on the page is dropped; if none survive the snip is dropped.

**Non-English.** `nonenglish` type, 5 sites (4 reachable).

## 3. What is held constant

- The cached pages and asks; the harness's rungs for the OLD output (`lib.mjs snip`, unchanged).
- The lexicon file `fold-chat-junk-lexicon.js` sha256 `64d76f73...9f185`, the judge `junk-judge.mjs` sha256 `d4716db6...5aa9`, the labels `junk-labels.json` sha256 `36ca34ab...47a0`, sample `junk-sample.mjs` sha256 `cbcc1b51...f88b`. (If the lexicon needs a new entry after the freeze it is listed in the results as a change, with the dev-only justification, and the judge is re-hashed there; the junk bar is then decided by the hand audit alone.)
- Baseline by the judge at freeze: junk-shown on 58 of 82 reachable sites (70.7%); per rung, snips judged junk: a 0/40, b 1/48, c 55/81, d 29/76 (distinct snips). The swarm report's 82% (88% of reachable) was a single-rater judgment from run notes; the judge number is the like-for-like baseline for the rescore.

## 4. Plan (what changes)

1. `fold-chat-junk.js` (new, pure): the junk gate on every snip before display, with a typed gap `{kind:"gap", gap:"junk"|"blocked", reason}` when everything is junk; `wallOf` (status, title, text); join re-verification (`verifyJoined`); a decimal- and abbreviation-safe sentence splitter helper where needed.
2. `fold-chat-region.js` (new, pure): content-region blocks from HTML (landmarks, longest text block, boilerplate and link density) so sentence scoring starts after the nav/header region.
3. `fold-chat-impression.js`: fix `sentencesWithOffsets` for decimals and abbreviations (the defect: a decimal such as 4.97 loses the words before it).
4. `fold-chat-strand.js`: gate before display; wall detection feeds the typed gap; joined passages re-verified; chrome blocks masked (offsets preserved) before impression scoring.
5. Tables/code/widgets: report what a no-model snip honestly can do; implement only the small safe case (quote a verbatim table row or code block when the page declares it and it passes the gate).
6. `eval/swarm/rescore-junk.mjs`: old vs new ladder over the cache, writes `eval/swarm/rescore-junk.json`.
7. Never a model fallback; never an API key; no live fetching.

## 5. Order of work and what is disclosed

Labels, lexicon, judge and this document were written before any gate code. The lexicon was edited twice after first drafting: entries observed only in test/held snips were removed, then dev-derived entries were added and generic single words removed. No `held` row informed any entry.

## 6. Results (written after the runs; the bars in section 1 are unmoved)

Run: `node eval/swarm/rescore-junk.mjs` over the cache (no live fetching), output in `eval/swarm/rescore-junk.json`; hand material in `eval/swarm/junk-labels.json`, `eval/swarm/junk-audit.json`, `eval/swarm/relevance-hand.json`; a six-page out-of-sample check in `eval/swarm/fresh-check.json` (6 fresh public page loads, 1.3 s apart, after the gate was in place). Numbers are over the 82 reachable sites unless stated.

### 6.1 Before / after

| Measure | Bar | Before | After | Verdict |
|---|---|---|---|---|
| B1 junk shown, by the frozen judge | <= 5% | 59/82 = 72.0% (the swarm report's single-rater figure was 88%) | 0/82 = 0.0% | PASS, but circular: the gate contains the judge's rules (see 6.2) |
| B1 junk shown, by hand audit of every shown snip | <= 5% | n/a (hand-labelled baseline sample: 36 of 78 snips junk) | audit 1 (first complete gate): **8/82 = 9.8% FAIL**; final audit (after the changes it prompted): 0/82 = 0.0%, 3/82 = 3.7% if three mixed snips are counted | **FAIL on the first audit; PASS only in-sample after fixes made from reading it. Not shown out-of-sample** |
| B1 fresh sites (out-of-sample) | n/a | n/a | 1 of 4 reachable sites showed a snip that opens with the site's own blurb (by hand); the judge also called one clean Wikipedia snip junk (citation markers) | n=4: no rate can be carried by it |
| B2 verbatim, harness `isVerbatim` | 100% | 79/82 sites (96%) | 81/82 sites (98.8%); 188/190 snips | **FAIL by one site** (see 6.3: a defect in the check) |
| B2 verbatim, strict check (no second tag-strip of decoded text) | 100% | 82/82 | 82/82; 190/190 snips | PASS |
| B3 relevance >= 1 | >= 95% | 78/82 = 95.1% (recorded) | 78/82 = 95.1% (hand) | PASS (equal) |
| B4 answers (relevance 2) | >= 48% (39/82 = 47.6%) | 39/82 = 47.6% (recorded) | 38/82 = 46.3% (hand) | **FAIL by one site** (paired: 10 sites 2 -> 1, 9 sites 1 -> 2; see 6.4) |
| B5 wall recall, 12 known walls | >= 0.9 | wall text shown as snips | 11/12 = 0.917, and 12/12 yield no snip | PASS, in-sample; the one miss (product#6) has no page at all (protocol error) so nothing can type it `blocked` |
| B5 every wall yields no snip and a typed `blocked` gap | all | no | yes (strand `gaps[]`, harness `gap`); the Sources-only turn then draws the existing typed gap with the reasons in its note | PASS |
| B6 false walls on reachable pages | <= 2% (<= 1) | n/a | 0/82 | PASS |
| B7 nonenglish (4 reachable): junk / relevance >= 1 / answers | not worse | judge junk 3/4; 4/4; 2/4 recorded | judge junk 0/4; 4/4; 3/4 | PASS |
| Fresh walls (out-of-sample) | n/a | n/a | 2/2 detected (a 403 and an HTTP 202 challenge page) | n=2 |

Judge versus hand labels (the judge's own accuracy): dev tp 11 fp 0 fn 0 tn 18 (1.000); test tp 6 fp 0 fn 3 tn 11 (0.850, junk recall 0.667); **held tp 13 fp 1 fn 3 tn 12 (0.862, junk recall 0.813)**. The judge misses about one junk snip in five that a person calls junk, so its 0% is an underestimate; the hand audit is the real measure.

### 6.2 What the judge number does and does not mean

The gate removes everything the judge would call junk by construction. The 0.0% by the judge says the gate and judge agree, not that the pages are clean. The hand audit found 8 junk sites in the first complete gate's output (a documentation badge, an affiliate disclosure, a newsletter promo, an endorsement disclaimer, an image disclaimer, a widget footnote, a calendar help line, a site-search label). I then added: a prose-run rule in the content region (an isolated short line is not scored), a STRONG phrase list (one hit makes a short unit chrome), a fragment rule (a label or date line is not a passage) and a link-sentence rule (a sentence that carries links is not a menu). All four were chosen after reading audit 1, so the final 0/82 is in-sample for them. The fresh check is the only out-of-sample part and it is tiny.

### 6.3 Stitched snips and the harness check

The three "stitched, not verbatim" sites in the swarm report (academic, apidocs, news) are real in one respect and an instrument defect in another. Every snip the OLD ladder showed is verbatim under a strict comparison (82/82 sites). The harness `isVerbatim` runs `norm`, which decodes entities and then strips `<...>` from the DECODED text, so one stray `<` in the page (for example `P < 0.05`) followed far later by a `>` erases the page text between them and every piece after it "fails". That is what failed academic and apidocs (`<?php`); news showed escaped player markup as text, which is leaked markup. The new ladder (a) re-verifies each joined piece against the page's visible text with whitespace squashed, drops any that is not there, and shows the survivors as separate pieces with ellipses (`verifyJoined`); (b) drops pieces that carry leaked markup; (c) never lets a passage bridge a block that was dropped between two kept blocks (the region text puts a masked line there). One site (academic#3) still fails the harness check, because of the stray `<` effect, with snips that are strictly verbatim. That is why the harness row is a FAIL by one site and the strict row is a PASS; I have not changed the harness to make it pass.

### 6.4 Relevance

The recorded baseline was one rater reading run notes; the new ladder was rated by me from the shown snips with the rules in section 2, which are stricter on two-part asks and on "a headline is not the main news". Paired against the record: 10 sites went 2 -> 1 (events#2, literature#3, museum#4, nonenglish#1, product#2, readme#3, realestate#2, realestate#4, sports#2, travel#2), 9 went 1 -> 2 (academic#4, changelog#2, changelog#4, government#1, government#4, museum#2, nonenglish#4, nonenglish#5, podcast#4), one went 1 -> 0 (literature#2: the page is a disambiguation list, and the old snip was that list's boilerplate), one went 0 -> 1. Only museum#4 is a clear loss to the gate (the answer sat in a short "on display at" line that the old, junk-led rung d happened to include). The deterministic proxy (share of the ask's content words found in the shown text) fell from 0.724 to 0.601; part of that is old snips that matched ask words inside menus. B4 is reported as failed by one site; I did not move it.

### 6.5 Deviations after the freeze (all disclosed)

1. The lexicon changed after the freeze. Added: waiting-room wall phrases (in-sample for product#3); the affiliate / newsletter / endorsement / documentation-badge / update-note phrases (after audit 1); a STRONG list; a WALL_WEAK split (captcha, paywall and similar need real coverage of the page, never one passing hit); 2-character CJK phrases allowed. Because the judge shares CHROME, its baseline moved from 58 to 59 of 82 old junk sites (the 59 is in the table).
2. The wall rules changed to remove false walls found by unit tests (not by the cache): the old English regex (any short page that mentioned "captcha" was a wall) is retired; a title or first unit must be mostly notice; a mid-page mention does not count; a short all-prose page is not "no content"; a stopless run must have no punctuation, so prose in a language with no function-word list (German, Dutch, Polish, Portuguese) is not mistaken for a menu (tests added for those).
3. The content region was iterated after audit 1 (prose-run rule, link-sentence rule, long-line rule).
4. In the harness ladder at most 3 declared blocks are shown per page (as `SNIP_LIMITS.maxSnips`); before that one events page showed 20.
5. Tables and code (item 5): `tableRowsOfHtml` and `codeBlocksOfHtml` are implemented and tested but **off** in the bars run (`--tables` turns them on). With them on, the frozen judge calls 4 sites junk (it reads prose); by hand one is junk (a table of contents), two helped (a code block with the install commands, rows with a city's population), four add noise (rows or commands that share two words with the ask but do not answer it). They are not wired into the Sources-only strand, whose passages arrive as text without tags.
6. `fold-chat.js` got two anchored edits so the typed gaps' reasons reach the existing "no passage could be quoted" note; nothing else in it changed.
