| # | case | failure class | BEFORE: what the current path draws (modelled) | AFTER: genVoid |
|---|---|---|---|---|
| 1 | net-screenshot | network | source strand drawn as the turn (3 snip(s)) **[quotes pages as the piece]** | network |
| 2 | net-good | network | source strand drawn as the turn (6 snip(s)) **[quotes pages as the piece]** | network + offer |
| 3 | net-poem-nosrc | network | typed gap: unreached | network |
| 4 | net-emptythread-service | no-topic | source strand drawn as the turn (4 snip(s)) **[quotes pages as the piece]** | no-topic |
| 5 | timeout-good | timeout | source strand drawn as the turn (1 snip(s)) **[quotes pages as the piece]** | timeout + offer |
| 6 | timeout-report-nopages | timeout | typed gap: unreached | timeout |
| 7 | ratelimit-good | rate-limit | source strand drawn as the turn (2 snip(s)) **[quotes pages as the piece]** | rate-limit + offer |
| 8 | ratelimit-story | rate-limit | typed gap: unreached | rate-limit |
| 9 | gate-good | gate | source strand drawn as the turn (1 snip(s)) **[quotes pages as the piece]** | gate + offer |
| 10 | gate-story | gate | typed gap: unreached | gate |
| 11 | sealed-letter | sealed | note: no sources for this kind | sealed |
| 12 | sealed-essay | sealed | source strand drawn as the turn (1 snip(s)) **[quotes pages as the piece]** | sealed + offer |
| 13 | nomodel-good | no-model | source strand drawn as the turn (6 snip(s)) **[quotes pages as the piece]** | no-model + offer |
| 14 | nomodel-nopages | no-model | typed gap: unreached | no-model |
| 15 | empty-good | empty | empty note | empty + offer |
| 16 | empty-poem | empty | typed gap: unreached | empty |
| 17 | refusal-sorry | refused | refusal note | refused + offer |
| 18 | refusal-asai | refused | refusal note | refused + offer |
| 19 | refusal-cannot | refused | typed gap: unreached | refused |
| 20 | stub-teaser | stub | model text shown as the answer | stub + offer |
| 21 | stub-oneliner | stub | model text shown as the answer | stub + offer |
| 22 | stub-colon | stub | model text shown as the answer | stub + offer |
| 23 | asked-real-coverletter | asked-instead | note: no sources for this kind | asked-instead |
| 24 | asked-topics | asked-instead | model text shown as the answer | asked-instead + offer |
| 25 | tutorial-real-service-1 | wrote-tutorial|off-topic-draft | model text shown as the answer | wrote-tutorial + offer |
| 26 | tutorial-real-service-2 | wrote-tutorial|off-topic-draft | model text shown as the answer | wrote-tutorial + offer |
| 27 | tutorial-synth | wrote-tutorial | model text shown as the answer | wrote-tutorial + offer |
| 28 | offtopic-synth | off-topic-draft | model text shown as the answer | off-topic-draft + offer |
| 29 | notopic-emptythread | no-topic | typed gap: unreached | no-topic |
| 30 | notopic-it | no-topic | typed gap: unreached | no-topic |
| 31 | notopic-pages-cannot-rescue | no-topic | model called; unknown | no-topic |
| 32 | notopic-bare | no-topic | typed gap: unreached | no-topic |
| 33 | nopages-essay | no-sources | typed gap: unreached | no-sources |
| 34 | nopages-report | no-sources | typed gap: unreached | no-sources |
| 35 | nopages-story-sourced | no-sources | typed gap: unreached | no-sources |
| 36 | meta-leverage-gradesfixer | meta-only | model text shown as the answer | meta-only |
| 37 | meta-service | meta-only | model text shown as the answer | meta-only |
| 38 | meta-tutorials-climate | meta-only | model text shown as the answer | meta-only |
| 39 | meta-report-guide | meta-only | model called; unknown | meta-only |
| 40 | meta-speech | meta-only | not a generate turn: compose | meta-only |
| 41 | wall-only | wall-only | model called; unknown | wall-only |
| 42 | wall-and-meta | meta-only|wall-only | model called; unknown | meta-only |
| 43 | offtopic-only | off-topic-only | model called; unknown | off-topic-only |
| 44 | mixed-network | network | source strand drawn as the turn (11 snip(s)) **[quotes pages as the piece]** | network + offer |
| 45 | unsupported-image | unsupported-type | typed gap: unreached | unsupported-type |
| 46 | unsupported-video | unsupported-type | typed gap: unreached | unsupported-type |
| 47 | unsupported-slides | unsupported-type | not a generate turn: chat | unsupported-type |
| 48 | owntext-coverletter | own-text-missing | note: no sources for this kind | own-text-missing |
| 49 | owntext-summary | own-text-missing | note: no sources for this kind | own-text-missing |
| 50 | owntext-reply | own-text-missing | not a generate turn: chat | own-text-missing |
| 51 | alone-poem | alone-barred | typed gap: unreached | alone-barred |
| 52 | type-unknown-widget | type-unknown | not a generate turn: chat | type-unknown |
| 53 | type-none | type-unknown | typed gap: unreached | type-unknown |
