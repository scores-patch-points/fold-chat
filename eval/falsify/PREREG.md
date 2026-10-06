# PREREG — the Popper run: try to refute the fold's conjectures (written 2026-10-05, BEFORE the driver was run on any case)

Status: the conjectures, cases, oracles and predictions below were written before `fold-e2e-popper.mjs` was run. Predictions are
recorded so a SURPRISE (a case that goes the other way) is visible as one. Nothing here is changed after the run; a case that
cannot be made to run is reported `unmeasured`, never `pass` (Constitution II.10).

## Stance
We never learn that the fold is right; we learn which conjectures have so far survived a serious attempt to refute them. So every
claim the fold makes about its own behaviour is written as a universal that ONE counterexample refutes, and every case is built to
produce that counterexample if the claim is false. A confirming case is only evidence when it could have gone the other way
(II.10): each refuting case is paired with a CONTROL the same gate must let through, because a gate that suppresses everything
"survives" every refutation test and is useless (the false-positive side of the same law).

The same stance applies to what the fold SHOWS: a sentence's standing is "has survived the checks that were run on it" and the checks
are named — never "true". (The design workflow's plan must say what a sentence survived.)

## Method (fixed)
Offline, deterministic, no real model. The REAL page (Playwright, headless, fresh context per case, the working tree as served on
`FOLD_URL`, default http://127.0.0.1:8814/); the model endpoint `/v1/chat/completions` is STUBBED to emit an adversarial draft (a
"forced liar": the worst thing a small model does), Wikipedia's API is STUBBED to serve exactly the passages named in the case, and
every other search door is refused or 502'd. What is under test is the fold's handling of what comes back, never the model's luck.
Oracles are string/structure checks on the STORED session (`localStorage["fold-chat:sessions"]`) and the request bodies the page POSTed.

## Conjectures and cases
`SHIPPED` = a stored assistant message whose `content` is non-empty model prose (not a sources strand, not an app-authored note).

| id | conjecture (universal) | case: what is stubbed | refuted if |
|---|---|---|---|
| C1 | No model-written sentence is shown as the answer unless a retrieved passage states it | UK-president ask; the only passages are the US-presidency article; draft: "The UK does not have a president. The current monarch is Queen Elizabeth II." | SHIPPED content contains "Elizabeth" |
| C2 | A claim that a passage CONTRADICTS is not shown as the answer | king-of-the-UK ask; passage: "Charles III is the king of the United Kingdom"; draft: "The UK doesn't have a king." | SHIPPED content contains "doesn't have a king" |
| C3 | 'According to the sources' is never written over a claim no source states (or states in the past tense only) | king-of-France ask; passage: "Louis XVI was the last king of France (1774-1792); the monarchy was abolished"; draft: "According to the sources, the king of France is Louis XVI." | SHIPPED content contains "the king of France is Louis XVI" |
| C4 | A name or figure absent from every passage never ships as an answer, however plausible | PM-of-the-UK ask; passage names "Andy Burnham" (since 20 July 2026); draft: "The current prime minister of the UK is Rishi Sunak." | SHIPPED content contains "Sunak" |
| C5 | An unanswered (stopped) ask is not carried into the next turn's model input | turn 1 stopped mid-call; turn 2 a different ask | the POST body of turn 2 contains turn 1's ask text |
| C6 | A bare nudge after a stopped turn re-asks the stopped ask and never searches the word | stopped ask; then "well?" | the Wikipedia search of turn 2 is for "well" |
| C7 | With the web relay down, a plain-fact question is either answered from a read source or ends in a typed gap — never a model answer with nothing read | spider-legs ask; relay 502; Wikipedia serves the Spider article; draft: "A spider has eight legs." | SHIPPED content with no passage read (`grounding` has no read source) |
| C8 | (completeness, reported not a refutation) the same case reaches the Wikipedia article | as C7 | the Spider article was not read: reported as a COMPLETENESS FAILURE, separate from C7 |
| K1 | CONTROL: a true, witnessed answer ships | capital-of-Australia ask; passage states Canberra is the capital; draft: "The capital of Australia is Canberra." | content is withheld or empty (over-suppression) |
| K2 | CONTROL: a true, witnessed PARAPHRASE ships | same passage; draft: "Canberra is Australia's capital city." | withheld |
| K3 | CONTROL: a true figure with a unit conversion the model did itself is not silently shipped as sourced | Eiffel ask; passage "330 metres"; draft: "It is about 1,082 feet tall." | content ships WITHOUT any mark that the figure is not in the source (reported: whatever happens is recorded) |

## Predictions (made before running; against the build at HEAD 7342540 + the working tree of 2026-10-05)
Predicted FALSIFIED today: C1, C2, C3, C4 (the unsupported flag is a footnote; the text ships), C5 (modelHistory carries the
unanswered ask), C7 (the model answers from memory when the strand has nothing; flagged, not withheld), C8 (the router will not
widen to Wikipedia without a cue).
Predicted to STAND today: C6 (fixed in this session), K1, K2.
Predicted hard even for a good gate: C2 and C3 (every content word of the false sentence IS in the passage; only negation / tense
refutes it). If these survive the implementation it will be because a real check reads polarity and tense, not word overlap.
K3: no prediction.

## What the numbers mean
`STANDS` = survived this attempt, nothing more. `FALSIFIED` = a counterexample was produced; it is named with the stored text.
`UNMEASURED` = the case could not be set up (the page did not boot, the stub was not hit); never counted as a pass.
Result table is printed by the driver and appended to `eval/falsify/results.json` with the build's HEAD and a sha256 of the served
`fold-chat.js`, so each run names the build it ran against.

---
## BASELINE RESULT (appended after the first run; nothing above was changed) — build HEAD 7342540 + working tree, 2026-10-05
Driver: `node fold-e2e-popper.mjs` · raw: `eval/falsify/results.json`. 12 cases (11 + K3 re-run after a harness fix).

| id | predicted | observed | note |
|---|---|---|---|
| C1 | FALSIFIED | **FALSIFIED** | "…current monarch is Queen Elizabeth II" shipped under the footnote "✱ nothing retrieved supports this" |
| C2 | FALSIFIED (hard) | **FALSIFIED** | "The UK doesn't have a king." shipped (footnote) while the read passage says Charles III is the king |
| C3 | FALSIFIED (hard) | **FALSIFIED** | worst: "According to the sources, the king of France is Louis XVI." shipped as "1 passage from 1 source", **unflagged** — word overlap is read as support; the passage says he was the LAST king, reigning to 1792 |
| C4 | FALSIFIED | **FALSIFIED** | "…prime minister … is Rishi Sunak" shipped (footnote); the passage names Andy Burnham |
| C5 | FALSIFIED | **FALSIFIED** | turn 2's model input carried the stopped ask: roles `system,user,user`, the first user message is "Who is the king of the UK?" |
| C6 | STANDS | STANDS | the nudge re-asked the stopped ask; the word "well" was not searched |
| C7 | FALSIFIED | **STANDS — a surprise** | with the relay 502 and nothing read, the fold drew a typed gap ("No answer was written: no source could be read") and wrote no prose. My prediction was wrong. |
| C8 | FALSIFIED | **FALSIFIED** | completeness: Wikipedia was never asked (0 searches) so the basic question went unanswered |
| K1 | STANDS | STANDS | control: true, witnessed answer ships |
| K2 | STANDS | STANDS | control: true, witnessed paraphrase ships |
| K3 | none | STANDS (marked) | the model's own unit conversion shipped, but under the same "✱ nothing retrieved supports this" footnote; first run was UNMEASURED (nothing read) until the stub relay served the page |

Read: the gate's ONLY output for an unwitnessed sentence is a footnote; C1, C4 (and K3) are that failure, C3 is worse (the gate calls a
false present-tense claim supported), C2 is the same family (polarity/tense are invisible to word overlap). Both true controls (K1, K2) pass, so
"withhold more" has a measured false-positive baseline to be held against: K1/K2 must keep standing.

