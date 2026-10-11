# Results — Wikipedia → origin (2026-10-06)

Live, reproducible: `node eval/origin/survey.mjs` and `node eval/origin/meaning-coverage.mjs` (they need the network; Wikipedia rate-limits — they wait and
retry). Predictions were not pre-registered for this first measurement; it is a baseline, appended to, never edited.

## 1. Does a Wikipedia sentence reach an origin? (`survey.mjs`, first 5 lead sentences of 6 articles, 30 sentences)
Articles: Marie Curie, Apollo 11, Nashville, Monarchy of the UK, Eiffel Tower, Charles III. Rungs 1 (consequence) only — no asker's frame.

| outcome | n | meaning |
|---|---|---|
| origin | 1 | a footnote's page was read and carries the claim (Marie Curie 1911 → nobelprize.org, address `origin#230-521`) |
| no-reference | 13 | the sentence stands under no footnote (leads seldom cite) — SIG, a refusal |
| unsupported | 11 | footnote pages were read and none carries the claim |
| unlocated | 3 | the extract's sentence could not be found in the article's markup |
| unread | 2 | every footnote page failed to read |

Why the 14 read pages did not support the claim (typed): `name` 3, `figure` 3, `unread-structure` (negation / comparison) 3, `terms` 2, `no-overlap` 2,
`cross-language` 1. Plus **7 footnote pages could not be read at all** (blocked, a PDF viewer shell, dead). So wording (`terms`, the paraphrase case) was
**2 of 14** — synonyms would have changed at most that.

## 2. How much synonymy does the reading's own hyperlexicon earn? (`meaning-coverage.mjs`, whole articles)
The relation reader (vendored khora `relations.js`, `minSurfaces: 2`) admits verbs by recurrence; two labels in one (end1, end2) slot is the only place a
synonym could be earned (the user's rule: same slot in equivalent claims).

| article | chars | verbs | notes | slots | slots with 2+ labels |
|---|---|---|---|---|---|
| Marie Curie | 44,312 | 17 | 103 | 103 | 0 |
| Apollo 11 | 81,545 | 43 | 369 | 368 | 1 (`the\|area → landing, recovery`) |
| Nashville, Tennessee | 85,817 | 33 | 305 | 305 | 0 |
| Charles III | 68,509 | 32 | 247 | 246 | 1 (`was\|that → announced, reported`) |
| Monarchy of the UK | 60,049 | 31 | 267 | 265 | 2 (`monarch / king` — nouns, not synonyms) |
| Eiffel Tower | 44,988 | 15 | 97 | 97 | 0 |

On a lone claim plus one page the reader admits **0** verbs. **Measured null:** on a single turn the ledger earns essentially no synonymy; the pairs it
does find are not synonyms. The relation reader's own noise is visible (`physicist`, `family`, `station` admitted as "verbs"). Hence `fold-chat-meaning.js`
is built, tested on a hand-built ledger, and OFF unless a caller passes a ledger.

## What would change this
A corpus of real turns where a session-level ledger (many pages, many turns) earns pairs that the strict check then confirms; or a received synset prior
(`word-meaning.js` exists only in the legacy repos and would need migrating into khora — the user's call). The bound rung (frame) already sidesteps
verbs for slot asks. Re-run both scripts and append a dated section below.
