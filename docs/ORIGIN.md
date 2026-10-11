# An encyclopedia is a pointer, never a citation (2026-10-06)

User's rule: *"wikipedia should not be cited, it should be a pointer to original sources that should be fetched, with the path there tracked"* —
for every surface of the suite that uses Wikipedia, going from the Wikipedia claim to the source, looking for the supporting assertion, knowing it
will not be verbatim.

Code: `fold-chat-tertiary.js` (which hosts are pointers) · `fold-chat-origin.js` (one claim → its origin) · `fold-chat-originwire.js` (every encyclopedia
passage of a turn) · `fold-chat-meaning.js` (the reading's own hyperlexicon; gated OFF). Tests: `fold-chat-origin.test.mjs`,
`fold-chat-meaning.test.mjs`. Live measurements: `eval/origin/` (`survey.mjs`, `meaning-coverage.mjs`, `RESULTS.md`).

## What happens to a Wikipedia sentence
1. **Found** where the question's own search finds it (a lead, a passage). That is a hop of the path, never the citation.
2. **Located** in the article's own markup (`action=parse`, one call per article per tab): the footnote markers under the sentence, each with the text
   it stands under. A lead seldom cites; then the article's *body* sentence that says the same thing is looked for (a loose finder: it only names a page).
3. **Fetched**: every candidate footnote's page is read at once (an archived copy only when the original cannot be read, never when it disagrees).
4. **Read for support** — by the project's identity, below. The first page, in the article's own order, that carries the claim is the **origin**.
5. **Tracked**: the trail (`status`, `found` with the article revision, `refs`, `path`, `tried`, `origin` with its supporting sentence's *address*,
   `pattern`, `fails`) rides the stored row/snip. The path is shown: *found via Wikipedia “X” → reference n → host*.
6. **Shown**: the origin is cited, with its own sentence; or, when none was reached, the Wikipedia words are drawn as a **pointer** (`a pointer, not a
   source`) with the pages it points at as links. Wikipedia is never an "open ↗", never a tip target, never a chip, never a name a model may attribute to.

Surfaces: the answer card (slot pipeline), the Sources-only strand, the model-facing `[W#]` chips, the sources panel, the attribution check (“according
to Wikipedia” is neutralised), the "not checked" line, the feed. Left as they are: the disambiguation line (plain Wikipedia *titles* offered as senses —
not a citation) and Wikipedia as a *search scope* (finding is not citing).

## Identity (the user's definition, nominated not measured — memory `identity-and-definition`)
A thing's identity is what it is *for someone*: the neighbourhood the reading connects to it, cut where the difference stops mattering. So every
verdict names its **cut** and **for-whom** (`IDENTITY`), is **revisable** (the trail keeps every page tried), is **earned** (below `ORIGIN.minAtoms` a
claim is idle: `undecidable`, never "same"), and says `measured: false`. A holon's identity is its **address** `ref#start-end` and reads back as the page's
own bytes. Three rungs, all mechanical (no model):
* **consequence** (`consequenceOf`): same window, figures (unit-aware), names, terms; strict on WORDS. A claim may say less than the page's sentence,
  never something else. A page sentence the gate cannot read (a negation, a comparison) can never support an affirmative claim.
* **bound** (the Pivot's own B reading under the asker's frame): the claim and every page sentence are read by `askFrame` → `bindSentence` into rows
  (referent, filler, polarity, tense) and compared as assertions. Verbs outside the frame do not decide. Another filler / a denial is `different`.
* **meaning** (gated, OFF): the reading's own hyperlexicon — two words are one meaning iff they fill the same slot in claims heard in *other* sources.
  See the measured null in `eval/origin/RESULTS.md`; a caller must hand in a ledger.

## How a fact fails here (nine operators × three grains — user's tables)
Every non-origin outcome is typed (`FAILURE`, `failureOfWhy`, data only; operator names never reach the screen). **Refusal** (SIG: nobody marked it,
nothing reached) ≠ **gap** (NUL, INS, SEG, DEF, EVA: not settled) ≠ **falsified** (CON: a page it points to says something else → status
`contradicted`, with the page's sentence). Each says its **grain**: ground (the record could not be reached), figure (this claim), pattern
(`trail.pattern`: how many footnotes carry it and how many distinct hosts — a declared proxy for "one upstream or several"). REC: the article's
revision and an archived copy's date are recorded.

## Limits (read these)
* Leads rarely cite: of 30 lead sentences, 13 stand under no footnote. Most claims therefore end as pointers, honestly (`eval/origin/RESULTS.md`).
* Browser mode cannot fetch most origins directly (CORS); the relay/proxies help. A page that is a PDF viewer shell (the London Gazette) has no text to read.
* The mechanical gate stems lightly: "discovering" vs "discovery" is `undecidable (terms)`. Only 2 of 14 unsupported reads failed on wording.
* The bound rung needs a slot ask the English grammar reads (who/where/when/what/how many…); "How long" is not one.
* Not done: SYN (recompute a composite whole — conjunctive claims are checked per footnote only), DEF (a term used outside its giver's definition: the
  stems do not see it), SEG at the ground grain (the page's own date), the substitution control for identity, and a *contradicted* answer is not yet
  demoted to a contest on the card (the trail carries the refuting sentence).
* The slot pipeline is OFF by default (`fold-chat:answerPipeline`), so the answer-card path is reached only when switched on.
