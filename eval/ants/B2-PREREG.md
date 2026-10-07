# B2 pre-registration — the assertion-tying core `fold-chat-counsel.js` (written 2026-10-06 BEFORE any test or real run)

User: "say how it thinks they would answer using Pythia if we think that's reliable … but it should tie all of its assertions of what they would say, the paraphrasing, to examples in their real canon."
Rule (docs/VOICE.md): an assertion Pythia makes in an archon's name is spoken ONLY with a verbatim canon sentence that passes the gate below; otherwise it is WITHHELD.

## The tie gate (chosen now; thresholds are NOT to be tuned on the real run's results)
For an assertion A (model-written) and a candidate canon sentence S that the model pointed at by NUMBER (the model never copies):
* Content stems = tokens > 2 chars, not function words, stemmed (fold-chat-ground), MINUS the giver's own name stems and a declared frame list (would, likely, say, hold, believe, think, view, teach, argue, ...).
  Call them `all`. `novel` = `all` minus the QUESTION's own stems.
* TIED iff ALL of: (1) `novel` is non-empty and S carries at least ONE novel stem (the lexical trap: a lie that shares only the question's vocabulary with the canon must not tie);
  (2) S carries EVERY stem of `all` ("all_stems"), OR S carries >= 2 of them and >= 60% of `all` ("majority");
  (3) every figure in A is in S; (4) negation parity: S and A are both negated or both not (a polarity flip "God exists"/"no God" is rejected; crude parity, double negation not handled).
* Why this and not provenance's `bearsOn` (>= 1 shared stem): one shared stem is exactly what "a real but unrelated sentence" and "a lie in the canon's vocabulary" carry. The 60% / 2-stem floor is
  declared, not measured; it trades coverage for precision on purpose (mute is acceptable, fabrication is not). Pointer shortlist is broader than the gate (the model can point wrongly and be rejected).
* Verification of a pointer: `verifyNumber` (fold-chat-provenance.js, imported read-only) finds the numbered candidate; then the gate above. One bounded retry per assertion with the rejected candidate withdrawn.

## Claims (each is refuted by the counterexample named)
1. FORCED FABRICATION: a draft model that asserts things the thinker never said, with a sycophantic pointer (always picks #1) AND an honest-but-wrong pointer (random numbers) -> 0 tied assertions, narration has no reading of any of them. Refuted by ONE tied fabricated assertion.
2. TRUE OF ANOTHER THINKER, ABSENT HERE: an assertion that is accurate of tradition B, run against canon A that lacks its anchors -> withheld ("no_candidates" or a gate reason).
3. REAL BUT UNRELATED: the model points at a real, verbatim canon sentence that does not carry the assertion's stems -> rejected (gate), never narrated.
4. NONEXISTENT NUMBER: pointer replies "99" / "0" / "-3" / "banana" -> rejected (no_such_sentence / unparsed), never narrated.
5. ABORT: an AbortError from draft or point propagates out of counselFor (does not become a "withheld"); a pre-aborted `limits.signal` throws before any call.
6. QUOTE INTEGRITY: every `quote` part of the narration is exactly canon.slice(start, end); `verifyCounsel` fails on a tampered quote, a tampered app part, a model sentence slipped into an app part, a withheld assertion's text in the narration, and a quote with the wrong offsets.
7. POLARITY: assertion "X does not exist" cannot tie to "X exists." (and vice versa).
8. MODEL WORDS ARE QUARANTINED: the only model-authored text in the narration is the reading part, with double-quote characters removed (so a model cannot forge a verbatim quote), under the fixed app prefix, and only next to its tie.
9. Draft replying NOTHING, empty, or throwing a non-abort error -> no assertions, calls counted, narration states (in the app's words) that nothing could be tied.
10. Thinker with neither `text` nor `candidates` -> refused, "never ventriloquized", zero model calls.
Each gate (shortlist/pointer parse, stem coverage, novel-stem floor, figures, negation parity, quote verification, withheld-leak check, abort) is MUTATION-CHECKED: delete it, the named test must fail.

## Real run (after the tests): "Is there a God?", gemma2:2b, temp 0.6 draft / 0 pointing, three thinkers with real canon from voice-index.json
Thinkers chosen by reading which canons carry the question's word (B3 chose laozi, ramakrishna, mozi for the same question; I use ramakrishna, vivekananda, mozi — whichever have the most canon sentences carrying "god").
Predictions (written now, wrong ones reported):
* P1: most drafted assertions are generic paraphrase in words the quote does not carry; the tied rate will be low (0.15 to 0.5). Mute beats fabricated.
* P2: at least one tied assertion will be only partially faithful (lexical gate cannot see meaning): a quote that carries the stems but says something nearby. I will READ each and say so.
* P3: Ramakrishna (1 of 3 canons where "God" is the native word of the text) ties most; Mozi (translation, "Heaven"/"spirits") ties least on the question word "God".
* P4: quotes are verbatim by construction (offsets slice into the canon): 100%.
What this does NOT show: that a tied quote is the thinker's BEST statement on the question; that the reading is the thinker's meaning (only that a verbatim sentence carrying its stems exists in their text); anything about translations (the canon is an English translation).

## Amendment 1 (dev stage, before the real run; recorded, not hidden)
The first unit run showed that "without" in the negation word list made a quote ("loves the people without partiality") polarity-differ from a plain assertion, so a correct tie was rejected. "without" was removed; the list is now `not|no|never|nor|neither|none|nothing|nowhere|cannot|n't`. A regression test pins it.
Also found: `minShared` is arithmetically dominated by `coverageMin = 0.6` (shared < 2 and not-all means coverage <= 0.5), so deleting it is an EQUIVALENT mutant at the default thresholds; it is tested with a lax coverageMin instead.
Also: raw-material tie-break (equal numbers of the question's stems) prefers the sentence nearest 9 content stems, because the "densest" sentence is a lone five-word fragment ("This is the vision of God."). Raw-material choice is not the gate; it was chosen by reading raw material of three canons before any model run.

## Amendment 2 (after the FIRST real run, before the final runs; the first run's log is kept as B2-real-run-1.log)
What run 1 (Ramakrishna complete; Vivekananda's draft call failed non-abort and the script crashed on a null) showed, and what was changed. THE GATE (stem coverage, novel stem, figures, negation parity) IS UNCHANGED.
* The template said "<giver> wrote:". The Gospel is M's record of Ramakrishna and its introduction is the translator's prose ("Sri Ramakrishna felt an unquenchable desire…" is a biographer's sentence, not his speech); Solon is Herodotus's. "wrote" would be a false attribution, so the template is now "From <work>, in <giver>'s canon:".
* gemma2:2b mostly COPIES the passages it was given, so many assertions equal the quote. An assertion identical to its quote (case/punctuation aside) is still tied but shows no "reading" line (the quote already says it).
* Models write "Swami Vivekananda: ..." labels; splitAssertions strips a leading "<giver>:" label.
* The control lie "the world is an illusion and only the supreme Brahman is real" is TRUE of Ramakrishna's canon (it tied under the sycophantic pointer: "The Real means … the Supreme Brahman … the unreal … the world"). It is not a lie for him. Control lies now carry anchor regexes and a lie whose anchors occur in the thinker's canon is dropped and reported (B3's design).
* Run 1 also showed the gate cannot see whether the tied sentence ANSWERS the question: "the spiritual goal is the finding of God" ties (all stems carried) and says nothing about whether there is a God. This is a recorded limit (lexical), not fixed.
Final real runs: two identical runs of the three thinkers (temperature 0.6 drafts vary), both logs kept.
