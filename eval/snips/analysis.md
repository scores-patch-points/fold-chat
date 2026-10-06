# analysis (generated 2026-10-05T21:22:17.179Z)
asks judged: 221/221; answer-expected 199; gap/correction-expected 22

## funnel (all asks)

| stage | n | share |
|---|---|---|
| searched | 221 | 100% |
| searchOk | 221 | 100% |
| relay | 201 | 91% |
| engine | 20 | 9% |
| apiOnly | 0 | 0% |
| none | 0 | 0% |
| anyRead | 220 | 100% |
| anyStrand | 220 | 100% |
| shown | 190 | 86% |

relay delivered the final search for 91% (201/221; CI 86-94) (after one retry; remainder fell to a labelled browser-engine transport).

## headline: no-model answer by class (answer-expected asks; final = my reading)

| class | n | held gold in strand | shown & gold | yes | yes-with-trim | needs-model | failed | **no-model satisfied (yes+trim)** |
|---|---|---|---|---|---|---|---|---|
| recipe | 8 | 8 | 7 | 7 | 0 | 0 | 1 | 88% (7/8; CI 53-98) |
| how-to | 9 | 5 | 5 | 2 | 0 | 0 | 7 | 22% (2/9; CI 6-55) |
| definition | 9 | 8 | 8 | 2 | 7 | 0 | 0 | 100% (9/9; CI 70-100) |
| single-fact | 11 | 11 | 11 | 2 | 9 | 0 | 0 | 100% (11/11; CI 74-100) |
| number-unit | 11 | 8 | 8 | 0 | 8 | 1 | 2 | 73% (8/11; CI 43-90) |
| comparison | 8 | 4 | 4 | 0 | 4 | 0 | 4 | 50% (4/8; CI 22-78) |
| health | 9 | 7 | 7 | 0 | 6 | 0 | 3 | 67% (6/9; CI 35-88) |
| travel | 8 | 7 | 7 | 1 | 4 | 1 | 2 | 63% (5/8; CI 31-86) |
| product | 9 | 7 | 6 | 0 | 5 | 1 | 3 | 56% (5/9; CI 27-81) |
| history | 10 | 9 | 9 | 1 | 8 | 0 | 1 | 90% (9/10; CI 60-98) |
| science | 10 | 8 | 8 | 1 | 7 | 0 | 2 | 80% (8/10; CI 49-94) |
| law-civic | 8 | 7 | 7 | 2 | 4 | 1 | 1 | 75% (6/8; CI 41-93) |
| structured | 8 | 6 | 6 | 1 | 3 | 1 | 3 | 50% (4/8; CI 22-78) |
| code | 10 | 9 | 9 | 1 | 5 | 0 | 4 | 60% (6/10; CI 31-83) |
| news | 7 | 7 | 7 | 0 | 7 | 0 | 0 | 100% (7/7; CI 65-100) |
| cross-language | 54 | 51 | 48 | 15 | 33 | 0 | 6 | 89% (48/54; CI 78-95) |
| follow-up | 10 | 6 | 3 | 1 | 2 | 0 | 7 | 30% (3/10; CI 11-60) |

**overall (all answer-expected)**: 74% (148/199; CI 68-80); strict "yes": 18% (36/199; CI 13-24); English everyday classes only: 71% (95/133; CI 63-78); conditional on a search having returned results: 74% (148/199; CI 68-80)

## gap-expected asks (live-data, unanswerable, false-premise, volatile news)

| class | n | typed gap (correct) | leak (strand shown) | dangerous-wrong |
|---|---|---|---|---|
| live-trap | 10 | 10 | 0 | 0 |
| news | 2 | 2 | 0 | 0 |
| unanswerable | 10 | 3 | 6 | 1 |

all: typed gap 68% (15/22; CI 47-84); leak 27% (6/22; CI 13-48); dangerous 5% (1/22; CI 1-22)
volatile gate (G1) fired on 13 gap-expected asks; without it the strand would have been shown on 13 and asserted a trap-pattern figure on 8.

volatile gate confusion (control): {"liveN":12,"liveCaught":12,"restN":209,"restFlagged":1,"flaggedIds":["una6"],"missedIds":[]}

