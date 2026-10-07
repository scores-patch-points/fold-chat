# Grounding by meaning: what it needs, measured (ant C3, 2026-10-06)

User's standing demand: "you have to ground using the holograph and meaning and referents, not tokens." Today the chat's grounding of a pointed-at sentence is stem and figure overlap (`bearsOn` in `fold-chat-provenance.js`, applied by `verifyNumber`; the stricter `assertsClaim` in `fold-chat-primary.js`; `attribute` in `fold-chat-ground.js`). This document says what a meaning-level check would need, using only numbers measured today. Nothing was built in khora and nothing here claims an improvement that was not measured. Everything below is reproducible from `eval/ants/c3/` and pre-registered in `eval/ants/C3-PREREG.md` (Addendum A was written after the first results, before the control run).

## 0. Summary

1. **The token check cannot tell a sentence that says the claim from one that denies it.** On 30 hand-labelled (claim, sentence) pairs, `bearsOn` accepted 8 of 9 contradictions, 4 of 6 same-topic-not-entailed, 2 of 3 unrelated, and 9 of 12 true entailments: false-accept rate 77.8%, accuracy 43.3%. The strict gate the chat applies on top (`assertsClaim`) fell to 22.2% false accepts but rejected 7 of 12 true entailments, and mostly for the wrong reason (section 3.2).
2. **What khora provides today is not enough at sentence grain.** The live read door returned relations for both sides of only 10 of 30 pairs, no referent for any of 60 single-sentence reads, and drops the one field that matters most (polarity) although the underlying extractor reads it. Its relations carry no voice, so a passive ("Caesar was stabbed by Brutus") and a role swap ("Caesar stabbed Brutus") look the same.
3. **The back end that can adjudicate meaning already exists and works, given claims.** With hand-authored claims (an oracle front end), janus `/v1/reason` flagged 8 of 8 contradictions (functional value clash, polarity, acyclic order) and 0 of 5 entailments. It flags none when the relation's logical type is not declared (role swap and comparative swap with only `functional` declared: 0 of 2). So the missing piece is the front end: a reader that turns a sentence into a resolved, polarity-carrying, voice-normalised claim, plus a source of relation types.
4. **A lone small model is better than the token check but is not the answer.** gemma2:2b as a three-way judge got 93.3% on the main set and 78.6% on a 14-pair counterfactual control (false accepts on the control: 2 of 9 non-entailments). It has no mechanical check behind it, which the project's own rule forbids, and requiring the token checks to agree bought nothing (section 3.4).

## 1. What khora actually provides today (surveyed and called)

Vendored in `vendor/khora/` (pin `cceb530a`) and the khora checkout read-only.

| Piece | What it does for a sentence-level meaning check | Measured status |
|---|---|---|
| `adapters/text/relations.js` `extractRelations` | positional SVO triples with **polarity** (`+`/`-`), offsets; negation words are a received prior | Reads polarity (probe `eval/ants/c3/probe-polarity.mjs`: `Spiders do not have eight legs.` gives polarity `-`). But subject debris on negation ("do not", "was not" as subject), no voice ("Caesar was" / "by Brutus"), `Large studies have found no link...` read as `have(Large studies, found)`. khora's own S94 lists four construction classes the positional reader gets wrong. |
| Live door `POST /heimdall/api/read` (EORead@1) on `http://127.0.0.1:8815` | the reader (stages 1 to 5a): referents, relations | Works from Node with no link flow, about 18 ms a call. Relation objects are only `{relation, participants[{ref,surface}]}`: **polarity, offsets and voice are dropped**. `stagesNotRun: ["5b","6","7","8"]`, `sentences: []`. |
| Stages 5b to 8 (per `assemblies.js`) | 5b binding layer, 6 altitude, 7 population (`classifyIndividuation`), 8 kind (`induceKinds`) | Corpus-scale structure (cross-sentence binding, tiers, kinds). Not a sentence-entailment capability; section 4 explains why they are not the missing stage. |
| `organs/hyperlexicon.js` + `kernel/notes.js` | an assertion ledger over (end1, label, end2): `hear`, standing, disputes, `claimContestedByLedger` | Exists and medium-blind, but takes already-resolved ends and labels. It matches by string identity of ends. Nothing feeds it resolved sentence readings here. |
| `adapters/text/surfaces.js`, `morphology.js`, `wordclass.js`, `grain-typing.js` | name surfaces, stems/lemmas, word class and grain typing | Support organs (names, lemmas); none resolves "King Charles III" to the office or the paraphrase to the proposition. |
| `organs/grounding.js` (khora) | atoms, word numbers (`parseWordNumber`), `figuresUnbacked` | Useful for figures. The **vendored copy cannot be loaded under Node** (it top-level-awaits `../the-fold/canon-ground.mjs`, which is not vendored); this study imported the identical file from the khora checkout. |
| `organs/witness-sentences.js` / `corroboration.js` `witnessNote` | does any passage STATE this sentence: model points by index, mechanical gates (same-index rule, figures) decide | The right shape (model proposes, organ decides) but the gate under it is the same lexical overlap. |
| `kernel/contest.js`, `kernel/undecided.js`, `the-fold/resolutions.js` | contest verdicts, typed undecided, Lens/Paradigm/Atmosphere blocks | The right outputs (a verdict that can say "undecided"); no sentence reader feeds them. |
| janus `POST :11436/v1/reason` (khora proxy) | GFP claims (`rel`, `roles`, `polarity`) checked for coherence; `declare.functional/symmetric/acyclic`, universals with counterexamples, equations | **Works** given structured claims (section 3.5). Given raw text it reads relations "via received vocabulary, weaker witness" and only counts "several-valued pairs of undeclared relations, not judged". Claims in different grounds are "held apart" and never compared. |
| The holograph (`khora/native/docs/THE-HOLOGRAPH.md`) | the record is the object; consumers get addressed claims; referent identity is the index | Nominated, not measured for this task. A referent needs a second mention past the reader's floor, so a single sentence has none. |

