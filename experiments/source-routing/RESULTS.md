# Searching the web efficiently — what was tested, what was falsified

Everything here was run on 2026-10-05, on one machine (load average ~340 for much of it, so absolute
times are pessimistic and noisy). Each claim was written down with its falsifiers **before** the run.
n is small everywhere. These are measurements of this afternoon, not of the web.

## Scoreboard

| # | Claim | Falsifiers (pre-registered) | Verdict |
|---|---|---|---|
| H0 | Routing the question to the sources it needs beats asking every source | — (offline, labels written by the same author: a sanity check, not a test) | 82% fewer specialist calls; 27/29 needed sources |
| H1 | Read each pulled page through the khora, pool the beings into one index, surf with Duke (activation + `dmdWindow`) beats the impression | F1 recall ≤ impression ∧ no 30% saving · F2 padding on no-answer controls · F3 corpus precision/recall · F4 read cost > 8 s/page | **FALSIFIED on F1–F4.** 3/7 answers vs 6/7; mean read 19.6 s/page. Surf precision was high (91%) and it handed 24k chars vs 67k — it is precise but misses sentences that name their subject only by pronoun, because `/api/read` returns beings but no mention addresses |
| H2 | Searching DuckDuckGo directly (from this machine) beats the Cloudflare relay | G1 success ≤ relay · G2 median ≥ relay · G3 > 25% challenged · G4 < 5 results | **Falsified — but about Node, not about an extension** (see below) |
| H3 | Direct page reads (no proxy chain) succeed ≥ 80% | G5 | 7/9, n=9 (only 3 queries had results); both failures were 403s from two recipe sites |
| H4 | Brave + DuckDuckGo asked at once, direct, paced 4 s apart, beats the relay | K1 < 10/12 with ≥ 5 results · K2 median ≥ 1.5 s · K3 < 9/12 relevant · K4 any Brave refusal · K5 ≤ relay's 5/12 | **Falsified in Node (0/12, Brave HTTP 429). Survives in real Chromium: 12/12, median 656 ms, 11/12 relevant, 0 refusals** |

## The finding that reorders the rest: Node is not an extension

Node's `fetch` was answered with a bot challenge by DuckDuckGo and HTTP 429 by Brave — on the same IP, in the
same hour, where the built-in Chromium got **200 OK with full results for 12/12 Brave queries and 6/6
DuckDuckGo queries** (8–12 results, 0.3–1.1 s). `curl` also got Brave's full page. The block is the transport's
fingerprint, not request volume (the first Node request to Brave was already a 429). Anything about search
must be measured on the browser's network stack, which is what an extension uses. H2 and H4 above were
re-run there; the Node verdicts are kept because they are what the script printed, and the scripts carry a banner saying so.

Still untested: a *service-worker / extension-page* fetch with host permissions (cross-origin, no page
Origin) rather than a same-origin page fetch in Chromium. The numbers say it should work; the only way to
know is to run `experiments/source-routing/` equivalents inside the loaded extension.

## Where a real turn's time goes (one 28 s turn, relay transport)

| time | what |
|---|---|
| 17.7 s (62%) | one call to the relay's web search; its DuckDuckGo/Brave upstreams answer 408/429 → 502 on ~2 of 3 calls (15–18 s to fail), ~2.3 s when healthy |
| ~8 s | page reads waiting out two public proxies' 8 s timeouts after the fold's relay had already been refused (403) |
| 0.1–2 s | the pages that did read |
| (not on this list) | the khora reader: 2–48 s per 24k-char page |

The answer was available quickly; the time went on waiting for sources that could not help.

## What changed in the code because of it

- **Everything asked at once** (`searchWeb`): the relay no longer holds Wikipedia's 300 ms answer behind it.
  A 6 s budget releases the web search *only if another source answered*; if nothing else did, it is waited for
  (an earlier version abandoned it and returned nothing — a slow success traded for a fast empty answer).
