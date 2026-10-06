# Backwards grounding: pre-registration (frozen before `fold-chat-assemble.js` existed)

Frozen 2026-10-05. Written after reading the instruments and after running the two instrument-only baselines below
(`eval/backward/forward.mjs`: the forward gate and the page ceiling, both existing code, no backward code involved), and
BEFORE any line of the assembler. `eval/backward/PREREG.sha256` holds the digests of this file, `identity-pairs.json` and
`forward.json` taken at the freeze. Bars are not edited after data; a miss is reported as a miss; a rule change after seeing
results is a dated RUN 2 below the first, reported separately and never counted toward the bars.

## The question

Grounding today runs FORWARD: a model writes sentences, then a lexical gate (`fold-chat-ground.js`) looks for a source
sentence that states the same thing. Recorded recall on real claims is ~46% (43/94 supported sentences) because models reword and
a word-matching gate cannot tell a good paraphrase from a bad one. Loosening it lets false claims in (precision 48% before the fix,
71% after). The idea under test: work BACKWARDS. Select the source holons (addressed sentence units of the pages actually read),
produce the answer text MECHANICALLY from them, so every output sentence is born carrying its address, and keep the forward gate as a
CHECK on any voicing. The holograph's own statement of the same design: "the record can compose the answer's skeleton and the mouth
can be reduced to voicing it, which makes authorship 1 by construction" (`khora/native/docs/THE-HOLOGRAPH.md` §"the skeleton-first
turn"; "the model reads nothing; it voices", same file §2).

What exists already, so this is not claimed as new: the Sources-only STRAND (`fold-chat-strand.js`) already shows verbatim
passage snips with byte ranges, and the snip-first study (`eval/snips/`) measured it (no-model satisfied 74% of 199 answer-expected
asks; 0 fabrication by construction). What the strand does not do, and the assembler must: select at SENTENCE grain by referent
identity and answer type, DERIVE (unit conversion, quantity and year comparison) with premises carried, decide "same claim" by
consequence, and name typed gaps.

## Design commitments (declared, not measured, written before the build; Constitution II.11)

* **Holon** = one sentence of one page read, `{ address: "<ref>#<start>-<end>", text }`, sentences cut by
  `fold-chat-impression.js::sentencesWithOffsets` (script terminators included), kept when 5..140 script-segmented words.
  A holon's identity IS its address; it self-verifies (`page.text.slice(start,end) === text`) or it is refused (THE-ADDRESS A3).
* **Page subject** = the entity the page's own title/URL names (referent identity, not lexical containment: "Eiffel Tower" is the
  subject of `.../Eiffel_Tower`, not of `.../Under_the_Eiffel_Tower`).
* **A holon bears on the ask** iff it (i) carries every referent the ask names (by being on a page whose subject is that referent,
  or by mentioning its surface), (ii) carries at least 0.5 of the ask's telling terms (script-segmented words that are in under
  half of the pooled holons; no stoplist, no capitals), and (iii) if the ask requests a typed answer (a quantity in a dimension, a
  year), carries a figure of that type. Declared floor 0.5; at most 3 sentences are output.
* **Outputs** are `verbatim` (the holon unchanged, default), `derived` (unit conversion from a declared table; ordering of two
  sourced quantities or two sourced years; each carries its rule, both premise addresses and the numbers, and is recomputed by the
  checker), never a mechanical rewording (the paraphrase tool nominates; it does not write: see
  `docs/BACKWARDS-GROUNDING.md`). Nothing else is ever emitted; a model is not called in the measured arms.
* **Gaps** are typed, never prose: `no-source`, `no-holon-bears`, `no-figure-of-kind`, `language-gap` (ask and sources in different
  languages with no shared referent evidence), `off-topic`.
