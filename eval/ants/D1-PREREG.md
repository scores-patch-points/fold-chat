# D1 PRE-REGISTRATION — falsifying long-term discourse awareness (written 2026-10-07 BEFORE any battery run)

Ant D1. The job is to BREAK four claims the user made about the app, not to fix anything. Fixes appear only as unapplied diffs in D1-RESULTS.md.
The user's four claims (verbatim): (1) "providing the proper grounding for subsequent messages", (2) "isn't hunting for content we already have",
(3) "is forgetting usefully", (4) "leaving impressions to find our way back to content without having remembered it all".

What I did before this file: read the code (fold-chat.js run(), fold-chat-thread/flow/watch/exchange/carry/minds/record/recall/sourceask/freshness/salience/
impression/budget/channels/memory, vendor/the-fold/fold.js buildTurnMessages, commit de23805) and ran ONE exploratory call of `web.searchWeb("Who invented the
telephone?")` in node (eval/ants/d1/probe-search.mjs) to learn the wire shape (2 failed `holodeck-proxy` web-scope calls = 502, then Wikipedia API). Nothing else was run.

## What the harness is (so the claims are about something definite)

`eval/ants/d1/sim.mjs` is the LIVE TURN DECISION + BOOKKEEPING of fold-chat.js `run()`, with the DOM/model replaced, driving the app's OWN pure modules:
planTurn (fold-chat-flow), lookupWarranted (fold-chat-self), recallOf (fold-chat-recall), sourceRecall + watch pre/post/baton (fold-chat-sourceask/watch),
classifyTurn, web.searchWeb (REAL fold-chat-web.js) over a RECORD/REPLAY fetch (every request/response of the first run is stored by URL; later runs replay it),
buildTurnMessages + conversationVerbatim + modelHistory/withoutAppAnswered (what the model is handed), claimsOfTurn/appendClaims/pointerOf, FOLD.addWarrantRecord,
refreshSummaryMechanical (copied verbatim: it is not exported), admitReferents/applyCarry/applyExchange, freshnessOf. The model is an EXTRACTIVE STAND-IN (writes the two
passage sentences that best overlap the ask, with their support addresses) so the claim store and summary fill with realistic, source-verbatim content;
claims about what the model is HANDED and what the app decides do not depend on it. A handful of conversations are re-run on the real page
(eval/pivot/chat-live.mjs, gemma2:2b) to confirm the refutations on the live build (counts of wire requests, prompt bodies, localStorage bytes).
The `web` scope (`holodeck-proxy`) is unreachable from node (502, measured in the probe); the battery therefore runs on Wikipedia-only reads. That is a limit of the
battery, stated here, and it applies equally to every arm. Pages are REAL (Wikipedia plain-text extracts, en/es/fr), recorded once.

Switches: LIVE = the default build (salience OFF, minds clause OFF). OFF-mechanisms are then switched ON as separate arms: SALIENCE-ON (fold-chat-salience.js).
Baselines: KEEP-EVERYTHING (the whole transcript is the history) and KEEP-NOTHING (no history, no summary).

## Battery
18 scripted conversations, generated deterministically (seeded) from a fact bank of real pages: E01-E12 en (E01-04 30 turns, E05-08 45, E09-12 60), S01-S03 es (30-40),
F01-F03 fr (30-40). Each plants a turn-3 anchor (a real page + a needle sentence that occurs VERBATIM in the recorded page), then detours to other topics (incl. sibling
topics that share a word: Berlin Wall/Great Wall, Panama Canal/Suez Canal, Eiffel Tower/Leaning Tower of Pisa), chit-chat, meta asks (why? shorter), pronoun follow-ups,
repeated asks, corrections ("actually it was 1876"), and PROBES at fixed distances d = 3, 10, 25, 50 turns after the anchor (probe at turn 3+d; d=25 only in the 45/60-turn
scripts, d=50 only in 60-turn scripts). Probe cue kinds: pronoun, ellipsis, repeat, para (new question, same page), partial (descriptive cue without the name),
explicit (what did you tell me about X earlier), explicit-partial, wrong (a sibling never discussed that shares a word), none (what did you tell me earlier).
GOLD = the anchor page and needle. "Right material" := the needle sentence reaches the model verbatim in this turn's prompt (source block, carried passages, history, or the
fold's own recall of the claim). "Wrong confident" := the app answers/grounds in material that does not contain the needle and does not say it is a gap.

## Claims (each with a number; REFUTED if the counterexample below occurs)

### (1) PROPER GROUNDING FOR SUBSEQUENT MESSAGES
- 1a. A pronoun probe ("how tall is it?"-type) asked 3, 10, 25 turns after the anchor is grounded in the anchor topic in >= 80% of cases. REFUTED if < 80% at any of d>=3.
  My prediction: refuted at d>=3 (the referent record decays 0.8/turn and carries the TOP-2 by weight, so the most recent topic wins): <= 30%.
- 1b. Explicit-reference probes (`what did you tell me about <name> earlier`) return the anchor turn's claims in >= 90% at every distance. REFUTED if < 90%.
  Prediction: held for name probes while the name occurs in the fold's spoken sentence; refuted when the name is only in the ask (not in the spoken text) — matching is on the SPOKEN text.
