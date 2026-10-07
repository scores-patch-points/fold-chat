# A3 pre-registration — measuring "reached a primary page" (written 2026-10-06 BEFORE any run of primary-eval.mjs)

Disclosure of what I had seen before writing this: environment probes only (which search engines Node can reach, one Bing query "who is the president of France" whose results listed elysee.fr, britannica, wikipedia, three small news/blog sites — so my Macron prediction is NOT blind). No run of the corpus, the baseline, or any module.

## The instrument
- Corpus: `eval/ants/primary-corpus.json`, 14 claims (head of state, capital, height x2, death date, count x2, definition, founding date x2, award, event date, measure, museum holding). Each has the claim sentence an encyclopedia would carry, `hostsOk` (what a real primary page for it would be: government/official, Nobel, NASA, museum, university…), `say` (regexes the page text must ALL match), and a global `forbid` list (Wikipedia in all languages + sister projects, wiki mirrors/forks and a `wiki*`/`*pedia` catch-all, other encyclopedias incl. Britannica, content farms / Q&A / listicle / UGC hosts).
- Oracle (`eval/ants/primary-oracle.mjs`): knows nothing of fold-chat-primary.js; looks only at the returned `passages` (url + text). Per returned page: `forbidden` (host in forbid list) | `reach` (host in hostsOk AND every `say` regex matches the page text) | `host_ok_text_fails` (right kind of site, page does not say it) | `unlisted_passes_text` (unknown host whose text carries the say-regexes: NOT counted as reach, listed for a person to judge) | `unlisted_fails_text`.
- Per claim: REACH = at least one returned page is `reach` and no returned page is `forbidden`.
- Real I/O: search = Bing HTML fetched from Node (DuckDuckGo answers 202 bot-challenge, Brave 429, Mojeek captcha — measured today, from this Mac); readPage = Node fetch + HTML→text (PDF via pdftotext), falling back to a real headless Chromium (Playwright) when fetch is blocked/empty. Model = Ollama gemma2:2b, temperature 0. Web responses are cached on disk for the run so the baseline and the module see the same web snapshot (cache key = query/url; `--fresh` bypasses).
- N = 14, so one claim = 7.1 points. No significance claims; the numbers are counts.

## Arms
- BASELINE: search the claim sentence; walk results in order, skip only `*.wikipedia.org`; first page that reads with >= 200 chars of text is returned. No verification.
- A2: `findPrimary` from fold-chat-primary.js (when marked done), same injected search/readPage/point.

## Bars (declared, not measured: nobody has a prior number; they are what I would call "the module earns its place")
For A2's module:
1. REACH >= 9/14 (64%) and at least 3 claims more than the baseline.
2. MIRROR/ENCYCLOPEDIA/FARM false accepts = 0 returned pages, over the whole corpus (any single one fails the bar).
3. WRONG-PAGE false accepts (`host_ok_text_fails`, `unlisted_fails_text`, i.e. a page returned as a primary witness that does not say the claim) <= 1 page in 14.
4. Honest abstention: a claim with no verified page must return `passages: []`, never a filler page. Measured as: every returned page is `reach` or `unlisted_passes_text`; abstained claims are reported separately from false accepts.
For the baseline there is no bar; its job is to be a number.

## Predictions (what I think will actually happen)
- Baseline: REACH about 5/14 (36%) (range 3-8). Mirror/encyclopedia/farm false accepts on 2-4 claims (Britannica, answers/reference-type, wiki mirrors pass a "not wikipedia.org" filter; the baseline filters only wikipedia.org). Wrong-page accepts on 2-4 more (news/blog/listicle pages: `unlisted`).
- A2: REACH about 8/14 (57%) (range 6-10) — so I expect bar 1 to be MISSED by one claim, narrowly; mirror FA = 0 (the module will have its own host filter; the risk is the wiki catch-all hosts it does not know); wrong-page FA 0-1. I expect these misses regardless of module quality: Mona Lisa (louvre.fr is JS-heavy/bot-guarded), Eiffel Tower (toureiffel.paris), Everest (the elevation is stated on foreign-government/news pages, search ranks Wikipedia/Britannica/news first), and possibly the definition (tsunami) because many .gov pages pass but need the right sentence.
- Oracle weakness I already know: `say` is a word-co-occurrence check, so REACH is an upper bound on "the page asserts it"; the human-readable listing (primary-eval-listing.md) is where a person overrules it.