answerable asks that got a typed gap: 16/199 {"off-topic":15,"no-readable-source":1}

## gate G3 (coverage floor 0.6, pre-registered)

fired on 15 answerable asks (gold WAS in the held strand for 8 of them: over-refusal) and on 2 gap-expected asks (correct). Over-refused: rec4, trv3, prd7, law1, xl_F2_es, xl_F1_fr, xl_F6_ru, xl_F1_hi, xl_F6_hi, fu1, fu6, fu7, fu8, fu9, fu10

exploratory sensitivity (not a tuned bar): floor -> answerable asks refused although gold was held / gap-expected asks not caught (strand shown) / of those shown, ones I read as dangerous

| floor | refused with gold held | gap-expected shown | dangerous shown |
|---|---|---|---|
| 0 | 0 | 9/22 | 1 |
| 0.3 | 1 | 7/22 | 1 |
| 0.4 | 2 | 7/22 | 1 |
| 0.5 | 2 | 7/22 | 1 |
| 0.6 | 8 | 7/22 | 1 |
| 0.7 | 16 | 7/22 | 1 |
| 0.8 | 26 | 5/22 | 1 |

## rungs (answer-expected asks; each rung's strand on its own, gold same-snip rule)

| rung | asks where it produced anything | of those: gold present | gold present / all answer asks | median chars |
|---|---|---|---|---|
| aStruct | 43 | 81% (35/43; CI 67-90) | 18% (35/199; CI 13-23) | 3183 |
| aDesc | 188 | 62% (117/188; CI 55-69) | 59% (117/199; CI 52-65) | 427.5 |
| b | 114 | 75% (85/114; CI 66-82) | 43% (85/199; CI 36-50) | 651.5 |
| c | 198 | 80% (159/198; CI 74-85) | 80% (159/199; CI 74-85) | 2128 |
| cNoLead | 198 | 74% (147/198; CI 68-80) | 74% (147/199; CI 67-79) | 2048 |
| d | 196 | 74% (145/196; CI 67-80) | 73% (145/199; CI 66-79) | 1344 |

S1 strand (policy) gold present: 84% (168/199; CI 79-89); ladder-or-lexical oracle (any rung): 91% (181/199; CI 86-94)
S1 gold-bearing snip comes from rung: {"a.recipe":8,"a.howto":2,"c":129,"b":79,"a.faq":13,"a.qa":11,"a.product":1} (an ask can count under several)

## coverage vs number of sources read (S1 policy on the first k read pages)

| k | gold present | CI |
|---|---|---|
| 1 | 122/199 | 61% (122/199; CI 54-68) |
| 2 | 157/199 | 79% (157/199; CI 73-84) |
| 3 | 165/199 | 83% (165/199; CI 77-88) |
| 5 | 168/199 | 84% (168/199; CI 79-89) |

## short-answer span (answered asks, n=166)

answer-bearing snip <= 400 chars: 25% (42/166; CI 19-32); the answer sentence <= 300 chars: 95% (145/153; CI 90-97); median snip 573 chars, median answer sentence 81 chars, p90 snip 704; the FIRST snip of the strand holds the gold: 70% (116/166; CI 63-76)
chars shown per strand: median 1990, p90 2390

## snip relevance (snips shown in non-gapped strands)

automatic proxy 88% (671/760; CI 86-90); with my reading where I labelled the snips 66% (501/760; CI 62-69); hand-labelled snips only 58% (319/548; CI 54-62)
judge control (token rule only): accepts 84% (722/858; CI 82-86) of true snips; 0% (2/858; CI 0-1) of snips shuffled across asks; 2% (18/858; CI 1-3) shuffled within a class
gold-regex control: gold of ask i matched against the strand of another ask j: 1075/39402 (2.73%)

## verbatim check (all candidate snips, n=3683)

