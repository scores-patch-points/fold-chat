# What the ethos priors buy the chat — a pre-registered study (2026-10-05)

Everything under `eval/priors/` (pre-registration `eval/priors/PREREG.md`, written before any experiment ran; code, data, cached API responses, results and the three shippable artifacts). ethos was read-only (commit `1c510a6`, `git status` clean afterwards); the app source was not edited; the chat modules `fold-chat-ground.js`, `fold-chat-web.js`, `fold-chat-mind.js` were imported **as they are on disk today** (`fold-chat-ground.js`/`fold-chat-web.js` changed during the study; the numbers below were produced against the versions present at run time, and the fork patch script refuses to run if its two substitution sites move).

**Reading guide.** Every number is *measured* unless marked *estimated* or *assumed*. Proportions carry Wilson 95% CIs; AUROC, F1, ECE and paired differences carry cluster-bootstrap 95% CIs (B = 1000–2000, clusters = files / questions / items). Splits are by file or document (`sha1(path)` parity). Hand-authored label sets (translated questions, dialogues, paraphrases, entity spans, relevance labels) have **one labeller (me, an LLM)**, were written before the scorer saw them, and are `assumed` ground truth. Where a pre-registered bar failed it says **bar not met**. Where I added an arm after seeing results it is marked **post-hoc** and is never counted toward a registered bar.

## 1. Headline

