# The Pivot in the real page — pre-registration (2026-10-06, written BEFORE `fold-e2e-pivot.mjs` was run)

Claim under test: for ordinary generation the model's text is a DRAFT; what is spoken is realised from the sentences that survived being
read (docs/PIVOT.md, fold-chat-pivot.js). "The model is not the final thing before speaking."

Setup: the REAL page (FOLD_URL, default :8814) in a fresh headless context per case; `/v1/chat/completions` is stubbed to emit a forced-bad
draft; Wikipedia serves one page (Eiffel Tower, 330 metres, 1887–1889, Gustave Eiffel). A MutationObserver installed before load records
EVERY string that ever appears in an assistant bubble, so "never shown" means never, not "not at the end".

| id | forced draft (abridged) | conjecture (a counterexample refutes it) |
|---|---|---|
| E1 | "...stands in Paris. It was designed by Leonardo da Vinci. It is 330 metres tall." | "Leonardo" is never in the DOM at any moment, never stored; "Paris" and "330" are |
| E2 | "Great question! Here's what I can tell you:\n* **Height:** The tower is 330 metres tall.\n* It stands in Paris." | no `*`, `**`, "Great question", "Here's what" ever shown; the 330 sentence is |
| E3 | "The Eiffel Tower is 330 metres tall. It attracts 7 million visitors a year." | "7 million" never shown or stored |
| E4 | CONTROL "The Eiffel Tower is a wrought-iron lattice tower in Paris, France." | ships whole (a gate that withholds everything survives every refutation and is useless) |
| E5 | "I'm so sorry to hear that! Feel free to ask me more." | nothing spoken, stored content empty, a typed notice drawn, no ordinary chat line |
| E6 | a Thai draft for an English ask | spoken as the model wrote it AND a notice says it was not read (typed gap, floor = today's path) |
| E7 | E1's draft with `localStorage["fold-chat:pivot"]="off"` | "Leonardo" IS shown — the discriminator: proves E1 passes because of the Pivot, not by accident |

Predictions: E1–E5 STAND; E7 shows the raw draft (so its verdict is STANDS-as-discriminator); E6 may be UNMEASURED (the language-restate
step runs first and may withhold). A surprise is any case going the other way, recorded as one.

---

## Live battery with a real small model (`eval/pivot/live.mjs`) — predictions written BEFORE its first run

Model: `gemma2:2b`, temperature 0, `num_predict` 400, via Ollama. 8 real Wikipedia intros (cached in `eval/pivot/data/pages.json`), 2 asks each
= 16 SOURCED cases, with the chat's own source block (`sourcesPrompt`) and the Fold preset; plus 6 JUDGMENT cases (no sources: the earlier
grief / decision / principle asks) to see the shape checks on text with nothing to ground against. Oracles are independent of the pivot's own
checks where possible: regexes for markup / "!" / stock reflex / >1 question / a fragment ending, and `ground.coverage` ratio and
`ground.unsupportedClaims` on RAW vs SPOKEN.

* L1 spoken text has 0 markup, 0 "!", 0 stock-reflex phrase, <= 1 question and no fragment ending in ALL 22 cases (by construction; a miss is a bug).
* L2 `verifyPivot` ok on 22/22 (a miss is a bug in the realiser).
* L3 coverage ratio (grounded sentences / sentences) of SPOKEN >= RAW on every sourced case, and the mean rises.
* L4 unsupported figures+names (`unsupportedClaims`) in SPOKEN <= RAW on every sourced case.
* L5 share of sentences withheld on sourced cases: between 10% and 40% (declared guess); `nothing_survived` on <= 2 of 16.
* L6 judgment cases: 20–60% withheld; >= 4 of 6 keep >= 2 sentences.
* L7 NOT claimed: that what is spoken is *better written*, wise, or complete. Withheld sentences may include true ones (over-withholding);
  the RESULTS file lists every withheld sentence with its reason so a person can judge, and the false-positive side is reported, not hidden.

---

## Amendment 2 (2026-10-06) — the gate history (fold a900f6e), predictions written BEFORE the tests/driver run