Memory re-verified on real calls: 10 sentence pairs were required; 44 pairs (30 + 14 control) were read three ways each (claim, sentence, sentence+claim). Single-text referents: **0 of 88**. Relations: 10 of 30 claims and 15 of 30 sentences produced one; both sides in **10 of 30** pairs (E 6/12, T 1/6, C 3/9, U 0/3). Reading the two sentences as one text produced at least one referent in 18 of 30 pairs, but only the names that recur (William Shakespeare, Curie, Brutus), and presence does not separate the classes (E 6/12, C 5/9, T 5/6, U 2/3): that is name overlap under a better name.

## 2. The mini-battery

`eval/ants/c3/battery.json`: 30 pairs, labels written by C3 before any scorer ran: **E** the sentence says the claim (12), **T** same topic not entailed (6), **C** contradicts (9), **U** unrelated (3); 3 pairs are marked loose (a careful reader could dispute them). It carries the failure types tokens miss: tense/office holder (5, 6, 24), polarity (7, 19), number words (4, 29, 6 vs 8 legs), 'human' absent (10), metres vs meters (2), role swap (12), comparative swap (14, 15), unit conversion and approximation (21, 22), passive (13), reported speech (20), name overlap (16), polysemy (28), quantifier (26).

Confound found in my own battery and controlled: every C claim in the main set is false in the world and every E claim true, so a model answering from memory would look good. `eval/ants/c3/battery-cf.json` (14 pairs, labels fixed first) decouples truth from label: E with false claims and fictional entities, C with true claims, T fictional.

## 3. Results