| # | What was tested | Verdict | The number that matters |
|---|---|---|---|
| E1 | char n-gram language ID trained on ethos (UDHR 462 classes, +23 languages of ethos text) | **Useful, most of the bars not met.** Beats script/locale baselines by a wide margin; a *correct* session prior is the single biggest lever (+26 pts at 4 words), a *wrong* one costs 14; locale prior is harmful; calibration and short-input accuracy miss the registered bars | shippable profile 0.83 MB gz; family top-1 on independent text 0.75 / 0.85 / 0.88 at 4 / 8 / 12 words; informal English chat 0.74, Chinese chat 0.32 (0.99 once Han-script lects are one family) |
| E2 | function words from frequency vs the hand-typed STOP | **Derived set matches ground truth better (en F1 0.80 vs 0.72), but the grounding fork does not care**: swapping STOP for the derived set changes **0 of 280** verdicts. The real grounding defects are elsewhere (see section 4) | en F1 0.801 [0.797, 0.807] vs 0.715 [0.707, 0.722]; downstream macro difference 0.000 [0.000, 0.000] |
| E3 | corpus IDF + function words as a retrieval relevance floor | **Bar not met.** AUROC +0.04 [-0.09, +0.20] on the registered split (+0.12 [0.02, 0.23] on all 52 questions); the floor does not cut off-topic reads. Retrieval is the problem: 84% of top-3 results for a question string are off-topic before any gate | off-topic share of reads 0.86 (gated by the app) vs 0.83 (floor), recall 0.82 |
| E4a | entities without case | **No ML-free finder exists from ethos.** `casedRuns` recall is 0.00 in all 7 caseless scripts; title-authority recovers 0.06-0.42 recall (F1 pooled 0.33 [0.29, 0.37]); the prior-driven cased finder is not better than `casedRuns` | cased F1 0.79 (casedRuns) vs 0.76 (prior-driven) |
| E4b | pronoun carry in `fold-chat-mind.js` | **Unsafe as shipped: 85% false carry** on new-topic questions that name no entity. Gating the carry on an ethos pronoun form cuts it to 12-18% (0% with personal pronouns only) at a recall cost | false carry 0.85 [0.74, 0.92] -> 0.18 [0.09, 0.32] (en+ru) -> 0.00 [0.00, 0.09] |
| E5 | cross-lingual grounding | **Partly works, only as a weak signal.** A Model-1 table learned from ~1-1.8k parallel paragraph pairs ranks the true translation first 54-73% of the time (chance 1.7%; the chat's token-run overlap: 3-7%) and 69% on a held-out novel (en-fr War and Peace); but its score is blind to changed names and numbers, concept-set bridging is infeasible (Concepticon has no word forms), and TPR at 1% FPR against adjacent paragraphs is only 35-49% for held-out Alice pairs. Verdict: `match: cross-lingual` = **witnessed by selection, not `sourced`** | en-fr Alice: top-1 73% [67, 79] vs 5% [3, 8]; TPR@1%FPR 35% [30, 42] |
| E6 | genre priors for source reliability | **Cannot be supported with this data** (`refused-as-underpowered`, IV.3): 8 labelled outcomes in the only genre that has any | 8 outcomes vs 30 required |
| E7 | code priors vs hallucinated Python APIs | **Works on module attributes, with a finding about the prior**: TPR 14/15, FPR 1/15, but the prior's `coreApi` is truncated at 60 entries per module | TPR 0.93 [0.70, 0.99], FPR 0.07 [0.01, 0.30] (n = 15 + 15) |

**What ethos concretely buys, ranked by measured effect on the chat's failures (a)-(f):** (1) language identification and a session language prior (d); (2) pronoun forms as the *trigger* for referent carry, which is what makes carry safe at all (a); (3) the derived function-word lists, as a language-extending drop-in for hand-typed lists (no accuracy change today, but the only way to cover languages the hand list does not); (4) code priors for the coding lane (with the truncation caveat). What it does **not** buy: a relevance floor (E3), an entity finder for caseless scripts (E4a/b, b), a source-type reliability prior (E6), or a cross-lingual bridge strong enough to say `sourced` (E5). Section 4 lists three defects found in the chat's own code along the way that are worth more than any prior tested here.

## 2. Method notes that affect how to read the numbers

* **UDHR is one document per language**, so "split by file" is impossible inside it. Training on UDHR and testing on *independent* ethos text (Wikipedia-lang, parallel-classics, war-and-peace, Gutenberg, originals, monolingual-country legislation, children's books, and the chat logs in `19-organic-community`) is the honest design; the seed's within-UDHR 4/8/20-word result is replicated as the "easy" arm only.
* **Machine load:** the run shared a machine with load average 300-400; nothing here depends on timing.
* **Deviations from the pre-registration** (all disclosed again where they bite): the chat code moved during the study (`applyGate`, `contentTerms`, `FUNCTION_WORDS` appeared in `fold-chat-web.js`), so E3 reports both the pre-registered baseline (`onTopic`) and the current `applyGate`; E1 gained an exploratory arm that also trains on ethos text; E1's K grid gained 3000 and "all"; E2 uses MediaWiki text for es/de/ru (ethos has no encyclopedic text in those languages) and for a ru supplement (ethos has 16 Russian windows); E5 has no human-aligned gold at all (ethos' "aligned" war-and-peace files have different paragraph counts), so every alignment is a Gale-Church length alignment (silver); E4 part A and E3 labels were authored by me before scoring.
* **ethos coverage** (the real limit behind many results): Russian = one novel + two children's books (16 windows of 400 tokens); Hindi = UDHR + 2 children's files; `08-news-current` = 1 document; Wikipedia-language editions exist for 6 languages with 1-4 files each; Concepticon has English glosses only (verified), no per-language word forms.

## 3. The experiments

### E1 — language identification

**Hypothesis.** A char 1-3-gram naive Bayes trained on ethos beats a Unicode-script heuristic and a locale prior, can be calibrated, and supports a typed gap.
**Data.** Train: UDHR bodies, 462 classes (`und` entries dropped; the seed's 479 counted class codes differently). Test: independent labelled files (875 files across the ext, chat and control strata; of them 251 ext test files in 27 languages, 30,120 windows, and 140 chat-log test files in en/zh/de/es/it, 16,800 windows), 100 translated questions (5 questions x 20 languages, **assumed** correct), windows of 4/8/12/20 word-segments sampled from line starts, up to 30 per file per length. Dev/test by file. Families (declared): {es, ast, gl, ca, cat}, {pt-BR, pt-PT}, {nb, nn, da, sv}, {hr, sr-Latn, bs-Latn, cnr}, {zlm-Latn, id, min}, {de-1901, de-1996}, {el-monoton, el-polyton}, {zh, zh-Hant}, {fa, fa-AF}.
**Two arms.** `udhr` = pre-registered (UDHR only). `plus` = **exploratory** (UDHR + up to 200k chars of ethos text per label for 23 languages from half of the *dev* files; tuning on the other dev half; test untouched).

**Accuracy at the family level, uniform prior (macro over languages, 95% CI by file-cluster bootstrap; baselines are analytic/exact):**

| words | script heuristic | en-locale | NB `udhr` (registered) | NB `plus` | NB `plus`, shipped K=1000 profile |
|---|---|---|---|---|---|
| 4 | 0.125 [0.09, 0.14] | 0.037 | 0.706 [0.667, 0.744] | 0.814 [0.778, 0.857] | 0.746 [0.708, 0.784] |
| 8 | 0.125 | 0.037 | 0.833 [0.794, 0.869] | 0.877 [0.840, 0.921] | 0.851 [0.815, 0.893] |
| 12 | 0.127 | 0.037 | 0.866 [0.827, 0.897] | 0.901 [0.864, 0.936] | 0.884 [0.849, 0.919] |
| 20 | 0.127 | 0.037 | 0.875 [0.838, 0.907] | 0.920 [0.882, 0.950] | 0.884 [0.846, 0.920] |

(script heuristic = expected top-1 when guessing uniformly among the families that use the window's script; for Greek, Hangul, Japanese it is 1.0, for Latin 0.003 — it decides the script, never the language.) Within-UDHR 70/30 "easy" replication (3 windows per class from the held-out last 30% by position): class 0.90 / 0.95 / 0.96 at 4 / 8 / 20 words (family 0.91 / 0.96 / 0.97) — at or above the seed's 83/88/90 (different window sampling), and ~20 points above what independent text gives at 4 words (0.71 macro), so the easy setting overstates.

**By script (N = 8, `udhr` arm, test ext):** Greek 0.999, Hangul 1.0, Arabic 0.98, Japanese 0.86, Latin 0.855, Devanagari 0.78 (n = 23), Han 0.50. Han fails because UDHR contains nine Han-script Chinese lects (Mandarin, Yue, Wu, Min Nan, Hakka, Gan, Xiang, Jinyu, Han-nom) that are indistinguishable by characters: informal Chinese chat scores 0.18 family accuracy under the registered families and **0.99 [0.99, 1.00] when those lects are one family (post-hoc)**. Informal English scores 0.33 (the model prefers Scots `sco`, Interlingua `ia`, Nigerian Pidgin `pcm`) and 0.59 when {en, sco} is one family (post-hoc); the `plus` arm lifts English chat to 0.905 [0.885, 0.923].

**Chat logs, N 4-12, uniform prior (family accuracy [95% CI]):**

| | en | zh | de | es | it |
|---|---|---|---|---|---|
| `udhr` registered | 0.330 [0.305, 0.357] | 0.184 [0.166, 0.202] | 0.721 [0.681, 0.761] | 0.767 [0.667, 0.856] | 0.475 [0.432, 0.513] |
| `plus` | 0.905 [0.885, 0.923] | 0.603 [0.563, 0.640] | 0.842 [0.814, 0.875] | 0.781 [0.667, 0.889] | 0.843 [0.804, 0.875] |
| shipped profile (K=1000) | 0.742 [0.705, 0.774] | 0.324 [0.301, 0.345] | 0.823 [0.784, 0.868] | 0.730 [0.678, 0.789] | 0.801 [0.781, 0.822] |

(es has 3 test files only; zh `plus` is 0.986 with the lects merged.)

**Priors over languages (N = 4, test ext, macro family accuracy).** Prior mass pi on one class, rest uniform; "correct" = the true language (what a perfectly persistent session gives), "wrong" = a random wrong language, "en" = the browser-locale stand-in.

| prior | `udhr` | `plus` |
|---|---|---|
| uniform | 0.706 | 0.814 |
| correct, pi = 0.5 | 0.970 | 0.951 |
| correct, pi = 0.9 | 0.977 | 0.961 |
| wrong, pi = 0.5 | 0.570 | 0.715 |
| wrong, pi = 0.9 | 0.485 | 0.666 |
| `en` locale, pi = 0.5 | 0.395 | 0.530 |
| `en` locale, pi = 0.9 | 0.269 | 0.392 |

A session prior pays if the next turn keeps the language at least **34% (`udhr`) / 42% (`plus`) of the time** at pi = 0.5 (break-even persistence, estimated from the two rows above); at pi = 0.9 it needs 45% / 50%. A locale prior toward English is net harmful for every non-English asker. At N = 8 the effects shrink to +0.12 / -0.06.

**Calibration (E1-e).** Raw naive-Bayes posteriors are badly overconfident: ECE 0.295 [0.266, 0.326]; with the dev-fitted temperature T = 20 it is 0.058 [0.050, 0.068] (`udhr`), 0.080 [0.069, 0.091] (`plus`, T = 12), 0.076 [0.069, 0.085] (shipped profile, T = 12). It is much worse on short inputs (ECE 0.22 at N = 4 for `udhr`). **E1-e bar (<= 0.05) not met.**

**Typed gap (`language undetermined`).** Rule: accept iff calibrated family posterior >= tau, tau = smallest value on dev with accepted precision >= 0.95 (`received` target, giver = study author), plus (post-hoc, set on dev) a gram-coverage gate phi = 0.615 (5th percentile of the share of the window's 2-3-grams that appear in the winning class's profile). Shipped profile, test, tau = 0.8, with phi:

| words | coverage | accepted precision |
|---|---|---|
| 4 | 0.22 | 0.984 |
| 8 | 0.57 | 0.965 |
| 12 | 0.72 | 0.963 |
| 20 | 0.81 | 0.961 |

On the 100 translated questions the gate accepts 41 and is right on 95% of them (family accuracy overall 0.87 [0.79, 0.92]). **E1-f partly met:** precision >= 0.95 everywhere; coverage >= 0.70 only from 12 words (bar: at >= 8). Controls (II.10): the gate rejects random letters, keyboard mash, digits/symbols and character-shuffled real text 100% of the time with phi (tau alone passes 94% of random UDHR-alphabet strings — phi is what makes the gate falsifiable); it rejects Amharic/Lao (no class) 87%, but Old Norse (a language absent from UDHR) only 23% — it is read as Icelandic, the nearest class, and the gate cannot know better. Close pairs: family merging recovers 2.0 points at N = 8 (language 0.852 -> family 0.872, `udhr`) and 25.7% / 19.0% / 6.7% of language errors at N = 4 / 8 / 20 are inside a declared family; the cost of reporting a family is that `es` vs `ast`/`gl`/`ca` cannot choose a Wikipedia edition.

**Size vs accuracy (E1-g), `plus`, test sample, macro family accuracy at 8 words / gz size of the whole shippable profile** (8-bit quantised log-probs, shared gram dictionary, delta-coded ids; registered grid K <= 1000 plus 3000 and all):

| K per language | 100 | 200 | 300 | 500 | 1000 | 3000 | all |
|---|---|---|---|---|---|---|---|
| accuracy (8 words) | 0.524 | 0.677 | 0.742 | 0.787 | **0.831** | 0.825 | 0.733 |
| gz size (KB) | 84 | 173 | 260 | 429 | **823** | 1443 | 2341 |

Pruning is not just a size trick: dev-selected floors for unseen grams (lambda 3, at the edge of the registered grid) beat the add-delta smoothing of the full model by 10 points. 8-bit quantisation costs nothing (same 6,000 test windows, shipped config: 0.711 / 0.803 / 0.843 / 0.871 at 4 / 8 / 12 / 20 words quantised vs 0.711 / 0.802 / 0.841 / 0.872 in float64). The seed's top-300 (≈ 1.1 MB raw) loses 9 points vs K = 1000. **E1-g:** met in the literal sense (K = 500, 0.43 MB gz, is within 0.02 of K = all because pruned > full); the best usable point is K = 1000 at 0.82 MB gz.

**Bars.** E1-a not met (family at >= 8 words 0.85-0.88 < 0.90; at 4 words 0.75 < 0.80). E1-b not met (en 0.74, zh 0.32, de 0.82, es 0.73, it 0.80 vs 0.85; registered `udhr` arm much lower). E1-c **met** (+0.71 over the script heuristic, +0.80 over the locale guess at 8 words). E1-d: correct prior **met** (+0.26 at N = 4), wrong prior **not met** on the registered arm (-0.14 vs bar -0.10; `plus` -0.099). E1-e not met. E1-f partly met (above). E1-g met.

**Effect on failure (d).** The chat has no language field today. With the shipped profile + typed gap it can set `question.lang` for every question of >= 12 words (coverage 0.72, precision 0.96) and, with the previous turn's language as prior, for most follow-ups; below that it must say `language: undetermined` and let the mouth mirror the asker's language. Retrieval can pick the Wikipedia edition only for non-ambiguous families.

### E2 — function words and the grounding fork

**Hypothesis.** A frequency-derived closed class matches UD ground truth at least as well as the hand-typed STOP and extends to other languages; using it in the fork cuts false positives without losing paraphrase recall.
**Rule.** Per language, 400-token windows from ethos files (dev/test by file; <= 4 files per language = positional halves); word is function iff window-DF >= theta and file-spread >= f. (theta, f) set on **en dev** by maximum token-level F1 against UD closed-class (ADP, AUX, CCONJ, DET, PART, PRON, SCONJ at share >= 0.5, `received` UD convention): **theta = 0.25, f = 0, 96 words** (dev F1 0.800). Token-level here means window-type occurrences of forms present in the POS prior (542,773 of 723,457 en test occurrences).
**English test (73 files).** Derived set F1 **0.801 [0.797, 0.807]** (P 0.790, R 0.812); hand-typed STOP + `len < 4` (the fork's own complement) 0.715 [0.707, 0.722]; STOP alone 0.726 [0.718, 0.739] (R 0.669); `len < 4` alone 0.617; the new `contentTerms` complement in `fold-chat-web.js` (`FUNCTION_WORDS` + `len < 4`) 0.729 [0.721, 0.736]. Type-level (8,943 forms with >= 3 test occurrences): derived 0.486 vs 0.255 for STOP + `len < 4` (the length rule destroys precision on types).
**Russian.** Ethos-only is one document (16 windows; test = second half, no CI possible): derived 0.719 vs 0.717. **Post-hoc supplement** (24 MediaWiki ru articles + the ethos novel, 25 files, 292 windows, by-file split, 11 test files): derived with the en (theta, f) transferred **0.767 [0.750, 0.783]**, refit on ru dev 0.779 [0.767, 0.788]; STOP + `len < 4` 0.689 [0.671, 0.704] (it gets Russian from the `len < 4` rule alone — the English STOP list contributes nothing, F1 0.000).
**Other languages: no ground truth** (no UniMorph/UD function lists in ethos — searched). 26 language lists were derived (`out/function-words-v1.json`, 10 KB gz); dev-vs-test Jaccard of the derived set is the only reliability proxy: en 0.87, de 0.82, el 0.71, it 0.68, fr 0.66, la 0.52, es 0.48, ja 0.38, zh 0.35 (register contamination is visible: es = legislation, so `artículo ley` appear; zh/ja = classical texts). Lists are only as general as the corpus is.
**Bar E2-a: partly met** — non-inferior on en (+0.086), ru refit 0.72-0.78 >= 0.70, but the registered clause "baseline <= 0.5" fails (the baseline is 0.69-0.72 because of the length rule).

**Downstream on the grounding fork** (59 usable items: 12 en, 12 fr, 11 es, 12 de, 12 ru; each with V verbatim, P true paraphrase, NF same-topic unsupported addition, NN wrong name, NU wrong number; en and 4 fr items from ethos text, the rest MediaWiki; fork = `attribute()` from `fold-chat-ground.js`, read, copied with its two substantive-token predicates made swappable, imported from `eval/priors/tmp/`; a sentence is grounded iff every sentence piece is attributed). Rates, all languages:

| fork variant | V | P (paraphrase) | NF | NN | NU | macro |
|---|---|---|---|---|---|---|
| A current (len >= 4 and not STOP) | 98% [91, 100] | 61% [48, 72] | **90% [80, 95]** | 16% [9, 28] | 2% [0, 11] | 0.632 [0.587, 0.675] |
| B len >= 4 only | 98% | 61% | 90% | 16% | 2% | 0.632 |
| C derived function words only | 98% | 64% | 90% | 16% | 2% | 0.641 |
| D len >= 4 and derived | 98% | 61% | 90% | 16% | 2% | 0.632 |
| E no filter | 98% | 68% [55, 78] | 90% | 16% | 2% | 0.649 [0.605, 0.689] |
| F A + sentence-final-name fix (post-hoc) | 98% | 59% | 81% [70, 89] | **4% [1, 12]** | 2% | **0.681 [0.645, 0.716]** |

(macro = mean of paraphrase TPR and 1 - FPR on NF, NN, NU. Screening out the 2 en NN items whose substituted name already occurs elsewhere in the passage changes en NN from 17% to 0% and nothing else; conclusions identical.) **A, B and D give identical verdicts on every one of the 280 variant sentences** (disagreements A vs D and A vs B: 0); paired macro difference D - A = **0.000 [0.000, 0.000]**; C - A = +0.008 [0.000, 0.021]; E - A = +0.017 [0.004, 0.034] — the substantive-token filter, hand-typed or derived, *reduces* paraphrase recall (E has 7 points more) and prevents no false positive in this set. **Bar E2-b not met.** What the fork gets wrong is not the stoplist: (i) it grounds **90%** of same-topic unsupported additions because the phrase attachment (>= 2 consecutive substantive tokens) is satisfied by the shared subject phrase — an inherent property of the method; (ii) the name check is blind to a name that ends the sentence: see section 4 (F). **Effect on (c):** the Champ-de-Mars-in-Lyon false positive is caused by that name-check defect, not by the hand-typed STOP list; the II.11 objection to the hand-typed list stands as a principle, but replacing it changes nothing measurable.

### E3 — retrieval relevance floor ("him")

**Data.** 52 queries in 9 languages (18 single-entity, 10 raw + 10 carried pronoun follow-ups as pairs, 7 comparisons, 7 false-premise), top-5 of the *own-language* Wikipedia search (MediaWiki), 248 candidates, labelled on-topic/off-topic against a written rubric before scoring: **26 strict-positive (10.5%)**, 44 under the lenient labels (answer-bearing neighbour pages count). Dev 28 / test 24 questions.
**Scorers.** B1b = the app's current `applyGate` (`framings` for named entities, `contentTerms` overlap otherwise, **with its fallback to read the top 3 when everything is rejected**); B1b' = its verdict without the fallback; B1a = the registered `onTopic(entitiesOf)`; P1 = IDF-weighted share of the question's non-function-word tokens (derived function words, IDF from the E2 windows) found in title + snippet, floor tau set on dev for 0.85 recall (tau = 0.414).
**AUROC.**

| | P1 | B1b (app) | B1b' | B1a | P1 - B1b |
|---|---|---|---|---|---|
| registered test split (n = 120, 11 positives, 24 questions) | 0.603 [0.472, 0.756] | 0.560 [0.529, 0.593] | 0.537 | 0.523 | **+0.044 [-0.086, +0.200]** |
| all 52 questions (n = 248, 26 positives; AUROC has no tuned parameter, so this is legitimate but not registered) | 0.666 [0.578, 0.755] | 0.551 [0.498, 0.588] | 0.520 | 0.504 | +0.115 [0.020, 0.231] |

The IDF adds little on top of the function-word filter alone: P1 - P1(uniform weights) = +0.032 [-0.005, 0.072] (all), +0.087 [0.030, 0.159] with the lenient labels, on corpora of 16 (ru) to 8,074 (en) windows; Hindi has no corpus at all. **Bar E3-a not met** on the registered split (CI spans 0); the unregistered full-set view excludes 0.
**Reads.** At the operating points (test split, top-3 of the accepted candidates are READ): ungated 62 of 72 reads off-topic (**0.86**); the app's gate 0.86 (it falls back to reading anyway when it rejects everything — 0 typed gaps in 52 queries); P1 floor **0.83** with on-topic recall 0.82 (9 of 11). All 52 questions: ungated 0.840, app gate 0.844, P1 0.816 at recall 0.846. **Bar E3-b not met** (needs <= half of baseline's share). The gate cannot help because the pool itself is almost all off-topic: of 52 queries only 22 have any on-topic result in the top 5; **30 queries have none**, where the correct output is a typed gap — P1 returns a typed gap for 6 queries, all correct; the app's gate (no fallback) for 5, 3 correct.
**Controls (II.10).** Shuffled-title control (same-language candidates of an unrelated question): P1 accepts **1.2% [0.4, 3.5]** (3/248); the app's gate without fallback accepts **23.3% [18.4, 29.1]** (55/236). Label-permutation AUROC 0.504 [0.388, 0.616] (expected 0.5). Binary baselines are exactly 0.5 for zh/ja/hi/ar because `entitiesOf` finds no entities and the gate then accepts everything.
**Specificity gap for the raw follow-up (E3-c).** s* = 6.07 (dev, Youden 0.50): fires on 7/10 raw follow-ups [40%, 89%] and on 12/42 standalone/carried questions [17%, 44%] (test split: 3/5 and 5/19). **Bar E3-c not met** (>= 80% / <= 10%). It cannot work for the languages where the corpus is small: Chinese rare tokens look maximally specific, Hindi has no IDF.
**Post-hoc E3b — what do function words buy a search query?** Searching with the question's *content words only* changed the top-5 for 35 of 52 queries but moved the on-topic share of the top 3 from 0.167 [0.109, 0.237] to 0.179 [0.122, 0.250] (**+0.013 [0.000, 0.032]**) and queries with any on-topic top-5 result from 22 to 23. MediaWiki search already ignores filler; stripping it is not a lever.
**Carried referent (the registered failure case).** "what happened to him later in life?" raw -> 5 results, all off-topic (*What Happens at Night*, *Look What's Happened to Rosemary's Baby*, ...); with the carried "Judge Richard Henderson" -> *Little Richard*, *Joseph Force Crater*, ... all off-topic too (no Wikipedia page for that judge). Over the 10 pairs the carried query reaches an on-topic result in the top 5 for 5 pairs vs 0 for the raw queries — the carry is necessary, not sufficient.
**Effect on (a).** The prior-based floor is a valid positive on the controls (rejects unrelated candidates 99% vs the app's 77%) but does not reduce wrong reads; the lever that matters is entity-based querying plus the carry of E4b.

### E4 — entities and referents without case

**Part A: entity finding.** 300 mechanically selected Wikipedia sentences (first 6 qualifying sentences of 5 articles x 10 languages: en, es, ru, zh, ja, ar, hi, he, th, ko), 795 hand-labelled gold mentions (rubric `data/e4-rubric.md`; titles/nationalities/languages/periods excluded). Mention-level, relaxed (>= 50% character overlap) F1 [sentence-bootstrap 95% CI]:

| finder | cased pooled (en, es, ru) | caseless pooled (7 scripts) | caseless detail (P / R) |
|---|---|---|---|
| B0 `entitiesOf` (`\p{Lu}` regex, chat today) | 0.75 [0.68, 0.82] (P 0.68, R 0.85) | 0.03 [0.01, 0.06] (R 0.02) | predicts 1 mention of 132 gold in zh, 1 of 95 in ja, 0 of 95 in ar, 6 of 72 in hi, 1 of 73 in he, 3 of 71 in th, 2 of 105 in ko |
| B1 `casedRuns` (`fold-chat-mind.js`) | **0.79 [0.73, 0.85]** (P 0.71, R 0.89) | 0.00 (R 0.00, **zero spans in every caseless script**) | — |
| P-cased (casedRuns-style + POS-prior opener rule + name-prior titles/particles) | 0.76 [0.70, 0.81] | — | — |
| A1 title authority, module-faithful (longest common stretch with the titles of the top-5 own-language search results) | 0.38 [0.31, 0.46] | 0.30 [0.26, 0.35] | zh 0.31, ja 0.29, ar 0.24, hi 0.41, he 0.36, th 0.44, ko 0.11 |
| A2 + char-level stretches + script cues (katakana runs, Latin runs in non-Latin text) | 0.39 | **0.33 [0.29, 0.37]** (P 0.42, R 0.27) | zh P 0.87 R 0.31; hi P 0.64 R 0.38; he P 0.67 R 0.27; ar P 0.61 R 0.20; ja P 0.65 R 0.25; th P 0.14 R 0.42; ko P 0.80 R 0.11 |
| A2 + cues, **own article's title removed** (control) | 0.26 | 0.17 [0.13, 0.21] | most of the authority is the sentence's own source article |
| P-cased union A2 + cues | 0.72 | 0.33 | — |

**Bar E4-a not met**: the prior-driven cased finder is *not* better than `casedRuns` (0.76 vs 0.79; it is worse in Spanish, 0.65 vs 0.84, where there is no POS prior and only 47 derived function words), and no caseless script reaches recall >= 0.60 at precision >= 0.70 (best: zh P 0.87 / R 0.31). **There is no ML-free entity finder for caseless scripts that ethos can supply**; the only working authority is the retrieved titles, as `admitReferents` already does, and it only recovers entities that a retrieved title contains. Recurrence-only admission (khora) was not tested: single sentences carry no recurrence. **Defects found in `casedRuns` (measured on these sentences):** the particle alternatives (`de|da|di|del|…|e|y|al`) have no word boundary, so a trailing particle prefix is absorbed — `"The French emperor…"` -> `"The French e"`, `"Napoleon Bonaparte also won"` -> `"Napoleon Bonaparte al"`, `"Tokyo alone is large"` -> `"Tokyo al"`; 14 of 189 predicted runs (7.4%) end in such a fragment (`Middle East du`, `Italian al`, `War of`); inside a multi-sentence answer the character class `[.'’-]` lets a run swallow a sentence boundary (`Александра Пушкина. Пушкин`, `Second World War. His`, `Восточной Сибири. Из`) and those junk surfaces enter the referent record.

**Part B: pronoun carry — `fold-chat-mind.js` exactly as it is.** 120 two-turn dialogues written by me before running: en 20 follow-ups + 20 new-topic, ru 20 + 20, es 10 + 10, zh 10 + 10; turn 2 names no entity. Follow-up gold = the referent turn 2 means (4 of 20 en and 2 of 20 ru are *secondary* referents — "when did **she** die?" about the wife); new-topic turn 2s are factual no-entity questions, impersonal "it" questions, small talk and long self-sufficient questions. `admitReferents` on turn 1 (question, answer, source titles) then `resolveQuestion`; hints H0 = none, H1 = `personalPronouns` from the ethos pronoun priors, H2 = H1 + ethos `titles`. Wrapper G (outside the app, registered): carry only if turn 2 contains a third-person pronoun form from the prior. Hint derivation: forms with >= 5 third-person tokens (declared floor); gender-marked = Masc/Fem majority. **Correction to the pre-registration:** the floor of 5 does *not* remove the UD tagging-noise forms `the` (7), `there` (14), `one` (21); I had stated that it did.

| condition | follow-up: gold in carried | follow-up: carried wrong | nothing carried | new-topic: **false carry** |
|---|---|---|---|---|
| en+ru H0 (no hints) — the module today | 85% [71, 93] (34/40) | 13% | 3% | **88% [74, 95]** (35/40) |
| en+ru H1 (ethos pronouns as `personalPronouns`) | 80% [65, 90] | 18% | 3% | 88% |
| en+ru H2 (+ethos titles) | 80% | 18% | 3% | 88% |
| en+ru G (pronoun trigger, registered) | 78% [62, 88] | 18% | 5% | **18% [9, 32]** (7/40) |
| en alone: H0 / G | 80% / 85% | 15% / 10% | 5% / 5% | **85% [64, 95]** / **30% [15, 52]** |
| ru alone: H0 / G | 90% / 70% | 10% / 25% | 0% / 5% | **90% [70, 97]** / 5% [1, 24] |
| es, zh: H0 | 90% (9/10), 100% (10/10) | — | 0% | 70% (7/10), 90% (9/10) |
| es, zh: G | 0% — **typed gap `no pronoun prior`**, nothing carried | — | 100% | 0% |

**Reading it.** (1) The module's carry fires on *any* short question with no cased run or known referent: new-topic false carry 85% (all four languages: 51/60), including 100% of the no-entity factual questions and small talk in en and ru. **Bar E4-b (H0 false carry <= 0.10) not met, as predicted.** (2) The ethos pronoun prior is the trigger that fixes it: G brings en+ru to 18% [9, 32] — but **en alone is 30% [15, 52]: bar not met** (the leak is `the`/`there` (noise forms) and impersonal `it`: "Is it going to rain tomorrow?", "How long does it take to learn piano?"). (3) **Post-hoc variants** (not registered, shown so the trade-off is visible): *Gp* — trigger on personal (Masc/Fem) forms only (he, she, him, her, он, она…): false carry **0/60 [0, 6]** (en 0/20, ru 0/20), carry-correct en 50% [30, 70], ru 85% [64, 95]; *G3* — third-person list cleaned by the POS prior (drops `the`, `one`): false carry en 20% [8, 42], ru 5%, and the same cleaning wrongly removes ru его/её/их (they are DET in UD). (4) **Where the ethos priors improve `hints`:** for **en**, `personalPronouns` from the prior reproduces the hand-typed `EN_HINTS` of `fold-chat-mind.test.mjs` and moves secondary-referent follow-ups from 0/4 to 2/4 while losing 1 of 15 main-referent cases (paired discordant: H1 right/H0 wrong 2, H0 right/H1 wrong 1); the prior lacks *judge* (the test's own `titles` has it), so `titles` from `name-priors` did nothing measurable (H2 = H1 on all 60 dialogues). For **ru**, passing the Masc/Fem forms as `personalPronouns` **hurts**: carry-correct 90% -> 75% (paired: H0 right/H1 wrong 4, reverse 1), because Russian grammatical gender makes он/его refer to masculine inanimates too (Байкал, Эрмитаж, Кремль) and the person-restriction then selects the wrong pool. The ethos pronoun prior should be used as a *trigger* everywhere, and as a *person hint* only where gender is natural (en); `out/hints-v1.json` carries that distinction. (5) What no ethos prior can do: choose between two persons of the same gender, or between a person and a "person-like" place — `personLike` treats any multiword cased run (*Eiffel Tower*, *Champ de Mars*) as a person. A person-typing authority (Wikidata instance-of) would be needed; ethos has none.
**Effect on (a):** with the trigger, "what happened to him" carries the last answer's referent (en: 85% in the carried set) and unrelated new questions inherit nothing (Gp: 0%; G: 18%). **Effect on (e):** khora read behaviour was not measured; E4 part A shows that caseless scripts need retrieved titles as the entity authority.

### E5 — cross-lingual anchoring

**Hypothesis.** Language-invariant anchors (numbers, Latin-script/cognate names), IBM Model 1 tables learned from parallel text, and a Concepticon concept bridge can ground a sentence in language A against a passage in language B above the chat's 0% baseline.
**Data, and what could not be done.** (ii) The concept-set bridge is **infeasible**: `concepticon.tsv` has 4,165 concept sets with an English gloss, semantic field and definition; the ~160 per-language word lists are *not vendored* (the README says so). No lexical bridge can be built from it. There is **no human-aligned gold** in ethos: the "aligned" war-and-peace files have 111/107/106 paragraphs (en/fr/ru), UDHR files 66-92 paragraphs. Every test set below is therefore a **Gale-Church length alignment** (1-1 paragraph pairs; length-only, hence independent of the lexical signals but unverified). Alignment sanity: UDHR is verified by its article numbers (the article number is shared by 30 of 30 numbered paragraph pairs for es, fr, ru, ja, ar, hi, ko, vi; 23/28 for sw; 0/29 for zh, whose numerals are not digits — so zh pairs are unverified); Alice and war-and-peace en-fr have no digits to check; **Gulliver's Travels alignments are bad** (61 of 306 Finnish paragraphs aligned 1-1, 34 Dutch; shared numbers 0-13%), so those tests are not interpretable and are reported only as failures. Test units are whole paragraphs (>= 40 characters), candidates are the 1-1 pairs of a block of 60 consecutive paragraphs, hard negatives are the two adjacent paragraphs; models are trained on parallel-classics **works other than the test work** (train/test by work), or, where no other work exists, on a held-out fold of the same text (war-and-peace ru: 50 pairs; UDHR: 4/5 of the text, 5 contiguous folds). Queries capped at 240 per test (the first 4 blocks), Model 1: 10 EM iterations, paragraphs truncated to 60 tokens (both deviations from the registration for speed on a loaded machine).
**Scorers.** S0 = longest shared token run (what the chat's `attribute` can see; ties split). S1 = anchors: digit strings plus Latin-script tokens of >= 4 letters that are not function words, matched at edit-similarity >= 0.8 (cognates and names; 0.8 is `declared`). S2 = IBM Model 1 both directions, mean log-likelihood ratio against the target unigram. S3 = within-query z(S1) + z(S2).
**Results** (top-1 over the 60-way block, with the Wilson CI; chance = 1.7% unless noted; TPR = share of true pairs scoring above the 99th percentile of adjacent-paragraph negatives, i.e. at 1% FPR):

| pair, test set (trained on) | n queries | S0 token-run | S1 anchors | S2 Model 1 | S3 | S2 TPR@1%FPR | S3 TPR@1%FPR |
|---|---|---|---|---|---|---|---|
| en-fr, Alice (Faust, Robinson, Gulliver; 1,229 pairs) | 240 | 5% [3, 8] | 31% [26, 37] | **73% [67, 79]** | 63% [57, 69] | 35% [30, 42] | 43% [36, 49] |
| en-de, Alice (Faust, Grimm, Perrault, Robinson; 1,018) | 240 | 7% [4, 11] | 20% [16, 26] | **54% [47, 60]** | 51% [45, 58] | 41% [35, 48] | 35% [29, 41] |
| en-it, Alice (Pinocchio, Gulliver; 1,189) | 240 | 3% [1, 6] | 19% [14, 24] | **64% [57, 70]** | 64% [57, 70] | 49% [43, 55] | 62% [55, 68] |
| fr-de, Alice (Faust, Robinson, Grimm; 861) | 240 | 4% [2, 7] | 7% [4, 11] | 35% [29, 41] | 25% [20, 30] | 3% [1, 5] | 18% [13, 23] |
| en-fr, **War and Peace** (all classics, 1,845 pairs) | 58 | 24% [15, 37] | 57% [44, 69] | 69% [56, 79] | **79% [67, 88]** | 72% [60, 82] | 66% [53, 76] |
| en-ru, War and Peace (3 folds of 25; 50 train pairs of the same book; chance 4%) | 25 each | 9 / 27 / 23% | 31 / 18 / 18% | 60 / 60 / 88% | 76 / 52 / 68% | 72 / 20 / 8% | 24 / 12 / 20% |
| fr-ru, War and Peace (3 folds of ~25; chance 4%) | ~25 each | 38 / 44 / 38% | 43 / 43 / 40% | 65 / 73 / 75% | 62 / 62 / 58% | 58 / 42 / 13% | 38 / 54 / 50% |
| UDHR es / fr / ru -> en (5 folds, trained on 4/5 of the same text; chance 5.6%) | 88-90 | 43 / 40 / 37% | 83 / 48 / 37% | 59 / 51 / 48% | **94 / 75 / 76%** | 87 / 77 / 79% | 94 / 80 / 82% |
| UDHR zh / ja / ar / hi / ko / vi / sw -> en | 66-92 | 6 / 6 / 38 / 5 / 36 / 39 / 40% | 6 / 39 / 38 / 36 / 36 / 37 / 40% | 59 / 59 / 43 / 57 / 45 / 58 / 36% | **59 / 88 / 71 / 84 / 72 / 87 / 64%** | 67 / 66 / 79 / 74 / 70 / 84 / 55% | 73 / 90 / 78 / 79 / 73 / 90 / 68% |
| Gulliver en-fi, en-nl, fr-it, en-fr | 34-164 | 3-4% | 2-3% (en-fr 41%) | 0-9% (en-fr 38%) | 2-3% (en-fr 42%) | — | — |

**What this says.**
* **The baseline is not 0% when anchors exist.** Where text has digits or Latin names the chat's token-run already finds the pair some of the time: 24% on War and Peace en-fr (names), 36-43% on UDHR (the *article number* is the same digit string in every language; for zh/ja/hi, whose numerals are not ASCII, S0 falls to chance, 5-6%). For pairs that share neither script nor digits it is exactly chance.
* **Model 1 from ethos' parallel text is a real, weak bridge.** Held-out works: 73% / 54% / 64% / 35% top-1 for en-fr, en-de, en-it, fr-de against a chance of 1.7% and against 3-7% for the token-run; on a held-out *novel* (war-and-peace en-fr, a different genre from every training work) 69%, and 79% combined with anchors. AUROC vs the adjacent paragraph is 0.92-0.96 for S2 on en-fr/en-de/en-it/war-and-peace (0.83 for fr-de) and 0.67-0.86 for S1. Pairs involving ru/zh/ja/ar/hi/ko/vi/sw have **only 50-90 parallel paragraph pairs in ethos** (UDHR; war-and-peace for ru), so those numbers are toy-scale *in-distribution* checks (the same legal formulae recur across folds, the same characters recur in the novel) and say nothing about generalisation to a web page.
* **Which pairs have enough data.** Usable (>= ~600 parallel paragraphs outside the test work): en-fr, en-de, en-it, fr-de, (en-fi, en-es via Pinocchio/Faust but no held-out test). Infeasible with this data: any pair involving ru, zh, ja, ar, hi, ko, vi, sw beyond UDHR/war-and-peace toy scale, every pair of two non-English languages other than fr-de, the concept-set bridge for all languages, and any evaluation against human-aligned gold.
* **"Sourced" or "witnessed by selection"?** Registered bar E5-b required TPR >= 0.5 at FPR <= 1% on adjacent paragraphs. **Met** only for war-and-peace en-fr (S2 72% [60, 82]), en-it with anchors (S3 62% [55, 68]) and in-distribution UDHR; **not met** for held-out Alice en-fr (35-43%), en-de (35-41%), fr-de (3-18%). Independent of that bar, Model 1 cannot be `sourced`: it rewards topical vocabulary overlap, so a paragraph with the *wrong number or name* scores nearly as high as the right one (the E2 NN/NU classes for monolingual grounding are exactly what it does not check), it is trained per language pair, and the support in the chat is a *source page that is not a translation of the claim*, which is harder than this test (every candidate here has a true translation). **Recommendation: `match: cross-lingual` is witnessed-by-selection** (the passage was retrieved and its Model-1/anchor score is above a floor), drawn differently from `sourced`; promote to `sourced` only when every number and Latin-script name in the claim is present in the passage (the S1 anchor condition, which *is* checkable) *and* the translation score passes. Failure (f) therefore stays open: the 0% baseline becomes 5-7% -> 35-75% only for the four well-resourced pairs, never for zh/ar/ru/es without more parallel text.
**Bars.** E5-a **met** (>= 4 pairs with S2/S3 top-1 above chance by CI: en-fr, en-de, en-it, fr-de, war-and-peace en-fr/en-ru/fr-ru). E5-b not met as a general statement (met for 1-2 of 4 held-out pairs).

### E6 — genre / source-type priors

**Verdict: the data cannot support it** (`refused-as-underpowered`, IV.3). A fact needs the *same* fact stated in several source types; the inventory (30 historical persons, 28 resolved to Wikidata gold, surnames searched in <= 80 sampled files per genre) shows where the mentions are: encyclopedic 29 persons mentioned, literature 22, academic 9, western canon 3, community chat 2, **government-legal 0, news 0, holy texts 0** (news = 1 document in ethos). The only measurable outcome is an extraction of the birth year from a person's *own* ethos Wikipedia article against Wikidata: n = 8 outcomes (3 correct; 4 extractable at all — the ethos text keeps wiki-link artifacts in the lead), against the registered minimum of 30 per source type. No Brier comparison was computed. (One gold item is suspect — the Wikidata search for "Ludwig Wittgenstein" returned an older namesake — which would not change the verdict.) **III.6:** a source-type prior is about the *document*, not the reader; any design that ranks by what this reader has accepted is out of bounds, and nothing built here does. What would make E6 testable: parallel statements of the same facts in >= 4 ethos genres (news and community text about named entities; today only encyclopedic + literature + academic carry them), with fact-level annotation.

### E7 — code priors (and what was not measured)

**E7-a.** 30 Python snippets written by me (15 clean, 15 with one injected fake API: 10 non-existent attributes of core modules — `math.cube`, `os.listfiles`, `json.parse`, `re.matches`, `random.pick`, `datetime.now`, `itertools.flatten`, `statistics.average`, `time.sleep_ms`, `collections.OrderedList` —, 3 undefined bare functions, 1 non-existent module, 1 non-existent `str` method); ground truth established by actually resolving every call with CPython (`e7/truth.py`; clean snippets also executed). Detector = regex scan of calls resolved against `python-language-law-prior-v1.json` (158 builtins, 300 stdlib module names, `coreApi` of 25 modules): **TPR 14/15 = 0.93 [0.70, 0.99]; FPR 1/15 = 0.07 [0.01, 0.30]**. Misses: the instance-method fake (`"s".reverse()`, not statically resolvable without types). The one false positive (`os.listdir`, `os.getcwd` flagged) exposed that **`coreApi` is truncated at 60 entries per module** for `os`, `typing`, `sys`, `math` (alphabetical order: `os` stops at `O_*`), so a name absent from those four lists proves nothing. A truncation-aware variant (post-hoc: modules at the cap are `unverifiable`, a typed gap) has FPR 0/15 and TPR 12/15 (it loses the `math.cube` and `os.listfiles` fakes). Ablation: bare names only 3/15, module attributes only 10/15, module names only 1/15; syntax checking accepts all 30. **Bar met on point estimates (TPR >= 0.80, FPR <= 0.10); with n = 15 + 15 the Wilson intervals do not demonstrate it.**
**E7-b/c** (fold-reading-priors, display/pronunciation/typography priors, concern/need priors) were inspected only. `fold-reading-priors` holds one file (War and Peace; English candidates only); `concern-priors` and `need-priors` are corpus-specific (English narrative); none was measured, and none maps onto a step of the six-step turn without new construction.

## 4. Defects in the chat's own code found by the study (worth more than any prior tested)

* **(F) `fold-chat-ground.js::namesIn` ignores a name that ends the sentence.** `LONE_NAME_RE` ends in `(?![\p{L}\p{N}_.'-])`, so `"The tower stands in Lyon."` yields `[]` while `"... in Lyon today"` yields `["Lyon"]`. This is why "…stands on the Champ de Mars in Lyon." is grounded (the failure (c)): the one wrong name is sentence-final. Repair tested outside the app (lookahead `(?![\p{L}\p{N}_'-])(?!\.[\p{L}\p{N}])`): wrong-name false positives 16% -> 4% overall (en unchanged, non-English 16% -> 0%), same-topic additions 90% -> 81%, paired macro **+0.049 [0.018, 0.081]**, paraphrase recall 61% -> 59%. Not a prior; a one-line regex fix.
* **The fork grounds 90% of same-topic unsupported additions** (NF): any sentence that repeats the subject phrase of a passage (>= 2 substantive tokens) is attributed to it. Phrase attachment cannot separate "says the same" from "mentions the same thing" — janus/khora-side claim comparison is what the architecture calls for.
* **`fold-chat-mind.js::casedRuns`**: unbounded particle alternatives and the sentence-boundary-crossing character class (details in E4) pollute the referent record that `resolveQuestion` then carries; `resolveQuestion` carries on *any* short no-entity question (85% false carry) and `personLike` treats any multiword cased run as a person.
* **`fold-chat-web.js::applyGate`** falls back to reading the top 3 when it rejects everything, so it never produces the typed gap (0 of 52 queries), and its no-entity path accepted 23% of a shuffled-title control.

## 5. Artifacts (all built from ethos by scripts in `eval/priors`; each carries its provenance)

| file | what | raw | gzipped | built by |
|---|---|---|---|---|
| `out/langid-v1/` (`meta.json`, `grams.txt`, `ids.bin`, `q.bin`) + `out/langid-decode.mjs` | `LangIdProfile@1`: 462 classes, 84,279 grams, K = 1000/class, 8-bit log-probs, T = 12, tau = 0.8, phi = 0.615, family map | 1.46 MB | **0.827 MB** (meta 3 KB, dictionary 207 KB, ids 274 KB, q 342 KB) | `e1/ship.mjs` |
| `out/function-words-v1.json` | `FunctionWordPrior@1`: 26 languages, rule + (theta = 0.25, f = 0) + corpus size per language | 22.8 KB | **10.0 KB** | `e2/derive.mjs` |
| `out/hints-v1.json` | `MindHints@1`: en/ru/es pronoun forms (third-person; gender-marked), titles, count floor, the ru warning | 2.1 KB | **1.1 KB** | `e4/build-hints.mjs` |
| **total** | | | **≈ 0.84 MB** of the 1.5 MB budget | |

Decoding is dependency-free JS (`langid-decode.mjs`, round-trip check: the shipped bytes classify 200/200 test windows identically to the in-memory model). Profiles are loaded lazily as four small `fetch`es; no build step, no CDN. `trainedOn` in `meta.json` states that the profile was trained on UDHR plus ethos dev-train files of 23 languages (capped 200k chars each); the hash-split train/dev/test is reproducible from `e1/arm.mjs`.

## 6. Ranked integration recommendation

Placement uses the six steps of `docs/NEXT-ARCHITECTURE.md`.

1. **Language field and session language prior — ship first (E1).** Step 1 (classify) / step 2 (perceive in context): `question.lang = langid.classify(text, { prior: { lang: lastTurnLang, weight: 0.5 } })`. Use pi = 0.5 only when the previous turn exists (the break-even persistence is ~0.4); **never** seed from `navigator.language` (it costs 14-31 points for non-English askers; at most use it as a *tie-break among already-accepted candidates*). Output when it cannot decide: typed gap **`language: undetermined`** (kind `not-computed`), drawn as a mark, never as prose; step 5 then instructs the mouth to answer in the language of the question as written, and step 3 searches the script-matched edition only when the accepted family has one edition (es/ast/gl/ca and nb/da/sv families stay `undetermined` for edition choice). Short inputs (< 8 words) will gap most of the time (coverage 0.22 at 4 words): that is the correct behaviour at 0.98 precision, and it is why the previous-turn prior matters. Before shipping, fix the Chinese-lect and {en, sco} family declarations in `meta.json` (post-hoc evidence: 0.32 -> 0.99 for Chinese chat) and re-run E1.
2. **Pronoun form as the trigger for referent carry — ship with the mind module (E4b).** Step 2: `resolveQuestion` should carry only when turn 2 contains a third-person form from `hints-v1.json` (`thirdPerson` for en/ru; typed gap `no-pronoun-prior` for es/zh/…, which then carry nothing and show "the question names no one — ask which person?"). Prefer the personal-only trigger (Gp, 0/60 false carries) until the impersonal-`it` problem is solved; use `gendered` as `personalPronouns` only for `en`. Fix `casedRuns` (word-boundary the particles; stop at sentence punctuation) first — otherwise the record the carry reads is polluted. Output when it cannot decide: no carry and a drawn `question names no referent` mark; `resolved` is shown to the person as `"Read 'him' as …"`.
3. **Fix the grounding fork's sentence-final name check — before any prior (E2).** Step 6 (ground and draw): +0.049 macro, wrong-name false positives 16% -> 4%, one line. Then, optionally, replace both hand-typed lists (`STOP` in `fold-chat-ground.js`, `FUNCTION_WORDS` in `fold-chat-web.js`) by `function-words-v1.json` per language: no measured accuracy change, but it satisfies II.11 and is the only way to cover languages the English lists do not (Russian: 0.78 vs 0.69 F1). Do not expect it to cut false positives.
4. **Query by entity, not by question string (E3, post-hoc E3b).** Step 3 (retrieve): the function-word floor and IDF did not help and query stripping gained 1.3 points; the lever is entity-based queries from the carried referent and title authorities, plus a typed gap when no candidate title contains a question entity (30 of 52 queries had none). Do not ship the relevance floor; keep P1 as a *control* (it rejects shuffled-title candidates 99%) in the eval harness.
5. **Coding lane: code priors as a hallucination screen (E7).** Step 6 for `kind = code`: flag `module.attr` calls for modules whose `coreApi` is complete, treat the 4 truncated modules as `unverifiable` (typed gap), and ask the owner to regenerate the prior without the 60-entry cap.
6. **Cross-lingual support level (E5) — typed, weaker than `sourced`.** Step 6: add `match: "cross-lingual"` and render it as *witnessed by selection*: the passage was retrieved for a referent the question names, and a Model-1 + anchor score is above a floor (en-fr, en-de, en-it, fr-de only; tables are not built into `out/` yet: a pruned en-fr table is 0.15-0.30 MB gz per direction (58,901 entries at t >= 0.02: 297 KB gz; 28,144 at t >= 0.05: 154 KB gz — measured size, accuracy after pruning not measured), so one pair (both directions, 0.3-0.6 MB) fits beside the 0.84 MB already used and a second would not). Promote to `sourced` only if every digit string and Latin-script name in the claim occurs in the passage (checkable) — and say `not-computed` for every other language pair. Failure (f) stays open.
7. **Do not integrate:** genre priors (E6, refused-as-underpowered), a caseless entity finder from ethos (E4a), a cross-lingual `sourced` level (E5).

## 7. What ethos is missing (proposals for the ethos owner — I changed nothing)

* **Language ID training text**: UDHR is ~8 KB per language and one translation per language (legal register). A second, informal register per major language would remove the biggest error classes (English -> Scots/Interlingua/Pidgin, Spanish -> Asturian, French -> Occitan). The 23 languages whose ethos text lifted accuracy 0.83 -> 0.88 at 8 words show the size of the gain; ~440 UDHR languages have nothing else. Declare the Chinese-lect and English-lexified families in the corpus metadata.
* **Pronoun priors beyond en/ru** (es/fr/de/it/pt/zh/ja/ar/hi/he/tr…), and a **person-ness / name-gender prior**; the name priors lack *judge* (and every profession title), `name-parts-ru` has no titles, and no prior distinguishes persons from places.
* **UD closed-class ground truth** for languages beyond en/ru (the derivation exists; the validation does not). Per-language corpora are tiny for ru (16 windows), hi, fa, ko, tr (<= 14 windows each).
* **Parallel text with human alignment** (the "aligned" war-and-peace files do not align paragraph-for-paragraph) and **per-language concept lexicons** (Concepticon is English glosses only; Lexibank/CLDF lists were not vendored).
* **Genre coverage**: news (1 document), community in more than 5 languages, government-legal text that names people and facts; fact-level annotations across genres.
* **Code prior**: lift the 60-entry cap per module in `coreApi`.
* **Wikidata label dumps** (per language, compact) as an offline entity authority for caseless scripts.

## 8. Reproduce

```
cd /Users/mlacy/Documents/3.0/the-fold
bash eval/priors/run-all.sh        # whole study (≈1-2 h idle); needs node >= 22, python3, network for cached MediaWiki/Wikidata
# individual steps
node eval/priors/e1/prep.mjs && ARM=udhr node eval/priors/e1/run.mjs && ARM=plus node eval/priors/e1/run.mjs
ARM=plus K=1000 LAMBDA=3 node eval/priors/e1/ship.mjs              # artifact + its evaluation
node eval/priors/e2/derive.mjs && node eval/priors/e2/downstream.mjs
node eval/priors/e3/fetch.mjs && node eval/priors/e3/run.mjs
node eval/priors/e4/carry.mjs && node eval/priors/e4/entities.mjs
node eval/priors/e5/run.mjs && node eval/priors/e6/run.mjs && node eval/priors/e7/run.mjs
```

Results land in `eval/priors/results/*.json` (+ logs); hand-authored data in `eval/priors/data/` (`e1-questions.json`, `e2-items.mjs`, `e3-questions.json` + `e3-labels.json`, `e4-dialogues.mjs`, `e4-labels-*.json`, rubrics). The patched copies of the two chat modules used in E2 are generated into `eval/priors/tmp/` on each run.

## 9. Limits of this study

Single labeller; all authored sets are small (items/dialogues n = 10-60 per cell, CIs say so); alignments in E5 are silver; the E3 labels penalize pages that are merely answer-bearing (lenient labels reported); IDF/function-word corpora are tiny for most non-English languages; chat-log test files are 3-90 per language (es: 3); the post-hoc arms (extended families, coverage gate, `plus` arm, G2/Gp/G3, truncation-aware code detector, sentence-final-name fix, E2 ru supplement, E3b) were chosen after seeing results and are marked as such — they generate hypotheses for a new pre-registration, they do not rescue a failed bar.
