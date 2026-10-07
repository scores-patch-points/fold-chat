# C7 — one ethos, every model-voiced path: pre-registration (2026-10-06, written BEFORE any run)

Task (boss): audit every place the system produces model-voiced text for (a) the shared ethos grounding (Atmosphere / Lens / Paradigm), (b) pathos with its four
inputs (experiencer, rhythm, strain, curve), (c) voice-of-content stages 1-2, (d) provenance; then propose a pure shared module `fold-chat-ethos.js` and per-path
wiring diffs (NOT applied). User's words: "the agentic thing doesn't have this type of pathos added to it ... they all have the same grounding in ethos";
"this should be wired into what we call chat, not just querying the pipeline for reasoning."

Method: read the code for each path, then CALL the real functions (pathosOf, readFelt, carryOf, runAgent with a fake door, the chat's own composeTurn) over real
data (`eval/voice/threads.json`: 8 real threads of the real page, gemma2:2b, real web, spoken answers stored). No model is called by this ant.

## Audit predictions (a counterexample refutes each; reported either way)
* **A1 — the agent lane gets no ethos and no pathos.** Every prompt `runAgent` builds (first prompt, first prompt from a reset base, repair prompt, the remote
  system + user parts) is built only from the task, the prior code and the measured findings. Refuted if ANY of them contains an Atmosphere/Lens line, a pathos
  cue sentence, or an archon/holder name.
* **A2 — the chat's pathos almost never reaches the model.** `readFelt` needs >= 3 model-authored answers (`PATHOS.minAnswers`), and the prompt for turn N holds
  only N-1 answers. So on the 8 real 3-turn threads the cue/felt for the turn-3 prompt is a typed gap `too_few_answers` on 8 of 8. Refuted if any thread yields a
  felt reading at turn <= 3. (A longer real thread, if one exists in the repo, is run too and reported.)
* **A3 — all five spoken-text pathos reads have curve UNMEASURED and strain "report".** `pathosOf` on 5 real answers returns `curve.measured:false` and
  `strain:"report"` for every one (nothing in the chat supplies a fold or a contradiction record). Refuted by one measured curve or one non-"report" strain.
  So of the four pathos inputs the chat reads two (experiencer, rhythm) and declares two as gaps.
* **A4 — voice-of-content (stage 1-2), counsel and the primary-source finder are wired nowhere in the chat.** `fold-chat.js` imports none of
  fold-chat-voice / fold-chat-counsel / fold-chat-thinkers / fold-chat-primary. Refuted by one import.
* **A5 — the Pivot's pathos is whitespace-only.** pathosOf in `fold-chat-pivot.js` changes paragraph breaks and never reaches the model. Refuted if the felt
  result is returned into any prompt.
* **A6 — Paradigm is read nowhere in the chat.** `carryOf` passes `notes: []` and requests level 2 (Atmosphere + Lens); `paradigmBlock` is never called by the
  chat. Refuted by one call site.

## What the shared block must NOT do (pre-registered gates; each gets a unit test AND a mutation check — delete the gate, a test must fail)
* **N1 never impersonate.** No model-facing line names a holder/archon or speaks in the first person as one; the only place a holder is named is the
  app-authored aside, and that is the fixed frame `This reminds me of something <holder> wrote about <topic>: “<verbatim>” ...` — their words in quotation marks,
  never a paraphrase, never "as <holder>, I".
* **N2 never invent a quote.** Every quote in an aside is `canon.slice(start,end)` of the loaded text/bank (checked again inside the shared module, not trusted from
  the voice module); an aside whose quote is not found verbatim is dropped (no aside), never repaired.
* **N3 never add a score.** No digit-rating, `score`, `p=`, `%`, `/10`, "confidence" or "how good" in any model-facing line or any spoken aside. Audit numbers live
  only in the `audit` record that a person can open, never in `cues` or `aside.text`.
* **N4 silence is the default.** No referent, no resonance beyond the null, a lookup/compute/transform/code kind, a first exchange, a rate-limited turn, or an
  unread pathos gate => `cues: []`, `aside: null`, with a typed reason. Never filler.
* **N5 facts, not directives.** Model-facing lines are information about the conversation/run, never an instruction or a prohibition ("do not", "never", "you must",
  an imperative opening) and never apparatus vocabulary ("passage", "prompt", "retrieved", "archon", "pathos", "ethos", "atmosphere").
* **N6 pathos only for a DECLARED experiencer, read from the record.** The experiencer is derived from what the turn/round itself records (the model that wrote it),
  never from a label on a message; the person's own words are never read as the fold's rhythm; the block never states what the person feels.
* **N7 purity.** Same input => deep-equal output; the source contains no Date/Math.random/fetch/process/fs/DOM. The model and the voice bank are injected.
* **N8 lanes the model may not voice get nothing.** Slot turn, Sources-only strand, self line, gap line, compute and transform kinds: `cues: []`.
* **N9 the agent's model never gets feelings.** For the code lane the pathos CONDITION steers the loop (escalate / stop / what to tell the person); the code model's
  prompt gets only measured, impersonal findings. The aside is app-spoken at a natural break, never inside a prompt.
* **N10 gaps are said.** The curve is listed as an unmeasured gap on every pathos read until a fold is supplied; Paradigm is listed as a gap until ledger notes are
  supplied; neither is ever filled in.

## Not tested here (named)
Any model call; whether small models write better with the cues (that needs the falsifier driver, `answer-pipeline-popper`); stage 3 paradigms from ethos notes (khora
reader work); the user's decisions (roster, rarity, whose experiencer). The wiring diffs are proposals — nothing in shared files is applied.
