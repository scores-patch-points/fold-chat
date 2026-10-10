# G1 pre-registration (written BEFORE any run; corpus frozen)

Atom: understanding a request for generated output (type, topic through the thread, constraints, needsSources, void).
Corpus: `eval/ants/g1/corpus.mjs`, sha256 `01da1aef1884be951eedb2f49ec9d09ea1c5560e001fac07c2780a326d013291`, 135 cases
(108 asking for output across essay/poem/story/email/letter/speech/summary/outline/table/list/code/translation/rewrite/script/slogan/other,
27 negatives and lookalikes; es, fr, ru, de, zh; typos; anaphora; compound; no-topic; no-material; unsupported).
Split: 33 `dev` (I may read failures and tune on them), 102 `held` (not inspected case by case until the final measurement; any fix prompted by a held failure is reported as post-hoc).
No case is edited after the first run. Labels were written by me from the phrasing alone, before the classifier was run.

## What I predict is wrong TODAY (baseline = classifyTurn + planTurn, run unmodified)
B1. Non-English asks (es/fr/ru/de/zh), typos ("wrtie an esay"), nominal asks ("essay on the Roman Empire", "now a poem about it"),
    "I need an essay on…", "tell me a joke", "gimme a haiku" are MISSED (kind is not generate/compose/transform/code).
B2. FALSE generate: "how do I write an essay", "make sure you note that I'm allergic to nuts", and at least one more negative.
B3. The text that is SEARCHED for a generate turn is the instruction itself (or instruction + remnants) in >= 90% of generate cases that need sources.
B4. For the anaphoric asks after "who invented the telephone?" the search query is wrong (instruction words in it, or no "telephone") in >= 80%.
B5. Summarize-this after an answer is searched (web) rather than answered from the thread.
B6. Poems/jokes/stories/slogans are searched (needless search) in >= 80% of the cases where needsSources is false and the kind is `generate`.
A baseline number that is BETTER than predicted counts against me and is reported as such.

## What would refute the fix (fold-chat-outputtype.js `describeOutput`)
R1. On `held`: false "wants" on negatives >= 2 of 27 (all negatives are held except the 5 dev ones; counted over all 27).
R2. On `held`: exact type accuracy < 0.85.
R3. topic accuracy (every topicKey present in `topic`, and no instruction word as the topic) < 0.90 over cases with topicKeys; `searchQuery` is the topic (never contains the instruction verb/type noun) in every needsSources case, no exception.
R4. needsSources accuracy < 0.90; active-void exact match < 0.90.
R5. Any path where a model alone sets the type: a test must show a fake picker answering outside the closed list, or only once of two orderings, leaves the code's own type untouched.
R6. A gate whose deletion leaves the test file green (mutation check) is not a gate; each gate must make >= 1 test fail when removed.
R7. Existing tests (fold-chat-discourse, fold-chat-kinds, fold-chat-flow, fold-chat-thread) still pass after my edits to fold-chat-discourse.js.
R8. Real small model (gemma2:2b via local Ollama) as closed-list picker: if it picks a type outside the list or disagrees across the two orderings, the answer is DROPPED (this is the intended outcome); if it agrees and is wrong on a case with a gold type, that is reported as a model error caught or not caught.

## Amendment 1 (written after the first held measurement, before any fix)
First full run of `describeOutput` (v0) on the frozen corpus: dev 33/33 type, held 98/102 type, 14 held failures (post-hoc fixes follow).
I therefore wrote a SECOND corpus (`eval/ants/g1/corpus2.mjs`, 45 cases, sha256 in the file listing below) BEFORE touching the code again, as the generalisation check for the post-hoc fixes.
Fixes derived from the 14 held failures are reported as POST-HOC; corpus2 is the only number that is not.
corpus2 sha256: see `eval/ants/g1/corpus2.sha`.
Predictions for round 2 (written now): type exact >= 0.90, false wants <= 1/15, topic >= 0.85. If round 2 falls below, the round-1 numbers are overfit and I say so.

## Amendment 2 (written after round 2 was fixed to 100%, before any code ran on round 3)
Round 2 (45 cases) went 76% -> 100% type after I fixed what it showed me; it was SEEN, so it is no longer a held-out number. Round 1's 135 cases are the same.
Round 3 = `eval/ants/g1/corpus3.mjs` (79 cases, sha256 in `corpus3.sha`), written blind and adversarial: verb-final German, Spanish clitics, reported requests,
capability questions, gerunds, "500 words on X" with no type noun, "A haiku please", a thread with an interjected "when?", compound with periods.
I predict the CURRENT code scores type exact between 0.75 and 0.90 and false wants between 1 and 4 of 24 on round 3, and misses at least: the German verb-final ask,
the Spanish clitic asks, "500 words on photosynthesis", "A haiku please", "Draft a LinkedIn post", "Fix the grammar in this", "she asked me to write her a letter",
"hello, can you write essays?", "i need help writing an essay". Whatever round 3 shows is reported before I fix anything, and the numbers after fixing are labelled post-hoc.

## Amendment 3 (round 4, written blind after the round-3 post-hoc fixes; the code has not seen these)
`eval/ants/g1/corpus4.mjs` (sha256 in `corpus4.sha`): 64 cases. This is the number I will quote as the honest generalisation estimate.
Round-3 blind result (before its fixes): type exact 60/73 = 82%, false wants 3/24 (my prediction was 75-90% and 1-4; all nine named misses occurred).
Prediction for round 4, written before running: type exact 0.80-0.92, false wants 0-2 of 17. I expect to miss at least: "biography", "lullaby", "villanelle",
"product description", "reminder" (types outside the lexicon), "Quiero que escribas" (subjunctive), "J'aimerais", "comparing/arguing/set in" topics, "make a poem out of this",
and the multi-sentence "What should I include? Write me an outline…" (a question word in an earlier sentence blocks the verb).

## Amendment 4 (round 5, blind, last)
`eval/ants/g1/corpus5.mjs` (sha256 in `corpus5.sha`), 58 cases, written after the round-4 post-hoc fixes. This is the number I quote as the generalisation estimate.
Round-4 blind (before its fixes): type exact 50/61 = 82%, false wants 0/17, topic 78%. Prediction for round 5: type exact 0.85-0.95, false wants 0-3 of 20 (I expect "list all the countries in europe",
"compose yourself", "create a new account", "give me a minute" to be the risky ones).
