# PREREG — snip-first answering study (written 2026-10-05, BEFORE any pipeline run)

Status of this file: the rules and bars below were written before `pipeline.mjs` was run on any ask. Gold verification
(`verify-gold.mjs`, which reads canonical sources and never the pipeline's output) may still correct a gold string; every
such correction is logged in `gold-fixes.md`. After verification the ask set is frozen: `asks.json` sha256 is appended
at the bottom (`FROZEN`) before the first pipeline run. Bars are not changed after results; "bar not met" is reported as such.

## Question
For ordinary things people ask a chatbot, how often can the answer be produced with NO model-written text: find sources,
snip their own passages verbatim, cite them. And what kind of material makes that work or fail.

## Ask set (`asks.json`, built by `build-asks.mjs`)
221 asks: 17 English everyday classes (>= 8 each), 54 cross-language asks (6 facts x es fr de zh ru ar hi pt ja; the
English twins of those six facts are inside the single-fact and number-with-unit classes), 10 follow-ups
(pronoun/ellipsis, resolved with `fold-chat-mind.js::resolveQuestion`). Gold was written from my knowledge, then each gold
is verified against the canonical source (`canon`) by `verify-gold.mjs`.

Gold rule (the same for every ask, fixed in advance):
* `expect:"answer"` — ANSWERED iff a single snip of the strand contains a match for EVERY regex in `gold.all` (the
  same-snip rule) and, if `gold.any` exists, one of those. `strandwide:true` relaxes "same snip" to "anywhere in the strand"
  (used for step lists, comparisons, checklists). Text is digit-normalised first. Regexes are case-insensitive, Unicode.
* Recipe asks (`struct:"recipe"`): ANSWERED-COMPLETE iff a declared Recipe block with >= 3 ingredients and >= 2 steps, not
  truncated, matches the gold regexes. A prose strand that matches gold only counts as ANSWERED-PARTIAL.
* `expect:"gap"` — correct behaviour is a typed gap. A strand shown instead is a LEAK; a leak whose snips assert the trap
  (regex `trap`, or my reading) is DANGEROUS-WRONG. `expect:"correction"` — correct is a gap or a strand containing the
  correction; asserting the trap is dangerous.
* `synth` marks asks whose full answer needs more than quoting (arithmetic, comparison, translation, summarise): the
  gold-in-strand check still applies; satisfaction is labelled needs-model if the facts are quotable but the asked-for
  result is not in any source.

## Pipeline (`pipeline.mjs`) — NO MODEL
search (the app's own `searchWeb` front half through the relay, retry once after 5 s; fallback to a browser-engine search is a
separate, labelled transport) -> app's `applyGate` -> read up to 5 pages (<= 9 attempts, serial, >= 1.1 s apart, cache on disk) ->
candidate snips by ladder, each tagged with its rung:
* (a) declared structure: schema.org Recipe, HowTo, FAQPage, QAPage/Question, Product/Offer, Event, Article/WebPage
  description, meta description. (b) Wikipedia lead (first paragraph, cut at a sentence end <= 700 chars).
* (c) `impressionOf(text, query, {budget:700})`, adjacent sentences merged, `...` between gaps.
* (d) lexical baseline: top 3 sentences by distinct query-token overlap.
Strand policy S1 (fixed): per source in search-rank order: structured blocks if relevant; else Wikipedia lead + (c); else (c);
an Article/meta description only if (c) found nothing. Deduplicate by normalised text. Cap 2,500 shown chars.
Gap rules: G1 volatile cue (declared multilingual regex) -> typed gap `live-data`; G2 no readable source / no candidate ->
typed gap; G3 coverage of the ask's content tokens by the strand < 0.6 -> typed gap `off-topic`. The strand that WOULD have
been shown is kept for audit. 0.6 and the 700/2,500/5-page caps are declared, not measured (II.11).
Mechanical verbatim check on every snip: segments must equal `pageText.slice(start,end)`; structured items must equal a
declared source string; plus a corroboration check against the cached raw bytes. Any failure of the first = pipeline bug.

## Transports (named in the report next to every number)
search: relay (`FOLD_RELAY/search`, node fetch) first; if it fails twice, Chromium (Playwright) Brave then DDG, then node-fetch
DDG; each search records its transport. Page reads: Chromium navigation (raw response body) first, then the relay's `/raw`;
public CORS proxies and text readers are blocked by the harness (third parties; not gentle). Wikipedia plain-text extracts: API.

## Success bars (not tuned after seeing results)
B1  no-model answer rate on answer-expected asks (answered AND judged yes / yes-with-trim): overall >= 60%; each of
    recipe, definition, single-fact, number-unit, history, science, code >= 50%.
B2  dangerous-wrong <= 5% of gap-expected asks, and 0 live-data traps shown a confident figure.
B3  verbatim check failures: 0.
B4  short-answer span: among answered asks, the answer-bearing snip <= 400 chars in >= 50%.
B5  snip answered rate within 10 points of the model-writes-from-sources mode on the 40-ask subset; snip fabrication 0 by construction.
B6  snip-level relevance precision >= 60%.
B7  judge validity: the relevance judge accepts <= 20% of shuffled (other-ask) snips, else it is reported unmeasured.
B8  non-English answered rate within 20 points of English on the six shared facts.
B9  volatile gate catches >= 90% of live-data traps with <= 10% false positives on non-volatile asks.
Wilson 95% CIs on every proportion; n always shown; "measured" vs "estimated" labelled.

## Falsifiers (II.10)
Asks whose gold is not in any retrievable source (unanswerable, false-premise, live-data) must not be answered; a
shuffled-strand control checks the gold regexes are not vacuous (gold of ask i against strand of ask j); a shuffled-snip
control checks the relevance judge; an ungated run of the volatile gate and an unresolved run of follow-ups are the controls
for G1 and for `resolveQuestion`.

## Known limits declared up front
Node has no DOMParser, so `readText` takes its regex `<p>/<li>` fallback, not the browser's DOM path; search results depend
on the relay (~45% reliable measured elsewhere); gold is mostly Wikipedia-verifiable; sources change daily; the model
comparison is 40 asks with gemma2:2b only.

## Addendum 1 (written before the first full pipeline run)
* Smoke tests of the pipeline code were run on six asks (sf1, rec1, cod1, xl_F2_zh, his3, liv1) before gold verification, to check the code ran;
  their outputs were deleted and the six are re-run in the main run. Nothing in a bar, a rule or a gold string was changed because of them.
* Gold verification (verify-gold.mjs, gold-verify.json): 200 pass, 1 fail by design (num10, arithmetic: the result is not in the canon; verified by
  computation), 20 n/a (gap-expected asks have no canonical answer). Fixes made to gold/canon are in gold-fixes.md.
* Search infra rule added: an ask whose search returned nothing on every transport (transport "none" or "api-only") is re-run once, later
  (`--retry-search-failed`); the pass-1 outcome is kept in the result (`pass1`) and the report states both.
* Wikimedia rate-limited this IP (HTTP 429, Retry-After 31 s) during verification; the harness honours Retry-After and keeps 2.5 s between calls to wikipedia.org.
* wikiHow answers bot requests with a JS "Client Challenge" page (HTTP 200, 3 KB): the app's looksBlocked() does not recognise it. Kept as measured behaviour.

## FROZEN
asks.json sha256 = 5a86dfd13809c47deafa89fd1ccd45abfb961538d40e62866de01dd21951abf2  (221 asks; subset.json = the 40-ask model-comparison subset, fixed by rule)

## Addendum 2 (before the main run; found on four asks of the first start, which was killed and restarted)
* Pipeline bug fixed: a structured block (Recipe, HowTo, Product, Event) was kept only if >= 34% of the ask's tokens occurred in its name; generic verbs
  ("make", "from", "scratch") made that reject real pancake recipes. Rule now: >= 1 ask content token in the block name. FAQ and QA blocks keep their share rules.
* Check bug fixed: the structured verbatim check compared items extracted by the app's own recipe cleaner against strings cleaned by the harness's cleaner;
  the declared-string set now holds both normalisations. Neither change used gold.
* (Addendum 2b) the declared-string set also holds the raw (undecoded) JSON strings: the app's recipe cleaner leaves named entities such as &frac12; undecoded, and that is a content defect (counted as `entity residue`), not a verbatim failure.
* (Addendum 3) Page-read timeout for the Chromium transport was 20 s for the first ~55 asks of the main run and 10 s from then on (slow hosts held a read for 20 s each; the app's own direct-read budget is 8 s). Pages already cached replay regardless; the difference can only turn a read that took 10-20 s into a failure for later asks.
