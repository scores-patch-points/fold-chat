# G1 results — understanding the request for generated output (2026-10-07)

Atom: what OUTPUT does a turn ask for (type, topic resolved through the thread, constraints, needsSources, searchQuery, typed void)?
Built: `fold-chat-outputtype.js` (pure, no model) + `fold-chat-outputtype.test.mjs` (31 tests); `classifyTurn` in `fold-chat-discourse.js` now asks it
(+ `GENERATE_CREATIVE_NUDGE`, 14 discourse tests); `eval/ants/g1/wire.diff` (UNAPPLIED, for fold-chat.js). Pre-registration: `G1-PREREG.md` (four amendments, each written before the run it governs).

## 1. What tripped the old classifier (measured BEFORE I changed anything)
`classifyTurn` + `planTurn`, unmodified, on the 135 frozen round-1 phrasings (`g1/baseline-output.txt`), then on all 371 phrasings of five rounds (`g1/baseline-vs-new.json`):

| measure (371 phrasings, 268 ask for output, 103 do not) | old | new |
|---|---|---|
| asks for output that are read as output | 58.6% (157/268) | 99.3% (266/268) |
| false "generate / compose / transform / code" on non-requests | 13.6% (14/103) | 0% (0/103) |
| non-English asks (es, fr, ru, de, zh) read as output | 0% (0/29) | 100% (29/29) type-exact |
| search text for output that needs sources: contains an instruction word ("write", "essay", "poem"…) | 72.9% (62/85) | 0% (0/85) |
| …contains the topic and no instruction | 27.1% (23/85) | 100% (85/85) |
| anaphoric asks ("write me an essay on this") whose query carries the thread's topic | 3.8% (1/26) | 100% (26/26) |
| poems / stories / jokes / taglines / personal writing that are searched although they ground in nothing | 82.1% (138/168) | 0 (all 168 read `needsSources:false`) |

The causes, in the order they cost the most:
1. **The query is the instruction.** `planTurn` treats "write me an essay on this" as an elliptical follow-up (it has "this") and searches the first words of the ask plus the earlier ask's content words: `write essay invented telephone` (reproduced on the real page, section 5). For a plain "write an essay about dolphins" the query is the whole sentence. Nothing in the pipeline had a notion of the topic apart from the instruction.
2. **`GENERATE_RE` is a verb within 40 characters of a noun.** No word order, no language, no typos, no nominal asks ("essay on the Roman Empire", "I need an essay…", "tell me a joke", "now a poem about it"), and no way to say "this is a question ABOUT writing": it fired on "how do I write an essay", "make sure you note that…", "why did he write the letter", "is it ok to write in first person", "how to write a cover letter".
3. **Every generate turn is searched.** Poems, jokes, taglines were front-loaded with a web search and then briefed "work ONLY from the sources" (GENERATE_NUDGE). The real-data check below shows the same: `eval/cases.json` marks the three creative cases `expect.search:false`, the old classifier searches all three.
4. **A summary / list / table of a named thing is a lookup**, but was routed as chat or research with the whole sentence as the query; an own-text transform ("summarize this" after an answer) was searched.
5. **No typed void.** Nothing said "no topic", "no material", "unsupported type" before the search ran.

## 2. What I built (smallest honest change)
`describeOutput(turn, { prior, hasMaterial })` returns `{ type, form, typed, topic, topicVia, constraints, needsSources, searchQuery, material, voidIfMissing, steps, sequence, wants }`.
Types: the brief's list plus `rewrite` (a proofread / "make this shorter" has a different void from a translation or a summary). Code decides; the model is never asked unless the code is undecided (section 4).
It is gates, each with a test that fails without it (mutation check, section 3):