Pulled in from `../fold` commit a900f6e (`server/gate-ledger.mjs` + `gateVerdict`, vendored byte-identical, pinned): stage 12 over TIME. A gate
that has never rejected anything reads `unmeasured`, never `pass`; a failed run is `fail` whatever its rejections. The Pivot's gates
(boilerplate, number_not_given, ungrounded, label, question, truncated, third_person, attribution, plus the realiser's own `verify`) keep
a persisted history in `localStorage["fold-chat:gates"]`; each turn records rows = sentences read, rejected = withheld by that gate,
failed = 1 when `verifyPivot` refused the realised text (the `verify` gate).

* G1 (unit) a gate with rejected = 0 never reads `pass` however many rows; one caught sentence flips the NEXT all-clear to `pass`; a failed run is `fail` even with rejections.
* G2 (unit) history survives a JSON round trip and compaction keeps every gate's cumulative totals exactly.
* G3 (real page) E8: in a fresh context, a CLEAN draft leaves every Pivot gate `unmeasured` (nothing has rejected anything), stored in the message.
* G4 (real page) E9: then a draft with an invented designer and a stock opener: `ungrounded` and `boilerplate` read `pass`, the others still `unmeasured`.
* Not claimed: that a gate which has rejected once is *good* — `pass` means only "it can reject", the exact II.10 condition.

---

## Amendment 3 (2026-10-06) — written BEFORE the real-conversation runs and the fix they motivated

First real conversation (real page, heimdall, gemma2:2b, real web reads; `eval/pivot/chat-live.mjs`) found, before any change below:
(a) with the model's token budget lowered the reply was cut off for real and the new reprompt fired (finish `length` → `stop`), but the model resumed with
"…" and the joined text read "into the … Chemical energy" (a stray ellipsis and a capital the Pivot added mid-sentence): the join now drops the
model's own seam marks (an ellipsis ending prev or opening next); (b) when EVERY sentence of a sourced draft is withheld the person got a bare gap
although sources were read. The chat's existing rule for "the model could not be used on this turn" is the Sources-only strand (the sources' own
sentences, verbatim, no model), so a sourced turn whose draft yields `nothing_survived` now falls back to it, with a fold note saying so.
Consequence for E5 (sourced, all-reflex draft): its conjecture is AMENDED from "empty content" to "nothing of the DRAFT is ever shown; the person gets the
sources' own words, authored by the sources". The unit-level `nothing_survived` gap in the Pivot module is unchanged (it is the trigger).
Predictions for the next real runs: C1 `thread` (pronoun follow-up "What did she discover?", then "Tell me more about her husband.", then "go on"):
at least one turn is a gap or a fall-back-to-sources rather than a model answer (the real search for a pronoun follow-up reads the previous topic less
reliably than for a named ask); C2 `continue` (budget lowered to 40 tokens): every turn needs >= 1 continuation, joined text has no "…" seam mark and
no mid-sentence capital; C3 no turn ever shows a word the model did not write unless it is a source sentence verbatim (author-marked).

---

## Amendment 4 (2026-10-06) — SALIENCE: the model is handed only what bears on THIS ask. Written BEFORE the module's tests and the live runs

