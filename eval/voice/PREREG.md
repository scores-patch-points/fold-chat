# The voice of content — stages 1–2, pre-registration (2026-10-06, written BEFORE any run)

What is tested (docs/VOICE.md): an organic, rare aside — "This reminds me of what <holder> wrote about <topic>: “<their own words>”" — chosen mechanically
from the ethos canon, with provenance (file, byte span, sha256), gated by the conversation's real pathos reading. **Stage 2 resonance is TERM-LEVEL**
(the concern-priors dwellings against the conversation's content stems, beyond a seeded null); it is not paradigm matching (stage 3) and not curve matching
(stage 4). Nothing is said that the code did not measure.

Real inputs: the real page (heimdall, gemma2:2b, real web) drives 8 threads of 3 turns (`eval/voice/collect.mjs`): 5 REFLECTIVE (personal conflict, recognition, fear,
trust, patience) and 3 LOOKUP (Eiffel Tower, photosynthesis, Marie Curie). Real archon data: `Zenodotus/derived-priors/concern-priors/concern-fields/*.json` with each
field's `source.sha256` checked against the canon file on disk; roster = the speakable archons whose canon is English (declared, to be edited by the user).

## Claims (a counterexample refutes each)
* **V1 provenance.** Every aside's quote is `canon.slice(start, end)` of a file whose sha256 equals the field's recorded hash. Any mismatch = FALSIFIED. Target 100%.
* **V2 silence on lookups.** The 3 lookup threads get **0** asides (stage 2 with the gate OFF, so this tests the kind rule and the resonance floor, not the gate).
* **V3 resonance is not noise.** Over the 5 reflective threads, the real index offers an aside on **>= 3** and a SHUFFLED index (each archon given another archon's term set;
  200 seeded draws is the per-conversation null) offers on **<= 1**. If the shuffled rate is as high as the real one, the resonance is noise and stage 2 is FALSIFIED.
* **V4 the gate is live and conservative.** With the real `pathosTurn` reading the thread (declared experiencer), at most ONE aside per thread, never on turn 1, never twice
  for one archon, and the condition that allowed it is recorded. If the chat's pathos read is a typed gap on short threads the gate stays CLOSED (reported, not bypassed).
* **V5 organic, not annoying (read by a person, not measured):** I will print every aside and judge each "plausible as a 'reminds me' aside" yes/no with the matched
  terms shown. Prediction: **<= 50% plausible** — term-level resonance is crude, and I expect generic dwellings ("heaven", "virtue", "man") to dominate. A low
  number is the finding, not a failure to hide.

## Not tested here (named gaps)
Paradigm matching (needs ethos ledger notes), the pathos curve (needs a recursive reader), non-English canons, a model, the user's roster choice, the real page's rendering of an aside.


---

## Amendment 1 (2026-10-06, written BEFORE any run touched real data — only the module's synthetic unit tests had run)
The null as first drafted shuffled which archon owns which term set. That is invariant for the BEST score (the same sets are still present), so p would be ~1 for every conversation. Replaced:
the null replaces the m conversation stems that the roster's vocabulary can match with m stems drawn at random from that vocabulary (seeded, 200 draws); p = P(best archon score >= observed).
Consequence for **V3**: the "shuffled index" control no longer exists (an index shuffle cannot change p). V3 is restated: the real offer rate on the 5 reflective threads is >= 3 of 5 AND the
3 lookup threads (V2) and a SCRAMBLED-CONVERSATION control (each reflective thread's stems replaced by random roster stems, 20 seeded scrambles per thread) offer on <= alpha of draws (<= 1 in 20 per
thread, averaged). If the scrambled control offers as often as the real conversations, the resonance is noise.