Confusion cells are label x {ACCEPT/REJECT}. Positive = the check says "the sentence says the claim". False-accept (FA) = ACCEPT among T+C+U; false-reject (FR) = REJECT among E. Without the 3 loose pairs the headline rates move by at most about 8 points (T2's false-reject rate 58.3% to 50.0% is the largest; the 'without loose' lines are in the script output and results files).

### 3.1 Main set (30 pairs)

| Signal | E | T | C | U | accuracy | FA | FR |
|---|---|---|---|---|---|---|---|
| T1 `bearsOn` (the check in `verifyNumber`) | 9/3 | 4/2 | 8/1 | 2/1 | 43.3% | 77.8% | 25.0% |
| T2 T1 + `assertsClaim` (strictest in the chat today) | 5/7 | 0/6 | 4/5 | 0/3 | 63.3% | 22.2% | 58.3% |
| T3 `ground.attribute` (answer grounding) | 5/7 | 2/4 | 3/6 | 0/3 | 60.0% | 27.8% | 58.3% |
| K2 T1 + khora word-number parity (`grounding.js` `parseWordNumber`) | 10/2 | 4/2 | 8/1 | 2/1 | 46.7% | 77.8% | 16.7% |
| K1 door relation signal, as pre-registered | 2/10 | 0/6 | 1/8 | 0/3 | 63.3% | 5.6% | 83.3% |
| K1s same, ends must contain all claim stems (post hoc, exploratory) | 2/10 | 0/6 | 0/9 | 0/3 | 66.7% | 0.0% | 83.3% |
| K3 janus text door on sentence+claim | not scored as accept/reject: it flagged 0 of 30 (all "OK") | | | | | | |
| R2 gemma2:2b three-way judge (reference, not khora) | 10/2 | 0/6 | 0/9 | 0/3 | 93.3% | 0.0% | 16.7% |

R1 (reference) nomic-embed-text cosine: AUC E vs rest 0.741, **E vs C 0.537**, E vs T 0.917, E vs U 1.000; the highest C pair (12, role swap, 0.983) outscores every E pair. Cosine measures topic; it is blind to contradiction.

### 3.2 What the token numbers hide

- T2's 5 correct rejections of C pairs: only pair 9 (digits transposed) was rejected for a contradiction-shaped reason (the figure). Its polarity gate never fired on the main set (none of its 21 rejections cited polarity); the other C rejections cited a missing stem (`spac`, `caus`, `whit`, `queen,elizabeth`) because the contradicting sentence used different words. The same mechanism rejected 4 true entailments for different wording (`metr,tall`, `shorter`, `retir`, `human,body`). So T2 is more accurate than T1 by luck of wording, not by reading meaning.
- Pair 4 (six vs eight legs): the claim's number word "six" appears in the sentence ("unlike insects, which have six"), bound to a different referent, so every figure/stem signal (T1, K2, K1) accepts. A number is only evidence once it is bound to the referent and relation.
- Pair 12 (`Brutus stabbed Caesar` vs `Caesar stabbed Brutus`) is accepted by T1, T2, T3 and K2 (identical tokens). The door read both sides as relations with the ends crosswise; the same crosswise pattern appears for the true passive (pair 13), because the door has no voice. A relation signal that flags "swapped" cannot separate the two.
- Tense: `Queen Elizabeth II is the monarch` against `King Charles III is the monarch` is accepted by T1 and K2 (the two sentences share enough stems: `monarch`, `United Kingdom`), and rejected by T2 only because the claim's names (`queen`, `elizabeth`) are absent. The two tense pairs (5, 24) behave the opposite way under T2 (5 rejected, 24 accepted).
- 'human' missing (10) and metres/meters (2): T1 accepts; T2 rejects (false reject). T2 rejects pair 2 for two missing stems: `metr` (the stems of metres and meters differ, the spelling failure the user named) and `tall` (absent from `stands ... above sea level`).
- Fixes that are mechanical and measured: K2 (word-number parity) accepts pair 29 (`12` vs `Twelve`), changing T1's FR from 25.0% to 16.7% with FA unchanged (77.8%). Approximation (21, 300,000 vs 299,792) and unit conversion (22, 100 C vs 212 F) are rejected by every token and khora-figure signal.

### 3.3 Counterfactual control (14 pairs: 5 E, 3 T, 6 C)

| Signal | E | T | C | accuracy | FA | FR |
|---|---|---|---|---|---|---|
| T1 | 5/0 | 3/0 | 4/2 | 50.0% | 77.8% | 0.0% |
| T2 | 2/3 | 1/2 | 2/4 | 57.1% | 33.3% | 60.0% |
| T3 | 1/4 | 1/2 | 3/3 | 42.9% | 44.4% | 80.0% |
| K1 (door) | 0/5 | 1/2 | 0/6 | 57.1% | 11.1% | 100.0% |
| R2 gemma2:2b | 4/1 | 2/1 | 0/6 | 78.6% | 22.2% | 20.0% |

The judge drops 14.7 points from the main set; it got all 6 contradictions right even when the claim was true in the world, so it is not simply recalling world facts, but its errors moved to the cases the token checks also fail: same figure on another referent (`The Vellmar bridge carries 4,200 vehicles` vs the Karst tunnel claim: accepted) and reported speech (`Some residents claim...`: accepted). Its recurring miss on both sets is the antonym comparative (pairs 15, 110: `shorter than` vs `taller than`, called a contradiction). The oracle K4 below shows the antonym case needs a normalisation, not a verdict rule.

### 3.4 Does agreement with a mechanical check make the judge safe? (post hoc, `combine.mjs`)

Requiring R2 and T1 to both accept: main 86.7% (FA 0.0%, FR 33.3%), control 78.6% (FA 22.2%, FR 20.0%, unchanged: the two false accepts also pass the token check). R2 and T2: main 76.7% (FR 58.3%), control 71.4% (FA 11.1%, FR 60.0%). The available mechanical checks do not add safety where it is needed; they only cost recall.

### 3.5 The janus back end with an oracle front end (K4, `collect-oracle.mjs`)

Claims were hand-authored as GFP claims in one ground. The door's own exit code is the flag.

| Pair | Shape given to janus | Declaration | Flagged |
|---|---|---|---|
| 4 six/eight legs | `has-legs(spider, 6)` vs `(spider, 8)` | `functional` | yes |
| 5 Elizabeth/Charles | `monarch-of(UK, x)` | `functional` | yes |
| 9 born 1876/1867 | `born-in-year(curie, n)` | `functional` | yes |
| 7 Great Wall, 19 vaccines, 24 Concorde | same claim, polarity `+` / `-` | none | yes (3 of 3) |
| 12 Brutus/Caesar, 14 K2/Everest | `stabbed(a,b)` / `taller-than(a,b)` crosswise | `acyclic` | yes (2 of 2) |
| same two with only `functional`, and 12 with nothing | | | **no** (0 of 3) |
| E pairs 1, 3, 8, 13, 15 | the same proposition on both sides | as above | **0 of 5** |

So: the back end catches all 8 contradictions when handed the right claim and the right logical type of the relation, flags no entailment, and says nothing when the type is undeclared. Pre-registered P9 held. This is a ceiling for the back end only; it says nothing about the difficulty of producing those claims from text. Where the types come from (is `stabbed` asymmetric, is `has-legs` functional, is `taller-than` the converse of `shorter-than`) is a named-giver question (khora S19: a check is licensed by a declared claim, never by a relation's shape).

### 3.6 Pre-registered claims, scored

| Claim | Outcome |
|---|---|
| P1 token checks cannot separate E from C | HELD (T1 accepts 8/9 C, 4/6 T) |
| P2 token checks false-reject true entailments (T2 >= 4 of 12, T1 >= 2) | HELD (7 and 3) |
| P3 T2 buys precision by losing recall, losing more E than the false accepts it removes | PARTLY REFUTED: it loses 4 E and removes 10 false accepts (accuracy up 20 points); the E loss is mostly for wrong reasons |
| P4 door relations are phrase-level, both sides in < 60% of pairs, 0 referents, K1 accepts < 40% of E | HELD (10/30; 0 of 88; 2 of 12) |
| P5 no deployable khora signal has precision and recall both >= 0.7 | HELD (K1 prec 66.7 / rec 16.7; K2 prec 41.7 / rec 83.3) |
| P6 polarity/tense/role swap invisible to T1 and K1 | HELD (T1 accepts 7 of 7; K1 produced a relation on both sides for 1 of 7, pair 12) |
| P7 cosine does not separate E from C | HELD (AUC 0.537) |
| P8 lone gemma2:2b beats T1 but errs on >= 2 of the 7 hard pairs | REFUTED on the second half (0 of 7 errors on the main set); its misses are 15 and 22 |
| P9 janus catches functional and polarity contradictions, not role/comparative swap without the declaration | HELD |
| P10 the judge drops >= 10 points on the control | HELD (93.3% to 78.6%) |
| P11 token checks do not depend on world truth | HELD (T1 accepts 4 of 6 C; T2 rejects 3 of 5 E) |
| P12 K1 on the control as on the main set | HELD (0 of 5 E accepted; both sides covered in 6 of 14) |

Limits: 30 plus 14 pairs, one author's labels, English only, mostly famous facts; the loose pairs are listed; the K1s variant and the combinations are post hoc and labelled so. The results are a probe that rules claims out, not a benchmark that ranks systems.

## 4. What a meaning-level check would need

**Not stage 5b to 8 as such.** Those stages (binding layer, altitude, population, kind) are corpus-scale structure: they help "is a spider an arachnid", cross-document identity and kind standing. The failures measured above (polarity, voice, role, tense, number binding, approximation) are sentence-grain. The needed capability is an extension of the sentence reader at stage 5a plus a normalising layer in front of the existing back end:

1. **A sentence-grain proposition reader (new stage "5a+", inside khora's reader).** Per sentence, emit zero or more claims with: resolved relation key (lemma, voice-normalised so active and passive give the same roles), `ARG0`/`ARG1` as referent references (or typed `unresolved` surface), `polarity`, `assertion` (asserted / reported / hedged / asked / quoted), time anchor where stated (interval, so the monarchs' terms do not clash: khora S20), figures with unit and value bound to the role they fill, and the sentence's byte span. Today's reader has polarity and offsets internally, no voice, no assertion class (the chat's `assertionOf` regex does that in English), no time, and an object that swallows adjuncts.
2. **Sameness of ends and relations, for a named giver and cut.** Referents by the identity organs that exist (`aliases.js` S74, `refuteIdentity` S85, the holograph's referent index) and a relation lexicon: converse pairs (`shorter than` / `taller than`, `acquired` / `was acquired by`), antonyms (`open` / `closed`), logical types (`functional`, `acyclic`, `symmetric`) from received priors with giver. Per the user's own definition (memory: identity-and-definition) every "same" verdict must name its for-whom and cut, be marked nominated-not-measured, and refuse idle matches with a typed `undecidable`.
3. **A figure binder.** Values with units, approximation ("about 300,000" against 299,792), unit conversion (100 C against 212 F), number words, each bound to the (relation, role) it fills. khora's `grounding.js` already has `parseWordNumber`, `figureMatches` exists in the chat; the binding to a role is the new part (pair 4).
4. **The judge, existing.** claims in, verdict out: janus `/v1/reason` (8/8 on oracle claims), `kernel/contest.js adjudicate`, `claimContestedByLedger`. The verdict must be one of entails / contradicts / same-topic-not-entailed / unrelated / **undecided** (reader abstained or relation type unknown), with the claim ids that decided it. Abstention is a first-class output, because the reader will cover only part of the pairs (today's door covers 10 of 30).

### Contract (proposed; name it `ClaimReading@1`, not built)

```
readClaims({ text, lang?, priors? }) -> {
  schema: "ClaimReading@1", lang, gaps: [string],
  claims: [{
    id, said: { start, end },               // byte span in `text` (the quote stays the page's own)
    rel: "has-legs",                        // lemma, voice-normalised; converse already applied
    roles: { ARG0: End, ARG1: End },        // End = { ref } resolved referent | { surface, unresolved: true } | { figure: { value, unit, approx? } }
    polarity: "+" | "-",
    assertion: "asserted" | "reported" | "hedged" | "asked" | "quoted",
    time: { from?, to?, open?: true } | null,
    quantifier: "all" | "some" | "none" | null,
    basis: "reader:<recipe id>", giver: "<named>"
  }]
}
verdictOf({ claim, pageClaims, types }) -> { verdict: "entails"|"contradicts"|"topic"|"unrelated"|"undecided",
                                              because: [claim ids], standing: "nominated", for_whom, why }
```

It is the GFP claim janus already accepts (`rel`, `roles`, `polarity`, `force`, `id`, `said`) plus `assertion`, `time`, `quantifier` and spans, so no new back end is needed.

### Where it lives (memory: repo-placement)

- **khora** (needs the user's OK first; new files only, as with FoldRecord@1): the `ClaimReading@1` contract and the sentence-grain proposition reader (`native/adapters/text/`, beside `relations.js`), the relation lexicon organ with its giver, the verdict organ that composes `kernel/contest.js` and janus claims, and the door route (a `claims` field on EORead@1 or `/api/claims`, exposing at minimum the polarity and offsets the extractor already computes: smallest first step, a field the door drops today).
- **the-fold** (glue only): a `fold-chat-meaning-ground.js`-style adapter that calls the door, turns a chat claim and a candidate sentence into the contract's input, and replaces `bearsOn` inside `verifyNumber` behind a switch; English DECLARED patterns only (the `assertionOf` regexes move to khora when the reader owns them); session state; the typed fallback when the reader abstains.
- **vendor/**: never hand-edited; a new organ arrives through `node scripts/vendor-khora.mjs --add`. Note the vendored `grounding.js` already fails to load under Node, so Node-side tests should stay on the-fold files until that is fixed in khora.

## 5. Staged plan with go/no-go measurements

Each stage writes its claims before it is built; thresholds below are proposals for the user to accept or change. Hold-out: the 44 pairs here are a dev set. Each go/no-go below needs fresh pairs not seen while building.

| Stage | What | Measure | Go if | No-go action |
|---|---|---|---|---|
| 0 (the-fold only, no khora) | Keep T2-like gates but add mechanical figure fixes (word-number parity, approximation tolerance, unit conversion) and label every pass "token check" in the record | the 44 pairs plus 30 new | FA does not rise; FR falls on pairs 21, 22, 29 | revert; the label stays regardless |
| 1 (khora, small) | Door exposes `polarity`, offsets, subject-debris filter | 40 hand-labelled affirmed/negated sentences | polarity right on >= 95%; "do not"/"was not" never a subject | no further stage until fixed |
| 2 (khora) | Voice and role normalisation, assertion class | 60 sentences incl. passive, inverted, reported | roles right on >= 90% of simple declaratives; pair 12 vs 13 separated 100%; reported speech never `asserted` | stay at stage 1; token check remains the labelled fallback |
| 3 (khora + giver) | Relation lexicon (converse, antonym, logical type) and figure binder | the C and E pairs of both batteries | all 8 oracle-caught contradictions caught from text; pair 4 not accepted; 15/110 accepted | list which relation types lack a giver; the check abstains on them |
| 4 (verdict, end-to-end) | `verdictOf` over reader output, abstention typed | fresh 100 pairs (a third party labels, drawn from real pages: the A3 corpus `eval/ants/primary-corpus.json` is a source) | on covered pairs FA <= 10% and FR <= 25% (T1 today: 77.8% and 25.0%); coverage >= 50%; abstention reported separately and never counted as accept | do not wire; keep token check, labelled |
| 5 (wire) | Replace `bearsOn` in `verifyNumber` behind a switch; keep the model as proposer, the verdict decides | live turns via `eval/pivot/chat-live.mjs`; the existing falsifier driver | no regression on `eval/` falsifiers; verbatim quote invariant intact | switch off |

A per-stage rule from the pipeline's own history: two structural changes in one run are indistinguishable from a regression; run the stages separately.

## 6. What the user must decide

1. **Permission to start in khora**, and which first step: the smallest is exposing polarity and offsets at the door (they exist in `relations.js` and are dropped); the real one is the sentence-grain proposition reader (`ClaimReading@1`). New files only, uncommitted, as for FoldRecord@1?
2. **What "says the claim" means.** Pairs 10 (`human` supplied by the page) and 25 (retired vs final flight) are loose. A meaning check must be told its for-whom and cut (identity-and-definition memory: nominated, not measured); decide whether page context may supply a missing referent and how far a paraphrase may stretch.
3. **Policy when the reader abstains** (it will, often: 10 of 30 today): keep the token check labelled "wording only, not checked by meaning", show nothing, or let the model judge propose and the user accept? The data say: a model-only verdict is about 79% to 93% accurate on this probe with no mechanical check behind it, and today's mechanical checks do not make it safer.
4. **Who supplies relation types** (functional, acyclic, converse, antonym) and under which named giver; without a giver the janus back end stays silent by design.
5. **A hold-out set from someone other than me**, with labels by a person, before any wiring.

## Files

- `eval/ants/C3-PREREG.md` (pre-registration and Addendum A), `eval/ants/c3/battery.json`, `battery-cf.json`
- scorers: `score-tokens.mjs` (T1 T2 T3 K2), `collect-door.mjs` + `score-door.mjs` (K1, K1s), `collect-janus.mjs` (K3), `collect-oracle.mjs` (K4), `score-ref.mjs` (R1 R2), `combine.mjs` (post hoc), `probe-polarity.mjs`, `lib.mjs`
- raw and results: `door-raw*.json`, `janus-raw.json`, `oracle-raw.json`, `results-tokens*.json`, `results-door*.json`, `results-ref*.json`, `table-main.md`
- Reproduce: `node eval/ants/c3/score-tokens.mjs`; `node eval/ants/c3/collect-door.mjs && node eval/ants/c3/score-door.mjs`; `node eval/ants/c3/score-ref.mjs` (Ollama gemma2:2b and nomic-embed-text); append `C3_SET=cf` for the control. The door and janus need the Fold server on :8815 and the khora proxy on :11436. The janus calls write a reasoning record under `~/.claude/eo-reason/` (a side effect outside the repo).