check 1 (snip text == page text at its offsets / == a declared source string): 0 failures. entity residue (raw &#...; left in a snip by the app's tag stripper): 360. snips not found in the cached raw page's visible text after whitespace/entity normalisation: 1358.

corroboration of every candidate snip against the cached raw page (visible text; per block for prose):

| kind | n | found exactly | whitespace only | entity residue | literal \u escape | not in visible text |
|---|---|---|---|---|---|---|
| prose | 1683 | 1261 | 0 | 315 | 21 | 86 |
| a.meta | 315 | 52 | 7 | 3 | 0 | 253 |
| a.article | 244 | 50 | 12 | 1 | 0 | 181 |
| a.faq | 39 | 13 | 10 | 2 | 0 | 14 |
| a.qa | 174 | 94 | 37 | 2 | 0 | 41 |
| a.howto | 6 | 2 | 0 | 0 | 0 | 4 |
| a.event | 85 | 0 | 0 | 0 | 0 | 85 |
| a.product | 15 | 13 | 0 | 0 | 0 | 2 |
| a.recipe | 29 | 6 | 3 | 2 | 0 | 18 |

## cross-language (six shared facts; gold same-snip; S1 strand held)

| lang | n | search ok | read ok | gold in strand | no-model satisfied | gapped |
|---|---|---|---|---|---|---|
| en | 6 | 6 | 6 | 100% (6/6; CI 61-100) | 100% (6/6; CI 61-100) | 0 |
| es | 6 | 6 | 6 | 83% (5/6; CI 44-97) | 83% (5/6; CI 44-97) | 1 |
| fr | 6 | 6 | 6 | 100% (6/6; CI 61-100) | 83% (5/6; CI 44-97) | 1 |
| de | 6 | 6 | 6 | 100% (6/6; CI 61-100) | 100% (6/6; CI 61-100) | 0 |
| zh | 6 | 6 | 6 | 100% (6/6; CI 61-100) | 100% (6/6; CI 61-100) | 0 |
| ru | 6 | 6 | 6 | 100% (6/6; CI 61-100) | 83% (5/6; CI 44-97) | 1 |
| ar | 6 | 6 | 6 | 100% (6/6; CI 61-100) | 100% (6/6; CI 61-100) | 0 |
| hi | 6 | 6 | 6 | 83% (5/6; CI 44-97) | 67% (4/6; CI 30-90) | 2 |
| pt | 6 | 6 | 6 | 83% (5/6; CI 44-97) | 83% (5/6; CI 44-97) | 0 |
| ja | 6 | 6 | 6 | 100% (6/6; CI 61-100) | 100% (6/6; CI 61-100) | 0 |

English: 100% (6/6; CI 61-100); non-English pooled: 94% (51/54; CI 85-98)

per fact (non-English pooled): F1 9/9, F2 7/9, F3 9/9, F4 9/9, F5 9/9, F6 8/9

## follow-ups (resolveQuestion carry)

resolved: gold in strand 60% (6/10; CI 31-83); resolution reasons: [["fu1","carried"],["fu2","has-own-entity"],["fu3","carried"],["fu4","carried"],["fu5","has-own-entity"],["fu6","names-its-own"],["fu7","carried"],["fu8","carried"],["fu9","carried"],["fu10","carried"]]
unresolved control runs: 10

## structured material in the pages that were read

pages read OK: 866 (594 with raw HTML; the rest Wikipedia plain-text extracts); schema.org types seen on pages (pages carrying the type): Organization 274, WebPage 238, BreadcrumbList 232, Person 231, Article 159, NewsArticle 69, Question 63, FAQPage 56, VideoObject 55, AggregateRating 34, Review 31, BlogPosting 30, Recipe 29, ItemList 11, Product 9, Offer 8, DefinedTerm 7, QAPage 7, HowTo 6, Event 1

| structured rung | snips in S1 | asks | gold-bearing |
|---|---|---|---|
| a.qa | 23 | 21 | 11 |
| a.faq | 21 | 19 | 14 |
| a.recipe | 11 | 8 | 11 |
| a.product | 5 | 4 | 1 |
| a.howto | 2 | 2 | 2 |
| a.event | 2 | 1 | 0 |

## failure clusters

page reads: 87/953 failed (9% (87/953; CI 7-11)); by status {"200/200":3,"403/403":33,"0/200":15,"0/403":25,"0/402":2,"0/520":2,"0/500":1,"0/530":2,"401/401":1,"403/200":1,"0/526":1,"0/502":1}; hosts failing most: reddit.com 10, stackoverflow.com 8, britannica.com 6, travel.state.gov 5, worldatlas.com 4, mayoclinic.org 4, tools.usps.com 4, accuweather.com 2, autozone.com 1, lowes.com 1, kbb.com 1, apartmenttherapy.com 1
boilerplate-pattern snips among shown snips: 7% (55/760; CI 6-9) across 38 asks; pages that read OK but < 600 chars: 57

## latency of snip mode (no model; network time = the original live latencies recorded in the cache, summed per ask; excludes the harness's 1.1 s politeness gaps and the 5 s retry sleep)

network per ask: median 12499 ms, p90 49092; of which search median 3722, page reads median 4921; snipping compute median 446 ms (p90 6481).

## all 221 asks by final label

{"yes":36,"failed":46,"yes-with-trim":113,"needs-model":5,"gap-correct":15,"dangerous-wrong":1,"leak":5}

confident wrong snips shown on asks (my reading, WRONG-CONTENT tag): sci1, fu5; asks where the UNGATED strand would have been dangerous (WOULD-BE-DANGEROUS): liv2, liv5, liv6, una5

asks whose gold-bearing snip is a declared Q&A pair (FAQPage or QAPage/Question; the same pair is often declared twice): 14 -> {"number-unit":2,"travel":3,"product":1,"history":1,"structured":2,"code":1,"cross-language":4}
asks whose gold-bearing snip is a Wikipedia lead (rung b): 79 -> {"definition":7,"single-fact":10,"number-unit":4,"travel":1,"product":1,"history":8,"science":3,"law-civic":2,"structured":2,"news":5,"cross-language":33,"follow-up":3}
gold-bearing rung(s) per answered ask: {"a.recipe":8,"a.howto":2,"c":66,"b":21,"multiple":66,"a.faq":2,"a.product":1}

## transports (what each number was measured on)

final search transport per ask: {"relay":201,"engine:brave/chromium":14,"engine:ddg/node":6} (relay = node fetch to the Cloudflare relay; engine:* = a browser-engine search after two relay failures)
browser-engine fallback attempts: {"brave/chromium":{"tried":20,"ok":14,"why":{"page.goto: Timeout 20000ms exceeded.":2,"page.goto: net::ERR_NETWORK_CHANGED at https://search.brave.com/search?q=%D0%9A%D0%B0%D0%BA%D0%B0%D1%8F%20%D1%81%D1%82%D":1,"HTTP 429":3}},"ddg/chromium":{"tried":6,"ok":0,"why":{"page.goto: Timeout 20000ms exceeded.":2,"HTTP 403":4}},"ddg/node":{"tried":6,"ok":6,"why":{}}}
page reads by transport set (n/ok): {"chromium":{"n":482,"ok":482},"chromium+node":{"n":198,"ok":111},"node":{"n":272,"ok":272},"node+chromium":{"n":1,"ok":1}}
relay single-attempt probe on 30 fresh queries, node transport: 11/30 ok, statuses {"200":11,"502":19}

## by language (all non-English + English asks, answer-expected)

| lang | n | gold held | G3-gapped | satisfied | median shown chars |
|---|---|---|---|---|---|
| en | 141 | 115 | 8 | 98 | 1991 |
| es | 8 | 6 | 2 | 6 | 1906 |
| fr | 6 | 6 | 1 | 5 | 2292 |
| de | 6 | 6 | 0 | 6 | 2320.5 |
| zh | 8 | 7 | 1 | 7 | 1939 |
| ru | 6 | 6 | 1 | 5 | 1508 |
| ar | 6 | 6 | 0 | 6 | 1575 |
| hi | 6 | 5 | 2 | 4 | 1456.5 |
| pt | 6 | 5 | 0 | 5 | 2005.5 |
| ja | 6 | 6 | 0 | 6 | 1882 |

prose segment length (chars) in shown strands by script: {"en":{"n":1714,"median":111,"p90":309,"max":24000},"zh":{"n":158,"median":56,"p90":131,"max":699},"ru":{"n":63,"median":94,"p90":276,"max":550},"ar":{"n":69,"median":103,"p90":273,"max":667},"hi":{"n":40,"median":93.5,"p90":512,"max":24000},"ja":{"n":135,"median":58,"p90":176,"max":329}}