* **Identity by consequence (sentence = the fold at a point).** Relative to a ground (the admitted holons), a sentence's
  CONSEQUENCE is the set of ground atoms it selects: for every figure it carries the ground figure it equals (same quantity in
  another declared unit, to the sentence's own precision), for every name the ground name, for every content term the ground
  term, all inside one holon window. Two sentences are the same claim iff their consequences are equal and non-empty.
  Empty = `undecidable` (typed, never "different" and never "same"). Cross-language is `undecidable`.

## Instruments (all existing, nothing new but the assembler arm)

| id | instrument | n |
|---|---|---|
| S1 | `eval/cases.json` strata a_single + b_numeric + c_multihop, turn 0, the pages the recorded `default` run (gemma2:2b) read, from `eval/cache`, cut to 12000 chars as the app and `replay-gate.mjs` do | 19 |
| S2 | e_multilingual, Latin-script asker (en es fr de pt sw), cases whose pages are cached | 17 |
| S3 | e_multilingual, non-Latin asker (ru ar zh ja hi), cases whose pages are cached | 9 |
| S3x | e_multilingual cases with NO cached page or no page read (e_wall_ru, e_wall_ar, e_wall_ja, e_cap_ja, e_eiffel_hi, e_wall_hi, e_wall_sw) | 7 |
| S4 | f_gap f1..f5 (the question has no answer on any page): the assembler must not produce the trap | 5 |
| S5 | ANSWER-ABSENT pages: every (S1 case, one read page) pair where the gold check fails on that page alone; the assembler is given only that page | counted at run |
| S6 | the hand-verified supporting quotes: labelled sentences with `quoteSupports=true` in `labels.json` (quote from `rescore-baseline.json`) plus labels-v2 entries with `quoteSupports=true` | counted at run |
| S7 | `eval/controls.mjs` classes through the assembler's own `certify` (see Metric g) | 26 NEG, 10 POS, 12 DER, 7 SELF, 7 SELFN, 4 XLN, 12 XL, 12 HOLDN, 10 HOLDP |
| S8 | `eval/backward/identity-pairs.json` (hand-written ground, 6 same, 12 different, 3 hard, 2 cross-language) | 23 |
| FWD | forward arm: the recorded `default` answer, each sentence through the working tree's gate against that turn's pages; "grounded recall" = gold check on the grounded sentences only | S1..S3 |

Gold check = the same `re` / `all` / `nums` check `eval/score.mjs` applied (copied verbatim into `eval/backward/lib.mjs`), applied to
the answer's text. For the backward arm the text is the concatenation of the output sentences (derived sentences print their
equation, e.g. `330 m = 1082.68 ft`). The page ceiling is the same check on the pooled raw page text (an extractor with perfect
selection and no derivation). A derived sentence may exceed the raw ceiling; that is reported as "above ceiling".

### Baselines measured before the freeze (instrument runs of existing code)

| set | n | page ceiling | forward: gold on grounded sentences | forward: gold on whole answer | sentences grounded / total |
|---|---|---|---|---|---|
| S1 a+b+c | 19 | 15 | **9** | 17 | 15 / 32 |
| a_single | 6 | 5 | 4 | 6 | 5 / 11 |
| b_numeric | 6 | 5 | 3 | 5 | 4 / 8 |
| c_multihop | 7 | 5 | 2 | 6 | 6 / 13 |
| S2 e Latin | 17 | 13 | 5 | 14 | 6 / 18 |
| S3 e non-Latin | 9 | 5 | 1 | 8 | 2 / 12 |

(Whole-answer passes are mostly the model answering from memory with no grounded sentence: the number the backward arm must beat is
the GROUNDED one.)

## Metrics and bars

