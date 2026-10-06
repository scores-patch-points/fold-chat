# The Pivot — ordinary generation, read before it is spoken (2026-10-06)

`A NL → B read-grammar → C EOT → D write-grammar → E NL` (memory `the-pivot`). For every turn where a model writes, the model's text is a
DRAFT. It is read into an event record and the words the person sees are realised from the sentences that survived. Code:
`fold-chat-pivot.js` (pure), wired in `fold-chat.js` `run()` (search "THE PIVOT"). Tests: `fold-chat-pivot.test.mjs` (unit, forced-bad
drafts, mutation-checked), `fold-e2e-pivot.mjs` (the real page), `eval/pivot/live.mjs` (a real small model). Pre-registration and results:
`eval/pivot/PREREG.md`, `eval/pivot/RESULTS.md`. A look: `eval/pivot/show/` (`preview_start pivot-demo`).

## What changed in the chat
* The model's tokens are NOT streamed to the page any more (they were; `onToken` appended them live and a later pass only edited the stored
  copy). The page shows "drafting… (read before it is shown)" and then the realised text.
* After the existing steps (self-citation strip, scaffolding strip, language restate, attribution check, refusal, live-data drop) and before
  the grounding record: `pivotText` → `verifyPivot` → the spoken text replaces `text`. `message.pivot` stores what was withheld and why.
* Switch: `localStorage["fold-chat:pivot"] = "off"` restores the old path (used by the e2e discriminator E7). ON by default.
* A slot turn and a Sources-only turn have no model text, so there is nothing to read.

## What is withheld (typed, never reworded)
`label` · `boilerplate` · `third_person` · `attribution` (a bare "studies show") · `number_not_given` (Constitution II.9) ·
`ungrounded:<why>` (sourced turn: no source sentence witnesses it; `fold-chat-ground.js attribute`) · `question` (more than one, or not
last) · `truncated`. Two rescues, both narrow: a pronoun-led sentence that fails ONLY as `thin` is checked with its witnessed antecedent;
a sentence that fails ONLY for words that are the person's own ask-frame ("most notable fact") is held to the sources after the echo.

## The pathos leg is the real archons
Murch's `pacingGrade` (rhythm, flatline, blink points), Panini's declared experiencer (`who` = the model that wrote the draft, from the
turn's own record; none declared → a typed gap, never a default) and Abhinavagupta's `pathosOf`. Pathos NEVER GATES (the organ's law): it
is read, recorded in the EOT and `message.pivot.felt`, and applied only as paragraph breaks after Murch's blink points. The curve is a typed
gap (no reader fold on this pipeline). The other three leg tables (boilerplate, anaphors, back-connectives) are DECLARED by the author and
say so; no vendored archon covers output stock phrases (Gary and Kondo guard the INPUT prompt).

## Not done / limits (read these)
* English only: B and D tables exist for `en`. Any other language is `no_grammar_for_language`: the draft is shown UNCHANGED and a notice
  says it was not read. B ≠ D currently changes only app-authored words; content is not realised across languages yet.
* The Pivot is a gate and a realiser, not an author. What survives is still the model's content: on judgment asks it removes the barrage,
  markup and reflex, but a generic restatement ("You're asking about a sensitive situation") passes. It does not make the mouth wise.
* The model still runs the language-restate call before the Pivot reads its output; that text is read like any other.
* Code in fenced blocks passes through verbatim, recorded as not read. Only a CLOSED fence counts as code.
* A grounded check is `fold-chat-ground.js attribute` — a word-overlap gate; its known weaknesses carry over.
* The model is still barred from speaking alone (`ALONE_KINDS = []`): the Pivot's `judgment` standing exists in the module for when that
  switch is turned, and is not reachable from the live chat today.

## The gate history (pulled in from the fold, a900f6e)
`vendor/fold/gate-ledger.mjs` + `reasoning-stages.mjs` (frozen copies, pinned in `VENDOR-FOLD.json`; `node scripts/vendor-fold.mjs --check`) are the
fold's gate-history ledger: stage 12 (Constitution II.10) over TIME. `fold-chat-gates.js` gives each Pivot gate a persisted history in
`localStorage["fold-chat:gates"]` (rows = sentences read, rejected = withheld by that gate, failed = the realiser's own `verify` refusing).
A gate that has never withheld anything reads **unmeasured**, never `pass`; `fail` whatever its rejections; `pass` only means "it can
reject". Each turn's verdicts ride on `message.pivot.gates` and the feed line says how many checks have never withheld anything. The ledger
is bounded (old runs fold into one summary record per gate, cumulative totals exact) and never throws. `rows` is DECLARED as the sentences
the Pivot read, not the count that reached each gate. Nothing in `../fold` was edited.
