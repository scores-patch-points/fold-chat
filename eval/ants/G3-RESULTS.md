# G3 results — incorrect grounding carrying across messages (2026-10-07)

Pre-registration: `eval/ants/G3-PREREG.md` (written before any run). Everything below is reproducible from `eval/ants/g3/` (`trace.mjs`, `measure.mjs`, `mutate.mjs`, `probe-move.mjs`, `repro.mjs`).

## 1. The trace: each symptom to its cause

The reproduction is one stored chat: (1) `write me a song about trampolines` -> assistant text EMPTY; (2) `who is mt. mckinlet named afer?` -> answered as a song; (3) `why is the sky blue` -> searched with McKinley carried, read William_McKinley / "the blue room" pages.

| Symptom | Cause (file : mechanism) | Evidence |
|---|---|---|
| (3) a self-contained ask inherits the last referent into the SEARCH QUERY and the passages | `fold-chat-mind.js resolveQuestion` gates the carry on the ethos `carryTriggers` prior (`fold-chat-hints.js`, generated). The English list contains **"the"**, "one", "there", "it's". "why is the sky blue" has no capital, 5 segments (< 9) and an article, so it counted as pointing back; `searchQueries` then prepended the record's top-2 referents. | `trace.mjs`: plan `kind: carried`, `search: "Denali William McKinley why is the sky blue"`. Real page, user's state replayed (seeded `s.referents` built by the real `admitReferents`), real search backend shim, gemma2:2b: searchQ **"William McKinley Blue Room why is the sky blue"**, notice "Read your question as being about William McKinley and Blue Room.", pages read **List_of_Glee_characters, List_of_Duke_University_people, List_of_2025_albums** (`repro-before-seeded-shim.json`). |
| (2) the factual ask answered as a song | `fold-chat-channels.js modelHistory` omits an assistant turn that wrote nothing but KEEPS the user's ask, so the model's history was `[user "write me a song about trampolines", user "who is mt. mckinlet named afer?"]`; `conversationVerbatim` (<= 1600 chars) sends the whole short exchange. A song that WAS written rides the same way. | `trace.mjs` prints exactly that history. Real page, song-only seed, 2 runs: the model's request holds the song ask and **gemma2:2b writes a trampoline song as the draft 2/2** (`repro-style-before-{1,2}.json`). |
| (3, second layer) turn 3 itself came back as a song in my replay | the previous ANSWER (song-like) rode in the history and the discourse summary (Entities/Flow of the last topic) rode in the system prompt of every turn (`salientHistory`/`salientSummary` exist but the switch is OFF, `SALIENCE_DEFAULT=false`) | `repro-before-seeded-shim.json`: spoken "The sky's a beautiful blue, you see, It's all thanks to sunlight, and how it bends with glee." |
| junk referents ("The", "With", "But", "Across", "Named", "Chorus") | `casedRuns` treated a line break as no sentence boundary, and `admitReferents` read capital runs out of a creative ANSWER. Every line of a poem opens with a capital. In one real run the junk entity **"The" (weight 6.0)** made `activated()` fire "names-its-own" on every ask containing "the", which hid the leak by accident in that run and would also have blocked real follow-ups. | `repro-before2.json`, `trace.mjs` |
| the boss's merged `threadTurn.carried` / `record.passages` reuse | Fires only for `follow.mode === "thread"`. Not a cause of symptom 3, but it CAN fire on a standalone ask: `fold-chat-flow.js isMove` (Terry's "move": <= 6 words, <= 2 content words, act escalation/frame-ask/map-ask) turned **"so what is dna", "wait what is entropy", "are you sure about gravity"** into `mode: thread`, i.e. answered from the previous turn's text AND its passages as [W#] sources. | `probe-move-before.txt` (3 of 30 short standalone asks), fixed, `probe-move-after.txt` |
| es / fr: true follow-ups never carry | No `carryTriggers` for es, none at all for fr: a typed gap by design (the other side of the same gate). | follow/es 0/7, follow/fr 0/7 BEFORE |

The prereg predicted H1, H3, H4 and "H2 not a cause of symptom 3": all confirmed. H2's other half (can fire on a standalone ask) I had left open; it does (above).