a. **Claim recall (S1, S2, S3).** Cases whose assembled answer passes the gold check. Backward arm = the assembler, model off.
   **B1: S1 backward >= 12/19** (>= 63%, >= 80% of the raw ceiling 15, and >= forward 9 + 3). **B1b: S2 >= 9/17; S3 >= 3/9**
   (forward 5 and 1, each + more than the forward arm's own count).
b. **Precision (S1).** Every output sentence hand-read and labelled with the labels-v2 rubric, quote beside the verdict, in
   `eval/backward/labels-backward.json`: `states` = the sentence (or, for derived, its premise plus a recomputed equation) says
   what answers or directly supports the ask; `off` = it is true to its source but does not bear on the ask. **B3: states/(states+off)
   >= 65%.** (Strict quote-level truth of verbatim output is 100% by construction and is asserted by B2, not credited here.)
c. **Never write a claim that is not in a source (all sets).** Mechanical, absolute. **B2: 0 output sentences whose verbatim text is
   not `page.text.slice(start,end)` at its address; 0 derived sentences whose number does not recompute from its premise addresses
   and declared table.** Any single violation fails the study.
d. **Coverage (S1).** Cases with at least one output sentence, the rest with a typed gap. **B4: >= 17/19 answered**, and every
   non-answered case carries a typed gap (0 silent). S3x: **7/7 typed `no-source`**.
e. **Falsifiers.** **B7a: on S5 answer-absent single pages, typed gap (no sentence) on >= 70%.** **B7b: S4: 0 outputs matching
   the case's `fabrication` regexes, and a typed gap on >= 3/5.**
f. **Controls leakage (S7).** `certify(sentence, material)` is the assembler's check on a voiced or foreign sentence (the same
   consequence function that decides identity); a sentence is accepted iff its consequence is non-empty. **B5: NEG accepted 0/26
   single and 0/26 pooled; SELFN 0/7; XLN 0/4; HOLDN accepted <= 1/12; and it must not buy that by refusing everything: POS >= 9/10,
   SELF 7/7, DER >= 10/12, HOLDP >= 9/10** (the gate-fix bars, `docs/GATE-FIX-PREREG.md`).
g. **Latency.** Assembly CPU per turn (pages already in memory). **B6: median <= 200 ms, p90 <= 1 s** for <= 3 pages of 12000 chars.
   Forward arm's wall seconds per turn are reported beside it but include search and the model: not comparable, never claimed as a win.
h. **S6 supported-claim address recall.** For each hand-verified supporting quote, is its span covered (>= 50%) by an assembled holon
   on that turn? Reported with the forward gate's own rate (it cites that quote by construction, 100%, so the comparison is only
   informative about the assembler: a claim a model made and a source states is reached backward or not). **No bar.**
i. **Identity (S8). B11: all 6 `same` decided same (>= 5/6 passes); 0 `different` decided same; 0 `hard` decided same (undecidable
   or different passes); 0 `crossLanguage` decided same or different (undecidable only).**
j. **Voiced variant (optional, gemma2:2b only, temperature 0, :11435/:11434).** On S1: the model is shown ONLY the selected holons and
   asked for one sentence; the forward gate checks it; a rejected voicing is replaced by the verbatim holons. Reports gate acceptance of
   voiced sentences, gold recall of voiced text, and latency. **No bar** (it is the arm the idea says should be small); never a sealed
   model, never a key.
k. **Suite.** `node --test` stays green; every behaviour has at least one test and one falsifier. Baseline before this work and
   after are compared by failing NAMES.

## Wiring rule

The assembler is NOT wired into the live turn unless B1, B1b, B2, B3, B4, B5, B6, B7a, B7b and B11 are all met. If met: one declared flag
(default off), the facing-page path only, forward gate kept as the checker. If any is missed: not wired, and the report says which.

## Protocol

* One run, frozen. The author has read the page text of several S1 pages while understanding the instruments (the Eiffel, Everest
  pages), and wrote the assembler's rules from fixtures and the design above, not by tuning on S1 gold; this is disclosed, not
  claimed away. Any rule change made after seeing S1 results is RUN 2, reported under the first run, counted in no bar.
* The labeller of `labels-backward.json` is the same agent that built the assembler (as for labels-v2): the file keeps the quote beside
  each verdict so it can be audited.
* Pages are cached; no live fetch is needed or made. The forward arm is the recorded run, replayed offline.
* Not measured: fluency, multi-source synthesis quality, cross-language answers (typed gaps there, by design), answers whose pages the
  recorded retrieval never read (retrieval is held fixed on purpose: this study isolates the answer path).
