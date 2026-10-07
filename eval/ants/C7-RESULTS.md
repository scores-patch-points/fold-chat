# C7 — RESULTS (2026-10-06): one ethos, every model-voiced path

Pre-registered in `C7-PREREG.md` before any run. Full audit table, evidence and design: `docs/ETHOS-PATHOS-PATHS.md`. No model was called. Real data: `eval/voice/threads.json` (8 real threads of the real page, gemma2:2b).

## Pre-registered audit claims — all six held; none was refuted
| claim | result |
|---|---|
| A1 agent lane gets no ethos/pathos | HELD. The real `runAgent` over a fake door built 3 dispatch prompts (task; two repair prompts): **0** match an ethos/pathos/atmosphere/rhythm/archon/ground vocabulary regex; the reset-base prompt, a direct repair prompt and the remote system line were printed and read by eye (none) (`c7/audit-output.txt`). |
| A2 chat pathos almost never reaches the model | HELD, stronger than predicted: reading present at **0 of 24** real prompts (8 threads × 3 turns); t1 `no_model_authored_answers`, t2/t3 `too_few_answers`. A 4th ask would read `ground_holds` on 4 of 8 threads (no cue either way). |
| A3 curve unmeasured, strain "report" | HELD: `pathosOf` on 5 real answers → curve measured **0/5**, strain ≠ report **0/5**; rhythm flatline on 2/5. The chat reads 2 of the 4 inputs (experiencer, rhythm). |
| A4 voice/counsel/primary unwired in the chat | HELD: `fold-chat.js` imports none of voice, counsel, thinkers, primary (it does import originwire, carry, pathos, pivot, provenance, self, agent). |
| A5 Pivot pathos is whitespace-only | HELD: on a real answer the spoken text equals the draft modulo whitespace; `felt` is not returned into any prompt. |
| A6 Paradigm read nowhere in the chat | HELD: `notes: []` (`fold-chat-carry.js:66`); `paradigmBlock`/`resolutionBlocks` referenced in no `fold-chat*.js`. The khora conductor reads it (`proxy-runner.mjs:5664`, level 3) and a measured curve (`:5468`) — the chat's text path never calls it. |

Unpredicted: (1) `carryOf.basis` prints `[object Object]` (real bug, `fold-chat-carry.js:74`); (2) Atmosphere is empty on the reflective threads R1/R3 ("no referent established yet") — where pathos and voice matter most; (3) three identical failing rounds read `ground_holds`, not `stale` (rhythm variance), so the code lane's stale register is not reachable by Murch; its `repeats` count is reported beside; (4) a fixed-then-returned finding IS the organ's `contested` (strain `strict` from `cycles`), measured not inferred; (5) the chat and khora declare different experiencers; (6) vetting withholds titles like "Never Let Me Go" (safe-side cost).

## What is built (new files only)
* `fold-chat-ethos.js` — `ethosFor`, `laneOf`, `runRecord`, `vetFact`, `quoteIsVerbatim`, `ETHOS` (frozen lane table). Pure; the model, voice index/bank and clock are not touched or are injected.
* `fold-chat-ethos.test.mjs` — **27 tests pass**. `eval/ants/c7/mutate.mjs` — **30/30 mutants killed** on the final run (first run 25/30; survivors and the fixes are in `docs/ETHOS-PATHOS-PATHS.md`; `c7/mutate-output-run1.txt` and `mutate-output.txt` both kept, nothing edited after the fact).
* Pre-registered "must NOT do" gates N1-N10 (never impersonate, never invent a quote, never add a score, silence default, facts not directives, declared experiencer from the record, purity, no-voice lanes get nothing, the code model never gets feelings, gaps are said) — each has a test and at least one killing mutant.
* `docs/ETHOS-PATHOS-PATHS.md` — the table (13 paths × a/b/c/d with file:line), the evidence, the proposal, the wiring table, the decisions.
* `eval/ants/c7/` — `audit.mjs`, `audit2.mjs` (+ outputs), `mutate.mjs` (+ outputs), `wiring-check.mjs` (+ output), and the four **not-applied** diffs: `wire-fold-chat.diff` (chat/writing/none lanes, voice kit, aside notice, agent callback), `wire-fold-chat-agent.diff`, `wire-fold-chat-carry.diff`, `wire-fold-chat-counsel.diff`. Each passes `patch --dry-run -p1` against the tree as it was.

## What is wired — nothing in a shared file
Everything is a proposal. Verified on patched COPIES (scratchpad): the chat replacement hands `cuesFor` exactly what `readFelt` did on 24/24 real prefixes; the code model's four prompts are byte-identical with and without the shared pathos, and a flip-flopping run (A, B, A, A) escalates the maker with reason `contested` only when `ethos` is passed (`c7/wiring-check-output.txt`); 161 of 162 tests in agent/carry/counsel/ethos/pathos/flow/agentfeed pass on the patched copy (the 1 failure reads `eval/cases.json`, which I left out of the copy). `fold-chat.js` is DOM code and was only syntax-checked (`node --check`), not run: **the chat wiring has not been exercised in the real page.**

## What is NOT done
* The chat/writing/agent/counsel wiring is not applied (shared files vetoed). The aside's UI (a `voice` notice label, an "open the audit" control) is not drawn.
* **No call site for counsel exists** in the chat; the counsel diff only adds an optional `context` parameter.
* No model was run: whether the cues improve small-model answers is unmeasured (needs the falsifier driver). The counsel-context A/B (B3's harness) was not run.
* Paradigm and the pathos curve remain typed gaps on every lane (khora reader work / a fold per exchange). The khora loop lane (`/api/agent`) and khora's own conductor prompt were not traced beyond the routes.
* The chat's `s.voice` rate bookkeeping and `voiceKit()` fetch of `voice/*.json` are untested in a browser (the page must serve `voice/`).
* I did not validate `voice-bank.json` quality (several bank sentences are poor quotes) — that is the voice lane's; the shared block re-checks verbatim-ness only.

## What the user must decide
1. **Whose pathos** — the model that wrote the answer (chat today), the person at the door (khora's conductor), or the maker (this proposal for the code lane).
2. **The aside's gate and rarity** — gate ON means it speaks only on `stale`/`contested`, which was 0/24 on real threads; OFF makes it rate-limit-only. And whether `minAnswers = 3` (declared) should drop.
3. **Should a model ever hear a pathos sentence?** (today the `stale` cue is withheld for Terry); the code model never does under N9.
4. **Counsel context** on or off, decided by B3's harness, not by taste.
5. **The code lane:** may a `contested` run escalate its maker; is an aside at the end of a run wanted.
6. **Paradigm:** khora reader work (stage 3) or calling the khora conductor's turn for the triad.
7. Apply the diffs (and the `[object Object]` fix, which is independent and safe on its own).
