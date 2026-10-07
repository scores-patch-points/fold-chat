# One ethos, every model-voiced path — audit, evidence, and the shared block (C7, 2026-10-06)

User, 2026-10-06: "the agentic thing doesn't have this type of pathos added to it … they all have the same grounding in ethos" and "this should be wired into what we call chat, not just
querying the pipeline for reasoning." This document audits every place the system produces text a model voices (or that sits beside such text), says what each path receives, shows
the evidence, and proposes ONE pure module every path can call. **Nothing here is applied to a shared file.** Pre-registration: `eval/ants/C7-PREREG.md`; results: `eval/ants/C7-RESULTS.md`.
Line numbers are the working tree at audit time (other sessions are editing `fold-chat.js`; the numbers drift).

## The short answer

* The chat gets pathos **in code but not in effect**: on the 8 real threads of `eval/voice/threads.json` (the real page, gemma2:2b) `readFelt` produced a reading at **0 of 24** real prompts
  (it needs 3 earlier model-authored answers; a prompt for turn N has N-1), and even when it reads (a 4th ask on 4 of 8 threads) the condition is `ground_holds` and no sentence is spoken.
* Of the four pathos inputs the chat reads **two** (experiencer, rhythm). Strain is "report" and the curve is unmeasured on all five answers I ran `pathosOf` over; both are declared gaps.
* The **agent/code lane receives nothing**: its prompts are the task, the prior code and the measured findings (3 of 3 prompts built by the real `runAgent`, 0 contain any ethos/pathos vocabulary).
  Chat's pathos also **excludes agent turns** by rule (`fold-chat-pathos.js:49`), so the same conversation has no felt shape across a hand-off to the agent.
* **Voice-of-content, counsel and the primary-source finder are wired nowhere** in `fold-chat.js` (no import of any of them).
* **Paradigm is read nowhere in the chat** (`notes: []`, `fold-chat-carry.js:66`; `paradigmBlock` is never called). The khora conductor does read it (`proxy-runner.mjs:5664`, level 3) and does measure a pathos
  curve (`:5468`), but the chat's text path (`/v1/chat/completions`, a bare model) never goes through it. That is the user's complaint, located.

## The table