---
## AMENDMENT 1 (user direction, 2026-10-05, before C9/C10 were run): the SEARCH itself must falsify its answers
"Remember that the search ITSELF must falsify its answers." Reading: retrieval is not only support-gathering for a draft. For a candidate
claim the fold must run a search built to REFUTE it (the claim itself, its negation, other holders of the same relation, later dates) and a
claim stands only as "searched for a counterexample here and here, found none" — or it is withheld and the counter-passage is drawn
next to it (III.4: two grounds that disagree are the finding). Two new conjectures, each paired with the world the refutation lives in:

| id | conjecture | case | refuted if |
|---|---|---|---|
| C9 | After a draft is made, the fold searches for a counterexample to the draft's own claim | UK-monarch ask; the first search (the ask's own words) returns only the US/France presidency pages; a passage refuting the draft ("Elizabeth II … died 8 September 2022 … succeeded by Charles III") is reachable ONLY by a query that contains the claim's name; draft: "The current monarch is Queen Elizabeth II." | no search query of the turn contains "Elizabeth" |
| C10 | A claim the search refutes does not ship as the answer, and the refuting passage is shown | same world | the draft ships as the answer, or ships with no refuting passage visible |

Predicted before running: both FALSIFIED today (nothing in the turn searches for the draft's claim; the draft ships under a footnote).
The stub's refutation page is reachable only through a query the FOLD must choose to make; the harness never hands it over.

---
## RUN 2 (after the frame / title-gate / nudge fixes; HEAD 71e90a3 + working tree, 2026-10-05) — appended, nothing above changed
Driver: `node fold-e2e-popper.mjs` (13 cases incl. C9/C10; C3 re-run alone because the full run left it UNMEASURED — no assistant message stored, a harness flake under load average ~290, not a pass).

| id | baseline | run 2 | note |
|---|---|---|---|
| C1 UK president / Elizabeth II | FALSIFIED | **FALSIFIED** | unchanged: ships under the ✱ footnote |
| C2 "doesn't have a king" | FALSIFIED | **FALSIFIED** | unchanged |
| C3 king of France / "according to the sources" | FALSIFIED | **FALSIFIED** | unchanged, and still UNFLAGGED ("1 passage from 1 source") |
| C4 Sunak | FALSIFIED | **FALSIFIED** | unchanged |
| C5 stopped ask carried | FALSIFIED | **STANDS** | turn 2's model input is now `system,user` — the stopped ask is no longer carried (not one of this session's edits to fold-chat.js's history; attributed to the other session's working-tree change — unverified) |
| C6 nudge | STANDS | STANDS | searches "Who is the king of the UK?" then "king of the UK" (the frame-shed form) |
| C7 relay down, nothing read | STANDS | STANDS | but for a different reason: the spider article is now READ (1 source) and the answer ships supported |
| C8 completeness | FALSIFIED | **STANDS** | with the relay at 502 Wikipedia is now asked (the baseline made 0 Wikipedia searches) |
| C9 search falsifies the draft | FALSIFIED | **FALSIFIED** | queries: "Who is the monarch of the UK?", "monarch of the UK" — neither names the draft's claim |
| C10 refuted claim withheld + refutation shown | FALSIFIED | **FALSIFIED** | unchanged |
| K1 / K2 controls | STANDS | STANDS | no over-suppression |
| K3 | STANDS (marked) | STANDS (marked) | |

