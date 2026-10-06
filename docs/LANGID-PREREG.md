# LANGID-PREREG — which language did the person write in? (pre-registration, written before any detector was run on the set)

Trigger. `fold-chat-lang.js` read "show me a cookie recipe" as Portuguese (Portuguese's hand-typed stopword list contains
`a` and `me`; English's list contains neither) and the live reply came back in Portuguese. The suite already has
language-identification work (ethos E1 char-n-gram NB, khora's POS-coverage `detectLanguage`, the per-language POS priors
`khora/native/priors/pos-*.json`, the ethos-derived function-word lists). This study measures the chat's current detector
and those candidates on short, chat-like asks and replaces the weakest link. Bars below are frozen before the first run.

## The test set (built before any detector ran)

* `eval/langid/asks.mjs` (authored by hand, labelled at writing: lower-case, little punctuation, some without diacritics,
  typos, loanwords, brand names, code-switching, imperatives, names-only), plus the 33 `e_multilingual` questions of
  `eval/cases.json` (labelled by the case's own `lang`) and the everyday asks of the scratchpad `everyday.mjs`.
  `eval/langid/build.mjs` writes `eval/langid/labelled.json`. A text written under two golds (an hr/sr/bs sentence all three
  write identically) accepts both. Frozen hash: `labelled.json` sha256 `a26dd8f148ff557f6a2fce9a3d5d9e0eb9e82535c7e50e8ee399222d4ac38e58`
  (676 asks, 42 language labels, 25+ scripts-and-languages beyond English).
* Classes: `en` (strict English, >= 3 words), `en-keyword` (English queries with no function word; English or unknown accepted,
  anything else is wrong), `cannot-tell` (names only, one token, numbers, symbols: the ONLY right answer is unknown),
  `lang` (non-English, gold = one code), `short` (2-3 word non-English), `code-switch` (matrix language or unknown),
  `no-prior` (languages the repo has no prior for: sw, tl, is, sq, eo; right answer unknown; reported, no bar).
* Closely related pairs, reported separately with NO bar: es/pt/it/ca, no/da/sv, hr/sr/bs (Latin), id/ms, hi/ur (Latin script),
  nl/af.
* Split by sha1 round-robin inside each (class, gold) cell into thirds: `dev` (tuning, free to look at), `val` (selection),
  `held` (touched once, at the end, for every candidate). I do not read `held` item-by-item before the final score.

## Definitions

A detector answers a language code or `unknown` (an answer is "confident" iff it is a code). Per ask: *correct* = answer in the
ask's accept list; *wrong-confident* = a code outside the accept list (worse than unknown); *abstain* = `unknown` where the
accept list has no `unknown`. *Answerable* = accept list has no `unknown`. Precision = correct confident / all confident
(over every class, including confident answers on `cannot-tell`). Coverage = confident / answerable.

## Candidates

A. the current `fold-chat-lang.js` (script + declared stopword counts).
B. ethos E1 `langid-v1` (char 1-3-gram NB, 462 classes, shipped profile; its own tau/phi gate; families folded to the chat's codes).
C. khora `language-grammar.js::detectLanguage` (share of words attested in each language's POS prior), Node only.
D. the new detector built from script detection + per-language priors derived from the khora POS priors (word-frequency
   naive Bayes with an out-of-vocabulary floor, diacritic-folded fallback, char n-gram for unseen words) behind the same API.
   D's thresholds are chosen on `dev`, checked on `val`; D's structure may change until `val` passes or I stop; `held` after.
   If nothing existing meets the bars, D ships as the best measured and the table says which bars it misses.

## Bars (frozen; none moves after seeing data)

1. English safety: on `en` and `en-keyword` asks, P(a non-English confident answer) <= 0.01 (>= 0.99 not-non-English).
   Includes the cookie-recipe class ("show me a cookie recipe", "cookie recipe please", "show me cookies", ...).
2. Overall precision on confident answers >= 0.95; coverage on `en`+`lang` asks that are not related-pair members >= 0.80
   (so "always unknown" cannot pass). Error and coverage are reported separately.
3. `cannot-tell`: unknown rate >= 0.90.
4. Caseless / CJK / Indic / Arabic / Hebrew / Thai script asks (text script Han, Kana, Hangul, Thai, any Indic, Arabic, Hebrew):
   precision >= 0.98 and coverage >= 0.95.
5. Speed: mean < 2 ms per ask and p95 < 2 ms on this machine, no network, no model, deterministic (two runs identical).
6. Follow-ups (unit tests, not this set): an elliptical follow-up in a thread (<= 3 words, no own language evidence) inherits
   the thread's last confident language in 100% of the scripted threads; a confident turn in another language flips 100%.
7. Unknown means: no language is named to the model (`languageInstruction` gives only the general rule).

Reported without a bar: per-language counts, Cyrillic/Greek (cased non-Latin) precision, each related-pair group (exact accuracy
on confident answers, family-correct rate, coverage), `short`, `code-switch`, `no-prior`.

Decision rule: the candidate wired is the one meeting the most bars on `val` (ties: fewer wrong-confident answers, then smaller).
Honest reporting: bars not met are reported as not met.

## Addendum A (written BEFORE the held-out run; the code and priors are frozen as of this paragraph)

What D is, as built: `fold-chat-langid.js` (script runs; naive Bayes over word + char 1-3-gram priors in `fold-chat-lang-priors.js`,
built by `scripts/build-lang-priors.mjs` from the khora's committed UD POS priors, 40 language priors, 617 KB) behind the unchanged
API of `fold-chat-lang.js` (+ `threadLanguage`, `{ prior }` options, `FAMILIES`, `sameFamily`). The old detector is kept in
`eval/langid/baseline/` and is candidate A.

Dev/val-time decisions and deviations (all on `dev`/`val`, never `held`):
* Candidates B (ethos E1 langid-v1) and C (khora `detectLanguage`) were scored on dev+val first: B: precision 94.1%, coverage 36.6%
  (its own tau/phi gate is calibrated for >= 8 words), 26 ms/ask; C: English safety 75.3%, precision 73.6%, cannot-tell 8.1%, ~4 s/ask
  (Node-only, reads 60 JSON files per call). Neither is vendorable (C imports `node:fs`) or good enough, so D was built.
* The first floor rule (per-language min-kept count) penalised Russian by ~5 nats per unlisted gram; replaced by one rule for every
  language (an unlisted form has probability ALPHA/N, ALPHA = 0.5). Galician dropped from the priors (stole pt/es). A "close family
  needs a bigger lead" margin was tried and REMOVED (no precision gain, lost coverage). Margin/weights were chosen on dev
  (margin 4 nats, gram weight 0.3, minFunctionWords 1, strongMargin 10, minFit 0.75, Cyrillic margin 2.5 / minFit 0.8, `¿ ¡` mark +8 nats
  for es). Longer Cyrillic/Arabic/Devanagari lists were built and measured (+0.2 points precision, +280 KB): rejected.
* Existing in-repo fixtures forced two fixes (`wikiEdition` Russian, `searchWeb` Spanish): they are the Cyrillic margin and the es/ca
  family-margin removal above.
* DISCLOSURE: while writing the first version of the unit tests I used sentences from `asks.mjs`, some of them held-out items; two
  of those failed (`muestrame una receta de galletas` -> unknown, a Persian ask -> unknown) and I SAW that. No detector change followed
  from them; the tests were rewritten on fresh sentences that are not in `labelled.json`. The held score below includes those two.

## Addendum B — held-out third, scored once (194 asks, `--held`), all four candidates

| bar | frozen | A old chat detector | B ethos langid-v1 | C khora detectLanguage | **D new** |
|---|---|---|---|---|---|
| 1 English safety (not non-English) | >= 99% | 90.0% (5/50 wrong, all pt) FAIL | 100% (but answers en on 32% of strict en) | 80.0% FAIL | **100% (0/50)**; strict en answered en 36/37 |
| 2 precision on confident | >= 95% | 84.0% FAIL | 94.4% (coverage 26%) | 72.8% FAIL | **94.96% (132/139) — misses by one answer**; coverage core 89.6% (bar 80%) PASS |
| 3 cannot-tell -> unknown | >= 90% | 100% | 100% | 16.7% FAIL | **100% (18/18)** |
| 4 caseless precision / coverage | >= 98% / >= 95% | 82.1% / 90.3% FAIL | 100% / 19.4% FAIL | 100% / 83.9% | **100% / 93.5% — precision PASS, coverage misses (2 of 31 abstain: Hindi, Persian)** |
| 5 speed | < 2 ms | 0.05 ms | 0.2 ms warm (26 ms/ask earlier run) | 338 ms FAIL | **0.10 ms mean, p95 0.33 ms** (cold first call 21 ms) |

D's 7 wrong confident answers on held: pt->it `qual e a capital da australia`, ms->id x2 (no Malay prior), sr->sl, ur(Latin)->mt,
a Tagalog ask -> id (no prior), and a code-switched `como se dice thank you en japones` -> en. Related pairs on held (exact / confident / n):
romance 17/18/21, nordic 7/7/9, malay 2/4/5, lowlands 3/3/4, southslavic 0/1/4, hindustani 0/1/5.
Not met on held: bar 2 precision (by one answer) and bar 4 coverage. Met: 1, 3, 5 and the coverage floor of bar 2. Bars 6-7 are unit tests (green).