Legend: **yes** = receives it and it can reach the model/the person · **partial** = computed but cannot reach the voice, or reaches only a piece · **no** · **n/a** = no model voice on this path (app-authored or the sources' own words).
(b) lists which of the four pathos inputs are READ (E experiencer · R rhythm · S strain · C curve); a typed gap is not a read.

| # | path (entry) | (a) shared ethos grounding (Atmosphere / Lens / Paradigm) | (b) pathos | (c) voice stage 1-2 | (d) provenance |
|---|---|---|---|---|---|
| 1 | **Chat answer**: research / chat / advice / thread follow-up (`fold-chat.js:2126-2129`, `composeTurn` :2155) | **partial** — Atmosphere + Lens ride as `Flow:` inside the summary (`applyCarry`, :2568; `fold-chat-carry.js:64-66`), only once a referent exists; **empty on reflective threads** (R1, R3: "no referent established yet"); Paradigm **no** (`notes: []`) | **partial** — E, R read; S "report" and C unmeasured (declared gaps); 0/24 real prompts had a reading; a `stale` sentence is withheld because Terry speaks it (`fold-chat-pathos.js` header) | **no** (not imported) | **yes** — second model call POINTS, app narrates (`fold-chat.js:2357-2360`, `fold-chat-provenance.js`) |
| 2 | **Chat writing**: generate / compose (`fold-chat.js:2038`, `GENERATE_NUDGE`) | **partial** — only the summary's Flow, if any; no cue | **no** (`conversational` is false for these kinds) | no | partial (record + source line; no pointer on generate/compose, :2357 guard) |
| 3 | **Chat compute / transform / code / smalltalk** (`COMPUTE_BASE` :2037, `KIND_PROMPT`) | no — correctly: the model only words a computed value or the person's own text | no — correctly | no — `VOICE.kindsOff` | compute: evaluator value re-checked (`answerKeeps`); transform: grounded against the person's text |
| 4 | **Chat secondary model calls**: continue (:2231), restate (:2269), provenance pointer (:2360) | n/a — each is a mechanical operation on the draft or a pointing task (prompts printed in `eval/ants/c7/audit2-output.txt`) | n/a | n/a | the pointer IS provenance |
| 5 | **The Pivot** (`fold-chat-pivot.js:303-321`, called :2324) | no | **partial** — `pathosOf` is read over the *spoken* text for the model as declared experiencer and changes **paragraph breaks only** (whitespace; verified on a real answer: text identical modulo whitespace); never reaches a prompt | no | **yes** — per-sentence checks, `verifyPivot` |
| 6 | **Slot turn / Sources-only strand** (`runSlotTurn` :2055, `snipsOf` :2089) | n/a (no model text; the sources' own words) | n/a — `authored:"sources"` is excluded from the fold's rhythm | n/a | yes — the source line |
| 7 | **Self / gap lines** (`SELF_LINE` `fold-chat-self.js:38`, `fold-chat-gaps.js:52`) | n/a — static, app-authored | n/a | n/a | n/a |
| 8 | **Counsel** (`fold-chat-counsel.js:164` draft prompt, `:253` `counselFor`) | **no** — prompt = giver, work, passages, question; no Atmosphere/Lens | no | it *is* a voice (the thinker's verbatim words), but is **not called** by the chat | **yes** — number-pointing + tie gate |
| 9 | **Voice aside** (`fold-chat-voice.js:141` `asideOf`) | uses its own concern-field index, not the Atmosphere/Lens | takes the *condition* as a gate input but **nothing supplies it** | **it is stage 1-2** — **not wired** | yes — file span + sha256 in the aside |
| 10 | **Agent lane, penelope compose** (`fold-chat.js:2693` → `/api/code`; prompts `fold-chat-agent.js:230` `withBase`/task, `:363` `repairPrompt`) | **no** | **no** (no read at all; agent turns are excluded from chat's read, `fold-chat-pathos.js:49`) | **no** | partial — observed facts (sandbox, janus) decide, but no source line |
| 11 | **Agent lane, remote escalation** (`fold-chat.js:2679`, `client.remoteCode` `fold-chat-client.js:918`, `:939`) | **no** — fixed system line + prior code + task (printed in `audit-output.txt`) | **no** | **no** | audit record of what left (de-id, `sent`) |
| 12 | **Agent lane, khora loop** (`fold-chat.js:2690` → `/api/agent`) | **not traced** — the khora conductor owns that prompt | **not traced** | not traced | — |
| 13 | **Unified Fold server** (`../fold/server/routes.mjs:43-56`): heimdall wire doors, janus `/v1/reason`, penelope `/v1/draw` `/v1/mouth` `/api/weave`, khora `/v1/*` | the server only routes. **khora**'s turn computes Atmosphere/Lens/**Paradigm** (`resolutionBlocks`, level 3, `proxy-runner.mjs:5664`) from real ledger notes — the chat never calls it for text | **khora** reads `pathosOf` with a **measured curve** over the fold and a re-ground ledger (`:5468`), experiencer = the person at the door, carried on the result, not into the prompt; `../fold/server/think.mjs` recognises pathos **only from an explicit marker, never prose** (a second, stricter definition) | **penelope**'s generation door has an archon-routed voice layer for kind `chat` draws only (`generation-door.mjs:115`; steersman → `voice.mjs`: archon *jurisdictions* frame the draw, no name reaches the model) — a different voice mechanism from `fold-chat-voice.js`, and the chat does not call it | each organ keeps its own record |

### Evidence I produced by calling the real functions (`eval/ants/c7/audit-output.txt`, `audit2-output.txt`; no model called)

**`pathosOf` on 5 real model-authored answers** (declared experiencer = the model that wrote them, as `fold-chat-pathos.js` declares it):

| thread | answer (start) | forWhom | rhythm | strain | curve |
|---|---|---|---|---|---|
| R1 | "Agree to discuss disagreements calmly…" | model:gemma2:2b / conversation:R1 | n=5, blinks 1, flatline false | report | unmeasured |
| R2 | "The sources you shared discuss…" | model:gemma2:2b | n=3, blinks 1, flatline false | report | unmeasured |
| R3 | "There are a few ways people deal with fear…" | model:gemma2:2b | n=4, blinks 2, flatline false | report | unmeasured |
| R5 | "The sources I read about patience suggest…" | model:gemma2:2b | n=3, blinks 0, **flatline true** | report | unmeasured |
| R2 | "Discusses people sharing their experiences…" | model:gemma2:2b | n=2, blinks 0, **flatline true** | report | unmeasured |

Curve measured on **0/5**, strain ≠ "report" on **0/5**. `pathosOf` with no experiencer is refused, as the organ's law says.

**`readFelt` at the prompt of each turn of the 8 real threads:** t1 `no_model_authored_answers`, t2/t3 `too_few_answers` on every thread (R4/R5's first answers were empty). Reading present at **0/24** prompts. A hypothetical 4th ask would
read `ground_holds` on R1, R2, R3, L2 and still be a gap on R4, R5, L1, L3 (a Sources-only answer is excluded, as are the withheld ones).

**What the chat's prompt really carries** (real thread L1, turn 3, through the page's own `garyDoor.composeTurn` + `applyCarry`): base + Terry Gross' act cue ("the person asked something — the answer is theirs to reach…") + `PAST DISCOURSE … Flow: For 2 exchanges the conversation has stood on The Eiffel
Tower, Maurice Koechlin and Émile Nouguier…`. No pathos sentence, no voice. On the reflective threads (R1, R3) `carryOf` returns `basis: "no referent established yet"` and an empty Atmosphere — the very conversations where pathos and voice are meant to matter.

**The agent lane's exact prompts** (the real `runAgent` over a fake door; task "Build a tip calculator page with 10%, 15% and 20% tip buttons and a Save button."): round 1 is the task verbatim (80 chars); rounds 2-3 are
`Fix the code you just wrote. This is attempt N.` + `The original task: …` + `When the code was run, it showed these problems: 1. … 2. …` + `Return the complete corrected file only — no explanation, no partial diff.`; a reset base is `Here is the current page. Change it as asked and reply with the whole updated file.` + the code +
`Change: …`; the remote draw adds `You are a careful senior engineer…` as the system line. **0 of 3** contain any ethos, pathos, atmosphere, rhythm or archon vocabulary.

### Findings I did not predict
1. **`carryOf`'s `basis` prints `[object Object]`** (`fold-chat-carry.js:74` joins Atmosphere's string with the Lens's *object* `{notes, voids, records}`). Cosmetic today (the basis is for the record), but it is in the carry that rides every turn. Fix in `wire-fold-chat-carry.diff`.
2. **Same failure three times is not `stale` by rhythm.** Three identical rounds of the same two findings read `ground_holds` (Murch's variance is high because the two findings differ in length). The loop's own `stuck` rule (`fold-chat-agent.js` `sig`) is the working "stale" for the code lane; I report its count (`repeats`) beside the condition and never relabel it.
3. **Repairs undoing each other IS expressible** as the organ's own `contested`: a finding that is fixed and returns is a directed cycle on the record, `strainOf({cycles:1})` is `strict`. Measured, not inferred from prose.
4. **Two conventions for "who undergoes".** The chat declares the *model* the experiencer (`fold-chat-pathos.js`); the khora conductor declares the *person at the door* (`proxy-runner.mjs:5467`). Both satisfy the organ's law; they are different readings. The shared block keeps the chat's (and uses the run's maker for the code lane). User decision below.
5. **Over-withholding on titles.** The fact vetting (no directives) withholds an Atmosphere that carries `Never Let Me Go` ("never"), and says so as a typed gap. Safe side; a cost.

## The proposal: `fold-chat-ethos.js` (new, pure, 27 tests, 30/30 mutants killed)

```
ethosFor({ lane, kind, session, messagesBefore, question, rounds, task, names, convo, memo, voice, naturalBreak })
  → { lane, cues:[{from,text}], aside:{text,audit}|null, parts:{atmosphere,lens,paradigm,pathos,voice}, gaps:[{part,why}], memo, basis }
laneOf({ kind, threadTurn, modelBarred, slot, strand, agent })  → "chat" | "writing" | "agent" | "none"
runRecord(rounds) → the code lane's record as the pathos organ reads it (observed findings as sentences, the maker as experiencer, `cycles` = repairs that came back)
vetFact(text) → { ok, why }      quoteIsVerbatim(aside, {texts, bank})
```

* One function, one lane table (`ETHOS.lanes`, frozen, each lane with its `why`). **chat**: Atmosphere/Lens (reported; they already ride in the summary), the four-input pathos read, a rare aside. **writing**: the Atmosphere as one fact.
  **counsel**: the Atmosphere as one fact (the aside is off: the draft already is the voice). **agent**: pathos over the rounds + an aside at a natural break; **no cue for the code model**. **none** (slot, strand, self, gap, compute, transform, code, pointer, restate, continue): nothing.
* The model-facing channel is the chat's existing one: `cues` go into `garyDoor.composeTurn({cues})`, so Gary reads them again at the door. The aside is **never** in a prompt: it is the app's fixed frame around a verbatim sentence, spoken after the Pivot on the notice channel.
* The code lane's pathos is the SAME organs over its own record: experiencer = the maker the door reported (never a label), rhythm over the observed outcomes, strain from `cycles`, curve a declared gap. The condition steers the loop (a `contested` run escalates the maker) and the person-facing aside; the code model's prompt is byte-identical (checked, `wiring-check-output.txt`).
* Honest scope: Paradigm is a typed gap everywhere (needs ledger notes at sentence grain — khora reader work, stage 3 of `docs/VOICE.md`); the curve is a typed gap on every lane until a fold is supplied.

### What it must NOT do — pre-registered (N1-N10) and enforced

| gate | enforced by | mutants killed |
|---|---|---|
| N1 never impersonate — a holder is named only in the fixed aside frame; the frame is re-derived and compared; "speaking as X" refused | `asideFor` frame check, `vetFact` | frame-altered, speaks-as, holder-name, hostile `asideOf` |
| N2 never invent a quote — the quote is re-found in the injected canon/bank at the stated span, not trusted from the voice module | `quoteIsVerbatim` | re-verification deleted, checker always-true |
| N3 never add a score — no rating vocabulary, ratio or percent in a cue or in the aside's frame; numbers live only in `aside.audit` | `SCORE` | facts + frame |
| N4 silence is the default — typed reason for every non-offer | `permitted`, lane table | gate always-off, lane aside on |
| N5 facts, not directives; no apparatus words | `vetFact` | directive, apparatus ×2, cues-not-vetted |
| N6 pathos only for a declared experiencer read from the record; unverified maker = gap | `readFelt`, `runRecord` | maker gate, round gate, cycles, label-trusted |
| N7 pure — deep-equal on repeat, inputs untouched, no clock/random/IO in source | test + source scan | clock, mutation of input |
| N8 lanes the model may not voice get nothing | `laneOf`, `ETHOS.lanes.none` | barred/slot/strand ignored |
| N9 the code model never gets feelings; aside only at a natural break | `cuePathos:false`, `cueAtmosphere:false`, `naturalBreak` | 3 |
| N10 gaps are said (curve, Paradigm, unverified maker, too few answers) | `gaps[]`, `inputs.curve.status` | 4 |

First mutation run: 25/30 (survivors: frame check, frame score gate, a clock in the source, uncheck of cue vetting, and one equivalent mutant — lane `none` already empty by the lane table). Fixed by making the voice decision injectable (so a hostile one can be tested), reading the *module under test* in the purity scan, and a typed-reason assertion; second run 30/30. Both outputs are kept (`mutate-output-run1.txt`, `mutate-output.txt`).

## The wiring, per path (diffs under `eval/ants/c7/`, NOT applied; each `patch --dry-run -p1` applies clean to the tree as of this audit)

| path | diff | what it changes | verified how |
|---|---|---|---|
| 1 chat · 2 writing · 3 none | `wire-fold-chat.diff` | imports; replaces the `readFelt` block with `laneOf` + `ethosFor` (feltInfo keeps its shape, `cuesFor` untouched); `cues: [...flow, ...eth.cues]` into `composeTurn`; the aside as a `voice` notice after the Pivot (never on a strand or slot turn) with `s.voice` rate bookkeeping; a lazy `voiceKit()` that fetches `voice/voice-index.json` + `voice-bank.json` and falls back to null | `node --check`; **24/24** real prefixes hand `cuesFor` exactly what `readFelt` did (`wiring-check-output.txt`) |
| 10 · 11 · 12 agent | `wire-fold-chat-agent.diff` (+ the `runCode` hunk in `wire-fold-chat.diff`) | `runAgent({ ethos })`: a `pathos` event per failed round; `contested` escalates the maker like `stuck`; `rounds[].maker` recorded; `runCode` wires the callback and an aside at the natural break | patched copy: prompts byte-identical with/without ethos (4/4), `contested` escalation fires only with ethos; the 161 tests of agent/carry/counsel/ethos/pathos/flow/agentfeed that can run pass (the 1 failure is a fixture I excluded from the copy) |
| carry | `wire-fold-chat-carry.diff` | fixes `[object Object]` in `basis` | patched copy, carry tests pass |
| 8 counsel | `wire-fold-chat-counsel.diff` | `draftMessages`/`counselFor` take an optional `context` (the Atmosphere as "what the question refers to — not the thinker's words") | patched copy, counsel tests pass; **no call site exists in the chat**, so nothing is wired until the boss decides where counsel is called |
| 5 Pivot | none | it already reads `pathosOf` for paragraphing; leave | — |
| 9 voice aside | via 1 and 10 | `ethosFor` is the one caller | module tests on a synthetic roster |
| 13 server | none | the chat could call khora's turn for the triad, but that is the user's architecture call (below) | — |

## What the user must decide

1. **Whose pathos?** Chat: the model undergoes its own answers (current). khora conductor: the person at the door. The code lane in this proposal: the maker. A single convention (or an explicit two) should be chosen before the aside's gate keys off it.
2. **The aside's gate and rarity.** Gate ON (default here) means an aside only when the real condition is `stale`/`contested`, which on today's real threads is almost never (0/24 readings). Gate OFF (rate-limit only) would speak more but is not driven by pathos. And `minAnswers = 3` could be lowered (declared, not measured).
3. **Should the model ever hear pathos?** Today the only model-facing pathos sentence is withheld for `stale` (Terry speaks it). The block can hand the model `contested`/`collapse` cues; whether small models write better with them needs the falsifier driver (`answer-pipeline-popper`), not an assumption.
4. **Counsel context.** Hand the draft the Atmosphere ("what the question refers to") or keep the draft passages-only? B3's harness can A/B it; I did not run a model.
5. **The code lane.** OK that its condition may escalate the maker (`contested`)? OK that the code model never hears a feeling (N9)? Is the aside at the end of a run wanted at all?
6. **Paradigm.** It needs resolved ledger notes: either khora's reader stages 5b-8 (touching khora, ask first) or call the khora conductor's turn for the triad (a pipeline call, which the user said is not enough on its own).
7. **Roster/quality of the bank** is the voice lane's: several of the real bank sentences are poor quotes ("The Babylonian talent is equal to seventy Euboic min?e."); the shared block re-verifies they are verbatim, not that they are worth saying.