- **A pool, not batches, for reads** (3 at a time; a slot that frees starts the next candidate).
- **Gateway budget 3.5 s** (was 8 s), a **per-tab memo** of pages read, and a **dead-host memory** (a host that
  turned us away on every door is not retried for 5 min).
- **Wikipedia via its plain-text extract** (45 KB, ~200 ms) instead of 880 KB of HTML walked by a DOMParser.
- **`direct: true` transport** (`fold-chat-engines.js`): Brave + DuckDuckGo asked at once, first to return ≥ 5
  results wins, a challenge costs ~200 ms; page reads are direct only — **no relay, no public proxy, no text reader,
  so no third party learns an address**. For the extension; the static site keeps the relay path.
- The **reader is off the hot path** (H1).
- An **impression** (`fold-chat-impression.js`, on the khora's keyless `Field` + `nullBand`) replaces
  "first 4,000 characters": 6/7 answers present vs 5/7, at ~15k vs 28k characters.

## Open, and what would falsify it next

1. **Extension fetch ≠ page fetch.** Load the unpacked extension; run 12 queries through `searchWeb({direct:true})`
   from the extension page. Falsified if Brave or DuckDuckGo refuse any of 12 paced requests, or median ≥ 1.5 s.
2. **Direct page reads** (H3) can only be tested with host permissions — a page-origin fetch is CORS-blocked.
   Falsified if fewer than 80% of 36 top-3 results read (≥ 40 readable chars, not a shell).
3. **Engine scraping is fragile.** Brave's class names are build-hashed; the parser keys on stable markers and
   says "the markup may have changed" instead of "nothing found". Falsified the first time it silently returns 0.
4. **Read-once catalog.** A librarian does not re-read a book: persist the impression + shadow per URL (IndexedDB,
   keyed by URL + fingerprint). Falsified if a follow-up about the same pages still fetches.
5. **A mention-book door** (khora `reading-log.js::mentionBookFromLog`, served by the heimdall bridge) is what the
   surf needs to work as THE-HOLOGRAPH §6 describes. Not built; belongs to whoever owns heimdall.

## Extension-page fetch, measured (2026-10-05)

The built MV3 extension (`scripts/build-extension.mjs`) loaded unpacked into Playwright's Chromium 153; every call below
is made **from the extension page** (`web.search("web", q, 0, { direct: true })`, `web.readText(url, { direct: true })`)
by `fold-ext-e2e.mjs`. One harness condition: headless Chromium's `HeadlessChrome` user agent is answered by Brave with a
429 and a slider captcha, so the harness sends an ordinary Chrome UA (a person's browser already does).

**Item 1 — not tripped at the pre-registered size, tripped under sustained load.** 12/12 paced (2.5–3 s) Brave requests
answered, 18–20 results each; median 651 ms (run A) and 621 ms (run B); range 433–3642 ms. DuckDuckGo answered a bot
challenge on every query (~100–200 ms), so these are single-engine results. After roughly 45 Brave searches from one
address inside an hour (several harness runs), Brave answered **429 with a captcha page, even with the ordinary UA**.
So the falsifier holds for a burst of 12 and does not hold for harness-rate sustained use. What a person's real rate does
(a deep turn issues several searches) is not measured.

**Item 2 — INCOMPLETE; no verdict at n = 36.** Only 18 pages were tried (queries 1–6 of 12): 17 read, 1 refused
(investopedia.com — it returned a 51-character shell on one run and a refusal on others). The three short reads (567, 540,
259 chars) were judged from their text: two are Cornell LII definitions, one a LawShelf page that opens with a promo
banner — real, short pages, not shells. The other six queries never got a search answer (item 1's 429), so their pages
were not tried. To finish: once Brave has cooled, `FOLD_E2E_SKIP_SEARCH=1 FOLD_E2E_READS_FROM=6 node fold-ext-e2e.mjs`.

**Item 3 — partly tripped.** The parser did not silently return 0, but a 429 captcha page was reported as
"the page is large but nothing parsed — the engine's markup may have changed". In `searchDirect` the parser's `shape`
wins over the HTTP status, so a rate limit (back off) and a markup change (fix the parser) read the same. Treat
`r.status === 429`, or a challenge body, as `blocked` before looking at `shape`.

Also measured: no request went through the relay or any public CORS proxy (18 hosts contacted in all: Brave, DuckDuckGo,
Wikipedia, the pages read, the loopback bridge). Both engines are asked for every query, so DuckDuckGo sees each query
too, even though it only ever answered with a challenge.

---

## Snippet-first: answer from the search snippets before opening any page (2026-10-05)

A search engine's results are an index; each card carries the sentence around the hit. If the cards
already hold the answer, a page read (a fetch, a parse, 1–2 s, a chance of refusal) buys nothing.

### Development set (54 queries, DuckDuckGo from real Chromium, top 8 snippets each) — TUNED ON, not a test

| | |
|---|---|
| Oracle: answer present in the top-8 snippets | **easy 35/35, hard 15/15** (includes es/fr/de/ja/ru/zh; deep facts like tungsten's melting point, the Bergen Kontor's closing year, Golden Gate rivets) |
| R1 "tells" rule (question words that discriminate cards, ≥ 2 sites carry all) | fires 7/35 easy, 4/15 hard; 0/4 control false fires; one wrong |
| A "agreement" rule (a term ≥ 3 sites share, rare across the other questions' cards) | fires on **everything incl. 4/4 controls** — padding, not discrimination → **falsified** |
| A2 (agreement among **on-topic** cards only; common words dropped via the background corpus, no stoplist) | `3 sites, term ≤ 2%, question word rare ≤ 10%, on-topic ≥ 70%`: fires 23/35 easy + 7/15 hard (60% of answerable), right 29/30, **0/4 control false fires**. The one wrong answer: Spanish — "por" looks rare against an English-dominated background |

Weakness found: the background corpus is language-specific. Thresholds were picked after seeing this data, so
these numbers are optimistic and **cannot** be used to adopt anything.

### HOLDOUT — pre-registered BEFORE any holdout query was run

Frozen rule (`fold-chat-snippets.js`, A2): on-topic card = carries ≥ 70% of the question's words that are rare
(≤ 10% of background cards); agreed term = a non-question word in ≥ 3 distinct sites' on-topic cards and ≤ 2% of
background cards; handed = up to 5 distinct-site cards carrying the term. Background = the 54 development SERPs,
**kept per language** (`detectLang` run on the question plus the cards' text — the question alone is too short for it: it calls "who wrote Moby Dick" unknown; decided before any holdout query ran); **abstain** (read pages as before) when the language is unknown or its
background has fewer than 80 cards. 33 new queries, never seen: 24 English answerable (18 easy + 6 hard), 3 non-English
answerable, 6 no-answer controls. Answer = a pre-written regex over the handed text.

Snippet-first earns **default ON** only if ALL hold; any single failure keeps it off:
- **S1** precision ≥ 90% (answer present in the handed text, among English answerable questions where it fires)
- **S2** coverage ≥ 40% (fires on ≥ 40% of English answerable questions)
- **S3** at most 1 of the 6 controls fires
- **S4** the 3 non-English questions all abstain (the background for their languages is far under 80 cards)

Not tested, so not claimed: pages the engines rank badly, questions whose answer is a long explanation, the
quality of DuckDuckGo vs Brave snippets (collected from DuckDuckGo only, to spare Brave), anything outside this one hour.

### HOLDOUT outcome (run once, frozen rule, frozen background, nothing tuned after seeing it)

| criterion (pre-registered) | result | |
|---|---|---|
| **S1** precision ≥ 90% | **14 / 15 = 93.3%** | pass |
| **S2** coverage ≥ 40% | **15 / 24 = 62.5%** of the English answerable questions | pass |
| **S3** ≤ 1 of 6 controls fire | **0 / 6** | pass |
| **S4** the 3 non-English questions abstain | **3 / 3** (no background for de/fr/es) | pass |

All four hold, so by the standard written down before the run, snippet-first **earns** the right to be
switched on. The code evaluated is a mechanical, comment-stripped copy of the shipped `fold-chat-snippets.js`
(`experiments/benchmark/build-page-bundle.mjs`), run in the page that collected the results.

**Audit** (done because "answer present" is a regex and some regexes are loose): for all 15 firing questions the
handed cards were read. In the 14 counted as right the answer is stated in the card — "symbol Na", "four strings",
"fell … 476", "273.15 K", "1 tablespoon equals exactly 3 teaspoons", "√144 = 12", "about 1455", "1538°C",
"15 June 1215", Portuguese/yen/Rembrandt/Vivaldi/Nairobi. No credit was incidental. Note the agreed *term* is often
not the answer ("chart", "languages", "answer") — the rule picks the on-topic cards by the term; the answer rides
along in them.

**The one failure, and what it means:** *"what is the half-life of uranium-238"* fired on the term "mode" and
handed four cards that never state the answer (4.5 billion years); the answer was not in the top-8 snippets at all
(oracle ✗) — the one holdout question where it wasn't. The rule cannot see that: it checks that independent sites
agree on a rare word about the topic, not that the answer is present. With snippet-first on, such a turn is answered
from cards that do not hold the answer (the fold's grounding check will say the sources do not state it) where a
page read might have found it. That is the price: roughly 1 in 15 firing turns.

**What changed in the code:** `fold-chat-snippets.js` (the rule, a per-language background, abstain when the
language has < 80 cards of background), `fold-chat-snippets-seed.js` (365 English cards' word counts),
`searchWeb({ snippetFirst })` (judges web-engine cards only; the tab's background learns each SERP after it is judged; `deep`
always reads), the experiment harness under `experiments/benchmark/`.

### Why it is still OFF by default

- Both runs used **DuckDuckGo** snippets. The extension asks **Brave** first and usually gets its answer first. Brave's
  snippets (longer, often date-prefixed) were not measured, so enabling this on the main path would apply an
  unmeasured rule to most traffic. Next test: the same holdout from Brave, ~35 searches — and Brave throttles at ~45/hour
  from one address, so it must be coordinated with the extension session that also needs Brave.
- 33 holdout queries; 95% interval on 14/15 is roughly 70–99%. Famous-ish facts, English, one afternoon.
- The failure above is silent on the card side. Reasonable mitigations before enabling: show the person that the answer
  came from search snippets (the passages are already labelled `snippetOnly`), and offer "read the pages".
- Cold start: only English has a seed. Any other language reads pages until its background reaches 80 cards.

**To switch it on:** `searchWeb(q, { snippetFirst: true, memo })` with `memo = makeMemo()` (seeded). Nothing else.

**Dev-set false start, kept for the record:** the first rule (R1, "question words that tell cards apart") fired on 20% of
questions — on real result sets the topic word is in most snippets, so nothing "tells". The first agreement rule
fired on all four controls (padding). Both were falsified on the development set before the holdout was written.

---

## v2 of the snippet rule — what the archons asked for (2026-10-05)

Polled in the khora's own handle table (README.md): **Bukhari** (`corroboration.js`: *stands only on independent chains; a
shared chain is one witness*), **Fisher** (`measure.js`: *a figure is a placement against a permutation null, or it is
refused*), **Chomsky** (*principles are universal, parameters are set from little input*), **Sullivan** (*morphology by
elimination, learned per language from its own material above nulls; the unmarked learned as unmarked*), **Bayes**
(`prior-query.js`: *ask what the priors know before a hand-written template* — the router's English cue regexes are such
templates; not addressed here), **Frege** (aliases; not addressed here).

What v1's failures say: the uranium-238 false fire agreed on "mode" — a word that belongs to the topic's vocabulary and would
be shared by chance among those cards. v1 counted *sites*, so `en.` and `simple.wikipedia.org` were two witnesses. And v1 gave
up in every language but English until it had 80 cards.

### v2 (frozen BEFORE any v2 data was collected; `snippetsSufficient(…, { rule: "v2" })`)

1. **Independent chains (Bukhari).** A card's chain is its registrable domain (`en.` and `simple.wikipedia.org` are one);
   cards sharing a run of ≥ 6 consecutive words are merged into one chain. "Sites" in v1 → "chains" here.
2. **Placement against a null (Fisher).** On-topic cards and rare-term candidates as in v1. The best term's chain count
   `c*` must be ≥ 3 **and** placed against a degree-preserving permutation null of the cards × terms incidence matrix
   (300 seeded swap-draws; every card keeps its number of terms, every term its number of cards): fire only if
   `P(null max chain count ≥ c*) ≤ 0.05`. Otherwise refused, with the placement in the trace.
3. **Little input (Chomsky / Sullivan).** The per-language background threshold drops from 80 cards to 24 (three
   SERPs); below that, abstain. The learning curve is measured, not assumed (B-criteria below).

### Experiment A — Fisher + Bukhari on English: a fresh holdout (28 queries: 24 answerable incl. 8 hard, 4 controls)
v1 (as shipped) and v2 run on the same results with the same English seed background.
- **A1** v2 precision ≥ 90% among the questions it fires on
- **A2** v2 coverage ≥ 0.8 × v1's (the null must not cost more than a fifth of v1's firings)
- **A3** v2 fires on ≤ 1 of the 4 controls, and no more often than v1
- **A4** v2 precision ≥ v1's
Any failure → v2 does not replace v1.

### Experiment B — Chomsky / Sullivan across languages: a learning curve (48 queries: es fr de ja ru zh × 6 answerable + 2 controls)
Background for a question = the cards of `k` OTHER same-language SERPs from this set (leave-one-out, k = 0…7), no English.
- **B1** at k ≥ 3 (≥ 24 cards): precision ≥ 90% and coverage ≥ 25% over the 36 answerable questions
- **B2** at k ≥ 3: at most 1 of the 12 controls fires
- **B3** at k = 0 the rule abstains on all 48 (a rule that speaks with no background is guessing)
Any failure → the language support stays at "abstain until 80 cards", and the curve is reported as it is.

Not tested, so not claimed: Brave snippets (all collection is DuckDuckGo), pages the engines rank badly, long-form answers.

### v3 — ask the priors first (Bayes · Chomsky · Sullivan). Frozen BEFORE any v2/v3 outcome on this data was looked at

The khora ships **POSPrior@1** for many languages: Universal Dependencies *gold* treebanks, real counts per form and
part-of-speech (e.g. French: 39,683 forms from 354,647 tokens). Closed-class forms (UPOS ADP · DET · PRON · AUX · CCONJ ·
SCONJ · PART for ≥ 50% of a form's ≥ 5 tokens) are the language's function words — 1–2 KB per language: Spanish `por de el la
que`, French `de le la à les`, Russian `в и на`, Chinese `的 在 是`. That is "what is common" with a giver, in a language the
tab has never searched in. Only priors **committed** in the khora (HEAD `cceb530`) are used — the language session's
untracked files are not stable and are not ours to build on. Committed: ar zh el en fa fi fr he ko la ru sa es tr.
**German and Japanese have no committed closed-class prior, so v3 must abstain there when it has no background.**

v3 = v2, plus: (1) a word is *common* if it is a function word of the language **or** (when ≥ 24 cards of learned background
exist) its learned share is over the v2 threshold; (2) with **no** learned background but a function-word list, the rule speaks
in a **stricter** mode — *when you cannot tell content from filler, demand all of it*: every content word of the question must
be on an on-topic card (`topicFrac = 1.0`) and ≥ 4 independent chains must agree (`minChains = 4`). No list and no background →
abstain. Evaluated on the same 48 non-English SERPs and the 28 English ones of Experiments A/B, once.

- **C1** (es fr ru zh, learned background k = 0): precision ≥ 90% **and** coverage ≥ 25% over the 24 answerable
- **C2** same languages: at most 1 of the 8 controls fires
- **C3** de and ja at k = 0 abstain on all 16 queries (no list, no background → no guessing)
- **C4** English (Experiment A data): v3 precision ≥ v2's and v3 coverage ≥ 0.95 × v2's
Any failure → that part is not adopted.

### Outcome of v2 and v3 (run once, frozen; English holdout #2 = 28 queries, other languages = 48 queries)

| rule | English holdout #2 | other languages |
|---|---|---|
| **v1** (as shipped) | fires 17/24, precision **17/17**, coverage 70.8%, controls 0/4 — a second holdout in agreement with the first | abstains (needs 80 cards) |
| **v2** (chains + Fisher placement) | **fires 0/24** | **0/36 at every background size k = 0…7** |
| **v3** (v2 + function words, strict mode) | **fires 0/24** | **0/24** in es fr ru zh at k = 0; abstains on all 16 de/ja queries as predicted |

**A1, A2, A4, B1, C1 are FALSIFIED.** (A3, B2, B3, C2, C3 and C4 pass only vacuously — a rule that never fires cannot misfire.)
v2 and v3 are not adopted.

**Why (read after the verdict, from the refusal messages — not used to tune anything):** on the 24 English answerable
questions v2 refused 12 times at the Fisher placement ("cairo" in 4 chains: p = 0.249; "edison" in 5 chains: p = 0.060),
7 times because fewer than 3 independent chains carried the question's rare words, 3 times because merging collapsed the
cards to fewer than 3 chains, and twice with no shared rare term. The placement cannot reach α = 0.05 with ≤ 8 cards: under
a null that lets every chain draw its terms from the pool, some term lands in 4 of 5 chains by chance often enough that a
real answer in 4 chains looks like chance. A max-over-pool statistic needs more witnesses than a search page holds. The
principle (a figure is a placement against a null) was not refuted; **this null, on this much evidence, has no power.**

### v4 — the one idea v2/v3 never got to test: ask the priors first. Frozen BEFORE any v4 outcome

v4 is **v1** (the rule that replicated) with three changes and nothing else:
1. **Function words are common** (khora POSPrior@1, committed priors: `fold-chat-function-words.js`): a function word of the
   language counts as share 1 whatever the learned background says.
2. **Little input (Chomsky/Sullivan):** the learned-background floor drops from 80 cards to 24 (three SERPs).
3. **No learned background but a function-word list → stricter mode** (`topicFrac = 1.0`, `minHosts = 4`): when content cannot be
   told from filler, demand all of it. No list and no background → abstain.

Run once on the SAME 48 non-English SERPs and the English ones (no v4 outcome has been looked at; v2/v3 gave 0/…).
- **D1** es fr ru zh at k = 0: precision ≥ 90% **and** coverage ≥ 25% over the 24 answerable
- **D2** same languages: ≤ 1 of the 8 controls fires
- **D3** de and ja at k = 0: abstain on all 16
- **D4** all six languages at k = 3 (three other same-language SERPs as background): precision ≥ 90%, coverage ≥ 25% over 36, ≤ 1 of 12 controls
- **D5** English: v4 precision ≥ 90% and fires on ≥ 16 of 24 (≥ 0.95 × v1's 17)
Any failure → that part is not adopted.

### Outcome of v4 (run once, frozen; no outcome had been seen before the criteria were written)

| criterion | result | |
|---|---|---|
| **D1** es fr ru zh, k = 0: precision ≥ 90% **and** coverage ≥ 25% | precision **5/5**, coverage **5/24 = 20.8%** (es 2, fr 2, ru 1, **zh 0**) | **fail** (one firing short of 6/24) |
| **D2** same languages: ≤ 1 of 8 controls fire | **0 / 8** | pass |
| **D3** de, ja at k = 0 abstain on all 16 | **16 / 16** abstained, 0 fired | pass |
| **D4** six languages, k = 3: precision ≥ 90%, coverage ≥ 25%, ≤ 1 of 12 controls | precision **11/11**, coverage **30.6%**, controls **2 / 12** (`frc1`→"romulus", `zhc2`→"传说") | **fail** (controls) |
| **D5** English: precision ≥ 90% and ≥ 16/24 fire | **18/24**, precision **18/18**, controls 0/4 (v1: 17/24) | pass |

Verdict by the standard written down first: **D1 and D4 fail, so v4's non-English support is not adopted.** English is a wash
(18 vs 17 firings is noise). What the numbers do say:

- **When the rule speaks it is right.** 16 of 16 non-English firings (5 at k = 0, 11 at k = 3) carried the answer; at k = 0 it
  fired on none of 8 controls and abstained where it had no list. The failure is *how rarely it speaks* at k = 0 (strict mode:
  every content word on a card, ≥ 4 sites) and, at k = 3, *what it will speak about*.
- **Chinese is a prior problem, not a rule problem.** The committed `pos-cmn` prior is Traditional-script
  (UD Chinese-GSD); DuckDuckGo returned Simplified, so most function words (为 与 这 …) are not in the list and zh never fired.
  The simplified prior (`pos-cmn-hans`) exists in the khora working tree but is not committed — not ours to build on yet.
  German and Japanese have no committed prior at all (v4 correctly abstained on all 16).
- **The two control fires are the uranium-238 failure again.** "Who was the first king of Mars?" → cards about Romulus (son of
  Mars, first king of Rome); "capital of Atlantis" (zh) → cards about the Atlantis legend. The cards agree on a rare term about the
  topic; no answer exists. A rule that checks *agreement* cannot see *absence*, in any language, with or without priors.
- **The oracle is the headline, across seven languages.** The answer is in the top-8 snippets for **all 36 of 36** answerable
  non-English questions (es fr de ja ru zh) and for 23 of 24 English holdout-#2 questions' worth of fired cards (v1/v4: 17–18/18
  right). Over every set so far — dev 50/50, holdout #1 23/24 (uranium-238 the exception), non-English 36/36 — a snippet contains
  the answer almost always. **The bottleneck is not finding the answer; it is knowing when to trust the cards.** Every rule above
  is an attempt at that decision, and each fails on questions with *no* answer. A rule that decides is the wrong shape; see
  "What next".

### What was learned from the archons, honestly

- **Bukhari / Fisher (v2):** the principles were not refuted, but this null on this little evidence (≤ 8 cards) cannot reach
  significance — a real answer in 4 chains looks like chance. Wrong tool at this scale.
- **Bayes / Chomsky / Sullivan (v3, v4):** asking the priors first **works as a safety property** — priors-based commonness gave
  100% precision on 16 firings in four languages the tab had never searched, and correct abstention where it had no prior. It did
  not buy coverage, and it did not fix the no-answer failure.
- v2/v3 are removed from the code (history keeps them: `872392c`). v4 stays as an **opt-in experimental rule** (`rule: "v4"`),
  because it is safe where it speaks; it is not enabled anywhere and not recommended until its prior and coverage problems are fixed.

### What next (not built)

1. **Do not decide; speculate and verify.** Hand the model the top snippets immediately (the oracle says the answer is there
   ~97% of the time), start the page reads in parallel, and let the pages *verify or contradict*: if no read page states the
   handed answer, say so. That removes the decision that every rule failed at, and it uses the reads as a witness (Bukhari's
   actual point) rather than as a gate. Needs a UI that can show an answer that is then confirmed or retracted.
2. A second sense (Sullivan): check the agreed term against a **fetched page** only for the one best card, not three — one
   confirming read instead of three.
3. Commit `pos-cmn-hans`, a German and a Japanese UD prior in the khora, then re-run D1 unchanged.