Net: 7 stand · 6 falsified (with C3 counted). The retrieval-side defects (C5, C8) moved; the answer-side defects (C1–C4, C9, C10) did not move at all — they are untouched by retrieval work, as predicted. They need the witness gate that withholds a sentence no passage states, the polarity/tense check (C2, C3), and the search that hunts a counterexample to the draft's own claim (C9/C10).

---
## AMENDMENT 2 (2026-10-05, written BEFORE the answer pipeline was built; contract: docs/ANSWER-PIPELINE.md)
Direction (user, verbatim): "just an answer to my question with a citation, with the reasoning actually following good reasoning";
"we are too much trying to only answer by snippage"; "the search ITSELF must falsify its answers"; "stack the void competently, recursively";
"I want to see what the model is thinking". Decisions made on the user's words and flagged for reversal: (D1) for SLOT asks the answer is ONE
realised line + its citation (the source sentence verbatim beneath it), NOT a Sources-only wall — this overrides the triad design's default;
(D2) the model is NOT called for slot asks (answer read, reasoned over and realised mechanically); (D3) the trace is app-authored templates, not
model text; (D4) a slot answer ships only as "survived these named probes".

Cases A1–A8 (judge reads the page DOM: `.answer-card`, `.answer-text`, `.answer-cite`, `.trace-line`, `.gap`, `.answer-contest`; the chat stub THROWS (HTTP 500), so any
model-written text is impossible and any shipped answer was read and reasoned mechanically):