One honest wrinkle: the FIRST live run of the whole sequence did not carry in turn 3 (the junk entity "The" short-circuited the gate), and the later live runs had the relay answer 502 for every query (`curl` 3 of 3, from this machine). The replays therefore SEED the stored chat (user's own transcript + the referent record the real `admitReferents` builds from it) and run the last ask live; the search backend is a shim (below).

## 2. The fix (smallest honest rule)

`fold-chat-anaphora.js` (new, pure, no model): `anaphoraOf(ask, {lang, hints}) -> {carry, kind, why, decided}`. Carry ONLY when the ask is anaphoric/elliptical: (1) a personal pronoun of the language's closed class; (2) a weak pronoun/demonstrative (it/this/that/one…) in an ask of <= 8 tokens with no entity of its own, minus expletive ("it takes", "is it true that"), determiner ("that book") and numeral ("one of the largest") uses; (3) no content word left after the closed class, the question/request frames and the continuation words ("tell me more", "why?"); (4) a connective + fragment ("and in 1911?", "what about Saturn?"; not "and who painted…"); (5) a bare comparative ("something less sweet"). Everything else (a complete predicate with its own subject) never inherits a referent, a query term or a passage. A language with no closed-class prior is **undecided -> not carried**, and the verdict's `why` says so (`wire.diff` puts it in the feed). Content/function words come from `functionWordsOf`; the pronoun/connective lists (en, es, fr; ru through its injected hints) are declared grammar, each checked to be a function word of its language (the test).

Wiring inside my own files (live without any `fold-chat.js` change): `thread.js followUp` asks the gate before ANY carry path and puts the verdict on the plan (`plan.gate`); `mind.js resolveQuestion` takes the verdict (`gate-standalone` / forced carry, so es/fr work); `flow.js planTurn` requires a move to lean too; `salience.js continuesThread` with a verdict no longer treats a SHARED WORD ("blue") as a thread; `mind.js` line breaks open sentences and a `creative` answer admits no referent.

Style carry: `fold-chat-histkind.js styleSafeMessages` (pure, tested): for a turn that is not itself creative and whose ask does not lean on the last exchange, each creative exchange (ask classifies generate/compose, or the reply is marked creative) becomes ONE fact-only line `[Earlier in this chat the person asked for a creative piece of writing.]` (or is dropped, `mode:"drop"`); the pending ask is never touched; an ask that leans keeps the last exchange verbatim. The marker passes Gary's door with no finding.

Unapplied (not mine to edit): `eval/ants/g3/wire.diff` (fold-chat.js: `lang` to the gate, history built after the kind with `styleSafe`, `creative` to `admitReferents`, the standalone-ask prompt gate that hands the model no earlier exchange and no stale summary, the "read on its own" feed line) and `eval/ants/g3/channels.diff` (`modelHistory(messages, {styleSafe})`). Both apply cleanly with `patch -p1` on the current files and pass `node --check`; `channels.diff` needs `wire.diff`'s call and vice versa.

## 3. Measurement (real `planTurn`, real `admitReferents`, no model)

Unit of scoring: the last ask of each sequence; "carry" = the plan inherits anything (kind carried/elliptical/meta/move, searchQ differs from the ask, or mode thread). BEFORE = the tree as it was before my edits (a reconstruction, validated: 0 differences on all 113 rows against the run recorded from the original). Corpus 1 (113 sequences, `corpus.mjs`, sha in `corpus.sha`) was frozen before the BEFORE run; I TUNED the gate's guards against it (disclosed), so it is a dev set. Corpus 2 (56 sequences, `corpus2.mjs`, sha in `corpus2.sha`) was frozen after tuning and before any run of the gate on it; nothing was tuned on it afterwards (it contains the failures below, left in). Wilson 95% intervals.

| class | n | BEFORE | AFTER |
|---|---|---|---|
| corpus 1 FOLLOW (should carry) | 45 | 29 (64%) [50,77] | 44 (98%) [88,100] |
| &nbsp;&nbsp;en / es / fr | 31/7/7 | 29 / **0** / **0** | 31 / 6 / 7 |
| corpus 1 SWITCH (must not) | 49 | 35 (71%) [58,82] | **49 (100%)** [93,100] |
| &nbsp;&nbsp;en / es / fr | 33/8/8 | **19** / 8 / 8 | 33 / 8 / 8 |
| &nbsp;&nbsp;SWITCH that shares a word | 21 | 13 (62%) | 21 (100%) |
| corpus 1 HARD (not in headline) | 19 | 8 (42%) | 15 (79%) |
| corpus 2 FOLLOW | 22 | 11 (50%) [31,69] | 18 (82%) [61,93] |
| corpus 2 SWITCH | 24 | 16 (67%) [47,82] | **24 (100%)** [86,100] |
| corpus 2 HARD | 10 | 5 (50%) | 8 (80%) |
| pooled FOLLOW / SWITCH / HARD | 67/73/29 | 40 / 51 / 13 | 62 (93%) / **73 (100%)** / 23 (79%) |
| three-turn sequences (12) | 12 | 8 | 12 |
| follow-ups that carried the RIGHT referent | | 38/40 | 62/62 |

The leaks BEFORE were 22 of 73 standalone asks (30%): 14 of 33 en in corpus 1 ("what is the speed of light" after the Great Wall -> "The Great Wall of China Ming what is the speed of light"), and 8 of 16 en in corpus 2. The only es/fr loss BEFORE was the inverse failure (follow-ups never carried).

Failures AFTER, all left as measured: corpus 1: "¿quién la construyó?" (es clitic "la" is also the article), HARD "what is the difference between that and a hurricane" (9 tokens: over the declared weak-pronoun limit), "that is scary, how do I stay safe" (declared "none", gate says carry), es pro-drop "¿cuándo murió?" and "¿cuánto cuesta visitarla?". Corpus 2: "can you give an example" (no pronoun, "example" is content), "when did that happen" ("that" before a verb reads as a determiner without a part-of-speech tagger), "¿cuándo nació?" (pro-drop), "qui l'a tué ?" (clitic l'), HARD "what is a good one for beginners", "which one is bigger". The rule's declared cost: follow-ups with no overt anaphor and no frame ("when did that happen") are not carried; the person gets a standalone search and the carry notice is absent. That is the failure direction the user asked for (never a wrong carry, not a missed one).

Prereg criteria: en FOLLOW did not fall (93.5% -> 100% dev, 79% -> 86% held-out); no SWITCH still carries; HARD >= 60% (79%, 80%).

## 4. Mutation checks (`mutate.mjs`, `mutation-results.json`)

30 mutants (each gate clause of the anaphora module, the thread/mind/flow/salience hooks, each histkind clause): **30/30 killed** (baseline: 0 failing). Eight survived the first pass and were killed by targeted tests that I added (weak-pronoun length cap, entity guard, "one" guard, connective-clause guard, than/or guard).

## 5. Real-page confirmation (gemma2:2b, real page, `repro.mjs`)

The relay (Cloudflare Worker over DuckDuckGo) answered 502 to every query here (curl 3/3), so the runs use `--relay-shim`: the two relay endpoints (`/search`, `/raw`) answered from live Wikipedia (search API plus its own spelling suggestion for the typo'd ask, real page bodies, cached on disk in `shim-cache/` so BEFORE and AFTER read identical results). App code, model and pages are real; the search ranking differs from DuckDuckGo. State of the chat is the user's stored transcript replayed (SEED), only the last ask runs live.

Turn 3, `why is the sky blue`:
- BEFORE (`repro-before-seeded-shim.json`): searchQ `William McKinley Blue Room why is the sky blue`; carry notice shown; pages **List_of_Glee_characters, List_of_Duke_University_people, List_of_2025_albums**; the model's request carries the song ask, the song-like answer and the question; the answer is a song ("…thanks to sunlight, and how it bends with glee").
- AFTER, my modules only (no `fold-chat.js` change; `repro-after-core-seeded-shim.json`): searchQ `why is the sky blue`, no notice, pages Sky_blue, Blue_moon, Blue, Diffuse_sky_radiation, Ask_the_StoryBots; the answer is plain prose.
- AFTER, with `wire.diff` + `channels.diff` served over the page's own files via Playwright routes (`repro-after-wired-seeded-shim.json`): same searchQ and pages; the model's request is the system prompt and the question only; the answer is plain prose (one sample: it quotes the Wikipedia "Sky blue" colour article, a retrieval-quality matter, not carry).

Turn 2, `who is mt. mckinlet named afer?` after the empty song turn, 2 runs each: BEFORE the model's draft is a trampoline song 2/2; AFTER (wired) the draft is "Mt. McKinley is named after William McKinley, the 25th president…" 2/2. In both AFTER runs the page's own checker then withheld the draft ("none of it could be spoken"): the shim's sources (naming-dispute, McKinley Tower Apartments) did not support the sentence; that is the verification layer's call, not the carry. Single samples at n=2, not a rate.

## 6. What I did NOT do
- No edit to `fold-chat.js`, `fold-chat-channels.js`, `fold-chat-discourse.js`, `fold-chat-gaps.js`, `index.html`, `fold-chat-presentview.js`; no git add/commit/push.
- Marker vs drop was NOT decided by a real-model run (the preregistration said it would be). With `wire.diff` the standalone-ask prompt gate empties the history, so the marker only reaches the model on an ask that leans on the chat; both modes are unit-tested, only the marker is exercised on the page, and neither mode was A/B-measured on a model.
- A song-like ANSWER that was classified `research` (the model's own earlier misbehaviour, turn 2's text) is not detected as creative by `styleSafeMessages`; the prompt gate (the "THE GATE ON THE PROMPT" hunk of `wire.diff`: a standalone factual ask gets no history and no summary of the last topic) is what stops it, and that hunk is the broadest change (it also drops history for a standalone ask in a short chat that used to ride verbatim). It is separable.
- The Spanish/French clitic and pro-drop follow-ups, and "that/this" before a verb, are not solved (no tagger; the cases are in the corpora). Russian's gate rides the ethos hint forms, untested beyond two unit asserts. No other language has a class.
- `applyCarry` (carry.js) and `minds.js` are unchanged: their inputs (the referent record, the summary) are cleaned upstream (newline sentence boundary, creative answers admit nothing), and the prompt-side use of the summary is what `wire.diff` gates. I did not re-derive the summary's flow/entities.
- Not run: the whole 3-turn live sequence end to end through the real relay (502). The seeded replays stand in, disclosed above.
- Whole-repo top-level tests: 1 failure was mine (`fold-chat-nudge`: "Continue."/"go on" must stay on the old path; I fixed it in `followUp`); the other 5 (`fold-chat-answerspan` x4, `fold-chat-pageengine` standalone-port) are not from this change (the 4 answerspan failures are identical with my `mind.js` edit reverted).