## What would refute me
- Baseline REACH >= 9/14 (then the module has little to add) or baseline with 0 mirror/farm false accepts (then my claim that "first non-Wikipedia" is unsafe is wrong).
- A2 with any forbidden page, or A2 REACH below the baseline.
- The oracle itself: a hand-built passage set (primary-oracle.test.mjs) must classify forbidden/reach/host_ok_text_fails/unlisted correctly, and mutating each gate (host check, forbid check, text check) must make a test fail.

Results go to `eval/ants/A3-RESULTS.md` and `primary-eval-*.json`, appended, never edited after the fact.

## Addendum 2026-10-06 19:1x (instrument change, made after seeing the FIRST baseline run; the first run is kept, labelled invalid-instrument)
The first baseline run used Bing HTML from Node as `search`. It returned off-topic pages for sentence queries ("The United States Senate is composed of 100 senators…" -> united.com airline pages; "Emmanuel Macron is the president of France." -> Bible pages about "Emmanuel"), and Bing gave the same off-topic pages from headless Chromium, so the engine, not the transport, was at fault. That run (baseline 0/14 reach) says nothing about the finder and is superseded. Direct DuckDuckGo is blocked from Node AND from headless Chromium today. The harness now uses the chat's own `search("web")` (fold-chat-web.js; DuckDuckGo through the Fold relay), which is the search the product runs and returned on-topic pages (senate.gov, elysee.fr) for the same queries. Bars and predictions above are unchanged and were NOT revised after seeing any numbers; the baseline prediction (about 5/14) is simply re-tested with the right search. The Bing run is evidence only about the instrument.

## Addendum 2 (before any A2 run): A2's arms
A2's module takes an OPTIONAL `indexText` (the encyclopedia page's text, for recognising mirrors by sentence overlap). The chat has that text in hand; a harness that omits it under-tests the mirror gate. Two A2 arms, both pre-declared: `a2` (no indexText: the module as the contract in the brief states it) and `a2idx` (indexText = the plain-text extract of Wikipedia's top hit for the question, fetched live). Bars apply to each arm separately; the headline A2 number is `a2idx` (it is the shape the chat will call), and `a2` is reported beside it. Search is the same cached chat-search for every arm; readPage is the same reader; the `point` model is gemma2:2b at temperature 0. Revised prediction after seeing the baseline (9/14 reach, 2 Britannica false accepts, 3 unlisted tourism/trivia pages): the baseline's reach beats my forecast because the chat's DuckDuckGo ranks official pages first for these in-domain claims; A2's value will show in FALSE ACCEPTS (it should return 0 Britannica and 0 unlisted) and in REACH on the three baseline misses (Curie, Mona Lisa, Eiffel) and the two Britannica claims (capital, Everest). I predict a2idx reach 10-12/14, mirror FA 0, wrong-page FA 0-1. Reported even if wrong.

## Addendum 3 (after the first a2idx run: 1/14 reach, 11 abstentions, 0 false accepts) — a second claim wording, declared BEFORE it is run
The a2idx trails show the module reaching the right hosts (elysee.fr, nca.gov.au, usa.gov, un.org, nobelprize.org) and then withdrawing them on its own assertion gate ("figure_missing:50", "missing_stem:city"): my claim sentences carry detail beyond the core fact (e.g. "two for each of the 50 states", "at the Sancellemoz sanatorium"), which a primary page need not repeat. That is either a corpus problem or a module-strictness cost, and one wording cannot tell them apart. So each claim also has `claimLean` (the core fact only, e.g. "The United States Senate has 100 senators."), run with `--lean` through the same oracle. Both wordings are reported for every arm; neither is chosen after the fact as "the" result. Prediction: lean raises a2idx reach to 5-8/14 and leaves mirror FA at 0; the baseline barely moves (it does no verification). If lean does not raise a2idx reach, the cause is the model-pointing step (gemma2:2b picking a wrong candidate), not claim over-specification.
