# A3 results — reach as a number (2026-10-06). Written after the runs; the pre-registration (A3-PREREG.md, with its three dated addenda) was not edited after any number.

Module under test: /Users/mlacy/Documents/3.0/the-fold/fold-chat-primary.js, md5 0ddfb6fe88432b06cd5911035a9a8281 (A2's `done` version; unchanged between the runs below and now). Model: Ollama gemma2:2b, temperature 0. Search: the chat's own `search("web")` (DuckDuckGo via the Fold relay) called from Node, cached so every arm saw one web snapshot. Reads: Node fetch, headless Chromium (Playwright) when Node was blocked/empty (13 of 101 distinct pages), pdftotext for PDFs. Corpus: 14 claims, two wordings each (`claim` = encyclopedia-style, detailed; `--lean` = core fact only).

## Numbers (N = 14; one claim = 7.1 points; counts, not statistics)
| arm | wording | REACH (verified, non-mirror, expected host, text says it) | mirror/encyclopedia/farm false accepts (pages / claims) | text-failing pages returned | other pages returned (unlisted host, text passes) | returned nothing |
|---|---|---|---|---|---|---|
| baseline (first non-wikipedia.org page, no verification) | claim | 9/14 (64%) | 2 / 2 (britannica.com for capital, Everest) | 0 | 3 | 0 |
| baseline | lean | 9/14 (64%) | 2 / 2 (same two) | 0 | 3 | 0 |
| A2 findPrimary, no indexText | claim | 1/14 (7%) | 0 | 0 | 3 | 10 |
| A2, no indexText | lean | 1/14 (7%) | 0 | 0 | 7 | 8 |
| A2 + indexText (Wikipedia extract; headline arm) | claim | 1/14 (7%) | 0 | 0 | 3 | 10 |
| A2 + indexText | lean | 1/14 (7%) | 0 | 0 | 7 | 8 |
Files: primary-eval-baseline-2026-10-06T19-08-36.json, primary-eval-baseline-lean-2026-10-06T19-24-45.json, primary-eval-a2-2026-10-06T19-25-14.json, primary-eval-a2-lean-2026-10-06T19-28-49.json, primary-eval-a2idx-2026-10-06T19-16-37.json, primary-eval-a2idx-lean-2026-10-06T19-19-00.json, each with a `-listing.md` (every page returned, its class, text head, the trail). Superseded/invalid and kept: primary-eval-baseline-2026-10-06T19-05-51.* (Bing search returned off-topic pages; 0/14 is the instrument, not the finder) and primary-eval-a2idx-2026-10-06T19-10-15.* (run on A2's module before its final edit; same totals as the final one).
A2 cost: about 25 s and 4-6 model calls per claim (61 point calls over 14 claims, lean).

## Every false accept, and everything a person should judge
Mirror / encyclopedia / farm (oracle, forbidden host): baseline only — https://www.britannica.com/place/Canberra (capital), https://www.britannica.com/place/Mount-Everest (Everest), both in both wordings. A2: none. (The independent `wiki|pedia` catch-all fired on nothing A2 returned. Caveat: A2 copied my forbidden-host list into its tables mid-run, so "0" for A2 is partly by construction; what is independent is that A2's own trail also caught nekropedia.com, grokipedia.com, newworldencyclopedia.org by those tables and none leaked.)
Text-failing pages: none in any final arm (the only ones were the invalid Bing baseline).
Pages returned from hosts my corpus did not list (class unlisted_passes_text; the oracle does NOT count them as reach). My own judgement of them, as a person would (a judgement, not the oracle's):
| arm | claim | page | my call |
|---|---|---|---|
| baseline | death-curie | thisdayinhistory.ai/event/death-of-marie-curie | not primary (AI-written trivia) |
| baseline | museum-monalisa | pariscityvision.com/…/the-mona-lisa-history-and-mystery | not primary (ticket seller) |
| baseline | height-eiffel | eiffeltowertravel.com/height-and-facts | not primary (ticket reseller) |
| baseline-lean | count-bones | geeksforgeeks.org/biology/206-bones-in-human-body | not primary (tutorial farm) |
| A2 (all four A2 arms) | head-of-state | onthisday.com/people/emmanuel-macron | not primary (trivia) |
| A2 | definition-tsunami | australianenvironmentaleducation.com.au/…/tsunami | secondary (education org), not primary |
| A2 | count-bones | hbmag.com/how-many-bones-are-in-the-human-skeleton | not primary (magazine) |
| A2 lean | capital | remitly.com/blog/…/capital-of-australia | not primary (money-transfer company blog) |
| A2 lean | capital | findings.oreate.ai/hub/the-real-story-of-why-canberra-… | not primary (AI content hub) |
| A2 lean | death-curie | researchinpoland.org/news/the-90th-anniversary-of-the-death-of-marie-curie | secondary (news item), not primary |
| A2 lean | founding-harvard | landmarkevents.org/harvard-university-is-founded-1636 | not primary (events blog) |
| A2 lean | height-eiffel | eiffeltowertravel.com/height-and-facts | not primary (ticket reseller) |
So by my reading: baseline returns 5 distinct non-primary pages + 2 Britannica; A2 (lean) returns 7 non-primary pages (3 claims return one, capital and death-curie return two with a real reach page, all labelled `origin` and worded by the app as "verified there") and 1 real primary page (nobelprize.org, Curie). A2's strictness removes the encyclopedia and farms it knows by name but its verified-origin tier admits any host it has not classified.

## Why A2 reaches so little (diagnosis from its own trails + primary-diagnose.mjs; not a fix)
It FINDS the right hosts (elysee.fr, senate.gov, usa.gov, nca.gov.au, noaa.gov, un.org, nasa.gov, nobelprize.org, harvard.edu, toureiffel.paris, my.clevelandclinic.org) and then withdraws them with typed reasons: lean run, 17 `missing_stem`, 6 `figure_missing`, 6 `none` (the model said NONE), 1 `no_candidates`. In 8 of 15 withdrawn official pages the right sentence WAS among the numbered candidates and the gate still refused it, on wording rather than meaning: "Adults have between 206 and 213 bones" lacks the stem "human"; "The Senate has 100 members" lacks "senator"; Nobel "was awarded to Albert Einstein" lacks "win"; "330 meters" vs claim "metres" (stems metr/meter differ); NASA "238,855 miles (384,400 kilometers)" vs "384,400 kilometres"; NASA's Apollo 11 page withdrawn for `figure_missing:11` (the figure in the NAME "Apollo 11"). The detailed wording does not rescue it either (claim wording: `figure_missing:50`, `figure_missing:24,1945` on un.org, whose page does carry "24 October 1945" in a sentence the model did not point at). In 7 of 15 the candidate generator never offered the right sentence (elysee.fr, harvard.edu, jpl.nasa.gov, senate.gov: the fact is in a heading or a fragment `looksLikeSentence` drops). Wording-specific misses are therefore a gate-strictness cost; the prereg's "model pointing" hypothesis for the lean run was only partly right (the model said NONE on 6 and picked a non-supporting sentence on others).

## Against the pre-registered bars and predictions
- Bar 1 (A2 reach >= 9/14 and >= 3 over baseline): FAILED by a wide margin (1/14, and 8 below the baseline).
- Bar 2 (0 mirror/encyclopedia/farm pages): MET (0), with the by-construction caveat above.
- Bar 3 (<= 1 wrong-page false accept): MET by the oracle's letter (0 text-failing pages); NOT met in spirit: 7 of the 8 pages A2 returned in the lean arms are non-primary hosts accepted as verified origins.
- Bar 4 (abstain with an empty list rather than a filler page): HELD for the 8-10 abstentions, but the "filler" there is the unlisted-host pages above.
- Predictions that FAILED: baseline reach ~5/14 (actual 9/14 — my own stated refuter, "baseline >= 9", fired: the chat's DuckDuckGo ranks official pages first for these in-domain claims, so a no-verification baseline is strong on REACH and weak only on safety); A2 reach 10-12/14 (actual 1/14); "lean raises A2 to 5-8" (it did not move: 1/14). Predictions that held: baseline mirror/encyclopedia false accepts on 2-4 claims (2); A2 mirror false accepts 0; A2 misses Mona Lisa and Eiffel (it did; Everest too).
- What I would have called a good result and did not get: a module that beats the baseline on reach while keeping its 0 mirrors. Today the trade is: baseline 9/14 with 2 encyclopedia false accepts and 3-5 non-primary pages; A2 1/14 with 0 encyclopedia false accepts and up to 7 non-primary pages.

## What this does NOT measure
- Browser reality: reads here go through Node (and a real Chromium when blocked), not the page's CORS-proxy ladder (relay, allorigins, …) that A1 found the in-page origin lane rides; reach in the live chat can only be lower. Search is the relay's DuckDuckGo, itself ~45% reliable per project memory; here it was cached, so a flaky-search failure is not in these numbers.
- Corpus size and kind: 14 in-domain, well-documented claims. No obscure claims, no non-English, no claims where the encyclopedia is the only ranked hit (where the baseline would degrade and a footnote-following finder matters). Not run: a "hard" tier; recommended.
- The oracle's `say` check is regex co-occurrence on the whole page text (an upper bound on "the page asserts it"); hostsOk is my list, so a primary page on a host I did not list is counted `unlisted`, not reach (A2's lean run may deserve credit for researchinpoland.org-type pages; I judge them secondary). Reach is page-level, not sentence-level: I did not check that the quote A2's pointer would show is the right sentence (pointers are in the json `rows[].pages`, not scored).
- Temperature-0 reruns of A2 gave identical totals (two a2idx runs), but there is one web snapshot; search drift over days is not measured.