- 1c. Topic return (A, B, C, then an ask that names A) reaches the right page in >= 90%. Prediction: held (it is searched as a standalone ask) but at the price of a search (see 2a).
- 1d. Sibling safety: an ask sharing only a word with the anchor (Berlin Wall vs Great Wall) is NOT grounded in the wrong sibling more than 10% of the time. Prediction: refuted for recall-by-word (latest turn mentioning the word wins), >= 30% wrong.
- 1e. Ellipsis probes ("and who designed it?", "a bit more") grounded in the right topic >= 80% when the right topic is NOT the last topic. Prediction: refuted: grounded in the last answer's topic.

### (2) NOT HUNTING FOR CONTENT WE ALREADY HAVE
- 2a. A re-ask (exact repeat) or a new question answerable from a page already read in the session costs 0 web searches (the "zero avoidable searches" target). REFUTED if the
  count of wire searches (classifyUrl kind "web" keys) for the re-ask is >= the cold-session count in >= 50% of cases. Prediction: refuted ~100% (nothing reads the earlier page for a standalone ask); only the recall PATTERN costs 0.
- 2b. Within the page memo's TTL (10 min) a re-ask re-fetches 0 pages; after the TTL it re-fetches all. Prediction: held within TTL (pageMemo), but searches still go out.
- 2c. `what did you tell me about X earlier` costs 0 searches, 0 page reads at any distance. Prediction: held.
- 2d. (opposite failure) when a fact changed (a page edited at one figure after turn 3; the person corrects "actually it was 1876"), the app does NOT serve the old claim as current:
  recall/thread reuse is accompanied by a staleness signal in >= 90% of such cases. Prediction: refuted: recallOf and the thread carry have no freshness gate; freshnessOf only writes a feed note
  when the page is RE-READ in a later turn (and never for the thread/recall paths, which read nothing); a correction never updates the store.
- 2e. A correction turn ("actually it was 1876") is handled as conversation (0 searches). Prediction: refuted: it is planned as an elliptical/standalone ask and searched.

### (3) FORGETTING USEFULLY
- 3a. The model's prompt size stays bounded: chars at turn 60 <= 1.15 x chars at turn 20 (live config). Prediction: held (RECENCY_WINDOW 4, RECORDS_IN_PROMPT 8, flow 6 exchanges).
- 3b. What is dropped is the useless: at turn 40, of the anchor-turn facts still needed by a probe, the prompt still holds the needle in >= 50% at d=25. Prediction: refuted (0%): the drop rule is purely
  positional (oldest first), not by usefulness; the only older thing kept is the FIRST ask, clipped to 60 chars.
- 3c. Chit-chat is dropped before facts: in the history window handed to the model at probe time, the share of chars that are chit-chat/meta turns <= 20% when the last 4 turns were chit-chat. Prediction: refuted (the window is the last 4 messages whatever they are).
- 3d. Across 3 sessions the app carries what matters: a fact established in session 1 is recoverable (recall or prompt) in session 3. Prediction: refuted (claims are per-session; only the reader's name is shared).
- 3e. Storage is bounded and non-duplicating: the same page read k times is stored once. Prediction: refuted: record.passages stores up to 8 x 2400 chars per message, duplicated per turn; measured as bytes per turn and turns to the 5 MB localStorage quota.
- 3f. With SALIENCE ON, the prompt is >= 50% smaller than live on the same turns (pre-registered S4 of the other session was -30%); and keeps the needle when the ask is about it. Prediction: size cut 25-45%, not >= 50%.

### (4) IMPRESSIONS TO FIND THE WAY BACK
- 4a. Storage of the compact impression (claims + pointer + warrant gist) <= 300 bytes per turn (the user's example number). A looser tier: <= 2 KB per turn. Prediction: refuted at 300 B; held or near at 2 KB.
- 4b. Recall of the turn-3 fact (needle available to the model) at turn 12, 25, 50 via: paraphrase, partial cue, wrong cue, no cue. Pre-registered: partial cue >= 80% (via ANY live path) at <= 300 B/turn. Prediction: refuted; recall-by-explicit-name high, partial cue < 30%.
- 4c. Wrong cue returns the honest "nothing" (no claim returned) >= 90%. Prediction: refuted for sibling cues sharing a word (confident wrong).
- 4d. Pointer round trip: a stored claim's support address resolves back to the source's bytes from what is STORED (record.passages, 2400 chars) in >= 95% of claims, and to a re-openable URL. Prediction: refuted (the address names a REF not a URL; spans past 2400 chars fall off the stored text).
- 4e. Dominance over baselines: the live design reaches >= 80% of KEEP-EVERYTHING's recall at <= 25% of its prompt chars at turn 60. KEEP-NOTHING = 0% recall. Prediction: live reaches < 80% of keep-everything's recall (partial-cue and pronoun cells), at ~15% of its chars.
- 4f. Recall precision does not fall as the conversation grows (precision of explicit-name recall at turn 53 >= precision at turn 13 - 5 points). Prediction: refuted by sibling/word collisions as more topics are discussed.

## Rules for reading the result
No case is edited after a run. The probe sets are generated by a seeded script and frozen (sha256 of cases.json written into D1-RESULTS.md). A claim is HELD only if its
number meets its threshold in the whole battery; a claim whose cells I could not measure is UNMEASURED. Numbers are reported with n. The stand-in model is a limit, named wherever it could matter.
