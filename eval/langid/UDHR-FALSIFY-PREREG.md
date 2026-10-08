# UDHR falsification — "languages have a general shape; the shape detector generalizes; embeddings won't beat it"

Written 2026-10-07 BEFORE any run. Instrument: `eval/langid/udhr-falsify.mjs`. Corpus: the 516 UDHR
translations already on disk (`Zenodotus/06-government-legal/un-udhr/udhr-<code>.txt`; header
`Language: Name (code)`). Ground truth: the header's declared language. The fold detector:
`detectLang` (fold-chat-lang.js) / `identify` (fold-chat-langid.js) — script → naive Bayes over trebank-derived
priors + declared marks/clues. Embedding arm: local Ollama `nomic-embed-text` (a REQUIRED local service,
noted here so the reader knows it can be absent); prototypes = mean embedding of UDHR **Articles 2–5**,
test sentence = **Article 1** (held out), cosine to prototypes. This asymmetry is declared: the ngram arm
uses cross-domain treebank priors, the embedding arm trains on the corpus it is tested against.

Rules: nothing in this file is edited after a run; failed/timed-out runs stay; a language with no prior and
no script-clue must come back `unknown`, never a confident guess; UNMEASURED never passes. Families
(en/af, nl/de where the words genuinely overlap) are declared ambiguous, not wrong.

## Claims and refuted-if (fixed before any measurement)

| id | claim | refuted if |
|---|---|---|
| C1 shape | across ALL 516 UDHR Article 1 texts, the detector is **never confidently wrong** (a language it has no prior for must be `unknown`; script-owned languages like Japanese must be named) | any `confident && wrong` |
| C2 the 22 E2E languages | on UDHR Article 1 of the 22 languages the 2026-10-07 E2E sweep asked in, the detector is confident-right on ≥ 80% of those it has a prior for, and confident-wrong on none | confident-right < 80% of prior-bearing, or any confident-wrong |
| C3 short text (the app's real input) | on the **first sentence** of UDHR Article 1 of those 22 languages, confident-right ≥ 75% of the prior-bearing, confident-wrong none (a short text is harder: unspaced/agglutinative languages may honestly abstain) | < 75%, or any confident-wrong |
| C4 embeddings don't beat the shape | on the shared Article 1 held-out battery, the ngram detector's confident-correct is within 10 points of the embedding prototypes' correct (embeddings may win, but routing doesn't switch for a smaller margin) | embeddings correct ≥ ngram correct + 10 points on the same test sentences |
| C5 the fixes stand | ru/uk/bg short asks are right, not bg; `¿Y él?`/`¿Dónde nació?` are Spanish even after an English thread; `Wer war Marie Curie?` after an English thread is German; `Why did he die poor?` after a German thread is English; De jure the "wie was" Dutch-vs-German ambiguity stays `unknown` | any of the above wrong, or the ambiguity answered confidently |

Pre-registered outcome words: a claim "holds" only with its numbers; anything not run is UNMEASURED and
does not pass. The counterexamples that would refute each claim are written above the run; the RESULTS file
names which fired and keeps the raw per-language table.