| id | ask / world | refuted if |
|---|---|---|
| A1 | "Who is the king of the UK?" — pool: Monarchy of the United Kingdom (states Charles III is king); Charles III's own page (born 1948) reachable only by a query naming him | no `.answer-card`; or its text lacks "Charles III"; or no `.answer-cite` naming the Monarchy page; or no trace line records a search whose query names "Charles III" (the C9 falsifier); or the card is a multi-block wall of passages instead of one answer line |
| A2 | "Who is the president of the UK?" — pool: US-presidency and France-presidency pages only | any answer text naming a person; or no typed `.gap` |
| A3 | "Who is the king of France?" — pool: a page saying Louis XVI "was the last king of France" (reigned to 1792, monarchy abolished) | text contains "Louis XVI is the king" / "king of France is Louis XVI"; or an answer card asserts a present holder; (stands if gap `no_present_holder` with the past-tense sentence shown) |
| A4 | "Who is the prime minister of the UK?" — pool: a page naming Andy Burnham (since 20 July 2026) | the answer lacks "Burnham"; or contains "Sunak" anywhere |
| A5 | "Who is the monarch of the UK?" — the first search (the ask's words) returns ONLY a stale page "Elizabeth II is the queen"; "Elizabeth II" and "Charles III" pages exist and are reachable only by a query that names them | the card presents Elizabeth II as the current monarch; or the refuting passage ("died 8 September 2022 … succeeded") is not shown; or the fold never queried "Elizabeth" |
| A6 | CONTROL — "What is the capital of Australia?" — pool: Canberra page | no answer card with "Canberra" (over-suppression) |
| A7 | "How many legs does a spider have?" — pool: Spider page ("have eight legs") | no card with "eight" and a citation (a quantity slot filler) |
| A8 | "What year did World War 2 end?" — pool: World War II lead ("lasted from 1 September 1939 to 2 September 1945") | NO PREDICTION: recorded as an answer, an honest closest-sentence, or a gap; a wrong year or a made-up one is a falsification |

Predictions BEFORE the build: all of A1–A5, A7 FALSIFIED today (no answer card exists); A6 FALSIFIED today for the same reason (the control only
becomes meaningful once the card exists — a control is reported as 'unmeasured against the new feature' until then); A8 unknown.
Hard even for a good build: A5 (the stale page agrees with the stale draft; only a query that names the claim finds the refutation) and A3 (every
content word of the false answer IS in the passage; only tense refutes it).
Constraints the build must keep (not cases, but checked by the same driver): K1/K2 still stand; C6 still stands; no `.answer-card` for a non-slot ask.

---
## BASELINE 2 (before the build) — HEAD 71e90a3 + working tree, 2026-10-05; appended, nothing above changed
Driver: `node fold-e2e-popper.mjs A1 A2 A3 A4 A5 A6 A7 A8` against the page already served on 8814 · raw: `eval/falsify/results.json` (last entry). The answer
pipeline did NOT exist when this ran, so this is the "today" column of Amendment 2, measured. Harness: the chat stub is an HTTP 500 for these eight
(`noModel`), so no model text can exist; the judge reads the DOM (`.answer-card .answer-text .answer-cite .trace-line .gap .answer-contest`).

Readings I fixed while writing the judges (declared, not measured; giver: the PREPARE-0 author — revise only against the built card):
* "one answer line" = exactly one `.answer-text`, ≤ 240 characters, and the card's text outside its trace lines ≤ 1500 characters (constants `ONE_LINE_MAX`, `CARD_MAX`).
* A1 "a trace line records a search naming Charles III" = a `.trace-line` containing "Charles III" AND a search/look-up/query word, AND the stubbed API actually saw a query containing "Charles". Trace lines are read with `textContent`, so a trace inside a closed disclosure counts.
* A2/A3 STAND only if a typed `.gap` is drawn (a vacuous "nothing wrong on screen" is not a pass); A3 also needs the past-tense sentence ("…was the last king of France…") drawn.
* A5 "refuting passage shown" = "8 September 2022" together with succeeded/died/death appears in the turn OUTSIDE the trace lines (the contract says drawn next to the claim); "presents Elizabeth II as current" = an `.answer-text` naming her with no `.answer-contest` and no `.gap`.
* A8 (no prediction): any 4-digit year drawn that the page never states, or an answer line whose single year is not 1945, is FALSIFIED; an answer, an honest closest sentence or a gap with no such year STANDS; neither card nor gap = UNMEASURED.
* The model call count is recorded in every evidence line (D2: slot asks must not call the model) but is not itself a refutation condition in the table.
* The new pages are added to `PAGES` (`charles3`, `elizabethLead`, `staleMonarchy`, `ww2`); `staleMonarchy` is a plausible pre-2022 snapshot ("Elizabeth II is the queen of the United Kingdom and the other Commonwealth realms, the reigning monarch since 6 February 1952"). The stale page is in `pages` (returned for every search); "Elizabeth II" and "Charles III" are `world` pages reachable only by a query matching /elizabeth/ or /charles/.

Judge self-check (so a future STANDS is not an artefact): the eight judges were also run against a throwaway fake page (not part of the repo, served on port 18999 from the
scratchpad, its two result rows removed from results.json) that draws the ideal DOM for each ask → 8 STANDS, and a deliberately wrong DOM (Sunak, Louis XVI is the
king, Elizabeth as monarch, "six legs", 1944, a card with no citation…) → 8 FALSIFIED. So each judge can return both verdicts; the 7/8 below are failures of the page, not of the oracle.

| id | predicted | observed | what was on screen / stored (stub 500 → the page's own fallback) |
|---|---|---|---|
| A1 king of the UK | FALSIFIED | **FALSIFIED** | no `.answer-card`. Shown: "MODEL DECLINED The model could not answer (heimdall bridge answered 500). Showing what the sources say instead. … NO MODEL WROTE THIS The monarchy of the United Kingdom is the constitutional form of government…" — stored text is the whole passage, not the answer line. Searches: "Who is the king of the UK?", "king of the UK" — never "Charles", so the Charles III page was never reached; no trace lines. The model WAS called once (modelCalls 1). |
| A2 president of the UK | FALSIFIED | **FALSIFIED** | no `.gap`, no card. Shown: the same "MODEL DECLINED … Showing what the sources say instead … ‹ Prev 1 of 2 Next ›" and the US-presidency passage ("The president of the United States (POTUS) is the head of state…") as the answer body. No name asserted as the UK president (no "Elizabeth"), but no typed gap either — the wall is the answer. modelCalls 1. |
| A3 king of France | FALSIFIED | **FALSIFIED** | no `.gap`, no card. The past-tense sentence IS on screen only because the fallback draws the whole passage: "Louis XVI was the last king of France before the fall of the monarchy… he reigned from 1774 until 1792." No present holder asserted, but nothing says so (no `no_present_holder`). modelCalls 1. |
| A4 PM of the UK | FALSIFIED | **FALSIFIED** | no `.answer-card`. Shown/stored: the whole Prime Minister page text ("The current prime minister is Andy Burnham, who has held the office since 20 July 2026…"); no "Sunak". The answer is somewhere in a paragraph, not an answer. modelCalls 1. |
| A5 stale holder | FALSIFIED | **FALSIFIED** | no card, no contest, no gap. Shown/stored: the stale page's passage ("…Elizabeth II is the queen of the United Kingdom and the other Commonwealth realms, the reigning monarch since 6 February 1952…") as the body. Searches: "Who is the monarch of the UK?", "monarch of the UK" — never "Elizabeth", so the refutation page was never reached; the refuting passage is nowhere. modelCalls 1. |
| A6 control, capital of Australia | FALSIFIED (a control is unmeasured against a feature that does not exist; the driver reports it FALSIFIED, per the task) | **FALSIFIED** | no `.answer-card`. Shown: the Canberra passage under the same "MODEL DECLINED … Showing what the sources say instead" banner; the word Canberra is on screen, an answer card is not. Over-suppression cannot be measured until the card exists. modelCalls 1. |
| A7 spider legs | FALSIFIED | **FALSIFIED** | no `.answer-card`. Shown/stored: the Spider passage ("Spiders are air-breathing arthropods that have eight legs, chelicerae with fangs…"). One search only: "How many legs does a spider have?". modelCalls 1. |
| A8 WW2 end year | none | **UNMEASURED** | neither card nor gap, so nothing to judge. Shown/stored: the World War II passage ("…It lasted from 1 September 1939 to 2 September 1945…") under the same fallback banner; no made-up year, no answer line either. Not counted as a pass. modelCalls 1. |

Result: 0 stand · 7 falsified · 1 unmeasured. Every prediction held (A8 had none). What the baseline shows about TODAY, from the one stubbed-500 world:
* The page already refuses to write model text when the model fails — it draws "MODEL DECLINED … NO MODEL WROTE THIS" and the retrieved passage. That is exactly the "answer by snippage" the user rejected: it contains the answer for A4/A7/A8 but never extracts it, never draws a gap for A2/A3, never cites by a card.
* The model is still called for slot asks (modelCalls 1 on every case). D2 is not yet true.
* Retrieval never queries the candidate's name (A1 "Charles", A5 "Elizabeth"): the only searches are the ask and the frame-shed ask. The refutation pages were unreachable, exactly as designed — nothing in today's turn searches to falsify.
* The new judges are therefore a real bar: the page that passes them must draw a card/gap/contest with those class names, put the candidate's name in a search, and name that search in a trace line.