Motive (a real capture, turn 3 of an Eiffel Tower thread): 11,292 chars handed to a 2B model for "Why was it built?": three ~3,000-char pages including a
film page (Tomorrowland), a 4-message verbatim history, and a Past-Discourse block built from page titles. `fold-chat-salience.js` selects, mechanically and
VERBATIM (find/snip — never a rewrite): (1) from each page, the sentences that share a content stem with the ask (plus the lead and one neighbour), within a
character budget; pages that do not bear on the ask are dropped; (2) the earlier exchange only when the ask CONTINUES the thread (a carried/elliptical/meta
ask, or one that shares a content stem with the previous exchange) — a topic change hands the model NO old thread; (3) the discourse summary and the record only
for exchanges that bear on the ask and are not already in the verbatim window. Verification (the Pivot's grounding) still runs against EVERYTHING READ.
A language with no closed-class prior is passed through unchanged and says so (`unmeasured`), never guessed.

* S1 (offline, 8 real Wikipedia intros, hand-listed answer needles that occur in the page): the excerpt keeps the needle in **>= 90%** of ask×page pairs at the
  default budget; a miss list is printed, not hidden.
* S2 (unit) the excerpt is made only of verbatim slices of the page, in page order, within budget; an off-topic page is dropped; an ask whose terms match no page
  yields NO passages (so no model call: the model never speaks alone).
* S3 (live, real gemma2:2b, the 4-turn Eiffel thread with a topic change to photosynthesis) the topic-change request contains **none** of {eiffel, tower, gustave} anywhere
  (system, history, summary), and a follow-up ("Who designed it?") still contains the Eiffel exchange.
* S4 (live) mean request size on sourced turns falls by **>= 50%** against the same thread without salience (9–11k chars before).
* S5 (live) the answers to the thread's follow-ups are still correct (330 m / Gustave Eiffel / the 1889 exposition) — read by me and listed; if salience costs an answer, that is reported.
* Not claimed: that fewer tokens make a small model *wise*; only that it is handed less that is irrelevant.

### Amendment 4 — RESULTS (2026-10-06). The registered runs, reported as they came out

Harness: `eval/pivot/salience.mjs` (S1), `fold-chat-salience.test.mjs` (S2, S3 offline half), `eval/pivot/salience-live.mjs` (S3–S5; raw: `eval/pivot/salience-live.json`). Live = the real page, heimdall, gemma2:2b, real web reads, one run per arm (n = 1 thread × 2 arms; no repeat, so no variance estimate).

* **S1 — met, but weak.** Needle kept in 16/16 (100%) at the registered default (1,400 chars/page); every excerpt re-derives verbatim (16/16). The 8 intro pages are ~1,200 chars, *under* the budget, so the default run is nearly vacuous. The informative stress runs: 500 chars → 13/16 (81%), 300 chars → 8/16 (50%). The registered criterion is met; it does not show the budget is right for real ~3,000-char pages.
* **S2 — met** (7 tests, incl. the verbatim re-derivation catching an appended word, off-topic page dropped, no-match → no passages, no-prior language passed through).
* **S3 — met.** The photosynthesis request carries none of {eiffel, tower, gustave} outside the source block; the "Who designed it?" request still carries the Eiffel exchange. The offline test found a real defect first: the language's closed class lacks wh-words, so "How does Y work?" shared "how" with "How tall is X?" and a topic change read as a continuation. Fixed with a declared English question/frame word list in `fold-chat-salience.js`.
* **S4 — NOT met.** Mean request size on the four sourced turns: **6,306 chars with salience vs 9,030 without = −30.2%** (criterion ≥ −50%). Turn 1 fell 47% (5,033 vs 9,563) and the topic-change turn 53% (4,053 vs 8,543), but the follow-ups did not: the "continues the thread" history carries the previous turns' long spoken answers verbatim (turn 3 handed 5,951 chars *before* the sources).
* **S5 — NOT met.** With salience ON, 2 of the 3 follow-ups ("Who designed it?", "Why was it built?") ended in "None of the model's sentences could be traced to what was read, so the sources' own words …" — the model's draft was withheld and the fold fell back to the page's sentences (which still contain Gustave Eiffel and the 1889 exposition, but are a page dump, not an answer). Without salience the same two turns were answered directly and correctly. Cause not diagnosed. Salience cost two answers on this thread; that is the finding.

Decision: **`SALIENCE_DEFAULT = false`** (`fold-chat-salience.js`; localStorage `fold-chat:salience` = "on" turns it on for A/B). The module, its tests and the wiring stay. Not claimed: that this one thread generalises either way. To re-register before turning it on: cap `historyExchanges` by characters (not exchanges) so the history cannot outweigh the excerpts, and find why the grounded draft was withheld when the model saw excerpts only (suspect: the model paraphrases from less context; the Pivot checks against the full page).
