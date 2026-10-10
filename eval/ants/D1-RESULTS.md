# D1 RESULTS — falsifying long-term discourse awareness (2026-10-07)

Pre-registration: `eval/ants/D1-PREREG.md` (written before any battery run; one exploratory `searchWeb` call is disclosed there). Harness: `eval/ants/d1/` (node; resumable; `out/` is git-ignored).
Nothing in the app was edited. Fixes appear only as unapplied diffs in `eval/ants/d1/proposed/`.

## What was run

| piece | what | where |
|---|---|---|
| Battery A (pre-registered) | 18 scripted conversations (12 en, 3 es, 3 fr; 30-60 turns; 732 turns), 118 probes at fixed distances, real Wikipedia pages recorded once and replayed byte-for-byte | `cases.json` sha256 `d599e75a21ec5913...`, `corpus/store.json` (30 MB, the recorded wire), `out/conv-*.json` |
| Battery B (added after A's first analysis, to raise n) | 30 more conversations (24 en, 3 es, 3 fr; 1260 turns; 198 probes), same generator, new seeds, anchors cycled | `cases-B.json` sha256 `a982e103c817b8b8...`, `out/B-conv-*.json`. Pooled A+B = 48 conversations, 1992 turns, 316 probes |
| Sim | the live turn decision + bookkeeping of `fold-chat.js run()` over the app's OWN pure modules (planTurn, recallOf, watch, thread, salientSentences, buildTurnMessages, claimsOfTurn, applyExchange/applyCarry, freshnessOf, searchWeb over replayed fetch). The model is an extractive stand-in; everything the app decides and everything it hands the model is the app's code | `sim.mjs`, `run.mjs` |
| Clean runs | the same 45/60-turn scripts with every probe replaced by an ordinary ask, so nothing re-mentions the anchor: the forgetting curve | `out/clean-*.json` |
| Real page | `chat-live.mjs` openChat/say, gemma2:2b, real web: R1 (13 turns), R2 (7), R3 (30), R4/R5 (prompt composition) | `real.mjs`, `out/real-R*.json` |
| Staleness, 3 sessions, ceiling | synthetic one-figure page edit; three separate chats; cold needle ceiling | `stale.mjs`, `sessions3.mjs`, `ceiling.mjs` |

Limits, stated once: (a) the `web` scope (`holodeck-proxy`) answers 502 from node, so the battery reads Wikipedia only; (b) the model in the battery is a stand-in (the real-page runs use gemma2:2b and are the check on that); (c) cells are small (118 probes over about 40 cells): read the counts, not only the percentages; (d) the Wikipedia API rate-limited the whole study (the swarm shares one IP), which set how many conversations fit.

## Live versus built-but-off (default build, read from `fold-chat.js` imports and defaults)

| mechanism | state in the default build | what it does for memory |
|---|---|---|
| turn plan: meta / elliptical / carried / push-back / source-ask (`fold-chat-thread.js`, `-flow.js`) | LIVE | reads the ask against the LAST answer only |
| referent record + carry (`fold-chat-mind.js`, `-carry.js`) | LIVE | pronouns resolve to the top-2 referents by weight; weight x0.8 per turn; cap 24 |
| thread reply (`threadTurn`) | LIVE | answers from the last answer and the passages it stored; nothing older |
| watcher PRE/POST + baton (`fold-chat-watch.js`) | LIVE | about the WORK (what was searched/read), not about facts |
| claim store `s.claims` + `recallOf` (`fold-chat-record.js`, `-recall.js`) | LIVE | append-only, verbatim; read only by "what did you tell me [about X] earlier" patterns |
| `sourceRecall` (`fold-chat-sourceask.js`) | LIVE | reads back the last answer's source line |
| discourse summary: `applyExchange` flow (last 6 exchanges, 90+90 chars), topic, `applyCarry` entities (<=8), records window (8 gists of 100 chars) | LIVE (stored every turn) | what the model could be handed; see the next row |
| **G3 gate on the prompt** (`fold-chat.js` ~l.2211, `fold-chat-anaphora.js`; uncommitted working tree, landed 2026-10-07 01:46) | LIVE | an ask that does not lean on the earlier turn gets NO history, NO summary, NO records. Measured on the real page (R4/R5): turn 4 of a conversation hands the model `[system 4207 chars, user 30 chars]` with the summary holding 3 records |
| `modelHistory` + `RECENCY_WINDOW` 4 (whole transcript only when <= 1600 chars), `styleSafe` | LIVE | last 2 exchanges verbatim, but only on an ask the G3 gate lets through |
| page memo (10 min, 40 pages) | LIVE | page cache for a re-read; the SEARCH is never cached |
| impressions (`impressionOf`, 3000 chars/page; passages stored 8 x 2400) | LIVE | what a page leaves behind; the page itself is dropped after the turn |
| `reImpress` (REC loop) | LIVE, but inside one turn only | re-opens the turn's own full pages; nothing crosses a turn |
| `freshnessOf` | LIVE | a feed note when an earlier claim's address no longer matches on a page re-read; never gates reuse |
| `fold-chat-memory.js` | LIVE | the reader's name only |
| salience (`fold-chat-salience.js`) | OFF (`fold-chat:salience` = "on" to enable) | switched ON as an arm |
| minds clause in the summary | OFF (`fold-chat:minds` = "on") | not measured (it adds 3 names at most) |
| per-ask budget (`fold-chat-budget.js`) | NOT WIRED (imported by nothing in `fold-chat.js`) | no effect on any turn |
| slot pipeline | OFF (`fold-chat:answerPipeline`) | no effect |

## Amendments to the pre-registration (all written after the runs they concern; none edits a case)

1. Battery B was added after A's first analysis because A's cells were thin (about 10 probes per kind). A and B are reported pooled; the A-only numbers are in `out/summary2-A.json` and agree in direction with the pooled ones.
2. Mid-study I found that the working tree had gained a gate (G3) between my first prompt reading and my runs: an ask that does not lean on the earlier turn is handed no history and no summary. I added it to the sim as the `live` arm and kept the pre-G3 composition as the `livePreG3` arm. The real-page runs R1/R2 (00:50-01:07) ran before that edit (`fold-chat.js` 01:46); R3-R5 after.
3. The needle gold is retrieval-level ("read": the verbatim sentence is in a passage the turn read) as well as the strict model-level ("handed": it survives the app's own 4-sentences-per-page compression into the model's source block). Both are reported. This was added after I found, with the app's own `salientSentences`, that the model-facing block omits the answer sentence in 14 of 30 cold asks (`ceiling.mjs`).
4. The sim's `web` scope is dead (502) and the stand-in model always writes traceable sentences; the sim therefore under-counts searches (2-3 per ask vs 5-8 on the real page, `fidelity.mjs`) and over-fills the claim store (real gemma2:2b added no claims on 9 of 30 R3 turns). Paths and recall turns agree with the real page on 10 of 10 R2/R5 turns.

## Verdict table (pooled A+B, n probes in brackets; "right" = the anchor's needle was read / the anchor turn was recalled)

| # | claim (pre-registered number) | verdict | measured |
|---|---|---|---|
| 1a | pronoun follow-up after detours grounded in the anchor >= 80% | **REFUTED** | far (d>=3): the search names the anchor topic in 5/20 (25%), needle read 3/20 (15%); by distance 2/5, 2/6, 1/6, 0/3 (d3,d10,d25,d50). Near control (pronoun straight after the answer): anchor named 18/18 but needle read only 10/18 (56%), because 17/18 of those queries also carry an unrelated second referent (carry-2) |
| 1b | `what did you tell me about <name> earlier` returns the anchor turn >= 90% at every distance | **REFUTED** | 21 of 27 took the recall path; 11/21 (52%) were the anchor turn, 10/21 a wrong turn; reached the anchor overall 11/27 (41%). By distance d3 4/7, d10 3/13, d25 3/4, d50 1/3. Real page: R1 T5 found nothing (store empty) and searched 5 times, R1 T6/T13 returned the fold's own meta-line, R2 T4 returned the wrong turn |
| 1c | topic return (names the anchor) reaches the right page >= 90% | **REFUTED as stated, not memory** | read 9/20 (45%) = the cold-session ceiling 9/20: the page is found by a fresh search or not at all; discourse memory contributes nothing |
| 1d | sibling words never ground in the wrong sibling > 10% | **REFUTED** | in conversations that also discussed the sibling (Great Wall/Berlin Wall, Panama/Suez, Eiffel/Pisa): 7/8 recalls returned the wrong turn, 1/8 right. Without a sibling in the roster: 17/46 wrong turn, 15/46 right. Real page R2 T4: "about the Great Wall of China" returned "On turn 2 I said: The Berlin Wall fell in 1989." |
| 1e | ellipsis ("And the height?") grounded in the right topic >= 80% when it is not the last topic | **REFUTED** | far: anchor named 5/20 (25%); near: named 18/18 but 17/18 carry an unrelated referent |
| 2a | a re-ask or a new question answerable from a page already read costs 0 searches | **REFUTED** | 67/67 re-asks (repeat, same-page question, return) searched again (50/50 where the stored passages held the answer). Searches warm 2.5 vs cold 2.5 (warm >= cold in 50/50). Real page: repeat of an answered ask = 6 searches, 7 page reads (R1 T10); an ordinary ask costs 5.2 searches and 8.7 page reads on average (R3, 22 asks) |
| 2b | page re-fetches avoided within the memo TTL | **HELD (pages only)** | pages warm 1.6 vs cold 4.7; the memo never caches the search, holds 40 pages, and expires after 10 minutes |
| 2c | the recall pattern costs 0 searches / 0 pages | **HELD** | 66 recall-path probes: 0 searches, 0 pages, 0 model calls |
| 2d | a changed fact is not served as current without a signal >= 90% | **REFUTED** | synthetic one-figure edit, 4 topics: recall serves the old figure with no signal 4/4; a repeat inside the 10-min memo reads the old page 4/4 (the edit is invisible); the thread follow-up answers from the stored passages and reads nothing 4/4 (0 requests); after the TTL a repeat sees the new page and `freshnessOf` flags the old claims `gone` 4/4 (the one part that works). Separately: on byte-identical pages `freshnessOf` reports shifted/moved/gone for 37.3% of comparable verdicts (2148 of 5752): false alarms |
| 2e | a correction ("actually it was 1877") is handled as conversation, 0 searches | **REFUTED** | 27/27 searched (2.6 searches each); 20 of the 27 queries carried unrelated earlier titles, e.g. `1996 Mount Everest disaster 2021 Suez Canal obstruction Actually, it was 1877.`; the store is never updated. Real page R1 T12: 3 searches, every draft sentence withheld |
| (extra) | chit-chat does not search | **REFUTED** | 147/184 chit-chat turns (80%) searched: "ok", "nice", "interesting", "ok cool", "great, thank you", "merci", "gracias" 100%; only "thanks" and "hello again" skipped. Real page: "nice" = 2 searches, "ok cool" = 1 |
| 3a | prompt bounded: chars(t60) <= 1.15 x chars(t20) | **HELD** | live 4.0K at t60 vs 4.6K at t20 (0.88; 12 sixty-turn conversations), max 14.6K (a thread turn that carries passages). Real page R3: first call 3.7-4.7K chars across 30 turns (mean 4.4K for turns 1-10, 4.1K for 20-29) |
| 3b | what is dropped is the useless: needle in the prompt >= 50% at d=25 | **REFUTED / by design** | pre-G3 the turn-3 exchange is in the prompt for exactly 8 exchanges (100%) then 0% (records window 8); with G3 it is out of every non-anaphoric ask within a turn or two. At d>=25: 0/41 probes had the anchor available without a new search |
| 3c | chit-chat dropped before facts | **REFUTED** | the window is positional: ages 1-8 kept 100% whatever the kind (254 ask exchanges, 9 chit/meta), then 0% (pre-G3 arm, 8 clean 45/60-turn conversations); nothing ranks by usefulness |
| 3d | a fact from session 1 is recoverable in session 3 | **REFUTED** | three chats, one person: chat 2 and chat 3 asking "what did you tell me about the Eiffel Tower earlier?" both search (0 shared claims); only the reader's name is shared (`sessions3.mjs`) |
| 3e | storage bounded and non-duplicating | **REFUTED** | sim: 4525 stored passages, 2450 unique, 9.07 MB stored vs 5.08 MB unique (44% duplicate). Real page: 52 KB per turn averaged over 30 turns (1.56 MB at turn 30, 73-80 KB on a turn that fell back to sources); the quota (5 MB) is reached near turn 96 and `save()` swallows the quota error, so persistence stops silently. A stored message is dominated by the replay `tape` (37.8 KB), `passages` (7.8 KB), `feed` (7.2 KB); the claims are 0.3 KB |
| 3f | salience ON >= 50% smaller than live | **REFUTED** | vs the pre-G3 composition -38% (6.9K -> 4.2K at t30; inside my predicted 25-45%); vs the current live composition (G3) no cut at all (4.2K vs 4.1K). Salience ON does hand the model the answer sentence in 25/30 cold asks vs 16/30 for the live block |
| 4a | impression storage <= 300 B/turn (user's example); <= 2 KB tier | **REFUTED at 300 B, HELD at 2 KB** | sim: claims 991 B + warrant record 355 B = 1346 B/turn. Real gemma2:2b (R3): claims 284 B/turn (no claims added on 9 of 30 turns: chit-chat, sources-only and gap turns) + warrant ~355 B = ~640 B |
| 4b | partial cue ("that mountain thing", "the guy with the patent") recalled >= 80% | **REFUTED** | 0/27 reached the right material, and the cold ceiling is also 0/27: no live path maps a description to an earlier turn; the literal words are searched. `explicitPartial` ("what did you say about that tower in Paris earlier") returned the anchor turn 5/27, a wrong turn 14/27, searched 8/27 |
| 4c | wrong cue returns the honest nothing >= 90% | **REFUTED** | 5/19 returned someone else's claims as the answer (2/2 sibling cues, 3/17 plain wrong cues such as "the capital of New Zealand" matching "capital"); 14/19 searched (74% honest). Real page R1 T11: "about the Leaning Tower of Pisa" returned the Eiffel turn |
| 4d | a claim's address resolves back to bytes from what is stored, >= 95% | **REFUTED** | 1705/1919 (88.9%) resolve from the stored 2400-char passage; 213 (11.1%) point past byte 2400 and are lost. Via the page's own offsets only 685/1919 (35.7%) (the span indexes the impression text, and the `shadow` that maps it back is not stored); by searching the page for the cited bytes 1902/1919 (99.1%); every claim keeps its URL |
| 4e | live reaches >= 80% of keep-everything's recall at <= 25% of its chars | **REFUTED** | recall without a new search: live 0% at d10, d25, d50 against transcript+stored-pages 92% / 78% / 100% and transcript only 28% / 19% / 21%; keep-nothing 0%. Cost at turn 60: live 4.0K chars, transcript 19.7K, transcript+pages 107.7K. The live design spends 3.7% of the full baseline's chars and delivers none of its recall beyond d3 |
| 4f | recall precision does not fall as the conversation grows | **REFUTED** | precision of the recall path: d3 9/14 (64%), d10 3/13 (23%), d25 3/10 (30%), d50 1/3 (33%) |
| (summary) | does the whole app ground later asks better than a fresh session would? | **no** | needle-gold far probes (n=141): warm read 59/141, cold read 58/141. Discourse memory added one probe. |

Nothing in the table is "unmeasured" except: the minds clause (`fold-chat:minds`, 3 names at most), the slot pipeline and the budget (not wired), and 3-session history on the real page (done in the sim only; the code path is clear: `s.claims` lives on one session object).

## Recall without a new search, by distance, per mechanism (percent of needle-gold probes; n = 48 / 50 / 50 / 27 / 14)

| distance | live (G3) | pre-G3 | salience ON | transcript only | transcript + all stored passages | page memo (what the app still caches) | keep-nothing |
|---|---|---|---|---|---|---|---|
| near (1) | 41.7 | 41.7 | 41.7 | 41.7 | 95.8 | 100 | 0 |
| 3-5 | 8.0 | 20.0 | 6.0 | 40.0 | 84.0 | 94.0 | 0 |
| 10-12 | 0 | 4.0 | 0 | 28.0 | 92.0 | 98.0 | 0 |
| 25-27 | 0 | 0 | 0 | 18.5 | 77.8 | 29.6 | 0 |
| 50-52 | 0 | 0 | 0 | 21.4 | 100 | 35.7 | 0 |

(The memo column is a cache, not a design mechanism: it holds 40 pages, so it already loses the anchor page by turn 25. "Transcript only" is the full spoken text; the model's own earlier sentences rarely hold the sentence a new question needs, which is why it plateaus near 20-30%.)

By cue kind (d>=3, same units): pronoun live 7.4 / transcript+pages 100; ellipsis 10 / 100; repeat 0 / 96; same-page question 0 / 65; partial cue 0 / 96; return-to-topic 0 / 55.

## Prompt size against turn number (chars handed to the model; 12 sixty-turn conversations)

| turn | live (G3) | pre-G3 | salience ON | keep transcript | keep transcript + pages | keep nothing |
|---|---|---|---|---|---|---|
| 5 | 3.5K | 6.5K | 4.2K | 4.4K | 15.1K | 3.5K |
| 10 | 6.3K | 7.7K | 5.6K | 5.8K | 31.0K | 3.4K |
| 20 | 4.6K | 7.0K | 4.3K | 8.2K | 59.7K | 2.9K |
| 30 | 4.1K | 6.9K | 4.2K | 10.8K | 74.3K | 2.7K |
| 40 | 5.3K | 7.0K | 5.1K | 14.1K | 88.4K | 3.2K |
| 50 | 3.9K | 7.5K | 4.5K | 17.1K | 97.4K | 3.6K |
| 60 | 4.0K | 7.4K | 4.2K | 19.7K | 107.7K | 3.3K |

Composition of the live prompt, turns 30-60 (mean 4.6K): persona and identity 1.2K, sources 2.2K, summary 0.45K, ON RECORD 0.56K, history 0.2K, question 26 chars. Real page (R3): first call 3.7-4.7K flat for 30 turns; sim and real agree within 3-25% on matching turns (`fidelity.mjs`).

The forgetting curve (8 clean 45/60-turn conversations, no probe touches the anchor): pre-G3, the turn-3 exchange is in the prompt at 100% for exchanges 1-8 after it and 0% from the 9th on; with G3 it is 0-25% from the first standalone ask on.

## Minimal reproductions

All on the real page (`eval/ants/d1/real.mjs`, gemma2:2b), unless marked sim.

- **Sibling word, wrong turn (R2).** T1 "How long is the Great Wall of China?" -> T2 "When did the Berlin Wall fall?" -> T3 "Who was Marie Curie?" -> T4 "What did you tell me about the Great Wall of China earlier?". App: `On turn 2 I said: The Berlin Wall fell in 1989.` (0 searches, 0 model calls; the model is not involved, the app speaks.) T5 "...about the wall earlier?" -> the same line. T6 "What did you tell me earlier?" -> turn 3 (the last), as designed.
- **Empty store, then the meta-line (R1).** T1 "How tall is the Eiffel Tower?" -> "None of the model's sentences could be traced to what was read, so the sources' own words are shown" (claims stored: `[]`, 2 bytes). T5 "What did you tell me about the Eiffel Tower earlier?" -> 5 searches, 13 pages, answer "I showed you the sources' own words about the Eiffel Tower." T6 "What did you say about that tower in Paris earlier?" -> `On turn 5 I said: I showed you the sources' own words about the Eiffel Tower.` T10 asks the height again and gets "It's 330 meters (1,083 feet) tall." (6 searches); T13 "What did you tell me about the Eiffel Tower earlier?" -> still the turn-5 meta-line, never the 330 m: that sentence names no tower, and recall matches the fold's own words only.
- **Wrong cue answered with someone else's claim (R1 T11).** "What did you tell me about the Leaning Tower of Pisa earlier?" -> `On turn 5 I said: ... the Eiffel Tower.` (one shared word, "tower").
- **Pronoun after detours (R1 T9).** Eiffel (T1), telephone, Great Wall, Berlin Wall (T7), photosynthesis (T8), then "How tall is it?" -> `Read your question as being about Berlin Wall and Eiffel Tower.` (5 searches, 13 pages). Right by luck of the top-2 weights; sim: the anchor is among the carried referents in 5 of 20 far cases.
- **Re-ask costs the same (R1 T10; sim 67/67).** The same height question asked again: 6 searches, 7 pages, 4 model calls.
- **A correction is a search (R1 T12; sim 27/27).** "Actually, it was 341 metres." -> 3 searches, every sentence withheld, nothing shown. Sim: `Actually, it was 1877.` after the Everest and Suez threads is searched as `1996 Mount Everest disaster 2021 Suez Canal obstruction Actually, it was 1877.`
- **Chit-chat searches (R3 T5, T20; sim 147/184).** "nice" = 2 searches; "ok cool" = 1.
- **The model is handed no earlier turn (R4/R5).** Turn 4 "When did the Berlin Wall fall?" after three answered asks: messages `[system 4207 chars, user 30 chars]`; no PAST DISCOURSE, no ON RECORD, no history; the session summary holds 3 records and a 3-exchange flow. By design (G3) a new topic gets nothing.
- **Stale served silently (sim `stale.mjs`).** After the anchor answer about Everest, edit "8,840 m" to "8,850 m" in the replayed page: "What did you tell me about Mount Everest earlier?" -> the old figure, no notice. A repeat inside 10 minutes reads the memoised old page; after the TTL the page is re-read and `freshnessOf` reports the old claim `gone` (the feed note works). Also on unchanged pages: 37.3% false alarms.
- **Storage (R3).** Session after turn 30: 1,563,756 bytes; 52 KB/turn; at turn 1 one message is 71.6 KB (R2 T1 breakdown: `tape` 37,846, `passages` 7,781, `feed` 7,242, `web` 1,319 B).
- **The answer sentence never reaches the model (sim `ceiling.mjs`, with the app's own `salientSentences`).** "How tall is the Eiffel Tower?": the Eiffel Tower passage contains "The tower is 330 metres (1,083 ft) tall..." but the 4 sentences handed to the model are the naming, the construction record, the clocks and the 1964 monument declaration. 14 of 30 cold asks lose their answer sentence this way (salience ON: 5 of 30).

## Failures ranked by how often a real user would hit them

1. **Every ask is a fresh research trip, including the ones whose answer is already on the screen.** 5.2 searches and 8.7 page reads per ask on the real page; a repeat or a follow-up costs the same (67/67). Hit: every turn.
2. **Chit-chat is searched.** 80% of "ok / nice / interesting / ok cool / merci" turns trigger a search. Hit: most conversations, several times.
3. **There is no way back to an earlier fact for a standalone ask.** Past the last exchange the model is handed nothing (G3) and the app reads no store for it: 0% at d>=10 against 92% for the full transcript; partial cues 0/27. Hit: any "going back to X", "that thing you said" after a detour.
4. **A pronoun or an ellipsis after a detour is searched with the wrong referents.** 25% name the anchor; almost every English pronoun query (37 of 38) carries a second, unrelated topic, even straight after the answer. Hit: whenever a person says "it" after a new topic.
5. **"What did you tell me about X" answers wrongly with confidence.** 14/27 partial-cue and 10/21 name-cue recalls return another turn (7/8 with a sibling word); it can return the fold's own meta-line; it finds nothing when the earlier turn added no claims (9 of 30 real turns: sources-only fallbacks, gaps, chit-chat). Hit: every use of the feature, about half of the time.
6. **Storage grows 52-80 KB per turn and fails silently near turn 100.** Hit: long-lived chats; invisible until a reload loses the tail.
7. **The freshness note is wrong a third of the time.** 37.3% of comparable claims are reported shifted/moved/gone on unchanged pages (554 of 1890 turns carry a note). Hit: whenever an earlier claim and a re-read page meet.
8. **Old facts are served without a signal.** Recall, the thread follow-up and the 10-minute memo all reuse without checking; a correction never changes the store. Hit: rarely within a session, always across a long one.
9. **The model is often not handed the answer sentence.** 47% of cold asks (a within-turn effect, not memory, but it decides what the claim store holds).

## Unapplied proposals (diffs in `eval/ants/d1/proposed/`, nothing applied or committed)

- `recall-score-and-asks.diff` (`fold-chat-recall.js`): score turns by how many of the named words they carry, in the said text and in the ask they answered, require half of them, take the best, not the latest. Checked by `proposed/recall-proposal-check.mjs` on a synthetic store shaped like R1/R2: Great Wall -> turn 1 (was turn 2), Eiffel -> the fact turn 4 (was nothing), Pisa -> nothing. Not run on the battery; the call site would pass `asks` from `summary.records[].forWhom`.
- `store-shadow-and-full-span.diff` (`fold-chat.js`): store passages to 3000 chars (IMPRESSION_BUDGET, so the 11% of spans past 2400 survive) and keep the shadow (`segments`, `hash`) so an address maps back to the page. Applies cleanly (`patch --dry-run`).
- Not written, named: a lookup of the store before a standalone search (re-ask), a chit-chat guard (`CONVERSATIONAL_RE` turns still reach `wantWeb`), freshness by content (search the page for `basis.cited`, 99.1%) instead of by offset, storing the replay `tape` once and not per message.

## What I did not do

No fix was applied. The model in the battery is a stand-in. The `web` scope was unreachable, so retrieval is Wikipedia only (Spanish and French asks read the asker's-language Wikipedia; a Machu Picchu ask returned unrelated pages and was dropped from the bank). es/fr follow-ups are detected (the anaphora gate covers en/es/fr: 17 of 19 es/fr pronoun probes were carried) and behave like English: two referents, one of them unrelated ("Qui était-il ?" after Pasteur became the search `Tour Eiffel Joseph Louis Pasteur Vallery-Radot Qui était-il ?`). The `anaphor.mjs` counts and rows 1a/1e are English only. The page edit in `stale.mjs` is synthetic. `keepallPages` in `out/*.json` is the app's own capped memo, not an unbounded page store. 30 MB `corpus/store.json` is the recorded wire: keep it (replay needs it) or regenerate with `record-corpus.mjs` + `run.mjs --record`.

## Reproduce

`node eval/ants/d1/battery.mjs` (A) / `SET=B node eval/ants/d1/battery.mjs` (B) -> `run.mjs [--only E01] [--clean] [--force]` (replay) -> `SETS=AB node eval/ants/d1/analyze2.mjs` -> `anaphor.mjs`, `ceiling.mjs`, `stale.mjs`, `sessions3.mjs`, `fidelity.mjs`; real page: `real.mjs R1|R2|R3|R4|R5`.
