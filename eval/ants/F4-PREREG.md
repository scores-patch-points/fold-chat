# F4 pre-registration — the "I couldn't point to a sentence … unsupported" notice

Written 2026-10-06 BEFORE any run of the harness or any live turn. Ant F4. I have READ fold-chat-provenance.js, fold-chat-primary.js (mergeProvenance) and the wiring in fold-chat.js (~2514-2543); I have NOT executed any case. Frozen inputs (sha256):

- `eval/ants/falsify-checks/f4/cases.json` 09b0f6ab1885ae5d56593241b773c52a84de1a1ee765924c9a060ee3814fb9ed (25 supported, 18 non-claims, 24 seeded-wrong)
- `eval/ants/falsify-checks/f4/live-questions.json` e50e5d8e92cbe67a4ee21bf08b5460d7575411709ddfc672f78deb5c0ae57b03 (20 live questions)
- `eval/ants/falsify-checks/f4/data/wiki-intros.json` df281fa414b55938721992a2733f0e8a48eaf127335b894288ed0e00b7d55943 (real Wikipedia extracts fetched 2026-10-06; the passages)

Rule: cases are not edited after the first run. A result is never edited; a wrong claim here is recorded as refuted.

## What I believe the target is (stated so it can be wrong)

The notice is `TEMPLATES.none`, printed when `provenanceFor` finds no verified pointer. The pointer pipeline: code proposes numbered candidate sentences (`candidatesFor`) for the answer's FIRST sentence only; a model (gemma, injected `point`) replies with a number; code verifies the number exists and that the sentence `bearsOn` the claim (>= half of the claim's content stems shared, every figure of the claim present). `ok:false` comes from: no candidates, model NONE/unparsed/unknown number/call failure, two wrong picks, or `bearsOn` rejecting. No polarity, entity-role or negation check exists.

## Claims a counterexample refutes

Unit "case" = one row of cases.json. "Fires" = `provenanceFor(...).narr.text === TEMPLATES.none()`.

**Q2 false-unsupported** (25 supported cases; each has a real source sentence containing the support)
- P1. With an ORACLE pointer (returns the number of the candidate containing `gold`, else NONE) the notice fires on <= 10% (<= 2 of 25). Refuted if >= 3.
- P2. With real gemma2:2b as the pointer (temperature 0, maxTokens 220, same messages the app sends) it fires on <= 25% (<= 6 of 25). Refuted if >= 7.
- P3. A pointer that stumbles ONCE (first call picks the candidate after the gold one, second call picks gold) is rescued by the retry on >= 90% of the cases the oracle verifies. Refuted if < 90%.

**Q3 non-claims** (18 first sentences that assert nothing checkable, over topical real pages)
- P4. The notice does NOT fire on assertion-free answers (<= 10% = <= 1 of 18), even with the best possible pointer (a model that replies NONE, which is the correct reply). Refuted if >= 2 fire (I predict 18 of 18: no non-claim gate exists in the code or in the wiring condition).
- P5. A keyword-overlap pointer (picks the candidate sharing most stems with the answer) gets a VERIFIED pointer on <= 10% of the non-claims (<= 1 of 18). Refuted if >= 2. Same measure for gemma2:2b.

**Q4 false-supported** (24 seeded wrong claims: figure absent 4, figure present in the sentence 3, name swap 5, place swap 3, polarity 6, keyword-only 3; the true page is in the read set)
- P6. Verifier alone: pointed at the `near` sentence (the sentence the false claim was derived from) it returns a verified pointer on <= 10% (<= 2 of 24). Refuted if >= 3.
- P7. Keyword-overlap pointer: verified on <= 10% (<= 2 of 24). Refuted if >= 3.
- P8. gemma2:2b: verified on <= 10% (<= 2 of 24). Refuted if >= 3.
- P8b. Per type, the figure-absent type is caught (0 of 4 verified) — this is the one gate I expect to hold.

**Q5 consistency** (20 live turns through the real page, fresh context each, gemma2:2b, the Fold server on :8815; only turns that show a provenance box AND a "N of M sentences backed" / "none back the answer" summary count)
- P9. Contradiction rate <= 10%. A contradiction = notice says unsupported (verified 0) while the summary says every sentence is backed (g == n), OR notice says "I got this from / I found this on … it says" (verified >= 1) while the summary says 0 backed / "none back the answer".
- P9b. Blanket blessing: of live turns with >= 2 answer sentences and g < n, the fraction whose notice reads verified is <= 10%. (The notice only ever examines sentence 1; I predict this is refuted whenever it occurs.)
- P9c. The notice (rendered text or stored record) says WHICH sentence it is about. Refuted if neither the rendered text nor the stored `parts` names or quotes the claim. (Static; I predict refuted: `stored.claim` is kept but `renderProvenance` never draws it.)

**Q2-live** (L01-L08, plain facts)
- P10. Of the live fact turns whose spoken answer I can confirm against the Wikipedia page (manual judgement, recorded with evidence), the notice fires on <= 25%.

## Predictions (not claims; recorded so I cannot rationalise afterwards)
Expect: P1 holds mostly, with the 5-page structural cases (S22, S23) and the long-page cases failing the oracle; P3 holds; P4 refuted (18 of 18); P5 probably holds; P6 refuted (name/place/polarity pass the stem+figure check); P7 refuted; P9c refuted; P9 uncertain.

## Method notes
- Harness: `eval/ants/falsify-checks/f4/f4.test.mjs` (node --test; oracle, stumble, lexical and always-NONE pointers; deterministic). Real-model runs: `f4-gemma.mjs` writes `results/gemma-*.json`. Live: `f4-live.mjs` writes `results/live-*.json`. The pure module under test is imported unmodified; one mutation run weakens `bearsOn` in a COPY to confirm the harness is sensitive to it.
- No thinking models. Ollama gemma2:2b only.
- Passages are presented as the app would hand them: `{ref, title, url, text}`; Wikipedia pages carry the en.wikipedia.org URL (so `isTertiary` is true), distractors carry fabricated non-encyclopedia hosts (declared in cases.json).
