# gold fixes made before the freeze

Gold regexes changed only where verification showed them wrong; otherwise only the canonical source changed. Nothing here was informed by pipeline output (the pipeline had not been run on the ask set).

- num7: GOLD CHANGED; Wikipedia now gives 7,088 km; traditional figures are 6,650/6,853 km: accept 6,xxx and 7,xxx km (sources disagree, and that is the point)
- num10: synth/arithmetic ask: the result (37.8) is by design not in the canon; verified by computation (100-32)*5/9 = 37.78 and by the formula in the Fahrenheit article (partial)
- sf7: canon changed; the Secretary-General article names no holder in its extract; the holder's own article does
- law8: GOLD CHANGED; canon changed; SS-5 is not named on the readable SSA/USA.gov pages; gold now asks for the means (online / mail / in person), verified there
- rec6: canon changed; original canon 404
- rec7: canon changed; original canon 404
- how3: canon changed; wikiHow answers bot requests with a JS 'Client Challenge' page; Wikipedia knot articles verify the keywords
- how4: canon changed; wikiHow Client Challenge; Bob Vila verifies
- how5: canon changed; wikiHow Client Challenge; Wikipedia verifies
- how6: canon changed; wikiHow Client Challenge; Bob Vila verifies
- how7: canon changed; wikiHow Client Challenge
- how8: canon changed; wikiHow Client Challenge; Bob Vila verifies
- how9: canon changed; wikiHow Client Challenge; Bob Vila verifies
- hlt4: canon changed; USDA/FSIS 403 to bots; Wikipedia states 165 F / 74 C
- prd5: canon changed; original canon 403
- prd6: canon changed; original canon 404
- law1: canon changed; travel.state.gov 403 to bots
- law2: canon changed; travel.state.gov 403 to bots
- law7: canon changed; original canon 404
- str4: canon changed; faq.usps.com is JS-rendered; usps.com/manage verifies
- str8: canon changed; travel.state.gov 403 to bots
- xl_F2_zh: canon changed; the zh.wikipedia lead is stale (300/320 m): a faithful snip of it would be WRONG against gold (kept as a real failure mode); verified on the official site
- cod8: canon changed; Stack Overflow 403; Wikipedia Vim article lacks :q!

Also: the F2 (Eiffel height) regex had a lookahead that failed for zh/ja (no space after the unit); corrected (regex bug, not a gold change).