| gate | rule | measured example it removes |
|---|---|---|
| G1 question-frame | a wh-word, auxiliary, modal or negation before the verb, **in the verb's own sentence**, is not a request | "how do I write an essay", "should I draft the email", "I can't write today" |
| G1b/c | a reported request ("she asked me to write…"), a first-person declaration ("I will draft…") is not a request, unless it wants/needs | "my teacher told me to write an essay on Hamlet, any ideas?" |
| G2 between-words | a pronoun / "sure" / "which" between verb and noun is not an object | "make sure you note that I'm allergic" |
| G3 particle | "write down / off / back" | "write down the poem I just thought of" |
| G4 existing work | a retrieval lead + "the" + noun + Title is a lookup | "give me the poem Ozymandias" |
| G5 code first | `codeShape` (fold-chat-kinds.js) is the one definition of a programming ask | "write a poem about python" stays a poem |
| G6 deictic resolution | "this / it / that / the above / out of this / about it" is resolved through the thread (an earlier request's topic, else the earlier ask minus its question frame, skipping fragments like "when?") or is a typed gap, never searched | the original failure |
| G7 closed pick | a model may only pick from the closed list, twice in two orders, and the pick must fit the evidence | section 4 |
| G8 capability question | "can you write essays?" | |
| G9 writing guides | a page teaching HOW TO WRITE the piece is set aside; if nothing else is left the gap is `nothing-found` | the tutorial paragraph of the failure |
Plus typo tolerance (one edit; never the first or last letter; never a real near-word: wrote, composed, better), head-final compounds ("comparison table" is a table), per-noun subject words ("between", "for", "where", "comparing", "set in", "of"), constraints (length, tone, audience, language, count, format) cut out of the topic, compound asks by connector (`steps`, `sequence`).

## 3. Numbers — the honest ones are the FIRST run on each blind round
Corpora (all mine, written from the phrasing alone, labels frozen before each run, sha256 in the files): R1 135 (33 dev, 102 held), R2 45, R3 73, R4 61, R5 57 = 371 phrasings; 268 ask for output across essay/poem/story/email/letter/speech/summary/outline/table/list/code/translation/rewrite/script/slogan/other, 103 are negatives and lookalikes; es, fr, ru, de, zh; typos; anaphora; compound; no-topic; no-material; unsupported.

| round | status | exact type | false "wants" | recall of "wants" | topic |
|---|---|---|---|---|---|
| R1 held (102) after tuning on 33 dev only | first run | 96% (98/102) | 1/22 | 98% | 87% |
| R2 (45) | first run, **overfit check**: written after R1 was fixed | **76%** (34/45) | 3/15 | 83% | 72% |
| R3 (73) | **blind** first run | **82%** (60/73) | 3/24 | 82% | 96% |
| R4 (61) | **blind** first run | **82%** (50/61) | 0/17 | 75% | 78% |
| R5 (57) | **blind** first run | **95%** (54/57) | 2/20 | 97% | 92% |
| R3+R4+R5 pooled blind | | **85.9%** (164/191) | 5/61 | | |

My own round-1 number (96%) was overfit; the blind rounds say **about 86% exact type on phrasing I had not designed for**, with false "wants" about 8% of negatives, and that is the number to believe. After each round I fixed what it showed and every number on a SEEN round is post-hoc: R1–R5 now read 100% exact type, 0 false wants, except one case where I disagree with my own label (`list all the countries in europe`: read as a list that needs sources; I labelled it a non-request). The fixes are listed in section 6.
Other fields on the blind first runs: needsSources 95/85/97% (R3/R4/R5), searchQuery never contained an instruction word, voids 100/91/97%, constraints 100%.

Mutation check (`g1/mutate.mjs`): **34/34 mutants killed** (each gate above, and each sub-rule, deleted in turn; the 31 tests must fail). It found three rules that were dead or harmful, which I deleted: a "thank you" exception that never ran, a want-lead modifier check that rejected "I want a really good essay", and (re-added) the count-noun gate, without which "give me tips to fall asleep" became a list instead of advice (`fold-chat-kinds.test.mjs` caught it).
Regression suite: 81 tests green across fold-chat-outputtype, -discourse, -kinds, -flow, -thread. Cost: 0.22 ms per `describeOutput`.

Real data, independent of me: `eval/cases.json` (73 cases written by others, with their own `expect.search`): the old classifier agrees on 70/73 first turns, failing exactly the three creative cases (poem, story, haiku are searched); `describeOutput` agrees on 80/83 turns (all turns of the multi-turn cases), the three it does not are greetings, outside this atom (`g1/real-cases.mjs`).

## 4. The model's part: a closed pick, checked
Only a description the code leaves `undecided` (a placeholder noun: "write me something about dolphins") may go to a model; `pickType` asks twice with the options in opposite orders and keeps the answer only if both orders give the same item of the closed list, it is not "none", and the evidence allows it (code needs code, translation needs a language). 12 real asks to gemma2:2b (`g1/pick-real-gemma2-2b.txt`, no thinking model; qwen2.5:14b is not installed here): 4 picks kept (3 right, 1 questionable: "write me anything" → story), 7 dropped because the two orders disagreed (position bias: "poem" then "story" for the same ask), 1 dropped because the answer was empty. The check caught position bias; it did not catch a consistent but arbitrary pick ("anything" → story).

## 5. Real page (Fold :8815, gemma2:2b, real web search, `g1/live.mjs`)
"repo" = the page as the repo stands (my `classifyTurn` change live, `fold-chat.js` not rewired). "wired" = the same page with `fold-chat.js` replaced in the BROWSER ONLY by the file `wire.diff` produces (nothing on disk changed).

| turn | repo (not wired) | wired |
|---|---|---|
| "who invented the telephone?" → "write me an essay on this" | searched **`write essay invented telephone`**; the turn drew a gap (the 502 that day) | searched **`who invented the telephone`** (Wikipedia + web); gemma2:2b wrote an essay about the telephone from those pages |
| "write me an essay on this" in an empty chat | searched the literal `write me an essay on this` | NO search; "I can't write the essay: the request names no topic." (G2's genVoid, fed my shape) |
| "write a short poem about autumn rain" | searched `write a short poem about autumn rain` | NO search; the poem was written |
| "what is the capital of Peru?" → "now a haiku about it" | searched `Peru Lima now a haiku about it` | NO search; haiku written |

Two things the live run found that no unit test could: (1) the first wired run refused the poem with `model-never-alone` — Gary's door reads `materialInView`, a second place besides `aloneBarred` that has to read the same "may write alone" flag (the diff now defines `mayWriteAlone` once and uses it in both; first run kept as `live-wired-v1-before-alone-fix.*`); (2) one essay run timed out in the model (gemma2:2b, upstream timeout) and the page showed "turn failed … Nothing was written" with a retry, which is the honest outcome, not the tutorial paragraph; a second run wrote it. The model's essay quality is not my atom and I did not score it.

## 6. What the post-hoc fixes were (so the overfit risk is visible)
Subject words per noun ("for", "between", "where", "set", "comparing"); head-final compounds; a sentence-scoped question frame; modal/negation/reporting/declaration gates; a deictic after "out of / from"; gerunds after "help" ("help me writing"); German verb-final infinitives; Spanish/French/Russian clitics and a few forms ("escribirme", "j'aimerais", "заявление"); social "post"; "N words on X"; "A haiku please"; ambiguous verbs that are also nouns ("a list of"); `thank you` speech; public-recipient letters need facts, personal ones do not; a container noun ("a talk") is not a subject. Each is a few words of declared vocabulary or one rule; none was a regex per test case, but a reader should expect the next blind round to find the next handful.

## 7. What I did NOT do
- I did not wire `fold-chat.js` (vetoed): `g1/wire.diff` is unapplied; it applies cleanly (`patch` reproduces the patched copy byte for byte) and I ran it on the real page by replacing the file IN THE BROWSER only (section 5).
- I did not draw the void (G2's `fold-chat-genvoid.js` does; I emit `genVoidShape(desc)` and gap objects that stringify to their names, which is what its `normOutputType` reads). `voidsAfterSearch` only decides `nothing-found` and sets writing guides aside.
- No stored sessions were mined (they live in browser localStorage, not on disk); phrasings come from the repo's tests, eval/cases.json, docs and my own writing. Every corpus is author-written: a person types differently.
- Not read: Arabic, Hindi, Japanese, Korean (zh has three patterns only), inflected Russian beyond the forms listed, German separable verbs, Spanish subjunctive beyond two forms, a request whose type noun is not in the lexicon (the fold treats it as no request: "write a villanelle" was missed until I added the word).
- A conversion of the last answer ("make it an essay", "turn that into a table") re-searches the topic rather than rewriting the earlier answer from its own sources; a compound ask is split only at connectors ("then", "and", "y luego"), not at sentence ends; `kindOfOutput` maps a counted "5 tips" to advice (no opinion) by a word list.
- A poem with needsSources:false means the model writes alone; whether the model may speak alone is the boss's / G2's decision (`ALONE_KINDS = []` in fold-chat-gaps.js today). The wire.diff exempts only creative pieces with no active typed gap, and says so in a comment.
- No `git add`, `commit` or `push`; no browser-pane tools; no thinking model.
